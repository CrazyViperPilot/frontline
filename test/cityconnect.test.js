// Straße zum Lager (Paket „Straße zum Lager“, Befehl cityConnect, js/game/city/commands.js): kürzester Weg aus neuen, bezahlten
// Straßenzellen vom Stadtgebäude bis zur Straße zum Lager der Hauptstadt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { canZone, cellAt, cellFree } from '../js/game/city/cells.js';
import { placeBuilt } from '../js/game/city/state.js';
import { mainRoadPlan } from '../js/game/city/commands.js';
import { withValue } from './util.js';

/** Gewerbe (fertig, Stufe 1) ohne Straße, `d` Zellen von der Hauptstadt Richtung Kartenmitte, rundum frei. */
function lonely(g, d = 18) {
  const c = g.city[0];
  const m = g.mainFob(0);
  const [mq, mr] = cellAt(c, m.x, m.y);
  const sq = Math.sign(g.zone.x - m.x);
  const sr = Math.sign(g.zone.y - m.y);
  for (let k = d; k < d + 30; k++) {
    for (let o = -6; o <= 6; o++) {
      const q = mq + sq * k + o;
      const r = mr + sr * k;
      const i = r * c.cols + q;
      const free = (j) => canZone(g, c, j) && !c.kind[j] && cellFree(g, c, j % c.cols, Math.floor(j / c.cols));
      if (![i, i - 1, i + 1, i - c.cols, i + c.cols].every(free)) continue;
      placeBuilt(g, c, i, 'com');
      const e = c.ents.get(i);
      if (e) return { c, i, e };
    }
  }
  assert.fail('kein freier Platz für das Testgebäude');
}

test('Straße zum Lager: legt den geplanten Weg, bezahlt je Zelle, danach ist das Gebäude angeschlossen', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const { c, i, e } = lonely(g);
  const plan = mainRoadPlan(g, c, i);
  assert.ok(plan && plan.length >= 3, `ohne Straße: Weg über mehrere Zellen geplant (${plan?.length})`);
  const money = g.teams[0].res.money;
  const bm = g.mainFob(0).store.bm;
  const r = g.issue(0, { type: 'cityConnect', buildingId: e.id });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.cells, plan.length);
  assert.equal(g.teams[0].res.money, money - CITY.cost.road * plan.length);
  assert.equal(g.mainFob(0).store.bm, bm - CITY.costBm.road * plan.length);
  for (const j of plan) assert.equal(c.kind[j], KIND_ID.road, 'Straße auf jeder Zelle des Wegs');
  assert.deepEqual(mainRoadPlan(g, c, i), [], 'jetzt angeschlossen');
  const again = g.issue(0, { type: 'cityConnect', buildingId: e.id });
  assert.equal(again.ok, false);
  assert.match(again.reason, /schon eine Straße/);
});

test('Straße zum Lager: Ablehnungen (fremdes Gebäude, zu wenig Baumaterial, zu weit)', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const { c, i, e } = lonely(g);
  assert.equal(g.issue(1, { type: 'cityConnect', buildingId: e.id }).ok, false, 'fremdes Gebäude');
  const n = mainRoadPlan(g, c, i).length;
  const main = g.mainFob(0);
  const bm = main.store.bm;
  main.store.bm = CITY.costBm.road * n - 1;
  const poor = g.issue(0, { type: 'cityConnect', buildingId: e.id });
  assert.equal(poor.ok, false);
  assert.match(poor.reason, /Zu wenig Baumaterial/);
  assert.notEqual(c.kind[mainRoadPlan(g, c, i)[0]], KIND_ID.road, 'nichts gebaut');
  main.store.bm = bm;
  withValue(CITY, 'playerConnect', n - 1, () => {
    const far = g.issue(0, { type: 'cityConnect', buildingId: e.id });
    assert.equal(far.ok, false);
    assert.match(far.reason, /Kein freier Weg/);
  });
});
