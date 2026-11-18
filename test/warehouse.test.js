// Lagerhalle (Paket „Lagerhalle“, Plan docs/plan-lagerhallen.md): Zellenart der Stadt, füllt sich über die Straße aus dem Lager der
// Hauptstadt, LKW laden dort, Einheiten im Umkreis füllen nach; höchstens eine je vordere FOB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { connectRoad } from '../js/game/city/roadnet.js';
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
