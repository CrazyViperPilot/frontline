# Rezept: Neuer Spielmodus oder neue Flaggen-/Ticketregel

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. Werte als eigener Block in `js/data/balance.js` (wie `BALANCE.conquest`), jede Zeile mit deutschem Kommentar.
   Regel in `docs/prd/eroberung.md` oder einer neuen Datei unter `docs/prd/` (Übersicht in PRD.md).
2. Neuer Modus: Schalter in `new Game({ … })` mit Standard **aus** (Regel 9 der `CLAUDE.md`: Startmenü-Schalter sind in `new Game()` ohne Angabe aus).
   Eintrag im Modus-Register `js/game/modes.js` (`MODES`, Haken wie bei `CONQUEST_MODE`).
   Startmenü und `js/main.js` wie im Rezept `docs/rezepte/neue-startoption.md`.
3. Regel in der Eroberung: `js/game/conquest.js` (`updateConquest`, `checkCapitals`, `eliminate`).
   Geometrie nur über `js/game/zonegeo.js` (`inZone`, `zoneDist`),
   Beziehungen nur über `js/game/teams.js` (`hostile`, `aliveTeams`, `enemiesOf`).
   Nie eigene Kreis- oder Quadratrechnung und nie `1 - team` (bis zu vier Teams).
4. Alle Stellen der Spielart prüfen: `foeSpawn`, `slotCap`, `checkEnd` und der Partieende-Text in `endGame` (`js/game/game.js`),
   Endbildschirm (`showEnd` in `js/ui/menu/end.js`), HUD (`js/ui/hud/`, Einstieg `js/ui/hud.js`),
   KI-Zweig (`aiArmy` in `js/ai/ai.js`), Punktewert (`score`).
5. Tests: `test/conquest.test.js` ergänzen, neue Befehle in `test/cmdfuzz.test.js` (TEMPLATES).
   `test/golden.test.js` bleibt unverändert.
   Ändert sich eine Zufallskarte mit 2 Spielern, ist das eine Regeländerung für Regel 4 der `CLAUDE.md`
   (Zufallskarten ohne Fluss müssen je Seed unverändert bleiben).
6. Neue Datei, die der Browser lädt: unter `sw.js` → `ASSETS`.
   `npm run docs`, `npm run test:quick`; PRD, Hilfe (`js/ui/helptext.js`, `js/ui/menu/start-html.js`), Eintrag in `docs/changes/`
   (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
