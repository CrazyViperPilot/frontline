// 3D-Einheiten (Plan „3D mit three.js“, Pakete „3D-Einheiten“ und „Einheiten 3D: Wracks und Instancing“): Fahrzeuge, Soldaten und
// Luftfahrzeuge als InstancedMesh je Modellteil (Wanne, Turm, Soldat je Pose) über alle Teams gemeinsam. Geometrie aus denselben
// Körperlisten wie die gemalten Bilder (unitpaint.js unitModel, Umsetzung solids3d.js modelTeamGeometry). Teamfarbe je Instanz über
// aTeam (Index in uPal, alle 7 Rollen der Lackierung inklusive gemischter Tarnfarben); Lackfoto (armor/paint aus materials.js) wie im
// Baukasten (kit3d.js) per overlay, wenn geladen. Drehung stufenlos (u.angle, Turm folgt aim); Rotoren und Nachbrenner malt weiter
// unitpaint.js (drawUnitIso mit body = false). Licht wie painter.js: 0,56 + 0,44 · max(0, n · L), am Boden etwas dunkler. Fahrzeuge
// und Luftfahrzeuge werfen Schatten (Ebene CAST); Soldaten behalten den gemalten Fußschatten (show liefert 'painted').
import * as THREE from '../vendor/three/three.module.min.js';
import { unitModel, unitLook, paintOf, SHOWROOM } from '../render/unitpaint.js';
import { rgbOf } from '../render/color.js';
import { MATS } from '../render/materials.js';
import { modelTeamGeometry, UNIT_MATS, UNIT_ROLES } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';

export const ISO_SCALE = 1.35; // wie unitpaint.js: Modelle in Iso etwas größer als ihre Grundfläche
const INIT_CAP = 64; // Startkapazität je InstancedMesh; wächst bei Bedarf (Verdopplung)
const TEX_SIZE = 256; // Kantenlänge der Lackfotos (armor, paint)

const TEAM_SLOTS = [0, 1, 2, 3, -1, SHOWROOM]; // 0..3 Teams, 4 neutral, 5 Ausstellungsstück
const PAL_RGB = TEAM_SLOTS.map((t) => UNIT_ROLES.map((r) => rgbOf(paintOf(t)[r])));
const PAL_VEC = PAL_RGB.flat().map(([r, g, b]) => new THREE.Vector3(r / 255, g / 255, b / 255));

/** Teamindex für aTeam (0..3 Team, 4 neutral, 5 Ausstellungsstück). */
export const teamSlotOf = (team) => (team === SHOWROOM ? 5 : team >= 0 && team <= 3 ? team | 0 : 4);

const VS = `
uniform float uS;
uniform vec3 uPal[${PAL_VEC.length}];
attribute float aTeam;
attribute vec2 aPaint;
attribute vec2 aUv;
attribute float aMat;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
varying vec2 vUv;
varying float vMat;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  // Normale: Modell → three mit modelMatrix·instanceMatrix (Wurzel X = x, Y = S·z, Z = y), zurück in Spielachsen (x, y, z)
  vec3 r = mat3(m) * normal;
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  int idx = int(aTeam + 0.5) * ${UNIT_ROLES.length} + int(aPaint.x + 0.5);
  vCol = mix(uPal[idx], color, aPaint.y);
  vZ = position.z;
  vUv = aUv;
  vMat = aMat;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;

const FS = `
uniform vec3 uLight;
uniform float uAlpha;
uniform float uTexOn;
uniform sampler2D uArmor;
uniform sampler2D uPaint;
uniform vec2 uTile;
uniform vec2 uMatAlpha;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
varying vec2 vUv;
varying float vMat;
void main() {
  vec3 col = vCol;
  if (uTexOn > 0.5 && vMat > 0.5) {
    bool isPaint = vMat > 1.5;
    float tile = isPaint ? uTile.y : uTile.x;
    float a = isPaint ? uMatAlpha.y : uMatAlpha.x;
    float t = isPaint ? texture2D(uPaint, vUv / tile).r : texture2D(uArmor, vUv / tile).r;
    vec3 ov = mix(2.0 * col * t, 1.0 - 2.0 * (1.0 - col) * (1.0 - t), step(0.5, col));
    col = mix(col, ov, a);
  }
  float d = max(0.0, dot(normalize(vN), uLight));
  float ao = vZ < 7.0 ? 0.8 + 0.2 * max(0.0, vZ) / 7.0 : 1.0; // bodennahe Flächen etwas dunkler
  float k = (0.56 + 0.44 * d) * ao;
  gl_FragColor = vec4(min(col * k, vec3(1.0)), uAlpha);
}`;

// ---------- Lackfotos (armor, paint; wie kit3d.js, einmal je Browser-Lauf) ----------

let unitTex = null; // { armor, paint }
let unitTexReady = false;
const unitMats = new Set();

function blankTex() {
  const t = new THREE.DataTexture(new Uint8Array([128]), 1, 1, THREE.RedFormat);
  t.needsUpdate = true;
  return t;
}

function loadUnitTextures() {
  if (unitTex) return unitTex;
  unitTex = { armor: blankTex(), paint: blankTex() };
  if (typeof Image === 'undefined' || typeof document === 'undefined') return unitTex;
  const load = (url) =>
    new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = url.href;
    });
  Promise.all(UNIT_MATS.map((name) => load(MATS[name].url))).then((ims) => {
    if (ims.some((im) => !im)) return;
    const cv = document.createElement('canvas');
    cv.width = cv.height = TEX_SIZE;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const make = (im) => {
      ctx.drawImage(im, 0, 0, TEX_SIZE, TEX_SIZE);
      const px = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
      const data = new Uint8Array(TEX_SIZE * TEX_SIZE);
      for (let i = 0; i < data.length; i++) data[i] = px[i * 4];
      const t = new THREE.DataTexture(data, TEX_SIZE, TEX_SIZE, THREE.RedFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.colorSpace = THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const next = { armor: make(ims[0]), paint: make(ims[1]) };
    unitTex.armor.dispose();
    unitTex.paint.dispose();
    unitTex = next;
    unitTexReady = true;
    for (const m of unitMats) {
      m.uniforms.uArmor.value = next.armor;
      m.uniforms.uPaint.value = next.paint;
      m.uniforms.uTexOn.value = 1;
    }
  });
  return unitTex;
}

/** Sind die Lackfotos der Einheiten (armor, paint) geladen? */
export const unitTexturesReady = () => unitTexReady;

/** Schlüssel eines Modells ohne Team (alle Teams teilen sich Geometrie und InstancedMesh). */
const baseKeyOf = (type, look) => `${type}|${look.frame ?? ''}|${look.missiles ?? ''}|${look.gear ? 1 : 0}|${look.camo ?? ''}${look.prone ? 'p' : ''}`;

/** Flache Kopie der Geometrie-Referenzen plus eigenes Instanz-Attribut aTeam (keine Kopie der Eckenpuffer). */
function wrapGeo(baseGeo, teamAttr) {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(baseGeo.attributes)) g.setAttribute(name, attr);
  g.boundingBox = baseGeo.boundingBox;
  g.setAttribute('aTeam', teamAttr);
  return g;
}

/** Schreibt Drehung um z (yaw), einheitlichen Maßstab k und Lage (x, y, z) in die Instanzmatrix-Liste. */
function writeMatrix(arr, index, x, y, z, yaw, k) {
  const o = index * 16;
  const c = Math.cos(yaw) * k;
  const s = Math.sin(yaw) * k;
  arr[o] = c;
  arr[o + 1] = s;
  arr[o + 2] = 0;
  arr[o + 3] = 0;
  arr[o + 4] = -s;
  arr[o + 5] = c;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = 0;
  arr[o + 9] = 0;
  arr[o + 10] = k;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

export class Units3D {
  constructor() {
    const tex = loadUnitTextures();
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uLight: this.uLight,
        uS: { value: HEIGHT_SCALE },
        uAlpha: { value: 1 },
        uPal: { value: PAL_VEC },
        uTexOn: { value: unitTexReady ? 1 : 0 },
        uArmor: { value: tex.armor },
        uPaint: { value: tex.paint },
        uTile: { value: new THREE.Vector2(MATS.armor.tile, MATS.paint.tile) },
        uMatAlpha: { value: new THREE.Vector2(MATS.armor.alpha, MATS.paint.alpha) },
      },
      vertexShader: VS,
      fragmentShader: FS,
      vertexColors: true,
    });
    this.material.shadowSide = THREE.DoubleSide; // auch dünne, einseitige Teile (Bleche, Flügel) werfen Schatten
    unitMats.add(this.material);
    this.group = new THREE.Group();
    this.group.name = 'einheiten';
    this.sets = new Map(); // Schlüssel ('h|…' oder 't|…') → { mesh, baseGeo, teamAttr, n, cap, shadow }
    this.count = 0; // Einheiten in 3D in diesem Bild
  }

  /** Bildanfang: Lichtrichtung (Welt, z oben, zur Sonne: Renderer.lightVec). */
  begin(light) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    for (const s of this.sets.values()) s.n = 0;
    this.count = 0;
  }

  /** InstancedMesh für einen Modellteil (Wanne oder Turm) holen oder anlegen. */
  setOf(key, baseGeo, shadow) {
    let s = this.sets.get(key);
    if (s) return s;
    const cap = INIT_CAP;
    const teamAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    teamAttr.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.InstancedMesh(wrapGeo(baseGeo, teamAttr), this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = shadow;
    if (shadow) mesh.layers.enable(CAST);
    this.group.add(mesh);
    s = { mesh, baseGeo, teamAttr, n: 0, cap, shadow };
    this.sets.set(key, s);
    return s;
  }

  /** Kapazität eines Satzes verdoppeln, wenn mehr Instanzen als cap im Bild stehen. */
  grow(s) {
    const cap = s.cap * 2;
    const teamArr = new Float32Array(cap);
    teamArr.set(s.teamAttr.array);
    const teamAttr = new THREE.InstancedBufferAttribute(teamArr, 1);
    teamAttr.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.InstancedMesh(wrapGeo(s.baseGeo, teamAttr), this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.array.set(s.mesh.instanceMatrix.array);
    mesh.frustumCulled = false;
    mesh.count = s.n;
    mesh.visible = s.n > 0;
    mesh.castShadow = s.shadow;
    if (s.shadow) mesh.layers.enable(CAST);
    this.group.remove(s.mesh);
    for (const name of Object.keys(s.baseGeo.attributes)) s.mesh.geometry.deleteAttribute(name);
    s.mesh.geometry.dispose();
    s.mesh.dispose();
    this.group.add(mesh);
    s.mesh = mesh;
    s.teamAttr = teamAttr;
    s.cap = cap;
  }

  /** Eine Instanz in den Satz schreiben. */
  push(s, x, y, z, yaw, teamSlot) {
    if (s.n >= s.cap) this.grow(s);
    writeMatrix(s.mesh.instanceMatrix.array, s.n, x, y, z, yaw, ISO_SCALE);
    s.teamAttr.array[s.n] = teamSlot;
    s.n++;
  }

  /** Gemeinsame Team-Geometrie für Wanne oder Turm (alle 4 Teams einmal zerlegt, gecacht). */
  geoOf(partKey, type, look, turret) {
    const solidsByTeam = [0, 1, 2, 3].map((tm) => {
      const m = unitModel(type, tm, look);
      return turret ? m.turret.S : m.S;
    });
    return modelTeamGeometry(partKey, solidsByTeam, PAL_RGB);
  }

  /**
   * Einheit u in die Szene: Bodenhöhe h (Welt-px), lift über dem Boden, aim = Weltwinkel zum Ziel oder null, now (ms) für die Haltung.
   * false = kein Modell (dann malt der Renderer wie bisher), 'painted' = Mesh ohne eigenen Schatten (Soldaten), sonst true.
   */
  show(u, h, lift, aim, now) {
    const look = unitLook(u, now);
    const m = unitModel(u.type, 0, look);
    if (!m) return false;
    const base = baseKeyOf(u.type, look);
    const shadow = !m.inf;
    const slot = teamSlotOf(u.team);
    // Soldaten blicken zum Ziel, Fahrzeuge in Fahrtrichtung (wie drawUnitIso)
    const face = m.inf && aim !== null && aim !== undefined ? aim : u.angle ?? 0;
    const z = h + lift;
    const hKey = `h|${base}`;
    const hSet = this.setOf(hKey, this.geoOf(hKey, u.type, look, false), shadow);
    this.push(hSet, u.x, u.y, z, face, slot);
    if (m.turret) {
      const tKey = `t|${base}`;
      const tSet = this.setOf(tKey, this.geoOf(tKey, u.type, look, true), shadow);
      const tx = u.x + Math.cos(face) * m.turret.x * ISO_SCALE;
      const ty = u.y + Math.sin(face) * m.turret.x * ISO_SCALE;
      this.push(tSet, tx, ty, z, aim ?? face, slot);
    }
    this.count++;
    return m.inf ? 'painted' : true;
  }

  /** Bildende: Instanzzahlen setzen, geänderte Bereiche hochladen, leere Sätze verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.n;
      m.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
      s.teamAttr.clearUpdateRanges();
      s.teamAttr.addUpdateRange(0, s.n);
      s.teamAttr.needsUpdate = true;
    }
  }

  /** Kennzahlen dieses Bildes: gezeigte Einheiten, aktive InstancedMesh-Sätze (= Draw-Calls ohne Schattenkarte), Dreiecke. */
  stats() {
    let calls = 0;
    let tris = 0;
    let instances = 0;
    for (const s of this.sets.values()) {
      if (!s.n) continue;
      calls++;
      instances += s.n;
      tris += (s.baseGeo.getAttribute('position').count / 3) * s.n;
    }
    return { total: this.count, calls, instances, tris };
  }

  dispose() {
    unitMats.delete(this.material);
    for (const s of this.sets.values()) {
      for (const name of Object.keys(s.baseGeo.attributes)) s.mesh.geometry.deleteAttribute(name);
      s.mesh.geometry.dispose();
      s.mesh.dispose();
    }
    this.sets.clear();
    this.material.dispose();
  }
}
