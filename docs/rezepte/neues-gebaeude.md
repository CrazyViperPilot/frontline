# Rezept: Neues Gebäude

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. `js/data/buildings.js`: Eintrag mit `name`, `short` (Kurzname in der Befehlskarte), `w`, `h` (Zellen), `hp`, `sight`, `cost`, `buildTime`,
   `hotkey`; optional `weapon`, `aa`, `produces` (ausbildbare Einheiten, fehlt = keine).
   Mit `hotkey` erscheint es automatisch im Baumenü des Baufahrzeugs.
   Die Taste darf keine feste Taste sein (J, H, V, Y, P, M; `test/config.test.js` prüft das).
2. Sonderregeln beim Setzen in `js/game/cmd/build.js` (`canPlace`).
   Wirkung im passenden Modul oder in einem neuen Modul (Rezept `docs/rezepte/neues-spielsystem.md`).
3. Aussehen: Maler in `js/render/milbuild.js` (Typ in `MIL_TYPES` eintragen), Höhe in `js/render/iso.js` (`BUILD_H`),
   Kürzel in `js/render/sprites.js` (`BUILD_ABBR`, 2D-Ansicht).
4. KI optional in `js/ai/army/build.js` (`buildDefense`, `findSite`).
   Test, Baumenü-Zeile der Hilfe (`js/ui/helptext.js`, Taste B), PRD §5 und Eintrag in `docs/changes/`
   (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
   Eroberung: Das Auswahlfeld „Neue Einheiten erscheinen“ erscheint von selbst bei Gebäuden, die Bodeneinheiten ausbilden (`produces`),
   nicht bei Flugzeugen (`js/ui/hud/info.js`, `updateSpawnPick`).
