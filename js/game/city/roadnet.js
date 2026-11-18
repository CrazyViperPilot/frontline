// Stadt (PRD §15), Straßennetz (seit v5.20, AP4): Erreichbarkeit über Straßen, Anschluss eines Gebäudes ans Lager der Hauptstadt
// oder an ein Zielnetz (connectRoad; Startviertel und Stadt-KI), seit Paket „Import“ Straße zum Kartenrand (connectEdge) und das Netz
// der Einfuhrpunkte (importReach). Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KIND_ID } from '../../data/citykinds.js';
import { mainAccess } from '../transport.js';
import { atEdge, stationLinked, anchorOf, isPart, cellsOf, cellRect, cellFree, roadAt, accessCells, roadsAround, canZone, buildAllowed, nbrsOf } from './cells.js';
import { rebuildList, placeBuilt } from './state.js';
import { gridBfs, bfsPath } from './gridbfs.js';

/**
 * Straßenzellen, die über Straßen von den Startzellen `starts` aus erreichbar sind (seit v5.20, AP4): Breitensuche, höchstens
 * CITY.transport.maxDist Schritte (wie der Lieferweg). Liefert ein Uint8Array je Zelle, 1 = erreichbar. Nur Straßen (roadAt), also auch
 * für den Bauanschluss keine Bahn und kein Rollfeld (Paket „Fliegerhorst-Anschluss“).
 */
function roadReach(c, starts) {
  const n = c.cols * c.rows;
  // Nur Straßen als Startzellen (wie die Prüfung der Zellen beim Weg)
  const from = [];
  for (const i of starts) if (roadAt(c, i)) from.push(i);
  const r = gridBfs(c, from, (j) => roadAt(c, j), CITY.transport.maxDist, { scratch: true });
  const reach = new Uint8Array(n);
  for (let k = 0; k < r.count; k++) reach[r.queue[k]] = 1;
  return reach;
}

/** Straßen zum Lager der Hauptstadt (roadReach ab mainAccess). Der einzige Maßstab für „an der Straße zum Lager“ (Warenweg, Anschluss, KI). */
export function mainRoadReach(game, c) {
  return roadReach(c, mainAccess(game, c));
}

/** Zellen, deren Rechteck die Zone des Lagers schneidet (wie mainAccess, aber für alle Zellen, nicht nur Straßen; seit v5.20, AP4). */
export function mainZone(game, c) {
  const n = c.cols * c.rows;
  const zone = new Uint8Array(n);
  const m = game.mainFob(c.team);
  if (!m) return zone;
  const T = game.grid.tile;
  const e = CITY.fobMargin + c.cell;
  const x0 = m.cx * T - e;
  const x1 = (m.cx + m.w) * T + e;
  const y0 = m.cy * T - e;
  const y1 = (m.cy + m.h) * T + e;
  for (let i = 0; i < n; i++) {
    const r = cellRect(c, i % c.cols, Math.floor(i / c.cols));
    if (r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0) zone[i] = 1;
  }
  return zone;
}

/**
 * Straßenanschluss für das Gebäude mit Anker a (seit v5.20, AP4): legt Straßen von seinen freien Nachbarzellen bis zur nächsten
 * Straßenzelle, die mit dem Lager verbunden ist. Nur ausweisbare, leere, freie Zellen; höchstens
 * CITY.transport.connectMax neue Zellen. Mit `pay` über game.issue (kostet Baumaterial je Zelle), sonst direkt wie beim Startviertel.
 * Optional `goal` (Uint8Array wie roadReach): Ziel statt des Lagers, z. B. das Netz der Einfuhrpunkte für ein Werk (Ausbau der KI).
 * Rückgabe: Zahl der gelegten Zellen; 0, wenn der Anschluss schon besteht; −1, wenn es keinen Weg gibt oder das Baumaterial fehlt.
 */
export function connectRoad(game, c, a, pay, goal = null) {
  const anchor = anchorOf(c, a);
  return connectCells(game, c, cellsOf(c, anchor), pay, goal, accessCells(c, anchor));
}

/**
 * Wie connectRoad, aber für die Zellen `cells` eines Platzes, der noch nicht steht (Lager und Tanks des Fliegerhorsts, die die KI
 * an die Straße legt, bevor sie gebaut werden: das Baugebiet verlangt den Anschluss). `have` = Straßen, die die Zellen schon berühren
 * (Vorgabe: die des Gebäudes). Der Weg führt nie über die Zellen selbst.
 */
export function connectCells(game, c, cells, pay, goal = null, have = roadsAround(c, cells, []), max = CITY.transport.connectMax) {
  const path = connectPath(game, c, cells, pay, goal, have, max);
  if (path === null) return -1;
  if (!path.length) return 0;
  if (pay) {
    const main = game.mainFob(c.team);
    if (!main || main.store.bm < CITY.costBm.road * path.length || game.teams[c.team].res.money < CITY.cost.road * path.length) return -1;
    for (const i of path) {
      const col = i % c.cols;
      const row = (i - col) / c.cols;
      game.issue(c.team, { type: 'city', kind: 'road', c0: col, r0: row, c1: col, r1: row });
    }
  } else {
    for (const i of path) placeBuilt(game, c, i, 'road');
    rebuildList(c);
  }
  return path.length;
}

/**
 * Weg für connectCells, ohne zu bauen: neue Straßenzellen (kürzester Weg, höchstens `max`), [] wenn der Anschluss schon besteht,
 * null ohne Weg. Mit `pay` gilt das Baugebiet (Spieler und KI), sonst nur die Ausweisbarkeit (Startviertel).
 */
export function connectPath(game, c, cells, pay, goal = null, have = roadsAround(c, cells, []), max = CITY.transport.connectMax) {
  const reach = goal ?? mainRoadReach(game, c);
  // Ohne Ziel (Lager): auch eine freie Zelle in der Zone des Lagers ist Anschluss, sie wird Straße dort
  const zone = goal ? null : mainZone(game, c);
  const atEnd = (i) => !!zone?.[i] || nbrsOf(c, i).some((j) => reach[j]);
  if (have.some((j) => reach[j])) return [];
  // Ohne erlaubte Länge (max < 1) wird keine Schicht geprüft: kein Weg (gridBfs prüfte die Startzellen sonst trotzdem)
  if (max < 1) return null;
  const n = c.cols * c.rows;
  // Baugebiet (seit v5.78) gilt für Anschlüsse, die der Spieler oder die KI bezahlen (pay); das Startviertel (pay false) baut ohne Regel
  const inside = new Set(cells);
  const ok = (j) => !inside.has(j) && (pay ? buildAllowed(game, c, j, 'road') : canZone(game, c, j)) && !c.kind[j] && cellFree(game, c, j % c.cols, Math.floor(j / c.cols));
  // Startzellen (Schicht 1): freie Nachbarn der Zellen des Gebäudes
  const starts = [];
  for (const i of cells) for (const j of nbrsOf(c, i)) if (ok(j)) starts.push(j);
  // Auch vom Straßennetz aus, an dem das Gebäude schon hängt (seit v5.82): Sind seine freien Nachbarn schon Straße, muss der neue
  // Anschluss am Rand dieses Netzes beginnen (sonst findet die KI nie einen Weg zu einem Zielnetz, das mit dem Netz des Gebäudes nur über
  // die Hauptstadt zusammenhängt, durch die keine Ware fährt).
  // Nur für bezahlte Anschlüsse (KI, Spieler); das Startviertel (pay false) baut wie bisher, damit Startzustände je Seed gleich bleiben.
  const own = pay ? roadReach(c, have) : null;
  for (let i = 0; own && i < n; i++) {
    if (!own[i] || !roadAt(c, i)) continue;
    for (const j of nbrsOf(c, i)) if (ok(j)) starts.push(j);
  }
  // Breitensuche in Schichten (gridBfs, Startabstand 1): Schicht d hat Wege mit d neuen Zellen; Ende an der ersten Zelle, die an eine
  // verbundene Straße grenzt. Zellen mit Abstand max werden nicht mehr erweitert.
  const r = gridBfs(c, starts, ok, max, { base: 1, goal: atEnd, scratch: true });
  if (r.end < 0) return null;
  return bfsPath(r, r.end);
}

/**
 * Straßenzellen, die über Straßen von einem Einfuhrpunkt aus erreichbar sind (Paket „Import“): eigene Straßen am Kartenrand und die
 * Straßen an fertigen Güterbahnhöfen mit Gleis zum Kartenrand. Ziel für den Anschluss eines Werks (Ausbau der KI). null ohne Einfuhrpunkt.
 */
export function importReach(c) {
  const starts = [];
  const RD = KIND_ID.road;
  const ST = KIND_ID.station;
  for (const i of c.list) {
    if (c.kind[i] === RD && atEdge(c, i)) starts.push(i);
    else if (c.kind[i] === ST && !isPart(c, i) && c.level[i] && stationLinked(c, i)) for (const j of accessCells(c, i)) starts.push(j);
  }
  return starts.length ? roadReach(c, starts) : null;
}

/**
 * Straße zum Kartenrand (Paket „Import“): legt den kürzesten Weg aus neuen Straßenzellen vom Netz, das von den Straßenzellen `starts`
 * aus über Straßen erreichbar ist, bis zu einer Zelle in der äußersten Zeile oder Spalte. Nur ausweisbare, leere, freie Zellen, höchstens
 * `max` neue Zellen. Mit `pay` über game.issue (Baumaterial je Zelle, Baugebiet), sonst direkt (Startviertel). Rückgabe: Zahl der
 * gelegten Zellen; 0, wenn das Netz den Rand schon erreicht; −1 ohne Weg oder ohne Baumaterial.
 */
export function connectEdge(game, c, starts, pay, max = c.cols + c.rows) {
  const reach = roadReach(c, starts);
  const n = c.cols * c.rows;
  for (let i = 0; i < n; i++) if (reach[i] && c.kind[i] === KIND_ID.road && atEdge(c, i)) return 0;
  // Ohne erlaubte Länge (max < 1) wird keine Schicht geprüft: wie vorher −1
  if (max < 1) return -1;
  const ok = (j) => (pay ? buildAllowed(game, c, j, 'road') : canZone(game, c, j)) && !c.kind[j] && cellFree(game, c, j % c.cols, Math.floor(j / c.cols));
  // Startzellen (Schicht 1) in fester Reihenfolge: Zellindex aufsteigend, Nachbarn mit ok
  const front = [];
  for (let i = 0; i < n; i++) {
    if (!reach[i]) continue;
    for (const j of nbrsOf(c, i)) if (ok(j)) front.push(j);
  }
  // Breitensuche in Schichten (gridBfs, Startabstand 1), Ende an der ersten Randzelle
  const r = gridBfs(c, front, ok, max, { base: 1, goal: (i) => atEdge(c, i), scratch: true });
  if (r.end < 0) return -1;
  const path = bfsPath(r, r.end);
  if (pay) {
    const main = game.mainFob(c.team);
    if (!main || main.store.bm < CITY.costBm.road * path.length || game.teams[c.team].res.money < CITY.cost.road * path.length) return -1;
    for (const i of path) {
      const col = i % c.cols;
      const row = (i - col) / c.cols;
      game.issue(c.team, { type: 'city', kind: 'road', c0: col, r0: row, c1: col, r1: row });
    }
  } else {
    for (const i of path) placeBuilt(game, c, i, 'road');
    rebuildList(c);
  }
  return path.length;
}
