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
import { isPart, nbrsOf, cellAt, canZone, cellFree } from '../js/game/city/cells.js';
import { placeBuilt, rebuildList } from '../js/game/city/state.js';

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

for (const seed of [3, 7]) {
  test(`Straßennetz der KI: KI gegen KI, Seed ${seed}, 20 min: keine Werke ohne Weg zum Lager, keine Straßen-Inseln an der Hauptstadt, Spuren gebaut [langsam]`, () => {
    const g = new Game({ seed, river: true, research: true });
    const ais = [new AI(g, 0, 'normal'), new AI(g, 1, 'normal')];
    const lanes0 = [0, 1].map((t) => lanesOf(g, g.city[t]));
    const steps = Math.round((20 * 60) / 0.05);
    for (let k = 0; k < steps; k++) {
      g.update(0.05);
      ais[0].update(0.05);
      ais[1].update(0.05);
    }
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

/** Eigene Straßenzellen mit mindestens zwei Spuren. */
function lanesOf(g, c) {
  const tr = transportOf(g, c);
  let n = 0;
  for (const i of tr.list) if (c.kind[i] === KIND_ID.road && tr.lanes[i] >= 2) n++;
  return n;
}
