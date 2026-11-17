# js/game/ – Simulation (kein DOM, kein `window`)

Regeln: PRD.md und `docs/prd/`, Werte `js/data/`. Stadt: `city/CLAUDE.md`. Jede Datei hat einen Kopfkommentar.

- `game.js` – Klasse `Game`: Zustand, `issue`, Spielschritt, Lager, Sieg. `Game`, `newStats`
- `commands.js` – Befehlsregister (Handler, `drives`, `sound`). `COMMANDS`, `OWN_DRIVERS`
- `cmd/units.js`, `cmd/build.js`, `cmd/train.js` – Handler `cmdX`: Marsch/Angriff/Sammelpunkt, Bauplatz und Abriss, Ausbildung. `canPlace`, `cmdMove`, `cmdTrain`
- `entities.js` – Entities anlegen, Beziehungen. `createUnit`, `createBuilding`, `isFoe`, `inRange`
- `economy.js` – Ausbildung, Nachschub, Einkommen. `updateEconomy`
- `zone.js`, `hotzone.js` – Konfliktzone und Punkte (klassisch); Hot Zone und Bohrer. `updateZone`, `updateHot`
- `conquest.js` – Modus Eroberung: Flaggen, Viertel, Tickets, Sperre. `lockedFor`, `eliminate`, `quarterAt`, `CONQUEST_MODE`
- `modes.js` – Modus-Register mit Haken je Spielart. `MODES`, `modeOf`
- `zonegeo.js`, `teams.js` – Zonengeometrie und Beziehungen der Teams. `inZone`, `zoneDist`, `hostile`, `aliveTeams`, `enemiesOf`
- `movement.js`, `pathfinding.js`, `pathplan.js`, `grid.js`, `formation.js` – Bewegung, A*, Wegbudget, Raster, Formationen. `driveTo`, `findUnitPath`, `planUnitPath`
- `combat.js` – Zielsuche, Direktfeuer, Mörser, Flugabwehr, Schaden. `hit`, `impact`, `updateCombat`
- `logistics.js`, `construction.js` – LKW, Nachfüllen; Bauen, Reparieren. `updateLogistics`, `canBuild`
- `garrison.js`, `tower.js`, `crates.js`, `commander.js`, `radio.js` – Häuserkampf, Festung, Kisten, Kommandeur, Sendemast
- `research.js`, `weather.js`, `river.js` – Forschung (`modOf`), Wetter, Fluss mit Brücken. `modOf`, `updateWeather`
- `transport.js`, `flow.js` – Straßentransport der Stadt; Ressourcenanzeige (liest nur). `transportOf`, `resourceFlow`
- `roads.js`, `roadwar.js`, `excavator.js` – Kartenstraßen, Straßen zerstören/räumen, Bagger. `updateRoadWar`, `cmdDig`
- `aircraft.js`, `helipad.js`, `paradrop.js` – Fliegerhorst und Jets, Heliport, Absetzen aus der C-130. `runwaysOf`, `trainCheck`, `heliTrainCheck`
- `scramble.js` – Alarmrotte: Jets in Bereitschaft starten selbst gegen Luftziele. `updateScramble`, `cmdScramble`, `alertOn`
- `abilities.js`, `mines.js` – Nebel, Minen, Selbstheilung (Forschung); Pionier-Minen. `cmdAbility`, `cmdLayMine`
- `medic.js`, `recovery.js`, `fpv.js` – Einheiten mit eigener Logik: Sanitäter, Bergepanzer, Kamikazedrohne
- `fog.js` – Nebel des Krieges, `version` zählt Neuberechnungen. `Fog`
- `map.js`, `landscape.js`, `relief.js`, `mapdata.js` – Zufallskarte, Gelände, Höhenraster, Kartenformat. `generateMap`, `Relief`
- `scars.js`, `animals.js` – Wracks und Krater, Tiere (nur Optik, aber Simulation)
- `savegame.js` – Spielstand als JSON. `snapshotGame`, `restoreGame`

## Besonderheiten
- Importe ohne Zyklus (`test/imports.test.js`); Geometrie der Zone und Beziehungen der Teams haben gar keine Importe: nie eigene Kreisrechnung oder `1 - team`.
- Abgeleiteter, ungespeicherter Zustand liegt in WeakMaps (Wege und Lasten der Stadt) oder wird in `restoreAccessors` (in der Klasse Game) neu gebunden.
- Neuer Befehl: Eintrag in `COMMANDS`, Vorlage in `test/cmdfuzz.test.js`; in der Eroberung prüft `lockedFor` die Sperre.
- Die KI und der Spieler ändern das Spiel nur über `game.issue`; Zufall nur über `game.rng`.
- Sicht: Tarnung und besetzte Häuser entscheidet `game.sees`; Straßenkrieg hält `game.roadHp`/`game.rubble`, Schutt sperrt `canZone` (`city/cells.js`).

Exporte dieses Ordners: `docs/index/game-*.md`, nach Anfangsbuchstaben geteilt, Unterordner `game-cmd.md`, `game-city.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
