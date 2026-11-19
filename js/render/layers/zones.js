// Renderer, Zonen: Konfliktzone, Eroberung (Gitter, Viertelgrenzen, Flaggengebiete, Flaggen) und Hot Zone.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (zoneMethods).
import { BALANCE } from '../../data/balance.js';
import { hexA } from '../sprites.js';
import { W, H } from './consts.js';

export const zoneMethods = {
  drawZone(ctx, z) {
    const g = this.game;
    const zn = g.zone;
    const owned = zn.owner >= 0;
    const col = owned ? g.teams[zn.owner].color : '#e8ece8';
    const drape = this.draping();
    const k = drape ? z : 1; // Längen in Bildschirm-Pixeln, wenn der Kreis dem Gelände folgt
    ctx.save();
    if (drape) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundArc(ctx, zn.x, zn.y, zn.r);
    ctx.fillStyle = hexA(col, owned ? 0.12 : 0.05);
    ctx.fill();
    ctx.strokeStyle = hexA(col, 0.85);
    ctx.lineWidth = drape ? Math.max(1.5, 3 * z) : 4;
    if (zn.contested) ctx.setLineDash([28 * k, 18 * k]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Beschriftung nahe dem oberen Rand, damit sie nicht über den Einheiten in der Mitte liegt
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 56px system-ui, sans-serif';
    if (this.camera.iso) this.uprightAtWorld(ctx, zn.x, zn.y - zn.r + 110, 0);
    ctx.fillText('KONFLIKTZONE', zn.x, zn.y - zn.r + 110);
    ctx.restore();
  },

  /**
   * Eroberung: Rand der quadratischen Konfliktzone, die 16 Flaggengebiete, je Flagge Umkreislinie, Mast mit Fahne und Buchstabe in der
   * Farbe des Besitzers (grau = neutral), Einnahme-Fortschritt als Bogen; dazu die Grenzen der Viertel (rot gestrichelt, solange das
   * Viertel für das eigene Team gesperrt ist).
   */
  drawConquest(ctx, z) {
    const g = this.game;
    const cq = g.conquest;
    const C = BALANCE.conquest;
    const zn = g.zone;
    const drape = this.draping();
    const k = drape ? z : 1;
    const lw = (w) => (drape ? Math.max(1, w * z) : w);
    const GRAY = '#b8beb6';
    const colOf = (t) => (t >= 0 ? g.teams[t].color : GRAY);
    const h = cq.half;
    const s = { g, cq, C, zn, drape, k, lw, colOf, h }; // gemeinsame Werte der Teilzeichnungen
    ctx.save();
    if (drape) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.conquestGrid(ctx, s);
    this.conquestRays(ctx, s);
    this.conquestQuarters(ctx, s);
    this.conquestAreas(ctx, s, z);
    this.conquestFlagBases(ctx, s);
    ctx.restore();
    this.conquestMasts(ctx, s);
  },

  /** Eroberung: Gitter der Gebiete (dünn) und Rand der Zone (kräftig). */
  conquestGrid(ctx, s) {
    const { cq, C, h, k, lw } = s;
    // Gitter der Gebiete (dünn) und Rand der Zone (kräftig)
    ctx.beginPath();
    for (let i = 1; i < (cq.round ? 0 : C.grid); i++) {
      this.groundLine(ctx, cq.x0 + i * cq.size, cq.y0, cq.x0 + i * cq.size, cq.y0 + 2 * h);
      this.groundLine(ctx, cq.x0, cq.y0 + i * cq.size, cq.x0 + 2 * h, cq.y0 + i * cq.size);
    }
    ctx.strokeStyle = 'rgba(232,236,232,0.42)';
    ctx.lineWidth = lw(2);
    ctx.setLineDash([18 * k, 14 * k]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    this.groundLine(ctx, cq.x0, cq.y0, cq.x0 + 2 * h, cq.y0);
    this.groundLine(ctx, cq.x0 + 2 * h, cq.y0, cq.x0 + 2 * h, cq.y0 + 2 * h);
    this.groundLine(ctx, cq.x0 + 2 * h, cq.y0 + 2 * h, cq.x0, cq.y0 + 2 * h);
    this.groundLine(ctx, cq.x0, cq.y0 + 2 * h, cq.x0, cq.y0);
    ctx.strokeStyle = 'rgba(232,236,232,0.8)';
    ctx.lineWidth = lw(4);
    ctx.stroke();
  },

  /** Eroberung: Viertelgrenzen außerhalb der Zone (vier Strahlen zum Kartenrand). */
  conquestRays(ctx, s) {
    const { cq, zn, h, k, lw } = s;
    // Viertelgrenzen außerhalb der Zone: vier Strahlen von den Kantenmitten zum Kartenrand
    // Seitenlayout (feste Karten): Strahlen von den Ecken der Zone zu den Kartenecken; Index = Kartenseite (0 oben, 1 rechts, 2 unten, 3 links)
    const rays = cq.sides
      ? [
          [cq.x0, cq.y0, 0, 0, 0, 3],
          [cq.x0 + 2 * h, cq.y0, W, 0, 0, 1],
          [cq.x0 + 2 * h, cq.y0 + 2 * h, W, H, 1, 2],
          [cq.x0, cq.y0 + 2 * h, 0, H, 2, 3],
        ]
      : [
          [zn.x, cq.y0, zn.x, 0, 0, 1],
          [zn.x, cq.y0 + 2 * h, zn.x, H, 2, 3],
          [cq.x0, zn.y, 0, zn.y, 0, 2],
          [cq.x0 + 2 * h, zn.y, W, zn.y, 1, 3],
        ];
    for (const [x1, y1, x2, y2, qa, qb] of rays) {
      const locked = [qa, qb].some((q) => cq.quad[q] !== this.team && !cq.open[cq.quad[q]]);
      ctx.beginPath();
      this.groundLine(ctx, x1, y1, x2, y2);
      ctx.strokeStyle = locked ? 'rgba(229,72,77,0.75)' : 'rgba(232,236,232,0.45)';
      ctx.lineWidth = lw(3);
      ctx.setLineDash([24 * k, 16 * k]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  },

  /** Eroberung: Rand eines fremden, gesperrten Viertels zur Zone hin. */
  conquestQuarters(ctx, s) {
    const { g, cq, zn, h, lw } = s;
    // Rand eines fremden, gesperrten Viertels zur Zone hin
    for (let q = 0; q < 4; q++) {
      const own = cq.quad[q];
      if (own === this.team || cq.open[own]) continue;
      ctx.beginPath();
      if (cq.sides) {
        // ganze Kante der Zone zur Seite q (0 oben, 1 rechts, 2 unten, 3 links)
        const [ax, ay, bx, by] = [[-1, -1, 1, -1], [1, -1, 1, 1], [-1, 1, 1, 1], [-1, -1, -1, 1]][q];
        this.groundLine(ctx, zn.x + ax * h, zn.y + ay * h, zn.x + bx * h, zn.y + by * h);
      } else {
        const sx = q & 1 ? 1 : -1;
        const sy = q & 2 ? 1 : -1;
        this.groundLine(ctx, zn.x, zn.y + sy * h, zn.x + sx * h, zn.y + sy * h);
        this.groundLine(ctx, zn.x + sx * h, zn.y + sy * h, zn.x + sx * h, zn.y);
      }
      ctx.strokeStyle = hexA(own < g.teams.length ? g.teams[own].color : '#e5484d', 0.9);
      ctx.lineWidth = lw(5);
      ctx.stroke();
    }
  },

  /** Eroberung: Gebiet jeder Flagge (Quadrat in der Farbe des Besitzers). */
  conquestAreas(ctx, s, z) {
    const { cq, drape, colOf } = s;
    // Gebiet jeder Flagge (seit Paket „Flaggengebiet“): gezählt werden alle Einheiten im ganzen Quadrat, nicht nur am Mast. Deshalb
    // trägt das Quadrat selbst die Farbe des Besitzers (Rand etwas nach innen gesetzt, damit zwei Nachbarn beide sichtbar bleiben, dazu
    // eine leichte Tönung); gestrichelt, solange es umkämpft ist (Gegner im Gebiet).
    const inset = 28;
    // Linienbreite: mindestens 3 Bildschirmpixel, auch weit herausgezoomt (2D zeichnet in Weltkoordinaten)
    const areaW = drape ? Math.max(3, 6 * z) : Math.max(6, 3 / (this.camera.zoom || 1));
    for (const f of cq.flags) {
      const col = colOf(f.owner);
      ctx.beginPath();
      if (f.r) {
        // eigene Flaggen der Karte (Paket „Feste Karten“): rundes Gebiet
        const r = f.r - inset / 2;
        this.groundPoly(ctx, Array.from({ length: 56 }, (_, i) => [f.x + Math.cos((i / 56) * Math.PI * 2) * r, f.y + Math.sin((i / 56) * Math.PI * 2) * r]));
      } else {
        const x0 = f.x - cq.size / 2 + inset;
        const y0 = f.y - cq.size / 2 + inset;
        const x1 = f.x + cq.size / 2 - inset;
        const y1 = f.y + cq.size / 2 - inset;
        this.groundPoly(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      }
      if (f.owner >= 0) {
        ctx.fillStyle = hexA(col, 0.07);
        ctx.fill();
      }
      ctx.strokeStyle = hexA(col, f.owner >= 0 ? 0.9 : 0.75);
      ctx.lineWidth = areaW;
      if (f.contested) ctx.setLineDash([areaW * 7, areaW * 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  /** Eroberung: Sockel am Mast jeder Flagge und Fortschrittsring der Einnahme. */
  conquestFlagBases(ctx, s) {
    const { cq, C, drape, lw, colOf } = s;
    // Flaggen: kleiner Sockel am Mast (nur Markierung, nicht das Gebiet) und Fortschritt
    for (const f of cq.flags) {
      const col = colOf(f.owner);
      this.groundArc(ctx, f.x, f.y, C.flagRing / 3);
      ctx.fillStyle = hexA(col, f.owner >= 0 ? 0.35 : 0.15);
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.95);
      ctx.lineWidth = lw(3);
      ctx.stroke();
      if (f.p > 0 && f.p < 1 && f.capTeam >= 0) {
        // Einnahme läuft: äußerer Ring in der Farbe des Balkens, Länge = Fortschritt
        const n = Math.max(2, Math.round(40 * f.p));
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = -Math.PI / 2 + (i / 40) * Math.PI * 2;
          const wx = f.x + Math.cos(a) * (C.flagRing / 3 + 18);
          const wy = f.y + Math.sin(a) * (C.flagRing / 3 + 18);
          const p = drape ? this.camera.worldToScreen(wx, wy) : { x: wx, y: wy };
          if (i) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
        ctx.strokeStyle = hexA(colOf(f.capTeam), 0.95);
        ctx.lineWidth = lw(6);
        ctx.stroke();
      }
    }
  },

  /** Eroberung: Mast, Fahne und Buchstabe (aufrecht). */
  conquestMasts(ctx, s) {
    const { cq, drape, colOf } = s;
    // Mast, Fahne und Buchstabe (aufrecht)
    for (const f of cq.flags) {
      const col = colOf(f.owner);
      ctx.save();
      if (this.camera.iso) this.uprightAtWorld(ctx, f.x, f.y, 0);
      else if (drape) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.strokeStyle = '#e8ece8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x, f.y - 96);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(f.x + 2, f.y - 96, 58, 38);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#10140f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText(f.letter, f.x + 31, f.y - 76);
      ctx.restore();
    }
  },

  /** Hot Zone: pulsierender oranger Kreis mit Beschriftung; Besitzfarbe, wenn ein Team sie hält. */
  drawHot(ctx, z, now) {
    const hz = this.game.hot;
    const owned = hz.owner >= 0;
    const col = owned ? this.game.teams[hz.owner].color : '#ff9a1f';
    const pulse = 0.5 + 0.5 * Math.sin(now / 400);
    const drape = this.draping();
    const k = drape ? z : 1;
    ctx.save();
    if (drape) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundArc(ctx, hz.x, hz.y, hz.r);
    ctx.fillStyle = hexA('#ff7a1a', 0.1 + 0.07 * pulse);
    ctx.fill();
    ctx.strokeStyle = hexA(col, 0.9);
    ctx.lineWidth = drape ? Math.max(1.5, 2.4 * z) : 3;
    ctx.setLineDash([16 * k, 10 * k]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,190,110,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px system-ui, sans-serif';
    if (this.camera.iso) this.uprightAtWorld(ctx, hz.x, hz.y - hz.r + 40, 0);
    ctx.fillText('HOT ZONE', hz.x, hz.y - hz.r + 40);
    ctx.restore();
  },
};
