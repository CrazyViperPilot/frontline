// Stadt-KI und Einfuhr (Paket „Import“, PRD §15): Güterbahnhof der KI (aiStation), Einfuhr-Wächter (importWatch) und die Geldreserve
// der Armee. Die KI ändert das Spiel nur über game.issue; hier steuert der Test nur die Lage (Einfuhr knapp oder nicht, Geld).
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
 * Geld wird vor jedem Takt auf `money` gesetzt (die Stadt-KI baut sonst aus dem Startgeld heraus).
 */
function runCity(g, mem, takts, { short, money }) {
  const c = g.city[0];
  for (let k = 0; k < takts; k++) {
    for (let t = 0; t < 200; t++) g.update(0.05);
    g.teams[0].res.money = money;
    c.stats = short ? { ...c.stats, cap: { bm: 100 }, inp: { bm: 10 }, importScale: 1 } : { ...c.stats, cap: {}, inp: {}, importScale: 1 };
    aiCity(g, 0, 'normal', mem);
  }
}

test('Güterbahnhof: bei anhaltender Einfuhr-Knappheit baut die KI einen, der an Straße und Kartenrand angeschlossen ist', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    runCity(g, mem, 30, { short: true, money: 5000 });
    const st = stationsOf(g);
    assert.ok(st.length >= 1, 'ein Güterbahnhof gebaut');
    assert.ok(st.every((i) => stationLinked(g.city[0], i)), 'jeder Güterbahnhof über Gleise mit dem Kartenrand verbunden');
  }));
});

test('Güterbahnhof: die Armee geht vor, ohne Geld über Reserve und stationMoney baut die KI keinen', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    // Reserve (300) + stationMoney (300) + Bahnhof (300) wären 900; hier nur 400 Geld
    runCity(g, mem, 30, { short: true, money: 400 });
    assert.equal(stationsOf(g).length, 0);
  }));
});

test('Güterbahnhof: kurze Knappheit (unter importWait) löst keinen Bau aus, ohne Knappheit auch nicht', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const mem = cityAiMemory();
    runCity(g, mem, 3, { short: true, money: 5000 }); // 20 s Mangel, importWait ist 60 s
    assert.ok(mem.importBad < CITY.ai.importWait, 'Mangel zählt noch nicht');
    assert.equal(stationsOf(g).length, 0);
    runCity(g, mem, 10, { short: false, money: 5000 }); // kein Mangel: Zähler fällt auf 0
    assert.equal(mem.importBad, 0);
    assert.equal(stationsOf(g).length, 0);
  }));
});

test('Güterbahnhof: standardmäßig aus (Messung im Paket „Import“: kein Gewinn), auch bei anhaltendem Mangel', () => {
  assert.equal(CITY.ai.stationFrom.normal, null, 'normal aus');
  assert.equal(CITY.ai.stationFrom.hard, null, 'hard aus');
  const g = new Game({ seed: 3, river: true, research: true });
  runCity(g, cityAiMemory(), 30, { short: true, money: 5000 });
  assert.equal(stationsOf(g).length, 0);
});
