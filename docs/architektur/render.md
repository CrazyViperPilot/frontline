# Architektur der Darstellung (`js/render/`)

Ausgelagert aus `js/render/CLAUDE.md` (dort nur die Dateiliste). Ansicht 3D: `docs/architektur/render3d.md`.

## Besonderheiten
- Die Klasse `Renderer` liegt in `layers/core.js`; das Verzeichnis Thema → Datei steht im Kopfkommentar von `renderer.js`.
- Fehlt ein gemaltes Bild, zeichnen die einfachen Ersatzformen: 2D `sprites.js`, Iso `isobuild.js` (Gebäude, Kisten, Autos) und `iso.js`.
- Gemalte Bilder immer über `spritecache.js` (je Drehung und Maßstab ein Bild); Stadtgebäude, Werke, Militärgebäude und Natur teilen `isokit.js`.
- Das Kartenbild (Boden mit Wegen und Gleisen) dient Minimap und Editor; im Spiel malt die Stadt der Karte eigene Bilder.
- Gebäudehöhen `BUILD_H` in `iso.js`, Kürzel der 2D-Ansicht `BUILD_ABBR` in `sprites.js`; neue Militärgebäude in `MIL_TYPES` (`milbuild.js`).
