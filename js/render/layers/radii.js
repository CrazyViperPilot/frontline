// Renderer, Radien gewählter Einheiten und Gebäude: Reichweiten, Sicht, Luftraum, Planung des Fliegerhorsts, Mörserbereich.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (radiiMethods).
import { BALANCE } from '../../data/balance.js';
import { CITY } from '../../data/city.js';
import { careOf } from '../../game/city/care.js';
import { KINDS as CITY_KINDS, KIND as CITY_KIND } from '../../data/citykinds.js';
import { bigCenter } from '../../game/city/cells.js';
import { runwaysOf } from '../../game/aircraft.js';
import { rangeMul } from '../../game/research.js';
import { hexA } from '../sprites.js';
import { TILE } from './consts.js';

export const radiiMethods = {
  /** Bauradius der eigenen fertigen FOBs (nur bei Platzierung). */
  drawRadii(ctx, z) {
    const g = this.game;
    const k = this.draping() ? z : 1;
    ctx.save();
    if (this.draping()) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.setLineDash([(10 / z) * k, (8 / z) * k]);
    ctx.strokeStyle = 'rgba(120,190,255,0.4)';
    ctx.lineWidth = (2 / z) * k;
    for (const b of g.buildings) {
      if (!b.alive || !b.built || b.team !== this.team || b.type !== 'fob') continue;
      this.groundArc(ctx, b.x, b.y, BALANCE.fob.buildRadius);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Bauradius gewählter oder überfahrener FOBs (eigene und gegnerische) in Teamfarbe, leicht gefüllt. */
  drawSelectedRadii(ctx, z, v) {
    const g = this.game;
    const ids = v.selection ? [...v.selection] : [];
    if (v.hoverId) ids.push(v.hoverId);
    const seen = new Set();
    const k = this.draping() ? z : 1;
    ctx.save();
    if (this.draping()) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineWidth = (2 / z) * k;
    ctx.setLineDash([(10 / z) * k, (8 / z) * k]);
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const b = g.getEntity(id);
      if (b && b.kind === 'building' && b.def.weapon && b.def.weapon.shell && b.team === this.team) {
        this.drawMortarRange(ctx, b, z);
        continue;
      }
      if (b && b.kind === 'unit' && b.def.indirect && b.team === this.team) {
        this.drawMortarRange(ctx, b, z); // Artillerie: gleiche Kreise wie der Mörser
        continue;
      }
      if (b && b.kind === 'unit' && b.def.hero && !b.house) {
        // Kommandeur: Umkreis seiner Aura
        this.groundArc(ctx, b.x, b.y, BALANCE.commander.aura);
        ctx.fillStyle = 'rgba(242,201,76,0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(242,201,76,0.8)';
        ctx.stroke();
        continue;
      }
      if (b && b.team === this.team && this.drawAirRadius(ctx, b, 1)) continue; // Fliegerhorst-Versorgung (seit v5.74)
      const care = b && b.team === this.team ? careOf(g, b) : null;
      if (care) {
        // Stadtgebäude, das heilt oder repariert (seit v5.01): Umkreis in Grün
        this.groundArc(ctx, b.x, b.y, care.radius * CITY.cell + (b.w * TILE) / 2); // ab dem Gebäuderand (Großbau größer)
        ctx.fillStyle = 'rgba(63,212,106,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(63,212,106,0.85)';
        ctx.stroke();
        continue;
      }
      if (!b || b.kind !== 'building' || b.type !== 'fob') continue;
      const color = g.teams[b.team].color;
      ctx.globalAlpha = b.built ? 1 : 0.5;
      this.groundArc(ctx, b.x, b.y, BALANCE.fob.buildRadius);
      ctx.fillStyle = hexA(color, 0.07);
      ctx.fill();
      ctx.strokeStyle = hexA(color, 0.8);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Umkreise der Fliegerhorst-Versorgung (seit v5.74, Daniels Wunsch „Radius anzeigen, damit ich den Flughafen besser planen kann“):
   * Kerosintank und Munitionslager versorgen Stellplätze und Heliports im Umkreis CITY.air.supplyRadius (Mitte zu Mitte), der Tower lotst
   * Heliports im Umkreis atcRadius und Bahnen, deren Mitte höchstens atcRadius + halbe Bahnlänge entfernt ist (diese Bahnen grün
   * umrandet). Ein gewählter Stellplatz oder Heliport zeigt, wo Tank und Lager stehen müssen. a = Deckkraft (Baumodus blasser).
   * Liefert true, wenn b eine dieser Arten ist.
   */
  drawAirRadius(ctx, b, a) {
    const g = this.game;
    const c = b.cityCell != null ? g.city?.[b.team] : null;
    if (!c) return false;
    const k = CITY_KINDS[c.kind[b.cityCell] - 1];
    const A = CITY.air;
    const S = c.cell;
    const ring = (r, col) => {
      this.groundArc(ctx, b.x, b.y, r);
      ctx.fillStyle = hexA(col, 0.07 * a);
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.85 * a);
      ctx.stroke();
    };
    if (k === 'ktank' || k === 'mdepot') ring(A.supplyRadius * S, CITY_KIND[k].color);
    else if (k === 'stand' || k === 'heliport') ring(A.supplyRadius * S, '#e8e4d8');
    else if (k === 'atc') {
      ring(A.atcRadius * S, CITY_KIND.atc.color);
      // Bahnen, die dieser Tower lotst: grün umrandet
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA('#3fd46a', 0.9 * a);
      for (const rw of runwaysOf(g, b.team)) {
        if (!rw.valid || Math.hypot(b.x - rw.cx, b.y - rw.cy) > A.atcRadius * S + (rw.len * S) / 2) continue;
        const x0 = c.x0 + rw.q0 * S;
        const y0 = c.y0 + rw.r0 * S;
        const x1 = c.x0 + (rw.q1 + 1) * S;
        const y1 = c.y0 + (rw.r1 + 1) * S;
        ctx.beginPath();
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], n) => {
          const p = this.draping() ? this.camera.worldToScreen(x, y) : { x, y };
          if (n) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    } else return false;
    return true;
  },

  /** Baumodus mit einem Fliegerhorst-Werkzeug: Umkreise aller eigenen Tanks, Lager und Tower blass (seit v5.74). */
  drawAirPlanning(ctx, z) {
    const ui = this.cityUi;
    if (!ui?.open || !['runway', 'taxi', 'stand', 'atc', 'ktank', 'mdepot', 'heliport'].includes(ui.tool)) return;
    const c = this.game.city?.[this.team];
    if (!c) return;
    const k = this.draping() ? z : 1;
    ctx.save();
    if (this.draping()) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineWidth = (2 / z) * k;
    ctx.setLineDash([(10 / z) * k, (8 / z) * k]);
    for (const [i, e] of c.ents) {
      if (e.alive && ['ktank', 'mdepot', 'atc'].includes(CITY_KINDS[c.kind[i] - 1])) this.drawAirRadius(ctx, e, 0.55);
    }
    // Vorschau: Umkreis des Baus, der gerade gezogen wird oder unter dem Mauszeiger liegt (Mitte des 2 × 2-Quadrats am Finger)
    const d = ui.drag ?? ui.hover;
    const R = ui.tool === 'atc' ? CITY.air.atcRadius : ['ktank', 'mdepot'].includes(ui.tool) ? CITY.air.supplyRadius : 0;
    if (d && R) {
      const p = bigCenter(c, d.r1 * c.cols + d.c1, CITY.size[ui.tool]);
      this.groundArc(ctx, p.x, p.y, R * c.cell);
      ctx.fillStyle = hexA(CITY_KIND[ui.tool].color, 0.1);
      ctx.fill();
      ctx.strokeStyle = hexA(CITY_KIND[ui.tool].color, 0.95);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Mörser: Reichweite (außen), Mindestreichweite (innen) und gewähltes Ziel. */
  drawMortarRange(ctx, b, z) {
    const w = b.def.weapon ?? b.weapons?.find((x) => x.spec.shell)?.spec; // Mörser (Gebäude) oder Artillerie (Einheit)
    if (!w) return;
    const range = w.range * rangeMul(this.game, b);
    const drape = this.draping();
    const k = drape ? z : 1;
    ctx.save();
    if (drape) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.setLineDash([(10 / z) * k, (8 / z) * k]);
    ctx.lineWidth = (2 / z) * k;
    this.groundArc(ctx, b.x, b.y, range);
    ctx.fillStyle = 'rgba(255,170,60,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,60,0.75)';
    ctx.stroke();
    this.groundArc(ctx, b.x, b.y, w.minRange);
    ctx.strokeStyle = 'rgba(255,170,60,0.4)';
    ctx.stroke();
    ctx.setLineDash([]);
    if (b.fireTarget) {
      const t = b.fireTarget;
      if (drape) this.groundAt(ctx, t.x, t.y);
      ctx.strokeStyle = '#ff6a3a';
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(t.x, t.y, w.splash || 30, 0, Math.PI * 2);
      ctx.moveTo(t.x - 14 / z, t.y);
      ctx.lineTo(t.x + 14 / z, t.y);
      ctx.moveTo(t.x, t.y - 14 / z);
      ctx.lineTo(t.x, t.y + 14 / z);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Entities für Auswahlrahmen: Besatzer eines Hauses werden zum Haus (je Haus einmal). */
  ringed(sel) {
    const g = this.game;
    const out = new Set();
    for (const id of sel) {
      const e = g.getEntity(id);
      if (e) out.add(e.house ? (g.getEntity(e.house) ?? e) : e);
    }
    return out;
  },
};
