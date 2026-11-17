# js/render/layers/ – Ebenen und Durchläufe des Renderers

`core.js` hängt die Ebenen per `Object.assign(Renderer.prototype, …)` an die Klasse `Renderer`; die Ebenen importieren `core.js` nie (kein Zyklus).

- `core.js` – Klasse `Renderer`: Konstruktor, `resize`, `render`, `frameOf` (Werte eines Bildes), `worldTransform`
- `top.js` – 2D von oben: `renderTop`, `topGround`, `topObjects`, `topEffects`, `topFog`, `topBars`, `drawSky`
- `isoview.js` – Iso-Bild: `renderIso`, `isoGround`, `isoMarks`, `isoEffects`, `isoFog`, `isoBars`, `isoScreen`
- `passes.js` – Durchläufe als Listen `TOP_PASSES`, `ISO_PASSES` ({ name wie in der Messanzeige, run, when? }); `runPasses` misst je Eintrag
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
- Ein Bild: `render` → `frameOf` (Kamera, `inRect`, Sichtregeln `seen`/`known`/`shown`) → `renderTop`/`renderIso` → `runPasses` (`passes.js`).
- Neuer Durchlauf: Eintrag in `TOP_PASSES` bzw. `ISO_PASSES`, nie `pf.lap` von Hand.
- Nebel: `fogData` liefert dem WebGL-Nebel (`ground.renderFog`) weichgezeichnete Werte; ohne WebGL und für die Minimap `updateFogLayer`.
- Neue Ebene: Methodenobjekt anlegen, in `core.js` einhängen, keine Importe von `core.js`.

Exporte dieses Ordners: `docs/index/render-layers.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
