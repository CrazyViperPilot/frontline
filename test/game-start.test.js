// Spiel-Tests: Startzustand, Ressourcen, Ausbildung, Hauptstadt und Erstattung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITY } from '../js/data/city.js';
import { trainer, noCrew } from './util.js';
import { BALANCE } from '../js/data/balance.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { mk, run, cellOf, fobOf, unitsOf, findSpot, fobAt } from './gamehelp.js';

test('Startzustand: fertige Hauptstadt mit Startlager der Stadt, Startunits, Geld', () => {
  const g = mk({ seed: 7 });
  for (let t = 0; t < 2; t++) {
    const f = fobOf(g, t);
    assert.ok(f, `FOB für Team ${t}`);
    assert.equal(f.built, true);
    assert.equal(f.hp, f.maxHp);
    assert.equal(unitsOf(g, t).length, BALANCE.startUnits.length);
    assert.equal(unitsOf(g, t, 'truck').length, 3);
    assert.equal(unitsOf(g, t, 'engineer').length, 1);
    assert.equal(unitsOf(g, t, 'rifleman').length, 22);
    assert.equal(unitsOf(g, t, 'at').length, 7);
    assert.deepEqual({ ...f.store }, CITY.startStock);
    assert.equal(g.teams[t].res.money, BALANCE.startRes.money);
    assert.equal(g.teams[t].res.bm, 0, 'Summe der vorderen FOB-Lager (ohne Hauptstadt)');
  }
  assert.equal(g.winner, null);
  assert.equal(g.zone.owner, -1);
});

test('Team-Ressourcen sind Lesegetter: direktes Schreiben ist nicht möglich', () => {
  const g = mk({ seed: 7 });
  assert.throws(() => {
    'use strict';
    g.teams[0].res.bm = 5;
  }, TypeError);
  fobAt(g, 0, fobOf(g, 0).x, fobOf(g, 0).y); // vordere FOB: setStock schreibt in die vorderen Lager
  g.setStock(0, { bm: 123, mun: 45, fuel: 6 });
  assert.equal(g.teams[0].res.bm, 123);
  assert.equal(g.teams[0].res.mun, 45);
  assert.equal(g.teams[0].res.fuel, 6);
  assert.equal(g.teams[1].res.bm, 0, 'Team 1 unberührt');
});

test('Training in der Kaserne: Preis vom Geld, Zahler die Kaserne, Einheit spawnt', () => noCrew(() => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const k = trainer(g, 'rifleman');
  const before = unitsOf(g, 0, 'rifleman').length;
  const { money } = g.teams[0].res;
  const mun = f.store.mun;
  const r = g.issue(0, { type: 'train', buildingId: k.id, unit: 'rifleman' });
  assert.equal(r.ok, true);
  assert.equal(g.teams[0].res.money, money - 60);
  assert.equal(f.store.mun, mun, 'Einheiten kosten nur Geld');
  assert.equal(k.queue.length, 1);
  assert.equal(k.queue[0].unit, 'rifleman');
  assert.equal(k.queue[0].payerId, k.id, 'Zahler ist die Kaserne');

  run(g, 8.5);
  assert.equal(unitsOf(g, 0, 'rifleman').length, before + 1);
  assert.equal(k.queue.length, 0);
}));

test('Training: Einheiten kosten nur Geld und starten voll munitioniert und betankt', () => noCrew(() => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  assert.equal(g.issue(0, { type: 'train', buildingId: trainer(g, 'rifleman').id, unit: 'rifleman' }).ok, true);
  run(g, 9);
  const r = unitsOf(g, 0, 'rifleman').at(-1);
  assert.equal(r.ammo, r.def.ammoMax);
  assert.equal(r.weapons[0].rounds, 60, 'zwei Magazine à 30');
  const t = g.spawnUnit('tank', 0, f.x, f.y + 80);
  assert.deepEqual(t.weapons.map((w) => w.rounds), [30, 300]);
  assert.equal(t.fuel, t.def.fuelMax);
}));

test('Die Hauptstadt kann nicht abgerissen werden; Hauptstadt und vordere FOB bilden nichts aus (das tut die Stadt)', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  assert.equal(g.issue(0, { type: 'demolish', buildingId: f.id }).ok, false);
  const front = fobAt(g, 0, f.x, f.y);
  assert.deepEqual(front.produces, [], 'vordere FOB bildet nichts aus');
  assert.deepEqual(f.produces, [], 'Hauptstadt bildet nichts aus');
  for (const b of [f, front]) assert.equal(g.issue(0, { type: 'train', buildingId: b.id, unit: 'rifleman' }).ok, false);
});

test('Erstattung an den Zahler: Ausbildung abbrechen erstattet das Geld, Lager bleiben unberührt', () => noCrew(() => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const k = trainer(g, 'rifleman');
  const far = fobAt(g, 0, f.x, f.y, 950, 1300);
  far.store.mun = 0;
  const mun = f.store.mun;
  const money0 = g.teams[0].res.money;
  const r = g.issue(0, { type: 'train', buildingId: k.id, unit: 'rifleman' });
  assert.equal(r.ok, true);
  assert.equal(g.issue(0, { type: 'cancelTrain', buildingId: k.id }).ok, true);
  assert.equal(f.store.mun, mun, 'Lager unverändert');
  assert.equal(far.store.mun, 0, 'andere FOB unberührt');
  assert.equal(g.teams[0].res.money, money0, 'Geld zurück');
}));

test('Abriss einer FOB: Lager geht an die nächste andere FOB, kein Material wird erstattet', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const far = fobAt(g, 0, f.x, f.y, 950, 1300);
  far.store.bm = 100;
  f.store.bm = 250;
  const eng = unitsOf(g, 0, 'engineer')[0];
  // Baustelle einer FOB abreißen: nichts bezahlt, nichts erstattet
  const site = g.spawnBuilding('fob', 0, cellOf(f.x) - 8, cellOf(f.y), { built: false });
  site.store.bm = 40;
  assert.equal(g.issue(0, { type: 'demolish', buildingId: site.id }).ok, true);
  assert.equal(f.store.bm, 250 + 40, 'nächste FOB (die Hauptstadt) nimmt das Baustellenlager');
  assert.equal(far.store.bm, 100, 'fernere FOB unberührt');
  assert.equal(g.issue(0, { type: 'demolish', buildingId: far.id }).ok, true);
  assert.equal(f.store.bm, 250 + 40 + 100, 'Lager der abgerissenen FOB geht an die andere; kein Materialgeschenk');
  assert.equal(eng.alive, true);
});

test('Erstattung: Abriss fertiger Gebäude 25 % Baumaterial, Baustelle voll, an den Zahler', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const spot = findSpot(g, 0, 'mortar', f.x, f.y);
  const eng = unitsOf(g, 0, 'engineer')[0];
  const r = g.issue(0, { type: 'build', ids: [eng.id], building: 'mortar', x: spot.x, y: spot.y });
  const b = g.getEntity(r.id);
  const bm0 = f.store.bm;
  assert.equal(g.issue(0, { type: 'demolish', buildingId: b.id }).ok, true);
  assert.equal(f.store.bm, bm0 + BUILDINGS.mortar.cost.bm, 'Baustelle: volle Erstattung');

  const r2 = g.issue(0, { type: 'build', ids: [eng.id], building: 'mortar', x: spot.x, y: spot.y });
  assert.equal(r2.ok, true, r2.reason);
  const b2 = g.getEntity(r2.id);
  run(g, 60);
  assert.equal(b2.built, true);
  const bm1 = f.store.bm;
  g.issue(0, { type: 'demolish', buildingId: b2.id });
  assert.equal(f.store.bm, bm1 + BUILDINGS.mortar.cost.bm * BALANCE.demolishRefund);
});
