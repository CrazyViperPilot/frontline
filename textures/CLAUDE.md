# textures/ – Fotos für Bodenmuster (lädt `js/render/ways.js`)

Alle Bilder: CC0 von [ambientCG](https://ambientcg.com) (gemeinfrei, ohne Namensnennung). Aufbereitet als nahtlose Kachel
256 × 256 px, JPEG Qualität 82, nur die Farbkarte (`_Color`); die Farbe setzt das Spiel je Jahreszeit selbst (`photoTile`).

- `asphalt.jpg` – Asphalt015, einmal je Kachel (64 Weltpixel)
- `pavers.jpg` – Concrete010 (Betonplatten), 2 × 2 je Kachel, also 4 Weltpixel je Platte wie die gemalten

Neues Bild: in `sw.js` unter `ASSETS` eintragen, im Modul über `new URL('…', import.meta.url)` laden (prüft `test/assets.test.js`).
