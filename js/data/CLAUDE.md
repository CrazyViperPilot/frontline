# js/data/ – Spielwerte und Register

Nur Daten, kein DOM, jeder Wert mit deutschem Kommentar, was er bewirkt. Keine neuen Balance-Zahlen als Konstanten in `js/game` oder `js/ai`.
Nach jeder Änderung `npm run docs` und `npm run test:quick`; PRD-Text und Hilfetexte auf die alte Zahl durchsuchen.

- `balance.js` – alle globalen Spielzahlen; oben `QUICK` (Schnelleinstellungen), darunter `BALANCE` mit Inhaltsverzeichnis. `QUICK`, `BALANCE`
- `units.js` – Einheiten und Waffen (Kosten, Ausbildungszeit, HP, Tempo, Sicht, `weapons[]`). `UNITS`
- `buildings.js` – Gebäude (Größe, HP, Kosten, Bauzeit, Waffe, Flugabwehr, Taste im Baumenü). `BUILDINGS`
- `research.js` – Forschungsbaum: Stufen, Äste, Preise, Zeiten, Wirkung je Einheitengruppe. `RESEARCH`
- `ai.js` – Armee-KI-Werte (Wellen, Späher, Expansion, Kisten, Eroberung `CQ_*`), eine Konstante je Zeile. `MAX_PLACE`, `THREAT_RANGE`, `RESERVE`
- `mapgen.js` – Kartengenerator (Hügel, Seen, Fluss, Stadt, Häuser, Felder, Kisten-Abstände). `MAPGEN`
- `maps/index.js`, `maps/east-europe-railway.js` – feste Karten (Startmenü „Feste Karten“): Register `FIXED_MAPS`, je Karte eine Datei (erzeugt von `tools/maps/`). `FIXED_MAPS`
- `city.js` – Stadt: Gebiet, Einwohner, Wachstum, Transport, Markt, Fliegerhorst, Ressourcenkette, Stadt-KI. `CITY` (`CITY.chain`, `CITY.ai`)
- `citykinds.js` – Register der Stadtzellenarten (feste `id`, Name, Werkzeug, Farbe, Preis, Größe, Strom, Rolle); importiert nichts. `CITY_KINDS`, `KINDS`, `KIND_ID`, `WORKS`
- `goods.js` – Register der Waren und Rohwaren (Name, Farbe, Lager, Marktpreise, Ertrag, Einfuhrpreis); importiert nichts. `GOODS`, `IMPORTS`, `MARKET_GOODS`

## Besonderheiten
- KI-Werte liegen an drei Orten: Armee-KI im Modul für KI-Werte, Stadt-KI in `CITY.ai`, je Schwierigkeit verschiedene in `BALANCE.difficulty`.
- Die beiden Register sind die Quelle; `CITY.cost`, `CITY.size`, `CITY.yield`, `CITY.market` u. a. werden daraus abgeleitet. Neue `id` = höchste + 1, nie umnummerieren.
- Der Kartengenerator ändert mit jedem Wert alle Zufallskarten (Seeds, Tests, `test/golden.test.js`).
- Zellenarten und Waren ändern: Rezepte in `docs/rezepte/` (`neue-stadtzellenart.md`, `neue-ware.md`, `neue-rohware.md`).
- Welcher Schlüssel wofür: `docs/wo-aendern.md` (erst dort suchen, dann hier nur den Schlüssel lesen).
- `BALANCE.match.tokenDays`, `walletMax`, `startRes.money` haben PHP-Spiegel in `api/lib/` (`FL_MATCH_TOKEN_DAYS`, `FL_WALLET_*`): mit ändern.

Exporte dieses Ordners: `docs/index/data-*.md`, nach Anfangsbuchstaben geteilt (erzeugt; nach Änderungen an Exporten `npm run index`).
