// Zäune und Mauern als Kacheln (Props der Karte, Werte js/data/props.js): Holzzaun (Latten), Metallzaun (Sockel und Gitter wie die
// Hofmauer der Altbauten), Maschendraht mit Stacheldraht, Betonmauer, Bruchsteinmauer. Jede Kachel ist eine Rasterzelle (32 px):
// Mittelstück plus je ein Arm zu jeder verbundenen Nachbarzelle (Maske E 1, S 2, W 4, N 8), daraus entstehen Gerade, Ecke, T-Stück,
// Kreuz und Ende von selbst. Tore (zu, offen) ersetzen die Kachel durch zwei Flügel zwischen Torpfosten; Trümmer sind niedrige
// Haufen entlang der Linie. Modell in Welt-Pixeln: x nach Osten, y nach Süden, z nach oben; Mitte der Zelle = Ursprung. Silhouette
// aus wenigen Körpern, Kleinteile (Latten, Stäbe, Steine) mit fine(): weit herausgezoomt fallen sie weg. Winter: Schnee auf Oberkanten.
// Nur Darstellung; gemalt und zwischengespeichert in mapprops.js.
import { PAINT } from './unitpaint.js';
import { hashXY } from './color.js';

const { box, cyl, on, fine, mix } = PAINT;

const HALF = 16; // halbe Kachel (px)
const POST_AT = 32 / 3; // Pfosten gleichmäßig: Mitte und ± ein Drittel der Kachel
const SNOW = '#eef2f4';
export const LINE_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // Bits 1, 2, 4, 8: Osten, Süden, Westen, Norden

/** Zufallszahl 0 … 1 aus Variante und Zähler (fest je Kachel, kein Zufall zur Laufzeit). */
const rnd = (v, k) => (hashXY(v * 131 + k, k * 7 + 3) % 1000) / 1000;

/**
 * Arm in Richtung q (0 Osten, 1 Süden, 2 Westen, 3 Norden) aus dem Arm nach Osten: gespiegelt statt gedreht, damit Latten, Riegel
 * und Ausleger einer Linie immer auf derselben Seite liegen (Osten/Westen: Seite +y; Süden/Norden: Seite +x).
 */
const ORIENT = [(x, y) => [x, y], (x, y) => [y, x], (x, y) => [-x, y], (x, y) => [y, -x]];
function turn(solids, q) {
  if (!q) return solids;
  const R = (p) => [...ORIENT[q](p[0], p[1]), p[2]];
  for (const so of solids) {
    so.faces = so.faces.map((f) => f.map(R));
    so.c = R(so.c);
  }
  return solids;
}

/** Körper um die Achse entlang x (ax 'x') bzw. y durch den Punkt (0, 0, z0) bzw. um z0 gekippt (Bruchplatten der Trümmer). */
function tilt(so, ax, a, px, py, pz) {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const R = (p) => {
    const x = p[0] - px;
    const y = p[1] - py;
    const z = p[2] - pz;
    return ax === 'x' ? [px + x, py + y * c - z * sn, pz + y * sn + z * c] : [px + x * c - z * sn, py + y, pz + x * sn + z * c];
  };
  so.faces = so.faces.map((f) => f.map(R));
  so.c = R(so.c);
  return so;
}

/** Schnee auf waagrechten Oberseiten (Winter). */
const snowy = (w) => (w ? { top: { col: SNOW, at: 0.6 } } : {});

// ---------- Arten ----------
// Je Art: arm(v, w) baut einen Arm entlang +x von 0 bis HALF, mid(v, w) das Mittelstück, gate(v, w) die Torpfosten bei ±GATE_AT
// und leaf(v, len) einen Torflügel entlang +x ab dem Scharnier, rubble(v, d) Trümmer eines Arms. v: Farbvariante (je Gebiet gleich),
// d: Einzelheiten (je Kachel und Arm verschieden: Steine, Trümmer, fehlende Latte), w: Winter.

const GATE_AT = 13.6; // Torpfosten (px von der Mitte)

const WOOD_COLS = ['#9a7448', '#8a6c4c', '#958a78']; // frisch, dunkel, verwittert grau
const WOOD = {
  h: 9,
  arm(v, w, d) {
    const c = WOOD_COLS[v % WOOD_COLS.length];
    const S = [box(POST_AT - 0.65, POST_AT + 0.65, -0.65, 0.65, 0, 9.4, mix(c, '#000000', 0.12), snowy(w))];
    for (const z of [2.2, 6.6]) S.push(box(0, HALF, 0.65, 1.15, z, z + 1, c, snowy(w))); // Querlatten (Riegel)
    for (let t = 1; t < HALF; t += 2) {
      if (d % 4 === 3 && Math.abs(t - 7) < 1) continue; // hier und da fehlt eine Latte
      S.push(fine(box(t - 0.55, t + 0.55, 1.15, 1.5, 0.4, 8.4 + (t % 4 === 1 ? 0.3 : 0), mix(c, '#ffffff', 0.06), snowy(w))));
    }
    return S;
  },
  mid(v, w) {
    const c = WOOD_COLS[v % WOOD_COLS.length];
    return [box(-0.7, 0.7, -0.7, 0.7, 0, 9.6, mix(c, '#000000', 0.12), snowy(w))];
  },
  gate(v, w) {
    const c = mix(WOOD_COLS[v % WOOD_COLS.length], '#000000', 0.18);
    return [-1, 1].map((s) => box(s * GATE_AT - 0.9, s * GATE_AT + 0.9, -0.9, 0.9, 0, 10.6, c, snowy(w)));
  },
  leaf(v, len, w) {
    const c = WOOD_COLS[v % WOOD_COLS.length];
    const S = [box(0, len, -0.25, 0.25, 1.4, 2.3, c, snowy(w)), box(0, len, -0.25, 0.25, 6.8, 7.7, c, snowy(w))];
    for (let t = 0.8; t < len; t += 1.9) S.push(fine(box(t - 0.5, t + 0.5, 0.25, 0.55, 0.6, 8.2, mix(c, '#ffffff', 0.06), snowy(w))));
    return S;
  },
  rubble: null,
};

const STONE_BASE = ['#8f897c', '#988f80', '#857f74']; // wie die Hofmauer der Altbauten (maptown.js)
const IRON = '#2f3336';
const METAL = {
  h: 13,
  arm(v, w, d) {
    const st = STONE_BASE[v % STONE_BASE.length];
    const base = box(0, HALF, -1.6, 1.6, 0, 3.4, st);
    const S = [base, on(base, box(0, HALF, -1.9, 1.9, 3.4, 4.0, mix(st, '#ffffff', 0.15), snowy(w)))];
    S.push(box(0, HALF, -0.35, 0.35, 10.4, 11.1, IRON, snowy(w)), box(0, HALF, -0.3, 0.3, 6.6, 7.1, IRON)); // Ober- und Mittelholm
    for (let t = 0.8; t < HALF; t += 1.6) S.push(fine(box(t - 0.22, t + 0.22, -0.22, 0.22, 4, 11.9, IRON))); // Stäbe mit Spitzen
    return S;
  },
  mid(v, w) {
    const st = STONE_BASE[v % STONE_BASE.length];
    const p = box(-2.4, 2.4, -2.4, 2.4, 0, 12.6, st);
    return [p, on(p, box(-2.8, 2.8, -2.8, 2.8, 12.6, 13.5, mix(st, '#ffffff', 0.18), snowy(w)))];
  },
  gate(v, w) {
    const st = STONE_BASE[v % STONE_BASE.length];
    return [-1, 1].flatMap((s) => {
      const p = box(s * GATE_AT - 2.2, s * GATE_AT + 2.2, -2.2, 2.2, 0, 13.4, st);
      return [p, on(p, box(s * GATE_AT - 2.6, s * GATE_AT + 2.6, -2.6, 2.6, 13.4, 14.3, mix(st, '#ffffff', 0.18), snowy(w)))];
    });
  },
  leaf(v, len, w) {
    const S = [box(0, len, -0.3, 0.3, 0.8, 1.4, IRON), box(0, len, -0.3, 0.3, 10.6, 11.3, IRON, snowy(w)), box(0, 0.7, -0.3, 0.3, 0.8, 11.3, IRON)];
    for (let t = 1.4; t < len; t += 1.4) S.push(fine(box(t - 0.2, t + 0.2, -0.2, 0.2, 1.4, 12, IRON)));
    return S;
  },
  rubble(v, d) {
    const st = STONE_BASE[v % STONE_BASE.length];
    const S = [box(0, HALF, -1.6, 1.6, 0, 1.6 + rnd(d, 1), st)];
    for (let k = 0; k < 3; k++) {
      const t = 2 + k * 5 + rnd(d, k + 2) * 2;
      S.push(cyl([t, 0, 1.6], [t + 3 - rnd(d, k) * 6, 3 + rnd(d, k + 9) * 3, 4 + rnd(d, k + 4) * 5], 0.25, 0.25, 4, IRON)); // verbogene Stäbe
    }
    return S;
  },
};

const STEEL = '#7d8487';
const WIRE_C = '#5d6063';
const WIRE = {
  h: 16,
  arm(v, w, d) {
    const S = [cyl([POST_AT, 0, 0], [POST_AT, 0, 14.6], 0.55, 0.5, 6, STEEL, snowy(w))];
    S.push(cyl([POST_AT, 0, 14.2], [POST_AT, -2.7, 16.6], 0.3, 0.3, 4, STEEL)); // Ausleger nach außen
    S.push(box(0, HALF, -0.12, 0.12, 0.3, 13.2, mix(STEEL, '#ffffff', 0.25), { alpha: 0.32, noLine: true })); // Geflecht
    S.push(box(0, HALF, -0.2, 0.2, 13, 13.4, STEEL)); // Spanndraht oben
    for (let k = 0; k < 3; k++) S.push(box(0, HALF, -0.85 * (k + 1) - 0.12, -0.85 * (k + 1) + 0.12, 14.6 + k * 0.8, 14.85 + k * 0.8, WIRE_C)); // Stacheldraht
    for (let t = 1; t < HALF; t += 2.5) for (let k = 0; k < 3; k++) S.push(fine(box(t - 0.3, t + 0.3, -0.85 * (k + 1) - 0.3, -0.85 * (k + 1) + 0.3, 14.5 + k * 0.8, 15.0 + k * 0.8, WIRE_C))); // Stacheln
    for (let t = 2; t < HALF; t += 2) S.push(fine(box(t - 0.07, t + 0.07, -0.14, 0.14, 0.3, 13.2, STEEL, { noLine: true }))); // Maschen (senkrecht)
    return S;
  },
  mid(v, w) {
    return [cyl([0, 0, 0], [0, 0, 14.8], 0.7, 0.65, 6, STEEL, snowy(w)), cyl([0, 0, 14.4], [0, -2.7, 16.8], 0.32, 0.32, 4, STEEL)];
  },
  gate(v, w) {
    return [-1, 1].map((s) => cyl([s * GATE_AT, 0, 0], [s * GATE_AT, 0, 15.6], 1, 0.95, 8, STEEL, snowy(w)));
  },
  leaf(v, len, w) {
    return [
      box(0, len, -0.3, 0.3, 0.6, 1.2, STEEL), box(0, len, -0.3, 0.3, 12.2, 12.8, STEEL, snowy(w)),
      box(0, 0.6, -0.3, 0.3, 0.6, 12.8, STEEL), box(len - 0.6, len, -0.3, 0.3, 0.6, 12.8, STEEL),
      box(0.6, len - 0.6, -0.1, 0.1, 1.2, 12.2, mix(STEEL, '#ffffff', 0.25), { alpha: 0.32, noLine: true }),
    ];
  },
  rubble: null,
};

const CON_COLS = ['#b5b2a9', '#aaa79f', '#bcb8ad'];
const CONCRETE = {
  h: 17.4,
  arm(v, w, d) {
    const c = CON_COLS[v % CON_COLS.length];
    const body = box(0, HALF, -2, 2, 0, 16.6, c);
    const S = [box(0, HALF, -2.8, 2.8, 0, 1.2, mix(c, '#000000', 0.15)), body];
    S.push(on(body, box(0, HALF, -2.3, 2.3, 16.6, 17.4, mix(c, '#ffffff', 0.12), snowy(w)))); // Abdeckung
    for (const s of [-1, 1]) {
      S.push(fine(on(body, box(POST_AT - 0.2, POST_AT + 0.2, s * 2 - 0.06, s * 2 + 0.06, 1.2, 16.6, mix(c, '#000000', 0.3), { noLine: true })))); // Fuge
      if (d % 2 === 1) S.push(fine(on(body, box(0.5, 15.5, s * 2 - 0.05, s * 2 + 0.05, 1.2, 2.6, mix(c, '#4a5038', 0.18), { noLine: true })))); // Spritzwasser unten
    }
    return S;
  },
  mid(v, w) {
    const c = CON_COLS[v % CON_COLS.length];
    const body = box(-2, 2, -2, 2, 0, 16.6, c);
    return [box(-2.8, 2.8, -2.8, 2.8, 0, 1.2, mix(c, '#000000', 0.15)), body, on(body, box(-2.3, 2.3, -2.3, 2.3, 16.6, 17.4, mix(c, '#ffffff', 0.12), snowy(w)))];
  },
  gate(v, w) {
    const c = CON_COLS[v % CON_COLS.length];
    return [-1, 1].flatMap((s) => {
      const p = box(s * GATE_AT - 2.4, s * GATE_AT + 2.4, -2.4, 2.4, 0, 18, c);
      return [p, on(p, box(s * GATE_AT - 2.7, s * GATE_AT + 2.7, -2.7, 2.7, 18, 18.8, mix(c, '#ffffff', 0.12), snowy(w)))];
    });
  },
  leaf(v, len, w) {
    const sh = '#5d6468'; // Stahltor
    const S = [box(0, len, -0.35, 0.35, 0.5, 15.5, sh, snowy(w))];
    for (const z of [5, 10]) S.push(fine(box(0, len, 0.35, 0.55, z, z + 0.5, mix(sh, '#000000', 0.2))));
    return S;
  },
  rubble(v, d) {
    const c = CON_COLS[v % CON_COLS.length];
    // umgestürzte Wandplatten, schräg auf dem Schutt, dazu Brocken und Bewehrung
    const S = [box(0, HALF, -3.5, 3.5, 0, 1.6, mix(c, '#000000', 0.2), { vary: 0.2 })];
    const slab = box(1 + rnd(d, 1) * 2, 13 - rnd(d, 2) * 2, -1.6, 1.6, 0, 9 + rnd(d, 3) * 3, c);
    S.push(tilt(slab, 'x', (rnd(d, 4) > 0.5 ? 1 : -1) * (1.05 + rnd(d, 5) * 0.3), 0, 0, 0.4));
    for (let k = 0; k < 4; k++) {
      const t = rnd(d, k + 10) * (HALF - 3);
      const y = (rnd(d, k + 20) - 0.5) * 8;
      const h = 1 + rnd(d, k + 30) * 1.8;
      S.push(tilt(box(t, t + 1.8 + rnd(d, k) * 1.5, y - 1, y + 1, 0, h, mix(c, '#000000', rnd(d, k + 40) * 0.2)), 'y', (rnd(d, k + 50) - 0.5) * 0.6, t, y, 0));
    }
    for (let k = 0; k < 2; k++) {
      const t = 3 + k * 6 + rnd(d, k + 60) * 3;
      S.push(fine(cyl([t, 0, 1.5], [t + 2 - rnd(d, k + 70) * 4, (rnd(d, k + 80) - 0.5) * 4, 4 + rnd(d, k + 90) * 3], 0.2, 0.2, 4, '#6b4b3a'))); // Bewehrung
    }
    return S;
  },
};

const ROCK_COLS = ['#8d8578', '#837a6c', '#958e80'];
const STONE = {
  h: 9.4,
  arm(v, w, d) {
    const c = ROCK_COLS[v % ROCK_COLS.length];
    const body = box(0, HALF, -2.5, 2.5, 0, 7.6, c, { vary: 0.2 });
    const S = [body];
    for (let t = 0, k = 0; t < HALF - 0.5; k++) {
      const l = Math.min(HALF - t, 3.2 + rnd(d, k) * 1.6);
      S.push(on(body, box(t, t + l - 0.15, -2.75, 2.75, 7.6, 8.3 + rnd(d, k + 20) * 0.9, mix(c, '#ffffff', 0.1 + rnd(d, k + 40) * 0.08), snowy(w)))); // Decksteine
      t += l;
    }
    for (let k = 0; k < 7; k++) {
      const t = rnd(d, k + 60) * (HALF - 3);
      const z = 0.6 + rnd(d, k + 70) * 5.2;
      const s = k % 2 ? 1 : -1;
      S.push(fine(on(body, box(t, t + 2.2 + rnd(d, k + 80), s * 2.5 - 0.15, s * 2.5 + 0.15, z, z + 1.3, mix(c, k % 3 ? '#ffffff' : '#000000', 0.1), { noLine: true })))); // Steine
    }
    return S;
  },
  mid(v, w) {
    const c = ROCK_COLS[v % ROCK_COLS.length];
    const body = box(-2.5, 2.5, -2.5, 2.5, 0, 7.6, c, { vary: 0.2 });
    return [body, on(body, box(-2.75, 2.75, -2.75, 2.75, 7.6, 8.6, mix(c, '#ffffff', 0.12), snowy(w)))];
  },
  gate(v, w) {
    const c = ROCK_COLS[v % ROCK_COLS.length];
    return [-1, 1].flatMap((s) => {
      const p = box(s * GATE_AT - 2.4, s * GATE_AT + 2.4, -2.6, 2.6, 0, 10.4, c, { vary: 0.2 });
      return [p, on(p, box(s * GATE_AT - 2.7, s * GATE_AT + 2.7, -2.9, 2.9, 10.4, 11.4, mix(c, '#ffffff', 0.12), snowy(w)))];
    });
  },
  leaf(v, len, w) {
    return WOOD.leaf(1, len, w); // Brettertor
  },
  rubble(v, d) {
    const c = ROCK_COLS[v % ROCK_COLS.length];
    const S = [box(0, HALF, -3, 3, 0, 1.4 + rnd(d, 1) * 1.2, mix(c, '#000000', 0.08), { vary: 0.25 })]; // Sockelrest
    for (let k = 0; k < 9; k++) {
      const t = rnd(d, k + 10) * (HALF - 2);
      const y = (rnd(d, k + 20) - 0.5) * 10;
      const z = rnd(d, k + 25) * 1.6;
      const st = box(t, t + 1.8 + rnd(d, k) * 1.4, y - 0.9 - rnd(d, k + 5) * 0.6, y + 0.9, z, z + 1.1 + rnd(d, k + 30) * 0.9, mix(c, k % 3 ? '#ffffff' : '#000000', 0.08 + rnd(d, k + 40) * 0.1), { vary: 0.25 });
      S.push(tilt(st, k % 2 ? 'x' : 'y', (rnd(d, k + 50) - 0.5) * 0.7, t, y, z));
    }
    return S;
  },
};

const KINDS = { fence_wood: WOOD, fence_metal: METAL, fence_wire: WIRE, wall_concrete: CONCRETE, wall_stone: STONE };

/** Gibt es ein Bild für diese Art (Kachel aus diesem Modul)? */
export const isFenceKind = (kind) => !!KINDS[kind];

/** Höhe einer Art (px), für den Schatten in 2D. */
export const fenceHeight = (kind) => KINDS[kind]?.h ?? 0;

/**
 * Körper einer Kachel. mask: verbundene Nachbarn (Bits LINE_DIRS); ohne Nachbarn entlang along ('x' oder 'y'). gate: 0 keins,
 * 1 zu, 2 offen (nur gerade Kacheln). rubble: Trümmer statt der Kachel. v: Farbvariante 0 … 2, d: Einzelheiten, w: Winter.
 */
export function fenceModel(kind, mask, along, gate, rubble, v, d, w) {
  const D = KINDS[kind];
  if (!D) return [];
  const straightX = mask === 0b0101 || (!mask && along === 'x') || mask === 0b0001 || mask === 0b0100;
  const straightY = mask === 0b1010 || (!mask && along === 'y') || mask === 0b0010 || mask === 0b1000;
  let arms = mask || (along === 'y' ? 0b1010 : 0b0101);
  if (rubble) {
    if (!D.rubble) return [];
    const S = [];
    for (let q = 0; q < 4; q++) if (arms & (1 << q)) S.push(...turn(D.rubble(v, d * 4 + q), q));
    return S;
  }
  if (gate && (straightX || straightY)) {
    const S = [...D.gate(v, w)];
    const len = GATE_AT - (kind === 'fence_wood' || kind === 'fence_wire' ? 1 : 2.4);
    for (const s of [-1, 1]) {
      // Flügel am Scharnier bei s × GATE_AT: zu nach innen, offen um 90° nach Süden geschwenkt
      const leaf = D.leaf(v, len, w);
      const open = gate === 2;
      const hx = s * (GATE_AT - (kind === 'fence_wood' || kind === 'fence_wire' ? 1 : 2.4));
      for (const so of leaf) {
        const M = (p) => (open ? [hx + p[1], p[0], p[2]] : [hx - s * p[0], p[1], p[2]]);
        so.faces = so.faces.map((f) => f.map(M));
        so.c = M(so.c);
      }
      S.push(...leaf);
    }
    return turn(S, straightY ? 1 : 0);
  }
  if (!mask) arms = along === 'y' ? 0b1010 : 0b0101;
  const S = [...D.mid(v, w)];
  for (let q = 0; q < 4; q++) if (arms & (1 << q)) S.push(...turn(D.arm(v, w, d * 4 + q), q));
  return S;
}
