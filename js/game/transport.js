// Straßentransport (PRD §15 „Straßentransport“, seit v5.20, AP2): Wege über Straßenzellen von den Werken zum Lager der Hauptstadt,
// seit Paket „Import“ von jedem Werk zum nächsten Einfuhrpunkt (eigene Straße am Kartenrand, Güterbahnhof mit Gleis zum Rand), Pendlerwege zur nächsten bewohnten Wohnzelle und Stau je Straßenzelle. Dieses Modul rechnet nur Wege
// und Stau, es ändert nichts am Spiel. Kein DOM. Wege, Lasten und Puffer liegen in einer WeakMap je Stadt und werden nicht gespeichert
// (sie folgen allein aus dem Stand der Stadt); gespeichert wird nur der geglättete Stau-Faktor je Zelle (c.congestion), damit ein
// geladener Spielstand genau so weiterläuft wie das Spiel ohne Unterbrechung.
import { laneGrid } from './roads.js';
import { CITY } from '../data/city.js';
import { WORKS, WORKPLACE_KINDS, KINDS, KIND_ID } from '../data/citykinds.js'; // Arbeitsstätten mit Pendlerweg: alle Arten mit Arbeitsplätzen
import { GOODS } from '../data/goods.js';
import { isPart, accessCells, mainAccess, cellsOf, anchorOf, nbrsOf, atEdge, stationLinked } from './city/cells.js';
import { gridBfs } from './city/gridbfs.js';
export { mainAccess }; // liegt seit dem Paket „Straßen“ in cells.js (Anschlusspflicht des Baugebiets)

/** Produkte fahren zum Lager der Hauptstadt (`'main'`): Werke, deren Ware ein Lager hat (Register js/data/goods.js). */
const PRODUCT_KINDS = WORKS.filter((k) => GOODS[CITY.chain[k].to]?.store);
/** Kennung des Lagers der Hauptstadt im Breitensuche-Feld (Besitzer). Gebäude haben als Besitzer ihren Anker (≥ 0). */
const MAIN = -1;
/** Kennung „Straße am Kartenrand“ im Breitensuche-Feld der Einfuhr (Paket „Import“); Güterbahnhöfe haben ihren Anker (≥ 0). */
const EDGE = -2;
/** Weg ohne Straßenzellen (Lieferung direkt an ein angrenzendes Gebäude, seit Paket „Direkte Lieferung“; seit Paket „Import“ vom
 * Güterbahnhof an ein angrenzendes Werk): Länge 0, Wirkung 1, keine Last. */
const NO_PATH = new Int32Array(0);

/** Zustand je Stadt (WeakMap), nicht im Spielstand. */
const STATE = new WeakMap();

/** Abstand zu 1, ab dem ein Stau-Faktor ohne Last als frei gilt (Rechengenauigkeit, kein Spielwert). */
const FREE_EPS = 1e-4;

/** Gruppen der Breitensuche-Felder, die transportOf anlegt. */
const GROUPS = ['imp', 'res', 'main', 'hall']; // imp: Einfuhrpunkte (Paket „Import“); hall: angeschlossene Lagerhallen (Ausbildung)

/** Ausbildungsgebäude der Stadt (CITY.produces: Kaserne, Fabrikhalle, Heliport, Stellplatz), versorgt über ihren Weg zum Lager (Paket „Straßen“). */
const TRAINERS = new Set(Object.keys(CITY.produces).map((k) => KIND_ID[k]));
/** Flugplatz-Bauten, die ohne Straße auskommen (Paket „Fliegerhorst-Anschluss“): Stellplatz (über die Bahn) und Heliport (über Rollfeld).
 *  Sie werden versorgt, wenn ein Kerosintank oder Munitionslager mit Straßenweg im Umkreis steht (fedNearby). */
const AIRFIELD_TRAINERS = new Set(['stand', 'heliport'].map((k) => KIND_ID[k]));

/**
 * Breitensuche von mehreren Startzellen (Quellen) aus über Straßenzellen (cap > 0), höchstens CITY.transport.maxDist Schritte.
 * `sources`: Array von { cells: Zellenindizes (Straßen am Ziel), owner: Kennung des Ziels }. Liefert { dist, prev, owner } je Zelle:
 * dist −1 = nicht erreichbar, prev −1 bei Quellen, owner = Ziel der nächsten Quelle. `out` (optional) wird wiederverwendet.
 */
function nearestField(c, sources, cap, out = null) {
  const n = c.cols * c.rows;
  const f = out ?? { dist: new Int32Array(n), prev: new Int32Array(n), owner: new Int32Array(n), queue: new Int32Array(n) };
  const { owner } = f;
  // Startzellen: alle Straßenzellen der Quellen in deren Reihenfolge (doppelte zählt gridBfs einmal, die erste Quelle gewinnt)
  const starts = [];
  for (const s of sources) for (const i of s.cells) if (cap[i] > 0) starts.push(i);
  const r = gridBfs(c, starts, (j) => cap[j] > 0, CITY.transport.maxDist, { out: f });
  // Besitzer: Startzellen bekommen die Kennung der ersten Quelle, die sie enthält (rückwärts überschreiben, damit die erste gewinnt;
  // kein Sentinel-Wert, denn Kennungen können negativ sein: MAIN = −1, EDGE = −2). Danach erbt jede Zelle den Besitzer ihres Vorgängers.
  owner.fill(-1);
  for (let s = sources.length - 1; s >= 0; s--) for (const i of sources[s].cells) if (cap[i] > 0) owner[i] = sources[s].owner;
  for (let k = 0; k < r.count; k++) {
    const i = r.queue[k];
    if (r.prev[i] >= 0) owner[i] = owner[r.prev[i]];
  }
  return f;
}

/**
 * Kürzester Weg von einer der Zellen `starts` (Anschluss des Gebäudes) zu seinem Ziel im Feld. Liefert { path, owner } mit path als
 * Int32Array der Straßenzellen (erste = Start, letzte = Ziel-Anschluss), oder null, wenn keine Start-Zelle das Feld erreicht.
 */
function pathFrom(field, starts) {
  let best = -1;
  let bd = Infinity;
  for (const s of starts) {
    const d = field.dist[s];
    if (d >= 0 && d < bd) {
      bd = d;
      best = s;
    }
  }
  if (best < 0) return null;
  const path = new Int32Array(bd + 1);
  let i = best;
  for (let k = 0; k <= bd; k++) {
    path[k] = i;
    i = field.prev[i];
  }
  return { path, owner: field.owner[best] };
}

/** Wirkung eines Weges: kleinster Stau-Faktor auf ihm (leerer Weg: 1, kein Weg (null): 0, es kommt nichts an). */
export function pathEff(tr, path) {
  if (!path) return 0;
  let m = 1;
  for (let k = 0; k < path.length; k++) {
    const f = tr.factor[path[k]];
    if (f < m) m = f;
  }
  return m;
}

/** Last `amount` (Einheiten je s) auf alle Zellen des Weges legen. Kein Weg (null): nichts. Merkt die Zellen in der Liste `active`. */
export function addLoad(tr, path, amount) {
  if (!path) return;
  const { load, on, active } = tr;
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!on[i]) {
      on[i] = 1;
      active[tr.nActive++] = i;
    }
    load[i] += amount;
  }
}

/**
 * Last auf 0 setzen (zu Beginn jedes Schritts). Nur die Zellen der Liste `active` (mit Last oder Stau) tragen etwas, so läuft der
 * Schritt nicht über alle Straßen der Karte.
 */
export function beginLoads(tr) {
  const { load, active } = tr;
  for (let k = 0; k < tr.nActive; k++) load[active[k]] = 0;
}

/** Kleinster Stau-Faktor der Zellen, die in diesem Schritt Last tragen (1 ohne Last). */
export function minFactor(tr) {
  const { load, factor, active } = tr;
  let m = 1;
  for (let k = 0; k < tr.nActive; k++) {
    const i = active[k];
    if (load[i] > 0 && factor[i] < m) m = factor[i];
  }
  return m;
}

/**
 * Stau-Faktor aus Last und Kapazität glätten (Ende des Schritts): Ziel = min(1, cap / Last), f += (Ziel − f) × min(1, dt / smooth).
 * Die Wirkung gilt also erst im nächsten Schritt (eine Runde Verzögerung).
 */
export function settleLoads(tr, dt) {
  const smooth = CITY.transport.smooth;
  const k = smooth > 0 ? Math.min(1, dt / smooth) : 1;
  const { load, factor, active, on } = tr;
  let w = 0;
  for (let m = 0; m < tr.nActive; m++) {
    const i = active[m];
    const L = load[i];
    const cap = tr.cap[i];
    const target = L > cap ? cap / L : 1;
    let f = factor[i] + (target - factor[i]) * k;
    // ohne Last und fast frei: ganz frei und aus der Liste (sonst bliebe der Wert in Float32 knapp unter 1 hängen)
    if (L === 0 && f > 1 - FREE_EPS) f = 1;
    factor[i] = f;
    if (L === 0 && f === 1) on[i] = 0;
    else active[w++] = i;
  }
  tr.nActive = w;
}

/**
 * Straßenzellen am Lager der Hauptstadt: alle Straßen, deren Zellrechteck das Rechteck der Hauptstadt, erweitert um
 * CITY.fobMargin + CITY.cell px, schneidet. Leer ohne Hauptstadt.
 */

/** Neuen Zustand anlegen: Typed Arrays je Zelle, einmal (Feld-Puffer und Last/Stau werden wiederverwendet). */
function newTransport(c) {
  const n = c.cols * c.rows;
  // Stau-Faktor je Zelle: liegt in der Stadt (gespeichert, createTeamCity/migrateCity); fehlt er (Teststädte), eigener Puffer
  const factor = c.congestion?.length === n ? c.congestion : new Float32Array(n).fill(1);
  const fields = {};
  for (const g of GROUPS) fields[g] = { dist: new Int32Array(n), prev: new Int32Array(n), owner: new Int32Array(n), queue: new Int32Array(n) };
  return {
    routes: new Map(),
    imports: new Map(), // Paket „Import“: Werk ↔ nächster Einfuhrpunkt
    stations: [], // angeschlossene Güterbahnhöfe (Anker)
    commute: new Map(),
    shop: new Map(),
    depot: new Map(), // seit v5.35: Kerosintank und Munitionslager ↔ Lager
    store: new Map(), // Lagerhalle ↔ Lager (Paket „Lagerhalle“)
    supply: new Map(), // Paket „Straßen“: Ausbildungsgebäude ↔ Lager (oder Lagerhalle)
    supplyHall: new Set(), // Ausbildungsgebäude, deren Weg zu einer Lagerhalle führt (Paket „Ausbildung an der Lagerhalle“)
    load: new Float32Array(n),
    factor,
    cap: new Float32Array(n),
    list: new Int32Array(0), // Straßenzellen mit Kapazität
    active: new Int32Array(n), // Straßenzellen mit Last oder Stau (die ersten nActive), nur sie rechnet der Schritt
    nActive: 0,
    on: new Uint8Array(n), // 1 = Zelle steht in active
    fields,
  };
}

/**
 * Angrenzende Gebäude von a (Paket „Direkte Lieferung“; seit Paket „Import“: Güterbahnhöfe neben einem Werk): Anker aus `owners`, deren
 * Zellen eine 4er-Nachbarzelle einer Zelle von a haben. Sortiert nach Anker (fest, unabhängig von der Reihenfolge der Suche).
 */
function adjacentOwners(c, a, owners) {
  const mine = cellsOf(c, a);
  const out = [];
  for (const o of owners) {
    if (o === a) continue;
    if (mine.some((j) => nbrsOf(c, j).some((n) => c.kind[n] && anchorOf(c, n) === o))) out.push(o);
  }
  return out.sort((p, q) => p - q);
}

/**
 * Weg vom Gebäude a zum nächsten Ziel der Gruppe; ohne Weg { to: null, path: null, dist: 0 }. Grenzt ein Zielwerk der Gruppe direkt
 * an (`adj`, Anker sortiert), ist das erste davon das Ziel, mit leerem Weg (dist 0).
 */
function routeOf(c, tr, a, group, adj = []) {
  if (adj.length) return { to: adj[0], path: NO_PATH, dist: 0 };
  const hit = pathFrom(tr.fields[group], accessCells(c, a));
  if (!hit) return { to: null, path: null, dist: 0 };
  return { to: hit.owner === MAIN ? 'main' : hit.owner, path: hit.path, dist: hit.path.length };
}

/**
 * Hat ein Kerosintank oder Munitionslager mit Straßenweg zum Lager (depot: Weg je Anker) einen Platz im Umkreis CITY.air.supplyRadius
 * um den Bau a? Dann ist ein Stellplatz oder Heliport versorgt, auch ohne eigene Straße (wie die Jets dort tanken und laden).
 */
function fedNearby(c, a, depot) {
  const e = c.ents?.get(a);
  if (!e) return false;
  const R = CITY.air.supplyRadius * c.cell;
  for (const [i, path] of depot) {
    const s = c.ents.get(i);
    if (path && s?.alive && Math.hypot(s.x - e.x, s.y - e.y) <= R) return true;
  }
  return false;
}

/** Berechnet Wege, Pendler und Stau-Puffer neu (Aufruf aus transportOf). */
function build(game, c, tr) {
  const n = c.cols * c.rows;
  const capRoad = CITY.transport.cap;
  const capMap = CITY.transport.mapCap;
  let count = 0;
  tr.nActive = 0;
  // Mehrspurig (seit v5.38): parallele Straßen bilden ein Band, Kapazität × Spuren je Richtung (CITY.transport.maxLanes)
  const L = laneGrid(c.cols, c.rows, (i) => c.kind[i] === KIND_ID.road || !!c.mapRoads?.[i], CITY.transport.maxLanes);
  tr.lanes = L.lanes;
  for (let i = 0; i < n; i++) {
    const own = c.kind[i] === KIND_ID.road;
    tr.cap[i] = (own ? capRoad : c.mapRoads?.[i] ? capMap : 0) * (L.lanes[i] || 1);
    if (tr.cap[i] > 0) {
      count++;
      // Liste der Zellen mit Last oder Stau neu (auch nach dem Laden eines Spielstands: Stau-Faktor < 1)
      if (tr.on[i] || tr.factor[i] < 1) {
        tr.on[i] = 1;
        tr.active[tr.nActive++] = i;
      }
    } else {
      tr.factor[i] = 1; // keine Straße (mehr): frei
      tr.load[i] = 0;
      tr.on[i] = 0;
    }
  }
  tr.list = new Int32Array(count);
  let m = 0;
  for (let i = 0; i < n; i++) if (tr.cap[i] > 0) tr.list[m++] = i;

  // Quellen: fertige Gebäude (Anker), Wohnen nur bewohnt (Stufe ≥ 1, nicht geflohen)
  const res = [];
  const anchors = []; // fertige Gebäude (Anker)
  const stations = []; // Güterbahnhöfe mit Gleis zum Kartenrand (Paket „Import“)
  const imp = []; // Einfuhrpunkte: eigene Straßen am Kartenrand und Straßen an angeschlossenen Güterbahnhöfen
  const ROAD = KIND_ID.road;
  for (const i of c.list) {
    if (c.kind[i] === ROAD && atEdge(c, i)) imp.push({ cells: [i], owner: EDGE });
    if (isPart(c, i) || !c.level[i]) continue;
    const k = KINDS[c.kind[i] - 1];
    if (k === 'station' && stationLinked(c, i)) {
      stations.push(i);
      imp.push({ cells: accessCells(c, i), owner: i });
    }
    anchors.push(i);
    if (k === 'res' && c.flee[i] === 0) res.push({ cells: accessCells(c, i), owner: i });
  }
  nearestField(c, res, tr.cap, tr.fields.res);
  nearestField(c, imp, tr.cap, tr.fields.imp);
  nearestField(c, [{ cells: mainAccess(game, c), owner: MAIN }], tr.cap, tr.fields.main);
  // Lagerhallen mit Straßenweg zum Lager (Paket „Ausbildung an der Lagerhalle“): Quelle für die Versorgung der Ausbildung
  const halls = anchors.filter((a) => c.kind[a] === KIND_ID.warehouse && pathFrom(tr.fields.main, accessCells(c, a)));
  nearestField(c, halls.map((a) => ({ cells: accessCells(c, a), owner: a })), tr.cap, tr.fields.hall);

  const routes = new Map();
  const imports = new Map();
  const commute = new Map();
  const shop = new Map();
  const depot = new Map();
  const store = new Map();
  const supply = new Map();
  const supplyHall = new Set();
  for (const a of anchors) {
    const k = KINDS[c.kind[a] - 1];
    if (PRODUCT_KINDS.includes(k)) {
      routes.set(a, routeOf(c, tr, a, 'main'));
      // Einfuhr (Paket „Import“): ein Güterbahnhof direkt daneben liefert ohne Straße (Weg der Länge 0), sonst der nächste
      // Einfuhrpunkt über die Straße; ohne Weg null (das Werk bekommt nichts)
      const adj = adjacentOwners(c, a, stations);
      if (adj.length) imports.set(a, { from: adj[0], path: NO_PATH, dist: 0 });
      else {
        const hit = pathFrom(tr.fields.imp, accessCells(c, a));
        imports.set(a, hit ? { from: hit.owner === EDGE ? 'edge' : hit.owner, path: hit.path, dist: hit.path.length } : null);
      }
    }
    if (WORKPLACE_KINDS.includes(k)) commute.set(a, pathFrom(tr.fields.res, accessCells(c, a))?.path ?? null);
    if (k === 'com' || k === 'market') shop.set(a, pathFrom(tr.fields.main, accessCells(c, a))?.path ?? null);
    if (k === 'warehouse') store.set(a, pathFrom(tr.fields.main, accessCells(c, a))?.path ?? null); // Lagerhalle: Zulauf vom Lager (Paket „Lagerhalle“)
    if (k === 'ktank' || k === 'mdepot') depot.set(a, pathFrom(tr.fields.main, accessCells(c, a))?.path ?? null); // Fliegerhorst (seit v5.35); nur über Straßen (Paket „Fliegerhorst-Anschluss“)
    if (TRAINERS.has(c.kind[a])) {
      // Ausbildung (Paket „Straßen“): Weg zum Lager; seit Paket „Ausbildung an der Lagerhalle“ der kürzere zum Lager oder zu einer
      // angeschlossenen Lagerhalle (sie bringt das Material näher an die Front)
      const toMain = pathFrom(tr.fields.main, accessCells(c, a))?.path ?? null;
      const toHall = halls.length ? pathFrom(tr.fields.hall, accessCells(c, a))?.path ?? null : null;
      const hall = !!toHall && (!toMain || toHall.length < toMain.length);
      supply.set(a, hall ? toHall : toMain);
      if (hall) supplyHall.add(a);
    }
  }
  // Stellplatz und Heliport ohne Straßenweg: versorgt über einen Kerosintank oder Munitionslager mit Straßenweg im Umkreis (Weg 0, keine Last)
  for (const a of anchors) if (AIRFIELD_TRAINERS.has(c.kind[a]) && supply.get(a) == null && fedNearby(c, a, depot)) supply.set(a, NO_PATH);
  tr.routes = routes;
  tr.imports = imports;
  tr.stations = stations;
  tr.commute = commute;
  tr.shop = shop;
  tr.depot = depot;
  tr.store = store;
  tr.supply = supply;
  tr.supplyHall = supplyHall;
}

/**
 * Transportzustand der Stadt eines Teams (lazy, je Stadt eine WeakMap). Neu berechnet nur, wenn sich c.ver (Bau, Abriss, Wachstum,
 * Ruinen, seit v5.20 auch Flucht und Rückkehr der Bewohner), die Hauptstadt oder c.mapRoads ändern. Die Wege hängen nur vom Stand der
 * Stadt ab: ein geladener Spielstand ergibt dieselben Wege, und Aufrufe der Anzeige ändern nichts am Spiel.
 * Liefert { routes, imports, stations, commute, shop, load, factor, cap, list, active, nActive }:
 *   routes:  Map<Anker, { to: 'main' | null, path: Int32Array | null, dist }>  Lieferweg je Werk zum Lager der Hauptstadt
 *   imports: Map<Anker, { from: 'edge' | Anker des Güterbahnhofs, path, dist } | null>  Einfuhrweg je Werk zum nächsten Einfuhrpunkt
 *            (Paket „Import“; null = kein Einfuhrpunkt erreichbar)
 *   stations: Anker der Güterbahnhöfe mit Gleis zum Kartenrand
 *   commute: Map<Anker, Int32Array | null>  Pendlerweg je Arbeitsstätte (null = kein Wohnen erreichbar)
 *   shop:    Map<Anker, Int32Array | null>  Weg Gewerbe/Markt → Lager
 *   depot:   Map<Anker, Int32Array | null>  Weg Kerosintank/Munitionslager → Lager (seit v5.35)
 *   store:   Map<Anker, Int32Array | null>  Weg Lagerhalle → Lager (Paket „Lagerhalle“)
 *   supply:  Map<Anker, Int32Array | null>  Weg Ausbildungsgebäude → Lager oder Lagerhalle (supplyHall; Stellplatz über Rollfeld und Bahn)
 *   load, factor, cap: Float32Array je Stadtzelle (factor = c.congestion); list: Int32Array der Straßenzellen;
 *   active (die ersten nActive): Straßenzellen mit Last oder Stau
 * `dist` = Anzahl der Straßenzellen auf dem Weg (0, wenn es kein Ziel gibt).
 */
export function transportOf(game, c) {
  const main = game.mainFob(c.team);
  let st = STATE.get(c);
  if (!st) {
    st = { tr: newTransport(c), built: false, ver: -1, main: null, mapRoads: undefined };
    STATE.set(c, st);
  }
  const fresh = st.built && st.ver === c.ver && st.main === main && st.mapRoads === c.mapRoads;
  if (!fresh) {
    build(game, c, st.tr);
    st.built = true;
    st.ver = c.ver;
    st.main = main;
    st.mapRoads = c.mapRoads;
  }
  return st.tr;
}

/**
 * Anzeige eines Gebäudes (nur lesen): { to: 'Lager' | null, dist, eff, commuteEff, noHome, importFrom, importDist, importEff, linked }.
 * eff = Wirkung des Lieferwegs (0 ohne Weg), commuteEff = Wirkung des Pendlerwegs (0 ohne Wohnen; 1, wenn das Gebäude kein Arbeitsplatz ist),
 * noHome = Arbeitsstätte ohne erreichbare Wohnung. Einfuhr (Paket „Import“, nur Werke): importFrom 'Kartenrand' | 'Güterbahnhof' |
 * null (kein Einfuhrpunkt erreichbar; undefined bei Gebäuden ohne Einfuhr), importDist Straßenzellen, importEff Stau-Faktor des Wegs.
 * linked: Güterbahnhof mit Gleis zum Kartenrand (true/false; undefined bei anderen Gebäuden).
 */
export function transportInfo(game, c, anker) {
  const tr = transportOf(game, c);
  const r = tr.routes.get(anker);
  let to = null;
  let dist = 0;
  let eff = 0;
  if (r && r.to !== null) {
    to = 'Lager';
    dist = r.dist;
    eff = pathEff(tr, r.path);
  }
  let commuteEff = 1;
  let noHome = false;
  if (tr.commute.has(anker)) {
    const p = tr.commute.get(anker);
    noHome = p === null;
    commuteEff = pathEff(tr, p);
  }
  const out = { to, dist, eff, commuteEff, noHome };
  if (tr.imports.has(anker)) {
    const im = tr.imports.get(anker);
    out.importFrom = im ? (im.from === 'edge' ? 'Kartenrand' : 'Güterbahnhof') : null;
    out.importDist = im ? im.dist : 0;
    out.importEff = im ? pathEff(tr, im.path) : 0;
  }
  if (KINDS[c.kind[anker] - 1] === 'station') out.linked = tr.stations.includes(anker);
  return out;
}


/**
 * Versorgung eines Ausbildungsgebäudes der Stadt (Paket „Straßen“, Teil 2; nur lesen): { path, dist, v, eff, rate, hall }. dist = Straßenzellen
 * des Wegs zum Lager bzw. zur Lagerhalle (hall), v = Versorgungsgrad nach der Weglänge (CITY.supply), eff = Stau-Faktor des Wegs, rate = v × eff = Tempo der
 * Ausbildung. Ohne Weg (oder ohne fertiges Gebäude) rate 0.
 */
export function supplyOf(game, c, a) {
  const tr = transportOf(game, c);
  const path = tr.supply.get(a) ?? null;
  if (!path) return { path: null, dist: 0, v: 0, eff: 0, rate: 0, hall: false };
  const S = CITY.supply;
  const dist = path.length;
  const v = Math.max(S.min, 1 - S.perCell * Math.max(0, dist - S.free));
  const eff = pathEff(tr, path);
  return { path, dist, v, eff, rate: v * eff, hall: tr.supplyHall.has(a) };
}

/** Tempo der Ausbildung im Gebäude e (Ziel-Entity der Stadt; andere Gebäude: 1). */
export function trainRate(game, e) {
  if (e.type !== 'city') return 1;
  const c = game.city?.[e.team];
  return c ? supplyOf(game, c, e.cityCell).rate : 1;
}
