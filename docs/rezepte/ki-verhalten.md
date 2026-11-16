# Rezept: KI-Verhalten anpassen

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. Schwellen und Takte zuerst über `BALANCE.difficulty` oder `js/data/ai.js` ändern.
2. Neues Verhalten als Methode in einem der Module unter `js/ai/army/` (Bau, Ausbildung, Logistik, Kampf; per Mixin an die
   Klasse `AI` in `js/ai/ai.js` gehängt), aufgerufen aus `think()` (Denkschritt).
   Die KI ändert das Spiel nur über `game.issue`.
   Die Armee ist je Spielart verschieden (`game.mode.aiArmy`):
   in der Eroberung läuft `conquestArmy` (`js/ai/army/conquest.js`: Flaggenziele, Erscheinungsort), nicht `army()`.
   Wellenschätzung, Späher-Schätzung und Flankenangriff gelten nur klassisch.
3. `test/ai.test.js` (KI gegen KI über feste Seeds) laufen lassen; PRD §10 und die Tabelle „KI-Konstanten“ aktualisieren.
