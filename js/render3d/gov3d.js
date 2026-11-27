// Regierungsgebäude und Regierungsviertel der Hauptstadt in 3D aus dem Baukasten (kit3d.js), Paket „Großbauten 3D“: das Rathaus
// aus render/cityhall.js (Terrasse, Hauptbau mit Rundbogenfenstern, vier Portiken, Balustrade, Tambour mit Säulenkranz, Kuppel mit
// Rippen, Laterne, Mast und große Fahne) und die Teile des Viertels aus render/govquarter.js (klassisches und modernes Ministerium,
// Wache, Schilderhaus, Schranke, Obelisk, Fahnen, Brunnen, Bänke, Bäume, Dienstwagen, Laternen), je mit denselben Maßen und Farben
// wie gemalt, dazu die Rückseiten. Örtliche Koordinaten ab der Mitte der Hauptstadt: u = Welt-x, v = Welt-y, h = Höhe. Der Boden
// des Viertels (Rasen, Prachtstraßen, Platz, Parkplätze: Bodenbild drawQuarterGround) bleibt gemalt, er liegt im Durchlauf „Boden“
// unter den Objekten. Das Viertel ist je Team gedreht (TURN in govquarter.js): eine Geometrie je Drehung und Bitmaske der freien
// Gruppen (quarterMask), ein Draw-Call je Hauptstadt; Teamfarbe (Banner, Fahnen, Giebelschild) von der Instanz.
import { Kit3D } from './kit3d.js';
import { M, DOME_TOP, HALL_PAL } from '../render/cityhall.js';
import { _quarter, QUARTER_PAL } from '../render/govquarter.js';
import { DECK, shade, tint } from '../render/isokit.js';

const TEAM0 = '#3a6fb3'; // Platzhalter der Teamfarbe in der Geometrie (die Instanz tönt sie um)
const TAU = Math.PI * 2;
const { MARBLE, TRIM, TERRACE, LEAD, ROOF: HROOF, WINDOW, GOLD: HGOLD, LANTERN_H, DOME_C } = HALL_PAL;

// ---------- Regierungsgebäude (cityhall.js) ----------

/** Säulenportikus mit Freitreppe, Gebälk, Dreiecksgiebel und Wappenschild in Teamfarbe (axis 'u'/'v', Richtung s = ±1). */
function hallPortico(k, axis, s) {
  const W = M.portW;
  const ab = (a0, a1, b0, b1, h0, h1, wall, o = {}) => {
    const [lo, hi] = s > 0 ? [a0, a1] : [-a1, -a0];
    if (axis === 'u') k.box(lo, hi, b0, b1, h0, h1, wall, wall, { mat: null, ...o });
    else k.box(b0, b1, lo, hi, h0, h1, wall, wall, { mat: null, ...o });
  };
  ab(M.pod, M.pod + 3, -W - 3, W + 3, 0, M.podH * 0.67, TRIM);
  ab(M.pod + 3, M.pod + 6, -W - 4.5, W + 4.5, 0, M.podH * 0.34, TRIM);
  ab(M.pod + 6, M.pod + 9, -W - 6, W + 6, 0, 0.9, TRIM);
  for (const b of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) {
    const a = s * (M.port - 2);
    const [u, v] = axis === 'u' ? [a, b] : [b, a];
    k.box(u - 1.3, u + 1.3, v - 1.3, v + 1.3, M.podH, M.colH, TRIM, TRIM, { mat: null });
  }
  ab(M.body, M.port, -W - 0.5, W + 0.5, M.colH, M.colH + 3.4, TRIM);
  const h = M.colH + 3.4;
  const [lo, hi] = s > 0 ? [M.body, M.port] : [-M.port, -M.body];
  if (axis === 'u') k.gable('u', lo, hi, -W, W, h, 8, LEAD, TRIM, 0.3, 0.6);
  else k.gable('v', -W, W, lo, hi, h, 8, LEAD, TRIM, 0.3, 0.6);
  // Giebelfeld außen: Rand und Wappenschild in Teamfarbe
  const face = axis === 'u' ? (s > 0 ? 'e' : 'w') : s > 0 ? 's' : 'n';
  const plane = s * M.port;
  k.facePoly(face, plane, [[-W + 3, h + 0.8], [W - 3, h + 0.8], [0, h + 6.4]], shade(TRIM, 0.07), 0.2);
  k.team = true;
  k.facePoly(face, plane, [[-2, h + 1.4], [2, h + 1.4], [2, h + 4.4], [0, h + 5.6], [-2, h + 4.4]], TEAM0, 0.3);
  k.team = false;
}

/** Wand des Hauptbaus (alle vier): Tür hinter dem Portikus, Rundbogenfenster in zwei Geschossen, Banner, Pilaster, Geschossgesims. */
function hallFacade(k, face) {
  const c = (face === 's' || face === 'e' ? 1 : -1) * (M.body + 0.15);
  const F = (a0, a1, h0, h1, col, off = 0, o = {}) => k.facePanel(face, c, a0, a1, h0, h1, col, off, { mat: null, snow: false, ...o });
  F(-3, 3, M.podH, M.podH + 9, '#5a4430', 0.1);
  for (const [h0, h1] of [[M.podH + 4, M.podH + 9.5], [M.podH + 13, M.podH + 18.5]]) k.archWins(face, c, [-26.5, -19.5, 19.5, 26.5], h0, h1, 3.2, { glass: WINDOW, seed: 5, lit: 0.12 });
  k.team = true;
  for (const a of [-23, 23]) F(a - 1.5, a + 1.5, M.podH + 5, M.bodyH - 1.2, TEAM0, 0.12);
  k.team = false;
  F(-M.body, -M.body + 1.6, M.podH, M.bodyH, TRIM, 0.1);
  F(M.body - 1.6, M.body, M.podH, M.bodyH, TRIM, 0.1);
  F(-M.body, M.body, M.podH + 11, M.podH + 11.8, TRIM, 0.1);
}

/** Tambour mit Säulenkranz, Ring und Attika mit Fenstern, Kuppel mit goldenen Rippen und Lukarnen, Laterne mit Haube, Mast und Fahne. */
function hallTop(k) {
  const A = Array.from({ length: 10 }, (_, i) => ((i + 0.5) / 10) * TAU);
  k.cyl(0, 0, M.drum - 1.6, M.atticH, M.drumH, '#d9d6cf', { n: 24, mat: null, top: false });
  k.colonnade(0, 0, M.drum - 0.4, M.atticH, M.drumH, 16, '#f6f3ea', 1.1);
  k.cyl(0, 0, M.drum + 0.6, M.atticH, M.atticH + 1.4, TRIM, { n: 24, mat: null });
  k.cyl(0, 0, M.ring, M.drumH, M.ringH, TRIM, { n: 24, mat: null });
  k.cyl(0, 0, M.drum2, M.ringH, M.drum2H, MARBLE, { n: 24, mat: null });
  k.cylWins(0, 0, M.drum2, M.ringH + (M.drum2H - M.ringH) * 0.25, M.ringH + (M.drum2H - M.ringH) * 0.75, A, 2, WINDOW);
  k.dome(0, 0, M.drum2H, M.dome, DOME_C, '#e6e9ec', 0, 24, 8);
  k.domeRibs(0, 0, M.drum2H, M.dome, DOME_C, 12, '#c49634', 9, 0.8, Math.PI / 12);
  k.cylWins(0, 0, M.dome * 0.99, M.drum2H + 2.1, M.drum2H + 4.3, Array.from({ length: 8 }, (_, i) => (i / 8) * TAU), 1.2, '#465f78');
  const h0 = DOME_TOP - 1.2;
  k.cyl(0, 0, M.lantern, h0, LANTERN_H - 1.1, TRIM, { n: 10, mat: null });
  k.cylWins(0, 0, M.lantern, h0 + 1, LANTERN_H - 2, [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * TAU), 0.9, WINDOW);
  k.cyl(0, 0, M.lantern + 0.8, LANTERN_H - 1.1, LANTERN_H, TRIM, { n: 10, mat: null });
  k.dome(0, 0, LANTERN_H, M.lantern, M.lantern * 1.4, HGOLD, 0, 12, 4);
  k.rod([0, 0, LANTERN_H + 4], [0, 0, M.mastH], 0.9, '#dcdedb');
  k.banner(0, 0, M.mastH - 1.5, 20, 12, TEAM0, true);
  k.ball(0, 0, M.mastH, 1.5, HGOLD, 1.5, 6, 3);
}

/** Geometrie des Regierungsgebäudes (Mitte der Hauptstadt = Ursprung), einmal gebaut. */
let hallGeo = null;
export function hallGeometry() {
  if (hallGeo) return hallGeo;
  const k = new Kit3D();
  const p = M.pod;
  const a = M.body;
  k.box(-p, p, -p, p, 0, M.podH, TERRACE, shade(TERRACE, 0.03));
  for (const [axis, s] of [['u', -1], ['v', -1], ['u', 1], ['v', 1]]) hallPortico(k, axis, s);
  k.box(-a, a, -a, a, M.podH, M.bodyH, MARBLE, MARBLE, { top: false });
  for (const f of ['s', 'n', 'e', 'w']) hallFacade(k, f);
  k.box(-M.corn, M.corn, -M.corn, M.corn, M.bodyH, M.cornH, TRIM, TRIM, { mat: null });
  k.box(-a, a, -a, a, M.cornH, M.atticH, TRIM, TRIM, { mat: null, top: false });
  k.parapet(-a, a, -a, a, M.atticH, TRIM, HROOF, 1.5);
  k.ribs(-a, a, -a, a, M.cornH + 0.9, M.atticH - 0.9, 2.6, TRIM); // Docken der Balustrade
  const F = a - 3;
  for (const [u, v] of [[-F, -F], [F, -F], [-F, F], [F, F]]) k.flagpole(u, v, M.atticH, 14, TEAM0, true);
  hallTop(k);
  hallGeo = k.geometry();
  return hallGeo;
}

// ---------- Regierungsviertel (govquarter.js) ----------

const { SAND, RED, STONE, MOD, MGLASS, GUARD, GOLD } = QUARTER_PAL;
const { GROUPS, tv, tRect, tAxis } = _quarter;
const OFFICIAL_BOOTH = '#f1efe8';

/** Alle vier Wände eines Rechtecks als [Seite, Ebene, Anfang, Ende] (n, e, s, w). */
const sides = ([u0, u1, v0, v1]) => [['s', v1, u0, u1], ['n', v0, u0, u1], ['e', u1, v0, v1], ['w', u0, v0, v1]];

function minA(k, rc) {
  const [u0, u1, v0, v1] = rc;
  const H = 20;
  k.box(u0, u1, v0, v1, 0, H, SAND, SAND, { top: false });
  k.plinth(u0, u1, v0, v1, SAND, 2.2);
  for (const [face, plane, a0, a1] of sides(rc)) {
    const n = Math.max(3, Math.round((a1 - a0) / 6.4)) | 1;
    const mid = (n - 1) / 2;
    k.wins(face, plane, a0 + 2, a1 - 2, n, [[4, 8.6], [11.6, 16.4]], 2.5, { cross: true, frame: STONE, seed: n * 7, lit: 0.15, skip: (i, r) => r === 0 && i === mid });
    k.door(face, plane, (a0 + a1) / 2, 3.6, 7, '#4f3b2b');
  }
  k.ledge(u0, u1, v0, v1, 10.2, tint(SAND, 0.2), 0.45, 0.9);
  k.box(u0 - 0.8, u1 + 0.8, v0 - 0.8, v1 + 0.8, H, H + 1.4, STONE, STONE, { mat: null });
  k.hip(u0, u1, v0, v1, H + 1.4, 9, RED);
  k.flagpole((u0 + u1) / 2, (v0 + v1) / 2, H + 8, 13, TEAM0, true);
}

function minB(k, rc) {
  const [u0, u1, v0, v1] = rc;
  const H = 25;
  k.box(u0, u1, v0, v1, 0, H, MOD, MOD, { top: false });
  for (const [face, plane, a0, a1] of sides(rc)) {
    const F = (b0, b1, h0, h1, col, off, o = {}) => k.facePanel(face, plane, b0, b1, h0, h1, col, off, { mat: null, snow: false, ...o });
    F(a0 + (a1 - a0) * 0.3, a1 - (a1 - a0) * 0.3, 0, 5.5, '#2c4256', 0.1);
    for (const h of [8, 13.5, 19]) F(a0 + 1.8, a1 - 1.8, h, h + 3.4, MGLASS, 0.1);
    for (let a = a0 + 4; a < a1 - 2; a += 3.6) F(a - 0.2, a + 0.2, 8, 22.4, '#ebf0f2', 0.14);
  }
  k.team = true;
  k.wallBand(u0, u1, v0, v1, H - 2.6, H, TEAM0);
  k.team = false;
  k.parapet(u0, u1, v0, v1, H, MOD, DECK);
  k.acUnit(u0 + 9, v0 + 9, H - 1.3, 2.6);
  k.acUnit(u1 - 10, v0 + 12, H - 1.3, 2.2);
  k.box(u1 - 14, u1 - 6, v1 - 12, v1 - 5, H - 1.3, H + 4, '#cfd2d0', '#cfd2d0', { mat: null });
}

function guard(k, rc) {
  const [u0, u1, v0, v1] = rc;
  const H = 9;
  k.box(u0, u1, v0, v1, 0, H + 0.6, GUARD, GUARD, { top: false });
  for (const [face, plane, a0, a1] of sides(rc)) k.wins(face, plane, a0 + 1.5, a1 - 1.5, Math.max(2, Math.round((a1 - a0) / 6)), [[3.2, 6.4]], 2.8, { frame: false, lit: 0.4, seed: 3 });
  k.team = true;
  k.wallBand(u0, u1, v0, v1, H - 1.8, H, TEAM0);
  k.team = false;
  k.parapet(u0, u1, v0, v1, H + 0.6, GUARD, DECK, 0.8);
}

function booth(k, rc) {
  const [u0, u1, v0, v1] = rc;
  k.box(u0, u1, v0, v1, 0, 7.5, OFFICIAL_BOOTH, OFFICIAL_BOOTH, { top: false });
  k.team = true;
  k.wallBand(u0, u1, v0, v1, 2.5, 4, TEAM0);
  k.team = false;
  k.pyramid((u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / 2 + 0.6, 7.5, 3, '#5c6670');
}

function barrier(k, u, v, u2, v2) {
  k.box(u - 1, u + 1, v - 1, v + 1, 0, 4.2, '#d9d6cc', '#d9d6cc', { mat: null });
  const n = 6;
  for (let i = 0; i < n; i++) k.rod([u + ((u2 - u) * i) / n, v + ((v2 - v) * i) / n, 3.6], [u + ((u2 - u) * (i + 1)) / n, v + ((v2 - v) * (i + 1)) / n, 3.6], 1.3, i % 2 ? '#f4f2ec' : '#d33a2c');
}

function obelisk(k, u, v) {
  k.box(u - 5, u + 5, v - 5, v + 5, 0, 1.6, STONE, STONE, { mat: null });
  k.box(u - 3.6, u + 3.6, v - 3.6, v + 3.6, 1.6, 5, '#e9e3d4', '#e9e3d4', { mat: null });
  const [w0, w1, h0, h1, col] = [2.3, 1.5, 5, 27, '#ece6d6'];
  const side = (a, b, c, d, n) => k.poly([a, b, c, d], col, { mat: null, n });
  side([u - w0, v + w0, h0], [u + w0, v + w0, h0], [u + w1, v + w1, h1], [u - w1, v + w1, h1], [0, 1, 0.1]);
  side([u + w0, v + w0, h0], [u + w0, v - w0, h0], [u + w1, v - w1, h1], [u + w1, v + w1, h1], [1, 0, 0.1]);
  side([u + w0, v - w0, h0], [u - w0, v - w0, h0], [u - w1, v - w1, h1], [u + w1, v - w1, h1], [0, -1, 0.1]);
  side([u - w0, v - w0, h0], [u - w0, v + w0, h0], [u - w1, v + w1, h1], [u - w1, v - w1, h1], [-1, 0, 0.1]);
  k.pyramid(u, v, w1, h1, 3.6, GOLD);
}

function fountain(k, u, v) {
  k.cyl(u, v, 12.5, 0, 2.6, STONE, { n: 20, top: false, mat: null });
  k.ring(u, v, 12.5, 2.6, tint(STONE, 0.1), 20, { mat: null });
  k.ring(u, v, 11.3, 2.5, '#5fa9cc', 20, { mat: null, snow: false });
  k.cyl(u, v, 2.2, 1.2, 6, STONE, { n: 8, mat: null });
  k.cyl(u, v, 4.6, 6, 7.2, STONE, { n: 12, mat: null });
  k.rod([u, v, 7.2], [u, v, 13.5], 0.9, '#e8f6fd');
}

function lampBanner(k, u, v) {
  k.lamp(u, v, 13);
  k.banner(u, v, 12, 2.6, 6.4, TEAM0, true);
}

/** Ein Teil des Plans (govquarter.js) für Teamdrehung t in 3D: Anlage → Welt wie partIso (tv, tRect, tAxis). */
function quarterPart(k, p, t) {
  const pt = (x, y) => tv(t, x, y);
  const rc = () => tRect(t, p.x0, p.x1, p.y0, p.y1);
  const [u, v] = pt(p.x, p.y);
  switch (p.k) {
    case 'minA': return minA(k, rc());
    case 'minB': return minB(k, rc());
    case 'guard': return guard(k, rc());
    case 'booth': return booth(k, rc());
    case 'barrier': {
      const [u2, v2] = pt(p.x2, p.y2);
      return barrier(k, u, v, u2, v2);
    }
    case 'obelisk': return obelisk(k, u, v);
    case 'flag':
      k.box(u - 1.2, u + 1.2, v - 1.2, v + 1.2, 0, 1.2, STONE, STONE, { mat: null });
      return k.flagpole(u, v, 1.2, 22, TEAM0, true);
    case 'fountain': return fountain(k, u, v);
    case 'bench': {
      const [hu, hv] = tAxis(t, p.ax) === 'u' ? [3, 0.9] : [0.9, 3];
      return k.box(u - hu, u + hu, v - hv, v + hv, 0.9, 1.8, '#8a6a46', '#9c7a52', { mat: 'wood' });
    }
    case 'tree': return k.tree(u, v, p.s, p.t);
    case 'car': return k.car(u, v, tAxis(t, p.ax), p.c);
    case 'lamp': return lampBanner(k, u, v);
  }
}

export const quarterKey = (turn, mask) => `quarter|${turn}|${mask}`;
const quarterCache = new Map();

/** Geometrie der Teile des Viertels für Teamdrehung t und Bitmaske mask der freien Gruppen (quarterMask, Bit gi); null ohne Gruppen. */
export function quarterGeometry(t, mask) {
  if (!mask) return null;
  const key = quarterKey(t, mask);
  let g = quarterCache.get(key);
  if (!g) {
    const k = new Kit3D();
    for (let gi = 0; gi < 9; gi++) if (mask & (1 << gi)) for (const p of GROUPS[t][gi]) quarterPart(k, p, t);
    g = k.geometry();
    quarterCache.set(key, g);
  }
  return g;
}
