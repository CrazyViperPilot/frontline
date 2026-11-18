// Lagerhalle (Paket „Lagerhalle“, Plan docs/plan-lagerhallen.md): Zellenart der Stadt, füllt sich über die Straße aus dem Lager der
// Hauptstadt, LKW laden dort, Einheiten im Umkreis füllen nach; höchstens eine je vordere FOB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { BALANCE } from '../js/data/balance.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { feedFactor } from '../js/game/city/economy.js';
import { spot, run } from './cityhelp.js';
import { fobAt } from './gamehelp.js';
import { withValue } from './util.js';

/** Spiel mit einer vorderen FOB (Team 0) und einer fertigen, angeschlossenen Lagerhalle nahe der Hauptstadt. */
function scene() {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const m = g.mainFob(0);
  fobAt(g, 0, m.x, m.y);
  const c = g.city[0];
  const p = spot(g, 2, 2);
  const r = g.issue(0, { type: 'city', kind: 'warehouse', c0: p.c, r0: p.r, c1: p.c + 1, r1: p.r + 1 });
  assert.equal(r.ok, true, r.reason);
  const a = r.anchor ?? p.r * c.cols + p.c;
  withValue(CITY.transport, 'connectMax', 400, () => assert.ok(connectRoad(g, c, a, false) >= 0, 'Weg zum Lager'));
  run(g, CITY.growTime + 1);
  const hall = c.ents.get(a);
  assert.ok(hall && c.level[a] >= 1, 'Lagerhalle steht');
  return { g, c, a, hall, m };
}

test('Lagerhalle: höchstens eine je vordere FOB, ohne vordere FOB keine', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const c = g.city[0];
  const p = spot(g, 2, 2);
  const none = g.issue(0, { type: 'city', kind: 'warehouse', c0: p.c, r0: p.r, c1: p.c + 1, r1: p.r + 1 });
  assert.equal(none.ok, false);
  assert.match(none.reason, /vorderen FOB/);
  const m = g.mainFob(0);
  fobAt(g, 0, m.x, m.y);
  assert.equal(g.issue(0, { type: 'city', kind: 'warehouse', c0: p.c, r0: p.r, c1: p.c + 1, r1: p.r + 1 }).ok, true);
  const q = spot(g, 2, 2);
  const second = g.issue(0, { type: 'city', kind: 'warehouse', c0: q.c, r0: q.r, c1: q.c + 1, r1: q.r + 1 });
  assert.equal(second.ok, false);
  assert.match(second.reason, /Höchstens eine Lagerhalle je vordere FOB/);
  assert.ok(c.list.length > 0);
});

test('Lagerhalle füllt sich über die Straße aus der Hauptstadt (je Sorte, bis cap), die Hauptstadt behält keep', () => {
  const { g, hall, m } = scene();
  const before = { ...m.store };
  run(g, 20);
  const st = hall.store;
  for (const k of ['bm', 'mun', 'fuel']) {
    assert.ok(st[k] > 0, `${k} angekommen: ${st[k]}`);
    assert.ok(st[k] <= CITY.warehouse.cap[1] + 1e-6, `${k} bis cap`);
  }
  assert.ok(m.store.mun < before.mun + 1, 'die Hauptstadt gibt Munition ab');
  // Mindestbestand: die Lagerhalle zieht die Hauptstadt nie unter keep (die Werke liefern laufend nach)
  for (const k of ['bm', 'mun', 'fuel']) m.store[k] = CITY.warehouse.keep;
  for (let n = 0; n < 100; n++) {
    g.update(0.05);
    for (const k of ['bm', 'mun', 'fuel']) assert.ok(m.store[k] >= CITY.warehouse.keep - 1e-6, `${k}: keep bleibt (${m.store[k]})`);
  }
});

test('LKW laden an der Lagerhalle, Einheiten im Umkreis füllen aus ihr nach', () => {
  const { g, hall } = scene();
  // vordere FOBs voll: sonst gibt die Halle alles an sie weiter (Paket „Lagerhalle 2“)
  for (const b of g.buildings) if (b.type === 'fob' && !b.main) b.store.bm = b.store.mun = b.store.fuel = BALANCE.logistics.storeCap;
  run(g, 30);
  for (const u of g.units) if (u.team === 0 && u.type !== 'truck') u.alive = false; // nur der Test handelt
  const truck = g.units.find((u) => u.alive && u.team === 0 && u.type === 'truck');
  const mun0 = hall.store.mun;
  const r = g.issue(0, { type: 'load', ids: [truck.id], fobId: hall.id, preset: 'mun' });
  assert.equal(r.ok, true, r.reason);
  for (let k = 0; k < 120 && truck.cargo.mun <= 0; k++) run(g, 1);
  assert.ok(truck.cargo.mun > 0, 'LKW hat Munition geladen');
  assert.ok(hall.store.mun < mun0 + CITY.warehouse.fill[1] * 130, 'aus der Lagerhalle');
  truck.alive = false; // der LKW hätte die Halle weiter geleert
  run(g, 10);
  assert.ok(hall.store.mun > 1, `Lagerhalle hat wieder Munition (${hall.store.mun})`);
  // Nachfüllen: Schütze ohne Munition auf der von der Hauptstadt abgewandten Seite der Lagerhalle, außer Reichweite jeder FOB
  const m = g.mainFob(0);
  const d = Math.hypot(hall.x - m.x, hall.y - m.y) || 1;
  let rifle = null;
  for (const off of [300, 360, 420]) {
    const x = hall.x + ((hall.x - m.x) / d) * off;
    const y = hall.y + ((hall.y - m.y) / d) * off;
    const fobNear = g.buildings.some((b) => b.alive && b.team === 0 && b.type === 'fob' && Math.hypot(b.x - x, b.y - y) <= 450);
    if (!fobNear) {
      rifle = g.spawnUnit('rifleman', 0, x, y);
      break;
    }
  }
  assert.ok(rifle, 'Platz außer Reichweite der FOBs, im Umkreis der Lagerhalle');
  rifle.ammo = 0;
  const hallMun = hall.store.mun;
  run(g, 3);
  assert.ok(rifle.ammo > 0, 'Schütze füllt aus der Lagerhalle nach');
  assert.ok(hall.store.mun < hallMun + CITY.warehouse.fill[1] * 3, 'Munition aus der Lagerhalle');
});

test('Lagerhalle füllt vordere FOBs bis feed.reach auf, nahe zuerst; weiter weg langsamer, außerhalb nichts (Paket „Lagerhalle 2“)', () => {
  const { g, hall } = scene();
  const F = CITY.warehouse.feed;
  assert.equal(feedFactor(F.near), 1);
  assert.ok(Math.abs(feedFactor(F.reach) - F.min) < 1e-9);
  assert.equal(feedFactor(F.reach + 1), 0);
  // drei vordere FOBs in festen Abständen zur Halle (leer), Halle voll
  const at = (d) => {
    const f = g.spawnBuilding('fob', 0, Math.round((hall.x + d) / 32), Math.round(hall.y / 32), { built: true });
    f.store.bm = f.store.mun = f.store.fuel = 0;
    return f;
  };
  for (const b of g.buildings) if (b.type === 'fob' && !b.main) b.store.bm = b.store.mun = b.store.fuel = BALANCE.logistics.storeCap; // alte FOB voll
  const near = at(300);
  const mid = at(1200);
  const far = at(F.reach + 300);
  hall.store.bm = hall.store.mun = hall.store.fuel = 1000;
  run(g, 10);
  assert.ok(near.store.mun > 0, `nahe FOB bekommt Munition (${near.store.mun})`);
  assert.equal(far.store.mun, 0, 'außerhalb von reach nichts');
  // je Sorte höchstens rate je s zusammen: in 10 s höchstens 10 × rate (Stufe 1) an alle FOBs
  const lv = 1;
  assert.ok(near.store.mun + mid.store.mun <= 10 * F.rate[lv] + 1e-6, `zusammen höchstens rate je s (${near.store.mun + mid.store.mun})`);
  // weiter weg langsamer: die mittlere bekommt erst, was die nahe übrig lässt, höchstens rate × Faktor
  assert.ok(mid.store.mun <= near.store.mun + 1e-6, 'nahe FOB zuerst');
});

test('KI baut eine Lagerhalle in Reichweite ihrer knappen vorderen FOB, mit Straße zum Lager; nicht vor hallFrom, nicht auf Leicht (Paket „Lagerhalle 3“)', async () => {
  const { aiWarehouse } = await import('../js/ai/city/warehouse.js');
  const { cityAiMemory } = await import('../js/ai/city/common.js');
  const { cellsOf } = await import('../js/game/city/cells.js');
  const { mainRoadPlan } = await import('../js/game/city/commands.js');
  const g = new Game({ seed: 3, startMoney: 5000 });
  const m = g.mainFob(0);
  const f = fobAt(g, 0, m.x, m.y); // Lager 0: knapp
  const c = g.city[0];
  const mem = cityAiMemory();
  const call = (diff) => aiWarehouse(g, c, m, g.teams[0].res.money, CITY.ai.reserve[diff], diff, mem);
  assert.equal(call('normal'), false, 'vor hallFrom nicht');
  g.time = CITY.ai.hallFrom.normal + 1;
  assert.equal(call('easy'), false, 'Leicht baut keine');
  assert.equal(call('normal'), true, 'Normal baut eine');
  const a = c.list.find((i) => c.kind[i] === KIND_ID.warehouse);
  assert.ok(a != null, 'Lagerhalle ausgewiesen');
  const [x, y] = [(a % c.cols + 1) * c.cell, (Math.floor(a / c.cols) + 1) * c.cell];
  assert.ok(Math.hypot(x - f.x, y - f.y) <= CITY.warehouse.feed.reach, 'in Reichweite der FOB');
  assert.deepEqual(mainRoadPlan(g, c, a), [], 'Straße zum Lager liegt');
  assert.equal(call('normal'), false, 'höchstens eine je vordere FOB');
  assert.ok(cellsOf(c, a).length === 4);
});
