# Rezept: Neue feste Karte

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“). Regeln: `docs/prd/feste-karten.md`.

1. Karte bauen, entweder
   - im Karteneditor (`editor.html`): Startpunkte (2 bis 4), Flaggen, Baugebiete (Zone wählen: Ecken/Seiten), dann „Prüfen“ und
     **„Als feste Karte“** (lädt `<name>.js` herunter), oder
   - als Skript unter `tools/maps/<name>.mjs` wie `tools/maps/east-europe-railway.mjs` (wiederholbar, Zufall nur über `makeRng`):
     Gelände als Grobraster (`Relief`), Objekte als Listen, am Ende `normalizeMap` und `checkMap`, Ausgabe nach `js/data/maps/`.
2. Datei nach `js/data/maps/<name>.js` (Format `export default { … }`, Kartenformat `js/game/mapdata.js`), in
   `js/data/maps/index.js` unter `FIXED_MAPS` eintragen (`id` beginnt mit `fest:`, `name`, `info` für das Startmenü).
3. In `sw.js` unter `ASSETS` eintragen (Regel 6). `test/fixedmaps.test.js` prüft jede feste Karte mit `checkMap`.
4. Messen: KI gegen KI auf der Karte (kurzes Skript mit `new Game({ map: loadMap(id), conquest: true, players })` und je Team `new AI`),
   ob alle Flaggen erreichbar sind und die Städte wachsen.
5. PRD `docs/prd/feste-karten.md` (Abschnitt je Karte) und einen Eintrag in `docs/changes/`.
