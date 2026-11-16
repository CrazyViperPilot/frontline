// Industriepark der Stadt-KI (Paket „Industriepark“, PRD §10 „Einfuhr“, PRD §15): ein Güterbahnhof mit Parkstraßen, vier Werksplätzen
// am Bahnhof (Direktlieferung ohne Straße), Zufahrt zum Lager und Gleis zum Kartenrand (aiStation/parkSite in js/ai/cityai.js), dazu die
// Straßenkapazität der Spuren. Die KI ändert das Spiel nur über game.issue; der Test steuert nur Geld, Baumaterial und Schwierigkeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { KIND_ID, KINDS, WORKS } from '../js/data/citykinds.js';
import { AI } from '../js/ai/ai.js';
import { aiCity, cityAiMemory } from '../js/ai/cityai.js';
import { cellsOf, isPart, nbrsOf, roadAt, stationLinked } from '../js/game/city/cells.js';
import { mainRoadReach } from '../js/game/city/roadnet.js';
import { transportInfo, transportOf } from '../js/game/transport.js';
import { withValue } from './util.js';

/** Güterbahnhöfe (Anker) einer Stadt. */
const stationsOf = (c) => c.list.filter((i) => c.kind[i] === KIND_ID.station && !isPart(c, i));

/** Fertige Werke (Anker) einer Stadt. */
const worksOf = (c) => c.list.filter((i) => !isPart(c, i) && c.level[i] && WORKS.includes(KINDS[c.kind[i] - 1]));

/**
 * `takts` Takte der Stadt-KI von Team 0, je Takt 10 s Spielzeit. Geld (und optional Baumaterial im Lager der Hauptstadt) werden vor
 * jedem Takt gesetzt; keine Einfuhrknappheit (der erste Park kommt ohne Mangel).
 */
function runCity(g, mem, takts, { money, bm = null }) {
  const c = g.city[0];
  for (let k = 0; k < takts; k++) {
    for (let t = 0; t < 200; t++) g.update(0.05);
    g.teams[0].res.money = money;
    if (bm !== null) g.mainFob(0).store.bm = bm;
    c.stats = { ...c.stats, cap: {}, inp: {}, importScale: 1 };
    aiCity(g, 0, 'normal', mem);
  }
}

test('Industriepark: Bahnhof mit Gleis zum Kartenrand und Straße zum Lager', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const c = g.city[0];
    const mem = cityAiMemory();
    runCity(g, mem, 5, { money: 5000 });
    const st = stationsOf(c);
    assert.equal(st.length, 1, 'genau ein Güterbahnhof');
    assert.ok(stationLinked(c, st[0]), 'Gleis bis zum Kartenrand');
    const reach = mainRoadReach(g, c);
    const roadToStore = cellsOf(c, st[0]).flatMap((j) => nbrsOf(c, j)).filter((n) => roadAt(c, n) && reach[n]);
    assert.ok(roadToStore.length > 0, 'eine Straße am Bahnhof, die zum Lager der Hauptstadt führt');
    assert.equal(Object.keys(mem.parkKeep).length, 16, 'vier Werksplätze × vier Zellen freigehalten');
  }));
});

test('Industriepark: neue Werke entstehen direkt am Bahnhof (Lieferung ohne Straße)', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    // Seed 3: ein Werk am Park kommt nach wenigen Takten mit Geld und Baumaterial; 150 Takte als Obergrenze
    const g = new Game({ seed: 3, river: true, research: true });
    const c = g.city[0];
    const mem = cityAiMemory();
    let work = -1;
    for (let k = 0; k < 150 && work < 0; k++) {
      runCity(g, mem, 1, { money: 5000, bm: 5000 });
      work = worksOf(c).find((w) => cellsOf(c, w).some((j) => mem.parkKeep[j])) ?? -1;
    }
    assert.ok(work >= 0, 'ein Werk steht auf einem Werksplatz am Güterbahnhof');
    g.update(0.05);
    const st = stationsOf(c)[0];
    const imp = transportOf(g, c).imports.get(work);
    assert.ok(imp, 'das Werk hat einen Einfuhrpunkt');
    assert.equal(imp.from, st, 'Einfuhr vom Güterbahnhof des Parks');
    assert.equal(imp.dist, 0, 'ohne Straße: Lieferung direkt vom Bahnhof');
    assert.equal(transportInfo(g, c, work).importFrom, 'Güterbahnhof');
  }));
});

test('Industriepark: die Armee geht vor (Geldreserve), ohne Gleis', () => {
  withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const c = g.city[0];
    const mem = cityAiMemory();
    // Reserve + stationMoney + Bahnhof: eine Einheit weniger reicht nicht (Gleis und Straßen kommen noch dazu)
    const short = CITY.ai.reserve.normal + CITY.ai.stationMoney + CITY.cost.station - 1;
    runCity(g, mem, 5, { money: short, bm: 5000 });
    assert.equal(stationsOf(c).length, 0, 'kein Güterbahnhof');
    assert.ok(!c.list.some((i) => c.kind[i] === KIND_ID.rail), 'kein Gleis gelegt');
    assert.equal(Object.keys(mem.parkKeep).length, 0, 'keine Werksplätze freigehalten');
  }));
});

test('Industriepark: ohne Platz nicht jeden Takt neu suchen', () => {
  // parkLink 0 und railMax 0: der Park braucht dann eine Zufahrt direkt am Netz und ein Gleis genau am Kartenrand; beides zusammen
  // gibt an Seed 3 keinen Platz, die Suche scheitert also deterministisch. (Je einzeln gesetzt, fand die KI dort noch einen Park.)
  withValue(CITY.ai, 'parkLink', 0, () => withValue(CITY.ai, 'railMax', 0, () =>
    withValue(CITY.ai.stationFrom, 'normal', 0, () => withValue(CITY.ai, 'stationWorks', 0, () => {
    const g = new Game({ seed: 3, river: true, research: true });
    const c = g.city[0];
    const mem = cityAiMemory();
    runCity(g, mem, 1, { money: 5000, bm: 5000 });
    assert.equal(stationsOf(c).length, 0, 'ohne Gleis kein Park');
    const first = mem.wait.station;
    assert.ok(Math.abs(first - (g.time + CITY.ai.stationRetry)) < 1e-6, `Suche verschoben um stationRetry: ${first} bei ${g.time}`);
    runCity(g, mem, 3, { money: 5000, bm: 5000 }); // 30 s, noch innerhalb der Frist
    assert.equal(mem.wait.station, first, 'innerhalb der Frist keine neue Suche');
    while (g.time <= first) runCity(g, mem, 1, { money: 5000, bm: 5000 });
    // Nach der Frist sucht sie wieder: findet sie jetzt einen Platz (die Stadt ist in der Zwischenzeit gewachsen; gemessen bei 140 s),
    // baut sie den Park, sonst setzt sie die Frist neu
    assert.ok(stationsOf(c).length === 1 || mem.wait.station > first, 'nach der Frist wieder Suche');
  }))));
});

test('Straßenkapazität: eine Spur trägt CITY.transport.cap, der Güterbahnhof (Stufe 1) mehr als eine Spur', () => {
  assert.ok(CITY.transport.cap >= 18, `Spur ${CITY.transport.cap}`);
  assert.ok(CITY.import.station[1] > CITY.transport.cap, `Bahnhof ${CITY.import.station[1]} gegen Spur ${CITY.transport.cap}`);
  assert.ok(CITY.transport.mapCap >= CITY.transport.cap, 'Stadtstraßen der Karte nicht unter einer Spur');
});

test('[langsam] Industriepark: KI gegen KI, Seeds 3 und 11, 8 Spielminuten: je Seed hat eine Stadt einen angeschlossenen Güterbahnhof', () => {
  // Gemessen (normal, Straßen 24 je Spur, Seeds 3 und 11): Team 1 baut den Park bei 377 s (Seed 3) und 465 s (Seed 11), Team 0 nie
  // (sein Geld bleibt unter Reserve + stationMoney + Bahnhof ≈ 700). Die Erwartung gilt je Seed für mindestens eine der beiden Städte.
  for (const seed of [3, 11]) {
    const g = new Game({ seed, river: true, research: true });
    const ais = [0, 1].map((t) => new AI(g, t, 'normal'));
    const linked = () => g.city.some((c) => stationsOf(c).some((i) => stationLinked(c, i)));
    const steps = Math.round((8 * 60) / 0.05);
    for (let k = 0; k < steps && !linked(); k++) {
      g.update(0.05);
      ais.forEach((a) => a.update(0.05));
    }
    assert.ok(linked(), `Seed ${seed}: bis ${g.time.toFixed(0)} s ein angeschlossener Güterbahnhof`);
  }
});
