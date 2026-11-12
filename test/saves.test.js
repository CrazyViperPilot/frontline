// Spielstände (SP2): reine Logik von js/ui/saves.js ohne Browser. Abgleich Gerät/Webspace, Namen, Ids, Übernahme des alten Stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaves, syncPush, defaultName, cleanName, copyName, newSaveId, fromLegacy, describe, NAME_MAX } from '../js/ui/saves.js';

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const meta = (id, updatedAt, extra = {}) => ({ id, name: `Stand ${id}`, version: 'v5.143', format: 5, createdAt: 1, updatedAt, gameTime: 60, points: [0, 0], winPoints: 100, difficulty: 'normal', ended: false, size: 10, ...extra });

test('Namen: „Partie TT.MM.JJJJ HH:MM“ aus dem Datum (Ortszeit, zweistellig)', () => {
  assert.equal(defaultName(new Date(2026, 10, 12, 9, 5)), 'Partie 12.11.2026 09:05');
  assert.equal(defaultName(new Date(2027, 0, 1, 23, 59)), 'Partie 01.01.2027 23:59');
});

test('Namen prüfen: getrimmt, 1 bis 60 Zeichen (Zeichen, nicht Bytes)', () => {
  assert.equal(cleanName('  Nordfront  '), 'Nordfront');
  assert.throws(() => cleanName('   '), /1 bis 60/);
  assert.throws(() => cleanName(''), /1 bis 60/);
  assert.throws(() => cleanName(undefined), /1 bis 60/);
  assert.equal(cleanName('ä'.repeat(NAME_MAX)), 'ä'.repeat(NAME_MAX));
  assert.throws(() => cleanName('ä'.repeat(NAME_MAX + 1)), /1 bis 60/);
  assert.equal(cleanName('😀'.repeat(NAME_MAX)).length, NAME_MAX * 2); // Emojis zählen je als ein Zeichen
  assert.throws(() => cleanName('😀'.repeat(NAME_MAX + 1)), /1 bis 60/);
});

test('Ids: UUID v4, auch ohne crypto.randomUUID', () => {
  assert.match(newSaveId(), UUID4);
  assert.notEqual(newSaveId(), newSaveId());
  const zeros = { getRandomValues: (b) => b.fill(0) };
  assert.equal(newSaveId(zeros), '00000000-0000-4000-8000-000000000000');
  assert.match(newSaveId({}), UUID4); // ganz ohne Zufallsquelle: Math.random
  assert.equal(newSaveId({ randomUUID: () => 'abc' }), 'abc');
});

test('Abgleich: je id gewinnt der neuere updatedAt, Quelle und Herkunft sind markiert', () => {
  const local = [meta('a', 10), meta('b', 50)];
  const remote = [meta('a', 20, { name: 'vom Webspace' }), meta('c', 30)];
  const list = mergeSaves(local, remote);
  assert.deepEqual(list.map((e) => e.meta.id), ['b', 'c', 'a'], 'neueste zuerst');
  const a = list.find((e) => e.meta.id === 'a');
  assert.equal(a.meta.name, 'vom Webspace');
  assert.equal(a.source, 'Webspace');
  assert.equal(a.inLocal, true);
  assert.equal(a.inRemote, true);
  const b = list.find((e) => e.meta.id === 'b');
  assert.deepEqual([b.source, b.inLocal, b.inRemote], ['lokal', true, false]);
  const c = list.find((e) => e.meta.id === 'c');
  assert.deepEqual([c.source, c.inLocal, c.inRemote], ['Webspace', false, true]);
});

test('Abgleich: der lokale Stand gewinnt bei gleichem updatedAt; offline bleibt es beim Gerät', () => {
  const list = mergeSaves([meta('a', 10, { name: 'lokal' })], [meta('a', 10, { name: 'fern' })]);
  assert.equal(list[0].meta.name, 'lokal');
  assert.equal(list[0].source, 'lokal');
  assert.deepEqual(mergeSaves([meta('a', 10)], []).map((e) => [e.inLocal, e.inRemote]), [[true, false]]);
});

test('Abgleich: vorgemerkte Löschungen fallen aus der Liste, lokal wie auf dem Webspace', () => {
  const list = mergeSaves([meta('a', 10), meta('b', 20)], [meta('a', 10), meta('x', 5)], ['a', 'x']);
  assert.deepEqual(list.map((e) => e.meta.id), ['b']);
});

test('Hochschicken: nur lokal neuere oder dort unbekannte Stände, keine gelöschten', () => {
  const local = [meta('a', 10), meta('b', 50), meta('c', 5), meta('d', 9)];
  const remote = [meta('a', 10), meta('b', 20), meta('gone', 1)];
  assert.deepEqual(syncPush(local, remote, ['d']).sort(), ['b', 'c']);
  assert.deepEqual(syncPush(local, [], []).sort(), ['a', 'b', 'c', 'd']);
});

test('Alter Einzelstand wird als „Alter Spielstand“ übernommen', () => {
  const bytes = new Uint8Array([0x1f, 0x8b, 1, 2]);
  const rec = fromLegacy({ meta: { savedAt: 1234, format: 5, gameTime: 99, points: [3, 4], winPoints: 100, difficulty: 'schwer', size: 4 }, bytes }, 'id-1');
  assert.equal(rec.meta.id, 'id-1');
  assert.equal(rec.meta.name, 'Alter Spielstand');
  assert.equal(rec.meta.createdAt, 1234);
  assert.equal(rec.meta.updatedAt, 1234);
  assert.equal(rec.meta.ended, false);
  assert.equal(rec.meta.difficulty, 'schwer');
  assert.equal(rec.bytes, bytes);
  const fresh = fromLegacy({ bytes });
  assert.match(fresh.meta.id, UUID4, 'ohne id wird eine neue vergeben');
});

test('Anzeige: Spielzeit, Punkte, Version und Quelle', () => {
  const t = describe(meta('a', 0, { gameTime: 65.4, points: [12, 7] }), 'Webspace');
  assert.match(t, /^Spielzeit 01:05 · Punkte 12 : 7 von 100 · normal · v5\.143 · gespeichert /);
  assert.match(t, /\(Webspace\)$/);
});

test('Kopie: „<Name> (Kopie)“, auf NAME_MAX Zeichen gekürzt', () => {
  assert.equal(copyName('Nordfront'), 'Nordfront (Kopie)');
  assert.equal(copyName('  Nordfront  '), 'Nordfront (Kopie)');
  assert.equal(copyName(''), '(Kopie)');
  const long = copyName('ä'.repeat(NAME_MAX));
  assert.equal([...long].length, NAME_MAX, 'Zeichen, nicht Bytes');
  assert.ok(long.endsWith(' (Kopie)'));
  assert.doesNotThrow(() => cleanName(long));
});
