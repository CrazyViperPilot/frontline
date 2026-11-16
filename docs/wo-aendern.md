# Wo ändere ich was?

Erst hier den Schlüssel suchen (`grep -n "<Stichwort>" docs/wo-aendern.md`), dann in `js/data/` nur diesen Schlüssel lesen (`grep -n "<schlüssel>" js/data/<datei>.js`, danach den Ausschnitt), nie die ganze Datendatei.
Danach PRD und Hilfe anpassen: Rezept `docs/rezepte/wert-aendern.md` und Regel 7 der `CLAUDE.md`.

Alle Pfade relativ zum Repo-Wurzelordner. `QUICK` und `BALANCE` = `js/data/balance.js`, `UNITS` = `js/data/units.js`, `BUILDINGS` = `js/data/buildings.js`.
**Die häufigsten Werte stehen ganz oben in `js/data/balance.js` im Block `QUICK` (Schnelleinstellungen)**; `BALANCE` liest sie von dort.
Darunter listet ein Inhaltsverzeichnis alle weiteren Abschnitte.

| Ich will … | Datei | Schlüssel |
|---|---|---|
| Eroberung (Standardmodus im Menü): Größe der quadratischen Zone, Zahl der Flaggen, Einnahmezeit, Flaggengeld | js/data/balance.js | `BALANCE.conquest` (Regeln: `docs/prd/eroberung.md`, Logik: `js/game/conquest.js`) |
| Eroberung: Tickets und Takt, Frist bis die Viertel-Sperre fällt, Einheitenlimit nach Spielerzahl | js/data/balance.js | `BALANCE.conquest` (Regeln: `docs/prd/eroberung.md`, Logik: `js/game/conquest.js`) |
| Eroberung: KI (Flaggenziele, Erscheinungsort) | js/ai/army/conquest.js, js/data/ai.js | `CQ_*` in `js/data/ai.js`; Logik `js/ai/army/conquest.js`; Werte der Regeln: `BALANCE.conquest` |
| Einheitenlimit (Plätze je Team) | js/data/balance.js | `QUICK.unitLimit` (im Code `BALANCE.slotCap`); Eroberung: `BALANCE.conquest.slotCap` (nach Spielerzahl, 500) |
| Plätze, die eine Einheit belegt | js/data/units.js | `UNITS.<typ>.slots` (fehlt = 1) |
| Geld pro Sekunde je Einheit in der Konfliktzone | js/data/balance.js | `QUICK.moneyPerUnitZone` (im Code `BALANCE.zone.unitIncome`) |
| Geld pro Sekunde in der Hot Zone (statt, nicht zusätzlich) | js/data/balance.js | `QUICK.moneyPerUnitHot` |
| Geld pro Sekunde je eingelagerter Versorgungskiste | js/data/balance.js | `QUICK.moneyPerCrate` |
| Prämien für Abschüsse und Bauten | js/data/balance.js | `BALANCE.bounty` |
| Startgeld / Obergrenze der Kasse, die von Runde zu Runde bleibt | js/data/balance.js | `QUICK.startMoney` / `QUICK.walletMax` |
| Siegpunkte (Standard) / Takt der Punkte | js/data/balance.js | `QUICK.winPoints` / `QUICK.pointEvery` (Auswahl 25/50/100: `POINTS` in `js/ui/menu/common.js`) |
| Tickets der Eroberung (Auswahl, Standard, Takt, Verlust je Takt, Verlust ohne Flagge) | js/data/balance.js | `BALANCE.conquest.ticketChoices` / `ticketDefault` / `tickEvery` / `noFlagLoss` |
| Kommandeur-Verlust (in der Eroberung Tickets) | js/data/balance.js | `BALANCE.commander.deathPoints` (in der Eroberung Tickets) |
| Haltezeit des Sendemasts bis zum Sieg | js/data/balance.js | `QUICK.radioHold` |
| Startarmee | js/data/balance.js | `QUICK.startUnits` |
| Kostenloser Soldaten-Nachschub | js/data/balance.js | `QUICK.reinforceEvery`, weitere in `BALANCE.reinforce`; Eroberung aus: `BALANCE.conquest.reinforce` |
| Zahl der FOBs / Bauradius, Mindestabstände | js/data/balance.js | `QUICK.maxFobs` / `BALANCE.fob` |
| Startvorrat einer neuen FOB (Anteil des Lagers) / FOB-Fahrzeug (Preis, Tempo) / Bau- und Reparaturtempo | js/data/balance.js / js/data/units.js / js/data/balance.js | `QUICK.fobStartStock` / `UNITS.fobTruck` / `BALANCE.construction` |
| Lagergröße vordere FOB / Hauptstadt, LKW-Ladung / Lade- und Nachfüllraten | js/data/balance.js | `QUICK.storeCap` / `QUICK.capitalCap`, `QUICK.truckLoad` / `BALANCE.logistics` |
| Gleichzeitige Ausbildungen / Länge der Warteschlange | js/data/balance.js | `QUICK.trainSlots` / `QUICK.queueMax` |
| Preis, Ausbildungszeit, HP, Tempo, Sicht einer Einheit | js/data/units.js | `cost`, `buildTime`, `hp`, `speed`, `sight` |
| Waffen einer Einheit (Reichweite, Kadenz, Schuss, Schaden) | js/data/units.js | `weapons[]`: `range`, `cooldown`, `rounds`, `munCost`, `damage`, `hits` |
| Kosten, Bauzeit, HP, Waffe eines Gebäudes | js/data/buildings.js | `cost`, `buildTime`, `hp`, `weapon`, `aa`, `hotkey` |
| Forschungsbaum: Stufen, Regel „3 je Stufe“, Warteschlange, Preise und Zeiten je Stufe | js/data/research.js | `RESEARCH` (`tiers`, `perTier`, `queueMax`, `money`, `time`) |
| Forschungsbaum: Forschungen je Ast und ihre Wirkung (fx je Gruppe), Gruppen der Einheiten | js/data/research.js | `RESEARCH` (`lanes.<ast>.items`, `groups`) |
| Forschungstempo durch Rechenzentren | js/data/city.js | `CITY.research` |
| Schwierigkeit der KI (Denktakt, Angriffsschwelle, Einkommen, Verhalten, FOB-Grenze, Sendemast ab, Kistenholer) | js/data/balance.js | `BALANCE.difficulty.<easy\|normal\|hard>` |
| Weitere KI-Werte (Wellen, Späher, Expansion, Kisten …) | js/data/ai.js | eine Konstante je Zeile mit Kommentar; Bedeutung: PRD §10 „KI-Konstanten“ |
| Höhenvorteil, Tempo am Hang, Weitsicht von oben | js/data/balance.js | `BALANCE.height`, `BALANCE.slope`, `BALANCE.sightHeight` |
| Festung (Mauerring, Zahl der Türme, Höhenvorteil, Fallschaden) / Turm (Plätze, Dachaufbauten, Preise) | js/data/balance.js / js/data/buildings.js | `BALANCE.fortress` / `BUILDINGS.tower` |
| Stadt: Ausbildungsgebäude (`produces`, `trainSlots`), Heilen/Reparieren und Krankenhaus (`care`), Zellgröße, Gebiet, Einwohner je Einheit (`crew`) | js/data/city.js | `CITY` |
| Stadt: Flucht, Stahl je Einheit, Markt, Straßentransport (`transport`, `shop`), Trefferpunkte, Ruinen, Startlager, Erträge, Steuern, Kosten, Wachstum, KI | js/data/city.js | `CITY` |
| Ressourcenkette der Flussanzeige (welches Werk macht aus was was) | js/data/city.js | `CITY.chain` (Regel 11 der `CLAUDE.md`) |
| Straßentransport: Kapazität je Straßenzelle, Pendler, Stau-Glättung | js/data/city.js | `CITY.transport` (`cap`, `mapCap`, `maxLanes` (Spuren mehrspuriger Straßen), `commute`, `smooth`) |
| Straßentransport: längster Lieferweg, Anschlusslänge der KI | js/data/city.js | `CITY.transport` (`maxDist`, `connectMax`) |
| Werkslager: Ausgangslager je Werk, Anteil des Ausstoßes, Art der Werke, die LKW abholen | js/data/city.js | `CITY.pickup` (`cap`, `share`, `kinds`) |
| KI-Pendler am Werk | js/data/ai.js | `WORK_SOURCE_NEAR`, `WORK_SOURCE_TRUCKS`, `WORK_SOURCE_MIN_RATE` (`WORK_SOURCE_*`) |
| Gewerbe-Absatz: Steuer je Arbeiter, Baumaterial-Bedarf, Anteil ohne Versorgung, eigene Nachfrage | js/data/city.js | `CITY.taxCom`, `CITY.shop` (`need`, `base`, `per`) |
| Kerosin: Startvorrat im Stadtlager, Markt | js/data/city.js | `CITY.startKero`, `CITY.market` |
| Heliport als Landeplatz: Start- und Landezeit, Luftraumsperre mit/ohne Tower, Heimflug-Reserve (Tanken aus Kerosintank/Munitionslager wie die Jets) | js/data/city.js | `CITY.air.heli` (Lager-Raten `CITY.air.tank`, `CITY.air.depot`) |
| Preis, Baumaterial, Größe, Strom, KI-Zielwert einer Stadtzellenart (z. B. Güterbahnhof) | js/data/citykinds.js | Eintrag in `CITY_KINDS` (`cost`, `bm`, `size`, `power`, `target`, …) |
| Preis, Baumaterial, Größe, Strom, KI-Zielwert: abgeleitete Werte | js/data/citykinds.js | `CITY.cost`, `CITY.costBm`, `CITY.size`, `CITY.power.use`, `CITY.ai.targetValue` werden aus `CITY_KINDS` abgeleitet (z. B. Kerosin-Raffinerie) |
| Name, Farbe, Symbol, Tipp, Baumenü-Gruppe einer Stadtzellenart (z. B. Güterbahnhof, Kerosin-Raffinerie) | js/data/citykinds.js | Eintrag in `CITY_KINDS` (`name`, `short`, `icon`, `color`, `tip`, `group`, …) |
| Ertrag, Marktpreise, Name, Kürzel, Farbe einer Ware (Stahl, Kerosin …) | js/data/goods.js | Eintrag in `GOODS` (`yield`, `sell`, `buy`, …); `CITY.yield`, `CITY.market.sell/buy` werden daraus abgeleitet |
| Einfuhrpreis je Rohware (Rohmaterial, Eisen, Öl, Sprengstoff): Geld je angekommener Einheit | js/data/goods.js | Eintrag in `IMPORTS` (`price`); `CITY.import.price` wird daraus abgeleitet |
| Preisregel der Einfuhr (Rohwaren je Werk und Einheit Produkt) | js/data/goods.js | Preisregel (`test/config.test.js`): Rohwaren je Einheit Produkt ≥ Marktverkauf je Einheit und ≤ die Hälfte des Kaufpreises, je Werk (`IMPORTS`, `price`) |
| Bedarf je Werk (Rohwaren je Einheit Produkt), Ausbeute je Werk | js/data/city.js | `CITY.chain.<Werk>.need` (Rohware → Menge) und `to` (Ware); Ausbeute je Arbeiter `GOODS.yield` |
| Einfuhr: Durchsatz des Güterbahnhofs je Stufe, Straßendurchsatz | js/data/city.js | `CITY.import.station` (je s und Stufe, alle Rohwaren zusammen), `CITY.transport.cap`, `maxLanes` (Straßen) |
| Einfuhr: Baukosten Gleis und Güterbahnhof | js/data/citykinds.js | Baukosten Gleis und Güterbahnhof in `js/data/citykinds.js` (`rail`, `station`) |
| Wetter, Häuserkampf, Kisten, Kommandeur, Formationen, Fluss, Tiere, Wracks, Tarnung, Flugabwehr | js/data/balance.js | `weather`, `garrison`, `crates`, `commander`, `formation`, `river`, `animals`, `scars`, `stealth`, `airFire` |
| Kartengröße | js/data/balance.js | `BALANCE.map` (Vorsicht: ändert alle Karten und Tests) |
| Aufbau der Zufallskarte (Hügel, Seen, Fluss, Stadt, Häuser, Felder, Kisten-Abstände) | js/data/mapgen.js | `MAPGEN.<abschnitt>` (ändert alle Zufallskarten) |
| Fliegerhorst: Bahnlänge/-breite, Sperrzeit mit/ohne Tower, Umkreise, Schutz der Stellplätze, Kerosintank/Munitionslager | js/data/city.js | `CITY.air` |
| Fliegerhorst: Ausbaukosten der Stellplätze | js/data/city.js | `CITY.air` (`upgrade`) |
| Bagger: Arbeitszeit je Zelle, Reichweite | js/data/balance.js | `BALANCE.excavator` (Einheit `UNITS.excavator`) |
| Kampfflugzeuge: Wendigkeit, Kreisen, Heimweg-Reserve, Tanken/Nachladen, Flughöhe | js/data/balance.js | `BALANCE.jets` (Werte der F-16: `UNITS.f16`) |
| Größe der Großbauten (Kraftwerk, Kaserne, Fabrikhalle, Universität, Fliegerhorst-Bausteine) | js/data/citykinds.js | Feld `size` (im Code `CITY.size`) |
| Bauland um die Startpunkte (keine Bäume, Felsen, Gehöfte) | js/data/mapgen.js | `MAPGEN.general.buildLand`, `MAPGEN.terrain.spawnFlat` |
| Kurznamen in der Befehlskarte | js/data/units.js, js/data/buildings.js | `short` |
| Standards im Startmenü (Schwierigkeit, Schalter) | js/data/balance.js | `BALANCE.menuDefaults` |
| Takt, Startaufstellung, Warnabstände (Basis, Engpass) | js/data/balance.js | `BALANCE.tickRate`, `startLayout`, `baseAttackWarn`, `shortageWarn` |
| Tempo leerer Fahrzeuge, Abrisserstattung, Zielsuche, Ressourcennamen | js/data/balance.js | `BALANCE.fuelSlowMul`, `demolishRefund`, `scanInterval`, `resNames` |
| Baugebiet der Stadt (Schalter im Startmenü): Radius der FOB-Gebiete, Abstand zum Feind, Konfliktzone | js/data/city.js | `CITY.build` (`fobClaim`, `enemyR`, `noZone`); Regel in `buildWhy` (`js/game/city/cells.js`) |
| Baugebiet der Stadt in der Eroberung | js/data/city.js | Eroberung: Stadt immer nur im eigenen Viertel, auch ohne Schalter (`canZone`); `CITY.build`, `buildWhy` (`js/game/city/cells.js`) |
| Weitere Stadt-Abschnitte (Gebiet, Einwohner, Wachstum, Kosten, Nachfrage, Ruinen, Abriss, Startwerte) | js/data/city.js | `CITY.cell`, `territory`, `flee`, `happy`, `housing`, `jobs*`, `immigration`, `startPop`, `taxPop` |
| Weitere Stadt-Abschnitte: Wachstum, Nachfrage, Ruinen | js/data/city.js | `CITY.growTime`, `upgradeTime`, `ruinTime`, `maxLevel`, `demand`, `metalCost`, `bountyBm` |
| Weitere Stadt-Abschnitte: Abriss, Startwerte | js/data/city.js | `CITY.startMetal`, `startStock`, `fobMargin`, `clearable`, `retired` |
| Teamnamen und -farben | js/data/balance.js | `BALANCE.teamNames`, `BALANCE.teamColors` |

Danach: PRD-Text und Hilfetexte (`js/ui/helptext.js`, Spielhinweise des Startmenüs in `js/ui/menu/start-html.js`) auf die alte Zahl durchsuchen und anpassen (Regel 7 der `CLAUDE.md`).
