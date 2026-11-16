// Straßennetz der Stadt-KI (Pakete „Straßen“, „Straßennetz der KI“, „Import“): Straße zum Kartenrand (aiEdge), Anschlusspflicht und
// Netz verlängern (linkNeeded, linkSpare, extendNet, keepsOutlets), Zufahrten (linkField, linkPaths, atNet), Anschluss von Gebäuden
// (aiConnect), Spuren überlasteter Straßen (aiLanes).
// Exporte: aiEdge, linkNeeded, linkSpare, keepsOutlets, extendNet, linkField, linkPaths, atNet, aiConnect, aiLanes. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KINDS, KIND_ID, WORKS, SUPPLIER_KINDS } from '../../data/citykinds.js';
import { transportOf, transportInfo, mainAccess } from '../../game/transport.js';
import { accessCells, cellAt, idx, isPart, cellFree, roadAt, buildAllowed, nbrsOf, roadLinked } from '../../game/city/cells.js';
import { connectRoad, importReach, connectEdge } from '../../game/city/roadnet.js';
import { gridBfs } from '../../game/city/gridbfs.js';
import { block, ready, prune } from '../cooldown.js';
import { inDanger, cellCmd, roadFree, touchesRoad } from './common.js';

/**
 * Straße zum Kartenrand (Paket „Import“, kleinste Regel): erreicht kein Einfuhrpunkt die Stadt (keine eigene Straße am Rand, kein
 * angeschlossener Güterbahnhof), legt die KI vom Straßennetz am Lager aus den kürzesten Weg zum Rand (bezahlt, höchstens
 * CITY.transport.connectMax Zellen). true, wenn gebaut.
 */
export function aiEdge(game, c) {
  if (!importReach(c)) return connectEdge(game, c, mainAccess(game, c), true, CITY.transport.connectMax) > 0;
  // Werk an einem Straßennetz ohne Einfuhrpunkt (z. B. ein Viertel, das nur über das Lager mit dem Rest hängt): eigene Straße vom
  // Netz des Werks zum Rand, wenn sie kurz genug ist (aiConnect versucht danach den Anschluss an das Netz der Einfuhrpunkte)
  for (const i of c.list) {
    if (isPart(c, i) || !c.level[i] || !WORKS.includes(KINDS[c.kind[i] - 1])) continue;
    if (transportInfo(game, c, i).importFrom !== null) continue;
    const acc = accessCells(c, i);
    if (acc.length && connectEdge(game, c, acc, true, CITY.transport.connectMax) > 0) return true;
  }
  return false;
}

/** Straßenzellen, die der Transport vom Lager der Hauptstadt aus erreicht (Ziel für den Anschluss eines Ausbildungsgebäudes). */
function supplyGoal(game, c) {
  const dist = transportOf(game, c).fields.main.dist;
  const goal = new Uint8Array(dist.length);
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) goal[i] = 1;
  return goal;
}

/** Gilt die Anschlusspflicht des Baugebiets (Paket „Straßen“)? */
export function linkNeeded(game) {
  return !!game.buildRules && CITY.build.needRoad;
}

/** Freie, bebaubare Zellen im Umkreis `rad` (Zellen) um den Anker, die an einer Straße zum Lager liegen (gezählt bis CITY.ai.linkSpare). */
export function linkSpare(game, c, anchor, rad) {
  const mask = roadLinked(game, c);
  const [ac, ar] = cellAt(c, anchor.x, anchor.y);
  let n = 0;
  for (let r = Math.max(0, ar - rad); r <= Math.min(c.rows - 1, ar + rad); r++) {
    for (let q = Math.max(0, ac - rad); q <= Math.min(c.cols - 1, ac + rad); q++) {
      const j = r * c.cols + q;
      if (mask[j] && !c.kind[j] && buildAllowed(game, c, j) && cellFree(game, c, q, r) && ++n >= CITY.ai.linkSpare) return n;
    }
  }
  return n;
}

/** Ausgänge des Netzes: freie Zelle j an einer Straße zum Lager mit einem freien Nachbarn x außerhalb des Netzes ([{ j, x }]). */
function outletsOf(game, c) {
  const mask = roadLinked(game, c);
  const out = [];
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || !roadFree(game, c, j)) continue;
    for (const x of nbrsOf(c, j)) if (!mask[x] && roadFree(game, c, x)) out.push({ j, x });
  }
  return out;
}

/**
 * Bleibt das Straßennetz offen, wenn die Zellen `cells` bebaut werden? true, wenn danach noch CITY.ai.linkOutlets Ausgänge bleiben
 * oder schon vorher weniger da waren (dann verhindert diese Regel nichts mehr; extendNet sucht dann einen neuen Weg).
 */
export function keepsOutlets(game, c, cells) {
  const taken = new Set(cells);
  const before = new Set();
  const after = new Set();
  for (const o of outletsOf(game, c)) {
    before.add(o.j);
    if (!taken.has(o.j) && !taken.has(o.x)) after.add(o.j);
  }
  return after.size >= CITY.ai.linkOutlets || before.size < CITY.ai.linkOutlets;
}

/**
 * Netz verlängern (Paket „Straßen“): liegen um den Anker weniger als CITY.ai.linkSpare freie Anschlusszellen und hat das Lager
 * mindestens CITY.ai.linkBm Baumaterial, legt die KI eine Straße. Ohne freie Anschlusszelle (z. B. FOB-Viertel ohne Anschluss) zuerst eine
 * Straße zur Lagerstraße (connectNear); sonst eine Straßenzelle auf den Ausgang mit dem meisten freien Land im eigenen Gebiet dahinter
 * (bei Gleichstand der nächste zum Anker). true, wenn gebaut.
 */
export function extendNet(game, c, anchor, rad, mem) {
  const main = game.mainFob(c.team);
  if (!main || main.store.bm < CITY.ai.linkBm) return false; // Baumaterial zuerst für Gebäude und Anschlüsse der Werke
  const spare = linkSpare(game, c, anchor, rad);
  if (spare >= CITY.ai.linkSpare) return false;
  const outs = outletsOf(game, c);
  const [ac, ar] = cellAt(c, anchor.x, anchor.y);
  if (spare === 0 && connectNear(game, c, ac, ar, rad, mem)) return true;
  const mask = roadLinked(game, c);
  let best = null;
  for (const o of outs) {
    const xq = o.x % c.cols;
    const xr = (o.x - xq) / c.cols;
    if (inDanger(c, xq, xr, game.time)) continue;
    let room = 0; // freies Land im eigenen Gebiet ohne Anschluss im Umkreis von 2 Zellen hinter dem Ausgang
    for (let r = Math.max(0, xr - 2); r <= Math.min(c.rows - 1, xr + 2); r++) {
      for (let q = Math.max(0, xq - 2); q <= Math.min(c.cols - 1, xq + 2); q++) {
        const y = r * c.cols + q;
        if (!mask[y] && c.claim[y] && roadFree(game, c, y)) room++;
      }
    }
    const jq = o.j % c.cols;
    const d = Math.abs(jq - ac) + Math.abs((o.j - jq) / c.cols - ar);
    if (!best || room > best.room || (room === best.room && (d < best.d || (d === best.d && o.j < best.j)))) best = { j: o.j, room, d };
  }
  if (best && best.room > 0) {
    const q = best.j % c.cols;
    const r = (best.j - q) / c.cols;
    if (game.issue(c.team, { type: 'city', kind: 'road', c0: q, r0: r, c1: q, r1: r }).ok) return true;
  }
  return false;
}

/**
 * Straße (connectRoad, bezahlt) ab der nächsten freien Zelle im eigenen Gebiet ohne Anschluss um (ac, ar), Ringe nach außen; höchstens
 * CITY.ai.linkTries Versuche je Takt. Startzellen ohne Weg (eingeschlossene Lücken) merkt sich die KI CITY.ai.linkRetry s in mem.linkWait.
 */
function connectNear(game, c, ac, ar, rad, mem) {
  const mask = roadLinked(game, c);
  const fail = mem.linkWait;
  prune(fail, game.time);
  let tries = 0;
  for (let d = 1; d <= rad && tries < CITY.ai.linkTries; d++) {
    for (let dy = -d; dy <= d && tries < CITY.ai.linkTries; dy++) {
      for (let dx = -d; dx <= d && tries < CITY.ai.linkTries; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const q = ac + dx;
        const r = ar + dy;
        if (q < 0 || r < 0 || q >= c.cols || r >= c.rows) continue;
        const j = idx(c, q, r);
        if (!ready(fail, j, game.time) || !c.claim[j] || mask[j] || !roadFree(game, c, j) || inDanger(c, q, r, game.time)) continue;
        tries++;
        if (connectRoad(game, c, j, true) > 0) return true;
        block(fail, j, CITY.ai.linkRetry, game.time);
      }
    }
  }
  return false;
}

/**
 * Zellen, von denen aus die KI eine Straße zum Netz des Lagers ziehen könnte (Paket „Industriepark“): Breitensuche ab den Straßen in
 * `reach` (mainRoadReach) über Straßen und freie, für Straßen ausweisbare Zellen, höchstens CITY.transport.connectMax Schritte
 * (wie connectRoad). Uint8Array, 1 = erreichbar.
 */
export function linkField(game, c, reach) {
  const n = c.cols * c.rows;
  const starts = [];
  for (let j = 0; j < n; j++) if (reach[j] && roadAt(c, j)) starts.push(j);
  const r = gridBfs(c, starts, (j) => roadAt(c, j) || roadFree(game, c, j), CITY.transport.connectMax, { scratch: true });
  const seen = new Uint8Array(n);
  for (let k = 0; k < r.count; k++) seen[r.queue[k]] = 1;
  return seen;
}

/**
 * Zufahrten vom Netz des Lagers (Paket „Straßennetz der KI“): Breitensuche ab den freien Zellen direkt an einer Straße in `reach`
 * über freie, für Straßen ausweisbare Zellen (ohne freigehaltene Werksplätze `keep`), höchstens `max` Zellen. dist = Zahl neuer
 * Straßenzellen bis zu dieser Zelle (1 = liegt am Netz, −1 = zu weit oder kein Weg), prev = Vorgänger Richtung Netz (−1 am Netz).
 */
export function linkPaths(game, c, reach, max, keep) {
  const n = c.cols * c.rows;
  const ok = (j) => !keep[j] && roadFree(game, c, j) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  // Startzellen: freie Nachbarn des Netzes, Abstand 1 (base), doppelte zählt gridBfs einmal
  const starts = [];
  for (let j = 0; j < n; j++) {
    if (!reach[j]) continue;
    for (const x of nbrsOf(c, j)) if (ok(x)) starts.push(x);
  }
  const r = gridBfs(c, starts, ok, max, { base: 1 });
  return { dist: r.dist, prev: r.prev };
}

/** Liegt Zelle i für ein 1 × 1-Gebäude der Art `kind` am Netz des Lagers: Straße aus `reach` daneben, Wohnen und Gewerbe auch über ein Nachbarhaus gleicher Art, das selbst dort liegt (Kette wie hasRoad). */
export function atNet(c, i, kind, reach) {
  if (touchesRoad(c, i, reach)) return true;
  if (kind !== 'res' && kind !== 'com') return false;
  const id = KIND_ID[kind];
  return nbrsOf(c, i).some((j) => c.kind[j] === id && touchesRoad(c, j, reach));
}

/**
 * Straßenanschluss der KI (seit v5.20, AP4): höchstens ein Gebäude je Takt, dem der Weg fehlt (Werk ohne Lieferweg zum Lager, seit
 * Paket „Import“ Werk ohne Weg zu einem Einfuhrpunkt, Arbeitsstätte ohne Pendlerweg, seit dem Paket „Straßen“ Ausbildungsgebäude ohne Weg zum Lager). Prüft höchstens CITY.ai.roadTries Gebäude. true, wenn gebaut.
 */
export function aiConnect(game, c, off) {
  let tried = 0;
  const list = c.list;
  // off: Ausbautakt der KI; der Anfang wandert mit jedem Takt, damit auch hintere Gebäude drankommen
  for (let s = 0; s < list.length && tried < CITY.ai.roadTries; s++) {
    const i = list[(s + off) % list.length];
    if (isPart(c, i) || !c.kind[i]) continue;
    const k = KINDS[c.kind[i] - 1];
    const info = transportInfo(game, c, i);
    const supplier = SUPPLIER_KINDS.includes(k) && info.to === null;
    const noImport = info.importFrom === null; // Werk ohne Weg zu einem Einfuhrpunkt (Paket „Import“)
    const trainer = !!CITY.produces[k] && transportOf(game, c).supply.get(i) === null; // Ausbildung ohne Straßenweg zum Lager steht (Paket „Straßen“)
    if (!supplier && !noImport && !info.noHome && !trainer) continue;
    tried++;
    // Ausbildung ohne Versorgungsweg: Ziel ist das Straßennetz am Lager (Bahn und Rollfeld sind keine Straße). Werk ohne Einfuhr: Ziel ist
    // das Straßennetz der Einfuhrpunkte (gibt es keines, legt aiEdge zuerst die Straße zum Rand).
    const goal = noImport && !supplier ? importReach(c) : trainer ? supplyGoal(game, c) : null;
    if (noImport && !supplier && !goal) continue;
    if (connectRoad(game, c, i, true, goal) > 0) return true;
  }
  return false;
}

/** Länge der Straßenreihe durch Zelle i in Richtung (dq, dr) und zurück, wenn die Zellen in `extra` auch Straße wären. */
function roadRun(c, tr, i, dq, dr, extra) {
  const q0 = i % c.cols;
  const r0 = (i - q0) / c.cols;
  let len = 1;
  for (const s of [1, -1]) {
    for (let q = q0 + s * dq, r = r0 + s * dr; q >= 0 && r >= 0 && q < c.cols && r < c.rows; q += s * dq, r += s * dr) {
      const j = r * c.cols + q;
      if (!(tr.cap[j] > 0) && j !== extra) break;
      len++;
    }
  }
  return len;
}

/** Fahrspuren der Straßenzelle i (wie laneGrid in js/game/roads.js: kleinere Ausdehnung, höchstens maxLanes), wenn `extra` auch Straße wäre. */
function lanesAt(c, tr, i, extra = -1) {
  return Math.min(CITY.transport.maxLanes, roadRun(c, tr, i, 1, 0, extra), roadRun(c, tr, i, 0, 1, extra));
}

/**
 * Spuren der KI (Paket „Straßennetz der KI“, PRD §10): Straßenzellen, deren Last laneTurns Ausbautakte in Folge über laneLoad × Kapazität
 * liegt, bekommen eine Straße daneben (Straßen nebeneinander = mehrspurig, laneGrid). Zuerst die am stärksten überlastete Zelle; die
 * neue Zelle muss frei sein und die Spurenzahl der überlasteten Zelle heben. Höchstens laneStep neue Zellen je Takt, nur mit laneBm
 * Baumaterial im Lager; eine Zelle ohne Platz ruht laneRetry s. Liefert die Maske der freien Zellen neben Straßen ab laneKeep ×
 * Kapazität (dort baut der Ausbau dieses Takts nichts, damit die Spur Platz behält).
 */
export function aiLanes(game, c, main, mem) {
  const A = CITY.ai;
  const n = c.cols * c.rows;
  const hot = new Uint8Array(n);
  if (!main || !A.laneStep) return hot;
  const tr = transportOf(game, c);
  const turns = {};
  const over = [];
  const before = mem.laneHot;
  for (const i of tr.list) {
    if (!(tr.load[i] > tr.cap[i] * A.laneKeep)) continue;
    if (tr.lanes[i] < CITY.transport.maxLanes) for (const j of nbrsOf(c, i)) if (!c.kind[j]) hot[j] = 1;
    if (!(tr.load[i] > tr.cap[i] * A.laneLoad)) continue;
    turns[i] = (before[i] ?? 0) + 1;
    if (turns[i] >= A.laneTurns && tr.lanes[i] < CITY.transport.maxLanes) over.push(i);
  }
  mem.laneHot = turns;
  if (!over.length || main.store.bm < A.laneBm) return hot;
  over.sort((p, o) => tr.load[o] / tr.cap[o] - tr.load[p] / tr.cap[p] || p - o);
  const fail = mem.laneWait;
  prune(fail, game.time);
  const keep = mem.parkKeep;
  let built = 0;
  let tries = 0;
  for (const i of over) {
    if (built >= A.laneStep || tries >= A.laneTries) break;
    if (!ready(fail, i, game.time)) continue;
    tries++;
    const lanes = lanesAt(c, tr, i);
    let done = false;
    for (const x of nbrsOf(c, i)) {
      if (tr.cap[x] > 0 || keep[x] || !roadFree(game, c, x) || lanesAt(c, tr, i, x) <= lanes) continue;
      if (inDanger(c, x % c.cols, Math.floor(x / c.cols), game.time)) continue;
      if (!game.issue(c.team, cellCmd(c, 'road', x)).ok) continue;
      built++;
      done = true;
      break;
    }
    if (!done) block(fail, i, A.laneRetry, game.time);
  }
  return hot;
}
