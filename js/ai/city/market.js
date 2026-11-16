// Markt der Stadt-KI: Überschuss verkaufen, Metall und Baumaterial zukaufen, wenn sie knapp sind.
// Exporte: aiMarket. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { marketBuyPrice } from '../../game/city/query.js';
import { cityAiMemory } from './common.js';

/** Markt der KI: Überschuss verkaufen, Metall zukaufen, wenn es knapp ist. */
export function aiMarket(game, team, reserve, mem = cityAiMemory()) {
  const c = game.city[team];
  const main = game.mainFob(team);
  if (!main) return;
  for (const g of ['bm', 'mun', 'fuel']) if (main.store[g] > CITY.ai.sellAbove) game.issue(team, { type: 'trade', good: g, dir: 'sell' });
  if (c.metal > CITY.ai.sellAbove) game.issue(team, { type: 'trade', good: 'metal', dir: 'sell' });
  // Stahl nur, wenn eine Ausbildung zuletzt daran scheiterte (Bedarf offen, steelWait s), Geld für Fahrzeug und Los reicht (sonst kaufte sie
  // den Stahl, und das Fahrzeug blieb unbezahlbar) und der Lospreis nicht über metalMaxPrice liegt
  const w = mem.steelWant;
  const price = marketBuyPrice(game, team, 'metal');
  if (w && game.time - w.time <= CITY.ai.steelWait && c.metal < w.amount && game.teams[team].res.money >= w.cost + price
    && price <= CITY.market.buy.metal * (w.max ?? CITY.ai.metalMaxPrice)) {
    game.issue(team, { type: 'trade', good: 'metal', dir: 'buy' });
  }
  // Baumaterial fehlt (seit v5.20, AP4): Straßen und Anschlüsse kosten es, ohne BM bleiben Werke unangebunden
  if (main.store.bm < CITY.ai.buyBmBelow && game.teams[team].res.money > marketBuyPrice(game, team, 'bm')) {
    game.issue(team, { type: 'trade', good: 'bm', dir: 'buy' });
  }
}
