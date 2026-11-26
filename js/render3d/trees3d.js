// 3D-Bäume (Plan „3D mit three.js“, Paket „3D-Bäume“): Laubbaum, Birke, Fichte und Kiefer als niedrige Polygone, gewürfelt wie die
// gemalten Bäume (nature.js treeLook3d: Art, Größe, Laubpalette der Jahreszeit). Je Art TREE_SHAPES Formen; jede Form ist eine
// Geometrie und ein InstancedMesh, also höchstens TREE_SHAPES Draw-Calls je Art (dazu die Schattenkarte). Weit herausgezoomt
// (Zoom < LOD_ZOOM) gröbere Formen. In die Schattenkarte zeichnet immer die grobe Form (eigenes InstancedMesh nur auf Ebene CAST mit
// denselben Instanzmatrizen): bei 1 bis 3 Welt-px je Texel sieht man keinen Unterschied, im Software-WebGL halbiert es die Kosten. Winter: Laubbäume kahl (Äste), Schnee auf allem, was nach oben zeigt (im Shader).
//
// Geometrie in Spielachsen (x, y, z = Höhe, Welt-px) unter objRoot, Bezugsgröße wie nature.js (R = 16, Größe 1); je Baum skaliert
// und um die Hochachse gedreht. Je Ecke: Normale, aTone (−1 = Rinde/Ast, −2 = ohne Schnee und Fußschatten, Büsche; sonst Grundhelligkeit des Laubs 0 … 1), Farbe: bei Rinde
// die Rindenfarbe, beim Laub r = Schneegewicht im Winter (Fichte: Band je Stockwerk, Büschel: oben).
// Je Baum (Instanz): Matrix und aPal (Zeile der Palettentextur: TREE_COLORS.palettes, Spalten Tiefe → Licht).
// Licht wie die Einheiten (units3d.js): Sonne = Renderer.lightVec; Laub nimmt die Farbe aus der Palette nach Helligkeit, darüber das
// Blattmuster aus nature.js (Mischmodus „overlay“ wie im gemalten Baum). Farben in sRGB ohne Umrechnung.
import * as THREE from '../vendor/three/three.module.min.js';
import { TREE_COLORS, leafCanvas } from '../render/nature.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';

const R = 16; // Bezugsradius (wie nature.js)
export const TREE_SHAPES = 2; // Formen je Art in 3D (die Drehung je Baum sorgt für weitere Vielfalt)
export const LOD_ZOOM = 0.55; // darunter gröbere Formen (bis ~1500 Bäume im Bild, Messung Seed 7)
export const TREE_SPECIES = ['broad', 'birch', 'spruce', 'pine'];
const CAP = 4096; // Bäume je Form und Bild; darüber malt der Renderer den Baum wie bisher
const TAU = Math.PI * 2;

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

// ---------- Baukasten ----------

/** Sammelt Dreiecke: Lage, Normale, Farbe, aTone. Umlaufsinn gegen den Uhrzeiger nach außen (three spiegelt selbst, camera3d.js). */
export class Geo {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.t = [];
  }

  vert(p, n, col, tone) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(col[0], col[1], col[2]);
    this.t.push(tone);
  }

  /** Stumpf von a nach b (Radien ra, rb, k Seiten), Farbe col; Normalen radial. */
  frustum(a, b, ra, rb, k, col, tone = -1) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...d) || 1;
    d[0] /= l;
    d[1] /= l;
    d[2] /= l;
    // u, v senkrecht zu d mit u × v = d
    const h = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let u = [h[1] * d[2] - h[2] * d[1], h[2] * d[0] - h[0] * d[2], h[0] * d[1] - h[1] * d[0]];
    const ul = Math.hypot(...u);
    u = u.map((x) => x / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const ring = (c, r, i) => {
      const w = (i / k) * TAU;
      const nx = Math.cos(w) * u[0] + Math.sin(w) * v[0];
      const ny = Math.cos(w) * u[1] + Math.sin(w) * v[1];
      const nz = Math.cos(w) * u[2] + Math.sin(w) * v[2];
      return { p: [c[0] + r * nx, c[1] + r * ny, c[2] + r * nz], n: [nx, ny, nz] };
    };
    for (let i = 0; i < k; i++) {
      const a0 = ring(a, ra, i);
      const a1 = ring(a, ra, i + 1);
      const b0 = ring(b, rb, i);
      const b1 = ring(b, rb, i + 1);
      this.vert(a0.p, a0.n, col, tone);
      this.vert(a1.p, a1.n, col, tone);
      this.vert(b1.p, b1.n, col, tone);
      this.vert(a0.p, a0.n, col, tone);
      this.vert(b1.p, b1.n, col, tone);
      this.vert(b0.p, b0.n, col, tone);
    }
  }

  /** Verbeulter Ellipsoid um c (Halbachsen rx, ry, rz) aus einem Ikosaeder (detail), Laub mit Grundhelligkeit tone. */
  blob(c, rx, ry, rz, detail, tone, rough, seed) {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    const P = ico.attributes.position.array;
    const jit = (x, y, z) => {
      // gleiche Richtung → gleicher Versatz (Ecken mehrerer Dreiecke bleiben zusammen)
      const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.618) * 43758.5453;
      return 1 + rough * ((k - Math.floor(k)) * 2 - 1);
    };
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i];
      const y = P[i + 1];
      const z = P[i + 2];
      const j = jit(Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, Math.round(z * 1e4) / 1e4);
      const n = [x / rx, y / ry, z / rz];
      const nl = Math.hypot(...n);
      const snow = Math.max(0, Math.min(1, z * 2.2 - 0.3)); // Schnee oben auf dem Büschel
      this.vert([c[0] + x * rx * j, c[1] + y * ry * j, c[2] + z * rz * j], [n[0] / nl, n[1] / nl, n[2] / nl], [snow, 0, 0], Math.max(0, Math.min(1, tone + z * 0.12)));
    }
    ico.dispose();
  }

  /**
   * Stockwerk einer Fichte: Kegel mit gezackter, hängender Unterkante (k Zacken) und einem Zwischenring (dort liegt im Winter der
   * Schnee, wie das sichtbare Band im gemalten Baum), darunter eine dunkle Scheibe.
   */
  tier(cx, cy, zb, w, th, k, r) {
    const apex = [cx, cy, zb + th];
    const ring = [];
    const mid = [];
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * TAU;
      const rr = w * (i % 2 ? 0.8 : 1);
      ring.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, zb - (i % 2 ? 0 : th * (0.08 + r() * 0.08))]);
      mid.push([cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.5, zb + th * 0.5]);
    }
    ring[k] = ring[0];
    mid[k] = mid[0];
    const s = Math.hypot(w, th);
    const nrm = (i) => [(Math.cos((i / k) * TAU) * th) / s, (Math.sin((i / k) * TAU) * th) / s, w / s];
    const edge = [0, 0, 0];
    const band = [1, 0, 0];
    const top = [0.25, 0, 0];
    for (let i = 0; i < k; i++) {
      const p0 = ring[i];
      const p1 = ring[i + 1];
      const n0 = nrm(i);
      const n1 = nrm(i + 1);
      this.vert(p0, n0, edge, 0.22);
      this.vert(p1, n1, edge, 0.22);
      this.vert(mid[i + 1], n1, band, 0.42);
      this.vert(p0, n0, edge, 0.22);
      this.vert(mid[i + 1], n1, band, 0.42);
      this.vert(mid[i], n0, band, 0.42);
      this.vert(mid[i], n0, band, 0.42);
      this.vert(mid[i + 1], n1, band, 0.42);
      this.vert(apex, [0, 0, 1], top, 0.62);
      // Unterseite (Schatten unter dem Stockwerk)
      this.vert([cx, cy, zb + th * 0.1], [0, 0, -1], [0, 0, 0], 0.02);
      this.vert(p1, [0, 0, -1], [0, 0, 0], 0.02);
      this.vert(p0, [0, 0, -1], [0, 0, 0], 0.02);
    }
  }

  /** Ast mit Verzweigung (kahle Winterkrone): Stümpfe, je Stufe zwei Zweige. */
  limb(r, a, dir, len, w, depth, col) {
    const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len];
    this.frustum(a, b, w, w * 0.7, 3, col);
    if (depth <= 0) return;
    for (let i = 0; i < 2; i++) {
      const yaw = Math.atan2(dir[1], dir[0]) + (i ? 1 : -1) * (0.35 + r() * 0.45);
      const up = Math.max(0.15, dir[2] + (r() - 0.35) * 0.5);
      const hz = Math.sqrt(Math.max(0, 1 - up * up));
      this.limb(r, b, [Math.cos(yaw) * hz, Math.sin(yaw) * hz, up], len * (0.62 + r() * 0.12), Math.max(0.35, w * 0.62), depth - 1, col);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(this.t, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Arten (Maße wie nature.js, Iso-Bildhöhe = Welthöhe) ----------

/** Kahle Krone (Winter) auf dem Stamm bis z0: Hauptäste rundum, je zwei Zweige pro Stufe. */
function bareCrown(G, r, top, n, len, w, depth, col) {
  const a0 = r() * TAU;
  for (let i = 0; i < n; i++) {
    const yaw = a0 + (i / n) * TAU + (r() - 0.5) * 0.5;
    const up = 0.45 + r() * 0.35;
    const hz = Math.sqrt(1 - up * up);
    G.limb(r, [top[0], top[1], top[2] - r() * 4], [Math.cos(yaw) * hz, Math.sin(yaw) * hz, up], len * (0.8 + r() * 0.3), w, depth, col);
  }
}

/** Laubkrone aus Büscheln: Kranz außen, einige innen und oben, dazu ein dunkler Kern. */
function leafCrown(G, r, c, rx, rz, n, size, lod, sq = 1) {
  G.blob(c, rx * 0.86, rx * 0.86, rz * 0.82, 0, 0.06, 0.12, 1); // Kern (Tiefe zwischen den Büscheln)
  const a0 = r() * TAU;
  const inner = lod ? 1 : Math.round(n * 0.5);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + (r() - 0.5) * 0.4;
    const d = 0.56 + r() * 0.16;
    const br = (0.4 + r() * 0.15) * Math.min(rx, rz) * size * (lod ? 1.25 : 1);
    const z = c[2] + (r() - 0.5) * rz * 0.7;
    G.blob([c[0] + Math.cos(a) * rx * d, c[1] + Math.sin(a) * rx * d, z], br, br, br * 0.85 * sq, 0, 0.3 + ((z - c[2]) / rz) * 0.2, lod ? 0.2 : 0.14, i * 7 + 3);
  }
  for (let i = 0; i < inner; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.35;
    const br = (0.42 + r() * 0.14) * Math.min(rx, rz) * size * (lod ? 1.3 : 1);
    G.blob([c[0] + Math.cos(a) * rx * d, c[1] + Math.sin(a) * rx * d, c[2] + rz * (0.35 + r() * 0.25)], br, br, br * 0.85 * sq, 0, 0.5, 0.22, i * 11 + 5);
  }
}

const BUILD = {
  broad(G, r, bare, lod) {
    const bark = hex(TREE_COLORS.bark.broad[1]);
    const th = R * (1.22 + r() * 0.25);
    const lean = [(r() - 0.5) * 3, (r() - 0.5) * 3];
    const rx = R * (1.2 + r() * 0.18) * 0.95;
    const rz = R * (1.02 + r() * 0.14) * 0.8;
    const cz = th + rz * 0.95;
    const top = [lean[0] * 0.8, lean[1] * 0.8, th + rz * 0.5];
    G.frustum([0, 0, -2], top, R * 0.15, R * 0.08, lod ? 4 : 6, bark);
    if (bare) return bareCrown(G, r, top, lod ? 4 : 5, R * 0.75, R * 0.07, lod ? 1 : 2, hex(TREE_COLORS.twig));
    if (!lod) for (const s of [-1, 1]) G.frustum([lean[0] * 0.6, lean[1] * 0.6, th * 0.9], [lean[0] + s * rx * 0.45, lean[1] - s * rx * 0.2, cz - rz * 0.25], R * 0.07, R * 0.04, 3, hex(TREE_COLORS.bark.broad[2]));
    leafCrown(G, r, [lean[0], lean[1], cz], rx, rz, lod ? 5 : 11, 0.95, lod);
  },
  birch(G, r, bare, lod) {
    const B = TREE_COLORS.bark.birch;
    const th = R * (1.5 + r() * 0.3);
    const lean = [(r() - 0.5) * 4, (r() - 0.5) * 4];
    const topZ = th + R * 1.3;
    // weißer Stamm mit dunklen Flecken: Abschnitte abwechselnd hell und dunkel
    const n = lod ? 2 : 7;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const col = !lod && i % 2 && r() < 0.8 ? hex('#3a3431') : hex(B[i % 3 === 2 ? 1 : 0]);
      G.frustum([lean[0] * t0, lean[1] * t0, topZ * t0 - (i ? 0 : 2)], [lean[0] * t1, lean[1] * t1, topZ * t1 * (col[0] < 0.5 ? 0.985 : 1)], R * (0.085 - 0.045 * t0), R * (0.085 - 0.045 * t1), lod ? 4 : 5, col);
    }
    const rx = R * (0.86 + r() * 0.12);
    const rz = R * (1.12 + r() * 0.15) * 0.85;
    if (bare) return bareCrown(G, r, [lean[0] * 0.85, lean[1] * 0.85, th + R * 0.15], lod ? 4 : 6, R * 0.7, R * 0.05, lod ? 1 : 2, hex('#5d4c45'));
    leafCrown(G, r, [lean[0] * 0.9, lean[1] * 0.9, th + rz * 0.65], rx, rz, lod ? 5 : 11, 0.8, lod, 1.3);
  },
  spruce(G, r, bare, lod) {
    const H = R * 3.9 * (1 + r() * 0.14);
    const W = R * (0.95 + r() * 0.15);
    const base = H * 0.09;
    G.frustum([0, 0, -2], [0, 0, base + R * 0.3], W * 0.11, W * 0.08, 4, hex(TREE_COLORS.bark.spruce[1]));
    const n = lod ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const zb = base + (H - base) * t0 * 0.93;
      const th = ((H - base) / n) * 1.9;
      const w = W * Math.pow(1 - t0, 0.92) + W * 0.1;
      G.tier((r() - 0.5) * W * 0.05, (r() - 0.5) * W * 0.05, zb, w, th, lod ? 6 : 10, r);
    }
  },
  pine(G, r, bare, lod) {
    const th = R * (2.25 + r() * 0.4);
    const lean = [(r() - 0.5) * 5, (r() - 0.5) * 5];
    const top = [lean[0], lean[1], th + R * 0.6];
    const low = [lean[0] * 0.35, lean[1] * 0.35, th * 0.35];
    G.frustum([0, 0, -2], low, R * 0.125, R * 0.1, lod ? 4 : 5, hex('#5e4c40'));
    G.frustum(low, top, R * 0.1, R * 0.065, lod ? 4 : 5, hex(TREE_COLORS.bark.pine[1]));
    const n = 3 + (r() < 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU;
      const off = R * (0.2 + r() * 0.35) * (i ? 1 : 0.4);
      const rx = R * (0.66 + r() * 0.28) * (1 - i * 0.13);
      const rz = R * (0.38 + r() * 0.1) * 0.85;
      const c = [lean[0] + Math.cos(a) * off, lean[1] + Math.sin(a) * off, th + R * (0.05 + i * 0.36)];
      if (!lod && i) G.frustum([lean[0] * 0.95, lean[1] * 0.95, th], c, R * 0.05, R * 0.03, 3, hex(TREE_COLORS.bark.pine[1]));
      G.blob(c, rx, rx, rz, 0, 0.36 + i * 0.06, 0.3, i * 13 + 2);
      if (!lod) G.blob([c[0], c[1], c[2] + rz * 0.35], rx * 0.7, rx * 0.7, rz * 0.7, 0, 0.55, 0.25, i * 17 + 9);
    }
  },
};

const geoCache = new Map();

/** Geometrie einer Form (je Art, Form, kahl, grob einmal gebaut). bare nur für Laubbäume (Winter). */
export function treeGeometry(sp, shape, bare = false, lod = false) {
  const key = `${sp}|${shape}|${bare ? 1 : 0}|${lod ? 1 : 0}`;
  let g = geoCache.get(key);
  if (!g) {
    const G = new Geo();
    BUILD[sp](G, rng(4099 + TREE_SPECIES.indexOf(sp) * 977 + shape * 131), bare, lod);
    g = G.build();
    geoCache.set(key, g);
  }
  return g;
}

// ---------- Shader ----------

export const TREE_VS = `
uniform float uS;
attribute float aTone;
attribute float aPal;
varying vec3 vN;
varying vec3 vCol;
varying vec3 vObj;
varying float vTone;
varying float vPal;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 r = mat3(m) * normal; // three-Raum → zurück in Spielachsen (wie units3d.js)
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vObj = position;
  vTone = aTone;
  vPal = aPal;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;

export const TREE_FS = `
uniform vec3 uLight;
uniform sampler2D uPal;
uniform sampler2D uLeaf;
uniform float uRows;
uniform float uSnow;
uniform vec3 uSnowCol;
varying vec3 vN;
varying vec3 vCol;
varying vec3 vObj;
varying float vTone;
varying float vPal;
void main() {
  vec3 n = normalize(vN);
  float d = dot(n, uLight);
  float pat = texture2D(uLeaf, vec2(vObj.x + vObj.z * 0.6, vObj.y - vObj.z * 0.6) / 40.0).r; // Blattmuster, 0,46 = neutral
  vec3 c;
  if (vTone < -0.5) {
    c = vCol * (0.56 + 0.44 * max(d, 0.0)) * (vObj.z < 4.0 && vTone > -1.5 ? 0.8 : 1.0); // Rinde wie die Einheiten, am Fuß dunkler
  } else {
    float t = clamp(vTone + 0.34 * d + 0.02, 0.0, 1.0);
    c = texture2D(uPal, vec2((0.5 + t * 3.0) / 4.0, (vPal + 0.5) / uRows)).rgb;
    vec3 o = mix(2.0 * c * pat, 1.0 - 2.0 * (1.0 - c) * (1.0 - pat), step(0.5, c)); // overlay
    c = mix(c, o, 0.75);
  }
  // Schnee: Äste und Stämme auf der Oberseite, Laub nach dem Schneegewicht der Ecke (vCol.r), unregelmäßig nach dem Muster
  float snow = vTone < -1.5 ? 0.0 : uSnow * (vTone < -0.5 ? smoothstep(0.5, 0.85, n.z) : smoothstep(0.3, 0.7, vCol.r * (0.55 + 0.9 * pat)));
  c = mix(c, uSnowCol * (0.82 + 0.18 * max(d, 0.0)), snow * 0.9);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Palettentextur: je Zeile eine Laubpalette, Spalten Tiefe, Schatten, Mitte, Licht (lineare Mischung = nature.js tone). */
export function paletteTexture(pals = TREE_COLORS.palettes) {
  const data = new Uint8Array(pals.length * 4 * 4);
  pals.forEach((P, row) => {
    [P[3], P[2], P[1], P[0]].forEach((h, i) => {
      const k = (row * 4 + i) * 4;
      data[k] = parseInt(h.slice(1, 3), 16);
      data[k + 1] = parseInt(h.slice(3, 5), 16);
      data[k + 2] = parseInt(h.slice(5, 7), 16);
      data[k + 3] = 255;
    });
  });
  const t = new THREE.DataTexture(data, 4, pals.length, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function leafTexture() {
  const src = leafCanvas();
  if (!src) {
    const t = new THREE.DataTexture(new Uint8Array([118, 118, 118, 255]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const t = new THREE.CanvasTexture(src);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- Bäume im Bild ----------

export class Trees3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    this.uSnow = { value: 0 };
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uLight: this.uLight,
        uSnow: this.uSnow,
        uS: { value: HEIGHT_SCALE },
        uPal: { value: paletteTexture() },
        uLeaf: { value: leafTexture() },
        uRows: { value: TREE_COLORS.palettes.length },
        uSnowCol: { value: new THREE.Vector3(...hex(TREE_COLORS.snow[0])) },
      },
      vertexShader: TREE_VS,
      fragmentShader: TREE_FS,
      vertexColors: true,
    });
    this.material.shadowSide = THREE.DoubleSide; // dünne Äste und offene Stümpfe werfen auch Schatten
    this.group = new THREE.Group();
    this.group.name = 'baeume';
    this.sets = new Map(); // Schlüssel der Form → { mesh, pal, n }
    this.rows = new Map(TREE_COLORS.palettes.map((P, i) => [P, i]));
    this.count = 0;
    this.season = 'summer';
    this.lod = false;
  }

  /** Bildanfang: Sonne (Welt, z oben), Jahreszeit, Zoom (gröbere Formen darunter). */
  begin(light, season, zoom) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    this.uSnow.value = season === 'winter' ? 1 : 0;
    this.season = season;
    this.lod = zoom < LOD_ZOOM;
    for (const s of this.sets.values()) s.n = 0;
    this.count = 0;
  }

  /** Satz (InstancedMesh) einer Form, beim ersten Gebrauch angelegt. */
  setOf(sp, shape, bare, lod) {
    const key = `${sp}|${shape}|${bare ? 1 : 0}|${lod ? 1 : 0}`;
    let s = this.sets.get(key);
    if (!s) {
      const geo = treeGeometry(sp, shape, bare, lod).clone(); // eigene Kopie: aPal hängt am InstancedMesh dieser Form
      const pal = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aPal', pal);
      const mesh = new THREE.InstancedMesh(geo, this.material, CAP);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      this.group.add(mesh);
      // Werfer: grobe Form, nur Ebene CAST (die Bildkamera sieht ihn nie), Matrizen geteilt (ein Puffer, einmal hochgeladen)
      let caster = mesh;
      if (!lod) {
        caster = new THREE.InstancedMesh(treeGeometry(sp, shape, bare, true), this.material, CAP);
        caster.instanceMatrix = mesh.instanceMatrix;
        caster.frustumCulled = false;
        caster.layers.set(CAST);
        caster.count = 0;
        caster.visible = false;
        this.group.add(caster);
      } else mesh.layers.enable(CAST);
      caster.castShadow = true;
      s = { mesh, caster, pal, n: 0 };
      this.sets.set(key, s);
    }
    return s;
  }

  /** Baum (Aussehen L aus treeLook3d) am Weltpunkt (x, y) auf Höhe h. false = Satz voll (dann malt der Renderer). */
  add(L, x, y, h) {
    const bare = this.season === 'winter' && (L.sp === 'broad' || L.sp === 'birch');
    const s = this.setOf(L.sp, L.shape % TREE_SHAPES, bare, this.lod);
    if (s.n >= CAP) return false;
    const a = (((L.h >>> 17) % 360) * Math.PI) / 180;
    const k = L.size;
    const m = s.mesh.instanceMatrix.array;
    const o = s.n * 16;
    const c = Math.cos(a) * k;
    const sn = Math.sin(a) * k;
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
    s.pal.array[s.n] = this.rows.get(L.P) ?? 0;
    s.n++;
    this.count++;
    return true;
  }

  /** Bildende: Zahl der Bäume je Form setzen, leere Formen verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.caster.count = s.n;
      m.visible = s.caster.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
      s.pal.clearUpdateRanges();
      s.pal.addUpdateRange(0, s.n);
      s.pal.needsUpdate = true;
    }
  }

  /** Sichtbare Formen (= Draw-Calls ohne Schattenkarte) und Bäume, je Art. */
  stats() {
    const out = { trees: this.count, calls: 0, bySpecies: {} };
    for (const [key, s] of this.sets) {
      if (!s.n) continue;
      const sp = key.split('|')[0];
      out.calls++;
      out.bySpecies[sp] = (out.bySpecies[sp] ?? 0) + 1;
    }
    return out;
  }

  dispose() {
    for (const s of this.sets.values()) {
      s.mesh.geometry.dispose();
      s.mesh.dispose();
      if (s.caster !== s.mesh) s.caster.dispose(); // Geometrie gehört dem Zwischenspeicher (treeGeometry)
    }
    this.material.uniforms.uPal.value.dispose();
    this.material.uniforms.uLeaf.value.dispose();
    this.material.dispose();
  }
}
