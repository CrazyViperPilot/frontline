// Wachstum der Stadt-KI (PRD §15): zweiter Teil des Ausbau-Schritts aiCity. Weist die nächsten Zellen um den Anker aus (Straßen,
// Wohnen, Gewerbe, Werke, Großbauten), solange perStep nicht erreicht ist und das Geld über der Reserve liegt.
// Seit dem Paket „Stadt-KI aufteilen“ sind die früher eingebetteten Hilfen (free, freeFor, canLink, workSpot, place) benannte
// Funktionen über ein Kontextobjekt je Takt (growContext); die Logik ist unverändert.
// Exporte: growCells. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { WORKS } from '../../data/citykinds.js';
import { idx, sizeOf, fitBig, bigCells, hasRoad, buildAllowed, nbrsOf } from '../../game/city/cells.js';
import { mainRoadReach, mainZone } from '../../game/city/roadnet.js';
import { block } from '../cooldown.js';
import { nearCells, inDanger, aiCandidates, cellCmd, touchesRoad } from './common.js';
import { aiNeed } from './need.js';
import { parkSpot } from './park.js';
import { keepsOutlets, linkField, linkPaths, atNet } from './roads.js';

const isWork = (kind) => WORKS.includes(kind);

/**
 * Kontext eines Wachstums-Takts. n: schon gebaute Dinge dieses Takts (-Infinity = Geld reicht nicht, Schluss), add/skip: Zähler und
 * gesperrte Arten für aiNeed, reach: Zellen am Netz des Lagers (nach jedem Straßenbau neu), grow/zone: Wachstum vom Netz,
 * links/linkable: Zufahrten bzw. Anschlussmaske, erst bei Bedarf, hot: Zellen neben überlasteten Straßen (aiLanes),
 * keep: Werksplätze am Güterbahnhof (nur Werke dürfen dorthin).
 */
function growContext(game, team, city, main, anchor, rad, n, reserve, mem, hot) {
  const reach = mainRoadReach(game, city);
  // Wachstum vom Netz (Paket „Straßennetz der KI“): an der Hauptstadt nur Straßen, die ans Netz des Lagers anschließen, und Gebäude
  // nur an diesem Netz (keine Inseln). FOB-Viertel (anderer Anker) bleiben eigene kleine Netze.
  const grow = CITY.ai.netRoads && anchor === main && reach.some((v) => v);
  const ctx = {
    game, team, city, reserve, mem, hot, n, reach, grow,
    zone: grow ? mainZone(game, city) : null,
    links: null,
    linkable: null,
    // Ausbau: Zellen an Straßen, die mit dem Lager verbunden sind, kommen vor (aiCandidates, seit v5.20 AP4)
    cands: aiCandidates(game, city, anchor.x, anchor.y, rad, reach),
    near: nearCells(city, reach, CITY.ai.connectNear),
    keep: mem.parkKeep,
    add: {},
    skip: new Set(), // Großbauten, für die in diesem Takt kein Platz war
  };
  ctx.free = (j) => freeCell(ctx, j);
  return ctx;
}

/** Freie Zelle: unbebaut, nicht neben einer überlasteten Straße (dort kommt die zweite Spur hin), nicht in Gefahr. */
function freeCell(ctx, j) {
  const { city, hot, game } = ctx;
  return !city.kind[j] && !hot[j] && !inDanger(city, j % city.cols, Math.floor(j / city.cols), game.time);
}

/** Prüfung freier Zellen für eine Art: Werke dürfen auf freigehaltene Werksplätze (Paket „Industriepark“), alle anderen nicht. */
function freeFor(ctx, kind) {
  return isWork(kind) ? ctx.free : (j) => ctx.free(j) && !ctx.keep[j];
}

/** Liegt der Großbau mit Ankerzelle a neben einer Zelle, von der eine Zufahrt zum Netz des Lagers möglich ist (linkField)? */
function canLink(ctx, a, kind) {
  const { game, city } = ctx;
  ctx.linkable ??= linkField(game, city, ctx.reach);
  return bigCells(city, a, sizeOf(kind)).some((j) => nbrsOf(city, j).some((x) => ctx.linkable[x]));
}

/**
 * Platz für einen Großbau (Werk 2 × 2, seit v5.20 AP4): seit Paket „Industriepark“ zuerst ein freier Platz am Güterbahnhof
 * (Direktlieferung), dann ein Quadrat an einer Straße zum Lager, sonst an einer beliebigen Straße in Reichweite (aiConnect verbindet
 * es danach, Baumaterial vorausgesetzt). Ein Werk dort nur, wenn eine Zufahrt zum Netz des Lagers überhaupt möglich ist: sonst
 * lieferte es nie. Ergebnis: Ankerzelle oder -1.
 */
function workSpot(ctx, kind) {
  const { game, city, mem, cands, near } = ctx;
  if (isWork(kind)) {
    const spot = parkSpot(game, city, ctx.reach, kind, ctx.free, mem);
    if (spot >= 0) return spot;
  }
  for (const pass of ctx.grow ? [true] : [true, false]) {
    for (const c2 of cands) {
      if (pass ? !touchesRoad(city, c2.i, ctx.reach) : !(near[c2.i] && hasRoad(city, c2.col, c2.row))) continue;
      const a = fitBig(game, city, c2.col, c2.row, kind, freeFor(ctx, kind), (j) => buildAllowed(game, city, j, kind));
      if (a >= 0 && (pass || !isWork(kind) || canLink(ctx, a, kind))) return a;
    }
  }
  return -1;
}

/** Zufahrt zu einer Musterstraße ohne Anschluss: Zellen vom Netz bis zur Musterzelle, oder null, wenn keine kurze Zufahrt besteht. */
function linkPath(ctx, i) {
  const { game, city } = ctx;
  ctx.links ??= linkPaths(game, city, ctx.reach, CITY.ai.roadLink, ctx.keep);
  if (ctx.links.dist[i] < 0) return null;
  const path = [];
  for (let j = i; j >= 0; j = ctx.links.prev[j]) path.push(j);
  return path.reverse();
}

/** Netz hat sich geändert (neue Straße): Erreichbarkeit neu, Zufahrten verwerfen. */
function netChanged(ctx) {
  ctx.reach = mainRoadReach(ctx.game, ctx.city);
  ctx.links = null;
}

/**
 * Art und Ort für eine Nicht-Straßen-Zelle: aiNeed, Großbauten über workSpot (bis zu 8 Versuche, Arten ohne Platz gelten für diesen
 * Takt als gesperrt). Ergebnis { kind, col, row } oder null, wenn hier nichts hinkommt.
 */
function chooseKind(ctx, cand) {
  const { game, city, add, skip } = ctx;
  // nur neben einer (geplanten) Straße
  if (!hasRoad(city, cand.col, cand.row)) return null;
  let kind = aiNeed(game, city, add, skip);
  // Wachstum vom Netz: die Straße daneben muss zum Lager führen (Wohnen und Gewerbe auch über ein Nachbarhaus gleicher Art)
  if (ctx.grow && sizeOf(kind) === 1 && !atNet(city, cand.i, kind, ctx.reach)) return null;
  // Großbau (Werke 2 × 2, Kraftwerk, Universität, Kaserne, Fabrikhalle, Krankenhaus …, seit v5.20 AP4): Platz über workSpot, zuerst
  // an einer Straße zum Lager; ohne Platz gilt die Art für diesen Takt als ohne Platz und es kommt die nächste (bis zu 8 Versuche).
  // Vorher blieb ein Großbau ohne Platz an dieser Zelle stehen, und jede weitere Zelle des Takts wählte ihn erneut.
  let spot = -1;
  for (let tries = 0; sizeOf(kind) > 1 && tries < 8; tries++) {
    spot = workSpot(ctx, kind);
    if (spot >= 0) break;
    skip.add(kind);
    kind = aiNeed(game, city, add, skip);
  }
  if (sizeOf(kind) === 1) return { kind, col: cand.col, row: cand.row };
  if (spot < 0) return null;
  return { kind, col: spot % city.cols, row: Math.floor(spot / city.cols) };
}

/** Eine Kandidatenzelle bearbeiten: Straße (ggf. mit Zufahrt), Wohnen/Gewerbe oder Großbau ausweisen; zählt ctx.n hoch. */
function placeCell(ctx, cand) {
  const { game, team, city, keep, hot, reserve, mem, add, skip } = ctx;
  if (keep[cand.i]) return; // freigehaltener Werksplatz: keine Straße, kein anderes Gebäude
  if (!cand.road && hot[cand.i]) return; // Platz für die zweite Spur
  let kind = 'road';
  let col = cand.col;
  let row = cand.row;
  let path = null; // Straße mit Zufahrt: Zellen vom Netz bis zur Musterzelle
  if (cand.road && ctx.grow && !ctx.zone[cand.i] && !touchesRoad(city, cand.i, ctx.reach)) {
    // Musterstraße ohne Anschluss: nur mit kurzer Zufahrt vom Netz (höchstens roadLink Zellen, alle im selben Takt), sonst entstünde eine Insel
    path = linkPath(ctx, cand.i);
    if (!path) return;
  }
  if (!cand.road) {
    const pick = chooseKind(ctx, cand);
    if (!pick) return;
    ({ kind, col, row } = pick);
  }
  if (game.teams[team].res.money < CITY.cost[kind] + reserve) {
    ctx.n = -Infinity; // Geld reicht nicht: Schluss für diesen Takt
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
      ctx.n++;
    }
    netChanged(ctx);
    return;
  }
  const r = game.issue(team, { type: 'city', kind, c0: col, r0: row, c1: col, r1: row });
  if (r.ok && kind === 'road' && ctx.grow) netChanged(ctx);
  if (!r.ok) {
    if (kind !== 'road') skip.add(kind); // z. B. zu wenig Baumaterial: in diesem Takt etwas anderes (seit v5.03)
    if (isWork(kind)) block(mem.parkWait, idx(city, col, row), CITY.ai.stationRetry, game.time); // abgelehnter Werksplatz: nicht jeden Takt neu (Paket „Industriepark“)
    return;
  }
  if (kind !== 'road') add[kind] = (add[kind] ?? 0) + 1;
  ctx.n++;
}

/**
 * Zweiter Teil des Ausbau-Schritts: weist die nächsten Zellen um den Anker aus, solange der Zähler n unter CITY.ai.perStep bleibt und
 * das Geld über der Reserve liegt. n: schon gebaute Dinge dieses Takts, hot: Maske der Zellen neben überlasteten Straßen (aiLanes).
 */
export function growCells(game, team, city, main, anchor, rad, n, reserve, mem, hot) {
  const ctx = growContext(game, team, city, main, anchor, rad, n, reserve, mem, hot);
  for (const cand of ctx.cands) {
    if (ctx.n >= CITY.ai.perStep) return;
    placeCell(ctx, cand);
    if (!Number.isFinite(ctx.n)) return;
  }
}
