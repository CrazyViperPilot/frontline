// Großbauten der Stadt in 3D aus dem Baukasten (kit3d.js), Paket „Großbauten 3D“: Kaserne, Fabrikhalle, Lagerhalle und Güterbahnhof
// aus render/bigbuild.js (je Stufe 1 bis 3) und die Universität aus render/university.js, mit denselben Maßen, Farben und Bauteilen
// wie gemalt, dazu die Rückseiten (Fenster, Tore, Streifen), die gemalt nie zu sehen sind. Örtliche Koordinaten ab der Mitte der Anlage:
// u = Welt-x, v = Welt-y, h = Höhe. Die Körper kommen aus bigPlan (bigbuild.js, dieselbe Liste wie das gemalte Bild); Bäume und
// Ausstellungsstücke (Einheitenmodelle) bleiben gemalte Billboards, ebenso der Fliegerhorst (Paket „Fliegerhorst 3D“) und der Boden
// (Höfe, Gleise, Pflaster, Rasen: Durchlauf „Boden“ in citylayer.js, liegt zwischen Gelände und Objekten). Gemalte Schatten entfallen
// (Schattenkarte). Teamfarbe: Streifen, Fahnen und Turmbanner tragen aInfo.y = 97 und nehmen die Farbe der Instanz (instanceColor),
// eine Geometrie je Art und Stufe für alle Teams. Kein Rauch, keine Bewegung (wie Werke 3D).
import { Kit3D } from './kit3d.js';
import { sawRoof } from './works3d.js';
import { bigPlan } from '../render/bigbuild.js';
import { UNI_DIM } from '../render/university.js';
import { clampLv, tint } from '../render/isokit.js';
import { hashXY } from '../render/color.js';

const TEAM0 = '#3a6fb3'; // Platzhalter der Teamfarbe in der Geometrie (die Instanz tönt sie um)

/** Großbauten aus bigbuild.js, die hier in 3D stehen (der Fliegerhorst aus airbase.js folgt mit „Fliegerhorst 3D“). */
export const BIG3D_KINDS = ['barracks', 'factory', 'warehouse', 'station'];
export const hasBig3d = (kind) => BIG3D_KINDS.includes(kind);
/** Körper eines Plans (bigPlan), die hier Mesh werden; Bäume, Ausstellungsstücke und Fliegerhorst-Teile bleiben gemalt. */
export const isBig3dPart = (p) => p.t === 'box' || p.t === 'cyl' || p.t === 'flag';

export const bigKey = (kind, level) => `${kind}|${clampLv(level)}`;
export const uniKey = (level) => `uni|${clampLv(level)}`;

// ---------- Körper aus bigbuild.js ----------

/** Rolltor wie isobuild.gate: Rahmen, dunkle Öffnung, oben Lamellen mit drei Linien. a = Mitte entlang der Wand. */
function gate(k, face, plane, a, w, h) {
  const F = (a0, a1, h0, h1, col, off) => k.facePanel(face, plane, a0, a1, h0, h1, col, off, { mat: null, snow: false });
  F(a - w / 2 - 2.5, a + w / 2 + 2.5, 0, h + 3, '#c9b24a', 0.06);
  F(a - w / 2, a + w / 2, 0, h, '#1b1f22', 0.12);
  F(a - w / 2, a + w / 2, h * 0.72, h, '#8b9096', 0.14);
  for (let i = 1; i <= 3; i++) {
    const hh = h * (0.72 + (0.28 * i) / 4);
    F(a - w / 2, a + w / 2, hh - 0.12, hh + 0.12, '#5c6166', 0.16);
  }
}

/** Fahne wie bigbuild.drawBigPart: weißer Mast, Fahne 16 × 10 in Teamfarbe an der Spitze. */
function flag(k, p) {
  k.rod([p.x, p.y, 0], [p.x, p.y, p.h], 1.6, '#e4e4dc');
  k.banner(p.x, p.y, p.h, 16, 10, TEAM0, true);
}

/** Zylinder (Schornstein, Tank): unten r, oben r1, optional zwei Farbringe unter der Mündung (band), offene Mündung dunkel. */
function cylinder(k, p) {
  const b = p.base ?? 0;
  const open = p.r1 < p.r * 0.8;
  k.frustum(p.x, p.y, p.r, p.r1, b, b + p.h, p.c, { n: 14, topCol: open ? '#3a3734' : tint(p.c, 0.18), mat: null });
  if (p.band) {
    const w = Math.max(1.5, p.h * 0.04) / 2;
    for (const f of [0.86, 0.94]) {
      const h0 = b + p.h * f - w;
      const h1 = b + p.h * f + w;
      const rr = (h) => p.r + ((p.r1 - p.r) * (h - b)) / p.h + 0.12;
      k.frustum(p.x, p.y, rr(h0), rr(h1), h0, h1, p.band, { n: 14, top: false, mat: null, snow: false });
    }
  }
}

/**
 * Quader mit Schmuck (wie isobuild.drawBigBody, aber an allen vier Wänden): Sockel, Band in Teamfarbe (stripe), Wellblechrippen (ribs),
 * Fensterreihen (win, wg, ww), Rolltore (gates), Tür (door), Satteldach (gable) oder Sheddach (saw). Wände 0 Norden, 1 Osten, 2 Süden, 3 Westen.
 */
function boxBody(k, p) {
  const base = p.base ?? 0;
  const top = base + p.h;
  const [x0, x1, y0, y1] = [p.x0, p.x1, p.y0, p.y1];
  const roofed = !!(p.gable || p.saw);
  const mat = p.mat ?? undefined;
  const topMat = p.roofMat ?? undefined;
  k.box(x0, x1, y0, y1, base, top, p.c, p.roof ?? p.c, { top: !roofed, mat, topMat });
  if (!base && p.h > 8) k.plinth(x0, x1, y0, y1, p.c);
  if (p.stripe) {
    k.team = true;
    k.wallBand(x0, x1, y0, y1, top - 4.5, top - 1, TEAM0);
    k.team = false;
  }
  if (p.ribs) k.ribs(x0, x1, y0, y1, 4, top, 6, p.c);
  const seed = hashXY(x0, y0);
  // Wand: [Seite, Ebene, Anfang, Länge] je Wandnummer (0 Norden … 3 Westen)
  const walls = [['n', y0, x0, x1 - x0], ['e', x1, y0, y1 - y0], ['s', y1, x0, x1 - x0], ['w', x0, y0, y1 - y0]];
  walls.forEach(([face, plane, a0, len], edge) => {
    if (len < 14) return;
    const gt = p.gates?.e.includes(edge) ? p.gates : null;
    const dr = p.door?.includes(edge);
    if (p.win) {
      const rows = (gt ? p.win.filter(([h0]) => h0 > gt.h + 4) : p.win).map(([h0, h1]) => [base + h0, base + h1]);
      const n = Math.max(1, Math.round(len / (p.wg ?? 20)));
      const dw = 8 / len;
      if (rows.length) {
        const at = Array.from({ length: n }, (_, i) => a0 + ((i + 0.5) / n) * len);
        k.winsAt(face, plane, at, rows, p.ww ?? 8, { seed: seed + edge * 3, lit: 0.22, skip: dr ? (i, r) => r === 0 && Math.abs((i + 0.5) / n - 0.5) < dw * 1.6 : null });
      }
    }
    if (gt) for (let i = 0; i < gt.n; i++) gate(k, face, plane, a0 + ((i + 0.5) / gt.n) * len, gt.w, gt.h);
    if (dr) k.door(face, plane, a0 + len / 2, 8, Math.min(12, p.h - 3), '#4a4f55');
  });
  if (p.gable) k.gable(x1 - x0 >= y1 - y0 ? 'u' : 'v', x0, x1, y0, y1, top, p.gable, p.roof, p.c, 0.4, 0.6);
  if (p.saw) sawRoof(k, x0, x1, y0, y1, top, p.saw.n, p.saw.rh, p.roof, p.c);
}

const bigCache = new Map(); // Art|Stufe → BufferGeometry

/**
 * Geometrie einer Großbau-Art (Kaserne, Fabrikhalle, Lagerhalle, Güterbahnhof) und Stufe 1 bis 3, je Variante einmal gebaut; null,
 * wenn es keine gibt. Mitte der Anlage = Ursprung; die Gleisanschlüsse des Güterbahnhofs betreffen nur den Boden (gemalt).
 */
export function bigGeometry(kind, level) {
  if (!hasBig3d(kind)) return null;
  const lv = clampLv(level);
  const key = bigKey(kind, lv);
  let g = bigCache.get(key);
  if (!g) {
    const k = new Kit3D();
    for (const p of bigPlan(kind, lv, 0, 0, 1, 0).bodies) {
      if (p.t === 'box') boxBody(k, p);
      else if (p.t === 'cyl') cylinder(k, p);
      else if (p.t === 'flag') flag(k, p);
    }
    g = k.geometry();
    bigCache.set(key, g);
  }
  return g;
}

// ---------- Universität (university.js) ----------

const { LV, TOWER, WALL, STONE, FLAT, ROOF, SLATE, GOLD, DOME, LEAF } = UNI_DIM;
const DOME_COL = tint(DOME[1], 0.14); // gemalt Verlauf Licht → Schatten, hier eine Farbe, das Licht schattiert

/** Fenster einer Wand (Mitte der Fenster gleichmäßig zwischen a0 und a1, wie university.windows), Rundbogen wahlweise. */
function uwin(k, face, plane, a0, a1, h0, h1, gap, ww, arch, seed) {
  const n = Math.max(1, Math.floor((a1 - a0) / gap));
  const step = (a1 - a0) / n;
  const at = Array.from({ length: n }, (_, i) => a0 + step * (i + 0.5));
  if (arch) k.archWins(face, plane, at, h0, h1, ww, { seed, lit: 0.2 });
  else k.winsAt(face, plane, at, [[h0, h1]], ww, { seed, lit: 0.2, frame: STONE });
}

/** Fenster an allen vier Wänden eines Quaders [−cu, cu] × [−cv, cv] ab Mitte (cu0, cv0). */
function uwin4(k, [u0, u1, v0, v1], h0, h1, gap, ww, arch, seed) {
  uwin(k, 's', v1, u0 + 4, u1 - 4, h0, h1, gap, ww, arch, seed);
  uwin(k, 'n', v0, u0 + 4, u1 - 4, h0, h1, gap, ww, arch, seed + 5);
  uwin(k, 'e', u1, v0 + 4, v1 - 4, h0, h1, gap, ww, arch, seed + 9);
  uwin(k, 'w', u0, v0 + 4, v1 - 4, h0, h1, gap, ww, arch, seed + 13);
}

/** Quader in Achsen-Koordinaten (a entlang der Achse 'u' oder 'v', Richtung s, b quer). */
function axisBox(k, axis, s, a0, a1, b0, b1, h0, h1, wall, top, o = {}) {
  const [lo, hi] = s > 0 ? [a0, a1] : [-a1, -a0];
  if (axis === 'u') k.box(lo, hi, b0, b1, h0, h1, wall, top, o);
  else k.box(b0, b1, lo, hi, h0, h1, wall, top, o);
}

/** Säulenportal mit Treppe und Dreiecksgiebel vor der Wand bei d (wie university.portico), Giebel auf beiden Seiten. */
function portico(k, axis, s, d, colTop) {
  const depth = 12;
  const half = 19;
  axisBox(k, axis, s, d, d + depth + 3, -half - 2, half + 2, 0, 3, STONE, STONE, { mat: null });
  for (const b of [-14, -5, 5, 14]) {
    const a = s * (d + depth - 2);
    const [u, v] = axis === 'u' ? [a, b] : [b, a];
    k.box(u - 1.6, u + 1.6, v - 1.6, v + 1.6, 3, colTop, STONE, STONE, { mat: null });
  }
  axisBox(k, axis, s, d, d + depth, -half, half, colTop, colTop + 3, STONE, STONE, { mat: null });
  const [lo, hi] = s > 0 ? [d, d + depth] : [-d - depth, -d];
  if (axis === 'u') k.gable('u', lo, hi, -half, half, colTop + 3, 8, ROOF, STONE, 0.3, 0.6);
  else k.gable('v', -half, half, lo, hi, colTop + 3, 8, ROOF, STONE, 0.3, 0.6);
}

/** Flügel entlang der Achse (Richtung s) vom Kuppelbau bis zum Portal, Fenster an beiden Längsseiten (wie university.wing). */
function wing(k, axis, s, L) {
  const w = L.armW;
  axisBox(k, axis, s, L.core - 1, L.arm, -w, w, 0, L.armH, WALL, WALL);
  const [lo, hi] = s > 0 ? [L.core, L.arm] : [-L.arm, -L.core];
  if (axis === 'u') {
    uwin(k, 's', w, lo + 3, hi - 3, 7, 17, 9, 3.4, true, 21 + s);
    uwin(k, 'n', -w, lo + 3, hi - 3, 7, 17, 9, 3.4, true, 25 + s);
    k.gable('u', lo, hi, -w - 1.5, w + 1.5, L.armH, 11, ROOF, WALL, 0.3, 0.6);
  } else {
    uwin(k, 'e', w, lo + 3, hi - 3, 7, 17, 9, 3.4, true, 31 + s);
    uwin(k, 'w', -w, lo + 3, hi - 3, 7, 17, 9, 3.4, true, 35 + s);
    k.gable('v', -w - 1.5, w + 1.5, lo, hi, L.armH, 11, ROOF, WALL, 0.3, 0.6);
  }
}

/** Eckturm mit Fenstern, Bannern in Teamfarbe, Gesims, Pyramidendach und Goldknauf (wie university.tower). */
function tower(k, cu, cv) {
  const T = TOWER;
  const s = T.half;
  k.box(cu - s, cu + s, cv - s, cv + s, 0, T.h, WALL, WALL);
  uwin(k, 's', cv + s, cu - s + 3, cu + s - 3, 26, 34, 10, 3.2, true, 41);
  uwin(k, 'n', cv - s, cu - s + 3, cu + s - 3, 26, 34, 10, 3.2, true, 43);
  uwin(k, 'e', cu + s, cv - s + 3, cv + s - 3, 26, 34, 10, 3.2, true, 47);
  uwin(k, 'w', cu - s, cv - s + 3, cv + s - 3, 26, 34, 10, 3.2, true, 49);
  k.team = true;
  for (const [face, plane] of [['s', cv + s], ['n', cv - s], ['e', cu + s], ['w', cu - s]]) {
    const a = face === 's' || face === 'n' ? cu : cv;
    k.facePoly(face, plane, [[a - 3, 22], [a + 3, 22], [a + 3, 8], [a, 5], [a - 3, 8]], TEAM0, 0.3);
  }
  k.team = false;
  k.box(cu - s - 1.5, cu + s + 1.5, cv - s - 1.5, cv + s + 1.5, T.h, T.h + 2.5, STONE, STONE, { mat: null });
  k.pyramid(cu, cv, s + 1.5, T.h + 2.5, T.roof, SLATE);
  k.ball(cu, cv, T.h + 2.5 + T.roof, 1.8, GOLD, 1.8, 6, 3);
}

/** Kuppelbau: Quader mit zwei Fensterreihen, Gesims, Sockelring, Tambour mit Fenstern, Kuppel mit Rippen, Laterne, Mast und Fahne. */
function core(k, L) {
  const c = L.core;
  const H = L.coreH;
  k.box(-c, c, -c, c, 0, H, WALL, FLAT);
  uwin4(k, [-c, c, -c, c], 6, 15, 10, 4, true, 3);
  uwin4(k, [-c, c, -c, c], 20, 26, 10, 3.4, false, 17);
  k.box(-c - 2, c + 2, -c - 2, c + 2, H, H + 3, STONE, FLAT, { mat: null });
  const base = H + 3;
  k.cyl(0, 0, L.dome + 3, base, base + 3, STONE, { n: 24, mat: null });
  k.cyl(0, 0, L.dome, base + 3, base + 3 + L.drum, WALL, { n: 24 });
  k.cylWins(0, 0, L.dome, base + 3 + L.drum * 0.22, base + 3 + L.drum * 0.77, Array.from({ length: 10 }, (_, i) => ((i + 0.5) / 10) * Math.PI * 2), 3.4, UNI_DIM.GLASS);
  const dh = base + 3 + L.drum;
  k.dome(0, 0, dh, L.dome, L.dome, DOME_COL, 0, 24, 8);
  k.domeRibs(0, 0, dh, L.dome, L.dome, 8, '#2f6e56', 7, 0.8, Math.PI / 8);
  let top = dh + L.dome;
  if (L.lantern) {
    k.cyl(0, 0, 4.5, top - 1, top + 6, STONE, { n: 12, mat: null });
    k.dome(0, 0, top + 6, 4.8, 4.8, GOLD, 0, 12, 4);
    top += 11;
  }
  k.rod([0, 0, top], [0, 0, top + 13], 0.9, '#d9d4c4');
  k.banner(0, 0, top + 13, 10, 6, TEAM0, true);
}

/** Baum des Hofs wie university.tree: Stamm bis 9, Krone (Kugel, Radius 9,5) auf 17. */
function oak(k, u, v) {
  k.cyl(u, v, 1.1, 0, 9, '#5a4030', { n: 6, top: false, mat: null });
  k.ball(u, v, 17, 9.5, LEAF[1], 9, 10, 6);
}

/** Universität, Stufe 1 bis 3: wie university.drawUniversityIso (Kuppelbau, Portale, Flügel, Ecktürme, Bäume), an allen vier Seiten. */
function university(k, lv) {
  const L = LV[lv];
  const T = TOWER.at;
  const t = L.trees;
  const colTop = L.arm ? 20 : 18;
  const d = L.arm || L.core;
  for (const [u, v] of [[-t, -t], [t, -t], [-t, t], [t, t]]) oak(k, u, v);
  if (L.towers) for (const [u, v] of [[-T, -T], [T, -T], [-T, T], [T, T]]) tower(k, u, v);
  for (const axis of ['u', 'v']) {
    for (const s of [-1, 1]) {
      portico(k, axis, s, d, colTop);
      if (L.arm) wing(k, axis, s, L);
    }
  }
  core(k, L);
}

const uniCache = new Map();

/** Geometrie der Universität (Stufe 1 bis 3), Mitte des 3 × 3-Quadrats = Ursprung; Teamfarbe von der Instanz. */
export function uniGeometry(level) {
  const lv = clampLv(level);
  let g = uniCache.get(lv);
  if (!g) {
    const k = new Kit3D();
    university(k, lv);
    g = k.geometry();
    uniCache.set(lv, g);
  }
  return g;
}
