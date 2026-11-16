# Rezept: Neue Einheit

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. `js/data/units.js`: ähnliche Einheit kopieren, neuen Schlüssel vergeben.
   `name`, `short`, Werte, `weapons`, `cost`, `buildTime`, `slots`, `hotkey` anpassen.
   Die Taste darf in der Hauptstadt noch nicht belegt sein.
2. `js/data/buildings.js`: Schlüssel in `fob.produces` eintragen.
   Für Partien mit Stadt auch in `CITY.produces` (`js/data/city.js`: Kaserne, Fabrikhalle oder Heliport).
3. `js/data/research.js`: Gruppe in `RESEARCH.groups` eintragen.
   Fehlt sie, wirken nur `all`, `veh` und `air`; Einheiten sind ohne Forschung frei.
   Mit Stadt: `CITY.crew` (Einwohner) und `CITY.metalCost` (Metall aus dem Stadtlager, fehlt = 0) in `js/data/city.js`.
4. Aussehen: **eigenes Rezept `docs/rezept-einheiten.md`**.
   Es behandelt Maße, Bausteine, Stil, die Vorschau-Schleife mit `node tools/unitpreview.mjs <typ>` und welches KI-Modell dafür taugt.
   Kurz: Modell in `js/render/unitpaint.js` (Funktion in `MODELS` bzw. `INFANTRY`, gilt für 2D und Iso).
   `test/unitpaint.test.js` prüft, dass jede Einheit eines hat.
   Ohne Modell zeichnen `js/render/sprites.js` (`drawUnit`) und der Renderer eine einfache Form.
5. KI: Soll sie die Einheit bauen?
   Dann `MIX` in `js/data/ai.js` und die Ausbildung in `js/ai/army/produce.js` (`produce`, `counterMix`) ergänzen.
   Sonst im PRD §10 vermerken, dass sie es nicht tut.
6. Test in `test/` (Ausbildung über `game.issue(team, { type: 'train', … })`).
   Hilfe (`js/ui/helptext.js`, `js/ui/menu/start-html.js`), `npm run docs` (Tabellen), PRD §6 (Rolle) und Eintrag in `docs/changes/`
   (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
7. Eroberung: Ein Kampfflugzeug nimmt keine Flagge ein (`!u.def.jet` in `updateConquest`).
   Nur die U-2 (`highAlt`) darf über fremde Viertel fliegen (Sperre `mode.locked` in `movement.js`).
   Luftfahrzeuge erscheinen nie an einer Flagge (Ausbildung in `economy.js`).
