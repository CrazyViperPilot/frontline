// Renderer, Isometrische Ansicht, Objekte: Liste der Zeichenobjekte, Schatten, Reihenfolge, Stadtteile und Einheiten einzeln.
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (isoItemMethods).
import { treeGone } from '../../game/city/clearing.js';
import { drawUnit, drawUnitSymbol, drawAnimalSide } from '../sprites.js';
import { setIsoAt, setUprightAt, drawTree, drawRock, unitLift, flying } from '../iso.js';
import { isCapital, quarterItems, drawQuarterIso } from '../govquarter.js';
import { drawTownBuilding, drawTeamBuilding, drawCar, drawBench, drawRubble, drawCrate, drawWreckBox } from '../isobuild.js';
import { parkDeco } from '../terrain.js';
import { houseYardTrees, houseYardIso } from '../maptown.js';
import { drawUnitSprite, drawWreckSprite } from '../isosprites.js';
import { drawMapCarIso, drawMapCarShadowIso, drawBenchIso, drawBenchShadowIso, drawCrateIso, drawCrateGlow, drawBaleIso, drawBaleShadowIso } from '../props.js';
import { fieldBales } from '../fields.js';
import { propLooks, drawPropIso, drawPropShadowIso, propFlagColor } from '../mapprops.js';
import { drawTreeIso, drawBushIso, drawRockIso, natureShadowIso, drawAnimalIso } from '../nature.js';
import { scarAlpha } from '../../game/scars.js';
import { setRoofSnow } from '../season.js';
import { fordPosts, drawFordPostIso } from '../bridge.js';
import { drawHouseWorksIso, drawHouseFlagIso } from '../stronghold.js';
import { drawUnitShadowIso } from '../unitpaint.js';
import { cityBuildings } from '../citylayer.js';
import { townLift } from '../townhouses.js';
import { drawWorksSteam, WORKS_KINDS } from '../works.js';
import { ISO_PAD, SC } from './consts.js';

export const isoItemMethods = {
  /**
   * Iso: Objekte mit Höhe, nach Tiefe (x + y) sortiert → { items: [{ k, t, o }], air: fliegende Einheiten (zuletzt) }.
   * t: 0 Stadtgebäude, 1 Baum, 2 Fels, 4 Militärgebäude, 5 Einheit, 6 Auto, 7 Bank, 8 Kiste, 9/10 Wrack (Fahrzeug/Gebäude),
   * 11 Tier, 12 Furtstange, 13 Busch, 14 Ballen, 15 Gruppe des Regierungsviertels, 16 Prop der Karte (Zaun, Mauer …; mapprops.js).
   */
  isoItems(f) {
    const { g, cam, team, z, relief, inRect, seen, known, shown } = f;
    const PAD = ISO_PAD;
    const items = [];
    const town = g.map.town;
    for (const b of town?.buildings ?? []) {
      if (!inRect(b.x, b.y, PAD)) continue;
      const k = cam.depth(b.x, b.y);
      items.push({ k, t: 0, o: b });
      // Hofbäume der Altbauten (maptown.js): vor den Wänden, also nach dem Haus malen
      for (const t of houseYardTrees(b, cam.rot | 0)) items.push({ k: Math.max(cam.depth(t.x, t.y), k + 0.5), t: 1, o: t });
    }
    for (const b of cityBuildings(g, team, known, (x, y) => inRect(x, y, PAD))) {
      // Dach über einem abgestellten Flugzeug (Stellplatz, seit v5.39): hinter allem darunter, nach der vordersten Ecke einsortiert
      const p = b.part;
      const k = p?.over ? Math.max(cam.depth(p.x0, p.y0), cam.depth(p.x1, p.y0), cam.depth(p.x1, p.y1), cam.depth(p.x0, p.y1)) : cam.depth(b.x, b.y);
      items.push({ k, t: 0, o: b }); // Stadt
    }
    // Bäume und Büsche: nicht auf gefällten (Räumen) oder ausgewiesenen Stadtzellen (seit v5.13)
    const gone = (x, y) => treeGone(g, x, y);
    for (const t of town?.trees ?? []) if (inRect(t.x, t.y, PAD) && !gone(t.x, t.y)) items.push({ k: cam.depth(t.x, t.y), t: 1, o: t });
    for (const t of g.map.trees ?? []) if (inRect(t.x, t.y, PAD) && !gone(t.x, t.y)) items.push({ k: cam.depth(t.x, t.y), t: 1, o: t });
    for (const t of this.deco.trees) if (inRect(t.x, t.y, PAD) && !gone(t.x, t.y)) items.push({ k: cam.depth(t.x, t.y), t: 1, o: t });
    for (const c of town?.cars ?? []) if (inRect(c.x, c.y, 60)) items.push({ k: cam.depth(c.x, c.y), t: 6, o: c });
    for (const p of town?.parks ?? []) {
      if (!inRect(p.x, p.y, p.r + PAD)) continue;
      const d = parkDeco(p);
      for (const t of d.trees) items.push({ k: cam.depth(t.x, t.y), t: 1, o: t });
      for (const b of d.benches) items.push({ k: cam.depth(b.x, b.y), t: 7, o: b });
    }
    // Heu- und Strohballen auf Weiden und Stoppelfeldern (seit v5.44, fields.js / props.js)
    for (const fl of town?.fields ?? []) {
      if (!inRect(fl.x, fl.y, Math.max(fl.w, fl.h) / 2 + 20)) continue;
      for (const b of fieldBales(fl)) {
        if ((!b.only || b.only === this.season) && inRect(b.x, b.y, 30) && !gone(b.x, b.y)) items.push({ k: cam.depth(b.x, b.y), t: 14, o: b });
      }
    }
    for (const o of this.deco.rocks) if (inRect(o.x, o.y, PAD)) items.push({ k: cam.depth(o.x, o.y), t: 2, o });
    for (const o of propLooks(g, team, this.revealAll)) if (inRect(o.x, o.y, o.single ? 80 : 40)) items.push({ k: cam.depth(o.x, o.y), t: 16, o }); // Zäune, Mauern … (mapprops.js)
    const small = z < 0.6; // weit herausgezoomt: Unterholz im Wald weglassen (winzig, unter den Kronen)
    for (const b of this.deco.bushes) if (inRect(b.x, b.y, 40) && !(small && b.under) && !gone(b.x, b.y)) items.push({ k: cam.depth(b.x, b.y), t: 13, o: b });
    for (const b of g.buildings) {
      if (!b.alive || (!g.alwaysVisible(team, b) && !known(b.x, b.y)) || !inRect(b.x, b.y, PAD)) continue;
      items.push({ k: cam.depth(b.x, b.y), t: 4, o: b });
      // Regierungsviertel: acht Gruppen um die Hauptstadt, je mit eigener Tiefe (govquarter.js)
      if (isCapital(b)) for (const o of quarterItems(g.grid, b)) items.push({ k: cam.depth(o.x, o.y), t: 15, o });
    }
    for (const m of this.crateMarks(seen, known)) if (inRect(m.x, m.y, 40)) items.push({ k: cam.depth(m.x, m.y), t: 8, o: m });
    for (const w of g.wrecks ?? []) {
      if (this.scarShown(w) && inRect(w.x, w.y, PAD)) items.push({ k: cam.depth(w.x, w.y), t: w.kind === 'building' ? 10 : 9, o: w });
    }
    for (const a of g.animals ?? []) if (inRect(a.x, a.y, 40) && seen(a.x, a.y)) items.push({ k: cam.depth(a.x, a.y), t: 11, o: a });
    for (const p of fordPosts(g.map, relief)) if (inRect(p.x, p.y, 30)) items.push({ k: cam.depth(p.x, p.y), t: 12, o: p });
    // Ansicht 3D: Brücken sind Meshes im Durchlauf „Objekte“ (render3d/bridge3d.js), nicht mehr im Durchlauf „Boden“ gemalt (isoview.js)
    if (this.bridge3dGround && relief) for (const b of g.bridges ?? []) if (inRect(b.x, b.y, b.len / 2 + ISO_PAD)) items.push({ k: cam.depth(b.x, b.y), t: 17, o: b });
    const air = [];
    for (const u of g.units) {
      if (!u.alive || u.house || !shown(u) || !inRect(u.x, u.y, PAD)) continue;
      if (flying(u)) air.push(u); // Jets am Boden (abgestellt, rollend) stehen bei den Bodeneinheiten
      else items.push({ k: cam.depth(u.x, u.y), t: 5, o: u });
    }
    items.sort((a, b) => a.k - b.k);
    return { items, air };
  },

  /** Iso, Schatten am Boden vor allen Objekten: Bäume, Büsche und Felsen in einem Zug, dann Autos, Bänke, Ballen und Props der Karte. */
  isoShadows(f, items) {
    const { ctx, cam, dpr, relief } = f;
    // Schatten der Bäume, Büsche und Felsen in einem Zug auf den Boden (seit v5.28): fallen nie über andere Dinge
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    for (const it of items) {
      if ((it.t !== 1 && it.t !== 2 && it.t !== 13) || it.o.inner || it.o.under) continue;
      if (it.t === 1 && this.treeShadow3d) continue; // Ansicht 3D mit Schattenkarte: der 3D-Baum wirft ihn selbst
      if (it.t !== 1 && this.natureShadow3d) continue; // ebenso Busch und Fels (render3d/nature3d.js)
      if (relief) cam.pin(this.baseHeight(it));
      natureShadowIso(ctx, cam, it.o, it.t);
      cam.unpin();
    }
    // Ansicht 3D ohne Schattenkarte: Fußschatten der 3D-Tiere wie drawAnimalIso
    if (this.animalShadow2d) for (const it of items) if (it.t === 11) {
      if (relief) cam.pin(this.baseHeight(it));
      const p = cam.worldToScreen(it.o.x, it.o.y);
      const z = cam.zoom;
      ctx.moveTo(p.x + 7.5 * z, p.y + 0.5 * z);
      ctx.ellipse(p.x, p.y + 0.5 * z, 7.5 * z, 3 * z, 0, 0, Math.PI * 2);
      cam.unpin();
    }
    // Ansicht 3D ohne Schattenkarte: die 3D-Kiste hat keinen gemalten Schatten im Bild mehr
    if (this.crateShadow2d) for (const it of items) if (it.t === 8) {
      if (relief) cam.pin(this.baseHeight(it));
      const p = cam.worldToScreen(it.o.x, it.o.y);
      const z = cam.zoom;
      const s = it.o.ground ? 16 : 13;
      ctx.moveTo(p.x + 9 * z * s / 16, p.y + 0.5 * z);
      ctx.ellipse(p.x, p.y + 0.5 * z, 9 * z * s / 16, 4.5 * z * s / 16, 0, 0, Math.PI * 2);
      cam.unpin();
    }
    ctx.fillStyle = 'rgba(10,18,8,0.24)';
    ctx.fill();
    // Schatten der geparkten Autos, Bänke (seit v5.43) und Ballen (seit v5.44): Umriss von oben am Boden (props.js)
    for (const it of items) {
      if (it.t !== 6 && it.t !== 7 && it.t !== 14 && it.t !== 16) continue;
      // Ansicht 3D mit Schattenkarte: das Mesh wirft ihn selbst (render3d/props3d.js; Busch und Fels der Karte: nature3d.js)
      if ((it.t === 16 && (it.o.kind === 'bush' || it.o.kind === 'rock') ? this.natureShadow3d && this.props3dOn : this.propShadow3d)) continue;
      if (relief) cam.pin(this.baseHeight(it));
      if (it.t === 6) drawMapCarShadowIso(ctx, cam, it.o, dpr);
      else if (it.t === 7) drawBenchShadowIso(ctx, cam, it.o, dpr);
      else if (it.t === 16) drawPropShadowIso(ctx, cam, it.o, this.season, dpr); // scharf nach links unten (mapprops.js)
      else drawBaleShadowIso(ctx, cam, it.o, dpr);
      cam.unpin();
    }
  },

  /** Iso: die Objekte nach Tiefe, jedes eben auf seiner Geländehöhe (Gebäude auf der tiefsten Ecke, damit nichts schwebt). */
  isoObjects(f, items) {
    const { ctx, g, cam, team, dpr, z, now, relief } = f;
    const [ia, , ic] = cam.isoMatrix(1); // Blickrichtung der Tiere im Bild
    const glow = 0.6 + 0.4 * Math.sin(now / 350);
    for (const it of items) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (relief) cam.pin(this.baseHeight(it));
      if (it.t === 0) this.drawTownItemIso(f, it.o);
      else if (it.t === 1) {
        // 3D (render3d/trees3d.js, nur im Durchlauf „Objekte“ der Ansicht 3D), sonst gemalt (nature.js), sonst Ersatz
        if (!this.tree3d?.(it.o) && !drawTreeIso(ctx, cam, it.o, this.season)) drawTree(ctx, cam, it.o, this.season);
      }
      else if (it.t === 2) { if (!this.rock3d?.(it.o) && !drawRockIso(ctx, cam, it.o, this.season)) drawRock(ctx, cam, it.o); } // 3D: render3d/nature3d.js
      else if (it.t === 13) { if (!this.bush3d?.(it.o)) drawBushIso(ctx, cam, it.o, this.season); }
      // Auto, Bank, Ballen, Prop der Karte, Kiste: 3D (render3d/props3d.js über prop3d, crate3d, nur im Durchlauf „Objekte“ der Ansicht 3D), sonst gemalt (props.js, seit v5.43)
      else if (it.t === 6) { if (!this.prop3d?.(6, it.o) && !drawMapCarIso(ctx, cam, it.o, this.season)) drawCar(ctx, cam, it.o); }
      else if (it.t === 7) { if (!this.prop3d?.(7, it.o) && !drawBenchIso(ctx, cam, it.o, this.season)) drawBench(ctx, cam, it.o); }
      else if (it.t === 14) { if (!this.prop3d?.(14, it.o)) drawBaleIso(ctx, cam, it.o, this.season); }
      else if (it.t === 16) { if (!this.prop3d?.(16, it.o)) drawPropIso(ctx, cam, it.o, this.season, propFlagColor(g, it.o)); } // Zäune, Mauern … (mapprops.js)
      else if (it.t === 8) {
        const s = it.o.ground ? 16 : 13;
        if (this.crate3d?.(it.o.x, it.o.y, s, 0)) drawCrateGlow(ctx, cam, it.o.x, it.o.y, s, it.o.ground ? glow : 0); // Schimmer bleibt gemalt
        else if (!drawCrateIso(ctx, cam, it.o.x, it.o.y, s, 0, it.o.ground ? glow : 0)) drawCrate(ctx, cam, it.o.x, it.o.y, s, 0, it.o.ground ? glow : 0);
      }
      else if (it.t === 12) { if (!this.ford3d?.(it.o)) drawFordPostIso(ctx, cam, it.o); } // 3D: render3d/bridge3d.js
      else if (it.t === 17) this.bridge3d?.(it.o); // Brücke (nur Ansicht 3D, sonst im Durchlauf „Boden“ gemalt)
      else if (it.t === 15) { if (!this.quarter3d?.(it.o)) drawQuarterIso(ctx, cam, it.o, g.teams[it.o.b.team].color, this.season); } // Regierungsviertel (3D: render3d/gov3d.js)
      else if (it.t === 11) {
        const a = it.o;
        const p = cam.worldToScreen(a.x, a.y);
        if (!this.animal3d?.(a, now) && !drawAnimalIso(ctx, cam, a, p, now)) drawAnimalSide(ctx, a, p.x, p.y, z * 1.1, ia * Math.cos(a.angle) + ic * Math.sin(a.angle) >= 0);
      } else if (it.t === 9 || it.t === 10) {
        const w = it.o;
        const fade = scarAlpha(w, g.time, SC.wreckLife, SC.wreckFade);
        ctx.globalAlpha = fade;
        if (it.t === 10) {
          const rb = { x: w.x, y: w.y, w: w.w, h: w.h, kind: w.small ? 'wall' : 'wreck', hgt: w.small ? 18 : 36 };
          if (!this.ruin3d?.(rb, !w.small, fade)) drawRubble(ctx, cam, rb, !w.small); // 3D: render3d/rubble3d.js (sinkt statt zu verblassen)
        }
        else if (!this.wreck3d?.(w, fade) && !drawWreckSprite(ctx, cam, w, cam.worldToScreen(w.x, w.y))) drawWreckBox(ctx, cam, w);
        ctx.globalAlpha = 1;
      }
      else if (it.t === 4) {
        const b = it.o;
        setRoofSnow(this.season === 'winter'); // Winter: Schnee auf Dächern und Wällen (milbuild.js)
        // 3D (nur im Durchlauf „Objekte“ der Ansicht 3D): Regierungsgebäude render3d/gov3d.js, übrige Militärgebäude render3d/mil3d.js, sonst gemalt
        if (!(isCapital(b) && this.hall3d?.(b, g.teams[b.team].color)) && !this.mil3d?.(b, g.teams[b.team].color)) drawTeamBuilding(ctx, cam, b, g.teams[b.team].color);
        setRoofSnow(false);
        if (!b.built && b.team === team) {
          const p = cam.worldToScreen(b.x, b.y);
          setUprightAt(ctx, cam, dpr, p.x, p.y, b.x, b.y);
          this.drawSiteMarks(ctx, b, z);
        }
      } else {
        this.drawUnitIsoAt(f, it.o);
        if (it.o.crate) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (!this.crate3d?.(it.o.x, it.o.y, 10, unitLift(it.o) + 14) && !drawCrateIso(ctx, cam, it.o.x, it.o.y, 10, unitLift(it.o) + 14)) drawCrate(ctx, cam, it.o.x, it.o.y, 10, unitLift(it.o) + 14); // Kiste auf dem Rücken
        }
      }
      cam.unpin();
    }
  },

  /** Iso: Gebäude der Stadt bzw. Kartenstadt (Ruine als Schutt, ausgebautes Haus mit Sandsäcken und Fahne, Rauch bei Schaden). */
  drawTownItemIso(f, o) {
    const { ctx, g, cam, known } = f;
    const hs = g.houseBySrc?.get(o);
    if (hs && hs.ruined && known(hs.x, hs.y)) {
      if (!this.ruin3d?.(o, false)) drawRubble(ctx, cam, o); // 3D: render3d/rubble3d.js
      return;
    }
    setRoofSnow(this.season === 'winter'); // Winter: Schnee auf den Dächern der Stadt
    const fort = hs && this.fortShown(hs, known) ? hs : null; // besetztes oder ausgebautes Haus (seit v5.48, stronghold.js)
    const body = fort ? houseYardIso(o, cam.rot | 0) : null; // Altbau mit Hof: Säcke vor der Hofmauer, Fahne an ihrer Ecke
    const fort3d = !!(fort && !body && this.fort3d?.(fort)); // Ausbauten als Mesh (render3d/mil3d.js, nur Ansicht 3D; Altbau mit Hof bleibt gemalt)
    if (fort && !fort3d) drawHouseWorksIso(ctx, cam, fort, 'back', body); // Draht hinter dem Haus
    // 3D (render3d/town3d.js house3d, nur im Durchlauf „Objekte“ der Ansicht 3D): Stadthaus 1 × 1, Werk oder Großbau (bigpart, uni) als Mesh, sonst gemalt
    const mesh = this.house3d?.(o) ?? false;
    if (mesh && WORKS_KINDS.includes(o.kind)) drawWorksSteam(ctx, cam, o); // Dampf der Kühltürme bleibt gemalt (Effekt)
    if (!mesh && (o.part?.t !== 'tree' || !(this.tree3d?.(o.part) || drawTreeIso(ctx, cam, o.part, this.season)))) drawTownBuilding(ctx, cam, o, this.season); // Bäume der Großbauten gemalt (nature.js)
    if (fort) {
      if (!fort3d) drawHouseWorksIso(ctx, cam, fort, 'front', body); // Sandsäcke, MG-Nest, Draht davor
      if (fort.occupants.length && fort.team >= 0) drawHouseFlagIso(ctx, cam, fort, g.teams[fort.team]?.color ?? '#888', f.now / 1000, body);
    }
    setRoofSnow(false);
    if (o.damage > 0.25) {
      // beschädigtes Stadtgebäude (Stadt-Teil): Rauch über dem Dach
      const p = cam.worldToScreen(o.x, o.y);
      const k = cam.zoom;
      const up = o.kind === 'town' ? townLift(o.ck, o.level) - 52 : 0; // 1 × 1: Rauch ab dem Dach (seit v5.14)
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = `rgba(40,36,34,${Math.min(0.75, o.damage).toFixed(2)})`;
      for (const [dx, dy, r] of [[0, -46, 10], [6, -60, 13], [-4, -76, 16]]) {
        ctx.beginPath();
        ctx.arc(p.x + dx * k, p.y + (dy - up) * k, r * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  /** Iso: eine Einheit mit Schatten am Boden (gemaltes Modell, sonst einfache Form aufrecht). */
  drawUnitIsoAt(f, u) {
    const { ctx, g, cam, dpr, z, now } = f;
    const p = cam.worldToScreen(u.x, u.y);
    const lift = unitLift(u);
    const sc = 1.35;
    if (f.lodUnit(u)) {
      // Detailstufe: Symbol in Teamfarbe. Bodeneinheiten liegen auf dem Boden, Luftfahrzeuge schweben (Richtung auf dem Bild)
      const color = g.teams[u.team].color;
      const a = u.angle || 0;
      if (flying(u)) {
        const q = cam.worldToScreen(u.x + Math.cos(a) * 20, u.y + Math.sin(a) * 20);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawUnitSymbol(ctx, p.x, p.y - cam.heightPx(lift), Math.atan2(q.y - p.y, q.x - p.x), color, 1, true);
      } else {
        setIsoAt(ctx, cam, dpr, p.x, p.y - cam.heightPx(lift), u.x, u.y, sc);
        drawUnitSymbol(ctx, u.x, u.y, a, color, z * sc, false);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    const aim = this.aimOf(u);
    // 3D (render3d/renderer3d.js unit3d): Körper als Mesh in der Szene, hier nur noch Rotoren und Nachbrenner
    const shown = this.unit3d?.(f, u, aim, lift) ?? false; // false | true | 'painted' (Mesh, Schatten aber gemalt: Soldaten)
    const mesh = !!shown;
    // Schatten am Boden: Umriss des Modells (seit v5.27, unitpaint.js), sonst Ellipse; 3D mit Schattenkarte: das Mesh wirft ihn selbst
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!(shown === true && this.shadow3d) && !drawUnitShadowIso(ctx, cam, u, p, dpr, now)) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, u.def.radius * z * (u.def.air ? 1.5 : 1.2), u.def.radius * z * (u.def.air ? 0.7 : 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (drawUnitSprite(ctx, cam, u, { x: p.x, y: p.y }, aim, lift, now, !mesh) || mesh) return;
    setIsoAt(ctx, cam, dpr, p.x, p.y - cam.heightPx(lift), u.x, u.y, sc);
    drawUnit(ctx, u, g.teams[u.team].color, z * sc, aim, now, true);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
};
