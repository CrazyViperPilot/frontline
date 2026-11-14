# Frontline PRD – Eroberung (Flaggen, Tickets, Viertel, bis zu 4 Spieler)

> Teil des PRD, Abschnitt §7 „Eroberung“. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier eintragen, die Version in [docs/changelog.md](../changelog.md).

## 7. Eroberung

Modus des Startmenüs (Standard **An**; `new Game()` ohne Angabe: aus, dann gilt die klassische Partie mit Punktebalken und zwei Teams,
[zone-gelaende.md](zone-gelaende.md)). Werte: `BALANCE.conquest` (`js/data/balance.js`), Logik: `js/game/conquest.js`.

### Spieler

- **2 bis 4 Spieler**: der Mensch (Blau) und **1 bis 3 Computergegner** (Rot, Grün, Gelb). Im Startmenü hat **jeder Computergegner seine
  eigene Schwierigkeit** (Leicht, Normal, Schwer; gemerkt). **Jeder gegen jeden**, keine Allianzen.
- Jeder Spieler startet in einer Kartenecke mit Hauptstadt, Stadt und Startarmee wie bisher. Startecken: Blau unten links, Rot oben
  rechts, Grün oben links, Gelb unten rechts.
- **Einheitenlimit** je Spieler nach Spielerzahl (`slotCap`): **500** bei 2, 3 und 4 Spielern (klassisch 300). Viele Einheiten kosten Bildrate, vor allem auf Tablet und Telefon.
- Zufallskarten mit 2 Spielern sind je Seed dieselben wie klassisch. Mit 3 oder 4 Spielern bekommen auch die beiden anderen Ecken
  Bauland, flaches Gelände und eine Zufahrt; die Karte bleibt **punktsymmetrisch** (Blau/Rot und Grün/Gelb spiegeln sich, die beiden
  Paare haben verschiedenes Gelände; Flüsse liegen nur vor den Ecken von Blau und Rot). Gespeicherte Karten aus dem Editor haben
  zwei Startpunkte: dort spielt nur ein Gegner.

### Konfliktzone und Flaggen

- Die Konfliktzone ist ein **Quadrat** in der Kartenmitte (Kantenlänge 2 × `half` = 6600 px) aus **4 × 4 gleich großen Gebieten**
  (je 1650 × 1650 px). In der Mitte jedes Gebiets steht eine **Flagge** mit Buchstabe **A bis P** (zeilenweise von links oben).
- **Einnehmen:** Wer in einem Gebiet **mehr Einheiten** hat als jeder andere, bewegt den Balken der Flagge (Gleichstand: nichts
  geschieht). Gehört die Flagge einem anderen, sinkt dessen Balken zuerst auf 0 (Flagge wird **neutral**, grau), dann steigt der
  eigene auf voll (**Besitz**). Jede Phase dauert `capTime` 20 s bei einer Einheit Vorsprung, mit mehr Vorsprung bis `capMaxMul` 3 ×
  schneller. Flugzeuge im Überflug zählen nicht, Hubschrauber und Besatzer in Häusern schon.
- **Farben:** Die Flagge, ihre **Umkreislinie** und ihr Gebiet auf der Minimap tragen die Farbe des Besitzers, neutral grau. Solange
  Gegner im Gebiet stehen, ist die Umkreislinie gestrichelt („umkämpft“); ein äußerer Bogen zeigt den Fortschritt der Einnahme.
  Die Leiste oben zeigt alle 16 Buchstaben in der Farbe ihres Besitzers.
- **Geld:** Jede gehaltene Flagge bringt `flagIncome` 1,5 Geld/s. Das Zonengeld je Einheit (0,4/s, Hot Zone 0,8/s) bleibt, es gilt
  im ganzen Quadrat. Hot Zone, Kisten, Häuserkampf, Bohrer und Sendemast bleiben unverändert.

### Tickets und Sieg

- Jeder startet mit **Tickets** nach Wahl im Startmenü (`ticketChoices`: 75, 150, 300 oder **1000** für lange Partien; Standard 300, gemerkt).
- Alle `tickEvery` 10 s verliert jeder, der **weniger Flaggen hält als der Führende**, 1 Ticket; wer **gar keine** Flagge hält,
  zusätzlich `noFlagLoss` 1. Der Führende (auch mehrere bei Gleichstand) verliert nichts. Hält niemand eine Flagge, verliert niemand.
- Fällt ein Kommandeur, kostet das sein Team 5 Tickets (statt Punkte für den Gegner).
- **Ausscheiden:** Wer keine Tickets mehr hat oder dessen Hauptstadt fällt, scheidet aus: seine Einheiten und Gebäude verschwinden
  (ohne Prämie), seine Flaggen werden neutral, sein Viertel ist offen.
- **Sieg:** Der letzte Spieler mit Tickets gewinnt. Scheidet der Mensch aus, endet die Partie sofort als Niederlage (Sieger ist
  dann, wer die meisten Tickets hat). Der Sendemast-Sieg gilt weiter, wenn eingeschaltet.

### Viertel und Sperre

- Die Karte außerhalb der Zone ist durch ein Kreuz durch die Kartenmitte in **vier Viertel** geteilt; jedes gehört dem Spieler, dessen
  Startecke darin liegt. Viertel ohne Spieler sind für alle gesperrt.
- In ein **fremdes Viertel** kann niemand hineinfahren, hineinfliegen oder hineinschießen: Befehle mit Ziel dort werden abgelehnt
  („Gesperrtes Viertel eines anderen Spielers“), die Wegsuche behandelt es als unpassierbar, die Zielsuche übergeht Ziele dort, und
  Schaden wirkt dort nicht (auch nicht durch Granaten oder Flächenfeuer). Hubschrauber halten an der Grenze. **Nur das
  Aufklärungsflugzeug (U-2)** darf darüber fliegen. Aus dem eigenen Viertel heraus darf in die Zone geschossen werden.
- Kampfflugzeuge können in ihren Kurven kurz über ein fremdes Viertel geraten (Flugbahn), sie wirken dort aber nicht.
- **Die Sperre fällt:** Hält ein Spieler `lockGrace` 300 s lang keine Flagge, während ein anderer eine hält, ist sein Viertel **für den
  Rest der Partie offen** (Meldung an alle). Dann kann seine Stadt angegriffen und seine Hauptstadt zerstört werden.
- Stadtgebäude baut jeder nur im **eigenen Viertel** (nicht in der Zone, nicht bei anderen). FOBs und Militärgebäude dürfen wie
  bisher in die Zone.
- Auf der Karte: Grenzen gestrichelt, rot solange das Nachbarviertel für das eigene Team gesperrt ist; der Rand eines gesperrten
  Viertels zur Zone hin trägt die Farbe seines Besitzers.

### Einheiten an Flaggen erscheinen lassen

- Ausbildungsgebäude für Bodeneinheiten (Kaserne, Fabrikhalle; ohne Stadt die Hauptstadt) haben im Infofeld die Auswahlliste
  **„Neue Einheiten erscheinen“**: **am Gebäude** (Standard) oder an einer **Flagge, die einem gerade gehört** (Befehl `spawnAt`).
- Neue Einheiten erscheinen dann im Umkreis `spawnRing` 90 px um den Mast. Steht beim Abschluss der Ausbildung ein **Gegner im Gebiet**
  („umkämpft“) oder ist die Flagge verloren, erscheint die Einheit am Gebäude und läuft zum Sammelpunkt; die Wahl bleibt bestehen.
- Flugzeuge und Hubschrauber erscheinen immer an Stellplatz bzw. Heliport.

### KI

- Jede KI spielt gegen alle. Statt der Zonenmitte greift sie **Flaggen** an (`js/ai/army/conquest.js`): Untätige Einheiten außerhalb
  der Zone sammeln sich zur Welle (Stärke `attackStrength`, mit Geduld wie bisher) und ziehen im Keil zur besten Flagge. Bewertung:
  Entfernung, **Flaggen des Führenden wirken `CQ_LEADER` 1500 px näher** (der Führende wird gezielt angegriffen), neutrale `CQ_NEUTRAL`
  1000 px näher, je gegnerischer Einheit im Gebiet `CQ_GUARD` 220 px ferner.
- In der Zone bleibt eine Gruppe auf einer fremden Flagge, bis sie eingenommen ist, und greift sichtbare Gegner im Gebiet an. Danach
  bleiben `CQ_HOLD` 2 Einheiten als Wache, der Rest zieht zur nächsten Flagge.
- Ab Normal lässt sie neue Bodeneinheiten an der eigenen, unbestrittenen Flagge erscheinen, die ihrem nächsten Ziel am nächsten liegt
  (alle `CQ_SPAWN_EVERY` 15 s neu gewählt).
- Überfälle der Stadt-KI gelten nur Städten, deren Viertel offen ist. Verteidigungsbauten und Festungen richten sich zur Zonenmitte.
