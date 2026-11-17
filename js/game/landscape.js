// Landschaft der Zufallskarte: Höhengelände mit welligem Grund, Hügeln, Bergrücken (Fels, unpassierbar), Seen und (wahlweise) je
// einem Fluss vor jeder Startecke mit Brücken und Furten. Punktsymmetrisch wie die übrige Karte. Dazu die Prüfung, ob mehrere
// getrennte Wege in die Konfliktzone führen. Kein DOM.
import { zoneDist } from './zonegeo.js';
import { BALANCE } from '../data/balance.js';
import { MAPGEN } from '../data/mapgen.js';
import { CITY } from '../data/city.js';
import { makeRng } from '../core/rng.js';
import { Relief, RELIEF, COARSE_N } from './relief.js';
import { findPath } from './pathfinding.js';

const CITY_CELL = CITY.cell; // Stadtzelle (px): Raster der Brücken (seit v5.03)

const W = BALANCE.map.width;
const H = BALANCE.map.height;
const TWO_PI = Math.PI * 2;

const T = MAPGEN.terrain;
const HILLS = MAPGEN.terrain.hills;
const ZONE_HILLS = MAPGEN.terrain.zoneHills;
const RIDGES = MAPGEN.terrain.ridges;
const LAKES = MAPGEN.terrain.lakes;
const SPAWN_FLAT = MAPGEN.terrain.spawnFlat;
const SPAWN_BLEND = MAPGEN.terrain.spawnBlend;
const BASE_LEVEL = MAPGEN.terrain.baseLevel;
const DRY_LEVEL = RELIEF.water + T.dryLevel; // Mindesthöhe an Wegen, in der Stadt und an den Startpunkten
// Fluss (v4.53): Bogen um jede Startecke zwischen Startgelände und Konfliktzone, vom einen Kartenrand zum anderen. Wasser halfW px
// beiderseits der Mitte, Uferhang bank px, Mitte depth unter dem Spiegel. Brücken und Furten an festen Winkeln des Bogens (Grad von
// der Seitenkante aus; die mittlere Brücke trägt den Feldweg zur Stadt), je ±shift Grad auf das niedrigste Gelände verschoben.
const RIVER = {
  ...MAPGEN.river,
  fordBed: RELIEF.water - MAPGEN.river.fordDepth, // Furt: so tief steht das Wasser (seicht, man sieht die Strömung über den Steinen)
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Abstand Punkt → Strecke und Lage t (0–1) auf der Strecke. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/** Wertrauschen (glatt interpoliert) aus dem Zufallsgenerator. */
function makeNoise(rng) {
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rng.next() * 2 - 1;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const v = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const w = fy * fy * (3 - 2 * fy);
    const a = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * u;
    const b = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * u;
    return a + (b - a) * w;
  };
}

/**
 * Höhengelände der Zufallskarte.
 * @param {number} seed
 * @param {{ spawns: {x,y}[], zone: {x,y,r}, roads: {x1,y1,x2,y2}[], railY: number }} keep Bereiche, die frei bleiben
 * @param {{ river?: boolean }} opts river: je ein Fluss vor jeder Startecke (eigener Zufall; ohne ihn bleibt alles wie zuvor)
 * @returns {{ relief: Relief, ridges: object[], lakes: object[], hills: object[], fords: {x,y,r}[], bridges: {x1,y1,x2,y2}[],
 *   clearings: {x,y,r}[], crossings: {kind,x,y,nx,ny}[] }} clearings = Zufahrten von Brücken und Furten (dort kein Wald, keine Bäume,
 *   keine Gebäude); crossings = Mitte und Querrichtung jeder Brücke und Furt (Prüfung im Kartengenerator)
 */
export function buildLandscape(seed, keep, { river = false } = {}) {
  const rng = makeRng((seed * 2654435761) ^ 0x5bd1e995);
  const noise = makeNoise(rng);
  const { spawns, zone, roads, railY } = keep;
  const ZR = zone.r;

  // Freiraum eines Punktes mit Einflussradius `reach` zu Zone, Startpunkten, Zufahrten, Bahn und Rand
  const clear = (x, y, reach, zoneGap = 0) =>
    x > T.clearEdge && y > T.clearEdge && x < W - T.clearEdge && y < H - T.clearEdge &&
    zoneDist(zone, x, y) > ZR + reach + zoneGap &&
    spawns.every((s) => dist(x, y, s.x, s.y) > SPAWN_BLEND + reach) &&
    roads.every((r) => segDist(x, y, r.x1, r.y1, r.x2, r.y2).d > reach + T.clearRoad) &&
    Math.abs(y - railY) > reach + T.clearRail;
  const mirror = (p) => ({ x: W - p.x, y: H - p.y });

  // Bergrücken: Linienzug aus zwei Strecken, Querschnitt glockenförmig, Kamm mit Gipfeln und auslaufenden Enden
  const ridges = [];
  const ridgePts = (rd) => {
    const out = [];
    for (let s = 0; s < rd.pts.length - 1; s++) {
      const a = rd.pts[s];
      const b = rd.pts[s + 1];
      const n = Math.ceil(dist(a.x, a.y, b.x, b.y) / 90);
      for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    return out;
  };
  for (let i = 0; i < RIDGES; i++) {
    for (let t = 0; t < T.ridgeTries; t++) {
      const sigma = rng.range(...T.ridgeSigma);
      const h = rng.range(...T.ridgeHeight);
      const x0 = rng.range(T.ridgeEdge, W - T.ridgeEdge);
      const y0 = rng.range(T.ridgeEdge, H - T.ridgeEdge);
      let a = rng.next() * TWO_PI;
      const pts = [{ x: x0, y: y0 }];
      for (let s = 0; s < 2; s++) {
        const len = rng.range(...T.ridgeLeg);
        const p = pts[pts.length - 1];
        pts.push({ x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len });
        a += rng.range(-T.ridgeTurn, T.ridgeTurn);
      }
      const rd = { pts, sigma, h, phase: rng.next() * T.ridgePhase, bumps: rng.range(...T.ridgeBumps) };
      const samples = ridgePts(rd);
      const reach = T.ridgeReach * sigma;
      if (!samples.every((p) => clear(p.x, p.y, reach))) continue;
      const others = ridges.flatMap((o) => ridgePts(o).map((q) => ({ q, s: o.sigma })));
      if (!samples.every((p) => others.every(({ q, s }) => dist(p.x, p.y, q.x, q.y) > T.ridgeSpacing * (sigma + s)))) continue;
      if (!samples.every((p) => samples.every((q) => dist(p.x, p.y, W - q.x, H - q.y) > T.ridgeMirror * sigma))) continue;
      ridges.push(rd, { ...rd, pts: pts.map(mirror) });
      break;
    }
  }

  // Seen: Mulde unter den Wasserspiegel, Ufer flach auslaufend
  const lakes = [];
  const nearRidge = (x, y, gap) => ridges.some((rd) => ridgePts(rd).some((q) => dist(x, y, q.x, q.y) < gap + 2 * rd.sigma));
  for (let i = 0; i < LAKES; i++) {
    for (let t = 0; t < T.lakeTries; t++) {
      const r = rng.range(...T.lakeR);
      const x = rng.range(T.lakeEdge, W - T.lakeEdge);
      const y = rng.range(T.lakeEdge, H - T.lakeEdge);
      if (!clear(x, y, T.lakeClear * r, T.lakeZoneGap) || nearRidge(x, y, T.lakeRidgeGap * r)) continue;
      if (lakes.some((l) => dist(x, y, l.x, l.y) < T.lakeSpacing * (r + l.r) + T.lakeSpacingAdd)) continue;
      if (dist(x, y, W - x, H - y) < T.lakeMirror * r) continue;
      // Uferlinie unregelmäßig: Radius schwankt mit dem Winkel (Buchten, Landzungen)
      const wob = [rng.range(...T.lakeWobA), rng.next() * TWO_PI, rng.range(...T.lakeWobB), rng.next() * TWO_PI];
      lakes.push({ x, y, r, wob }, { x: W - x, y: H - y, r, wob: [wob[0], wob[1] + Math.PI * 3, wob[2], wob[3] + Math.PI * 5] });
      break;
    }
  }

  // Hügel: sanft genug, dass man hinauffahren kann (max. Neigung ≈ 0,6 · h / σ)
  const hills = [];
  for (let i = 0; i < HILLS; i++) {
    for (let t = 0; t < T.hillTries; t++) {
      const h = rng.range(...T.hillHeight);
      const sigma = Math.max(T.hillSigmaMin * h, rng.range(...T.hillSigma));
      const x = rng.range(T.hillEdge, W - T.hillEdge);
      const y = rng.range(T.hillEdge, H - T.hillEdge);
      const dz = zoneDist(zone, x, y);
      if (dz < ZR + 2 * sigma && h > T.hillZoneSlope * sigma) continue; // an der Stadt nur ganz flache Hügel
      if (dz < ZR - T.hillZoneInner) continue;
      if (lakes.some((l) => dist(x, y, l.x, l.y) < T.hillLakeGap * l.r + 2 * sigma)) continue;
      if (spawns.some((s) => dist(x, y, s.x, s.y) < SPAWN_FLAT)) continue;
      if (dist(x, y, W - x, H - y) < T.hillMirror * sigma) continue;
      hills.push({ x, y, h, sigma }, { x: W - x, y: H - y, h, sigma });
      break;
    }
  }
  for (let i = 0; i < ZONE_HILLS; i++) {
    const a = rng.next() * TWO_PI;
    const d = rng.range(T.zoneHillIn, ZR - T.zoneHillOut);
    const x = zone.x + Math.cos(a) * d;
    const y = zone.y + Math.sin(a) * d;
    const h = rng.range(...T.zoneHillHeight);
    const sigma = rng.range(...T.zoneHillSigma);
    hills.push({ x, y, h, sigma }, { x: W - x, y: H - y, h, sigma });
  }

  // Höhe je Grobpunkt
  const n = COARSE_N;
  const res = RELIEF.res;
  const coarse = new Float32Array(n * n);
  const [N0, N1, N2] = T.baseNoise;
  const base = (x, y) =>
    N0.amp * noise(x / N0.scale + N0.ox, y / N0.scale + N0.oy) + N1.amp * noise(x / N1.scale + N1.ox, y / N1.scale + N1.oy) + N2.amp * noise(x / N2.scale + N2.ox, y / N2.scale + N2.oy);
  const ridgeAt = (rd, x, y) => {
    let best = Infinity;
    let along = 0;
    let total = 0;
    let at = 0;
    for (let s = 0; s < rd.pts.length - 1; s++) {
      const a = rd.pts[s];
      const b = rd.pts[s + 1];
      const L = dist(a.x, a.y, b.x, b.y);
      const q = segDist(x, y, a.x, a.y, b.x, b.y);
      if (q.d < best) {
        best = q.d;
        at = total + q.t * L;
      }
      total += L;
    }
    along = at / total;
    if (best > T.ridgeCut * rd.sigma) return 0;
    const env = smooth(0, T.ridgeFadeIn, along) * smooth(1, T.ridgeFadeOut, along);
    const crest = rd.h * env * (T.ridgeCrest + T.ridgeBump * Math.sin(along * rd.bumps * TWO_PI + rd.phase));
    // Querschnitt spitz zulaufend: Flanken und Kamm sind steil (Fels), der Fuß läuft flach aus
    const f = Math.max(0, 1 - best / (T.ridgeFoot * rd.sigma));
    return crest * f ** T.ridgeShape;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * res;
      const y = j * res;
      const dz = zoneDist(zone, x, y); // in der Form der Zone (Kreis oder Quadrat der Eroberung)
      // Grund: punktsymmetrisch gemittelt, in der Stadt stark gedämpft
      let h = BASE_LEVEL + T.baseMix * (base(x, y) + base(W - x, H - y)) * (T.townDamp + T.townGain * smooth(ZR - T.townDampIn, ZR + T.townDampOut, dz));
      for (const hl of hills) h += hl.h * Math.exp(-((dist(x, y, hl.x, hl.y) / hl.sigma) ** 2));
      let peak = 0;
      for (const rd of ridges) peak = Math.max(peak, ridgeAt(rd, x, y));
      h += peak;
      // Seen: flache Mulde, Ufer laufen weit und sanft aus (kein Krater)
      for (const l of lakes) {
        const th = Math.atan2(y - l.y, x - l.x);
        const d = dist(x, y, l.x, l.y) / (1 + l.wob[0] * Math.sin(3 * th + l.wob[1]) + l.wob[2] * Math.sin(5 * th + l.wob[3]));
        const w = 1 - smooth(T.lakeShoreIn * l.r, T.lakeShoreOut * l.r, d);
        if (w <= 0) continue;
        const bed = d < l.r ? RELIEF.water - T.lakeDepth * (1 - (d / l.r) ** 2) : RELIEF.water + T.lakeRim;
        h += (bed - h) * w;
      }
      // Zufahrten, Bahn und Stadt liegen nie unter Wasser (kein Tümpel auf dem Weg)
      let near = Math.abs(y - railY);
      for (const r of roads) near = Math.min(near, segDist(x, y, r.x1, r.y1, r.x2, r.y2).d);
      const dry = Math.max(1 - smooth(T.dryRoadIn, T.dryRoadOut, near), 1 - smooth(ZR, ZR + T.dryZoneOut, dz));
      if (h < DRY_LEVEL) h += (DRY_LEVEL - h) * dry;
      // Gipfel weich begrenzen (Speicherformat reicht bis 382)
      if (h > T.peakSoft) h = T.peakSoft + (h - T.peakSoft) * T.peakSoftRate;
      coarse[j * n + i] = Math.max(-118, Math.min(372, h));
    }
  }
  // Startpunkte eben (Hauptstadt und Startaufstellung), weicher Übergang
  for (const s of spawns) {
    const level = Math.max(DRY_LEVEL, coarse[Math.round(s.y / res) * n + Math.round(s.x / res)]);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = smooth(SPAWN_FLAT, SPAWN_BLEND, dist(i * res, j * res, s.x, s.y));
        coarse[j * n + i] = level + (coarse[j * n + i] - level) * k;
      }
    }
  }
  // Flüsse mit Brücken und Furten (eigener Zufall)
  const water = river ? carveRivers(coarse, seed, keep) : { fords: [], bridges: [], clearings: [], crossings: [] };
  // Exakt punktsymmetrisch (Rundungsreste der Mittelung ausgleichen)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = (n - 1 - j) * n + (n - 1 - i);
      if (a < b) coarse[a] = coarse[b] = (coarse[a] + coarse[b]) / 2;
    }
  }
  return { relief: new Relief(coarse), ridges, lakes, hills, ...water };
}

/** Maße des Flusses für den Karteneditor: halbe Wasserbreite, Reichweite des Uferhangs, Furt (Wasserstand, Radius). */
export const RIVER_SIZE = { halfW: RIVER.halfW, reach: RIVER.halfW + RIVER.bank, fordBed: RIVER.fordBed, fordR: RIVER.fordR };

/** Gelände im Flusslauf: d = Abstand zur Flussmitte, h0 = Höhe vorher (Wasser bis halfW, dann der Uferhang bis halfW + bank). */
export function riverHeight(h0, d) {
  const RW = RIVER.halfW;
  if (d < RW) return Math.min(h0, RELIEF.water - RIVER.bedBelow - RIVER.depth * (1 - (d / RW) ** 2));
  if (d < RW + RIVER.bank) return Math.min(h0, RELIEF.water + 2 + (h0 - RELIEF.water - 2) * smooth(RW, RW + RIVER.bank, d));
  return h0;
}

/** Höhe im Grobraster (bilinear). */
function coarseAt(coarse, x, y) {
  const n = COARSE_N;
  const u = clamp(x / RELIEF.res, 0, n - 1.001);
  const v = clamp(y / RELIEF.res, 0, n - 1.001);
  const i = u | 0;
  const j = v | 0;
  const fu = u - i;
  const fv = v - j;
  const k = j * n + i;
  return (coarse[k] * (1 - fu) + coarse[k + 1] * fu) * (1 - fv) + (coarse[k + n] * (1 - fu) + coarse[k + n + 1] * fu) * fv;
}

/**
 * Gräbt je einen Fluss um die Startecke von Start 0 und spiegelbildlich um die von Start 1 ins Grobraster: Bogen im Abstand
 * RIVER.r von der Ecke mit sanften Schwüngen, Wasser und Uferhang wie oben beschrieben. An den Brücken und Furten flache
 * Zufahrten (RIVER.ramp), in den Furten seichtes Wasser. Liefert Furten, Brücken (Fahrbahn von Ufer zu Ufer) und die Zufahrten.
 */
function carveRivers(coarse, seed, keep) {
  const rng = makeRng((Math.imul(seed | 0, 2246822519) ^ 0x7f4a7c15) >>> 0);
  const { spawns, zone } = keep;
  const s0 = spawns[0];
  const corner = { x: s0.x < W / 2 ? 0 : W, y: s0.y < H / 2 ? 0 : H };
  // Richtungen: u entlang der einen Seitenkante (zur Kartenmitte hin), v entlang der anderen
  const u = { x: 0, y: corner.y === 0 ? 1 : -1 };
  const v = { x: corner.x === 0 ? 1 : -1, y: 0 };
  const DEG = Math.PI / 180;
  const RW = RIVER.halfW;
  const reach = RW + RIVER.bank;
  const make = (p) => {
    const R = (th) => p.r0 + p.a1 * Math.sin(p.k1 * th + p.f1) + p.a2 * Math.sin(p.k2 * th + p.f2);
    const at = (th) => {
      const r = R(th);
      return { x: corner.x + r * (Math.cos(th) * u.x + Math.sin(th) * v.x), y: corner.y + r * (Math.cos(th) * u.y + Math.sin(th) * v.y) };
    };
    const pts = [];
    for (let d = RIVER.arc[0]; d <= RIVER.arc[1]; d += RIVER.arcStep) pts.push(at(d * DEG));
    return { at, pts };
  };
  const ok = (rv) =>
    rv.pts.every((q) => {
      if (q.x < -RIVER.offMap || q.y < -RIVER.offMap || q.x > W + RIVER.offMap || q.y > H + RIVER.offMap) return true;
      return (
        dist(q.x, q.y, s0.x, s0.y) > SPAWN_BLEND + RW &&
        dist(q.x, q.y, zone.x, zone.y) > zone.r + reach + RIVER.zoneGap && // Fluss: immer der Kreis (zwischen Bauland und Quadrat-Ecke ist kein Platz)
        coarseAt(coarse, q.x, q.y) < RIVER.maxH
      );
    });
  let rv = null;
  for (let t = 0; t < RIVER.tries && !rv; t++) {
    const p = {
      r0: rng.range(...RIVER.r),
      a1: rng.range(...RIVER.swing1),
      k1: rng.range(...RIVER.wave1),
      f1: rng.next() * TWO_PI,
      a2: rng.range(...RIVER.swing2),
      k2: rng.range(...RIVER.wave2),
      f2: rng.next() * TWO_PI,
    };
    const cand = make(p);
    if (ok(cand)) rv = cand;
  }
  rv ??= make({ r0: (RIVER.r[0] + RIVER.r[1]) / 2, a1: 0, k1: 1, f1: 0, a2: 0, k2: 1, f2: 0 });
  const mirror = (q) => ({ x: W - q.x, y: H - q.y });
  const lines = [rv.pts, rv.pts.map(mirror)];

  // Brücken und Furten: Winkel ±shift auf das niedrigste Gelände, Querrichtung = Normale des Bogens (mittlere Brücke: zur Ecke)
  const site = (deg, straight) => {
    let best = deg;
    let bestH = Infinity;
    if (!straight) {
      for (let d = deg - RIVER.shift; d <= deg + RIVER.shift + 1e-9; d += 1) {
        const q = rv.at(d * DEG);
        const l = Math.hypot(q.x - corner.x, q.y - corner.y) || 1;
        const nx = (q.x - corner.x) / l; // quer zum Fluss (radial zur Ecke)
        const ny = (q.y - corner.y) / l;
        let hmax = -Infinity;
        let wet = 0; // Seen hinter dem Ufer: dort führte die Zufahrt ins Wasser
        for (const s of [-1, 1]) {
          for (let k = 1; k <= RIVER.probes; k++) {
            const h = coarseAt(coarse, q.x + nx * s * (RW + RIVER.probeStep * k), q.y + ny * s * (RW + RIVER.probeStep * k));
            if (k <= RIVER.probeKeep) hmax = Math.max(hmax, h);
            if (h < RELIEF.water + RIVER.wetLevel) wet++;
          }
        }
        hmax += wet * RIVER.wetPenalty;
        if (hmax < bestH) {
          bestH = hmax;
          best = d;
        }
      }
    }
    const c = rv.at(best * DEG);
    const a = rv.at((best - 0.5) * DEG);
    const b = rv.at((best + 0.5) * DEG);
    let nx;
    let ny;
    if (straight) {
      nx = c.x - corner.x;
      ny = c.y - corner.y;
    } else {
      nx = -(b.y - a.y);
      ny = b.x - a.x;
      if (nx * (c.x - corner.x) + ny * (c.y - corner.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
    }
    const l = Math.hypot(nx, ny) || 1;
    return { x: c.x, y: c.y, nx: nx / l, ny: ny / l };
  };
  // Brücken (seit v5.03) liegen genau waagrecht oder senkrecht auf einer Reihe von Stadtzellen (CITY.cell): ihre Fahrbahn ist eine
  // Stadtstraße, an die man eigene Straßen anschließen kann. Mitte auf die nächste Zellmitte, Richtung auf die nähere Achse;
  // cross = Kosinus zwischen Brücke und Flussnormale (schräge Querung: längere Brücke), off = Abstand der Mitte von der Flussmitte.
  const snapBridge = (q) => {
    const S = CITY_CELL;
    const x = (Math.floor(q.x / S) + 0.5) * S;
    const y = (Math.floor(q.y / S) + 0.5) * S;
    const flat = Math.abs(q.nx) >= Math.abs(q.ny) - 1e-9;
    const nx = flat ? (q.nx < 0 ? -1 : 1) : 0;
    const ny = flat ? 0 : q.ny < 0 ? -1 : 1;
    const cross = Math.max(0.5, Math.abs(nx * q.nx + ny * q.ny));
    return { x, y, nx, ny, cross, off: Math.abs((x - q.x) * q.nx + (y - q.y) * q.ny) };
  };
  const sites = [
    ...RIVER.bridges.map((d) => ({ ...snapBridge(site(d, d === RIVER.straight)), kind: 'bridge' })),
    ...RIVER.fords.map((d) => ({ ...site(d, false), kind: 'ford' })),
  ];
  const all = [...sites, ...sites.map((q) => ({ ...q, ...mirror(q), nx: -q.nx, ny: -q.ny }))];

  // Abstand zum nächsten Flusslauf (beide Flüsse)
  const nearLine = (x, y) => {
    let best = Infinity;
    for (const pts of lines) {
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        if (Math.abs(x - a.x) > reach + RIVER.influence || Math.abs(y - a.y) > reach + RIVER.influence) continue;
        best = Math.min(best, segDist(x, y, a.x, a.y, b.x, b.y).d);
      }
    }
    return best;
  };
  const n = COARSE_N;
  const res = RELIEF.res;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * res;
      const y = j * res;
      const d = nearLine(x, y);
      if (d > reach + RIVER.influence) continue;
      const k = j * n + i;
      const h0 = coarse[k];
      let h = riverHeight(h0, d);
      // flache Zufahrten an Brücken und Furten; in der Furt seichtes Wasser
      for (const q of all) {
        const e = dist(x, y, q.x, q.y);
        if (e > RIVER.rampReach) continue;
        // Brücken: Abstand zur Brückenachse (die Zufahrt folgt der Brücke, auch bei schräger Querung); Furten: entlang des Flusses
        const along = q.kind === 'bridge' ? Math.abs((x - q.x) * q.ny - (y - q.y) * q.nx) : Math.sqrt(Math.max(0, e * e - d * d));
        const w = (1 - smooth(RIVER.rampIn, RIVER.rampOut, along)) * (1 - smooth(RW + RIVER.rampBankIn, RW + RIVER.rampBankOut, d));
        if (w <= 0) continue;
        const ford = q.kind === 'ford';
        if (d < RW && !ford) continue; // unter der Brücke bleibt das Wasser tief
        const ramp = (ford ? RIVER.fordBed : RELIEF.water + RIVER.rampBase) + Math.max(0, d - RW) * RIVER.ramp;
        // In der Furt immer seicht; an Land die Zufahrt: Hügel abgetragen, Senken und Seen knapp übers Wasser aufgefüllt
        const target = d < RW ? RIVER.fordBed : Math.min(Math.max(h0, RELIEF.water + RIVER.rampMin), ramp);
        h += (target - h) * w;
      }
      coarse[k] = Math.max(-118, h);
    }
  }
  const fords = all.filter((q) => q.kind === 'ford').map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), r: RIVER.fordR }));
  const span = RW + RIVER.deckOver;
  // Halbe Länge einer Brücke: schräg zum Fluss länger, Enden auf Zellkanten (ganze Zahl Stadtzellen, Mitte auf einer Zellmitte)
  const halfOf = (q) => {
    const need = (span + (q.off ?? 0)) / (q.cross ?? 1);
    return (Math.ceil((need - CITY_CELL / 2) / CITY_CELL) + 0.5) * CITY_CELL;
  };
  const bridges = all
    .filter((q) => q.kind === 'bridge')
    .map((q) => {
      const h = halfOf(q);
      return {
        x1: Math.round(q.x - q.nx * h),
        y1: Math.round(q.y - q.ny * h),
        x2: Math.round(q.x + q.nx * h),
        y2: Math.round(q.y + q.ny * h),
      };
    });
  const clearings = [];
  for (const q of all) {
    if (q.kind === 'ford') {
      for (const s of [-1, 1]) clearings.push({ x: q.x + q.nx * s * (RW + RIVER.fordClearOff), y: q.y + q.ny * s * (RW + RIVER.fordClearOff), r: RIVER.fordClearR });
      clearings.push({ x: q.x, y: q.y, r: RIVER.fordClearMid });
    } else {
      const h = halfOf(q);
      for (const s of [-1, 1]) clearings.push({ x: q.x + q.nx * s * (h + RIVER.bridgeClearOff), y: q.y + q.ny * s * (h + RIVER.bridgeClearOff), r: RIVER.bridgeClearR });
      clearings.push({ x: q.x, y: q.y, r: h });
    }
  }
  const crossings = all.map((q) => ({ kind: q.kind, x: q.x, y: q.y, nx: q.nx, ny: q.ny }));
  return { fords, bridges, clearings, crossings };
}

/** Gelände um (x, y) im Radius r eignet sich für Wald, Gehöfte oder Bäume: kein Wasser, nicht steiler als maxSlope. */
export function groundOk(relief, x, y, r = 0, maxSlope = RELIEF.rock) {
  if (!relief) return true;
  const pts = [[x, y]];
  if (r > 0) for (let k = 0; k < 8; k++) pts.push([x + Math.cos((k * TWO_PI) / 8) * r, y + Math.sin((k * TWO_PI) / 8) * r]);
  for (const [px, py] of pts) {
    if (relief.heightAt(px, py) < RELIEF.water + T.groundDry) return false;
    const g = relief.gradAt(px, py);
    if (Math.hypot(g.x, g.y) > maxSlope) return false;
  }
  return true;
}

/**
 * Zählt getrennte Wege von `from` nach `to` (bis `want`): Weg suchen, den Korridor um ihn (Radius `band`) sperren, erneut
 * suchen. Kreise in `keepOut` (Startbereich, Konfliktzone) werden nie gesperrt. Das Raster bleibt unverändert.
 */
export function countRoutes(grid, from, to, { want = MAPGEN.general.routeWant, band = MAPGEN.general.routeBand, keepOut = [] } = {}) {
  const saved = grid.terrain.slice();
  const t = grid.tile;
  const rc = Math.ceil(band / t);
  let found = 0;
  try {
    for (let k = 0; k < want; k++) {
      const path = findPath(grid, from.x, from.y, to.x, to.y, 0, grid.cols * grid.rows + 10);
      const last = path[path.length - 1];
      if (!last || Math.hypot(last.x - to.x, last.y - to.y) > t * 2) break;
      found++;
      let px = from.x;
      let py = from.y;
      for (const p of path) {
        const n = Math.max(1, Math.ceil(dist(px, py, p.x, p.y) / t));
        for (let s = 0; s <= n; s++) {
          const x = px + ((p.x - px) * s) / n;
          const y = py + ((p.y - py) * s) / n;
          if (keepOut.some((o) => dist(x, y, o.x, o.y) < o.r)) continue;
          const c0 = grid.toCell(x);
          const r0 = grid.toCell(y);
          for (let dr = -rc; dr <= rc; dr++) {
            for (let dc = -rc; dc <= rc; dc++) {
              if (dc * dc + dr * dr > rc * rc || !grid.inBounds(c0 + dc, r0 + dr)) continue;
              const cx = grid.center(c0 + dc);
              const cy = grid.center(r0 + dr);
              if (keepOut.some((o) => dist(cx, cy, o.x, o.y) < o.r)) continue;
              grid.terrain[grid.idx(c0 + dc, r0 + dr)] = 1;
            }
          }
        }
        px = p.x;
        py = p.y;
      }
    }
  } finally {
    grid.terrain.set(saved);
  }
  return found;
}
