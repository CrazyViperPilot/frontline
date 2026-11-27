// Wetter in 3D (Plan „3D mit three.js“, Paket „Wetter 3D“): ersetzt in der Ansicht 3D den gemalten Durchlauf „Wetter“ (render/weatherfx.js)
// durch Teilchen in echter Tiefe. Regen (Striche, die auf das Gelände fallen, mit Ringen am Boden) und Schnee (weiche Flocken, die in
// Böen treiben und taumeln) sind je ein Draw-Call aus InstancedBufferGeometry; Nebel sind Nebelbänke als Höhennebel: vier Lagen über dem
// Gelände (3, 14, 30 und 52 px), Dichte aus ziehendem Rauschen, in einem Draw-Call (Instanz je Lage). Alles hat Tiefentest gegen den
// Tiefenpuffer des Durchlaufs „Objekte“: Gebäude, Einheiten und Bäume davor verdecken Tropfen und Nebel, was dahinter steht, bleibt im Dunst.
// Nasser Boden: ground3d.js und kit3d.js bekommen `uWet` (dunkler, satter, Pfützen spiegeln den Himmel, Glanz in der Sonne), siehe wetGround.
//
// Kein Zustand außer festen Zufallswerten je Teilchen (makeRng mit festem Startwert, nie game.rng): die Lage jedes Teilchens rechnet der
// Vertex-Shader aus Zeit und Zufallswert. Teilchen sind an die Welt gebunden (Kachel in Bildachsen, am Rand umgebrochen), nicht ans Bild:
// beim Schieben der Karte ziehen sie mit dem Gelände. Die Kachel (`tileFor`) deckt das, was im Bild sichtbar ist, samt Geländehöhe.
// Bildachsen: a = rechts im Bild, b = zum Betrachter (Einheitsvektoren in Weltachsen, wie syncIsoCamera). Ein Punkt der Höhe z liegt im
// Bild um z · Zoom höher, ein Bodenpunkt im Abstand d zum Betrachter um d/2 · Zoom tiefer: sichtbar ist b ∈ [−2hh + 2z, 2hh + 2z].
// Stärke und Übergang folgen game.weather (weatherShares); Wirkung auf das Spiel steht in js/game/weather.js, Zufall der Darstellung ist eigen.
import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng } from '../core/rng.js';
import { ROT } from '../render/camera.js';
import { windDrift } from '../render/weatherfx.js';
import { BALANCE } from '../data/balance.js';
import { FINE_N, RELIEF } from '../game/relief.js';

const W = BALANCE.map.width;
const STEP = RELIEF.step;
export const MAX_RAIN = 6000; // Tropfen im Puffer (Kachel größer als das Bild: nur ein Teil ist sichtbar)
export const MAX_SNOW = 5000;
export const MAX_SPLASH = 2600;
const LAYERS = [3, 14, 30, 52]; // Höhe der Nebellagen über dem Gelände (px); Dichte nimmt nach oben ab
const MARGIN = 90; // Rand der Kachel über das Bild hinaus (px): Wind trägt Teilchen bis dorthin, ohne dass man den Umbruch sieht
const TOP_RAIN = 230; // Fallhöhe (px über dem Gelände)
const TOP_SNOW = 260;
const FALL_RAIN = 640; // Fallgeschwindigkeit (px/s), nahe Tropfen etwas schneller
const SLANT = 0.17; // Neigung der Tropfen (Weg zur Seite je Weg nach unten), Wind nach rechts im Bild
// Dichte: so viele Teilchen im Bild je Bildschirmfläche (px² je Teilchen), wie bei gemalt (weatherfx.js: 2000 und 1700 px² je Strich bzw. Flocke)
const AREA_RAIN = 1300;
const AREA_SNOW = 1100;
const AREA_SPLASH = 4200;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Anteile der Wetterarten am Bild (Übergang: das alte blendet aus, das neue ein) und Nässe des Bodens (Regen voll, Nebel feucht).
 * Ohne Wetter alles 0.
 */
export function weatherShares(w) {
  if (!w?.on) return { rain: 0, snow: 0, fog: 0, wet: 0 };
  const share = (kind) => (w.kind === kind ? w.mix : 0) + (w.prev === kind ? 1 - w.mix : 0);
  const rain = share('rain');
  const snow = share('snow');
  const fog = share('fog');
  return { rain, snow, fog, wet: clamp(rain + 0.35 * fog, 0, 1) };
}

/**
 * Bildachsen der Ansicht: Mitte (cx, cy), a = rechts im Bild, b = zum Betrachter (Einheitsvektoren), halbe Bildbreite hw und -höhe hh in
 * Welt-px (viewW / 2 / Zoom). Gleiche Formeln wie camera3d.js syncIsoCamera.
 */
export function viewFrame(cam) {
  const [ra, rb, rc, rd] = ROT[cam.rot];
  const k = Math.SQRT1_2;
  const R = [(ra - rc) * k, (rb - rd) * k];
  const T = [(ra + rc) * k, (rb + rd) * k];
  return { cx: cam.x, cy: cam.y, R, T, hw: cam.viewW / (2 * cam.zoom), hh: cam.viewH / (2 * cam.zoom), ca: cam.x * R[0] + cam.y * R[1], cb: cam.x * T[0] + cam.y * T[1] };
}

/** Geländehöhe (Mindest- und Höchstwert) im Bildausschnitt: Raster aus Stichproben über den Bodenausschnitt, zweimal (Höhe verschiebt den Ausschnitt). */
export function heightRange(frame, heightAt, n = 7) {
  let lo = Infinity;
  let hi = -Infinity;
  let top = 0;
  for (let pass = 0; pass < 2; pass++) {
    lo = Infinity;
    hi = -Infinity;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = frame.ca + (i / (n - 1) - 0.5) * 2 * (frame.hw + MARGIN);
        const b = frame.cb + -2 * frame.hh - MARGIN + (j / (n - 1)) * (4 * frame.hh + 2 * MARGIN + 2 * top);
        const x = a * frame.R[0] + b * frame.T[0];
        const y = a * frame.R[1] + b * frame.T[1];
        const h = heightAt(x, y);
        if (Number.isFinite(h)) {
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      }
    }
    top = Math.max(0, hi);
  }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 0 };
  return { lo: Math.max(0, lo), hi: Math.max(lo, hi) };
}

/**
 * Kachel der Teilchen in Bildachsen: [a0, b0, Länge a, Länge b] so, dass jeder Punkt zwischen den Höhen zLo und zHi, der im Bild liegen kann,
 * darin liegt. zLo, zHi: tiefster und höchster Punkt der Teilchen (Welt-Höhe).
 */
export function tileFor(frame, zLo, zHi, margin = MARGIN) {
  const a0 = frame.ca - frame.hw - margin;
  const b0 = frame.cb - 2 * frame.hh - margin + 2 * zLo;
  const b1 = frame.cb + 2 * frame.hh + margin + 2 * zHi;
  return [a0, b0, 2 * (frame.hw + margin), b1 - b0];
}

/** Zahl der Teilchen, damit im Bild etwa areaScreen / areaEach · share zu sehen sind; Anteil im Bild = Bildhöhe (4hh) / Länge b der Kachel. */
export function particleCount(share, cssW, cssH, areaEach, tile, hh, max) {
  if (share <= 0.002) return 0;
  const f = clamp((4 * hh) / tile[3], 0.1, 1);
  return Math.min(max, Math.round(((cssW * cssH) / areaEach / f) * share));
}

/** Feste Zufallswerte je Teilchen (4 je Teilchen, [0, 1)): Lage, Größe und Phase; eigener Zufall mit festem Startwert, nie game.rng. */
export function seedData(n, seed = 0x3d47) {
  const rng = makeRng(seed);
  const a = new Float32Array(n * 4);
  for (let i = 0; i < a.length; i++) a[i] = rng.next();
  return a;
}

// ---------- Shader ----------

// Gemeinsam: Kachel in Bildachsen → Welt, Geländehöhe aus der Höhentextur (R8, linear)
const COMMON = `
uniform vec4 uTile;   // a0, b0, Länge a, Länge b (Bildachsen)
uniform vec2 uAx;     // Einheitsvektor a (rechts im Bild) in Weltachsen
uniform vec2 uBx;     // Einheitsvektor b (zum Betrachter)
uniform sampler2D uHm;
uniform vec4 uHmap;   // Höhe min, Höhe Spanne, Skala (1 / Kartenbreite · (N − 1) / N), Versatz (halbes Texel)
uniform float uTime;
float groundAt(vec2 xy) { return uHmap.x + uHmap.y * texture2D(uHm, clamp(xy * uHmap.z + uHmap.w, 0.0, 1.0)).r; }
vec2 hash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
vec2 wrapTile(vec2 raw) { return uTile.xy + mod(raw - uTile.xy, uTile.zw); } // Welt gebunden: Lage mod Kachel
vec2 toWorld(vec2 ab) { return ab.x * uAx + ab.y * uBx; }
`;

const VS_RAIN = `${COMMON}
attribute vec4 aSeed;
uniform float uTop;
uniform float uFall;
uniform float uSlant;
uniform float uPx;    // CSS-Pixel in Ansichts-Einheiten (1 / Zoom)
uniform float uPxDev; // Gerätepixel in Ansichts-Einheiten
uniform float uAlpha;
varying float vA;
varying vec2 vUv;
void main() {
  float c = aSeed.z;
  float fall = uFall * (0.82 + 0.36 * c);
  float ph = aSeed.w * 13.0 + uTime * fall / uTop;
  float cyc = floor(ph);
  float s = ph - cyc; // 0 oben … 1 am Boden
  vec2 raw = hash2(aSeed.xy * 91.7 + cyc * vec2(0.618, 0.317)) * uTile.zw;
  vec2 ab = wrapTile(raw);
  ab.x += uSlant * uTop * s; // Wind trägt den Tropfen auf dem Weg nach unten zur Seite
  vec2 xy = toWorld(ab);
  float z = groundAt(xy) + uTop * (1.0 - s);
  float lenT = 0.015 + 0.02 * c;
  vec3 head = vec3(xy, z);
  vec3 tail = vec3(xy - uAx * (uSlant * fall * lenT), z + fall * lenT);
  vec4 A = modelViewMatrix * vec4(head, 1.0);
  vec4 B = modelViewMatrix * vec4(tail, 1.0);
  vec2 d = B.xy - A.xy;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = (0.8 + 0.8 * c) * uPx;
  float hw = max(0.5 * w, 0.5 * uPxDev);
  vec2 p = mix(A.xy, B.xy, position.x) + nrm * position.y * hw;
  gl_Position = projectionMatrix * vec4(p, mix(A.z, B.z, position.x), 1.0);
  vA = uAlpha * mix(0.3, 0.65, c) * (0.5 * w / hw) * smoothstep(0.0, 0.07, s) * (1.0 - smoothstep(0.95, 1.0, s)) * (1.0 - 0.6 * position.x);
  vUv = vec2(position.x, position.y);
}`;

const FS_RAIN = `
varying float vA;
varying vec2 vUv;
void main() {
  float a = vA * (1.0 - smoothstep(0.45, 1.0, abs(vUv.y)));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.808, 0.855, 0.925) * a, a); // vormultipliert
}`;

const VS_SNOW = `${COMMON}
attribute vec4 aSeed;
uniform float uTop;
uniform float uDrift;   // Weg des Windes bis jetzt (px, stetig)
uniform float uPxDev;
uniform float uAlpha;
varying float vA;
varying vec2 vUv;
varying float vC;
void main() {
  float c = aSeed.z;
  float fall = mix(22.0, 64.0, c);
  float ph = aSeed.w * 13.0 + uTime * fall / uTop;
  float cyc = floor(ph);
  float s = ph - cyc;
  vec2 raw = hash2(aSeed.xy * 57.3 + cyc * vec2(0.414, 0.732)) * uTile.zw;
  float sway = sin(uTime * (0.7 + c) + aSeed.x * 40.0) * (4.0 + 10.0 * c); // taumeln
  raw.x += uDrift * (0.4 + c) + sway; // nahe Flocken treiben schneller
  vec2 ab = wrapTile(raw);
  vec2 xy = toWorld(ab);
  float z = groundAt(xy) + uTop * (1.0 - s);
  float r = max(mix(1.5, 5.4, c * c), 0.9 * uPxDev);
  vec4 A = modelViewMatrix * vec4(xy, z, 1.0);
  A.xy += position.xy * r;
  gl_Position = projectionMatrix * A;
  vA = uAlpha * mix(0.78, 0.92, c) * smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.94, 1.0, s));
  vUv = position.xy;
  vC = c;
}`;

const FS_SNOW = `
varying float vA;
varying vec2 vUv;
varying float vC;
void main() {
  float d = length(vUv);
  if (d >= 1.0) discard;
  float a = vA * (1.0 - smoothstep(0.35, 1.0, d));
  vec3 col = mix(vec3(0.985, 0.99, 1.0), vec3(0.84, 0.89, 0.97), smoothstep(0.3, 1.0, d)); // zarter kühler Rand: auf Schnee sichtbar
  gl_FragColor = vec4(col * a, a);
}`;

// Ringe am Boden: wo der Tropfen aufschlägt, geht ein Ring auf und verblasst (wie gemalt: Lebensdauer 45 % des Umlaufs)
const VS_SPLASH = `${COMMON}
attribute vec4 aSeed;
uniform float uPx;
uniform float uPxDev;
uniform float uAlpha;
varying float vA;
varying vec2 vP;
varying float vRho;
varying float vEdge;
void main() {
  float c = aSeed.z;
  float ph = uTime / (0.5 + 0.35 * c) + aSeed.x * 7.0;
  float cyc = floor(ph);
  float g = (ph - cyc) / 0.45;
  if (g >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vA = 0.0; vP = vec2(0.0); vRho = 0.0; vEdge = 1.0;
    return;
  }
  vec2 raw = hash2(aSeed.yw * 73.1 + cyc * vec2(0.271, 0.853)) * uTile.zw;
  vec2 xy = toWorld(wrapTile(raw));
  float rho = 1.2 + 5.5 * g;
  float edge = 1.2 * uPxDev;
  float q = rho + edge + 0.5 * uPx;
  vec3 pos = vec3(xy + position.xy * q, groundAt(xy) + 0.6);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vA = uAlpha * (g < 0.5 ? 0.5 : 0.24);
  vP = position.xy * q;
  vRho = rho;
  vEdge = edge;
}`;

const FS_SPLASH = `
uniform float uPx;
varying float vA;
varying vec2 vP;
varying float vRho;
varying float vEdge;
void main() {
  float d = abs(length(vP) - vRho);
  float hw = 0.45 * uPx;
  float a = vA * (1.0 - smoothstep(hw, hw + vEdge, d));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.847, 0.894, 0.957) * a, a);
}`;

// Nebelbänke: Gitter über der Kachel, je Lage (Instanz) auf Geländehöhe + Lagenhöhe; Dichte aus zwei Lagen ziehenden Rauschens. Die Dichte
// rechnet der Vertex-Shader (Gitter 112 × 64, Rauschen ist weich), das Fragment gibt nur die Farbe aus: der Nebel füllt das ganze Bild
// in vier Lagen, Füllrate kostet sonst am meisten (Software-WebGL: 4 Lagen mit zwei Rauschzugriffen je Punkt gut 130 ms).
const VS_FOG = `${COMMON}
attribute float aLayer;
uniform vec4 uLH; // Höhen der vier Lagen
uniform sampler2D uNoise;
uniform float uFog;
varying vec4 vC;
float nz(vec2 p, float s) { return texture2D(uNoise, p / (256.0 * s)).a; }
void main() {
  vec2 ab = uTile.xy + position.xy * uTile.zw;
  vec2 xy = toWorld(ab);
  float h = aLayer < 0.5 ? uLH.x : aLayer < 1.5 ? uLH.y : aLayer < 2.5 ? uLH.z : uLH.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xy, groundAt(xy) + h, 1.0);
  vec2 o = vec2(173.0, 71.0) * aLayer; // jede Lage eigenes Rauschen: keine Säulen über einer Bank
  float n1 = nz(xy + o + vec2(uTime * 9.0, uTime * 4.0), 11.0);
  float n2 = nz(xy * 1.3 + o - vec2(uTime * 6.0, -uTime * 3.0) + 411.0, 4.0);
  float bank = smoothstep(0.40, 0.74, 0.62 * n1 + 0.38 * n2);
  float w = aLayer < 0.5 ? 1.0 : aLayer < 1.5 ? 0.85 : aLayer < 2.5 ? 0.6 : 0.36; // unten dichter
  float far = 1.28 - 0.5 * position.y; // fern (oben im Bild, kleines b) dichter
  float a = clamp(uFog * w * (0.05 + 0.25 * bank) * far, 0.0, 0.9);
  vC = vec4(mix(vec3(0.775, 0.808, 0.816), vec3(0.85, 0.87, 0.88), bank) * a, a); // vormultipliert
}`;

const FS_FOG = `
varying vec4 vC;
void main() { gl_FragColor = vC; }`;

// ---------- Nasser Boden ----------

/**
 * Boden-Shader (FS_GROUND bzw. FS_GROUND3D aus ground3d.js) um nassen Boden erweitern: uWet 0 … 1 (Regen voll, Nebel feucht), dunkler und
 * satter, ruhige flache Flecken (Pfützen) spiegeln den Himmel (uSky, Fresnel mit uEye), Glanz der Sonne (uSun, uLight); im Winter gedämpft.
 */
export function wetGround(fs) {
  const head = 'uniform float uWet;\nuniform vec3 uEye;\nuniform vec3 uSky;\nuniform vec3 uSun;\n';
  const wet = `
  if (uWet > 0.001 && uSkirt < 0.5 && vH >= uWater) {
    float wk = uWet * (1.0 - 0.55 * uSnow);
    float calm = 1.0 - smoothstep(0.03, 0.14, slope);
    float pn = 0.55 * nz(vPos + 1500.0, 5.0) + 0.45 * nz(vPos + 2600.0, 1.8);
    float pud = smoothstep(0.60, 0.72, pn) * calm * (1.0 - rk) * wk;
    col *= 1.0 - 0.24 * wk;
    float lum = dot(col, vec3(0.30, 0.59, 0.11));
    col = mix(vec3(lum), col, 1.0 + 0.22 * wk);
    float ct = clamp(dot(n, uEye), 0.0, 1.0);
    float fr = 0.05 + 0.55 * pow(1.0 - ct, 3.0);
    col = mix(col, uSky * 0.85, pud * (0.35 + fr));
    float sp = max(dot(reflect(-uLight, n), uEye), 0.0);
    col += uSun * (0.16 * pow(sp, 14.0) * (1.0 - rk) * wk + 0.65 * pud * pow(sp, 90.0));
  }
  gl_FragColor = vec4(col, 1.0);`;
  return fs.replace('uniform float uSkirt;', 'uniform float uSkirt;\n' + head).replace('  gl_FragColor = vec4(col, 1.0);\n}', wet + '\n}');
}

// ---------- Weather3D ----------

const matOf = (vs, fs, uniforms) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide });

/** Viereck als Instanzvorlage: Strich (x 0 … 1 entlang, y −1 … 1 quer) bzw. Fleck (x, y −1 … 1). */
const quad = (stroke) => {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stroke ? [0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0] : [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
};

export class Weather3D {
  /** noise: Rauschtextur des Bodens (ground3d.uniforms.uNoise.value), mit geteilt. */
  constructor(noise) {
    this.seed = new THREE.InstancedBufferAttribute(seedData(MAX_RAIN), 4);
    this.hm = new THREE.DataTexture(new Uint8Array(FINE_N * FINE_N), FINE_N, FINE_N, THREE.RedFormat, THREE.UnsignedByteType);
    this.hm.magFilter = this.hm.minFilter = THREE.LinearFilter;
    this.hm.wrapS = this.hm.wrapT = THREE.ClampToEdgeWrapping;
    this.hm.generateMipmaps = false;
    this.hm.unpackAlignment = 1;
    this.hm.colorSpace = THREE.NoColorSpace;
    const N = FINE_N;
    this.u = {
      uAx: { value: new THREE.Vector2(1, 0) },
      uBx: { value: new THREE.Vector2(0, 1) },
      uHm: { value: this.hm },
      uHmap: { value: new THREE.Vector4(0, 1, (N - 1) / N / W, 0.5 / N) },
      uTime: { value: 0 },
    };
    const U = (extra) => ({ ...this.u, uTile: { value: new THREE.Vector4() }, ...extra }); // Kachel je Netz, der Rest geteilt
    this.rainU = U({ uTop: { value: TOP_RAIN }, uFall: { value: FALL_RAIN }, uSlant: { value: SLANT }, uPx: { value: 1 }, uPxDev: { value: 1 }, uAlpha: { value: 1 } });
    this.snowU = U({ uTop: { value: TOP_SNOW }, uDrift: { value: 0 }, uPxDev: { value: 1 }, uAlpha: { value: 1 } });
    this.splashU = U({ uPx: { value: 1 }, uPxDev: { value: 1 }, uAlpha: { value: 1 } });
    this.fogU = U({ uNoise: { value: noise }, uFog: { value: 0 }, uLH: { value: new THREE.Vector4(...LAYERS) } });
    const inst = (stroke) => {
      const g = quad(stroke);
      g.setAttribute('aSeed', this.seed);
      g.instanceCount = 0;
      return g;
    };
    this.rain = new THREE.Mesh(inst(true), matOf(VS_RAIN, FS_RAIN, this.rainU));
    this.snow = new THREE.Mesh(inst(false), matOf(VS_SNOW, FS_SNOW, this.snowU));
    this.splash = new THREE.Mesh(inst(false), matOf(VS_SPLASH, FS_SPLASH, this.splashU));
    // Nebelbänke: Gitter 112 × 64 Zellen, vier Lagen als Instanzen
    const gx = 112;
    const gy = 64;
    const pos = new Float32Array((gx + 1) * (gy + 1) * 3);
    for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) pos.set([i / gx, j / gy, 0], (j * (gx + 1) + i) * 3);
    const idx = [];
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const a = j * (gx + 1) + i;
        idx.push(a, a + 1, a + gx + 1, a + 1, a + gx + 2, a + gx + 1);
      }
    }
    const fg = new THREE.InstancedBufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    fg.setIndex(idx);
    fg.setAttribute('aLayer', new THREE.InstancedBufferAttribute(new Float32Array(LAYERS.map((_, i) => i)), 1));
    fg.instanceCount = LAYERS.length;
    this.fog = new THREE.Mesh(fg, matOf(VS_FOG, FS_FOG, this.fogU));
    this.splash.renderOrder = 1;
    this.rain.renderOrder = 2;
    this.snow.renderOrder = 3;
    this.group = new THREE.Group();
    this.group.name = 'wetter';
    for (const m of [this.fog, this.splash, this.rain, this.snow]) {
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
    }
    this.relief = null;
    this.version = -1;
    this.stats = { rain: 0, snow: 0, splash: 0, fog: 0 };
  }

  /** Höhentextur aus relief.fine (sichtbare Höhe: Seen als Wasserspiegel), nur bei geändertem Gelände. */
  setRelief(relief) {
    if (relief === this.relief && relief.version === this.version) return;
    const F = relief.fine;
    const water = RELIEF.water;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < F.length; i++) {
      const h = Math.max(F[i], water);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    const span = Math.max(1, hi - lo);
    const data = this.hm.image.data;
    for (let i = 0; i < F.length; i++) data[i] = Math.round(((Math.max(F[i], water) - lo) / span) * 255);
    this.hm.needsUpdate = true;
    const v = this.u.uHmap.value;
    v.x = lo;
    v.y = span;
    this.relief = relief;
    this.version = relief.version;
  }

  /**
   * Ein Bild vorbereiten: Uniformen, Kachel und Teilchenzahl aus Kamera (Bildmitte, Zoom, Drehung, viewW/viewH), Gelände, Wetter und Zeit
   * (s). dpr: Pixeldichte. Gibt die Anteile zurück ({ rain, snow, fog, wet }); alle 0: nichts zu zeichnen (die Netze sind dann unsichtbar).
   */
  update(cam, relief, weather, t, dpr) {
    const sh = weatherShares(weather);
    const rain = sh.rain > 0.01 ? sh.rain : 0;
    const snow = sh.snow > 0.01 ? sh.snow : 0;
    const fog = sh.fog > 0.01 ? sh.fog : 0;
    this.rain.visible = this.splash.visible = rain > 0;
    this.snow.visible = snow > 0;
    this.fog.visible = fog > 0;
    this.stats = { rain: 0, snow: 0, splash: 0, fog: fog > 0 ? LAYERS.length : 0 };
    this.rain.geometry.instanceCount = this.splash.geometry.instanceCount = this.snow.geometry.instanceCount = 0;
    if (!(rain || snow || fog) || !relief) return sh;
    this.setRelief(relief);
    const frame = viewFrame(cam);
    const { lo, hi } = heightRange(frame, (x, y) => relief.displayAt(x, y));
    const u = this.u;
    u.uAx.value.set(frame.R[0], frame.R[1]);
    u.uBx.value.set(frame.T[0], frame.T[1]);
    u.uTime.value = t;
    const px = 1 / cam.zoom;
    const pxDev = px / dpr;
    const cssW = cam.viewW;
    const cssH = cam.viewH;
    if (rain) {
      const tile = tileFor(frame, lo, hi + TOP_RAIN);
      this.rainU.uTile.value.set(...tile);
      const nR = particleCount(rain, cssW, cssH, AREA_RAIN, tile, frame.hh, MAX_RAIN);
      this.rain.geometry.instanceCount = nR;
      this.rainU.uPx.value = this.splashU.uPx.value = px;
      this.rainU.uPxDev.value = this.splashU.uPxDev.value = pxDev;
      this.rainU.uAlpha.value = this.splashU.uAlpha.value = Math.min(1, rain * 1.4);
      const gt = tileFor(frame, lo, hi);
      const nS = particleCount(rain, cssW, cssH, AREA_SPLASH, gt, frame.hh, MAX_SPLASH);
      this.splash.geometry.instanceCount = nS;
      this.splashU.uTile.value.set(...gt);
      this.stats.rain = nR;
      this.stats.splash = nS;
    }
    if (snow) {
      const tile = tileFor(frame, lo, hi + TOP_SNOW);
      this.snowU.uTile.value.set(...tile);
      const nF = particleCount(snow, cssW, cssH, AREA_SNOW, tile, frame.hh, MAX_SNOW);
      this.snow.geometry.instanceCount = nF;
      this.snowU.uPxDev.value = pxDev;
      this.snowU.uAlpha.value = Math.min(1, snow * 1.5);
      this.snowU.uDrift.value = windDrift(t);
      this.stats.snow = nF;
    }
    if (fog) {
      this.fogU.uTile.value.set(...tileFor(frame, lo, hi + LAYERS[LAYERS.length - 1]));
      this.fogU.uFog.value = fog;
    }
    return sh;
  }

  dispose() {
    for (const m of [this.fog, this.splash, this.rain, this.snow]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    this.hm.dispose();
  }
}
