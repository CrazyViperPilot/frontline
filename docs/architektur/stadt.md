# Architektur der Stadt: Simulationsschritt und Datenmodelle

Ausgelagert aus `ARCHITEKTUR.md` (§3 Schritt 3a, §5 Stadt und Straßentransport). Lesen, wenn es um `updateCity`, die Felder von `game.city[team]` oder den Straßentransport geht.
Dateiliste der Stadt: `js/game/city/CLAUDE.md`. Regeln: PRD §15 (`docs/prd/stadt*.md`).

## Schritt 3a: `updateCity` (`js/game/city/economy.js`)
Schritt 3a (`updateCity`) läuft in fester Reihenfolge der Phasen: Gebiet, Ruinen, Treffer, Einwohner, Wachstum, Wirtschaft, Pflege.
Einfuhr der Rohwaren: je Werk vom nächsten Einfuhrpunkt, bezahlt je angekommener Einheit, mit Durchsatz des Güterbahnhofs und Kassendeckel (`runWorks`).
Ketten (Werk → Lager) und Pendler laufen über die Straßenwege aus `transport.js`: `beginLoads` (Last auf 0), Flüsse und Pendler eintragen (`addLoad`),
Gutschrift mit der Wirkung des Weges (`pathEff`), `settleLoads` (Stau glätten, wirkt im nächsten Schritt). Wege werden nur neu gerechnet, wenn sich die Stadt
ändert (`c.ver`, auch bei Flucht und Rückkehr der Bewohner); der geglättete Stau-Faktor je Zelle liegt in `c.congestion` (gespeichert).

## Datenmodell Stadt (`game.city[team]`)
**Stadt** (`game.city[team]`, nur mit Stadt, angelegt in `js/game/city/create.js`): Raster `cols, rows, cell`, je Zelle `kind[]` (Index in `KINDS`), `level[]`, `flee[]`, `blocked[]`, `felled`,
`list` (belegte Zellen), `ver` (Zähler:
steigt bei jeder Änderung an Zellen, Wege werden dann neu gerechnet), `hitLog`, `mapRoads` (Stadtstraßen der Karte), Eroberung `own` (je Zelle 1 = eigenes Viertel; nur dort wird gebaut).
Vorräte im Stadtlager: `metal` (Stahl,
Schlüssel bleibt `metal`), `kero` (Kerosin). `stats` ist nur Anzeige: je Schritt neu gesetzt (eingeführte Rohwaren je s `raw` mit Geld je s `importCost` und je Rohware `importCostBy`,
`importScale` = Anteil der Einfuhr,
den das Geld zulässt, `importNone` = Werke ohne Einfuhrpunkt, `cap` = Leistung je Produkt, `inp` = Produkt-Gegenwert der angekommenen Rohware je s, `gross` = Ausstoß, `n` = fertige Gebäude je Art,
Gewerbe-Versorgung `shopSupply`,
`lost` = Waren ohne Weg je s, `jam` = kleinster Stau-Faktor).

## Straßentransport (`js/game/transport.js`)
**Straßentransport** (`transportOf(game, c)` in `js/game/transport.js`): Zustand je Stadtobjekt in einer `WeakMap` (`STATE`). Er enthält `routes` (Lieferweg je Werk zum Lager: Ziel, Weg, Länge),
`imports` (Einfuhrweg je Werk zum nächsten Einfuhrpunkt: `from` = `'edge'` für den Kartenrand oder Anker des Güterbahnhofs, Weg, Länge; `null` = keiner),
`stations` (Güterbahnhöfe mit Gleis zum Kartenrand),
`depot` (Wege zu Kerosintank und Munitionslager), `store` (Weg Lagerhalle ↔ Lager, Paket „Lagerhalle“), `commute` (Pendlerweg je Arbeitsstätte, `null` = keine Wohnung), `shop` (Weg Gewerbe und Markt zum Lager), `load`, `factor`,
`cap` je Stadtzelle und `list` (Straßenzellen).
Der Zustand liegt nicht im Objektgraphen und damit nicht im Spielstand; nach dem Laden wird er beim ersten Zugriff neu berechnet.
