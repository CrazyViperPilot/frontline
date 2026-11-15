// Straßentransport (js/game/transport.js, seit v5.20, AP2): Wege über Straßen, nächstes Ziel, Stau, Lager-Anschluss, Cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { cellsOf, anchorOf, canZone, roadAt, accessCells, cellRect, isPart } from '../js/game/city/cells.js';
import { connectEdge } from '../js/game/city/roadnet.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { UNITS } from '../js/data/units.js';
import { transportOf, transportInfo, mainAccess, pathEff, addLoad, beginLoads, settleLoads } from '../js/game/transport.js';

const run = (g, s) => { for (let t = 0; t < s * 20; t++) g.update(0.05); };

// Freie 10 × 6-Fläche nahe der Hauptstadt (Team 0), Ursprung (c, r)
function spot(g, w, h) {
  const c = g.city[0];
  const m = g.mainFob(0);
  const fc = Math.floor(m.x / c.cell);
  const fr = Math.floor(m.y / c.cell);
  let best = null;
  for (let r = 0; r <= c.rows - h; r++) {
    for (let q = 0; q <= c.cols - w; q++) {
      let ok = true;
      for (let y = r; ok && y < r + h; y++) for (let x = q; ok && x < q + w; x++) ok = canZone(g, c, y * c.cols + x) && !c.kind[y * c.cols + x];
      // Rand von einer Zelle ohne Straße und ohne Gebäude: die Fläche hängt nicht am Startviertel (seit v5.33, kleinere Fabrikhalle)
      for (let y = r - 1; ok && y <= r + h; y++) {
        for (let x = q - 1; ok && x <= q + w; x++) {
          if (y < 0 || x < 0 || y >= c.rows || x >= c.cols) continue;
          const j = y * c.cols + x;
          ok = !c.kind[j] && !roadAt(c, j);
        }
      }
      if (!ok) continue;
      const d = Math.abs(q - fc) + Math.abs(r - fr);
      if (!best || d < best.d) best = { c: q, r, d };
    }
  }
  assert.ok(best, 'kein Platz im Gebiet');
  return best;
}
const base = new WeakMap();
const baseOf = (g) => {
  if (!base.has(g)) base.set(g, spot(g, 10, 6));
  return base.get(g);
};
// Zelle (col, row) relativ zur Basisfläche
const at = (g, col, row) => { const b = baseOf(g); return (b.r + row) * g.city[0].cols + b.c + col; };
// Baubefehl im Rechteck (relativ zur Basisfläche); Gebäude und Straßen
function put(g, kind, c0, r0, c1, r1) {
  const b = baseOf(g);
  const res = g.issue(0, { type: 'city', kind, c0: b.c + c0, r0: b.r + r0, c1: b.c + c1, r1: b.r + r1 });
  assert.ok(res.ok, res.reason);
  return res;
}
// Gebäude an (col, row) sofort fertig (Stufe 1) setzen, wie in city.test.js
function finish(g, col, row) {
  const c = g.city[0];
  const i = at(g, col, row);
  for (const j of cellsOf(c, i)) c.level[j] = 1;
  return anchorOf(c, i);
}

// Stahlwerk bei (8,1), Straße durch Zeile 0 von Spalte 0 bis 9, von Spalte 0 eine Straße bis zum Kartenrand (Einfuhrpunkt, Paket „Import“)
function edgeWorks() {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  clearStart(g);
  put(g, 'road', 0, 0, 9, 0);
  put(g, 'steel', 8, 1, 9, 2);
  const c = g.city[0];
  assert.ok(connectEdge(g, c, [at(g, 0, 0)], false) > 0, 'Straße zum Kartenrand');
  const stahl = finish(g, 8, 1);
  c.ver++;
  return { g, c, stahl };
}

test('Einfuhrweg über Straßen: Stahlwerk bezieht Rohwaren vom Kartenrand, der Weg besteht aus Straßenzellen', () => {
  const { g, c, stahl } = edgeWorks();
  const tr = transportOf(g, c);
  const r = tr.imports.get(stahl);
  assert.equal(r.from, 'edge');
  assert.ok(r.dist > 8 && r.dist === r.path.length);
  assert.ok([...r.path].every((i) => roadAt(c, i)), 'alle Zellen des Weges sind Straßen');
  const info = transportInfo(g, c, stahl);
  assert.equal(info.importFrom, 'Kartenrand');
  assert.equal(info.importDist, r.dist);
  assert.equal(info.importEff, 1);
  assert.equal(tr.commute.get(stahl), null, 'ohne Wohnen kein Pendlerweg');
  assert.equal(info.noHome, true);
});

test('ohne Verbindung kein Einfuhrweg: Info ohne Herkunft', () => {
  const { g, c, stahl } = edgeWorks();
  const b = baseOf(g);
  g.issue(0, { type: 'city', kind: 'erase', c0: b.c + 8, r0: b.r, c1: b.c + 9, r1: b.r });
  assert.equal(transportOf(g, c).imports.get(stahl), null);
  assert.equal(transportInfo(g, c, stahl).importFrom, null);
});

test('Überlast → Stau-Faktor < 1 nach settleLoads, nach Entlastung wieder 1', () => {
  const { g, c, stahl } = edgeWorks();
  const tr = transportOf(g, c);
  const path = tr.imports.get(stahl).path;
  beginLoads(tr);
  addLoad(tr, path, CITY.transport.cap * 3);
  settleLoads(tr, CITY.transport.smooth);
  const eff = pathEff(tr, path);
  assert.ok(Math.abs(eff - 1 / 3) < 1e-4, `Wirkung ${eff} ≈ 1/3`);
  beginLoads(tr);
  settleLoads(tr, CITY.transport.smooth);
  assert.equal(pathEff(tr, path), 1);
});

test('Lager-Anschluss: Straße bis an die Hauptstadt macht mainAccess nicht leer, Werk liefert ins Lager', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = g.city[0];
  // Seit v5.20 (AP4) hat das Startviertel schon einen Anschluss ans Lager; die Straße hier ergänzt ihn. Seit v5.33 sucht der Test
  // die Zellen selbst: eine freie Zelle p im Anschlussbereich der Hauptstadt (eine Straße dort zählt zu mainAccess) und daneben ein
  // freies 2 × 2-Quadrat für das BM-Werk
  const m = g.mainFob(0);
  const mc = Math.floor(m.x / c.cell);
  const mr = Math.floor(m.y / c.cell);
  const free = (q, r) => q >= 0 && r >= 0 && q < c.cols && r < c.rows && !c.kind[r * c.cols + q] && canZone(g, c, r * c.cols + q);
  let found = null;
  for (let rad = 1; rad <= 6 && !found; rad++) {
    for (let r = mr - rad; r <= mr + rad && !found; r++) {
      for (let q = mc - rad; q <= mc + rad && !found; q++) {
        if (Math.max(Math.abs(q - mc), Math.abs(r - mr)) !== rad || !free(q, r)) continue;
        const before = mainAccess(g, c).length;
        // Werk 2 × 2 links oben daneben (die Zelle p bleibt Straße)
        for (const [dq, dr] of [[-2, 0], [1, 0], [0, -2], [0, 1], [-2, -1], [1, -1]]) {
          const ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([x, y]) => free(q + dq + x, r + dr + y));
          if (!ok) continue;
          const res = g.issue(0, { type: 'city', kind: 'road', c0: q, r0: r, c1: q, r1: r });
          if (!res.ok) break;
          if (!mainAccess(g, c).includes(r * c.cols + q)) {
            g.issue(0, { type: 'city', kind: 'erase', c0: q, r0: r, c1: q, r1: r });
            break;
          }
          assert.ok(mainAccess(g, c).length > before);
          found = { q, r, bq: q + dq, br: r + dr };
          break;
        }
      }
    }
  }
  assert.ok(found, 'Straße reicht an die Hauptstadt');
  g.issue(0, { type: 'city', kind: 'bm', c0: found.bq, r0: found.br, c1: found.bq + 1, r1: found.br + 1 });
  const bmAnchor = anchorOf(c, found.br * c.cols + found.bq);
  for (const j of cellsOf(c, bmAnchor)) c.level[j] = 1;
  const tr = transportOf(g, c);
  const r = tr.routes.get(bmAnchor);
  assert.equal(r.to, 'main', 'BM-Werk liefert ins Lager');
  assert.equal(transportInfo(g, c, bmAnchor).to, 'Lager');
});

test('Cache: nach Bau wird neu berechnet, ohne Änderung bleibt der Stand (auch nach Zeit), Rückkehr Geflohener rechnet neu', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  clearStart(g);
  put(g, 'road', 0, 0, 1, 0); // Straße nur bis Spalte 1
  put(g, 'steel', 8, 1, 9, 2); // ohne Anschluss
  const c = g.city[0];
  connectEdge(g, c, [at(g, 0, 0)], false);
  const stahl = finish(g, 8, 1);
  c.ver++;
  assert.equal(transportOf(g, c).imports.get(stahl), null, 'noch keine Verbindung');
  put(g, 'road', 2, 0, 8, 0);
  const tr2 = transportOf(g, c);
  assert.equal(tr2.imports.get(stahl).from, 'edge', 'nach dem Bau gefunden');
  const routes2 = tr2.routes;
  assert.equal(transportOf(g, c).routes, routes2);
  g.time += 100;
  assert.equal(transportOf(g, c).routes, routes2, 'ohne Änderung derselbe Stand');
  put(g, 'res', 4, 1, 4, 1);
  const home = finish(g, 4, 1);
  c.flee[home] = 0.01;
  c.ver++;
  assert.equal(transportInfo(g, c, stahl).noHome, true, 'geflohen: keine Wohnung erreichbar');
  const routes3 = transportOf(g, c).routes;
  g.update(0.05);
  assert.equal(c.flee[home], 0);
  assert.notEqual(transportOf(g, c).routes, routes3, 'nach der Rückkehr neu berechnet');
  assert.equal(transportInfo(g, c, stahl).noHome, false, 'Wohnung wieder Pendlerziel');
});

// ---- Rechnung je Gebäude (seit v5.20, AP3, PLAN 1.4): Straßen zum Lager, Pendler, Stau, Kerosin ----
// Die Tests bauen ihre Straßen selbst: Breitensuche über freie Zellen, dann je Zelle ein Straßenbefehl (wie in city.test.js).


const nbOf = (c, j) => {
  const q = j % c.cols;
  const r = (j - q) / c.cols;
  const out = [];
  if (q > 0) out.push(j - 1);
  if (q < c.cols - 1) out.push(j + 1);
  if (r > 0) out.push(j - c.cols);
  if (r < c.rows - 1) out.push(j + c.cols);
  return out;
};
// Breitensuche über freie Zellen ab `starts` bis goal(j) gilt; baut dann die Straße dorthin.
function connect(g, starts, goal) {
  const c = g.city[0];
  const n = c.cols * c.rows;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const q = [];
  const free = (k) => !seen[k] && !c.kind[k] && canZone(g, c, k);
  for (const k of starts) if (free(k)) { seen[k] = 1; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const j = q[h];
    if (goal(j)) {
      for (let x = j; x !== -1; x = prev[x]) {
        const col = x % c.cols;
        const row = Math.floor(x / c.cols);
        const res = g.issue(0, { type: 'city', kind: 'road', c0: col, r0: row, c1: col, r1: row });
        assert.ok(res.ok, res.reason);
      }
      return true;
    }
    for (const k of nbOf(c, j)) if (free(k)) { seen[k] = 1; prev[k] = j; q.push(k); }
  }
  return false;
}
// Gebäude mit Anker a an das Straßennetz anschließen (hat es schon einen Anschluss: nichts).
function linkRoad(g, a) {
  const c = g.city[0];
  if (accessCells(c, a).length) return;
  const starts = [];
  for (const j of cellsOf(c, a)) starts.push(...nbOf(c, j));
  // nur eigene Straßen: eine Straße der Karte ist nicht zwingend am eigenen Netz
  assert.ok(connect(g, starts, (j) => nbOf(c, j).some((k) => c.kind[k] === KIND_ID.road)), `keine Straße zu ${a}`);
}
// Das Straßennetz an das Lager der Hauptstadt anschließen (Zellen im Anschlussbereich des Lagers, wie mainAccess).
function connectMain(g) {
  const c = g.city[0];
  const m = g.mainFob(0);
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
  const starts = [];
  for (const i of c.list) if (c.kind[i] === KIND_ID.road) starts.push(...nbOf(c, i));
  assert.ok(connect(g, starts, reach), 'kein Anschluss ans Lager');
}
// Startviertel räumen: sein Straßenstück läge sonst als zweites Netz neben der Basisfläche.
function clearStart(g) {
  const c = g.city[0];
  for (const i of [...c.list]) {
    const q = i % c.cols;
    const r = (i - q) / c.cols;
    g.issue(0, { type: 'city', kind: 'erase', c0: q, r0: r, c1: q, r1: r });
  }
}
// Grundnetz: Straße durch Zeile 0 der Basisfläche, Wohnen in Zeile 1 (Spalten 0 … 2), Anschluss ans Lager.
function netBase(g) {
  clearStart(g);
  put(g, 'road', 0, 0, 9, 0);
  put(g, 'res', 0, 1, 2, 1);
  connectMain(g);
  return g.city[0];
}
// Fertiges Gebäude der Art kind (erstes passendes Anker-Gebäude), ohne auf den Bau zu warten.
function finishKind(g, kind) {
  const c = g.city[0];
  const a = c.list.find((i) => c.kind[i] === KIND_ID[kind] && !isPart(c, i));
  for (const j of cellsOf(c, a)) c.level[j] = 1;
  return a;
}
const stepN = (g, n) => { for (let t = 0; t < n; t++) g.update(0.05); };

// Grundnetz mit Straße zum Kartenrand (Einfuhrpunkt, Paket „Import“)
function netEdge(g) {
  const c = netBase(g);
  assert.ok(connectEdge(g, c, [at(g, 0, 0)], false) >= 0, 'Straße zum Kartenrand');
  return c;
}

test('Munitionswerk: Eisen und Sprengstoff über die Straße, Munition nur mit Weg ins Lager', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = netEdge(g);
  const m = g.mainFob(0);
  put(g, 'mun', 5, 1, 6, 2);
  const metal0 = c.metal;
  const mun0 = m.store.mun;
  run(g, CITY.growTime + 20);
  assert.ok(c.stats.gross.mun > 0, 'Munition wird hergestellt');
  assert.ok(m.store.mun > mun0, `Munition im Lager ${mun0} → ${m.store.mun}`);
  assert.ok(c.stats.raw.ore > 0 && c.stats.raw.expl > 0, 'Eisen und Sprengstoff kommen an');
  assert.equal(c.metal, metal0, 'kein Stahl abgezogen (seit Paket „Import“)');
});

test('Munitionswerk ohne Straße: keine Munition, keine Einfuhr, keine Kosten', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = netEdge(g);
  const m = g.mainFob(0);
  put(g, 'mun', 5, 3, 6, 4); // nicht an der Straße
  finishKind(g, 'mun');
  const mun0 = m.store.mun;
  run(g, 10);
  assert.equal(c.stats.gross.mun, 0);
  assert.equal(m.store.mun, mun0);
  assert.equal(c.stats.raw.expl, 0);
});

test('Arbeitsstätte ohne Weg zu Wohnen produziert nichts; mit Anschluss der Wohnungen läuft sie', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  clearStart(g);
  put(g, 'road', 0, 0, 9, 0);
  connectMain(g);
  const c = g.city[0];
  const m = g.mainFob(0);
  put(g, 'road', 0, 5, 3, 5);
  put(g, 'res', 0, 4, 3, 4);
  put(g, 'bm', 5, 1, 6, 2);
  const bm = c.list.find((i) => c.kind[i] === KIND_ID.bm);
  run(g, CITY.growTime + 10);
  assert.equal(transportInfo(g, c, bm).noHome, true, 'kein Wohnen erreichbar');
  assert.equal(c.stats.bm, 0, 'BM ohne Wohnung');
  assert.equal(c.stats.raw.raw, 0, 'keine Einfuhr ohne Arbeiter');
  const isl = [];
  for (let x = 0; x <= 3; x++) isl.push(at(g, x, 5));
  const islSet = new Set(isl);
  const starts = [];
  for (const j of isl) starts.push(...nbOf(c, j));
  assert.ok(connect(g, starts, (j) => nbOf(c, j).some((k) => c.kind[k] === KIND_ID.road && !islSet.has(k))), 'Insel anschließbar');
  assert.ok(connectEdge(g, c, [at(g, 9, 0)], false) >= 0, 'Straße zum Kartenrand');
  const bm0 = m.store.bm;
  run(g, 20);
  assert.equal(transportInfo(g, c, bm).noHome, false, 'Wohnen erreichbar');
  assert.ok(c.stats.gross.bm > 0 && m.store.bm > bm0, 'BM läuft mit Wohnen am Netz');
});

test('Überlast auf dem Lieferweg senkt die Lieferung (Stau-Faktor wirkt im Schritt)', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = netEdge(g);
  put(g, 'bm', 5, 1, 6, 2);
  run(g, CITY.growTime + 10);
  const tr = transportOf(g, c);
  const bm = c.list.find((i) => c.kind[i] === KIND_ID.bm);
  const path = tr.routes.get(bm).path;
  assert.ok(c.stats.gross.bm > 0 && path, 'BM läuft');
  for (const j of path) tr.factor[j] = 0.5; // Stau auf dem Weg zum Lager (der Einfuhrweg kann dieselben Zellen nutzen)
  stepN(g, 1);
  assert.ok(Math.abs(c.stats.bm - 0.5 * c.stats.gross.bm) < 1e-6, `Lieferung ${c.stats.bm} ≈ halb von ${c.stats.gross.bm}`);
});

test('Keine Ware aus dem Nichts: Lager-Zuwachs je Schritt ≤ angekommene Rohwaren über die Kette (auch Gewerbe-BM)', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = netEdge(g);
  const m = g.mainFob(0);
  const N = CITY.chain;
  put(g, 'bm', 3, 1, 4, 2);
  put(g, 'steel', 7, 1, 8, 2);
  put(g, 'com', 9, 1, 9, 1);
  put(g, 'mun', 5, 1, 6, 2);
  let bad = 0;
  let mun = 0;
  for (let t = 0; t < 1200; t++) {
    const metal0 = c.metal;
    const bm0 = m.store.bm;
    const mun0 = m.store.mun;
    g.update(0.05);
    const s = c.stats;
    if (c.metal - metal0 > (s.raw.ore * 0.05) / N.steel.need.ore + 1e-9) bad++;
    if (m.store.mun - mun0 > (s.raw.expl * 0.05) / N.mun.need.expl + 1e-9) bad++;
    if (m.store.bm - bm0 + s.shopBm * 0.05 > (s.raw.raw * 0.05) / N.bm.need.raw + 1e-9) bad++;
    if (c.metal < 0 || m.store.bm < 0 || !Number.isFinite(m.store.mun)) bad++;
    mun += Math.max(0, m.store.mun - mun0);
  }
  assert.equal(bad, 0, 'nie mehr im Lager als eingeführt');
  assert.ok(mun > 0, 'Munition entsteht (die Prüfung greift)');
});

test('Ohne Hauptstadt (zerstört): Werke fordern nichts an, liefern nichts, Gewerbe unversorgt, keine ungültigen Zahlen', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = netEdge(g);
  put(g, 'steel', 7, 1, 8, 2);
  put(g, 'com', 9, 1, 9, 1);
  put(g, 'mun', 5, 1, 6, 2);
  run(g, CITY.growTime + 20);
  assert.ok(c.stats.gross.metal > 0 && c.stats.gross.mun > 0, 'vorher: Stahl und Munition');
  const m = g.mainFob(0);
  m.alive = false;
  m.hp = 0;
  stepN(g, 40);
  const s = c.stats;
  assert.equal(g.mainFob(0), null);
  assert.equal(s.mun, 0, 'keine Munition');
  assert.equal(s.importCost, 0, 'keine Einfuhr ohne Lager');
  assert.equal(s.shopSupply, 0, 'Gewerbe ohne Waren');
  for (const v of [s.money, s.jam, s.lost, s.shop, s.happy]) assert.ok(Number.isFinite(v), `Zahl ${v}`);
});
