# js/ai/ – Armee-KI (Denkschritt, Bauen, Ausbildung, Logistik, Kampf, Eroberung)

Werte aus `js/data/ai.js` und `BALANCE.difficulty`. Die KI ändert das Spiel nur über `game.issue`, liest sonst nur. Kein DOM.
Die Stadt-KI liegt in `js/ai/city/` (eigene Datei dort).

- `ai.js` – Klasse `AI`: `update(dt)` ruft im Takt `BALANCE.difficulty.<stufe>.think` die Methode `think()`. `AI`, `snapshot`, `once`
- `cityai.js` – Einstieg der Stadt-KI, nur Re-Exporte aus `city/`. `cityAiMemory`, `aiCity`, `aiAirport`, `aiRaid`, `aiDefend`
- `cooldown.js` – Sperrzeiten-Helfer (Tabelle Schlüssel → Spielzeit), keine Imports. `block`, `ready`, `take`, `prune`
- `army/build.js` – Stellungen, FOB-Fahrzeuge, Verteidigung, Mauer, Festung, Heliport, Brücken, Baufahrzeuge, Funkmast. `buildMethods`
- `army/produce.js` – Ausbildung in Kaserne, Fabrikhalle, Heliport der Stadt, Gegenmischung, Forschung, Kommandeur. `produceMethods`
- `army/logistics.js` – LKW-Rollen, Lieferant, Pendler, Versorger, Kisten einsammeln. `logisticsMethods`
- `army/combat.js` – Armee `army()` (klassisch), Angriffswellen, Rückzug, Artillerie, Späher, Flankenangriff, Häuserkampf, Jets. `combatMethods`, `needA10`
- `army/cover.js` – Deckung: Infanterie gräbt sich in der Zone mit Sandsack-Stellungen ein und besetzt sie. `coverMethods`
- `army/conquest.js` – Eroberung: `conquestArmy` statt `army()`, Flaggenziele, Erscheinungsort per `spawnAt`. `conquestMethods`
- `army/util.js` – gemeinsame Konstanten und Hilfen der Armee-Module. `DEF_RANGE`, `ZONE_FOB_R`, `dist`, `unitVec`

## Besonderheiten
- Die Module in `army/` sind Objekte mit Methoden, die die Klasse `AI` per `Object.assign(AI.prototype, …)` einhängt. Sie importieren die Klasse nie.
- Neues Verhalten als Methode in das passende Modul, aufgerufen aus `think()`. Zustand der Instanz bleibt in `AI` (Spielstände gleich).
- Je Spielart verschieden (`game.mode.aiArmy`): Wellen-, Späher- und Flankenlogik gelten nur klassisch, die Eroberung läuft über `conquestArmy`.
- Konstanten je Feature mit Präfix in `js/data/ai.js` (`WAVE_*`, `AIR_*`, `CQ_*` …); Bedeutung in PRD §10 „KI-Konstanten“ (`docs/prd/ki.md`).

Exporte dieses Ordners: `docs/index/ai.md`, Unterordner `ai-army.md`, `ai-city.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
