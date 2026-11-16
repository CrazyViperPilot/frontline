# js/render/layers/ – Ebenen und Durchläufe des Renderers

`core.js` hängt die Ebenen per `Object.assign(Renderer.prototype, …)` an die Klasse `Renderer`; die Ebenen importieren `core.js` nie (kein Zyklus).

- `core.js` – Klasse `Renderer`: Konstruktor, `resize`, `render`, `frameOf` (Werte eines Bildes), `worldTransform`
- `top.js` – 2D von oben: `renderTop`, `topGround`, `topObjects`, `topEffects`, `topFog`, `topBars`, `drawSky`
- `isoview.js` – Iso-Bild: `renderIso`, `isoGround`, `isoMarks`, `isoEffects`, `isoFog`, `isoBars`, `isoScreen`
- `isoitems.js` – Iso-Objekte nach Tiefe sortiert. `isoItems`, `isoShadows`, `isoObjects`, `drawUnitIsoAt`
- `relief.js` – Boden und Relief: `syncRelief`, `groundAt`, `groundLine`, `fogData`, `lightVec`, `buildDeco`
- `world.js` – gemeinsames Welt-Zeug: Kisten `crateMarks`, Narben `drawScars`, Trümmer `drawRubble`, `smokeSources`
- `zones.js` – Zonen und Eroberung. `drawZone`, `drawConquest`, `drawHot`
- `radii.js` – Radien gewählter Einheiten und Gebäude. `drawRadii`, `drawAirRadius`, `drawMortarRange`
- `garrison.js` – Ruinen, Feuerbereich und Besatzungsschild der Häuser. `drawRuins`, `drawWindows`, `fortShown`
- `overlays.js` – Marker und Überlagerungen. `drawSelectRing`, `drawRoutes`, `drawPlacement`, `drawHp`, `drawDragBox`
- `fog.js`, `consts.js` – Nebel als Canvas-Ebene (`makeFogLayer`, `updateFogLayer`, `blur121`); gemeinsame Konstanten (`TILE`, `W`, `H`, `MAX_DPR_*`)

## Besonderheiten
- Jede Ebene ist ein Objekt mit Methoden (`topMethods`, `isoViewMethods`, …), das `core.js` einhängt; Methoden rufen sich über `this` auf.
- Ein Bild läuft in Durchläufen: `render` → `frameOf` (Kamera, Ausschnitt `inRect`, Sichtregeln `seen`/`known`/`shown`) → `renderTop` oder `renderIso`.
- Nebel: `fogData` liefert dem WebGL-Nebel (`ground.renderFog`) weichgezeichnete Werte; ohne WebGL und für die Minimap `updateFogLayer`.
- Neue Ebene: Methodenobjekt anlegen, in `core.js` einhängen, keine Importe von `core.js`.
