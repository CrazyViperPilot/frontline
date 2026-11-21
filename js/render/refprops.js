// Raffinerie und Ölfeld als Props der Karte (Werte js/data/props.js, Gruppe „ref“): Kacheln Rohrleitung und Rohrbrücke über
// fences.js, Einzelstücke Schwimmdachtank, Festdachtank, Kugeltank, Destillationskolonne, Prozessanlage, Fackelturm, Schornstein,
// Pferdekopfpumpe, Druckbehälter, Schieberstation und Leitstand hier. Modell in Welt-Pixeln um die Mitte, x entlang der Länge,
// y in die Tiefe, z nach oben; Silhouette aus wenigen Körpern, Kleinteile mit fine(). Nur Darstellung; gemalt in mapprops.js.
import { PAINT } from './unitpaint.js';
import { addLineKinds, rnd, tilt, snowy } from './fences.js';

const { box, cyl, ball, prX, prZ, on, fine, mix } = PAINT;
const TAU = Math.PI * 2;
const HALF = 16;

const TANK_COLS = ['#e2dfd6', '#d4c6a3', '#aeb0ab']; // weiß, sandbeige, silbergrau (Wüstenanlage)
const PIPE_COLS = ['#b8b3a5', '#8e918d', '#a8895c']; // Rohre: hellgrau, stahlgrau, rostbraun
const STEEL = '#70757a';
const FRAME = '#8a8d88';
const DARK = '#2e3134';
const CON = '#bdb7a8';
const YEL = '#d8b02e';
const RED = '#b5352b';
const WHITE = '#e8e6e0';
const BURNT = '#2f2b28';
const RUST = '#6a4632';
const GLASS = '#3f5a6c';

/** Punkt auf dem Kreis um (0, 0) mit Radius r, Winkel a. */
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

/** Kreisförmiger Grundriss (n Ecken) um (cx, cy). */
const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos(((i + 0.5) / n) * TAU) * r, cy + Math.sin(((i + 0.5) / n) * TAU) * r]);

/** Wendeltreppe außen am Tank (Radius R) von z0 bis z1, Beginn bei Winkel a0, über span Bogenmaß; Stufen und Geländer fein. */
function spiralStair(S, parent, R, z0, z1, a0, span) {
  const n = Math.max(6, Math.round((z1 - z0) / 2.2));
  let prev = null;
  for (let k = 0; k <= n; k++) {
    const a = a0 + (span * k) / n;
    const z = z0 + ((z1 - z0) * k) / n;
    const [x, y] = polar(R + 1.4, a);
    S.push(fine(on(parent, box(x - 1.1, x + 1.1, y - 1.1, y + 1.1, z - 0.3, z, STEEL, { noLine: true }))));
    const [hx, hy] = polar(R + 2.6, a);
    const p = [hx, hy, z + 3.2];
    if (prev) S.push(fine(on(parent, cyl(prev, p, 0.18, 0.18, 3, YEL, { noLine: true }))));
    prev = p;
  }
}

/** Geländerpfosten im Kreis (Radius r) auf Höhe z, n Pfosten; fein. */
function railRing(S, parent, cx, cy, r, z, n, col = YEL) {
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(r, (i / n) * TAU);
    S.push(fine(on(parent, cyl([cx + x, cy + y, z], [cx + x, cy + y, z + 3], 0.18, 0.18, 3, col, { noLine: true }))));
  }
  for (let i = 0; i < n; i++) {
    const [ax, ay] = polar(r, (i / n) * TAU);
    const [bx, by] = polar(r, ((i + 1) / n) * TAU);
    S.push(fine(on(parent, cyl([cx + ax, cy + ay, z + 3], [cx + bx, cy + by, z + 3], 0.16, 0.16, 3, col, { noLine: true })))); // Handlauf
  }
}

/** Ausgebrannte, eingesunkene Tankhülle (Radius R, Resthöhe h) mit abgeknickten Blechen. */
function burntShell(R, h, d) {
  const S = [cyl([0, 0, 0], [0, 0, 1.4], R + 2, R + 2, 24, CON)];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    const [x0, y0] = polar(R, a0);
    const [x1, y1] = polar(R, a1);
    const hh = h * (0.45 + rnd(d, i) * 0.55);
    const t = 0.8;
    const plate = prZ([[x0, y0], [x1, y1], [x1 * (1 - t / R), y1 * (1 - t / R)], [x0 * (1 - t / R), y0 * (1 - t / R)]], 1.4, hh, mix(BURNT, RUST, rnd(d, i + 20) * 0.5));
    S.push(plate);
  }
  S.push(cyl([0, 0, 1.4], [0, 0, 2], R - 1, R - 1, 24, '#1b1a19', { noLine: true })); // Ölschlamm innen
  for (let k = 0; k < 5; k++) {
    const [x, y] = polar(R * (0.2 + rnd(d, k + 40) * 0.6), rnd(d, k + 50) * TAU);
    S.push(tilt(box(x - 6, x + 6, y - 3, y + 3, 1.5, 2.5, mix(BURNT, RUST, 0.3)), k % 2 ? 'x' : 'y', (rnd(d, k + 60) - 0.5) * 0.9, x, y, 2)); // abgestürztes Dach
  }
  return S;
}

// ---------- Tanks ----------

/** Großer Schwimmdachtank: niedrige, sehr breite Hülle mit Versteifungsringen, Windträger, eingesunkenem Dach, Wendeltreppe. */
function tankFloat(v, d, w, rubble) {
  const R = 52;
  const H = 34;
  if (rubble) return burntShell(R, H * 0.55, d);
  const col = TANK_COLS[v % TANK_COLS.length];
  const S = [cyl([0, 0, 0], [0, 0, 1.6], R + 3, R + 3, 32, CON)]; // Ringfundament
  const shell = cyl([0, 0, 1.6], [0, 0, H], R, R, 32, col, { smooth: true });
  S.push(shell);
  for (const z of [9, 17, 25]) S.push(fine(on(shell, cyl([0, 0, z], [0, 0, z + 0.5], R + 0.15, R + 0.15, 32, mix(col, '#000000', 0.12), { noLine: true }))));
  S.push(on(shell, cyl([0, 0, H - 3], [0, 0, H - 1.8], R + 1.6, R + 1.6, 32, mix(col, '#000000', 0.08)))); // Windträger
  // Schwimmdach liegt tiefer: dunkler Innenrand, Dachfläche, Rolltreppe
  S.push(on(shell, cyl([0, 0, H], [0, 0, H + 0.05], R - 0.6, R - 0.6, 32, mix(col, '#000000', 0.45), { noLine: true })));
  const roof = cyl([0, 0, H + 0.05], [0, 0, H + 0.1], R - 3, R - 3, 32, mix('#9a9c98', col, 0.3), { noLine: true, ...snowy(w) });
  S.push(on(shell, roof));
  S.push(fine(on(roof, box(-2, 2, -R + 4, -6, H + 0.1, H + 0.4, STEEL, { noLine: true })))); // Rolltreppe aufs Dach
  for (let k = 0; k < 6; k++) {
    const [x, y] = polar(R * 0.45, (k / 6) * TAU + 0.3);
    S.push(fine(on(roof, cyl([x, y, H + 0.1], [x, y, H + 1.6], 1.4, 1.4, 6, '#7b7d79', { noLine: true })))); // Dachstützen, Entlüfter
  }
  for (let k = 0; k < 4; k++) {
    const [x, y] = polar(R + 0.8, (k / 4) * TAU + 0.8);
    S.push(fine(on(shell, cyl([x, y, 1.6], [x, y, H - 0.5], 0.5, 0.5, 4, '#c9433a', { noLine: true })))); // Schaumlöschleitung
  }
  spiralStair(S, shell, R, 1.6, H, -0.4 + (d % 4) * 0.5, 1.1);
  railRing(S, shell, 0, 0, R - 0.3, H, 32);
  const [lx, ly] = polar(R + 0.1, -1.2);
  S.push(fine(on(shell, prZ(circle(lx, ly, 0.2, 4), 14, 22, ['#2f5d8a', '#b5352b', '#3d6e45'][(d + v) % 3], { noLine: true })))); // Kennstreifen
  S.push(fine(on(shell, cyl([R - 1, 0, 2.5], [R + 6, 0, 2.5], 1.6, 1.6, 8, PIPE_COLS[v % 3], { noLine: true })))); // Anschlussstutzen
  return S;
}

/** Festdachtank: mittelgroß, Kegeldach mit Geländer, Entlüfter, Wendeltreppe. */
function tankFixed(v, d, w, rubble) {
  const R = 30;
  const H = 30;
  if (rubble) return burntShell(R, H * 0.6, d);
  const col = TANK_COLS[(v + 1) % TANK_COLS.length];
  const S = [cyl([0, 0, 0], [0, 0, 1.4], R + 2.5, R + 2.5, 24, CON)];
  const shell = cyl([0, 0, 1.4], [0, 0, H], R, R, 24, col, { smooth: true });
  S.push(shell);
  for (const z of [8, 15, 22]) S.push(fine(on(shell, cyl([0, 0, z], [0, 0, z + 0.4], R + 0.12, R + 0.12, 24, mix(col, '#000000', 0.12), { noLine: true }))));
  const roof = cyl([0, 0, H], [0, 0, H + 5.5], R + 0.4, 2.5, 24, mix(col, '#ffffff', 0.08), { smooth: true, ...snowy(w) });
  S.push(roof);
  S.push(on(roof, cyl([0, 0, H + 5.4], [0, 0, H + 7.5], 1.8, 1.8, 8, STEEL))); // Entlüfter
  S.push(fine(on(roof, cyl([0, 0, H + 7.5], [0, 0, H + 8.2], 2.6, 2.6, 8, STEEL, { noLine: true }))));
  railRing(S, roof, 0, 0, R - 0.5, H, 20);
  spiralStair(S, shell, R, 1.4, H, 0.6 + (d % 4) * 0.4, 1.3);
  const band = ['#2f5d8a', '#b5352b', '#3d6e45'][(d + v) % 3];
  S.push(fine(on(shell, cyl([0, 0, H - 6], [0, 0, H - 4], R + 0.1, R + 0.1, 24, band, { noLine: true })))); // Farbband
  S.push(fine(on(shell, cyl([-R + 1, 0, 2.5], [-R - 6, 0, 2.5], 1.4, 1.4, 8, PIPE_COLS[v % 3], { noLine: true }))));
  return S;
}

/** Kugeltank für Flüssiggas: Kugel auf acht Stützen mit Kreuzverbänden, schräge Treppe zur Plattform oben. */
function tankSphere(v, d, w, rubble) {
  const R = 25;
  const Z = R + 12;
  const col = rubble ? BURNT : TANK_COLS[v % 2 === 0 ? 0 : 2];
  const S = [prZ(circle(0, 0, R + 4, 16), 0, 1.2, CON)];
  const legs = 8;
  const at = (i) => polar(R * 0.82, (i / legs) * TAU);
  for (let i = 0; i < legs; i++) {
    const [x, y] = at(i);
    if (rubble && i % 3 === 0) {
      S.push(tilt(cyl([x, y, 0], [x, y, Z * 0.7], 1.5, 1.5, 6, mix(col, RUST, 0.4)), i % 2 ? 'x' : 'y', 0.9, x, y, 0));
      continue;
    }
    S.push(cyl([x, y, 0], [x, y, rubble ? Z * 0.5 : Z], 1.5, 1.5, 6, rubble ? mix(col, RUST, 0.4) : mix(col, '#000000', 0.15)));
    const [nx, ny] = at(i + 1);
    if (!rubble) {
      S.push(fine(cyl([x, y, 2], [nx, ny, Z - 10], 0.25, 0.25, 3, STEEL, { noLine: true })));
      S.push(fine(cyl([nx, ny, 2], [x, y, Z - 10], 0.25, 0.25, 3, STEEL, { noLine: true })));
    }
  }
  if (rubble) {
    S.push(ball([4, -3, R * 0.55], R * 0.95, R * 0.9, R * 0.5, mix(BURNT, RUST, 0.25), { n: 14, m: 8 })); // eingesackte Kugel
    for (let k = 0; k < 4; k++) {
      const [x, y] = polar(R + 6 + rnd(d, k) * 8, rnd(d, k + 9) * TAU);
      S.push(tilt(box(x - 5, x + 5, y - 4, y + 4, 0, 1.2, mix(BURNT, '#6b6560', 0.4)), 'x', (rnd(d, k + 20) - 0.5) * 0.8, x, y, 0));
    }
    return S;
  }
  const sph = ball([0, 0, Z], R, R, R, col, { n: 20, m: 12 });
  S.push(sph);
  S.push(fine(on(sph, cyl([0, 0, Z - 0.6], [0, 0, Z + 0.6], R + 0.12, R + 0.12, 20, mix(col, '#000000', 0.14), { noLine: true })))); // Schweißnaht Äquator
  const top = cyl([0, 0, Z + R - 1.2], [0, 0, Z + R + 0.4], 6, 6, 12, STEEL, snowy(w));
  S.push(on(sph, top)); // Plattform
  railRing(S, top, 0, 0, 5.8, Z + R + 0.4, 10);
  // schräge Treppe vom Boden zur Plattform
  const a = 0.5 + (d % 4) * 0.4;
  const [sx, sy] = polar(R + 12, a);
  const [ex, ey] = polar(5, a);
  const [tx, ty] = polar(1.6, a + Math.PI / 2);
  for (const s of [-1, 1]) S.push(cyl([sx + tx * s, sy + ty * s, 0], [ex + tx * s, ey + ty * s, Z + R], 0.4, 0.4, 4, YEL));
  for (let k = 1; k < 18; k++) {
    const t = k / 18;
    S.push(fine(cyl([sx + (ex - sx) * t - tx, sy + (ey - sy) * t - ty, (Z + R) * t], [sx + (ex - sx) * t + tx, sy + (ey - sy) * t + ty, (Z + R) * t], 0.25, 0.25, 3, STEEL, { noLine: true })));
  }
  S.push(fine(on(sph, cyl([0, 0, Z - R - 2], [0, 0, 1.2], 1.2, 1.2, 6, PIPE_COLS[0], { noLine: true })))); // Ablass nach unten
  return S;
}

// ---------- Kolonnen, Fackel, Schornstein ----------

/** Destillationskolonne: hoher Turm mit Plattformen, Leiter und Brüdenleitung, daneben eine schlankere Nebenkolonne. */
function column(v, d, w, rubble) {
  const col = ['#c9c6bd', '#a9aca8', '#d0c2a0'][v % 3];
  if (rubble) {
    const S = [cyl([-5, -3, 0], [-5, -3, 22], 9, 8, 14, mix(BURNT, col, 0.3))];
    S.push(tilt(cyl([-5, -3, 0], [-5, -3, 80], 8, 8, 14, mix(BURNT, col, 0.4)), 'y', 1.45, -5, -3, 10)); // umgestürzt
    S.push(box(6, 16, 2, 14, 0, 8, mix(BURNT, STEEL, 0.4)));
    return S;
  }
  const S = [];
  const tower = (cx, cy, r, h, plats) => {
    const skirt = cyl([cx, cy, 0], [cx, cy, 6], r + 1, r + 1, 14, mix(col, '#000000', 0.25));
    const body = cyl([cx, cy, 6], [cx, cy, h], r, r, 14, col, { smooth: true });
    S.push(skirt, body, on(body, ball([cx, cy, h], r, r, r * 0.6, col, { half: true, n: 14, m: 4, ...snowy(w) })));
    for (const z of plats) {
      const p = cyl([cx, cy, z - 0.7], [cx, cy, z], r + 3.5, r + 3.5, 14, STEEL, snowy(w));
      S.push(p);
      railRing(S, p, cx, cy, r + 3.3, z, 12);
    }
    for (let z = 8; z < h - 2; z += 1.6) S.push(fine(on(body, box(cx - r - 1.5, cx - r - 0.9, cy - 0.8, cy + 0.8, z, z + 0.25, DARK, { noLine: true })))); // Leiter
    for (let z = 14; z < h - 4; z += 13) S.push(fine(on(body, cyl([cx, cy, z], [cx, cy, z + 0.5], r + 0.1, r + 0.1, 14, mix(col, '#000000', 0.12), { noLine: true }))));
    return body;
  };
  const H = 104 + (d % 3) * 8;
  const main = tower(-5, -3, 8, H, [28, 54, 80, H - 2]);
  S.push(on(main, cyl([3.5, -3, H - 3], [3.5, -3, 6], 1.3, 1.3, 6, PIPE_COLS[v % 3]))); // Brüdenleitung
  S.push(on(main, cyl([3.5, -3, H - 3], [-5, -3, H - 3], 1.3, 1.3, 6, PIPE_COLS[v % 3])));
  tower(11, 8, 5, 64 + (d % 2) * 10, [34, 60 + (d % 2) * 10]);
  S.push(cyl([-5, 6, 20], [11, 2, 20], 1.1, 1.1, 6, PIPE_COLS[(v + 1) % 3])); // Querverbindung
  return S;
}

/** Prozessanlage: Stahlgerüst mit drei Bühnen, Behältern, Reaktor, Rohrbündeln und Luftkühlern oben. */
function processUnit(v, d, w, rubble) {
  const S = [];
  const XS = [-44, -22, 0, 22, 44];
  const YS = [-28, 0, 28];
  const L = [0, 18, 36, 54];
  if (rubble) {
    S.push(box(-48, 48, -32, 32, 0, 1.2, mix(BURNT, CON, 0.4)));
    for (let k = 0; k < 9; k++) {
      const x = (rnd(d, k) - 0.5) * 84;
      const y = (rnd(d, k + 10) - 0.5) * 52;
      S.push(tilt(box(x - 12, x + 12, y - 1, y + 1, 1, 3, mix(BURNT, STEEL, rnd(d, k + 20) * 0.5)), k % 2 ? 'x' : 'y', (rnd(d, k + 30) - 0.5) * 1.2, x, y, 2));
    }
    for (const [x, y] of [[-44, -28], [44, 28], [0, 0]]) S.push(box(x - 1, x + 1, y - 1, y + 1, 0, 18 + rnd(d, x) * 14, mix(BURNT, FRAME, 0.4)));
    S.push(tilt(cyl([20, -10, 2], [20, -10, 70], 6, 6, 12, mix(BURNT, col0(v), 0.4)), 'x', 1.4, 20, -10, 6));
    return S;
  }
  S.push(box(-48, 48, -32, 32, 0, 1.2, CON));
  for (const x of XS) for (const y of YS) S.push(box(x - 1, x + 1, y - 1, y + 1, 1.2, L[3], FRAME));
  for (const z of L.slice(1)) {
    const deck = box(-45, 45, -29, 29, z - 0.8, z, mix(FRAME, '#000000', 0.15), z === L[3] ? snowy(w) : { alpha: 0.55 });
    S.push(deck);
    for (const y of [-29, 29]) S.push(fine(on(deck, box(-45, 45, y - 0.1, y + 0.1, z + 2.6, z + 3, YEL, { noLine: true })))); // Geländer
    for (const x of [-45, 45]) S.push(fine(on(deck, box(x - 0.1, x + 0.1, -29, 29, z + 2.6, z + 3, YEL, { noLine: true }))));
  }
  for (const x of XS) for (const y of [-28, 28]) S.push(fine(cyl([x, y, 2], [x + (x < 44 ? 22 : -22), y, 18], 0.3, 0.3, 3, FRAME, { noLine: true }))); // Streben
  // Behälter und Reaktor
  const c0 = col0(v);
  const drum = cyl([-32, -12, 18], [-32, -12, 46], 7, 7, 14, c0, { smooth: true });
  S.push(drum, on(drum, ball([-32, -12, 46], 7, 7, 3.5, c0, { half: true, n: 14, m: 3 })));
  const hv = cyl([-30, 12, 41.5], [2, 12, 41.5], 5, 5, 12, mix(c0, '#ffffff', 0.1), { smooth: true });
  S.push(hv);
  for (const x of [-30, 2]) S.push(on(hv, ball([x, 12, 41.5], 2.5, 5, 5, mix(c0, '#ffffff', 0.1), { n: 12, m: 4 })));
  const reactor = cyl([22, -10, 1.2], [22, -10, 84], 6.5, 6.5, 14, mix(c0, '#000000', 0.08), { smooth: true });
  S.push(reactor, on(reactor, ball([22, -10, 84], 6.5, 6.5, 4, mix(c0, '#000000', 0.08), { half: true, n: 14, m: 3, ...snowy(w) })));
  const rp = cyl([22, -10, 69.3], [22, -10, 70], 10, 10, 12, STEEL);
  S.push(rp);
  railRing(S, rp, 22, -10, 9.8, 70, 10);
  for (const x of [8, 36]) S.push(cyl([x, 14, 18], [x, 14, 30], 4, 4, 10, PIPE_COLS[(v + 1) % 3])); // Pumpen, Wärmetauscher
  // Rohrbündel längs auf den Bühnen
  for (const [z, y, r, k] of [[20.5, 24, 1.6, 0], [20.5, 20, 1.2, 1], [38.5, -24, 1.6, 2], [38.5, -20, 1.1, 0]]) S.push(cyl([-48, y, z], [48, y, z], r, r, 8, PIPE_COLS[(v + k) % 3]));
  S.push(cyl([22, -10, 60], [22, 24, 60], 1.4, 1.4, 6, PIPE_COLS[v % 3]), cyl([22, 24, 60], [22, 24, 20.5], 1.4, 1.4, 6, PIPE_COLS[v % 3]));
  // Luftkühler oben: Kästen mit Lüftern
  for (const x of [-38, -14]) {
    const cool = box(x - 10, x + 10, -24, 4, L[3], L[3] + 5, mix(FRAME, '#ffffff', 0.15), snowy(w));
    S.push(cool);
    for (const y of [-17, -3]) S.push(fine(on(cool, cyl([x, y, L[3] + 5], [x, y, L[3] + 5.2], 5.5, 5.5, 12, DARK, { noLine: true }))));
  }
  for (let z = 2; z < L[3]; z += 1.6) S.push(fine(box(46, 46.6, 2, 6, z, z + 0.25, DARK, { noLine: true }))); // Leiter außen
  return S;
}

/** Grundfarbe der Behälter einer Prozessanlage. */
function col0(v) {
  return ['#c9c6bd', '#b9bcb6', '#d0c2a0'][v % 3];
}

/** Fackelturm: rot-weiß geringelter Schlot mit Gittermast-Beinen, oben die offene Flamme. */
function flareStack(v, d, w, rubble) {
  const H = 116 + (d % 3) * 8;
  const S = [box(-12, 12, -12, 12, 0, 1.6, CON)];
  const legs = [0, 1, 2].map((i) => polar(10, (i / 3) * TAU + 0.5));
  if (rubble) {
    S.push(cyl([0, 0, 1.6], [0, 0, 18], 2.6, 2.6, 8, mix(BURNT, RED, 0.3)));
    S.push(tilt(cyl([0, 0, 18], [0, 0, H * 0.7], 2.4, 2.2, 8, mix(BURNT, WHITE, 0.35)), 'x', 1.5, 0, 0, 18));
    for (const [x, y] of legs) S.push(cyl([x, y, 0], [x * 0.5, y * 0.5, 22], 0.7, 0.6, 4, mix(BURNT, STEEL, 0.4)));
    return S;
  }
  const seg = 14;
  for (let z = 1.6, k = 0; z < H; z += seg, k++) S.push(cyl([0, 0, z], [0, 0, Math.min(H, z + seg)], 2.6, 2.4, 10, k % 2 ? WHITE : RED, { smooth: true }));
  for (const [x, y] of legs) S.push(cyl([x, y, 0], [x * 0.15, y * 0.15, H * 0.8], 0.7, 0.4, 4, STEEL));
  for (let k = 0; k < 5; k++) {
    const z0 = 6 + k * H * 0.15;
    const s = 1 - z0 / (H * 0.8);
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = legs[i];
      const [bx, by] = legs[(i + 1) % 3];
      S.push(fine(cyl([ax * s, ay * s, z0], [bx * s, by * s, z0 + H * 0.15 * 0.6], 0.2, 0.2, 3, STEEL, { noLine: true }))); // Gitterstreben
    }
  }
  const tip = cyl([0, 0, H], [0, 0, H + 3], 3.2, 3.2, 10, DARK);
  S.push(tip);
  railRing(S, tip, 0, 0, 4.5, H - 4, 8);
  // Flamme: drei Kegel, außen orange, innen gelb, oben leicht im Wind
  const lean = 3 + (d % 3);
  S.push(cyl([0, 0, H + 3], [lean, 1, H + 22], 4.2, 0.4, 10, '#e8742a', { noLine: true, glow: true }));
  S.push(cyl([0, 0, H + 3], [lean * 0.7, 0.6, H + 16], 2.8, 0.3, 8, '#f6b53c', { noLine: true, glow: true }));
  S.push(cyl([0, 0, H + 3], [lean * 0.4, 0.3, H + 10], 1.5, 0.2, 6, '#fff0b0', { noLine: true, glow: true }));
  return S;
}

/** Schornstein: hoher, sich verjüngender Betonschlot mit rot-weißer Kappe und Plattform. */
function chimney(v, d, w, rubble) {
  const col = ['#c9c1b0', '#b8b2a6', '#cdbf9e'][v % 3];
  const H = 128 + (d % 3) * 10;
  const S = [box(-13, 13, -13, 13, 0, 3, CON)];
  const r = (z) => 10 - (z / H) * 4;
  if (rubble) {
    const h = 26 + rnd(d, 1) * 14;
    S.push(cyl([0, 0, 3], [0, 0, h], 10, r(h), 14, mix(col, BURNT, 0.4)));
    S.push(cyl([11, 2, 7.5], [11 + H * 0.45, 9, 5.5], 7.5, 5.5, 14, mix(col, BURNT, 0.3))); // umgestürzter Schaft
    for (let k = 0; k < 6; k++) {
      const [x, y] = polar(12 + rnd(d, k) * 10, rnd(d, k + 9) * TAU);
      S.push(tilt(box(x - 4, x + 4, y - 3, y + 3, 0, 2 + rnd(d, k + 4) * 3, mix(col, BURNT, 0.3)), 'x', (rnd(d, k + 20) - 0.5) * 0.7, x, y, 0));
    }
    return S;
  }
  const body = cyl([0, 0, 3], [0, 0, H - 18], 10, r(H - 18), 16, col, { smooth: true });
  S.push(body);
  for (let k = 0; k < 3; k++) {
    const z0 = H - 18 + k * 6;
    S.push(cyl([0, 0, z0], [0, 0, z0 + 6], r(z0), r(z0 + 6), 16, k % 2 ? WHITE : RED, { smooth: true, ...(k === 2 ? snowy(w) : {}) }));
  }
  S.push(cyl([0, 0, H - 0.05], [0, 0, H + 0.05], r(H) - 0.8, r(H) - 0.8, 16, '#1c1b1a', { noLine: true })); // Öffnung
  const pl = cyl([0, 0, H - 22], [0, 0, H - 21], r(H - 22) + 3, r(H - 22) + 3, 16, STEEL);
  S.push(pl);
  railRing(S, pl, 0, 0, r(H - 22) + 2.8, H - 21, 12);
  for (let z = 4; z < H - 22; z += 1.8) S.push(fine(on(body, box(r(z) + 0.2, r(z) + 0.8, -0.8, 0.8, z, z + 0.25, DARK, { noLine: true })))); // Steigleiter
  S.push(fine(on(body, box(-11, -9.6, -3, 3, 3, 9, '#5d6064', { noLine: true })))); // Fuchs (Rauchgaseinlass)
  return S;
}

// ---------- Ölfeld ----------

/** Pferdekopfpumpe: Sockel, A-Bock, Balken mit Pferdekopf, Kurbel mit Gegengewicht, Motor; Neigung des Balkens aus d. */
function pumpJack(v, d, w, rubble) {
  const col = rubble ? mix(BURNT, RUST, 0.3) : ['#3e6c8f', '#d1a02c', '#b2552c'][v % 3];
  const dark = mix(col, '#000000', 0.3);
  const S = [box(-21, 21, -6, 6, 0, 1.4, CON)];
  S.push(box(-20, 14, -2.5, 2.5, 1.4, 3, mix(STEEL, '#000000', 0.2))); // Grundrahmen
  for (const s of [-1, 1]) {
    S.push(cyl([-3, s * 4.5, 3], [1.5, s * 0.6, 21], 0.7, 0.6, 4, col)); // A-Bock vorn
    S.push(cyl([7, s * 4.5, 3], [1.5, s * 0.6, 21], 0.7, 0.6, 4, col));
  }
  if (rubble) {
    S.push(tilt(box(-17, 17, -1.2, 1.2, 1.4, 4, col), 'x', 0.3, 0, 0, 1.4));
    S.push(box(-18, -10, -4, 4, 1.4, 6, dark));
    return S;
  }
  const a = [-0.22, -0.08, 0.08, 0.22][d % 4]; // Stellung des Balkens
  const piv = [1.5, 0, 21.5];
  const beam = tilt(box(-16, 15, -1.1, 1.1, 20.5, 22.8, col, snowy(w)), 'y', a, ...piv);
  S.push(beam);
  const head = tilt(prX([[15, 15], [17.5, 15.5], [19.5, 18], [20, 21.5], [19.5, 25], [17.5, 27.5], [15, 28]], -1.6, 1.6, dark, snowy(w)), 'y', a, ...piv);
  S.push(head);
  // Seil vom Pferdekopf zum Bohrlochkopf
  const hx = piv[0] + (20 - piv[0]) * Math.cos(a);
  const hz = piv[2] - (20 - piv[0]) * Math.sin(a) - 4;
  S.push(fine(cyl([hx, 0, hz], [hx, 0, 5], 0.18, 0.18, 3, DARK, { noLine: true })));
  S.push(cyl([hx, 0, 1.4], [hx, 0, 5], 1.5, 1.2, 8, '#8a8d88'), fine(box(hx - 2.5, hx + 2.5, -0.4, 0.4, 3.2, 3.8, RED, { noLine: true }))); // Bohrlochkopf
  // Kurbel und Gegengewichte, Pleuel zum Balkenende
  const cx = -14;
  for (const s of [-1, 1]) {
    S.push(cyl([cx, s * 2.6, 9], [cx, s * 3.6, 9], 1.2, 1.2, 8, DARK));
    const ang = (d % 8) * (TAU / 8);
    const [ox, oz] = [Math.cos(ang) * 4, Math.sin(ang) * 4];
    S.push(box(cx + ox - 3.5, cx + ox + 3.5, s < 0 ? -4 : 3, s < 0 ? -3 : 4, 9 + oz - 2.8, 9 + oz + 2.8, dark)); // Gegengewicht
    const ex = piv[0] + (-15 - piv[0]) * Math.cos(a);
    const ez = piv[2] - (-15 - piv[0]) * Math.sin(a) - 1;
    S.push(fine(cyl([cx + ox, s * 2.2, 9 + oz], [ex, s * 1.4, ez], 0.35, 0.35, 4, STEEL, { noLine: true }))); // Pleuel
  }
  S.push(box(-20, -16, -2.5, 2.5, 3, 7, mix(STEEL, '#000000', 0.1))); // Getriebe
  S.push(box(-20.5, -14, 3, 6, 1.4, 5, '#5b6a4a')); // Motor
  return S;
}

/** Druckbehälter liegend: zwei Behälter auf Sätteln, Stutzen oben, Verbindungsleitung und kleine Bühne. */
function vessels(v, d, w, rubble) {
  const col = rubble ? BURNT : TANK_COLS[(v + d) % TANK_COLS.length];
  const R = 8;
  const S = [box(-28, 28, -20, 20, 0, 1.2, CON)];
  for (const y of [-10, 10]) {
    for (const x of [-14, 14]) S.push(box(x - 2, x + 2, y - 6.5, y + 6.5, 1.2, R + 2, mix(CON, '#000000', 0.1))); // Sättel
    if (rubble) {
      S.push(tilt(cyl([-20, y, R + 2], [20, y, R + 2], R, R * 0.7, 14, mix(col, RUST, y > 0 ? 0.4 : 0.2)), 'x', y > 0 ? 0.3 : -0.2, 0, y, 2));
      continue;
    }
    const body = cyl([-20, y, R + 2.5], [20, y, R + 2.5], R, R, 16, col, { smooth: true, ...snowy(w) });
    S.push(body);
    for (const x of [-20, 20]) S.push(on(body, ball([x, y, R + 2.5], 4, R, R, col, { n: 16, m: 6, ...snowy(w) })));
    for (const x of [-8, 6]) S.push(on(body, cyl([x, y, 2 * R + 2], [x, y, 2 * R + 5], 1.4, 1.4, 8, STEEL))); // Stutzen
    S.push(fine(on(body, box(-4, 4, y - R - 0.05, y - R + 0.05, R, R + 5, '#e8c83a', { noLine: true })))); // Gefahrschild
  }
  if (!rubble) {
    S.push(cyl([-8, -10, 2 * R + 5], [-8, 10, 2 * R + 5], 1.2, 1.2, 6, PIPE_COLS[v % 3])); // Verbindung
    S.push(cyl([6, -10, 2 * R + 5], [6, 0, 2 * R + 5], 1.2, 1.2, 6, PIPE_COLS[v % 3]), cyl([6, 0, 2 * R + 5], [26, 0, 2 * R + 5], 1.2, 1.2, 6, PIPE_COLS[v % 3]));
    S.push(cyl([26, 0, 2 * R + 5], [26, 0, 1.2], 1.2, 1.2, 6, PIPE_COLS[v % 3]));
    const deck = box(-4, 4, -4, 4, 2 * R + 2, 2 * R + 2.6, STEEL, snowy(w));
    S.push(deck);
    railRing(S, deck, 0, 0, 4.5, 2 * R + 2.6, 8);
    for (let z = 2; z < 2 * R + 2; z += 1.6) S.push(fine(box(-26, -25.4, -1.2, 1.2, z, z + 0.25, DARK, { noLine: true })));
  }
  return S;
}

/** Schieberstation: Betonsockel, drei Leitungen aus dem Boden mit Schiebern und roten Handrädern, Manometer. */
function manifold(v, d, w, rubble) {
  const S = [box(-20, 20, -14, 14, 0, 1.5, CON, snowy(w))];
  const cols = PIPE_COLS;
  for (let k = 0; k < 3; k++) {
    const y = -8 + k * 8;
    const pc = rubble ? mix(BURNT, cols[(v + k) % 3], 0.4) : cols[(v + k) % 3];
    if (rubble) {
      S.push(tilt(cyl([-20, y, 4], [4, y, 4], 2.2, 2.2, 10, pc), 'y', (rnd(d, k) - 0.5) * 0.5, -8, y, 4));
      continue;
    }
    const run = cyl([-20, y, 5], [14, y, 5], 2.2, 2.2, 10, pc, { smooth: true, ...snowy(w) });
    S.push(run);
    S.push(cyl([14, y, 5], [14, y, 1.5], 2.2, 2.2, 10, pc)); // Bogen in den Boden
    S.push(cyl([-20, y, 5], [-21.5, y, 5], 3, 3, 10, mix(pc, '#000000', 0.25))); // Flansch am Rand
    for (const x of [-15, 8]) S.push(box(x - 1.2, x + 1.2, y - 2.6, y + 2.6, 1.5, 3, STEEL)); // Rohrlager
    const vx = -4 + (k - 1) * 3;
    const valve = box(vx - 2.4, vx + 2.4, y - 2.8, y + 2.8, 2.6, 7.6, mix(pc, '#000000', 0.35));
    S.push(valve, on(valve, cyl([vx, y, 7.6], [vx, y, 12], 0.5, 0.5, 4, STEEL)));
    S.push(on(valve, cyl([vx, y, 12], [vx, y, 12.6], 3.2, 3.2, 10, RED))); // Handrad
  }
  if (!rubble) {
    S.push(cyl([16, -12, 1.5], [16, -12, 9], 0.4, 0.4, 4, STEEL), fine(cyl([16, -12.6, 9.6], [16, -11.4, 9.6], 1.3, 1.3, 10, WHITE, { noLine: true }))); // Manometer
    S.push(fine(prZ([[-19, 12], [-13, 12], [-13, 12.3], [-19, 12.3]], 1.5, 5, YEL, { noLine: true }))); // Schild
  }
  return S;
}

/** Leitstand: druckfester Betonbau mit wenigen kleinen Fenstern, Klimageräten und Antennenmast auf dem Dach. */
function controlRoom(v, d, w, rubble) {
  const col = ['#cfc6b0', '#c4c0b4', '#d6c9a6'][v % 3];
  if (rubble) {
    const S = [box(-36, 36, -24, 24, 0, 2, mix(col, '#000000', 0.25))];
    for (const [x0, x1, y0, y1, h] of [[-36, -20, -24, -21, 12], [20, 36, 21, 24, 9], [-36, -33, -6, 24, 7]]) S.push(box(x0, x1, y0, y1, 2, h, mix(col, BURNT, 0.25)));
    for (let k = 0; k < 8; k++) {
      const x = (rnd(d, k) - 0.5) * 60;
      const y = (rnd(d, k + 10) - 0.5) * 38;
      S.push(tilt(box(x - 6, x + 6, y - 4, y + 4, 2, 4 + rnd(d, k + 20) * 4, mix(col, BURNT, rnd(d, k + 30) * 0.4), { vary: 0.2 }), 'x', (rnd(d, k + 40) - 0.5) * 0.6, x, y, 2));
    }
    return S;
  }
  const body = box(-36, 36, -24, 24, 0, 20, col);
  const S = [body];
  S.push(on(body, box(-36, 36, -24, 24, 20, 22.5, mix(col, '#000000', 0.1), snowy(w)))); // Attika
  S.push(on(body, box(-34.5, 34.5, -22.5, 22.5, 22.5, 22.6, mix(col, '#000000', 0.3), { noLine: true, ...snowy(w) })));
  for (const s of [-1, 1]) for (const x of [-26, -12, 12, 26]) S.push(fine(on(body, box(x - 3, x + 3, s * 24 - 0.06, s * 24 + 0.06, 12, 15, GLASS, { noLine: true })))); // Fenster
  S.push(on(body, box(-4, 4, 23.9, 24.5, 0, 9, '#5d6064'))); // Schleusentür
  S.push(fine(on(body, box(-5, 5, 24.5, 26, 9, 9.6, '#7a7d80', { noLine: true })))); // Vordach
  for (const x of [-24, -12]) {
    const ac = box(x - 4.5, x + 4.5, -14, -6, 22.5, 27, '#a9aca8', snowy(w));
    S.push(ac, fine(on(ac, cyl([x, -10, 27], [x, -10, 27.2], 3, 3, 10, DARK, { noLine: true }))));
  }
  S.push(cyl([26, 14, 22.5], [26, 14, 46], 0.5, 0.35, 5, '#9a9fa2'), fine(cyl([26, 14, 40], [29, 14, 40], 0.2, 0.2, 3, '#9a9fa2', { noLine: true })));
  S.push(fine(on(body, prZ([[-35, 24.08], [-25, 24.08], [-25, 24.2], [-35, 24.2]], 16.5, 19, YEL, { noLine: true })))); // Schriftband
  return S;
}

// ---------- Kacheln: Rohrleitung, Rohrbrücke ----------

/** Rohrleitung: zwei dicke Rohre auf Betonschwellen, knapp über dem Boden; Infanterie klettert darüber. */
const PZ = 6; // Höhe der Rohrachse
const PR = 2.6; // Rohrradius
const PIPELINE = {
  h: PZ + PR,
  arm(v, w, d) {
    const c = PIPE_COLS[v % PIPE_COLS.length];
    const S = [];
    for (const y of [-3.3, 3.3]) {
      const p = cyl([0, y, PZ], [HALF, y, PZ], PR, PR, 10, c, { smooth: true, ...snowy(w) });
      S.push(p);
      S.push(fine(on(p, cyl([HALF - 0.25, y, PZ], [HALF, y, PZ], PR + 0.2, PR + 0.2, 10, mix(c, '#000000', 0.12), { noLine: true })))); // Schweißnaht
      if (d % 7 === 0 && y < 0) S.push(fine(on(p, cyl([7, y, PZ], [9, y, PZ], PR + 0.05, PR + 0.05, 10, mix(c, RUST, 0.3), { noLine: true })))); // Rostfleck
    }
    return S;
  },
  mid(v, w) {
    const c = PIPE_COLS[v % PIPE_COLS.length];
    const sl = box(-2.2, 2.2, -7.5, 7.5, 0, PZ - PR + 0.3, CON, snowy(w)); // Betonschwelle
    const S = [sl];
    for (const y of [-3.3, 3.3]) S.push(cyl([-0.8, y, PZ], [0.8, y, PZ], PR + 0.25, PR + 0.25, 10, mix(c, '#000000', 0.25), { noLine: true })); // Rohrschelle
    return S;
  },
  rubble(v, d) {
    const c = mix(PIPE_COLS[v % PIPE_COLS.length], BURNT, 0.35);
    const S = [prZ([[2, -8], [14, -6], [15, 5], [4, 8]], 0, 0.15, '#1d1b19', { noLine: true })]; // Öllache
    for (const y of [-3.3, 3.3]) {
      const t = 4 + rnd(d, y > 0 ? 1 : 2) * 6;
      S.push(cyl([0, y, PZ], [t, y, PZ], PR, PR, 10, c));
      S.push(tilt(cyl([t + 1.5, y, PR], [HALF, y, PR], PR, PR, 10, c), 'x', (rnd(d, y > 0 ? 3 : 4) - 0.5) * 0.5, t, y, PR));
    }
    return S;
  },
};

/** Rohrbrücke: Stahlportal je Kachel, zwei Ebenen mit Rohrbündeln; darunter fahren und laufen alle durch. */
const RY = 9; // halbe Breite des Portals
const RZ1 = 20; // untere Rohrebene
const RZ2 = 31; // obere Rohrebene
const RACK = {
  h: RZ2 + 4,
  arm(v, w, d) {
    const S = [];
    for (const z of [RZ1, RZ2]) for (const y of [-RY, RY]) S.push(box(0, HALF, y - 0.7, y + 0.7, z - 1.4, z, FRAME));
    const lo = [[-6.5, 1.7, 0], [-2.8, 1.4, 1], [0.6, 1.1, 2], [3.6, 1.7, 0], [7, 1.2, 1]];
    const hi = [[-5.5, 1.3, 2], [-1.5, 2, 0], [3, 1.1, 1]];
    for (const [y, r, k] of lo) S.push(cyl([0, y, RZ1 + r], [HALF, y, RZ1 + r], r, r, 8, PIPE_COLS[(v + k) % 3], { smooth: true }));
    for (const [y, r, k] of hi) S.push(cyl([0, y, RZ2 + r], [HALF, y, RZ2 + r], r, r, 8, PIPE_COLS[(v + k) % 3], { smooth: true, ...snowy(w) }));
    S.push(box(0, HALF, 6, 8.6, RZ2 + 0.1, RZ2 + 1.2, '#5d6064', snowy(w))); // Kabeltrasse
    if (d % 4 === 1) S.push(fine(cyl([8, -2.8, RZ1 + 1.4], [8, -2.8, RZ1 + 3.4], 0.4, 0.4, 4, STEEL, { noLine: true })), fine(cyl([8, -4, RZ1 + 3.4], [8, -1.6, RZ1 + 3.4], 0.2, 0.2, 3, RED, { noLine: true }))); // Schieber
    return S;
  },
  mid(v, w) {
    const S = [];
    for (const y of [-RY, RY]) {
      S.push(box(-1.1, 1.1, y - 1.1, y + 1.1, 0, RZ2, FRAME), box(-2, 2, y - 2, y + 2, 0, 1.2, CON));
      S.push(fine(cyl([0, y, 2], [0, -y * 0.2, RZ1 - 1.5], 0.25, 0.25, 3, FRAME, { noLine: true }))); // Strebe
    }
    for (const z of [RZ1, RZ2]) S.push(box(-1.1, 1.1, -RY - 1, RY + 1, z - 1.6, z, FRAME, z === RZ2 ? snowy(w) : {}));
    return S;
  },
  rubble(v, d) {
    const S = [];
    for (const y of [-RY, RY]) S.push(tilt(box(-1.1, 1.1, y - 1.1, y + 1.1, 0, RZ2 * 0.8, mix(FRAME, BURNT, 0.4)), 'y', (rnd(d, y > 0 ? 1 : 2) - 0.5) * 2.6, 0, y, 0));
    for (let k = 0; k < 4; k++) {
      const y = -6 + k * 4;
      S.push(tilt(cyl([0, y, 2], [HALF, y, 2], 1.6, 1.6, 8, mix(PIPE_COLS[(v + k) % 3], BURNT, 0.3)), 'x', (rnd(d, k + 5) - 0.5) * 0.4, 0, y, 2));
    }
    return S;
  },
};

addLineKinds({ pipeline: PIPELINE, pipe_rack: RACK });

const SINGLE = {
  tank_float: tankFloat,
  tank_fixed: tankFixed,
  tank_sphere: tankSphere,
  distill_column: column,
  process_unit: processUnit,
  flare_stack: flareStack,
  chimney,
  pump_jack: pumpJack,
  pressure_vessels: vessels,
  valve_station: manifold,
  control_room: controlRoom,
};

/** Gibt es ein Modell dieser Art hier? */
export const isRefSingle = (kind) => !!SINGLE[kind];

/** Körper eines Einzelstücks der Raffinerie (Modellrichtung). v: Farbvariante, d: Einzelheiten, w: Winter, rubble: Trümmer. */
export function refModel(kind, v, d, w, rubble) {
  const f = SINGLE[kind];
  return f ? f(v, d, w, rubble) : [];
}
