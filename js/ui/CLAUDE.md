# js/ui/ – Steuerung, HUD, Fenster (DOM)

Ändert das Spiel nur über `game.issue(team, cmd)`; die Befehlskarte (`controller/`) hat kein DOM. Texte deutsch. Menüs: `menu/` (eigene CLAUDE.md).

- `controller.js` – Auswahl, Klicks, Tasten; hängt die Mixins aus `controller/` an. `Controller`, `UI_MODES`
- `controller/cards.js` – Befehlskarte und Gründe für gesperrte Schaltflächen. `cardMethods`, `costText`
- `controller/targets.js` – Bestätigung der Ziele und Platzierung. `targetMethods`
- `controller/modes.js` – Modustabelle (Hinweis, Klick, Vorschau je Zielmodus); eigene Datei gegen Importzyklen. `MODES`
- `controller/util.js` – gemeinsame Hilfen der Befehlskarte. `WALL_MAX`, `isCarrier`
- `input.js` – Maus, Tastatur, Touch. `Input`
- `hud.js` – Einstieg der DOM-Anzeige, nur Re-Export. `Hud`
- `hud/core.js` – Aufbau, Klicks und Takt der Anzeige. `Hud`
- `hud/top.js` – Kopfleiste (Geld, Lager, Wetter, Punkte). `topMethods`
- `hud/info.js` – Infofeld der Auswahl. `infoMethods`
- `hud/cityinfo.js` – Stadt-Infofeld. `cityInfoMethods`
- `hud/commands.js` – Befehlskarte als Schaltflächen. `commandMethods`
- `hud/messages.js` – Meldungen am Rand. `messageMethods`
- `hud/common.js` – Konstanten und Helfer der Anzeige. `esc`, `bar`, `gauge`, `fmtRate`
- `citypanel.js` – Baumodus der Stadt (Werkzeugleiste) und Marktfenster. `CityPanel`, `MarketPanel`
- `flowpanel.js` – Ressourcenanzeige: zeichnet den Fluss aus `game/flow.js`. `FlowPanel`
- `researchpanel.js` – Fenster des Forschungsbaums mit Warteschlange. `ResearchPanel`
- `helptext.js` – Tastenliste der Hilfe, Zahlen aus den Daten, kein DOM. `KEYS`
- `status.js` – lesende Texthilfen (Auftragstext, FOB-Namen); Bauzustand liegt in `game/construction.js`. `orderText`, `fobLabel`
- `saves.js` – Spielstände lokal (IndexedDB) und auf dem Webspace, Konto-Anfragen, Kasse. `listSaves`, `storeSave`, `loadSave`, `apiRequest`
- `match.js` – signierter Match-Start und Endstand (Token, kein DOM). `matchStart`, `finishMatch`, `matchSync`
- `stats.js` – Spielstatistik des Kontos als HTML, kein DOM. `statsHtml`, `hm`
- `telemetry.js` – Besucherstatistik: Ereignisse, Herzschlag, Fehler, Feedback, Einwilligung (kein Spielzustand). `installTelemetry`, `getTelemetry`, `createTelemetry`
- `perfmeter.js` – Messanzeige (F3, `?perf=1`): Messung ohne DOM, Textfeld getrennt. `PerfMeter`, `PerfPanel`, `watchInput`
- `menu.js` – Einstieg der Overlay-Menüs, nur Re-Exporte aus `menu/`. `showStartMenu`, `showPause`, `showHelp`, `showEnd`

## Besonderheiten
- Mixins: `Object.assign(Hud.prototype, …)` bzw. `Controller`; die Gruppen importieren `core.js` nicht (kein Zyklus).
- Die Hilfe liest Zahlen und Tasten aus den Daten; bei Regeländerungen auch die Spielhinweise des Startmenüs (`menu/`) mitpflegen.
- Neuer Befehl mit Ziel auf der Karte: Zeile in `MODES` plus `confirmX` in `targets.js`.

Exporte dieses Ordners: `docs/index/ui.md`, Unterordner `ui-hud.md`, `ui-controller.md`, `ui-menu.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
