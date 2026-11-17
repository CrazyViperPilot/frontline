// Messwerkzeug Wirtschaft (tools/econ.mjs): ein kurzer Lauf liefert je Team alle Kennzahlen; --set ändert Datenwerte, Vergleich je Minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSeed, parseArgs, applySets, compareRuns, format } from '../tools/econ.mjs';
import { CITY } from '../js/data/city.js';

test('econ: runSeed mit 1 Spielminute liefert je Team alle Felder', async () => {
  const run = await runSeed(3, { min: 1 });
  assert.equal(run.periods.length, 1);
  assert.equal(run.periods[0].min, 1);
  const teams = run.periods[0].teams;
  assert.equal(teams.length, 2);
  for (const v of teams) {
    for (const k of ['money', 'importCost', 'importScale', 'share', 'arrived', 'cutOff', 'edgePoints', 'stations', 'stationsLinked', 'atStation', 'roadLoad', 'roadOver', 'trained', 'kills', 'pop'])
      assert.equal(typeof v[k], 'number', k);
    assert.ok(v.importScale >= 0 && v.importScale <= 1);
    assert.ok(v.share >= 0 && v.share <= 1.001);
    for (const k of ['bm', 'mun', 'fuel', 'steel', 'kero']) assert.equal(typeof v.works[k], 'number', k);
    for (const k of ['bm', 'mun', 'fuel', 'metal', 'kero']) assert.equal(typeof v.stock[k], 'number', k);
    assert.ok(v.pop > 0);
  }
  assert.match(format(run).join('\n'), /Blau: Geld \d+/);
  const cmp = compareRuns({ label: 'a', runs: [run] }, { label: 'b', runs: [run] });
  assert.match(cmp[1], /1 min: an\/s/);
});

test('econ: Optionen und --set', async () => {
  const o = parseArgs(['--seeds', '1,2', '--min', '10', '--conquest', '--build', '0', '--set', 'CITY.transport.cap=18']);
  assert.deepEqual(o.seeds, [1, 2]);
  assert.equal(o.min, 10);
  assert.equal(o.conquest, true);
  assert.equal(o.build, false);
  const old = CITY.transport.cap;
  await applySets(['CITY.transport.cap=18']);
  assert.equal(CITY.transport.cap, 18);
  CITY.transport.cap = old;
  await assert.rejects(applySets(['CITY.gibtsnicht=1']), /gibt es nicht/);
});
