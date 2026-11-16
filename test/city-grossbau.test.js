// Stadt-Großbauten (PRD §15): Straßenanschluss, Universität, Werke 2 × 2, Startviertel, connectRoad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KINDS, KIND_ID } from '../js/data/citykinds.js';
import { canZone, hasRoad, cellsOf, isPart, roadAt, cellAt } from '../js/game/city/cells.js';
import { cityEntityAt, forEnemyCity, cityLevel } from '../js/game/city/query.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { transportInfo } from '../js/game/transport.js';
import { withValue } from './util.js';
import { researchBlock, researchSpeed } from '../js/game/research.js';
import { run, spot, raw, nbOf, setLevel } from './cityhelp.js';

test('Großbauten der Stadt (Fabrikhalle, Kaserne) lichten den Nebel über ihrer ganzen Fläche (seit v5.25)', () => {
  const g = new Game({ seed: 3, city: true });
  for (const u of g.units) u.alive = false; // nur die Stadtgebäude sehen
  for (const b of g.buildings) b.def = { ...b.def, sight: 0 };
  for (let i = 0; i < 10; i++) g.update(0.05);
  const c = g.city[0];
  let n = 0;
  for (const [i] of c.ents) {
    const k = KINDS[c.kind[i] - 1];
    if (k !== 'factory' && k !== 'barracks') continue;
    for (const j of cellsOf(c, i)) {
      const q = j % c.cols;
      const r = (j - q) / c.cols;
      for (const [dx, dy] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) {
        n++;
        assert.ok(g.fog[0].isVisible((q + dx) * c.cell, (r + dy) * c.cell), `${k}: Zelle (${q}, ${r}) im Nebel`);
      }
    }
  }
  assert.ok(n >= 4 * (25 + 16), 'Fabrikhalle (5 × 5) und Kaserne (4 × 4) im Startviertel geprüft');
});

test('Startviertel: Raffinerie und Wohnen stehen fertig, Öl kommt über die Straße zum Kartenrand, Treibstoff fließt', () => {
  const g = new Game({ seed: 3, city: true });
  for (const team of [0, 1]) {
    const c = g.city[team];
    const kinds = c.list.filter((i) => c.level[i]).map((i) => c.kind[i]);
    assert.ok(kinds.includes(KIND_ID.fuel) && kinds.includes(KIND_ID.res) && !kinds.includes(KIND_ID.mine), `Team ${team}: ${kinds}`);
  }
  const m = g.mainFob(0);
  m.store.fuel = 0;
  run(g, 30);
  assert.ok(g.city[0].stats.fuel > 0 && m.store.fuel > 0, `TS ${m.store.fuel}`);
});

test('Universität: ohne sie ruht die Forschung; Rechenzentren beschleunigen sie (seit v5.04)', () => {
  const g = new Game({ seed: 3, city: true, research: true, startMoney: 5000 });
  assert.equal(researchBlock(g, 0, 'tank1'), 'Benötigt eine Universität in der Stadt');
  assert.equal(researchSpeed(g, 0), 0);
  setLevel(g, 'uni', 1);
  assert.equal(researchBlock(g, 0, 'tank1'), '');
  assert.equal(researchSpeed(g, 0), 1 * (g.city[0].stats.powerRatio ?? 1));
  setLevel(g, 'dc', 2);
  setLevel(g, 'dc', 1);
  assert.ok(Math.abs(researchSpeed(g, 0) - (1 + 3 * CITY.research.dcSpeed) * (g.city[0].stats.powerRatio ?? 1)) < 1e-9, 'alle Rechenzentren zählen');
  // ohne Stadt: keine Universität nötig
  const n = new Game({ city: false, seed: 3, research: true });
  assert.equal(researchBlock(n, 0, 'tank1'), '');
  assert.equal(researchSpeed(n, 0), 1);
});

test('Straßenanschluss: Wohnen/Gewerbe/BM-Werk über genau eine Zelle gleicher Art', () => {
  const cols = 6, rows = 1;
  const mk = (...k) => ({ cols, rows, kind: Uint8Array.from(k) });
  const R = KIND_ID.road, W = KIND_ID.res, G = KIND_ID.com, B = KIND_ID.bm;
  const c = mk(R, W, W, G, W, 0);
  assert.ok(hasRoad(c, 1, 0)); // direkt
  assert.ok(hasRoad(c, 2, 0)); // Wohnen-Wohnen-Straße
  assert.ok(!hasRoad(c, 3, 0) || false); // Gewerbe hinter Wohnen: nein
  const d = mk(R, G, W, 0, 0, 0);
  assert.ok(!hasRoad(d, 2, 0)); // Wohnen-Gewerbe-Straße: nicht für Wohnen
  const e = mk(R, W, W, W, 0, 0);
  assert.ok(!hasRoad(e, 3, 0)); // keine längeren Ketten
  const f = mk(R, B, B, B, 0, 0);
  assert.ok(hasRoad(f, 2, 0)); // BM-Werk-BM-Werk-Straße (seit v5.05)
  assert.ok(!hasRoad(f, 3, 0)); // auch hier keine längeren Ketten
  const M = KIND_ID.mun;
  assert.ok(!hasRoad(mk(R, B, W, 0, 0, 0), 2, 0)); // Wohnen hinter BM-Werk: nein
  assert.ok(!hasRoad(mk(R, M, M, 0, 0, 0), 2, 0)); // andere Werke weiter nur direkt
});

// v5.00: Universität als 3 × 3-Großbau (ein Gebäude, ein Ziel, alte Spielstände werden umgebaut)
test('Universität: 3 × 3 Zellen, ein Gebäude, wächst mit Straße, Räumen entfernt alles', () => {
  const g = new Game({ seed: 3, city: true });
  g.teams[0].res.money = 5000;
  const c = g.city[0];
  const b0 = spot(g, 5, 6); // Quadrat plus eine Zeile darunter für die Straße, ringsum eine freie Zelle (keine Straße daneben)
  const b = { c: b0.c + 1, r: b0.r + 1 };
  const money = g.teams[0].res.money;
  const r = raw(g, 'uni', b.c + 1, b.r + 1, b.c + 1, b.r + 1);
  assert.ok(r.ok, r.reason);
  assert.equal(g.teams[0].res.money, money - CITY.cost.uni, 'ein Preis je Gebäude');
  const a = r.anchor;
  const cells = cellsOf(c, a);
  assert.equal(cells.length, 9);
  assert.ok(cells.every((j) => c.kind[j] === KIND_ID.uni && c.part[j] === a + 1));
  assert.equal(cells.filter((j) => isPart(c, j)).length, 8, 'Mitte ist der Anker');
  assert.ok(r.noRoad, 'ohne Straße meldet der Befehl das');
  assert.ok(raw(g, 'road', b.c, b.r + 3, b.c + 2, b.r + 3).ok);
  run(g, CITY.growTime + 1);
  assert.ok(cells.every((j) => c.level[j] === 1), 'alle Zellen Stufe 1');
  assert.equal(cityLevel(g, 0, 'uni'), 1);
  const e = c.ents.get(a);
  assert.ok(e && e.alive);
  assert.equal(e.w * g.grid.tile, 3 * c.cell, 'Ziel deckt das ganze Quadrat');
  assert.equal(e.def.hp, CITY.hp[1] * 3);
  assert.equal([...c.ents.values()].filter((x) => x.def.name === 'Universität').length, 1, 'ein Ziel');
  assert.equal(cityEntityAt(g, e.x - c.cell, e.y - c.cell), e, 'Eckzelle trifft dasselbe Gebäude');
  let seen = 0;
  forEnemyCity(g, 1, e.x, e.y, 200, (x) => { if (x === e) seen++; });
  assert.equal(seen, 1, 'Splash trifft den Großbau nur einmal');
  // Uni-Plätze zählen einmal
  run(g, 1);
  const jobs0 = g.city[0].stats.jobs;
  assert.ok(raw(g, 'erase', b.c + 2, b.r + 2, b.c + 2, b.r + 2).ok, 'Räumen einer Eckzelle');
  assert.ok(cells.every((j) => !c.kind[j] && !c.part[j]), 'ganzes Quadrat leer');
  assert.ok(!e.alive);
  run(g, 1);
  assert.equal(jobs0 - g.city[0].stats.jobs, CITY.jobsUni[1], 'Uni zählte einmal');
  // kein Platz: abgelehnt, nichts bezahlt
  const m = g.mainFob(0);
  const [fc, fr] = [Math.floor(m.x / c.cell), Math.floor(m.y / c.cell)];
  const before = g.teams[0].res.money;
  assert.match(raw(g, 'uni', fc, fr, fc, fr).reason, /3 × 3/);
  assert.equal(g.teams[0].res.money, before);
});

test('Universität: zerstört wird das ganze Quadrat Ruine und wächst neu', () => {
  const g = new Game({ seed: 3, city: true });
  g.teams[0].res.money = 5000;
  const c = g.city[0];
  const b = spot(g, 3, 4);
  const a = raw(g, 'uni', b.c + 1, b.r + 1, b.c + 1, b.r + 1).anchor;
  raw(g, 'road', b.c, b.r + 3, b.c + 2, b.r + 3);
  run(g, CITY.growTime + 1);
  const e = c.ents.get(a);
  assert.ok(e && e.def.hp === CITY.hp[1] * 3);
  e.hp = 0;
  run(g, 0.1);
  assert.ok(cellsOf(c, a).every((j) => c.level[j] === 0 && c.kind[j] === KIND_ID.uni));
  assert.ok(c.timer[a] < 0, 'Ruine');
  assert.equal(cityLevel(g, 0, 'uni'), 0);
  run(g, CITY.ruinTime + CITY.growTime + 1);
  assert.ok(cellsOf(c, a).every((j) => c.level[j] === 1), 'neu gewachsen');
  assert.ok(c.ents.get(a)?.alive);
});

// v5.08: Werke (BM-Werk, Munitionswerk, Raffinerie, Stahlwerk) als 2 × 2-Großbauten
test('Werke 2 × 2 (v5.08): ein Gebäude wie bisher eine Werkzelle, Mitte zwischen den Zellen, Räumen entfernt alles', () => {
  const g = new Game({ seed: 3, city: true });
  g.teams[0].res.money = 5000;
  const c = g.city[0];
  const b0 = spot(g, 4, 5);
  const b = { c: b0.c + 1, r: b0.r + 1 }; // 2 × 2 plus Straßenzeile, ringsum frei
  const money = g.teams[0].res.money;
  const r = raw(g, 'fuel', b.c + 1, b.r + 1, b.c + 1, b.r + 1); // ein Tipp: dort der Anker, das Quadrat reicht nach rechts unten …
  assert.ok(r.ok, r.reason);
  assert.equal(r.anchor, (b.r + 1) * c.cols + b.c + 1);
  assert.ok(raw(g, 'erase', b.c + 1, b.r + 1, b.c + 1, b.r + 1).ok);
  const r2 = raw(g, 'fuel', b.c, b.r, b.c + 1, b.r + 1); // … ein 2 × 2-Rechteck: genau dort
  assert.equal(r2.anchor, b.r * c.cols + b.c);
  assert.equal(g.teams[0].res.money, money - 2 * CITY.cost.fuel, 'ein Preis je Gebäude');
  const a = r2.anchor;
  const cells = cellsOf(c, a);
  assert.equal(cells.length, 4);
  assert.ok(cells.every((j) => c.kind[j] === KIND_ID.fuel && c.part[j] === a + 1));
  assert.ok(r2.noRoad);
  run(g, 1);
  const jobs0 = c.stats.jobs;
  assert.ok(raw(g, 'road', b.c, b.r + 2, b.c + 1, b.r + 2).ok);
  run(g, CITY.growTime + 1);
  assert.ok(cells.every((j) => c.level[j] === 1), 'alle Zellen Stufe 1');
  const e = c.ents.get(a);
  assert.ok(e && e.alive);
  assert.equal(e.w * g.grid.tile, 2 * c.cell);
  assert.equal(e.def.hp, CITY.hp[1] * 2);
  const corner = { x: c.x0 + (b.c + 1) * c.cell, y: c.y0 + (b.r + 1) * c.cell };
  assert.ok(Math.abs(e.x - corner.x) < 1e-6 && Math.abs(e.y - corner.y) < 1e-6, 'Mitte = Ecke zwischen den vier Zellen');
  assert.equal(cityEntityAt(g, e.x + c.cell / 2, e.y + c.cell / 2), e, 'Zelle rechts unten trifft dasselbe Gebäude');
  run(g, 1);
  assert.equal(c.stats.jobs - jobs0, CITY.jobs[1], 'Arbeitsplätze wie bisher eine Werkzelle');
  assert.ok(raw(g, 'erase', b.c + 1, b.r + 1, b.c + 1, b.r + 1).ok, 'Räumen einer Zelle');
  assert.ok(cells.every((j) => !c.kind[j] && !c.part[j]), 'ganzes Quadrat leer');
  assert.ok(!e.alive);
  // Startviertel: die Raffinerie ist ein fertiges 2 × 2-Werk
  const f = c.list.find((j) => c.kind[j] === KIND_ID.fuel && c.part[j] - 1 === j);
  assert.ok(f >= 0 && c.level[f] === 1 && cellsOf(c, f).length === 4, 'Startviertel mit 2 × 2-Raffinerie');
});

test('2 × 2-BM-Werk: Straßenanschluss auch über ein benachbartes BM-Werk an der Straße (v5.05 für Großbauten)', () => {
  const g = new Game({ seed: 3, city: true });
  g.teams[0].res.money = 5000;
  const c = g.city[0];
  const b0 = spot(g, 6, 5);
  const b = { c: b0.c + 1, r: b0.r + 1 };
  assert.ok(raw(g, 'road', b.c, b.r, b.c + 3, b.r).ok);
  const near = raw(g, 'bm', b.c, b.r + 1, b.c + 1, b.r + 2).anchor;
  const far = raw(g, 'bm', b.c, b.r + 3, b.c + 1, b.r + 4).anchor;
  const mun = raw(g, 'mun', b.c + 2, b.r + 1, b.c + 3, b.r + 2).anchor;
  const mun2 = raw(g, 'mun', b.c + 2, b.r + 3, b.c + 3, b.r + 4).anchor;
  const at2 = (a) => [a % c.cols, Math.floor(a / c.cols)];
  assert.ok(hasRoad(c, ...at2(near)), 'direkt an der Straße');
  assert.ok(hasRoad(c, ...at2(far)), 'über das BM-Werk davor');
  assert.ok(hasRoad(c, ...at2(mun)));
  assert.ok(!hasRoad(c, ...at2(mun2)), 'andere Werke nur direkt');
});

test('Startviertel (AP4, Paket „Import“): Raffinerie hat einen Weg ins Lager und einen zum Kartenrand', () => {
  for (const team of [0, 1]) {
    const g = new Game({ seed: 3, city: true });
    const c = g.city[team];
    const fuel = c.list.find((i) => !isPart(c, i) && c.level[i] && c.kind[i] === KIND_ID.fuel);
    assert.ok(fuel !== undefined, `Team ${team}: Raffinerie fertig`);
    assert.equal(transportInfo(g, c, fuel).to, 'Lager', `Team ${team}: Raffinerie → Lager`);
    assert.equal(transportInfo(g, c, fuel).importFrom, 'Kartenrand', `Team ${team}: Öl vom Kartenrand`);
  }
});

test('connectRoad (AP4): Werk an das Lager anschließen, Baumaterial je Zelle, 0 wenn verbunden, −1 ohne erlaubte Länge', () => {
  const g = new Game({ seed: 3, city: true, startMoney: 5000 });
  const c = g.city[0];
  const m = g.mainFob(0);
  // freies 2 × 2-Quadrat im Gebiet ohne Straße daneben, nicht direkt an der Hauptstadt
  const [fc, fr] = cellAt(c, m.x, m.y);
  let a = -1;
  for (let d = 3; d < 12 && a < 0; d++) {
    for (let r = fr - d; r <= fr + d && a < 0; r++) for (let q = fc - d; q <= fc + d && a < 0; q++) {
      const cells = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (r + y) * c.cols + q + x);
      if (cells.every((j) => c.claim[j] && !c.kind[j] && canZone(g, c, j)) && cells.every((j) => !nbOf(c, j).some((k) => roadAt(c, k) || c.kind[k]))) a = r * c.cols + q;
    }
  }
  assert.ok(a >= 0, 'Platz für ein Werk');
  assert.ok(g.issue(0, { type: 'city', kind: 'bm', c0: a % c.cols, r0: Math.floor(a / c.cols), c1: a % c.cols + 1, r1: Math.floor(a / c.cols) + 1 }).ok);
  const bm0 = m.store.bm;
  withValue(CITY.transport, 'connectMax', 0, () => assert.equal(connectRoad(g, c, a, true), -1, 'ohne erlaubte Länge kein Weg'));
  const n = connectRoad(g, c, a, true);
  assert.ok(n > 0 && n <= CITY.transport.connectMax, `gelegte Zellen ${n}`);
  assert.equal(m.store.bm, bm0 - n * CITY.costBm.road, 'jede Straßenzelle kostet Baumaterial');
  assert.equal(connectRoad(g, c, a, true), 0, 'schon verbunden: nichts mehr');
});
