# js/render3d/ – Darstellung mit three.js (Plan `docs/plan-3d.md`, Test: Ansicht „3D“, `?three=1`)

Liest den Spielzustand, ändert ihn nie. Darf `js/render/` lesen (Kamera, Modelle, Farben, Sprite-Cache), nie umgekehrt.
three nur aus `../vendor/three/three.module.min.js` (Regel 5).

- `renderer3d.js` – `Renderer3D` (Unterklasse von `Renderer`, gleiche Schnittstelle), `make3D` (WebGL, Rückfall null)
- `ground3d.js` – 3D-Boden: Höhennetz und Erdschnitt mit dem Shader `FS_GROUND` aus `render/ground.js`. `Ground3D`
- `billboards.js` – gemalte Bilder (`spritecache.blit`) als Vierecke aus einem Atlas (≤ 4 Seiten 2048²). `Billboards`
- `camera3d.js` – three-Kamera aus `Camera`: `makeWorldRoot`, `makeIsoCamera`, `syncIsoCamera`, `projectWorld`, `clipDepth`
- `testscene.js` – Prüfwürfel an Ecken, Mitte, Hauptstadt (`?three=1&cubes=1`). `probePoints`, `buildTestCubes`
- `solids3d.js` – Körperliste (render/units/shapes.js) → three-Geometrie: `solidsToGeometry`, `buildModelMesh`, `modelGeometry`

## Schichtung
- Ansicht „3D“ = `camera.iso && camera.three`; V bzw. „Ansicht“ schaltet 2D → Iso → 3D (`main.js` `toggleView`, lädt three nach).
- Die Iso-Durchläufe (`ISO_PASSES`) laufen wie bisher in die 2D-Leinwand; `swaps` (Name → Ersatz, `runPasses` über `isoSwap`)
  ersetzt „Gelände“ (three: `ground3d.js`) und „Objekte“ (three: Billboards, später 3D-Körper unter `objRoot`). Jedes three-Bild
  wird an seiner Stelle in die 2D-Leinwand kopiert; Bodenmarken, Nebel, Wetter, Stimmung und Balken bleiben dadurch unverändert.
- „Objekte“: `setBlitSink` fängt jedes `blit` ab → Billboard mit der Clip-Tiefe des Objekt-Fußpunkts (`clipDepth`), Malreihenfolge
  wie heute. Was nicht über `blit` malt (Rotoren, Flammen, Ersatzformen), kommt über eine 2D-Zwischenleinwand obenauf.
- Die WebGL-Leinwand hängt nicht im DOM. Der Nebel nutzt weiter `render/ground.js` (eigener Kontext) bis zum Paket „3D-Nebel“.
- Prüfszene `&cubes=1`: nur Gelände und Würfel (Boden, Schatten, Objekte, Wetter fallen weg), Kreuze an `camera.worldToScreen`.

## Achsen (`camera3d.js`)
- Kinder einer Wurzelgruppe (`groundRoot`, `objRoot`) liegen in Weltkoordinaten: x, y wie im Spiel, z = Höhe in Welt-px.
- Wurzelgruppe: three X = x, three Y = z · 1/cos 30° (`HEIGHT_SCALE`, oben), three Z = y. Spiegelnd; three kehrt den Umlaufsinn
  selbst um. Flächen in Bild- oder Clip-Koordinaten (Billboards, Erdschnitt) brauchen `side: DoubleSide`.
- Kamera orthografisch, 30° nach unten, Blick entlang −`camera.depthDir()`, Drehung aus `ROT[cam.rot]`; Bildbreite = viewW / zoom.
  Ergebnis: `projectWorld(x, y, h)` = `camera.worldToScreen(x, y)` (Prüfung `tools/smoke-3d.mjs`, unter 1 px).
- Pixeldichte über `gl.setPixelRatio(dpr)`; `insetTop` wirkt nur auf `centerOn`, nicht auf die Projektion.
