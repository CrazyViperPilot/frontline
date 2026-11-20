// Props der Karte (js/game/props.js, Werte js/data/props.js): Kartenformat, Sperren je Bewegungsklasse, Überfahren, Deckung,
// Splash und Trümmer, Sichtsperre, Spielstand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { generateMap } from '../js/game/map.js';
import { normalizeMap, terrainGrid, createEmptyMap } from '../js/game/mapdata.js';
import { moverOf } from '../js/game/grid.js';
import { PROP_STATE, GATE, propCover, damageProp } from '../js/game/props.js';
import { PROPS } from '../js/data/props.js';
import { BALANCE } from '../js/data/balance.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { pack, unpack } from '../js/core/snapshot.js';
import { once, run } from './util.js';

const T = BALANCE.map.tile;

/** Freies, flaches Feld von n × n Zellen nahe Startpunkt 0 (Seed 1): linke obere Zelle. */
const spot = once(() => {
  const g = new Game({ seed: 1 });
  const G = g.grid;
  const s = g.map.spawns[0];
  const n = 24;
  for (let rad = 12; rad < 120; rad += 2) {
    for (const [dc, dr] of [[1, -1], [1, 0], [0, -1], [1, 1], [-1, -1]]) {
      const c0 = G.toCell(s.x) + dc * rad;
      const r0 = G.toCell(s.y) + dr * rad;
      let ok = true;
      for (let r = r0; r < r0 + n && ok; r++) for (let c = c0; c < c0 + n && ok; c++) ok = G.passable(c, r, 0) && !(G.cost?.[G.idx(c, r)] > 0);
      if (ok) return { c0, r0 };
    }
  }
  throw new Error('kein freies Feld');
});

/** Mitte der Zelle (c0 + dc, r0 + dr) im freien Feld. */
const at = (dc, dr) => ({ x: (spot().c0 + dc + 0.5) * T, y: (spot().r0 + dr + 0.5) * T });

/** Partie auf Seed 1 mit zusätzlichen Props. */
function gameWith(props) {
  const map = normalizeMap({ ...generateMap(1), props });
  return new Game({ seed: 1, map });
}

/** Senkrechte Linie einer Kachelart in Spalte dc von Zeile r0 bis r1. */
const column = (kind, dc, r0, r1) => Array.from({ length: r1 - r0 + 1 }, (_, i) => ({ kind, ...at(dc, r0 + i) }));

test('Kartenformat: Kacheln rasten mittig in ihre Zelle, unbekannte Arten und doppelte Kacheln fallen weg, Tor nur bei Arten mit Tor', () => {
  const m = normalizeMap({ ...generateMap(1), props: [
    { kind: 'fence_wood', x: 100, y: 101, gate: GATE.open },
    { kind: 'fence_wood', x: 110, y: 120 }, // dieselbe Zelle
    { kind: 'gibtsnicht', x: 300, y: 300 },
    { kind: 'wall_stone', x: 500, y: 500, gate: 7 },
  ] });
  assert.deepEqual(m.props, [
    { kind: 'fence_wood', x: 112, y: 112, gate: GATE.open },
    { kind: 'wall_stone', x: 496, y: 496 },
  ]);
  assert.equal(normalizeMap(createEmptyMap()).props, undefined, 'Karten ohne Props haben kein Feld');
});

test('Sperren je Bewegungsklasse: Holzzaun hält Infanterie und Radfahrzeuge auf, Panzer nicht; Betonmauer hält alle auf; offenes Tor keinen', () => {
  const p = at(4, 4);
  const q = at(8, 4);
  const o = at(12, 4);
  const map = normalizeMap({ ...generateMap(1), props: [{ kind: 'fence_wood', ...p }, { kind: 'wall_concrete', ...q }, { kind: 'fence_wood', ...o, gate: GATE.open }] });
  const G = terrainGrid(map);
  const g = new Game({ seed: 1, map });
  const mk = (type) => g.spawnUnit(type, 0, at(0, 0).x, at(0, 0).y);
  const [inf, truck, tank] = [mk('rifleman'), mk('truck'), mk('tank')];
  const pass = (u, pt) => G.passable(G.toCell(pt.x), G.toCell(pt.y), moverOf(u));
  assert.deepEqual([pass(inf, p), pass(truck, p), pass(tank, p)], [false, false, true]);
  assert.deepEqual([pass(inf, q), pass(truck, q), pass(tank, q)], [false, false, false]);
  assert.deepEqual([pass(inf, o), pass(truck, o), pass(tank, o)], [true, true, true]);
  assert.equal(G.passable(G.toCell(p.x), G.toCell(p.y), 0), false, 'reines Team: jedes Prop sperrt (Bauplatz, KI-Prüfungen)');
  assert.equal(G.free(G.toCell(p.x), G.toCell(p.y)), false, 'kein Bauplatz auf dem Zaun');
});

test('Infanterie geht um einen Zaun herum, ein Panzer fährt hindurch und der Zaun ist danach weg', () => {
  const g = gameWith(column('fence_wood', 10, 2, 18));
  const a = at(6, 10);
  const b = at(14, 10);
  const inf = g.spawnUnit('rifleman', 0, a.x, a.y);
  const tank = g.spawnUnit('tank', 0, a.x, a.y + T);
  assert.ok(g.issue(0, { type: 'move', ids: [inf.id], x: b.x, y: b.y }).ok);
  run(g, 4);
  assert.equal([...g.propSt].filter((s) => s !== PROP_STATE.ok).length, 0, 'Infanterie überfährt nichts');
  assert.ok(g.issue(0, { type: 'move', ids: [tank.id], x: b.x, y: b.y + T }).ok);
  run(g, 25);
  assert.ok(Math.hypot(tank.x - b.x, tank.y - b.y - T) < 2 * T, 'Panzer am Ziel');
  const gone = [...g.propSt].filter((s) => s === PROP_STATE.gone).length;
  assert.ok(gone >= 1 && gone <= 2, `Panzer bricht eine Lücke (${gone} Kacheln weg)`);
  const i = [...g.propSt].indexOf(PROP_STATE.gone);
  const p = g.map.props[i];
  assert.equal(g.grid.passable(g.grid.toCell(p.x), g.grid.toCell(p.y), moverOf(inf)), true, 'Lücke ist für Infanterie frei');
  run(g, 30);
  assert.ok(Math.hypot(inf.x - b.x, inf.y - b.y) < 2 * T, 'Infanterie am Ziel (um den Zaun oder durch die Lücke)');
});

test('Deckung: Infanterie hinter einer Betonmauer nimmt weniger Schaden, nur gegen Schützen auf der anderen Seite', () => {
  const g = gameWith(column('wall_concrete', 10, 6, 14));
  const t = g.spawnUnit('rifleman', 0, at(11, 10).x, at(11, 10).y);
  const far = at(4, 10);
  const same = at(18, 10);
  assert.equal(propCover(g, t, far.x, far.y), PROPS.kinds.wall_concrete.cover, 'Mauer zwischen Ziel und Schütze');
  assert.equal(propCover(g, t, same.x, same.y), 0, 'Schütze auf derselben Seite: keine Deckung');
  const tank = g.spawnUnit('tank', 0, at(11, 12).x, at(11, 12).y);
  assert.equal(propCover(g, tank, far.x, far.y), PROPS.kinds.wall_concrete.coverVeh, 'Fahrzeuge: eigener Deckungswert');
});

test('Beschuss: Betonmauer wird zu Trümmern (Radfahrzeuge bleiben hängen, Infanterie kommt durch), Holzzaun ist weg', () => {
  const w = at(6, 6);
  const f = at(12, 6);
  const g = gameWith([{ kind: 'wall_concrete', ...w }, { kind: 'fence_wood', ...f }]);
  damageProp(g, 0, PROPS.kinds.wall_concrete.hp + 1);
  damageProp(g, 1, PROPS.kinds.fence_wood.hp + 1);
  assert.deepEqual([...g.propSt], [PROP_STATE.rubble, PROP_STATE.gone]);
  const G = g.grid;
  const inf = g.spawnUnit('rifleman', 0, at(0, 0).x, at(0, 0).y);
  const truck = g.spawnUnit('truck', 0, at(0, 2).x, at(0, 2).y);
  assert.equal(G.passable(G.toCell(w.x), G.toCell(w.y), moverOf(inf)), true);
  assert.equal(G.passable(G.toCell(w.x), G.toCell(w.y), moverOf(truck)), false);
  assert.equal(G.passable(G.toCell(f.x), G.toCell(f.y), moverOf(truck)), true);
});

test('Splash einer Granate beschädigt Mauern im Umkreis', () => {
  const w = at(6, 6);
  const g = gameWith([{ kind: 'wall_stone', ...w }]);
  g.projectiles.push({ alive: true, team: 1, tx: w.x + 8, ty: w.y, splash: 60, damage: { struct: 400, inf: 50 }, t: 0, duration: 0, sx: w.x, sy: w.y });
  g.update(0.05);
  assert.equal(g.propSt[0], PROP_STATE.rubble);
});

test('Sicht: eine Betonmauer verdeckt, was dicht dahinter steht; ohne Mauer sieht man es', () => {
  const wall = column('wall_concrete', 10, 0, 20);
  const watch = at(9, 10);
  const hidden = at(14, 10);
  const look = (props) => {
    const g = gameWith(props);
    g.spawnUnit('rifleman', 0, watch.x, watch.y);
    g.fog[0].update(g, 0);
    return g.fog[0].isVisible(hidden.x, hidden.y);
  };
  assert.equal(look([]), true);
  assert.equal(look(wall), false);
});

test('Spielstand: Zustand der Props und Raster überstehen Speichern und Laden', async () => {
  const g = gameWith(column('fence_wood', 10, 4, 8));
  damageProp(g, 2, PROPS.kinds.fence_wood.hp);
  const p = g.map.props[2];
  const { game: g2 } = restoreGame(await unpack(await pack(snapshotGame(g))));
  assert.deepEqual([...g2.propSt], [...g.propSt]);
  assert.equal(g2.propVersion, g.propVersion);
  assert.equal(g2.grid.prop[g2.grid.idx(g2.grid.toCell(p.x), g2.grid.toCell(p.y))], 0, 'Lücke auch nach dem Laden');
});

test('Bild: jede Kachelart in jeder Verbindung, mit Toren und als Trümmer hat Körper mit endlichen Koordinaten', async () => {
  const { fenceModel } = await import('../js/render/fences.js');
  for (const kind of Object.keys(PROPS.kinds)) {
    for (let mask = 0; mask < 16; mask++) {
      for (const [gate, rubble] of [[0, false], [GATE.closed, false], [GATE.open, false], [0, true]]) {
        const S = fenceModel(kind, mask, mask % 2 ? 'x' : 'y', gate, rubble, mask % 3, mask, mask % 2 === 0);
        if (rubble && !PROPS.kinds[kind].rubble) {
          assert.equal(S.length, 0, `${kind}: ohne Trümmer kein Bild`);
          continue;
        }
        assert.ok(S.length > 0, `${kind} Maske ${mask}`);
        for (const so of S) for (const f of so.faces) for (const p of f) assert.ok(p.every(Number.isFinite), `${kind} Maske ${mask}: Koordinate`);
      }
    }
  }
});

test('Zufallskarten: wenige Kacheln an Äckern, punktsymmetrisch, ohne Fluss und mit Fluss je Seed gleich', () => {
  for (const seed of [2, 5]) {
    const a = generateMap(seed).props ?? [];
    assert.deepEqual(generateMap(seed).props ?? [], a, 'gleicher Seed, gleiche Props');
    assert.ok(a.length < 200, `sparsam (${a.length} Kacheln)`);
    const key = (p) => `${p.kind},${p.x},${p.y}`;
    const all = new Set(a.map(key));
    for (const p of a) assert.ok(all.has(`${p.kind},${BALANCE.map.width - p.x},${BALANCE.map.height - p.y}`), 'Spiegelbild vorhanden');
  }
});
