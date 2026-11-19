// Kartenvorschau (Paket „Feste Karten“): kleines Bild einer Karte für Startmenü und Editor. Boden mit Gelände, Wegen und Gleisen
// (terrain.js), Gebäude als Flächen (maptown.js), Hochspannungsleitungen, Grenzen der Baugebiete, Flaggengebiete mit Buchstaben und
// Startpunkte in Teamfarben. Liest nur die Karte.
import { BALANCE } from '../data/balance.js';
import { buildTerrain } from './terrain.js';
import { drawMapTownMini } from './maptown.js';

const Q = BALANCE.conquest;

/** Zeichnet die Karte `map` in das Canvas `canvas` (ganze Fläche). Liefert das Canvas zurück. */
export function drawMapPreview(canvas, map) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / map.width;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buildTerrain(map, '2d'), 0, 0, canvas.width, canvas.height);
  ctx.scale(s, s);
  drawMapTownMini(ctx, map.town);
  drawPowerLines(ctx, map.town.buildings, 1 / s);
  const z = map.zone;
  const px = 1 / s; // ein Bildpunkt in Weltpixeln
  // Konfliktzone (Quadrat der Eroberung) und Grenzen der Baugebiete
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([5 * px, 4 * px]);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.strokeRect(z.x - Q.half, z.y - Q.half, 2 * Q.half, 2 * Q.half);
  ctx.beginPath();
  if (map.layout === 'sides') {
    for (const [cx, cy, ex, ey] of [[-1, -1, 0, 0], [1, -1, map.width, 0], [-1, 1, 0, map.height], [1, 1, map.width, map.height]]) {
      ctx.moveTo(z.x + cx * Q.half, z.y + cy * Q.half);
      ctx.lineTo(ex, ey);
    }
  } else {
    ctx.moveTo(z.x, 0);
    ctx.lineTo(z.x, z.y - Q.half);
    ctx.moveTo(z.x, z.y + Q.half);
    ctx.lineTo(z.x, map.height);
    ctx.moveTo(0, z.y);
    ctx.lineTo(z.x - Q.half, z.y);
    ctx.moveTo(z.x + Q.half, z.y);
    ctx.lineTo(map.width, z.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Flaggen: Gebiet und Buchstabe
  ctx.font = `bold ${13 * px}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  (map.flags ?? []).forEach((f, i) => {
    ctx.fillStyle = 'rgba(240,240,240,0.18)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b1f24';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 9 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(Q.names[i] ?? '?', f.x, f.y + 0.5 * px);
  });
  // Startpunkte in Teamfarben
  map.spawns.forEach((p, i) => {
    ctx.fillStyle = BALANCE.teamColors[i] ?? '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.rect(p.x - 7 * px, p.y - 7 * px, 14 * px, 14 * px);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
  return canvas;
}

/** Leitungen zwischen Strommasten derselben Linie (Kartenreihenfolge) als dünne Linien; lw = Linienbreite in Weltpixeln. */
export function drawPowerLines(ctx, buildings, lw) {
  const lines = new Map();
  for (const b of buildings) if (b.kind === 'pylon') (lines.get(b.line ?? 0) ?? lines.set(b.line ?? 0, []).get(b.line ?? 0)).push(b);
  ctx.strokeStyle = 'rgba(30,32,36,0.8)';
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const list of lines.values()) {
    list.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x, b.y)));
  }
  ctx.stroke();
}
