// Stadt-KI: Lagerhalle (Paket „Lagerhalle 3“, Plan docs/plan-lagerhallen.md). Die KI baut eine Lagerhalle in Reichweite
// (CITY.warehouse.feed.reach) ihrer zur Zone nächsten vorderen FOB, deren Lager bei einer Sorte knapp ist (CITY.ai.hallLow) und die noch
// keine Halle in Reichweite hat. Platz: der nächste freie, im Baugebiet erlaubte 2 × 2-Platz zur FOB; zuerst die Straße zum Lager
// (connectCells, bezahlt), dann der Bau (wie Kerosintank und Munitionslager in airbase.js). Bis der erste Güterbahnhof steht, nur aus
// Geld über dessen Schwelle (der Industriepark geht vor). Werte CITY.ai.hall*. Dazu aiHallTrainer: eine Kaserne neben der Halle (Paket „Ausbildung an der Lagerhalle“). Nur über game.issue.
import { CITY } from '../../data/city.js';
import { KIND_ID, KINDS } from '../../data/citykinds.js';
import { isPart, cellAt, cellFree, buildAllowed, buildWhy, bigCells } from '../../game/city/cells.js';
import { connectCells, connectPath } from '../../game/city/roadnet.js';
import { block, ready } from '../cooldown.js';
import { inDanger } from './common.js';
import { transportOf } from '../../game/transport.js';

const GOODS = ['bm', 'mun', 'fuel'];

/** Ein Ausbauschritt der KI für Lagerhallen; true, wenn sie eine gebaut hat. */
export function aiWarehouse(game, c, main, money, reserve, difficulty, mem) {
  const A = CITY.ai;
  const W = CITY.warehouse;
  const from = A.hallFrom[difficulty];
  if (from == null || !main || game.time < from || !ready(mem.wait, 'hall', game.time)) return false;
  const fobs = game.buildings.filter((b) => b.alive && b.built && b.team === c.team && b.type === 'fob' && !b.main);
  const halls = c.list.filter((i) => c.kind[i] === KIND_ID.warehouse && !isPart(c, i));
  if (!fobs.length || halls.length >= fobs.length * W.perFob) return false;
  // Der erste Güterbahnhof (Industriepark, station.js) geht vor: ohne ihn nur aus Geld über seiner Schwelle (die billigere Halle hielte
  // das Geld sonst darunter; findet er keinen Platz, kommt die Halle trotzdem)
  const firstPark = A.stationFrom[difficulty] != null && !c.list.some((i) => c.kind[i] === KIND_ID.station);
  const keep = reserve + (firstPark ? A.stationMoney + CITY.cost.station : 0);
  if (money < keep + A.hallMoney + CITY.cost.warehouse || main.store.bm < CITY.costBm.warehouse + A.hallBm) return false;
  // Ziel: knappe FOB ohne Halle in Reichweite, die zur Zone nächste zuerst
  const S = c.cell;
  const centerOf = (a) => ({ x: (a % c.cols + 1) * S, y: (Math.floor(a / c.cols) + 1) * S }); // Mitte eines 2 × 2 mit Anker a
  const covered = (f) => halls.some((a) => {
    const p = centerOf(a);
    return Math.hypot(p.x - f.x, p.y - f.y) <= W.feed.reach;
  });
  const z = game.zone;
  const target = fobs
    .filter((f) => GOODS.some((g) => f.store[g] < A.hallLow) && !covered(f))
    .sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y) || a.id - b.id)[0];
  if (!target) return false;
  // Plätze in Reichweite der FOB, die nächsten zuerst
  const [fq, fr] = cellAt(c, target.x, target.y);
  const R = Math.floor(W.feed.reach / S);
  const free = (j) => !c.kind[j] && buildAllowed(game, c, j, 'warehouse') && cellFree(game, c, j % c.cols, Math.floor(j / c.cols)) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  const cand = [];
  for (let r = Math.max(0, fr - R); r <= Math.min(c.rows - 2, fr + R); r++) {
    for (let q = Math.max(0, fq - R); q <= Math.min(c.cols - 2, fq + R); q++) {
      const p = centerOf(r * c.cols + q);
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d <= W.feed.reach) cand.push({ q, r, d });
    }
  }
  cand.sort((a, b) => a.d - b.d || a.r - b.r || a.q - b.q);
  let tries = 0;
  let first = null; // Zellen des ersten freien Platzes (für die Erkundung, wenn kein Weg geht)
  for (const { q, r } of cand) {
    const cells = [r * c.cols + q, r * c.cols + q + 1, (r + 1) * c.cols + q, (r + 1) * c.cols + q + 1];
    if (!cells.every(free)) continue;
    if (++tries > A.hallTries) break;
    first ??= cells;
    const path = connectPath(game, c, cells, true, null, undefined, A.hallConnect);
    if (path === null) continue;
    // Baumaterial für die Straße (je Zelle CITY.costBm.road) und die Halle, dazu hallBm Polster (Paket „KI-Lagerhalle“: vorher prüfte sie nur
    // die Halle, und die Straße von 60 bis 70 Zellen zur fernen FOB scheiterte an jedem Platz). Reicht es nicht: später, nicht woanders
    const bm = path.length * CITY.costBm.road + CITY.costBm.warehouse + A.hallBm;
    if (main.store.bm < bm || money < path.length * CITY.cost.road + keep + A.hallMoney + CITY.cost.warehouse) break;
    if (connectCells(game, c, cells, true, null, undefined, A.hallConnect) < 0) continue;
    if (game.issue(c.team, { type: 'city', kind: 'warehouse', c0: q, r0: r, c1: q + 1, r1: r + 1 }).ok) return true;
  }
  block(mem.wait, 'hall', A.hallRetry, game.time); // kein Platz oder kein Weg: nicht jeden Takt neu suchen
  // Kein Weg im Baugebiet: oft liegt das Land zwischen Stadt und vorderer FOB noch unerkundet (Paket „KI-Lagerhalle“). Der Späher deckt die
  // erste dunkle Zelle des Wegs ohne Baugebietsregeln auf (cityMem.exploreAt, combat.js scout)
  const open = first && !mem.exploreAt ? connectPath(game, c, first, false, null, undefined, A.hallConnect) : null;
  const dark = open?.find((j) => buildWhy(game, c, j, 'road') === 'unexplored');
  if (dark != null) mem.exploreAt = { x: c.x0 + ((dark % c.cols) + 0.5) * c.cell, y: c.y0 + (Math.floor(dark / c.cols) + 0.5) * c.cell };
  return false;
}

/**
 * Ausbildung an der Lagerhalle (Paket „Ausbildung an der Lagerhalle“): eine Kaserne (CITY.ai.hallTrainer) neben einer angeschlossenen
 * Lagerhalle, in deren Umkreis (hallTrainNear Zellen) noch kein Ausbildungsgebäude steht. Ihre Versorgung misst den Weg zur Halle
 * (transport.js), die Truppen kommen näher an der Front heraus. Platz: der nächste freie, im Baugebiet erlaubte Platz bis hallTrainReach
 * Zellen von der Halle, zuerst die Straße zum Lager (connectCells), dann der Bau. true, wenn gebaut.
 */
export function aiHallTrainer(game, c, main, money, reserve, difficulty, mem) {
  const A = CITY.ai;
  const from = A.hallTrainFrom[difficulty];
  if (from == null || !main || game.time < from || !ready(mem.wait, 'hallTrain', game.time)) return false;
  const kind = A.hallTrainer;
  if (money < reserve + A.hallMoney + CITY.cost[kind] || main.store.bm < (CITY.costBm[kind] ?? 0) + A.hallBm) return false;
  const tr = transportOf(game, c);
  const trainers = c.list.filter((i) => !isPart(c, i) && CITY.produces[KINDS[c.kind[i] - 1]]);
  const near = (a, b, d) => Math.max(Math.abs((a % c.cols) - (b % c.cols)), Math.abs(Math.floor(a / c.cols) - Math.floor(b / c.cols))) <= d;
  const hall = [...tr.store.entries()]
    .filter(([a, path]) => path && c.level[a] >= 1 && !trainers.some((t) => near(t, a, A.hallTrainNear)))
    .map(([a]) => a)
    .sort((a, b) => a - b)[0];
  if (hall == null) return false;
  const n = CITY.size[kind];
  const free = (j) => !c.kind[j] && buildAllowed(game, c, j, kind) && cellFree(game, c, j % c.cols, Math.floor(j / c.cols)) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  const hq = hall % c.cols;
  const hr = Math.floor(hall / c.cols);
  const R = A.hallTrainReach;
  const cand = [];
  for (let r = Math.max(0, hr - R); r <= Math.min(c.rows - 1, hr + R); r++) {
    for (let q = Math.max(0, hq - R); q <= Math.min(c.cols - 1, hq + R); q++) cand.push({ a: r * c.cols + q, d: Math.hypot(q - hq, r - hr) });
  }
  cand.sort((x, y) => x.d - y.d || x.a - y.a);
  let tries = 0;
  for (const { a } of cand) {
    const cells = bigCells(c, a, n);
    if (cells.some((j) => j < 0 || j >= c.kind.length || Math.abs((j % c.cols) - (a % c.cols)) > n) || !cells.every(free)) continue;
    if (++tries > A.hallTries) break;
    if (connectCells(game, c, cells, true, null, undefined, A.hallConnect) < 0) continue;
    const qs = cells.map((j) => j % c.cols);
    const rs = cells.map((j) => Math.floor(j / c.cols));
    if (game.issue(c.team, { type: 'city', kind, c0: Math.min(...qs), r0: Math.min(...rs), c1: Math.max(...qs), r1: Math.max(...rs) }).ok) return true;
  }
  block(mem.wait, 'hallTrain', A.hallRetry, game.time); // kein Platz oder kein Weg: nicht jeden Takt neu suchen
  return false;
}
