// Körper-Wandler für three.js (Plan „3D mit three.js“, Paket „Körper-Wandler“): wandelt die Körperlisten der Einheiten-, Fels- und
// Tiermodelle (render/units/shapes.js) in three-Geometrie. Die Modelle bleiben die einzige Wahrheit; hier wird nur umgesetzt.
//
// Achsen: Modellkoordinaten bleiben (x vorn, y rechts, z oben) in Welt-Pixeln. Die Wurzelgruppe des 3D-Renderers (camera3d.js)
// bildet Weltkoordinaten auf three ab; ein Modell hängt später als Kind dort, gedreht um z (yaw). Nichts davon geschieht hier.
// Umlaufsinn: wie painter.js (Newell-Normale, nach außen weg von der Körpermitte c). Zeigt die Normale nach innen, wird die Fläche
// umgedreht, so dass alle Dreiecke gegen den Uhrzeigersinn um ihre Außennormale laufen (three dreht die Spiegelung selbst um).
// Weggelassen: Körper mit only === 'top' (3D ist die Iso-Welt). Ignoriert im MVP: mat/matWhole (Materialfotos), noLine, under, on
// (Tiefenpuffer ersetzt die Malreihenfolge), vary. Später Textur: mat/matWhole als Bild je Fläche (materials.js).
import * as THREE from '../vendor/three/three.module.min.js';
import { mix, rgbOf } from '../render/color.js';

const CHAR = '#2a2623'; // Farbe verbrannter Wracks (wie painter.js)
const CHAR_K = 0.78; // Anteil Richtung CHAR
const TOP_NZ = 0.5; // ab dieser Steilheit der Flächennormale gilt die Oberseitenfarbe (Schnee, Moos)
/** Lackfotos der Einheiten (materials.js) in der Reihenfolge von aMat (1 = armor, 2 = paint). */
export const UNIT_MATS = ['armor', 'paint'];
/** Farbrollen einer Team-Lackierung (shapes.js TEAM_PAINT) in der Reihenfolge von aPaint.x. */
export const UNIT_ROLES = ['body', 'dark', 'light', 'camo', 'mark', 'vest', 'air'];

const keyOfPoint = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
const col3 = new THREE.Color();

/** Flächenbasis für Materialfotos (wie kit3d.js): X waagrecht entlang der Fläche, Y nach unten; Flächen nach oben: x, y. */
function uvAxes(n) {
  if (Math.abs(n[2]) > 0.95) return [[1, 0, 0], [0, 1, 0]];
  const xl = Math.hypot(n[0], n[1]);
  const X = [-n[1] / xl, n[0] / xl, 0];
  const Y = [n[1] * X[2] - n[2] * X[1], n[2] * X[0] - n[0] * X[2], n[0] * X[1] - n[1] * X[0]];
  const yl = Math.hypot(Y[0], Y[1], Y[2]) || 1;
  const s = Y[2] > 0 ? -1 / yl : 1 / yl;
  return [X, [Y[0] * s, Y[1] * s, Y[2] * s]];
}

/**
 * Zerlegt 4 Teamfarben [c0..c3] (Hex) in eine gemeinsame Formel mix(palette[team][role], base, t) (sRGB 0 … 1):
 * gleiche Farben → t = 1 (feste Farbe); direkte Rollenfarbe → t = 0; gemischter Lack (z. B. mix(P.air, Grau, 0.5)) → t ∈ (0, 1).
 */
function decomposeTeamColor(cols, palettes) {
  if (cols[0] === cols[1] && cols[0] === cols[2] && cols[0] === cols[3]) {
    const c = rgbOf(cols[0]);
    return { role: 0, t: 1, base: [c[0] / 255, c[1] / 255, c[2] / 255] };
  }
  const v = cols.map(rgbOf);
  let best = null;
  for (let r = 0; r < UNIT_ROLES.length; r++) {
    const p0 = palettes[0][r];
    const p1 = palettes[1][r];
    let num = 0;
    let den = 0;
    for (let k = 0; k < 3; k++) {
      const dc = v[0][k] - v[1][k];
      const dp = p0[k] - p1[k];
      num += dc * dp;
      den += dp * dp;
    }
    const w = den > 0 ? Math.max(0, Math.min(1, num / den)) : 0; // w = 1 − t
    const t = 1 - w;
    const base = t < 1e-3 ? [0, 0, 0] : [0, 1, 2].map((k) => Math.max(0, Math.min(255, (v[0][k] - w * p0[k]) / t)));
    let err = 0;
    for (let tm = 0; tm < 4; tm++) {
      for (let k = 0; k < 3; k++) err = Math.max(err, Math.abs(w * palettes[tm][r][k] + t * base[k] - v[tm][k]));
    }
    if (!best || err < best.err) best = { role: r, t, base: [base[0] / 255, base[1] / 255, base[2] / 255], err };
  }
  return best;
}

/** Normale einer Fläche (Newell, wie painter.js) nach außen, weg von der Körpermitte c; null bei entarteter Fläche. */
function outwardNormal(face, c) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let fx = 0;
  let fy = 0;
  let fz = 0;
  for (let i = 0; i < face.length; i++) {
    const a = face[i];
    const b = face[(i + 1) % face.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
    fx += a[0];
    fy += a[1];
    fz += a[2];
  }
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-9) return null;
  nx /= l;
  ny /= l;
  nz /= l;
  const k = face.length;
  const flip = nx * (fx / k - c[0]) + ny * (fy / k - c[1]) + nz * (fz / k - c[2]) < 0;
  return flip ? { n: [-nx, -ny, -nz], flip } : { n: [nx, ny, nz], flip };
}

/** Wird der Körper in 3D gezeigt? (only 'top' = nur die 2D-Draufsicht.) */
const shown = (so) => so.only !== 'top';

/**
 * Körperliste → BufferGeometry (nicht indiziert): position, normal, color (linear). opts.charred: verbrannt (Wrack);
 * opts.part: 'opaque' (nur Körper ohne alpha), 'alpha' (nur durchscheinende), sonst alle.
 */
export function solidsToGeometry(solids, opts = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  for (const so of solids) {
    if (!shown(so)) continue;
    if (opts.part === 'opaque' && so.alpha !== undefined) continue;
    if (opts.part === 'alpha' && so.alpha === undefined) continue;
    const baseCol = opts.charred ? mix(so.col, CHAR, CHAR_K) : so.col;
    const fcols = so.fcol && !opts.charred ? so.fcol : null;
    // Flächen mit Außennormale und (ggf. umgedrehter) Eckenfolge sammeln
    const faces = [];
    for (let fi = 0; fi < so.faces.length; fi++) {
      const f = so.faces[fi];
      if (f.length < 3) continue;
      const o = outwardNormal(f, so.c);
      if (!o) continue;
      faces.push({ pts: o.flip ? f.slice().reverse() : f, n: o.n, src: fi });
    }
    // glatte Körper: Mittel der Flächennormalen je gemeinsamer Ecke
    let acc = null;
    if (so.smooth) {
      acc = new Map();
      for (const F of faces) {
        for (const p of F.pts) {
          const k = keyOfPoint(p);
          const a = acc.get(k) ?? [0, 0, 0];
          a[0] += F.n[0];
          a[1] += F.n[1];
          a[2] += F.n[2];
          acc.set(k, a);
        }
      }
    }
    const vn = (F, p) => {
      if (!acc) return F.n;
      const a = acc.get(keyOfPoint(p));
      const l = Math.hypot(a[0], a[1], a[2]);
      return l < 1e-9 ? F.n : [a[0] / l, a[1] / l, a[2] / l];
    };
    for (const F of faces) {
      let hex = fcols?.[F.src] ?? baseCol;
      if (so.top && !opts.charred && F.n[2] > TOP_NZ) hex = so.top.col;
      col3.set(hex); // three 0.187: aus '#hex' bereits linear
      for (let i = 1; i < F.pts.length - 1; i++) {
        for (const p of [F.pts[0], F.pts[i], F.pts[i + 1]]) {
          const n = vn(F, p);
          pos.push(p[0], p[1], p[2]);
          nor.push(n[0], n[1], n[2]);
          col.push(col3.r, col3.g, col3.b);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingBox();
  return g;
}

/**
 * Gemeinsame Geometrie für alle Teams (Instancing in units3d.js): position, normal, color (sRGB 0 … 1 Grundfarbe),
 * aPaint (Farbrolle 0 … 6, Mischanteil t zur Grundfarbe), aUv (Modell-px für Lackfotos), aMat (0 ohne, 1 armor, 2 paint).
 * solidsByTeam: [S0, S1, S2, S3] der 4 Teams; palettes: [team][role] = [r, g, b] (0 … 255).
 */
export function teamSolidsToGeometry(solidsByTeam, palettes) {
  const pos = [];
  const nor = [];
  const col = [];
  const paint = [];
  const uv = [];
  const mat = [];
  const s0 = solidsByTeam[0];
  for (let si = 0; si < s0.length; si++) {
    const so = s0[si];
    if (!shown(so)) continue;
    const matIdx = so.mat === 'armor' ? 1 : so.mat === 'paint' ? 2 : 0;
    const faces = [];
    for (let fi = 0; fi < so.faces.length; fi++) {
      const f = so.faces[fi];
      if (f.length < 3) continue;
      const o = outwardNormal(f, so.c);
      if (!o) continue;
      faces.push({ pts: o.flip ? f.slice().reverse() : f, n: o.n, src: fi });
    }
    let acc = null;
    if (so.smooth) {
      acc = new Map();
      for (const F of faces) {
        for (const p of F.pts) {
          const k = keyOfPoint(p);
          const a = acc.get(k) ?? [0, 0, 0];
          a[0] += F.n[0];
          a[1] += F.n[1];
          a[2] += F.n[2];
          acc.set(k, a);
        }
      }
    }
    const vn = (F, p) => {
      if (!acc) return F.n;
      const a = acc.get(keyOfPoint(p));
      const l = Math.hypot(a[0], a[1], a[2]);
      return l < 1e-9 ? F.n : [a[0] / l, a[1] / l, a[2] / l];
    };
    const baseHex = solidsByTeam.map((list) => list[si].col);
    const baseDec = decomposeTeamColor(baseHex, palettes);
    for (const F of faces) {
      let dec = baseDec;
      if (so.fcol || (so.top && F.n[2] > TOP_NZ)) {
        const fHex = solidsByTeam.map((list) => {
          const s = list[si];
          if (s.top && F.n[2] > TOP_NZ) return s.top.col;
          return s.fcol?.[F.src] ?? s.col;
        });
        dec = decomposeTeamColor(fHex, palettes);
      }
      const [X, Y] = uvAxes(F.n);
      for (let i = 1; i < F.pts.length - 1; i++) {
        for (const p of [F.pts[0], F.pts[i], F.pts[i + 1]]) {
          const n = vn(F, p);
          pos.push(p[0], p[1], p[2]);
          nor.push(n[0], n[1], n[2]);
          col.push(dec.base[0], dec.base[1], dec.base[2]);
          paint.push(dec.role, dec.t);
          uv.push(p[0] * X[0] + p[1] * X[1] + p[2] * X[2], p[0] * Y[0] + p[1] * Y[1] + p[2] * Y[2]);
          mat.push(matIdx);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.Float32BufferAttribute(paint, 2));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 1));
  g.computeBoundingBox();
  return g;
}

/** Umriss aller Ecken in Modellkoordinaten (ohne only 'top'): { x0, x1, y0, y1, z0, z1 }. */
export function boundsOf3(solids) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const so of solids) {
    if (!shown(so)) continue;
    for (const f of so.faces) {
      for (const p of f) {
        b.x0 = Math.min(b.x0, p[0]);
        b.x1 = Math.max(b.x1, p[0]);
        b.y0 = Math.min(b.y0, p[1]);
        b.y1 = Math.max(b.y1, p[1]);
        b.z0 = Math.min(b.z0, p[2]);
        b.z1 = Math.max(b.z1, p[2]);
      }
    }
  }
  return b;
}

/** Gruppe mit einem undurchsichtigen und, falls Körper mit alpha da sind, einem durchscheinenden Netz. userData.bounds = Umriss. */
export function buildModelMesh(solids, opts = {}) {
  const group = new THREE.Group();
  const solid = solidsToGeometry(solids, { ...opts, part: 'opaque' });
  if (solid.getAttribute('position').count) group.add(new THREE.Mesh(solid, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const alphas = solids.filter((so) => so.alpha !== undefined && shown(so));
  if (alphas.length) {
    const glass = solidsToGeometry(solids, { ...opts, part: 'alpha' });
    const opacity = alphas.reduce((s, so) => s + so.alpha, 0) / alphas.length;
    group.add(new THREE.Mesh(glass, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false })));
  }
  group.userData.bounds = boundsOf3(solids);
  return group;
}

const cache = new Map(); // key|charred → BufferGeometry
const teamCache = new Map(); // key → BufferGeometry (alle Teams gemeinsam)

/** Geometrie eines Modells (alle Körper) mit Zwischenspeicher je key und charred: gleiche Variante nur einmal bauen. */
export function modelGeometry(key, solids, opts = {}) {
  const k = `${key}|${opts.charred ? 1 : 0}`;
  let g = cache.get(k);
  if (!g) {
    g = solidsToGeometry(solids, { charred: !!opts.charred });
    cache.set(k, g);
  }
  return g;
}

/** Gemeinsame Team-Geometrie eines Modells mit Zwischenspeicher je key (ohne Team). */
export function modelTeamGeometry(key, solidsByTeam, palettes) {
  let g = teamCache.get(key);
  if (!g) {
    g = teamSolidsToGeometry(solidsByTeam, palettes);
    teamCache.set(key, g);
  }
  return g;
}

/** Zwischenspeicher leeren (Geometrien freigeben). */
export function clearModelCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
  for (const g of teamCache.values()) g.dispose();
  teamCache.clear();
}
