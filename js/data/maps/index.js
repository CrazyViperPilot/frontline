// Feste Karten (Paket „Feste Karten“): Karten, die mit dem Spiel kommen und im Startmenü unter „Feste Karten“ stehen.
// Jede Karte ist eine eigene Datei in diesem Ordner im Kartenformat von js/game/mapdata.js (normalizeMap); neue Karte: Datei
// anlegen (Editor „Als feste Karte exportieren“ oder ein Skript unter tools/maps/), hier eintragen, in sw.js unter ASSETS.
import eastEuropeRailway from './east-europe-railway.js';

/** id: Schlüssel im Menü und in Spielständen („fest:…“); name, info: Anzeige im Startmenü; map: Kartendaten. */
export const FIXED_MAPS = [
  {
    id: 'fest:east-europe-railway',
    name: 'East Europe Railway',
    info: 'Bahnlinie mit Brücke über den Fluss, Fabrikgelände, Hochspannungsleitung. 7 Flaggen, bis zu 4 Spieler, Baugebiete an den Kartenseiten.',
    map: eastEuropeRailway,
  },
];
