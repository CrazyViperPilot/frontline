// Stadt-KI und Einfuhr (Paket „Import“, PRD §15; Industriepark seit Paket „Industriepark“): Güterbahnhof der KI (aiStation),
// Einfuhr-Wächter (importWatch) und die Geldreserve der Armee. Der erste Park kommt ohne Einfuhrmangel (vorausplanend), ein weiterer
// nur bei anhaltender Knappheit; leicht baut keinen. Die KI ändert das Spiel nur über game.issue; hier steuert der Test nur die Lage
// (Einfuhr knapp oder nicht, Geld, Schwierigkeit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { isPart, stationLinked } from '../js/game/city/cells.js';
import { aiCity, cityAiMemory } from '../js/ai/cityai.js';
import { withValue } from './util.js';

/** Güterbahnhöfe (Anker) der Stadt von Team 0. */
const stationsOf = (g) => g.city[0].list.filter((i) => g.city[0].kind[i] === KIND_ID.station && !isPart(g.city[0], i));

/**
 * `takts` Takte der Stadt-KI, je Takt 10 s Spielzeit. `short`: die Einfuhr meldet Mangel (Ist 10 von 100, Geld reicht), sonst keiner.
 * Geld wird vor jedem Takt auf `money` gesetzt (die Stadt-KI baut sonst aus dem Startgeld heraus). `difficulty`: Schwierigkeit der KI.
 */
function runCity(g, mem, takts, { short, money, difficulty = 'normal' }) {
  const c = g.city[0];
  for (let k = 0; k < takts; k++) {
    for (let t = 0; t < 200; t++) g.update(0.05);
    g.teams[0].res.money = money;
    c.stats = short ? { ...c.stats, cap: { bm: 100 }, inp: { bm: 10 }, importScale: 1 } : { ...c.stats, cap: {}, inp: {}, importScale: 1 };
    aiCity(g, 0, difficulty, mem);
  }
}

test('Güterbahnhof: die KI baut einen, der über Gleise mit dem Kartenrand verbunden ist (mit Einfuhr-Knappheit)', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    runCity(g, mem, 30, { short: true, money: 5000 });
    const st = stationsOf(g);
    assert.ok(st.length >= 1, 'ein Güterbahnhof gebaut');
    assert.ok(st.every((i) => stationLinked(g.city[0], i)), 'jeder Güterbahnhof über Gleise mit dem Kartenrand verbunden');
  }));
});

test('Güterbahnhof: die Armee geht vor, ohne Geld über Reserve, stationMoney und Bahnhofspreis baut die KI keinen', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    // Reserve (CITY.ai.reserve.normal 300) + stationMoney (100) + Bahnhof (CITY.cost.station 300) = 700; hier nur 400 Geld
    assert.ok(400 < CITY.ai.reserve.normal + CITY.ai.stationMoney + CITY.cost.station);
    runCity(g, mem, 30, { short: true, money: 400 });
    assert.equal(stationsOf(g).length, 0);
  }));
});

test('Güterbahnhof: der erste Park kommt ohne Mangel, ein zweiter erst bei anhaltendem Mangel (kurze Knappheit löst keinen aus)', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    runCity(g, mem, 1, { short: false, money: 5000 });
    assert.equal(stationsOf(g).length, 1, 'erster Park ohne Einfuhrmangel');
    assert.equal(mem.importBad, 0, 'kein Mangel gemeldet');
    runCity(g, mem, 3, { short: true, money: 5000 }); // 30 s Mangel, importWait ist 60 s
    assert.ok(mem.importBad > 0 && mem.importBad < CITY.ai.importWait, `Mangel zählt noch nicht: ${mem.importBad}`);
    assert.equal(stationsOf(g).length, 1, 'kurze Knappheit: noch kein zweiter Bahnhof');
    runCity(g, mem, 10, { short: false, money: 5000 }); // kein Mangel: Zähler fällt auf 0
    assert.equal(mem.importBad, 0);
    assert.equal(stationsOf(g).length, 1);
  }));
});

test('Güterbahnhof: Standard an für normal und schwer, aus für leicht', () => {
  assert.equal(typeof CITY.ai.stationFrom.normal, 'number', 'normal an');
  assert.equal(typeof CITY.ai.stationFrom.hard, 'number', 'schwer an');
  assert.equal(CITY.ai.stationFrom.easy, null, 'leicht aus');
  withValue(CITY.ai, 'stationWorks', 0, () => {
    // Gleiche Lage (Mangel, viel Geld, keine Werke nötig): leicht baut keinen, normal mit Startzeit 0 schon
    const easy = new Game({ seed: 3, river: true, research: true });
    runCity(easy, cityAiMemory(), 3, { short: true, money: 5000, difficulty: 'easy' });
    assert.equal(stationsOf(easy).length, 0, 'leicht baut keinen');
    withValue(CITY.ai.stationFrom, 'normal', 0, () => {
      const normal = new Game({ seed: 3, river: true, research: true });
      runCity(normal, cityAiMemory(), 1, { short: true, money: 5000 });
      assert.equal(stationsOf(normal).length, 1, 'normal baut denselben Park');
    });
  });
});
