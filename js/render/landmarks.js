// Wahrzeichen fester Karten (Paket „Feste Karten“): große Fabrikhalle (`plant`) und Strommast (`pylon`) samt Hochspannungsleitung,
// gemalt wie die übrigen Kartengebäude (maptown.js ruft die Maler; Bilder über spritecache.js). Nur Zeichnen, liest die Karte.
//   Fabrikhalle: lange Shedhalle aus Klinker mit Wellblech-Oberteil und Fensterbändern, Kopfbau mit Wasserbehälter, zwei hohe
//   Schornsteine mit rot-weißen Ringen, Silos mit Förderband, Laderampen. Strommast: Gittermast (Donaumast) mit zwei Traversen,
//   Isolatoren und Erdseilspitze; die Leiterseile hängen durch und verbinden die Masten einer Linie (`line`) in Kartenreihenfolge.
// Örtliche Koordinaten wie maptown.js: a = Längsachse, b = Querachse, Höhen in Bildschirm-px bei Zoom 1.
import {
  box, cap, cyl, band, frustum, FACE, flat, lit, OUTLINE, plinth, poly, ledge, shadow, snowy, stroke, wallBand, winsAt, circle, rectF,
  rectS, shadowTop, flatTop, onFace, lineT,
} from './isokit.js';
import { gate, pipe, pipeTop } from './works.js';

const BRICK = '#9c4e3a';
const CLAD = '#b7bcbd';
const ROOF = '#6b7176';
const SKY = '#a9c8d8';
const STEEL = '#4f585f';

/** Rahmen entlang der langen Seite (wie maptown.js frameOf): a = Längsachse, b = Querachse. */
function frame(long) {
  const L = long === 'u';
  return {
    R: (a0, a1, b0, b1) => (L ? [a0, a1, b0, b1] : [b0, b1, a0, a1]),
    at: (a, b) => (L ? [a, b] : [b, a]),
    side: L ? 's' : 'e',
    end: L ? 'e' : 's',
    n: (na, nb, nh) => (L ? [na, nb, nh] : [nb, na, nh]),
  };
}
const spots = (a0, a1, sp, mg = 5) => {
  const n = Math.max(1, Math.floor((a1 - a0 - 2 * mg) / sp));
  const st = (a1 - a0 - 2 * mg) / n;
  return Array.from({ length: n }, (_, i) => a0 + mg + st * (i + 0.5));
};

// ---------- Große Fabrikhalle ----------

export const PLANT_TALL = 210;

/** Iso: große Fabrikhalle im Rahmen o = { long, a0, a1, b0, b1, seed }. */
export function paintPlant(g, o) {
  const f = frame(o.long);
  const { a0, a1, b0, b1 } = o;
  const R = (x0, x1, y0, y1) => f.R(x0, x1, y0, y1);
  const P = (a, b, h) => g.P(...f.at(a, b), h);
  const yard = b1 - 44; // Vorfeld an der sichtbaren Längsseite
  flat(g, ...R(a0, a1, yard, b1), '#9d9b93');
  // Schornsteine hinten (zuerst: sie stehen hinter der Halle)
  for (const [a, hgt] of [[a0 + 40, 205], [a0 + 92, 180]]) {
    const [u, v] = f.at(a, b0 + 22);
    shadow(g, u - 9, u + 9, v - 9, v + 9, 80, 0.12);
    frustum(g, u, v, 10, 6.4, 0, hgt, '#8f4636', false);
    for (const h of [hgt - 34, hgt - 18]) band(g, u, v, 6.9, h, h + 6, h === hgt - 34 ? '#ece8e0' : '#c23b30');
    cyl(g, u, v, 7, hgt - 3, hgt + 1, '#3d3f42');
  }
  // Haupthalle mit Sheddach
  const aE = a1 - 96; // Kopfbau ab hier
  const bE = yard - 2;
  const H = 40;
  shadow(g, ...R(a0, aE, b0, bE), H + 16);
  box(g, ...R(a0, aE, b0, bE), 0, 16, BRICK);
  box(g, ...R(a0, aE, b0, bE), 16, H, CLAD);
  plinth(g, ...R(a0, aE, b0, bE), '#5f5a56', 2);
  wallBand(g, ...R(a0, aE, b0, bE), 15.4, 16.8, '#e1ddd2');
  ledge(g, ...R(a0, aE, b0, bE), H - 1, 'rgba(0,0,0,0.18)');
  const sideW = spots(a0, aE - 20, 13, 8);
  winsAt(g, f.side, bE, sideW, [[19, 34]], 9.5, { seed: o.seed, frame: '#d9d6cc' });
  winsAt(g, f.side, bE, sideW.filter((_, i) => i % 3 !== 1), [[4, 12]], 7, { seed: o.seed + 5, frame: '#d9d6cc' });
  for (const a of spots(a0 + 10, aE - 30, 70, 10)) gate(g, f.side, bE, a, 18, 14, '#8e979d');
  winsAt(g, f.end, aE, spots(b0, bE, 12, 8), [[19, 34]], 8, { seed: o.seed + 1, frame: '#d9d6cc' });
  // Sheddach: Dachfläche steigt zur Glasseite
  const n = Math.max(3, Math.round((aE - a0) / 26));
  const len = (aE - a0) / n;
  const rt = 14;
  for (let k = 0; k < n; k++) {
    const t0 = a0 + k * len;
    const t1 = t0 + len;
    poly(g, [P(t0, b0, H), P(t1, b0, H + rt), P(t1, bE, H + rt), P(t0, bE, H)], lit(snowy(ROOF), ...f.n(-rt, 0, len)), OUTLINE);
    poly(g, [P(t0, bE, H), P(t1, bE, H), P(t1, bE, H + rt)], lit(CLAD, ...FACE[f.side]), OUTLINE);
    poly(g, [P(t1, b0, H), P(t1, bE, H), P(t1, bE, H + rt), P(t1, b0, H + rt)], lit(SKY, ...FACE[f.end]), OUTLINE);
  }
  // Kopfbau mit Wasserbehälter und Schriftband
  const o0 = aE + 4;
  const HO = 66;
  shadow(g, ...R(o0, a1, b0 + 10, bE), HO);
  box(g, ...R(o0, a1, b0 + 10, bE), 0, HO, BRICK);
  plinth(g, ...R(o0, a1, b0 + 10, bE), '#5f5a56', 2);
  for (const h of [18, 34, 50]) wallBand(g, ...R(o0, a1, b0 + 10, bE), h - 0.6, h + 0.6, '#e1ddd2');
  const ow = spots(o0, a1, 9, 5);
  winsAt(g, f.side, bE, ow, [[6, 14], [22, 30], [38, 46], [54, 62]], 5, { seed: o.seed + 2 });
  winsAt(g, f.end, a1, spots(b0 + 10, bE, 9, 5), [[6, 14], [22, 30], [38, 46], [54, 62]], 5, { seed: o.seed + 3 });
  box(g, ...R(o0 - 0.5, a1 + 0.5, b0 + 9.5, bE + 0.5), HO, HO + 1.6, '#8a4132');
  const pt = onFace(g, f.side, bE);
  const am = (o0 + a1) / 2;
  poly(g, [pt(am - 26, HO - 10), pt(am + 26, HO - 10), pt(am + 26, HO - 3), pt(am - 26, HO - 3)], lit('#f2efe6', ...FACE[f.side]), OUTLINE);
  if (g.fine) for (const h of [HO - 8, HO - 5.5]) stroke(g, [pt(am - 22, h), pt(am + 22, h)], 'rgba(60,64,70,0.8)', 0.9);
  const [tu, tv] = f.at(am, (b0 + bE) / 2);
  for (const [du, dv] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) stroke(g, [g.P(tu + du, tv + dv, HO + 1.6), g.P(tu + du * 0.8, tv + dv * 0.8, HO + 22)], STEEL, 0.9);
  cyl(g, tu, tv, 13, HO + 22, HO + 40, '#7c858b', false);
  cap(g, tu, tv, 13, HO + 40, '#5d656b', 0.4);
  // Silos mit Förderband zur Halle, Rampe
  const siloB = b1 - 20;
  for (const a of [a0 + 24, a0 + 52, a0 + 80]) {
    const [u, v] = f.at(a, siloB);
    shadow(g, u - 12, u + 12, v - 12, v + 12, 52, 0.14);
    cyl(g, u, v, 12, 0, 58, snowy('#d7dad8'), false);
    for (const h of [14, 28, 42]) band(g, u, v, 12, h, h + 0.8, '#a7aeb0');
    cap(g, u, v, 12, 58, '#9aa3a8', 0.4);
  }
  pipe(g, [[...f.at(a0 + 52, siloB), 62], [...f.at(a0 + 120, bE + 4), H + 8], [...f.at(a0 + 120, bE - 6), H + 8]], 3, '#7f878c');
  box(g, ...R(a0 + 140, a0 + 240, bE, bE + 8), 0, 5, '#a29e93', '#b9b5aa');
}

/** 2D: große Fabrikhalle von oben im Rahmen o = { long, x0, x1, y0, y1 }. */
export function plantTop(c, o) {
  const L = o.long === 'u';
  const T = (a, b) => (L ? [a, b] : [b, a]);
  const RT = (a0, a1, b0, b1, fill, line) => {
    const [p, q] = [T(a0, b0), T(a1, b1)];
    const r = [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
    if (line === undefined) rectF(c, ...r, fill);
    else rectS(c, ...r, fill, line, 0.6);
  };
  const [a0, a1, b0, b1] = L ? [o.x0, o.x1, o.y0, o.y1] : [o.y0, o.y1, o.x0, o.x1];
  const yard = b1 - 44;
  RT(a0, a1, yard, b1, '#9d9b93');
  const aE = a1 - 96;
  const bE = yard - 2;
  const [s0, s1] = [T(a0, b0), T(aE, bE)];
  shadowTop(c, Math.min(s0[0], s1[0]), Math.min(s0[1], s1[1]), Math.max(s0[0], s1[0]), Math.max(s0[1], s1[1]), 46);
  const n = Math.max(3, Math.round((aE - a0) / 26));
  const len = (aE - a0) / n;
  for (let k = 0; k < n; k++) {
    const t0 = a0 + k * len;
    RT(t0, t0 + len * 0.74, b0, bE, snowy(ROOF));
    RT(t0 + len * 0.74, t0 + len, b0, bE, SKY);
  }
  RT(a0, aE, b0, bE, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)');
  const [k0, k1] = [T(aE + 4, b0 + 10), T(a1, bE)];
  shadowTop(c, Math.min(k0[0], k1[0]), Math.min(k0[1], k1[1]), Math.max(k0[0], k1[0]), Math.max(k0[1], k1[1]), 66);
  flatTop(c, Math.min(k0[0], k1[0]), Math.min(k0[1], k1[1]), Math.max(k0[0], k1[0]), Math.max(k0[1], k1[1]), BRICK);
  const [tx, ty] = T((aE + 4 + a1) / 2, (b0 + bE) / 2);
  circle(c, tx + 6, ty + 6, 13, 'rgba(0,0,0,0.25)');
  circle(c, tx, ty, 13, '#6d767c');
  circle(c, tx - 3, ty - 3, 6, '#8d969c');
  for (const a of [a0 + 40, a0 + 92]) {
    const [x, y] = T(a, b0 + 22);
    circle(c, x + 16, y + 16, 9, 'rgba(0,0,0,0.22)');
    circle(c, x, y, 10, '#8f4636');
    circle(c, x, y, 7, '#c23b30');
    circle(c, x, y, 4.6, '#1f2022');
  }
  for (const a of [a0 + 24, a0 + 52, a0 + 80]) {
    const [x, y] = T(a, b1 - 20);
    circle(c, x + 5, y + 5, 12, 'rgba(0,0,0,0.25)');
    circle(c, x, y, 12, snowy('#c9ced0'));
    circle(c, x - 3, y - 3, 5, snowy('#e2e6e7'));
  }
  pipeTop(c, [T(a0 + 52, b1 - 20), T(a0 + 120, bE)], 3, '#7f878c');
}

// ---------- Strommast und Leitung ----------

// Maße des Gittermasts (Weltpx bzw. Höhen-px): Fuß halbe Breite, Taille bei waist, Spitze; Traversen [Höhe, halbe Länge]
const PY = { foot: 17, waist: 104, mid: 6, tip: 3, top: 156, arms: [[114, 42], [138, 30]], drop: 9, sag: 26 };
export const PYLON_TALL = PY.top + 8;

/** Aufhängepunkte der Leiterseile eines Masts: [quer (Weltpx entlang der Traverse), Höhe]; dazu das Erdseil an der Spitze. */
export const PYLON_WIRES = [...PY.arms.flatMap(([h, w]) => [[-w, h - PY.drop], [w, h - PY.drop]]), [0, PY.top]];

/** Iso: Gittermast; o.arm = Richtung der Traversen im Bildrahmen (Einheitsvektor [u, v]). */
export function paintPylon(g, o) {
  const { P } = g;
  const [au, av] = o.arm;
  const rad = (h) => (h <= PY.waist ? PY.foot + ((PY.mid - PY.foot) * h) / PY.waist : PY.mid + ((PY.tip - PY.mid) * (h - PY.waist)) / (PY.top - 6 - PY.waist));
  const L = (su, sv, h) => P(su * rad(h), sv * rad(h), h);
  shadow(g, -PY.foot - 4, PY.foot + 4, -PY.foot - 4, PY.foot + 4, 40, 0.1);
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, su * PY.foot - 3, su * PY.foot + 3, sv * PY.foot - 3, sv * PY.foot + 3, 0, 2.4, '#a9a69c');
  const levels = [0, 18, 36, 54, 72, 90, PY.waist, 122, PY.top - 6];
  const faces = [
    [[-1, -1], [1, -1], true],
    [[-1, -1], [-1, 1], true],
    [[1, -1], [1, 1], false],
    [[-1, 1], [1, 1], false],
  ];
  const draw = (back) => {
    const col = back ? 'rgba(70,78,84,0.75)' : STEEL;
    for (const [c1, c2, isBack] of faces) {
      if (isBack !== back) continue;
      for (let i = 0; i < levels.length - 1; i++) {
        const h0 = levels[i];
        const h1 = levels[i + 1];
        stroke(g, [L(...c1, h0), L(...c2, h1)], col, back ? 0.7 : 0.95);
        stroke(g, [L(...c2, h0), L(...c1, h1)], col, back ? 0.7 : 0.95);
        stroke(g, [L(...c1, h1), L(...c2, h1)], col, back ? 0.6 : 0.9);
      }
    }
    // Eckstiele
    for (const [su, sv] of back ? [[-1, -1]] : [[1, -1], [-1, 1], [1, 1]]) {
      stroke(g, levels.map((h) => L(su, sv, h)), back ? 'rgba(60,66,72,0.85)' : '#3d454b', back ? 1.2 : 1.8);
    }
  };
  draw(true);
  // Traversen (Fachwerk aus Ober- und Untergurt) mit Isolatorketten
  for (const [h, w] of PY.arms) {
    const r = rad(h);
    const E = (s, hh) => P(au * s, av * s, hh);
    stroke(g, [E(-w, h), E(w, h)], '#3d454b', 1.7);
    stroke(g, [E(-w, h), E(-r, h - 8), E(r, h - 8), E(w, h)], STEEL, 1);
    for (const s of [-w * 0.66, -w * 0.33, w * 0.33, w * 0.66]) stroke(g, [E(s, h), E(s * 0.9, h - 8 * (1 - Math.abs(s) / w))], STEEL, 0.8);
    for (const s of [-w, w]) {
      stroke(g, [E(s, h), E(s, h - PY.drop)], '#cfd3cc', 1.3);
      if (g.fine) for (let k = 1; k < 4; k++) stroke(g, [E(s - 1.4, h - (k * PY.drop) / 4), E(s + 1.4, h - (k * PY.drop) / 4)], '#e4e7e0', 0.8);
    }
  }
  draw(false);
  // Erdseilspitze
  stroke(g, [L(-1, -1, PY.top - 6), P(0, 0, PY.top), L(1, 1, PY.top - 6)], '#555e65', 0.9);
  stroke(g, [L(1, -1, PY.top - 6), P(0, 0, PY.top), L(-1, 1, PY.top - 6)], '#555e65', 0.9);
}

/** 2D: Mast von oben (Weltkoordinaten ab der Mastmitte); ang = Richtung der Traversen (Bogenmaß). */
export function pylonTop(c, ang) {
  const s = PY.foot;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(-s + 8, -s + 8, 2 * s, 2 * s);
  rectS(c, -s, -s, s, s, 'rgba(0,0,0,0)', '#3d454b', 3);
  lineT(c, [[-s, -s], [s, s]], '#4f585f', 2);
  lineT(c, [[s, -s], [-s, s]], '#4f585f', 2);
  rectS(c, -6, -6, 6, 6, '#5b646b', '#2f363b', 1);
  c.rotate(ang);
  for (const [, w] of PY.arms) lineT(c, [[-w, 0], [w, 0]], '#2f363b', 4);
  for (const [, w] of PY.arms) for (const x of [-w, w]) circle(c, x, 0, 2.6, '#e6e8e2');
  c.restore();
}

/**
 * Masten einer Karte nach Linie in Kartenreihenfolge, je Mast die Richtung der Linie (Mittel aus Vor- und Nachfolger).
 * Liefert Map Mast → { ang (Richtung der Traversen, quer zur Linie), next (nächster Mast oder null) }.
 */
export function pylonNet(buildings) {
  const lines = new Map();
  for (const b of buildings) if (b.kind === 'pylon') (lines.get(b.line ?? 0) ?? lines.set(b.line ?? 0, []).get(b.line ?? 0)).push(b);
  const out = new Map();
  for (const list of lines.values()) {
    list.forEach((b, i) => {
      const a = list[Math.max(0, i - 1)];
      const z = list[Math.min(list.length - 1, i + 1)];
      const dir = Math.atan2(z.y - a.y, z.x - a.x);
      out.set(b, { ang: dir + Math.PI / 2, next: list[i + 1] ?? null });
    });
  }
  return out;
}

/**
 * Leiterseile zwischen den Masten (über allen Objekten gezeichnet). pt(x, y, h) → Bildschirmpunkt {x, y} oder null; lw = Strichstärke.
 * Iso: pt rechnet Gelände und Höhe ein; 2D: Höhe ohne Wirkung, die Seile laufen gerade.
 */
export function drawWires(ctx, net, pt, lw, inView) {
  ctx.strokeStyle = 'rgba(28,30,33,0.85)';
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [a, info] of net) {
    const b = info.next;
    if (!b || (!inView(a.x, a.y) && !inView(b.x, b.y))) continue;
    const ib = net.get(b);
    for (const [s, h] of PYLON_WIRES) {
      const p = pt(a.x + Math.cos(info.ang) * s, a.y + Math.sin(info.ang) * s, h);
      const q = pt(b.x + Math.cos(ib.ang) * s, b.y + Math.sin(ib.ang) * s, h);
      if (!p || !q) continue;
      const m = pt((a.x + b.x) / 2 + Math.cos(info.ang) * s, (a.y + b.y) / 2 + Math.sin(info.ang) * s, h - PY.sag);
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(2 * m.x - (p.x + q.x) / 2, 2 * m.y - (p.y + q.y) / 2, q.x, q.y);
    }
  }
  ctx.stroke();
}

// Für render3d/maptown3d.js (Ansicht 3D): Farben der Fabrikhalle und Maße des Mastes
export { BRICK as PLANT_BRICK, CLAD as PLANT_CLAD, ROOF as PLANT_ROOF, SKY as PLANT_SKY, STEEL as PLANT_STEEL, PY };
