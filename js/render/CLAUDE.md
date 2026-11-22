# js/render/ – Darstellung (liest den Spielzustand, ändert ihn nie)

Gemalte Bilder laufen über `spritecache.js`, Bauteile aus `isokit.js`. Ebenen des Renderers: `layers/`.

- `renderer.js` – Einstieg, nur Re-Export aus `layers/`. `Renderer`, `makeFogLayer`, `updateFogLayer`
- `camera.js` – Ausschnitt, Zoom, Welt ↔ Bildschirm, Iso-Umrechnung. `Camera`, `ROT`, `ISO_K`
- `color.js` – Farb- und Rechenhilfen aller Malmodule. `rgbOf`, `mix`, `clamp`, `hashXY`
- `spritecache.js` – malt jede Bildvariante je Maßstab einmal, danach nur `drawImage`. `sprite`, `peek`, `blit`
- `materials.js` – Materialfotos (Ziegel, Putz, Dach …) über Flächen. `texWall`, `wallMat`, `withMat`
- `isokit.js` – gemeinsame Bauteile gemalter Gebäude (Wände, Dächer, Zylinder, Bäume, Fahrzeuge), Iso `G` und 2D `…Top`
- `sprites.js` – einfache Formen von oben für Einheiten, Gebäude, Kisten, Tiere; Farbhilfen `shade`, `tint`, `hexA`
- `iso.js`, `isobuild.js`, `isosprites.js` – Iso-Grundkörper, Höhen (`buildingHeight`), Ersatzgebäude, Schutt; Hülle um `unitpaint.js`
- `unitpaint.js` – Einheiten und Wracks als 3D-Modelle (Familien in `units/`). `drawUnitIso`, `drawUnitTop`, `drawWreckIso`
- `fx.js` – Explosion, Leuchtspur, Geschoss, Rauch, Feuer, Krater, Wrack-Trümmer. `drawEffect`, `drawShell`, `drawWreckRubble`
- `marks.js` – Auswahlring, Balken, Stern, Befehlsmarken, Sammelpunkt-Fahne. `drawSelectMark`, `drawGauge`, `drawMoveRing`
- `milbuild.js` – alle Militärgebäude samt Baustellen in 2D und Iso. `drawMilTop`, `drawMilIso`
- `townhouses.js`, `works.js`, `university.js`, `cityhall.js` – 1 × 1-Stadthäuser, Werke und Kraftwerk, Universität, Regierungsgebäude
- `bigbuild.js`, `airbase.js`, `citysite.js` – Großbauten (Kaserne, Fabrikhalle), Fliegerhorst, Baustellen der Stadt
- `govquarter.js` – Regierungsviertel um die Hauptstadt als Bodenbild und Iso-Gruppen. `quarterRect`, `quarterItems`
- `citylayer.js` – Stadt auf der Karte: Straßen, Zonen, Gebäudeliste, Schilder. `cityBuildings`, `drawCityGround`, `drawCityTop`
- `landmarks.js`, `mappreview.js` – Fabrikhalle, Strommasten fester Karten; Kartenvorschau. `pylonNet`, `drawMapPreview`
- `paving.js` – Pflaster der Karte: graue Plätze und Bürgersteige (nur Boden). `drawPaving`, `drawPlaza`, `drawWalk`
- `maptown.js`, `props.js`, `stronghold.js` – Kartenstadt, Kleinkram (Autos, Bänke, Kisten, Ballen), Besatzungsfahnen und Ausbauten
- `mapprops.js`, `fences.js`, `milprops.js`, `indprops.js`, `refprops.js`, `civprops.js` – Props: Aussehen, Zäune, Militär, Industrie, Zivil. `propLooks`
- `nature.js` – Bäume, Büsche, Felsen, Tiere. `drawTreeIso`, `drawRockIso`, `forestKind`
- `ground.js`, `reliefimg.js`, `terrain.js` – WebGL-Boden samt Nebel, Geländebild, Kartenbild. `getGround`, `buildTerrain`
- `ways.js`, `fields.js` – Feldwege, Gleise, Straßenmuster (Fotos `textures/`); Äcker, Weiden. `drawWays`, `buildFields`, `fieldBales`
- `bridge.js`, `season.js` – Brücken und Furtstangen; Jahreszeitenfarben. `drawBridgeIso`, `seasonal`
- `mood.js`, `weatherfx.js` – Tageslicht, Regen, Schnee, Nebelbänke. `drawMood`, `drawWeather`
- `minimap.js` – Minimap. `Minimap`

## Besonderheiten
- Die Klasse `Renderer` liegt in `layers/core.js`; das Verzeichnis Thema → Datei steht im Kopfkommentar von `renderer.js`.
- Fehlt ein gemaltes Bild, zeichnen die einfachen Ersatzformen: 2D `sprites.js`, Iso `isobuild.js` (Gebäude, Kisten, Autos) und `iso.js`.
- Gemalte Bilder immer über `spritecache.js` (je Drehung und Maßstab ein Bild); Stadtgebäude, Werke, Militärgebäude und Natur teilen `isokit.js`.
- Das Kartenbild (Boden mit Wegen und Gleisen) dient Minimap und Editor; im Spiel malt die Stadt der Karte eigene Bilder.
- Gebäudehöhen `BUILD_H` in `iso.js`, Kürzel der 2D-Ansicht `BUILD_ABBR` in `sprites.js`; neue Militärgebäude in `MIL_TYPES` (`milbuild.js`).

Exporte dieses Ordners: `docs/index/render-*.md`, nach Anfangsbuchstaben geteilt, Unterordner `render-layers.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
