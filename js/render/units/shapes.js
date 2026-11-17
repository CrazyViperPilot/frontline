// Gemeinsame Bausteine der Einheiten-Modelle: Farben (Teamlack, Werkstoffe), Grundkörper (box, prX/prY/prZ, loft, cyl, ball,
// on, fine) und Fahrzeug-Bauteile (Ketten, Räder, Tarnflecken, Lichter, Antenne). Einstieg und Verzeichnis: ../unitpaint.js.
import { ISO_K } from '../camera.js';
import { mix } from '../color.js';

const K = ISO_K;
const TAU = Math.PI * 2;

// ---------- Farben ----------

// rgbOf, hexOf, mix aus color.js (seit v5.59)

// Je Team (Index = Teamnummer, wie BALANCE.teamColors): Lack (body), dunkel, hell, Tarnfleck, Teamfarbe (mark), Weste der Soldaten,
// Luftfahrzeuge. Lack: gedämpfter Ton mit einem Stich in die Teamfarbe; Weste: Teamfarbe, etwas dunkler; Luft: grau getönt.
// Grün (Team 2) und Gelb (Team 3) nach demselben Muster wie Blau und Rot.
const TEAM_PAINT = [
  { body: '#566f8f', dark: '#3b4c63', light: '#7690b0', camo: '#475a5c', mark: '#3d8bfd', vest: '#3a6fc0', air: '#62778f' },
  { body: '#8f5a4a', dark: '#603a30', light: '#ad7966', camo: '#665041', mark: '#e5484d', vest: '#b8443a', air: '#8e665b' },
  { body: '#51874f', dark: '#3a6039', light: '#70aa6e', camo: '#445a4b', mark: '#3fb950', vest: '#309147', air: '#619060' },
  { body: '#897a4d', dark: '#625737', light: '#ac9c6c', camo: '#5b5c42', mark: '#e3b341', vest: '#b4872d', air: '#908460' },
];
// Ausstellungsstücke auf den Höfen der Ausbildungsgebäude (seit v5.40, bigbuild.js): sandfarbene Grundierung ohne Teamfarbe,
// damit man sie nicht für echte Einheiten hält
const DISPLAY = { body: '#bdb08c', dark: '#8f8568', light: '#d9cfae', camo: '#a99f80', mark: '#f1ede0', vest: '#a89c7a', air: '#c2bdaf' };
/** Team-Kennung der Ausstellungsstücke. Kein Teamindex: Teams sind Zahlen 0 … 3, neutral -1 (Tiere, Kisten, Wracks). */
export const SHOWROOM = 'show';
const NEUTRAL = { body: '#6f7469', dark: '#4b4f47', light: '#8e9387', camo: '#585c50', mark: '#c9c9c0', vest: '#6f7469', air: '#7a7f78' };
const TRACK = '#2a2c2e';
const WHEEL = '#2b2d2f';
const HUB = '#4a4e51';
const METAL = '#3b3f42';
const GUN = '#2c3032';
const GLASS = '#4f6b80';
const YELLOW = '#c9a227';
const SKIN = '#c99a76';
const OLIVE = '#56603f';
const BOOT = '#2c2924';
const WHITE = '#dfe3dc';

// ---------- Körper ----------
// Modellkoordinaten in Welt-Pixeln: x nach vorn, y nach rechts, z nach oben. Ein Körper = Flächen + Mitte (für die Reihenfolge).

const solid = (faces, col, c, o = {}) => ({ faces, col, c, ...o });

function box(x0, x1, y0, y1, z0, z1, col, o) {
  return solid(
    [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    ],
    col,
    [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    o,
  );
}

/** Seitenprofil [[x, z] …] (Wanne, Kabine), quer von y0 bis y1 gezogen. */
function prX(prof, y0, y1, col, o) {
  const faces = [prof.map(([x, z]) => [x, y0, z]), prof.map(([x, z]) => [x, y1, z])];
  for (let i = 0; i < prof.length; i++) {
    const [ax, az] = prof[i];
    const [bx, bz] = prof[(i + 1) % prof.length];
    faces.push([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]]);
  }
  const cx = prof.reduce((s, p) => s + p[0], 0) / prof.length;
  const cz = prof.reduce((s, p) => s + p[1], 0) / prof.length;
  return solid(faces, col, [cx, (y0 + y1) / 2, cz], o);
}

/** Querschnitt [[y, z] …] (Plane, Rumpf), längs von x0 bis x1 gezogen. */
function prY(prof, x0, x1, col, o) {
  const faces = [prof.map(([y, z]) => [x0, y, z]), prof.map(([y, z]) => [x1, y, z])];
  for (let i = 0; i < prof.length; i++) {
    const [ay, az] = prof[i];
    const [by, bz] = prof[(i + 1) % prof.length];
    faces.push([[x0, ay, az], [x1, ay, az], [x1, by, bz], [x0, by, bz]]);
  }
  const cy = prof.reduce((s, p) => s + p[0], 0) / prof.length;
  const cz = prof.reduce((s, p) => s + p[1], 0) / prof.length;
  return solid(faces, col, [(x0 + x1) / 2, cy, cz], o);
}

/** Grundriss [[x, y] …] (Turm, Flügel), von z0 bis z1 hochgezogen. */
function prZ(plan, z0, z1, col, o) {
  const faces = [plan.map(([x, y]) => [x, y, z1]), plan.map(([x, y]) => [x, y, z0])];
  for (let i = 0; i < plan.length; i++) {
    const [ax, ay] = plan[i];
    const [bx, by] = plan[(i + 1) % plan.length];
    faces.push([[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]]);
  }
  const cx = plan.reduce((s, p) => s + p[0], 0) / plan.length;
  const cy = plan.reduce((s, p) => s + p[1], 0) / plan.length;
  return solid(faces, col, [cx, cy, (z0 + z1) / 2], o);
}

/** Körper mit schrägen Seiten (Turm, Kabine): Grundriss lo in Höhe z0, kleinerer Grundriss hi in z1, gleich viele Ecken. */
function loft(lo, hi, z0, z1, col, o) {
  const A = lo.map(([x, y]) => [x, y, z0]);
  const B = hi.map(([x, y]) => [x, y, z1]);
  const faces = [B, A.slice().reverse()];
  for (let i = 0; i < A.length; i++) faces.push([A[i], A[(i + 1) % A.length], B[(i + 1) % A.length], B[i]]);
  const all = [...A, ...B];
  const c = [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length);
  return solid(faces, col, c, o);
}

const sub3 =(a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Zylinder oder Kegelstumpf von p0 nach p1 (Radien r0 → r1, n Kanten; n = 4 gibt einen Vierkant, z. B. für Arme und Ausleger). */
function cyl(p0, p1, r0, r1, n, col, o) {
  const ax = norm3(sub3(p1, p0));
  const t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm3(cross3(ax, t));
  const w = cross3(ax, u);
  const ring = (p, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + 0.5) / n) * TAU;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      return [p[0] + u[0] * c + w[0] * s, p[1] + u[1] * c + w[1] * s, p[2] + u[2] * c + w[2] * s];
    });
  const A = ring(p0, r0);
  const B = ring(p1, r1);
  const faces = [A.slice().reverse(), B];
  for (let i = 0; i < n; i++) faces.push([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]]);
  return solid(faces, col, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], { smooth: n >= 6, ...o });
}

/** Ellipsoid um c mit Halbachsen rx, ry, rz; zHalf: nur die obere Hälfte (Helm, Kuppel). */
function ball(c, rx, ry, rz, col, o = {}) {
  const n = o.n ?? 10;
  const m = o.m ?? 6;
  const top = o.half ? Math.PI / 2 : Math.PI;
  const P = (i, j) => {
    const th = (i / m) * top;
    const ph = (j / n) * TAU;
    return [c[0] + Math.sin(th) * Math.cos(ph) * rx, c[1] + Math.sin(th) * Math.sin(ph) * ry, c[2] + Math.cos(th) * rz];
  };
  const faces = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) faces.push(i === 0 ? [P(0, 0), P(1, j + 1), P(1, j)] : [P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
  if (o.half) faces.push(Array.from({ length: n }, (_, j) => P(m, n - j)));
  return solid(faces, col, o.half ? [c[0], c[1], c[2] + rz * 0.4] : c, { smooth: true, ...o });
}

/** Aufgesetztes Teil (Luke, Gitter, Tarnfleck, Scheibe): wird immer direkt nach seinem Träger gemalt. */
const on = (parent, s) => ((s.on = parent), s);
const fine = (s) => ((s.fine = true), s);

// ---------- Bauteile ----------

/**
 * Kettenlaufwerk einer Seite (side −1 links, +1 rechts): Kette mit runden Enden und Laufrollen. Kette und untere Wanne liegen
 * unter der oberen Wanne und werden zuerst gemalt (under), damit die Wanne sie richtig verdeckt. o.skirt = [x0, x1]: Kettenschürze
 * in Feldern von o.fender (Wannenkante) bis außen, mit Tarnflecken.
 */
function tracks(S, side, x0, x1, yIn, yOut, h, P, o = {}) {
  const ya = side < 0 ? -yOut : yIn;
  const yb = side < 0 ? -yIn : yOut;
  const r = h / 2;
  const prof = [[x0 + r, 0], [x1 - r, 0], [x1, r], [x1 - r * 0.6, h], [x0 + r * 0.6, h], [x0, r]];
  const tr = prX(prof, ya, yb, TRACK, { under: true });
  S.push(tr);
  const yo = side < 0 ? -yOut : yOut;
  const n = o.wheels ?? 5;
  for (let i = 0; i < n; i++) {
    const x = x0 + r + ((x1 - x0 - 2 * r) * i) / (n - 1);
    S.push(fine(on(tr, cyl([x, yo, r * 0.92], [x, yo + side * 0.25, r * 0.92], r * 0.72, r * 0.72, 8, HUB, { only: 'iso' }))));
  }
  if (!o.skirt) return tr;
  const [s0, s1] = o.skirt;
  const f = o.fender ?? yOut - 0.6;
  const ya2 = side < 0 ? -yOut - 0.45 : f;
  const yb2 = side < 0 ? -f : yOut + 0.45;
  const z0 = h * 0.42;
  const z1 = h + 0.4;
  const sk = box(s0, s1, ya2, yb2, z0, z1, mix(P.body, P.dark, 0.45), { only: 'iso' });
  S.push(sk);
  const yl = side < 0 ? ya2 - 0.08 : yb2;
  const seg = Math.max(2, Math.round((s1 - s0) / 4.6));
  const line = mix(P.dark, '#000000', 0.3);
  for (let i = 1; i < seg; i++) {
    const x = s0 + ((s1 - s0) * i) / seg;
    S.push(fine(on(sk, box(x - 0.13, x + 0.13, yl, yl + 0.08, z0, z1, line, { noLine: true, only: 'iso' }))));
  }
  const L = s1 - s0;
  const spots = side < 0 ? [[0.12, 0.2, 0.5], [0.58, 0.16, 0.62]] : [[0.3, 0.22, 0.58], [0.72, 0.14, 0.48]];
  for (const [a, w, t] of spots) {
    const zz = z0 + (z1 - z0) * t;
    S.push(fine(on(sk, box(s0 + L * a, s0 + L * (a + w), yl, yl + 0.08, zz - 1, Math.min(z1, zz + 1.1), P.camo, { noLine: true, only: 'iso' }))));
  }
  return tr;
}

/** Untere Wanne zwischen den Ketten (Bug- und Heckplatte schräg), wird mit den Ketten zuerst gemalt. */
const lowerHull = (x0, x1, half, top, P) => prX([[x0 + 0.8, 2], [x0, top], [x1, top], [x1 - 1.6, 2]], -half, half, P.dark, { under: true });

/** Rad mit Achse quer (y), Mitte (x, y, z). */
const wheel = (x, y, z, r, w, side) => cyl([x, y, z], [x, y + side * w, z], r, r, 10, WHEEL);

/** Tarnflecken (aufgesetzt) auf eine waagrechte Fläche in Höhe z. */
function camo(S, parent, spots, z, col) {
  for (const [x, y, w, h] of spots) S.push(fine(on(parent, box(x, x + w, y, y + h, z, z + 0.15, col, { noLine: true }))));
}

/** Tarnflecken an beiden Seitenwänden (y = ±half, nur Iso); spots = [x, Länge, z0, z1], links gespiegelt (anderes Muster). */
function camoSides(S, parent, half, spots, col) {
  for (const [x, w, z0, z1] of spots) {
    S.push(fine(on(parent, box(x, x + w, half, half + 0.12, z0, z1, col, { noLine: true, only: 'iso' }))));
    S.push(fine(on(parent, box(-x - w, -x, -half - 0.12, -half, z0, z1, col, { noLine: true, only: 'iso' }))));
  }
}

/** Scheinwerfer vorn (Paar) und Rücklichter hinten. */
function lights(S, parent, xf, half, zf, xr, zr) {
  for (const side of [-1, 1]) {
    S.push(on(parent, box(xf - 1.3, xf, side * half - 0.7, side * half + 0.7, zf, zf + 0.8, '#ddd5a4', { only: 'iso' })));
    S.push(fine(on(parent, box(xr - 0.25, xr, side * half - 0.5, side * half + 0.5, zr, zr + 0.55, '#a3302b', { noLine: true, only: 'iso' }))));
  }
}

/** Funkantenne mit Wimpel in Teamfarbe. */
function antenna(T, parent, x, y, z0, z1, P) {
  T.push(on(parent, cyl([x, y, z0], [x, y, z1], 0.2, 0.16, 4, '#1b1d1f')));
  T.push(on(parent, box(x, x + 2.7, y - 0.1, y + 0.1, z1 - 2, z1, P.mark, { noLine: true })));
}

export { K, TAU, TEAM_PAINT, DISPLAY, NEUTRAL, WHEEL, METAL, GUN, GLASS, YELLOW, SKIN, OLIVE, BOOT, WHITE, solid, box, prX, prY, prZ, loft, norm3, cyl, ball, on, fine, tracks, lowerHull, wheel, camo, camoSides, lights, antenna };
