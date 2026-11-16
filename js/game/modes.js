// Modus-Register (Review „Eroberung“): jede Spielart steht hier genau einmal. `game.mode` liefert den Eintrag der laufenden Partie;
// Simulation und KI fragen ihn an den Stellen, an denen sich die Spielarten unterscheiden, statt `if (game.conquest)` zu verstreuen.
// Neue Spielart: Modul mit einem Objekt wie CONQUEST_MODE schreiben, hier eintragen, Schalter in `new Game()` (Rezept: docs/rezepte/neuer-spielmodus.md). Kein DOM.
//
// Haken je Eintrag:
//   teamCount(players)             Zahl der Teams
//   create(game, opts)             Startzustand anlegen (nach den Teams, vor Hauptstädten und Stadt)
//   restore(game)                  nach dem Laden eines Spielstands Abgeleitetes neu binden
//   update(game, dt)               Wertung je Schritt (Zone, Punkte bzw. Flaggen, Tickets)
//   checkEnd(game)                 Ausscheiden und Partieende am Ende des Schritts
//   locked(game, team, x, y)       darf `team` dort weder hin noch hinschießen?
//   slotCap(game)                  Einheitenlimit je Team
//   foeSpawn(game, team)           Punkt „beim Gegner“ (Ausrichtung von Verteidigung, Späherziel)
//   commanderLost(game, u, points) Kommandeur gefallen; true = erledigt, false = klassische Regel (commander.js)
//   freeReinforce                  kostenloser Soldaten-Nachschub der Hauptstadt?
//   spawnSpot(game, building)      abweichender Erscheinungsort einer fertigen Bodeneinheit oder null
//   score(team), scoreName         Wertung eines Teams für Anzeige, Spielstand und Statistik
//   aiArmy                         Name der Armee-Methode der KI (js/ai/ai.js think)
import { BALANCE } from '../data/balance.js';
import { updateZone } from './zone.js';
import { CONQUEST_MODE } from './conquest.js';

/** Klassische Partie: zwei Teams, runde Konfliktzone, Punktebalken. */
const CLASSIC_MODE = {
  id: 'classic',
  teamCount: () => 2,
  create() {},
  restore() {},
  update: updateZone,
  /** Fällt die Hauptstadt eines Teams, gewinnt das andere (fallen beide im selben Schritt: wer mehr Punkte hat). */
  checkEnd(game) {
    const lost = game.teams.filter((t) => !game.mainFob(t.id)).map((t) => t.id);
    if (lost.length === 0) return;
    const winner = lost.length === 1 ? 1 - lost[0] : game.teams[0].points >= game.teams[1].points ? 0 : 1;
    game.endGame(winner, 'eliminated');
  },
  locked: () => false,
  slotCap: () => BALANCE.slotCap,
  foeSpawn: (game, team) => game.map.spawns[1 - team],
  commanderLost: () => false,
  freeReinforce: true,
  spawnSpot: () => null,
  score: (team) => team.points,
  scoreName: 'Siegpunkte',
  aiArmy: 'army',
};

export const MODES = { classic: CLASSIC_MODE, conquest: CONQUEST_MODE };

/** Eintrag der laufenden Partie (aus dem Zustand abgeleitet, damit Spielstände nichts Zusätzliches speichern). */
export const modeOf = (game) => (game.conquest ? CONQUEST_MODE : CLASSIC_MODE);
