// Beziehungen zwischen den Teams an einer Stelle (Review „Eroberung“): wer ist wessen Gegner, wer spielt noch. Kein DOM.
// Heute ist jeder jedes anderen Gegner; Allianzen würden nur `hostile` ändern. (entities.isFoe prüft dasselbe für Entities.)

/** Sind die Teams a und b Gegner? (-1 = neutral: niemandes Gegner) */
export const hostile = (a, b) => a >= 0 && b >= 0 && a !== b;

/** Teams, die noch spielen (in der Eroberung: nicht ausgeschieden). */
export const aliveTeams = (game) => game.teams.filter((t) => !t.out);

/** Noch spielende Gegner von `team`. */
export const enemiesOf = (game, team) => game.teams.filter((t) => !t.out && hostile(team, t.id));

/** Das Element der Liste, das (x, y) am nächsten liegt (bei Gleichstand das mit der kleineren id), oder null. */
export function nearestOf(list, x, y) {
  let best = null;
  let bd = Infinity;
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd || (d === bd && best && e.id < best.id)) {
      best = e;
      bd = d;
    }
  }
  return best;
}
