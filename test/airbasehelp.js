// Gemeinsame Hilfen der Fliegerhorst-Tests (airbase-*.test.js); keine eigenen Tests.
import assert from 'node:assert/strict';
import { CITY } from '../js/data/city.js';
import { canZone, roadAt } from '../js/game/city/cells.js';
import { KINDS } from '../js/data/citykinds.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { runwaysOf } from '../js/game/aircraft.js';
import { withValue } from './util.js';

export const DT = 0.05;
export const run = (g, s) => {
  for (let i = 0; i < s / DT; i++) g.update(DT);
};

/** Reiche Stadt für Team t. */
export function rich(g, t = 0) {
  const c = g.city[t];
  const m = g.mainFob(t);
  g.teams[t].res.money = 1e6;
  Object.assign(m.store, { bm: 30000, mun: 30000, fuel: 30000 });
  c.metal = 3000;
  c.popF = 400;
  c.kero = 3000;
  return { c, m };
}

/** Freie Fläche W × H (mit Rand) nächst der Hauptstadt: linke obere Zelle { q, r }. */
export function freeArea(g, c, m, W, H) {
  let best = null;
  const mc = Math.floor(m.x / c.cell);
  const mr = Math.floor(m.y / c.cell);
  for (let r = 1; r < c.rows - H - 1; r++) {
    for (let q = 1; q < c.cols - W - 1; q++) {
      const d = Math.abs(q - mc) + Math.abs(r - mr);
      if (best && d >= best.d) continue;
      let ok = true;
      for (let y = r - 1; ok && y <= r + H; y++) {
        for (let x = q - 1; ok && x <= q + W; x++) {
          const j = y * c.cols + x;
          ok = canZone(g, c, j) && !c.kind[j] && !roadAt(c, j);
        }
      }
      if (ok) best = { q, r, d };
    }
  }
  return best;
}

export const kindAt = (c, i) => KINDS[c.kind[i] - 1];

/**
 * Fliegerhorst für Team t: Bahn 10 × 2, darunter Stellplatz, Stellplatz, Tower, Kerosintank, Munitionslager (je 2 × 2).
 * opts.atc / opts.ktank / opts.mdepot = false lassen den Baustein weg. Liefert Bahn, Stellplätze und Lager.
 */
export function airbase(g, t = 0, opts = {}) {
  const { c, m } = rich(g, t);
  const a = freeArea(g, c, m, 12, 6);
  assert.ok(a, 'Platz für den Fliegerhorst');
  const { q, r } = a;
  const put = (kind, dq, dr, w = 0, h = 0) => assert.ok(g.issue(t, { type: 'city', kind, c0: q + dq, r0: r + dr, c1: q + dq + w, r1: r + dr + h }).ok, kind);
  put('runway', 0, 0, 9, 1);
  put('stand', 0, 2);
  put('stand', 2, 2);
  if (opts.atc !== false) put('atc', 4, 2);
  if (opts.ktank !== false) put('ktank', 6, 2);
  if (opts.mdepot !== false) put('mdepot', 8, 2);
  // Straßenweg zum Lager ab dem Ende der Bahn (Paket „Straßen“), kostenlos wie beim Startviertel. Tank und Lager brauchen eine eigene
  // Straße zum Lager (Paket „Fliegerhorst-Anschluss“), sonst wachsen sie nicht
  if (opts.link !== false) {
    withValue(CITY.transport, 'connectMax', 400, () => {
      assert.ok(connectRoad(g, c, r * c.cols + q + 9, false) >= 0, 'Weg zum Lager');
      if (opts.ktank !== false) connectRoad(g, c, (r + 2) * c.cols + q + 6, false);
      if (opts.mdepot !== false) connectRoad(g, c, (r + 2) * c.cols + q + 8, false);
    });
  }
  run(g, CITY.growTime + 1);
  const ents = [...c.ents.entries()].filter(([, e]) => e.alive);
  const of = (k) => ents.filter(([i]) => kindAt(c, i) === k).map(([, e]) => e);
  return { c, m, q, r, stands: of('stand'), atc: of('atc')[0], ktank: of('ktank')[0], mdepot: of('mdepot')[0], rw: runwaysOf(g, t).find((x) => x.valid) };
}
