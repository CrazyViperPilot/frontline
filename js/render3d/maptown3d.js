// Kartenstadt in 3D aus dem Baukasten (kit3d.js), Paket „Kartenstadt 3D“: alle Gebäude aus render/maptown.js und render/landmarks.js
// (Altbau mit Hof und Mauer, Klinkerhaus, Fachwerkhaus, Neubau, Gehöft; Lagerhalle, Fabrik mit Shedhalle, Mauer, Zug, Bahnhof,
// Bahnsteig, Wachturm; Fabrikhalle und Strommast der festen Karten) mit denselben Maßen, Farben und Bauteilen, dazu alle vier Wände
// (Fenster, Tore, Türen auch auf den Rückseiten, die gemalt nie zu sehen sind). Gemalte Schatten entfallen (Schattenkarte), Schnee legt
// der Shader auf Dächer und Rasen. Dazu die Hochspannungsleitung als Linien (Wires3D), die Mast zu Mast mit Durchhang dem Gelände folgt.
// Örtliche Koordinaten wie maptown.js, aber in der Welt fest (Drehung 0): Maß W × D = Welt-x × Welt-y (Häuser im 8-px-Raster q8,
// sonst genau), a = Längsachse (die längere Seite), b = Querachse; Ankerpunkt = Mitte des Grundrisses am Boden. Zug und Bahnsteig
// bauen längs Welt-x und drehen mit dem Winkel des Gebäudes (Instanz), der Mast mit der Richtung der Leitung (yaw).
// Zustand: ein zerstörtes Haus (Ruine) zeigt der Maler weiter als gemalten Schutt vor dem Haken (isoitems.drawTownItemIso); Sandsäcke,
// Draht, Fahne eines besetzten Hauses bleiben gemalt. Ein Haus hat sonst keine Schadensstufen.
import * as THREE from '../vendor/three/three.module.min.js';
import { Kit3D } from './kit3d.js';
import { gate3d, lorry3d } from './works3d.js';
import { shade, tint, GLASS } from '../render/isokit.js';
import {
  mapInfo, towerSide, q8, TW, TW_SIDE, TW_HUT, TW_RADAR, TW_ANT, TW_LAMP, TW_LEG, TW_DECK, TW_GRATE, TW_WALL, TW_RIM, TW_ROOF, TW_GLASS,
  TW_RAIL, PLASTER, TILES, BRICK, SHUTTER, TIMBER, FACH_WALL, NEU_WALL, NEU_ACC, BARN, HALL_WALL, HALL_BAND, METAL_ROOF, FACT_WALL,
  FACT_ROOF, SKY, CONC, YARD, CONTAINER, ALT_WALL, ALT_ROOF, ALT_STONE, ALT_QUOIN, ALT_H, ALT_RH, altPlan, spots,
} from '../render/maptown.js';
import { PLANT_BRICK, PLANT_CLAD, PLANT_ROOF, PLANT_SKY, PLANT_STEEL, PY, PYLON_WIRES } from '../render/landmarks.js';

// ---------- Rahmen ----------

/**
 * Rahmen entlang der langen Seite (wie maptown.js frameOf, aber in der Welt fest): a = Längsachse, b = Querachse; long 'u' = a ist Welt-x.
 * face: Wandname der Seite b1, b0, a1, a0 (wie onFace: 's', 'n', 'e', 'w').
 */
function frame(long) {
  const L = long === 'u';
  return {
    L,
    axis: L ? 'u' : 'v',
    cross: L ? 'v' : 'u',
    R: (a0, a1, b0, b1) => (L ? [a0, a1, b0, b1] : [b0, b1, a0, a1]),
    at: (a, b) => (L ? [a, b] : [b, a]),
    n: (na, nb, nh) => (L ? [na, nb, nh] : [nb, na, nh]),
    face: L ? { b1: 's', b0: 'n', a1: 'e', a0: 'w' } : { b1: 'e', b0: 'w', a1: 's', a0: 'n' },
  };
}

/** Die vier Wände eines Grundrisses: [Schlüssel, Wandname, Ebene, Anfang, Ende entlang der Wand]. */
const wallsOf = (f, a0, a1, b0, b1) => [
  ['b1', f.face.b1, b1, a0, a1],
  ['b0', f.face.b0, b0, a0, a1],
  ['a1', f.face.a1, a1, b0, b1],
  ['a0', f.face.a0, a0, b0, b1],
];

/** Kasten vor einer Wand (Fensterbank, Stufe, Vordach): entlang der Wand a0 … a1, d vor der Wand, Höhe h0 … h1. */
function fbox(k, face, plane, a0, a1, d, h0, h1, col, top = col, o = {}) {
  const p = onFaceXY(face, plane);
  const P0 = p(a0, d0(d));
  const P1 = p(a1, d);
  k.box(Math.min(P0[0], P1[0]), Math.max(P0[0], P1[0]), Math.min(P0[1], P1[1]), Math.max(P0[1], P1[1]), h0, h1, col, top, o);
}
const d0 = () => 0;

/** (entlang, vor der Wand) → (u, v) einer Wand. */
function onFaceXY(face, plane) {
  switch (face) {
    case 's': return (a, d) => [a, plane + d];
    case 'n': return (a, d) => [a, plane - d];
    case 'e': return (a, d) => [plane + d, a];
    default: return (a, d) => [plane - d, a];
  }
}

const NOWIN = { mat: null, snow: false };

/** Teil (z. B. Lkw) im Maßstab s an (u, v): eigener Puffer, Ecken skaliert und versetzt in k geschrieben (gemalt: sub() des Zeichenkontexts). */
function scaled(k, u, v, s, build) {
  const part = new Kit3D();
  build(part);
  for (let i = 0; i < part.p.length; i += 3) k.p.push(u + part.p[i] * s, v + part.p[i + 1] * s, part.p[i + 2] * s);
  for (const a of ['n', 'c', 'i']) for (const x of part[a]) k[a].push(x);
  for (const x of part.t) k.t.push(x * s);
}

// ---------- Altbau ----------

/** Niedrige Hofmauer mit Gitter (Stab alle 3, Handlauf) von (a0, b0) nach (a1, b1), Pfeiler an den Enden. */
function yardWall(k, f, a0, b0, a1, b1) {
  const alongA = b0 === b1;
  const t = 0.6;
  const R = alongA ? f.R(Math.min(a0, a1), Math.max(a0, a1), b0 - t, b0 + t) : f.R(a0 - t, a0 + t, Math.min(b0, b1), Math.max(b0, b1));
  k.box(...R, 0, 1.7, ALT_STONE, tint(ALT_STONE, 0.3), { mat: null });
  const len = Math.hypot(a1 - a0, b1 - b0);
  const n = Math.max(1, Math.round(len / 3));
  const P = (a, b, h) => [...f.at(a, b), h];
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const b = b0 + ((b1 - b0) * i) / n;
    k.rod(P(a, b, 1.7), P(a, b, 4.1), 0.4, '#262a2e');
  }
  k.rod(P(a0, b0, 4.1), P(a1, b1, 4.1), 0.5, '#262a2e');
  for (const [a, b] of [[a0, b0], [a1, b1]]) k.box(...f.R(a - 1, a + 1, b - 1, b + 1), 0, 4.8, ALT_STONE, tint(ALT_STONE, 0.3), { mat: null });
}

/** Altbau (drei Geschosse) auf seinem Grundstück: Steinsockel, Gesimse, Eckquader, Fensterbänke, Eingang mit Stufen und Vordach, Walmdach mit Gauben. */
function altbau(k, o) {
  const f = frame(o.long);
  const p = altPlan(o);
  const { ha0, ha1, hb0, hb1 } = p;
  const wall = ALT_WALL[o.c % ALT_WALL.length];
  const roof = ALT_ROOF[o.c % ALT_ROOF.length];
  const H = ALT_H;
  const R = f.R;
  const light = tint(wall, 0.3);
  // Hofmauer ringsum, Tor am Weg
  const dA = p.dA;
  yardWall(k, f, p.ya0, p.yb0, p.ya1, p.yb0);
  yardWall(k, f, p.ya0, p.yb0, p.ya0, p.yb1);
  yardWall(k, f, p.ya1, p.yb0, p.ya1, p.yb1);
  yardWall(k, f, p.ya0, p.yb1, dA - 3.2, p.yb1);
  yardWall(k, f, dA + 3.2, p.yb1, p.ya1, p.yb1);
  // Hauskörper: Putz, Rustika im Erdgeschoss (Band), Steinsockel
  k.box(...R(ha0, ha1, hb0, hb1), 0, H, wall, wall, { top: false });
  k.wallBand(...R(ha0, ha1, hb0, hb1), 3, 11, shade(wall, 0.07));
  k.wallBand(...R(ha0, ha1, hb0, hb1), 0, 3, ALT_STONE);
  // Eckquader: abwechselnd lange und kurze Steine an allen vier Hausecken
  for (let h = 3, i = 0; h < H - 2.6; h += 2.3, i++) {
    const t = Math.min(H - 2.2, h + 1.95);
    const w = i % 2 ? 2.2 : 3.6;
    for (const [face, plane, a, dir] of [
      [f.face.b1, hb1, ha0, 1], [f.face.b1, hb1, ha1, -1], [f.face.b0, hb0, ha0, 1], [f.face.b0, hb0, ha1, -1],
      [f.face.a1, ha1, hb1, -1], [f.face.a1, ha1, hb0, 1], [f.face.a0, ha0, hb1, -1], [f.face.a0, ha0, hb0, 1],
    ]) k.facePanel(face, plane, Math.min(a, a + dir * w), Math.max(a, a + dir * w), h, t, ALT_QUOIN, 0.08, { mat: null, snow: false });
  }
  // Fenster auf allen Wänden: beleuchtet nach der Variante wv, unregelmäßig
  const ws = { cross: true, lit: 0.34, frame: '#f4f0e6' };
  const seed = p.wv * 977 + 13;
  k.winsAt(f.face.b1, hb1, p.side, [[4.2, 8.8]], 4, { ...ws, seed, skip: (i) => i === p.mid });
  k.winsAt(f.face.b1, hb1, p.side, [[13.8, 20.2], [24.6, 30.6]], 4, { ...ws, seed: seed + 1 });
  k.winsAt(f.face.b0, hb0, p.side, [[4.2, 8.8], [13.8, 20.2], [24.6, 30.6]], 4, { ...ws, seed: seed + 3 });
  for (const [face, plane, s] of [[f.face.a1, ha1, 2], [f.face.a0, ha0, 4]]) k.winsAt(face, plane, p.end, [[4.2, 8.8], [13.8, 20.2], [24.6, 30.6]], 4, { ...ws, seed: seed + s });
  for (const [, face, plane] of wallsOf(f, ha0, ha1, hb0, hb1)) {
    const at = face === f.face.b1 || face === f.face.b0 ? p.side : p.end;
    for (const a of at) k.facePanel(face, plane, a - 2.9, a + 2.9, 20.6, 21.7, light, 0.07, NOWIN); // Fensterverdachung
    for (const h of [4.2, 13.8, 24.6]) {
      for (const a of face === f.face.b1 && h === 4.2 ? at.filter((_, i) => i !== p.mid) : at) fbox(k, face, plane, a - 2.8, a + 2.8, 0.9, h - 1.05, h - 0.45, '#cfc8b8', '#d9d3c6', { mat: null }); // Fensterbank
    }
  }
  // Gesimse: Gurt über dem Erdgeschoss, Stockwerksband, Traufgesims
  for (const [h, t, out] of [[11, 1, 0.6], [22.4, 0.6, 0.35], [H - 2.2, 0.9, 0.5], [H - 1.3, 1.3, 1.1]]) {
    k.box(...R(ha0 - out, ha1 + out, hb0 - out, hb1 + out), h, h + t, light, tint(light, 0.25), { mat: null });
  }
  // Eingang: Tür mit Oberlicht, Stufen, Vordach (an der Hofseite b1)
  k.door(f.face.b1, hb1, dA, 4.6, 9.6, '#4a2c1e');
  k.disc(f.face.b1, hb1, dA, 9.9, 2.3, '#f3d885', 0.1, 10);
  for (const s of [-1, 1]) fbox(k, f.face.b1, hb1, dA + s * 4.3 - 0.5, dA + s * 4.3 + 0.5, 0.9, 7.4, 8.4, '#ffd27a', '#ffd27a', { mat: null, win: 1.6 });
  k.box(...R(dA - 4.4, dA + 4.4, hb1, hb1 + 3.4), 0, 0.8, '#b8b1a2', '#d8d2c4', { mat: null });
  k.box(...R(dA - 3.8, dA + 3.8, hb1, hb1 + 2.3), 0.8, 1.6, '#b8b1a2', '#d8d2c4', { mat: null });
  k.box(...R(dA - 3.2, dA + 3.2, hb1, hb1 + 1.2), 1.6, 2.4, '#b8b1a2', '#d8d2c4', { mat: null });
  for (const s of [-1, 1]) k.rod([...f.at(dA + s * 3.9, hb1 + 0.3), 8.6], [...f.at(dA + s * 3.9, hb1 + 3.3), 11], 0.6, '#2c3036');
  k.box(...R(dA - 4.6, dA + 4.6, hb1, hb1 + 3.8), 11, 11.7, '#3b4048', '#5a616b', { mat: null });
  // Dach (Walm) mit Schornsteinen und Gauben auf beiden Dachflächen
  k.hip(...R(ha0, ha1, hb0, hb1), H, ALT_RH, roof, 1.4, 0.7);
  const bm = (hb0 + hb1) / 2;
  for (const t of [0.24, 0.76]) {
    const a = ha0 + (ha1 - ha0) * t;
    k.box(...R(a - 1.9, a + 1.9, bm - 4.9, bm - 1.1), H + 3, H + 18, '#8a4a38', '#8a4a38');
    k.box(...R(a - 2.3, a + 2.3, bm - 5.3, bm - 0.7), H + 18, H + 19, '#5b5753', '#6f6a66', { mat: null });
  }
  const w = (hb1 - hb0) / 2 + 1.4;
  const slope = (b) => H + ALT_RH - (Math.abs(b - bm) * ALT_RH) / w;
  for (const [sgn, face] of [[1, f.face.b1], [-1, f.face.b0]]) {
    const bf = sgn > 0 ? hb1 - 2.5 : hb0 + 2.5;
    for (const a of p.dormers) {
      const hf = slope(bf);
      const B = sgn > 0 ? [bf - 6.5, bf] : [bf, bf + 6.5];
      k.box(...R(a - 3.2, a + 3.2, B[0], B[1]), hf - 1.2, hf + 5.8, wall, wall, { top: false });
      k.winsAt(face, bf, [a], [[hf + 0.6, hf + 4.8]], 3.4, { seed: p.wv * 31 + 5, lit: 0.5, cross: true });
      k.gable(f.cross, ...R(a - 3.2, a + 3.2, B[0], B[1]), hf + 5.8, 2.8, roof, wall, 0.9);
    }
  }
}

// ---------- Klinkerhaus, Fachwerkhaus, Neubau, Gehöft ----------

/** Höhe der Dachfläche eines Satteldachs (First bm auf H + rh, Traufe bei Abstand w auf H). */
const slopeH = (b, bm, w, H, rh) => H + rh - (Math.abs(b - bm) * rh) / w;

/** Dachfenster flach in beiden Dachflächen eines Satteldachs entlang a (Mitte a, ww breit, von b-Abstand dA bis dB vom First). */
function roofWins(k, f, a, ww, dA, dB, bm, w, H, rh) {
  for (const s of [1, -1]) {
    const P = (aa, bb) => [...f.at(aa, bm + s * bb), slopeH(bm + s * bb, bm, w, H, rh) + 0.25];
    k.poly([P(a - ww / 2, dA), P(a + ww / 2, dA), P(a + ww / 2, dB), P(a - ww / 2, dB)], '#3d566d', { mat: null, snow: false, n: f.n(0, s * rh, w) });
  }
}

/** Schornstein (Ziegel) mit Abdeckung. */
function chimney(k, f, a, b, h0, h1, col = '#8e5444') {
  k.box(...f.R(a - 1.8, a + 1.8, b - 1.8, b + 1.8), h0, h1, col, shade(col, 0.2), { mat: null });
  k.box(...f.R(a - 2.2, a + 2.2, b - 2.2, b + 2.2), h1, h1 + 0.9, '#6f6a66', '#6f6a66', { mat: null });
}

/** Klinkerhaus (drei Geschosse): Ziegel mit weißen Fensterrahmen, Balkone, Satteldach mit Dachfenstern, Rundfenster im Giebel. */
function klinker(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const wall = BRICK[o.c % BRICK.length];
  const roof = TILES[(o.c + 1) % 3];
  const acc = SHUTTER[o.c % SHUTTER.length];
  const H = 33;
  const R = f.R;
  k.box(...R(a0, a1, b0, b1), 0, H, wall, wall, { top: false });
  k.plinth(...R(a0, a1, b0, b1), '#6f6a66', 2);
  for (const h of [11, 22]) k.wallBand(...R(a0, a1, b0, b1), h - 0.5, h + 0.5, tint(wall, 0.18));
  const side = spots(a0, a1, 10, 6);
  const end = spots(b0, b1, 10, 6);
  const balc = side.length >= 4 ? [1, side.length - 2] : [0];
  const dI = side.length >= 3 ? Math.floor(side.length / 2) : -1;
  const frameC = '#f2efe6';
  // Straßenseite b1 (mit Tür) und Rückseite b0 (gleiche Fenster, Balkone, ohne Tür)
  for (const [face, plane, s] of [[f.face.b1, b1, 0], [f.face.b0, b0, 10]]) {
    k.winsAt(face, plane, side, [[2.6, 8.4]], 4.4, { seed: o.seed + s, frame: frameC, cross: true, skip: (i) => s === 0 && i === dI });
    k.winsAt(face, plane, side, [[13.6, 19.4], [24.6, 30.4]], 4.4, { seed: o.seed + 1 + s, frame: frameC, cross: true, skip: (i) => balc.includes(i) });
    k.winsAt(face, plane, balc.map((i) => side[i]), [[11.6, 19.6], [22.6, 30.6]], 4.6, { seed: o.seed + 4 + s, frame: frameC });
    for (const i of balc) for (const h of [11.2, 22.2]) k.balcony(face, plane, side[i] - 4.6, side[i] + 4.6, h, 3.2, acc);
  }
  for (const [face, plane, s] of [[f.face.a1, a1, 2], [f.face.a0, a0, 12]]) {
    k.winsAt(face, plane, end, [[2.6, 8.4], [13.6, 19.4], [24.6, 30.4]], 4.4, { seed: o.seed + s, frame: frameC, cross: true });
  }
  if (dI >= 0) {
    k.door(f.face.b1, b1, side[dI], 5, 9.2, '#3f5a6e');
    k.box(...R(side[dI] - 4, side[dI] + 4, b1, b1 + 2.6), 9.8, 10.6, '#e6e2d8', '#e6e2d8', { mat: null });
  } else k.door(f.face.a1, a1, (b0 + b1) / 2, 5, 9.2, '#3f5a6e');
  const bm = (b0 + b1) / 2;
  const w = (b1 - b0) / 2;
  k.gable(f.axis, ...R(a0, a1, b0, b1), H, 15, roof, wall);
  chimney(k, f, a0 + (a1 - a0) * 0.3, bm - 2, H + 6, H + 19);
  for (const [face, plane] of [[f.face.a1, a1], [f.face.a0, a0]]) k.disc(face, plane, bm, H + 6, 2.3, GLASS, 0.1, 12);
  for (const a of [a0 + (a1 - a0) * 0.3, a0 + (a1 - a0) * 0.7]) roofWins(k, f, a, 5, w * 0.3, w * 0.62, bm, w, H, 15);
}

/** Fachwerkhaus (zwei Geschosse): Fachwerk über dem Steinsockel, vorkragendes Obergeschoss, Läden, Blumenkästen, steiles Dach. */
function fachwerk(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const roof = TILES[o.c % 3];
  const acc = SHUTTER[(o.c + 1) % SHUTTER.length];
  const H = 22;
  const rh = Math.min(22, (b1 - b0) * 0.42);
  const R = f.R;
  const O = 0.9; // Auskragung des Obergeschosses nach b1 und a1 wie gemalt
  k.box(...R(a0, a1, b0, b1), 0, 11, FACH_WALL, FACH_WALL, { top: false });
  k.wallBand(...R(a0, a1, b0, b1), 0, 3.4, '#b9a78a');
  k.box(...R(a0, a1 + O, b0, b1 + O), 11, H, FACH_WALL, FACH_WALL, { top: false });
  // Balken: waagrechte und senkrechte Hölzer auf allen vier Wänden beider Geschosse, im Raster step
  const timber = (A0, A1, B0, B1, h0, h1, step) => {
    for (const [, face, plane, x0, x1] of wallsOf(f, A0, A1, B0, B1)) {
      for (const h of [h0 + 0.5, h1 - 0.5]) k.facePanel(face, plane, x0, x1, h - 0.55, h + 0.55, TIMBER, 0.1, NOWIN);
      const n = Math.max(2, Math.round((x1 - x0) / step));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        k.facePanel(face, plane, x - 0.5, x + 0.5, h0, h1, TIMBER, 0.1, NOWIN);
        if (i < n && i % 3 === 1) {
          const x2 = x0 + ((x1 - x0) * (i + 1)) / n;
          k.poly([wp(face, plane, x, h0 + 0.5, 0.12), wp(face, plane, x2, h0 + 0.5, 0.12), wp(face, plane, x2, h1 - 0.5, 0.12), wp(face, plane, x, h1 - 0.5, 0.12)], TIMBER, { mat: null, snow: false, n: FN[face] });
        }
      }
    }
  };
  timber(a0, a1, b0, b1, 3.4, 11, 7.5);
  timber(a0, a1 + O, b0, b1 + O, 11, H, 7.5);
  const side = spots(a0, a1, 11, 7.5);
  const end = spots(b0, b1, 11, 7.5);
  const mid = Math.floor(side.length / 2);
  const flowers = ['#d8473f', '#e06a9a', '#f0c23a'];
  for (const [face, plane, plane2, s] of [[f.face.b1, b1, b1 + O, 0], [f.face.b0, b0, b0, 6]]) {
    k.winsAt(face, plane, side, [[4.6, 8.8]], 3.4, { seed: o.seed + s, shutter: acc, cross: true, skip: (i) => s === 0 && i === mid });
    k.winsAt(face, plane2, side, [[14, 18.8]], 3.4, { seed: o.seed + 1 + s, shutter: acc, cross: true });
    side.forEach((a, i) => {
      fbox(k, face, plane2, a - 2.1, a + 2.1, 0.8, 12.6, 14, '#5d7a3a', '#5d7a3a', { mat: null }); // Blumenkasten
      fbox(k, face, plane2, a - 1.8, a + 1.8, 0.9, 14, 14.5, flowers[(o.seed + i) % 3], flowers[(o.seed + i) % 3], { mat: null }); // Blüten
    });
  }
  k.door(f.face.b1, b1, side[mid], 4.4, 8.6, '#6a4a32');
  for (const [face, plane, plane2, s] of [[f.face.a1, a1, a1 + O, 2], [f.face.a0, a0, a0, 8]]) {
    k.winsAt(face, plane, end, [[4.6, 8.8]], 3.4, { seed: o.seed + s, shutter: acc, cross: true });
    k.winsAt(face, plane2, end, [[14, 18.8]], 3.4, { seed: o.seed + s + 1, shutter: acc, cross: true });
  }
  const bm = (b0 + b1 + O) / 2;
  const w = (b1 + O - b0) / 2;
  k.gable(f.axis, ...R(a0, a1 + O, b0, b1 + O), H, rh, roof, FACH_WALL);
  chimney(k, f, a0 + (a1 - a0) * 0.68, bm - 2, H + 5, H + rh + 3);
  // Fachwerk im Giebel beider Stirnseiten und Dachluke
  for (const [face, plane] of [[f.face.a1, a1 + O], [f.face.a0, a0]]) {
    const top = (b) => slopeH(b, bm, w, H, rh);
    for (const t of [0.25, 0.5, 0.75]) {
      const b = b0 + (b1 + O - b0) * t;
      k.facePanel(face, plane, b - 0.5, b + 0.5, H, top(b) - 0.6, TIMBER, 0.1, NOWIN);
    }
    const hb = H + rh * 0.45;
    const bw = w * 0.55;
    k.facePanel(face, plane, bm + 0.45 - bw, bm + 0.45 + bw, hb - 0.5, hb + 0.5, TIMBER, 0.1, NOWIN);
    k.winsAt(face, plane, [bm + 0.45], [[H + 3, H + 7]], 3, { seed: o.seed + 5, cross: true });
  }
}

const FN = { s: [0, 1, 0], n: [0, -1, 0], e: [1, 0, 0], w: [-1, 0, 0] };
/** Punkt auf einer Wand (entlang, Höhe) mit Abstand off davor. */
function wp(face, plane, a, h, off = 0) {
  const [u, v] = onFaceXY(face, plane)(a, off);
  return [u, v, h];
}

/** Neubau (drei Geschosse): heller Putz, Fensterbänder, Balkone mit Glasbrüstung, Treppenhaus aus Glas, Flachdach mit Technik. */
function neubau(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const wall = NEU_WALL[o.c % NEU_WALL.length];
  const acc = NEU_ACC[o.c % NEU_ACC.length];
  const H = 36;
  const R = f.R;
  k.box(...R(a0, a1, b0, b1), 0, H, wall, wall, { top: false });
  k.wallBand(...R(a0, a1, b0, b1), 0, 11.6, shade(wall, 0.12));
  k.plinth(...R(a0, a1, b0, b1), wall, 1.2);
  for (const h of [12, 24]) k.ledge(...R(a0, a1, b0, b1), h, shade(wall, 0.13), 0.35, 0.7);
  // Treppenhaus: Glasband in der Mitte beider Stirnseiten
  const bm = (b0 + b1) / 2;
  for (const [face, plane] of [[f.face.a1, a1], [f.face.a0, a0]]) {
    k.facePanel(face, plane, bm - 3, bm + 3, 1, H - 1.5, '#5a7f99', 0.1, { win: 1.6, snow: false });
    for (const h of [12, 24]) k.facePanel(face, plane, bm - 3, bm + 3, h - 0.25, h + 0.25, '#e6e8eb', 0.16, NOWIN);
  }
  const side = spots(a0, a1, 12, 7);
  const endL = spots(b0, bm - 4, 9, 4);
  const endR = spots(bm + 4, b1, 9, 4);
  for (const [face, plane, s] of [[f.face.b1, b1, 0], [f.face.b0, b0, 20]]) {
    k.winsAt(face, plane, side, [[3, 9.4]], 6, { seed: o.seed + s, frame: false });
    for (const h of [12, 24]) {
      k.winsAt(face, plane, side, [[h + 1, h + 9.6]], 6.4, { seed: o.seed + h + s, frame: false, lit: 0.25 });
      for (const a of side) k.balcony(face, plane, a - 5, a + 5, h + 0.5, 3.4, '#9fb8c8');
    }
  }
  for (const [face, plane, s] of [[f.face.a1, a1, 2], [f.face.a0, a0, 12]]) {
    k.winsAt(face, plane, [...endL, ...endR], [[3, 9.4], [15, 21.4], [27, 33.4]], 4.6, { seed: o.seed + s, frame: false });
  }
  // Eingang mit Vordach (an der Seite b1)
  const dA = side[0] + (side[1] !== undefined ? (side[1] - side[0]) / 2 : 6);
  k.door(f.face.b1, b1, dA, 4.6, 9, '#3a4650');
  k.box(...R(dA - 5, dA + 5, b1, b1 + 4), 10, 10.8, acc, acc, { mat: null });
  // Flachdach mit Attika und Technik
  const top = tint(wall, 0.1);
  k.box(...R(a0 - 0.5, a1 + 0.5, b0 - 0.5, b1 + 0.5), H, H + 1.4, top, top, { top: false });
  k.parapet(...R(a0 - 0.5, a1 + 0.5, b0 - 0.5, b1 + 0.5), H + 1.4, top);
  const r = H;
  if (o.c === 0) {
    for (let b = b0 + 5; b < b1 - 8; b += 8) {
      const P = (a, bb, h) => [...f.at(a, bb), h];
      const pts = [P(a0 + 6, b, r + 0.5), P(a1 - 14, b, r + 0.5), P(a1 - 14, b + 5, r + 2.6), P(a0 + 6, b + 5, r + 2.6)];
      k.poly(pts, '#2b4a78', { mat: null, n: f.n(0, -2.1, 5) });
      k.poly(pts, '#55595d', { mat: null, snow: false, n: f.n(0, 2.1, -5) });
    }
  } else if (o.c === 1) {
    k.flat(...R(a0 + 3, a1 - 3, b0 + 3, b1 - 3), '#7aa556', r + 0.05);
    for (const t of [0.2, 0.45, 0.7]) k.bush(...f.at(a0 + (a1 - a0) * t, bm), 1.76, Math.round(t * 20) + o.seed, r + 0.05);
  } else {
    for (const t of [0.25, 0.5]) k.acUnit(...f.at(a0 + (a1 - a0) * t, bm - 4), r, 6.2);
  }
  k.box(...R(a1 - 12, a1 - 3, bm - 5, bm + 5), r, r + 6, tint(wall, 0.05), '#a29f97', { mat: null });
}

/** Gehöft: Wohnhaus (Giebel zur Straße), angebaute Scheune mit großem Tor, Silo dahinter, Heuballen. */
function gehoeft(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = f.R;
  const split = a0 + (a1 - a0) * 0.44;
  const wall = PLASTER[(o.c + 2) % PLASTER.length];
  const roof = TILES[o.c % 3];
  const barn = BARN[o.c % BARN.length];
  // Wohnhaus
  const H = 21;
  k.box(...R(a0, split, b0, b1), 0, H, wall, wall, { top: false });
  k.wallBand(...R(a0, split, b0, b1), 0, 3, '#b3a58c');
  k.plinth(...R(a0, split, b0, b1), '#8d8574', 1.4);
  k.ledge(...R(a0, split, b0, b1), 10.8, shade(wall, 0.14), 0.3, 0.5);
  const front = spots(a0, split, 9.5, 6);
  k.winsAt(f.face.b1, b1, front, [[3.6, 8.6], [13.6, 18.6]], 3.6, { seed: o.seed, shutter: SHUTTER[o.c % 4], cross: true, skip: (i, r) => r === 0 && i === 0 });
  k.winsAt(f.face.b0, b0, front, [[3.6, 8.6], [13.6, 18.6]], 3.6, { seed: o.seed + 6, shutter: SHUTTER[o.c % 4], cross: true });
  k.door(f.face.b1, b1, front[0], 4.4, 8.6, '#6a4a32');
  k.box(...R(front[0] - 3.6, front[0] + 3.6, b1, b1 + 1.6), 0, 1, '#bdb6a6', '#bdb6a6', { mat: null });
  const rh = Math.min(17, (split - a0) * 0.5);
  k.gable(f.cross, ...R(a0, split, b0, b1), H, rh, roof, wall);
  chimney(k, f, (a0 + split) / 2 - 1, b0 + (b1 - b0) * 0.4, H + 6, H + rh + 2);
  k.winsAt(f.face.b1, b1, [(a0 + split) / 2], [[H + 3, H + 8]], 3.4, { seed: o.seed + 3, cross: true });
  k.winsAt(f.face.b0, b0, [(a0 + split) / 2], [[H + 3, H + 8]], 3.4, { seed: o.seed + 9, cross: true });
  k.winsAt(f.face.a0, a0, spots(b0, b1, 11, 6), [[3.6, 8.6], [13.6, 18.6]], 3.6, { seed: o.seed + 4, shutter: SHUTTER[o.c % 4], cross: true });
  // Silo hinten an der Scheune
  const deep = b1 - b0 >= 50;
  const sb = deep ? b0 + 8 : b0 + (b1 - b0) / 2;
  const [su, sv] = f.at(a1 - 8, sb);
  k.cyl(su, sv, 7, 0, 42, '#cfd3d2', { mat: 'concrete', top: false });
  for (const h of [10, 20, 30]) k.band(su, sv, 7, h, h + 0.8, '#9ea6a8');
  k.cap(su, sv, 7, 42, '#8f999e', 0.7);
  // Scheune: Holzbretter, Tor mit Andreaskreuz, Luke im Giebel
  const bb0 = deep ? b0 + 16 : b0;
  const HB = 17;
  k.box(...R(split + 0.5, a1, bb0, b1), 0, HB, barn, barn, { top: false, mat: 'wood' });
  k.plinth(...R(split + 0.5, a1, bb0, b1), '#8d8574', 1.6);
  const tA = (split + a1) / 2 + 1;
  k.facePanel(f.face.b1, b1, tA - 8, tA + 8, 0, 13.5, shade(barn, 0.25), 0.1, { mat: 'wood', snow: false });
  k.facePanel(f.face.b1, b1, tA - 0.3, tA + 0.3, 0, 13.5, '#2a1a12', 0.16, NOWIN);
  for (const [x0, x1] of [[tA - 8, tA], [tA, tA + 8]]) {
    for (const [p, q] of [[[x0 + 0.6, 0.6], [x1 - 0.6, 12.9]], [[x1 - 0.6, 0.6], [x0 + 0.6, 12.9]]]) {
      k.poly([wp(f.face.b1, b1, p[0], p[1], 0.18), wp(f.face.b1, b1, q[0], q[1], 0.18), wp(f.face.b1, b1, q[0] + 0.7, q[1], 0.18), wp(f.face.b1, b1, p[0] + 0.7, p[1], 0.18)], '#d9cdb4', { mat: null, snow: false, n: FN[f.face.b1] });
    }
    k.facePanel(f.face.b1, b1, x0 + 0.4, x1 - 0.4, 12.3, 12.9, '#d9cdb4', 0.18, NOWIN);
  }
  const rb = Math.min(15, (b1 - bb0) * 0.45);
  k.gable(f.axis, ...R(split + 0.5, a1, bb0, b1), HB, rb, roof === TILES[0] ? '#6b6560' : '#7a4234', barn);
  const bmB = (bb0 + b1) / 2;
  k.facePanel(f.face.a1, a1, bmB - 3, bmB + 3, HB + 1, HB + 6.5, '#3b2a20', 0.1, NOWIN);
  k.facePanel(f.face.b0, bb0, tA - 3, tA + 3, 3, 8, '#3b2a20', 0.1, NOWIN); // Hintertür der Scheune
  // Heuballen vor der Scheune
  for (const t of [0.12, 0.88]) {
    const a = split + (a1 - split) * t;
    if (Math.abs(a - tA) < 10) continue;
    k.cyl(...f.at(a, b1 - 2.6), 2.4, 0, 3.2, '#d6bf6e', { n: 10, mat: null });
  }
}

const HOUSE_STYLES = { alt: altbau, klinker, fach: fachwerk, neu: neubau, farm: gehoeft };

// ---------- Halle, Fabrik, Mauer ----------

/** Rolltor in der Wand b1 der Halle bei a; dock = erhöht über einer Laderampe. */
function rollDoor(k, f, a, plane, dock) {
  const face = f.face.b1;
  const h0 = dock ? 3.6 : 0;
  const w = dock ? 7 : 8;
  const h1 = dock ? 15 : 16;
  k.facePanel(face, plane, a - w - 1.2, a + w + 1.2, h0, h1 + 1.2, dock ? '#2c2e30' : '#5a6066', 0.06, NOWIN);
  k.facePanel(face, plane, a - w, a + w, h0, h1, '#c2c7ca', 0.12, NOWIN);
  for (let h = h0 + 1.5; h < h1 - 0.3; h += 1.5) k.facePanel(face, plane, a - w, a + w, h - 0.1, h + 0.1, '#9ea3a7', 0.14, NOWIN);
  if (!dock) for (const s of [-1, 1]) k.cyl(...f.at(a + s * (w + 2.4), plane + 1.2), 0.9, 0, 4.4, '#e0b63a', { n: 8, mat: null });
}

/** Lagerhalle: Wellblech mit Farbband, Rolltore und Laderampen an der Längsseite b1, Büro an der Stirnseite a1, Sattel- oder Tonnendach. */
function hall(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const wall = HALL_WALL[o.c % HALL_WALL.length];
  const bandC = HALL_BAND[o.c2 % HALL_BAND.length];
  const R = f.R;
  const H = 24;
  const bd = b1 - 6; // Wand, davor Vorfeld mit Rampen
  const bm = (b0 + bd) / 2;
  const w = (bd - b0) / 2;
  const rh = o.vault ? Math.min(14, w * 0.3) : Math.min(9, w * 0.2);
  k.flat(...R(a0, a1, bd, b1), '#a9a79f', 0.05, { snow: false });
  k.box(...R(a0, a1, b0, bd), 0, H, wall, wall, { top: false, mat: 'metal' });
  k.ribs(...R(a0, a1, b0, bd), 1.6, H - 3.8, 3.4);
  k.plinth(...R(a0, a1, b0, bd), '#7c7f80', 1.6);
  k.wallBand(...R(a0, a1, b0, bd), H - 3.8, H - 0.9, bandC);
  const office = a1 - 32;
  k.winsAt(f.face.b1, bd, spots(office, a1, 7.5, 4.5), [[4.4, 9.2], [13.2, 18]], 4.6, { seed: o.seed });
  const ends = spots(b0, bd, 8, 6);
  const em = Math.floor(ends.length / 2);
  for (const [face, plane, s] of [[f.face.a1, a1, 1], [f.face.a0, a0, 5]]) {
    k.winsAt(face, plane, ends, [[4.4, 9.2]], 4.6, { seed: o.seed + s, skip: (i) => s === 1 && i === em });
    k.winsAt(face, plane, ends, [[13.2, 18]], 4.6, { seed: o.seed + s + 1 });
  }
  k.door(f.face.a1, a1, ends[em], 5, 9.4, '#3a4650');
  k.door(f.face.b0, b0, (a0 + a1) / 2, 5, 9.4, '#3a4650'); // Hintertür (nur 3D)
  const doors = [];
  for (let a = a0 + 17, i = 0; a < office - 9; a += 29, i++) doors.push([a, i % 2 === 1]);
  for (const [a, dock] of doors) rollDoor(k, f, a, bd, dock);
  for (const [a, dock] of doors) {
    if (!dock) continue;
    k.box(...R(a - 9.5, a + 9.5, bd, bd + 4.6), 0, 3.6, '#a29e93', '#b9b5aa', { mat: null });
    for (const s of [-1, 1]) k.box(...R(a + s * 5 - 0.8, a + s * 5 + 0.8, bd + 4.6, bd + 5.4), 1.2, 3.4, '#262729', '#262729', { mat: null });
  }
  // Firmenschild neben dem Büro
  const sa = office - 4;
  k.facePanel(f.face.b1, bd, sa - 9, sa + 1, 17.5, 20.6, '#f2efe6', 0.08, NOWIN);
  k.facePanel(f.face.b1, bd, sa - 8.4, sa - 5, 18.1, 20, bandC, 0.12, NOWIN);
  // Dach
  const sky = (bA, bB) => {
    for (let a = a0 + 8; a + 16 <= office - 6; a += 26) {
      const e = a + 16;
      for (const s of [1, -1]) {
        const mid = (b0 + bd) / 2;
        const z = (b) => slopeH(b, mid, w, H, rh) + 0.3;
        const B0 = mid + s * bA;
        const B1 = mid + s * bB;
        k.poly([[...f.at(a, B0), z(B0)], [...f.at(e, B0), z(B0)], [...f.at(e, B1), z(B1)], [...f.at(a, B1), z(B1)]], SKY, { mat: null, n: f.n(0, s * rh, w) });
      }
    }
  };
  if (o.vault) k.vault(f.axis, ...R(a0, a1, b0, bd), H, rh, METAL_ROOF, wall, 12);
  else {
    k.gable(f.axis, ...R(a0, a1, b0, bd), H, rh, METAL_ROOF, wall);
    sky(w * 0.2, w * 0.55);
  }
  for (const t of [0.2, 0.45, 0.7]) k.cyl(...f.at(a0 + (a1 - a0) * t, bm), 1.9, H + rh - 0.6, H + rh + 2.6, '#8d9398', { n: 8, mat: null });
}

/** Sheddach über a0 … a1 × b0 … b1 auf Höhe H (Zähne steigen nach +a, senkrechte Verglasung nach +a). */
function sawRoof(k, f, a0, a1, b0, b1, H, rt, wall) {
  const n = Math.max(2, Math.round((a1 - a0) / 21));
  const len = (a1 - a0) / n;
  const P = (a, b, h) => [...f.at(a, b), h];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * len;
    const t1 = t0 + len;
    k.poly([P(t0, b0, H), P(t1, b0, H + rt), P(t1, b1, H + rt), P(t0, b1, H)], FACT_ROOF, { mat: 'metal', n: f.n(-rt, 0, len) });
    k.poly([P(t1, b0, H), P(t1, b1, H), P(t1, b1, H + rt), P(t1, b0, H + rt)], SKY, { mat: null, snow: false, n: f.n(1, 0, 0) });
    k.poly([P(t0, b1, H), P(t1, b1, H), P(t1, b1, H + rt)], wall, { mat: null, snow: false, n: f.n(0, 1, 0) });
    k.poly([P(t0, b0, H), P(t1, b0, H + rt), P(t1, b0, H)], wall, { mat: null, snow: false, n: f.n(0, -1, 0) });
  }
}

/** Fabrik: Hof mit Silos und Lkw, Shedhalle mit Industriefenstern und Tor, Bürobau mit Schild, Schornstein hinten. */
function factory(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const wall = FACT_WALL[o.c % FACT_WALL.length];
  const R = f.R;
  const yard = b1 - 34;
  k.flat(...R(a0, a1, yard, b1), YARD, 0.05, { snow: false });
  k.flat(...R(a0 + 46, a1 - 4, yard + 2.7, yard + 3.3), '#e6c83c', 0.08, { snow: false }); // gelbe Linie
  for (let a = a1 - 58; a < a1 - 4; a += 9) k.flat(...R(a - 0.25, a + 0.25, b1 - 11, b1 - 1), '#f0f0eb', 0.08, { snow: false }); // Parkmarkierung
  // Schornstein hinten links
  const [cu, cv] = f.at(a0 + 15, b0 + 15);
  k.frustum(cu, cv, 7.2, 5, 0, 116, '#9a4a38', { n: 14, top: false });
  k.band(cu, cv, 5.3, 100, 104.5, '#ece8e0', 14);
  k.band(cu, cv, 5.1, 108, 112.5, '#c23b30', 14);
  k.cyl(cu, cv, 5.6, 115, 118, '#4f5154', { n: 14 });
  // Shedhalle
  const aE = a1 - 66;
  const bE = yard - 2;
  const H = 22;
  k.box(...R(a0, aE, b0, bE), 0, H, wall, wall, { top: false });
  k.plinth(...R(a0, aE, b0, bE), '#6f6a66', 2);
  k.ledge(...R(a0, aE, b0, bE), 18.6, shade(wall, 0.15), 0.3, 0.6);
  const sideW = spots(a0, aE - 26, 14, 9);
  k.winsAt(f.face.b1, bE, sideW, [[5.4, 16.4]], 9, { seed: o.seed, frame: '#d9d6cc' });
  k.winsAt(f.face.b0, b0, spots(a0, aE, 14, 9), [[5.4, 16.4]], 9, { seed: o.seed + 7, frame: '#d9d6cc' });
  for (const a of sideW) k.facePanel(f.face.b1, bE, a - 4.5, a + 4.5, 10.8, 11.2, '#dcdcd6', 0.2, NOWIN);
  gate3d(k, f.face.b1, bE, aE - 14, 15, 16, '#8e979d');
  k.winsAt(f.face.a1, aE, spots(b0, bE, 13, 9), [[5.4, 16.4]], 8, { seed: o.seed + 1, frame: '#d9d6cc' });
  k.winsAt(f.face.a0, a0, spots(b0, bE, 13, 9), [[5.4, 16.4]], 8, { seed: o.seed + 8, frame: '#d9d6cc' });
  sawRoof(k, f, a0, aE, b0, bE, H, 10, wall);
  // Bürobau mit Schild
  const o0 = aE + 4;
  const ob0 = b0 + 10;
  const ob1 = yard - 3;
  const HO = 33;
  const ow = o.c === 1 ? '#c9c4b8' : '#b5654b';
  k.box(...R(o0, a1, ob0, ob1), 0, HO, ow, ow, { top: false });
  k.plinth(...R(o0, a1, ob0, ob1), '#6f6a66', 1.6);
  for (const h of [11, 22]) k.wallBand(...R(o0, a1, ob0, ob1), h - 0.6, h + 0.6, '#e8e3d8');
  const ow1 = spots(o0, a1, 7, 4.5);
  const ow2 = spots(ob0, ob1, 7, 4.5);
  const mid = Math.floor(ow1.length / 2);
  k.winsAt(f.face.b1, ob1, ow1, [[2.8, 8.6]], 4.4, { seed: o.seed + 2, skip: (i) => i === mid });
  k.winsAt(f.face.b1, ob1, ow1, [[13.6, 19.6], [24.6, 30.6]], 4.4, { seed: o.seed + 3 });
  k.winsAt(f.face.b0, ob0, ow1, [[2.8, 8.6], [13.6, 19.6], [24.6, 30.6]], 4.4, { seed: o.seed + 9 });
  for (const [face, plane, s] of [[f.face.a1, a1, 4], [f.face.a0, o0, 10]]) k.winsAt(face, plane, ow2, [[2.8, 8.6], [13.6, 19.6], [24.6, 30.6]], 4.4, { seed: o.seed + s });
  k.door(f.face.b1, ob1, ow1[mid], 5.4, 9.2, '#33414c');
  k.box(...R(ow1[mid] - 5, ow1[mid] + 5, ob1, ob1 + 4), 9.8, 10.6, '#e6e2d8', '#e6e2d8', { mat: null });
  const rim = tint(ow, 0.12);
  k.box(...R(o0 - 0.5, a1 + 0.5, ob0 - 0.5, ob1 + 0.5), HO, HO + 1.2, rim, rim, { top: false });
  k.parapet(...R(o0 - 0.5, a1 + 0.5, ob0 - 0.5, ob1 + 0.5), HO + 1.2, rim);
  const am = (o0 + a1) / 2;
  k.acUnit(...f.at(am - 12, (ob0 + ob1) / 2 - 4), HO, 6.2); // gemalt in 2,4-facher Größe
  const logo = HALL_BAND[o.c2 % HALL_BAND.length];
  k.box(...R(am - 15, am + 15, ob1 - 2.6, ob1 - 1.4), HO + 1.2, HO + 8.4, '#f2efe6', '#f2efe6', { mat: null });
  k.facePanel(f.face.b1, ob1 - 1.4, am - 13.5, am - 7.5, HO + 2.4, HO + 7.2, logo, 0.08, NOWIN);
  for (const h of [HO + 3.4, HO + 5.6]) k.facePanel(f.face.b1, ob1 - 1.4, am - 5.5, am + 12.5, h - 0.4, h + 0.4, '#3c4046', 0.08, NOWIN);
  // Silos mit Rohr zur Halle, Paletten, Lkw
  for (const a of [a0 + 13, a0 + 31]) {
    const [u, v] = f.at(a, b1 - 15);
    k.cyl(u, v, 8, 0, 34, '#d7dad8', { mat: 'concrete', top: false });
    for (const h of [9, 18, 27]) k.band(u, v, 8, h, h + 0.7, '#a7aeb0');
    k.cap(u, v, 8, 34, '#9aa3a8', 0.45);
  }
  k.pipe([[...f.at(a0 + 13, b1 - 15), 36], [...f.at(a0 + 13, yard - 2), 36], [...f.at(a0 + 13, yard - 2), H]], 1.4, '#8d9499');
  for (const a of [a0 + 52, a0 + 60]) k.crate(...f.at(a, b1 - 7), 3.4, 5.7, '#a07a4f'); // gemalt in 2,6-facher Größe
  const [lu, lv] = f.at(a0 + 104, b1 - 15);
  scaled(k, lu, lv, 3, (s) => lorry3d(s, 0, 0, f.axis, HALL_BAND[(o.c2 + 1) % HALL_BAND.length], 'tarp'));
}

/** Mauer ums Fabrikgelände: Betonfelder zwischen Pfeilern mit Abdeckung. */
function wallPiece(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = f.R;
  const H = 17;
  const t0 = b0 + (b1 - b0) * 0.25;
  const t1 = b1 - (b1 - b0) * 0.25;
  const n = Math.max(1, Math.round((a1 - a0) / 26));
  const step = (a1 - a0) / n;
  for (let i = 0; i <= n; i++) {
    const a = a0 + i * step;
    if (i > 0) {
      const s0 = a - step + 1.8;
      const s1 = a - 1.8;
      k.box(...R(s0, s1, t0, t1), 0, H, CONC, tint(CONC, 0.12), { mat: 'concrete' });
    }
    const c = Math.min(a1 - 1.8, Math.max(a0 + 1.8, a));
    k.box(...R(c - 1.8, c + 1.8, b0 + 1.4, b1 - 1.4), 0, H + 2, tint(CONC, 0.06), tint(CONC, 0.2), { mat: 'concrete' });
  }
}

// ---------- Zug, Bahnhof, Bahnsteig ----------

/** Drehgestell mit zwei Radsätzen bei a (beide Seiten). */
function bogie(k, f, a, b, color = '#2a2c2f') {
  k.box(...f.R(a - 9, a + 9, -b, b), 1.4, 6.4, color, shade(color, 0.1), { mat: null });
  for (const [face, plane] of [[f.face.b1, b + 0.25], [f.face.b0, -b - 0.25]]) for (const d of [-5, 5]) k.disc(face, plane, a + d, 3, 3, '#3b3e42', 0, 12);
}

/** Lok (rot), Containerwagen oder Kesselwagen, Länge entlang a (Welt-x, dreht mit dem Winkel des Gebäudes). */
function trainPart(k, o) {
  const f = frame('u');
  const R = f.R;
  const L = 46; // halbe Länge
  const side = f.face.b1;
  const back = f.face.b0;
  if (o.part === 'loco') {
    bogie(k, f, -27, 10);
    bogie(k, f, 27, 10);
    k.box(...R(-L + 1, L - 1, -12.5, 12.5), 6.4, 9.4, '#3a3d41', '#3a3d41', { mat: null });
    for (const s of [-1, 1]) for (const b of [[-9, -6], [6, 9]]) k.box(...R(s > 0 ? L - 1 : -L - 0.6, s > 0 ? L + 0.6 : -L + 1, b[0], b[1]), 7, 9, '#2a2c2f', '#2a2c2f', { mat: null });
    k.box(...R(-L + 2, L - 2, -11.5, 11.5), 9.4, 28, '#b8443a', '#8d9296', { mat: 'paint' });
    k.wallBand(...R(-L + 2, L - 2, -11.5, 11.5), 13.4, 15, '#e9e6de');
    // Führerstände: Fenster vorn und hinten, an der Seite
    for (const [face, plane] of [[f.face.a1, L - 2], [f.face.a0, -L + 2]]) {
      for (const [c0, c1] of [[-9.5, -1], [1, 9.5]]) k.facePanel(face, plane, c0, c1, 19.5, 25.8, '#2c3a47', 0.1, NOWIN);
      for (const c0 of [-6, 6]) k.disc(face, plane, c0, 12, 1.1, '#f6efc8', 0.2, 8, { win: 1.6 });
    }
    for (const [fc, pl] of [[side, 11.5], [back, -11.5]]) {
      k.winsAt(fc, pl, [-L + 8, L - 8], [[19.5, 25.6]], 5.6, { frame: false, glass: '#2c3a47', lit: 0.001, seed: 3 });
      for (let a = -26; a <= 26; a += 13) {
        k.facePanel(fc, pl, a - 5, a + 5, 17, 25, '#7b2c25', 0.08, NOWIN);
        for (let h = 18; h < 25; h += 2.8) k.facePanel(fc, pl, a - 5, a + 5, h, h + 0.3, '#5a1f1a', 0.12, NOWIN);
      }
      k.facePanel(fc, pl, -3, 3, 10.5, 12.6, '#f2efe6', 0.08, NOWIN);
    }
    k.box(...R(-L + 8, L - 8, -9, 9), 28, 29.6, '#8d9296', '#9ca1a5', { mat: 'metal' });
    for (const a of [-14, 0, 14]) k.fan(...f.at(a, 0), 29.6, 4.3);
    return;
  }
  bogie(k, f, -30, 9.5);
  bogie(k, f, 30, 9.5);
  k.box(...R(-L + 0.5, L - 0.5, -11, 11), 6.4, 9, '#34373b', '#34373b', { mat: null });
  if (o.part === 'tank') {
    const col = ['#3d4146', '#d8d6d0', '#5f6b74'][o.c % 3];
    k.hcyl('u', -L + 4, L - 4, 0, 19.5, 10.5, col, 16, { mat: 'paint' });
    for (const a of [-L + 10, L - 10]) for (const [fc, pl] of [[side, 9], [back, -9]]) k.facePanel(fc, pl, a - 0.6, a + 0.6, 9, 13, '#2a2c2f', 0.1, NOWIN);
    k.box(...R(-6, 6, -10.5, 10.5), 29.4, 30.2, '#5c5f63', '#5c5f63', { mat: null });
    k.cyl(...f.at(0, 0), 3.2, 28.6, 32.6, tint(col, 0.08), { n: 10 });
    return;
  }
  // Containerwagen: zwei Container in fester Farbe je Wagen
  const cs = [CONTAINER[o.c % CONTAINER.length], CONTAINER[(o.c + 3) % CONTAINER.length]];
  [[-L + 1, -0.8], [0.8, L - 1]].forEach(([c0, c1], i) => {
    const col = cs[i];
    k.box(...R(c0, c1, -10.5, 10.5), 9, 30, col, tint(col, 0.1), { mat: 'metal' });
    for (const [fc, pl] of [[side, 10.5], [back, -10.5]]) {
      for (let a = c0 + 1.6; a < c1 - 0.5; a += 3.2) k.facePanel(fc, pl, a - 0.2, a + 0.2, 9.6, 29.4, shade(col, 0.2), 0.08, NOWIN);
      k.facePanel(fc, pl, c0 + 4, c0 + 13, 24, 27, '#f2efe6', 0.1, NOWIN);
    }
  });
}

/** Bahnhof: Empfangshalle mit Uhrgiebel und Rundbogenfenstern, zwei Flügel mit Walmdach, Vordach über dem Eingang. */
function station(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = f.R;
  const wall = '#cdb894';
  const roof = '#7d4b3d';
  const am = (a0 + a1) / 2;
  const hw = Math.min(40, (a1 - a0) * 0.16);
  const wing = (x0, x1) => {
    const H = 26;
    k.box(...R(x0, x1, b0 + 8, b1 - 8), 0, H, wall, wall, { top: false });
    k.plinth(...R(x0, x1, b0 + 8, b1 - 8), '#8d8574', 2);
    k.ledge(...R(x0, x1, b0 + 8, b1 - 8), 13, shade(wall, 0.15), 0.3, 0.6);
    for (const [face, plane] of [[f.face.b1, b1 - 8], [f.face.b0, b0 + 8]]) {
      k.archWins(face, plane, spots(x0, x1, 11, 6), 3, 8.5, 4.2, { seed: o.seed });
      k.archWins(face, plane, spots(x0, x1, 11, 6), 15.5, 20.5, 4.2, { seed: o.seed + 1 });
    }
    if (x1 >= a1 - 0.1) k.archWins(f.face.a1, a1, spots(b0 + 8, b1 - 8, 11, 6), 3, 8.5, 4.2, { seed: o.seed + 2 });
    if (x0 <= a0 + 0.1) k.archWins(f.face.a0, a0, spots(b0 + 8, b1 - 8, 11, 6), 3, 8.5, 4.2, { seed: o.seed + 5 });
    k.hip(...R(x0, x1, b0 + 8, b1 - 8), H, 12, roof);
  };
  wing(a0, am - hw);
  // Empfangshalle (Mitte), höher, Giebel zur Längsseite mit Uhr
  const H = 38;
  k.box(...R(am - hw, am + hw, b0, b1), 0, H, wall, wall, { top: false });
  k.plinth(...R(am - hw, am + hw, b0, b1), '#8d8574', 2);
  for (const [face, plane, s] of [[f.face.b1, b1, 3], [f.face.b0, b0, 6]]) {
    k.archWins(face, plane, spots(am - hw, am + hw, 13, 8), 3, 14, 7, { seed: o.seed + s });
    k.archWins(face, plane, spots(am - hw, am + hw, 13, 8), 21, 29, 6, { seed: o.seed + s + 1 });
    k.disc(face, plane, am, H + 7, 4.6, '#f2efe4', 0.1, 18);
  }
  k.gable(f.cross, ...R(am - hw, am + hw, b0, b1), H, 18, roof, wall);
  k.box(...R(am - hw + 4, am + hw - 4, b1, b1 + 7), 15, 16.2, '#5f6a70', '#7d878d', { mat: null });
  for (const s of [-1, 1]) k.cyl(...f.at(am + s * (hw - 6), b1 + 6), 0.8, 0, 15, '#4a5054', { n: 8, mat: null });
  wing(am + hw, a1);
}

/** Bahnsteig: Platte mit gelben Sicherheitsstreifen, Dach auf Stützen, Bänke, Schild. */
function platform(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = f.R;
  const H = 6;
  k.box(...R(a0, a1, b0, b1), 0, H, '#a7a8a2', '#bdbdb6', { mat: 'concrete' });
  for (const b of [b0 + 1.5, b1 - 2.8]) k.flat(...R(a0 + 0.5, a1 - 0.5, b, b + 1.3), '#d9b73a', H + 0.05, { snow: false });
  const r0 = a0 + (a1 - a0) * 0.15;
  const r1 = a1 - (a1 - a0) * 0.15;
  const bm = (b0 + b1) / 2;
  const posts = spots(r0, r1, 36, 6);
  for (const a of posts) k.cyl(...f.at(a, bm), 0.9, H, H + 24, '#4d5458', { n: 8, mat: null });
  for (const a of posts.slice(0, -1)) {
    const [u, v] = f.at(a + 9, bm + 3);
    k.box(u - (f.L ? 4 : 1), u + (f.L ? 4 : 1), v - (f.L ? 1 : 4), v + (f.L ? 1 : 4), H, H + 2.4, '#8a6a45', '#8a6a45', { mat: 'wood' });
  }
  k.box(...R(r0, r1, bm - 10, bm + 10), H + 24, H + 25.6, '#6f7f7a', '#8fa29b', { mat: 'metal' });
  const [su, sv] = f.at(r0 + 4, bm);
  k.box(su - 0.6, su + 0.6, sv - 0.6, sv + 0.6, H + 18, H + 22, '#2f5f9a', '#2f5f9a', { mat: null });
}

// ---------- Wachturm ----------

/**
 * Wachturm (Stahlgerüst auf vier Beinen, Plattform, Kanzel, Dach mit Gerätehaus, Radar, Antennen, Scheinwerfer, Außentreppe auf der Seite
 * side, Index in TW_SIDE). Grundfläche 80 × 80, Welt fest (wie gemalt: Treppe und Dachaufbauten liegen fest in der Welt).
 */
function tower(k, side) {
  const { R0, R1, DK, DT, D, C, CH, RO, RT } = TW;
  const [nx, ny] = TW_SIDE[side];
  const T = [ny, -nx]; // Richtung, in der die Treppe steigt
  const Wd = (a, b) => [a * T[0] + b * nx, a * T[1] + b * ny]; // Punkt (a entlang der Seite, b nach außen) in der Welt
  const faceName = ['s', 'w', 'n', 'e'][side];
  // Gerüst: Beine, Kreuzstreben in zwei Feldern, Betonfüße
  const rad = (h) => R0 + ((R1 - R0) * h) / DK;
  const L = (su, sv, h) => [su * rad(h), sv * rad(h), h];
  const H0 = 2.6;
  const HM = 28;
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.box(su * R0 - 3.8, su * R0 + 3.8, sv * R0 - 3.8, sv * R0 + 3.8, 0, H0, '#a9a69c', '#b8b5ab', { mat: 'concrete' });
    k.rod(L(su, sv, H0), L(su, sv, DK), 3.1, TW_LEG);
  }
  for (const [a, b] of [[[-1, -1], [1, -1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, 1]], [[1, -1], [1, 1]]]) {
    for (const [h0, h1] of [[H0, HM], [HM, DK]]) {
      k.rod(L(...a, h0), L(...b, h1), 0.85, '#4a5357');
      k.rod(L(...b, h0), L(...a, h1), 0.85, '#4a5357');
    }
    k.rod(L(...a, HM), L(...b, HM), 1.1, '#4a5357');
  }
  // Plattform mit Gitterrost und Geländer (Lücke an der Treppe)
  k.box(-D, D, -D, D, DK, DT, TW_DECK, TW_GRATE, { mat: 'metal' });
  const E = D - 0.6;
  const gapA = [TW.S1 - 0.5, TW.S1 + TW.LD + 0.5];
  for (const [en, ex, ey] of [[0, 0, 1], [1, -1, 0], [2, 0, -1], [3, 1, 0]]) {
    // Rand en (Index wie TW_SIDE: Süd, West, Nord, Ost): Linie bei Ebene ±E, entlang x bzw. y
    const alongX = ex === 0;
    const sign = alongX ? ey : ex;
    const tc = alongX ? T[0] : T[1]; // Komponente der Steigrichtung entlang dieses Rands
    const g0 = gapA[0] * tc;
    const g1 = gapA[1] * tc;
    const gap = en === side ? [Math.min(g0, g1), Math.max(g0, g1)] : null;
    const runs = gap ? [[-E, gap[0]], [gap[1], E]] : [[-E, E]];
    const P = (a, h) => (alongX ? [a, sign * E, h] : [sign * E, a, h]);
    for (const [a0, a1] of runs) {
      if (a1 - a0 < 0.5) continue;
      for (const h of [DT + 3.1, DT + 6.2]) k.rod(P(a0, h), P(a1, h), 0.42, TW_RAIL);
      const n = Math.max(1, Math.round((a1 - a0) / 9));
      for (let i = 0; i <= n; i++) k.rod(P(a0 + ((a1 - a0) * i) / n, DT), P(a0 + ((a1 - a0) * i) / n, DT + 6.2), 0.45, TW_RAIL);
    }
  }
  // Kanzel: Sockelband, Brüstung, Fensterband auf allen vier Seiten, Tür zur Treppe
  k.box(-C, C, -C, C, DT, CH, TW_WALL, TW_WALL, { top: false, mat: null });
  k.wallBand(-C, C, -C, C, DT, DT + 1.4, '#686e63');
  k.wallBand(-C, C, -C, C, DT + 8.2, DT + 9, '#c9cec3');
  const at = [0, 1, 2, 3, 4, 5].map((i) => -C + (C / 3) * (i + 0.5));
  for (const f of ['s', 'e', 'n', 'w']) k.winsAt(f, f === 's' || f === 'e' ? C : -C, at, [[DT + 9, CH - 2.6]], (C / 3) * 0.86, { glass: TW_GLASS, frame: '#5d6559', lit: 0.001, seed: 5 });
  k.wallBand(-C, C, -C, C, CH - 1.2, CH, '#767c70');
  const da = (TW.S1 + TW.LD / 2) * (faceName === 's' || faceName === 'n' ? T[0] : T[1]);
  const dpl = faceName === 's' || faceName === 'e' ? C : -C;
  k.facePanel(faceName, dpl, da - 3, da + 3, DT, DT + 8.1, '#454c45', 0.1, NOWIN);
  k.facePanel(faceName, dpl, da - 1.9, da + 1.9, DT + 4.8, DT + 7.2, TW_GLASS, 0.16, NOWIN);
  // Dach mit grünem Rand und Aufbauten
  k.box(-RO, RO, -RO, RO, CH, RT, TW_RIM, TW_RIM, { top: false, mat: null });
  k.parapet(-RO, RO, -RO, RO, RT, TW_RIM, TW_ROOF, 1.2);
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cu = su * (RO - 1.2);
    const cv = sv * (RO - 1.2);
    k.box(cu - 1.2, cu + 1.2, cv - 1.2, cv + 1.2, RT, RT + 1.5, '#5e7847', '#5e7847', { mat: null });
  }
  const [h0, h1, h2, h3] = TW_HUT;
  k.box(h0, h1, h2, h3, RT - 1.3, RT + 8.5, '#8e958a', TW_ROOF, { mat: 'metal' });
  k.cyl(TW_RADAR[0], TW_RADAR[1], 1.4, RT + 8.5, RT + 11.1, '#5d6458', { n: 8, mat: null });
  k.box(TW_RADAR[0] - 8, TW_RADAR[0] + 8, TW_RADAR[1] - 0.8, TW_RADAR[1] + 0.8, RT + 11.1, RT + 13.3, '#d3d7d0', '#dfe2dc', { mat: null });
  for (const [x, y, top] of TW_ANT) {
    k.box(x - 0.9, x + 0.9, y - 0.9, y + 0.9, RT - 1.3, RT + 0.8, '#4d5458', '#4d5458', { mat: null });
    k.rod([x, y, RT], [x, y, top], 0.7, '#3a4044');
    for (const h of [top - 9, top - 5]) k.rod([x - 2.2, y, h], [x + 2.2, y, h], 0.4, '#3a4044');
    k.ball(x, y, top + 0.6, 1.1, '#d8352b', 1.1, 6, 3);
  }
  const [lu, lv] = TW_LAMP;
  k.cyl(lu, lv, 1.2, RT - 1.3, RT + 2.2, '#4d5458', { n: 8, mat: null });
  k.cyl(lu, lv, 2.4, RT + 2.2, RT + 5.6, '#59616a', { n: 10, mat: null });
  k.disc('e', lu + 2.4, lv, RT + 3.9, 1.3, '#f4ecc8', 0.05, 8, { win: 1.6 });
  // Außentreppe mit Podest (Seite side)
  const { SI, SO, S0, S1, LD } = TW;
  const box2 = (a0, a1, b0, b1, z0, z1, col, topc) => {
    const p = Wd(a0, b0);
    const q = Wd(a1, b1);
    k.box(Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1]), z0, z1, col, topc, { mat: null });
  };
  const hAt = (a) => (DT * (a - S0)) / (S1 - S0);
  const steel = '#5d666b';
  const P3 = (a, b, h) => [...Wd(a, b), h];
  for (const [b, out] of [[SO, 1], [SI, -1]]) {
    k.poly([P3(S0, b, 0), P3(S1, b, DT - 2.3), P3(S1, b, DT + 0.4), P3(S0, b, 0.6)], steel, { mat: null, snow: false, n: [nx * out, ny * out, 0] });
    k.poly([P3(S0, b, 0.6), P3(S1, b, DT + 0.4), P3(S1, b, DT - 2.3), P3(S0, b, 0)], steel, { mat: null, snow: false, n: [-nx * out, -ny * out, 0] });
    for (const h of [4.4, 8.6]) k.rod(P3(S0, b, h), P3(S1, b, DT + h), h > 5 ? 0.45 : 0.35, TW_RAIL);
    for (const t of [0.02, 0.34, 0.67, 0.98]) {
      const a = S0 + (S1 - S0) * t;
      k.rod(P3(a, b, hAt(a)), P3(a, b, hAt(a) + 8.6), 0.45, TW_RAIL);
    }
  }
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const a = S0 + ((S1 - S0) * i) / (N + 1);
    box2(a - 1.55, a + 1.55, SI, SO, hAt(a) - 0.7, hAt(a), '#6b7377', '#8b9296');
  }
  const ae = S1 + LD;
  const am = S1 + LD - 2.5;
  k.rod(P3(am, (SI + SO) / 2, 0), P3(am, (SI + SO) / 2, DT - 1.8), 1.5, TW_LEG);
  box2(S1, ae, SI, SO, DT - 1.8, DT, TW_DECK, TW_GRATE);
  for (const h of [DT + 4.4, DT + 8.6]) {
    k.rod(P3(S1, SO, h), P3(ae, SO, h), 0.42, TW_RAIL);
    k.rod(P3(ae, SO, h), P3(ae, SI, h), 0.42, TW_RAIL);
  }
  for (const [a, b] of [[ae, SO], [ae, SI], [S1 + 4, SO]]) k.rod(P3(a, b, DT), P3(a, b, DT + 8.6), 0.45, TW_RAIL);
}

// ---------- Große Fabrikhalle (Wahrzeichen) ----------

/** Plätze wie landmarks.js spots (gleichmäßig zwischen a0 + mg und a1 − mg). */
function pspots(a0, a1, sp, mg = 5) {
  const n = Math.max(1, Math.floor((a1 - a0 - 2 * mg) / sp));
  const st = (a1 - a0 - 2 * mg) / n;
  return Array.from({ length: n }, (_, i) => a0 + mg + st * (i + 0.5));
}

/** Fabrikhalle der festen Karten: lange Shedhalle (Klinker, Wellblech), Kopfbau mit Wasserbehälter, zwei Schornsteine, Silos mit Rohr. */
function plant(k, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = f.R;
  const P = (a, b, h) => [...f.at(a, b), h];
  const yard = b1 - 44;
  k.flat(...R(a0, a1, yard, b1), '#9d9b93', 0.05, { snow: false });
  for (const [a, hgt] of [[a0 + 40, 205], [a0 + 92, 180]]) {
    const [u, v] = f.at(a, b0 + 22);
    k.frustum(u, v, 10, 6.4, 0, hgt, '#8f4636', { n: 16, top: false });
    for (const h of [hgt - 34, hgt - 18]) k.band(u, v, 6.9, h, h + 6, h === hgt - 34 ? '#ece8e0' : '#c23b30');
    k.cyl(u, v, 7, hgt - 3, hgt + 1, '#3d3f42', { n: 16 });
  }
  const aE = a1 - 96;
  const bE = yard - 2;
  const H = 40;
  k.box(...R(a0, aE, b0, bE), 0, 16, PLANT_BRICK, PLANT_BRICK, { top: false });
  k.box(...R(a0, aE, b0, bE), 16, H, PLANT_CLAD, PLANT_CLAD, { top: false, mat: 'metal' });
  k.plinth(...R(a0, aE, b0, bE), '#5f5a56', 2);
  k.wallBand(...R(a0, aE, b0, bE), 15.4, 16.8, '#e1ddd2');
  k.ledge(...R(a0, aE, b0, bE), H - 1, shade(PLANT_CLAD, 0.18), 0.3, 0.6);
  const sideW = pspots(a0, aE - 20, 13, 8);
  for (const [face, plane, s] of [[f.face.b1, bE, 0], [f.face.b0, b0, 20]]) {
    k.winsAt(face, plane, sideW, [[19, 34]], 9.5, { seed: o.seed + s, frame: '#d9d6cc' });
    k.winsAt(face, plane, sideW.filter((_, i) => i % 3 !== 1), [[4, 12]], 7, { seed: o.seed + 5 + s, frame: '#d9d6cc' });
  }
  for (const a of pspots(a0 + 10, aE - 30, 70, 10)) gate3d(k, f.face.b1, bE, a, 18, 14, '#8e979d');
  k.winsAt(f.face.a1, aE, pspots(b0, bE, 12, 8), [[19, 34]], 8, { seed: o.seed + 1, frame: '#d9d6cc' });
  k.winsAt(f.face.a0, a0, pspots(b0, bE, 12, 8), [[19, 34]], 8, { seed: o.seed + 11, frame: '#d9d6cc' });
  // Sheddach
  const n = Math.max(3, Math.round((aE - a0) / 26));
  const len = (aE - a0) / n;
  const rt = 14;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * len;
    const t1 = t0 + len;
    k.poly([P(t0, b0, H), P(t1, b0, H + rt), P(t1, bE, H + rt), P(t0, bE, H)], PLANT_ROOF, { mat: 'metal', n: f.n(-rt, 0, len) });
    k.poly([P(t1, b0, H), P(t1, bE, H), P(t1, bE, H + rt), P(t1, b0, H + rt)], PLANT_SKY, { mat: null, snow: false, n: f.n(1, 0, 0) });
    k.poly([P(t0, bE, H), P(t1, bE, H), P(t1, bE, H + rt)], PLANT_CLAD, { mat: null, snow: false, n: f.n(0, 1, 0) });
    k.poly([P(t0, b0, H), P(t1, b0, H + rt), P(t1, b0, H)], PLANT_CLAD, { mat: null, snow: false, n: f.n(0, -1, 0) });
  }
  // Kopfbau mit Wasserbehälter und Schriftband
  const o0 = aE + 4;
  const HO = 66;
  k.box(...R(o0, a1, b0 + 10, bE), 0, HO, PLANT_BRICK, PLANT_BRICK, { top: false });
  k.plinth(...R(o0, a1, b0 + 10, bE), '#5f5a56', 2);
  for (const h of [18, 34, 50]) k.wallBand(...R(o0, a1, b0 + 10, bE), h - 0.6, h + 0.6, '#e1ddd2');
  const rows = [[6, 14], [22, 30], [38, 46], [54, 62]];
  k.winsAt(f.face.b1, bE, pspots(o0, a1, 9, 5), rows, 5, { seed: o.seed + 2 });
  k.winsAt(f.face.b0, b0 + 10, pspots(o0, a1, 9, 5), rows, 5, { seed: o.seed + 12 });
  k.winsAt(f.face.a1, a1, pspots(b0 + 10, bE, 9, 5), rows, 5, { seed: o.seed + 3 });
  k.winsAt(f.face.a0, o0, pspots(b0 + 10, bE, 9, 5), rows, 5, { seed: o.seed + 13 });
  k.box(...R(o0 - 0.5, a1 + 0.5, b0 + 9.5, bE + 0.5), HO, HO + 1.6, '#8a4132', '#8a4132', { mat: null });
  const am = (o0 + a1) / 2;
  k.facePanel(f.face.b1, bE, am - 26, am + 26, HO - 10, HO - 3, '#f2efe6', 0.08, NOWIN);
  for (const h of [HO - 8, HO - 5.5]) k.facePanel(f.face.b1, bE, am - 22, am + 22, h - 0.4, h + 0.4, '#3c4046', 0.12, NOWIN);
  const [tu, tv] = f.at(am, (b0 + bE) / 2);
  for (const [du, dv] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) k.rod([tu + du, tv + dv, HO + 1.6], [tu + du * 0.8, tv + dv * 0.8, HO + 22], 0.9, PLANT_STEEL);
  k.cyl(tu, tv, 13, HO + 22, HO + 40, '#7c858b', { n: 16, mat: 'metal', top: false });
  k.cap(tu, tv, 13, HO + 40, '#5d656b', 0.4);
  // Silos mit Förderband zur Halle, Rampe
  const siloB = b1 - 20;
  for (const a of [a0 + 24, a0 + 52, a0 + 80]) {
    const [u, v] = f.at(a, siloB);
    k.cyl(u, v, 12, 0, 58, '#d7dad8', { n: 16, mat: 'concrete', top: false });
    for (const h of [14, 28, 42]) k.band(u, v, 12, h, h + 0.8, '#a7aeb0');
    k.cap(u, v, 12, 58, '#9aa3a8', 0.4);
  }
  k.pipe([[...f.at(a0 + 52, siloB), 62], [...f.at(a0 + 120, bE + 4), H + 8], [...f.at(a0 + 120, bE - 6), H + 8]], 3, '#7f878c');
  k.box(...R(a0 + 140, a0 + 240, bE, bE + 8), 0, 5, '#a29e93', '#b9b5aa', { mat: null });
}

// ---------- Strommast ----------

/**
 * Gittermast (Donaumast) mit zwei Traversen, Isolatorketten und Erdseilspitze; Traversen entlang Welt-x, die Instanz dreht ihn um z
 * (Richtung der Leitung, Town3D yaw). Maße PY wie landmarks.js.
 */
function pylon(k) {
  const rad = (h) => (h <= PY.waist ? PY.foot + ((PY.mid - PY.foot) * h) / PY.waist : PY.mid + ((PY.tip - PY.mid) * (h - PY.waist)) / (PY.top - 6 - PY.waist));
  const L = (su, sv, h) => [su * rad(h), sv * rad(h), h];
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(su * PY.foot - 3, su * PY.foot + 3, sv * PY.foot - 3, sv * PY.foot + 3, 0, 2.4, '#a9a69c', '#a9a69c', { mat: 'concrete' });
  const levels = [0, 18, 36, 54, 72, 90, PY.waist, 122, PY.top - 6];
  for (const [c1, c2] of [[[-1, -1], [1, -1]], [[-1, -1], [-1, 1]], [[1, -1], [1, 1]], [[-1, 1], [1, 1]]]) {
    for (let i = 0; i < levels.length - 1; i++) {
      const h0 = levels[i];
      const h1 = levels[i + 1];
      k.rod(L(...c1, h0), L(...c2, h1), 0.8, PLANT_STEEL);
      k.rod(L(...c2, h0), L(...c1, h1), 0.8, PLANT_STEEL);
      k.rod(L(...c1, h1), L(...c2, h1), 0.9, PLANT_STEEL);
    }
  }
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let i = 0; i < levels.length - 1; i++) k.rod(L(su, sv, levels[i]), L(su, sv, levels[i + 1]), 1.6, '#3d454b');
  // Traversen (Ober- und Untergurt, Streben) mit Isolatorketten
  for (const [h, w] of PY.arms) {
    const r = rad(h);
    const E = (s, hh) => [s, 0, hh];
    k.rod(E(-w, h), E(w, h), 1.7, '#3d454b');
    for (const [a, b] of [[E(-w, h), E(-r, h - 8)], [E(-r, h - 8), E(r, h - 8)], [E(r, h - 8), E(w, h)]]) k.rod(a, b, 1, PLANT_STEEL);
    for (const s of [-w * 0.66, -w * 0.33, w * 0.33, w * 0.66]) k.rod(E(s, h), E(s * 0.9, h - 8 * (1 - Math.abs(s) / w)), 0.8, PLANT_STEEL);
    for (const s of [-w, w]) k.rod(E(s, h), E(s, h - PY.drop), 1.3, '#cfd3cc');
  }
  for (const [su, sv] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) k.rod(L(su, sv, PY.top - 6), [0, 0, PY.top], 0.9, '#555e65');
}

// ---------- Zuordnung: Gebäude der Karte → Geometrie ----------

/** Arten der Kartenstadt, die es in 3D gibt (alle gemalten Arten aus drawMapIso). */
export const MAP_KINDS = new Set(['house', 'hall', 'factory', 'wall', 'train', 'station', 'platform', 'plant', 'tower', 'pylon']);

/** Gehört das Objekt (Gebäude der Karte) zur Kartenstadt? (Stadtgebäude tragen ck, Werke und Großbauten haben andere Arten.) */
export const hasMapTown3d = (b) => MAP_KINDS.has(b.kind) && !b.ck;

const seedOf = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Rahmen eines Grundrisses W × D mit Rand m innen: längere Seite = a. */
function plan(W, D, m, base) {
  const A = Math.max(W, D);
  const B = Math.min(W, D);
  return { ...base, long: W >= D ? 'u' : 'v', a0: -A / 2 + m, a1: A / 2 - m, b0: -B / 2 + m, b1: B / 2 - m };
}

/**
 * Bauplan eines Gebäudes der Karte: { key (gleiche Geometrie, gleicher Schlüssel), build(k), scale }. Das Aussehen (Farben, Stil)
 * kommt aus maptown.js mapInfo(b) wie gemalt; die Fensterbeleuchtung hängt am Schlüssel (alle Häuser einer Variante gleich, wie gemalt).
 */
const plans = new WeakMap(); // Gebäude → Bauplan (Schlüssel je Bild nicht neu bilden)
function planOf(b) {
  let pl = plans.get(b);
  if (!pl) plans.set(b, (pl = computePlan(b)));
  return pl;
}

const HOUSE_BASE = [88, 72]; // Grundmaß der Haus-Geometrie (A × B); die Instanz streckt sie auf das Maß des Hauses (Scale), eine Geometrie je Stil und Farbe
const TURN = -Math.PI / 2; // Längsachse in Welt-y statt Welt-x: Instanz um −90° (Wand b1 zeigt dann nach +x wie gemalt)

function computePlan(b) {
  const info = mapInfo(b);
  const kind = b.kind;
  const A = Math.max(b.w, b.h);
  const B = Math.min(b.w, b.h);
  const yaw = b.w >= b.h ? 0 : TURN;
  if (kind === 'house') {
    const [HA, HB] = HOUSE_BASE;
    const qa = Math.max(q8(b.w), q8(b.h));
    const qb = Math.min(q8(b.w), q8(b.h));
    const key = `house|${info.style}|${info.c}`;
    const o = plan(HA, HB, 0, { ...info, long: 'u', seed: info.style === 'alt' ? (info.c % 8) << 3 : seedOf(key) });
    return { key, yaw, sx: qa / HA, sy: qb / HB, build: (kit) => HOUSE_STYLES[info.style](kit, o) };
  }
  if (kind === 'hall' || kind === 'factory') {
    const key = `${kind}|${info.c % 3}|${info.c2 % 4}|${kind === 'hall' && info.vault ? 1 : 0}|${A}|${B}`;
    const o = plan(A, B, 2, { ...info, c: info.c % 3, c2: info.c2 % 4, seed: seedOf(key) });
    return { key, yaw, build: (kit) => (kind === 'hall' ? hall(kit, o) : factory(kit, o)) };
  }
  if (kind === 'wall') {
    const key = `wall|${A}|${B}`;
    return { key, yaw, build: (kit) => wallPiece(kit, plan(A, B, 0, info)) };
  }
  if (kind === 'train') return { key: `train|${b.part}|${info.c}`, yaw: b.angle || 0, build: (kit) => trainPart(kit, { ...info, part: b.part }) };
  if (kind === 'station') {
    const key = `station|${A}|${B}`;
    return { key, yaw, build: (kit) => station(kit, plan(A, B, 2, { ...info, seed: seedOf(key) })) };
  }
  if (kind === 'platform') {
    const key = `platform|${A}|${B}`;
    return { key, yaw: (b.angle || 0) + yaw, build: (kit) => platform(kit, plan(A, B, 0, info)) };
  }
  if (kind === 'plant') {
    const key = `plant|${A}|${B}`;
    return { key, yaw, build: (kit) => plant(kit, plan(A, B, 2, { ...info, seed: seedOf(key) })) };
  }
  if (kind === 'tower') {
    const sc = Math.round(((b.w || 80) / 80) * 20) / 20 || 1;
    const side = towerSide(b);
    return { key: `tower|${sc}|${side}`, scale: sc, build: (kit) => tower(kit, side) };
  }
  return { key: 'pylon', yaw: 0, build: (kit) => pylon(kit) };
}

const cache = new Map(); // Schlüssel → BufferGeometry

/** Schlüssel der Geometrie eines Gebäudes der Karte (gleiche Geometrie = gleicher Draw-Call). */
export const mapTownKey = (b) => planOf(b).key;

/** Drehung der Instanz um z (Bogenmaß): Längsachse in y, Zug und Bahnsteig mit ihrem Winkel, Mast quer zur Leitung (ang = Richtung der Traversen). */
export function mapTownYaw(b, ang = 0) {
  return b.kind === 'pylon' ? ang : planOf(b).yaw ?? 0;
}

/** Streckung der Instanz [sx, sy] (entlang der Längs- und der Querachse vor der Drehung), nur Häuser; sonst null. */
export function mapTownScale(b) {
  const p = planOf(b);
  return p.sx ? [p.sx, p.sy] : null;
}

/** Geometrie (Ankerpunkt = Mitte am Boden) des Gebäudes b der Karte, je Schlüssel einmal gebaut; null, wenn es keine gibt. */
export function mapTownGeometry(b) {
  if (!hasMapTown3d(b)) return null;
  const pl = planOf(b);
  let g = cache.get(pl.key);
  if (!g) {
    const kit = new Kit3D();
    pl.build(kit);
    g = kit.geometry();
    if (pl.scale && pl.scale !== 1) {
      g.scale(pl.scale, pl.scale, pl.scale);
      g.computeBoundingBox();
      g.computeBoundingSphere();
    }
    cache.set(pl.key, g);
  }
  return g;
}

// ---------- Hochspannungsleitung ----------

const WIRE_STEPS = 12; // Strecken je Leiterseil und Feld
const WIRE_MAX = 6000; // Strecken im Puffer (reicht für alle Felder im Bild mehrfach)

/**
 * Hochspannungsleitung als Linien (statt des gemalten Durchlaufs „Leitungen“): je Feld zwischen zwei Masten fünf Leiterseile
 * (PYLON_WIRES) mit Durchhang PY.sag (Parabel; Höhe von Mast zu Mast mit der Geländehöhe am Mast), im Weltraum der Szene.
 * Liniendicke 1 Geräte-Pixel (WebGL); Tiefentest gegen alle Gebäude und Bäume.
 */
export class Wires3D {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'leitungen';
    this.pos = new Float32Array(WIRE_MAX * 6);
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    g.setDrawRange(0, 0);
    this.mat = new THREE.LineBasicMaterial({ color: 0x1c1e21, transparent: true, opacity: 0.85 });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.group.add(this.mesh);
    this.count = 0; // Felder im Bild
  }

  /** Bildanfang: net = mapPylons(map) (Mast → { ang, next }), groundAt(x, y) = Bodenhöhe, inView(x, y) = Mast im Bild. Felder im Bild. */
  update(net, groundAt, inView) {
    let n = 0;
    let fields = 0;
    const pos = this.pos;
    const put = (p) => {
      pos[n++] = p[0];
      pos[n++] = p[1];
      pos[n++] = p[2];
    };
    for (const [a, info] of net) {
      const b = info.next;
      if (!b || (!inView(a.x, a.y) && !inView(b.x, b.y))) continue;
      const ib = net.get(b);
      if (n + PYLON_WIRES.length * WIRE_STEPS * 6 > pos.length) break;
      const za = groundAt(a.x, a.y);
      const zb = groundAt(b.x, b.y);
      fields++;
      for (const [s, h] of PYLON_WIRES) {
        const p0 = [a.x + Math.cos(info.ang) * s, a.y + Math.sin(info.ang) * s, za + h];
        const p1 = [b.x + Math.cos(ib.ang) * s, b.y + Math.sin(ib.ang) * s, zb + h];
        let prev = p0;
        for (let i = 1; i <= WIRE_STEPS; i++) {
          const t = i / WIRE_STEPS;
          const q = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t - 4 * PY.sag * t * (1 - t)];
          put(prev);
          put(q);
          prev = q;
        }
      }
    }
    this.count = fields;
    this.attr.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, n / 3);
    this.mesh.visible = n > 0;
    return fields;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
