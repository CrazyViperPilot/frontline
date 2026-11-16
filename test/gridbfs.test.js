// Gemeinsame Breitensuche auf dem Stadtraster (Paket „Rastersuche“, js/game/city/gridbfs.js): Reihenfolge, Hindernisse, Abstandsgrenze,
// Weg zurück, Ziel, Startabstand, doppelte Starts und wiederverwendeter Puffer. Kleines Raster 5 × 4, Zelle i = Zeile · 5 + Spalte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridBfs, bfsPath } from '../js/game/city/gridbfs.js';

const C = { cols: 5, rows: 4 };

/** Liegen a und b in der 4er-Nachbarschaft des Rasters C? */
function adjacent(a, b) {
  const ca = a % C.cols;
  const cb = b % C.cols;
  const ra = (a - ca) / C.cols;
  const rb = (b - cb) / C.cols;
  return Math.abs(ca - cb) + Math.abs(ra - rb) === 1;
}

test('Breitensuche: Start hat Abstand 0, Nachbarn Abstand 1 in Reihenfolge links, rechts, oben, unten', () => {
  const r = gridBfs(C, [7]);
  assert.equal(r.dist[7], 0);
  assert.equal(r.prev[7], -1);
  // Zelle 7 = Zeile 1, Spalte 2: links 6, rechts 8, oben 2, unten 12
  assert.deepEqual(Array.from(r.queue.slice(0, 5)), [7, 6, 8, 2, 12]);
  for (const j of [6, 8, 2, 12]) assert.equal(r.dist[j], 1);
  assert.equal(r.count, 20);
});

test('Breitensuche: Hindernis mit Lücke, Abstände um die Wand, abgeschlossene Zelle bleibt unerreichbar', () => {
  // Wand: Spalte 2 oben (Zellen 2, 7, 12); Zellen 3 und 9 schließen Zelle 4 (Ecke oben rechts) ab
  const blocked = new Set([2, 7, 12, 3, 9]);
  const r = gridBfs(C, [0], (j) => !blocked.has(j));
  assert.equal(r.dist[2], -1);
  assert.equal(r.dist[12], -1);
  assert.equal(r.dist[4], -1, 'abgeschlossene Zelle bleibt −1');
  // Weg durch die Lücke in Zeile 3 (Zelle 17): 0 → 1 → 6 → 11 → 16 → 17
  assert.equal(r.dist[17], 5);
  assert.equal(r.dist[18], 6);
  assert.equal(r.dist[13], 7);
  assert.equal(r.dist[19], 7);
  assert.equal(r.count, 20 - blocked.size - 1, 'alle erreichbaren Zellen, ohne Wand und abgeschlossene Zelle');
});

test('Breitensuche: maxDist erreicht Zellen mit Abstand maxDist, nicht maxDist + 1', () => {
  const r = gridBfs(C, [0], null, 2);
  assert.equal(r.dist[2], 2, 'Abstand 2 wird erreicht');
  assert.equal(r.dist[10], 2, 'Abstand 2 wird erreicht (Zeile 2)');
  assert.equal(r.dist[3], -1, 'Abstand maxDist + 1 wird nicht erreicht');
  assert.equal(r.dist[11], -1, 'Abstand maxDist + 1 wird nicht erreicht (Zeile 2)');
  assert.equal(r.count, 6, 'Start plus Abstand 1 und 2: 1 + 2 + 3');
});

test('Breitensuche: bfsPath führt Schritt für Schritt zum Start, Länge dist + 1', () => {
  const r = gridBfs(C, [0]);
  const path = bfsPath(r, 19);
  assert.equal(path[0], 19, 'erste Zelle ist das Ziel');
  assert.equal(path[path.length - 1], 0, 'letzte Zelle ist der Start');
  assert.equal(path.length, r.dist[19] + 1);
  for (let k = 0; k + 1 < path.length; k++) {
    assert.ok(adjacent(path[k], path[k + 1]), `Schritt ${k} ist ein Nachbar`);
    assert.equal(r.dist[path[k + 1]], r.dist[path[k]] - 1, `Abstand fällt um 1 je Schritt`);
  }
});

test('Breitensuche: goal liefert die erste passende Zelle in Besuchsreihenfolge und bricht ab', () => {
  // Spalte 2: Zelle 2 (Abstand 2) wird vor 6 und 10 besucht
  const full = gridBfs(C, [0]);
  const r = gridBfs(C, [0], null, Infinity, { goal: (i) => i % C.cols === 2 });
  assert.equal(r.end, 2);
  assert.equal(r.dist[2], 2);
  assert.ok(r.count < full.count, 'die Suche endet früher als ohne Ziel');
  assert.equal(gridBfs(C, [0], null, Infinity, { goal: () => false }).end, -1, 'ohne Treffer bleibt end −1');
});

test('Breitensuche: opts.base legt den Startabstand fest', () => {
  const r = gridBfs(C, [0], null, Infinity, { base: 1 });
  assert.equal(r.dist[0], 1);
  assert.equal(r.dist[1], 2);
  assert.equal(r.prev[0], -1);
  assert.equal(r.prev[1], 0);
});

test('Breitensuche: doppelte Starts zählen einmal (der erste), Starts werden nicht mit passable geprüft', () => {
  const r = gridBfs(C, [7, 7, 7]);
  assert.equal(r.count, 20);
  assert.equal(new Set(Array.from(r.queue.slice(0, r.count))).size, r.count, 'keine Zelle doppelt in der Warteschlange');
  assert.equal(r.dist[7], 0);
  // Start 0 wird nicht mit passable geprüft (passable verbietet alles), ist aber erreicht; die Nachbarn bleiben unerreicht
  const s = gridBfs(C, [0, 0], () => false);
  assert.equal(s.dist[0], 0);
  assert.equal(s.count, 1);
  assert.equal(s.dist[1], -1);
});

test('Breitensuche: opts.out wird wiederverwendet und vor jeder Suche zurückgesetzt', () => {
  const r1 = gridBfs(C, [0]);
  const r2 = gridBfs(C, [19], null, 2, { out: r1 });
  assert.equal(r2, r1, 'dasselbe Objekt');
  assert.equal(r2.dist[19], 0);
  assert.equal(r2.dist[0], -1, 'Ergebnis der ersten Suche ist zurückgesetzt');
  assert.equal(r2.prev[0], -1);
  assert.equal(r2.dist[14], 1);
  assert.equal(r2.dist[9], 2);
  assert.equal(r2.dist[4], -1, 'Abstand 3 liegt außerhalb von maxDist 2');
  assert.equal(r2.count, 6);
});

test('Breitensuche: opts.scratch nutzt gemeinsame Puffer, ein verschachtelter Aufruf aus passable bekommt eigene', () => {
  const a = gridBfs(C, [0], null, Infinity, { scratch: true });
  const b = gridBfs(C, [19], null, Infinity, { scratch: true });
  assert.equal(a, b, 'gleiche Puffer bei aufeinanderfolgenden Suchen');
  assert.equal(b.dist[19], 0);
  assert.equal(b.dist[0], 7);
  // Innerer Aufruf während der Suche darf die äußere nicht stören
  let inner = null;
  const outer = gridBfs(C, [0], (j) => {
    inner = gridBfs(C, [j], null, 0, { scratch: true });
    return true;
  }, Infinity, { scratch: true });
  assert.notEqual(inner, outer);
  const plain = gridBfs(C, [0]);
  assert.deepEqual([...outer.dist], [...plain.dist]);
  assert.deepEqual([...outer.prev], [...plain.prev]);
  assert.equal(outer.count, 20);
});
