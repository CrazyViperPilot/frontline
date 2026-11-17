# Frontline – Einstieg für Erweiterungen

Echtzeit-Strategie im Browser: Blau (Spieler) gegen Rot (KI); im Modus Eroberung bis zu drei KIs (Rot, Grün, Gelb, jeder gegen jeden).
Vanilla JS mit ES-Modulen, Canvas 2D und WebGL-Boden, kein Build-Schritt, offline als PWA.
Diese Datei ist der Kern: Regeln, Befehle, Wegweiser. Alles Weitere gezielt über den Wegweiser unten lesen.

## Regeln

1. Die Simulation (`js/data`, `js/core/rng.js`, `js/game`, `js/ai`) kennt kein DOM und kein `window`; sie läuft in Node-Tests.
2. Spieler und KI ändern das Spiel **nur** über `game.issue(team, cmd)`. Renderer, HUD und Minimap lesen nur.
3. Spielwerte gehören nach `js/data/`, mit deutschem Kommentar; keine Balance-Zahlen als Konstanten in `js/game` oder `js/ai`.
   KI-Werte: Armee `js/data/ai.js`, Stadt `CITY.ai` (`js/data/city.js`), je Schwierigkeit `BALANCE.difficulty`.
4. Zufall nur über `game.rng` bzw. `makeRng(seed)` (`js/core/rng.js`), nie `Math.random()`. Gleicher Seed = gleiche Partie;
   Zufallskarten ohne Fluss bleiben je Seed unverändert.
5. Imports immer mit Endung (`'./zone.js'`), nie über den Repo-Ordner hinaus, keine CDNs oder externen Dateien.
6. Neue Datei, die der Browser lädt: in `sw.js` unter `ASSETS` und eine Zeile in die `CLAUDE.md` ihres Ordners.
   `CACHE_VERSION` nie von Hand erhöhen (macht `npm run release`).
7. Regel- oder Feature-Änderung: Themen-Datei unter `docs/prd/` anpassen, Eintrag als eigene Datei nach `docs/changes/` (eine Zeile,
   ohne Versionsnummer; `docs/changelog.md` nicht bearbeiten). Hilfe (`js/ui/helptext.js`, `js/ui/menu/start-html.js`) mitpflegen.
8. Ideen, die Daniel nur festhalten will: `docs/prd/ideen.md` (PRD §13), nicht bauen.
9. Startmenü-Schalter (Eroberung, Sendemast, Wetter, Forschung, Fluss) sind im Menü an, in `new Game()` ohne Angabe aus;
   Tests verlassen sich darauf. Jede Partie hat eine Stadt.
10. Texte im Spiel, Kommentare und Doku deutsch, Bezeichner englisch. Nach Änderungen in `js/data/`: `npm run docs` und
    `npm run test:quick`. Vor dem Push `npm test` (alle grün).
11. Stadt-Ressourcen (Zellenarten, Waren, Rohwaren, Kette) nur über die Register `js/data/citykinds.js`, `js/data/goods.js`
    und `CITY.chain`; Einzelheiten in `docs/rezepte/neue-ware.md`.

## Befehle

```sh
python3 -m http.server 8765 # Spiel localhost:8765/, Editor /editor.html
npm run test:quick          # Config und PRD-Tabellen, Sekunden
npm run test:fast           # alle ohne „[langsam]“, zum Iterieren
npm test                    # alle Tests, Minuten: vor dem Push
node --test --test-reporter=dot test/radio.test.js # eine Datei
npm run docs                # Wertetabellen in docs/prd/ neu erzeugen
npm run metrics             # KI-Kennzahlen (bei KI-, Stadt-, Kampf-Paketen)
npm run econ                # Wirtschaft messen (tools/econ.mjs)
npm run smoke               # Browser-Rundgang mit Fotos in .smoke/
```

URL-Parameter, Smoke-Varianten, Prüfsummen und Prüftests: `docs/testen.md`.

## Zusammenarbeit (mehrere Agenten)

- **Vor jedem Paket** `git pull origin main` (bzw. auf `main` neu aufsetzen). Pakete nach **Thema** benennen (z. B. „Baugebiet“),
  nicht durchnummerieren (P1, A1 …): zwei Agenten vergeben sonst dieselben Namen.
- **Versionen und Cache** vergibt nur `npm run release` (Regel 6, 7): Jedes Paket legt seinen Eintrag als Datei nach `docs/changes/`.
  Beim Zusammenführen: `git pull origin main`, `npm run release`, `npm test`, committen, nach `main` pushen.
- **Vor dem Plan messen:** Annahmen über das Spiel (wie oft, wie weit, ob die KI etwas tut) vorher an echten Seeds prüfen,
  KI gegen KI: Wirtschaft mit `npm run econ`, sonst ein kurzes Skript (`new Game({ seed, … })`).

## Kontext sparen

- Datendateien (`js/data/*.js`) und große Dateien nie ganz lesen: Schlüssel suchen (`grep -n`), dann nur den Ausschnitt.
- Tests immer mit kurzem Reporter (`--test-reporter=dot`); lange Läufe an einen Hilfsagenten, der nur „grün“ oder die Fehlschläge meldet.
- `docs/archiv/` und `docs/changelog.md` sind per `.ignore` von der Suche ausgenommen; nur lesen, wenn ein Auftrag
  ausdrücklich nach der Geschichte fragt.
- Ein Paket je Sitzung.

## Modelle

| Modell | Einsatz |
|---|---|
| Opus (Hauptsitzung) | Entwurf, Entscheidungen mit Folgen, Änderungen an Tests, Abnahme |
| Sonnet, Aufwand high | Umschreiben und Umbauen nach klarer Vorgabe, wo Urteil über Inhalt nötig ist |
| Haiku, Aufwand high | Messen, Suchen, Zählen, Testläufe: alles mit eindeutigem Ergebnis |

- Die Hauptsitzung plant und entscheidet; Hilfsagenten melden nur Ergebnisse (höchstens 150 Wörter).
- Jeder Hilfsagent bekommt einen vollständigen Auftrag (Ziel, Datei und Zeilen, Zieldatei, Format mit Beispiel, Rückmeldeformat):
  Er sieht die Unterhaltung nicht.
- Parallele Agenten schreiben nie in dieselbe Datei. Ergebnisse von Hilfsagenten sind Zuarbeit: Stichproben selbst gegenlesen.
- Kein Opus-Agent für Aufgaben, die Sonnet schafft; kein Sonnet für reines Zählen.

## Wegweiser

- Spielregeln: `PRD.md` (Einstieg, Übersicht), dann nur die passende Themen-Datei unter `docs/prd/`, nie alle.
- Aufbau des Codes (Schichten, Simulationsschritt, Datenmodelle, Befehle): `ARCHITEKTUR.md`.
- Wo ein Feature liegt: Feature-Landkarte `ARCHITEKTUR.md` §9; neues Feature: dort eine Zeile, höchstens 200 Zeichen
  (Name, PRD-Datei, Hauptmodul, Test).
- Dateien eines Ordners: die `CLAUDE.md` des Ordners (z. B. `js/game/CLAUDE.md`), höchstens 4 KB (`test/featuremap.test.js`).
- Stadt im Simulationsschritt, Felder von Stadt und Straßentransport: `docs/architektur/stadt.md`; Eroberung: `docs/architektur/eroberung.md`;
  Speichern und Laden: `docs/architektur/spielstand.md`.
- Einen Spielwert ändern, Schlüssel finden → `docs/wo-aendern.md`, dann `docs/rezepte/wert-aendern.md`.
- Neue Einheit anlegen → `docs/rezepte/neue-einheit.md`; ihr Aussehen (3D-Modell) → `docs/rezept-einheiten.md`.
- Neues Militärgebäude (Baumenü des Baufahrzeugs) → `docs/rezepte/neues-gebaeude.md`.
- Neue Zellenart der Stadt (Wohnen, Werk, Großbau) → `docs/rezepte/neue-stadtzellenart.md`.
- Neue Ware eines Werks, Überblick über die Stadt-Ressourcen (Regel 11) → `docs/rezepte/neue-ware.md`.
- Neue Rohware für die Einfuhr → `docs/rezepte/neue-rohware.md`.
- Neuer Befehl für `game.issue` → `docs/rezepte/neuer-befehl.md`.
- Neuer Schalter im Startmenü → `docs/rezepte/neue-startoption.md`.
- Neues Spielsystem mit eigenem Modul unter `js/game/` → `docs/rezepte/neues-spielsystem.md`.
- Neuer Spielmodus, Flaggen- oder Ticketregel der Eroberung → `docs/rezepte/neuer-spielmodus.md`.
- KI verhält sich falsch (greift zu früh an, baut zu wenig …) → `docs/rezepte/ki-verhalten.md`.
- Test schlägt fehl, neuer Test, Browserfehler nachstellen, URL-Parameter → `docs/testen.md`.
- CI, Deploy auf den Webspace, Secrets → `docs/betrieb.md`.
- Änderungsverlauf (nur bei Bedarf): `docs/changelog.md`; alter Umsetzungsplan und erledigte Pläne: `docs/archiv/`.
