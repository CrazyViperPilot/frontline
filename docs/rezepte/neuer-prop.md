# Rezept: Neuer Prop der Karte

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).
Props sind Deko und Gelände der Karte (Zäune, Mauern, später Sandsäcke, Container …) mit Spielwerten.

1. `js/data/props.js`: Eintrag in `PROPS.kinds` mit `name`, `group` (Gruppe in `PROPS.groups`, Auswahl im Editor), `blocks`
   (`all`, `veh`, `inf`, `none`), `crush`, `cover`, optional `coverVeh`, `sight`, `hp`, `armor` (Panzerklasse der Waffenschäden),
   `rubble` (Trümmer oder `null`). Kacheln (`line: true`, eine Rasterzelle, verbinden sich, `gate` erlaubt Tore) oder
   Einzelstücke mit `size: [Breite, Tiefe]` (px, gedreht um `rot` × 45°); `foot` sperrt nur Teilflächen, `stack` erlaubt Lagen.
2. Regeln wirken von selbst (`js/game/props.js`): Sperren je Bewegungsklasse im Raster, Überfahren, Deckung, Sichthöhe, Splash,
   Trümmer, Spielstand. Neue Regeln dort, nie als Zahl im Code (Regel 3).
3. Bild: Modell aus wenigen Körpern des Painters (`PAINT` aus `js/render/unitpaint.js`: `box`, `cyl`, `prX` …), Kleinteile mit
   `fine()`, Winter über `top: { col, at }`, Varianten nur aus `v` (Farbe je Gebiet) und `d` (Einzelheiten je Kachel), kein Zufall.
   Kacheln: Art mit `arm`, `mid`, `rubble` (Tor: `gate`, `leaf`; ohne Verbindung: `solo`) in `js/render/fences.js` oder über
   `addLineKinds` aus einem eigenen Modul (Beispiel `milprops.js`); Einzelstücke: Modell in `milprops.js`, `indprops.js` bzw. `refprops.js` (`SINGLE`) oder eigenem Modul,
   in `modelOf` von `js/render/mapprops.js` einhängen; ein vorhandener Maler (Auto, Bank …) über `DELEGATE` in `civprops.js`. Fahne (`flag`): Tuch in der übergebenen Farbe. Schatten, Iso, 2D und Editor zeichnet `mapprops.js`.
4. Vorschau: `node tools/propspreview.mjs <art>` (Sommer, Winter, Zoom 3 und 1,6, 2D, mit Panzer und Soldaten) und Bild ansehen.
5. Zufallskarten optional: `MAPGEN.props` und `placeProps` in `js/game/map.js` (eigener Zufall, punktsymmetrisch, sparsam);
   ändert die Prüfsummen (`npm run metrics -- --update`, `test/golden.test.js`).
6. Test in `test/mapprops.test.js`, Tabelle im PRD (`docs/prd/zone-gelaende.md`, „Zäune und Mauern“), Hilfe (`js/ui/helptext.js`),
   Eintrag in `docs/changes/`.
