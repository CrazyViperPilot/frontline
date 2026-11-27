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
- Körper-Wandler: gebaut (`js/render3d/solids3d.js`, Test `test/solids3d.test.js`: alle 35 Einheiten, Felsen, Hirsch, Wildschwein).
- 3D-Boden: gebaut (`js/render3d/ground3d.js`, Shader `FS_GROUND` aus `ground.js` unverändert). Durchlauf „Boden“ geteilt in
  „Gelände“ (three) und „Boden“ (Parks, Wege, Stadtstraßen, Zonen: bleibt 2D bis „Bodenmarken“).
- Billboard-Brücke: gebaut (`js/render3d/billboards.js`, Abgriff `setBlitSink` in `spritecache.js`, Atlas ≤ 4 Seiten 2048²).
- Schichtung geändert (Grund: Lichtstimmung `drawMood` multipliziert über die ganze Leinwand, über einer durchsichtigen 2D-Leinwand
  würde sie den 3D-Boden verdecken): three-Bilder werden je Durchlauf in die 2D-Leinwand kopiert statt darunter zu liegen; die
  Durchläufe tauscht `Renderer3D.swaps`. Zwei Leinwände erst, wenn Nebel, Bodenmarken und Stimmung in three sind.
- Prüfung `tools/smoke-3d.mjs`: Kamera 0 px; Iso gegen 3D (Seeds 3, 7, Sommer, Winter, 4 Drehungen) unter 1 % abweichende Pixel.
- 3D-Einheiten: gebaut (`js/render3d/units3d.js`): Meshes aus dem Körper-Wandler, Wanne und Turm getrennt, stufenlose Drehung,
  Soldaten mit Gehbildern als Posen, Luftfahrzeuge mit Tiefe statt „immer obenauf“, Licht wie `painter.js`. Rotoren und Nachbrenner
  weiter gemalt; offen: Instancing (heute ein Draw-Call je Einheit), Wracks als Mesh (heute verkohltes Billboard), Lackfoto `mat`.
- 3D-Nebel: gebaut (`js/render3d/fog3d.js`, `FS_FOG` auf dem Bodennetz).
- Bodenmarken: durch die Schichtung erfüllt (Ringe, Zonen, Radien liegen gemalt zwischen Gelände und Objekten, also unter den
  Einheiten). Offen: am Hang anschmiegen (heute eben in Objekthöhe wie in Iso); nötig erst mit „Freie Kamera“ (Marken als Bodentextur).
- Messung (Software-WebGL im Container, 200 Einheiten): Gelände 3D 152 ms gegen Iso 179 ms, Objekte 83 gegen 24 ms; mit
  Kantenglättung (MSAA) doppelt so teuer, daher aus. Echte Geräte: MVP-Messung.
- Licht und Schatten: gebaut (`js/render3d/sun3d.js`, Werte `BALANCE.shadows3d`, Pausenmenü „Schatten (3D)“ Aus/Mittel/Hoch,
  `?shadows=`). Sonne = `lightVec` (auch für das Licht der Einheiten, dreht weiter mit der Kamera in 90°-Schritten, passend zu den
  gemalten Gebäudeschatten); Schattenfänger auf dem Bodennetz im Durchlauf „Objekte“ (Begründung `js/render3d/CLAUDE.md`).
  Fahrzeuge und Luftfahrzeuge werfen Schatten, Soldaten behalten den gemalten (zu dünn für die Karte). Messung (Software-WebGL,
  200 Einheiten, „Objekte“): Aus ≈ 50–60 ms, Mittel/Hoch ≈ 145–155 ms; davon ≈ 35 ms Fänger, der Rest Leeren und Zeichnen der
  Schattenkarte und zweiter Render. Vergleich Iso/3D mit Schatten Hoch bis 1,4 % (Grenze 3 %).
- (erledigt mit 3D-Bäumen) Bäume als Werfer (`castShadow`, Ebene `CAST`), ihre gemalten Schatten in 3D dann abschalten wie bei den Einheiten
  (`shadow3d`); Einheiten empfangen keine Schatten (eigener Shader), Baumschatten auf Panzern bräuchte Schattenabfrage im Einheiten-Shader.
- Offen für MVP-Messung: Kosten der Schattenkarte auf echter GPU (Rechner, Handy „Mittel“); falls teuer: Karte nur bei Bewegung neu,
  Bodennetz in Kacheln mit Sichtprüfung (Fänger und Boden zeichnen heute das ganze Netz).
- 3D-Bäume: gebaut (`js/render3d/trees3d.js`, Test `test/trees3d.test.js`, Prüfteil `smoke-3d.mjs --only baeume`). Je Art 2 Formen als
  `InstancedMesh` (8 Draw-Calls bei 681 bis 1500 Bäumen), Palette je Baum aus `nature.js` über eine kleine Farbtextur, Blattmuster
  aus `nature.js`, Herbstlaub, im Winter Laubbäume kahl und Schnee als Band je Fichtenstockwerk. Unter Zoom 0,55 grobe Formen; in die
  Schattenkarte zeichnet immer die grobe Form. Dreiecke je Baum: fein 150 bis 430, grob 56 bis 160. Gemalte Baumschatten fallen mit
  Schattenkarte weg. Messung „Objekte“ (Software-WebGL, Seed 7, Schatten Aus/Hoch): Zoom 1, 883 Bäume: gemalt 34/78 ms,
  3D 98/191 ms; Zoom 0,5, 1500 Bäume: gemalt 31/84 ms, 3D 71/205 ms. Bäume als Teile der Großbauten laufen mit.
- Offen für MVP-Messung: echte GPU (Rechner, Handy „Mittel“) mit Wald im Bild; falls zu teuer: weiter weg Billboards (Impostor),
  weniger Bäume in die Schattenkarte, Bodennetz in Kacheln. Einheiten empfangen keine Schatten (Baumschatten auf Panzern fehlen);
  3D-Bäume dicht an gemalten Gebäuden können mit der Krone durch die Wand ragen (Billboards haben nur die Tiefe des Fußpunkts).
- MVP-Messung: gebaut (`tools/smoke-3d.mjs --only mvp`, Bericht `docs/mvp-3d-bericht.md` mit Fotos alt/neu und Anleitung).
  Rundgang desktop/tablet/phone grün: Auswahl und Befehl in 3D per Klick bzw. Tippen, Umschalten, Drehungen, Zoom, Wald, Hang,
  Winter, keine Browserfehler. Bildrate nach 5 Spielminuten (Software-WebGL, nur Vergleich): 3D Aus 0,8–1,0× Iso, 3D Mittel/Hoch
  0,65–0,8× Iso (Wald am schlechtesten; Desktop Basis Iso 3,2, 3D Mittel 2,3 Bilder/s). Mehraufwand fast ganz in „Objekte“.
  Neu offen: im Iso-Winterfoto fehlte ein Bauernhof-Sprite (Zeitbudget des Sprite-Caches?).
- Daniel, 2026-11-26, nach der MVP-Messung: weiter mit Stufe 2.
- Baukasten 3D: gebaut (`js/render3d/kit3d.js`, Vorlage `js/render3d/town3d.js` mit Wohnen Stufe 1 und 2, Test `test/kit3d.test.js`,
  Prüfteil `smoke-3d.mjs --only baukasten`, Fotos `.smoke/3d/baukasten/`). Teile wie `isokit.js` mit allen Seiten: Kasten, Wand mit
  Fensterreihen (Rahmen, Kreuz, Läden), Tür, Satteldach, Walmdach, Attika, Balkon, Zylinder, Kegeldach, Haube, Kugel, Sockel, Gesims,
  Farbband, Bodenfläche, dazu Garten-Baum, Busch, Auto. Ein Kit3D schreibt alle Teile in einen Puffer (statt `mergeGeometries`, kein
  Zusatz aus `examples/jsm`): ein Draw-Call je Haus, ein `ShaderMaterial` für alle Gebäude. Materialfotos aus `materials.js` als eine
  Texturebenen-Textur (8 Ebenen, Mischung „overlay“ wie gemalt); Schnee (Shader, Flächen nach oben, wie `snowy`) und Nacht (`uNight`:
  beleuchtete Fenster heller, 2,5-mal so viele) ohne neue Geometrie, also eine Geometrie je Variante für alle Jahres- und Tageszeiten.
  Gebäude werfen und empfangen Schatten (three-Schattenchunks, Stärke wie der Fänger); Bodenflächen ungeschattet wie `isokit.flat`.
  Messung: Wohnen 1 530 Dreiecke, Wohnen 2 860, je 1 Draw-Call (dazu 1 in der Schattenkarte). Umriss Drehung 0 wie gemalt (Prüfteil:
  Bildbereich ±1 bzw. ±6 px; Node-Test: Iso-Projektion im Bildrechteck von `townhouses.js`, höchster Punkt ±4 px). Rückseiten bekommen
  Fenster (gemalt nie sichtbar). Im Spiel noch nichts umgestellt (Folgepakete). Offen für „Stadthäuser 3D“: Renderer muss `setKitFrame`
  je Bild setzen (Sonne, Winter, Nacht aus `mood`, Schattenstärke aus `BALANCE.shadows3d.opacity`); Gartenbäume als einfache Kugeln
  (oder `Trees3D` nutzen); Fenster nachts noch unter `drawMood` (wirklich hell erst mit „Tag und Nacht 3D“).
- Stadthäuser 3D: gebaut (`js/render3d/town3d.js`, alle 6 Arten × 3 Stufen × 3 Farbvarianten, Teamfarbe bei `TEAM_SHOWN`; Test
  `test/kit3d.test.js`; Prüfteile `smoke-3d.mjs --only baukasten` (Bögen je Art und Stimmung, Farbvarianten) und `--only stadt`
  (Seed 3, KI gegen KI 10 Spielminuten, Fotos `.smoke/3d/stadt/`)). Neue Bauteile in `kit3d.js` mit Namen wie `isokit.js`/`townhouses.js`:
  Stab, Rohr, Wandscheibe, Kreis, Schaufenster, Markise, Rundbogen- und Fächerfenster, Tonnendach, Zeltdach, Lüfter, Parabolantenne,
  Gittermast, Zaun, Rippen, Klimakasten, Laterne, Fahne, Lieferwagen, Kiste, Pflaster, Solarzellen, Landeplatz, Brunnen, Uhr. Glas-
  fassaden mit Verlauf je Ecke; Schaufenster, Laternen und Glaskanzeln leuchten nur nachts (`GLOW_NIGHT`). Pflaster, Wege und
  Markierungen schneefrei wie gemalt. Dreiecke je Variante: Heliport 328/604/738, Wohnen 530/860/1686–1828, Gewerbe 606/700/1302–1312,
  Markt 1104/1258/1504, Rechenzentrum 954/1244/1560–1564, Krankenhaus 818–822/1036–1042/1308–1316. Umriss Drehung 0 wie gemalt:
  höchster Punkt 1–3 px unter `TALL`, Bildbereich im Prüfteil ±1 bis ±6 px. Im Spiel (`?three=1`): `Town3D` mit einem `InstancedMesh`
  je Variante (geteilte Geometrie, ein Draw-Call je Variante im Bild, einer in der Schattenkarte), Höhe wie das Billboard (`cam.pinned`),
  `setKitFrame` je Bild aus `lightVec`, Winter, `mood` und `BALANCE.shadows3d.opacity`. Messung (Seed 3, 10 Spielminuten, Hauptstadt,
  Zoom 1, 49 Stadthäuser in 14 Varianten im Bild, „Objekte“ samt Schattenkarte, Software-WebGL): Schatten Aus gemalt 12 Draw-Calls,
  6 670 Dreiecke, 31 ms → 3D 26 Draw-Calls, 78 470 Dreiecke (Häuser 71 898), 57 ms; Schatten Hoch gemalt 22 Draw-Calls, 249 378 Dreiecke,
  89 ms → 3D 50 Draw-Calls, 393 076 Dreiecke, 140 ms; zweiter Lauf (56 Häuser, 15 Varianten; die Stadt wächst je Lauf etwas anders,
  weil die Spielschleife vor dem Anhalten kurz läuft): Aus 15 → 30 Draw-Calls, 39 → 62 ms; Hoch 28 → 58 Draw-Calls, 88 → 149 ms. Software-WebGL rechnet Dreiecke auf der CPU; auf echter GPU zählen eher die
  Draw-Calls (+14 bzw. +28). Messen an Seeds vorher: nach 10 Spielminuten 82 Stadthäuser (Seed 3, beide Teams), nach 20 min 199, davon
  75 % Wohnen 3 und 14 % Gewerbe 3 (die teuersten Varianten).
  **Gartenbäume:** Kugelbäume des Baukastens (Stamm, drei Kronenkugeln) bleiben Teil der Hausgeometrie. Grund: gemalt sind es dieselben
  Kugelkronen, im Winter verschneit statt kahl (wie `LEAF_SNOW`, im 3D-Shader Schnee auf der Krone); ein Teil des Hauses kostet keinen
  Draw-Call, `Trees3D` bräuchte je Haus 1 bis 3 Instanzen samt Satzpflege und machte die Bäume im Winter kahl (Bruch zum gemalten Bild).
  Offen: Fenster nachts noch unter `drawMood` („Tag und Nacht 3D“); Dreiecke sparen, falls echte Geräte es brauchen (fern: grobe
  Varianten ohne Fensterkreuze und Balkone, analog Bäume); Ruinen und Baustellen der Stadt bleiben Billboards („Baustellen und Ruinen 3D“).
- Werke 3D: gebaut (`js/render3d/works3d.js`, alle 6 Anlagen × 3 Stufen aus `render/works.js`; Test `test/kit3d.test.js`; Prüfteile
  `smoke-3d.mjs --only baukasten --what werke` (Bogen je Art und Stimmung mit gemalt + 4 Drehungen, `werk-<art>-teams` mit allen vier
  Teamfarben, Fotos `.smoke/3d/baukasten/werk-*.png`) und `--only stadt` (Ausschnitt mit den meisten Werken)). Neue Bauteile in
  `kit3d.js` (Namen wie `isokit.js`/`works.js`): `facePoly`, `lathe`, `band`, `seam`, `stack`, `sphere`, `hcyl`, `pipe`, `rack`, `wire`,
  `gallery`, `conveyor`, `heap`, `rails`, `logPile`, `mound`; `frustum` mit `inside` (Innenwand von Kühlturm und Schwimmdachtank,
  sonst sähe man durch die Rückwand), `vault` mit Fotowahl, `flagpole` mit Teamfarbe. **Gemessen vor dem Plan** (Seed 3 und 7, KI gegen
  KI, beide Teams zusammen, jedes Werk einmal): nach 10 Spielminuten 35 bis 36 Werke (Stufe 3 gut 2/3), nach 20 min 93 (Seed 3:
  Kraftwerk 3 × 18, Munition 3 × 21, BM 3 × 14, Raffinerie 3 × 13, Kerosin 3 × 10, Stahl 3 × 9; 91 % Stufe 3) bzw. 135 (Seed 7; 82 %
  Stufe 3). Die teuren Stufen sind also die häufigen. Dreiecke je Variante (Stufe 1/2/3): Kraftwerk 2 986/3 442/4 228, BM 1 552/2 080/
  2 648, Munition 2 678/3 118/3 526, Raffinerie 2 030/3 188/4 228, Stahl 2 358/2 970/3 656, Kerosin 2 060/3 258/4 298 (Testgrenze 6 000).
  Umriss wie gemalt: Drehung 0 höchster Punkt 0,1 px über bis 1,6 px unter `TALL`, Bildbereich im Prüfteil ±1 bis ±3 px.
  Im Spiel: `Town3D` ist jetzt eine Liste von Gebäudefamilien (`FAMILIES` in `town3d.js`: Stadthäuser, Werke; neue Familie = eine Zeile mit
  `has`, `key`, `geometry`, `team`), `renderer.works3dOn` schaltet die Werke auf gemalt. Draw-Call je Art und Stufe, gleich wie viele
  Werke und welche Teams: **eine Geometrie je Art und Stufe für alle Teams**, die Teile in Teamfarbe (Bänder, Fahnen, Tankringe,
  Vordächer, Wasserturmband) tragen `aInfo.y = 97`, der Shader nimmt dort `instanceColor` der Instanz. Grund: Teamfarbe in der Geometrie
  hätte je Team einen eigenen Satz gebraucht (bei vier Teams der Eroberung 72 statt 18 Geometrien, je 0,5 bis 0,7 MB, und 4-mal so
  viele Draw-Calls). Boden der Anlage (Beton, Straßen, Gleisbett, Lager): Flächen mit `bare` (neu: ohne Schnee, volle Farbe, nur
  Schatten wirken) und je Fläche 0,012 höher, damit spätere Flächen früheren vorgehen; Rasen mit Schnee wie gemalt.
  **Entscheidungen:** (1) *Rauch und Dampf bleiben Effekt, gemalt:* der Dampf der Kühltürme ist ein Wolkenbild in Bildkoordinaten, das
  sich nicht mit der Kamera dreht; es wird wie bisher als Bild (`drawWorksSteam`, Sprite-Cache, gleiches Bild für alle Drehungen) am
  Ort des Turms über das Mesh gelegt (Billboard mit der Tiefe der Werksmitte). Als Volumen wäre es teuer und sähe schlechter aus.
  Rauch bei Schaden (`damage`) bleibt wie bei den Häusern gemalt. (2) *Glut und Flammen leuchten selbst:* Flächen mit `emit` (aInfo.z = 4)
  ignorieren Licht, Schnee und Schatten (Glut am Stichloch des Hochofens, Schlackenplätze, heiße Ofentüren des Ringofens, Torpedowagen,
  Gießhallenband, Fackeln); sie flackern nicht (gemalt auch nicht). Echtes Leuchten in die Umgebung, Flackern und Bloom gehören zu
  „Tag und Nacht 3D“. (3) *Förderbänder stehen still wie gemalt* (kein Lauf der Bänder, keine Beladung): reines Mesh ohne Bewegung hält
  den Draw-Call je Variante bei 1; ein laufendes Band bräuchte ein Textur-Offset je Instanz oder einen eigenen Satz. (4) *Instancing:*
  ein `InstancedMesh` je Art und Stufe (wie die Häuser), keine Verschmelzung ganzer Anlagen und keine gröbere Form für fern (offen,
  siehe unten). Beim ersten Gebrauch einer Variante entsteht die Geometrie (5 bis 28 ms), danach nur noch Instanzen.
  Messung (Seed 3, 10 Spielminuten, Ausschnitt mit den meisten Werken, 1 280 × 800, Zoom 1, 38 Werke in 11 Varianten und 62 Stadthäuser in
  15 Varianten im Bild, „Objekte“ samt Schattenkarte, Software-WebGL): Schatten Aus gemalt 14 Draw-Calls, 9 272 Dreiecke, 45/40/36 ms → nur
  Häuser 3D (Stand vor „Werke 3D“) 29, 98 302, 64/62/63 ms → mit Werken 40 Draw-Calls, 228 078 Dreiecke (Werke 129 828), 94/103 ms; Schatten Hoch
  gemalt 24, 252 832, 128/109/112 ms → nur Häuser 3D 54, 431 016, 194/190/194 ms → mit Werken 76 Draw-Calls, 690 620 Dreiecke, 293/299 ms. Mehrere
  Zeiten je Zeile sind mehrere Läufe (die erste vor den Änderungen, Rauschen etwa 10 %). Software-WebGL rechnet Dreiecke auf der CPU; die +11 (Aus) bzw. +22 (Hoch)
  Draw-Calls sind auf echter GPU die Größe, die zählt.
  Offen: Dreiecke sparen, falls echte Geräte es brauchen (Bäume der Werke je 204 Dreiecke, Zäune der Munitionsfabrik 1 100, Kugeln und
  Nähte; fern: grobe Varianten ohne Zäune, Bäume und Nähte); Werke bei Schaden dunkler wie in 2D (`damage`, gemalt nur in 2D);
  Förderbänder und Fackeln animieren und nachts leuchtende Anlagen („Tag und Nacht 3D“); Ruinen und Baustellen der Werke bleiben Billboards.
- Großbauten 3D: gebaut (`js/render3d/bigbuild3d.js`: Kaserne, Fabrikhalle, Lagerhalle, Güterbahnhof je Stufe 1 bis 3 aus `bigPlan`
  (`render/bigbuild.js`) und Universität; `js/render3d/gov3d.js`: Regierungsgebäude und Regierungsviertel; Test `test/kit3d.test.js`; Prüfteile
  `smoke-3d.mjs --only baukasten --what grossbau` (Bogen je Art und Stimmung mit gemalt + 4 Drehungen, `grossbau-<art>-teams`, Fotos
  `.smoke/3d/baukasten/grossbau-*.png`) und `--only stadt` (Ausschnitt mit Großbauten und Hauptstadt, `seed3-grossbau-*`, Messung)). Neue
  Bauteile in `kit3d.js` (Namen wie `university.js`/`cityhall.js`): `domeRibs`, `cylWins`, `colonnade`, `banner`; `sawRoof` aus `works3d.js`
  mitgenutzt. **Gemessen vor dem Plan** (Seed 3 und 7, KI gegen KI, beide Teams zusammen, jede Anlage einmal): nach 10 Spielminuten Seed 3
  Kaserne 3 × 4, Fabrikhalle 3 × 4, Universität 3 × 2, Güterbahnhof 3 × 1 (dazu 6 Fliegerhorst-Bausteine Stufe 1), Seed 7 Kaserne 3 × 4,
  Fabrikhalle 3 × 3 + 2 × 1, Universität 3 × 2, Güterbahnhof 3 × 1; nach 20 min Seed 3 Lagerhalle 3 × 2, Kaserne 3 × 5, Güterbahnhof 3 × 2,
  Fabrikhalle 3 × 4, Universität 3 × 2 (Fliegerhorst 12 Bausteine Stufe 3), Seed 7 Lagerhalle 3 × 4, Güterbahnhof 3 × 3, Kaserne 3 × 6,
  Fabrikhalle 3 × 4, Universität 3 × 2; dazu je Team eine Hauptstadt mit Rathaus und Viertel (2). Stufe 3 ist also die häufige Stufe, wenige
  (3 bis 8) Großbauten im Bild, dafür die teuersten Modelle. Dreiecke je Variante (Stufe 1/2/3): Kaserne 708/976/1 224, Fabrikhalle
  960/1 390/1 774, Lagerhalle 232/282/358, Güterbahnhof 172/452/558, Universität 2 070/2 662/3 358, Regierungsgebäude 2 864, Regierungsviertel
  4 914 (alle Gruppen; je Gruppe 192 bis 996). Umriss: Node-Test Iso-Umriss der Geometrie ±3 px gegen die Körper aus `bigPlan` bzw. gegen das
  Bildmaß von `cityhall.js` (`[−72, −126, 76, 42]`), Prüfteil Drehung 0 ±1 bis ±13 px (Fabrikhalle Stufe 1 ±13: Dach und gemalte Kontur).
  **Entscheidungen:** (1) *Eine Instanz je Anlage:* ein Großbau besteht in `cityBuildings` aus vielen Objekten (`bigpart`, je Körper, wegen
  der Tiefenordnung gemalter Billboards); im Modus 3D teilen alle Körper einen `plan` (Art, Stufe, Mitte), `Town3D` stellt die Anlage beim
  ersten Körper als eine Instanz auf (Familie mit `at`, weitere Körper: nur „gezeigt“), ein Draw-Call je Art und Stufe; die Tiefenordnung
  übernimmt der Tiefenpuffer (Billboards von Einheiten davor und dahinter stimmen über `clipDepth`). Höhe: tiefste Ecke des Quadrats wie
  `baseHeight`. Teamfarbe je Instanz (Streifen, Fahnen, Banner, Giebelschild), eine Geometrie je Art und Stufe für alle Teams. (2) *Gemalt
  bleiben:* Bäume und Ausstellungsstücke (Einheitenmodelle) der Höfe (Billboards wie bisher, die Ausstellungsstücke folgen mit den Einheiten),
  der Fliegerhorst (`airbase.js`, eigenes Paket „Fliegerhorst 3D“) und **der Boden** (Höfe, Gleise, Pflaster, Rasen der Universität, Prachtstraßen,
  Platz und Parkplätze des Viertels): er liegt im Durchlauf „Boden“ auf dem Gelände unter den Objekten und ist Fläche, kein Körper; ein
  3D-Boden gehört zu „Bodenmarken“/„Freie Kamera“ (Marken an den Hang schmiegen). (3) *Lagerhalle und Güterbahnhof:* gemalt nur glatte
  Quader (nicht `fine`), die Plandaten tragen aber Satteldach, Sheddach, Tore und Fenster (`bigTop` zählt den Giebel schon); 3D zeigt sie
  mit Schmuck wie Kaserne und Fabrikhalle, die Höhe weicht um den Giebel (9 bis 10) vom gemalten Quader ab. (4) *Kuppeln:* Ellipsoid-Kappe in
  einer Farbe (das Licht schattiert, statt Verlauf) mit Rippen als dünnen Bändern über der Fläche (`domeRibs`, wenige Dreiecke, keine Rohre),
  Tambour und Laterne mit Fenstern rundum. (5) *Fahnen:* flache, beidseitige Rechtecke in Teamfarbe (Bild-rechts in Drehung 0, kein Wehen);
  in Drehung 1 und 3 stehen sie fast kantig zum Bild und sind dünn, der Mast bleibt. Offen: wehende Fahne (zwei Knicke). (6) *Glas, Uhren,
  Rauch:* keine Uhren und kein Rauch in diesen Bauten; Fenster nachts wie die Stadthäuser (`uNight`), Schadensrauch bei Stadtbauten bleibt gemalt
  (`drawTownItemIso`), Rathaus und Viertel nur Mesh. (7) *Regierungsviertel:* ein Mesh je Hauptstadt, Geometrie je Teamdrehung (`TURN`) und
  Bitmaske der freien Gruppen (`quarterMask`; belegt ein Bunker oder Turm eine Gruppe, fehlt sie im Mesh wie gemalt), dazu ein Draw-Call
  statt bis zu acht; Bäume des Viertels sind Kugelbäume des Baukastens (wie die Gartenbäume der Stadthäuser, gemalt dasselbe), die der
  Höfe der Großbauten bleiben gemalt. (8) *Universität* gemalt für jede Drehung dasselbe Bild; in 3D steht sie wirklich vierfach symmetrisch
  und dreht mit der Kamera, Bäume und Ecktürme (Banner in Teamfarbe) sind echte Körper. Schalter `renderer.big3dOn` (false = alles gemalt).
  **Messung** (Seed 3, 10 Spielminuten, Ausschnitt mit Kaserne 3, Fabrikhalle 3, Hauptstadt mit Regierungsviertel und Stadthäusern und
  Werken, 1 280 × 800, Zoom 1, „Objekte“ samt Schattenkarte, Software-WebGL, 8 Bilder): Schatten Aus gemalt 16 Draw-Calls, 7 812 Dreiecke,
  71 ms → Häuser und Werke 3D (Stand vor dem Paket) 42 Draw-Calls, 212 900 Dreiecke, 165 ms → alles 3D 47 Draw-Calls, 230 014 Dreiecke
  (Großbauten 7 Instanzen in 5 Varianten, 17 132 Dreiecke), 172 ms; Schatten Hoch gemalt 30, 251 634, 160 ms → vorher 82, 661 964, 491 ms →
  nachher 92 Draw-Calls, 696 210 Dreiecke, 525 ms. Die +5 (Aus) bzw. +10 (Hoch) Draw-Calls sind auf echter GPU die Größe, die zählt;
  Software-WebGL rechnet Dreiecke auf der CPU. Offen: Rathaus bei Schaden dunkler (gemalt nur in 2D und Iso); wehende Fahnen; fern grobe
  Varianten ohne Fenster und Rippen, falls echte Geräte es brauchen; Fenster nachts leuchten erst mit „Tag und Nacht 3D“ wirklich.
- Kartenstadt 3D: gebaut (`js/render3d/maptown3d.js`, Test `test/maptown3d.test.js`; Prüfteile `smoke-3d.mjs --only baukasten --what kartenstadt` (je Art gemalt + 4 Drehungen, Sommer/Winter × Tag/Nacht, `kartenstadt-<art>-<stimmung>.png`, je Hausstil ein Bogen `…-farben`) und `--only karte` (Ausschnitte echter Karten Seed 3, 7 und East Europe Railway, Iso | 3D in 4 Drehungen, Fotos `.smoke/3d/karte/`)). Alle Arten aus `maptown.js` und `landmarks.js`: Altbau (mit Hof, Mauer und Gitter), Klinkerhaus, Fachwerkhaus, Neubau, Gehöft; Lagerhalle (Sattel- und Tonnendach), Fabrik mit Shedhalle, Mauerstück, Zugteile (Lok, Kessel-, Containerwagen), Bahnhof, Bahnsteig, Wachtürme (4 Treppenseiten), große Fabrikhalle, Strommast. Wände, Dächer, Fenster, Türen, Balkone, Schornsteine, Silos mit denselben Maßen und Farben wie gemalt, dazu alle vier Wände (Fenster und Türen auch hinten), wo gemalt nur zwei zu sehen waren. Neue Bauteile in `kit3d.js` waren nicht nötig; `works3d.js` gibt `gate` und `lorry` weiter, `town3d.js` hat die Familie `maptown` (Zeile) und `Town3D.add` kennt `yaw` und `scale` je Familie. **Gemessen vor dem Plan** (`generateMap`, ohne Spiel): Seed 3 hat 511 Gebäude der Kartenstadt (276 Häuser in 16 Größen von 72 × 56 bis 96 × 72, 46 Fabriken, 62 Hallen, 120 Mauerstücke in 6 Maßen, 4 Türme, 3 Zugteile), Seed 7 599 (344 Häuser, 52, 76, 120, 4, 3), die feste Karte East Europe Railway 114 (45 Häuser, 40 Masten in einer Linie über 19 974 px, 1 Fabrikhalle, 1 Bahnhof, 1 Bahnsteig, 10 Zugteile, 6 Mauern, 8 Hallen, 1 Fabrik, 1 Turm). Im Bild (Zoom 1, Stadtmitte): 71 bis 104 Gebäude der Kartenstadt. Zufallskarten haben nie Masten, Leitungen und Fabrikhalle gibt es nur auf festen Karten.
  Dreiecke je Variante: Altbau 2 708, Klinkerhaus 952, Fachwerkhaus 1 164, Neubau 1 416 bis 1 530, Gehöft 696, Lagerhalle Sattel 1 252 und Tonne 988, Fabrik 1 758, Mauerstück 90 (100 × 16), Lok 398, Kesselwagen 216, Containerwagen 250, Bahnhof 2 406, Bahnsteig 216, Wachturm 1 340, Fabrikhalle 2 982, Mast 1 256 (Testgrenzen je Art in `test/maptown3d.test.js`). Umriss wie gemalt: höchster Punkt höchstens 3 px über der Bildhöhe in `maptown.js`/`landmarks.js` (Altbau 53 gegen 52, Wachturm 114 gegen 115, Mast 156 gegen 164 mit Spitzenlicht), Grundriss im Maß des Gebäudes; Prüfteil ±14 px plus 8 % der Größe (gemalte Bodenschatten liegen im Bildbereich; größte Abweichung 18 px bei Wachturm und Lok, sonst bis 16 px).
  **Entscheidungen:** (1) *Eine Geometrie je Stil und Farbe, Größe über die Instanz:* gemalt hängt das Bild am Maß im 8-px-Raster; mit dem Maß (beim Altbau auch der Fensterart) im Schlüssel wären es 458 Geometrien über die drei Prüfkarten und im Bild fast jedes Haus ein eigener Draw-Call; so sind es 107 (davon höchstens 30 Häuser). Darum bauen alle Häuser 88 × 72 (längere Seite entlang x), die Instanz streckt sie in x und y auf das Maß (0,82 bis 1,09 in x, 0,78 bis 1,11 in y; Höhe bleibt) und dreht sie bei hochkant stehendem Grundriss um −90° (`Town3D` Familienfeld `scale`/`yaw`; Tür dann wie gemalt nach +x). Der Kit-Shader teilt die Normale durch das Quadrat der Streckung (`kit3d.js`, nur bei Instanzen), Beleuchtung bleibt richtig. Hallen, Fabriken, Mauern, Bahnhof, Fabrikhalle behalten ihr genaues Maß im Schlüssel (wenige Maße), nur die Drehung (Welt-y statt Welt-x) kommt von der Instanz. Zug und Bahnsteig drehen mit `b.angle`, der Mast mit der Leitungsrichtung (ungerundet, gemalt auf 16 Stufen gerundet). (2) *Welt fest statt Bildrahmen:* gemalt wird je Drehung ein Bild mit den sichtbaren Seiten nach vorn (Tür, Tore, Rampen, Balkone immer zum Betrachter); in 3D stehen Tür und Tore an einer festen Wand (Längsseite nach +y bzw. +x wie in Drehung 0), die Rückseiten bekommen Fenster und eine Hintertür. (3) *Fensterlicht je Variante:* gemalt ist das Muster der beleuchteten Fenster je Bild (Schlüssel ohne Hausnummer) gleich; in 3D je Geometrie ein festes Muster aus dem Schlüssel. (4) *Leitungen als Linien (`Wires3D`):* je Feld zwischen zwei Masten fünf Leiterseile (`PYLON_WIRES`) als Linienzug aus 12 Strecken mit Parabel-Durchhang `PY.sag` (Höhe von Mast zu Mast mit der Geländehöhe am Mast), ein dynamischer Puffer und ein Draw-Call für alle Felder im Bild, Tiefentest gegen Gebäude und Bäume, kein Schatten; der gemalte Durchlauf „Leitungen“ entfällt in 3D (`wires3dShown`). Grund gegen Röhren: Hunderte Seile je Bild, 1 Geräte-Pixel genügt wie gemalt (0,9 px); auf Pixeldichte 2 ist die Linie dünner als gemalt. (5) *Was gemalt bleibt:* Boden des Altbaus (Hof, Vorplatz, Weg; er läuft im Bodendurchgang, der gemalte Schlagschatten entfällt mit dem Mesh), Parks und Wege, Autos und Bänke (Props 3D), Hofbäume und Parkbäume (laufen als Bäume 3D), Ruine eines zerstörten Hauses (gemalter Schutt vor dem Haken wie bei den Stadthäusern), Sandsäcke, Draht und Fahne besetzter Häuser (`stronghold.js`). Ein Haus der Karte hat sonst keine Schadensstufen. 2D und Iso bleiben pixelgleich (`maptown3dOn = false` malt auch in 3D alles wie bisher).
  Messung (Software-WebGL, 1 280 × 800, Zoom 1, „Objekte“ samt Schattenkarte, 8 Bilder; gemalt → 3D; Schatten Aus | Hoch): Seed 3 Stadtmitte (104 Gebäude, 39 Varianten) 9 → 48 | 18 → 96 Draw-Calls, 112 260 → 265 188 | 393 776 → 699 840 Dreiecke, 69 → 155 | 256 → 422 ms; Seed 7 Stadtmitte (75 Gebäude, 38 Varianten) 20 → 58 | 40 → 116, 102 382 → 227 246 | 388 506 → 638 340, 86 → 136 | 248 → 357 ms; feste Karte Stadtmitte (19 Gebäude, 13 Varianten, 3 Leitungsfelder) 17 → 31 | 34 → 61, 163 078 → 190 046 | 479 190 → 533 164, 97 → 114 | 268 → 297 ms; Fabrikhalle (Zoom 0,7) 22 → 38 | 44 → 73, 287 197 → 304 211 | 678 810 → 712 870, 156 → 166 | 419 → 433 ms; Bahnhof 20 → 32 | 42 → 66, 105 → 134 | 290 → 224 ms (Rauschen); Mastlinie (10 Leitungsfelder) 18 → 26 | 36 → 51, 99 → 98 | 261 → 290 ms. Die Dreiecke sind die der Szene, Software-WebGL rechnet sie auf der CPU; auf echter GPU zählen eher die Draw-Calls (in einer Stadt etwa +40, mit Schattenkarte +80). Prüfteil `vergleich` (Iso gegen 3D am Start) bleibt unter 1,5 % (Grenze 3 %), `maptown3dOn = false` war dort nicht nötig.
  Offen: Draw-Calls der Stadtmitte (30 Hausvarianten aus 5 Stilen × 6 Farben, dazu Hallen): Farbe als Instanzfarbe wie die Teamfarbe (eine Geometrie je Stil) oder Verschmelzen ferner Häuser; Dreiecke sparen, falls echte Geräte es brauchen (Gitter der Hofmauer allein 850 beim Altbau, Eckquader, Fensterkreuze; fern: grobe Varianten); Liniendicke der Leitungen nach Pixeldichte; Hof und Bodenmarken des Altbaus als Teil von „Straßen und Wege 3D“; Ruinen und Baustellen der Kartenstadt bleiben Billboards („Baustellen und Ruinen 3D“).
- Wasser 3D: gebaut (`js/render3d/ground3d.js`, Shader `FS_WATER`, Prüfteil `smoke-3d.mjs --only wasser`, Fotos `.smoke/3d/wasser/`).
  **Eigenes Netz statt Boden-Shader:** Das Wasser teilt Lage und Höhen (`position`, `aH`) mit dem Bodennetz, hat aber eine eigene
  Dreiecksliste (nur Dreiecke mit einer Ecke unter `RELIEF.water`: 3 540 bei Seed 3 ohne Fluss, 7 632 bei Seed 4 mit Fluss, gegen
  242 200 im Boden). Gründe: eigener Shader mit Blickrichtung (Fresnel, Sonnenglanz), den `FS_GROUND` nicht kennt und nicht bekommen
  soll (Iso bleibt pixelgleich); gleiche Ecken wie der Boden geben die Uferlinie genau an der Stelle, an der `FS_GROUND` sein Wasser
  malt (kein Spalt), `polygonOffset` zum Betrachter verhindert Flimmern, der Tiefentest gegen das Bodennetz verdeckt Wasser hinter
  Hügeln; ein Draw-Call mehr. Der Fluss ist Gelände unter dem Wasserspiegel (`landscape.js` `riverHeight`), also dasselbe Netz;
  Brücken bleiben gemalt darüber (Durchlauf „Boden“), ihr gemalter Schatten liegt auf dem 3D-Wasser. Schatten der Werfer fallen über
  den Schattenfänger (gleiches Netz) aufs Wasser, Nebel und `drawMood` (Nacht) liegen wie auf dem Boden darüber; nachts kein Glanz,
  dunkler Himmel. Inhalt: Grundfarbe wie `FS_GROUND`, über tiefem Grund dunkler (Tiefe bis 48 px), Wellen aus den Rauschlagen von
  `FS_GROUND` als Normale (Bildschirm-Ableitungen, keine weiteren Texturzugriffe), Spiegelung des Himmels je Stimmung, Uferschaum
  (Wellen laufen aufs Ufer zu), heller Saum, Winter: kälteres Wasser, Eisrand mit feinen Rissen. Der 3D-Boden verwirft unter tiefem
  Wasser (Uniform `uWater3d`, Zeile vor `FS_GROUND` nur in `ground3d.js`). Messen an Seeds vorher: Wasser 0,8–1,5 % der Karte ohne
  Fluss, 2,7–3,5 % mit Fluss, um die Hauptstadt 0 % (Prüfteil `vergleich` bleibt unberührt: höchstens 1,45 %).
  Messung „Gelände“ (Software-WebGL, Zoom 1, Drehung 0, Schatten Hoch, ohne = Wasser ausgeblendet und Boden malt sein Wasser selbst;
  3 × 12 Bilder): See (Seed 3, gut ein Viertel des Bilds Wasser) 201 → 214 ms, Fluss an der Brücke (Seed 4) 218 → 241 ms; Prüfteil
  (8 Bilder) 209 → 219 bzw. 238 → 234 ms. Draw-Calls im Bodenbild 2 → 3, Dreiecke 242 200 → 245 740 bzw. 249 832. Offen: auf echter
  GPU messen; Wasser ohne Strömungsrichtung (Fluss wellt wie der See), Spiegelung nur des Himmels (keine Ufer, Bäume, Brücken).
- **Licht (offener Punkt 5 des MVP-Berichts), entschieden:** eine Sonne für die ganze 3D-Szene, `lightVec` (rechts oben im Bild, dreht
  mit der Kamera). 3D-Gebäude sind damit rechts hell wie Einheiten, Bäume und Geländerelief, ihre Schatten fallen nach links unten wie
  die gemalten Gebäudeschatten. Gemalte Billboards (Wand links hell) bleiben bis zur Umstellung ihrer Familie so; der Bruch verschwindet
  mit Stufe 2. Verworfen: Sonne nach links drehen (alle Schatten fielen nach rechts, 3D-Boden wiche von Iso ab) und gemalte Gebäude
  umfärben (Aufwand für eine Übergangszeit). Frage an Daniel nur, falls er links helle Wände im 3D-Bild ausdrücklich will.
- Effekte 3D: gebaut (`js/render3d/fx3d.js`, Test `test/fx3d.test.js`, Prüfskript `node tools/smoke-fx3d.mjs`, eigene Datei neben `smoke-3d.mjs`,
  Fotos `.smoke/3d/effekte/`). Der Durchlauf „Effekte“ ist in 3D ersetzt (`Renderer3D.fx3dPass`, Schalter `renderer.fx3dOn`): Bodenteile (Zielring,
  Feuerschein, Druckring) gemalt wie bisher (`isoFxGround`, aus `isoEffects` herausgelöst), dann Explosion (Rauch, Blitz, Feuerball, Kern, Brocken,
  Funken), Leuchtspur, Flak, Kanonen- und Raketengeschoss mit Rauchspur, Mündungsfeuer, Abfangen, Mörsergranate im Bogen, Rauchsäulen, Feuer mit
  Flammenzungen und Glut, Staub am Bagger und Nebelwand als Teilchen in three, danach Minen und Wegziel gemalt. Krater lagen schon als Bodenbild im
  Durchlauf „Boden“; Trümmer und Ruinen gehören zu „Baustellen und Ruinen 3D“. **Gemessen vor dem Plan** (Seeds 3, 7 und 5 mit Eroberung, KI gegen KI
  je 25 Spielminuten): im Mittel 0,1 bis 0,2 Effekte gleichzeitig auf der Karte, im Bildausschnitt höchstens 5 bis 7 (3 Explosionen, 1 bis 3 Geschosse,
  1 Leuchtspur), dazu bis 31 rauchende Wracks; Leistung also unkritisch, die 50 Explosionen des Plans sind der Stresstest. **Entscheidungen:**
  (1) *Ein Teilchen-Typ, ein Draw-Call:* jedes Teilchen ist ein Strich von A nach B (Weltpunkte plus Versatz in der Bildebene), ohne Länge ein Fleck;
  Formen im Fragment-Shader nachgebaut wie die gemalten Flecken (`dot`: weich, beleuchtete Schwade, Wolke), dazu Flammenzunge, Brocken, Strich mit
  Verlauf der Breite (Funken, Leuchtspur, Spitzen des Mündungsfeuers), Scheibe. Alle Maße aus den Iso-Malern (`fx.js` exportiert dafür `partsOf`,
  `SIZE`, `fireCol`, `smokeIn`, `ARC` …): „× Zoom in Bildschirm-px“ ist in three dasselbe Maß in Welt-px; das Bild gleicht dem gemalten.
  (2) *Verdeckung:* eigene Szene nach „Objekte“, nur die Farbe wird gelöscht, der Tiefenpuffer von „Objekte“ bleibt: 3D-Häuser, Einheiten und Bäume
  davor verdecken Feuerbälle (bisher immer obenauf), Billboards (noch gemalte Gebäude) nicht. Jedes Effektbild ist eine Gruppe mit der Tiefe seines
  Fußpunkts, zum Betrachter gerückt (Explosion 24 × Größe, Rauchsäule 8 × Größe, damit der Feuerball vor der getroffenen Einheit und der Rauch über
  dem eigenen Dach bleibt); Gruppen von hinten nach vorn sortiert, innerhalb der Gruppe Malreihenfolge wie gemalt. Gelände verdeckt nicht (wie bei den
  Billboards: der untere Rand eines Feuerballs am Hang würde sonst abgeschnitten). (3) *Licht:* die Schwaden sind zur Sonne hin hell (`lightVec` in
  der Bildebene, rechts oben) statt fest links oben wie gemalt. Der Blitz bleibt Leuchtfleck plus gemalter Feuerschein am Boden: ein echtes Punktlicht
  bräuchte Lichtquellen in allen eigenen Shadern (Baukasten, Natur, Props, Einheiten, Boden), das gehört zu „Tag und Nacht 3D“. (4) *Kopie:* nur das
  Rechteck der Teilchen wird in die 2D-Leinwand kopiert. (5) *Wachsen:* Platz für 4 096 Teilchen, darüber neue Geometrie (three merkt sich die
  Instanzzahl beim ersten Zeichnen, `_maxInstanceCount`; neue Attribute allein zeichneten nur die alte Zahl). Messung (Software-WebGL, Seed 3,
  Zoom 0,8, 8 Bilder): Durchlauf „Effekte“ ohne Effekte 0,1 ms; 1 Explosion Iso 0,2, 3D 12 ms; 50 Explosionen (1 420 Teilchen, ein Draw-Call)
  Iso 2,2, 3D 34 ms. Davon sind etwa 11 ms das Auslesen der WebGL-Leinwand (fest, unabhängig von der Fläche; dieselbe Kopie haben „Gelände“ mit
  188 ms und „Objekte“ mit 103 ms im selben Bild), der Rest Füllrate der großen Flecken in Software; auf echter GPU zu messen. Offen: Punktlicht
  (siehe oben); Leuchtspuren dünner als ein Gerätepixel werden blasser statt flimmernd gezeichnet; Rauch treibt wie gemalt nach rechts im Bild
  (kein Weltwind). Nebenbefund für „Kartenstadt 3D“: Hallen der Kartenstadt (`kind: 'hall'`) fängt die Familie des Regierungsgebäudes in
  `town3d.js` (`has: (b) => b.kind === 'hall'`); in 3D stehen sie als Kuppelbau statt als Lagerhalle (Seed 3, Halle bei 2280, 8876).
- Büsche und Felsen 3D: gebaut (`js/render3d/nature3d.js`, Test `test/nature3d.test.js`, Prüfteil `smoke-3d.mjs --only natur`, Fotos
  `.smoke/3d/natur/`). Büsche (Strauch, Beerenstrauch, Farn, junge Fichte) aus dem Baukasten und mit dem Shader der Bäume (`Geo`,
  `TREE_VS`/`TREE_FS` aus `trees3d.js`; Palette, Blattmuster, Schnee), je Art 2 Formen als `InstancedMesh`; Herbstlaub, im Winter
  Sträucher kahl (Ruten, Schneehügel, Hagebutten), Farn braun mit Schnee, junge Fichte mit Schneebändern. Felsen (4 Varianten je
  Jahreszeit) und Tiere über `modelGeometry`, ein `InstancedMesh` je Variante bzw. Haltung; Tiere mit Blickrichtung und Laufbild
  (Gehbild, Galopp, Äsen: eine Geometrie je Haltung, höchstens 40, im Bild ≤ 8 Tiere). Alles wirft Schatten über die Schattenkarte, die
  gemalten Schatten fallen dann weg (`natureShadow3d`); ohne Karte malt `isoShadows` den Fußschatten der Tiere (`animalShadow2d`).
  Unterholz wirft in 3D auch Schatten (ein Satz je Form statt zwei). Schalter `nature3dOn`. Dreiecke je Form: Strauch 180/200 (Winter
  594), Beeren 460 (Winter 774/794), Farn 360, junge Fichte 200, Felsen 239 bis 371, Hirsch 432, Wildschwein 330. Gemessen vorher (Seeds 3,
  7): Wald bei Zoom 1 bis 300 Büsche (davon ~140 Unterholz), bis 140 Felsen; Tiere höchstens 8 im Bild. Messung „Objekte“ samt
  Schattenkarte (Seed 7, Zoom 1, Software-WebGL), gemalt → 3D: Wald (308 Büsche, 26 Felsen) Aus 96 → 118 ms, 9 → 21 Draw-Calls; Hoch
  199 → 244 ms, 18 → 42 Draw-Calls; offen (191 Büsche, 50 Felsen) Aus 44 → 55 ms, Hoch 139 → 164 ms. Natur-Draw-Calls im Bild 11 bis 16
  (je Buschart 2, Felsen ≤ 4, Tiere je Haltung). Offen: Gesteinsfoto (`mat: 'rock'`) fehlt den 3D-Felsen (Flächenfarben bleiben),
  Herbstlaub am Boden unter den Sträuchern fehlt in 3D (wie bei den Bäumen).
- Props 3D: gebaut (`js/render3d/props3d.js`, Test `test/props3d.test.js`, Prüfteil `smoke-3d.mjs --only props`, Fotos `.smoke/3d/props/`). Alle
  Props der Karte (`mapprops.js`: Zäune, Mauern, Militär, Industrie, Raffinerie, Zivil, Kriegsspuren), geparkte Autos, Parkbänke, Heuballen
  und Versorgungskisten (`props.js`) aus denselben Körperlisten wie die gemalten Bilder über den Körper-Wandler: kein neues Bauteil in `kit3d.js`
  nötig (nichts nachzutragen). Hooks `prop3d(t, o)` (t 6, 7, 14, 16) und `crate3d` (t 8 und die Kiste auf dem Rücken eines Trägers) in
  `isoObjects`, Höhe wie das Billboard (`cam.pinned`), Schalter `renderer.props3dOn`; Busch und Fels unter den Props der Karte laufen über
  `nature3d` (`DELEGATE_AS` in `civprops.js`). **Gemessen vor dem Plan** (Seed 3, 7, KI gegen KI, 0 und 10 Spielminuten): nur 76 Props der Karte
  (Zufallskarte, rund ein Dutzend Gruppen), bis 85 nach 10 Minuten (die KI baut Feldstellungen: Sandsäcke, Hesco …); dazu 264/272 Autos, 140/84
  Bänke, 106/87 Ballen, 6 Kisten; im Bild (Fenster 1 400²) höchstens 13 Props der Karte (Land) bzw. 109 Autos und Bänke (Stadt), 4 Ballen, 1 Kiste;
  Die feste Karte hat noch keine Props. Dreiecke je Form (gerade Kachel bzw. Einzelstück, Sommer = Winter): Holzzaun 276, Metallzaun 360, Maschendraht 816,
  Betonmauer 156, Steinmauer 324, Sandsack 240, Hesco 696, Container 600, Tank 1 268 bis 2 036, Destillationskolonne 3 876 (größte, Testgrenze 5 000),
  Auto 556 bis 616, Bank 204, Ballen 356, Kiste 288. **Entscheidungen:** (1) *Zäune und Mauern je Kachel, nicht als verschmolzene Linie:* die Kachel ist
  schon durchgehende Geometrie (`fenceModel`: Arme bis zur Zellkante, Verbindung nach den vier Nachbarn, Ecke, T, Kreuz, Ende, Tor, Trümmer wie
  gemalt); Instancing je Form hält die Draw-Calls bei der Zahl der verschiedenen Formen (je Linie wenige), und eine Zerstörung (`propVersion`) ändert
  nur eine Instanz statt die ganze Linie neu zu bauen; Kacheln stehen je auf ihrer Geländehöhe (wie gemalt, an Hängen kann ein Absatz entstehen).
  (2) *Eine Geometrie je Inhalt:* Formen mit gleicher Prüfsumme der Ecken teilen Geometrie und Draw-Call (Detail- und Farbvarianten, die ein Modell
  nicht ändert). (3) *Fahnen:* das Tuch trägt `FLAG_MARK`, die Ecken `aTeam = 1`, der Shader nimmt die Farbe der Instanz (`propFlagColor`: Besitzer der
  nächsten Flagge, sonst Editorfarbe, sonst weiß); eine Geometrie für alle Teams, wie bei den Werken. (4) *Durchscheinende Körper* (Maschendraht, Glas,
  Tarnnetz) je Deckkraft eine eigene Form ohne Schatten. (5) *Schatten:* alles Undurchsichtige wirft über die Schattenkarte, die gemalten Schatten der Props
  fallen dann weg (`propShadow3d`); ohne Karte bleiben sie gemalt, die 3D-Kiste bekommt dann einen Fußschatten (`crateShadow2d`). Der Schimmer der
  Kisten am Boden bleibt gemalt (`drawCrateGlow`). (6) `vary` (Schotter, Stein) als Flächenfarbe je Fläche wie gemalt; Materialfotos (`mat`) fehlen,
  Flächenfarben bleiben (wie bei den Felsen). (7) Auto, Bank, Ballen: ganze Modelle (Auto „top“ mit beiden Seiten, Ballen mit beiden Stirnseiten),
  Maßstab wie gemalt (Auto 1,5), Drehung stufenlos. Messung „Objekte“ samt Schattenkarte (Software-WebGL, Zoom 1, 8 Bilder, ruhiger Lauf), gemalt → 3D:
  Land (Seed 3, 18 Props in 13 Formen, 9 156 Dreiecke) Aus 80 → 88 ms, 24 → 36 Draw-Calls, Hoch 235 → 239 ms, 46 → 74; Stadt (Seed 3, 109 Autos und Bänke in
  24 Formen, 45 416 Dreiecke) Aus 85 → 100 ms, 9 → 33 Draw-Calls, 96 390 → 141 624 Dreiecke, Hoch 212 → 225 ms, 18 → 66, 372 062 → 462 676; nach 10 Minuten (28 Formen)
  Aus 87 → 97 ms, 17 → 45, Hoch 218 → 287 ms, 27 → 83 (Rauschen etwa 10 bis 20 %, Lauf mit anderer Last bis 30 % mehr). Schauraum mit jeder Art in
  Reihen zu sechs (Worst Case, jede Form verschieden: 192 Props in 120 Formen, 55 144 Dreiecke): Aus 35 → 51 ms, 65 → 185 Draw-Calls, Hoch 131 → 173 ms, 100 → 325.
  Die Draw-Calls je Bild wachsen mit der Zahl verschiedener Formen, nicht der Props; auf echter GPU zählen sie. Offen: Autos je Lackfarbe eine Form
  (Farbe je Instanz über `aTeam` ginge, die Modelle mischen aber Abtönungen aus der Lackfarbe, `carModel`: Stadtausschnitt 24 Formen auf etwa 10 senken);
  Furtstangen (`bridge.js`, Paket „Brücken 3D“), Wracks und Ruinen bleiben Billboards; Materialfotos; bewegte Teile (Schranke offen/zu ist ein Tor-Zustand,
  keine Bewegung); durchscheinende Teile werfen keinen Schatten (gemalt ein schwacher).
- Militärgebäude 3D: gebaut (`js/render3d/mil3d.js`: FOB, Mörserstellung, Flugabwehr, Phalanx, Gefechtsturm mit vier Dachaufbauten, Bohrer, Mauer in
  16 Nachbarmasken, Einzeltor und vier Torhälften, dazu die Baustellen aller Arten in neun Stufen aus `render/milbuild.js` und die Ausbauten besetzter
  Häuser aus `render/stronghold.js`; Test `test/mil3d.test.js`; Prüfteile `smoke-3d.mjs --only baukasten --what mil` (Bogen je Art und Stimmung
  mit gemalt + 4 Drehungen, Baustellen in 5 Stufen, beschädigt, Teamfarben: `mil-*.png`) und `--only stadt` (Ausschnitt mit den meisten
  Militärgebäuden `seed3-militaer-*`, ein ausgebautes Haus `seed3-ausbau-*`, Messung)). Kein neues Bauteil in `kit3d.js` nötig (Mast, Schale, Fass,
  Zelt, Zaun, Rohr, Stab … gab es schon; nichts nachzutragen). `milbuild.js` und `stronghold.js` geben nur ihre Maße und Farben (`MIL_DIM`, `FORT_DIM`) und
  die Variante ohne Bilddrehung (`milVariant`) heraus, das Gemalte ändert sich nicht. Hooks: `mil3d(b, color)` im Zweig „Gebäude“ von `isoObjects` (neben
  `hall3d`) und `fort3d(h)` in `drawTownItemIso`, beide nur im Durchlauf „Objekte“; Familie `mil` in `FAMILIES` (zwei Zeilen), Schalter `renderer.mil3dOn`
  (false = alles gemalt, auch die Ausbauten). **Gemessen vor dem Plan** (Seed 3 und 7, KI gegen KI, beide Teams, je Gebäude einmal; ohne die
  Hauptstädte, die über `hall3d` laufen): nach 10 Spielminuten Seed 3 FOB 8, Flugabwehr 10, Mörser 12, Mauer 10, Tor 4; Seed 7 FOB 7, Flak 9, Mörser 10
  (+ 1 Baustelle, Stufe 3), Mauer 10, Tor 4; nach 20 min beide Seeds FOB 8, Flak 10, Mörser 11 bis 12, Mauer 37, Tor 14 und 2 Gefechtstürme (Dach Mörser
  und SAM); Phalanx und Bohrer baut die KI nie, beschädigt war nichts (unter halber Gesundheit). Gebaut ist also fast alles (Baustellen kurz, meist
  1 bis 2 gleichzeitig), die Mauern stehen in wenigen Masken, im Bild (Zoom 1, Ausschnitt mit den meisten) 9 Gebäude in 7 Varianten. Dreiecke je Variante: FOB 1 398,
  Mörser 284, Flugabwehr 416, Phalanx 364, Bohrer 790, Turm 206 (ohne Aufbau) / 332 (Mörser) / 280 (Flak) / 330 (SAM), Mauer 48 bis 172 (je nach Maske), Tor 186,
  Torhälfte 376; Baustellen FOB 1 516 bis 1 588, 2 × 2 786 bis 1 074 (Turm wächst, Gerüst), 1 × 1 300; Ausbauten (Haus 64 × 64): Sandsäcke 800, MG-Nest 150, Draht
  1 594, alles 2 544 (Haus 96 × 72: 3 116). Testgrenze 3 000 je Variante, 6 000 für die Ausbauten. Umriss: Node-Test Iso-Umriss der Geometrie innerhalb des
  gemalten Bildmaßes (`drawMilIso`: ± 1,42 · halbe Breite + 6, Höhe höchstens `TALL` + 12, Platz ± 30 bzw. ± 46 wie gemalt), Prüfteil Drehung 0 ± 1 bis ± 11 px (Torhälften:
  gemalt zeigt die helle Stahlseite, 3D die dunkle Fläche; Mauern ± 7: gemalt zeichnet die Sockelkante und den Schatten mit).
  **Entscheidungen:** (1) *Eine Geometrie je Art und Variante für alle Teams, ein Draw-Call je Variante* (wie Werke): Platzrand, Bänder, Dächer, Schilde,
  Kappen, Fahnen tragen `aInfo.y = 97` und nehmen die Farbe der Instanz. (2) *Mauern und Tore nach Weltrichtung:* gemalt hängt die Variante von der Bilddrehung
  ab (Nachbarn im Bildrahmen), in 3D dreht die Ansicht selbst, also gilt die Maske in Weltrichtung (1 = +x, 2 = +y, 4 = −x, 8 = −y); 16 Mauer- und 6 Torvarianten, beim
  ersten Gebrauch gebaut (1 bis 4 ms). Wächst eine Mauer an, wechselt nur die Variante der Nachbarn. (3) *Baustellen:* neun Stufen je Art (`s0` … `s8`, die
  gemalte Zahl), Rohbau, Gerüst, Planken, Bewehrung, Zaun, Baustoffe und Kran der FOB sind Körper, Bauzaun-Planen in Teamfarbe an allen vier Seiten (gemalt nur
  vorn); das gemalte Bild schneidet Zaun und Kran oben ab (Bildmaß `SITE_TALL`), 3D zeigt sie ganz. Je Art und Stufe ein Draw-Call, höchstens ein Dutzend sichtbar.
  (4) *Schaden:* gemalt Ruß, 3D eine dunklere Variante derselben Geometrie (Farben × 0,7, Teamfarbe bleibt), nur bei unter halber Gesundheit (`milDamaged`) und damit
  ein Draw-Call mehr je betroffener Art. (5) *Fahnen:* die Fahnen der Militärgebäude (Mast mit Tuch an FOB, Mörser, Flak, Turm, Bohrer) sind starre, beidseitige Flächen in
  Teamfarbe (`flagpole`, wie Werke und Großbauten, kein Wehen); die Fahne an besetzten Häusern **bleibt gemalt** (`drawHouseFlagIso`): sie flattert in jedem Bild neu
  (Tuch aus fünf Streifen mit Welle) und wäre als Mesh entweder starr oder müsste jedes Bild neu aufgebaut werden. (6) *Ausbauten besetzter Häuser:* Sandsäcke, MG-Nest,
  Stacheldraht als Mesh je Hausmaß und Ausbaumaske (`fortGeometry`, Maße `q8` wie gemalt, Mitte des Hauses); gemalt liegen Säcke und Nest nur vor den Wänden zur Kamera,
  3D dreht die Ansicht, deshalb stehen die Säcke an allen vier Wänden (Durchgang in der Mitte jeder Wand), das MG-Nest bleibt an der Ecke +x +y, der Draht rundum
  (Durchgang vorn). **Altbauten mit Hof** (`houseYardIso`, `maptown.js`, Paket „Kartenstadt 3D“) bleiben mit ihren Ausbauten gemalt, ihre Hofmauer liegt im Bildrahmen;
  3D folgt mit dem Hof. (7) *Gemalt bleiben:* Rauch gibt es bei Militärgebäuden nicht, gemalte Schatten und Ruß entfallen (Schattenkarte, dunklere Variante), Schilde,
  Balken und Baumarken (`drawSiteMarks`) sind Marken, kein Körper. Zwischen dem Boden der Anlage (Platz, Fahrspur, Grube) und dem Gelände gilt wie bei den Werken:
  Flächen 0,012 über dem Boden auf der tiefsten Ecke, an einem Hang kann Gelände durch den Platz ragen. Fenster nachts wie die Stadthäuser.
  **Messung** (Seed 3, 10 Spielminuten, Ausschnitt mit den meisten Militärgebäuden der eigenen Seite: Mörser, Flak, 5 Mauern, 2 Tore = 9 Gebäude in 7 Varianten, 1 280 × 800,
  Zoom 1, „Objekte“ samt Schattenkarte, Software-WebGL, 8 Bilder; Häuser, Werke und Großbauten in beiden Zeilen 3D): Schatten Aus gemalt 49 Draw-Calls, 199 293 Dreiecke,
  137 ms → Militär 3D 56 Draw-Calls, 200 999 Dreiecke (Militär 1 724), 143 ms; Schatten Hoch gemalt 96, 634 646, 370 ms → Militär 3D 110, 638 076, 356 ms; zweiter Lauf (andere Last, die
  Partie wächst je Lauf etwas anders): Aus 48 → 55 Draw-Calls, 233 351 → 235 057 Dreiecke, 140 → 166 ms, Hoch 94 → 108, 702 814 → 706 244, 426 → 474 ms. Die +7 (Aus) bzw. +14
  (Hoch) Draw-Calls sind auf echter GPU die Größe, die zählt; der Zeitunterschied liegt im Rauschen (bis 15 bis 20 % je Lauf). Offen: wehende Fahnen; Altbau-Hof samt Ausbauten (mit „Kartenstadt 3D“);
  Förderbänder und Torbewegung (Tor offen/zu ist ein Zustand, keine Bewegung); fern grobe Varianten (Draht, Gerüst, Fugen), falls echte Geräte es brauchen.
- Fliegerhorst 3D: gebaut (`js/render3d/airbase3d.js`: Stellplatz Stufe 1 (offen mit Bodenstromgerät, Feuerlöscher, Flutlicht, Leitkegeln), Stufe 2 (Überdachung) und Stufe 3
  (Flugzeugschutzbau), Tower (Radar ab Stufe 2, Wetterradar-Kuppel in Stufe 3), Kerosintank (2 bis 4 Tanks) und Munitionslager (1 bis 3 Bunker, Wachturm in Stufe 3) je Stufe 1 bis 3
  aus `airbaseBodies` (`render/airbase.js`); Test `test/airbase3d.test.js`; Prüfteile `smoke-3d.mjs --only baukasten --what fliegerhorst` (Bogen je Art und Stimmung mit gemalt + 4 Drehungen,
  Teamfarben, Jet-Attrappen im Stellplatz: `fliegerhorst-*.png`) und `--only stadt --citymin 20` (Ausschnitt `seed3-fliegerhorst-*`, Messung)). `airbase.js` gibt nur seine Maße und Farben
  heraus (`AB_DIM`: Ausdehnung `EXT`, Überdachung `CAN`, Shelter `HS`, Tarnflecken, Deckkraft), das Gemalte ändert sich nicht. Neu: `uOpacity` und `makeKitMaterial({ opacity })` in `kit3d.js`
  (Material halb durchsichtig, ohne Tiefe), Option `win` bei `Kit3D.frustum` (Glaskanzel nachts hell), Familienfelder `glass(b)` und `alpha` in `town3d.js` (`Town3D.add` stellt dann einen
  zweiten Satz `…|glass` auf, `castShadow` aus, `renderOrder` 5), Familie `airbase` in `FAMILIES`, Schalter `renderer.airbase3dOn` (false = Fliegerhorst gemalt); aus `works3d.js` mitgenutzt: `tank3d`,
  `bund3d`, `pallet3d`, `forklift3d`, `lorry3d`, `walls3d`, `strip3d`. **Gemessen vor dem Plan** (KI gegen KI, Seed 3 und 7, nur Team 0): nach 20 Spielminuten je Team Stellplatz Stufe 3 (Shelter) 5 bis 6,
  Tower Stufe 3 2, Kerosintank Stufe 3 2, Munitionslager Stufe 3 2; nach 10 min auch Stufe 1 und 2 (beide Teams zusammen: Seed 3 nach 10 min 6 Bausteine Stufe 1, nach 20 min 12 Stufe 3). Im Bild (Seed 3, 20 min, Zoom 1, Ausschnitt mit
  den meisten Bausteinen) 6 Bausteine in 4 Arten (3 Shelter, Tower, Tank, Munitionslager, alle Stufe 3), eigene Seite insgesamt 11. Dreiecke je Variante (Stufe 1/2/3): Stellplatz 374/820 (davon Glas 4)/974
  (Glas 252), Tower 1 030/1 708/2 080, Kerosintank 794/994/1 272, Munitionslager 1 369/1 628/1 915; Testgrenze 6 000. Umriss: Node-Test die Geometrie innerhalb der Vereinigung der gemalten
  Bildgrenzen aller Teile (`isoBounds` mit `EXT`, ±3 px) und innerhalb der Ausdehnung, Höhe ≥ 70 % der Teilhöhe; Prüfteil Drehung 0 ±1 bis ±9 px (Shelter ±9, Tank ±7 bis ±9: gemalt zeichnet
  Schatten, Konturen und Anschüttung mit). **Messung** (Seed 3, 20 Spielminuten, 6 Bausteine, 5 Varianten, „Objekte“ samt Schattenkarte, Software-WebGL, 8 Bilder; Häuser, Werke, Großbauten, Militär 3D):
  Schatten Aus gemalt 69 Draw-Calls, 223 061 Dreiecke, 74 ms → Fliegerhorst 3D 74, 231 218 (Fliegerhorst 8 189), 78 ms; Hoch gemalt 136, 681 726, 237 ms → 145, 697 316, 251 ms. Die +5 (Aus) bzw. +9 (Hoch)
  Draw-Calls (je Art und Stufe einer, die Shelter ein zweiter für das Glas) sind auf echter GPU die Größe, die zählt; der Zeitunterschied liegt im Rauschen. **Entscheidungen:** (1) *Eine Instanz je Anlage*
  wie bei den Großbauten (`at: b.plan`, alle Körper eines Plans teilen sich eine Geometrie je Art und Stufe, Teamfarbe der Instanz: Bänder von Tower, Radom und Tankwagen, Tankbänder, Torflügel des Shelters,
  Torschilder der Bunker, Fahne). (2) *Halb durchsichtig:* das Wellblech-Satteldach der Überdachung (Deckkraft 0,56) und die Röhre des Shelters samt Tarnflecken (0,64) liegen in `airbaseGlass`, alles andere
  (Stützen, Binder, Rinnen, Ortgang, Erdanschüttung, Stirn- und Rückwand, Torflügel, Lüfter) deckend wie gemalt; der abgestellte Jet (3D-Einheit) bleibt durch Dach und Röhre zu sehen (Fotos mit Attrappen
  `fliegerhorst-stand-jets`), Tiefe schreibt das Glas nicht, Einheiten und Billboards (renderOrder 10) dahinter malen darüber, davor stimmt. Durchscheinende Teile werfen keinen Schatten: der Shelter wirft
  nur Anschüttung, Wände und Tor, gemalt ein schwacher auch die Röhre. Tarnflecken sind Dreiecksfächer mit den Normalen der Röhre knapp darüber (je Flanke gespiegelt), mit der Röhre doppelt überblendet.
  (3) *Weltachsen:* gemalt liegen nur Überdachung und Shelter in der Welt fest, die übrigen Teile malt `airbase.js` je Bild in Ansichtsachsen; 3D stellt alles fest in die Welt und dreht mit der Kamera
  (Tor des Shelters nach Norden, Tankwagen, Autos, Gabelstapler, Parkplatz, Windsack nach Osten). Rückseiten ergänzt (Stirnwand und Rückwand beidseitig, Laibung der Toröffnung, Fenster, Tür und Streifen des Towers
  an allen Wänden, Räder und Gitter des Bodenstromgeräts beidseitig, Hügelrückseite der Bunker). (4) *Starr:* die drehende Radarantenne (Winkel 0,9) und das blinkende Warnlicht des Towers (rote Kugel).
  (5) *Nachts:* Lampen (Flutlicht, Laternen, Torlampen) und die Glaskanzel des Towers leuchten (`GLOW_NIGHT`). (6) *Weggelassen:* Fugen der Röhrenringe, Schmutzstreifen, Grasbüschel, Wellenlinien des Dachs,
  Lamellen der Abgasöffnung nur als Streifen. **Der Boden bleibt gemalt** (Beton mit Fugen, Führungslinien, Innenraum, Parkplatz, Schotter, auch die Rollbahn: Durchlauf „Boden“ in `citylayer.js`).
  Jets: in der Stadt-Szene stand 1 Luftfahrzeug in der Nähe (Seed 3, 20 min), keiner auf einem Stellplatz; Jets sind 3D-Einheiten, ihr Rollen auf der Bahn ist kein Teil dieses Pakets.
  Offen: Radarantenne und Warnlicht animieren; Windsack nach dem Wind; Schatten der halb durchsichtigen Röhre; Rollbahn und Boden in 3D („Straßen und Wege 3D“/„Bodenmarken“); Fugen und Schmutz der Röhre;
  fern grobe Varianten (Tanks mit je 300 Dreiecken, Zäune des Munitionslagers), falls echte Geräte es brauchen.
- Baustellen und Ruinen 3D: gebaut (`js/render3d/site3d.js`: Baustellen der Stadt in allen Größen (n = 1 bis 3, auch 4 und 5 mit Lagerplatz) und fünf Bauabschnitten aus `render/citysite.js`
  (Baugrube mit Bagger und Pflöcken → Bodenplatte mit Anschlusseisen und Muldenkipper → Erdgeschoss mit Gerüst → Rohbau mit Decke → Dachstuhl mit Richtkranz; Bauzaun mit Planen in der Zonenfarbe,
  Dixi, Ziegel- und Sandhaufen; Großbauten mit Baukran, Containern, Stützen und Treppenkern); `js/render3d/rubble3d.js`: Schutt aus `rubblePlan` (Schuttboden mit unregelmäßigem Rand, Mauerecke aus Kästen, Stahlträger
  bei ausgebrannt, Hügel als unregelmäßige Kuppe mit Brocken, Platten und Balken als gedrehte Quader) für die drei Quellen: zerstörte Stadtzellen (`cityruin`), eingestürzte Häuser der Kartenstadt und Wracks
  zerstörter Militärgebäude (`g.wrecks`, `kind 'building'`); Test `test/site3d.test.js`; Prüfteile `smoke-3d.mjs --only baukasten --what baustelle` (Bogen je Größe mit allen 5 Abschnitten, gemalt + 4 Drehungen, Sommer, Winter,
  Nacht: `baustelle-*.png`), `--what schutt` (Schutt je Art, ausgebrannt, Mauer, je 4 Varianten, dazu alle 16 des Wracks: `schutt-*.png`) und `--only ruinen [--sitemin 7] [--wreckmin 18] [--what baustelle|schutt]` (Spielszenen Seed 3
  mit Eroberung, Fotos alt | neu `ruinen/seed3-baustellen-*`, `seed3-wracks-*`, `seed3-wrack-einsinken`, Messung)). `citysite.js` gibt nur Maße und Farben heraus (`SITE_DIM`), `isobuild.js` den Plan des Schutts (`rubblePlan`,
  `rubbleVariant`, `rubbleRng`); das Gemalte ändert sich nur darin, **welche Zufallsvariante** der Schutt zeigt. Neu: `Kit3D.rbox` (gedrehter Quader) in `kit3d.js`, Familienfeld `scaleZ(b)` in `town3d.js`, Familien `site` und
  `ruin`, Schalter `renderer.site3dOn` und `ruin3dOn` (false = gemalt), Hook `ruin3d(r, burnt, sink)` in `isoitems.js` für eingestürzte Häuser der Kartenstadt und Gebäude-Wracks (Stadtzellen laufen über `house3d`).
  **Gemessen vor dem Plan** (Seed 3 und 7, Eroberung, KI gegen KI, bis 30 Minuten): Baustellen der Stadt bis 12 bis 13 zugleich in den ersten 15 Minuten, alle Größen n = 1 bis 3 und Abschnitte 0 bis 3 (4 kurz), danach kaum;
  Trümmer zerstörter Militärgebäude bis 12 zugleich ab etwa 20 Minuten (64 × 64 und 96 × 96, ausgebrannt), Ruinen der Kartenstadt 1 bis 2, zerstörte Stadtzellen 0. Im Prüfteil (Browserpartie mit zwei Seiten, wächst je Lauf anders): nach 7 Minuten
  7 Baustellen auf der Karte (4 im Ausschnitt, 5 Varianten); Wracks 0 bis 1 zwischen Minute 18 und 33, 7 in Minute 37 (4 im Ausschnitt: 3 × 64, 1 × 96). Dreiecke je Variante: Baustelle n = 1 876/988/946/1 126/1 462 (Abschnitt 0 bis 4),
  n = 2 1 384/2 184/2 300/2 532/3 084, n = 3 1 872/2 928/3 106/3 554/4 266 (n = 4: 514 bis 3 590); Testgrenze 6 000. Schutt: Haus, Halle, Bahnhof 64 × 64 362, Fabrik 96 × 96 772, Wrack 64 372 und 96 782, Mauer 182; Testgrenze 1 500
  (die Zahl hängt nicht von der Variante ab, nur Lage und Farben). Umriss: Node-Test die Geometrie innerhalb des gemalten Bildmaßes (`boundsIso` ± 3, oben 12 mehr für Kran und Zaun, die gemalt abgeschnitten sind), Schutt innerhalb des Maßes
  + 10 (Platten und Balken ragen wie gemalt über den Rand); Prüfteil Drehung 0 Baustellen ± 0 bis ± 1 px, Schutt ± 1 px (Mauer ± 9: gemalt zeichnet Schatten und Kästen größer). **Messung** (Seed 3, Ausschnitt mit den meisten, Zoom 1, „Objekte“ samt Schattenkarte,
  Software-WebGL, 8 Bilder; alles andere 3D): Baustellen (7 min, 4 Baustellen in 5 Varianten) Schatten Aus gemalt 65 Draw-Calls, 144 175 Dreiecke, 57 ms → Baustellen 3D 70, 152 903 (Baustellen 8 738), 59 ms; Hoch gemalt 126, 517 246, 187 ms → 136, 534 712, 190 ms.
  Schutt (37 min, 4 Wracks und 4 weitere Ruinen in 3 Varianten) Aus gemalt 154, 342 678, 97 ms → Schutt 3D 157, 346 584 (Schutt 3 906), 91 ms; Hoch gemalt 277, 850 266, 257 ms → 283, 858 078, 261 ms. Die +5 bis +10 Draw-Calls (je Variante einer) sind auf echter GPU die Größe,
  die zählt; der Zeitunterschied liegt im Rauschen. **Entscheidungen:** (1) *16 Varianten des Schutts:* gemalt hing der Zufall am ganzen Hash von (x, y), also praktisch jeder Haufen anders; jetzt `v = hashXY(x, y) % 16` und alle Zufallszahlen und Wandfarben aus `v`
  (`rubblePlan` mit eigener Zufallsfolge, jeder Hügel mit eigenem Keim): Iso und 3D zeigen dasselbe, und 3D baut je Art, Maß, ausgebrannt und Variante nur eine Geometrie (Zwischenspeicher mit Obergrenze 256). (2) *Wracks sinken ein statt zu verblassen:* in den letzten `wreckFade` Sekunden
  streckt `scaleZ` die Höhe der Instanz auf `scarAlpha` (mindestens 0,05), Durchsichtigkeit gäbe es nur mit einem Material je Wrack; Boden und Brocken sinken mit. (3) *Schlüssel der Baustelle nur aus dem Bild:* Größe, Abschnitt, Variante (0 bis 2), Zonenfarbe, Wandfarbe (nicht die Zellenart);
  Jahreszeit über Shader-Schnee (Deckel von Boden, Rohbau, Haufen, Paletten, Container; Bretter, Eisen, Gerüst bleiben frei wie gemalt), keine Teamfarbe. (4) *Rückseiten:* Rohbau als echte Hülle (außen, innen in dunklerem Ton, Mauerkrone, Boden), Fenster, Tür, Gerüst mit Bohlen und Geländer,
  Planen (Zonenfarbe, gemalt nur links vorn) und Bauzaun mit Planen an allen vier Wänden; Kran (Ausleger nach +x), Bagger (Arm nach +x), Lkw und Container starr in Weltachsen. (5) *Baugrube:* gemalt ein Loch mit Wänden; in 3D ein dunkles Feld knapp über dem Gelände
  mit Erdwall rundum (kein Loch im Gelände, der Boden bleibt gemalt, Durchlauf „Boden“ in `citylayer.js`), Pflöcke mit Schnur. (6) *Schutt:* Schuttboden voll in Farbe ohne Licht (wie die Böden der Werke), Hügel aus Dreiecken mit wechselnden Tönen, kein Schnee und kein Ruß
  (gemalt auch nicht); Rauch und Brand der Wracks bleiben Effekte. (7) `cityBuildings` liefert die Stadt aller Seiten, unabhängig vom Parameter team (Prüfteil zählt deshalb nur Seite 0). **Offen:** Baugrube als echtes Loch (Boden-Shader); Kran, Bagger und Rauch animieren; Schutt am Hang (Boden auf der Mitte,
  große Ruinen können am Hang im Gelände stecken oder schweben); Schnee auf Schutt; fern grobe Varianten (Gerüst und Zaun der Großbaustelle bis 4 300 Dreiecke, aber nie mehr als ein Dutzend im Bild); die Messreihe der KI-Partie im Prüfteil liefert weniger Wracks als die Vormessung (andere Läufe).
- Brücken 3D: gebaut (`js/render3d/bridge3d.js`, Test `test/bridge3d.test.js`, Prüfteil `smoke-3d.mjs --only bruecke [--karte seed3,seed7,fest]`, Fotos `.smoke/3d/bruecke/`).
  Brücken und Furtstangen (`render/bridge.js`) als Körper statt gemalter Billboards (Brücken im Durchlauf „Boden“, Furtstangen Billboards in „Objekte“).
  **Gemessen vor dem Plan** (Seed 3, 4, 7 mit Fluss; feste Karte East Europe Railway): je Zufallskarte 6 Brücken (drei gespiegelte Paare) von 448 oder 576 px
  Länge mit 2 oder 3 Pfeilern (alle 90 px über der Wasserstrecke), Fahrbahn 11 bis 32 px über dem Wasser (`deckH` −9,5 bis 12,1 bei Wasser −20), die Ufer an den Enden
  bis 18 px unter der Fahrbahn; 4 Furten mit 34 (Seed 3) bzw. 38 (Seed 4, 7) Furtstangen; feste Karte: 3 Brücken (eine Eisenbahnbrücke 400 px, zwei Straßenbrücken 350 px), 18 Furtstangen.
  Im Bild (Fenster 1 280 × 800, Zoom 1, an der Brücke nächst der Hauptstadt) höchstens 2 Brücken und 13 (Seed 3) bzw. 15 (Seed 7) Furtstangen, an der festen Karte 1 Brücke und 7 Furtstangen.
  Dreiecke je Form (Sommer, Winter gleich): Straßenbrücke 448 px 1 682, 576 px 2 160, Eisenbahnbrücke 1 640 bis 2 150, zerstört 1 100 bis 2 080, im Wiederaufbau bis 2 350 (Testgrenze 3 500), Furtstange 168.
  **Entscheidungen:** (1) *Eigene Klasse `Bridge3D` statt einer Familie in `town3d.js` oder `props3d.js`:* eine Brücke ist je Karte einmalig (Länge, Pfeilerzahl, Fahrbahnhöhe, Gelände an den
  Widerlagern), ein Netz je Brücke in Brückenkoordinaten (u entlang der Achse, v quer, z über dem Wasser; Instanz = Drehung um `b.angle` und Lage `b.x1, b.y1` auf Wasserhöhe) wird neu gebaut, wenn sich der
  Zustand im Schlüssel ändert (zerstört, Wiederaufbau in 16 Stufen, Schaden in Stufen, Jahreszeit, Gelände); die Furtstangen sind eine Form, je Stange eine Instanz. Damit gibt es keinen `kind`, den `Town3D`/`Props3D` abfangen
  oder dem sie zufallen könnten (Lehre aus „hall“ des Regierungsgebäudes: Test prüft, dass keine Familie `bridge3`, `ford` oder `bridge` annimmt). Licht, Schatten (Ebene `CAST`) und Hülle wie Props (`VS`, `FS` aus `props3d.js`, jetzt exportiert).
  (2) *Hook in „Objekte“ mit eigenem Eintrag `t: 17` der Tiefenliste* (nur wenn `renderer.bridge3dGround` gesetzt ist, also Ansicht 3D mit Relief und `bridge3dOn`): die Brücke braucht den Tiefenpuffer der Objekte, damit Einheiten auf der Fahrbahn
  vor dem Geländer stehen und das Geländer sie verdeckt; im Durchlauf „Boden“ (der in 3D 2D bleibt, bis „Bodenmarken“ umgestellt ist) malt `drawBridgeIso(…, 'foam' | 'foam+shadow')` nur noch die Gischt am Fuß der Stützen (liegt unter dem Pfeiler-Mesh) und ohne
  Schattenkarte den Schatten aufs Wasser; mit Schattenkarte wirft ihn die Brücke selbst über den Schattenfänger. Ohne `?three=1` bleibt Iso pixelgleich (`part = 'all'`, kein Eintrag `t: 17`). (3) *Fahrbahn eben auf `b.deckH`, keine Rampe:* Einheiten auf der Brücke
  nehmen `game.groundHeight` = `b.deckH` (`bridgeUnder`), die Fahrbahn muss genau dort liegen; Widerlager gehen bis ins Gelände (tiefster Punkt quer, 4 px eingegraben), wie gemalt. Der Sprung an den Enden (Ufer bis 18 px unter der Fahrbahn) ist der Spielregel geschuldet, nicht der Grafik.
  Wie überall stehen Einheiten `unitLift` (4 px) über der Fläche; Prüfschritt „Einheiten auf der Fahrbahn“: Mesh der Einheit auf `deckH` (ohne `unitLift`), Unterkante nicht darunter, Brückennetz auf Wasserhöhe + Fahrbahn. (4) *Flächenfarben statt Muster:* Asphalt, Gehwegplatten
  und Schotter als Flächenfarben (`STREET` aus `ways.js`, exportiert; Jahreszeit), Mittellinie, Fugen und Brandflecken als Flächen 0,12 bis 0,2 px über der Fahrbahn, Schwellen und Schienen der Eisenbahnbrücke; Fahrbahnmuster der gemalten Brücke (Textur) fehlt, wie bei den Props die Materialfotos.
  (5) *Furtstangen ohne Kräuselringe und Spiegelung:* die gemalten Ringe am Fuß und die Spiegelung der Bänder fallen weg (das Wasser-Netz hat Schaum an der Furt, aber keine Spiegelung von Körpern, wie bei den Brücken). (6) Zähler: `renderer.bridges3d.stats()` (Brücken, Furtstangen, Netze, Dreiecke);
  mehr als 512 Furtstangen im Bild malt der Renderer wie bisher (Rückgabe `false` von `ford3d`).
  **Messung** „Objekte“ samt Schattenkarte (Software-WebGL, Zoom 1, 8 Bilder, Seed 3, Ausschnitt mit 2 Brücken und 13 Furtstangen), gemalt → 3D: Aus 61 → 66 ms, 53 → 56 Draw-Calls, 126 401 → 132 427 Dreiecke (Brücken 6 026); Hoch 144 → 155 ms, 107 → 115 Draw-Calls (je Netz einer
  im Bild und einer in der Schattenkarte, dazu die Furtstangen), 454 502 → 466 554 Dreiecke. Prüfschritt „gleiche Menge“ (Iso, alle gemalten Bilder fertig, malt so viele Brücken und Furtstangen, wie 3D Einträge und Instanzen hat): Seed 3 2 und 13, Seed 7 2 und 15, feste Karte 1 und 7 (Eisenbahnbrücke: 1 und 0), je Sommer und Winter gleich. Prüfteil `vergleich` unverändert
  (höchstens 1,43 %). Offen: Fahrbahnmuster als Textur, Kräuselringe der Furtstangen, Rampe/Übergang der Einheiten an den Brückenenden (Spielregel), Brückenköpfe der zerstörten Brücke ohne gezackte Bruchkante, wie `brokenEdge` von oben, auf echter GPU messen.
- Freie Kamera: gebaut (`js/render/camera.js`, `js/render3d/camera3d.js`, Eingabe `js/ui/input.js`, Antippen `js/ui/controller.js`; Test `test/freecam.test.js`;
  Prüfteil `smoke-3d.mjs --only freikamera [--neigung 30,45,60]`, Fotos `.smoke/3d/freikamera/neigung<30|45|60>-dreh<000 … 315>.png`, `tasten.png`). Nur in der
  Ansicht 3D (`camera.three`): Drehung stufenlos = `rot · 90° + turn` (`turn` in ±45°, `rot` folgt der nächsten Vierteldrehung), Neigung `tilt` 30° bis 60°;
  isometrisch und 2D rechnen bitgleich wie vorher (Test). **Bedienung:** `,` / `.` gedrückt halten dreht mit 90°/s (**nicht Q/E** wie hier geplant: Q und E sind
  Tasten der Ausbildung bei gewählter Hauptstadt), zwei Finger drehen mit (Winkel zwischen den Fingern, Drehpunkt zwischen ihnen), Umschalt + Mausrad neigt
  (Raste ≈ 5°; Strg + Rad ist auf Trackpads das Zoomen des Browsers), Knöpfe ⟲ ⟳ drehen weiter um 90° und behalten `turn`. Speicherstand: `view.turn`, `view.tilt`
  (ältere Stände ohne: 0 und 30°); ohne three bleiben sie gespeichert, wirken aber nicht. Neigen mit Fingern: offen.
  **Gemessen vor dem Plan** (grep über `js/`): mit festen Drehungen rechnen (a) die Kamera selbst (`worldToScreenFlat`, `screenToWorldFlat`, `isoMatrix`, `depthDir`,
  `depth` mit `ROT[rot]`, Höhen als `h · zoom`), (b) `camera3d.syncIsoCamera` (`ROT`, `TILT`), (c) `layers/relief.js lightVec` (Sonne dreht mit `ROT[rot]`), (d) die
  Maler, die je Vierteldrehung ein eigenes Bild wählen (`rot` als Schlüssel): `airbase.js` (`ROT_KEY`), `milbuild.js` (`variant`), `maptown.js` (`VROT`, Masten, Altbau-Hof),
  `govquarter.js`, `stronghold.js`, `props.js`, `nature.js` (`rockLook`), `unitpaint.js`, `isoitems.js` und `isoview.js` (Bäume und Hof des Altbaus), `editor.js`
  (Schlüssel); `game/fieldwork.js` und `ai/army/cover.js` meinen mit `rot` die Drehung von Feldbefestigungen, nicht die Kamera. (e) Höhen als `h · zoom` (Neigung 30°)
  außerhalb der Kamera: Antippen und Ziehrahmen im Controller (`pickIso`, `pickB`, `pickHouse`, `pickCrate`, `pickCity`, `selectBox`), Balken, Sterne und Schilder
  (`isoview.js`: `p.y − lift · z`), Rotoren, Nachbrenner und 2D-Symbole der Einheiten (`isoitems.js`: `setIsoAt(…, p.y − lift · z)`), alle gemalten Bilder (Sprite-Cache,
  `isokit.js`, `isoBounds`). **Umgestellt:** (a) über `camera.axes()` (stufenlose Matrix statt `ROT[rot]`; bei turn 0 genau `ROT[rot]`), `squash()` (Boden: sin der
  Neigung, bei 30° genau 0,5), `heightK()` / `heightPx(h)` (Höhen: cos Neigung / cos 30°, bei 30° genau 1), `screenToWorld` mit Gelände in 3D über den Sichtstrahl
  (`rayToGround`: Gerade über dem Boden von der höchsten Geländehöhe abwärts, erste Schnittstelle = vorderste Fläche, dann Halbierung; klassisch weiter die bisherige
  Näherung), `turnBy`, `setTilt`, `keepAt`; (b) `syncIsoCamera` mit `axes()` und `tiltNow()`; (c) `lightVec` mit `axes()` (Sonne, Boden- und Körperlicht drehen
  stufenlos mit); (e) der Controller nimmt `heightPx` (Klick, Dach, Kiste, Ziehrahmen). (d) bleibt: gemalte Bilder wählen die nächste Vierteldrehung `rot`.
  **Prüfung:** Node-Test (Bild ↔ Welt hin und zurück in 8 Drehwinkeln × 30°/45°/60°, `isoMatrix` passt dazu, stetig über die Vierteldrehung, Sichtstrahl trifft am Hügel
  die vorderste Fläche, three-Kamera = `worldToScreen` mit Höhe unter 0,01 px, klassisch bitgleich mit der alten Formel); Prüfteil: Prüfwürfel in allen 24 Ansichten
  und zwei Zoomstufen ERGEBNIS_WUERFEL, Klick, Ziehrahmen und Fahrbefehl mit echter Maus ERGEBNIS_BEDIENUNG, Taste `.` 0,5 s dreht 18°, Umschalt + 3 Rasten neigt auf 45,5°.
  **Was in schräger Neigung (über 30°) und zwischen den Vierteldrehungen noch nicht passt** (Folgepakete, hier nicht umgebaut): (1) *Gemalte Billboards*, gemalt für 30° und
  die nächste Vierteldrehung: Ausstellungsstücke und Bäume in den Höfen der Großbauten (Kaserne: Fahrzeuge stehen bei 60° sichtbar zu aufrecht), Fahne und Altbau-Hof
  besetzter Häuser, Rotoren und Nachbrenner der Flieger (2D-Zwischenleinwand), Rauch der Stadtgebäude und Dampf der Kühltürme; zwischen zwei Vierteln (z. B. 45°) zeigen sie
  die Ansicht des nächsten Viertels. (2) *Balken, Sterne, Schilder* über Einheiten und Gebäuden (`isoview.js`, `p.y − lift · z`) sitzen ab 45° zu hoch (bei 60° um gut
  40 % der Höhe; Paket „Balken und Schilder“, dort `camera.heightPx`). (3) *Durchlauf „Boden“* (Straßen, Wege, Felder, Höfe, Bodenmarken, Kriegsnebel-Rand): liegt über
  `isoMatrix` richtig auf dem Boden, gemalte Höhen darin (Bordsteine, Zäune der Höfe, Schatten) nehmen weiter 30° (Paket „Straßen und Wege 3D“ der anderen Sitzung).
  (4) *Effekte* im Durchlauf „Effekte“ sind 3D, ihre gemalten Bodenteile (`isoFxGround`) liegen richtig. (5) Editor: unverändert (eigene Kamera ohne three; „Editor in 3D“).

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
