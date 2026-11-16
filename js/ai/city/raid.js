// Überfälle und Verteidigung der Stadt-KI: Angriff auf die gegnerische Stadt (aiRaid) und Schutz der eigenen (aiDefend).
// Exporte: aiRaid, aiDefend. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KINDS } from '../../data/citykinds.js';
import { enemiesOf, nearestOf } from '../../game/teams.js';
import { block, ready } from '../cooldown.js';
import { cityAiMemory } from './common.js';

/**
 * Angriff auf die gegnerische Stadt (von ai.js jede Sekunde): alle raidEvery s schicken bis zu raidSize untätige Fahrzeuge
 * mit Angriffsmarsch zum nächsten erkundeten gegnerischen Stadtgebäude.
 */
export function aiRaid(game, team, difficulty, dt, mem = cityAiMemory()) {
  const c = game.city?.[team];
  const every = CITY.ai.raidEvery[difficulty] ?? 0;
  if (!c || !every) return;
  mem.raidTimer += dt;
  if (mem.raidTimer < every) return;
  mem.raidTimer = 0;
  // Ziel: die gegnerische Stadt; in der Eroberung nur eine, deren Viertel-Sperre gefallen ist (sonst kommt niemand hinein)
  const main = game.mainFob(team);
  if (!main) return;
  // Eroberung: unter den Städten mit offenem Viertel die, deren Hauptstadt am nächsten liegt
  const open = game.conquest ? enemiesOf(game, team).filter((o) => game.conquest.open[o.id] && game.mainFob(o.id)) : [];
  const near = nearestOf(open.map((o) => game.mainFob(o.id)), main.x, main.y);
  const foe = game.conquest ? (near ? game.city[near.team] : null) : game.city[1 - team];
  if (!foe || !main) return;
  // Ziel nach Wert: Werke, Güterbahnhof und Markt zuerst, geteilt durch die Entfernung (freie Planung seit v4.85)
  let target = null;
  let best = -Infinity;
  for (const e of foe.ents.values()) {
    if (!e.alive || !game.isExplored(team, e.x, e.y)) continue;
    const k = KINDS[foe.kind[e.cityCell] - 1];
    const v = (CITY.ai.targetValue[k] ?? 1) / (1 + Math.hypot(e.x - main.x, e.y - main.y) / CITY.ai.raidDist);
    if (v > best) {
      best = v;
      target = e;
    }
  }
  if (!target) return;
  const ids = game.units
    .filter((u) => u.alive && u.team === team && !u.def.air && u.def.armor !== 'inf' && u.weapons.length && u.order.type === 'idle' && u.def.damage?.struct > 0)
    .slice(0, CITY.ai.raidSize)
    .map((u) => u.id);
  if (ids.length) game.issue(team, { type: 'attackMove', ids, x: target.x, y: target.y });
}

/**
 * Verteidigung (von ai.js jede Denkrunde): Wird ein eigenes Stadtgebäude beschossen, schickt die KI bis zu defendSize
 * bewaffnete Bodeneinheiten aus der Nähe mit Angriffsmarsch dorthin; Werke und Güterbahnhof zuerst.
 */
export function aiDefend(game, team, mem = cityAiMemory()) {
  const c = game.city?.[team];
  if (!c) return;
  const A = CITY.ai;
  if (!ready(mem.wait, 'defend', game.time)) return;
  let spot = null;
  let best = -1;
  for (const e of c.ents.values()) {
    if (!e.alive || e.lastHitTime < game.time - A.hitRecent) continue;
    const v = A.targetValue[KINDS[c.kind[e.cityCell] - 1]] ?? 1;
    if (v > best) {
      best = v;
      spot = e;
    }
  }
  if (!spot) return;
  const near = game.units
    .filter((u) => u.alive && u.team === team && !u.def.air && u.weapons.length && !u.house && !u.crate && u.order.type !== 'attack' && Math.hypot(u.x - spot.x, u.y - spot.y) < A.defendRange)
    .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y) || a.id - b.id)
    .slice(0, A.defendSize);
  if (!near.length) return;
  block(mem.wait, 'defend', A.defendCooldown, game.time);
  game.issue(team, { type: 'attackMove', ids: near.map((u) => u.id), x: spot.x, y: spot.y });
}
