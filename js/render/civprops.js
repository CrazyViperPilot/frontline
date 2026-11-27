// Zivil und Natur, Kriegsspuren als Props der Karte (Werte js/data/props.js, Gruppen „civ“ und „war“). Eigene Modelle: Hecke (Kachel),
// Bushaltestelle, Briefkasten, Verkehrsschild, Holzstapel, Brunnen, Krater, Trümmerhaufen, umgestürzter Baum. Geparktes und
// ausgebranntes Auto, Parkbank, Heuballen, Busch und Fels zeichnen die vorhandenen Maler (props.js, nature.js), damit sie aussehen wie
// überall auf der Karte (DELEGATE). Modell in Welt-Pixeln um die Mitte, x entlang der Länge, z nach oben. Nur Darstellung.
import { PAINT } from './unitpaint.js';
import { hashXY } from './color.js';
import { addLineKinds, rnd, tilt, snowy } from './fences.js';
import { drawMapCarIso, drawMapCarShadowIso, drawMapCarTop, drawBenchIso, drawBenchShadowIso, drawBenchTop, drawBaleIso, drawBaleShadowIso, drawBaleTop } from './props.js';
import { drawBushIso, drawBushTop, drawRockIso, drawRockTop, natureShadowIso } from './nature.js';

const { box, cyl, prY, prZ, ball, on, fine, mix } = PAINT;
const HALF = 16;
const TAU = Math.PI * 2;

// Laub je Jahreszeit (wie die Hecken und Büsche der Natur: Sommergrün, Herbstbraun, im Winter kahles Geäst mit Schnee)
const LEAF = { summer: ['#4f7a35', '#5d8a3c', '#476f31'], autumn: ['#9a7a33', '#a8692c', '#7d6a2e'], winter: ['#6b5a45', '#5e5040', '#73624b'] };
const leafOf = (season, v) => (LEAF[season] ?? LEAF.summer)[v % 3];

// ---------- Hecke (Kachel) ----------

/** Hecke: geschnittener Block aus Laub, oben unruhig; im Winter kahl mit Schnee. Arme wie Zäune (fences.js). */
const HEDGE = {
  h: 11,
  arm(v, w, d, season = w ? 'winter' : 'summer') {
    const c = leafOf(season, v);
    const body = box(0, HALF, -3.6, 3.6, 0, 10, c, { vary: 0.12, ...snowy(w) });
    const S = [body];
    for (let k = 0; k < 4; k++) {
      const t = 2 + k * 4 + rnd(d, k) * 1.5;
      S.push(on(body, ball([t, (rnd(d, k + 9) - 0.5) * 2, 10], 2.6, 3.2, 1.6 + rnd(d, k + 4), mix(c, '#ffffff', 0.06), { n: 8, m: 3, half: true, ...snowy(w) })));
    }
    S.push(fine(on(body, box(0, HALF, 3.55, 3.7, 0.2, 9.5, mix(c, '#000000', 0.15), { noLine: true, vary: 0.3 })))); // Blattflecken
    return S;
  },
  mid(v, w, d, season = w ? 'winter' : 'summer') {
    const c = leafOf(season, v);
    return [box(-3.6, 3.6, -3.6, 3.6, 0, 10, c, { vary: 0.12, ...snowy(w) })];
  },
  rubble: null,
};
addLineKinds({ hedge: HEDGE });

// ---------- Einzelstücke ----------

/** Bushaltestelle: Rahmen, Glaswände (durchscheinend), Dach, Bank, Haltestellenschild. */
function busStop(v, d, season, rubble) {
  const w = season === 'winter';
  const frame = '#5f666b';
  const S = [];
  for (const x of [-19, 19]) for (const y of [-5.5, 5.5]) S.push(box(x - 0.5, x + 0.5, y - 0.5, y + 0.5, 0, 16, frame));
  if (!rubble) {
    S.push(box(-19.5, 19.5, -7, 7, 16, 17.2, '#b8bdc0', snowy(w))); // Dach
    S.push(box(-19, 19, -5.8, -5.4, 1.5, 15.5, '#bcd3de', { alpha: 0.35, noLine: true })); // Rückwand Glas
    for (const x of [-19, 19]) S.push(box(x - 0.2, x + 0.2, -5.5, 2, 1.5, 15.5, '#bcd3de', { alpha: 0.35, noLine: true }));
    S.push(box(-12, 12, -4.8, -2.4, 4, 4.8, '#8b6b45')); // Bank
    S.push(cyl([23, 4, 0], [23, 4, 20], 0.4, 0.4, 5, frame), box(22.5, 23.5, 1, 7, 17, 21, '#f2d33a')); // Schild
    S.push(fine(box(22.4, 23.6, 2.5, 5.5, 18, 20, '#2f7a3a', { noLine: true }))); // H
  } else S.push(box(-18, 18, -6, -5, 0, 1.4, '#9aa7ad')); // Glasscherben
  return S;
}

/** Briefkasten: gelber Kasten auf einem Pfosten. */
function mailbox(v, d, season) {
  const w = season === 'winter';
  const S = [cyl([0, 0, 0], [0, 0, 7], 0.5, 0.5, 5, '#4a4e52')];
  const b = box(-2.4, 2.4, -1.6, 1.6, 7, 13, '#f2c230', snowy(w));
  S.push(b, fine(on(b, box(-1.6, 1.6, 1.55, 1.7, 11, 11.6, '#1f2326', { noLine: true })))); // Einwurf
  S.push(fine(on(b, box(-1, 1, 1.55, 1.7, 8.6, 9.8, '#2a4f9a', { noLine: true })))); // Posthorn
  return S;
}

/** Verkehrsschild: Stopp, Vorfahrt achten, Tempo 50 oder blaues Hinweisschild (nach Einzelheit d). Umgeknickt liegt es am Boden. */
function roadSign(v, d, season, rubble) {
  const w = season === 'winter';
  const pole = '#9aa0a3';
  if (rubble) return [cyl([0, 0, 0.5], [16, 3, 0.5], 0.4, 0.4, 5, pole), box(15, 19, 1, 5, 0, 0.6, '#c43b33')];
  const S = [cyl([0, 0, 0], [0, 0, 18], 0.45, 0.4, 5, pole, snowy(w))];
  const kind = d % 4;
  const face = (prof, col) => prY(prof, 0.45, 0.75, col, { noLine: true }); // Fläche quer zur Straße (Profil [y, z])
  if (kind === 0) {
    const r = 3.2;
    const pts = Array.from({ length: 8 }, (_, k) => [Math.cos(((k + 0.5) / 8) * TAU) * r, 21 + Math.sin(((k + 0.5) / 8) * TAU) * r]);
    S.push(face(pts, '#c43b33'), fine(face([[-1.8, 20.6], [1.8, 20.6], [1.8, 21.4], [-1.8, 21.4]], '#f2f2ec'))); // Stopp
  } else if (kind === 1) {
    S.push(face([[-3.6, 23.5], [3.6, 23.5], [0, 17.6]], '#c43b33'), fine(face([[-2.2, 22.8], [2.2, 22.8], [0, 19.2]], '#f2f2ec'))); // Vorfahrt achten
  } else if (kind === 2) {
    const ring = Array.from({ length: 12 }, (_, k) => [Math.cos((k / 12) * TAU) * 3, 21 + Math.sin((k / 12) * TAU) * 3]);
    const inner = Array.from({ length: 12 }, (_, k) => [Math.cos((k / 12) * TAU) * 2.2, 21 + Math.sin((k / 12) * TAU) * 2.2]);
    S.push(face(ring, '#c43b33'), fine(prY(inner, 0.35, 0.8, '#f2f2ec', { noLine: true }))); // Tempo
  } else {
    S.push(face([[-3, 18], [3, 18], [3, 24], [-3, 24]], '#2a5ea8'), fine(prY([[-1, 19], [1, 19], [1, 23], [-1, 23]], 0.35, 0.8, '#f2f2ec', { noLine: true }))); // Hinweis
  }
  return S;
}

/** Holzstapel: Stämme in Lagen, quer liegend; verstreut nach Beschuss. */
function logPile(v, d, season, rubble) {
  const w = season === 'winter';
  const bark = ['#6b4e34', '#5c4330', '#74583c'][v % 3];
  const S = [];
  const R = 2.6;
  const log = (y, z, len, k) => {
    const L = cyl([-len / 2, y, z + R], [len / 2, y, z + R], R, R, 9, mix(bark, '#000000', rnd(d, k) * 0.15), { smooth: true, ...snowy(w) });
    S.push(L, fine(on(L, cyl([len / 2, y, z + R], [len / 2 + 0.06, y, z + R], R * 0.85, R * 0.85, 9, '#c9a46b', { noLine: true })))); // Schnittfläche
  };
  if (rubble) {
    // verstreute Stämme, jeder um seine Mitte gedreht
    for (let k = 0; k < 5; k++) {
      const n = S.length;
      log((rnd(d, k) - 0.5) * 16, 0, 20 + rnd(d, k + 5) * 10, k);
      const [cx, cy] = S[n].c; // um die Mitte des Stamms (mit Schnittfläche)
      for (const so of S.slice(n)) spin1(so, rnd(d, k + 20) * 1.2 - 0.6, cx, cy);
    }
    return S;
  }
  const len = 32;
  for (let k = 0; k < 5; k++) log(-6 * R + R + k * 2 * R + 0.2, 0, len, k);
  for (let k = 0; k < 4; k++) log(-4 * R + R + k * 2 * R + 0.2, 2 * R * 0.87, len - 2, k + 5);
  for (let k = 0; k < 2 + (d % 2); k++) log(-2 * R + R + k * 2 * R, 4 * R * 0.87, len - 4, k + 10);
  return S;
}

/** Körper um die Hochachse durch (cx, cy) drehen (Standard: seine Mitte). */
function spin1(so, a, cx = so.c[0], cy = so.c[1]) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = (p) => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c, p[2]];
  so.faces = so.faces.map((f) => f.map(R));
  so.c = R(so.c);
  return so;
}

/** Dorfbrunnen: Ring aus Bruchstein, zwei Pfosten, Satteldach, Kurbel und Eimer. */
function well(v, d, season, rubble) {
  const w = season === 'winter';
  const stone = ['#8d8578', '#837a6c', '#958e80'][v % 3];
  const S = [cyl([0, 0, 0], [0, 0, 6], 8.5, 8.5, 14, stone, { vary: 0.15 }), cyl([0, 0, 6], [0, 0, 6.6], 8.8, 8.8, 14, mix(stone, '#ffffff', 0.12), snowy(w))];
  S.push(cyl([0, 0, 6.05], [0, 0, 6.7], 6.3, 6.3, 14, '#1d2a30', { noLine: true })); // Wasser, dunkel
  if (rubble) return S;
  for (const y of [-7.5, 7.5]) S.push(box(-0.7, 0.7, y - 0.7, y + 0.7, 6, 17, '#6b4e34'));
  S.push(prY([[-9.5, 16], [0, 21], [9.5, 16], [9.5, 15.5], [0, 20.4], [-9.5, 15.5]], -6, 6, '#7a4a32', snowy(w))); // Dach
  S.push(cyl([0, -7.5, 12.5], [0, 8.5, 12.5], 0.45, 0.45, 6, '#5a4430'), box(-1.2, 1.2, -1.2, 1.2, 8, 10.4, '#8a8f93')); // Kurbel, Eimer
  S.push(fine(cyl([0, 0, 12.5], [0, 0, 10.4], 0.08, 0.08, 3, '#3a3a3a', { noLine: true }))); // Seil
  return S;
}

/** Krater: flache Mulde mit aufgeworfenem Rand aus Erde, verkohlter Boden. */
function crater(v, d, season) {
  const w = season === 'winter';
  const earth = w ? '#cfd3d4' : ['#6b5a44', '#5f5140', '#76634a'][v % 3];
  const S = [];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const r0 = 11 + rnd(d, k + 80) * 2;
    const r1 = 18 + rnd(d, k) * 4;
    const h = 0.7 + rnd(d, k + 20) * 1.1;
    const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    S.push(prZ([P(r0, a0), P(r1, a0), P(r1, a1), P(r0, a1)], 0, h, mix(earth, '#000000', rnd(d, k + 40) * 0.12), { vary: 0.2, noLine: true, ...snowy(w) })); // Rand
  }
  S.push(cyl([0, 0, 0], [0, 0, 0.12], 12, 12, 14, w ? '#9fa5a6' : '#2f2a24', { noLine: true })); // Mulde
  S.push(cyl([0, 0, 0.12], [0, 0, 0.2], 6, 6, 12, w ? '#8a9091' : '#1f1b17', { noLine: true })); // Brandfleck in der Mitte
  for (let k = 0; k < 5; k++) {
    const a = rnd(d, k + 60) * TAU;
    const r = 21 + rnd(d, k + 70) * 6;
    S.push(fine(box(Math.cos(a) * r - 1, Math.cos(a) * r + 1, Math.sin(a) * r - 0.8, Math.sin(a) * r + 0.8, 0, 0.9, mix(earth, '#000000', 0.15), { noLine: true }))); // Brocken
  }
  return S;
}

/** Trümmerhaufen: Ziegel und Betonbrocken, ein Stück Mauer, Bewehrung. */
function rubbleHeap(v, d, season) {
  const w = season === 'winter';
  const brick = ['#8e5a46', '#9a6b55', '#7f5444'][v % 3];
  // Schutthügel: zwei flache Wälle aus Schutt (Profil abgeschrägt), darauf Ziegel und Betonbrocken
  const dust = mix(brick, '#6b665e', 0.55);
  const S = [
    prY([[-15, 0], [-9, 4.5], [-2, 6.5], [6, 5], [14, 0]], -16, 4, dust, { vary: 0.25, ...snowy(w) }),
    prY([[-12, 0], [-5, 3.8], [3, 4.6], [11, 0]], 2, 17, mix(dust, '#000000', 0.08), { vary: 0.25, ...snowy(w) }),
  ];
  for (let k = 0; k < 9; k++) {
    const x = (rnd(d, k) - 0.5) * 30;
    const y = (rnd(d, k + 10) - 0.5) * 22;
    const z = 2 + rnd(d, k + 20) * 4;
    const b = box(x - 2.4, x + 2.4, y - 1.5, y + 1.5, z, z + 1.8, k % 3 ? brick : '#b9b5ab', { vary: 0.2, ...snowy(w) });
    S.push(tilt(b, k % 2 ? 'x' : 'y', (rnd(d, k + 30) - 0.5) * 1.2, x, y, z));
  }
  S.push(tilt(box(-8, 6, -2, 0, 3, 10, '#b9b5ab', { vary: 0.15 }), 'x', 0.5, 0, -1, 3)); // Mauerstück
  for (let k = 0; k < 3; k++) S.push(fine(cyl([k * 4 - 4, 2, 5], [k * 4 - 2, 5, 11 + k], 0.18, 0.18, 4, '#6b4b3a', { noLine: true })));
  return S;
}

/** Umgestürzter Baum: Stamm liegend entlang x, Wurzelteller am einen Ende, Krone aus Ästen und Laub am anderen. */
function fallenTree(v, d, season) {
  const w = season === 'winter';
  const bark = '#5d4632';
  const S = [];
  const trunk = cyl([-24, 0, 2.8], [18, 1.5, 2], 2.8, 1.8, 9, bark, { smooth: true, ...snowy(w) });
  S.push(trunk);
  // Wurzelteller: aufgestellte Erdscheibe mit Wurzeln, unten im Boden
  S.push(cyl([-28, 0, 4.5], [-25.5, 0.3, 4.5], 6.5, 6.8, 11, '#5a4a38', { vary: 0.2 }));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + rnd(d, k + 30);
    S.push(cyl([-27, Math.cos(a) * 5, 4.5 + Math.sin(a) * 5], [-30 - rnd(d, k + 40) * 3, Math.cos(a) * 8, Math.max(0.3, 4.5 + Math.sin(a) * 8)], 0.6, 0.25, 4, '#4a3a2a'));
  }
  const leaf = leafOf(season, v);
  for (let k = 0; k < 5; k++) {
    const x = 14 + k * 3;
    const y = (rnd(d, k) - 0.5) * 14;
    S.push(cyl([x - 6, 0.8, 2.4], [x, y, 2 + rnd(d, k + 5) * 4], 0.6, 0.4, 5, bark)); // Äste
    if (!w) S.push(ball([x + 1, y, 3 + rnd(d, k + 9) * 3], 5, 4.5, 3.4, mix(leaf, '#ffffff', rnd(d, k + 12) * 0.08), { n: 9, m: 4, ...snowy(w) }));
  }
  return S;
}

const SINGLE = {
  bus_stop: busStop,
  mailbox,
  road_sign: roadSign,
  log_pile: logPile,
  well,
  crater,
  rubble_heap: rubbleHeap,
  fallen_tree: fallenTree,
};

/** Gibt es ein eigenes Modell dieser Art hier? */
export const isCivSingle = (kind) => !!SINGLE[kind];

/** Körper eines Einzelstücks (Modellrichtung). season: 'summer', 'autumn' oder 'winter'. */
export function civModel(kind, v, d, season, rubble) {
  const f = SINGLE[kind];
  return f ? f(v, d, season, rubble) : [];
}

// ---------- Vorhandene Maler ----------

const CAR_COLORS = ['#b8b8b0', '#2b3a55', '#8c2a25', '#d9d6cc', '#3c5a3e', '#6d7072', '#c6a24a', '#1f2124', '#4f6f8f']; // Lack per Lage

/** Auto, Bank, Ballen, Busch, Fels: Objekt im Format des vorhandenen Malers aus dem Aussehen o (mapprops.js). */
function asCar(o, charred) {
  return { x: o.x, y: o.y, angle: o.a, color: charred ? '#8a5034' : CAR_COLORS[hashXY(o.x, o.y) % CAR_COLORS.length], charred }; // ausgebrannt: rostig
}
const asBench = (o) => ({ x: o.x, y: o.y, rx: -Math.sin(o.a), ry: Math.cos(o.a) });
const asBale = (o) => ({ x: o.x, y: o.y, a: o.a, kind: o.d % 2 ? 'straw' : 'hay' });
const asBush = (o) => ({ x: o.x, y: o.y, r: 9 + o.d });
const asRock = (o) => ({ x: o.x, y: o.y, r: 11 + o.d * 1.5 });

/**
 * Props, die ein vorhandener Maler zeichnet: { iso(ctx, cam, o, season), shadow(ctx, cam, o, dpr), top(ctx, o, zoom, season) }.
 * Busch und Fels werfen den runden Schatten der Natur (nature.js).
 */
const natureShadow = (t, as) => (ctx, cam, o) => {
  ctx.beginPath();
  natureShadowIso(ctx, cam, as(o), t);
  ctx.fillStyle = 'rgba(10,18,8,0.24)';
  ctx.fill();
};
export const DELEGATE = {
  civ_car: {
    iso: (ctx, cam, o, season) => drawMapCarIso(ctx, cam, asCar(o, o.rubble), season),
    shadow: (ctx, cam, o, dpr) => drawMapCarShadowIso(ctx, cam, asCar(o, o.rubble), dpr),
    top: (ctx, o, zoom, season) => drawMapCarTop(ctx, asCar(o, o.rubble), zoom, season),
  },
  burnt_car: {
    iso: (ctx, cam, o, season) => drawMapCarIso(ctx, cam, asCar(o, true), season),
    shadow: (ctx, cam, o, dpr) => drawMapCarShadowIso(ctx, cam, asCar(o, true), dpr),
    top: (ctx, o, zoom, season) => drawMapCarTop(ctx, asCar(o, true), zoom, season),
  },
  bench: {
    iso: (ctx, cam, o, season) => drawBenchIso(ctx, cam, asBench(o), season),
    shadow: (ctx, cam, o, dpr) => drawBenchShadowIso(ctx, cam, asBench(o), dpr),
    top: (ctx, o, zoom, season) => drawBenchTop(ctx, asBench(o), zoom, season),
  },
  hay_bale: {
    iso: (ctx, cam, o, season) => drawBaleIso(ctx, cam, asBale(o), season),
    shadow: (ctx, cam, o, dpr) => drawBaleShadowIso(ctx, cam, asBale(o), dpr),
    top: (ctx, o, zoom, season) => drawBaleTop(ctx, asBale(o), zoom, season),
  },
  bush: {
    iso: (ctx, cam, o, season) => drawBushIso(ctx, cam, asBush(o), season),
    shadow: natureShadow(13, asBush),
    top: (ctx, o, zoom, season) => drawBushTop(ctx, asBush(o), season, zoom),
  },
  rock: {
    iso: (ctx, cam, o, season) => drawRockIso(ctx, cam, asRock(o), season),
    shadow: natureShadow(2, asRock),
    top: (ctx, o, zoom, season) => drawRockTop(ctx, asRock(o), season, zoom),
  },
};

/** Ansicht 3D (render3d/props3d.js): Prop mit vorhandenem Maler → { t: Typ in der Tiefenliste, o: Objekt im Format des Malers }. */
export const DELEGATE_AS = {
  civ_car: (o) => ({ t: 6, o: asCar(o, o.rubble) }),
  burnt_car: (o) => ({ t: 6, o: asCar(o, true) }),
  bench: (o) => ({ t: 7, o: asBench(o) }),
  hay_bale: (o) => ({ t: 14, o: asBale(o) }),
  bush: (o) => ({ t: 13, o: asBush(o) }),
  rock: (o) => ({ t: 2, o: asRock(o) }),
};
