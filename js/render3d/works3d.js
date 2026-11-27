// Werke und Kraftwerk in 3D aus dem Baukasten (kit3d.js), Paket „Werke 3D“: alle sechs Anlagen (Kraftwerk, BM-Werk, Munitionswerk,
// Raffinerie, Stahlwerk, Kerosin-Raffinerie) in den Stufen 1 bis 3 mit denselben Maßen, Farben und Bauteilen wie render/works.js, dazu
// die Rückseiten (Fenster, Tore, Streifen), die gemalt nie zu sehen sind. Örtliche Koordinaten wie works.js: u = Welt-x, v = Welt-y ab
// der Mitte des 2 × 2-Quadrats (bemalt ±58), h = Höhe. Gemalte Schatten entfallen (Schattenkarte); Schnee legt der Shader auf Dächer,
// Rasen, Halden und Hallen, Pflaster, Gleisbett und Werkstraßen bleiben wie gemalt schneefrei. Teamfarbe: Teile mit k.team = true tragen
// die Farbe der Instanz (instanceColor), eine Geometrie je Art und Stufe für alle Teams. Glut, Flammen und heiße Ofentüren leuchten
// selbst (emit, unbeleuchtet). Dampf der Kühltürme und Rauch bleiben gemalt (render/works.js drawWorksSteam), Förderbänder stehen still.
import { Kit3D } from './kit3d.js';
import { WORKS_KINDS, WORKS_PAL } from '../render/works.js';
import { ASPH, CAR_COLORS, DECK, GLASS, SILL, clampLv, rnd, shade, tint } from '../render/isokit.js';

const { E, CONCRETE, GRAVEL, BRICK, BRICKS, RAW, RUST, TANK, PIPE, GRASS, BRASS, OLIVE, HOT, COAL, BLUE, KTANK } = WORKS_PAL;
const TEAM0 = '#3a6fb3'; // Platzhalter der Teamfarbe in der Geometrie (die Instanz tönt sie um)

// ---------- Gemeinsames ----------

/** Bodenfläche (schneefrei, unbeleuchtet wie gemalt), jede neue Fläche eine Spur höher, damit spätere Flächen früheren vorgehen. */
function fl(k, u0, u1, v0, v1, col) {
  k.fh += 0.012;
  k.flat(u0, u1, v0, v1, col, k.fh, { bare: true, mat: null });
}

/** Rasenfläche (Schnee wie gemalt). */
function grass(k, u0, u1, v0, v1) {
  k.fh += 0.012;
  k.flat(u0, u1, v0, v1, GRASS, k.fh, { mat: null });
}

const ground = (k, col) => fl(k, -E, E, -E, E, col);

/** Parkplatzmarkierungen entlang u bei v0…v1. */
function stalls(k, u0, u1, v0, v1, step = 5.5) {
  for (let a = u0; a <= u1 + 0.1; a += step) k.flat(a - 0.25, a + 0.25, v0, v1, '#c9c7bd', k.fh + 0.006, { bare: true, mat: null });
}

/** Wände einer Halle mit Sockel (o.ribs: Wellblech mit Rippen, o.band: Band unter der Traufe, o.team: Band in Teamfarbe); Dach danach. */
function walls(k, u0, u1, v0, v1, H, wall, o = {}) {
  k.box(u0, u1, v0, v1, 0, H, wall, wall, { top: false, mat: o.ribs ? 'metal' : undefined });
  k.plinth(u0, u1, v0, v1, wall);
  if (o.ribs) k.ribs(u0, u1, v0, v1, 1.8, H - 0.5, o.ribs, wall);
  if (o.band) {
    k.team = !!o.team;
    k.wallBand(u0, u1, v0, v1, H - 2.6, H - 1.3, o.band);
    k.team = false;
  }
}

/** Flachdach mit Attika nach walls. */
const flatRoof = (k, u0, u1, v0, v1, H, wall, deck = DECK) => k.parapet(u0, u1, v0, v1, H, wall, deck);

/** Rolltor mit Rahmen in einer Wand (Mitte a, Breite w, Höhe h). */
function gate(k, face, plane, a, w, h, col = '#8e979d') {
  k.facePanel(face, plane, a - w / 2 - 0.6, a + w / 2 + 0.6, 0, h + 0.6, '#4d5358', 0.06, { mat: null, snow: false });
  k.facePanel(face, plane, a - w / 2, a + w / 2, 0, h, col, 0.12, { mat: null, snow: false });
  for (let z = 1.6; z < h - 0.4; z += 1.6) k.facePanel(face, plane, a - w / 2, a + w / 2, z - 0.1, z + 0.1, shade(col, 0.2), 0.14, { mat: null, snow: false });
}

/** Durchgehendes Fensterband mit Pfosten; glow = warm beleuchtet (Glut der Gießhalle, leuchtet selbst). */
function strip(k, face, plane, a0, a1, h0, h1, step = 3, glow = false) {
  const F = (x0, x1, z0, z1, col, off, o = {}) => k.facePanel(face, plane, x0, x1, z0, z1, col, off, { mat: null, snow: false, ...o });
  F(a0 - 0.4, a1 + 0.4, h0 - 0.5, h1 + 0.4, SILL, 0.06);
  F(a0, a1, h0, h1, glow ? (face === 's' ? '#f6a640' : '#e08a2c') : GLASS, 0.12, { emit: glow });
  for (let a = a0 + step; a < a1 - 0.4; a += step) F(a - 0.22, a + 0.22, h0, h1, '#bfc6cc', 0.16, { emit: glow });
}

/** Band an der Vorderseite (s) und, wie die Rückseite des Hauses, an der Nordwand (n) im selben Bereich; entsprechend e und w. */
function stripAll(k, [u0, u1, v0, v1], h0, h1, a, b, face, step, glow = false) {
  // face 's'/'e' wie gemalt; Gegenseite 'n'/'w' mit demselben Bereich entlang der Wand
  if (face === 's') {
    strip(k, 's', v1, a, b, h0, h1, step, glow);
    strip(k, 'n', v0, a, b, h0, h1, step, glow);
  } else {
    strip(k, 'e', u1, a, b, h0, h1, step, glow);
    strip(k, 'w', u0, a, b, h0, h1, step, glow);
  }
}

/** Sheddach auf Höhe h: n Zähne entlang u, schräge Dachflächen, senkrechte Glasbänder nach +u, Giebeldreiecke vorn und hinten. */
export function sawRoof(k, u0, u1, v0, v1, h, n, rh, roof, wall) {
  const w = (u1 - u0) / n;
  for (let i = 0; i < n; i++) {
    const a = u0 + i * w;
    const b = a + w;
    k.poly([[a, v0, h], [b, v0, h + rh], [b, v1, h + rh], [a, v1, h]], roof, { mat: 'metal', n: [-rh, 0, w] });
    k.poly([[b, v0, h], [b, v1, h], [b, v1, h + rh], [b, v0, h + rh]], '#86a8c2', { mat: null, snow: false, n: [1, 0, 0] });
    k.poly([[a, v1, h], [b, v1, h], [b, v1, h + rh]], wall, { mat: null, snow: false, n: [0, 1, 0] });
    k.poly([[a, v0, h], [b, v0, h + rh], [b, v0, h]], wall, { mat: null, snow: false, n: [0, -1, 0] });
  }
}

/** Gemauerter Schornstein (quadratisch, verjüngt): Wände, helles Band, Kranz und dunkle Mündung. */
function brickStack(k, u, v, s0, s1, H, col = BRICK) {
  const sAt = (h) => s0 + ((s1 - s0) * h) / H;
  const side = (a, b, c, d, n) => k.poly([a, b, c, d], col, { mat: null, snow: false, n });
  side([u - s0, v + s0, 0], [u + s0, v + s0, 0], [u + s1, v + s1, H], [u - s1, v + s1, H], [0, 1, 0.1]);
  side([u + s0, v + s0, 0], [u + s0, v - s0, 0], [u + s1, v - s1, H], [u + s1, v + s1, H], [1, 0, 0.1]);
  side([u + s0, v - s0, 0], [u - s0, v - s0, 0], [u - s1, v - s1, H], [u + s1, v - s1, H], [0, -1, 0.1]);
  side([u - s0, v - s0, 0], [u - s0, v + s0, 0], [u - s1, v + s1, H], [u - s1, v - s1, H], [-1, 0, 0.1]);
  const b = H - 9;
  const t = sAt(b + 2) + 0.12;
  k.box(u - t, u + t, v - t, v + t, b, b + 2, '#e9e1cf', '#e9e1cf', { mat: null, snow: false });
  const c = s1 + 0.8;
  k.box(u - c, u + c, v - c, v + c, H - 2.2, H, tint(col, 0.05), tint(col, 0.05), { mat: null });
  k.poly([[u - s1 + 0.3, v - s1 + 0.3, H + 0.05], [u + s1 - 0.3, v - s1 + 0.3, H + 0.05], [u + s1 - 0.3, v + s1 - 0.3, H + 0.05], [u - s1 + 0.3, v + s1 - 0.3, H + 0.05]], '#2a2622', { mat: null, snow: false, n: [0, 0, 1] });
}

/**
 * Naturzug-Kühlturm (Hyperboloid): Fuß r0, Taille rw bei 70 %, Krone r1, Höhe H; Stützenkranz, Öffnung mit Innenwand. Dampf: gemalt.
 */
function coolingTower(k, u, v, r0, rw, r1, H) {
  const tw = 0.7;
  const R = (t) => (t < tw ? rw + (r0 - rw) * ((tw - t) / tw) ** 1.8 : rw + (r1 - rw) * ((t - tw) / (1 - tw)) ** 1.8);
  const col = '#d6d2c9';
  const N = 12;
  const n = 18;
  const prof = Array.from({ length: N + 1 }, (_, i) => [R(i / N), (H * i) / N]);
  k.lathe(u, v, prof, col, { n });
  k.frustum(u, v, R(0) * 1.01 + 0.1, R(3 / H) * 1.01 + 0.1, 0, 3, '#5b5751', { n, top: false, mat: null, snow: false }); // Stützenkranz
  k.frustum(u, v, r1 - 0.2, r1 - 0.2, H - 7, H, shade(col, 0.28), { n, inside: true, mat: null, snow: false });
  k.ring(u, v, r1 - 0.2, H - 7, '#34322f', n, { mat: null, snow: false });
}

// ---------- Anlagenteile ----------

/** Lagertank: Mantel mit Nähten, Band in Teamfarbe, Treppe außen, Kegeldach oder (float) Schwimmdach in der Wand versenkt. */
function tank(k, u, v, r, H, o = {}) {
  const col = o.color ?? TANK;
  const n = 20;
  k.cyl(u, v, r, 0, H, col, { n, top: false });
  k.seam(u, v, r, H * 0.33, shade(col, 0.2), n);
  k.seam(u, v, r, H * 0.66, shade(col, 0.2), n);
  if (o.band) {
    k.team = true;
    k.band(u, v, r, H - 3.4, H - 1.6, o.band, n);
    k.team = false;
  }
  if (o.float) {
    k.frustum(u, v, r - 0.1, r - 0.1, H - 1.8, H, shade(col, 0.2), { n, inside: true, mat: null, snow: false });
    k.ring(u, v, r * 0.95, H - 1.8, '#b8bdc2', n, { mat: null });
  } else k.coneRoof(u, v, r, H, r * 0.2, '#dfe3e7', n);
  k.rod([u - r * 0.15, v + r * 0.99, 0], [u - r * 0.86, v + r * 0.5, H], 0.9, '#464b55'); // Treppe
}

/** Auffangwanne (niedrige Betonmauer) um [u0,u1]×[v0,v1] auf allen vier Seiten. */
function bund(k, u0, u1, v0, v1, h = 2.2) {
  for (const b of [[u0, u0 + 1, v0, v1], [u0, u1, v0, v0 + 1], [u0, u1, v1 - 1, v1], [u1 - 1, u1, v0, v1]]) k.box(b[0], b[1], b[2], b[3], 0, h, CONCRETE, CONCRETE, { mat: 'concrete' });
}

/** Destillationskolonne: Zylinder mit Bühnen (Geländer gelb), Leiter, Haube oben. */
function column(k, u, v, r, H, o = {}) {
  const col = o.color ?? '#d3d7db';
  const step = o.step ?? 11;
  const n = 14;
  let h = 0;
  while (h < H - 0.1) {
    const h1 = Math.min(H, h + step);
    k.cyl(u, v, r, h, h1, col, { n, top: false });
    if (h1 < H - 2) {
      k.cyl(u, v, r + 1.7, h1 - 0.6, h1, '#6d757c', { n });
      k.band(u, v, r + 1.7, h1 + 0.9, h1 + 1.6, '#c8aa28', n);
    }
    h = h1;
  }
  k.cap(u, v, r, H, col, 0.5, n, 3);
  k.rod([u - r * 0.72, v + r * 0.72, 0], [u - r * 0.72, v + r * 0.72, H], 0.6, '#464b55');
}

/** Winderhitzer (Cowper): hoher Stahlzylinder mit Kuppel. */
function cowper(k, u, v, r, H) {
  k.cyl(u, v, r, 0, H, '#8f959a', { n: 16, top: false });
  for (const f of [0.25, 0.5, 0.75]) k.seam(u, v, r, H * f, '#555a60');
  k.cap(u, v, r, H, '#8f959a', 0.8, 16, 4);
}

/** Staubsack: Behälter mit Trichter auf Stützen. */
function dustCatcher(k, u, v, H) {
  for (const [a, b] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) k.rod([u + a, v + b, 0], [u + a, v + b, H * 0.42], 0.9, '#4b4f54');
  k.frustum(u, v, 1.6, 5.4, H * 0.2, H * 0.42, '#7c8085', { n: 14, top: false });
  k.cyl(u, v, 5.4, H * 0.42, H * 0.88, '#7c8085', { n: 14, top: false });
  k.cap(u, v, 5.4, H * 0.88, '#7c8085', 0.45, 14, 3);
}

/** Glühender Fleck am Boden (Schlacke, Rinne, Stichloch): Kreise aus dem Rand nach innen heller, leuchten selbst. */
function glow(k, u, v, h, r) {
  k.ring(u, v, r, h + 0.1, '#c8501e', 14, { emit: true, mat: null });
  k.ring(u, v, r * 0.72, h + 0.14, '#ff9a3a', 14, { emit: true, mat: null });
  k.ring(u, v, r * 0.4, h + 0.18, '#fff1a6', 12, { emit: true, mat: null });
}

/** Hochofen: Gestell, Rast, Schacht aus Stahl mit Rost, Ringleitung, Gichtbühne, Gasabzüge, Stahlgerüst, Glut am Stichloch. */
function furnace(k, u, v, H) {
  const f = 11;
  const n = 20;
  for (const [a, b] of [[-f, -f], [f, -f], [-f, f], [f, f]]) k.rod([u + a, v + b, 0], [u + a * 0.62, v + b * 0.62, H * 0.84], 1.4, '#45494e');
  for (const h of [H * 0.3, H * 0.55]) {
    const q = f * 0.8;
    for (const [a, b, c, d] of [[-q, q, q, q], [q, q, q, -q], [q, -q, -q, -q], [-q, -q, -q, q]]) k.rod([u + a, v + b, h], [u + c, v + d, h], 0.6, '#45494e');
  }
  k.cyl(u, v, 8.6, 0, 9, '#4a4643', { n, top: false });
  k.frustum(u, v, 9.2, 10.6, 9, 14, RUST, { n, top: false });
  k.frustum(u, v, 10.6, 7, 14, H * 0.72, RUST, { n, top: false });
  for (const h of [H * 0.35, H * 0.52]) k.seam(u, v, 10.6 - (3.6 * (h - 14)) / (H * 0.72 - 14), h, '#2a1f19', n);
  k.band(u, v, 11.4, 11, 13.4, '#5d5550', n); // Ringleitung
  k.cyl(u, v, 8.6, H * 0.72, H * 0.76, '#5b5f63', { n }); // Gichtbühne
  for (const [a, b] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) k.pipe([[u + a, v + b, H * 0.76], [u + a * 0.9, v + b * 0.9, H * 0.93], [u, v, H]], 1.9, '#6f6a64');
  k.cyl(u, v, 1.8, H - 1, H + 3, '#6f6a64', { n: 10 });
  tapHole(k, u + 8.75 * Math.SQRT1_2, v + 8.75 * Math.SQRT1_2, 1.6, 4);
}

/** Glühendes Stichloch an der Wand des Hochofens (senkrecht, zur Vorderseite +u +v gewandt): drei Scheiben, leuchten selbst. */
function tapHole(k, u, v, h, r) {
  const d = Math.SQRT1_2;
  const disc = (rr, col, off) => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      const a = Math.cos(t) * rr;
      pts.push([u + a * d + off * d, v - a * d + off * d, h + Math.sin(t) * rr * 0.75]);
    }
    k.poly(pts, col, { emit: true, mat: null, n: [1, 1, 0] });
  };
  disc(r, '#c8501e', 0);
  disc(r * 0.72, '#ff9a3a', 0.05);
  disc(r * 0.4, '#fff1a6', 0.1);
}

/** Torpedowagen auf Schienen (entlang u): Drehgestelle, liegender Behälter, Öffnung mit Glut. */
function torpedo(k, u, v) {
  k.box(u - 7, u - 2.5, v - 1.6, v + 1.6, 0.3, 1.9, '#3a3d40', '#3a3d40', { mat: null });
  k.box(u + 2.5, u + 7, v - 1.6, v + 1.6, 0.3, 1.9, '#3a3d40', '#3a3d40', { mat: null });
  k.hcyl('u', u - 6.5, u + 6.5, v, 4.6, 2.8, '#6e5a4d', 14);
  k.ring(u, v, 1.4, 7.4 + 0.05, HOT, 10, { emit: true, mat: null });
}

/** Erzwagen (Selbstentlader) auf Schienen entlang u. */
function hopper(k, u, v, load = '#8a4b2e') {
  k.box(u - 5.5, u - 2, v - 1.6, v + 1.6, 0.3, 1.9, '#3a3d40', '#3a3d40', { mat: null });
  k.box(u + 2, u + 5.5, v - 1.6, v + 1.6, 0.3, 1.9, '#3a3d40', '#3a3d40', { mat: null });
  k.box(u - 5.5, u + 5.5, v - 2.3, v + 2.3, 1.9, 5.6, '#5a4a40', '#6a5a50', { mat: null });
  k.box(u - 5, u + 5, v - 1.8, v + 1.8, 5.6, 6.3, load, load, { mat: null });
}

/** Offenes Vordach auf Stützen (Verladestation): Dach auf Höhe H mit Rand in Teamfarbe. */
function canopy(k, u0, u1, v0, v1, H, team) {
  for (let a = u0 + 1; a <= u1 - 0.9; a += (u1 - u0 - 2) / 3) for (const b of [v0 + 1, v1 - 1]) k.rod([a, b, 0], [a, b, H], 1, '#6b7177');
  k.box(u0, u1, v0, v1, H, H + 1.2, '#d9dcde', '#c9cdd0', { mat: null });
  k.team = true;
  k.wallBand(u0, u1, v0, v1, H + 0.2, H + 1, team);
  k.team = false;
}

/** Kleines Verwaltungsgebäude mit Fenstern (alle vier Seiten), Tür und Dach (hip: Walmdach, sonst Flachdach mit Attika). */
function office(k, u0, u1, v0, v1, H, wall, o = {}) {
  walls(k, u0, u1, v0, v1, H, wall);
  const n = Math.max(2, Math.round((u1 - u0) / 4));
  const m = Math.max(1, Math.round((v1 - v0) / 4));
  const rows = H > 9 ? [[2.2, 4.4], [6.8, 9]] : [[2.2, 4.6]];
  const seed = o.seed ?? 3;
  k.wins('s', v1, u0, u1, n, rows, 2.2, { seed, lit: 0.25 });
  k.wins('e', u1, v0, v1, m, rows, 2.2, { seed: seed + 5, lit: 0.25 });
  k.wins('n', v0, u0, u1, n, rows, 2.2, { seed: seed + 2, lit: 0.25 }); // Rückseiten
  k.wins('w', u0, v0, v1, m, rows, 2.2, { seed: seed + 7, lit: 0.25 });
  k.door('s', v1, u0 + (u1 - u0) * 0.5, 2.6, 4.2, '#4f5a63');
  if (o.hip) k.hip(u0, u1, v0, v1, H, 4, o.roof ?? '#7a4a3a');
  else {
    flatRoof(k, u0, u1, v0, v1, H, wall);
    k.acUnit(u0 + (u1 - u0) * 0.3, v0 + (v1 - v0) * 0.45, H - 1.3);
  }
}

/** Transformator: Kessel mit Kühlrippen, Ausgleichsbehälter, drei Durchführungen. */
function transformer(k, u, v) {
  k.box(u - 3, u + 3, v - 2.4, v + 2.4, 0, 5, '#77818a', '#87919a', { mat: null });
  k.ribs(u - 3, u + 3, v - 2.4, v + 2.4, 0.8, 4.4, 0.7, '#77818a');
  k.box(u - 2.6, u + 0.6, v - 2.2, v - 0.8, 5, 6.6, '#87919a', '#87919a', { mat: null });
  for (const a of [-1.6, 0.2, 2]) k.cyl(u + a, v + 1, 0.42, 5, 8.4, '#9b6a45', { n: 6 });
}

/** Strommast (Gitter, ohne Warnlicht) mit zwei Traversen quer zur Leitung (entlang v). */
function pylon(k, u, v, H) {
  k.mast(u, v, 0, H, 2.4, 0.8, '#9ba2a8', false);
  for (const [h, w] of [[H - 2, 4.5], [H - 7, 6]]) {
    k.rod([u, v - w, h], [u, v + w, h], 0.8, '#9ba2a8');
    for (const s of [-w, w]) k.rod([u, v + s, h], [u, v + s, h - 1.8], 0.6, '#4a4f55');
  }
}

/** Zaunstück zwischen zwei Bodenpunkten (Pfosten, zwei Drähte). */
function fenceLine(k, a, b, h = 3.6) {
  const col = '#424850';
  for (const hh of [h, h * 0.55]) k.rod([a[0], a[1], hh], [b[0], b[1], hh], 0.4, col);
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.5));
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    k.rod([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, h + 0.3], 0.55, col);
  }
}

/** Erdbunker: Tonne mit Grasdecke (First entlang u), vorn (u1) Stirnwand aus Beton mit Stahltor, Lüfter oben. */
function bunker(k, u0, u1, v0, v1, H) {
  const vm = (v0 + v1) / 2;
  k.box(u1 - 0.6, u1 + 2.2, v0 - 1.4, v0 + 0.4, 0, H * 0.7, CONCRETE, CONCRETE, { mat: 'concrete' }); // hintere Flügelmauer
  k.vault('u', u0, u1, v0, v1, 0.8, H, GRASS, CONCRETE, 12, null);
  k.cyl(u0 + (u1 - u0) * 0.35, vm, 0.8, H + 0.6, H + 3.2, '#8a9096', { n: 8 });
  gate(k, 'e', u1, vm, (v1 - v0) * 0.42, H * 0.55, '#6c757b');
  k.facePanel('e', u1, vm - 1.2, vm + 1.2, H * 0.62, H * 0.62 + 1, '#e3c43a', 0.14, { mat: null, snow: false }); // Warnschild
  k.box(u1 - 0.6, u1 + 2.2, v1 - 0.4, v1 + 1.4, 0, H * 0.7, CONCRETE, CONCRETE, { mat: 'concrete' }); // vordere Flügelmauer
  gate(k, 'w', u0, vm, (v1 - v0) * 0.3, H * 0.4, '#6c757b'); // Rückseite: Notausgang
}

/** LKW entlang u oder v (Fahrerhaus vorn bei +u bzw. +v); load: 'bricks', 'tank', 'tarp', 'coal', 'ore', 'logs'. */
function lorry(k, u, v, along, cabCol, load, o = {}) {
  const U = along === 'u';
  const L = 7;
  const W = 2.3;
  const bx = (a0, a1, c0, c1, h0, h1, col, top = col) =>
    U ? k.box(u + a0, u + a1, v + c0, v + c1, h0, h1, col, top, { mat: null }) : k.box(u + c0, u + c1, v + a0, v + a1, h0, h1, col, top, { mat: null });
  for (const a of [-5, -2.6, 4.8]) {
    bx(a - 1, a + 1, W - 0.4, W + 0.1, 0, 1.9, '#2f3134'); // Räder
    bx(a - 1, a + 1, -W - 0.1, -W + 0.4, 0, 1.9, '#2f3134');
  }
  bx(-L, L - 0.2, -W + 0.4, W - 0.4, 0.9, 1.7, '#3a3d40');
  const bed = L - 3.8;
  if (load === 'tank') {
    bx(-L, bed, -W + 0.2, W - 0.2, 1.7, 5.4, o.tank ?? TANK, tint(o.tank ?? TANK, 0.1));
    if (o.band) bx(-L + 0.6, bed - 0.6, -W + 0.15, W - 0.15, 3.2, 4, o.band);
  } else if (load === 'tarp') bx(-L, bed, -W, W, 1.7, 6.2, OLIVE, tint(OLIVE, 0.1));
  else if (load === 'coal' || load === 'ore') {
    bx(-L, bed, -W, W, 1.7, 4.6, '#d29b1d', '#e3b02c');
    bx(-L + 0.5, bed - 0.5, -W + 0.5, W - 0.5, 4.6, 5.2, load === 'coal' ? COAL : '#8a4b2e');
  } else {
    bx(-L, bed, -W, W, 0.9, 2.3, '#6d5a45', '#7d6a55');
    if (load === 'bricks') for (const a of [-4.8, -1.4]) bx(a - 1.5, a + 1.5, -1.7, 1.7, 2.3, 4.8, BRICKS, tint(BRICKS, 0.1));
    if (load === 'logs' && U) k.logPile(u - L + 0.4, u + bed - 0.4, v - W + 0.3, v + W - 0.3, 2);
  }
  bx(L - 3.4, L, -W, W, 1.7, 5.8, cabCol, tint(cabCol, 0.1));
  if (U) k.facePanel('e', u + L, v - W + 0.4, v + W - 0.4, 3.6, 5.3, '#2c3a47', 0.06, { mat: null, snow: false });
  else k.facePanel('s', v + L, u - W + 0.4, u + W - 0.4, 3.6, 5.3, '#2c3a47', 0.06, { mat: null, snow: false });
}

/** Palette mit Ziegeln (oder anderer Ware), Kantenlänge 2s, Höhe h. */
function pallet(k, u, v, s = 2.2, h = 3.2, col = BRICKS) {
  k.box(u - s, u + s, v - s, v + s, 0, 0.6, '#9c7a52', '#9c7a52', { mat: 'wood' });
  k.box(u - s + 0.2, u + s - 0.2, v - s + 0.2, v + s - 0.2, 0.6, h, col, tint(col, 0.1), { mat: null });
}

/** Gabelstapler (orange) mit Palette auf der Gabel nach +u. */
function forklift(k, u, v, col = BRICKS) {
  k.box(u - 2.4, u + 1.6, v - 1.5, v + 1.5, 0.5, 2.8, '#e08a1e', '#eea040', { mat: null });
  for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) k.rod([u + a * 0.9, v + b * 0.9, 2.8], [u + a * 0.9, v + b * 0.9, 5.6], 0.5, '#3a3d40');
  k.box(u - 1.8, u + 1.8, v - 1.6, v + 1.6, 5.6, 6, '#3a3d40', '#3a3d40', { mat: null });
  for (const b of [-1, 1]) k.rod([u + 2, v + b, 0], [u + 2, v + b, 6.4], 0.7, '#3a3d40');
  pallet(k, u + 3.6, v, 1.4, 2.6, col);
}

/** Radlader (gelb) mit Schaufel nach +u. */
function loader(k, u, v) {
  for (const [a, b] of [[u - 2.6, v - 2.2], [u + 2, v - 2.2], [u - 2.6, v + 2.2], [u + 2, v + 2.2]]) k.box(a - 1.1, a + 1.1, b - 0.5, b + 0.5, 0, 2.2, '#2f3134', '#2f3134', { mat: null });
  k.box(u - 3.8, u + 3, v - 1.8, v + 1.8, 1, 3.6, '#e2b021', '#e9c24a', { mat: null });
  k.box(u - 3.4, u - 0.6, v - 1.6, v + 1.6, 3.6, 6.6, '#e2b021', '#e9c24a', { mat: null });
  for (const [f, pl] of [['s', v + 1.6], ['n', v - 1.6]]) k.facePanel(f, pl, u - 3.4, u - 0.6, 4.4, 6.2, '#34506d', 0.06, { mat: null, snow: false });
  k.box(u + 3.4, u + 5.4, v - 2.2, v + 2.2, 0.4, 2.4, '#5d6064', '#5d6064', { mat: null });
}

/** Bagger (gelb) mit Ausleger nach +u, auf Höhe h. */
function excavator(k, u, v, h) {
  k.box(u - 3.5, u + 3.5, v - 2.6, v + 2.6, h, h + 1.6, '#3b3b3b', '#3b3b3b', { mat: null });
  k.box(u - 3, u + 2.2, v - 2.2, v + 2.2, h + 1.6, h + 4, '#e2b021', '#e9c24a', { mat: null });
  k.box(u - 0.2, u + 2.2, v - 2.2, v - 0.2, h + 4, h + 6.6, '#e2b021', '#e9c24a', { mat: null });
  k.rod([u + 1.6, v, h + 4], [u + 6.5, v, h + 8.6], 1.3, '#d39d14');
  k.rod([u + 6.5, v, h + 8.6], [u + 9.4, v, h + 3], 1.3, '#d39d14');
  k.box(u + 8.4, u + 10.8, v - 1, v + 1, h + 0.8, h + 3.4, '#5d6064', '#5d6064', { mat: null });
}

/** Geschoss-Denkmal: Betonsockel, Messinghülse, olivgrünes Geschoss mit gelbem Ring und Kupfer-Führungsband. */
function shellMonument(k, u, v, r, H) {
  k.box(u - r - 2.2, u + r + 2.2, v - r - 2.2, v + r + 2.2, 0, 2.6, '#c4bfb3', '#d1ccc0', { mat: 'concrete' });
  k.facePanel('s', v + r + 2.2, u - r, u + r, 0.7, 1.9, '#6b5a3a', 0.06, { mat: null, snow: false }); // Tafel
  const h0 = 2.6;
  const n = 14;
  k.cyl(u, v, r, h0, h0 + H * 0.42, BRASS, { n, top: false });
  k.seam(u, v, r, h0 + H * 0.12, '#8a5f1a', n);
  k.cyl(u, v, r * 1.01, h0 + H * 0.42, h0 + H * 0.47, '#b5643a', { n, top: false, mat: null });
  k.cyl(u, v, r * 0.97, h0 + H * 0.47, h0 + H * 0.7, OLIVE, { n, top: false });
  k.band(u, v, r * 0.97, h0 + H * 0.6, h0 + H * 0.64, '#e3c43a', n);
  k.cap(u, v, r * 0.97, h0 + H * 0.7, OLIVE, (H * 0.3) / (r * 0.97), n, 5);
}

/** Wachturm: vier Stelzen, Kanzel mit Fenstern und Dach. */
function watchtower(k, u, v, H) {
  for (const [a, b] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) k.rod([u + a, v + b, 0], [u + a * 0.8, v + b * 0.8, H], 0.9, '#5d5850');
  k.box(u - 3, u + 3, v - 3, v + 3, H, H + 4.2, '#8a8270', '#9a927f', { mat: null });
  const rows = [[H + 1.6, H + 3.6]];
  k.wins('s', v + 3, u - 3, u + 3, 2, rows, 2.2, { frame: false, lit: 0.3 });
  k.wins('e', u + 3, v - 3, v + 3, 2, rows, 2.2, { frame: false, lit: 0.3 });
  k.wins('n', v - 3, u - 3, u + 3, 2, rows, 2.2, { frame: false, lit: 0.3, seed: 4 });
  k.wins('w', u - 3, v - 3, v + 3, 2, rows, 2.2, { frame: false, lit: 0.3, seed: 8 });
  k.hip(u - 3, u + 3, v - 3, v + 3, H + 4.2, 2.6, '#4f5348');
}

/** Wasserturm: vier Stelzen mit Kreuzverband, Behälter mit Band in Teamfarbe und Kegeldach. */
function waterTower(k, u, v, H) {
  const L = H - 7;
  const lp = (a, b, h) => [u + a * (1 - 0.22 * (h / L)), v + b * (1 - 0.22 * (h / L)), h];
  for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) k.rod(lp(a, b, 0), lp(a, b, L), 0.9, '#6d7277');
  const sides = [[[-3, 3], [3, 3]], [[3, 3], [3, -3]], [[3, -3], [-3, -3]], [[-3, -3], [-3, 3]]];
  for (const [h0, h1] of [[0, L / 2], [L / 2, L]]) {
    for (const [p, q] of sides) {
      k.rod(lp(p[0], p[1], h0), lp(q[0], q[1], h1), 0.45, '#7d8287');
      k.rod(lp(q[0], q[1], h0), lp(p[0], p[1], h1), 0.45, '#7d8287');
    }
  }
  k.cyl(u, v, 4.6, L, H, '#b9c0c5', { n: 16, top: false });
  k.team = true;
  k.band(u, v, 4.6, H - 3.4, H - 2.2, TEAM0, 16);
  k.team = false;
  k.coneRoof(u, v, 4.9, H, 2.8, '#7d8287', 16);
}

// ---------- Kerosin-Raffinerie ----------

/** Rundtank mit gewölbtem Dach und zwei blauen Tankringen. */
function keroTank(k, u, v, r, H) {
  const n = 20;
  k.cyl(u, v, r, 0, H, KTANK, { n, top: false });
  k.seam(u, v, r, H * 0.5, '#a9b2ba', n);
  for (const f of [0.22, 0.68]) k.band(u, v, r, H * f, H * f + 1.9, BLUE, n);
  k.cap(u, v, r, H, '#e2e7eb', 0.32, n, 4);
  k.rod([u - r * 0.15, v + r * 0.99, 0], [u - r * 0.86, v + r * 0.5, H], 0.9, '#283c5a'); // Treppe
}

/** Kugeltank mit blauem Gürtel am Äquator. */
function keroSphere(k, u, v, r, h0) {
  k.sphere(u, v, r, h0);
  k.cyl(u, v, r + 0.08, h0 + r - 0.8, h0 + r + 0.8, BLUE, { n: 14, top: false, mat: null, snow: false });
}

/** Liegender Drucktank entlang u auf Betonsätteln, mit blauem Ring in der Mitte. */
function bullet(k, u0, u1, v, r) {
  const h = r + 1.2;
  for (const a of [u0 + 3, u1 - 3]) k.box(a - 0.9, a + 0.9, v - r * 0.8, v + r * 0.8, 0, h - r * 0.4, CONCRETE, CONCRETE, { mat: 'concrete' });
  k.hcyl('u', u0, u1, v, h, r, KTANK, 14);
  const m = (u0 + u1) / 2;
  k.hcyl('u', m - 0.6, m + 0.6, v, h, r + 0.06, BLUE, 14, { snow: false });
}

// ---------- Anlagen ----------

function power(k, lv) {
  const T = TEAM0;
  ground(k, CONCRETE);
  fl(k, -E, -20, -6, E, '#57534b'); // Kohlelager
  fl(k, 14, E, 26, E, GRAVEL); // Umspannwerk
  fl(k, -18, 12, 34, E, ASPH); // Parkplatz
  stalls(k, -16, 10, 44, 54);
  grass(k, -18, 12, 12, 34);
  const CH = [0, 92, 102, 112][lv];
  k.stack(-46, -46, 5.8, 4.2, CH, { bands: lv >= 3 ? 3 : 2, light: true });
  k.box(-46, -38, -45, -40, 24, 30, '#8f9499', '#8f9499', { mat: null }); // Rauchgaskanal zum Schornstein
  if (lv >= 2) {
    // Rauchgaswäsche (REA) hinter dem Maschinenhaus
    k.box(-12, -6, -49, -45, 27, 31, '#8f9499', '#8f9499', { mat: null });
    k.cyl(-2, -50, 6.4, 0, 36, '#c9cdd1', { n: 16, top: false });
    k.seam(-2, -50, 6.4, 12, '#8d9296');
    k.seam(-2, -50, 6.4, 24, '#8d9296');
    k.cap(-2, -50, 6.4, 36, '#c9cdd1', 0.3, 16, 3);
  }
  // Kesselhaus
  const BH = [0, 40, 46, 50][lv];
  walls(k, -38, -12, -40, -16, BH, '#c4c9cd', { ribs: 2.2 });
  for (let h = 8; h < BH - 4; h += 9) {
    stripAll(k, [-38, -12, -40, -16], h, h + 1.8, -35, -21, 's', 2.8);
    stripAll(k, [-38, -12, -40, -16], h, h + 1.8, -37, -19, 'e', 2.8);
  }
  flatRoof(k, -38, -12, -40, -16, BH, '#c4c9cd');
  k.fan(-30, -30, BH - 1.3, 2.2);
  k.acUnit(-20, -34, BH - 1.3, 2.6);
  walls(k, -19, -13, -16, -11, BH + 4, '#aeb4b9'); // Treppenhaus
  strip(k, 's', -11, -18, -14, 3, BH + 1, 10);
  flatRoof(k, -19, -13, -16, -11, BH + 4, '#aeb4b9');
  // Maschinenhaus mit hohen Fenstern und Band in Teamfarbe
  walls(k, -10, 10, -38, -18, 22, '#dcd6c8', { band: T, team: true });
  k.wins('s', -18, -10, 10, 5, [[3, 17.5]], 2.2, { frame: false, lit: 0.12, seed: 5 });
  k.wins('e', 10, -38, -18, 4, [[3, 17.5]], 2.2, { frame: false, lit: 0.12, seed: 9 });
  k.wins('n', -38, -10, 10, 5, [[3, 17.5]], 2.2, { frame: false, lit: 0.12, seed: 6 });
  k.wins('w', -10, -38, -18, 4, [[3, 17.5]], 2.2, { frame: false, lit: 0.12, seed: 10 });
  k.gable('u', -10, 10, -38, -18, 22, 3, '#7d8287', '#dcd6c8');
  // Kohle in langen Mieten, Radlader, Förderbrücke zum Kesselhaus
  k.mound(-55, -42, -2, 52, lv >= 3 ? 9 : 7.5, COAL);
  if (lv >= 3) k.mound(-39, -31, 4, 22, 5.5, COAL);
  k.gallery([-28, 26, 3], [-28, -16, 33], 3.2, 3, '#a9adb0');
  if (lv >= 2) k.mound(-39, -31, 32, 55, 6, COAL);
  if (lv >= 2) loader(k, -35, 27);
  // Kühlwasser-Pumpenhaus mit Leitungen zum Kühlturm
  k.pipe([[28, -1, 1.4], [33.5, -1, 1.4], [33.5, -21, 1.4]], 1.3, '#7f8d96');
  k.pipe([[28, 3, 1.4], [36.5, 3, 1.4], [36.5, -20, 1.4]], 1.3, '#7f8d96');
  walls(k, 16, 28, -5, 7, 7, '#c9c4b4');
  k.wins('s', 7, 16, 28, 3, [[2.6, 4.8]], 2, { frame: false, lit: 0.2, seed: 3 });
  k.wins('n', -5, 16, 28, 3, [[2.6, 4.8]], 2, { frame: false, lit: 0.2, seed: 4 });
  k.wins('w', 16, -5, 7, 3, [[2.6, 4.8]], 2, { frame: false, lit: 0.2, seed: 5 });
  k.door('e', 28, 1, 2.4, 4.4);
  flatRoof(k, 16, 28, -5, 7, 7, '#c9c4b4');
  // Kühltürme rechts hinten, ab Stufe 3 ein zweiter davor
  const big = lv >= 2;
  coolingTower(k, 39, -39, big ? 19.5 : 18.5, big ? 12.9 : 12.2, big ? 13.9 : 13.2, big ? 60 : 54);
  if (lv >= 3) coolingTower(k, 44, -11, 14, 9.4, 10.1, 44);
  // Verwaltung, Fahne, Autos, Laternen, Bäume
  office(k, -12, 8, 16, 30, 12, '#e3ddd0', { seed: 21 });
  k.flagpole(-15, 32, 0, 17, T, true);
  [[-13, 49], [-2, 49], [3.5, 49]].slice(0, lv).forEach(([u, v], i) => k.car(u, v, 'v', CAR_COLORS[(i * 3 + 1) % CAR_COLORS.length]));
  k.lamp(12, 33, 9);
  k.tree(-6, 55, 0.85, 1);
  k.tree(8, 56, 0.8, 2);
  // Umspannwerk: Transformatoren, Masten, Leitungen
  const tr = [[24, 36], [24, 48], [33, 54]].slice(0, lv);
  tr.forEach(([u, v]) => transformer(k, u, v));
  pylon(k, 46, 32, 22);
  pylon(k, 46, 50, 22);
  for (const [u, v] of tr) k.wire([u + 0.2, v + 1, 8.4], [46, v < 42 ? 32 : 50, 20], 1.5);
  for (const v of [32, 50]) for (const s of [-4.5, 4.5]) k.wire([46, v + s, 20], [E, v + s * 0.8, 21], 1);
}

function bm(k, lv) {
  const T = TEAM0;
  ground(k, '#b9a37d');
  fl(k, -56, -14, -2, 30, '#c2b8a6'); // Palettenlager (gepflastert)
  fl(k, -8, 8, 4, E, ASPH); // Zufahrt
  grass(k, 14, E, 24, E);
  // Ringofen mit Ziegelschornstein in der Mitte
  const SH = [0, 46, 52, 58][lv];
  walls(k, -54, -14, -54, -38, 8, BRICK);
  const arch = (face, plane, a, w, h, hot) => {
    const r = w / 2;
    const pts = [[a - r, 0], [a + r, 0]];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI;
      pts.push([a + r * Math.cos(t), h - r + r * Math.sin(t)]);
    }
    k.facePoly(face, plane, pts, hot ? (face === 's' ? '#f19a3c' : '#d9802c') : '#2d2420', 0.1, { emit: hot });
  };
  for (let a = -50.5, i = 0; a <= -17; a += 6.6, i++) {
    arch('s', -38, a, 3, 5.6, i % 3 === 1);
    arch('n', -54, a, 3, 5.6, false); // Rückseite
  }
  arch('e', -14, -46, 3, 5.6, false);
  arch('w', -54, -46, 3, 5.6, false);
  k.gable('u', -54, -14, -54, -38, 8, 5, '#5e5049', BRICK);
  brickStack(k, -34, -46, 3.6, 2.5, SH);
  // Lehmhalde mit Bagger und Förderband zum Ofen
  k.heap(30, -42, 12, 9, '#a5653f');
  if (lv >= 2) {
    excavator(k, 20, -30, 0);
    k.conveyor(18, -47, 1.5, -13, -47, 6.5, 1.6);
  }
  // Trockenschuppen mit Rohlingen; Stufe 3: geschlossener Tunnelofen mit Stahlkaminen
  const rawRacks = (u0, u1, v0, v1) => () => {
    for (let b = v0 + 1.6; b < v1 - 1; b += 2.6) k.box(u0 + 1, u1 - 1, b - 0.8, b + 0.8, 0, 3.4, RAW, tint(RAW, 0.12), { mat: null });
  };
  shed(k, -54, -16, -32, -20, 5, 2.6, '#6a5b4e', rawRacks(-54, -16, -32, -20));
  if (lv === 2) shed(k, -54, -16, -16, -5, 5, 2.6, '#6a5b4e', rawRacks(-54, -16, -16, -5));
  if (lv >= 3) {
    walls(k, -54, -16, -16, -5, 9, '#b8bec2', { ribs: 2, band: T, team: true });
    gate(k, 'e', -16, -10.5, 5, 6.5);
    gate(k, 'w', -54, -10.5, 5, 6.5);
    stripAll(k, [-54, -16, -16, -5], 5.5, 7.2, -50, -22, 's', 3);
    flatRoof(k, -54, -16, -16, -5, 9, '#b8bec2');
    k.stack(-44, -11, 1.5, 1.3, 26, { color: '#9aa1a8', n: 10 });
    k.stack(-30, -11, 1.5, 1.3, 26, { color: '#9aa1a8', n: 10 });
  }
  // Holzlager mit Stämmen und Brettern; Stufe 2: Sägeschuppen
  k.logPile(14, 40, -24, -15, 2);
  planks(k, 44, 54, -24, -14, 3.6);
  if (lv >= 2) {
    k.logPile(14, 40, -11, -2, 2);
    shed(k, 14, 40, 3, 13, 5.5, 3, '#6a5b4e', () => {
      k.box(18, 34, 7, 9, 0, 2.6, '#6d7277', '#8a8f94', { mat: null });
      planks(k, 36, 39, 5, 11, 2);
    });
  }
  // Palettenlager mit Ziegeln, Gabelstapler
  const n = [0, 8, 14, 20][lv];
  let i = 0;
  for (const c of [5, 12, 19, 26]) for (const a of [-50, -43, -36, -29, -22]) if (i++ < n) pallet(k, a, c, 2.4, 2.8 + rnd(i * 13) * 1.4);
  if (lv >= 2) forklift(k, -14, 12);
  // Büro mit Fahne, LKW mit Ziegeln, Bäume
  office(k, 22, 42, 28, 42, 10, '#ebe3d2', { hip: true, roof: '#8a4a36', seed: 13 });
  k.flagpole(18, 46, 0, 16, T, true);
  lorry(k, 0, 38, 'v', '#c8463a', 'bricks');
  if (lv >= 3) lorry(k, 28, 18, 'u', '#3a6fb3', 'logs');
  k.car(34, 50, 'u', CAR_COLORS[1]);
  k.lamp(9, 26, 9);
  k.tree(52, 8, 0.9, 0);
  k.tree(56, 22, 0.8, 1);
  k.tree(16, 56, 0.85, 2);
}

/** Offener Schuppen: Stützen, Inhalt (fill), Satteldach. */
function shed(k, u0, u1, v0, v1, H, rh, roof, fill) {
  for (const [a, b] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) k.rod([a, b, 0], [a, b, H], 1, '#6b5a48');
  fill?.();
  k.gable('u', u0, u1, v0, v1, H, rh, roof, '#8b6a48');
}

/** Bretterstapel. */
function planks(k, u0, u1, v0, v1, h) {
  k.box(u0, u1, v0, v1, 0, h, '#d4ad78', '#e2c28f', { mat: 'wood' });
}

function mun(k, lv) {
  const T = TEAM0;
  ground(k, '#8f9579');
  fl(k, -12, 2, -24, E, ASPH); // Werkstraße zum Tor
  fl(k, -54, -20, 4, 44, '#9b9f8c'); // Kistenlager
  grass(k, 18, E, 20, E);
  fl(k, 6, 34, 2, 20, ASPH); // Fahrzeughof
  stalls(k, 7.5, 30.5, 3, 19, 8);
  fenceLine(k, [-56, 56], [-56, -56]);
  fenceLine(k, [-56, -56], [56, -56]);
  // Fertigungshalle mit Sheddach und Lüftern
  walls(k, -52, -8, -52, -28, 11, '#a3a993', { band: T, team: true });
  stripAll(k, [-52, -8, -52, -28], 4, 7.2, -50, -22, 's', 3);
  gate(k, 's', -28, -15, 6, 7.5);
  gate(k, 'e', -8, -40, 7, 7.5);
  gate(k, 'n', -52, -30, 6, 7.5);
  sawRoof(k, -52, -8, -52, -28, 11, 5, 4, '#6d7368', '#a3a993');
  if (lv >= 2) {
    for (const u of [-45, -27]) {
      k.cyl(u, -31, 1.4, 11, 22, '#9aa1a8', { n: 10, top: false });
      k.cyl(u, -31, 1.8, 21, 22.6, '#7d848a', { n: 10 });
    }
  }
  // Erdbunker
  bunker(k, 8, 46, -52, -38, 9);
  if (lv >= 2) bunker(k, 8, 46, -32, -18, 9);
  if (lv >= 3) {
    bunker(k, 8, 46, -12, 2, 9);
    walls(k, -52, -24, -20, -2, 9, '#b0b49f');
    gate(k, 's', -2, -31, 6, 6.5);
    gate(k, 'n', -20, -38, 6, 6.5);
    stripAll(k, [-52, -24, -20, -2], 4, 6.4, -50, -36, 's', 3);
    flatRoof(k, -52, -24, -20, -2, 9, '#b0b49f');
  }
  waterTower(k, 52, -47, 26);
  // Kisten (gestapelt), Gabelstapler, LKW mit Plane, Militär-LKW im Fahrzeughof (je Stufe einer mehr)
  const n = [0, 6, 9, 12][lv];
  let i = 0;
  for (const c of [10, 20, 30, 40]) {
    for (const a of [-49, -40, -31]) {
      if (i++ >= n) continue;
      const h = 2.6 * (1 + Math.floor(rnd(i * 7) * 2.4));
      k.box(a - 3, a + 3, c - 3, c + 3, 0, 0.6, '#9c7a52', '#9c7a52', { mat: 'wood' });
      k.box(a - 2.8, a + 2.8, c - 2.8, c + 2.8, 0.6, h, '#596440', '#69744c', { mat: null });
    }
  }
  if (lv >= 2) forklift(k, -20, 14, '#596440');
  lorry(k, -5, 26, 'v', OLIVE, 'tarp');
  [11, 19, 27].slice(0, lv).forEach((u) => lorry(k, u, 11, 'v', OLIVE, 'tarp'));
  // Tor mit Wache und Schranke, Fahnen
  walls(k, 4, 10, 44, 50, 6, '#c9c4b4');
  k.wins('s', 50, 4, 10, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6 });
  k.wins('e', 10, 44, 50, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6 });
  k.wins('n', 44, 4, 10, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6, seed: 2 });
  k.wins('w', 4, 44, 50, 1, [[2.6, 4.6]], 2.6, { frame: false, lit: 0.6, seed: 3 });
  k.box(3.4, 10.6, 43.4, 50.6, 6, 7, '#55585b', '#55585b', { mat: null });
  k.box(-12, 3, 51.4, 52.2, 3.6, 4.4, '#e8e4d4', '#d23a3a', { mat: null });
  k.box(2.4, 3.6, 50.8, 52.8, 0, 5, '#d23a3a', '#d23a3a', { mat: null });
  k.flagpole(14, 54, 0, 16, T, true);
  k.flagpole(-16, 54, 0, 16, T, true);
  // Denkmal auf dem Rasen, Bäume
  shellMonument(k, 36, 38, 3 + lv * 0.4, 16 + lv * 3);
  k.tree(52, 24, 0.9, 0);
  k.tree(22, 52, 0.85, 1);
  k.tree(52, 50, 0.8, 2);
  if (lv >= 3) watchtower(k, -50, 50, 14);
  fenceLine(k, [-56, 56], [-12, 56]);
  fenceLine(k, [3, 56], [56, 56]);
  fenceLine(k, [56, 56], [56, -56]);
}

function fuel(k, lv) {
  const T = TEAM0;
  ground(k, '#a6aaac');
  fl(k, -56, -6, -56, -6, '#979891'); // Boden der Auffangwanne
  fl(k, -E, E, 2, 10, ASPH); // Werkstraße
  fl(k, -10, 0, 10, E, ASPH);
  bund(k, -56, -6, -56, -6);
  tank(k, -40, -40, 13, 12, { float: true, band: T });
  tank(k, -16, -44, 8.5, 10, {});
  if (lv >= 2) tank(k, -42, -17, 8.5, 10, { float: true, band: T });
  if (lv >= 3) tank(k, -19, -20, 7, 9, {});
  k.pipe([[-27, -40, 2.4], [-4, -40, 2.4], [-4, -40, 7.7]], 1.2);
  // Prozessanlage: Kolonnen, Ofen mit Kamin, Rohrbrücken, Fackel
  if (lv >= 3) {
    k.stack(52, -52, 1.4, 1.1, 66, { color: '#b9bfc4', bands: 2, n: 10 });
    flame(k, 52, -52, 66, 1.3);
  }
  if (lv >= 3) column(k, 12, -46, 3, 28);
  if (lv >= 2) column(k, 36, -42, 3.6, 34);
  if (lv >= 2) k.rack('v', -50, -6, 4, 7);
  column(k, 22, -28, 4.8, [0, 38, 48, 56][lv]);
  walls(k, 30, 46, -22, -10, 9, '#b9a48a');
  stripAll(k, [30, 46, -22, -10], 3, 4.6, 32, 44, 's', 2, true);
  flatRoof(k, 30, 46, -22, -10, 9, '#b9a48a');
  k.stack(41, -16, 1.9, 1.6, 30, { color: '#a7adb2', bands: 1, n: 12 });
  k.rack('u', -4, 54, -2, 7);
  // Kugeltanks
  if (lv >= 2) k.sphere(42, 22, 7.5, 3);
  if (lv >= 3) k.sphere(42, 42, 7.5, 3);
  // Verladestation mit Tankwagen
  canopy(k, -52, -22, 18, lv >= 2 ? 44 : 34, 7.5, T);
  lorry(k, -37, 26, 'u', '#d6d2c6', 'tank', { band: T });
  if (lv >= 2) lorry(k, -37, 38, 'u', '#c8463a', 'tank', { band: T });
  // Leitstand mit Fahne
  office(k, 4, 22, 36, 50, 8, '#e1dccf', { seed: 17 });
  k.flagpole(25, 52, 0, 16, T, true);
  k.lamp(1, 14, 9);
  k.lamp(1, 40, 9);
  k.tree(-14, 52, 0.85, 1);
  k.tree(52, 6, 0.8, 2);
}

/** Flamme (Fackel) über dem Punkt (u, v, h): Tropfenform aus Kegelstümpfen, außen orange, innen hell; leuchtet selbst. */
function flame(k, u, v, h, s = 1) {
  const drop = [[0.9, 0], [3.4, 0.2], [3.1, 0.42], [1.7, 0.74], [0, 1]];
  k.lathe(u, v, drop.map(([r, t]) => [r * s, h + 11 * s * t]), HOT, { n: 8, emit: true, mat: null });
  k.lathe(u, v, drop.map(([r, t]) => [r * s * 0.5, h + 0.2 + 7 * s * t]), '#fff2a8', { n: 6, emit: true, mat: null });
}

function steel(k, lv) {
  const T = TEAM0;
  ground(k, '#827d75');
  fl(k, -E, 12, 11, 21, '#6a655e'); // Gleisbett
  fl(k, -6, 6, 21, E, ASPH);
  k.rails(-E, 12, 16, k.fh + 0.02);
  if (lv >= 3) k.stack(52, -52, 3.4, 2.6, 80, { color: '#8e8a84', bands: 2, light: true });
  // Winderhitzer und Heißwindleitung
  const SH = [0, 34, 38, 42][lv];
  [-44, -30, -16, -2].slice(0, lv + 1).forEach((v) => cowper(k, -46, v, 5.2, SH));
  k.pipe([[-41, -24, 17], [-25, -24, 17]], 2.4, '#8b8f93');
  // Möllerbunker und Schrägaufzug zur Gicht
  walls(k, 12, 36, -54, -40, 10, '#8d8378');
  flatRoof(k, 12, 36, -54, -40, 10, '#8d8378');
  const H = [0, 52, 58, 64][lv];
  furnace(k, -16, -24, H);
  k.gallery([14, -44, 10], [-9, -29, H * 0.74], 3.2, 2.6, '#9aa1a8');
  if (lv >= 2) {
    dustCatcher(k, 12, -16, 22);
    k.pipe([[-14, -22, H], [-6, -18, H - 4], [12, -16, 21]], 2.2, '#6f6a64');
  }
  // Gießhalle mit Glut
  walls(k, -30, 0, -10, 6, 12, '#8a8f93', { ribs: 2, band: T, team: true });
  stripAll(k, [-30, 0, -10, 6], 3, 7, -27, -3, 's', 3, true);
  gate(k, 'e', 0, -2, 6, 8, '#e08a2c');
  k.gable('u', -30, 0, -10, 6, 12, 4, '#5d6166', '#8a8f93');
  // Halden
  k.heap(-44, 34, 10, 8, '#8a4b2e');
  k.heap(-26, 46, 9, 7, COAL);
  if (lv >= 2) k.heap(-48, 52, 6, 4.5, '#8a4b2e');
  // Schienenwagen: Erzwagen, ab Stufe 2 Torpedowagen
  hopper(k, -46, 16);
  if (lv >= 2) torpedo(k, -16, 16);
  // Rechts vorn: Schlackenplatz mit Glut, ab Stufe 3 die Walzwerkhalle
  if (lv >= 3) {
    walls(k, 16, 56, 8, 30, 16, '#9aa1a8', { ribs: 2.4, band: T, team: true });
    stripAll(k, [16, 56, 8, 30], 9, 11.5, 20, 52, 's', 3);
    gate(k, 's', 30, 26, 6, 8);
    gate(k, 'e', 56, 19, 7, 9);
    gate(k, 'n', 8, 36, 6, 8);
    k.gable('u', 16, 56, 8, 30, 16, 5, '#6b7075', '#9aa1a8');
  } else {
    fl(k, 18, 54, 10, 30, '#5a5550');
    glow(k, 32, 20, k.fh, 7);
    glow(k, 44, 24, k.fh, 4.5);
    k.heap(46, 14, 5, 3.5, '#4a4642');
  }
  lorry(k, 0, 40, 'v', '#d29b1d', 'ore');
  k.flagpole(10, 52, 0, 16, T, true);
  k.lamp(8, 30, 9);
  k.tree(52, 50, 0.85, 1);
  k.tree(24, 52, 0.8, 2);
}

function kero(k, lv) {
  const T = TEAM0;
  ground(k, '#a3aaaf');
  fl(k, 12, 56, -56, -12, '#979b98'); // Boden der Auffangwanne
  fl(k, -E, E, 18, 26, ASPH); // Werkstraße
  fl(k, -4, 6, 26, E, ASPH);
  fl(k, 12, 48, 28, 54, '#8d9296'); // Verladeplatz
  // Fackel (Stufe 3), Kugeltanks hinten links
  if (lv >= 3) {
    k.stack(-54, -2, 1.4, 1.1, 54, { color: '#c9ced3', bands: 2, n: 10 });
    flame(k, -54, -2, 54, 1.3);
  }
  keroSphere(k, -40, -40, 10, 3);
  if (lv >= 2) keroSphere(k, -16, -46, 7.5, 3);
  if (lv >= 3) keroSphere(k, -44, -14, 7.5, 3);
  // Rundtanks in der Auffangwanne hinten rechts
  bund(k, 12, 56, -56, -12);
  keroTank(k, 30, -40, 11, 13);
  if (lv >= 2) keroTank(k, 47, -24, 7.5, 11);
  if (lv >= 3) keroTank(k, 24, -20, 6.5, 10);
  k.pipe([[19, -30, 2.4], [8, -30, 2.4], [8, 8, 7.7]], 1.2, BLUE);
  // Kolonne(n) und Pumpenhaus
  if (lv >= 2) column(k, 4, -28, 2.8, 28, { color: '#dfe5ea' });
  const CH = [0, 34, 40, 46][lv];
  column(k, -6, -14, 4, CH, { color: '#dfe5ea' });
  k.band(-6, -14, 4, CH - 4, CH - 2.4, BLUE, 14);
  k.pipe([[-29, -38, 2.4], [-29, -10, 2.4], [-29, -8, 4]], 1.2, BLUE);
  walls(k, -34, -18, -8, 3, 7, '#d4d9dd', { band: BLUE });
  gate(k, 's', 3, -26, 5, 5.2, '#8fa6bd');
  k.door('e', -18, -2.5, 2.2, 4.2, '#4f5a63');
  gate(k, 'n', -8, -26, 5, 5.2, '#8fa6bd'); // Rückseite
  flatRoof(k, -34, -18, -8, 3, 7, '#d4d9dd');
  k.fan(-28, -3, 5.7, 1.8);
  // Rohrbrücke mit blauen Leitungen
  k.rack('u', -54, 54, 8, 7, [BLUE, '#a3aab0', BLUE]);
  // vorn links: liegende Drucktanks und Leitstand
  if (lv >= 2) bullet(k, -54, -30, 36, 3.6);
  if (lv >= 3) bullet(k, -54, -30, 46, 3.6);
  office(k, -24, -10, 32, 46, 8, '#e4e8ea', { seed: 19 });
  k.flagpole(-8, 52, 0, 16, T, true);
  // vorn rechts: Verladestation mit Flugfeld-Tankwagen
  canopy(k, 14, 46, 30, lv >= 2 ? 52 : 42, 7.5, T);
  lorry(k, 28, 35, 'u', BLUE, 'tank', { band: BLUE });
  if (lv >= 2) lorry(k, 28, 46, 'u', '#e8e4da', 'tank', { band: BLUE });
  k.lamp(9, 14, 9);
  k.lamp(9, 40, 9);
  k.tree(53, 56, 0.8, 2);
}

// ---------- Ablauf ----------

const BUILD = { power, bm, mun, fuel, steel, kero };
const cache = new Map(); // Art|Stufe → BufferGeometry

/** Gibt es ein 3D-Werk für die Art? (Sonst bleibt das gemalte Billboard.) */
export const hasWorks3d = (kind) => WORKS_KINDS.includes(kind) && !!BUILD[kind];

/** Schlüssel der Variante: Art und Stufe (die Teamfarbe kommt von der Instanz, eine Geometrie für alle Teams). */
export const worksKey = (kind, level) => `${kind}|${clampLv(level)}`;

/**
 * Geometrie des Werks (Art, Stufe 1 bis 3) wie works.js paintIso, je Variante einmal gebaut; null, wenn es keins gibt.
 * Ankerpunkt = Mitte des Quadrats am Boden; die Teile in Teamfarbe tragen TEAM0 und werden von der Instanz getönt.
 */
export function worksGeometry(kind, level) {
  const f = BUILD[kind];
  if (!f) return null;
  const lv = clampLv(level);
  const key = worksKey(kind, lv);
  let g = cache.get(key);
  if (!g) {
    const k = new Kit3D();
    k.fh = 0.01;
    f(k, lv);
    g = k.geometry();
    cache.set(key, g);
  }
  return g;
}
