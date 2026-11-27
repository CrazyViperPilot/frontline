# Feature-Landkarte

Ausgelagert aus `ARCHITEKTUR.md` §9 (Platz; Test `test/featuremap.test.js`: höchstens 20 000 Bytes, 250 Zeichen je Zeile).
Wo jedes Feature liegt. Werte: Tabelle „Wo ändere ich was?“ in `docs/wo-aendern.md` und das Inhaltsverzeichnis in `js/data/balance.js`. Dateilisten je Ordner: `CLAUDE.md` im Ordner (`ARCHITEKTUR.md` §7).
Neues Feature: hier eine Zeile ergänzen (höchstens 200 Zeichen: Name, PRD-Datei, Hauptmodul, Test).

| Feature | PRD (`docs/prd/<name>.md`) | Hauptmodul (unter `js/`, sonst ab Wurzel) | Weitere | Test (`test/<name>.test.js`) |
|---|---|---|---|---|
| Spielzustand, Befehle, Sieg, Endstatistik | `PRD.md` | `game/game.js` | Bild `ui/menu/end.js` | `game`, `stats` |
| Ausbildung, Einheitenlimit, Nachschub, Einkommen | `ressourcen-bau` | `game/economy.js` | KI `ai/army/produce.js` | `economy` |
| Eroberung (Flaggen, Tickets, Viertel-Sperre) | `eroberung` | `game/conquest.js` | KI `ai/army/conquest.js`; Bild `render/layers/zones.js` | `conquest` |
| Feste Karten, eigene Flaggen, Seiten-Baugebiete | `feste-karten` | `data/maps/index.js` | `game/mapdata.js`, `game/conquest.js`; Bild `render/landmarks.js` | `fixedmaps` |
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
| Scharfschütze, Tarnung, Liegen und Beobachten, Tarnanzug nach Umgebung | `einheiten` | `game/game.js` `sees` | `game/commands.js` `cmdSniper`; Bild `render/units/camo.js` | `sniper` |
| Kommandeur | `einheiten` | `game/commander.js` | – | `commander` |
| Bagger | `einheiten` | `game/excavator.js` | Bild `render/fx.js` | `fx` |
| U-2 Höhenaufklärer | `einheiten` | `game/aircraft.js` | KI `ai/army/combat.js` | `u2` |
| Nebel und Sicht | `zone-gelaende` | `game/fog.js` | Bild `render/layers/fog.js` | `terrain`, `fogpaint` |
| Gelände: Höhe, Hänge, Seen | `zone-gelaende` | `game/relief.js` | Bild `render/ground.js` | `relief`, `terrain` |
| Fluss, Brücken, Furten | `zone-gelaende` | `game/river.js` | Bild `render/bridge.js` | `river` |
| Natur: Bäume, Büsche, Felsen | `zone-gelaende` | `render/nature.js` | `render/layers/relief.js` | `nature` |
| Versorgungskisten | `zone-gelaende` | `game/crates.js` | KI `ai/army/logistics.js`; Bild `render/props.js` | `crates` |
| Props: Zäune, Militär, Industrie, Raffinerie, Zivil, Kriegsspuren (Sperren je Klasse, Deckung, Sicht) | `zone-gelaende` | `game/props.js` | Werte `data/props.js`; Bild `render/mapprops.js` u. a. | `mapprops` |
| Hohe Mauern halten Direktfeuer auf (Betonmauer, Hesco, Mauer, Tor; Steilfeuer darüber, Panzer und Panzerabwehr brechen durch) | `zone-gelaende` | `game/walls.js` | `game/combat.js`, `game/props.js` | `walls` |
| Feldstellungen bauen, KI gräbt sich ein | `zone-gelaende`, `ki` | `game/fieldwork.js` | KI `ai/army/cover.js`; Werte `PROPS.field`, `FIELD_*` | `fieldwork` |
| Häuserkampf | `haeuserkampf` | `game/garrison.js` | KI `ai/army/combat.js`; Bild `render/layers/garrison.js` | `garrison`, `housefight` |
| Festung: Gefechtsturm, Dachaufbau | `ressourcen-bau` | `game/tower.js` | KI `ai/army/build.js` | `tower`, `fortress-ai` |
| Wetter und Jahreszeiten | `wetter-forschung` | `game/weather.js` | Bild `render/weatherfx.js` | `weather` |
| Lichtstimmung | `wetter-forschung` | `render/mood.js` | – | `mood` |
| Forschungsbaum | `wetter-forschung` | `game/research.js` | `game/abilities.js`; UI `ui/researchpanel.js` | `research` |
| Zufallskarte, Gehöfte, Felder | `zone-gelaende` | `game/map.js` | `game/landscape.js`; Bild `render/terrain.js` | `map`, `golden` |
| Wracks und Krater, Tiere (nur Optik) | `steuerung-oberflaeche` | `game/scars.js` | `game/animals.js`; Bild `render/nature.js` | `scars`, `animals` |
| Karteneditor, gespeicherte Karten | `steuerung-oberflaeche` | `editor/editor.js` | `game/mapdata.js` | `mapdata` |
| Pflaster: Plätze, Bürgersteige; Bauvorschau im Editor | `steuerung-oberflaeche` | `render/paving.js` | `editor/editor.js`, `game/mapdata.js` | `mapdata` |
| Stadt (Gebiet, Einwohner, Strom, Ausbildung, Pflege) | `stadt` | `game/city/economy.js` | KI `ai/city/build.js`, `ai/city/grow.js`; UI `ui/citypanel.js` | `city`, `buildrules` |
| Anschlusspflicht ans Straßennetz, Straßennetz der Stadt-KI | `stadt` | `game/city/cells.js` | `game/city/roadnet.js`; KI `ai/city/roads.js` | `buildrules`, `citynet` |
| Großbauten mit gerader Kante | `stadt` | `game/city/cells.js` | KI `ai/city/need.js`; Bild `render/bigbuild.js` | `city`, `bigbuild` |
| Aussehen der Stadtgebäude, Baustellen, Ruinen | `stadt-aussehen` | `render/townhouses.js` | Bild `render/works.js`, `render/citysite.js` | `citysite` |
| Materialfotos auf Wänden und Dächern (Ziegel, Putz, Beton, Blech, Holz) | `stadt-aussehen` | `render/materials.js` | Fotos `textures/`, `render/isokit.js` | `assets` |
| Stadtstraßen der Karte | `stadt-transport` | `game/roads.js` | Bild `render/citylayer.js` | `city` |
| Straßentransport, Stau, Pendler, Versorgung der Ausbildung | `stadt-transport` | `game/transport.js` | Bild `render/citylayer.js` | `transport`, `supply` |
| Straße zum Lager (Knopf am Stadtgebäude) | `stadt-transport` | `game/city/commands.js` | Weg `game/city/roadnet.js` `connectPath` | `cityconnect` |
| Lagerhalle (füllt sich über die Straße, LKW laden, Nachfüllen) | `stadt-transport` | `game/city/economy.js` `fillWarehouses` | `game/logistics.js`; Bild `render/bigbuild.js` | `warehouse` |
| Straßen zerstören und räumen | `stadt-transport` | `game/roadwar.js` | `game/excavator.js`; KI `ai/army/logistics.js` | `roadwar` |
| Wirtschaftsanzeige (Reiter Ressourcen, Geld) | `stadt-wirtschaft` | `game/flow.js` | UI `ui/flowpanel.js` | `flow`, `ledger` |
| Kassenbuch (Einnahmen und Ausgaben je Grund) | `stadt-wirtschaft` | `game/ledger.js` | UI `ui/flowpanel.js` | `ledger` |
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
| 3D, Schatten | – | `render3d/renderer3d.js` | `sun3d.js` | `trees3d` |
| Effekte in 3D (Explosion, Leuchtspur, Geschoss, Rauch, Feuer) | – | `render3d/fx3d.js` | `renderer3d.js` `fx3dPass`; `render/fx.js` | `fx3d` |
| Großbauten 3D | – | `render3d/bigbuild3d.js`, `gov3d.js` | `town3d.js` | `kit3d` |
| Props in 3D (Zäune, Mauern, Militär, Industrie, Autos, Bänke, Ballen, Kisten) | – | `render3d/props3d.js` | `renderer3d.js` `prop3d` | `props3d` |
