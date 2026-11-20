// Industrie und Logistik als Props der Karte (Werte js/data/props.js, Gruppe „ind“): Container (bis drei Lagen, Farbe je Lage),
// Paletten, Kistenstapel, Fässer stehend und liegend, Reifenstapel, Gabelstapler, Portalkran, Laderampe, Laternenmast, Stromverteiler.
// Einzelstücke um ihre Mitte, x entlang der Länge, y in die Tiefe, z nach oben (Welt-Pixel); Silhouette aus wenigen Körpern,
// Kleinteile mit fine(). Nur Darstellung; gemalt und zwischengespeichert in mapprops.js.
import { PAINT } from './unitpaint.js';
import { rnd, tilt, snowy } from './fences.js';

const { box, cyl, prY, on, fine, mix } = PAINT;

const BOX_COLS = ['#a23a2c', '#2f5d8a', '#3d6e45', '#c7782e', '#7c8288', '#d8d6cf', '#8a5a2b']; // Reedereifarben
const WOOD = '#b08a5a';
const PALLET = '#a8875c';
const RUBBER = '#232425';
const CON = '#b9b5ab';

// ---------- Container ----------
const CL = 21; // halbe Länge
const CW = 8.5; // halbe Breite
const CH = 18; // Höhe einer Lage

/** Eine Lage Container ab Höhe z0, Farbe col; Wellblech, Türen an +x und Eckbeschläge fein. */
function containerLevel(z0, col, w, top) {
  const S = [];
  const body = box(-CL, CL, -CW, CW, z0, z0 + CH, col, top ? snowy(w) : {});
  S.push(body);
  const rib = mix(col, '#000000', 0.18);
  for (let x = -CL + 1.5; x < CL - 1; x += 2.2) for (const s of [-1, 1]) S.push(fine(on(body, box(x - 0.35, x + 0.35, s * CW - 0.08, s * CW + 0.08, z0 + 0.8, z0 + CH - 0.8, rib, { noLine: true }))));
  S.push(fine(on(body, box(CL - 0.05, CL + 0.08, -0.15, 0.15, z0 + 0.6, z0 + CH - 0.6, rib, { noLine: true })))); // Türfuge
  for (const y of [-4.5, -2, 2, 4.5]) S.push(fine(on(body, box(CL + 0.05, CL + 0.3, y - 0.18, y + 0.18, z0 + 1, z0 + CH - 1, '#6a6d70', { noLine: true })))); // Riegel
  for (const x of [-CL, CL - 1.4]) for (const y of [-CW, CW - 1.4]) for (const z of [z0, z0 + CH - 1.2]) S.push(fine(on(body, box(x, x + 1.4, y, y + 1.4, z, z + 1.2, mix(col, '#000000', 0.35), { noLine: true }))));
  return S;
}

function container(v, d, w, rubble, stack = 1) {
  if (rubble) {
    // aufgerissen und eingedrückt, Türen offen
    const col = mix(BOX_COLS[(d + v) % BOX_COLS.length], '#3a3632', 0.45);
    const S = [tilt(box(-CL, CL, -CW, CW, 0, CH - 3, col), 'x', 0.12, 0, 0, 0)];
    S.push(box(CL - 0.4, CL + 0.4, -CW - 8, -CW, 0, CH - 3, mix(col, '#000000', 0.2)), box(CL - 0.4, CL + 0.4, CW, CW + 8, 0, CH - 3.5, mix(col, '#000000', 0.2)));
    return S;
  }
  const S = [];
  for (let l = 0; l < stack; l++) {
    const col = BOX_COLS[(d * 3 + l * 5 + v) % BOX_COLS.length];
    S.push(...containerLevel(l * CH, col, w, l === stack - 1));
  }
  return S;
}

// ---------- Paletten und Kisten ----------

function pallets(v, d, w) {
  const n = 3 + (d % 4);
  const S = [];
  for (let k = 0; k < n; k++) {
    const z = k * 1.5;
    const dx = (rnd(d, k) - 0.5) * 1.2;
    const top = box(-9 + dx, 9 + dx, -7, 7, z + 0.9, z + 1.4, mix(PALLET, '#000000', (k % 2) * 0.06), k === n - 1 ? snowy(w) : {});
    S.push(top);
    for (const y of [-6, 0, 6]) S.push(fine(on(top, box(-9 + dx, 9 + dx, y - 0.7, y + 0.7, z, z + 0.9, mix(PALLET, '#000000', 0.2), { noLine: true })))); // Kufen
  }
  return S;
}

function crateStack(v, d, w) {
  const col = mix(WOOD, '#000000', (v % 3) * 0.06);
  const S = [];
  const put = (x0, x1, y0, y1, z0, z1, top) => {
    const b = box(x0, x1, y0, y1, z0, z1, mix(col, '#ffffff', rnd(d, x0 + z0) * 0.08), top ? snowy(w) : {});
    S.push(b);
    for (const s of [-1, 1]) S.push(fine(on(b, box(x0 + 0.4, x1 - 0.4, (s > 0 ? y1 : y0) - 0.05, (s > 0 ? y1 : y0) + 0.05, (z0 + z1) / 2 - 0.3, (z0 + z1) / 2 + 0.3, mix(col, '#000000', 0.3), { noLine: true })))); // Leiste
  };
  put(-12, -1, -9, 0, 0, 7, false);
  put(1, 12, -9, 0, 0, 7, d % 2 === 0);
  put(-12, -1, 0.5, 9, 0, 7, false);
  put(1, 12, 0.5, 9, 0, 7, true);
  put(-11, 0, -8, 8, 7, 14, true);
  if (d % 2) put(1, 11, -8, 0, 7, 13, true);
  return S;
}

// ---------- Fässer und Reifen ----------

const BARREL_COLS = ['#2c5d8f', '#9a3229', '#5d6643', '#c99a26'];
const BR = 3.4; // Radius eines Fasses
const BH = 8.6; // Höhe

/** Fass stehend bei (x, y) oder liegend entlang y (lying), Farbe col; Sicken fein. */
function barrel(x, y, z, col, w, lying) {
  const a = lying ? [x, y - BH / 2, z + BR] : [x, y, z];
  const b = lying ? [x, y + BH / 2, z + BR] : [x, y, z + BH];
  const body = cyl(a, b, BR, BR, 12, col, { smooth: true, ...(lying ? {} : snowy(w)) });
  const S = [body];
  for (const t of [0.33, 0.66]) {
    const p = a.map((v, i) => v + (b[i] - v) * t);
    const q = a.map((v, i) => v + (b[i] - v) * (t + 0.03));
    S.push(fine(on(body, cyl(p, q, BR + 0.12, BR + 0.12, 12, mix(col, '#000000', 0.25), { noLine: true }))));
  }
  if (!lying) S.push(fine(on(body, cyl([x + 1.4, y, z + BH], [x + 1.4, y, z + BH + 0.25], 0.6, 0.6, 6, mix(col, '#000000', 0.35), { noLine: true })))); // Spund
  return S;
}

function barrels(v, d, w) {
  const S = [];
  const spots = [[-4, -4], [4, -4], [-4, 4], [4, 4]].slice(0, 3 + (d % 2));
  spots.forEach(([x, y], k) => S.push(...barrel(x + (rnd(d, k) - 0.5), y + (rnd(d, k + 5) - 0.5), 0, BARREL_COLS[(v + k * (d % 2)) % BARREL_COLS.length], w, false)));
  return S;
}

function barrelsLying(v, d, w) {
  const S = [];
  const col = (k) => BARREL_COLS[(v + k * (d % 3)) % BARREL_COLS.length];
  for (let k = 0; k < 3; k++) S.push(...barrel(-7 + k * 7, 0, 0, col(k), w, true));
  for (let k = 0; k < 2; k++) S.push(...barrel(-3.5 + k * 7, 0, BR * 1.75, col(k + 3), w, true));
  return S;
}

function tyres(v, d, w) {
  const S = [];
  const n = 4 + (d % 3);
  for (let k = 0; k < n; k++) {
    const z = k * 2;
    const dx = (rnd(d, k) - 0.5) * 1.4;
    const dy = (rnd(d, k + 7) - 0.5) * 1.4;
    const t = cyl([dx, dy, z], [dx, dy, z + 1.9], 6.4, 6.4, 14, mix(RUBBER, '#ffffff', (k % 2) * 0.04), { smooth: true });
    S.push(t);
    if (k === n - 1) S.push(on(t, cyl([dx, dy, z + 1.9], [dx, dy, z + 1.95], 3.4, 3.4, 12, '#0f1011', { noLine: true, ...snowy(w) }))); // Loch oben
  }
  return S;
}

// ---------- Gabelstapler ----------

function forklift(v, d, w, rubble) {
  const col = rubble ? '#3b3733' : ['#d9a520', '#cf6a1d', '#b8322a'][v % 3];
  const S = [];
  for (const x of [-6.5, 5]) for (const s of [-1, 1]) S.push(cyl([x, s * 4.6, 2.2], [x, s * 5.8, 2.2], 2.2, 2.2, 10, RUBBER, { smooth: true }));
  const body = box(-10, 6, -4.6, 4.6, 1.2, 6.5, col);
  S.push(body, on(body, box(-11, -6, -4.4, 4.4, 6.5, 9, mix(col, '#000000', 0.3)))); // Gegengewicht
  if (rubble) return S;
  S.push(on(body, box(-5, -1.5, -2, 2, 6.5, 9, '#2f3134'))); // Sitz
  for (const x of [-6, 3]) for (const s of [-1, 1]) S.push(on(body, box(x - 0.4, x + 0.4, s * 4 - 0.4, s * 4 + 0.4, 6.5, 16, '#2f3134'))); // Schutzdach-Pfosten
  S.push(on(body, box(-6.5, 3.5, -4.4, 4.4, 16, 16.6, '#2f3134', snowy(w)))); // Schutzdach
  for (const s of [-1, 1]) S.push(box(7, 8, s * 3 - 0.5, s * 3 + 0.5, 1, 20, '#3a3d40')); // Hubmast
  for (const s of [-1, 1]) S.push(fine(box(8, 16, s * 2.6 - 0.5, s * 2.6 + 0.5, 0.8, 1.3, '#4a4d50'))); // Gabeln
  return S;
}

// ---------- Portalkran ----------

function gantry(v, d, w, rubble) {
  const col = rubble ? '#5a4f3e' : ['#d6a32a', '#2f6aa0', '#c8562e'][v % 3];
  const H = 46;
  const S = [];
  if (rubble) {
    for (const x of [-58, 58]) S.push(tilt(box(x - 2, x + 2, -20, 20, 0, 4, col), 'x', 0.2, x, 0, 0));
    S.push(tilt(box(-56, 56, -3, 3, 0, 4, col), 'y', 0.06, 0, 0, 0));
    return S;
  }
  for (const x of [-58, 58]) {
    for (const y of [-19, 19]) S.push(box(x - 1.8, x + 1.8, y - 1.8, y + 1.8, 0, H, col));
    S.push(box(x - 2, x + 2, -21, 21, H - 4, H, col)); // Querträger
    S.push(box(x - 3, x + 3, -21, -17, 0, 2, '#3a3d40'), box(x - 3, x + 3, 17, 21, 0, 2, '#3a3d40')); // Fahrwerk
    for (const y of [-19, 19]) S.push(fine(cyl([x, y, 4], [x, -y * 0.2, H - 6], 0.35, 0.35, 4, col, { noLine: true }))); // Strebe
  }
  for (const y of [-14, 14]) S.push(box(-60, 60, y - 1.5, y + 1.5, H, H + 4, col, snowy(w))); // Kranbahn oben
  const tx = -20 + (d % 4) * 12;
  S.push(box(tx - 5, tx + 5, -14, 14, H + 4, H + 9, mix(col, '#000000', 0.2), snowy(w))); // Laufkatze
  S.push(box(tx - 4, tx + 4, -9, -3, H + 4.5, H + 8, '#4f6b80')); // Kabine
  S.push(fine(cyl([tx, 0, H + 4], [tx, 0, 14], 0.15, 0.15, 3, '#2a2c2e', { noLine: true })), box(tx - 1.5, tx + 1.5, -1.5, 1.5, 11, 14, '#2a2c2e')); // Seil, Haken
  return S;
}

// ---------- Laderampe ----------

function dock(v, d, w, rubble) {
  const c = mix(CON, '#000000', (v % 3) * 0.05);
  if (rubble) {
    const S = [];
    for (let k = 0; k < 6; k++) {
      const x = (rnd(d, k) - 0.5) * 56;
      const y = (rnd(d, k + 10) - 0.5) * 16;
      S.push(tilt(box(x - 4, x + 4, y - 3, y + 3, 0, 2 + rnd(d, k + 20) * 3, mix(c, '#000000', rnd(d, k + 30) * 0.2), { vary: 0.2 }), 'x', (rnd(d, k + 40) - 0.5) * 0.6, x, y, 0));
    }
    return S;
  }
  const deck = box(-32, 32, -12, 12, 0, 8, c, snowy(w));
  const S = [deck];
  for (let x = -26; x <= 26; x += 13) S.push(on(deck, box(x - 1.6, x + 1.6, 12, 12.9, 2, 6.5, RUBBER))); // Puffer
  S.push(fine(on(deck, box(-32, 32, 11.95, 12.05, 7.2, 8, '#e0b42a', { noLine: true })))); // gelbe Kante
  for (let k = 0; k < 4; k++) S.push(box(-40 + k * 2, -32, -12, -4, 0, 8 - k * 2, mix(c, '#000000', 0.08), snowy(w))); // Treppe
  return S;
}

// ---------- Laterne und Stromverteiler ----------

function lamp(v, d, w, rubble) {
  const pole = '#4a5054';
  if (rubble) return [box(-3, 3, -3, 3, 0, 2.5, pole), cyl([2, 0, 1], [30, 4, 0.8], 0.6, 0.5, 6, pole), box(29, 34, 2, 6, 0, 1.6, '#2f3336')];
  const S = [box(-1.6, 1.6, -1.6, 1.6, 0, 3, pole), cyl([0, 0, 3], [0, 0, 32], 0.7, 0.5, 6, pole)];
  S.push(cyl([0, 0, 31], [6, 0, 33.5], 0.4, 0.4, 5, pole));
  const head = box(4.5, 10, -1.6, 1.6, 32.4, 34, '#2f3336', snowy(w));
  S.push(head, on(head, box(5, 9.5, -1.2, 1.2, 32.2, 32.4, '#f4eecb', { noLine: true }))); // Leuchte
  return S;
}

function powerBox(v, d, w) {
  const col = ['#7e8a7c', '#8f9592', '#6f7a66'][v % 3];
  const body = box(-6, 6, -3, 3, 0.8, 11, col, snowy(w));
  const S = [box(-6.5, 6.5, -3.5, 3.5, 0, 0.8, CON), body];
  S.push(fine(on(body, box(-0.08, 0.08, 2.95, 3.05, 1.5, 10.4, mix(col, '#000000', 0.35), { noLine: true })))); // Türfuge
  S.push(fine(on(body, prY([[3.05, 7.4], [3.1, 7.4], [3.1, 9.4], [3.05, 9.4]], 1.5, 4, '#e8c83a', { noLine: true })))); // Warnschild
  return S;
}

const SINGLE = {
  container,
  pallets,
  crate_stack: crateStack,
  barrels,
  barrels_lying: barrelsLying,
  tyres,
  forklift,
  gantry_crane: gantry,
  loading_dock: dock,
  street_lamp: lamp,
  power_box: powerBox,
};

/** Gibt es ein Modell dieser Art hier? */
export const isIndSingle = (kind) => !!SINGLE[kind];

/** Körper eines Einzelstücks der Industrie (Modellrichtung). stack: Lagen (Container). */
export function indModel(kind, v, d, w, rubble, stack = 1) {
  const f = SINGLE[kind];
  return f ? f(v, d, w, rubble, stack) : [];
}
