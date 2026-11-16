// Offenes Netz (Paket „Offenes Netz“, PRD §10 „Stadt mit Anschlusspflicht“): die Stadt-KI lässt auch ohne Baugebiet Ausgänge an ihrem
// Straßennetz offen (keepsOutlets in js/ai/cityai.js). Sonst ist das Netz am Lager nach 8 bis 15 Spielminuten rundum bebaut: kein Platz
// mehr für einen Industriepark, neue Werke ohne Weg zum Lager. Die KI ändert das Spiel nur über game.issue; der Test lässt sie nur laufen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { AI } from '../js/ai/ai.js';
import { buildAllowed, cellFree, nbrsOf, roadLinked } from '../js/game/city/cells.js';

/** Freie Anschlusszellen am Netz des Lagers: bebaubare Straßenzellen am Netz, mit freiem Nachbarn außerhalb (Ausgänge). */
function outlets(g, c) {
  const mask = roadLinked(g, c);
  const free = (j) => !c.kind[j] && buildAllowed(g, c, j, 'road') && cellFree(g, c, j % c.cols, Math.floor(j / c.cols));
  let n = 0;
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j] || !free(j)) continue;
    if (nbrsOf(c, j).some((x) => !mask[x] && free(x))) n++;
  }
  return n;
}

test('Offenes Netz [langsam]: Seed 11 ohne Baugebiet, nach 20 min hat das Netz von Team 0 noch Ausgänge', () => {
  const g = new Game({ seed: 11, river: true, research: true });
  const ais = [0, 1].map((t) => new AI(g, t, 'normal'));
  const dt = 0.05;
  // Vorher (ohne die Regel) war das Netz hier nach rund 20 min rundum bebaut (keine freie Anschlusszelle mehr)
  for (let k = 0; k < Math.round((20 * 60) / dt); k++) {
    g.update(dt);
    for (const a of ais) a.update(dt);
  }
  assert.equal(g.buildRules, false, 'Baugebiet aus: die Regel gilt ohne Schalter');
  assert.ok(outlets(g, g.city[0]) > 0, 'Netz des Lagers hat noch Ausgänge');
});
