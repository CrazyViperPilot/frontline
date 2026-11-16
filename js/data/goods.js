// Register der Waren der Stadt (seit v5.59, Review-Paket P6, Befunde E-01, Q-04): eine Quelle je Ware für Namen, Kürzel, Farbe,
// Lager, Marktpreise und Ertrag. Regeln: PRD §15. Kein DOM, kein Import (js/data/city.js liest von hier).
// Daraus abgeleitet: CITY.yield/market.sell/buy (js/data/city.js), die Warenlisten in js/game/city.js (Markt, Stadtlager)
// und js/game/flow.js (Lager), Namen und Farben in Marktmenü, Infofeld und Ressourcenanzeige.
// Seit Paket „Import“: Rohwaren (IMPORTS unten) kommen von außerhalb der Karte; was ein Werk je Einheit braucht, steht in CITY.chain.
// Die Reihenfolge hier ist die Reihenfolge im Marktmenü und in der Ressourcenanzeige.
//
// Felder je Ware:
//   name   voller Name (Ressourcenanzeige, Marktmenü)      short  Kürzel (Mengen, Infofeld, Marktmenü)
//   color  Farbe der Linien und Knoten in der Ressourcenanzeige (#rrggbb)
//   store  wo sie liegt: 'main' Lager der Hauptstadt (BALANCE.logistics.capitalCap), 'city' Stadtlager (Feld c.<Ware>,
//          BALANCE.logistics.storeCap)
//   sell, buy  Geld je Los (CITY.market.lot) am Markt; fehlt = nicht handelbar
//   yield  höchster Ertrag je Arbeiter und Sekunde im Werk, das sie macht (CITY.chain), begrenzt durch die angelieferten Rohwaren
//   full   Hinweis der Ressourcenanzeige, wenn das Stadtlager voll ist (nur store 'city')
// Baumaterial, Munition und Treibstoff sind zugleich die Sorten der FOB-Lager und LKW (js/game/logistics.js); eine neue Ware dieser
// Art braucht deutlich mehr (Lager, LKW, HUD) und ist nicht Teil des Rezepts docs/rezepte/neue-ware.md.
export const GOODS = {
  bm: { name: 'Baumaterial', short: 'BM', color: '#b58248', store: 'main', sell: 20, buy: 200, yield: 0.1 },
  mun: { name: 'Munition', short: 'MUN', color: '#d9b600', store: 'main', sell: 30, buy: 300, yield: 0.06 },
  fuel: { name: 'Treibstoff', short: 'TS', color: '#9b7bc4', store: 'main', sell: 30, buy: 300, yield: 0.05 },
  metal: { name: 'Stahl', short: 'Stahl', color: '#8fb3c9', store: 'city', sell: 40, buy: 400, yield: 0.05, full: 'Mehr Fahrzeuge ausbilden oder am Markt verkaufen.' },
  kero: { name: 'Kerosin', short: 'Kerosin', color: '#56b3e6', store: 'city', sell: 35, buy: 350, yield: 0.04, full: 'Kerosin am Fliegerhorst (Kerosintank) oder bei Hubschraubern verbrauchen oder am Markt verkaufen.' },
};

/** Waren, deren Eintrag `test` erfüllt (Reihenfolge des Registers). */
const goodsWhere = (test) => Object.keys(GOODS).filter((g) => test(GOODS[g]));
/** Waren mit Lager (Hauptstadt oder Stadtlager). */
export const STORED_GOODS = goodsWhere((d) => d.store);
/** Waren im Stadtlager (Stahl heißt intern metal). */
export const CITY_STORE_GOODS = goodsWhere((d) => d.store === 'city');
/** Waren am Markt. */
export const MARKET_GOODS = goodsWhere((d) => d.sell !== undefined);
/** Name, Kürzel und Farbe je Ware. */
export const GOOD_NAME = Object.fromEntries(Object.entries(GOODS).map(([g, d]) => [g, d.name]));
export const GOOD_SHORT = Object.fromEntries(Object.entries(GOODS).map(([g, d]) => [g, d.short]));
export const GOOD_COLOR = Object.fromEntries(Object.entries(GOODS).map(([g, d]) => [g, d.color]));

// Rohwaren (Paket „Import“): kommen von außerhalb der Karte über eine eigene Straße am Kartenrand oder einen angeschlossenen
// Güterbahnhof, werden nicht gelagert und nicht gehandelt, nur von Werken verarbeitet (Bedarf je Einheit Produkt: CITY.chain[Werk].need).
// Felder: name, short, color wie oben; price = Geld je angelieferter Einheit (bezahlt wird, was am Werk ankommt).
// Preisregel (test/config.test.js): je Werk kosten die Rohwaren einer Einheit Produkt mindestens den Verkaufspreis je Einheit am Markt
// (sell / CITY.market.lot) und deutlich weniger als den Kaufpreis je Einheit; sonst druckte Einführen und Verkaufen Geld.
export const IMPORTS = {
  raw: { name: 'Rohmaterial', short: 'Roh', color: '#a08060', price: 0.2 }, // für das Baumaterial-Werk
  ore: { name: 'Eisen', short: 'Eisen', color: '#9a8478', price: 0.3 }, // für Stahlwerk und Munitionswerk
  oil: { name: 'Öl', short: 'Öl', color: '#4a4a52', price: 0.3 }, // für Raffinerie und Kerosin-Raffinerie
  expl: { name: 'Sprengstoff', short: 'Spr', color: '#c0503a', price: 0.4 }, // für das Munitionswerk
};
/** Rohwaren in der Reihenfolge des Registers. */
export const IMPORT_GOODS = Object.keys(IMPORTS);
