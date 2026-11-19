// Renderer, Isometrische Ansicht, Ebenen: Bild, Boden, Markierungen, Effekte, Nebel, Lebensbalken, Bildschirmanzeigen.
// Die Objekte (Sortierung, Schatten, Einzelzeichnung) stehen in layers/isoitems.js.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (isoViewMethods).
import { buildTerrain, railList } from '../terrain.js';
import { drawStar } from '../sprites.js';
import { setIsoGround, setUprightAt, unitLift, buildingHeight, TOWN_H } from '../iso.js';
import { scarAlpha } from '../../game/scars.js';
import { seasonal } from '../season.js';
import { drawBridgeIso, drawBridgeBar, bridgeBar } from '../bridge.js';
import { drawPark, drawHouseYard } from '../maptown.js';
import { drawPaving } from '../paving.js';
import {
  drawShellIso,
  drawShellTarget,
  drawEffect,
  drawEffectUp,
  drawCrater,
  drawSmoke,
  drawSmokeScreen,
  drawDust,
  drawFire,
  drawMine,
} from '../fx.js';
import { drawCityGround } from '../citylayer.js';
import { drawWays } from '../ways.js';
import { TILE, W, H, BG, SMALL_FX, HP_OFFSET, STAR_UP, STAR_R, ISO_PAD, SC } from './consts.js';
import { updateFogLayer } from './fog.js';
import { ISO_PASSES, runPasses } from './passes.js';

const BG_RGB = [13, 17, 13];
const ISO_STAR_UP = 0; // Iso: zusätzlich angehoben (Welt-px), über dem Kopf der Figur

export const isoViewMethods = {
  /**
   * Isometrische Ansicht: Boden schräg (mit Gelände als WebGL-Netz, sonst flaches Bild), Gebäude/Bäume/Einheiten mit Höhe,
   * nach Tiefe sortiert und auf ihrer Geländehöhe; der Nebel liegt zuletzt über allem (mit Gelände ebenfalls aus WebGL).
   * Durchläufe (seit v5.64, Review-Paket P11): Boden, Bodenmarken, Objekte nach Tiefe, Flieger, Effekte, Nebel und Wetter, Balken,
   * Bildschirmanzeigen.
   */
  renderIso(f) {
    f.relief = f.cam.relief; // gesetzt nur mit WebGL-Boden
    runPasses(this, ISO_PASSES, f); // Durchläufe und Messung: layers/passes.js
  },

  /** Iso, Boden: Gelände (WebGL oder flaches Bild), Parks, Wege, Krater, Brücken, Stadtstraßen, Zone und Hot Zone. */
  isoGround(f) {
    const { ctx, g, cam, dpr, z, now, R, relief, inRect } = f;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (relief) {
      if (!this.terrainGL) this.terrainGL = seasonal(buildTerrain(g.map, 'gl'), this.season);
      const snow = this.season === 'winter' ? 1 : 0;
      const img = this.ground.render(cam, this.cssW, this.cssH, dpr, relief, this.terrainGL, this.lightVec(), now / 1000, BG_RGB, snow);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0);
    } else {
      if (!this.terrainIso) this.terrainIso = seasonal(buildTerrain(g.map, 'iso'), this.season);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      setIsoGround(ctx, cam, dpr);
      const S = this.terrainIso.width / W;
      const x0 = Math.max(0, R.x0);
      const y0 = Math.max(0, R.y0);
      const x1 = Math.min(W, R.x1);
      const y1 = Math.min(H, R.y1);
      if (x1 > x0 && y1 > y0) {
        ctx.drawImage(this.terrainIso, x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S, x0, y0, x1 - x0, y1 - y0);
      }
    }
    // Parks der Kartenstadt als Bodenbild (seit v5.23, maptown.js), vor Kratern und Stadtstraßen
    const parks = g.map.town?.parks ?? [];
    if (parks.length) {
      const rails = railList(g.map.town);
      for (const p of parks) {
        if (!inRect(p.x, p.y, p.r)) continue;
        if (relief) this.groundAt(ctx, p.x, p.y);
        else setIsoGround(ctx, cam, dpr);
        drawPark(ctx, p, z, this.season, rails);
      }
    }
    // Plätze und Bürgersteige der Karte scharf auf dem Boden (paving.js)
    setIsoGround(ctx, cam, dpr);
    drawPaving(ctx, g.map.town, 1, inRect, relief ? (x, y) => this.groundAt(ctx, x, y) : null);
    // Höfe der Altbauten (Paket „Wohnhaus“, maptown.js): Hof, Weg und Schatten unter den Einheiten
    for (const b of g.map.town?.buildings ?? []) {
      if (b.kind !== 'house' || !inRect(b.x, b.y, ISO_PAD)) continue;
      if (relief) this.groundAt(ctx, b.x, b.y);
      else setIsoGround(ctx, cam, dpr);
      drawHouseYard(ctx, b, z, this.season, cam.rot | 0);
    }
    setIsoGround(ctx, cam, dpr);
    drawWays(this, ctx, this.season); // Feldwege und Gleise scharf auf dem Boden (seit v5.31, ways.js)
    this.drawQuarterGrounds(f, true); // Regierungsviertel: Rasen, Wege, Platz (govquarter.js), unter Kratern und Einheiten
    setIsoGround(ctx, cam, dpr);
    for (const c of g.craters ?? []) {
      if (!this.scarShown(c) || !inRect(c.x, c.y, c.r + 10)) continue;
      if (relief) this.groundAt(ctx, c.x, c.y);
      else setIsoGround(ctx, cam, dpr);
      drawCrater(ctx, c, scarAlpha(c, g.time, SC.craterLife, SC.craterFade));
    }
    this.drawRubble(ctx, inRect, relief ? (x, y) => this.groundAt(ctx, x, y) : () => setIsoGround(ctx, cam, dpr)); // Schutt zerstörter Straßen (Paket „Straßen“)
    for (const b of g.bridges ?? []) if (inRect(b.x, b.y, b.len / 2 + ISO_PAD)) drawBridgeIso(ctx, cam, dpr, b, this.season); // Einheiten fahren darüber
    setIsoGround(ctx, cam, dpr);
    drawCityGround(this, ctx, f.team, f.known, inRect); // Stadt: Straßen und Grundstücke
    setIsoGround(ctx, cam, dpr);
    if (this.game.conquest) this.drawConquest(ctx, z);
    else this.drawZone(ctx, z);
    this.drawHot(ctx, z, now);
  },

  /** Iso, Bodenmarken: Reichweiten, Routen, Auswahl- und Hover-Ringe, Sammelpunkte. */
  isoMarks(f) {
    const { ctx, cam, dpr, z, v, sel, hover, relief, shown } = f;
    setIsoGround(ctx, cam, dpr);
    if (v.placement) this.drawRadii(ctx, z);
    this.drawSelectedRadii(ctx, z, v);
    this.drawAirPlanning(ctx, z);
    this.drawRoutes(ctx, sel, z);
    setIsoGround(ctx, cam, dpr);
    for (const e of this.ringed(sel)) {
      if (!shown(e)) continue;
      if (relief) this.groundAt(ctx, e.x, e.y);
      this.drawSelectRing(ctx, e, z, false);
    }
    if (hover && !sel.has(hover.id) && shown(hover)) {
      if (relief) this.groundAt(ctx, hover.x, hover.y);
      this.drawSelectRing(ctx, hover, z, true);
    }
    this.drawRallies(f);
  },

  /**
   * Iso, Effekte (seit v5.34, fx.js): Zielringe, Lichtschein und Druckringe in der Bodenebene, danach aufrecht Granaten im Bogen,
   * Feuerbälle, Leuchtspuren und Mündungsfeuer; Rauch, Feuer, Nebelwände und Minen; zuletzt das Wegziel.
   */
  isoEffects(f) {
    const { ctx, cam, dpr, z, now, v, relief } = f;
    const at = (x, y) => this.screenAt(x, y);
    const shells = [];
    setIsoGround(ctx, cam, dpr);
    for (const p of this.visibleShells(f)) {
      if (relief) this.groundAt(ctx, p.tx, p.ty);
      drawShellTarget(ctx, p, z);
      shells.push(p);
    }
    const ups = [];
    for (const e of this.visibleEffects(f)) {
      if (f.lodFx && SMALL_FX.has(e.type)) continue; // Detailstufe: Leuchtspur und Mündungsfeuer weg
      if (e.type === 'explosion' || e.type === 'muzzle') {
        if (relief) this.groundAt(ctx, e.x, e.y);
        else setIsoGround(ctx, cam, dpr);
        drawEffect(ctx, e, z, true);
      }
      ups.push(e);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of shells) drawShellIso(ctx, cam, p, at);
    for (const e of ups) drawEffectUp(ctx, e, cam, at);
    const t = now / 1000;
    for (const q of this.smokeSources(f.seen, f.shown, f.inRect, ISO_PAD)) {
      if (f.lodFx && (q.unit || q.dust)) continue; // Detailstufe: Rauch und Staub von Fahrzeugen und Baggern weg
      const p = cam.worldToScreen(q.x, q.y);
      const y = p.y - q.lift * z;
      if (q.mine) {
        drawMine(ctx, p.x, y, z * 0.6);
        continue;
      }
      if (q.screen) {
        drawSmokeScreen(ctx, p.x, y, q.s * z, q.k, t, q.seed);
        continue;
      }
      if (q.dust) {
        drawDust(ctx, p.x, y, q.s * z, q.k, t, q.seed);
        continue;
      }
      if (q.fire) drawFire(ctx, p.x, y, q.s * 0.7 * z, t, q.seed);
      drawSmoke(ctx, p.x, y, q.s * z, q.k, t, q.seed);
    }
    if (relief && v.moveMarker) this.groundAt(ctx, v.moveMarker.x, v.moveMarker.y);
    else setIsoGround(ctx, cam, dpr); // ohne Gelände: flache Bodenebene
    this.drawMoveMarker(ctx, v.moveMarker, now, z, relief ? (x, y) => this.groundAt(ctx, x, y) : null);
  },

  /** Iso, Nebel des Krieges über allem (mit Gelände aus WebGL, Wolken ziehen seit v5.49). */
  isoFog(f) {
    const { ctx, g, cam, team, dpr, now, relief } = f;
    if (f.reveal) return;
    if (relief) {
      const img = this.ground.renderFog(cam, this.cssW, this.cssH, dpr, relief, this.fogData(g.fog[team]), now / 1000);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0);
    } else {
      setIsoGround(ctx, cam, dpr);
      updateFogLayer(this.fogLayer, g.fog[team], false);
      ctx.drawImage(this.fogLayer.canvas, 0, 0, this.fogLayer.canvas.width, this.fogLayer.canvas.height, 0, 0, W, H);
    }
  },

  /** Iso, Balken und Warnzeichen aufrecht über den Objekten. */
  isoBars(f) {
    const { ctx, g, cam, team, dpr, z, sel, hover, relief, inRect, shown } = f;
    const PAD = ISO_PAD;
    const upright = (wx, wy, lift) => {
      const p = cam.worldToScreen(wx, wy);
      setUprightAt(ctx, cam, dpr, p.x, p.y - lift * z, wx, wy);
    };
    for (const u of g.units) {
      if (!u.alive || u.house || !shown(u) || !inRect(u.x, u.y, PAD)) continue;
      if (!this.barShown(f, u, f.lodUnit(u))) continue;
      upright(u.x, u.y, unitLift(u));
      this.drawHp(ctx, u.x - 12, u.y - u.def.radius - HP_OFFSET / z, 24, u.hp / u.maxHp, z);
      if (g.time - (u.caredAt ?? -9) < 0.5) this.drawCare(ctx, u.x - 12, u.y - u.def.radius - HP_OFFSET / z, z);
    }
    for (const u of g.units) {
      if (!u.alive || !u.def.hero || u.house || !shown(u) || !inRect(u.x, u.y, PAD)) continue;
      upright(u.x, u.y, unitLift(u) + ISO_STAR_UP);
      drawStar(ctx, u.x, u.y - u.def.radius - (HP_OFFSET + STAR_UP) / z, STAR_R / z, z);
    }
    for (const b of g.buildings) {
      if (!b.alive || b.team !== team || !inRect(b.x, b.y, PAD)) continue;
      if (!this.barShown(f, b)) continue;
      const bw = b.w * TILE * 0.8;
      if (relief) cam.pin(this.baseHeight({ t: 4, o: b }));
      upright(b.x, b.cy * TILE, buildingHeight(b) + 8);
      cam.unpin();
      this.drawHp(ctx, b.x - bw / 2, b.cy * TILE - 8 / z, bw, b.hp / b.maxHp, z);
    }
    for (const u of g.units) {
      if (!u.alive || u.house || u.team !== team || !inRect(u.x, u.y, PAD)) continue;
      upright(u.x, u.y, unitLift(u));
      this.drawSupply(ctx, u, sel.has(u.id) || hover === u, z);
    }
  },

  /** Iso, Bildschirmkoordinaten: Brückenbalken, Besatzung der Häuser, Platzierung (in der Bodenebene), Rahmen und Hinweis. */
  isoScreen(f) {
    const { ctx, g, cam, team, dpr, z, v, relief, inRect } = f;
    const PAD = ISO_PAD;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const b of g.bridges ?? []) {
      if (!bridgeBar(b) || !inRect(b.x, b.y, PAD)) continue;
      cam.pin(b.deckH);
      const p = cam.worldToScreen(b.x, b.y);
      cam.unpin();
      drawBridgeBar(ctx, p.x, p.y - 34 * Math.max(0.6, z), b);
    }
    for (const h of g.garrisoned ?? []) {
      if (!inRect(h.x, h.y, PAD) || !(h.team === team || f.reveal || g.sees(team, h))) continue;
      if (relief) cam.pin(this.baseHeight({ t: 0, o: h.src }));
      const p = cam.worldToScreen(h.x, h.y);
      if (h.team === team) this.drawWindows(ctx, h, cam); // Feuerbereich (seit v5.67), mit derselben Höhe wie das Haus
      cam.unpin();
      this.drawGarrison(ctx, p.x, p.y - ((TOWN_H[h.type] || 40) + 20) * z, h);
    }

    if (v.placement) {
      if (relief && Number.isFinite(v.placement.x)) this.groundAt(ctx, v.placement.x, v.placement.y);
      else setIsoGround(ctx, cam, dpr);
      this.drawPlacement(ctx, v.placement, z);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawScreenNotes(f);
  },
};
