// Stillgelegte Zellenart (Platzhalter „Flughafen“, Nummer 17, CITY.retired): nicht baubar, aber als Zelle in einem Spielstand ladbar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { CITY } from '../js/data/city.js';
import { KINDS, KIND_ID, BUILD_MENU } from '../js/data/citykinds.js';
import { placeBuilt, rebuildList } from '../js/game/city/state.js';
import { canZone, roadAt } from '../js/game/city/cells.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { pack, unpack } from '../js/core/snapshot.js';

// erste freie Zelle im Gebiet des Teams 0, auf der man eine Zone bauen dürfte, sonst −1
function freeCell(c, g) {
  for (let i = 0; i < c.kind.length; i++) if (!c.kind[i] && !roadAt(c, i) && canZone(g, c, i)) return i;
  return -1;
}

test('Flughafen ist nicht baubar: CITY.retired, nicht im Baumenü, Baubefehl abgelehnt', () => {
  assert.ok(CITY.retired.includes('airport'));
  const keys = BUILD_MENU.flatMap(([, list]) => list);
  assert.ok(!keys.includes('airport'), 'nicht im Baumenü');
  const g = new Game({ seed: 3, city: true });
  const c = g.city[0];
  const i = freeCell(c, g);
  assert.ok(i >= 0, 'freie Zelle');
  const col = i % c.cols;
  const row = (i - col) / c.cols;
  const r = g.issue(0, { type: 'city', kind: 'airport', c0: col, r0: row, c1: col, r1: row });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Flughafen: nicht mehr baubar');
  assert.equal(c.kind[i], 0, 'die Zelle bleibt leer');
});

test('Spielstand mit einer Flughafen-Zelle lädt und spielt weiter', async () => {
  const g1 = new Game({ seed: 3, city: true });
  const a1 = new AI(g1, 1, 'normal');
  const c1 = g1.city[0];
  const i = freeCell(c1, g1);
  assert.ok(i >= 0, 'freie Zelle');
  // so liegt eine fertige Zelle im Raster: Art, Stufe 1, Eintrag in der Zellenliste, Ziel-Entity
  placeBuilt(g1, c1, i, 'airport');
  rebuildList(c1);
  assert.equal(KINDS[c1.kind[i] - 1], 'airport');
  assert.equal(c1.kind[i], KIND_ID.airport);
  assert.equal(c1.level[i], 1);

  const bytes = await pack(snapshotGame(g1, a1));
  let loaded;
  try {
    loaded = restoreGame(await unpack(bytes));
  } catch (e) {
    assert.fail(`Laden des Spielstands scheiterte: ${e.stack ?? e.message}`);
  }
  const { game: g2, ai: a2 } = loaded;
  const c2 = g2.city[0];
  assert.equal(c2.kind[i], KIND_ID.airport, 'die Zelle ist nach dem Laden noch Flughafen');
  assert.equal(KINDS[c2.kind[i] - 1], 'airport');
  assert.equal(c2.level[i], 1);
  assert.ok(c2.list.includes(i), 'in der Zellenliste');

  for (let t = 0; t < 10; t++) {
    a2.update(0.1);
    g2.update(0.1);
  }
  assert.equal(c2.kind[i], KIND_ID.airport, 'nach dem Weiterspielen unverändert');
});
