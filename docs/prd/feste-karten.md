# Frontline PRD – Feste Karten (East Europe Railway)

> Teil des PRD. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md). Eroberung allgemein: [eroberung.md](eroberung.md).

## Feste Karten

- Im Startmenü unter **Karte** gibt es neben Zufall und gespeicherten Karten **„Feste Karten“**: Karten, die mit dem Spiel kommen
  (Register `js/data/maps/index.js`). Die Auswahl zeigt eine Beschreibung und eine **Vorschau** (Gelände, Wege, Bahn, Gebäude,
  Leitungen, Flaggen mit Buchstaben, Startpunkte in Teamfarben, Grenzen der Baugebiete). „Im Editor öffnen“ lädt sie in den
  Karteneditor; Speichern legt dort eine eigene Kopie an, die feste Karte bleibt unverändert.
- Eine Karte hat **2 bis 4 Startpunkte**; Team *i* startet am Startpunkt *i* (Blau, Rot, Grün, Gelb). In der Eroberung spielen höchstens
  so viele Spieler, wie die Karte Startpunkte hat; klassisch immer die ersten beiden.
- **Eigene Flaggen** (`flags`, höchstens 16, Buchstaben in Kartenreihenfolge, optional mit Namen): Statt des 4 × 4-Rasters gilt in der
  Eroberung ein **Kreis** mit Halbmesser `r` um jeden Mast als Flaggengebiet (Vorgabe `mapFlagR` 520 px, erlaubt `mapFlagRange`
  250–1000 px). Gebiete liegen ganz im Quadrat der Konfliktzone und halten `mapFlagGap` 120 px Abstand. Zonengeld bringt weiter das
  ganze Quadrat, auch zwischen den Flaggen. Meldungen nennen Buchstabe und Name („Rot nimmt Flagge A (Gehöft) ein“), die Leiste oben
  zeigt den Namen als Hinweis.
- **Baugebiete an den Seiten** (`layout: 'sides'`): Außerhalb der Zone teilen die Diagonalen durch die Ecken der Zone die Karte in vier
  Seiten; jede gehört dem Spieler, dessen Startpunkt dort liegt (sonst wie die Viertel der Eroberung: gesperrt für andere, die Stadt baut
  nur dort). Ohne Angabe bleibt es bei den Ecken (Kreuz durch die Kartenmitte).
- Zufallskarten ändern sich dadurch nicht.

## East Europe Railway

Eigene Karte in der Art einer osteuropäischen Bahnstrecke, normale Kartengröße (11 072 px), **7 Flaggen**, **bis zu 4 Spieler**, je einer
an jeder Kartenseite: Blau Süden, Rot Norden, Grün Westen, Gelb Osten. Ein Fluss läuft von einem See in der Nordost-Ecke zu einem See in
der Südwest-Ecke durch die Zone; eine **Bahnlinie** von West nach Ost kreuzt ihn auf einer **Eisenbahnbrücke** in der Mitte (Gleis statt
Fahrbahn, Fahrzeuge kommen trotzdem hinüber, zerstörbar wie jede Brücke). Dazu zwei Straßenbrücken und zwei Furten.

| Flagge | Ort |
|---|---|
| A Gehöft | Norden, Hof mit Feldern am bewaldeten Hügel |
| B Bahnhof | Nordwest, Bahnhof mit Bahnsteig und Güterzug |
| C Dorf | Westen, Dorf an der Kreuzung |
| D Bahnbrücke | Mitte, an der Eisenbahnbrücke |
| E Umspannwerk | Osten, umzäuntes Umspannwerk, Weiler |
| F Fabrik | Südost, **große Fabrikhalle** an der Bahn mit Schornsteinen und Silos (besetzbar für 16 Soldaten, 3000 LP), Hallen, Mauer |
| G Steinbruch | Süden, Felsen und Brecherhallen am Berg |

Hochspannungsleitungen auf **großen Strommasten** laufen vom Umspannwerk über die Karte (Masten blockieren wie kleine Gebäude, die Seile
sind nur Bild). Blau und Rot stehen sich punktsymmetrisch gegenüber, ebenso Grün und Gelb. Die Karte entsteht mit
`node tools/maps/east-europe-railway.mjs`.

## Karteneditor

- Werkzeuge **Start Grün** und **Start Gelb** (dritter und vierter Startpunkt; nur der letzte lässt sich löschen), **Flagge** (Größe und
  Name im Infofeld), **Fabrikhalle** (groß) und **Strommast** (Masten derselben Leitung werden der Reihe nach verbunden; „Neue Leitung“
  beginnt eine weitere).
- Die gewählte Konfliktzone schaltet **Baugebiete in den Ecken / an den Seiten** um. Gestrichelt zeigt der Editor das Quadrat der
  Eroberung und die Grenzen der Baugebiete.
- **„Als feste Karte“** lädt die Karte als JS-Datei für `js/data/maps/` herunter (Rezept: `docs/rezepte/feste-karte.md`).
