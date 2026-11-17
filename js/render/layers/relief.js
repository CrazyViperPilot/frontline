// Renderer, Boden und Relief: Höhenbild nachführen, Zeichnen auf dem Boden (Bogen, Linie, Vieleck), Welt ↔ Bildschirm,
// Lichtrichtung, Nebel-Bytes für den WebGL-Nebel, aufrechte Zeichnung, Bäume und Felsen (2D und Deko für Iso).
// Methoden der Klasse Renderer (layers/core.js), eingehängt über Object.assign (reliefMethods).
import { treeGone } from '../../game/city/clearing.js';
import { hashXY } from '../color.js';
import { makeRng } from '../../core/rng.js';
import { setIsoGround, setUprightAt } from '../iso.js';
import { drawBaleTop } from '../props.js';
import { fieldBales } from '../fields.js';
import { drawTreeTop, drawBushTop, drawRockTop, forestKind, forestSpecies } from '../nature.js';
import { reliefOf, RELIEF } from '../../game/relief.js';
import { getGround, LIGHT_ELEV } from '../ground.js';
import { bridgeUnder } from '../../game/river.js';
import { W, H } from './consts.js';
import { blur121, nextFogStamp } from './fog.js';

export const reliefMethods = {
  /**
   * Gelände der Karte: mit WebGL steht die isometrische Ansicht auf echten Hügeln (Kamera hebt Punkte an), ohne WebGL bleibt
   * der Boden flach und das Gelände nur aufgemalt. Der Editor ändert das Gelände laufend, darum bei jedem Bild.
   */
  syncRelief() {
    const relief = reliefOf(this.game.map);
    this.ground = relief ? getGround() : null;
    this.camera.relief = this.ground ? relief : null;
  },

  /** Bodenmarkierungen folgen dem Gelände (isometrisch mit WebGL-Boden): dann Pfade in Bildschirmkoordinaten. */
  draping() {
    return this.camera.iso && !!this.camera.relief;
  },

  /** Kreis auf dem Boden als Pfad: flach per arc, mit Gelände als Linienzug in Bildschirmkoordinaten (Transformation dpr). */
  groundArc(ctx, x, y, r) {
    ctx.beginPath();
    if (!this.draping()) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      return;
    }
    const cam = this.camera;
    const n = Math.max(24, Math.min(256, Math.round(r / 30)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = cam.worldToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  },

  /** Strecke auf dem Boden (wie groundArc): flach gerade, mit Gelände alle 48 px ein Stützpunkt. Ohne beginPath. */
  groundLine(ctx, x1, y1, x2, y2) {
    if (!this.draping()) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      return;
    }
    const cam = this.camera;
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 48));
    for (let i = 0; i <= n; i++) {
      const p = cam.worldToScreen(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
  },

  /** Geschlossenes Vieleck auf dem Boden (wie groundLine, ein durchgehender Linienzug, füllbar). Ohne beginPath. */
  groundPoly(ctx, pts) {
    if (!this.draping()) {
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      return;
    }
    const cam = this.camera;
    let first = true;
    for (let s = 0; s < pts.length; s++) {
      const [x1, y1] = pts[s];
      const [x2, y2] = pts[(s + 1) % pts.length];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 48));
      for (let i = 0; i < n; i++) {
        const p = cam.worldToScreen(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n);
        if (first) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        first = false;
      }
    }
    ctx.closePath();
  },

  /** Bodenebene für eine Markierung am Weltpunkt (isometrisch auf dessen Geländehöhe). */
  groundAt(ctx, x, y) {
    const cam = this.camera;
    const br = this.game.bridges?.length ? bridgeUnder(this.game, x, y) : null; // auf einer Brücke: ihre Fahrbahn
    if (br) cam.pin(br.deckH);
    else cam.pinAt(x, y);
    setIsoGround(ctx, cam, this.dpr);
    cam.unpin();
  },

  /** Iso: Bildschirmpunkt des Bodens am Weltpunkt (Gelände, auf einer Brücke ihre Fahrbahn). */
  screenAt(x, y) {
    const cam = this.camera;
    const br = this.game.bridges?.length ? bridgeUnder(this.game, x, y) : null;
    if (!br) return cam.worldToScreen(x, y);
    cam.pin(br.deckH);
    const p = cam.worldToScreen(x, y);
    cam.unpin();
    return p;
  },

  /** Lichtrichtung (Welt, z nach oben) für den WebGL-Boden: kommt von rechts oben im Bild, wie die Schatten der Gebäude. */
  lightVec() {
    const [, , rc, rd] = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][this.camera.rot];
    // Bildschirm „rechts oben“ entspricht der Weltrichtung (−rc, −rd); etwas nach rechts gedreht, damit Kämme nicht flach wirken
    const a = Math.atan2(-rd, -rc) + 0.35;
    const k = Math.sqrt(1 - LIGHT_ELEV * LIGHT_ELEV);
    return [Math.cos(a) * k, Math.sin(a) * k, LIGHT_ELEV];
  },

  /**
   * Nebel für den WebGL-Nebel: je Zelle zwei Bytes (in Sicht, erkundet: 0 oder 255), weichgezeichnet (seit v5.49). Der Shader macht
   * daraus glatte Ränder ohne die Treppen der 64-px-Zellen; Sicht und Erkundet getrennt, damit am Rand zum Unerforschten kein Streifen
   * „erkundet“ entsteht.
   */
  fogData(fog) {
    const n = fog.cols * fog.rows;
    const out = this.fogOut;
    if (out && fog.version !== undefined && out.src === fog && out.ver === fog.version) return out; // unverändert: kein Neuladen
    if (!this.fogBytes || this.fogBytes.length !== 2 * n) {
      this.fogBytes = new Uint8Array(2 * n);
      this.fogTmp = new Uint8Array(2 * n);
    }
    const d = this.fogBytes;
    const vis = fog.visible;
    const exp = fog.explored;
    for (let i = 0; i < n; i++) {
      d[2 * i] = vis[i] ? 255 : 0;
      d[2 * i + 1] = exp[i] ? 255 : 0;
    }
    blur121(d, this.fogTmp, fog.cols, fog.rows, 2);
    this.fogOut = { cols: fog.cols, rows: fog.rows, data: d, src: fog, ver: fog.version, stamp: nextFogStamp() };
    return this.fogOut;
  },

  /** Isometrisch: danach zeichnen Weltkoordinaten (x, y) aufrecht um den Bildschirmpunkt dieses Weltpunkts, `lift` Pixel höher. */
  uprightAtWorld(ctx, wx, wy, lift) {
    const cam = this.camera;
    const p = cam.worldToScreen(wx, wy);
    setUprightAt(ctx, cam, this.dpr, p.x, p.y - lift * cam.zoom, wx, wy);
  },

  /** Bäume und Felsen für Wald- und Felshindernisse (deterministisch aus der Karte). */
  /** 2D: Felsen, Büsche und Bäume von oben (gemalt, nature.js); fehlt ein Bild noch, eine einfache Krone. Gefällte Zellen frei. */
  drawNatureTop(ctx, inRect, z) {
    const g = this.game;
    const season = this.season;
    const gone = (x, y) => treeGone(g, x, y);
    for (const f of g.map.town?.fields ?? []) {
      if (!inRect(f.x, f.y, Math.max(f.w, f.h) / 2 + 20)) continue;
      for (const b of fieldBales(f)) if ((!b.only || b.only === season) && inRect(b.x, b.y, 20) && !gone(b.x, b.y)) drawBaleTop(ctx, b, z, season); // Ballen (seit v5.44)
    }
    for (const o of this.deco.rocks) if (inRect(o.x, o.y, o.r + 30)) drawRockTop(ctx, o, season, z);
    for (const b of this.deco.bushes) if (inRect(b.x, b.y, 24) && !gone(b.x, b.y)) drawBushTop(ctx, b, season, z);
    for (const list of [g.map.trees ?? [], this.deco.trees]) {
      for (const t of list) {
        if (!inRect(t.x, t.y, 40) || gone(t.x, t.y) || drawTreeTop(ctx, t, season, z)) continue;
        ctx.fillStyle = season === 'winter' ? '#6d6259' : '#355a2c';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  buildDeco() {
    const trees = [];
    const rocks = [];
    const bushes = [];
    for (const o of this.game.map.obstacles) {
      if (Math.round(o.r) % 2 === 0) {
        const rng = makeRng((o.x * 31 + o.y * 17 + o.r) >>> 0);
        // Seit v5.28 dichter (Kronen schließen sich) und nach Waldart gemischt (Laub-, Nadel- oder Mischwald, nature.js);
        // gleichmäßig verteilt (Spirale mit Zufall), damit keine großen Lücken entstehen
        const kind = forestKind(o);
        const n = Math.max(6, Math.round((o.r * o.r) / 430));
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + rng.next() * 0.6;
          const d = Math.min(o.r * 0.88, Math.sqrt((i + 0.5) / n) * o.r * 0.86 + (rng.next() - 0.5) * 7);
          // inner: Schatten fällt auf den Waldboden und wird nicht eigens gezeichnet (Leistung)
          trees.push({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, r: 12 + rng.next() * 8, sp: forestSpecies(kind, rng.next()), inner: d < o.r * 0.6 });
        }
        // Unterholz zwischen den Stämmen: Farne und junge Fichten (nur Optik)
        const under = Math.round(n * 0.25);
        for (let i = 0; i < under; i++) {
          const a = rng.next() * Math.PI * 2;
          const d = Math.sqrt(rng.next()) * o.r * 0.8;
          const k = rng.next() < (kind === 'laub' ? 0.8 : 0.45) ? 'fern' : 'sapling';
          bushes.push({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, r: 6 + rng.next() * 3, k, under: true });
        }
        // Büsche am Waldrand (nur Optik, blockieren nicht)
        const edge = Math.max(3, Math.round(o.r / 12));
        for (let i = 0; i < edge; i++) {
          const a = rng.next() * Math.PI * 2;
          const d = o.r * (0.95 + rng.next() * 0.2);
          bushes.push({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, r: 8 + rng.next() * 4 });
        }
      } else rocks.push(o);
    }
    // Einzelne Büsche neben verstreuten Bäumen (fest nach Lage des Baums)
    for (const t of this.game.map.trees ?? []) {
      const h = hashXY(t.x, t.y);
      if (h % 100 >= 30) continue;
      const a = ((h >>> 7) % 628) / 100;
      bushes.push({ x: t.x + Math.cos(a) * t.r * 1.5, y: t.y + Math.sin(a) * t.r * 1.5, r: 8 + ((h >>> 12) % 40) / 10 });
    }
    const relief = reliefOf(this.game.map);
    if (relief) {
      // Geröll auf steilen Hängen und Gipfeln (nur Optik, dort ist es ohnehin unpassierbar), fest nach Lage
      for (let y = 24; y < H; y += 48) {
        for (let x = 24; x < W; x += 48) {
          const h = hashXY(x, y);
          if (h % 100 >= 12) continue;
          const px = x + ((h >>> 8) % 40) - 20;
          const py = y + ((h >>> 16) % 40) - 20;
          if (relief.heightAt(px, py) < RELIEF.water + 30) continue; // nicht im See oder am Uferrand
          const gr = relief.gradAt(px, py);
          if (Math.hypot(gr.x, gr.y) > RELIEF.rock || (relief.heightAt(px, py) > RELIEF.peak * 0.85 && relief.heightAt(px, py) <= RELIEF.peak + 60)) {
            rocks.push({ x: px, y: py, r: 11 + ((h >>> 4) % 12) });
          }
        }
      }
    }
    return { trees, rocks, bushes: relief ? bushes.filter((b) => relief.heightAt(b.x, b.y) > RELIEF.water + 4 && relief.heightAt(b.x, b.y) < RELIEF.peak) : bushes };
  },
};
