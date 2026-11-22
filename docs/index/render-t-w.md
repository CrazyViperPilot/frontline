# Symbol-Index render (Teil 4 von 4, townhouses.js bis works.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render/`. Pfade relativ zu `js/render/`.

## townhouses.js (Fortsetzung)
- drawTownTop(ctx, b, zoom) – 2D von oben: Gebäude b als Bild aus dem Zwischenspeicher (Weltkoordinaten, Kame…

## unitpaint.js (21 KB)
- drawUnitIso(ctx, cam, u, p, aim, lift, now) – Einheit in Iso an Bildpunkt p (Boden), lift = Höhe über dem Boden
- drawUnitShadowIso(ctx, cam, u, p, dpr, now) – Schatten in Iso: Umriss des Modells von oben, flach auf den Boden gelegt (Boden…
- drawUnitTop(ctx, u, zoom, aim, now) – Einheit von oben (2D), Weltkoordinaten (Transform des Renderers)
- drawWreckIso(ctx, cam, w, p) – Wrack in Iso: verkohltes Modell (Wanne und Turm) am Boden
- drawWreckTop(ctx, w, zoom, a) – Wrack von oben (2D): dasselbe verkohlte Modell wie in Iso, gedreht wie das Fahr…
- unitModelTypes() – Für Tests: alle Modelle bauen lassen (Körper, Maße), ohne zu malen
- unitModel (= modelOf)
- unitLook (= lookOf)
- PAINT – Malwerkzeug für andere gemalte Modelle (Tiere und Felsen in nature.js): Körper,…
- paintOf
- teamKey (= keyOf)
- SHOWROOM

## university.js (20 KB)
- OUTLINE
- DETAIL – darunter keine Fenster, Säulen und Rippen (Leistung, zu klein zum Sehen)
- lit(color, nu, nv, nh)
- FACE
- iso(ctx, cam, b) – Zeichenkontext für eine Universität: Projektion lokaler Koordinaten (u, v nach…
- poly(g, pts, fill, stroke)
- box(g, u0, u1, v0, v1, h0, h1, wall, top, stroke) – Quader: sichtbar sind die Wand nach +v (links), nach +u (rechts) und das Dach
- pyramid(g, cu, cv, s, h, rh, color) – Pyramidendach (Turm) über dem Quadrat ±s um (cu, cv) ab Höhe h, Spitze rh höher…
- tree(g, u, v, s)
- drawUniversityIso(ctx, cam, b) – Isometrisch: ganze Anlage in einem Zug (hinten nach vorne)
- drawUniversityTop(ctx, b) – 2D von oben (Weltkoordinaten, Kontext skaliert): Kreuzbau mit Kuppel, Portalen,…
- UNI_LAWNS – Rasen und Wege des Hofs (Weltkoordinaten relativ zur Mitte): vier Rasenflächen…

## ways.js (29 KB)
- groundPattern(ctx, kind, season) – Muster für Boden-Flächen: 'asphalt', 'pavers' (Gehweg), 'dirt', 'rut', 'gravel'…
- patternMatrix(u) – Transformation eines Musters: flach (Weltkoordinaten) oder auf die Iso-Achsen u…
- invalidateWays() – Karte wurde an Ort und Stelle verändert (Editor): Feldwege, Gleise und Felder b…
- drawWays(ren, ctx, season) – Feldwege und Gleise unter allem anderen (direkt nach dem Boden)
- drawCityRails(ren, ctx, list, key, season) – Gleise der Stadt zeichnen, mit denselben Farben und Maßen wie die Gleise der Ka…

## weatherfx.js (9.6 KB)
- windDrift(t) – Weg des Windes bis zur Zeit t (px, Integral von 14 + 22 · Böe): Flocken treiben…
- drawWeather(ctx, weather, cssW, cssH, now, cam) – Wetter über die Welt zeichnen (ctx in CSS-Pixeln, Transform = dpr)

## works.js (82 KB)
- WORKS_KINDS
- WORKS_GROUND – Boden unter dem fertigen Werk (sichtbar am Rand des Grundstücks)
- shadowRound(g, u, v, r, h, a) – Schatten eines runden Bauteils nach links unten (wie shadow() für Quader, nach…
- gate(g, face, plane, a, w, h, col) – Rolltor mit Rahmen und Lamellen in einer Wand (Mitte a, Breite w, Höhe h)
- strip(g, face, plane, a0, a1, h0, h1, step, glow) – Durchgehendes Fensterband mit Pfosten (a0…a1, Höhe h0…h1); glow = warm beleucht…
- walls(g, u0, u1, v0, v1, H, wall, o) – Wände einer Halle mit Schatten und Sockel (o.ribs: Wellblech, o.band: Band unte…
- tank(g, u, v, r, H, o) – Lagertank: Mantel mit Nähten, Band in Teamfarbe, Treppe außen, Kegeldach oder (…
- bund(g, u0, u1, v0, v1, part, h) – Auffangwanne (niedrige Betonmauer) um [u0,u1]×[v0,v1]: part 'back' hintere Seit…
- pipe(g, pts, d, col) – Rohr als Linienzug durch Punkte [u, v, h] mit Glanzlinie (d = Durchmesser)
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
