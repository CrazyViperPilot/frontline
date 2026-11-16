# test/

Für einen neuen Test diese Vorlage nehmen; keine große Testdatei ganz lesen. Helfer: `util.js`.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../js/data/balance.js';
import { mkGame, run, hq, withValue } from './util.js';

test('Ausbildung ohne Stadt zieht den Preis vom Geld ab und bringt die Einheit', () => {
  const g = mkGame({ city: false }); // Seed 1; ohne Stadt bildet die Hauptstadt aus
  const money = g.teams[0].res.money;
  const count = () => g.units.filter((u) => u.team === 0 && u.type === 'rifleman').length;
  const before = count();
  assert.ok(g.issue(0, { type: 'train', buildingId: hq(g).id, unit: 'rifleman' }).ok);
  assert.ok(g.teams[0].res.money < money, 'Geld sofort abgezogen');
  run(g, 20); // 20 s in Schritten von 0,05 s
  assert.equal(count(), before + 1);
});

test('Wert kurz verstellen: withValue stellt ihn danach zurück', () => {
  withValue(BALANCE, 'winPoints', 1, () => assert.equal(mkGame().winPoints, 1));
});
```

## Helfer (`util.js`)
- `mkGame(opts)`: `new Game({ seed: 1, ...opts })`, mit Stadt; z. B. `{ seed: 7, startMoney: 5000 }`.
- `run(game, seconds, dt = 0.05, ais = [])`: Schleife über `game.update(dt)`, jede KI (`new AI(g, 1, 'normal')`) vorher.
- `hq(game, team = 0)`: Hauptstadt. `withValue(obj, key, value, fn)`: Wert nur für `fn` ändern.
- Mit Stadt bilden Kaserne und Fabrikhalle aus (`cityTrainers`, `js/game/city/query.js`); Stadtbefehl `{ type: 'city', … }`.

## Regeln
- Spiel nur über `game.issue(team, cmd)` steuern; Werte aus `js/data/` nur mit `withValue` ändern.
- Zufall nur über den Seed. `new Game()` ohne Angaben: alle Menü-Schalter aus.
- Test über etwa 5 s: „[langsam]“ in den Namen (`npm run test:fast` lässt ihn aus).
- Einzeln: `node --test --test-reporter=dot test/<datei>.test.js`; vor dem Push `npm test`.
- Jede Datei ist ein eigener Prozess; kein Test baut auf Zustand eines früheren.

## Wohin mit einem neuen Test
- Meist nach Modul (`radio.test.js` …, `ls test/`). Stadt, Spielkern, Fliegerhorst sind nach Thema geteilt:
- Stadt: Lager, Bauen, Zonen, Raster, Räumen, Strom, Steuer → `city-bau.test.js`
- Großbauten, Straßenanschluss, Universität, Startviertel → `city-grossbau.test.js`
- Markt, Stahl, Flucht, Beschuss der Stadt → `city-markt.test.js`
- Ausbildung mit Stadt, Heilen, Krankenhaus → `city-ausbildung.test.js`
- Stadt-KI → `city-ki.test.js`; Hilfen → `cityhelp.js`
- Startzustand, Ressourcen, Ausbildung, Erstattung → `game-start.test.js`
- Platzierung, FOB, Baustellen, Mauer, Reparatur → `game-bau.test.js`
- Kampf, Zone, Sieg, Eliminierung, Determinismus, Befehle → `game-regeln.test.js`
- Mörser, Flugabwehr, Hubschrauber → `game-moerser.test.js`
- Munition, Treibstoff, Waffen, Tanken, Bohrer → `game-verbrauch.test.js`; Hilfen → `gamehelp.js`
- Fliegerhorst: Bahn, Tower → `airbase-bahn.test.js`; Stellplatz, Einsatz → `airbase-einsatz.test.js`
- Zwei Jets je Stellplatz, F-22, Su-27 → `airbase-jets.test.js`; Hilfen → `airbasehelp.js`
