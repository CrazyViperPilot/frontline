# Symbol-Index render (Teil 4 von 4, works.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render/`. Pfade relativ zu `js/render/`.

## works.js (Fortsetzung)
- lorry(g, u, v, along, cabCol, load, o) – LKW entlang u oder v (Fahrerhaus vorn bei +u bzw. +v); load: 'bricks', 'tank',…
- pallet(g, u, v, s, h, col) – Palette mit Ziegeln (oder anderer Ware), Kantenlänge 2s, Höhe h
- forklift(g, u, v, col) – Gabelstapler (orange) mit Palette auf der Gabel nach +u.
- ringTop(c, x, y, r, color, w)
- roundShadow(c, x, y, r, h, a) – Schatten eines runden Baus der Höhe h: Scheibe r, nach rechts unten gezogen
- discTop(c, x, y, r, color, edge) – Runde Scheibe mit Lichtverlauf und dünnem Rand
- blockTop(c, x0, y0, x1, y1, H, wall, deck) – Gebäude mit Flachdach: Schatten, Attika, Dachfläche
- pipeTop(c, pts, w, col) – Rohr von oben (Linienzug) mit Schatten und Glanzlinie
- palletTop(c, x, y, s, col) – Palette von oben (Holzrand, Ware)
- lorryTop(c, x, y, along, cabCol, load, o) – LKW von oben (Fahrerhaus bei +x bzw. +y)
- forkliftTop(c, x, y, col) – Gabelstapler von oben mit Palette vorn (+x)
- worksLift(kind, level) – Höhe (Weltpixel) über dem höchsten Teil, für das Schild darüber
- drawWorksIso(ctx, cam, b, season) – Isometrisch: das ganze Werk als Bild aus dem Zwischenspeicher (für jede Drehung…
- drawWorksTop(ctx, b, zoom) – 2D von oben (Weltkoordinaten, Kamera-Transformation gesetzt)
