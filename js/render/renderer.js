// Haupt-Renderer (docs/verlauf.md §5 render/renderer.js). Zeichnet Terrain, Zone, Gebäude, Einheiten,
// Granaten, Effekte, Nebel und Overlays. Liest game.projectiles/effects bei jedem Aufruf frisch. Kein Zugriff auf den Controller.
// Seit dem Umbau „Renderer in Module geteilt“ ist diese Datei nur noch der Einstieg: sie führt die Namen zusammen, die andere Dateien
// importieren. Der Code liegt in Zeichenebenen unter js/render/layers/ (Methoden der Klasse Renderer, eingehängt per Object.assign):
//   Thema                                                       Datei (js/render/layers/)
//   Klasse Renderer: Konstruktor, Größe, ein Bild, frameOf      core.js
//   2D von oben: Boden, Objekte, Effekte, Nebel, Balken, Hinweise   top.js
//   Boden und Relief: Zeichnen auf dem Boden, Welt ↔ Bildschirm, Nebel-Bytes, Bäume   relief.js
//   Iso: Bild, Boden, Markierungen, Effekte, Nebel, Balken      isoview.js
//   Iso: Objekte (Liste, Schatten, Reihenfolge, Stadtteile, Einheiten)   isoitems.js
//   Gemeinsam: Kisten, Narben, Trümmer, Rauch, Bodenhöhe        world.js
//   Zonen: Konfliktzone, Eroberung (Flaggen), Hot Zone          zones.js
//   Radien gewählter Einheiten und Gebäude, Luftraum, Mörser    radii.js
//   Ruinen, Feuerbereich der Häuser, Besatzung                  garrison.js
//   Auswahlring, Routen, Marker, Balken, Ziehrahmen, Hinweise   overlays.js
//   Nebel als Canvas-Ebene (Minimap, Geräte ohne WebGL)         fog.js
//   Gemeinsame Konstanten                                       consts.js
export { Renderer } from './layers/core.js';
export { MAX_DPR_SHARP, MAX_DPR_FAST } from './layers/consts.js';
export { makeFogLayer, fogTone, blur121, updateFogLayer } from './layers/fog.js';
