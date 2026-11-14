// Eroberung (js/game/conquest.js, PRD §7 „Eroberung“): Viertel-Sperre, Flaggen, Tickets, Flaggen-Spawn, Ausscheiden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { BALANCE } from '../js/data/balance.js';
import { lockedFor, flagAt, quarterAt, eliminate } from '../js/game/conquest.js';
import { cityTrainers } from '../js/game/city/query.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';

const Q = BALANCE.conquest;
const run = (g, secs, ais = []) => {
  for (let i = 0; i < secs * 20 && g.winner === null; i++) {
    g.update(0.05);
    for (const a of ais) a.update(0.05);
  }
};
/** Einheit des Teams an einen Punkt stellen (Testhilfe). */
const put = (g, team, type, x, y) => g.spawnUnit(type, team, x, y);

test('Eroberung: ohne Angabe aus; mit Angabe 2 bis 4 Teams, 16 Flaggen A bis P, Tickets, Viertel je Startecke', () => {
  assert.equal(new Game({ seed: 3 }).conquest, null);
  for (const players of [2, 3, 4]) {
    const g = new Game({ seed: 3, conquest: true, players, winPoints: 50 });
    assert.equal(g.teams.length, players);
    assert.equal(g.city.length, players);
    assert.equal(g.conquest.flags.length, Q.grid * Q.grid);
    assert.equal(g.conquest.flags.map((f) => f.letter).join(''), 'ABCDEFGHIJKLMNOP');
    for (const t of g.teams) {
      assert.equal(t.tickets, 50 * Q.ticketMul);
      const sp = g.map.spawns[t.id];
      assert.equal(quarterAt(g, sp.x, sp.y), t.id, 'Startpunkt liegt im eigenen Viertel');
      assert.ok(g.mainFob(t.id), 'jedes Team hat eine Hauptstadt');
    }
    assert.equal(quarterAt(g, g.zone.x, g.zone.y), -1);
  }
});

test('Eroberung: Zufallskarte mit 2 Spielern ist dieselbe wie ohne Eroberung (Regel 4)', () => {
  const a = new Game({ seed: 11 }).map;
  const b = new Game({ seed: 11, conquest: true }).map;
  assert.deepEqual(b.obstacles, a.obstacles);
  assert.deepEqual(b.spawns, a.spawns);
});

test('Eroberung: fremdes Viertel ist gesperrt (kein Marsch, kein Weg, kein Schaden), das Aufklärungsflugzeug darf hinein', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const foe = g.map.spawns[1];
  const tank = g.units.find((u) => u.team === 0 && u.type === 'tank');
  assert.equal(g.issue(0, { type: 'move', ids: [tank.id], x: foe.x, y: foe.y }).ok, false);
  assert.ok(lockedFor(g, 0, foe.x, foe.y));
  assert.ok(!lockedFor(g, 1, foe.x, foe.y));
  assert.ok(lockedFor(g, 0, BALANCE.map.width - 200, BALANCE.map.height - 200), 'Viertel ohne Spieler ist für alle gesperrt');
  assert.ok(!g.grid.passable(g.grid.toCell(foe.x + 300), g.grid.toCell(foe.y + 300), 0));
  // Angriffsbefehl auf ein Ziel im gesperrten Viertel wird abgelehnt, Beschuss wirkt nicht
  const victim = g.units.find((u) => u.team === 1 && u.type === 'tank');
  assert.equal(g.issue(0, { type: 'attack', ids: [tank.id], targetId: victim.id }).ok, false);
  const u2 = put(g, 0, 'u2', g.zone.x, g.zone.y);
  assert.equal(g.issue(0, { type: 'move', ids: [u2.id], x: foe.x, y: foe.y }).ok, true, 'U-2 darf über fremde Viertel');
  // Sperre gefallen: dasselbe Ziel ist erlaubt
  g.conquest.open[1] = true;
  assert.equal(g.issue(0, { type: 'attack', ids: [tank.id], targetId: victim.id }).ok, true);
});

test('Eroberung: Mehrheit im Gebiet nimmt die Flagge ein (erst neutral, dann eigene Farbe), Flaggen bringen Geld', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const f = g.conquest.flags[5];
  for (let i = 0; i < 3; i++) put(g, 0, 'rifleman', f.x + i * 20, f.y + 40);
  assert.equal(flagAt(g, f.x, f.y), f);
  run(g, Q.capTime / Q.capMaxMul + 2);
  assert.equal(f.owner, 0);
  assert.equal(g.conquest.held[0], 1);
  // Gegner in Überzahl: erst neutral, dann seine
  for (let i = 0; i < 5; i++) put(g, 1, 'rifleman', f.x - 600 + i * 20, f.y - 500);
  g.units.filter((u) => u.team === 0 && flagAt(g, u.x, u.y) === f).forEach((u) => (u.alive = false));
  run(g, 2);
  assert.ok(f.contested, 'Gegner im Gebiet: umkämpft');
  run(g, Q.capTime / Q.capMaxMul + 1);
  assert.equal(f.owner, -1, 'zuerst neutral');
  run(g, Q.capTime / Q.capMaxMul + 2);
  assert.equal(f.owner, 1);
  const before = g.teams[1].res.money;
  run(g, 10);
  assert.ok(g.teams[1].res.money - before >= 10 * Q.flagIncome, 'Flaggengeld');
});

test('Eroberung: wer weniger Flaggen hält als der Führende, verliert Tickets; ohne Tickets scheidet er aus; der Letzte gewinnt', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3, winPoints: 25 });
  const f = g.conquest.flags[0];
  for (let i = 0; i < 3; i++) put(g, 2, 'rifleman', f.x + i * 20, f.y);
  run(g, 60);
  assert.equal(g.teams[2].tickets, 25 * Q.ticketMul, 'der Führende verliert nichts');
  assert.ok(g.teams[0].tickets < 25 * Q.ticketMul);
  g.teams[0].tickets = 1;
  g.teams[1].tickets = 1;
  run(g, 2 * Q.tickEvery + 1);
  assert.ok(g.teams[0].out && g.teams[1].out);
  assert.equal(g.units.filter((u) => u.team === 0).length, 0, 'Einheiten des Ausgeschiedenen sind weg');
  assert.equal(g.winner, 2);
  assert.equal(g.winReason, 'tickets');
});

test('Eroberung: lockGrace ohne Flagge öffnet das eigene Viertel; fällt dann die Hauptstadt, scheidet das Team aus', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3, winPoints: 100 });
  const f = g.conquest.flags[0];
  for (let i = 0; i < 3; i++) put(g, 2, 'rifleman', f.x + i * 20, f.y);
  run(g, Q.lockGrace + Q.capTime + 5);
  assert.ok(g.conquest.open[0] && g.conquest.open[1], 'Viertel ohne Flagge sind offen');
  assert.ok(!g.conquest.open[2]);
  assert.ok(!lockedFor(g, 2, g.map.spawns[0].x, g.map.spawns[0].y));
  g.mainFob(0).hp = 0;
  run(g, 1);
  assert.ok(g.teams[0].out);
  assert.equal(g.winner, null, 'zwei Teams spielen weiter');
});

test('Eroberung: spawnAt lässt Bodeneinheiten an einer eigenen, unbestrittenen Flagge erscheinen, sonst am Gebäude', () => {
  const g = new Game({ seed: 3, conquest: true, players: 2 });
  g.teams[0].res.money = 1e6;
  g.city[0].popF += 50; // freie Einwohner für die Ausbildung
  const f = g.conquest.flags[10];
  const b = cityTrainers(g, 0).find((e) => e.produces.includes('rifleman'));
  assert.equal(g.issue(0, { type: 'spawnAt', buildingId: b.id, flag: f.id }).ok, false, 'fremde Flagge');
  f.owner = 0;
  f.capTeam = 0;
  f.p = 1;
  assert.equal(g.issue(0, { type: 'spawnAt', buildingId: b.id, flag: f.id }).ok, true);
  assert.equal(g.issue(0, { type: 'train', buildingId: b.id, unit: 'rifleman' }).ok, true);
  const ids = new Set(g.units.map((u) => u.id));
  run(g, 120);
  const fresh = g.units.filter((u) => !ids.has(u.id) && u.team === 0 && u.type === 'rifleman' && flagAt(g, u.x, u.y) === f);
  assert.ok(fresh.length >= 1, 'neuer Schütze steht im Gebiet der Flagge');
  assert.equal(g.issue(0, { type: 'spawnAt', buildingId: b.id, flag: null }).ok, true);
  assert.equal(b.spawnFlag, null);
});

test('Eroberung: Spielstand mit 3 Teams und mehreren KIs lädt mit Sperre und Flaggen', () => {
  const g = new Game({ seed: 5, conquest: true, players: 3 });
  const ais = [new AI(g, 1, 'easy'), new AI(g, 2, 'hard')];
  run(g, 20, ais);
  g.conquest.flags[3].owner = 2;
  const { game, ai } = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g, ais))));
  assert.equal(ai.length, 2);
  assert.equal(game.teams.length, 3);
  assert.equal(game.conquest.flags[3].owner, 2);
  assert.ok(game.grid.lock, 'Sperre hängt wieder im Raster');
  assert.equal(game.grid.lockOpen, game.conquest.open);
  run(game, 5, ai);
});

test('Eroberung [langsam]: 4 KIs spielen 12 Minuten ohne Ausnahme, alle nehmen Flaggen ein, niemand steht im fremden Viertel', () => {
  const g = new Game({ seed: 3, conquest: true, players: 4, river: true, research: true, winPoints: 100 });
  const ais = g.teams.map((t, i) => new AI(g, t.id, ['hard', 'normal', 'hard', 'easy'][i]));
  let peak = g.teams.map(() => 0);
  for (let m = 0; m < 12; m++) {
    run(g, 60, ais);
    peak = peak.map((p, i) => Math.max(p, g.conquest.held[i]));
    for (const u of g.units) {
      if (!u.alive || u.def.jet) continue;
      assert.ok(!lockedFor(g, u.team, u.x, u.y), `${u.type} von Team ${u.team} steht im gesperrten Viertel`);
    }
  }
  assert.ok(peak.every((p) => p >= 1), `jede KI hielt eine Flagge: ${peak}`);
  eliminate(g, 3, 'Test');
  run(g, 5, ais);
});
