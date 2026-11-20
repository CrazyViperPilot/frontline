// Platzprüfung des Karteneditors: Grundfläche je Kartenobjekt und Überschneidung. Gebäude, Zugteile, Props, Autos, Bäume, Wald, Felsen
// und Kisten belegen Platz; Boden (Straßen, Gleise, Plätze, Felder, Parks, Fluss) und Spielmarken (Startpunkte, Zone, Flaggen) nicht.
// Ohne DOM, damit es in Node-Tests läuft. Einsatz in editor.js: Setzen, Ziehen, Kopieren nur auf freien Platz.
import { PROPS } from '../data/props.js';
import { BALANCE } from '../data/balance.js';

const TILE = BALANCE.map.tile; // Rasterzelle der Zaun- und Mauerkacheln
const EPS = 0.5; // Berühren ist erlaubt: erst so viel px Überdeckung zählt

const rect = (x, y, hw, hh, a = 0) => ({ t: 'rect', x, y, hw, hh, a, R: Math.hypot(hw, hh) });
const circle = (x, y, r) => ({ t: 'circle', x, y, r, R: r });

/** Grundfläche des Objekts o der Art k (wie pickAt in editor.js): Rechteck (Mitte, halbe Maße, Drehung) oder Kreis; null = belegt nichts. */
export function footprint(k, o) {
  switch (k) {
    case 'building':
      return rect(o.x, o.y, o.w / 2, o.h / 2, o.angle || 0);
    case 'prop': {
      const K = PROPS.kinds[o.kind];
      if (!K || K.overlap) return null;
      if (K.line) return rect(o.x, o.y, TILE / 2, TILE / 2);
      return rect(o.x, o.y, K.size[0] / 2, K.size[1] / 2, ((o.rot ?? 0) * Math.PI) / 4);
    }
    case 'car':
      return rect(o.x, o.y, o.vertical ? 9 : 18, o.vertical ? 18 : 9);
    case 'tree':
    case 'townTree':
      return circle(o.x, o.y, o.r * 0.6); // Stamm und dichte Krone: Kronen dürfen sich berühren
    case 'obstacle':
      return circle(o.x, o.y, o.r);
    case 'crate':
      return circle(o.x, o.y, 14);
    default:
      return null;
  }
}

/** Achsen (Einheitsvektoren) eines gedrehten Rechtecks. */
const axes = (r) => [[Math.cos(r.a), Math.sin(r.a)], [-Math.sin(r.a), Math.cos(r.a)]];

/** Halbe Ausdehnung des Rechtecks r auf der Achse ax. */
function extent(r, ax) {
  const [u, v] = axes(r);
  return r.hw * Math.abs(u[0] * ax[0] + u[1] * ax[1]) + r.hh * Math.abs(v[0] * ax[0] + v[1] * ax[1]);
}

/** Überdecken sich zwei Grundflächen (mehr als EPS)? */
export function overlaps(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) >= a.R + b.R - EPS) return false;
  if (a.t === 'circle' && b.t === 'circle') return true; // Abstand schon oben geprüft
  if (a.t === 'circle') return circleRect(a, b);
  if (b.t === 'circle') return circleRect(b, a);
  for (const ax of [...axes(a), ...axes(b)]) {
    const d = Math.abs(dx * ax[0] + dy * ax[1]);
    if (d >= extent(a, ax) + extent(b, ax) - EPS) return false; // trennende Achse
  }
  return true;
}

function circleRect(c, r) {
  const [u, v] = axes(r);
  const dx = c.x - r.x;
  const dy = c.y - r.y;
  const lu = dx * u[0] + dy * u[1];
  const lv = dx * v[0] + dy * v[1];
  const qu = Math.max(-r.hw, Math.min(r.hw, lu));
  const qv = Math.max(-r.hh, Math.min(r.hh, lv));
  return Math.hypot(lu - qu, lv - qv) < c.r - EPS;
}

/** Listen der Karte, deren Objekte Platz belegen: [Art, Liste]. */
function solids(map) {
  return [
    ['building', map.town?.buildings ?? []],
    ['prop', map.props ?? []],
    ['car', map.town?.cars ?? []],
    ['obstacle', map.obstacles ?? []],
    ['tree', map.trees ?? []],
    ['townTree', map.town?.trees ?? []],
    ['crate', map.crates ?? []],
  ];
}

/**
 * Erstes Objekt der Karte, das die Grundfläche von o (Art k) überdeckt: { k, o } oder null (Platz frei).
 * skip: Objekte, die nicht zählen (das verschobene Objekt selbst). Zaun- und Mauerkacheln auf derselben Zelle ersetzt der Editor,
 * zwei Kacheln stören sich daher nie.
 */
export function blockerOf(map, k, o, skip = null) {
  const fp = footprint(k, o);
  if (!fp) return null;
  const tile = k === 'prop' && PROPS.kinds[o.kind]?.line;
  for (const [kk, list] of solids(map)) {
    for (const p of list) {
      if (p === o || skip?.has(p)) continue;
      if (tile && kk === 'prop' && PROPS.kinds[p.kind]?.line) continue;
      const q = footprint(kk, p);
      if (q && overlaps(fp, q)) return { k: kk, o: p };
    }
  }
  return null;
}

/** Ist der Platz für o (Art k) frei? */
export const hasRoom = (map, k, o, skip = null) => !blockerOf(map, k, o, skip);

/** Einzelstück am Weltpunkt (x, y), auf das sich ein weiteres derselben Art stapeln lässt (PROPS.kinds[kind].stack), sonst null. */
export function stackTarget(map, kind, x, y) {
  const K = PROPS.kinds[kind];
  if (!K?.stack) return null;
  for (const p of map.props ?? []) {
    if (p.kind !== kind) continue;
    const fp = footprint('prop', p);
    if (fp && overlaps(fp, circle(x, y, 1))) return p;
  }
  return null;
}

/** Name eines Hindernisses für die Meldung „Kein Platz: …“. */
export function blockerName(b) {
  if (b.k === 'prop') return PROPS.kinds[b.o.kind]?.name ?? 'Deko';
  return { building: 'Gebäude', car: 'Auto', obstacle: b.o.r % 2 ? 'Fels' : 'Wald', tree: 'Baum', townTree: 'Baum', crate: 'Kiste' }[b.k] ?? 'Objekt';
}
