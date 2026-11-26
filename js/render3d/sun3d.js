// Licht und Schatten der Ansicht 3D (Plan „3D mit three.js“, Paket „Licht und Schatten“): Sonne als DirectionalLight mit Schattenkarte.
// Richtung = Renderer.lightVec (wie Boden-Shader und gemalte Gebäudeschatten: Licht von rechts oben im Bild, dreht mit der Kamera in
// 90°-Schritten), Deckkraft je Lichtstimmung (BALANCE.shadows3d.opacity); die Farbe der Stimmung legt drawMood danach über alles.
//
// Aufbau (Begründung in js/render3d/CLAUDE.md): Boden und Objekte sind getrennte gl.render-Aufrufe, die Einheiten stehen aber erst im
// Durchlauf „Objekte“ an ihrem Platz. Darum fängt ein Schattenfänger die Schatten im Objekt-Bild: dasselbe Höhennetz wie der Boden
// (geteilte Geometrie aus ground3d.js) mit THREE.ShadowMaterial, durchsichtig schwarz, wo Schatten liegt. Ablauf in objects3d:
//   1. Kamera nur Ebene CATCH: three rendert die Schattenkarte (Werfer auf Ebene CAST) und den Fänger mit Tiefe (Hügel verdecken
//      Täler richtig), 2. Tiefe löschen, 3. Kamera Ebene 0: Einheiten und Billboards wie bisher, Schattenkarte nicht neu.
// So liegen die Schatten wie die alten gemalten über Bodenmarken und Wegen, unter Einheiten und Billboards; FS_GROUND bleibt unverändert.
//
// Schattenkarte über dem Ausschnitt: die vier Bildecken auf der niedrigsten und höchsten Geländehöhe (8 Punkte) im Lichtraum, dazu
// margin. Die Ausdehnung hängt nur von Zoom, Drehung und Bildgröße ab (beim Verschieben gleich, auf snap gerundet), die Mitte rastet
// auf das Texel-Raster ein: beim Verschieben wandern die Schatten ganze Texel weit, kein Flimmern.
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { RELIEF } from '../game/relief.js';
import { HEIGHT_SCALE } from './camera3d.js';

const CFG = BALANCE.shadows3d;
/** Ebenen der three-Kamera: CATCH = Schattenfänger, CAST = wirft Schatten (Einheiten-Meshes, später Bäume). */
export const CATCH = 1;
export const CAST = 2;
/** Stufen in der Reihenfolge des Pausenmenüs. */
export const SHADOW_LEVELS = ['off', 'mid', 'high'];
const TOP = 160; // Welt-px über dem höchsten Gelände, bis zu der Werfer (Hubschrauber, Jets im Tiefflug) noch in der Karte liegen

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q0 = new THREE.Vector3();
const _q1 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Sun3D {
  /** gl: THREE.WebGLRenderer; scene: Szene der Objekte; root: Wurzelgruppe (Weltkoordinaten); geometry: Höhennetz des Bodens. */
  constructor(gl, scene, root, geometry) {
    this.gl = gl;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.autoUpdate = false; // nur im ersten der beiden Renders (needsUpdate)
    const light = (this.light = new THREE.DirectionalLight(0xffffff, 1));
    light.layers.enable(CATCH);
    light.shadow.camera.layers.set(CAST); // nur Werfer in die Karte (three nimmt die Ebenen der Schattenkamera, wenn ≠ 0)
    light.shadow.bias = CFG.bias;
    scene.add(light, light.target);
    const mat = new THREE.ShadowMaterial({ color: 0x000000, opacity: CFG.opacity.none });
    // undurchsichtige Liste (vor allem anderen), aber gemischt: vormultipliziert schwarz mit Deckkraft über dem leeren Bild
    mat.transparent = false;
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = THREE.OneFactor;
    mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    mat.side = THREE.DoubleSide; // Höhennetz unter gespiegelter Wurzel (wie ground3d.js)
    this.catcher = new THREE.Mesh(geometry, mat);
    this.catcher.name = 'schattenfaenger';
    this.catcher.layers.set(CATCH);
    this.catcher.receiveShadow = true;
    this.catcher.frustumCulled = false;
    this.catcher.matrixAutoUpdate = false;
    root.add(this.catcher);
    this.level = 'off';
    this.cfg = null;
    this.span = null; // Höhenbereich des Geländes { lo, hi, relief, version }
    this.info = null; // letzte Anpassung (Messung, Prüfskript): { w, h, texel }
    this.setLevel('off');
  }

  /** Stufe 'off' | 'mid' | 'high' (BALANCE.shadows3d.levels); wirkt ohne Neustart (Karte neu anlegen, Fänger neu übersetzen). */
  setLevel(level) {
    const cfg = CFG.levels[level] ?? null;
    if (!(level in CFG.levels)) level = 'off';
    const was = this.cfg;
    this.level = level;
    this.cfg = cfg;
    const on = !!cfg;
    this.gl.shadowMap.enabled = on;
    this.light.castShadow = on;
    this.catcher.visible = on;
    if (on) {
      const sh = this.light.shadow;
      if (was?.size !== cfg.size) {
        sh.mapSize.set(cfg.size, cfg.size);
        sh.map?.dispose();
        sh.map = null;
      }
      sh.radius = cfg.radius;
    }
    this.catcher.material.needsUpdate = true;
  }

  get on() {
    return !!this.cfg;
  }

  /** Deckkraft aus der Lichtstimmung (mood: Schlüssel aus MOODS oder null). */
  setMood(mood) {
    this.catcher.material.opacity = CFG.opacity[mood ?? 'none'] ?? CFG.opacity.none;
  }

  /** Niedrigste und höchste sichtbare Geländehöhe (Seen als Wasserspiegel), je Geländestand einmal. */
  heightSpan(relief) {
    const s = this.span;
    if (s && s.relief === relief && s.version === relief?.version) return s;
    let lo = 0;
    let hi = 0;
    if (relief) {
      lo = Infinity;
      hi = -Infinity;
      for (const v of relief.fine) {
        const h = Math.max(v, RELIEF.water);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    return (this.span = { lo, hi, relief, version: relief?.version });
  }

  /**
   * Vor dem Render: Sonne in Weltrichtung light (Vektor zur Sonne, z oben, Renderer.lightVec) und Schattenkamera eng um den Ausschnitt
   * der three-Kamera cam3 legen (Texel-Raster eingerastet); relief für den Höhenbereich (oder null).
   */
  update(cam3, light, relief) {
    if (!this.cfg) return;
    const S = HEIGHT_SCALE;
    // Richtung zur Sonne im three-Raum (die Wurzel bildet linear ab: Parallelprojektion bleibt Parallelprojektion)
    const d = _p.set(light[0], light[2] * S, light[1]).normalize();
    const r = _a.crossVectors(UP, d).normalize();
    const u = _b.crossVectors(d, r);
    const { lo, hi } = this.heightSpan(relief);
    let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    const q0 = _q0;
    const q1 = _q1;
    for (const nx of [-1, 1]) {
      for (const ny of [-1, 1]) {
        q0.set(nx, ny, -1).unproject(cam3);
        q1.set(nx, ny, 1).unproject(cam3);
        for (const h of [lo, hi + TOP]) {
          const t = (h * S - q0.y) / (q1.y - q0.y);
          const x = q0.x + (q1.x - q0.x) * t;
          const y = h * S;
          const z = q0.z + (q1.z - q0.z) * t;
          const pr = x * r.x + y * r.y + z * r.z;
          const pu = x * u.x + y * u.y + z * u.z;
          const pd = x * d.x + y * d.y + z * d.z;
          if (pr < r0) r0 = pr;
          if (pr > r1) r1 = pr;
          if (pu < u0) u0 = pu;
          if (pu > u1) u1 = pu;
          if (pd < d0) d0 = pd;
          if (pd > d1) d1 = pd;
        }
      }
    }
    const m = CFG.margin;
    const snap = CFG.snap;
    // halbe Ausdehnung: nur von Zoom, Drehung und Bildgröße abhängig, gerundet (kleine Rechenfehler ändern sie nicht)
    const hw = Math.ceil(((r1 - r0) / 2 + m) / snap - 1e-3) * snap;
    const hh = Math.ceil(((u1 - u0) / 2 + m) / snap - 1e-3) * snap;
    const size = this.cfg.size;
    const tr = (2 * hw) / size;
    const tu = (2 * hh) / size;
    const cr = Math.round((r0 + r1) / 2 / tr) * tr; // Mitte auf das Texel-Raster
    const cu = Math.round((u0 + u1) / 2 / tu) * tu;
    const cd = (d0 + d1) / 2;
    const hd = (d1 - d0) / 2 + m;
    const L = this.light;
    L.target.position.set(r.x * cr + u.x * cu + d.x * cd, r.y * cr + u.y * cu + d.y * cd, r.z * cr + u.z * cu + d.z * cd);
    L.position.copy(L.target.position).addScaledVector(d, hd + 10);
    L.updateMatrixWorld();
    L.target.updateMatrixWorld();
    const c = L.shadow.camera;
    c.left = -hw;
    c.right = hw;
    c.top = hh;
    c.bottom = -hh;
    c.near = 1;
    c.far = 2 * hd + 20;
    c.updateProjectionMatrix();
    this.info = { w: 2 * hw, h: 2 * hh, texel: Math.max(tr, tu), cr, cu };
  }

  dispose() {
    this.catcher.material.dispose();
    this.light.shadow.map?.dispose();
    this.light.dispose();
  }
}
