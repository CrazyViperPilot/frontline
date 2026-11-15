// Stadt (PRD §15), Erzeugung: Raster je Team über die ganze Karte, gesperrte Zellen, Konfliktzone, Startviertel (seit Paket „Import“
// mit Straße zum Kartenrand; Rohstoffvorkommen gibt es nicht mehr).
// Nur aktiv, wenn das Spiel mit `city: true` startet. Kein DOM, deterministisch.
import { quarterAt } from '../conquest.js';
import { inZone } from '../zonegeo.js';
import { CITY } from '../../data/city.js';
import { KINDS, KIND_ID } from '../../data/citykinds.js';
import { nearMain, cellAt, sizeOf, isPart, bigSpan, bigCenter, bigFits, cellFree, canZone, accessCells, mainAccess } from './cells.js';
import { connectRoad, connectEdge } from './roadnet.js';
import { zeroStats, updateClaim, rebuildList, placeBuilt, placeBuiltBig } from './state.js';

/**
 * Gesperrte Zellen (für beide Teams gleich): unter und um jede Hauptstadt oder auf Hindernissen (Bäume, Wasser, Häuser, Gebäude).
 * Seit v4.82 deckt das Stadtraster die ganze Karte (Zelle CITY.cell, Ursprung 0/0).
 */
function blockedCells(game, cols, rows) {
  const T = game.grid.tile;
  const S = CITY.cell;
  const k = S / T;
  const g = game.grid;
  const blocked = new Uint8Array(cols * rows);
  const mains = game.buildings.filter((b) => b.main);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx0 = col * S;
      const cy0 = row * S;
      let bad = nearMain(mains, T, cx0, cy0);
      for (let r = row * k; !bad && r < (row + 1) * k; r++) {
        for (let c = col * k; c < (col + 1) * k; c++) if (!g.free(c, r)) bad = true;
      }
      blocked[row * cols + col] = bad ? 1 : 0;
    }
  }
  return blocked;
}

/** Zellen, deren Mitte in der Konfliktzone liegt (dort fliehen Bewohner bei Beschuss). */
function zoneCells(game, cols, rows) {
  const S = CITY.cell;
  const z = game.zone ?? game.map.zone;
  const out = new Uint8Array(cols * rows);
  if (!z) return out;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * S;
      const y = (row + 0.5) * S;
      // Kreis oder (Eroberung) Quadrat der Flaggengebiete: zonegeo.js
      if (inZone(z, x, y)) out[row * cols + col] = 1;
    }
  }
  return out;
}

/** Eroberung: je Team die Zellen, auf denen es Stadtgebäude setzen darf (1 = eigenes Viertel, Zellmitte); klassisch null. */
export function ownCells(game, team, cols, rows) {
  if (!game.conquest) return null;
  const S = CITY.cell;
  const out = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (quarterAt(game, (col + 0.5) * S, (row + 0.5) * S) === team) out[row * cols + col] = 1;
  return out;
}

/** Stadt eines Teams: eigenes Zonenraster über die ganze Karte (gemeinsame Sperren), Gebiet, Einwohner. */
function createTeamCity(game, team, shared) {
  const { cols, rows, blocked, inZone, felled } = shared;
  const n = cols * rows;
  return {
    team,
    x0: 0, // linke obere Ecke des Rasters auf der Karte (px)
    y0: 0,
    cell: CITY.cell,
    gridId: game.newId(), // Kennung der Stadtgebäude im Belegungsraster (grid.struct)
    blocked, // 1 = hier kann nichts gebaut werden (beide Teams)
    felled, // 1 = Bäume gefällt (Räumen, seit v5.13; beide Teams)
    inZone, // 1 = Zelle in der Konfliktzone
    own: ownCells(game, team, cols, rows), // Eroberung: 1 = eigenes Viertel (nur dort wird gebaut); klassisch null
    mapRoads: game.roads?.kind ?? null, // Stadtstraßen der Karte (roads.js, seit v5.03): zählen als Straße, für beide Teams gleich
    metal: CITY.startMetal, // Stahl im Stadtlager (nur hier, LKW fahren es nicht)
    kero: CITY.startKero, // Kerosin im Stadtlager (seit v5.20)
    ents: new Map(), // Zelle → Ziel-Entity des Gebäudes (beschießbar, seit v4.83)
    cols,
    rows,
    kind: new Uint8Array(n), // Zellenart (KIND_ID), 0 leer
    level: new Uint8Array(n), // 0 = ausgewiesen, 1..maxLevel = Gebäude
    part: new Int32Array(n), // Großbau (seit v5.00): Mittelzelle + 1 für jede seiner Zellen, 0 = Einzelzelle
    timer: new Float32Array(n), // Wachstumszeit der Zelle
    out: new Float32Array(n), // Ausgangslager eines Werks (CITY.pickup), nur am Anker belegt; LKW holen es dort ab (seit v5.69)
    workOut: new Float32Array(n), // Ausstoß je s des Werks am Anker im letzten Schritt (Ware je s, seit v5.70; die KI nimmt nur laufende Werke als Pendlerquelle)
    pickClaim: new Uint8Array(n), // 1 am Anker: dem Werk ist gerade ein eigener LKW zugeteilt (updateLogistics setzt den Merker je Schritt, seit v5.69)
    flee: new Float32Array(n), // > 0: Bewohner geflohen, Ruhezeit bis zur Rückkehr (s)
    congestion: new Float32Array(n).fill(1), // Stau-Faktor je Straßenzelle (seit v5.20, transport.js): 1 frei, geglättet, wird gespeichert
    claim: new Uint8Array(n), // 1 = eigenes Gebiet
    claimVer: 0, // zählt hoch, wenn sich das Gebiet ändert (Darstellung)
    claimTimer: 0,
    list: [], // Indizes aller belegten Zellen (aufsteigend), damit nicht jeder Schritt die ganze Karte durchläuft
    ver: 0, // zählt hoch bei jeder Änderung an Zellen (Darstellung)
    popF: 0, // Einwohner (Bruchteile), Soldaten eingeschlossen
    drafted: 0, // Einwohner, die gerade als Truppen unterwegs sind
    stats: zeroStats(), // Rate je s und Summen des letzten Schritts (für die Anzeige)
  };
}

/** Stadt je Team anlegen; ohne `enabled` bleibt `game.city` null und alles andere wie gehabt. */
export function createCity(game, enabled) {
  game.city = null;
  if (!enabled) return;
  const cols = Math.floor((game.grid.cols * game.grid.tile) / CITY.cell);
  const rows = Math.floor((game.grid.rows * game.grid.tile) / CITY.cell);
  const blocked = blockedCells(game, cols, rows);
  const shared = { cols, rows, blocked, inZone: zoneCells(game, cols, rows), felled: new Uint8Array(cols * rows) };
  game.city = game.teams.map((t) => createTeamCity(game, t.id, shared));
  for (const b of game.buildings) {
    if (!b.main) continue;
    b.infinite = false; // endliches Lager: die Werke füllen es
    b.store = { ...CITY.startStock };
    b.produces = []; // seit v4.96: Truppen bilden Kaserne, Fabrikhalle und Heliport der Stadt aus
  }
  for (const c of game.city) {
    updateClaim(game, c);
    startQuarter(game, c);
    updateClaim(game, c);
  }
}

/**
 * Startviertel (CITY.startQuarter): Straße nahe der Hauptstadt, darunter Wohnen und Raffinerie, darüber (seit v5.03) die Großbauten
 * Kaserne und Fabrikhalle nebeneinander mit der Unterkante an der Straße. Passt das ganze Viertel nirgends, stehen die Großbauten so
 * nah wie möglich an der Hauptstadt; seit dem Paket „Straßen“ bekommen sie danach eine Straße zum Lager. Seit Paket „Import“ führt
 * eine Straße vom Netz des Viertels zum nächsten Kartenrand: dort führt die Raffinerie ab Sekunde 0 Öl ein.
 */
function startQuarter(game, c) {
  const m = game.mainFob(c.team);
  if (!m) return;
  const Q = CITY.startQuarter;
  const [fc, fr] = cellAt(c, m.x, m.y);
  const ok = (i) => canZone(game, c, i) && !c.kind[i] && cellFree(game, c, i % c.cols, Math.floor(i / c.cols));
  const big = Q.big ?? [];
  const best = quarterSpot(game, c, fc, fr, ok);
  if (best) {
    for (let k = 0; k < Q.road; k++) {
      placeBuilt(game, c, best.r * c.cols + best.q + k, 'road');
      const kind = Q.row[k];
      if (kind) placeBuilt(game, c, (best.r + 1) * c.cols + best.q + k, kind);
    }
    for (const [kind, off] of big) placeBuiltBig(game, c, cornerAnchor(c, kind, best.q + off, best.r - sizeOf(kind)), kind);
  } else looseQuarter(game, c, m, fc, fr, ok);
  rebuildList(c);
  // Anschluss ans Lager (seit v5.20, AP4): die Raffinerie; ohne Kosten
  for (const i of [...c.list]) if (!isPart(c, i) && c.level[i] && KINDS[c.kind[i] - 1] === 'fuel') connectRoad(game, c, i, false);
  // Kaserne und Fabrikhalle ebenso (Paket „Straßen“, Teil 2: Ausbildung nur mit Straßenweg zum Lager); besteht der Anschluss schon, bleibt alles gleich
  for (const i of [...c.list]) if (!isPart(c, i) && c.level[i] && CITY.produces[KINDS[c.kind[i] - 1]]) connectRoad(game, c, i, false);
  rebuildList(c);
  // Straße zum Kartenrand (Paket „Import“): vom Netz der Raffinerie aus (sie hängt am Lager), sonst vom Netz am Lager; ohne Kosten
  const fuel = c.list.find((i) => !isPart(c, i) && c.level[i] && KINDS[c.kind[i] - 1] === 'fuel');
  const starts = fuel !== undefined ? accessCells(c, fuel) : [];
  connectEdge(game, c, starts.length ? starts : mainAccess(game, c), false);
}

/** Anker eines Großbaus, dessen linke obere Ecke bei (q, r) liegt. */
function cornerAnchor(c, kind, q, r) {
  const [lo] = bigSpan(sizeOf(kind));
  return (r + lo) * c.cols + q + lo;
}

/**
 * Platz für das ganze Startviertel nahe der Hauptstadt (Zelle fc, fr): Straße der Länge Q.road in Zeile r ab Spalte q, darunter
 * Q.row, darüber die Großbauten Q.big. Ergebnis { q, r, d } (kleinster Abstand) oder null.
 */
function quarterSpot(game, c, fc, fr, ok) {
  const Q = CITY.startQuarter;
  const n = Q.road;
  const big = Q.big ?? [];
  const up = Math.max(0, ...big.map(([k]) => sizeOf(k))); // Zeilen über der Straße
  const fits = (q, r) => {
    for (let k = 0; k < n; k++) {
      if (!ok(r * c.cols + q + k)) return false;
      if (Q.row[k] && !ok((r + 1) * c.cols + q + k)) return false;
      const sz = Q.row[k] ? sizeOf(Q.row[k]) : 1; // Großbau unter der Straße: ganzes Quadrat frei
      if (sz > 1 && (q + k + sz > c.cols || r + 1 + sz > c.rows || !bigFits(game, c, cornerAnchor(c, Q.row[k], q + k, r + 1), sz, (j) => ok(j)))) return false;
    }
    for (const [kind, off] of big) {
      const sz = sizeOf(kind);
      if (q + off + sz > c.cols || r - sz < 0) return false;
      if (!bigFits(game, c, cornerAnchor(c, kind, q + off, r - sz), sz, (j) => ok(j))) return false;
    }
    return true;
  };
  let best = null;
  const R = 8 + up;
  for (let r = Math.max(up, fr - R); r <= Math.min(c.rows - 2, fr + R); r++) {
    for (let q = Math.max(0, fc - R); q <= Math.min(c.cols - n, fc + R); q++) {
      const d = Math.abs(q + n / 2 - fc) + Math.abs(r - up / 2 - fr);
      if (best && d >= best.d) continue;
      if (fits(q, r)) best = { q, r, d };
    }
  }
  return best;
}

/**
 * Kein Platz für das ganze Viertel: die Großbauten einzeln so nah wie möglich an der Hauptstadt m (größter zuerst), dazu Straße an der Seite zur Hauptstadt und die Zellen darunter an der Straße der Kaserne.
 */
function looseQuarter(game, c, m, fc, fr, ok) {
  const Q = CITY.startQuarter;
  const big = Q.big ?? [];
  const loose = (i) => canZone(game, c, i) && !c.kind[i] && cellFree(game, c, i % c.cols, Math.floor(i / c.cols));
  for (const [kind] of [...big].sort((p, o) => sizeOf(o[0]) - sizeOf(p[0]))) {
    const sz = sizeOf(kind);
    // Kandidaten nach Abstand ihrer Mitte zur Hauptstadt (beide Teams gleich behandelt: die Karte ist punktsymmetrisch)
    const cand = [];
    for (let r = Math.max(0, fr - 36); r <= Math.min(c.rows - 1, fr + 36); r++) {
      for (let q = Math.max(0, fc - 36); q <= Math.min(c.cols - 1, fc + 36); q++) {
        const p = bigCenter(c, r * c.cols + q, sz);
        cand.push({ a: r * c.cols + q, d: Math.hypot(p.x - m.x, p.y - m.y) });
      }
    }
    cand.sort((p, o) => p.d - o.d || p.a - o.a);
    const a = cand.find((k) => bigFits(game, c, k.a, sz, loose))?.a ?? -1;
    if (a < 0) continue;
    placeBuiltBig(game, c, a, kind);
    // Straße entlang der Seite, die zur Hauptstadt zeigt
    const [lo, hi] = bigSpan(sz);
    const q0 = (a % c.cols) - lo;
    const r0 = Math.floor(a / c.cols) - lo;
    const dx = fc - (q0 + sz / 2);
    const dy = fr - (r0 + sz / 2);
    const line = [];
    for (let k = -1; k <= sz; k++) {
      if (Math.abs(dx) > Math.abs(dy)) line.push([dx > 0 ? q0 + sz : q0 - 1, r0 + k]);
      else line.push([q0 + k, dy > 0 ? r0 + sz : r0 - 1]);
    }
    for (const [q, r] of line) if (q >= 0 && r >= 0 && q < c.cols && r < c.rows && ok(r * c.cols + q)) placeBuilt(game, c, r * c.cols + q, 'road');
    if (kind !== 'barracks') continue;
    // Wohnen und Raffinerie auf der anderen Seite der Straße der Kaserne
    const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    const sy = sx ? 0 : Math.sign(dy) || 1;
    Q.row.forEach((k, j) => {
      const [q, r] = line[j + 1];
      const i = (r + sy) * c.cols + q + sx;
      if (k && c.kind[r * c.cols + q] === KIND_ID.road && q + sx >= 0 && r + sy >= 0 && q + sx < c.cols && r + sy < c.rows && ok(i)) placeBuilt(game, c, i, k);
    });
    void hi;
  }
}
