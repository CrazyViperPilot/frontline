// Mini-Renderer der Einheiten-Modelle: malt Körper mit dem Licht der Gebäude (paintSolids) und misst ihren Umriss (boundsOf).
// Einstieg und Verzeichnis: ../unitpaint.js.
import { K, norm3 } from './shapes.js';
import { rgbOf, mix } from '../color.js';

// ---------- Renderer ----------

const LIGHT = norm3([-0.35, 0.45, 0.82]); // wie die Gebäude (university.js)
const VIEW_ISO = [1, 1, K]; // Blickrichtung zum Betrachter (isokit: Fläche sichtbar, wenn n · VIEW > 0)
const CHAR = '#2a2623';

/**
 * Malt Körper um yaw gedreht. view: { iso, s (Gerätepixel je Einheit), charred, shadow (nur Umriss schwarz) }. Körper mit alpha scheinen durch.
 * Reihenfolge: Körper nach der Tiefe ihrer Mitte, aufgesetzte Teile direkt nach ihrem Träger; Rückseiten fallen weg.
 */
function paintSolids(ctx, solids, yaw, view) {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const rot = (p) => [p[0] * cs - p[1] * sn, p[0] * sn + p[1] * cs, p[2]];
  const { iso, s } = view;
  const proj = iso ? (p) => [(p[0] - p[1]) * K * s, ((p[0] + p[1]) * K * 0.5 - p[2]) * s] : (p) => [p[0] * s, p[1] * s];
  const depth = iso ? (p) => p[0] * VIEW_ISO[0] + p[1] * VIEW_ISO[1] + p[2] * VIEW_ISO[2] : (p) => p[2];
  const mode = iso ? 'iso' : 'top';
  const incl = (so) => !(so.fine && s < 1.6) && !(so.only && so.only !== mode) && (!so.on || incl(so.on));
  const list = [];
  for (const so of solids) so._k = undefined;
  for (const so of solids) {
    if (!incl(so)) continue;
    so._c = rot(so.c);
    so._k = depth(so._c);
  }
  for (const so of solids) {
    if (so._k === undefined) continue;
    let root = so;
    let lift = 0;
    while (root.on && root.on._k !== undefined) {
      root = root.on;
      lift += 1;
    }
    // Kette und untere Wanne (under) zuerst, aufgesetzte Teile nach ihrem Träger, untereinander nach eigener Tiefe
    list.push({ so, k: root._k + (root.under ? -1e4 : 0), lift, own: so._k, i: list.length });
  }
  list.sort((a, b) => a.k - b.k || a.lift - b.lift || a.own - b.own || a.i - b.i);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.min(0.9, 0.28 * s);
  const a0 = ctx.globalAlpha;
  for (const { so } of list) {
    if (so.alpha !== undefined) ctx.globalAlpha = a0 * so.alpha; // durchscheinende Körper (Maschendraht, fences.js)
    let col = so.col;
    if (view.charred) col = mix(col, CHAR, 0.78);
    const rgb = rgbOf(col);
    const top = so.top && !view.charred ? (so._top ??= rgbOf(so.top.col)) : null; // Oberseiten (Schnee, Moos, seit v5.28)
    const c = so._c;
    for (let fi = 0; fi < so.faces.length; fi++) {
      const pts = so.faces[fi].map(rot);
      // Normale nach Newell, nach außen (weg von der Körpermitte)
      let nx = 0;
      let ny = 0;
      let nz = 0;
      let fx = 0;
      let fy = 0;
      let fz = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        nx += (a[1] - b[1]) * (a[2] + b[2]);
        ny += (a[2] - b[2]) * (a[0] + b[0]);
        nz += (a[0] - b[0]) * (a[1] + b[1]);
        fx += a[0];
        fy += a[1];
        fz += a[2];
      }
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) continue;
      nx /= l;
      ny /= l;
      nz /= l;
      fx /= pts.length;
      fy /= pts.length;
      fz /= pts.length;
      if (nx * (fx - c[0]) + ny * (fy - c[1]) + nz * (fz - c[2]) < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const vis = iso ? nx * VIEW_ISO[0] + ny * VIEW_ISO[1] + nz * VIEW_ISO[2] : nz;
      if (vis <= 1e-6) continue;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = proj(pts[i]);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      if (view.shadow) {
        ctx.fillStyle = '#000';
        ctx.fill();
        continue;
      }
      const d = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const ao = fz < 7 ? 0.8 + (0.2 * Math.max(0, fz)) / 7 : 1; // bodennahe Flächen etwas dunkler (Umgebungsverdeckung)
      let k = (0.56 + 0.44 * d) * ao;
      if (so.vary) k *= 1 + so.vary * (((Math.imul(fi + 1, 2654435761) >>> 0) % 1000) / 1000 - 0.5); // Flächen leicht verschieden (Fels)
      let fc = rgb;
      if (top && nz > so.top.at) {
        const t = Math.min(1, (nz - so.top.at) / 0.18);
        fc = [rgb[0] + (top[0] - rgb[0]) * t, rgb[1] + (top[1] - rgb[1]) * t, rgb[2] + (top[2] - rgb[2]) * t];
      }
      ctx.fillStyle = `rgb(${Math.min(255, fc[0] * k) | 0},${Math.min(255, fc[1] * k) | 0},${Math.min(255, fc[2] * k) | 0})`;
      ctx.fill();
      if (!so.noLine) {
        const e = so.smooth ? k : k * 0.68; // runde Körper ohne dunkle Kanten (sonst Netzmuster), nur Nähte geschlossen
        ctx.strokeStyle = `rgb(${(fc[0] * e) | 0},${(fc[1] * e) | 0},${(fc[2] * e) | 0})`;
        ctx.stroke();
      }
    }
    if (so.alpha !== undefined) ctx.globalAlpha = a0;
  }
}

/**
 * Bildgrenzen [x0, y0, x1, y1] eines Körpersatzes, um yaw gedreht, in Iso oder von oben, mit 1 Einheit Rand. Eng um das Modell
 * (ein langes Rohr macht das Bild nur in seiner Richtung groß); je Halter (Modell, Turm, Wrack) und Richtung gemerkt.
 */
function boundsOf(holder, solids, yaw, iso) {
  const memo = (holder.bnd ??= new Map());
  const key = (iso ? 'i' : 't') + Math.round(yaw * 1000);
  let b = memo.get(key);
  if (b) return b;
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const so of solids) {
    for (const f of so.faces) {
      for (const p of f) {
        const rx = p[0] * cs - p[1] * sn;
        const ry = p[0] * sn + p[1] * cs;
        const X = iso ? (rx - ry) * K : rx;
        const Y = iso ? (rx + ry) * K * 0.5 - p[2] : ry;
        b[0] = Math.min(b[0], X - 1);
        b[1] = Math.min(b[1], Y - 1);
        b[2] = Math.max(b[2], X + 1);
        b[3] = Math.max(b[3], Y + 1);
      }
    }
  }
  memo.set(key, b);
  return b;
}

export { paintSolids, boundsOf };
