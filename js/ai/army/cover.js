// Deckung der Armee-KI (Paket „Deckung“, PRD §10): untätige Infanterie in der Zone (Eroberung: im Flaggenquadrat) baut Sandsack-
// Stellungen Richtung Feind (Befehl fieldwork, js/game/fieldwork.js) und besetzt freie eigene Stellungen in der Nähe (Befehl move).
// Werte FIELD_* und COVER_* in js/data/ai.js. Methoden für AI.prototype (wie die anderen Module in army/).
import { PROPS } from '../../data/props.js';
import { FIELD_EVERY, FIELD_MAX, FIELD_R, FIELD_AHEAD, FIELD_TRIES, FIELD_FAN, FIELD_FOE_R, COVER_EVERY, COVER_R, COVER_SEATS, COVER_SEAT_R, COVER_SEAT_OFF } from '../../data/ai.js';
import { canFieldwork, fieldSpotWhy, teamProps } from '../../game/fieldwork.js';
import { rotAcross, rotAngle } from '../../game/props.js';
import { inSquare } from '../../game/conquest.js';
import { inZone } from '../../game/zonegeo.js';
import { dist, unitVec } from './util.js';

const NEST = 'sandbag_nest';

export const coverMethods = {
  /** Liegt (x, y) im umkämpften Gebiet (klassisch: Konfliktzone, Eroberung: Flaggenquadrat)? */
  inFight(s, x, y) {
    return this.game.conquest ? inSquare(this.game, x, y) : inZone(s.zone, x, y);
  },

  /** Einheitsvektor Richtung Feind von (x, y): nächster gesehener Gegner bis FIELD_FOE_R, sonst weg von der eigenen Hauptstadt. */
  foeDir(s, x, y) {
    let best = null;
    let bd = FIELD_FOE_R;
    for (const e of s.enemies) {
      if (e.def?.air) continue;
      const d = dist(e.x, e.y, x, y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best ? unitVec(best.x - x, best.y - y) : unitVec(x - s.ax, y - s.ay);
  },

  /** Untätige Infanterie (nicht im Haus) im umkämpften Gebiet. */
  idleInfantry(s) {
    return s.units.filter((u) => u.def.armor === 'inf' && !u.house && !u.def.hero && u.order.type === 'idle' && this.inFight(s, u.x, u.y)).sort((a, b) => a.id - b.id);
  },

  /**
   * Eingraben: höchstens alle FIELD_EVERY s ein Auftrag. Eine untätige Infanterie mit Baurecht, in deren Umkreis FIELD_R keine eigene
   * Sandsack-Stellung steht, baut eine FIELD_AHEAD px vor sich Richtung Feind (bis FIELD_TRIES Richtungen gefächert).
   */
  digIn(s) {
    const g = this.game;
    const nests = teamProps(g, this.team, NEST).map((i) => g.map.props[i]);
    if (nests.length >= FIELD_MAX) return;
    const busy = s.units.some((u) => u.order.type === 'fieldwork');
    if (busy) return; // einer nach dem anderen: kein Baumaterial für halbe Stellungen verschwenden
    const cost = PROPS.field.kinds[NEST].bm;
    for (const u of this.idleInfantry(s)) {
      if (!canFieldwork(u.def, NEST) || (u.cargo?.bm ?? 0) < cost) continue;
      if (nests.some((p) => dist(p.x, p.y, u.x, u.y) <= FIELD_R)) continue;
      if (!this.once('field-dig', FIELD_EVERY)) return;
      const v = this.foeDir(s, u.x, u.y);
      const base = Math.atan2(v.y, v.x);
      for (let k = 0; k < FIELD_TRIES; k++) {
        const a = base + FIELD_FAN * (k % 2 ? (k + 1) / 2 : -k / 2);
        const x = u.x + Math.cos(a) * FIELD_AHEAD;
        const y = u.y + Math.sin(a) * FIELD_AHEAD;
        const rot = rotAcross(a); // Längsseite quer zur Feindrichtung
        if (fieldSpotWhy(g, this.team, { kind: NEST, x, y, rot })) continue;
        g.issue(this.team, { type: 'fieldwork', ids: [u.id], kind: NEST, x, y, rot });
        return;
      }
      return;
    }
  },

  /** In Deckung: untätige Infanterie bis COVER_R px an einer eigenen Stellung mit freiem Platz (COVER_SEATS) geht hinein. */
  takeCover(s) {
    const g = this.game;
    const nests = teamProps(g, this.team, NEST).map((i) => g.map.props[i]);
    if (!nests.length || !this.once('field-cover', COVER_EVERY)) return;
    const inf = s.units.filter((u) => u.def.armor === 'inf' && !u.house && !u.def.air);
    const seated = (p) => inf.filter((u) => dist(u.x, u.y, p.x, p.y) <= COVER_SEAT_R || (u.order.type === 'move' && dist(u.order.x, u.order.y, p.x, p.y) <= COVER_SEAT_R)).length;
    const taken = new Map(nests.map((p) => [p, seated(p)]));
    for (const u of this.idleInfantry(s)) {
      if (nests.some((p) => dist(u.x, u.y, p.x, p.y) <= COVER_SEAT_R)) continue; // sitzt schon
      let best = null;
      let bd = COVER_R;
      for (const p of nests) {
        const d = dist(u.x, u.y, p.x, p.y);
        if (d < bd && taken.get(p) < COVER_SEATS) {
          bd = d;
          best = p;
        }
      }
      if (!best) continue;
      const n = taken.get(best);
      taken.set(best, n + 1);
      // Platz links oder rechts der Mitte entlang der Längsseite
      const a = rotAngle(best.rot);
      const side = n % 2 ? 1 : -1;
      g.issue(this.team, { type: 'move', ids: [u.id], x: best.x + Math.cos(a) * COVER_SEAT_OFF * side, y: best.y + Math.sin(a) * COVER_SEAT_OFF * side });
    }
  },
};
