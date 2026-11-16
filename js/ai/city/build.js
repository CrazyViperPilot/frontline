// Ausbau der Stadt-KI (PRD §15): KI-Schritt aiCity (alle ai.interval s von ai.js). Ruft Markt, Einfuhr, Güterbahnhof, Fliegerhorst,
// Straßenanschluss und Spuren auf und weist danach die nächsten Zellen aus, solange Geld über der Reserve bleibt.
// Exporte: aiCity. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { WORKS } from '../../data/citykinds.js';
import { idx, sizeOf, fitBig, bigCells, hasRoad, buildAllowed, nbrsOf } from '../../game/city/cells.js';
import { mainRoadReach, mainZone } from '../../game/city/roadnet.js';
import { block, prune } from '../cooldown.js';
import { cityAiMemory, nearCells, inDanger, aiCandidates, cellCmd, touchesRoad } from './common.js';
import { aiNeed } from './need.js';
import { parkSpot } from './park.js';
import { importWatch, aiStation } from './station.js';
import { aiEdge, linkNeeded, linkSpare, keepsOutlets, extendNet, linkField, linkPaths, atNet, aiConnect, aiLanes } from './roads.js';
import { aiAirport } from './airbase.js';
import { aiMarket } from './market.js';

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
  mem.turn++;
  let n = 0;
  // Einfuhr (Paket „Import“): ohne Einfuhrpunkt (Straße am Kartenrand zerstört oder überbaut) zuerst eine Straße zum Kartenrand
  if (money() >= CITY.cost.road + reserve && aiEdge(game, city)) n++;
  const main = game.mainFob(team);
  const fobs = game.buildings.filter((b) => b.alive && b.built && b.team === team && b.type === 'fob' && !b.main);
  let anchor = main;
  let rad = CITY.territory.main + CITY.territory.building * 4;
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
    rad = CITY.territory.main + CITY.territory.building * 4;
    if (!anchor) return;
  }
  if (aiAirport(game, city, main, reserve, CITY.ai.jets[difficulty] ?? CITY.ai.jets.normal, difficulty)) n++;
  if (n < CITY.ai.perStep && aiStation(game, city, main, money(), reserve, difficulty, mem)) n++;
  if (n < CITY.ai.perStep && aiConnect(game, city, mem.turn)) n++;
  // Spuren (Paket „Straßennetz der KI“): dauerhaft überlastete Straßen verbreitern; kostet nur Baumaterial, zählt nicht zu perStep
  const hot = aiLanes(game, city, main, mem);
  growCells(game, team, city, main, anchor, rad, n, reserve, mem, hot);
}

/**
 * Zweiter Teil des Ausbau-Schritts (aus aiCity herausgelöst, Logik unverändert): weist die nächsten Zellen um den Anker aus, solange
 * der Zähler n unter CITY.ai.perStep bleibt und das Geld über der Reserve liegt. n: schon gebaute Dinge dieses Takts, hot: Maske der
 * Zellen neben überlasteten Straßen (aiLanes).
 */
function growCells(game, team, city, main, anchor, rad, n, reserve, mem, hot) {
  const money = () => game.teams[team].res.money;
  const add = {};
  const skip = new Set(); // Großbauten, für die in diesem Takt kein Platz war
  // Ausbau: Zellen an Straßen, die mit dem Lager verbunden sind, kommen vor (aiCandidates, seit v5.20 AP4)
  let reach = mainRoadReach(game, city);
  // Wachstum vom Netz (Paket „Straßennetz der KI“): an der Hauptstadt nur Straßen, die ans Netz des Lagers anschließen, und Gebäude
  // nur an diesem Netz (keine Inseln). FOB-Viertel (anderer Anker) bleiben eigene kleine Netze.
  const grow = CITY.ai.netRoads && anchor === main && reach.some((v) => v);
  const zone = grow ? mainZone(game, city) : null;
  let links = null; // Zufahrten vom Netz über freie Zellen (linkPaths), erst bei Bedarf; nach jedem Straßenbau neu
  const cands = aiCandidates(game, city, anchor.x, anchor.y, rad, reach);
  const near = nearCells(city, reach, CITY.ai.connectNear);
  // hot: Zellen neben einer überlasteten Straße bleiben frei (dort kommt die zweite Spur hin)
  const free = (j) => !city.kind[j] && !hot[j] && !inDanger(city, j % city.cols, Math.floor(j / city.cols), game.time);
  const keep = mem.parkKeep; // Werksplätze am Güterbahnhof (Paket „Industriepark“): nur Werke dürfen dorthin
  const freeFor = (kind) => (WORKS.includes(kind) ? free : (j) => free(j) && !keep[j]);
  // Werk (2 × 2, seit v5.20 AP4): seit Paket „Industriepark“ zuerst ein freier Platz am Güterbahnhof (Direktlieferung), dann ein
  // Quadrat an einer Straße zum Lager, sonst an einer beliebigen Straße in Reichweite (aiConnect verbindet es danach, Baumaterial
  // vorausgesetzt). Ein Werk dort nur, wenn eine Zufahrt zum Netz des Lagers überhaupt möglich ist (linkable): sonst lieferte es nie.
  const isWork = (kind) => WORKS.includes(kind);
  let linkable = null; // erst bei Bedarf, einmal je Takt
  const canLink = (a, kind) => {
    linkable ??= linkField(game, city, reach);
    return bigCells(city, a, sizeOf(kind)).some((j) => nbrsOf(city, j).some((x) => linkable[x]));
  };
  const workSpot = (kind) => {
    if (isWork(kind)) {
      const spot = parkSpot(game, city, reach, kind, free, mem);
      if (spot >= 0) return spot;
    }
    for (const pass of grow ? [true] : [true, false]) {
      for (const c2 of cands) {
        if (pass ? !touchesRoad(city, c2.i, reach) : !(near[c2.i] && hasRoad(city, c2.col, c2.row))) continue;
        const a = fitBig(game, city, c2.col, c2.row, kind, freeFor(kind), (j) => buildAllowed(game, city, j, kind));
        if (a >= 0 && (pass || !isWork(kind) || canLink(a, kind))) return a;
      }
    }
    return -1;
  };
  const place = (cand) => {
    if (keep[cand.i]) return; // freigehaltener Werksplatz: keine Straße, kein anderes Gebäude
    if (!cand.road && hot[cand.i]) return; // Platz für die zweite Spur
    let kind = 'road';
    let col = cand.col;
    let row = cand.row;
    let path = null; // Straße mit Zufahrt: Zellen vom Netz bis zur Musterzelle
    if (cand.road && grow && !zone[cand.i] && !touchesRoad(city, cand.i, reach)) {
      // Musterstraße ohne Anschluss: nur mit kurzer Zufahrt vom Netz (höchstens roadLink Zellen, alle im selben Takt), sonst entstünde eine Insel
      links ??= linkPaths(game, city, reach, CITY.ai.roadLink, keep);
      if (links.dist[cand.i] < 0) return;
      path = [];
      for (let j = cand.i; j >= 0; j = links.prev[j]) path.push(j);
      path.reverse();
    }
    if (!cand.road) {
      // nur neben einer (geplanten) Straße
      if (!hasRoad(city, cand.col, cand.row)) return;
      kind = aiNeed(game, city, add, skip);
      // Wachstum vom Netz: die Straße daneben muss zum Lager führen (Wohnen und Gewerbe auch über ein Nachbarhaus gleicher Art)
      if (grow && sizeOf(kind) === 1 && !atNet(city, cand.i, kind, reach)) return;
      // Großbau (Werke 2 × 2, Kraftwerk, Universität, Kaserne, Fabrikhalle, Krankenhaus …, seit v5.20 AP4): Platz über workSpot, zuerst
      // an einer Straße zum Lager; ohne Platz gilt die Art für diesen Takt als ohne Platz und es kommt die nächste (bis zu 8 Versuche).
      // Vorher blieb ein Großbau ohne Platz an dieser Zelle stehen, und jede weitere Zelle des Takts wählte ihn erneut.
      let spot = -1;
      for (let tries = 0; sizeOf(kind) > 1 && tries < 8; tries++) {
        spot = workSpot(kind);
        if (spot >= 0) break;
        skip.add(kind);
        kind = aiNeed(game, city, add, skip);
      }
      if (sizeOf(kind) > 1) {
        if (spot < 0) return;
        col = spot % city.cols;
        row = Math.floor(spot / city.cols);
      }
    }
    if (money() < CITY.cost[kind] + reserve) {
      n = -Infinity; // Geld reicht nicht: Schluss für diesen Takt
      return;
    }
    // Netz offen halten (Paket „Straßen“, seit Paket „Offenes Netz“ auch ohne Baugebiet): kein Gebäude, das das Straßennetz einschließt (es bleiben CITY.ai.linkOutlets Ausgänge)
    if (kind !== 'road' && !keepsOutlets(game, city, sizeOf(kind) > 1 ? bigCells(city, idx(city, col, row), sizeOf(kind)) : [idx(city, col, row)])) {
      if (sizeOf(kind) > 1) skip.add(kind);
      return;
    }
    if (path) {
      for (const j of path) {
        if (!game.issue(team, cellCmd(city, 'road', j)).ok) break;
        n++;
      }
      reach = mainRoadReach(game, city);
      links = null;
      return;
    }
    const r = game.issue(team, { type: 'city', kind, c0: col, r0: row, c1: col, r1: row });
    if (r.ok && kind === 'road' && grow) {
      reach = mainRoadReach(game, city);
      links = null;
    }
    if (!r.ok) {
      if (kind !== 'road') skip.add(kind); // z. B. zu wenig Baumaterial: in diesem Takt etwas anderes (seit v5.03)
      if (isWork(kind)) block(mem.parkWait, idx(city, col, row), CITY.ai.stationRetry, game.time); // abgelehnter Werksplatz: nicht jeden Takt neu (Paket „Industriepark“)
      return;
    }
    if (kind !== 'road') add[kind] = (add[kind] ?? 0) + 1;
    n++;
  };
  for (const cand of cands) {
    if (n >= CITY.ai.perStep) return;
    place(cand);
    if (!Number.isFinite(n)) return;
  }
}
