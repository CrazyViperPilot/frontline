// Kern des Renderers: die Klasse Renderer (Konstruktor, Pixeldichte, Größe, ein Bild, gemeinsame Werte eines Bildes,
// Welt-Transformation). Die Zeichenebenen hängen als Methodengruppen an (Object.assign, Muster wie js/ai/ai.js).
import { buildTerrain } from '../terrain.js';
import { setMilWalls } from '../milbuild.js';
import { seasonal } from '../season.js';
import { setMapTown } from '../maptown.js';
import { beginTownFrame } from '../townhouses.js';
import { MAX_DPR_SHARP } from './consts.js';
import { makeFogLayer } from './fog.js';
import { topMethods } from './top.js';
import { reliefMethods } from './relief.js';
import { isoViewMethods } from './isoview.js';
import { isoItemMethods } from './isoitems.js';
import { worldMethods } from './world.js';
import { zoneMethods } from './zones.js';
import { radiiMethods } from './radii.js';
import { garrisonMethods } from './garrison.js';
import { overlayMethods } from './overlays.js';

// Detailstufen beim Herauszoomen (nur Darstellung, Simulation unberührt): unter diesem Zoom zeichnet der Renderer Einheiten als
// Symbol statt als Modell, lässt kleine Effekte weg und zeigt Lebensbalken nur für gewählte oder beschädigte Einheiten.
// Maßstab: Infanterie (Radius LOD_REF_R, units.js) ist 2D unter 0,8 und in Iso unter 0,6 kleiner als ~10 Bildschirmpixel.
// Größere Einheiten wechseln nach ihrem Radius (Radius × Zoom unter LOD_ZOOM × LOD_REF_R), Iso-Modelle sind 1,35× größer.
const LOD_ZOOM = { top: 0.8, iso: 0.6 };
const LOD_REF_R = 6;

export class Renderer {
  constructor(canvas, game, camera, team) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.camera = camera;
    this.team = team;
    this.revealAll = false; // Debug: kein Nebel, alle Gegner sichtbar
    this.mood = null; // Lichtstimmung (mood.js), main.js setzt sie nach der Wahl im Startmenü
    this.perf = null; // Messanzeige (ui/perfmeter.js, F3): Zeiten je Ebene; null = keine Messung
    this.season = game.weather?.season ?? 'summer'; // Herbst- und Winterfarben (season.js)
    this.terrain = seasonal(buildTerrain(game.map), this.season);
    this.terrainIso = null; // Boden ohne Gebäude/Bäume, erst beim ersten Wechsel in die isometrische Ansicht
    this.terrainGL = null; // dasselbe ohne Gelände-Schattierung: Textur des WebGL-Bodens
    this.ground = null; // WebGL-Boden (ground.js), wenn die Karte Gelände hat und WebGL verfügbar ist
    this.fogBytes = null; // Nebel je Zelle (0 frei … 255 schwarz) für den WebGL-Nebel
    this.deco = null; // Bäume und Felsen der Hindernisse (isometrisch)
    this.fogLayer = makeFogLayer(game.fog[team]);
    this.dpr = 1;
    this.maxDpr = MAX_DPR_SHARP; // Obergrenze der Pixeldichte: „Scharf“ 2, „Leistung“ 1 (setMaxDpr, Einstellung Bildauflösung)
    this.cssW = 0;
    this.cssH = 0;
    this.resize();
  }

  /** Obergrenze der Pixeldichte setzen (Bildauflösung, nur Darstellung) und das Bild sofort neu aufbauen. */
  setMaxDpr(max) {
    this.maxDpr = max;
    this.resize();
  }

  /** Canvas an die CSS-Größe anpassen (DPR höchstens maxDpr) und Kamera-Ansicht setzen. */
  resize() {
    const cssW = this.canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800);
    const cssH = this.canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600);
    const dpr = Math.min(this.maxDpr, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.camera.resize(cssW, cssH);
  }

  /**
   * Ein Bild. view = { selection: Set<id>, placement, dragBox, hoverId, moveMarker } – alle Felder optional.
   * placement: { type, x, y, ok, reason, cells?: [{cx, cy, ok}] }; dragBox in Bildschirmkoordinaten;
   * moveMarker: { x, y, t } mit t = performance.now() beim Klick (Marker verblasst nach 0,8 s).
   */
  render(view = null) {
    const pf = this.perf; // Messanzeige: Zeichenzeit des ganzen Bildes
    const t0 = pf ? performance.now() : 0;
    const v = view || {};
    if (this.canvas.clientWidth && (this.canvas.clientWidth !== this.cssW || this.canvas.clientHeight !== this.cssH)) {
      this.resize();
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const g = this.game;
    this.syncRelief();
    beginTownFrame(this.dpr); // Stadtgebäude: Maßstab der Bilder, Zeitbudget fürs Nachmalen (townhouses.js, spritecache.js)
    setMapTown(g.map); // Kartenstadt: Felder für die Gehöfte (maptown.js)
    setMilWalls(g.buildings); // Mauern und Tore: Verbindungen zu den Nachbarn (milbuild.js)
    if (!this.deco) this.deco = this.buildDeco();
    const f = this.frameOf(v, now);
    if (this.camera.iso) this.renderIso(f);
    else this.renderTop(f);
    if (pf) pf.addRender(performance.now() - t0);
  }

  /**
   * Gemeinsame Werte eines Bildes für alle Durchläufe (seit v5.64, Review-Paket P11): Ansicht v, Zeit, Kamera, Sichtregeln.
   * inRect(x, y, pad): im sichtbaren Ausschnitt; seen/known: in Sicht bzw. erkundet; shown(e): Objekt für das eigene Team sichtbar.
   */
  frameOf(v, now) {
    const g = this.game;
    const cam = this.camera;
    const team = this.team;
    const reveal = this.revealAll;
    const R = cam.visibleRect();
    const seen = (x, y) => reveal || g.isVisible(team, x, y);
    return {
      v,
      now,
      ctx: this.ctx,
      g,
      cam,
      team,
      dpr: this.dpr,
      z: cam.zoom,
      reveal,
      R,
      sel: v.selection instanceof Set ? v.selection : new Set(v.selection || []),
      hover: v.hoverId ? g.getEntity(v.hoverId) : null,
      inRect: (x, y, pad = 0) => x >= R.x0 - pad && x <= R.x1 + pad && y >= R.y0 - pad && y <= R.y1 + pad,
      lodFx: cam.zoom < (cam.iso ? LOD_ZOOM.iso : LOD_ZOOM.top), // kleine Effekte weglassen (Detailstufe)
      lodUnit: (u) => (u.def.radius ?? LOD_REF_R) * cam.zoom < (cam.iso ? LOD_ZOOM.iso : LOD_ZOOM.top) * LOD_REF_R, // Einheit als Symbol
      seen,
      known: (x, y) => reveal || g.isExplored(team, x, y),
      shown: (e) => e.team === team || reveal || (seen(e.x, e.y) && g.sees(team, e)),
    };
  }

  /** 2D: Welt-Transformation der Kamera (Weltkoordinaten → Canvas). */
  worldTransform(f) {
    const { ctx, cam, dpr, z } = f;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, (cam.viewW / 2 - cam.x * z) * dpr, (cam.viewH / 2 - cam.y * z) * dpr);
  }
}

// Zeichenebenen als Methoden einhängen (Muster wie js/ai/ai.js); Reihenfolge ohne Bedeutung, die Namen sind eindeutig
Object.assign(Renderer.prototype, topMethods, reliefMethods, isoViewMethods, isoItemMethods, worldMethods, zoneMethods, radiiMethods, garrisonMethods, overlayMethods);
