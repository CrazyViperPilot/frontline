// Karteneditor (editor.html): alle Kartenelemente frei platzieren, ohne Spiegelung. Zeichnet mit denselben Funktionen wie das Spiel,
// 2D selbst, isometrisch über den Spiel-Renderer mit einem leeren Hilfsspiel (nur Karte).
// URL: ?new=1 (leere Karte) · ?map=ID (gespeicherte Karte) · ?seed=N (Zufallskarte als Ausgangspunkt)
import { BALANCE } from '../data/balance.js';
import { makeRng } from '../core/rng.js';
import { generateMap } from '../game/map.js';
import { drawMapObjects, invalidateTerrain } from '../render/terrain.js';
import { Camera } from '../render/camera.js';
import { Renderer } from '../render/renderer.js';
import { setIsoGround, TOWN_H } from '../render/iso.js';
import { ISO_K } from '../render/camera.js';
import { Game } from '../game/game.js';
import { createEmptyMap, normalizeMap, checkMap, accessRoutes, describeMap, loadMap, saveMap, isFixedMap, MAX_SPAWNS, MAX_FLAGS, PYLON_LINES, MAX_CRATES, MAX_FIELDS, FIELD_CROPS, MAX_FORDS, MAX_BRIDGES, BRIDGE_LEN, MAX_PAVING, PLAZA_SIZE, WALK_W, MAX_PROPS } from '../game/mapdata.js';
import { drawMapIso } from '../render/maptown.js';
import { spriteFrame, spriteMissed } from '../render/spritecache.js';
import { RIVER_SIZE, riverHeight } from '../game/landscape.js';
import { bridgeShape } from '../game/river.js';
import { createRoads } from '../game/roads.js';
import { invalidateWays } from '../render/ways.js';
import { drawBridgeTop, fordPosts, drawFordPostTop } from '../render/bridge.js';
import { drawCrate } from '../render/sprites.js';
import { drawPowerLines } from '../render/mappreview.js';
import { PROPS } from '../data/props.js';
import { GATE } from '../game/props.js';
import { propLooksOf, forgetPropLooks, drawPropsTop } from '../render/mapprops.js';
import { Relief, RELIEF, COARSE_N, reliefOf, setRelief } from '../game/relief.js';
import { reliefTiles, updateReliefTiles, drawReliefTiles } from '../render/reliefimg.js';
import { footprint, overlaps, blockerOf, stackTarget, blockerName } from './space.js';
import { installTelemetry } from '../ui/telemetry.js';

installTelemetry('editor'); // Besucherstatistik: Seitenaufruf des Editors, Fehler (docs/prd/statistik.md)

const W = BALANCE.map.width;
const H = BALANCE.map.height;
const ZOOM_MAX = 2;
const SNAP = 8;
const HISTORY_MAX = 60;
const SEL_KEY = 'frontline-kartenwahl';
const CAR_COLORS = ['#b8b8b0', '#8a2f2f', '#2f4f7a', '#d0c060', '#3b3b3b', '#d8d8d8', '#4f7a4f'];

// Werkzeuge: id, Name, Gruppe, Symbol, Hinweis. Platzieren erzeugt ein Objekt, 'line' zieht von A nach B.
const TOOLS = [
  ['hand', 'Hand', 'Ansicht', '✋', 'Ziehen verschiebt die Karte'],
  ['select', 'Wählen', 'Ansicht', '↖', 'Tippen wählt, Ziehen verschiebt das gewählte Objekt'],
  ['erase', 'Löschen', 'Ansicht', '✕', 'Objekt antippen, um es zu löschen'],
  ['house', 'Haus', 'Gebäude', '⌂', 'Tippen setzt ein Haus'],
  ['factory', 'Fabrik', 'Gebäude', '▣', 'Tippen setzt eine Fabrik mit Schornstein'],
  ['hall', 'Halle', 'Gebäude', '▭', 'Tippen setzt eine Halle'],
  ['tower', 'Wachturm', 'Gebäude', '⍋', 'Tippen setzt einen Wachturm auf Stahlgerüst (blockiert)'],
  ['plant', 'Fabrikhalle', 'Gebäude', '▙', 'Tippen setzt eine große Fabrikhalle mit Schornsteinen und Silos (blockiert)'],
  ['pylon', 'Strommast', 'Gebäude', 'ᛉ', 'Tippen setzt einen Strommast; Masten derselben Leitung werden der Reihe nach mit Seilen verbunden. Neue Leitung: Mast wählen, „Neue Leitung“'],
  ['loco', 'Lok', 'Zug', '◧', 'Tippen auf ein Gleis setzt eine Lok in Gleisrichtung (blockiert wie ein Gebäude)'],
  ['container', 'Waggon', 'Zug', '◨', 'Tippen auf ein Gleis setzt einen Waggon, neben einem Zugteil schließt er an'],
  ['tank', 'Kesselwagen', 'Zug', '◩', 'Tippen setzt einen Kesselwagen'],
  ['platform', 'Bahnsteig', 'Zug', '▱', 'Tippen neben ein Gleis setzt einen Bahnsteig parallel zum Gleis (begehbar, mit Dach)'],
  ['station', 'Bahnhof', 'Zug', '▦', 'Tippen neben ein gerades Gleis setzt das Bahnhofsgebäude passend zum Gleis'],
  ['rail', 'Gleis', 'Zug', '═', 'Von Start- zu Endpunkt ziehen; Gleise rasten aneinander ein, Kreuzungen und Weichen entstehen von selbst'],
  ['road', 'Straße', 'Wege', '▬', 'Von Start- zu Endpunkt ziehen'],
  ['dirt', 'Feldweg', 'Wege', '┅', 'Von Start- zu Endpunkt ziehen'],
  ['walk', 'Bürgersteig', 'Wege', '┄', 'Von Start- zu Endpunkt ziehen; rastet neben Straßen und an anderen Bürgersteigen ein (nur Boden, blockiert nichts)'],
  ['plaza', 'Platz', 'Wege', '▪', `Tippen setzt eine graue Pflasterfläche (${PLAZA_SIZE} × ${PLAZA_SIZE} px, ein Feld), Ziehen malt mehrere; sie rastet im ${PLAZA_SIZE / 2}-px-Raster ein, etwa vor Gebäuden (nur Boden, blockiert nichts)`],
  ['park', 'Park', 'Natur', '◌', 'Tippen setzt eine Grünfläche (nur Dekoration)'],
  ['field', 'Feld', 'Natur', '▤', 'Tippen setzt einen Acker; rechts Frucht oder Weide wählen, Größe und Drehung ändern (nur Boden, blockiert nichts)'],
  ['tree', 'Baum', 'Natur', '♣', 'Tippen setzt einen Baum, Ziehen malt eine Baumreihe (Bäume blockieren)'],
  ['forest', 'Wald', 'Natur', '♠', 'Tippen setzt einen Wald (blockiert)'],
  ['rock', 'Fels', 'Natur', '●', 'Tippen setzt einen Felsen (blockiert)'],
  ['car', 'Auto', 'Natur', '▰', 'Tippen setzt ein geparktes Auto (Dekoration)'],
  ['prop', 'Deko', 'Deko', '⧉', 'Rechts die Art wählen. Zäune, Mauern, Sandsäcke …: Tippen setzt eine Kachel, Ziehen eine Linie mit Ecke; Kacheln verbinden sich von selbst. Einzelstücke (Zelt, Tank …): Tippen setzt, Ziehen verschiebt, rechts „Drehen“. Tor, Fahne: mit „Wählen“ antippen'],
  ['raise', 'Heben', 'Gelände', '▲', 'Gedrückt halten oder ziehen hebt das Gelände (Pinsel rechts einstellen)'],
  ['lower', 'Senken', 'Gelände', '▼', 'Gedrückt halten oder ziehen senkt das Gelände, unter dem Wasserspiegel entsteht ein See'],
  ['smooth', 'Glätten', 'Gelände', '∿', 'Ziehen glättet Kanten und steile Hänge'],
  ['flatten', 'Ebnen', 'Gelände', '—', 'Ziehen ebnet auf die Höhe am Startpunkt ein, etwa für einen Weg über einen Hügel'],
  ['river', 'Fluss', 'Fluss', '≈', 'Ziehen gräbt ein Flussbett mit Ufern (Wasser ist unpassierbar); mehrere Striche ergeben einen gewundenen Fluss'],
  ['ford', 'Furt', 'Fluss', '⋯', `Tippen auf den Fluss legt eine Furt an: seichtes Wasser, durch das Bodeneinheiten mit halbem Tempo kommen (höchstens ${MAX_FORDS})`],
  ['bridge', 'Brücke', 'Fluss', '⊟', `Von Ufer zu Ufer über das Wasser ziehen (${BRIDGE_LEN[0]}–${BRIDGE_LEN[1]} px, beide Enden auf festem Grund): zerstörbar, Baufahrzeuge bauen sie wieder auf`],
  ['spawn0', 'Start Blau', 'Spiel', '①', 'Tippen setzt den Startpunkt von Blau (Hauptstadt)'],
  ['spawn1', 'Start Rot', 'Spiel', '②', 'Tippen setzt den Startpunkt von Rot (Hauptstadt)'],
  ['spawn2', 'Start Grün', 'Spiel', '③', 'Tippen setzt den Startpunkt von Grün (dritter Spieler, nur Eroberung); löschen geht über die Auswahl'],
  ['spawn3', 'Start Gelb', 'Spiel', '④', 'Tippen setzt den Startpunkt von Gelb (vierter Spieler, nur Eroberung; erst nach Grün)'],
  ['flag', 'Flagge', 'Spiel', '⚑', `Tippen setzt eine Flagge der Eroberung (höchstens ${MAX_FLAGS}, Buchstaben in Setzreihenfolge). Mit eigenen Flaggen entfällt das 4 × 4-Raster; Gebiet ganz in die Zone (gestricheltes Quadrat)`],
  ['zone', 'Zone', 'Spiel', '◎', 'Tippen setzt die Mitte der Konfliktzone'],
  ['crate', 'Kiste', 'Spiel', '⊠', `Tippen setzt eine Versorgungskiste (Soldaten bringen sie zur FOB, +1 Geld/s; höchstens ${MAX_CRATES}). Für eine faire Karte gleich weit von beiden Starts setzen`],
];
const BUILD_DEF = {
  house: { w: 90, h: 70, kind: 'house' },
  factory: { w: 260, h: 170, kind: 'factory' },
  hall: { w: 290, h: 100, kind: 'hall' },
  tower: { w: 80, h: 80, kind: 'tower' },
  loco: { w: 96, h: 46, kind: 'train', part: 'loco' },
  container: { w: 96, h: 46, kind: 'train', part: 'container' },
  tank: { w: 96, h: 46, kind: 'train', part: 'tank' },
  platform: { w: 300, h: 30, kind: 'platform' },
  station: { w: 280, h: 110, kind: 'station' },
  plant: { w: 560, h: 240, kind: 'plant' },
  pylon: { w: 44, h: 44, kind: 'pylon' },
};

// Werkzeuge, die von A nach B gezogen werden: Breite und Farbe der Vorschau
const LINE_TOOLS = new Set(['road', 'dirt', 'rail', 'river', 'bridge', 'walk']);
const lineWidth = (t) => ({ dirt: 52, rail: 40, river: RIVER_SIZE.halfW * 2, bridge: BALANCE.river.deck, walk: WALK_W })[t] ?? 64;
const LINE_COLOR = (t) => ({ river: 'rgba(70,130,170,0.6)', bridge: 'rgba(150,145,135,0.85)', rail: '#6b665c', dirt: '#7b6a48', walk: '#a9a9a3' })[t] ?? '#4d504c';

// Geländepinsel: Radius (px) und Stärke; Heben/Senken in Höhe je Sekunde in der Pinselmitte
const TERRAIN_TOOLS = new Set(['raise', 'lower', 'smooth', 'flatten']);
const BRUSH_SIZES = [128, 192, 256, 384, 512, 768];
const BRUSH_POWER = [
  ['sanft', 0.45],
  ['mittel', 1],
  ['stark', 2],
];
const RAISE_RATE = 150;
const H_MAX = RELIEF.min + 255 * RELIEF.q;

const $ = (s) => document.querySelector(s);
const canvas = $('#edview');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);

const st = {
  map: null,
  id: null, // ID der gespeicherten Karte
  tool: 'select',
  sel: null, // {k: Art, o: Objekt}
  cam: new Camera(W, H),
  renderer: null,
  groundDirty: false, // Boden der isometrischen Ansicht neu backen (nach Änderungen an Straßen, Parks, Bahn)
  hist: [],
  redo: [],
  dirty: false,
  needDraw: true,
  pointer: null, // Weltposition des Zeigers
  hover: false, // Maus über der Karte ohne Druck: Vorschau des Werkzeugs zeichnen (drawGhost)
  gesture: null, // laufende Einzelgeste
  touches: new Map(),
  pinch: null,
  carVertical: false,
  propKind: 'fence_wood', // Art für das Werkzeug „Deko“ (js/data/props.js)
  propSig: '', // Prüfsumme der Props: ändert sie sich, werden Zellindex und Aussehen neu berechnet (propSync)
  propVer: 0,
  lastProp: null, // zuletzt gesetztes Einzelstück (Werkzeug „Deko“), „Drehen“ dreht es mit
  propRot: 0, // Drehung des nächsten Einzelstücks in Achteln (45°)
  fieldCrop: 'wheat', // Frucht für das nächste neue Feld (wheat, green, soil, rape oder pasture)
  brush: { size: 2, power: 1 }, // Indizes in BRUSH_SIZES und BRUSH_POWER
  reliefImg: null, // { relief, canvas }: Geländebild der 2D-Ansicht
};

// ---- Kleinkram -------------------------------------------------------------------

const snap = (v) => Math.round(v / SNAP) * SNAP;
const TILE_PX = BALANCE.map.tile; // Rasterzelle: Kacheln der Zäune und Mauern
const K_LINE = (o) => !!PROPS.kinds[o.kind]?.line;

/** Zellen einer Zaunlinie von Zelle a nach b: erst entlang der längeren Achse, dann quer (höchstens eine Ecke). */
function propPath(a, b) {
  const out = [];
  const dc = Math.sign(b.c - a.c);
  const dr = Math.sign(b.r - a.r);
  const xFirst = Math.abs(b.c - a.c) >= Math.abs(b.r - a.r);
  let c = a.c;
  let r = a.r;
  out.push({ c, r });
  if (xFirst) while (c !== b.c) out.push({ c: (c += dc), r });
  while (r !== b.r) out.push({ c, r: (r += dr) });
  if (!xFirst) while (c !== b.c) out.push({ c: (c += dc), r });
  return out;
}

const cellAt = (x, y) => ({ c: clamp(Math.floor(x / TILE_PX), 0, W / TILE_PX - 1), r: clamp(Math.floor(y / TILE_PX), 0, H / TILE_PX - 1) });

/** Kacheln der gewählten Art entlang der Linie a → b setzen (vorhandene Kacheln bekommen die neue Art). Liefert die letzte. */
function placePropLine(a, b) {
  const list = listOf('prop');
  const cells = propPath(a, b);
  let last = null;
  let skipped = 0;
  for (const { c, r } of cells) {
    const x = c * TILE_PX + TILE_PX / 2;
    const y = r * TILE_PX + TILE_PX / 2;
    let o = list.find((p) => p.x === x && p.y === y);
    if (o) o.kind = st.propKind;
    else if (blockerOf(st.map, 'prop', { kind: st.propKind, x, y })) {
      skipped++;
      continue;
    } else if (list.length >= MAX_PROPS) {
      say(`Höchstens ${MAX_PROPS} Kacheln je Karte`, true);
      break;
    } else list.push((o = { kind: st.propKind, x, y }));
    if (cells.length === 1 && b.along === 'y') o.rot = 2; // einzelne Kachel quer
    last = o;
  }
  if (skipped) say(`${skipped} ${skipped === 1 ? 'Kachel' : 'Kacheln'} ohne Platz ausgelassen`, true);
  return last;
}

/** Hat sich die Prop-Liste geändert, Zellindex und Aussehen verwerfen (Spiel-Renderer und 2D zeichnen sonst den alten Stand). */
function propSync() {
  const list = st.map.props ?? [];
  let h = list.length;
  for (const p of list) h = (Math.imul(h, 31) + p.x * 7 + p.y * 13 + (p.gate ?? 0) + (p.rot ?? 0) * 3 + (p.team ?? -1) * 17 + (p.stack ?? 1) * 19 + p.kind.length) | 0;
  const sig = `${list.length}|${h}|${list.map((p) => p.kind[0]).join('')}`;
  if (sig === st.propSig) return;
  st.propSig = sig;
  st.propVer++;
  forgetPropLooks(list);
}

/** Spielwerte einer Prop-Art in einem Satz (Inspektor). */
function propRulesText(K) {
  const who = { all: 'alle', veh: 'Fahrzeuge', inf: 'Infanterie', none: 'niemanden' }[K.blocks];
  const parts = [`Hält ${who} auf${K.crush ? ', Kettenfahrzeuge überfahren sie (danach weg)' : ''}.`];
  if (K.cover) parts.push(`Deckung ${Math.round(K.cover * 100)} %${K.coverVeh ? ` (Fahrzeuge ${Math.round(K.coverVeh * 100)} %)` : ''}.`);
  if (K.sight) parts.push('Verdeckt die Sicht.');
  parts.push(`${K.hp} Trefferpunkte, ${K.rubble ? 'danach Trümmer' : 'zerstört weg'}.`);
  return parts.join(' ');
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function resize() {
  const cam = st.cam;
  if (st.renderer) st.renderer.resize();
  else cam.resize(window.innerWidth, window.innerHeight);
  cam.zoomMin = minZoom();
  cam.zoomMax = ZOOM_MAX;
  cam.zoom = clamp(cam.zoom, cam.zoomMin, cam.zoomMax);
  cam.clamp();
  st.needDraw = true;
}

function minZoom() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (st.cam.iso) return Math.min(vw / (2 * W * ISO_K * 1.05), vh / (W * ISO_K * 1.05));
  return Math.min(vw / (W * 1.05), vh / (H * 1.05));
}

const toWorld = (sx, sy) => st.cam.screenToWorld(sx, sy);

function zoomAt(f, sx, sy) {
  st.cam.zoomAt(f, sx, sy);
  st.needDraw = true;
}

function panBy(dx, dy) {
  st.cam.pan(dx, dy);
  st.needDraw = true;
}

function fit() {
  const cam = st.cam;
  cam.zoomMin = minZoom();
  cam.zoom = cam.zoomMin;
  cam.centerOn(W / 2, H / 2);
  st.needDraw = true;
}

function toggleView() {
  const cam = st.cam;
  const c = toWorld(window.innerWidth / 2, window.innerHeight / 2);
  cam.iso = !cam.iso;
  cam.zoomMin = minZoom();
  cam.zoom = clamp(cam.zoom, cam.zoomMin, cam.zoomMax);
  cam.centerOn(c.x, c.y);
  st.groundDirty = true;
  syncButtons();
  st.needDraw = true;
}

function rotateView(dir) {
  if (!st.cam.iso) return;
  st.cam.rotate(dir);
  st.needDraw = true;
}

function say(text, bad = false) {
  const el = $('[data-msg]');
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

// ---- Verlauf ---------------------------------------------------------------------

const snapshot = () => JSON.stringify(st.map);

function pushHistory() {
  st.hist.push(snapshot());
  if (st.hist.length > HISTORY_MAX) st.hist.shift();
  st.redo = [];
  st.dirty = true;
  st.groundDirty = true;
  syncButtons();
}

function restore(json) {
  st.map = normalizeMap(JSON.parse(json));
  st.sel = null;
  st.dirty = true;
  st.groundDirty = true;
  st.needDraw = true;
  showInspector();
  syncButtons();
}

function undo() {
  if (!st.hist.length) return;
  st.redo.push(snapshot());
  restore(st.hist.pop());
}

function redo() {
  if (!st.redo.length) return;
  st.hist.push(snapshot());
  restore(st.redo.pop());
}

function syncButtons() {
  $('[data-act=undo]').disabled = !st.hist.length;
  $('[data-act=redo]').disabled = !st.redo.length;
  $('[data-act=view]').textContent = st.cam.iso ? 'Iso' : '2D';
  document.querySelectorAll('[data-rot]').forEach((b) => (b.hidden = !st.cam.iso));
}

// ---- Objekte ---------------------------------------------------------------------

function listOf(k) {
  const m = st.map;
  switch (k) {
    case 'building': return m.town.buildings;
    case 'road': return m.town.roads;
    case 'rail': return m.town.rails;
    case 'park': return m.town.parks;
    case 'field': return m.town.fields;
    case 'car': return m.town.cars;
    case 'tree': return m.trees;
    case 'townTree': return m.town.trees;
    case 'obstacle': return m.obstacles;
    case 'crate': return m.crates;
    case 'prop': return (m.props ??= []);
    case 'ford': return (m.fords ??= []);
    case 'bridge': return (m.bridges ??= []);
    case 'flag': return (m.flags ??= []);
    case 'plaza': return (m.town.plazas ??= []);
    case 'walk': return (m.town.walks ??= []);
    default: return null;
  }
}

/** Liegt der Weltpunkt im (evtl. gedrehten) Rechteck o (Mitte x/y, Größe w × h), mit Rand pad? */
function inRot(o, px, py, pad = 0) {
  const c = Math.cos(o.angle || 0);
  const sn = Math.sin(o.angle || 0);
  const lx = (px - o.x) * c + (py - o.y) * sn;
  const ly = -(px - o.x) * sn + (py - o.y) * c;
  return Math.abs(lx) <= o.w / 2 + pad && Math.abs(ly) <= o.h / 2 + pad;
}

const SEG_KINDS = new Set(['road', 'rail', 'bridge', 'walk']); // Objekte als Strecke x1/y1 → x2/y2

function distToSeg(px, py, r) {
  const dx = r.x2 - r.x1;
  const dy = r.y2 - r.y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - r.x1) * dx + (py - r.y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (r.x1 + t * dx), py - (r.y1 + t * dy));
}

/** Oberstes Objekt unter dem Weltpunkt oder null: Startpunkte und Zone zuerst, dann Gebäude, Bäume, Hindernisse, Parks, Straßen, Bahn. */
function pickAt(wx, wy, sx = null, sy = null) {
  const tol = 14 / st.cam.zoom;
  const m = st.map;
  for (let i = 0; i < m.spawns.length; i++) {
    if (Math.hypot(m.spawns[i].x - wx, m.spawns[i].y - wy) < 70 + tol) return { k: 'spawn', i, o: m.spawns[i] };
  }
  for (const f of m.flags ?? []) if (Math.hypot(f.x - wx, f.y - wy) < 60 + tol) return { k: 'flag', o: f }; // am Mast (das Gebiet ist zu groß zum Wählen)
  for (let i = m.crates.length - 1; i >= 0; i--) {
    if (Math.hypot(m.crates[i].x - wx, m.crates[i].y - wy) < 18 + tol) return { k: 'crate', o: m.crates[i] };
  }
  for (const b of m.bridges ?? []) if (distToSeg(wx, wy, b) <= BALANCE.river.deck / 2 + tol) return { k: 'bridge', o: b };
  // Props: Kachel in der Zelle unter dem Zeiger (Zäune und Mauern sind schmal, die ganze Zelle zählt)
  const pc = Math.floor(wx / TILE_PX);
  const pr = Math.floor(wy / TILE_PX);
  for (let i = (m.props ?? []).length - 1; i >= 0; i--) {
    const o = m.props[i];
    const K = PROPS.kinds[o.kind];
    if (K?.size) {
      // Einzelstück: Punkt in der gedrehten Grundfläche
      const a = ((o.rot ?? 0) * Math.PI) / 4;
      const dx = wx - o.x;
      const dy = wy - o.y;
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(u) <= K.size[0] / 2 + tol && Math.abs(v) <= Math.max(K.size[1], 16) / 2 + tol) return { k: 'prop', o };
    } else if (Math.floor(o.x / TILE_PX) === pc && Math.floor(o.y / TILE_PX) === pr) return { k: 'prop', o };
  }
  const circ = (k, list, grow = 0) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (Math.hypot(o.x - wx, o.y - wy) <= o.r + tol + grow) return { k, o };
    }
    return null;
  };
  for (let i = m.town.cars.length - 1; i >= 0; i--) {
    const c = m.town.cars[i];
    const hw = (c.vertical ? 9 : 18) + tol;
    const hh = (c.vertical ? 18 : 9) + tol;
    if (Math.abs(c.x - wx) <= hw && Math.abs(c.y - wy) <= hh) return { k: 'car', o: c };
  }
  for (let i = m.town.buildings.length - 1; i >= 0; i--) {
    const b = m.town.buildings[i];
    const inside = (px, py, pad) => {
      const c = Math.cos(b.angle || 0);
      const sn = Math.sin(b.angle || 0);
      const lx = (px - b.x) * c + (py - b.y) * sn;
      const ly = -(px - b.x) * sn + (py - b.y) * c;
      return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
    };
    if (inside(wx, wy, tol * 0.4)) return { k: 'building', o: b };
    if (st.cam.iso && sx !== null) {
      // Isometrisch: ein Klick aufs Dach liegt auf dem Boden hinter dem Fußabdruck
      const roof = st.cam.screenToWorld(sx, sy + (b.kind === 'train' ? 30 : TOWN_H[b.kind] ?? 40) * st.cam.zoom);
      if (inside(roof.x, roof.y, 0)) return { k: 'building', o: b };
    }
  }
  const hit = circ('tree', m.trees) || circ('townTree', m.town.trees) || circ('obstacle', m.obstacles);
  if (hit) return hit;
  const pk = circ('park', m.town.parks);
  for (let i = m.town.rails.length - 1; i >= 0; i--) {
    if (distToSeg(wx, wy, m.town.rails[i]) <= 20 + tol) return { k: 'rail', o: m.town.rails[i] };
  }
  const road = (() => {
    for (let i = m.town.roads.length - 1; i >= 0; i--) {
      const r = m.town.roads[i];
      if (distToSeg(wx, wy, r) <= r.w / 2 + tol) return { k: 'road', o: r };
    }
    return null;
  })();
  if (road) return road;
  const walks = m.town.walks ?? [];
  for (let i = walks.length - 1; i >= 0; i--) if (distToSeg(wx, wy, walks[i]) <= walks[i].w / 2 + tol) return { k: 'walk', o: walks[i] };
  const plazas = m.town.plazas ?? [];
  for (let i = plazas.length - 1; i >= 0; i--) if (inRot(plazas[i], wx, wy, tol * 0.4)) return { k: 'plaza', o: plazas[i] };
  if (pk) return pk;
  for (let i = m.town.fields.length - 1; i >= 0; i--) {
    const f = m.town.fields[i];
    const c = Math.cos(f.angle || 0);
    const sn = Math.sin(f.angle || 0);
    const lx = (wx - f.x) * c + (wy - f.y) * sn;
    const ly = -(wx - f.x) * sn + (wy - f.y) * c;
    if (Math.abs(lx) <= f.w / 2 + tol * 0.4 && Math.abs(ly) <= f.h / 2 + tol * 0.4) return { k: 'field', o: f };
  }
  if (Math.hypot(m.zone.x - wx, m.zone.y - wy) <= 90 + tol) return { k: 'zone', o: m.zone };
  for (const f of m.fords ?? []) if (Math.hypot(f.x - wx, f.y - wy) <= f.r + tol) return { k: 'ford', o: f };
  return null;
}

/** Startpunkte 3 und 4 lassen sich löschen, aber nur der letzte (Team i startet an Startpunkt i). */
const spawnRemovable = (sel) => sel.k === 'spawn' && sel.i >= 2 && sel.i === st.map.spawns.length - 1;

function removeSel(sel) {
  if (!sel) return false;
  if (spawnRemovable(sel)) {
    st.map.spawns.splice(sel.i, 1);
    return true;
  }
  if (sel.k === 'spawn' || sel.k === 'zone') return false;
  else {
    const list = listOf(sel.k);
    const i = list.indexOf(sel.o);
    if (i < 0) return false;
    list.splice(i, 1);
  }
  return true;
}

/** Neues Objekt je Werkzeug an Weltposition. Liefert die Auswahl-Beschreibung. */
function place(tool, x, y) {
  const m = st.map;
  const px = clamp(snap(x), 0, W);
  const py = clamp(snap(y), 0, H);
  if (BUILD_DEF[tool]) {
    const { o } = ghostOf(tool, x, y);
    if (!roomFor('building', o)) return null;
    m.town.buildings.push(o);
    return { k: 'building', o };
  }
  switch (tool) {
    case 'plaza': {
      const { o } = ghostOf(tool, x, y);
      return addPlaza(o.x, o.y);
    }
    case 'park':
    case 'forest':
    case 'rock': {
      const sel = ghostOf(tool, x, y);
      if (!roomFor(sel.k, sel.o)) return null;
      listOf(sel.k).push(sel.o);
      return sel;
    }
    case 'field': {
      if (m.town.fields.length >= MAX_FIELDS) {
        say(`Höchstens ${MAX_FIELDS} Felder je Karte`, true);
        return null;
      }
      const sel = ghostOf(tool, x, y);
      m.town.fields.push(sel.o);
      return sel;
    }
    case 'tree': {
      const o = { x: Math.round(x), y: Math.round(y), r: 12 + Math.floor(Math.random() * 9) };
      if (!roomFor('tree', o)) return null;
      m.trees.push(o);
      return { k: 'tree', o };
    }
    case 'car': {
      const o = { x: px, y: py, vertical: st.carVertical, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] };
      if (!roomFor('car', o)) return null;
      m.town.cars.push(o);
      return { k: 'car', o };
    }
    case 'spawn0':
    case 'spawn1':
    case 'spawn2':
    case 'spawn3': {
      const i = Number(tool.slice(5));
      if (i > m.spawns.length) {
        say(`Erst den Startpunkt von ${BALANCE.teamNames[i - 1]} setzen`, true);
        return null;
      }
      if (i === m.spawns.length) m.spawns.push({ x: px, y: py });
      m.spawns[i].x = px;
      m.spawns[i].y = py;
      return { k: 'spawn', i, o: m.spawns[i] };
    }
    case 'flag': {
      if ((m.flags ?? []).length >= MAX_FLAGS) {
        say(`Höchstens ${MAX_FLAGS} Flaggen je Karte`, true);
        return null;
      }
      const o = { x: px, y: py, r: BALANCE.conquest.mapFlagR };
      (m.flags ??= []).push(o);
      return { k: 'flag', o };
    }
    case 'zone':
      m.zone.x = px;
      m.zone.y = py;
      return { k: 'zone', o: m.zone };
    case 'ford': {
      if ((m.fords ?? []).length >= MAX_FORDS) {
        say(`Höchstens ${MAX_FORDS} Furten je Karte`, true);
        return null;
      }
      const relief = reliefOf(m);
      if (!relief || relief.heightAt(x, y) >= RELIEF.water) {
        say('Eine Furt gehört ins Wasser: erst mit „Fluss“ ein Flussbett graben, dann darauf tippen.', true);
        return null;
      }
      const o = { x: Math.round(x), y: Math.round(y), r: RIVER_SIZE.fordR };
      (m.fords ??= []).push(o);
      shapeFord(o);
      return { k: 'ford', o };
    }
    case 'crate': {
      if (m.crates.length >= MAX_CRATES) {
        say(`Höchstens ${MAX_CRATES} Versorgungskisten je Karte`, true);
        return null;
      }
      const o = { x: px, y: py };
      if (!roomFor('crate', o)) return null;
      m.crates.push(o);
      return { k: 'crate', o };
    }
    default:
      return null;
  }
}

/** Neuer Platz mit Mitte (x, y); liegt dort schon einer (Ziehen überstreicht Felder mehrfach), passiert nichts. */
function addPlaza(x, y) {
  const list = listOf('plaza');
  if (x < 0 || y < 0 || x > W || y > H || list.some((p) => p.x === x && p.y === y)) return null;
  if (list.length >= MAX_PAVING) {
    say(`Höchstens ${MAX_PAVING} Plätze je Karte`, true);
    return null;
  }
  const o = { x, y, w: PLAZA_SIZE, h: PLAZA_SIZE };
  list.push(o);
  return { k: 'plaza', o };
}

/** Platz am Weltpunkt: Kanten im Raster der halben Platzgröße, damit Plätze nahtlos aneinander und an Gebäude passen. */
function plazaAt(x, y, w = PLAZA_SIZE, h = PLAZA_SIZE) {
  const g = PLAZA_SIZE / 2;
  return { x: clamp(Math.round((x - w / 2) / g) * g + w / 2, 0, W), y: clamp(Math.round((y - h / 2) / g) * g + h / 2, 0, H), w, h };
}

/**
 * Objekt, das das Werkzeug am Weltpunkt setzen würde, ohne es in die Karte zu legen (Vorschau unter dem Mauszeiger und place):
 * {k, o} oder null für Werkzeuge ohne Vorschau.
 */
function ghostOf(tool, x, y) {
  const px = clamp(snap(x), 0, W);
  const py = clamp(snap(y), 0, H);
  if (BUILD_DEF[tool]) {
    const o = { x: px, y: py, ...BUILD_DEF[tool] };
    if (tool === 'pylon') o.line = st.pylonLine ?? 0;
    placeAlongRail(o, x, y);
    return { k: 'building', o };
  }
  switch (tool) {
    case 'plaza': return { k: 'plaza', o: plazaAt(x, y) };
    case 'park': return { k: 'park', o: { x: px, y: py, r: 150 } };
    case 'forest': return { k: 'obstacle', o: { x: px, y: py, r: 120 } };
    case 'rock': return { k: 'obstacle', o: { x: px, y: py, r: 91 } };
    case 'car': return { k: 'car', o: { x: px, y: py, vertical: st.carVertical, color: CAR_COLORS[0] } };
    case 'field': {
      const o = { x: px, y: py, w: 300, h: 220, kind: 'field', crop: st.fieldCrop };
      if (o.crop === 'pasture') {
        o.kind = 'pasture';
        delete o.crop;
      }
      return { k: 'field', o };
    }
    case 'tree': return { k: 'tree', o: { x: Math.round(x), y: Math.round(y), r: 16 } };
    case 'crate': return { k: 'crate', o: { x: px, y: py } };
    case 'prop': {
      if (PROPS.kinds[st.propKind].line) return null;
      return { k: 'prop', o: { kind: st.propKind, x: clamp(px, 0, W - 1), y: clamp(py, 0, H - 1), ...(st.propRot ? { rot: st.propRot } : {}) } };
    }
    default: return null;
  }
}

/** Nächstes Gleis zum Weltpunkt: {q: Fußpunkt, a: Richtung (-π/2..π/2], side: +1/-1 Seite des Punktes, dist} oder null. */
function nearestRail(x, y, maxDist) {
  let best = null;
  for (const r of st.map.town.rails) {
    const dx = r.x2 - r.x1;
    const dy = r.y2 - r.y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1) continue;
    const t = clamp(((x - r.x1) * dx + (y - r.y1) * dy) / l2, 0, 1);
    const q = { x: r.x1 + t * dx, y: r.y1 + t * dy };
    const d = Math.hypot(q.x - x, q.y - y);
    if (d > maxDist || (best && d >= best.dist)) continue;
    let a = Math.atan2(dy, dx);
    if (a > Math.PI / 2) a -= Math.PI;
    else if (a <= -Math.PI / 2) a += Math.PI;
    const side = (x - q.x) * -Math.sin(a) + (y - q.y) * Math.cos(a) >= 0 ? 1 : -1;
    best = { q, a, side, dist: d };
  }
  return best;
}

/** Zugteile, Bahnsteige und Bahnhof richten sich nach dem nächsten Gleis aus. */
function placeAlongRail(o, x, y) {
  const lim = o.kind === 'train' ? 70 : o.kind === 'platform' ? 150 : 280;
  const r = nearestRail(x, y, lim);
  if (!r) return;
  const nx = -Math.sin(r.a);
  const ny = Math.cos(r.a);
  if (o.kind === 'train') {
    o.x = r.q.x;
    o.y = r.q.y;
    if (Math.abs(r.a) > 1e-3) o.angle = r.a;
    // an ein nahes Zugteil anschließen
    const ux = Math.cos(r.a);
    const uy = Math.sin(r.a);
    for (const b of st.map.town.buildings) {
      if (b.kind !== 'train' || b === o) continue;
      const along = (x - b.x) * ux + (y - b.y) * uy;
      const across = (x - b.x) * nx + (y - b.y) * ny;
      if (Math.abs(across) < 60 && Math.abs(along) < 160) {
        const dir = along >= 0 ? 1 : -1;
        const gap = (b.w + o.w) / 2 + 4;
        o.x = b.x + ux * gap * dir;
        o.y = b.y + uy * gap * dir;
        // steht dort schon ein Zugteil: ans Ende des Zuges weiterrücken
        for (let n = 0; n < 40; n++) {
          const fp = footprint('building', o);
          const next = st.map.town.buildings.find((t) => t.kind === 'train' && t !== o && overlaps(fp, footprint('building', t)));
          if (!next) break;
          o.x = next.x + ux * ((next.w + o.w) / 2 + 4) * dir;
          o.y = next.y + uy * ((next.w + o.w) / 2 + 4) * dir;
        }
        break;
      }
    }
  } else if (o.kind === 'platform') {
    const off = 20 + o.h / 2 + 4;
    o.x = r.q.x + nx * off * r.side;
    o.y = r.q.y + ny * off * r.side;
    if (Math.abs(r.a) > 1e-3) o.angle = r.a;
  } else if (o.kind === 'station') {
    const horizontal = Math.abs(r.a) < 0.25;
    const vertical = Math.abs(Math.abs(r.a) - Math.PI / 2) < 0.25;
    if (!horizontal && !vertical) return;
    const off = 20 + 30 + 4 + 8 + o.h / 2; // Gleisbett, Bahnsteig, Abstand, halbe Tiefe
    if (vertical) [o.w, o.h] = [o.h, o.w];
    o.x = r.q.x + nx * off * r.side;
    o.y = r.q.y + ny * off * r.side;
  }
}

function moveObj(sel, dx, dy) {
  const o = sel.o;
  if (SEG_KINDS.has(sel.k)) {
    o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy;
  } else {
    o.x = clamp(o.x + dx, 0, W);
    o.y = clamp(o.y + dy, 0, H);
  }
}

/** Nach dem Verschieben: Kacheln der Zäune und Mauern zurück in die Mitte ihrer Zelle. */
function settleProp(sel) {
  if (sel?.k !== 'prop' || !PROPS.kinds[sel.o.kind]?.line) return;
  const { c, r } = cellAt(sel.o.x, sel.o.y);
  sel.o.x = c * TILE_PX + TILE_PX / 2;
  sel.o.y = r * TILE_PX + TILE_PX / 2;
}

// ---- Platz ----------------------------------------------------------------------

/** Steht o (Art k) auf freiem Platz? Sonst Meldung „Kein Platz“ (quiet: ohne) und false. */
function roomFor(k, o, quiet = false) {
  const b = blockerOf(st.map, k, o);
  if (b && !quiet) say(`Kein Platz: ${b.k === 'building' ? KIND_NAMES[b.o.kind] ?? 'Gebäude' : blockerName(b)} im Weg`, true);
  else if (!b && !quiet && $('[data-msg]').textContent.startsWith('Kein Platz')) say(''); // alte Meldung weg, sobald es passt
  return !b;
}

/** Objekt verschieben, aber nur auf freien Platz; false = blieb stehen. */
function tryMove(sel, dx, dy) {
  if (!footprint(sel.k, sel.o)) {
    moveObj(sel, dx, dy);
    return true;
  }
  const { x, y } = sel.o;
  moveObj(sel, dx, dy);
  if (roomFor(sel.k, sel.o, true)) return true;
  sel.o.x = x;
  sel.o.y = y;
  return false;
}

/** Kopie neben das Original legen: erste freie Stelle rechts, unten, schräg, links oder oben; false = nirgends Platz. */
function placeCopy(k, copy) {
  const fp = footprint(k, copy);
  const step = fp ? 2 * fp.R + 8 : 48;
  const { x, y } = copy;
  for (let n = 1; n <= 3; n++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) {
      copy.x = clamp(x + dx * step * n, 0, W);
      copy.y = clamp(y + dy * step * n, 0, H);
      if (!fp || roomFor(k, copy, true)) return true;
    }
  }
  return false;
}

// ---- Zeichnen --------------------------------------------------------------------

/** Hilfsspiel nur mit Karte: der Spiel-Renderer zeichnet damit die isometrische Ansicht (ohne Einheiten und Gebäude des Spiels). */
function makeRenderer() {
  const game = new Game({ seed: 1, map: st.map });
  game.units.length = 0;
  game.buildings.length = 0;
  game.crates = []; // Kisten zeichnet der Editor selbst (sie ändern sich beim Bearbeiten)
  game.animals = []; // Tiere gibt es erst im Spiel
  game.entities.clear();
  const r = new Renderer(canvas, game, st.cam, 0);
  r.revealAll = true;
  return r;
}

function syncGhost() {
  const r = st.renderer;
  const g = r.game;
  const m = st.map;
  if (g.map !== m) {
    g.map = m;
    st.groundDirty = true;
  }
  g.zone.x = m.zone.x;
  g.zone.y = m.zone.y;
  g.zone.r = m.zone.r;
  g.hot.x = g.hot.y = -1e6; // Hot Zone gibt es erst im Spiel
  propSync();
  g.propSt = null; // Editor: alle Props heil
  g.propVersion = st.propVer;
  g.bridges = (m.bridges ?? []).map((src, k) => bridgeShape(src, reliefOf(m), -10000 - k)); // Brücken folgen der Karte
  r.deco = null;
  // Boden (Straßen, Parks, Bahn, Hindernisse) neu backen, aber nicht während des Ziehens
  if (st.groundDirty && !st.gesture) {
    invalidateTerrain(m);
    invalidateWays(); // Feldwege und Gleise neu bauen (Zwischenspeicher hängt an der Karte, die beim Zeichnen gleich bleibt)
    const ver = (g.roads?.ver ?? 0) + 1;
    createRoads(g); // Straßen der Iso-Ansicht: Zellen im Stadtraster aus den Kartenstraßen
    g.roads.ver = ver; // neue Version, damit das Straßenbild neu entsteht
    r.terrainIso = null;
    r.terrainGL = null;
    r.terrain = null;
    st.groundDirty = false;
  }
}

function draw() {
  st.needDraw = false;
  const cam = st.cam;
  const m = st.map;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const z = cam.zoom;
  const iso = cam.iso;
  const d = st.renderer.dpr;
  if (iso) {
    syncGhost();
    st.renderer.render({}); // setzt das Zeitbudget der Bilder selbst zurück
  } else {
    spriteFrame(d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#2a2f27';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2 - cam.x * z, vh / 2 - cam.y * z);
    ctx.fillStyle = '#56603f';
    ctx.fillRect(0, 0, W * z, H * z);
    // Gelände wie im Spiel: Fels, Ufer und Seen unter Straßen und Stadt, die Schummerung über alles
    const tiles = reliefImage();
    const relief2d = (layer) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      drawReliefTiles(ctx, tiles, layer, d * (vw / 2 - cam.x * z), d * (vh / 2 - cam.y * z), d * z, vw * d, vh * d);
      ctx.setTransform(d, 0, 0, d, d * (vw / 2 - cam.x * z), d * (vh / 2 - cam.y * z));
    };
    if (tiles) relief2d('mat');
    drawMapObjects(ctx, m, z, false, makeRng(77));
    propSync();
    const vx0 = cam.x - vw / 2 / z;
    const vy0 = cam.y - vh / 2 / z;
    const inView = (x, y, r) => x + r > vx0 && y + r > vy0 && x - r < vx0 + vw / z && y - r < vy0 + vh / z;
    ctx.save();
    ctx.scale(z, z);
    drawPropsTop(ctx, propLooksOf(m.props, null, st.propVer), inView, z); // Zäune, Mauern (mapprops.js)
    ctx.restore();
    if (tiles) {
      ctx.globalCompositeOperation = 'soft-light';
      relief2d('shade');
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  // Überlagerungen in Weltkoordinaten (2D: Zoom, Iso: Bodenebene), Linienstärken in Bildschirm-Pixeln
  // ax, ay: Bodenpunkt, auf dessen Geländehöhe die Zeichnung liegt (isometrisch mit Gelände)
  const world = (ax = null, ay = null) => {
    if (iso) {
      if (ax !== null) cam.pinAt(ax, ay);
      setIsoGround(ctx, cam, d);
      cam.unpin();
    } else ctx.setTransform(d * z, 0, 0, d * z, d * (vw / 2 - cam.x * z), d * (vh / 2 - cam.y * z));
  };
  const px = 1 / z;
  world();
  // Raster alle 512 px und Kartenrand
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 512) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 512) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2 * px;
  ctx.strokeRect(0, 0, W, H);
  // Konfliktzone und Startpunkte mit Bauradius der Hauptstadt (Kreise liegen auf dem Gelände)
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  groundCircle(m.zone.x, m.zone.y, m.zone.r);
  ctx.stroke();
  ctx.setLineDash([]);
  m.spawns.forEach((sp, i) => {
    ctx.strokeStyle = BALANCE.teamColors[i];
    groundCircle(sp.x, sp.y, BALANCE.fob.buildRadius);
    ctx.stroke();
  });
  world(m.zone.x, m.zone.y);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.arc(m.zone.x, m.zone.y, 5 * px, 0, Math.PI * 2);
  ctx.fill();
  m.spawns.forEach((sp, i) => {
    world(sp.x, sp.y);
    ctx.fillStyle = BALANCE.teamColors[i];
    const r = Math.max(7 * px, 40);
    ctx.fillRect(sp.x - r, sp.y - r, r * 2, r * 2);
  });
  for (const c of m.crates) {
    world(c.x, c.y);
    drawCrate(ctx, c.x, c.y, Math.max(12 * px, 18), z, 1);
  }
  if (!iso) {
    world();
    drawPowerLines(ctx, m.town.buildings, Math.max(1.2, 1.2 * px)); // Leitungen zwischen den Strommasten
  }
  drawConquestMarks(m, px);
  if (!iso) {
    // Brücken und Furten (isometrisch zeichnet sie der Spiel-Renderer)
    world();
    const relief = reliefOf(m);
    (m.bridges ?? []).forEach((src, k) => drawBridgeTop(ctx, bridgeShape(src, relief, -10000 - k)));
    for (const p of fordPosts(m, relief)) drawFordPostTop(ctx, p);
    ctx.strokeStyle = 'rgba(200,235,255,0.55)';
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([8 * px, 6 * px]);
    for (const f of m.fords ?? []) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  if (st.sel) {
    const o = st.sel.o;
    if (o.x1 !== undefined) world((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2);
    else world(o.x, o.y);
    drawSelection(st.sel, px);
  }
  drawGhost(world, px);
  // Vorschau einer Zaunlinie: die Zellen, die entstehen
  const singleTool = st.tool === 'prop' && !PROPS.kinds[st.propKind].line;
  if (singleTool && st.hover && st.pointer && !st.gesture) {
    const [l, dpt] = PROPS.kinds[st.propKind].size;
    const x = snap(st.pointer.x);
    const y = snap(st.pointer.y);
    world(x, y);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((st.propRot * Math.PI) / 4);
    ctx.fillStyle = 'rgba(255,230,150,0.35)';
    ctx.strokeStyle = 'rgba(255,230,150,0.9)';
    ctx.lineWidth = px;
    ctx.fillRect(-l / 2, -dpt / 2, l, dpt);
    ctx.strokeRect(-l / 2, -dpt / 2, l, dpt);
    ctx.restore();
  }
  const pg = st.gesture?.type === 'propline' ? propPath(st.gesture.a, st.gesture.b) : st.tool === 'prop' && !singleTool && st.hover && st.pointer && !st.gesture ? [cellAt(st.pointer.x, st.pointer.y)] : [];
  for (const { c, r } of pg) {
    world(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    ctx.fillStyle = 'rgba(255,230,150,0.35)';
    ctx.strokeStyle = 'rgba(255,230,150,0.9)';
    ctx.lineWidth = px;
    ctx.fillRect(c * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX);
    ctx.strokeRect(c * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX);
  }
  // Vorschau eines Linien-Ziehens
  const g = st.gesture;
  if (g && g.type === 'line') {
    world((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2);
    ctx.strokeStyle = LINE_COLOR(g.kind);
    ctx.lineWidth = g.w;
    ctx.lineCap = g.kind === 'river' ? 'round' : 'butt';
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
  }
  // Beschriftungen und Pinselkreis in Bildschirmkoordinaten
  ctx.setTransform(d, 0, 0, d, 0, 0);
  if (TERRAIN_TOOLS.has(st.tool) && st.pointer) {
    const bp = g && g.type === 'terrain' ? g : st.pointer;
    const r = BRUSH_SIZES[st.brush.size];
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    groundCircle(bp.x, bp.y, r);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = st.tool === 'lower' ? '#9fd0ff' : st.tool === 'raise' ? '#ffe9a8' : '#ffffff';
    ctx.setLineDash([6, 5]);
    groundCircle(bp.x, bp.y, r);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24a';
  const zp = cam.worldToScreen(m.zone.x, m.zone.y);
  ctx.fillText('Konfliktzone', zp.x, zp.y - 12);
  (m.flags ?? []).forEach((f, i) => {
    const p = cam.worldToScreen(f.x, f.y);
    ctx.fillStyle = '#1b1f24';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(BALANCE.conquest.names[i], p.x, p.y + 4.5);
    if (f.name) ctx.fillText(f.name, p.x, p.y - 16);
  });
  m.spawns.forEach((sp, i) => {
    const p = cam.worldToScreen(sp.x, sp.y);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Start ${BALANCE.teamNames[i]}`, p.x, p.y - Math.max(14, 44 * z));
  });
  if (spriteMissed()) st.needDraw = true; // Bilder fehlten (Zeitbudget): gleich noch einmal, bis alle gemalt sind
}

/**
 * Vorschau unter dem Mauszeiger (Paket „Pflaster“): das Objekt, das ein Klick setzen würde, halb durchsichtig an genau der Stelle,
 * an der es landet (Raster, Gleise). 2D wie im Editor gezeichnet, isometrisch mit dem gemalten Gebäude; Ziehwerkzeuge zeigen den
 * eingerasteten Startpunkt. Nur mit Maus (Finger haben keinen Zeiger ohne Druck) und ohne laufende Geste.
 */
function drawGhost(world, px) {
  if (!st.hover || st.gesture || !st.pointer) return;
  const cam = st.cam;
  const z = cam.zoom;
  const d = st.renderer.dpr;
  const t = st.tool;
  const { x, y } = st.pointer;
  if (LINE_TOOLS.has(t)) {
    const a = t === 'river' ? { x: Math.round(x), y: Math.round(y) } : snapRoad(x, y, t);
    world(a.x, a.y);
    ctx.fillStyle = LINE_COLOR(t);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.max(5 * px, lineWidth(t) / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  const gh = ghostOf(t, x, y);
  if (!gh) return;
  const o = gh.o;
  // Hilfskarte nur mit diesem Objekt: dieselben Zeichenfunktionen wie für die Karte
  const tmp = { obstacles: [], trees: [], town: { roads: [], rails: [], buildings: [], parks: [], fields: [], cars: [], trees: [], plazas: [], walks: [] } };
  ({ building: tmp.town.buildings, plaza: tmp.town.plazas, park: tmp.town.parks, field: tmp.town.fields, car: tmp.town.cars, obstacle: tmp.obstacles, tree: tmp.trees })[gh.k]?.push(o);
  ctx.save();
  ctx.globalAlpha = 0.6;
  if (!cam.iso) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.setTransform(d, 0, 0, d, d * (vw / 2 - cam.x * z), d * (vh / 2 - cam.y * z));
    drawMapObjects(ctx, tmp, z, false, makeRng(77));
    if (gh.k === 'crate') {
      world(o.x, o.y);
      drawCrate(ctx, o.x, o.y, Math.max(12 * px, 18), z, 1);
    }
  } else {
    world(o.x, o.y);
    drawMapObjects(ctx, tmp, 1, true, makeRng(77)); // Bodenteil (Plätze, Felder, Parks, Wald- und Felsfläche)
    if (gh.k === 'building') {
      ctx.setTransform(d, 0, 0, d, 0, 0);
      cam.pinAt(o.x, o.y);
      drawMapIso(ctx, cam, o);
      cam.unpin();
      const key = `${o.kind}|${o.x}|${o.y}|${o.w}|${o.h}|${cam.rot}`;
      if (st.ghostKey !== key) {
        st.ghostKey = key;
        st.needDraw = true; // ein Bild später nochmal: neue Gebäudebilder entstehen erst im nächsten Bild (spritecache)
      }
    }
  }
  // Fußabdruck gestrichelt: genau die Fläche, die das Objekt belegt; rot, wenn dort kein Platz ist (Stapeln: Umriss des Stapels)
  world(o.x, o.y);
  ctx.globalAlpha = 0.9;
  const top = gh.k === 'prop' ? stackTarget(st.map, o.kind, x, y) : null;
  const fp = footprint(gh.k, top ?? o);
  const blocked = !top && fp && blockerOf(st.map, gh.k, o);
  ctx.strokeStyle = blocked ? '#ff4a3a' : '#ffffff';
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  if (fp) {
    ctx.fillStyle = blocked ? 'rgba(255,60,40,0.3)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    if (fp.t === 'circle') ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
    else {
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.a);
      ctx.rect(-fp.hw, -fp.hh, fp.hw * 2, fp.hh * 2);
    }
    ctx.fill();
    ctx.stroke();
  } else if (o.w !== undefined && o.h !== undefined) {
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle || 0);
    ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
  } else if (gh.k === 'car') {
    const hw = o.vertical ? 9 : 18;
    const hh = o.vertical ? 18 : 9;
    ctx.strokeRect(o.x - hw, o.y - hh, hw * 2, hh * 2);
  } else {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r ?? Math.max(12 * px, 20), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Eroberung: Quadrat der Konfliktzone (dort müssen eigene Flaggen liegen), Grenzen der Baugebiete (Ecken oder Seiten) und die Gebiete
 * der eigenen Flaggen als Kreise auf dem Boden.
 */
function drawConquestMarks(m, px) {
  const d = st.renderer.dpr;
  const Q = BALANCE.conquest;
  const z = m.zone;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const line = (x1, y1, x2, y2) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 128));
    for (let i = 0; i <= n; i++) {
      const p = st.cam.worldToScreen(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
  };
  const h = Q.half;
  ctx.beginPath();
  line(z.x - h, z.y - h, z.x + h, z.y - h);
  line(z.x + h, z.y - h, z.x + h, z.y + h);
  line(z.x + h, z.y + h, z.x - h, z.y + h);
  line(z.x - h, z.y + h, z.x - h, z.y - h);
  if (m.layout === 'sides') {
    line(z.x - h, z.y - h, 0, 0);
    line(z.x + h, z.y - h, W, 0);
    line(z.x + h, z.y + h, W, H);
    line(z.x - h, z.y + h, 0, H);
  } else {
    line(z.x, z.y - h, z.x, 0);
    line(z.x, z.y + h, z.x, H);
    line(z.x - h, z.y, 0, z.y);
    line(z.x + h, z.y, W, z.y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([12, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const f of m.flags ?? []) {
    groundCircle(f.x, f.y, f.r);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = '#e8ece8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  void px;
}

/** Kreis auf dem Boden als Pfad in Bildschirmkoordinaten (folgt isometrisch dem Gelände). */
function groundCircle(x, y, r) {
  const cam = st.cam;
  ctx.beginPath();
  const n = Math.max(32, Math.min(160, Math.round(r / 24)));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = cam.worldToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
}

// ---- Gelände ------------------------------------------------------------------------

/** Gelände der Karte; eine flache Karte bekommt beim ersten Pinselstrich ein (flaches) Höhenraster. */
function ensureRelief() {
  let relief = reliefOf(st.map);
  if (!relief) {
    relief = new Relief();
    setRelief(st.map, relief);
  }
  return relief;
}

/** Geländebild der 2D-Ansicht (Schummerung, Fels, Seen; Kacheln) oder null für eine flache Karte. */
function reliefImage() {
  const relief = reliefOf(st.map);
  if (!relief) return null;
  if (!st.reliefImg || st.reliefImg.relief !== relief) st.reliefImg = { relief, tiles: reliefTiles(relief, W, H) };
  return st.reliefImg.tiles;
}

/** Einen Pinselschritt (dt Sekunden) am Gestenpunkt anwenden: Grobraster ändern, Feinraster und 2D-Bild nachziehen. */
function applyBrush(g, dt) {
  const relief = reliefOf(st.map);
  if (!relief || dt <= 0) return;
  const R = BRUSH_SIZES[st.brush.size];
  const pw = BRUSH_POWER[st.brush.power][1];
  const res = RELIEF.res;
  const n = COARSE_N;
  const C = relief.coarse;
  const i0 = clamp(Math.floor((g.x - R) / res), 0, n - 1);
  const i1 = clamp(Math.ceil((g.x + R) / res), 0, n - 1);
  const j0 = clamp(Math.floor((g.y - R) / res), 0, n - 1);
  const j1 = clamp(Math.ceil((g.y + R) / res), 0, n - 1);
  const src = g.tool === 'smooth' ? C.slice() : C; // Glätten liest die alten Werte, damit die Richtung keine Rolle spielt
  const at = (i, j) => src[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
  const k = 1 - Math.exp(-dt * (g.tool === 'smooth' ? 7 : 5) * pw);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const t = Math.hypot(i * res - g.x, j * res - g.y) / R;
      if (t >= 1) continue;
      const wgt = (1 - t * t) ** 2;
      const idx = j * n + i;
      let v = C[idx];
      if (g.tool === 'raise') v += RAISE_RATE * pw * dt * wgt;
      else if (g.tool === 'lower') v -= RAISE_RATE * pw * dt * wgt;
      else if (g.tool === 'flatten') v += (g.target - v) * k * wgt;
      else {
        const avg = (at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1) + at(i - 1, j - 1) + at(i + 1, j - 1) + at(i - 1, j + 1) + at(i + 1, j + 1) + at(i, j) * 2) / 10;
        v += (avg - v) * k * wgt;
      }
      C[idx] = clamp(v, RELIEF.min, H_MAX);
    }
  }
  relief.refine(i0, j0, i1, j1);
  if (st.reliefImg && st.reliefImg.relief === relief) {
    const m = 2 * res; // das Feinraster reicht zwei Grobpunkte weiter
    updateReliefTiles(st.reliefImg.tiles, relief, i0 * res - m, j0 * res - m, i1 * res + m, j1 * res + m);
  }
  st.dirty = true;
  st.needDraw = true;
}

/** Grobpunkte im Rechteck um (x0, y0)–(x1, y1) plus pad mit f(i, j, x, y, h) → neue Höhe ändern, Feinraster und Bild nachziehen. */
function editCoarse(x0, y0, x1, y1, pad, f) {
  const relief = ensureRelief();
  const res = RELIEF.res;
  const n = COARSE_N;
  const C = relief.coarse;
  const i0 = clamp(Math.floor((Math.min(x0, x1) - pad) / res), 0, n - 1);
  const i1 = clamp(Math.ceil((Math.max(x0, x1) + pad) / res), 0, n - 1);
  const j0 = clamp(Math.floor((Math.min(y0, y1) - pad) / res), 0, n - 1);
  const j1 = clamp(Math.ceil((Math.max(y0, y1) + pad) / res), 0, n - 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) C[j * n + i] = clamp(f(i * res, j * res, C[j * n + i]), RELIEF.min, H_MAX);
  }
  relief.refine(i0, j0, i1, j1);
  if (st.reliefImg && st.reliefImg.relief === relief) {
    const m = 2 * res;
    updateReliefTiles(st.reliefImg.tiles, relief, i0 * res - m, j0 * res - m, i1 * res + m, j1 * res + m);
  }
  finishTerrain();
}

/** Flussbett entlang der Strecke graben (wie der Kartengenerator: Wasser, dann sanfter Uferhang). */
function carveRiver(g) {
  const seg = { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 };
  editCoarse(g.x1, g.y1, g.x2, g.y2, RIVER_SIZE.reach, (x, y, h) => riverHeight(h, distToSeg(x, y, seg)));
}

/** Furt: das Wasser im Kreis wird seicht (tiefe Stellen bis zum Furtgrund aufgefüllt, zum Rand hin weich auslaufend). */
function shapeFord(f) {
  const bed = RIVER_SIZE.fordBed;
  editCoarse(f.x, f.y, f.x, f.y, f.r + 70, (x, y, h) => {
    if (h >= bed) return h;
    const d = Math.hypot(x - f.x, y - f.y);
    const k = 1 - Math.min(1, Math.max(0, (d - f.r * 0.85) / 80));
    return h + (bed - h) * k;
  });
}

/** Linie für Fluss oder Brücke fertig gezogen. */
function finishWaterLine(g) {
  const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
  if (g.kind === 'river') {
    if (len < 16) return;
    pushHistory();
    carveRiver(g);
    say('Flussbett gegraben. Furten und Brücken machen es passierbar.');
    return;
  }
  if (len < BRIDGE_LEN[0] || len > BRIDGE_LEN[1]) {
    say(`Eine Brücke ist ${BRIDGE_LEN[0]}–${BRIDGE_LEN[1]} px lang (diese: ${Math.round(len)} px).`, true);
    return;
  }
  if ((st.map.bridges ?? []).length >= MAX_BRIDGES) {
    say(`Höchstens ${MAX_BRIDGES} Brücken je Karte`, true);
    return;
  }
  pushHistory();
  const o = { x1: Math.round(g.x1), y1: Math.round(g.y1), x2: Math.round(g.x2), y2: Math.round(g.y2) };
  (st.map.bridges ??= []).push(o);
  st.sel = { k: 'bridge', o };
  showInspector();
  updateInfo();
}

/** Pinselstrich fertig: Gelände in die Karte schreiben (Verlauf, Speichern), Boden ohne WebGL neu backen. */
function finishTerrain() {
  const relief = reliefOf(st.map);
  if (relief) setRelief(st.map, relief);
  st.groundDirty = true;
  st.needDraw = true;
}

/** Höhe und Begehbarkeit am Weltpunkt für die Statuszeile. */
function heightInfo(x, y) {
  const relief = reliefOf(st.map);
  if (!relief) return '';
  const h = relief.heightAt(x, y);
  const g = relief.gradAt(x, y);
  const sl = Math.hypot(g.x, g.y);
  const what = h < RELIEF.water ? 'See' : h > RELIEF.peak || sl > RELIEF.steep ? 'unpassierbar' : sl > RELIEF.rock ? 'steil' : '';
  return ` · Höhe ${Math.round(h)}${what ? ` (${what})` : ''}`;
}

function drawSelection(sel, px) {
  const o = sel.o;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  const pad = 3 * px;
  if (sel.k === 'prop') {
    ctx.strokeRect(Math.floor(o.x / TILE_PX) * TILE_PX - pad, Math.floor(o.y / TILE_PX) * TILE_PX - pad, TILE_PX + 2 * pad, TILE_PX + 2 * pad);
    ctx.setLineDash([]);
    return;
  }
  if (sel.k === 'building' || sel.k === 'field' || sel.k === 'plaza') {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle || 0);
    ctx.strokeRect(-o.w / 2 - pad, -o.h / 2 - pad, o.w + pad * 2, o.h + pad * 2);
    ctx.restore();
  } else if (SEG_KINDS.has(sel.k)) {
    ctx.setLineDash([]);
    for (const [x, y] of [[o.x1, o.y1], [o.x2, o.y2]]) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(8 * px, (o.w ?? 40) * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([6 * px, 4 * px]);
    ctx.beginPath();
    ctx.moveTo(o.x1, o.y1);
    ctx.lineTo(o.x2, o.y2);
    ctx.stroke();
  } else if (sel.k === 'car') {
    const hw = o.vertical ? 9 : 18;
    const hh = o.vertical ? 18 : 9;
    ctx.strokeRect(o.x - hw - pad, o.y - hh - pad, hw * 2 + pad * 2, hh * 2 + pad * 2);
  } else if (sel.k === 'spawn' || sel.k === 'zone') {
    ctx.beginPath();
    ctx.arc(o.x, o.y, Math.max(14 * px, 60), 0, Math.PI * 2);
    ctx.stroke();
  } else if (sel.k === 'crate') {
    ctx.beginPath();
    ctx.arc(o.x, o.y, Math.max(12 * px, 20), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + pad, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function tick() {
  const g = st.gesture;
  if (g && g.type === 'terrain') {
    const now = performance.now();
    applyBrush(g, Math.min(0.1, (now - g.last) / 1000));
    g.last = now;
  }
  if (st.needDraw) draw();
  requestAnimationFrame(tick);
}

// ---- Eingabe ---------------------------------------------------------------------

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** Straßenpunkt: rastet an Enden und Mittellinien anderer Straßen ein, damit Kreuzungen und Einmündungen sauber schließen. */
function snapRoad(x, y, kind = 'road') {
  const z = st.cam.zoom;
  const tolEnd = 40 / z;
  let best = null;
  let bd = Infinity;
  const list = kind === 'rail' ? st.map.town.rails : kind === 'walk' ? (st.map.town.walks ?? []) : st.map.town.roads;
  for (const r of list) {
    for (const [ex, ey] of [[r.x1, r.y1], [r.x2, r.y2]]) {
      const d = Math.hypot(ex - x, ey - y);
      if (d < tolEnd && d < bd) {
        bd = d;
        best = { x: ex, y: ey };
      }
    }
  }
  if (best) return best;
  if (kind === 'walk') {
    // Bürgersteig: rastet an der Straßenkante ein (Mittellinie des Steigs eine halbe Straßen- plus halbe Steigbreite neben der Straße)
    for (const r of st.map.town.roads) {
      if (r.dirt) continue;
      const dx = r.x2 - r.x1;
      const dy = r.y2 - r.y1;
      const len = Math.hypot(dx, dy) || 1;
      const t = clamp(((x - r.x1) * dx + (y - r.y1) * dy) / (len * len), 0, 1);
      const qx = r.x1 + t * dx;
      const qy = r.y1 + t * dy;
      const nx = -dy / len;
      const ny = dx / len;
      const side = (x - qx) * nx + (y - qy) * ny >= 0 ? 1 : -1;
      const off = r.w / 2 + WALK_W / 2;
      const sx = qx + nx * off * side;
      const sy = qy + ny * off * side;
      const d = Math.hypot(sx - x, sy - y);
      if (d < 24 / z + WALK_W / 2 && d < bd) {
        bd = d;
        best = { x: Math.round(sx), y: Math.round(sy) };
      }
    }
    if (best) return best;
  }
  for (const r of list) {
    const dx = r.x2 - r.x1;
    const dy = r.y2 - r.y1;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - r.x1) * dx + (y - r.y1) * dy) / l2, 0, 1);
    const qx = r.x1 + t * dx;
    const qy = r.y1 + t * dy;
    const d = Math.hypot(qx - x, qy - y);
    if (d < (r.w ?? 40) / 2 + 28 / z && d < bd) {
      bd = d;
      best = { x: Math.round(qx), y: Math.round(qy) };
    }
  }
  return best || { x: clamp(snap(x), 0, W), y: clamp(snap(y), 0, H) };
}

function endpointHit(sel, wx, wy) {
  if (!sel || !SEG_KINDS.has(sel.k)) return 0;
  const tol = 22 / st.cam.zoom + (sel.o.w ?? 40) / 2;
  if (Math.hypot(sel.o.x1 - wx, sel.o.y1 - wy) < tol) return 1;
  if (Math.hypot(sel.o.x2 - wx, sel.o.y2 - wy) < tol) return 2;
  return 0;
}

function pinchStep() {
  const [a, b] = [...st.touches.values()];
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const last = st.pinch;
  st.pinch = { dist, cx, cy };
  if (!last) return;
  panBy(cx - last.cx, cy - last.cy);
  zoomAt(dist / last.dist, cx, cy);
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pos(e);
  if (e.pointerType === 'touch') {
    st.touches.set(e.pointerId, p);
    if (st.touches.size >= 2) {
      cancelGesture();
      st.pinch = null;
      pinchStep();
      return;
    }
  }
  if (e.button === 1 || e.button === 2) {
    st.gesture = { type: 'pan', x: p.x, y: p.y };
    return;
  }
  if (e.button !== 0) return;
  canvas.setPointerCapture?.(e.pointerId);
  const w = toWorld(p.x, p.y);
  st.pointer = w;
  const t = st.tool;
  if (t === 'hand') {
    st.gesture = { type: 'pan', x: p.x, y: p.y };
  } else if (t === 'select') {
    const ep = endpointHit(st.sel, w.x, w.y);
    if (ep) {
      pushHistory();
      st.gesture = { type: 'endpoint', ep, moved: true };
      return;
    }
    const hit = pickAt(w.x, w.y, p.x, p.y);
    st.sel = hit;
    showInspector();
    st.needDraw = true;
    if (hit) st.gesture = { type: 'move', x: w.x, y: w.y, started: false, sx: p.x, sy: p.y };
    else st.gesture = { type: 'pan', x: p.x, y: p.y };
  } else if (t === 'erase') {
    const hit = pickAt(w.x, w.y, p.x, p.y);
    if (hit) {
      pushHistory();
      if (!removeSel(hit)) {
        st.hist.pop();
        say('Startpunkte und Zone lassen sich nicht löschen, nur verschieben.', true);
      } else {
        st.sel = null;
        showInspector();
        st.needDraw = true;
        updateInfo();
      }
    }
  } else if (LINE_TOOLS.has(t)) {
    const a = t === 'river' ? { x: Math.round(w.x), y: Math.round(w.y) } : snapRoad(w.x, w.y, t);
    const lw = lineWidth(t);
    st.gesture = { type: 'line', kind: t, dirt: t === 'dirt', w: lw, x1: a.x, y1: a.y, x2: a.x, y2: a.y };
  } else if (t === 'prop' && !PROPS.kinds[st.propKind].line) {
    // Einzelstück: setzen, Ziehen verschiebt es im 8-px-Raster
    const list = listOf('prop');
    const K = PROPS.kinds[st.propKind];
    const top = stackTarget(st.map, st.propKind, w.x, w.y); // auf ein Stück derselben Art: eine Lage darauf
    const o = ghostOf('prop', w.x, w.y).o;
    if (top) {
      if ((top.stack ?? 1) >= K.stack) say(`${K.name}: höchstens ${K.stack} Lagen`, true);
      else {
        pushHistory();
        top.stack = (top.stack ?? 1) + 1;
        st.sel = { k: 'prop', o: top };
        showInspector();
        say(`${K.name}: ${top.stack} Lagen`);
      }
    } else if (list.length >= MAX_PROPS) say(`Höchstens ${MAX_PROPS} Props je Karte`, true);
    else if (roomFor('prop', o)) {
      pushHistory();
      list.push(o);
      st.lastProp = o; // „Drehen“ im Deko-Werkzeug dreht dieses Stück mit
      st.gesture = { type: 'propmove', o, x: w.x, y: w.y };
      updateInfo();
    }
    st.needDraw = true;
  } else if (t === 'prop') {
    const a = cellAt(w.x, w.y);
    st.gesture = { type: 'propline', a, b: a };
    st.needDraw = true;
  } else if (TERRAIN_TOOLS.has(t)) {
    pushHistory();
    const relief = ensureRelief();
    st.gesture = { type: 'terrain', tool: t, x: w.x, y: w.y, target: relief.heightAt(w.x, w.y), last: performance.now() };
    applyBrush(st.gesture, 1 / 20);
  } else if (t === 'plaza') {
    // Plätze malen: der erste liegt im Raster, weitere lückenlos daneben (ganze Felder ab dem ersten)
    pushHistory();
    st.sel = place(t, w.x, w.y);
    const o = st.sel?.o ?? plazaAt(w.x, w.y);
    st.gesture = { type: 'plazas', ax: o.x, ay: o.y, x: w.x, y: w.y };
    showInspector();
    st.needDraw = true;
    updateInfo();
  } else if (t === 'tree') {
    pushHistory();
    place(t, w.x, w.y);
    st.gesture = { type: 'brush', tool: t, x: w.x, y: w.y };
    st.needDraw = true;
    updateInfo();
  } else {
    pushHistory();
    st.sel = place(t, w.x, w.y);
    st.gesture = { type: 'place', x: w.x, y: w.y, sel: st.sel };
    showInspector();
    st.needDraw = true;
    updateInfo();
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerleave', () => {
  st.hover = false;
  st.needDraw = true;
});

window.addEventListener('pointermove', (e) => {
  const p = pos(e);
  if (e.pointerType === 'touch') {
    if (!st.touches.has(e.pointerId)) return;
    st.touches.set(e.pointerId, p);
    if (st.touches.size >= 2) {
      pinchStep();
      return;
    }
  }
  const w = toWorld(p.x, p.y);
  st.pointer = w;
  const hover = e.pointerType === 'mouse' && e.target === canvas;
  if (hover || st.hover) st.needDraw = true; // Vorschau folgt dem Zeiger
  st.hover = hover;
  $('[data-info]').textContent = `x ${Math.round(w.x)} · y ${Math.round(w.y)}${heightInfo(w.x, w.y)} · Zoom ${Math.round(st.cam.zoom * 100)} %`;
  if (TERRAIN_TOOLS.has(st.tool)) st.needDraw = true; // Pinselkreis folgt dem Zeiger
  const g = st.gesture;
  if (!g) return;
  if (g.type === 'pan') {
    panBy(p.x - g.x, p.y - g.y);
    g.x = p.x;
    g.y = p.y;
  } else if (g.type === 'move') {
    if (!g.started) {
      if (Math.hypot(p.x - g.sx, p.y - g.sy) < 5) return;
      g.started = true;
      g.orig = { x: st.sel.o.x, y: st.sel.o.y };
      pushHistory();
    }
    // nur auf freien Platz: ist er belegt, bleibt das Objekt stehen und springt nach, sobald der Zeiger wieder frei ist
    const moved = st.sel.k === 'spawn' || st.sel.k === 'zone' ? tryMove(st.sel, snap(w.x) - snap(g.x), snap(w.y) - snap(g.y)) : tryMove(st.sel, w.x - g.x, w.y - g.y);
    if (moved) {
      g.x = w.x;
      g.y = w.y;
    }
    st.needDraw = true;
  } else if (g.type === 'endpoint') {
    const r = st.sel.o;
    const q = snapRoad(w.x, w.y, st.sel.k);
    if (g.ep === 1) { r.x1 = q.x; r.y1 = q.y; }
    else { r.x2 = q.x; r.y2 = q.y; }
    st.needDraw = true;
  } else if (g.type === 'line') {
    const b = g.kind === 'river' ? { x: Math.round(w.x), y: Math.round(w.y) } : snapRoad(w.x, w.y, g.kind);
    g.x2 = b.x;
    g.y2 = b.y;
    st.needDraw = true;
  } else if (g.type === 'terrain') {
    // Weltpunkt nur bei Bewegung neu: beim Heben wandert sonst der Punkt unter dem stehenden Finger mit
    g.x = w.x;
    g.y = w.y;
  } else if (g.type === 'plazas') {
    // Strecke seit dem letzten Ereignis in kleinen Schritten abgehen, damit bei schneller Maus keine Lücken bleiben
    const n = Math.ceil(Math.hypot(w.x - g.x, w.y - g.y) / (PLAZA_SIZE / 4));
    for (let k = 1; k <= n; k++) {
      const x = g.x + ((w.x - g.x) * k) / n;
      const y = g.y + ((w.y - g.y) * k) / n;
      addPlaza(g.ax + Math.round((x - g.ax) / PLAZA_SIZE) * PLAZA_SIZE, g.ay + Math.round((y - g.ay) / PLAZA_SIZE) * PLAZA_SIZE);
    }
    g.x = w.x;
    g.y = w.y;
    st.needDraw = true;
    updateInfo();
  } else if (g.type === 'propmove') {
    const { x, y } = g.o;
    g.o.x = clamp(x + snap(w.x) - snap(g.x), 0, W - 1);
    g.o.y = clamp(y + snap(w.y) - snap(g.y), 0, H - 1);
    if (roomFor('prop', g.o, true)) {
      g.x = w.x;
      g.y = w.y;
    } else {
      g.o.x = x;
      g.o.y = y;
    }
    st.needDraw = true;
  } else if (g.type === 'propline') {
    const b = cellAt(w.x, w.y);
    if (b.c !== g.b.c || b.r !== g.b.r) {
      g.b = b;
      st.needDraw = true;
    }
  } else if (g.type === 'brush') {
    if (Math.hypot(w.x - g.x, w.y - g.y) >= 34) {
      place(g.tool, w.x, w.y);
      g.x = w.x;
      g.y = w.y;
      st.needDraw = true;
      updateInfo();
    }
  } else if (g.type === 'place') {
    // Beim Setzen ziehen = Objekt feinjustieren
    if (st.sel && g.sel === st.sel && tryMove(st.sel, snap(w.x) - snap(g.x), snap(w.y) - snap(g.y))) {
      g.x = w.x;
      g.y = w.y;
      st.needDraw = true;
    }
  }
});

function cancelGesture() {
  const g = st.gesture;
  st.gesture = null;
  if (g && g.type === 'terrain') finishTerrain();
  return g;
}

function endPointer(e) {
  if (e.pointerType === 'touch') {
    if (!st.touches.delete(e.pointerId)) return;
    if (st.pinch) {
      if (!st.touches.size) st.pinch = null;
      st.gesture = null;
      return;
    }
  }
  const g = cancelGesture();
  st.needDraw = true; // Boden der Iso-Ansicht wird erst ohne laufende Geste neu gebacken
  if (!g) return;
  if (g.type === 'move' || g.type === 'place') {
    settleProp(st.sel);
    // Kachel in eine Zelle mit einer anderen Kachel gerutscht: zurück an den Start
    const o = st.sel?.o;
    if (g.orig && st.sel.k === 'prop' && K_LINE(o) && st.map.props.some((p) => p !== o && p.x === o.x && p.y === o.y)) {
      o.x = g.orig.x;
      o.y = g.orig.y;
      say('Kein Platz: dort liegt schon eine Kachel', true);
    }
  }
  if (g.type === 'propmove') {
    updateInfo();
    return;
  }
  if (g.type === 'propline' && e.type !== 'pointercancel') {
    pushHistory();
    placePropLine(g.a, g.b);
    st.sel = null; // Auswahl der Art bleibt sichtbar; eine Kachel bearbeiten: Werkzeug „Wählen“
    showInspector();
    updateInfo();
    return;
  }
  if (g.type === 'line' && e.type !== 'pointercancel' && (g.kind === 'river' || g.kind === 'bridge')) {
    finishWaterLine(g);
  } else if (g.type === 'line' && e.type !== 'pointercancel') {
    if (Math.hypot(g.x2 - g.x1, g.y2 - g.y1) >= 32) {
      pushHistory();
      const o = g.kind === 'rail' ? { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 } : { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, w: g.w, ...(g.dirt ? { dirt: true } : {}) };
      const k = g.kind === 'rail' || g.kind === 'walk' ? g.kind : 'road';
      const list = listOf(k);
      if (k === 'walk' && list.length >= MAX_PAVING) say(`Höchstens ${MAX_PAVING} Bürgersteige je Karte`, true);
      else {
        list.push(o);
        st.sel = { k, o };
      }
      showInspector();
      updateInfo();
    }
    st.needDraw = true;
  }
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const p = pos(e);
    zoomAt(clamp(Math.exp(-e.deltaY * 0.0015), 0.8, 1.25), p.x, p.y);
  },
  { passive: false },
);

window.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
  if (k === 'Delete' || k === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  } else if (k === 'Escape') deselect();
  else if (k.startsWith('Arrow')) {
    e.preventDefault();
    const s = 120 * st.cam.zoom;
    panBy(k === 'ArrowLeft' ? s : k === 'ArrowRight' ? -s : 0, k === 'ArrowUp' ? s : k === 'ArrowDown' ? -s : 0);
  } else if (k === 'v' || k === 'V') toggleView();
  else if (k === ',') rotateView(-1);
  else if (k === '.') rotateView(1);
  else if ((k === '[' || k === ']') && TERRAIN_TOOLS.has(st.tool)) brushAction(k === ']' ? 'size+' : 'size-');
  else if (k === '+' || k === '=') zoomAt(1.2, window.innerWidth / 2, window.innerHeight / 2);
  else if (k === '-') zoomAt(1 / 1.2, window.innerWidth / 2, window.innerHeight / 2);
});

// ---- Werkzeugleiste und Inspektor ---------------------------------------------------

function buildTools() {
  let group = '';
  let html = '';
  for (const [id, name, g, icon] of TOOLS) {
    if (g !== group) {
      html += `<h4>${g}</h4>`;
      group = g;
    }
    html += `<button type="button" data-tool="${id}" aria-pressed="false"><span class="ic">${icon}</span>${name}</button>`;
  }
  $('[data-tools]').innerHTML = html;
}

/** Auswahl aufheben und zum Werkzeug „Wählen“ (Knopf „Abwählen“, Esc): danach setzt ein Tippen nichts mehr. */
function deselect() {
  st.sel = null;
  st.lastProp = null;
  setTool('select');
  showInspector();
  st.needDraw = true;
}

function setTool(t) {
  if (t !== st.tool) st.lastProp = null;
  st.tool = t;
  if (TERRAIN_TOOLS.has(t)) st.sel = null;
  if (st.map) showInspector();
  st.needDraw = true;
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  const def = TOOLS.find((x) => x[0] === t);
  $('[data-hint]').textContent = def ? def[4] : '';
}

const SEL_NAMES = {
  building: 'Gebäude',
  road: 'Straße',
  park: 'Park',
  car: 'Auto',
  tree: 'Baum',
  townTree: 'Baum',
  obstacle: 'Hindernis',
  rail: 'Gleis',
  spawn: 'Startpunkt',
  zone: 'Konfliktzone',
  flag: 'Flagge',
  crate: 'Versorgungskiste',
  prop: 'Deko',
  field: 'Feld',
  bridge: 'Brücke',
  ford: 'Furt',
  plaza: 'Platz',
  walk: 'Bürgersteig',
};
const FIELD_NAMES = { wheat: 'Weizenfeld', green: 'Junge Saat', soil: 'Acker (gepflügt)', rape: 'Rapsfeld', pasture: 'Weide' };
const FIELD_ORDER = [...FIELD_CROPS, 'pasture']; // „Frucht“ schaltet der Reihe nach weiter
const KIND_NAMES = { house: 'Haus', factory: 'Fabrik', hall: 'Halle', tower: 'Wachturm', train: 'Zugteil', station: 'Bahnhof', platform: 'Bahnsteig', plant: 'Große Fabrikhalle', pylon: 'Strommast' };

function showInspector() {
  const el = $('[data-insp]');
  const s = st.sel;
  if (!s && TERRAIN_TOOLS.has(st.tool)) {
    const [pname] = BRUSH_POWER[st.brush.power];
    el.innerHTML =
      '<h3>Geländepinsel</h3>' +
      '<div class="row"><button data-b="size-">Kleiner</button><button data-b="size+">Größer</button></div>' +
      `<div class="muted small">Größe ${BRUSH_SIZES[st.brush.size] * 2} px</div>` +
      `<div class="row"><button data-b="power">Stärke: ${pname}</button></div>` +
      '<div class="muted small">Steile Hänge werden zu Fels und sind unpassierbar, ebenso Gipfel und Seen. ' +
      'Wege in die Konfliktzone frei lassen, „Prüfen“ zählt die Zugänge.</div>' +
      (reliefOf(st.map) ? '<div class="row"><button data-b="flat" class="danger">Alles eben</button></div>' : '');
    el.hidden = false;
    return;
  }
  if (!s && st.tool === 'prop') {
    const K = PROPS.kinds[st.propKind];
    const groups = Object.entries(PROPS.groups).map(([gk, gname]) => {
      const btns = Object.entries(PROPS.kinds).filter(([, k]) => k.group === gk).map(([id, k]) => `<button data-p="${id}" aria-pressed="${id === st.propKind}">${k.name}</button>`);
      return `<div class="muted small">${gname}</div><div class="row wrap">${btns.join('')}</div>`;
    });
    const turn = K.line ? '' : `<button data-b="prot">Drehen: ${st.propRot * 45}°</button>`;
    const hint = K.line ? '' : ' „Drehen“ dreht das zuletzt gesetzte Stück und alle folgenden.';
    el.innerHTML = `<h3>Deko: ${K.name}</h3><div class="row">${turn}<button data-b="desel">Abwählen</button></div><div class="muted small">${propRulesText(K)}${hint}</div>${groups.join('')}`;
    el.hidden = false;
    return;
  }
  if (!s) {
    el.hidden = true;
    return;
  }
  let title = SEL_NAMES[s.k];
  if (s.k === 'prop') title = PROPS.kinds[s.o.kind]?.name ?? title;
  if (s.k === 'building') title = KIND_NAMES[s.o.kind] || title;
  if (s.k === 'obstacle') title = Math.round(s.o.r) % 2 === 0 ? 'Wald' : 'Fels';
  if (s.k === 'spawn') title = `Start ${BALANCE.teamNames[s.i]}`;
  if (s.k === 'field') title = FIELD_NAMES[s.o.kind === 'pasture' ? 'pasture' : s.o.crop] || title;
  if (s.k === 'flag') title = `Flagge ${BALANCE.conquest.names[(st.map.flags ?? []).indexOf(s.o)] ?? ''}${s.o.name ? ` – ${s.o.name}` : ''}`;
  const rows = [];
  if (s.k === 'building' && s.o.kind === 'pylon') {
    st.pylonLine = s.o.line ?? 0; // weitere Masten setzen diese Leitung fort
    rows.push(`<div class="muted small">Leitung ${s.o.line ?? 0}: Masten derselben Leitung sind in Setzreihenfolge verbunden.</div>`);
    rows.push('<div class="row"><button data-i="line">Neue Leitung</button></div>');
  } else if (s.k === 'flag') {
    rows.push('<div class="row"><button data-i="r-">Kleiner</button><button data-i="r+">Größer</button><button data-i="name">Name</button></div>');
    rows.push(`<div class="muted small">Gebiet: Kreis mit ${s.o.r} px um den Mast. Wer darin mehr Einheiten hat, nimmt die Flagge ein.</div>`);
  } else if (s.k === 'building') {
    rows.push('<div class="row"><button data-i="w-">Breite −</button><button data-i="w+">Breite +</button></div>');
    rows.push('<div class="row"><button data-i="h-">Höhe −</button><button data-i="h+">Höhe +</button></div>');
    const turnable = s.o.kind === 'train' || s.o.kind === 'platform';
    rows.push(
      turnable
        ? '<div class="row"><button data-i="rot-">↺ 15°</button><button data-i="rot+">↻ 15°</button></div>'
        : '<div class="row"><button data-i="turn">Drehen</button>' + (s.o.kind !== 'station' ? '<button data-i="kind">Art</button>' : '') + '</div>',
    );
  } else if (s.k === 'field') {
    rows.push('<div class="row"><button data-i="w-">Breite −</button><button data-i="w+">Breite +</button></div>');
    rows.push('<div class="row"><button data-i="h-">Höhe −</button><button data-i="h+">Höhe +</button></div>');
    rows.push('<div class="row"><button data-i="rot-">↺ 15°</button><button data-i="rot+">↻ 15°</button><button data-i="crop">Frucht</button></div>');
    rows.push('<div class="muted small">Nur Boden: Einheiten fahren darüber, Felder blockieren nichts.</div>');
  } else if (s.k === 'road') {
    rows.push('<div class="row"><button data-i="rw-">Schmaler</button><button data-i="rw+">Breiter</button></div>');
    rows.push('<div class="row"><button data-i="dirt">' + (s.o.dirt ? 'Zur Straße' : 'Zum Feldweg') + '</button></div>');
    rows.push('<div class="muted small">Enden ziehen, um die Straße zu ändern.</div>');
  } else if (s.k === 'plaza') {
    rows.push('<div class="row"><button data-i="w-">Breite −</button><button data-i="w+">Breite +</button></div>');
    rows.push('<div class="row"><button data-i="h-">Höhe −</button><button data-i="h+">Höhe +</button></div>');
    rows.push('<div class="row"><button data-i="rot-">↺ 15°</button><button data-i="rot+">↻ 15°</button></div>');
    rows.push(`<div class="muted small">${s.o.w} × ${s.o.h} px. Nur Boden: Einheiten fahren darüber, die Stadt baut darüber.</div>`);
  } else if (s.k === 'walk') {
    rows.push('<div class="row"><button data-i="ww-">Schmaler</button><button data-i="ww+">Breiter</button></div>');
    rows.push(`<div class="muted small">Breite ${s.o.w} px. Enden ziehen, um den Bürgersteig zu ändern. Nur Boden, blockiert nichts.</div>`);
  } else if (s.k === 'car') {
    rows.push('<div class="row"><button data-i="turn">Drehen</button><button data-i="color">Farbe</button></div>');
  } else if (s.k === 'zone') {
    rows.push('<div class="row"><button data-i="r-">Kleiner</button><button data-i="r+">Größer</button></div>');
    rows.push(`<div class="muted small">Radius ${Math.round(s.o.r)} px (klassisch)</div>`);
    const sides = st.map.layout === 'sides';
    rows.push(`<div class="row"><button data-i="layout">Baugebiete: ${sides ? 'an den Seiten' : 'in den Ecken'}</button></div>`);
    rows.push('<div class="muted small">Eroberung: Außerhalb der Zone gehört jedem Spieler das Gebiet um seinen Startpunkt, in den Ecken (Kreuz) oder an den Kartenseiten (Diagonalen).</div>');
  } else if (s.k === 'obstacle' || s.k === 'park' || s.k === 'tree' || s.k === 'townTree') {
    rows.push('<div class="row"><button data-i="r-">Kleiner</button><button data-i="r+">Größer</button></div>');
  } else if (s.k === 'rail') {
    rows.push('<div class="muted small">Enden ziehen, um das Gleis zu ändern. Neue Gleise rasten an Enden und Gleisen ein.</div>');
  } else if (s.k === 'spawn') {
    rows.push('<div class="muted small">Ziehen verschiebt den Startpunkt. Die Hauptstadt entsteht hier, Bauradius als Kreis.</div>');
  } else if (s.k === 'bridge') {
    const len = Math.round(Math.hypot(s.o.x2 - s.o.x1, s.o.y2 - s.o.y1));
    rows.push(`<div class="muted small">Länge ${len} px (${BRIDGE_LEN[0]}–${BRIDGE_LEN[1]}). Enden ziehen, um die Brücke zu ändern; beide Enden gehören auf festen Grund. Im Spiel zerstörbar (A + Klick), ein Baufahrzeug baut sie für ${BALANCE.river.rebuildCost} Geld wieder auf.</div>`);
  } else if (s.k === 'ford') {
    rows.push(`<div class="muted small">Seichtes Wasser im Kreis (Radius ${s.o.r} px): Bodeneinheiten kommen mit halbem Tempo hindurch. Rot-weiße Stangen markieren die Furt im Spiel.</div>`);
  } else if (s.k === 'prop') {
    const K = PROPS.kinds[s.o.kind];
    const gate = { 0: 'kein Tor', [GATE.closed]: 'Tor zu', [GATE.open]: 'Tor offen', [GATE.locked]: 'Tor verschlossen' }[s.o.gate ?? 0];
    const gname = K?.line ? gate : { 0: 'zu', [GATE.closed]: 'zu', [GATE.open]: 'offen', [GATE.locked]: 'verschlossen' }[s.o.gate ?? 0];
    const team = (s.o.team ?? -1) >= 0 ? BALANCE.teamNames[s.o.team] : 'neutral';
    rows.push(`<div class="row">${K?.gate ? `<button data-i="gate">${K.line ? gname : `Schranke ${gname}`}</button>` : ''}<button data-i="turn">Drehen</button><button data-i="pkind">Art</button></div>`);
    if (K?.flag) rows.push(`<div class="row"><button data-i="pteam">Fahne: ${team}</button></div>`);
    if (K?.stack) rows.push(`<div class="row"><button data-i="pstack">Lagen: ${s.o.stack ?? 1}</button></div>`);
    rows.push(`<div class="muted small">${K ? propRulesText(K) : ''} ${K?.line ? 'Tor nur in geraden Stücken; „zu“ öffnen Einheiten im Vorbeigehen (es schließt danach wieder), „offen“ bleibt offen, „verschlossen“ sperrt wie die Kachel. „Drehen“ gilt für einzelne Kacheln ohne Nachbarn.' : `Drehen: ${(K?.rotStep ?? 1) * 45}° je Druck (jetzt ${(s.o.rot ?? 0) * 45}°).${K?.flag ? ' Fahne: in der Eroberung zeigt sie den Besitzer der nächsten Flagge.' : ''}`}</div>`);
  } else if (s.k === 'crate') {
    const d = st.map.spawns.map((sp) => Math.round(Math.hypot(sp.x - s.o.x, sp.y - s.o.y)));
    rows.push(`<div class="muted small">Ziehen verschiebt die Kiste. Abstand zu den Starts: ${d[0]} / ${d[1]} px. Auf freien Boden setzen (sonst rückt sie im Spiel zur nächsten freien Stelle).</div>`);
  }
  if (s.k !== 'spawn' && s.k !== 'zone') {
    rows.push(`<div class="row"><button data-i="dup">Kopie</button><button data-i="del" class="danger">Löschen</button></div>`);
  } else if (spawnRemovable(s)) rows.push('<div class="row"><button data-i="del" class="danger">Löschen</button></div>');
  rows.push('<div class="row"><button data-i="desel">Abwählen</button></div>');
  el.innerHTML = `<h3>${title}</h3>${rows.join('')}`;
  el.hidden = false;
}

function deleteSelected() {
  if (!st.sel || ((st.sel.k === 'spawn' || st.sel.k === 'zone') && !spawnRemovable(st.sel))) return;
  pushHistory();
  removeSel(st.sel);
  st.sel = null;
  showInspector();
  st.needDraw = true;
  updateInfo();
}

function inspectorAction(a) {
  const s = st.sel;
  if (!s) return;
  const o = s.o;
  if (a === 'del') return deleteSelected();
  if (a === 'desel') return deselect();
  pushHistory();
  const before = JSON.stringify(o);
  if (s.k === 'plaza' && /^[wh][+-]$/.test(a)) {
    const key = a[0];
    o[key] = clamp(o[key] + (a[1] === '+' ? PLAZA_SIZE / 2 : -PLAZA_SIZE / 2), PLAZA_SIZE / 2, 600); // in halben Feldern: bleibt im Raster
  } else if (a === 'ww+' || a === 'ww-') o.w = clamp(o.w + (a === 'ww+' ? 4 : -4), 8, 64);
  else if (a === 'w+') o.w = Math.min(600, o.w + 16);
  else if (a === 'w-') o.w = Math.max(24, o.w - 16);
  else if (a === 'h+') o.h = Math.min(600, o.h + 16);
  else if (a === 'h-') o.h = Math.max(24, o.h - 16);
  else if (a === 'gate') {
    // Kachel: kein Tor → zu → offen → verschlossen; Schranke: zu → offen → verschlossen
    const next = { 0: GATE.closed, [GATE.closed]: GATE.open, [GATE.open]: GATE.locked, [GATE.locked]: K_LINE(o) ? 0 : GATE.closed }[o.gate ?? 0];
    if (next) o.gate = next;
    else delete o.gate;
  } else if (a === 'pkind') {
    const kinds = Object.keys(PROPS.kinds).filter((k) => PROPS.kinds[k].group === PROPS.kinds[o.kind]?.group && !!PROPS.kinds[k].line === !!PROPS.kinds[o.kind]?.line);
    o.kind = kinds[(kinds.indexOf(o.kind) + 1) % kinds.length];
    if (!PROPS.kinds[o.kind].gate) delete o.gate;
    if (!PROPS.kinds[o.kind].flag) delete o.team;
    if (!PROPS.kinds[o.kind].stack) delete o.stack;
    else if (o.stack > PROPS.kinds[o.kind].stack) o.stack = PROPS.kinds[o.kind].stack;
    st.propKind = o.kind;
  } else if (a === 'pstack') {
    const n = ((o.stack ?? 1) % (PROPS.kinds[o.kind]?.stack ?? 1)) + 1; // Container: 1, 2, 3 Lagen
    if (n > 1) o.stack = n;
    else delete o.stack;
  } else if (a === 'pteam') {
    const t = (o.team ?? -1) + 1;
    if (t >= BALANCE.teamNames.length) delete o.team;
    else o.team = t;
  } else if (a === 'turn' && s.k === 'prop') {
    o.rot = ((o.rot ?? 0) + (PROPS.kinds[o.kind]?.rotStep ?? (PROPS.kinds[o.kind]?.line ? 2 : 1))) & 7; // Achtel: Kacheln und Autos um 90°, Einzelstücke um 45°
    if (!o.rot) delete o.rot;
  } else if (a === 'turn') {
    if (s.k === 'car') o.vertical = !o.vertical;
    else [o.w, o.h] = [o.h, o.w];
  } else if (a === 'kind') {
    const order = ['house', 'factory', 'hall'];
    o.kind = order[(order.indexOf(o.kind) + 1) % order.length];
  } else if (a === 'color') o.color = CAR_COLORS[(CAR_COLORS.indexOf(o.color) + 1) % CAR_COLORS.length];
  else if (a === 'crop') {
    const next = FIELD_ORDER[(FIELD_ORDER.indexOf(o.kind === 'pasture' ? 'pasture' : o.crop) + 1) % FIELD_ORDER.length];
    if (next === 'pasture') {
      o.kind = 'pasture';
      delete o.crop;
    } else {
      o.kind = 'field';
      o.crop = next;
    }
    st.fieldCrop = next; // das nächste neue Feld bekommt dieselbe Frucht
  }
  else if (a === 'rot+' || a === 'rot-') {
    let ang = (o.angle || 0) + (a === 'rot+' ? 1 : -1) * (Math.PI / 12);
    if (ang > Math.PI) ang -= Math.PI * 2;
    if (ang <= -Math.PI) ang += Math.PI * 2;
    if (Math.abs(ang) < 1e-3) delete o.angle;
    else o.angle = ang;
  }
  else if (a === 'rw+') o.w = Math.min(200, o.w + 8);
  else if (a === 'rw-') o.w = Math.max(20, o.w - 8);
  else if (a === 'dirt') {
    if (o.dirt) delete o.dirt;
    else o.dirt = true;
  } else if (a === 'line') {
    const lines = st.map.town.buildings.filter((b) => b.kind === 'pylon').map((b) => b.line ?? 0);
    st.pylonLine = Math.min(PYLON_LINES - 1, Math.max(-1, ...lines) + 1);
    say(`Neue Strommasten gehören jetzt zu Leitung ${st.pylonLine}.`);
  } else if (a === 'layout') {
    if (st.map.layout === 'sides') delete st.map.layout;
    else st.map.layout = 'sides';
  } else if (a === 'name') {
    const n = window.prompt('Name der Flagge (leer = nur Buchstabe)', o.name ?? '');
    if (n !== null) {
      if (n.trim()) o.name = n.trim().slice(0, 24);
      else delete o.name;
    }
  } else if (s.k === 'flag' && (a === 'r+' || a === 'r-')) {
    const [lo, hi] = BALANCE.conquest.mapFlagRange;
    o.r = clamp(o.r + (a === 'r+' ? 20 : -20), lo, hi);
  } else if (a === 'r+' || a === 'r-') {
    const step = s.k === 'zone' ? 100 : s.k === 'obstacle' ? 10 : s.k === 'park' ? 20 : 2; // Wald/Fels: gerade Schritte behalten die Art
    const lim = s.k === 'zone' ? [200, 4000] : s.k === 'obstacle' ? [21, 400] : s.k === 'park' ? [40, 400] : [6, 40];
    o.r = clamp(o.r + (a === 'r+' ? step : -step), lim[0], lim[1]);
  } else if (a === 'dup') {
    const copy = JSON.parse(JSON.stringify(o));
    if (SEG_KINDS.has(s.k)) { copy.x1 += 48; copy.y1 += 48; copy.x2 += 48; copy.y2 += 48; }
    else if (!placeCopy(s.k, copy)) {
      st.hist.pop();
      say('Kein Platz für eine Kopie daneben', true);
      return;
    }
    listOf(s.k).push(copy);
    st.sel = { k: s.k, o: copy };
    updateInfo();
  }
  if (a !== 'dup' && footprint(s.k, o) && !roomFor(s.k, o)) {
    // größer, gedreht oder andere Art: passt nicht mehr, also zurück
    for (const key of Object.keys(o)) delete o[key];
    Object.assign(o, JSON.parse(before));
    st.hist.pop();
  }
  showInspector();
  st.needDraw = true;
}

$('[data-insp]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) inspectorAction(b.dataset.i);
  const p = e.target.closest('[data-b]');
  if (p) brushAction(p.dataset.b);
  const k = e.target.closest('[data-p]');
  if (k && PROPS.kinds[k.dataset.p]) {
    st.propKind = k.dataset.p; // Art für das Werkzeug „Deko“
    showInspector();
  }
});

/** Das zuletzt mit „Deko“ gesetzte Einzelstück auf die eingestellte Drehung bringen; passt es gedreht nicht, bleibt es stehen. */
function turnLastProp() {
  const o = st.lastProp;
  if (!o || o.kind !== st.propKind || !(st.map.props ?? []).includes(o)) return;
  const old = o.rot;
  pushHistory();
  if (st.propRot) o.rot = st.propRot;
  else delete o.rot;
  if (roomFor('prop', o)) return;
  if (old) o.rot = old;
  else delete o.rot;
  st.hist.pop();
}

function brushAction(a) {
  if (a === 'desel') return deselect();
  if (a === 'prot') {
    st.propRot = (st.propRot + (PROPS.kinds[st.propKind]?.rotStep ?? 1)) & 7; // nächstes Einzelstück um 45° (Autos 90°) weiter gedreht
    turnLastProp();
    showInspector();
    st.needDraw = true;
    return;
  }
  const br = st.brush;
  if (a === 'size+') br.size = Math.min(BRUSH_SIZES.length - 1, br.size + 1);
  else if (a === 'size-') br.size = Math.max(0, br.size - 1);
  else if (a === 'power') br.power = (br.power + 1) % BRUSH_POWER.length;
  else if (a === 'flat' && reliefOf(st.map)) {
    pushHistory();
    setRelief(st.map, null);
    say('Gelände eingeebnet (Rückgängig holt es zurück).');
  }
  showInspector();
  st.needDraw = true;
}
$('[data-tools]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]');
  if (b) setTool(b.dataset.tool);
});

// ---- Karte laden, speichern, prüfen ------------------------------------------------------

function updateInfo() {
  const d = describeMap(st.map);
  $('[data-msg]').classList.remove('bad');
  $('[data-info]').textContent = `${d.buildings} Gebäude · ${d.roads} Straßen · ${d.trees} Bäume · ${d.obstacles} Hindernisse · ${st.map.town.fields.length} Felder · ${st.map.crates.length} Kisten · ${(st.map.props ?? []).length} Deko`;
}

function setMap(map, { keepId = false } = {}) {
  st.map = map;
  if (!keepId) st.id = null;
  st.sel = null;
  st.hist = [];
  st.redo = [];
  st.dirty = false;
  $('[data-name]').value = map.name || 'Neue Karte';
  showInspector();
  syncButtons();
  updateInfo();
  st.needDraw = true;
}

function problems() {
  st.map.name = $('[data-name]').value.trim() || 'Karte';
  return checkMap(st.map);
}

function save() {
  st.map.name = $('[data-name]').value.trim() || 'Karte';
  const id = saveMap(JSON.parse(JSON.stringify(st.map)), st.id);
  if (!id) {
    say('Speichern fehlgeschlagen (Speicher voll oder gesperrt). Bitte als Datei exportieren.', true);
    return null;
  }
  st.id = id;
  st.dirty = false;
  history.replaceState(null, '', `editor.html?map=${encodeURIComponent(id)}`);
  say(`Gespeichert: ${st.map.name}`);
  return id;
}

function check(announce = true) {
  const p = problems();
  if (announce) {
    if (p.length) say(`Nicht spielbar: ${p.join(' · ')}`, true);
    else {
      const routes = accessRoutes(st.map, 4);
      const n = routes.map((v, i) => `${BALANCE.teamNames[i]} ${v >= 4 ? '4+' : String(v)}`);
      const few = Math.min(...routes) < 2 ? ' Wenige Wege: die Zone ist leicht abzuriegeln.' : '';
      const fl = st.map.flags?.length ? ` ${st.map.flags.length} eigene Flaggen.` : '';
      say(`Karte ist spielbar. Getrennte Zugänge zur Zone: ${n.join(', ')}.${fl}${few}`);
    }
  }
  return p;
}

function download(name, text, ext = 'json', type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = `${name.replace(/[^\w\-äöüÄÖÜß ]+/g, '_') || 'karte'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function confirmDiscard() {
  return !st.dirty || window.confirm('Ungespeicherte Änderungen gehen verloren. Fortfahren?');
}

document.querySelector('.edtop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'back') {
    if (confirmDiscard()) location.href = 'index.html';
  } else if (a === 'undo') undo();
  else if (a === 'redo') redo();
  else if (a === 'fit') fit();
  else if (a === 'view') toggleView();
  else if (a === 'rotl') rotateView(-1);
  else if (a === 'rotr') rotateView(1);
  else if (a === 'empty') {
    if (confirmDiscard()) setMap(createEmptyMap(), {});
  } else if (a === 'random') {
    if (!confirmDiscard()) return;
    const seed = Math.floor(Math.random() * 1e9) + 1;
    const m = normalizeMap({ ...generateMap(seed), name: `Zufallskarte ${seed}` });
    setMap(m);
    say(`Zufallskarte ${seed} geladen, jetzt frei änderbar.`);
  } else if (a === 'export') {
    st.map.name = $('[data-name]').value.trim() || 'Karte';
    download(st.map.name, JSON.stringify({ format: 1, ...st.map }));
  } else if (a === 'fixed') {
    // feste Karte: JS-Modul für js/data/maps/ (dort in index.js eintragen und in sw.js unter ASSETS, siehe docs/rezepte/feste-karte.md)
    st.map.name = $('[data-name]').value.trim() || 'Karte';
    const file = st.map.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'karte';
    const head = `// Feste Karte „${st.map.name}“ (Karteneditor, „Als feste Karte“). Format: js/game/mapdata.js.\n`;
    download(file, `${head}export default ${JSON.stringify(normalizeMap(JSON.parse(JSON.stringify(st.map))))};\n`, 'js', 'text/javascript');
    say(`Exportiert als ${file}.js: nach js/data/maps/ legen und in js/data/maps/index.js eintragen.`);
  } else if (a === 'check') check();
  else if (a === 'save') {
    const p = problems();
    save();
    if (p.length) say(`Gespeichert, aber noch nicht spielbar: ${p.join(' · ')}`, true);
  } else if (a === 'play') {
    const p = problems();
    if (p.length) {
      say(`Nicht spielbar: ${p.join(' · ')}`, true);
      return;
    }
    const id = save();
    if (!id) return;
    try {
      localStorage.setItem(SEL_KEY, id);
    } catch {
      /* ohne Speicher nicht möglich */
    }
    location.href = 'index.html';
  }
});

$('[data-import]').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f || !confirmDiscard()) return;
  f.text()
    .then((t) => {
      setMap(normalizeMap(JSON.parse(t)));
      say(`Importiert: ${st.map.name}`);
    })
    .catch((err) => say(`Import fehlgeschlagen: ${err.message}`, true));
});
$('[data-name]').addEventListener('input', () => {
  st.dirty = true;
});

window.addEventListener('resize', resize);
window.addEventListener('beforeunload', (e) => {
  if (st.dirty) e.preventDefault();
});

// ---- Start ------------------------------------------------------------------------

buildTools();
setTool('select');
(() => {
  let map = null;
  if (params.has('map')) {
    map = loadMap(params.get('map'));
    if (map && !isFixedMap(params.get('map'))) st.id = params.get('map'); // feste Karten: Speichern legt eine eigene Kopie an
  }
  if (!map && params.has('seed')) {
    const seed = Number.parseInt(params.get('seed'), 10) || 1;
    map = normalizeMap({ ...generateMap(seed, { river: params.get('river') === '1' }), name: `Zufallskarte ${seed}` });
  }
  setMap(map || createEmptyMap(), { keepId: !!map && !!st.id });
  if (params.has('map') && isFixedMap(params.get('map')) && map) say('Feste Karte geöffnet: Speichern legt eine eigene Kopie an.');
  else if (params.has('map') && !st.id) say('Karte nicht gefunden, neue Karte begonnen.', true);
})();
st.renderer = makeRenderer();
resize();
fit();
requestAnimationFrame(tick);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
