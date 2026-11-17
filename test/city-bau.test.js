// Stadt-Grundlagen (PRD §15): Lager, Bauen, Zonen, Raster, Überbauen, Räumen, Strom, Zufriedenheit, Steuer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { treeGone } from '../js/game/city/clearing.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { canZone } from '../js/game/city/cells.js';
import { connectEdge } from '../js/game/city/roadnet.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { withValue } from './util.js';
import { brakeTax } from '../js/game/city/economy.js';
import { run, base, paint, at, clearStart, raw, linkMain, setLevel } from './cityhelp.js';

test('mit Stadt: endliches Startlager, Front-Summe ohne Hauptstadt', () => {
  const g = new Game({ seed: 3, city: true });
  const m = g.mainFob(0);
  assert.equal(m.infinite, false);
  assert.deepEqual({ ...m.store }, CITY.startStock);
  assert.equal(g.teams[0].res.bm, 0);
});

test('Bauen kostet Geld (Straßen Baumaterial), zu wenig stoppt, Abriss ist kostenlos', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 100 });
  const m = g.mainFob(0);
  const bm0 = m.store.bm;
  const r = paint(g, 'road', 0, 0, 9, 0); // 10 x 10 BM
  assert.ok(r.ok);
  assert.equal(g.teams[0].res.money, 100);
  assert.equal(m.store.bm, bm0 - 100);
  const r2 = paint(g, 'com', 0, 1, 4, 1); // 5 x 30 > 100 Geld: nur 3 Zellen
  assert.equal(r2.placed, 3);
  assert.equal(r2.broke, true);
  assert.equal(paint(g, 'erase', 0, 1, 4, 1).ok, true);
  assert.equal(g.teams[0].res.money, 10);
  assert.equal(paint(g, 'res', 0, 1, 0, 1).ok, false); // zu wenig Geld (20 > 10)
  m.store.bm = 5;
  assert.match(paint(g, 'road', 0, 2, 0, 2).reason, /Baumaterial/);
});

test('Zone ohne Straße wächst nicht, mit Straße wird sie Gebäude', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 2000 });
  paint(g, 'res', 5, 2, 5, 2);
  run(g, CITY.growTime + 2);
  assert.equal(g.city[0].level[at(g, 5, 2)], 0);
  paint(g, 'road', 5, 1, 5, 1);
  run(g, CITY.growTime + 2);
  assert.equal(g.city[0].level[at(g, 5, 2)], 1);
});

test('Wohnen + Werk + Straße: Einwohner arbeiten, Lager und Geld wachsen', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 3000 });
  clearStart(g);
  paint(g, 'road', 0, 2, 5, 2);
  paint(g, 'res', 0, 1, 5, 1);
  paint(g, 'bm', 0, 3, 5, 3);
  const c = g.city[0];
  assert.match(paint(g, 'mine', 0, 4, 0, 4).reason, /nicht mehr baubar/, 'Förderanlage gibt es nicht mehr (Paket „Import“)');
  assert.ok(connectEdge(g, c, [at(g, 0, 2)], false) >= 0, 'Straße zum Kartenrand (Einfuhr)');
  linkMain(g, 0, c.list.find((i) => c.kind[i] === KIND_ID.bm)); // das Netz erreicht das Lager (seit v5.20 braucht BM einen Weg dorthin)
  const m = g.mainFob(0);
  m.store.bm = 0;
  const money0 = g.teams[0].res.money;
  run(g, 120);
  const s = g.city[0].stats;
  assert.ok(s.pop > 8, `Einwohner ${s.pop}`);
  assert.ok(s.workers > 0 && s.bm > 0);
  assert.ok(s.raw.raw > 0 && s.importCost > 0, 'Rohmaterial wird eingeführt und bezahlt');
  assert.ok(s.bm <= s.raw.raw / CITY.chain.bm.need.raw + 1e-9, 'BM nur aus Rohmaterial');
  assert.ok(m.store.bm > 50, `BM ${m.store.bm}`);
  assert.ok(g.teams[0].res.money > money0);
  assert.ok(m.store.bm <= 3000);
  assert.ok(g.city[1].stats.pop <= g.city[1].stats.housing, 'andere Stadt eigenständig');
});

test('Nichts überbauen: belegte Zellen bleiben, erst räumen, dann neu ausweisen', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 3000 });
  clearStart(g);
  const c = g.city[0];
  assert.ok(paint(g, 'road', 0, 2, 3, 2).ok);
  assert.ok(paint(g, 'res', 0, 1, 1, 1).ok);
  const road = c.kind[at(g, 0, 2)];
  const res = c.kind[at(g, 0, 1)];
  const money0 = g.teams[0].res.money;
  const r = paint(g, 'com', 0, 1, 1, 1);
  assert.equal(r.ok, false, 'nur Belegtes im Rechteck');
  assert.match(r.reason, /räumen/);
  assert.equal(g.teams[0].res.money, money0, 'nichts bezahlt');
  assert.equal(c.kind[at(g, 0, 1)], res, 'Wohnen bleibt');
  // gemischtes Rechteck: nur die leeren Zellen werden Gewerbe, Straße und Wohnen bleiben
  const r2 = paint(g, 'com', 0, 0, 1, 2);
  assert.equal(r2.ok, true);
  assert.equal(r2.placed, 2);
  assert.equal(r2.occupied, true);
  assert.equal(c.kind[at(g, 0, 2)], road, 'Straße bleibt');
  assert.equal(c.kind[at(g, 1, 1)], res, 'Wohnen bleibt');
  // Großbau auf belegten Zellen: abgelehnt
  assert.equal(paint(g, 'uni', 0, 1, 0, 1).ok, false);
  // erst räumen, dann geht es
  assert.ok(paint(g, 'erase', 0, 1, 0, 1).ok);
  assert.ok(paint(g, 'com', 0, 1, 0, 1).ok);
  assert.notEqual(c.kind[at(g, 0, 1)], res, 'nach dem Räumen neu ausgewiesen');
});

test('Ausbau nur bei Bedarf: Wohnen ohne Arbeit bleibt Stufe 1', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 3000 });
  clearStart(g);
  paint(g, 'road', 0, 2, 3, 2);
  paint(g, 'res', 0, 1, 3, 1);
  run(g, CITY.growTime + CITY.upgradeTime * 3);
  for (let col = 0; col < 4; col++) assert.equal(g.city[0].level[at(g, col, 1)], 1);
});

test('Stadtraster deckt die Karte: unter der FOB gesperrt, Gebäude sperren den Weg, Abriss gibt ihn frei', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 3000 });
  const c = g.city[0];
  const m = g.mainFob(0);
  assert.equal(c.cols * c.cell, g.grid.cols * g.grid.tile, 'ganze Kartenbreite');
  const fc = Math.floor(m.x / c.cell);
  const fr = Math.floor(m.y / c.cell);
  assert.equal(c.blocked[fr * c.cols + fc], 1);
  assert.equal(raw(g, 'res', fc, fr, fc, fr).ok, false, 'unter der FOB nichts bauen');
  paint(g, 'road', 0, 0, 3, 0);
  paint(g, 'bm', 0, 1, 0, 1);
  const b = base.get(g);
  const x0 = b.c * c.cell;
  const y0 = (b.r + 1) * c.cell;
  const T = g.grid.tile;
  const u = g.units.find((x) => x.team === 0 && !x.def.air);
  u.x = x0 + 30; u.y = y0 + 30; u.path = [];
  run(g, CITY.growTime + 1);
  assert.equal(c.level[at(g, 0, 1)], 1);
  assert.equal(g.grid.passable(Math.floor((x0 + 32) / T), Math.floor((y0 + 32) / T), 0), false, 'Gebäude blockiert');
  assert.ok(g.grid.passable(g.grid.toCell(u.x), g.grid.toCell(u.y), 0), 'Einheit steht frei');
  assert.ok(g.grid.passable(Math.floor((x0 + 32) / T), Math.floor((y0 - 32) / T), 0), 'Straße begehbar');
  paint(g, 'erase', 0, 1, 0, 1);
  assert.equal(g.grid.passable(Math.floor((x0 + 32) / T), Math.floor((y0 + 32) / T), 0), true, 'Abriss gibt frei');
});

test('Überall bauen (seit v4.87): auch fern der Hauptstadt, aber nicht auf gegnerischen Zellen', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = g.city[0];
  const z = g.zone;
  // eine freie Zelle nahe der Kartenmitte (weit weg von der eigenen Hauptstadt)
  let far = -1;
  for (let i = 0; i < c.blocked.length && far < 0; i++) {
    const q = i % c.cols;
    const r = (i - q) / c.cols;
    if (!c.blocked[i] && !c.claim[i] && Math.hypot((q + 0.5) * c.cell - z.x, (r + 0.5) * c.cell - z.y) < z.r + 600) far = i;
  }
  assert.ok(far >= 0);
  const q = far % c.cols;
  const r = (far - q) / c.cols;
  assert.ok(raw(g, 'res', q, r, q, r).ok, 'weit draußen bauen geht');
  // Gegner darf eigene Zellen nicht überbauen
  assert.equal(raw(g, 'com', q, r, q, r, 1).ok, false);
});

test('Strom: zu wenig Kraftwerke bremsen die Werke, ein Kraftwerk hilft', () => {
  const g = new Game({ seed: 3, city: true });
  for (let k = 0; k < 6; k++) setLevel(g, 'steel', 3);
  run(g, 2);
  const s = g.city[0].stats;
  assert.ok(s.powerUse > s.powerSupply, `Verbrauch ${s.powerUse} > Angebot ${s.powerSupply}`);
  assert.ok(s.powerRatio < 1);
  const before = s.powerRatio;
  for (let k = 0; k < 2; k++) setLevel(g, 'power', 3);
  run(g, 2);
  assert.ok(g.city[0].stats.powerRatio > before);
});

test('Zufriedenheit sinkt bei Beschuss der Stadt', () => {
  const g = new Game({ seed: 3, city: true });
  run(g, 2);
  const calm = g.city[0].stats.happy;
  const m = g.mainFob(0);
  g.city[0].hitLog = Array.from({ length: CITY.happy.hitsBad }, () => ({ x: m.x, y: m.y, t: g.time }));
  run(g, 1);
  assert.ok(g.city[0].stats.happy < calm - 0.1, `${g.city[0].stats.happy} < ${calm}`);
});

test('Räumen fällt Bäume: Zelle wird bebaubar, Fels und Hauptstadt bleiben gesperrt (seit v5.13)', () => {
  const g = new Game({ seed: 7, city: true });
  const c = g.city[0];
  const gr = g.grid;
  const k = c.cell / gr.tile;
  // Zelle, die genau ein Einzelbaum sperrt (Stamm-Kachel), und eine mit Wald
  const cellOf = (x, y) => Math.floor(y / c.cell) * c.cols + Math.floor(x / c.cell);
  const tree = g.map.trees.find((t) => c.blocked[cellOf(t.x, t.y)] && !g.city.some((o) => o.kind[cellOf(t.x, t.y)]));
  assert.ok(tree, 'kein Baum auf der Karte');
  const i = cellOf(tree.x, tree.y);
  const col = i % c.cols;
  const row = (i - col) / c.cols;
  const res = g.issue(0, { type: 'city', kind: 'erase', c0: col, r0: row, c1: col, r1: row });
  if (res.ok) {
    assert.equal(res.felled, 1);
    assert.equal(c.blocked[i], 0);
    assert.equal(g.city[1].blocked[i], 0, 'Sperren gelten für beide Teams');
    assert.equal(c.felled[i], 1);
    assert.ok(treeGone(g, tree.x, tree.y));
    for (let r = row * k; r < (row + 1) * k; r++) for (let q = col * k; q < (col + 1) * k; q++) assert.ok(gr.free(q, r));
    assert.ok(canZone(g, c, i), 'nach dem Fällen darf man bauen');
  } else assert.match(res.reason, /Nur Bäume/); // derselbe Baum steht neben Fels oder Wasser
  // Ein ganzer Wald im Rechteck: mindestens eine Zelle wird frei
  const forest = g.map.obstacles.find((o) => Math.round(o.r) % 2 === 0 && o.r >= 64);
  assert.ok(forest, 'kein Wald auf der Karte');
  const fc = Math.floor(forest.x / c.cell);
  const fr = Math.floor(forest.y / c.cell);
  const before = c.blocked.reduce((a, b) => a + b, 0);
  const res2 = g.issue(0, { type: 'city', kind: 'erase', c0: fc - 1, r0: fr - 1, c1: fc + 1, r1: fr + 1 });
  assert.ok(res2.ok && res2.felled > 0, 'Wald lässt sich fällen');
  assert.equal(c.blocked.reduce((a, b) => a + b, 0), before - res2.felled);
  // Fels bleibt gesperrt
  const rock = g.map.obstacles.find((o) => Math.round(o.r) % 2 === 1 && o.r >= 40);
  if (rock) {
    const rc = Math.floor(rock.x / c.cell);
    const rr = Math.floor(rock.y / c.cell);
    const res3 = g.issue(0, { type: 'city', kind: 'erase', c0: rc, r0: rr, c1: rc, r1: rr });
    assert.equal(res3.ok, false);
    assert.equal(c.blocked[rr * c.cols + rc], 1);
  }
  // Hauptstadt: der Platz darum bleibt frei
  const m = g.mainFob(0);
  const mc = Math.floor(m.x / c.cell);
  const mr = Math.floor(m.y / c.cell);
  g.issue(0, { type: 'city', kind: 'erase', c0: mc, r0: mr, c1: mc, r1: mr });
  assert.equal(c.blocked[mr * c.cols + mc], 1);
  // Spielstand: gefällte Zellen bleiben gefällt, beide Teams teilen weiter dasselbe Feld
  const { game: h } = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g, null))));
  assert.equal(h.city[0].felled, h.city[1].felled);
  assert.deepEqual([...h.city[0].felled], [...c.felled]);
});

test('Steuerbremse: unter der Schwelle unverändert, darüber nur gedämpft (Balance-Steuern)', () => {
  const { from, rest } = CITY.taxBrake;
  assert.equal(brakeTax(0), 0, 'ohne Steuer keine Steuer');
  assert.equal(brakeTax(from), from, 'an der Schwelle noch voll');
  assert.ok(Math.abs(brakeTax(from - 3) - (from - 3)) < 1e-12, 'unter der Schwelle voll');
  const raw = from + 20;
  assert.ok(Math.abs(brakeTax(raw) - (from + 20 * rest)) < 1e-9, `darüber × ${rest}: ${brakeTax(raw)}`);
  assert.ok(brakeTax(raw) < raw, 'gebremst');
  assert.ok(brakeTax(raw + 1) - brakeTax(raw) < 1, 'Zuwachs je Geld/s roh unter 1');
  withValue(CITY.taxBrake, 'from', Infinity, () => assert.equal(brakeTax(500), 500, 'Bremse aus: ungebremst'));
});
