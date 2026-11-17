// Ausbau der Stadt-KI (PRD §15): KI-Schritt aiCity (alle ai.interval s von ai.js). Ruft Markt, Einfuhr, Güterbahnhof, Fliegerhorst,
// Straßenanschluss und Spuren auf und weist danach über growCells (grow.js) die nächsten Zellen aus, solange Geld über der Reserve bleibt.
// Exporte: aiCity. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { prune } from '../cooldown.js';
import { cityAiMemory } from './common.js';
import { importWatch, aiStation } from './station.js';
import { aiEdge, linkNeeded, linkSpare, extendNet, aiConnect, aiLanes } from './roads.js';
import { aiAirport } from './airbase.js';
import { aiMarket } from './market.js';
import { growCells } from './grow.js';

/** KI-Schritt (alle ai.interval s von ai.js): weist die nächsten Zellen aus, solange Geld über der Reserve bleibt. mem: cityAiMemory() der KI. */
export function aiCity(game, team, difficulty, mem = cityAiMemory()) {
  const city = game.city?.[team];
  if (!city) return;
  prune(mem.wait, game.time);
  prune(mem.parkWait, game.time);
  const reserve = CITY.ai.reserve[difficulty] ?? CITY.ai.reserve.normal;
  const money = () => game.teams[team].res.money;
  importWatch(game, city, mem);
  aiMarket(game, team, reserve, mem);
  const keep = reserve + (mem.hold ?? 0); // spart die Armee auf einen Jet, ruht der Ausbau darüber (Einfuhr und Anschluss nicht)
  mem.turn++;
  let n = 0;
  // Einfuhr (Paket „Import“): ohne Einfuhrpunkt (Straße am Kartenrand zerstört oder überbaut) zuerst eine Straße zum Kartenrand
  if (money() >= CITY.cost.road + reserve && aiEdge(game, city)) n++;
  const main = game.mainFob(team);
  const fobs = game.buildings.filter((b) => b.alive && b.built && b.team === team && b.type === 'fob' && !b.main);
  let anchor = main;
  let rad = CITY.territory.main + CITY.territory.building * CITY.ai.growRing;
  if (fobs.length && (mem.turn % CITY.ai.quarterEvery === 0 || !main)) {
    anchor = fobs[Math.floor(mem.turn / CITY.ai.quarterEvery) % fobs.length];
    rad = CITY.ai.quarter;
  }
  if (!anchor) return;
  // Anschlusspflicht (Paket „Straßen“): Netz verlängern, wenn um den Anker zu wenige freie Zellen an einer Straße zum Lager liegen
  // (auch ein FOB-Viertel ohne Anschluss bekommt so seine Straße); hat ein FOB-Viertel danach noch keinen Anschluss, baut dieser Takt
  // an der Hauptstadt weiter
  if (linkNeeded(game) && money() >= CITY.cost.road + reserve && extendNet(game, city, anchor, rad, mem)) n++;
  if (anchor !== main && linkNeeded(game) && !linkSpare(game, city, anchor, rad)) {
    anchor = main;
    rad = CITY.territory.main + CITY.territory.building * CITY.ai.growRing;
    if (!anchor) return;
  }
  mem.airHold = false;
  if (aiAirport(game, city, main, keep, CITY.ai.jets[difficulty] ?? CITY.ai.jets.normal, difficulty, mem)) n++;
  if (n < CITY.ai.perStep && aiStation(game, city, main, money(), keep, difficulty, mem)) n++;
  if (n < CITY.ai.perStep && aiConnect(game, city, mem.turn)) n++;
  // Spuren (Paket „Straßennetz der KI“): dauerhaft überlastete Straßen verbreitern; kostet nur Baumaterial, zählt nicht zu perStep
  const hot = aiLanes(game, city, main, mem);
  growCells(game, team, city, main, anchor, rad, n, keep + (mem.airHold ? CITY.ai.airportMoney : 0), mem, hot);
}
