// Zellenraster für Terrain, Gebäude und Tore. Kein DOM.
import { BALANCE } from '../data/balance.js';
import { RELIEF } from './relief.js';

const RELIEF_WATER = RELIEF.water;

// Props (Deko und Gelände, game/props.js) sperren je Bewegungsklasse: Bits im Feld `prop` je Zelle.
export const PROP_INF = 1; // sperrt Infanterie
export const PROP_VEH = 1 << 1; // sperrt Radfahrzeuge
export const PROP_CRUSH = 1 << 2; // sperrt auch gepanzerte Kettenfahrzeuge (nicht überfahrbar)
const PROP_ALL = PROP_INF | PROP_VEH | PROP_CRUSH;

/**
 * Bewegungsklassen: Wegsuche und Bewegung bekommen statt des Teams einen „Mover“ = Team + Klasse × 16. Eine reine Teamzahl
 * (0 … 15, wie bisher überall) ist Klasse 0: jedes Prop sperrt (Bauplatz, KI-Prüfungen, Kartenprüfung). Gemeinsame Wege und
 * lange Suchen (pathplan.js) vergleichen den Mover, also teilen nur Einheiten derselben Klasse einen Weg.
 */
export const MOVE_CLASS = { all: 0, inf: 1, veh: 2, crush: 3 };
const TEAM_BITS = 4;
const TEAM_MASK = (1 << TEAM_BITS) - 1;
const CLASS_BLOCK = [PROP_ALL, PROP_INF, PROP_VEH, PROP_CRUSH]; // Bits, die die Klasse sperren

/** Mover einer Bodeneinheit: Infanterie, Radfahrzeug oder gepanzertes Kettenfahrzeug (def.crush: überfährt kleine Props). */
export function moverOf(u) {
  const cls = u.def.armor === 'inf' ? MOVE_CLASS.inf : u.def.crush ? MOVE_CLASS.crush : MOVE_CLASS.veh;
  return u.team + (cls << TEAM_BITS);
}

/** Team eines Movers (negative Werte bleiben, wie sie sind). */
export const moverTeam = (who) => (who > TEAM_MASK ? who & TEAM_MASK : who);

/** Prop-Bits, die einen Mover sperren. */
export const moverBlock = (who) => (who > TEAM_MASK ? CLASS_BLOCK[who >> TEAM_BITS] : PROP_ALL);
const RELIEF_STEEP = RELIEF.steep;

/**
 * Zellen einer Geraden zwischen zwei Zellen (Bresenham, inklusive Endpunkte). Ungültige Koordinaten (NaN, unendlich) liefern keine Zellen,
 * Bruchzahlen werden gerundet: sonst träfe die Schleife das Ende nie und liefe endlos (das Spiel fröre ein).
 */
export function lineCells(c0, r0, c1, r1) {
  if (![c0, r0, c1, r1].every(Number.isFinite)) return [];
  c0 = Math.round(c0);
  r0 = Math.round(r0);
  c1 = Math.round(c1);
  r1 = Math.round(r1);
  const out = [];
  const dc = Math.abs(c1 - c0);
  const sc = c0 < c1 ? 1 : -1;
  const dr = -Math.abs(r1 - r0);
  const sr = r0 < r1 ? 1 : -1;
  let err = dc + dr;
  let c = c0;
  let r = r0;
  for (;;) {
    out.push([c, r]);
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 >= dr) {
      err += dr;
      c += sc;
    }
    if (e2 <= dc) {
      err += dc;
      r += sr;
    }
  }
  return out;
}

export class Grid {
  constructor(cols, rows, tile) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    const n = cols * rows;
    this.terrain = new Uint8Array(n); // 1 = Hindernis
    this.struct = new Int32Array(n); // Gebäude-ID oder 0
    this.gateTeam = new Int8Array(n).fill(-1); // Team des Tors oder -1
    this.cost = null; // Zusatzkosten je Zelle in Zehnteln (Hänge, rasterizeRelief); null = überall 0
    this.ford = null; // 1 = Furt (seichtes Wasser, passierbar); null = keine Furten
    this.deck = null; // 1 = unter einer Brückenfahrbahn (river.createBridges); null = keine Brücken
    this.lock = null; // Eroberung (conquest.bindLock): Viertel je Zelle (Team-Index, 9 = ohne Spieler, -1 = Konfliktzone); null = keine Sperre
    this.lockOpen = null; // je Viertel: true = Sperre gefallen
    this.prop = null; // Sperr-Bits der Props je Zelle (PROP_INF, PROP_VEH, PROP_CRUSH; game/props.js); null = keine Props
    this.propH = null; // Sichthöhe der Props je Zelle (Nebel, fog.js; Höhe wie Gelände); null = keine sichtsperrenden Props
  }

  idx(c, r) {
    return r * this.cols + c;
  }

  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  /** Weltkoordinate -> Zellenindex (Spalte oder Zeile). */
  toCell(v) {
    return Math.floor(v / this.tile);
  }

  /** Weltmitte einer Zellenkoordinate. */
  center(c) {
    return c * this.tile + this.tile / 2;
  }

  /** Begehbar für `who` (Team oder Mover, siehe moverOf): im Feld, kein Terrain, kein sperrendes Prop, kein Gebäude oder eigenes Tor. */
  passable(c, r, who) {
    if (!this.inBounds(c, r)) return false;
    const i = this.idx(c, r);
    if (this.terrain[i]) return false;
    if (this.prop !== null && this.prop[i] & moverBlock(who)) return false;
    const team = moverTeam(who);
    if (this.lock !== null && team >= 0) {
      const q = this.lock[i]; // fremdes Viertel mit stehender Sperre: nicht begehbar
      if (q >= 0 && q !== team && !this.lockOpen[q]) return false;
    }
    if (this.struct[i] === 0) return true;
    return this.gateTeam[i] === team;
  }

  /** Frei für Bau: im Feld, kein Terrain, kein sperrendes Prop, kein Gebäude. */
  free(c, r) {
    if (!this.inBounds(c, r)) return false;
    const i = this.idx(c, r);
    return this.terrain[i] === 0 && this.struct[i] === 0 && (this.prop === null || this.prop[i] === 0);
  }

  /** Markiert Zellen als Hindernis, deren Mittelpunkt im Kreis liegt. */
  rasterizeObstacles(obstacles) {
    const t = this.tile;
    for (const o of obstacles) {
      const c0 = Math.max(0, Math.floor((o.x - o.r) / t));
      const c1 = Math.min(this.cols - 1, Math.floor((o.x + o.r) / t));
      const r0 = Math.max(0, Math.floor((o.y - o.r) / t));
      const r1 = Math.min(this.rows - 1, Math.floor((o.y + o.r) / t));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dx = this.center(c) - o.x;
          const dy = this.center(r) - o.y;
          if (dx * dx + dy * dy <= o.r * o.r) this.terrain[this.idx(c, r)] = 1;
        }
      }
    }
  }

  /** Markiert Zellen als Hindernis, deren Mittelpunkt im Rechteck {x,y,w,h} (Mitte, Größe) liegt. */
  rasterizeRects(rects) {
    const t = this.tile;
    for (const o of rects) {
      const c0 = Math.max(0, Math.floor((o.x - o.w / 2) / t));
      const c1 = Math.min(this.cols - 1, Math.floor((o.x + o.w / 2) / t));
      const r0 = Math.max(0, Math.floor((o.y - o.h / 2) / t));
      const r1 = Math.min(this.rows - 1, Math.floor((o.y + o.h / 2) / t));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dx = Math.abs(this.center(c) - o.x);
          const dy = Math.abs(this.center(r) - o.y);
          if (dx <= o.w / 2 && dy <= o.h / 2) this.terrain[this.idx(c, r)] = 1;
        }
      }
    }
  }

  /**
   * Gelände (relief.js): zu steile Hänge und Seen sind Hindernisse; Hänge kosten die Wegsuche mehr (Talwege werden bevorzugt,
   * am Hang sind Einheiten langsamer). relief = null (flache Karte) ändert nichts.
   * fords: Furten {x, y, r}: seichtes Wasser darin (bis river.fordDepth unter dem Spiegel, nicht zu steil) bleibt passierbar,
   * kostet die Wegsuche river.fordCost mehr und ist in `ford` markiert (Bodeneinheiten langsamer, movement.js).
   */
  rasterizeRelief(relief, fords = []) {
    if (!relief) return;
    const k = BALANCE.slope.pathCost * BALANCE.path.costDiv;
    const R = BALANCE.river;
    this.cost = new Uint8Array(this.cols * this.rows);
    this.ford = fords.length ? new Uint8Array(this.cols * this.rows) : null;
    const t = this.tile;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.idx(c, r);
        const slope = relief.cellSlope(c, r);
        if (relief.cellBlocked(c, r)) {
          const h = relief.cellHeight(c, r);
          const x = this.center(c);
          const y = this.center(r);
          const shallow = h < RELIEF_WATER && h >= RELIEF_WATER - R.fordDepth && slope <= RELIEF_STEEP;
          if (shallow && fords.some((f) => (f.x - x) ** 2 + (f.y - y) ** 2 <= (f.r + t / 2) ** 2)) {
            this.ford[i] = 1;
            this.cost[i] = Math.min(255, R.fordCost + Math.round(slope * k));
          } else this.terrain[i] = 1;
        } else this.cost[i] = Math.min(255, Math.round(slope * k));
      }
    }
  }

  /** Furtzelle (seichtes Wasser, passierbar, langsam)? */
  isFord(c, r) {
    return !!this.ford && this.inBounds(c, r) && this.ford[this.idx(c, r)] === 1;
  }

  /** Bäume blockieren die Zelle, in der ihr Stamm steht. */
  rasterizeTrees(trees) {
    for (const t of trees) {
      const c = this.toCell(t.x);
      const r = this.toCell(t.y);
      if (this.inBounds(c, r)) this.terrain[this.idx(c, r)] = 1;
    }
  }

  /** Setzt den Fußabdruck eines Gebäudes (Tore zusätzlich mit Teamkennung). */
  occupy(b) {
    const isGate = !!(b.def && b.def.gate);
    for (let r = b.cy; r < b.cy + b.h; r++) {
      for (let c = b.cx; c < b.cx + b.w; c++) {
        if (!this.inBounds(c, r)) continue;
        const i = this.idx(c, r);
        this.struct[i] = b.id;
        if (isGate) this.gateTeam[i] = b.team;
      }
    }
  }

  /** Löscht den Fußabdruck eines Gebäudes (nur Zellen, die ihm gehören). */
  release(b) {
    for (let r = b.cy; r < b.cy + b.h; r++) {
      for (let c = b.cx; c < b.cx + b.w; c++) {
        if (!this.inBounds(c, r)) continue;
        const i = this.idx(c, r);
        if (this.struct[i] === b.id) {
          this.struct[i] = 0;
          this.gateTeam[i] = -1;
        }
      }
    }
  }
}

/**
 * Unterschied eines Rasters zu seinem Grundraster (terrainGrid der Karte) für den Spielstand: Felder, die in beiden ein Typed Array
 * gleicher Art und Länge sind, als geänderte Stellen { at: Int32Array, val }, alle anderen Felder unverändert in `keep`.
 * Gegenstück: patchGrid.
 */
export function gridDelta(grid, base) {
  const delta = {};
  const keep = {};
  for (const k of Object.keys(grid)) {
    const v = grid[k];
    const b = base[k];
    if (!ArrayBuffer.isView(v) || !ArrayBuffer.isView(b) || v.constructor !== b.constructor || v.length !== b.length) {
      keep[k] = v;
      continue;
    }
    let n = 0;
    for (let i = 0; i < v.length; i++) if (v[i] !== b[i]) n++;
    const at = new Int32Array(n);
    const val = new v.constructor(n);
    for (let i = 0, j = 0; j < n; i++) {
      if (v[i] === b[i]) continue;
      at[j] = i;
      val[j++] = v[i];
    }
    delta[k] = { at, val };
  }
  return { delta, keep };
}

/** Wendet einen Unterschied aus gridDelta auf ein frisches Grundraster an (ändert und liefert `base`). */
export function patchGrid(base, { delta, keep }) {
  for (const k of Object.keys(keep)) base[k] = keep[k];
  for (const k of Object.keys(delta)) {
    const a = base[k];
    const { at, val } = delta[k];
    for (let j = 0; j < at.length; j++) a[at[j]] = val[j];
  }
  return base;
}
