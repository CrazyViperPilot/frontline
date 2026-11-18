# Symbol-Index render (Teil 3 von 3, nature.js bis works.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render/`. Pfade relativ zu `js/render/`.

## nature.js (Fortsetzung)
- natureShadowIso(ctx, cam, o, t) – Hängt den Schatten eines Baums (t 1), Felsens (2) oder Buschs (13) als Ellipse…
- drawRockIso(ctx, cam, o, season) – Fels in Iso (Fuß am Weltpunkt), in jeder Drehung der Ansicht von der passenden…
- drawRockTop(ctx, o, season, zoom) – Fels von oben (2D) mit Schatten nach rechts unten
- drawAnimalIso(ctx, cam, a, p, now) – Tier in Iso an Bildpunkt p (Boden), Blick nach a.angle (8 Richtungen)
- drawAnimalTopP(ctx, a, zoom, now) – Tier von oben (2D), gedreht nach a.angle, mit Schatten
- natureModels() – Für Tests: alle Felsen- und Tiermodelle (Körper) bauen, ohne zu malen

## props.js (28 KB)
- drawMapCarIso(ctx, cam, c, season) – Geparktes Auto der Karte in Iso (Fuß am Weltpunkt)
- drawMapCarShadowIso(ctx, cam, c, dpr) – Iso: Schatten eines Autos (Umriss von oben am Boden)
- drawMapCarTop(ctx, c, zoom, season) – Geparktes Auto von oben (2D, Weltkoordinaten, Kamera-Transformation gesetzt)
- drawBenchIso(ctx, cam, b, season) – Parkbank in Iso (Fuß am Weltpunkt), in 16 Richtungen
- drawBenchShadowIso(ctx, cam, b, dpr) – Iso: Schatten einer Bank (Umriss von oben am Boden)
- drawBenchTop(ctx, b, zoom, season) – Parkbank von oben (2D, Weltkoordinaten)
- drawBaleIso(ctx, cam, b, season) – Ballen in Iso (Fuß am Weltpunkt) in 8 Richtungen
- drawBaleShadowIso(ctx, cam, b, dpr) – Iso: Schatten eines Ballens (Umriss von oben am Boden)
- drawBaleTop(ctx, b, zoom, season) – Ballen von oben (2D, Weltkoordinaten)
- drawCrateIso(ctx, cam, x, y, s, base, glow) – Versorgungskiste in Iso: Kantenlänge s (Welt-Pixel), base = Höhe über dem Boden…
- drawCrateTop(ctx, x, y, s, zoom, glow) – Versorgungskiste von oben (2D, Weltkoordinaten): Kantenlänge s, glow = liegt am…

## reliefimg.js (7.5 KB)
- reliefLayers(relief, width, height) – Ebenen für das Geländebild der Karte (Größe = Karte × RELIEF_SCALE): mat = Mate…
- reliefTiles(relief, width, height) – Geländebild für den Karteneditor in Kacheln (mat und shade wie reliefLayers), d…
- updateReliefTiles(t, relief, x0, y0, x1, y1) – Weltrechteck [x0, x1] × [y0, y1] des Editor-Geländebilds neu zeichnen (nach Heb…
- drawReliefTiles(ctx, t, layer, ox, oy, s, vw, vh) – Sichtbare Kacheln einer Ebene ('mat' oder 'shade') zeichnen

## renderer.js (1.8 KB)
- Renderer (aus core.js) – Haupt-Renderer (docs/archiv/verlauf.md §5 render/renderer.js)
- MAX_DPR_SHARP (aus consts.js)
- MAX_DPR_FAST (aus consts.js)
- makeFogLayer (aus fog.js)
- fogTone (aus fog.js)
- blur121 (aus fog.js)
- updateFogLayer (aus fog.js)

## season.js (6.1 KB)
- seasonal(img, season, kind, f, variant) – Bild in der Jahreszeit (Sommer: das Bild selbst)
- setRoofSnow(on)
- roofSnowOn() – Liegt gerade Schnee (Iso-Stadt im Winter)? Für Rasen und Laub der Stadtgebäude…
- snowy(color) – Dachfarbe unter Schnee (Hex-Farbe); ohne Schnee unverändert

## spritecache.js (6.6 KB)
- spriteDpr() – Gerätepixel je CSS-Pixel des laufenden Bilds (für den Maßstab der Bilder)
- spriteFrame(r) – Zu Beginn jedes Bilds aufrufen (Renderer): merkt die Gerätepixel, setzt das Zei…
- sprite(key, scale, bounds, paint) – Bild der Variante `key` für `scale` Gerätepixel je Einheit
- peek(key, scale) – Vorhandenes Bild der Variante `key` (Maßstab am nächsten an `scale`), ohne neu…
- blit(ctx, e, x, y, f) – Eintrag e so zeichnen, dass sein Ankerpunkt bei (x, y) liegt; f = Zeichenkoordi…
- spriteStats() – Für Tests und Fehlersuche: Zahl der Bilder und Bildpunkte im Speicher

## sprites.js (25 KB)
- shade(hex, f) – Farbe abdunkeln (f = 0 unverändert, 1 schwarz)
- tint(hex, f) – Farbe aufhellen (f = 0 unverändert, 1 weiß)
- hexA(hex, a) – Hex-Farbe mit Alpha als rgba-String
- hpColor(frac) – Farbe für Lebensbalken: grün, gelb, rot
- fitText(ctx, text, x, y, px, zoom, maxW) – Text in Weltkoordinaten, Schriftgröße in Bildschirm-Pixeln (px), verkleinert be…
- drawBar(ctx, x, y, w, h, frac, color, px, ticks) – Lebensbalken (Welt-Maße)
- drawUnit(ctx, u, color, zoom, aim, now, iso) – Einheit von oben
- drawUnitSymbol(ctx, x, y, a, color, k, air)
- drawBuilding(ctx, b, color, zoom, pic)
- CRATE_MARK – Markierung (Gurtschloss, Minimap)
- drawCrate(ctx, x, y, s, zoom, glow) – Versorgungskiste von oben: olivgrüne Kiste (Kantenlänge s) mit zwei Gurten und…
- drawStar(ctx, x, y, r, zoom) – Goldener Stern (Kommandeur) mit Mittelpunkt (x, y), Radius r (Welt-Maße); gemal…
- drawAnimalTop(ctx, a, zoom) – Tier von oben (Weltkoordinaten, gedreht nach Laufrichtung): Reh mit hellem Spie…
- drawAnimalSide(ctx, a, x, y, k, right) – Tier in der Seitenansicht (isometrisch, Bildschirmkoordinaten): Fußpunkt (x, y)…

## stronghold.js (15 KB)
- worksMask(h) – Ausbauten eines Hauses als Bitmaske: 1 Sandsäcke, 2 MG-Nest, 4 Stacheldraht
- drawHouseWorksIso(ctx, cam, h, part) – Ausbauten eines Hauses isometrisch (Ankerpunkt = Hausmitte am Boden, Kamera mit…
- drawHouseFlagIso(ctx, cam, h, color, t) – Fahne am besetzten Haus (Iso): Mast an der linken Ecke des Hauses (außen), jede…
- drawHouseWorksTop(ctx, h, zoom) – Ausbauten von oben (2D, Weltkoordinaten, Kamera-Transformation gesetzt)
- drawHouseFlagTop(ctx, h, color, t) – Fahne von oben (2D, Weltkoordinaten): Mast an der linken unteren Ecke, Tuch nac…

## terrain.js (23 KB)
- parkDeco(p) – Ausstattung eines Parks (deterministisch aus Lage und Größe): Bäume am Rand, vi…
- invalidateTerrain(map) – Karte wurde verändert (Editor): zwischengespeicherte Geländebilder verwerfen
- buildTerrain(map, mode) – Bodenbild: Bodenrauschen, Gelände (Fels, Seen, Schummerung), Hindernisse (Felse…
- drawMapObjects(ctx, map, S, iso, rng, paved, town, nature) – Straßen, Bahn, Stadt, Bäume und Hindernisse einer Karte auf ein Canvas (Maßstab…
- roadJunctions(roads) – Schnittpunkte und Stoßstellen der Straßen (Kreuzungen, T- und L-Einmündungen):…
- railList(town) – Gleise einer Karte: neue Form `rails` (freie Strecken) oder die ältere `rail` (…

## townhouses.js (55 KB)
- beginTownFrame(ratio) – Zu Beginn jedes Bilds (Renderer): Gerätepixel je CSS-Pixel merken und das Zeitb…
- townLift(ck, level) – Höhe (Weltpixel) über dem höchsten Teil, für das Schild darüber
- drawTownIso(ctx, cam, b, season) – Isometrisch: Gebäude b als Bild aus dem Zwischenspeicher (für jede Drehung dass…
- drawTownTop(ctx, b, zoom) – 2D von oben: Gebäude b als Bild aus dem Zwischenspeicher (Weltkoordinaten, Kame…

## unitpaint.js (20 KB)
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

## ways.js (26 KB)
- groundPattern(ctx, kind, season) – Muster für Boden-Flächen: 'asphalt', 'pavers' (Gehweg), 'dirt', 'rut', 'gravel'…
- patternMatrix(u) – Transformation eines Musters: flach (Weltkoordinaten) oder auf die Iso-Achsen u…
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
