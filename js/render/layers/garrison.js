// Renderer, Gebäude-Details: Ruinen, Feuerbereich der Häuser (Fenster) und Besatzung.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (garrisonMethods).
import { drawBar, hpColor } from '../sprites.js';
import { worksMask } from '../stronghold.js';
import { drawWreckRubble } from '../fx.js';

const WIN_OFF = 4; // Feuerbereich (seit v5.67): Strich vor der Hauswand (Welt-px)
const WIN_HALF = 0.3; // halbe Länge des Strichs, Anteil der Seitenlänge

export const garrisonMethods = {
  /** 2D: Ruinen eingestürzter Stadthäuser über dem Bodenbild (das die Häuser fest enthält): Schutthügel, Mauerecke, Balken (fx.js). */
  drawRuins(ctx, R, known) {
    for (const h of this.game.houses ?? []) {
      if (!h.ruined || !known(h.x, h.y)) continue;
      const x0 = h.x - h.pw / 2;
      const y0 = h.y - h.ph / 2;
      if (x0 > R.x1 || y0 > R.y1 || x0 + h.pw < R.x0 || y0 + h.ph < R.y0) continue;
      drawWreckRubble(ctx, { id: h.id, x: h.x, y: h.y, w: h.pw, h: h.ph, small: false, ruin: true, wall: '#c9bfae' });
    }
  },

  /**
   * Besetztes oder ausgebautes Haus sichtbar machen (seit v5.48)? Eigene immer; ein besetztes fremdes, wenn ein Besatzer erkannt ist (wie
   * das Schild, ein getarnter Scharfschütze verrät sein Haus nicht); ein leeres mit Ausbauten, wenn die Stelle erkundet ist.
   */
  fortShown(h, known) {
    const occupied = h.occupants.length > 0;
    if (!occupied && !worksMask(h)) return false;
    if (h.team === this.team || this.revealAll) return true;
    return occupied ? this.game.sees(this.team, h) : known(h.x, h.y);
  },

  /**
   * Feuerbereich am eigenen besetzten Haus (seit v5.67): an jeder Fensterseite ein kurzer Strich in Teamfarbe, vor der Wand.
   * cam bildet Welt- auf Bildschirmkoordinaten ab (während eines Pins die feste Höhe). Nur Bild.
   */
  drawWindows(ctx, h, cam) {
    const w = h.windows;
    if (!w) return;
    const hx = h.pw * WIN_HALF;
    const hy = h.ph * WIN_HALF;
    const left = h.x - h.pw / 2 - WIN_OFF;
    const right = h.x + h.pw / 2 + WIN_OFF;
    const top = h.y - h.ph / 2 - WIN_OFF;
    const bottom = h.y + h.ph / 2 + WIN_OFF;
    ctx.save();
    ctx.strokeStyle = this.game.teams[h.team]?.color ?? '#888';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (w.n) this.windowLine(ctx, cam, h.x - hx, top, h.x + hx, top);
    if (w.s) this.windowLine(ctx, cam, h.x - hx, bottom, h.x + hx, bottom);
    if (w.w) this.windowLine(ctx, cam, left, h.y - hy, left, h.y + hy);
    if (w.e) this.windowLine(ctx, cam, right, h.y - hy, right, h.y + hy);
    ctx.stroke();
    ctx.restore();
  },

  /** Ein Segment (Weltpunkte) in den laufenden Pfad von drawWindows. */
  windowLine(ctx, cam, x0, y0, x1, y1) {
    const a = cam.worldToScreen(x0, y0);
    const b = cam.worldToScreen(x1, y1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  },

  /** Besatzung eines Hauses (Bildschirmkoordinaten, Transformation auf DPR): Schild in Teamfarbe „n/Plätze“, darunter der Zustand. */
  drawGarrison(ctx, x, y, h) {
    const works = h.works ? Object.keys(h.works).length : 0;
    const text = `${h.occupants.length}/${h.def.cap}${'+'.repeat(works)}${h.building ? '…' : ''}`; // + = fertiger Ausbau, … = im Bau
    ctx.save();
    ctx.font = '700 11px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 22;
    const bh = 16;
    const x0 = x - w / 2;
    const y0 = y - bh / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, w, bh, 4);
    else ctx.rect(x0, y0, w, bh);
    ctx.fillStyle = this.game.teams[h.team]?.color ?? '#888';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // kleines Soldaten-Zeichen: Helm und Schultern
    ctx.fillStyle = '#f4f6f2';
    ctx.beginPath();
    ctx.arc(x0 + 8, y0 + 6.5, 3, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x0 + 4.5, y0 + 8.5, 7, 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 15, y + 0.5);
    if (h.hp < h.maxHp) drawBar(ctx, x0, y0 + bh + 2, w, 3, h.hp / h.maxHp, hpColor(h.hp / h.maxHp), 1);
    ctx.restore();
  },
};
