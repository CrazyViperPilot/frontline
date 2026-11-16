# Frontline

Echtzeit-Strategie im Browser: FOBs bauen, Nachschub organisieren, die Konfliktzone in der Mitte halten.
Spieler (Blau) gegen Computer (Rot). Vanilla JS, Canvas 2D und WebGL, kein Build-Schritt, offline spielbar (PWA).

**Spielen:** <https://phpexpert.de/frontline/> (wird nach jedem Push auf `main` mit grünen Tests per GitHub Actions über FTP hochgeladen, siehe `.github/workflows/deploy.yml`).

| Datei | Inhalt |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Einstieg: Regeln, Befehle, Wegweiser zu Rezepten (`docs/rezepte/`) und Werten (`docs/wo-aendern.md`); Feature-Landkarte in ARCHITEKTUR.md §9 |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Aufbau des Codes: Schichten, Simulationsschritt, Datenmodelle, Befehle, Ordner (Dateilisten in `CLAUDE.md` je Ordner unter `js/`), Feature-Landkarte |
| [PRD.md](PRD.md) | Einstieg in die Spielregeln mit Übersicht; die Regeln je Thema in [docs/prd/](docs/prd/), Änderungsverlauf in [docs/changelog.md](docs/changelog.md) |
| [docs/archiv/](docs/archiv/README.md) | Alte Pläne und der ursprüngliche Umsetzungsplan (v1 bis v4.23), nur zum Nachlesen, nicht der gültige Stand |

Alle Spielwerte (Einheitenlimit, Geld pro Sekunde, Preise, Schaden …) stehen in `js/data/`; wo genau, sagt [docs/wo-aendern.md](docs/wo-aendern.md).
Im Spiel zeigt **F1** oder **?** alle Tasten.

## Starten

```sh
# im Repo-Wurzelordner
python3 -m http.server 8765
```

Spiel: `http://localhost:8765/` · Karteneditor: `http://localhost:8765/editor.html`

## Debug-Parameter

Über die URL:

- `?debug=1`: Karte ist aufgedeckt (kein Nebel), Taste **M** gibt Team Blau +1000 Geld,
  Geschwindigkeit bis 10×.
- `?seed=N`: feste Karte (gleicher Seed = gleiche Partie).
- `?speed=N`: Startgeschwindigkeit.
- `?river=0|1`: Fluss auf der Zufallskarte aus oder an (übersteuert das Startmenü).
- `?gl=0`: Gelände der Iso-Ansicht ohne WebGL (flach, nur aufgemalt).
- `?debug=1&fog=1`: Debug, aber mit Nebel (Sicht im Gelände prüfen).
- `?debug=1&weather=summer|autumn|winter&wx=clear|rain|fog|snow`: Jahreszeit und festes Wetter.

Beispiel: `http://localhost:8765/frontline/?debug=1&seed=123&speed=3`

## Tests

```sh
cd frontline
npm run test:quick   # Config und PRD-Tabellen prüfen (Sekunden)
npm run docs         # Wertetabellen in docs/prd/ aus js/data/ erzeugen
npm test             # alle Tests: Simulation und KI ohne Browser (dauert einige Minuten)
```

Die Tests liegen in `test/` und laufen per `.github/workflows/test-frontline.yml`, sobald sich `frontline/` ändert.

Service Worker: `sw.js` (Cache-Präfix `frontline-`, Version `CACHE_VERSION`).
