// Stadt-KI (PRD §15, js/ai/cityai.js): Bauplan, Planung, Verteidigung, Ausbildung und Großbauten der KI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { BALANCE } from '../js/data/balance.js';
import { AI } from '../js/ai/ai.js';
import { KINDS, KIND_ID } from '../js/data/citykinds.js';
import { hasRoad, cellsOf } from '../js/game/city/cells.js';
import { cityTrainers } from '../js/game/city/query.js';
import { cityAiMemory, aiCity, aiDefend, aiRaid } from '../js/ai/cityai.js';
import { run } from './cityhelp.js';

test('KI baut nach Bauplan und liefert Material [langsam]', () => {
  const g = new Game({ seed: 5, startMoney: 2000 });
  const ai = new AI(g, 1, 'normal');
  const n0 = g.city[1].kind.filter(Boolean).length;
  for (let t = 0; t < 20 * 240; t++) { ai.update(0.05); g.update(0.05); }
  assert.ok(g.city[1].kind.filter(Boolean).length > n0 + 10);
  assert.ok(g.city[1].stats.pop > 0);
});

test('Freie Planung: knapper Treibstoff mit Öl im Überfluss → KI weist Raffinerien aus', () => {
  const g = new Game({ seed: 3, startMoney: 20000 });
  const c = g.city[1];
  run(g, 20);
  const fuel0 = c.list.filter((i) => c.kind[i] === KIND_ID.fuel).length;
  const mem = cityAiMemory();
  for (let n = 0; n < 30; n++) {
    g.mainFob(1).store.fuel = 100;
    c.stats.raw.oil = 50; // reichlich Öl, zu wenig Raffinerie
    c.stats.free = 50; // genug freie Einwohner
    aiCity(g, 1, 'normal', mem);
  }
  const fuel1 = c.list.filter((i) => c.kind[i] === KIND_ID.fuel).length;
  const steel = c.list.filter((i) => c.kind[i] === KIND_ID.steel).length;
  assert.ok(fuel1 >= fuel0 + 3 && fuel1 > steel, `Raffinerien ${fuel0} → ${fuel1}, Stahlwerke ${steel}`);
});

test('Freie Planung: KI baut nicht neben frisch beschossenen Zellen', () => {
  const g = new Game({ seed: 3, startMoney: 20000 });
  const c = g.city[1];
  const m = g.mainFob(1);
  c.hitLog = [{ x: m.x, y: m.y, t: g.time }]; // Treffer an der Hauptstadt: die ganze Umgebung meiden
  const before = new Set(c.list);
  aiCity(g, 1, 'normal');
  const R = CITY.ai.dangerRadius;
  const added = c.list.filter((i) => !before.has(i));
  assert.ok(added.length > 0, 'baut woanders');
  for (const i of added) {
    const q = i % c.cols;
    const r = (i - q) / c.cols;
    assert.ok(Math.abs(q - Math.floor(m.x / c.cell)) > R || Math.abs(r - Math.floor(m.y / c.cell)) > R, 'nicht in der Gefahrenzone');
  }
});

test('KI verteidigt beschossene Stadtgebäude und greift gegnerische Werke zuerst an', () => {
  const g = new Game({ seed: 3, startMoney: 5000 });
  run(g, 20);
  const c = g.city[1];
  const e = [...c.ents.values()].find((x) => c.kind[x.cityCell] === KIND_ID.fuel);
  assert.ok(e, 'Raffinerie im Startviertel');
  e.lastHitTime = g.time;
  aiDefend(g, 1);
  const sent = g.units.filter((u) => u.team === 1 && u.order.type === 'attackMove' && Math.hypot(u.order.x - e.x, u.order.y - e.y) < 300);
  assert.ok(sent.length > 0 && sent.length <= CITY.ai.defendSize, `Verteidiger ${sent.length}`);
  // Angriff: das Ziel ist die Raffinerie (Werk) des Spielers, nicht ein Wohnhaus
  const own = g.city[0];
  g.fog[1].revealAll?.();
  for (const u of g.units) if (u.team === 1) u.order = { type: 'idle' };
  aiRaid(g, 1, 'normal', 1, { ...cityAiMemory(), raidTimer: 1e9 }); // Überfall fällig
  const raiders = g.units.filter((u) => u.team === 1 && u.order.type === 'attackMove');
  assert.ok(raiders.length > 0, 'Angreifer unterwegs');
  // Ziel ist ein wertvolles Gebäude (Werk, Kraftwerk, Fabrikhalle; seit v5.03 Großbauten mit eigener Mitte), kein Wohnhaus
  // (die Plätze der Angreifer liegen um das Ziel herum, bei Großbauten außerhalb des Quadrats)
  const mx = raiders.reduce((a, u) => a + u.order.x, 0) / raiders.length;
  const my = raiders.reduce((a, u) => a + u.order.y, 0) / raiders.length;
  const hit = [...own.ents.values()].sort((a, b) => Math.hypot(mx - a.x, my - a.y) - Math.hypot(mx - b.x, my - b.y))[0];
  assert.ok(Math.hypot(mx - hit.x, my - hit.y) < (hit.w * BALANCE.map.tile) / 2 + 200, 'Angreifer am Ziel');
  assert.ok((CITY.ai.targetValue[KINDS[own.kind[hit.cityCell] - 1]] ?? 1) >= 3, `Ziel ist ein Werk (${KINDS[own.kind[hit.cityCell] - 1]})`);
});

test('KI mit Stadt bildet in Kaserne und Fabrikhalle aus und baut einen Heliport [langsam]', () => {
  const g = new Game({ seed: 5, startMoney: 4000 });
  const ai = new AI(g, 1, 'normal');
  const own = () => g.units.filter((u) => u.alive && u.team === 1 && u.crew).length;
  for (let t = 0; t < 20 * 420; t++) { ai.update(0.05); g.update(0.05); }
  assert.ok(own() >= 3, `KI hat Truppen ausgebildet: ${own()}`);
  const kinds = new Set(cityTrainers(g, 1).map((e) => e.def.name));
  assert.ok(kinds.has('Kaserne') && kinds.has('Fabrikhalle'), [...kinds].join(','));
  assert.ok(kinds.has('Heliport') || g.city[1].list.some((i) => g.city[1].kind[i] === KIND_ID.heliport), 'Heliport ausgewiesen');
});

test('KI baut die Universität als 3 × 3-Großbau', () => {
  const g = new Game({ seed: 5 });
  const ai = new AI(g, 1, 'normal');
  g.teams[1].res.money = 50000;
  let a = -1;
  for (let k = 0; k < 120 && a < 0; k++) {
    aiCity(g, 1, 'normal', ai.cityMem);
    run(g, 1);
    const c = g.city[1];
    a = c.list.find((j) => c.kind[j] === KIND_ID.uni && c.part[j] - 1 === j) ?? -1;
  }
  assert.ok(a >= 0, 'KI hat eine Uni ausgewiesen');
  const c = g.city[1];
  assert.equal(cellsOf(c, a).length, 9);
  assert.ok(hasRoad(c, a % c.cols, Math.floor(a / c.cols)), 'mit Straße');
  void ai;
});

test('KI baut Werke als 2 × 2-Großbauten', () => {
  const g = new Game({ seed: 5 });
  g.teams[1].res.money = 50000;
  const c = g.city[1];
  const isWork = (j) => ['bm', 'mun', 'steel'].includes(KINDS[c.kind[j] - 1]);
  let works = [];
  const mem = cityAiMemory();
  for (let k = 0; k < 90 && works.length < 8; k++) {
    aiCity(g, 1, 'normal', mem);
    run(g, 1);
    works = c.list.filter(isWork);
  }
  assert.ok(works.length >= 8, `KI hat Werke ausgewiesen (${works.length} Zellen)`);
  assert.ok(works.every((j) => c.part[j] > 0), 'alle als Großbau');
});
