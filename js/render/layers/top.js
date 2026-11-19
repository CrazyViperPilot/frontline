// Renderer, 2D-Ansicht von oben: Durchläufe Boden, Objekte, Effekte, Nebel, Himmel, Lebensbalken, Bildschirmanzeigen.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (topMethods).
import { treeGone } from '../../game/city/clearing.js';
import { drawUnit, drawUnitSymbol, drawBuilding, drawCrate as drawCrateTop, drawAnimalTop, drawStar } from '../sprites.js';
import { flying } from '../iso.js';
import { drawCityHallTop } from '../cityhall.js';
import { isCapital, drawQuarterGround, drawQuarterTop } from '../govquarter.js';
import { drawCrateTop as drawCratePainted } from '../props.js';
import { drawAnimalTopP } from '../nature.js';
import { drawMilTop } from '../milbuild.js';
import { reliefOf } from '../../game/relief.js';
import { setRoofSnow } from '../season.js';
import { drawWeather } from '../weatherfx.js';
import { drawMood } from '../mood.js';
import { drawBridgeTop, drawBridgeBar, bridgeBar, fordPosts, drawFordPostTop } from '../bridge.js';
import { drawMapTown2D, drawMapCars2D } from '../maptown.js';
import { drawPaving } from '../paving.js';
import { drawHouseWorksTop, drawHouseFlagTop } from '../stronghold.js';
import { drawUnitTop } from '../unitpaint.js';
import { drawShell, drawEffect, drawSmoke, drawSmokeScreen, drawDust, drawFire, drawMine } from '../fx.js';
import { drawCityGround, drawCityTop, drawCityRoofs, drawCityBadges } from '../citylayer.js';
import { drawWays } from '../ways.js';
import { TILE, W, H, BG, SMALL_FX, HP_OFFSET, STAR_UP, STAR_R } from './consts.js';
import { updateFogLayer } from './fog.js';
import { TOP_PASSES, runPasses } from './passes.js';

// Turm und Waffe zeichnen (aimOf, nur Darstellung): Drehtempo in rad/s (Fahrzeuge, Infanterie) und Haltezeit nach Zielverlust in ms
const AIM_TURN = 4;
const AIM_TURN_INF = 10;
const AIM_HOLD = 1500;

export const topMethods = {
  /** 2D-Ansicht von oben: Durchläufe Boden, Objekte, Effekte, Nebel und Wetter, Balken, Bildschirmanzeigen. */
  renderTop(f) {
    const { ctx, dpr } = f;
    // Bildschirm: Hintergrund; danach Welt-Transformation (Kamera)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    this.worldTransform(f);
    ctx.imageSmoothingEnabled = true;
    runPasses(this, TOP_PASSES, f); // Durchläufe und Messung: layers/passes.js
  },

  /** 2D, Boden: Gelände, Wege, Kartenstadt, Brücken, Krater, Stadt (Straßen, Dächer, Schilder), Natur, Zone und Hot Zone. */
  topGround(f) {
    const { ctx, g, team, z, now, inRect, known } = f;
    this.drawTerrain(ctx, f.R);
    drawPaving(ctx, g.map.town, 1, inRect); // Plätze und Bürgersteige scharf über dem Geländebild (paving.js)
    drawWays(this, ctx, this.season); // Feldwege und Gleise scharf über dem Geländebild (seit v5.31, ways.js)
    // Kartenstadt (seit v5.23 gemalt, nicht mehr im Geländebild): Parks, Gebäude, Bänke, Stadtbäume, Autos (maptown.js)
    setRoofSnow(this.season === 'winter');
    const ruined = (b) => {
      const h = g.houseBySrc?.get(b);
      return !!h?.ruined && known(h.x, h.y);
    };
    drawMapTown2D(ctx, g.map.town, inRect, z, this.season, (x, y) => treeGone(g, x, y), ruined);
    setRoofSnow(false);
    // besetzte und ausgebaute Häuser (seit v5.48, stronghold.js): Sandsäcke, MG-Nest, Stacheldraht und Fahne in Teamfarbe
    for (const h of g.houses ?? []) {
      if (h.ruined || !inRect(h.x, h.y, (h.pw + h.ph) / 2) || !this.fortShown(h, known)) continue;
      drawHouseWorksTop(ctx, h, z);
      if (h.occupants.length && h.team >= 0) drawHouseFlagTop(ctx, h, g.teams[h.team]?.color ?? '#888', now / 1000);
    }
    for (const b of g.bridges ?? []) if (inRect(b.x, b.y, b.len / 2 + 40)) drawBridgeTop(ctx, b, this.season); // über dem Fluss, unter allem anderen
    for (const p of fordPosts(g.map, reliefOf(g.map))) if (inRect(p.x, p.y, 10)) drawFordPostTop(ctx, p); // Furtstangen
    this.drawQuarterGrounds(f, false); // Regierungsviertel: Rasen, Wege, Platz (govquarter.js)
    this.drawRuins(ctx, f.R, known);
    this.drawScars(ctx, inRect, z);
    drawCityGround(this, ctx, team, known, inRect); // Stadt: Straßen und Grundstücke
    drawMapCars2D(ctx, g.map.town, inRect, z, this.season); // Autos der Karte auf den Straßen (seit v5.23 sichtbar, seit v5.43 gemalt)
    drawCityTop(this, ctx, team, known, inRect); // Stadt: Dächer
    this.drawNatureTop(ctx, inRect, z); // Felsen, Büsche und Bäume von oben (seit v5.28 gemalt, nicht mehr im Geländebild)
    drawCityBadges(this, ctx, team, known, inRect, false); // Stadt: Schilder (Funktion, privat/kommerziell)
    if (this.game.conquest) this.drawConquest(ctx, z);
    else this.drawZone(ctx, z);
    this.drawHot(ctx, z, now);
  },

  /** 2D, Objekte: Reichweiten und Routen, Gebäude, Kisten, Tiere, Auswahl, Sammelpunkte, Einheiten (Flieger zuletzt), Wegziel. */
  topObjects(f) {
    const { ctx, g, team, z, now, v, sel, hover, inRect, seen, known, shown } = f;
    if (v.placement) this.drawRadii(ctx, z);
    this.drawSelectedRadii(ctx, z, v);
    this.drawAirPlanning(ctx, z);
    this.drawRoutes(ctx, sel, z);

    // Regierungsviertel um die Hauptstädte (govquarter.js): unter allen Gebäuden und Einheiten
    for (const b of g.buildings) {
      if (isCapital(b) && inRect(b.x, b.y, 150) && (g.alwaysVisible(team, b) || known(b.x, b.y))) drawQuarterTop(ctx, g.grid, b, g.teams[b.team].color, z, this.season);
    }
    for (const b of g.buildings) {
      if (!b.alive || (!g.alwaysVisible(team, b) && !known(b.x, b.y))) continue;
      if (!inRect(b.x, b.y, (Math.max(b.w, b.h) * TILE) / 2 + (b.main ? 16 : 0))) continue;
      if (isCapital(b)) drawCityHallTop(ctx, b, g.teams[b.team].color, z, this.season); // Hauptstadt: Regierungsgebäude (cityhall.js)
      else drawBuilding(ctx, b, g.teams[b.team].color, z, drawMilTop(ctx, b, g.teams[b.team].color, z)); // Bild aus milbuild.js, darüber Anzeigen
      if (!b.built && b.team === team) this.drawSiteMarks(ctx, b, z);
    }
    const glow = 0.6 + 0.4 * Math.sin(now / 350);
    for (const m of this.crateMarks(seen, known)) {
      if (inRect(m.x, m.y, 30) && !drawCratePainted(ctx, m.x, m.y, m.ground ? 16 : 13, z, m.ground ? glow : 0)) drawCrateTop(ctx, m.x, m.y, m.ground ? 16 : 13, z, m.ground ? glow : 0);
    }
    for (const a of g.animals ?? []) if (inRect(a.x, a.y, 20) && seen(a.x, a.y) && !drawAnimalTopP(ctx, a, z, now)) drawAnimalTop(ctx, a, z); // nur in Sicht

    // Auswahl und Hover (unter den Einheiten); Besatzer eines Hauses: Rahmen ums Haus
    for (const e of this.ringed(sel)) if (shown(e)) this.drawSelectRing(ctx, e, z, false);
    if (hover && !sel.has(hover.id) && shown(hover)) this.drawSelectRing(ctx, hover, z, true);
    this.drawRallies(f);

    for (const air of [false, true]) {
      // Hubschrauber zuletzt: sie fliegen über allem
      if (air) drawCityRoofs(this, ctx, team, known, inRect); // Dächer der Stellplätze über den abgestellten Flugzeugen (seit v5.39)
      for (const u of g.units) {
        if (!u.alive || u.house || flying(u) !== air || !shown(u) || !inRect(u.x, u.y, Math.max(30, u.def.radius * 1.6))) continue; // Jets am Boden mit den Bodeneinheiten
        const aim = this.aimOf(u);
        if (f.lodUnit(u)) drawUnitSymbol(ctx, u.x, u.y, u.angle || 0, g.teams[u.team].color, z, air); // Detailstufe: Symbol statt Modell
        else if (!drawUnitTop(ctx, u, z, aim, now)) drawUnit(ctx, u, g.teams[u.team].color, z, aim, now); // gemalt (seit v5.27), sonst einfache Form
        if (u.crate && !drawCratePainted(ctx, u.x + 4, u.y - 6, 10, z)) drawCrateTop(ctx, u.x + 4, u.y - 6, 10, z); // Kiste auf dem Rücken
      }
    }

    this.drawMoveMarker(ctx, v.moveMarker, now, z);
  },

  /** Boden der Regierungsviertel um die Hauptstädte (govquarter.js): 2D in Weltkoordinaten, Iso mit drei Ecken aufs Gelände gelegt. */
  drawQuarterGrounds(f, iso) {
    const { ctx, g, cam, team, dpr, inRect, known } = f;
    for (const b of g.buildings) {
      if (!isCapital(b) || !inRect(b.x, b.y, 200) || (!g.alwaysVisible(team, b) && !known(b.x, b.y))) continue;
      drawQuarterGround(ctx, cam, b, g.teams[b.team].color, this.season, dpr, iso);
    }
  },

  /** Sammelpunkte gewählter eigener Gebäude. */
  drawRallies(f) {
    for (const id of f.sel) {
      const b = f.g.getEntity(id);
      if (b && b.kind === 'building' && b.team === f.team) this.drawRally(f.ctx, b, f.z);
    }
  },

  /**
   * Gezeichnete Blickrichtung von Turm bzw. Waffe (Bogenmaß) oder null (= wie der Rumpf). Nur Darstellung, die Simulation zielt
   * sofort: Der Turm dreht mit begrenzter Geschwindigkeit zum Ziel (AIM_TURN rad/s, Infanterie AIM_TURN_INF), hält nach dem Verlust
   * des Ziels AIM_HOLD ms die letzte Richtung (ein kurzer Zielwechsel oder eine Lücke zwischen zwei Schüssen lässt das Rohr nicht
   * zurückspringen) und dreht danach weich zum Rumpf zurück. Vorher sprang das Rohr bei jedem Zielwechsel (Zucken).
   */
  aimOf(u) {
    if (!(u.def.range > 0)) return null;
    const t = u.targetId ? this.game.getEntity(u.targetId) : null;
    const want = t ? Math.atan2(t.y - u.y, t.x - u.x) : null;
    const now = performance.now();
    const hull = u.angle ?? 0;
    const map = (this.aimState ??= new WeakMap());
    let st = map.get(u);
    if (!st) {
      if (want === null) return null;
      st = { a: hull, t: now, hold: 0, last: want };
      map.set(u, st);
    }
    const dt = Math.min(0.1, Math.max(0, (now - st.t) / 1000));
    st.t = now;
    let goal;
    if (want !== null) {
      goal = want;
      st.last = want;
      st.hold = now + AIM_HOLD;
    } else if (now < st.hold) goal = st.last;
    else goal = hull;
    const turn = (u.def.armor === 'inf' ? AIM_TURN_INF : AIM_TURN) * dt;
    const diff = Math.atan2(Math.sin(goal - st.a), Math.cos(goal - st.a));
    st.a += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;
    // zurück in Fahrtrichtung angekommen: wieder „wie der Rumpf“ (der Turm folgt dem Rumpf ohne Verzögerung)
    if (want === null && now >= st.hold && Math.abs(Math.atan2(Math.sin(hull - st.a), Math.cos(hull - st.a))) < 0.02) {
      map.delete(u);
      return null;
    }
    return st.a;
  },

  /** Effekte, die das eigene Team sieht (im Ausschnitt, eigene oder in Sicht). */
  *visibleEffects(f) {
    const { g, team, inRect, seen } = f;
    for (const e of g.effects) {
      if (!inRect(e.x, e.y, 120) && !inRect(e.x2 ?? e.x, e.y2 ?? e.y, 120)) continue;
      if (e.team !== -1 && e.team !== team && !seen(e.x, e.y) && !seen(e.x2 ?? e.x, e.y2 ?? e.y)) continue;
      yield e;
    }
  },

  /** Granaten, die das eigene Team sieht (Flug oder Ziel im Ausschnitt). */
  *visibleShells(f) {
    for (const p of f.g.projectiles) {
      if (!p.alive || !f.shown(p)) continue;
      if (!f.inRect(p.x, p.y, 80) && !f.inRect(p.tx, p.ty, 80)) continue;
      yield p;
    }
  },

  /** 2D, Effekte: Granaten, Einschläge und Mündungsfeuer, Rauch, Feuer, Nebelwände, Minen. */
  topEffects(f) {
    const { ctx, z, now } = f;
    for (const p of this.visibleShells(f)) drawShell(ctx, p, z);
    for (const e of this.visibleEffects(f)) if (!(f.lodFx && SMALL_FX.has(e.type))) drawEffect(ctx, e, z);
    const t = now / 1000;
    for (const q of this.smokeSources(f.seen, f.shown, f.inRect, 120)) {
      if (f.lodFx && (q.unit || q.dust)) continue; // Detailstufe: Rauch und Staub von Fahrzeugen und Baggern weg
      if (q.mine) {
        drawMine(ctx, q.x, q.y, 1);
        continue;
      }
      if (q.screen) {
        drawSmokeScreen(ctx, q.x, q.y, q.s, q.k, t, q.seed);
        continue;
      }
      if (q.dust) {
        drawDust(ctx, q.x, q.y, q.s, q.k, t, q.seed);
        continue;
      }
      if (q.fire) drawFire(ctx, q.x, q.y, q.s * 0.7, t, q.seed);
      drawSmoke(ctx, q.x, q.y, q.s, q.k, t, q.seed);
    }
  },

  /** 2D, Nebel des Krieges (nicht im Debug „alles zeigen“). */
  topFog(f) {
    const { ctx, g, cam, team, dpr, now } = f;
    if (f.reveal) return;
    if (cam.relief && this.ground) {
      // mit WebGL dieselben Wolken und glatten Ränder wie isometrisch, flach von oben (seit v5.49)
      const img = this.ground.renderFog(cam, this.cssW, this.cssH, dpr, cam.relief, this.fogData(g.fog[team]), now / 1000, true);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0);
    } else {
      updateFogLayer(this.fogLayer, g.fog[team], false);
      ctx.drawImage(this.fogLayer.canvas, 0, 0, this.fogLayer.canvas.width, this.fogLayer.canvas.height, 0, 0, W, H);
    }
  },

  /** Regen, Schnee und Nebel, dann die Lichtstimmung über der Welt (Bildschirmkoordinaten, beide Ansichten). */
  drawSky(f) {
    const { ctx, dpr } = f;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWeather(ctx, f.g.weather, this.cssW, this.cssH, f.now, f.cam);
    drawMood(ctx, this.mood, this.cssW, this.cssH); // Lichtstimmung (mood.js)
  },

  /** Lebensbalken bei Auswahl, Hover oder Schaden. */
  barShown(f, e, lod = false) {
    return f.sel.has(e.id) || (!lod && f.hover === e) || e.hp < e.maxHp; // Detailstufe: ohne Hover, nur gewählt oder beschädigt
  },

  /** 2D, Balken: Lebensbalken, Heilkreuz, Kommandeursstern, Vorrat und Warnzeichen, Platzierung. */
  topBars(f) {
    const { ctx, g, team, z, sel, hover, inRect, shown } = f;
    for (const u of g.units) {
      if (!u.alive || u.house || !shown(u) || !inRect(u.x, u.y, Math.max(30, u.def.radius * 1.6))) continue;
      if (!this.barShown(f, u, f.lodUnit(u))) continue;
      const bw = 24;
      this.drawHp(ctx, u.x - bw / 2, u.y - u.def.radius - HP_OFFSET / z, bw, u.hp / u.maxHp, z);
      if (g.time - (u.caredAt ?? -9) < 0.5) this.drawCare(ctx, u.x - bw / 2, u.y - u.def.radius - HP_OFFSET / z, z);
    }
    for (const u of g.units) {
      if (u.alive && u.def.hero && !u.house && shown(u) && inRect(u.x, u.y, 30)) drawStar(ctx, u.x, u.y - u.def.radius - (HP_OFFSET + STAR_UP) / z, STAR_R / z, z);
    }
    for (const b of g.buildings) {
      if (!b.alive || b.team !== team || !inRect(b.x, b.y, 40)) continue;
      if (!this.barShown(f, b)) continue;
      const bw = b.w * TILE * 0.8;
      this.drawHp(ctx, b.x - bw / 2, b.cy * TILE - 8 / z, bw, b.hp / b.maxHp, z);
    }

    // Vorrat und Warnzeichen (nur eigene Einheiten: Vorrat des Gegners ist unbekannt)
    for (const u of g.units) {
      if (!u.alive || u.house || u.team !== team || !inRect(u.x, u.y, 30)) continue;
      this.drawSupply(ctx, u, sel.has(u.id) || hover === u, z);
    }

    if (f.v.placement) this.drawPlacement(ctx, f.v.placement, z);
  },

  /** 2D, Bildschirmkoordinaten: Brückenbalken, Besatzung der Häuser, dann Auswahlrahmen und Hinweis (drawScreenNotes). */
  topScreen(f) {
    const { ctx, g, cam, team, dpr, inRect } = f;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const b of g.bridges ?? []) {
      if (!bridgeBar(b) || !inRect(b.x, b.y, 60)) continue;
      const p = cam.worldToScreen(b.x, b.y);
      drawBridgeBar(ctx, p.x, p.y - 34, b);
    }
    for (const h of g.garrisoned ?? []) {
      if (!inRect(h.x, h.y, 200) || !(h.team === team || f.reveal || g.sees(team, h))) continue;
      const p = cam.worldToScreen(h.x, h.y - h.ph / 2);
      if (h.team === team) this.drawWindows(ctx, h, cam); // Feuerbereich (seit v5.67)
      this.drawGarrison(ctx, p.x, p.y - 12, h);
    }
    this.drawScreenNotes(f);
  },

  /** Bildschirmkoordinaten (beide Ansichten): Auswahlrahmen und Hinweistext zur Platzierung. */
  drawScreenNotes(f) {
    const { ctx, v } = f;
    if (v.dragBox) this.drawDragBox(ctx, v.dragBox);
    if (v.placement && !v.placement.ok && v.placement.reason && Number.isFinite(v.placement.x)) {
      this.drawNote(ctx, f.cam.worldToScreen(v.placement.x, v.placement.y), v.placement.reason);
    }
  },
};
