# Symbol-Index data (Teil 3 von 3, citykinds.js bis units.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/data/`. Pfade relativ zu `js/data/`.

## citykinds.js (Fortsetzung)
- KIND_NAME
- WORKS – Werke (Verarbeitung nach CITY.chain)
- SUPPLIER_KINDS – Lieferanten (Förderung und Werke): ihr Ausstoß fährt über die Straße zu einem W…
- WORKPLACE_KINDS – Arbeitsstätten mit Pendlerweg (alle Arten mit Arbeitsplätzen)
- FLAT_KINDS – Flache Zellen (Straße, Bahn, Rollfeld): sofort fertig, kein Gebäude
- KIND_COLOR – Farbe und Symbol je Werkzeug (Zellenarten und Räumen) für Baumenü, Grundstücke…
- KIND_ICON
- BUILD_MENU – Baumenü: [[Gruppe, [Werkzeug …]] …] in der Reihenfolge des Registers, ohne nich…

## goods.js (4.3 KB)
- GOODS – Register der Waren der Stadt (Review-Paket P6, Befunde E-01, Q-04): eine Quelle…
- STORED_GOODS – Waren mit Lager (Hauptstadt oder Stadtlager)
- CITY_STORE_GOODS – Waren im Stadtlager (Stahl heißt intern metal)
- MARKET_GOODS – Waren am Markt
- GOOD_NAME – Name, Kürzel und Farbe je Ware
- GOOD_SHORT
- GOOD_COLOR
- IMPORTS – Rohwaren (Paket „Import“): kommen von außerhalb der Karte über eine eigene Stra…
- IMPORT_GOODS – Rohwaren in der Reihenfolge des Registers

## mapgen.js (27 KB)
- MAPGEN – Werte des Kartengenerators (js/game/map.js, landscape.js, relief.js, river.js,…

## props.js (18 KB)
- PROPS – Props der Karte (Deko und Gelände: Zäune, Mauern, später Sandsäcke, Container,…

## research.js (12 KB)
- RESEARCH

## units.js (36 KB)
- UNITS
