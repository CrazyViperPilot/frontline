// Minimap (docs/archiv/verlauf.md §5 render/minimap.js): Gelände, Zone, Gebäude und Einheiten als Punkte, Nebel, Kamerarahmen.
// Zeichnet in Weltkoordinaten (Transformation Welt → Canvas) und nutzt dieselben Sichtregeln wie der Hauptrenderer.
// Paket „Minimap isometrisch“: in der Iso-Ansicht mit derselben Drehung und halben Höhe wie die Kamera (Raute, Box 2 : 1), damit
// Bildschirm und Minimap gleich ausgerichtet sind (rechts = rechts); der Kamerarahmen ist dann ein gerades Rechteck.
import { BALANCE } from '../data/balance.js';
import { buildTerrain } from './terrain.js';
import { drawMapTownMini } from './maptown.js';
import { seasonal } from './season.js';
import { makeFogLayer, updateFogLayer } from './renderer.js';
import { hexA, CRATE_MARK } from './sprites.js';
import { KIND_ID } from '../data/citykinds.js';
import { CITY } from '../data/city.js';

const TILE = BALANCE.map.tile;
const W = BALANCE.map.width;
const H = BALANCE.map.height;
const DEFAULT_SIZE = 180;
const RAIL_GREY = [66, 70, 74]; // Gleise der Stadt: dunkelgrau, sichtbar wie Straßen (Paket „Import“)

export class Minimap {
  constructor(canvas, game, camera, team) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.camera = camera;
    this.team = team;
    this.revealAll = false; // wie Renderer.revealAll, von main.js mitsetzen
    this.terrain = seasonal(buildTerrain(game.map), game.weather?.season ?? 'summer'); // Herbst- und Winterfarben
    this.fogLayer = makeFogLayer(game.fog[team], false); // ohne Wolken, weicher Rand wie im Bild
    this.dpr = 1;
    this.maxDpr = 2; // Obergrenze der Pixeldichte (Bildauflösung, wie render/layers/core.js; setMaxDpr)
    this.cssW = DEFAULT_SIZE;
    this.cssH = DEFAULT_SIZE;
    this.resize();
  }

  /** Obergrenze der Pixeldichte setzen (Bildauflösung) und die Minimap sofort neu aufbauen. */
  setMaxDpr(max) {
    this.maxDpr = max;
    this.resize();
  }

  /** Canvas-Pufferung an CSS-Größe und DPR anpassen (höchstens maxDpr). */
  resize() {
    const cssW = this.canvas.clientWidth || DEFAULT_SIZE;
    const cssH = this.canvas.clientHeight || DEFAULT_SIZE;
    const dpr = Math.min(this.maxDpr, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
  }

  /**
   * Abbildung Welt → Minimap (CSS-Pixel) als [a, b, c, d, e, f] wie ctx.setTransform: 2D genordet über die ganze Box; isometrisch wie die
   * Kamera (isoMatrix mit Drehung, ohne Zoom), die Raute der Karte mittig in die Box eingepasst.
   */
  view() {
    if (!this.camera.iso) return [this.cssW / W, 0, 0, this.cssH / H, 0, 0];
    const [a, b, c, d] = this.camera.isoMatrix(1);
    const xs = [];
    const ys = [];
    for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) {
      xs.push(a * x + c * y);
      ys.push(b * x + d * y);
    }
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const s = Math.min(this.cssW / (x1 - x0), this.cssH / (y1 - y0));
    return [s * a, s * b, s * c, s * d, (this.cssW - s * (x0 + x1)) / 2, (this.cssH - s * (y0 + y1)) / 2];
  }

  /** Minimap-Position (CSS-Pixel im Canvas) → Weltkoordinate (Umkehrung von view, auch isometrisch). */
  toWorld(mx, my) {
    const [a, b, c, d, e, f] = this.view();
    const det = a * d - b * c;
    return { x: (d * (mx - e) - c * (my - f)) / det, y: (-b * (mx - e) + a * (my - f)) / det };
  }

  render() {
    // Iso-Ansicht: Box 2 : 1 (CSS .mm.iso); die neue Größe übernimmt resize() im selben Bild
    this.canvas.parentElement?.classList.toggle('iso', !!this.camera.iso);
    if (this.canvas.clientWidth && (this.canvas.clientWidth !== this.cssW || this.canvas.clientHeight !== this.cssH)) {
      this.resize();
    }
    const g = this.game;
    const ctx = this.ctx;
    const team = this.team;
    const reveal = this.revealAll;
    const known = (x, y) => reveal || g.isExplored(team, x, y);
    const seen = (x, y) => reveal || g.isVisible(team, x, y);
    const [ma, mb, mc, md, me, mf] = this.view();
    const px = 1 / Math.sqrt(Math.abs(ma * md - mb * mc)); // Weltlänge von 1 CSS-Pixel (isometrisch gemittelt)

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0d0a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // auch die Ecken neben der Raute
    const r = this.dpr;
    ctx.setTransform(r * ma, r * mb, r * mc, r * md, r * me, r * mf);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, this.terrain.width, this.terrain.height, 0, 0, W, H);
    drawMapTownMini(ctx, g.map.town, g.weather?.season); // Parks und Gebäude der Karte (seit v5.23 nicht mehr im Geländebild)

    // Zone
    const zn = g.zone;
    const cq = g.conquest;
    if (cq) {
      // Eroberung: Gebiete in der Farbe des Besitzers (grau = neutral), Zonenrand, Viertelgrenzen
      for (const f of cq.flags) {
        ctx.fillStyle = hexA(f.owner >= 0 ? g.teams[f.owner].color : '#e8ece8', f.owner >= 0 ? 0.4 : 0.1);
        ctx.fillRect(f.x - cq.size / 2 + 12 * px, f.y - cq.size / 2 + 12 * px, cq.size - 24 * px, cq.size - 24 * px);
      }
      ctx.strokeStyle = hexA('#e8ece8', 0.9);
      ctx.lineWidth = 1.5 * px;
      ctx.strokeRect(cq.x0, cq.y0, 2 * cq.half, 2 * cq.half);
      ctx.beginPath();
      ctx.moveTo(zn.x, 0);
      ctx.lineTo(zn.x, cq.y0);
      ctx.moveTo(zn.x, cq.y0 + 2 * cq.half);
      ctx.lineTo(zn.x, H);
      ctx.moveTo(0, zn.y);
      ctx.lineTo(cq.x0, zn.y);
      ctx.moveTo(cq.x0 + 2 * cq.half, zn.y);
      ctx.lineTo(W, zn.y);
      ctx.strokeStyle = hexA('#e8ece8', 0.55);
      ctx.lineWidth = 1 * px;
      ctx.stroke();
    } else {
      const col = zn.owner >= 0 ? g.teams[zn.owner].color : '#e8ece8';
      ctx.beginPath();
      ctx.arc(zn.x, zn.y, zn.r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(col, zn.owner >= 0 ? 0.25 : 0.1);
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.9);
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
    }

    // Stadt: Zonen blass, Gebäude kräftig in Teamfarbe (Bild je Team, neu nur wenn sich Gebiet oder Zellen ändern)
    for (const c of g.city ?? []) {
      const img = this.cityImage(c, g.teams[c.team].color);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, c.cols, c.rows, 0, 0, c.cols * c.cell, c.rows * c.cell);
      ctx.imageSmoothingEnabled = true;
    }

    // Hot Zone
    const hz = g.hot;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
    ctx.fillStyle = hexA('#ff7a1a', 0.35);
    ctx.fill();
    ctx.strokeStyle = hexA('#ffb060', 0.9);
    ctx.lineWidth = 1.2 * px;
    ctx.stroke();

    // Gebäude (eigene immer, fremde wenn erkundet); mindestens ca. 2,5 CSS-Pixel groß
    for (const b of g.buildings) {
      if (!b.alive || (!g.alwaysVisible(team, b) && !known(b.x, b.y))) continue;
      const w = Math.max(b.w * TILE, 2.5 * px);
      const h = Math.max(b.h * TILE, 2.5 * px);
      ctx.fillStyle = g.teams[b.team].color;
      ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
    }

    // Einheiten (fremde nur in Sicht)
    for (const u of g.units) {
      if (!u.alive || (u.team !== team && !reveal && !(seen(u.x, u.y) && g.sees(team, u)))) continue;
      ctx.fillStyle = u.team === team ? '#eaf6ff' : g.teams[u.team].color;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 1.6 * px, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reveal) {
      updateFogLayer(this.fogLayer, g.fog[team], false);
      ctx.drawImage(this.fogLayer.canvas, 0, 0, this.fogLayer.canvas.width, this.fogLayer.canvas.height, 0, 0, W, H);
    }

    // Brücken (Kartenmerkmal, auch im Nebel): intakt hell, zerstört rot gestrichelt
    ctx.lineCap = 'round';
    for (const b of g.bridges ?? []) {
      ctx.strokeStyle = b.broken ? '#e0553a' : '#efe4c2';
      ctx.lineWidth = 2.6 * px;
      ctx.setLineDash(b.broken ? [2 * px, 2.5 * px] : []);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Versorgungskisten am Boden (Lagebild: Fundorte von der Karte, danach zuletzt gesehen), auch im Nebel
    const crates = reveal ? (g.crates ?? []).filter((c) => c.state === 'ground') : [...(g.crateSeen?.[team]?.values() ?? [])];
    ctx.fillStyle = CRATE_MARK;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 0.8 * px;
    for (const c of crates) {
      const s = 3.6 * px;
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
      ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s);
    }

    // Alarmrotte (Paket „Alarmrotte“): Ort des letzten Alarmstarts des eigenen Teams, CITY.air.scramble.mark s lang ein pulsierender Ring
    const qm = g.teams[team]?.qraMark;
    if (qm && g.time - qm.at < CITY.air.scramble.mark) {
      const f = ((g.time - qm.at) % 1.2) / 1.2;
      ctx.strokeStyle = `rgba(255,80,60,${(1 - f).toFixed(2)})`;
      ctx.lineWidth = 1.6 * px;
      ctx.beginPath();
      ctx.arc(qm.x, qm.y, (4 + f * 10) * px, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Kamerarahmen
    const Q = this.camera.visibleQuad();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2 * px;
    ctx.beginPath();
    ctx.moveTo(Q[0].x, Q[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(Q[i].x, Q[i].y);
    ctx.closePath();
    ctx.stroke();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Kleines Bild (eine Zelle = ein Pixel) von Gebiet und Gebäuden einer Stadt. */
  cityImage(c, color) {
    this.cityImgs ??= new Map();
    let e = this.cityImgs.get(c.team);
    const key = `${c.ver}`;
    if (e && e.key === key) return e.canvas;
    if (!e) {
      const canvas = document.createElement('canvas');
      canvas.width = c.cols;
      canvas.height = c.rows;
      e = { canvas, ctx: canvas.getContext('2d'), key: '' };
      this.cityImgs.set(c.team, e);
    }
    e.key = key;
    const im = e.ctx.createImageData(c.cols, c.rows);
    const n = parseInt(color.slice(1), 16);
    const [R, G, B] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const RAIL = KIND_ID.rail;
    for (let i = 0; i < c.claim.length; i++) {
      const rail = c.kind[i] === RAIL; // Gleis: dunkelgrau statt Teamfarbe
      const a = rail ? 200 : c.level[i] && c.kind[i] !== 1 ? 230 : c.kind[i] ? 140 : 0;
      if (!a) continue;
      const [r, g, b] = rail ? RAIL_GREY : [R, G, B];
      im.data[i * 4] = r;
      im.data[i * 4 + 1] = g;
      im.data[i * 4 + 2] = b;
      im.data[i * 4 + 3] = a;
    }
    e.ctx.putImageData(im, 0, 0);
    return e.canvas;
  }
}
