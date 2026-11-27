# Symbol-Index render (Teil 3 von 4, mapprops.js bis renderer.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render/`. Pfade relativ zu `js/render/`.

## mapprops.js (Fortsetzung)
- drawPropsTop(ctx, looks, inRect, zoom, season, flagOf) – 2D (Weltkoordinaten): erst alle Schatten, dann alle Props, damit kein Schatten…
- drawPropsMini(ctx, looks, minPx) – Minimap (Weltkoordinaten, Transformation gesetzt): Kacheln als Zellen, Einzelst…

## maptown.js (98 KB)
- setMapTown(map) – Zu Beginn jedes Bilds (Renderer): Felder der Karte merken (Gehöfte erkennt man…
- mapPylons(map) – Strommasten der Karte mit Richtung und Nachfolger (pylonNet), neu berechnet, we…
- drawHouseYard(ctx, b, zoom, season, rot, no3dShadow) – Iso, Bodendurchgang (seit Paket „Wohnhaus“): Hof, Vorplatz, Weg und Schatten ei…
- houseYardIso(b, rot) – Hofmauer eines Altbaus in der Drehung rot (für Sandsäcke und Fahne, stronghold.…
- houseYardTrees(b, rot)
- drawMapIso(ctx, cam, b) – Iso: Gebäude b der Karte gemalt; false = nicht hier
- drawMapTop(ctx, b, zoom) – 2D: Gebäude b der Karte von oben (Weltkoordinaten, Kamera-Transformation gesetz…
- drawPark(ctx, p, zoom, season, rails) – Park p als Bodenbild: in 2D mit der Kamera-Transformation, iso mit der Bodentra…
- drawMapTown2D(ctx, town, inRect, zoom, season, gone, ruined) – 2D: Parks, Gebäude, Bänke, Stadtbäume und geparkte Autos der Karte über dem Gel…
- drawMapCars2D(ctx, town, inRect, zoom, season) – 2D: parkende Autos der Karte, nach den Straßen der Stadt (sonst lägen sie darun…
- drawMapTownMini(ctx, town, season) – Minimap: Parks und Gebäude der Karte als Flächen (je Farbe ein Pfad); Weltkoord…
- mapInfo (= infoOf)
- towerSide
- q8
- TW
- TW_SIDE
- TW_HUT
- TW_RADAR
- TW_ANT
- TW_LAMP
- TW_LEG
- TW_DECK
- TW_GRATE
- TW_WALL
- TW_RIM
- TW_ROOF
- TW_GLASS
- TW_RAIL
- PLASTER
- TILES
- SLATE
- BRICK
- SHUTTER
- TIMBER
- FACH_WALL
- NEU_WALL
- NEU_ACC
- BARN
- HALL_WALL
- HALL_BAND
- METAL_ROOF
- FACT_WALL
- FACT_ROOF
- SKY
- CONC
- YARD
- CONTAINER
- ALT_WALL
- ALT_ROOF
- ALT_STONE
- ALT_QUOIN
- ALT_H
- ALT_RH
- altPlan
- spots
- pylonYaw(b) – Richtung der Traversen eines Masts (Bogenmaß, Welt, ungerundet) für die Ansicht…

## marks.js (18 KB)
- drawSelectMark(ctx, e, z, hover, iso, scale) – Auswahl- bzw. Hover-Markierung eines Objekts am Boden
- drawDragFrame(ctx, d) – Auswahlrahmen beim Aufziehen (Bildschirmkoordinaten, Transformation auf DPR): F…
- drawGauge(ctx, x, y, w, h, frac, color, px, ticks) – Balken mit dunkler Platte (1 Bildschirmpixel Rand), dunkelgrauem leerem Teil, F…
- drawCargoGauge(ctx, x, y, w, h, parts, px) – LKW-Ladung: ein Balken mit den Sorten nebeneinander (parts = [[Anteil 0..1, Far…
- drawStarMark(ctx, x, y, r, zoom) – Kommandeursstern mit Mittelpunkt (x, y) in Welt, r = Radius in Weltmaßen, zoom…
- drawCareMark(ctx, x, y, z) – Grünes Kreuz mit weißem Rand und dunklem Saum: wird geheilt oder repariert
- drawNoAmmoMark(ctx, x, y, z) – Warnzeichen „ohne Munition“: rotes Dreieck mit dunklem Saum und weißem Ausrufez…
- drawMoveRing(ctx, x, y, k, z, iso) – Wegziel am Boden (Weltkoordinaten auf der Bodenebene): Ring mit dunklem Saum wä…
- drawSlotMark(ctx, x, y, z, alpha) – Formationsplatz am Boden: kleiner grüner Punkt mit dunklem Rand und hellem Kern…
- strokeTrail(ctx, color, w, dash) – Linie mit dunklem Saum: der Aufrufer baut den Pfad (beginPath, moveTo/lineTo),…
- drawArrowHead(ctx, x, y, ang, s, color, px) – Pfeilspitze am Boden: Spitze bei (x, y) in Richtung ang, Länge s; Füllung mit d…
- drawFootRing(ctx, x, y, r, color, px) – Ring am Boden um einen Punkt (Anfang einer Route, Fuß des Sammelpunkts): dunkle…
- drawRallyFlag(ctx, x, y, f) – Sammelpunkt-Fahne (einmal gemalt, Bildschirmpixel): Mast mit Knauf und ein gold…

## materials.js (8.7 KB)
- MATS – Material: Datei, Weltpixel je Kachel, Deckkraft des Fotos
- materialsReady() – Sind die Fotos geladen (sonst malt texture() nichts)?
- withMat(mat, fn) – fn mit festem Wandmaterial malen (null: ohne Foto), z. B. Holzkisten, Container…
- wallMat(color) – Material einer Wand aus ihrer Farbe: rötlich-braun Ziegel, hell Putz, sonst Bet…
- withRoof(mat, fn) – fn mit festem Dachmaterial malen (null: ohne Foto), z. B. Blechdächer von Hallen
- roofMat(color, def) – Material eines geneigten Dachs: Dachziegel (dunkle wirken wie Schiefer), sonst…
- flatMat(color) – Material eines Flachdachs: Kies bei grauen Farben, sonst keins (Rasen, Plätze ……
- texture(g, pts, mat, O, X, Y) – Foto des Materials mat auf die Fläche pts (Bildschirmpunkte, schon in der Fläch…
- texturePolys(ctx, polys, mat, O, X, Y) – Foto über mehrere Flächen auf einmal (polys: Listen von Bildschirmpunkten), z.…
- texWall(g, pts, face, plane, mat) – Foto auf eine Iso-Wand: Fläche 's' (Ebene v = plane, Achse u) oder 'e' (Ebene u…
- texFlat(g, pts, h, mat) – Foto auf eine waagrechte Iso-Fläche in Höhe h
- texSlope(g, pts, mat, a, b, c) – Foto auf eine schräge Iso-Fläche (Dach): a und b sind zwei Weltpunkte [u, v, h]…
- texTop(ctx, pts, mat) – Foto auf eine Fläche der 2D-Ansicht (Kontext schon in Welteinheiten skaliert)

## milbuild.js (50 KB)
- setMilWalls(list) – Mauern und Tore merken (je Bild, für die Verbindungen zu den Nachbarn)
- drawMilIso(ctx, cam, b, color) – Iso-Bild eines Militärgebäudes (Ankerpunkt = Mitte des Grundrisses)
- drawMilTop(ctx, b, color, zoom) – 2D von oben (Kamera-Transformation gesetzt, Weltkoordinaten)
- MIL_DIM – Farben, Höhen und Maße der Militärgebäude für render3d/mil3d.js (dieselben Wert…
- isMilBuilding – Zuständig für b (Militärgebäude außer der Hauptstadt)?
- milVariant(b) – Variante ohne Drehung der Ansicht (Mauer: Nachbarn in Weltrichtung 1 = +x, 2 =…
- milDamaged – Beschädigt (unter halber Gesundheit, gemalt: Ruß)? 1 oder 0.

## milprops.js (17 KB)
- isMilSingle(kind) – Gibt es ein Einzelstück-Modell für diese Art?
- milModel(kind, v, d, w, rubble, flag, open) – Körper eines Einzelstücks in Modellrichtung (x entlang der Länge)
- move

## minimap.js (11 KB)
- class Minimap
  - constructor(canvas, game, camera, team)
  - setMaxDpr(max) – Obergrenze der Pixeldichte setzen (Bildauflösung) und die Minimap sofort neu au…
  - resize() – Canvas-Pufferung an CSS-Größe und DPR anpassen (höchstens maxDpr)
  - view() – Abbildung Welt → Minimap (CSS-Pixel) als [a, b, c, d, e, f] wie ctx.setTransfor…
  - toWorld(mx, my) – Minimap-Position (CSS-Pixel im Canvas) → Weltkoordinate (Umkehrung von view, au…
  - render()
  - cityImage(c, color) – Kleines Bild (eine Zelle = ein Pixel) von Gebiet und Gebäuden einer Stadt

## mood.js (3.4 KB)
- MOOD_SETTINGS – Einstellungen des Startmenüs: aus, Zufall (aus dem Seed, nach Jahreszeit gewich…
- MOODS – mult: Farbe der Multiplikation (255 = unverändert) · glow: Lichtschein [r, g, b…
- pickMood(setting, seed, season) – Stimmung für diese Partie: setting 'off' | 'random' | feste Stimmung; Zufall de…
- drawMood(ctx, mood, cssW, cssH) – Stimmung über die Welt zeichnen (ctx in CSS-Pixeln, Transform = dpr)

## nature.js (56 KB)
- SPECIES
- forestKind(o) – Waldart (fest nach Lage des Walds): Laubwald, Nadelwald oder Mischwald
- forestSpecies(kind, u) – Art eines Baums im Wald nach Waldart; u ∈ [0, 1) ist der Zufall des Baums
- treeLook3d(t, season) – Aussehen eines Baums für die Ansicht 3D (render3d/trees3d.js), gleich gewürfelt…
- TREE_COLORS – Farben der Bäume für die Ansicht 3D: alle Laubpaletten (Reihenfolge fest), Rind…
- leafCanvas() – Kachelbares Blattmuster in Grau (128 = neutral) für den Mischmodus „overlay“
- drawTreeIso(ctx, cam, t, season) – Baum in Iso (Stammfuß am Weltpunkt, Größe nach t.r)
- drawTreeTop(ctx, t, season, zoom) – Baum von oben (2D, Welt-Transformation gesetzt), mit Schatten
- bushLook3d(b, season) – Aussehen eines Buschs für die Ansicht 3D (render3d/nature3d.js), gleich gewürfe…
- BUSH_COLORS – Farben der Büsche für die Ansicht 3D: Farn je Jahreszeit, Beeren, Ruten, Schnee
- drawBushIso(ctx, cam, b, season) – Busch in Iso (Fuß am Weltpunkt)
- drawBushTop(ctx, b, season, zoom) – Busch von oben (2D)
- natureShadowIso(ctx, cam, o, t) – Hängt den Schatten eines Baums (t 1), Felsens (2) oder Buschs (13) als Ellipse…
- drawRockIso(ctx, cam, o, season) – Fels in Iso (Fuß am Weltpunkt), in jeder Drehung der Ansicht von der passenden…
- rockLook3d(o, season) – Fels für die Ansicht 3D: Variante v, Blickwinkel yaw in der Welt (wie drawRockI…
- drawRockTop(ctx, o, season, zoom) – Fels von oben (2D) mit Schatten nach rechts unten
- drawAnimalIso(ctx, cam, a, p, now) – Tier in Iso an Bildpunkt p (Boden), Blick nach a.angle (8 Richtungen)
- animalLook3d(a, now) – Tier für die Ansicht 3D: Haltung wie drawAnimalIso (Gehbild, Galopp, Äsen), Sch…
- drawAnimalTopP(ctx, a, zoom, now) – Tier von oben (2D), gedreht nach a.angle, mit Schatten
- natureModels() – Für Tests: alle Felsen- und Tiermodelle (Körper) bauen, ohne zu malen

## paving.js (3.0 KB)
- drawPlaza(ctx, p, S) – Platz p (Rechteck, evtl. gedreht) mit Plattenfugen und dunklerer Kante
- drawWalk(ctx, r, S) – Bürgersteig r (Strecke x1/y1 → x2/y2, Breite w) mit Bordstein an beiden Kanten…
- drawPaving(ctx, town, S, inRect, at) – Alle Plätze und Bürgersteige einer Kartenstadt

## props.js (31 KB)
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
- carLook3d(c, season) – Auto: { key, S, yaw, k, charred } aus dem Modell „top“ (beide Seiten, beide End…
- benchLook3d(b, season) – Parkbank: { key, S, yaw, k }
- baleLook3d(b, season) – Ballen: beide Stirnseiten mit Ringen (gemalt nur die vordere)
- crateSolids3d() – Versorgungskiste als Körper in Einheiten einer Kiste mit 16 Welt-Pixeln Kantenl…
- drawCrateGlow(ctx, cam, x, y, s, glow) – Schimmer unter einer Kiste am Boden (glow 0 … 1): bleibt gemalt, auch wenn die…

## refprops.js (30 KB)
- isRefSingle(kind) – Gibt es ein Modell dieser Art hier?
- refModel(kind, v, d, w, rubble) – Körper eines Einzelstücks der Raffinerie (Modellrichtung)

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
