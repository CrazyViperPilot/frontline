# js/ai/city/ – Stadt-KI (Ausbau, Markt, Überfälle, Verteidigung, Fliegerhorst)

Einstieg `js/ai/cityai.js` (Re-Exporte). Werte `CITY.ai` in `js/data/city.js`. Buchhaltung in `AI.cityMem`. Befehle nur über `game.issue`.

- `common.js` – Buchhaltung, Gefahrenzonen, Zellenbefehl, Kandidaten des Ausbaus; importiert keine Schwesterdateien. `cityAiMemory`, `inDanger`, `aiCandidates`, `cellCmd`
- `need.js` – Bedarf: welche Zone braucht die Stadt als Nächstes. `aiNeed`
- `build.js` – Ausbau-Schritt: Anker, Reihenfolge der Teilschritte, ruft alle anderen Module auf. `aiCity`
- `grow.js` – Wachstum: nächste Zellen ausweisen (Straße mit Zufahrt, Wohnen, Großbau über Werksplatz), Kontext je Takt. `growCells`
- `station.js` – Güterbahnhof: Einfuhr-Wächter und Anlage eines Industrieparks. `importWatch`, `aiStation`
- `park.js` – Grundriss des Industrieparks (vier Drehungen), Platzsuche und Werksplätze am Bahnhof. `parkSite`, `parkSlots`, `parkSpot`
- `roads.js` – Straße zum Kartenrand, Anschluss, Netz verlängern, Spuren überlasteter Straßen. `aiEdge`, `extendNet`, `aiConnect`, `aiLanes`
- `airbase.js` – Fliegerhorst: Bahn, Stellplätze, Tower, Kerosintank, Munitionslager, Gebietsprüfung. `aiAirport`
- `market.js` – Markt: Überschuss verkaufen, Metall und Baumaterial zukaufen, wenn knapp. `aiMarket`
- `raid.js` – Überfälle auf die gegnerische Stadt und Schutz der eigenen. `aiRaid`, `aiDefend`

## Besonderheiten
- Das Grundmodul ist ein Blatt (keine Importe von Schwestern), damit es keinen Importzyklus gibt; `test/imports.test.js` prüft das.
- Neue Entscheidung als eigene Funktion in das passende Modul, aufgerufen aus `aiCity`; neue Werte nach `CITY.ai`.
- Sperrzeiten über `js/ai/cooldown.js` (Tabellen in `cityAiMemory()`), Zufall nur über `game.rng`.

Exporte dieses Ordners: `docs/index/ai-city.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
