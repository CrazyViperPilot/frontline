// 3D-Natur ohne Bäume (Plan „3D mit three.js“, Paket „Büsche und Felsen 3D“): Büsche, Felsen und Tiere als InstancedMesh, gewürfelt
// wie die gemalten Bilder (nature.js bushLook3d, rockLook3d, animalLook3d). Je Form ein InstancedMesh, also ein Draw-Call je Form im
// Bild (dazu einer in der Schattenkarte).
// - Büsche (Strauch, Beerenstrauch, Farn, junge Fichte): niedrige Polygone mit dem Baukasten und dem Shader der Bäume (trees3d.js: Geo,
//   TREE_VS/TREE_FS, Palette nach Helligkeit, Blattmuster, Schnee). Je Art BUSH_SHAPES Formen, die Drehung je Busch sorgt für Vielfalt.
//   Herbst: Laubpalette des Herbstes (Farn braun); Winter: Strauch und Beeren kahl (Ruten, Schnee am Fuß, Hagebutten), Farn braun mit
//   Schnee, junge Fichte mit Schneebändern wie die Fichte. Unterholz im Wald (under) wirft keinen Schatten (gemalt auch nicht); unter
//   Zoom 0,6 lässt isoItems es ohnehin weg.
// - Felsen (4 Varianten je Jahreszeit) und Tiere (Hirsch, Wildschwein je Haltung: Gehbild, Galopp, Äsen, also mit Laufbild) aus den
//   Körperlisten von nature.js über den Körper-Wandler (solids3d.js modelGeometry), Licht wie die Einheiten (units3d.js).
// Alles wirft Schatten in die Schattenkarte (Ebene CAST); die gemalten Schatten lässt isoShadows dann weg (natureShadow3d).
import * as THREE from '../vendor/three/three.module.min.js';
import { TREE_COLORS, BUSH_COLORS } from '../render/nature.js';
import { Geo, TREE_VS, TREE_FS, paletteTexture, leafTexture } from './trees3d.js';
import { modelGeometry } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';

const RB = 10; // Bezugsradius der Büsche (wie nature.js)
export const BUSH_SHAPES = 2; // Formen je Buschart in 3D
export const BUSH_KINDS3D = ['shrub', 'berry', 'fern', 'sapling'];
const CAP_BUSH = 2048; // je Form und Bild; darüber malt der Renderer wie bisher
const CAP_ROCK = 1024;
const CAP_ANIMAL = 64;
const TAU = Math.PI * 2;
export const PALETTES = [...TREE_COLORS.palettes, BUSH_COLORS.fern.summer, BUSH_COLORS.fern.autumn, BUSH_COLORS.fern.winter];

/** Fester Zufall (mulberry32), 0 … 1. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// ---------- Bauteile ----------

/** Dreieck aus [Lage, Helligkeit] je Ecke mit Normale n, Umlaufsinn gegen den Uhrzeiger um n (Geo-Regel). */
function triT(G, a, b, c, n, col) {
  const f = cross(sub(b[0], a[0]), sub(c[0], a[0]));
  if (f[0] * n[0] + f[1] * n[1] + f[2] * n[2] < 0) [b, c] = [c, b];
  for (const [p, t] of [a, b, c]) G.vert(p, n, col, t);
}

/** Kleine Kugel (Beere, Schneeflocke, Schneehügel): Ellipsoid um c, Farbe col, ohne Palette (tone −2: kein Schnee, kein Fußschatten). */
function ball(G, c, rx, ry, rz, col, detail = 0) {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const P = ico.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) {
    const n = norm([P[i] / rx, P[i + 1] / ry, P[i + 2] / rz]);
    G.vert([c[0] + P[i] * rx, c[1] + P[i + 1] * ry, c[2] + P[i + 2] * rz], n, col, -2);
  }
  ico.dispose();
}

/** Rute mit Verzweigung (kahler Strauch): Stümpfe aus drei Seiten, Spitzen landen in tips. */
function twig(G, r, a, dir, len, w, depth, col, tips) {
  const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len];
  G.frustum(a, b, w, w * 0.7, 3, col);
  if (depth <= 0) return tips.push(b);
  for (let i = 0; i < 2; i++) {
    const yaw = Math.atan2(dir[1], dir[0]) + (i ? 1 : -1) * (0.35 + r() * 0.4);
    const up = Math.max(0.2, Math.min(0.95, dir[2] + (r() - 0.4) * 0.4));
    const hz = Math.sqrt(1 - up * up);
    twig(G, r, b, [Math.cos(yaw) * hz, Math.sin(yaw) * hz, up], len * (0.64 + r() * 0.14), Math.max(0.22, w * 0.65), depth - 1, col, tips);
  }
}

/**
 * Farnwedel in Richtung a (Länge len): gebogenes Band (Bezier vom Fuß über die Mitte zur Spitze), Mittelrippe als Falz etwas höher,
 * beidseitig. Helligkeit: Rippe heller als der Rand, Spitze heller; Schneegewicht in der Mitte des Wedels (wie das gemalte Schneehäufchen).
 */
function frond(G, a, len, rise) {
  const d = [Math.cos(a), Math.sin(a)];
  const side = [-d[1], d[0], 0];
  const P0 = [0, 0, 0.4];
  const P1 = [d[0] * len * 0.45, d[1] * len * 0.45, len * rise];
  const P2 = [d[0] * len, d[1] * len, len * 0.1];
  const S = 5;
  const rows = [];
  for (let k = 0; k <= S; k++) {
    const t = k / S;
    const u = 1 - t;
    const C = [0, 1, 2].map((i) => u * u * P0[i] + 2 * u * t * P1[i] + t * t * P2[i]);
    const w = len * 0.2 * Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.8) * 1.02));
    const L = [C[0] + side[0] * w, C[1] + side[1] * w, C[2] - w * 0.3];
    const R = [C[0] - side[0] * w, C[1] - side[1] * w, C[2] - w * 0.3];
    rows.push({ C: [C[0], C[1], C[2] + w * 0.12], L, R, t });
  }
  for (let k = 0; k < S; k++) {
    const A = rows[k];
    const B = rows[k + 1];
    const tm = (A.t + B.t) / 2;
    const snow = Math.max(0, 1 - Math.abs(tm - 0.5) * 3);
    for (const [e0, e1, edge] of [[A.L, B.L, 1], [A.R, B.R, -1]]) {
      // Hälfte des Wedels: Rippe (C) und Rand (e); Normale nach oben
      // Normale aus beiden Dreiecken (am Fuß und an der Spitze ist eines entartet), nach oben
      const c1 = cross(sub(B.C, A.C), sub(e1, A.C));
      const c2 = cross(sub(e1, A.C), sub(e0, A.C));
      const sg = (v) => (v[2] < 0 ? -1 : 1);
      let n = [0, 1, 2].map((i) => c1[i] * sg(c1) + c2[i] * sg(c2));
      n = Math.hypot(...n) < 1e-9 ? [0, 0, 1] : norm(n);
      const tr = 0.5 + tm * 0.2; // Rippe
      const te = 0.28 + tm * 0.2 + edge * 0.04; // Rand
      const col = [snow, 0, 0];
      for (const s of [1, -1]) {
        const nn = s > 0 ? n : [-n[0], -n[1], -n[2]];
        const tt = s > 0 ? 1 : 0.55; // Unterseite dunkler
        triT(G, [A.C, tr * tt], [B.C, tr * tt], [e1, te * tt], nn, col);
        triT(G, [A.C, tr * tt], [e1, te * tt], [e0, te * tt], nn, col);
      }
    }
  }
}

// ---------- Arten (Maße wie nature.js, Iso-Bildhöhe = Welthöhe) ----------

const BUILD = {
  /** Strauch: dunkler Kern, ein Kranz Laubbüschel, zwei höhere innen, oben einer; Beerenstrauch dazu rote Beeren außen. */
  shrub(G, r, bare, berries = false) {
    if (bare) return BUILD.twigs(G, r, berries);
    G.blob([0, 0, RB * 0.45], RB * 0.95, RB * 0.95, RB * 0.48, 0, 0.06, 0.12, 1);
    const ks = [];
    const n = 6 + (r() < 0.5 ? 1 : 0);
    const a0 = r() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + (r() - 0.5) * 0.4;
      const d = RB * (0.58 + r() * 0.12);
      ks.push([Math.cos(a) * d, Math.sin(a) * d, RB * (0.42 + r() * 0.16), RB * (0.4 + r() * 0.14)]);
    }
    for (let i = 0; i < 2; i++) {
      const a = r() * TAU;
      const d = RB * 0.25 * r();
      ks.push([Math.cos(a) * d, Math.sin(a) * d, RB * (0.78 + r() * 0.14), RB * (0.4 + r() * 0.1)]);
    }
    ks.forEach(([x, y, z, br], i) => G.blob([x, y, z], br, br, br * 0.8, 0, 0.36 + (z / RB - 0.45) * 0.5, 0.16, i * 7 + 3));
    if (!berries) return;
    const col = hex(BUSH_COLORS.berry.summer);
    for (let i = 0; i < 14; i++) {
      const [x, y, z, br] = ks[(r() * ks.length) | 0];
      const a = r() * TAU;
      const up = 0.1 + r() * 0.7;
      const hz = Math.sqrt(1 - up * up);
      ball(G, [x + Math.cos(a) * hz * br * 0.92, y + Math.sin(a) * hz * br * 0.92, z + up * br * 0.8], 0.75, 0.75, 0.75, col);
    }
  },
  berry(G, r, bare) {
    BUILD.shrub(G, r, bare, true);
  },
  /** Kahler Strauch (Winter): Rutenbündel rundum, Schneehügel am Fuß, Schnee und (Beerenstrauch) Hagebutten an den Spitzen. */
  twigs(G, r, berries) {
    const col = hex(BUSH_COLORS.twig);
    const tips = [];
    const n = 7;
    const a0 = r() * TAU;
    for (let i = 0; i < n; i++) {
      const yaw = a0 + (i / n) * TAU + (r() - 0.5) * 0.5;
      const up = 0.6 + r() * 0.28;
      const hz = Math.sqrt(1 - up * up);
      twig(G, r, [(r() - 0.5) * 2, (r() - 0.5) * 2, -1], [Math.cos(yaw) * hz, Math.sin(yaw) * hz, up], RB * (0.5 + r() * 0.22), 0.42, 2, col, tips);
    }
    const snow = hex(BUSH_COLORS.snow);
    ball(G, [0, 0, -RB * 0.08], RB * 0.85, RB * 0.8, RB * 0.3, snow, 1);
    const berry = hex(BUSH_COLORS.berry.winter);
    for (const t of tips) {
      const u = r();
      if (u < 0.35) ball(G, [t[0], t[1], t[2] + 0.25], 0.8, 0.8, 0.5, snow);
      else if (berries && u < 0.7) ball(G, t, 0.7, 0.7, 0.7, berry);
    }
  },
  /** Farn: neun Wedel rundum, leicht unregelmäßig. */
  fern(G, r) {
    const n = 9;
    const a0 = r() * TAU;
    for (let i = 0; i < n; i++) frond(G, a0 + (i / n) * TAU + (r() - 0.5) * 0.3, RB * (0.85 + r() * 0.4), 0.9 + r() * 0.2);
  },
  /** Junge Fichte: wie die Fichte der Bäume (Stockwerke), Maße wie nature.js spruceIso(…, RB · 2,1, RB · 0,75). */
  sapling(G, r) {
    const H = RB * 2.1 * (1 + r() * 0.14);
    const W = RB * 0.75 * (0.95 + r() * 0.15);
    const base = H * 0.09;
    G.frustum([0, 0, -1], [0, 0, base + RB * 0.3], W * 0.11, W * 0.08, 4, hex(TREE_COLORS.bark.spruce[1]));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const zb = base + (H - base) * t0 * 0.93;
      const th = ((H - base) / n) * 1.9;
      const w = W * Math.pow(1 - t0, 0.92) + W * 0.1;
      G.tier((r() - 0.5) * W * 0.05, (r() - 0.5) * W * 0.05, zb, w, th, 8, r);
    }
  },
};

const geoCache = new Map();

/** Geometrie einer Buschform (Art, Form, kahl im Winter: nur Strauch und Beeren), einmal gebaut. */
export function bushGeometry(kind, shape, bare = false) {
  const kahl = bare && (kind === 'shrub' || kind === 'berry');
  const key = `${kind}|${shape}|${kahl ? 1 : 0}`;
  let g = geoCache.get(key);
  if (!g) {
    const G = new Geo();
    BUILD[kind](G, rng(7001 + BUSH_KINDS3D.indexOf(kind) * 389 + shape * 151), kahl);
    g = G.build();
    geoCache.set(key, g);
  }
  return g;
}

// ---------- Felsen und Tiere: Licht wie units3d.js, mit Instanzen ----------

const SOLID_VS = `
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

const SOLID_FS = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  float d = max(0.0, dot(normalize(vN), uLight));
  float ao = vZ < 4.0 ? 0.82 + 0.18 * max(0.0, vZ) / 4.0 : 1.0; // bodennah etwas dunkler
  gl_FragColor = vec4(min(toSrgb(vCol) * (0.56 + 0.44 * d) * ao, vec3(1.0)), 1.0);
}`;

// ---------- Natur im Bild ----------

export class Nature3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    this.uSnow = { value: 0 };
    this.bushMat = new THREE.ShaderMaterial({
      uniforms: {
        uLight: this.uLight,
        uSnow: this.uSnow,
        uS: { value: HEIGHT_SCALE },
        uPal: { value: paletteTexture(PALETTES) },
        uLeaf: { value: leafTexture() },
        uRows: { value: PALETTES.length },
        uSnowCol: { value: new THREE.Vector3(...hex(TREE_COLORS.snow[0])) },
      },
      vertexShader: TREE_VS,
      fragmentShader: TREE_FS,
      vertexColors: true,
    });
    this.bushMat.shadowSide = THREE.DoubleSide; // Ruten und Wedel sind dünn
    this.solidMat = new THREE.ShaderMaterial({
      uniforms: { uLight: this.uLight, uS: { value: HEIGHT_SCALE } },
      vertexShader: SOLID_VS,
      fragmentShader: SOLID_FS,
      vertexColors: true,
    });
    this.solidMat.shadowSide = THREE.DoubleSide;
    this.group = new THREE.Group();
    this.group.name = 'natur';
    this.sets = new Map(); // Schlüssel → { mesh, pal, n, cap, art }
    this.rows = new Map(PALETTES.map((P, i) => [P, i]));
    this.season = 'summer';
    this.counts = { bush: 0, rock: 0, animal: 0 };
  }

  /** Bildanfang: Sonne (Welt, z oben), Jahreszeit. */
  begin(light, season) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    this.uSnow.value = season === 'winter' ? 1 : 0;
    this.season = season;
    for (const s of this.sets.values()) s.n = 0;
    this.counts = { bush: 0, rock: 0, animal: 0 };
  }

  /** Satz (InstancedMesh) zum Schlüssel, beim ersten Gebrauch aus make() angelegt; pal: Palettenzeile je Instanz (Büsche). */
  setOf(key, art, make, { mat, cap, pal = false, cast = true }) {
    let s = this.sets.get(key);
    if (s) return s;
    let geo = make();
    let palAttr = null;
    if (pal) {
      geo = geo.clone(); // eigene Kopie: aPal hängt am InstancedMesh dieser Form
      palAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aPal', palAttr);
    }
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    if (cast) {
      mesh.castShadow = true;
      mesh.layers.enable(CAST);
    }
    this.group.add(mesh);
    s = { mesh, pal: palAttr, n: 0, cap, art, own: pal };
    this.sets.set(key, s);
    return s;
  }

  /** Instanz an (x, y, h), gedreht um die Hochachse (yaw), Maßstab k. false = Satz voll. */
  put(s, x, y, h, yaw, k, row = 0) {
    if (s.n >= s.cap) return false;
    const m = s.mesh.instanceMatrix.array;
    const o = s.n * 16;
    const c = Math.cos(yaw) * k;
    const sn = Math.sin(yaw) * k;
    m[o] = c;
    m[o + 1] = sn;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = -sn;
    m[o + 5] = c;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = k;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = h;
    m[o + 15] = 1;
    if (s.pal) s.pal.array[s.n] = row;
    s.n++;
    return true;
  }

  /** Busch (Aussehen L aus bushLook3d) am Weltpunkt (x, y) auf Höhe h. Unterholz wirft keinen Schatten. */
  bush(L, x, y, h) {
    const shape = L.shape % BUSH_SHAPES;
    const bare = this.season === 'winter' && (L.kind === 'shrub' || L.kind === 'berry');
    const under = L.under ? 1 : 0;
    const s = this.setOf(`b|${L.kind}|${shape}|${bare ? 1 : 0}|${under}`, L.kind, () => bushGeometry(L.kind, shape, bare), { mat: this.bushMat, cap: CAP_BUSH, pal: true, cast: !under });
    const ok = this.put(s, x, y, h, (((L.h >>> 17) % 360) * Math.PI) / 180, L.size, this.rows.get(L.P) ?? 0);
    if (ok) this.counts.bush++;
    return ok;
  }

  /** Fels (rockLook3d) am Weltpunkt (x, y) auf Höhe h. */
  rock(L, x, y, h) {
    const key = `nr|${L.v}|${this.season}`;
    const s = this.setOf(`r|${L.v}|${this.season}`, 'rock', () => modelGeometry(key, L.S), { mat: this.solidMat, cap: CAP_ROCK });
    const ok = this.put(s, x, y, h, L.yaw, L.size);
    if (ok) this.counts.rock++;
    return ok;
  }

  /** Tier a (animalLook3d) auf Höhe h, Blick nach a.angle. */
  animal(L, a, h) {
    const s = this.setOf(`a|${L.key}`, 'animal', () => modelGeometry(`an|${L.key}`, L.S), { mat: this.solidMat, cap: CAP_ANIMAL });
    const ok = this.put(s, a.x, a.y, h, a.angle ?? 0, L.scale);
    if (ok) this.counts.animal++;
    return ok;
  }

  /** Bildende: Zahl der Instanzen je Satz setzen, leere verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.n;
      m.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
      if (s.pal) {
        s.pal.clearUpdateRanges();
        s.pal.addUpdateRange(0, s.n);
        s.pal.needsUpdate = true;
      }
    }
  }

  /** Sichtbare Sätze (= Draw-Calls ohne Schattenkarte) je Art und Zahl der Büsche, Felsen, Tiere. */
  stats() {
    const out = { ...this.counts, calls: 0, byArt: {}, tris: 0 };
    for (const s of this.sets.values()) {
      if (!s.n) continue;
      out.calls++;
      out.byArt[s.art] = (out.byArt[s.art] ?? 0) + 1;
      out.tris += (s.mesh.geometry.getAttribute('position').count / 3) * s.n;
    }
    return out;
  }

  dispose() {
    for (const s of this.sets.values()) {
      if (s.own) s.mesh.geometry.dispose(); // sonst gehört die Geometrie einem Zwischenspeicher
      s.mesh.dispose();
    }
    this.bushMat.uniforms.uPal.value.dispose();
    this.bushMat.uniforms.uLeaf.value.dispose();
    this.bushMat.dispose();
    this.solidMat.dispose();
  }
}
