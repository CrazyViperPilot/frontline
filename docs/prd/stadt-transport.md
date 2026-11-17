# Frontline PRD – Stadt: Straßentransport

> Teil des PRD, Abschnitte §15 „Straßentransport“, „Werkslager“, „Import“. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 7. Konfliktzone & Punkte (Teil)

### Straßentransport

Die Straßen verbinden alles.
Werte: `CITY.transport`, `CITY.import`, `CITY.shop`, `CITY.yield`, `CITY.startKero`, `CITY.care.refuel` (`js/data/city.js`), Preise der Rohwaren in `js/data/goods.js`.
Logik: `js/game/transport.js` (Wege, Kapazität, Stau, ohne DOM;
Wege und Lasten liegen in einer WeakMap je Stadt und werden nicht gespeichert, der geglättete Stau-Faktor je Zelle `c.congestion` schon), die Rechnung in `updateCity` (`js/game/city/economy.js`).

- **Ketten** (Ware → Gebäude → Ziel; Rohwaren kommen von außen, siehe „Import“ in `stadt-wirtschaft.md`):
  - **Rohmaterial** (Einfuhr) → BM-Werk → **Baumaterial** → Lager der Hauptstadt.
  - **Eisen** (Einfuhr) → Stahlwerk → **Stahl** → Stadtlager.
  - **Eisen und Sprengstoff** (Einfuhr) → Munitionswerk → **Munition** → Lager der Hauptstadt.
  - **Öl** (Einfuhr) → Raffinerie → **Treibstoff** → Lager der Hauptstadt.
  - **Öl** (Einfuhr) → Kerosin-Raffinerie → **Kerosin** → Stadtlager (`c.kero`, Start `CITY.startKero` 300).
  Jedes Werk holt seine Rohwaren beim **nächsten** Einfuhrpunkt über Straßen (siehe „Einfuhr“); seine Ware fährt zum Lager.
- **Einfuhr (Paket „Import“):** Ein Werk fordert Rohwaren beim nächsten Einfuhrpunkt an, der über Straßen erreichbar ist.
  Der Weg ist der kürzeste Straßenweg; bei Stau weicht das Werk nicht aus.
  Weitere Randstraßen helfen deshalb nur Werken, für die sie näher liegen; mehrspurige Straßen oder ein Güterbahnhof mit Werken direkt daneben heben den Durchsatz.
  Einfuhrpunkte sind eigene Straßenzellen am Kartenrand und fertige Güterbahnhöfe mit Gleis zum Kartenrand (Regeln in `stadt-wirtschaft.md`).
  Die Rohwaren fahren als Last über den Weg, und was ankommt, wird bezahlt.
  Ein Werk ohne erreichbaren Einfuhrpunkt erzeugt nichts; das zeigt die Info des Werks („kein Einfuhrpunkt“) und die Ressourcenanzeige.
- **Direkte Lieferung:** Liegt ein Werk unmittelbar neben einem angeschlossenen Güterbahnhof, kommen die Rohwaren ohne Straße an (Weg der Länge 0, keine Last, keine Wirkung des Weges).
  Produkte fahren immer über Straßen zum Lager.
- **Ziel und Weg:** Ein Werk liefert seine Ware an das Lager der Hauptstadt; Rohwaren fahren vom Einfuhrpunkt zum Werk.
  Der Weg ist der kürzeste Weg über Straßenzellen (jede Zelle 1).
  Das Lager ist erreicht über Straßen, deren Zellrechteck das Rechteck der Hauptstadt (mit Rand `fobMargin + cell`) schneidet.
  Höchstens `CITY.transport.maxDist` = 260 Zellen.
  Anschluss: eine Straße an einer Seite des Gebäudes; Wohnen, Gewerbe und BM-Werk auch über ein direkt benachbartes Gebäude gleicher Art (Kette).
  Stadtstraßen der Karte zählen für alle Teams.
  Gleise, Bahn und Rollfeld tragen keine Waren und gelten für Wege nicht als Straße (seit dem Paket „Fliegerhorst-Anschluss“ für Wege, Anschluss und Wachstum gleich:
  `roadAt` in `js/game/city/cells.js` ist der einzige Begriff).
- **Kein Weg, keine Lieferung:** Eine Ware, die kein Lager erreicht, geht verloren, und das Werk arbeitet ins Leere.
  Ein Werk ohne Straßenweg zum Lager oder ohne Einfuhrpunkt fordert gar nichts an und kostet deshalb nichts.
  Die Info des Gebäudes sagt es („Kein Straßenweg zum Lager: die Ware geht verloren“; bei Werken außerdem „Keine Straße zum Kartenrand oder zu einem angeschlossenen Güterbahnhof: keine Rohwaren“),
  die Leiste zeigt „ohne Weg x/s“, die Flussanzeige „Waren ohne Straßenweg“ und „… erreichen keinen Einfuhrpunkt: keine Rohwaren“.
- **Kapazität und Stau:** Eine eigene Straßenzelle trägt `cap` = 24 Einheiten je s, eine Stadtstraße der Karte `mapCap` = 40. **Mehrspurig:** Straßen direkt nebeneinander bilden ein Band;
  jede Zelle darin trägt Kapazität × Spuren je Richtung (= Breite des Bandes, höchstens `maxLanes` = 4; Kreuzungen und Plätze zählen so viel wie ihre kleinere Ausdehnung, ebenfalls höchstens 4).
  Zwei Straßen nebeneinander tragen also 48 je Zelle, drei 72. Gemalt als eine breite Straße mit so vielen Spuren je Richtung, wie Zellen nebeneinander liegen:
  doppelte durchgezogene Mittellinie, gestrichelte Spurlinien, Zebrastreifen vor Kreuzungen, keine Gehwege zwischen den Zellen;
  Bänder breiter als 6 Zellen sind Plätze ohne Markierung (`laneGrid` in `js/game/roads.js`, Bild `laneMarks` in `citylayer.js`).
  Die Last einer Zelle ist die Summe aller Flüsse, deren Weg über sie führt (Rohwaren und Waren, Stahl, Munition, Gewerbe-Bedarf), plus Pendler.
  Stau-Faktor = min(1; Kapazität ÷ Last), geglättet über `smooth` = 2 s, aus den Lasten des vorigen Schritts (eine Runde Verzögerung).
  Die Wirkung eines Weges ist der kleinste Faktor darauf; eine Lieferung kommt mit Menge × Wirkung an.
  Der Einfuhrweg ist also der Engpass: Eine verstopfte Einfuhrstraße liefert weniger, auch wenn der Güterbahnhof mehr könnte.
  Die Wege werden neu gerechnet, sobald sich Gebäude, Straßen, die Hauptstadt oder bewohnte Wohnungen (Flucht, Rückkehr) ändern;
  der geglättete Stau-Faktor je Straßenzelle gehört zum Spielstand (Laden und Weiterspielen ergibt dasselbe wie ohne Unterbrechung).
- **Pendler:** Jede Arbeitsstätte (Werke, Gewerbe, Markt, Kraftwerk, Uni, Rechenzentrum,
  Güterbahnhof) schickt je Arbeiter `commute` = 0,05 Last je s über den Weg zur **nächsten bewohnten Wohnzelle** (Stufe ≥ 1, nicht geflohen).
  Staut sich dieser Weg, arbeiten die Arbeiter langsamer.
  Gibt es keine Wohnung über die Straße, arbeitet dort niemand.
- **Rechnung je Schritt:** Ein Werk mit Einfuhrweg fordert seine Rohwaren für seine Leistung an; sie fahren als Last über den Einfuhrweg, und was ankommt, wird bezahlt und verarbeitet.
  Das Produkt fährt zum Lager, mit der Wirkung des Weges.
  Das Munitionswerk verarbeitet Eisen und Sprengstoff aus der Einfuhr, nicht Stahl aus dem Lager.
  Ohne Lager (Hauptstadt zerstört) fordern Werke nichts an und stehen.
- **Gewerbe-Absatz:** Gewerbe und Markt brauchen **Baumaterial** aus dem Lager der Hauptstadt, über die Straße angeliefert (Weg Gewerbe ↔ Lager),
  `CITY.shop.need` = 0,004 je Arbeiter und s. Versorgung v = angeliefert ÷ Bedarf (0 … 1; ohne Weg oder leeres Lager 0).
  Steuer je Gewerbe-Arbeiter (0,07 Geld/s, `CITY.taxCom`) und sein Anteil an der Zufriedenheit wirken mit `base + (1 − base) × v` (`base` 0,3): ohne Versorgung zahlt es nur 30 %.
  So wird das Lager zur Senke für Überschüsse.
  **Eigene Nachfrage:** Gewerbe wächst (neue Stufe) nur, solange seine Arbeitsplätze höchstens so viele sind wie arbeitsfähige Einwohner × `shop.per` (0,25); Stufe 1 entsteht immer.
  **Nenner:** Die Läden in der Zufriedenheit teilen wie die Steuer durch die arbeitsfähigen Einwohner (`pool`), nicht durch alle Einwohner.
- **Versorgung der Ausbildung (Paket „Straßen“, Teil 2):** Kaserne, Fabrikhalle, Heliport und Stellplatz bekommen ihr Material über die Straße aus dem Lager der Hauptstadt.
  Ihr Weg ist der kürzeste Straßenweg zum Lager (wie bei Werken).
  Bahn und Rollfeld sind keine Straße: Ein Stellplatz hängt nur an der Bahn und braucht darum keinen Straßenweg;
  er und der Heliport werden versorgt, wenn ein Kerosintank oder Munitionslager mit Straßenweg im Umkreis steht (Weg 0, Versorgung 100 %, Paket „Fliegerhorst-Anschluss“).
  Kerosintank und Munitionslager brauchen selbst eine Straße zum Lager.
  **Versorgungsgrad** v = max(0,3; 1 − 0,006 × max(0; d − 15)), d = Straßenzellen des Wegs (bis 15 Zellen 100 %, bei 40 85 %, bei 80 61 %, ab 132 30 %; `CITY.supply` mit `free`, `perCell`, `min`).
  **Tempo** der Ausbildung = v × Stau-Faktor des Wegs; der Fortschritt jedes laufenden Platzes läuft mit diesem Tempo.
  **Ohne Weg 0 %:** Die Ausbildung steht (Aufträge gehen weiter, bezahlt wird wie bisher beim Auftrag: Geld, Stahl, Einwohner), das Gebäude trägt das rote X am Schild,
  die Info sagt „Kein Straßenweg zum Lager der Hauptstadt: Ausbildung steht“.
  Sonst nennt sie „Versorgung x % · Weg zum Lager d Felder (Entfernung v, Stau s)“.
  **Last:** Jeder laufende Platz legt Stahl je s (Stahlkosten der Einheit ÷ Ausbildungszeit × Tempo, `CITY.metalCost`) als Last auf den Weg; Soldaten kosten keinen Stahl und legen keine Last.
  Das Startviertel bekommt beim Spielstart einen Weg (ohne Kosten).
  **KI:** Sie schließt Ausbildungsgebäude ohne Weg mit `connectRoad` an (wie Werke).
  Gemessen (Seeds 3/7/11, 15 min, Normal): alle Ausbildungsgebäude der KI haben einen Weg von 1 bis 12 Zellen (Entfernung 100 %);
  der Stau an den Straßen direkt am Lager, über die auch alle Waren fahren, drückt das Tempo dort auf 36 bis 100 %.
  Lagerhallen (Material näher an der Front) kommen später.
- **Straßen zerstören und räumen (Paket „Straßen“, Teil 3; `js/game/roadwar.js`, Werte `CITY.roadWar`):** Nur auf **ausdrücklichen Befehl** „Beschuss“ (Taste E,
  in der Befehlskarte „Straße beschießen“ im Tipp, Befehl `shellRoad`, Rechteck von Zellen) schießen Einheiten auf eine Straßenzelle; von selbst zielt niemand auf Straßen.
  Es können alle Einheiten mit einer Waffe mit Schaden gegen Bauten ab `minStruct` = 20:
  **Kampfpanzer** (Kanone), **Schützenpanzer** (Granatwerfer), **Panzerabwehrsoldat** (RPG), **Kampfhubschrauber** (Raketen) und **Panzerhaubitze** (nicht näher als ihre Mindestreichweite);
  Schützen, Scharfschützen und Fahrzeuge ohne solche Waffe nicht.
  Die **F-16** gehört nicht dazu (ihre Einsätze laufen über die Bahn; offen).
  Die Einheit fährt bis 90 % ihrer Reichweite heran (`rangeMul`), jeder Schuss kostet Munition wie sonst und macht den Bauten-Schaden der Waffe.
  Jede Straßenzelle hat **300 Trefferpunkte** (`hp`; Panzer 3 Schüsse, RPG 5, Granatwerfer 12).
  Ziele: eigene Straßen beider Teams (auch die eigenen, zum Sprengen) und **Stadtstraßen der Karte** (trifft alle Teams); **Brücken, Bahn und Rollfeld nicht**.
  Bei 0 wird die Zelle zu **Schutt**: Die Straße ist weg (eigene: Zelle leer; Stadtstraße: kein Straßentempo mehr),
  damit fehlen alle Wege über sie (Lieferwege, Einfuhr, Pendler, Gewerbe, Versorgung der Ausbildung, Anschluss ans Lager im Baugebiet), ein Krater entsteht,
  der Besitzer bekommt „Straße zerstört: Wege unterbrochen“.
  Auf Schutt lässt sich nicht bauen (`canZone`).
  Gezeichnet als aufgerissener Belag mit Kratern in 2D und Iso (sichtbar, sobald die Stelle erkundet ist).
  **Räumen:** Baufahrzeuge mit „Schutt räumen“ (Taste R, Befehl `clearRubble`) in `clearTime` = 5 s je Zelle aus 54 px, Bagger mit „Baggern“ (6 s);
  danach ist die Straße wieder da (eigene Straße des Besitzers bzw. Stadtstraße), kostenlos.
  Räumen darf man Schutt eigener Straßen und von Stadtstraßen.
  Der **Bagger reißt außerdem gegnerische Straßen ab** (ohne Schutt; gegnerische Gebäude weiter nur mit der Schaufel).
  Trefferpunkte beschädigter Zellen (`game.roadHp`) und Schutt (`game.rubble`) gehören zum Spielstand.
  **KI:** Alle 10 s schickt sie ein freies Baufahrzeug zum Schutt ihrer Straßen, der am nächsten an ihrer Hauptstadt liegt,
  wenn dort keine sichtbaren gegnerischen Kampfeinheiten näher als 400 px stehen (`ROAD_REPAIR_EVERY`, `ROAD_REPAIR_SAFE` in `js/data/ai.js`).
  Sie greift gegnerische Straßen nicht an.
- **Kerosin:** Die F-16 tankt am Kerosintank des Fliegerhorsts (der sich aus `c.kero` füllt).
  Hubschrauber im Umkreis eines Heliports (2 Felder) tanken dort Kerosin aus dem Stadtlager: `CITY.care.refuel` = 0,05 des Tanks je s, mal Strom, 1 Kerosin je Treibstoffeinheit.
  Das Tanken an FOBs mit Treibstoff bleibt wie bisher.
  Ist das Stadtlager leer, tankt niemand Kerosin, und das Spiel meldet „Luftfahrzeuge ohne Kerosin“ (am Heliport auch bei schon leerem Lager).
- **Werkslager und LKW am Werk (P5a):** Die Werke der Arten `CITY.pickup.kinds` (BM-Werk, Munitionswerk, Raffinerie) haben je ein kleines **Ausgangslager** für ihre Ware,
  höchstens `CITY.pickup.cap` = 400. Vom Ausstoß eines Schritts gehen `CITY.pickup.share` = 50 % dorthin, solange es nicht voll ist, **ohne Straßenweg** und ohne Verlust,
  **nur wenn dem Werk gerade ein eigener LKW zugeteilt ist** (ein Ladeauftrag `load` mit `work` auf dieses Werk oder eine Route `route` mit `fromWork` ab diesem Werk,
  egal ob der LKW noch fährt oder schon lädt).
  Ohne zugeteilten LKW läuft der ganze Ausstoß zur Hauptstadt; was schon im Ausgangslager liegt, bleibt dort für die nächste Abholung.
  Der Rest und alles, was nicht mehr passt, läuft zur Hauptstadt.
  Beim Munitionswerk gilt das für die erzeugte Munition.
  Die Einlagerung zählt als Erzeugung der Ware (Flussanzeige), der Bestand des Ausgangslagers zählt zur Ressourcenanzeige.
  **LKW holen dort ab:** Rechtsklick mit gewählten LKW auf das Werk (Befehl `load` mit `work`).
  Der LKW fährt zur Werksmitte, lädt nur die Ware dieses Werks (seine Ladungsart gilt hier nicht) und lädt, bis er voll ist oder das Werkslager leer ist, und fährt dann mit der Ladung weiter,
  ohne zu warten.
  Bei der Route Werk → FOB fährt er ab, sobald er voll ist; mit Teilladung fährt er nach höchstens `CITY.pickup.wait` = 60 s am Werk ab (keine Kleinstfuhren);
  ist er leer, wartet er am Werk, bis Ware kommt (das Werk ist dann zugeteilt, das Lager füllt sich).
  Der Befehl `route` nimmt ein Werk als Start (`fromWork`).
  **Oberfläche:** Taste T, dann das eigene Werk anklicken (oder eine fertige FOB), dann die Ziel-FOB; die Routenlinie beginnt in der Werksmitte.
  **KI:** Pendler holen dort ab, wenn keine FOB Überschuss hat oder das Werk klar näher liegt (§10); ein Werk hat höchstens einen KI-LKW gleichzeitig.
  Die Ressourcenanzeige zeigt am Lagerknoten von BM, MUN und TS die Zeile „davon an Werken: N“ (Summe der Ausgangslager dieser Ware).
  **Abriss oder Zerstörung** des Werks: sein Ausgangslager ist verloren, der LKW-Auftrag endet mit der Meldung „Werk nicht mehr da“.
  Weil ohne zugeteilten LKW nichts ins Ausgangslager fließt, bleibt dadurch auch nichts liegen.
  Spielstände ohne Ausgangslager laden mit leerem Lager.
- **Anzeige:** Im Baumodus werden Straßen mit Last nach Auslastung getönt: grün unter 60 %, gelb unter 100 %, rot ab 100 % (`citylayer.js`, `drawLoads`).
  Werke ohne Weg zum Lager, Arbeitsstätten ohne Pendlerweg und Ausbildungsgebäude ohne Weg zum Lager tragen ein großes,
  fettes rotes X am Schild (gezeichnet statt des Zeichens 🚫, das nicht jeder Browser zeigt).
  Ein Werk ohne Einfuhrpunkt trägt dieses X bisher nicht; seine Info warnt aber.
  Die Info eines Gebäudes nennt den Lieferweg zum Lager, „Pendler: Stau 70 %“, „Keine Wohnung über die Straße erreichbar: keine Arbeiter“ und bei Gewerbe „Waren: x % versorgt“;
  die Info eines Werks nennt außerdem „Rohwaren von: Kartenrand“ oder „Güterbahnhof“ mit Entfernung und Weg; ein Güterbahnhof ohne Gleis bis zum Rand meldet „Kein Gleis bis zum Kartenrand:
  führt nichts ein“.
  Die Leiste im Baumodus zeigt den kleinsten Stau-Faktor („Stau x %“) und „ohne Weg x/s“.
  Die Flussanzeige hat die Einfuhr der vier Rohwaren vor den Werken und die Hinweise „Stau auf den Straßen“, „Waren ohne Straßenweg“ und „Gewerbe ohne Waren“.
- **Werte** (alle in `CITY.transport`, `js/data/city.js`): `cap` 24, `mapCap` 40, `commute` 0,05, `maxDist` 260, `smooth` 2 s, `connectMax` 30. Einfuhr (`CITY.import`):
  `station` 40 / 80 / 140 je s, `price` je Rohware (aus `js/data/goods.js`).
  Werkslager (`CITY.pickup`): `cap` 400, `share` 0,5, `kinds` bm, mun, fuel, `wait` 60 s. KI-Pendler am Werk (`js/data/ai.js`):
  `WORK_SOURCE_NEAR` 0,5, `WORK_SOURCE_TRUCKS` 1, `WORK_SOURCE_MIN_RATE` 0,2 je s (Ausstoß je Werk im letzten Schritt, `c.workOut`).
- **KI:** Die Stadt-KI sorgt dafür, dass ihre Werke Einfuhr haben.
  Erreicht kein Einfuhrpunkt die Stadt, legt sie zuerst eine bezahlte Straße vom Netz am Lager zum Kartenrand (`aiEdge`, höchstens `CITY.transport.connectMax` Zellen).
  Ein Werk ohne Einfuhrweg bekommt einen Anschluss an das Netz der Einfuhrpunkte (`aiConnect`, `importReach`).
  Ein Werk setzt sie an eine Straße, die noch nicht mit dem Lager verbunden ist, nur, wenn von dort eine Zufahrt zum Netz des Lagers möglich ist (`linkField`, höchstens `connectMax` Schritte).
  **Industriepark** (Paket „Industriepark“, `aiStation`, `parkSite`): Ab einer Spielsekunde je Schwierigkeit (`CITY.ai.stationFrom`, normal 300 s,
  leicht nie) legt die Stadt-KI einen Güterbahnhof 3 × 3 mit Straße an drei Seiten an, daneben vier 2 × 2-Werksplätze (am Bahnhof: Rohwaren ohne Straße;
  an der Parkstraße: das Produkt fährt über die Straße zum Lager), dazu eine bezahlte Zufahrt zum Netz des Lagers und ein Gleis zum Kartenrand.
  Die Werksplätze hält sie frei, neue Werke kommen zuerst dorthin.
  Einen zweiten Park baut sie nur bei anhaltendem Einfuhrmangel.
  Seit dem Paket „Straßennetz der KI“ zählt für die KI nur der Transportweg als Anschluss;
  seit dem Paket „Fliegerhorst-Anschluss“ gilt das für alle Stellen gleich (Bahn und Rollfeld sind keine Straße),
  sie baut an der Hauptstadt Straßen und Gebäude nur am Netz des Lagers (keine Inseln) und legt neben dauerhaft überlastete Straßen eine weitere Spur (`aiLanes`).
  Die Zahlen stehen in `docs/prd/ki.md`; die Werkmischung in `docs/prd/stadt.md` (KI) und `CITY.ai.mix`.
- **Umbenennung:** Stahl ist die Ware, die bisher Metall hieß (Anzeige, Markt, Kosten, Hilfe).
  Der Schlüssel `metal` bleibt im Code und in Speicherständen (`c.metal`, `CITY.startMetal`, `CITY.metalCost`).
- **Tests:** `test/airfield-link.test.js` (Fliegerhorst-Anschluss: Bahn keine Straße, Stellplatz an der Bahn, Tank mit und ohne Straße, Tower frei und Umkreis, Heliport und seine Ausbildung),
  `test/transport.test.js` (Wege über Straßen, kein Weg, nächstes Ziel, Stau, Lager-Anschluss, keine Ware aus dem Nichts, ohne Hauptstadt, Kerosin),
  `test/import.test.js` (Einfuhr über Straßen und Güterbahnhof, Kosten, Geld, Durchsatz, Preisregel), `test/shop.test.js` (Gewerbe-Absatz, Steuer, Nachfrage, Wirkung ohne Weg),
  `test/cityprod.test.js` (KI gegen KI, Seeds 3 und 11, 12 min: beide Städte erzeugen Stahl und Munition), `test/save.test.js` (Spielstand mit Stau),
  `test/supply.test.js` (Versorgung der Ausbildung: Formel, Startviertel angeschlossen, nah 100 %, Tempo, Last, ohne Weg steht sie, Stau verlangsamt, Spielstand bitgleich),
  `test/roadwar.test.js` (Straßen beschießen nur auf Befehl, Schutt unterbricht die Versorgung, Baufahrzeug und Bagger räumen, Bagger reißt gegnerische Straßen ab, KI räumt, Spielstand).
