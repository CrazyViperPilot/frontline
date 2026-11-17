// Gemeinsame Helfer der Stadt-KI (PRD §15): Buchhaltung (cityAiMemory), Gefahrenzonen, Zellenbefehl, Kandidaten des Ausbaus.
// Exporte: cityAiMemory, nearCells, aiRoad, inDanger, aiCandidates, cellCmd, touchesRoad, roadFree. Importiert keine Schwester-Module
// (Blatt, damit es keinen Importzyklus gibt). Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { cellAt, idx, cellFree, roadAt, buildAllowed, nbrsOf } from '../../game/city/cells.js';
import { gridBfs } from '../../game/city/gridbfs.js';

/** Zellen höchstens `d` Schritte (4er-Nachbarschaft, alle Zellen) von einer Zelle aus `reach`, Uint8Array 1 = nah (seit v5.20, AP4). */
export function nearCells(c, reach, d) {
  const n = c.cols * c.rows;
  const near = new Uint8Array(n);
  const starts = [];
  for (let i = 0; i < n; i++) if (reach[i]) starts.push(i);
  const r = gridBfs(c, starts, null, d, { scratch: true });
  for (let k = 0; k < r.count; k++) near[r.queue[k]] = 1;
  return near;
}

/** Ist die Zelle im Muster um den Anker (ac, ar) eine Straße? Jede roadEvery-te Zeile und die Spalte durch den Anker. */
export function aiRoad(col, row, ac, ar) {
  const n = CITY.ai.roadEvery;
  return (((row - ar) % n) + n) % n === 0 || col === ac;
}
/** Liegt die Zelle nahe einem frischen Treffer auf die eigene Stadt? */
export function inDanger(c, col, row, now) {
  const R = CITY.ai.dangerRadius;
  for (const h of c.hitLog ?? []) {
    if (h.t < now - CITY.ai.dangerTime) continue;
    if (Math.abs(Math.floor(h.x / c.cell) - col) <= R && Math.abs(Math.floor(h.y / c.cell) - row) <= R) return true;
  }
  return false;
}

/** Freie Zellen um den Anker (Weltpunkt), nach Abstand sortiert (Ringe), bis zum Radius in Zellen. */
export function aiCandidates(game, c, x, y, rad, reach) {
  const [ac, ar] = cellAt(c, x, y);
  const out = [];
  for (let row = Math.max(0, ar - rad); row <= Math.min(c.rows - 1, ar + rad); row++) {
    for (let col = Math.max(0, ac - rad); col <= Math.min(c.cols - 1, ac + rad); col++) {
      const i = idx(c, col, row);
      if (c.kind[i] || !buildAllowed(game, c, i) || inDanger(c, col, row, game.time) || !cellFree(game, c, col, row)) continue; // Fels, Wasser oder Gebäude: dort wüchse nie etwas
      // seit v5.20 (AP4): Zellen neben einer Straße zum Lager zählen einen Ring näher (Werke und Großbauten zuerst dort)
      const far = reach && !touchesRoad(c, i, reach) ? CITY.ai.connectRing * CITY.ai.ringWeight : 0;
      const d = Math.max(Math.abs(col - ac), Math.abs(row - ar)) * CITY.ai.ringWeight + Math.abs(col - ac) + Math.abs(row - ar) + far;
      out.push({ i, col, row, d, road: aiRoad(col, row, ac, ar) });
    }
  }
  out.sort((a, b) => a.d - b.d || a.i - b.i);
  return out;
}

/**
 * Buchhaltung der Stadt-KI (liegt in der KI-Instanz, ai.js `cityMem`). Ein Feld je Zeile, Erläuterung am Feld. Sperrzeiten sind Tabellen
 * Schlüssel → Spielzeit (s) und laufen über cooldown.js (block, ready, prune). Ältere Stände ergänzt ai.js restoreMemory.
 */
export function cityAiMemory() {
  return {
    turn: 0, // Ausbautakte von aiCity (zählt hoch; wählt das Viertel, das als Nächstes ausgebaut wird)
    raidTimer: 0, // s seit dem letzten Überfall auf die gegnerische Stadt (aiRaid)
    importBad: 0, // s, in denen die Einfuhr knapp ist (importWatch; ohne Mangel zurück auf 0)
    importAt: null, // Spielzeit des letzten Einfuhr-Wächters (null = noch nie)
    steelWant: null, // offener Stahlbedarf { amount, cost, time, max? } einer gescheiterten Ausbildung (produce.js; aiMarket kauft dann)
    laneHot: {}, // überlastete Straßenzelle → Takte in Folge über der Last (aiLanes)
    parkKeep: {}, // Zelle → 1: Werksplätze am Güterbahnhof, nur Werke dürfen dorthin (Industriepark)
    wait: {}, // einzelne Sperren: 'station' = Suche nach Güterbahnhof, 'defend' = Verteidigungsbefehl; Wert: Spielzeit bis
    parkWait: {}, // Werksplatz-Anker → Spielzeit, bis zu der er nach einer Ablehnung nicht erneut versucht wird
    linkWait: {}, // Startzelle des Straßenanschlusses ohne Weg → Spielzeit bis
    laneWait: {}, // überlastete Straßenzelle ohne Platz für eine zweite Spur → Spielzeit bis
  };
}

/** Befehl „Zelle j als Art kind bauen“ (ein Feld des Rasters). */
export function cellCmd(c, kind, j) {
  const q = j % c.cols;
  const r = (j - q) / c.cols;
  return { type: 'city', kind, c0: q, r0: r, c1: q, r1: r };
}

/** Für eine Straße frei: leer, ausweisbar (Baugebiet für Straßen), ohne Hindernis. */
export function roadFree(game, c, j) {
  return !c.kind[j] && buildAllowed(game, c, j, 'road') && cellFree(game, c, j % c.cols, Math.floor(j / c.cols));
}

/** Liegt eine verbundene Straße (mit dem Lager) neben Zelle i? */
export function touchesRoad(c, i, reach) {
  return nbrsOf(c, i).some((j) => reach[j] && roadAt(c, j));
}
