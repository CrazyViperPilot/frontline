# Frontline PRD – Einheiten, Waffen und Schaden

> Teil des PRD, Abschnitte §6 (Wertetabellen erzeugt `npm run docs`). Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 6. Einheiten

> Zahlen zu Preis, Ausbildung, HP, Tempo, Sicht, Reichweite, Schaden, Kadenz, Munition,
> Treibstoff, Taste, Stahl, Einwohner und Ausbildungsgebäude der Stadt stehen nur in den erzeugten Tabellen „Werte“ und „Waffen und Schaden“ weiter unten
> (Quelle `js/data/`; Stahl, Einwohner und Gebäude aus `CITY.metalCost`, `CITY.crew` und `CITY.produces` in `js/data/city.js`).
> „Plätze“ in der Werte-Tabelle ist der Platzbedarf im Einheitenlimit; die Sitze für Passagiere (`seats`) nennt der Text.

| Einheit | Gebaut in | Rolle |
|---|---|---|
| Schütze | Hauptstadt | Billige Infanterie, stark gegen Infanterie; trägt 50 Baumaterial, baut daraus Mauern und Tore |
| Sanitäter | Hauptstadt, Kaserne | Unbewaffnete Infanterie; heilt jede Sekunde 6 HP der am stärksten verletzten eigenen Infanterie im Umkreis von 90 px (nicht sich selbst, nicht in Häusern oder Fahrzeugen) |
| Bergepanzer | Fabrikhalle | Unbewaffnetes Fahrzeug; repariert jede Sekunde 15 HP je eigenem Fahrzeug im Umkreis von 60 px (keine Luftfahrzeuge) aus dem Baumaterial des Teamlagers; untätig fährt er zum nächsten beschädigten Fahrzeug in 200 px |
| Pionier | Kaserne | Infanterie mit Gewehr; Befehl Mine legen (Taste Q) setzt getarnte Panzerminen (40 Munition, höchstens 6 je Pionier), die nur gegnerische Fahrzeuge auslösen; räumt gegnerische Minen in 40 px nach 3 s. Minen: js/game/mines.js. |
| Panzerabwehrsoldat | Hauptstadt | Langsam feuernd, stark gegen Fahrzeuge und Gebäude; baut Mauern und Tore |
| MANPADS-Soldat | Hauptstadt, Kaserne | Infanterie mit Flugabwehrrakete zu Fuß; schießt nur auf Luftziele; zählt zur Flugabwehr-Forschung |
| Flammenwerfer | Kaserne | Infanterie mit Flammenstrahl; Splash 25 (halber Schaden im Umkreis), Schaden Soldat hoch, Gebäude mittel, Fahrzeuge gering; gegen Besatzer eines Stadthauses ×2 auf den Spill-Schaden |
| Mörsertrupp | Kaserne | Infanterie mit leichtem Mörser zu Fuß, langsam; Feuer auf Punkt (G) und Ziel löschen (C) wie die Panzerhaubitze; Mindestreichweite 150, Splash 60, Schaden wie das Mörser-Gebäude |
| Scharfschütze | Hauptstadt | Getarnt (Ghillie-Anzug), sehr große Reichweite, **ein Treffer tötet jeden Soldaten**, aber nur selten ein Schuss; gegen Fahrzeuge und Gebäude fast wirkungslos; baut nicht, kann als Passagier mitfahren |
| LKW | Hauptstadt | Unbewaffnet, schnell, **2 Soldaten** Platz. **Logistik:** lädt Ressourcen an einer FOB (400), bringt sie zu einer anderen FOB, pendelt auf Routen, versorgt Truppen im Feld |
| Aufklärungsfahrzeug | Fabrikhalle | Leichtes, schnelles Fahrzeug mit leichtem MG und **2 Soldaten** Platz; **getarnt nach 3 s Stillstand** (Regel wie beim Scharfschützen: Gegner sehen es nur nahe an eigenen Einheiten/Gebäuden oder 4 s nach einem Schuss); fahrend immer sichtbar |
| Baufahrzeug | Hauptstadt | Unbewaffnet, **1 Soldat** Platz. Baut alle Gebäude außer FOBs (seit v5.09), repariert |
| Bagger (seit v5.35, Daniels Wunsch) | Fabrikhalle | Leicht gepanzert, langsam. (weiter unten) |
| FOB-Fahrzeug (seit v5.09) | Fabrikhalle | Unbewaffnet, langsam. **Aufbauen (D):** wird an seiner Stelle sofort zur fertigen FOB mit 20 % Lager je Sorte (§4) |
| Schützenpanzer | Hauptstadt | **6 Soldaten** Platz. Schnell, gut gegen Infanterie und leichte Fahrzeuge |
| Kampfpanzer | Hauptstadt | Teuer, schwer gepanzert, stark gegen alles (Hauptkanone trifft keine Hubschrauber, das MG schwach) |
| Little Bird | Hauptstadt | Unbewaffnet, schnell, **5 Passagiere** (Infanterie, Baufahrzeug) |
| Aufklärungsdrohne (Paket E10) | Heliport | Unbewaffnet, **keine Passagiere**, deckt Nebel auf (Sicht siehe Tabelle „Werte“), tankt auf dem Heliport |
| Kamikazedrohne (Paket E11) | Heliport | Einweg, **keine Passagiere**; Angriffsbefehl auf Fahrzeug/Gebäude: fliegt hin, explodiert bei Kontakt (700 schwer, 500 leicht, 300 Gebäude, Splash 30) und ist danach weg |
| Transporthubschrauber | Hauptstadt | Unbewaffnet, **9 Passagiere** und **400 Ressourcen** (laden/entladen/pendeln wie ein LKW) |
| AH-64 (Kampfhubschrauber) | Hauptstadt | Bordkanone und Raketen (Tabelle „Waffen und Schaden“), Nachtanken/-laden in einer FOB |
| Flakpanzer (seit v4.54) | Hauptstadt | Schnellfeuer-Flak gegen Hubschrauber, schießt nur auf Luftziele. (weiter unten) |
| SAM-Startrampe (seit v4.54) | Hauptstadt | **Vier wärmesuchende Raketen** gegen Hubschrauber (nur Luftziele), Schuss, Munition und Nachladezeit in der Waffen-Tabelle. Little Bird 1 Treffer, Transporthubschrauber und AH-64 2 Treffer. (weiter unten) |
| Flakpanzer Gepard (seit v5.19) | Fabrikhalle | Such- und Feuerleitradar. (weiter unten) |
| Panzerhaubitze (seit v5.19, nach der Panzerhaubitze 2000) | Fabrikhalle | **Haubitze 155 mm** (Werte in der Waffen-Tabelle): (weiter unten) |
| Raketenwerfer (Paket E6) | Fabrikhalle | Wie die Panzerhaubitze. **Raketensalve**: 12 Raketen im Abstand 0,25 s (`salvo`), danach Nachladen (Tabelle „Waffen und Schaden“); nicht näher als 400 px, Streuung 120 px, Splash 60 px. (weiter unten) |
| F-16 (Kampfflugzeug, seit v5.03) | Stellplatz des Fliegerhorsts (seit v5.35; vorher Flughafen; zwei je Stellplatz) | **Vier Raketen (seit v5.41):** (weiter unten) |
| F-22 (Luftüberlegenheitsjet, seit v5.82) | Stellplatz des Fliegerhorsts (F-16, F-22, Su-27 und A-10 teilen sich die zwei Plätze je Stellplatz) | **Luft-Luft-Lenkraketen** (Schuss, Munition und Trefferchance in der Waffen-Tabelle), (weiter unten) |
| A-10 (Erdkampfflugzeug, Paket E12) | Stellplatz des Fliegerhorsts (die Plätze teilen sich F-16, F-22, Su-27 und A-10) | **Eine Bordkanone** nur gegen Bodenziele (Infanterie, Fahrzeuge, Gebäude; Werte in der Waffen-Tabelle); keine Luftziele. (weiter unten) |
| C-130 (Transportflugzeug, Paket E13) | Stellplatz des Fliegerhorsts (die Plätze teilen sich mit den Kampfjets) | Unbewaffnet, **zehn Passagiere** (nur Infanterie), Einsteigen am geparkten Jet; (weiter unten) |
| Su-27 (Kampfflugzeug, Paket „Su-27“) | Stellplatz des Fliegerhorsts (die zwei Plätze je Stellplatz teilen sich F-16, F-22 und Su-27) | Wie die F-16 (gleiche Raketenarten, Werte in der Waffen-Tabelle): (weiter unten) |
| U-2 (Höhenaufklärer, seit v5.83) | Stellplatz des Fliegerhorsts; belegt den **ganzen Stellplatz allein** (`standSlots: 2`, kein anderes Flugzeug darauf) | **Unbewaffnet**, Treibstoff in der Tabelle „Werte“. (weiter unten) |
| Kommandeur (Held, seit v4.49) | Hauptstadt | **Einmalig je Team**, belegt **keinen Platz**, jedes Team startet mit ihm (hinten an der Hauptstadt). Maschinenpistole (schwach). (weiter unten) |

- **Bagger (seit v5.35, Daniels Wunsch):** Befehl **Baggern (G)**: danach eine Zelle anklicken (Shift: weitere anhängen); der Bagger fährt hin (bis 54 px), arbeitet an der Zelle (Arbeitszeit
  je Zelle in `BALANCE.excavator`; solange er arbeitet, quillt eine Staubwolke auf, seit v5.77, nur Bild) und räumt sie: **Zonenstraßen der Karte** verschwinden für beide Seiten
  (Brückenfahrbahnen nicht; dort kein Straßentempo mehr, Wege und Stadtanschlüsse neu), Bäume und leere Häuser wie mit Räumen, **eigene Stadtgebäude** reißt er ab.
  Gegnerische Gebäude zerstört er langsam mit der **Schaufel** (nur Gebäude, Werte in der Waffen-Tabelle).
  Seit dem Paket „Straßen“ räumt er auch **Schutt** zerstörter Straßen (die Straße ist wieder da) und **reißt gegnerische Straßen ab** (ohne Schutt, die Zelle ist frei).
  Befehl `dig` (`js/game/excavator.js`)
- **Flakpanzer (seit v4.54):** **Trefferchance** der Flak (Tabelle „Waffen und Schaden“) × Tempo-Faktor speedRef / (speedRef + Tempo des Ziels in px/s), speedRef 120, und ×
  Entfernungs-Faktor (bis −30 % am Waffenrand).
  Kampfflugzeuge trifft sie mit demselben Schaden wie Hubschrauber (ohne eigenen Wert gegen Jets gilt der Wert gegen Luftziele), wegen der geringen Trefferchance aber selten; dafür ist der
  Gepard da.
  Verfehlte Schüsse kosten trotzdem Munition.
- **SAM-Startrampe (seit v4.54):** Trefferchance ohne Tempo-Abzug (die Rakete folgt der Wärme), nur Entfernung (bis −30 %).
- **Flakpanzer Gepard (seit v5.19):** **Zwillingskanone 35 mm** (Werte in der Waffen-Tabelle): Trefferchance mit Tempo-Faktor speedRef 400 (die Flak hat 120), damit trifft auch die schnelle
  F-16 gut (Formel wie bei der Flak: Trefferchance × speedRef / (speedRef + Tempo des Ziels)).
  Bevorzugt Luftziele, gegen leichte Bodenziele brauchbar, gegen Panzer kaum.
  Zählt in der Forschung zur Gruppe Gepard und zur Flugabwehr
- **Panzerhaubitze (seit v5.19, nach der Panzerhaubitze 2000):** Granaten mit Flugzeit, nicht näher als 260 px, Splash 75 px, Streuung bis 70 px um den Zielpunkt, Fluggeschwindigkeit 480
  px/s, nichts gegen Luftziele.
  Sucht Ziele über ihre ganze Reichweite, braucht aber die **Sicht des Teams** (Späher, andere Einheiten, Gebäude).
  **Feuer auf Punkt (G)** wie der Mörser (Befehl `mortarTarget` mit Einheiten), **Ziel löschen (C)**;
  Bewegen oder Stopp beendet es
- **Raketenwerfer (Paket E6):** **Feuer auf Punkt (G)** und **Ziel löschen (C)** wie die Panzerhaubitze (`mortarTarget`)
- **F-16 (Kampfflugzeug, seit v5.03):** zwei **Luft-Luft-Lenkraketen** nur gegen Hubschrauber und Flugzeuge und zwei **Luft-Boden-Raketen** gegen gepanzerte Fahrzeuge (bevorzugt), Gebäude
  und Infanterie (Werte in der Waffen-Tabelle); beide feuern unabhängig auf eigene Ziele (`parallel`), also bis zu vier Ziele je Einsatz.
  Heim fliegt sie, wenn alle vier verschossen sind (oder der Treibstoff knapp wird).
  **Fliegerhorst (§15 „Fliegerhorst“, seit v5.35):** ein Flugzeug je Stellplatz, Start und Landung auf einer gebauten Start-/Landebahn, Rollen über Straßen und Bahn, Tanken und Nachladen aus
  Kerosintank und Munitionslager in der Nähe, abgestellt angreifbar (Schutz je Stufe des Stellplatzes); fliegt immer (kreist im Abstand 280 px um seinen Befehlspunkt, dreht höchstens 2,4
  rad/s).
  **Treibstoff** (Tabelle „Werte“) gilt für Flug und Kreisen gleichermaßen (seit v5.14).
  Fliegt selbst zu ihrem Stellplatz zurück, wenn keine Rakete mehr da ist oder der Treibstoff für den Heimweg × 1,3 + 8 s nicht mehr reicht; dort tankt und lädt sie nach den Raten des
  Fliegerhorsts (`CITY.air`: Kerosintank 3/s und Munitionslager 6/s in Stufe 1; Kerosin aus dem Stadtlager, seit v5.20) und wird repariert (4 %
  HP/s).
  Abgestellt steht sie auf ihrem Stellplatz und ist angreifbar (Schutz je Stufe des Stellplatzes, `CITY.air.shelter`); fällt der Stellplatz, ist sie verloren.
  Hat sie in der Luft keinen Treibstoff mehr, stürzt sie ab.
  Ein Befehl (Bewegen, Angriff, Angriffsmarsch) an eine startbereite F-16 lässt sie starten.
  **Start und Landung wie ein Flugzeug (seit v5.15):** sie rollt vom Stellplatz über den Rollweg zu Bahn 1 (wartet am Haltepunkt, bis die Bahn frei ist;
  Rolltempo 60 px/s), beschleunigt im Startlauf und hebt bei 62 % ihres Tempos ab, steigt in 3 s auf Reisehöhe (erst geradeaus).
  Zum Landen fliegt sie eine Platzrunde (Gegenanflug seitlich der Bahn, dann Endanflug mit 55 % Tempo), sinkt im Gleitpfad auf Bahn 2, setzt in der Aufsetzzone auf, rollt aus und rollt zu
  ihrem Stellplatz (Landerichtung von der Seite, auf der die Platzrunde in die Karte passt; verpasst sie die Zone, startet sie durch).
  Am Boden schießt sie nicht.
  Knopf **Landen (L)**, dann einen eigenen Stellplatz anklicken (oder Rechtsklick darauf): sie landet dort, auch auf einem anderen eigenen Fliegerhorst mit freiem Platz (Befehl `land`).
  (`BALANCE.jets`, `js/game/aircraft.js`).
  Flak trifft sie wegen des Tempos selten, die SAM normal
- **F-22 (Luftüberlegenheitsjet, seit v5.82):** nur gegen Hubschrauber und Flugzeuge.
  **Keine Luft-Boden-Raketen**: sie greift keine Panzer, Fahrzeuge oder Gebäude an, auch nicht Infanterie.
  Ihre Rolle ist das Luftüberlegenheitsjet; sie fliegt wie die F-16 (`jet`, eine Waffe), Treibstoff wie in der Tabelle.
  Leer geschossen fliegt sie heim und lädt am Munitionslager nach wie die F-16.
  Ausbildung am Stellplatz mit Stahl und Einwohnern (Tabelle „Werte“; `UNITS.f22`, `js/game/aircraft.js`).
  Die KI baut F-22 als Anteil `CITY.ai.f22Share` ihrer Kampfflugzeuge (Abschnitt „Flugzeuge“ in PRD §10).
- **A-10 (Erdkampfflugzeug, Paket E12):** Langsamer als F-16, F-22 und Su-27, Kreisen und Heimflug über die vorhandene Jet-Logik.
  Die KI baut sie, sobald sie genug gegnerische schwere Fahrzeuge gesehen hat (`CITY.ai.a10Heavy`, Abschnitt „Flugzeuge“ in PRD §10).
- **C-130 (Transportflugzeug, Paket E13):** Absetzen mit dem Fallschirm (Befehl `paradrop`, `js/game/paradrop.js`, Werte `dropReach`, `dropRadius`, `chuteTime` in `UNITS.c130`)
- **Su-27 (Kampfflugzeug, Paket „Su-27“):** Luft-Luft-Lenkraketen an den Flügelspitzen, nur gegen Hubschrauber und Flugzeuge, und Luft-Boden-Raketen unter den Flügeln (Panzer, Fahrzeuge,
  Gebäude), parallel feuernd.
  Mehr Treibstoff als die F-16 (Tabelle „Werte“).
  Ausbildung am Stellplatz mit Stahl und Einwohnern (Tabelle „Werte“; `UNITS.su27`, `js/game/aircraft.js`).
  Die KI baut keine Su-27 (Abschnitt „Flugzeuge“ in PRD §10).
- **U-2 (Höhenaufklärer, seit v5.83):** Sicht **1800 px in der Luft** (`airSight`; am Boden gilt die Sicht der Tabelle).
  **In der Luft nur die F-22 kann sie treffen** (Waffe mit `antiHighAlt`);
  Flak, SAM, Gepard, F-16, Hubschrauber, Gebäude und Granaten treffen sie nicht.
  Am Boden verwundbar wie ein Jet.
  Rolle: Aufklärung der Konfliktzone und der gegnerischen Hauptstadt.
  Befehl Ziel auf der Karte: kreist dort, bis der Treibstoff knapp wird, dann Heimflug (ohne Waffen fliegt sie nicht sofort heim).
- **Kommandeur (Held, seit v4.49):** **Aura 300 px:** eigene Einheiten darin schießen **10 % schneller** (Abklingzeit ÷ 1,1), verletzte Infanterie darin heilt **1,5 HP/s**, sobald sie 6 s
  nicht getroffen wurde (Fahrzeuge nicht).
  **Fällt er, bekommt der Gegner 5 Punkte** (klassisch; in der Eroberung verliert sein Team 5 Tickets, [eroberung.md](eroberung.md); kann die Partie entscheiden; auch als Passagier eines
  zerstörten Fahrzeugs).
  Danach bildet die Kaserne einen neuen aus (Ausbildung wie in der Tabelle); ein zweiter, auch in der Warteschlange, wird abgelehnt.
  Goldener Stern über der Figur (für beide Seiten sichtbar, soweit in Sicht), gewählt zeigt er den Aura-Kreis.
  Zählt nicht als Soldat für den Nachschub.
  `BALANCE.commander`, `js/game/commander.js`

**Forschung** (§7, wenn im Startmenü an): seit v5.04 sind alle Einheiten von Anfang an frei; der Forschungsbaum verbessert sie nur (Reichweite, Panzerung, Tempo, Treibstoff-Reichweite …).

**Aussehen:** Alle Einheiten sind kleine 3D-Modelle aus Grundkörpern (Kästen, Prismen, schräge Türme, Zylinder, Kugeln), die das Spiel selbst malt,
mit dem Licht der Gebäude (links oben) und etwas dunkleren bodennahen Flächen.
**Kampfpanzer** flache Wanne mit schrägem Bug, Kettenschürzen in Feldern, Keilturm mit Rundblickoptik, Zieloptik, Luken, MG, Nebelwurfbechern, Staukorb und langem Rohr mit Rauchabsauger;
**Schützenpanzer** (Puma) breite Wanne mit Schürzen, flacher unbemannter Turm mit 30-mm-Kanone und Lenkflugkörper;
**Gepard** Leopard-Wanne, Turm mit zwei 35-mm-Kanonen, Folgeradar vorn und Suchradar auf dem Mast; **Panzerhaubitze** großer Turm mit langem 155-mm-Rohr und Mündungsbremse;
**Flak** und **SAM** leichte Kettenfahrzeuge (Zwillingsflak mit Radar, angestellte Startbehälter mit roten Deckeln);
**LKW** Fahrerhaus mit Scheiben und Plane, **FOB-Fahrzeug** langer Aufbau mit gelben Rippen, Mast und Wimpel, **Baufahrzeug** Kettenfahrzeug mit gelbem Räumschild, Kabine und Baggerarm;
**Little Bird** Kuppelrumpf mit Kufen, **Kampfhubschrauber** schmaler Rumpf mit Stummelflügeln, Raketenbehältern und Bordkanone, **Transporthubschrauber** mit zwei Rotoren;
**F-16** mit Kanzel, Lufteinlauf, Luft-Luft-Lenkraketen an den Flügelspitzen und seit v5.41 Luft-Boden-Raketen unter den Flügeln (verschossene fehlen), Fahrwerk am Boden und Nachbrenner im Flug;
**Soldaten** mit Helm, Weste, Rucksack und Waffe (Gewehr, Panzerfaust, langes Gewehr mit Zielfernrohr und Tarnbüscheln, Kommandeur mit Barett und Funkantenne), gehend mit Bein- und Armbewegung.
Teams: Blau graublau, Rot rotbraun, Teamfarbe an Wimpel, Kennstreifen, Weste und Helmband.
Iso: Wanne in 16 Richtungen, der Turm getrennt in 16 Richtungen (folgt dem Ziel), Soldaten in 8 Richtungen; Schatten als Umriss am Boden, auch unter Hubschraubern und Jets.
2D: dieselben Modelle von oben, Turm frei drehbar.
Rotoren und Nachbrenner laufen live, Wracks sind dasselbe Modell verkohlt.
Jede Ansicht wird je Maßstab einmal gemalt und danach nur kopiert (`spritecache.js`), darum flüssig auf Handy und Tablet.
Fahrzeuge tragen ein **Materialfoto** (`js/render/materials.js`, CC0): Bodenfahrzeuge abgenutzten Lack mit Abplatzern und Schlieren,
Luftfahrzeuge leichte Patina, nur auf den Teilen in Teamfarbe; Ketten, Glas und Kleinteile bleiben glatt, Soldaten ohne Foto.
Nur Bild, Spielregeln unverändert.
Code: `js/render/unitpaint.js` (Einstieg), Modelle nach Familien in `js/render/units/`.

**Scharfschütze und Tarnung:** Der Scharfschütze ist getarnt:
Gegner sehen ihn nur, wenn eine ihrer Einheiten oder ein fertiges Gebäude näher als **160 px** an ihm steht, oder **4 s lang nach jedem seiner Schüsse**.
Unentdeckt wird er nicht angegriffen und ist weder auf der Karte noch auf der Minimap zu sehen (eigene Einheiten sehen ihn immer).
Er sieht weiter als Infanterie und sein Gewehr reicht bis zu seiner Reichweite (Tabelle), und Einheiten ohne Befehl schießen bis zu dieser Reichweite (nicht nur bis zur Leine von 300 px).
Ein Schuss verbraucht Munition (Waffen-Tabelle); mit seiner Reichweite und der Tarnung ist er gegen Infanterie stark, gegen Fahrzeuge, Gebäude und Hubschrauber nutzlos.
Die KI baut ihn auf Normal und Schwer (`SNIPER_SHARE`, PRD §10 „Scharfschützen“) und sieht ihn nach denselben Tarnregeln.
Er zählt zu den Soldaten für den Nachschub (Abschnitt 3).

**Hubschrauber** fliegen geradeaus über Gelände und Gebäude, brauchen Treibstoff beim Fliegen (ohne: 25 % Tempo) und sind Panzerklasse „Luft“ (Spalte Luft in der Waffen-Tabelle):
Flugabwehr (stark), Panzerabwehrsoldat, Raketen des AH-64, SPz-MG, Schütze, Panzer-MG und die FOB-MG treffen sie; Hauptkanone, Granatwerfer und Mörser nicht.
**Flugzeuge** (F-16) haben seit v5.15 eine eigene Schadensklasse „Flugzeug“ (`jet`; fehlt sie bei einer Waffe, gilt „Luft“):
**Soldaten treffen keine Flugzeuge** (Schütze, Panzerabwehr, Scharfschütze, Kommandeur), die MGs von Schützen- und Kampfpanzer sehr wenig, der Kampfhubschrauber mittel;
Flak, SAM und Flugabwehrstellungen wie gegen Hubschrauber.
**Parallel feuern:** Kampf- und Schützenpanzer (`parallel` in `js/data/units.js`) benutzen MG und Hauptwaffe gleichzeitig, jede Waffe auf ihr eigenes Ziel:
das MG auf Soldaten, die Hauptkanone bzw. der Granatwerfer auf Fahrzeuge und Gebäude; die Waffen blockieren sich nicht.
Beim Angriffsbefehl schießt die passende Waffe auf das befohlene Ziel, die andere nebenbei auf ihr eigenes.
Passagiere steigen per Rechtsklick auf den Hubschrauber ein und werden mit **O** am Zielpunkt abgesetzt;
stirbt der Hubschrauber, sind die Passagiere verloren.

Schadensmodell: Schaden je Schuss nach Panzerklasse des Ziels (Infanterie / leicht / schwer / Gebäude) – Werte in §6 „Waffen und Schaden“. Höhenvorteil siehe §7 „Gelände“.

**Preislogik (seit Paket „Balance-Preise“):** Infanterie ist das Rückgrat einer Armee und bleibt günstig; Fahrzeuge und Flieger sind teure Entscheidungen, die Kampfflugzeuge am teuersten.
Mit Stadt kosten Fahrzeuge und Flieger zusätzlich Stahl aus dem Stadtlager, jede Einheit dazu Einwohner (Spalten „Stahl“ und „Einwohner“ der Tabelle „Werte“).
Die Preise stehen in der Tabelle „Werte“ und in `js/data/units.js` (`cost.money`).

### Werte (Quelle: `js/data/units.js`, `js/data/buildings.js`, `js/data/balance.js`, `js/data/city.js`)

Die Tabellen „Werte“ und „Waffen und Schaden“ erzeugt `npm run docs` aus `js/data/` (`tools/doc-tables.mjs`); zwischen den Markierungen nichts von Hand ändern.
Ein Test meldet, wenn sie nicht mehr zur Config passen.

<!-- auto:units:start -->
| Einheit | Taste | Plätze | HP | Tempo | Sicht | Reichweite | Preis | Ausbildung | Treibstoff (max / je s) | Stahl | Einwohner | Ausbildung (Stadt) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Schütze | Q | 1 | 100 | 45 | 260 | 200 | 60 Geld | 5 s | – | – | 1 | Kaserne |
| Pionier | F | 1 | 100 | 45 | 260 | 200 | 70 Geld | 6 s | – | – | 1 | Kaserne |
| Sanitäter | K | 1 | 100 | 45 | 260 | – | 90 Geld | 5 s | – | – | 1 | Kaserne |
| MANPADS-Soldat | I | 1 | 90 | 40 | 260 | 300 | 120 Geld | 8 s | – | – | 1 | Kaserne |
| Flammenwerfer | D | 1 | 100 | 40 | 260 | 70 | 60 Geld | 5 s | – | – | 1 | Kaserne |
| Mörsertrupp | E | 1 | 100 | 25 | 260 | 700 | 90 Geld | 8 s | – | – | 1 | Kaserne |
| Panzerabwehrsoldat | W | 1 | 90 | 40 | 260 | 240 | 120 Geld | 8 s | – | – | 1 | Kaserne |
| Scharfschütze | T | 1 | 70 | 38 | 440 | 480 | 220 Geld | 10 s | – | – | 1 | Kaserne |
| Kommandeur | C | 0 | 300 | 42 | 340 | 180 | 400 Geld | 20 s | – | – | 1 | Kaserne |
| LKW | E | 1 | 250 | 110 | 220 | – | 80 Geld | 6 s | 30 / 0,16 | 20 | 1 | Fabrikhalle |
| Aufklärungsfahrzeug | K | 1 | 200 | 160 | 520 | 220 | 100 Geld | 7 s | 30 / 0,16 | 30 | 1 | Fabrikhalle |
| Baufahrzeug | R | 1 | 400 | 70 | 260 | – | 150 Geld | 9 s | 40 / 0,24 | 20 | 1 | Fabrikhalle |
| Bergepanzer | W | 1 | 350 | 60 | 260 | – | 130 Geld | 8 s | 40 / 0,24 | 40 | 2 | Fabrikhalle |
| Störsender | U | 1 | 300 | 60 | 260 | – | 150 Geld | 8 s | 40 / 0,24 | 40 | 2 | Fabrikhalle |
| Brückenleger | C | 2 | 600 | 46 | 240 | – | 300 Geld | 14 s | 45 / 0,28 | 70 | 2 | Fabrikhalle |
| Bagger | X | 2 | 650 | 48 | 240 | 34 | 320 Geld | 14 s | 45 / 0,28 | 80 | 2 | Fabrikhalle |
| FOB-Fahrzeug | B | 2 | 600 | 60 | 260 | – | 500 Geld | 30 s | 50 / 0,32 | 80 | 2 | Fabrikhalle |
| Schützenpanzer | A | 3 | 450 | 85 | 300 | 240 | 450 Geld | 12 s | 40 / 0,32 | 120 | 3 | Fabrikhalle |
| Kampfpanzer | S | 5 | 1100 | 60 | 320 | 300 | 1000 Geld | 20 s | 60 / 0,48 | 250 | 3 | Fabrikhalle |
| Little Bird | D | 1 | 220 | 170 | 380 | – | 650 Geld | 15 s | 60 / 0,5 | 120 | 2 | Heliport |
| Aufklärungsdrohne | R | 1 | 120 | 130 | 450 | – | 300 Geld | 12 s | 40 / 0,5 | 50 | 1 | Heliport |
| Kamikazedrohne | X | 1 | 60 | 190 | 250 | 15 | 300 Geld | 12 s | 40 / 0,5 | 50 | 1 | Heliport |
| Transporthubschrauber | F | 1 | 500 | 130 | 320 | – | 900 Geld | 20 s | 90 / 0,7 | 120 | 2 | Heliport |
| Kampfhubschrauber | G | 1 | 650 | 150 | 400 | 340 | 1700 Geld | 28 s | 200 / 0,8 | 250 | 2 | Heliport |
| F-16 | K | 3 | 450 | 420 | 560 | 640 | 2600 Geld | 40 s | 55 / 1 | 320 | 2 | Stellplatz |
| F-22 | I | 3 | 500 | 460 | 600 | 700 | 3500 Geld | 55 s | 55 / 1 | 450 | 2 | Stellplatz |
| A-10 | D | 3 | 700 | 252 | 560 | 340 | 2800 Geld | 45 s | 90 / 1 | 360 | 2 | Stellplatz |
| C-130 | C | 3 | 900 | 200 | 400 | – | 3000 Geld | 60 s | 90 / 1 | 380 | 3 | Stellplatz |
| Su-27 | S | 3 | 480 | 450 | 560 | 640 | 2800 Geld | 45 s | 75 / 1 | 330 | 2 | Stellplatz |
| U-2 | O | 3 | 400 | 300 | 300 | – | 2600 Geld | 50 s | 180 / 1 | 300 | 2 | Stellplatz |
| Flakpanzer | Z | 2 | 300 | 70 | 380 | 330 | 300 Geld | 10 s | 40 / 0,32 | 80 | 2 | Fabrikhalle |
| SAM-Startrampe | N | 2 | 350 | 65 | 440 | 420 | 400 Geld | 12 s | 40 / 0,32 | 110 | 2 | Fabrikhalle |
| Flakpanzer Gepard | L | 3 | 450 | 62 | 480 | 420 | 1000 Geld | 16 s | 45 / 0,28 | 180 | 3 | Fabrikhalle |
| Panzerhaubitze | O | 4 | 500 | 50 | 280 | 1400 | 1500 Geld | 22 s | 40 / 0,28 | 280 | 4 | Fabrikhalle |
| Raketenwerfer | T | 4 | 500 | 50 | 280 | 1600 | 1700 Geld | 26 s | 40 / 0,28 | 300 | 4 | Fabrikhalle |
<!-- auto:units:end -->

<!-- auto:buildings:start -->
| Gebäude | Taste (Baumenü) | HP | Größe (Zellen) | Kosten | Bauzeit |
|---|---|---|---|---|---|
| FOB | – | 2500 | 3×3 | 400 Baumaterial | 30 s |
| Mauer | E | 600 | 1×1 | 8 Baumaterial | 2 s |
| Tor | R | 800 | 1×1 | 25 Baumaterial | 4 s |
| Mörser | T | 700 | 2×2 | 200 Baumaterial, 60 Munition | 20 s |
| Flugabwehr | Z | 700 | 2×2 | 180 Baumaterial, 40 Munition | 18 s |
| Phalanx | C | 900 | 2×2 | 800 Geld, 300 Baumaterial, 200 Munition | 120 s |
| Gefechtsturm | F | 1500 | 2×2 | 220 Baumaterial | 25 s |
| Bohrer | X | 600 | 2×2 | 150 Baumaterial | 20 s |
<!-- auto:buildings:end -->

Weitere globale Zahlen (Kartengröße, Zone, Prämien, Logistikraten, Schwierigkeit) stehen in `js/data/balance.js` und sind oben im Text genannt.

### Waffen und Schaden (Quelle: `weapons` in `js/data/units.js`, `weapon` in `js/data/buildings.js`)

Schaden je Schuss nach Panzerklasse des Ziels (Inf = Infanterie, Leicht, Schwer, Geb = Gebäude, Luft).
Wo die Tabelle „Treffer bis zum Abschuss“ (unten) eine Paarung nennt, gilt sie statt dieser Werte.
Reichweite in px, Kadenz = Sekunden zwischen Schüssen.

<!-- auto:weapons:start -->
| Waffe | Reichweite | Kadenz (s) | Schuss | Munition je Schuss | Inf | Leicht | Schwer | Geb | Luft | Flugzeug | Hinweis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Schütze: Gewehr | 200 | 1 | 60 | 0,033 | 12 | 3 | 1 | 4 | 3 | 0 | Soldat: 4 Treffer |
| Pionier: Gewehr | 200 | 1 | 60 | 0,033 | 12 | 3 | 1 | 4 | 3 | 0 | Soldat: 4 Treffer |
| MANPADS-Soldat: Wärmesuchrakete | 300 | 12 | 4 | 250 | – | – | – | – | 250 | 250 | bevorzugt gegen Luft; Trefferchance 90 % × Entfernungs-Faktor; nur Luftziele |
| Flammenwerfer: Flammenstrahl | 70 | 0,5 | 40 | 0,05 | 40 | 6 | 2 | 20 | 0 | 0 | – |
| Mörsertrupp: Leichter Mörser | 700 | 5 | 20 | 2 | 60 | 50 | 25 | 80 | – | – | – |
| Panzerabwehrsoldat: RPG | 240 | 3 | 5 | 10 | 10 | 90 | 120 | 60 | 40 | 0 | Soldat: 1 Treffer |
| Scharfschütze: Scharfschützengewehr | 480 | 8 | 10 | 4 | 200 | 6 | 1 | 2 | 2 | 0 | Soldat: 1 Treffer |
| Kommandeur: Maschinenpistole | 180 | 0,6 | 90 | 0,033 | 10 | 2 | 1 | 2 | 2 | 0 | Soldat: 6 Treffer |
| Aufklärungsfahrzeug: MG | 220 | 0,25 | 300 | 5 | 9 | 3 | 1 | 3 | 6 | 2 | Soldat: 2 Treffer |
| Bagger: Schaufel | 34 | 1,2 | 9999 | 0 | – | – | – | 32 | – | – | bevorzugt gegen Geb |
| Schützenpanzer: Granatwerfer | 240 | 2 | 60 | 10 | 30 | 40 | 10 | 25 | – | – | bevorzugt gegen Leicht, Schwer, Geb; Soldat: 1 Treffer |
| Schützenpanzer: MG | 220 | 0,25 | 300 | 5 | 9 | 3 | 1 | 3 | 6 | 2 | Soldat: 2 Treffer |
| Kampfpanzer: Hauptkanone | 300 | 6 | 30 | 20 | 45 | 120 | 150 | 120 | – | – | bevorzugt gegen Leicht, Schwer, Geb; Soldat: 1 Treffer |
| Kampfpanzer: MG | 220 | 0,25 | 300 | 5 | 10 | 3 | 0 | 2 | 3 | 1 | Soldat: 2 Treffer |
| Kampfhubschrauber: Bordkanone | 340 | 0,5 | 300 | 10 | 22 | 26 | 30 | 18 | 10 | 12 | – |
| Kampfhubschrauber: Raketen | 340 | 3 | 10 | 100 | 40 | 120 | 220 | 120 | 150 | 110 | bevorzugt gegen Schwer, Geb, Luft |
| F-16: Luft-Luft-Lenkrakete | 640 | 2,5 | 2 | 150 | – | – | – | – | 700 | 700 | bevorzugt gegen Luft; Trefferchance 92 % × Entfernungs-Faktor; nur Luftziele |
| F-16: Luft-Boden-Rakete | 600 | 2,5 | 2 | 150 | 160 | 650 | 1150 | 700 | – | – | bevorzugt gegen Schwer, Leicht; Trefferchance 92 % × Entfernungs-Faktor |
| F-22: Luft-Luft-Lenkrakete | 700 | 2,2 | 6 | 150 | – | – | – | – | 700 | 700 | bevorzugt gegen Luft; Trefferchance 94 % × Entfernungs-Faktor; nur Luftziele |
| A-10: Bordkanone | 340 | 0,12 | 400 | 2 | 25 | 60 | 35 | 40 | – | – | bevorzugt gegen Inf, Leicht, Schwer, Geb; Trefferchance 70 % × Entfernungs-Faktor |
| Su-27: Luft-Luft-Lenkrakete | 640 | 2,5 | 2 | 150 | – | – | – | – | 700 | 700 | bevorzugt gegen Luft; Trefferchance 92 % × Entfernungs-Faktor; nur Luftziele |
| Su-27: Luft-Boden-Rakete | 600 | 2,5 | 2 | 150 | 160 | 650 | 1150 | 700 | – | – | bevorzugt gegen Schwer, Leicht; Trefferchance 92 % × Entfernungs-Faktor |
| Flakpanzer: Flak | 330 | 0,8 | 30 | 20 | – | – | – | – | 40 | 40 | Trefferchance 85 % × Tempo-Faktor × Entfernungs-Faktor; nur Luftziele |
| SAM-Startrampe: Wärmesuchrakete | 420 | 10 | 4 | 250 | – | – | – | – | 350 | 350 | Trefferchance 90 % × Entfernungs-Faktor; nur Luftziele |
| Flakpanzer Gepard: Zwillingskanone 35 mm | 420 | 0,35 | 80 | 8 | 8 | 14 | 2 | 6 | 32 | 32 | bevorzugt gegen Luft; Trefferchance 80 % × Tempo-Faktor × Entfernungs-Faktor |
| Panzerhaubitze: Haubitze 155 mm | 1400 | 7 | 30 | 25 | 90 | 110 | 80 | 140 | – | – | – |
| Raketenwerfer: Raketenwerfer 227 mm | 1600 | 30 | 36 | 15 | 70 | 90 | 60 | 110 | – | – | – |
| FOB (Gebäude) | 220 | 0,6 | – | – | 12 | 4 | 1 | 4 | 2 | 2 | kostenlos |
| Mörser (Gebäude) | 800 | 20 | – | 4 | 60 | 50 | 25 | 80 | – | – | min. 200 px; Fläche 60 px; Granate mit Flugzeit |
| Flugabwehr (Gebäude) | 320 | 0,4 | – | 0,25 | 10 | 12 | 2 | 4 | 35 | 35 | fängt Mörsergranaten ab (350 px, 70 %) |
| Phalanx (Gebäude) | 225 | 0,1 | – | 5 | – | – | – | – | 25 | 25 | dazu 1 Geld je Schuss; fängt Mörsergranaten ab (225 px, 95 %, alle 0,2 s, je Versuch 15 Munition und 5 Geld) |
<!-- auto:weapons:end -->

Das Spiel wählt je Ziel automatisch die Waffe mit dem besten Schaden bzw. die „bevorzugte“ Waffe für die Panzerklasse des Ziels; Waffen ohne Munition schweigen.

Gegen besetzte **Stadthäuser** (Häuserkampf, §7) gilt die Spalte Geb, mit Faktor:
Waffen mit mindestens 25 Gebäudeschaden (Hauptkanone, RPG, Granatwerfer, Raketen, Mörser) × 1,5, alle anderen (Gewehre, MGs, Bordkanone) × 0,5.

### Schaden: Treffer bis zum Abschuss
Direktfeuer richtet sich nach Trefferzahlen (volles Ziel); Seite = Winkel zur Fahrtrichtung des Ziels (vorn ±45°, hinten ±45°, sonst seitlich).
Nicht genannte Paarungen nutzen die Schadenstabelle der Panzerklasse (u. a. Hubschrauber, Gebäude, MG gegen Fahrzeuge, Gewehr gegen Fahrzeuge).

| Waffe | Ziel | vorn | seitlich | hinten |
|---|---|---|---|---|
| Gewehr | Soldat | 4 | 4 | 4 |
| Kampfpanzer-Kanone | Soldat | 1 | 1 | 1 |
| Kampfpanzer-MG | Soldat | 2 | 2 | 2 |
| Schützenpanzer-Granate | Soldat | 1 | 1 | 1 |
| Schützenpanzer-MG | Soldat | 2 | 2 | 2 |
| Kampfpanzer-Kanone | Kampfpanzer | 4 | 3 | 2 |
| Kampfpanzer-Kanone | Schützenpanzer | 3 | 3 | 2 |
| Schützenpanzer-Granate | Kampfpanzer | 10 | 8 | 7 |
| Schützenpanzer-Granate | Schützenpanzer (Annahme) | 8 | 6 | 5 |
| Schützenpanzer-Granate | LKW/Baufahrzeug (Annahme) | 3 | 3 | 3 |
| Kampfpanzer-Kanone | LKW/Baufahrzeug (Annahme) | 2 | 2 | 2 |
| RPG (Annahme) | Soldat | 1 | 1 | 1 |
| RPG (Annahme) | Kampfpanzer | 6 | 4 | 3 |
| RPG (Annahme) | Schützenpanzer | 4 | 3 | 2 |
| RPG (Annahme) | LKW/Baufahrzeug | 2 | 2 | 2 |
