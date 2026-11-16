# js/game/city/ – Zonenstadt (Simulation, kein DOM)

Regeln: PRD §15 (`docs/prd/stadt*.md`), Werte `js/data/city.js`, `citykinds.js`, `goods.js`, KI `js/ai/cityai.js` und `js/ai/city/`, UI `js/ui/citypanel.js`.

- `cells.js` – Zellgeometrie, Straßenzugang, Baugebiet, Anschlusspflicht; Blattmodul nur mit Daten-Importen. `buildWhy`, `fitBig`, `roadAt`, `canZone`
- `query.js` – Abfragen ohne Zustandsänderung. `cityLevel`, `citySum`, `freePop`, `crewOf`, `cityTrainers`
- `state.js` – Zellzustand, Summen, Beleg von `grid.struct`, Ziel-Entities. `totals`, `updateClaim`, `syncEntity`, `payMetal`
- `gridbfs.js` – Breitensuche auf dem Stadtraster, Blattmodul ohne Importe. `gridBfs`, `bfsPath`
- `roadnet.js` – Straßennetz und Anschlüsse. `mainRoadReach`, `connectRoad`, `connectEdge`, `importReach`
- `create.js` – Erzeugung und Startviertel. `createCity`, `ownCells`
- `clearing.js` – Bäume fällen, Abriss. `demolish`, `treeGone`, `clearableAt`
- `commands.js` – Befehle `city`, `cityUpgrade`, `trade`. `cmdCity`, `cmdCityUpgrade`, `cmdTrade`
- `economy.js` – Wirtschaftsschritt mit Einfuhr und Werken. `updateCity`
- `care.js` – Heilen und Reparieren. `careOf`, `updateCare`

## Besonderheiten
- Fertige Gebäude haben eine Ziel-Entity (`kind: 'building'`, `type: 'city'`, nicht in `game.buildings`), wählbar; `syncEntity`/`dropEntity` halten sie.
- Importe ohne Zyklus: Zellgeometrie und Rastersuche sind Blattmodule; `../transport.js` und `../research.js` lesen aus der Stadt nur die Zellgeometrie und die Abfragen.
- Neue Zellenart: Register `js/data/citykinds.js`, Rezept `docs/rezepte/neue-stadtzellenart.md`.
- Ablauf von `updateCity` und Felder von `game.city[team]` und Straßentransport: `docs/architektur/stadt.md`.
- Bahn und Rollfeld sind keine Straße (`roadAt`); gesperrte Bauplätze melden ihren Grund über `BUILD_BLOCK` (`buildWhy`).
- Ausbildung prüft `cmdTrain` (`../cmd/train.js`) über `trainerKind`; Tempo nach Versorgung rechnet `../economy.js` mit `../transport.js`.
