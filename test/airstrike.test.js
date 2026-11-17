// Luftschlag (Paket „Luftschlag“, js/game/airstrike.js): startbereite Jets mit Bodenwaffen auf Ziel oder Punkt, danach Landung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { parkNew } from '../js/game/aircraft.js';
import { strikeJets, groundJet } from '../js/game/airstrike.js';
import { airbase, run } from './airbasehelp.js';
import { withValue } from './util.js';

/** Fliegerhorst mit zwei startbereiten F-16 und einer F-22 (nur Luftziele) für Team 0. */
function scene() {
  const g = new Game({ seed: 3 });
  const ab = airbase(g);
  const jet = (type, s) => {
    const u = g.spawnUnit(type, 0, s.x, s.y);
    parkNew(g, u, s);
    return u;
  };
  const f16a = jet('f16', ab.stands[0]);
  const f16b = jet('f16', ab.stands[1]);
  const f22 = jet('f22', ab.stands[0]);
  return { g, ab, f16a, f16b, f22 };
}

test('Luftschlag: nur startbereite Jets mit Bodenwaffen, ohne sie eine Ablehnung', () => {
  const g = new Game({ seed: 3 });
  const r = g.issue(0, { type: 'airstrike', x: g.zone.x, y: g.zone.y });
  assert.equal(r.ok, false);
  assert.match(r.reason, /startbereiter Jet/);
  const { g: h, f16a, f16b, f22 } = scene();
  assert.ok(groundJet(f16a) && !groundJet(f22), 'F-22 hat keine Bodenwaffe');
  const ready = strikeJets(h, 0).map((u) => u.id).sort();
  assert.deepEqual(ready, [f16a.id, f16b.id].sort());
});

test('Luftschlag auf ein Ziel: die F-16 greifen an (die F-22 bleibt stehen), nach dem Abschuss landen sie', () => {
  const { g, f16a, f16b, f22 } = scene();
  const tank = g.spawnUnit('tank', 1, g.zone.x, g.zone.y);
  const r = g.issue(0, { type: 'airstrike', x: tank.x, y: tank.y, targetId: tank.id });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.count, 2);
  for (const u of [f16a, f16b]) {
    assert.equal(u.order.type, 'attack');
    assert.equal(u.order.targetId, tank.id);
    assert.equal(u.order.strike, true);
  }
  assert.equal(f22.order.type, 'idle', 'F-22 ohne Bodenwaffe startet nicht');
  assert.equal(strikeJets(g, 0).length, 0, 'beide F-16 sind unterwegs');
  run(g, 20); // rollen und starten
  assert.ok([f16a, f16b].some((u) => !u.parked), 'mindestens einer ist unterwegs');
  tank.alive = false; // Ziel vernichtet
  g.update(0.05);
  for (const u of [f16a, f16b]) assert.ok(u.parked ? u.order.type === 'idle' : u.order.type === 'land', `Ziel weg: zurück zum Stellplatz (${u.order.type})`);
});

test('Ziel vor dem Start vernichtet: der Jet bleibt stehen und ist wieder startbereit', () => {
  const { g, f16a } = scene();
  const tank = g.spawnUnit('tank', 1, g.zone.x, g.zone.y);
  assert.equal(g.issue(0, { type: 'airstrike', x: tank.x, y: tank.y, targetId: tank.id }).ok, true);
  tank.alive = false;
  g.update(0.05);
  assert.equal(f16a.order.type, 'idle');
});

test('Luftschlag auf einen Punkt: Angriffsmarsch, dort nichts gefunden: nach linger s Landung; höchstens maxJets', () => {
  const { g, ab, f16a, f16b } = scene();
  withValue(CITY.air.strike, 'maxJets', 1, () => {
    const r = g.issue(0, { type: 'airstrike', x: ab.m.x + 1200, y: ab.m.y });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.count, 1, 'maxJets begrenzt den Luftschlag');
  });
  const [u] = [f16a, f16b].filter((x) => x.order.type === 'attackMove');
  assert.ok(u, 'ein Jet im Angriffsmarsch');
  let landed = false;
  for (let k = 0; k < 240 && !landed; k++) {
    run(g, 1);
    landed = u.order.type === 'land';
  }
  assert.ok(landed, `nach dem Einsatz Landebefehl (Befehl ${u.order.type})`);
});

test('Eigener Angriffsmarsch eines Jets ist kein Luftschlag: er kreist am Punkt weiter', () => {
  const { g, ab, f16a } = scene();
  assert.equal(g.issue(0, { type: 'attackMove', ids: [f16a.id], x: ab.m.x + 1200, y: ab.m.y }).ok, true);
  for (let k = 0; k < 120; k++) run(g, 1);
  assert.notEqual(f16a.order.type, 'land', 'kein Heimflug ohne Luftschlag');
});
