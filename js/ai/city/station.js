// Güterbahnhof der Stadt-KI (Pakete „Import“ und „Industriepark“, PRD §10 „Einfuhr“): Einfuhr-Wächter (importWatch), Anlage eines
// Industrieparks (aiStation), Auslastung (stationBusy). Der Grundriss und die Platzsuche liegen in park.js.
// Exporte: importWatch, aiStation. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { BALANCE } from '../../data/balance.js';
import { KINDS, KIND_ID, WORKS } from '../../data/citykinds.js';
import { transportOf } from '../../game/transport.js';
import { isPart, stationLinked } from '../../game/city/cells.js';
import { mainRoadReach } from '../../game/city/roadnet.js';
import { block, ready } from '../cooldown.js';
import { inDanger, cellCmd } from './common.js';
import { parkSite, parkSlots } from './park.js';

/** Produkte der Werke (Lager, in das die Einfuhr läuft): bm, metal, mun, fuel, kero. */
const PRODUCTS = WORKS.map((k) => CITY.chain[k].to);

/** Lager der Ware voll (wie storeFull in js/game/city/economy.js): Stadtlager bzw. Lager der Hauptstadt. Dann fordern Werke nichts an. */
function storeFullOf(game, c, prod) {
  if (prod === 'metal' || prod === 'kero') return c[prod] >= BALANCE.logistics.storeCap;
  const main = game.mainFob(c.team);
  return !main || main.store[prod] >= BALANCE.logistics.capitalCap;
}

/**
 * Einfuhr-Wächter (Paket „Import“, Stadt-KI): zählt die Zeit in mem.importBad (s), in der die Werke weniger Rohwaren bekommen, als ihre
 * Leistung verarbeiten könnte (Ist unter CITY.ai.importLow der Leistung), obwohl das Geld reicht (Einfuhrskala ab importScaleMin) und
 * ein Lager die Ware braucht. Jede andere Lage setzt die Zeit auf 0.
 */
export function importWatch(game, c, mem) {
  const dt = mem.importAt === null ? 0 : game.time - mem.importAt;
  mem.importAt = game.time;
  const s = c.stats ?? {};
  let cap = 0;
  let inp = 0;
  for (const p of PRODUCTS) {
    if (storeFullOf(game, c, p)) continue;
    cap += s.cap?.[p] ?? 0;
    inp += s.inp?.[p] ?? 0;
  }
  const short = cap > 0 && inp < CITY.ai.importLow * cap && (s.importScale ?? 1) >= CITY.ai.importScaleMin;
  mem.importBad = short ? mem.importBad + dt : 0;
}

/**
 * Industriepark der KI (Paket „Industriepark“, PRD §10 „Einfuhr“): ab stationFrom (Spielsekunde je Schwierigkeit) und stationWorks
 * Werken legt sie einen Güterbahnhof mit Zufahrt, vier Werksplätzen und Gleis zum Kartenrand an (parkSite, Grundriss PARK); einen
 * weiteren nur, wenn die Einfuhr über Straßen anhaltend knapp ist (importWatch, importWait s).
 * Die Werke kommen danach im normalen Ausbau auf die Plätze am Bahnhof (parkSpot, Direktlieferung ohne Straße). Nur mit Geld über
 * Reserve und stationMoney sowie Baumaterial über stationBm (die Armee geht vor). Höchstens stationMax Güterbahnhöfe; ein weiterer erst,
 * wenn jeder vorhandene angeschlossen ist und voll umbaut oder ausgelastet (stationBusy). Ohne Platz oder nach einem abgelehnten
 * Befehl sucht sie stationRetry s lang nicht neu. true, wenn gebaut.
 */
export function aiStation(game, c, main, money, reserve, difficulty, mem) {
  const A = CITY.ai;
  const from = A.stationFrom[difficulty];
  if (from == null || !main || game.time < from || !ready(mem.wait, 'station', game.time)) return false;
  const stations = c.list.filter((i) => c.kind[i] === KIND_ID.station && !isPart(c, i));
  if (stations.length >= A.stationMax || stations.some((i) => !stationLinked(c, i))) return false;
  // Den ersten Park plant sie voraus (später ist das Netz am Lager rundum bebaut und es fehlt der Platz), jeden weiteren erst bei
  // anhaltendem Einfuhrmangel
  if (stations.length && mem.importBad < A.importWait) return false;
  const reach = mainRoadReach(game, c);
  const free = (j) => !c.kind[j] && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  // Zweiter Bahnhof erst, wenn jeder vorhandene voll umbaut (kein freier Werksplatz) oder ausgelastet ist
  if (!stations.every((st) => !parkSlots(game, c, st, reach, 'bm', free, mem).length || stationBusy(game, c, st))) return false;
  let works = 0;
  for (const i of c.list) if (!isPart(c, i) && c.level[i] && WORKS.includes(KINDS[c.kind[i] - 1])) works++;
  if (works < A.stationWorks) return false;
  if (money < reserve + A.stationMoney + CITY.cost.station || main.store.bm < CITY.costBm.station + A.stationBm) return false;
  const site = parkSite(game, c, reach);
  if (!site) {
    block(mem.wait, 'station', A.stationRetry, game.time); // ohne Platz nicht jeden Takt neu suchen
    return false;
  }
  const roads = site.link.length + site.roads.length;
  const rails = site.rail.length;
  if (money < reserve + A.stationMoney + CITY.cost.station + rails * CITY.cost.rail + roads * CITY.cost.road
    || main.store.bm < CITY.costBm.station + rails * CITY.costBm.rail + roads * CITY.costBm.road + A.stationBm) {
    block(mem.wait, 'station', A.stationWait, game.time); // Platz da, Geld oder Baumaterial noch nicht: die Suche nicht jeden Takt wiederholen
    return false;
  }
  // Reihenfolge: Zufahrt vom Netz aus, Straßen des Parks, Gleis (flach, sofort fertig), zuletzt der Bahnhof (hängt dann an Straße und Gleis)
  const fail = () => {
    block(mem.wait, 'station', A.stationRetry, game.time); // abgelehnt: nicht jeden Takt neu (gebaute Straßen und Gleise bleiben stehen)
    return false;
  };
  for (const j of [...site.link, ...site.roads]) if (!game.issue(c.team, cellCmd(c, 'road', j)).ok) return fail();
  for (const j of site.rail) if (!game.issue(c.team, cellCmd(c, 'rail', j)).ok) return fail();
  if (!game.issue(c.team, cellCmd(c, 'station', site.center)).ok) return fail();
  for (const j of site.works) mem.parkKeep[j] = 1; // Werksplätze freihalten (andere Bauten und Straßen meiden sie)
  mem.importBad = 0;
  return true;
}

/**
 * Ist der Güterbahnhof `st` ausgelastet (Paket „Industriepark“)? Summe der Rohwaren, die seine Werke bei voller Besetzung je s
 * anfordern könnten (Werke, deren nächster Einfuhrpunkt er ist), ab CITY.ai.stationBusy × Durchsatz seiner Stufe (CITY.import.station).
 */
function stationBusy(game, c, st) {
  if (!c.level[st]) return false; // noch im Bau oder ohne Stufe: erst einmal wachsen lassen
  const tr = transportOf(game, c);
  let want = 0;
  for (const [w, im] of tr.imports) {
    if (im?.from !== st) continue;
    const k = KINDS[c.kind[w] - 1];
    const ch = CITY.chain[k];
    if (!ch) continue;
    const per = Object.values(ch.need).reduce((a, b) => a + b, 0);
    want += CITY.jobs[c.level[w]] * CITY.yield[ch.to] * per;
  }
  return want >= CITY.ai.stationBusy * (CITY.import.station[c.level[st]] ?? 0);
}
