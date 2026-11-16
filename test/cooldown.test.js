// Sperrzeiten der KI (js/ai/cooldown.js), Buchhaltung der Stadt-KI (cityAiMemory) und die Ergänzung älterer Spielstände (AI.restoreMemory).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, ready, take, prune } from '../js/ai/cooldown.js';
import { cityAiMemory } from '../js/ai/cityai.js';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';

test('block und ready: gesperrt bis zur Grenze, an der Grenze wieder frei', () => {
  const t = {};
  assert.equal(ready(t, 'a', 0), true, 'nie gesperrt');
  block(t, 'a', 10, 5); // gesperrt bis 15
  assert.equal(ready(t, 'a', 14.9), false, 'vor der Grenze gesperrt');
  assert.equal(ready(t, 'a', 15), true, 'genau an der Grenze frei');
  assert.equal(ready(t, 'a', 16), true, 'danach frei');
  assert.equal(ready(t, 'b', 0), true, 'anderer Schlüssel unberührt');
});

test('take: sperrt beim Erfolg, danach false bis zum Ablauf', () => {
  const t = {};
  assert.equal(take(t, 'k', 10, 0), true);
  assert.equal(take(t, 'k', 10, 9), false, 'innerhalb der Sperre abgelehnt');
  assert.equal(take(t, 'k', 10, 9), false, 'abgelehnte Versuche verlängern die Sperre nicht');
  assert.equal(take(t, 'k', 10, 10), true, 'nach Ablauf wieder erlaubt');
  assert.equal(t.k, 20, 'neue Sperre ab dem Erfolg');
});

test('prune: löscht nur abgelaufene Sperren (<= now)', () => {
  const t = { a: 5, b: 10, c: 11 };
  prune(t, 10);
  assert.deepEqual(t, { c: 11 }, 'a (5) und b (10, Grenze erreicht) fallen weg, c bleibt');
});

test('cityAiMemory: alle Felder da, keines undefined', () => {
  const m = cityAiMemory();
  for (const k of ['turn', 'raidTimer', 'importBad', 'importAt', 'steelWant', 'laneHot', 'parkKeep', 'wait', 'parkWait', 'linkWait', 'laneWait']) {
    assert.ok(k in m, `Feld ${k} fehlt`);
    assert.notEqual(m[k], undefined, `Feld ${k} ist undefined`);
  }
  for (const k of ['importNext', 'defendAt', 'parkFail', 'linkFail', 'laneFail']) assert.equal(k in m, false, `altes Feld ${k} noch da`);
  assert.equal(m.importAt, null);
  assert.deepEqual(m.wait, {});
});

test('AI.once: sperrt je Schlüssel für secs, danach wieder frei', () => {
  const g = new Game({ seed: 1 });
  const ai = new AI(g, 1);
  const t0 = g.time;
  assert.equal(ai.once('x', 10), true);
  assert.equal(ai.once('x', 10), false);
  assert.equal(ai.once('y', 10), true, 'anderer Schlüssel frei');
  g.time = t0 + 10;
  assert.equal(ai.once('x', 10), true, 'nach Ablauf erlaubt');
});

test('AI.restoreMemory: ergänzt einen alten Stand (Map memo, altes cityMem mit importNext)', () => {
  const g = new Game({ seed: 1 });
  const ai = new AI(g, 1);
  ai.memo = new Map([['wall', 3]]);
  delete ai.airMemo;
  ai.cityMem = { turn: 4, raidTimer: 2, importBad: 0, importAt: undefined, importNext: 100, defendAt: 7, parkFail: { 3: 5 }, linkFail: { 9: 50 }, laneFail: {}, parkKeep: { 1: 1 } };
  ai.restoreMemory();
  assert.deepEqual(ai.memo, {}, 'Map wird Tabelle');
  assert.deepEqual(ai.airMemo, {}, 'airMemo angelegt');
  assert.equal(ai.cityMem.turn, 4, 'bekannte Werte bleiben');
  assert.deepEqual(ai.cityMem.parkKeep, { 1: 1 }, 'freigehaltene Plätze bleiben');
  assert.equal(ai.cityMem.importAt, null, 'importAt undefined wird null');
  for (const k of ['importNext', 'defendAt', 'parkFail', 'linkFail', 'laneFail']) assert.equal(k in ai.cityMem, false, `${k} entfernt`);
  for (const k of ['wait', 'parkWait', 'linkWait', 'laneWait', 'laneHot', 'steelWant']) assert.ok(k in ai.cityMem, `${k} ergänzt`);
  assert.equal(ready(ai.cityMem.wait, 'station', g.time), true, 'Sperren beginnen neu');
  assert.equal(ai.once('z', 5), true, 'Drosselung funktioniert nach dem Laden');
});
