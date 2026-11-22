import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { trainer, noCrew } from './util.js';
import { BALANCE } from '../js/data/balance.js';
import { UNITS } from '../js/data/units.js';

BALANCE.slotCap = 1000; // diese Tests prüfen nicht das Einheitenlimit (siehe economy.test.js)
const DT = 0.05;
const mk = (opts) => new Game({ ...opts });
function run(game, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) game.update(DT);
}
/** Szene weit weg von der Basis: Scharfschütze (Team 0) bei (x, y), Gegner (Team 1) in Abstand dx. */
function scene(seed = 7) {
  const g = mk({ seed });
  for (const u of g.units) u.alive = false; // Startarmeen weg
  const z = g.zone;
  return { g, x: z.x + 1500, y: z.y };
}

test('Scharfschütze: in der Kaserne ausbildbar (Taste T), kostet Geld, lange Nachladezeit', () => {
  assert.ok(UNITS.sniper);
  assert.equal(UNITS.sniper.hotkey, 'T');
  assert.equal(UNITS.sniper.cost.money, 220);
  assert.equal(UNITS.sniper.weapons[0].cooldown, 8);
  const g = mk({ seed: 7 });
  const kas = trainer(g, 'sniper');
  assert.ok(kas, 'Kaserne bildet Scharfschützen aus');
  g.teams[0].res.money = 1000;
  const r = noCrew(() => g.issue(0, { type: 'train', buildingId: kas.id, unit: 'sniper' }));
  assert.ok(r.ok, r.reason);
  assert.equal(g.teams[0].res.money, 780);
  run(g, UNITS.sniper.buildTime + 2);
  assert.equal(g.units.filter((u) => u.alive && u.team === 0 && u.type === 'sniper').length, 1);
});

test('Scharfschütze: ein Schuss tötet einen vollen Soldaten aus großer Entfernung, danach lange Nachladezeit', () => {
  const { g, x, y } = scene();
  const s = g.spawnUnit('sniper', 0, x, y);
  const a = g.spawnUnit('rifleman', 1, x + 400, y); // außerhalb der Gewehrreichweite (200), innerhalb von 480
  const b = g.spawnUnit('rifleman', 1, x + 420, y + 10);
  run(g, 1.5);
  assert.ok(!a.alive || !b.alive, 'ein Ziel gefallen');
  assert.equal([a, b].filter((u) => !u.alive).length, 1, 'nur ein Schuss in den ersten Sekunden');
  assert.ok(s.alive);
  run(g, 9);
  assert.equal([a, b].filter((u) => !u.alive).length, 2, 'nach 8 s der zweite Schuss');
});

test('Scharfschütze: wirkt kaum gegen Fahrzeuge und Gebäude', () => {
  const spec = UNITS.sniper.weapons[0];
  assert.ok(spec.damage.light < 10 && spec.damage.heavy < 5 && spec.damage.struct < 5);
});

test('Tarnung: Gegner sehen den Scharfschützen nur nahe oder kurz nach einem Schuss', () => {
  const { g, x, y } = scene();
  const s = g.spawnUnit('sniper', 0, x, y);
  s.weapons[0].rounds = 0; // schießt nicht, sonst verrät ihn der erste Schuss
  const foe = g.spawnUnit('rifleman', 1, x + 300, y);
  foe.weapons[0].rounds = 0;
  run(g, 0.5);
  g.fog[1].mark(x, y, 400); // Zelle ist eingesehen, nur die Tarnung zählt
  assert.equal(g.sees(1, s), false, 'in 300 px nicht entdeckt');
  assert.equal(g.sees(0, s), true, 'eigene sehen ihn immer');
  foe.x = x + BALANCE.stealth.detectRange - 10;
  assert.equal(g.sees(1, s), true, 'nahe entdeckt');
  foe.x = x + 300;
  s.revealedUntil = g.time + BALANCE.stealth.revealTime;
  assert.equal(g.sees(1, s), true, 'nach einem Schuss kurz sichtbar');
  g.time += BALANCE.stealth.revealTime + 1;
  assert.equal(g.sees(1, s), false, 'danach wieder getarnt');
});

test('Tarnung: Gegner schießt nicht auf einen unentdeckten Scharfschützen, dieser schießt zuerst', () => {
  const { g, x, y } = scene();
  const s = g.spawnUnit('sniper', 0, x, y);
  const foe = g.spawnUnit('rifleman', 1, x + 250, y); // Gewehr-Reichweite 200: außer Reichweite, aber sichtbar nicht
  g.fog[1].mark(x, y, 600);
  run(g, 1.5);
  assert.ok(!foe.alive, 'Gegner gefallen');
  assert.equal(s.hp, s.def.hp, 'Scharfschütze unverletzt');
});

// ---------- Liegen und Beobachten (Paket „Scharfschütze“, Befehl sniper) ----------

/** Scharfschütze (Team 0) und ein Gegner `foe` (Team 1) im Abstand d, weit weg von beiden Hauptstädten (deren MG schießt mit). */
function pair(foe, d) {
  const g = new Game({ seed: 3 });
  const a = g.mainFob(0);
  const b = g.mainFob(1);
  let x = (a.x + b.x) / 2 - 1200;
  const y = (a.y + b.y) / 2 - 1200;
  const free = (px, py) => [0, d].every((o) => g.grid.passable(Math.floor((px + o) / 32), Math.floor(py / 32)));
  for (let k = 0; k < 200 && !free(x, y); k++) x += 32; // freie Zellen für beide
  const s = g.spawnUnit('sniper', 0, x, y);
  const e = g.spawnUnit(foe, 1, x + d, y);
  s.order = { type: 'hold' };
  e.order = { type: 'hold' };
  return { g, s, e };
}

test('Liegend: Gegner sieht ihn nur aus nächster Nähe, ein gegnerischer Scharfschütze in Sichtweite schon', () => {
  const { g, s } = pair('rifleman', 100);
  assert.ok(g.issue(0, { type: 'sniper', ids: [s.id], prone: true, observe: true }).ok);
  run(g, 0.5);
  assert.equal(g.sees(1, s), false, 'Schütze in 100 px sieht den liegenden Scharfschützen nicht');
  const near = pair('rifleman', BALANCE.stealth.proneDetect - 5);
  near.g.issue(0, { type: 'sniper', ids: [near.s.id], prone: true, observe: true });
  run(near.g, 0.5);
  near.e.x = near.s.x + BALANCE.stealth.proneDetect - 5; // Einheiten schieben sich auseinander: Abstand für die Prüfung setzen
  near.e.y = near.s.y;
  assert.equal(near.g.sees(1, near.s), true, 'aus nächster Nähe erkannt');
  const duel = pair('sniper', 300);
  duel.g.issue(0, { type: 'sniper', ids: [duel.s.id], prone: true, observe: true });
  duel.g.issue(1, { type: 'sniper', ids: [duel.e.id], observe: true });
  run(duel.g, 0.5);
  assert.equal(duel.g.sees(1, duel.s), true, 'gegnerischer Scharfschütze sieht ihn');
});

test('Beobachten: schießt nicht; Feuer frei: schießt (auch liegend), der Schuss verrät ihn nur kurz', () => {
  const { g, s, e } = pair('rifleman', 300);
  g.issue(0, { type: 'sniper', ids: [s.id], prone: true, observe: true });
  run(g, 12);
  assert.equal(e.hp, e.def.hp, 'beobachtet: kein Schuss');
  g.issue(0, { type: 'sniper', ids: [s.id], observe: false });
  run(g, 12);
  assert.ok(!e.alive || e.hp < e.def.hp, 'Feuer frei: trifft');
  assert.ok(s.prone, 'bleibt liegen');
  assert.ok(s.revealedUntil - g.time <= BALANCE.stealth.proneReveal, 'liegend nur kurz verraten');
});

test('Ein Marschbefehl lässt ihn aufstehen; nur Scharfschützen nehmen den Befehl', () => {
  const { g, s, e } = pair('rifleman', 300);
  g.issue(0, { type: 'sniper', ids: [s.id], prone: true });
  assert.ok(s.prone);
  g.issue(0, { type: 'move', ids: [s.id], x: s.x - 200, y: s.y });
  run(g, 2);
  assert.equal(s.prone, false, 'steht zum Gehen auf');
  const r = g.spawnUnit('rifleman', 0, s.x, s.y + 40);
  assert.equal(g.issue(0, { type: 'sniper', ids: [r.id], prone: true }).ok, false, 'Schütze kann das nicht');
  assert.ok(e.alive);
});
