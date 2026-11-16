// Kriegsnebel als Canvas-Ebene: Nebelzellen-Bild für Minimap und Geräte ohne WebGL, Farbverlauf, Weichzeichnung; Zähler für den
// WebGL-Nebel (ground.js). Exporte: makeFogLayer, fogTone, blur121, updateFogLayer, nextFogStamp.
import { FOG_EXPLORED_ALPHA } from '../ground.js';

/** Off-screen-Canvas in Nebelzellen-Größe (173 × 173) mit ImageData; clouds = false: ohne Wolken (Minimap, dort wäre es Rauschen). */
export function makeFogLayer(fog, clouds = true) {
  const canvas = document.createElement('canvas');
  canvas.width = fog.cols;
  canvas.height = fog.rows;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx, image: ctx.createImageData(fog.cols, fog.rows), clouds };
}

// Kriegsnebel (seit v5.49 gemalt, Daniels Wunsch „schaue welche Assets noch nicht verbessert wurden“): Unerforschtes liegt unter einer
// dunklen Wolkendecke mit weichen hellen und dunklen Flecken statt flach schwarz, Erkundetes ist kühl abgedunkelt, am Übergang ein
// heller Wolkensaum; der Rand ist weichgezeichnet, damit keine Treppen aus 64-px-Zellen bleiben. Mit WebGL zeichnet ground.js (FS_FOG)
// den Nebel in Iso und 2D (ziehende Wolken); hier der Canvas-Weg für die Minimap und Geräte ohne WebGL (feste Wolkenflecken).
const FOG_DIM = [8, 12, 20]; // erkundet
const FOG_DEEP = [5, 7, 9]; // Wolken dunkel …
const FOG_LIGHT = [24, 27, 33]; // … und hell
const FOG_RIM = [15, 17, 18]; // heller Saum am Rand des Unerforschten

/** Wolken je Nebelzelle (Stufe 0 … 15, fest): weiches Wertrauschen über zwei Maßstäbe. */
export function fogTone(cols, rows) {
  const out = new Uint8Array(cols * rows);
  const h = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vn = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out[r * cols + c] = Math.min(15, Math.floor((vn(c / 6, r / 6) * 0.65 + vn(c / 2.5 + 17, r / 2.5 + 5) * 0.35) * 16));
  }
  return out;
}

let fogStamp = 0; // zählt jeden neu gerechneten WebGL-Nebel (über alle Renderer), ground.js lädt die Textur nur dann neu
/** Nächste Kennung für den WebGL-Nebel (Zähler über alle Renderer; ein ES-Modul-Export kann von außen nicht verändert werden). */
export function nextFogStamp() {
  return ++fogStamp;
}

/** Weichzeichnen 1-2-1 waagrecht (nach tmp), dann senkrecht (zurück nach a); k Werte je Zelle, verschachtelt. Liefert a. */
export function blur121(a, tmp, cols, rows, k = 1) {
  const line = cols * k;
  for (let r = 0; r < rows; r++) {
    const o = r * line;
    for (let j = 0; j < line; j++) {
      const i = o + j;
      tmp[i] = (a[j < k ? i : i - k] + 2 * a[i] + a[j >= line - k ? i : i + k] + 2) >> 2;
    }
  }
  for (let r = 0; r < rows; r++) {
    const o = r * line;
    const up = r > 0 ? -line : 0;
    const dn = r < rows - 1 ? line : 0;
    for (let j = 0; j < line; j++) {
      const i = o + j;
      a[i] = (tmp[i + up] + 2 * tmp[i] + tmp[i + dn] + 2) >> 2;
    }
  }
  return a;
}

/**
 * Füllt die Nebelschicht aus fog.visible / fog.explored (Canvas-Weg: Minimap und ohne WebGL; seit v5.49 weicher Rand, Wolken,
 * heller Saum). reveal = alles sichtbar.
 */
export function updateFogLayer(layer, fog, reveal) {
  const d = layer.image.data;
  const cols = fog.cols;
  const rows = fog.rows;
  const n = cols * rows;
  if (!layer.a || layer.a.length !== n) {
    layer.a = new Uint8Array(n);
    layer.b = new Uint8Array(n);
    layer.tone = layer.clouds === false ? new Uint8Array(n).fill(5) : fogTone(cols, rows);
    layer.lut = fogLut();
  }
  // nur neu malen, wenn sich der Nebel geändert hat (fog.version zählt jede Neuberechnung, alle 0,25 s Spielzeit)
  if (fog.version !== undefined && layer.src === fog && layer.ver === fog.version && layer.rev === reveal) return;
  layer.src = fog;
  layer.ver = fog.version;
  layer.rev = reveal;
  const A = layer.a;
  const vis = fog.visible;
  const exp = fog.explored;
  for (let i = 0; i < n; i++) A[i] = reveal || vis[i] ? 0 : exp[i] ? FOG_EXPLORED_ALPHA : 255;
  blur121(A, layer.b, cols, rows, 1);
  const T = layer.tone;
  const L = layer.lut;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const q = (A[i] * 16 + T[i]) * 3; // Tabelle: Nebelstufe × 16 Wolkentöne
    d[p] = L[q];
    d[p + 1] = L[q + 1];
    d[p + 2] = L[q + 2];
    d[p + 3] = A[i];
  }
  layer.ctx.putImageData(layer.image, 0, 0);
}

/** Farbtabelle für updateFogLayer: je Nebelstufe (0 … 255) und Wolkenton (0 … 15) r, g, b wie FS_FOG in ground.js. */
function fogLut() {
  const L = new Uint8ClampedArray(256 * 16 * 3);
  const span = 255 - FOG_EXPLORED_ALPHA;
  for (let a = 0; a < 256; a++) {
    const u = a <= FOG_EXPLORED_ALPHA ? 0 : (a - FOG_EXPLORED_ALPHA) / span; // 0 erkundet … 1 unerforscht
    for (let s = 0; s < 16; s++) {
      const t = s / 15;
      const w = Math.min(1, t * t * 1.3);
      const rim = 4 * u * (1 - u) * (0.35 + 0.65 * t); // heller Saum am Übergang
      const q = (a * 16 + s) * 3;
      for (let k = 0; k < 3; k++) L[q + k] = FOG_DIM[k] + (FOG_DEEP[k] + (FOG_LIGHT[k] - FOG_DEEP[k]) * w - FOG_DIM[k]) * u + FOG_RIM[k] * rim;
    }
  }
  return L;
}
