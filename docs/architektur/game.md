# Architektur der Simulation: Besonderheiten (`js/game/`)

Ausgelagert aus `js/game/CLAUDE.md` (dort nur die Dateiliste und die wichtigsten Regeln). Ablauf und Datenmodelle: `ARCHITEKTUR.md` §3 bis §6.

## Besonderheiten
- Importe ohne Zyklus (`test/imports.test.js`); Geometrie der Zone und Beziehungen der Teams haben gar keine Importe: nie eigene Kreisrechnung oder `1 - team`.
- Abgeleiteter, ungespeicherter Zustand liegt in WeakMaps (Wege und Lasten der Stadt) oder wird in `restoreAccessors` (in der Klasse Game) neu gebunden.
- Neuer Befehl: Eintrag in `COMMANDS`, Vorlage in `test/cmdfuzz.test.js`; in der Eroberung prüft `lockedFor` die Sperre.
- Die KI und der Spieler ändern das Spiel nur über `game.issue`; Zufall nur über `game.rng`.
- Sicht: Tarnung und besetzte Häuser entscheidet `game.sees`; Straßenkrieg hält `game.roadHp`/`game.rubble`, Schutt sperrt `canZone` (`city/cells.js`).
