// Renderer, gemeinsames Welt-Zeug für 2D und Iso: Kisten, Narben, Trümmer, Rauchquellen, Bodenhöhe, Gelände.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (worldMethods).
import { CITY } from '../../data/city.js';
import { unitLift, buildingHeight, TOWN_H } from '../iso.js';
import { scarAlpha } from '../../game/scars.js';
import { drawWreckTop } from '../unitpaint.js';
import { drawCrater, drawWreck, drawWreckRubble } from '../fx.js';
import { mineVisible } from '../../game/mines.js';
import { TILE, W, H, SC } from './consts.js';
import { mapPylons } from '../maptown.js';
import { drawWires } from '../landmarks.js';

const SMOKE_AT = 0.6; // Gebäude und Häuser rauchen unter diesem Lebensanteil, Fahrzeuge unter VEHICLE_SMOKE
const VEHICLE_SMOKE = 0.5;
const FIRE_AT = 0.3; // darunter brennt es (Fahrzeuge: halber Wert)
const WRECK_SMOKE = 60; // s: so lange raucht ein Wrack, die ersten WRECK_FIRE s brennt es
const WRECK_FIRE = 20;

export const worldMethods = {
  /** Hochspannungsleitungen zwischen den Strommasten der Karte (über allen Objekten; feste Karten, landmarks.js). */
  drawPowerWires(f) {
    const net = mapPylons(this.game.map);
    if (!net.size) return;
    const { ctx, cam, inRect, dpr } = f;
    const z = cam.zoom;
    const inView = (x, y) => inRect(x, y, 700);
    ctx.save();
    if (cam.iso) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWires(ctx, net, (x, y, h) => {
        const p = cam.worldToScreen(x, y);
        return { x: p.x, y: p.y - h * z };
      }, Math.max(0.5, 0.9 * z), inView);
    } else drawWires(ctx, net, (x, y) => ({ x, y }), Math.max(1.2, 1 / z), inView);
    ctx.restore();
  },

  /**
   * Kisten zum Zeichnen: am Boden, wie das Team sie zuletzt gesehen hat (nur in erkundeten Zellen; Debug: alle), und eingelagerte bei
   * eigenen FOBs oder in Sicht. Getragene zeichnet die Einheit. → [{ x, y, ground }]
   */
  crateMarks(seen, known) {
    const g = this.game;
    const out = [];
    for (const c of g.crates ?? []) {
      if (c.state === 'stored' && (c.holder === this.team || seen(c.x, c.y))) out.push({ x: c.x, y: c.y, ground: false });
      else if (c.state === 'ground' && this.revealAll) out.push({ x: c.x, y: c.y, ground: true });
    }
    if (!this.revealAll) for (const m of g.crateSeen?.[this.team]?.values() ?? []) if (known(m.x, m.y)) out.push({ x: m.x, y: m.y, ground: true });
    return out;
  },

  /** Wrack oder Krater, den das Team schon gesehen hat (Debug: alle). */
  scarShown(s) {
    return this.revealAll || ((s.seen >> this.team) & 1) === 1;
  },

  /**
   * Schutt zerstörter Straßen (Paket „Straßen“, Teil 3): je Zelle ein großer Krater mit Brocken, solange nicht geräumt. Gezeigt, wenn die
   * Stelle erkundet ist (wie Stadtzellen). ground(x, y): Bodenebene je Ort setzen (Iso mit Gelände), sonst null.
   */
  drawRubble(ctx, inRect, ground) {
    const g = this.game;
    if (!g.rubble) return;
    const S = CITY.cell;
    const cols = g.city?.[0]?.cols ?? g.roads?.cols ?? 0;
    const fog = g.fog?.[this.team];
    for (const k in g.rubble) {
      const i = +k;
      const x = ((i % cols) + 0.5) * S;
      const y = (Math.floor(i / cols) + 0.5) * S;
      if (!inRect(x, y, S)) continue;
      if (!this.revealAll && fog && !fog.isExplored(x, y)) continue;
      if (ground) ground(x, y);
      ctx.save();
      ctx.fillStyle = 'rgba(70,64,56,0.85)'; // aufgerissener Belag
      ctx.fillRect(x - S / 2 + 3, y - S / 2 + 3, S - 6, S - 6);
      ctx.restore();
      drawCrater(ctx, { id: 900000 + i, x, y, r: S * 0.36 }, 1);
      drawCrater(ctx, { id: 950000 + i, x: x + S * 0.2, y: y - S * 0.18, r: S * 0.18 }, 0.9);
    }
  },

  /** Draufsicht: Krater und Brandflecken, darauf Trümmer und Fahrzeugwracks (unter Gebäuden und Einheiten). */
  drawScars(ctx, inRect, z) {
    const g = this.game;
    for (const c of g.craters ?? []) {
      if (this.scarShown(c) && inRect(c.x, c.y, c.r + 10)) drawCrater(ctx, c, scarAlpha(c, g.time, SC.craterLife, SC.craterFade));
    }
    this.drawRubble(ctx, inRect, null);
    for (const w of g.wrecks ?? []) {
      if (!this.scarShown(w) || !inRect(w.x, w.y, 60)) continue;
      const a = scarAlpha(w, g.time, SC.wreckLife, SC.wreckFade);
      if (w.kind === 'building') drawWreckRubble(ctx, w, a);
      else if (!drawWreckTop(ctx, w, z, a)) drawWreck(ctx, w, z, a); // verkohltes Modell (seit v5.34), sonst einfache Form
    }
  },

  /**
   * Rauch und Feuer in Sicht: beschädigte Teamgebäude und Häuser (unter SMOKE_AT), Fahrzeuge (unter VEHICLE_SMOKE) und frische
   * Wracks. Größen in Welt-px, lift = Höhe der Quelle über dem Boden (isometrisch). → [{ x, y, lift, s, k, fire, seed }]
   */
  smokeSources(seen, shown, inRect, pad) {
    const g = this.game;
    const out = [];
    for (const b of g.buildings) {
      if (!b.alive || !b.built || b.def.blocksAll || b.def.gate || !inRect(b.x, b.y, pad)) continue;
      const f = b.hp / b.maxHp;
      if (f >= SMOKE_AT || !(b.team === this.team || seen(b.x, b.y))) continue;
      const off = ((b.id * 37) % 21) / 20 - 0.5; // nicht genau in der Mitte
      out.push({ x: b.x + off * b.w * TILE * 0.5, y: b.y - off * b.h * TILE * 0.3, lift: buildingHeight(b) * 0.5, s: 6 + 2.5 * Math.max(b.w, b.h), k: (SMOKE_AT - f) / SMOKE_AT, fire: f < FIRE_AT, seed: b.id * 13 });
    }
    for (const h of g.houses ?? []) {
      if (!h.alive || h.ruined || h.hp >= h.maxHp * SMOKE_AT || !inRect(h.x, h.y, pad) || !(h.team === this.team || seen(h.x, h.y))) continue;
      const f = h.hp / h.maxHp;
      out.push({ x: h.x, y: h.y, lift: (TOWN_H[h.type] || 40) * 0.85, s: 8 + Math.max(h.pw, h.ph) / 14, k: (SMOKE_AT - f) / SMOKE_AT, fire: f < FIRE_AT, seed: -h.id * 7 });
    }
    for (const u of g.units) {
      if (!u.alive || u.house || u.def.armor === 'inf' || u.hp >= u.maxHp * VEHICLE_SMOKE || !inRect(u.x, u.y, pad) || !shown(u)) continue;
      const f = u.hp / u.maxHp;
      out.push({ x: u.x, y: u.y, lift: unitLift(u) + 6, s: 4 + u.def.radius * 0.3, k: (VEHICLE_SMOKE - f) / VEHICLE_SMOKE, fire: f < FIRE_AT / 2, seed: u.id * 17, unit: true });
    }
    // Staub am arbeitenden Bagger (seit v5.77, nur Bild): an der Zelle, die er gerade räumt, solange er dort arbeitet (order.t > 0)
    for (const u of g.units) {
      const o = u.order;
      if (!u.alive || o.type !== 'dig' || !(o.t > 0) || !inRect(o.x, o.y, pad) || !shown(u)) continue;
      out.push({ x: o.x * 0.7 + u.x * 0.3, y: o.y * 0.7 + u.y * 0.3, lift: 4, s: 24, k: Math.min(1, o.t * 2), fire: false, seed: u.id * 11, dust: true });
    }
    for (const w of g.wrecks ?? []) {
      const age = g.time - w.t0;
      if (age >= WRECK_SMOKE || w.small || !inRect(w.x, w.y, pad) || !seen(w.x, w.y)) continue;
      const big = w.kind === 'building';
      out.push({ x: w.x, y: w.y, lift: big ? 12 : 6, s: big ? 8 + Math.max(w.w, w.h) / 14 : 6, k: 1 - age / WRECK_SMOKE, fire: age < WRECK_FIRE, seed: w.id * 29 });
    }
    // Nebelwand und eigene Minen (Fähigkeiten, abilities.js); bis v5.33 versehentlich in crateMarks (ohne inRect: Fehler beim Zeichnen)
    for (const s of g.smokes ?? []) {
      if (!inRect(s.x, s.y, pad + s.r) || !(s.team === this.team || seen(s.x, s.y))) continue;
      const k = Math.min(1, (s.until - g.time) / 3, (g.time - s.t0) / 1 + 0.2); // Auf- und Abklingen
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + s.t0;
        out.push({ x: s.x + Math.cos(a) * s.r * 0.55, y: s.y + Math.sin(a) * s.r * 0.55, lift: 8, s: s.r * 0.55, k: Math.max(0.15, k) * 0.8, fire: false, seed: Math.round(s.t0 * 7) + i * 31, screen: true });
      }
    }
    for (const m of g.mines ?? []) {
      if (m.team === this.team && inRect(m.x, m.y, pad)) out.push({ x: m.x, y: m.y, lift: 0, s: 3, k: 0.5, fire: false, seed: 1, mine: true });
    }
    // Pionier-Minen (Paket E8): eigene immer, gegnerische nur, wenn mineVisible sie sichtbar macht
    for (const m of g.sapperMines ?? []) {
      if (inRect(m.x, m.y, pad) && (m.team === this.team || mineVisible(g, this.team, m))) out.push({ x: m.x, y: m.y, lift: 0, s: 3, k: 0.5, fire: false, seed: 1, mine: true });
    }
    return out;
  },

  /** Geländehöhe, auf der ein Objekt der Tiefenliste steht: Gebäude auf ihrer tiefsten Ecke, sonst am Fußpunkt. */
  baseHeight(it) {
    const relief = this.camera.relief;
    const o = it.o;
    let x0;
    let y0;
    let x1;
    let y1;
    if (it.t === 4) {
      x0 = o.cx * TILE;
      y0 = o.cy * TILE;
      x1 = x0 + o.w * TILE;
      y1 = y0 + o.h * TILE;
    } else if (it.t === 10) {
      x0 = o.x - o.w / 2;
      x1 = o.x + o.w / 2;
      y0 = o.y - o.h / 2;
      y1 = o.y + o.h / 2;
    } else if (it.t === 0) {
      const r = Math.max(o.w, o.h) / 2;
      x0 = o.x - (o.angle ? r : o.w / 2);
      x1 = o.x + (o.angle ? r : o.w / 2);
      y0 = o.y - (o.angle ? r : o.h / 2);
      y1 = o.y + (o.angle ? r : o.h / 2);
    } else if (it.t === 5) return this.game.groundHeight(o); // Einheiten: auf Brücken die Fahrbahn
    else return relief.displayAt(o.x, o.y);
    return Math.min(relief.displayAt(x0, y0), relief.displayAt(x1, y0), relief.displayAt(x0, y1), relief.displayAt(x1, y1));
  },

  drawTerrain(ctx, R) {
    const S = this.terrain.width / W;
    const x0 = Math.max(0, R.x0);
    const y0 = Math.max(0, R.y0);
    const x1 = Math.min(W, R.x1);
    const y1 = Math.min(H, R.y1);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.drawImage(this.terrain, x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S, x0, y0, x1 - x0, y1 - y0);
  },
};
