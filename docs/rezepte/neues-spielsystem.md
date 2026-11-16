# Rezept: Neues Spielsystem (eigenes Modul)

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. `js/game/<name>.js` mit Kopfkommentar (Zweck, „Kein DOM“), `create<Name>(game)` für den Startzustand und `update<Name>(game, dt)` für einen Schritt.
2. In `js/game/game.js` importieren, `create…` im Konstruktor aufrufen und `update…` in `update()` an der passenden Stelle der Reihenfolge einfügen
   (siehe `ARCHITEKTUR.md`).
   Abgeleiteter Zustand, den der Spielstand nicht speichert (wie das Sperrraster `grid.lock`), wird in `restoreAccessors` (`game.js`) nach dem Laden neu gebunden.
3. Werte als eigener Abschnitt in `js/data/balance.js`, Datei in `sw.js` → `ASSETS`, Test `test/<name>.test.js`,
   Zeile in der Feature-Landkarte (`ARCHITEKTUR.md` §9) und in `js/game/CLAUDE.md`.
