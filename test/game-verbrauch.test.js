// Spiel-Tests: Munition, Treibstoff, Waffen, Tanken und Bohrer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC } from './classic.js';
import { BALANCE } from '../js/data/balance.js';
import { UNITS } from '../js/data/units.js';
import { base, DT, mk, mkOld, run, cellOf, dist, fobOf, unitsOf, silence } from './gamehelp.js';

test('Verbrauch: ein Schuss zieht einen Schuss aus dem Einheitenvorrat, nicht aus dem Lager', () => {
  const g = mk({ seed: 7 });
  const sp = g.map.spawns[0];
  for (const u of unitsOf(g, 0)) u.alive = false; // Startaufstellung räumen
  const rifle = g.spawnUnit('rifleman', 0, sp.x + 300, sp.y - 300);
  const enemy = g.spawnUnit('rifleman', 1, rifle.x + 120, rifle.y);
  const stock0 = g.teams[0].res.mun;
  assert.equal(g.issue(0, { type: 'attack', ids: [rifle.id], targetId: enemy.id }).ok, true);
  run(g, DT);
  assert.equal(rifle.weapons[0].rounds, 59, 'ein Schuss weniger');
  assert.equal(g.teams[0].res.mun, stock0, 'Lager unberührt');
  assert.ok(Math.abs(g.teams[0].used.mun - 1 / 30) < 1e-9, 'Statistik: 1/30 Munition');
  assert.ok(rifle.weapons[0].cd > 0, 'Abklingzeit läuft nach dem Schuss');
});

test('Waffen: Kampfpanzer feuert Hauptkanone alle 6 s (20 Munition je Schuss) und nimmt das MG gegen Infanterie', () => {
  const g = mk({ seed: 7 });
  const sp = { x: g.zone.x, y: g.zone.y }; // weit weg von jeder FOB: kein Nachladen
  const tank = g.spawnUnit('tank', 0, sp.x + 300, sp.y - 300);
  const enemy = g.spawnUnit('tank', 1, tank.x + 200, tank.y);
  enemy.hp = enemy.maxHp = 1e6;
  g.issue(0, { type: 'attack', ids: [tank.id], targetId: enemy.id });
  run(g, 13);
  assert.equal(tank.weapons[0].rounds, 27, 'Schüsse bei 0, 6 und 12 s');
  assert.equal(tank.weapons[1].rounds, 300, 'MG nicht gegen Panzer');
  const inf = g.spawnUnit('rifleman', 1, tank.x + 150, tank.y + 20);
  g.issue(0, { type: 'attack', ids: [tank.id], targetId: inf.id });
  run(g, 3);
  assert.ok(tank.weapons[1].rounds < 300, 'MG gegen Infanterie (mehr Schaden je Munition)');
});

test('Waffen: Kampfhubschrauber nimmt Raketen gegen Panzer und die Bordkanone gegen Infanterie', () => {
  const g = mk({ seed: 7 });
  const sp = { x: g.zone.x, y: g.zone.y }; // weit weg von jeder FOB: kein Nachladen
  const heli = g.spawnUnit('gunship', 0, sp.x + 300, sp.y - 300);
  assert.deepEqual(heli.weapons.map((w) => w.rounds), [300, 10]);
  const tank = g.spawnUnit('tank', 1, heli.x + 200, heli.y);
  g.issue(0, { type: 'attack', ids: [heli.id], targetId: tank.id });
  run(g, 1);
  assert.equal(heli.weapons[1].rounds, 9, 'Rakete gegen Panzer');
  const inf = g.spawnUnit('rifleman', 1, heli.x + 100, heli.y + 50);
  g.issue(0, { type: 'attack', ids: [heli.id], targetId: inf.id });
  run(g, 1);
  assert.ok(heli.weapons[0].rounds < 300, 'Kanone gegen Infanterie');
  assert.equal(heli.weapons[1].rounds, 9);
});

test('Verbrauch: leerer Schütze feuert nicht, Abklingzeit läuft nicht an, Mangelmeldung', () => {
  const g = mkOld({ seed: 7 });
  const sp = g.map.spawns[0];
  const rifle = g.spawnUnit('rifleman', 0, sp.x + 300, sp.y - 300);
  const enemy = g.spawnUnit('rifleman', 1, rifle.x + 120, rifle.y);
  silence(g, 0);
  g.setStock(0, { bm: CLASSIC.bm, mun: 0, fuel: CLASSIC.fuel }); // kein Nachfüllen aus der FOB
  rifle.ammo = 0;
  assert.equal(g.issue(0, { type: 'attack', ids: [rifle.id], targetId: enemy.id }).ok, true);
  run(g, 3);
  assert.equal(enemy.hp, enemy.maxHp, 'kein Schaden ohne Munition');
  assert.equal(rifle.weapons[0].cd, 0);
  assert.equal(rifle.ammo, 0);
  assert.ok(g.drainEvents().some((e) => e.text === 'Einheiten ohne Munition'), 'Mangelmeldung');
});

test('Verbrauch: fahrender Panzer verbraucht Treibstoff aus seinem Vorrat, stehender nicht', () => {
  const still = mk({ seed: 7 });
  const c = still.zone;
  const t0 = still.spawnUnit('tank', 0, c.x, c.y - 90);
  run(still, 3);
  assert.equal(t0.fuel, UNITS.tank.fuelMax, 'stehend kein Verbrauch');

  const g = mk({ seed: 7 });
  const tank = g.spawnUnit('tank', 0, c.x, c.y - 90);
  assert.equal(g.issue(0, { type: 'move', ids: [tank.id], x: c.x + 600, y: c.y - 90 }).ok, true);
  let moved = 0;
  for (let i = 0; i < 40; i++) {
    const x0 = tank.x;
    const y0 = tank.y;
    g.update(DT);
    if (tank.x !== x0 || tank.y !== y0) moved++;
  }
  assert.ok(moved > 0, 'Panzer ist gefahren');
  const used = UNITS.tank.fuelMax - tank.fuel;
  const base = UNITS.tank.fuelPerSec * DT * moved; // abseits der Straße × roads.offroadFuel
  assert.ok(used >= base - 1e-6 && used <= base * BALANCE.roads.offroadFuel + 1e-6, `Verbrauch ${used}`);
  assert.ok(Math.abs(g.teams[0].used.fuel - used) < 1e-9);
});

test('Verbrauch: ohne Treibstoff fährt ein Panzer mit 25 % Tempo, Vorrat wird nie negativ', () => {
  const travel = (fuel) => {
    const g = mk({ seed: 7 });
    const c = g.zone;
    const tank = g.spawnUnit('tank', 0, c.x, c.y - 90);
    tank.fuel = fuel;
    assert.equal(g.issue(0, { type: 'move', ids: [tank.id], x: c.x + 800, y: c.y - 90 }).ok, true);
    let d = 0;
    for (let i = 0; i < 40; i++) {
      const x0 = tank.x;
      const y0 = tank.y;
      g.update(DT);
      d += dist(x0, y0, tank.x, tank.y);
    }
    return { d, fuel: tank.fuel };
  };
  const full = travel(UNITS.tank.fuelMax);
  const empty = travel(0);
  assert.ok(full.d > 60, 'Referenzstrecke');
  assert.ok(Math.abs(empty.d / full.d - BALANCE.fuelSlowMul) < 0.02, `Tempoverhältnis ${empty.d / full.d}`);
  assert.equal(empty.fuel, 0);
  const short = travel(0.01);
  assert.equal(short.fuel, 0);
});

test('Verbrauch: FOB-MG feuert ohne Munition im Lager', () => {
  const g = mkOld({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  g.setStock(0, { bm: 0, mun: 0, fuel: 0 });
  const enemy = g.spawnUnit('rifleman', 1, f.x + 150, f.y);
  run(g, 3);
  assert.ok(enemy.hp < enemy.maxHp, 'FOB-MG trifft ohne Munition');
  assert.equal(g.teams[0].res.mun, 0);
  assert.equal(g.teams[0].used.mun, 0, 'FOB-MG verbraucht nichts');
});

test('Soldaten und Fahrzeuge tanken Munition und Treibstoff in der FOB nach', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g);
  const r = g.spawnUnit('rifleman', 0, f.x + 100, f.y);
  const t = g.spawnUnit('tank', 0, f.x + 120, f.y + 40);
  r.ammo = 0;
  t.fuel = 0;
  run(g, 20);
  assert.equal(r.ammo, r.def.ammoMax);
  assert.equal(t.fuel, t.def.fuelMax);
  g.setStock(0, { bm: 0, mun: 0, fuel: 0 });
  r.ammo = 0;
  run(g, 5);
  assert.equal(r.ammo, 0, 'ohne Lagerbestand keine Munition');
});

test('Bohrer: 30 s Aufwärmen, 2 min aktiv mit Treibstoff aus der FOB, 5 min Pause; Hot Zone zieht zum Bohrer', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g);
  const d = g.spawnBuilding('drill', 0, cellOf(f.x + 200), cellOf(f.y - 200));
  g.update(DT);
  assert.equal(g.issue(0, { type: 'drill', ids: [d.id] }).ok, false, 'noch im Aufwärmen');
  run(g, 31);
  assert.equal(d.drill.state, 'ready');
  const fuel0 = f.store.fuel;
  assert.equal(g.issue(0, { type: 'drill', ids: [d.id] }).ok, true);
  assert.equal(d.drill.state, 'active');
  const dist0 = Math.hypot(g.hot.x - d.x, g.hot.y - d.y);
  run(g, 60);
  assert.ok(f.store.fuel < fuel0 - 50, 'Treibstoff verbraucht');
  assert.equal(g.hot.drillTarget, true);
  const target = { x: g.hot.tx, y: g.hot.ty };
  assert.ok(Math.hypot(target.x - g.zone.x, target.y - g.zone.y) <= g.zone.r - g.hot.r + 1, 'Ziel in der Zone');
  assert.ok(Math.hypot(g.hot.x - d.x, g.hot.y - d.y) < dist0, 'nähert sich dem Bohrer');
  run(g, 65);
  assert.equal(d.drill.state, 'cooldown');
  run(g, 290);
  assert.equal(d.drill.state, 'cooldown');
  run(g, 15);
  assert.equal(d.drill.state, 'ready');
});

test('Bohrer ohne Treibstoff in der FOB startet nicht', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g);
  const d = g.spawnBuilding('drill', 0, cellOf(f.x + 200), cellOf(f.y - 200));
  g.setStock(0, { bm: 100, mun: 0, fuel: 0 });
  run(g, 31);
  assert.equal(g.issue(0, { type: 'drill', ids: [d.id] }).ok, false);
});
