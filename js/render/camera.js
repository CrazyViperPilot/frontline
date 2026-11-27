// Kamera: Weltausschnitt, Zoom und Umrechnung Welt <-> Bildschirm (docs/archiv/verlauf.md §5 render/camera.js). Kein DOM.
import { clamp } from './color.js';

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;
// Freie Kamera (Paket „Freie Kamera“, nur Ansicht 3D): Neigung des Blicks unter die Waagrechte; 30° ist die Iso-Neigung aller gemalten Bilder.
export const TILT0 = Math.PI / 6;
export const TILT_MIN = Math.PI / 6;
export const TILT_MAX = Math.PI / 3;
const QUARTER = Math.PI / 2;

// Isometrische Ansicht: Bodenebene um 45° gedreht und in der Höhe halbiert (Weltachse x → rechts unten, y → links unten).
// Bildschirm = Mitte + zoom · ISO · (Welt − Kamera) mit ISO = [[K, −K], [K/2, K/2]].
export const ISO_K = Math.SQRT1_2;
// Drehung der isometrischen Ansicht in 90°-Schritten: Matrix [ra, rb, rc, rd] auf den Abstand zur Kamera (rx = ra·dx + rb·dy, ry = rc·dx + rd·dy).
export const ROT = [
  [1, 0, 0, 1],
  [0, -1, 1, 0],
  [-1, 0, 0, -1],
  [0, 1, -1, 0],
];


export class Camera {
  constructor(mapW, mapH) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.x = mapW / 2; // Weltmitte im Bild
    this.y = mapH / 2;
    this.zoom = 1;
    this.zoomMin = ZOOM_MIN; // Karteneditor setzt weitere Grenzen
    this.zoomMax = ZOOM_MAX;
    this.iso = false; // isometrische Ansicht (Renderer und Eingabe fragen dieses Flag)
    this.rot = 0; // isometrisch: Drehung 0–3 (je 90°); mit freier Kamera die nächste Vierteldrehung (gemalte Bilder wählen danach)
    // Freie Kamera (nur Ansicht 3D, three): Drehung = rot · 90° + turn (turn in −45° … 45°), Neigung tilt (30° … 60°).
    // Ohne three wirken beide nicht (die klassische Ansicht rechnet genau wie vorher mit ROT und Neigung 30°).
    this.turn = 0;
    this.tilt = TILT0;
    this.three = false; // isometrisch mit three.js zeichnen (Ansicht „3D“, render3d/renderer3d.js); Projektion wie Iso
    this.viewW = 800;
    this.viewH = 600;
    this.insetTop = 0; // vom HUD verdeckte Höhe oben/unten (CSS-Pixel); centerOn legt Ziele in die freie Mitte dazwischen
    this.insetBottom = 0;
    // Höhengelände (game/relief.js), nur isometrisch wirksam: Punkte am Boden erscheinen um ihre Geländehöhe angehoben.
    // Der Renderer setzt es nur, wenn er das Gelände auch in 3D zeichnet (sonst bleibt der Boden flach und relief null).
    this.relief = null;
    this.pinned = null; // feste Geländehöhe für das gerade gezeichnete Objekt (pin/unpin), sonst null
  }

  /** Freie Kamera wirksam (Ansicht 3D mit Zusatzdrehung oder anderer Neigung als 30°)? */
  free() {
    return this.three && (this.turn !== 0 || this.tilt !== TILT0);
  }

  /** Drehmatrix [ra, rb, rc, rd] auf den Abstand zur Kamera (wie ROT[rot]; mit freier Kamera stufenlos um rot · 90° + turn). */
  axes() {
    if (!this.three || !this.turn) return ROT[this.rot];
    const a = this.rot * QUARTER + this.turn;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, -s, s, c];
  }

  /** Drehung der Ansicht im Bogenmaß (rot · 90° + turn), 0 … 2π. */
  yaw() {
    const a = this.rot * QUARTER + (this.three ? this.turn : 0);
    return a < 0 ? a + 2 * Math.PI : a;
  }

  /** Neigung, mit der gerechnet wird (ohne three immer 30°). */
  tiltNow() {
    return this.three ? this.tilt : TILT0;
  }

  /** Stauchung des Bodens in der Tiefe: sin(Neigung), bei 30° genau 0,5. */
  squash() {
    return !this.three || this.tilt === TILT0 ? 0.5 : Math.sin(this.tilt);
  }

  /** Faktor für Höhen im Bild: cos(Neigung) / cos 30°, bei 30° genau 1 (eine Höhe h hebt h · zoom · heightK Pixel). */
  heightK() {
    return !this.three || this.tilt === TILT0 ? 1 : Math.cos(this.tilt) / Math.cos(TILT0);
  }

  /** Bildschirmpixel, um die eine Höhe h (Welt-px) einen Punkt anhebt (h · zoom bei Neigung 30°). */
  heightPx(h) {
    return h * this.zoom * this.heightK();
  }

  /** Bildschirm-Anhebung (Pixel) des Geländes am Weltpunkt; während pin() die feste Höhe. */
  lift(x, y) {
    if (!this.iso || !this.relief) return 0;
    return this.heightPx(this.pinned ?? this.relief.displayAt(x, y));
  }

  /** Alle folgenden worldToScreen-Aufrufe nutzen die Geländehöhe h (ein Gebäude steht eben, auch am Hang). */
  pin(h) {
    this.pinned = this.relief ? h : null;
  }

  /** pin() mit der Geländehöhe am Weltpunkt. */
  pinAt(x, y) {
    this.pinned = this.relief ? this.relief.displayAt(x, y) : null;
  }

  unpin() {
    this.pinned = null;
  }

  /** Bildschirmgröße in CSS-Pixeln (Canvas-Größe ohne DPR). */
  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  worldToScreen(x, y) {
    const p = this.worldToScreenFlat(x, y);
    if (this.iso && this.relief) p.y -= this.lift(x, y);
    return p;
  }

  /** Wie worldToScreen, aber ohne Gelände (Boden auf Höhe 0). */
  worldToScreenFlat(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (this.iso) {
      const [ra, rb, rc, rd] = this.axes();
      const rx = ra * dx + rb * dy;
      const ry = rc * dx + rd * dy;
      return {
        x: (rx - ry) * ISO_K * this.zoom + this.viewW / 2,
        y: (rx + ry) * ISO_K * this.squash() * this.zoom + this.viewH / 2,
      };
    }
    return { x: dx * this.zoom + this.viewW / 2, y: dy * this.zoom + this.viewH / 2 };
  }

  /** Weltpunkt unter dem Bildschirmpunkt; mit Gelände der Punkt, an dem der Sichtstrahl den Boden trifft (Näherung). */
  screenToWorld(sx, sy) {
    if (!this.iso || !this.relief) return this.screenToWorldFlat(sx, sy);
    if (this.three) return this.rayToGround(sx, sy) ?? this.screenToWorldFlat(sx, sy);
    let p = this.screenToWorldFlat(sx, sy);
    for (let k = 0; k < 10; k++) {
      const q = this.screenToWorldFlat(sx, sy + this.relief.displayAt(p.x, p.y) * this.zoom);
      const nx = k < 4 ? q.x : (p.x + q.x) / 2; // später gedämpft, damit steile Hänge nicht pendeln
      const ny = k < 4 ? q.y : (p.y + q.y) / 2;
      if (Math.abs(nx - p.x) + Math.abs(ny - p.y) < 0.5) return { x: nx, y: ny };
      p = { x: nx, y: ny };
    }
    return p;
  }

  /**
   * Ansicht 3D (Paket „Freie Kamera“): Sichtstrahl durch den Bildpunkt gegen das Gelände. Der Strahl ist eine Gerade p(h) = p0 + h · v
   * über dem Boden (Punkt der Höhe h, der an derselben Bildstelle erscheint); vom höchsten Gelände abwärts gilt der erste Schnitt
   * (vorderste Fläche), danach Halbierung. null, wenn der Strahl das Gelände nicht trifft.
   */
  rayToGround(sx, sy) {
    const r = this.relief;
    const p0 = this.screenToWorldFlat(sx, sy);
    const p1 = this.screenToWorldFlat(sx, sy + this.heightPx(1));
    const vx = p1.x - p0.x;
    const vy = p1.y - p0.y;
    const f = (h) => r.displayAt(p0.x + h * vx, p0.y + h * vy) - h; // > 0: Strahl unter dem Gelände
    const hi = Math.max(0, r.hi ?? 0) + 1;
    const lo = Math.min(0, r.lo ?? 0) - 1;
    const dh = Math.max(0.25, 4 / (Math.hypot(vx, vy) || 1)); // etwa alle 4 Welt-px eine Probe
    let a = hi;
    if (f(a) > 0) return { x: p0.x + a * vx, y: p0.y + a * vy };
    for (let h = hi - dh; ; h -= dh) {
      const b = Math.max(lo, h);
      if (f(b) >= 0) {
        let x0 = b;
        let x1 = a;
        for (let k = 0; k < 12; k++) {
          const m = (x0 + x1) / 2;
          if (f(m) >= 0) x0 = m;
          else x1 = m;
        }
        const m = (x0 + x1) / 2;
        return { x: p0.x + m * vx, y: p0.y + m * vy };
      }
      if (b === lo) return null;
      a = b;
    }
  }

  /** Umkehrung von worldToScreenFlat (Boden auf Höhe 0). */
  screenToWorldFlat(sx, sy) {
    const px = (sx - this.viewW / 2) / this.zoom;
    const py = (sy - this.viewH / 2) / this.zoom;
    if (this.iso) {
      // Umkehrung von ISO: rx = px/(2K) + py/K, ry = −px/(2K) + py/K, dann zurückdrehen (transponierte Drehmatrix)
      const S2 = 2 * this.squash(); // bei 30° genau 1
      const rx = px / (2 * ISO_K) + py / (ISO_K * S2);
      const ry = -px / (2 * ISO_K) + py / (ISO_K * S2);
      const [ra, rb, rc, rd] = this.axes();
      return { x: this.x + ra * rx + rc * ry, y: this.y + rb * rx + rd * ry };
    }
    return { x: this.x + px, y: this.y + py };
  }

  /** Matrix [a, b, c, d] (ohne Verschiebung) für ctx.setTransform: Welt → Bildschirm isometrisch, mit Zoom `z` und Drehung. */
  isoMatrix(z = this.zoom) {
    const [ra, rb, rc, rd] = this.axes();
    const k = z * ISO_K;
    const S = this.squash();
    return [k * (ra - rc), k * S * (ra + rc), k * (rb - rd), k * S * (rb + rd)];
  }

  /** Richtung, in der der Tiefenwert wächst (Weltachsen): depth(x, y) = dir · (x − Kamera). */
  depthDir() {
    const [ra, rb, rc, rd] = this.axes();
    return [ra + rc, rb + rd];
  }

  /** Tiefenwert eines Weltpunkts: größer = näher am Betrachter (Sortierung isometrisch). */
  depth(x, y) {
    const [ra, rb, rc, rd] = this.axes();
    const dx = x - this.x;
    const dy = y - this.y;
    return (ra + rc) * dx + (rb + rd) * dy;
  }

  /** Dreht die isometrische Ansicht um 90° (dir = ±1); die Kartenmitte im Bild bleibt. */
  rotate(dir) {
    this.rot = (this.rot + (dir < 0 ? 3 : 1)) % 4;
  }

  /**
   * Freie Kamera: stufenlos um da (Bogenmaß, + = wie rotate(1)) drehen; der Weltpunkt unter (sx, sy) bleibt stehen (Standard: Bildmitte).
   * rot folgt der nächsten Vierteldrehung, turn bleibt in −45° … 45°.
   */
  turnBy(da, sx = this.viewW / 2, sy = this.viewH / 2) {
    const before = this.screenToWorldFlat(sx, sy);
    let t = this.turn + da;
    let r = this.rot;
    while (t > QUARTER / 2) {
      t -= QUARTER;
      r = (r + 1) % 4;
    }
    while (t < -QUARTER / 2) {
      t += QUARTER;
      r = (r + 3) % 4;
    }
    this.turn = Math.abs(t) < 1e-9 ? 0 : t;
    this.rot = r;
    this.keepAt(before, sx, sy);
  }

  /** Freie Kamera: Neigung auf t (Bogenmaß, 30° … 60°) setzen; der Weltpunkt unter der Bildmitte bleibt stehen. */
  setTilt(t) {
    const before = this.screenToWorldFlat(this.viewW / 2, this.viewH / 2);
    const v = clamp(t, TILT_MIN, TILT_MAX);
    this.tilt = Math.abs(v - TILT0) < 1e-9 ? TILT0 : v;
    this.keepAt(before, this.viewW / 2, this.viewH / 2);
  }

  /** Kamera so verschieben, dass der Bodenpunkt p (Höhe 0) wieder unter (sx, sy) liegt. */
  keepAt(p, sx, sy) {
    const now = this.screenToWorldFlat(sx, sy);
    this.x += p.x - now.x;
    this.y += p.y - now.y;
    this.clamp();
  }

  /** Verschiebt um Bildschirm-Pixel (Inhalt folgt der Maus). */
  pan(dxScreen, dyScreen) {
    const a = this.screenToWorldFlat(this.viewW / 2, this.viewH / 2);
    const b = this.screenToWorldFlat(this.viewW / 2 - dxScreen, this.viewH / 2 - dyScreen);
    this.x += b.x - a.x;
    this.y += b.y - a.y;
    this.clamp();
  }

  /** Zoomt um `factor`; der Weltpunkt unter (sx, sy) bleibt an derselben Stelle. */
  zoomAt(factor, sx, sy) {
    const before = this.screenToWorld(sx, sy);
    const h = this.iso && this.relief ? this.relief.displayAt(before.x, before.y) : 0;
    this.zoom = clamp(this.zoom * factor, this.zoomMin, this.zoomMax);
    // Kamera so setzen, dass der Weltpunkt (mit seiner Geländehöhe) wieder unter (sx, sy) liegt
    this.x = this.y = 0;
    const now = this.screenToWorldFlat(sx, sy + this.heightPx(h));
    this.x = before.x - now.x;
    this.y = before.y - now.y;
    this.clamp();
  }

  centerOn(x, y) {
    this.x = x;
    this.y = y;
    this.clamp();
    const dy = (this.insetTop - this.insetBottom) / 2;
    if (dy) this.pan(0, dy); // Ziel in die Mitte des unverdeckten Bereichs (pan: Inhalt folgt dem Versatz)
  }

  /**
   * Mitte so begrenzen, dass der Ausschnitt möglichst in der Karte bleibt (zu groß: zentriert). Isometrisch: Mitte in der Karte.
   * 2D: Der obere bzw. untere Kartenrand darf bis an die Kopfleiste bzw. die Leiste unten (Minimap, Infofeld, Befehle) rücken
   * (insetTop, insetBottom), sonst bliebe der Streifen dahinter unerreichbar (dort nicht bauen, nichts antippen).
   */
  clamp() {
    if (this.iso) {
      this.x = clamp(this.x, 0, this.mapW);
      this.y = clamp(this.y, 0, this.mapH);
      return;
    }
    const hw = this.viewW / (2 * this.zoom);
    const hh = this.viewH / (2 * this.zoom);
    const top = (this.insetTop || 0) / this.zoom;
    const bottom = (this.insetBottom || 0) / this.zoom;
    const lo = hh - top;
    const hi = this.mapH - hh + bottom;
    this.x = hw * 2 >= this.mapW ? this.mapW / 2 : clamp(this.x, hw, this.mapW - hw);
    this.y = lo >= hi ? this.mapH / 2 + (bottom - top) / 2 : clamp(this.y, lo, hi); // zu groß: Karte in der freien Mitte
  }

  /** Bildschirmecken (Welt, Boden auf Höhe 0) im Uhrzeigersinn: oben links, oben rechts, unten rechts, unten links. */
  visibleQuad() {
    const w = this.viewW;
    const h = this.viewH;
    return [this.screenToWorldFlat(0, 0), this.screenToWorldFlat(w, 0), this.screenToWorldFlat(w, h), this.screenToWorldFlat(0, h)];
  }

  /**
   * Umschließendes Weltrechteck des sichtbaren Ausschnitts {x0, y0, x1, y1} (kann über die Karte hinausragen).
   * Mit Gelände zählt auch, was hinter dem unteren Rand liegt und hoch genug ins Bild ragt (und tiefer Liegendes oben).
   */
  visibleRect() {
    const q = this.visibleQuad();
    if (this.iso && this.relief) {
      const w = this.viewW;
      const h = this.viewH;
      const up = this.heightPx(Math.max(0, this.relief.hi));
      const down = this.heightPx(Math.min(0, Math.max(this.relief.lo, -20)));
      q.push(this.screenToWorldFlat(0, h + up), this.screenToWorldFlat(w, h + up), this.screenToWorldFlat(0, down), this.screenToWorldFlat(w, down));
    }
    return {
      x0: Math.min(...q.map((p) => p.x)),
      y0: Math.min(...q.map((p) => p.y)),
      x1: Math.max(...q.map((p) => p.x)),
      y1: Math.max(...q.map((p) => p.y)),
    };
  }
}
