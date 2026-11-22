# Symbol-Index ui (Teil 1 von 2, citypanel.js bis stats.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/ui/`. Pfade relativ zu `js/ui/`.

## citypanel.js (15 KB)
- CITY_COLORS – Werkzeuge, Farben, Symbole, Kurznamen, Tipps und Gruppen des Baumenüs kommen se…
- CITY_ICON
- CITY_TIP – Tipp je Werkzeug (Text; Tipps mit Zahlen rechnet das Register aus CITY)
- TOOL_GROUPS – Werkzeuge in Gruppen: [[Gruppe, [Werkzeug …]] …] (ohne nicht mehr baubare Arten)
- class CityPanel
  - constructor(parent, game, team, onMessage, onShow, onTrade)
  - mark()
  - fold(on) – Menü einklappen (Baumodus bleibt, mehr Platz auf dem Bildschirm) oder wieder au…
  - toggle(on)
  - cell(wx, wy) – Zelle unter einem Weltpunkt, auf die Karte begrenzt
  - hoverAt(wx, wy) – Vorschau (Paket „Pflaster“): Zelle bzw. Großbau-Quadrat unter dem Mauszeiger, n…
  - begin(wx, wy)
  - move(wx, wy)
  - cancel()
  - end(wx, wy)
  - update(force)
  - destroy()
- class MarketPanel
  - constructor(parent, game, team, onMessage)
  - toggle(on) – Öffnen (nur mit fertigem Markt, sonst Hinweis) oder schließen
  - update(force)
  - destroy()

## controller.js (27 KB)
- UI_MODES – für Tests
- class Controller
  - constructor(game, team, camera)
  - message(text)
  - issue(cmd) – Befehl an game.issue; bei Fehler Grund als Meldung
  - setMode(mode)
  - setDragBox(rect)
  - noteEvent(ev)
  - selected() – Eigene lebende Auswahl: erst Einheiten, dann Gebäude
  - selectionCenter()
  - homeBase() – Erste fertige eigene FOB (Hauptstadt) oder null
  - pick(wx, wy, pred) – Nächste passende Entity an Weltpunkt: zuerst Einheiten, dann Gebäude (Fußabdruc…
  - pickIso(wx, wy, pred) – Isometrisch: Einheiten nach Bildschirmabstand (mit Flughöhe), dann Gebäude (Bod…
  - pickB(wx, wy, pred) – Gebäude unter dem Weltpunkt (Fußabdruck) oder null
  - pickHouse(wx, wy, pred) – Stadthaus (nicht eingestürzt) unter dem Weltpunkt oder null
  - pickBridge(wx, wy, pred) – Brücke unter dem Weltpunkt (Fahrbahn mit Fangradius), die pred erfüllt, oder nu…
  - pickCrate(wx, wy) – Versorgungskiste am Boden unter dem Punkt (nur bekannte: in Sicht oder im Lageb…
  - pickCity(wx, wy) – Eigenes fertiges Stadtgebäude unter dem Weltpunkt (seit v4.94 wählbar) oder null
  - dropCity() – Stadtgebäude aus der Auswahl nehmen (sie lassen sich nur einzeln wählen)
  - selectHouse(h, add) – Eigene Besatzer des Hauses wählen (Klick aufs eigene besetzte Haus)
  - selectedUnits() – Gewählte eigene Einheiten (ohne Gebäude)
  - selectAt(wx, wy, add) – Klick auf eigene Entity wählen (eigenes besetztes Haus: seine Besatzer); ohne T…
  - selectBox(rect, add) – Rahmenauswahl (Bildschirmkoordinaten): nur eigene Einheiten
  - selectNextBuilder() – Seit v4.95: wählt das nächste eigene Baufahrzeug (builder 'all') und gibt es zu…
  - selectSameType(id) – Alle eigenen Einheiten dieses Typs im sichtbaren Ausschnitt
  - clear()
  - cancel() – Esc: laufenden Modus beenden, sonst Auswahl aufheben
  - assignGroup(n)
  - selectGroup(n) – Gruppe wählen
  - leftClickWorld(wx, wy, shift, pointer) – Linksklick auf die Welt, je nach Modus: Platzieren, Ziel, Auswahl (mit Doppelkl…
  - rightClick(wx, wy) – Rechtsklick: Bewegen, Angriff (auf Gegner), Sammelpunkt (nur Gebäude gewählt) –…
  - orderOnOwnBuilding(b, units) – Rechtsklick auf eigenes Gebäude
  - moveMarker(x, y, slots) – Zielmarke; slots = Zielplätze der einzelnen Einheiten (Formation), als Punkte g…
  - cycleFormation() – Nächste Formation (Locker → Linie → Keil → Kolonne)
  - builderIds(type) – IDs der gewählten Bauer, die `type` bauen dürfen (Baufahrzeug: alles, Infanteri…
  - carriedFor(type) – Bauen nur Soldaten (zahlen aus getragenem Baumaterial, nur im Bauradius einer F…
  - updatePointer(wx, wy) – Vorschau aktualisieren: Hover-Ziel, Platzierung, Mauerzug
  - startBuildMenu()
  - startAttackMove()
  - startTruckMode(mode) – LKW-Modi: 'loadFob' (L), 'unloadFob' (U), 'routeFrom' (T, Start-FOB oder Werk)
  - stop()
  - train(unit) – Ausbildung auf allen gewählten fertigen Gebäuden, die diesen Typ bauen
  - cancelTrain()
  - demolish()
  - hint() – Kurzer Hinweistext für den aktuellen Modus (leer im Normalbetrieb)
  - handleHotkey(key) – Taste (bereits groß geschrieben, "Entf" für Entf) auf die Befehlskarte anwenden

## flowpanel.js (14 KB)
- class FlowPanel
  - constructor(parent, game, team)
  - toggle(on)
  - setTab(tab) – Reiter wechseln: 'res' (Fluss der Waren) oder 'money' (Einnahmen und Ausgaben)
  - sampleMoney() – Kassenbuch je Sekunde Spielzeit merken (auch geschlossen), MONEY_WINDOW s lang
  - moneyHtml() – Reiter „Geld“: Einnahmen nach Quelle und Ausgaben nach Zweck, je s (letzte MONE…
  - update(force) – Jedes Bild: Messung (auch geschlossen, damit der Verbrauch beim Öffnen schon da…
  - draw(f) – Graph als SVG: Spaltenköpfe, Linien (Breite = Menge je s), Knoten
  - destroy()

## helptext.js (29 KB)
- KEYS

## hud.js (0.8 KB)
- Hud (aus core.js) – DOM-HUD (docs/archiv/verlauf.md §5 ui/hud.js, §11.4): Ressourcen, Punkte, Zone,…

## input.js (15 KB)
- class Input
  - constructor({ canvas, minimap, camera, controller, hud = null, app = {} })
  - destroy()
  - reset()
  - pos(e, el) – Zeigerposition relativ zum Element (CSS-Pixel)
  - update(dt) – Kamera-Bewegung pro Frame: Pfeile und Randscrollen
  - rightAt(wx, wy)
  - pinchStep() – Zwei Finger: Zoomen (Abstand) und Verschieben (Mittelpunkt)
  - onCanvasDown(e)
  - onMove(e)
  - onUp(e)
  - onWheel(e)
  - minimapWorld(e)
  - minimapGo(e)
  - onMinimapDown(e)
  - jump() – Leertaste: Auswahl, sonst letzte Meldung, sonst Hauptstadt
  - nextBuilder() – J / Knopf „Bauer“: nächstes Baufahrzeug wählen und Kamera darauf
  - goHome()
  - selectGroupKey(n) – Gruppentaste: zweimal kurz hintereinander = Kamera auf die Gruppe
  - onKeyDown(e)

## match.js (9.5 KB)
- matchStart() – Gewertete Partie beginnen: liefert { token, w0 } eines verwendbaren Tokens aus…
- matchResume(m) – Eine gespeicherte gewertete Partie fortsetzen (meta.match des Standes, { token,…
- matchReady() – Wie viele gewertete Partien sofort möglich sind (Anzeige im Startmenü)
- matchPending() – Wie viele Endstände noch auf die Verbindung warten (für das Konto, das angemeld…
- matchSync() – Vorrat auffüllen und vorgemerkte Endstände schicken: beim Anmelden, beim Öffnen…
- gameInfo(game, difficulty, human) – Partie-Infos für die Statistik aus dem Endstand (game: die Partie, human: Team…
- finishMatch(token, wallet, game) – Gewertete Partie beenden: meldet den Endstand zum Token
- matchStats() – Spielstatistik des Kontos (api/match.php „stats“): Kennzahlen und die letzten P…

## menu.js (1.5 KB)
- hideOverlay (aus common.js) – Overlay-Menüs (docs/archiv/verlauf.md §5 ui/menu.js): Start, Pause, Hilfe, Ende
- readLowRes (aus prefs.js)
- takeAccountLink (aus account.js)
- wireAccount (aus account.js)
- showStartMenu (aus start.js)
- showPause (aus pause.js)
- showHelp (aus help.js)
- showEnd (aus end.js)

## perfmeter.js (6.9 KB)
- WINDOW_MS – Fenster der Mittelwerte (ms)
- INPUT_KEEP – Zahl der letzten Eingaben für Mittel und Höchstwert
- fmtMs(v) – Zahl für die Anzeige mit deutschem Komma
- class PerfMeter
  - constructor()
  - reset() – Alle Messwerte verwerfen (beim Einschalten)
  - addSim(ms, steps) – Simulationszeit des laufenden Bildes (Summe aller update-Schritte) und Schrittz…
  - addRender(ms) – Zeichenzeit des Renderers für das laufende Bild (gesamt)
  - add(layer, ms) – Zeit einer Ebene zum laufenden Bild addieren (mehrfach aufrufbar)
  - lap(layer, t) – Ebene messen: t = Zeit am Anfang der Ebene; liefert die Zeit am Ende (Anfang de…
  - input(ts) – Eingabe (pointerdown, keydown) mit ihrem event.timeStamp; wartet auf das nächst…
  - endFrame({ now, simMs = 0, steps = 0, renderMs = 0 }) – Ende eines Bildes (aus der Schleife): now = rAF-Zeitstempel am Bildbeginn, simM…
  - summary(now) – Auswertung der Bilder der letzten 2 s bis now (Standard: letztes Bild)
- formatPanel(s, info) – Textzeilen des Messfelds aus einer Auswertung (summary) und den Angaben zur Par…
- class PerfPanel – Textfeld oben links unter der Kopfleiste (nur Anzeige, keine Klicks)
  - constructor(parent, meter, info)
  - update(now)
  - destroy()
- watchInput(meter, target) – Eingaben auf dem Fenster melden (pointerdown, keydown ohne Wiederholung)

## researchpanel.js (12 KB)
- class ResearchPanel
  - constructor(parent, game, team, onMessage)
  - start(key) – Forschung starten oder einreihen (nur die Hauptstadt forscht; Grund sonst als M…
  - toggle(on)
  - firstPick() – Beim Öffnen gewählt: laufende Forschung, sonst die erste, die jetzt ginge, sons…
  - state(key) – Zustand: done · cur · queued (Platz) · ok (jetzt möglich) · poor (nur Geld fehl…
  - update(force)
  - queueHtml() – Warteschlange: laufende Forschung mit Balken und Restzeit (queueLive), dahinter…
  - queueLive() – Balken und Restzeit der laufenden Forschung, ohne die Knöpfe neu zu bauen
  - infoLive() – Grund (z. B. „Fehlt: 37 Geld“, ändert sich mit dem Geld) als Text und Knopf-Too…
  - infoHtml()
  - destroy()

## saves.js (22 KB)
- NAME_MAX
- MATCH_URL – Match-Start (MS1, ui/match.js), gleiche Sitzung
- remoteMeta(meta) – Meta für den Webspace: ohne `match`
- mergeSaves(localMetas, remoteMetas, tombs) – Vereinigung lokal + Webspace: je id gewinnt der neuere updatedAt (bei Gleichsta…
- syncPush(localMetas, remoteMetas, tombs) – ids, die beim Abgleich zum Webspace hochzuschicken sind: lokal neuer oder dort…
- defaultName(date) – Standardname „Partie TT.MM.JJJJ HH:MM“ (Ortszeit)
- copyName(name) – Name der Kopie „<Name> (Kopie)“, auf NAME_MAX Zeichen gekürzt
- cleanName(name) – Name prüfen wie der Server: getrimmt, 1 bis 60 Zeichen
- newSaveId(c) – Neue UUID (v4) für einen Stand
- fromLegacy(old, id) – Alter Einzelstand (Version 1: meta.savedAt) als neuer Stand
- setRemoteEnabled(on) – Webspace ein- oder ausschalten (KO3 ruft es nach Anmelden und Abmelden)
- remoteEnabled() – Ist der Webspace eingeschaltet (angemeldet oder noch nicht geprüft)?
- apiRequest(url, body) – Anfrage an eine API-Adresse (Cookie wird mitgeschickt), z. B. ACCOUNT_URL mit {…
- accountRequest(body) – Anfrage an api/auth.php (Konto)
- setNickname(nickname) – Nickname im Konto setzen (leer oder null = keiner; seit KO4)
- premiumHistory() – Premium-Historie des angemeldeten Kontos (seit KO4), neueste zuerst: [{ plan, p…
- requestDeactivate() – „Konto löschen“ (seit KO4): schickt die Bestätigungsmail, das Konto wird erst n…
- accountUser() – Wer ist angemeldet? Fragt api/auth.php „me“ und stellt den Webspace entsprechen…
- accountEmail() – E-Mail des angemeldeten Kontos (null ohne Anmeldung)
- noteWallet(value) – Kassenstand, den ein Vorgang gemeldet hat (Wertung, Vorrat): ganzzahlig, 0 bis…
- setAccount(user) – Anmelden (user aus auth.php) oder Abmelden (null): merkt die Kasse und schaltet…
- accountWallet() – Kasse des angemeldeten Kontos in Geld; null für Gäste (und solange die Anmeldun…
- resetWallet() – „zurücksetzen“ im Startmenü: die Kasse des Kontos auf den Startbetrag setzen
- listSaves() – Alle Stände (lokal und Webspace), neueste zuerst
- loadSave(id) – Einen Stand laden: der neuere von Gerät und Webspace (ein neuerer Webspace-Stan…
- storeSave(rec) – Speichert einen Stand (rec = { meta, bytes }) lokal und auf dem Webspace
- renameSave(id, name) – Umbenennen (Name 1 bis 60 Zeichen)
- deleteSave(id) – Löscht einen Stand lokal und auf dem Webspace; ist dieser nicht erreichbar, wir…
- syncUp() – Abgleich nach dem Start oder nach Offline-Spielen: Löschungen nachholen, neuere…
- describe(meta, source) – Eine Zeile für die Anzeige: Spielzeit, Punkte (Eroberung: Tickets) aller Teams,…

## stats.js (3.6 KB)
- hm(sec) – Spielzeit in Sekunden als „12 min“ oder „2 h 05 min“
- statsHtml(st) – HTML der Spielstatistik aus der Antwort von matchStats(): Kasse, Kennzahlen und…
