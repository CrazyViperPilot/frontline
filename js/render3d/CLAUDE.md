# js/render3d/ – Darstellung mit three.js (Plan `docs/plan-3d.md`, Test hinter `?three=1`)

Liest den Spielzustand, ändert ihn nie. Darf `js/render/` lesen (Kamera, Modelle, Farben, Sprite-Cache), nie umgekehrt.
three nur aus `../vendor/three/three.module.min.js` (Regel 5).

- `renderer3d.js` – `Renderer3D` (Unterklasse von `Renderer`, gleiche Schnittstelle), `make3D` (Leinwand, WebGL, Rückfall null)
- `camera3d.js` – three-Kamera aus `Camera`: `makeWorldRoot`, `makeIsoCamera`, `syncIsoCamera`, `projectWorld`, `HEIGHT_SCALE`
- `testscene.js` – Prüfwürfel an Ecken, Mitte, Hauptstadt (`?three=1&cubes=1`). `probePoints`, `buildTestCubes`

## Schichtung
- `#view3d` (three, WebGL) liegt unter `#view` (2D-Canvas); in Iso ist `#view` durchsichtig (Klasse `over3d`), in 2D ist `#view3d` versteckt.
- Ein Iso-Bild: erst `Renderer.render` (2D-Durchläufe aus `ISO_PASSES`), dann three. Durchläufe, die three übernimmt, stehen mit
  ihrem Namen in `takes`; `runPasses` lässt sie aus (`isoSkip`). Wer „Boden“ übernimmt, löscht die 2D-Leinwand vor dem Bild.
- Messanzeige (F3): Ebene „3D“ = Szene abgleichen und `gl.render`.

## Achsen (`camera3d.js`)
- Kinder von `world` (Wurzelgruppe) liegen in Weltkoordinaten: x, y wie im Spiel, z = Höhe in Welt-px (wie `relief.displayAt`).
- `world` bildet ab: three X = x, three Y = z · 1/cos 30° (oben), three Z = y. Spiegelnd; three kehrt den Umlaufsinn selbst um.
- Kamera orthografisch, 30° nach unten, Blick entlang −`camera.depthDir()`, Drehung aus `ROT[cam.rot]`; Bildbreite = viewW / zoom.
  Ergebnis: `projectWorld(x, y, h)` = `camera.worldToScreen(x, y)` (Prüfung `tools/smoke-3d.mjs`, unter 1 px).
- Pixeldichte über `gl.setPixelRatio(dpr)`; `insetTop` wirkt nur auf `centerOn`, nicht auf die Projektion.
