// Fliegerhorst: zwei Jets je Stellplatz, F-22 und Su-27.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { UNITS } from '../js/data/units.js';
import { standsOf, freeSpace } from '../js/game/aircraft.js';
import { AI } from '../js/ai/ai.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { pack, unpack } from '../js/core/snapshot.js';
import { DT, run, airbase } from './airbasehelp.js';

/** Zwei F-16 an Stellplatz s ausbilden und warten, bis beide stehen (Tank und Lager voll). */
function twoParked(g, s, c, ktank, mdepot) {
  ktank.stock = CITY.air.tank.cap[c.level[ktank.cityCell]];
  mdepot.stock = CITY.air.depot.cap[c.level[mdepot.cityCell]];
  g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' });
  g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' });
  for (let k = 0; k < 600 && !(g.units.filter((x) => x.def.jet && x.parked).length === 2 && g.units.filter((x) => x.def.jet).every((x) => x.jet.ready)); k++) run(g, 1);
  return g.units.filter((x) => x.def.jet && x.alive);
}

test('Zwei F-16 je Stellplatz: beide stehen auf verschiedenen Plätzen (nebeneinander, Nase nach Norden)', () => {
  const g = new Game({ seed: 3 });
  const { c, stands, ktank, mdepot } = airbase(g);
  const [s] = stands;
  assert.equal(freeSpace(g, s), CITY.air.standJets);
  const jets = twoParked(g, s, c, ktank, mdepot);
  assert.equal(jets.length, 2);
  assert.deepEqual(jets.map((u) => u.jet.slot).sort(), [0, 1], 'Plätze 0 und 1');
  const xs = jets.map((u) => u.x).sort((a, b) => a - b);
  assert.deepEqual(xs, [s.x - CITY.air.standSlot * c.cell, s.x + CITY.air.standSlot * c.cell]);
  assert.ok(jets.every((u) => u.y === s.y && u.angle === -Math.PI / 2), 'Nase nach Norden');
  assert.equal(freeSpace(g, s), 0);
});

test('Zwei F-16 je Stellplatz: Start und Landung beider, Platz wird beim Einrollen neu vergeben', () => {
  const g = new Game({ seed: 3 });
  const { c, stands, ktank, mdepot, rw } = airbase(g);
  const [s] = stands;
  const jets = twoParked(g, s, c, ktank, mdepot);
  assert.ok(jets.every((u) => u.jet.ready), 'beide startbereit');
  const z = g.zone;
  g.fog[0].revealAll?.();
  assert.ok(g.issue(0, { type: 'attackMove', ids: jets.map((u) => u.id), x: z.x, y: z.y }).ok);
  for (let t = 0; t < 60 && !jets.every((u) => u.jet.phase === 'air'); t += DT) g.update(DT);
  assert.ok(jets.every((u) => u.jet.phase === 'air'), 'beide in der Luft');
  assert.ok(jets.every((u) => u.jet.slot === undefined), 'Plätze frei, solange sie fliegen');
  run(g, 3);
  assert.ok(g.issue(0, { type: 'land', ids: jets.map((u) => u.id), airportId: s.id }).ok, 'Landebefehl für beide');
  for (let t = 0; t < 300 && !jets.every((u) => u.parked); t += DT) g.update(DT);
  assert.ok(jets.every((u) => u.parked), 'beide gelandet');
  assert.deepEqual(jets.map((u) => u.jet.slot).sort(), [0, 1], 'wieder auf verschiedenen Plätzen');
  assert.ok(jets.every((u) => u.jet.home === s.id && Math.abs(Math.abs(u.x - s.x) - CITY.air.standSlot * c.cell) < 1e-6), 'am Stellplatz');
  assert.equal(rw.valid, true);
});

test('Zwei F-16 je Stellplatz überstehen Speichern und Laden (Plätze und Standort bleiben)', async () => {
  const g = new Game({ seed: 3 });
  const { c, stands, ktank, mdepot } = airbase(g);
  const [s] = stands;
  const jets = twoParked(g, s, c, ktank, mdepot);
  const before = jets.map((u) => [u.jet.slot, u.x, u.y]);
  const snap = snapshotGame(g, new AI(g, 1, 'normal'));
  const { game: g2 } = restoreGame(await unpack(await pack(snap)));
  const s2 = standsOf(g2, 0)[0];
  const jets2 = g2.units.filter((u) => u.def.jet && u.alive);
  assert.deepEqual(jets2.map((u) => [u.jet.slot, u.x, u.y]).sort(), before.sort());
  assert.equal(freeSpace(g2, s2), 0);
});

test('Stand ohne Platznummer (alter Spielstand): der Jet bekommt beim Abstellen einen Platz', () => {
  const g = new Game({ seed: 3 });
  const { c, stands } = airbase(g);
  const [s] = stands;
  const u = g.spawnUnit('f16', 0, s.x, s.y);
  u.parked = true;
  u.jet = { home: s.id, ready: false, phase: 'park', alt: 0 };
  run(g, DT);
  assert.equal(u.jet.slot, 0, 'erster freier Platz');
  assert.equal(u.x, s.x - CITY.air.standSlot * c.cell);
  assert.equal(u.y, s.y);
});

test('F-22: Stellplatz bildet sie aus; eine Waffe mit sechs Luft-Luft-Raketen, sonst keine; greift nur Luftziele an', () => {
  // Waffenprofil (seit v5.82): genau eine Luft-Luft-Lenkrakete, keine Luft-Boden-Raketen
  assert.equal(UNITS.f22.weapons.length, 1);
  const [aim] = UNITS.f22.weapons;
  assert.deepEqual([aim.id, aim.rounds], ['aim', 6]);
  assert.deepEqual(aim.targets, ['air'], 'nur Luftziele');
  assert.ok(!aim.damage.heavy && !aim.damage.light && !aim.damage.struct && !aim.damage.inf, 'kein Schaden an Boden und Gebäuden');
  assert.equal(UNITS.f22.jet, true);
  const g = new Game({ seed: 3 });
  const { stands } = airbase(g);
  const [s] = stands;
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f22' }).ok, 'F-22 ausbildbar am Stellplatz');
  for (let k = 0; k < 600 && !g.units.some((x) => x.def === UNITS.f22); k++) run(g, 1); // Stahl und Weg zum Lager wie bei der F-16
  const [u] = g.units.filter((x) => x.def === UNITS.f22);
  assert.ok(u, 'F-22 gebaut');
  assert.ok(u.parked && u.jet.home === s.id, 'steht auf dem Stellplatz');
  assert.equal(u.weapons.length, 1);
  // Gegen einen Panzer feuert sie nicht, gegen einen Hubschrauber schon
  const z = g.zone;
  const tank = g.spawnUnit('tank', 1, z.x + 120, z.y);
  const heli = g.spawnUnit('gunship', 1, z.x + 200, z.y);
  tank.hp = heli.hp = 1e6;
  u.jet = { ...u.jet, ready: true, phase: 'air', alt: 1 };
  u.parked = false;
  u.x = z.x - 300;
  u.y = z.y;
  g.fog[0].revealAll?.();
  assert.ok(g.issue(0, { type: 'attackMove', ids: [u.id], x: z.x, y: z.y }).ok);
  for (let t = 0; t < 30 && u.weapons[0].rounds > 0; t++) {
    run(g, 1);
    g.fog[0].revealAll?.();
  }
  assert.ok(u.weapons[0].rounds < 6, 'Lenkraketen gegen den Hubschrauber verschossen');
  assert.equal(tank.hp, 1e6, 'Panzer am Boden nicht angegriffen');
});

test('F-16 und F-22 teilen sich die Plätze eines Stellplatzes: zusammen höchstens CITY.air.standJets', () => {
  const g = new Game({ seed: 3 });
  const { stands } = airbase(g);
  const [s] = stands;
  assert.equal(CITY.air.standJets, 2, 'Annahme dieses Tests: zwei Plätze je Stellplatz');
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok, 'erste F-16');
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f22' }).ok, 'F-22 teilt sich den Stellplatz');
  const r = g.issue(0, { type: 'train', buildingId: s.id, unit: 'f22' });
  assert.equal(r.ok, false, 'dritter Jet auf dem Stellplatz abgelehnt');
  assert.match(r.reason, /Stellplatz belegt/);
  const r2 = g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' });
  assert.equal(r2.ok, false, 'auch eine F-16 passt nicht mehr dazu');
  assert.equal(freeSpace(g, s), 0);
});

test('Su-27: Werte wie die F-16 (gleiche Waffen, parallel), aber schneller und mit größerer Reichweite; Taste frei', () => {
  const su = UNITS.su27;
  const f16 = UNITS.f16;
  assert.ok(su.speed > f16.speed, `schneller: ${su.speed} gegen ${f16.speed}`);
  assert.ok(su.fuelMax > f16.fuelMax, 'mehr Treibstoff');
  assert.ok(su.speed * su.fuelMax > f16.speed * f16.fuelMax, 'größere Reichweite (speed × fuelMax)');
  assert.deepEqual([su.hp, su.radius, su.sight, su.cost.money, su.buildTime], [480, 15, 560, 2800, 45]);
  assert.equal(su.jet, true);
  assert.equal(su.parallel, true, 'zwei Waffen feuern unabhängig, wie die F-16');
  assert.deepEqual(su.weapons, f16.weapons, 'gleiche Waffen, Schäden und Munition wie die F-16');
  assert.ok(!['K', 'I', 'O', 'U', 'W', 'Y'].includes(su.hotkey), `Taste ${su.hotkey} im Stellplatz-Menü frei`);
  assert.ok(CITY.produces.stand.includes('su27'), 'am Stellplatz ausbildbar');
  assert.equal(CITY.crew.su27, 2, 'zwei Einwohner wie die F-16');
  assert.ok(CITY.metalCost.su27 >= CITY.metalCost.f16 && CITY.metalCost.su27 <= CITY.metalCost.f16 * 1.1, 'Stahl knapp über der F-16 (seit Paket Balance-Preise 330 gegen 320)');
});

test('Su-27 am Stellplatz: ausbildbar, steht auf dem Platz, hebt ab und fliegt los', () => {
  const g = new Game({ seed: 3 });
  const { stands } = airbase(g);
  const [s] = stands;
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'su27' }).ok, 'Su-27 ausbildbar');
  for (let k = 0; k < 600 && !g.units.some((x) => x.def === UNITS.su27); k++) run(g, 1); // Stahl und Weg zum Lager wie bei der F-22
  const [u] = g.units.filter((x) => x.def === UNITS.su27);
  assert.ok(u, 'Su-27 gebaut');
  assert.ok(u.parked && u.jet.home === s.id, 'steht auf dem Stellplatz');
  assert.equal(u.weapons.length, 2, 'zwei Waffen');
  const z = g.zone;
  const [x0, y0] = [u.x, u.y];
  g.fog[0].revealAll?.();
  assert.ok(g.issue(0, { type: 'attackMove', ids: [u.id], x: z.x, y: z.y }).ok, 'Startbefehl');
  for (let t = 0; t < 60 && u.jet.phase !== 'air'; t += DT) run(g, DT);
  assert.equal(u.jet.phase, 'air', 'hebt ab');
  assert.ok(u.x !== x0 || u.y !== y0, 'fliegt los');
});

test('Su-27 und F-16 teilen sich die zwei Plätze eines Stellplatzes', () => {
  const g = new Game({ seed: 3 });
  const { stands } = airbase(g);
  const [s] = stands;
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'su27' }).ok, 'erste Su-27');
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok, 'F-16 teilt sich den Stellplatz');
  const r = g.issue(0, { type: 'train', buildingId: s.id, unit: 'su27' });
  assert.equal(r.ok, false, 'dritter Jet abgelehnt');
  assert.match(r.reason, /Stellplatz belegt/);
});
