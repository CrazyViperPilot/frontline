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
- Einheiten (`unit3d`), Bäume (`tree3d`), Häuser und Werke (`house3d`) fragt `isoObjects` nur in „Objekte“; `trees3dOn`, `towns3dOn`,
  `works3dOn` schalten auf gemalt (Dampf der Werke: `drawWorksSteam`). Einheit mit Mesh: gemalt nur Rotoren, Nachbrenner; Schatten wirft das Mesh.
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
- Pixeldichte: `gl.setPixelRatio(dpr)`.
