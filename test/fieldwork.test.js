// Feldstellungen (Paket „Deckung“, js/game/fieldwork.js, KI js/ai/army/cover.js): Befehl fieldwork, Bezahlen bei Fertigstellung,
// Baurecht, Deckung in der Sandsack-Stellung, eigene Kettenfahrzeuge walzen nicht, Spielstand, KI gräbt sich ein.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { PROPS } from '../js/data/props.js';
import { BALANCE } from '../js/data/balance.js';
import { propCover, PROP_STATE, stateOf } from '../js/game/props.js';
import { teamProps } from '../js/game/fieldwork.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { pack, unpack } from '../js/core/snapshot.js';
import { run } from './util.js';

const T = BALANCE.map.tile;
const F = PROPS.field.kinds;

/** Partie mit einem Schützen von Team 0 auf freiem Feld weit weg von FOBs (kein Lager zahlt), Punkt 100 px östlich. */
function setup() {
  const g = new Game({ seed: 1 });
  const G = g.grid;
  const s = g.map.spawns[0];
  // freies Feld 12 × 6 Zellen suchen, mindestens 900 px von der Hauptstadt
  for (let rad = 30; rad < 160; rad += 3) {
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 1]]) {
      const c0 = G.toCell(s.x) + dc * rad;
      const r0 = G.toCell(s.y) + dr * rad;
      let ok = true;
      for (let r = r0; r < r0 + 6 && ok; r++) for (let c = c0; c < c0 + 12 && ok; c++) ok = G.passable(c, r, 0) && !(G.cost?.[G.idx(c, r)] > 0) && !G.prop?.[G.idx(c, r)];
      if (!ok || g.fobsInRadius(0, G.center(c0 + 6), G.center(r0 + 3)).length) continue;
      const u = g.spawnUnit('rifleman', 0, G.center(c0 + 1), G.center(r0 + 3));
      return { g, u, c0, r0, x: G.center(c0 + 5), y: G.center(r0 + 3) };
    }
  }
  throw new Error('kein freies Feld');
}

test('Schütze baut eine Sandsack-Stellung aus seiner Ladung, erst bei Fertigstellung bezahlt', () => {
  const { g, u, x, y } = setup();
  const bm0 = u.cargo.bm;
  const n0 = g.map.props.length;
  const r = g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag_nest', x, y, rot: 2 });
  assert.equal(r.ok, true, r.reason);
  run(g, 3);
  assert.equal(u.order.type, 'fieldwork');
  assert.equal(u.cargo.bm, bm0, 'vor der Fertigstellung nichts bezahlt');
  run(g, F.sandbag_nest.time + 3);
  assert.equal(g.map.props.length, n0 + 1);
  const p = g.map.props[n0];
  assert.deepEqual([p.kind, p.team, p.built, p.rot], ['sandbag_nest', 0, true, 2]);
  assert.equal(u.cargo.bm, bm0 - F.sandbag_nest.bm);
  assert.equal(u.order.type, 'idle');
  assert.deepEqual(teamProps(g, 0, 'sandbag_nest'), [n0]);
  assert.deepEqual(teamProps(g, 1), []);
  // Infanterie in der Stellung hat Deckung nach allen Seiten
  const v = g.spawnUnit('rifleman', 0, p.x, p.y);
  for (const [dx, dy] of [[300, 0], [-300, 0], [0, 300], [0, -300]]) assert.equal(propCover(g, v, p.x + dx, p.y + dy), PROPS.kinds.sandbag_nest.cover);
});

test('Hesco nur mit Baufahrzeug; ohne Baumaterial abgelehnt; Linie aus Kacheln', () => {
  const { g, u, x, y } = setup();
  assert.equal(g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'hesco', x, y }).ok, false);
  u.cargo.bm = 0;
  assert.equal(g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag', x, y }).ok, false);
  u.cargo.bm = 50;
  const r = g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag', x, y, x2: x + 3 * T, y2: y });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.count, 4);
  const n0 = g.map.props.length;
  run(g, 4 * F.sandbag.time + 12);
  assert.equal(g.map.props.length, n0 + 4);
  assert.equal(u.cargo.bm, 50 - 4 * F.sandbag.bm);
  // zu lange Linie
  assert.equal(g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag', x, y, x2: x + (PROPS.field.lineMax + 2) * T, y2: y }).ok, false);
  // belegter Platz
  assert.equal(g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag', x, y }).ok, false);
});

test('Eigene Kettenfahrzeuge walzen eigene Feldstellungen nicht, gegnerische schon; Spielstand behält sie', async () => {
  const { g, u, x, y } = setup();
  g.issue(0, { type: 'fieldwork', ids: [u.id], kind: 'sandbag_nest', x, y });
  run(g, F.sandbag_nest.time + 5);
  const i = g.map.props.length - 1;
  assert.equal(g.map.props[i].built, true);
  const own = g.spawnUnit('tank', 0, x, y);
  run(g, 0.5);
  assert.equal(stateOf(g.propSt[i]), PROP_STATE.ok, 'eigener Panzer walzt nicht');
  own.alive = false;
  const r = restoreGame(await unpack(await pack(snapshotGame(g)))).game;
  assert.equal(r.map.props.length, g.map.props.length);
  assert.equal(r.map.props[i].team, 0);
  assert.equal(stateOf(r.propSt[i]), PROP_STATE.ok);
  // Gegner kennt die Stellung erst, wenn er sie sieht
  assert.equal(stateOf(g.propSeen[1][i]), PROP_STATE.gone);
  g.spawnUnit('tank', 1, x, y);
  run(g, 0.5);
  assert.equal(stateOf(g.propSt[i]), PROP_STATE.gone, 'gegnerischer Panzer walzt');
});

test('[langsam] KI gräbt sich in der Zone ein und besetzt ihre Stellungen', () => {
  const g = new Game({ seed: 3, conquest: true, research: true, river: true, buildRules: true });
  const ais = [new AI(g, 0, 'normal'), new AI(g, 1, 'normal')];
  let seated = 0;
  for (let k = 0; k < 12 * 60 * 10; k++) {
    for (const a of ais) a.update(0.1);
    g.update(0.1);
    if (k % 50) continue;
    for (const t of [0, 1]) {
      for (const i of teamProps(g, t, 'sandbag_nest')) {
        const p = g.map.props[i];
        if (g.units.some((u) => u.alive && u.team === t && u.def.armor === 'inf' && Math.hypot(u.x - p.x, u.y - p.y) <= 16)) seated++;
      }
    }
  }
  const built = g.map.props.filter((p) => p.built).length;
  assert.ok(built >= 4, `Stellungen gebaut: ${built}`);
  assert.ok(seated > 0, 'Infanterie sitzt in eigenen Stellungen');
});
