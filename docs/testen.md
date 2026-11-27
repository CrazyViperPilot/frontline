# Testen und Fehlersuche

Lesen, wenn ein Test fehlschlägt, ein neuer Test entsteht oder ein Browserfehler nachgestellt werden soll.

## Befehle

Tests mit kurzem Reporter laufen lassen (`node --test --test-reporter=dot …`), die Ausgabe nicht ganz lesen.

```sh
# im Repo-Wurzelordner
python3 -m http.server 8765
# Spiel:  http://localhost:8765/          Editor: http://localhost:8765/editor.html

npm run test:quick                # Config-Prüfung, PRD-Tabellen und Symbol-Index, wenige Sekunden
npm run docs                      # Wertetabellen in docs/prd/ (§6, Forschung) aus js/data/ neu erzeugen
npm run index                     # Symbol-Index docs/index/ (Exporte je Ordner) neu erzeugen; nach Änderungen an Exporten unter js/
npm run test:fast                 # alle Tests ohne die langsamen „[langsam]“ (KI-gegen-KI-Läufe): zum Iterieren
npm test                          # alle Tests (tools/runtests.mjs: node --test, ein Prozess je Kern, Node 22), gut 5 min: vor dem Push und in der CI
node --test test/scramble.test.js # nur eine Datei
npm run smoke                     # Browser-Rundgang (Playwright): Start, 2D, Iso, Hilfe, Pause, Baumodus, Ressourcen, Ausbildung, Bildrate; Fotos in .smoke/<gerät>/
npm run smoke -- --device all     # dasselbe als desktop, tablet (iPad quer, Tippen) und phone (Android quer); einzeln: --device phone
npm run smoke -- --long 30        # langer Lauf: 30 Spielminuten bei 10× Tempo, beide Seiten KI, Kamera über Basis/Front/Städte, 2D und Iso; meldet Browserfehler und Einfrieren
node tools/unitpreview.mjs f22    # Einheiten-Modelle als Bild (8 Richtungen, 2D, Spielgröße) neben f16 und tank: .preview/units.png (Rezept docs/rezept-einheiten.md)

ode tools/propspreview.mjs          # Props der Karte (Zäune, Mauern) in Sommer/Winter, Zoom 3 und 1,6, 2D, neben Panzer und Soldaten: .preview/props.png
npm run release                   # Versionen vergeben (nur beim Zusammenführen auf main, siehe „Zusammenarbeit“)
npm run metrics                   # KI-Kennzahlen: 3 Seeds × 15 min KI gegen KI (~30 s), warnt bei groben Ausreißern; auch in der CI
npm run econ -- --seeds 3,7,11 --min 25   # Wirtschaft je Team alle 5 Spielminuten (tools/econ.mjs, Optionen im Dateikopf); compare a.json b.json
```

## Regeln für Tests

- Regel 9 der `CLAUDE.md`: Schalter sind in `new Game()` ohne Angabe aus; `conquest: true, players: 2…4` schaltet die Eroberung ein
  (ohne sie gibt es genau zwei Teams). Jede Partie hat eine Stadt (die Option `city` gibt es nicht mehr).
- Tests, die länger als etwa 5 s laufen, tragen „[langsam]“ im Namen (`test:fast` lässt sie aus).
- Neue lange Tests ebenso markieren.
- **Gemeinsamer Lauf je Datei:** Brauchen mehrere Tests einer Datei dieselbe Partie (gleicher Seed, gleiche Optionen, gleiche
  Schrittweite und Reihenfolge von KI und `game.update`), sie nur einmal rechnen: `const lauf = once(() => …)` aus `test/util.js` (rechnet beim ersten
  Aufruf, danach dasselbe Ergebnis; Beispiele `test/ai.test.js`, `test/citynet.test.js`). Nur, wenn die Tests den Stand danach
  **nur lesen** (kein `game.issue`, kein weiterer Schritt). Eine kürzere Partie desselben Seeds hängt als Momentaufnahme am längeren
  Lauf (Stand nach m Minuten unterwegs festhalten). Abfragen unterwegs dürfen nur lesen; im Zweifel den Spielstand mit und ohne sie
  vergleichen (`snapshotGame`). Kein `before()` für lange Läufe (er liefe auch in `test:fast`), kein Zwischenspeicher auf der Platte.
- **Parallelität:** `node --test` startet je Datei einen Prozess, mehrere zugleich. Die Gesamtdauer folgt der Summe aller Dateien
  geteilt durch die Prozesse, nicht der längsten Datei; eine Partie zu sparen hilft also immer, eine Datei zu teilen kaum.
  `npm test` und `npm run test:fast` starten über `tools/runtests.mjs` einen Prozess je Kern (Node allein nimmt einen weniger).
- **KI-Kennzahlen:** Bei Paketen, die KI, Stadt-Wirtschaft oder Kampf ändern, `npm run metrics` laufen lassen.
- Warnt es und ist die Änderung gewollt, Referenzwerte neu setzen: `npm run metrics -- --update` (wie die Prüfsummen in `test/golden.test.js`).
- Tests erzeugen ein `new Game({ seed, … })`, geben Befehle über `game.issue` und rufen `game.update(dt)` in einer Schleife.
- Sie ändern Werte direkt (z. B. `BALANCE.slotCap = 1000`) und setzen sie danach zurück.
- Am besten mit `withValue(obj, key, wert, fn)` aus `test/util.js` (stellt auch bei einem Fehlschlag zurück).
- Mit Stadt füllen die Werke das Lager der Hauptstadt: Lagertests nehmen eine vordere FOB (`frontFob` in `test/gamehelp.js`),
  Geldtests rechnen die Stadt heraus (`runCityMoney`), Ausbildung über `trainer` und `noCrew` (`test/util.js`).

## Prüfsummen und Prüftests

- `test/golden.test.js` hält Prüfsummen je Seed (Karte, Startzustand, kurzer Lauf KI gegen KI).
- Reine Umbauten müssen sie unverändert lassen.
- Nur bei gewollter Regeländerung neu setzen (`GOLDEN=print node --test test/golden.test.js`, Anleitung im Testkopf).
- `test/registry.test.js` prüft jede Stadtzellenart auf vollständige Einträge.
- `test/assets.test.js` prüft die Liste in `sw.js`.
- `test/imports.test.js` prüft, dass `js/` keinen Importzyklus hat (Stadt: Blattmodul `js/game/city/cells.js`, Stadt-KI in `js/ai/cityai.js` und `js/ai/city/`).
- `js/game/zonegeo.js` und `js/game/teams.js` haben ebenfalls keine Importe.
- `test/config.test.js` findet Tippfehler in der Config (unbekannte Einheit, doppelte Taste, Taste auf einer festen Taste, Startarmee über dem Limit, NaN,
  tote Datenschlüssel …).
- `test/doctables.test.js` meldet veraltete PRD-Tabellen.
- `test/literals.test.js` (Regel 3) meldet Zahlenliterale in `js/ai` und `js/game` außer 0, 1, 2, 0,5; Technik-Ausnahmen je Datei mit Grund in `ALLOWED`.
- `test/docs.test.js` meldet u. a. eine Themen-Datei ohne Eintrag in der Übersicht von PRD.md und einen zu großen Einstieg (über 20 000 Zeichen).
- Alle laufen auch in `npm test`.

## Browserfehler nachstellen

- `tools/smoke.mjs` exportiert `openGame({ seed, query })` → `run(fn)` wertet im Browser aus.
- Mit `?debug=1` ist die Partie unter `window.__frontline.session()` erreichbar.
- `shot(name)` macht ein Foto.
- Das Skript ist die Vorlage für eigene Prüfskripte.
- Beispiel: `node tools/smoke-scramble.mjs` legt einen Fliegerhorst an, löst einen Alarmstart aus (Alarmrotte) und fotografiert den rollenden und den fliegenden Jet nach `.smoke/scramble/`.
- 3D (Plan `docs/plan-3d.md`): `node tools/smoke-3d.mjs` öffnet `?three=1&cubes=1&iso=1` und prüft, dass die Prüfwürfel aus three genau bei `camera.worldToScreen` liegen (unter 1 px, 4 Drehungen, Zoom 0,35/1/1,6); Fotos nach `.smoke/3d/`.
  Weitere Teile (`--only vergleich|speicher|messung|schatten`): Iso gegen 3D, Atlas-Speicher, Zeit je Durchlauf (Iso, 3D mit Schatten Aus/Mittel/Hoch,
  200 Einheiten), Schatten (Fotos je Stufe und Drehung, Panzer am Hang, Nacht; Schattenkarte beim Verschieben gleich groß und auf dem Texel-Raster).
  `?shadows=off|mid|high` setzt die Schattenstufe der Ansicht 3D. `--only baeume`: 3D-Bäume je Jahreszeit nah und fern (Fotos, höchstens
  2 Draw-Calls je Art bei ≥ 400 Bäumen, Zeit gemalte gegen 3D-Bäume).
  `--only baukasten`: alle Stadthäuser und alle Werke je Art und Stimmung (Sommer/Winter × Tag/Nacht) gemalt neben 3D in 4 Drehungen,
  dazu alle Farbvarianten bzw. Teamfarben der Werke (`.smoke/3d/baukasten/`; Fehler bei abweichendem Umriss, mehr als einem Draw-Call
  je Haus bzw. Werk, fehlenden Fotos); `--what werke|haeuser|grossbau` fotografiert nur eines davon (Werke etwa 30 s). `--what grossbau`: Kaserne, Fabrikhalle, Lagerhalle,
  Güterbahnhof, Universität (je Stufe 1 bis 3), Regierungsgebäude und Regierungsviertel (je Team, Drehung der Anlage) je Stimmung gemalt + 4 Drehungen,
  dazu `grossbau-<art>-teams` mit allen Teamfarben (Fehler: abweichender Umriss, mehr als ein Draw-Call; etwa 1 min).
  `--only stadt`: Seed 3, KI gegen KI bis `--citymin` Spielminuten, Stadt an der Hauptstadt und ein Ausschnitt mit den meisten Werken
  Iso | 3D in 4 Drehungen, Sommer und Winter (`.smoke/3d/stadt/`), Draw-Calls, Dreiecke und Zeit „Objekte“ mit gemalten gegen
  3D-Stadthäuser und 3D-Werke (`renderer.towns3dOn`, `works3dOn`). Dazu ein Ausschnitt mit den meisten Großbauten samt Hauptstadt und Regierungsviertel
  (Fotos `seed3-grossbau-*`), Messung gemalt / ohne Großbauten 3D / alles 3D (`renderer.big3dOn`); der Lauf dauert gut 10 min.
  `--only wasser`: See (Seed 3, `river=0`) und Fluss an der Brücke (Seed 4, `river=1`), Hubschrauber und Panzer am Wasser; Iso | 3D in
  4 Drehungen Tag und Nacht, Zoom 0,5/1,6, Sommer und Winter (`.smoke/3d/wasser/`); Zeit „Gelände“, Draw-Calls ohne und mit 3D-Wasser.
  `--only props`: alle Props gemalt neben 3D: echte Karten (Seed 3 und 7) mit Ausschnitt „Land“ (die meisten Props der Karte) und „Stadt“
  (die meisten Autos, Bänke, Ballen), 0 und 10 Spielminuten, 4 Drehungen, Winter; Schauraum mit jeder Art in Reihen zu sechs (Linie mit
  Ecke, Tor zu und offen, Trümmer, Einzelstücke mit Fahne, Lagen) in 4 Drehungen Sommer und Winter und bei Nacht (`.smoke/3d/props/`).
  Zählung „x/x Props in 3D“ (Fehler, wenn ein Prop-Billboard übrig bleibt), Draw-Calls, Dreiecke und Zeit „Objekte“ gemalt gegen 3D
  (`renderer.props3dOn`, Schatten Aus und Hoch). Node-Test: `test/props3d.test.js`.
- `node tools/smoke-3d.mjs --only mvp` (Paket „MVP-Messung“, nur ausdrücklich, gut 10 min): Rundgang je Gerät desktop, tablet, phone
  (Ansicht umschalten, Drehungen, Zoom, Wald, Hang, Winter; Fotos alt/neu nebeneinander nach `.smoke/3d/mvp/`), Auswahl per Klick/Tippen
  und Befehl in 3D (Fehler, wenn nicht), Bildrate Iso und 3D Aus/Mittel/Hoch nach `--gametime` Spielminuten Zeitraffer; Zahlen auch in
  `.smoke/3d/mvp/messung.json`. Optionen `--devices desktop,phone`, `--fpsms 5000`. Bericht: `docs/mvp-3d-bericht.md`.
- `node tools/smoke-fx3d.mjs` (Paket „Effekte 3D“, eigene Datei, gut 1 min): Schauplatz an der Hauptstadt (Explosionen in mehreren Phasen,
  Leuchtspur, Flak, Geschosse, Mündungsfeuer, Abfangen, Mörsergranate, brennende Hauptstadt und Panzer, Nebelwand), Iso | 3D in 4 Drehungen,
  Zoom 0,5/1,6, Nacht, Winter (`.smoke/3d/effekte/`); Verdeckung durch ein Haus (3D ändert im Fenster deutlich weniger Pixel als Iso);
  50 Explosionen: Zeit „Effekte“ Iso gegen 3D; 150 Explosionen: alle Teilchen gezeichnet (Wachsen). Node-Test: `test/fx3d.test.js`.
- Mit `device: 'tablet'` bzw. `'phone'` öffnet es das Spiel mit Bildschirm, Pixeldichte und Touch des Geräts.
- `press(sel)` tippt dort (sonst Klick).
- `measureFps(g, ms)` misst Bildrate und langsamstes Bild.
- Die Bildraten der Ausgabe schwanken je Rechner (ohne GPU ist Iso deutlich langsamer) und sind kein Fehler.

## URL-Parameter

- `?debug=1` (kein Nebel, Taste M = +1000 Geld, bis 10× Tempo), `?seed=N`, `?speed=N`, `?river=0|1`,
  `?gl=0` (ohne WebGL-Boden), `?debug=1&fog=1`, `?debug=1&weather=winter&wx=snow`.
