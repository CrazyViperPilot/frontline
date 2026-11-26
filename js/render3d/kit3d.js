// Baukasten 3D (Plan „3D mit three.js“, Stufe 2, Paket „Baukasten 3D“): die Bauteile aus render/isokit.js als echte three-Geometrie
// (alle Seiten, auch die hinteren), damit Gebäude in jeder Drehung stimmen. Gleiche Namen und Maße wie isokit.js: örtliche
// Koordinaten u = Welt-x, v = Welt-y ab dem Ankerpunkt, h = Höhe (Welt-px). Ein Gebäude ist ein Kit3D, in das alle Teile schreiben;
// geometry() liefert eine einzige BufferGeometry (zusammengeführt wie mergeGeometries, nur ohne Umweg): ein Draw-Call je Gebäude,
// ein Material (makeKitMaterial) für alle Gebäude. Gebaut wird je Variante einmal, unabhängig von Jahreszeit und Tageszeit.
//
// Je Ecke: position, normal (Spielachsen, z oben), color (sRGB wie die gemalten Farben, ohne Umrechnung), aUv (Welt-px entlang der
// Fläche: Wände waagrecht/senkrecht, Dächer entlang First/Hang, Flächen u/v) und aInfo = (Material, Fenster, Schnee):
//   Material 0 = ohne Foto, sonst 1 + Index in KIT_MATS (Fotos aus materials.js, Mischung „overlay“ mit Deckkraft und Kachelgröße
//   aus MATS wie im gemalten Bild); Fenster = Zufallswert / Anteil beleuchteter Fenster (≤ 1: am Tag warm beleuchtet wie gemalt,
//   nachts gehen mehr an, NIGHT_MORE), sonst 99; Schnee 1 = Oberseite darf Schnee tragen (Dächer), 2 = Bodenfläche (Rasen, Wege:
//   Schnee, aber kein Sonnenlicht, volle Farbe wie die gemalten Bodenflächen), 0 = nie.
// Schnee und Nacht wirken im Shader (uSnow, uNight): Schnee auf Flächen, die nach oben zeigen, gemischt wie season.js snowy (0,72).
// Licht wie Einheiten und Bäume (units3d.js): Helligkeit 0,56 + 0,44 · max(0, n · Sonne), Sonne = Renderer.lightVec. Gebäude
// werfen Schatten (Ebene CAST) und empfangen sie (Schattenkarte der Sonne, sun3d.js; Stärke wie der Schattenfänger, uShade).
// Umlaufsinn: gegen den Uhrzeiger um die Außennormale in Spielachsen (three spiegelt selbst, camera3d.js); poly() dreht nach dem
// Normalenhinweis um. Nur Darstellung, liest nichts vom Spiel.
import * as THREE from '../vendor/three/three.module.min.js';
import { MATS, wallMat, roofMat, flatMat } from '../render/materials.js';
import { rgbOf } from '../render/color.js';
import { shade, tint, GLASS, SILL, LEAF, rnd } from '../render/isokit.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';

/** Materialfotos der Gebäude in der Reihenfolge der Texturebenen (aInfo.x − 1). */
export const KIT_MATS = ['plaster', 'brick', 'concrete', 'tile', 'metal', 'wood', 'gravel', 'paint'];
const MAT_INDEX = new Map(KIT_MATS.map((m, i) => [m, i + 1]));
const NO_WIN = 99; // aInfo.y für alles, was kein Fenster ist
const WARM = '#f3d885'; // beleuchtetes Fenster (wie isokit.js)
export const NIGHT_MORE = 2.5; // nachts brennt Licht in so viel mehr Fenstern (Faktor auf den Anteil)
const SNOW_MIX = 0.72; // wie season.js ROOF_SNOW
const SNOW_COL = [226, 232, 240];
const FACE_N = { s: [0, 1, 0], n: [0, -1, 0], e: [1, 0, 0], w: [-1, 0, 0] };
const FACE_SEED = { s: 0, e: 7, n: 3, w: 11 }; // Zufall der Fensterbeleuchtung je Seite ('s', 'e' wie isokit.js)
const TAU = Math.PI * 2;

const colOf = (c) => rgbOf(c).map((x) => x / 255);
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l < 1e-12 ? null : [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Punkt auf einer Wand: 's' (Ebene v = plane, nach +v), 'n' (nach −v), 'e' (Ebene u = plane, nach +u), 'w' (nach −u); off ragt heraus. */
export function onFace(face, plane) {
  switch (face) {
    case 's': return (a, h, off = 0) => [a, plane + off, h];
    case 'n': return (a, h, off = 0) => [a, plane - off, h];
    case 'e': return (a, h, off = 0) => [plane + off, a, h];
    default: return (a, h, off = 0) => [plane - off, a, h];
  }
}

/** Flächenbasis der Fotos: X waagrecht entlang der Fläche, Y den Hang hinab bzw. nach unten; Flächen nach oben: u, v. */
function uvAxes(n) {
  if (Math.abs(n[2]) > 0.95) return [[1, 0, 0], [0, 1, 0]];
  const X = norm([-n[1], n[0], 0]);
  const Y = norm(cross(n, X));
  return [X, Y[2] > 0 ? [-Y[0], -Y[1], -Y[2]] : Y];
}

/** Sammelt die Dreiecke eines Gebäudes (alle Teile, ein Puffer). */
export class Kit3D {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.t = [];
    this.i = [];
  }

  get tris() {
    return this.p.length / 9;
  }

  vert(p, n, col, uv, info) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(col[0], col[1], col[2]);
    this.t.push(uv[0], uv[1]);
    this.i.push(info[0], info[1], info[2]);
  }

  /** aInfo einer Fläche aus den Optionen o (mat: Name oder null, win: Fensterwert, snow: false = nie Schnee, ground: Bodenfläche). */
  info(o) {
    return [o.mat ? MAT_INDEX.get(o.mat) ?? 0 : 0, o.win ?? NO_WIN, o.snow === false ? 0 : o.ground ? 2 : 1];
  }

  /**
   * Ebene Fläche (konvex, Ecken der Reihe nach) in Farbe col. o.n: Normalenhinweis (zeigt die errechnete Normale weg, wird die
   * Fläche umgedreht), o.mat, o.win, o.snow wie info().
   */
  poly(pts, col, o = {}) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    let n = norm([nx, ny, nz]);
    if (!n) return;
    if (o.n && dot(n, o.n) < 0) {
      pts = pts.slice().reverse();
      n = [-n[0], -n[1], -n[2]];
    }
    const [X, Y] = uvAxes(n);
    const C = colOf(col);
    const info = this.info(o);
    for (let k = 1; k < pts.length - 1; k++) {
      for (const p of [pts[0], pts[k], pts[k + 1]]) this.vert(p, n, C, [dot(p, X), dot(p, Y)], info);
    }
  }

  /** Viereck auf einer Wand (face, plane) von a0 bis a1 und h0 bis h1, off vor der Wand. */
  facePanel(face, plane, a0, a1, h0, h1, col, off = 0, o = {}) {
    const p = onFace(face, plane);
    this.poly([p(a0, h0, off), p(a1, h0, off), p(a1, h1, off), p(a0, h1, off)], col, { ...o, n: FACE_N[face] });
  }

  /** Fläche am Boden (Rasen, Weg) auf Höhe h: ungeschattet in voller Farbe wie isokit.flat (nur Schatten und Schnee wirken). */
  flat(u0, u1, v0, v1, col, h = 0.05, o = {}) {
    this.poly([[u0, v0, h], [u1, v0, h], [u1, v1, h], [u0, v1, h]], col, { mat: o.mat ?? flatMat(col), ground: true, ...o, n: [0, 0, 1] });
  }

  /**
   * Quader mit allen vier Wänden und Deckel (wie isokit.box, dort nur die sichtbaren). Wandfoto wallMat(wall), Deckel wie die Wand
   * oder flatMat(top). o.top = false: ohne Deckel (für parapet), o.bottom: mit Boden, o.mat/o.topMat: Fotos vorgeben.
   */
  box(u0, u1, v0, v1, h0, h1, wall, top = wall, o = {}) {
    const mat = o.mat !== undefined ? o.mat : wallMat(wall);
    const w = { mat, snow: o.snow };
    this.facePanel('s', v1, u0, u1, h0, h1, wall, 0, w);
    this.facePanel('n', v0, u0, u1, h0, h1, wall, 0, w);
    this.facePanel('e', u1, v0, v1, h0, h1, wall, 0, w);
    this.facePanel('w', u0, v0, v1, h0, h1, wall, 0, w);
    if (o.top !== false) {
      const tm = o.topMat !== undefined ? o.topMat : top === wall ? mat : flatMat(top);
      this.poly([[u0, v0, h1], [u1, v0, h1], [u1, v1, h1], [u0, v1, h1]], top, { mat: tm, snow: o.snow, n: [0, 0, 1] });
    }
    if (o.bottom) this.poly([[u0, v0, h0], [u1, v0, h0], [u1, v1, h0], [u0, v1, h0]], wall, { mat, n: [0, 0, -1] });
  }

  /** Sockel: dunkler Streifen unten um alle vier Wände, d vor der Wand. */
  plinth(u0, u1, v0, v1, col, h = 1.6, d = 0.25) {
    this.box(u0 - d, u1 + d, v0 - d, v1 + d, 0, h, shade(col, 0.3), shade(col, 0.3), { mat: null });
  }

  /** Gesims: umlaufendes Band auf Höhe h (Dicke t), d vor der Wand; col z. B. shade(wall, 0.15). */
  ledge(u0, u1, v0, v1, h, col, d = 0.5, t = 0.7) {
    this.box(u0 - d, u1 + d, v0 - d, v1 + d, h - t / 2, h + t / 2, col, col, { mat: null });
  }

  /** Farbband auf allen vier Wänden von h0 bis h1 (knapp vor der Wand). */
  wallBand(u0, u1, v0, v1, h0, h1, col, d = 0.06) {
    const mat = wallMat(col);
    this.facePanel('s', v1, u0 - d, u1 + d, h0, h1, col, d, { mat });
    this.facePanel('n', v0, u0 - d, u1 + d, h0, h1, col, d, { mat });
    this.facePanel('e', u1, v0 - d, v1 + d, h0, h1, col, d, { mat });
    this.facePanel('w', u0, v0 - d, v1 + d, h0, h1, col, d, { mat });
  }

  /**
   * Fenster an den Stellen at (Mitte entlang der Wand), je Reihe [h0, h1], Breite ww (wie isokit.winsAt): Rahmen, Glas, wahlweise
   * Kreuz (o.cross) und Läden (o.shutter: Farbe). o.lit: Anteil beleuchteter Fenster (Standard 0,2), o.seed, o.skip(i, r), o.glass, o.frame.
   */
  winsAt(face, plane, at, rows, ww, o = {}) {
    const glass = o.glass ?? GLASS;
    const litShare = o.lit ?? 0.2;
    rows.forEach(([h0, h1], r) => {
      at.forEach((a, i) => {
        if (o.skip?.(i, r)) return;
        const x0 = a - ww / 2;
        const x1 = a + ww / 2;
        if (o.frame !== false) this.facePanel(face, plane, x0 - 0.45, x1 + 0.45, h0 - 0.6, h1 + 0.45, o.frame ?? SILL, 0.08, { snow: false });
        const win = rnd((o.seed ?? 0) + i * 31 + r * 17 + FACE_SEED[face]) / litShare;
        this.facePanel(face, plane, x0, x1, h0, h1, win <= 1 ? WARM : glass, 0.14, { win, snow: false });
        if (o.cross) this.facePanel(face, plane, a - 0.22, a + 0.22, h0, h1, '#ebe8e0', 0.2, { snow: false });
        if (o.shutter) {
          this.facePanel(face, plane, x0 - 1.5, x0 - 0.45, h0, h1, o.shutter, 0.16, { snow: false });
          this.facePanel(face, plane, x1 + 0.45, x1 + 1.5, h0, h1, o.shutter, 0.16, { snow: false });
        }
      });
    });
  }

  /** n Fenster gleichmäßig zwischen a0 und a1. */
  wins(face, plane, a0, a1, n, rows, ww, o = {}) {
    const step = (a1 - a0) / n;
    this.winsAt(face, plane, Array.from({ length: n }, (_, i) => a0 + step * (i + 0.5)), rows, ww, o);
  }

  /** Tür mit hellem Rahmen. */
  door(face, plane, a, w, h, col = '#6a4a32') {
    this.facePanel(face, plane, a - w / 2 - 0.6, a + w / 2 + 0.6, 0, h + 0.6, SILL, 0.08, { snow: false });
    this.facePanel(face, plane, a - w / 2, a + w / 2, 0, h, col, 0.16, { mat: 'wood', snow: false });
  }

  /**
   * Satteldach über [u0,u1]×[v0,v1], Traufe auf h, First rh höher (wie isokit.gable: Überstand o, Traufe dabei tiefer, First 0,8
   * länger), axis = Richtung des Firsts. Dachplatte t dick (Oberseite wie gemalt), Giebeldreiecke an beiden Enden in Wandfarbe.
   */
  gable(axis, u0, u1, v0, v1, h, rh, roof, wall, o = 1.6, t = 0.8) {
    const P = axis === 'u' ? (a, b, z) => [a, b, z] : (a, b, z) => [b, a, z];
    const [A0, A1, B0, B1] = axis === 'u' ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const bm = (B0 + B1) / 2;
    const w = (B1 - B0) / 2;
    const he = h - (o * rh) / w;
    const a0 = A0 - 0.8;
    const a1 = A1 + 0.8;
    const top = h + rh;
    const mat = roofMat(roof);
    const edge = shade(roof, 0.4);
    for (const [be, sgn] of [[B0 - o, -1], [B1 + o, 1]]) {
      const hint = P(0, sgn * rh, w + o);
      this.poly([P(a0, be, he), P(a1, be, he), P(a1, bm, top), P(a0, bm, top)], roof, { mat, n: hint });
      this.poly([P(a0, be, he), P(a1, be, he), P(a1, be, he - t), P(a0, be, he - t)], edge, { mat: null, n: P(0, sgn, 0), snow: false });
      for (const [a, s2] of [[a0, -1], [a1, 1]]) {
        this.poly([P(a, be, he), P(a, bm, top), P(a, bm, top - t), P(a, be, he - t)], edge, { mat: null, n: P(s2, 0, 0), snow: false });
      }
    }
    const wm = wallMat(wall);
    for (const [a, s2] of [[A0, -1], [A1, 1]]) this.poly([P(a, B0, h), P(a, B1, h), P(a, bm, top - t * 0.5)], wall, { mat: wm, n: P(s2, 0, 0), snow: false });
  }

  /** Walmdach über [u0,u1]×[v0,v1] (First entlang der längeren Seite, wie isokit.hip: Überstand o, Traufe 0,7 tiefer), Traufkante t. */
  hip(u0, u1, v0, v1, h, rh, roof, o = 1.3, t = 0.7) {
    u0 -= o;
    u1 += o;
    v0 -= o;
    v1 += o;
    const he = h - 0.7;
    const top = h + rh;
    const mat = roofMat(roof);
    const along = u1 - u0 >= v1 - v0;
    const P = along ? (a, b, z) => [a, b, z] : (a, b, z) => [b, a, z];
    const [A0, A1, B0, B1] = along ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const w = (B1 - B0) / 2;
    const bm = (B0 + B1) / 2;
    const r1 = P(A0 + w, bm, top);
    const r2 = P(A1 - w, bm, top);
    this.poly([P(A0, B0, he), P(A1, B0, he), r2, r1], roof, { mat, n: P(0, -rh, w) });
    this.poly([P(A0, B1, he), P(A1, B1, he), r2, r1], roof, { mat, n: P(0, rh, w) });
    this.poly([P(A0, B0, he), r1, P(A0, B1, he)], roof, { mat, n: P(-rh, 0, w) });
    this.poly([P(A1, B0, he), r2, P(A1, B1, he)], roof, { mat, n: P(rh, 0, w) });
    const edge = shade(roof, 0.35);
    this.facePanel('s', v1, u0, u1, he - t, he, edge, 0, { snow: false });
    this.facePanel('n', v0, u0, u1, he - t, he, edge, 0, { snow: false });
    this.facePanel('e', u1, v0, v1, he - t, he, edge, 0, { snow: false });
    this.facePanel('w', u0, v0, v1, he - t, he, edge, 0, { snow: false });
  }

  /** Flachdach mit Attika nach einem Quader mit o.top = false bis h: vertiefte Dachfläche (Kies) und Innenseiten der Brüstung. */
  parapet(u0, u1, v0, v1, h, wall, deck = '#8f8d86', rim = 1.1) {
    const a0 = u0 + rim;
    const a1 = u1 - rim;
    const b0 = v0 + rim;
    const b1 = v1 - rim;
    const d = h - 1.3;
    this.poly([[a0, b0, d], [a1, b0, d], [a1, b1, d], [a0, b1, d]], deck, { mat: flatMat(deck), n: [0, 0, 1] });
    const m = wallMat(wall);
    this.facePanel('n', b1, a0, a1, d, h, wall, 0, { mat: m });
    this.facePanel('s', b0, a0, a1, d, h, wall, 0, { mat: m });
    this.facePanel('w', a1, b0, b1, d, h, wall, 0, { mat: m });
    this.facePanel('e', a0, b0, b1, d, h, wall, 0, { mat: m });
    // Krone der Brüstung
    this.poly([[u0, v0, h], [u1, v0, h], [u1, b0, h], [u0, b0, h]], wall, { mat: m, n: [0, 0, 1] });
    this.poly([[u0, b1, h], [u1, b1, h], [u1, v1, h], [u0, v1, h]], wall, { mat: m, n: [0, 0, 1] });
    this.poly([[u0, b0, h], [a0, b0, h], [a0, b1, h], [u0, b1, h]], wall, { mat: m, n: [0, 0, 1] });
    this.poly([[a1, b0, h], [u1, b0, h], [u1, b1, h], [a1, b1, h]], wall, { mat: m, n: [0, 0, 1] });
  }

  /** Balkon vor einer Wand (wie isokit.balcony): Platte (h − 1 … h), d tief, Brüstung in Farbe rail bis 4,2 über der Platte. */
  balcony(face, plane, a0, a1, h, d, rail) {
    const slab = '#e3dfd5';
    const box = (a, b, d0, d1, z0, z1, col) => {
      const p = onFace(face, plane);
      const P0 = p(a, z0, d0);
      const P1 = p(b, z0, d1);
      this.box(Math.min(P0[0], P1[0]), Math.max(P0[0], P1[0]), Math.min(P0[1], P1[1]), Math.max(P0[1], P1[1]), z0, z1, col, col, { mat: null, snow: col === slab });
    };
    box(a0, a1, 0, d, h - 1, h, slab);
    box(a0, a1, d - 0.35, d, h, h + 4.2, rail);
    box(a0, a0 + 0.35, 0, d, h, h + 4.2, rail);
    box(a1 - 0.35, a1, 0, d, h, h + 4.2, rail);
  }

  /**
   * Kegelstumpf (r0 unten, r1 oben) um (u, v) von h0 bis h1, n Seiten, glatt; o.top: Deckel (Standard ja), o.mat: Foto.
   * r1 = 0 ergibt eine Spitze (Kegel).
   */
  frustum(u, v, r0, r1, h0, h1, col, o = {}) {
    const n = o.n ?? 16;
    const C = colOf(col);
    const info = this.info({ mat: o.mat ?? null, snow: o.snow });
    const slope = (r0 - r1) / (h1 - h0 || 1);
    const ring = (k) => {
      const a = (k / n) * TAU;
      return [Math.cos(a), Math.sin(a)];
    };
    const circ = TAU * Math.max(r0, r1);
    for (let k = 0; k < n; k++) {
      const [c0, s0] = ring(k);
      const [c1, s1] = ring(k + 1);
      const N0 = norm([c0, s0, slope]);
      const N1 = norm([c1, s1, slope]);
      const p00 = [u + c0 * r0, v + s0 * r0, h0];
      const p10 = [u + c1 * r0, v + s1 * r0, h0];
      const p01 = [u + c0 * r1, v + s0 * r1, h1];
      const p11 = [u + c1 * r1, v + s1 * r1, h1];
      const x0 = (k / n) * circ;
      const x1 = ((k + 1) / n) * circ;
      // gegen den Uhrzeiger um die Außennormale: p00 → p10 → p11 (→ p01)
      this.vert(p00, N0, C, [x0, -h0], info);
      this.vert(p10, N1, C, [x1, -h0], info);
      this.vert(p11, N1, C, [x1, -h1], info);
      if (r1 > 1e-6) {
        this.vert(p00, N0, C, [x0, -h0], info);
        this.vert(p11, N1, C, [x1, -h1], info);
        this.vert(p01, N0, C, [x0, -h1], info);
      }
    }
    if (o.top !== false && r1 > 1e-6) {
      const pts = [];
      for (let k = 0; k < n; k++) {
        const [c, s] = ring(k);
        pts.push([u + c * r1, v + s * r1, h1]);
      }
      this.poly(pts, o.topCol ?? tint(col, 0.2), { mat: o.mat ?? null, snow: o.snow, n: [0, 0, 1] });
    }
  }

  /** Zylinder (Tank, Säule). */
  cyl(u, v, r, h0, h1, col, o = {}) {
    this.frustum(u, v, r, r, h0, h1, col, o);
  }

  /** Flaches Kegeldach über einem Zylinder: Spitze rh über dem Rand auf Höhe h. */
  coneRoof(u, v, r, h, rh, col, n = 16) {
    this.frustum(u, v, r, 0, h, h + rh, col, { n, top: false });
  }

  /** Halbkugel- oder Spitzhaube mit Radius r auf Höhe h; tall = Höhe/Radius (wie isokit.cap). */
  cap(u, v, r, h, col, tall = 1, n = 16, rings = 4) {
    this.dome(u, v, h, r, r * tall, col, 0, n, rings);
  }

  /** Kugel (Baumkrone, Busch), Halbachsen r (waagrecht) und rz (senkrecht), Mitte auf Höhe h. */
  ball(u, v, h, r, col, rz = r, n = 10, rings = 6) {
    this.dome(u, v, h, r, rz, col, -1, n, rings);
  }

  /** Ellipsoid-Kappe von Breite lat0 (−1 = Südpol, 0 = Äquator) bis zum Nordpol, glatte Normalen. */
  dome(u, v, h, r, rz, col, lat0, n, rings) {
    const C = colOf(col);
    const info = this.info({});
    const b0 = lat0 * (Math.PI / 2);
    const P = (i, k) => {
      const b = b0 + ((Math.PI / 2 - b0) * i) / rings;
      const a = (k / n) * TAU;
      const cb = Math.cos(b);
      const sb = Math.sin(b);
      const p = [u + Math.cos(a) * cb * r, v + Math.sin(a) * cb * r, h + sb * rz];
      const N = norm([(Math.cos(a) * cb) / r, (Math.sin(a) * cb) / r, sb / rz]);
      return { p, N, uv: [(k / n) * TAU * r, -p[2]] };
    };
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < n; k++) {
        const A = P(i, k);
        const B = P(i, k + 1);
        const Cc = P(i + 1, k + 1);
        const D = P(i + 1, k);
        if (i === 0 && lat0 === -1) {
          for (const q of [A, Cc, D]) this.vert(q.p, q.N, C, q.uv, info); // unterster Ring: Dreiecke vom Südpol
        } else if (i < rings - 1) {
          for (const q of [A, B, Cc, A, Cc, D]) this.vert(q.p, q.N, C, q.uv, info);
        } else {
          for (const q of [A, B, D]) this.vert(q.p, q.N, C, q.uv, info); // oberster Ring: Dreiecke zum Pol
        }
      }
    }
    if (lat0 === 0) {
      const pts = [];
      for (let k = 0; k < n; k++) pts.push([u + Math.cos((k / n) * TAU) * r, v + Math.sin((k / n) * TAU) * r, h]);
      this.poly(pts, shade(col, 0.2), { n: [0, 0, -1] }); // Boden der Haube (falls sie frei steht)
    }
  }

  /** Laubbaum der Grundstücke (wie isokit.tree: Stamm, drei Kronenkugeln; t wählt das Grün). */
  tree(u, v, s = 1, t = 0) {
    const L = LEAF[((t % 3) + 3) % 3];
    this.cyl(u, v, 0.95 * s, 0, 12 * s, '#5a4030', { n: 6, top: false });
    this.ball(u - 1.9 * s, v + 1.9 * s, 12.5 * s, 5.6 * s, L[1], 5.2 * s, 8, 5);
    this.ball(u + 1.8 * s, v - 1.8 * s, 13.5 * s, 5.3 * s, L[1], 5 * s, 8, 5);
    this.ball(u, v, 17 * s, 6.2 * s, L[0], 5.8 * s, 8, 5);
  }

  /** Busch (flache Kugel, wie isokit.bush). */
  bush(u, v, s = 1, t = 0) {
    this.ball(u, v, 2.6 * s, 3.8 * s, LEAF[((t % 3) + 3) % 3][1], 3 * s, 8, 4);
  }

  /** Auto (Kasten mit Kabine), along = 'u' oder 'v' (wie isokit.car). */
  car(u, v, along, col) {
    const [hu, hv] = along === 'u' ? [4.3, 2.1] : [2.1, 4.3];
    this.box(u - hu, u + hu, v - hv, v + hv, 0.6, 3.1, col, tint(col, 0.08), { mat: 'paint', snow: false });
    const [cu, cv] = along === 'u' ? [2.4, 1.8] : [1.8, 2.4];
    const du = along === 'u' ? -0.5 : 0;
    const dv = along === 'u' ? 0 : -0.5;
    this.box(u + du - cu, u + du + cu, v + dv - cv, v + dv + cv, 3.1, 4.8, '#2c3a47', tint(col, 0.12), { mat: null });
  }

  /** Alle Teile als eine BufferGeometry (Spielachsen, örtlich); boundingBox gesetzt. */
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.t, 2));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.i, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Material ----------

const VS = `
#include <common>
#include <shadowmap_pars_vertex>
uniform float uS;
attribute vec2 aUv;
attribute vec3 aInfo;
varying vec3 vN;
varying vec3 vCol;
varying vec2 vUv;
varying vec3 vInfo;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vec3 r = mat3(modelMatrix) * normal; // three-Raum → zurück in Spielachsen (wie units3d.js)
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vUv = aUv;
  vInfo = aInfo;
}`;

const FS = `
precision highp sampler2DArray;
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
uniform vec3 uLight;
uniform float uSnow;
uniform float uNight;
uniform float uShade;
uniform float uTexOn;
uniform sampler2DArray uTex;
uniform float uTile[${KIT_MATS.length}];
uniform float uAlpha[${KIT_MATS.length}];
uniform vec3 uSnowCol;
uniform vec3 uWarm;
uniform vec3 uNightGlow;
varying vec3 vN;
varying vec3 vCol;
varying vec2 vUv;
varying vec3 vInfo;
void main() {
  vec3 n = normalize(vN);
  vec3 c = vCol;
  // Schnee auf allem, was nach oben zeigt (Dächer, Rasen), gemischt wie season.js snowy
  c = mix(c, uSnowCol, uSnow * min(vInfo.z, 1.0) * smoothstep(0.2, 0.45, n.z) * ${SNOW_MIX.toFixed(2)});
  int m = int(vInfo.x + 0.5) - 1;
  if (m >= 0 && uTexOn > 0.5) {
    float t = texture(uTex, vec3(vUv / uTile[m], float(m))).r;
    vec3 o = mix(2.0 * c * t, 1.0 - 2.0 * (1.0 - c) * (1.0 - t), step(0.5, c)); // „overlay“ wie materials.js
    c = mix(c, o, uAlpha[m]);
  }
  float d = max(0.0, dot(n, uLight));
  float k = vInfo.z > 1.5 ? 1.0 : 0.56 + 0.44 * d; // Bodenflächen ungeschattet wie gemalt
  #ifdef USE_SHADOWMAP
  k *= 1.0 - uShade * (1.0 - getShadowMask()) * smoothstep(0.0, 0.2, d); // wie der Schattenfänger // nur der Sonne zugewandte Flächen
  #endif
  c *= k;
  // beleuchtete Fenster: am Tag warm wie gemalt, nachts heller und mehr davon (Wert ≤ 1 + (NIGHT_MORE − 1) · uNight)
  float on = 1.0 - step(1.0 + ${(NIGHT_MORE - 1).toFixed(2)} * uNight, vInfo.y);
  c = mix(c, mix(uWarm * (0.84 + 0.16 * d), uNightGlow, uNight), on);
  gl_FragColor = vec4(c, 1.0);
}`;

let texArray = null; // gemeinsame Texturebenen aller Kit-Materialien
let texReady = false;
const materials = new Set();

/** Fotos aus materials.js als eine Texturebenen-Textur (je Material eine Ebene, Graustufen); in Node eine neutrale Ebene. */
function textures() {
  if (texArray) return texArray;
  const S = 256;
  texArray = new THREE.DataArrayTexture(new Uint8Array(KIT_MATS.length).fill(128), 1, 1, KIT_MATS.length);
  texArray.format = THREE.RedFormat;
  texArray.needsUpdate = true;
  if (typeof Image === 'undefined' || typeof document === 'undefined') return texArray;
  Promise.all(
    KIT_MATS.map(
      (m) =>
        new Promise((ok) => {
          const im = new Image();
          im.onload = () => ok(im);
          im.onerror = () => ok(null);
          im.src = MATS[m].url.href;
        }),
    ),
  ).then((ims) => {
    if (ims.some((im) => !im)) return; // ohne Fotos weiter (wie materials.js)
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const data = new Uint8Array(S * S * KIT_MATS.length);
    ims.forEach((im, l) => {
      ctx.drawImage(im, 0, 0, S, S);
      const px = ctx.getImageData(0, 0, S, S).data;
      for (let i = 0; i < S * S; i++) data[l * S * S + i] = px[i * 4];
    });
    const t = new THREE.DataArrayTexture(data, S, S, KIT_MATS.length);
    t.format = THREE.RedFormat;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    texArray.dispose();
    texArray = t;
    texReady = true;
    for (const mat of materials) {
      mat.uniforms.uTex.value = t;
      mat.uniforms.uTexOn.value = 1;
    }
  });
  return texArray;
}

/** Sind die Materialfotos als Textur bereit? (Prüfteil wartet darauf.) */
export const kitTexturesReady = () => texReady;

const v3 = (c) => new THREE.Vector3(...c.map((x) => x / 255));

/** Ein ShaderMaterial für alle Gebäude des Baukastens (Licht, Fotos, Schnee, Nachtfenster, Schatten der Sonne). */
export function makeKitMaterial() {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        uLight: { value: new THREE.Vector3(0, 0, 1) },
        uS: { value: HEIGHT_SCALE },
        uSnow: { value: 0 },
        uNight: { value: 0 },
        uShade: { value: 0.4 },
        uTexOn: { value: 0 },
        uTex: { value: null },
        uTile: { value: KIT_MATS.map((m) => MATS[m].tile) },
        uAlpha: { value: KIT_MATS.map((m) => MATS[m].alpha) },
        uSnowCol: { value: v3(SNOW_COL) },
        uWarm: { value: v3(rgbOf(WARM)) },
        uNightGlow: { value: v3([255, 236, 170]) },
      },
    ]),
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
    lights: true,
  });
  mat.uniforms.uTex.value = textures();
  mat.uniforms.uTexOn.value = texReady ? 1 : 0;
  materials.add(mat);
  return mat;
}

/**
 * Bildanfang: Sonne (Welt, z oben, Renderer.lightVec), Schnee (Winter), Nacht 0 … 1 (Fenster), Schattenstärke (wie der
 * Schattenfänger: BALANCE.shadows3d.opacity der Stimmung).
 */
export function setKitFrame(mat, { light, snow = 0, night = 0, shade = 0.4 }) {
  const u = mat.uniforms;
  u.uLight.value.set(light[0], light[1], light[2]).normalize();
  u.uSnow.value = snow;
  u.uNight.value = night;
  u.uShade.value = shade;
}

/** Mesh eines Gebäudes: wirft und empfängt Schatten (Ebene CAST für die Schattenkarte). */
export function kitMesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.layers.enable(CAST);
  return m;
}
