// KI-Gegner (docs/archiv/verlauf.md §5, §10.2, §11.5). Steuert nur über game.issue und liest den Zustand. Kein DOM.
// Reihenfolge je Denkschritt: Baustellen pflegen, Verteidigung, Rückzug, Expansion (FOB-Baustellen: Zone, Relais, Flanken),
// Forschung, Produktion (nur Hauptstadt), Verteidigungsgebäude und Mauer, Brücken, Baufahrzeuge, LKW (Lieferant/Pendler/Versorger), Sammelpunkte, Armee.

import { CITY } from '../data/city.js';
import { cityAiMemory, aiCity, aiRaid, aiDefend } from './cityai.js';
import { take, prune } from './cooldown.js';
import { cityTrainers } from '../game/city/query.js';
import { BALANCE } from '../data/balance.js';
import { UNITS } from '../data/units.js';
import { makeRng } from '../core/rng.js';
import { ZONE_BAN, MAX_PLACE, ALARM_TIME, ZONE_FOB_SLACK } from '../data/ai.js';
import { DEF_RANGE, ZONE_FOB_R, dist, unitVec } from './army/util.js';
import { buildMethods } from './army/build.js';
import { produceMethods } from './army/produce.js';
import { logisticsMethods } from './army/logistics.js';
import { combatMethods } from './army/combat.js';
import { conquestMethods } from './army/conquest.js';
import { coverMethods } from './army/cover.js';

export class AI {
  constructor(game, team, difficulty = 'normal') {
    this.game = game;
    this.team = team;
    this.difficulty = BALANCE.difficulty[difficulty] ? difficulty : 'normal';
    this.cfg = BALANCE.difficulty[this.difficulty];
    this.rng = makeRng(game.seed + team);
    // erster Denkschritt sofort; Rot (Team 1) einen halben Takt später, damit nie beide KIs im selben Schritt rechnen (seit v5.93: weniger
    // Ruckler). Ebenso der Takt der Stadt-KI (cityTimer, siehe think).
    const n = game.teams.length; // jede KI um einen Bruchteil des Takts versetzt (bei zwei Teams wie bisher ein halber Takt)
    this.timer = this.cfg.think * (1 + team / n); // Team 1: erster Schritt auch sofort, der nächste nach einem halben Takt
    this.cityTimer = (CITY.ai.interval[this.difficulty] * team) / n;
    this.budget = 0;
    this.corridor = null; // Gasse vor der Hauptstadt, in der nichts gebaut wird (Ausgang bleibt frei)
    this.badSites = []; // { x, y, until } fehlgeschlagene FOB-Ziele
    this.fobGoal = new Map(); // FOB-Fahrzeug-ID -> { x, y, tries } Ziel, an dem es aufbaut
    this.rallyAt = new Map(); // Gebäude-ID -> zuletzt gesetzter Sammelpunkt
    this.roles = new Map(); // LKW-ID -> 'pend' | 'vers'
    this.routes = new Map(); // LKW-ID -> { fromId, toId, k, t0 } (Pendler; fromId = Quelle, eine FOB oder ein eigenes Werk, seit v5.70)
    this.engTarget = new Map(); // Baufahrzeug-ID -> Baustelle, zu der es geschickt wurde
    this.supplyAt = new Map(); // Versorger-ID -> letzter Zielpunkt
    this.memo = {}; // Befehlsschlüssel → Spielzeit, bis zu der once() ihn sperrt (cooldown.js)
    this.airMemo = {}; // Zielart → { n, t }: gemerkte Zahl gesehener Ziele (rememberSeen)
    this.hadZoneFob = false; // eine Zonen-FOB (auch Baustelle) existierte im letzten Denkschritt
    this.saveForScout = false; // produce bildet keine Kampfeinheiten aus, bis der Späher bezahlt ist
    this.saveForFob = false; // ebenso, bis das nächste FOB-Fahrzeug bezahlt ist
    this.saveForResearch = false; // ebenso, bis die nächste Stufe bezahlt ist
    this.saveForJet = false; // ebenso, bis der nächste Jet bezahlt ist (CITY.ai.jetSave, combat.js jets)
    this.scoutHome = false; // Späher fliegt zum Auftanken heim
    this.scoutHurt = false; // Späher angeschlagen: landet am Heliport, bis er repariert ist (airSafety)
    this.droneHurt = false; // ebenso die Aufklärungsdrohne
    this.seenFobs = new Map(); // Gebäude-ID -> gesehene gegnerische FOB
    this.fallbackUntil = 0; // bis dahin greift army nicht an (Gruppen-Rückzug läuft)
    this.raid = null; // laufender Flankenangriff { ids, targetId }
    this.lastWave = 0; // Zeitpunkt der letzten Angriffswelle
    this.zoneBan = 0; // bis dahin keine neue Zonen-FOB (nach Verlust, gegen Nachschub in den Tod)
    // Buchhaltung der Stadt-KI (seit v5.58 hier statt im Stadtzustand): Ausbautakte, Zeit seit dem letzten Überfall, letzter Verteidigungsbefehl
    this.cityMem = cityAiMemory();

    game.issue(team, { type: 'setDifficulty', difficulty: this.difficulty }); // Team als KI markieren, Einkommensfaktor (Regel 2)
  }

  update(dt) {
    if (this.game.winner !== null || this.game.teams[this.team].out) return; // ausgeschieden (Eroberung): nichts mehr tun
    this.timer += dt;
    if (this.timer < this.cfg.think) return;
    this.timer -= this.cfg.think;
    this.think();
  }

  think() {
    prune(this.memo, this.game.time);
    this.cityTimer = (this.cityTimer ?? 0) + this.cfg.think;
    aiRaid(this.game, this.team, this.difficulty, this.cfg.think, this.cityMem); // Angriffe auf die gegnerische Stadt (Werke zuerst)
    aiDefend(this.game, this.team, this.cityMem); // eigene Stadt verteidigen
    if (this.cityTimer >= CITY.ai.interval[this.difficulty]) {
      this.cityTimer = 0;
      aiCity(this.game, this.team, this.difficulty, this.cityMem); // Stadt ausbauen: Ringe, Viertel, Einfuhr, Markt (cityai.js)
    }
    const s = this.snapshot();
    this.budget = MAX_PLACE;
    if (this.hadZoneFob && !s.zoneFob) this.zoneBan = this.game.time + ZONE_BAN;
    this.hadZoneFob = !!s.zoneFob;
    this.defend(s);
    this.retreat(s);
    this.fallBack(s);
    this.expand(s); // FOB-Fahrzeuge ausbilden, hinschicken und aufbauen
    this.scout(s); // vor produce: der Späher bekommt das Geld zuerst
    this.replaceCommander(s);
    this.research(s); // vor produce: die nächste Stufe bekommt das Geld zuerst
    this.gunships(s); // vor produce: der erste Kampfhubschrauber bekommt das Geld zuerst (Paket „KI-Einheiten“)
    this.gunshipOps(s); // Kampfhubschrauber: Luftnahunterstützung vom Heliport aus (Paket „Hubschrauber im Gefecht“)
    this.jets(s); // Fliegerhorst: Jets kaufen und losschicken (seit v5.03); vor produce, sonst bekommen die Bodentruppen alles Geld (Paket „Jets und Späher“)
    this.recon(s); // Fliegerhorst: U-2 zur Aufklärung (seit v5.83)
    this.produce(s);
    this.artillery(s); // Panzerhaubitzen hinter der Armee in Stellung (seit v5.26)
    this.artilleryFire(s); // Mörsertrupps und Raketenwerfer feuern auf Ziele (K2)
    this.buildDefense(s);
    this.buildWall(s);
    this.fortify(s);
    this.drone(s); // Aufklärungsdrohne am Heliport, nach der Festung: sie bekommt nur Geld, das übrig ist (K3)
    this.kamikaze(s); // Kamikazedrohnen greifen Panzer nahe der Zone an (K3)
    this.sappers(s); // Pioniere in der Kaserne (K4)
    this.minelay(s); // Pioniere legen Minen zwischen vorderster FOB und Zone (K4)
    this.rebuildBridges(s);
    this.repairRoads(s); // Schutt eigener Straßen räumen (Paket „Straßen“)
    this.manageEngineers(s);
    this.manageTrucks(s);
    this.rally(s);
    this.garrisonZone(s);
    this.stormHouses(s); // Häuser stürmen (seit v5.67)
    this.fortifyHouses(); // eigene Besatzungshäuser ausbauen (seit v5.67)
    this[this.game.mode.aiArmy](s); // Armee je Spielart (modes.js: army bzw. conquestArmy)
    this.digIn(s); // nach der Armee: wer untätig bleibt, gräbt sich ein (Paket „Deckung“, cover.js)
    this.takeCover(s); // und besetzt freie eigene Sandsack-Stellungen
    this.guardCommander(s);
    this.collectCrates(s); // nach der Welle: Kisten holen nur, die zurückbleiben (Reserve, Nachschub)
  }

  // ---- Lesen des Zustands ---------------------------------------------------------

  snapshot() {
    const g = this.game;
    const t = this.team;
    const own = g.buildings.filter((b) => b.alive && b.team === t);
    const fobs = own.filter((b) => b.type === 'fob');
    const builtFobs = fobs.filter((b) => b.built).sort((a, b) => a.id - b.id);
    const units = g.units.filter((u) => u.alive && u.team === t);
    const home = builtFobs.find((b) => b.main) ?? null; // Hauptstadt
    const ax = home ? home.x : fobs[0] ? fobs[0].x : g.map.spawns[t].x;
    const ay = home ? home.y : fobs[0] ? fobs[0].y : g.map.spawns[t].y;
    const zone = g.zone;
    const dir = unitVec(zone.x - ax, zone.y - ay);
    // Gegner nur, soweit das eigene Team sie sieht (Nebel)
    const enemies = g.units.filter((u) => u.alive && u.team !== t && g.sees(t, u));
    this.corridor = home ? { x: home.x, y: home.y, dx: dir.x, dy: dir.y } : null;

    const combat = units.filter((u) => u.def.range > 0 && !u.crate && !u.def.hero && !u.def.jet && !u.def.indirect && u.type !== 'gunship'); // Kistenträger kämpfen nicht, der Kommandeur bleibt hinten, Jets führt jets(), Artillerie artillery(), Kampfhubschrauber gunshipOps()
    // Ausbildende Gebäude (seit v4.96): Kaserne, Fabrikhalle und Heliport der Stadt; FOBs bilden nichts aus
    const producers = cityTrainers(g, t);
    const queuedCombat = producers.reduce((n, b) => n + b.queue.filter((e) => UNITS[e.unit ?? e].range > 0).length, 0);
    const zoneFob = fobs.find((f) => dist(f.x, f.y, zone.x, zone.y) <= ZONE_FOB_R + ZONE_FOB_SLACK) ?? null;
    const alarm =
      !!home &&
      (own.some((b) => dist(b.x, b.y, ax, ay) <= DEF_RANGE && b.lastHitTime > g.time - ALARM_TIME) ||
        enemies.some((e) => dist(e.x, e.y, ax, ay) <= DEF_RANGE));

    return {
      own,
      producers,
      fobs,
      builtFobs,
      home,
      ax,
      ay,
      dir,
      zone,
      zoneFob,
      enemies,
      units,
      combat,
      artillery: units.filter((u) => u.def.indirect).sort((a, b) => a.id - b.id),
      combatN: combat.length + queuedCombat,
      commander: units.find((u) => u.def.hero) ?? null,
      pickupWorks: this.pickupWorks(), // eigene fertige Werke mit Ausgangslager (seit v5.70)
      trucks: units.filter((u) => u.type === 'truck').sort((a, b) => a.id - b.id),
      helis: units.filter((u) => u.type === 'transporter').sort((a, b) => a.id - b.id),
      engineers: units.filter((u) => u.type === 'engineer').sort((a, b) => a.id - b.id),
      fobTrucks: units.filter((u) => u.def.deploys).sort((a, b) => a.id - b.id),
      alarm,
    };
  }

  /** Befehls-Drosselung: true, wenn der Schlüssel `secs` s lang nicht gesperrt war; dann sperrt once() ihn für `secs` s (cooldown.js). */
  once(key, secs) {
    return take(this.memo, key, secs, this.game.time);
  }

  /**
   * Ergänzt nach dem Laden eines älteren Standes fehlende Felder: cityMem bekommt die Standardfelder dazu, die alten Sperrfelder
   * (importNext, defendAt, parkFail, linkFail, laneFail) entfallen (dann beginnt nur die Drosselung neu), die Map memo wird eine
   * Tabelle und airMemo entsteht, falls es fehlt.
   */
  restoreMemory() {
    this.cityMem = { ...cityAiMemory(), ...this.cityMem };
    for (const k of ['importNext', 'defendAt', 'parkFail', 'linkFail', 'laneFail']) delete this.cityMem[k];
    if (this.cityMem.importAt === undefined) this.cityMem.importAt = null;
    if (this.memo instanceof Map || !this.memo) this.memo = {};
    if (!this.airMemo) this.airMemo = {};
  }
}

Object.assign(AI.prototype, buildMethods, produceMethods, logisticsMethods, combatMethods, conquestMethods, coverMethods);
