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
node --test test/radio.test.js    # nur eine Datei
npm run smoke                     # Browser-Rundgang (Playwright): Start, 2D, Iso, Hilfe, Pause, Baumodus, Ressourcen, Ausbildung, Bildrate; Fotos in .smoke/<gerät>/
npm run smoke -- --device all     # dasselbe als desktop, tablet (iPad quer, Tippen) und phone (Android quer); einzeln: --device phone
npm run smoke -- --long 30        # langer Lauf: 30 Spielminuten bei 10× Tempo, beide Seiten KI, Kamera über Basis/Front/Städte, 2D und Iso; meldet Browserfehler und Einfrieren
node tools/unitpreview.mjs f22    # Einheiten-Modelle als Bild (8 Richtungen, 2D, Spielgröße) neben f16 und tank: .preview/units.png (Rezept docs/rezept-einheiten.md)
npm run release                   # Versionen vergeben (nur beim Zusammenführen auf main, siehe „Zusammenarbeit“)
npm run metrics                   # KI-Kennzahlen: 3 Seeds × 15 min KI gegen KI (~30 s), warnt bei groben Ausreißern; auch in der CI
npm run econ -- --seeds 3,7,11 --min 25   # Wirtschaft je Team alle 5 Spielminuten (tools/econ.mjs, Optionen im Dateikopf); compare a.json b.json
```

## Regeln für Tests

- Regel 9 der `CLAUDE.md`: Schalter sind in `new Game()` ohne Angabe aus; `conquest: true, players: 2…4` schaltet die Eroberung ein
  (ohne sie gibt es genau zwei Teams). Alle Tests laufen mit Stadt (`city: false` nutzt kein Test mehr).
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
- Mit `device: 'tablet'` bzw. `'phone'` öffnet es das Spiel mit Bildschirm, Pixeldichte und Touch des Geräts.
- `press(sel)` tippt dort (sonst Klick).
- `measureFps(g, ms)` misst Bildrate und langsamstes Bild.
- Die Bildraten der Ausgabe schwanken je Rechner (ohne GPU ist Iso deutlich langsamer) und sind kein Fehler.

## URL-Parameter

- `?debug=1` (kein Nebel, Taste M = +1000 Geld, bis 10× Tempo), `?seed=N`, `?speed=N`, `?river=0|1`,
  `?gl=0` (ohne WebGL-Boden), `?debug=1&fog=1`, `?debug=1&weather=winter&wx=snow`.
