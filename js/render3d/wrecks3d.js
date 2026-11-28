// 3D-Fahrzeugwracks (Plan „3D mit three.js“, Paket „Einheiten 3D: Wracks und Instancing“): verkohlte Fahrzeugmodelle als echte
// 3D-Körper (solids3d.js mit charred: true) statt des gemalten Billboards (drawWreckIso). Wanne und Turm als InstancedMesh je
// Fahrzeugart, stufenlose Drehung w.angle, Turm aus w.id deterministisch verdreht und leicht verrutscht bzw. bei einem Anteil
// (BALANCE.wrecks3d.blowShare) abgesprengt neben der Wanne am Boden. Frische Wracks (fade ≥ 0,99) sind undurchsichtig und werfen
// Schatten (Ebene CAST); in den letzten wreckFade Sekunden sinken sie leicht ein (sinkMin … 1) und verblassen stufenlos über ein
// eigenes durchscheinendes InstancedMesh (aFade). Infanterie und unbekannte Arten liefern false (Rückfall auf den bisherigen Maler).
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { makeRng } from '../core/rng.js';
import { unitModel, unitModelTypes } from '../render/unitpaint.js';
import { modelGeometry } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';
import { ISO_SCALE } from './units3d.js';

const TAU = Math.PI * 2;
const INIT_CAP = 32; // Startkapazität je InstancedMesh; wächst bei Bedarf (Verdopplung)
const W = BALANCE.wrecks3d;

const VS_OPAQUE = `
uniform float uS;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 r = mat3(m) * normal;
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vZ = position.z;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;

const VS_FADE = `
uniform float uS;
attribute float aFade;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
varying float vFade;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 r = mat3(m) * normal;
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vZ = position.z;
  vFade = aFade;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;

const FS_OPAQUE = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  float d = max(0.0, dot(normalize(vN), uLight));
  float ao = vZ < 7.0 ? 0.8 + 0.2 * max(0.0, vZ) / 7.0 : 1.0; // bodennahe Flächen etwas dunkler
  float k = (0.56 + 0.44 * d) * ao;
  gl_FragColor = vec4(min(toSrgb(vCol) * k, vec3(1.0)), 1.0);
}`;

const FS_FADE = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
varying float vFade;
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  float d = max(0.0, dot(normalize(vN), uLight));
  float ao = vZ < 7.0 ? 0.8 + 0.2 * max(0.0, vZ) / 7.0 : 1.0;
  float k = (0.56 + 0.44 * d) * ao;
  gl_FragColor = vec4(min(toSrgb(vCol) * k, vec3(1.0)), vFade);
}`;

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();

/** Flache Kopie der Geometrie-Referenzen plus eigenes Instanz-Attribut aFade (keine Kopie der Eckenpuffer). */
function wrapFadeGeo(baseGeo, fadeAttr) {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(baseGeo.attributes)) g.setAttribute(name, attr);
  g.boundingBox = baseGeo.boundingBox;
  g.setAttribute('aFade', fadeAttr);
  return g;
}

/** Alle Einheitentypen mit Fahrzeugwrack-Modell (alle nicht-Infanterie-Modelle aus unitpaint.js). */
export function wreckModelTypes() {
  return unitModelTypes().filter((t) => {
    const m = unitModel(t, 0, { missiles: 0, gear: true });
    return !!(m && !m.inf);
  });
}

/**
 * Deterministische Lage des Wrack-Turms aus w.id (kein Zufall je Bild, nie Math.random):
 * twist (rad), blown (abgesprengt neben der Wanne), dx/dy (Versatz in Modell-px), tiltX/tiltY (Schräglage in rad).
 */
export function wreckPose(w, hasTurret = true) {
  if (!hasTurret) return null;
  const rng = makeRng(((w.id | 0) * 2654435761) >>> 0 || 1);
  const rnd = () => rng.next();
  const twist = rnd() * TAU;
  const blown = rnd() < W.blowShare;
  if (blown) {
    const dir = rnd() * TAU;
    const dist = W.blowDistMin + rnd() * (W.blowDistMax - W.blowDistMin);
    return {
      twist,
      blown: true,
      dx: Math.cos(dir) * dist,
      dy: Math.sin(dir) * dist,
      tiltX: (rnd() * 2 - 1) * W.blowTiltMax,
      tiltY: (rnd() * 2 - 1) * W.blowTiltMax,
    };
  }
  return {
    twist,
    blown: false,
    dx: (rnd() * 2 - 1) * W.shiftMax,
    dy: (rnd() * 2 - 1) * W.shiftMax,
    tiltX: (rnd() * 2 - 1) * W.tiltMax,
    tiltY: (rnd() * 2 - 1) * W.tiltMax,
  };
}

export class Wrecks3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    const uniforms = { uLight: this.uLight, uS: { value: HEIGHT_SCALE } };
    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS_OPAQUE,
      fragmentShader: FS_OPAQUE,
      vertexColors: true,
    });
    this.material.shadowSide = THREE.DoubleSide;
    this.fadeMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS_FADE,
      fragmentShader: FS_FADE,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    this.group = new THREE.Group();
    this.group.name = 'wracks';
    this.sets = new Map(); // Schlüssel ('wh|…', 'wt|…', mit '|f' für verblassend) → { mesh, geo, fadeAttr, n, cap, fading }
    this.count = 0; // Wracks in 3D in diesem Bild
  }

  /** Bildanfang: Sonne (Welt, z oben). */
  begin(light) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    for (const s of this.sets.values()) s.n = 0;
    this.count = 0;
  }

  /** InstancedMesh für Wanne oder Turm einer Fahrzeugart (undurchsichtig oder verblassend) holen oder anlegen. */
  setOf(key, geo, fading) {
    const fullKey = fading ? `${key}|f` : key;
    let s = this.sets.get(fullKey);
    if (s) return s;
    const cap = INIT_CAP;
    const fadeAttr = fading ? new THREE.InstancedBufferAttribute(new Float32Array(cap), 1) : null;
    if (fadeAttr) fadeAttr.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.InstancedMesh(fading ? wrapFadeGeo(geo, fadeAttr) : geo, fading ? this.fadeMaterial : this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    if (!fading) {
      mesh.castShadow = true;
      mesh.layers.enable(CAST);
    }
    this.group.add(mesh);
    s = { mesh, geo, fadeAttr, n: 0, cap, fading };
    this.sets.set(fullKey, s);
    return s;
  }

  /** Kapazität verdoppeln, wenn mehr Wracks einer Art als cap im Bild liegen. */
  grow(s) {
    const cap = s.cap * 2;
    let fadeAttr = null;
    if (s.fading) {
      const arr = new Float32Array(cap);
      arr.set(s.fadeAttr.array);
      fadeAttr = new THREE.InstancedBufferAttribute(arr, 1);
      fadeAttr.setUsage(THREE.DynamicDrawUsage);
    }
    const mesh = new THREE.InstancedMesh(s.fading ? wrapFadeGeo(s.geo, fadeAttr) : s.geo, s.fading ? this.fadeMaterial : this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.array.set(s.mesh.instanceMatrix.array);
    mesh.frustumCulled = false;
    mesh.count = s.n;
    mesh.visible = s.n > 0;
    if (!s.fading) {
      mesh.castShadow = true;
      mesh.layers.enable(CAST);
    }
    this.group.remove(s.mesh);
    if (s.fading) {
      for (const name of Object.keys(s.geo.attributes)) s.mesh.geometry.deleteAttribute(name);
      s.mesh.geometry.dispose();
    }
    s.mesh.dispose();
    this.group.add(mesh);
    s.mesh = mesh;
    s.fadeAttr = fadeAttr;
    s.cap = cap;
  }

  /** Eine Instanzmatrix (und ggf. Deckkraft) in den Satz schreiben. */
  push(s, x, y, z, rx, ry, rz, sx, sy, sz, fade) {
    if (s.n >= s.cap) this.grow(s);
    _pos.set(x, y, z);
    _euler.set(rx, ry, rz, 'ZYX');
    _quat.setFromEuler(_euler);
    _scale.set(sx, sy, sz);
    _mat.compose(_pos, _quat, _scale);
    s.mesh.setMatrixAt(s.n, _mat);
    if (s.fadeAttr) s.fadeAttr.array[s.n] = fade;
    s.n++;
  }

  /**
   * Fahrzeugwrack w in die Szene: Bodenhöhe h (Welt-px), fade 0 … 1 (Verblassen / Einsinken in den letzten wreckFade Sekunden).
   * false = kein Fahrzeugmodell (dann malt der Renderer wie bisher).
   */
  show(w, h, fade = 1) {
    if (fade <= 0) return true;
    const m = unitModel(w.type, 0, { missiles: 0, gear: true });
    if (!m || m.inf) return false;
    const f = Math.min(1, fade);
    const fading = f < 0.99;
    const sink = fading ? W.sinkMin + (1 - W.sinkMin) * f : 1;
    const angle = w.angle ?? 0;
    const hGeo = modelGeometry(`wh|${w.type}`, m.S, { charred: true });
    const hSet = this.setOf(`wh|${w.type}`, hGeo, fading);
    this.push(hSet, w.x, w.y, h, 0, 0, angle, ISO_SCALE, ISO_SCALE, ISO_SCALE * sink, f);
    if (m.turret) {
      const tGeo = modelGeometry(`wt|${w.type}`, m.turret.S, { charred: true });
      const tSet = this.setOf(`wt|${w.type}`, tGeo, fading);
      const pose = wreckPose(w, true);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const lx = m.turret.x + pose.dx;
      const ly = pose.dy;
      const tx = w.x + (lx * ca - ly * sa) * ISO_SCALE;
      const ty = w.y + (lx * sa + ly * ca) * ISO_SCALE;
      const minZ = tGeo.boundingBox ? tGeo.boundingBox.min.z : 0;
      const tz = pose.blown ? h - minZ * ISO_SCALE * sink : h;
      this.push(tSet, tx, ty, tz, pose.tiltX, pose.tiltY, angle + pose.twist, ISO_SCALE, ISO_SCALE, ISO_SCALE * sink, f);
    }
    this.count++;
    return true;
  }

  /** Bildende: Instanzzahlen setzen, leere Sätze verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.n;
      m.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
      if (s.fadeAttr) {
        s.fadeAttr.clearUpdateRanges();
        s.fadeAttr.addUpdateRange(0, s.n);
        s.fadeAttr.needsUpdate = true;
      }
    }
  }

  /** Kennzahlen dieses Bildes: gezeigte Wracks, aktive Sätze (= Draw-Calls ohne Schattenkarte), Dreiecke. */
  stats() {
    let calls = 0;
    let tris = 0;
    let instances = 0;
    for (const s of this.sets.values()) {
      if (!s.n) continue;
      calls++;
      instances += s.n;
      tris += (s.geo.getAttribute('position').count / 3) * s.n;
    }
    return { total: this.count, calls, instances, tris };
  }

  dispose() {
    for (const s of this.sets.values()) {
      if (s.fading) {
        for (const name of Object.keys(s.geo.attributes)) s.mesh.geometry.deleteAttribute(name);
        s.mesh.geometry.dispose();
      }
      s.mesh.dispose();
    }
    this.sets.clear();
    this.material.dispose();
    this.fadeMaterial.dispose();
  }
}
