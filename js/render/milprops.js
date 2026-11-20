// Militärische Props der Karte (Werte js/data/props.js, Gruppe „mil“): Kacheln (Sandsackwall, Hesco-Barriere, Jersey-Sperre,
// Stacheldrahtrolle, Tschechenigel) über fences.js, Einzelstücke (Sandsack-Stellung, Tarnnetz, Zelt, Funkmast, Munitionskisten,
// Treibstofftank, Kontrollpunkt, Schranke) hier. Modell in Welt-Pixeln um die Mitte, x entlang der Länge, y in die Tiefe, z nach oben;
// Silhouette aus wenigen Körpern, Kleinteile mit fine(). Fahnen in der Farbe, die mapprops.js übergibt. Nur Darstellung.
import { PAINT } from './unitpaint.js';
import { addLineKinds, rnd, tilt, snowy } from './fences.js';

const { solid, box, cyl, prY, prZ, on, fine, mix } = PAINT;
const TAU = Math.PI * 2;
const HALF = 16;

const JUTE = ['#b9a477', '#ae9a6c', '#c2ae80']; // Sandsäcke (wie die Ausbauten der Häuser, stronghold.js)
const OLIVE = ['#5f6642', '#566040', '#68694a'];
const SAND = '#c9b88f';
const STEEL = '#6f7477';
const RUST = '#5c4a3b';
const DARK = '#2e3134';

/** Körper verschieben (dx, dy, dz). */
function move(S, dx, dy, dz = 0) {
  const M = (p) => [p[0] + dx, p[1] + dy, p[2] + dz];
  for (const so of S) {
    so.faces = so.faces.map((f) => f.map(M));
    so.c = M(so.c);
  }
  return S;
}

/** Körper um die Hochachse drehen (Winkel a) um (0, 0). */
function spin(S, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  for (const so of S) {
    so.faces = so.faces.map((f) => f.map(R));
    so.c = R(so.c);
  }
  return S;
}

/** Fahnenmast bei (x, y) mit Tuch in der Farbe col (null: ohne Tuch), Höhe h. */
function flagPole(x, y, h, col, w) {
  const S = [cyl([x, y, 0], [x, y, h], 0.35, 0.3, 5, '#9a9fa2', snowy(w))];
  if (col) S.push(prZ([[x + 0.3, y - 0.12], [x + 7, y - 0.12], [x + 7, y + 0.12], [x + 0.3, y + 0.12]], h - 4.6, h - 0.4, col, { noLine: true }));
  return S;
}

// ---------- Kacheln ----------

/** Sandsackwall: Körper in Dammform, oben eine Lage einzelner Säcke, Nähte fein. */
const SANDBAG = {
  h: 7.5,
  arm(v, w, d) {
    const c = JUTE[v % JUTE.length];
    const body = prY([[-3.4, 0], [-2.7, 5.4], [2.7, 5.4], [3.4, 0]], 0, HALF, c);
    const S = [body];
    for (let t = 0, k = 0; t < HALF - 0.5; k++) {
      const l = Math.min(HALF - t, 4.6 + rnd(d, k) * 0.8);
      const sc = mix(c, k % 2 ? '#ffffff' : '#000000', 0.05 + rnd(d, k + 9) * 0.05);
      S.push(on(body, box(t + 0.15, t + l - 0.15, -2.6, 2.6, 5.4, 7.2 - rnd(d, k + 3) * 0.4, sc, snowy(w))));
      t += l;
    }
    for (const z of [1.8, 3.6]) for (const s of [-1, 1]) S.push(fine(on(body, box(0, HALF, s * (3.3 - z * 0.13) - 0.05, s * (3.3 - z * 0.13) + 0.05, z - 0.08, z + 0.08, mix(c, '#000000', 0.25), { noLine: true }))));
    return S;
  },
  mid(v, w) {
    const c = JUTE[v % JUTE.length];
    const body = prZ([[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]], 0, 5.4, c);
    return [body, on(body, box(-2.6, 2.6, -2.6, 2.6, 5.4, 7.1, mix(c, '#ffffff', 0.05), snowy(w)))];
  },
  rubble(v, d) {
    const c = JUTE[v % JUTE.length];
    const S = [prY([[-4.5, 0], [-3, 2], [3, 2.2], [4.5, 0]], 0, HALF, mix(c, '#000000', 0.08))];
    for (let k = 0; k < 5; k++) {
      const t = rnd(d, k) * (HALF - 4);
      const y = (rnd(d, k + 10) - 0.5) * 10;
      S.push(tilt(box(t, t + 4.4, y - 1.4, y + 1.4, 0, 1.8, mix(c, '#000000', rnd(d, k + 20) * 0.15)), 'y', (rnd(d, k + 30) - 0.5) * 0.5, t, y, 0));
    }
    return S;
  },
};

/** Hesco-Barriere: Körbe aus Drahtgitter und Vlies, mit Sand gefüllt; zwei Körbe je Arm. */
const HESCO = {
  h: 10.4,
  arm(v, w) {
    const c = mix(SAND, '#ffffff', 0.05 * (v % 3));
    const S = [];
    for (const [a, b] of [[0.1, 7.9], [8.1, 15.9]]) {
      const cell = box(a, b, -4, 4, 0, 10, c);
      S.push(cell, on(cell, box(a + 0.4, b - 0.4, -3.6, 3.6, 10, 10.25, '#b09a6c', snowy(w)))); // Sand oben
      for (const t of [a + 2, a + 4, a + 6]) for (const s of [-1, 1]) S.push(fine(on(cell, box(t - 0.06, t + 0.06, s * 4 - 0.05, s * 4 + 0.05, 0, 10, '#7a7466', { noLine: true })))); // Gitter senkrecht
      for (const z of [2.5, 5, 7.5]) for (const s of [-1, 1]) S.push(fine(on(cell, box(a, b, s * 4 - 0.05, s * 4 + 0.05, z - 0.06, z + 0.06, '#7a7466', { noLine: true })))); // waagrecht
    }
    return S;
  },
  mid(v, w) {
    const c = mix(SAND, '#ffffff', 0.05 * (v % 3));
    const cell = box(-4, 4, -4, 4, 0, 10, c);
    return [cell, on(cell, box(-3.6, 3.6, -3.6, 3.6, 10, 10.25, '#b09a6c', snowy(w)))];
  },
  rubble(v, d) {
    const S = [prY([[-6, 0], [-3.5, 3 + rnd(d, 1) * 1.5], [3, 3.4 + rnd(d, 2)], [6, 0]], 0, HALF, '#b9a47c', { vary: 0.15 })];
    for (let k = 0; k < 3; k++) {
      const t = 2 + k * 5 + rnd(d, k) * 2;
      S.push(fine(tilt(box(t, t + 4, -4.2, -4, 0, 5, '#7a7466', { noLine: true }), 'x', -0.6 - rnd(d, k + 5) * 0.5, t, -4, 0))); // zerrissenes Gitter
    }
    return S;
  },
};

/** Jersey-Sperre: Betonelemente im typischen Profil, zwei je Kachel, manche rot-weiß bemalt. */
const JERSEY_PROF = [[-3, 0], [-3, 0.7], [-1.7, 1.9], [-0.8, 5.6], [0.8, 5.6], [1.7, 1.9], [3, 0.7], [3, 0]];
const JERSEY = {
  h: 5.6,
  arm(v, w, d) {
    const c = ['#c4c0b6', '#b9b5ab', '#cfcbc0'][v % 3];
    const S = [];
    for (const [a, b] of [[0.2, 7.8], [8.2, 15.8]]) {
      const el = prY(JERSEY_PROF, a, b, c, snowy(w));
      S.push(el);
      if (v === 2) for (const s of [-1, 1]) S.push(fine(on(el, prY([[s * 1.15, 3.2], [s * 1.25, 4.4], [s * 1.33, 4.4], [s * 1.23, 3.2]], a + 0.3, b - 0.3, '#c43b33', { noLine: true })))); // Warnstreifen
      if (d % 3 === 0) S.push(fine(on(el, box(a + 1, a + 3.2, -3.05, -2.95, 0.2, 0.7, '#4c5a3a', { noLine: true })))); // Moos unten
    }
    return S;
  },
  mid(v, w) {
    return [prY(JERSEY_PROF, -1.5, 1.5, ['#c4c0b6', '#b9b5ab', '#cfcbc0'][v % 3], snowy(w))];
  },
  rubble(v, d) {
    const c = ['#c4c0b6', '#b9b5ab', '#cfcbc0'][v % 3];
    const S = [];
    for (let k = 0; k < 4; k++) {
      const t = rnd(d, k) * (HALF - 4);
      const y = (rnd(d, k + 10) - 0.5) * 8;
      S.push(tilt(box(t, t + 3 + rnd(d, k + 20) * 2, y - 1.5, y + 1.5, 0, 1.4 + rnd(d, k + 30) * 1.4, mix(c, '#000000', rnd(d, k + 40) * 0.2), { vary: 0.2 }), 'y', (rnd(d, k + 50) - 0.5) * 0.7, t, y, 0));
    }
    return S;
  },
};

/** Stacheldrahtrolle (Concertina): weite Schraube aus Draht, weit weg nur als dunkler Hauch; Pflöcke an den Enden. */
const COIL_R = 4.2;
const COIL = {
  h: 8.4,
  arm(v, w, d) {
    const S = [box(0, HALF, -COIL_R, COIL_R, 0.2, COIL_R * 2, '#3b3e40', { alpha: 0.18, noLine: true })];
    const N = 10; // Abschnitte je Windung
    const pitch = 2;
    let prev = null;
    for (let k = 0; k <= (HALF / pitch) * N; k++) {
      const a = (k / N) * TAU + d;
      const p = [(k / N) * pitch, Math.cos(a) * COIL_R, COIL_R + Math.sin(a) * COIL_R];
      if (prev) S.push(fine(cyl(prev, p, 0.13, 0.13, 3, '#4f5356', { noLine: true })));
      prev = p;
    }
    S.push(cyl([POST, -COIL_R - 0.5, 0], [POST, -COIL_R - 0.5, 9], 0.3, 0.25, 4, RUST, snowy(w))); // Pflock
    return S;
  },
  mid() {
    return [];
  },
  rubble: null,
};
const POST = 12;

/** Tschechenigel: drei gekreuzte Stahlträger, auf drei Enden stehend; je Kachel einer, gedreht nach Variante. */
const HOG_AXES = (() => {
  // Achsen eines Würfels, so gedreht, dass die Raumdiagonale senkrecht steht
  const n = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const e1 = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const to = (a) => [a[0] * e1[0] + a[1] * e1[1] + a[2] * e1[2], a[0] * e2[0] + a[1] * e2[1] + a[2] * e2[2], a[0] * n[0] + a[1] * n[1] + a[2] * n[2]];
  return [to([1, 0, 0]), to([0, 1, 0]), to([0, 0, 1])];
})();
const HOG_L = 7.5;
const HEDGEHOG = {
  h: 10,
  solo: true, // keine Arme: je Zelle ein Igel
  mid(v, w, d) {
    const zc = HOG_L * Math.max(...HOG_AXES.map((a) => Math.abs(a[2])));
    const col = ['#7a5f48', '#6c6258', '#7d6a55'][v % 3];
    const S = HOG_AXES.map((a) => cyl([-a[0] * HOG_L, -a[1] * HOG_L, zc - a[2] * HOG_L], [a[0] * HOG_L, a[1] * HOG_L, zc + a[2] * HOG_L], 1.25, 1.25, 4, col, snowy(w)));
    return spin(S, (d % 8) * (TAU / 16));
  },
  arm() {
    return [];
  },
  rubble: null,
};

addLineKinds({ sandbag: SANDBAG, hesco: HESCO, jersey: JERSEY, wire_coil: COIL, hedgehog: HEDGEHOG });

// ---------- Einzelstücke ----------

/** Sandsack-Stellung: Halbkreis aus Säcken, offen nach hinten (−x). */
function nest(v, d, w, rubble) {
  const c = JUTE[v % JUTE.length];
  const S = [];
  const R1 = 19;
  const R0 = 13;
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a0 = -Math.PI / 2 + (k / n) * Math.PI;
    const a1 = -Math.PI / 2 + ((k + 1) / n) * Math.PI;
    const P = (r, a) => [Math.cos(a) * r - 6, Math.sin(a) * r];
    const plan = [P(R0, a0), P(R1, a0), P(R1, a1), P(R0, a1)];
    if (rubble) {
      if (rnd(d, k) < 0.5) S.push(prZ(plan, 0, 1.5 + rnd(d, k + 9) * 1.5, mix(c, '#000000', 0.1)));
      continue;
    }
    const seg = prZ(plan, 0, 5.6, mix(c, '#000000', (k % 2) * 0.04));
    S.push(seg);
    const am = (a0 + a1) / 2;
    const Q = (r, a) => [Math.cos(a) * r - 6, Math.sin(a) * r];
    S.push(on(seg, prZ([Q(R0 + 0.6, a0 + 0.03), Q(R1 - 0.6, a0 + 0.03), Q(R1 - 0.6, a1 - 0.03), Q(R0 + 0.6, a1 - 0.03)], 5.6, 7.2 - rnd(d, k) * 0.4, mix(c, '#ffffff', 0.06), snowy(w))));
    S.push(fine(on(seg, prZ([Q(R1, am - 0.02), Q(R1 + 0.05, am - 0.02), Q(R1 + 0.05, am + 0.02), Q(R1, am + 0.02)], 0.5, 5.4, mix(c, '#000000', 0.3), { noLine: true }))));
  }
  return S;
}

/** Tarnnetz über Stangen: Netz als Zeltdach mit Spitze, Ränder hängen tief; Flecken fein. */
function camoNet(v, d, w) {
  const c = OLIVE[v % OLIVE.length];
  const S = [];
  const X = 38;
  const Y = 25;
  for (const [x, y] of [[-X + 4, -Y + 4], [X - 4, -Y + 4], [X - 4, Y - 4], [-X + 4, Y - 4]]) S.push(cyl([x, y, 0], [x, y, 9.5], 0.4, 0.35, 4, '#6b5a43'));
  S.push(cyl([0, 0, 0], [0, 0, 13], 0.5, 0.45, 4, '#6b5a43'));
  const top = [0, 0, 13.2];
  const rim = [[-X, -Y, 5.5], [0, -Y - 2, 8], [X, -Y, 5.5], [X + 2, 0, 8], [X, Y, 5.5], [0, Y + 2, 8], [-X, Y, 5.5], [-X - 2, 0, 8]];
  const o = { alpha: 0.88, noLine: true, ...snowy(w) };
  for (let k = 0; k < rim.length; k++) {
    const a = rim[k];
    const b = rim[(k + 1) % rim.length];
    // dünne Fläche (zwei Seiten), damit der Painter eine Mitte und eine Richtung hat
    const f = [top, a, b];
    S.push(solid([f, f.slice().reverse()], mix(c, '#000000', (k % 2) * 0.08), [(top[0] + a[0] + b[0]) / 3, (top[1] + a[1] + b[1]) / 3, (top[2] + a[2] + b[2]) / 3 - 0.5], o));
  }
  for (let k = 0; k < 10; k++) {
    const x = (rnd(d, k) - 0.5) * 58;
    const y = (rnd(d, k + 20) - 0.5) * 36;
    const z = 13 - (Math.abs(x) / X + Math.abs(y) / Y) * 3.5 + 0.3;
    S.push(fine(box(x - 2.5, x + 2.5, y - 1.8, y + 1.8, z, z + 0.4, ['#4a5534', '#7a7a4e', '#3e4630'][k % 3], { noLine: true, ...snowy(w) })));
  }
  return S;
}

/** Zelt: Firstzelt mit Wänden, Eingang an +x, Abspannleinen fein, Fahne vorn. */
function tent(v, d, w, rubble, flag) {
  const c = OLIVE[(v + 1) % OLIVE.length];
  if (rubble) return [prY([[-15, 0], [-12, 2.5], [4, 4], [14, 1.5], [15, 0]], -22, 22, mix(c, '#000000', 0.15), snowy(w))];
  const body = prY([[-15, 0], [-15, 4.5], [0, 13], [15, 4.5], [15, 0]], -22, 22, c, snowy(w));
  const S = [body];
  S.push(on(body, prY([[-4, 0], [-4, 6], [0, 8.6], [4, 6], [4, 0]], 22, 22.3, mix(c, '#000000', 0.25), { noLine: true }))); // Eingang
  for (const x of [-15, 0, 15]) for (const s of [-1, 1]) S.push(fine(cyl([x, s * 15, 4.5], [x, s * 21, 0], 0.08, 0.08, 3, '#d8d2bd', { noLine: true })));
  S.push(...flagPole(26, -10, 22, flag, w));
  return S;
}

/** Funkmast: Gittermast aus drei Beinen mit Streben, Antennen oben, Gerätekasten unten; umgestürzt liegt er am Boden. */
function radioMast(v, d, w, rubble, flag) {
  const H = 64;
  const legs = [0, 1, 2].map((k) => (k / 3) * TAU + 0.3);
  const S = [box(-4, 4, -10, -4, 0, 5, '#5d6458', snowy(w))]; // Gerätekasten
  if (rubble) {
    // umgestürzt nach +x: liegende Beine, Spitze am Boden
    for (const a of legs) S.push(cyl([2, Math.sin(a) * 4, 1 + Math.cos(a) * 1.5], [H * 0.8, Math.sin(a) * 1.2, 0.8], 0.4, 0.3, 4, STEEL));
    return S;
  }
  const at = (a, z) => {
    const r = 4.2 - (z / H) * 3;
    return [Math.cos(a) * r, Math.sin(a) * r, z];
  };
  for (const a of legs) S.push(cyl(at(a, 0), at(a, H), 0.45, 0.3, 4, STEEL));
  for (let z = 6; z < H; z += 6) {
    for (let k = 0; k < 3; k++) S.push(fine(cyl(at(legs[k], z), at(legs[(k + 1) % 3], z + 6), 0.12, 0.12, 3, STEEL, { noLine: true })));
  }
  S.push(cyl([0, 0, H], [0, 0, H + 9], 0.25, 0.15, 4, DARK)); // Antenne
  S.push(box(1.2, 1.6, -2, 2, H - 8, H - 2, '#d8dad6')); // Richtfunk
  for (const a of legs) S.push(fine(cyl(at(a, H * 0.7), [Math.cos(a) * 26, Math.sin(a) * 26, 0], 0.06, 0.06, 3, '#8a8d8f', { noLine: true }))); // Abspannseile
  S.push(...flagPole(-6, 6, 14, flag, w));
  return S;
}

/** Munitionskisten auf Paletten, gestapelt; Anordnung je Variante. */
function ammo(v, d, w) {
  const S = [box(-13, 13, -9, 9, 0, 1.4, '#8a7458')]; // Palette
  const layout = [
    [[-12, -1, -8, 0], [1, 12, -8, 0], [-12, -1, 0.5, 8.5], [1, 12, 0.5, 8.5]],
    [[-12, -1, -8, 0], [1, 12, -8, 0], [-12, -1, 0.5, 8.5]],
    [[-12, 12, -8, 0], [-12, 12, 0.5, 8.5]],
  ][d % 3];
  const col = OLIVE[v % OLIVE.length];
  const levels = 2 + (d % 2);
  for (let l = 0; l < levels; l++) {
    for (const [x0, x1, y0, y1] of layout.slice(0, l === levels - 1 ? Math.max(1, layout.length - 1 - (d % 2)) : layout.length)) {
      const z = 1.4 + l * 4.4;
      const b = box(x0, x1, y0, y1, z, z + 4.2, mix(col, '#000000', ((x0 + y0 + l) % 3) * 0.04), snowy(w));
      S.push(b);
      S.push(fine(on(b, box(x0 + 1.5, x0 + 4.5, y1, y1 + 0.06, z + 1.2, z + 2.4, '#d9c25a', { noLine: true })))); // Schablonenschrift
    }
  }
  return S;
}

/** Treibstofftank: liegender Zylinder auf zwei Betonsätteln, Leiter und Domdeckel; ausgebrannt dunkel und eingesackt. */
function fuelTank(v, d, w, rubble) {
  const col = rubble ? '#3a3632' : ['#5e6645', '#d9dbd5', '#6f6a5c'][v % 3];
  const S = [];
  for (const x of [-18, 18]) S.push(box(x - 3, x + 3, -9, 9, 0, 4, '#a9a59a'));
  const R = 10;
  const tank = cyl([-28, 0, R + 2.5], [28, 0, R + 2.5 - (rubble ? 2 : 0)], R, rubble ? R * 0.85 : R, 16, col, { smooth: true, ...snowy(w) });
  S.push(tank);
  if (!rubble) {
    S.push(on(tank, cyl([4, 0, 2 * R + 2.4], [4, 0, 2 * R + 4], 2.2, 2.2, 10, mix(col, '#000000', 0.2), snowy(w)))); // Dom
    for (let z = 3; z < 2 * R + 2; z += 2) S.push(fine(box(-24.5, -23.5, R + 0.4, R + 0.7, z, z + 0.3, '#3d4144', { noLine: true }))); // Leiter
    S.push(fine(on(tank, box(-6, 6, -R - 0.05, -R + 0.05, R - 1, R + 6, '#e8c83a', { noLine: true })))); // Gefahrschild
  }
  return S;
}

/** Kontrollpunkt: Häuschen mit Fensterband und Flachdach, Sandsäcke vorn, Fahne; zerstört bleiben Mauerreste. */
function checkpoint(v, d, w, rubble, flag) {
  const c = ['#c9c4b4', '#bfc3b8', '#cfc6ae'][v % 3];
  if (rubble) {
    const S = [];
    for (let k = 0; k < 6; k++) {
      const t = (rnd(d, k) - 0.5) * 26;
      const y = (rnd(d, k + 10) - 0.5) * 26;
      S.push(tilt(box(t - 3, t + 3, y - 2, y + 2, 0, 2 + rnd(d, k + 20) * 4, mix(c, '#000000', rnd(d, k + 30) * 0.25), { vary: 0.2 }), 'x', (rnd(d, k + 40) - 0.5) * 0.6, t, y, 0));
    }
    return S;
  }
  const body = box(-12, 12, -12, 12, 0, 15, c);
  const S = [body];
  for (const s of [-1, 1]) {
    S.push(fine(on(body, box(-9, 9, s * 12 - 0.06, s * 12 + 0.06, 7.5, 11.5, '#36485a', { noLine: true })))); // Fenster
    S.push(fine(on(body, box(s * 12 - 0.06, s * 12 + 0.06, -9, 9, 7.5, 11.5, '#36485a', { noLine: true }))));
  }
  S.push(on(body, box(-14, 14, -14, 14, 15, 16.6, mix(c, '#000000', 0.25), snowy(w)))); // Dach
  const bag = box(14.5, 19.5, -12, 12, 0, 7, JUTE[0], snowy(w)); // Sandsäcke vor der Tür
  S.push(bag);
  S.push(...flagPole(-17, -17, 26, flag, w));
  return S;
}

/** Schranke: Pfosten mit Gegengewicht, rot-weißer Baum, Auflage; offen steht der Baum senkrecht. */
function boomGate(v, d, w, open) {
  const S = [box(-31, -27, -2, 2, 0, 8, '#4b5054', snowy(w)), box(-34, -30.5, -1.5, 1.5, 5, 8, '#3a3d40')]; // Pfosten, Gegengewicht
  S.push(box(29, 31, -0.8, 0.8, 0, 5.5, '#4b5054')); // Auflage
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = -28 + (k * 58) / n;
    const b = -28 + ((k + 1) * 58) / n;
    const col = k % 2 ? '#e9e6dd' : '#c63a31';
    S.push(open ? box(-29.6, -28.4, -0.6, 0.6, 7 + (a + 28), 7 + (b + 28), col) : box(a, b, -0.6, 0.6, 6.4, 7.6, col, snowy(w)));
  }
  return S;
}

const SINGLE = {
  sandbag_nest: (v, d, w, rubble) => nest(v, d, w, rubble),
  camo_net: (v, d, w) => camoNet(v, d, w),
  tent: (v, d, w, rubble, flag) => tent(v, d, w, rubble, flag),
  radio_mast: (v, d, w, rubble, flag) => radioMast(v, d, w, rubble, flag),
  ammo_stack: (v, d, w) => ammo(v, d, w),
  fuel_tank: (v, d, w, rubble) => fuelTank(v, d, w, rubble),
  checkpoint: (v, d, w, rubble, flag) => checkpoint(v, d, w, rubble, flag),
  boom_gate: (v, d, w, rubble, flag, open) => boomGate(v, d, w, open),
};

/** Gibt es ein Einzelstück-Modell für diese Art? */
export const isMilSingle = (kind) => !!SINGLE[kind];

/**
 * Körper eines Einzelstücks in Modellrichtung (x entlang der Länge). rubble: Trümmer, flag: Farbe des Tuchs oder null,
 * open: Schranke offen. v: Farbvariante, d: Einzelheiten, w: Winter.
 */
export function milModel(kind, v, d, w, rubble, flag, open) {
  const f = SINGLE[kind];
  return f ? f(v, d, w, rubble, flag, open) : [];
}

export { move };
