# Rezept: Einen Wert ändern

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. Schlüssel in der Tabelle `docs/wo-aendern.md` suchen, Wert in `js/data/` ändern.
2. `npm run docs` (Tabellen in PRD §6).
   Dann PRD-Text und Hilfetexte (`js/ui/helptext.js`, `js/ui/menu/start-html.js`) auf die alte Zahl durchsuchen und anpassen.
   Eintrag als Datei in `docs/changes/` (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
3. `npm run test:quick`, dann `npm test`.
   `CACHE_VERSION` erhöht `npm run release` (Abschnitt „Zusammenarbeit“ der `CLAUDE.md`).
   Schlägt ein Test fehl, der genau diesen Wert prüft: Test an die neue Regel anpassen, nicht umgekehrt.
