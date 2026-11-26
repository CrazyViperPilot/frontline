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
import { Units3D } from './units3d.js';
import { Fog3D } from './fog3d.js';
import { Sun3D, CATCH } from './sun3d.js';
import { Trees3D } from './trees3d.js';
import { Town3D } from './town3d.js';
import { Nature3D } from './nature3d.js';
import { bushLook3d, rockLook3d, animalLook3d } from '../render/nature.js';
import { BALANCE } from '../data/balance.js';
import { treeLook3d } from '../render/nature.js';
import { probePoints, buildTestCubes } from './testscene.js';

const BG = 0x0d110d; // Hintergrund wie der Iso-Boden außerhalb der Karte (layers/isoview.js BG_RGB)

export class Renderer3D extends Renderer {
  /**
   * gl: fertiger THREE.WebGLRenderer (make3D). opts.shadows: Schattenstufe ('off' | 'mid' | 'high', main.js aus prefs.js). opts.cubes: Prüfszene, nur Gelände und Würfel (Boden-, Schatten-, Objekt- und
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
    // Objekte: 3D-Körper unter objRoot, Billboards in Clip-Koordinaten; Bild durchsichtig
    this.objScene = new THREE.Scene();
    this.objRoot = makeWorldRoot();
    this.objScene.add(this.objRoot);
    // Sonne mit Schattenkarte und Schattenfänger auf dem Höhennetz des Bodens (sun3d.js); Stufe setzt main.js (setShadows)
    this.sun = new Sun3D(gl, this.objScene, this.objRoot, this.ground3d.mesh.geometry);
    this.shadow3d = false; // drawUnitIsoAt: gemalte Einheitenschatten weglassen (nur während „Objekte“ mit Schattenkarte)
    this.setShadows(opts.shadows ?? 'off');
    this.billboards = new Billboards(gl);
    this.objScene.add(this.billboards.mesh);
    this.units3d = new Units3D(); // Einheiten als Meshes (units3d.js), gezeigt über unit3d aus drawUnitIsoAt
    this.objRoot.add(this.units3d.group);
    this.unit3d = null; // nur während des Durchlaufs „Objekte“ gesetzt
    this.trees3d = new Trees3D(); // Bäume als InstancedMesh je Form (trees3d.js), gezeigt über tree3d aus isoObjects
    this.objRoot.add(this.trees3d.group);
    this.tree3d = null; // nur während des Durchlaufs „Objekte“ gesetzt
    this.trees3dOn = true; // false: Bäume wie in Iso als gemalte Billboards (Prüfskript: Vergleich Iso/3D, Messung)
    this.treeShadow3d = false; // isoShadows: gemalte Baumschatten weglassen (3D-Bäume werfen sie selbst)
    this.towns3d = new Town3D(); // Stadthäuser 1 × 1 und Werke als InstancedMesh je Variante (town3d.js), gezeigt über house3d aus drawTownItemIso
    this.objRoot.add(this.towns3d.group);
    this.house3d = null; // nur während des Durchlaufs „Objekte“ gesetzt
    this.towns3dOn = true; // false: Stadthäuser wie in Iso als gemalte Billboards (Prüfskript: Messung vorher/nachher)
    this.works3dOn = true; // false: Werke und Kraftwerk gemalt
    this.nature3d = new Nature3D(); // Büsche, Felsen, Tiere als InstancedMesh je Form (nature3d.js), gezeigt über bush3d, rock3d, animal3d
    this.objRoot.add(this.nature3d.group);
    this.bush3d = this.rock3d = this.animal3d = null; // nur während des Durchlaufs „Objekte“ gesetzt
    this.nature3dOn = true; // false: Büsche, Felsen, Tiere wie in Iso gemalt (Prüfskript: Vergleich und Messung)
    this.natureShadow3d = false; // isoShadows: gemalte Schatten der Büsche und Felsen weglassen (3D wirft sie selbst)
    this.animalShadow2d = false; // isoShadows: Fußschatten der 3D-Tiere gemalt (ohne Schattenkarte)
    // Nebel: eigene Szene über allem (ohne Tiefentest), gleiche Geometrie wie der Boden
    this.fogScene = new THREE.Scene();
    this.fogRoot = makeWorldRoot();
    this.fogScene.add(this.fogRoot);
    this.fog3d = new Fog3D(this.ground3d);
    this.fogRoot.add(this.fog3d.group);
    this.scratch = null; // 2D-Leinwand für alles, was im Durchlauf „Objekte“ nicht über blit läuft (liegt über den Billboards)
    this.cubes = !!opts.cubes;
    this.probes = null; // Prüfpunkte der Würfel (testscene.js), beim ersten 3D-Bild
    const sw = [
      ['Gelände', (r, f) => r.terrain3d(f)],
      ['Objekte', (r, f) => r.objects3d(f)],
      ['Flieger', null], // Luftfahrzeuge zeichnet „Objekte“ mit (Tiefe statt „immer obenauf“)
      ['Nebel', (r, f) => r.fog3dPass(f)],
    ];
    if (this.cubes) for (const n of ['Boden', 'Schatten', 'Objekte', 'Wetter']) sw.push([n, null]);
    this.swaps = new Map(sw); // Iso-Durchlauf → Ersatz (null = auslassen)
    this.resize();
  }

  /** Schattenstufe 'off' | 'mid' | 'high' (BALANCE.shadows3d), sofort wirksam; Aus: gemalte Schatten wie in Iso. */
  setShadows(level) {
    this.sun.setLevel(level);
  }

  /** Aktuelle Schattenstufe. */
  get shadows() {
    return this.sun.level;
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
    this.treeShadow3d = on && this.trees3dOn && this.sun.on && !this.cubes;
    this.natureShadow3d = on && this.nature3dOn && this.sun.on && !this.cubes;
    this.animalShadow2d = on && this.nature3dOn && !this.sun.on && !this.cubes;
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
    this.fogRoot.updateMatrixWorld();
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
    this.ground3d.update(relief, this.terrainGL, this.lightVec(), f.now / 1000, this.season === 'winter' ? 1 : 0, this.cam3, this.mood); // Wasser: Blick und Stimmung
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
    const cam = this.camera;
    const relief = f.relief;
    const light = this.lightVec();
    this.units3d.begin(light);
    const sun = this.sun.on && !this.cubes;
    this.shadow3d = sun;
    this.trees3d.begin(light, this.season, cam.zoom);
    const season = this.season;
    this.tree3d = !this.trees3dOn ? null : (t) => this.trees3d.add(treeLook3d(t, season), t.x, t.y, cam.pinned ?? (relief ? relief.displayAt(t.x, t.y) : 0));
    this.unit3d = (f, u, aim, lift) => this.units3d.show(u, cam.pinned ?? (relief ? relief.displayAt(u.x, u.y) : 0), lift, aim, f.now);
    // Stadthäuser: Sonne, Schnee, Nacht und Schattenstärke wie Boden und Schattenfänger; Höhe wie das Billboard (cam.pin)
    this.towns3d.begin({ light, snow: season === 'winter' ? 1 : 0, night: this.mood === 'night' ? 1 : 0, shade: BALANCE.shadows3d.opacity[this.mood ?? 'none'] ?? BALANCE.shadows3d.opacity.none });
    this.house3d = (o) => (o.kind === 'town' ? this.towns3dOn : this.works3dOn) && this.towns3d.add(o, cam.pinned ?? (relief ? relief.displayAt(o.x, o.y) : 0));
    // Büsche, Felsen, Tiere (nature3d.js): Höhe wie das Billboard
    this.nature3d.begin(light, season);
    if (this.nature3dOn) {
      const at = (o) => cam.pinned ?? (relief ? relief.displayAt(o.x, o.y) : 0);
      this.bush3d = (b) => this.nature3d.bush(bushLook3d(b, season), b.x, b.y, at(b));
      this.rock3d = (o) => this.nature3d.rock(rockLook3d(o, season), o.x, o.y, at(o));
      this.animal3d = (a, now) => this.nature3d.animal(animalLook3d(a, now), a, at(a));
    }
    try {
      for (const it of f.items) {
        const o = it.o;
        if (Number.isFinite(o.x) && Number.isFinite(o.y)) bb.item(clipDepth(this.objRoot, this.cam3, o.x, o.y, relief ? this.baseHeight(it) : 0));
        one[0] = it;
        this.isoObjects(f, one);
      }
      // Luftfahrzeuge (sonst Durchlauf „Flieger“): Mesh mit eigener Tiefe, Schatten und Rotoren wie bisher
      for (const u of f.air ?? []) {
        bb.item(clipDepth(this.objRoot, this.cam3, u.x, u.y, relief ? relief.displayAt(u.x, u.y) : 0));
        f.ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
        this.drawUnitIsoAt(f, u);
      }
    } finally {
      setBlitSink(null);
      this.unit3d = null;
      this.tree3d = null;
      this.house3d = null;
      this.bush3d = this.rock3d = this.animal3d = null;
      this.shadow3d = false;
      f.ctx = ctx;
    }
    this.units3d.end();
    this.trees3d.end();
    this.towns3d.end();
    this.nature3d.end();
    bb.end();
    const gl = this.gl;
    gl.setClearColor(0x000000, 0);
    if (sun) {
      // 1. Schattenkarte und Schattenfänger (Ebene CATCH), 2. Tiefe löschen, 3. Objekte (Ebene 0) wie ohne Schatten
      this.sun.setMood(this.mood);
      this.sun.update(this.cam3, light, relief);
      gl.shadowMap.needsUpdate = true;
      this.cam3.layers.set(CATCH);
      gl.render(this.objScene, this.cam3);
      this.cam3.layers.set(0);
      gl.autoClear = false;
      gl.clearDepth();
      try {
        gl.render(this.objScene, this.cam3);
      } finally {
        gl.autoClear = true;
      }
    } else gl.render(this.objScene, this.cam3);
    this.copy3d(ctx);
    ctx.drawImage(sc, 0, 0);
  }

  /** Durchlauf „Nebel“: Kriegsnebel auf dem Höhennetz in three (fog3d.js); ohne Relief wie bisher. */
  fog3dPass(f) {
    if (f.reveal) return;
    if (!f.relief) return this.isoFog(f);
    this.sync3d();
    this.fog3d.update(this.fogData(f.g.fog[f.team]), f.now / 1000);
    this.gl.setClearColor(0x000000, 0);
    this.gl.render(this.fogScene, this.cam3);
    this.copy3d(f.ctx);
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
    this.units3d.dispose();
    this.trees3d.dispose();
    this.towns3d.dispose();
    this.nature3d.dispose();
    this.fog3d.dispose();
    this.sun.dispose();
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
    // ohne Kantenglättung: wie der alte WebGL-Boden; MSAA kostete im Software-WebGL das Doppelte, bei Pixeldichte 2 kaum sichtbar
    const gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    return new Renderer3D(canvas, game, camera, team, gl, opts);
  } catch (e) {
    console.warn('3D nicht verfügbar, zeichne klassisch:', e?.message ?? e);
    return null;
  }
}
