// Props der Karte (js/game/props.js, Werte js/data/props.js): Kartenformat, Sperren je Bewegungsklasse, Überfahren, Deckung,
// Splash und Trümmer, Sichtsperre, Spielstand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { generateMap } from '../js/game/map.js';
import { normalizeMap, terrainGrid, createEmptyMap } from '../js/game/mapdata.js';
import { moverOf } from '../js/game/grid.js';
import { PROP_STATE, GATE, GATE_OPEN, propCover, damageProp } from '../js/game/props.js';
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

test('Bild: jede Art (Kacheln in jeder Verbindung, mit Toren, Einzelstücke in jeder Drehung) und ihre Trümmer haben Körper mit endlichen Koordinaten', async () => {
  const { fenceModel } = await import('../js/render/fences.js');
  const { milModel } = await import('../js/render/milprops.js'); // meldet die Kacheln der Militär-Props an
  const { indModel, isIndSingle } = await import('../js/render/indprops.js');
  const { civModel, isCivSingle, DELEGATE } = await import('../js/render/civprops.js'); // meldet die Hecke an
  for (const kind of Object.keys(PROPS.kinds).filter((k) => !PROPS.kinds[k].line)) {
    for (let rot = 0; rot < 8; rot++) {
      for (const [rubble, open] of [[false, false], [true, false], [false, true]]) {
        if (DELEGATE[kind]) continue; // vorhandene Maler (Auto, Bank, Ballen, Busch, Fels): eigene Tests
        const season = ['summer', 'autumn', 'winter'][rot % 3];
        const S = isIndSingle(kind)
          ? indModel(kind, rot % 3, rot, rot % 2 === 0, rubble, (rot % 3) + 1)
          : isCivSingle(kind)
            ? civModel(kind, rot % 3, rot, season, rubble)
            : milModel(kind, rot % 3, rot, rot % 2 === 0, rubble, '#3d8bfd', open);
        assert.ok(S.length > 0 || (rubble && !PROPS.kinds[kind].rubble), `${kind}: Bild`);
        for (const so of S) for (const f of so.faces) for (const p of f) assert.ok(p.every(Number.isFinite), `${kind}: Koordinate`);
      }
    }
  }
  for (const kind of Object.keys(PROPS.kinds).filter((k) => PROPS.kinds[k].line)) {
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

test('Militär: Jersey-Sperre und Tschechenigel halten Fahrzeuge auf, Infanterie kommt durch; Schranke verschlossen hält Fahrzeuge, offen niemanden', () => {
  const j = at(4, 4);
  const h = at(8, 4);
  const b = at(12, 4);
  const o = at(16, 4);
  const map = normalizeMap({ ...generateMap(1), props: [
    { kind: 'jersey', ...j }, { kind: 'hedgehog', ...h }, { kind: 'boom_gate', ...b, gate: GATE.locked }, { kind: 'boom_gate', ...o, gate: GATE.open },
  ] });
  const g = new Game({ seed: 1, map });
  const G = g.grid;
  const [inf, truck, tank] = ['rifleman', 'truck', 'tank'].map((t) => g.spawnUnit(t, 0, at(0, 0).x, at(0, 0).y));
  const pass = (u, pt) => G.passable(G.toCell(pt.x), G.toCell(pt.y), moverOf(u));
  assert.deepEqual([pass(inf, j), pass(truck, j), pass(tank, j)], [true, false, false], 'Jersey');
  assert.deepEqual([pass(inf, h), pass(truck, h), pass(tank, h)], [true, false, false], 'Igel');
  assert.deepEqual([pass(inf, b), pass(truck, b), pass(tank, b)], [true, false, true], 'Schranke verschlossen: Panzer walzt sie nieder');
  assert.deepEqual([pass(inf, o), pass(truck, o)], [true, true], 'Schranke offen');
});

test('Militär: Munitionskisten fliegen beim Zerstören in die Luft und verletzen Einheiten ringsum', () => {
  const p = at(8, 8);
  const g = gameWith([{ kind: 'ammo_stack', ...p }]);
  const u = g.spawnUnit('rifleman', 1, p.x + 30, p.y);
  const hp = u.hp;
  damageProp(g, 0, PROPS.kinds.ammo_stack.hp + 1);
  assert.equal(g.propSt[0], PROP_STATE.gone);
  g.update(0.05);
  assert.ok(u.hp < hp, `Splash der Explosion (${hp} → ${u.hp})`);
});

test('Militär: unter einem Tarnnetz sieht der Gegner eine Einheit nur aus der Nähe', () => {
  const p = at(10, 10);
  const g = gameWith([{ kind: 'camo_net', ...p }]);
  const hidden = g.spawnUnit('rifleman', 1, p.x, p.y);
  const far = g.spawnUnit('scout', 0, p.x - 220, p.y);
  g.fog[0].update(g, 0);
  assert.equal(g.fog[0].isVisible(p.x, p.y), true, 'Stelle liegt in Sicht');
  assert.equal(g.sees(0, hidden), false, 'getarnt');
  far.x = p.x - BALANCE.stealth.detectRange + 10;
  g.fog[0].update(g, 0);
  assert.equal(g.sees(0, hidden), true, 'aus der Nähe erkannt');
});

test('Militär: Fahne mit Teamfarbe bleibt im Kartenformat, nur bei Arten mit Fahne', () => {
  const m = normalizeMap({ ...createEmptyMap(), props: [{ kind: 'tent', x: 500, y: 500, rot: 3, team: 1 }, { kind: 'ammo_stack', x: 700, y: 500, team: 1 }] });
  assert.deepEqual(m.props, [{ kind: 'tent', x: 500, y: 500, rot: 3, team: 1 }, { kind: 'ammo_stack', x: 700, y: 500 }]);
});

test('Industrie: gestapelte Container halten mehr aus und verdecken höher; Portalkran sperrt nur an den Beinen', () => {
  const c1 = at(4, 4);
  const c3 = at(10, 4);
  const k = at(10, 14);
  const map = normalizeMap({ ...generateMap(1), props: [{ kind: 'container', ...c1 }, { kind: 'container', ...c3, stack: 3 }, { kind: 'gantry_crane', ...k }] });
  assert.equal(map.props[1].stack, 3);
  const g = new Game({ seed: 1, map });
  assert.equal(g.propHp[1], PROPS.kinds.container.hp * 3, 'Trefferpunkte je Lage');
  const G = g.grid;
  const h = (p) => G.propH[G.idx(G.toCell(p.x), G.toCell(p.y))];
  assert.equal(h(c3), h(c1) * 3, 'Sichthöhe je Lage');
  const truck = g.spawnUnit('truck', 0, at(0, 0).x, at(0, 0).y);
  const pass = (x, y) => G.passable(G.toCell(x), G.toCell(y), moverOf(truck));
  assert.equal(pass(k.x, k.y), true, 'unter dem Kran durch');
  assert.equal(pass(k.x - 58, k.y), false, 'Bein links');
  assert.equal(pass(k.x + 58, k.y), false, 'Bein rechts');
});

test('Zufallskarten: Lagerhöfe an Hallen, punktsymmetrisch', () => {
  const ind = new Set(['container', 'pallets', 'crate_stack', 'barrels', 'barrels_lying', 'tyres', 'forklift', 'power_box', 'street_lamp']);
  const a = (generateMap(3).props ?? []).filter((p) => ind.has(p.kind));
  assert.ok(a.length > 0 && a.length < 120, `${a.length} Teile`);
  const all = new Set(a.map((p) => `${p.kind},${p.x},${p.y}`));
  for (const p of a) assert.ok(all.has(`${p.kind},${BALANCE.map.width - p.x},${BALANCE.map.height - p.y}`));
});

test('Zivil und Natur: Hecke verdeckt die Sicht, im Krater hat Infanterie Deckung nach allen Seiten, umgestürzter Baum sperrt', () => {
  const k = at(8, 8);
  const t = at(16, 8);
  const g = gameWith([{ kind: 'crater', ...k }, { kind: 'fallen_tree', ...t }]);
  const u = g.spawnUnit('rifleman', 1, k.x + 4, k.y + 4);
  for (const [dx, dy] of [[300, 0], [-300, 0], [0, 300], [0, -300]]) assert.equal(propCover(g, u, k.x + dx, k.y + dy), PROPS.kinds.crater.cover, `Schütze aus ${dx},${dy}`);
  const inf = g.spawnUnit('rifleman', 0, at(0, 0).x, at(0, 0).y);
  assert.equal(g.grid.passable(g.grid.toCell(t.x), g.grid.toCell(t.y), moverOf(inf)), false, 'Baum sperrt');
  const look = (props) => {
    const h = gameWith(props);
    h.spawnUnit('rifleman', 0, at(9, 10).x, at(9, 10).y);
    h.fog[0].update(h, 0);
    return h.fog[0].isVisible(at(14, 10).x, at(14, 10).y);
  };
  assert.equal(look(column('hedge', 10, 0, 20)), false, 'Hecke verdeckt');
});

test('Tore: ein geschlossenes Tor öffnet sich, wenn eine Einheit hindurchgeht, und schließt danach wieder; ein verschlossenes sperrt', () => {
  const wall = column('fence_wood', 10, 0, 20);
  wall[10] = { ...wall[10], gate: GATE.closed };
  wall[4] = { ...wall[4], gate: GATE.locked };
  const g = gameWith(wall);
  const G = g.grid;
  const gate = g.map.props[10];
  const inf = g.spawnUnit('rifleman', 0, at(6, 10).x, at(6, 10).y);
  assert.equal(G.passable(G.toCell(gate.x), G.toCell(gate.y), moverOf(inf)), true, 'zu: passierbar (wird geöffnet)');
  const locked = g.map.props[4];
  assert.equal(G.passable(G.toCell(locked.x), G.toCell(locked.y), moverOf(inf)), false, 'verschlossen: sperrt');
  assert.ok(g.issue(0, { type: 'move', ids: [inf.id], x: at(14, 10).x, y: at(14, 10).y }).ok);
  let opened = false;
  for (let k = 0; k < 400 && !opened; k++) {
    g.update(0.05);
    opened = !!(g.propSt[10] & GATE_OPEN);
  }
  assert.ok(opened, 'Einheit hat das Tor geöffnet');
  run(g, 20);
  assert.ok(Math.hypot(inf.x - at(14, 10).x, inf.y - at(14, 10).y) < 2 * T, 'durch das Tor am Ziel');
  assert.equal(g.propSt[10] & GATE_OPEN, 0, 'wieder zu');
});

test('Props beschießen: A-Befehl auf eine Mauer zerstört sie; Krater sind kein Ziel', () => {
  const w = at(10, 10);
  const k = at(16, 10);
  const g = gameWith([{ kind: 'wall_stone', ...w }, { kind: 'crater', ...k }]);
  const tank = g.spawnUnit('tank', 0, at(4, 10).x, at(4, 10).y);
  assert.equal(g.issue(0, { type: 'attackProp', ids: [tank.id], x: k.x, y: k.y }).ok, false, 'Krater');
  assert.ok(g.issue(0, { type: 'attackProp', ids: [tank.id], x: w.x, y: w.y }).ok);
  run(g, 30);
  assert.equal(g.propSt[0] & 3, PROP_STATE.rubble);
  assert.notEqual(tank.order.type, 'attackProp', 'Auftrag erledigt');
});

test('Nebel: jedes Team sieht Props im zuletzt gesehenen Zustand', () => {
  const p = at(10, 10);
  const g = gameWith([{ kind: 'wall_concrete', ...p }]);
  damageProp(g, 0, PROPS.kinds.wall_concrete.hp + 1);
  g.updateFog();
  const seenNow = (t) => g.propSeen[t][0] & 3;
  const sees = g.fog[0].isVisible(p.x, p.y);
  assert.equal(seenNow(0), sees ? PROP_STATE.rubble : PROP_STATE.ok, 'Team 0 kennt den Zustand nur, wenn es die Stelle sieht');
  g.spawnUnit('scout', 0, p.x - 100, p.y);
  g.updateFog();
  assert.equal(seenNow(0), PROP_STATE.rubble, 'in Sicht: Trümmer bekannt');
  assert.equal(g.propSt[0] & 3, PROP_STATE.rubble);
});
