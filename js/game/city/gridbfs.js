// Gemeinsame Breitensuche auf dem Stadtraster (Paket „Rastersuche“): eine Umsetzung für Straßennetz, Anschlüsse, Gleise, Rollfeld,
// Straßentransport und Stadt-KI. Blattmodul ohne Importe (kein Importzyklus, test/imports.test.js). Kein DOM, deterministisch.
//
// Reihenfolge der Nachbarn wie nbrsOf (cells.js): links, rechts, oben, unten. Startzellen in der übergebenen Reihenfolge, doppelte
// zählen einmal (die erste). Startzellen prüft `passable` nicht (das tut der Aufrufer, wenn er es braucht).

/**
 * Breitensuche über die 4er-Nachbarschaft des Stadtrasters `c` (cols, rows).
 * - `starts`: Zellindizes (Array oder Iterable), Abstand `base` (Vorgabe 0).
 * - `passable(j)`: darf die Suche Zelle j betreten? null = jede Zelle.
 * - `maxDist`: Zellen mit Abstand ≥ maxDist werden nicht mehr erweitert (sie selbst sind erreicht).
 * - `opts.goal(i)`: optional; die Suche endet bei der ersten Zelle (in Besuchsreihenfolge, beim Herausnehmen geprüft), für die goal
 *   wahr ist, auch wenn sie maxDist erreicht hat. Sie steht dann in `end` (sonst −1).
 * - `opts.base`: Abstand der Startzellen (Vorgabe 0).
 * - `opts.out`: Ergebnis einer früheren Suche auf demselben Raster, dessen Puffer wiederverwendet werden.
 * Liefert { dist, prev, queue, count, end }: dist −1 = nicht erreicht, prev −1 bei Startzellen und nicht erreichten Zellen,
 * queue[0 … count−1] = erreichte Zellen in Besuchsreihenfolge (jede Zelle nach ihrem Vorgänger).
 */
export function gridBfs(c, starts, passable = null, maxDist = Infinity, opts = null) {
  const cols = c.cols;
  const rows = c.rows;
  const n = cols * rows;
  const base = opts?.base ?? 0;
  const goal = opts?.goal ?? null;
  let r = opts?.out ?? null;
  if (!r || r.dist.length !== n) r = { dist: new Int32Array(n), prev: new Int32Array(n), queue: new Int32Array(n), count: 0, end: -1 };
  const { dist, prev, queue } = r;
  dist.fill(-1);
  prev.fill(-1);
  let tail = 0;
  for (const i of starts) {
    if (dist[i] >= 0) continue;
    dist[i] = base;
    queue[tail++] = i;
  }
  let end = -1;
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    if (goal !== null && goal(i)) {
      end = i;
      break;
    }
    const d = dist[i];
    if (d >= maxDist) continue;
    const col = i % cols;
    const row = (i - col) / cols;
    const nd = d + 1;
    let j;
    if (col > 0) {
      j = i - 1;
      if (dist[j] < 0 && (passable === null || passable(j))) {
        dist[j] = nd;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
    if (col < cols - 1) {
      j = i + 1;
      if (dist[j] < 0 && (passable === null || passable(j))) {
        dist[j] = nd;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
    if (row > 0) {
      j = i - cols;
      if (dist[j] < 0 && (passable === null || passable(j))) {
        dist[j] = nd;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
    if (row < rows - 1) {
      j = i + cols;
      if (dist[j] < 0 && (passable === null || passable(j))) {
        dist[j] = nd;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
  }
  r.count = tail;
  r.end = end;
  return r;
}

/** Weg von Zelle `i` über prev zurück bis zur Startzelle (erste = i, letzte = Startzelle). */
export function bfsPath(r, i) {
  const path = [];
  for (let k = i; k >= 0; k = r.prev[k]) path.push(k);
  return path;
}
