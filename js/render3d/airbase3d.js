// Fliegerhorst in 3D aus dem Baukasten (kit3d.js), Paket „Fliegerhorst 3D“: Stellplatz (Stufe 1 offen, Stufe 2 Überdachung, Stufe 3
// Flugzeugschutzbau), Tower (Radar ab Stufe 2, Wetterradar-Kuppel in Stufe 3), Kerosintank und Munitionslager aus render/airbase.js
// (airbaseBodies, Maße und Farben in AB_DIM), mit denselben Teilen, Maßen und Farben wie gemalt, dazu die Rückseiten, die gemalt nie zu
// sehen sind. Örtliche Koordinaten ab der Mitte der Anlage (2 × 2 Zellen): u = Welt-x, v = Welt-y, h = Höhe; jedes Teil wird an seinem
// Ankerpunkt (x, y aus airbaseBodies) in die eine Geometrie der Anlage geschrieben. Überdachung und Shelter liegen in der Welt fest
// (Tor des Shelters nach Norden), die übrigen Teile gemalt je Bild in Ansichtsachsen, in 3D steht alles in Weltachsen und dreht mit der Kamera.
// Halb durchsichtig (airbaseGlass, eigener Satz in town3d.js): das Wellblechdach der Überdachung und die Röhre des Shelters samt
// Tarnflecken, damit der abgestellte Jet zu sehen bleibt; alles andere undurchsichtig. Gemalte Schatten entfallen (Schattenkarte).
// Teamfarbe: Bänder, Torschilder, Tankbänder und Fahnen tragen aInfo.y = 97 und nehmen die Farbe der Instanz (instanceColor), eine
// Geometrie je Art und Stufe für alle Teams. Starr bleiben die drehende Radarantenne und das blinkende Warnlicht des Towers.
import { Kit3D, GLOW_NIGHT } from './kit3d.js';
import { AB_DIM, airbaseBodies } from '../render/airbase.js';
import { tank3d, bund3d, pallet3d, forklift3d, lorry3d, walls3d, strip3d } from './works3d.js';
import { WORKS_PAL } from '../render/works.js';
import { CAR_COLORS, DECK, clampLv, shade, tint } from '../render/isokit.js';
import { hexOf, mix, rgbOf } from '../render/color.js';

const { CAN, HS, CAMO, CAMO_COL, SEE2, SEE3, CONCW, SHELL, HEAD, EARTH, GRASS, GRASS2, OLIVE, YEL, WHITE, RED, TANKC, ROOF, COL, PANEL } = AB_DIM;
const { PIPE } = WORKS_PAL;
const TEAM0 = '#3a6fb3'; // Platzhalter der Teamfarbe in der Geometrie (die Instanz tönt sie um)
const TAU = Math.PI * 2;
const PI = Math.PI;

export const airbaseKey = (kind, level) => `${kind}|${clampLv(level)}`;
/** Deckkraft der halb durchsichtigen Teile: Dach der Überdachung (Stufe 2) bzw. Röhre des Shelters (Stufe 3), wie gemalt. */
export const airbaseAlpha = (kind, level) => (clampLv(level) >= 3 ? SEE3 : SEE2);

// ---------- Gemeinsames ----------

/** Quader ohne Wandfoto (kleine Teile aus Metall, Beton, Fahrzeuge): wie k.box mit mat: null, wenn o.mat nichts anderes sagt. */
const B = (k, u0, u1, v0, v1, h0, h1, wall, top = wall, o = {}) => k.box(u0, u1, v0, v1, h0, h1, wall, top, { mat: null, ...o });
/** Fläche in Teamfarbe der Instanz. */
const team = (k, fn) => {
  const was = k.team;
  k.team = true;
  fn();
  k.team = was;
};
/** Tafel auf einer Wand, ohne Foto und Schnee. */
const F = (k, face, plane, a0, a1, h0, h1, col, off = 0.06, o = {}) => k.facePanel(face, plane, a0, a1, h0, h1, col, off, { mat: null, snow: false, ...o });

/** Punkt der Halbellipse (Breite W, Scheitel H) beim Winkel t: 0 = Westen (x = −W), π/2 = Scheitel, π = Osten. */
const arc = (W, H, t) => [-W * Math.cos(t), H * Math.sin(t)];

/** Röhre längs y (Mitte x0) von y0 bis y1 als n Streifen zwischen den Winkeln t0 und t1, außen. */
function tubeY(k, x0, y0, y1, W, H, t0, t1, n, col, o = {}) {
  for (let i = 0; i < n; i++) {
    const ta = t0 + ((t1 - t0) * i) / n;
    const tb = t0 + ((t1 - t0) * (i + 1)) / n;
    const tm = (ta + tb) / 2;
    const [xa, ha] = arc(W, H, ta);
    const [xb, hb] = arc(W, H, tb);
    k.poly([[x0 + xa, y0, ha], [x0 + xa, y1, ha], [x0 + xb, y1, hb], [x0 + xb, y0, hb]], col, { mat: null, ...o, n: [-H * Math.cos(tm), 0, W * Math.sin(tm)] });
  }
}

/** Bogenfläche (Halbellipse W × H) bei y, Normale nach ny (±1). */
function archFace(k, x0, y, W, H, ny, col, o = {}) {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const [x, h] = arc(W, H, (i / 18) * PI);
    pts.push([x0 + x, y, h]);
  }
  k.poly(pts, col, { mat: null, ...o, n: [0, ny, 0] });
}

/** Zaunstück von (a0, b0) nach (a1, b1): zwei Latten, Pfosten etwa alle 5 (wie airbase.fenceSeg). */
function fenceSeg(k, a0, b0, a1, b1, h = 4) {
  const col = '#6a7178'; // gemalt dünne Linien mit Deckkraft 0,8: als Stäbe heller und dünner, sonst wirkt der Zaun zu schwer
  for (const hh of [h, h * 0.55]) k.rod([a0, b0, hh], [a1, b1, hh], 0.3, col);
  const n = Math.max(1, Math.round(Math.hypot(a1 - a0, b1 - b0) / 5));
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    k.rod([a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 0], [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, h + 0.4], 0.45, col);
  }
}

// ---------- Stellplatz ----------

/** Flutlichtmast am Vorfeld: Mast, Leuchtenkopf, Lampenflächen nach Süden und Norden (nachts hell). */
function flood(k) {
  k.rod([0, 0, 0], [0, 0, 37], 1.4, '#6b7177');
  B(k, -3.2, 3.2, -1.2, 1.2, 36, 38.6, '#d4d6d2', '#9aa0a5');
  for (const [f, pl] of [['s', 1.2], ['n', -1.2]]) for (const a of [-2.2, 0, 2.2]) F(k, f, pl, a - 0.8, a + 0.8, 36.6, 38, '#fff3c4', 0.06, { win: GLOW_NIGHT });
}

/** Bodenstromgerät: gelber Anhänger mit Lüftungsgitter, Kabeltrommel, Deichsel und Kabel. */
function gpu(k) {
  for (const u of [-3.6, 3.6]) for (const [a, b] of [[2.6, 3.2], [-3.2, -2.6]]) B(k, u - 1.1, u + 1.1, a, b, 0, 2.2, '#2f3134'); // Räder
  B(k, -6, 6, -3, 3, 1.4, 6, '#d9a21b', '#e8b53a');
  for (const [f, pl] of [['e', 6], ['w', -6]]) F(k, f, pl, -2, 2, 2.4, 5, '#4a4f53'); // Lüftungsgitter
  for (const [f, pl] of [['s', 3], ['n', -3]]) F(k, f, pl, -5, -1, 4.4, 5.2, '#2b2d2f');
  k.cyl(2.5, 0, 1.9, 6, 7.2, '#3e4246', { n: 10, mat: null }); // Kabeltrommel
  k.rod([-6, 0, 2], [-8.6, 0, 1], 0.8, '#3a3d40'); // Deichsel
  k.rod([2.5, 1.9, 6.6], [4.5, 4.6, 0.2], 0.6, '#1f2124');
  k.rod([4.5, 4.6, 0.2], [9, 3.4, 0.2], 0.6, '#1f2124');
}

/** Feuerlöscher auf Rädern (rot). */
function extinguisher(k) {
  for (const [a, b] of [[1.3, 1.8], [-1.8, -1.3]]) B(k, -1.6, 1.6, a, b, 0, 1.6, '#2f3134');
  k.cyl(0, 0, 1.5, 0.8, 5.6, RED, { n: 8, mat: null });
  k.cyl(0, 0, 0.6, 5.6, 6.6, '#3a3d40', { n: 6, mat: null });
  k.rod([-1.2, 0, 6], [-2.4, 1.2, 4], 0.5, '#1f2124');
}

/** Leitkegel (orange mit weißem Band). */
function cone(k) {
  B(k, -1.7, 1.7, -1.7, 1.7, 0, 0.4, '#d0601e');
  k.frustum(0, 0, 1.4, 0.25, 0.4, 4.2, '#ea7a2e', { n: 8, top: false, mat: null });
  k.frustum(0, 0, 1.0, 0.8, 1.9, 2.6, WHITE, { n: 8, top: false, mat: null, snow: false });
}

/**
 * Überdachung (Stufe 2): Fundamente, Stahlstützen mit Kopfbändern, Traufpfetten, Windschutz aus Wellblech an den langen Seiten, drei
 * Fachwerkbinder; das Satteldach aus Wellblech geht in die halb durchsichtige Geometrie (kg), Rinnen, Ortgang und First bleiben deckend.
 */
function canopy(k, kg) {
  const { CX, CY, CE, CR, RN, RS, RW, SH } = CAN;
  for (const sx of [-1, 1]) {
    const x = sx * CX;
    const xo = x + sx * 1.8;
    const xi = x + sx * 3;
    for (const y of CY) {
      B(k, x - 3, x + 3, y - 3, y + 3, 0, 1, '#b8b4aa'); // Fundament
      B(k, x - 1.8, x + 1.8, y - 1.8, y + 1.8, 1, CE - 0.4, COL, tint(COL, 0.12)); // Stütze
      for (const s of [-1, 1]) {
        if (y + s * 8 > RN + 3 && y + s * 8 < RS - 3) k.rod([x, y + s * 1.8, CE - 7.5], [x, y + s * 8, CE - 1.4], 0.9, shade(COL, 0.1)); // Kopfband
      }
    }
    B(k, Math.min(xo, xi), Math.max(xo, xi), CY[0], CY[2], 1, SH, PANEL, tint(PANEL, 0.12)); // Windschutz
    B(k, x - 1.6, x + 1.6, RN + 3, RS - 3, CE - 2.4, CE, shade(COL, 0.05), tint(COL, 0.18)); // Traufpfette
  }
  // Fachwerkbinder unter dem Dach: Untergurt, Obergurt, Streben im Zickzack
  const top = (x) => CE + (CR - 1.4 - CE) * (1 - Math.abs(x) / CX);
  const c = shade(COL, 0.1);
  for (const y of CY) {
    k.rod([-CX, y, CE - 2.2], [CX, y, CE - 2.2], 0.9, c);
    k.rod([-CX, y, CE], [0, y, CR - 1.4], 1, c);
    k.rod([0, y, CR - 1.4], [CX, y, CE], 1, c);
    let last = null;
    for (let i = 0; i <= 12; i++) {
      const x = -CX + (i * 2 * CX) / 12;
      const p = [x, y, i % 2 ? top(x) : CE - 2.2];
      if (last) k.rod(last, p, 0.55, shade(COL, 0.05));
      last = p;
    }
  }
  // Satteldach (halb durchsichtig) und seine deckenden Kanten
  for (const sx of [-1, 1]) {
    kg.poly([[sx * RW, RN, CE], [sx * RW, RS, CE], [0, RS, CR], [0, RN, CR]], ROOF, { mat: 'metal', n: [sx * (CR - CE), 0, RW] });
    k.rod([sx * RW, RN, CE], [sx * RW, RS, CE], 1.1, '#2c3236'); // Rinne
  }
  for (const y of [RN, RS]) {
    k.rod([-RW, y, CE], [0, y, CR], 0.9, '#2c3236'); // Ortgang
    k.rod([0, y, CR], [RW, y, CE], 0.9, '#2c3236');
  }
  k.rod([0, RN, CR + 0.3], [0, RS, CR + 0.3], 1.5, tint(ROOF, 0.3)); // First
}

// ---------- Shelter (Stufe 3) ----------

const { W: HW, H: HH, N: HN, S: HSO, D: HD, B: HB, WO, HO, DW, E: HE, C: HC, F: HF } = HS;
const R_OPEN = 5; // Rundung der oberen Ecken der Toröffnung

/** Toröffnung als Punktliste [x, h] (Rechteck mit gerundeten oberen Ecken, wie airbase.openingPts). */
function openingPts() {
  const r = R_OPEN;
  const pts = [[-WO, 0]];
  for (let i = 0; i <= 4; i++) {
    const a = PI - (i / 4) * (PI / 2);
    pts.push([-WO + r + r * Math.cos(a), HO - r + r * Math.sin(a)]);
  }
  for (let i = 0; i <= 4; i++) {
    const a = PI / 2 - (i / 4) * (PI / 2);
    pts.push([WO - r + r * Math.cos(a), HO - r + r * Math.sin(a)]);
  }
  pts.push([WO, 0]);
  return pts;
}

/** Oberkante der Toröffnung bei x (|x| ≤ WO). */
const openTop = (x) => {
  const d = Math.abs(x) - (WO - R_OPEN);
  return d <= 0 ? HO : HO - R_OPEN + Math.sqrt(Math.max(0, R_OPEN * R_OPEN - d * d));
};

/** Fläche der Stirnwand (Bogen Wb × Hb) mit Toröffnung bei y, Normale nach ny: senkrechte Streifen, in der Öffnung erst über dem Tor. */
function headFace(k, y, ny, col) {
  const Wb = HW + HB;
  const Hb = HH + HB;
  const xs = [];
  for (let i = 0; i <= 18; i++) xs.push(-Wb * Math.cos((i / 18) * PI));
  for (const [x] of openingPts()) xs.push(x);
  xs.sort((a, b) => a - b);
  const u = xs.filter((x, i) => !i || x - xs[i - 1] > 1e-6);
  const top = (x) => Hb * Math.sqrt(Math.max(0, 1 - (x / Wb) ** 2));
  for (let i = 0; i + 1 < u.length; i++) {
    const [xa, xb] = u[i] > u[i + 1] ? [u[i + 1], u[i]] : [u[i], u[i + 1]];
    const inside = Math.abs((xa + xb) / 2) < WO;
    const pts = [[xa, y, inside ? openTop(xa) : 0], [xb, y, inside ? openTop(xb) : 0], [xb, y, top(xb)], [xa, y, top(xa)]];
    const d = pts.filter((p, j) => j === 0 || Math.hypot(p[0] - pts[j - 1][0], p[2] - pts[j - 1][2]) > 1e-6);
    if (d.length >= 3) k.poly(d, col, { mat: null, n: [0, ny, 0] });
  }
}

/** Erdanschüttung an der Seite sx (−1 Westen, +1 Osten) von y = N bis S + D: Krone (Gras), Böschung, Stirnflächen aus Erde an beiden Enden. */
function earthFill(k, sx) {
  const xi = sx * HW * Math.sqrt(1 - (HE / HH) ** 2); // hier trifft die Krone die Röhre
  const y0 = HN;
  const y1 = HSO + HD;
  k.poly([[xi, y0, HE], [sx * HC, y0, HE], [sx * HC, y1, HE], [xi, y1, HE]], GRASS, { mat: null, n: [0, 0, 1] }); // Krone
  k.poly([[sx * HC, y0, HE], [sx * HF, y0, 0], [sx * HF, y1, 0], [sx * HC, y1, HE]], GRASS2, { mat: null, n: [sx * HE, 0, HF - HC] }); // Böschung
  for (const [y, ny, Wa, Ha] of [[y0, -1, HW, HH], [y1, 1, HW + 1, HH + 1]]) {
    const arcX = (z) => sx * Wa * Math.sqrt(Math.max(0, 1 - (z / Ha) ** 2));
    const lineX = (z) => sx * (HF - ((HF - HC) * z) / HE);
    for (let j = 0; j < 6; j++) {
      const z0 = (HE * j) / 6;
      const z1 = (HE * (j + 1)) / 6;
      k.poly([[arcX(z0), y, z0], [lineX(z0), y, z0], [lineX(z1), y, z1], [arcX(z1), y, z1]], EARTH, { mat: null, snow: false, n: [0, ny, 0] });
    }
  }
}

/** Stirnwand (Norden, y = N − D … N): Kante, beide Flächen mit Toröffnung, Laibung, Lampe über dem Tor (nachts hell). */
function headwall(k) {
  const Wb = HW + HB;
  const Hb = HH + HB;
  tubeY(k, 0, HN - HD, HN, Wb, Hb, 0, PI, 18, HEAD);
  headFace(k, HN - HD, -1, HEAD);
  headFace(k, HN, 1, shade(HEAD, 0.12));
  const open = openingPts();
  for (let i = 0; i + 1 < open.length; i++) {
    const [a, b] = [open[i], open[i + 1]];
    k.poly([[a[0], HN - HD, a[1]], [a[0], HN, a[1]], [b[0], HN, b[1]], [b[0], HN - HD, b[1]]], shade(HEAD, 0.22), { mat: null, snow: false, n: [-(a[0] + b[0]) / 2, 0, HO / 2 - (a[1] + b[1]) / 2] }); // Laibung, zeigt in die Öffnung
  }
  for (const x of [-WO - 5, WO + 5]) k.rod([x, HN - HD - 0.05, 0], [x, HN - HD - 0.05, Hb * Math.sqrt(Math.max(0, 1 - (x / Wb) ** 2))], 0.4, shade(HEAD, 0.1)); // Fugen
  B(k, -2, 2, HN - HD - 1.2, HN - HD, HO + 2.4, HO + 3.6, '#f6e7b0', '#6d7276', { win: GLOW_NIGHT }); // Lampe
}

/** Beiseitegeschobene Torflügel mit Führungsrahmen; vorn Rippen, Band in Teamfarbe und Warnschild. */
function doors(k) {
  const y0 = HN - HD - 4;
  const y1 = HN - HD;
  for (const sx of [-1, 1]) {
    const xf = sx * (WO - 2 + DW + 1.5);
    B(k, Math.min(xf, xf + sx * 3.5), Math.max(xf, xf + sx * 3.5), y0 - 1.5, y1 + 2, 0, HO + 3, '#8e8b82', '#a29f95'); // Rahmen
    const lo = Math.min(sx * (WO - 2), sx * (WO - 2 + DW));
    const hi = Math.max(sx * (WO - 2), sx * (WO - 2 + DW));
    B(k, lo, hi, y0, y1, 0.4, HO + 1, '#78806c', '#8a917e'); // Torflügel
    team(k, () => F(k, 'n', y0, lo, hi, 13.2, 15.4, TEAM0));
    for (let x = lo + 2.9; x < hi - 0.5; x += 2.9) F(k, 'n', y0, x - 0.2, x + 0.2, 0.8, HO + 0.6, '#6a7060', 0.05); // Rippen
    F(k, 'n', y0, lo + 3, lo + 8, 4, 7, YEL, 0.08); // Warnschild
  }
}

/** Rückwand (Süden, y = S … S + D): Kante über der Anschüttung, Fläche mit Abgasöffnung, Haube, Nebentür, Lampe und Warnschraffur. */
function rearWall(k) {
  const Wr = HW + 1;
  const Hr = HH + 1;
  const y = HSO + HD;
  tubeY(k, 0, HSO, y, Wr, Hr, Math.asin(HE / Hr), PI - Math.asin(HE / Hr), 14, HEAD);
  archFace(k, 0, y, Wr, Hr, 1, HEAD);
  archFace(k, 0, HSO, Wr, Hr, -1, shade(HEAD, 0.12));
  F(k, 's', y, -11, 11, 7, 17, '#3b3e40', 0.06); // Abgasöffnung
  for (let h = 8.4; h < 17; h += 1.5) F(k, 's', y, -10.6, 10.6, h, h + 0.4, '#969a9c', 0.1); // Jalousie
  for (const x of [-13, 12]) B(k, x, x + 1, y, y + 4, 6.5, 17, '#8f9396'); // Wangen
  B(k, -13, 13, y, y + 4, 17, 18.6, '#8f9396', '#a3a7aa'); // Haube
  F(k, 's', y, 25, 31, 0, 9, '#55606a', 0.06); // Nebentür
  B(k, 27, 29, y, y + 0.8, 10.2, 11.2, '#f6e7b0', '#6d7276', { win: GLOW_NIGHT }); // Lampe
  F(k, 's', y, -27, 27, 0, 1.6, '#a69a45', 0.08); // Warnschraffur (gelb, abgedunkelt wie gemalt)
}

/** Tarnflecken: Fächer aus Dreiecken knapp über der Röhre, Normalen der Röhre, Flanke sx (Winkel gespiegelt). */
function camo(kg, [yc, tc, ry, rt, ci], mirror) {
  const te = Math.asin(HE / HH);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tm = mirror ? PI - tc : tc;
  const [r, g, b, a] = CAMO_COL[ci].match(/[\d.]+/g).map(Number);
  const c = rgbOf(mix(SHELL, hexOf([r, g, b]), a)).map((x) => x / 255);
  const info = kg.info({ mat: null, snow: false });
  const at = (y, t) => {
    const [x, h] = arc(HW * 1.006, HH * 1.006, t);
    const nl = Math.hypot(HH * Math.cos(t), HW * Math.sin(t));
    return { p: [x, y, h], n: [(-HH * Math.cos(t)) / nl, 0, (HW * Math.sin(t)) / nl] };
  };
  const ring = [];
  for (let i = 0; i < 14; i++) {
    const f = (i / 14) * TAU;
    const wob = 1 + 0.22 * Math.sin(3 * f + yc);
    ring.push(at(clamp(yc + ry * Math.cos(f) * wob, HN + 0.5, HSO - 0.5), clamp(tm + rt * Math.sin(f) * wob, te + 0.03, PI - te - 0.02)));
  }
  const mid = at(yc, clamp(tm, te + 0.03, PI - te - 0.02));
  for (let i = 0; i < ring.length; i++) {
    let [p1, p2] = [ring[i], ring[(i + 1) % ring.length]];
    const e1 = [p1.p[0] - mid.p[0], p1.p[1] - mid.p[1], p1.p[2] - mid.p[2]];
    const e2 = [p2.p[0] - mid.p[0], p2.p[1] - mid.p[1], p2.p[2] - mid.p[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * mid.n[0] + cr[1] * mid.n[1] + cr[2] * mid.n[2] < 0) [p1, p2] = [p2, p1];
    for (const q of [mid, p1, p2]) kg.vert(q.p, q.n, c, [q.p[0], q.p[1]], info);
  }
}

/**
 * Flugzeugschutzbau (Stufe 3): Betonröhre längs y mit Tarnanstrich (halb durchsichtig, kg), Stirnwand mit Tor im Norden, Rückwand mit
 * Abgasöffnung, Erdanschüttung an beiden Seiten, Torflügel; Lüfter und Blitzableiter auf dem Scheitel.
 */
function has(k, kg) {
  const te = Math.asin(HE / HH);
  tubeY(kg, 0, HN, HSO, HW, HH, te, PI - te, 14, SHELL);
  for (const c of CAMO) {
    camo(kg, c, false);
    camo(kg, c, true);
  }
  earthFill(k, -1);
  earthFill(k, 1);
  headwall(k);
  doors(k);
  rearWall(k);
  for (const y of [-22, 16]) {
    k.cyl(0, y, 1.6, HH - 0.4, HH + 2.6, '#8d9296', { n: 8, mat: null }); // Lüfter
    k.cyl(0, y, 2.2, HH + 2.6, HH + 3.2, '#6d7276', { n: 8, mat: null });
  }
  k.rod([0, HSO - 8, HH], [0, HSO - 8, HH + 7], 0.6, '#5a5f63'); // Blitzableiter
}

// ---------- Tower, Radar, Windsack, Parkplatz ----------

/** Tower: zweigeschossiger Betriebsbau, runder Schaft, Glaskanzel mit Umgang, Dach mit Antennen und Radarschüssel, Fahne. */
function tower(k) {
  walls3d(k, -24, 24, -24, 24, 14, CONCW, { band: TEAM0, team: true });
  for (const [f, pl] of [['s', 24], ['n', -24]]) {
    strip3d(k, f, pl, -20, -6, 3.2, 6.4, 3);
    strip3d(k, f, pl, -20, 20, 8.6, 11.4, 3);
  }
  for (const [f, pl] of [['e', 24], ['w', -24]]) {
    strip3d(k, f, pl, -20, 20, 3.2, 6.4, 3);
    strip3d(k, f, pl, -20, 20, 8.6, 11.4, 3);
  }
  k.door('s', 24, 6, 6, 6.4, '#4f5a63');
  B(k, 1, 11, 24, 29, 6.6, 7.4, '#6d7174', '#7d8184'); // Vordach
  k.parapet(-24, 24, -24, 24, 14, CONCW, DECK);
  k.acUnit(-14, -14, 14, 2.4);
  k.acUnit(14, -12, 14, 2.4);
  k.dish(-15, 12, 14, 3.2);
  k.cyl(4, 2, 7.5, 14, 64, '#e4e1d8', { n: 16, top: false, mat: null });
  k.cylWins(4, 2, 7.5, 18, 60, [0.16, PI / 2 + 0.16, PI + 0.16, 1.5 * PI + 0.16], 2.4, '#34506d'); // Fensterschlitze des Treppenhauses
  k.band(4, 2, 7.5, 40, 41.2, '#c9c5ba');
  k.cyl(4, 2, 13.5, 64, 68, '#d6d2c8', { n: 16, mat: null }); // Boden der Kanzel
  k.frustum(4, 2, 12, 14.6, 68, 78, '#4d7591', { n: 16, top: false, mat: null, snow: false, win: GLOW_NIGHT }); // Glaskanzel, nachts hell
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU;
    k.rod([4 + 12.1 * Math.cos(t), 2 + 12.1 * Math.sin(t), 68], [4 + 14.7 * Math.cos(t), 2 + 14.7 * Math.sin(t), 78], 0.6, '#1e262c'); // Sprossen
  }
  k.cyl(4, 2, 15.6, 78, 80.6, '#4a4f53', { n: 16, mat: null }); // Dach
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU;
    k.rod([4 + 13.4 * Math.cos(t), 2 + 13.4 * Math.sin(t), 68], [4 + 13.4 * Math.cos(t), 2 + 13.4 * Math.sin(t), 70], 0.5, '#3c4044'); // Umgang: Geländerpfosten
  }
  k.frustum(4, 2, 13.5, 13.5, 69.4, 70, '#3c4044', { n: 16, top: false, mat: null, snow: false }); // Handlauf
  k.rod([-2, 0, 80.6], [-2, 0, 94], 0.8, '#6b7177');
  k.rod([9, 5, 80.6], [9, 5, 89], 0.7, '#6b7177');
  k.dish(6, -4, 80.6, 2.6);
  k.ball(-2, 0, 94.8, 1.1, '#ff4a3a', 1.1, 6, 3); // Warnlicht (starr, gemalt blinkt es)
  k.flagpole(20, 30, 0, 22, TEAM0, true);
}

/** Windsack auf einem Mast (rot-weiß gestreift, nach Osten). */
function sock(k) {
  k.rod([0, 0, 0], [0, 0, 15], 0.9, '#d9d6cc');
  for (let i = 0; i < 4; i++) {
    const a0 = 1 + i * 2.6;
    const r0 = 1.5 - i * 0.22;
    const drop = 0.5 * i;
    k.tube([a0, 0.7, 14.6 - drop - 0.2], [a0 + 2.6, 0.8, 14.6 - drop - 0.7], r0, r0 - 0.22, i % 2 ? '#f2efe6' : '#e2572f', 8);
  }
}

/** Parkplatz am Tower: Autos je Stufe (in Stufe 3 ein Dienstwagen in Oliv), zwei Laternen. */
function lot(k, lv) {
  const n = lv >= 3 ? 4 : lv >= 2 ? 3 : 2;
  const spots = [-18, -6, 6, 18];
  k.lamp(-24, -8, 10);
  for (let i = 0; i < n; i++) k.car(spots[i], 0, 'v', i === 3 ? OLIVE : CAR_COLORS[(i * 3 + 1) % CAR_COLORS.length]);
  k.lamp(24, -8, 10);
}

/** Radar: umzäunter Platz, Gerätecontainer, Gitterturm mit Plattform, Antenne (starr, gemalt dreht sie sich). */
function radar(k) {
  k.flat(-16, 16, -16, 16, '#a39d90', 0.05, { bare: true, mat: null });
  k.fence(-16, 16, -16, 16);
  walls3d(k, 4, 14, 2, 14, 7, '#d3d0c6');
  k.parapet(4, 14, 2, 14, 7, '#d3d0c6', DECK);
  k.door('s', 14, 9, 2.6, 5, '#55606a');
  k.mast(-5, -5, 0, 34, 5, 3, '#c9cdd0', false);
  B(k, -9, -1, -9, -1, 34, 35.4, '#9aa1a8', '#b9bfc4');
  k.cyl(-5, -5, 1.2, 35.4, 38, '#6b7177', { n: 8, mat: null });
  // Reflektor als gebogene Fläche (Winkel 0,9), vorn hell, hinten grau
  const t = 0.9;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const P = (q, h) => {
    const bow = (1 - q * q) * 1.6;
    return [-5 + c * q * 9 - s * bow, -5 + s * q * 9 + c * bow, h];
  };
  for (let i = 0; i < 8; i++) {
    const q0 = (i / 8) * 2 - 1;
    const q1 = ((i + 1) / 8) * 2 - 1;
    const quad = [P(q0, 43), P(q1, 43), P(q1, 39), P(q0, 39)];
    k.poly(quad, '#eef0f1', { mat: null, snow: false, n: [-s, c, 0] });
    k.poly(quad, '#b8bec3', { mat: null, snow: false, n: [s, -c, 0] });
  }
  k.rod([-5, -5, 38], [-5 - s * 3.4, -5 + c * 3.4, 41], 0.7, '#55595d');
}

/** Wetterradar: Betonsockel mit Tür und Band in Teamfarbe, weiße Kuppel aus Feldern. */
function radome(k) {
  walls3d(k, -9, 9, -9, 9, 12, '#d3d0c6', { band: TEAM0, team: true });
  k.door('s', 9, 3, 3, 6, '#55606a');
  k.parapet(-9, 9, -9, 9, 12, '#d3d0c6', DECK);
  // gemalt ein Kreis vom Radius r im Bild; in Iso erscheint ein Körper der Höhe rz mit sqrt((r/2)² + rz²) hoch, rund also bei rz = r·√3/2
  const rz = 12 * Math.sqrt(3) / 2;
  k.dome(0, 0, 21.84, 12, rz, '#e6e9ec', -0.5, 16, 7);
  k.domeRibs(0, 0, 21.84, 12, rz, 8, '#a4abb1', 6, 0.7);
}

// ---------- Kerosintank ----------

/** Tanklager: Auffangwanne mit 2, 3 oder 4 Tanks (Band in Teamfarbe), Rohre zum Sammelrohr, Pumpenhaus, Ladebühne mit Dach und Tankwagen. */
function kfarm(k, lv) {
  const Bd = [-56, 56, -60, 18];
  const T = lv >= 3
    ? [[-27, -40, 15, 30], [27, -40, 15, 30], [-27, -4, 15, 30], [27, -4, 15, 30]]
    : lv >= 2
      ? [[-36, -24, 15, 28], [0, -24, 15, 28], [36, -24, 15, 28]]
      : [[-25, -24, 18, 26], [25, -24, 18, 26]];
  bund3d(k, Bd[0], Bd[1], Bd[2], Bd[3], 3);
  for (const [u, v, r, H] of T) tank3d(k, u, v, r, H, { band: TEAM0, color: TANKC });
  const front = T.filter(([, v]) => v === Math.max(...T.map((t) => t[1])));
  for (const [u, v, r] of front) k.pipe([[u, v + r * 0.8, 2], [u, 23, 3.8]], 1.3, PIPE);
  k.pipe([[Math.min(...front.map((t) => t[0])), 23, 3.8], [30, 23, 3.8], [30, 31, 3.8]], 1.5, PIPE);
  // Pumpenhaus
  walls3d(k, 28, 52, 30, 46, 10, '#cfc9bb');
  k.parapet(28, 52, 30, 46, 10, '#cfc9bb', DECK);
  k.door('s', 46, 35, 3.2, 6, '#55606a');
  k.wins('e', 52, 33, 43, 2, [[5, 7.6]], 2.4);
  k.wins('w', 28, 33, 43, 2, [[5, 7.6]], 2.4, { seed: 4 });
  // Ladebühne mit Dach, darunter die Tankwagen
  for (const v of [30, 37]) for (const u of [-44, -8]) k.rod([u, v, 0], [u, v, 13], 1, '#6b7177');
  B(k, -44, -8, 30, 35, 0, 4.6, '#a7a69d', '#b8b7ae');
  for (let u = -42; u <= -10; u += 8) k.rod([u, 35, 4.6], [u, 35, 7.4], 0.5, '#d9a21b'); // Geländer
  k.rod([-44, 35, 7.4], [-8, 35, 7.4], 0.6, '#d9a21b');
  for (const v of lv >= 3 ? [54, 42] : [42]) {
    lorry3d(k, -26, v, 'u', OLIVE, 'tank', { tank: '#8c9466' });
    team(k, () => B(k, -26 - 6.4, -26 + 2.6, v - 2.15, v + 2.15, 3.2, 4, TEAM0)); // Band in Teamfarbe (der Lkw malt es nur mit o.band, hier getrennt)
  }
  for (const u of [-34, -18]) {
    k.rod([u, 34, 6.5], [u + 2, 40, 9.5], 0.8, '#3f4447'); // Ladearme
    k.rod([u + 2, 40, 9.5], [u + 3, 42, 5.6], 0.8, '#3f4447');
  }
  B(k, -46, -6, 28, 39, 12.6, 13.8, '#9aa1a8', '#b9bfc4');
  for (const u of [-46, 46]) k.facePoly('s', Bd[3], [[u, 0.6], [u + 1.8, 2.1], [u, 3.6], [u - 1.8, 2.1]], YEL, 0.06); // Warnschilder an der Mauer
  k.lamp(56, 22, 11);
  k.lamp(-54, 22, 11);
}

// ---------- Munitionslager ----------

/** Blitzschutzmast (Gittermast mit Spitze). */
function rod(k, u, v, h) {
  k.rod([u, v, 0], [u, v, h], 0.9, '#7d848a');
  k.rod([u, v, h], [u, v, h + 3], 0.5, '#5a5f63');
}

/** Erdbedeckter Munitionsbunker: Grashügel über einer Tonne, Stirnwand aus Beton mit Flügelmauern, zweiflügliges Stahltor mit Schild in Teamfarbe. */
function igloo(k, u0) {
  const W = 17;
  const H = 15;
  tubeY(k, u0, -56, 0, W, H, 0, PI, 18, GRASS);
  archFace(k, u0, -56, W, H, -1, shade(GRASS, 0.2)); // Rückseite des Hügels
  k.cyl(u0, -32, 1.4, H - 0.3, H + 3.2, '#8d9296', { n: 8, mat: null }); // Lüfter
  k.cyl(u0, -32, 2, H + 3.2, H + 3.8, '#6d7276', { n: 8, mat: null });
  B(k, u0 - 20, u0 - 17, 0, 9, 0, 8, '#b5b1a5', '#c4c0b4'); // Flügelmauern
  B(k, u0 - 19, u0 + 19, -1.5, 1.5, 0, 16.5, '#bdb9ad', '#cbc7bb'); // Stirnwand
  B(k, u0 + 17, u0 + 20, 0, 9, 0, 8, '#b5b1a5', '#c4c0b4');
  F(k, 's', 1.5, u0 - 7, u0 + 7, 0, 10, '#56604c', 0.06); // Stahltor
  F(k, 's', 1.5, u0 - 0.3, u0 + 0.3, 0, 10, '#141810', 0.1);
  for (let i = 1; i < 6; i++) F(k, 's', 1.5, u0 - 6.6, u0 + 6.6, i * 1.6, i * 1.6 + 0.2, '#6d7762', 0.1);
  for (let i = 0; i < 6; i++) {
    const c = u0 - 7 + i * (14 / 6);
    F(k, 's', 1.5, c, c + 14 / 6 / 2, 10, 11, i % 2 ? '#2a2a28' : YEL, 0.1); // Warnstreifen
  }
  team(k, () => F(k, 's', 1.5, u0 - 4, u0 + 4, 12.2, 14.6, TEAM0, 0.08)); // Schild in Teamfarbe
}

/** Wachturm in der hinteren Ecke (Stahlbeine, Kanzel mit Fenstern und Dach). */
function watchtower(k, u, v) {
  for (const [a, b] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) k.rod([u + a, v + b, 0], [u + a * 0.8, v + b * 0.8, 20], 0.9, '#5a5f52');
  B(k, u - 4.6, u + 4.6, v - 4.6, v + 4.6, 20, 26, '#7b8058', '#6b704c');
  const rows = [[22.4, 24.8]];
  k.wins('s', v + 4.6, u - 3.6, u + 3.6, 2, rows, 2.6, { frame: false });
  k.wins('n', v - 4.6, u - 3.6, u + 3.6, 2, rows, 2.6, { frame: false, seed: 4 });
  k.wins('e', u + 4.6, v - 3.6, v + 3.6, 2, rows, 2.6, { frame: false });
  k.wins('w', u - 4.6, v - 3.6, v + 3.6, 2, rows, 2.6, { frame: false, seed: 8 });
  B(k, u - 5.6, u + 5.6, v - 5.6, v + 5.6, 26, 27.2, '#56603a', '#646e44');
}

/** Munitionslager: Zaun, 1 bis 3 Bunker mit Blitzschutzmasten, Vorplatz mit Gabelstapler und Paletten, Wache mit Schranke; Stufe 3 Wachturm. */
function depot(k, lv) {
  const FZ = 60;
  fenceSeg(k, -FZ, FZ, -FZ, -FZ);
  fenceSeg(k, -FZ, -FZ, FZ, -FZ);
  if (lv >= 3) watchtower(k, -50, -50);
  const xs = lv >= 3 ? [-40, 0, 40] : lv >= 2 ? [-24, 24] : [0];
  for (const u of xs) {
    rod(k, u - 20, -54, 24);
    rod(k, u + 20, -54, 24);
    igloo(k, u);
    rod(k, u - 22, 5, 22);
    rod(k, u + 22, 5, 22);
  }
  for (const [u, v] of [[-50, 21], [-42, 21], [-34, 21], [-50, 13]]) pallet3d(k, u, v, 2.6, 3.4, OLIVE);
  if (lv >= 2) for (const [u, v] of [[36, 16], [44, 16]]) pallet3d(k, u, v, 2.6, 3.4, '#6b5a3a');
  forklift3d(k, -20, 20, OLIVE);
  // Wache mit Schranke am Tor
  walls3d(k, 16, 26, 38, 48, 8, '#d5cfbf');
  k.parapet(16, 26, 38, 48, 8, '#d5cfbf', DECK);
  k.wins('s', 48, 17.5, 24.5, 2, [[3.6, 6.2]], 2.6);
  k.wins('e', 26, 39.5, 46.5, 2, [[3.6, 6.2]], 2.6);
  k.wins('w', 16, 39.5, 46.5, 2, [[3.6, 6.2]], 2.6, { seed: 5 });
  k.wins('n', 38, 17.5, 24.5, 2, [[3.6, 6.2]], 2.6, { seed: 9 });
  B(k, 12.4, 14.2, 50, 52, 0, 4.4, '#d23a3a', '#e8e4d4');
  k.rod([13.3, 51, 4], [-11, 51, 4], 1.1, '#e8e4d4'); // Schranke
  for (let u = 10; u > -11; u -= 5) k.rod([u, 51.05, 4], [u - 2.5, 51.05, 4], 1.15, '#d23a3a');
  fenceSeg(k, -FZ, FZ, -12, FZ);
  fenceSeg(k, 12, FZ, FZ, FZ);
  fenceSeg(k, FZ, FZ, FZ, -FZ);
}

// ---------- Geometrie ----------

/** Baufunktionen je Teil (id aus airbaseBodies): (k, kg, lv). */
const PARTS = {
  flood: (k) => flood(k),
  gpu: (k) => gpu(k),
  ext: (k) => extinguisher(k),
  cone: (k) => cone(k),
  canopy: (k, kg) => canopy(k, kg),
  has: (k, kg) => has(k, kg),
  tower: (k) => tower(k),
  sock: (k) => sock(k),
  lot: (k, kg, lv) => lot(k, lv),
  radar: (k) => radar(k),
  radome: (k) => radome(k),
  kfarm: (k, kg, lv) => kfarm(k, lv),
  depot: (k, kg, lv) => depot(k, lv),
};

/** Alle Dreiecke von src in dst, um (dx, dy) verschoben. */
function merge(dst, src, dx, dy) {
  for (let i = 0; i < src.p.length; i += 3) dst.p.push(src.p[i] + dx, src.p[i + 1] + dy, src.p[i + 2]);
  for (const a of ['n', 'c', 't', 'i']) for (const v of src[a]) dst[a].push(v);
}

const cache = new Map(); // Art|Stufe → { main, glass }

function built(kind, level) {
  const lv = clampLv(level);
  const key = airbaseKey(kind, lv);
  let e = cache.get(key);
  if (!e) {
    const k = new Kit3D();
    const kg = new Kit3D();
    for (const p of airbaseBodies(kind, lv)) {
      const pk = new Kit3D();
      const pg = new Kit3D();
      PARTS[p.id](pk, pg, lv);
      merge(k, pk, p.x, p.y);
      merge(kg, pg, p.x, p.y);
    }
    e = { main: k.tris ? k.geometry() : null, glass: kg.tris ? kg.geometry() : null };
    cache.set(key, e);
  }
  return e;
}

/** Undurchsichtige Geometrie einer Art ('stand', 'atc', 'ktank', 'mdepot') und Stufe 1 bis 3, je Variante einmal gebaut; Mitte der Anlage = Ursprung. */
export const airbaseGeometry = (kind, level) => built(kind, level).main;

/** Halb durchsichtige Teile (Dach der Überdachung, Röhre des Shelters mit Tarnflecken) oder null. */
export const airbaseGlass = (kind, level) => built(kind, level).glass;
