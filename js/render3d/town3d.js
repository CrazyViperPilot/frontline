// Stadthäuser in 3D aus dem Baukasten (kit3d.js), Pakete „Baukasten 3D“ und „Stadthäuser 3D“: alle Arten und Stufen aus
// render/townhouses.js (Wohnen, Gewerbe, Markt, Rechenzentrum, Krankenhaus, Heliport je Stufe 1 bis 3) mit denselben Maßen, Farben
// und Bauteilen, dazu die Rückseiten (Fenster, Läden, Schilder auf allen Wänden), die gemalt nie zu sehen sind. Gemalte Schatten
// entfallen (Schattenkarte); Schnee legt der Shader auf Rasen und Dächer, Pflaster, Wege und Markierungen bleiben wie gemalt frei;
// feine Linien werden schmale Leisten oder Stäbe. Gartenbäume sind Kugelbäume des Baukastens wie gemalt (Begründung in docs/plan-3d.md, „Stand“).
// Örtliche Koordinaten wie townhouses.js: u = Welt-x, v = Welt-y ab der Zellmitte, h = Höhe.
// Town3D zeigt die Häuser im Spiel: ein InstancedMesh je Variante (Art, Stufe, Farbvariante, Teamfarbe bei TEAM_SHOWN), also ein
// Draw-Call je Variante im Bild, gleich wie viele Häuser sie zeigen (dazu einer je Variante in der Schattenkarte).
import * as THREE from '../vendor/three/three.module.min.js';
import { Kit3D, makeKitMaterial, setKitFrame, NIGHT_MORE } from './kit3d.js';
import { CAST } from './sun3d.js';
import {
  RES_WALL, RES_ROOF, RES_ACC, COM_FACADE, COM_AWN, COM_GLASS, STALL, MARKET_ROOF, MARKET_WALL, DC_WALL, DC_RIM, DC_LED, HOSP, RED,
  APRON, TEAM_SHOWN,
} from '../render/townhouses.js';
import { CAR_COLORS, HEDGE, LAWN, LAWN2, PATH, PAVE, PLAZA, ASPH, DECK, shade, tint, clampLv, k3, rnd } from '../render/isokit.js';
import { mix } from '../render/color.js';

// ---------- Gemeinsames ----------

/** Hecke hinten und links am Grundstück (in 3D auch die Seiten). */
function hedges(k) {
  k.box(-25, 25, -25, -22.8, 0, 4, HEDGE, HEDGE, { mat: null });
  k.box(-25, -22.8, -22.8, 25, 0, 4, HEDGE, HEDGE, { mat: null });
}

function lawn(k, stripes = true) {
  k.flat(-25, 25, -25, 25, LAWN, 0.02);
  if (stripes) for (const s of [-17.5, -7.5, 2.5, 12.5]) k.flat(s, s + 5, -25, 25, LAWN2, 0.04);
}

/** Feine Linie am Boden (Parkplatzmarkierung, Fugen) als schmale Fläche. */
function line(k, u0, v0, u1, v1, col, w = 0.5, h = 0.06) {
  if (u0 === u1) k.flat(u0 - w / 2, u0 + w / 2, Math.min(v0, v1), Math.max(v0, v1), col, h, { snow: false });
  else k.flat(Math.min(u0, u1), Math.max(u0, u1), v0 - w / 2, v0 + w / 2, col, h, { snow: false });
}

/** Flachdach mit Attika (wie gemalt: Rand box(… h, h + t) und parapet darüber), ohne Deckel des Hauskörpers. */
function flatRoof(k, u0, u1, v0, v1, h, t, rim, deck = DECK) {
  k.box(u0, u1, v0, v1, h, h + t, rim, rim, { top: false });
  k.parapet(u0, u1, v0, v1, h + t, rim, deck);
}

// ---------- Wohnen ----------

/** Stufe 1: Einfamilienhaus mit Satteldach, Fensterläden, Garage, Auto in der Einfahrt und Garten. */
function res1(k, o) {
  const wall = RES_WALL[o.v];
  const acc = RES_ACC[o.v];
  lawn(k);
  k.flat(-6, -1.6, 6, 25, PATH, 0.07, { snow: false });
  k.flat(11, 23, 3, 25, PAVE, 0.07, { snow: false });
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
  k.flat(-7, 3, 9, 25, PATH, 0.07, { snow: false });
  k.flat(18.4, 24.6, -6, 25, PAVE, 0.07, { snow: false });
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

/** Stufe 3: Wohnblock mit fünf Geschossen, Balkonen je Wohnung, Eingang mit Vordach; Dach mit Solarzellen, Grün oder Technik. */
function res3(k, o) {
  const wall = RES_WALL[o.v];
  const acc = RES_ACC[o.v];
  const H = 60;
  k.flat(-25, 25, -25, 25, PAVE, 0.02, { snow: false });
  k.flat(-25, 25, 17, 25, LAWN, 0.04);
  k.flat(21.5, 25, -25, 17, LAWN, 0.04);
  k.tree(22.5, -21, 0.85, o.v);
  k.box(-21, 18, -20, 13, 0, H, wall, wall, { top: false });
  k.wallBand(-21, 18, -20, 13, 0, 11, shade(wall, 0.12)); // Erdgeschoss etwas dunkler
  k.plinth(-21, 18, -20, 13, wall, 1.2);
  for (const h of [12, 24, 36, 48]) k.ledge(-21, 18, -20, 13, h, shade(wall, 0.14), 0.2, 0.6);
  const rows = [[3.6, 9.4], [15.4, 21.2], [27.4, 33.2], [39.4, 45.2], [51.4, 57.2]];
  k.wins('e', 18, -20, 13, 4, rows, 3.6, { seed: o.seed, lit: 0.28 });
  k.wins('w', -21, -20, 13, 4, rows, 3.6, { seed: o.seed + 2, lit: 0.28 }); // Rückseiten (nur 3D)
  k.wins('n', -20, -21, 18, 5, rows, 3.6, { seed: o.seed + 3, lit: 0.28 });
  // Vorderseite: Eingang, Fenster, Balkontüren, Balkone
  k.storefront('s', 13, -4.6, 1.6, 0.6, 8.6, 3.1, -1.5, o.seed);
  k.box(-6.4, 3.4, 13, 16.8, 8.8, 9.6, '#e6e2d8', '#e6e2d8', { mat: null });
  k.winsAt('s', 13, [-17.5, -11, 7.5, 14], [[3.6, 9.2]], 3.2, { seed: o.seed + 1 });
  const cols = [-13, -1.5, 10];
  for (let f = 1; f <= 4; f++) {
    const h = 12 * f;
    k.winsAt('s', 13, [-19, -7.25, 4.25, 15.8], [[h + 3.4, h + 9.2]], 2.8, { seed: o.seed + f * 5, lit: 0.3 });
    k.winsAt('s', 13, cols, [[h + 1.2, h + 9.8]], 3.2, { seed: o.seed + f * 9, lit: 0.25, frame: false });
    for (const c of cols) k.balcony('s', 13, c - 3.7, c + 3.7, h + 0.6, 3, acc);
  }
  // Dach
  flatRoof(k, -21.6, 18.6, -20.6, 13.6, H, 1.6, tint(wall, 0.1));
  const R = H + 0.3;
  if (o.v === 0) {
    for (const v0 of [-15, -8.5, -2]) k.solar(-3, 14, v0, 4.6, R + 0.4, R + 2.4); // Solarzellen in Reihen, schräg zur Sonne
  } else if (o.v === 1) {
    // Gründach mit Beeten
    k.flat(-2, 16.4, -18.4, 11.4, '#7aa556', R + 0.05);
    for (const [u, v] of [[2, -14], [9, -6], [4, 4], [12, 7]]) k.bush(u, v, 0.55, k3(u + v), R);
    k.flat(-2, 16.4, -2, 0, '#b9b2a2', R + 0.1, { snow: false });
  } else {
    for (const [u, v] of [[2, -12], [9, -12], [5, -2]]) k.acUnit(u, v, R, 2.6);
  }
  k.box(-15, -6, -16, -8, R, R + 7.5, tint(wall, 0.06), '#a29f97');
  // Vorplatz: Bäume, Fahrradbügel
  k.tree(-21, 21, 0.85, o.v + 1);
  k.tree(21.5, 21, 0.75, o.v + 2);
  for (const u of [5.5, 7.5, 9.5]) {
    k.rod([u, 15.5, 0.2], [u, 17.8, 0.2], 0.6, '#3e4a56');
    k.rod([u, 17.8, 0.2], [u, 17.8, 2.4], 0.6, '#3e4a56');
  }
}

// ---------- Gewerbe ----------

/** Café-Tisch mit Sonnenschirm. */
function cafe(k, u, v, cols) {
  k.cyl(u, v, 1.4, 0, 2.6, '#e9e6de', { n: 10 });
  k.box(u - 2.8, u - 1.8, v - 0.6, v + 0.6, 0, 1.6, '#7a5a3e', '#7a5a3e', { mat: 'wood' });
  k.box(u + 1.8, u + 2.8, v - 0.6, v + 0.6, 0, 1.6, '#7a5a3e', '#7a5a3e', { mat: 'wood' });
  k.rod([u, v, 2.6], [u, v, 7.4], 0.6, '#6d6a62');
  k.frustum(u, v, 4.6, 0.3, 6.6, 8.6, cols[0], { n: 10, top: false });
}

/** Werbeschild auf dem Dach: zwei Stützen und eine Tafel zur Straße (+v), hinten schlicht. */
function billboard(k, u0, u1, v, h, hh, col) {
  for (const u of [u0 + 1.5, u1 - 1.5]) k.rod([u, v, h], [u, v, h + 2.4], 1, '#55595d');
  k.box(u0, u1, v - 0.2, v + 0.2, h + 2.4, h + 2.4 + hh, col, col, { mat: null, snow: false });
  k.facePanel('s', v + 0.2, u0 + 1, u1 - 1, h + 3.6, h + 1.4 + hh, tint(col, 0.75), 0.06, { snow: false });
  k.facePanel('s', v + 0.2, u0 + 2, u0 + (u1 - u0) * 0.6, h + 4.6, h + 6, shade(col, 0.2), 0.1, { snow: false });
}

/** Stufe 1: Laden mit Schaufenstern, gestreifter Markise, Schild, Café-Tischen und Parkplatz. */
function com1(k, o) {
  const wall = COM_FACADE[o.v];
  const aw = COM_AWN[o.v];
  k.flat(-25, 25, -25, 25, PLAZA, 0.02, { snow: false });
  k.flat(15, 25, -25, 2, ASPH, 0.04, { snow: false });
  for (const v of [-16.5, -8]) line(k, 15.5, v, 24.5, v, '#f0f0eb', 0.6);
  k.car(20, -20.6, 'u', CAR_COLORS[(o.seed + 1) % CAR_COLORS.length]);
  k.car(20, -12.2, 'u', CAR_COLORS[(o.seed + 4) % CAR_COLORS.length]);
  k.box(-18, 12, -18, 4, 0, 14, wall, wall, { top: false });
  k.plinth(-18, 12, -18, 4, wall, 1);
  k.storefront('s', 4, -16.5, 10.5, 1.2, 9.8, 3.4, -3, o.seed);
  k.storefront('e', 12, -15.5, 1, 1.2, 9.8, 3.3, null, o.seed + 3);
  k.winsAt('n', -18, [-12, -3, 6], [[3.6, 9.2]], 3, { seed: o.seed + 5 }); // Rückseiten (nur 3D)
  k.door('n', -18, 9, 3, 8, '#6a6a6a');
  k.winsAt('w', -18, [-12, -4.5], [[3.6, 9.2]], 3, { seed: o.seed + 6 });
  // Schild über den Schaufenstern
  k.facePanel('s', 4, -17.4, 11.4, 10.8, 13.4, aw[0], 0.08, { snow: false });
  for (let u = -13; u < 8; u += 2.6) k.facePanel('s', 4, u, u + 1.7, 11.6, 12.6, '#f6f1e6', 0.14, { snow: false });
  k.awning('s', 4, -17.2, 11.2, 10.6, 5, 2.3, aw, 12);
  k.parapet(-18, 12, -18, 4, 14, tint(wall, 0.05));
  k.acUnit(-9, -10, 12.8, 2.5);
  k.acUnit(2, -12, 12.8, 1.8);
  for (const u of [-12.5, -2.5, 7.5]) cafe(k, u, 15.5, aw);
  k.bush(-21.5, 21, 0.9, o.v);
  k.bush(13, 21.5, 0.8, o.v + 1);
}

/** Stufe 2: Geschäftshaus mit zwei Läden im Erdgeschoss, zwei Bürogeschossen, Gesimsen und Werbetafel auf dem Dach. */
function com2(k, o) {
  const wall = COM_FACADE[o.v];
  const H = 38;
  k.flat(-25, 25, -25, 25, PLAZA, 0.02, { snow: false });
  k.box(-21, 18, -19, 11, 0, H, wall, wall, { top: false });
  k.plinth(-21, 18, -19, 11, wall, 1);
  k.storefront('s', 11, -19.4, -3.2, 1.2, 10.4, 3.2, -11, o.seed);
  k.storefront('s', 11, 0.6, 16.4, 1.2, 10.4, 3.2, 8.5, o.seed + 2);
  k.storefront('e', 18, -17.5, 9.5, 1.2, 10.4, 3.4, null, o.seed + 5);
  k.wins('n', -19, -21, 18, 7, [[3.6, 9.6]], 3.2, { seed: o.seed + 7 }); // Rückseiten (nur 3D)
  k.wins('w', -21, -19, 11, 5, [[3.6, 9.6]], 3.2, { seed: o.seed + 8 });
  k.wallBand(-21, 18, -19, 11, 12.2, 14.2, tint(wall, 0.35)); // Gesims über den Läden
  const rows = [[16.6, 23.6], [27.2, 34.2]];
  k.wins('s', 11, -21, 18, 7, rows, 3.2, { seed: o.seed, lit: 0.3, cross: true });
  k.wins('e', 18, -19, 11, 5, rows, 3.2, { seed: o.seed + 9, lit: 0.3, cross: true });
  k.wins('n', -19, -21, 18, 7, rows, 3.2, { seed: o.seed + 10, lit: 0.3, cross: true });
  k.wins('w', -21, -19, 11, 5, rows, 3.2, { seed: o.seed + 11, lit: 0.3, cross: true });
  k.awning('s', 11, -19.8, -2.8, 11.6, 4.6, 2.2, COM_AWN[o.v], 8);
  k.awning('s', 11, 0.2, 16.8, 11.6, 4.6, 2.2, COM_AWN[(o.v + 1) % 3], 8);
  flatRoof(k, -21.6, 18.6, -19.6, 11.6, H, 1.6, tint(wall, 0.3));
  k.acUnit(-12, -12, H + 0.3, 2.8);
  k.acUnit(-4, -12, H + 0.3, 2.8);
  billboard(k, 2, 16, -16, H + 0.3, 7.5, ['#d9442f', '#2f74c0', '#e0a92e'][o.seed % 3]);
  k.lamp(-22.5, 19);
  k.lamp(21, 19);
  k.bush(21.5, -21.5, 0.9, o.v);
}

/**
 * Glasfassade auf allen vier Seiten (wie townhouses.curtain): Spiegelung als Verlauf (oben heller), Geschossbänder, Pfosten,
 * einzelne beleuchtete Felder (am Tag wie gemalt rund jedes achte, nachts mehr), Dachfläche.
 */
function curtain(k, u0, u1, v0, v1, h0, h1, gl, seed) {
  const top = tint(gl, 0.45);
  const bot = shade(gl, 0.2);
  const hm = h0 + (h1 - h0) * 0.45;
  const colAt = (h) => (h >= hm ? mix(gl, top, (h - hm) / (h1 - hm)) : mix(bot, gl, (h - h0) / (hm - h0)));
  const fl = 7.4;
  for (const [face, plane, a0, a1, fs] of [['s', v1, u0, u1, 0], ['e', u1, v0, v1, 3], ['n', v0, u0, u1, 5], ['w', u0, v0, v1, 9]]) {
    const F = (x0, x1, z0, z1, col, off, o = {}) => k.facePanel(face, plane, x0, x1, z0, z1, col, off, { mat: null, snow: false, ...o });
    F(a0, a1, h0, hm, [bot, bot, gl, gl], 0);
    F(a0, a1, hm, h1, [gl, gl, top, top], 0);
    const cols = Math.max(2, Math.round((a1 - a0) / 3.4));
    for (let h = h0, r = 0; h < h1 - 2; h += fl, r++) {
      for (let c = 0; c < cols; c++) {
        const win = rnd(seed + r * 41 + c * 7 + fs) / 0.12;
        if (win > NIGHT_MORE) continue; // nie beleuchtet: das Glas genügt
        const b0 = a0 + ((a1 - a0) * c) / cols;
        const b1 = a0 + ((a1 - a0) * (c + 1)) / cols;
        const c0 = colAt(h + 0.6);
        const c1 = colAt(Math.min(h1, h + fl - 0.6));
        F(b0, b1, h + 0.6, Math.min(h1, h + fl - 0.6), [c0, c0, c1, c1], 0.04, { win });
      }
    }
    for (let c = 1; c < cols; c++) {
      const a = a0 + ((a1 - a0) * c) / cols;
      F(a - 0.22, a + 0.22, h0, h1, shade(gl, 0.3), 0.07);
    }
    for (let h = h0 + fl; h < h1 - 1; h += fl) F(a0, a1, h - 0.35, h + 0.35, '#dde4ea', 0.09);
  }
  k.poly([[u0, v0, h1], [u1, v0, h1], [u1, v1, h1], [u0, v1, h1]], '#9ea4a8', { n: [0, 0, 1] });
}

/** Stufe 3: Bürohochhaus aus Glas auf einem Sockel mit Lobby, Krone mit Band in Teamfarbe, Antenne, Fahnen auf dem Vorplatz. */
function com3(k, o) {
  const gl = COM_GLASS[o.v];
  const H = 96;
  const ground = '#d8d1c2';
  k.flat(-25, 25, -25, 25, ground, 0.02, { snow: false });
  for (let s = -20; s <= 20; s += 8) {
    line(k, s, -25, s, 25, shade(ground, 0.06), 0.5, 0.04);
    line(k, -25, s, 25, s, shade(ground, 0.06), 0.5, 0.04);
  }
  // Sockel mit Lobby (rundum Glas)
  k.box(-21, 19, -19, 13, 0, 9, '#cfd2d2', '#a6b08f');
  k.storefront('s', 13, -19.5, 17.5, 0.6, 7.6, 4.1, -1.5, o.seed);
  k.storefront('e', 19, -17.5, 11.5, 0.6, 7.6, 4.1, null, o.seed + 4);
  k.storefront('n', -19, -19.5, 17.5, 0.6, 7.6, 4.1, null, o.seed + 6); // Rückseiten (nur 3D)
  k.storefront('w', -21, -17.5, 11.5, 0.6, 7.6, 4.1, null, o.seed + 8);
  for (const [u, v] of [[16, -16], [16, 10.5], [-18, 10.5]]) k.bush(u, v, 0.45, o.v, 9);
  curtain(k, -15, 13, -15, 9, 9, H, gl, o.seed);
  // Krone: Technikgeschoss, Band in Teamfarbe, Lüftungsschlitze, Antennen
  k.box(-13, 11, -13, 7, H, H + 5, '#c8ccd0', '#a9aeb3');
  k.wallBand(-13, 11, -13, 7, H + 3, H + 4.4, o.color);
  for (let a = -11; a < 11; a += 1.6) {
    k.facePanel('s', 7, a - 0.2, a + 0.2, H + 0.6, H + 2.6, '#8f9499', 0.06, { snow: false });
    k.facePanel('n', -13, a - 0.2, a + 0.2, H + 0.6, H + 2.6, '#8f9499', 0.06, { snow: false });
  }
  k.rod([-5, -5, H + 5], [-5, -5, H + 22], 1.1, '#5d6266');
  k.rod([4, -9, H + 5], [4, -9, H + 13], 0.8, '#5d6266');
  k.ball(-5, -5, H + 22, 1.3, '#ff4a3a', 1.3, 6, 3);
  // Vordach am Eingang, Fahnen und Bäume auf dem Vorplatz
  k.box(-6.5, 3.5, 13, 17.5, 7.2, 8, '#e1e4e5', '#e1e4e5', { mat: null });
  for (const u of [-18, -14, -10]) k.flagpole(u, 21.5, 0, 15, o.color);
  k.tree(18, 21, 0.85, o.v);
  k.tree(22, -21, 0.8, o.v + 1);
}

// ---------- Markt ----------

/** Marktstand: Tisch mit Waren, vier Pfosten und gestreiftes Zeltdach (First entlang u). */
function stall(k, u, v, cols, seed) {
  const hw = 4.2;
  const hd = 2.6;
  const H = 6.6;
  const T = 8.8;
  for (const [a, b] of [[u - hw, v - hd], [u + hw, v - hd], [u - hw, v + hd], [u + hw, v + hd]]) k.rod([a, b, 0], [a, b, H], 0.7, '#6b5a48');
  k.box(u - hw + 0.6, u + hw - 0.6, v - hd + 0.7, v + hd - 0.7, 0, 3, '#8a6242', '#a57a52', { mat: 'wood' });
  for (let i = 0; i < 4; i++) {
    const a = u - hw + 1.6 + i * 1.9;
    const c = ['#e2b04a', '#c8574a', '#6aa35a', '#e8892e', '#9b59b6', '#f0e6c8'][(seed + i) % 6];
    k.box(a - 0.75, a + 0.75, v - 1, v + 1, 3, 3.8, c, tint(c, 0.18), { mat: null, snow: false });
  }
  const n = 6;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a0 = u - hw - 0.4 + ((2 * hw + 0.8) * i) / n;
      const a1 = u - hw - 0.4 + ((2 * hw + 0.8) * (i + 1)) / n;
      k.poly([[a0, v + side * (hd + 0.5), H], [a1, v + side * (hd + 0.5), H], [a1, v, T], [a0, v, T]], cols[i % 2], { mat: null, n: [0, side * 2.2, hd] });
    }
  }
  for (const s of [-1, 1]) {
    const a = u + s * (hw + 0.4);
    k.poly([[a, v - hd - 0.5, H], [a, v + hd + 0.5, H], [a, v, T]], cols[0], { mat: null, snow: false, n: [s, 0, 0] });
  }
}

/** Uhrturm mit Gesimsen, Uhren und Rundbogenfenstern auf allen Seiten, Zeltdach, goldener Kugel und Fahne in Teamfarbe. */
function clockTower(k, u0, u1, v0, v1, H, wall, team) {
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  k.box(u0, u1, v0, v1, 0, H, wall, wall, { top: false });
  k.plinth(u0, u1, v0, v1, wall);
  k.ledge(u0, u1, v0, v1, H * 0.36, tint(wall, 0.35), 0.3, 0.9);
  k.ledge(u0, u1, v0, v1, H * 0.68, tint(wall, 0.35), 0.3, 0.9);
  const sides = [['s', v1, um, 3], ['e', u1, vm, 4], ['n', v0, um, 5], ['w', u0, vm, 6]];
  for (const [f, pl, a, seed] of sides) k.archWins(f, pl, [a], H * 0.4, H * 0.58, 2.6, { seed });
  k.door('s', v1, um, 3, 6.5, '#5b3b22');
  k.box(u0 - 0.7, u1 + 0.7, v0 - 0.7, v1 + 0.7, H, H + 1.2, tint(wall, 0.3));
  for (const [f, pl, a] of sides) k.clockFace(f, pl, a, H * 0.84, 2.7);
  const rh = 11;
  k.pyramid(um, vm, (u1 - u0) / 2 + 0.9, H + 1.2, rh, MARKET_ROOF);
  k.ball(um, vm, H + 1.2 + rh + 0.8, 1.3, '#e3b43a', 1.3, 8, 4);
  k.flagpole(um, vm, H + rh + 1.2, 9.8, team);
}

/** Stufe 1: Wochenmarkt mit vier Ständen um einen Brunnen. */
function market1(k, o) {
  k.cobble();
  k.tree(-21, -21, 0.85, o.v);
  stall(k, -12, -13, STALL[0], o.seed);
  stall(k, 12, -13, STALL[1 + (o.v % 2)], o.seed + 1);
  k.lamp(20, -20);
  k.fountain(0, 0, 5);
  stall(k, -12, 12, STALL[3], o.seed + 2);
  k.lamp(-20, 20);
  k.crate(19.5, -2.5);
  k.crate(19.5, 0.2);
  k.crate(22.2, -1.2, 1, 1.8);
  stall(k, 12, 12, STALL[4], o.seed + 3);
  k.tree(21.5, 21.5, 0.75, o.v + 1);
}

/** Markthalle mit Tonnendach, Rundbogenfenstern ringsum, großem Tor, Fächerfenstern in beiden Giebeln und Oberlicht. */
function hall(k, u0, u1, v0, v1, H, rh, wall, seed) {
  const vm = (v0 + v1) / 2;
  k.box(u0, u1, v0, v1, 0, H, wall, wall, { top: false });
  k.plinth(u0, u1, v0, v1, wall);
  const n = Math.max(3, Math.round((u1 - u0) / 7));
  const step = (u1 - u0) / n;
  const doorAt = u0 + step * Math.floor(n / 2) + step / 2;
  const all = Array.from({ length: n }, (_, i) => u0 + step * (i + 0.5));
  k.archWins('s', v1, all.filter((a) => a !== doorAt), 2.8, H - 4, 3.2, { seed });
  k.archWins('n', v0, all, 2.8, H - 4, 3.2, { seed: seed + 4 }); // Rückseite (nur 3D)
  const ends = [v0 + (v1 - v0) * 0.2, v1 - (v1 - v0) * 0.2];
  k.archWins('e', u1, ends, 2.8, H - 6.5, 2.8, { seed: seed + 2 });
  k.archWins('w', u0, ends, 2.8, H - 6.5, 2.8, { seed: seed + 3 });
  // Tor: Rundbogen mit Flügeln
  const R = 3.2;
  const gate = (e, off) => {
    const pts = [[doorAt - R - e, v1 + off, 0], [doorAt + R + e, v1 + off, 0]];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI;
      pts.push([doorAt + (R + e) * Math.cos(t), v1 + off, H - 5 + (R + e) * Math.sin(t)]);
    }
    return pts;
  };
  k.poly(gate(0.8, 0.08), tint(wall, 0.45), { snow: false, n: [0, 1, 0] });
  k.poly(gate(0, 0.14), '#5c4330', { mat: 'wood', snow: false, n: [0, 1, 0] });
  k.facePanel('s', v1, doorAt - 0.2, doorAt + 0.2, 0, H - 5 + R, '#3e2d20', 0.18, { snow: false });
  k.wallBand(u0, u1, v0, v1, H - 1.2, H, tint(wall, 0.4)); // Gesims
  k.vault('u', u0, u1, v0, v1, H, rh, MARKET_ROOF, wall);
  const fr = Math.min(rh, (v1 - v0) / 2) * 0.72;
  k.fanWin('e', u1, vm, H, fr);
  k.fanWin('w', u0, vm, H, fr);
  // Oberlicht am First
  const top = H + rh;
  k.poly([[u0 + 2, vm - 1.6, top + 0.08], [u1 - 2, vm - 1.6, top + 0.08], [u1 - 2, vm + 1.6, top + 0.08], [u0 + 2, vm + 1.6, top + 0.08]], '#9cc3d5', { snow: false, n: [0, 0, 1] });
}

/** Stufe 2: Markthalle, davor Stände unter Markisen. */
function market2(k, o) {
  const wall = MARKET_WALL[o.v];
  k.cobble();
  hall(k, -21, 11, -20, 4, 11, 8, wall, o.seed);
  k.tree(21, -21, 0.8, o.v);
  stall(k, 19, -9, STALL[(o.v + 1) % 5], o.seed + 1);
  k.lamp(-22, 7.5);
  stall(k, -13, 14, STALL[0], o.seed + 2);
  stall(k, 3, 14, STALL[(o.v + 3) % 5], o.seed + 3);
  k.crate(16, 6.5);
  k.crate(18.6, 6.5, 1, 1.8);
  k.tree(21.5, 15, 0.8, o.v + 1);
}

/** Stufe 3: Markthalle mit Uhrturm und Fahne. */
function market3(k, o) {
  const wall = MARKET_WALL[o.v];
  k.cobble('#d6caae');
  hall(k, -23, 7, -16, 8, 12, 8.5, wall, o.seed);
  clockTower(k, 12, 21, -24, -15, 34, tint(wall, 0.1), o.color);
  stall(k, 18, -4, STALL[(o.v + 2) % 5], o.seed + 1);
  k.lamp(10.5, 11);
  stall(k, -15, 16, STALL[0], o.seed + 2);
  stall(k, 1, 16, STALL[(o.v + 1) % 5], o.seed + 3);
  k.tree(20, 13, 0.75, o.v);
  k.tree(21.5, 21.5, 0.7, o.v + 2);
}

// ---------- Rechenzentrum ----------

/** Leuchtband auf allen vier Wänden (ohne Licht und Schattierung, wirkt selbstleuchtend). */
function glowBand(k, u0, u1, v0, v1, h0, h1, color = DC_LED) {
  const o = { mat: null, snow: false, ground: true };
  k.facePanel('s', v1, u0, u1, h0, h1, color, 0.06, o);
  k.facePanel('n', v0, u0, u1, h0, h1, color, 0.06, o);
  k.facePanel('e', u1, v0, v1, h0, h1, shade(color, 0.14), 0.06, o);
  k.facePanel('w', u0, v0, v1, h0, h1, shade(color, 0.14), 0.06, o);
}

/** Notstrom-Aggregat: Container mit Lüftungsschlitzen und Auspuff. */
function generator(k, u, v) {
  k.box(u - 4, u + 4, v - 2, v + 2, 0, 5, '#6b7d5c', '#7d8f6c', { mat: 'metal' });
  for (let a = u - 3; a < u + 3.6; a += 1.2) {
    k.facePanel('s', v + 2, a - 0.2, a + 0.2, 0.8, 4.2, '#556348', 0.06, { snow: false });
    k.facePanel('n', v - 2, a - 0.2, a + 0.2, 0.8, 4.2, '#556348', 0.06, { snow: false });
  }
  k.cyl(u - 2.6, v - 0.6, 0.6, 5, 9, '#5d6064', { n: 8 });
}

/** Rückkühler: Kasten mit zwei Lüftern oben. */
function chiller(k, u, v, h = 0) {
  k.box(u - 3.2, u + 3.2, v - 2.1, v + 2.1, h, h + 3.4, '#cfd3d6', '#bfc4c8', { mat: 'metal' });
  k.fan(u - 1.6, v, h + 3.4, 1.3);
  k.fan(u + 1.6, v, h + 3.4, 1.3);
}

/** Halle des Rechenzentrums: Metallverkleidung mit Rippen, Leuchtband, Flachdach mit Brüstung, Eingang mit Vordach. */
function dcHall(k, u0, u1, v0, v1, H) {
  k.box(u0, u1, v0, v1, 0, H, DC_WALL, '#6b737a', { top: false });
  k.ribs(u0, u1, v0, v1, 0.8, H - 3.4, 1.8, DC_WALL);
  glowBand(k, u0, u1, v0, v1, H - 3, H - 2.2);
  flatRoof(k, u0 - 0.4, u1 + 0.4, v0 - 0.4, v1 + 0.4, H, 1.2, DC_RIM, '#7c8287');
  k.storefront('s', v1, u0 + 3, u0 + 9, 0.4, 6.8, 3, u0 + 6, 7);
  k.box(u0 + 2.2, u0 + 9.8, v1, v1 + 3, 6.8, 7.5, '#d5d8da', '#d5d8da', { mat: null });
}

/** Stufe 1: Datenhalle mit Lüftern, Notstrom und Zaun. */
function dc1(k, o) {
  k.flat(-25, 25, -25, 25, '#c3c5bf', 0.02, { snow: false });
  k.flat(-25, 25, 13, 25, LAWN, 0.04);
  k.fence(-24, 24, -24, 24);
  dcHall(k, -19, 9, -17, 5, 12);
  for (const v of [-12, -5]) for (const u of [-13, -5, 3]) k.fan(u, v, 12.4, 2.2);
  generator(k, 16, -19);
  k.car(17, 3, 'v', CAR_COLORS[(o.seed + 3) % CAR_COLORS.length]);
  k.bush(-18, 19, 0.9, o.v);
  k.bush(6, 19.5, 0.8, o.v + 1);
}

/** Stufe 2: größere Halle, Antenne auf dem Dach, Rückkühler daneben. */
function dc2(k, o) {
  k.flat(-25, 25, -25, 25, '#c3c5bf', 0.02, { snow: false });
  k.flat(-25, 25, 15, 25, LAWN, 0.04);
  k.fence(-24, 24, -24, 24);
  dcHall(k, -22, 10, -21, 6, 16);
  for (const v of [-16, -9]) for (const u of [-17, -10, -3, 4]) k.fan(u, v, 16.4, 2.2);
  k.dish(4, 0, 16.4, 3.6);
  for (const v of [-16, -7, 2]) chiller(k, 18, v);
  generator(k, 15, 11);
  k.bush(-19, 20, 0.9, o.v);
}

/** Stufe 3: Halle mit gläsernem Leitstand auf dem Dach (Band in Teamfarbe), Gittermast, Kühler und Dieseltanks. */
function dc3(k, o) {
  k.flat(-25, 25, -25, 25, '#c3c5bf', 0.02, { snow: false });
  k.fence(-24, 24, -24, 24);
  const H = 18;
  dcHall(k, -23, 9, -22, 6, H);
  curtain(k, -23, -9, -22, -8, H + 0.3, H + 16, '#3e6f8f', o.seed);
  k.wallBand(-23, -9, -22, -8, H + 13.6, H + 14.6, o.color);
  k.mast(-16, -15, H + 16, 70, 2.2, 0.5);
  for (const [u, v] of [[-3, -17], [4, -17], [-3, -10], [4, -10], [-17, -3], [-10, -3], [-3, -3], [4, -3]]) k.fan(u, v, H + 0.4, 2.2);
  chiller(k, 17, -16);
  chiller(k, 17, -7);
  k.dish(17, 1, 0, 3.4);
  for (const [u, v] of [[15.5, 13], [21, 18]]) {
    k.cyl(u, v, 2.8, 0, 7, '#d8d6cf', { n: 14, mat: 'metal' });
    k.cyl(u, v, 2.88, 3.35, 3.65, '#a9a7a0', { n: 14, top: false });
  }
}

// ---------- Krankenhaus ----------

/** Fensterband (Klinik): durchgehendes Glas mit Pfosten, einzelne Felder hell. */
function ribbon(k, face, plane, a0, a1, h0, h1, seed = 0) {
  const F = (x0, x1, col, off, o = {}) => k.facePanel(face, plane, x0, x1, h0, h1, col, off, { mat: null, snow: false, ...o });
  F(a0, a1, '#46637d', 0.08);
  const n = Math.max(2, Math.round((a1 - a0) / 2.6));
  const fs = { s: 0, e: 3, n: 5, w: 9 }[face];
  for (let i = 0; i < n; i++) {
    const b0 = a0 + ((a1 - a0) * i) / n;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const win = rnd(seed + i * 7 + fs) / 0.22;
    if (win <= NIGHT_MORE) F(b0, b1, '#46637d', 0.11, { win });
    if (i) F(b0 - 0.22, b0 + 0.22, '#ebebe6', 0.14);
  }
}

/** Schild auf dem Dach: weiße Tafel mit rotem Kreuz zur Straße (+v), hinten ebenso. */
function roofSign(k, u0, u1, v, h, hh) {
  for (const u of [u0 + 1, u1 - 1]) k.rod([u, v, h], [u, v, h + 1.2], 0.8, '#7d8186');
  k.box(u0, u1, v - 0.5, v + 0.5, h + 1.2, h + 1.2 + hh, '#f6f5f1', '#f6f5f1', { mat: null });
  const a = (u0 + u1) / 2;
  const c = h + 1.2 + hh / 2;
  const s = hh * 0.36;
  const t = s * 0.36;
  for (const [f, pl] of [['s', v + 0.5], ['n', v - 0.5]]) {
    k.facePanel(f, pl, a - s, a + s, c - t, c + t, RED, 0.06, { snow: false });
    k.facePanel(f, pl, a - t, a + t, c - s, c + s, RED, 0.06, { snow: false });
  }
}

/** Rotes Kreuz flach auf dem Dach (weißes Feld). */
function roofCross(k, u, v, h, s) {
  const t = s * 0.34;
  const g = { ground: true, mat: null, snow: false };
  k.flat(u - s - 1, u + s + 1, v - s - 1, v + s + 1, '#fbfaf7', h, g);
  k.flat(u - s, u + s, v - t, v + t, RED, h + 0.03, g);
  k.flat(u - t, u + t, v - s, v + s, RED, h + 0.03, g);
}

/** Klinikbau: weiß, Fensterbänder je Geschoss auf allen Seiten, Flachdach mit Brüstung; gibt die Höhe zurück. */
function clinic(k, u0, u1, v0, v1, floors, seed) {
  const H = floors * 7;
  k.box(u0, u1, v0, v1, 0, H, HOSP, '#d9d8d2', { top: false });
  k.plinth(u0, u1, v0, v1, '#c9c7c0', 1);
  for (let f = 0; f < floors; f++) {
    const h0 = f * 7 + 2.4;
    ribbon(k, 's', v1, u0 + 1.6, u1 - 1.6, h0, h0 + 3.4, seed + f * 11);
    ribbon(k, 'e', u1, v0 + 1.6, v1 - 1.6, h0, h0 + 3.4, seed + f * 13);
    ribbon(k, 'n', v0, u0 + 1.6, u1 - 1.6, h0, h0 + 3.4, seed + f * 17); // Rückseiten (nur 3D)
    ribbon(k, 'w', u0, v0 + 1.6, v1 - 1.6, h0, h0 + 3.4, seed + f * 19);
    if (f) k.ledge(u0, u1, v0, v1, f * 7, shade(HOSP, 0.1), 0.15, 0.5);
  }
  flatRoof(k, u0 - 0.4, u1 + 0.4, v0 - 0.4, v1 + 0.4, H, 1.6, '#e3e2dc', '#c9c8c1');
  return H;
}

/** Eingangshalle aus Glas (drei freie Seiten) mit Dachrand. */
function lobby(k, u0, u1, v0, v1, H, seed) {
  k.box(u0, u1, v0, v1, 0, H, '#e8e7e2', '#e8e7e2', { top: false });
  k.storefront('s', v1, u0 + 1, u1 - 1, 0.4, H - 1.4, 3, (u0 + u1) / 2, seed);
  k.storefront('e', u1, v0 + 1, v1 - 1, 0.4, H - 1.4, 3, null, seed + 1);
  k.storefront('w', u0, v0 + 1, v1 - 1, 0.4, H - 1.4, 3, null, seed + 2);
  k.box(u0 - 0.3, u1 + 0.3, v0 - 0.3, v1 + 0.3, H, H + 0.8, '#d9d8d2');
}

/** Vordach auf zwei Stützen. */
function canopy(k, u0, u1, v0, v1, h) {
  for (const u of [u0 + 0.8, u1 - 0.8]) k.rod([u, v1 - 0.8, 0], [u, v1 - 0.8, h], 0.8, '#9aa0a5');
  k.box(u0, u1, v0, v1, h, h + 0.8, '#eceae4', '#eceae4', { mat: null });
}

/** Stufe 1: Klinik mit zwei Geschossen, Vordach, Schild und Krankenwagen. */
function hosp1(k, o) {
  lawn(k, false);
  k.flat(-25, 25, 9, 25, '#c9c4b8', 0.04, { snow: false });
  k.flat(3, 25, 11, 25, ASPH, 0.06, { snow: false });
  for (const u of [8, 13, 18]) line(k, u, 12, u, 18, '#f0f0eb', 0.5, 0.08);
  k.tree(21, -20, 0.85, o.v);
  const H = clinic(k, -19, 13, -17, 4, 2, o.seed);
  roofCross(k, -9, -7, H + 0.35, 4);
  roofSign(k, 1, 10, 3, H + 1.6, 5.5);
  canopy(k, -9, 1, 4, 9, 6.2);
  k.van(10.5, 15, 'u', '#f4f3ef', RED, true);
  k.tree(-21, 20, 0.85, o.v + 1);
  k.bush(-12, 21, 0.8, o.v + 2);
}

/** Stufe 2: drei Geschosse, gläserne Eingangshalle, zwei Krankenwagen. */
function hosp2(k, o) {
  lawn(k, false);
  k.flat(-25, 25, 10, 25, '#c9c4b8', 0.04, { snow: false });
  k.flat(9, 25, 3, 25, ASPH, 0.06, { snow: false });
  k.tree(21, -21, 0.8, o.v);
  const H = clinic(k, -21, 15, -19, 1, 3, o.seed);
  roofCross(k, -10, -9, H + 0.35, 4.5);
  roofSign(k, 5, 13.5, 0.5, H + 1.6, 6);
  lobby(k, -12, 4, 1, 9, 7.5, o.seed);
  canopy(k, -9, 1, 9, 14, 6);
  k.van(14.5, 9, 'v', '#f4f3ef', RED, true);
  k.van(20.5, 9, 'v', '#f4f3ef', RED, false);
  k.tree(-21, 19, 0.85, o.v + 1);
  k.bush(5, 21, 0.8, o.v);
}

/** Stufe 3: vier Geschosse mit Hubschrauber-Landeplatz auf dem Dach. */
function hosp3(k, o) {
  lawn(k, false);
  k.flat(-25, 25, 10, 25, '#c9c4b8', 0.04, { snow: false });
  k.flat(9, 25, 3, 25, ASPH, 0.06, { snow: false });
  const H = clinic(k, -22, 16, -21, 1, 4, o.seed);
  k.helipad(-8, -10, 7.6, H + 0.35);
  k.box(7, 13, -18, -12, H + 0.3, H + 4.5, '#e3e2dc', '#c9c8c1');
  roofSign(k, 6, 14.5, 0.5, H + 1.6, 6);
  lobby(k, -12, 4, 1, 9, 7.5, o.seed);
  canopy(k, -9, 1, 9, 14, 6);
  k.van(14.5, 9, 'v', '#f4f3ef', RED, true);
  k.van(20.5, 9, 'v', '#f4f3ef', RED, true);
  k.tree(-21, 19, 0.85, o.v + 1);
  k.tree(21.5, -21.5, 0.75, o.v);
  k.bush(5, 21, 0.8, o.v);
}

// ---------- Heliport ----------

function apron(k) {
  k.flat(-25, 25, -25, 25, APRON, 0.02, { snow: false });
  for (let s = -15; s <= 15; s += 10) {
    line(k, s, -25, s, 25, shade(APRON, 0.08), 0.5, 0.04);
    line(k, -25, s, 25, s, shade(APRON, 0.08), 0.5, 0.04);
  }
}

/** Kontrollturm: schmaler Schaft, Glaskanzel (nachts hell), Dach mit Antenne. */
function ctlTower(k, u, v, H) {
  k.box(u - 3.2, u + 3.2, v - 3.2, v + 3.2, 0, H, '#dcd8ce', '#dcd8ce', { top: false });
  const rows = [[H * 0.3, H * 0.3 + 2.4], [H * 0.62, H * 0.62 + 2.4]];
  k.winsAt('s', v + 3.2, [u], rows, 1.8, { seed: 5 });
  k.winsAt('n', v - 3.2, [u], rows, 1.8, { seed: 6 }); // Rückseiten (nur 3D)
  k.winsAt('w', u - 3.2, [v], rows, 1.8, { seed: 7 });
  k.door('e', u + 3.2, v, 2.2, 4.6, '#55606a');
  k.box(u - 4.4, u + 4.4, v - 4.4, v + 4.4, H, H + 0.8, '#cfcbc1');
  k.box(u - 4.1, u + 4.1, v - 4.1, v + 4.1, H + 0.8, H + 4.8, '#3f6684', '#3f6684', { mat: null, win: 1.6, top: false });
  for (const a of [-2.05, 0, 2.05]) {
    k.facePanel('s', v + 4.1, u + a - 0.22, u + a + 0.22, H + 0.8, H + 4.8, '#e1e6eb', 0.06, { snow: false });
    k.facePanel('n', v - 4.1, u + a - 0.22, u + a + 0.22, H + 0.8, H + 4.8, '#e1e6eb', 0.06, { snow: false });
    k.facePanel('e', u + 4.1, v + a - 0.22, v + a + 0.22, H + 0.8, H + 4.8, '#e1e6eb', 0.06, { snow: false });
    k.facePanel('w', u - 4.1, v + a - 0.22, v + a + 0.22, H + 0.8, H + 4.8, '#e1e6eb', 0.06, { snow: false });
  }
  k.box(u - 4.7, u + 4.7, v - 4.7, v + 4.7, H + 4.8, H + 5.8, '#eceae4');
  k.rod([u + 1.5, v - 1.5, H + 5.8], [u + 1.5, v - 1.5, H + 11], 0.7, '#55595d');
  k.ball(u + 1.5, v - 1.5, H + 11.3, 0.9, '#ff4a3a', 0.9, 6, 3);
}

/** Windsack an einem Mast (orange und weiß gestreift, Rohr nach +u, hängt etwas durch). */
function windsock(k, u, v) {
  k.rod([u, v, 0], [u, v, 9.5], 0.8, '#cfd2d4');
  const seg = [[0, 1.3], [1.6, 1.15], [3.2, 0.95], [4.8, 0.75], [6.2, 0.6]];
  for (let i = 0; i < seg.length - 1; i++) {
    const [a0, r0] = seg[i];
    const [a1, r1] = seg[i + 1];
    k.tube([u + a0, v, 9.2 - a0 * 0.075], [u + a1, v, 9.2 - a1 * 0.075 - 0.2], r0, r1, i % 2 ? '#f4f1ea' : '#f07a2a', 8);
  }
}

/** Treibstofftank (stehend, mit Ring und flacher Haube). */
function fuelTank(k, u, v, r, h) {
  k.cyl(u, v, r, 0, h, '#d9d6cc', { n: 14, top: false, mat: 'metal' });
  k.cyl(u, v, r + 0.08, h * 0.5 - 0.15, h * 0.5 + 0.15, '#a9a7a0', { n: 14, top: false });
  k.cap(u, v, r, h, '#d9d6cc', 0.35, 14, 3);
}

/** Hangar mit Tonnendach (First entlang v), großem Tor nach vorn und Fenstern an den Seiten. */
function hangar(k, u0, u1, v0, v1, H, rh, seed) {
  k.box(u0, u1, v0, v1, 0, H, '#c9cbc6', '#b4b7b2', { top: false });
  k.ribs(u0, u1, v0, v1, 0.6, H - 0.4, 2.2, '#c9cbc6');
  k.vault('v', u0, u1, v0, v1, H, rh, '#8d9aa4', '#c9cbc6');
  const a0 = u0 + 2;
  const a1 = u1 - 2;
  const top = H + rh * 0.55;
  k.facePanel('s', v1, a0, a1, 0, top, '#7d8a93', 0.12, { mat: 'metal', snow: false });
  for (let a = a0 + 2.3; a < a1 - 0.5; a += 2.3) k.facePanel('s', v1, a - 0.2, a + 0.2, 0, top, '#5e6870', 0.16, { snow: false });
  k.winsAt('e', u1, [v0 + 3.5, v0 + 8], [[3, 5.6]], 2.4, { seed });
  k.winsAt('w', u0, [v0 + 3.5, v0 + 8], [[3, 5.6]], 2.4, { seed: seed + 1 });
}

/** Stufe 1: Landeplatz, Kontrollturm und Windsack. */
function heli1(k) {
  apron(k);
  ctlTower(k, -19, -19, 12);
  windsock(k, 18, -21);
  k.helipad(3, 3, 14.5);
}

/** Stufe 2: dazu Tanklager und ein höherer Turm. */
function heli2(k) {
  apron(k);
  ctlTower(k, -19, -19, 14);
  windsock(k, 18, -21);
  k.helipad(3, 3, 14.5);
  fuelTank(k, -20.5, 13.5, 2.8, 6);
  fuelTank(k, -14.5, 19.5, 2.8, 6);
}

/** Stufe 3: Hangar, Kontrollturm, Tanklager, Landeplatz nach vorn verschoben. */
function heli3(k, o) {
  apron(k);
  ctlTower(k, -19, -19, 16);
  hangar(k, 6, 24, -24, -8, 8, 6.5, o.seed);
  k.helipad(-4, 6, 13.5);
  fuelTank(k, -21.5, 17, 2.6, 6);
  fuelTank(k, -17, 21.5, 2.6, 6);
  windsock(k, 19, 13);
}

// ---------- Ablauf ----------

const BUILD = {
  res: [res1, res2, res3],
  com: [com1, com2, com3],
  market: [market1, market2, market3],
  dc: [dc1, dc2, dc3],
  hospital: [hosp1, hosp2, hosp3],
  heliport: [heli1, heli2, heli3],
};
const cache = new Map(); // Schlüssel → BufferGeometry

/** Gibt es ein 3D-Haus für Art ck und Stufe? (Sonst bleibt das gemalte Billboard.) */
export const hasTown3d = (ck, level) => !!BUILD[ck]?.[clampLv(level) - 1];

/** Schlüssel einer Variante: Art, Stufe, Farbvariante, Teamfarbe nur bei TEAM_SHOWN (wie der Bildschlüssel in drawTownIso). */
export function townKey(ck, level, variant, color = '') {
  const lv = clampLv(level);
  return `${ck}|${lv}|${variant % 3}|${TEAM_SHOWN.has(ck + lv) ? color : ''}`;
}

/**
 * Geometrie des Stadthauses (Zellenart ck, Stufe, Farbvariante, Teamfarbe) wie townhouses.js paintIso (o.v, o.seed, o.color), je
 * Variante einmal gebaut; null, wenn es kein 3D-Haus gibt. Ankerpunkt = Zellmitte am Boden.
 */
export function townGeometry(ck, level, variant, color = '#888888') {
  const lv = clampLv(level);
  const f = BUILD[ck]?.[lv - 1];
  if (!f) return null;
  const key = townKey(ck, lv, variant, color);
  let g = cache.get(key);
  if (!g) {
    const k = new Kit3D();
    const v = variant % 3;
    f(k, { v, seed: v * 7 + 11, color }); // gemalt: Bild je variant % 3 (Schlüssel in drawTownIso)
    g = k.geometry();
    cache.set(key, g);
  }
  return g;
}

const CAP0 = 16; // erste Größe eines Satzes (wächst bei Bedarf auf das Doppelte)

/**
 * Stadthäuser im Spiel (Renderer3D, Durchlauf „Objekte“): je Variante ein InstancedMesh mit gemeinsamer Geometrie aus townGeometry
 * und einem Material (makeKitMaterial) für alle. Je Bild begin → add je Haus → end.
 */
export class Town3D {
  constructor() {
    this.material = makeKitMaterial();
    this.group = new THREE.Group();
    this.group.name = 'stadthaeuser';
    this.sets = new Map(); // townKey → { mesh, n }
    this.count = 0;
  }

  /** Bildanfang: Licht, Schnee, Nacht und Schattenstärke für alle Häuser (setKitFrame), Zähler leeren. */
  begin(frame) {
    setKitFrame(this.material, frame);
    for (const s of this.sets.values()) s.n = 0;
    this.count = 0;
  }

  /** Satz einer Variante, beim ersten Gebrauch angelegt; ist er voll, wird er verdoppelt. */
  setOf(key, geo, need) {
    let s = this.sets.get(key);
    if (s && need <= s.cap) return s;
    const cap = s ? s.cap * 2 : CAP0;
    const mesh = new THREE.InstancedMesh(geo, this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(CAST);
    mesh.count = 0;
    mesh.visible = false;
    if (s) {
      mesh.instanceMatrix.array.set(s.mesh.instanceMatrix.array.subarray(0, s.n * 16));
      this.group.remove(s.mesh);
      s.mesh.dispose();
      s.mesh = mesh;
      s.cap = cap;
    } else {
      s = { mesh, n: 0, cap };
      this.sets.set(key, s);
    }
    this.group.add(mesh);
    return s;
  }

  /** Stadthaus b (cityBuildings, kind 'town') am Boden der Höhe h; false, wenn es kein 3D-Haus gibt (dann malt der Renderer). */
  add(b, h) {
    const geo = townGeometry(b.ck, b.level, b.variant, b.color);
    if (!geo) return false;
    const key = townKey(b.ck, b.level, b.variant, b.color);
    const s = this.setOf(key, geo, (this.sets.get(key)?.n ?? 0) + 1);
    const m = s.mesh.instanceMatrix.array;
    const o = s.n * 16;
    m.fill(0, o, o + 16);
    m[o] = m[o + 5] = m[o + 10] = m[o + 15] = 1;
    m[o + 12] = b.x;
    m[o + 13] = b.y;
    m[o + 14] = h;
    s.n++;
    this.count++;
    return true;
  }

  /** Bildende: Zahl je Satz setzen, leere Sätze verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.n;
      m.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  /** Häuser, sichtbare Varianten (= Draw-Calls ohne Schattenkarte) und Dreiecke im Bild. */
  stats() {
    const out = { houses: this.count, calls: 0, tris: 0 };
    for (const s of this.sets.values()) {
      if (!s.n) continue;
      out.calls++;
      out.tris += (s.mesh.geometry.getAttribute('position').count / 3) * s.n;
    }
    return out;
  }

  dispose() {
    for (const s of this.sets.values()) s.mesh.dispose(); // Geometrie gehört dem Zwischenspeicher (townGeometry)
    this.material.dispose();
  }
}
