// Tarnanzug des Scharfschützen (Paket „Scharfschütze“): Farben passen sich der Umgebung und der Jahreszeit an. Schnee im Winter,
// sonst Wald (Bäume in der Nähe), Fels (steiler Hang), Stadt (Stadtzellen und Straßen) oder Wiese je Jahreszeit. Der Renderer setzt
// je Bild die Welt (setCamoWorld); camoOf(u) merkt das Ergebnis je Einheit und Rasterzelle. Nur Darstellung, liest nur.
import { BALANCE } from '../../data/balance.js';
import { MAPGEN } from '../../data/mapgen.js';

/** Farben je Umgebung: [Grund, Büschel hell, Büschel dunkel]. */
export const CAMO = {
  summer: ['#5a6a3a', '#71813f', '#45532c'],
  autumn: ['#6f6540', '#86703c', '#56502f'],
  winter: ['#dfe4e6', '#c6ccd0', '#aab3b7'],
  forest: ['#3f4f2c', '#526137', '#2f3b22'],
  rock: ['#7a7468', '#8d8473', '#5f5a50'],
  urban: ['#6c6d69', '#80807a', '#555653'],
};

const TILE = BALANCE.map.tile;
const NEAR_TREES = 2; // Zellen: so nah stehende Bäume machen den Tarnanzug zum Wald
let world = null;
const memo = new WeakMap(); // Einheit → { key, camo }
const treeCells = new WeakMap(); // map.trees → Set der Zellen mit Baum

/** Welt des laufenden Bilds (Renderer, je Bild). */
export function setCamoWorld(game) {
  world = game;
}

function treesNear(game, c, r) {
  const list = game.map?.trees;
  if (!list?.length) return false;
  let set = treeCells.get(list);
  if (!set) {
    set = new Set(list.map((t) => `${Math.floor(t.x / TILE)},${Math.floor(t.y / TILE)}`));
    treeCells.set(list, set);
  }
  for (let dr = -NEAR_TREES; dr <= NEAR_TREES; dr++) for (let dc = -NEAR_TREES; dc <= NEAR_TREES; dc++) if (set.has(`${c + dc},${r + dr}`)) return true;
  return false;
}

function urbanAt(game, x, y) {
  for (const city of game.city ?? []) {
    const col = Math.floor((x - city.x0) / city.cell);
    const row = Math.floor((y - city.y0) / city.cell);
    if (col < 0 || row < 0 || col >= city.cols || row >= city.rows) continue;
    const i = row * city.cols + col;
    if (city.kind[i] || city.mapRoads?.[i]) return true;
  }
  return false;
}

/** Name der Tarnfarbe (Schlüssel von CAMO) für Einheit u an ihrem Ort. */
export function camoOf(u) {
  const g = world;
  const season = g?.weather?.season ?? 'summer';
  if (!g) return season === 'winter' ? 'winter' : season === 'autumn' ? 'autumn' : 'summer';
  const c = Math.floor(u.x / TILE);
  const r = Math.floor(u.y / TILE);
  const key = `${c},${r},${season}`;
  const hit = memo.get(u);
  if (hit && hit.key === key) return hit.camo;
  let camo;
  if (season === 'winter') camo = 'winter';
  else if (urbanAt(g, u.x, u.y)) camo = 'urban';
  else if (treesNear(g, c, r)) camo = 'forest';
  else if (g.relief && g.relief.cellSlope(c, r) >= MAPGEN.relief.rock) camo = 'rock';
  else camo = season === 'autumn' ? 'autumn' : 'summer';
  memo.set(u, { key, camo });
  return camo;
}
