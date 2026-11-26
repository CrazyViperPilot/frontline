# Symbol-Index render3d (Teil 2 von 2, sun3d.js bis units3d.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/render3d/`. Pfade relativ zu `js/render3d/`.

## sun3d.js (Fortsetzung)
- SHADOW_LEVELS – Stufen in der Reihenfolge des Pausenmenüs.
- class Sun3D
  - constructor(gl, scene, root, geometry) – gl: THREE.WebGLRenderer; scene: Szene der Objekte; root: Wurzelgruppe (Weltkoor…
  - setLevel(level) – Stufe 'off' | 'mid' | 'high' (BALANCE.shadows3d.levels); wirkt ohne Neustart (K…
  - on()
  - setMood(mood) – Deckkraft aus der Lichtstimmung (mood: Schlüssel aus MOODS oder null)
  - heightSpan(relief) – Niedrigste und höchste sichtbare Geländehöhe (Seen als Wasserspiegel), je Gelän…
  - update(cam3, light, relief) – Vor dem Render: Sonne in Weltrichtung light (Vektor zur Sonne, z oben, Renderer…
  - dispose()

## testscene.js (1.8 KB)
- probePoints(game, team) – Prüfpunkte { name, x, y, color } für die Karte von game; Hauptstadt = Gebäude m…
- buildTestCubes(points, heightAt) – Würfelgruppe in Weltkoordinaten (Kind der Wurzelgruppe); heightAt(x, y) liefert…

## town3d.js (39 KB)
- hasTown3d(ck, level) – Gibt es ein 3D-Haus für Art ck und Stufe? (Sonst bleibt das gemalte Billboard.)
- townKey(ck, level, variant, color) – Schlüssel einer Variante: Art, Stufe, Farbvariante, Teamfarbe nur bei TEAM_SHOW…
- townGeometry(ck, level, variant, color) – Geometrie des Stadthauses (Zellenart ck, Stufe, Farbvariante, Teamfarbe) wie to…
- class Town3D – Stadthäuser im Spiel (Renderer3D, Durchlauf „Objekte“): je Variante ein Instanc…
  - constructor()
  - begin(frame) – Bildanfang: Licht, Schnee, Nacht und Schattenstärke für alle Häuser (setKitFram…
  - setOf(key, geo, need) – Satz einer Variante, beim ersten Gebrauch angelegt; ist er voll, wird er verdop…
  - add(b, h) – Stadthaus b (cityBuildings, kind 'town') am Boden der Höhe h; false, wenn es ke…
  - end() – Bildende: Zahl je Satz setzen, leere Sätze verstecken
  - stats() – Häuser, sichtbare Varianten (= Draw-Calls ohne Schattenkarte) und Dreiecke im B…
  - dispose()

## trees3d.js (21 KB)
- TREE_SHAPES – Formen je Art in 3D (die Drehung je Baum sorgt für weitere Vielfalt)
- LOD_ZOOM – darunter gröbere Formen (bis ~1500 Bäume im Bild, Messung Seed 7)
- TREE_SPECIES
- treeGeometry(sp, shape, bare, lod) – Geometrie einer Form (je Art, Form, kahl, grob einmal gebaut)
- class Trees3D
  - constructor()
  - begin(light, season, zoom) – Bildanfang: Sonne (Welt, z oben), Jahreszeit, Zoom (gröbere Formen darunter)
  - setOf(sp, shape, bare, lod) – Satz (InstancedMesh) einer Form, beim ersten Gebrauch angelegt
  - add(L, x, y, h) – Baum (Aussehen L aus treeLook3d) am Weltpunkt (x, y) auf Höhe h
  - end() – Bildende: Zahl der Bäume je Form setzen, leere Formen verstecken
  - stats() – Sichtbare Formen (= Draw-Calls ohne Schattenkarte) und Bäume, je Art
  - dispose()

## units3d.js (5.7 KB)
- class Units3D
  - constructor()
  - begin(light) – Bildanfang: Lichtrichtung (Welt, z oben, zur Sonne: Renderer.lightVec)
  - show(u, h, lift, aim, now) – Einheit u in die Szene: Bodenhöhe h (Welt-px), lift über dem Boden, aim = Weltw…
  - end() – Bildende: nicht gezeigte Einheiten verstecken, lange ungenutzte aus dem Vorrat…
  - dispose()
