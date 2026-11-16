// Renderer, Marker und Überlagerungen: Auswahlring, Routen, Baustellen, Versorgung, Sammelpunkt, Wegziel, Platzierung, Balken,
// Ziehrahmen, Hinweise. Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (overlayMethods).
import { BALANCE } from '../../data/balance.js';
import { BUILDINGS } from '../../data/buildings.js';
import { lacksAmmo } from '../../game/entities.js';
import { drawBar, fitText, hpColor, hexA } from '../sprites.js';
import { builderState } from '../../game/construction.js';
import { GOOD_COLOR } from '../../data/goods.js';
import {
  drawSelectMark,
  drawDragFrame,
  drawCargoGauge,
  drawCareMark,
  drawNoAmmoMark,
  drawMoveRing,
  drawSlotMark,
  strokeTrail,
  drawArrowHead,
  drawFootRing,
  drawRallyFlag,
} from '../marks.js';
import { TILE, HP_OFFSET } from './consts.js';

const ACCENT = '#c9a227';
const GOLD_RALLY = '#ffd65a'; // Ring am Sammelpunkt
const ROUTE_COLOR = 'rgba(222,182,52,0.95)'; // Route gewählter LKW
const CARGO_COLOR = GOOD_COLOR; // LKW-Ladung je Sorte in der Farbe ihrer Ware (js/data/goods.js, seit v5.64)
const AMMO_COLOR = '#7f93ad'; // Munitionsbalken (grau-blau)
const FUEL_COLOR = GOOD_COLOR.fuel; // Treibstoffbalken (violett, Farbe der Ware)
const BAR_W = 24; // Balkenbreite über Einheiten (Welt-px)
const MARKER_LIFE = 0.8; // s, Lebensdauer des Wegziel-Markers
const SLOT_LIFE = 1.6; // s, so lange zeigen Punkte die Formationsplätze

export const overlayMethods = {
  /** Auswahl (dashed = nur überfahren): gemalter Ring bzw. Rahmen am Boden (seit v5.50, marks.js). */
  drawSelectRing(ctx, e, z, dashed) {
    drawSelectMark(ctx, e, z, dashed, this.camera.iso, z * this.dpr);
  },

  /** Route gewählter LKW von Start-FOB nach Ziel-FOB: gestrichelte Goldlinie mit dunklem Saum und Pfeilspitze am Ziel (seit v5.54, marks.js). */
  drawRoutes(ctx, sel, z) {
    const g = this.game;
    const seen = new Set();
    const drape = this.draping();
    for (const id of sel) {
      const u = g.getEntity(id);
      if (!u || u.kind !== 'unit' || u.type !== 'truck' || u.order.type !== 'route') continue;
      const a = g.getEntity(u.order.fromId);
      const b = g.getEntity(u.order.toId);
      if (!a || !b) continue;
      const key = `${a.id}>${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ctx.save();
      if (drape) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.beginPath();
        this.groundLine(ctx, a.x, a.y, b.x, b.y);
        strokeTrail(ctx, ROUTE_COLOR, 2, [10, 7]);
        this.groundAt(ctx, b.x, b.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        strokeTrail(ctx, ROUTE_COLOR, 2 / z, [10 / z, 7 / z]);
      }
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      drawArrowHead(ctx, b.x - Math.cos(ang) * 22, b.y - Math.sin(ang) * 22, ang, 6.5 / z, ROUTE_COLOR, 1 / z);
      ctx.restore();
    }
  },

  /** Eigene Baustelle: ohne Bauer ein graues „!“ an der Ecke. */
  drawSiteMarks(ctx, b, z) {
    const x0 = b.cx * TILE;
    const y0 = b.cy * TILE;
    const w = b.w * TILE;
    if (builderState(this.game, b) === 'none') {
      ctx.save();
      ctx.fillStyle = '#8c8f89';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.arc(x0 + w, y0, 7 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#161916';
      fitText(ctx, '!', x0 + w, y0, 12, z);
      ctx.restore();
    }
  },

  /**
   * Eigene Einheit: LKW-Ladung (immer), Munitions- und Treibstoffbalken (gewählt/gehovert), rotes „!“ bei leerer
   * Munition (bewaffnete Einheiten, immer).
   */
  drawSupply(ctx, u, picked, z) {
    const r = u.def.radius;
    const x = u.x - BAR_W / 2;
    if (u.type === 'truck' && u.cargo) {
      const cap = BALANCE.logistics.truckCapacity;
      const parts = ['bm', 'mun', 'fuel'].map((k) => [u.cargo[k] / cap, CARGO_COLOR[k]]);
      drawCargoGauge(ctx, x, u.y + r + 4 / z, BAR_W, 3 / z, parts, 1 / z);
    }
    if (picked) {
      // unter dem Lebensbalken: Munition, dann Treibstoff (beide oberhalb des Sprites); die Platten schließen lückenlos an
      const y = u.y - r - HP_OFFSET / z;
      if (u.def.ammoMax) drawBar(ctx, x, y + 5 / z, BAR_W, 3 / z, u.ammo / u.def.ammoMax, AMMO_COLOR, 1 / z);
      if (u.def.fuelMax) drawBar(ctx, x, y + 9 / z, BAR_W, 3 / z, u.fuel / u.def.fuelMax, FUEL_COLOR, 1 / z);
    }
    if (lacksAmmo(u)) drawNoAmmoMark(ctx, u.x + r + 5 / z, u.y - r - 3 / z, z);
  },

  /** Sammelpunkt: gestrichelte Linie mit Saum, Ring am Boden und aufrechte Fahne (gemalt seit v5.54, marks.js). */
  drawRally(ctx, b, z) {
    if (b.rallyX === undefined) return; // Stadtgebäude haben keinen Sammelpunkt
    const px = b.rallyX;
    const py = b.rallyY;
    const color = hexA(ACCENT, 0.9);
    ctx.save();
    if (this.draping()) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.beginPath();
      this.groundLine(ctx, b.x, b.y, px, py);
      strokeTrail(ctx, color, 1.5, [5, 4]);
      this.groundAt(ctx, px, py);
    } else {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(px, py);
      strokeTrail(ctx, color, 1.5 / z, [5 / z, 4 / z]);
    }
    drawFootRing(ctx, px, py, 5 / z, GOLD_RALLY, 1 / z);
    if (this.camera.iso) {
      // Fahne aufrecht über dem Fußpunkt (Bildschirm)
      const p = this.draping() ? this.screenAt(px, py) : this.camera.worldToScreen(px, py);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawRallyFlag(ctx, p.x, p.y, 1);
    } else drawRallyFlag(ctx, px, py, 1 / z);
    ctx.restore();
  },

  /** Wegziel: Ring am Klickpunkt, bei Formationen kurz Punkte auf den Zielplätzen (gemalt seit v5.54, marks.js). at(x, y) setzt im Relief die Bodenebene dort. */
  drawMoveMarker(ctx, m, now, z, at = null) {
    if (!m || !Number.isFinite(m.t)) return;
    const age = (now - m.t) / 1000;
    if (!(age >= 0 && age < Math.max(MARKER_LIFE, m.slots ? SLOT_LIFE : 0))) return;
    if (m.slots) {
      const a = 0.9 * (1 - age / SLOT_LIFE);
      for (const p of m.slots) {
        at?.(p.x, p.y);
        drawSlotMark(ctx, p.x, p.y, z, a);
      }
      at?.(m.x, m.y);
    }
    if (age < MARKER_LIFE) drawMoveRing(ctx, m.x, m.y, age / MARKER_LIFE, z, this.camera.iso);
  },

  /** Platzierungsvorschau: grün gültig, rot ungültig; bei Mauerzug jede Zelle einzeln. */
  drawPlacement(ctx, p, z) {
    if (Array.isArray(p.cells) && p.cells.length) {
      for (const c of p.cells) this.ghostRect(ctx, c.cx, c.cy, 1, 1, c.ok, z);
      return;
    }
    const def = BUILDINGS[p.type];
    if (!def || !Number.isFinite(p.x)) return;
    const cx = Math.floor(p.x / TILE) - Math.floor(def.w / 2);
    const cy = Math.floor(p.y / TILE) - Math.floor(def.h / 2);
    this.ghostRect(ctx, cx, cy, def.w, def.h, p.ok, z);
  },

  ghostRect(ctx, cx, cy, w, h, ok, z) {
    const x = cx * TILE;
    const y = cy * TILE;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(70,220,110,0.3)' : 'rgba(255,80,80,0.3)';
    ctx.strokeStyle = ok ? '#7dff9e' : '#ff7070';
    ctx.lineWidth = 2 / z;
    ctx.fillRect(x, y, w * TILE, h * TILE);
    ctx.strokeRect(x, y, w * TILE, h * TILE);
    ctx.restore();
  },

  drawHp(ctx, x, y, w, frac, z) {
    drawBar(ctx, x, y, w, 4 / z, frac, hpColor(frac), 1 / z, true);
  },

  /** Grünes Kreuz links neben dem Lebensbalken: die Einheit wird gerade geheilt oder repariert (Stadtgebäude, seit v5.01). */
  drawCare(ctx, x, y, z) {
    drawCareMark(ctx, x - 6 / z, y + 2 / z, z); // gemalt seit v5.52 (marks.js)
  },

  /** Auswahlrahmen (Bildschirmkoordinaten, Transformation bereits auf DPR gesetzt; gemalt seit v5.50, marks.js). */
  drawDragBox(ctx, d) {
    drawDragFrame(ctx, d);
  },

  /** Grund für ungültige Platzierung, über dem Mauszeiger (Bildschirmkoordinaten). */
  drawNote(ctx, s, text) {
    ctx.save();
    ctx.font = '600 13px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const bx = s.x - tw / 2 - 8;
    const by = s.y - 44;
    ctx.fillStyle = 'rgba(20,10,10,0.85)';
    ctx.fillRect(bx, by, tw + 16, 22);
    ctx.fillStyle = '#ffb4b4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s.x, by + 11);
    ctx.restore();
  },
};
