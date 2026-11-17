// Stadt-Ausbildung (PRD §15): Soldaten aus Einwohnern, Ausbildungsgebäude, Heilen, Krankenhaus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { BALANCE } from '../js/data/balance.js';
import { freePop } from '../js/game/city/query.js';
import { run, paint, at, clearStart, trainerFor } from './cityhelp.js';

test('Soldaten kosten Einwohner: ohne freie Einwohner keine Ausbildung, Gefallene fehlen der Stadt', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const m = g.mainFob(0);
  assert.equal(freePop(g, 0), 0, 'Startarmee kostet nichts, Stadt leer');
  const r = g.issue(0, { type: 'train', buildingId: trainerFor(g, 'rifleman').id, unit: 'rifleman' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Einwohner/);
  paint(g, 'road', 0, 0, 9, 0);
  paint(g, 'res', 0, 1, 9, 1);
  paint(g, 'bm', 0, 2, 4, 2);
  paint(g, 'road', 0, 3, 4, 3);
  run(g, 90);
  const pop = g.city[0].popF;
  assert.ok(freePop(g, 0) >= 1, `freie Einwohner ${freePop(g, 0)}`);
  assert.ok(g.issue(0, { type: 'train', buildingId: trainerFor(g, 'rifleman').id, unit: 'rifleman' }).ok);
  run(g, 10);
  const u = g.units.find((x) => x.team === 0 && x.crew === 1);
  assert.ok(u, 'ausgebildeter Schütze belegt einen Einwohner');
  assert.equal(g.city[0].drafted, 1);
  u.hp = -1e6;
  run(g, 0.2);
  assert.equal(g.city[0].drafted, 0);
  assert.ok(g.city[0].popF < Math.max(pop, g.city[0].stats.housing), 'Einwohner weg');
});

test('Ausbildung mit Stadt (v4.96): Hauptstadt nicht, Kaserne Soldaten, Fabrikhalle Fahrzeuge, Heliport Hubschrauber', () => {
  const g = new Game({ seed: 3, startMoney: 20000 });
  const m = g.mainFob(0);
  assert.deepEqual(m.produces, [], 'Hauptstadt bildet mit Stadt nichts aus');
  assert.match(g.issue(0, { type: 'train', buildingId: m.id, unit: 'rifleman' }).reason, /Kaserne/);
  const kas = trainerFor(g, 'rifleman');
  const fab = trainerFor(g, 'tank');
  assert.ok(kas && fab, 'Startviertel hat Kaserne und Fabrikhalle');
  assert.equal(trainerFor(g, 'littlebird'), undefined, 'Heliport muss man bauen');
  assert.match(g.issue(0, { type: 'train', buildingId: kas.id, unit: 'tank' }).reason, /Fabrikhalle/);
  // Wohnraum für Truppen, Heliport an der Straße
  paint(g, 'road', 0, 0, 9, 0);
  paint(g, 'res', 0, 1, 7, 1);
  paint(g, 'heliport', 8, 1, 8, 1);
  paint(g, 'com', 0, 2, 3, 2);
  paint(g, 'road', 0, 3, 3, 3);
  run(g, 120);
  const heli = trainerFor(g, 'littlebird');
  assert.ok(heli, 'Heliport steht');
  assert.ok(freePop(g, 0) >= 4, `freie Einwohner ${freePop(g, 0)}`);
  const n0 = g.units.filter((u) => u.team === 0).length;
  const metal0 = g.city[0].metal;
  assert.ok(g.issue(0, { type: 'train', buildingId: kas.id, unit: 'rifleman' }).ok);
  assert.ok(g.issue(0, { type: 'train', buildingId: fab.id, unit: 'truck' }).ok);
  assert.ok(g.issue(0, { type: 'train', buildingId: heli.id, unit: 'littlebird' }).ok);
  assert.equal(g.city[0].metal, metal0 - CITY.metalCost.truck - CITY.metalCost.littlebird, 'Metall direkt aus dem Stadtlager');
  assert.equal(g.slotsUsed(0) > 0 && g.unitCount(0), n0 + 3, 'Warteschlangen der Stadt zählen');
  run(g, 20);
  const fresh = g.units.filter((u) => u.team === 0 && u.crew);
  assert.deepEqual(fresh.map((u) => u.type).sort(), ['littlebird', 'rifleman', 'truck']);
  const near = (u, b) => Math.hypot(u.x - b.x, u.y - b.y) < 400;
  assert.ok(near(fresh.find((u) => u.type === 'rifleman'), kas), 'Schütze erscheint an der Kaserne');
});

test('Ausbildung an einem Stadtgebäude ohne Ausbildung (z. B. Wohnen): sauber abgelehnt statt TypeError', () => {
  const g = new Game({ seed: 3, startMoney: 20000 });
  const e = [...g.entities.values()].find((x) => x.type === 'city' && x.team === 0 && !x.produces);
  assert.ok(e, 'Startviertel hat ein Stadtgebäude ohne Ausbildung');
  const r = g.issue(0, { type: 'train', buildingId: e.id, unit: 'rifleman' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Kaserne/);
  assert.equal(g.issue(0, { type: 'train', buildingId: e.id, unit: 'gibtsnicht' }).ok, false);
});

test('Ausbildungsgebäude abreißen erstattet die Warteschlange, zerstört verfällt sie', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  const c = g.city[0];
  c.popF = 40; // Einwohner für die Ausbildung
  const fab = trainerFor(g, 'tank');
  const money0 = g.teams[0].res.money;
  const metal0 = c.metal;
  assert.ok(g.issue(0, { type: 'train', buildingId: fab.id, unit: 'tank' }).ok);
  assert.ok(g.teams[0].res.money < money0 && c.metal < metal0);
  const col = fab.cityCell % c.cols;
  const row = (fab.cityCell - col) / c.cols;
  assert.ok(g.issue(0, { type: 'city', kind: 'erase', c0: col, r0: row, c1: col, r1: row }).ok);
  assert.equal(g.teams[0].res.money, money0);
  assert.equal(c.metal, metal0);
  assert.equal(trainerFor(g, 'tank'), undefined);
  assert.equal(g.unitCount(0), g.units.filter((u) => u.team === 0).length, 'nichts mehr in Ausbildung');
});

test('Heilen und Reparieren (v5.01): Kaserne heilt Soldaten, Fabrikhalle repariert gegen Metall, erst nach dem Treffer-Abstand', () => {
  const heal0 = BALANCE.commander.heal;
  BALANCE.commander.heal = 0; // Kommandeur-Aura heilt sonst mit
  try {
    const g = new Game({ seed: 3 });
    const bar = trainerFor(g, 'rifleman');
    const fac = trainerFor(g, 'tank');
    const inf = g.units.filter((u) => u.alive && u.team === 0 && u.type === 'rifleman');
    const [a, far, hit] = inf;
    const tank = g.units.find((u) => u.alive && u.team === 0 && u.type === 'tank');
    const put = (u, x, y, hp) => Object.assign(u, { x, y, hp, lastHitTime: -1e9 });
    put(a, bar.x + 10, bar.y + 10, 30);
    put(far, bar.x + CITY.cell * 6, bar.y, 30);
    put(hit, bar.x - 10, bar.y + 10, 30);
    put(tank, fac.x + 10, fac.y + 10, tank.maxHp / 2);
    g.city[0].metal = 400;
    hit.lastHitTime = g.time; // gerade getroffen: in den nächsten 6 s keine Pflege
    const t0 = tank.hp;
    run(g, 2);
    const p = g.city[0].stats.powerRatio;
    assert.ok(Math.abs(a.hp - (30 + 100 * CITY.care.by.barracks.rate * p * 2)) < 0.6, `Kaserne heilt (${a.hp})`);
    assert.equal(far.hp, 30, 'außer Reichweite keine Heilung');
    assert.equal(hit.hp, 30, 'kurz nach einem Treffer keine Heilung');
    assert.ok(tank.hp > t0 + 1, 'Fabrikhalle repariert');
    const used = ((tank.hp - t0) / tank.maxHp) * CITY.metalCost.tank * CITY.care.metalShare;
    assert.ok(g.city[0].metal < 400 && g.city[0].metal > 400 - used - 1, 'Reparatur kostet Metall');
    g.city[0].metal = 0;
    const t1 = tank.hp;
    run(g, 1);
    assert.ok(tank.hp - t1 < 0.5, 'ohne Metall keine Reparatur');
  } finally {
    BALANCE.commander.heal = heal0;
  }
});

test('Krankenhaus (v5.01): heilt Soldaten im Umkreis von 3 Feldern schneller', () => {
  const heal0 = BALANCE.commander.heal;
  BALANCE.commander.heal = 0;
  try {
    const g = new Game({ seed: 3, startMoney: 5000 });
    clearStart(g); // ohne Kaserne in der Nähe
    assert.equal(paint(g, 'road', 0, 1, 2, 1).ok, true);
    assert.equal(paint(g, 'hospital', 1, 0, 1, 0).ok, true);
    run(g, CITY.growTime + 1);
    const c = g.city[0];
    const i = at(g, 1, 0);
    assert.equal(c.level[i], 1, 'Krankenhaus gebaut');
    const e = c.ents.get(i);
    assert.equal(e.def.name, 'Krankenhaus');
    const [inR, outR] = g.units.filter((u) => u.alive && u.team === 0 && u.type === 'rifleman');
    Object.assign(inR, { x: e.x + CITY.cell * 3, y: e.y, hp: 20, lastHitTime: -1e9 });
    Object.assign(outR, { x: e.x + CITY.cell * 4.6, y: e.y, hp: 20, lastHitTime: -1e9 });
    run(g, 1);
    assert.ok(inR.hp > 20 + 100 * CITY.care.by.barracks.rate, `Krankenhaus heilt schneller als die Kaserne (${inR.hp})`);
    assert.equal(outR.hp, 20, 'außerhalb von 3 Feldern keine Heilung');
  } finally {
    BALANCE.commander.heal = heal0;
  }
});
