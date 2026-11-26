// Natur gemalt (seit v5.28, Daniels Wunsch „eine Gruppe nach der anderen“): Bäume in vier Arten (Laubbaum, Birke, Fichte,
// Kiefer), Büsche (Strauch, Beerenstrauch, Farn, junge Fichte), Felsen, Reh und Wildschwein. Jede Variante wird je Jahreszeit und Maßstab einmal gemalt (spritecache.js) und danach nur noch kopiert.
// Iso: Bäume und Büsche aufrecht (sehen in allen Drehungen gleich aus), Felsen und Tiere als kleine 3D-Modelle (Malwerkzeug aus
// unitpaint.js) mit dem Licht der Gebäude. 2D: dieselben Arten genau von oben, Schatten nach rechts unten.
// Herbst: Laub gelb, orange oder rot (je Baum fest) und Laub am Boden; Winter: Laubbäume kahl mit Schnee auf den Ästen,
// Nadelbäume, Büsche und Felsen verschneit. Nur Darstellung, keine Spielregel.
import { sprite, blit, spriteDpr } from './spritecache.js';
import { PAINT } from './unitpaint.js';
import { rgbOf, mix, hashXY } from './color.js';

const TAU = Math.PI * 2;
const R = 16; // Bezugsradius der Bäume (Weltpixel); jedes Bild wird nach t.r skaliert
const RB = 10; // Bezugsradius der Büsche
const RR = 16; // Bezugsradius der Felsen
const ANIMAL_ISO = 1.0; // Iso: Tiere im Maßstab der Welt (Soldaten 1,35)

// ---------- Zufall und Farben ----------

/** Fester Zufall (mulberry32): gleicher Startwert → gleiches Bild in jedem Maßstab. */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Eigener Zufall für Feinheiten: verbraucht immer genau einen Wert, damit die Form in allen Maßstäben gleich bleibt. */
const sub = (r) => rng((r() * 4294967296) >>> 0);

const rgba = (h, a) => {
  const [r, g, b] = rgbOf(h);
  return `rgba(${r},${g},${b},${a})`;
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Gerätepixel je Einheit im Malkontext: Blätter, Nadeln und Rinde richten ihre Dichte danach (Paket „Baumtextur“). */
const pxOf = (c) => (c.getTransform ? Math.abs(c.getTransform().a) || 1 : 1);

/** Farbe aus einer Palette [Licht, Mitte, Schatten, Tiefe] für Helligkeit t (0 dunkel … 1 hell). */
function tone(P, t) {
  t = clamp01(t);
  if (t < 0.33) return mix(P[3], P[2], t / 0.33);
  if (t < 0.66) return mix(P[2], P[1], (t - 0.33) / 0.33);
  return mix(P[1], P[0], (t - 0.66) / 0.34);
}

function ell(c, x, y, rx, ry, fill, rot = 0) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fill();
}

/** Gelappter Umriss (Laub, Busch): n Bögen um (x, y), rough = wie stark die Bögen vorstehen. Pfad offen zum Füllen. */
function blobPath(c, x, y, rx, ry, r, n = 9, rough = 0.16) {
  const a0 = r() * TAU;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const k = 1 - rough + r() * rough * 0.8;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const am = a0 + ((i + 0.5) / n) * TAU;
    const [x1, y1] = pts[(i + 1) % n];
    c.quadraticCurveTo(x + Math.cos(am) * rx * (1 + rough * 0.7), y + Math.sin(am) * ry * (1 + rough * 0.7), x1, y1);
  }
  c.closePath();
}

// ---------- Farben der Natur ----------

// Laub je Art: [Licht, Mitte, Schatten, Tiefe]; Herbst je Baum eine der Färbungen
const LEAVES = {
  broad: {
    summer: [
      ['#a9cc70', '#5f9441', '#325d27', '#1c3818'],
      ['#8fb35e', '#46753a', '#244a22', '#132a12'], // Eiche: dunkel, satt (Paket „Baumtextur“)
      ['#a3c27a', '#5a8a4a', '#2f5a2e', '#19351a'], // Buche: kühler, bläulich
    ],
    autumn: [
      ['#f6d86c', '#dba734', '#9a6a1f', '#553912'],
      ['#f4aa54', '#d2722c', '#92431c', '#512711'],
      ['#e57e55', '#ba472c', '#7a2a1d', '#431810'],
      ['#d2c466', '#9e8e3b', '#615a27', '#383418'],
    ],
  },
  birch: {
    summer: [['#cfe292', '#8bb553', '#517b31', '#2e4c1f']],
    autumn: [['#f9e57a', '#e3bd3d', '#a37b24', '#5f4618']],
  },
};
const SPRUCE = ['#5f8f61', '#2f5c40', '#1d402d', '#10281c'];
const PINE = ['#78985a', '#43693a', '#274628', '#142c19'];
const BARK = {
  broad: ['#7a614b', '#54402f', '#33271d'],
  spruce: ['#6a5340', '#46372b', '#2a2019'],
  pine: ['#c07a4c', '#93532f', '#5c3523'],
  birch: ['#f3f1ea', '#d6d1c6', '#9a958a'],
};
const SNOW = ['#f7fafc', '#dfe7ee', '#b4c3d1'];
const TWIG = '#4a3c33';

export const SPECIES = ['broad', 'birch', 'spruce', 'pine'];
const SHAPES = { broad: 4, birch: 3, spruce: 3, pine: 3 }; // Formen je Art
const SP_SEED = { broad: 1, birch: 2, spruce: 3, pine: 4 };

/** Art eines verstreuten oder Stadtbaums (ohne Wald): meist Laubbäume, dazu Birken, Fichten und Kiefern. */
function speciesOf(h) {
  const k = (h >>> 2) % 20;
  return k < 12 ? 'broad' : k < 15 ? 'birch' : k < 18 ? 'spruce' : 'pine';
}

/** Waldart (fest nach Lage des Walds): Laubwald, Nadelwald oder Mischwald. */
export function forestKind(o) {
  return ['laub', 'nadel', 'misch'][hashXY(o.x, o.y + o.r) % 3];
}

/** Art eines Baums im Wald nach Waldart; u ∈ [0, 1) ist der Zufall des Baums. */
export function forestSpecies(kind, u) {
  if (kind === 'laub') return u < 0.8 ? 'broad' : 'birch';
  if (kind === 'nadel') return u < 0.68 ? 'spruce' : 'pine';
  return u < 0.4 ? 'broad' : u < 0.72 ? 'spruce' : u < 0.84 ? 'birch' : 'pine';
}

function treeLook(t) {
  const h = hashXY(t.x, t.y * 3 + 1);
  const sp = SHAPES[t.sp] ? t.sp : speciesOf(h);
  const shape = (h >>> 5) % SHAPES[sp];
  const size = (t.r / R) * (0.92 + ((h >>> 9) % 17) / 100) * (sp === 'spruce' ? 1.04 : 1);
  return { h, sp, shape, size };
}

/**
 * Aussehen eines Baums für die Ansicht 3D (render3d/trees3d.js), gleich gewürfelt wie das gemalte Bild: Art sp, Form shape, Größe size
 * (1 = Bezugsradius R), Zufall h, Laubpalette P [Licht, Mitte, Schatten, Tiefe] der Jahreszeit (Nadelbäume immer gleich).
 */
export function treeLook3d(t, season = 'summer') {
  const L = treeLook(t);
  return { ...L, P: leavesOf(L.sp, season, palIndex(L.sp, season, L.h)) };
}

/** Farben der Bäume für die Ansicht 3D: alle Laubpaletten (Reihenfolge fest), Rinde je Art, Schnee, kahle Zweige. */
export const TREE_COLORS = {
  palettes: [...LEAVES.broad.summer, ...LEAVES.broad.autumn, ...LEAVES.birch.summer, ...LEAVES.birch.autumn, SPRUCE, PINE],
  bark: BARK,
  snow: SNOW,
  twig: TWIG,
};

/** Färbung des Laubs (Index in LEAVES); kahle Winterbäume und Nadelbäume haben nur eine. */
function palIndex(sp, season, h) {
  if (season === 'winter' || sp === 'spruce' || sp === 'pine') return 0;
  return (h >>> 13) % LEAVES[sp][season === 'autumn' ? 'autumn' : 'summer'].length;
}

function leavesOf(sp, season, pv) {
  if (sp === 'spruce') return SPRUCE;
  if (sp === 'pine') return PINE;
  const set = LEAVES[sp][season === 'autumn' ? 'autumn' : 'summer'];
  return set[pv % set.length];
}

// ---------- Bauteile der Bäume ----------

/** Stamm als schlankes Trapez von (x0, y0) nach (x1, y1), links heller (Licht von links oben). */
function trunk(c, x0, y0, x1, y1, w0, w1, B) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  c.beginPath();
  c.moveTo(x0 - nx * w0, y0 - ny * w0);
  c.lineTo(x1 - nx * w1, y1 - ny * w1);
  c.lineTo(x1 + nx * w1, y1 + ny * w1);
  c.lineTo(x0 + nx * w0, y0 + ny * w0);
  c.closePath();
  const g = c.createLinearGradient(x0 - w0, 0, x0 + w0, 0);
  g.addColorStop(0, B[0]);
  g.addColorStop(0.5, B[1]);
  g.addColorStop(1, B[2]);
  c.fillStyle = g;
  c.fill();
  // Wurzelanlauf
  ell(c, x0 + w0 * 0.2, y0, w0 * 1.5, w0 * 0.45, B[2]);
  // Rinde (Paket „Baumtextur“): kurze Furchen längs des Stamms, links helle Schuppen; Birke hat eigene Flecken
  const px = pxOf(c);
  if (B === BARK.birch || w0 * px < 1.2) return;
  const rd = rng(Math.round(x0 * 31 + y1 * 17 + w0 * 1013) + 7);
  const n = Math.min(40, Math.round((l * w0 * px * px) / 6));
  c.save();
  c.beginPath();
  c.moveTo(x0 - nx * w0, y0 - ny * w0);
  c.lineTo(x1 - nx * w1, y1 - ny * w1);
  c.lineTo(x1 + nx * w1, y1 + ny * w1);
  c.lineTo(x0 + nx * w0, y0 + ny * w0);
  c.clip();
  c.lineCap = 'round';
  c.lineWidth = Math.max(0.5 / px, (w0 + w1) * 0.09);
  const furrows = new Path2D();
  const scales = new Path2D();
  for (let i = 0; i < n; i++) {
    const t = rd();
    const u = rd() * 2 - 1;
    const w = w0 + (w1 - w0) * t;
    const len = (2 + rd() * 4) / px;
    const bx = x0 + dx * t + nx * u * w;
    const by = y0 + dy * t + ny * u * w;
    const q = u < -0.3 && rd() < 0.5 ? scales : furrows;
    q.moveTo(bx, by);
    q.lineTo(bx + (dx / l) * len, by + (dy / l) * len);
  }
  c.strokeStyle = rgba(B[2], 0.6);
  c.stroke(furrows);
  c.strokeStyle = rgba(B[0], 0.55);
  c.stroke(scales);
  c.restore();
}

/**
 * Büschel Laub mit Licht lf (0 … 1): Grund mit Verlauf, darauf Blätter (seit Paket „Baumtextur“ in jedem Maßstab, so dicht, dass
 * jedes Blatt gut ein Gerätepixel groß ist), dunkle Lücken im Inneren und von der Sonne getroffene Blätter am Rand links oben.
 */
function leafClump(c, r, k, P, lf, fine) {
  const rd = sub(r);
  const sq = k.sq ?? 0.92;
  const g = c.createRadialGradient(k.x - k.r * 0.4, k.y - k.r * 0.45, k.r * 0.05, k.x, k.y, k.r * 1.12);
  g.addColorStop(0, tone(P, lf + 0.2));
  g.addColorStop(0.6, tone(P, lf - 0.05));
  g.addColorStop(1, tone(P, lf - 0.38));
  c.fillStyle = g;
  blobPath(c, k.x, k.y, k.r, k.r * sq, r, 7 + ((r() * 3) | 0), 0.2);
  c.fill();
  // Blattwerk: kachelbares Blattmuster (helle Blätter, Schattenkanten, dunkle Lücken) über den Grund gemischt, ein fill je Büschel
  // (Paket „Baumtextur“; einzelne Blätter je Büschel kosteten beim Malen das Vierfache). Grau 128 im Muster lässt die Farbe stehen.
  const px = pxOf(c);
  const pat = leafPattern(c, px, rd() * LEAF_PAT_N, rd() * LEAF_PAT_N);
  if (pat) {
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = 0.85;
    c.fillStyle = pat;
    c.fill();
    c.restore();
  }
  // Sonnenblätter: hell und leicht gelblich am Rand zum Licht, nur auf beschienenen Büscheln
  const lw = Math.max(1.2 / px, k.r * 0.09);
  const h = lf < 0.3 ? 0 : Math.round(Math.min(16, (k.r / lw) ** 2 * 0.16) * Math.min(1, (lf - 0.3) * 3));
  if (h < 1) return;
  c.fillStyle = rgba(mix(P[0], '#f3f0b4', 0.3), 0.8);
  c.beginPath();
  for (let i = 0; i < h; i++) {
    const a = -2.2 + (rd() - 0.5) * 1.9;
    const d = k.r * (0.62 + rd() * 0.36);
    const x = k.x + Math.cos(a) * d;
    const y = k.y + Math.sin(a) * d * sq;
    const lr = lw * (0.7 + rd() * 0.5);
    c.moveTo(x + lr * 1.3 * Math.cos(a), y + lr * 1.3 * Math.sin(a));
    c.ellipse(x, y, lr * 1.3, lr, a, 0, TAU);
  }
  c.fill();
}

const LEAF_PAT_N = 64; // Kantenlänge des Blattmusters (Musterpixel)
let leafSrc; // Blattmuster als Canvas (einmal gemalt), null = kein Canvas

/** Kachelbares Blattmuster in Grau (128 = neutral) für den Mischmodus „overlay“. Fester Zufall, einmal gemalt (auch Textur der 3D-Bäume). */
export function leafCanvas() {
  if (leafSrc !== undefined) return leafSrc;
  leafSrc = null;
  if (typeof document === 'undefined' || !document.createElement) return null;
  const N = LEAF_PAT_N;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.fillStyle = 'rgb(118,118,118)';
  g.fillRect(0, 0, N, N);
  const rd = rng(0x1eaf);
  const leaf = (x, y, rx, ry, a, col) => {
    g.fillStyle = col;
    for (const ox of [-N, 0, N]) {
      for (const oy of [-N, 0, N]) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, rx, ry, a, 0, TAU);
        g.fill();
      }
    }
  };
  for (let i = 0; i < 30; i++) leaf(rd() * N, rd() * N, 1.3 + rd(), 1 + rd() * 0.6, rd() * TAU, 'rgb(28,28,28)'); // Lücken
  for (let i = 0; i < 300; i++) {
    const x = rd() * N;
    const y = rd() * N;
    const rx = 1.5 + rd() * 1.1;
    const a = rd() * TAU;
    const v = Math.round(140 + rd() * 80);
    leaf(x + 0.7, y + 0.8, rx, rx * 0.62, a, 'rgba(40,40,40,0.55)'); // Schattenkante unten rechts
    leaf(x, y, rx, rx * 0.62, a, `rgb(${v},${v},${v})`);
  }
  leafSrc = cv;
  return cv;
}

/** Blattmuster für den Kontext c: ein Musterpixel ≈ ein Gerätepixel (größer, wenn ein Baum sehr groß gemalt wird), versetzt um ox, oy. */
function leafPattern(c, px, ox, oy) {
  const src = leafCanvas();
  if (!src || !c.createPattern) return null;
  const pat = c.createPattern(src, 'repeat');
  if (!pat?.setTransform || typeof DOMMatrix === 'undefined') return pat;
  const k = Math.max(1, px * 0.3) / px; // Einheiten je Musterpixel
  pat.setTransform(new DOMMatrix([k, 0, 0, k, ox * k, oy * k]));
  return pat;
}

/** Nadeln zeichnen: helle (Lichtseite) und dunkle Striche je als ein Pfad. */
function needles(c, lit, dark, P, lw, aLit, aDark) {
  c.lineWidth = lw;
  c.strokeStyle = rgba(P[0], aLit);
  c.stroke(lit);
  c.strokeStyle = rgba(P[3], aDark);
  c.stroke(dark);
}

/** Büschel einer Krone: ein Kranz am Rand und einige innen, von hinten (oben) nach vorn (unten) sortiert. */
function clumpsOf(r, cx, cy, rx, ry, n, size = 1) {
  const out = [];
  const a0 = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + (r() - 0.5) * 0.4;
    const d = 0.56 + r() * 0.16;
    out.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: (0.36 + r() * 0.15) * Math.min(rx, ry) * size });
  }
  const m = Math.round(n * 0.55);
  for (let i = 0; i < m; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.38;
    out.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d - ry * 0.14, r: (0.4 + r() * 0.14) * Math.min(rx, ry) * size });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** Licht eines Büschels nach seiner Lage in der Krone: oben links hell, unten rechts dunkel. */
const lightAt = (k, cx, cy, rx, ry) => 0.54 - ((k.x - cx) / rx) * 0.26 - ((k.y - cy) / ry) * 0.4;

/** Herbstlaub am Boden um den Stamm (Ellipse in der Iso-Ansicht). */
function litter(c, r, P, rad, fine) {
  const rd = sub(r);
  if (!fine) return;
  for (let i = 0; i < 26; i++) {
    const a = rd() * TAU;
    const d = Math.sqrt(rd()) * rad;
    c.fillStyle = tone(P, 0.25 + rd() * 0.7);
    c.beginPath();
    c.ellipse(Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.5, 0.9, 0.55, rd() * 3, 0, TAU);
    c.fill();
  }
}

/** Ast mit Verzweigung (Bildschirmwinkel, oben = −π/2); sammelt Strecken [x0, y0, x1, y1, Breite]. */
function limb(out, r, x, y, a, len, w, depth, droop = 0) {
  const x1 = x + Math.cos(a) * len;
  const y1 = y + Math.sin(a) * len;
  out.push([x, y, x1, y1, w]);
  if (depth <= 0) return;
  const n = depth > 2 && r() < 0.45 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    let na = a + (i - (n - 1) / 2) * (0.42 + r() * 0.34) + (r() - 0.5) * 0.3;
    na += (-Math.PI / 2 - na) * 0.1 + droop * (depth <= 1 ? 0.9 : 0); // streben nach oben, Birkenzweige hängen
    limb(out, r, x1, y1, na, len * (0.64 + r() * 0.14), Math.max(0.22, w * 0.6), depth - 1, droop);
  }
}

/** Kahle Krone (Winter): Astwerk mit feinem Zweigschleier, Schnee auf den flachen Ästen. */
function bareCrown(c, r, x, y, rx, ry, col, snow, fine, droop = 0) {
  // Zweigschleier schwach und eng an der Krone (seit Paket „Wohnhaus“; vorher wirkte er auf Schnee wie ein grauer Hof)
  const g = c.createRadialGradient(x, y - ry * 0.75, ry * 0.15, x, y - ry * 0.7, Math.max(rx, ry) * 0.75);
  g.addColorStop(0, 'rgba(86,72,62,0.12)');
  g.addColorStop(1, 'rgba(86,72,62,0)');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y - ry * 0.7, rx * 0.75, ry * 0.75, 0, 0, TAU);
  c.fill();
  const segs = [];
  const main = 3 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < main; i++) {
    const a = -Math.PI / 2 + (i - (main - 1) / 2) * 0.58 + (r() - 0.5) * 0.25;
    limb(segs, r, x, y, a, ry * 0.4, R * 0.09, fine ? 4 : 3, droop);
  }
  c.strokeStyle = col;
  for (const [x0, y0, x1, y1, w] of segs) {
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  if (!snow) return;
  c.strokeStyle = SNOW[0];
  for (const [x0, y0, x1, y1, w] of segs) {
    if (w < 0.45 || Math.abs(y1 - y0) > Math.abs(x1 - x0) * 1.8) continue; // nur auf flacheren, dickeren Ästen
    c.lineWidth = w * 0.7;
    c.beginPath();
    c.moveTo(x0, y0 - w * 0.5);
    c.lineTo(x1, y1 - w * 0.5);
    c.stroke();
  }
}

// ---------- Bäume, Iso (aufrecht, Stammfuß im Ursprung) ----------

function broadIso(c, r, P, season, fine) {
  const th = R * (1.22 + r() * 0.25);
  const lean = (r() - 0.5) * 3;
  const rx = R * (1.2 + r() * 0.18);
  const ry = R * (1.02 + r() * 0.14);
  const cx = lean;
  const cy = -th - ry * 0.78;
  if (season === 'autumn') litter(c, r, P, R * 0.95, fine);
  trunk(c, 0, 0, lean * 0.8, -th - ry * 0.45, R * 0.15, R * 0.08, BARK.broad);
  if (season === 'winter') return bareCrown(c, r, lean * 0.8, -th - ry * 0.3, rx, ry, TWIG, true, fine);
  c.strokeStyle = BARK.broad[2];
  c.lineWidth = R * 0.07;
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo(lean * 0.6, -th * 0.9);
    c.quadraticCurveTo(lean * 0.6 + sx * rx * 0.2, -th - ry * 0.2, cx + sx * rx * 0.45, cy + ry * 0.25);
    c.stroke();
  }
  c.fillStyle = P[3];
  blobPath(c, cx, cy + ry * 0.12, rx * 0.95, ry * 0.86, r, 10, 0.14);
  c.fill();
  for (const k of clumpsOf(r, cx, cy, rx, ry, 8 + ((r() * 3) | 0))) leafClump(c, r, k, P, lightAt(k, cx, cy, rx, ry), fine);
}

function birchIso(c, r, P, season, fine) {
  const th = R * (1.5 + r() * 0.3);
  const lean = (r() - 0.5) * 4;
  const top = -th - R * 1.3;
  if (season === 'autumn') litter(c, r, P, R * 0.8, fine);
  trunk(c, 0, 0, lean, top, R * 0.085, R * 0.04, BARK.birch);
  const rd = sub(r);
  {
    c.fillStyle = '#2f2b29';
    for (let i = 0; i < 10; i++) {
      const t = 0.06 + i * 0.085 + rd() * 0.03;
      const w = R * (0.085 - 0.045 * t);
      c.fillRect(lean * t - w * (0.1 + rd() * 0.8), top * t, w * (0.4 + rd() * 0.7), R * 0.025 + rd() * R * 0.02);
    }
  }
  const rx = R * (0.86 + r() * 0.12);
  const ry = R * (1.12 + r() * 0.15);
  const cx = lean * 0.9;
  const cy = -th - ry * 0.55;
  if (season === 'winter') return bareCrown(c, r, lean * 0.85, -th - R * 0.15, rx, ry, '#5d4c45', true, fine, 0.5);
  c.strokeStyle = '#6d625b';
  c.lineWidth = R * 0.035;
  for (const sx of [-1, 1, -0.5, 0.6]) {
    c.beginPath();
    c.moveTo(lean * 0.7, -th * 0.95);
    c.quadraticCurveTo(cx + sx * rx * 0.3, cy, cx + sx * rx * 0.62, cy + ry * 0.45);
    c.stroke();
  }
  c.globalAlpha = 0.85;
  c.fillStyle = P[3];
  blobPath(c, cx, cy + ry * 0.1, rx * 0.8, ry * 0.8, r, 9, 0.2);
  c.fill();
  c.globalAlpha = 1;
  for (const k of clumpsOf(r, cx, cy, rx, ry, 11, 0.78)) {
    k.sq = 1.05; // Birkenlaub hängt
    leafClump(c, r, k, P, lightAt(k, cx, cy, rx, ry) + 0.06, fine);
  }
}

/** Fichte: Stockwerke aus hängenden Ästen, links heller; im Winter Schnee auf jedem Stockwerk. */
function spruceIso(c, r, P, season, fine, H0 = R * 3.9, W0 = R * 1.0) {
  const H = H0 * (1 + r() * 0.14);
  const W = W0 * (0.95 + r() * 0.15);
  const base = H * 0.09;
  trunk(c, 0, 0, 0, -base - R * 0.3, W * 0.11, W * 0.08, BARK.spruce);
  const n = 8;
  const snow = season === 'winter';
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const yb = -base - (H - base) * t0 * 0.93;
    const th = ((H - base) / n) * 1.9;
    const w = W * Math.pow(1 - t0, 0.92) + W * 0.1;
    tier(c, r, (r() - 0.5) * W * 0.05, yb, w, th, P, snow, fine);
  }
}

function tier(c, r, x, yb, w, th, P, snow, fine) {
  const ya = yb - th;
  const m = 8;
  const bottom = [];
  for (let k = 0; k <= m; k++) {
    const u = -1 + (2 * k) / m;
    const sag = th * 0.16 * (1 - u * u);
    bottom.push([x + u * w, yb + sag + (k % 2 ? th * (0.1 + r() * 0.08) : -th * 0.02)]);
  }
  const shape = () => {
    c.beginPath();
    c.moveTo(x, ya);
    c.quadraticCurveTo(x + w * 0.42, yb - th * 0.5, bottom[m][0], bottom[m][1]);
    for (let k = m - 1; k >= 0; k--) c.lineTo(bottom[k][0], bottom[k][1]);
    c.quadraticCurveTo(x - w * 0.42, yb - th * 0.5, x, ya);
    c.closePath();
  };
  shape();
  const g = c.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, P[0]);
  g.addColorStop(0.4, P[1]);
  g.addColorStop(0.75, P[2]);
  g.addColorStop(1, P[3]);
  c.fillStyle = g;
  c.fill();
  // Unterkante dunkel (Schatten unter dem Stockwerk)
  c.strokeStyle = rgba(P[3], 0.8);
  c.lineWidth = th * 0.09;
  c.beginPath();
  bottom.forEach(([bx, by], k) => (k ? c.lineTo(bx, by) : c.moveTo(bx, by)));
  c.stroke();
  const rd = sub(r);
  const px = pxOf(c);
  const nn = Math.min(70, Math.round((w * th * px * px) / 9));
  if (nn >= 4) {
    // Nadeln: kurze schräge Striche, links heller, Dichte nach Gerätepixeln (Paket „Baumtextur“)
    const lit = new Path2D();
    const dark = new Path2D();
    for (let i = 0; i < nn; i++) {
      const u = rd() * 2 - 1;
      const v = 0.25 + rd() * 0.6;
      const nx = x + u * w * (1 - v * 0.6);
      const ny = ya + (yb - ya) * (0.35 + v * 0.6);
      const q = u < -0.1 ? lit : dark;
      q.moveTo(nx, ny);
      q.lineTo(nx + u * th * 0.25, ny + th * 0.22);
    }
    needles(c, lit, dark, P, Math.max(0.35, 0.8 / px), 0.7, 0.55);
  }
  if (!snow) return;
  // Schnee auf dem sichtbaren Band (das nächste Stockwerk verdeckt die obere Hälfte): oben gerade, unten wellig
  const hw = (u) => w * (1 - u) * 0.96; // halbe Breite des Stockwerks in Höhe u (0 unten … 1 Spitze)
  c.beginPath();
  c.moveTo(x - hw(0.12), yb - th * 0.1);
  c.lineTo(x - hw(0.56), yb - th * 0.56);
  c.lineTo(x + hw(0.56) * 0.9, yb - th * 0.56);
  c.lineTo(x + hw(0.2) * 0.85, yb - th * 0.2);
  const q = 7;
  for (let k = q; k >= 0; k--) {
    const u = -0.85 + (1.7 * k) / q;
    c.lineTo(x + u * hw(0.25), yb - th * (0.2 + (k % 2 ? 0.07 : 0)));
  }
  c.closePath();
  const sg = c.createLinearGradient(x - w, 0, x + w, 0);
  sg.addColorStop(0, SNOW[0]);
  sg.addColorStop(0.55, SNOW[1]);
  sg.addColorStop(1, SNOW[2]);
  c.fillStyle = sg;
  c.fill();
}

/** Kiefer: hoher, oben rötlicher Stamm, flache Schirmkrone aus wenigen Nadelbüscheln. */
function pineIso(c, r, P, season, fine) {
  const th = R * (2.25 + r() * 0.4);
  const lean = (r() - 0.5) * 5;
  trunk(c, 0, 0, lean, -th - R * 0.6, R * 0.12, R * 0.065, BARK.pine);
  // unten graubraune Borke
  c.globalAlpha = 0.75;
  trunk(c, 0, 0, lean * 0.35, -th * 0.35, R * 0.125, R * 0.1, ['#8a7262', '#5e4c40', '#3a2f28']);
  c.globalAlpha = 1;
  c.strokeStyle = BARK.pine[2];
  c.lineWidth = R * 0.04;
  for (let i = 0; i < 3; i++) {
    // dürre Aststummel
    const t = 0.35 + i * 0.15;
    const sx = i % 2 ? 1 : -1;
    c.beginPath();
    c.moveTo(lean * t, -th * t * 1.05);
    c.lineTo(lean * t + sx * R * 0.25, -th * t * 1.05 - R * 0.12);
    c.stroke();
  }
  const n = 3 + (r() < 0.55 ? 1 : 0);
  const tops = [];
  for (let i = 0; i < n; i++) {
    tops.push({
      x: lean + (i % 2 ? 1 : -1) * R * (0.2 + r() * 0.35) * (i ? 1 : 0.4),
      y: -th - R * (0.05 + i * 0.36) - r() * R * 0.12,
      rx: R * (0.66 + r() * 0.28) * (1 - i * 0.13),
      ry: R * (0.38 + r() * 0.1),
    });
  }
  c.strokeStyle = BARK.pine[1];
  c.lineWidth = R * 0.05;
  for (const k of tops) {
    c.beginPath();
    c.moveTo(lean * 0.95, -th - R * 0.2);
    c.lineTo(k.x, k.y + k.ry * 0.3);
    c.stroke();
  }
  for (const k of tops.sort((a, b) => b.y - a.y)) pineClump(c, r, k, P, season === 'winter', fine);
}

function pineClump(c, r, k, P, snow, fine) {
  ell(c, k.x, k.y + k.ry * 0.35, k.rx * 0.98, k.ry * 0.85, P[3]);
  const g = c.createRadialGradient(k.x - k.rx * 0.35, k.y - k.ry * 0.5, 0.5, k.x, k.y, k.rx);
  g.addColorStop(0, P[0]);
  g.addColorStop(0.55, P[1]);
  g.addColorStop(1, P[2]);
  c.fillStyle = g;
  blobPath(c, k.x, k.y, k.rx, k.ry, r, 13, 0.34);
  c.fill();
  const rd = sub(r);
  const px = pxOf(c);
  const nn = Math.min(70, Math.round((k.rx * k.ry * px * px) / 5));
  if (nn >= 4) {
    // Nadelbüschel: kurze Striche strahlenförmig, Dichte nach Gerätepixeln
    const lit = new Path2D();
    const dark = new Path2D();
    for (let i = 0; i < nn; i++) {
      const a = rd() * TAU;
      const d = Math.sqrt(rd()) * 0.9;
      const nx = k.x + Math.cos(a) * k.rx * d;
      const ny = k.y + Math.sin(a) * k.ry * d;
      const q = Math.cos(a) + Math.sin(a) < 0 ? lit : dark;
      q.moveTo(nx, ny);
      q.lineTo(nx + Math.cos(a) * 1.6, ny + Math.sin(a) * 0.9);
    }
    needles(c, lit, dark, P, Math.max(0.4, 0.8 / px), 0.8, 0.6);
  }
  if (snow) {
    c.fillStyle = SNOW[0];
    blobPath(c, k.x - k.rx * 0.08, k.y - k.ry * 0.25, k.rx * 0.8, k.ry * 0.62, r, 9, 0.2);
    c.fill();
  }
}

const ISO_TREE = { broad: broadIso, birch: birchIso, spruce: spruceIso, pine: pineIso };
// Bildgrenzen je Art (Einheiten um den Stammfuß), großzügig für alle Formen
const ISO_BOUNDS = { broad: [-31, -64, 31, 8], birch: [-25, -68, 25, 8], spruce: [-22, -76, 22, 6], pine: [-28, -74, 28, 6] };

// ---------- Bäume, 2D von oben (Mitte im Ursprung) ----------

/** Schatten nach rechts unten (2D). */
function shadowTop(c, rad, dx, dy, a = 0.25) {
  ell(c, dx, dy, rad, rad * 0.94, `rgba(8,14,6,${a})`);
}

function broadTop(c, r, P, season, fine) {
  const Rc = R * (1.28 + r() * 0.14);
  shadowTop(c, Rc * 0.95, Rc * 0.42, Rc * 0.52);
  if (season === 'winter') return bareTop(c, r, Rc, TWIG, fine);
  c.fillStyle = P[3];
  blobPath(c, 0, 0, Rc, Rc, r, 11, 0.12);
  c.fill();
  const ks = [];
  const n = 8;
  const a0 = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + r() * 0.35;
    const d = Rc * (0.56 + r() * 0.1);
    ks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: Rc * (0.36 + r() * 0.08), z: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const a = r() * TAU;
    const d = Rc * (0.12 + r() * 0.2);
    ks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: Rc * (0.36 + r() * 0.07), z: 1 });
  }
  ks.push({ x: -Rc * 0.1, y: -Rc * 0.12, r: Rc * 0.34, z: 2 });
  ks.sort((a, b) => a.z - b.z || a.y - b.y);
  for (const k of ks) leafClump(c, r, k, P, 0.52 - (k.x + k.y) / (Rc * 2.4) + k.z * 0.1, fine);
}

function birchTop(c, r, P, season, fine) {
  const Rc = R * (1.05 + r() * 0.1);
  shadowTop(c, Rc * 0.9, Rc * 0.45, Rc * 0.55, 0.24);
  if (season === 'winter') return bareTop(c, r, Rc, '#5d4c45', fine);
  c.globalAlpha = 0.8;
  c.fillStyle = P[3];
  blobPath(c, 0, 0, Rc * 0.85, Rc * 0.85, r, 10, 0.2);
  c.fill();
  c.globalAlpha = 1;
  const ks = [];
  for (let i = 0; i < 11; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * Rc * 0.68;
    ks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: Rc * (0.24 + r() * 0.08) });
  }
  ks.sort((a, b) => b.x + b.y - (a.x + a.y));
  for (const k of ks) leafClump(c, r, k, P, 0.6 - (k.x + k.y) / (Rc * 2.2), fine);
}

/** Kahle Krone von oben: Äste strahlenförmig, Schnee darauf. */
function bareTop(c, r, Rc, col, fine) {
  const g = c.createRadialGradient(0, 0, Rc * 0.1, 0, 0, Rc);
  g.addColorStop(0, 'rgba(86,72,62,0.42)');
  g.addColorStop(1, 'rgba(86,72,62,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, Rc, 0, TAU);
  c.fill();
  const segs = [];
  const n = 5;
  const a0 = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + (r() - 0.5) * 0.4;
    flatLimb(segs, r, 0, 0, a, Rc * 0.36, R * 0.11, fine ? 3 : 2);
  }
  c.strokeStyle = col;
  for (const [x0, y0, x1, y1, w] of segs) {
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  c.strokeStyle = SNOW[0];
  for (const [x0, y0, x1, y1, w] of segs) {
    if (w < 0.4) continue;
    c.lineWidth = w * 0.55;
    c.beginPath();
    c.moveTo(x0 - w * 0.3, y0 - w * 0.3);
    c.lineTo(x1 - w * 0.3, y1 - w * 0.3);
    c.stroke();
  }
  ell(c, 0, 0, R * 0.12, R * 0.12, col);
}

function flatLimb(out, r, x, y, a, len, w, depth) {
  const x1 = x + Math.cos(a) * len;
  const y1 = y + Math.sin(a) * len;
  out.push([x, y, x1, y1, w]);
  if (depth <= 0) return;
  for (let i = 0; i < 2; i++) flatLimb(out, r, x1, y1, a + (i ? 1 : -1) * (0.3 + r() * 0.35), len * (0.62 + r() * 0.12), Math.max(0.22, w * 0.6), depth - 1);
}

/** Zweige eines Nadelbaums von oben (Spitze nach außen). */
function spike(c, a, len, wd, inner, col, edge) {
  const al = a - wd / 2;
  const ar = a + wd / 2;
  c.beginPath();
  c.moveTo(Math.cos(al) * inner, Math.sin(al) * inner);
  c.quadraticCurveTo(Math.cos(a - wd * 0.28) * len * 0.72, Math.sin(a - wd * 0.28) * len * 0.72, Math.cos(a) * len, Math.sin(a) * len);
  c.quadraticCurveTo(Math.cos(a + wd * 0.28) * len * 0.72, Math.sin(a + wd * 0.28) * len * 0.72, Math.cos(ar) * inner, Math.sin(ar) * inner);
  c.closePath();
  c.fillStyle = col;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 0.45;
  c.stroke();
}

function spruceTop(c, r, P, season, fine, Rc0 = R * 1.08) {
  const Rc = Rc0 * (1 + r() * 0.12);
  shadowTop(c, Rc * 0.86, Rc * 0.5, Rc * 0.62);
  const snow = season === 'winter';
  ell(c, 0, 0, Rc * 0.8, Rc * 0.8, P[3]);
  for (const [L, n, dt] of [[1, 12, -0.08], [0.74, 10, 0.08], [0.48, 8, 0.22]]) {
    const a0 = r() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      const len = Rc * L * (0.86 + r() * 0.18);
      const lf = 0.5 - 0.36 * (Math.cos(a) + Math.sin(a)) * 0.7 + dt;
      spike(c, a, len, (TAU / n) * 0.66, Rc * L * 0.2, tone(P, lf), tone(P, lf - 0.3));
      if (snow) {
        const d = len * (0.45 + r() * 0.25);
        ell(c, Math.cos(a) * d - 0.3, Math.sin(a) * d - 0.3, len * 0.16, len * 0.1, rgba(SNOW[0], 0.92), a);
      }
    }
  }
  ell(c, 0, 0, Rc * 0.1, Rc * 0.1, snow ? SNOW[1] : P[1]);
}

function pineTop(c, r, P, season, fine) {
  const Rc = R * (1.2 + r() * 0.12);
  shadowTop(c, Rc * 0.86, Rc * 0.5, Rc * 0.6, 0.26);
  const n = 4;
  const a0 = r() * TAU;
  const ks = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const d = Rc * (0.28 + r() * 0.16);
    ks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rx: Rc * (0.5 + r() * 0.12), ry: Rc * (0.46 + r() * 0.1) });
  }
  ks.sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const k of ks) pineClumpTop(c, r, k, P, season === 'winter', fine, Rc);
}

function pineClumpTop(c, r, k, P, snow, fine, Rc) {
  const lf = 0.55 - (k.x + k.y) / (Rc * 2.4);
  const g = c.createRadialGradient(k.x - k.rx * 0.35, k.y - k.ry * 0.35, 0.5, k.x, k.y, k.rx * 1.05);
  g.addColorStop(0, tone(P, lf + 0.25));
  g.addColorStop(0.6, tone(P, lf));
  g.addColorStop(1, tone(P, lf - 0.32));
  c.fillStyle = g;
  blobPath(c, k.x, k.y, k.rx, k.ry, r, 12, 0.26);
  c.fill();
  const rd = sub(r);
  const px = pxOf(c);
  const nn = Math.min(60, Math.round((k.rx * k.ry * px * px) / 5));
  if (nn >= 4) {
    const lit = new Path2D();
    const dark = new Path2D();
    for (let i = 0; i < nn; i++) {
      const a = rd() * TAU;
      const d = Math.sqrt(rd()) * 0.85;
      const nx = k.x + Math.cos(a) * k.rx * d;
      const ny = k.y + Math.sin(a) * k.ry * d;
      const q = Math.cos(a) + Math.sin(a) < 0 ? lit : dark;
      q.moveTo(nx, ny);
      q.lineTo(nx + Math.cos(a) * 1.5, ny + Math.sin(a) * 1.5);
    }
    needles(c, lit, dark, P, Math.max(0.4, 0.8 / px), 0.75, 0.55);
  }
  if (snow) {
    c.fillStyle = rgba(SNOW[0], 0.95);
    blobPath(c, k.x - k.rx * 0.15, k.y - k.ry * 0.15, k.rx * 0.6, k.ry * 0.55, r, 9, 0.25);
    c.fill();
  }
}

const TOP_TREE = { broad: broadTop, birch: birchTop, spruce: spruceTop, pine: pineTop };
const TOP_BOUNDS = [-27, -27, 37, 37];

function paintTree(c, s, sp, shape, season, pv, iso) {
  const r = rng(1000 + SP_SEED[sp] * 97 + shape * 7919);
  c.scale(s, s);
  (iso ? ISO_TREE : TOP_TREE)[sp](c, r, leavesOf(sp, season, pv), season, s >= 1.1);
}

/** Baum in Iso (Stammfuß am Weltpunkt, Größe nach t.r). false = noch kein Bild (der Renderer zeichnet den Ersatz). */
export function drawTreeIso(ctx, cam, t, season = 'summer') {
  const L = treeLook(t);
  const pv = palIndex(L.sp, season, L.h);
  const f = cam.zoom * L.size;
  const e = sprite(`nt|${L.sp}|${L.shape}|${season}|${pv}`, f * spriteDpr(), ISO_BOUNDS[L.sp], (c, s) => paintTree(c, s, L.sp, L.shape, season, pv, true));
  if (!e) return false;
  const p = cam.worldToScreen(t.x, t.y);
  blit(ctx, e, p.x, p.y, f);
  return true;
}

/** Baum von oben (2D, Welt-Transformation gesetzt), mit Schatten. false = noch kein Bild. */
export function drawTreeTop(ctx, t, season = 'summer', zoom = 1) {
  const L = treeLook(t);
  const pv = palIndex(L.sp, season, L.h);
  const e = sprite(`ntt|${L.sp}|${L.shape}|${season}|${pv}`, zoom * spriteDpr() * L.size, TOP_BOUNDS, (c, s) => paintTree(c, s, L.sp, L.shape, season, pv, false));
  if (!e) return false;
  blit(ctx, e, t.x, t.y, L.size);
  return true;
}

// ---------- Büsche ----------

const BUSH_KINDS = ['shrub', 'shrub', 'berry', 'fern'];
const FERN = { summer: ['#a6cf6a', '#619c40', '#356628', '#1f3f18'], autumn: ['#d9ab58', '#ad7530', '#6e4620', '#3f2814'], winter: ['#a8916f', '#7e6648', '#4f3e2c', '#30251b'] };
const BERRY = { summer: '#c63a2c', autumn: '#d4452a', winter: '#c0302a' };

function bushLook(b) {
  const h = hashXY(b.x, b.y * 3 + 2);
  const kind = b.k ?? BUSH_KINDS[h % BUSH_KINDS.length];
  return { h, kind, shape: (h >>> 6) % 3, pv: (h >>> 11) % 3, size: b.r / RB };
}

function shrubIso(c, r, P, season, fine, berries) {
  if (season === 'winter') return twigsIso(c, r, fine, berries);
  if (season === 'autumn') litter(c, r, P, RB * 0.8, fine);
  c.fillStyle = P[3];
  blobPath(c, 0, -RB * 0.5, RB * 1.12, RB * 0.58, r, 9, 0.18);
  c.fill();
  const ks = [];
  const n = 5 + ((r() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    ks.push({ x: u * RB * 0.72 + (r() - 0.5) * 2, y: -RB * (0.5 + (1 - Math.abs(u)) * 0.42) + (r() - 0.5) * 2, r: RB * (0.4 + r() * 0.14) });
  }
  ks.push({ x: -RB * 0.1, y: -RB * 1.0, r: RB * 0.42 });
  ks.sort((a, b) => a.y - b.y);
  for (const k of ks) leafClump(c, r, k, P, 0.62 - (k.x / RB) * 0.22 - ((k.y + RB * 0.7) / RB) * 0.5, fine);
  const rd = sub(r);
  if (berries && fine) {
    for (let i = 0; i < 12; i++) {
      const k = ks[(rd() * ks.length) | 0];
      const a = rd() * TAU;
      const d = rd() * k.r * 0.8;
      ell(c, k.x + Math.cos(a) * d, k.y + Math.sin(a) * d, 0.75, 0.75, BERRY[season] ?? BERRY.summer);
    }
  }
}

/** Kahler Strauch im Winter: Rutenbündel mit Schnee, Beerensträucher mit roten Hagebutten. */
function twigsIso(c, r, fine, berries) {
  const segs = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.1 + (r() - 0.5) * 0.2;
    limb(segs, r, (r() - 0.5) * 2, 0, a, RB * (0.55 + r() * 0.25), 0.7, 2);
  }
  c.strokeStyle = '#5a4636';
  for (const [x0, y0, x1, y1, w] of segs) {
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  ell(c, 0, -RB * 0.15, RB * 0.9, RB * 0.32, rgba(SNOW[0], 0.9));
  const rd = sub(r);
  if (!fine) return;
  for (const [, , x1, y1] of segs) {
    if (rd() < 0.35) ell(c, x1, y1 - 0.2, 0.9, 0.6, SNOW[0]);
    else if (berries && rd() < 0.5) ell(c, x1, y1, 0.7, 0.7, BERRY.winter);
  }
}

/** Farn: Wedel fächerförmig, hintere zuerst. */
function fernIso(c, r, season, fine) {
  const P = FERN[season] ?? FERN.summer;
  const n = 9;
  const fronds = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = -Math.PI + 0.3 + u * (Math.PI - 0.6) + (r() - 0.5) * 0.2;
    fronds.push({ a, len: RB * (0.85 + r() * 0.4), back: Math.abs(u - 0.5) < 0.2 });
  }
  fronds.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
  for (const f of fronds) frond(c, f.a, f.len, P, fine, season === 'winter');
}

function frond(c, a, len, P, fine, snow, flat = 0.72) {
  const tx = Math.cos(a) * len;
  const ty = Math.sin(a) * len * flat - len * 0.18;
  const mx = tx * 0.5;
  const my = ty * 0.5 - len * 0.32;
  const w = len * 0.2;
  const nx = -Math.sin(a) * w;
  const ny = Math.cos(a) * w * flat;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(mx + nx, my + ny, tx, ty);
  c.quadraticCurveTo(mx - nx, my - ny, 0, 0);
  c.closePath();
  const lf = 0.55 - Math.cos(a) * 0.25;
  c.fillStyle = tone(P, lf);
  c.fill();
  c.strokeStyle = tone(P, lf - 0.35);
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(mx, my, tx, ty);
  c.stroke();
  if (fine) {
    c.strokeStyle = tone(P, lf + 0.25);
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const px = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * mx + t * t * tx;
      const py = 2 * (1 - t) * t * my + t * t * ty;
      const s = w * (1 - t) * 0.9;
      c.beginPath();
      c.moveTo(px - nx / w * s, py - ny / w * s);
      c.lineTo(px + nx / w * s, py + ny / w * s);
      c.stroke();
    }
  }
  if (snow) ell(c, mx * 0.9, my * 0.9, len * 0.18, len * 0.08, rgba(SNOW[0], 0.9), a);
}

function paintBush(c, s, kind, shape, pv, season, iso) {
  const r = rng(3000 + shape * 613 + BUSH_KINDS.indexOf(kind) * 31 + (kind === 'sapling' ? 77 : 0));
  const fine = s >= 1.1;
  c.scale(s, s);
  const P = LEAVES.broad[season === 'autumn' ? 'autumn' : 'summer'][pv % (season === 'autumn' ? 4 : 3)];
  if (iso) {
    if (kind === 'fern') fernIso(c, r, season, fine);
    else if (kind === 'sapling') spruceIso(c, r, SPRUCE, season, fine, RB * 2.1, RB * 0.75);
    else shrubIso(c, r, P, season, fine, kind === 'berry');
    return;
  }
  if (kind === 'fern') {
    ell(c, 2, 2.5, RB * 0.8, RB * 0.75, 'rgba(8,14,6,0.22)');
    const n = 8;
    const a0 = r() * TAU;
    for (let i = 0; i < n; i++) frond(c, a0 + (i / n) * TAU, RB * (0.8 + r() * 0.3), FERN[season] ?? FERN.summer, fine, season === 'winter', 1);
  } else if (kind === 'sapling') spruceTop(c, r, SPRUCE, season, fine, RB * 0.75);
  else {
    shadowTop(c, RB * 0.85, RB * 0.3, RB * 0.38, 0.26);
    if (season === 'winter') {
      ell(c, 0, 0, RB * 0.75, RB * 0.75, 'rgba(90,70,54,0.55)');
      ell(c, -1, -1, RB * 0.55, RB * 0.5, rgba(SNOW[0], 0.9));
      return;
    }
    const ks = [];
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * RB * 0.45;
      ks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: RB * (0.36 + r() * 0.12) });
    }
    ks.sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const k of ks) leafClump(c, r, k, P, 0.6 - (k.x + k.y) / (RB * 2), fine);
    if (kind === 'berry' && fine) for (let i = 0; i < 9; i++) ell(c, (r() - 0.5) * RB, (r() - 0.5) * RB, 0.7, 0.7, BERRY[season] ?? BERRY.summer);
  }
}

const BUSH_ISO = [-21, -26, 21, 5];
const BUSH_TOP = [-13, -13, 15, 15];

/** Busch in Iso (Fuß am Weltpunkt). false = noch kein Bild. */
export function drawBushIso(ctx, cam, b, season = 'summer') {
  const L = bushLook(b);
  const f = cam.zoom * L.size;
  const e = sprite(`nb|${L.kind}|${L.shape}|${L.pv}|${season}`, f * spriteDpr(), BUSH_ISO, (c, s) => paintBush(c, s, L.kind, L.shape, L.pv, season, true));
  if (!e) return false;
  const p = cam.worldToScreen(b.x, b.y);
  blit(ctx, e, p.x, p.y, f);
  return true;
}

/** Busch von oben (2D). false = noch kein Bild. */
export function drawBushTop(ctx, b, season = 'summer', zoom = 1) {
  const L = bushLook(b);
  const e = sprite(`nbt|${L.kind}|${L.shape}|${L.pv}|${season}`, zoom * spriteDpr() * L.size, BUSH_TOP, (c, s) => paintBush(c, s, L.kind, L.shape, L.pv, season, false));
  if (!e) return false;
  blit(ctx, e, b.x, b.y, L.size);
  return true;
}

// ---------- Schatten in Iso (ein Pfad für alle, danach einmal gefüllt) ----------

const SHADOW_W = { broad: 1.18, birch: 0.88, spruce: 0.82, pine: 1.0 };

/**
 * Hängt den Schatten eines Baums (t 1), Felsens (2) oder Buschs (13) als Ellipse an den laufenden Pfad (Bildschirmkoordinaten).
 * Schatten fallen nach links unten wie bei den Gebäuden; der Renderer füllt alle zusammen vor den Objekten.
 */
export function natureShadowIso(ctx, cam, o, t) {
  const p = cam.worldToScreen(o.x, o.y);
  const z = cam.zoom;
  let w;
  let dx = -0.5;
  if (t === 1) {
    const L = treeLook(o);
    w = R * L.size * z * SHADOW_W[L.sp];
  } else if (t === 2) {
    w = o.r * z * 0.95;
    dx = -0.3;
  } else {
    w = o.r * z;
    dx = -0.3;
  }
  const cx = p.x + dx * w;
  const cy = p.y + 0.12 * w;
  const rx = 1.2 * w;
  const rot = -0.1;
  ctx.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));
  ctx.ellipse(cx, cy, rx, 0.5 * w, rot, 0, TAU);
}

// ---------- Felsen (3D-Modelle) ----------
// Natürliche Felsen (Paket „Felsen“): fein unterteilter Ikosaeder ohne Polspitze, mit weichem Rauschen verbeult, flach gedrückt und an
// einigen Ebenen „abgeschlagen“ (flache Bruchflächen), unten im Boden. Farbe je Fläche: Ton wechselt, Mulden dunkler, Moos und
// Flechten fleckig auf Oberseiten, im Winter Schnee auf den flachen Oberseiten; darüber das Gesteinsfoto (materials.js, „rock“).

const ROCK_COLS = ['#8e8f88', '#8c8272', '#78797a', '#979080'];
const ROCK_MOSS = { summer: ['#5d6e36', '#71833f'], autumn: ['#6f6a3a', '#827544'], winter: ['#5d6e36', '#71833f'] };
const LICHEN = ['#b8b28c', '#a8ad8a', '#c6bc8f', '#9aa08c'];
const ROCK_SNOW = '#eef2f5';

/** Ikosaeder, levels-mal unterteilt (1: 80, 2: 320 Dreiecke, gleichmäßig, ohne Polspitze): Ecken als Einheitsvektoren, Flächen als Indizes. */
const icosphere = (levels) => {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const unit = (p) => {
    const l = Math.hypot(...p);
    return p.map((x) => x / l);
  };
  V = V.map(unit);
  for (let k = 0; k < levels; k++) {
    const mid = new Map();
    const at = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mid.has(key)) {
        V.push(unit([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]));
        mid.set(key, V.length - 1);
      }
      return mid.get(key);
    };
    const G = [];
    for (const [a, b, c] of F) {
      const ab = at(a, b);
      const bc = at(b, c);
      const ca = at(c, a);
      G.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    F = G;
  }
  return { V, F };
};
const GEO = [null, icosphere(1), icosphere(2)]; // fein für den Hauptstein, gröber für Begleiter (Malzeit)

/** Weiches Rauschen: Summe von Sinuswellen in festen Zufallsrichtungen (Wellenzahl freq, Ausschlag amp), Werte etwa −amp … amp. */
function waves(r, n, freq, amp) {
  const W = [];
  for (let i = 0; i < n; i++) {
    const z = r() * 2 - 1;
    const a = r() * TAU;
    const q = Math.sqrt(1 - z * z);
    W.push([q * Math.cos(a), q * Math.sin(a), z, freq * (0.6 + r() * 0.9) * (1 + i * 0.35), r() * TAU, amp / (1 + i * 0.45)]);
  }
  const norm = W.reduce((s, w) => s + w[5], 0) / amp;
  return (p) => {
    let v = 0;
    for (const [x, y, z, k, ph, a] of W) v += a * Math.sin(k * (x * p[0] + y * p[1] + z * p[2]) + ph);
    return v / norm;
  };
}

/** Farbe als Hex aus [r, g, b]. */
const hex3 = (c) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

/**
 * Fels um (cx, cy) mit Halbachsen rx, ry, rz: cuts Bruchflächen, bury Anteil im Boden, moss (0 … 1) Moosmenge, season Jahreszeit.
 */
function boulder(r, cx, cy, rx, ry, rz, col, o) {
  const { cuts = 2, bury = 0.3, moss = 0, season = 'summer', fine = 2 } = o;
  const geo = GEO[fine];
  const bump = waves(r, 5, 1.7, 0.14); // große Beulen
  const grain = waves(r, 4, 6, 0.035); // kleine Höcker
  const P = geo.V.map((v) => {
    const f = 1 + bump(v) + grain(v);
    return [v[0] * rx * f, v[1] * ry * f, v[2] * rz * f];
  });
  const dent = geo.V.map((v) => bump(v)); // Mulden (negativ) später dunkler
  // Bruchflächen: alles jenseits einer Ebene wird auf die Ebene gelegt
  for (let i = 0; i < cuts; i++) {
    const z = -0.15 + r() * 0.95;
    const a = r() * TAU;
    const q = Math.sqrt(1 - z * z);
    const n = [q * Math.cos(a), q * Math.sin(a), z];
    const reach = Math.abs(n[0]) * rx + Math.abs(n[1]) * ry + Math.abs(n[2]) * rz;
    const d = (0.5 + r() * 0.3) * (reach / (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])));
    for (const p of P) {
      const e = p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - d;
      if (e > 0) for (let k = 0; k < 3; k++) p[k] -= e * n[k];
    }
  }
  const lift = rz * (1 - 2 * bury);
  for (const p of P) {
    p[0] += cx;
    p[1] += cy;
    p[2] = Math.max(0, p[2] + lift);
  }
  const base = rgbOf(col);
  const mossCols = (ROCK_MOSS[season] ?? ROCK_MOSS.summer).map(rgbOf);
  const tone = waves(r, 3, 2.2, 1);
  const patch = waves(r, 6, 6.5, 1); // Flecken (Moos, Schnee)
  const faces = [];
  const fcol = [];
  for (const [a, b, c] of geo.F) {
    const A = P[a];
    const B = P[b];
    const C = P[c];
    if (A[2] === 0 && B[2] === 0 && C[2] === 0) continue; // Boden: unsichtbar
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n);
    if (l < 1e-6) continue;
    const m = [(A[0] + B[0] + C[0]) / 3 - cx, (A[1] + B[1] + C[1]) / 3 - cy, (A[2] + B[2] + C[2]) / 3];
    const nz = (n[2] / l) * Math.sign(n[0] * m[0] + n[1] * m[1] + n[2] * (m[2] - Math.max(0, lift)) || 1); // nach außen
    const dir = geo.V[a];
    // Ton: großflächig wechselnd, Mulden dunkler, ganz unten etwas Erde
    let k = 1 + tone(dir) * 0.09 + Math.min(0, (dent[a] + dent[b] + dent[c]) / 3) * 0.9;
    let rgb = base.map((x) => x * k);
    if (m[2] < rz * 0.12) rgb = rgb.map((x, i) => x * 0.86 + [70, 60, 45][i] * 0.14);
    const pv = patch(dir);
    if (season === 'winter') {
      const sv = pv * 0.6 + (nz - 0.55) * 2.2; // flach und Flecken: Schnee bleibt liegen
      if (sv > 0) rgb = rgbOf(ROCK_SNOW).map((x) => x * (0.95 + 0.05 * pv));
      else if (sv > -0.35) rgb = rgb.map((x, i) => x * 0.45 + rgbOf(ROCK_SNOW)[i] * 0.55);
    } else if (moss > 0 && pv * 0.7 + nz * 0.9 > 1.25 - moss) {
      const mc = mossCols[pv > 0.3 ? 1 : 0];
      const t = Math.min(0.85, 0.5 + (pv * 0.7 + nz * 0.9 - (1.25 - moss)) * 0.8);
      rgb = rgb.map((x, i) => x * (1 - t) + mc[i] * t);
    } else if (nz > -0.1 && r() < 0.05) {
      const lc = rgbOf(LICHEN[Math.floor(r() * LICHEN.length)]);
      rgb = rgb.map((x, i) => x * 0.55 + lc[i] * 0.45); // Flechten
    }
    faces.push([A, B, C]);
    fcol.push(hex3(rgb));
  }
  return PAINT.solid(faces, col, [cx, cy, rz * 0.4], { fcol, smooth: true, mat: 'rock', matWhole: true });
}

// Varianten: [Halbachsen x, y, z (× RR), Bruchflächen, Begleiter, Moos]
const ROCK_SHAPES = [
  [[1.02, 0.84, 0.5], 6, 2, 0.55], // breite Platte mit zwei Steinen, bemoost
  [[0.78, 0.66, 0.84], 7, 1, 0], // hoher kantiger Block
  [[0.94, 0.78, 0.6], 4, 2, 0.4], // runder Granit, etwas Moos
  [[1.08, 0.7, 0.4], 6, 0, 0.15], // flacher Rücken
];

const rockModels = new Map();
/** Fels (Variante v 0 … 3): Hauptblock mit 0 … 2 Begleitern; Moos, Flechten oder Schnee auf den Oberseiten. */
function rockModel(v, season = 'summer') {
  const key = `${v}|${season}`;
  let m = rockModels.get(key);
  if (m) return m;
  const r = rng(5150 + v * 211);
  const col = ROCK_COLS[v % ROCK_COLS.length];
  const [ax, cuts, extra, moss] = ROCK_SHAPES[v % ROCK_SHAPES.length];
  const S = [boulder(r, 0, 0, RR * ax[0] * (0.92 + r() * 0.12), RR * ax[1] * (0.92 + r() * 0.12), RR * ax[2] * (0.92 + r() * 0.14), col, { cuts, moss, season, bury: 0.28 })];
  for (let i = 0; i < extra; i++) {
    const a = (i ? 2.3 : 0.4) + r() * 1.2;
    const d = RR * (0.9 + r() * 0.2);
    const sz = 0.28 + r() * 0.16;
    S.push(boulder(r, Math.cos(a) * d, Math.sin(a) * d, RR * sz * 1.15, RR * sz, RR * sz * 0.72, col, { cuts: 4, moss: moss * 0.7, season, bury: 0.35, fine: 1 }));
  }
  m = { S };
  rockModels.set(key, m);
  return m;
}

function rockLook(o, rot) {
  const h = hashXY(o.x, o.y);
  const sec = ((h >>> 3) + rot * 2) % 8;
  return { v: h % 4, sec, yaw: (sec / 8) * TAU, size: o.r / RR };
}

/** Fels in Iso (Fuß am Weltpunkt), in jeder Drehung der Ansicht von der passenden Seite. false = noch kein Bild. */
export function drawRockIso(ctx, cam, o, season = 'summer') {
  const L = rockLook(o, cam.rot | 0);
  const m = rockModel(L.v, season);
  const f = cam.zoom * L.size;
  const e = sprite(`nr|${L.v}|${season}|${L.sec}`, f * spriteDpr(), PAINT.boundsOf(m, m.S, L.yaw, true), (c, s) => PAINT.paintSolids(c, m.S, L.yaw, { iso: true, s }));
  if (!e) return false;
  const p = cam.worldToScreen(o.x, o.y);
  blit(ctx, e, p.x, p.y, f);
  return true;
}

/** Fels von oben (2D) mit Schatten nach rechts unten. false = noch kein Bild. */
export function drawRockTop(ctx, o, season = 'summer', zoom = 1) {
  const L = rockLook(o, 0);
  const m = rockModel(L.v, season);
  const b = PAINT.boundsOf(m, m.S, L.yaw, false);
  const e = sprite(`nrt|${L.v}|${season}|${L.sec}`, zoom * spriteDpr() * L.size, [b[0], b[1], b[2] + 4, b[3] + 5], (c, s) => {
    c.save();
    c.translate(2.6 * s, 3.4 * s);
    c.globalAlpha = 0.3;
    PAINT.paintSolids(c, m.S, L.yaw, { iso: false, s, shadow: true });
    c.restore();
    PAINT.paintSolids(c, m.S, L.yaw, { iso: false, s });
  });
  if (!e) return false;
  blit(ctx, e, o.x, o.y, L.size);
  return true;
}

// ---------- Tiere (3D-Modelle wie die Soldaten) ----------

const DEER = { body: '#8e6038', dark: '#5f4027', rump: '#efe6d4', antler: '#d9cbb0' };
const BOAR = { body: '#4e3e31', dark: '#30261e', snout: '#8c6e5c', tusk: '#ede7d6' };

/** Haltung eines Tiers: Gehbild nach zurückgelegtem Weg, Flucht im Galopp, beim Äsen meist mit gesenktem Kopf. */
function animalLook(a, now) {
  const moving = a.speed > 0;
  const run = a.speed > 60;
  const graze = !moving && a.state === 'graze' && Math.floor(now / 2600 + a.id * 0.7) % 3 !== 0;
  const frame = moving ? 1 + (Math.floor((a.step ?? 0) / (run ? 9 : 5)) % 4) : 0;
  const buck = a.kind === 'deer' && a.id % 3 === 0;
  return { frame, run, graze, buck, key: `${frame}${run ? 'r' : ''}${graze ? 'g' : ''}${buck ? 'b' : ''}` };
}

function deerModel(o) {
  const { cyl, ball } = PAINT;
  const C = DEER;
  const S = [];
  const ph = o.frame ? ((o.frame - 1) * Math.PI) / 2 : 0;
  const sw = o.frame ? Math.sin(ph) * (o.run ? 3.4 : 1.9) : 0;
  const up = o.run && o.frame ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  for (const [lx, side, k] of [[4.4, -1, 1], [4.4, 1, -1], [-4.6, -1, -1], [-4.6, 1, 1]]) {
    const s = sw * k;
    const y = side * 1.25;
    const knee = [lx + s * 0.45, y, 4.6 + up * 0.5];
    S.push(cyl([lx, y, 9 + up], knee, 0.8, 0.5, 4, C.body));
    S.push(cyl(knee, [lx + s, y, 0.4], 0.45, 0.32, 4, C.dark));
  }
  S.push(ball([0, 0, 10.2 + up], 6.4, 2.6, 3.0, C.body, { n: 10, m: 6 }));
  S.push(ball([-6.1, 0, 10.8 + up], 1.1, 1.45, 1.5, C.rump, { n: 6, m: 4 })); // heller Spiegel
  const hx = o.graze ? 9.4 : 8.6;
  const hz = o.graze ? 4.2 : 16.2;
  S.push(cyl([4.6, 0, 11.4 + up], [hx - 1.2, 0, hz + (o.graze ? 1.6 : -1.0)], 1.45, 1.05, 6, C.body)); // Hals
  S.push(ball([hx, 0, hz], 1.9, 1.2, 1.3, C.body, { n: 8, m: 5 }));
  S.push(cyl([hx + 1.1, 0, hz - 0.2], [hx + 2.6, 0, hz - (o.graze ? 1.4 : 0.6)], 0.85, 0.5, 6, C.dark)); // Äser
  for (const sd of [-1, 1]) {
    S.push(cyl([hx - 0.7, sd * 0.7, hz + 0.9], [hx - 1.4, sd * 2.1, hz + 2.4], 0.55, 0.25, 4, C.dark)); // Lauscher
    if (o.buck) {
      const b = [hx - 0.4, sd * 0.5, hz + 1.1];
      const t = [hx - 0.9, sd * 1.3, hz + 4.8];
      S.push(cyl(b, t, 0.28, 0.15, 4, C.antler));
      S.push(cyl([hx - 0.65, sd * 0.9, hz + 3.0], [hx + 0.5, sd * 1.1, hz + 4.0], 0.17, 0.12, 4, C.antler));
    }
  }
  return { S };
}

function boarModel(o) {
  const { cyl, ball, on, fine } = PAINT;
  const C = BOAR;
  const S = [];
  const ph = o.frame ? ((o.frame - 1) * Math.PI) / 2 : 0;
  const sw = o.frame ? Math.sin(ph) * (o.run ? 2.4 : 1.4) : 0;
  for (const [lx, side, k] of [[3.4, -1, 1], [3.4, 1, -1], [-3.6, -1, -1], [-3.6, 1, 1]]) {
    const y = side * 1.6;
    S.push(cyl([lx, y, 5], [lx + sw * k, y, 0.3], 0.9, 0.55, 4, C.dark));
  }
  const body = ball([-0.4, 0, 6.4], 5.9, 3.0, 3.5, C.body, { n: 10, m: 6 });
  S.push(body);
  S.push(on(body, ball([1.2, 0, 8.7], 3.8, 1.1, 1.6, C.dark, { n: 8, m: 4 }))); // Borstenkamm
  const hz = o.graze ? 2.8 : 5.4;
  S.push(cyl([4.0, 0, 6.8], [8.6, 0, hz], 2.7, 1.05, 8, C.body)); // Kopf (Keil)
  S.push(cyl([8.6, 0, hz], [9.3, 0, hz - 0.15], 1.05, 0.95, 8, C.snout)); // Rüsselscheibe
  for (const sd of [-1, 1]) {
    S.push(cyl([4.9, sd * 1.3, 8.0], [4.3, sd * 1.9, 9.8], 0.7, 0.2, 4, C.dark)); // Ohren
    S.push(fine(cyl([7.8, sd * 0.95, hz - 0.2], [8.4, sd * 1.35, hz + 0.9], 0.22, 0.1, 4, C.tusk))); // Hauer
  }
  S.push(cyl([-6.0, 0, 7.4], [-7.0, 0, 5.4], 0.3, 0.2, 4, C.dark)); // Schwanz
  return { S };
}

const animalModels = new Map();
/** Modell eines Tiers (deer, boar) in einer Haltung; klein, bleibt im Speicher. */
function animalModel(kind, look) {
  const key = `${kind}|${look.key}`;
  let m = animalModels.get(key);
  if (!m) animalModels.set(key, (m = kind === 'boar' ? boarModel(look) : deerModel(look)));
  return m;
}

/** Tier in Iso an Bildpunkt p (Boden), Blick nach a.angle (8 Richtungen). false = noch kein Bild (Ersatz im Renderer). */
export function drawAnimalIso(ctx, cam, a, p, now = 0) {
  const look = animalLook(a, now);
  const m = animalModel(a.kind, look);
  const n = 8;
  const sec = PAINT.sectorOf(PAINT.viewAngle(cam, a.angle ?? 0), n);
  const key = (k) => `an|${a.kind}|${look.key}|${k}`;
  const yaw = (k) => (k / n) * TAU;
  const f = cam.zoom * ANIMAL_ISO;
  const e = PAINT.getSprite(key(sec), f * spriteDpr(), PAINT.boundsOf(m, m.S, yaw(sec), true), (c, s) => PAINT.paintSolids(c, m.S, yaw(sec), { iso: true, s }), PAINT.nearKeys(key, sec, n));
  if (!e) return false;
  ell(ctx, p.x, p.y + 0.5 * f, 7.5 * f, 3 * f, 'rgba(0,0,0,0.24)');
  blit(ctx, e, p.x, p.y, f);
  return true;
}

/** Tier von oben (2D), gedreht nach a.angle, mit Schatten. false = noch kein Bild. */
export function drawAnimalTopP(ctx, a, zoom = 1, now = 0) {
  const look = animalLook(a, now);
  const m = animalModel(a.kind, look);
  const key = `ano|${a.kind}|${look.key}`;
  const sc = zoom * spriteDpr();
  const b = PAINT.boundsOf(m, m.S, 0, false);
  const e = sprite(key, sc, b, (c, s) => PAINT.paintSolids(c, m.S, 0, { iso: false, s }));
  if (!e) return false;
  const sh = sprite(`${key}|sh`, sc, b, (c, s) => PAINT.paintSolids(c, m.S, 0, { iso: false, s, shadow: true }));
  ctx.save();
  ctx.translate(a.x, a.y);
  if (sh) {
    ctx.save();
    ctx.translate(1.4, 1.8);
    ctx.rotate(a.angle ?? 0);
    ctx.globalAlpha = 0.26;
    blit(ctx, sh, 0, 0, 1);
    ctx.restore();
  }
  ctx.rotate(a.angle ?? 0);
  blit(ctx, e, 0, 0, 1);
  ctx.restore();
  return true;
}



/** Für Tests: alle Felsen- und Tiermodelle (Körper) bauen, ohne zu malen. */
export function natureModels() {
  const out = [];
  for (let v = 0; v < 4; v++) for (const season of ['summer', 'autumn', 'winter']) out.push({ name: `rock${v}${season}`, m: rockModel(v, season) });
  for (const kind of ['deer', 'boar']) {
    for (const frame of [0, 1, 2, 3, 4]) {
      for (const run of [false, true]) {
        for (const graze of [false, true]) {
          const look = { frame, run, graze, buck: kind === 'deer', key: `${frame}${run ? 'r' : ''}${graze ? 'g' : ''}${kind === 'deer' ? 'b' : ''}` };
          out.push({ name: `${kind}${look.key}`, m: animalModel(kind, look) });
        }
      }
    }
  }
  return out;
}
