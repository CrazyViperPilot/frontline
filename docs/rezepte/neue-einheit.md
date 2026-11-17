# Rezept: Neue Einheit

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. `js/data/units.js`: ähnliche Einheit kopieren, neuen Schlüssel vergeben.
   `name`, `short`, Werte, `weapons`, `cost`, `buildTime`, `slots`, `hotkey` anpassen.
   Die Taste darf im Ausbildungsgebäude noch nicht belegt sein (`test/config.test.js` prüft das).
2. `js/data/city.js`: Schlüssel in `CITY.produces` eintragen (Kaserne, Fabrikhalle, Heliport oder Stellplatz),
   dazu `CITY.crew` (Einwohner, fehlt = 1) und `CITY.metalCost` (Stahl aus dem Stadtlager, fehlt = 0).
3. `js/data/research.js`: Gruppe in `RESEARCH.groups` eintragen.
   Fehlt sie, wirken nur `all`, `veh` und `air`; Einheiten sind ohne Forschung frei.
4. Aussehen: **eigenes Rezept `docs/rezept-einheiten.md`**.
   Es behandelt Maße, Bausteine, Stil, die Vorschau-Schleife mit `node tools/unitpreview.mjs <typ>` und welches KI-Modell dafür taugt.
   Kurz: Modell in der passenden Familie unter `js/render/units/`, eingetragen in `MODELS` bzw. `INFANTRY` in
   `js/render/unitpaint.js` (gilt für 2D und Iso).
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
