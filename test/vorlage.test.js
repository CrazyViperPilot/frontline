// Vorlage aus test/CLAUDE.md, zeichengleich (docs.test.js prüft das): zeigt, dass sie so läuft, wie sie dasteht.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../js/data/balance.js';
import { mkGame, run, hq, withValue } from './util.js';

test('Ausbildung ohne Stadt zieht den Preis vom Geld ab und bringt die Einheit', () => {
  const g = mkGame({ city: false }); // Seed 1; ohne Stadt bildet die Hauptstadt aus
  const money = g.teams[0].res.money;
  const count = () => g.units.filter((u) => u.team === 0 && u.type === 'rifleman').length;
  const before = count();
  assert.ok(g.issue(0, { type: 'train', buildingId: hq(g).id, unit: 'rifleman' }).ok);
  assert.ok(g.teams[0].res.money < money, 'Geld sofort abgezogen');
  run(g, 20); // 20 s in Schritten von 0,05 s
  assert.equal(count(), before + 1);
});

test('Wert kurz verstellen: withValue stellt ihn danach zurück', () => {
  withValue(BALANCE, 'winPoints', 1, () => assert.equal(mkGame().winPoints, 1));
});
