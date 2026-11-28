// Tag und Nacht der Ansicht 3D (Plan „3D mit three.js“, Paket „Tag und Nacht 3D“): Lichter, die über der Lichtstimmung leuchten.
// Die Stimmung (render/mood.js drawMood) dunkelt das ganze Bild ab, auch die Fenster. Der Durchlauf „Lichter“ (nach „Wetter“) zeichnet
// darum in ein eigenes three-Bild, das additiv („lighter“) in die 2D-Leinwand kommt:
//   1. Fenster und Lampen der Gebäude: dieselben InstancedMeshes noch einmal (Ebene GLOW, Baukasten mit setKitGlow), Tiefentest gegen den
//      Tiefenpuffer aus „Objekte“ (gleiche Geometrie, gleiche Tiefe), was davor steht, verdeckt sie;
//   2. Lichtflecken am Boden und Leuchtköpfe der Laternen: ein InstancedMesh flacher Scheiben (weicher Abfall im Shader), höchstens max
//      (BALANCE.lights3d), Tiefentest ohne Schreiben; das Gelände steht nicht im Tiefenpuffer, die Flecken liegen also über jedem Hang;
//   3. Maske aus dem Kriegsnebel: das Nebel-Netz (fog3d.js, gleiche Uniforms) multipliziert das Lichterbild mit 1 − Deckkraft des Nebels,
//      damit im Unerkundeten nichts leuchtet und im Erkundeten nur gedämpft.
// Echte Lichtquellen in allen Shadern (Boden, Einheiten, Bäume) wären teurer; die Flecken geben den Schein der Laternen auf allem darunter.
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { HEIGHT_SCALE } from './camera3d.js';

/** Ebene der three-Kamera mit allem, was im Lichter-Durchlauf noch einmal gezeichnet wird (Gebäude des Baukastens, town3d.js). */
export const GLOW = 3;

const CFG = BALANCE.lights3d;
const CAP = 256; // Platz im InstancedMesh (max bleibt darunter)

const VS = `
attribute vec4 aLight; // Weltmitte x, y, Höhe, Radius (Welt-px)
attribute vec4 aCol;   // Farbe 0–1 · Stärke, Form (0 Fleck am Boden, 1 Leuchtkopf)
uniform float uS;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vUv = position.xy;
  vCol = aCol;
  vec3 w = vec3(aLight.xy + position.xy * aLight.w, aLight.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
}`;

const FS = `
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 >= 1.0) discard;
  float f = vCol.a > 0.5 ? 1.0 - smoothstep(0.35, 1.0, sqrt(r2)) : (1.0 - r2) * (1.0 - r2) * (0.55 + 0.45 * (1.0 - sqrt(r2)));
  vec3 c = vCol.rgb * f;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); // vormultipliert
}`;

/** Stärke des Lichter-Durchlaufs für eine Lichtstimmung (0 = aus). */
export const glowOf = (mood) => CFG.glow[mood] ?? 0;
/** Nachtanteil der Fenster (kit3d uNight) für eine Lichtstimmung. */
export const nightOf = (mood) => CFG.night[mood] ?? 0;
/** Sonnenhöhe (z-Anteil des Lichtvektors) für eine Lichtstimmung, null = wie ohne Stimmung. */
export const elevOf = (mood) => CFG.elev[mood] ?? null;

/**
 * Lichtquellen eines Bildes aus der Objektliste (f.items, isoItems): Laternen der Karte (t 16, street_lamp, nicht zerstört) und Häuser
 * mit Fenstern (t 0: Stadthäuser kind 'town', Häuser und Bahnhof der Kartenstadt). house(o) entscheidet, ob ein Haus als 3D-Körper steht.
 * Rückgabe [{ x, y, r, k, color, head? }], nach Abstand zur Mitte (cx, cy) gekürzt auf max.
 */
export function lightSources(items, cx, cy, house = () => true, max = CFG.max) {
  const out = [];
  for (const it of items ?? []) {
    const o = it.o;
    if (it.t === 16 && o.kind === 'street_lamp' && !o.rubble) {
      const a = o.a ?? 0;
      const L = CFG.lamp;
      out.push({ x: o.x + Math.cos(a) * 7.25, y: o.y + Math.sin(a) * 7.25, r: L.r, k: L.k, color: L.color, head: true });
    } else if (it.t === 0 && (o.kind === 'town' || (!o.ck && (o.kind === 'house' || o.kind === 'station'))) && house(o)) {
      const H = CFG.house;
      out.push({ x: o.x, y: o.y, r: H.r + 0.5 * Math.max(o.w ?? 56, o.h ?? 56), k: H.k, color: H.color }); // reicht über die Grundfläche hinaus
    }
  }
  if (out.length > max) {
    out.sort((p, q) => (p.x - cx) ** 2 + (p.y - cy) ** 2 - ((q.x - cx) ** 2 + (q.y - cy) ** 2));
    out.length = max;
  }
  return out;
}

export class Lights3D {
  /** fog3d: Fog3D (Uniforms und Geometrie des Kriegsnebels werden für die Maske mitbenutzt). */
  constructor(fog3d) {
    const geo = new THREE.InstancedBufferGeometry();
    // Scheibe als Viereck −1 … 1 (Kreis im Shader), liegt waagrecht in Weltkoordinaten
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aLight = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
    this.aLight.setUsage(THREE.DynamicDrawUsage);
    this.aCol.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aLight', this.aLight);
    geo.setAttribute('aCol', this.aCol);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uS: { value: HEIGHT_SCALE } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide, // gespiegelte Wurzelgruppe (camera3d.js)
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    // Maske: Nebel-Shader, Bild × (1 − Deckkraft)
    this.maskMaterial = new THREE.ShaderMaterial({
      uniforms: fog3d.uniforms,
      vertexShader: fog3d.material.vertexShader,
      fragmentShader: fog3d.material.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mask = new THREE.Mesh(fog3d.mesh.geometry, this.maskMaterial);
    this.mask.frustumCulled = false;
    this.mask.matrixAutoUpdate = false;
    this.mask.renderOrder = 2;
    this.group = new THREE.Group();
    this.group.name = 'lichter';
    this.group.add(this.mesh, this.mask);
    this.count = 0;
  }

  /**
   * Lichtquellen setzen (lightSources), Stärke k der Stimmung, ground(x, y) = Geländehöhe; fog: Maske an (false bei aufgedecktem Nebel).
   * Rückgabe: Zahl der Scheiben (Flecken und Leuchtköpfe).
   */
  update(list, k, ground, fog = true) {
    const L = this.aLight.array;
    const C = this.aCol.array;
    let n = 0;
    const put = (x, y, z, r, col, s, head) => {
      if (n >= CAP) return;
      L.set([x, y, z, r], n * 4);
      C.set([(col[0] / 255) * s, (col[1] / 255) * s, (col[2] / 255) * s, head ? 1 : 0], n * 4);
      n++;
    };
    for (const p of list) {
      const h = ground(p.x, p.y);
      put(p.x, p.y, h + 0.6, p.r, p.color, p.k * k, false);
      if (p.head) put(p.x, p.y, h + CFG.lamp.z, CFG.lamp.head, [255, 246, 214], Math.min(1, 1.2 * k), true);
    }
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    this.aLight.clearUpdateRanges();
    this.aLight.addUpdateRange(0, n * 4);
    this.aLight.needsUpdate = true;
    this.aCol.clearUpdateRanges();
    this.aCol.addUpdateRange(0, n * 4);
    this.aCol.needsUpdate = true;
    this.mask.visible = fog;
    return (this.count = n);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.maskMaterial.dispose(); // Geometrie und Uniforms der Maske gehören dem Nebel
  }
}
