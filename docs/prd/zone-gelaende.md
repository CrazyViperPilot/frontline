# Frontline PRD – Konfliktzone, Gelände, Kisten, Hot Zone, Fluss, Bohrer

> Teil des PRD, Abschnitte §7 ohne Häuserkampf, Wetter und Forschung. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 7. Konfliktzone & Punkte

- Kreis in der Kartenmitte (klassisch; in der Eroberung ein Quadrat mit halber Kante 3300 px, [eroberung.md](eroberung.md)),
  Radius **3300 px** (Karte **11072 × 11072 px**; rundum kamen 1024 px Land dazu), gestaltet als osteuropäische Stadt (Straßenraster, Häuser, Hallen, Fabriken, Parks, Autos, Bäume).
  Gebäude und **Bäume** sind echte Hindernisse (wie Häuser: Einheiten gehen drumherum, Bauen ist dort nicht möglich), Straßen und Parks sind frei.
  **Große Blöcke:** Neben den normalen Blöcken (5 × 5 Stadtzellen zwischen den Straßen) gibt es **8 große Blöcke** aus je 2 × 2 Blöcken ohne die Straßen dazwischen (innen **11 × 11 Stadtzellen**,
  Platz für Flughafen 10 × 10, Fabrikhalle 8 × 8 oder Kaserne 4 × 4), punktsymmetrisch für beide Teams (`MAPGEN.town.bigBlocks`): 4 sind freies Bauland (ohne Häuser, Bäume, Autos),
  4 bleiben bebaut und lassen sich im Baumodus der Stadt mit **Räumen** freimachen (§15).
  Die Bahnzeile bleibt frei.
  Das ändert die Zonenstadt aller Zufallskarten (Straßen und Gebäude in diesen Blöcken; sonst bleibt die Karte je Seed gleich, Zufallsfolge unverändert);
  gespeicherte Karten des Editors bleiben, wie sie sind.
  Auch die Bäume außerhalb der Stadt blockieren; Hubschrauber fliegen darüber.
  Die Startpunkte liegen 700 px von den Kartenrändern (`MAPGEN.general.spawnEdge`); der Abstand vom Start zum Zonenrand beträgt gut 3500 px (bis v5.11 gut 2000 px).
- **Stadtstraßen der Zone:** Die Straßen der Zonenstadt liegen auf dem Stadtraster (Blöcke 384 px,
  jede Straße genau eine Zellreihe) und sind **Stadtstraßen** wie die eigenen Straßen der Stadt (Asphalt, Gehweg, Mittellinie, Kreuzungen mit Zebrastreifen).
  Sie gehören niemandem: sie zählen für **alle** Teams als Straßenanschluss (Wohnen,
  Gewerbe und alle anderen Stadtgebäude, die man an sie baut, wachsen), lassen sich aber weder überbauen noch abreißen;
  eigene Straßen schließen an sie an.
  Zellen mit einem Haus, Baum oder Wachturm bleiben frei.
  Feldwege bleiben Feldwege.
  Code: `js/game/roads.js` (`game.roads`).
- **Wachtürme:** Vier Wachtürme (Stahlgerüst mit Kabine, 80 × 80 px, blockieren wie Gebäude, können nicht zerstört werden) stehen am Rand der Zone:
  oben, unten, links und rechts (bei 0,86 × Zonenradius; links/rechts knapp neben der Bahnlinie), punktsymmetrisch.
  Was dort im Weg stand, entfällt.
  Sie haben keine Spielwirkung (Sicht- und Deckungsmarke); gespeicherte Karten ohne Türme bleiben unverändert, im Editor lassen sich Türme setzen.
- **Gewicht** (klassisch) je Partei = Einheiten in der Zone; Einheiten in der **Hot Zone zählen doppelt** (einmal als Zone, einmal als Hot Zone).
  Die Partei mit dem größeren Gewicht **führt** (Mehrheit, kein Alleinbesitz nötig); bei Gleichstand führt niemand. „Umkämpft“
  heißt nur, dass beide Parteien Einheiten in der Zone haben.
- **Punktebalken** (klassisch; Eroberung: Flaggen und Tickets, [eroberung.md](eroberung.md)) (oben, in der Farbe des Führenden): füllt sich in **30 s**;
  voll = **1 Punkt** für das Team des Balkens, dann
  beginnt er von vorn. Wechselt die Führung, leert er sich doppelt so schnell und färbt sich dann um. Bei Gleichstand steht er still.
- **Geld je Einheit** (auch in der Eroberung, dort im ganzen Quadrat, dazu Flaggengeld):
  Jede lebende eigene Einheit in der Zone bringt **0,4 Geld/s** (auch wenn umkämpft; kein Deckel; Hubschrauber zählen mit).
  Beide Teams verdienen gleichzeitig.
  Kein Führungsgeld.

### Gelände: Hügel, Berge, Seen

- **Höhenmodell** (`js/game/relief.js`): Höhenraster alle 64 px (142 × 142 Punkte), glatt (Catmull-Rom) auf das Feinraster von 32 px (= Zellengröße) hochgerechnet.
  Höhen in Bildschirm-Pixeln bei Zoom 1, wie die Gebäudehöhen der Iso-Ansicht.
  Wasserspiegel −20, darunter liegt ein See.
- **Begehbarkeit:** Eine Zelle ist unpassierbar, wenn sie unter dem Wasserspiegel liegt, höher als **300** ist (Gipfel, Fels) oder steiler als **0,42** (Höhe je px).
  Ab Neigung 0,3 zeigt das Bild Fels (Warnung: hier wird es bald steil).
  Hubschrauber fliegen über alles.
- **Höhenvorteil:** Im Direktfeuer macht der höher stehende Schütze mehr Schaden, der tiefer stehende weniger: ab 6 Höhenunterschied wächst der Faktor linear bis **±25 %** bei 36 (`BALANCE.height`).
  Bei Paarungen mit Trefferzahl (Tabelle in §6) gilt gerundet Treffer ÷ Faktor, mindestens 1 (Gewehr gegen Soldat: 4 Treffer, von oben 3, von unten 5).
  Gilt für Einheiten und Gebäude-MG, nicht für Mörser und nicht mit Hubschraubern (Schütze oder Ziel).
  Die Auswahl einer Einheit zeigt ihre Standhöhe und, wenn der Zeiger auf einem sichtbaren Gegner liegt, den Vorteil gegen ihn.
- **Tempo am Hang:** Faktor = 1 − Steigung × 1,5 (Fahrzeuge) bzw. × 0,8 (Infanterie) bergauf, bergab 1 + Gefälle × 0,6 bzw. × 0,3; begrenzt auf 0,55 …
  1,2 (`BALANCE.slope`), gemessen in Fahrtrichtung.
  Die Wegsuche rechnet je Zelle 1 + 1,2 × Neigung als Kosten (Talwege und flache Umwege werden bevorzugt, wenn sie kürzer dauern);
  die Begradigung des Weges kürzt nur ab, wenn die gerade Strecke nicht teurer ist.
- **Wegsuche ohne Ruckeln:** Einheiten planen ihre Wege mit einem festen Budget je Simulationsschritt (8000 untersuchte Zellen, `BALANCE.path`).
  Ist es aufgebraucht, warten weitere Einheiten in der Reihenfolge ihres Befehls einen oder wenige Schritte
  (bei einem Massenbefehl höchstens etwa zwei Sekunden) und behalten dabei ihren Befehl.
  Ein sehr langer Weg (mehr als 8000 Zellen) wird über mehrere Schritte gerechnet (eine solche Suche zur Zeit, je Schritt 8000 Zellen).
  Ein Ziel in einem Gebäude, im Wasser oder hinter geschlossenen fremden Mauern kostet keine volle Suche mehr: der Weg führt zur nächsten erreichbaren freien Zelle davor.
  Einheiten, die nahe beieinander starten und nahe beieinander ankommen, übernehmen einen eben gefundenen Weg.
  Alles hängt nur vom Spielzustand ab: gleicher Seed = gleiche Partie, Laden und Weiterspielen bleibt gleich.
- **Straßen:** Bodenfahrzeuge (Stufe „Panzerung“ nicht Infanterie, nicht Luft) fahren auf den Straßen und Feldwegen der Karte (`map.town.roads`, Breite w) **35 % schneller** (`BALANCE.roads.speedMul`,
  1,35); abseits der Straße verbrauchen sie **15 % mehr Treibstoff** (`roads.offroadFuel`, 1,15).
  Fahrbahn zählt als Straße, solange die Einheit innerhalb von w/2 der Mittellinie ist (`onRoad` in `movement.js`).
- **Sicht im Gelände:** Wer höher steht, sieht weiter: Sichtweite × (1 + (Höhe − 40) / 350), höchstens +40 % (`BALANCE.sightHeight`).
  Kämme und Kuppen verdecken, was dahinter liegt: Von jedem Beobachter laufen Sichtstrahlen (Abstand am Rand ≤ 44 px, Schritt 24 px) über das Höhenraster;
  ein Punkt ist sichtbar, wenn die Linie vom Auge (Infanterie 16, Fahrzeuge 20, Gebäude 30 über dem Boden) zu seiner Oberkante (Boden + 12) über allem Gelände davor liegt.
  Gelände näher als 72 px verdeckt nichts (man tritt an die Hangkante).
  Hubschrauber sehen ungehindert.
  Der Nebel gilt wie bisher je Team; was eine eigene Einheit nicht sieht, kann nicht automatisch beschossen werden (Hinterhalte hinter Hügeln).
  Ergebnisse werden je Beobachter zwischengespeichert, solange er am selben Ort steht.
- **KI:** Sammelpunkt an der Zonen-FOB und die Verteilpunkte der Zonenbesatzung liegen auf der höchsten begehbaren Stelle in der Nähe.
- **Zufallskarte** (`js/game/landscape.js`, punktsymmetrisch wie die übrige Karte):
  6 Bergrücken (Grate bis ~250 hoch, felsige Flanken), 10 Hügel, 3 Seen mit unregelmäßigem Ufer und sanftem Becken (mit der größeren Karte mehr), in der Zone 2 flache Kuppen.
  Freigehalten werden Startgelände (1400 px eben, dann sanfter Übergang bis 1800 px), die Konfliktzone (kein Hang steiler als 0,25, kein Wasser, keine Felszelle), die Zufahrtsstraßen,
  die Bahnlinie und der Kartenrand.
  **Mindestens 3 getrennte Zugänge** führen von jedem Start in die Zone (Pfadsuche mit Sperrung des gefundenen Weges, 340 px breit, außerhalb von Start und Zone);
  sonst verwirft der Generator den Versuch.
  Wald, Bäume und Fabrikgelände stehen nur auf ebenem Grund.
- **Darstellung:** Iso mit WebGL: echtes Höhennetz (Feinraster), Licht von rechts oben wie die Gebäudeschatten, Felsblöcke an steilen Hängen und auf Gipfeln, Geröll am Fuß, Sandufer, Wasser mit Tiefe,
  Wellen und hellem Saum, Erdschnitt am Kartenrand; Einheiten, Gebäude (auf ihrer tiefsten Ecke), Kreise und Linien stehen auf dem Gelände.
  2D und Minimap: Schummerung (Licht aus Nordwest), Fels, Ufer und Seen aufgemalt.
  Ohne WebGL bleibt Iso flach mit aufgemaltem Gelände.
- **Felder, Weiden, Feldwege:** Um die Einzelhäuser außerhalb der Zone liegen Gehöfte:
  je Haus (zu 75 %) eine Reihe von 1–3 Feldern (170–320 × 170–300 px, gerade oder bis ±20° gedreht) auf einer Seite des Hauses, dazwischen ein Feldweg.
  Dazu 12 freie Flure (Paare) mit zwei Feldreihen beiderseits eines Feldwegs.
  Feldwege (26 px, `dirt`) binden Gehöfte und Flure an die nächste Straße, einen anderen Feldweg oder das Nachbargehöft an.
  Äcker tragen **Weizen** (gold), **junge Saat** (grün), **gepflügten Boden** (braun mit Furchen und Kämmen) oder **Raps** (gelb), alle mit Furchen in Längsrichtung und dunklerem Feldrand;
  **Weiden** (30 %) sind grün mit helleren Flecken, Zaun mit Pfosten und Heuballen.
  Alles ist nur Boden: Felder und Feldwege blockieren nichts, Bäume darauf fallen weg.
  Punktsymmetrisch, mit eigenem Zufall (die übrige Karte bleibt je Seed gleich), außerhalb der Zone, frei von Gebäuden, Wald, Straßen und Wasser.
  Seit v5.44 werden Äcker und Weiden in 2D und Iso scharf über dem Boden gemalt (unten „Felder und Weiden (Aussehen)“); das Bodenbild trägt sie weiter unscharf für Minimap, WebGL-Gelände und Editor.
- **Aussehen der Kartenstadt:** Alle Gebäude der Karte sind in 2D und Iso gemalt.
  **Wohnhäuser** in fünf Stilen: Altbau auf eigenem Grundstück (Hof mit niedriger Mauer und Gitter innerhalb des Grundrisses,
  Vorplatz, Weg zum Tor, zwei bis drei Hofbäume; dunkles Schiefer- oder Ziegel-Walmdach mit Ziegelreihen und zwei Gauben,
  im Winter Schneedecke mit freier Traufe und Dachrinne; Steinsockel, Gesimse, Eckquader, Fensterbänke, Eingang mit Stufen
  und Vordach, Fenster je Haus fest unregelmäßig beleuchtet; Schlagschatten nach links unten, Schneeverwehung und Kontaktschatten
  am Wandfuß; besetzt: Fahne in Teamfarbe an der Hofecke, Sandsäcke außen vor der Mauer mit Lücke am Tor),
  Klinker (Fugen, Balkone, Giebel mit Rundfenster, Dachfenster),
  Fachwerk (Balken, Überstand, steiles Satteldach, Fensterläden, Blumenkästen), Neubau (Flachdach mit Attika, Treppenhaus aus Glas, Balkone, Solar, Gründach oder Klimageräte); in der Stadt gemischt,
  draußen Fachwerk und Klinker, an Feldern **Gehöfte** mit Wohnhaus, Scheune, Silo und Heuballen.
  **Hallen** mit Rolltoren, Rampen, Oberlichtern, Firmenschild und Bürokopf (Sattel- oder Tonnendach), **Fabriken** mit Shedhalle, Bürotrakt, Schornstein, Silos, Rohrbrücke,
  Hof mit Markierungen und Lkw, **Fabrikmauern** aus Betonfeldern mit Pfeilern und Stacheldraht, **Züge** (Diesellok, Kessel- und Containerwagen), **Bahnhof** mit Uhr und Vordach,
  **Bahnsteig** mit Dach, Bänken und Schild (schräge Züge und Bahnsteige in 2D gedreht, in Iso wie bisher), Wachtürme seit v5.43 gemalt (unten „Kleinkram der Karte“).
  **Parks** mit Rasenstreifen, Hecke, Wegekreuz, Rundweg, Blumenbeeten und Brunnen oder Beet in der Mitte (Gleise schneiden den Park), **Parkbänke** aus Latten auf Gusseisen.
  Farben und Stil je Gebäude fest aus seiner Lage; im Winter Schnee auf Dächern und Parks, Herbst- und Winterfarben auch für Parks, Stadtbäume (2D) und Minimap;
  in 2D stehen die parkenden Autos jetzt auf den Straßen.
  Bilder zwischengespeichert wie die Stadtgebäude (`spritecache.js`), die Minimap zeigt Parks und Gebäude als Flächen.
  Nur Bild, keine Regeländerung.
- **Kleinkram der Karte (Aussehen):** Wachturm, geparkte Autos,
  Parkbänke und Versorgungskisten malt das Spiel selbst wie die übrigen Gebäude (`js/render/props.js`, Wachturm in `js/render/maptown.js`), in 2D und Iso, je Maßstab zwischengespeichert;
  die Bilddateien (`assets/iso/`) entfallen.
  **Wachturm:** Stahlgitterturm mit vier Beinen und Kreuzstreben auf Betonfüßen, Plattform aus Gitterrost mit Geländer, Kabine mit umlaufendem Fensterband und Tür, Flachdach mit grünem Rand,
  Technikhäuschen mit Radar, zwei Antennen mit roten Warnlichtern und ein Suchscheinwerfer; die Treppe mit Zwischenpodest liegt auf der Seite weg von der Kartenmitte; im Winter Schnee auf Dach,
  Plattform und Stufen.
  **Autos:** Limousine, Kombi mit Dachreling, Kleinwagen und Transporter als kleine 3D-Modelle in den sieben Lackfarben, mit Rädern in Radkästen, Felgen, Scheiben, Säulen, Spiegeln, Scheinwerfern,
  Rücklichtern, Kühlergrill und Nummernschild; Iso in vier Richtungen längs der Straße, Schatten als Umriss am Boden, im Winter Schnee auf Dach und Hauben.
  **Parkbänke:** drei Holzlatten im Sitz und zwei in der schrägen Lehne auf Gusseisen-Wangen mit Armlehnen, Lehne nach außen, Iso in 16 Richtungen, im Winter verschneit.
  **Versorgungskisten:** olivgrüne Holzkiste mit dunklen Rahmenleisten, abgesetztem Deckel, zwei Spanngurten mit Schnallen, gelber Plombe und hellem Schablonen-Aufdruck;
  am Boden mit gelbem Schimmer, eingelagert und auf dem Rücken des Trägers kleiner (der Karteneditor zeichnet sie weiter einfach).
  Nur Bild, keine Regeländerung.
- **Kartenformat:** `relief` = Höhenraster als Base64-Text (1 Byte je Punkt, Höhe = Wert × 2 − 128, also −128 … 382). Fehlt es oder ist es kaputt, ist die Karte flach.

- **Natur (Aussehen):** Bäume, Büsche, Felsen und Tiere malt das Spiel selbst (`js/render/nature.js`),
  in 2D genau von oben (Schatten nach rechts unten) und isometrisch (Bäume und Büsche aufrecht, in jeder Drehung gleich; Schatten nach links unten in einem Zug auf den Boden, nie über andere Dinge).
  **Vier Baumarten:** Laubbaum (runde Krone aus Laubbüscheln, Licht von links oben, drei Grüntöne), Birke (weißer Stamm mit schwarzen Querstreifen, lockere, hängende Krone),
  Fichte (Stockwerke aus hängenden Ästen) und Kiefer (hoher, oben rötlicher Stamm, flache Schirmkrone); je Art drei bis vier Formen, fest nach Lage.
  **Wälder** sind Laub-, Nadel- oder Mischwälder (fest je Wald), dichter als bisher (Kronen schließen sich; Bäume gleichmäßig als Spirale mit Zufall verteilt, Zahl ≈ Radius² / 430),
  mit Unterholz aus Farnen und jungen Fichten und Büschen am Rand; der Boden darunter ist Waldboden mit weichem, gelapptem Rand (Moos, Nadelstreu, Laub) statt einer dunklen Scheibe,
  die Bäume sind in 2D nicht mehr unscharf im Bodenbild.
  Verstreute Bäume und Stadtbäume sind meist Laubbäume, dazu Birken, Fichten und Kiefern.
  **Büsche:** Strauch, Beerenstrauch (rote Beeren), Farn, junge Fichte.
  **Herbst:** Laub gelb, orange, rot oder olivbraun (je Baum fest), Birken golden, Laub am Boden um den Stamm, Farne braun.
  **Winter:** Laubbäume und Birken kahl (Astwerk mit Schnee auf den Ästen), Fichten mit Schnee auf jedem Stockwerk, Kiefern mit Schnee auf den Büscheln, Sträucher als Rutenbündel mit Schnee,
  Beerensträucher mit roten Hagebutten.
  **Felsen** sind kleine 3D-Modelle: verbeulte Blöcke mit flachen Bruchflächen und Begleitsteinen, Ton je Fläche wechselnd, Mulden dunkler,
  Moos und Flechten fleckig auf Oberseiten, im Winter Schnee auf flachen Oberseiten; darüber ein Gesteinsfoto (CC0, `textures/rock.jpg`),
  isometrisch in jeder Drehung von der passenden Seite.
  Jede Variante wird je Jahreszeit und Maßstab einmal gemalt und danach nur kopiert (`spritecache.js`), darum bleibt es auf Handy und Tablet flüssig.
  Nur Bild: Hindernisse, Wege und Sicht unverändert (das Unterholz ist wie die Büsche nur Optik).
- **Straßen, Gleise, Brücken (Aussehen):** Feldwege und Gleise liegen nicht mehr unscharf im Bodenbild, sondern werden in 2D und Iso scharf darüber gezeichnet,
  im Iso auf dem Gelände (`js/render/ways.js`).
  **Feldwege** (schmal) aus Erde mit zwei Fahrspuren und Grasnarbe in der Mitte, **Landwege** (breit) aus Schotter mit zwei abgefahrenen Fahrstreifen und losem Schotter in der Mitte;
  Ränder leicht unregelmäßig mit weichem Saum zur Wiese, Kreuzungen rund.
  **Gleise** auf Schotterbett mit hellerer Krone, Betonschwellen und zwei Schienen mit blanker Lauffläche.
  **Stadtstraßen** (Zonenstraßen und eigene Straßen, `citylayer.js`): Asphalt mit feiner Körnung, Flecken und Rissen, Gehwege aus Platten, heller Bordstein mit Rinne, Bordsteinecken und Bögen,
  Kanaldeckel und Gullys, Bahnübergänge mit Betonplatten zwischen den Schienen.
  **Brücken** (`bridge.js`): Pfeiler aus zwei runden Stützen mit Querträger, nassem Fuß und Gischt; Überbau mit hellem Gesims über dem dunkleren Träger, Widerlager an den Ufern;
  Fahrbahn wie die Stadtstraßen mit Fugen über den Pfeilern, Stahlgeländer mit Pfosten und zwei Holmen, drei Laternen; eingestürzt mit Stützenstümpfen und Bewehrungseisen an den Bruchkanten.
  **Furten:** Stangen als rot-weiße Baken mit nassem Fuß, Kappe, Spiegelung und Kräuselringen (2D: geviertelter Kopf).
  **Herbst:** Wege dunkler mit Laub, Laub in den Rinnen und auf den Gehwegen.
  **Winter:** Wege, Schotter und Schwellen verschneit (Fahrspuren matschig, Schienen blank), Gehwege verschneit, Schneewälle an den Bordsteinen.
  Bei kleinem Zoom einfache Farben statt Muster und ohne die feinen Teile, damit es auf Handy und Tablet flüssig bleibt.
  Minimap und Editor zeigen Wege und Gleise weiter aus dem Kartenbild.
  Nur Bild: Wege, Tempo, Hindernisse und Brückenregeln unverändert.
- **Felder und Weiden (Aussehen):** Äcker und Weiden lagen bis v5.43 nur im Bodenbild, das ein Viertel der Auflösung hat und darum beim Hineinzoomen verschwimmt.
  Jetzt werden sie wie die Feldwege scharf darüber gezeichnet,
  im Iso auf dem Gelände (`js/render/fields.js`, aufgerufen aus `ways.js` vor den Feldwegen, Pfade je Kachel zwischengespeichert, neu nur beim Drehen oder wenn sich das Gelände ändert).
  Jede Frucht hat ein eigenes Muster je Jahreszeit (Weizen mit Ähren, junge Saat mit Halmen, gepflügter Boden mit Schollen, Raps mit Blüten, Weide mit Gras;
  im Herbst Stoppeln, Auflauf, nasser Boden, Raps im Laub; im Winter Schnee mit durchschauenden Stoppeln und Furchen).
  **Äcker:** Reihen alle 8 px längs des Felds, an beiden Enden ein Vorgewende mit zwei Querreihen, Fahrgassen (zwei Spuren) alle 72 px längs und quer über die Vorgewende,
  beim gepflügten Boden Kämme statt Fahrgassen, dunklerer Feldrand und ein schmaler Rain, der den weichen Rand des Bodenbilds deckt; Weizen hat im Herbst Schwaden und 2–5 **Strohballen** darauf.
  **Weiden:** Gras mit weichen dunkleren und helleren Flecken, Holzzaun mit Pfosten und zwei Latten (Iso aufrecht mit Höhe, 2D von oben),
  ein **Gatter** aus Metall auf einer zufälligen Seite mit ausgetretener Stelle und Trampelpfad nach innen (im Winter unter Schnee),
  1–3 **Heuballen** als kleine 3D-Rundballen (`js/render/props.js`, Iso in 8 Richtungen mit Schatten, 2D von oben, im Winter Schnee darauf); im Winter Schneekappen auf den Pfosten.
  Weit herausgezoomt (unter Zoom 0,4) entfallen Reihen, Fahrgassen und Zaun, unter 0,3 die Muster (einfarbig).
  Lage, Gatter und Ballen sind je Feld fest.
  Nur Bild, keine Regeländerung.

## 7. Konfliktzone & Punkte (Teil)

### Versorgungskisten

- **Fundorte:** Die Zufallskarte legt **3 Kistenpaare** (`BALANCE.crates.pairs`, punktsymmetrisch, also gleich weit von beiden Starts) abseits von allem: mehr als 350 px außerhalb der Zone,
  mehr als 2000 px von den Startpunkten (außerhalb des Baulands), mindestens 900 px voneinander, nicht an der Bahnlinie, auf freiem Boden, den beide Starts zu Fuß erreichen.
  Sie werden nach allem anderen gelegt, die übrige Karte eines Seeds bleibt dieselbe.
  Findet sich für ein Paar kein Platz, gibt es weniger Kisten.
  Eigene Karten: Werkzeug „Kiste“ im Editor (höchstens 24, `crates` im Kartenformat); eine Kiste auf verbautem Boden rückt im Spiel zur nächsten freien Stelle.
- **Holen:** Infanterie gewählt, Rechtsklick oder Tippen auf eine Kiste: der nächste Soldat ohne Kiste holt sie (bis 40 px heran), die übrigen gehen als Begleitschutz mit.
  Fahrzeuge tragen keine Kisten, jeder Soldat höchstens eine.
- **Tragen:** Der Träger geht mit **75 %** Tempo, **schießt nicht** (auch kein Angriffsbefehl), steigt nicht in Fahrzeuge und besetzt keine Häuser.
  Er bringt die Kiste von selbst zur **nächsten eigenen fertigen FOB** (auch die Hauptstadt); Rechtsklick auf eine eigene FOB wählt das Ziel, **K** legt die Kiste ab.
  Ein Träger, der untätig steht, macht sich wieder auf den Weg.
  Steckt er im Gedränge an der FOB fest (3 s kein Fortkommen, höchstens 320 px vor der Wand), gilt die Kiste als abgeliefert.
- **Einlagern:** An der FOB (100 px vor der Wand) wird die Kiste eingelagert und bringt dem Team **1 Geld/s** (`BALANCE.crates.income`, mit dem Einkommensfaktor der Schwierigkeit).
  Eingelagerte Kisten stehen im Hof der FOB und lassen sich nicht stehlen.
- **Verlieren:** Fällt der Träger, liegt die Kiste, wo er fiel; wird die FOB zerstört oder abgerissen, liegen ihre Kisten wieder am Boden.
  Jeder kann sie dann aufheben, auch der Gegner.
  Meldungen: eigene Kiste eingelagert (+1 Geld/s), Träger gefallen, FOB mit Kisten verloren, der Gegner hat eine Kiste aufgenommen bzw. eingelagert.
- **Lagebild:** Jedes Team kennt die Fundorte von der Karte (gelbe Quadrate auf der Minimap, auch im Nebel).
  Danach zählt, was es gesehen hat: Sieht es eine Stelle ohne Kiste, verschwindet das Quadrat; eine Kiste am Boden in Sicht wird vermerkt.
  Auf der Karte erscheinen Kisten am Boden nur in erkundeten Zellen (schimmernd), getragene auf dem Rücken des Trägers.

### Zäune und Mauern

Props der Karte: Kacheln von je einer Rasterzelle (32 px), die sich mit Nachbarn zu Gerade, Ecke, T-Stück, Kreuz und Ende verbinden.
Werte je Art in `js/data/props.js` (Tabelle unten), Regeln in `js/game/props.js`.

| Art | hält auf | Kette walzt nieder | Deckung Inf. / Fz. | verdeckt Sicht | Treffer­punkte | danach |
|---|---|---|---|---|---|---|
| Holzzaun | alle | ja | 15 % / – | nein | 60 | weg |
| Metallzaun (Sockel, Gitter) | alle | ja | 30 % / – | nein | 120 | Trümmer: Sockelrest, 10 % Deckung |
| Maschendraht mit Stacheldraht | alle | ja | – | nein | 50 | weg |
| Betonmauer | alle | nein | 60 % / 30 % | ja | 600 | Schuttwall: hält Radfahrzeuge auf, 35 % Deckung |
| Bruchsteinmauer | alle | ja | 50 % / 15 % | nein | 300 | Trümmer: 25 % Deckung |

**Militär** (Gruppe „Militär“ im Editor; Kacheln oben, Einzelstücke unten mit Drehung in 45°-Schritten):

| Art | hält auf | Kette walzt nieder | Deckung Inf. / Fz. | verdeckt Sicht | Treffer­punkte | danach / Besonderes |
|---|---|---|---|---|---|---|
| Sandsackwall | alle | ja | 55 % / 20 % | nein | 250 | Trümmer: 25 % Deckung |
| Hesco-Barriere | alle | nein | 70 % / 40 % | nein | 800 | Sandhaufen: hält Radfahrzeuge auf, 30 % Deckung |
| Betonsperre (Jersey) | Fahrzeuge | nein | 40 % / 25 % | nein | 500 | Brocken: 15 % Deckung |
| Stacheldrahtrolle | alle | ja | – | nein | 30 | weg |
| Panzersperre (Tschechenigel) | Fahrzeuge | nein | 10 % / – | nein | 400 | weg; je Zelle ein Igel, ohne Verbindung |
| Sandsack-Stellung (Halbkreis) | Fahrzeuge | ja | 60 % / – | nein | 300 | Infanterie darin hat Deckung nach allen Seiten |
| Tarnnetz | niemanden | ja | – | nein | 40 | Einheiten darunter getarnt (wie Scharfschützen) |
| Zelt | alle | ja | 10 % / – | ja | 80 | Fahne; eingefallene Plane |
| Funkmast | alle | nein | – | nein | 300 | Fahne; umgestürzt |
| Munitionskisten | alle | ja | 35 % / – | nein | 60 | explodiert (70 px) |
| Treibstofftank | alle | nein | 40 % / 30 % | nein | 200 | explodiert (110 px); ausgebrannte Hülle sperrt weiter |
| Kontrollpunkt-Häuschen | alle | nein | 50 % / 20 % | ja | 400 | Fahne; Mauerreste halten Radfahrzeuge auf |
| Schranke | Fahrzeuge (zu) | ja | – | nein | 40 | offen: hält niemanden auf |

- **Fahnen:** Zelt, Funkmast und Kontrollpunkt tragen eine Fahne. Im Editor einstellbar (neutral weiß, Blau, Rot, Grün, Gelb); in
  der Eroberung zeigt sie den Besitzer der nächsten Flagge (bis 700 px, grau-weiß solange niemand sie hält).
- **Explosion:** Zerstört Beschuss Munitionskisten oder einen Treibstofftank, explodieren sie im nächsten Schritt wie eine Granate
  ohne Team (trifft alle, auch andere Props: Kettenreaktion möglich). Überfahrene Kisten explodieren nicht.
- **Tarnnetz:** Bodeneinheiten unter einem heilen Netz erkennt der Gegner nur aus 160 px Nähe oder 4 s nach einem Schuss.
- **Zufallskarten:** An der Hälfte der Kistenpaare steht ein kleines Feldlager (Zelt, Munitionskisten, Sandsack-Stellung) 110 bis 170 px
  um die Kiste, gespiegelt.

**Industrie und Logistik** (Gruppe „Industrie und Logistik“ im Editor, alles Einzelstücke mit Drehung in 45°-Schritten):

| Art | hält auf | Kette walzt nieder | Deckung Inf. / Fz. | verdeckt Sicht | Treffer­punkte | danach / Besonderes |
|---|---|---|---|---|---|---|
| Container (1 bis 3 Lagen) | alle | nein | 60 % / 40 % | ja (je Lage höher) | 400 je Lage | aufgerissen, sperrt weiter |
| Paletten | niemanden | ja | 10 % / – | nein | 30 | weg |
| Kistenstapel | alle | ja | 30 % / – | nein | 60 | weg |
| Fässer stehend, liegend | alle | ja | 30 % bzw. 25 % / – | nein | 50 | explodieren (50 px) |
| Reifenstapel | alle | ja | 30 % / – | nein | 80 | weg |
| Gabelstapler | alle | ja | 30 % / – | nein | 120 | Wrack |
| Portalkran | nur an den Beinen | nein | 20 % / – | nein | 1500 | Trümmer an den Beinen; darunter fährt man durch |
| Laderampe | Fahrzeuge | nein | 45 % / 20 % | nein | 800 | Brocken, 20 % Deckung |
| Laternenmast | niemanden | ja | – | nein | 30 | umgeknickt |
| Stromverteiler | niemanden | ja | 15 % / – | nein | 40 | weg |

- **Stapeln:** Container (bis 3 Lagen), Paletten (3), Kistenstapel (2), Reifenstapel (3) und Holzstapel (2). Im Editor setzt die
  Deko auf ein Stück derselben Art eine Lage darauf, oder „Wählen“ und „Lagen“. Trefferpunkte und Sichthöhe wachsen je Lage; jede
  Container-Lage hat ihre eigene Farbe (sieben Reedereifarben, aus der Lage gewählt), die anderen Arten wechseln die Einzelheiten je Lage.
- **Zufallskarten:** Die Hälfte der freistehenden Hallenpaare bekommt einen Lagerhof: eine Reihe Container (bis zwei Lagen), Paletten,
  Kisten, Fässer, Reifen, Gabelstapler oder Stromverteiler 34 px vor einer Längsseite, dazu oft ein Laternenmast an der Ecke; gespiegelt.
  Fabrikhöfe bleiben frei (Umfahrung innerhalb der Mauer).

**Raffinerie und Ölfeld** (Gruppe „Raffinerie und Ölfeld“ im Editor; Rohrleitung und Rohrbrücke als Kacheln, sonst Einzelstücke mit
Drehung in 45°-Schritten; Bild `js/render/refprops.js`). Bausteine für große Raffinerien und Tanklager in Wüstenoptik:

| Art | hält auf | Kette walzt nieder | Deckung Inf. / Fz. | verdeckt Sicht | Treffer­punkte | danach / Besonderes |
|---|---|---|---|---|---|---|
| Rohrleitung (Kachel) | Fahrzeuge | nein | 40 % / 20 % | nein | 400 | geborstene Rohre in einer Öllache, 15 % Deckung |
| Rohrbrücke (Kachel) | niemanden | nein | 10 % / – | nein | 800 | darunter fahren alle durch; eingestürzt hält sie Fahrzeuge auf |
| Großtank (Schwimmdach), 112 × 112 px | alle | nein | 60 % / 50 % | ja (Höhe 36) | 4000 | explodiert (200 px); ausgebrannte Hülle sperrt weiter |
| Festdachtank, 64 × 64 px | alle | nein | 60 % / 50 % | ja (Höhe 34) | 2500 | explodiert (150 px); ausgebrannte Hülle |
| Kugeltank (Gas), 60 × 60 px | alle | nein | 40 % / 30 % | ja (Höhe 40) | 2000 | explodiert (220 px); eingesackte Kugel |
| Destillationskolonne | alle | nein | 50 % / 30 % | nein | 2500 | umgestürzter Turm |
| Prozessanlage, 96 × 64 px | alle | nein | 50 % / 30 % | ja (Höhe 30) | 4000 | Stahlgerüst am Boden |
| Fackelturm (mit Flamme) | alle | nein | 20 % / – | nein | 1000 | abgeknickter Schlot |
| Schornstein | alle | nein | 40 % / 20 % | nein | 2000 | Stumpf und umgestürzter Schaft |
| Pferdekopfpumpe | alle | nein | 30 % / 10 % | nein | 300 | Wrack, Kette walzt es nieder |
| Druckbehälter | alle | nein | 50 % / 35 % | nein | 1200 | explodiert (120 px) |
| Schieberstation | Fahrzeuge | nein | 45 % / 20 % | nein | 500 | Trümmer, 20 % Deckung |
| Leitstand, 72 × 48 px | alle | nein | 60 % / 40 % | ja (Höhe 30) | 3000 | Mauerreste halten Fahrzeuge auf |

- **Kettenreaktion:** Tanks, Kugeltank und Druckbehälter explodieren wie Treibstofftank und Fässer und treffen dabei andere Props;
  ein dichtes Tanklager kann so nacheinander in Flammen aufgehen.
- **Bauen:** Tanks hinter Betonmauern (Auffangbecken), dazwischen Rohrleitungen am Boden und Rohrbrücken über den Wegen;
  Farbe (weiß, sandbeige, silbergrau) und Einzelheiten wechseln je Stück.

**Zivil und Natur, Kriegsspuren** (Gruppen „Zivil und Natur“, „Kriegsspuren“; Hecke als Kachel, sonst Einzelstücke):

| Art | hält auf | Kette walzt nieder | Deckung Inf. / Fz. | verdeckt Sicht | Treffer­punkte | danach / Besonderes |
|---|---|---|---|---|---|---|
| Zivilauto | alle | ja | 40 % / 20 % | nein | 100 | ausgebrannt; Farbe aus der Lage; Drehung in 90°-Schritten |
| Bushaltestelle | alle | ja | 10 % / – | nein | 60 | Gestell ohne Scheiben |
| Parkbank, Briefkasten, Verkehrsschild, Busch | niemanden | ja | bis 10 % | nein | 20 bis 30 | Schild: Stopp, Vorfahrt achten, Tempo, Hinweis |
| Heuballen | alle | ja | 40 % / – | nein | 40 | weg |
| Holzstapel | alle | ja | 50 % / – | nein | 150 | verstreute Stämme, 20 % Deckung |
| Brunnen | alle | nein | 40 % / – | nein | 300 | Brunnenring hält Fahrzeuge auf |
| Felsen | alle | nein | 50 % / 30 % | nein | 3000 | praktisch unzerstörbar |
| Hecke (Kachel) | alle | ja | 20 % / – | ja (Höhe 20) | 80 | weg; Laub je Jahreszeit, im Winter kahl |
| Krater | niemanden | – | 35 % / – | nein | unzerstörbar | Infanterie darin hat Deckung nach allen Seiten |
| Trümmerhaufen | Fahrzeuge | ja | 40 % / 20 % | nein | 1000 | Infanterie klettert darüber |
| Ausgebranntes Auto | alle | ja | 35 % / – | nein | 150 | weg |
| Umgestürzter Baum | alle | ja | 35 % / – | nein | 120 | weg |

- **Bild:** Zivilauto, ausgebranntes Auto, Parkbank, Heuballen, Busch und Felsen zeichnen dieselben Maler wie die Autos, Bänke, Ballen
  und die Natur der Karte; die Hecke verdeckt Infanterie (Augen 16), Fahrzeuge (20) sehen gerade nicht darüber.
- **Zufallskarten:** Hecken an Äckern (wie Mauern und Zäune), 7 Paare Kriegsspuren 120 bis 1300 px außerhalb des Zonenrands, an gut einem
  Drittel der Einzelhäuser ein Stück Kleinkram (Holzstapel, Brunnen, Auto, Briefkasten), alles gespiegelt. Zusammen mit Feldern, Lagern
  und Höfen im Mittel rund 96 Props je Karte.

- **Bewegung:** Infanterie, Radfahrzeuge und Kettenfahrzeuge (`crush` in `units.js`: Kampfpanzer, Schützenpanzer, Bergepanzer,
  Flakpanzer, Gepard, Panzerhaubitze, Raketenwerfer, Bagger, Brückenleger) suchen getrennte Wege. Ein Kettenfahrzeug fährt durch
  überfahrbare Kacheln, die Kachel ist danach weg (die Lücke ist für alle frei). Luftfahrzeuge kümmern sich nicht darum.
  Bauplätze, Stadtzellen und Startformationen meiden jede Kachel.
- **Tore:** Eine gerade Kachel (und die Schranke) kann ein Tor sein. „Zu“: Bodeneinheiten öffnen es im Vorbeigehen (die Wegsuche rechnet
  1,5 Zellen Umweg dafür), ohne Einheit in seiner Zelle schließt es nach 4 s wieder; geschlossen gibt es Deckung und Sicht wie die Kachel.
  „Offen“: bleibt offen, hält niemanden auf, keine Deckung. „Verschlossen“: sperrt wie die Kachel (zerstören oder überfahren).
- **Gezielt beschießen:** A + Klick auf ein Prop (Befehl `attackProp`): die gewählten Einheiten fahren in Reichweite und schießen mit
  ihrer stärksten Waffe gegen die Panzerklasse des Props, bis es Trümmer oder weg ist. Krater sind kein Ziel. Von selbst greift niemand
  Props an.
- **Nebel und Minimap:** Jedes Team sieht Props im Zustand, in dem es sie zuletzt gesehen hat (heil, Trümmer, weg, Tor offen oder zu);
  die Karte selbst kennt jeder. Die Minimap zeigt Props, die etwas aufhalten oder decken, als kleine dunkle Marken (Trümmer blass).
- **Deckung:** Direktfeuer auf eine Einheit, die höchstens 24 px neben einer Kachel steht, wobei die Kachel zwischen ihr und dem
  Schützen liegt (Winkel höchstens 63°), macht entsprechend weniger Schaden; die Kachel nimmt die Hälfte des abgefangenen Schadens
  (gegen ihre Panzerklasse: Holz und Draht „leicht“, Mauern „Bauwerk“). Steilfeuer, Granaten und Angriffe aus der Luft kennen keine Deckung.
- **Sicht:** Betonmauern (Höhe 26) verdecken im Nebel, was dahinter steht, für Infanterie (Augen 16) und Fahrzeuge (20); Gebäude
  und Besatzer (30) sehen darüber. Auch auf flachen Karten.
- **Zerstörung:** Granaten, Raketen und Bomben treffen Kacheln im Umkreis wie Gebäude (Splash). Ohne Trefferpunkte wird die Kachel
  zu Trümmern (Werte oben) oder ist weg. Spielstände speichern den Zustand.
- **Editor:** Werkzeug „Deko“: rechts die Art wählen, tippen setzt eine Kachel, ziehen eine Linie mit höchstens einer Ecke;
  Einzelstücke: tippen setzt (Drehung rechts vorher wählen), ziehen verschiebt. Mit „Wählen“: Tor bzw. Schranke (zu, offen), Drehen,
  Art wechseln, Fahne. Höchstens 6000 Props je Karte.
- **Zufallskarten:** Mit eigenem Zufall (die übrige Karte eines Seeds bleibt gleich) bekommen 30 % der geraden Äcker an einer Seite
  ein Stück von 4 bis 9 Kacheln (Bruchsteinmauer, Holzzaun oder Maschendraht, lange Zäune mit offenem Tor), punktsymmetrisch, abseits
  von Straßen, Feldwegen, Bauland, Zone, Kisten und Brückenzufahrten. Weiden haben schon ihren gemalten Koppelzaun. Sperrt das die
  Verbindung der Startpunkte, entfallen die Props.
- **Feldstellungen** (Paket „Deckung“, `js/game/fieldwork.js`, Werte `PROPS.field`): Im Baumenü (B) bauen Infanterie und Baufahrzeug
  Props mit Deckung überall auf der Karte, auch außerhalb des FOB-Bauradius. Der Bauer läuft hin (bis 40 px), arbeitet und zahlt das
  Baumaterial erst bei Fertigstellung: aus seiner eigenen Ladung (Soldaten tragen 50), sonst aus dem FOB-Lager im Bauradius, sonst aus
  einem eigenen LKW in Reichweite. Stehen eigene Einheiten auf einer Zelle, die das fertige Prop sperren würde, wartet er.

  | Feldstellung | Taste | Baumaterial | Arbeit | wer baut |
  |---|---|---|---|---|
  | Sandsack-Stellung (Halbkreis; darin Deckung nach allen Seiten) | G | 20 | 10 s | Infanterie, Baufahrzeug |
  | Sandsackwall (Kachel) | H | 8 | 4 s | Infanterie, Baufahrzeug |
  | Hesco-Barriere (Kachel) | K | 20 | 6 s | nur Baufahrzeug |
  | Betonsperre (Kachel) | L | 15 | 5 s | nur Baufahrzeug |

  Kacheln: ein Klick je Feld (Shift hält den Modus), der Befehl nimmt auch Linien bis 12 Kacheln (`x2`, `y2`). Die Stellung dreht sich
  mit der Längsseite quer zur Richtung Bauer → Klick. Gebaute Feldstellungen gehören dem Team: eigene Kettenfahrzeuge walzen sie nicht
  nieder, gegnerische schon. Gegner kennen sie erst, wenn sie sie sehen. Die KI gräbt sich damit ein (§10 „Deckung“).
- **Bild:** Gleicher Painter und gleiches Licht wie Einheiten und Gebäude, Schatten scharf nach links unten (2D nach rechts unten),
  Schnee auf den Oberkanten im Winter, Farbe je Gebiet, Einzelheiten je Kachel. Vorschau: `node tools/propspreview.mjs`.

### Hot Zone
- Kleiner Kreis (Radius 300 px) **innerhalb** der Konfliktzone, orange; auch auf der Minimap.
  In der Eroberung wandert er im eingeschriebenen Kreis des Quadrats.
  Er wandert langsam (13,3 px/s) zu einem
  Zufallspunkt (neues Ziel alle 25–45 s); nur auf dem Weg zu einem aktiven Bohrer ist er mit 40 px/s schneller.
- **Geld:** Einheiten in der Hot Zone bringen **0,8 Geld/s** statt 0,4 (das Doppelte, nicht zusätzlich).
  **Besitz** nur, wenn eine Partei allein darin ist (Anzeige „HOT“); er bringt kein eigenes Geld.
  Punkte gibt es nicht separat; die Einheiten darin zählen doppelt für den Punktebalken (klassisch; in der Eroberung bringt die Hot Zone nur das Geld, [eroberung.md](eroberung.md)).
- Oben zeigt „HOT“ den Besitzer und die Einheitenzahl je Team, klassisch daneben der Punktebalken.

### Sendemast (ausgebaut)
- Den Sendemast-Sieg (zweite Siegbedingung, Gebäude „Sendemast“) gibt es seit dem Paket „Ohne Sendemast“ nicht mehr: kein Schalter im
  Startmenü, kein Gebäude, keine KI dafür. Spielstände mit gebautem Mast lehnt das Laden mit Meldung ab.

## 7. Konfliktzone & Punkte (Teil)

### Fluss mit Brücken und Furten
- Im Startmenü schaltbar („Fluss“: An/Aus, gemerkt, Standard An; `Game({ river })`, ohne Angabe aus).
  Gilt für Zufallskarten; eigene Karten bringen ihre Flüsse, Brücken und Furten selbst mit (§9a).
  Ohne Fluss bleibt die Zufallskarte je Seed genau wie bisher.
- **Lage:** Vor den Startecken von Blau und Rot windet sich ein Fluss (punktsymmetrisch; mit 3 oder 4 Spielern nur diese beiden, [eroberung.md](eroberung.md)) im Bogen um die Ecke,
  3728–3968 px von ihr entfernt (mit der größeren Karte), außerhalb der Konfliktzone und des Startgeländes.
  Zur Zone liegt er so nah wie vorher, von der Hauptstadt doppelt so weit: das Wasser beginnt rund 2500–2800 px (40–44 Stadtzellen) vor ihr, vorher 1300–1450 px (20–23 Zellen).
  Flussbett 184 px breit (bis 43 unter dem Wasserspiegel), dann 330 px sanftes Ufer.
  Seen in den Brückenzufahrten werden aufgefüllt.
  Der Fluss ist Wasser im Gelände (§7): unpassierbar, nur Hubschrauber fliegen darüber.
- **Übergänge je Fluss:** **3 Brücken** (bei 16°, 45° und 74° des Bogens, dort wo das Ufer am flachsten ist, Straßen über Wasser fallen weg) und **2 Furten** (dazwischen, Radius 150 px).
  Der Generator prüft, dass jedes Ufer jedes Übergangs an ein großes Gebiet anschließt und dass ohne Brücken und Furten kein Weg hinüber führt; sonst verwirft er den Versuch.
- **Furt:** seichtes Wasser (bis 12 unter dem Spiegel) im Furtkreis ist passierbar.
  Bodeneinheiten fahren dort mit **halbem Tempo**, die Wegsuche zahlt 3 je Zelle dazu und nimmt lieber eine Brücke.
  Rot-weiße Pfosten markieren die Furt.
- **Brücke:** seit v5.03 genau waagrecht oder senkrecht auf einer Reihe von Stadtzellen (Mitte auf einer Zellmitte, Enden auf Zellkanten; quert sie den Fluss schräg, ist sie länger),
  ihre Fahrbahn ist eine **Stadtstraße** (Asphalt, Gehwege, Mittellinie im Takt der Straßenzellen): sie zählt wie die Zonenstraßen für alle Teams als Straße,
  und eigene Straßen schließen an den Brückenenden an.
  Neutrales Objekt (gehört niemandem) mit **2400 Leben**, Fahrbahn 80 px breit (davon eine Zelle Straße), öffnet die Wasserzellen darunter.
  Einheiten darauf stehen auf der Fahrbahnhöhe (Höhenvorteil, Iso).
  **Nur auf Befehl beschossen** (A + Klick auf die Brücke, §8): weder Zielsuche noch Angriffsbewegung greifen sie an.
  Schaden wie bei Häusern (schwere Waffen × 1,5, Handwaffen × 0,5); Mörsergranaten treffen sie mit ihrem Splash.
  Bei 0 Leben stürzt sie ein (Meldung „Brücke zerstört“ an beide): die Fahrbahn sperrt, wer darauf stand, landet am nächsten Ufer.
- **Wiederaufbau:** Baufahrzeug wählen und auf die Trümmer tippen bzw. rechtsklicken.
  Der erste Auftrag kostet **200 Geld**, danach helfen weitere Baufahrzeuge (auch des Gegners) ohne Kosten.
  Ein Baufahrzeug arbeitet bis 90 px vom Brückenkopf (es fährt zum erreichbaren Ufer) und braucht **30 s**, mehrere entsprechend schneller (höchstens 3 zählen).
  Fertig: volle Leben, Fahrbahn offen, Meldung „Brücke wieder aufgebaut“.
- Auf Brücken (auch an den Brückenköpfen) und in Furten wird nicht gebaut („Nicht auf Brücken und in Furten“).
- Werte: `BALANCE.river`; Logik `js/game/river.js`, Flussbett `js/game/landscape.js`, Grafik `js/render/bridge.js`.

### Bohrer
- Nach dem Bau **30 s Aufwärmen**, dann per **G** aktivierbar: **2 min aktiv**, danach **5 min Abkühlen**.
- Aktiv verbraucht er **1 Treibstoff/s** aus der versorgenden FOB; ohne Treibstoff schaltet er ab (dann ebenfalls 5 min Pause).
  Start nur, wenn die FOB mindestens 10 Treibstoff hat.
- Aktive Bohrer ziehen die Hot Zone an (Ziel wird in die Konfliktzone gezogen). Bei mehreren: die FOB mit den meisten aktiven
  Bohrern, bei Gleichstand die mit dem zuerst aktivierten. Hat sie nur einen aktiven Bohrer, ist das Ziel der Bohrer, sonst die FOB.
  Ohne aktiven Bohrer wandert die Hot Zone wieder zufällig.
