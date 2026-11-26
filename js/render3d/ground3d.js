// 3D-Boden (Plan „3D mit three.js“, Paket „3D-Boden“): Höhennetz aus relief.fine als BufferGeometry mit dem Boden-Shader von
// render/ground.js (Gras, Fels, Ufer, Wasser, Schnee; FS_GROUND unverändert) als ShaderMaterial, dazu der Erdschnitt am
// Kartenrand. Das Bodenbild (buildTerrain(map, 'gl'), ohne Gebäude und Bäume) ist die Textur. Liegt in Weltkoordinaten (x, y, Höhe)
// unter der Wurzelgruppe (camera3d.js), steht also im selben Tiefenpuffer wie spätere 3D-Objekte.
// Sichtbare Höhe wie relief.displayAt: Seen als ebene Wasserfläche. Gelände-Änderungen (Editor) laden nur die geänderten Zeilen.
// Licht vorerst wie im Shader (Lichtvektor aus Renderer.lightVec); three-Licht und Schattenempfang: Paket „Licht und Schatten“.
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { RELIEF, FINE_N } from '../game/relief.js';
import { FS_GROUND, SKIRT_BOTTOM, NOISE_N, noiseTexture } from '../render/ground.js';
import { groundDetail, DETAIL_N } from '../render/groundtex.js';

const W = BALANCE.map.width;
const STEP = RELIEF.step;

// Lage kommt als position (x, y, sichtbare Höhe), aH = (Höhe für die Farbe, Neigung x, Neigung y) wie in ground.js
const VS = `
attribute vec3 aH;
varying vec2 vPos;
varying float vH;
varying vec2 vG;
void main() {
  vPos = position.xy;
  vH = aH.x;
  vG = aH.yz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Kachelbare Datentextur (RGBA, Zweierpotenz) mit Mipmaps und Wiederholung. */
function repeatTex(data, n, aniso) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export class Ground3D {
  /** gl: THREE.WebGLRenderer (für die anisotrope Filterung). */
  constructor(gl) {
    const aniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    this.maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const shared = {
      uTex: { value: null },
      uNoise: { value: repeatTex(noiseTexture(), NOISE_N, 1) },
      uDetail: { value: repeatTex(groundDetail(), DETAIL_N, aniso) },
      uLight: { value: new THREE.Vector3(0, 0, 1) },
      uTime: { value: 0 },
      uWater: { value: RELIEF.water },
      uSnow: { value: 0 },
    };
    const mat = (skirt) =>
      new THREE.ShaderMaterial({ uniforms: { ...shared, uSkirt: { value: skirt } }, vertexShader: VS, fragmentShader: FS_GROUND, side: THREE.DoubleSide }); // wie ground.js: ohne Weglassen von Rückseiten
    this.uniforms = shared; // gemeinsame Objekte: Werte gelten für Netz und Rand
    this.group = new THREE.Group();
    this.group.name = 'boden';
    this.mesh = new THREE.Mesh(this.buildGrid(), mat(0));
    this.skirt = new THREE.Mesh(this.buildSkirt(), mat(1));
    for (const m of [this.mesh, this.skirt]) {
      m.frustumCulled = false; // Lage ändert sich mit dem Gelände; der Ausschnitt ist ohnehin fast immer auf der Karte
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    this.relief = null;
    this.version = -1;
    this.texSrc = null;
  }

  /** Gitter FINE_N × FINE_N (Abstand STEP) mit Dreiecken wie ground.js; Höhen setzt uploadRelief. */
  buildGrid() {
    const n = FINE_N;
    const pos = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        pos[(j * n + i) * 3] = i * STEP;
        pos[(j * n + i) * 3 + 1] = j * STEP;
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        idx.set([a, a + 1, a + n, a + 1, a + n + 1, a + n], k);
        k += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }

  /** Erdschnitt: vier Seiten, je Feinpunkt oben (sichtbare Geländehöhe) und unten (SKIRT_BOTTOM); Normale nach außen in aH.yz. */
  buildSkirt() {
    const n = FINE_N;
    this.sides = [(t) => [t * STEP, 0, 0, -1], (t) => [W, t * STEP, 1, 0], (t) => [W - t * STEP, W, 0, 1], (t) => [0, W - t * STEP, -1, 0]];
    const pos = new Float32Array(4 * n * 2 * 3);
    const idx = [];
    let v = 0;
    for (const side of this.sides) {
      for (let t = 0; t < n; t++) {
        const [x, y] = side(t);
        pos.set([x, y, 0, x, y, SKIRT_BOTTOM], v * 3);
        if (t < n - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(4 * n * 2 * 3), 3));
    geo.setIndex(idx);
    return geo;
  }

  /**
   * Höhen und Neigungen aus relief.fine übernehmen. Dasselbe Gelände mit relief.rows (Editor): nur diese Zeilen samt Rand.
   * relief.rows teilt sich der 3D-Boden mit ground.js (Nebel); wer es zuerst liest, löscht es, der andere lädt dann alles.
   */
  uploadRelief(relief) {
    const n = FINE_N;
    const F = relief.fine;
    const geo = this.mesh.geometry;
    const P = geo.attributes.position;
    const A = geo.attributes.aH;
    const part = relief === this.relief && relief.rows;
    const r0 = part ? Math.max(0, relief.rows[0] - 1) : 0;
    const r1 = part ? Math.min(n - 1, relief.rows[1] + 1) : n - 1;
    const water = RELIEF.water;
    for (let j = r0; j <= r1; j++) {
      const jm = Math.max(0, j - 1) * n;
      const jp = Math.min(n - 1, j + 1) * n;
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const im = Math.max(0, i - 1);
        const ip = Math.min(n - 1, i + 1);
        P.array[k * 3 + 2] = Math.max(F[k], water);
        A.array[k * 3] = F[k];
        A.array[k * 3 + 1] = (F[j * n + ip] - F[j * n + im]) / ((ip - im) * STEP);
        A.array[k * 3 + 2] = (F[jp + i] - F[jm + i]) / (((jp - jm) / n) * STEP);
      }
    }
    for (const a of [P, A]) {
      a.clearUpdateRanges();
      a.addUpdateRange(r0 * n * 3, (r1 - r0 + 1) * n * 3);
      a.needsUpdate = true;
    }
    relief.rows = null;
    const SP = this.skirt.geometry.attributes.position;
    const SA = this.skirt.geometry.attributes.aH;
    let v = 0;
    for (const side of this.sides) {
      for (let t = 0; t < n; t++) {
        const [x, y, nx, ny] = side(t);
        const h = Math.max(water, relief.heightAt(x, y));
        SP.array[v * 3 + 2] = h;
        SA.array.set([h, nx, ny, SKIRT_BOTTOM, nx, ny], v * 3);
        v += 2;
      }
    }
    SP.needsUpdate = true;
    SA.needsUpdate = true;
    this.relief = relief;
    this.version = relief.version;
  }

  /** Bodenbild (Canvas) als Textur: ohne Farbraum-Umrechnung (wie ground.js), nicht gespiegelt, Mipmaps, anisotrop. */
  setTexture(src) {
    const old = this.uniforms.uTex.value;
    const t = new THREE.CanvasTexture(src);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = this.maxAniso;
    this.uniforms.uTex.value = t;
    old?.dispose();
    this.texSrc = src;
  }

  /** Vor dem Zeichnen: Gelände, Bodenbild, Licht (Weltvektor, z oben), Zeit (s) und Winter (Schnee 0/1) abgleichen. */
  update(relief, tex, light, time, snow) {
    if (relief !== this.relief || relief.version !== this.version) this.uploadRelief(relief);
    if (tex !== this.texSrc) this.setTexture(tex);
    const u = this.uniforms;
    u.uLight.value.set(light[0], light[1], light[2]);
    u.uTime.value = time;
    u.uSnow.value = snow;
  }

  dispose() {
    for (const m of [this.mesh, this.skirt]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    this.uniforms.uTex.value?.dispose();
    this.uniforms.uNoise.value.dispose();
    this.uniforms.uDetail.value.dispose();
  }
}
