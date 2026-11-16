// Industriepark der Stadt-KI (Paket „Industriepark“): Grundriss PARK (vier Drehungen), Platzsuche am Güterbahnhof (parkSite) und
// Werksplätze am Bahnhof (parkSlots, parkSpot). Die Entscheidung, wann gebaut wird, liegt in station.js.
// Exporte: parkSite, parkSlots, parkSpot. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KINDS, KIND_ID, WORKS } from '../../data/citykinds.js';
import { isPart, cellFree, roadAt, buildAllowed, buildWhy, canZone, nbrsOf, atEdge, stationLinked, bigFits, bigCells } from '../../game/city/cells.js';
import { gridBfs } from '../../game/city/gridbfs.js';
import { ready } from '../cooldown.js';
import { inDanger, touchesRoad } from './common.js';

// Grundriss des Industrieparks (Paket „Industriepark“), 9 × 5 Zellen, Gleis nach unten: r = Straße, S = Güterbahnhof (3 × 3),
// W = Werksplatz (2 × 2, grenzt an den Bahnhof und an eine Straße), g = erste Gleiszelle (von dort zum Kartenrand), . = frei.
// Gedreht in vier Richtungen.
const PARK = [
  'rrrrrrrrr',
  'rWWSSSWWr',
  'rWWSSSWWr',
  'rWWSSSWWr',
  'rWW.g.WWr',
];

/** Zellen des Grundrisses je Drehung (0–3): { w, h, road: [[x, y]], work: [[x, y]], station: [x, y] (Mitte), rail: [x, y] }. */
const PARK_TURNS = (() => {
  const W = PARK[0].length;
  const H = PARK.length;
  const turn = [(x, y) => [x, y], (x, y) => [H - 1 - y, x], (x, y) => [W - 1 - x, H - 1 - y], (x, y) => [y, W - 1 - x]];
  return turn.map((f, t) => {
    const out = { w: t % 2 ? H : W, h: t % 2 ? W : H, road: [], work: [], station: f(4, 2), rail: null };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = PARK[y][x];
        if (ch === 'r') out.road.push(f(x, y));
        else if (ch === 'W') out.work.push(f(x, y));
        else if (ch === 'g') out.rail = f(x, y);
      }
    }
    return out;
  });
})();

/**
 * Platz für den Industriepark (Paket „Industriepark“): Grundriss PARK in einer der vier Drehungen auf freien, ausweisbaren Zellen
 * (Straßen und Gleis nach der Straßenregel, Bahnhof und Werke nach der Gebäuderegel; fehlender Straßenanschluss zählt nicht, die Zufahrt
 * kommt mit), dazu eine bezahlte Zufahrt vom Straßennetz des Lagers (`reach`) zu einer Parkstraße (höchstens parkLink Zellen) und ein
 * Gleis von der Gleiszelle bis zum Kartenrand (höchstens railMax Zellen), beides nicht über den Park. Bewertet wird Gleislänge +
 * parkLinkCost × Zufahrt + stationNear × Abstand zum nächsten Werk; feste Reihenfolge bei Gleichstand. Liefert { center, roads, link,
 * rail, works } (Zellindizes; link vom Netz zum Park, rail vom Park zum Rand, works = Zellen der Werksplätze) oder null.
 */
export function parkSite(game, c, reach) {
  const A = CITY.ai;
  const n = c.cols * c.rows;
  const cols = c.cols;
  const danger = (j) => inDanger(c, j % cols, Math.floor(j / cols), game.time);
  const open = (j) => !c.kind[j] && !c.mapRoads?.[j] && cellFree(game, c, j % cols, Math.floor(j / cols)) && !danger(j);
  const roadOk = (j) => open(j) && buildAllowed(game, c, j, 'road');
  const railOk = (j) => open(j) && buildAllowed(game, c, j, 'rail');
  const houseOk = (j, kind) => {
    if (!open(j) || !canZone(game, c, j)) return false;
    const why = buildWhy(game, c, j, kind);
    return why === null || why === 'road';
  };
  // BFS-Felder: Zufahrt vom Netz des Lagers (über freie Straßenzellen) und Gleis vom Kartenrand (über freie Gleiszellen)
  const linkStart = [];
  for (let j = 0; j < n; j++) if (roadOk(j) && nbrsOf(c, j).some((x) => reach[x] && roadAt(c, x))) linkStart.push(j);
  if (!linkStart.length) return null;
  const link = gridBfs(c, linkStart, roadOk, A.parkLink); // dist 0 = Zelle direkt am Netz (wird selbst Straße)
  const edge = [];
  for (let j = 0; j < n; j++) if (atEdge(c, j) && railOk(j)) edge.push(j);
  const rail = gridBfs(c, edge, railOk, A.railMax);
  const works = [];
  for (const i of c.list) if (!isPart(c, i) && c.level[i] && WORKS.includes(KINDS[c.kind[i] - 1])) works.push(i);
  // Suchfenster: Zellen höchstens parkLink + Parkgröße um die Zufahrt
  let q0 = cols;
  let q1 = -1;
  let r0 = c.rows;
  let r1 = -1;
  for (let j = 0; j < n; j++) {
    if (link.dist[j] < 0) continue;
    const q = j % cols;
    const r = (j - q) / cols;
    if (q < q0) q0 = q;
    if (q > q1) q1 = q;
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
  }
  let best = null;
  for (let t = 0; t < 4; t++) {
    const P = PARK_TURNS[t];
    for (let oy = Math.max(0, r0 - P.h); oy <= Math.min(c.rows - P.h, r1); oy++) {
      for (let ox = Math.max(0, q0 - P.w); ox <= Math.min(cols - P.w, q1); ox++) {
        const at = ([x, y]) => (oy + y) * cols + ox + x;
        const g = at(P.rail);
        if (rail.dist[g] < 0) continue;
        // Zufahrt: die Parkstraße mit der kürzesten Zufahrt
        let lk = Infinity;
        let lj = -1;
        let ok = true;
        for (const p of P.road) {
          const j = at(p);
          if (!roadOk(j)) {
            ok = false;
            break;
          }
          if (link.dist[j] >= 0 && link.dist[j] < lk) {
            lk = link.dist[j];
            lj = j;
          }
        }
        if (!ok || lj < 0) continue;
        const [sx, sy] = P.station;
        for (let y = sy - 1; y <= sy + 1 && ok; y++) for (let x = sx - 1; x <= sx + 1 && ok; x++) ok = houseOk(at([x, y]), 'station');
        for (const p of P.work) if (ok) ok = houseOk(at(p), 'bm');
        if (!ok) continue;
        let wd = 0;
        if (works.length) {
          wd = Infinity;
          for (const w of works) wd = Math.min(wd, Math.max(Math.abs((w % cols) - (ox + sx)), Math.abs(Math.floor(w / cols) - (oy + sy))));
        }
        const score = rail.dist[g] + A.parkLinkCost * lk + A.stationNear * wd;
        if (best && score >= best.score) continue;
        best = { score, t, ox, oy, lj, g };
      }
    }
  }
  if (!best) return null;
  const P = PARK_TURNS[best.t];
  const at = ([x, y]) => (best.oy + y) * cols + best.ox + x;
  const foot = new Set();
  const roads = P.road.map(at);
  const workCells = P.work.map(at);
  const [sx, sy] = P.station;
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) foot.add(at([x, y]));
  for (const j of [...roads, ...workCells]) foot.add(j);
  // Zufahrt: vom Netz (dist 0) bis zur Parkstraße, ohne die Parkstraße selbst; Gleis: von der Gleiszelle bis zum Rand
  const linkPath = [];
  for (let i = link.prev[best.lj]; i >= 0 && !roads.includes(i); i = link.dist[i] > 0 ? link.prev[i] : -1) linkPath.push(i);
  linkPath.reverse();
  const railPath = [];
  for (let i = best.g; i >= 0; i = rail.dist[i] > 0 ? rail.prev[i] : -1) railPath.push(i);
  if (linkPath.some((j) => foot.has(j)) || railPath.some((j) => foot.has(j) || linkPath.includes(j))) return null;
  // Parkstraßen ab der Zufahrt der Reihe nach (bei Anschlusspflicht wächst die Straße so am Netz entlang)
  const order = [best.lj];
  const seen = new Set(order);
  for (let h = 0; h < order.length; h++) for (const j of nbrsOf(c, order[h])) if (roads.includes(j) && !seen.has(j)) seen.add(j), order.push(j);
  return { center: at(P.station), roads: order, link: linkPath, rail: railPath, works: workCells };
}

/**
 * Werksplätze am Güterbahnhof (Paket „Industriepark“): Anker (links oben) der freien 2 × 2-Quadrate, die an das 3 × 3-Quadrat um
 * `center` grenzen (4er-Nachbarschaft, dann Direktlieferung ohne Straße) und mit einer Zelle an einer Straße zum Lager liegen (das
 * Produkt fährt über die Straße; `reach` = mainRoadReach). `free(j)`: Zelle frei; ausweisbar für `kind` prüft buildAllowed. Plätze,
 * an denen ein Bau zuletzt abgelehnt wurde (mem.parkWait), zählen CITY.ai.stationRetry s nicht. Feste Reihenfolge (nach Anker).
 */
export function parkSlots(game, c, center, reach, kind, free, mem = null) {
  const sc = center % c.cols;
  const sr = (center - sc) / c.cols;
  const anchors = [];
  for (let q = sc - 2; q <= sc + 1; q++) anchors.push([q, sr - 3], [q, sr + 2]); // oben, unten
  for (let r = sr - 2; r <= sr + 1; r++) anchors.push([sc - 3, r], [sc + 2, r]); // links, rechts
  const out = [];
  for (const [q, r] of anchors) {
    if (q < 0 || r < 0 || q + 1 >= c.cols || r + 1 >= c.rows) continue;
    const a = r * c.cols + q;
    if (mem && !ready(mem.parkWait, a, game.time)) continue;
    if (!bigFits(game, c, a, 2, free, (j) => buildAllowed(game, c, j, kind))) continue;
    if (!bigCells(c, a, 2).some((j) => touchesRoad(c, j, reach))) continue;
    out.push(a);
  }
  return out.sort((p, o) => p - o);
}

/**
 * Freier Werksplatz an einem Güterbahnhof der Stadt, dessen Gleis bis zum Kartenrand reicht (auch im Bau), für ein Werk der Art `kind`
 * (Paket „Industriepark“): Anker des 2 × 2-Quadrats oder −1. Bahnhöfe der Reihe nach (nach Anker).
 */
export function parkSpot(game, c, reach, kind, free, mem) {
  for (const st of c.list) {
    if (c.kind[st] !== KIND_ID.station || isPart(c, st) || !stationLinked(c, st)) continue;
    const slots = parkSlots(game, c, st, reach, kind, free, mem);
    if (slots.length) return slots[0];
  }
  return -1;
}
