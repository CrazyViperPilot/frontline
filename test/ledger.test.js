// Kassenbuch je Team (Paket „Wirtschaft: Geld“, js/game/ledger.js): jede Geldbuchung trägt einen Grund; die Wirtschaftsanzeige zeigt
// daraus Einnahmen nach Quelle und Ausgaben nach Zweck.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { IN_KEYS, OUT_KEYS } from '../js/game/ledger.js';
import { run, noCrew, trainer } from './util.js';

const sum = (o) => Object.values(o ?? {}).reduce((s, v) => s + v, 0);

test('Kassenbuch: Geld ändert sich genau um Einnahmen minus Ausgaben (KI gegen KI, alle Schalter, 6 min) [langsam]', () => {
  const g = new Game({ seed: 7, weather: 'random', research: true, river: true, buildRules: true });
  const ais = [new AI(g, 0, 'normal'), new AI(g, 1, 'normal')];
  const m0 = g.teams.map((t) => t.res.money);
  run(g, 360, 0.05, ais);
  for (const t of g.teams) {
    const b = t.book ?? { in: {}, out: {} };
    const booked = sum(b.in) - sum(b.out);
    assert.ok(Math.abs(t.res.money - m0[t.id] - booked) < 1e-6 * Math.max(1, sum(b.in)), `Team ${t.id}: Geld ${t.res.money - m0[t.id]}, gebucht ${booked}`);
    for (const k of Object.keys(b.in)) assert.ok(IN_KEYS.includes(k), `unbekannte Quelle ${k}`);
    for (const k of Object.keys(b.out)) assert.ok(OUT_KEYS.includes(k), `unbekannter Zweck ${k}`);
    assert.ok(b.in.tax > 0, 'Steuern gebucht');
    assert.ok(b.out.city > 0, 'Stadtausbau gebucht');
  }
});

test('Kassenbuch: Konfliktzone und Hot Zone getrennt, Ausbildung und Erstattung unter „train“', () => {
  const g = new Game({ seed: 7 });
  const z = g.zone;
  g.spawnUnit('rifleman', 0, z.x + 2000, z.y); // Zone, nicht Hot Zone
  const u = g.spawnUnit('rifleman', 0, g.hot.x, g.hot.y);
  u.order = { type: 'idle', x: u.x, y: u.y, targetId: null };
  for (let i = 0; i < 100; i++) {
    g.hot.x = u.x;
    g.hot.y = u.y;
    g.update(0.05);
  }
  const b = g.teams[0].book;
  assert.ok(b.in.zone > 0 && b.in.hot > 0, `zone ${b.in.zone}, hot ${b.in.hot}`);
  assert.ok(Math.abs(b.in.hot - 2 * b.in.zone) < 1e-6, 'Hot Zone zahlt das Doppelte');
  noCrew(() => {
    const k = trainer(g, 'rifleman');
    assert.ok(g.issue(0, { type: 'train', buildingId: k.id, unit: 'rifleman' }).ok);
    assert.ok(g.issue(0, { type: 'train', buildingId: k.id, unit: 'at' }).ok);
    const spent = b.out.train;
    assert.ok(spent > 0);
    assert.ok(g.issue(0, { type: 'cancelTrain', buildingId: k.id }).ok);
    assert.ok(b.out.train < spent, 'Erstattung mindert die Ausgaben');
  });
});
