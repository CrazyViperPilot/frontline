# Frontline – Architektur

Wie der Code aufgebaut ist. Regeln für Änderungen und Wegweiser: [CLAUDE.md](CLAUDE.md); Werte: [docs/wo-aendern.md](docs/wo-aendern.md); Rezepte: [docs/rezepte/](docs/rezepte/).
Spielregeln: [PRD.md](PRD.md) (Einstieg) und die Themen-Dateien in [docs/prd/](docs/prd/). Zahlen stehen hier bewusst nicht, sie gehören in `js/data/`.

## 1. Schichten

```
  Spieler-Steuerung (js/ui/)    Computergegner (js/ai/)        Taktgeber (js/core/loop.js)
            │                            │                       │ update(dt)       │ render()
            └── game.issue(team, cmd) ───┘                       │                  │
                         │                                       │                  │
                         ▼                                       ▼                  ▼
  Simulation (js/game/, kein DOM)  ◄─────────────────────────────┘     Darstellung (js/render/), HUD
                         │                    ── Zustand ──────────────────►  (liest nur)
                         ▼ liest
  Werte (js/data/: QUICK und BALANCE, UNITS, BUILDINGS, KI-Werte), gelesen von allen Schichten
```

- **Simulation** (`js/data`, `js/core/rng.js`, `js/game`, `js/ai`): ohne DOM, deterministisch je Seed, läuft in Node (`npm test`).
- **Befehle:** Spieler (über `js/ui/controller.js`) und KI ändern das Spiel nur mit `game.issue(team, cmd)`. Beide haben dieselben Regeln.
- **Darstellung und HUD** lesen den Zustand (`game.units`, `game.buildings`, `game.effects` …) und ändern ihn nie.
- **Ereignisse:** Die Simulation legt Meldungen in `game.events` (`game.message(team, text, x, y)`), das HUD holt sie mit `game.drainEvents()`.

## 2. Ablauf einer Partie

1. `index.html` lädt `js/main.js`. Das Startmenü (`js/ui/menu/start.js` → `showStartMenu`, Einstieg `js/ui/menu.js`) liefert Modus, Schwierigkeit je Gegner, Siegpunkte bzw. Tickets, Karte und Schalter.
2. `main.js` → `startGame` erzeugt `new Game({ seed, winPoints, startMoney, map, radio, weather, research, river, conquest, players, tickets, buildRules })` (jede Partie mit Stadt),
   dazu je Computergegner eine `AI` (Team 1, in der Eroberung bis Team 3, jede mit eigener Schwierigkeit), `Camera`, `Renderer`, `Controller`, `Hud`,
   `Input` und `Minimap`. Ohne Angabe ist `new Game()` klassisch (`conquest: false`, zwei Teams, Tests verlassen sich darauf).
3. `createLoop` (`js/core/loop.js`) ruft mit fester Schrittweite (`BALANCE.tickRate`) `ai.update(dt)` und `game.update(dt)`,
   und je Bildschirm-Frame einmal das Zeichnen. Pause und Tempo wirken nur auf die Schritte.
4. Sieg: klassisch Siegpunkte (`zone.js`), Sendemast (`radio.js`) oder Fall der Hauptstadt; Eroberung: Tickets (`conquest.js`, der letzte
   Spieler mit Tickets gewinnt), Sendemast wie gehabt. Die Prüfung je Schritt ist `checkElimination` (`game.js`), sie ruft den Modus-Haken
   `checkEnd` auf (`js/game/modes.js`). Dann zeigt `menu/end.js` den Endbildschirm.

## 3. Ein Simulationsschritt (`Game.update(dt)` in `js/game/game.js`)

Die Reihenfolge ist Absicht; ein neues System kommt an die Stelle, deren Ergebnisse es braucht.

| # | Aufruf | Modul | Was passiert |
|---|---|---|---|
| 1 | `updateWeather` | `weather.js` | Wetterwechsel, Sicht- und Tempofaktoren |
| 2 | `updateResearch` | `research.js` | Forschungsfortschritt |
| 2b | `updateAbilities` | `abilities.js` | Rauch, Minen, Feldwerkstatt |
| 3 | `updateEconomy` | `economy.js` | `team.rate` zurücksetzen, Ausbildung, Soldaten-Nachschub |
| 3a | `updateCity` | `city/economy.js` | Einwohner, Wachstum, Steuern, Gewerbe-Absatz, Einfuhr, Werke, Pendler (Einzelheiten: `docs/architektur/stadt.md`) |
| 4 | `updateGarrison`, `updateTowers` | `garrison.js`, `tower.js` | Ein- und Aussteigen in Stadthäuser und Gefechtstürme; Dachaufbauten werden fertig |
| 5 | `updateFormations` | `formation.js` | Tempo geschlossener Gruppen |
| 6 | `updateMovement` | `movement.js` | zurückgestellte Wege planen (`planPending`, `pathplan.js`), Wege fahren, Verfolgen (ohne Jets); Rücksetzen von `pathWork`, `pathShare` am Ende von `update` |
| 6a′ | `updateScramble` | `scramble.js` | Alarmrotte: Jets in Bereitschaft gegen Luftziele am Fliegerhorst starten (über `cmdAttack`), Ziel weg → Landung (`cmdLand`); vor `updateAircraft` |
| 6a″ | `updateAirstrike` | `airstrike.js` | Luftschlag: Jets nach dem Einsatz (Ziel weg, am Punkt nichts gefunden) heimschicken (`cmdLand`); vor `updateAircraft` |
| 6a | `updateAircraft` | `aircraft.js` | Jets: fliegen, kreisen, Rückkehr, Landung, Rollen über Straßen und Bahn, Tanken und Nachladen am Stellplatz aus Kerosintank und Munitionslager, Absturz ohne Treibstoff |
| 6b | `updateHelis` | `helipad.js` | Hubschrauber mit Heliport: senkrecht starten und landen, Luftraumsperre, gelandet tanken und nachladen aus Kerosintank und Munitionslager, Heimflug |
| 7 | `updateCrates` | `crates.js` | Kisten aufheben, tragen, einlagern, Kistengeld |
| 8 | `updateLogistics` | `logistics.js` | LKW laden, entladen, pendeln; Nachfüllen der Einheiten |
| 9 | `updateConstruction` | `construction.js` | Baufortschritt, Reparatur, automatische Bauzuweisung |
| 9a | `updateDig` | `excavator.js` | Bagger fahren zu ihrer Zelle und räumen sie |
| 10 | `updateBridges` | `river.js` | Brücken-Wiederaufbau |
| 11 | `separate` | `movement.js` | Einheiten auseinanderschieben |
| 12 | `updateCommanders` | `commander.js` | Aura, Heilung |
| 13 | `updateCombat` | `combat.js` | Zielsuche, Schüsse, Granaten, Flugabwehr, Schaden |
| 14 | `mode.update`: `updateZone` (klassisch) / `updateConquest` | `zone.js` / `conquest.js` | klassisch: Zone, Zonengeld, Punkte; Eroberung: Flaggengebiete zählen, Flaggen einnehmen, Flaggengeld, Ticket-Takt, Viertel-Sperre |
| 15 | `updateHot` | `hotzone.js` | Hot Zone wandern lassen, Bohrer |
| 16 | `updateRadio` | `radio.js` | Haltezeit des Sendemasts, Sieg |
| 17 | `smoothIncome` | `economy.js` | geglättete Einkommensanzeige |
| 18 | Nebel je Team (alle `BALANCE.fogInterval` s, Team 1 einen halben Takt versetzt) | `fog.js` | Sicht je Team |
| 19 | `updateAnimals`, `ageEffects`, `cleanup`, `updateScars` | `animals.js`, `game.js`, `scars.js` | Tiere, Effekte altern, Tote entfernen (Wracks, Ereignisse), Narben |
| 20 | `checkElimination` | `game.js` (ruft `mode.checkEnd`) | klassisch: Fällt die Hauptstadt eines Teams, endet die Partie; Eroberung: Ausscheiden bei Fall der Hauptstadt oder 0 Tickets, Partie endet, wenn ein Team übrig bleibt |

Schritt 3a im Einzelnen (Phasen, Einfuhr, Ketten und Pendler über `transport.js`): `docs/architektur/stadt.md`.

Startzustand im Konstruktor von `Game`: Karte (`generateMap` oder gespeicherte Karte), Raster, Höhengelände, Brücken, Stadtstraßen der Karte (`createRoads`, `game.roads`), Teams,
Forschung, Zone, Modus (`mode.create`: in der Eroberung Flaggen und Tickets), Hot Zone, Nebel, Hauptstädte und Startarmee, Häuser, Kisten, Tiere, Wetter. Jedes System hat dafür ein `create…(game)`.

## 4. Koordinaten

- Welt in Pixeln, Ursprung links oben; Karte und Rastergröße in `BALANCE.map`. Zelle `(c, r)` = `Math.floor(x / tile)`, Index `r * cols + c`.
- Winkel im Bogenmaß (0 = +x), Tempo in px/s, Zeiten in Sekunden.
- Gebäude belegen Zellen ab `cx, cy` (links oben) mit Größe `w × h`; `x, y` ist der Mittelpunkt in der Welt.
- Team 0 = Blau (Spieler), Team 1 = Rot (KI); in der Eroberung Team 2 = Grün, Team 3 = Gelb (2 bis 4 Teams, `BALANCE.teamNames`, `teamColors`).
  Startpunkte sind punktsymmetrisch: zu jedem `(x, y)` gehört `(W − x, H − y)` (Blau/Rot und Grün/Gelb spiegeln sich).
- Die Iso-Ansicht ist nur Darstellung (`js/render/iso.js`, `camera.js`); die Spiellogik bleibt 2D von oben.

## 5. Datenmodelle

Alle Objekte sind einfache JS-Objekte. IDs: fortlaufende Ganzzahlen ab 1 (`game.newId()`); 0 oder `null` = keins.
Häuser und Kisten haben negative IDs. Vollständige Felder: `createUnit` und `createBuilding` in `js/game/entities.js`.

**Game** (`js/game/game.js`): `seed, rng, map, grid, relief, time, teams[2 bis 4], entities (Map id → Einheit/Gebäude), units[], buildings[],
projectiles[], effects[], events[], zone, hot, fog[je Team], formations, winner (null | Team-Index), winReason, winPoints, radioWin`,
dazu von den Systemen: `houses, crates, bridges, wrecks, animals, weather, research`.
**Eroberung** (`game.conquest`, nur mit `conquest`), Flaggen, Wegraster-Sperre `grid.lock` und `game.mode`: Felder in `docs/architektur/eroberung.md`.

**Team:** `id, name, color, res { money, bm, mun, fuel }` (bm/mun/fuel = Summe der FOB-Lager, als Getter), `income`, `rate`, `flow`,
`points, pointProgress, incomeMult, isAI, tech { tier, done, cur }`; Eroberung zusätzlich `tickets` und `out` (ausgeschieden).

**Einheit** (`kind: 'unit'`): `id, type, team, def (= UNITS[type]), x, y, angle, hp, maxHp, alive, order { type, x, y, targetId }, path,
targetId, weapons [{ spec, rounds, cd }], ammo (Getter), fuel, cargo { bm, mun, fuel }, preset, passengers, house, crate, speedMul, anchorX/Y`, `hitBy` (Team des letzten Treffers, `combat.hit`: Prämie und Statistik bei mehr als zwei Teams).

**Gebäude** (`kind: 'building'`): `id, type, team, def (= BUILDINGS[type]), x, y, cx, cy, w, h, hp, maxHp, alive, built, progress,
queue [{ unit, payerId }], queueTimes, rallyX/Y, main (Hauptstadt), store { bm, mun, fuel }, drill, fireTarget`; Eroberung: `spawnFlag` (Nummer der Flagge, an der neue Einheiten erscheinen; `null` = am Gebäude).

**Stadt** (`game.city[team]`, `js/game/city/create.js`) und **Straßentransport** (`transportOf`, `js/game/transport.js`): Felder in `docs/architektur/stadt.md`.

**Effekt** (nur Darstellung, `game.effects`): `{ type, x, y, x2, y2, team, t, life }`, angelegt mit `game.addEffect`.

**Ereignis** (`game.events`): `{ type: 'message', team (−1 = alle), text, x, y }`.

## 6. Befehle (`game.issue(team, cmd)`)

Antwort immer `{ ok: true, … }` oder `{ ok: false, reason: 'deutscher Text' }`. `ids` = Liste eigener Einheiten.
Alle Befehle stehen im **Befehlsregister** `COMMANDS` (`js/game/commands.js`): je Typ der Handler `run`, `drives`
(der gleichnamige Auftrag wird von seinem Modul gefahren, `updateMovement` lässt ihn aus: `OWN_DRIVERS`) und `sound` (die Steuerung
quittiert ihn mit dem Befehlston). `game.issue` schlägt nur dort nach; `test/docs.test.js` prüft, dass jeder Registereintrag hier steht.
Neue Befehle: Rezept `docs/rezepte/neuer-befehl.md`.

| `cmd.type` | Felder | Handler (`js/game/`) | Wirkung |
|---|---|---|---|
| `city` | `kind` (Zellenart aus `KINDS`, z. B. `road`, `res`, `barracks`, `rail`, oder `erase`), `c0, r0, c1, r1`, `demolish?` | `city/commands.js` `cmdCity` | Stadtzellen im Rechteck ausweisen oder räumen (nur mit Stadt; unter der Tabelle) |
| `move`, `attackMove` | `ids, x, y, formation?` | `cmd/units.js` `cmdMove` | Marsch bzw. Angriffsmarsch, optional in Formation |
| `attack` | `ids, targetId` | `cmd/units.js` `cmdAttack` | Ziel angreifen (auch Brücken) |
| `stop` | `ids` | `game.js` | Anhalten |
| `build` | `building, x, y, ids` oder `siteId, ids` | `cmd/build.js` `cmdBuild` | Baustelle setzen bzw. an Baustelle helfen |
| `buildWall` | `building, x1, y1, x2, y2, ids` | `cmd/build.js` `cmdBuildWall` | Mauer- oder Torlinie (Tor: je 2 Zellen ein Tor aus zwei Hälften `leaf` 0/1; `build` mit `building: 'gate'` setzt ebenfalls ein Zweier-Tor, optional `axis`) |
| `deploy` | `ids`, optional `x, y` (≤ `fob.deploySnap` vom Fahrzeug) | `cmd/units.js` `cmdDeploy` | FOB-Fahrzeug wird an seiner Stelle (oder der nächsten freien) zur fertigen FOB (`buildFob` antwortet nur mit einem Fehler) |
| `repair` | `ids, targetId` | `construction.js` `cmdRepair` | Gebäude reparieren |
| `repairBridge` | `ids, bridgeId` | `river.js` `cmdRepairBridge` | Brücke wieder aufbauen |
| `load`, `unload` | `ids, fobId, preset?`; `load` auch `work` statt `fobId` | `logistics.js` | LKW an einer FOB laden / entladen; `work` (Zellindex eines eigenen Werks mit Ausgangslager, `CITY.pickup.kinds`) lädt dort nur die Ware des Werks |
| `route` | `ids, fromId, toId, preset?`; `fromWork` statt `fromId` | `logistics.js` `cmdRoute` | LKW pendeln lassen, Start an einer FOB oder einem Werk |
| `setPreset` | `ids, preset` | `logistics.js` | Ladungsart (`mix`, eine Sorte `bm`/`mun`/`fuel`, zwei Sorten `bm+mun`/`bm+fuel`/`mun+fuel`; Liste `PRESETS`, `presetKinds`/`presetOf` in `logistics.js`) |
| `mortarTarget` | `ids, x, y` | `cmd/units.js` `cmdMortarTarget` | Mörser auf einen Punkt richten |
| `layMine` | `ids, x, y` | `mines.js` `cmdLayMine` | Pionier legt an einer Stelle eine getarnte Panzermine (Munition aus dem Teamlager, höchstens `BALANCE.sapper.maxMines` je Pionier) |
| `land` | `ids, airportId` | `aircraft.js` `cmdLand`, Heliport als Ziel `helipad.js` `cmdHeliLand` | Flugzeuge landen am Fliegerhorst des eigenen Stellplatzes `airportId` (Anflug, Bahn, Ausrollen, Rollen zum Stellplatz) |
| `scramble` | `ids, on?` | `scramble.js` `cmdScramble` | Alarmbereitschaft der gewählten Jets mit Luft-Luft-Waffe an (`on: true`) oder aus; ohne `on` umschalten |
| `airstrike` | `x, y, targetId?` | `airstrike.js` `cmdAirstrike` | Luftschlag: bis `CITY.air.strike.maxJets` startbereite Jets mit Bodenwaffen greifen das Ziel an oder fliegen im Angriffsmarsch zum Punkt, danach Landung |
| `cityUpgrade` | `buildingId` | `city/commands.js` `cmdCityUpgrade` | Stellplatz eine Stufe ausbauen (Überdachung, Stahlbeton-Shelter) gegen Geld, BM und Stahl |
| `cityConnect` | `buildingId` | `city/commands.js` `cmdCityConnect` | Straße zum Lager: kürzester Weg aus neuen, bezahlten Straßenzellen vom Stadtgebäude zur Straße zum Lager (höchstens `CITY.playerConnect`) |
| `layBridge` | `ids, c, r` | `river.js` `cmdLayBridge` | Brückenleger legt auf einer Flusszelle am Ufer eine Behelfsbrücke (E14); Schritt `updateBridgeLayers` (nach `updateBridges`) |
| `dig` | `ids, c0, r0, c1, r1, append?` | `excavator.js` `cmdDig` | Bagger räumen die Zellen des Rechtecks nacheinander (Zonenstraße, Bäume, Häuser, eigene Gebäude, Schutt und gegnerische Straßen) |
| `shellRoad` | `ids, c0, r0, c1?, r1?` | `roadwar.js` `cmdShellRoad` | Einheiten mit Granaten oder Raketen beschießen die Straßenzellen des Rechtecks, bis sie zu Schutt werden (Paket „Straßen“, Teil 3) |
| `clearRubble` | `ids, c0, r0, c1?, r1?` | `roadwar.js` `cmdClearRubble` | Baufahrzeuge räumen Schutt eigener Straßen und Stadtstraßen, die Straße ist wieder da (Paket „Straßen“, Teil 3) |
| `storm`, `fortifyHouse` | `ids, houseId` (Sturm) / `houseId, work` (ausbauen) | `garrison.js` `cmdStorm`, `cmdFortifyHouse` | Besetztes gegnerisches Haus stürmen / ein eigenes Haus zur Stellung ausbauen |
| `trade` | `good` (`bm`, `mun`, `fuel`, `metal`, `kero`), `dir` (`sell`, `buy`), `count?` (Lose, bis `CITY.market.maxCount`) | `city/commands.js` `cmdTrade` | Lose am eigenen Markt handeln; reicht es nicht, so viele wie möglich (`done`) |
| `board` | `ids, heliId` | `logistics.js` `cmdBoard` | in ein Fahrzeug oder einen Hubschrauber einsteigen |
| `dropoff` | `ids, x, y` | `logistics.js` `cmdDropoff` | Passagiere am Punkt absetzen |
| `paradrop` | `ids, x, y` | `paradrop.js` `cmdParadrop` | C-130 mit Passagieren fliegt zum Punkt und setzt sie per Fallschirm ab (`chute`, dann Heimflug) |
| `garrison`, `ungarrison` | `ids, houseId` (Haus oder Gefechtsturm) / `ids` | `garrison.js` | Haus oder Turm besetzen / verlassen |
| `roof` | `buildingId, kind` (`mortar`, `flak`, `sam`) | `tower.js` `cmdRoof` | Dachaufbau auf einen Gefechtsturm |
| `fortify` | `buildingId, towers?, tx?, ty?, ids?` | `tower.js` `cmdFortify` | FOB zur Festung ausbauen (Mauerring, Tore, Türme) |
| `pickup`, `deliver`, `dropCrate` | `ids, crateId` / `ids, fobId` / `ids` | `crates.js` | Kiste aufheben / abliefern / fallen lassen |
| `drill` | `ids` | `hotzone.js` `cmdDrill` | Bohrer starten |
| `train`, `cancelTrain` | `buildingId, unit` / `buildingId` | `game.js` | Ausbildung in Kaserne, Fabrikhalle, Heliport und Stellplatz (Stadt-Entities mit `produces`, `queue`) / letzten Eintrag abbrechen |
| `research`, `cancelResearch` | `buildingId, key` / `key?` | `research.js` | Forschung starten oder einreihen (bis 3 wartend, bezahlt beim Einreihen) / abbrechen (ohne `key` die laufende; Abhängige fallen mit heraus, alles erstattet) |
| `smoke`, `mine` | `ids` | `abilities.js` | Nebelwand (Fahrzeuge) / Mine (Baufahrzeug) |
| `rally` | `buildingId, x, y` | `cmd/units.js` `cmdRally` | Sammelpunkt |
| `spawnAt` | `buildingId, flag` (Nummer einer eigenen Flagge oder `null`) | `cmd/units.js` `cmdSpawnAt` | Eroberung: neue Bodeneinheiten des Gebäudes erscheinen an dieser Flagge (`null`: am Gebäude) |
| `demolish` | `buildingId` | `cmd/build.js` `cmdDemolish` | Gebäude abreißen |
| `setDifficulty` | `difficulty` (`easy`, `normal`, `hard`) | `game.js` | KI meldet ihr Team an (aus dem Konstruktor von `AI`): `isAI`, `incomeMult` aus `BALANCE.difficulty` |
| `debug` | `money?`, `weather?`, `season?`, `hold?` | `commands.js` `cmdDebug` | Nur mit `new Game({ debug: true })` (`?debug=1`): Geld dazu (Taste M) / Wetter setzen, mit `hold` bleibt es |

`city`: Zellenarten aus dem Register `js/data/citykinds.js`. `erase` räumt eigene Stadtzellen, auch Gleise und Straßen;
mit `demolish: true` (Abreißen eines gewählten Gebäudes) entfernt es nur dieses Gebäude. `trade` nur mit fertigem Markt.

## 7. Dateien

Die Dateiliste eines Ordners steht in seiner eigenen `CLAUDE.md` (eine Zeile je Datei: Zweck, wichtigste Exporte, darunter die
Besonderheiten des Ordners). Claude Code lädt sie, sobald im Ordner gelesen wird. Neue Datei: dort eine Zeile ergänzen
(`test/featuremap.test.js` prüft das; höchstens 4 KB je Ordnerdatei, keine Zeile über 200 Zeichen).

| Ordner (Link zur Dateiliste) | Zweck |
|---|---|
| [`js/game/`](js/game/CLAUDE.md) | Simulation ohne DOM: Zustand, Befehle (`cmd/`), Systeme je Schritt |
| [`js/game/city/`](js/game/city/CLAUDE.md) | Zonenstadt: Zellen, Abfragen, Straßennetz, Wirtschaft, Befehle |
| [`js/ai/`](js/ai/CLAUDE.md) | Armee-KI (Klasse `AI`, Mixins in `army/`), Sperrzeiten-Helfer |
| [`js/ai/city/`](js/ai/city/CLAUDE.md) | Stadt-KI (Einstieg `js/ai/cityai.js`) |
| [`js/data/`](js/data/CLAUDE.md) | Spielwerte und Register (`QUICK`, `BALANCE`, `UNITS`, `CITY`, …) |
| [`js/render/`](js/render/CLAUDE.md) | Darstellung, liest nur: gemalte Bilder, Iso, WebGL-Boden, Minimap |
| [`js/render/layers/`](js/render/layers/CLAUDE.md) | Ebenen der Klasse `Renderer` (2D, Iso, Nebel, Overlays); Durchläufe als Listen in `passes.js` |
| [`js/ui/`](js/ui/CLAUDE.md) | Steuerung (`controller/`), HUD (`hud/`), Fenster, Spielstände |
| [`js/ui/menu/`](js/ui/menu/CLAUDE.md) | Overlay-Menüs: Start, Pause, Hilfe, Ende, Konto |

Kleine Ordner ohne eigene Datei:
- `js/main.js` startet die Partie (`startGame`), Spielstände und Messanzeige; `js/version.js` (`GAME_VERSION`, schreibt `npm run release`).
- `js/core/`: `loop.js` feste Schrittweite und Frames, `rng.js` Zufall je Seed (mulberry32), `snapshot.js` Objektgraph ↔ JSON (§8).
- `js/audio/`: `sound.js` Ton per WebAudio (liest `game.effects`, Meldungen, Wetter; ein `Sound` für alle Partien in `main.js`),
  `music.js` Hintergrundmusik, von `Sound` erzeugt und gesteuert. Beide ändern nichts an der Partie.
- `js/editor/editor.js` + `editor.html`: Karteneditor; speichert Karten über `js/game/mapdata.js` im `localStorage`.
- Sonstiges: `sw.js` Service Worker (network-first, Präfix `frontline-`), `manifest.json`, `css/`, `icons/` (keine weiteren Bilddateien,
  alles gemalt), `tools/doc-tables.mjs` (Wertetabellen der PRD, `npm run docs`), `test/` (node --test), `api/` und `admin/` (PHP, §9).
- Symbol-Index `docs/index/`: je Ordner unter `js/` „Datei → Exporte“ mit Methoden und erstem Kommentarsatz, erzeugt von `npm run index`
  (`tools/index.mjs`, nicht von Hand ändern; `test/index.test.js` prüft die Aktualität). Kleine Ordner stehen in `core.md`.

## 8. Spielstand
Speichern und Laden (`core/snapshot.js`, `game/savegame.js`, `ui/saves.js`, `SAVE_FORMAT`): `docs/architektur/spielstand.md`. Regeln: PRD §16.

## 9. Feature-Landkarte

Wo jedes Feature liegt. Werte: Tabelle „Wo ändere ich was?“ in `docs/wo-aendern.md` und das Inhaltsverzeichnis in `js/data/balance.js`. Dateilisten je Ordner: `CLAUDE.md` im Ordner (§7).
Neues Feature: hier eine Zeile ergänzen (höchstens 200 Zeichen: Name, PRD-Datei, Hauptmodul, Test).

| Feature | PRD (`docs/prd/<name>.md`) | Hauptmodul (unter `js/`, sonst ab Wurzel) | Weitere | Test (`test/<name>.test.js`) |
|---|---|---|---|---|
| Spielzustand, Befehle, Sieg, Endstatistik | `PRD.md` | `game/game.js` | Bild `ui/menu/end.js` | `game`, `stats` |
| Ausbildung, Einheitenlimit, Nachschub, Einkommen | `ressourcen-bau` | `game/economy.js` | KI `ai/army/produce.js` | `economy` |
| Eroberung (Flaggen, Tickets, Viertel-Sperre) | `eroberung` | `game/conquest.js` | KI `ai/army/conquest.js`; Bild `render/layers/zones.js` | `conquest` |
| Konfliktzone, Punkte, Zonengeld | `zone-gelaende` | `game/zone.js` | Bild `render/layers/zones.js` | `economy`, `game` |
| Hot Zone und Bohrer | `zone-gelaende` | `game/hotzone.js` | Bild `render/layers/zones.js` | `game` |
| Lager, LKW, Nachfüllen, Werkslager | `ressourcen-bau` | `game/logistics.js` | KI `ai/army/logistics.js`; Bild `render/layers/overlays.js` | `logistics`, `pickup` |
| LKW-Ladungsarten | `steuerung-oberflaeche` | `game/logistics.js` | UI `ui/controller/cards.js` | `cargo-presets` |
| Bauen, Reparieren, neue FOBs | `ressourcen-bau` | `game/construction.js` | KI `ai/army/build.js`; UI `ui/controller.js` | `game` |
| Hauptstadt als Regierungsgebäude | `ressourcen-bau` | `render/govquarter.js` | Bild `render/cityhall.js` | `govquarter` |
| Bewegung, Wegsuche, Raster | – | `game/movement.js` | `game/pathplan.js` | `path`, `pathplan` |
| Formationen | `steuerung-oberflaeche` | `game/formation.js` | – | `formation` |
| Kampf, Waffen, Schaden, Treffer | `einheiten` | `game/combat.js` | Bild `render/fx.js` | `hits`, `fx` |
| Flugabwehr (Flak, SAM, Phalanx) | `einheiten` | `game/combat.js` | KI `ai/army/produce.js`; Bild `render/milbuild.js` | `airdefense`, `aiair` |
| Gepard und Panzerhaubitze | `einheiten` | `game/combat.js` | Bild `render/layers/radii.js` | `artillery`, `aiart` |
| Scharfschütze, Tarnung | `einheiten` | `game/combat.js` | – | `sniper` |
| Kommandeur | `einheiten` | `game/commander.js` | – | `commander` |
| Bagger | `einheiten` | `game/excavator.js` | Bild `render/fx.js` | `fx` |
| U-2 Höhenaufklärer | `einheiten` | `game/aircraft.js` | KI `ai/army/combat.js` | `u2` |
| Nebel und Sicht | `zone-gelaende` | `game/fog.js` | Bild `render/layers/fog.js` | `terrain`, `fogpaint` |
| Gelände: Höhe, Hänge, Seen | `zone-gelaende` | `game/relief.js` | Bild `render/ground.js` | `relief`, `terrain` |
| Fluss, Brücken, Furten | `zone-gelaende` | `game/river.js` | Bild `render/bridge.js` | `river` |
| Natur: Bäume, Büsche, Felsen | `zone-gelaende` | `render/nature.js` | `render/layers/relief.js` | `nature` |
| Versorgungskisten | `zone-gelaende` | `game/crates.js` | KI `ai/army/logistics.js`; Bild `render/props.js` | `crates` |
| Sendemast | `zone-gelaende` | `game/radio.js` | Bild `render/milbuild.js` | `radio` |
| Häuserkampf | `haeuserkampf` | `game/garrison.js` | KI `ai/army/combat.js`; Bild `render/layers/garrison.js` | `garrison`, `housefight` |
| Festung: Gefechtsturm, Dachaufbau | `ressourcen-bau` | `game/tower.js` | KI `ai/army/build.js` | `tower`, `fortress-ai` |
| Wetter und Jahreszeiten | `wetter-forschung` | `game/weather.js` | Bild `render/weatherfx.js` | `weather` |
| Lichtstimmung | `wetter-forschung` | `render/mood.js` | – | `mood` |
| Forschungsbaum | `wetter-forschung` | `game/research.js` | `game/abilities.js`; UI `ui/researchpanel.js` | `research` |
| Zufallskarte, Gehöfte, Felder | `zone-gelaende` | `game/map.js` | `game/landscape.js`; Bild `render/terrain.js` | `map`, `golden` |
| Wracks und Krater, Tiere (nur Optik) | `steuerung-oberflaeche` | `game/scars.js` | `game/animals.js`; Bild `render/nature.js` | `scars`, `animals` |
| Karteneditor, gespeicherte Karten | `steuerung-oberflaeche` | `editor/editor.js` | `game/mapdata.js` | `mapdata` |
| Stadt (Gebiet, Einwohner, Strom, Ausbildung, Pflege) | `stadt` | `game/city/economy.js` | KI `ai/city/build.js`, `ai/city/grow.js`; UI `ui/citypanel.js` | `city`, `buildrules` |
| Anschlusspflicht ans Straßennetz, Straßennetz der Stadt-KI | `stadt` | `game/city/cells.js` | `game/city/roadnet.js`; KI `ai/city/roads.js` | `buildrules`, `citynet` |
| Großbauten mit gerader Kante | `stadt` | `game/city/cells.js` | KI `ai/city/need.js`; Bild `render/bigbuild.js` | `city`, `bigbuild` |
| Aussehen der Stadtgebäude, Baustellen, Ruinen | `stadt-aussehen` | `render/townhouses.js` | Bild `render/works.js`, `render/citysite.js` | `citysite` |
| Stadtstraßen der Karte | `stadt-transport` | `game/roads.js` | Bild `render/citylayer.js` | `city` |
| Straßentransport, Stau, Pendler, Versorgung der Ausbildung | `stadt-transport` | `game/transport.js` | Bild `render/citylayer.js` | `transport`, `supply` |
| Straße zum Lager (Knopf am Stadtgebäude) | `stadt-transport` | `game/city/commands.js` | Weg `game/city/roadnet.js` `connectPath` | `cityconnect` |
| Lagerhalle (füllt sich über die Straße, LKW laden, Nachfüllen) | `stadt-transport` | `game/city/economy.js` `fillWarehouses` | `game/logistics.js`; Bild `render/bigbuild.js` | `warehouse` |
| Straßen zerstören und räumen | `stadt-transport` | `game/roadwar.js` | `game/excavator.js`; KI `ai/army/logistics.js` | `roadwar` |
| Ressourcenanzeige | `stadt-wirtschaft` | `game/flow.js` | UI `ui/flowpanel.js` | `flow` |
| Einfuhr der Rohwaren, Güterbahnhof | `stadt-wirtschaft` | `game/transport.js` | `game/city/roadnet.js`; KI `ai/city/roads.js` | `import`, `flow` |
| Industriepark der Stadt-KI | `ki` | `ai/city/station.js` | `ai/city/park.js` | `industriepark` |
| Fliegerhorst, F-16, F-22, Su-27, Anschluss | `stadt-luft` | `game/aircraft.js` | KI `ai/city/airbase.js`; Bild `render/airbase.js` | `airbase`, `airfield-link` |
| Alarmrotte (Jets starten selbst gegen Luftziele) | `stadt-luft` | `game/scramble.js` | KI `ai/army/combat.js` `jets()` | `scramble` |
| Luftschlag (Knopf im HUD, Taste H) | `stadt-luft` | `game/airstrike.js` | UI `hud/core.js`, `controller/modes.js` | `airstrike` |
| Heliport als Landeplatz | `stadt-luft` | `game/helipad.js` | KI `ai/army/produce.js` | `helipad` |
| KI allgemein | `ki` | `ai/ai.js` | – | `ai` |
| Steuerung, Befehlskarte, HUD, Hilfe | `steuerung-oberflaeche` | `game/commands.js` | UI `ui/controller.js`, `ui/hud.js` | `commands` |
| Wischleiste der Befehlskarte | `steuerung-oberflaeche` | `ui/hud/commands.js` | – | – |
| Anzeigen auf der Karte | `steuerung-oberflaeche` | `render/marks.js` | `render/layers/overlays.js` | `marks` |
| Kamera, Iso-Ansicht, Minimap | `steuerung-oberflaeche` | `render/renderer.js` | `render/iso.js`, `render/minimap.js` | – |
| Detailstufen beim Herauszoomen | `steuerung-oberflaeche` | `render/layers/core.js` | `render/layers/top.js` | – |
| Bildauflösung „Scharf“ oder „Leistung“ | `steuerung-oberflaeche` | `main.js` | `ui/menu/prefs.js` | – |
| Messanzeige | `steuerung-oberflaeche` | `ui/perfmeter.js` | `core/loop.js` | `perfmeter` |
| Ton, Musik, Lautstärke | `ton-speichern` | `audio/sound.js` | `audio/music.js` | `sound`, `music` |
| Spielstand speichern und laden | `ton-speichern` | `game/savegame.js` | `core/snapshot.js`; `ui/saves.js` | `save`, `saves` |
| Offline, Installation | `PRD.md` | `sw.js` | `manifest.json` | `assets` |
| Benutzerkonten, Konto-Bereich | `konto` | `api/auth.php` | `api/lib/konto.php`; UI `ui/menu/account-html.js` | `konto` |
| Kasse am Konto | `konto` | `api/auth.php` | UI `ui/menu/start-saves.js` | `kasse` |
| Signierter Match-Start, Spielstatistik | `konto` | `api/match.php` | `api/lib/match.php`; UI `ui/match.js`, `ui/stats.js` | `match`, `spielstatistik` |
| Admin-Panel | `konto` | `api/admin.php` | `admin/` | – |
