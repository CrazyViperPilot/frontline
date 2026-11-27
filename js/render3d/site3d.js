// Baustellen der Stadt in 3D aus dem Baukasten (kit3d.js), Paket „Baustellen und Ruinen 3D“: alle Größen (n × n Zellen) und fünf
// Bauabschnitte aus render/citysite.js (Baugrube mit Bagger und Pflöcken → Bodenplatte mit Anschlusseisen und Muldenkipper →
// Erdgeschoss mit Gerüst → Rohbau mit Decke → Dachstuhl mit Richtkranz), mit denselben Maßen und Farben wie gemalt (SITE_DIM),
// dazu die Rückseiten, die gemalt nie zu sehen sind (Gerüst, Öffnungen, Planen und Bauzaun an allen vier Wänden, Rohbau als echte
// Hülle mit Innenseiten). Örtliche Koordinaten ab der Mitte der Baustelle: u = Welt-x, v = Welt-y, h = Höhe; gemalt gilt das Bild für
// jede Drehung (Drehung 0), in 3D dreht die Ansicht, also stehen Kran (Ausleger nach +x), Bagger, Lkw und Gerät starr in Weltachsen.
// Gemalte Schatten entfallen (Schattenkarte), Schnee legt der Shader auf Oberseiten (Boden, Rohbau, Haufen, Paletten), Bretter,
// Eisen und Gerüst bleiben frei wie gemalt. Der Boden (Erde, Rand in der Zonenfarbe) bleibt gemalt (Durchlauf „Boden“, citylayer.js).
// Die Baugrube (Stufe 0) ist ein dunkles Feld mit Erdwall, kein Loch im Gelände. Keine Teamfarbe: Planen tragen die Zonenfarbe.
import { Kit3D } from './kit3d.js';
import { SITE_DIM, siteWall } from '../render/citysite.js';
import { shade, tint } from '../render/isokit.js';

const { STEPS, SLAB, PIT, SOIL, SAND, BRICK, BLOCK, PALLET, TIMBER, SCAF, PLANK, REBAR, DIXI, CRANE, BOX_OFFICE, INSIDE, dims, layout, insideLayout } = SITE_DIM;
const RES_BRICK = siteWall('res', 2); // Ziegelvariante des Wohnens (Palette hinten: Ziegel statt Kalksandstein)

/** Schlüssel der Geometrie: nur, wovon das gemalte Bild abhängt (Größe, Bauabschnitt, Variante 0 … 2, Zonenfarbe, Wandfarbe). */
export const siteKey = (b) => `${b.n}|${Math.max(0, Math.min(STEPS - 1, b.step | 0))}|${((b.variant % 3) + 3) % 3}|${b.zone}|${b.wall}`;

// ---------- Gemeinsames ----------

/** Quader ohne Wandfoto und ohne Schnee (Bretter, Gerüst, Fahrzeuge); Schnee auf dem Deckel nur mit o.snow = undefined (snowy gemalt). */
const B = (k, u0, u1, v0, v1, h0, h1, wall, top = wall, o = {}) => k.box(u0, u1, v0, v1, h0, h1, wall, top, { mat: null, snow: false, ...o });
/** Quader mit Schnee auf dem Deckel (gemalt snowy). */
const S = (k, u0, u1, v0, v1, h0, h1, wall, top = wall, o = {}) => B(k, u0, u1, v0, v1, h0, h1, wall, top, { snow: undefined, ...o });
/** Tafel auf einer Wand, ohne Foto und Schnee. */
const F = (k, face, plane, a0, a1, h0, h1, col, off = 0.06) => k.facePanel(face, plane, a0, a1, h0, h1, col, off, { mat: null, snow: false });
/** Wagrechte Fläche, ohne Foto und Schnee. */
const flat = (k, u0, u1, v0, v1, h, col) => k.poly([[u0, v0, h], [u1, v0, h], [u1, v1, h], [u0, v1, h]], col, { mat: null, snow: false, n: [0, 0, 1] });

/** Schüttkegel (Aushub, Sand) mit Schnee im Winter wie gemalt (snowy); Kit3D.heap ist schneefrei. */
function heap(k, u, v, r, h, col) {
  const prof = [[1, 0], [0.69, 0.4], [0.425, 0.7], [0.19, 0.9], [0, 1]];
  k.lathe(u, v, prof.map(([a, b]) => [a * r, b * h]), col, { n: 12 });
}

/** Palette mit Steinen (Ziegel oder Kalksandstein). */
function pallet(k, u, v, col) {
  B(k, u - 2.8, u + 2.8, v - 2.2, v + 2.2, 0, 0.8, PALLET);
  S(k, u - 2.5, u + 2.5, v - 1.9, v + 1.9, 0.8, 3.4, col, tint(col, 0.1));
}

/** Dixi-Klo mit Türspalt auf der Vorder- und Rückseite. */
function dixi(k, u, v) {
  S(k, u - 1.6, u + 1.6, v - 1.6, v + 1.6, 0, 6.2, DIXI, '#e9ece8');
  F(k, 's', v + 1.6, u - 0.8, u - 0.4, 0.4, 5.2, '#1f4f78', 0.03);
  F(k, 'n', v - 1.6, u - 0.8, u - 0.4, 0.4, 5.2, '#1f4f78', 0.03);
}

/** Stahlträger gestapelt (Lagerplatz). */
function beams(k, u, v) {
  for (let i = 0; i < 3; i++) S(k, u - 13, u + 13, v - 3.6 + i * 2.4, v - 1.8 + i * 2.4, 0, 1.6, '#7c8288', '#9aa0a5');
  for (let i = 0; i < 2; i++) S(k, u - 12, u + 12, v - 2.4 + i * 2.4, v - 0.6 + i * 2.4, 1.6, 3.2, '#8a9096', '#a4aaaf');
}

/** Muldenkipper (gelbe Mulde mit Kies, helles Fahrerhaus vorn bei +u). */
function truck(k, u, v) {
  B(k, u - 5, u + 1.6, v - 2.2, v + 2.2, 0.9, 4.4, '#e2b021', '#c99a14');
  B(k, u - 4.4, u + 1, v - 1.6, v + 1.6, 4.4, 5.2, '#bdb6a8', '#cfc8ba');
  B(k, u + 1.8, u + 5, v - 2, v + 2, 0.9, 5, '#d4d0c6', '#e0ddd5');
  F(k, 'e', u + 5, v - 1.6, v + 1.6, 3, 4.6, '#34506d');
  for (const a of [u - 3.4, u + 3.4]) {
    B(k, a - 1, a + 1, v + 2, v + 2.5, 0, 1.9, '#2f3134');
    B(k, a - 1, a + 1, v - 2.5, v - 2, 0, 1.9, '#2f3134');
  }
}

/** Bagger (gelb) mit Ausleger nach +u (Arm in der Ebene v + 0,6 wie gemalt). */
function excavator(k, u, v) {
  B(k, u - 3.5, u + 3.5, v - 2.6, v + 2.6, 0, 1.6, '#3b3b3b');
  B(k, u - 3, u + 2.2, v - 2.2, v + 2.2, 1.6, 4, '#e2b021', '#e9c24a');
  B(k, u - 0.2, u + 2.2, v - 2.2, v - 0.2, 4, 6.6, '#e2b021', '#e9c24a');
  k.rod([u + 1.6, v + 0.6, 4], [u + 6.5, v + 0.6, 8.6], 1.3, '#d39d14');
  k.rod([u + 6.5, v + 0.6, 8.6], [u + 9.4, v + 0.6, 3], 1.3, '#d39d14');
  B(k, u + 8.4, u + 10.8, v - 0.4, v + 1.6, 0.8, 3.4, '#5d6064');
}

/** Baukran: Gittermast, Führerhaus, Ausleger nach +u mit Laufkatze und Haken, Gegenausleger mit Ballast. */
function crane(k, u, v, H, reach, hookH) {
  k.mast(u, v, 0, H, 1.6, 1.6, CRANE, false);
  B(k, u - 2, u + 2, v - 2, v + 2, H, H + 1.2, shade(CRANE, 0.2));
  B(k, u + 0.4, u + 3, v + 0.6, v + 3, H - 3, H, '#e8e4d8');
  const tip = u + reach;
  const back = u - reach * 0.32;
  k.rod([back, v, H + 1.2], [tip, v, H + 1.2], 1.1, CRANE);
  k.rod([u, v, H + 1.2], [u, v, H + 5.2], 0.8, CRANE);
  k.rod([back, v, H + 1.2], [u, v, H + 5.2], 0.4, shade(CRANE, 0.25));
  k.rod([u, v, H + 5.2], [tip, v, H + 1.2], 0.4, shade(CRANE, 0.25));
  B(k, back, back + 3.2, v - 1.4, v + 1.4, H - 1.6, H + 1.2, '#8d9194');
  const hook = u + reach * 0.62;
  k.rod([hook, v, H + 1], [hook, v, hookH + 1.2], 0.35, '#2e3133');
  B(k, hook - 0.7, hook + 0.7, v - 0.7, v + 0.7, hookH, hookH + 1.2, '#d0412f');
}

/** Baucontainer (zwei übereinander) mit Fensterband auf beiden Längsseiten. */
function office(k, u, v) {
  for (const h of [0, 3.1]) {
    S(k, u - 4, u + 4, v - 1.7, v + 1.7, h, h + 3, BOX_OFFICE, tint(BOX_OFFICE, 0.15), { mat: 'metal' });
    F(k, 's', v + 1.7, u - 3, u + 3, h + 1.2, h + 2.3, '#34506d', 0.05);
    F(k, 'n', v - 1.7, u - 3, u + 3, h + 1.2, h + 2.3, '#34506d', 0.05);
  }
}

/** Bauzaun (Gitterzaun) mit Planen in der Zonenfarbe an allen vier Seiten (gemalt nur vorn); Lücken: der Zaun bleibt luftig. */
function siteFence(k, e, zone) {
  k.fence(-e, e, -e, e, 3.4);
  const n = Math.max(2, Math.floor((2 * e - 4) / 9));
  const len = (2 * e - 4) / n;
  for (let i = 0; i < n; i++) {
    if (i % 3 === 2) continue;
    const a0 = -e + 2 + i * len + 0.6;
    const a1 = a0 + len - 1.2;
    F(k, 's', e, a0, a1, 0.6, 2.9, zone, 0.1);
    F(k, 'n', -e, a0, a1, 0.6, 2.9, zone, 0.1);
    F(k, 'e', e, a0, a1, 0.6, 2.9, zone, 0.1);
    F(k, 'w', -e, a0, a1, 0.6, 2.9, zone, 0.1);
  }
}

// ---------- Baugrube, Bewehrung, Rohbau ----------

/** Baugrube: dunkle Sohle und Erdwall rundum (kein Loch im Gelände), Pflöcke mit Schnur an den Ecken. */
function pit(k, U0, U1, V0, V1) {
  flat(k, U0, U1, V0, V1, 0.06, PIT);
  const w = 2.2;
  const bank = tint(SOIL, 0.05);
  S(k, U0 - w, U1 + w, V0 - w, V0, 0, 1.3, SOIL, bank);
  S(k, U0 - w, U1 + w, V1, V1 + w, 0, 1.3, SOIL, bank);
  S(k, U0 - w, U0, V0, V1, 0, 1.3, SOIL, bank);
  S(k, U1, U1 + w, V0, V1, 0, 1.3, SOIL, bank);
  const c = [[U0 - 1, V0 - 1], [U1 + 1, V0 - 1], [U1 + 1, V1 + 1], [U0 - 1, V1 + 1]];
  for (let i = 0; i < 4; i++) {
    const [a, b] = c[i];
    const [a2, b2] = c[(i + 1) % 4];
    k.rod([a, b, 2.2], [a2, b2, 2.2], 0.3, '#f2f0e8');
    k.rod([a, b, 0], [a, b, 4], 0.75, '#efe9da');
    k.rod([a, b, 3], [a, b, 4.3], 0.8, '#d0412f');
  }
}

/** Anschlusseisen: kurze Stäbe rund um die Platte. */
function rebar(k, U0, U1, V0, V1, h, step) {
  const up = 2.8;
  for (let u = U0 + 1; u <= U1 - 0.9; u += step) {
    k.rod([u, V0 + 1, h], [u, V0 + 1, h + up], 0.35, REBAR);
    k.rod([u, V1 - 1, h], [u, V1 - 1, h + up], 0.35, REBAR);
  }
  for (let v = V0 + 1 + step; v <= V1 - 1 - step + 0.1; v += step) {
    k.rod([U0 + 1, v, h], [U0 + 1, v, h + up], 0.35, REBAR);
    k.rod([U1 - 1, v, h], [U1 - 1, v, h + up], 0.35, REBAR);
  }
}

/** Offener Rohbau als Hülle: vier Wände (außen, innen in dunklerem Ton, Mauerkrone), Boden auf Höhe hF; big: Stützen und Treppenkern. */
function shell(k, U0, U1, V0, V1, H, wall, hF, big) {
  const t = 1.2;
  const inner = shade(wall, 0.2);
  const crown = tint(wall, 0.12);
  const h0 = 1.6;
  const wo = { mat: null, snow: false };
  // außen
  k.facePanel('s', V1, U0, U1, h0, H, wall, 0, wo);
  k.facePanel('n', V0, U0, U1, h0, H, wall, 0, wo);
  k.facePanel('e', U1, V0, V1, h0, H, wall, 0, wo);
  k.facePanel('w', U0, V0, V1, h0, H, wall, 0, wo);
  // innen
  k.facePanel('n', V1 - t, U0 + t, U1 - t, hF, H, inner, 0, wo);
  k.facePanel('s', V0 + t, U0 + t, U1 - t, hF, H, inner, 0, wo);
  k.facePanel('w', U1 - t, V0 + t, V1 - t, hF, H, inner, 0, wo);
  k.facePanel('e', U0 + t, V0 + t, V1 - t, hF, H, inner, 0, wo);
  // Boden im Rohbau und Mauerkrone
  flat(k, U0 + t, U1 - t, V0 + t, V1 - t, hF, INSIDE);
  flat(k, U0, U1, V1 - t, V1, H, crown);
  flat(k, U0, U1, V0, V0 + t, H, crown);
  flat(k, U0, U0 + t, V0 + t, V1 - t, H, crown);
  flat(k, U1 - t, U1, V0 + t, V1 - t, H, crown);
  if (big) {
    const { cols, core } = insideLayout(U0, U1, V0, V1);
    for (const [u, v] of cols) B(k, u - 0.8, u + 0.8, v - 0.8, v + 0.8, hF, H - 0.6, '#a39f96', '#b5b1a8');
    const [c0, c1, d0, d1] = core;
    S(k, c0, c1, d0, d1, hF, H + 4, '#aaa69c', '#bcb8ae');
  }
}

/** Öffnungen (Fenster, Tür) in den Wänden: s (v = V1) mit Tür bei door, n, e, w ohne Tür. */
function openings(k, U0, U1, V0, V1, rows, door) {
  const dark = '#3a3631';
  const side = (face, plane, a0, a1, d) => {
    const n = Math.max(1, Math.floor((a1 - a0) / 6));
    const step = (a1 - a0) / n;
    for (const [h0, h1] of rows) {
      for (let i = 0; i < n; i++) {
        const a = a0 + step * (i + 0.5);
        if (d !== null && h0 < 4 && Math.abs(a - d) < 3) continue;
        F(k, face, plane, a - 1.3, a + 1.3, h0, h1, dark, 0.05);
      }
    }
    if (d !== null) F(k, face, plane, d - 1.2, d + 1.2, 1.6, 6.4, dark, 0.05);
  };
  side('s', V1, U0 + 1, U1 - 1, door);
  side('n', V0, U0 + 1, U1 - 1, null);
  side('e', U1, V0 + 1, V1 - 1, null);
  side('w', U0, V0 + 1, V1 - 1, null);
}

/** Gerüst vor allen vier Wänden: Ständer, Beläge mit Bordbrett, Geländer, je eine Diagonale vorn; Planen in der Zonenfarbe. */
function scaffold(k, U0, U1, V0, V1, H, zone) {
  const o = 2.6;
  const top = H + 2.4;
  const levels = [];
  for (let L = 4; L <= H + 0.6; L += 4.5) levels.push(L);
  const a0 = U0 - o;
  const a1 = U1 + o;
  const b0 = V0 - o;
  const b1 = V1 + o;
  // Ständer: zuerst die langen Seiten mit Ecken, dann die kurzen ohne
  const posts = (from, to, at, swap, ends) => {
    const cnt = Math.max(2, Math.round((to - from) / 6.5));
    for (let i = ends ? 0 : 1; i <= (ends ? cnt : cnt - 1); i++) {
      const a = from + ((to - from) * i) / cnt;
      const [u, v] = swap ? [at, a] : [a, at];
      k.rod([u, v, 0], [u, v, top], 0.55, SCAF);
    }
  };
  posts(a0, a1, b1, false, true);
  posts(a0, a1, b0, false, true);
  posts(b0, b1, a1, true, false);
  posts(b0, b1, a0, true, false);
  for (const L of levels) {
    B(k, a0, a1, V1 + 0.4, b1, L - 0.35, L, PLANK, tint(PLANK, 0.1));
    B(k, a0, a1, b0, V0 - 0.4, L - 0.35, L, PLANK, tint(PLANK, 0.1));
    B(k, U1 + 0.4, a1, V0 - 0.4, V1 + 0.4, L - 0.35, L, PLANK, tint(PLANK, 0.1));
    B(k, a0, U0 - 0.4, V0 - 0.4, V1 + 0.4, L - 0.35, L, PLANK, tint(PLANK, 0.1));
    const r = L + 1.9;
    k.rod([a0, b1, r], [a1, b1, r], 0.4, SCAF);
    k.rod([a1, b1, r], [a1, b0, r], 0.4, SCAF);
    k.rod([a1, b0, r], [a0, b0, r], 0.4, SCAF);
    k.rod([a0, b0, r], [a0, b1, r], 0.4, SCAF);
  }
  const dz = Math.min(top, 9);
  k.rod([a0, b1, 0], [a0 + 7, b1, dz], 0.4, SCAF);
  k.rod([a1, b0, 0], [a1, b0 + 7, dz], 0.4, SCAF);
  k.rod([a1, b1, 0], [a1 - 7, b1, dz], 0.4, SCAF);
  k.rod([a0, b0, 0], [a0, b0 + 7, dz], 0.4, SCAF);
  // Planen am Gerüst (gemalt links vorn, hier an jeder Seite einmal), Zonenfarbe, mit weißem Streifen
  const len = Math.min(10, (U1 - U0) * 0.4);
  const h1 = Math.min(H - 0.5, 10.5);
  const pn = (face, plane, from, to) => {
    F(k, face, plane, from, to, 3, h1, zone, 0.15);
    F(k, face, plane, from + 0.8, to - 0.8, (3 + h1) / 2 - 0.25, (3 + h1) / 2 + 0.25, '#e9e9e4', 0.18);
  };
  pn('s', V1 + o, U0 + 1, U0 + 1 + len);
  pn('n', V0 - o, U1 - 1 - len, U1 - 1);
  pn('e', U1 + o, V0 + 1, V0 + 1 + len);
  pn('w', U0 - o, V1 - 1 - len, V1 - 1);
}

/** Dachstuhl (Satteldach, First entlang u) mit Richtkranz (ohne Kranz bei Großbauten). */
function roofFrame(k, U0, U1, V0, V1, H, rh, zone, wreath) {
  const vm = (V0 + V1) / 2;
  const eave = H + 0.3;
  const tb = shade(TIMBER, 0.15);
  k.rod([U0, V1, eave], [U1, V1, eave], 0.8, tb);
  k.rod([U1, V1, eave], [U1, V0, eave], 0.8, tb);
  k.rod([U1, V0, eave], [U0, V0, eave], 0.8, tb);
  k.rod([U0, V0, eave], [U0, V1, eave], 0.8, tb);
  const n = Math.max(3, Math.round((U1 - U0) / 3.3));
  for (let i = 0; i <= n; i++) {
    const u = U0 + ((U1 - U0) * i) / n;
    k.rod([u, V0, H], [u, vm, H + rh], 0.75, TIMBER);
    k.rod([u, vm, H + rh], [u, V1, H], 0.75, TIMBER);
  }
  k.rod([U0, vm, H + rh], [U1, vm, H + rh], 0.95, shade(TIMBER, 0.1));
  for (const t of [0.33, 0.66]) {
    for (const s of [0, 1]) {
      const v = s ? V1 - (V1 - vm) * t : V0 + (vm - V0) * t;
      k.rod([U0, v, H + rh * t], [U1, v, H + rh * t], 0.4, tint(TIMBER, 0.1));
    }
  }
  if (!wreath) return;
  const u = (U0 + U1) / 2;
  k.frustum(u, vm, 1.5, 0.15, H + rh, H + rh + 4.6, '#3d7a35', { n: 8, top: false, snow: false });
  for (const [du, col] of [[-0.9, zone], [0.9, '#e8c547'], [0, '#d0412f']]) k.rod([u + du * 0.4, vm, H + rh + 2.4], [u + du, vm + 0.6, H + rh + 0.4], 0.4, col);
}

// ---------- Baustelle ----------

/** Baustelle n × n Zellen im Bauabschnitt step (0 … 4), Variante variant (0 … 2), Zonenfarbe zone, Wandfarbe wall. */
function site(k, n, step, variant, zone, wall) {
  const d = dims(n);
  const { U0, U1, V0, V1, Hf } = d;
  const flip = variant % 3 === 2;
  const big = n > 1;
  const at = layout(d, flip);
  if (d.e) siteFence(k, d.e, zone);
  // hinten: Aushub bzw. Steine, Dixi, Kran
  if (step <= 1) heap(k, ...at.back, big ? 9 : 6.5, big ? 7 : 5, SOIL);
  else pallet(k, ...at.back, wall === RES_BRICK ? BRICK : BLOCK);
  dixi(k, ...at.dixi);
  if (big && step >= 1) crane(k, ...at.crane, d.crane, U1 - U0 + 8, step >= 3 ? Hf * 0.9 : Hf * 0.5);
  if (step === 0) pit(k, U0, U1, V0, V1);
  else {
    const H = [0, 1.6, Hf * 0.42, Hf * 0.8, Hf][step];
    S(k, U0, U1, V0, V1, 0, 1.6, SLAB, tint(SLAB, 0.06));
    if (step === 1) rebar(k, U0, U1, V0, V1, 1.6, big ? 4 : 3);
    else {
      const floors = [7.6, 14.6, 21.6].filter((h) => h < H - 1);
      shell(k, U0, U1, V0, V1, H, wall, floors.length ? floors[floors.length - 1] + 0.8 : 1.6, big);
      const rows = [[2.8, 6.2], [9.8, 13.2], [16.8, 20.2], [23.8, 27]].filter(([, h1]) => h1 < H - 0.8);
      openings(k, U0, U1, V0, V1, rows, (U0 + U1) / 2 - (flip ? -3 : 3));
      for (const h of floors) k.wallBand(U0, U1, V0, V1, h, h + 0.8, SLAB);
      if (step === 4) roofFrame(k, U0, U1, V0, V1, H, big ? 10 : 8.5, zone, !big);
      scaffold(k, U0, U1, V0, V1, H, zone);
    }
  }
  // vorn: Maschinen und Baustoffe
  if (step === 0) excavator(k, ...at.digger);
  if (step === 1) truck(k, ...at.truck);
  if (d.yard) {
    pallet(k, ...at.stock, BLOCK);
    pallet(k, at.stock[0], at.stock[1] + 6, BLOCK);
    if (step >= 2) truck(k, ...at.lorry);
    beams(k, ...at.beams);
  }
  if (big) office(k, ...at.office);
  pallet(k, ...at.pallet, BRICK);
  heap(k, ...at.sand, 4.4, 3.2, SAND);
}

const cache = new Map(); // Schlüssel → BufferGeometry (höchstens n 1 … 5 × 5 Abschnitte × 3 Varianten × wenige Farben)

/**
 * Geometrie der Baustelle b (cityBuildings: { n, step, variant, zone, wall }), je Schlüssel (siteKey) einmal gebaut; Mitte der
 * Baustelle = Ursprung. Planen und Bänder tragen die Zonenfarbe in der Geometrie (keine Teamfarbe).
 */
export function siteGeometry(b) {
  const key = siteKey(b);
  let g = cache.get(key);
  if (!g) {
    const k = new Kit3D();
    site(k, b.n, Math.max(0, Math.min(STEPS - 1, b.step | 0)), b.variant, b.zone, b.wall);
    g = k.geometry();
    cache.set(key, g);
  }
  return g;
}
