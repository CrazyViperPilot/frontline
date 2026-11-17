// Straßennetz der Stadt-KI (Paket „Straßennetz der KI“, PRD §10): „angeschlossen“ heißt Straße mit Weg zum Lager (seit dem Paket
// „Fliegerhorst-Anschluss“ ein einziger Begriff: Bahn und Rollfeld sind keine Straße), die KI baut an der Hauptstadt keine Straßen-Inseln
// und keine Werke ohne Weg zum Lager, und sie verbreitert überlastete Straßen (Spuren).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { CITY } from '../js/data/city.js';
import { KINDS, KIND_ID, WORKS } from '../js/data/citykinds.js';
import { transportOf } from '../js/game/transport.js';
import { mainRoadReach } from '../js/game/city/roadnet.js';
import { isPart, nbrsOf, cellAt, canZone, cellFree, buildAllowed, roadLinked, stationLinked } from '../js/game/city/cells.js';
import { placeBuilt, rebuildList } from '../js/game/city/state.js';
import { once } from './util.js';

test('Straßennetz: eine Straße, die nur über die Bahn des Fliegerhorsts am Lager hängt, gilt nicht als angeschlossen (mainRoadReach)', () => {
  const g = new Game({ seed: 3 });
  const c = g.city[0];
  const reach = mainRoadReach(g, c);
  const free = (j) => !c.kind[j] && !c.mapRoads?.[j] && canZone(g, c, j) && cellFree(g, c, j % c.cols, Math.floor(j / c.cols));
  // Gerade aus vier freien Zellen ab einer Straße am Lager: zwei Zellen Bahn, dahinter zwei Zellen Straße
  let run = null;
  for (let i = 0; i < reach.length && !run; i++) {
    if (!reach[i]) continue;
    for (const d of [1, -1, c.cols, -c.cols]) {
      const cells = [1, 2, 3, 4].map((k) => i + k * d);
      const row = Math.floor(i / c.cols);
      if (Math.abs(d) === 1 && cells.some((j) => Math.floor(j / c.cols) !== row)) continue;
      if (cells.some((j) => j < 0 || j >= reach.length || !free(j))) continue;
      // die beiden hinteren Zellen dürfen keine andere Straße berühren
      if (cells.slice(2).some((j) => nbrsOf(c, j).some((x) => !cells.includes(x) && (c.kind[x] || c.mapRoads?.[x])))) continue;
      run = cells;
      break;
    }
  }
  assert.ok(run, 'freie Gerade an einer Lagerstraße gefunden');
  placeBuilt(g, c, run[0], 'runway');
  placeBuilt(g, c, run[1], 'runway');
  placeBuilt(g, c, run[2], 'road');
  placeBuilt(g, c, run[3], 'road');
  rebuildList(c);
  assert.equal(mainRoadReach(g, c)[run[3]], 0, 'die Bahn ist keine Straße: kein Weg zum Lager über sie');
  assert.ok(transportOf(g, c).fields.main.dist[run[3]] < 0, 'transport.js sieht dort auch keinen Weg zum Lager');
});

/** Güterbahnhöfe (Anker) einer Stadt; angeschlossen heißt: Gleis zum Kartenrand (Industriepark). */
const stationsOf = (c) => c.list.filter((i) => c.kind[i] === KIND_ID.station && !isPart(c, i));
const parkLinked = (g) => g.city.some((c) => stationsOf(c).some((i) => stationLinked(c, i)));
const PARK_STEPS = Math.round((10 * 60) / 0.05);

/**
 * Gemeinsamer Lauf je Seed: KI gegen KI (normal) mit Fluss und Forschung, 20 Spielminuten in Schritten von 0,05 s. Daran hängen die
 * Tests „Straßennetz der KI“ (Seeds 3, 7), „Offenes Netz“ (Seed 11) und „Industriepark“ (Seeds 3, 11: die ersten 10 Minuten derselben
 * Partie). Die Abfragen unterwegs (Spuren am Start, Güterbahnhof je Schritt) lesen nur: Spielstand nach 8 min mit und ohne sie bitgleich
 * (gemessen beim Paket „Schnellere Tests“).
 */
function roadRun(seed) {
  const g = new Game({ seed, river: true, research: true });
  const ais = [new AI(g, 0, 'normal'), new AI(g, 1, 'normal')];
  const lanes0 = [0, 1].map((t) => lanesOf(g, g.city[t]));
  // Industriepark: bis 10 min (wie der frühere eigene Lauf: Abfrage vor jedem Schritt und nach dem letzten)
  let park = null;
  const steps = Math.round((20 * 60) / 0.05);
  for (let k = 0; k < steps; k++) {
    if (park === null && k <= PARK_STEPS && parkLinked(g)) park = g.time;
    g.update(0.05);
    ais[0].update(0.05);
    ais[1].update(0.05);
  }
  return { g, lanes0, park };
}
const roadRuns = Object.fromEntries([3, 7, 11].map((seed) => [seed, once(() => roadRun(seed))]));

for (const seed of [3, 7]) {
  test(`Straßennetz der KI: KI gegen KI, Seed ${seed}, 20 min: keine Werke ohne Weg zum Lager, keine Straßen-Inseln an der Hauptstadt, Spuren gebaut [langsam]`, () => {
    const { g, lanes0 } = roadRuns[seed]();
    for (let t = 0; t < 2; t++) {
      const c = g.city[t];
      const main = g.mainFob(t);
      assert.ok(main, `Team ${t}: Hauptstadt steht`);
      const tr = transportOf(g, c);
      const reach = mainRoadReach(g, c);
      let works = 0;
      let cut = 0;
      for (const i of c.list) {
        if (isPart(c, i) || !c.level[i] || !WORKS.includes(KINDS[c.kind[i] - 1])) continue;
        works++;
        if (!tr.imports.get(i) || tr.routes.get(i)?.to !== 'main') cut++;
      }
      assert.ok(works >= 15, `Team ${t}: ${works} Werke`);
      // höchstens eines darf gerade auf seinen Anschluss warten (aiConnect schließt je Takt eines an)
      assert.ok(cut <= 1, `Team ${t}: ${cut} von ${works} Werken ohne Weg zum Lager oder ohne Einfuhr`);
      // Inseln: eigene Straßen im Ausbau-Umkreis der Hauptstadt ohne Transportweg zum Lager (FOB-Viertel liegen weiter weg)
      const [mq, mr] = cellAt(c, main.x, main.y);
      const rad = CITY.territory.main + CITY.territory.building * 4;
      let roads = 0;
      let islands = 0;
      for (const i of c.list) {
        if (c.kind[i] !== KIND_ID.road) continue;
        const q = i % c.cols;
        if (Math.max(Math.abs(q - mq), Math.abs((i - q) / c.cols - mr)) > rad) continue;
        roads++;
        if (!reach[i]) islands++;
      }
      assert.ok(roads >= 80, `Team ${t}: ${roads} Straßenzellen an der Hauptstadt`);
      assert.ok(islands <= 2, `Team ${t}: ${islands} von ${roads} Straßenzellen an der Hauptstadt ohne Weg zum Lager`);
      assert.ok(lanesOf(g, c) >= lanes0[t] + 10, `Team ${t}: mehrspurige Zellen ${lanes0[t]} → ${lanesOf(g, c)}`);
    }
  });
}

// Offenes Netz (Paket „Offenes Netz“, PRD §10 „Stadt mit Anschlusspflicht“; bis zum Paket „Schnellere Tests“ in opennet.test.js): die
// Stadt-KI lässt auch ohne Baugebiet Ausgänge an ihrem Straßennetz offen (keepsOutlets in js/ai/cityai.js). Sonst ist das Netz am Lager
// nach 8 bis 15 Spielminuten rundum bebaut: kein Platz mehr für einen Industriepark, neue Werke ohne Weg zum Lager.

/** Freie Anschlusszellen am Netz des Lagers: bebaubare Straßenzellen am Netz, mit freiem Nachbarn außerhalb (Ausgänge). */
function outlets(g, c) {
  const mask = roadLinked(g, c);
  const free = (j) => !c.kind[j] && buildAllowed(g, c, j, 'road') && cellFree(g, c, j % c.cols, Math.floor(j / c.cols));
  let n = 0;
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || !free(j)) continue;
    if (nbrsOf(c, j).some((x) => !mask[x] && free(x))) n++;
  }
  return n;
}

test('Offenes Netz [langsam]: Seed 11 ohne Baugebiet, nach 20 min hat das Netz von Team 0 noch Ausgänge', () => {
  // Vorher (ohne die Regel) war das Netz hier nach rund 20 min rundum bebaut (keine freie Anschlusszelle mehr)
  const { g } = roadRuns[11]();
  assert.equal(g.buildRules, false, 'Baugebiet aus: die Regel gilt ohne Schalter');
  assert.ok(outlets(g, g.city[0]) > 0, 'Netz des Lagers hat noch Ausgänge');
});

// Industriepark (bis zum Paket „Schnellere Tests“ ein eigener Lauf in industriepark.test.js): die ersten 10 Minuten der gemeinsamen Läufe.
test('[langsam] Industriepark: KI gegen KI, Seeds 3 und 11, 10 Spielminuten: je Seed hat eine Stadt einen angeschlossenen Güterbahnhof', () => {
  // Gemessen (normal, Straßen 24 je Spur) seit dem Paket „Startaufstellung mit Stadt“: Seed 3 Team 0 bei 574 s, Team 1 bei 481 s;
  // Seed 11 Team 0 bei 646 s, Team 1 bei 385 s (vorher nur Team 1: 377 s und 465 s, Fenster 8 min). Die Erwartung gilt je Seed
  // für mindestens eine der beiden Städte.
  for (const seed of [3, 11]) {
    const { park } = roadRuns[seed]();
    assert.ok(park !== null, `Seed ${seed}: in 10 min kein angeschlossener Güterbahnhof`);
  }
});

/** Eigene Straßenzellen mit mindestens zwei Spuren. */
function lanesOf(g, c) {
  const tr = transportOf(g, c);
  let n = 0;
  for (const i of tr.list) if (c.kind[i] === KIND_ID.road && tr.lanes[i] >= 2) n++;
  return n;
}
