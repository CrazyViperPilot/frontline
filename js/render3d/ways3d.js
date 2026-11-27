// 3D-Bodenschicht (Plan „3D mit three.js“, Paket „Straßen und Wege 3D“): Stadtstraßen und Gleise der Stadt (render/citylayer.js), Feldwege,
// Gleise und Felder der Karte (render/ways.js, fields.js) und Pflaster (render/paving.js) liegen als Kacheltexturen auf dem Höhennetz
// des 3D-Bodens (ground3d.js); die Schienen sind Körper. Begründung und Maße: docs/plan-3d.md „Straßen und Wege 3D“.
//
// Kacheln: Die Karte ist in Quadrate zu TILE Weltpixeln geteilt. Jede Kachel mit Inhalt malt die heutigen Maler (drawWays, drawCityStreets,
// drawPaving) von oben (flach, Weltkoordinaten) in eine Leinwand mit d Texeln je Weltpixel (PAD Randtexel, damit Nähte zwischen den Kacheln
// fehlen) und zeigt sie auf einem Netz, das die Ecken des Bodens teilt (Lage und Höhen: dieselben Attribute wie das Bodennetz, nur eigene Dreiecksliste je
// Kachel): der Boden und die Schicht haben dieselben Dreiecke, also keinen Versatz am Hang, und Hügel verdecken sie richtig (Tiefentest).
// Gemalt wird nur bei Änderung (Stand je Kachel: Stufe d, Jahreszeit, Stand der Muster und Wege, Straßenzellen im Umkreis), nie jedes Bild,
// höchstens `budgetMs` je Bild; bis dahin zeigt die Kachel ihr altes Bild. Die Schicht liegt nach dem Wasser (Straßen führen durch Furten).
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { RELIEF, FINE_N } from '../game/relief.js';
import { drawPaving } from '../render/paving.js';
import { drawWays, waysStamp, RAIL } from '../render/ways.js';
import { drawCityStreets, cityStreetStamp, mapStreetCells, cityRailPieces } from '../render/citylayer.js';
import { railList } from '../render/terrain.js';
import { fieldFences, FENCE } from '../render/fields.js';

export const TILE = 512; // Weltpixel je Kachel (Vielfaches des Netzes RELIEF.step)
export const PAD = 8; // Randtexel je Seite (Nähte, Filter)
export const LODS = [0.5, 1, 2]; // Texel je Weltpixel (Stufe d), nach der Bildschirmdichte gewählt
const MARGIN = 160; // Rand um das Bild, in dem Kacheln schon gemalt werden (Schwenken)
const STEP = RELIEF.step;
const PER = TILE / STEP; // Netzzellen je Kachel und Seite
const NT = Math.ceil(BALANCE.map.width / TILE); // Kacheln je Seite
const REACH = 448; // so weit wirkt eine Straßenzelle auf ihre Nachbarn (Spurbänder bis 6 Zellen, laneGrid)
const SKIP = new Set(['rail', 'railTop', 'gate', 'post', 'cap']); // Schienen (railGeometry) und Zäune der Weiden (fenceGeometry) bauen wir als Körper, nicht in die Textur
const RAIL_H = 2.0; // Höhe des Schienenkopfes über dem Boden (Weltpixel)
const RAIL_STEP = 10; // Abtastung der Schienen entlang des Gleises (Gelände)

/** Nummer einer Kachel. */
export const tileKey = (tx, ty) => ty * NT + tx;

/**
 * Stufe d für die Bildschirmdichte s (Gerätepixel je Weltpixel): kleinste Stufe, die 0,75 · s deckt (eine leicht vergrößerte Textur sieht
 * kaum weicher aus und spart Speicher); prev (wahlfrei) wechselt nur mit Abstand (Hysterese).
 */
export function lodFor(s, prev = 0) {
  const need = s * 0.75;
  const pick = () => LODS.find((v) => v >= need) ?? LODS[LODS.length - 1];
  if (!prev) return pick();
  if (need > prev * 1.15 && prev < LODS[LODS.length - 1]) return pick();
  if (need < prev * 0.45 && prev > LODS[0]) return pick();
  return prev;
}

/** Texturspeicher einer Kachel bei Stufe d (Bytes, mit Mipmaps). */
export const tileBytes = (d) => tileSize(d) ** 2 * 4 * 1.34;

/**
 * Netz einer Kachel: die Dreiecke des Bodennetzes (wie ground3d.js buildGrid) im Quadrat der Kachel als Indexliste; Lage und Höhen kommen
 * vom Bodennetz (geteilte Attribute). Rückgabe { index (Uint32Array), cells } (Zellen je Seite, am Kartenrand weniger).
 */
export function tileIndex(tx, ty) {
  const i0 = tx * PER;
  const j0 = ty * PER;
  const ni = Math.max(0, Math.min(PER, FINE_N - 1 - i0));
  const nj = Math.max(0, Math.min(PER, FINE_N - 1 - j0));
  const idx = new Uint32Array(ni * nj * 6);
  let k = 0;
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      const a = (j0 + j) * FINE_N + (i0 + i);
      idx.set([a, a + 1, a + FINE_N, a + 1, a + FINE_N + 1, a + FINE_N], k);
      k += 6;
    }
  }
  return { index: idx, ni, nj };
}

/** Bildpunkt (Texel, mit Rand) einer Weltlage in der Kachel (tx, ty) bei Stufe d: wie der Vertex-Shader. */
export function tileTexel(tx, ty, d, x, y) {
  return [(x - tx * TILE) * d + PAD, (y - ty * TILE) * d + PAD];
}

/** Kantenlänge der Leinwand einer Kachel bei Stufe d (Texel). */
export const tileSize = (d) => Math.round(TILE * d) + 2 * PAD;

/**
 * Kacheln, die Wege, Gleise, Felder und Pflaster der Karte berühren (großzügig, mit Rand): Menge von tileKey. Gemalt wird nur hier.
 */
export function mapContentTiles(map) {
  const set = new Set();
  const town = map?.town;
  if (!town) return set;
  const mark = (x, y, r) => {
    const t0 = Math.max(0, Math.floor((x - r) / TILE));
    const t1 = Math.min(NT - 1, Math.floor((x + r) / TILE));
    const u0 = Math.max(0, Math.floor((y - r) / TILE));
    const u1 = Math.min(NT - 1, Math.floor((y + r) / TILE));
    for (let v = u0; v <= u1; v++) for (let u = t0; u <= t1; u++) set.add(tileKey(u, v));
  };
  const line = (x1, y1, x2, y2, r) => {
    const L = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(L / 128));
    for (let i = 0; i <= n; i++) mark(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, r + 70);
  };
  for (const r of town.roads ?? []) if (r.dirt) line(r.x1, r.y1, r.x2, r.y2, (r.w ?? 30) / 2 + 12);
  for (const r of railList(town)) line(r.x1, r.y1, r.x2, r.y2, 40);
  for (const f of town.fields ?? []) {
    if (!(f.w > 4 && f.h > 4)) continue;
    const c = Math.cos(f.angle || 0);
    const s = Math.sin(f.angle || 0);
    const nx = Math.max(1, Math.ceil(f.w / 128));
    const ny = Math.max(1, Math.ceil(f.h / 128));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const a = (i / nx - 0.5) * f.w;
        const b = (j / ny - 0.5) * f.h;
        mark(f.x + a * c - b * s, f.y + a * s + b * c, 70 + 24);
      }
    }
  }
  for (const p of town.plazas ?? []) mark(p.x, p.y, Math.hypot(p.w, p.h) / 2 + 8);
  for (const r of town.walks ?? []) line(r.x1, r.y1, r.x2, r.y2, r.w + 8);
  return set;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Schienen als Körper
// ---------------------------------------------------------------------------------------------------------------------------

const _c = new THREE.Color();
const _c2 = new THREE.Color();

/**
 * Schienen als Körper: je Strecke { x1, y1, x2, y2, pad? } zwei Schienen im Abstand der Spurweite (render/ways.js RAIL), Kopf RAIL_H hoch, oben
 * hell (railTop), seitlich dunkel (rail). Höhe folgt relief.displayAt alle RAIL_STEP Weltpixel. Indizierte BufferGeometry in
 * Weltkoordinaten (x, y, Höhe) mit position, normal, color; null ohne Strecken. colors: { rail, top } als CSS-Farben.
 */
export function railGeometry(rails, relief, colors) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const cTop = _c.set(colors.top).toArray();
  const cSide = _c.set(colors.rail).lerp(_c2.set(colors.top), 0.3).toArray(); // Seiten nicht ganz so dunkel wie gemalt (sie stehen im Bild)
  const half = RAIL.half;
  const sink = 0.4; // der Fuß liegt etwas im Boden
  for (const r of rails) {
    const L = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
    if (L < 1) continue;
    const ux = (r.x2 - r.x1) / L;
    const uy = (r.y2 - r.y1) / L;
    const nx = -uy;
    const ny = ux;
    const s0 = -(r.pad ?? 0);
    const s1 = L + (r.pad ?? 0);
    const n = Math.max(1, Math.ceil((s1 - s0) / RAIL_STEP));
    for (const side of [-1, 1]) {
      const o = side * RAIL.gauge;
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n;
        const cx = r.x1 + ux * s + nx * o;
        const cy = r.y1 + uy * s + ny * o;
        const h = relief.displayAt(cx, cy) - sink;
        const top = h + RAIL_H + sink;
        const ax = cx - nx * half;
        const ay = cy - ny * half;
        const bx = cx + nx * half;
        const by = cy + ny * half;
        // sechs Ecken je Abtastpunkt: Oberseite (a, b), linke Seite (a unten, a oben), rechte Seite (b unten, b oben)
        pos.push(ax, ay, top, bx, by, top, ax, ay, h, ax, ay, top, bx, by, h, bx, by, top);
        nor.push(0, 0, 1, 0, 0, 1, -nx, -ny, 0, -nx, -ny, 0, nx, ny, 0, nx, ny, 0);
        col.push(...cTop, ...cTop, ...cSide, ...cSide, ...cSide, ...cSide);
      }
      for (let i = 0; i < n; i++) {
        const p = base + i * 6;
        const q = p + 6;
        // Oberseite (a b), linke Seite, rechte Seite; Umlaufsinn ist gleichgültig (DoubleSide)
        idx.push(p, p + 1, q, p + 1, q + 1, q);
        idx.push(p + 2, p + 3, q + 2, p + 3, q + 3, q + 2);
        idx.push(p + 4, p + 5, q + 4, p + 5, q + 5, q + 4);
      }
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Zäune der Weiden als Körper (fieldFences aus render/fields.js): Pfosten als Quader (Oberseite hell, im Winter mit weißer Kappe), Latten und Tore als
 * flache Balken zwischen den Pfosten, Höhe über relief.displayAt an den Enden. Indizierte BufferGeometry in Weltkoordinaten mit position, normal, color;
 * null ohne Zäune.
 */
export function fenceGeometry(items, relief, season) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const colorOf = (layer) => _c.set(FENCE[layer] ?? '#8d6e49').toArray();
  const face = (pts, n, c) => {
    const b = pos.length / 3;
    for (const p of pts) {
      pos.push(...p);
      nor.push(...n);
      col.push(...c);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const box = (x, y, hw, z0, z1, c, cTop) => {
    const a = [x - hw, y - hw];
    const b = [x + hw, y - hw];
    const d = [x + hw, y + hw];
    const e = [x - hw, y + hw];
    face([[...a, z0], [...b, z0], [...b, z1], [...a, z1]], [0, -1, 0], c);
    face([[...b, z0], [...d, z0], [...d, z1], [...b, z1]], [1, 0, 0], c);
    face([[...d, z0], [...e, z0], [...e, z1], [...d, z1]], [0, 1, 0], c);
    face([[...e, z0], [...a, z0], [...a, z1], [...e, z1]], [-1, 0, 0], c);
    face([[...a, z1], [...e, z1], [...d, z1], [...b, z1]], [0, 0, 1], cTop ?? c);
  };
  for (const it of items) {
    if (it.k === 'post') {
      if (it.layer === 'cap' && season !== 'winter') continue; // Kappe nur mit Schnee
      const g = relief.displayAt(it.x, it.y);
      const c = colorOf(it.layer);
      box(it.x, it.y, it.hw, g + it.h0, g + it.h1, c);
    } else {
      const L = Math.hypot(it.x2 - it.x1, it.y2 - it.y1);
      if (L < 0.5) continue;
      const nx = -(it.y2 - it.y1) / L;
      const ny = (it.x2 - it.x1) / L;
      const w = it.t; // Latte etwa so breit wie dick
      const gA = relief.displayAt(it.x1, it.y1) + it.h;
      const gB = relief.displayAt(it.x2, it.y2) + it.h;
      const c = colorOf(it.layer);
      const A0 = [it.x1 + nx * w, it.y1 + ny * w];
      const A1 = [it.x1 - nx * w, it.y1 - ny * w];
      const B0 = [it.x2 + nx * w, it.y2 + ny * w];
      const B1 = [it.x2 - nx * w, it.y2 - ny * w];
      const hz = it.t * 0.5 + 0.2;
      face([[...A1, gA + hz], [...A0, gA + hz], [...B0, gB + hz], [...B1, gB + hz]], [0, 0, 1], c); // Oberseite
      face([[...A0, gA - hz], [...B0, gB - hz], [...B0, gB + hz], [...A0, gA + hz]], [nx, ny, 0], c); // Seite
      face([[...B1, gB - hz], [...A1, gA - hz], [...A1, gA + hz], [...B1, gB + hz]], [-nx, -ny, 0], c);
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Shader
// ---------------------------------------------------------------------------------------------------------------------------

// Lage und Höhen vom Bodennetz (position, aH wie ground3d.js), Bildpunkt aus der Weltlage; Licht wie der Boden (FS_GROUND: lit)
const VS_TILE = `
attribute vec3 aH;
uniform vec3 uMap; // Weltlage des Texels 0 (x, y) und Texel je Weltpixel
uniform float uSize; // Kantenlänge der Leinwand (Texel)
varying vec2 vUv;
varying vec2 vG;
void main() {
  vUv = (position.xy - uMap.xy) * uMap.z / uSize;
  vG = aH.yz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Das Bild ist vormultipliziert (Rand der Flächen ohne dunklen Saum); 60 % der Hangbeleuchtung des Bodens (flach = 1, wie gemalt)
const FS_TILE = `
precision highp float;
uniform sampler2D uTex;
uniform vec3 uLight;
uniform vec4 uTint; // Prüfskript: überall, wo die Schicht deckt, diese Farbe (rgb, Anteil a); sonst 0
varying vec2 vUv;
varying vec2 vG;
void main() {
  vec4 c = texture2D(uTex, vUv, -0.5); // etwas schärfer als die Mipmap (feine Reihen und Fugen)
  vec3 n = normalize(vec3(-vG * 1.9, 1.0));
  float lit = mix(1.0, clamp(1.0 + 1.05 * (dot(n, uLight) - uLight.z), 0.6, 1.35), 0.6); // 60 % der Hangbeleuchtung des Bodens: eingebunden, aber Farben der Flächen bleiben
  gl_FragColor = vec4(mix(c.rgb * lit, uTint.rgb * c.a, uTint.a), c.a);
}`;

// Schienen: Eckfarben, schwache Seitenbeleuchtung (Lichtvektor wie der Boden), kein Schatten
const VS_RAIL = `
attribute vec3 color;
uniform vec3 uLight;
varying vec3 vCol;
void main() {
  float lam = 0.62 + 0.5 * max(dot(normal, uLight), 0.0);
  vCol = color * lam;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FS_RAIL = `
precision highp float;
varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol, 1.0); }`;

// ---------------------------------------------------------------------------------------------------------------------------
// Bodenschicht
// ---------------------------------------------------------------------------------------------------------------------------

const _box = new THREE.Box3();
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _v = new THREE.Vector3();

/** Eine leere 2D-Leinwand der Größe n × n (Browser) oder null. */
function makeCanvas(n) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

export class Ways3D {
  /** gl: THREE.WebGLRenderer; ground: Ground3D (Bodennetz, dessen Lage und Höhen die Kacheln teilen). */
  constructor(gl, ground) {
    this.gl = gl;
    this.ground = ground;
    this.group = new THREE.Group();
    this.group.name = 'wege';
    this.tiles = new Map(); // tileKey → { tx, ty, mesh, mat, tex, d, stamp, seen, bytes }
    this.mapTiles = null; // Kacheln mit Karteninhalt
    this.mapRef = null;
    this.mapStamp = -1;
    this.cityTiles = new Map(); // tileKey → Kennzahl der Straßenzellen im Umkreis
    this.cityAt = -1e9; // Spielzeit der letzten Abfrage
    this.cityKey = '';
    this.mapCells = null; // Kacheln der Kartenstraßen (g.roads), neu bei roads.ver
    this.mapCellsVer = -1;
    this.d = 0; // aktuelle Stufe
    this.scratch = null;
    this.frame = 0;
    this.tint = { value: new THREE.Vector4(0, 0, 0, 0) }; // Prüfskript (smoke-3d.mjs --only wege): Schicht einfärben
    this.budgetMs = 12; // höchstens so viel Malzeit je Bild (mindestens eine Kachel)
    this.heights = new Map(); // tileKey → [min, max] der Bodenhöhe
    this.heightsVer = -1;
    this.last = { visible: 0, drawn: 0, painted: 0, pending: 0, ms: 0, bytes: 0, d: 0, tris: 0 };
    this.maxBytes = 64e6; // Texturspeicher der Kacheln (mit Mipmaps); darüber fliegen die ältesten unsichtbaren Kacheln raus
    this.aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    // Schienen der Karte (einmal je Relief, Jahreszeit und Wege) und der Stadt (bei Änderung)
    this.railMat = new THREE.ShaderMaterial({ uniforms: { uLight: ground.uniforms.uLight }, vertexShader: VS_RAIL, fragmentShader: FS_RAIL, side: THREE.DoubleSide });
    this.mapRails = this.makeRailMesh('schienen-karte');
    this.cityRails = this.makeRailMesh('schienen-stadt');
    this.fences = this.makeRailMesh('zaeune'); // Zäune der Weiden, gleiches Material
    this.railKeys = { map: '', city: '', fence: '' };
  }

  makeRailMesh(name) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), this.railMat);
    m.name = name;
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    m.renderOrder = 3;
    m.visible = false;
    this.group.add(m);
    return m;
  }

  /** Bodenhöhe (min, max) einer Kachel, für den Sichtkegel. */
  heightRange(key, tx, ty, relief) {
    if (relief.version !== this.heightsVer) {
      this.heights.clear();
      this.heightsVer = relief.version;
    }
    let h = this.heights.get(key);
    if (h) return h;
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j <= 16; j++) {
      for (let i = 0; i <= 16; i++) {
        const v = relief.displayAt(tx * TILE + (i * TILE) / 16, ty * TILE + (j * TILE) / 16);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    h = [lo - 4, hi + 12];
    this.heights.set(key, h);
    return h;
  }

  /** Bildschirmdichte: Gerätepixel je Weltpixel (größere der beiden Bodenachsen) über die three-Kamera. */
  density(ren) {
    const root = ren.groundRoot;
    const cam3 = ren.cam3;
    const c = ren.camera;
    const x = c.x;
    const y = c.y;
    const w = (ren.cssW * ren.dpr) / 2;
    const h = (ren.cssH * ren.dpr) / 2;
    const p = (px, py) => _v.set(px, py, 0).applyMatrix4(root.matrixWorld).project(cam3);
    const a = p(x, y);
    const ax = a.x * w;
    const ay = a.y * h;
    const b = p(x + 100, y);
    const bx = b.x * w - ax;
    const by = b.y * h - ay;
    const e = p(x, y + 100);
    const ex = e.x * w - ax;
    const ey = e.y * h - ay;
    return Math.max(Math.hypot(bx, by), Math.hypot(ex, ey)) / 100;
  }

  /** Kachel anlegen: Netz mit geteilten Attributen des Bodens, eigenes Material. */
  makeTile(tx, ty) {
    const geo = new THREE.BufferGeometry();
    const g = this.ground.mesh.geometry;
    geo.setAttribute('position', g.attributes.position);
    geo.setAttribute('aH', g.attributes.aH);
    geo.setIndex(new THREE.BufferAttribute(tileIndex(tx, ty).index, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uMap: { value: new THREE.Vector3() }, uSize: { value: 1 }, uLight: this.ground.uniforms.uLight, uTint: this.tint },
      vertexShader: VS_TILE,
      fragmentShader: FS_TILE,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `wege-${tx}-${ty}`;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2; // nach dem Wasser (1)
    mesh.visible = false;
    this.group.add(mesh);
    return { tx, ty, mesh, mat, tex: null, d: 0, stamp: '', seen: 0, bytes: 0, tris: tileIndex(tx, ty).index.length / 3 };
  }

  /** Kachel malen und als Textur hochladen; ren: Renderer (Spiel, Jahreszeit), f: Werte des Bildes (known, team). */
  paint(t, ren, f, d, stamp) {
    const n = tileSize(d);
    if (!this.scratch || this.scratch.width !== n) this.scratch = makeCanvas(n);
    const cv = this.scratch;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, n, n);
    const x0 = t.tx * TILE;
    const y0 = t.ty * TILE;
    const k = PAD / d;
    const R = { x0: x0 - k, y0: y0 - k, x1: x0 + TILE + k, y1: y0 + TILE + k };
    // flache Ansicht von oben für die Maler: kein Geländeversatz (draping), Zoom nur für die Stufe der Einzelheiten (Muster ab 0,5)
    const flat = Object.create(ren);
    flat.draping = () => false;
    flat.camera = { zoom: d, relief: null, iso: false, three: false, visibleRect: () => R };
    flat.ways3dShown = false;
    flat.dpr = 1;
    ctx.save();
    ctx.setTransform(d, 0, 0, d, PAD - x0 * d, PAD - y0 * d);
    const town = ren.game.map.town;
    const hit = (x, y, r) => x + r >= R.x0 && x - r <= R.x1 && y + r >= R.y0 && y - r <= R.y1;
    drawPaving(ctx, town, 1, hit);
    drawWays(flat, ctx, ren.season, SKIP);
    drawCityStreets(flat, ctx, f.team, f.known, SKIP);
    ctx.restore();
    // Textur: eine je Kachel und Größe (bei gleicher Größe nur neu hochladen)
    let tex = t.tex;
    if (!tex || t.d !== d) {
      tex?.dispose();
      tex = new THREE.Texture(cv);
      tex.flipY = false;
      tex.premultiplyAlpha = true;
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = this.aniso;
      tex.generateMipmaps = true;
      t.tex = tex;
      t.mat.uniforms.uTex.value = tex;
    } else tex.image = cv;
    tex.needsUpdate = true;
    this.gl.initTexture(tex); // sofort hochladen: die Leinwand dient gleich der nächsten Kachel
    t.d = d;
    t.stamp = stamp;
    t.bytes = tileBytes(d);
    t.mat.uniforms.uMap.value.set(x0 - k, y0 - k, d);
    t.mat.uniforms.uSize.value = n;
  }

  /** Straßenzellen der Stadt je Kachel (Umkreis REACH): nur bei geänderter Spielzeit (alle 0,25 s) oder anderer Sicht neu. */
  refreshCity(g, f) {
    // Kartenstraßen (g.roads): Kacheln nur neu, wenn sich g.roads ändert (Bagger, Beschuss) oder die Karte
    const ver = g.roads?.ver ?? 0;
    if (!this.mapCells || ver !== this.mapCellsVer) {
      const s = new Set();
      mapStreetCells(g, (x, y) => {
        const t0 = Math.max(0, Math.floor((x - 80) / TILE));
        const t1 = Math.min(NT - 1, Math.floor((x + 80) / TILE));
        const u0 = Math.max(0, Math.floor((y - 80) / TILE));
        const u1 = Math.min(NT - 1, Math.floor((y + 80) / TILE));
        for (let u = u0; u <= u1; u++) for (let v = t0; v <= t1; v++) s.add(tileKey(v, u));
      });
      this.mapCells = s;
      this.mapCellsVer = ver;
    }
    const key = `${f.team}|${f.reveal ? 1 : 0}`;
    if (key === this.cityKey && Math.abs(g.time - this.cityAt) < 0.25) return;
    this.cityKey = key;
    this.cityAt = g.time;
    const map = new Map();
    const add = (x, y, v) => {
      const t0 = Math.max(0, Math.floor((x - REACH) / TILE));
      const t1 = Math.min(NT - 1, Math.floor((x + REACH) / TILE));
      const u0 = Math.max(0, Math.floor((y - REACH) / TILE));
      const u1 = Math.min(NT - 1, Math.floor((y + REACH) / TILE));
      for (let u = u0; u <= u1; u++) for (let s = t0; s <= t1; s++) map.set(tileKey(s, u), ((map.get(tileKey(s, u)) ?? 0) + v) | 0);
    };
    cityStreetStamp(g, f.team, f.known, add);
    this.cityTiles = map;
  }

  /** Schienen (Karte und Stadt) bei Änderung neu bauen. */
  syncRails(ren, f, relief) {
    const g = ren.game;
    const colors = RAIL.color(ren.season);
    const mk = `${relief.version}|${ren.season}|${waysStamp()}`;
    if (mk !== this.railKeys.map || !this.mapRails.geometry.index) {
      this.railKeys.map = mk;
      this.setRails(this.mapRails, railGeometry(railList(g.map.town), relief, colors));
    }
    const fk = `${relief.version}|${ren.season}|${waysStamp()}`;
    if (fk !== this.railKeys.fence) {
      this.railKeys.fence = fk;
      this.setRails(this.fences, fenceGeometry(fieldFences(g.map), relief, ren.season));
    }
    const list = cityRailPieces(g, f.team, f.known);
    let h = list.rails.length;
    for (const r of list.rails) h = (Math.imul(h, 31) + Math.round(r.x1 * 4) * 3 + Math.round(r.y1 * 4) * 5 + Math.round(r.x2 * 4) * 7 + Math.round(r.y2 * 4) * 11) | 0;
    const ck = `${h}|${relief.version}|${ren.season}`;
    if (ck !== this.railKeys.city) {
      this.railKeys.city = ck;
      this.setRails(this.cityRails, railGeometry(list.rails, relief, colors));
    }
  }

  setRails(mesh, geo) {
    mesh.geometry.dispose();
    mesh.geometry = geo ?? new THREE.BufferGeometry();
    mesh.visible = !!geo;
  }

  /**
   * Vor dem Zeichnen des Bodens: Kacheln im Bild bestimmen, veraltete malen (Zeitbudget), unsichtbare ausblenden. ren: Renderer3D (three-Kamera,
   * Spiel, Jahreszeit), f: Werte des Bildes (relief, known, team, reveal). Rückgabe: Zähler des Bildes.
   */
  update(ren, f) {
    const relief = f.relief;
    const g = ren.game;
    const t0 = performance.now();
    this.frame++;
    if (this.mapRef !== g.map || this.mapStamp !== waysStamp()) {
      this.mapRef = g.map;
      this.mapStamp = waysStamp(); // Editor, Prüfskript: invalidateWays()
      this.mapTiles = mapContentTiles(g.map);
      this.mapCells = null;
      this.cityKey = '';
    }
    this.refreshCity(g, f);
    // Sichtkegel (three-Kamera, Wurzelgruppe des Bodens), Kacheln mit etwas Rand: Schwenken zeigt keine leeren Kacheln
    _pm.multiplyMatrices(ren.cam3.projectionMatrix, ren.cam3.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm);
    const rootM = ren.groundRoot.matrixWorld;
    const season = ren.season ?? 'summer';
    const keys = new Set([...this.mapTiles, ...this.cityTiles.keys(), ...this.mapCells]);
    const seen = [];
    for (const t of this.tiles.values()) t.mesh.visible = false;
    for (const key of keys) {
      const tx = key % NT;
      const ty = (key - tx) / NT;
      const [lo, hi] = this.heightRange(key, tx, ty, relief);
      _box.min.set(tx * TILE - MARGIN, ty * TILE - MARGIN, lo);
      _box.max.set((tx + 1) * TILE + MARGIN, (ty + 1) * TILE + MARGIN, hi);
      _box.applyMatrix4(rootM);
      if (_frustum.intersectsBox(_box)) seen.push([key, tx, ty]);
    }
    const visible = seen.length;
    // Stufe nach der Bildschirmdichte, höchstens so fein, dass die Kacheln im Bild in den Texturspeicher passen
    let d = lodFor(this.density(ren), this.d);
    while (d > LODS[0] && visible * tileBytes(d) > this.maxBytes * 0.9) d = LODS[LODS.indexOf(d) - 1];
    this.d = d;
    const base = `${d}|${season}|${waysStamp()}|${this.mapCellsVer}`;
    const stale = [];
    for (const [key, tx, ty] of seen) {
      let t = this.tiles.get(key);
      if (!t) this.tiles.set(key, (t = this.makeTile(tx, ty)));
      t.seen = this.frame;
      const stamp = `${base}|${this.cityTiles.get(key) ?? 0}`;
      if (t.stamp !== stamp) stale.push([t, stamp]);
      else t.mesh.visible = true;
    }
    // Reihenfolge: Mitte des Bildes zuerst; unbemalte Kacheln (nichts zu sehen) vor veralteten (altes Bild bleibt stehen)
    const c = ren.camera;
    stale.sort((a, b) => (!a[0].tex - !b[0].tex) || Math.hypot((a[0].tx + 0.5) * TILE - c.x, (a[0].ty + 0.5) * TILE - c.y) - Math.hypot((b[0].tx + 0.5) * TILE - c.x, (b[0].ty + 0.5) * TILE - c.y));
    let painted = 0;
    let pending = 0;
    for (const [t, stamp] of stale) {
      if (painted && performance.now() - t0 > this.budgetMs) {
        pending++;
        t.mesh.visible = !!t.tex; // altes Bild
        continue;
      }
      this.paint(t, ren, f, d, stamp);
      t.mesh.visible = true;
      painted++;
    }
    // Speicher: unsichtbare, lange ungesehene Kacheln freigeben (Textur weg, Netz bleibt)
    let bytes = 0;
    for (const t of this.tiles.values()) bytes += t.bytes;
    if (bytes > this.maxBytes) {
      const old = [...this.tiles.values()].filter((t) => t.tex && t.seen !== this.frame).sort((a, b) => a.seen - b.seen);
      for (const t of old) {
        if (bytes <= this.maxBytes * 0.8) break;
        bytes -= t.bytes;
        t.tex.dispose();
        t.tex = null;
        t.stamp = '';
        t.bytes = 0;
        t.mat.uniforms.uTex.value = null;
      }
    }
    this.syncRails(ren, f, relief);
    let drawn = 0;
    let tris = 0;
    let vbytes = 0;
    for (const t of this.tiles.values()) {
      if (t.mesh.visible && t.tex) {
        drawn++;
        tris += t.tris;
        vbytes += t.bytes;
      } else t.mesh.visible = false;
    }
    this.last = { visible, drawn, painted, pending, ms: performance.now() - t0, bytes, vbytes, d, tris, rails: (this.mapRails.visible ? 1 : 0) + (this.cityRails.visible ? 1 : 0), fences: this.fences.visible ? 1 : 0 };
    return this.last;
  }

  /** Alles neu malen (Prüfskript, Editor): Kacheln für ungültig erklären. */
  invalidate() {
    for (const t of this.tiles.values()) t.stamp = '';
    this.cityKey = '';
    this.railKeys = { map: '', city: '', fence: '' };
  }

  /** Zähler fürs Prüfskript: Kacheln im Bild, gezeichnet, malte dieses Bild, Warteschlange, Texturspeicher, Stufe, Dreiecke. */
  stats() {
    return { ...this.last, tilesTotal: this.tiles.size };
  }

  dispose() {
    for (const t of this.tiles.values()) {
      t.tex?.dispose();
      t.mat.dispose();
      t.mesh.geometry.dispose();
    }
    this.railMat.dispose();
    this.mapRails.geometry.dispose();
    this.cityRails.geometry.dispose();
    this.fences.geometry.dispose();
  }
}
