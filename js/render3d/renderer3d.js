// 3D-Renderer (Plan „3D mit three.js“, Paket „3D-Gerüst“, nur mit ?three=1): Unterklasse von Renderer mit derselben Schnittstelle
// (render(view), resize, setMaxDpr, perf, mood, season, revealAll, cityUi, dpr, canvas). Er besitzt einen THREE.WebGLRenderer auf
// eigener Leinwand (#view3d) unter der bisherigen 2D-Leinwand (#view, in Iso durchsichtig). In der Iso-Ansicht zeichnet erst der
// bisherige Renderer seine Durchläufe in die 2D-Leinwand, ohne die, die three übernimmt (takes: Namen aus ISO_PASSES, layers/passes.js),
// danach three seine Szene. Die 2D-Ansicht bleibt Canvas: die three-Leinwand ist dann versteckt.
import * as THREE from '../vendor/three/three.module.min.js';
import { Renderer } from '../render/renderer.js';
import { makeWorldRoot, makeIsoCamera, syncIsoCamera, projectWorld } from './camera3d.js';
import { probePoints, buildTestCubes } from './testscene.js';

const BG = 0x0d110d; // Hintergrund wie der Iso-Boden außerhalb der Karte (layers/isoview.js BG_RGB)

export class Renderer3D extends Renderer {
  /**
   * gl: fertiger THREE.WebGLRenderer auf der Leinwand unter canvas (make3D). opts.cubes: Prüfszene mit Würfeln; die Durchläufe
   * „Boden“ und „Wetter“ fallen dann weg, damit die Würfel zu sehen sind (Wetternebel deckt ohne Boden die ganze Leinwand).
   */
  constructor(canvas, game, camera, team, gl, opts = {}) {
    super(canvas, game, camera, team);
    this.gl = gl;
    this.gl.setClearColor(BG, 1);
    this.scene = new THREE.Scene();
    this.world = makeWorldRoot(); // Kinder in Weltkoordinaten (x, y, Höhe), camera3d.js
    this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404830, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-1, 2, -0.5); // three-Raum: von oben links (vorläufig, später aus mood.js)
    this.scene.add(sun);
    this.cam3 = makeIsoCamera();
    this.takes = new Set(opts.cubes ? ['Boden', 'Wetter'] : []); // Iso-Durchläufe, die three zeichnet
    this.cubes = !!opts.cubes;
    this.probes = null; // Prüfpunkte der Würfel (testscene.js), beim ersten Iso-Bild
    this.shown3d = null; // three-Leinwand gerade sichtbar (Iso) oder versteckt (2D)
    this.resize();
  }

  /** Wie Renderer.resize, dazu die three-Leinwand (gleiche CSS-Größe und Pixeldichte wie die 2D-Leinwand). */
  resize() {
    super.resize();
    if (!this.gl) return; // Aufruf aus dem Konstruktor von Renderer, bevor gl gesetzt ist
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(this.cssW, this.cssH, false);
  }

  /** Ein Bild: 2D wie bisher; Iso: 2D-Durchläufe ohne die von three übernommenen, dann die three-Szene. */
  render(view = null) {
    const iso = this.camera.iso;
    if (iso !== this.shown3d) {
      this.shown3d = iso;
      this.gl.domElement.style.display = iso ? '' : 'none';
      this.canvas.classList.toggle('over3d', iso); // 2D-Leinwand durchsichtig (css/style.css)
    }
    if (!iso) {
      this.isoSkip = null;
      super.render(view);
      return;
    }
    this.isoSkip = this.takes.size ? this.takes : null;
    if (this.takes.has('Boden')) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    super.render(view); // gleicht auch Relief und Größe ab
    const pf = this.perf;
    const t = pf ? performance.now() : 0;
    if (this.cubes) this.syncCubes();
    syncIsoCamera(this.cam3, this.camera);
    this.gl.render(this.scene, this.cam3);
    if (this.cubes) this.markProbes();
    if (pf) pf.lap('3D', t);
  }

  /** Würfel einmal bauen, sobald das Relief bekannt ist (syncRelief im ersten Bild). */
  syncCubes() {
    if (this.probes) return;
    const relief = this.camera.relief;
    this.probes = probePoints(this.game, this.team);
    this.world.add(buildTestCubes(this.probes, (x, y) => (relief ? relief.displayAt(x, y) : 0)));
  }

  /** Prüfszene: kleines Kreuz in der 2D-Leinwand an camera.worldToScreen jedes Würfelfußes (muss auf der Würfelmitte unten sitzen). */
  markProbes() {
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

  /** Partie beendet: three-Leinwand und WebGL-Kontext freigeben, 2D-Leinwand wieder deckend. */
  dispose() {
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.gl.domElement.remove();
    this.canvas.classList.remove('over3d');
  }

  /**
   * Prüfung (tools/smoke-3d.mjs): je Würfel Bildlage über three (Vector3.project) und über camera.worldToScreen, Abweichung d in px.
   * Setzt die three-Kamera aus dem aktuellen Stand von Camera.
   */
  probe() {
    if (!this.probes) return [];
    syncIsoCamera(this.cam3, this.camera);
    return this.probes.map((p) => {
      const a = projectWorld(this.world, this.cam3, this.camera, p.x, p.y, p.h);
      const b = this.camera.worldToScreen(p.x, p.y);
      return { name: p.name, x: p.x, y: p.y, h: p.h, three: a, cam: b, d: Math.hypot(a.x - b.x, a.y - b.y) };
    });
  }
}

/**
 * three-Leinwand unter canvas anlegen und den 3D-Renderer bauen. Ohne WebGL (oder bei einem Fehler) null: dann zeichnet main.js
 * mit dem bisherigen Renderer.
 */
export function make3D(canvas, game, camera, team, opts = {}) {
  const c3 = document.createElement('canvas');
  c3.id = 'view3d';
  canvas.parentNode.insertBefore(c3, canvas);
  try {
    const gl = new THREE.WebGLRenderer({ canvas: c3, antialias: true, alpha: false, powerPreference: 'high-performance' });
    return new Renderer3D(canvas, game, camera, team, gl, opts);
  } catch (e) {
    console.warn('3D nicht verfügbar, zeichne klassisch:', e?.message ?? e);
    c3.remove();
    return null;
  }
}
