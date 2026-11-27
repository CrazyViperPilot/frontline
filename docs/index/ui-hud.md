# Symbol-Index ui-hud

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/ui/hud/`. Pfade relativ zu `js/ui/hud/`.

## cityinfo.js (15 KB)
- cityInfoMethods
  - cityInfo(b) – Stadtgebäude (seit v4.94 antippbar): Stufe, Zustand, Wohn- oder Arbeitsplätze,…
  - trainInfo(g, c, b, k, lv) – Ausbildungsgebäude der Stadt: Typen, Fortschritt, Heliport- und Stellplatz-Zeil…
  - heliportInfo(g, c, b) – Heliport als Landeplatz: Hubschrauber, Luftraum, Kerosin und Munition in der Nä…
  - standInfo(g, c, b, lv) – Stellplatz: Schutz, Flugzeug, Weg zur Bahn, Kerosin und Munition in der Nähe
  - airInfo(g, c, b, k, lv) – Tower (Bahnen im Umkreis), Kerosintank und Munitionslager; für andere Arten leer
  - careInfo(c, lv, care) – Heilen und Reparieren: Zeile und Stahlwarnung
  - cityWarnings(c, i, k, s) – Warnungen am Ende: kein Anschluss, Strommangel, geflohene Bewohner
  - importText(c, i, k, lv, s) – Einfuhr eines Werks (Paket „Import“, nur lesen): je Rohware, was je s ankommt u…
  - stationText(g, c, i, lv) – Güterbahnhof (Paket „Import“, nur lesen): Durchsatz je s, also die Rohwaren all…
  - transportText(g, c, i, k, s) – Straßentransport eines Stadtgebäudes (AP5, nur lesen): Lieferziel und Weg, Stau…

## commands.js (2.5 KB)
- commandMethods
  - cmdHints() – Telefon quer: Schatten am linken/rechten Rand, wenn links bzw. rechts noch Knöp…
  - updateCommands() – Befehlskarte

## common.js (3.8 KB)
- WX_ICON – Wettersymbole (16 × 16, Strichfarbe = currentColor)
- WX_COLOR
- RES_KEYS – Kopfleiste: nur Geld (Paket „Kopfleiste“; die Front-Lager stehen in der Wirtsch…
- SHORT_RES – Kürzel der Lagersorten (Wirtschaftsanzeige: Front-Lager)
- MSG_LIFE – ms
- MSG_MAX
- DOM_EVERY – ms
- NEG_COLOR – Verbrauch (negative Netto-Rate)
- COLOR – Balken der Lager- und LKW-Sorten in der Farbe ihrer Ware (Register js/data/good…
- presetName(p) – Anzeige der Ladungsart: 'Gemischt', eine Sorte oder zwei Sorten mit ' + ' (z. B…
- STORE_CAP
- CAPITAL_CAP
- esc(s)
- pct(f)
- hpColor(f)
- fmtDe(v)
- bar(f, cls, color)
- fmtRate(v)
- fmtTime(s)
- gauge(label, val, max, color) – Zeile „Name · Balken · Zahl / Obergrenze“ (Einheiten: Munition, Treibstoff, Lad…
- storeRow(label, val, cap, color) – Lagerzeile einer FOB: Sorte, Balken, Zahl / Obergrenze

## core.js (11 KB)
- class Hud
  - constructor(root, game, team, controller, app)
  - template()
  - setFolded(on)
  - insets() – Von der HUD verdeckte Höhe oben und unten (CSS-Pixel), damit die Kamera Ziele i…
  - click(e)
  - update(force) – Aktualisiert alle Teile, höchstens alle 200 ms (außer force)
  - refresh()
  - destroy()

## info.js (14 KB)
- infoMethods
  - updateSelection()
  - updateSpawnPick(sel) – Eroberung: Auswahlliste „Neue Einheiten erscheinen“ für gewählte eigene Ausbild…
  - unitInfo(u) – Einzelne Einheit: HP, Vorrat (Munition/Treibstoff), LKW-Ladung, Auftrag
  - houseInfo(u) – Besatzer eines Stadthauses: Haus, Plätze, Zustand
  - worksInfo(h) – Ausbauten eines Stadthauses (Sandsäcke, MG-Nest, Stacheldraht) und der laufende…
  - heightInfo(u) – Standhöhe; zeigt der Zeiger auf einen sichtbaren Gegner, auch den Höhenvorteil…
  - buildingInfo(b) – Gebäude: FOB (Lager, Baustelle), Baustelle (Fortschritt, Status), Stadtgebäude,…
  - queueInfo(b) – Warteschlange: die ersten trainSlots Aufträge laufen gleichzeitig (Stadt: je St…
  - reinforceInfo(b) – Hauptstadt: Soldaten-Nachschub (Restzeit bis zum nächsten Schützen oder Ruhezus…
  - researchInfo(team) – Hauptstadt mit Forschung: Stufe, erforschte Verbesserungen, laufende Forschung…
  - drillInfo(b) – Bohrer: Phase und Restzeit
  - siteStatus(b) – Status einer Baustelle: Baufahrzeug/Bauer, sonst Fortschritt
  - multiInfo(sel) – Mehrfachauswahl: Anzahl je Typ, Einheiten ohne Munition/Treibstoff

## messages.js (1.0 KB)
- messageMethods
  - pushMessage(text, pos) – Meldung anzeigen (höchstens 5, je 6 s)
  - renderMsgs()
  - expire(now)

## top.js (7.6 KB)
- topMethods
  - updateTop()
  - updateResources(g, t) – Ressourcenfelder (Wert, Rate, Tooltip), Markt- und Forschungsknopf
  - updatePoints(g, cq) – Punktebalken je Team; Eroberung: verbliebene Tickets und gehaltene Flaggen
  - updateZone(g, t, cq) – Konfliktzone: Besitzer, Zahlen je Team, Flaggenleiste (Eroberung), Zonengeld un…
  - updateHot(g) – Hot Zone: Besitzer und Zahlen je Team
  - updateClock(g) – Uhr und Beschriftung der Knöpfe (Tempo, Pause, Ton, Ansicht)
  - weatherText() – Wetter in Worten: „Winter, Nebel: Sicht −35 %, Fahrzeuge −10 %“
  - updateWeather() – Wetteranzeige oben (Symbol und Name; nur neu, wenn sich etwas ändert)
