# Frontline PRD – Stadt: Rohwaren und Import, Werke, Markt, Steuern, Ressourcenanzeige

> Teil des PRD, Abschnitte §15 (Wirtschaft). Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 15. Stadt (Teil)

- **Werke als 2 × 2-Großbauten:** **BM-Werk, Munitionswerk, Raffinerie, Stahlwerk und Kerosin-Raffinerie** sind je ein Gebäude über 2 × 2 Zellen (`CITY.size`) mit eigenem, eindeutigem Aussehen.
  Ein Werk bleibt ein Werk: Preis je Gebäude, Arbeitsplätze (8/20/40), Strombedarf und Ertrag wie bei einer Werkzelle; es braucht nur mehr Platz.
  Trefferpunkte 600/1000/1600 (× 2), ein Ziel; Räumen einer Zelle entfernt das ganze Werk, zerstört wird das ganze Quadrat Ruine.
  Im Baumodus antippen: das Quadrat folgt dem Finger mit seiner Mitte; ein gezogenes Rechteck setzt das Werk in seine Mitte.
  Straße an irgendeiner Außenzelle reicht; ein 2 × 2-BM-Werk ist auch über ein benachbartes BM-Werk angeschlossen, das selbst direkt an der Straße liegt.
  Die KI zählt Werke als Gebäude und setzt sie an eine Straße; findet sie keinen Platz, baut sie in diesem Takt etwas anderes.
  Für Anzeigen und Zählungen ist ein 2 × 2-Werk **ein** Gebäude (nur die Ankerzelle zählt, `isPart` gilt für die übrigen drei Zellen).
  - **Aussehen (dazu das Kraftwerk):** Jede Anlage hat je Stufe ein eigenes, detailreiches Bild, isometrisch für jede Drehung dasselbe,
    in 2D dieselbe Anlage von oben (Licht von links oben, Schatten nach rechts unten).
    **Kraftwerk** Kesselhaus mit Treppenturm, Maschinenhaus mit hohen Fenstern und Band in Teamfarbe, rot-weißer Schornstein mit Warnlicht, Naturzug-Kühlturm mit Dampffahne,
    Kohle in langen Mieten mit Förderbrücke zum Kesselhaus, Kühlwasser-Pumpenhaus, Umspannwerk mit Transformatoren und Strommasten, Verwaltung mit Parkplatz; Stufe 2 größerer Kühlturm, Rauchgaswäsche,
    zweite Kohlenmiete und Radlader; Stufe 3 zweiter Kühlturm, dritte Miete, höherer Schornstein.
    **BM-Werk** Ziegelei: Ringofen mit glühenden Bögen und gemauertem Schornstein, Lehmhalde, Trockenschuppen mit Rohlingen, Palettenlager mit Ziegeln, Holzlager mit Stämmen und Brettern,
    Büro mit Walmdach und Fahne, LKW mit Ziegeln; Stufe 2 Bagger mit Förderband, Sägeschuppen, Gabelstapler, mehr Paletten; Stufe 3 Tunnelofen mit Stahlkaminen und Holz-LKW.
    **Munitionswerk** eingezäuntes Gelände mit Wache und Schranke, Fertigungshalle mit Sheddach und Band in Teamfarbe, begrünte Erdbunker mit Toren, olivgrüne Kistenstapel, Wasserturm,
    Fahrzeughof mit Militär-LKW (einer je Stufe), Geschoss-Denkmal auf dem Rasen; je Stufe mehr Bunker und Kisten, ab Stufe 2 Lüfter und Gabelstapler, Stufe 3 Lagerhalle und Wachturm.
    **Raffinerie** Tanklager in der Auffangwanne (Schwimmdachtanks mit Band in Teamfarbe), Destillationskolonne mit Bühnen, Ofen mit Kamin, Rohrbrücken, Verladestation mit Tankwagen unter dem Dach,
    Leitstand; Stufe 2 zweite Kolonne, Kugeltank, weitere Tanks und Tankwagen; Stufe 3 dritte Kolonne, zweiter Kugeltank und Fackel.
    **Stahlwerk** Hochofen mit Gichtbühne und Glut am Stichloch, Winderhitzer, Schrägaufzug vom Möllerbunker, Gießhalle mit glühendem Tor, Erz- und Kokshalden, Gleis mit Erzwagen,
    Schlackenplatz mit Glut; Stufe 2 Staubsack und Torpedowagen; Stufe 3 Walzwerkhalle und Schornstein.
    **Kerosin-Raffinerie** helle Kugeltanks mit blauem Gürtel und Rundtanks mit gewölbtem Dach und blauen Tankringen in der Auffangwanne, Kolonne mit blauem Band, Pumpenhaus mit blauem Band,
    Rohrbrücke mit blauen Leitungen, Leitstand mit Fahne, Verladestation mit blau-weißem Flugfeld-Tankwagen; Stufe 2 zweite Kolonne, zweiter Kugel- und Rundtank, liegender Drucktank,
    zweiter Tankwagen; Stufe 3 dritter Kugel- und Rundtank, zweiter Drucktank und Fackel.
    Im Winter liegt in Iso Schnee auf Dächern, Mieten, Rasen und Bäumen.
    Das Schild sitzt über dem höchsten Punkt.
    Wie die 1 × 1-Gebäude wird jedes Bild je Maßstab einmal gemalt und danach nur kopiert (`spritecache.js`).
    Nur Bild, Spielregeln unverändert.
    Code: `js/render/works.js` mit den gemeinsamen Bauteilen aus `js/render/isokit.js` (auch von `townhouses.js` genutzt).
  - **Startviertel:** die Raffinerie unter der Straße ist ein fertiges 2 × 2-Werk (rechts daneben Wohnen).

### Rohwaren und Import (Paket „Import“)

Rohwaren kommen **von außerhalb der Karte**.
Es gibt keine Vorkommen, keine Förderanlagen und keine Hütte mehr: Holz, Stein, Erz und Öl werden nicht mehr auf der Karte gewonnen.
Vier Rohwaren werden eingeführt, je angekommener Einheit bezahlt und **weder gelagert noch gehandelt**; sie fließen direkt in die Werke.
Was daraus wird (Baumaterial, Stahl, Munition, Treibstoff, Kerosin), steht wie bisher im Lager oder im Stadtlager.

- **Die vier Rohwaren** (Register `IMPORTS` in `js/data/goods.js`, Preise `price`):

  | Rohware | Geld je Einheit | Gebraucht von |
  |---|---|---|
  | Rohmaterial | 0,2 | Baumaterial-Werk |
  | Eisen | 0,3 | Stahlwerk, Munitionswerk |
  | Öl | 0,3 | Raffinerie, Kerosin-Raffinerie |
  | Sprengstoff | 0,4 | Munitionswerk |

- **Was ein Werk je Einheit Produkt braucht** (`CITY.chain`, Feld `need`) und was das kostet. Der Markt rechnet je Einheit: Preis je Los ÷ 100 (`CITY.market.lot`).

  | Werk | Bedarf je Einheit Produkt | Produkt | Einfuhr je Einheit Produkt | Markt je Einheit: verkaufen / kaufen |
  |---|---|---|---|---|
  | Baumaterial-Werk | 1 Rohmaterial | Baumaterial | 0,20 | 0,20 / 2,00 |
  | Stahlwerk | 2 Eisen | Stahl | 0,60 | 0,40 / 4,00 |
  | Munitionswerk | 0,5 Eisen und 0,5 Sprengstoff | Munition | 0,35 | 0,30 / 3,00 |
  | Raffinerie | 1 Öl | Treibstoff | 0,30 | 0,30 / 3,00 |
  | Kerosin-Raffinerie | 1,2 Öl | Kerosin | 0,36 | 0,35 / 3,50 |

- **Preisregel:** Je Werk kosten die Rohwaren einer Einheit Produkt mindestens den Verkaufspreis dieser Einheit am Markt und höchstens die Hälfte ihres Kaufpreises.
  So druckt Einführen und Verkaufen kein Geld, und Einführen ist viel billiger als am Markt kaufen.
  Geprüft in `test/config.test.js` und `test/import.test.js`; ändert man einen Preis oder einen Bedarf, muss die Regel weiter gelten.

- **Zwei Arten von Einfuhrpunkt** (Weg zum Werk: über Straßen, nie über Gleise):
  - **Straße am Kartenrand:** Jede **eigene** Straßenzelle in der äußersten Zeile oder Spalte des Stadtrasters ist ein Einfuhrpunkt.
    Stadtstraßen der Karte zählen nicht.
    Die Durchsatzgrenze ist die Straße selbst: `CITY.transport.cap` = 24 Einheiten je s und Spur (Paket „Industriepark“, vorher 12), bis zu `maxLanes` = 4 Spuren, dazu Stau.
    Was die Straßen nicht tragen, kommt nicht an.
  - **Güterbahnhof mit Gleis:** Ein fertiger Güterbahnhof ist Einfuhrpunkt, wenn eine durchgehende Kette aus Gleiszellen (nur 4er-Nachbarschaft) ihn mit einer Gleiszelle am Kartenrand verbindet.
    Er führt höchstens `CITY.import.station` = 40 / 80 / 140 Rohwaren je s ein (Stufe 1 / 2 / 3, alle Sorten zusammen), mal Besetzung, Strom,
    Stimmung und Pendlerweg (kein Wohnen über die Straße erreichbar: 0).
    Fordern die Werke am Bahnhof mehr, bekommt jedes anteilig weniger.
  - **Direkt daneben:** Liegt ein Werk unmittelbar neben einem angeschlossenen Güterbahnhof, kommen die Rohwaren ohne Straße an (Weg der Länge 0, kein Stau).

- **Güterbahnhof und Gleis:**
  - **Güterbahnhof** (Großbau 3 × 3, 300 Geld und 200 Baumaterial, Strom 6, Arbeitsplätze wie ein Werk): Er braucht eine Straße zu den Werken und das Gleis zum Kartenrand.
    Mit Baugebiet muss er zudem wie jedes Gebäude an einer Straße zum Lager liegen.
    Ohne Gleis führt er nichts ein.
  - **Gleis** (flache Zelle, wie eine Straße zu ziehen, sofort fertig, 5 Geld und 5 Baumaterial je Zelle):
    Eine durchgehende Kette aus Gleisen (oben, unten, links, rechts) vom Güterbahnhof bis an den Kartenrand.
    Waren fahren nicht auf dem Gleis.
    Jede Zelle hat nur eine Art, also kreuzt ein Gleis keine Straße.
  - **Gleis und Anschluss:** Für die Anschlusspflicht des Baugebiets und für das Wachstum zählt ein Gleis wie eine Straße (Gebäude daneben gelten als angeschlossen);
    die Waren-Wege nutzen es nicht (siehe Straßentransport).

- **Ablauf je Schritt:**
  1. Ein Werk, das Ware machen könnte (Arbeiter, Strom, Stimmung, Pendlerweg), fordert Rohwaren für seine Leistung an.
     Es tut das nur, wenn sein Lager für das Produkt nicht voll ist und es einen Straßenweg zum Lager der Hauptstadt hat.
     Ein voller Lager oder fehlender Weg heißt: keine Anforderung, keine Kosten.
  2. Die Anforderung geht an den **nächsten** erreichbaren Einfuhrpunkt über Straßen (kürzester Weg). Gibt es keinen, erzeugt das Werk nichts (Anzeige: „erreicht keinen Einfuhrpunkt“).
  3. Bezahlt wird **je angekommener Einheit** (Preis oben). Die Rohwaren eines Werks kommen gemeinsam über denselben Weg an, im Verhältnis ihres Bedarfs.
  4. Reicht das Geld nicht, sinkt die ganze Einfuhr des Schritts im selben Verhältnis (Anzeige: „Geld reicht nur für … der Einfuhr“). Die Kasse fällt durch Einfuhr nie unter 0.
  5. Ausstoß = was die angekommenen Rohwaren hergeben, höchstens die Leistung. Er fährt wie bisher zum Lager der Hauptstadt (das Ausgangslager des Werks zuerst, `CITY.pickup`).

- **Startviertel:** Eine Straße führt vom Netz des Startviertels ohne Kosten zum nächsten Kartenrand.
  Die Raffinerie des Startviertels führt ab Sekunde 0 Öl ein.
  Gelingt keine Straße zum Rand, bleibt die Raffinerie ohne Einfuhr; die Tests prüfen mehrere Seeds.

- **Der Markt bleibt** für fertige Waren, als Brücke bei Engpässen: Er verkauft Überschüsse zu schlechtem Preis und kauft Mangel teuer (siehe Markt).
  Rohwaren gibt es nie am Markt.
  Man kann Engpässe also überbrücken, indem man Fertigware kauft, nicht aber Rohwaren.

- **Ertrag:** Ein Werk arbeitet höchstens mit je Arbeiter und Sekunde 0,1 Baumaterial (BM-Werk), 0,06 Munition (Munitionswerk), 0,05 Treibstoff (Raffinerie),
  0,04 Kerosin (Kerosin-Raffinerie) oder 0,05 Stahl (Stahlwerk), und zwar nur so viel, wie an Rohwaren ankommt (Tabelle oben).
  BM, Munition und Treibstoff gehen ins Lager der Hauptstadt, Stahl und Kerosin ins Stadtlager.
  Ist die Hauptstadt zerstört oder hat das Werk keinen Weg dorthin, fordert es nichts an und arbeitet nicht.
  Die Werte stehen in `CITY.yield` (aus `js/data/goods.js`), der Bedarf in `CITY.chain` (`need`); seit v5.20 kommt nur an, was über einen Straßenweg fährt (§15 „Straßentransport“).

- **Stahl:** liegt im Stadtlager (Start 400, höchstens 3000), LKW fahren es nicht.
  Das Stahlwerk macht es aus Eisen.
  Ausgebildete Fahrzeuge und Hubschrauber kosten zusätzlich Stahl je Einheit (`CITY.metalCost`, z. B. LKW und Baufahrzeug 20, Schützenpanzer 120, Kampfpanzer 250, F-16 320); Soldaten keinen.
  Fehlt er, meldet die Ausbildung „Zu wenig Stahl“; Abbruch erstattet ihn.

- **Markt (60 Geld):** arbeitet und zahlt Steuern wie Gewerbe.
  Steht ein fertiger Markt, handelt man im **Marktmenü** in Losen zu 100 (neben Verkaufen und Kaufen je ein Knopf **×10** und **×100**: so viele Lose auf einmal, höchstens `CITY.market.maxCount`;
  reichen Geld, Bestand oder Lagerplatz nicht, wird so viel gehandelt wie möglich, mit Meldung „Nur n von 100 gekauft: …“; Befehl `trade` mit `count`):
  verkaufen bringt 20 (BM), 30 (MUN, TS), 40 (Stahl) oder 35 Geld (Kerosin), kaufen kostet als Grundpreis 200, 300, 300, 400 oder 350 Geld (Kerosin).
  Das ist eine Notlösung für **fertige Waren**: jedes gekaufte Los hebt den Kaufpreis dieser Ware für das Team um 8 % (`CITY.market.surge`, multiplikativ, je Los einzeln berechnet),
  und der Aufschlag klingt je s um 1 % ab (`CITY.market.calm`; unter 0,001 fällt er ganz weg).
  Verkaufspreise bleiben fest; der Aufschlag steht je Team und Ware in `c.marketHeat` (Paket „Knappes Geld“).
  BM, MUN und TS kommen aus dem Lager der Hauptstadt und gehen dorthin, Stahl und Kerosin aus dem Stadtlager.
  Das Marktmenü ist ein kleines Fenster oben in der Mitte, das Spiel läuft weiter;
  je Ware Bestand, „Verkaufen +Preis“ und „Kaufen −Preis“ (ausgegraut, wenn es nicht geht; Antippen nennt dann den Grund), „✕“ oder Esc schließt.
  Es öffnet auf drei Wegen: **Tippen auf die Geldanzeige** oben links (sobald ein Markt steht, ist sie gelb umrandet und zeigt ⚖; ohne Markt kommt ein Hinweis),
  Aktion **Handel** (Taste T) eines gewählten Markts oder Knopf **Handel** im Baumodus.
  Wird der letzte Markt zerstört, schließt es sich.

- **Straßen kosten Baumaterial:** 10 BM je Zelle aus dem Lager der Hauptstadt, kein Geld. Gleise kosten 5 Geld und 5 BM je Zelle.

- **Steuern:** 0,03 Geld/s je arbeitsfähigem Einwohner plus 0,07 Geld/s je Arbeiter in Gewerbe und Markt (ohne Baumaterial-Versorgung nur 30 %, siehe „Gewerbe-Absatz“),
  beides mal Zufriedenheitsfaktor (0,7–1,1), in die Kasse (steht auch im Geld-Einkommen oben).
  Einwohner, die als Truppen gebunden sind, zahlen nichts.
  **Steuerbremse** (seit Paket Balance-Steuern, `CITY.taxBrake`): Bis 15 Geld/s zählt die Steuer voll; jeder Teil darüber zählt nur zu 30 %.
  Die Kasse bekommt also gedämpfte Werte, das Infofeld der Stadt zeigt „(gebremst, roh … /s)“ mit der Rohsumme.
  Regel in `brakeTax` (`js/game/city/economy.js`).

- **Ressourcenanzeige:** Großer Knopf **📊 Ressourcen** rechts oben unter „🔬 Forschung“ („🚧 Bauer“ rückt eins nach unten)
  öffnet ein Fenster mit dem **Fluss der Rohwaren durch die Werke bis zu den Lagern**, damit man sieht, wo der Engpass ist.
  Das Spiel läuft weiter; ✕ oder Esc schließt.
  - **Spalten von links nach rechts:** **Einfuhr** (die vier Rohwaren: angekommene Menge je s und Geld je s; „keine Einfuhr“, wenn nichts ankommt),
    **Werke** (BM-Werk, Stahlwerk, Munitionswerk, Raffinerie, Kerosin-Raffinerie: Zahl, Leistung und Ausstoß je Sekunde, Auslastungsbalken),
    **Lager** (Baumaterial, Munition, Treibstoff in den Lagern der Hauptstadt, Stahl und Kerosin im Stadtlager;
    Bestand samt LKW-Ladung und Ausgangslagern der Werke, gemessene Erzeugung und gemessener Verbrauch je Sekunde der letzten 60 s Spielzeit).
    Linien verbinden die Stufen, ihre **Breite** zeigt die Menge je Sekunde (Zahl an der Linie); gestrichelt = kein Fluss.
  - **Farben:** grün = läuft, **gelb** = Werk wartet auf Rohwaren (Ausstoß unter 85 % der Leistung), **rot** = Werk steht (keine Arbeiter oder kein Strom) oder Lager in unter 10 min leer,
    grau gestrichelt = nicht gebaut.
    Die Lagerknoten zeigen „Lager voll · fordert nichts an“, wenn das Lager voll ist.
    Oben stehen **Arbeiter** (Besetzung), **Strom**, **Zufriedenheit** (rot, wenn sie bremsen) und die Steuern.
  - **Engpässe in Worten:** unten die bis zu vier wichtigsten mit Rat, z. B. „Raffinerie nur 40 % ausgelastet: zu wenig Öl.“, „2 Werke erreichen keinen Einfuhrpunkt:
    keine Rohwaren.“, „Geld reicht nur für 67 % der Einfuhr: Werke arbeiten langsamer.“, „Treibstoff sinkt um 0,5/s: leer in etwa 4 min.“
  - **Verbrauch** = was ins Lager kam + Marktkäufe − Zunahme des Bestands; zählt alles, was die Lager verlässt (Bauen, Nachladen, Tanken, Ausbildung, Reparatur, Verluste).
  - **Regel:** Die Anzeige wird aus den Daten erzeugt: Die Kette steht in `CITY.chain` (`js/data/city.js`), die Rohwaren in `IMPORTS`,
    die Zahlen kommen aus `updateCity` (`c.stats`: `raw`, `importCostBy`, `cap`, `inp`, `gross`, `n`), den Graphen baut `js/game/flow.js`, gezeichnet wird er in `js/ui/flowpanel.js`.
    **Jede Änderung an Rohwaren, Werken, Waren oder ihren Formeln muss die Anzeige mitpflegen** (`CITY.chain`,
    die Felder in `updateCity`, bei neuen Sorten Namen und Farben in `flow.js`/`flowpanel.js`);
    `test/flow.test.js` schlägt sonst fehl.
