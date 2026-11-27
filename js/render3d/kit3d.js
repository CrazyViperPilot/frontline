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
export const TEAM_WIN = 97; // aInfo.y für Flächen in Teamfarbe (Werke): der Shader nimmt die Farbe der Instanz (instanceColor)
const WARM = '#f3d885'; // beleuchtetes Fenster (wie isokit.js)
export const NIGHT_MORE = 2.5; // nachts brennt Licht in so viel mehr Fenstern (Faktor auf den Anteil)
export const GLOW_NIGHT = 1.6; // Leuchtwert (aInfo.y) für Licht nur bei Nacht: Schaufenster, Laternen, Glaskanzeln
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
    this.team = false; // true: Teile in Teamfarbe (aInfo.y = TEAM_WIN), mit der Farbe der Instanz getönt
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

  /**
   * aInfo einer Fläche aus den Optionen o (mat: Name oder null, win: Fensterwert, snow: false = nie Schnee, ground: Bodenfläche,
   * bare: Bodenfläche ohne Schnee in voller Farbe wie die gemalten Werke, emit: leuchtet selbst, ohne Licht, Schnee und Schatten
   * (Glut, Flammen)). Ist this.team gesetzt, trägt die Fläche die Teamfarbe der Instanz (Werke).
   */
  info(o) {
    const z = o.emit ? 4 : o.bare ? 3 : o.snow === false ? 0 : o.ground ? 2 : 1;
    return [o.mat ? MAT_INDEX.get(o.mat) ?? 0 : 0, o.win ?? (this.team ? TEAM_WIN : NO_WIN), z];
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
    let cols = Array.isArray(col) ? col : null; // Farbe je Ecke (Verlauf, z. B. Glasfassade)
    if (o.n && dot(n, o.n) < 0) {
      pts = pts.slice().reverse();
      if (cols) cols = cols.slice().reverse();
      n = [-n[0], -n[1], -n[2]];
    }
    const [X, Y] = uvAxes(n);
    const C = cols ? cols.map(colOf) : colOf(col);
    const info = this.info(o);
    for (let k = 1; k < pts.length - 1; k++) {
      for (const j of [0, k, k + 1]) {
        const p = pts[j];
        this.vert(p, n, cols ? C[j] : C, [dot(p, X), dot(p, Y)], info);
      }
    }
  }

  /** Viereck auf einer Wand (face, plane) von a0 bis a1 und h0 bis h1, off vor der Wand. */
  facePanel(face, plane, a0, a1, h0, h1, col, off = 0, o = {}) {
    const p = onFace(face, plane);
    this.poly([p(a0, h0, off), p(a1, h0, off), p(a1, h1, off), p(a0, h1, off)], col, { ...o, n: FACE_N[face] });
  }

  /** Fläche am Boden (Rasen, Weg) auf Höhe h: ungeschattet in voller Farbe wie isokit.flat (nur Schatten und Schnee wirken). */
  flat(u0, u1, v0, v1, col, h = 0.05, o = {}) {
    this.poly([[u0, v0, h], [u1, v0, h], [u1, v1, h], [u0, v1, h]], col, { ground: true, ...o, mat: o.mat !== undefined ? o.mat : flatMat(col), n: [0, 0, 1] });
  }

  /**
   * Quader mit allen vier Wänden und Deckel (wie isokit.box, dort nur die sichtbaren). Wandfoto wallMat(wall), Deckel wie die Wand
   * oder flatMat(top). o.top = false: ohne Deckel (für parapet), o.bottom: mit Boden, o.mat/o.topMat: Fotos vorgeben, o.win: Wände
   * als Fenster (Leuchtwert wie winsAt, z. B. GLOW_NIGHT für Glaskanzeln und Laternen).
   */
  box(u0, u1, v0, v1, h0, h1, wall, top = wall, o = {}) {
    const mat = o.mat !== undefined ? o.mat : wallMat(wall);
    const w = { mat, snow: o.snow, win: o.win };
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
      // gegen den Uhrzeiger um die Außennormale: p00 → p10 → p11 (→ p01); inside: Innenwand (Umlaufsinn und Normalen umgekehrt)
      const [M0, M1] = o.inside ? [N0.map((x) => -x), N1.map((x) => -x)] : [N0, N1];
      const q = o.inside ? [p00, p11, p10] : [p00, p10, p11];
      const qn = [M0, M1, M1];
      const qt = o.inside ? [[x0, -h0], [x1, -h1], [x1, -h0]] : [[x0, -h0], [x1, -h0], [x1, -h1]];
      for (let j = 0; j < 3; j++) this.vert(q[j], qn[j], C, qt[j], info);
      if (r1 > 1e-6) {
        const q2 = o.inside ? [p00, p01, p11] : [p00, p11, p01];
        const qn2 = o.inside ? [M0, M0, M1] : [M0, M1, M0];
        const qt2 = o.inside ? [[x0, -h0], [x0, -h1], [x1, -h1]] : [[x0, -h0], [x1, -h1], [x0, -h1]];
        for (let j = 0; j < 3; j++) this.vert(q2[j], qn2[j], C, qt2[j], info);
      }
    }
    if (o.top !== false && !o.inside && r1 > 1e-6) {
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

  /** Busch (flache Kugel, wie isokit.bush); h: Boden darunter (Pflanzkübel auf einem Sockel). */
  bush(u, v, s = 1, t = 0, h = 0) {
    this.ball(u, v, h + 2.6 * s, 3.8 * s, LEAF[((t % 3) + 3) % 3][1], 3 * s, 8, 4);
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

  // ---------- Bauteile der Stadthäuser (Paket „Stadthäuser 3D“, Namen und Maße wie isokit.js bzw. townhouses.js) ----------

  /** Stab mit quadratischem Querschnitt (Breite w) von a nach b (Mast, Pfosten, Strebe; gemalt eine Linie der Stärke w), ohne Enden. */
  rod(a, b, w, col, o = {}) {
    const d = norm(sub(b, a));
    if (!d) return;
    const X = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]));
    const Y = cross(d, X);
    const r = w / 2;
    const c = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, t]) => [0, 1, 2].map((i) => (X[i] * s + Y[i] * t) * r));
    for (let k = 0; k < 4; k++) {
      const c0 = c[k];
      const c1 = c[(k + 1) % 4];
      const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
      this.poly([add(a, c0), add(a, c1), add(b, c1), add(b, c0)], col, { mat: null, snow: false, ...o, n: add(c0, c1) });
    }
  }

  /** Rohr (Kegelstumpf, n Seiten) entlang beliebiger Achse von a (Radius r0) nach b (r1), ohne Enden (Windsack). */
  tube(a, b, r0, r1, col, n = 8, o = {}) {
    const d = norm(sub(b, a));
    if (!d) return;
    const X = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]));
    const Y = cross(d, X);
    const at = (p, r, t) => [0, 1, 2].map((i) => p[i] + (X[i] * Math.cos(t) + Y[i] * Math.sin(t)) * r);
    for (let k = 0; k < n; k++) {
      const t0 = (k / n) * TAU;
      const t1 = ((k + 1) / n) * TAU;
      const tm = (t0 + t1) / 2;
      const hint = [0, 1, 2].map((i) => X[i] * Math.cos(tm) + Y[i] * Math.sin(tm));
      this.poly([at(a, r0, t0), at(a, r0, t1), at(b, r1, t1), at(b, r1, t0)], col, { mat: null, snow: false, ...o, n: hint });
    }
  }

  /** Kreisscheibe in einer Wandebene (Uhr), Mitte a entlang der Wand auf Höhe h, off vor der Wand (wie isokit.disc). */
  disc(face, plane, a, h, r, col, off = 0, n = 16, o = {}) {
    const p = onFace(face, plane);
    const pts = [];
    for (let k = 0; k < n; k++) pts.push(p(a + r * Math.cos((k / n) * TAU), h + r * Math.sin((k / n) * TAU), off));
    this.poly(pts, col, { snow: false, ...o, n: FACE_N[face] });
  }

  /** Kreis waagrecht auf Höhe h (Bodenmarke, Wasser, Rotor von oben; wie isokit.groundRing als Fläche). */
  ring(u, v, r, h, col, n = 24, o = {}) {
    const pts = [];
    for (let k = 0; k < n; k++) pts.push([u + r * Math.cos((k / n) * TAU), v + r * Math.sin((k / n) * TAU), h]);
    this.poly(pts, col, { ...o, n: [0, 0, 1] });
  }

  /**
   * Schaufenster (wie townhouses.storefront): dunkler Rahmen, Glasband (nachts beleuchtet), bunte Auslagen, Pfosten alle step,
   * Glastür bei doorAt (null = ohne).
   */
  storefront(face, plane, a0, a1, h0, h1, step, doorAt, seed = 0) {
    const F = (x0, x1, z0, z1, col, off, o = {}) => this.facePanel(face, plane, x0, x1, z0, z1, col, off, { mat: null, snow: false, ...o });
    F(a0 - 0.5, a1 + 0.5, h0 - 0.6, h1 + 0.5, '#3c3f42', 0.06);
    F(a0, a1, h0, h1, '#5a7f99', 0.1, { win: GLOW_NIGHT });
    const n = Math.max(2, Math.round((a1 - a0) / 2.2));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
      if (doorAt !== null && Math.abs(a - doorAt) < 2.6) continue;
      const c = ['#e2b04a', '#c8574a', '#6aa35a', '#e8e2d2', '#4f86b8'][(seed + i * 3) % 5];
      F(a - 0.7, a + 0.7, h0, h0 + 1.6 + rnd(seed + i) * 1.6, c, 0.14);
    }
    for (let a = a0 + step; a < a1 - 0.5; a += step) F(a - 0.3, a + 0.3, h0, h1, '#2c3034', 0.17);
    if (doorAt !== null) {
      F(doorAt - 1.7, doorAt + 1.7, 0, h1 - 0.8, '#2a3c4a', 0.2);
      F(doorAt - 0.25, doorAt + 0.25, 0, h1 - 0.8, '#c8cdd2', 0.23);
    }
  }

  /** Markise mit Streifen (cols abwechselnd), ragt d vor die Wand und fällt dabei um drop; vorn ein Volant (wie isokit.awning). */
  awning(face, plane, a0, a1, h, d, drop, cols, n = 8) {
    const p = onFace(face, plane);
    const out = FACE_N[face];
    const side = face === 's' || face === 'n' ? (s) => [s, 0, 0] : (s) => [0, s, 0];
    for (let i = 0; i < n; i++) {
      const b0 = a0 + ((a1 - a0) * i) / n;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const c = cols[i % 2];
      this.poly([p(b0, h, 0), p(b1, h, 0), p(b1, h - drop, d), p(b0, h - drop, d)], c, { mat: null, n: [out[0] * d, out[1] * d, drop] });
      this.facePanel(face, plane, b0, b1, h - drop - 1.5, h - drop, c, d, { mat: null, snow: false });
    }
    for (const [a, s, c] of [[a0, -1, cols[0]], [a1, 1, cols[(n - 1) % 2]]]) {
      this.poly([p(a, h, 0), p(a, h - drop, d), p(a, h - drop - 1.5, d)], c, { mat: null, snow: false, n: side(s) });
    }
  }

  /** Rundbogenfenster (Rechteck bis h1, darüber ein Halbkreis) mit hellem Rahmen und Kreuz (wie isokit.archWins). */
  archWins(face, plane, at, h0, h1, ww, o = {}) {
    const p = onFace(face, plane);
    const r = ww / 2;
    const shape = (a, e, off) => {
      const pts = [p(a - r - e, h0 - e, off), p(a + r + e, h0 - e, off)];
      for (let k = 0; k <= 8; k++) {
        const t = (k / 8) * Math.PI;
        pts.push(p(a + (r + e) * Math.cos(t), h1 + (r + e) * Math.sin(t), off));
      }
      return pts;
    };
    const fs = { s: 0, e: 5, n: 9, w: 13 }[face];
    at.forEach((a, i) => {
      this.poly(shape(a, 0.55, 0.08), o.frame ?? SILL, { snow: false, n: FACE_N[face] });
      const win = rnd((o.seed ?? 0) + i * 13 + fs) / (o.lit ?? 0.2);
      this.poly(shape(a, 0, 0.14), win <= 1 ? WARM : o.glass ?? GLASS, { win, snow: false, n: FACE_N[face] });
      this.facePanel(face, plane, a - 0.2, a + 0.2, h0, h1 + r, '#ebe8e0', 0.2, { snow: false });
      this.facePanel(face, plane, a - r, a + r, h1 - 0.2, h1 + 0.2, '#ebe8e0', 0.2, { snow: false });
    });
  }

  /** Halbrundes Fächerfenster (Giebel der Markthalle) mit Speichen (wie isokit.fanWin). */
  fanWin(face, plane, a, h, r) {
    const p = onFace(face, plane);
    const half = (rr, off) => {
      const pts = [];
      for (let k = 0; k <= 12; k++) pts.push(p(a + rr * Math.cos((k / 12) * Math.PI), h + rr * Math.sin((k / 12) * Math.PI), off));
      return pts;
    };
    this.poly(half(r + 0.7, 0.08), SILL, { snow: false, n: FACE_N[face] });
    this.poly(half(r, 0.14), GLASS, { snow: false, n: FACE_N[face] });
    for (let k = 1; k < 5; k++) {
      const t = (k / 5) * Math.PI;
      const [c, s] = [Math.cos(t), Math.sin(t)];
      const w = 0.22;
      this.poly([p(a - s * w, h + c * w, 0.2), p(a + s * w, h - c * w, 0.2), p(a + r * c + s * w, h + r * s - c * w, 0.2), p(a + r * c - s * w, h + r * s + c * w, 0.2)], '#ebe8e0', { snow: false, n: FACE_N[face] });
    }
  }

  /**
   * Tonnendach über [u0,u1]×[v0,v1], First entlang axis ('u' oder 'v'); Traufe auf h, Scheitel rh höher, Überstand 0,9 an den Seiten
   * und 0,6 an den Enden (wie isokit.vault), Giebel (Bogen in Wandfarbe) an beiden Enden.
   */
  vault(axis, u0, u1, v0, v1, h, rh, roof, wall, n = 10, mat = roofMat(roof, 'metal')) {
    const alongU = axis === 'u';
    const [a0, a1, c0, c1] = alongU ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const M = alongU ? (a, c, z) => [a, c, z] : (a, c, z) => [c, a, z];
    const cm = (c0 + c1) / 2;
    const w = (c1 - c0) / 2;
    const ov = 0.9;
    const at = (ww, t) => [cm - ww * Math.cos(t), h + rh * Math.sin(t)];
    for (let k = 0; k < n; k++) {
      const ta = (k / n) * Math.PI;
      const tb = ((k + 1) / n) * Math.PI;
      const tm = (ta + tb) / 2;
      const [ca, ha] = at(w + ov, ta);
      const [cb, hb] = at(w + ov, tb);
      this.poly([M(a0 - 0.6, ca, ha), M(a1 + 0.6, ca, ha), M(a1 + 0.6, cb, hb), M(a0 - 0.6, cb, hb)], roof, { mat, n: M(0, -rh * Math.cos(tm), (w + ov) * Math.sin(tm)) });
    }
    const wm = wallMat(wall);
    for (const [a, s] of [[a0, -1], [a1, 1]]) {
      const gab = [M(a, c0, h), M(a, c1, h)];
      for (let k = n - 1; k > 0; k--) {
        const [c, hh] = at(w, (k / n) * Math.PI);
        gab.push(M(a, c, hh));
      }
      this.poly(gab, wall, { mat: wm, snow: false, n: M(s, 0, 0) });
    }
  }

  /** Zeltdach (Pyramide) über dem Quadrat um (u, v) mit halber Seite s, Traufe h, Spitze rh höher (wie university.pyramid). */
  pyramid(u, v, s, h, rh, col) {
    const top = [u, v, h + rh];
    const c = [[u - s, v - s, h], [u + s, v - s, h], [u + s, v + s, h], [u - s, v + s, h]];
    const hint = [[0, -rh, s], [rh, 0, s], [0, rh, s], [-rh, 0, s]];
    for (let k = 0; k < 4; k++) this.poly([c[k], c[(k + 1) % 4], top], col, { mat: null, n: hint[k] });
  }

  /** Lüfter (Gehäuse mit dunklem Rotor) auf Höhe h (wie isokit.fan). */
  fan(u, v, h, r) {
    this.cyl(u, v, r, h, h + 1.1, '#8d9398', { n: 10, top: false });
    this.ring(u, v, r, h + 1.1, '#2b2f33', 10, { mat: null, snow: false });
    const b = r * 0.85;
    this.poly([[u - b, v - 0.22, h + 1.15], [u + b, v - 0.22, h + 1.15], [u + b, v + 0.22, h + 1.15], [u - b, v + 0.22, h + 1.15]], '#80868b', { snow: false, n: [0, 0, 1] });
    this.poly([[u - 0.22, v - b, h + 1.15], [u + 0.22, v - b, h + 1.15], [u + 0.22, v + b, h + 1.15], [u - 0.22, v + b, h + 1.15]], '#80868b', { snow: false, n: [0, 0, 1] });
  }

  /** Parabolantenne auf einem Sockel (wie isokit.dish): Schale nach vorn oben geneigt, vorn hell, hinten Kegel, Empfänger am Arm. */
  dish(u, v, h, r) {
    this.cyl(u, v, r * 0.22, h, h + r * 0.9, '#9aa0a5', { n: 8 });
    const C = [u, v, h + r * 1.25];
    const N = norm([0.35, 0.55, 0.75]);
    const X = norm(cross(N, [0, 0, 1]));
    const Y = cross(N, X);
    const n = 14;
    const rim = [];
    for (let k = 0; k < n; k++) {
      const t = (k / n) * TAU;
      rim.push([0, 1, 2].map((i) => C[i] + (X[i] * Math.cos(t) + Y[i] * Math.sin(t)) * r));
    }
    this.poly(rim, '#e4e7ea', { mat: null, snow: false, n: N });
    const back = [0, 1, 2].map((i) => C[i] - N[i] * r * 0.35);
    for (let k = 0; k < n; k++) this.poly([rim[(k + 1) % n], rim[k], back], '#b4b9bd', { mat: null, n: sub(rim[k], back) });
    this.rod(C, [0, 1, 2].map((i) => C[i] + N[i] * r * 0.75), 0.35, '#6d7277');
  }

  /** Gittermast (wie isokit.mast): vier Eckstiele von r0 unten nach r1 oben, Streben im Zickzack auf allen Seiten, rotes Licht. */
  mast(u, v, h0, h1, r0, r1, col = '#a7adb2', light = true) {
    const C = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    const pt = (c, t) => [u + c[0] * (r0 + (r1 - r0) * t), v + c[1] * (r0 + (r1 - r0) * t), h0 + (h1 - h0) * t];
    for (const c of C) this.rod(pt(c, 0), pt(c, 1), 0.6, col);
    const n = Math.max(3, Math.round((h1 - h0) / 5));
    for (let k = 0; k < n; k++) {
      for (let s = 0; s < 4; s++) {
        const [ca, cb] = k % 2 ? [C[s], C[(s + 1) % 4]] : [C[(s + 1) % 4], C[s]];
        this.rod(pt(ca, k / n), pt(cb, (k + 1) / n), 0.32, col);
      }
    }
    if (light) this.ball(u, v, h1 + 0.8, 1.1, '#ff4a3a', 1.1, 6, 3);
  }

  /** Zaun um [u0,u1]×[v0,v1] (alle vier Seiten; gemalt in 'back' und 'front' geteilt): zwei Latten, Pfosten etwa alle 4,5. */
  fence(u0, u1, v0, v1, h = 3.2) {
    const col = '#4a5056';
    const sides = [[[u0, v1], [u1, v1]], [[u1, v1], [u1, v0]], [[u1, v0], [u0, v0]], [[u0, v0], [u0, v1]]];
    for (const [[a0, b0], [a1, b1]] of sides) {
      for (const hh of [h, h * 0.55]) this.rod([a0, b0, hh], [a1, b1, hh], 0.3, col);
      const n = Math.max(1, Math.round(Math.hypot(a1 - a0, b1 - b0) / 4.5));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        this.rod([a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 0], [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, h + 0.3], 0.4, col);
      }
    }
  }

  /** Senkrechte Rippen der Metallverkleidung auf allen vier Wänden (wie isokit.ribs), etwas dunkler als die Wand col. */
  ribs(u0, u1, v0, v1, h0, h1, step = 1.8, col = '#5a636b') {
    const c = shade(col, 0.16);
    for (let a = u0 + step; a < u1 - 0.3; a += step) {
      this.facePanel('s', v1, a - 0.25, a + 0.25, h0, h1, c, 0.08, { mat: null, snow: false });
      this.facePanel('n', v0, a - 0.25, a + 0.25, h0, h1, c, 0.08, { mat: null, snow: false });
    }
    for (let a = v0 + step; a < v1 - 0.3; a += step) {
      this.facePanel('e', u1, a - 0.25, a + 0.25, h0, h1, c, 0.08, { mat: null, snow: false });
      this.facePanel('w', u0, a - 0.25, a + 0.25, h0, h1, c, 0.08, { mat: null, snow: false });
    }
  }

  /** Lüftungs- oder Klimakasten auf dem Dach mit dunkler Lüfteröffnung (wie isokit.acUnit). */
  acUnit(u, v, h, s = 2.4, col = '#b9bdc0') {
    this.box(u - s, u + s, v - s * 0.7, v + s * 0.7, h, h + s * 1.1, col, tint(col, 0.12), { mat: null });
    this.ring(u, v, s * 0.55, h + s * 1.1 + 0.05, '#5f6468', 10, { mat: null, snow: false });
  }

  /** Laterne: Mast und Leuchte (nachts hell). */
  lamp(u, v, h = 9) {
    this.rod([u, v, 0], [u, v, h - 1.2], 0.9, '#3e4246');
    this.box(u - 0.8, u + 0.8, v - 0.8, v + 0.8, h - 1.2, h, '#f1df9a', '#55595d', { mat: null, win: GLOW_NIGHT, snow: false });
  }

  /** Fahnenmast mit Fahne in Teamfarbe (wie isokit.flagpole: Fahne 8 lang nach Bild-rechts in Drehung 0, beidseitig). */
  flagpole(u, v, h0, len, color, team = false) {
    const H = h0 + len;
    this.rod([u, v, h0], [u, v, H], 0.7, '#d9d6cc');
    const d = 8 * Math.SQRT1_2;
    const pts = [[u, v, H], [u + d, v - d, H - 1.2], [u + d, v - d, H - 5.6], [u, v, H - 5]];
    this.team = team; // Fahne in Teamfarbe der Instanz (Werke)
    this.poly(pts, color, { mat: null, snow: false, n: [1, 1, 0] });
    this.poly(pts, color, { mat: null, snow: false, n: [-1, -1, 0] });
    this.team = false;
  }

  /** Krankenwagen oder Lieferwagen (wie isokit.van): hoher Kasten, Band an beiden Seiten, Frontscheibe vorn (+u bzw. +v), Blaulicht. */
  van(u, v, along, col, band, light = false) {
    const [hu, hv] = along === 'u' ? [5, 2.3] : [2.3, 5];
    this.box(u - hu, u + hu, v - hv, v + hv, 0.6, 6, col, tint(col, 0.05), { mat: 'paint', snow: false });
    const P = (face, plane, a0, a1, h0, h1, c) => this.facePanel(face, plane, a0, a1, h0, h1, c, 0.06, { snow: false });
    if (along === 'u') {
      if (band) for (const [f, pl] of [['s', v + hv], ['n', v - hv]]) P(f, pl, u - hu, u + hu, 2.4, 3.5, band);
      P('e', u + hu, v - hv + 0.5, v + hv - 0.5, 3.4, 5.4, '#2c3a47');
    } else {
      if (band) for (const [f, pl] of [['e', u + hu], ['w', u - hu]]) P(f, pl, v - hv, v + hv, 2.4, 3.5, band);
      P('s', v + hv, u - hu + 0.5, u + hu - 0.5, 3.4, 5.4, '#2c3a47');
    }
    if (light) {
      const [lu, lv] = along === 'u' ? [u + hu - 1.6, v] : [u, v + hv - 1.6];
      const [su, sv] = along === 'u' ? [0.8, 1.4] : [1.4, 0.8];
      this.box(lu - su, lu + su, lv - sv, lv + sv, 6, 6.9, '#3d7bf0', '#7fb0ff', { mat: null, snow: false });
    }
  }

  /** Kiste aus Holz (wie isokit.crate). */
  crate(u, v, s = 1.1, h = 2.2, col = '#a07a4f') {
    this.box(u - s, u + s, v - s, v + s, 0, h, col, tint(col, 0.14), { mat: 'wood' });
  }

  /** Pflaster eines Platzes (ganzes Grundstück) mit feinen Fugen (wie isokit.cobble). */
  cobble(col = '#d2c6ad') {
    const o = { snow: false }; // gemalt schneefrei wie alle Plätze
    this.flat(-25, 25, -25, 25, col, 0.02, o);
    const j = shade(col, 0.07);
    for (let k = -21; k <= 21; k += 6) {
      this.flat(k - 0.25, k + 0.25, -25, 25, j, 0.04, o);
      this.flat(-25, 25, k - 0.25, k + 0.25, j, 0.04, o);
    }
  }

  /** Solarzellen: Reihe von u0 bis u1 ab v0, dv tief, schräg von h0 auf h1 (zur Sonne geneigt), Zellfugen, Rückseite, zwei Stützen. */
  solar(u0, u1, v0, dv, h0, h1) {
    const pts = [[u0, v0, h0], [u1, v0, h0], [u1, v0 + dv, h1], [u0, v0 + dv, h1]];
    this.poly(pts, '#2b4a78', { mat: null, snow: true, n: [0, -(h1 - h0), dv] });
    this.poly(pts, '#55595d', { mat: null, snow: false, n: [0, h1 - h0, -dv] });
    const e = 0.05;
    for (let u = u0 + 4; u < u1 - 0.5; u += 4.2) {
      this.poly([[u - 0.2, v0, h0 + e], [u + 0.2, v0, h0 + e], [u + 0.2, v0 + dv, h1 + e], [u - 0.2, v0 + dv, h1 + e]], '#9fb4cf', { mat: null, snow: false, n: [0, -(h1 - h0), dv] });
    }
    for (const u of [u0 + 1, u1 - 1]) this.rod([u, v0 + dv - 0.3, h0 - 0.4], [u, v0 + dv - 0.3, h1], 0.4, '#7d8186');
  }

  /** Hubschrauber-Landeplatz (Boden oder Dach, wie townhouses.helipad): Scheibe, weißer Ring, „H“, Randlichter; unbeleuchtet wie Boden. */
  helipad(u, v, r, h = 0) {
    const g = { ground: true, mat: null, snow: false };
    this.ring(u, v, r + 1, h + 0.03, '#8f8e86', 24, g);
    this.ring(u, v, r, h + 0.06, '#45484c', 24, g);
    this.ring(u, v, r * 0.86, h + 0.09, '#ecebe4', 24, g);
    this.ring(u, v, r * 0.76, h + 0.12, '#45484c', 24, g);
    const b = r * 0.38;
    const w = r * 0.27;
    const t = r * 0.075;
    const m = '#f2f0e6';
    this.flat(u - w - t, u - w + t, v - b, v + b, m, h + 0.15, g);
    this.flat(u + w - t, u + w + t, v - b, v + b, m, h + 0.15, g);
    this.flat(u - w, u + w, v - t, v + t, m, h + 0.15, g);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const x = u + (r + 0.45) * Math.cos(a);
      const y = v + (r + 0.45) * Math.sin(a);
      this.flat(x - 0.45, x + 0.45, y - 0.45, y + 0.45, k % 2 ? '#ffe27a' : '#8af08f', h + 0.18, g);
    }
  }

  /** Brunnen (wie townhouses.fountain): Becken mit Rand und Wasser, Säule mit Schale, Strahl. */
  fountain(u, v, r) {
    this.cyl(u, v, r, 0, 1.8, '#bdb6a6', { n: 16, top: false });
    this.ring(u, v, r, 1.8, '#ddd7ca', 16, { mat: null });
    this.ring(u, v, r - 0.8, 1.85, '#6fa8d2', 16, { mat: null, snow: false });
    this.cyl(u, v, 0.7, 1.5, 4.8, '#cfc8b8', { n: 8 });
    this.frustum(u, v, 0.8, 2.3, 4.5, 5.3, '#cfc8b8', { n: 12, topCol: '#8fbfdf' });
    this.ball(u, v, 7.4, 0.9, '#cde8fa', 1.9, 8, 4);
  }

  /** Uhr an einer Wand (wie townhouses.clockFace): dunkler Ring, Zifferblatt, zwei Zeiger. */
  clockFace(face, plane, a, h, r) {
    this.disc(face, plane, a, h, r + 0.5, '#3b3f44', 0.12);
    this.disc(face, plane, a, h, r, '#f4f1e6', 0.2);
    this.facePanel(face, plane, a - 0.28, a + 0.28, h, h + r * 0.75, '#2b2b2b', 0.25, { snow: false });
    const p = onFace(face, plane);
    const [ex, ey] = [r * 0.5, -r * 0.2];
    const l = Math.hypot(ex, ey);
    const [nx, ny] = [(-ey / l) * 0.35, (ex / l) * 0.35];
    this.poly([p(a - nx, h - ny, 0.25), p(a + nx, h + ny, 0.25), p(a + ex + nx, h + ey + ny, 0.25), p(a + ex - nx, h + ey - ny, 0.25)], '#2b2b2b', { snow: false, n: FACE_N[face] });
  }

  // ---------- Bauteile der Werke (Paket „Werke 3D“, Namen und Maße wie isokit.js bzw. works.js) ----------

  /** Fläche in einer Wandebene mit beliebigem Umriss: Punkte [a, h] entlang der Wand (Ofentür mit Rundbogen), off vor der Wand. */
  facePoly(face, plane, pts, col, off = 0, o = {}) {
    const p = onFace(face, plane);
    this.poly(pts.map(([a, h]) => p(a, h, off)), col, { mat: null, snow: false, ...o, n: FACE_N[face] });
  }

  /** Körper aus übereinander gesetzten Kegelstümpfen: Profil [[r, h], …] von unten nach oben (Kühlturm, Schüttkegel), glatt, ohne Deckel. */
  lathe(u, v, prof, col, o = {}) {
    for (let i = 0; i + 1 < prof.length; i++) this.frustum(u, v, prof[i][0], prof[i + 1][0], prof[i][1], prof[i + 1][1], col, { n: 16, ...o, top: false });
  }

  /** Farbring um einen Zylinder (wie isokit.band, rundum): r = Radius des Zylinders, gleiche Seitenzahl n wie er. */
  band(u, v, r, h0, h1, col, n = 16) {
    this.frustum(u, v, r + 0.06, r + 0.06, h0, h1, col, { n, top: false, mat: null, snow: false });
  }

  /** Naht um einen Zylinder (wie isokit.seam): dünner Ring auf Höhe h. */
  seam(u, v, r, h, col = '#7c8288', n = 16) {
    this.frustum(u, v, r + 0.05, r + 0.05, h - 0.18, h + 0.18, col, { n, top: false, mat: null, snow: false });
  }

  /**
   * Runder Schornstein (wie works.stack): Kegelstumpf mit Nähten, roten Ringen (o.bands), dunkler Krone, Mündung und Flugwarnlicht (o.light).
   * o.color (Standard #d6d2c9), o.n Seiten.
   */
  stack(u, v, r0, r1, H, o = {}) {
    const col = o.color ?? '#d6d2c9';
    const n = o.n ?? 14;
    const rAt = (h) => r0 + ((r1 - r0) * h) / H;
    this.frustum(u, v, r0, rAt(H - 1.4), 0, H - 1.4, col, { n, top: false });
    const step = Math.max(9, H / 8);
    for (let h = step; h < H - 6; h += step) this.seam(u, v, rAt(h), h, shade(col, 0.16), n);
    for (let k = 0; k < (o.bands ?? 0); k++) {
      const h1 = H - 2 - k * 10;
      this.frustum(u, v, rAt(h1 - 5) + 0.06, rAt(h1) + 0.06, h1 - 5, h1, '#c0392b', { n, top: false, mat: null, snow: false });
    }
    this.cyl(u, v, r1 + 0.5, H - 1.4, H, shade(col, 0.22), { n, topCol: shade(col, 0.3) });
    this.ring(u, v, r1 * 0.8, H + 0.06, '#262627', n, { mat: null, snow: false });
    if (o.light) this.ball(u, v, H + 1.2, 0.9, '#ff4a3a', 0.9, 6, 3);
  }

  /** Kugeltank auf acht Stützen (wie works.sphere): Kugel r, Unterkante auf h0, Treppe zur Kuppe. */
  sphere(u, v, r, h0, col = '#e4e7ea') {
    for (let k = 0; k < 8; k++) {
      const t = ((k + 0.5) / 8) * TAU;
      const x = u + r * 0.82 * Math.cos(t);
      const y = v + r * 0.82 * Math.sin(t);
      this.rod([x, y, 0], [x, y, h0 + r * 0.45], 1.2, '#7d858c');
    }
    this.ball(u, v, h0 + r, r, col, r, 14, 7);
    this.rod([u + r * 1.25, v + r * 0.5, 0], [u + r * 0.35, v + r * 0.25, h0 + 2 * r - 0.4], 0.8, '#464b55');
  }

  /** Liegender Zylinder entlang axis ('u' oder 'v') von a0 bis a1 bei c (quer), Achse auf Höhe h, Radius r, mit beiden Stirnseiten (wie works.hcyl). */
  hcyl(axis, a0, a1, c, h, r, col, n = 14, o = {}) {
    const P = axis === 'u' ? (a, cc, z) => [a, cc, z] : (a, cc, z) => [cc, a, z];
    const ring = (a) => Array.from({ length: n }, (_, k) => P(a, c + r * Math.cos((k / n) * TAU), h + r * Math.sin((k / n) * TAU)));
    const r0 = ring(a0);
    const r1 = ring(a1);
    for (let k = 0; k < n; k++) {
      const tm = ((k + 0.5) / n) * TAU;
      this.poly([r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]], col, { mat: null, snow: false, ...o, n: P(0, Math.cos(tm), Math.sin(tm)) });
    }
    this.poly(r1, col, { mat: null, snow: false, ...o, n: P(1, 0, 0) });
    this.poly(r0, col, { mat: null, snow: false, ...o, n: P(-1, 0, 0) });
  }

  /** Rohr als Linienzug durch Punkte [u, v, h], d = Durchmesser (wie works.pipe). */
  pipe(pts, d, col = '#9aa1a8') {
    for (let i = 0; i + 1 < pts.length; i++) this.tube(pts[i], pts[i + 1], d / 2, d / 2, col, 6);
  }

  /** Rohrbrücke entlang axis von a0 bis a1 bei c (quer), Höhe h: Stützen alle 9 mit Traverse, Rohre in den Farben cols (wie works.rack). */
  rack(axis, a0, a1, c, h, cols = ['#a3aab0', '#c9a24a', '#8a6f5a']) {
    const Q = axis === 'u' ? (a, cc, z) => [a, cc, z] : (a, cc, z) => [cc, a, z];
    for (let a = a0; a <= a1 + 0.1; a += 9) {
      this.rod(Q(a, c - 2.2, 0), Q(a, c - 2.2, h), 0.8, '#6b7177');
      this.rod(Q(a, c + 2.2, 0), Q(a, c + 2.2, h), 0.8, '#6b7177');
      this.rod(Q(a, c - 2.6, h), Q(a, c + 2.6, h), 0.8, '#6b7177');
    }
    cols.forEach((col, k) => {
      const cc = c - 1.5 + (k * 3) / Math.max(1, cols.length - 1);
      this.tube(Q(a0, cc, h + 0.7), Q(a1, cc, h + 0.7), 0.55, 0.55, col, 6);
    });
  }

  /** Leitung zwischen zwei Punkten [u, v, h] mit Durchhang sag in der Mitte (wie works.wire), vier dünne Stäbe. */
  wire(a, b, sag = 2.5) {
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - 4 * sag * t * (1 - t)];
    for (let k = 0; k < 4; k++) this.rod(at(k / 4), at((k + 1) / 4), 0.3, '#2d2d30');
  }

  /** Überdachte Förderbrücke von a = [u, v, h] nach b, Breite w, Höhe hh: Wände mit Fensterband, Dach, Stirnseiten, Stützen (wie works.gallery). */
  gallery(a, b, w = 3.2, hh = 3, col = '#b3b7ba') {
    const [u0, v0, h0] = a;
    const [u1, v1, h1] = b;
    const L = Math.hypot(u1 - u0, v1 - v0);
    const nu = -(v1 - v0) / L;
    const nv = (u1 - u0) / L;
    const pu = (nu * w) / 2;
    const pv = (nv * w) / 2;
    const P = (t, side, h) => [u0 + (u1 - u0) * t + pu * side, v0 + (v1 - v0) * t + pv * side, h0 + (h1 - h0) * t + h];
    for (const s of [1, -1]) {
      this.poly([P(0, s, 0), P(1, s, 0), P(1, s, hh), P(0, s, hh)], col, { mat: null, snow: false, n: [nu * s, nv * s, 0] });
      this.poly([P(0, s, hh * 0.45), P(1, s, hh * 0.45), P(1, s, hh * 0.65), P(0, s, hh * 0.65)].map(([x, y, z]) => [x + nu * s * 0.06, y + nv * s * 0.06, z]), '#32404d', { mat: null, snow: false, n: [nu * s, nv * s, 0] });
    }
    this.poly([P(0, -1, hh), P(1, -1, hh), P(1, 1, hh), P(0, 1, hh)], tint(col, 0.06), { mat: null, n: [0, 0, 1] });
    for (const [t, s] of [[0, -1], [1, 1]]) this.poly([P(t, -1, 0), P(t, 1, 0), P(t, 1, hh), P(t, -1, hh)], shade(col, 0.2), { mat: null, snow: false, n: [(u1 - u0) * s, (v1 - v0) * s, 0] });
    const n = Math.max(1, Math.round(L / 12));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const h = h0 + (h1 - h0) * t;
      if (h < 2) continue;
      for (const s of [1, -1]) this.rod([P(t, s, 0)[0], P(t, s, 0)[1], 0], [P(t, s, 0)[0], P(t, s, 0)[1], h], 0.8, '#6b7075');
    }
  }

  /** Förderband von (u0, v0, h0) nach (u1, v1, h1) auf Stützen (wie isokit.conveyor): dunkles Band, helle Randschiene, Stützen alle 7. */
  conveyor(u0, v0, h0, u1, v1, h1, w = 1.3) {
    const L = Math.hypot(u1 - u0, v1 - v0);
    const n = Math.max(1, Math.round(L / 7));
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const h = h0 + (h1 - h0) * t;
      if (h > 0.5) this.rod([u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, 0], [u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, h], 0.7, '#5d6266');
    }
    const pu = (-(v1 - v0) / L) * (w / 2);
    const pv = ((u1 - u0) / L) * (w / 2);
    this.poly([[u0 + pu, v0 + pv, h0], [u1 + pu, v1 + pv, h1], [u1 - pu, v1 - pv, h1], [u0 - pu, v0 - pv, h0]], '#3b3e41', { mat: null, n: [0, 0, 1] });
    for (const s of [1, -1]) this.rod([u0 + pu * s, v0 + pv * s, h0 + 0.35], [u1 + pu * s, v1 + pv * s, h1 + 0.35], 0.5, '#9aa0a5');
  }

  /** Schüttkegel (Erz, Lehm, Kohle; wie isokit.heap): gewölbtes Profil, r am Fuß, h hoch; ohne Schnee wie gemalt. */
  heap(u, v, r, h, col, n = 12) {
    const prof = [[1, 0], [0.69, 0.4], [0.425, 0.7], [0.19, 0.9], [0, 1]];
    this.lathe(u, v, prof.map(([a, b]) => [a * r, b * h]), col, { n, snow: false });
  }

  /** Schienen entlang u bei v mit Schwellen alle 1,6 und zwei Schienenköpfen (wie isokit.rails). */
  rails(u0, u1, v, h = 0.14) {
    const g = { bare: true, mat: null };
    for (let a = u0; a <= u1; a += 1.6) this.flat(a - 0.4, a + 0.4, v - 1.5, v + 1.5, '#6b5a48', h, g);
    for (const d of [-0.95, 0.95]) this.box(u0, u1, v + d - 0.3, v + d + 0.3, h, h + 0.55, '#45484b', '#45484b', { mat: null, snow: false });
  }

  /** Holzstapel (Stämme entlang u, Prisma mit zwei Hangflächen, Stirnscheiben an beiden Enden; wie isokit.logPile). */
  logPile(u0, u1, v0, v1, rows) {
    const r = (v1 - v0) / (2 * rows);
    const H = r * (2 + 1.7 * (rows - 1));
    const vm = (v0 + v1) / 2;
    this.poly([[u0, v0, 0], [u1, v0, 0], [u1, vm, H], [u0, vm, H]], '#6e4c2e', { mat: null, snow: false, n: [0, -H, r * rows] });
    this.poly([[u0, vm, H], [u1, vm, H], [u1, v1, 0], [u0, v1, 0]], '#7d5734', { mat: null, snow: false, n: [0, H, r * rows] });
    this.poly([[u1, v0, 0], [u1, v1, 0], [u1, vm, H]], '#5d4027', { mat: null, snow: false, n: [1, 0, 0] });
    this.poly([[u0, v0, 0], [u0, v1, 0], [u0, vm, H]], '#5d4027', { mat: null, snow: false, n: [-1, 0, 0] });
    for (let row = 0; row < rows; row++) {
      for (let k = 0; k < rows - row; k++) {
        const vv = v0 + r * (1 + row) + k * 2 * r;
        const hh = r + row * r * 1.7;
        this.disc('e', u1, vv, hh, r * 0.92, '#dcb47e', 0.1, 10);
        this.disc('w', u0, vv, hh, r * 0.92, '#dcb47e', 0.1, 10);
      }
    }
  }

  /** Schuttkegel mit Grat (Kohlemiete, wie works.pile): Walmform ohne Dachfoto, Grat entlang der langen Seite. */
  mound(u0, u1, v0, v1, h, col) {
    const along = u1 - u0 >= v1 - v0;
    const P = along ? (a, b, z) => [a, b, z] : (a, b, z) => [b, a, z];
    const [A0, A1, B0, B1] = along ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const w = (B1 - B0) / 2;
    const bm = (B0 + B1) / 2;
    const top = h + 0.7;
    const r1 = P(A0 + w, bm, top);
    const r2 = P(A1 - w, bm, top);
    this.poly([P(A0, B0, 0), P(A1, B0, 0), r2, r1], col, { mat: null, n: P(0, -top, w) });
    this.poly([P(A0, B1, 0), P(A1, B1, 0), r2, r1], col, { mat: null, n: P(0, top, w) });
    this.poly([P(A0, B0, 0), r1, P(A0, B1, 0)], col, { mat: null, n: P(-top, 0, w) });
    this.poly([P(A1, B0, 0), r2, P(A1, B1, 0)], col, { mat: null, n: P(top, 0, w) });
  }

  // ---------- Bauteile der Großbauten (Paket „Großbauten 3D“, Namen wie university.js bzw. cityhall.js) ----------

  /**
   * Rippen einer Kuppel (wie university.dome, cityhall.domeShape): count Meridiane als schmale Bänder der Breite w knapp über der
   * Ellipsoid-Kappe (Mitte u, v, Fuß h, Halbachsen r und rz), um phase gedreht; sehr dünn, damit sie wenige Dreiecke kosten.
   */
  domeRibs(u, v, h, r, rz, count, col, segs = 8, w = 0.8, phase = 0) {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * TAU;
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      const at = (f) => {
        const b = (f * Math.PI) / 2;
        return [u + ca * Math.cos(b) * (r + 0.3), v + sa * Math.cos(b) * (r + 0.3), h + Math.sin(b) * (rz + 0.3), Math.cos(b)];
      };
      for (let j = 0; j < segs; j++) {
        const p0 = at(j / segs);
        const p1 = at((j + 1) / segs);
        const w0 = (w / 2) * Math.max(0.15, p0[3]);
        const w1 = (w / 2) * Math.max(0.15, p1[3]);
        const bm = (((j + 0.5) / segs) * Math.PI) / 2;
        this.poly(
          [[p0[0] + sa * w0, p0[1] - ca * w0, p0[2]], [p0[0] - sa * w0, p0[1] + ca * w0, p0[2]], [p1[0] - sa * w1, p1[1] + ca * w1, p1[2]], [p1[0] + sa * w1, p1[1] - ca * w1, p1[2]]],
          col,
          { mat: null, snow: false, n: [(ca * Math.cos(bm)) / r, (sa * Math.cos(bm)) / r, Math.sin(bm) / rz] },
        );
      }
    }
  }

  /** Fenster rund um einen Zylinder (Tambour, Laterne): je Winkel in angles ein Viereck der Breite w von h0 bis h1 knapp vor der Wand. */
  cylWins(u, v, r, h0, h1, angles, w, col, o = {}) {
    for (const a of angles) {
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      const c = [u + ca * (r + 0.12), v + sa * (r + 0.12)];
      const [tx, ty] = [-sa * (w / 2), ca * (w / 2)];
      this.poly([[c[0] - tx, c[1] - ty, h0], [c[0] + tx, c[1] + ty, h0], [c[0] + tx, c[1] + ty, h1], [c[0] - tx, c[1] - ty, h1]], col, { mat: null, snow: false, ...o, n: [ca, sa, 0] });
    }
  }

  /** Säulenkranz um einen Zylinder (Tambour des Rathauses): n Säulen mit Radius cr auf dem Kreis r, von h0 bis h1. */
  colonnade(u, v, r, h0, h1, n, col, cr = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * TAU;
      this.cyl(u + Math.cos(a) * r, v + Math.sin(a) * r, cr, h0, h1, col, { n: 6, mat: null });
    }
  }

  /** Fahne (Rechteck der Länge w nach Bild-rechts in Drehung 0, Höhe hgt, Oberkante h) beidseitig; team: Farbe der Instanz (wie wave in cityhall.js). */
  banner(u, v, h, w, hgt, color, team = false) {
    const d = w * Math.SQRT1_2;
    const pts = [[u, v, h], [u + d, v - d, h], [u + d, v - d, h - hgt], [u, v, h - hgt]];
    const was = this.team;
    this.team = team;
    this.poly(pts, color, { mat: null, snow: false, n: [1, 1, 0] });
    this.poly(pts, color, { mat: null, snow: false, n: [-1, -1, 0] });
    this.team = was;
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
varying vec3 vTeam;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vec3 r = mat3(modelMatrix) * normal; // three-Raum → zurück in Spielachsen (wie units3d.js)
  #ifdef USE_INSTANCING
  mat3 mI = mat3(instanceMatrix); // Instanz um z gedreht und in x, y gestreckt (Kartenstadt 3D): Normale mit der Gegenstreckung
  vec3 sI = vec3(length(mI[0]), length(mI[1]), length(mI[2]));
  r = mat3(modelMatrix) * (mI * (normal / (sI * sI)));
  #endif
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vUv = aUv;
  vInfo = aInfo;
  #ifdef USE_INSTANCING_COLOR
  vTeam = instanceColor; // Teamfarbe der Instanz (Werke)
  #else
  vTeam = color;
  #endif
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
varying vec3 vTeam;
void main() {
  vec3 n = normalize(vN);
  vec3 c = abs(vInfo.y - ${TEAM_WIN.toFixed(1)}) < 0.5 ? vTeam : vCol;
  // Schnee auf allem, was nach oben zeigt (Dächer, Rasen), gemischt wie season.js snowy (info.z: 0 nie, 1 Dach, 2 Boden, 3 Boden ohne Schnee, 4 Glut)
  c = mix(c, uSnowCol, uSnow * (vInfo.z > 2.5 ? 0.0 : min(vInfo.z, 1.0)) * smoothstep(0.2, 0.45, n.z) * ${SNOW_MIX.toFixed(2)});
  int m = int(vInfo.x + 0.5) - 1;
  if (m >= 0 && uTexOn > 0.5) {
    float t = texture(uTex, vec3(vUv / uTile[m], float(m))).r;
    vec3 o = mix(2.0 * c * t, 1.0 - 2.0 * (1.0 - c) * (1.0 - t), step(0.5, c)); // „overlay“ wie materials.js
    c = mix(c, o, uAlpha[m]);
  }
  float d = max(0.0, dot(n, uLight));
  float k = vInfo.z > 1.5 ? 1.0 : 0.56 + 0.44 * d; // Bodenflächen ungeschattet wie gemalt
  #ifdef USE_SHADOWMAP
  if (vInfo.z < 3.5) k *= 1.0 - uShade * (1.0 - getShadowMask()) * smoothstep(0.0, 0.2, d); // wie der Schattenfänger // nur der Sonne zugewandte Flächen
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

/** Mesh eines Werks mit Teamfarbe (Prüfteil, Fotos): InstancedMesh mit einer Instanz; die Teile mit TEAM_WIN nehmen die Farbe color. */
export function kitTeamMesh(geometry, material, color) {
  const m = new THREE.InstancedMesh(geometry, material, 1);
  m.setMatrixAt(0, new THREE.Matrix4());
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colOf(color)), 3);
  m.frustumCulled = false;
  m.castShadow = true;
  m.receiveShadow = true;
  m.layers.enable(CAST);
  return m;
}
