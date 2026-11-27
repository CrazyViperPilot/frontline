// Militärgebäude in 3D aus dem Baukasten (kit3d.js), Paket „Militärgebäude 3D“: FOB, Mörserstellung, Flugabwehr, Phalanx, Gefechtsturm
// (mit Dachaufbau Mörser, Flak, SAM oder Antenne), Bohrer, Mauerstücke (16 Nachbarmasken), Tore (Einzeltor und Torhälften) und die
// Baustellen aller Arten in Stufen, mit denselben Maßen, Farben und Bauteilen wie render/milbuild.js, dazu die Rückseiten, die gemalt nie
// zu sehen sind. Örtliche Koordinaten ab der Mitte des Gebäudes: u = Welt-x, v = Welt-y, h = Höhe. Die Ansicht dreht in 3D, also hängen
// Mauern und Tore von den Nachbarn in Weltrichtung ab (milVariant: Maske 1 = +x, 2 = +y, 4 = −x, 8 = −y), nicht von der Bilddrehung.
// Gemalte Schatten und Ruß entfallen (Schattenkarte; beschädigte Gebäude sind eine dunklere Variante der Geometrie). Teamfarbe: Platzrand,
// Bänder, Fahnen, Dächer und Kappen tragen aInfo.y = 97 und nehmen die Farbe der Instanz (instanceColor), eine Geometrie je Art und
// Variante für alle Teams. Kein Rauch, keine Bewegung.
import * as THREE from '../vendor/three/three.module.min.js';
import { Kit3D } from './kit3d.js';
import { MIL_DIM, isMilBuilding, milVariant, milDamaged } from '../render/milbuild.js';
import { FORT_DIM, worksMask } from '../render/stronghold.js';
import { BUILDINGS } from '../data/buildings.js';
import { rnd, shade, tint } from '../render/isokit.js';

const { SAND, HESCO, FILL, OLIVE, CANVAS, DIRT, GRAVEL, PAD, CONC, GUN, RED, STEEL, STEEL_HI, STEEL_DK, WARN, PIL_H, LEAF_TOP, LEAF_A0, WALL_H, SITE_H, wallParts } = MIL_DIM;
const TEAM0 = '#3a6fb3'; // Platzhalter der Teamfarbe in der Geometrie (die Instanz tönt sie um)
const TAU = Math.PI * 2;
const DARK = 0.7; // beschädigte Gebäude: Farben so viel dunkler (gemalt: Ruß)

export const MIL3D_TYPES = ['fob', 'wall', 'gate', 'mortar', 'aa', 'phalanx', 'tower', 'drill'];
export { isMilBuilding, worksMask };

/** Schlüssel der Variante eines Militärgebäudes b (game.buildings): Art, Variante (Mauer: Maske; Baustelle: Stufe), beschädigt. */
export const milKey = (b) => `${b.type}|${milVariant(b)}|${milDamaged(b)}`;

// ---------- Gemeinsames ----------

const team = (k, fn) => {
  const was = k.team;
  k.team = true;
  fn();
  k.team = was;
};

/** Bodenfläche (schneefrei, unbeleuchtet wie gemalt), jede neue Fläche eine Spur höher. */
function fl(k, u0, u1, v0, v1, col) {
  k.fh = (k.fh ?? 0) + 0.012;
  k.flat(u0, u1, v0, v1, col, k.fh, { bare: true, mat: null });
}

/** Bodenfläche mit Schnee im Winter (gemalt snowy). */
function fls(k, u0, u1, v0, v1, col) {
  k.fh = (k.fh ?? 0) + 0.012;
  k.flat(u0, u1, v0, v1, col, k.fh, { mat: null });
}

/** Kreisfläche am Boden (Grube, Betonrund). */
function disc(k, u, v, r, col, snow = false) {
  k.fh = (k.fh ?? 0) + 0.012;
  k.ring(u, v, r, k.fh, col, 24, { mat: null, snow: snow ? undefined : false });
}

/** Platz mit Rand in Teamfarbe (wie milbuild.pad). */
function pad(k, e, color) {
  fls(k, -e, e, -e, e, color);
  const i = e - 1.4;
  const w = 0.55;
  k.fh += 0.012;
  team(k, () => {
    for (const [u0, u1, v0, v1] of [[-i - w, i + w, -i - w, -i + w], [-i - w, i + w, i - w, i + w], [-i - w, -i + w, -i + w, i - w], [i - w, i + w, -i + w, i - w]]) {
      k.flat(u0, u1, v0, v1, TEAM0, k.fh, { bare: true, mat: null });
    }
  });
}

/** Dach in Teamfarbe auf einer Attika (nach k.parapet): legt eine Fläche in Teamfarbe auf die vertiefte Dachfläche. */
function teamDeck(k, u0, u1, v0, v1, h, rim = 1.1) {
  team(k, () => k.poly([[u0 + rim, v0 + rim, h - 1.25], [u1 - rim, v0 + rim, h - 1.25], [u1 - rim, v1 - rim, h - 1.25], [u0 + rim, v1 - rim, h - 1.25]], TEAM0, { mat: null, n: [0, 0, 1] }));
}

/** Quader in Teamfarbe (Bohrmeisterhaus, Schild, Kappen). */
function tbox(k, u0, u1, v0, v1, h0, h1) {
  team(k, () => k.box(u0, u1, v0, v1, h0, h1, TEAM0, TEAM0, { mat: null }));
}

/** Gedrehter Quader: Mitte c, halbe Achsen ax, ay, az (je [u, v, h]), sechs Flächen. */
function obox(k, c, ax, ay, az, col) {
  const pt = (i, j, l) => [0, 1, 2].map((m) => c[m] + i * ax[m] + j * ay[m] + l * az[m]);
  const neg = (a) => a.map((x) => -x);
  const faces = [
    [ax, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
    [neg(ax), [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [ay, [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
    [neg(ay), [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
    [az, [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [neg(az), [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
  ];
  for (const [n, q] of faces) k.poly(q.map(([i, j, l]) => pt(i, j, l)), col, { mat: null, snow: false, n });
}

/** Rohr von a nach b, je [u, v, h], Breite w. */
function tube(k, a, b, w, col = GUN) {
  k.tube(a, b, w / 2, w / 2, col, 6);
}

/** Zwillingsrohre ab c in Richtung d, Länge len, Abstand sp; Mündungsbremse an der Spitze. */
function twin(k, c, d, len, sp, w = 1.5) {
  const pu = 0.707;
  for (const s of [-1, 1]) {
    const a = [c[0] + s * sp * pu, c[1] + s * sp * pu, c[2]];
    const b = [a[0] + d[0] * len, a[1] + d[1] * len, a[2] + d[2] * len];
    tube(k, a, b, w);
    tube(k, [a[0] + d[0] * len * 0.86, a[1] + d[1] * len * 0.86, a[2] + d[2] * len * 0.86], b, w * 1.7, '#1f2220');
  }
}

/**
 * Ring aus Sandsäcken um (u, v) zwischen ri und ro, von h0 bis h1, mit Lücke gap = [a0, a1] (Winkel, 0 = +u, π/2 = +v): 22 Stücke
 * abwechselnd etwas heller (Säcke), Enden an der Lücke geschlossen.
 */
function bagRing(k, u, v, ri, ro, h0, h1, gap = null) {
  const N = 22;
  const gone = [];
  for (let i = 0; i < N; i++) {
    const tm = ((i + 0.5) / N) * TAU;
    gone.push(!!gap && tm > gap[0] && tm < gap[1]);
  }
  const at = (r, t, h) => [u + r * Math.cos(t), v + r * Math.sin(t), h];
  const cap = (t, sgn) => k.poly([at(ri, t, h0), at(ro, t, h0), at(ro, t, h1), at(ri, t, h1)], SAND, { mat: null, snow: false, n: [-Math.sin(t) * sgn, Math.cos(t) * sgn, 0] });
  for (let i = 0; i < N; i++) {
    if (gone[i]) continue;
    const t0 = (i / N) * TAU;
    const t1 = ((i + 1) / N) * TAU;
    const tm = (t0 + t1) / 2;
    const col = i % 2 ? tint(SAND, 0.05) : SAND;
    const hint = [Math.cos(tm), Math.sin(tm), 0];
    k.poly([at(ro, t0, h0), at(ro, t1, h0), at(ro, t1, h1), at(ro, t0, h1)], col, { mat: null, snow: false, n: hint });
    k.poly([at(ri, t0, h0), at(ri, t1, h0), at(ri, t1, h1), at(ri, t0, h1)], col, { mat: null, snow: false, n: hint.map((x) => -x) });
    k.poly([at(ri, t0, h1), at(ro, t0, h1), at(ro, t1, h1), at(ri, t1, h1)], tint(col, 0.06), { mat: null, n: [0, 0, 1] });
    if (gone[(i + N - 1) % N]) cap(t0, -1);
    if (gone[(i + 1) % N]) cap(t1, 1);
  }
}

/** Gerade Wand aus Sandsäcken (achsparallel). */
function bagWall(k, u0, u1, v0, v1, h) {
  k.box(u0, u1, v0, v1, 0, h, tint(SAND, 0.08), tint(SAND, 0.14), { mat: null });
}

/** HESCO-Wall: Drahtkörbe voll Sand (je etwa 5 breit), Fugen auf den beiden Längsseiten. */
function hesco(k, u0, u1, v0, v1, h) {
  k.box(u0, u1, v0, v1, 0, h, HESCO, FILL, { mat: null });
  const col = shade(HESCO, 0.22);
  if (u1 - u0 >= v1 - v0) {
    for (let a = u0 + 5; a < u1 - 0.5; a += 5) for (const [f, pl] of [['s', v1], ['n', v0]]) k.facePanel(f, pl, a - 0.2, a + 0.2, 0, h, col, 0.05, { mat: null, snow: false });
  } else {
    for (let a = v0 + 5; a < v1 - 0.5; a += 5) for (const [f, pl] of [['e', u1], ['w', u0]]) k.facePanel(f, pl, a - 0.2, a + 0.2, 0, h, col, 0.05, { mat: null, snow: false });
  }
}

/** Militär-LKW mit Plane (Fahrerhaus bei +u bzw. +v), Teamzeichen auf der Plane. */
function milTruck(k, u, v, along) {
  const U = along === 'u';
  const L = 7.5;
  const W = 2.5;
  const bx = (a0, a1, c0, c1, h0, h1, col, top) => (U ? k.box(u + a0, u + a1, v + c0, v + c1, h0, h1, col, top ?? col, { mat: null }) : k.box(u + c0, u + c1, v + a0, v + a1, h0, h1, col, top ?? col, { mat: null }));
  for (const a of [-5.4, -2.8, 5]) {
    bx(a - 1.1, a + 1.1, W - 0.4, W + 0.1, 0, 2.1, '#2a2c2b');
    bx(a - 1.1, a + 1.1, -W - 0.1, -W + 0.4, 0, 2.1, '#2a2c2b');
  }
  bx(-L, L - 0.2, -W + 0.4, W - 0.4, 1, 1.9, '#3a3d38');
  bx(-L, 2.8, -W, W, 1.9, 7.2, '#56613b', '#606b43');
  team(k, () => bx(-3, -0.6, -1.2, 1.2, 7.2, 7.25, TEAM0));
  bx(3.2, L, -W, W, 1.9, 6.2, OLIVE, tint(OLIVE, 0.1));
  if (U) k.facePanel('e', u + L, v - W + 0.4, v + W - 0.4, 4, 5.6, '#2c3a47', 0.06, { mat: null, snow: false });
  else k.facePanel('s', v + L, u - W + 0.4, u + W - 0.4, 4, 5.6, '#2c3a47', 0.06, { mat: null, snow: false });
}

/** Stapel olivgrüner Munitionskisten. */
function crates(k, u, v, n, seed = 0) {
  for (let i = 0; i < n; i++) {
    const a = u + (i % 2) * 4.6;
    const b = v + Math.floor(i / 2) * 3.4;
    const h = 2.4 * (1 + Math.floor(rnd(seed + i * 7) * 2));
    k.box(a - 2.1, a + 2.1, b - 1.5, b + 1.5, 0, h, '#56613b', '#66724a', { mat: null });
  }
}

/** Fässer (Treibstoff) in einer Gruppe. */
function drums(k, u, v, n) {
  for (let i = 0; i < n; i++) k.cyl(u + (i % 3) * 2.6, v + Math.floor(i / 3) * 2.6, 1.15, 0, 3.4, '#4f5d3a', { n: 8, mat: null });
}

/** Generator mit Auspuff. */
function generator(k, u0, u1, v0, v1) {
  k.box(u0, u1, v0, v1, 0, 4.6, OLIVE, tint(OLIVE, 0.08), { mat: null });
  k.cyl(u0 + 1.2, v0 + 1.2, 0.5, 4.6, 7.4, '#3a3d38', { n: 6, mat: null });
}

/** Schranke rot-weiß zwischen (u0, v) und (u1, v) auf Höhe h. */
function barrier(k, u0, u1, v, h) {
  k.box(u0 - 0.8, u0 + 0.8, v - 0.8, v + 0.8, 0, h + 1, '#d0cdc3', '#d0cdc3', { mat: null });
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = u0 + 0.8 + ((u1 - u0 - 0.8) * i) / n;
    const b = u0 + 0.8 + ((u1 - u0 - 0.8) * (i + 1)) / n;
    k.box(a, b, v - 0.35, v + 0.35, h, h + 0.7, i % 2 ? '#f0ede4' : RED, i % 2 ? '#f0ede4' : RED, { mat: null });
  }
}

// ---------- Gebäude ----------

/** FOB (3 × 3): HESCO-Wall mit Zufahrt und Schranke, Gefechtsstand mit Dach in Teamfarbe, Zelt, Radarmast, Fahrzeuge, Nachschub. */
function fob(k) {
  fls(k, -46, 46, -46, 46, GRAVEL);
  fl(k, 6, 20, 14, 46, '#968f7f'); // Fahrspur zum Tor
  fl(k, -20, 41, 4, 18, '#968f7f');
  hesco(k, -46, 46, -46, -42, 7);
  hesco(k, -46, -42, -42, 46, 7);
  hesco(k, 42, 46, -42, 42, 7);
  hesco(k, 20, 46, 42, 46, 7);
  hesco(k, -42, 6, 42, 46, 7);
  // Radarmast mit Gerätecontainer hinten rechts
  k.box(16, 26, -38, -31, 0, 6.5, '#c9cbc3', '#d6d8d0', { mat: null });
  team(k, () => k.wallBand(16, 26, -38, -31, 4.6, 5.4, TEAM0));
  k.door('s', -31, 21, 2.2, 4.6, '#4f5a63');
  k.door('n', -38, 21, 2.2, 4.6, '#4f5a63');
  k.mast(32, -32, 0, 36, 3, 0.9, '#9aa0a5', true);
  k.dish(32, -32, 36, 3.4);
  // Gefechtsstand (Fertigbau) mit Dach in Teamfarbe
  k.box(-38, -8, -38, -16, 0, 12, '#b9b5a2', '#b9b5a2', { top: false, mat: null });
  const win = (face, plane, a0, a1, n, seed) => k.wins(face, plane, a0, a1, n, [[4.5, 8]], 2.8, { frame: false, lit: 0.3, seed });
  win('s', -16, -38, -8, 5, 3);
  win('e', -8, -38, -16, 4, 9);
  win('n', -38, -38, -8, 5, 5);
  win('w', -38, -38, -16, 4, 11);
  k.door('s', -16, -12.5, 2.6, 5.2, '#4f5a63');
  k.box(-15, -10, -16, -13.5, 0, 0.8, '#9a978b', '#9a978b', { mat: null }); // Stufe
  k.parapet(-38, -8, -38, -16, 12, '#b9b5a2', shade(TEAM0, 0.12));
  teamDeck(k, -38, -8, -38, -16, 12);
  k.acUnit(-32, -30, 11.6, 2.4);
  k.acUnit(-25, -30, 11.6, 2.4);
  k.dish(-14, -33, 11.6, 2.4);
  k.rod([-35, -20, 12], [-35, -20, 26], 0.5, '#55595d'); // Funkantennen
  k.rod([-31, -20, 12], [-31, -20, 22], 0.5, '#55595d');
  // Mannschaftszelt mit Generator
  k.vault('u', -38, -12, -8, 2, 0, 7.5, CANVAS, '#7d8560', 10);
  generator(k, -8, -2, -8, -3);
  // Nachschub, Fahrzeuge
  crates(k, -38, 12, 6, 5);
  crates(k, -26, 12, 4, 11);
  drums(k, -36, 26, 6);
  milTruck(k, 30, -10, 'v');
  k.car(33, 12, 'v', OLIVE);
  // Fahne und Laterne an der Zufahrt
  k.flagpole(2, 34, 0, 22, TEAM0, true);
  k.lamp(22, 22, 9);
  // Wachhäuschen und Schranke
  k.box(22, 27, 34, 39, 0, 6, '#c9c4b4', '#5a5e60', { mat: null });
  k.wins('s', 39, 22, 27, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6 });
  k.wins('e', 27, 34, 39, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6, seed: 4 });
  k.wins('w', 22, 34, 39, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6, seed: 7 });
  barrier(k, 6, 20, 41.5, 3.6);
}

/** Mörserstellung (2 × 2): Sandsackring mit Zugang, Mörser auf Bodenplatte mit Zweibein, Munitionskisten, Fahne. */
function mortar(k) {
  pad(k, 30, DIRT);
  disc(k, 0, 0, 15.5, '#7c7562'); // Boden der Grube
  k.flagpole(-13, -13, 6, 14, TEAM0, true);
  bagRing(k, 0, 0, 15, 20.5, 0, 6.2, [0.35, 1.25]);
  crates(k, -10, 3, 3, 2);
  // Mörser: Bodenplatte, Rohr schräg nach hinten rechts, Zweibein, Richtaufsatz
  k.cyl(1, 3, 3.4, 0, 0.5, '#3d403b', { n: 12, mat: null });
  k.rod([5.4, -3.6, 8.5], [3.6, -6.8, 0.3], 0.6, '#3a3d38');
  k.rod([5.4, -3.6, 8.5], [8, -2.2, 0.3], 0.6, '#3a3d38');
  tube(k, [1, 3, 1.2], [9.5, -9.5, 17], 2.4);
  k.box(3.2, 4.6, -1.2, 0.2, 5.2, 6.8, '#4a4f45', '#4a4f45', { mat: null });
  crates(k, 19, 18, 2, 7);
}

/** Flugabwehr (2 × 2): Betonrund mit Sandsackwall, Zwillingsflak auf Drehkranz mit Schild in Teamfarbe, Radaranhänger, Kisten. */
function aa(k) {
  pad(k, 30, DIRT);
  disc(k, 0, 0, 19, '#aaa79b');
  k.flagpole(-16, -16, 5, 14, TEAM0, true);
  // Radaranhänger in der rechten Ecke
  k.box(20, 29, -28, -19, 1.4, 5.8, '#6b7350', '#757d58', { mat: null });
  for (const a of [-26, -21]) {
    k.box(28.6, 29.2, a - 1, a + 1, 0, 2.2, '#2a2c2b', '#2a2c2b', { mat: null });
    k.box(19.8, 20.4, a - 1, a + 1, 0, 2.2, '#2a2c2b', '#2a2c2b', { mat: null });
  }
  k.dish(24.5, -23.5, 5.8, 3);
  bagRing(k, 0, 0, 19, 23.5, 0, 5.2, [0.4, 1.2]);
  k.cyl(0, 0, 9, 0, 2.4, '#5d6158', { n: 14, mat: null });
  team(k, () => k.box(-6, -3.5, -5, 5, 2.4, 8.5, TEAM0, TEAM0, { mat: null })); // Schild
  k.box(-3.5, 4.5, -4, 4, 2.4, 7.6, OLIVE, tint(OLIVE, 0.08), { mat: null });
  twin(k, [0.5, -0.5, 8.2], [0.45, -0.45, 0.77], 20, 1.6);
  k.box(1, 5.5, 2.5, 5, 2.4, 5.4, '#4a5236', '#4a5236', { mat: null }); // Sitz
  crates(k, -27, 19, 3, 9);
}

/** Phalanx (2 × 2): Betonsockel mit Teamband, weißer Radardom auf dem Drehgestell, Gatling-Rohr, Leitstand-Container, Generator. */
function phalanx(k) {
  pad(k, 30, PAD);
  // Warnmarkierung um den Sockel
  for (const [u0, u1, v0, v1] of [[-11.5, 11.5, -11.5, -10.5], [-11.5, 11.5, 10.5, 11.5], [-11.5, -10.5, -10.5, 10.5], [10.5, 11.5, -10.5, 10.5]]) fl(k, u0, u1, v0, v1, '#d8b630');
  k.box(-8, 8, -8, 8, 0, 6, '#8f9591', '#9ea4a0', { mat: null });
  team(k, () => k.wallBand(-8, 8, -8, 8, 3.6, 5, TEAM0));
  k.cyl(0, 0, 6.2, 6, 9.6, '#d2d5d0', { n: 14, mat: null });
  k.box(-3.8, 3.8, -3.2, 3.2, 9.6, 15.5, '#dfe2dd', '#e6e9e4', { mat: null });
  // Radardom
  k.cyl(-0.6, -0.6, 4.4, 15.5, 23, '#eef0ec', { n: 14, top: false, mat: null });
  k.cap(-0.6, -0.6, 4.4, 23, '#eef0ec', 0.95, 14, 4);
  // Gatling: Rohrbündel nach vorn rechts oben, Munitionstrommel davor
  tube(k, [2.4, -1.6, 12.6], [13.5, -11, 20.5], 3);
  tube(k, [12.3, -10, 19.6], [14.6, -12, 21.3], 3.8, '#3a3e3a');
  k.cyl(1.6, 2.4, 2, 9.6, 13.2, '#c9ccc6', { n: 10, mat: null });
  // Leitstand und Generator
  k.box(12, 26, 10, 20, 0, 8, '#c8cbc4', '#d2d5ce', { mat: null });
  team(k, () => k.wallBand(12, 26, 10, 20, 6, 7, TEAM0));
  k.door('s', 20, 16, 2.4, 5, '#4f5a63');
  k.door('n', 10, 16, 2.4, 5, '#4f5a63');
  k.acUnit(22, 13, 7.6, 2.2);
  generator(k, -25, -15, 14, 21);
  k.lamp(-22, -22, 11);
}

/** Gefechtsturm (2 × 2): Betonschaft mit Schießscharten, auskragende Kanzel mit Sehschlitzen und Teamband, Dach mit Aufbau. */
function tower(k, roof) {
  pad(k, 30, DIRT);
  // Schaft
  k.box(-17, 17, -17, 17, 0, 42, '#a9aaa2', '#a9aaa2', { mat: null });
  const slit = { frame: false, glass: '#22261f', lit: 1e-4 }; // lit 0 teilte durch null
  for (const [face, plane] of [['s', 17], ['e', 17], ['n', -17], ['w', -17]]) k.wins(face, plane, -17, 17, 3, [[13, 16.5], [27, 30.5]], 2, slit);
  k.door('s', 17, -6, 5, 8.5, '#4a4f45');
  bagWall(k, -12, 0, 21, 24, 6); // Splitterschutz vor der Tür
  // Kanzel
  k.box(-21, 21, -21, 21, 40, 41.5, '#8f908a', '#8f908a', { mat: null });
  k.box(-21, 21, -21, 21, 41.5, 55, '#9c9d95', '#9c9d95', { top: false, mat: null });
  for (const [face, plane] of [['s', 21], ['e', 21], ['n', -21], ['w', -21]]) k.wins(face, plane, -21, 21, 5, [[45, 48.5]], 5, slit);
  team(k, () => k.wallBand(-21, 21, -21, 21, 51.5, 53.5, TEAM0));
  k.parapet(-21, 21, -21, 21, 55, '#9c9d95', '#8a8b83');
  const H = 55;
  k.box(-16, -11, 9, 14, H, H + 1.2, '#6f716b', '#6f716b', { mat: null }); // Dachluke
  if (roof === 'mortar') {
    bagRing(k, 0, 0, 5, 8.5, H, H + 3);
    tube(k, [0, 1, H + 0.6], [7, -7.5, H + 13], 2.2);
  } else if (roof === 'flak') {
    k.cyl(0, 0, 5.5, H, H + 1.6, '#5d6158', { n: 12, mat: null });
    k.box(-3, 3, -3, 3, H + 1.6, H + 5.4, OLIVE, tint(OLIVE, 0.08), { mat: null });
    twin(k, [0.4, -0.4, H + 5], [0.45, -0.45, 0.77], 14, 1.2, 1.2);
  } else if (roof === 'sam') {
    k.cyl(0, 0, 5, H, H + 1.8, '#5d6158', { n: 12, mat: null });
    const d = [0.42, -0.42, 0.8];
    const p = [0.707, 0.707, 0];
    const nrm = [-0.566, 0.566, 0.6];
    obox(k, [1.2, -1.2, H + 7], d.map((x) => x * 7), p.map((x) => x * 3.6), nrm.map((x) => x * 2.4), '#d9dcd4');
    for (const [s, t] of [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]]) {
      const c = [1.2 + d[0] * 7 + p[0] * s + nrm[0] * t, -1.2 + d[1] * 7 + p[1] * s + nrm[1] * t, H + 7 + d[2] * 7 + p[2] * s + nrm[2] * t];
      k.ball(c[0] + d[0] * 2.4, c[1] + d[1] * 2.4, c[2] + d[2] * 2.4, 0.9, RED, 0.9, 6, 3);
    }
  } else {
    k.rod([-15, -15, H], [-15, -15, H + 14], 0.55, '#55595d'); // Funkantenne
    k.box(12, 16, -16, -12, H, H + 3, '#5d6158', '#5d6158', { mat: null }); // Scheinwerfer
  }
  k.flagpole(16, 16, H, 15, TEAM0, true);
}

/** Bohrer (2 × 2): Unterbau mit Streben, gelber Bohrturm mit Flaschenzug, Kabine in Teamfarbe, Rohrlager, Spülungstanks. */
function drill(k) {
  pad(k, 30, '#9b9178');
  // Spülungstanks hinten rechts, Geländer
  k.box(10, 28, -28, -14, 0, 7, '#7d8a8f', '#8d9a9f', { mat: null });
  k.rod([10, -14, 8.6], [28, -14, 8.6], 0.45, WARN);
  k.rod([28, -14, 8.6], [28, -28, 8.6], 0.45, WARN);
  k.rod([10, -28, 8.6], [28, -28, 8.6], 0.45, WARN);
  k.rod([10, -14, 8.6], [10, -28, 8.6], 0.45, WARN);
  generator(k, -28, -18, -28, -20);
  // Unterbau mit Kreuzstreben
  k.box(-11, 11, -11, 11, 0, 10, '#6d7277', '#7d8287', { mat: null });
  for (const s of [-1, 1]) {
    const e = 11.2 * s;
    for (const [p, q] of [[[-11, 0.5], [11, 9.5]], [[-11, 9.5], [11, 0.5]]]) {
      k.rod([p[0], e, p[1]], [q[0], e, q[1]], 0.5, '#a9aeb0');
      k.rod([e, p[0], p[1]], [e, q[0], q[1]], 0.5, '#8d9296');
    }
  }
  // Bohrturm: gelbe Beine, Querstreben, Krone, Flaschenzug
  const H0 = 10;
  const H1 = 66;
  const rad = (h) => 9 + ((2 - 9) * (h - H0)) / (H1 - H0);
  const lg = (su, sv, h) => [su * rad(h), sv * rad(h), h];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const YEL = '#d9b13a';
  for (const [su, sv] of corners) k.rod(lg(su, sv, H0), lg(su, sv, H1), 1, YEL);
  for (let h = H0; h < H1 - 1; h += 8) {
    for (let i = 0; i < 4; i++) {
      const [au, av] = corners[i];
      const [bu, bv] = corners[(i + 1) % 4];
      k.rod(lg(au, av, h), lg(bu, bv, Math.min(H1, h + 8)), 0.4, '#a98a2e');
      k.rod(lg(au, av, h), lg(bu, bv, h), 0.45, '#a98a2e');
    }
  }
  k.rod([0, 0, H1], [0, 0, 38], 0.4, '#3a3d38');
  k.rod([0.6, 0.6, H1], [0.6, 0.6, 38], 0.4, '#3a3d38');
  k.box(-1.6, 1.6, -1.6, 1.6, 33, 38, '#e0b021', '#e0b021', { mat: null });
  k.rod([0, 0, 33], [0, 0, 10], 0.9, '#5a5f63'); // Bohrgestänge
  k.box(-3, 3, -3, 3, H1, H1 + 3, '#8a8f94', '#9aa0a4', { mat: null });
  // Bohrmeisterhaus in Teamfarbe neben dem Unterbau
  tbox(k, 13, 22, -8, 1, 0, 7.5);
  k.wins('s', 1, 14, 21, 2, [[3.6, 6]], 2.6, { frame: false, lit: 0.5 });
  k.wins('e', 22, -7, 0, 1, [[3.6, 6]], 3.4, { frame: false, lit: 0.5 });
  k.wins('n', -8, 14, 21, 2, [[3.6, 6]], 2.6, { frame: false, lit: 0.5, seed: 5 });
  // Rohrlager und Rampe zum Bohrboden
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) k.rod([-28, 16 + j * 2 + i, 1 + i * 1.7], [-8, 16 + j * 2 + i, 1 + i * 1.7], 1.5, '#7d6b5a');
  k.poly([[-6, 26, 0], [-1, 26, 0], [-1, 11, 10], [-6, 11, 10]], '#8a8f94', { mat: null, snow: false, n: [0, 0.6, 0.8] });
  k.rod([-1, 26, 3], [-1, 11, 13], 0.45, WARN);
  k.flagpole(24, 22, 0, 16, TEAM0, true);
}

/** Mauerstück (1 × 1): Betonwände (T-Wall) mit Fuß, Fugen je Platte und Teamband, zu den Nachbarn hin verbunden (Maske m in Weltrichtung). */
function wall(k, m) {
  const H = WALL_H;
  for (const [u0, u1, v0, v1, post] of wallParts(m)) {
    const alongU = u1 - u0 > v1 - v0;
    const fu = post ? 0.8 : alongU ? 0 : 1.4;
    const fv = post ? 0.8 : alongU ? 1.4 : 0;
    k.box(u0 - fu, u1 + fu, v0 - fv, v1 + fv, 0, 2.2, shade(CONC, 0.1), shade(CONC, 0.04));
    k.box(u0, u1, v0, v1, 2.2, post ? H + 1.6 : H, CONC, tint(CONC, 0.12));
    team(k, () => k.wallBand(u0, u1, v0, v1, H - 4.4, H - 2.8, TEAM0));
    if (post) continue;
    const step = 32 / 6; // Platten je Feld
    const col = shade(CONC, 0.16);
    if (alongU) {
      for (let a = Math.ceil((u0 + 0.5) / step) * step; a < u1 - 0.5; a += step) for (const [f, pl] of [['s', v1], ['n', v0]]) k.facePanel(f, pl, a - 0.2, a + 0.2, 2.2, H, col, 0.05, { mat: null, snow: false });
    } else {
      for (let a = Math.ceil((v0 + 0.5) / step) * step; a < v1 - 0.5; a += step) for (const [f, pl] of [['e', u1], ['w', u0]]) k.facePanel(f, pl, a - 0.2, a + 0.2, 2.2, H, col, 0.05, { mat: null, snow: false });
    }
  }
}

/** Tor (1 × 1): zwei Pfeiler mit Kappen in Teamfarbe, Gitterflügel, rot-weiße Schranke; along = 'u' oder 'v'. */
function gate(k, along) {
  const H = 23;
  const U = along === 'u';
  const bx = (a0, a1, c0, c1, h0, h1, col, top) => (U ? k.box(a0, a1, c0, c1, h0, h1, col, top ?? col, { mat: null }) : k.box(c0, c1, a0, a1, h0, h1, col, top ?? col, { mat: null }));
  const Q = U ? (a, c, h) => [a, c, h] : (a, c, h) => [c, a, h];
  for (const s of [-1, 1]) {
    bx(s < 0 ? -16 : 11, s < 0 ? -11 : 16, -3.6, 3.6, 0, H, CONC, tint(CONC, 0.12));
    team(k, () => bx(s < 0 ? -16.4 : 10.6, s < 0 ? -10.6 : 16.4, -4, 4, H, H + 1.6, TEAM0));
  }
  // Torflügel: Rahmen und Stäbe
  for (const h of [2, 15.5]) k.rod(Q(-11, 0, h), Q(11, 0, h), 1.1, '#4a4f55');
  for (let a = -10; a <= 10.1; a += 2.5) k.rod(Q(a, 0, 1), Q(a, 0, 16), 0.6, '#5a6066');
  team(k, () => k.rod(Q(-11, 0, 8.5), Q(11, 0, 8.5), 1.2, TEAM0));
  bx(-11, 11, 4.5, 5.2, 8, 8.8, RED);
  for (let a = -8; a < 11; a += 6) bx(a, a + 3, 4.45, 5.25, 7.95, 8.85, '#f0ede4');
}

/** Tor-Hälfte (1 × 1) mit Partner: along = 'u'/'v' (Richtung des Paars), sgn = +1, wenn die andere Hälfte bei +u bzw. +v liegt. */
function gateLeaf(k, along, sgn) {
  const U = along === 'u';
  const A = (a) => sgn * a;
  const bx = (a0, a1, c0, c1, h0, h1, col, top) => {
    const x0 = Math.min(A(a0), A(a1));
    const x1 = Math.max(A(a0), A(a1));
    if (U) k.box(x0, x1, c0, c1, h0, h1, col, top ?? col, { mat: null });
    else k.box(c0, c1, x0, x1, h0, h1, col, top ?? col, { mat: null });
  };
  const Q = U ? (a, c, h) => [A(a), c, h] : (a, c, h) => [c, A(a), h];
  const pq = (pts, col, s) => k.poly(pts.map(([a, c, h]) => Q(a, c, h)), col, { mat: null, snow: false, n: U ? [0, s, 0] : [s, 0, 0] });
  const rod = (a0, c0, h0, a1, c1, h1, w, col) => k.rod(Q(a0, c0, h0), Q(a1, c1, h1), w, col);
  // Pfeiler am äußeren Ende (a = −16 … −8,4)
  bx(-16.6, -7.8, -4.8, 4.8, 0, 2, shade(CONC, 0.1), shade(CONC, 0.04));
  bx(-16, -8.4, -4.2, 4.2, 2, PIL_H, CONC, tint(CONC, 0.12));
  team(k, () => {
    const x0 = Math.min(A(-16), A(-8.4));
    const x1 = Math.max(A(-16), A(-8.4));
    if (U) k.wallBand(x0, x1, -4.2, 4.2, PIL_H - 8, PIL_H - 6.2, TEAM0);
    else k.wallBand(-4.2, 4.2, x0, x1, PIL_H - 8, PIL_H - 6.2, TEAM0);
    bx(-16.6, -7.8, -4.8, 4.8, PIL_H, PIL_H + 1.8, TEAM0);
  });
  bx(-13.6, -10.8, -1.4, 1.4, PIL_H + 1.8, PIL_H + 4.4, '#e69a1e', '#ffd36a'); // Warnleuchte
  // Stahlflügel: dicker Körper, Rahmen, zwei Felder mit Kreuzverstrebung, Warnstreifen unten, auf beiden Seiten
  bx(LEAF_A0, 16, -1.4, 1.4, 1.2, LEAF_TOP, STEEL, STEEL_HI);
  const a0 = LEAF_A0 + 0.6;
  const a1 = 15.2;
  const hm = 14.4;
  for (const s of [1, -1]) {
    const f = 1.4 * s;
    const o = (d) => f + d * s;
    pq([[a0, o(0.05), 5.6], [a1, o(0.05), 5.6], [a1, o(0.05), 1.6], [a0, o(0.05), 1.6]], '#1c1e22', s);
    for (let a = a0; a + 4.2 <= a1 + 0.01; a += 4.2) pq([[a, o(0.1), 1.6], [a + 2.1, o(0.1), 1.6], [a + 4.2, o(0.1), 5.6], [a + 2.1, o(0.1), 5.6]], WARN, s);
    for (const [h0, h1] of [[6.4, hm - 0.7], [hm + 0.7, LEAF_TOP - 1.2]]) {
      pq([[a0, o(0.05), h0], [a1, o(0.05), h0], [a1, o(0.05), h1], [a0, o(0.05), h1]], shade(STEEL, 0.25), s);
      const c = o(0.2);
      rod(a0, c, h0, a1, c, h0, 0.7, STEEL_HI);
      rod(a1, c, h0, a1, c, h1, 0.7, STEEL_HI);
      rod(a1, c, h1, a0, c, h1, 0.7, STEEL_HI);
      rod(a0, c, h1, a0, c, h0, 0.7, STEEL_HI);
      rod(a0, c, h0, a1, c, h1, 0.8, '#59646f');
      rod(a0, c, h1, a1, c, h0, 0.8, '#59646f');
    }
    rod(LEAF_A0, o(0.3), hm, 16, o(0.3), hm, 1, STEEL_HI);
    rod(LEAF_A0 + 0.2, o(0.3), 1.4, LEAF_A0 + 0.2, o(0.3), LEAF_TOP, 1.1, STEEL_HI);
    // Warnband am Querträger
    const c2 = 2.7 * s;
    pq([[LEAF_A0, c2 + 0.05 * s, LEAF_TOP + 1.1], [16, c2 + 0.05 * s, LEAF_TOP + 1.1], [16, c2 + 0.05 * s, LEAF_TOP + 3.3], [LEAF_A0, c2 + 0.05 * s, LEAF_TOP + 3.3]], '#1c1e22', s);
    for (let a = LEAF_A0 + 0.4; a + 3.2 <= 16.01; a += 3.2) pq([[a, c2 + 0.1 * s, LEAF_TOP + 1.1], [a + 1.6, c2 + 0.1 * s, LEAF_TOP + 1.1], [a + 3.2, c2 + 0.1 * s, LEAF_TOP + 3.3], [a + 1.6, c2 + 0.1 * s, LEAF_TOP + 3.3]], WARN, s);
  }
  bx(14.4, 16, -1.8, 1.8, 0, 2.6, STEEL_DK); // Laufrolle unten an der Fuge
  bx(14.8, 16, -1.9, 1.9, 2.6, LEAF_TOP, STEEL_DK, STEEL); // Riegelbalken in der Mitte
  bx(LEAF_A0, 16, -2.7, 2.7, LEAF_TOP, LEAF_TOP + 4.4, STEEL_DK, STEEL); // Querträger
}

/** Baustelle (Stufe 0 … 8 von 8): aufgewühlter Boden, Bauzaun, wachsender Rohbau mit Gerüst, Baustoffe; w = Größe in Feldern. */
function site(k, type, w, step) {
  const p = (step + 0.5) / 8.5;
  const e = w * 16 - 2;
  fls(k, -e, e, -e, e, '#8f846f');
  const H = Math.max(2, (SITE_H[type] ?? 30) * p);
  const c = w === 1 ? 7 : e * 0.62;
  k.fence(-e + 1, e - 1, -e + 1, e - 1, w === 1 ? 3 : 4.5);
  // Rohbau mit Bewehrung oben
  k.box(-c, c, -c, c, 0, H, '#a6a69e', '#b4b4ac', { mat: null });
  for (let a = -c + 2; a < c; a += 3) k.rod([a, c - 0.3, H], [a, c - 0.3, H + 2.6], 0.35, '#7a5a40');
  // Gerüst um den Rohbau
  if (w > 1) {
    const o = c + 2.2;
    const stepA = (2 * o) / Math.max(2, Math.round(o / 5));
    for (let a = -o; a <= o + 0.1; a += stepA) for (const [u, v] of [[a, o], [o, a], [a, -o], [-o, a]]) k.rod([u, v, 0], [u, v, H + 3], 0.55, '#9aa0a6');
    for (let h = 5; h < H + 2; h += 6) {
      k.rod([-o, o, h], [o, o, h], 0.45, '#9aa0a6');
      k.rod([o, o, h], [o, -o, h], 0.45, '#9aa0a6');
      k.box(-o, o, o - 1.2, o, h - 0.4, h, '#b98d4f', '#b98d4f', { mat: null });
      k.box(o - 1.2, o, -o, o, h - 0.4, h, '#b98d4f', '#b98d4f', { mat: null });
    }
    // Baustoffe: Palette mit Säcken, Steine
    k.box(-e + 3, -e + 9, e - 9, e - 3, 0, 0.7, '#9c7a52', '#9c7a52', { mat: null });
    k.box(-e + 3.3, -e + 8.7, e - 8.7, e - 3.3, 0.7, 3.2, '#d8d2c0', '#e2dccb', { mat: null });
    k.box(e - 9, e - 3, -e + 3, -e + 8, 0, 2.8, '#9d9e98', '#9d9e98', { mat: null });
  }
  if (w >= 3) {
    // Kran bei der FOB
    k.mast(-e + 5, -e + 5, 0, 52, 1.8, 1.8, '#d9b13a', false);
    k.rod([-e + 5, -e + 5, 52], [e - 10, -e + 5, 52], 1.1, '#d9b13a');
    k.rod([-e + 5, -e + 5, 52], [-e - 4, -e + 5, 52], 1.1, '#d9b13a');
    k.box(-e - 5, -e - 1, -e + 3.5, -e + 6.5, 49.5, 52, '#7d8287', '#7d8287', { mat: null });
    k.rod([e - 14, -e + 5, 52], [e - 14, -e + 5, Math.max(H + 4, 14)], 0.4, '#3a3d38');
  }
  if (w > 1) {
    // Bauzaun-Planen in Teamfarbe (an allen vier Seiten, gemalt nur vorn)
    team(k, () => {
      const pn = (face, plane, a0, a1) => k.facePanel(face, plane, a0, a1, 1.7, 3.1, TEAM0, 0.12, { mat: null, snow: false });
      pn('s', e - 1, -e + 4, e - 4);
      pn('n', -e + 1, -e + 4, e - 4);
      pn('e', e - 1, -e + 4, e - 4);
      pn('w', -e + 1, -e + 4, e - 4);
    });
  }
}

// ---------- Schnittstelle ----------

const cache = new Map(); // Schlüssel → BufferGeometry

/** Beschädigtes Gebäude: dieselbe Geometrie mit dunkleren Farben (Ruß), Teamfarbe kommt weiter von der Instanz. */
function darkened(geo) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'aUv', 'aInfo']) g.setAttribute(name, geo.getAttribute(name));
  const col = geo.getAttribute('color');
  g.setAttribute('color', new THREE.Float32BufferAttribute(Float32Array.from(col.array, (x) => x * DARK), 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Geometrie eines Militärgebäudes: type (fob, wall, gate, mortar, aa, phalanx, tower, drill), v = Variante aus milVariant (Mauer: Maske 0
 * … 15; Tor: 'u', 'v' oder 'Lu+' … 'Lv-'; Turm: Dachaufbau oder '-'; Baustelle: 's0' … 's8'), dmg = beschädigt. Mitte des Gebäudes =
 * Ursprung; je Variante einmal gebaut. null bei einer fremden Art.
 */
export function milGeometry(type, v = '', dmg = 0) {
  if (!MIL3D_TYPES.includes(type)) return null;
  const key = `${type}|${v}|${dmg ? 1 : 0}`;
  let g = cache.get(key);
  if (g) return g;
  if (dmg) {
    g = darkened(milGeometry(type, v, 0));
  } else {
    const k = new Kit3D();
    k.fh = 0;
    if (/^s\d$/.test(v)) site(k, type, BUILDINGS[type].w, Number(v.slice(1)));
    else {
      switch (type) {
        case 'fob': fob(k); break;
        case 'mortar': mortar(k); break;
        case 'aa': aa(k); break;
        case 'phalanx': phalanx(k); break;
        case 'tower': tower(k, v === '-' ? null : v); break;
        case 'drill': drill(k); break;
        case 'wall': wall(k, Number(v) || 0); break;
        case 'gate': if (v[0] === 'L') gateLeaf(k, v[1], v[2] === '+' ? 1 : -1); else gate(k, v || 'u'); break;
      }
    }
    g = k.geometry();
  }
  cache.set(key, g);
  return g;
}

/** Geometrie des Militärgebäudes b (game.buildings) in seinem jetzigen Zustand (fertig, Baustufe, Mauermaske, beschädigt). */
export const milGeometryOf = (b) => milGeometry(b.type, milVariant(b), milDamaged(b));

// ---------- Ausbauten besetzter Häuser (stronghold.js) ----------

const FORT_STEP = 1.6; // Abstand der Drahtwindungen (gemalt feiner)

/** Stacheldraht von (u0, v0) nach (u1, v1): Pfähle, Rolle als Schraube um die Linie; gap = halber Durchgang in der Mitte (0 = keiner). */
function wireRun(k, u0, v0, u1, v1, gap = 0) {
  const { WIRE, POST } = FORT_DIM;
  const len = Math.hypot(u1 - u0, v1 - v0);
  const du = (u1 - u0) / len;
  const dv = (v1 - v0) / len;
  const open = (t) => gap > 0 && Math.abs(t - len / 2) < gap;
  const posts = Math.max(2, Math.round(len / 12));
  for (let i = 0; i <= posts; i++) {
    const t = (i / posts) * len;
    if (!open(t)) k.rod([u0 + du * t, v0 + dv * t, 0], [u0 + du * t, v0 + dv * t, 5.4], 0.6, POST);
  }
  let prev = null;
  for (let t = 0; t <= len + 1e-6; t += FORT_STEP) {
    if (open(t)) {
      prev = null;
      continue;
    }
    const th = (t / 3.2) * TAU; // eine Windung je 3,2
    const side = Math.cos(th) * 2;
    const p = [u0 + du * t - dv * side, v0 + dv * t + du * side, 2.5 + Math.sin(th) * 2.2];
    if (prev) k.tube(prev, p, 0.26, 0.26, WIRE, 3);
    prev = p;
  }
}

/** MG-Nest bei (u, v): Ring aus Säcken mit Zugang zum Haus (−u, −v), MG auf Dreibein nach +u, Munitionskiste. */
function mgNest(k, u, v) {
  const { BAG, BAG_TOP, BOX, MG } = FORT_DIM;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.31;
    if (Math.cos(a - Math.PI * 1.25) > 0.82) continue; // Zugang zum Haus
    const x = u + Math.cos(a) * 4.8;
    const y = v + Math.sin(a) * 4.8;
    k.box(x - 1.4, x + 1.4, y - 1.4, y + 1.4, 0, 2.6, BAG, BAG_TOP, { mat: null });
  }
  k.flat(u - 3.2, u + 3.2, v - 3.2, v + 3.2, '#4a3e2a', 0.05, { mat: null, snow: false });
  k.box(u - 2.6, u - 0.8, v + 0.6, v + 1.8, 0, 1.3, BOX, tint(BOX, 0.12), { mat: null });
  for (const [a, b] of [[-1.3, -1], [-1.3, 1], [1.4, 0]]) k.rod([u, v, 3.1], [u + a, v + b, 0], 0.32, MG);
  k.box(u - 0.9, u + 1.2, v - 0.4, v + 0.4, 3, 3.9, MG, tint(MG, 0.15), { mat: null });
  k.rod([u + 1.2, v, 3.45], [u + 6.4, v, 3.6], 0.42, MG); // Lauf
  k.rod([u + 5.2, v, 3.58], [u + 5.4, v - 0.6, 2.9], 0.22, MG); // Zweibein vorn
  k.rod([u + 5.2, v, 3.58], [u + 5.6, v + 0.6, 2.9], 0.22, MG);
}

const fortCache = new Map();

/**
 * Ausbauten eines besetzten Hauses (Weltachsen, Mitte des Hauses = Ursprung): mask 1 Sandsäcke in zwei Lagen rundum (Durchgang in der
 * Mitte jeder Wand), 2 MG-Nest an der Ecke +u +v, 4 Stacheldraht um das Haus (Durchgang vorn bei +v); W, D = Maße des Hauses (q8).
 * Gemalt liegen Säcke und Nest nur vor den Wänden zur Kamera (+u, +v); in 3D dreht die Ansicht, also stehen die Säcke an allen vier.
 */
export function fortGeometry(W, D, mask) {
  const key = `${W}|${D}|${mask}`;
  let g = fortCache.get(key);
  if (g) return g;
  const k = new Kit3D();
  const { BAG, BAG_TOP, OFF, BAG_H, BAG_D, wallBags } = FORT_DIM;
  const U = W / 2;
  const V = D / 2;
  if (mask & 1) {
    const d = BAG_D / 2 + 0.1;
    const sides = [wallBags('u', U + d, -V, V), wallBags('u', -U - d, -V, V), wallBags('v', V + d, -U - BAG_D - 0.1, U + BAG_D + 0.1), wallBags('v', -V - d, -U - BAG_D - 0.1, U + BAG_D + 0.1)];
    let n = 0; // Säcke abwechselnd etwas heller, damit sie als einzelne Säcke zu sehen sind
    for (const side of sides) side.forEach((layer, i) => layer.forEach(([u0, u1, v0, v1]) => k.box(u0, u1, v0, v1, i * BAG_H, (i + 1) * BAG_H, n++ % 2 ? tint(BAG, 0.07) : BAG, n % 2 ? BAG_TOP : tint(BAG_TOP, 0.06), { mat: null })));
  }
  if (mask & 2) mgNest(k, U + 8, V + 8);
  if (mask & 4) {
    wireRun(k, -U - OFF, -V - OFF, U + OFF, -V - OFF);
    wireRun(k, -U - OFF, -V - OFF, -U - OFF, V + OFF);
    wireRun(k, U + OFF, -V - OFF, U + OFF, V + OFF);
    wireRun(k, -U - OFF, V + OFF, U + OFF, V + OFF, 6);
  }
  g = k.geometry();
  fortCache.set(key, g);
  return g;
}
