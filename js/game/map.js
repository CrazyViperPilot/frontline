// Kartenerzeugung (docs/archiv/verlauf.md §5, game/map.js). Punktsymmetrisch, deterministisch je Seed. Kein DOM.
import { BALANCE } from '../data/balance.js';
import { MAPGEN } from '../data/mapgen.js';
import { makeRng } from '../core/rng.js';
import { Grid } from './grid.js';
import { findPath } from './pathfinding.js';
import { setRelief, RELIEF } from './relief.js';
import { buildLandscape, groundOk, countRoutes, RIVER_SIZE } from './landscape.js';
import { openBridges } from './river.js';
import { zoneDist } from './zonegeo.js';
import { rasterizeProps, propCells, GATE } from './props.js';
import { PROPS } from '../data/props.js';

const W = BALANCE.map.width;
const H = BALANCE.map.height;
const TILE = BALANCE.map.tile;
const CX = W / 2;
const CY = H / 2;
const ZONE_R = BALANCE.zone.r;
const SPAWN_EDGE = MAPGEN.general.spawnEdge;
const SPAWNS2 = [
  { x: SPAWN_EDGE, y: H - SPAWN_EDGE },
  { x: W - SPAWN_EDGE, y: SPAWN_EDGE },
];
// Eroberung mit 3 oder 4 Spielern: auch die beiden anderen Ecken sind Startpunkte (Bauland, Zufahrt, flaches Gelände). Die Karte
// bleibt punktsymmetrisch: Ecke 2 und 3 spiegeln sich wie 0 und 1.
const SPAWNS4 = [...SPAWNS2, { x: SPAWN_EDGE, y: SPAWN_EDGE }, { x: W - SPAWN_EDGE, y: H - SPAWN_EDGE }];
let SPAWNS = SPAWNS2;
// Form der Konfliktzone der Karte, die gerade erzeugt wird: mit 3 oder 4 Spielern (nur Eroberung) das Quadrat der Flaggengebiete,
// sonst der Kreis wie immer (Karten mit 2 Spielern bleiben je Seed unverändert, Regel 4)
let ZONE = { x: CX, y: CY, r: ZONE_R };
/** Abstand zur Zonenmitte in der Form der Zone (zonegeo.zoneDist): `zd(x, y) <= ZONE_R` heißt in der Zone. */
const zd = (x, y) => zoneDist(ZONE, x, y); // Startecken der Karte, die gerade erzeugt wird (generateMap setzt sie)
const MAX_ATTEMPTS = MAPGEN.general.attempts;
const OBSTACLE_PAIRS = MAPGEN.scatter.obstaclePairs;
const MIN_ROUTES = MAPGEN.general.minRoutes;
const BUILD_LAND = MAPGEN.general.buildLand; // Bauland um die Startpunkte (seit v5.03)
const ZONE_SLOPE = MAPGEN.general.zoneSlope;
const GEN = MAPGEN.general;
const SC = MAPGEN.scatter;
const TOWN = MAPGEN.town;
const OUT = MAPGEN.outposts;
const CR = MAPGEN.crates;
const FARM = MAPGEN.farms;
const RV = MAPGEN.river;
const TWO_PI = Math.PI * 2;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const reaches = (path, x, y) => path.length > 0 && path[path.length - 1].x === x && path[path.length - 1].y === y;

/**
 * Erzeugt eine Karte. Scheitert die Platzierung oder ist die Karte nicht zusammenhängend,
 * wird mit seed + 1, + 2, … neu versucht (höchstens MAPGEN.general.attempts ×).
 * river: je ein Fluss vor jeder Startecke mit Brücken und Furten (v4.53; ohne ihn bleibt jede Karte wie zuvor).
 * @returns {{ width, height, tile, obstacles: {x,y,r}[], town: {roads, buildings, parks, cars, trees, fields}, trees: {x,y,r}[] (Bäume außerhalb der Stadt; wie die Stadtbäume blockierend), spawns: {x,y}[], zone: {x,y,r}, crates: {x,y}[] (Versorgungskisten), relief: string (Höhengelände, relief.js), fords?: {x,y,r}[], bridges?: {x1,y1,x2,y2}[] (nur mit Fluss) }}
 */
export function generateMap(seed, { river = false, players = 2 } = {}) {
  SPAWNS = players > 2 ? SPAWNS4 : SPAWNS2;
  ZONE = players > 2 ? { x: CX, y: CY, r: ZONE_R, half: BALANCE.conquest.half } : { x: CX, y: CY, r: ZONE_R }; // mit 2 Spielern bleibt jede Karte je Seed, wie sie war (Regel 4)
  try {
    for (let k = 0; k < MAX_ATTEMPTS; k++) {
      const map = tryBuild(seed + k, river);
      if (map) {
        map.spawns = map.spawns.slice(0, Math.max(2, players));
        return map;
      }
    }
  } finally {
    SPAWNS = SPAWNS2;
    ZONE = { x: CX, y: CY, r: ZONE_R };
  }
  throw new Error('Karte konnte nicht erzeugt werden');
}

function tryBuild(seed, river = false) {
  const rng = makeRng(seed);
  // 0. Gelände: Hügel, Bergrücken und Seen (wahlweise Flüsse); Zufahrten, Bahn, Startpunkte und Stadt bleiben frei befahrbar
  const land = buildLandscape(seed, { spawns: SPAWNS, zone: ZONE, roads: accessRoads(), railY: CY }, { river });
  const { relief, fords, bridges, clearings, crossings } = land;
  if (!gentleZone(relief, river)) return null;
  const cleared = (x, y, r) => clearings.some((c) => dist(x, y, c.x, c.y) < c.r + r); // Zufahrt einer Brücke oder Furt
  // 1. Hindernispaare (Wald), nur auf festem, nicht zu steilem Grund
  const obstacles = [];
  for (let i = 0; i < OBSTACLE_PAIRS; i++) {
    let ob = null;
    for (let t = 0; t < SC.obstacleTries && !ob; t++) {
      const r = 2 * Math.round(rng.range(...SC.obstacleR)); // immer gerade: nur Wald, keine Felsen
      const x = Math.round(rng.range(r, W - r));
      const y = Math.round(rng.range(r, H - r));
      if (zd(x, y) < ZONE_R + r + SC.obstacleZoneGap) continue; // Stadt bleibt frei von Felsen/Wald
      if (inRail(y, r)) continue; // Bahnlinie bleibt frei
      if (SPAWNS.some((s) => dist(x, y, s.x, s.y) < BUILD_LAND + r)) continue;
      if (!groundOk(relief, x, y, r) || !groundOk(relief, W - x, H - y, r)) continue;
      if (cleared(x, y, r)) continue; // die Zufahrten sind punktsymmetrisch: das Spiegelbild ist damit auch frei
      ob = { x, y, r };
    }
    if (!ob) return null;
    obstacles.push(ob, { x: W - ob.x, y: H - ob.y, r: ob.r });
  }

  // 2. Zusammenhang prüfen: Spawn 0 erreicht Zonenmitte (auf mehreren Wegen) und Spawn 1
  const town = buildTown(rng);
  if (river) town.roads = cutRoads(town.roads, relief); // Feldwege enden am Ufer, die Brücke trägt sie hinüber
  const outposts = buildOutposts(rng, obstacles, relief, clearings);
  town.buildings.push(...outposts.buildings);
  const trees = scatterTrees(rng, obstacles, [...outposts.areas, ...clearings], relief);
  const grid = blockGrid(obstacles, town.buildings, [...town.trees, ...trees], relief, fords, bridges);
  if (!isConnected(grid)) return null;
  if (river && !crossingsOk(grid, crossings)) return null;
  // 3. Versorgungskisten zuletzt: die Zufallszahlen davor (und damit alle bisherigen Karten) bleiben gleich
  const crates = placeCrates(rng, grid);
  // 4. Äcker, Weiden und Feldwege mit eigenem Zufall (nur Boden): auch die Kisten bleiben je Seed, wo sie waren
  placeFarms(seed, town, outposts.buildings, obstacles, trees, relief);
  // 5. Zäune und Mauern an Feldern, ebenfalls mit eigenem Zufall (MAPGEN.props); sperren sie die Verbindung, entfallen sie
  const props = placeProps(seed, town, grid, crates, cleared);
  if (props.length) {
    rasterizeProps(grid, props);
    if (!isConnected(grid)) props.length = 0;
  }

  const map = {
    width: W,
    height: H,
    tile: TILE,
    obstacles,
    town,
    trees,
    spawns: SPAWNS.map((s) => ({ x: s.x, y: s.y })),
    zone: { x: CX, y: CY, r: ZONE_R },
    crates,
    ...(props.length ? { props } : {}),
    ...(river ? { fords, bridges } : {}),
  };
  setRelief(map, relief);
  return map;
}

const CROSS_REGION = MAPGEN.general.crossRegion;

/** Zellen, die von (x, y) aus erreichbar sind, höchstens cap (Breitensuche); within: nur in diesem Kreis {x, y, r}. */
function regionSize(grid, x, y, cap, within = null, goal = null) {
  const c0 = grid.toCell(x);
  const r0 = grid.toCell(y);
  if (!grid.passable(c0, r0, 0)) return { n: 0, hit: false };
  const gi = goal ? grid.idx(grid.toCell(goal.x), grid.toCell(goal.y)) : -1;
  const seen = new Set([grid.idx(c0, r0)]);
  const queue = [grid.idx(c0, r0)];
  for (let k = 0; k < queue.length && seen.size < cap; k++) {
    const i = queue[k];
    if (i === gi) return { n: seen.size, hit: true };
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.passable(nc, nr, 0)) continue;
      if (within && dist(grid.center(nc), grid.center(nr), within.x, within.y) > within.r) continue;
      const j = grid.idx(nc, nr);
      if (seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return { n: seen.size, hit: seen.has(gi) };
}

/**
 * Jede Brücke und Furt führt wirklich hinüber: beide Ufer (RW + MAPGEN.general.crossBank px quer zur Mitte) sind frei, auf kurzem Weg über die Querung
 * verbunden und gehören, wenn alle Querungen gesperrt sind, je zu einem großen Gebiet (keine Tasche hinter Fels oder See).
 */
function crossingsOk(grid, crossings) {
  const off = RIVER_SIZE.halfW + GEN.crossBank;
  const banks = crossings.map((q) => [
    { x: q.x - q.nx * off, y: q.y - q.ny * off },
    { x: q.x + q.nx * off, y: q.y + q.ny * off },
  ]);
  for (let k = 0; k < crossings.length; k++) {
    const [a, b] = banks[k];
    if (!regionSize(grid, a.x, a.y, Infinity, { x: crossings[k].x, y: crossings[k].y, r: off + GEN.crossReach }, b).hit) return false;
  }
  // alle Querungen zu: Brücken wieder gesperrt, Furten auch
  const closed = new Grid(grid.cols, grid.rows, grid.tile);
  closed.terrain.set(grid.terrain);
  closed.struct.set(grid.struct);
  for (const i of grid.bridgeCells ?? []) closed.terrain[i] = 1;
  if (grid.ford) for (let i = 0; i < grid.ford.length; i++) if (grid.ford[i]) closed.terrain[i] = 1;
  return banks.every((pair) => pair.every((p) => regionSize(closed, p.x, p.y, CROSS_REGION).n >= CROSS_REGION));
}

/** Straßen ohne ihre Stücke über Wasser (Abtastung alle 8 px); was kürzer als MAPGEN.river.minPiece px bleibt, entfällt. */
function cutRoads(roads, relief) {
  const out = [];
  for (const r of roads) {
    const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
    const n = Math.max(1, Math.ceil(len / 8));
    const wet = (i) => relief.heightAt(r.x1 + ((r.x2 - r.x1) * i) / n, r.y1 + ((r.y2 - r.y1) * i) / n) < RELIEF.water + 1;
    let start = null;
    const push = (i0, i1) => {
      if (((i1 - i0) / n) * len < RV.minPiece) return;
      const at = (i) => [Math.round(r.x1 + ((r.x2 - r.x1) * i) / n), Math.round(r.y1 + ((r.y2 - r.y1) * i) / n)];
      const [x1, y1] = at(i0);
      const [x2, y2] = at(i1);
      out.push({ ...r, x1, y1, x2, y2 });
    };
    for (let i = 0; i <= n; i++) {
      if (!wet(i)) start ??= i;
      else if (start !== null) {
        push(start, i - 1);
        start = null;
      }
    }
    if (start === 0) out.push(r);
    else if (start !== null) push(start, n);
  }
  return out;
}

/** Die Feldwege von den Startpunkten zur Stadtkante (dieselben Linien wie in buildTown). */
function accessRoads() {
  return SPAWNS.map((s) => {
    const a = Math.atan2(CY - s.y, CX - s.x);
    return { x1: s.x, y1: s.y, x2: CX - Math.cos(a) * (ZONE_R - TOWN.accessEnd), y2: CY - Math.sin(a) * (ZONE_R - TOWN.accessEnd) };
  });
}

/** In der Konfliktzone ist das Gelände überall sanft (keine Zelle steiler als ZONE_SLOPE, kein Wasser). */
function gentleZone(relief, river) {
  const c0 = Math.floor((CX - ZONE_R) / TILE);
  const c1 = Math.ceil((CX + ZONE_R) / TILE);
  // Mit Fluss schneidet dieser die Ecken des Quadrats vor den Startecken von Blau und Rot (zwischen Bauland und Zone ist sonst
  // kein Platz): dort gilt weiter der Kreis, und nur die Flaggenmasten müssen frei stehen.
  const region = river ? (x, y) => dist(x, y, CX, CY) <= ZONE_R : (x, y) => zd(x, y) <= ZONE_R;
  for (let r = c0; r < c1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!region((c + 0.5) * TILE, (r + 0.5) * TILE)) continue;
      if (relief.cellSlope(c, r) > ZONE_SLOPE || relief.cellBlocked(c, r)) return false;
    }
  }
  if (!ZONE.half) return true;
  // Eroberung: um jeden Flaggenmast (Mitte der grid × grid Gebiete) ist der Boden begehbar
  const Q = BALANCE.conquest;
  const size = (2 * Q.half) / Q.grid;
  for (let j = 0; j < Q.grid; j++) {
    for (let i = 0; i < Q.grid; i++) {
      const fx = CX - Q.half + (i + 0.5) * size;
      const fy = CY - Q.half + (j + 0.5) * size;
      for (let r = Math.floor((fy - Q.flagRing) / TILE); r <= Math.floor((fy + Q.flagRing) / TILE); r++) {
        for (let c = Math.floor((fx - Q.flagRing) / TILE); c <= Math.floor((fx + Q.flagRing) / TILE); c++) if (relief.cellBlocked(c, r)) return false;
      }
    }
  }
  return true;
}

/** Raster mit allem, was den Weg versperrt (wie im Spiel: Furten passierbar, Brücken offen). */
function blockGrid(obstacles, buildings, trees, relief, fords = [], bridges = []) {
  const grid = new Grid(W / TILE, H / TILE, TILE);
  grid.rasterizeObstacles(obstacles);
  grid.rasterizeRects(buildings);
  grid.rasterizeTrees(trees);
  grid.rasterizeRelief(relief, fords);
  grid.bridgeCells = openBridges(grid, bridges, relief).flat(); // geöffnete Fahrbahnzellen (Prüfung der Querungen)
  return grid;
}

function isConnected(grid) {
  const [a, b] = SPAWNS;
  const cy = CY - RAIL_HALF - TOWN.railMargin; // Zonenmitte liegt unter dem Zug: Nachbarpunkt prüfen
  if (!reaches(findPath(grid, a.x, a.y, CX, cy, 0), CX, cy)) return false;
  if (!reaches(findPath(grid, a.x, a.y, b.x, b.y, 0), b.x, b.y)) return false;
  for (const o of SPAWNS.slice(2)) if (!reaches(findPath(grid, o.x, o.y, CX, cy, 0), CX, cy)) return false; // weitere Startecken (Eroberung)
  // Mehrere getrennte Zugänge zur Zone (die Karte ist punktsymmetrisch: Start 0 genügt)
  const keepOut = [{ x: a.x, y: a.y, r: GEN.routeKeepOut }, { x: CX, y: CY, r: ZONE_R }];
  return countRoutes(grid, a, { x: CX, y: cy }, { want: MIN_ROUTES, keepOut }) >= MIN_ROUTES;
}

// ---- Osteuropäische Stadt in der Konfliktzone (punktsymmetrisch um die Zonenmitte) ----
// Bahnlinie: gerade quer über die Karte durch die Zonenmitte (y = CY), Schienen sind begehbar, der stehende Zug in der Mitte nicht.
const RAIL_HALF = MAPGEN.town.railHalf;
const TRAIN = TOWN.train;
const [TRAIN_W, TRAIN_H] = TOWN.trainSize;
const [ROLL_HOUSES, ROLL_FACTORY, ROLL_HALL, ROLL_PARK] = TOWN.lotRolls; // Obergrenzen der Blockarten
const inRail = (y, pad = 0) => Math.abs(y - CY) < RAIL_HALF + pad;
const BLOCK = MAPGEN.town.block;
const ROAD_W = MAPGEN.town.roadW;
const AVENUE_W = MAPGEN.town.avenueW;
const CAR_COLORS = ['#b8b8b0', '#8a2f2f', '#2f4f7a', '#d0c060', '#3b3b3b', '#d8d8d8', '#4f7a4f'];

/**
 * Straßenraster, Häuser, Hallen, Fabriken, Parks, geparkte Autos und Bäume.
 * Gebäude (Rechtecke {x,y,w,h,kind}) sind unpassierbar, alles andere ist Dekoration.
 */
const TOWER_SIZE = MAPGEN.town.towerSize;
// oben (Mitte) und links (knapp über der Bahnlinie); unten und rechts entstehen als Spiegelbild
const TOWER_AT = [
  { x: CX, y: CY - TOWN.towerRim * ZONE_R },
  { x: CX - TOWN.towerRim * ZONE_R, y: CY - TOWN.towerLeftDy },
];

/** Große Blöcke (MAPGEN.town.bigBlocks) samt Spiegelbild: Blockindizes i0..i0+1, j0..j0+1. */
const BIG_BLOCKS = MAPGEN.town.bigBlocks.flatMap(({ at: [i, j], empty }) => [
  { i, j, empty },
  { i: -i - 1, j: -j - 1, empty },
]);

/** Innenfläche eines großen Blocks in px (zwischen den Mittellinien der äußeren Straßen). */
function bigRect(g) {
  return { x0: CX + (g.i - 0.5) * BLOCK, x1: CX + (g.i + 1.5) * BLOCK, y0: CY + (g.j - 0.5) * BLOCK, y1: CY + (g.j + 1.5) * BLOCK };
}

/**
 * Teilstücke der Rasterstraße k (Mittellinie bei (k + 0.5) · BLOCK, 'v' senkrecht, 'h' waagrecht) von a bis b (relativ zur Zonenmitte),
 * ohne die Stücke, die durch einen großen Block laufen.
 */
function cutRoad(k, dir, a, b) {
  let parts = [[a, b]];
  for (const g of BIG_BLOCKS) {
    const [line, across] = dir === 'v' ? [g.i, g.j] : [g.j, g.i];
    if (k !== line) continue;
    const c0 = (across - 0.5) * BLOCK;
    const c1 = (across + 1.5) * BLOCK;
    parts = parts.flatMap(([p, q]) => [[p, Math.min(q, c0)], [Math.max(p, c1), q]].filter(([u, v]) => v - u > 1));
  }
  return parts;
}

function buildTown(rng) {
  const roads = [];
  const buildings = [];
  const parks = [];
  const cars = [];
  const trees = [];
  const span = Math.floor((ZONE_R - TOWN.blockMargin) / BLOCK); // Blöcke je Richtung vom Zentrum

  // Straßen zwischen den Blöcken, an der Zonenkante gekappt (Kreissehne)
  for (let k = -span - 1; k <= span; k++) {
    const off = (k + 0.5) * BLOCK;
    const half = Math.sqrt(Math.max(0, (ZONE_R - TOWN.roadRim) ** 2 - off * off));
    if (half < TOWN.roadMin) continue;
    const w = Math.abs(off) < BLOCK / 2 + 1 ? AVENUE_W : ROAD_W;
    // Große Blöcke: Straßenstücke zwischen ihren zwei Blöcken entfallen (Lücke von Kreuzung zu Kreuzung)
    for (const [a, b] of cutRoad(k, 'v', -half, half)) roads.push({ x1: CX + off, y1: CY + a, x2: CX + off, y2: CY + b, w });
    for (const [a, b] of cutRoad(k, 'h', -half, half)) roads.push({ x1: CX + a, y1: CY + off, x2: CX + b, y2: CY + off, w });
  }
  // Zufahrtsstraßen (Feldwege) von den Spawns zur Stadtkante
  for (const s of SPAWNS) {
    const a = Math.atan2(CY - s.y, CX - s.x);
    roads.push({
      x1: s.x,
      y1: s.y,
      x2: CX - Math.cos(a) * (ZONE_R - TOWN.accessEnd),
      y2: CY - Math.sin(a) * (ZONE_R - TOWN.accessEnd),
      w: TOWN.accessW,
      dirt: true,
    });
  }

  // Paarweise (Original + Spiegelbild) eintragen
  const addBuilding = (b) => {
    buildings.push(b, { ...b, x: W - b.x, y: H - b.y });
  };
  const addTree = (x, y) => {
    const r = Math.round(rng.range(...TOWN.treeR));
    trees.push({ x, y, r }, { x: W - x, y: H - y, r });
  };
  const addCar = (x, y, vertical, color) => {
    cars.push({ x, y, vertical, color }, { x: W - x, y: H - y, vertical, color });
  };

  // Zentrumsplatz: Park (nur Dekoration), bleibt frei begehbar
  const plaza = { x: CX, y: CY, r: TOWN.plazaR };
  parks.push(plaza);
  for (let i = 0; i < TOWN.plazaTrees; i++) {
    const a = (i / TOWN.plazaTrees) * TWO_PI;
    trees.push({ x: Math.round(CX + Math.cos(a) * TOWN.plazaTreeDist), y: Math.round(CY + Math.sin(a) * TOWN.plazaTreeDist), r: TOWN.plazaTreeR });
  }

  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      if (i < 0 || (i === 0 && j <= 0)) continue; // nur eine Hälfte, der Rest wird gespiegelt
      const bx = CX + i * BLOCK;
      const by = CY + j * BLOCK;
      if (dist(bx, by, CX, CY) > ZONE_R - TOWN.lotRim) continue;
      const roll = rng.next();
      if (roll < ROLL_HOUSES) {
        // Wohnhäuser
        const hc = TOWN.houseCorner;
        for (const [sx, sy] of [[-hc, -hc], [hc, -hc], [-hc, hc], [hc, hc]]) {
          if (rng.next() < TOWN.houseSkip) continue;
          addBuilding({
            x: Math.round(bx + sx + rng.range(-TOWN.houseJitter, TOWN.houseJitter)),
            y: Math.round(by + sy + rng.range(-TOWN.houseJitter, TOWN.houseJitter)),
            w: Math.round(rng.range(...TOWN.houseW)),
            h: Math.round(rng.range(...TOWN.houseH)),
            kind: 'house',
          });
        }
        addTree(bx + rng.range(-TOWN.houseTreeJitter, TOWN.houseTreeJitter), by + rng.range(-TOWN.houseTreeJitter, TOWN.houseTreeJitter));
      } else if (roll < ROLL_FACTORY) {
        // Fabrik mit Schornstein
        const flip = rng.next() < 0.5;
        addBuilding({
          x: Math.round(bx + rng.range(-TOWN.factoryJitter, TOWN.factoryJitter)),
          y: Math.round(by + rng.range(-TOWN.factoryJitter, TOWN.factoryJitter)),
          w: flip ? TOWN.factorySize[0] : TOWN.factorySize[1],
          h: flip ? TOWN.factorySize[1] : TOWN.factorySize[0],
          kind: 'factory',
        });
      } else if (roll < ROLL_HALL) {
        // Halle(n)
        addBuilding({ x: bx, y: Math.round(by - TOWN.hallDy), w: TOWN.hallSize[0], h: TOWN.hallSize[1], kind: 'hall' });
        if (rng.next() < TOWN.hall2Chance) addBuilding({ x: bx, y: Math.round(by + TOWN.hall2Dy), w: TOWN.hall2Size[0], h: TOWN.hall2Size[1], kind: 'hall' });
      } else if (roll < ROLL_PARK) {
        // kleiner Park
        parks.push({ x: bx, y: by, r: TOWN.parkR });
        parks.push({ x: W - bx, y: H - by, r: TOWN.parkR });
        const n = Math.round(rng.range(...TOWN.parkTrees));
        for (let t = 0; t < n; t++) addTree(bx + rng.range(-TOWN.parkSpread, TOWN.parkSpread), by + rng.range(-TOWN.parkSpread, TOWN.parkSpread));
      } else {
        // zwei Häuser und Bäume
        addBuilding({ x: bx - TOWN.pairOffset[0], y: by - TOWN.pairOffset[1], w: TOWN.pairA[0], h: TOWN.pairA[1], kind: 'house' });
        addBuilding({ x: bx + TOWN.pairOffset[0], y: by + TOWN.pairOffset[1], w: TOWN.pairB[0], h: TOWN.pairB[1], kind: 'house' });
        for (let t = 0; t < TOWN.pairTrees; t++) addTree(bx + rng.range(-TOWN.pairSpread, TOWN.pairSpread), by + rng.range(-TOWN.pairSpread, TOWN.pairSpread));
      }
      // geparkte Autos am Straßenrand
      const nCars = Math.floor(rng.range(0, TOWN.carMax));
      for (let c = 0; c < nCars; c++) {
        const col = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
        const side = rng.next() < 0.5 ? -1 : 1;
        const t = rng.range(-TOWN.carSpread, TOWN.carSpread);
        // am Rand der Straße (Straßenmitte BLOCK / 2, Fahrbahn eine Stadtzelle breit)
        const edge = BLOCK / 2 - TOWN.carEdge;
        if (rng.next() < 0.5) addCar(Math.round(bx + t), Math.round(by + side * edge), false, col);
        else addCar(Math.round(bx + side * edge), Math.round(by + t), true, col);
      }
    }
  }
  // Vier Wachtürme am Rand der Konfliktzone (oben, unten, links, rechts; punktsymmetrisch). Was dort im Weg steht, entfällt.
  for (const t of TOWER_AT) {
    for (const p of [t, { x: W - t.x, y: H - t.y }]) {
      const hit = (o, w, h) => Math.abs(o.x - p.x) < (w + TOWER_SIZE) / 2 + TOWN.towerClear && Math.abs(o.y - p.y) < (h + TOWER_SIZE) / 2 + TOWN.towerClear;
      for (let i = buildings.length - 1; i >= 0; i--) if (hit(buildings[i], buildings[i].w, buildings[i].h)) buildings.splice(i, 1);
      for (let i = trees.length - 1; i >= 0; i--) if (hit(trees[i], trees[i].r * 2, trees[i].r * 2)) trees.splice(i, 1);
      for (let i = cars.length - 1; i >= 0; i--) if (hit(cars[i], TOWN.carSize, TOWN.carSize)) cars.splice(i, 1);
      buildings.push({ x: Math.round(p.x), y: Math.round(p.y), w: TOWER_SIZE, h: TOWER_SIZE, kind: 'tower' });
    }
  }
  // Große Blöcke (seit v5.16): Autos auf den entfallenen Straßen weg; leere Blöcke ganz freiräumen (Bauland)
  for (const g of BIG_BLOCKS) {
    const r = bigRect(g);
    const inner = (o, pad) => o.x > r.x0 + pad && o.x < r.x1 - pad && o.y > r.y0 + pad && o.y < r.y1 - pad;
    for (let i = cars.length - 1; i >= 0; i--) if (inner(cars[i], TOWN.carBigPad)) cars.splice(i, 1);
    if (!g.empty) continue;
    for (let i = buildings.length - 1; i >= 0; i--) if (inner(buildings[i], 0) && buildings[i].kind !== 'tower') buildings.splice(i, 1);
    for (let i = trees.length - 1; i >= 0; i--) if (inner(trees[i], 0)) trees.splice(i, 1);
    for (let i = parks.length - 1; i >= 0; i--) if (inner(parks[i], 0)) parks.splice(i, 1);
  }
  // Bahnkorridor freiräumen, dann den stehenden Zug (Lok an der Ostseite) auf die Schiene stellen
  const free = (arr, pad) => arr.filter((o) => !inRail(o.y, pad(o)));
  const town = {
    roads,
    buildings: free(buildings, (b) => b.h / 2),
    parks,
    cars: free(cars, () => TOWN.carHalf),
    trees: free(trees, (t) => t.r),
    rails: [{ x1: 0, y1: CY, x2: W, y2: CY }],
  };
  for (const c of TRAIN) town.buildings.push({ x: CX + c.dx, y: CY, w: TRAIN_W, h: TRAIN_H, kind: 'train', part: c.part });
  return town;
}

const OUTPOST_HOUSES = MAPGEN.outposts.houses;
const OUTPOST_HALLS = MAPGEN.outposts.halls;
const OUTPOST_FACTORIES = MAPGEN.outposts.factories;
const WALL_T = MAPGEN.outposts.wallT;
const WALL_MARGIN = MAPGEN.outposts.wallMargin;
const WALL_GAP = MAPGEN.outposts.wallGap;

/**
 * Vereinzelte Häuser, Hallen und Fabrikgelände außerhalb der Konfliktzone (punktsymmetrisch). Ein Fabrikgelände hat eine Mauer
 * mit zwei Lücken an gegenüberliegenden Seiten: durch die eine Lücke hinein, um die Fabrik herum, durch die andere hinaus.
 * @returns {{ buildings: {x,y,w,h,kind}[], areas: {x,y,r}[] }} areas = belegte Kreise (keine Bäume dort)
 */
function buildOutposts(rng, obstacles, relief = null, clearings = []) {
  const buildings = [];
  const areas = [];
  const fits = (x, y, r) =>
    clearings.every((c) => dist(x, y, c.x, c.y) > c.r + r) && // Zufahrten der Brücken und Furten (punktsymmetrisch)
    [[x, y], [W - x, H - y]].every(
      ([px, py]) =>
        px > r + OUT.edge &&
        py > r + OUT.edge &&
        px < W - r - OUT.edge &&
        py < H - r - OUT.edge &&
        !inRail(py, r) &&
        zd(px, py) > ZONE_R + r + OUT.zoneGap &&
        SPAWNS.every((sp) => dist(px, py, sp.x, sp.y) > BUILD_LAND + r) &&
        obstacles.every((o) => dist(px, py, o.x, o.y) > o.r + r + OUT.obstacleGap) &&
        areas.every((a) => dist(px, py, a.x, a.y) > a.r + r + OUT.areaGap) &&
        groundOk(relief, px, py, r, OUT.maxSlope)
    );
  const place = (r, make) => {
    for (let t = 0; t < OUT.tries; t++) {
      const x = Math.round(rng.range(r + OUT.edge, W - r - OUT.edge));
      const y = Math.round(rng.range(r + OUT.edge, H - r - OUT.edge));
      if (!fits(x, y, r)) continue;
      const list = make(x, y);
      for (const b of list) buildings.push(b, { ...b, x: W - b.x, y: H - b.y });
      areas.push({ x, y, r }, { x: W - x, y: H - y, r });
      return;
    }
  };
  for (let i = 0; i < OUTPOST_FACTORIES; i++) {
    const flip = rng.next() < 0.5;
    const fw = flip ? TOWN.factorySize[0] : TOWN.factorySize[1];
    const fh = flip ? TOWN.factorySize[1] : TOWN.factorySize[0];
    const gapsOnX = rng.next() < 0.5; // Lücken links/rechts (sonst oben/unten)
    place(Math.hypot(fw, fh) / 2 + WALL_MARGIN + OUT.factoryPad, (x, y) => {
      const list = [{ x, y, w: fw, h: fh, kind: 'factory' }];
      const A = fw / 2 + WALL_MARGIN; // halbe Ringbreite (Mitte der Mauer)
      const B = fh / 2 + WALL_MARGIN;
      const full = (cx, cy, w, h) => list.push({ x: cx, y: cy, w, h, kind: 'wall' });
      if (gapsOnX) {
        full(x, y - B, 2 * A + WALL_T, WALL_T); // Nord- und Südmauer ganz, Ost-/Westmauer mit Lücke
        full(x, y + B, 2 * A + WALL_T, WALL_T);
        for (const sx of [-1, 1]) {
          const len = B - WALL_GAP / 2;
          full(x + sx * A, y - WALL_GAP / 2 - len / 2, WALL_T, len);
          full(x + sx * A, y + WALL_GAP / 2 + len / 2, WALL_T, len);
        }
      } else {
        full(x - A, y, WALL_T, 2 * B + WALL_T);
        full(x + A, y, WALL_T, 2 * B + WALL_T);
        for (const sy of [-1, 1]) {
          const len = A - WALL_GAP / 2;
          full(x - WALL_GAP / 2 - len / 2, y + sy * B, len, WALL_T);
          full(x + WALL_GAP / 2 + len / 2, y + sy * B, len, WALL_T);
        }
      }
      return list;
    });
  }
  for (let i = 0; i < OUTPOST_HALLS; i++) {
    const flip = rng.next() < 0.5;
    place(OUT.hallR, (x, y) => [{ x, y, w: flip ? TOWN.hallSize[1] : TOWN.hallSize[0], h: flip ? TOWN.hallSize[0] : TOWN.hallSize[1], kind: 'hall' }]);
  }
  for (let i = 0; i < OUTPOST_HOUSES; i++) {
    place(OUT.houseR, (x, y) => [{ x, y, w: Math.round(rng.range(...TOWN.houseW)), h: Math.round(rng.range(...TOWN.houseH)), kind: 'house' }]);
  }
  return { buildings, areas };
}

const SCATTER_PAIRS = MAPGEN.scatter.scatterPairs;

/** Einzelne Bäume und kleine Gruppen überall außerhalb der Stadt (punktsymmetrisch); sie blockieren wie Gebäude. */
function scatterTrees(rng, obstacles, keepOut = [], relief = null) {
  const trees = [];
  const ok = (x, y) =>
    x > SC.treeEdge &&
    y > SC.treeEdge &&
    x < W - SC.treeEdge &&
    y < H - SC.treeEdge &&
    !inRail(y, SC.treeRail) &&
    zd(x, y) > ZONE_R + SC.treeZoneGap &&
    SPAWNS.every((s) => dist(x, y, s.x, s.y) > BUILD_LAND) &&
    obstacles.every((o) => dist(x, y, o.x, o.y) > o.r + SC.treeObstacleGap) &&
    keepOut.every((a) => dist(x, y, a.x, a.y) > a.r + SC.treeAreaGap) &&
    groundOk(relief, x, y);
  const add = (x, y) => {
    if (!ok(x, y) || !ok(W - x, H - y)) return;
    const r = Math.round(rng.range(...SC.treeR));
    trees.push({ x, y, r }, { x: W - x, y: H - y, r });
  };
  for (let i = 0; i < SCATTER_PAIRS; i++) {
    const x = Math.round(rng.range(0, W));
    const y = Math.round(rng.range(0, H));
    add(x, y);
    if (rng.next() < 0.5) add(x + SC.treeGroup[0], y + SC.treeGroup[1]); // Baumgruppe
  }
  return trees;
}

const CRATE_CLEAR = MAPGEN.crates.clear;
const CRATE_ZONE = MAPGEN.crates.zoneGap;
const CRATE_SPAWN = MAPGEN.crates.spawnGap;
const CRATE_GAP = MAPGEN.crates.gap;

/** Zellen, die Start 0 zu Fuß erreicht (Breitensuche über die Nachbarzellen). */
function reachable(grid, from) {
  const seen = new Uint8Array(grid.cols * grid.rows);
  const c0 = grid.toCell(from.x);
  const r0 = grid.toCell(from.y);
  if (!grid.passable(c0, r0, 0)) return seen;
  const queue = [grid.idx(c0, r0)];
  seen[queue[0]] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.passable(nc, nr, 0)) continue;
      const j = grid.idx(nc, nr);
      if (seen[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

/**
 * Versorgungskisten (BALANCE.crates.pairs Paare, punktsymmetrisch) abseits von Zone und Startpunkten, auf freiem Boden, den Start 0
 * erreicht (das Spiegelbild erreicht Start 1 genauso). Findet sich für ein Paar kein Platz, gibt es eben weniger Kisten.
 */
function placeCrates(rng, grid) {
  const reach = reachable(grid, SPAWNS[0]);
  const open = (x, y) =>
    [[0, 0], [CRATE_CLEAR, 0], [-CRATE_CLEAR, 0], [0, CRATE_CLEAR], [0, -CRATE_CLEAR]].every(([dx, dy]) => {
      const c = grid.toCell(x + dx);
      const r = grid.toCell(y + dy);
      return grid.inBounds(c, r) && reach[grid.idx(c, r)] === 1;
    });
  const crates = [];
  for (let i = 0; i < BALANCE.crates.pairs; i++) {
    for (let t = 0; t < CR.tries; t++) {
      const x = Math.round(rng.range(CR.edge, W - CR.edge));
      const y = Math.round(rng.range(CR.edge, H - CR.edge));
      const ok = [[x, y], [W - x, H - y]].every(
        ([px, py]) =>
          zd(px, py) > ZONE_R + CRATE_ZONE &&
          !inRail(py, CR.railGap) &&
          SPAWNS.every((s) => dist(px, py, s.x, s.y) > CRATE_SPAWN) &&
          crates.every((c) => dist(px, py, c.x, c.y) > CRATE_GAP) &&
          open(px, py),
      );
      if (!ok) continue;
      crates.push({ x, y }, { x: W - x, y: H - y });
      break;
    }
  }
  return crates;
}

const FARM_CHANCE = MAPGEN.farms.chance;
const FARM_TRIES = MAPGEN.farms.tries;
const FIELD_BLOCKS = MAPGEN.farms.fieldBlocks;
const FIELD_GAP = MAPGEN.farms.fieldGap;
const FIELD_YARD = MAPGEN.farms.fieldYard;
const TRACK_W = MAPGEN.farms.trackW;
const TRACK_REACH = MAPGEN.farms.trackReach;
const CROP_ROLL = MAPGEN.farms.cropRoll;

/** Punkt im (gedrehten) Rechteck {x, y, w, h, angle}, Rand um pad erweitert. */
function inBox(b, px, py, pad = 0) {
  const a = b.angle || 0;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const lx = (px - b.x) * c + (py - b.y) * sn;
  const ly = -(px - b.x) * sn + (py - b.y) * c;
  return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
}

/** Abstand eines Punkts zur Strecke, mit Fußpunkt. */
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return { d: Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)), x: x1 + t * dx, y: y1 + t * dy };
}

/** Stützpunkte über die Fläche eines Felds (Raster alle ~40 px, Ränder eingeschlossen). */
function fieldPoints(f) {
  const pts = [];
  const nx = Math.max(1, Math.ceil(f.w / 40));
  const ny = Math.max(1, Math.ceil(f.h / 40));
  const c = Math.cos(f.angle || 0);
  const sn = Math.sin(f.angle || 0);
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const lx = (i / nx - 0.5) * f.w;
      const ly = (j / ny - 0.5) * f.h;
      pts.push([f.x + lx * c - ly * sn, f.y + lx * sn + ly * c]);
    }
  }
  return pts;
}

const boxR = (b) => Math.hypot(b.w, b.h) / 2;

/**
 * Äcker und Weiden, punktsymmetrisch: um die Einzelhäuser außerhalb der Zone (Gehöfte) je eine Reihe von 1–3 Feldern auf einer Seite
 * des Hauses mit einem Feldweg zwischen Haus und Feldern; dazu freie Flure (zwei Feldreihen beiderseits eines Feldwegs). Feldwege
 * führen weiter zur nächsten Straße, zu einem anderen Feldweg oder zum Nachbargehöft. Nur Boden: Felder und Feldwege blockieren
 * nichts, Bäume darauf fallen weg. Eigener Zufall, damit der Rest der Karte je Seed gleich bleibt.
 * Schreibt town.fields und hängt die Feldwege an town.roads (dirt) an.
 */
function placeFarms(seed, town, outpostBuildings, obstacles, trees, relief) {
  const rng = makeRng((Math.imul(seed, 2654435761) ^ 0x5eed) >>> 0);
  const fields = [];
  const tracks = [];
  const roads = town.roads;
  const buildings = town.buildings;
  const dry = (x, y) => !relief || groundOk(relief, x, y);
  // Feld frei? Erst grob nach Abstand vorsortieren, dann jeden Stützpunkt (und sein Spiegelbild) prüfen
  const fieldOk = (f) => {
    const R = boxR(f);
    const sides = [[f.x, f.y], [W - f.x, H - f.y]];
    const near = (list, r) => list.filter((o) => sides.some(([x, y]) => dist(x, y, o.x, o.y) < R + r(o)));
    const obs = near(obstacles, (o) => o.r + FARM.fieldNearObstacle);
    const bld = near(buildings, (b) => boxR(b) + FARM.fieldNearBuilding);
    const fld = near(fields, (o) => boxR(o) + FIELD_GAP);
    const rds = roads.filter((r) => sides.some(([x, y]) => segDist(x, y, r.x1, r.y1, r.x2, r.y2).d < R + r.w));
    return fieldPoints(f).every(([x, y]) =>
      [[x, y], [W - x, H - y]].every(
        ([px, py]) =>
          px > FARM.fieldEdge && py > FARM.fieldEdge && px < W - FARM.fieldEdge && py < H - FARM.fieldEdge &&
          !inRail(py, FARM.fieldRail) &&
          zd(px, py) > ZONE_R + FARM.fieldZone &&
          SPAWNS.every((sp) => dist(px, py, sp.x, sp.y) > BUILD_LAND) &&
          obs.every((o) => dist(px, py, o.x, o.y) > o.r + FARM.fieldObstacle) &&
          bld.every((b) => !inBox(b, px, py, FARM.fieldBuilding)) &&
          fld.every((o) => !inBox(o, px, py, FIELD_GAP / 2)) &&
          rds.every((r) => segDist(px, py, r.x1, r.y1, r.x2, r.y2).d > r.w / 2 + FARM.fieldRoad) &&
          dry(px, py),
      ),
    );
  };
  // Feldweg von A nach B: frei von Wald, Wasser, fremden Gebäuden und Feldern (Haus am Anfang/Ende und ihr Spiegelbild zählen nicht)
  const mine = (b, o) => !!o && ((b.x === o.x && b.y === o.y) || (b.x === W - o.x && b.y === H - o.y));
  const trackOk = (x1, y1, x2, y2, ownA = null, ownB = null) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 30));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n;
      const y = y1 + ((y2 - y1) * i) / n;
      for (const [px, py] of [[x, y], [W - x, H - y]]) {
        if (px < FARM.trackEdge || py < FARM.trackEdge || px > W - FARM.trackEdge || py > H - FARM.trackEdge || dist(px, py, CX, CY) < ZONE_R - FARM.trackZone) return false;
        if (obstacles.some((o) => dist(px, py, o.x, o.y) < o.r + FARM.trackObstacle)) return false;
        if (buildings.some((b) => !mine(b, ownA) && !mine(b, ownB) && inBox(b, px, py, FARM.trackBuilding))) return false;
        if (fields.some((f) => inBox(f, px, py, -FARM.trackField))) return false;
        if (!dry(px, py)) return false;
      }
    }
    return true;
  };
  const addTrack = (x1, y1, x2, y2) => {
    const r = { x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), w: TRACK_W, dirt: true };
    const m = { x1: W - r.x1, y1: H - r.y1, x2: W - r.x2, y2: H - r.y2, w: TRACK_W, dirt: true };
    tracks.push(r, m);
    return [r, m];
  };
  // Blickrahmen: u zeigt von der Mitte zur Feldreihe, v läuft die Reihe entlang; Seite 0–3 = rechts, unten, links, oben (gedreht um angle)
  const frame = (angle, side) => {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const alongX = side % 2 === 0;
    const sg = side < 2 ? 1 : -1;
    const u = alongX ? [c * sg, sn * sg] : [-sn * sg, c * sg];
    return { angle, alongX, u, v: [-u[1], u[0]] };
  };
  const randAngle = () => (rng.next() < FARM.angleStraight ? 0 : Math.round(rng.range(-FARM.angleMax, FARM.angleMax) * 100) / 100);
  const randWidths = (lo, hi) => {
    const out = [];
    for (let k = rng.int(lo, hi); k > 0; k--) out.push(Math.round(rng.range(...FARM.fieldWidth)));
    return out;
  };
  // Feldreihe um (ax, ay): Felder der Tiefe `depth` nebeneinander entlang v, ihre Mitte bei u = uc; nur die freien kommen mit
  const row = (ax, ay, fr, uc, depth, widths, shift) => {
    const total = widths.reduce((a, b) => a + b, 0) + FIELD_GAP * (widths.length - 1);
    let v = -total / 2 + shift;
    const out = [];
    for (const wv of widths) {
      const vc = v + wv / 2;
      v += wv + FIELD_GAP;
      const roll = rng.next();
      const cr = rng.next();
      const f = {
        x: Math.round(ax + fr.u[0] * uc + fr.v[0] * vc),
        y: Math.round(ay + fr.u[1] * uc + fr.v[1] * vc),
        w: fr.alongX ? depth : wv,
        h: fr.alongX ? wv : depth,
        ...(fr.angle ? { angle: fr.angle } : {}),
        kind: roll < FARM.pasture ? 'pasture' : 'field',
      };
      if (f.kind === 'field') f.crop = CROP_ROLL.find(([, p]) => cr <= p)[0];
      if (fieldOk(f)) out.push({ f, v0: vc - wv / 2, v1: vc + wv / 2 });
    }
    return out;
  };
  const area = (list) => list.reduce((a, c) => a + c.f.w * c.f.h, 0);
  const commit = (list) => {
    for (const { f } of list) fields.push(f, { ...f, x: W - f.x, y: H - f.y });
  };
  // Weg entlang v bei u = ut über die Spanne [v0, v1] um (ax, ay)
  const lane = (ax, ay, fr, ut, v0, v1) => [ax + fr.u[0] * ut + fr.v[0] * v0, ay + fr.u[1] * ut + fr.v[1] * v0, ax + fr.u[0] * ut + fr.v[0] * v1, ay + fr.u[1] * ut + fr.v[1] * v1];

  // 1. Gehöfte: Feldreihe neben dem Haus, Feldweg dazwischen
  const farms = [];
  for (let i = 0; i < outpostBuildings.length; i += 2) {
    const h = outpostBuildings[i];
    if (h.kind !== 'house' || rng.next() >= FARM_CHANCE) continue;
    let best = null;
    for (let t = 0; t < FARM_TRIES; t++) {
      const fr = frame(randAngle(), rng.int(0, 3));
      const halfU = (Math.abs(fr.u[0]) * h.w + Math.abs(fr.u[1]) * h.h) / 2;
      const depth = Math.round(rng.range(...FARM.farmDepth));
      const got = row(h.x, h.y, fr, halfU + FIELD_YARD + depth / 2, depth, randWidths(...FARM.farmFields), rng.range(-FARM.farmShift, FARM.farmShift));
      if (got.length && (!best || area(got) > area(best.got))) best = { fr, halfU, got };
    }
    if (!best) continue;
    commit(best.got);
    const v0 = Math.min(0, ...best.got.map((c) => c.v0)) - FARM.laneExtra;
    const v1 = Math.max(0, ...best.got.map((c) => c.v1)) + FARM.laneExtra;
    const ln = lane(h.x, h.y, best.fr, best.halfU + FIELD_YARD / 2, v0, v1);
    const own = trackOk(...ln, h) ? addTrack(...ln) : [];
    farms.push({ x: h.x, y: h.y, b: h, ends: [[h.x, h.y]], own });
  }
  // 2. Freie Flure: zwei Feldreihen beiderseits eines Feldwegs
  for (let i = 0; i < FIELD_BLOCKS; i++) {
    for (let t = 0; t < FARM.blockTries; t++) {
      const x = rng.range(FARM.blockEdge, W - FARM.blockEdge);
      const y = rng.range(FARM.blockEdge, H - FARM.blockEdge);
      if (zd(x, y) < ZONE_R + FARM.blockZoneGap) continue;
      const angle = randAngle();
      const fr = frame(angle, 0);
      const back = frame(angle, 2);
      const depth = Math.round(rng.range(...FARM.blockDepth));
      const uc = TRACK_W / 2 + FIELD_GAP / 2 + depth / 2;
      const widths = randWidths(...FARM.blockFields);
      const got = [...row(x, y, fr, uc, depth, widths, 0), ...row(x, y, back, uc, depth, widths, 0).map((c) => ({ ...c, v0: -c.v1, v1: -c.v0 }))];
      if (got.length < FARM.blockMin) continue;
      commit(got);
      const ln = lane(x, y, fr, 0, Math.min(...got.map((c) => c.v0)) - FARM.laneExtra, Math.max(...got.map((c) => c.v1)) + FARM.laneExtra);
      const own = trackOk(...ln) ? addTrack(...ln) : [];
      farms.push({ x, y, b: null, ends: [[ln[0], ln[1]], [ln[2], ln[3]]], own });
      break;
    }
  }
  // 3. Anbindung: vom Haus bzw. Wegende zur nächsten Straße oder einem schon gebauten Feldweg, sonst zum nächsten Gehöft
  for (const fm of farms) {
    const cands = [];
    for (const [sx, sy] of fm.ends) {
      for (const r of [...roads, ...tracks]) {
        if (fm.own.includes(r)) continue; // der eigene Weg an der Feldreihe bindet nicht an
        const q = segDist(sx, sy, r.x1, r.y1, r.x2, r.y2);
        if (q.d > FARM.trackMin && q.d < TRACK_REACH) cands.push({ d: q.d, sx, sy, x: q.x, y: q.y, to: null });
      }
      for (const o of farms) {
        const d = dist(sx, sy, o.x, o.y);
        if (o !== fm && o.b && d < TRACK_REACH) cands.push({ d: d * FARM.trackDetour, sx, sy, x: o.x, y: o.y, to: o.b });
      }
    }
    cands.sort((a, b) => a.d - b.d);
    for (const q of cands.slice(0, FARM.trackCands)) {
      if (!trackOk(q.sx, q.sy, q.x, q.y, fm.b, q.to)) continue;
      addTrack(q.sx, q.sy, q.x, q.y);
      break;
    }

  }
  // Bäume auf Feldern und Feldwegen fallen weg (paarweise: Felder und Wege sind punktsymmetrisch)
  for (let i = trees.length - 1; i >= 0; i--) {
    const t = trees[i];
    if (fields.some((f) => inBox(f, t.x, t.y, t.r)) || tracks.some((r) => segDist(t.x, t.y, r.x1, r.y1, r.x2, r.y2).d < r.w / 2 + t.r)) trees.splice(i, 1);
  }
  town.fields = fields;
  roads.push(...tracks);
}

/** Innenflächen der großen Blöcke der Zonenstadt in px {x0, y0, x1, y1, empty} (Tests, seit v5.16). */
export function townBigBlocks() {
  return BIG_BLOCKS.map((g) => ({ ...bigRect(g), empty: g.empty }));
}

const PG = MAPGEN.props;

/** Kumulierte Auswahl [[Wert, Schwelle] …] mit einer Zufallszahl 0 … 1. */
const pick = (table, u) => table.find(([, t]) => u <= t)?.[0] ?? table[table.length - 1][0];

/**
 * Zäune und Mauern der Zufallskarte (MAPGEN.props): an einer Seite einiger gerader Äcker ein Stück Kacheln, in der
 * Rasterzelle direkt außerhalb des Feldrands, nur auf freiem Boden (grid), abseits von Straßen, Feldwegen, Startpunkten, Zone,
 * Kisten und Brückenzufahrten. Felder liegen paarweise (Original, Spiegelbild); jedes Stück wird punktsymmetrisch gespiegelt.
 */
function placeProps(seed, town, grid, crates, cleared) {
  const rng = makeRng(seed + PG.salt);
  const props = [];
  const taken = new Set();
  const roads = town.roads;
  const free = (x, y) => {
    const c = grid.toCell(x);
    const r = grid.toCell(y);
    if (!grid.passable(c, r, 0) || !grid.passable(grid.toCell(W - x), grid.toCell(H - y), 0)) return false;
    if (taken.has(`${c},${r}`)) return false;
    if (zd(x, y) < ZONE_R || inRail(y, TILE) || cleared(x, y, TILE)) return false;
    if (SPAWNS.some((s) => dist(x, y, s.x, s.y) < PG.spawnGap || dist(W - x, H - y, s.x, s.y) < PG.spawnGap)) return false;
    if (crates.some((k) => dist(x, y, k.x, k.y) < PG.crateGap)) return false;
    return !roads.some((rd) => segDist(x, y, rd.x1, rd.y1, rd.x2, rd.y2).d < rd.w / 2 + PG.roadGap + TILE / 2);
  };
  for (let i = 0; i < town.fields.length; i += 2) {
    const f = town.fields[i];
    const roll = rng.next();
    const side = Math.floor(rng.next() * 4);
    const n = Math.round(rng.range(...PG.len));
    const u0 = rng.next();
    const kind = pick(PG.kinds, rng.next());
    if (f.angle || f.kind === 'pasture' || roll > PG.field) continue; // Weiden haben ihren gemalten Koppelzaun
    // Linie in der Zelle direkt vor der Seite side (0 oben, 1 rechts, 2 unten, 3 links)
    const along = side % 2 === 0;
    const len = Math.floor((along ? f.w : f.h) / TILE);
    if (len < PG.minLen) continue;
    const start = Math.floor(u0 * Math.max(0, len - n));
    const fx0 = f.x - f.w / 2;
    const fy0 = f.y - f.h / 2;
    const cells = [];
    for (let k = start; k < Math.min(len, start + n); k++) {
      const x = along ? grid.toCell(fx0 + (k + 0.5) * TILE) : grid.toCell(side === 1 ? f.x + f.w / 2 + TILE / 2 : fx0 - TILE / 2);
      const y = along ? grid.toCell(side === 2 ? f.y + f.h / 2 + TILE / 2 : fy0 - TILE / 2) : grid.toCell(fy0 + (k + 0.5) * TILE);
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      if (!free(px, py)) break; // nur der zusammenhängende Anfang
      cells.push({ x: px, y: py });
    }
    if (cells.length < PG.minLen) continue;
    const gateAt = kind !== 'wall_stone' && cells.length >= PG.gateMin ? cells.length >> 1 : -1;
    cells.forEach((p, k) => {
      const o = { kind, x: p.x, y: p.y, ...(k === gateAt ? { gate: GATE.open } : {}) };
      props.push(o, { ...o, x: W - p.x, y: H - p.y });
      taken.add(`${grid.toCell(p.x)},${grid.toCell(p.y)}`);
      taken.add(`${grid.toCell(W - p.x)},${grid.toCell(H - p.y)}`);
    });
  }
  // Feldlager an Versorgungskisten (Kisten liegen paarweise: Original, Spiegelbild)
  const cols = W / TILE;
  const rows = H / TILE;
  for (let i = 0; i < crates.length; i += 2) {
    const k0 = crates[i];
    const roll = rng.next();
    const a0 = rng.next() * Math.PI * 2;
    if (roll > PG.camp) continue;
    PG.campKinds.forEach((kind, n) => {
      for (let t = 0; t < PG.campTries; t++) {
        const a = a0 + (n / PG.campKinds.length) * Math.PI * 2 + (rng.next() - 0.5) * PG.campJitter;
        const r = rng.range(...PG.campR);
        const o = { kind, x: Math.round(k0.x + Math.cos(a) * r), y: Math.round(k0.y + Math.sin(a) * r), rot: Math.floor(rng.next() * 8) };
        const m = { ...o, x: W - o.x, y: H - o.y, rot: (o.rot + 4) % 8 };
        const all = [...propCells(o, cols, rows), ...propCells(m, cols, rows)];
        const ok = all.every((j) => free(((j % cols) + 0.5) * TILE, (Math.floor(j / cols) + 0.5) * TILE));
        if (!ok) continue;
        props.push(o, m);
        for (const j of all) taken.add(`${j % cols},${Math.floor(j / cols)}`);
        break;
      }
    });
  }
  // Lagerhöfe an freistehenden Hallen (Hallen liegen paarweise: Original, Spiegelbild)
  const halls = town.buildings.filter((b) => b.kind === 'hall');
  for (let i = 0; i < halls.length; i += 2) {
    const h = halls[i];
    const roll = rng.next();
    const side = rng.next() < 0.5 ? -1 : 1;
    if (roll > PG.yard) continue;
    const long = h.w >= h.h; // Längsseite entlang x
    const half = (long ? h.w : h.h) / 2;
    const off = (long ? h.h : h.w) / 2 + PG.yardGap;
    const items = [];
    for (let t = -half + PG.yardStep / 2; t <= half - PG.yardStep / 2; t += PG.yardStep) {
      const fill = rng.next();
      const kind = pick(PG.yardKinds, rng.next());
      const stack = 1 + Math.floor(rng.next() * PG.stackMax);
      if (fill > PG.yardFill) continue;
      const x = Math.round(long ? h.x + t : h.x + side * off);
      const y = Math.round(long ? h.y + side * off : h.y + t);
      items.push({ kind, x, y, rot: long ? 0 : 2, ...(kind === 'container' && stack > 1 ? { stack } : {}) });
    }
    if (rng.next() < PG.lampAt) items.push({ kind: 'street_lamp', x: Math.round(long ? h.x - half : h.x + side * off), y: Math.round(long ? h.y + side * off : h.y - half) });
    for (const o of items) {
      const m = { ...o, x: W - o.x, y: H - o.y, ...(o.rot ? { rot: (o.rot + 4) % 8 } : { rot: 4 }) };
      const all = [...propCells(o, cols, rows), ...propCells(m, cols, rows)];
      if (!all.every((j) => free(((j % cols) + 0.5) * TILE, (Math.floor(j / cols) + 0.5) * TILE))) continue;
      props.push(o, m);
      for (const j of all) taken.add(`${j % cols},${Math.floor(j / cols)}`);
    }
  }
  // Einzelstück o samt Spiegelbild setzen, wenn alle Zellen frei sind (Spiegelbild halb gedreht)
  const put = (o) => {
    const m = { ...o, x: W - o.x, y: H - o.y, rot: ((o.rot ?? 0) + 4) % 8 };
    const all = [...propCells(o, cols, rows), ...propCells(m, cols, rows)];
    if (!all.every((j) => free(((j % cols) + 0.5) * TILE, (Math.floor(j / cols) + 0.5) * TILE))) return false;
    props.push(o, m);
    for (const j of all) taken.add(`${j % cols},${Math.floor(j / cols)}`);
    return true;
  };
  // Kriegsspuren im Ring um die Zone
  for (let i = 0; i < PG.scars; i++) {
    const kind = pick(PG.scarKinds, rng.next());
    for (let t = 0; t < PG.scarTries; t++) {
      const a = rng.next() * Math.PI * 2;
      const r = ZONE_R + rng.range(...PG.scarRing);
      const rot = Math.floor(rng.next() * 8) & (PROPS.kinds[kind].rotStep === 2 ? 6 : 7);
      if (put({ kind, x: Math.round(CX + Math.cos(a) * r), y: Math.round(CY + Math.sin(a) * r), rot })) break;
    }
  }
  // Kleinkram an Einzelhäusern (Häuser liegen paarweise: Original, Spiegelbild)
  const homes = town.buildings.filter((b) => b.kind === 'house');
  for (let i = 0; i < homes.length; i += 2) {
    const h = homes[i];
    const roll = rng.next();
    const kind = pick(PG.homeKinds, rng.next());
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(...PG.homeR);
    const rot = Math.floor(rng.next() * 4) * 2;
    if (roll > PG.homes) continue;
    put({ kind, x: Math.round(h.x + Math.cos(a) * r), y: Math.round(h.y + Math.sin(a) * r), rot });
  }
  return props;
}
