// Einfuhr der Rohwaren (Paket „Import“, PRD §15): Werke beziehen Rohmaterial, Eisen, Öl und Sprengstoff von außerhalb der Karte über
// eine eigene Straße am Kartenrand oder einen Güterbahnhof mit Gleis zum Kartenrand, bezahlen je angekommener Einheit und verarbeiten sie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { GOODS, IMPORTS } from '../js/data/goods.js';
import { BALANCE } from '../js/data/balance.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { canZone, cellFree, cellAt, isPart, roadAt } from '../js/game/city/cells.js';
import { placeBuilt, placeBuiltBig, rebuildList } from '../js/game/city/state.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { transportOf, transportInfo } from '../js/game/transport.js';
import { withValue } from './util.js';

const run = (g, s) => { for (let t = 0; t < Math.round(s * 20); t++) g.update(0.05); };

/** Stadtzellen von Team 0 räumen (Startviertel samt Straße zum Rand), damit nur die Testanlage zählt. */
function clearStart(g) {
  const c = g.city[0];
  for (const i of [...c.list]) {
    const q = i % c.cols;
    const r = (i - q) / c.cols;
    g.issue(0, { type: 'city', kind: 'erase', c0: q, r0: r, c1: q, r1: r });
  }
}

/**
 * Testanlage am linken Kartenrand (Team 0): freier Streifen ab Spalte 0, Zeilen r-1 … r+4, nahe der Hauptstadt. Zeile r-1 Wohnen
 * (Spalten 2 … 7), Zeile r Straße (ab Spalte `from`), Werke darunter. Liefert { g, c, r, at(q, row) }.
 */
function site({ seed = 3, money = 100000 } = {}) {
  const g = new Game({ seed, city: true, startMoney: money });
  g.teams[0].res.money = money;
  clearStart(g);
  const c = g.city[0];
  const m = g.mainFob(0);
  const [, fr] = cellAt(c, m.x, m.y);
  const free = (q, r) => r > 0 && r < c.rows - 1 && canZone(g, c, r * c.cols + q) && !c.kind[r * c.cols + q] && cellFree(g, c, q, r);
  let r0 = -1;
  for (let d = 0; d < 60 && r0 < 0; d++) {
    for (const r of [fr - d, fr + d]) {
      let ok = true;
      for (let y = r - 2; ok && y <= r + 5; y++) for (let q = 0; ok && q <= 14; q++) ok = free(q, y);
      if (ok) { r0 = r; break; }
    }
  }
  assert.ok(r0 >= 0, 'freier Streifen am Kartenrand');
  const at = (q, row) => row * c.cols + q;
  for (let q = 2; q <= 7; q++) placeBuilt(g, c, at(q, r0 - 1), 'res');
  rebuildList(c);
  return { g, c, r: r0, at };
}

/** Straße in Zeile r von Spalte `from` bis `to` (ohne Kosten). */
function road(s, from, to, row = s.r) {
  for (let q = from; q <= to; q++) placeBuilt(s.g, s.c, s.at(q, row), 'road');
  rebuildList(s.c);
}

/** Fertiges 2 × 2-Werk mit linker oberer Ecke (q, row), an das Lager der Hauptstadt angeschlossen. Liefert den Anker. */
function works(s, kind, q, row = s.r + 1) {
  placeBuiltBig(s.g, s.c, s.at(q, row), kind);
  rebuildList(s.c);
  connectRoad(s.g, s.c, s.at(q, row), false);
  return s.at(q, row);
}

/** Einwohner sofort da (Wohnplätze voll), damit die Werke ab dem ersten Schritt arbeiten. */
function settle(s) {
  s.g.update(0.05);
  s.c.popF = s.c.stats.housing;
}

test('Straße am Kartenrand: Rohwaren kommen an, das Werk erzeugt, Ware im Lager', () => {
  const s = site();
  road(s, 0, 12);
  const a = works(s, 'bm', 8);
  settle(s);
  const m = s.g.mainFob(0);
  const bm0 = m.store.bm;
  run(s.g, 10);
  const st = s.c.stats;
  assert.equal(transportInfo(s.g, s.c, a).importFrom, 'Kartenrand');
  assert.ok(st.raw.raw > 0, `Rohmaterial ${st.raw.raw}`);
  assert.ok(st.gross.bm > 0 && m.store.bm > bm0, `BM ${bm0} → ${m.store.bm}`);
  assert.ok(Math.abs(st.gross.bm - st.raw.raw / CITY.chain.bm.need.raw) < 1e-9, 'Ausstoß = Rohware / Bedarf');
});

test('ohne Straße zum Kartenrand: keine Rohwaren, keine Erzeugung, keine Kosten', () => {
  const s = site();
  road(s, 1, 12); // Spalte 0 bleibt frei: kein Einfuhrpunkt
  const a = works(s, 'bm', 8);
  settle(s);
  const money0 = s.g.teams[0].res.money;
  run(s.g, 5);
  const st = s.c.stats;
  assert.equal(transportInfo(s.g, s.c, a).importFrom, null);
  assert.equal(st.raw.raw, 0);
  assert.equal(st.gross.bm, 0);
  assert.equal(st.importCost, 0);
  assert.ok(st.importNone >= 1, 'Werk ohne Einfuhrpunkt gezählt');
  assert.ok(s.g.teams[0].res.money >= money0, 'nichts bezahlt');
});

test('Kosten: das Team zahlt Preis × angekommene Menge', () => {
  const s = site();
  road(s, 0, 12);
  works(s, 'steel', 8);
  settle(s);
  run(s.g, 3);
  const t = s.g.teams[0];
  const before = t.res.money;
  s.g.update(0.05);
  const st = s.c.stats;
  const want = st.raw.ore * IMPORTS.ore.price;
  assert.ok(want > 0);
  assert.ok(Math.abs(st.importCost - want) < 1e-9, `Kosten ${st.importCost} ≈ ${want}`);
  assert.ok(Math.abs(st.importCostBy.ore - want) < 1e-9);
  // Kasse: + Steuer − Einfuhr in diesem Schritt
  assert.ok(Math.abs(t.res.money - (before + (st.money - st.importCost) * 0.05)) < 1e-6, 'Einfuhr von der Kasse abgezogen');
});

test('ohne Geld: keine Einfuhr, die Kasse fällt nie unter 0', () => {
  const s = site({ money: 0 });
  road(s, 0, 12);
  works(s, 'steel', 8);
  works(s, 'bm', 11);
  settle(s);
  let low = Infinity;
  for (let k = 0; k < 200; k++) {
    s.g.teams[0].res.money = 0; // keine Steuer, die nachfüllt
    s.g.update(0.05);
    low = Math.min(low, s.g.teams[0].res.money);
    assert.equal(s.c.stats.importScale, 0);
    assert.equal(s.c.stats.raw.ore, 0);
  }
  assert.ok(low >= 0, `Kasse ${low}`);
  // etwas Geld: nur so viel, wie es zahlt
  s.g.teams[0].res.money = 0.001;
  s.g.update(0.05);
  assert.ok(s.c.stats.importScale > 0 && s.c.stats.importScale < 1, `Anteil ${s.c.stats.importScale}`);
  assert.ok(s.g.teams[0].res.money >= 0);
});

test('volles Lager: keine Einfuhr, keine Kosten', () => {
  const s = site();
  road(s, 0, 12);
  works(s, 'steel', 8);
  settle(s);
  s.c.metal = BALANCE.logistics.storeCap;
  run(s.g, 3);
  s.c.metal = BALANCE.logistics.storeCap;
  s.g.update(0.05);
  assert.equal(s.c.stats.raw.ore, 0);
  assert.equal(s.c.stats.importCost, 0);
  s.c.metal = 0;
  s.g.update(0.05);
  assert.ok(s.c.stats.raw.ore > 0, 'Platz im Lager: wieder Einfuhr');
});

test('Munitionswerk braucht Eisen und Sprengstoff, beides im Verhältnis need', () => {
  const s = site();
  road(s, 0, 12);
  works(s, 'mun', 8);
  settle(s);
  const m = s.g.mainFob(0);
  const mun0 = m.store.mun;
  run(s.g, 10);
  const st = s.c.stats;
  const N = CITY.chain.mun.need;
  assert.ok(st.raw.ore > 0 && st.raw.expl > 0);
  assert.ok(Math.abs(st.raw.ore / N.ore - st.raw.expl / N.expl) < 1e-9, 'beide Rohwaren im Verhältnis');
  assert.ok(Math.abs(st.gross.mun - st.raw.expl / N.expl) < 1e-9);
  assert.ok(m.store.mun > mun0);
  // ohne Sprengstoff im Bedarf: Ausstoß folgt dem Eisen allein (Kontrolle der Formel); mit beiden gilt das kleinere
  assert.ok(st.cap.mun >= st.gross.mun - 1e-9);
});

/** Güterbahnhof 3 × 3 unter der Straße (Spalten 9 … 11, Zeilen r+1 … r+3), optional mit Gleis in Zeile r+4 bis zum Rand. */
function station(s, rail) {
  const a = s.at(10, s.r + 2);
  placeBuiltBig(s.g, s.c, a, 'station');
  if (rail) for (let q = 0; q <= 11; q++) placeBuilt(s.g, s.c, s.at(q, s.r + 4), 'rail');
  rebuildList(s.c);
  return a;
}

test('Güterbahnhof ohne Gleis führt nichts ein, mit Gleis zum Kartenrand schon', () => {
  const s = site();
  road(s, 1, 12); // keine Straße am Rand
  const w = works(s, 'steel', 6);
  const st = station(s, false);
  settle(s);
  run(s.g, 3);
  assert.equal(transportInfo(s.g, s.c, st).linked, false);
  assert.equal(s.c.stats.raw.ore, 0, 'ohne Gleis keine Einfuhr');
  for (let q = 0; q <= 11; q++) placeBuilt(s.g, s.c, s.at(q, s.r + 4), 'rail');
  rebuildList(s.c);
  run(s.g, 3);
  assert.equal(transportInfo(s.g, s.c, st).linked, true);
  assert.equal(transportInfo(s.g, s.c, w).importFrom, 'Güterbahnhof');
  assert.ok(s.c.stats.raw.ore > 0, 'mit Gleis kommt Eisen an');
  // eine Lücke im Gleis trennt ihn wieder
  s.g.issue(0, { type: 'city', kind: 'erase', c0: 5, r0: s.r + 4, c1: 5, r1: s.r + 4 });
  assert.equal(transportInfo(s.g, s.c, st).linked, false);
});

test('Durchsatz des Güterbahnhofs: zu viel Anforderung wird anteilig gekürzt', () => {
  const s = site();
  road(s, 1, 14);
  works(s, 'steel', 6);
  works(s, 'steel', 13);
  station(s, true);
  settle(s);
  run(s.g, 3);
  const free = s.c.stats.raw.ore;
  assert.ok(free > 0);
  withValue(CITY.import, 'station', [0, 0.5, 0.5, 0.5], () => {
    run(s.g, 3);
    const st = s.c.stats;
    assert.ok(st.raw.ore <= 0.5 + 1e-9, `höchstens der Durchsatz: ${st.raw.ore}`);
    assert.ok(st.raw.ore > 0 && st.raw.ore < free, 'gekürzt, aber nicht null');
    assert.ok(Math.abs(st.gross.metal / st.cap.metal - st.raw.ore / free) < 0.05, 'beide Werke anteilig');
  });
});

test('eine verstopfte Straße liefert weniger als ein Güterbahnhof bei gleichem Bedarf', () => {
  const measure = (useStation) => withValue(CITY.chain.steel.need, 'ore', 120, () => {
    const s = site();
    if (useStation) {
      road(s, 1, 12);
      station(s, true);
    } else road(s, 0, 12);
    works(s, 'steel', 7); // grenzt an den Bahnhof (Spalten 9 … 11): Lieferung ohne Straße
    settle(s);
    run(s.g, 15);
    return { raw: s.c.stats.raw.ore, want: s.c.stats.cap.metal * 120, jam: s.c.stats.jam };
  });
  const edge = measure(false);
  const st = measure(true);
  assert.ok(edge.want > CITY.transport.cap * 1.5, `Bedarf ${edge.want} über der Straßenkapazität`);
  assert.ok(edge.jam < 1, `Stau auf der Straße: ${JSON.stringify(edge)} ${JSON.stringify(st)}`);
  assert.ok(st.raw > edge.raw * 1.5, `Bahnhof ${st.raw} gegen Straße ${edge.raw}`);
});

test('Startviertel: Raffinerie führt ab Sekunde 0 Öl ein (mehrere Seeds, auch Eroberung)', () => {
  for (const opt of [{}, { river: true }, { conquest: true, players: 4 }]) {
    for (const seed of [1, 2, 5, 9, 17]) {
      const g = new Game({ seed, city: true, ...opt });
      g.update(0.05);
      for (const c of g.city) {
        assert.ok(c.stats.raw.oil > 0 && c.stats.gross.fuel > 0, `Seed ${seed} ${JSON.stringify(opt)} Team ${c.team}: Öl ${c.stats.raw.oil}`);
        const fuel = c.list.find((i) => !isPart(c, i) && c.level[i] && c.kind[i] === KIND_ID.fuel);
        assert.equal(transportInfo(g, c, fuel).importFrom, 'Kartenrand');
        assert.equal(transportOf(g, c).stations.length, 0);
      }
    }
  }
});

test('Preisregel: Einführen und Verkaufen druckt kein Geld, Einführen ist viel billiger als Kaufen', () => {
  for (const L of Object.values(CITY.chain)) {
    const cost = Object.entries(L.need).reduce((a, [g, n]) => a + n * IMPORTS[g].price, 0);
    assert.ok(cost >= GOODS[L.to].sell / CITY.market.lot - 1e-9, `${L.to}: ${cost}`);
    assert.ok(cost < GOODS[L.to].buy / CITY.market.lot / 2, `${L.to}: ${cost}`);
  }
});

test('Gleis ist keine Straße: ein Gleis bis zum Kartenrand allein bringt einem Werk keinen Einfuhrpunkt', () => {
  const s = site();
  for (let q = 0; q <= 8; q++) placeBuilt(s.g, s.c, s.at(q, s.r), 'rail'); // Gleis statt Straße vom Rand bis vor das Werk
  rebuildList(s.c);
  assert.equal(roadAt(s.c, s.at(3, s.r)), false, 'Gleiszelle zählt nicht als Straße');
  const a = works(s, 'bm', 4);
  settle(s);
  run(s.g, 20);
  const tr = transportOf(s.g, s.c);
  assert.equal(tr.imports.get(a), null, 'kein Einfuhrpunkt über das Gleis');
  assert.equal(s.c.stats.importCost, 0);
});
