// Bausteine der Flugzeug-Modelle: facettierter Rumpf aus Ringen (hull, ring), Platten (slab, inset), remap.
// Genutzt von f22.js, jets.js, u2.js, planes.js. Einstieg: ../unitpaint.js.
import { solid, norm3 } from './shapes.js';

// ---------- F-22: Bauteile für den facettierten Tarnkappenrumpf ----------

const same3 = (p, q) => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];
const avg3 = (pts) => [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);

/**
 * Facettierter Rumpf aus Ringen [[x, y, z] …] (gleich viele Ecken; ein Ring aus einem Punkt ist die Spitze). Jeder Abschnitt
 * zwischen zwei Ringen ist ein eigener, fast konvexer Körper: so stimmen Rückseiten und Reihenfolge auch am langen, taillierten Rumpf.
 */
function hull(rings, col, o) {
  const out = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    const n = Math.max(a.length, b.length);
    const A = Array.from({ length: n }, (_, k) => a[a.length === 1 ? 0 : k]);
    const B = Array.from({ length: n }, (_, k) => b[b.length === 1 ? 0 : k]);
    const faces = [];
    if (a.length > 1) faces.push(A.slice().reverse());
    if (b.length > 1) faces.push(B.slice());
    for (let k = 0; k < n; k++) {
      const q = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]];
      faces.push(q.filter((p, j) => !same3(p, q[(j + 1) % 4]))); // an der Spitze Dreieck statt Viereck
    }
    out.push(solid(faces, col, avg3([...a, ...b]), o));
  }
  return out;
}

/** Querschnitt bei x: flacher Boden (Halbbreite wb in Höhe zb, Bodenkante bei xb), Kante (wc, zc), flacher Rücken (wt, zt). */
const ring = (x, wb, zb, wc, zc, wt, zt, xb = x) => [[xb, -wb, zb], [x, -wc, zc], [x, -wt, zt], [x, wt, zt], [x, wc, zc], [xb, wb, zb]];

/**
 * Dünne Platte auf einer ebenen Fläche pts (Einlauf, Schachtöffnung, Tarnfleck): nach außen (weg vom Punkt inside) um lift
 * abgehoben, Dicke t, k = Anteil, um den sie zur Mitte schrumpft.
 */
function slab(pts, inside, col, { k = 0, lift = 0.04, t = 0.08, ...o } = {}) {
  const m = avg3(pts);
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  n = norm3(n);
  if (n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) + n[2] * (m[2] - inside[2]) < 0) n = n.map((v) => -v);
  const at = (d) => pts.map((p) => p.map((v, i) => v + (m[i] - v) * k + n[i] * d));
  const P = at(lift);
  const Q = at(lift + t);
  const faces = [P.slice().reverse(), Q];
  for (let i = 0; i < P.length; i++) faces.push([P[i], P[(i + 1) % P.length], Q[(i + 1) % P.length], Q[i]]);
  return solid(faces, col, avg3([...P, ...Q]), { noLine: true, ...o });
}

/** Grundriss um d nach innen versetzt (gleiche Eckenzahl): Oberseite für abgeschrägte Kanten an Flügel und Leitwerk (loft). */
function inset(plan, d) {
  const n = plan.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += plan[i][0] * plan[(i + 1) % n][1] - plan[(i + 1) % n][0] * plan[i][1];
  const sg = area > 0 ? 1 : -1;
  const lines = plan.map(([ax, ay], i) => {
    const [bx, by] = plan[(i + 1) % n];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [ax - ((by - ay) / l) * d * sg, ay + ((bx - ax) / l) * d * sg, bx - ax, by - ay];
  });
  return plan.map((_, i) => {
    const [px, py, ux, uy] = lines[(i - 1 + n) % n];
    const [qx, qy, vx, vy] = lines[i];
    const den = ux * vy - uy * vx;
    if (Math.abs(den) < 1e-9) return [qx, qy];
    const t = ((qx - px) * vy - (qy - py) * vx) / den;
    return [px + ux * t, py + uy * t];
  });
}

/** Alle Punkte eines Körpers mit f umrechnen (schräg gestellte Seitenleitwerke). */
function remap(so, f) {
  so.faces = so.faces.map((fc) => fc.map(f));
  so.c = f(so.c);
  return so;
}

export { hull, ring, slab, inset, remap };
