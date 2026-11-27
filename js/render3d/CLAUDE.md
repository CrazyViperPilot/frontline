# js/render3d/ – Darstellung mit three.js (Plan `docs/plan-3d.md`, Test: Ansicht „3D“, `?three=1`)

Liest den Spielzustand, ändert ihn nie. Darf `js/render/` lesen (Kamera, Farben, Sprite-Cache), nie umgekehrt.
three nur aus `../vendor/three/three.module.min.js` (Regel 5).

- `renderer3d.js` – `Renderer3D` (Unterklasse von `Renderer`, gleiche Schnittstelle), `make3D` (WebGL, Rückfall null)
- `ground3d.js` – 3D-Boden: Höhennetz, Erdschnitt (`FS_GROUND` aus `render/ground.js`), Wasser-Netz (`FS_WATER`). `Ground3D`
- `fog3d.js` – 3D-Nebel: Kriegsnebel (`FS_FOG`) auf dem Bodennetz, Textur aus `fogData`. `Fog3D`
- `units3d.js` – Einheiten als Meshes (Wanne, Turm, stufenlose Drehung). `Units3D`
- `trees3d.js` – Bäume als InstancedMesh je Form, grob fern. `Trees3D`, `treeGeometry`
- `nature3d.js` – Büsche, Felsen, Tiere je Form instanziert (`bush3d` …, `nature3dOn`). `Nature3D`
- `props3d.js` – Props der Karte, Autos, Bänke, Ballen, Kisten je Form instanziert (`prop3d`, `props3dOn`). `Props3D`, `formsOf`
- `sun3d.js` – Sonne, Schattenkarte über dem Ausschnitt, Schattenfänger, Stufen. `Sun3D`, `CATCH`, `CAST`
- `billboards.js` – gemalte Bilder (`blit`) als Vierecke aus einem Atlas (≤ 4 Seiten). `Billboards`
- `camera3d.js` – three-Kamera aus `Camera`: `makeWorldRoot`, `syncIsoCamera`, `projectWorld`, `clipDepth`
- `testscene.js` – Prüfwürfel (`?cubes=1`). `probePoints`, `buildTestCubes`
- `solids3d.js` – Körperliste (units/shapes.js) → Geometrie: `solidsToGeometry`, `buildModelMesh`, `modelGeometry`
- `kit3d.js` – Gebäude-Baukasten (Teile wie isokit.js). `Kit3D`, `makeKitMaterial`, `setKitFrame`, `kitMesh`
- `town3d.js` – Gebäudefamilien (Stadthäuser 1 × 1, Werke, Großbauten, Militär), InstancedMesh je Variante. `townGeometry`, `FAMILIES`, `Town3D`
- `works3d.js` – Werke aus dem Baukasten, Teamfarbe je Instanz. `worksGeometry`, `worksKey`
- `bigbuild3d.js` – Kaserne, Fabrikhalle, Lagerhalle, Güterbahnhof, Universität aus dem Baukasten. `bigGeometry`, `uniGeometry`
- `gov3d.js` – Regierungsgebäude und Teile des Regierungsviertels (je Teamdrehung und Gruppenmaske). `hallGeometry`, `quarterGeometry`
- `mil3d.js` – Militärgebäude (FOB, Mauer, Tor, Mörser, Flak, Phalanx, Turm, Bohrer, Baustellen), Ausbauten besetzter Häuser. `milGeometry`, `fortGeometry`

## Besonderheiten
- 3D-Gegenstück eines Iso-Malers: Hook im Maler (`house3d`, `tree3d`, `bush3d` …, nur im Durchlauf „Objekte“), Schalter `…3dOn` im Renderer.
- Schichtung, Hooks, Licht und Schatten, Achsen: `docs/architektur/render3d.md`.
