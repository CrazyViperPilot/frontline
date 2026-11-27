// Schutt in 3D aus dem Baukasten (kit3d.js), Paket „Baustellen und Ruinen 3D“: eingestürzte Häuser der Kartenstadt, zerstörte Stadtzellen
// (cityruin) und Trümmer zerstörter Militärgebäude (Wracks mit kind 'building', ausgebrannt) aus dem Plan rubblePlan (render/isobuild.js),
// den auch das gemalte Bild nutzt: Schuttboden mit unregelmäßigem Rand (flache Platte knapp über dem Gelände), stehende, stufig
// abgebrochene Mauerecke aus Kästen, Stahlträger (ausgebrannt), Schutthügel als unregelmäßige Kuppe mit Brocken, Platten und Balken als
// gedrehte Quader. Örtliche Koordinaten ab der Mitte: u = Welt-x, v = Welt-y, h = Höhe. Der Zufall hängt nur an der Variante 0 … 15
// (rubbleVariant): eine Geometrie je Art, Maß, ausgebrannt und Variante, die 3D instanziert. Gemalter Schnee, Ruß und Schatten entfallen
// (Schattenkarte; Schutt trägt keinen Schnee wie gemalt). Keine Teamfarbe.
import { Kit3D } from './kit3d.js';
import { rubblePlan, rubbleRng, rubbleVariant, RUBBLE_VARIANTS } from '../render/isobuild.js';
import { shade, tint } from '../render/isokit.js';

const TAU = Math.PI * 2;
const MAX_CACHE = 256; // Geometrien im Zwischenspeicher (16 Varianten × wenige Arten und Maße); älteste fliegt zuerst raus
const FLOOR_H = 0.1; // Schuttboden knapp über dem Gelände

export { RUBBLE_VARIANTS, rubbleVariant };

/** Quelle für Schutt aus einem Objekt der Familie „ruin“ (kind 'cityruin' oder 'ruin3d'): { x, y, w, h, kind (as), hgt }. */
export const ruinSrc = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, kind: r.as, hgt: r.hgt });

/** Schlüssel der Geometrie: Art, Maß, Höhe, ausgebrannt, Variante (aus b.x, b.y). b: { x, y, w, h, kind, hgt }. */
export const rubbleKey = (b, burnt = false, v = rubbleVariant(b)) => `${b.kind}|${b.w}|${b.h}|${b.hgt ?? ''}|${burnt ? 1 : 0}|${v}`;

// ---------- Teile ----------

const T = { mat: null, snow: false };

/** Schutthügel als unregelmäßige Kuppe (drei Ringe zu je 12 Ecken mit Zufall aus seed, Spitze) und Brocken obenauf. */
function mound(k, x, y, r, h, col, seed) {
  const rnd = rubbleRng(seed);
  const NS = 12;
  const rings = [1, 0.72, 0.4];
  const at = (f, i, jr, jh) => {
    const a = (i / NS) * TAU + (f < 1 ? (rnd() - 0.5) * 0.3 : 0);
    const d = Math.max(0, 1 - f * f);
    const rr = r * f * (f < 1 ? 1 + (rnd() - 0.5) * 0.3 * jr : 1);
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr, f < 1 ? h * Math.pow(d, 0.6) * (1 + (rnd() - 0.5) * 0.3 * jh) : 0];
  };
  const ring = rings.map((f) => Array.from({ length: NS }, (_, i) => at(f, i, 1, 1)));
  const top = [x + (rnd() - 0.5) * r * 0.15, y + (rnd() - 0.5) * r * 0.15, h * (1 + (rnd() - 0.5) * 0.15)];
  const shades = [col, tint(col, 0.12), shade(col, 0.12)];
  let c = 0;
  const tri = (p, q, s) => {
    const m = [(p[0] + q[0] + s[0]) / 3, (p[1] + q[1] + s[1]) / 3];
    k.poly([p, q, s], shades[c++ % 3], { ...T, n: [m[0] - x, m[1] - y, r * 0.5] });
  };
  for (let j = 0; j + 1 < ring.length; j++) {
    for (let i = 0; i < NS; i++) {
      const i2 = (i + 1) % NS;
      tri(ring[j][i], ring[j][i2], ring[j + 1][i2]);
      tri(ring[j][i], ring[j + 1][i2], ring[j + 1][i]);
    }
  }
  const last = ring[ring.length - 1];
  for (let i = 0; i < NS; i++) tri(last[i], last[(i + 1) % NS], top);
  // Brocken: kleine gedrehte Quader auf der Kuppe, einige ragen über den Rand
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU;
    const f = Math.sqrt(rnd()) * 0.85;
    const d = Math.max(0, 1 - f * f);
    const sz = 1.2 + rnd() * 2.6;
    const col2 = i % 3 === 0 ? tint(col, 0.35) : i % 3 === 1 ? shade(col, 0.4) : col;
    k.rbox(x + Math.cos(a) * r * f, y + Math.sin(a) * r * f, sz, sz * 0.8, rnd() * Math.PI, h * Math.pow(d, 0.6) * 0.85, h * Math.pow(d, 0.6) * 0.85 + sz * 0.7, col2, tint(col2, 0.1), T);
  }
}

/** Schuttboden: Fächer aus der Mitte über den unregelmäßigen Rand, voll in Farbe (ohne Licht), ohne Schnee. */
function floorPlate(k, plan) {
  const c = [0, 0, FLOOR_H];
  const n = plan.rim.length;
  for (let i = 0; i < n; i++) {
    const p = plan.rim[i];
    const q = plan.rim[(i + 1) % n];
    k.poly([c, [p[0], p[1], FLOOR_H], [q[0], q[1], FLOOR_H]], plan.floor, { mat: null, bare: true, n: [0, 0, 1] });
  }
}

function build(b, burnt, v) {
  const plan = rubblePlan(b, burnt, v);
  const k = new Kit3D();
  floorPlate(k, plan);
  for (const p of plan.pieces) {
    if (p.t === 'mound') mound(k, p.x, p.y, p.r, p.h, p.c, p.seed);
    else if (p.t === 'slab') k.rbox(p.x, p.y, p.len, p.wid, p.a, 0, p.h, p.c, tint(p.c, 0.1), T);
    else if (p.post) k.box(p.x0 - 1.5, p.x0 + 1.5, p.y0 - 1.5, p.y0 + 1.5, 0, p.h, p.c, tint(p.c, 0.1), T);
    else k.box(p.x0, p.x1, p.y0, p.y1, 0, p.h, p.c, tint(p.c, 0.12), T);
  }
  return k.geometry();
}

const cache = new Map(); // Schlüssel → BufferGeometry

/**
 * Geometrie des Schutts b ({ x, y, w, h, kind, hgt }, nur x, y bestimmen die Variante; kind wie drawRubble: house, hall, factory, station,
 * wreck, wall), burnt = ausgebrannt; Mitte = Ursprung. Je Schlüssel einmal gebaut, Zwischenspeicher mit Obergrenze (MAX_CACHE).
 * v erzwingt eine Variante 0 … 15 (Prüfskript und Test), sonst gilt rubbleVariant(b).
 */
export function rubbleGeometry(b, burnt = false, v = rubbleVariant(b)) {
  const key = rubbleKey(b, burnt, v);
  let g = cache.get(key);
  if (g) return g;
  g = build(b, burnt, v);
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, g);
  return g;
}
