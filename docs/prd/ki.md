# Frontline PRD – KI-Gegner

> Teil des PRD, Abschnitte §10 mit Tabelle „KI-Konstanten“. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 10. KI-Gegner

Im Modus **Eroberung** (bis zu drei KIs, jeder gegen jeden) ersetzt der Flaggenkampf die Angriffswelle auf die Zonenmitte; alles andere (Ausbau, Ausbildung, Logistik, Verteidigung) bleibt gleich.
Regeln: [eroberung.md](eroberung.md), Abschnitt „KI“.

Gleiche Regeln und Befehls-Schnittstelle wie der Spieler (Sonderrecht nur: Einkommensfaktor bei Leicht 0,8, sonst 1; die KI
ignoriert den Nebel bei der Zielwahl, Mörser brauchen aber Sicht).
Verhalten: FOB-Fahrzeuge gründen FOBs (eins zur Zeit, die KI spart darauf, außer bei Alarm an der Hauptstadt; es fährt zum Ziel und baut dort auf, ein gescheitertes Ziel ist 240 s gesperrt),
Baufahrzeug baut Verteidigung, Schützen bauen Mauern aus getragenem Baumaterial; **zuerst eine FOB in der Konfliktzone**,
dann Relais-FOBs auf dem Weg (1000 px Abstand) und Flanken-FOBs um die Zonen-FOB (Grenze je Schwierigkeit 3/5/7 FOBs);
gemischte Armee aus der Hauptstadt → Zone halten → Verteidigung (Mörser/Flak/Mauern) an vorderen FOBs.
Die Startarmee rückt sofort aus; ein Fünftel bleibt als Reserve an der Hauptstadt.
**Logistik:** Pendler-LKW bringen Baumaterial, Munition und Treibstoff aus der Hauptstadt zu den vorderen FOBs, ein Versorger-LKW folgt der Armee; Einheiten ohne Munition ziehen sich zurück.
Seit v5.70 holen Pendler auch am **eigenen Werk mit Ausgangslager** (§15 „Werkslager“) ab,
wenn keine FOB Überschuss hat oder das Werk höchstens `WORK_SOURCE_NEAR` (0,5) so weit von der Bedarfsfront liegt wie die beste FOB-Quelle; höchstens `WORK_SOURCE_TRUCKS` (1) KI-LKW je Werk,
nie für die Hauptstadt.
Ein Werk ist nur Quelle, wenn es gerade liefert: Ausstoß je s mindestens `WORK_SOURCE_MIN_RATE` (0,2 Ware je s, Merker `c.workOut` am Anker) oder Ausgangslager mindestens `SURPLUS_MIN`;
eine laufende Route ab Werk endet nach `ROUTE_HOLD`, wenn das Werk nicht mehr liefert und der LKW nicht über 50 geladen hat.
- **Angriffswellen** (klassisch; in der Eroberung Flaggenangriffe, [eroberung.md](eroberung.md)): Die KI bündelt ihre Angriffe.
  Hält der Gegner die Zone, greift sie erst an, wenn ihr Wert mindestens das 1,2-Fache der geschätzten Besatzung (Anzahl × 150) beträgt, nie darunter.
  Ging lange keine Welle los, sinkt die geforderte Stärke bis auf 60 % (nach 10 min).
  Für die Stärke einer Welle zählt nur, wer noch nicht in der Zone steht.
- **Späher:** Ab 3 min Spielzeit und mit mindestens 10 Kampfeinheiten spart die KI auf einen Little Bird (unbewaffnet).
  Er hält am Zonenrand auf der Gegnerseite, damit die Besatzung der Zone sichtbar wird;
  ist ein Großteil der Besatzer (70 %) zu sehen, schätzt die KI die Stärke aus deren echtem Geldwert statt aus Anzahl × 150 (klassisch; der Späher fliegt in beiden Modi).
  Unter 35 % Treibstoff fliegt er heim und tankt auf 90 %.
- **Nicht gebaut:** Die KI baut keinen Bagger (nicht in `MIX`): Ihre Stadt plant auf freiem Bauland, und Straßen der Zone zu zerstören hilft ihr nicht.
  Flak, SAM und Scharfschützen baut sie seit v5.71 (siehe Luftabwehr und Scharfschützen).
- **Konter-Mix:** Sieht die KI mindestens 8 gegnerische Kampfeinheiten am Boden, verschiebt sie die Grundmischung (50 % Schützen, 20 % PAK, 20 % Schützenpanzer, 10 % Panzer):
  viele Gepanzerte → mehr PAK und Panzer, viel Infanterie → mehr Schützen und Schützenpanzer (jede Sorte mindestens 5 %).
- **Ausbildungsreihenfolge (seit Paket „Balance-Preise“):** Nach dem Defizit kommt der wichtigste Typ dran.
  Scheitert ein Auftrag (etwa weil Stahl fehlt), versucht die KI den nächsten Typ, statt die ganze Runde abzubrechen.
  Fehlt nur das Geld, spart sie auf den Typ mit dem größten Defizit.
- **Stahl am Markt (Paket „Knappes Geld“):** Die KI kauft Stahl nur,
  wenn eine Ausbildung in den letzten `CITY.ai.steelWait` (40) s am fehlenden Stahl scheiterte (Bedarf, gemerkt in `cityMem.steelWant`, Fahrzeuge mit Stahlkosten wie Panzer und Schützenpanzer),
  und nur, solange Geld für Fahrzeug und Los reicht und der Lospreis höchstens `metalMaxPrice` (1,3) × Grundpreis beträgt.
  Fehlt der Stahl für den Festungs-Hubschrauber, gilt dafür der höhere Deckel `metalMaxPriceHeli` (2,0);
  bis er da ist, spart die KI den Stahl (Trucks und Ingenieure können ihn vorher verbrauchen) und baut keine Drohne, die denselben Heliport-Platz belegen würde.
  Späher, Drohnen und FPV bestellen ohne Stahlkauf (nur eigener Stahl).
- **Flankenangriff** (nur klassisch): Die KI merkt sich gesehene gegnerische FOBs (Standort bleibt bekannt, bis er eingesehen und leer ist oder die FOB zerstört wird).
  Ist die Zone gegnerfrei und stehen dort mindestens 12 freie Einheiten, zweigen 30 % davon ab und greifen die gemerkte FOB abseits der Zone an, die der Zone am nächsten liegt.
  Ist das Ziel zerstört, rücken die Überlebenden wieder in die Armee ein.
- **Gruppen-Rückzug:** Steht eine Gruppe im Feuer (mindestens 4 Gegner sichtbar) und ist der Wert der Gegner mindestens 1,8-mal so hoch wie der der eigenen Einheiten dort,
  zieht die ganze Gruppe 1400 px Richtung Basis ab (nicht bei Angriff auf die Basis).
  30 s lang gibt die KI danach keine Angriffsbefehle, damit sich die Gruppe sammelt; ein laufender Überfall wird abgebrochen.
  Einheiten werden im Spiel nicht geheilt, der Rückzug rettet sie also nur vor dem Tod.
- **Zonen-FOB-Verteidigung:** Mörser und Flugabwehr der Zonen-FOB setzt die KI zur Gegnerseite hin (andere FOBs wie bisher zur Zone hin;
  in der Eroberung zur fernen Seite der Zone, [eroberung.md](eroberung.md)); die Zonen-FOB bekommt zwei Mörser statt einem.
- **Luftabwehr (nicht auf Leicht):** Die KI merkt sich getrennt gesehene gegnerische **Hubschrauber** und **Flugzeuge** (je 120 s, `AIR_MEMORY`).
  Gesamtanteil Luftabwehr = min(25 %, Luftziele × 4 %, `AIR_MAX`, `AIR_PER`) der Kampfeinheiten, verteilt nach `AIR_SPLIT`:
  gegen Hubschrauber Gepard 60 % und Flak 40 %, gegen Flugzeuge SAM 70 % und Gepard 30 %, gewichtet mit dem Anteil der Luftart.
  Die Flak trifft Hubschrauber, die SAM Flugzeuge; der Gepard beides.
- **Scharfschützen (Normal und Schwer):** Sieht die KI mindestens 10 gegnerische Soldaten (`SNIPER_FROM`) und hat selbst mindestens 12 Kampfeinheiten (`SNIPER_ARMY`),
  kommen 4 % Scharfschützen in die Mischung (`SNIPER_SHARE`).
  Sie laufen mit der Armee wie die anderen Soldaten und werden in der Kaserne ausgebildet.
- **Panzerhaubitze (nicht auf Leicht):** Ab 15 eigenen Kampfeinheiten bildet sie Panzerhaubitzen aus (6 %, `ART_SHARE`, `ART_FROM`).
  Die Anteile der Luftabwehr, Scharfschützen und Haubitzen sind genaue Zielanteile; die Grundmischung schrumpft entsprechend.
  Die Haubitzen fahren nicht in den Wellen mit, sondern stehen 450 px hinter dem Schwerpunkt der Armee (Richtung nächste eigene FOB,
  `ART_BEHIND`, Stellungswechsel höchstens alle 5 s) und schießen auf alles, was das Team sieht.
- **Unterstützer (nicht auf Leicht, Paket K1):** Die Mischung nimmt Sanitäter (1 je 8 eigene Infanterie, höchstens 3, `MEDIC_EVERY`, `MEDIC_MAX`),
  MANPADS-Soldaten (gegen gemerkte Luftziele, 40 % des Luftabwehr-Anteils, höchstens 4, `MANPADS_SPLIT`, `MANPADS_MAX`),
  Flammenwerfer (höchstens 3, solange gesehene Gegner Häuser besetzen, `FLAMER_MAX`), ein Aufklärungsfahrzeug (ab 10 Kampfeinheiten, `RECON_ARMY`),
  einen Bergepanzer (ab 5 eigenen Fahrzeugen, `RECOVERY_VEH`) und einen Störsender (wenn gemerkte gegnerische Flugabwehr SAM, Gepard oder MANPADS da ist und die KI Luftfahrzeuge hat, `JAM_TARGETS`).
  Die Anzahlen werden als Anteil an den Kampfeinheiten gerechnet.
  Alle Sonderziele zusammen höchstens 60 % (`SHARE_CAP`).
  Sanitäter und Störsender folgen der Armee (untätig weit weg: Befehl Bewegung zum Schwerpunkt, alle 10 s, `ESCORT_TYPES`, `ESCORT_EVERY`, `ESCORT_DIST`).
  Das Aufklärungsfahrzeug und der Bergepanzer fahren ohne eigenen Befehl mit (Aufklärungsfahrzeug ist bewaffnet, Bergepanzer repariert selbst).
- **Artillerie (nicht auf Leicht, Paket K2):** Ab 12 eigenen Kampfeinheiten bildet die KI je einen Mörsertrupp (Kaserne, höchstens 2, `MORTAR_MAX`) und einen Raketenwerfer (Fabrikhalle, höchstens 1,
  `MLRS_MAX`) aus; beide sind indirekt und stehen hinter der Armee (wie die Panzerhaubitze).
  Alle 4 s (`ARTY_FIRE_EVERY`) wählt jede dieser Einheiten neu ein Ziel in ihrer Reichweite (ab Mindestabstand):
  zuerst die größte gegnerische Gruppe aus mindestens 3 sichtbaren Einheiten im Umkreis von 120 px (`ARTY_GROUP`, `ARTY_GROUP_R`), sonst das nächste gegnerische Gebäude, das das Team sieht.
  Ohne Ziel stellt sie das Feuer ein (Befehl `mortarTarget`).
  Die Panzerhaubitze bleibt bei ihrer Stellung (oben).
- **Luft (nicht auf Leicht, Paket K3):** Am Heliport bildet die KI eine Aufklärungsdrohne aus (ab 10 Kampfeinheiten und `DRONE_FROM` 240 s, mit 800 Geld danach, nach der Festung);
  sie fliegt wie der Späher an den Zonenrand zur Gegnerseite und kehrt bei wenig Treibstoff heim.
  Kamikazedrohnen (höchstens `FPV_MAX` 2, ab 12 Kampfeinheiten, mit 600 Geld danach) kauft sie nur, wenn ein gesehener gegnerischer Panzer höchstens `FPV_NEAR` 400 px hinter dem Zonenradius steht;
  alle 6 s bekommt jede bereite Drohne einen Angriffsbefehl auf einen solchen Panzer.
  Die A-10 (Fliegerhorst) ersetzt einen Teil der F-16, sobald die KI mindestens `CITY.ai.a10Heavy` 4 gegnerische schwere Fahrzeuge gesehen hat (gemerkt wie die Luftziele);
  Anteil `a10Share` 0,25, nur mit 1000 Geld über dem Preis.
  Den Kampfhubschrauber (Gunship) baut die KI nicht.
- **Pioniere (nicht auf Leicht, Paket K4):** Ab `SAPPER_ARMY` 12 Kampfeinheiten bildet die KI in der Kaserne höchstens `SAPPER_MAX` 2 Pioniere aus, nur mit `SAPPER_MONEY` 800 Geld danach.
  Jeder Pionier, der gerade nichts zu tun hat und weniger als `BALANCE.sapper.maxMines` Minen liegen hat,
  bekommt alle `MINE_EVERY` 15 s einen Befehl `layMine` auf eine Stelle auf der Strecke von der vordersten FOB zur Zonenmitte (`MINE_FROM` 0,3 bis `MINE_TO` 0,85, Streuung `MINE_SPREAD` 60 px).
  Liegt eine Straße oder ein Feldweg höchstens `MINE_ROAD` 60 px davon, legt er die Mine darauf; keine Mine näher als `MINE_BLDG` 50 px an eigenen Gebäuden.
  Danach läuft er mit der Armee mit.
  Brückenleger, C-130 und Fallschirmjäger baut die KI nicht.
- **Formation:** Angriffswellen marschieren im **Keil** (§8): Panzer vorn, alle kommen zusammen an statt nacheinander.
- **Sendemast:** Ab 12 min (Schwer 9 min, Leicht nie) spart die KI auf einen Sendemast (keine Kampfeinheiten,
  außer bei Alarm an der Hauptstadt) und setzt ihn 220–460 px hinter die Hauptstadt (weg von der Zone).
  Steht ein gegnerischer Mast (schon die Baustelle), greift sie ihn an:
  erst sammelt sich die Armee (höchstens 40 s oder bis 70 % im Umkreis von 600 px), dann gehen alle ohne Formation auf den Mast los, nahe Einheiten greifen ihn direkt an;
  die Zonenwelle entfällt so lange.
  Siegt ihr eigener Mast voraussichtlich früher, verteidigt sie stattdessen.
- **Kommandeur:** zieht nie mit der Welle, sondern steht 220 px hinter dem Schwerpunkt der Armee draußen (Richtung Hauptstadt), damit seine Aura wirkt; ohne Armee draußen wartet er am Sammelpunkt.
  Sind sichtbare bewaffnete Gegner näher als 450 px, weicht er zur Hauptstadt aus.
  Fällt er, bildet die KI ab 90 s Spielzeit einen neuen aus, sobald danach noch 300 Geld übrig bleiben.
  Er holt keine Kisten und besetzt keine Häuser.
- **Wetter** (Normal und Schwer): Bei schlechter Sicht (unter 90 %, also Regen, Nebel, Schnee) bildet die KI den Späher schon ab 90 s Spielzeit und 5 Kampfeinheiten aus.
  Im Nebel (Sicht höchstens 70 %) nutzt sie die Deckung: die Welle geht schon mit 85 % der geforderten Stärke los.
- **Forschung** (wenn eingeschaltet): ab 150 s (Leicht 240 s, Schwer 90 s) Stufe für Stufe durch den Baum, in jeder Stufe die Äste nach `UPGRADES`,
  nur aus Überschuss (400 Geld Reserve, Leicht 800) und mit höchstens einer wartenden Forschung (§7 „Forschung“).
- **Brücken** (Fluss an): Alle 10 s prüft die KI eingestürzte Brücken, die näher an ihrer Hauptstadt als am gegnerischen Start liegen, und schickt das nächste freie Baufahrzeug zum Wiederaufbau,
  wenn danach noch 150 Geld übrig bleiben.
  Sie sprengt selbst keine Brücken; Wege über Furten nimmt ihre Wegsuche von selbst, wenn die Brücken fehlen.
- **Festung:** Ab 10 min (Schwer 7 min, Leicht nie) baut die KI die Hauptstadt zur Festung aus (Normal 1 FOB mit 1 Turm, Schwer bis zu 2 FOBs mit je 2 Türmen;
  die zweite ist die vorderste FOB, bevorzugt die Zonen-FOB).
  Alle 15 s ruft sie `fortify` auf, sobald das FOB-Lager mindestens 250 Baumaterial hat (nicht bei Alarm),
  besetzt fertige Türme mit freien Schützen aus 800 px Umkreis und setzt Dachaufbauten in der Reihenfolge Mörser, SAM, Flak (SAM zuerst, sobald sie gegnerische Luftziele sieht).
  Mörser und Flak der FOB baut sie außerhalb des Mauerrings (`FORT_CLEAR` 224 px), sonst blockieren sie die Ringzellen.
  Ist ein Turm fertig, spart sie auf einen Transporthubschrauber (keine neuen Kampfeinheiten, bis 600 + 300 Geld da sind; gekauft wird ab seinem Preis),
  der wie ein LKW-Pendler Baumaterial und Munition zwischen den FOBs fliegt; ausgebaute FOBs haben einen höheren Soll-Lagerstand (+150 Baumaterial, +150 Munition),
  die LKW-Pendler versorgen sie entsprechend.
  Werte: `BALANCE.difficulty.<stufe>.fort`, `FORT_*` in `js/data/ai.js`.
- **Häuserkampf:** Bis zu 40 % der Infanterie in der Zone besetzen Häuser in der Nähe und halten sie (§7).
  Seit v5.67 stürmt sie besetzte gegnerische Häuser in der Zone (seit „KI stürmt Häuser wirklich“ auch mit Infanterie,
  die gerade in einer Welle in die Zone marschiert) und baut eigene Besatzungshäuser aus (Sandsäcke, Stacheldraht, MG-Nest), nicht auf Leicht.
- **Versorgungskisten:** Alle 6 s (nach den Angriffsbefehlen) schickt die KI freie Soldaten (untätig oder auf dem Weg zum Sammelpunkt,
  nicht in Häusern oder beim Überfall) zu Kisten aus ihrem Lagebild (§7) im Umkreis von 5500 px; Soldaten in der Zone gelten als 800 px weiter weg (sie verdienen dort Geld).
  Kisten mit sichtbaren Gegnern in der Nähe lässt sie liegen.
  Gleichzeitig holen oder tragen Leicht 1, Normal 2, Schwer 3 Soldaten.
  Kistenträger zählen nicht zur Armee.
- **Schwierigkeit über Verhalten:** *Leicht*: langsame Denkschritte (3 s), hohe Angriffsschwelle, kein Späher, kein Konter-Mix, keine Überfälle, kein Rückzug, kein Wetter, Einkommen ×0,8.
  *Normal*: 2 s, Späher, Konter-Mix und Wetter.
  *Schwer*: 1 s, niedrigere Angriffsschwelle, dazu Überfälle und Gruppen-Rückzug; **kein Einkommensbonus mehr**.

- **Stadt mit Anschlusspflicht (Schalter „Baugebiet“, Paket „Straßen“):** Die Stadt-KI baut Gebäude nur an Straßen mit Verbindung zum Lager der Hauptstadt und legt neue Straßen nur dort,
  wo sie dieses Netz verlängern.
  Liegen um ihren Anker weniger als 6 freie Anschlusszellen und hat das Lager mindestens 200 Baumaterial, legt sie eine Straße auf den Ausgang des Netzes mit dem meisten freien Land dahinter;
  ohne jede freie Anschlusszelle (z. B. ein FOB-Viertel) zieht sie eine Straße zur nächsten freien Zelle im Gebiet (`connectRoad`, höchstens 30 Zellen; gelingt das nicht, baut sie an der Hauptstadt).
  Sie lässt beim Bauen mindestens 2 Ausgänge offen, damit eigene Gebäude ihr Netz nicht einschließen;
  das gilt seit dem Paket „Offenes Netz“ auch ohne Baugebiet (dort ist das Netz sonst nach 8 bis 15 Minuten rundum bebaut, kein Platz mehr für den Industriepark).
  Den Fliegerhorst plant sie nur dort, wo die Bahn an eine Straße zum Lager grenzt.
  Straßen, Gleise, Bahn und Rollfeld sind von der Pflicht ausgenommen.
- **Einfuhr (Paket „Import“, Industriepark seit Paket „Industriepark“):** Erreicht kein Einfuhrpunkt die Stadt (keine eigene Straße am Kartenrand, kein angeschlossener Güterbahnhof),
  legt die Stadt-KI zuerst eine bezahlte Straße vom Netz am Lager zum Kartenrand (`aiEdge`, `connectEdge`, höchstens `CITY.transport.connectMax` = 30 Zellen).
  Ein Werk ohne Einfuhrweg bekommt einen Anschluss an das Netz der Einfuhrpunkte (`importReach`).
  Ein Werk an einer Straße ohne Weg zum Lager setzt sie nur, wenn von dort eine Zufahrt zum Netz des Lagers möglich ist (`linkField`,
  Breitensuche über Straßen und freie Zellen, höchstens 30 Schritte).
  **Industriepark** (`aiStation`, `parkSite`, `parkSpot`): Ab `stationFrom` (normal 300 s, schwer 240 s,
  leicht nie) und mit `stationWorks` = 2 Werken mit Leistung legt die KI vorausplanend einen Park an: Güterbahnhof 3 × 3 mit Straße an drei Seiten (Grundriss 9 × 5),
  vier 2 × 2-Werksplätze am Bahnhof (Rohwaren ohne Straße) und an der Parkstraße (Produkt über die Straße zum Lager),
  Zufahrt zum Netz des Lagers (höchstens `parkLink` = 12 Zellen) und Gleis zum Kartenrand (höchstens `railMax` = 40 Zellen); in der Eroberung nur im eigenen Viertel.
  Platzwahl: Gleislänge + `parkLinkCost` (2) × Zufahrt + `stationNear` (1) × Abstand zum nächsten Werk.
  Die Werksplätze bleiben frei;
  eine abgelehnte Werksstelle merkt sie sich 120 s. Einen zweiten Park (`stationMax` = 2) baut sie nur bei anhaltendem Einfuhrmangel (`importWait` 60 s unter `importLow` 0,7,
  bei Einfuhrskala ab `importScaleMin` 0,9) und wenn der erste voll umbaut oder ausgelastet ist (`stationBusy` 0,9).
  Geld: `stationMoney` 100 über der Reserve der Armee; Baumaterial: `stationBm` 200 nach dem Bau.
  Ohne Platz wartet sie `stationRetry` = 120 s. Gemessen (KI gegen KI, normal, Seeds 3/7/11, 25 min, Mittel je Stadt; vorher = Straßen 12 ohne Park, nachher = jetziger Stand):
  Ankunftsanteil 41 % → 73 % der Werksleistung, angekommen 37 → 44 je s, ausgebildete Einheiten 56 → 67, Abschüsse 77 → 69. Mit Park gegen ohne Park (beide Straßen mit Kapazität 24):
  angekommen 39 → 44 je s, Werke 22 → 35, Ausbildung und Abschüsse gleich.
- **Straßennetz (Paket „Straßennetz der KI“):** Vier Regeln, alle nur für die Stadt-KI (`js/ai/city/roads.js`, Einstieg `js/ai/cityai.js`, Werte `CITY.ai`).
  **(1) Angeschlossen heißt Transportweg:** Die KI misst ihr Netz mit `mainRoadReach` (`js/game/city/roadnet.js`),
  dem einzigen Maßstab für „an der Straße zum Lager“ (seit dem Paket „Fliegerhorst-Anschluss“ auch für Bau und Wachstum; Bahn und Rollfeld zählen nicht).
  Vorher zählte sie Bahn und Rollfeld des Fliegerhorsts als Straße (wie der Bauanschluss), setzte Werke an Straßen, die nur über die Bahn am Lager hingen,
  und hielt sie für angeschlossen (`aiConnect` tat nichts): gemessen die Ursache von rund zwei Dritteln der Werke ohne Weg.
  Tank und Munitionslager bekommen ihre Straße zum Lager vor dem Bau (`connectCells`), weil das Baugebiet den Anschluss verlangt.
  **(2) Wachstum vom Netz (`netRoads`):** An der Hauptstadt legt sie eine Straße ihres Musters nur,
  wenn die Zelle am Netz des Lagers liegt oder mit einer Zufahrt aus höchstens `roadLink` = 12 neuen Zellen im selben Takt angeschlossen wird (`linkPaths`);
  Gebäude kommen nur an Straßen dieses Netzes (Wohnen und Gewerbe auch über ein Nachbarhaus gleicher Art), Großbauten und Werke nie mehr an eine Straße ohne Weg.
  So entstehen an der Hauptstadt keine Straßen-Inseln.
  Viertel an vorderen FOBs bleiben eigene kleine Netze (Wohnen und Gewerbe, nie Werke).
  **(3) Spuren (`aiLanes`):** Liegt die Last einer Straßenzelle `laneTurns` = 2 Ausbautakte in Folge über `laneLoad` = 1,0 × Kapazität,
  legt die KI eine Straße daneben (Straßen nebeneinander = mehrspurig, §15), die am stärksten überlastete Zelle zuerst, höchstens `laneStep` = 2 Zellen je Takt,
  nur mit `laneBm` = 300 Baumaterial im Lager (Straßen kosten kein Geld); freie Zellen neben Straßen ab `laneKeep` = 0,6 × Kapazität bebaut sie nicht.
  Eine Zelle ohne Platz ruht `laneRetry` = 60 s. **(4) Überschuss (`highStock`):** Liegt eine Ware über 2500 im Lager,
  baut sie kein weiteres Werk dafür (es kostete nur Einfuhrgeld und Straßenkapazität).
  Gemessen (KI gegen KI, 25 min, Mittel je Stadt, vorher → nachher): klassisch normal (12 Seeds) Werke ohne Weg 7,2 → 0,0, Ankunftsanteil 68 % → 79 %, angekommene Rohwaren 55 → 74 je s,
  Werke 47 (davon 40 mit Weg) → 43, Ausbildung 54 → 55, Abschüsse 82 → 87; schwer (4 Seeds) 0,5 → 0, 62 % → 76 %, 50 → 99 je s, Werke 40 → 52, Ausbildung 70 → 64, Abschüsse 49 → 60;
  Baugebiet (4 Seeds) 1,8 → 0,1, 57 % → 64 %; Eroberung mit 4 KIs (3 Seeds) 4,9 → 0, 69 % → 72 %, 62 → 81 je s. Verworfen: Häuser für eine Spur abreißen (kein Gewinn, 4 Werke weniger),
  Zufahrt nur 1 oder 4 Zellen (Stadt bleibt klein: 24 bzw. 33 Werke), zusätzliche Straßenspalten alle 8 Zellen (kein Gewinn),
  Netzwachstum ohne Überschuss-Regel (Einfuhr 27 statt 17 Geld je s, Ausbildung 55 → 50).
  Straßen bleiben später der Engpass an Stellen, wo Werke beidseitig stehen (dort ist kein Platz für eine Spur).
  Tests: `test/citynet.test.js`.
- **Straßen:** Schutt ihrer eigenen Straßen räumt die KI mit einem freien Baufahrzeug (alle 10 s, der Schutt nächst der Hauptstadt zuerst, nicht in der Nähe sichtbarer Gegner).
  Sie beschießt selbst keine Straßen und reißt keine gegnerischen ab.
- **Keine Su-27:** Die KI baut die Su-27 (Paket „Su-27“, §6) nicht, auch nicht, wenn Geld übrig ist; sie kauft weiterhin nur F-16, F-22 und A-10.
- **Überfälle auf Städte (Stadt-KI, `aiRaid`):** Ziel ist die Stadt des lebenden Gegners,
  dessen Hauptstadt der eigenen am nächsten liegt (bei Gleichstand das Team mit der kleineren Nummer; mit zwei Teams gibt es nur einen); in der Eroberung nur Städte mit offenem Viertel.
  Gegner bestimmt `enemiesOf` (`js/game/teams.js`), ausgeschiedene Teams zählen nicht.
- **F-22 und U-2 (seit v5.83):** Von ihren Kampfflugzeugen (`CITY.ai.jets`) bestellt die KI den Anteil `CITY.ai.f22Share` (0,4) als F-22, wenn Geld für F-22 und `jetReserve` da ist,
  sonst F-16 (`jets()` in `js/ai/army/combat.js`).
  F-22 fliegen nur gegen Luftziele (Hubschrauber, Flugzeuge, U-2), sonst patrouillieren sie über die Zone.
  Die U-2 (`recon()`) kauft sie höchstens einmal gleichzeitig (`reconMax`), ab `reconFrom` (Leicht nie), nur auf einem ganz freien Stellplatz und mit `jetReserve` danach;
  die Stadt-KI hält dafür einen Stellplatz frei.
  Startbereit fliegt sie im Wechsel über die Konfliktzone und die gegnerische Hauptstadt und kreist dort; höchstens alle `reconEvery` s ein Flug.
- **Fliegerhorst mit Anschlusspflicht (Baugebiet):** Die Bahn braucht keinen Anschluss (Paket „Fliegerhorst-Anschluss“; der frühere Schalter `CITY.ai.runwayLink` ist entfallen).
  Stellplätze und Tower legt die KI neben die Bahn, ohne Straße;
  Kerosintank und Munitionslager legt sie neben die Bahn und zieht vorher eine Straße von ihnen zum Lager (`connectCells`, bezahlt;
  gelingt sie nicht, bleibt der Platz frei und ein späterer Takt versucht einen anderen).
  Die Bahn darf außerhalb des eigenen Gebiets liegen, die Stelle der ersten beiden Stellplätze daneben muss aber im Gebiet erlaubt sein (seit v5.116;
  vorher entstand manchmal eine Bahn draußen, an der nie ein Stellplatz gebaut werden konnte).
  Fehlt ein Kerosintank oder Munitionslager, holt sie das in späteren Takten nach.
  Steht eine Bahn ohne jeden Stellplatz, an der keiner mehr passt, legt sie einen zweiten Fliegerhorst an (höchstens `CITY.ai.airportMax` = 2 Bahnen).
  Scheitert der Bau der Bahn an der besten Stelle, nimmt sie die nächste.
  Flugzeuge bestellt sie nur an Stellplätzen mit Versorgungsweg.
  Fehlt Stahl für ein Flugzeug, kauft sie ihn direkt vor der Bestellung am Markt zu (solange Preis und `jetReserve` bleiben).
  Solange sie eine U-2 haben darf und keine hat, hält sie einen ganz freien Stellplatz für sie frei.
  Ist eine F-22 fällig, spart sie auf sie, statt eine F-16 zu kaufen.
  Gemessen (30 min KI gegen KI, Normal): in Seed 7 je Team F-16, F-22 und eine U-2 im Aufklärungsflug;
  in Seed 3 und 11 kommt die KI mit Baugebiet nicht zu einem angeschlossenen Fliegerhorst, weil ihr Straßennetz von eigenen Gebäuden eingeschlossen ist (offen).
- **Fliegerhorst und F-16:** Seit v5.35 baut die KI statt des Flughafens einen Fliegerhorst (Bahn 2 × 10, Stellplätze, Tower, Kerosintank, Munitionslager, §15 „Fliegerhorst“).
  Bis v5.34: Ab 14 Arbeitsstätten und freigeschalteter F-16 baut die KI einen Flughafen (`CITY.ai.airportFrom`; weil er selten zwischen ihre Straßenreihen passt,
  sucht sie das nächste freie 10 × 10-Quadrat bis 60 Zellen um die Hauptstadt, `airportReach`, und legt an der Seite zur Hauptstadt eine Straße an, ohne etwas zu überbauen),
  dann hält sie 2 / 4 / 6 F-16 (Leicht / Normal / Schwer, `CITY.ai.jets`), wenn danach 400 Geld übrig bleiben (`jetReserve`).
  Alle 6 s schickt sie startbereite Jets zu zweit los (`JET_EVERY`, `JET_GROUP`):
  zuerst gegen gesehene Hubschrauber und Flugzeuge, dann gegen Fahrzeuge in der Zone oder nahe ihrer Basis, sonst auf Angriffsmarsch über die Zone.
  Ihre Wellen, Verteidigung und Rückzüge führen Jets nicht.
- **Alarmrotte (Paket „Alarmrotte“):** Normal und Schwer lassen ihre Jets mit Luft-Luft-Waffe in Alarmbereitschaft (§15 „Alarmrotte“), Leicht schaltet sie ab
  (`BALANCE.difficulty[…].scramble`, Befehl `scramble` in `jets()`, `js/ai/army/combat.js`).
  Jets im Alarm schickt sie nicht zusätzlich auf eigene Einsätze.

### KI-Konstanten (Quelle: `js/data/ai.js` (Armee), `CITY.ai` in `js/data/city.js` (Stadt), `BALANCE.difficulty` in `js/data/balance.js`; hier zum Nachschlagen für Erweiterungen)

Seit dem Paket „Struktur“ stehen auch die übrigen Stellwerte der Armee-KI (Abstände, Schwellen, Takte; 76 Konstanten wie `RETREAT_*`, `CLUMP_*`, `DEF_RING_*`, `PEND_*`) in `js/data/ai.js`,
je Zeile mit Kommentar; die Tabelle nennt nur die wichtigsten.

| Bereich | Konstante | Wert |
|---|---|---|
| Takt | Denkschritt `think` | Leicht 3 s · Normal 2 s · Schwer 1 s |
| Luftabwehr (seit v5.71) | Anteil je gesehenem Luftziel `AIR_PER` · höchstens `AIR_MAX` · Aufteilung `AIR_SPLIT` (Hubschrauber: Gepard 60 %, Flak 40 %; Flugzeuge: SAM 70 %, Gepard 30 %) · Gedächtnis je Luftart `AIR_MEMORY` | 4 % · 25 % · 120 s |
| Scharfschützen (seit v5.71) | ab gesehenen Soldaten `SNIPER_FROM` · ab eigenen Kampfeinheiten `SNIPER_ARMY` · Anteil `SNIPER_SHARE` (nicht auf Leicht) | 10 · 12 · 4 % |
| Artillerie (seit K2) | Ab `ARTY_ARMY` 12 · Mörsertrupp `MORTAR_MAX` 2 · Raketenwerfer `MLRS_MAX` 1 · nur mit Geldreserve `ARTY_MONEY` 1500 nach dem Kauf · Zielwahl `ARTY_FIRE_EVERY` 4 s · Gruppe `ARTY_GROUP` 3 im Umkreis `ARTY_GROUP_R` 120 px | siehe §10 |
| Luft (seit K3) | Drohne ab `DRONE_ARMY` 10 und `DRONE_FROM` 240 s, Geld `DRONE_MONEY` 800 | siehe §10 |
| Luft (seit K3) | Kamikazedrohnen `FPV_MAX` 2 ab `FPV_ARMY` 12, Geld `FPV_MONEY` 600, Ziel `FPV_NEAR` 400 px, Takt `FPV_EVERY` 6 s | siehe §10 |
| Luft (seit K3) | A-10 ab `CITY.ai.a10Heavy` 4 gesehenen schweren Fahrzeugen, `CITY.ai.a10Share` 0,25, Geld `CITY.ai.a10Reserve` 1000 | siehe §10 |
| Pioniere (seit K4) | ab `SAPPER_ARMY` 12 · höchstens `SAPPER_MAX` 2 · Geld `SAPPER_MONEY` 800 · Minen alle `MINE_EVERY` 15 s je Pionier · Strecke `MINE_FROM` 0,3 bis `MINE_TO` 0,85 · Straße `MINE_ROAD` 60 px · Abstand zu Gebäuden `MINE_BLDG` 50 px | siehe §10 |
| Unterstützer (seit K1) | Sanitäter `MEDIC_EVERY` 8 · `MEDIC_MAX` 3 · MANPADS `MANPADS_SPLIT` 40 % · `MANPADS_MAX` 4 · Flammenwerfer `FLAMER_MAX` 3 · Aufklärungsfahrzeug ab `RECON_ARMY` 10 | siehe §10 |
| Unterstützer (seit K1) | Bergepanzer ab `RECOVERY_VEH` 5 Fahrzeugen · Störsender `JAM_TARGETS` · Begleiter `ESCORT_EVERY` 10 s, `ESCORT_DIST` 250 px · Sonderziele zusammen `SHARE_CAP` 60 % | siehe §10 |
| Artillerie | Anteil `ART_SHARE` · ab Kampfeinheiten `ART_FROM` · Abstand hinter der Armee `ART_BEHIND` · Stellungswechsel `ART_EVERY` | 6 % · 15 · 450 px · 5 s |
| Angriff | `attackStrength` (Wert der angreifenden Einheiten in Geld) | Leicht 2500 · Normal 2000 · Schwer 1600 |
| Angriff | Verhältnis zur Zonenbesatzung (`WAVE_ODDS`) | 1,2 |
| Angriff | Geduld bis zur Untergrenze (`WAVE_PATIENCE` / `WAVE_MIN`) | 600 s / 60 % |
| Eroberung (§7 „Eroberung“, `js/ai/army/conquest.js`) | Wache je eingenommener Flagge `CQ_HOLD` · Takt der Marschbefehle `CQ_EVERY` · Flagge des Führenden wirkt näher `CQ_LEADER` | 2 · 6 s · 1500 px |
| Eroberung (§7 „Eroberung“, `js/ai/army/conquest.js`) | neutrale Flagge näher `CQ_NEUTRAL` · Zuschlag je gegnerischer Einheit im Gebiet `CQ_GUARD` · Takt der Wahl des Erscheinungsorts `CQ_SPAWN_EVERY` | 1000 px · 220 px · 15 s |
| Angriff | Reserve an der Hauptstadt (`RESERVE`, ab `RESERVE_FROM` Einheiten) · Welle bei neutraler Zone schon ab (`WAVE_NEUTRAL`) | 20 % ab 5 · 60 % der Stärke |
| Besatzungsschätzung | mittlerer Einheitenwert (`THREAT_PER_UNIT`) | 150 Geld |
| Sammelpunkt | Abstand von der Hauptstadt zur Zone / von der Zonen-FOB zur Basis | 300 px / 150 px |
| Armeemischung | Schützen / PAK / SPz / KPz (`MIX`) | 50 / 20 / 20 / 10 % |
| Konter-Mix | Mindestzahl gesehener Gegner / Gewicht / Mindestanteil (`COUNTER_MIN`, `COUNTER_WEIGHT`, `COUNTER_FLOOR`) | 8 / 0,8 / 5 % |
| Späher | Start ab / Mindestarmee / Heimflug unter / Tankziel / Flugbefehl alle (`SCOUT_EVERY`) ab Abstand (`SCOUT_MOVE`) | 180 s / 10 Einheiten / 35 % / 90 % / 8 s ab 120 px |
| Wetter | schlechte Sicht unter (`WX_SCOUT_SIGHT`): Späher ab / Mindestarmee · Nebel bis (`WX_FOG_SIGHT`): Wellenstärke | 90 % : 90 s / 5 Einheiten · 70 % : 85 % |
| Forschung | ab Spielzeit (`research[0]`) · doppelte Reserve ohne `upgrades` | Leicht 240 s · Normal 150 s · Schwer 90 s · Leicht doppelt |
| Forschung | Reserve danach (`UPGRADE_RESERVE`) · Reihenfolge der Äste (`UPGRADES`) | 400 Geld · Kampfpanzer, Infanterie, Schützenpanzer/Flugabwehr, Elektronik, Stellungen, Luftwaffe, Logistik |
| Brücken | Takt (`BRIDGE_EVERY`) / Geld danach (`BRIDGE_RESERVE`) | 10 s / 150 Geld |
| Flankenangriff | Mindestbesatzung / Anteil | 12 / 30 % |
| Gruppen-Rückzug | Wertverhältnis / Mindestgegner / Strecke / Angriffssperre | 1,8 / 4 / 1400 px / 30 s |
| Expansion | FOB-Grenze Leicht/Normal/Schwer · Relais-Abstand · Flanken-FOB-Abstand | 3/5/7 · 1000 px · 1000 px |
| Zonen-FOB | Sperre nach Verlust (`ZONE_BAN`) · Suche bis Zonenradius + (`ZONE_REACH`) | 150 s · 900 px |
| Ausbildung | Warteschlange je Gebäude ab Geld (`QUEUE_RICH`): lang / sonst (`QUEUE_LONG`, `QUEUE_SHORT`) | ab 900: 4 / 2 |
| LKW | Versorger ab Kampfeinheiten (`SUPPLY_FROM`) · Pendler je Außen-FOBs, höchstens (`PEND_PER`, `PEND_MAX`) · Soll-Lager Zonen-FOB / Hauptstadt / übrige BM·MUN·TS (`FOB_WANT`, Festung `FORT_WANT` dazu) | 15 · 2, 3 · 400·300·150 / 300·200·200 / 300·150·80 |
| Pendler am Werk (seit v5.70) | Werk als Quelle, wenn es höchstens so weit wie die beste FOB-Quelle × `WORK_SOURCE_NEAR` von der Bedarfs-FOB liegt (oder keine FOB Überschuss hat) | 0,5 |
| Pendler am Werk (seit v5.70) | KI-LKW je Werk höchstens `WORK_SOURCE_TRUCKS` | 1 |
| Pendler am Werk (seit v5.70) | Werk liefert, wenn Ausstoß ≥ `WORK_SOURCE_MIN_RATE` (Ware je s) oder Ausgangslager ≥ `SURPLUS_MIN` | 0,2 je s / 120 |
| Bedrohung | Reaktionsreichweite / FOB-Gefahrenradius | 900 px / 600 px |
| FOB-Fahrzeug | gleichzeitig (`FOBV_MAX`) / Aufbau-Nähe (`DEPLOY_REACH`) / Neuversuche (`FOBV_RETRY`) / Sperre fehlgeschlagener Orte (`BAD_TIME`) | 1 / 64 px / 3 / 240 s |
| Mauer | Abstand von der Hauptstadt / halbe Länge / Pause nach fertiger Linie (`WALL_RETRY`) | 4 / 3 Zellen (Tor aus 2 Feldern in der Mitte) / 110 s |
| Rückzug (Vorrat) | Einheiten unter diesem Vorratsanteil ziehen sich zurück | 20 % |
| Häuserkampf | Anteil der Infanterie in der Zone / Umkreis / Takt (`GARRISON_SHARE`, `GARRISON_RANGE`, `GARRISON_EVERY`) | 40 % / 500 px / 8 s |
| Häuserkampf II (seit v5.67) | Sturm: Takt / Umkreis / Stürmer je Besatzer (`STORM_EVERY`, `STORM_RANGE`, `STORM_RATIO`, Stacheldraht `STORM_WIRE`) | 8 s / 450 px / 2 (×1,5) |
| Häuserkampf II (seit v5.67) | mindestens (`STORM_MIN`) / höchstens (`STORM_MAX`) / auch Infanterie im Angriffsmarsch mit Ziel in der Zone (`STORM_MARCH`) | 3 / 8 / ja |
| Häuserkampf II (seit v5.67) | Ausbau: Takt / Reserve nach dem Preis (`HOUSE_WORK_EVERY`, `HOUSE_WORK_RESERVE`) / Reihenfolge (`HOUSE_WORK_ORDER`) | 10 s / 400 Geld / Sandsäcke, Stacheldraht, MG-Nest |
| Versorgungskisten | Takt / Umkreis / Holer gleichzeitig Leicht–Normal–Schwer (`CRATE_EVERY`, `CRATE_RANGE`, `difficulty.cratePickers`) | 6 s / 5500 px / 1–2–3 |
| F-22-Anteil an den Kampfflugzeugen (seit v5.83) | `CITY.ai.f22Share` | 0,4 |
| U-2 zur Aufklärung (seit v5.83) | höchstens gleichzeitig (`reconMax`) · ab Spielzeit (`reconFrom`, Leicht nie) · Takt der Flüge (`reconEvery`) | 1 · 600 s (Schwer 480 s) · 300 s |
| Flugzeuge (seit v5.03) | Fliegerhorst ab Arbeitsstätten (`CITY.ai.airportFrom`) · F-16 Leicht/Normal/Schwer (`CITY.ai.jets`) · Geld danach (`jetReserve`) · Gruppe / Takt / Warteschlange (`JET_GROUP`, `JET_EVERY`, `JET_QUEUE`) | 14 · 2/4/6 · 400 · 2 / 6 s / 2 |
| Stadt: Anschlusspflicht (Paket „Straßen“; Netz verlängern nur mit Baugebiet, offene Ausgänge auch ohne, Paket „Offenes Netz“) | Netz verlängern unter so vielen freien Anschlusszellen (`CITY.ai.linkSpare`) · Baumaterial-Polster (`linkBm`) | 6 / 200 BM |
| Stadt: Anschlusspflicht (Paket „Straßen“; Netz verlängern nur mit Baugebiet, offene Ausgänge auch ohne, Paket „Offenes Netz“) | Versuche je Takt / Pause nach Fehlschlag (`linkTries`, `linkRetry`) · offene Ausgänge (`linkOutlets`) | 4, 120 s / 2 |
| Stadt: Einfuhr (Paket „Import“) | Straße zum Kartenrand, wenn kein Einfuhrpunkt erreicht (`aiEdge`) · Länge (`CITY.transport.connectMax`) | 30 Zellen |
| Stadt: Industriepark, Bau (Paket „Industriepark“) | ab `CITY.ai.stationFrom` je Schwierigkeit (leicht nie) · Werke mit Leistung vorher `stationWorks` · Geld über der Reserve `stationMoney` | 300 s normal, 240 s schwer · 2 · 100 |
| Stadt: Industriepark, Bau (Paket „Industriepark“) | Baumaterial nach dem Bau `stationBm` · Pause nach abgelehntem Befehl oder ohne Platz `stationRetry` | 200 BM · 120 s |
| Stadt: Industriepark, Platz und Anschluss | Gleiskette bis zum Kartenrand `railMax` · Zufahrt zum Lagernetz höchstens `parkLink` · Gewicht je Zelle Zufahrt `parkLinkCost` · Gewicht Abstand zum nächsten Werk `stationNear` | 40 Zellen · 12 · 2 · 1 |
| Stadt: zweiter Park | höchstens `stationMax` · Einfuhrmangel unter `importLow` (Anteil der Leistung) für `importWait` · Einfuhrskala ab `importScaleMin` · ausgelastet ab `stationBusy` (Anteil des Durchsatzes) | 2 · 0,7, 60 s · 0,9 · 0,9 |
| Stadt: Straßennetz (Paket „Straßennetz der KI“) | Wachstum nur vom Netz des Lagers (`CITY.ai.netRoads`) · längste Zufahrt einer Musterstraße (`roadLink`) · Überschuss: kein weiteres Werk über (`highStock`) | an · 12 Zellen · 2500 |
| Stadt: Spuren | überlastet ab Last ÷ Kapazität (`laneLoad`) · Takte in Folge (`laneTurns`) · Zellen je Takt (`laneStep`) · geprüfte Zellen je Takt (`laneTries`) | 1,0 · 2 · 2 · 12 |
| Stadt: Spuren | Baumaterial im Lager (`laneBm`) · Platz freihalten ab (`laneKeep`) · Pause ohne Platz (`laneRetry`) | 300 BM · 0,6 · 60 s |
| Stahl am Markt (Paket „Knappes Geld“) | Kauf nur bei offenem Stahlbedarf einer Ausbildung (`steelWait`) · Geld für Fahrzeug und Los · Lospreis höchstens `metalMaxPrice` × Grundpreis |
| Festung (seit v5.164) | Verteidigung außerhalb des Rings ab `FORT_CLEAR` 224 px · Hubschrauber vor Drohne · Stahldeckel für den Hubschrauber `CITY.ai.metalMaxPriceHeli` 2,0 |
| Straßen räumen (Paket „Straßen“) | Takt (`ROAD_REPAIR_EVERY`) · kein Räumen bei sichtbaren Gegnern näher als (`ROAD_REPAIR_SAFE`) | 10 s / 400 px |
| Stellwerte der Armee-KI (Paket „KI-Zahlen in die Daten“) | Höhensuche: Punkte auf dem Kreis (`HIGH_SAMPLES`) · Zonen-FOB gilt bis `ZONE_FOB_R` + `ZONE_FOB_SLACK` · Haubitzen je Reihe (`ART_COLS`) · Verteilen an der Zone ab (`CLUMP_MIN`) Einheiten | 8 · 16 px · 3 · 2 |
| Stellwerte der Armee-KI (Paket „KI-Zahlen in die Daten“) | „draußen“ ab `GATHER_DIST` × `FIELD_MUL` · Kommandeur am Ziel bis `CMD_MOVE` × `CMD_ARRIVED` · F-16 gegen Panzer bis `DEF_RANGE` × `JET_ARMOR_RANGE` · Stahl-Lose vor einer Flugzeugbestellung (`JET_STEEL_LOTS`) | 2 · 0,5 · 2 · 10 |
| Stellwerte der Stadt-KI (Paket „KI-Zahlen in die Daten“) | Ausbau-Umkreis (`CITY.ai.growRing` × `territory.building`) · Ring × `ringWeight` + Abstand · Großbau-Versuche (`bigTries`) · Reihe an der Bahn (`airportRow`) | 4 · 100 · 8 · 2 Stellplätze, Tower |
| Stellwerte der Stadt-KI (Paket „KI-Zahlen in die Daten“) | Grundriss des Industrieparks `CITY.parkPlan` (9 × 5, Bahnhof in der Mitte, Gleis nach unten) · Fliegerhorst-Geometrie aus `CITY.air.runwayWidth` und `CITY.size.stand` | – |

Prüftest `test/literals.test.js` („js/ai: keine Spielwerte als Zahlenliterale“, ebenso für `js/game`): in `js/ai` sind außer 0, 1, 2 und 0,5 keine Zahlenliterale
erlaubt; Ausnahmen (Geometrie, Rechengenauigkeit, Sortierschlüssel) stehen begründet in `ALLOWED`.
