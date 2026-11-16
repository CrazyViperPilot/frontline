// Eroberung (js/game/conquest.js, PRD §7 „Eroberung“): Viertel-Sperre, Flaggen, Tickets, Flaggen-Spawn, Ausscheiden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { BALANCE } from '../js/data/balance.js';
import { lockedFor, flagAt, quarterAt, eliminate, inSquare } from '../js/game/conquest.js';
import { cityTrainers } from '../js/game/city/query.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { hit, impact } from '../js/game/combat.js';
import { aiRaid, cityAiMemory } from '../js/ai/cityai.js';
import { CITY } from '../js/data/city.js';
import { UNITS } from '../js/data/units.js';

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
  // ohne Stadt: deren Steuern und Erträge würden das Flaggengeld verdecken (Geld-Prüfung unten)
  const g = new Game({ seed: 3, conquest: true, players: 3, city: false });
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
  // Einheiten aus der Zone nehmen: danach kommt das Geld nur noch von der gehaltenen Flagge
  g.units.forEach((u) => {
    if (u.team === 1 && inSquare(g, u.x, u.y)) u.alive = false;
  });
  g.update(0.05); // Aufräumen
  const before = g.teams[1].res.money;
  run(g, 10);
  const gain = g.teams[1].res.money - before;
  const expected = g.conquest.held[1] * Q.flagIncome * 10 * g.teams[1].incomeMult;
  assert.ok(Math.abs(gain - expected) < 0.5, `Flaggengeld in 10 s: ${gain}, erwartet ${expected}`);
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
  const t0 = game.time;
  run(game, 5, ai);
  assert.ok(Math.abs(game.time - t0 - 5) < 0.01, 'der geladene Stand läuft weiter (5 s)');
  assert.equal(game.grid.lockOpen, game.conquest.open, 'Sperre bleibt mit dem Raster verbunden');
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
  assert.equal(g.winner, null, 'nach 12 Minuten läuft die Partie noch (sonst wurde nichts simuliert)');
  assert.ok(g.time >= 719.9, `simulierte Zeit: ${g.time} s`);
  eliminate(g, 3, 'Test');
  run(g, 5, ais);
});

test('Eroberung: Start-Tickets nach Wahl (1000 für lange Partien), Einheitenlimit 500 je Spieler', () => {
  assert.ok(Q.ticketChoices.includes(1000) && Q.ticketChoices.includes(Q.ticketDefault));
  const g = new Game({ seed: 3, conquest: true, players: 4, tickets: 1000 });
  assert.ok(g.teams.every((t) => t.tickets === 1000));
  assert.equal(g.conquest.startTickets, 1000);
  assert.equal(g.slotCap, 500);
  assert.equal(new Game({ seed: 3 }).slotCap, BALANCE.slotCap);
});

test('Eroberung: kein kostenloser Soldaten-Nachschub (klassisch weiter)', () => {
  const lose = (g) => g.units.filter((u) => u.team === 0 && u.def.armor === 'inf').forEach((u) => (u.alive = false));
  const soldiers = (g) => g.soldierCount(0);
  const a = new Game({ seed: 3, conquest: true });
  lose(a);
  run(a, 3 * BALANCE.reinforce.interval);
  assert.equal(soldiers(a), 0);
  const b = new Game({ seed: 3 });
  lose(b);
  run(b, 3 * BALANCE.reinforce.interval);
  assert.ok(soldiers(b) >= 1);
});

/** Die Zone liegt im Spiel als Quadrat; diese Hilfe rechnet den Abstand eines Punkts vom Rand (positiv = außerhalb). */
const outsideEdge = (g, x, y) => Math.max(Math.abs(x - g.zone.x), Math.abs(y - g.zone.y)) - g.zone.half;

test('Eroberung: Hubschrauber mit Ziel im gesperrten Viertel hält an der Grenze und bleibt in der Zone', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const foe = g.map.spawns[1];
  const heli = put(g, 0, 'littlebird', g.zone.x, g.zone.y);
  g.conquest.open[1] = true; // der Befehl wird nur angenommen, solange die Sperre des Ziels offen ist
  assert.equal(g.issue(0, { type: 'move', ids: [heli.id], x: foe.x, y: foe.y }).ok, true);
  g.conquest.open[1] = false;
  run(g, 60);
  assert.equal(quarterAt(g, heli.x, heli.y), -1, 'der Hubschrauber steht in der Konfliktzone');
  assert.ok(heli.alive);
  assert.ok(heli.x > g.zone.x + 1000, 'er ist bis zum Rand vorgeflogen');
  assert.ok(outsideEdge(g, heli.x, heli.y) < 0);
});

test('Eroberung: Granate und Schuss wirken nicht in ein gesperrtes fremdes Viertel, nach dem Fall der Sperre schon', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const z = g.zone;
  const sp = g.map.spawns[1];
  const sx = Math.sign(sp.x - z.x);
  const sy = Math.sign(sp.y - z.y);
  // Opfer: Schütze von Team 1 knapp hinter dem Rand der Zone, also im eigenen (nicht gesperrten) Viertel von Team 1
  const victim = put(g, 1, 'rifleman', z.x + sx * (z.half + 30), z.y + sy * (z.half + 30));
  victim.hp = 1000; // damit alle Treffer in diesem Test überleben
  assert.equal(quarterAt(g, victim.x, victim.y), 1);
  const shell = (tx, ty) => ({ team: 0, tx, ty, splash: 60, alive: true, damage: { inf: 50, light: 50, heavy: 50, struct: 0, air: 50, jet: 50 } });
  // Einschlag in der Zone, am Rand: 45 px vor dem Opfer, Splash 60 px reicht hinüber
  const tx = z.x + sx * (z.half - 15);
  const ty = z.y + sy * (z.half - 15);
  const hp0 = victim.hp;
  impact(g, shell(tx, ty));
  assert.equal(victim.hp, hp0, 'gesperrtes Viertel: die Granate wirkt nicht');
  hit(g, victim, 50, 1, 0);
  assert.equal(victim.hp, hp0, 'Schuss von Team 0 ins gesperrte Viertel: wirkungslos');
  hit(g, victim, 50, 1, 1); // Schütze 1 steht im eigenen Viertel
  assert.ok(victim.hp < hp0, 'Schuss aus dem eigenen Viertel wirkt');
  const hp1 = victim.hp;
  g.conquest.open[1] = true;
  impact(g, shell(tx, ty));
  assert.ok(victim.hp < hp1, 'nach dem Fall der Sperre wirkt die Granate');
  const hp2 = victim.hp;
  hit(g, victim, 50, 1, 0);
  assert.ok(victim.hp < hp2, 'nach dem Fall der Sperre wirkt auch der Schuss von Team 0');
});

test('Eroberung: Prämie bei drei Teams geht an das Team des letzten Treffers', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const target = put(g, 2, 'rifleman', g.zone.x, g.zone.y); // in der Zone: für alle Teams offen
  hit(g, target, 1, 1, 0); // erster Treffer: Team 0
  hit(g, target, 1e6, 1, 1); // letzter Treffer, tödlich: Team 1
  assert.equal(target.alive, false);
  const prize = Math.round(UNITS.rifleman.cost.money * BALANCE.bounty.inf);
  assert.equal(g.teams[1].earned, prize, 'der letzte Treffer kassiert');
  assert.equal(g.teams[0].earned, 0, 'der erste Treffer nicht');
  assert.equal(g.teams[2].earned, 0, 'das Opfer-Team nicht');
});

test('Eroberung: scheidet der Mensch aus, endet die Partie, obwohl zwei KIs noch spielen', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  new AI(g, 1, 'normal');
  new AI(g, 2, 'normal');
  assert.equal(g.teams[0].isAI, false);
  eliminate(g, 0, 'Test');
  assert.equal(g.teams[1].out, false, 'KI Team 1 spielt weiter');
  assert.equal(g.teams[2].out, false, 'KI Team 2 spielt weiter');
  assert.ok(g.winner === 1 || g.winner === 2, `Sieger ist eine KI: ${g.winner}`);
  assert.equal(g.winReason, 'tickets');
});

test('Eroberung: Kommandeur fällt bei 1 Ticket, das Team scheidet aus, obwohl es die meisten Flaggen hält', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const cmd = g.units.find((u) => u.team === 0 && u.def.hero);
  assert.ok(cmd, 'die Startarmee hat einen Kommandeur');
  for (const i of [0, 1, 2]) g.conquest.flags[i].owner = 0;
  g.update(0.05);
  assert.equal(g.conquest.held[0], 3);
  g.teams[0].tickets = 1;
  hit(g, cmd, 1e6); // tödlich; ohne Schützen-Team, also nie durch die Sperre gebremst (der Kommandeur heilt sich sonst am Aufräum-Schritt)
  g.update(0.05);
  assert.equal(g.teams[0].out, true, 'Team 0 ist ausgeschieden');
  assert.ok(g.teams[0].tickets <= 0, `keine Tickets mehr (${g.teams[0].tickets})`);
  assert.equal(g.conquest.flags.filter((f) => f.owner === 0).length, 0, 'seine Flaggen sind neutral');
  assert.equal(g.winner, null, 'zwei Teams spielen weiter');
});

test('Eroberung: bei Gleichstand an der Spitze verlieren die Führenden keine Tickets, das Team ohne Flagge schon; ohne jede Flagge verliert niemand', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const start = g.teams[0].tickets;
  g.conquest.flags[0].owner = 0;
  g.conquest.flags[1].owner = 0;
  g.conquest.flags[2].owner = 1;
  g.conquest.flags[3].owner = 1;
  run(g, 25); // zwei Takte à 10 s
  assert.deepEqual(g.conquest.held, [2, 2, 0]);
  assert.equal(g.teams[0].tickets, start, 'Gleichstand: Team 0 verliert nichts');
  assert.equal(g.teams[1].tickets, start, 'Gleichstand: Team 1 verliert nichts');
  assert.equal(g.teams[2].tickets, start - 2 * 2, 'ohne Flagge: 2 Tickets je Takt');
  const none = new Game({ seed: 3, conquest: true, players: 3 });
  run(none, 30);
  assert.ok(none.teams.every((t) => t.tickets === start), 'ohne jede Flagge verliert niemand Tickets');
});

test('Eroberung: Einnahmetempo wächst mit dem Vorsprung und ist bei capMaxMul gedeckelt (1, 2, 3, 6 Schützen)', () => {
  const captureSecs = (n) => {
    const g = new Game({ seed: 3, conquest: true, players: 3 });
    const f = g.conquest.flags[5];
    for (let i = 0; i < n; i++) put(g, 0, 'rifleman', f.x + i * 20, f.y + 40);
    let steps = 0;
    while (f.owner !== 0 && steps < 20 * 60) {
      g.update(0.05);
      steps++;
    }
    assert.equal(f.owner, 0, `mit ${n} Schützen wird die Flagge eingenommen`);
    return steps * 0.05;
  };
  const t1 = captureSecs(1);
  const t2 = captureSecs(2);
  const t3 = captureSecs(3);
  const t6 = captureSecs(6);
  assert.ok(Math.abs(t1 - Q.capTime) < 0.5, `1 Schütze: ${t1} s, erwartet ${Q.capTime} s`);
  assert.ok(Math.abs(t2 - Q.capTime / 2) < 0.5, `2 Schützen: ${t2} s, erwartet ${Q.capTime / 2} s`);
  assert.ok(Math.abs(t3 - Q.capTime / Q.capMaxMul) < 0.5, `3 Schützen: ${t3} s, erwartet ${Q.capTime / Q.capMaxMul} s`);
  assert.ok(Math.abs(t6 - t3) < 0.1, `6 Schützen nicht schneller als 3 (Deckel): ${t6} s gegen ${t3} s`);
});

test('Eroberung: Spielstand behält Sperren, Zähler, Flaggen, Tickets und Flaggen-Spawn; danach läuft die Partie gleich', () => {
  const g = new Game({ seed: 5, conquest: true, players: 3 });
  const cq = g.conquest;
  cq.open[2] = true;
  cq.noFlag[1] = 42;
  cq.flags[3].owner = 2;
  cq.flags[7].owner = 0;
  g.teams[1].tickets = 77;
  const b = cityTrainers(g, 0)[0];
  b.spawnFlag = 7;
  run(g, 1);
  const { game: h } = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g, []))));
  const hq = h.conquest;
  assert.deepEqual(hq.open, cq.open, 'Sperren');
  assert.deepEqual(hq.noFlag, cq.noFlag, 'Zähler ohne Flagge');
  assert.deepEqual(hq.held, cq.held, 'gehaltene Flaggen');
  assert.equal(hq.timer, cq.timer, 'Ticket-Takt');
  assert.deepEqual(hq.flags.map((f) => f.owner), cq.flags.map((f) => f.owner), 'Flaggenbesitzer');
  assert.deepEqual(h.teams.map((t) => t.tickets), g.teams.map((t) => t.tickets), 'Tickets');
  assert.equal(h.getEntity(b.id).spawnFlag, 7, 'Flaggen-Spawn des Gebäudes');
  run(g, 15);
  run(h, 15);
  assert.deepEqual(h.teams.map((t) => t.tickets), g.teams.map((t) => t.tickets), 'gleiche Tickets nach 15 s');
  assert.deepEqual(h.conquest.held, g.conquest.held, 'gleiche Flaggen nach 15 s');
  assert.deepEqual(h.conquest.open, g.conquest.open, 'gleiche Sperren nach 15 s');
});

/** Erreicht `team` die Konfliktzone über Zellen, die für das Team begehbar sind (grid.passable)? Start: Ring um die Hauptstadt. */
function zoneReachable(g, team) {
  const G = g.grid;
  const m = g.mainFob(team);
  const seen = new Uint8Array(G.cols * G.rows);
  const queue = []; // Paare (Spalte, Zeile)
  const visit = (c, r) => {
    if (!G.inBounds(c, r) || !G.passable(c, r, team)) return;
    const i = G.idx(c, r);
    if (seen[i]) return;
    seen[i] = 1;
    queue.push(c, r);
  };
  // Ausgang: begehbare Zellen rund um die Hauptstadt (das Gebäude selbst ist für das eigene Team gesperrt)
  for (let r = m.cy - 1; r <= m.cy + m.h; r++) for (let c = m.cx - 1; c <= m.cx + m.w; c++) visit(c, r);
  for (let k = 0; k < queue.length; k += 2) {
    const c = queue[k];
    const r = queue[k + 1];
    if (inSquare(g, G.center(c), G.center(r))) return true;
    visit(c + 1, r);
    visit(c - 1, r);
    visit(c, r + 1);
    visit(c, r - 1);
  }
  return false;
}

test('Eroberung: jede Startecke erreicht die Zone über begehbare Zellen; keine Versorgungskiste liegt in der Zone (3 und 4 Spieler, Karten 3 und 11, mit und ohne Fluss)', () => {
  for (const players of [3, 4]) {
    for (const seed of [3, 11]) {
      for (const river of [false, true]) {
        const g = new Game({ seed, conquest: true, players, river });
        const where = `(${players} Spieler, Karte ${seed}, Fluss ${river})`;
        for (const t of g.teams) assert.ok(zoneReachable(g, t.id), `Team ${t.id} erreicht die Zone nicht ${where}`);
        const inZone = (g.map.crates ?? []).filter((c) => inSquare(g, c.x, c.y));
        assert.equal(inZone.length, 0, `Versorgungskisten in der Zone ${where}`);
      }
    }
  }
});

test('Eroberung: die Stadt-KI greift nur eine Stadt an, deren Viertel offen ist', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  g.fog.forEach((f) => f.revealAll()); // Ziele müssen erkundet sein
  const m = g.mainFob(0);
  for (let i = 0; i < 4; i++) put(g, 0, 'tank', m.x + 250 + i * 40, m.y);
  const sent = [];
  const issue = g.issue.bind(g);
  g.issue = (team, cmd) => {
    if (cmd.type === 'attackMove') sent.push({ team, cmd });
    return issue(team, cmd);
  };
  const every = CITY.ai.raidEvery.hard;
  g.conquest.open[1] = false; // Viertel von Team 1 gesperrt
  g.conquest.open[2] = true; // Viertel von Team 2 offen
  aiRaid(g, 0, 'hard', every, cityAiMemory());
  assert.equal(sent.length, 1, 'ein Angriff');
  assert.equal(sent[0].team, 0);
  assert.equal(quarterAt(g, sent[0].cmd.x, sent[0].cmd.y), 2, 'das Ziel liegt im offenen Viertel von Team 2');
  sent.length = 0;
  g.conquest.open[2] = false; // jetzt ist kein Viertel offen
  aiRaid(g, 0, 'hard', every, cityAiMemory());
  assert.equal(sent.length, 0, 'ohne offene Sperre kein Angriff');
});

test('Eroberung mit 4 Teams: aiRaid wählt nur ein feindliches, lebendes Team (nächste offene Hauptstadt), auch nach einem Ausscheiden', () => {
  const g = new Game({ seed: 3, conquest: true, players: 4 });
  g.fog.forEach((f) => f.revealAll());
  const m = g.mainFob(0);
  for (let i = 0; i < 4; i++) put(g, 0, 'tank', m.x + 250 + i * 40, m.y);
  const sent = [];
  const issue = g.issue.bind(g);
  g.issue = (team, cmd) => {
    if (cmd.type === 'attackMove') sent.push({ team, cmd });
    return issue(team, cmd);
  };
  const every = CITY.ai.raidEvery.hard;
  for (const t of [1, 2, 3]) g.conquest.open[t] = true;
  const dist = (t) => Math.hypot(g.mainFob(t).x - m.x, g.mainFob(t).y - m.y);
  const order = [1, 2, 3].sort((a, b) => dist(a) - dist(b) || a - b);
  aiRaid(g, 0, 'hard', every, cityAiMemory());
  assert.equal(sent.length, 1, 'ein Angriff');
  assert.equal(quarterAt(g, sent[0].cmd.x, sent[0].cmd.y), order[0], 'Ziel in der nächsten offenen Stadt');
  // das nächste Team scheidet aus: kein Fehler, Ziel ist jetzt das nächste lebende
  eliminate(g, order[0], 'Test');
  for (const u of g.units) if (u.team === 0) u.order = { type: 'idle' };
  sent.length = 0;
  assert.doesNotThrow(() => aiRaid(g, 0, 'hard', every, cityAiMemory()));
  assert.equal(sent.length, 1, 'wieder ein Angriff');
  const q = quarterAt(g, sent[0].cmd.x, sent[0].cmd.y);
  assert.equal(q, order[1], 'Ziel im Viertel des nächsten lebenden Gegners');
  assert.ok(!g.teams[q].out && q !== 0, 'Ziel feindlich und lebend');
});

test('Eroberung: umkämpfte eigene Flagge: die neue Einheit erscheint am Gebäude, nicht im Gebiet', () => {
  const g = new Game({ seed: 3, conquest: true, players: 2 });
  g.teams[0].res.money = 1e6;
  g.city[0].popF += 50; // freie Einwohner für die Ausbildung
  const f = g.conquest.flags[10];
  f.owner = 0;
  f.capTeam = 0;
  f.p = 1;
  const b = cityTrainers(g, 0).find((e) => e.produces.includes('rifleman'));
  assert.equal(g.issue(0, { type: 'spawnAt', buildingId: b.id, flag: f.id }).ok, true);
  // Gleich viele Schützen beider Seiten im Gebiet: umkämpft, aber der Balken steht still; hp hoch, damit sich das Gleichgewicht nicht ändert
  for (let i = 0; i < 3; i++) {
    put(g, 0, 'rifleman', f.x + i * 20, f.y).hp = 1e6;
    put(g, 1, 'rifleman', f.x + i * 20, f.y + 30).hp = 1e6;
  }
  g.update(0.05);
  assert.ok(f.contested, 'Gegner im Gebiet macht die Flagge umkämpft');
  assert.equal(g.issue(0, { type: 'train', buildingId: b.id, unit: 'rifleman' }).ok, true);
  const ids = new Set(g.units.map((u) => u.id));
  let fresh = null;
  for (let i = 0; i < 20 * 120 && !fresh; i++) {
    g.update(0.05);
    fresh = g.units.find((u) => !ids.has(u.id) && u.team === 0 && u.type === 'rifleman') ?? null;
  }
  assert.ok(fresh, 'die Einheit ist ausgebildet');
  assert.notEqual(flagAt(g, fresh.x, fresh.y), f, 'sie steht nicht im umkämpften Gebiet');
  assert.ok(Math.hypot(fresh.x - b.x, fresh.y - b.y) < Math.hypot(fresh.x - f.x, fresh.y - f.y), 'sie steht am Gebäude');
  assert.equal(f.owner, 0, 'die Flagge bleibt in der Hand von Team 0');
});

test('Eroberung: eliminate() räumt ein Team ab: Einheiten und Gebäude weg, Flaggen neutral (p = 0), Viertel offen, Tickets 0; die anderen spielen weiter', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  const f0 = g.conquest.flags[0];
  const f1 = g.conquest.flags[1];
  f0.owner = 1;
  f0.capTeam = 1;
  f0.p = 0.5;
  f1.owner = 1;
  eliminate(g, 1, 'Test');
  g.update(0.05);
  assert.equal(g.units.filter((u) => u.team === 1 && u.alive).length, 0, 'keine Einheiten mehr');
  assert.equal(g.buildings.filter((b) => b.team === 1 && b.alive).length, 0, 'keine Gebäude mehr');
  assert.equal(g.conquest.flags.filter((f) => f.owner === 1 || f.capTeam === 1).length, 0, 'keine Flagge gehört ihm oder läuft für ihn');
  assert.equal(f0.p, 0);
  assert.equal(g.conquest.open[1], true, 'sein Viertel ist offen');
  assert.equal(g.teams[1].tickets, 0);
  assert.equal(g.teams[1].out, true);
  assert.equal(g.winner, null, 'zwei Teams spielen weiter');
  run(g, 5);
  assert.equal(g.winner, null);
  assert.ok(!g.teams[0].out && !g.teams[2].out);
});

test('Eroberung: Stadt baut nur im eigenen Viertel, auch ohne Baugebiet-Regel', () => {
  const g = new Game({ seed: 3, conquest: true, players: 3 });
  assert.equal(g.buildRules, false, 'die Baugebiet-Regel ist aus');
  const c = g.city[0];
  const cellAt = (x, y) => ({ col: Math.floor((x - c.x0) / c.cell), r: Math.floor((y - c.y0) / c.cell) });
  const build = (col, r) => g.issue(0, { type: 'city', kind: 'res', c0: col, r0: r, c1: col, r1: r });
  // Zelle in der Konfliktzone
  const inZ = cellAt(g.zone.x, g.zone.y);
  assert.equal(c.inZone[inZ.r * c.cols + inZ.col], 1);
  const zr = build(inZ.col, inZ.r);
  assert.equal(zr.ok, false, 'in der Konfliktzone wird nicht gebaut');
  // Zelle im Viertel von Team 1: frei (nicht belegt, nicht gesperrt), nahe dem Startpunkt von Team 1
  const near = cellAt(g.map.spawns[1].x, g.map.spawns[1].y);
  let foe = null;
  for (let d = 0; d < 40 && !foe; d++) {
    for (let dr = -d; dr <= d && !foe; dr++) {
      for (let dc = -d; dc <= d && !foe; dc++) {
        const col = near.col + dc;
        const r = near.r + dr;
        if (col < 0 || r < 0 || col >= c.cols || r >= c.rows) continue;
        const i = r * c.cols + col;
        if (!c.own[i] && !c.inZone[i] && !c.blocked[i] && !c.kind[i] && quarterAt(g, (col + 0.5) * c.cell, (r + 0.5) * c.cell) === 1) foe = { col, r };
      }
    }
  }
  assert.ok(foe, 'es gibt eine freie Zelle im Viertel von Team 1');
  const fr = build(foe.col, foe.r);
  assert.equal(fr.ok, false, 'im fremden Viertel wird nicht gebaut');
  assert.match(fr.reason, /eigenen Gebiet/, 'mit dem Grund „nur im eigenen Gebiet“');
  // Zelle im eigenen Viertel nahe der Hauptstadt: kein Grund „Viertel“
  const main = cellAt(g.mainFob(0).x, g.mainFob(0).y);
  let own = null;
  for (let d = 2; d < 20 && !own; d++) {
    for (let dr = -d; dr <= d && !own; dr++) {
      for (let dc = -d; dc <= d && !own; dc++) {
        const col = main.col + dc;
        const r = main.r + dr;
        if (col < 0 || r < 0 || col >= c.cols || r >= c.rows) continue;
        const i = r * c.cols + col;
        if (c.own[i] && !c.blocked[i] && !c.kind[i]) own = { col, r };
      }
    }
  }
  assert.ok(own, 'es gibt eine freie eigene Zelle nahe der Hauptstadt');
  const ok = build(own.col, own.r);
  assert.equal(ok.ok, true, `eigene Zelle nahe der Hauptstadt: ${ok.reason ?? 'ok'}`);
});

test('Eroberung: zu zweit sind die zwei Viertel ohne Startpunkt für beide Teams gesperrt', () => {
  const g = new Game({ seed: 3, conquest: true, players: 2 });
  const z = g.zone;
  const closed = [0, 1, 2, 3].filter((q) => g.conquest.quad[q] === 9); // 9 = Viertel ohne Spieler
  assert.equal(closed.length, 2);
  for (const q of closed) {
    const x = z.x + (q & 1 ? 1 : -1) * (z.half + 300);
    const y = z.y + (q & 2 ? 1 : -1) * (z.half + 300);
    assert.equal(quarterAt(g, x, y), 9, `Viertel ${q} ohne Spieler`);
    assert.ok(lockedFor(g, 0, x, y), 'für Team 0 gesperrt');
    assert.ok(lockedFor(g, 1, x, y), 'für Team 1 gesperrt');
  }
});

test('Eroberung: foeSpawn liegt je Team auf der gegenüberliegenden Seite der Zone', () => {
  const g = new Game({ seed: 3, conquest: true, players: 4 });
  const z = g.zone;
  for (const t of g.teams) {
    const sp = g.map.spawns[t.id];
    const foe = g.foeSpawn(t.id);
    assert.ok(!(foe.x === z.x && foe.y === z.y), `Team ${t.id}: nicht die Zonenmitte`);
    assert.equal(Math.sign(foe.x - z.x), -Math.sign(sp.x - z.x), `Team ${t.id}: Seite in x gegenüber`);
    assert.equal(Math.sign(foe.y - z.y), -Math.sign(sp.y - z.y), `Team ${t.id}: Seite in y gegenüber`);
    assert.equal(foe.x + sp.x, 2 * z.x, 'durch die Zonenmitte gespiegelt');
    assert.equal(foe.y + sp.y, 2 * z.y, 'durch die Zonenmitte gespiegelt');
  }
});
