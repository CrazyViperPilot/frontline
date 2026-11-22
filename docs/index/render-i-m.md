# Symbol-Index render (Teil 2 von 4, iso.js bis marks.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render/`. Pfade relativ zu `js/render/`.

## iso.js (Fortsetzung)
- wallPoint(w, t, hpx, off) – Punkt auf einer Wand von drawBox: t = Lage entlang der Wand (0–1, in Richtung d…
- wallQuad(w, t0, t1, h0, h1, off) – Viereck auf einer Wand (t0–t1 entlang, h0–h1 Höhe in Pixeln, off nach außen)
- drawTree(ctx, cam, t, season) – Baum: Schatten, Stamm und zwei Kronenkugeln (aufrecht), Krone nach Jahreszeit
- drawRock(ctx, cam, o) – Fels: Schatten und flacher Brocken (aufrecht)
- fitText
- hexA

## isobuild.js (37 KB)
- drawCar(ctx, cam, c) – Geparktes Auto als kleiner Körper mit Kabine (aufrecht ausgerichtet an x oder y…
- drawBench(ctx, cam, b) – Parkbank (seit v5.23 aus Latten): drei Sitz- und zwei Lehnenlatten auf gusseise…
- drawTownBuilding(ctx, cam, b, season) – Gebäude der Stadt (Haus, Halle, Fabrik) mit Fenstern, Türen, Toren, Balkonen un…
- drawTeamBuilding(ctx, cam, b, color) – Spielgebäude (Team): seit v5.21 sind alle Militärgebäude und ihre Baustellen ge…
- hexA
- drawCrate(ctx, cam, x, y, s, base, glow) – Versorgungskiste (isometrisch): olivgrüne Holzkiste mit Gurten und gelbem Schlo…
- drawRubble(ctx, cam, b, burnt) – Trümmer isometrisch: unregelmäßiger Schuttboden, Schutthügel mit Licht von link…
- drawWreckBox(ctx, cam, w) – Fahrzeugwrack isometrisch ohne Modellbild: flache, verkohlte Wanne; Panzer und…

## isokit.js (49 KB)
- poly
- box
- lit
- FACE
- OUTLINE
- DETAIL
- pyramid
- shade
- tint
- snowy
- roofSnowOn
- frustum(g, u, v, r0, r1, h0, h1, color, top) – Kegelstumpf (r0 unten, r1 oben) mit Mitte (u, v) von h0 bis h1; r0 = r1 ergibt…
- cyl(g, u, v, r, h0, h1, color, top)
- band(g, u, v, r, h0, h1, color) – Farbiges Band rund um einen Zylinder (nur die vordere Hälfte), von h0 bis h1.
- seam(g, u, v, r, h, color) – Feine Naht (vordere Hälfte eines Kreises) auf Höhe h
- coneRoof(g, u, v, r, h, rh, color) – Flaches Kegeldach über einem Zylinder (Öltank): Spitze rh über dem Rand
- cap(g, u, v, r, h, color, tall) – Halbkugel- oder Spitzhaube (Winderhitzer, Geschossspitze) mit Radius r auf Höhe…
- flame(g, u, v, h, s) – Flamme (Fackel) über dem Punkt (u, v, h)
- circle(ctx, x, y, r, fill)
- ball(ctx, x, y, r, color) – Kreis mit Licht von links oben (Tank, Turm von oben)
- ring(ctx, x, y, r, color)
- GLASS – ---------- Farben, Zufall, Zeichenkontext und Bauteile (isometrisch) ----------
- SILL
- LAWN
- LAWN2
- HEDGE
- PATH
- PAVE
- PLAZA
- ASPH
- DECK – Flachdach (Dachpappe, Kies)
- WHITE
- CAR_COLORS
- LEAF_SNOW – Winter (wie die Bäume der Karte): Krone gedämpft dunkelgrün, oben Schnee
- leaves(t)
- LEAF
- rnd(n)
- clampLv(lv)
- G(ctx, s) – Zeichenkontext: s Gerätepixel je Einheit, Zellmitte im Ursprung
- onFace(g, face, plane) – Punkt auf einer Wand: Fläche 's' (Ebene v = plane, Achse u) oder 'e' (Ebene u =…
- stroke(g, pts, color, w)
- flat(g, u0, u1, v0, v1, color, h) – Fläche am Boden (oder auf Höhe h)
- shadow(g, u0, u1, v0, v1, h, a) – Schatten nach links unten (wie Werke und Häuser der Karte): Grundriss, nach +v…
- plinth(g, u0, u1, v0, v1, color, h) – Dunkler Sockel unten an beiden sichtbaren Wänden
- ledge(g, u0, u1, v0, v1, h, color, w) – Waagrechte Linie rund um beide sichtbaren Wände (Geschossdecke, Gesims)
- wallBand(g, u0, u1, v0, v1, h0, h1, color) – Farbband auf beiden sichtbaren Wänden von h0 bis h1.
- winsAt(g, face, plane, at, rows, ww, o) – Fenster mit Rahmen und Spiegelung an den Stellen at (Mitte entlang der Wand), j…
- wins(g, face, plane, a0, a1, n, rows, ww, o) – n Fenster gleichmäßig zwischen a0 und a1.
- door(g, face, plane, a, w, h, col) – Tür mit hellem Rahmen
- gable(g, axis, u0, u1, v0, v1, h, rh, roof, wall, extra, o) – Satteldach über [u0,u1]×[v0,v1], Traufe auf h, First rh höher; axis = Richtung…
- hip(g, u0, u1, v0, v1, h, rh, roof, extra, o) – Walmdach über [u0,u1]×[v0,v1] (First entlang der längeren Seite); extra malt zw…
- parapet(g, u0, u1, v0, v1, h, wall, deck, rim) – Flachdach mit Attika: vertiefte Dachfläche und die zwei sichtbaren Innenseiten…
- balcony(g, face, plane, a0, a1, h, d, rail) – Balkon vor einer Wand: Platte, Brüstung (farbig) und Handlauf; a0…a1 entlang de…
- awning(g, face, plane, a0, a1, h, d, drop, cols, n) – Markise mit Streifen (cols abwechselnd), ragt d vor die Wand und fällt dabei um…
- tree(g, u, v, s, t) – Laubbaum: Schatten, Stamm, Krone aus drei Kugeln (t wählt das Grün)
- bush(g, u, v, s, t) – Busch (eine flache Kugel)
- car(g, u, v, along, color) – Auto (Kasten mit Kabine), along = 'u' oder 'v'
- van(g, u, v, along, color, band, light) – Krankenwagen oder Lieferwagen: hoher Kasten mit Band, Fahrerhaus vorn (+u bzw.…
- lamp(g, u, v, h) – Laterne
- flagpole(g, u, v, h0, len, color) – Fahnenmast mit Fahne in Teamfarbe
- acUnit(g, u, v, h, s, col) – Lüftungs- oder Klimakasten auf dem Dach
- k3(n)
- disc(g, face, plane, a, h, r, fill, line, off, n) – Kreisscheibe in einer Wandebene (Uhr, Stirnseite eines Stamms): Mitte a (entlan…
- groundRing(g, u, v, r, h, n) – Kreis am Boden (oder auf Höhe h) als Eckpunkte
- archWins(g, face, plane, at, h0, h1, ww, o) – Rundbogenfenster (Rechteck bis h1, darüber ein Halbkreis) mit hellem Rahmen
- fanWin(g, face, plane, a, h, r) – Halbrundes Fächerfenster (Giebel der Markthalle)
- vault(g, axis, u0, u1, v0, v1, h, rh, roof, wall, n) – Tonnendach über [u0,u1]×[v0,v1], First entlang axis ('u' oder 'v'); Traufe auf…
- cobble(g, color) – Pflaster eines Platzes mit feinen Fugen
- crate(g, u, v, s, h, col) – Kiste (Holz) oder Steinblock
- fence(g, u0, u1, v0, v1, part, h) – Zaun um [u0,u1]×[v0,v1]: part 'back' = hintere Seiten (vor dem Gebäude malen),…
- ribs(g, u0, u1, v0, v1, h0, h1, step) – Senkrechte Rippen der Metallverkleidung
- fan(g, u, v, h, r) – Lüfter (Gehäuse mit dunklem Rotor) auf Höhe h
- dish(g, u, v, h, r) – Parabolantenne auf einem Sockel
- mast(g, u, v, h0, h1, r0, r1, color, light) – Gittermast mit Streben und rotem Licht
- logPile(g, u0, u1, v0, v1, rows) – Holzstapel: Prisma aus Stämmen entlang u, Stirnseiten (Kreise) an u1.
- shed(g, u0, u1, v0, v1, H, rh, roof, fill) – Offener Schuppen: Stützen, Inhalt (fill), Satteldach
- planks(g, u0, u1, v0, v1, h) – Bretterstapel
- loader(g, u, v) – Radlader (gelb) mit Schaufel nach +u.
- heap(g, u, v, r, h, color) – Schüttkegel (Kies, Erz)
- conveyor(g, u0, v0, h0, u1, v1, h1, w) – Förderband von (u0,v0,h0) nach (u1,v1,h1) auf Stützen
- excavator(g, u, v, h) – Bagger (gelb) mit Ausleger nach +u, auf Höhe h
- truck(g, u, v) – Muldenkipper (gelbe Mulde mit Kies, helles Fahrerhaus vorn bei +u)
- wheel(g, face, plane, a, h, r, color) – Speichenrad (Seilscheibe) in einer Wandebene
- rails(g, u0, u1, v) – Schienen entlang u mit Schwellen
- rectF(c, x0, y0, x1, y1, fill)
- rectS(c, x0, y0, x1, y1, fill, line, w)
- polyF(c, pts, fill)
- shadowTop(c, x0, y0, x1, y1, h) – Schatten nach rechts unten (wie die Großbauten in 2D), länger je höher
- gableTop(c, x0, y0, x1, y1, axis, roof, o) – Satteldach von oben: First entlang x ('u') oder y ('v'); Licht von links oben
- hipTop(c, x0, y0, x1, y1, roof, o) – Walmdach von oben: vier Flächen, Nord und West hell, Süd und Ost dunkel
- flatTop(c, x0, y0, x1, y1, rim, deck) – Flachdach von oben: Attika als Rand, Dachfläche, Schattenkante innen oben links
- treeTop(c, x, y, r, t)
- carTop(c, x, y, along, color)
- awningTop(c, x0, x1, y0, y1, cols, n) – Markise von oben: Streifen entlang x von x0 bis x1, Tiefe y0…y1.
- acTop(c, x, y, s)
- lineT(c, pts, color, w)
- cobbleTop(c, color)
- vaultTop(c, x0, y0, x1, y1, axis, roof, skylight) – Tonnendach von oben (First entlang axis): Verlauf quer zur Achse, Licht von lin…
- pyramidTop(c, x0, y0, x1, y1, roof) – Zeltdach (Pyramide) von oben
- fenceTop(c, x0, y0, x1, y1)
- dishTop(c, x, y, r)
- latticeTop(c, x, y, s, len, color) – Gitterturm von oben: Quadrat mit Kreuz, langer Schatten nach rechts unten, Lich…
- vanTop(c, x, y, along, color, band, light)
- tankTop(c, x, y, r, color)
- heapTop(c, x, y, r, color)
- logsTop(c, x0, y0, x1, y1, rows) – Holzstapel von oben: Stämme entlang x mit hellen Enden rechts
- planksTop(c, x0, y0, x1, y1)
- yellowTop(c, x0, y0, x1, y1)
- railsTop(c, x0, x1, y)

## isosprites.js (1.0 KB)
- drawUnitSprite(ctx, cam, u, p, aim, lift, now) – Einheit in Iso (gemalt, unitpaint.js): Soldaten blicken zum Ziel, Türme folgen…
- drawWreckSprite(ctx, cam, w, p) – Wrack als verkohltes Fahrzeugmodell am Boden (auch abgeschossene Hubschrauber)

## landmarks.js (13 KB)
- PLANT_TALL
- paintPlant(g, o) – Iso: große Fabrikhalle im Rahmen o = { long, a0, a1, b0, b1, seed }
- plantTop(c, o) – 2D: große Fabrikhalle von oben im Rahmen o = { long, x0, x1, y0, y1 }
- PYLON_TALL
- PYLON_WIRES – Aufhängepunkte der Leiterseile eines Masts: [quer (Weltpx entlang der Traverse)…
- paintPylon(g, o) – Iso: Gittermast; o.arm = Richtung der Traversen im Bildrahmen (Einheitsvektor […
- pylonTop(c, ang) – 2D: Mast von oben (Weltkoordinaten ab der Mastmitte); ang = Richtung der Traver…
- pylonNet(buildings) – Masten einer Karte nach Linie in Kartenreihenfolge, je Mast die Richtung der Li…
- drawWires(ctx, net, pt, lw, inView) – Leiterseile zwischen den Masten (über allen Objekten gezeichnet)

## mappreview.js (3.3 KB)
- drawMapPreview(canvas, map) – Zeichnet die Karte `map` in das Canvas `canvas` (ganze Fläche)
- drawPowerLines(ctx, buildings, lw) – Leitungen zwischen Strommasten derselben Linie (Kartenreihenfolge) als dünne Li…

## mapprops.js (14 KB)
- propLooksOf(props, st, version) – Aussehen aller sichtbaren Props: [{ i, x, y, kind, mask, along, gate, rubble, v…
- forgetPropLooks(props) – Zwischengespeichertes Aussehen und Zellindex einer Prop-Liste verwerfen (Editor…
- propLooks(g, team, all) – Aussehen der Props einer Partie für `team`: der Zustand, den das Team zuletzt g…
- propFlagColor(g, o) – Farbe der Fahne eines Props: in der Eroberung der Besitzer der nächsten Flagge…
- drawPropIso(ctx, cam, o, season, flag) – Prop in Iso (Fuß am Weltpunkt)
- drawPropShadowIso(ctx, cam, o, season, dpr) – Iso: Schatten eines Props, scharf begrenzt nach links unten
- drawPropsTop(ctx, looks, inRect, zoom, season, flagOf) – 2D (Weltkoordinaten): erst alle Schatten, dann alle Props, damit kein Schatten…
- drawPropsMini(ctx, looks, minPx) – Minimap (Weltkoordinaten, Transformation gesetzt): Kacheln als Zellen, Einzelst…

## maptown.js (97 KB)
- setMapTown(map) – Zu Beginn jedes Bilds (Renderer): Felder der Karte merken (Gehöfte erkennt man…
- mapPylons(map) – Strommasten der Karte mit Richtung und Nachfolger (pylonNet), neu berechnet, we…
- drawHouseYard(ctx, b, zoom, season, rot) – Iso, Bodendurchgang (seit Paket „Wohnhaus“): Hof, Vorplatz, Weg und Schatten ei…
- houseYardIso(b, rot) – Hofmauer eines Altbaus in der Drehung rot (für Sandsäcke und Fahne, stronghold.…
- houseYardTrees(b, rot)
- drawMapIso(ctx, cam, b) – Iso: Gebäude b der Karte gemalt; false = nicht hier
- drawMapTop(ctx, b, zoom) – 2D: Gebäude b der Karte von oben (Weltkoordinaten, Kamera-Transformation gesetz…
- drawPark(ctx, p, zoom, season, rails) – Park p als Bodenbild: in 2D mit der Kamera-Transformation, iso mit der Bodentra…
- drawMapTown2D(ctx, town, inRect, zoom, season, gone, ruined) – 2D: Parks, Gebäude, Bänke, Stadtbäume und geparkte Autos der Karte über dem Gel…
- drawMapCars2D(ctx, town, inRect, zoom, season) – 2D: parkende Autos der Karte, nach den Straßen der Stadt (sonst lägen sie darun…
- drawMapTownMini(ctx, town, season) – Minimap: Parks und Gebäude der Karte als Flächen (je Farbe ein Pfad); Weltkoord…

## marks.js (18 KB)
- drawSelectMark(ctx, e, z, hover, iso, scale) – Auswahl- bzw. Hover-Markierung eines Objekts am Boden
- drawDragFrame(ctx, d) – Auswahlrahmen beim Aufziehen (Bildschirmkoordinaten, Transformation auf DPR): F…
