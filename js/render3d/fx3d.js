// Effekte in 3D (Plan „3D mit three.js“, Paket „Effekte 3D“): ersetzt in der Ansicht 3D den aufrechten Teil des Durchlaufs „Effekte“
// (render/layers/isoview.js isoFxUp): Feuerball, Rauchpilz, Blitz, Funken und Brocken der Explosion, Leuchtspur, Geschoss mit
// Rauchspur, Mündungsfeuer, Abfangen in der Luft, Mörsergranate im Bogen, Rauchsäulen, Feuer, Staub und Nebelwände. Bodenteile
// (Zielring, Feuerschein, Druckring), Minen und Wegziel bleiben gemalt; Krater liegen schon als Bodenbild im Durchlauf „Boden“.
//
// Alles ist ein Teilchen in einem einzigen InstancedBufferGeometry (ein Draw-Call): ein Strich von A nach B in Weltkoordinaten
// (x, y, Höhe) mit Versatz in der Bildebene (Welt-px, y nach oben), Halbbreite an A und B und Verlängerung über die Enden. Ohne Länge
// ist es ein Fleck (Halbmesser r, Drehung). Formen im Fragment-Shader: weich (SOFT), beleuchtete Schwade (LIT), Wolke (PUFF) wie die
// gemalten Flecken aus fx.js (dot), Flammenzunge, Brocken, Strich, Scheibe. Die Maße stammen aus den gemalten Iso-Malern: ein Maß
// „× Zoom in Bildschirm-px“ ist hier dasselbe Maß in Welt-px (die Kamera bildet Welt-px × Zoom ab).
//
// Tiefe: jedes Effektbild ist eine Gruppe mit dem Tiefenwert seines Fußpunkts, etwas zum Betrachter gerückt (bias), damit der Feuerball
// vor der getroffenen Einheit liegt; Häuser, Einheiten und Bäume davor verdecken ihn über den Tiefenpuffer des Durchlaufs „Objekte“.
// Gruppen werden von hinten nach vorn sortiert, innerhalb einer Gruppe bleibt die Malreihenfolge der gemalten Fassung.
// Lichtblitz: Leuchtfleck in der Luft, der gemalte Feuerschein am Boden; ein echtes Punktlicht bräuchte Lichtquellen in allen
// Shadern (Baukasten, Natur, Props, Einheiten, Boden) und gehört zum Paket „Tag und Nacht 3D“.
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp } from '../render/color.js';
import { ease, SIZE, partsOf, fireCol, smokeIn, MISSILE, FLAK, GUN_H, HIT_H, AIRBURST_H, ARC } from '../render/fx.js';

const TAU = Math.PI * 2;
// Formen (Fragment-Shader)
export const SOFT = 0; // weich, gleichmäßig (Licht, Blitz, Schein)
export const LIT = 1; // weiche Schwade, zur Sonne hin hell (Rauchsäulen)
export const PUFF = 2; // Wolke mit festerem Rand (Feuerball, Explosionsrauch, Flakwolke)
export const FLAME = 3; // Flammenzunge vom Fuß A zur Spitze B
export const CHUNK = 4; // Brocken: Rechteck 2r × 1,2r
export const LINE = 5; // Strich mit runden Enden, Breite von A nach B verlaufend
export const DISC = 6; // Scheibe mit hartem Rand (Glut, Funken des Feuers)

const START = 4096; // Teilchen zu Beginn (50 Explosionen ≈ 1 500); wächst bei Bedarf (verdoppelt, neue Geometrie)
// Tiefenversatz zum Betrachter (Welt-px) je Effekt: Feuerball vor der getroffenen Einheit, Rauch vor dem eigenen Dach
const BIAS = { explosion: 24, line: 4, intercept: 10, muzzle: 8, shell: 6, unit: 16, low: 0.8, column: 8 };

const VS = `
attribute vec4 aA;   // Anfang: Welt x, y, Höhe; Deckkraft-Anteil am Anfang (Strich)
attribute vec3 aB;   // Ende: Welt x, y, Höhe
attribute vec4 aOff; // Versatz in der Bildebene (Welt-px, y nach oben) an A (xy) und B (zw)
attribute vec4 aW;   // Halbbreite an A, an B, Verlängerung über die Enden, Drehung (Fleck ohne Länge)
attribute vec4 aCol; // Farbe 0–1, Deckkraft
attribute vec2 aKind; // Form, Tiefenversatz zum Betrachter (Welt-px)
uniform vec2 uL;     // Sonne in der Bildebene (Einheitsvektor, y nach oben)
uniform float uPx;   // ein Gerätepixel in Welt-px (Kantenglättung)
varying vec2 vUv;
varying vec2 vL;
varying vec2 vW;
varying vec4 vCol;
varying float vAlong;
varying float vT;
varying float vLen;
varying float vKind;
varying float vA0;
void main() {
  vec4 a = modelViewMatrix * vec4(aA.xyz, 1.0);
  a.xy += aOff.xy;
  vec4 b = modelViewMatrix * vec4(aB, 1.0);
  b.xy += aOff.zw;
  vec2 d = b.xy - a.xy;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(cos(aW.w), sin(aW.w));
  vec2 nrm = vec2(-dir.y, dir.x);
  bool edge = (aKind.x > 2.5 && aKind.x < 3.5) || (aKind.x > 4.5 && aKind.x < 5.5); // Flamme, Strich: Rand für die Glättung
  float m = edge ? uPx : 0.0;
  float hw = max(aW.x, aW.y) + m;
  float ext = aW.z + m;
  float along = mix(-ext, len + ext, position.x);
  float across = position.y * hw;
  float u = len > 1e-4 ? clamp(along / len, 0.0, 1.0) : 0.0;
  gl_Position = projectionMatrix * vec4(a.xy + dir * along + nrm * across, mix(a.z, b.z, u) + aKind.y, 1.0);
  vUv = vec2(along - len * 0.5, across) / max(aW.x, 1e-4);
  vL = vec2(dot(uL, dir), dot(uL, nrm));
  vW = aW.xy;
  vCol = aCol;
  vAlong = along;
  vT = across;
  vLen = len;
  vKind = aKind.x;
  vA0 = aA.w;
}`;

const FS = `
uniform float uPx;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vW;
varying vec4 vCol;
varying float vAlong;
varying float vT;
varying float vLen;
varying float vKind;
varying float vA0;
void main() {
  float a = 0.0;
  vec3 c = vCol.rgb;
  int k = int(vKind + 0.5);
  if (k <= 2) {
    float r = length(vUv);
    if (r >= 1.0) discard;
    if (k == 0) a = r < 0.45 ? mix(1.0, 0.62, r / 0.45) : mix(0.62, 0.0, (r - 0.45) / 0.55);
    else {
      // wie dot() in fx.js: helle Mitte zur Sonne hin versetzt, Farbe in der Mitte, dunkler Rand
      bool puff = k == 2;
      float rl = clamp(length(vUv - vL * 0.27) / 1.27, 0.0, 1.0);
      vec3 lc = c + (1.0 - c) * (puff ? 0.38 : 0.32);
      vec3 dc = c * (puff ? 0.66 : 0.72);
      c = rl < 0.5 ? mix(lc, c, rl / 0.5) : mix(c, dc, clamp((rl - 0.5) / (puff ? 0.34 : 0.32), 0.0, 1.0));
      if (puff) a = r < 0.84 ? mix(1.0, 0.95, r / 0.84) : r < 0.93 ? mix(0.95, 0.5, (r - 0.84) / 0.09) : mix(0.5, 0.0, (r - 0.93) / 0.07);
      else a = r < 0.5 ? mix(1.0, 0.92, r / 0.5) : r < 0.82 ? mix(0.92, 0.5, (r - 0.5) / 0.32) : mix(0.5, 0.0, (r - 0.82) / 0.18);
    }
  } else if (k == 3) {
    // Flammenzunge: Umriss der gemalten Zunge (quadratische Kurven vom Fuß zur Spitze), unten am breitesten
    float u = vAlong / max(vLen, 1e-4);
    if (u < 0.0 || u > 1.0) discard;
    float hw = vW.x * pow(max(0.0, 1.0 - pow(u, 2.2)), 0.9);
    a = 1.0 - smoothstep(hw - uPx, hw + uPx, abs(vT));
  } else if (k == 4) {
    if (abs(vUv.x) > 1.0 || abs(vUv.y) > 0.6) discard;
    a = 1.0;
  } else if (k == 5) {
    float u = clamp(vAlong / max(vLen, 1e-4), 0.0, 1.0);
    float hw = mix(vW.x, vW.y, u);
    float hv = max(hw, 0.5 * uPx); // dünner als ein halbes Gerätepixel: blasser statt flimmernd
    float dx = vAlong < 0.0 ? -vAlong : max(0.0, vAlong - vLen);
    float d = length(vec2(dx, vT));
    a = (1.0 - smoothstep(hv - 0.5 * uPx, hv + 0.5 * uPx, d)) * (hw / hv) * mix(vA0, 1.0, u);
  } else {
    float r = length(vUv);
    a = 1.0 - smoothstep(1.0 - uPx / max(vW.x, 1e-4), 1.0, r);
  }
  a *= vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(c * a, a); // vormultipliert, Mischung ONE, ONE_MINUS_SRC_ALPHA
}`;

const cols = new Map();
/** Farbe '#rrggbb' oder [r, g, b] (0–255) → [r, g, b] 0–1 (zwischengespeichert für Texte). */
function rgb01(col) {
  if (typeof col !== 'string') return [col[0] / 255, col[1] / 255, col[2] / 255];
  let c = cols.get(col);
  if (!c) {
    const n = parseInt(col.slice(1), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    cols.set(col, c);
  }
  return c;
}

// Felder je Teilchen (Reihenfolge wie die Attribute)
const LAYOUT = [['aA', 4], ['aB', 3], ['aOff', 4], ['aW', 4], ['aCol', 4], ['aKind', 2]];
const STRIDE = LAYOUT.reduce((s, [, n]) => s + n, 0);

export class Fx3D {
  constructor() {
    this.cap = 0;
    this.stage = null; // Teilchen dieses Bildes in Malreihenfolge (STRIDE Zahlen je Teilchen)
    this.n = 0;
    this.groups = []; // { z, start } je Effektbild, z = Tiefe (Bildraum, größer = näher)
    this.M = new THREE.Matrix4(); // Welt (x, y, Höhe) → Bildraum der Kamera
    this.ax = this.ay = this.ah = 0; // Fußpunkt der aktuellen Gruppe
    this.bias = 0;
    this.zoom = 1;
    this.box = [0, 0, 0, 0]; // Umriss aller Teilchen in der Bildebene (Welt-px): links, unten, rechts, oben
    this.material = new THREE.ShaderMaterial({
      uniforms: { uL: { value: new THREE.Vector2(0.6, 0.8) }, uPx: { value: 1 } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.geometry = null;
    this.mesh = new THREE.Mesh(undefined, this.material);
    this.grow(START);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'effekte';
  }

  /**
   * Platz für mindestens n Teilchen (Inhalt dieses Bildes bleibt). Neue Geometrie statt neuer Attribute: three merkt sich die
   * Instanzzahl einer Geometrie beim ersten Zeichnen (_maxInstanceCount) und zeichnete sonst nie mehr als die alte Größe.
   */
  grow(n) {
    let cap = this.cap || START;
    while (cap < n) cap *= 2;
    if (cap === this.cap) return;
    const old = this.stage;
    this.stage = new Float32Array(cap * STRIDE);
    if (old) this.stage.set(old.subarray(0, this.n * STRIDE));
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.attrs = LAYOUT.map(([name, k]) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    });
    geo.instanceCount = 0;
    this.geometry?.dispose();
    this.geometry = geo;
    this.mesh.geometry = geo;
    this.cap = cap;
  }

  /**
   * Neues Bild. cam3, root: three-Kamera (syncIsoCamera) und Wurzelgruppe des Meshs; zoom und dpr der Kamera bzw. Leinwand;
   * light: Sonne in Weltrichtung [x, y, Höhe] (Renderer.lightVec), in die Bildebene gedreht für die beleuchteten Schwaden.
   */
  begin(cam3, root, zoom, dpr, light) {
    this.M.multiplyMatrices(cam3.matrixWorldInverse, root.matrixWorld);
    this.zoom = zoom || 1;
    this.n = 0;
    this.groups.length = 0;
    this.box = [Infinity, Infinity, -Infinity, -Infinity];
    this.material.uniforms.uPx.value = 1 / (this.zoom * (dpr || 1));
    if (light) {
      const [x, y] = this.view(light[0], light[1], light[2], true);
      const l = Math.hypot(x, y) || 1;
      this.material.uniforms.uL.value.set(x / l, y / l);
    }
  }

  /** Weltpunkt (x, y, Höhe) im Bildraum: [rechts, oben, zum Betrachter] in Welt-px; dir: nur Richtung (ohne Verschiebung). */
  view(x, y, h, dir = false) {
    const e = this.M.elements;
    const w = dir ? 0 : 1;
    return [e[0] * x + e[4] * y + e[8] * h + e[12] * w, e[1] * x + e[5] * y + e[9] * h + e[13] * w, e[2] * x + e[6] * y + e[10] * h + e[14] * w];
  }

  /** Neue Gruppe (ein Effektbild) am Fußpunkt (x, y, Höhe h), um bias Welt-px zum Betrachter gerückt. */
  group(x, y, h, bias = 0) {
    this.anchor(x, y, h);
    this.bias = bias;
    this.groups.push({ z: this.view(x, y, h)[2] + bias, start: this.n });
  }

  /** Fußpunkt für die folgenden Flecken und Striche wechseln, ohne neue Gruppe. */
  anchor(x, y, h) {
    this.ax = x;
    this.ay = y;
    this.ah = h;
  }

  /** Ein Teilchen roh anhängen (siehe Attribute im Vertex-Shader). */
  push(ax, ay, ah, a0, bx, by, bh, oax, oay, obx, oby, w0, w1, ext, rot, col, a, kind) {
    if (!(a > 0.004)) return;
    if (this.n >= this.cap) this.grow(this.n + 1);
    const c = rgb01(col);
    const r = Math.max(w0, w1, ext); // Umriss: beide Enden mit Versatz, um die halbe Breite erweitert
    const b = this.box;
    for (const [x, y, h, ox, oy] of [[ax, ay, ah, oax, oay], [bx, by, bh, obx, oby]]) {
      const [vx, vy] = this.view(x, y, h);
      b[0] = Math.min(b[0], vx + ox - r);
      b[1] = Math.min(b[1], vy + oy - r);
      b[2] = Math.max(b[2], vx + ox + r);
      b[3] = Math.max(b[3], vy + oy + r);
    }
    const s = this.stage;
    let i = this.n * STRIDE;
    s[i++] = ax; s[i++] = ay; s[i++] = ah; s[i++] = a0;
    s[i++] = bx; s[i++] = by; s[i++] = bh;
    s[i++] = oax; s[i++] = oay; s[i++] = obx; s[i++] = oby;
    s[i++] = w0; s[i++] = w1; s[i++] = ext; s[i++] = rot;
    s[i++] = c[0]; s[i++] = c[1]; s[i++] = c[2]; s[i++] = Math.min(1, a);
    s[i++] = kind; s[i++] = this.bias;
    this.n++;
  }

  /** Fleck am Fußpunkt, Versatz (ox rechts, oy oben) und Halbmesser r in Welt-px, Deckkraft a, Form kind, Drehung rot (Bildebene). */
  blob(col, ox, oy, r, a, kind = SOFT, rot = 0) {
    if (!(r > 0)) return;
    this.push(this.ax, this.ay, this.ah, 1, this.ax, this.ay, this.ah, ox, oy, ox, oy, r, r, r, rot, col, a, kind);
  }

  /** Strich in der Bildebene am Fußpunkt von (x1, y1) nach (x2, y2); Halbbreiten w0, w1; a0 = Deckkraft-Anteil am Anfang. */
  line(col, x1, y1, x2, y2, w0, w1, a, kind = LINE, ext = null, a0 = 1) {
    const { ax, ay, ah } = this;
    this.push(ax, ay, ah, a0, ax, ay, ah, x1, y1, x2, y2, w0, w1, ext ?? (kind === LINE ? Math.max(w0, w1) : 0), 0, col, a, kind);
  }

  /** Strich zwischen zwei Weltpunkten P, Q = [x, y, Höhe] (Leuchtspur, Rauchspur). */
  seg(col, P, Q, w0, w1, a, ext = null, a0 = 1) {
    this.push(P[0], P[1], P[2], a0, Q[0], Q[1], Q[2], 0, 0, 0, 0, w0, w1, ext ?? Math.max(w0, w1), 0, col, a, LINE);
  }

  /** Bild fertig: Gruppen von hinten nach vorn in die Instanzpuffer kopieren. */
  end() {
    const G = this.groups;
    const n = this.n;
    const ends = G.map((g, i) => (i + 1 < G.length ? G[i + 1].start : n));
    const order = G.map((_, i) => i).sort((a, b) => G[a].z - G[b].z || a - b);
    const src = this.stage;
    const dst = this.attrs.map((a) => a.array);
    let j = 0;
    for (const gi of order) {
      for (let p = G[gi].start; p < ends[gi]; p++, j++) {
        let i = p * STRIDE;
        for (let f = 0; f < LAYOUT.length; f++) {
          const k = LAYOUT[f][1];
          const d = dst[f];
          const o = j * k;
          for (let q = 0; q < k; q++) d[o + q] = src[i++];
        }
      }
    }
    for (let f = 0; f < this.attrs.length; f++) {
      const a = this.attrs[f];
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(1, j) * LAYOUT[f][1]);
      a.needsUpdate = true;
    }
    this.geometry.instanceCount = j;
    this.mesh.visible = j > 0;
  }

  /**
   * Rechteck der Teilchen in Gerätepixeln der Leinwand ({ x, y, w, h }, auf die Leinwand beschnitten) oder null: nur dieser Teil des
   * three-Bildes wird in die 2D-Leinwand kopiert. viewW, viewH: Bildgröße in CSS-Pixeln, dpr: Pixeldichte.
   */
  rect(viewW, viewH, dpr) {
    if (!this.count) return null;
    const [l, b, r, t] = this.box;
    const z = this.zoom;
    const x0 = Math.max(0, Math.floor((l * z + viewW / 2) * dpr) - 2);
    const x1 = Math.min(Math.round(viewW * dpr), Math.ceil((r * z + viewW / 2) * dpr) + 2);
    const y0 = Math.max(0, Math.floor((viewH / 2 - t * z) * dpr) - 2);
    const y1 = Math.min(Math.round(viewH * dpr), Math.ceil((viewH / 2 - b * z) * dpr) + 2);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  /** Teilchen dieses Bildes (Messung, Prüfskript). */
  get count() {
    return this.geometry.instanceCount;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------- Effekte (Maße wie die Iso-Maler in fx.js, Bildschirm-y nach unten → oy nach oben) ----------

const lerp3 = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t];
/** Bildschirm-px (CSS) → Welt-px bei diesem Zoom. */
const wpx = (fx, px) => px / fx.zoom;

/** Flugbahn von Funken und Brocken wie arc in explosionUp: [rechts, oben] nach t (0–1). */
const arc = (v, up, t, sp, S) => [Math.cos(v.a) * v.v * t * sp * S, -(-up * t * 46 + 40 * t * t) * S];

/** Explosion (explosionUp): Rauch, Blitz, Feuerball, heißer Kern, Brocken, Funken; Fußpunkt bei Höhe h. */
function explosion3d(fx, e, k, h) {
  const S = SIZE[e.snd] ?? 1;
  const P = partsOf(e);
  const q = ease(k);
  fx.group(e.x, e.y, h, BIAS.explosion * S);
  const cy = S * (5 + 15 * q); // Mitte des Feuerballs über dem Boden
  for (const s of P.smoke) {
    const d = S * (4 + 13 * q) * s.d;
    fx.blob('#3b3733', Math.cos(s.a) * d + k * S * 7, cy + S * (5 + 16 * k) * (0.4 + s.up * 0.6) - Math.sin(s.a) * d * 0.45, S * (7 + 14 * q) * s.s, smokeIn(k), PUFF);
  }
  if (k < 0.25) fx.blob('#fff6d8', 0, cy, S * (16 + 20 * k), 1 - k / 0.25);
  P.fire.forEach((fl, i) => {
    const d = S * (2 + 10 * q) * fl.d;
    fx.blob(fireCol(k, i), Math.cos(fl.a) * d, cy - Math.sin(fl.a) * d * 0.6 + fl.up * S * 5 * q, S * (4.5 + 7 * q) * fl.s, 0.95 * Math.pow(1 - k, 1.2), PUFF);
  });
  if (k < 0.4) fx.blob('#fff3c0', 0, cy, S * (5 + 5 * k), 1 - k / 0.4);
  if (S >= 1) {
    const a = Math.min(1, (1 - k) * 2.5) * clamp((k - 0.06) * 12, 0, 1); // erst nach dem Blitz sichtbar
    for (const d of P.debris) {
      const [dx, dy] = arc(d, d.up * 1.2, k, 56, S);
      fx.blob('#2a2622', dx, cy + dy, 1.4 * S * d.s, a, CHUNK, -(d.r + k * 9 * d.v));
    }
  }
  if (k <= 0.85) {
    const w = wpx(fx, Math.max(0.6, 1.1 * S)) / 2;
    const a = (1 - k / 0.85) * 0.95;
    const t0 = Math.max(0, k - 0.08);
    for (const sp of P.sparks) {
      const [ax, ay] = arc(sp, sp.up, t0, 52, S);
      const [bx, by] = arc(sp, sp.up, k, 52, S);
      fx.line([255, 214, 130], ax, cy + ay, bx, cy + by, w, w, a);
    }
  }
}

/** Leuchtspur (tracer in fx.js) von P nach Q (Weltpunkte): Schweif und glühender Kopf; pw = ein Bildschirm-px in Welt-px. */
function tracer3d(fx, P, Q, k, pw, flak) {
  const h = Math.min(1, k * 1.35);
  const t0 = Math.max(0, h - 0.45);
  const A = lerp3(P, Q, t0);
  const B = lerp3(P, Q, h);
  fx.seg(flak ? [255, 96, 40] : [255, 176, 64], A, B, 1.7 * pw, 1.7 * pw, 0.38);
  fx.seg(flak ? [255, 206, 160] : [255, 248, 214], lerp3(P, Q, t0 + (h - t0) * 0.45), B, 0.65 * pw, 0.65 * pw, flak ? 0.95 : 0.97);
}

/** Rauchband (ribbon in fx.js) entlang der Weltpunkte pts (ältester zuerst): hinten breit und durchsichtig, vorn schmal und dichter. */
function ribbon3d(fx, pts, w0, w1, a) {
  const n = pts.length;
  if (n < 2) return;
  const al = (u, v) => (u < 0.6 ? (v * 0.55 * u) / 0.6 : v * (0.55 + (0.45 * (u - 0.6)) / 0.4)); // Verlauf 0 → 0,55 → 1
  for (const [kk, v] of [[1.9, a * 0.3], [1, a]]) {
    for (let i = 0; i + 1 < n; i++) {
      const u0 = i / (n - 1);
      const u1 = (i + 1) / (n - 1);
      const b = al(u1, v);
      if (b <= 0.004) continue;
      const c = u1 < 1 ? [214, 211, 204] : [236, 233, 226];
      fx.seg(c, pts[i], pts[i + 1], ((w0 + (w1 - w0) * u0) * kk) / 2, ((w0 + (w1 - w0) * u1) * kk) / 2, b, 0, al(u0, v) / b);
    }
  }
}

/** Geschoss im Direktschuss (projectile): Kanone als dicke Leuchtspur, Rakete mit Rauchspur, Feuerstrahl und hellem Kopf. */
function projectile3d(fx, P, Q, k, pw, snd) {
  if (!MISSILE.test(snd ?? '')) return tracer3d(fx, P, Q, k, pw * 1.35, false);
  const h = Math.min(1, k * 1.15);
  ribbon3d(fx, [lerp3(P, Q, Math.max(0, h - 0.8)), lerp3(P, Q, Math.max(0, h - 0.35)), lerp3(P, Q, h)], 7 * pw, 1.6 * pw, 0.75 * (1 - k * 0.5));
  const H = lerp3(P, Q, h);
  fx.seg([255, 170, 60], lerp3(P, Q, Math.max(0, h - 0.06)), H, 1.1 * pw, 1.1 * pw, 0.9);
  fx.anchor(H[0], H[1], H[2]);
  fx.blob('#fff0c0', 0, 0, 3.4 * pw, 1);
}

/** Mündungsfeuer (muzzle): Schein, Stern aus Flammenspitzen in Schussrichtung (vx, vy in der Bildebene, null = nach oben), Kern. */
function muzzle3d(fx, k, s, vx, vy) {
  const a = 1 - k;
  fx.blob('#ffcf70', 0, 0, s * 2.2, 0.55 * a);
  const ang = vx === null ? Math.PI / 2 : Math.atan2(vy, vx);
  const L = s * (1.7 - 0.6 * k);
  for (const [g, l] of [[ang, 1.8], [ang + 0.75, 0.8], [ang - 0.75, 0.8], [ang + 2, 0.45], [ang - 2, 0.45]]) {
    fx.line([255, 222, 130], 0, 0, Math.cos(g) * L * l, Math.sin(g) * L * l, s * 0.35, 0, a, LINE, 0);
  }
  fx.blob('#fffbe8', 0, 0, s * 0.7, a);
}

/** Abfangen (intercept): Flakwolke, Blitz, Kern, Splitter; s = Größe, pw = Strichbreite in Welt-px. */
function intercept3d(fx, k, s, pw) {
  const a = 1 - k;
  const g = ease(Math.min(1, k * 2));
  fx.blob('#34312e', k * s * 0.5, k * s * 0.4, s * (0.7 + 1.1 * g), 0.85 * clamp(k * 6, 0, 1) * Math.pow(a, 0.6), PUFF);
  if (k < 0.35) fx.blob('#fff6d8', 0, 0, s * (1.1 + k * 1.4), 1 - k / 0.35);
  if (k < 0.2) fx.blob('#ffc65a', 0, 0, s * 0.55, 1 - k / 0.2);
  for (let i = 0; i < 7; i++) {
    const gg = (i / 7) * TAU + 0.4;
    const d0 = s * (0.4 + 1.6 * k);
    const d1 = d0 + s * 0.35;
    const dy = k * k * s;
    fx.line([255, 214, 150], Math.cos(gg) * d0, -(Math.sin(gg) * d0 + dy), Math.cos(gg) * d1, -(Math.sin(gg) * d1 + dy), pw / 2, pw / 2, a);
  }
}

/**
 * Ein Effekt aus game.effects (wie drawEffectUp): explosion, tracer, shell, intercept, muzzle. ground(x, y) = Höhe des Bodens
 * (Gelände, auf einer Brücke ihre Fahrbahn), wie screenAt der gemalten Fassung.
 */
export function effect3d(fx, e, ground) {
  const k = clamp(e.t / e.life, 0, 1);
  const f = fx.zoom;
  const h = ground(e.x, e.y);
  switch (e.type) {
    case 'explosion':
      explosion3d(fx, e, k, h);
      break;
    case 'tracer':
    case 'shell': {
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      const P = [e.x, e.y, h + GUN_H];
      const Q = [x2, y2, ground(x2, y2) + HIT_H];
      const pw = wpx(fx, Math.max(0.8, f * 0.9));
      fx.group((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2, BIAS.line);
      if (e.type === 'shell') projectile3d(fx, P, Q, k, pw, e.snd);
      else tracer3d(fx, P, Q, k, pw, FLAK.test(e.snd ?? ''));
      break;
    }
    case 'intercept':
      fx.group(e.x, e.y, h + AIRBURST_H, BIAS.intercept);
      intercept3d(fx, k, 10, wpx(fx, Math.max(0.8, f)));
      break;
    case 'muzzle': {
      const x2 = e.x2 ?? e.x;
      const y2 = e.y2 ?? e.y;
      const p = fx.view(e.x, e.y, h);
      const q = fx.view(x2, y2, ground(x2, y2));
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const far = Math.hypot(dx, dy) * f > 2 && e.snd !== 'mortar';
      fx.group(e.x, e.y, h + GUN_H, BIAS.muzzle);
      muzzle3d(fx, k, 4.2, far ? dx : null, far ? dy : null);
      break;
    }
    default:
      break;
  }
}

/** Mörsergranate in der Luft (drawShellIso): Bogen über dem Boden, Rauchspur, Glut hinter dem Kopf, dunkler Körper mit Glanz. */
export function shell3d(fx, s, ground) {
  const f = s.duration ? clamp(s.t / s.duration, 0, 1) : 0;
  const pts = [];
  for (let i = 6; i >= 0; i--) {
    const fi = f - i * 0.028;
    if (fi < 0) continue;
    const x = s.sx + (s.tx - s.sx) * fi;
    const y = s.sy + (s.ty - s.sy) * fi;
    pts.push([x, y, ground(x, y) + ARC(fi)]);
  }
  if (pts.length < 2) pts.unshift([s.sx, s.sy, ground(s.sx, s.sy) + ARC(0)]);
  const H = pts[pts.length - 1];
  const Q = pts[pts.length - 2];
  const u = wpx(fx, Math.max(1, 1.15 * fx.zoom));
  fx.group(H[0], H[1], H[2], BIAS.shell);
  ribbon3d(fx, pts, 6 * u, 1.4 * u, 0.6);
  const ph = fx.view(H[0], H[1], H[2]);
  const pq = fx.view(Q[0], Q[1], Q[2]);
  const l = Math.hypot(ph[0] - pq[0], ph[1] - pq[1]) || 1;
  const cx = (ph[0] - pq[0]) / l; // Flugrichtung in der Bildebene
  const cy = (ph[1] - pq[1]) / l;
  const nx = -cy; // senkrecht dazu (nach oben gedreht)
  const ny = cx;
  fx.anchor(H[0], H[1], H[2]);
  fx.blob('#ffc35c', -cx * 2.2 * u, -cy * 2.2 * u, 3.4 * u, 0.9);
  const body = (ox, oy, half, w, col, a) => fx.line(col, ox - cx * half, oy - cy * half, ox + cx * half, oy + cy * half, w, w, a, LINE, w);
  body(0, 0, 1.65 * u, 1.35 * u + wpx(fx, 0.4), [0, 0, 0], 0.65); // Umriss
  body(0, 0, 1.65 * u, 1.35 * u, '#2e302b', 1);
  body(cx * 0.4 * u + nx * 0.5 * u, cy * 0.4 * u + ny * 0.5 * u, 1.2 * u, 0.4 * u, [255, 255, 255], 0.35); // Glanz oben
}

/** Rauchsäule (drawSmoke): Schwaden steigen vom Fußpunkt, treiben nach rechts, werden größer und heller. s, k, t, seed wie dort. */
function column3d(fx, s, k, t, seed) {
  const n = 4 + Math.round(5 * k);
  const off = (Math.abs(seed) % 997) / 997;
  const list = [];
  for (let i = 0; i < n; i++) list.push((t * 0.22 + i / n + off) % 1);
  list.sort((a, b) => b - a); // alte (hohe) Schwaden zuerst, die jungen dunklen am Fuß davor
  for (const ph of list) {
    const r = s * (0.6 + 1.8 * ph);
    const a = (0.45 + 0.5 * k) * Math.pow(1 - ph, 1.05) * Math.min(1, ph * 7);
    fx.blob(ph < 0.2 ? '#2e2c29' : ph < 0.5 ? '#54504c' : '#8a8782', s * (2.2 * ph + 0.4 * Math.sin(ph * 6 + off * 40)), s * 6.2 * ph, r * 1.25, a, LIT);
  }
}

/** Staub am Bagger (drawDust): ruhiger Kern am Boden, Schwaden quellen auf und steigen ein wenig. */
function dust3d(fx, s, k, t, seed) {
  const off = ((Math.abs(seed) % 997) / 997) * TAU;
  fx.blob('#8f8170', 0, s * 0.1, s * 0.8, 0.7 * k, LIT);
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.55 + i / 7 + off / TAU) % 1;
    const g = off + i * 0.9;
    const a = 0.85 * k * (1 - ph) * Math.min(1, ph * 5);
    fx.blob(i % 3 === 0 ? '#7e715f' : i % 3 === 1 ? '#a39580' : '#c2b6a2', Math.cos(g) * s * (0.2 + 0.7 * ph), -Math.sin(g) * s * 0.3 + s * 0.8 * ph, s * (0.5 + 0.6 * ph), a, LIT);
  }
}

/** Nebelwand (drawSmokeScreen): helle Schwaden wälzen sich am Ort. */
function screen3d(fx, s, k, t, seed) {
  const off = ((Math.abs(seed) % 997) / 997) * TAU;
  for (let i = 0; i < 4; i++) {
    const g = off + i * 1.7 + t * 0.15 * (i % 2 ? 1 : -1);
    const ox = Math.cos(g) * s * 0.45 + Math.sin(t * 0.4 + i) * s * 0.1;
    const oy = -Math.sin(g) * s * 0.3 + s * (0.15 + 0.12 * i);
    fx.blob(i < 2 ? '#b9b6ae' : '#e4e1da', ox, oy, s * (1.05 + 0.2 * Math.sin(t * 0.7 + i * 2 + off)), 0.55 * k, LIT);
  }
}

/** Feuer (drawFire): Lichtschein, vier flackernde Flammenzungen (rot, orange, gelb), aufsteigende Glut. s = Größe in Welt-px. */
function fire3d(fx, s, t, seed) {
  const off = (Math.abs(seed) % 101) * 0.7;
  fx.blob('#ff9a3c', 0, s * 0.5, s * 2.1, 0.26 + 0.07 * Math.sin(t * 13 + off));
  for (let i = 0; i < 4; i++) {
    const c = Math.abs(i - 1.5);
    const fl = 0.7 + 0.3 * Math.sin(t * (9 + i * 2.7) + off + i * 1.7);
    const h = s * (1.55 - c * 0.38) * fl;
    const w = s * (0.34 - c * 0.06);
    const x = (i - 1.5) * s * 0.3;
    const sway = Math.sin(t * 7 + i * 1.3 + off) * s * 0.14;
    fx.line('#d2401a', x, 0, x + sway, h, w, w, 0.85, FLAME);
    fx.line('#f2862a', x, 0, x + sway * 0.8, h * 0.74, w * 0.72, w * 0.72, 0.85, FLAME);
    fx.line('#ffd66e', x, 0, x + sway * 0.6, h * 0.46, w * 0.42, w * 0.42, 0.9, FLAME);
  }
  for (let j = 0; j < 4; j++) {
    const ph = (t * 0.55 + j / 4 + off) % 1;
    const r = Math.max(wpx(fx, 0.35), s * 0.07) * (1 - ph * 0.6);
    fx.blob('#ffb347', Math.sin(j * 2.3 + off + ph * 3) * s * 0.5 + ph * s * 0.4, s * (1 + 3 * ph), r, (1 - ph) * 0.9, DISC);
  }
}

/**
 * Eine Rauchquelle (Renderer.smokeSources, ohne Minen): Rauchsäule mit Feuer (brennende Gebäude, Häuser, Fahrzeuge, Wracks), Staub,
 * Nebelwand. Fußpunkt bei Bodenhöhe + q.lift; t = Zeit in s.
 */
export function smoke3d(fx, q, t, ground) {
  if (q.mine) return;
  const bias = q.unit ? BIAS.unit : q.screen || q.dust ? q.s * BIAS.low : q.s * BIAS.column;
  fx.group(q.x, q.y, ground(q.x, q.y) + q.lift, bias);
  if (q.screen) return screen3d(fx, q.s, q.k, t, q.seed);
  if (q.dust) return dust3d(fx, q.s, q.k, t, q.seed);
  if (q.fire) fire3d(fx, q.s * 0.7, t, q.seed);
  column3d(fx, q.s, q.k, t, q.seed);
}
