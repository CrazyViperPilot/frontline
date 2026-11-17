// Stadt-Markt (PRD §15): Flucht, Stahl, Handel mit Losen, Angriff auf Stadtgebäude.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { cityNoise } from '../js/game/city/state.js';
import { hasMarket, cityEntityAt, marketBuyPrice } from '../js/game/city/query.js';
import { connectEdge } from '../js/game/city/roadnet.js';
import { run, base, paint, at, clearStart, raw, linkMain, trainerFor } from './cityhelp.js';

// Summe von n Losen, wenn jedes Los den Aufschlag je Los erhöht (CITY.market.surge, wie tradeLot)
function lotSpent(n, base, heat = 0) {
  let s = 0;
  for (let k = 0; k < n; k++) {
    s += Math.round(base * (1 + heat));
    heat = (1 + heat) * (1 + CITY.market.surge) - 1;
  }
  return s;
}

test('Flucht: Schüsse in der Konfliktzone leeren Wohnzellen, nach Ruhe kehren sie zurück', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  clearStart(g);
  const c = g.city[0];
  const z = g.zone;
  const zc = Math.floor(z.x / c.cell);
  const zr = Math.floor(z.y / c.cell);
  // freie Zellen in der Zone suchen und als Gebiet freigeben (vordere FOB simuliert)
  let s = null;
  for (let r = zr - 10; !s && r < zr + 10; r++) for (let q = zc - 10; !s && q < zc + 10; q++) {
    const ok = [0, 1, 2].every((k) => !c.blocked[(r + k) * c.cols + q] && !c.mapRoads?.[(r + k) * c.cols + q] && c.inZone[(r + k) * c.cols + q]); // nicht auf einer Stadtstraße der Karte
    if (ok) s = { q, r };
  }
  assert.ok(s, 'freie Zellen in der Zone');
  for (let k = 0; k < 3; k++) c.claim[(s.r + k) * c.cols + s.q] = 1;
  c.claimTimer = -1e9; // Gebiet nicht neu berechnen
  raw(g, 'road', s.q, s.r, s.q, s.r);
  raw(g, 'res', s.q, s.r + 1, s.q, s.r + 1);
  raw(g, 'bm', s.q, s.r + 2, s.q, s.r + 2);
  run(g, CITY.growTime + 5);
  const i = (s.r + 1) * c.cols + s.q;
  assert.equal(c.level[i], 1);
  assert.ok(c.stats.housing > 0);
  cityNoise(g, (s.q + 0.5) * c.cell, (s.r + 2.5) * c.cell); // Schuss in der Nachbarzelle
  run(g, 1);
  assert.ok(c.flee[i] > 0, 'Bewohner fliehen');
  assert.equal(c.stats.housing, 0);
  run(g, CITY.flee.calm + 1);
  assert.equal(c.flee[i], 0);
  assert.ok(c.stats.housing > 0, 'zurück nach der Ruhezeit');
});

test('Stahl: Stahlwerk mit Einfuhr liefert, Fahrzeuge kosten Stahl, Abbruch erstattet', () => {
  const g = new Game({ seed: 3, startMoney: 9000 });
  const c = g.city[0];
  paint(g, 'road', 0, 0, 9, 0);
  paint(g, 'res', 0, 1, 9, 1);
  assert.ok(paint(g, 'steel', 0, 2, 1, 3).ok); // 2 × 2 (seit v5.08), Straße darunter
  paint(g, 'road', 0, 4, 4, 4);
  linkMain(g, 0, c.list.find((i) => c.kind[i] === KIND_ID.steel));
  assert.ok(connectEdge(g, c, [at(g, 0, 0)], false) >= 0, 'Straße zum Kartenrand');
  run(g, 90);
  assert.ok(c.stats.raw.ore > 0 && c.stats.metal > 0, `Stahl/s ${c.stats.metal}, Eisen/s ${c.stats.raw.ore}`);
  c.metal = 50;
  const r = g.issue(0, { type: 'train', buildingId: trainerFor(g, 'tank').id, unit: 'tank' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Stahl/);
  c.metal = 500;
  assert.ok(g.issue(0, { type: 'train', buildingId: trainerFor(g, 'tank').id, unit: 'tank' }).ok);
  assert.equal(c.metal, 500 - CITY.metalCost.tank);
  assert.ok(g.issue(0, { type: 'cancelTrain', buildingId: trainerFor(g, 'tank').id }).ok);
  assert.equal(c.metal, 500);
});

test('Markt: ohne Markt kein Handel, verkaufen und kaufen in Losen', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const m = g.mainFob(0);
  assert.match(g.issue(0, { type: 'trade', good: 'bm', dir: 'sell' }).reason, /Markt/);
  paint(g, 'road', 0, 0, 3, 0);
  paint(g, 'market', 0, 1, 0, 1);
  assert.equal(hasMarket(g, 0), false); // ausgewiesen, noch nicht gewachsen
  run(g, CITY.growTime + 1);
  assert.equal(hasMarket(g, 0), true); // Geldanzeige öffnet jetzt das Marktmenü (v4.94)
  assert.equal(hasMarket(g, 1), false);
  // das fertige Gebäude ist eine wählbare Entity des Teams (Auswahl zeigt Infos und Aktionen)
  const mk = [...g.city[0].ents.values()].find((e) => g.city[0].kind[e.cityCell] === KIND_ID.market);
  assert.ok(mk && mk.type === 'city' && mk.team === 0);
  assert.equal(cityEntityAt(g, mk.x, mk.y), mk);
  const bm = m.store.bm;
  const money = g.teams[0].res.money;
  assert.ok(g.issue(0, { type: 'trade', good: 'bm', dir: 'sell' }).ok);
  assert.ok(m.store.bm < bm - CITY.market.lot + 50);
  assert.ok(g.teams[0].res.money >= money + CITY.market.sell.bm - 1);
  const metal = g.city[0].metal;
  assert.ok(g.issue(0, { type: 'trade', good: 'metal', dir: 'buy' }).ok);
  assert.ok(g.city[0].metal >= metal + CITY.market.lot - 1);

  // ×10: zehn Lose auf einmal, jedes Los zum jeweils aktuellen Preis (Lager leer genug, Geld reicht)
  g.city[0].metal = 0;
  g.city[0].marketHeat = {}; // Aufschlag zurücksetzen
  g.teams[0].res.money = 100000;
  const r10 = g.issue(0, { type: 'trade', good: 'metal', dir: 'buy', count: 10 });
  assert.equal(r10.ok, true);
  assert.equal(r10.done, 10);
  assert.equal(g.city[0].metal, 10 * CITY.market.lot);
  assert.equal(g.teams[0].res.money, 100000 - lotSpent(10, CITY.market.buy.metal));
  // ×100 mit Geld für nur 3 Lose: kauft 3, meldet den Grund
  g.teams[0].res.money = lotSpent(3, CITY.market.buy.metal, g.city[0].marketHeat.metal ?? 0) + 1;
  const r100 = g.issue(0, { type: 'trade', good: 'metal', dir: 'buy', count: 100 });
  assert.equal(r100.ok, true);
  assert.equal(r100.done, 3);
  assert.match(r100.reason, /Geld/);
  // ×10 verkaufen mit Bestand für 13 Lose: verkauft 10
  const sold = g.issue(0, { type: 'trade', good: 'metal', dir: 'sell', count: 10 });
  assert.equal(sold.done, 10);
  assert.equal(g.city[0].metal, 3 * CITY.market.lot);
  // Unsinnige Zahl: höchstens maxCount, mindestens 1
  assert.equal(g.issue(0, { type: 'trade', good: 'metal', dir: 'sell', count: -5 }).done, 1);
  // kein Geld: das erste Los scheitert, Grund wie bisher
  g.teams[0].res.money = 0;
  const none = g.issue(0, { type: 'trade', good: 'metal', dir: 'buy', count: 100 });
  assert.equal(none.ok, false);
  assert.match(none.reason, /Geld/);
});

test('Markt: Kaufpreis steigt je Los, klingt über Zeit ab, Verkauf und anderes Team bleiben unberührt', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  paint(g, 'road', 0, 0, 3, 0);
  paint(g, 'market', 0, 1, 0, 1);
  run(g, CITY.growTime + 1);
  assert.equal(hasMarket(g, 0), true);
  const base = CITY.market.buy.metal;
  assert.equal(marketBuyPrice(g, 0, 'metal'), base); // ohne Käufe der Grundpreis
  assert.ok(g.issue(0, { type: 'trade', good: 'metal', dir: 'buy' }).ok);
  const p1 = marketBuyPrice(g, 0, 'metal');
  assert.equal(p1, Math.round(base * (1 + CITY.market.surge))); // ein Los: +8 %
  assert.ok(g.issue(0, { type: 'trade', good: 'metal', dir: 'sell' }).ok);
  assert.equal(marketBuyPrice(g, 0, 'metal'), p1); // Verkauf ändert den Kaufpreis nicht
  assert.equal(marketBuyPrice(g, 1, 'metal'), base); // anderes Team unberührt
  assert.equal(marketBuyPrice(g, 0, 'bm'), CITY.market.buy.bm); // andere Ware unberührt
  assert.equal(CITY.market.sell.metal, 40); // Verkaufspreise unverändert
  // Zeit: der Aufschlag sinkt (CITY.market.calm je s, 10 s ≈ 9,5 % weniger)
  run(g, 10);
  const heat = g.city[0].marketHeat.metal;
  assert.ok(heat > CITY.market.surge * 0.9 && heat < CITY.market.surge * 0.92, `Aufschlag nach 10 s: ${heat}`);
  assert.ok(marketBuyPrice(g, 0, 'metal') < p1);
  // unter 0,001 fällt der Rest ganz weg
  g.city[0].marketHeat.metal = 0.0009;
  g.update(0.05);
  assert.equal(marketBuyPrice(g, 0, 'metal'), base);
});

test('Markt: mehrere Lose kosten je Los den jeweils aktuellen Preis', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  paint(g, 'road', 0, 0, 3, 0);
  paint(g, 'market', 0, 1, 0, 1);
  run(g, CITY.growTime + 1);
  g.teams[0].res.money = 100000;
  const h0 = g.city[0].marketHeat?.bm ?? 0;
  const before = g.teams[0].res.money;
  const r = g.issue(0, { type: 'trade', good: 'bm', dir: 'buy', count: 3 });
  assert.equal(r.done, 3);
  assert.equal(before - g.teams[0].res.money, lotSpent(3, CITY.market.buy.bm, h0));
  assert.ok(Math.abs(g.city[0].marketHeat.bm - ((1 + h0) * (1 + CITY.market.surge) ** 3 - 1)) < 1e-9);
});

test('Angriff: Stadtgebäude nehmen Schaden, werden Ruine (Prämie), wachsen danach neu', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const c = g.city[0];
  paint(g, 'road', 0, 0, 3, 0);
  paint(g, 'res', 0, 1, 0, 1);
  run(g, CITY.growTime + 1);
  const i = at(g, 0, 1);
  const e = c.ents.get(i);
  assert.ok(e && e.hp === CITY.hp[1], 'Gebäude ist ein Ziel');
  assert.equal(g.getEntity(e.id), e);
  // gegnerischer Panzer daneben: schießt von selbst auf das Gebäude
  for (const u of g.units) if (u.team === 0) { u.alive = false; u.hp = 0; } // keine Verteidiger
  const tank = g.spawnUnit('tank', 1, e.x + 150, e.y);
  g.fog[1].revealAll?.();
  const money1 = g.teams[1].res.money;
  g.fog[1].revealAll?.();
  assert.ok(g.issue(1, { type: 'attack', ids: [tank.id], targetId: e.id }).ok, 'Angriffsbefehl auf ein Stadtgebäude');
  for (let t = 0; t < 20 * 60 && c.level[i]; t++) {
    g.fog[1].revealAll?.();
    g.update(0.05);
  }
  assert.ok(tank.alive);
  assert.equal(c.level[i], 0, 'zerstört');
  assert.ok(c.timer[i] < 0, 'Ruine');
  assert.ok(g.teams[1].res.money > money1, 'Prämie');
  assert.equal(c.ents.has(i), false);
  tank.alive = false; tank.hp = 0;
  run(g, CITY.ruinTime + CITY.growTime + 2);
  assert.equal(c.level[i], 1, 'wiederaufgebaut');
});
