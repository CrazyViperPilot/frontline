# Architektur der Ansicht 3D (`js/render3d/`)

Ausgelagert aus `js/render3d/CLAUDE.md` (dort nur die Dateiliste). Lesen, wenn es um Durchläufe, Hooks der Iso-Maler,
Licht und Schatten oder Achsen und Kamera der Ansicht 3D geht. Plan und Stand der Pakete: `docs/plan-3d.md`.

## Schichtung
- Ansicht „3D“ = `camera.iso && camera.three`; V schaltet 2D → Iso → 3D (`main.js` `toggleView`, lädt three nach).
- Die Iso-Durchläufe (`ISO_PASSES`) laufen wie bisher in die 2D-Leinwand; `swaps` (Name → Ersatz, `runPasses` über `isoSwap`)
  ersetzt „Gelände“, „Objekte“ (Billboards, Einheiten unter `objRoot`, samt Luftfahrzeugen: „Flieger“ fällt weg) und „Nebel“.
  Jedes three-Bild wird an seiner Stelle in die 2D-Leinwand kopiert; Bodenmarken, Wetter, Stimmung, Balken gemalt.
- „Objekte“: `setBlitSink` macht aus jedem `blit` ein Billboard mit der Tiefe des Fußpunkts (`clipDepth`); was nicht über `blit`
  malt (Rotoren, Flammen), kommt über eine 2D-Zwischenleinwand obenauf.
- „Effekte“ (`fx3dPass`, `fx3d.js`, Schalter `fx3dOn`): Bodenteile gemalt (`isoFxGround`), Teilchen in eigener Szene ohne Löschen der Tiefe aus
  „Objekte“ (3D-Körper davor verdecken, Gelände nicht), Kopie nur des Teilchen-Rechtecks; Minen und Wegziel danach gemalt (`isoMoveMark`).
- Einheiten (`unit3d`), Bäume (`tree3d`), Häuser, Werke und Großbauten (`house3d`), Regierungsgebäude (`hall3d`), Regierungsviertel (`quarter3d`) fragt
  `isoObjects` nur in „Objekte“; `trees3dOn`, `towns3dOn`, `works3dOn`, `big3dOn` schalten auf gemalt (Dampf der Werke: `drawWorksSteam`).
- Großbauten bestehen in `cityBuildings` aus vielen Objekten (`bigpart`, je Körper) mit gemeinsamem `plan`: `Town3D` zeigt die Anlage einmal je Bild
  (Familie mit `at`), Bäume und Ausstellungsstücke bleiben gemalte Billboards; das Viertel ein Mesh je Hauptstadt (Drehung und Maske der freien Gruppen). Einheit mit Mesh: gemalt nur Rotoren, Nachbrenner; Schatten wirft das Mesh.
- Props (t 6, 7, 8, 14, 16: Autos, Bänke, Kisten, Ballen, Props der Karte) über `prop3d(t, o)` und `crate3d` (`props3d.js`, Schalter `props3dOn`); Busch und Fels
  der Karte gehen über `nature3d`. Zäune, Mauern: je Kachel eine Instanz (Arme schon in der Kachel verbunden); Fahnentuch: Teamfarbe der Instanz.
- Militärgebäude (`type 4`, Art ohne Hauptstadt) über `mil3d(b, color)`, Ausbauten besetzter Häuser über `fort3d(h)` (`mil3d.js`, Schalter `mil3dOn`): Familie „mil“ in `town3d.js`, eine Geometrie je Art und Variante (Mauer: Nachbarmaske in Weltrichtung, Baustelle: Stufe, beschädigt: dunklere Farben), Teamfarbe der Instanz; Fahne der besetzten Häuser bleibt gemalt (flattert).
- Fliegerhorst (Körper `t 'ab'` der Großbauten `stand`, `atc`, `ktank`, `mdepot`; `airbase3d.js`, Schalter `airbase3dOn`): Familie „airbase“ in `town3d.js` wie „big“ (eine Instanz je Anlage über `at`, Teamfarbe der Instanz); Dach der Überdachung und Röhre des Shelters sind ein zweiter, halb durchsichtiger Satz (`glass`, `alpha`: Material mit `uOpacity`, ohne Tiefe und Schatten, `renderOrder` 5), damit der abgestellte Jet zu sehen bleibt. Boden bleibt gemalt (Durchlauf „Boden“).
- Baustellen der Stadt (`kind 'site'`, `site3d.js`, Schalter `site3dOn`) und Schutt (`cityruin` der Stadt, eingestürzte Häuser der Kartenstadt, Gebäude-Wracks als `ruin3d`; `rubble3d.js`, Schalter `ruin3dOn`, Hook `ruin3d(r, burnt, sink)` in `isoitems.js`): Familien „site“ und „ruin“ in `town3d.js`, eine Geometrie je Größe, Abschnitt, Variante und Farbe bzw. je Art, Maß, ausgebrannt und Schuttvariante (16, aus `rubblePlan` in `isobuild.js`, den auch das gemalte Bild nutzt); Familienfeld `scaleZ(b)` streckt die Höhe der Instanz (Wrack sinkt in den letzten `wreckFade` Sekunden ein statt zu verblassen). Boden der Baustelle (Erde) bleibt gemalt.
- Brücken und Furtstangen (`bridge3d.js`, Schalter `bridge3dOn`): je Brücke ein Netz in Brückenkoordinaten (Zustand im Schlüssel), Eintrag `t: 17` der Objektliste (`bridge3d(b)`) und `ford3d(p)` für `t: 12`; der Durchlauf „Boden“ malt dann nur Gischt (`drawBridgeIso(…, 'foam')`) und ohne Schattenkarte den Schatten (`bridge3dGround`); Einheiten stehen auf `b.deckH` (`groundHeight`).
- Kartenstadt (`maptown3d.js`): dieselbe Familienliste (`house3d`, `maptown3dOn`); Instanz mit Drehung und Streckung (`yaw`, `scale` der Familie), Leitung als Linien (`Wires3D`, ersetzt den gemalten Durchlauf „Leitungen“ über `wires3dShown`).
- WebGL-Leinwand nicht im DOM, ohne Kantenglättung.

## Licht und Schatten (`sun3d.js`)
- Sonne = `lightVec` (wie Bodenlicht, Gebäudeschatten; dreht mit der Kamera). Nacht: `drawMood`.
- Schattenfänger statt Boden-Shader (käme ein Bild zu spät): in „Objekte“ Render 1 mit Ebene
  `CATCH` (Karte aus Werfern auf `CAST`, Fänger = Bodennetz mit `ShadowMaterial`), Tiefe löschen, Render 2 Ebene 0.
- Karte: Bildecken × Geländehöhen im Lichtraum + `margin`, Größe auf `snap` gerundet, Mitte aufs Texel-Raster.
- Werfer: `castShadow`, `layers.enable(CAST)` (Bäume: grobe Form). Empfangen: nur Baukasten (`lights: true`).

## Achsen (`camera3d.js`)
- Kinder einer Wurzelgruppe (`groundRoot`, `objRoot`) liegen in Weltkoordinaten: x, y wie im Spiel, z = Höhe in Welt-px.
- Wurzelgruppe: three X = x, three Y = z · 1/cos 30° (`HEIGHT_SCALE`, oben), three Z = y. Spiegelnd; three kehrt den Umlaufsinn
  selbst um. Flächen in Bild- oder Clip-Koordinaten (Billboards, Erdschnitt) brauchen `side: DoubleSide`.
- Kamera orthografisch, 30° nach unten, Blick entlang −`camera.depthDir()`, Drehung aus `ROT[cam.rot]`; Bildbreite = viewW / zoom.
  Ergebnis: `projectWorld(x, y, h)` = `camera.worldToScreen(x, y)` (Prüfung `tools/smoke-3d.mjs`, unter 1 px).
- Freie Kamera (nur `three`): Drehung `rot · 90° + turn` (`camera.axes()` statt `ROT[rot]`, `turn` in ±45°, `rot` = nächste Vierteldrehung für die
  Wahl gemalter Bilder), Neigung `tilt` 30° … 60° (`tiltNow`, Boden `squash` = sin, Höhen `heightK` = cos/cos 30°, `heightPx(h)`); Bild → Welt mit Gelände
  über den Sichtstrahl (`rayToGround`, vorderste Fläche). Bei turn 0 und 30° rechnet alles bitgleich wie vorher (Test `test/freecam.test.js`).
- Pixeldichte: `gl.setPixelRatio(dpr)`.
