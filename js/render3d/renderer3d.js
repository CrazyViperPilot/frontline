// 3D-Renderer (Plan „3D mit three.js“, Ansicht „3D“ bzw. ?three=1): Unterklasse von Renderer mit derselben Schnittstelle (render(view),
// resize, setMaxDpr, perf, mood, season, revealAll, cityUi, dpr, canvas). Er besitzt einen THREE.WebGLRenderer auf einer eigenen,
// nicht eingehängten Leinwand. In der Ansicht 3D (camera.iso && camera.three) laufen die Iso-Durchläufe wie bisher (ISO_PASSES),
// einzelne aber ersetzt (isoSwap, layers/passes.js): „Gelände“ malt three (ground3d.js), „Objekte“ ebenfalls (Billboards aus den
// gemalten Bildern, billboards.js, später 3D-Körper). Jedes three-Bild wird an seiner Stelle in die 2D-Leinwand kopiert (wie früher
// der WebGL-Boden aus ground.js), so bleiben Bodenmarken, Nebel, Wetter, Lichtstimmung und Balken in ihrer Reihenfolge unverändert.
// In 2D und Iso zeichnet er genau wie Renderer.
import * as THREE from '../vendor/three/three.module.min.js';
import { Renderer } from '../render/renderer.js';
import { buildTerrain } from '../render/terrain.js';
import { seasonal } from '../render/season.js';
import { setBlitSink } from '../render/spritecache.js';
import { makeWorldRoot, makeIsoCamera, syncIsoCamera, projectWorld, clipDepth } from './camera3d.js';
import { Ground3D } from './ground3d.js';
import { Billboards } from './billboards.js';
import { probePoints, buildTestCubes } from './testscene.js';

const BG = 0x0d110d; // Hintergrund wie der Iso-Boden außerhalb der Karte (layers/isoview.js BG_RGB)

export class Renderer3D extends Renderer {
  /**
   * gl: fertiger THREE.WebGLRenderer (make3D). opts.cubes: Prüfszene, nur Gelände und Würfel (Boden-, Schatten-, Objekt- und
   * Wetterdurchlauf fallen weg), dazu Kreuze an camera.worldToScreen.
   */
  constructor(canvas, game, camera, team, gl, opts = {}) {
    super(canvas, game, camera, team);
    if (opts.cubes) camera.three = camera.iso; // Prüfszene: gleich in 3D
    this.gl = gl;
    this.three = true; // main.js: dieser Renderer kann die Ansicht 3D
    this.cam3 = makeIsoCamera();
    // Boden: eigene Szene, eigenes Bild (deckend)
    this.groundScene = new THREE.Scene();
    this.groundRoot = makeWorldRoot(); // Kinder in Weltkoordinaten (x, y, Höhe), camera3d.js
    this.groundScene.add(this.groundRoot);
    this.ground3d = new Ground3D(gl);
    this.groundRoot.add(this.ground3d.group);
    // Objekte: 3D-Körper unter objRoot (Licht vorläufig fest), Billboards in Clip-Koordinaten; Bild durchsichtig
    this.objScene = new THREE.Scene();
    this.objRoot = makeWorldRoot();
    this.objScene.add(this.objRoot);
    this.objScene.add(new THREE.HemisphereLight(0xfff4e0, 0x404830, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-1, 2, -0.5); // three-Raum: von oben links (vorläufig, später aus mood.js)
    this.objScene.add(sun);
    this.billboards = new Billboards(gl);
    this.objScene.add(this.billboards.mesh);
    this.scratch = null; // 2D-Leinwand für alles, was im Durchlauf „Objekte“ nicht über blit läuft (liegt über den Billboards)
    this.cubes = !!opts.cubes;
    this.probes = null; // Prüfpunkte der Würfel (testscene.js), beim ersten 3D-Bild
    const sw = [
      ['Gelände', (r, f) => r.terrain3d(f)],
      ['Objekte', (r, f) => r.objects3d(f)],
    ];
    if (this.cubes) for (const n of ['Boden', 'Schatten', 'Objekte', 'Wetter']) sw.push([n, null]);
    this.swaps = new Map(sw); // Iso-Durchlauf → Ersatz (null = auslassen)
    this.resize();
  }

  /** Wie Renderer.resize, dazu die three-Leinwand (gleiche CSS-Größe und Pixeldichte wie die 2D-Leinwand). */
  resize() {
    super.resize();
    if (!this.gl) return; // Aufruf aus dem Konstruktor von Renderer, bevor gl gesetzt ist
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(this.cssW, this.cssH, false);
  }

  /** Ein Bild: 2D und Iso wie Renderer; Ansicht 3D mit den Ersatz-Durchläufen (swaps). */
  render(view = null) {
    const on = this.camera.iso && this.camera.three;
    this.isoSwap = on ? this.swaps : null;
    this.frame3d = false; // Kamera für dieses Bild noch nicht gesetzt
    super.render(view); // gleicht auch Relief und Größe ab
    if (on && this.cubes) this.markProbes();
  }

  /** three-Kamera einmal je Bild aus Camera setzen. */
  sync3d() {
    if (this.frame3d) return;
    syncIsoCamera(this.cam3, this.camera);
    this.groundRoot.updateMatrixWorld();
    this.objRoot.updateMatrixWorld();
    this.frame3d = true;
  }

  /** three-Bild an seine Stelle in die 2D-Leinwand kopieren (gleiche Größe in Gerätepixeln). */
  copy3d(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.gl.domElement, 0, 0);
  }

  /** Durchlauf „Gelände“: Höhennetz in three (ground3d.js); ohne Relief das flache Bodenbild wie bisher. */
  terrain3d(f) {
    const { relief } = f;
    if (!relief) return this.isoTerrain(f);
    this.sync3d();
    if (!this.terrainGL) this.terrainGL = seasonal(buildTerrain(f.g.map, 'gl'), this.season);
    this.ground3d.update(relief, this.terrainGL, this.lightVec(), f.now / 1000, this.season === 'winter' ? 1 : 0);
    if (this.cubes) this.syncCubes();
    this.gl.setClearColor(BG, 1);
    this.gl.render(this.groundScene, this.cam3);
    this.copy3d(f.ctx);
  }

  /**
   * Durchlauf „Objekte“: die Objekte nach Tiefe wie isoObjects, aber jedes gemalte Bild (blit) wird ein Billboard mit der Tiefe
   * seines Fußpunkts. Was nicht über blit läuft, landet in einer eigenen 2D-Leinwand und kommt danach obenauf.
   */
  objects3d(f) {
    this.sync3d();
    const ctx = f.ctx;
    const { width: cw, height: ch } = this.canvas;
    const sc = (this.scratch ??= document.createElement('canvas'));
    if (sc.width !== cw || sc.height !== ch) {
      sc.width = cw;
      sc.height = ch;
    }
    const sctx = sc.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, cw, ch);
    const bb = this.billboards;
    bb.begin(cw, ch);
    setBlitSink((c, img, x, y, w, h) => bb.take(c, img, x, y, w, h));
    f.ctx = sctx;
    const one = [null];
    try {
      for (const it of f.items) {
        const o = it.o;
        if (Number.isFinite(o.x) && Number.isFinite(o.y)) bb.item(clipDepth(this.objRoot, this.cam3, o.x, o.y, f.relief ? this.baseHeight(it) : 0));
        one[0] = it;
        this.isoObjects(f, one);
      }
    } finally {
      setBlitSink(null);
      f.ctx = ctx;
    }
    bb.end();
    this.gl.setClearColor(0x000000, 0);
    this.gl.render(this.objScene, this.cam3);
    this.copy3d(ctx);
    ctx.drawImage(sc, 0, 0);
  }

  /** Würfel einmal bauen, sobald das Relief bekannt ist (syncRelief im ersten Bild). */
  syncCubes() {
    if (this.probes) return;
    const relief = this.camera.relief;
    this.probes = probePoints(this.game, this.team);
    this.groundRoot.add(buildTestCubes(this.probes, (x, y) => (relief ? relief.displayAt(x, y) : 0)));
  }

  /** Prüfszene: kleines Kreuz in der 2D-Leinwand an camera.worldToScreen jedes Würfelfußes (muss auf der Würfelmitte unten sitzen). */
  markProbes() {
    if (!this.probes) return;
    const { ctx, dpr, camera } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#ff2050';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const p of this.probes) {
      const s = camera.worldToScreen(p.x, p.y);
      ctx.moveTo(s.x - 6, s.y);
      ctx.lineTo(s.x + 6, s.y);
      ctx.moveTo(s.x, s.y - 6);
      ctx.lineTo(s.x, s.y + 6);
    }
    ctx.stroke();
  }

  /** Partie beendet: WebGL-Kontext und Grafikspeicher freigeben. */
  dispose() {
    this.ground3d.dispose();
    this.billboards.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }

  /**
   * Prüfung (tools/smoke-3d.mjs): je Würfel Bildlage über three (Vector3.project) und über camera.worldToScreen, Abweichung d in px.
   * Setzt die three-Kamera aus dem aktuellen Stand von Camera.
   */
  probe() {
    if (!this.probes) return [];
    syncIsoCamera(this.cam3, this.camera);
    return this.probes.map((p) => {
      const a = projectWorld(this.groundRoot, this.cam3, this.camera, p.x, p.y, p.h);
      const b = this.camera.worldToScreen(p.x, p.y);
      return { name: p.name, x: p.x, y: p.y, h: p.h, three: a, cam: b, d: Math.hypot(a.x - b.x, a.y - b.y) };
    });
  }
}

/** 3D-Renderer bauen (eigene, nicht eingehängte Leinwand). Ohne WebGL (oder bei einem Fehler) null: main.js zeichnet dann klassisch. */
export function make3D(canvas, game, camera, team, opts = {}) {
  try {
    const gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    return new Renderer3D(canvas, game, camera, team, gl, opts);
  } catch (e) {
    console.warn('3D nicht verfügbar, zeichne klassisch:', e?.message ?? e);
    return null;
  }
}
