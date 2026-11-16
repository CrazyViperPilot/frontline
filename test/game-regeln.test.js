// Spiel-Tests: Kampf, Zone, Sieg, Eliminierung, Determinismus, Hot Zone, Abschussprämie und Befehle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { classic } from './classic.js';
import { BALANCE } from '../js/data/balance.js';
import { UNITS } from '../js/data/units.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { DT, mk, mkOld, run, fobOf, findSpot, fobAt } from './gamehelp.js';

test('Kampf: Kampfpanzer tötet einen Schützen', () => {
  const g = mk({ seed: 7 });
  const sp = g.map.spawns[0];
  const tank = g.spawnUnit('tank', 0, sp.x + 300, sp.y - 300);
  const rifle = g.spawnUnit('rifleman', 1, sp.x + 500, sp.y - 300);
  const r = g.issue(0, { type: 'attack', ids: [tank.id], targetId: rifle.id });
  assert.equal(r.ok, true);
  run(g, 30);
  assert.equal(rifle.alive, false);
  assert.equal(g.entities.has(rifle.id), false);
});

test('Zone: nur Team 0 in der Zone bringt nach 30,1 s einen Punkt und Geld', () => {
  const g = mkOld({ seed: 7 });
  const z = g.zone;
  g.spawnUnit('rifleman', 0, z.x + 1000, z.y); // außerhalb der Hot Zone
  const money0 = g.teams[0].res.money;
  run(g, 30.1);
  assert.equal(g.zone.owner, 0);
  assert.equal(g.zone.contested, false);
  assert.equal(g.teams[0].points, 1);
  // genau das Zonengeld der einen Einheit (0,4/s), ohne Führungsgeld
  assert.ok(Math.abs(g.teams[0].res.money - money0 - BALANCE.zone.unitIncome * 30.1) < 0.5);
  assert.ok(g.drainEvents().some((e) => e.text === 'Punkt für Blau'));
});

test('Zone: umkämpft bringt keinen Punkt', () => {
  const g = mk({ seed: 7 });
  const z = g.zone;
  // beide Seiten in der Zone, aber außerhalb der gegenseitigen Sichtweite
  g.spawnUnit('rifleman', 0, z.x - 600, z.y);
  g.spawnUnit('rifleman', 1, z.x + 600, z.y);
  run(g, 65);
  assert.equal(g.zone.contested, true);
  assert.equal(g.zone.owner, -1);
  assert.equal(g.teams[0].points, 0);
  assert.equal(g.teams[1].points, 0);
});

test('Sieg: Partie endet, sobald winPoints erreicht sind', () => {
  const g = mk({ seed: 7, winPoints: 1 });
  const z = g.zone;
  g.spawnUnit('rifleman', 0, z.x, z.y);
  run(g, 31);
  assert.equal(g.winner, 0);
  assert.equal(g.winReason, 'points');
  assert.equal(g.issue(0, { type: 'stop', ids: [] }).ok, false);
});

test('Eliminierung: Team ohne FOB und ohne Baufahrzeug verliert (LKW zählt nicht)', () => {
  const g = mk({ seed: 7 });
  for (const e of [...g.buildings, ...g.units]) {
    if (e.team === 1 && (e.type === 'fob' || e.type === 'engineer')) e.hp = 0;
  }
  g.update(DT);
  assert.equal(g.winner, 0);
  assert.equal(g.winReason, 'eliminated');
});

test('Eliminierung: fällt die Hauptstadt, verliert das Team; eine vordere FOB oder ein Baufahrzeug retten es nicht', () => {
  const g = mk({ seed: 7 });
  const main1 = fobOf(g, 1);
  const front = fobAt(g, 1, main1.x, main1.y);
  front.hp = 0;
  g.update(DT);
  assert.equal(g.winner, null, 'Verlust einer vorderen FOB ist keine Niederlage');

  const g2 = mk({ seed: 7 });
  const m = fobOf(g2, 1);
  fobAt(g2, 1, m.x, m.y);
  m.hp = 0; // Hauptstadt zerstört, Baufahrzeug und vordere FOB leben
  g2.update(DT);
  assert.equal(g2.winner, 0);
  assert.equal(g2.winReason, 'eliminated');
});

test('Determinismus: gleicher Seed, gleiche Partie', () => {
  const play = () => {
    const g = mk({ seed: 11 });
    const f = fobOf(g, 0);
    const sp = findSpot(g, 0, 'mortar', f.x, f.y);
    g.issue(0, { type: 'build', building: 'mortar', x: sp.x, y: sp.y });
    g.issue(0, { type: 'train', buildingId: f.id, unit: 'rifleman' });
    run(g, 40);
    return JSON.stringify([g.teams.map((t) => [t.res.money, t.res.bm, t.res.mun]), g.units.map((u) => [u.x, u.y, u.ammo])]);
  };
  assert.equal(play(), play());
});

test('Hot Zone wandert innerhalb der Konfliktzone; Einheiten darin bringen doppeltes Geld und Punkte', () => {
  const g = mkOld({ seed: 7 });
  const hz = g.hot;
  for (let i = 0; i < Math.round(120 / DT); i++) {
    g.update(DT);
    assert.ok(Math.hypot(hz.x - g.zone.x, hz.y - g.zone.y) <= g.zone.r - hz.r + 1, 'bleibt in der Zone');
  }
  assert.ok(Math.hypot(hz.x - g.zone.x, hz.y - g.zone.y) > 1, 'hat sich bewegt');
  const u = g.spawnUnit('rifleman', 0, hz.x, hz.y);
  u.order = { type: 'idle', x: u.x, y: u.y, targetId: null };
  const money0 = g.teams[0].res.money;
  const pts0 = g.teams[0].points;
  g.update(DT);
  assert.equal(g.hot.owner, 0);
  for (let i = 0; i < Math.round(50 / DT); i++) {
    hz.x = u.x;
    hz.y = u.y;
    g.update(DT);
  }
  // 50 s × 0,8 Geld/s (das Doppelte der Zone, nicht zusätzlich)
  assert.ok(Math.abs(g.teams[0].res.money - money0 - BALANCE.hot.unitIncome * 50) < 0.5, 'Geld');
  assert.ok(g.teams[0].points >= pts0 + 1, 'Punkt');
});

test('Zonenpunkt: Mehrheit statt Alleinbesitz, Hot Zone zählt doppelt, Balken füllt sich in 30 s', () => {
  const g = mk({ seed: 7 });
  const z = g.zone;
  g.hot.x = z.x + 2000; // Hot Zone weit weg: nur Zonenmehrheit zählt
  g.hot.y = z.y;
  g.hot.tx = g.hot.x;
  g.hot.ty = g.hot.y;
  g.hot.wanderT = 1e9;
  for (let i = 0; i < 3; i++) g.spawnUnit('rifleman', 0, z.x - 300 + i * 20, z.y);
  g.spawnUnit('rifleman', 1, z.x - 200, z.y + 100);
  run(g, 15);
  assert.equal(z.owner, 0, 'Blau führt 3:1');
  assert.ok(z.bar.team === 0 && z.bar.p > 0.4 && z.bar.p < 0.6, `Balken ${z.bar.p}`);
  run(g, 16);
  assert.equal(g.teams[0].points, 1);
  assert.equal(g.teams[1].points, 0);
  // Rot setzt zwei Einheiten in die Hot Zone
  g.hot.x = z.x + 400;
  g.hot.y = z.y + 400;
  g.hot.tx = g.hot.x;
  g.hot.ty = g.hot.y;
  for (let i = 0; i < 2; i++) g.spawnUnit('rifleman', 1, g.hot.x + i * 10, g.hot.y);
  g.update(DT);
  assert.equal(z.weight[1], z.counts[1] + 2, 'zwei Einheiten in der Hot Zone zählen doppelt');
  assert.equal(z.owner, z.weight[0] > z.weight[1] ? 0 : z.weight[1] > z.weight[0] ? 1 : -1);
});

test('Abschussprämie: Fahrzeuge viel, Soldaten wenig, Mauern nichts; fertiger Bau bringt Geld', async () => {
  const { hit } = await import('../js/game/combat.js');
  const g = classic(new Game({ seed: 7 }));
  const m0 = g.teams[0].res.money;
  const rifle = g.spawnUnit('rifleman', 1, 3000, 3000);
  hit(g, rifle, 9999);
  const afterRifle = g.teams[0].res.money;
  const tank = g.spawnUnit('tank', 1, 3100, 3000);
  hit(g, tank, 9999);
  const afterTank = g.teams[0].res.money;
  assert.equal(afterRifle - m0, Math.round(60 * BALANCE.bounty.inf));
  assert.equal(afterTank - afterRifle, Math.round(UNITS.tank.cost.money * BALANCE.bounty.vehicle));
  assert.ok(afterTank - afterRifle > 10 * (afterRifle - m0) / 2, 'Fahrzeug viel mehr als Soldat');
  assert.equal(g.teams[1].res.money, m0, 'der Verlierer bekommt nichts');
  hit(g, rifle, 5);
  assert.equal(g.teams[0].res.money, afterTank, 'Tote zählen nicht doppelt');
});

// Review-Paket P4 (Q-01, Q-11, E-03): der Befehl prüft die Mauerlänge selbst, Stopp ohne eigene Einheit scheitert,
// ein Gebäude ohne `produces` in js/data/buildings.js bildet nichts aus und bringt die KI nicht zum Absturz.
test('Befehle: Mauerzug über wallMax abgelehnt, Stopp ohne Einheit scheitert, Gebäude ohne produces', async () => {
  const { AI } = await import('../js/ai/ai.js');
  const { withValue } = await import('./util.js');
  const g = new Game({ seed: 7 });
  const m = g.mainFob(0);
  const max = BALANCE.construction.wallMax;
  const T = g.grid.tile;
  const long = g.issue(0, { type: 'buildWall', building: 'wall', x1: m.x, y1: m.y + 6 * T, x2: m.x + max * T, y2: m.y + 6 * T });
  assert.equal(long.ok, false);
  assert.match(long.reason, /zu lang/);
  // riesige Koordinaten: abgelehnt, bevor die Zellen aufgezählt werden (vorher lief der Speicher voll)
  const huge = g.issue(0, { type: 'buildWall', building: 'wall', x1: m.x, y1: m.y, x2: 1e12, y2: -1e12 });
  assert.equal(huge.ok, false);
  assert.match(huge.reason, /zu lang/);
  assert.equal(g.issue(0, { type: 'stop', ids: [] }).ok, false);
  const foe = g.units.find((u) => u.alive && u.team === 1);
  assert.equal(g.issue(0, { type: 'stop', ids: [foe.id] }).ok, false, 'fremde Einheit');
  const own = g.units.find((u) => u.alive && u.team === 0);
  assert.equal(g.issue(0, { type: 'stop', ids: [own.id] }).ok, true);
  withValue(BUILDINGS.drill, 'produces', undefined, () => {
    const m1 = g.mainFob(1);
    const b = g.spawnBuilding('drill', 1, m1.x + 6 * T, m1.y + 6 * T, { built: true });
    assert.deepEqual(b.produces, []);
    const ai = new AI(g, 1, 'normal');
    for (let i = 0; i < 100; i++) {
      ai.update(0.1);
      g.update(0.1);
    }
  });
});
