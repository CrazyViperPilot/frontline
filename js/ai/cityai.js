// Stadt-KI (PRD §15, seit v5.60 aus js/game/city.js hierher, Review A-04): Ausbau (Ringe, Viertel, Einfuhr, Anschluss, Fliegerhorst,
// Markt), Überfälle auf die gegnerische Stadt und Verteidigung. Befehle nur über game.issue; die Buchhaltung (cityAiMemory) liegt in
// der KI-Instanz (ai.js). Kein DOM, deterministisch.
// Seit dem Umbau „Stadt-KI in Module“ ist die Datei nur noch der Einstieg; der Code liegt unter js/ai/city/:
//   common.js   Buchhaltung (cityAiMemory), Gefahrenzonen, Zellenbefehl, Kandidaten des Ausbaus
//   need.js     Bedarf: welche Zone als Nächstes (aiNeed)
//   build.js    Ausbau-Schritt aiCity (ruft alle anderen Module auf)
//   station.js  Güterbahnhof, Einfuhr-Wächter (aiStation, importWatch); park.js: Grundriss und Platzsuche des Industrieparks
//   roads.js    Straßennetz: Anschluss, Netz verlängern, Straße zum Rand, Spuren
//   airbase.js  Fliegerhorst (aiAirport)
//   market.js   Markt (aiMarket)
//   raid.js     Überfälle und Verteidigung (aiRaid, aiDefend)
export { cityAiMemory } from './city/common.js';
export { aiCity } from './city/build.js';
export { aiAirport } from './city/airbase.js';
export { aiRaid, aiDefend } from './city/raid.js';
