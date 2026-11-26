# js/render3d/ – Darstellung mit three.js (Plan `docs/plan-3d.md`, Test: Ansicht „3D“, `?three=1`)

Liest den Spielzustand, ändert ihn nie. Darf `js/render/` lesen (Kamera, Modelle, Farben, Sprite-Cache), nie umgekehrt.
three nur aus `../vendor/three/three.module.min.js` (Regel 5).

- `renderer3d.js` – `Renderer3D` (Unterklasse von `Renderer`, gleiche Schnittstelle), `make3D` (WebGL, Rückfall null)
- `ground3d.js` – 3D-Boden: Höhennetz, Erdschnitt (`FS_GROUND` aus `render/ground.js`), Wasser-Netz (`FS_WATER`). `Ground3D`
- `fog3d.js` – 3D-Nebel: Kriegsnebel (`FS_FOG`) auf dem Bodennetz, Textur aus `fogData`. `Fog3D`
- `units3d.js` – Einheiten als Meshes (Wanne, Turm, stufenlose Drehung). `Units3D`
- `trees3d.js` – Bäume als InstancedMesh je Form, grob fern. `Trees3D`, `treeGeometry`
- `nature3d.js` – Büsche, Felsen, Tiere je Form instanziert (`bush3d` …, `nature3dOn`). `Nature3D`
- `sun3d.js` – Sonne, Schattenkarte über dem Ausschnitt, Schattenfänger, Stufen. `Sun3D`, `CATCH`, `CAST`
- `billboards.js` – gemalte Bilder (`spritecache.blit`) als Vierecke aus einem Atlas (≤ 4 Seiten). `Billboards`
- `camera3d.js` – three-Kamera aus `Camera`: `makeWorldRoot`, `syncIsoCamera`, `projectWorld`, `clipDepth`
- `testscene.js` – Prüfwürfel (`?three=1&cubes=1`). `probePoints`, `buildTestCubes`
- `solids3d.js` – Körperliste (render/units/shapes.js) → three-Geometrie: `solidsToGeometry`, `buildModelMesh`, `modelGeometry`
- `kit3d.js` – Gebäude-Baukasten (Teile wie isokit.js, alle Seiten). `Kit3D`, `makeKitMaterial`, `setKitFrame`, `kitMesh`
- `town3d.js` – Stadthäuser 1 × 1 (alle Arten, Stufen), InstancedMesh je Variante. `townGeometry`, `Town3D`

## Schichtung
- Ansicht „3D“ = `camera.iso && camera.three`; V schaltet 2D → Iso → 3D (`main.js` `toggleView`, lädt three nach).
- Die Iso-Durchläufe (`ISO_PASSES`) laufen wie bisher in die 2D-Leinwand; `swaps` (Name → Ersatz, `runPasses` über `isoSwap`)
  ersetzt „Gelände“, „Objekte“ (Billboards, Einheiten unter `objRoot`, samt Luftfahrzeugen: „Flieger“ fällt weg) und „Nebel“.
  Jedes three-Bild wird an seiner Stelle in die 2D-Leinwand kopiert; Bodenmarken, Wetter, Stimmung, Balken bleiben gemalt.
- „Objekte“: `setBlitSink` macht aus jedem `blit` ein Billboard mit der Tiefe des Fußpunkts (`clipDepth`); was nicht über `blit`
  malt (Rotoren, Flammen), kommt über eine 2D-Zwischenleinwand obenauf.
- Einheiten (`unit3d`), Bäume (`tree3d`), Stadthäuser (`house3d`) fragt `isoObjects` nur in „Objekte“; `trees3dOn`, `towns3dOn`
  schalten auf gemalt. Einheit mit Mesh: gemalt nur Rotoren, Nachbrenner; Schatten wirft das Mesh (`shadow3d`), außer Soldaten.
- WebGL-Leinwand nicht im DOM, ohne Kantenglättung; `render/ground.js` behält seinen Kontext.

## Licht und Schatten (`sun3d.js`)
- Sonne = `lightVec` (wie Bodenlicht, Gebäudeschatten; dreht mit der Kamera). Nacht: `drawMood`.
- Schattenfänger statt Boden-Shader (der käme ein Bild zu spät): in „Objekte“ Render 1 mit Ebene
  `CATCH` (Karte aus Werfern auf `CAST`, Fänger = Bodennetz mit `ShadowMaterial`), Tiefe löschen, Render 2 Ebene 0.
- Karte: Bildecken × Geländehöhen im Lichtraum + `margin`, Größe auf `snap` gerundet, Mitte aufs Texel-Raster (kein Flimmern).
- Werfer: `castShadow`, `layers.enable(CAST)` (Bäume: grobe Form). Empfangen: nur Baukasten (`lights: true`).

## Achsen (`camera3d.js`)
- Kinder einer Wurzelgruppe (`groundRoot`, `objRoot`) liegen in Weltkoordinaten: x, y wie im Spiel, z = Höhe in Welt-px.
- Wurzelgruppe: three X = x, three Y = z · 1/cos 30° (`HEIGHT_SCALE`, oben), three Z = y. Spiegelnd; three kehrt den Umlaufsinn
  selbst um. Flächen in Bild- oder Clip-Koordinaten (Billboards, Erdschnitt) brauchen `side: DoubleSide`.
- Kamera orthografisch, 30° nach unten, Blick entlang −`camera.depthDir()`, Drehung aus `ROT[cam.rot]`; Bildbreite = viewW / zoom.
  Ergebnis: `projectWorld(x, y, h)` = `camera.worldToScreen(x, y)` (Prüfung `tools/smoke-3d.mjs`, unter 1 px).
- Pixeldichte: `gl.setPixelRatio(dpr)`.
