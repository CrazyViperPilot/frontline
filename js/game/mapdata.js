// Kartendaten für Karteneditor und gespeicherte Karten: Format, Prüfung, Speicher (localStorage). Kein DOM-Zugriff außer localStorage.
import { BALANCE } from '../data/balance.js';
import { MAPGEN } from '../data/mapgen.js';
import { Grid } from './grid.js';
import { findPath } from './pathfinding.js';
import { Relief, reliefOf, reliefSize, shiftRelief } from './relief.js';
import { countRoutes } from './landscape.js';
import { openBridges } from './river.js';
import { sideOf } from './zonegeo.js';
import { FIXED_MAPS } from '../data/maps/index.js';
import { PROPS } from '../data/props.js';
import { rasterizeProps, propCells, GATE } from './props.js';

const W = BALANCE.map.width;
const H = BALANCE.map.height;
const TILE = BALANCE.map.tile;
const BUILDING_KINDS = ['house', 'factory', 'hall', 'tower', 'train', 'station', 'platform', 'wall', 'plant', 'pylon']; // wall: Mauer um Fabrikgelände; plant: große Fabrikhalle; pylon: Strommast (Paket „Feste Karten“)
const TURNABLE = ['train', 'platform']; // dürfen beliebig gedreht sein (`angle`, Bogenmaß)
const CHECK = MAPGEN.check;
const SPAWN_CLEAR = CHECK.spawnClear; // freier Platz um einen Startpunkt (Hauptstadt und Startunits)
export const MAX_CRATES = 24; // Versorgungskisten je Karte
export const FIELD_CROPS = ['wheat', 'green', 'soil', 'rape']; // Ackerarten: Weizen, junge Saat, gepflügt, Raps
export const MAX_FIELDS = 300; // Felder und Weiden je Karte
export const MAX_PAVING = 2000; // Plätze und Bürgersteige je Karte (je Liste)
export const PLAZA_SIZE = 64; // Kantenlänge eines neuen Platzes (px, eine Stadtzelle)
export const WALK_W = 20; // Breite eines neuen Bürgersteigs (px)
export const MAX_FORDS = 24; // Furten je Karte (Fluss, river.js)
export const MAX_BRIDGES = 24; // Brücken je Karte
export const BRIDGE_LEN = [96, 900]; // kürzeste und längste Brücke (px)
export const MAX_SPAWNS = 4; // Startpunkte je Karte (2 bis 4; Team i startet am Startpunkt i)
export const MAX_FLAGS = BALANCE.conquest.names.length; // eigene Flaggen je Karte (Eroberung)
export const MAX_PROPS = 6000; // Props je Karte (Zaunkacheln einzeln gezählt)
export const PYLON_LINES = 32; // Leitungen je Karte: Strommasten mit gleicher `line` sind in Listenreihenfolge verbunden

/** Leere Karte: nur Startpunkte in den Ecken und die Konfliktzone in der Mitte. */
export function createEmptyMap(name = 'Neue Karte') {
  return normalizeMap({
    name,
    obstacles: [],
    town: { roads: [], buildings: [], parks: [], cars: [], trees: [], rails: [], fields: [] },
    trees: [],
    spawns: [
      { x: MAPGEN.general.spawnEdge, y: H - MAPGEN.general.spawnEdge },
      { x: W - MAPGEN.general.spawnEdge, y: MAPGEN.general.spawnEdge },
    ],
    zone: { x: W / 2, y: H / 2, r: BALANCE.zone.r },
    crates: [],
  });
}

const num = (v, d) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Ältere Karte anderer Größe (bis v5.11 waren alle Karten 9024 × 9024 px) mittig in die heutige Karte setzen: alle Punkte um
 * den halben Größenunterschied verschoben, Zone und Startpunkte behalten ihren Abstand, außen kommt freies Land dazu. Gleise und
 * Wege, die am alten Rand endeten, laufen bis zum neuen Rand weiter; das Gelände setzt den alten Rand fort. Die Größe steht in
 * `width`/`height` (fehlt sie, zählt die Größe des Höhengeländes, sonst die heutige). Karten heutiger Größe bleiben unverändert.
 */
function fitSize(src) {
  const fromRelief = typeof src.relief === 'string' ? reliefSize(src.relief) : null;
  const w0 = Number.isFinite(src.width) && src.width > 0 ? src.width : (fromRelief ?? W);
  const h0 = Number.isFinite(src.height) && src.height > 0 ? src.height : w0;
  if (w0 === W && h0 === H) return src;
  const dx = Math.round((W - w0) / 2);
  const dy = Math.round((H - h0) / 2);
  const mx = (x) => (Number.isFinite(x) ? x + dx : x);
  const my = (y) => (Number.isFinite(y) ? y + dy : y);
  // Endpunkt einer Strecke: am alten Rand → am neuen Rand
  const ex = (x) => (!Number.isFinite(x) ? x : x <= 0 ? 0 : x >= w0 ? W : x + dx);
  const ey = (y) => (!Number.isFinite(y) ? y : y <= 0 ? 0 : y >= h0 ? H : y + dy);
  const arr = (a) => (Array.isArray(a) ? a : []);
  const pts = (a) => arr(a).map((o) => (o && typeof o === 'object' ? { ...o, x: mx(o.x), y: my(o.y) } : o));
  const segs = (a, edge) => arr(a).map((o) => (o && typeof o === 'object' ? { ...o, x1: (edge ? ex : mx)(o.x1), y1: (edge ? ey : my)(o.y1), x2: (edge ? ex : mx)(o.x2), y2: (edge ? ey : my)(o.y2) } : o));
  const town = src.town ?? {};
  const rail = town.rail && Number.isFinite(town.rail.y) ? { x1: 0, y1: town.rail.y, x2: town.rail.x2 ?? w0, y2: town.rail.y } : null;
  const out = {
    ...src,
    width: W,
    height: H,
    obstacles: pts(src.obstacles),
    trees: pts(src.trees),
    spawns: pts(src.spawns),
    ...(src.flags ? { flags: pts(src.flags) } : {}),
    zone: src.zone && typeof src.zone === 'object' ? { ...src.zone, x: mx(src.zone.x), y: my(src.zone.y) } : { x: w0 / 2 + dx, y: h0 / 2 + dy, r: BALANCE.zone.r },
    crates: pts(src.crates),
    ...(src.props ? { props: pts(src.props) } : {}),
    town: {
      ...town,
      roads: segs(town.roads, true),
      buildings: pts(town.buildings),
      parks: pts(town.parks),
      cars: pts(town.cars),
      trees: pts(town.trees),
      rails: segs([...arr(town.rails), ...(rail ? [rail] : [])], true),
      fields: pts(town.fields),
      ...(town.plazas ? { plazas: pts(town.plazas) } : {}),
      ...(town.walks ? { walks: segs(town.walks, false) } : {}),
    },
    ...(src.fords ? { fords: pts(src.fords) } : {}),
    ...(src.bridges ? { bridges: segs(src.bridges, false) } : {}),
  };
  delete out.town.rail;
  if (typeof src.relief === 'string') {
    const relief = shiftRelief(src.relief, dx, dy);
    if (relief) out.relief = relief;
    else delete out.relief;
  }
  return out;
}

/** Beliebiges Kartenobjekt (generiert oder aus JSON) → vollständige, bereinigte Karte. Wirft bei unbrauchbaren Daten. */
export function normalizeMap(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Keine Karte');
  const src = fitSize(raw);
  const town = src.town ?? {};
  const pt = (o) => ({ x: clamp(num(o.x, 0), 0, W), y: clamp(num(o.y, 0), 0, H) });
  const circ = (o, lo, hi) => ({ ...pt(o), r: clamp(num(o.r, lo), lo, hi) });
  const arr = (a) => (Array.isArray(a) ? a : []);
  const spawns = arr(src.spawns).map(pt);
  if (spawns.length < 2 || spawns.length > MAX_SPAWNS) throw new Error(`Eine Karte braucht zwei bis ${MAX_SPAWNS} Startpunkte`);
  // Eroberung (Paket „Feste Karten“): eigene Flaggen statt des 4 × 4-Rasters, Gebiet ein Kreis; layout 'sides': Baugebiete an den
  // Kartenseiten (Teilung entlang der Diagonalen) statt in den Ecken
  const [fr0, fr1] = BALANCE.conquest.mapFlagRange;
  const flags = arr(src.flags).slice(0, MAX_FLAGS).map((f) => ({ ...pt(f), r: Math.round(clamp(num(f.r, BALANCE.conquest.mapFlagR), fr0, fr1)), ...(typeof f.name === 'string' && f.name ? { name: f.name.slice(0, 24) } : {}) }));
  const zone = circ(src.zone ?? { x: W / 2, y: H / 2, r: BALANCE.zone.r }, 200, 4000);
  // Gleise: freie Strecken; die ältere Form (eine Bahnlinie quer über die Karte, `rail: {y}`) wird übernommen
  const railSrc = arr(town.rails).slice();
  if (town.rail && Number.isFinite(town.rail.y)) railSrc.push({ x1: 0, y1: town.rail.y, x2: W, y2: town.rail.y });
  const rails = railSrc.map((r) => ({
    x1: clamp(num(r.x1, 0), 0, W),
    y1: clamp(num(r.y1, 0), 0, H),
    x2: clamp(num(r.x2, 0), 0, W),
    y2: clamp(num(r.y2, 0), 0, H),
  }));
  const fords = arr(src.fords).slice(0, MAX_FORDS).map((f) => circ(f, 60, 400));
  const bridges = arr(src.bridges)
    .map((b) => ({
      x1: Math.round(clamp(num(b.x1, 0), 0, W)),
      y1: Math.round(clamp(num(b.y1, 0), 0, H)),
      x2: Math.round(clamp(num(b.x2, 0), 0, W)),
      y2: Math.round(clamp(num(b.y2, 0), 0, H)),
      ...(b.rail ? { rail: true } : {}), // Eisenbahnbrücke: Gleis statt Fahrbahn (nur Optik; Fahrzeuge kommen trotzdem hinüber)
    }))
    .filter((b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) >= BRIDGE_LEN[0])
    .slice(0, MAX_BRIDGES);
  const plazas = arr(town.plazas).slice(0, MAX_PAVING).map((p) => ({
    ...pt(p),
    w: clamp(num(p.w, PLAZA_SIZE), 16, 600),
    h: clamp(num(p.h, PLAZA_SIZE), 16, 600),
    ...(Number.isFinite(p.angle) && Math.abs(p.angle) > 1e-3 ? { angle: clamp(p.angle, -Math.PI, Math.PI) } : {}),
  }));
  const walks = arr(town.walks)
    .slice(0, MAX_PAVING)
    .map((r) => ({
      x1: clamp(num(r.x1, 0), 0, W),
      y1: clamp(num(r.y1, 0), 0, H),
      x2: clamp(num(r.x2, 0), 0, W),
      y2: clamp(num(r.y2, 0), 0, H),
      w: clamp(num(r.w, WALK_W), 8, 64),
    }))
    .filter((r) => Math.hypot(r.x2 - r.x1, r.y2 - r.y1) >= 1);
  const props = normProps(arr(src.props));
  return {
    name: String(src.name ?? 'Karte').slice(0, 40),
    width: W,
    height: H,
    tile: TILE,
    obstacles: arr(src.obstacles).map((o) => circ(o, 20, 400)),
    town: {
      roads: arr(town.roads).map((r) => ({
        x1: clamp(num(r.x1, 0), 0, W),
        y1: clamp(num(r.y1, 0), 0, H),
        x2: clamp(num(r.x2, 0), 0, W),
        y2: clamp(num(r.y2, 0), 0, H),
        w: clamp(num(r.w, 64), 20, 200),
        ...(r.dirt ? { dirt: true } : {}),
      })),
      buildings: arr(town.buildings).map((b) => ({
        ...pt(b),
        w: clamp(num(b.w, 90), 24, 600),
        h: clamp(num(b.h, 70), 24, 600),
        kind: BUILDING_KINDS.includes(b.kind) ? b.kind : 'house',
        ...(TURNABLE.includes(b.kind) && Number.isFinite(b.angle) && Math.abs(b.angle) > 1e-3 ? { angle: clamp(b.angle, -Math.PI * 2, Math.PI * 2) } : {}),
        ...(b.kind === 'pylon' ? { line: Math.round(clamp(num(b.line, 0), 0, PYLON_LINES - 1)) } : {}),
        ...(b.kind === 'train' ? { part: ['loco', 'container', 'tank'].includes(b.part) ? b.part : 'container' } : {}),
      })),
      parks: arr(town.parks).map((p) => circ(p, 40, 400)),
      cars: arr(town.cars).map((c) => ({ ...pt(c), vertical: !!c.vertical, color: String(c.color || '#b8b8b0').slice(0, 9) })),
      trees: arr(town.trees).map((t) => circ(t, 6, 40)),
      rails,
      // Äcker und Weiden (nur Boden, blockieren nichts); ältere Karten haben keine
      fields: arr(town.fields).slice(0, MAX_FIELDS).map((f) => ({
        ...pt(f),
        w: clamp(num(f.w, 300), 60, 900),
        h: clamp(num(f.h, 220), 60, 900),
        ...(Number.isFinite(f.angle) && Math.abs(f.angle) > 1e-3 ? { angle: clamp(f.angle, -Math.PI, Math.PI) } : {}),
        kind: f.kind === 'pasture' ? 'pasture' : 'field',
        ...(f.kind === 'pasture' ? {} : { crop: FIELD_CROPS.includes(f.crop) ? f.crop : 'wheat' }),
      })),
      // Pflaster (nur Boden, blockiert nichts): graue Plätze und Bürgersteige; nur Karten mit Pflaster haben die Felder
      ...(plazas.length ? { plazas } : {}),
      ...(walks.length ? { walks } : {}),
    },
    trees: arr(src.trees).map((t) => circ(t, 6, 40)),
    spawns,
    zone,
    ...(flags.length ? { flags } : {}),
    ...(src.layout === 'sides' ? { layout: 'sides' } : {}),
    crates: arr(src.crates).slice(0, MAX_CRATES).map(pt), // Versorgungskisten (crates.js); ältere Karten haben keine
    // Props (Deko und Gelände, game/props.js): Kacheln (Zäune, Mauern) mittig in ihrer Rasterzelle; Karten ohne Props haben das Feld nicht
    ...(props.length ? { props } : {}),
    // Furten und Brücken über Flüsse (river.js); Karten ohne Fluss haben die Felder nicht
    ...(fords.length ? { fords } : {}),
    ...(bridges.length ? { bridges } : {}),
    // Höhengelände (relief.js) als Text; fehlt es oder ist es kaputt, ist die Karte flach
    ...(typeof src.relief === 'string' && Relief.decode(src.relief) ? { relief: src.relief } : {}),
  };
}

/** Props prüfen: bekannte Art, im Feld; Kacheln mittig in ihre Zelle, Drehung in Achteln (0 … 7), Tor nur bei Arten mit Tor. */
function normProps(list) {
  const seen = new Set(); // je Zelle höchstens eine Kachel
  const out = [];
  for (const p of list) {
    const K = p && PROPS.kinds[p.kind];
    if (!K || !Number.isFinite(p.x) || !Number.isFinite(p.y) || out.length >= MAX_PROPS) continue;
    let x = clamp(p.x, 0, W - 1);
    let y = clamp(p.y, 0, H - 1);
    if (K.line) {
      x = Math.floor(x / TILE) * TILE + TILE / 2;
      y = Math.floor(y / TILE) * TILE + TILE / 2;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
    } else {
      x = Math.round(x);
      y = Math.round(y);
    }
    const rot = Math.round(num(p.rot, 0)) & 7;
    out.push({
      kind: p.kind,
      x,
      y,
      ...(rot ? { rot } : {}),
      ...(K.gate && (p.gate === GATE.closed || p.gate === GATE.open) ? { gate: p.gate } : {}),
      ...(K.stack && Number.isInteger(p.stack) && p.stack > 1 ? { stack: Math.min(K.stack, p.stack) } : {}), // Lagen (Container)
      ...(K.flag && Number.isInteger(p.team) && p.team >= 0 && p.team < MAX_SPAWNS ? { team: p.team } : {}), // Fahne in Teamfarbe
    });
  }
  return out;
}

export const cloneMap = (m) => normalizeMap(JSON.parse(JSON.stringify(m)));

/** Umschließendes Rechteck eines (evtl. gedrehten) Gebäudes: {x, y, w, h}. */
export function footprint(b) {
  if (!b.angle) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const c = Math.abs(Math.cos(b.angle));
  const s = Math.abs(Math.sin(b.angle));
  return { x: b.x, y: b.y, w: b.w * c + b.h * s, h: b.w * s + b.h * c };
}

/** Rechtecke, die den Weg versperren: alle Gebäude außer Bahnsteigen (begehbar), gedrehte als Umschließendes. */
export function blockers(buildings) {
  return buildings.filter((b) => b.kind !== 'platform').map(footprint);
}

/** Zusammenfassung für Menü und Editor. */
export function describeMap(m) {
  const t = m.town;
  return { buildings: t.buildings.length, roads: t.roads.length, trees: t.trees.length + m.trees.length, obstacles: m.obstacles.length };
}

/**
 * Prüft, ob die Karte spielbar ist. Liefert eine Liste Probleme (leer = in Ordnung).
 * Startpunkte brauchen freien Platz, und von Start 1 müssen Zonenmitte und Start 2 erreichbar sein.
 */
export function checkMap(map) {
  const problems = [];
  const hit = (x, y, r) => {
    for (const o of map.obstacles) if (Math.hypot(o.x - x, o.y - y) < o.r + r) return true;
    for (const b of blockers(map.town.buildings)) if (Math.abs(b.x - x) < b.w / 2 + r && Math.abs(b.y - y) < b.h / 2 + r) return true;
    for (const t of [...map.town.trees, ...map.trees]) if (Math.hypot(t.x - x, t.y - y) < t.r + r) return true;
    for (const p of map.props ?? []) {
      for (const j of propCells(p, W / TILE, H / TILE)) {
        const cx = (j % (W / TILE) + 0.5) * TILE;
        const cy = (Math.floor(j / (W / TILE)) + 0.5) * TILE;
        if (Math.abs(cx - x) < TILE / 2 + r && Math.abs(cy - y) < TILE / 2 + r) return true;
      }
    }
    return false;
  };
  map.spawns.forEach((s, i) => {
    if (s.x < CHECK.spawnEdgeMin || s.y < CHECK.spawnEdgeMin || s.x > W - CHECK.spawnEdgeMin || s.y > H - CHECK.spawnEdgeMin) problems.push(`Startpunkt ${i + 1} liegt zu nah am Kartenrand`);
    if (hit(s.x, s.y, SPAWN_CLEAR)) problems.push(`Startpunkt ${i + 1}: Gebäude, Bäume oder Hindernisse im Umkreis von ${SPAWN_CLEAR} px`);
  });
  map.spawns.forEach((a, i) => {
    for (let j = i + 1; j < map.spawns.length; j++) {
      const b = map.spawns[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < CHECK.spawnDistMin) problems.push(`Startpunkte ${i + 1} und ${j + 1} liegen zu nah beieinander`);
    }
  });
  problems.push(...checkFlags(map));
  const relief = reliefOf(map);
  if (relief) {
    map.spawns.forEach((s, i) => {
      const c0 = Math.floor((s.x - SPAWN_CLEAR) / TILE);
      const r0 = Math.floor((s.y - SPAWN_CLEAR) / TILE);
      let bad = false;
      for (let r = r0; r <= Math.floor((s.y + SPAWN_CLEAR) / TILE) && !bad; r++) {
        for (let c = c0; c <= Math.floor((s.x + SPAWN_CLEAR) / TILE) && !bad; c++) {
          if (c < 0 || r < 0 || c >= W / TILE || r >= H / TILE) continue;
          if (Math.hypot((c + 0.5) * TILE - s.x, (r + 0.5) * TILE - s.y) <= SPAWN_CLEAR && relief.cellBlocked(c, r)) bad = true;
        }
      }
      if (bad) problems.push(`Startpunkt ${i + 1}: Gelände zu steil oder unter Wasser`);
    });
  }
  (map.bridges ?? []).forEach((br, i) => {
    if (Math.hypot(br.x2 - br.x1, br.y2 - br.y1) > BRIDGE_LEN[1]) problems.push(`Brücke ${i + 1} ist zu lang (höchstens ${BRIDGE_LEN[1]} px)`);
    const dry = (x, y) => !relief || !relief.cellBlocked(Math.min(W / TILE - 1, Math.floor(x / TILE)), Math.min(H / TILE - 1, Math.floor(y / TILE)));
    if (!dry(br.x1, br.y1) || !dry(br.x2, br.y2)) problems.push(`Brücke ${i + 1}: beide Enden müssen auf festem Grund liegen`);
  });
  if (problems.length) return problems;
  const grid = mapGrid(map);
  const [a, b] = map.spawns;
  const reaches = (path, x, y) => path.length > 0 && Math.hypot(path[path.length - 1].x - x, path[path.length - 1].y - y) < TILE * 2;
  if (hit(map.zone.x, map.zone.y, CHECK.zoneCenterClear)) {
    // Zonenmitte verstellt: einen Punkt am Zonenrand prüfen
    const zx = map.zone.x + map.zone.r * 0.5;
    if (!reaches(findPath(grid, a.x, a.y, zx, map.zone.y, 0), zx, map.zone.y)) problems.push('Die Konfliktzone ist von Startpunkt 1 nicht erreichbar');
  } else if (!reaches(findPath(grid, a.x, a.y, map.zone.x, map.zone.y, 0), map.zone.x, map.zone.y)) {
    problems.push('Die Konfliktzone ist von Startpunkt 1 nicht erreichbar');
  }
  map.spawns.forEach((s, i) => {
    if (i > 0 && !reaches(findPath(grid, a.x, a.y, s.x, s.y, 0), s.x, s.y)) problems.push(`Startpunkt ${i + 1} ist von Startpunkt 1 nicht erreichbar`);
  });
  if (!reaches(findPath(grid, b.x, b.y, map.zone.x, map.zone.y, 0), map.zone.x, map.zone.y) && !problems.length) problems.push('Die Konfliktzone ist von Startpunkt 2 nicht erreichbar');
  for (const f of map.flags ?? []) {
    if (!problems.length && !reaches(findPath(grid, a.x, a.y, f.x, f.y, 0), f.x, f.y)) problems.push(`Flagge ${flagLetter(map, f)} ist von Startpunkt 1 nicht erreichbar (Mast verstellt?)`);
  }
  return problems;
}

const flagLetter = (map, f) => BALANCE.conquest.names[map.flags.indexOf(f)] ?? '?';

/**
 * Eigene Flaggen (Eroberung): Gebiet ganz im Quadrat der Konfliktzone (halbe Kante BALANCE.conquest.half um die Zonenmitte),
 * Gebiete überlappen nicht (Abstand mapFlagGap), am Mast frei. Seitenlayout: jeder Startpunkt an einer anderen Kartenseite.
 */
export function checkFlags(map) {
  const problems = [];
  const Q = BALANCE.conquest;
  const z = map.zone;
  const flags = map.flags ?? [];
  flags.forEach((f, i) => {
    const L = flagLetter(map, f);
    if (Math.abs(f.x - z.x) + f.r > Q.half || Math.abs(f.y - z.y) + f.r > Q.half) problems.push(`Flagge ${L}: Gebiet ragt aus der Konfliktzone`);
    for (let j = i + 1; j < flags.length; j++) {
      const g = flags[j];
      if (Math.hypot(f.x - g.x, f.y - g.y) < f.r + g.r + Q.mapFlagGap) problems.push(`Flaggen ${L} und ${flagLetter(map, g)}: Gebiete zu nah beieinander`);
    }
  });
  if (map.layout === 'sides') {
    const sides = map.spawns.map((s) => sideOf(z, s.x, s.y));
    if (new Set(sides).size < sides.length) problems.push('Seitenlayout: jeder Startpunkt braucht eine eigene Kartenseite');
  }
  return problems;
}


/**
 * Raster einer Karte vor jedem Spielgeschehen: Hindernisse, Stadthäuser, Bäume, Gelände (Hänge, Seen, Furten). Damit beginnt jede
 * Partie (Game); der Spielstand speichert nur den Unterschied dazu (savegame.js).
 */
export function terrainGrid(map, relief = reliefOf(map)) {
  const grid = new Grid(W / TILE, H / TILE, TILE);
  grid.rasterizeObstacles(map.obstacles);
  grid.rasterizeRects(blockers(map.town?.buildings ?? []));
  grid.rasterizeTrees([...(map.town?.trees ?? []), ...(map.trees ?? [])]);
  grid.rasterizeRelief(relief, map.fords ?? []);
  rasterizeProps(grid, map.props); // Zäune, Mauern … (game/props.js)
  return grid;
}

/** Raster mit allen Hindernissen der Karte (Gelände eingeschlossen, Furten passierbar, Brücken offen), wie im Spiel. */
function mapGrid(map) {
  const relief = reliefOf(map);
  const grid = terrainGrid(map, relief);
  openBridges(grid, map.bridges ?? [], relief);
  return grid;
}

/**
 * Getrennte Zugänge von jedem Startpunkt in die Konfliktzone (höchstens want), wie der Kartengenerator sie zählt: Wege,
 * die sich außerhalb von Startgelände und Zone nicht berühren. Für „Prüfen“ im Editor.
 */
export function accessRoutes(map, want = CHECK.routesShown) {
  const grid = mapGrid(map);
  const z = map.zone;
  // Ziel: freie Zelle nächst der Zonenmitte (die Mitte selbst kann verbaut sein)
  let to = null;
  const zc = grid.toCell(z.x);
  const zr = grid.toCell(z.y);
  for (let d = 0; d < CHECK.zoneSearch && !to; d++) {
    for (let r = zr - d; r <= zr + d && !to; r++) {
      for (let c = zc - d; c <= zc + d; c++) {
        if (Math.max(Math.abs(c - zc), Math.abs(r - zr)) === d && grid.passable(c, r, 0)) {
          to = { x: grid.center(c), y: grid.center(r) };
          break;
        }
      }
    }
  }
  if (!to) return map.spawns.map(() => 0);
  return map.spawns.map((s) =>
    countRoutes(grid, s, to, {
      want,
      keepOut: [
        { x: s.x, y: s.y, r: MAPGEN.general.routeKeepOut },
        { x: z.x, y: z.y, r: z.r },
      ],
    }),
  );
}

// ---- Speicher (localStorage) ------------------------------------------------------

const KEY = 'frontline-karten';

function readAll() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // voll oder gesperrt
  }
}

/** Gespeicherte Karten: [{ id, name, saved, map }] (neueste zuerst). */
export function listMaps() {
  return readAll()
    .filter((e) => e && e.id && e.map)
    .sort((a, b) => (b.saved || 0) - (a.saved || 0));
}

/** Feste Karten (js/data/maps/): [{ id, name, info, map }] in Menüreihenfolge. */
export function listFixedMaps() {
  return FIXED_MAPS;
}

/** Ist die ID eine feste Karte (nicht im Browser gespeichert)? */
export const isFixedMap = (id) => FIXED_MAPS.some((m) => m.id === id);

export function loadMap(id) {
  const fixed = FIXED_MAPS.find((m) => m.id === id);
  if (fixed) return normalizeMap({ ...JSON.parse(JSON.stringify(fixed.map)), name: fixed.name });
  const e = readAll().find((x) => x.id === id);
  if (!e) return null;
  try {
    return normalizeMap({ ...e.map, name: e.name });
  } catch {
    return null;
  }
}

/** Speichert eine Karte (neue ID, wenn keine angegeben). Liefert die ID oder null bei Speicherfehler. */
export function saveMap(map, id = null) {
  const list = readAll();
  const key = id || `k${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const entry = { id: key, name: map.name || 'Karte', saved: Date.now(), map };
  const i = list.findIndex((x) => x.id === key);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  return writeAll(list) ? key : null;
}

export function deleteMap(id) {
  return writeAll(readAll().filter((x) => x.id !== id));
}
