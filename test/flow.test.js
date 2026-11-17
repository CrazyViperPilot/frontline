// Flussanzeige (js/game/flow.js, PRD §15 „Ressourcenanzeige“): Kette aus CITY.chain passt zur Simulation (updateCity),
// Engpässe werden erkannt, der Verbrauch wird gemessen. Schlägt ein Test hier fehl, wurde an Rohwaren, Werken oder Waren
// etwas geändert, ohne CITY.chain oder die Felder cap/inp/gross/raw/n in updateCity mitzupflegen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KINDS } from '../js/data/citykinds.js';
import { IMPORTS } from '../js/data/goods.js';
import { resourceFlow, flowLayout, FlowMeter, teamStock, FLOW_GOODS } from '../js/game/flow.js';

const run = (g, s, fn) => { for (let t = 0; t < s * 20; t++) { g.update(0.05); fn?.(); } };

test('CITY.chain deckt alle Rohwaren, Werke und Waren ab', () => {
  const tos = Object.values(CITY.chain).map((L) => L.to);
  const needs = Object.values(CITY.chain).flatMap((L) => Object.keys(L.need));
  for (const g of Object.keys(IMPORTS)) assert.ok(needs.includes(g), `Rohware ${g} fehlt in CITY.chain`);
  for (const g of Object.keys(CITY.yield)) assert.ok(tos.includes(g), `Ware ${g} wird in CITY.chain nicht erzeugt`);
  for (const w of Object.keys(CITY.chain)) assert.ok(KINDS.includes(w), `CITY.chain.${w} ist keine Zellenart`);
  for (const g of tos) assert.ok(FLOW_GOODS.includes(g), `Ware ${g} fehlt in FLOW_GOODS`);
  const L = flowLayout();
  for (const l of L.links) assert.ok(L.nodes[l.from].col < L.nodes[l.to].col, `Kante ${l.from} → ${l.to} läuft nach links`);
});

test('Kette seit Paket „Import“: Öl → Raffinerie und Kerosin-Raffinerie; Eisen und Sprengstoff → Munitionswerk; Eisen → Stahlwerk', () => {
  const { nodes } = flowLayout();
  assert.ok(nodes['raw:oil'].outs.includes('works:fuel') && nodes['raw:oil'].outs.includes('works:kero'));
  assert.deepEqual([...nodes['works:mun'].ins].sort(), ['raw:expl', 'raw:ore']);
  assert.ok(nodes['raw:ore'].outs.includes('works:steel'));
  assert.ok(nodes['works:steel'].outs.includes('store:metal'));
  assert.ok(nodes['works:kero'].outs.includes('store:kero'));
  assert.ok(nodes['store:kero'].col > nodes['works:kero'].col);
  assert.equal(nodes['works:mun'].ins.includes('store:metal'), false, 'Munition braucht keinen Stahl mehr');
});

test('Graph passt zu den Zahlen der Simulation', () => {
  const g = new Game({ seed: 7 });
  run(g, 90);
  const s = g.city[0].stats;
  for (const L of Object.values(CITY.chain)) {
    for (const f of ['cap', 'inp', 'gross']) assert.ok(Number.isFinite(s[f]?.[L.to]), `stats.${f}.${L.to} fehlt (updateCity)`);
  }
  const f = resourceFlow(g, 0);
  for (const [w, L] of Object.entries(CITY.chain)) {
    const n = f.nodes[`works:${w}`];
    assert.equal(n.out, s.gross[L.to]);
    assert.ok(n.out <= n.cap + 1e-9 && n.out <= n.inp + 1e-9, `${w}: mehr erzeugt als Werk oder Rohwaren hergeben`);
  }
  for (const g2 of Object.keys(IMPORTS)) {
    assert.equal(f.nodes[`raw:${g2}`].rate, s.raw[g2]);
    assert.equal(f.nodes[`raw:${g2}`].cost, s.importCostBy[g2]);
  }
  // Rohwaren je Werk passen zum Bedarf: angekommenes Öl = Eingang der Raffinerien × need
  const oil = CITY.chain.fuel.need.oil * s.inp.fuel + CITY.chain.kero.need.oil * s.inp.kero;
  assert.ok(Math.abs(oil - s.raw.oil) < 1e-9, `Öl ${s.raw.oil} ≠ ${oil}`);
  // Startviertel: eine Raffinerie, die Öl einführt
  assert.equal(f.nodes['works:fuel'].count, 1);
  assert.ok(f.nodes['raw:oil'].rate > 0);
  assert.ok(f.importCost > 0 && Math.abs(f.importCost - s.importCost) < 1e-12);
  assert.ok(f.nodes['store:fuel'].stock > 0);
});

test('Engpass: Werk wartet auf Rohwaren, ohne Einfuhrpunkt, ohne Geld, ohne Arbeiter', () => {
  const g = new Game({ seed: 7 });
  run(g, 2);
  const c = g.city[0];
  const base = { ...c.stats, fill: 1, powerRatio: 1, happy: 1, mood: 1, jobs: 10 };
  const zero = { bm: 0, metal: 0, mun: 0, kero: 0 };
  const stats = (cap, inp) => ({ ...base, raw: { raw: 0, ore: 0, oil: inp, expl: 0 }, importCostBy: { raw: 0, ore: 0, oil: inp * 0.3, expl: 0 }, cap: { ...zero, fuel: cap }, inp: { ...zero, fuel: inp }, gross: { ...zero, fuel: Math.min(cap, inp) }, n: { bm: 0, mun: 0, fuel: 1, steel: 0, kero: 0, station: 0 } });
  c.stats = stats(1, 1);
  let f = resourceFlow(g, 0);
  assert.equal(f.nodes['works:fuel'].status, 'ok');
  assert.equal(f.nodes['raw:oil'].status, 'ok');
  assert.match(f.nodes['raw:oil'].note, /Geld\/s/);
  c.stats = stats(2, 1);
  f = resourceFlow(g, 0);
  assert.equal(f.nodes['works:fuel'].status, 'warn');
  assert.match(f.issues[0].text, /Raffinerie nur 50 % ausgelastet/);
  c.stats = { ...stats(2, 0), importNone: 1 };
  f = resourceFlow(g, 0);
  assert.match(f.issues[0].text, /keinen Einfuhrpunkt/);
  c.stats = { ...stats(2, 1), importScale: 0.4 };
  f = resourceFlow(g, 0);
  assert.match(f.issues[0].text, /Geld reicht nur für 40 % der Einfuhr/);
  c.stats = { ...stats(1, 1), fill: 0.5 };
  f = resourceFlow(g, 0);
  assert.match(f.issues[0].text, /Nur 50 % der Arbeitsplätze/);
});

test('Verbrauch wird gemessen (Erzeugung + Handel − Zunahme)', () => {
  const g = new Game({ seed: 7 });
  const m = new FlowMeter(60, 1);
  const main = g.mainFob(0);
  run(g, 3, () => m.sample(g, 0));
  assert.equal(m.rates(), null); // noch keine 5 s
  run(g, 30, () => {
    main.store.bm = Math.max(0, main.store.bm - 0.1); // 2 BM/s verbraucht
    m.sample(g, 0);
  });
  const r = m.rates();
  const want = 60 / r.bm.span; // 30 s × 2 BM/s über die ganze Messspanne
  assert.ok(Math.abs(r.bm.use - want) < 0.1, `BM-Verbrauch ${r.bm.use}, erwartet ${want}`);
  const st = teamStock(g, 0);
  assert.ok(st.fuel > 0 && st.metal >= 0);
  const f = resourceFlow(g, 0, r);
  assert.ok(f.nodes['store:bm'].use > 1.5);
});
