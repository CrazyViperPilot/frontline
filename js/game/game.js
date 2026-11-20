// Spielzustand, Befehle (issue), Platzierung, Lager, Spawn, Aufräumen und Sieg (docs/archiv/verlauf.md §4, §5, §11). Kein DOM.
import { BALANCE } from '../data/balance.js';
import { UNITS } from '../data/units.js';
import { makeRng } from '../core/rng.js';
import { generateMap } from './map.js';
import { terrainGrid } from './mapdata.js';
import { reliefOf } from './relief.js';
import { createUnit, createBuilding, defineAmmo } from './entities.js';
import { Fog } from './fog.js';
import { updateEconomy, smoothIncome } from './economy.js';
import { createCity, ownCells } from './city/create.js';
import { updateCity } from './city/economy.js';
import { cityNoise } from './city/state.js';
import { cityTrainers } from './city/query.js';
import { updateMovement, nearestPassable, separate } from './movement.js';
import { updateCombat } from './combat.js';
import { enemiesOf } from './teams.js';
import { MODES, modeOf } from './modes.js';
import { createHot, updateHot } from './hotzone.js';
import { updateLogistics, cargoSum, storeCapOf } from './logistics.js';
import { updateConstruction } from './construction.js';
import { updateTowers, ejectCrew } from './tower.js';
import { createHouses, updateGarrison, dropOccupant } from './garrison.js';
import { createCrates, updateCrates, updateCrateIntel } from './crates.js';
import { createProps, updateProps, concealed } from './props.js';
import { createScars, updateScars, updateScarIntel, addUnitWreck, addBuildingWreck, clearWrecksUnder } from './scars.js';
import { createAnimals, updateAnimals } from './animals.js';
import { updateFormations } from './formation.js';
import { updateCommanders, commanderFallen } from './commander.js';
import { createWeather, updateWeather } from './weather.js';
import { updateAbilities } from './abilities.js';
import { updateMedics } from './medic.js'; // Sanitäter heilen (Paket E1)
import { updateRecovery } from './recovery.js'; // Bergepanzer repariert Fahrzeuge (Paket E7)
import { updateFpv } from './fpv.js'; // Kamikazedrohnen explodieren am Ziel (Paket E11)
import { createMines, updateMines } from './mines.js'; // Pionier-Minen (Paket E8)
import { createResearch, updateResearch } from './research.js';
import { createBridges, updateBridges, updateBridgeLayers, bridgeUnder } from './river.js';
import { createRoads } from './roads.js';
import { updateAircraft } from './aircraft.js';
import { updateScramble } from './scramble.js';
import { updateAirstrike } from './airstrike.js';
import { updateParadrop } from './paradrop.js'; // C-130 setzt Fallschirmjäger ab (Paket E13 b)
import { updateHelis } from './helipad.js';
import { updateDig } from './excavator.js';
import { updateRoadWar } from './roadwar.js';
import { commandOf, OWN_DRIVERS } from './commands.js';
import { STOCK_KEYS, covers, canPlace, gatePreview, deploySpot } from './cmd/build.js';
import { earn, spend } from './ledger.js';

const TILE = BALANCE.map.tile;
const W = BALANCE.map.width;
const H = BALANCE.map.height;
const NOISY = new Set(['tracer', 'shell', 'explosion', 'muzzle']); // Effekte, die Stadtbewohner in der Konfliktzone vertreiben (cityNoise in js/game/city/state.js)
const EFFECT_LIFE = BALANCE.effects.life; // Lebensdauer je Effektart (s)
const SHORTAGE_TEXT = {
  mun: 'Einheiten ohne Munition',
  fuel: 'Fahrzeuge ohne Treibstoff',
  kero: 'Luftfahrzeuge ohne Kerosin (Stadtlager leer: Kerosin-Raffinerie bauen oder am Markt kaufen)', // seit v5.20, nur mit Stadt
};

const zeroRes = () => ({ money: 0, bm: 0, mun: 0, fuel: 0 });

const START_STEP = BALANCE.startLayout.step; // Rastergröße der Startplätze (px)

/**
 * Startaufstellung um die Hauptstadt nach Truppengattung getrennt (BALANCE.startLayout): jede Gattung hat einen Ankerpunkt
 * (Winkel zur Kartenmitte, Abstand zur FOB) und füllt von dort aus die nächsten freien passierbaren Plätze im Raster,
 * nie überlappend. Beide Teams nutzen dieselbe Anordnung relativ zur Kartenmitte. Liefert die Mittelpunkte in der Reihenfolge von `types`.
 */
function startFormation(grid, team, cx, cy, types) {
  let fx = W / 2 - cx;
  let fy = H / 2 - cy;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  const layout = BALANCE.startLayout;
  const R = layout.maxDist;
  // Kandidaten in Ringen minDist–R px um die FOB (FOB-Mitte liegt im Gebäude und ist nicht passierbar)
  const cands = [];
  for (let dy = -R; dy <= R; dy += START_STEP) {
    for (let dx = -R; dx <= R; dx += START_STEP) {
      const r = Math.hypot(dx, dy);
      if (r < layout.minDist || r > R) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!grid.passable(grid.toCell(x), grid.toCell(y), team)) continue;
      cands.push({ x, y });
    }
  }
  const placed = [];
  for (const type of types) {
    const g = layout.groups.find((o) => o.types.includes(type)) || layout.fallback;
    const rad = UNITS[type].radius;
    const a = (g.angle * Math.PI) / 180;
    const ax = cx + g.dist * (fx * Math.cos(a) - fy * Math.sin(a));
    const ay = cy + g.dist * (fx * Math.sin(a) + fy * Math.cos(a));
    let best = null;
    let bestD = Infinity;
    for (const c of cands) {
      const d = Math.hypot(c.x - ax, c.y - ay);
      if (d >= bestD) continue;
      if (placed.some((p) => Math.hypot(c.x - p.x, c.y - p.y) < rad + p.rad + Math.max(g.gap, p.gap))) continue;
      best = c;
      bestD = d;
    }
    placed.push(best ? { x: best.x, y: best.y, rad, gap: g.gap } : null);
  }
  return placed.map((p) => (p ? { x: p.x, y: p.y } : null));
}
const fail = (reason) => ({ ok: false, reason });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** Felder mit Koordinaten in Befehlen (Weltpunkt x/y, Linie x1…y2, Turmziel tx/ty, Stadtzellen c0…r1); game.issue prüft sie. */
// Befehle, deren x/y keine Weltpunkte sind (Stadtzellen) oder die kein Ziel auf der Karte haben: keine Prüfung der Viertel-Sperre
const WORLD_FREE = new Set(['city', 'cityUpgrade', 'cityConnect', 'trade', 'train', 'cancelTrain', 'research', 'cancelResearch', 'setDifficulty', 'debug', 'spawnAt']);
const COORD_FIELDS = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'tx', 'ty', 'c0', 'r0', 'c1', 'r1'];

/** Zähler je Team für den Endbildschirm (seit v5.65). Reine Anzeige: die Simulation liest sie nicht. */
export function newStats() {
  return { trained: 0, lost: 0, kills: 0, buildingsLost: 0, buildingsKilled: 0, peakUnits: 0 };
}

export class Game {
  /** `map`: fertige Karte (Editor/gespeichert, siehe mapdata.js); ohne sie wird sie aus dem Seed erzeugt. */
  /** weather: 'off' | 'random' | 'summer' | 'autumn' | 'winter' (Wetter und Jahreszeit, weather.js; ohne Angabe aus). */
  /** research: Forschungsstufen (research.js; ohne Angabe aus: alle Einheiten frei, keine Verbesserungen). */
  /** buildRules: Baugebiet der Stadt (seit v5.78): Gebäude nur im eigenen Gebiet, auf erkundetem Gelände, nicht nahe dem Feind und nicht in der Konfliktzone (js/game/city/cells.js `buildWhy`). Ohne Angabe aus. */
  /** river: Zufallskarte mit Flüssen, Brücken und Furten (river.js; ohne Angabe aus). Fertige Karten bringen ihre eigenen mit. */
  constructor({ seed = 1, winPoints = BALANCE.winPoints, startMoney = BALANCE.startRes.money, map = null, weather = 'off', research = false, river = false, buildRules = false, debug = false, conquest = false, players = 2, tickets = null } = {}) {
    this.seed = seed;
    this.debug = !!debug; // ?debug=1: erlaubt den Befehl `debug` (Geld, festes Wetter), seit v5.58
    this.rng = makeRng(seed);
    // conquest: Modus Eroberung (js/game/conquest.js; ohne Angabe aus, Regel 9); players: 2 bis 4 Teams (mehr als 2 nur in der Eroberung)
    const mode = MODES[conquest ? 'conquest' : 'classic']; // Modus-Register js/game/modes.js
    const teamCount = mode.teamCount(players);
    this.map = map ?? generateMap(seed, { river, players: teamCount });
    if (this.map.spawns.length < teamCount) throw new Error(`Karte hat nur ${this.map.spawns.length} Startpunkte`);
    this.relief = reliefOf(this.map); // Höhengelände oder null (flache Karte); im Spielstand nur das Grobraster (savegame.js)
    // Raster: Hindernisse, Häuser, Bäume, steile Hänge, Seen und Flüsse (Furten passierbar), Hangkosten; im Spielstand nur der Unterschied dazu
    this.grid = terrainGrid(this.map, this.relief);
    createProps(this); // Zustand der Props (Zäune, Mauern …): Trefferpunkte, heil/Trümmer/weg (props.js)

    this.time = 0;
    this.nextId = 1;
    this.entities = new Map();
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.effects = [];
    createBridges(this); // Brücken über die Flüsse (Fahrbahn offen, zerstörbar)
    createRoads(this); // Stadtstraßen der Karte: Zonenstraßen und Brückenfahrbahnen im Stadtraster (seit v5.03)
    createScars(this); // Wracks und Krater (sichtbarer Schaden)
    this.formations = new Map(); // Formation → { id, speed, ids } (formation.js)
    this.formationSeq = 0;
    this.events = [];
    this.winner = null;
    this.hitBy = -1; // Team des Schützen des gerade abgewickelten Treffers (combat.hit), -1 = unbekannt
    this.winReason = null;
    this.winPoints = winPoints;
    this.buildRules = !!buildRules; // Baugebiet der Stadt (seit v5.78; Spielstand: Feld wird mitgespeichert)
    this.fogTimers = Array.from({ length: teamCount }, (_, t) => (t * BALANCE.fogInterval) / teamCount); // Takt des Nebels je Team (Team 1 versetzt, seit v5.93)
    this.statTimer = 0; // Takt der Heeresgröße für die Statistik (sampleArmy, einmal je s)
    this.pathWork = 0; // untersuchte Zellen der Wegsuche seit dem letzten Schritt (Wegbudget, pathplan.js)
    this.pathBacklog = false; // warten Einheiten auf ihren Weg (neue Anfragen stellen sich dann an)? (pathplan.js)
    this.pathSeq = 0; // Reihenfolge der wartenden Wege
    this.pathLong = null; // laufende lange Wegsuche einer Einheit { id, sx, sy, x, y, done, hash } (pathplan.js)
    this.pathShare = []; // in diesem Schritt gefundene Wege zum Teilen (pathplan.js)
    this.logiTimer = 0; // Takt des Nachfüllens (logistics.js)
    this.consTimer = 0; // Takt der automatischen Bauzuweisung (construction.js)
    this.teams = Array.from({ length: teamCount }, (_, id) => id).map((id) => {
      const team = {
        id,
        name: BALANCE.teamNames[id],
        color: BALANCE.teamColors[id],
        res: { money: startMoney }, // bm/mun/fuel: unten als Getter (Summe der Front-Lager ohne Hauptstadt)
        income: zeroRes(),
        rate: zeroRes(),
        flow: { bm: 0, mun: 0, fuel: 0 }, // Verbrauch aus Lagern je s (Nachfüllen)
        points: 0,
        pointProgress: 0,
        used: { mun: 0, fuel: 0 }, // Summe des Verbrauchs (Statistik)
        earned: 0, // Geld aus Prämien und Bau (reward)
        stats: newStats(), // Zähler für den Endbildschirm (Statistik, seit v5.65)
        warnAt: {}, // Zeitpunkt der letzten Meldung je Schlüssel (notify)
        incomeMult: 1,
        isAI: false,
        lastWarn: -1e9,
        reinforceTimer: 0, // Zeit seit dem letzten Soldaten-Nachschub (economy.js)
      };
      this.bindStocks(team);
      return team;
    });
    createResearch(this, research); // Stufen und Verbesserungen je Team (team.tech)
    this.zone = { ...this.map.zone, owner: -1, contested: false, counts: this.teams.map(() => 0), weight: this.teams.map(() => 0), bar: { team: -1, p: 0 } };
    this.conquest = null; // Zustand der Eroberung (conquest.js) oder null; daraus leitet sich `mode` ab
    mode.create(this, { tickets }); // tickets: Start-Tickets der Eroberung (ohne Angabe Siegpunkte × ticketMul)
    // Flaggen, Tickets, gesperrte Viertel (nur im Modus Eroberung)
    this.hot = createHot(this);
    this.fog = this.teams.map(() => new Fog(W, H));

    // Startzustand: je Team die Hauptstadt auf dem Spawn (unendlicher Vorrat), Startunits als Formation davor
    for (let t = 0; t < teamCount; t++) {
      const sp = this.map.spawns[t];
      this.spawnBuilding('fob', t, this.grid.toCell(sp.x) - 1, this.grid.toCell(sp.y) - 1, { built: true, main: true });
    }
    createHouses(this); // Stadthäuser zum Besetzen (Häuserkampf)
    createCity(this); // Zonenstadt je Team (seit Plan „Stadt ist Kern“ immer), Hauptstadt mit Startlager
    // Startunits erst nach dem Startviertel aufstellen: sonst schöbe es verdrängte Einheiten auf einen Punkt (occupyCell)
    for (let t = 0; t < teamCount; t++) {
      const sp = this.map.spawns[t];
      const spots = startFormation(this.grid, t, sp.x, sp.y, BALANCE.startUnits);
      BALANCE.startUnits.forEach((type, i) => {
        const p = spots[i] || nearestPassable(this.grid, sp.x, sp.y, t) || sp;
        this.spawnUnit(type, t, p.x, p.y);
      });
    }
    createCrates(this); // Versorgungskisten der Karte
    createMines(this); // Pionier-Minen (Paket E8)
    createAnimals(this); // Rehe und Wildschweine (nur Optik)
    createWeather(this, weather); // Jahreszeit und Wetter (eigener Zufall)
    this.updateFog();
  }

  // ---- Zustand und Hilfen -------------------------------------------------------

  /** Lesbare Summe über alle fertigen eigenen FOB-Lager (team.res.bm/mun/fuel); nie direkt schreiben. */
  bindStocks(team) {
    for (const k of STOCK_KEYS) {
      Object.defineProperty(team.res, k, { enumerable: true, configurable: true, get: () => this.stockOf(team.id, k) });
    }
  }

  /** Nach dem Laden eines Spielstands (core/snapshot.js übergeht Getter): Lagersummen und `ammo` der Einheiten wieder anlegen. */
  restoreAccessors() {
    for (const team of this.teams) this.bindStocks(team);
    for (const u of this.units) defineAmmo(u, u.def);
    // Statistik fehlt in Ständen vor v5.65: Felder mit 0 ergänzen (SAVE_FORMAT unverändert)
    for (const team of this.teams) {
      team.stats = { ...newStats(), ...team.stats };
      team.earned = team.earned || 0;
    }
    this.statTimer = this.statTimer || 0;
    this.fogTimers ??= [0, BALANCE.fogInterval / 2];
    if (!this.propSt) createProps(this); // Stände vor den Props
    this.mode.restore(this); // Eroberung: Viertel-Sperre wieder ins Wegeraster hängen // Stände vor v5.93 hatten einen gemeinsamen fogTimer
    // Ruinenliste fehlt in Ständen vor v5.66: aus den eingestürzten Häusern neu aufbauen
    if (!this.ruins) this.ruins = (this.houses || []).filter((h) => h.ruined);
    // Nachrüstungen für ältere Stände (Straßen, Forschungsbaum, Stadt, FOB-Baustellen) gibt es seit v5.56 nicht mehr: Stände eines
    // anderen SAVE_FORMAT laden nicht (savegame.js). Ausnahme: das Ausgangslager der Werke (seit v5.69) fehlt in Ständen davor, leer ergänzen.
    for (const c of this.city) {
      c.out ??= new Float32Array(c.kind.length);
      c.workOut ??= new Float32Array(c.kind.length); // seit v5.70: Ausstoß je s am Anker (leer in älteren Ständen)
      c.pickClaim ??= new Uint8Array(c.kind.length);
      if (this.conquest && !c.own) c.own = ownCells(this, c.team, c.cols, c.rows); // Stände vor v5.167
    }
  }

  newId() {
    return this.nextId++;
  }

  /** Lebende Entity mit dieser ID oder null. */
  getEntity(id) {
    if (id === null || id === undefined) return null;
    const e = this.entities.get(id);
    return e && e.alive ? e : null;
  }

  /** Ereignis: team = Empfänger (-1 = alle). */
  message(team, text, x = null, y = null) {
    this.events.push({ type: 'message', team, text, x, y });
  }

  /** Meldung an alle Gegner von `team` (bei zwei Teams: an das andere). */
  messageFoes(team, text, x = null, y = null) {
    for (const t of enemiesOf(this, team)) this.message(t.id, text, x, y);
  }

  /** Richtung „zum Gegner“: bei zwei Teams dessen Startpunkt, in der Eroberung die ferne Seite der Zone (dorther kommen die Gegner). */
  foeSpawn(team) {
    return this.mode.foeSpawn(this, team);
  }

  /** Spielart der Partie (Modus-Register js/game/modes.js): Haken für alles, worin sich klassisch und Eroberung unterscheiden. */
  get mode() {
    return modeOf(this);
  }

  /** Einheitenlimit je Team (Eroberung: nach Spielerzahl). */
  get slotCap() {
    return this.mode.slotCap(this);
  }

  /**
   * Meldung mit Drosselung: je Schlüssel und Team höchstens alle `interval` s (Standard shortageWarn).
   */
  notify(team, key, text, interval = BALANCE.shortageWarn, x = null, y = null) {
    const t = this.teams[team];
    const last = t.warnAt[key] ?? -1e9;
    if (this.time - last < interval) return;
    t.warnAt[key] = this.time;
    this.message(team, text, x, y);
  }

  /** Mangelmeldung für Munition oder Treibstoff (gedrosselt). */
  shortage(team, key) {
    this.notify(team, key, SHORTAGE_TEXT[key]);
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** `snd`: Hinweis für den Ton (ui/Sound): Waffen-ID, Rüstungsklasse eines Gefallenen oder 'building'; die Simulation wertet ihn nicht aus. */
  addEffect(type, x, y, team = -1, x2 = x, y2 = y, snd = null) {
    this.effects.push({ type, x, y, x2, y2, team, snd, t: 0, life: EFFECT_LIFE[type] ?? BALANCE.effects.lifeDefault });
    if (NOISY.has(type)) {
      cityNoise(this, x, y); // Stadt: Bewohner der Konfliktzone fliehen vor Schüssen und Einschlägen
      if (x2 !== x || y2 !== y) cityNoise(this, x2, y2);
    }
  }

  /** Eigene Entity (immer sichtbar, auch im Nebel). */
  alwaysVisible(team, e) {
    return e.team === team;
  }

  isVisible(team, x, y) {
    return this.fog[team].isVisible(x, y);
  }

  /**
   * Sieht `team` die Entity e? Eigene immer; fremde, wenn die Zelle im Sichtfeld liegt. Getarnte Einheiten (def.stealth) zusätzlich nur,
   * wenn eine eigene Einheit oder ein fertiges Gebäude des Teams näher als stealth.detectRange steht oder sie gerade geschossen haben.
   */
  sees(team, e) {
    if (this.alwaysVisible(team, e)) return true;
    if (e.kind === 'house') return e.occupants.some((o) => this.sees(team, o)); // besetztes Haus: wenn ein Besatzer erkannt ist
    if (!this.fog[team].isVisible(e.x, e.y)) return false;
    if (e.kind !== 'unit') return true; // Nicht-Einheiten (Granaten, Gebäude …) zuerst: Granaten haben kein def
    // getarnt: Scharfschütze (def.stealth) immer, Aufklärungsfahrzeug (def.stillCamo) nach so vielen Sekunden Stillstand
    // unter einem Tarnnetz (props.js) wie ein Scharfschütze getarnt
    if (!e.def?.stealth && !(e.def?.stillCamo && (e.still || 0) >= e.def.stillCamo) && !(e.def && !e.def.air && concealed(this, e.x, e.y))) return true;
    if (this.time < (e.revealedUntil || 0)) return true;
    const r2 = BALANCE.stealth.detectRange ** 2;
    for (const u of this.units) if (u.alive && u.team === team && (u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= r2) return true;
    for (const b of this.buildings) if (b.alive && b.built && b.team === team && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 <= r2) return true;
    return false;
  }

  /** Geländehöhe unter einer Entity (Wasseroberfläche bei Seen, Fahrbahn auf Brücken); 0 auf flachen Karten. */
  groundHeight(e) {
    if (!this.relief) return 0;
    const b = this.bridges.length && !(e.kind === 'unit' && e.def.air) ? bridgeUnder(this, e.x, e.y) : null;
    return b ? b.deckH : this.relief.displayAt(e.x, e.y);
  }

  isExplored(team, x, y) {
    return this.fog[team].isExplored(x, y);
  }

  updateFog() {
    for (let t = 0; t < this.teams.length; t++) this.fog[t].update(this, t);
    updateCrateIntel(this);
    updateScarIntel(this);
  }

  /** Lebende Entities, deren Mittelpunkt im Kreis liegt (Gebäude: plus halbe Größe). */
  query(x, y, r, filter = null) {
    const out = [];
    for (const list of [this.units, this.buildings]) {
      for (const e of list) {
        if (!e.alive) continue;
        const rr = e.kind === 'building' ? r + (Math.max(e.w, e.h) * TILE) / 2 : r;
        if (dist(e.x, e.y, x, y) > rr) continue;
        if (filter && !filter(e)) continue;
        out.push(e);
      }
    }
    return out;
  }

  // ---- Lager, Zahlung, Versorgung ----------------------------------------------------

  /** Summe einer Sorte über die Lager aller fertigen eigenen FOBs außer der Hauptstadt (Getter von team.res: das Front-Lager). */
  stockOf(team, k) {
    let sum = 0;
    for (const b of this.buildings) {
      if (b.alive && b.built && b.team === team && b.type === 'fob' && !b.main) sum += b.store[k];
    }
    return sum;
  }

  /** Hauptstadt des Teams (lebend) oder null. */
  mainFob(team) {
    return this.buildings.find((b) => b.alive && b.team === team && b.main) ?? null;
  }

  /**
   * Testhilfe: setzt das Lager der ersten fertigen FOB ohne Hauptstadt auf {bm, mun, fuel} (fehlende Sorten = 0)
   * und leert die übrigen Front-Lager. Die Hauptstadt bleibt unverändert (ihr Lager füllen die Werke der Stadt).
   */
  setStock(team, vals) {
    const fobs = this.buildings.filter((b) => b.alive && b.built && b.team === team && b.type === 'fob' && !b.main);
    fobs.forEach((f, i) => {
      for (const k of STOCK_KEYS) f.store[k] = i === 0 ? vals[k] || 0 : 0;
    });
  }

  /** Eigene fertige FOBs, deren Bauradius (x, y) enthält. */
  fobsInRadius(team, x, y) {
    const R = BALANCE.fob.buildRadius;
    return this.buildings.filter(
      (b) => b.alive && b.built && b.team === team && b.type === 'fob' && dist(b.x, b.y, x, y) <= R,
    );
  }

  /**
   * Zahler für Kosten an (x, y): nächste fertige eigene FOB, deren Bauradius (x, y) enthält und deren Lager
   * die Kosten (bm/mun/fuel) deckt. null, wenn keine.
   */
  payerFor(team, x, y, cost) {
    const R = BALANCE.fob.buildRadius;
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (!(b.alive && b.built && b.team === team && b.type === 'fob')) continue;
      const d = dist(b.x, b.y, x, y);
      if (d > R || d >= bestD || !covers(b.store, cost)) continue;
      best = b;
      bestD = d;
    }
    return best;
  }

  /** Eigener LKW mit Ladung für Kosten, höchstens truckSupplyRange von (x, y) entfernt (Mauer außerhalb der FOB). */
  truckPayer(team, x, y, cost) {
    const R = BALANCE.logistics.truckSupplyRange;
    let best = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (!(u.alive && u.team === team && u.type === 'truck')) continue;
      const d = dist(u.x, u.y, x, y);
      if (d > R || d >= bestD || !covers(u.cargo, cost)) continue;
      best = u;
      bestD = d;
    }
    return best;
  }

  /** Erste fertige eigene FOB nahe (x, y) (Erstattung, falls der Zahler tot ist). */
  nearestFob(team, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (!(b.alive && b.built && b.team === team && b.type === 'fob')) continue;
      const d = dist(b.x, b.y, x, y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  /** Versorger eines Gebäudes (Förderanlage, Mörser, Flugabwehr): nächste fertige eigene FOB, wenn ihr Bauradius es enthält. */
  supplierOf(b) {
    const f = this.nearestFob(b.team, b.x, b.y);
    return f && dist(f.x, f.y, b.x, b.y) <= BALANCE.fob.buildRadius ? f : null;
  }

  /** Begründung, warum die Sorten für (x, y) nicht bezahlt werden können. */
  stockReason(team, x, y, cost) {
    const fobs = this.fobsInRadius(team, x, y);
    if (!fobs.length) return 'Kein FOB-Lager in Reichweite';
    const miss = STOCK_KEYS.filter((k) => (cost[k] || 0) > 0 && !fobs.some((f) => f.store[k] >= cost[k])).map(
      (k) => BALANCE.resNames[k],
    );
    if (miss.length) return `FOB-Lager: zu wenig ${miss.join(', ')}`;
    return 'FOB-Lager: keine einzelne FOB deckt alle Kosten';
  }

  missingMoney() {
    return `Zu wenig ${BALANCE.resNames.money}`;
  }

  /** Geld (globaler Vorrat). Sorten werden über payerFor/Lager bezahlt. */
  canAfford(team, cost) {
    return this.teams[team].res.money >= (cost.money || 0);
  }

  /** Geld abziehen; why = Zweck im Kassenbuch (ledger.js OUT_KEYS). */
  pay(team, cost, why = 'build') {
    spend(this.teams[team], why, cost.money || 0);
  }

  /** Geld-Erstattung (nur money; Sorten gehen über refundStock); mindert die Ausgaben des Zwecks why. */
  refund(team, cost, factor = 1, why = 'build') {
    spend(this.teams[team], why, -(cost.money || 0) * factor);
  }

  /**
   * Erstattet Sorten an den Zahler `payerId` (eigene Entity mit Lager). Ist er tot oder fremd,
   * geht es an die nächste eigene FOB bei (x, y); ohne FOB verfällt es. Lager-Obergrenze wird beachtet.
   */
  refundStock(team, payerId, cost, factor, x, y) {
    let target = payerId !== null && payerId !== undefined ? this.getEntity(payerId) : null;
    if (target && target.team !== team) target = null;
    if (!target) target = this.nearestFob(team, x, y);
    if (!target) return;
    const stock = target.kind === 'building' ? target.store : target.cargo;
    for (const k of STOCK_KEYS) {
      const amt = (cost[k] || 0) * factor;
      if (!(amt > 0)) continue;
      const room = target.kind === 'building' ? storeCapOf(target) - stock[k] : BALANCE.logistics.truckCapacity - cargoSum(stock);
      stock[k] += Math.max(0, Math.min(amt, room));
    }
  }

  // ---- Entities -----------------------------------------------------------------

  spawnUnit(type, team, x, y) {
    const id = this.newId();
    const u = createUnit(id, type, team, x, y);
    this.entities.set(id, u);
    this.units.push(u);
    return u;
  }

  /** Gebäude an Zelle (cx, cy) anlegen und Fußabdruck belegen. Ohne Kostenprüfung (für Befehle und Tests). */
  spawnBuilding(type, team, cx, cy, { built = true, main = false, payerId = null, leaf = null, axis = null } = {}) {
    const id = this.newId();
    const b = createBuilding(id, type, team, cx, cy, TILE);
    if (leaf !== null) {
      b.leaf = leaf; // Tor (2 Felder): 0 = Hälfte bei kleinerem x bzw. y, 1 = die andere
      b.axis = axis; // 'x' oder 'y': Richtung des Paars (ältere Tore ohne leaf sind Einzelfelder)
    }
    if (main) b.main = true; // Hauptstadt: Lager und Ausbildung setzt createCity (Startlager, Truppen bildet die Stadt aus)
    b.payerId = payerId;
    if (built) {
      b.built = true;
      b.progress = 1;
      b.hp = b.maxHp;
    }
    this.grid.occupy(b);
    this.entities.set(id, b);
    this.buildings.push(b);
    clearWrecksUnder(this, b);
    return b;
  }

  // ---- Platzierung --------------------------------------------------------------
  /** Bauplatz prüfen: Regeln in js/game/cmd/build.js (canPlace); hier für KI, UI und Tests. */
  canPlace(team, type, x, y, opts) {
    return canPlace(this, team, type, x, y, opts);
  }

  /** Vorschau eines Tors (js/game/cmd/build.js, gatePreview); für die Spieler-Steuerung. */
  gatePreview(team, x, y, opts) {
    return gatePreview(this, team, x, y, opts);
  }

  /** Platz für ein aufgebautes Gebäude (js/game/cmd/build.js, deploySpot); für die Befehlskarte. */
  deploySpot(team, type, x, y) {
    return deploySpot(this, team, type, x, y);
  }

  // ---- Befehle ------------------------------------------------------------------

  /** Befehl ausführen. Liefert { ok: true, … } oder { ok: false, reason }. */
  issue(team, cmd) {
    if (!cmd || !this.teams[team]) return fail('Unbekannter Befehl');
    if (this.winner !== null) return fail('Partie ist beendet');
    const c = commandOf(cmd.type); // Befehlsregister js/game/commands.js
    if (!c) return fail('Unbekannter Befehl');
    // Koordinaten (Weltpunkt oder Stadtzelle): angegeben, aber keine endliche Zahl, heißt kaputter Befehl. Sonst liefen Einheiten
    // „nach NaN“ und ihre Position würde selbst NaN (Zeichnen, Wegsuche, Sicht brächen später). Fehlende Felder prüft der Befehl selbst.
    for (const k of COORD_FIELDS) if (cmd[k] !== undefined && !Number.isFinite(cmd[k])) return fail('Ungültige Koordinaten');
    if (this.teams[team].out) return fail('Ausgeschieden');
    // Gesperrtes Viertel (Eroberung, mode.locked): kein Ziel dort (Punkt oder Entity); nur das Aufklärungsflugzeug (highAlt) darf darüber fliegen
    if (!WORLD_FREE.has(cmd.type)) {
      const e = cmd.targetId !== undefined ? this.getEntity(cmd.targetId) : null;
      const px = e ? e.x : cmd.x;
      const py = e ? e.y : cmd.y;
      if (Number.isFinite(px) && Number.isFinite(py) && this.mode.locked(this, team, px, py)) {
        const ids = Array.isArray(cmd.ids) ? this.ownUnits(team, cmd.ids) : [];
        if (!(ids.length && !e && ids.every((u) => u.def.highAlt))) return fail('Gesperrtes Viertel eines anderen Spielers');
      }
    }
    return c.run(this, team, cmd);
  }

  ownUnits(team, ids = []) {
    const out = [];
    if (!Array.isArray(ids)) return out; // kaputter Befehl (Zahl, Objekt …): keine Einheiten statt Ausnahme
    for (const id of new Set(ids)) {
      const e = this.entities.get(id);
      if (e && e.alive && e.kind === 'unit' && e.team === team) out.push(e);
    }
    return out;
  }

  /** Belegte Plätze eines Teams: lebende Einheiten, Passagiere und Warteschlangen, je nach `slots` der Sorte. */
  slotsUsed(team) {
    const s = (def) => def.slots ?? 1;
    let n = 0;
    for (const u of this.units) {
      if (!u.alive || u.team !== team) continue;
      n += s(u.def);
      for (const p of u.passengers) n += s(p.def);
    }
    for (const b of this.trainers(team)) for (const e of b.queue) n += s(UNITS[e.unit]);
    return n;
  }

  /** Lebende plus in Ausbildung befindliche Einheiten eines Teams. */
  unitCount(team) {
    let n = 0;
    for (const u of this.units) {
      if (u.alive && u.team === team) n += 1 + u.passengers.length;
    }
    for (const b of this.trainers(team)) n += b.queue.length;
    return n;
  }

  /** Lebende Infanterie eines Teams (inkl. Passagiere in Fahrzeugen) plus Infanterie in Ausbildungs-Warteschlangen; ohne Kommandeur. */
  soldierCount(team) {
    const soldier = (def) => def.armor === 'inf' && !def.hero;
    let n = 0;
    for (const u of this.units) {
      if (!u.alive || u.team !== team) continue;
      if (soldier(u.def)) n += 1;
      for (const p of u.passengers) if (soldier(p.def)) n += 1;
    }
    for (const b of this.trainers(team)) for (const e of b.queue) if (soldier(UNITS[e.unit])) n += 1;
    return n;
  }

  /** Lebende Gebäude eines Teams mit Warteschlange: eigene Gebäude und (seit v4.96) Kaserne, Fabrikhalle, Heliport der Stadt. */
  trainers(team) {
    return this.buildings.filter((b) => b.alive && b.team === team).concat(cityTrainers(this, team));
  }



  // ---- Simulation ---------------------------------------------------------------

  endGame(winner, reason) {
    this.winner = winner;
    this.winReason = reason;
    const how = reason === 'tickets' ? 'als letzter mit Tickets' : reason === 'points' ? 'nach Punkten' : 'durch Eliminierung';
    this.message(-1, `${BALANCE.teamNames[winner]} gewinnt ${how}`);
  }

  /** Fällt die Hauptstadt eines Teams, ist es verloren (nur sie bildet Einheiten aus). */
  checkElimination() {
    this.mode.checkEnd(this);
  }

  ageEffects(dt) {
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.life);
  }

  /** Geld für ein Team (Abschuss, Bau); ab `bounty.notify` mit Meldung. */
  reward(team, amount, why = '') {
    if (!(amount > 0)) return;
    earn(this.teams[team], 'bounty', amount);
    this.teams[team].earned = (this.teams[team].earned || 0) + amount;
    if (why && amount >= BALANCE.bounty.notify) this.message(team, `+${amount} Geld: ${why}`);
  }

  /** Wer hat `dead` zerstört? Bei zwei Teams das andere, sonst das Team des letzten Treffers (`hitBy`, combat.hit) oder -1. */
  foeOf(dead) {
    if (dead.team < 0) return -1;
    if (this.teams.length === 2) return 1 - dead.team;
    const by = dead.hitBy ?? -1;
    return by >= 0 && by !== dead.team && this.teams[by] && !this.teams[by].out ? by : -1;
  }

  /** Abschussprämie für den Gegner: Soldaten wenig, Fahrzeuge und Hubschrauber viel (Anteil am Preis), Gebäude außer Mauern und Toren. */
  bounty(dead) {
    const B = BALANCE.bounty;
    const foe = this.foeOf(dead);
    if (foe < 0 || !this.teams[foe]) return;
    if (dead.kind === 'unit') {
      const frac = dead.def.armor === 'inf' ? B.inf : B.vehicle;
      this.reward(foe, Math.round((dead.def.cost.money || 0) * frac), `${dead.def.name} zerstört`);
    } else if (dead.type !== 'wall' && dead.type !== 'gate') {
      this.reward(foe, Math.round((dead.def.cost.bm || 0) * B.building), `${dead.def.name} zerstört`);
    }
  }

  /** Höchste Zahl lebender Einheiten je Team (Statistik „Höchste Armeegröße“); von update() einmal je s Spielzeit aufgerufen. */
  sampleArmy() {
    const n = this.teams.map(() => 0);
    for (const u of this.units) if (u.alive) n[u.team] += 1 + (u.passengers?.length || 0); // wie slotsUsed: Passagiere zählen mit
    for (const t of this.teams) if (n[t.id] > t.stats.peakUnits) t.stats.peakUnits = n[t.id];
  }

  /** Tote entfernen; Gebäude geben ihren Fußabdruck frei. */
  cleanup() {
    const units = this.units;
    let k = 0;
    for (const u of units) {
      if (u.hp <= 0) u.alive = false;
      if (u.alive) units[k++] = u;
      else {
        this.entities.delete(u.id);
        if (u.house) dropOccupant(this, u);
        if (u.hp <= 0) {
          const fallen = 1 + (u.passengers?.length || 0); // Passagiere sterben mit dem Fahrzeug
          this.teams[u.team].stats.lost += fallen;
          if (this.teams[this.foeOf(u)]) this.teams[this.foeOf(u)].stats.kills += fallen;
          this.addEffect('death', u.x, u.y, u.team, u.x, u.y, u.def.armor);
          addUnitWreck(this, u); // eingestiegene Passagiere (alive = false, hp > 0) hinterlassen nichts
          // gefallener Kommandeur, auch als Passagier eines zerstörten Fahrzeugs
          for (const h of [u, ...u.passengers]) if (h.def.hero) commanderFallen(this, h);
        }
      }
    }
    units.length = k;

    const bs = this.buildings;
    k = 0;
    for (const b of bs) {
      if (b.hp <= 0) b.alive = false;
      if (b.alive) {
        bs[k++] = b;
        continue;
      }
      this.grid.release(b);
      if (b.occupants?.length) ejectCrew(this, b);
      this.entities.delete(b.id);
      if (!b.demolished) {
        if (b.type !== 'wall' && b.type !== 'gate') {
          this.teams[b.team].stats.buildingsLost++;
          if (this.teams[this.foeOf(b)]) this.teams[this.foeOf(b)].stats.buildingsKilled++;
        }
        this.addEffect('explosion', b.x, b.y, b.team, b.x, b.y, 'building');
        addBuildingWreck(this, b);
        this.message(b.team, `${b.def.name} zerstört`, b.x, b.y);
      }
    }
    bs.length = k;
  }

  /** Ein Simulationsschritt (dt in Sekunden). */
  update(dt) {
    if (this.winner !== null) {
      this.ageEffects(dt);
      return;
    }
    this.time += dt;
    // Reihenfolge: Wetter zuerst (Sicht und Tempo), dann Forschung; Wirtschaft setzt team.rate zurück; Bewegung, Logistik, Bau und Brückenbau fahren; Kampf, Zone,
    // Einkommen zuletzt
    updateWeather(this, dt);
    updateResearch(this, dt);
    updateAbilities(this, dt);
    updateEconomy(this, dt);
    updateCity(this, dt);
    updateGarrison(this, dt);
    updateTowers(this, dt);
    updateFormations(this);
    updateMovement(this, dt, OWN_DRIVERS);
    updateProps(this); // Kettenfahrzeuge überfahren Zäune, Draht … (props.js)
    updateParadrop(this, dt); // Absetzen: C-130 im Anflug, Fallschirm-Zeiten (Paket E13 b)
    updateScramble(this); // Alarmrotte: Jets in Bereitschaft starten gegen Luftziele am Fliegerhorst (Paket „Alarmrotte“)
    updateAirstrike(this); // Luftschlag: Jets nach dem Einsatz heimschicken (Paket „Luftschlag“)
    updateAircraft(this, dt); // Jets: Flug, Rückkehr, Landung, Rollen, Tanken am Stellplatz (seit v5.03, Fliegerhorst seit v5.35)
    updateHelis(this, dt); // Hubschrauber: Start, Landung, Tanken am Heliport (seit v5.51)
    updateCrates(this, dt);
    updateLogistics(this, dt);
    updateConstruction(this, dt);
    updateDig(this, dt); // Bagger räumen Stadtzellen (seit v5.35)
    updateRoadWar(this, dt); // Straßen beschießen, Schutt räumen (Paket „Straßen“)
    updateBridges(this, dt);
    updateBridgeLayers(this, dt); // Brückenleger (Paket E14)
    separate(this);
    updateCommanders(this, dt);
    updateMedics(this, dt); // Sanitäter heilen verletzte Infanterie im Umkreis (Paket E1)
    updateRecovery(this, dt); // Bergepanzer reparieren eigene Fahrzeuge im Umkreis (Paket E7)
    updateFpv(this, dt); // Kamikazedrohnen explodieren bei Kontakt mit ihrem Ziel (Paket E11)
    updateMines(this, dt); // Pionier-Minen lösen aus und werden geräumt (Paket E8)
    updateCombat(this, dt);
    this.mode.update(this, dt); // klassisch updateZone, Eroberung updateConquest
    updateHot(this, dt);
    smoothIncome(this, dt);

    this.statTimer += dt;
    if (this.statTimer >= 1) {
      this.statTimer -= 1;
      this.sampleArmy();
    }

    // Nebel je Team in eigenem Takt, Team 1 um einen halben Takt versetzt (seit v5.93): beide Sichtberechnungen im selben Schritt
    // erzeugten Ruckler. Jedes Team rechnet weiter alle fogInterval s.
    let fogged = false;
    for (let t = 0; t < this.teams.length; t++) {
      if (this.teams[t].out) continue; // ausgeschieden: keine Sicht mehr
      this.fogTimers[t] += dt;
      if (this.fogTimers[t] < BALANCE.fogInterval) continue;
      this.fogTimers[t] = 0;
      this.fog[t].update(this, t);
      fogged = true;
    }
    if (fogged) {
      updateCrateIntel(this);
      updateScarIntel(this);
    }

    updateAnimals(this, dt);
    this.ageEffects(dt);
    this.cleanup();
    updateScars(this);
    if (this.winner === null) this.checkElimination();
    this.pathWork = 0; // Wegbudget (pathplan.js): gilt für KI-Befehle und Simulation bis zum Ende des nächsten Schritts
    this.pathShare = [];
  }
}
