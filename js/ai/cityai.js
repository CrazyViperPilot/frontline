// Stadt-KI (PRD §15, seit v5.60 aus js/game/city.js hierher, Review A-04): Ausbau (Ringe, Viertel, Einfuhr, Anschluss, Fliegerhorst,
// Markt), Überfälle auf die gegnerische Stadt und Verteidigung. Befehle nur über game.issue; die Buchhaltung (cityAiMemory) liegt in
// der KI-Instanz (ai.js). Kein DOM, deterministisch.
import { CITY } from '../data/city.js';
import { BALANCE } from '../data/balance.js';
import { KINDS, KIND_ID, WORKS, SUPPLIER_KINDS } from '../data/citykinds.js';
import { transportOf, transportInfo, mainAccess } from '../game/transport.js';
import { accessCells, cellAt, idx, sizeOf, isPart, fitBig, bigFits, bigCells, cellFree, roadAt, hasRoad, buildAllowed, buildWhy, canZone, nbrsOf, roadLinked, atEdge, stationLinked } from '../game/city/cells.js';
import { mainRoadReach, mainZone, connectRoad, connectCells, importReach, connectEdge } from '../game/city/roadnet.js';
import { totals } from '../game/city/state.js';
import { marketBuyPrice } from '../game/city/query.js';
import { enemiesOf, nearestOf } from '../game/teams.js';
import { gridBfs } from '../game/city/gridbfs.js';
import { block, ready, prune } from './cooldown.js';

/** Zellen höchstens `d` Schritte (4er-Nachbarschaft, alle Zellen) von einer Zelle aus `reach`, Uint8Array 1 = nah (seit v5.20, AP4). */
function nearCells(c, reach, d) {
  const n = c.cols * c.rows;
  const near = new Uint8Array(n);
  const starts = [];
  for (let i = 0; i < n; i++) if (reach[i]) starts.push(i);
  const r = gridBfs(c, starts, null, d, { scratch: true });
  for (let k = 0; k < r.count; k++) near[r.queue[k]] = 1;
  return near;
}

/** Ist die Zelle im Muster um den Anker (ac, ar) eine Straße? Jede roadEvery-te Zeile und die Spalte durch den Anker. */
function aiRoad(col, row, ac, ar) {
  const n = CITY.ai.roadEvery;
  return (((row - ar) % n) + n) % n === 0 || col === ac;
}

/**
 * Welche Zone braucht die Stadt als Nächstes? (freie Planung seit v4.85) Wohnen, wenn Wohnraum oder freie Einwohner fehlen,
 * sonst die Arbeitsstätte mit dem größten Rückstand zum Mix; knappe Sorten (Lager, Metall, Geld) zählen CITY.ai.boost-fach.
 */
function aiNeed(game, c, add, skip = null) {
  const t = totals(c);
  const A = CITY.ai;
  const count = { res: 0, com: 0, bm: 0, mun: 0, fuel: 0, steel: 0, kero: 0, market: 0, power: 0, uni: 0, dc: 0, barracks: 0, factory: 0, heliport: 0, hospital: 0 };
  for (const k in add) count[k] += add[k];
  for (const i of c.list) {
    if (isPart(c, i)) continue; // Großbau zählt einmal
    const k = KINDS[c.kind[i] - 1];
    if (k in count) count[k]++;
  }
  const work = count.com + count.bm + count.mun + count.fuel + count.steel + count.kero + count.market;
  const free = c.stats.free ?? 0;
  // Strom, Universität, Rechenzentrum (seit v4.88) nach Bedarf
  const st = c.stats;
  // Seit v5.20: Angebot bei voller Besetzung (fehlen nur Arbeiter, hilft ein weiteres Kraftwerk nicht, es braucht selbst welche)
  const supplyFull = CITY.power.base + t.power;
  if (supplyFull + (add.power ?? 0) * CITY.power.supply[1] < st.powerUse * A.powerMargin + A.powerSpare && (add.power ?? 0) < 1 && !skip?.has('power')) return 'power';
  // Wohnen zuerst (seit v5.20), wenn Arbeitsstätten keine Wohnung über die Straße erreichen (Pendler) oder Arbeiter fehlen
  if (!skip?.has('res') && count.res <= work * A.resMax && ((st.fill ?? 1) < A.lowFill || homeless(game, c))) return 'res';
  // Ausbildungsgebäude (seit v4.96): ohne sie keine Truppen; Heliport erst mit einer Arbeitsstätte
  const more = work >= A.moreFrom ? 1 : 0;
  for (const [k, n] of Object.entries(A.producers)) {
    if (k === 'heliport' && !work) continue;
    if (skip?.has(k)) continue; // Großbau ohne Platz in diesem Takt (seit v5.03 auch Kaserne und Fabrikhalle)
    if (count[k] < n + (k === 'heliport' ? 0 : more)) return k;
  }
  // Grundketten zuerst (seit v5.20), vor Krankenhaus und Universität (sonst spart die KI minutenlang für diese und kauft solange teuer
  // am Markt): ein BM-Werk; ein Stahlwerk, wenn Stahl knapp ist (seit Paket „Import“ kommen die Rohwaren von außerhalb der Karte)
  if (count.bm === 0 && !skip?.has('bm')) return 'bm';
  if (c.metal < A.lowMetal && count.steel === 0 && !skip?.has('steel')) return 'steel';
  // … und ein Munitionswerk, sobald Stahl entsteht
  if (count.steel > 0 && count.mun === 0 && !skip?.has('mun')) return 'mun';
  if (!count.hospital && work >= A.hospitalFrom && !skip?.has('hospital')) return 'hospital';
  if (!count.uni && work >= A.uniFrom && !skip?.has('uni')) return 'uni';
  if (!count.dc && count.uni && work >= A.dcFrom && !skip?.has('dc')) return 'dc';
  if (count.res < work * A.resPerWork || (t.housing + t.fled < c.drafted + A.draftSpare && count.res <= work * A.resMax) || (free < A.lowFree && count.res <= work * A.resMax)) return 'res';
  const main = game.mainFob(c.team);
  const low = {
    bm: main && main.store.bm < A.lowStock, // seit Paket „Import“: knapp heißt knapp (Rohwaren gibt es immer, gegen Geld)
    mun: main && main.store.mun < A.lowStock,
    fuel: main && main.store.fuel < A.lowStock,
    kero: c.kero < A.lowKero, // Kerosin knapp (seit v5.20)
    steel: c.metal < A.lowMetal,
    com: game.teams[c.team].res.money < A.lowMoney,
  };
  // Überschuss (Paket „Straßennetz der KI“): liegt eine Ware über highStock im Lager, kommt kein weiteres Werk dafür (es kostete nur
  // Einfuhrgeld und Straßenkapazität)
  const high = {
    bm: main && main.store.bm > A.highStock,
    mun: main && main.store.mun > A.highStock,
    fuel: main && main.store.fuel > A.highStock,
    kero: c.kero > A.highStock,
    steel: c.metal > A.highStock,
  };
  let best = null;
  let lo = Infinity;
  for (const [k, w] of Object.entries(A.mix)) {
    if (k === 'market' && count.market >= 1) continue; // ein Markt reicht
    if (high[k]) continue;
    if (skip?.has(k)) continue; // Großbau ohne Platz in diesem Takt (seit v5.08 auch die 2 × 2-Werke)
    // Kerosin-Raffinerie nur, wenn Kerosin knapp wird (seit v5.20)
    if (k === 'kero' && !low.kero) continue;
    const r = count[k] / (w * (low[k] ? A.boost : 1));
    if (r < lo) {
      lo = r;
      best = k;
    }
  }
  return best ?? 'res';
}

/** Hat eine fertige Arbeitsstätte keinen Pendlerweg zu einer Wohnung (transport.js)? */
function homeless(game, c) {
  for (const p of transportOf(game, c).commute.values()) if (p === null) return true;
  return false;
}

/** Liegt die Zelle nahe einem frischen Treffer auf die eigene Stadt? */
function inDanger(c, col, row, now) {
  const R = CITY.ai.dangerRadius;
  for (const h of c.hitLog ?? []) {
    if (h.t < now - CITY.ai.dangerTime) continue;
    if (Math.abs(Math.floor(h.x / c.cell) - col) <= R && Math.abs(Math.floor(h.y / c.cell) - row) <= R) return true;
  }
  return false;
}

/** Freie Zellen um den Anker (Weltpunkt), nach Abstand sortiert (Ringe), bis zum Radius in Zellen. */
function aiCandidates(game, c, x, y, rad, reach) {
  const [ac, ar] = cellAt(c, x, y);
  const out = [];
  for (let row = Math.max(0, ar - rad); row <= Math.min(c.rows - 1, ar + rad); row++) {
    for (let col = Math.max(0, ac - rad); col <= Math.min(c.cols - 1, ac + rad); col++) {
      const i = idx(c, col, row);
      if (c.kind[i] || !buildAllowed(game, c, i) || inDanger(c, col, row, game.time) || !cellFree(game, c, col, row)) continue; // Fels, Wasser oder Gebäude: dort wüchse nie etwas
      // seit v5.20 (AP4): Zellen neben einer Straße zum Lager zählen einen Ring näher (Werke und Großbauten zuerst dort)
      const far = reach && !touchesRoad(c, i, reach) ? CITY.ai.connectRing * 100 : 0;
      const d = Math.max(Math.abs(col - ac), Math.abs(row - ar)) * 100 + Math.abs(col - ac) + Math.abs(row - ar) + far;
      out.push({ i, col, row, d, road: aiRoad(col, row, ac, ar) });
    }
  }
  out.sort((a, b) => a.d - b.d || a.i - b.i);
  return out;
}

/**
 * Buchhaltung der Stadt-KI (liegt in der KI-Instanz, ai.js `cityMem`). Ein Feld je Zeile, Erläuterung am Feld. Sperrzeiten sind Tabellen
 * Schlüssel → Spielzeit (s) und laufen über cooldown.js (block, ready, prune). Ältere Stände ergänzt ai.js restoreMemory.
 */
export function cityAiMemory() {
  return {
    turn: 0, // Ausbautakte von aiCity (zählt hoch; wählt das Viertel, das als Nächstes ausgebaut wird)
    raidTimer: 0, // s seit dem letzten Überfall auf die gegnerische Stadt (aiRaid)
    importBad: 0, // s, in denen die Einfuhr knapp ist (importWatch; ohne Mangel zurück auf 0)
    importAt: null, // Spielzeit des letzten Einfuhr-Wächters (null = noch nie)
    steelWant: null, // offener Stahlbedarf { amount, cost, time, max? } einer gescheiterten Ausbildung (produce.js; aiMarket kauft dann)
    laneHot: {}, // überlastete Straßenzelle → Takte in Folge über der Last (aiLanes)
    parkKeep: {}, // Zelle → 1: Werksplätze am Güterbahnhof, nur Werke dürfen dorthin (Industriepark)
    wait: {}, // einzelne Sperren: 'station' = Suche nach Güterbahnhof, 'defend' = Verteidigungsbefehl; Wert: Spielzeit bis
    parkWait: {}, // Werksplatz-Anker → Spielzeit, bis zu der er nach einer Ablehnung nicht erneut versucht wird
    linkWait: {}, // Startzelle des Straßenanschlusses ohne Weg → Spielzeit bis
    laneWait: {}, // überlastete Straßenzelle ohne Platz für eine zweite Spur → Spielzeit bis
  };
}

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
function importWatch(game, c, mem) {
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
function aiStation(game, c, main, money, reserve, difficulty, mem) {
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

// Grundriss des Industrieparks (Paket „Industriepark“), 9 × 5 Zellen, Gleis nach unten: r = Straße, S = Güterbahnhof (3 × 3),
// W = Werksplatz (2 × 2, grenzt an den Bahnhof und an eine Straße), g = erste Gleiszelle (von dort zum Kartenrand), . = frei.
// Gedreht in vier Richtungen.
const PARK = [
  'rrrrrrrrr',
  'rWWSSSWWr',
  'rWWSSSWWr',
  'rWWSSSWWr',
  'rWW.g.WWr',
];

/** Zellen des Grundrisses je Drehung (0–3): { w, h, road: [[x, y]], work: [[x, y]], station: [x, y] (Mitte), rail: [x, y] }. */
const PARK_TURNS = (() => {
  const W = PARK[0].length;
  const H = PARK.length;
  const turn = [(x, y) => [x, y], (x, y) => [H - 1 - y, x], (x, y) => [W - 1 - x, H - 1 - y], (x, y) => [y, W - 1 - x]];
  return turn.map((f, t) => {
    const out = { w: t % 2 ? H : W, h: t % 2 ? W : H, road: [], work: [], station: f(4, 2), rail: null };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = PARK[y][x];
        if (ch === 'r') out.road.push(f(x, y));
        else if (ch === 'W') out.work.push(f(x, y));
        else if (ch === 'g') out.rail = f(x, y);
      }
    }
    return out;
  });
})();

/**
 * Platz für den Industriepark (Paket „Industriepark“): Grundriss PARK in einer der vier Drehungen auf freien, ausweisbaren Zellen
 * (Straßen und Gleis nach der Straßenregel, Bahnhof und Werke nach der Gebäuderegel; fehlender Straßenanschluss zählt nicht, die Zufahrt
 * kommt mit), dazu eine bezahlte Zufahrt vom Straßennetz des Lagers (`reach`) zu einer Parkstraße (höchstens parkLink Zellen) und ein
 * Gleis von der Gleiszelle bis zum Kartenrand (höchstens railMax Zellen), beides nicht über den Park. Bewertet wird Gleislänge +
 * parkLinkCost × Zufahrt + stationNear × Abstand zum nächsten Werk; feste Reihenfolge bei Gleichstand. Liefert { center, roads, link,
 * rail, works } (Zellindizes; link vom Netz zum Park, rail vom Park zum Rand, works = Zellen der Werksplätze) oder null.
 */
function parkSite(game, c, reach) {
  const A = CITY.ai;
  const n = c.cols * c.rows;
  const cols = c.cols;
  const danger = (j) => inDanger(c, j % cols, Math.floor(j / cols), game.time);
  const open = (j) => !c.kind[j] && !c.mapRoads?.[j] && cellFree(game, c, j % cols, Math.floor(j / cols)) && !danger(j);
  const roadOk = (j) => open(j) && buildAllowed(game, c, j, 'road');
  const railOk = (j) => open(j) && buildAllowed(game, c, j, 'rail');
  const houseOk = (j, kind) => {
    if (!open(j) || !canZone(game, c, j)) return false;
    const why = buildWhy(game, c, j, kind);
    return why === null || why === 'road';
  };
  // BFS-Felder: Zufahrt vom Netz des Lagers (über freie Straßenzellen) und Gleis vom Kartenrand (über freie Gleiszellen)
  const linkStart = [];
  for (let j = 0; j < n; j++) if (roadOk(j) && nbrsOf(c, j).some((x) => reach[x] && roadAt(c, x))) linkStart.push(j);
  if (!linkStart.length) return null;
  const link = gridBfs(c, linkStart, roadOk, A.parkLink); // dist 0 = Zelle direkt am Netz (wird selbst Straße)
  const edge = [];
  for (let j = 0; j < n; j++) if (atEdge(c, j) && railOk(j)) edge.push(j);
  const rail = gridBfs(c, edge, railOk, A.railMax);
  const works = [];
  for (const i of c.list) if (!isPart(c, i) && c.level[i] && WORKS.includes(KINDS[c.kind[i] - 1])) works.push(i);
  // Suchfenster: Zellen höchstens parkLink + Parkgröße um die Zufahrt
  let q0 = cols;
  let q1 = -1;
  let r0 = c.rows;
  let r1 = -1;
  for (let j = 0; j < n; j++) {
    if (link.dist[j] < 0) continue;
    const q = j % cols;
    const r = (j - q) / cols;
    if (q < q0) q0 = q;
    if (q > q1) q1 = q;
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
  }
  let best = null;
  for (let t = 0; t < 4; t++) {
    const P = PARK_TURNS[t];
    for (let oy = Math.max(0, r0 - P.h); oy <= Math.min(c.rows - P.h, r1); oy++) {
      for (let ox = Math.max(0, q0 - P.w); ox <= Math.min(cols - P.w, q1); ox++) {
        const at = ([x, y]) => (oy + y) * cols + ox + x;
        const g = at(P.rail);
        if (rail.dist[g] < 0) continue;
        // Zufahrt: die Parkstraße mit der kürzesten Zufahrt
        let lk = Infinity;
        let lj = -1;
        let ok = true;
        for (const p of P.road) {
          const j = at(p);
          if (!roadOk(j)) {
            ok = false;
            break;
          }
          if (link.dist[j] >= 0 && link.dist[j] < lk) {
            lk = link.dist[j];
            lj = j;
          }
        }
        if (!ok || lj < 0) continue;
        const [sx, sy] = P.station;
        for (let y = sy - 1; y <= sy + 1 && ok; y++) for (let x = sx - 1; x <= sx + 1 && ok; x++) ok = houseOk(at([x, y]), 'station');
        for (const p of P.work) if (ok) ok = houseOk(at(p), 'bm');
        if (!ok) continue;
        let wd = 0;
        if (works.length) {
          wd = Infinity;
          for (const w of works) wd = Math.min(wd, Math.max(Math.abs((w % cols) - (ox + sx)), Math.abs(Math.floor(w / cols) - (oy + sy))));
        }
        const score = rail.dist[g] + A.parkLinkCost * lk + A.stationNear * wd;
        if (best && score >= best.score) continue;
        best = { score, t, ox, oy, lj, g };
      }
    }
  }
  if (!best) return null;
  const P = PARK_TURNS[best.t];
  const at = ([x, y]) => (best.oy + y) * cols + best.ox + x;
  const foot = new Set();
  const roads = P.road.map(at);
  const workCells = P.work.map(at);
  const [sx, sy] = P.station;
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) foot.add(at([x, y]));
  for (const j of [...roads, ...workCells]) foot.add(j);
  // Zufahrt: vom Netz (dist 0) bis zur Parkstraße, ohne die Parkstraße selbst; Gleis: von der Gleiszelle bis zum Rand
  const linkPath = [];
  for (let i = link.prev[best.lj]; i >= 0 && !roads.includes(i); i = link.dist[i] > 0 ? link.prev[i] : -1) linkPath.push(i);
  linkPath.reverse();
  const railPath = [];
  for (let i = best.g; i >= 0; i = rail.dist[i] > 0 ? rail.prev[i] : -1) railPath.push(i);
  if (linkPath.some((j) => foot.has(j)) || railPath.some((j) => foot.has(j) || linkPath.includes(j))) return null;
  // Parkstraßen ab der Zufahrt der Reihe nach (bei Anschlusspflicht wächst die Straße so am Netz entlang)
  const order = [best.lj];
  const seen = new Set(order);
  for (let h = 0; h < order.length; h++) for (const j of nbrsOf(c, order[h])) if (roads.includes(j) && !seen.has(j)) seen.add(j), order.push(j);
  return { center: at(P.station), roads: order, link: linkPath, rail: railPath, works: workCells };
}

/**
 * Werksplätze am Güterbahnhof (Paket „Industriepark“): Anker (links oben) der freien 2 × 2-Quadrate, die an das 3 × 3-Quadrat um
 * `center` grenzen (4er-Nachbarschaft, dann Direktlieferung ohne Straße) und mit einer Zelle an einer Straße zum Lager liegen (das
 * Produkt fährt über die Straße; `reach` = mainRoadReach). `free(j)`: Zelle frei; ausweisbar für `kind` prüft buildAllowed. Plätze,
 * an denen ein Bau zuletzt abgelehnt wurde (mem.parkWait), zählen CITY.ai.stationRetry s nicht. Feste Reihenfolge (nach Anker).
 */
function parkSlots(game, c, center, reach, kind, free, mem = null) {
  const sc = center % c.cols;
  const sr = (center - sc) / c.cols;
  const anchors = [];
  for (let q = sc - 2; q <= sc + 1; q++) anchors.push([q, sr - 3], [q, sr + 2]); // oben, unten
  for (let r = sr - 2; r <= sr + 1; r++) anchors.push([sc - 3, r], [sc + 2, r]); // links, rechts
  const out = [];
  for (const [q, r] of anchors) {
    if (q < 0 || r < 0 || q + 1 >= c.cols || r + 1 >= c.rows) continue;
    const a = r * c.cols + q;
    if (mem && !ready(mem.parkWait, a, game.time)) continue;
    if (!bigFits(game, c, a, 2, free, (j) => buildAllowed(game, c, j, kind))) continue;
    if (!bigCells(c, a, 2).some((j) => touchesRoad(c, j, reach))) continue;
    out.push(a);
  }
  return out.sort((p, o) => p - o);
}

/**
 * Freier Werksplatz an einem Güterbahnhof der Stadt, dessen Gleis bis zum Kartenrand reicht (auch im Bau), für ein Werk der Art `kind`
 * (Paket „Industriepark“): Anker des 2 × 2-Quadrats oder −1. Bahnhöfe der Reihe nach (nach Anker).
 */
function parkSpot(game, c, reach, kind, free, mem) {
  for (const st of c.list) {
    if (c.kind[st] !== KIND_ID.station || isPart(c, st) || !stationLinked(c, st)) continue;
    const slots = parkSlots(game, c, st, reach, kind, free, mem);
    if (slots.length) return slots[0];
  }
  return -1;
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

/** Befehl „Zelle j als Art kind bauen“ (ein Feld des Rasters). */
function cellCmd(c, kind, j) {
  const q = j % c.cols;
  const r = (j - q) / c.cols;
  return { type: 'city', kind, c0: q, r0: r, c1: q, r1: r };
}

/**
 * Straße zum Kartenrand (Paket „Import“, kleinste Regel): erreicht kein Einfuhrpunkt die Stadt (keine eigene Straße am Rand, kein
 * angeschlossener Güterbahnhof), legt die KI vom Straßennetz am Lager aus den kürzesten Weg zum Rand (bezahlt, höchstens
 * CITY.transport.connectMax Zellen). true, wenn gebaut.
 */
function aiEdge(game, c) {
  if (!importReach(c)) return connectEdge(game, c, mainAccess(game, c), true, CITY.transport.connectMax) > 0;
  // Werk an einem Straßennetz ohne Einfuhrpunkt (z. B. ein Viertel, das nur über das Lager mit dem Rest hängt): eigene Straße vom
  // Netz des Werks zum Rand, wenn sie kurz genug ist (aiConnect versucht danach den Anschluss an das Netz der Einfuhrpunkte)
  for (const i of c.list) {
    if (isPart(c, i) || !c.level[i] || !WORKS.includes(KINDS[c.kind[i] - 1])) continue;
    if (transportInfo(game, c, i).importFrom !== null) continue;
    const acc = accessCells(c, i);
    if (acc.length && connectEdge(game, c, acc, true, CITY.transport.connectMax) > 0) return true;
  }
  return false;
}

/**
 * Dürfen an dieser Stelle Stellplätze stehen (Gebiet, Erkundung, Feind, Konfliktzone, Regel wie für den Stellplatz selbst, also mit dem
 * erlaubten Überstand eines Großbaus)? Rechteck (q, r, w × h) = die Zellen der ersten beiden Stellplätze neben der Bahn.
 */
function standsAllowed(game, c, q, r, w, h) {
  for (let y = r; y < r + h; y++) {
    for (let x = q; x < q + w; x++) {
      const j = y * c.cols + x;
      if (!canZone(game, c, j) || buildWhy(game, c, j, 'stand') !== null) return false;
    }
  }
  return true;
}

/** Straßenzellen, die der Transport vom Lager der Hauptstadt aus erreicht (Ziel für den Anschluss eines Ausbildungsgebäudes). */
function supplyGoal(game, c) {
  const dist = transportOf(game, c).fields.main.dist;
  const goal = new Uint8Array(dist.length);
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) goal[i] = 1;
  return goal;
}

/** Gilt die Anschlusspflicht des Baugebiets (Paket „Straßen“)? */
function linkNeeded(game) {
  return !!game.buildRules && CITY.build.needRoad;
}

/** Freie, bebaubare Zellen im Umkreis `rad` (Zellen) um den Anker, die an einer Straße zum Lager liegen (gezählt bis CITY.ai.linkSpare). */
function linkSpare(game, c, anchor, rad) {
  const mask = roadLinked(game, c);
  const [ac, ar] = cellAt(c, anchor.x, anchor.y);
  let n = 0;
  for (let r = Math.max(0, ar - rad); r <= Math.min(c.rows - 1, ar + rad); r++) {
    for (let q = Math.max(0, ac - rad); q <= Math.min(c.cols - 1, ac + rad); q++) {
      const j = r * c.cols + q;
      if (mask[j] && !c.kind[j] && buildAllowed(game, c, j) && cellFree(game, c, q, r) && ++n >= CITY.ai.linkSpare) return n;
    }
  }
  return n;
}

/** Für eine Straße frei: leer, ausweisbar (Baugebiet für Straßen), ohne Hindernis. */
function roadFree(game, c, j) {
  return !c.kind[j] && buildAllowed(game, c, j, 'road') && cellFree(game, c, j % c.cols, Math.floor(j / c.cols));
}

/** Ausgänge des Netzes: freie Zelle j an einer Straße zum Lager mit einem freien Nachbarn x außerhalb des Netzes ([{ j, x }]). */
function outletsOf(game, c) {
  const mask = roadLinked(game, c);
  const out = [];
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || !roadFree(game, c, j)) continue;
    for (const x of nbrsOf(c, j)) if (!mask[x] && roadFree(game, c, x)) out.push({ j, x });
  }
  return out;
}

/**
 * Bleibt das Straßennetz offen, wenn die Zellen `cells` bebaut werden? true, wenn danach noch CITY.ai.linkOutlets Ausgänge bleiben
 * oder schon vorher weniger da waren (dann verhindert diese Regel nichts mehr; extendNet sucht dann einen neuen Weg).
 */
function keepsOutlets(game, c, cells) {
  const taken = new Set(cells);
  const before = new Set();
  const after = new Set();
  for (const o of outletsOf(game, c)) {
    before.add(o.j);
    if (!taken.has(o.j) && !taken.has(o.x)) after.add(o.j);
  }
  return after.size >= CITY.ai.linkOutlets || before.size < CITY.ai.linkOutlets;
}

/**
 * Netz verlängern (Paket „Straßen“): liegen um den Anker weniger als CITY.ai.linkSpare freie Anschlusszellen und hat das Lager
 * mindestens CITY.ai.linkBm Baumaterial, legt die KI eine Straße. Ohne freie Anschlusszelle (z. B. FOB-Viertel ohne Anschluss) zuerst eine
 * Straße zur Lagerstraße (connectNear); sonst eine Straßenzelle auf den Ausgang mit dem meisten freien Land im eigenen Gebiet dahinter
 * (bei Gleichstand der nächste zum Anker). true, wenn gebaut.
 */
function extendNet(game, c, anchor, rad, mem) {
  const main = game.mainFob(c.team);
  if (!main || main.store.bm < CITY.ai.linkBm) return false; // Baumaterial zuerst für Gebäude und Anschlüsse der Werke
  const spare = linkSpare(game, c, anchor, rad);
  if (spare >= CITY.ai.linkSpare) return false;
  const outs = outletsOf(game, c);
  const [ac, ar] = cellAt(c, anchor.x, anchor.y);
  if (spare === 0 && connectNear(game, c, ac, ar, rad, mem)) return true;
  const mask = roadLinked(game, c);
  let best = null;
  for (const o of outs) {
    const xq = o.x % c.cols;
    const xr = (o.x - xq) / c.cols;
    if (inDanger(c, xq, xr, game.time)) continue;
    let room = 0; // freies Land im eigenen Gebiet ohne Anschluss im Umkreis von 2 Zellen hinter dem Ausgang
    for (let r = Math.max(0, xr - 2); r <= Math.min(c.rows - 1, xr + 2); r++) {
      for (let q = Math.max(0, xq - 2); q <= Math.min(c.cols - 1, xq + 2); q++) {
        const y = r * c.cols + q;
        if (!mask[y] && c.claim[y] && roadFree(game, c, y)) room++;
      }
    }
    const jq = o.j % c.cols;
    const d = Math.abs(jq - ac) + Math.abs((o.j - jq) / c.cols - ar);
    if (!best || room > best.room || (room === best.room && (d < best.d || (d === best.d && o.j < best.j)))) best = { j: o.j, room, d };
  }
  if (best && best.room > 0) {
    const q = best.j % c.cols;
    const r = (best.j - q) / c.cols;
    if (game.issue(c.team, { type: 'city', kind: 'road', c0: q, r0: r, c1: q, r1: r }).ok) return true;
  }
  return false;
}

/**
 * Straße (connectRoad, bezahlt) ab der nächsten freien Zelle im eigenen Gebiet ohne Anschluss um (ac, ar), Ringe nach außen; höchstens
 * CITY.ai.linkTries Versuche je Takt. Startzellen ohne Weg (eingeschlossene Lücken) merkt sich die KI CITY.ai.linkRetry s in mem.linkWait.
 */
function connectNear(game, c, ac, ar, rad, mem) {
  const mask = roadLinked(game, c);
  const fail = mem.linkWait;
  prune(fail, game.time);
  let tries = 0;
  for (let d = 1; d <= rad && tries < CITY.ai.linkTries; d++) {
    for (let dy = -d; dy <= d && tries < CITY.ai.linkTries; dy++) {
      for (let dx = -d; dx <= d && tries < CITY.ai.linkTries; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const q = ac + dx;
        const r = ar + dy;
        if (q < 0 || r < 0 || q >= c.cols || r >= c.rows) continue;
        const j = idx(c, q, r);
        if (!ready(fail, j, game.time) || !c.claim[j] || mask[j] || !roadFree(game, c, j) || inDanger(c, q, r, game.time)) continue;
        tries++;
        if (connectRoad(game, c, j, true) > 0) return true;
        block(fail, j, CITY.ai.linkRetry, game.time);
      }
    }
  }
  return false;
}

/**
 * Zellen, von denen aus die KI eine Straße zum Netz des Lagers ziehen könnte (Paket „Industriepark“): Breitensuche ab den Straßen in
 * `reach` (mainRoadReach) über Straßen und freie, für Straßen ausweisbare Zellen, höchstens CITY.transport.connectMax Schritte
 * (wie connectRoad). Uint8Array, 1 = erreichbar.
 */
function linkField(game, c, reach) {
  const n = c.cols * c.rows;
  const starts = [];
  for (let j = 0; j < n; j++) if (reach[j] && roadAt(c, j)) starts.push(j);
  const r = gridBfs(c, starts, (j) => roadAt(c, j) || roadFree(game, c, j), CITY.transport.connectMax, { scratch: true });
  const seen = new Uint8Array(n);
  for (let k = 0; k < r.count; k++) seen[r.queue[k]] = 1;
  return seen;
}

/**
 * Zufahrten vom Netz des Lagers (Paket „Straßennetz der KI“): Breitensuche ab den freien Zellen direkt an einer Straße in `reach`
 * über freie, für Straßen ausweisbare Zellen (ohne freigehaltene Werksplätze `keep`), höchstens `max` Zellen. dist = Zahl neuer
 * Straßenzellen bis zu dieser Zelle (1 = liegt am Netz, −1 = zu weit oder kein Weg), prev = Vorgänger Richtung Netz (−1 am Netz).
 */
function linkPaths(game, c, reach, max, keep) {
  const n = c.cols * c.rows;
  const ok = (j) => !keep[j] && roadFree(game, c, j) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  // Startzellen: freie Nachbarn des Netzes, Abstand 1 (base), doppelte zählt gridBfs einmal
  const starts = [];
  for (let j = 0; j < n; j++) {
    if (!reach[j]) continue;
    for (const x of nbrsOf(c, j)) if (ok(x)) starts.push(x);
  }
  const r = gridBfs(c, starts, ok, max, { base: 1 });
  return { dist: r.dist, prev: r.prev };
}

/** Liegt Zelle i für ein 1 × 1-Gebäude der Art `kind` am Netz des Lagers: Straße aus `reach` daneben, Wohnen und Gewerbe auch über ein Nachbarhaus gleicher Art, das selbst dort liegt (Kette wie hasRoad). */
function atNet(c, i, kind, reach) {
  if (touchesRoad(c, i, reach)) return true;
  if (kind !== 'res' && kind !== 'com') return false;
  const id = KIND_ID[kind];
  return nbrsOf(c, i).some((j) => c.kind[j] === id && touchesRoad(c, j, reach));
}

/** Liegt eine verbundene Straße (mit dem Lager) neben Zelle i? */
function touchesRoad(c, i, reach) {
  return nbrsOf(c, i).some((j) => reach[j] && roadAt(c, j));
}

/**
 * Straßenanschluss der KI (seit v5.20, AP4): höchstens ein Gebäude je Takt, dem der Weg fehlt (Werk ohne Lieferweg zum Lager, seit
 * Paket „Import“ Werk ohne Weg zu einem Einfuhrpunkt, Arbeitsstätte ohne Pendlerweg, seit dem Paket „Straßen“ Ausbildungsgebäude ohne Weg zum Lager). Prüft höchstens CITY.ai.roadTries Gebäude. true, wenn gebaut.
 */
function aiConnect(game, c, off) {
  let tried = 0;
  const list = c.list;
  // off: Ausbautakt der KI; der Anfang wandert mit jedem Takt, damit auch hintere Gebäude drankommen
  for (let s = 0; s < list.length && tried < CITY.ai.roadTries; s++) {
    const i = list[(s + off) % list.length];
    if (isPart(c, i) || !c.kind[i]) continue;
    const k = KINDS[c.kind[i] - 1];
    const info = transportInfo(game, c, i);
    const supplier = SUPPLIER_KINDS.includes(k) && info.to === null;
    const noImport = info.importFrom === null; // Werk ohne Weg zu einem Einfuhrpunkt (Paket „Import“)
    const trainer = !!CITY.produces[k] && transportOf(game, c).supply.get(i) === null; // Ausbildung ohne Straßenweg zum Lager steht (Paket „Straßen“)
    if (!supplier && !noImport && !info.noHome && !trainer) continue;
    tried++;
    // Ausbildung ohne Versorgungsweg: Ziel ist das Straßennetz am Lager (Bahn und Rollfeld sind keine Straße). Werk ohne Einfuhr: Ziel ist
    // das Straßennetz der Einfuhrpunkte (gibt es keines, legt aiEdge zuerst die Straße zum Rand).
    const goal = noImport && !supplier ? importReach(c) : trainer ? supplyGoal(game, c) : null;
    if (noImport && !supplier && !goal) continue;
    if (connectRoad(game, c, i, true, goal) > 0) return true;
  }
  return false;
}

/** Länge der Straßenreihe durch Zelle i in Richtung (dq, dr) und zurück, wenn die Zellen in `extra` auch Straße wären. */
function roadRun(c, tr, i, dq, dr, extra) {
  const q0 = i % c.cols;
  const r0 = (i - q0) / c.cols;
  let len = 1;
  for (const s of [1, -1]) {
    for (let q = q0 + s * dq, r = r0 + s * dr; q >= 0 && r >= 0 && q < c.cols && r < c.rows; q += s * dq, r += s * dr) {
      const j = r * c.cols + q;
      if (!(tr.cap[j] > 0) && j !== extra) break;
      len++;
    }
  }
  return len;
}

/** Fahrspuren der Straßenzelle i (wie laneGrid in js/game/roads.js: kleinere Ausdehnung, höchstens maxLanes), wenn `extra` auch Straße wäre. */
function lanesAt(c, tr, i, extra = -1) {
  return Math.min(CITY.transport.maxLanes, roadRun(c, tr, i, 1, 0, extra), roadRun(c, tr, i, 0, 1, extra));
}

/**
 * Spuren der KI (Paket „Straßennetz der KI“, PRD §10): Straßenzellen, deren Last laneTurns Ausbautakte in Folge über laneLoad × Kapazität
 * liegt, bekommen eine Straße daneben (Straßen nebeneinander = mehrspurig, laneGrid). Zuerst die am stärksten überlastete Zelle; die
 * neue Zelle muss frei sein und die Spurenzahl der überlasteten Zelle heben. Höchstens laneStep neue Zellen je Takt, nur mit laneBm
 * Baumaterial im Lager; eine Zelle ohne Platz ruht laneRetry s. Liefert die Maske der freien Zellen neben Straßen ab laneKeep ×
 * Kapazität (dort baut der Ausbau dieses Takts nichts, damit die Spur Platz behält).
 */
function aiLanes(game, c, main, mem) {
  const A = CITY.ai;
  const n = c.cols * c.rows;
  const hot = new Uint8Array(n);
  if (!main || !A.laneStep) return hot;
  const tr = transportOf(game, c);
  const turns = {};
  const over = [];
  const before = mem.laneHot;
  for (const i of tr.list) {
    if (!(tr.load[i] > tr.cap[i] * A.laneKeep)) continue;
    if (tr.lanes[i] < CITY.transport.maxLanes) for (const j of nbrsOf(c, i)) if (!c.kind[j]) hot[j] = 1;
    if (!(tr.load[i] > tr.cap[i] * A.laneLoad)) continue;
    turns[i] = (before[i] ?? 0) + 1;
    if (turns[i] >= A.laneTurns && tr.lanes[i] < CITY.transport.maxLanes) over.push(i);
  }
  mem.laneHot = turns;
  if (!over.length || main.store.bm < A.laneBm) return hot;
  over.sort((p, o) => tr.load[o] / tr.cap[o] - tr.load[p] / tr.cap[p] || p - o);
  const fail = mem.laneWait;
  prune(fail, game.time);
  const keep = mem.parkKeep;
  let built = 0;
  let tries = 0;
  for (const i of over) {
    if (built >= A.laneStep || tries >= A.laneTries) break;
    if (!ready(fail, i, game.time)) continue;
    tries++;
    const lanes = lanesAt(c, tr, i);
    let done = false;
    for (const x of nbrsOf(c, i)) {
      if (tr.cap[x] > 0 || keep[x] || !roadFree(game, c, x) || lanesAt(c, tr, i, x) <= lanes) continue;
      if (inDanger(c, x % c.cols, Math.floor(x / c.cols), game.time)) continue;
      if (!game.issue(c.team, cellCmd(c, 'road', x)).ok) continue;
      built++;
      done = true;
      break;
    }
    if (!done) block(fail, i, A.laneRetry, game.time);
  }
  return hot;
}

/**
 * Fliegerhorst der KI (seit v5.35, ersetzt den Flughafen): ab CITY.ai.airportFrom Arbeitsstätten eine Bahn 2 × 10 nahe der Hauptstadt
 * (bis airportReach Zellen; waagrecht oder senkrecht, mit freiem Rand), daneben zwei Stellplätze und ein Tower (frei stehend). Kerosintank
 * und Munitionslager kommen daneben mit Straße zum Lager (Paket „Fliegerhorst-Anschluss“: die Bahn braucht keine Straße, Tank und Lager
 * schon). Danach je Takt ein weiterer Stellplatz an der Bahn, bis sie `want` hat.
 */
export function aiAirport(game, c, main, reserve, want = 2, difficulty = 'normal') {
  const A = CITY.ai;
  if (!main) return false;
  const money = game.teams[c.team].res.money;
  let work = 0;
  const stands = [];
  for (const i of c.list) {
    if (isPart(c, i)) continue;
    const k = KINDS[c.kind[i] - 1];
    if (k === 'stand') stands.push(i); // auch noch nicht fertige (sonst baut sie doppelt)
    if (c.level[i] && (k === 'com' || k === 'market' || WORKS.includes(k))) work++;
  }
  const hasRunway = c.list.some((i) => c.kind[i] === KIND_ID.runway);
  // Fläche prüfen wie für die Bahn (ohne Anschlusspflicht je Zelle; Stellplätze, Tower und Lager prüft der Baubefehl als Ganzes)
  const free = (j) => !c.kind[j] && !c.mapRoads?.[j] && buildAllowed(game, c, j, 'runway') && cellFree(game, c, j % c.cols, Math.floor(j / c.cols)) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  const put = (kind, q, r) => game.issue(c.team, { type: 'city', kind, c0: q, r0: r, c1: q, r1: r }).ok;
  // Kerosintank oder Munitionslager 2 × 2 neben einer Bahnzelle: zuerst die Straße zum Lager (connectCells), dann der Bau, der den
  // Anschluss verlangt. true, wenn gebaut.
  const putDepot = (kind) => {
    for (const i of c.list) {
      if (c.kind[i] !== KIND_ID.runway) continue;
      const q = i % c.cols;
      const r = (i - q) / c.cols;
      for (const [x, y] of [[q, r - 2], [q, r + 1], [q - 2, r], [q + 1, r], [q - 1, r - 2], [q - 1, r + 1]]) {
        const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        if (cells.some(([u, v]) => u < 0 || v < 0 || u >= c.cols || v >= c.rows || !free(v * c.cols + u) || !buildAllowed(game, c, v * c.cols + u, kind))) continue;
        if (connectCells(game, c, cells.map(([u, v]) => v * c.cols + u), true) < 0) continue;
        if (put(kind, x, y)) return true;
      }
    }
    return false;
  };
  const runwayCells = hasRunway ? c.list.filter((i) => c.kind[i] === KIND_ID.runway).length : 0;
  // Notausgang: steht eine Bahn, an der nie ein Stellplatz entstehen kann (außerhalb des Gebiets, Straße nicht anschließbar), baut die KI
  // einen zweiten Fliegerhorst an anderer Stelle (höchstens CITY.ai.airportMax Bahnen), statt ewig zu warten
  const retry = () => !stands.length && runwayCells < A.airportMax * 2 * A.runwayLen;
  if (hasRunway) {
    // Stellplätze ausbauen (seit v5.39 nur per Befehl): den ersten fertigen unter Stufe 3, wenn genug übrig bleibt
    const up = stands.length >= Math.ceil(want / CITY.air.standJets) ? stands.find((i) => c.level[i] && c.level[i] < CITY.maxLevel) : null; // erst genug Stellplätze
    const cost = up != null ? CITY.air.upgrade[c.level[up] + 1] : null;
    if (cost && money >= cost.money + Math.max(reserve, CITY.air.upgradeAiReserve) && main.store.bm >= cost.bm + A.upgradeBuffer.bm && c.metal >= (cost.steel ?? 0) + A.upgradeBuffer.steel) {
      const e = c.ents.get(up);
      if (e && game.issue(c.team, { type: 'cityUpgrade', buildingId: e.id }).ok) return true;
    }
    // Kerosintank und Munitionslager fehlen (nie gebaut oder zerstört): neben die Bahn, mit Straße zum Lager
    for (const kind of ['ktank', 'mdepot']) {
      if (c.list.some((i) => c.kind[i] === KIND_ID[kind])) continue;
      if (money >= CITY.cost[kind] + reserve && main.store.bm >= (CITY.costBm[kind] ?? 0) + A.standBuffer && putDepot(kind)) return true;
    }
    // weitere Stellplätze an der Bahn (beide Längsseiten); so viele, dass jeder Jet einen Platz hat (CITY.air.standJets je Stellplatz)
    // + ein ganzer Stellplatz für die U-2 zur Aufklärung, wenn sie fliegen darf (seit v5.83: sie belegt beide Plätze)
    const wantStands = Math.ceil(want / CITY.air.standJets) + (CITY.ai.reconFrom[difficulty] != null ? CITY.ai.reconMax : 0);
    if (stands.length >= wantStands || money < CITY.cost.stand + reserve || main.store.bm < CITY.costBm.stand + A.standBuffer) return false;
    const rw = c.list.filter((i) => c.kind[i] === KIND_ID.runway);
    for (const i of rw) {
      const q = i % c.cols;
      const r = (i - q) / c.cols;
      for (const [x, y] of [[q, r - 2], [q, r + 1], [q - 2, r], [q + 1, r], [q - 1, r - 2], [q - 1, r + 1]]) {
        const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        if (cells.some(([u, v]) => u < 0 || v < 0 || u >= c.cols || v >= c.rows || !free(v * c.cols + u))) continue;
        if (put('stand', x, y)) return true; // 2 × 2: Anker links oben der Mitte
      }
    }
    if (!retry()) return false;
  }
  if (work < A.airportFrom || stands.length) return false;
  if (money < A.airportMoney + reserve || main.store.bm < A.airportBm) return false;
  const [fc, fr] = cellAt(c, main.x, main.y);
  const R = A.airportReach;
  const L = A.runwayLen; // Länge der Bahn
  const fits = (q, r, w, h) => {
    for (let y = r - 1; y <= r + h; y++) for (let x = q - 1; x <= q + w; x++) if (x < 0 || y < 0 || x >= c.cols || y >= c.rows || !free(y * c.cols + x)) return false;
    return true;
  };
  const cand = [];
  for (let r = Math.max(1, fr - R); r <= Math.min(c.rows - 2, fr + R); r++) {
    for (let q = Math.max(1, fc - R); q <= Math.min(c.cols - 2, fc + R); q++) cand.push({ q, r, d: Math.hypot(q - fc, r - fr) });
  }
  cand.sort((p, o) => p.d - o.d || p.r - o.r || p.q - o.q);
  for (const { q, r } of cand) {
    for (const vertical of [false, true]) {
      // Bahn L × 2 (bzw. 2 × L) mit einer Reihe 2 × 2-Bauten daneben: Fläche L × 4
      if (!fits(q, r, vertical ? 4 : L, vertical ? L : 4)) continue;
      // Die ersten beiden Stellplätze müssen im eigenen Gebiet erlaubt sein (die Bahn selbst darf hinaus; sonst entstand eine Bahn
      // außerhalb, an der nie ein Stellplatz gebaut werden konnte)
      if (!standsAllowed(game, c, vertical ? q + 2 : q, vertical ? r : r + 2, vertical ? 2 : 4, vertical ? 4 : 2)) continue;
      // Bahn bauen; scheitert der Befehl hier, die nächste Stelle versuchen (vorher Abbruch: die KI blieb an derselben Stelle hängen)
      const rwCmd = vertical ? { type: 'city', kind: 'runway', c0: q, r0: r, c1: q + 1, r1: r + L - 1 } : { type: 'city', kind: 'runway', c0: q, r0: r, c1: q + L - 1, r1: r + 1 };
      if (!game.issue(c.team, rwCmd).ok) continue;
      // Stellplätze und Tower neben der Bahn (sie brauchen keine Straße), dann Kerosintank und Munitionslager mit Straße zum Lager
      const spots = [0, 2, 4, 6, 8].map((k) => (vertical ? [q + 2, r + k] : [q + k, r + 2]));
      ['stand', 'stand', 'atc'].forEach((kind, k) => {
        const [x, y] = spots[k];
        put(kind, x, y);
      });
      putDepot('ktank');
      putDepot('mdepot');
      return true;
    }
  }
  return false;
}

/** Markt der KI: Überschuss verkaufen, Metall zukaufen, wenn es knapp ist. */
function aiMarket(game, team, reserve, mem = cityAiMemory()) {
  const c = game.city[team];
  const main = game.mainFob(team);
  if (!main) return;
  for (const g of ['bm', 'mun', 'fuel']) if (main.store[g] > CITY.ai.sellAbove) game.issue(team, { type: 'trade', good: g, dir: 'sell' });
  if (c.metal > CITY.ai.sellAbove) game.issue(team, { type: 'trade', good: 'metal', dir: 'sell' });
  // Stahl nur, wenn eine Ausbildung zuletzt daran scheiterte (Bedarf offen, steelWait s), Geld für Fahrzeug und Los reicht (sonst kaufte sie
  // den Stahl, und das Fahrzeug blieb unbezahlbar) und der Lospreis nicht über metalMaxPrice liegt
  const w = mem.steelWant;
  const price = marketBuyPrice(game, team, 'metal');
  if (w && game.time - w.time <= CITY.ai.steelWait && c.metal < w.amount && game.teams[team].res.money >= w.cost + price
    && price <= CITY.market.buy.metal * (w.max ?? CITY.ai.metalMaxPrice)) {
    game.issue(team, { type: 'trade', good: 'metal', dir: 'buy' });
  }
  // Baumaterial fehlt (seit v5.20, AP4): Straßen und Anschlüsse kosten es, ohne BM bleiben Werke unangebunden
  if (main.store.bm < CITY.ai.buyBmBelow && game.teams[team].res.money > marketBuyPrice(game, team, 'bm')) {
    game.issue(team, { type: 'trade', good: 'bm', dir: 'buy' });
  }
}

/**
 * Angriff auf die gegnerische Stadt (von ai.js jede Sekunde): alle raidEvery s schicken bis zu raidSize untätige Fahrzeuge
 * mit Angriffsmarsch zum nächsten erkundeten gegnerischen Stadtgebäude.
 */
export function aiRaid(game, team, difficulty, dt, mem = cityAiMemory()) {
  const c = game.city?.[team];
  const every = CITY.ai.raidEvery[difficulty] ?? 0;
  if (!c || !every) return;
  mem.raidTimer += dt;
  if (mem.raidTimer < every) return;
  mem.raidTimer = 0;
  // Ziel: die gegnerische Stadt; in der Eroberung nur eine, deren Viertel-Sperre gefallen ist (sonst kommt niemand hinein)
  const main = game.mainFob(team);
  if (!main) return;
  // Eroberung: unter den Städten mit offenem Viertel die, deren Hauptstadt am nächsten liegt
  const open = game.conquest ? enemiesOf(game, team).filter((o) => game.conquest.open[o.id] && game.mainFob(o.id)) : [];
  const near = nearestOf(open.map((o) => game.mainFob(o.id)), main.x, main.y);
  const foe = game.conquest ? (near ? game.city[near.team] : null) : game.city[1 - team];
  if (!foe || !main) return;
  // Ziel nach Wert: Werke, Güterbahnhof und Markt zuerst, geteilt durch die Entfernung (freie Planung seit v4.85)
  let target = null;
  let best = -Infinity;
  for (const e of foe.ents.values()) {
    if (!e.alive || !game.isExplored(team, e.x, e.y)) continue;
    const k = KINDS[foe.kind[e.cityCell] - 1];
    const v = (CITY.ai.targetValue[k] ?? 1) / (1 + Math.hypot(e.x - main.x, e.y - main.y) / CITY.ai.raidDist);
    if (v > best) {
      best = v;
      target = e;
    }
  }
  if (!target) return;
  const ids = game.units
    .filter((u) => u.alive && u.team === team && !u.def.air && u.def.armor !== 'inf' && u.weapons.length && u.order.type === 'idle' && u.def.damage?.struct > 0)
    .slice(0, CITY.ai.raidSize)
    .map((u) => u.id);
  if (ids.length) game.issue(team, { type: 'attackMove', ids, x: target.x, y: target.y });
}

/**
 * Verteidigung (von ai.js jede Denkrunde): Wird ein eigenes Stadtgebäude beschossen, schickt die KI bis zu defendSize
 * bewaffnete Bodeneinheiten aus der Nähe mit Angriffsmarsch dorthin; Werke und Güterbahnhof zuerst.
 */
export function aiDefend(game, team, mem = cityAiMemory()) {
  const c = game.city?.[team];
  if (!c) return;
  const A = CITY.ai;
  if (!ready(mem.wait, 'defend', game.time)) return;
  let spot = null;
  let best = -1;
  for (const e of c.ents.values()) {
    if (!e.alive || e.lastHitTime < game.time - A.hitRecent) continue;
    const v = A.targetValue[KINDS[c.kind[e.cityCell] - 1]] ?? 1;
    if (v > best) {
      best = v;
      spot = e;
    }
  }
  if (!spot) return;
  const near = game.units
    .filter((u) => u.alive && u.team === team && !u.def.air && u.weapons.length && !u.house && !u.crate && u.order.type !== 'attack' && Math.hypot(u.x - spot.x, u.y - spot.y) < A.defendRange)
    .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y) || a.id - b.id)
    .slice(0, A.defendSize);
  if (!near.length) return;
  block(mem.wait, 'defend', A.defendCooldown, game.time);
  game.issue(team, { type: 'attackMove', ids: near.map((u) => u.id), x: spot.x, y: spot.y });
}
