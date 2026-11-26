// Stadthäuser in 3D aus dem Baukasten (kit3d.js), Paket „Baukasten 3D“ als Vorlage für „Stadthäuser 3D“: dieselben Maße, Farben und
// Bauteile wie die gemalten Häuser in render/townhouses.js (dort die Funktionen res1, res2), dazu die Rückseiten (Fenster auf allen
// Wänden), die gemalt nie zu sehen sind. Gemalte Schatten entfallen (Schattenkarte), Rasenstreifen und Schnee macht der Shader.
// Bisher Wohnen Stufe 1 und 2; die übrigen Arten und Stufen folgen im Paket „Stadthäuser 3D“ (bis dahin null = Billboard).
// Örtliche Koordinaten wie townhouses.js: u = Welt-x, v = Welt-y ab der Zellmitte, h = Höhe.
import { Kit3D } from './kit3d.js';
import { RES_WALL, RES_ROOF, RES_ACC } from '../render/townhouses.js';
import { CAR_COLORS, HEDGE, LAWN, LAWN2, PATH, PAVE, shade, tint, clampLv } from '../render/isokit.js';

/** Hecke hinten und links am Grundstück (in 3D auch die Seiten). */
function hedges(k) {
  k.box(-25, 25, -25, -22.8, 0, 4, HEDGE, HEDGE, { mat: null });
  k.box(-25, -22.8, -22.8, 25, 0, 4, HEDGE, HEDGE, { mat: null });
}

function lawn(k) {
  k.flat(-25, 25, -25, 25, LAWN, 0.02);
  for (const s of [-17.5, -7.5, 2.5, 12.5]) k.flat(s, s + 5, -25, 25, LAWN2, 0.04);
}

/** Stufe 1: Einfamilienhaus mit Satteldach, Fensterläden, Garage, Auto in der Einfahrt und Garten. */
function res1(k, o) {
  const wall = RES_WALL[o.v];
  const acc = RES_ACC[o.v];
  lawn(k);
  k.flat(-6, -1.6, 6, 25, PATH, 0.07);
  k.flat(11, 23, 3, 25, PAVE, 0.07);
  hedges(k);
  k.tree(17, -17, 1, o.v + 1);
  k.box(-16, 8, -12, 6, 0, 15, wall, wall, { top: false });
  k.plinth(-16, 8, -12, 6, wall);
  const win = { seed: o.seed, shutter: acc, cross: true };
  k.winsAt('s', 6, [-12, 3.5], [[3.6, 9.6]], 3.4, win);
  k.door('s', 6, -4, 3.4, 9.2, shade(acc, 0.25));
  k.winsAt('e', 8, [-7.5, 1.5], [[3.6, 9.6]], 3.4, { ...win, seed: o.seed + 3 });
  k.winsAt('n', -12, [-12, -4, 3.5], [[3.6, 9.6]], 3.4, { ...win, seed: o.seed + 1 }); // Rückseite (nur 3D)
  k.winsAt('w', -16, [-7.5, 1.5], [[3.6, 9.6]], 3.4, { ...win, seed: o.seed + 2 });
  k.box(-6.8, -1.2, 6, 8.4, 10, 10.8, '#e6e2d8', '#e6e2d8', { mat: null }); // Vordach
  k.gable('u', -16, 8, -12, 6, 15, 11, RES_ROOF[o.v], wall);
  k.box(-11, -8.6, -9.6, -7.2, 15, 29.5, '#a0574a', '#6f3d33'); // Schornstein
  k.winsAt('e', 8, [-3], [[16.2, 20.6]], 2.6, { seed: o.seed + 5 });
  k.winsAt('w', -16, [-3], [[16.2, 20.6]], 2.6, { seed: o.seed + 6 });
  // Garage mit Sektionaltor
  k.box(11, 23, -10, 3, 0, 9, tint(wall, 0.08), '#a9a7a0');
  k.facePanel('s', 3, 12.4, 21.6, 0, 7.2, '#d4d6d6', 0.1, { mat: 'metal', snow: false });
  for (const h of [1.8, 3.6, 5.4]) k.facePanel('s', 3, 12.4, 21.6, h - 0.12, h + 0.12, '#a9abab', 0.16, { snow: false });
  k.car(17, 14, 'v', CAR_COLORS[o.seed % CAR_COLORS.length]);
  k.bush(-19.5, 19.5, 1.1, o.v);
  k.bush(6, 20, 0.8, o.v + 2);
}

/** Stufe 2: Doppelhaus mit Walmdach, zwei Eingängen, Balkonen und Dachfenstern. */
function res2(k, o) {
  const wall = RES_WALL[o.v];
  const acc = RES_ACC[o.v];
  lawn(k);
  k.flat(-7, 3, 9, 25, PATH, 0.07);
  k.flat(18.4, 24.6, -6, 25, PAVE, 0.07);
  hedges(k);
  k.tree(19, -19, 0.95, o.v);
  k.box(-20, 16, -14, 9, 0, 22, wall, wall, { top: false });
  k.plinth(-20, 16, -14, 9, wall);
  k.ledge(-20, 16, -14, 9, 11.2, shade(wall, 0.12), 0.3, 0.5);
  k.winsAt('s', 9, [-16.2, -10.8, 7.8, 12.6], [[3.6, 9.2]], 3.2, { seed: o.seed, cross: true });
  k.door('s', 9, -5, 3.2, 8.8, shade(acc, 0.2));
  k.door('s', 9, 1, 3.2, 8.8, shade(acc, 0.2));
  k.box(-7.4, 3.4, 9, 11.6, 9.6, 10.4, '#e6e2d8', '#e6e2d8', { mat: null });
  k.winsAt('s', 9, [-5, 1], [[14.6, 19.6]], 2.2, { seed: o.seed + 1 });
  k.winsAt('s', 9, [-15.4, -11.6, 6.6, 10.4], [[12.4, 20]], 2.4, { seed: o.seed + 2, lit: 0.3 });
  k.balcony('s', 9, -18, -9, 12, 3, acc);
  k.balcony('s', 9, 4, 13, 12, 3, acc);
  const rows = [[3.6, 9.2], [13.6, 19.6]];
  k.wins('e', 16, -14, 9, 3, rows, 3.2, { seed: o.seed + 4, cross: true });
  k.wins('w', -20, -14, 9, 3, rows, 3.2, { seed: o.seed + 6, cross: true }); // Rückseiten (nur 3D)
  k.wins('n', -14, -20, 16, 6, rows, 3.2, { seed: o.seed + 8, cross: true });
  k.hip(-20, 16, -14, 9, 22, 10, RES_ROOF[o.v]);
  k.box(-9, -6.6, -8.5, -6.1, 24, 33, '#a0574a', '#6f3d33'); // Schornstein
  // Dachfenster auf der vorderen und hinteren Dachfläche (knapp über den Ziegeln)
  for (const u of [-12, 7]) {
    k.poly([[u - 2, 6.2, 25.2], [u + 2, 6.2, 25.2], [u + 2, 3.4, 27.5], [u - 2, 3.4, 27.5]], '#3d566d', { n: [0, 1, 1], snow: false });
    k.poly([[u - 2, -11.2, 25.2], [u + 2, -11.2, 25.2], [u + 2, -8.4, 27.5], [u - 2, -8.4, 27.5]], '#3d566d', { n: [0, -1, 1], snow: false });
  }
  k.car(21.5, 8, 'v', CAR_COLORS[(o.seed + 2) % CAR_COLORS.length]);
  k.tree(-20, 19.5, 0.9, o.v + 2);
  k.bush(10, 20.5, 0.9, o.v);
}

const BUILD = { res: [res1, res2] };
const cache = new Map(); // Schlüssel → BufferGeometry

/** Gibt es ein 3D-Haus für Art ck und Stufe? (Sonst bleibt das gemalte Billboard.) */
export const hasTown3d = (ck, level) => !!BUILD[ck]?.[clampLv(level) - 1];

/**
 * Geometrie des Stadthauses (Zellenart ck, Stufe, Farbvariante) wie townhouses.js paintIso (o.v, o.seed), je Variante einmal
 * gebaut; null, wenn es noch kein 3D-Haus gibt. Ankerpunkt = Zellmitte am Boden.
 */
export function townGeometry(ck, level, variant) {
  const lv = clampLv(level);
  const f = BUILD[ck]?.[lv - 1];
  if (!f) return null;
  const key = `${ck}|${lv}|${variant % 3}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit3D();
    f(k, { v: variant % 3, seed: (variant % 3) * 7 + 11 }); // gemalt: Bild je variant % 3 (Schlüssel in drawTownIso)
    g = k.geometry();
    cache.set(key, g);
  }
  return g;
}
