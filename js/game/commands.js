// Befehlsregister (Review E-04, seit v5.63): jeder Befehl von game.issue(team, cmd) steht hier genau einmal. Kein DOM.
// Felder je Eintrag:
//   run(game, team, cmd) → { ok: true, … } | { ok: false, reason }  Handler (im Fachmodul; Bewegen, Bauen, Ausbilden in js/game/cmd/)
//   drives: true   Der Befehl setzt einen Auftrag gleichen Namens (u.order.type), den sein Modul selbst fährt;
//                  updateMovement (movement.js) lässt solche Einheiten aus (früher die Liste OWN_DRIVERS).
//   sound: true    Die Spieler-Steuerung (js/ui/controller.js) quittiert den erfolgreichen Befehl mit dem Befehlston.
// Neuer Befehl: Handler schreiben, hier eintragen, in ARCHITEKTUR §6 beschreiben (test/docs.test.js prüft das).
import { BALANCE } from '../data/balance.js';
import { setIdle } from './movement.js';
import { cmdCity, cmdCityUpgrade, cmdCityConnect, cmdTrade } from './city/commands.js';
import { cmdDrill } from './hotzone.js';
import { cmdLoad, cmdUnload, cmdRoute, cmdSetPreset, cmdBoard, cmdDropoff } from './logistics.js';
import { cmdRepair } from './construction.js';
import { cmdRoof, cmdFortify } from './tower.js';
import { cmdGarrison, cmdUngarrison, cmdStorm, cmdFortifyHouse } from './garrison.js';
import { cmdPickup, cmdDeliver, cmdDropCrate } from './crates.js';
import { cmdAbility } from './abilities.js';
import { cmdResearch, cmdCancelResearch } from './research.js';
import { cmdRepairBridge, cmdLayBridge } from './river.js';
import { cmdLand } from './aircraft.js';
import { cmdScramble } from './scramble.js';
import { cmdAirstrike } from './airstrike.js';
import { cmdHeliLand, isHeliport } from './helipad.js';
import { cmdDig } from './excavator.js';
import { cmdShellRoad, cmdClearRubble } from './roadwar.js';
import { cmdLayMine } from './mines.js';
import { cmdParadrop } from './paradrop.js';
import { setWeather, WEATHER_NAMES } from './weather.js';
import { cmdMove, cmdAttack, cmdDeploy, cmdMortarTarget, cmdRally, cmdSpawnAt } from './cmd/units.js';
import { cmdBuild, cmdBuildWall, cmdDemolish } from './cmd/build.js';
import { cmdTrain, cmdCancelTrain } from './cmd/train.js';
import { earn } from './ledger.js';

const fail = (reason) => ({ ok: false, reason });

/** Stopp: Einheiten anhalten; beendet auch das Feuer der Artillerie auf einen Punkt. */
function cmdStop(game, team, cmd) {
  const units = game.ownUnits(team, cmd.ids);
  if (!units.length) return fail('Keine eigenen Einheiten gewählt');
  for (const u of units) {
    setIdle(u);
    u.fireTarget = null;
  }
  return { ok: true };
}

/** KI meldet sich an (seit v5.58, Regel 2): Team als KI markieren, Einkommensfaktor der Schwierigkeit. */
function cmdSetDifficulty(game, team, cmd) {
  const d = BALANCE.difficulty[cmd.difficulty];
  if (!d) return fail('Unbekannte Schwierigkeit');
  game.teams[team].isAI = true;
  game.teams[team].incomeMult = d.incomeMult;
  return { ok: true };
}

/** Debug-Befehl (nur mit `debug` im Spiel, ?debug=1): money = Geld dazu; weather (+ season) = Wetter setzen, hold = es bleibt so. */
function cmdDebug(game, team, cmd) {
  if (!game.debug) return fail('Nur im Debug-Modus');
  if (cmd.weather && !WEATHER_NAMES[cmd.weather]) return fail('Unbekanntes Wetter');
  if (cmd.money) earn(game.teams[team], 'debug', cmd.money);
  if (cmd.weather) {
    setWeather(game, cmd.weather, cmd.season);
    if (cmd.hold) game.weather.next = Infinity;
  }
  return { ok: true };
}

export const COMMANDS = {
  move: { run: cmdMove, sound: true },
  attackMove: { run: cmdMove, sound: true },
  attack: { run: cmdAttack, sound: true },
  stop: { run: cmdStop },
  build: { run: cmdBuild, drives: true, sound: true },
  buildWall: { run: cmdBuildWall, sound: true },
  buildFob: { run: () => fail('Baufahrzeuge bauen keine FOB mehr: FOB-Fahrzeug ausbilden und dort aufbauen') },
  deploy: { run: cmdDeploy, sound: true },
  repair: { run: cmdRepair, drives: true, sound: true },
  repairBridge: { run: cmdRepairBridge, drives: true, sound: true },
  load: { run: cmdLoad, drives: true, sound: true },
  unload: { run: cmdUnload, drives: true, sound: true },
  route: { run: cmdRoute, drives: true, sound: true },
  setPreset: { run: cmdSetPreset },
  mortarTarget: { run: cmdMortarTarget, sound: true },
  layMine: { run: cmdLayMine, drives: true, sound: true },
  board: { run: cmdBoard, drives: true, sound: true },
  garrison: { run: cmdGarrison, drives: true, sound: true },
  ungarrison: { run: cmdUngarrison, sound: true },
  roof: { run: cmdRoof },
  storm: { run: cmdStorm, drives: true, sound: true },
  fortifyHouse: { run: cmdFortifyHouse, sound: true },
  fortify: { run: cmdFortify },
  pickup: { run: cmdPickup, drives: true, sound: true },
  deliver: { run: cmdDeliver, drives: true, sound: true },
  dropCrate: { run: cmdDropCrate },
  dropoff: { run: cmdDropoff, drives: true, sound: true },
  paradrop: { run: cmdParadrop, drives: true, sound: true },
  drill: { run: cmdDrill },
  // Heliport als Ziel: Hubschrauber (seit v5.51, helipad.js), sonst Stellplatz: Jets (aircraft.js)
  land: { run: (g, t, c) => (isHeliport(g, g.getEntity(c.airportId)) ? cmdHeliLand(g, t, c) : cmdLand(g, t, c)), drives: true, sound: true },
  scramble: { run: cmdScramble, sound: true }, // Alarmbereitschaft der Jets an/aus (Paket „Alarmrotte“)
  airstrike: { run: cmdAirstrike, sound: true }, // Luftschlag: startbereite Jets auf Ziel oder Punkt (Paket „Luftschlag“)
  dig: { run: cmdDig, drives: true, sound: true },
  layBridge: { run: cmdLayBridge, drives: true, sound: true },
  shellRoad: { run: cmdShellRoad, drives: true, sound: true },
  clearRubble: { run: cmdClearRubble, drives: true, sound: true },
  city: { run: cmdCity },
  cityUpgrade: { run: cmdCityUpgrade },
  cityConnect: { run: cmdCityConnect, sound: true }, // Straße vom Stadtgebäude zum Lager (Paket „Straße zum Lager“)
  trade: { run: cmdTrade },
  train: { run: cmdTrain },
  cancelTrain: { run: cmdCancelTrain },
  research: { run: cmdResearch },
  smoke: { run: cmdAbility },
  mine: { run: cmdAbility },
  cancelResearch: { run: cmdCancelResearch },
  rally: { run: cmdRally },
  spawnAt: { run: cmdSpawnAt }, // Eroberung: Einheiten an einer eigenen Flagge erscheinen lassen
  demolish: { run: cmdDemolish },
  setDifficulty: { run: cmdSetDifficulty },
  debug: { run: cmdDebug },
};

/** Auftragsarten, die ihr Modul selbst fährt (updateMovement lässt sie aus). */
export const OWN_DRIVERS = new Set(Object.keys(COMMANDS).filter((k) => COMMANDS[k].drives));

/** Registereintrag eines Befehlstyps oder null (auch für geerbte Schlüssel wie 'toString'). */
export const commandOf = (type) => (typeof type === 'string' && Object.hasOwn(COMMANDS, type) ? COMMANDS[type] : null);
