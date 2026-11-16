# Rezept: Neuer Befehl

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. Handler im zuständigen Modul (Marsch, Angriff, Sammelpunkt: `js/game/cmd/units.js`; Bauen, Abriss: `js/game/cmd/build.js`;
   Ausbildung: `js/game/cmd/train.js`; sonst im Fachmodul):
   `export function cmdX(game, team, cmd)` → `{ ok: true }` oder `{ ok: false, reason: 'deutscher Text' }`.
   Nur eigene, lebende Einheiten akzeptieren.
2. Eintrag im Befehlsregister `js/game/commands.js`: `x: { run: cmdX, drives: true, sound: true }`.
   `drives`: setzt einen Auftrag `x`, den das Modul selbst fährt, z. B. in seinem `update…`; `sound`: Befehlston.
   `game.issue` braucht nichts weiter.
   Den Befehl in `ARCHITEKTUR.md` §6 beschreiben (`test/docs.test.js` prüft das).
   Eroberung: Die Sperre prüft `game.issue` bei jedem Ziel auf der Karte.
   Liegt `x`/`y` nicht auf der Karte (Stadtzelle, Flaggennummer), gehört der Typ in `WORLD_FREE` (`js/game/game.js`).
   Für `test/cmdfuzz.test.js` eine Vorlage in `TEMPLATES` anlegen (nur `spawnAt` ist ausgenommen).
3. UI: Eintrag in der Befehlskarte (`js/ui/controller/cards.js`, `entry(label, hotkey, { action })`) und/oder Rechtsklick.
   Braucht er ein Ziel auf der Karte: Zeile in der Modustabelle `MODES` (`js/ui/controller/modes.js`: `hint`, `click`)
   plus `confirmX`-Methode (`js/ui/controller/targets.js`).
   Taste in der Hilfe (`js/ui/helptext.js`).
4. Test über `game.issue` (`test/commands.test.js` prüft Register und Modi allgemein), PRD §8 (Steuerung) und Eintrag in `docs/changes/`
   (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
