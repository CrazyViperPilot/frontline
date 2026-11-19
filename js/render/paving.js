// Pflaster der Kartenstadt (Karteneditor, Paket „Pflaster“): graue Plätze (town.plazas, Rechtecke etwa eine Stadtzelle groß) und
// Bürgersteige (town.walks, Strecken mit Bordstein). Nur Boden: blockieren nichts, die Stadt baut darüber. Zeichnet in
// Weltkoordinaten mal Maßstab S (Geländebild S = 1/4, Editor S = Zoom, Spiel S = 1 mit gesetzter Kamera- bzw. Bodentransformation).

const PLAZA_FILL = '#9b9c97';
const PLAZA_JOINT = 'rgba(60,62,58,0.28)';
const WALK_FILL = '#a9a9a3';
const CURB = '#6d6e69';
const JOINT = 16; // Fugenabstand der Platten (px)

/** Platz p (Rechteck, evtl. gedreht) mit Plattenfugen und dunklerer Kante. */
export function drawPlaza(ctx, p, S = 1) {
  const w = p.w * S;
  const h = p.h * S;
  ctx.save();
  ctx.translate(p.x * S, p.y * S);
  if (p.angle) ctx.rotate(p.angle);
  ctx.fillStyle = PLAZA_FILL;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  const step = JOINT * S;
  if (step >= 3) {
    ctx.strokeStyle = PLAZA_JOINT;
    ctx.lineWidth = Math.max(0.5, 0.8 * S);
    ctx.beginPath();
    for (let x = -w / 2 + step; x < w / 2 - 0.5; x += step) {
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, h / 2);
    }
    for (let y = -h / 2 + step; y < h / 2 - 0.5; y += step) {
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,72,68,0.55)';
  ctx.lineWidth = Math.max(0.5, 1.5 * S);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Bürgersteig r (Strecke x1/y1 → x2/y2, Breite w) mit Bordstein an beiden Kanten und Querfugen. */
export function drawWalk(ctx, r, S = 1) {
  const dx = r.x2 - r.x1;
  const dy = r.y2 - r.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const L = len * S;
  const w = r.w * S;
  ctx.save();
  ctx.translate(r.x1 * S, r.y1 * S);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = WALK_FILL;
  ctx.fillRect(0, -w / 2, L, w);
  const step = JOINT * S;
  if (step >= 3) {
    ctx.strokeStyle = PLAZA_JOINT;
    ctx.lineWidth = Math.max(0.5, 0.8 * S);
    ctx.beginPath();
    for (let x = step; x < L - 0.5; x += step) {
      ctx.moveTo(x, -w / 2);
      ctx.lineTo(x, w / 2);
    }
    ctx.stroke();
  }
  const curb = Math.max(0.6, 2.5 * S);
  ctx.fillStyle = CURB;
  ctx.fillRect(0, -w / 2, L, curb);
  ctx.fillRect(0, w / 2 - curb, L, curb);
  ctx.restore();
}

/**
 * Alle Plätze und Bürgersteige einer Kartenstadt. inRect(x, y, r) siebt aus (fehlt es: alle); at(x, y) setzt vor jedem Stück
 * die Bodenebene (Iso mit Gelände), sonst bleibt die Transformation.
 */
export function drawPaving(ctx, town, S = 1, inRect = null, at = null) {
  for (const p of town?.plazas ?? []) {
    if (inRect && !inRect(p.x, p.y, Math.hypot(p.w, p.h) / 2)) continue;
    at?.(p.x, p.y);
    drawPlaza(ctx, p, S);
  }
  for (const r of town?.walks ?? []) {
    const mx = (r.x1 + r.x2) / 2;
    const my = (r.y1 + r.y2) / 2;
    if (inRect && !inRect(mx, my, Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 2 + r.w)) continue;
    at?.(mx, my);
    drawWalk(ctx, r, S);
  }
}
