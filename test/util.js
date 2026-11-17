// Testhilfen ohne eigene Tests (node --test lädt die Datei mit, findet aber nichts).
import { Game } from '../js/game/game.js';

/**
 * Setzt `obj[key] = value` für die Dauer von `fn()` und stellt danach den alten Wert wieder her, auch wenn `fn` wirft
 * (fehlgeschlagene Zusicherung). Liefert das Ergebnis von `fn`. Für Werte aus js/data/, die ein Test kurz verstellt.
 */
export function withValue(obj, key, value, fn) {
  const old = obj[key];
  obj[key] = value;
  try {
    return fn();
  } finally {
    obj[key] = old;
  }
}

// Aufbau für neue Tests (bestehende Tests bleiben, wie sie sind). Zählung im Paket „Schlanke Tests“:
// 365 `new Game(`, davon 305 mit `seed`, die häufigsten Formen `{ seed: N, city: true }` (113) und `{ seed: N }` (63);
// 173 × `update(DT)` mit `DT = 0.05` (37 Dateien), 39 lokale `run(g, s)`-Schleifen, teils mit KI davor.

/** Neues Spiel mit Seed 1 und den Standards von `new Game` (mit Stadt, alle Menü-Schalter aus); `opts` überschreibt. */
export function mkGame(opts = {}) {
  return new Game({ seed: 1, ...opts });
}

/** Lässt das Spiel `seconds` Sekunden in Schritten von `dt` laufen; jede KI in `ais` rechnet vor jedem Schritt. */
export function run(game, seconds, dt = 0.05, ais = []) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    for (const ai of ais) ai.update(dt);
    game.update(dt);
  }
  return game;
}

/** Hauptstadt (Gebäude mit `main`) des Teams. */
export function hq(game, team = 0) {
  return game.buildings.find((b) => b.main && b.team === team);
}

/**
 * Gemeinsamer Lauf: rechnet `fn` erst beim ersten Aufruf und gibt danach dasselbe Ergebnis zurück. Für mehrere Tests einer Datei, die
 * dieselbe Partie nur lesen (docs/testen.md „Gemeinsamer Lauf je Datei“). Kein before(): der liefe auch in test:fast.
 */
export function once(fn) {
  let r;
  return () => (r ??= fn());
}
