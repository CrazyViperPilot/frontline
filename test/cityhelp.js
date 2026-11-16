// Gemeinsame Hilfen der Stadt-Tests (city-*.test.js); keine eigenen Tests.
import assert from 'node:assert/strict';
import { CITY } from '../js/data/city.js';
import { canZone, sizeOf, cellsOf, accessCells, roadAt, cellRect } from '../js/game/city/cells.js';
import { cityTrainers } from '../js/game/city/query.js';
import { transportOf } from '../js/game/transport.js';

export const run = (g, s) => { for (let t = 0; t < s * 20; t++) g.update(0.05); };
// Ursprung (c, r) eines w × h großen, ganz bebaubaren Rechtecks im Gebiet des Teams, nahe der Hauptstadt
export function spot(g, w, h, team = 0) {
  const c = g.city[team];
  const m = g.mainFob(team);
  const fc = Math.floor(m.x / c.cell);
  const fr = Math.floor(m.y / c.cell);
  let best = null;
  for (let r = 0; r <= c.rows - h; r++) {
    for (let q = 0; q <= c.cols - w; q++) {
      let ok = true;
      for (let y = r; ok && y < r + h; y++) for (let x = q; ok && x < q + w; x++) ok = canZone(g, c, y * c.cols + x) && !c.kind[y * c.cols + x];
      if (!ok) continue;
      const d = Math.abs(q - fc) + Math.abs(r - fr);
      if (!best || d < best.d) best = { c: q, r, d };
    }
  }
  assert.ok(best, 'kein Platz im Gebiet');
  return best;
}
export const base = new WeakMap();
export const paint = (g, kind, c0, r0, c1, r1, team = 0) => {
  if (!g.city) return raw(g, kind, c0, r0, c1, r1, team);
  if (!base.has(g)) base.set(g, spot(g, 10, 6, team));
  const b = base.get(g);
  return raw(g, kind, b.c + c0, b.r + r0, b.c + c1, b.r + r1, team);
};
export const at = (g, col, row) => { const b = base.get(g); return (b.r + row) * g.city[0].cols + b.c + col; };
// Startviertel räumen (Tests, die eine leere Stadt brauchen)
export function clearStart(g, team = 0) {
  const c = g.city[team];
  for (const i of [...c.list]) {
    const q = i % c.cols;
    const r = (i - q) / c.cols;
    g.issue(team, { type: 'city', kind: 'erase', c0: q, r0: r, c1: q, r1: r });
  }
}
export const raw = (g, kind, c0, r0, c1, r1, team = 0) => g.issue(team, { type: 'city', kind, c0, r0, c1, r1 });
// Nachbarzellen (4er) einer Zelle, nur innerhalb des Rasters.
export function nbOf(c, j) {
  const q = j % c.cols;
  const r = (j - q) / c.cols;
  const out = [];
  if (q > 0) out.push(j - 1);
  if (q < c.cols - 1) out.push(j + 1);
  if (r > 0) out.push(j - c.cols);
  if (r < c.rows - 1) out.push(j + c.cols);
  return out;
}
// Breitensuche über freie, bebaubare Zellen ab `starts` bis goal(j) gilt; baut dann je Zelle des Weges eine Straße (Befehl).
export function connect(g, team, starts, goal) {
  const c = g.city[team];
  const n = c.cols * c.rows;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const q = [];
  const free = (k) => !seen[k] && !c.kind[k] && canZone(g, c, k);
  for (const k of starts) if (free(k)) { seen[k] = 1; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const j = q[h];
    if (goal(j)) {
      for (let x = j; x !== -1; x = prev[x]) raw(g, 'road', x % c.cols, Math.floor(x / c.cols), x % c.cols, Math.floor(x / c.cols), team);
      return true;
    }
    for (const k of nbOf(c, j)) if (free(k)) { seen[k] = 1; prev[k] = j; q.push(k); }
  }
  return false;
}
// Straße vom Gebäude mit Anker a zum nächsten Straßennetz (seit v5.20 braucht Produktion einen Weg). Hat es schon einen Anschluss: nichts.
export function linkRoad(g, team, a) {
  const c = g.city[team];
  if (accessCells(c, a).length) return;
  const starts = [];
  for (const j of cellsOf(c, a)) starts.push(...nbOf(c, j));
  assert.ok(connect(g, team, starts, (j) => nbOf(c, j).some((k) => roadAt(c, k))), `keine Straße zu Gebäude ${a} möglich`);
}
// Das Straßennetz, an dem Gebäude a hängt, an das Lager der Hauptstadt anschließen (seit v5.20 braucht ein Werk einen Weg dorthin).
// Hat a schon einen Weg zum Lager, passiert nichts.
export function linkMain(g, team, a) {
  const c = g.city[team];
  if (transportOf(g, c).routes.get(a)?.to === 'main') return;
  const m = g.mainFob(team);
  const T = g.grid.tile;
  const e = CITY.fobMargin + c.cell;
  const x0 = m.cx * T - e;
  const x1 = (m.cx + m.w) * T + e;
  const y0 = m.cy * T - e;
  const y1 = (m.cy + m.h) * T + e;
  const reach = (j) => {
    const r = cellRect(c, j % c.cols, Math.floor(j / c.cols));
    return r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0;
  };
  // Straßen des Netzes um a (Breitensuche über Straßenzellen)
  const net = accessCells(c, a).slice();
  const seen = new Uint8Array(c.cols * c.rows);
  for (const j of net) seen[j] = 1;
  for (let h = 0; h < net.length; h++) {
    for (const k of nbOf(c, net[h])) {
      if (seen[k] || !roadAt(c, k)) continue;
      seen[k] = 1;
      net.push(k);
    }
  }
  const starts = [];
  for (const j of net) starts.push(...nbOf(c, j));
  assert.ok(connect(g, team, starts, reach), 'kein Straßenanschluss zum Lager möglich');
}
// Ausbildungsgebäude der Stadt (seit v4.96), das `unit` ausbildet (Startviertel: Kaserne und Fabrikhalle)
export const trainerFor = (g, unit, team = 0) => cityTrainers(g, team).find((e) => e.produces.includes(unit));
// v4.88: Universität, Rechenzentrum, Strom, Zufriedenheit
export const setLevel = (g, kind, lv, team = 0) => {
  const n = sizeOf(kind); // Großbau (Universität 3 × 3, Werke 2 × 2 …): das ganze freie Quadrat als Rechteck
  const b = spot(g, n, n, team);
  const res = raw(g, kind, b.c, b.r, b.c + n - 1, b.r + n - 1, team);
  const c = g.city[team];
  const i = res.anchor ?? b.r * c.cols + b.c;
  for (const j of cellsOf(c, i)) c.level[j] = lv;
  return i;
};
