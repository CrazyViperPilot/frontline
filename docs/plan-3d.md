# Frontline – Plan „3D mit three.js“

Daniel, 2026-11-26: Das Spiel soll besser aussehen; Darstellung auf three.js (WebGL, GPU) umstellen. Kompletter Plan, Reihenfolge so,
dass am Anfang ein MVP steht, an dem wir entscheiden, ob es gut funktioniert. Modelle: Haiku (Aufwand high), wo es geht, sonst Sonnet
oder Opus nach Schwierigkeit.

## Ausgangslage (gemessen 2026-11-26)
- Darstellung `js/render/` rund 27 600 Zeilen Canvas 2D: Gebäude (isokit, townhouses, works, milbuild …), Einheiten, Natur, Props, Effekte.
  Jedes Bild wird je Variante und Maßstab einmal gemalt (`spritecache.js`) und dann kopiert. Nur der Iso-Boden samt Nebel ist WebGL
  (`ground.js`), sein Bild wird in jedem Bild in die 2D-Leinwand kopiert.
- Einheiten, Felsen und Tiere sind schon 3D-Körper: Flächenlisten aus `box`, `prX/prY/prZ`, `loft`, `cyl`, `ball`
  (`js/render/units/shapes.js`), ein Mini-Renderer malt sie flach (`painter.js`). Gebäude dagegen malen nur ihre sichtbaren Seiten
  in Iso-Koordinaten (`isokit.js`, `G(ctx, s)` mit `P(u, v, h)`): kein echtes 3D, Rückseiten fehlen.
- Iso-Projektion (`camera.js`): Bild = Mitte + zoom · [[K, −K], [K/2, K/2]] · (Welt − Kamera), Höhe h hebt um h · zoom. Das ist eine
  orthografische Kamera mit 45° Drehung und 30° Neigung, bei der Höhen um 1/cos 30° (≈ 1,1547) gestreckt sind; Drehung in 90°-Schritten.
- Zeit je Bild (Seed 3, 85 Einheiten, Container ohne GPU): Simulation 1 bis 6 ms, KI unter 1 ms, Iso-Zeichnen 270 ms (Software-WebGL,
  für echte Geräte ohne Aussage), 2D 1,5 ms. Die Simulation ist nicht der Engpass.
- three.js 0.187.0 (MIT): `build/three.module.js` + `three.core.js` = 2,1 MB, gepackt 417 KB; keine fertigen `.min.js` mehr im Paket.

## Leitideen
1. **Kamera bleibt Herrin.** `Camera` (`js/render/camera.js`) bleibt die einzige Wahrheit für Ausschnitt, Zoom, Drehung und Welt ↔ Bild.
   Die three-Kamera wird daraus jedes Bild gesetzt und bildet die heutige Projektion Pixel für Pixel nach (Wurzelgruppe mit Höhenfaktor
   1,1547). Dann stimmen Klicks (`ui/input.js`, `ui/controller.js`), Auswahlringe, Balken und Schilder ohne Umbau. Freie Kamera erst am Ende.
2. **Mischbetrieb statt Urknall.** `Renderer3D` zeichnet, was schon 3D ist, als Mesh; alles andere als Billboard (aufrechtes Viereck
   mit dem Bild aus `spritecache.js`, Fußpunkt am Weltpunkt). Bei fester Iso-Neigung sehen Billboards genau aus wie heute. So läuft das
   Spiel nach jedem Paket, und jede Familie wird einzeln umgestellt.
3. **Zwei Leinwände.** Unten die three-Leinwand (Boden, Objekte, Nebel), darüber die bisherige 2D-Leinwand, durchsichtig, nur noch für
   Balken, Schilder, Ziehrahmen, Routen, Anzeigen. Bodenmarken (Auswahlringe, Zonen, Radien) kommen als Textur auf den Boden, damit
   Einheiten darüber stehen.
4. **Schalter.** Bis zur Abnahme nur mit `?three=1` (und Schalter im Pausenmenü „Grafik: 3D (Test)“); ohne Schalter alles wie heute.
   Die 2D-Ansicht bleibt bis Stufe 5 Canvas.
5. **Stil:** gemalte, warme Optik behalten, nicht fotorealistisch: `MeshLambertMaterial`/`MeshStandardMaterial` mit Eckfarben,
   Materialfotos aus `textures/`, Sonne aus `mood.js`, weiche Schatten. Simulation, Befehle und Tests der Simulation bleiben unberührt (Regel 1, 2).
6. **Neuer Ordner** `js/render3d/` (eigene `CLAUDE.md`), three.js unter `js/vendor/three/`. Aus `js/render3d/` darf `js/render/` gelesen
   werden (Modelle, Farben, Sprite-Cache), nie umgekehrt.

## Entscheidungen für Daniel (vor Stufe 1)
Daniel, 2026-11-26: allen vier Empfehlungen zugestimmt (Kopie unter `js/vendor/`, einmal verkleinert, `?three=1` bis zur Abnahme,
Schattenstufen); fremde Modelle bleiben nach dem MVP zu entscheiden.

| Frage | Empfehlung |
|---|---|
| three.js als Kopie ins Repo (Regel 5 um „Bibliotheken unter `js/vendor/`“ ergänzen)? | Ja, Version fest 0.187.0, Lizenzdatei dabei |
| Einmal verkleinern (`tools/vendor-three.mjs` mit esbuild über npx, nur beim Einbinden, kein Build-Schritt fürs Spiel)? | Ja: etwa 700 KB statt 2,1 MB im Offline-Cache |
| MVP nur hinter `?three=1`, Standard bleibt Canvas bis zur Abnahme? | Ja |
| Schatten auf Handys? | Stufen Aus/Mittel/Hoch im Pausenmenü, Handy startet mit Mittel |
| Fremde Modelle (CC0, z. B. Kenney, Quaternius)? | Erst nach dem MVP und nur für Natur und Kleinkram; Lizenz je Modell in `textures/LIZENZEN.md` |

## Stand
- three.js einbinden: gebaut (Regel 5 in `CLAUDE.md` angepasst).
- 3D-Gerüst: gebaut (`js/render3d/`, `?three=1`, Prüfwürfel `&cubes=1`, `tools/smoke-3d.mjs`: Abweichung 0,0000 px in allen
  4 Drehungen bei Zoom 0,35, 1, 1,6). three übernimmt Iso-Durchläufe über `Renderer3D.takes` (Namen aus `ISO_PASSES`).
- Schalter: statt im Pausenmenü über die Schaltfläche „Ansicht“ bzw. V (2D → Iso → 3D, gemerkt; three.js lädt erst beim Wechsel).
- Nächste Pakete (parallel möglich): 3D-Boden (Opus) ‖ Körper-Wandler (Sonnet) ‖ Billboard-Brücke (Opus).

## Stufe 1 – MVP (Entscheidung danach)
Ziel: echte Partie mit `?three=1` in Iso: Gelände mit Licht und Schatten, alle Einheiten als 3D-Modelle, Bäume in 3D, der Rest als
Billboards, Auswahl und Befehle funktionieren. Danach Fotos und Bildrate auf Rechner und Handy vergleichen.

| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| three.js einbinden | `js/vendor/three/` (Version fest, Lizenz), `tools/vendor-three.mjs`, `sw.js` ASSETS, Regel 5 in `CLAUDE.md`, Test: Datei vorhanden und Version passt | Haiku | Entscheidungen | `npm test` grün, `import('/js/vendor/three/three.module.js')` lädt im Browser |
| 3D-Gerüst | `js/render3d/renderer3d.js` mit der Schnittstelle von `Renderer` (`render(view)`, `resize`, `season`, `perf`); three-Leinwand unter der 2D-Leinwand; orthografische Kamera aus `Camera` (Drehung, Zoom, Höhenfaktor, `relief.displayAt`); Schalter `?three=1` in `main.js`; leere Szene mit Testwürfeln an bekannten Weltpunkten | Opus | three.js einbinden | Würfel stehen genau unter den Punkten, die `camera.worldToScreen` liefert (Prüfskript, Abweichung unter 1 px in allen 4 Drehungen und bei Zoom 0,35 bis 1,6) |
| 3D-Boden | Höhennetz aus `relief.fine` als `BufferGeometry`; Shader von `ground.js` (Gras, Fels, Ufer, Wasser, Erdschnitt, Schnee) als `ShaderMaterial` mit three-Licht und Schattenempfang; Bodenbild `buildTerrain(map,'gl')` als Textur; Stadtstraßen, Wege, Felder vorerst als Bild im Bodenbild | Opus | 3D-Gerüst | Foto gleicht dem heutigen Boden (Seeds 3, 7; Sommer, Winter); Gelände-Änderung im Editor lädt nur geänderte Zeilen nach |
| Körper-Wandler | `js/render3d/solids3d.js`: Körper aus `shapes.js` (Flächen, Farbe, `smooth`, `mat`, `alpha`, `on`, `fine`) → `BufferGeometry` mit Eckfarben, flachen oder glatten Normalen; je Modellvariante einmal gebaut und zwischengespeichert; Node-Test: alle Modelle aus `MODELS`, `INFANTRY`, Felsen und Tiere ohne NaN, Umriss wie `boundsOf` | Sonnet | 3D-Gerüst | Test grün; Prüfseite zeigt jedes Modell neben seinem gemalten Bild |
| 3D-Einheiten | Einheiten als Meshes aus dem Wandler: Wanne und Turm getrennt (Turm folgt dem Ziel), stufenlose Drehung, Teamfarben, Rotoren und Nachbrenner, Wracks (verkohlt), Soldaten (8 Haltungen zunächst als feste Posen); Flieger in der Höhe; Instancing für gleiche Modelle | Sonnet | Körper-Wandler | Partie mit 200 Einheiten läuft; jede Einheit erscheint, wo die 2D-Ansicht sie zeigt |
| Billboard-Brücke | Alles noch nicht Umgestellte (Gebäude, Props, Büsche, Brücken, Kisten, Effekte) als Billboards: Bild aus `spritecache.js` als Textur (Atlas, Freigabe alter Texturen, Speichergrenze), Fußpunkt und Tiefe wie `isoItems`; gemalte Schatten als Bodenbild-Billboards | Opus | 3D-Gerüst | Iso mit `?three=1` zeigt dieselben Dinge wie ohne; kein Speicherwachstum beim Zoomen (Messung 5 min) |
| 3D-Bäume | Bäume aus `nature.js`-Arten als niedrige Polygone: Laubbaum (Stamm, Äste, Kronenbüschel mit Blattmuster aus `nature.js` als Textur), Birke, Fichte (Stockwerke), Kiefer; Jahreszeiten (Herbstfarben, kahle Äste mit Schnee); `InstancedMesh` je Art und Form; werfen Schatten | Sonnet | Körper-Wandler, Licht und Schatten | Wald mit 400 Bäumen im Bild unter 3 Draw-Calls je Art; Fotos aller Jahreszeiten |
| Licht und Schatten | Sonne als `DirectionalLight` (Richtung und Farbe aus `mood.js`/`lightVec`), Schattenkarte folgt dem Bildausschnitt (eng gefasst, stabil beim Verschieben, kein Flimmern), Himmelslicht; Stufen Aus/Mittel/Hoch; Nacht: Dunkelheit wie `drawMood` | Opus | 3D-Boden, 3D-Einheiten | Schatten von Panzern und Bäumen fallen über Gelände; Wechsel der Stufe ohne Neustart |
| Bodenmarken | Auswahlringe, Bewegungsziele, Zonen, Hot Zone, Eroberungsflaggen-Kreise, Radien, Baugitter: in eine Leinwand des sichtbaren Ausschnitts gemalt (bestehender Code mit Welt-Transformation), jedes Bild als Textur in den Boden-Shader gemischt | Sonnet | 3D-Boden | Ringe liegen auf dem Gelände unter den Einheiten, auch am Hang |
| 3D-Nebel | Kriegsnebel-Shader (`FS_FOG`) als Mesh über allem, ohne Tiefentest (wie heute über allen Objekten); `?debug=1&fog=1` | Sonnet | 3D-Boden | Nebel sieht aus wie heute, Erkunden aktualisiert ihn |
| MVP-Messung | Prüfskript `tools/smoke-3d.mjs`: Rundgang mit `?three=1` (Start, Iso, alle 4 Drehungen, Zoom, Auswahl, Befehl, Winter), Fotos alt/neu nebeneinander nach `.smoke/3d/`, Bildrate desktop/tablet/phone, Browserfehler | Haiku | alle oben | Bericht mit Fotos und Zahlen; Daniel misst auf eigenem Handy mit `?three=1&perf=1` |

**Entscheidung nach Stufe 1** (Daniel, mit Fotos und Zahlen): weiter, nachbessern oder verwerfen. Richtwerte: Rechner 60 Bilder/s,
Handy 30 Bilder/s mit Schatten „Mittel“ in einer Partie nach 20 Minuten; Bedienung ohne Unterschied zu heute.

## Stufe 2 – Gebäude in 3D
Gebäude malen heute nur ihre sichtbaren Seiten. Ein Baukasten mit denselben Bauteilen in echtem 3D ersetzt `isokit.js` Familie für
Familie; bis dahin bleiben die Billboards.

| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| Baukasten 3D | `js/render3d/kit3d.js`: Bauteile aus `isokit.js` als Geometrie (Kasten, Wand mit Fensterreihen, Tür, Satteldach `gable`, Walmdach `hip`, Zylinder, Kegeldach, Haube, Sockel, Gesims), Materialfotos aus `materials.js` als Texturen (Ziegel, Putz, Dach), Fenster mit Nachtlicht (emissiv), Schnee auf Dächern; Gebäude je Variante einmal gebaut und zusammengeführt (`mergeGeometries`) | Opus | MVP-Entscheidung | Prüfseite: ein Stadthaus aus `townhouses.js` in 3D neben dem gemalten, in allen 4 Drehungen |
| Stadthäuser 3D | `townhouses.js` (1 × 1-Häuser, Stufen 1 bis 3) mit dem Baukasten | Sonnet | Baukasten 3D | alle Varianten, Fotos je Stufe und Jahreszeit |
| Werke 3D | `works.js` (Werke, Kraftwerk, Förderbänder, Schornsteine, Rauch bleibt Effekt) | Sonnet | Baukasten 3D | wie oben |
| Großbauten 3D | `bigbuild.js`, `university.js`, `cityhall.js`, `govquarter.js` | Sonnet | Baukasten 3D | wie oben |
| Militärgebäude 3D | `milbuild.js` samt Baustellen, `stronghold.js` (Ausbauten, Fahnen) | Sonnet | Baukasten 3D | wie oben, Baustellen in Stufen |
| Fliegerhorst 3D | `airbase.js` (Bahn, Stellplätze, Tower, Tanks, Hangar) | Sonnet | Baukasten 3D | wie oben, Jets rollen auf der Bahn |
| Kartenstadt 3D | `maptown.js`, `landmarks.js` (Fabrikhalle, Strommasten), Leitungen als Linien | Sonnet | Baukasten 3D | wie oben |
| Baustellen und Ruinen 3D | `citysite.js`, Ruinen und Trümmer (`garrison.js`, `world.js`), Zerstörungsstufen | Sonnet | Stadthäuser 3D | zerstörtes Haus zeigt Ruine statt Billboard |
| Brücken 3D | `bridge.js` (Brücken, Furtstangen) mit Geländehöhe | Sonnet | Baukasten 3D | Einheiten fahren sichtbar über die Brücke |

## Stufe 3 – Natur, Kleinkram, Boden
| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| Büsche und Felsen 3D | Büsche aus `nature.js` (Strauch, Beeren, Farn, junge Fichte) als Instancing; Felsen und Tiere über den Körper-Wandler | Sonnet | 3D-Bäume | keine Natur-Billboards mehr |
| Props 3D | `mapprops.js`, `fences.js`, `milprops.js`, `indprops.js`, `refprops.js`, `civprops.js`, `props.js` (Autos, Bänke, Kisten, Ballen) mit Baukasten oder Körper-Wandler; Zäune und Mauern als durchgehende Geometrie | Sonnet | Baukasten 3D | keine Prop-Billboards mehr |
| Straßen und Wege 3D | Stadtstraßen (`citylayer.js`), Feldwege und Gleise (`ways.js`), Pflaster (`paving.js`), Felder (`fields.js`) als Bodenschicht: Texturen aus `textures/` auf Bändern, die dem Gelände folgen; Schienen als Geometrie | Sonnet | 3D-Boden | Straßen am Hang ohne Versatz; Fotos alt/neu |
| Wasser 3D | Seen und Fluss mit Spiegelung des Himmels, Uferschaum, Tiefe; Eis im Winter | Sonnet | 3D-Boden | Fotos Sommer und Winter |
| Fremde Modelle (wahlfrei) | CC0-Modelle (z. B. Kenney, Quaternius) für Natur und Kleinkram prüfen, auswählen, als glTF unter `models/` mit `LIZENZEN.md`; GLTFLoader aus three.js | Haiku (Suche, Lizenzen), Sonnet (Einbau) | Props 3D | Daniel hat die Auswahl abgenommen |

## Stufe 4 – Effekte, Wetter, Tageslicht
| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| Effekte 3D | `fx.js`: Explosion (Blitz als kurzes Punktlicht, Funken, Rauchpilz), Leuchtspur, Geschoss mit Bogen, Rauch, Feuer, Krater als Bodenmarke, Wrack-Trümmer; Partikel über Instancing | Sonnet | Licht und Schatten | keine Effekt-Billboards; 50 Explosionen gleichzeitig ohne Einbruch |
| Wetter 3D | `weatherfx.js`: Regen und Schnee als Partikel im Ausschnitt, Nebelbänke als Höhennebel (`scene.fog` bzw. Shader), nasser Boden glänzt | Sonnet | Effekte 3D | Fotos Regen, Schnee, Nebel |
| Tag und Nacht 3D | `mood.js`: Sonnenstand, Farbe, Himmelslicht; nachts Laternen und Fenster als Lichtquellen (begrenzte Zahl, Rest emissiv) | Opus | Licht und Schatten, Stadthäuser 3D | Fotos Morgen, Mittag, Abend, Nacht |

## Stufe 5 – Kamera, 2D-Ansicht, Editor
| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| Freie Kamera | Drehen stufenlos (Q/E, zwei Finger), Neigung 30° bis 60° (Mausrad mit Taste), Zoom; `Camera` bekommt Drehwinkel und Neigung, `screenToWorld` über Strahl gegen das Gelände; Billboards dürfen dann keine mehr übrig sein; Speicherstand merkt die Ansicht | Opus | Stufen 2 bis 4 | Auswahl, Befehle und Ziehrahmen funktionieren in jeder Neigung; Smoke-Rundgang grün |
| Balken und Schilder | Lebensbalken, Sterne, Stadtschilder, Besatzungsschild bleiben 2D über der three-Leinwand, Lage aus `Vector3.project`; Verdeckung durch Gebäude optional | Sonnet | Freie Kamera | Balken sitzen in jeder Neigung über den Einheiten |
| 2D-Ansicht in 3D | Ansicht „von oben“ als three-Kamera senkrecht nach unten (gleiche Szene); bisherige `top.js`-Malerei entfällt; Minimap bleibt Canvas | Sonnet | Freie Kamera | Taste V wechselt ohne Ruckeln; Smoke-Rundgang grün |
| Editor in 3D | `editor.html` nutzt `Renderer3D` (Gelände formen live, Props setzen per Strahl) | Sonnet | 2D-Ansicht in 3D | Editor-Rundgang (Gelände, Props, Speichern) |

## Stufe 6 – Umstellen und Aufräumen
| Paket | Inhalt | Modell | braucht | fertig, wenn |
|---|---|---|---|---|
| Grafik-Einstellungen | Pausenmenü: Grafik 3D/klassisch, Schatten, Detail (Baumdichte, Partikel), Auflösung (`MAX_DPR_*`); Erkennung schwacher Geräte | Sonnet | Stufe 5 | Einstellungen gemerkt, Smoke auf phone grün |
| 3D als Standard | `?three=1` wird Standard, klassisch als Rückfall ohne WebGL; Hilfe (`helptext.js`, `start-html.js`), PRD (`docs/prd/steuerung-oberflaeche.md`), Änderungseintrag | Sonnet | Grafik-Einstellungen, Daniels Abnahme | `npm test`, Smoke alle Geräte grün |
| Alte Maler entfernen | Iso-Maler, die nur noch das klassische Bild bedienen, löschen oder auf Minimap/HUD-Symbole beschränken; `sw.js`, Ordner-`CLAUDE.md`, `npm run index` | Sonnet | 3D als Standard (eine Version Wartezeit) | keine toten Exporte; `npm test` grün |
| Doku und Rezepte | `ARCHITEKTUR.md` (Schichten, Bild), Feature-Landkarte, Rezepte `neue-einheit.md`, `rezept-einheiten.md`, `neues-gebaeude.md`, `neuer-prop.md` auf 3D | Sonnet | Alte Maler entfernen | Rezepte an einem Beispiel nachvollzogen |
| Leistungs-Wache | Test oder Skript, das Draw-Calls, Dreiecke und Bildrate einer festen Szene meldet und bei Verschlechterung warnt (`npm run smoke -- --3d`) | Haiku | 3D als Standard | läuft in CI-fähiger Form, Grenzwerte in `docs/testen.md` |

## Arbeitsweise
- Ein Paket je Sitzung, Name wie in den Tabellen. Vor jedem Paket `git pull origin main`; Eintrag als Datei unter `docs/changes/` erst ab
  dem Paket, das sichtbar etwas für Spieler ändert (vor „3D als Standard“ nur hinter `?three=1`: Eintrag „(Test, `?three=1`)“).
- Jedes Paket liefert Fotos alt/neu (`tools/smoke-3d.mjs`) und, wo es zählt, Bildrate und Draw-Calls vorher/nachher.
- Opus-Hauptsitzung plant, prüft und nimmt ab; Hilfsagenten bekommen vollständige Aufträge (Ziel, Dateien, Schnittstelle, Beispiel,
  Rückmeldeformat). Haiku nur für Pakete mit eindeutigem Ergebnis (Einbinden, Messen, Suchen, Lizenzen, Wache).
- Parallel möglich nach „3D-Gerüst“: 3D-Boden ‖ Körper-Wandler ‖ Billboard-Brücke; nach „Baukasten 3D“ alle Gebäudefamilien ‖ Props 3D;
  Stufe 4 parallel zu Stufe 3. Parallele Pakete schreiben nie in dieselbe Datei.
- Tests: Simulation unverändert; neue Node-Tests nur für Geometrie (Wandler, Baukasten: keine NaN, Umriss, Zahl der Ecken), Browser-
  Prüfungen über Smoke-Skripte.

## Risiken
- **Handys:** Schattenkarte und viele Meshes; Gegenmittel Instancing, zusammengeführte Geometrie je Gebäudevariante, Schattenstufen, LOD
  (weit weg Billboard oder vereinfachtes Mesh).
- **Speicher:** Sprite-Texturen in der Billboard-Brücke (heute schon Engpass bei Pixeldichte 2, `MAX_PIXELS`); Atlas mit Grenze und
  Freigabe, Billboards verschwinden mit jeder umgestellten Familie.
- **Optik bricht im Mischbetrieb:** 3D-Panzer neben gemalten Häusern; darum Stufe 2 direkt nach dem MVP.
- **Größe des Offline-Pakets:** three.js +0,7 bis 2,1 MB; verkleinern (Entscheidung oben), nur nötige Teile aus `examples/jsm`.
- **Aufwand:** 37 Pakete; der MVP sind 11 davon. Abbruch nach dem MVP kostet nur die Zeit der MVP-Pakete, das Spiel bleibt unverändert.
