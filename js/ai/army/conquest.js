// Armee-KI im Modus Eroberung (PRD §7 „Eroberung“): Flaggen einnehmen und halten, jeder gegen jeden. Mixin für AI (ai.js). Kein DOM.
import { UNITS } from '../../data/units.js';
import { WAVE_MIN, WAVE_PATIENCE, RESERVE, RESERVE_FROM, CQ_HOLD, CQ_EVERY, CQ_LEADER, CQ_NEUTRAL, CQ_GUARD, CQ_SPAWN_EVERY } from '../../data/ai.js';
import { flagAt, inSquare, spawnFlags } from '../../game/conquest.js';
import { dist } from './util.js';

export const conquestMethods = {
  /** Führender Gegner: das andere, nicht ausgeschiedene Team mit den meisten Flaggen (bei Gleichstand den meisten Tickets). */
  leaderFoe() {
    const g = this.game;
    const held = g.conquest.held;
    return g.teams.filter((t) => t.id !== this.team && !t.out).sort((a, b) => held[b.id] - held[a.id] || b.tickets - a.tickets || a.id - b.id)[0]?.id ?? -1;
  },

  /**
   * Nächstes Flaggenziel von (x, y) aus: fremde oder neutrale Flaggen, bewertet nach Entfernung; Flaggen des Führenden und neutrale
   * wirken näher, stark besetzte ferner (Besatzung je Gebiet ist öffentlich wie die Zonenwertung). `skip`: schon vergebene Ziele.
   */
  flagTarget(x, y, skip = null) {
    const g = this.game;
    const t = this.team;
    const lead = this.leaderFoe();
    let best = null;
    let bestScore = Infinity;
    for (const f of g.conquest.flags) {
      if (f.owner === t && !f.contested && f.p >= 1) continue;
      const foes = f.counts.reduce((n, c, i) => (i === t ? n : n + c), 0);
      let score = dist(x, y, f.x, f.y) + foes * CQ_GUARD;
      if (f.owner === lead) score -= CQ_LEADER;
      if (f.owner < 0) score -= CQ_NEUTRAL;
      if (skip?.has(f.id)) score += 2 * g.conquest.size; // andere Gruppe ist schon unterwegs: lieber verteilen
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  },

  /** Erscheinungsort neuer Einheiten: die eigene, unbestrittene Flagge, die dem nächsten Ziel am nächsten liegt (sonst am Gebäude). */
  flagSpawn(s) {
    const g = this.game;
    if (!this.cfg.scout || !this.once('cq-spawn', CQ_SPAWN_EVERY)) return; // nicht auf Leicht
    const own = spawnFlags(g, this.team);
    const goal = this.flagTarget(s.ax, s.ay);
    const pick = own.length && goal ? own.slice().sort((a, b) => dist(a.x, a.y, goal.x, goal.y) - dist(b.x, b.y, goal.x, goal.y) || a.id - b.id)[0] : null;
    for (const b of s.producers) {
      if (!b.produces?.some((u) => !UNITS[u].air)) continue;
      const want = pick ? pick.id : null;
      if ((b.spawnFlag ?? null) !== want) g.issue(this.team, { type: 'spawnAt', buildingId: b.id, flag: want });
    }
  },

  /**
   * Armee in der Eroberung: Wer außerhalb der Zone untätig steht, sammelt sich zur Welle (Stärke wie sonst, mit Geduld) und zieht im
   * Keil zur besten Flagge. In der Zone: Gruppen je Gebiet. Auf fremder Flagge bleiben sie (einnehmen, sichtbare Gegner angreifen);
   * ist die Flagge eingenommen, bleiben CQ_HOLD als Wache und der Rest zieht zur nächsten.
   */
  conquestArmy(s) {
    const g = this.game;
    const t = this.team;
    this.flagSpawn(s);
    if (g.time < this.fallbackUntil) return;
    const idle = s.combat.filter((u) => u.order.type === 'idle' && !this.dryKind(u) && !u.house);
    if (!idle.length) return;
    const taken = new Set();

    // Welle von außerhalb
    const outside = idle.filter((u) => !inSquare(g, u.x, u.y));
    if (outside.length) {
      const strength = outside.reduce((sum, u) => sum + (UNITS[u.type].cost.money || 0), 0);
      const need = this.cfg.attackStrength * Math.max(WAVE_MIN, 1 - (g.time - this.lastWave) / WAVE_PATIENCE);
      const goal = this.flagTarget(s.ax, s.ay);
      if (goal && strength >= need) {
        let go = outside;
        if (s.home && go.length >= RESERVE_FROM) {
          go = go.slice().sort((a, b) => dist(a.x, a.y, s.ax, s.ay) - dist(b.x, b.y, s.ax, s.ay));
          go = go.slice(Math.ceil(go.length * RESERVE));
        }
        g.issue(t, { type: 'attackMove', ids: go.map((u) => u.id), x: goal.x, y: goal.y, formation: 'wedge' });
        this.lastWave = g.time;
        taken.add(goal.id);
      }
    }

    // In der Zone: je Gebiet eine Gruppe
    const groups = new Map();
    for (const u of idle) {
      const f = flagAt(g, u.x, u.y);
      if (!f) continue;
      if (!groups.has(f.id)) groups.set(f.id, []);
      groups.get(f.id).push(u);
    }
    for (const [id, list] of [...groups].sort((a, b) => a[0] - b[0])) {
      const f = g.conquest.flags[id];
      const foes = s.enemies.filter((e) => flagAt(g, e.x, e.y) === f);
      if (foes.length) {
        // sichtbare Gegner im Gebiet: wer keinen Kontakt hat, rückt auf sie zu
        const lone = list.filter((u) => !foes.some((e) => dist(e.x, e.y, u.x, u.y) < 300)).map((u) => u.id);
        if (lone.length && this.once(`cq-f${id}`, CQ_EVERY)) {
          const x = foes.reduce((a, e) => a + e.x, 0) / foes.length;
          const y = foes.reduce((a, e) => a + e.y, 0) / foes.length;
          g.issue(t, { type: 'attackMove', ids: lone, x, y });
        }
        continue;
      }
      if (f.owner !== t || f.p < 1) {
        // einnehmen: wer weit vom Mast steht, rückt heran (sonst reicht die Anwesenheit im Gebiet)
        const far = list.filter((u) => dist(u.x, u.y, f.x, f.y) > g.conquest.size * 0.35).map((u) => u.id);
        if (far.length && this.once(`cq-c${id}`, CQ_EVERY)) g.issue(t, { type: 'attackMove', ids: far, x: f.x, y: f.y });
        continue;
      }
      // eingenommen: Wache bleibt, der Rest zieht weiter
      const rest = list.slice().sort((a, b) => a.id - b.id).slice(CQ_HOLD);
      if (!rest.length || !this.once(`cq-n${id}`, CQ_EVERY)) continue;
      const goal = this.flagTarget(f.x, f.y, taken);
      if (!goal) continue;
      taken.add(goal.id);
      g.issue(t, { type: 'attackMove', ids: rest.map((u) => u.id), x: goal.x, y: goal.y, formation: 'wedge' });
    }
  },
};
