// Spiel-Tests: Mörser, Flugabwehr und Hubschrauber.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base, DT, mk, mkOld, run, cellOf, dist, unitsOf } from './gamehelp.js';

/** Mörser (Team 0) 400 px vor der Hauptstadt (x 600), Feind-Schütze daneben (x 1000); Lage relativ zum Startpunkt (seit v5.14 Karte 11072 px). */
function mortarScene(withAA) {
  const g = mk({ seed: 7 });
  const y0 = g.map.spawns[0].y; // bis v5.11: 8324
  for (const u of unitsOf(g, 0)) u.alive = false; // Startaufstellung räumen
  g.spawnBuilding('mortar', 0, cellOf(600) - 1, cellOf(y0 - 400) - 1);
  g.spawnBuilding('mortar', 0, cellOf(1000) - 1, cellOf(y0 - 250) - 1);
  const enemy = g.spawnUnit('rifleman', 1, 1000, y0 - 400);
  if (withAA) {
    g.spawnBuilding('aa', 1, cellOf(800) - 1, cellOf(y0 - 250) - 1);
    // Versorger der Flugabwehr: eigene FOB in Reichweite mit Munition
    const f1 = g.spawnBuilding('fob', 1, cellOf(800) - 5, cellOf(y0 - 250) - 1);
    f1.store.mun = 200;
  }
  return { g, enemy };
}

test('Mörser: erzeugt eine Granate, die einschlägt', () => {
  const { g, enemy } = mortarScene(false);
  let sawShell = false;
  let sawExplosion = false;
  for (let i = 0; i < Math.round(15 / DT); i++) {
    g.update(DT);
    if (g.projectiles.length > 0) sawShell = true;
    if (g.effects.some((e) => e.type === 'explosion' && dist(e.x, e.y, enemy.x, enemy.y) < 80)) sawExplosion = true;
  }
  assert.equal(sawShell, true, 'Granate entsteht');
  assert.equal(sawExplosion, true, 'Einschlag');
  assert.ok(!enemy.alive || enemy.hp < 100, 'Schaden am Ziel');
});

test('Mörser zahlt Munition aus dem Lager seines Versorgers', () => {
  const { g } = mortarScene(false);
  const f = g.buildings.find((b) => b.team === 0 && b.type === 'fob' && b.built);
  const mun0 = f.store.mun;
  run(g, 15);
  assert.ok(f.store.mun < mun0, 'Lager der FOB leer geschossen');
  assert.ok(g.teams[0].used.mun > 0);
});

test('Flugabwehr fängt Mörsergranaten ab', () => {
  const { g, enemy } = mortarScene(true);
  // Alle 20 s ein Schuss auf das gewählte Ziel: in 90 s mehrere Granaten, die die Flugabwehr abfangen kann
  const mortar = g.buildings.find((b) => b.type === 'mortar');
  assert.equal(g.issue(0, { type: 'mortarTarget', ids: [mortar.id], x: enemy.x, y: enemy.y }).ok, true);
  let sawShell = false;
  let sawIntercept = false;
  for (let i = 0; i < Math.round(90 / DT); i++) {
    g.update(DT);
    if (g.projectiles.length > 0) sawShell = true;
    if (g.effects.some((e) => e.type === 'intercept')) sawIntercept = true;
  }
  assert.equal(sawShell, true, 'Granate entsteht');
  assert.equal(sawIntercept, true, 'Abfang');
});

// ---- Mörser-Ziel, Hubschrauber, Hot Zone und Bohrer ----
test('Mörser: gewähltes Ziel, ein Schuss alle 20 s, nur in Reichweite', () => {
  const g = mk({ seed: 7 });
  const f = base(g);
  const m = g.spawnBuilding('mortar', 0, cellOf(f.x + 200), cellOf(f.y - 200));
  assert.equal(g.issue(0, { type: 'mortarTarget', ids: [m.id], x: m.x + 5000, y: m.y }).ok, false, 'außer Reichweite');
  assert.equal(g.issue(0, { type: 'mortarTarget', ids: [m.id], x: m.x + 20, y: m.y }).ok, false, 'zu nah');
  assert.equal(g.issue(0, { type: 'mortarTarget', ids: [m.id], x: m.x + 500, y: m.y }).ok, true);
  let shells = 0;
  let prev = 0;
  for (let i = 0; i < Math.round(45 / DT); i++) {
    g.update(DT);
    if (g.projectiles.length > prev) shells++;
    prev = g.projectiles.length;
  }
  assert.ok(shells >= 2 && shells <= 3, `Schüsse in 45 s: ${shells}`);
  g.issue(0, { type: 'mortarTarget', ids: [m.id] });
  assert.equal(m.fireTarget, null);
});

test('Mörser ohne Munition in der FOB feuert nicht auf das gewählte Ziel', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g);
  const m = g.spawnBuilding('mortar', 0, cellOf(f.x + 200), cellOf(f.y - 200));
  g.issue(0, { type: 'mortarTarget', ids: [m.id], x: m.x + 500, y: m.y });
  g.setStock(0, { bm: 100, mun: 0, fuel: 0 });
  run(g, 25);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.teams[0].used.mun, 0);
});

test('Flugabwehr schießt einen feindlichen Hubschrauber ab, wenn die FOB Munition hat', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g, 1);
  const aa = g.spawnBuilding('aa', 1, cellOf(f.x + 150), cellOf(f.y - 150));
  const heli = g.spawnUnit('gunship', 0, aa.x + 250, aa.y);
  heli.order = { type: 'idle', x: heli.x, y: heli.y, targetId: null };
  const mun0 = g.stockOf(1, 'mun');
  run(g, 30);
  assert.equal(heli.alive, false, 'abgeschossen');
  assert.ok(g.stockOf(1, 'mun') < mun0, 'Munition aus der FOB verbraucht');
});

test('Flugabwehr ohne Munition kann den Hubschrauber nicht abschießen', () => {
  const g = mkOld({ seed: 7 });
  const f = base(g, 1);
  const aa = g.spawnBuilding('aa', 1, cellOf(f.x + 150), cellOf(f.y - 150));
  g.setStock(1, { bm: 100, mun: 0, fuel: 0 });
  const heli = g.spawnUnit('littlebird', 0, aa.x + 250, aa.y);
  run(g, 15);
  assert.equal(heli.alive, true);
});

test('Hubschrauber fliegen über Hindernisse; Mörsergranaten treffen sie nicht', () => {
  const g = mk({ seed: 7 });
  const h = g.spawnUnit("littlebird", 0, 700, 10372); // an der Hauptstadt (seit v5.14 Karte 11072 px)
  g.issue(0, { type: 'move', ids: [h.id], x: g.zone.x, y: g.zone.y });
  run(g, 5);
  assert.ok(Math.hypot(h.x - 700, h.y - 10372) > 500, 'fliegt los');
  const m = g.spawnBuilding('mortar', 1, cellOf(h.x + 300), cellOf(h.y));
  g.projectiles.push({ id: 9999, team: 1, sx: h.x, sy: h.y, tx: h.x, ty: h.y, x: h.x, y: h.y, t: 0, duration: 0, damage: m.def.weapon.damage, splash: 200, alive: true });
  g.update(DT);
  assert.equal(h.hp, h.maxHp);
});

test('Little Bird: Infanterie steigt ein (max. 5) und wird abgesetzt', () => {
  const g = mk({ seed: 7 });
  const f = base(g);
  const heli = g.spawnUnit('littlebird', 0, f.x + 150, f.y - 150);
  const men = [];
  for (let i = 0; i < 6; i++) men.push(g.spawnUnit('rifleman', 0, heli.x + 20 + i * 3, heli.y));
  assert.equal(g.issue(0, { type: 'board', ids: men.map((m) => m.id), heliId: heli.id }).ok, true);
  run(g, 10);
  assert.equal(heli.passengers.length, 5, 'fünf Sitze');
  assert.equal(men.filter((m) => m.alive).length, 1, 'der sechste bleibt draußen');
  assert.equal(g.units.filter((u) => u.type === 'rifleman' && u.team === 0).length >= 1, true);
  const tx = heli.x + 400;
  assert.equal(g.issue(0, { type: 'dropoff', ids: [heli.id], x: tx, y: heli.y }).ok, true);
  run(g, 10);
  assert.equal(heli.passengers.length, 0);
  assert.equal(men.filter((m) => m.alive).length, 6);
  assert.ok(men.every((m) => g.getEntity(m.id)), 'wieder in der Welt');
});

test('Transporthubschrauber lädt Ressourcen wie ein LKW', () => {
  const g = mk({ seed: 7 });
  const f = base(g);
  const heli = g.spawnUnit('transporter', 0, f.x + 80, f.y);
  assert.equal(g.issue(0, { type: 'load', ids: [heli.id], fobId: f.id }).ok, true);
  run(g, 10);
  const c = heli.cargo;
  assert.ok(c.bm + c.mun + c.fuel > 300, `Ladung ${c.bm + c.mun + c.fuel}`);
});
