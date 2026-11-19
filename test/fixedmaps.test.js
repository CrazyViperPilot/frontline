// Feste Karten (Paket „Feste Karten“, docs/prd/feste-karten.md): Register, Kartenformat mit 2 bis 4 Startpunkten, eigene Flaggen
// mit rundem Gebiet, Baugebiete an den Kartenseiten; die Karte „East Europe Railway“ in Eroberung (2 bis 4 Spieler) und klassisch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { BALANCE } from '../js/data/balance.js';
import { listFixedMaps, isFixedMap, loadMap, normalizeMap, checkMap, checkFlags, createEmptyMap } from '../js/game/mapdata.js';
import { flagAt, quarterAt, lockedFor, flagLabel } from '../js/game/conquest.js';
import { sideOf } from '../js/game/zonegeo.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';

const Q = BALANCE.conquest;
const W = BALANCE.map.width;
const EER = 'fest:east-europe-railway';
const run = (g, secs) => {
  for (let i = 0; i < secs * 20 && g.winner === null; i++) g.update(0.05);
};

test('Feste Karten: Register mit East Europe Railway, Laden liefert eine frische, spielbare Karte', () => {
  const list = listFixedMaps();
  assert.ok(list.some((m) => m.id === EER));
  for (const m of list) {
    assert.ok(m.id.startsWith('fest:'), 'IDs fester Karten beginnen mit „fest:“');
    assert.ok(isFixedMap(m.id));
    const map = loadMap(m.id);
    assert.equal(map.name, m.name);
    assert.deepEqual(checkMap(map), [], `${m.name} ist spielbar`);
    assert.notEqual(loadMap(m.id), map, 'jedes Laden eine eigene Kopie (die Partie darf die Karte nicht teilen)');
  }
  assert.ok(!isFixedMap('random'));
});

test('East Europe Railway: 7 Flaggen A bis G, 4 Startpunkte an den Seiten, Bahn mit Eisenbahnbrücke, Fabrikhalle, Strommasten', () => {
  const map = loadMap(EER);
  assert.equal(map.flags.length, 7);
  assert.equal(map.spawns.length, 4);
  assert.equal(map.layout, 'sides');
  assert.deepEqual(map.spawns.map((s) => sideOf(map.zone, s.x, s.y)), [2, 0, 3, 1], 'Blau unten, Rot oben, Grün links, Gelb rechts');
  assert.ok(map.bridges.some((b) => b.rail), 'Eisenbahnbrücke');
  assert.ok(map.town.rails.length > 0);
  assert.equal(map.town.buildings.filter((b) => b.kind === 'plant').length, 1, 'große Fabrikhalle');
  assert.ok(map.town.buildings.filter((b) => b.kind === 'pylon').length >= 20, 'Strommasten');
  assert.deepEqual(checkFlags(map), []);
});

test('Kartenformat: 2 bis 4 Startpunkte, Flaggen mit Halbmesser in den Grenzen, Layout nur „sides“', () => {
  const m = createEmptyMap();
  assert.throws(() => normalizeMap({ ...m, spawns: [m.spawns[0]] }));
  assert.throws(() => normalizeMap({ ...m, spawns: [...m.spawns, ...m.spawns, m.spawns[0]] }));
  const n = normalizeMap({ ...m, spawns: [...m.spawns, { x: 700, y: 700 }], flags: [{ x: 5536, y: 5536, r: 5 }, { x: 4000, y: 4000 }], layout: 'quer' });
  assert.equal(n.spawns.length, 3);
  assert.equal(n.flags[0].r, Q.mapFlagRange[0], 'Halbmesser auf die Grenze gehoben');
  assert.equal(n.flags[1].r, Q.mapFlagR, 'ohne Angabe der Vorgabewert');
  assert.equal(n.layout, undefined, 'unbekanntes Layout entfällt (Ecken)');
  assert.equal(normalizeMap(m).flags, undefined, 'ohne Flaggen kein Feld (Raster)');
  // Prüfung: Gebiet außerhalb der Zone und überlappende Gebiete
  const bad = normalizeMap({ ...m, flags: [{ x: 5536 + Q.half - 100, y: 5536 }, { x: 5536, y: 5536 }, { x: 5636, y: 5536 }] });
  const p = checkFlags(bad);
  assert.ok(p.some((s) => /ragt aus der Konfliktzone/.test(s)));
  assert.ok(p.some((s) => /zu nah beieinander/.test(s)));
});

test('Eroberung auf East Europe Railway: 4 Spieler, Viertel an den Seiten, runde Flaggengebiete', () => {
  const g = new Game({ seed: 5, map: loadMap(EER), conquest: true, players: 4 });
  const cq = g.conquest;
  assert.ok(cq.round && cq.sides);
  assert.equal(cq.flags.map((f) => f.letter).join(''), 'ABCDEFG');
  assert.equal(flagLabel(cq.flags[0]), 'A (Gehöft)');
  for (const t of g.teams) {
    const sp = g.map.spawns[t.id];
    assert.equal(quarterAt(g, sp.x, sp.y), t.id, `${t.name}: Startpunkt im eigenen Baugebiet`);
    assert.ok(g.mainFob(t.id));
    assert.ok(g.city[t.id].own.some((v) => v), 'Stadt hat Bauland');
  }
  // Seiten statt Ecken: dicht am oberen Rand neben der Ecke ist noch Rot (oben), am linken Rand Grün
  assert.equal(quarterAt(g, 1500, 300), 1);
  assert.equal(quarterAt(g, 300, 1500), 2);
  assert.ok(lockedFor(g, 0, 1500, 300), 'Blau darf nicht zu Rot');
  // Flaggengebiet: Kreis um den Mast; daneben (in der Zone) kein Gebiet
  const f = cq.flags[3];
  assert.equal(flagAt(g, f.x + f.r - 5, f.y), f);
  assert.equal(flagAt(g, f.x + f.r + 5, f.y + f.r + 5), null);
  assert.equal(quarterAt(g, f.x + f.r + 5, f.y + f.r + 5), -1, 'zwischen den Flaggen liegt die Zone');
});

test('Eroberung auf fester Karte: Einnahme im Kreis, Zonengeld auch zwischen den Flaggen, Spielstand behält Flaggen', () => {
  const g = new Game({ seed: 5, map: loadMap(EER), conquest: true, players: 2 });
  const f = g.conquest.flags[6]; // G Steinbruch, vor Blau
  for (let i = 0; i < 4; i++) g.spawnUnit('rifleman', 0, f.x + 60 + i * 20, f.y + 120);
  run(g, 30);
  assert.equal(f.owner, 0, 'Blau nimmt die Flagge ein');
  // eine Einheit in der Zone, aber in keinem Flaggengebiet, zählt fürs Zonengeld
  const z = g.zone;
  const x = z.x + 900;
  const y = z.y + 1500;
  assert.equal(flagAt(g, x, y), null);
  g.spawnUnit('rifleman', 1, x, y);
  run(g, 1);
  assert.ok(g.zone.counts[1] >= 1);
  const { game: h } = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g, []))));
  assert.ok(h.conquest.round && h.conquest.sides);
  assert.equal(h.conquest.flags[6].owner, 0);
  assert.equal(h.conquest.flags[6].r, f.r);
  assert.equal(quarterAt(h, 1500, 300), 1);
});

test('Klassisch auf East Europe Railway: zwei Teams an den ersten beiden Startpunkten, runde Zone', () => {
  const g = new Game({ seed: 5, map: loadMap(EER) });
  assert.equal(g.conquest, null);
  assert.equal(g.teams.length, 2);
  assert.ok(g.zone.r > 0 && !g.zone.half);
  run(g, 5);
  assert.equal(g.winner, null);
});

test('Zufallskarten bleiben unverändert ohne eigene Flaggen und Seitenlayout (Regel 4)', () => {
  const g = new Game({ seed: 3, conquest: true, players: 4 });
  assert.ok(!g.conquest.round && !g.conquest.sides);
  assert.equal(g.conquest.flags.length, Q.grid * Q.grid);
  assert.equal(g.map.flags, undefined);
  assert.ok(W > 0);
});
