// Erzeugt die feste Karte „East Europe Railway“ (js/data/maps/east-europe-railway.js), Paket „Feste Karten“.
// Aufruf: node tools/maps/east-europe-railway.mjs   (schreibt die Datei neu und prüft sie mit checkMap)
//
// Aufbau (eigener Entwurf): Ein Fluss läuft von einem See in der Nordost-Ecke zu einem See in der Südwest-Ecke quer durch die Zone,
// eine Bahnlinie von West nach Ost kreuzt ihn auf einer Eisenbahnbrücke in der Kartenmitte. Fluss und Bahn teilen die Zone in vier
// Keile, je einer vor jeder Kartenseite (Baugebiete an den Seiten, layout 'sides'). 7 Flaggen:
//   A Gehöft (Nord), B Bahnhof (Nordwest, an der Bahn), C Dorf (West), D Bahnbrücke (Mitte), E Umspannwerk (Ost),
//   F Fabrik (Südost, große Fabrikhalle an der Bahn), G Steinbruch (Süd).
// Hochspannungsleitungen auf großen Strommasten laufen vom Umspannwerk über die Karte. Punktsymmetrisch angelegt, wo es geht
// (Blau Süd gegen Rot Nord sind gleich gestellt; Grün West und Gelb Ost ebenso).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Relief, COARSE_N, RELIEF, setRelief } from '../../js/game/relief.js';
import { riverHeight } from '../../js/game/landscape.js';
import { makeRng } from '../../js/core/rng.js';
import { normalizeMap, checkMap } from '../../js/game/mapdata.js';

const W = 11072;
const C = W / 2;
const rng = makeRng(20261119);
const rnd = (a, b) => a + (b - a) * rng.next();
const ri = (a, b) => Math.round(rnd(a, b));
const mirror = (p) => ({ ...p, x: W - p.x, y: W - p.y });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- Eckdaten ----------

const spawns = [
  { x: C, y: W - 760 }, // Blau: Süden
  { x: C, y: 760 }, // Rot: Norden
  { x: 760, y: C }, // Grün: Westen
  { x: W - 760, y: C }, // Gelb: Osten
];
const FLAGS = [
  { x: C, y: 2980, r: 520, name: 'Gehöft' },
  { x: 3000, y: 3330, r: 520, name: 'Bahnhof' },
  { x: 2980, y: C, r: 520, name: 'Dorf' },
  { x: 5050, y: C, r: 560, name: 'Bahnbrücke' },
  { x: W - 2980, y: C, r: 520, name: 'Umspannwerk' },
  { x: 7600, y: 8030, r: 520, name: 'Fabrik' },
  { x: C, y: W - 2980, r: 520, name: 'Steinbruch' },
];

// Fluss: Mittellinie von See NO zu See SW, mit Schwüngen (in den Brückenpunkten t = 0.25, 0.5, 0.75 auf der Diagonale)
const RA = { x: 9750, y: 1322 };
const RB = { x: 1322, y: 9750 };
const RL = dist(RA.x, RA.y, RB.x, RB.y);
const RT = { x: (RB.x - RA.x) / RL, y: (RB.y - RA.y) / RL }; // Richtung
const RN = { x: -RT.y, y: RT.x }; // Normale
const SWING = 170;
const riverAt = (t) => {
  const o = SWING * Math.sin(4 * Math.PI * t) + 40 * Math.sin(10 * Math.PI * t);
  return { x: RA.x + RT.x * RL * t + RN.x * o, y: RA.y + RT.y * RL * t + RN.y * o };
};
const RIVER = Array.from({ length: 801 }, (_, i) => riverAt(i / 800));
function riverDist(x, y) {
  let best = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i];
    const b = RIVER[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
    if (d < best) best = d;
  }
  return best;
}
/** Normale zum Fluss bei t (für Brücken quer zum Wasser). */
function riverNormal(t) {
  const a = riverAt(t - 0.002);
  const b = riverAt(t + 0.002);
  const l = dist(a.x, a.y, b.x, b.y);
  return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
}
const LAKES = [
  { x: 9900, y: 1172, r: 560 },
  { x: 1172, y: 9900, r: 560 },
];

// Bahn: West → Bahnhof (waagerecht) → schräg über die Brücke in der Mitte → Ost (waagerecht), punktsymmetrisch
const R1 = { x: 3200, y: 3700 };
const R2 = { x: 3800, y: 3900 };
const RAIL_PTS = [{ x: 0, y: 3700 }, R1, R2, mirror(R2), mirror(R1), { x: W, y: W - 3700 }];
const rails = [];
for (let i = 0; i < RAIL_PTS.length - 1; i++) rails.push({ x1: RAIL_PTS[i].x, y1: RAIL_PTS[i].y, x2: RAIL_PTS[i + 1].x, y2: RAIL_PTS[i + 1].y });

function segDist(x, y, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / l2));
  return Math.hypot(x - s.x1 - t * dx, y - s.y1 - t * dy);
}
const railDist = (x, y) => Math.min(...rails.map((s) => segDist(x, y, s)));

// ---------- Gelände ----------

const HILLS = [
  { x: 5072, y: 2450, r: 820, h: 120 }, // Hügel am Gehöft (bewaldet)
  { x: 6000, y: 8622, r: 820, h: 120 }, // Steinbruch-Berg
  { x: 8300, y: 3500, r: 760, h: 60 },
  { x: 2772, y: 7572, r: 760, h: 60 },
  { x: 4300, y: 6900, r: 600, h: 40 },
  { x: 6772, y: 4172, r: 600, h: 40 },
];
function baseHeight(x, y) {
  let h = 14;
  h += 7 * Math.sin(x / 830 + 1.3) * Math.sin(y / 1010 + 0.4) + 5 * Math.sin((x + y) / 1500 + 2.1);
  for (const k of HILLS) {
    const d = dist(x, y, k.x, k.y);
    if (d < k.r) h += k.h * 0.5 * (1 + Math.cos((Math.PI * d) / k.r));
  }
  // Startgelände eben (Hauptstadt und Stadt)
  let flat = 1;
  for (const s of spawns) flat = Math.min(flat, smooth(1500, 2600, dist(x, y, s.x, s.y)));
  // Flaggenmasten und Bahn eben
  for (const f of FLAGS) flat = Math.min(flat, 0.35 + 0.65 * smooth(120, 420, dist(x, y, f.x, f.y)));
  const rd = railDist(x, y);
  flat = Math.min(flat, smooth(60, 380, rd));
  return 14 + (h - 14) * flat;
}
const coarse = new Float32Array(COARSE_N * COARSE_N);
for (let j = 0; j < COARSE_N; j++) {
  for (let i = 0; i < COARSE_N; i++) {
    const x = i * RELIEF.res;
    const y = j * RELIEF.res;
    let h = baseHeight(x, y);
    h = riverHeight(h, riverDist(x, y));
    for (const l of LAKES) {
      const d = dist(x, y, l.x, l.y);
      if (d < l.r) h = Math.min(h, RELIEF.water - 3 - 30 * (1 - (d / l.r) ** 2));
      else if (d < l.r + 330) h = Math.min(h, RELIEF.water + 2 + (h - RELIEF.water - 2) * smooth(l.r, l.r + 330, d));
    }
    coarse[j * COARSE_N + i] = h;
  }
}

// Brücken (Eisenbahnbrücke in der Mitte, zwei Straßenbrücken) und Furten
const isWet = (x, y) => riverDist(x, y) < 130 || LAKES.some((l) => dist(x, y, l.x, l.y) < l.r + 60);
function bridgeAt(t, half, dir = null) {
  const p = riverAt(t);
  const n = dir ?? riverNormal(t);
  return { x1: Math.round(p.x - n.x * half), y1: Math.round(p.y - n.y * half), x2: Math.round(p.x + n.x * half), y2: Math.round(p.y + n.y * half) };
}
const railDir = (() => {
  const m = mirror(R2);
  const l = dist(R2.x, R2.y, m.x, m.y);
  return { x: (m.x - R2.x) / l, y: (m.y - R2.y) / l };
})();
const railBridge = { ...bridgeAt(0.5, 200, railDir), rail: true };
const bridgeN = bridgeAt(0.25, 175);
const bridgeS = bridgeAt(0.75, 175);
const bridges = [railBridge, bridgeN, bridgeS];
const fords = [riverAt(0.13), riverAt(0.87)].map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), r: 150 }));
// Furten seicht (Bett knapp unter dem Wasserspiegel)
for (const f of fords) {
  for (let j = 0; j < COARSE_N; j++) {
    for (let i = 0; i < COARSE_N; i++) {
      const d = dist(i * RELIEF.res, j * RELIEF.res, f.x, f.y);
      if (d < f.r + 40) coarse[j * COARSE_N + i] = Math.max(coarse[j * COARSE_N + i], RELIEF.water - 1.5);
    }
  }
}

// ---------- Belegung (damit nichts übereinander steht) ----------

const taken = []; // { x0, y0, x1, y1 } oder { x, y, r }
const hitRect = (x0, y0, x1, y1, pad = 0) =>
  taken.some((o) => (o.r !== undefined ? o.x + o.r + pad > x0 && o.x - o.r - pad < x1 && o.y + o.r + pad > y0 && o.y - o.r - pad < y1 : o.x0 - pad < x1 && o.x1 + pad > x0 && o.y0 - pad < y1 && o.y1 + pad > y0));
const roads = [];
const roadDist = (x, y) => (roads.length ? Math.min(...roads.map((s) => segDist(x, y, s) - s.w / 2)) : 1e9);
const rectFree = (x, y, w, h, pad = 8) => {
  if (hitRect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, pad)) return false;
  for (const [cx, cy] of [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x - w / 2, y + h / 2], [x + w / 2, y + h / 2], [x, y]]) {
    if (isWet(cx, cy) || railDist(cx, cy) < 34 || roadDist(cx, cy) < 6) return false;
  }
  if (FLAGS.some((f) => Math.abs(f.x - x) < w / 2 + 90 && Math.abs(f.y - y) < h / 2 + 90)) return false;
  if (spawns.some((s) => Math.abs(s.x - x) < w / 2 + 420 && Math.abs(s.y - y) < h / 2 + 420)) return false;
  return true;
};
const buildings = [];
function addBuilding(b, force = false) {
  if (!force && !rectFree(b.x, b.y, b.w, b.h)) return false;
  buildings.push(b);
  taken.push({ x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 });
  return true;
}
// Schräge Straßen werden Feldwege: befestigte Straßen rasten in der Zone auf das Stadtraster (64 px) und müssen gerade laufen
const road = (x1, y1, x2, y2, w = 64, dirt = false) => {
  if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) [w, dirt] = [44, true];
  pushRoad(x1, y1, x2, y2, w, dirt);
};
const pushRoad = (x1, y1, x2, y2, w, dirt) => roads.push({ x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), w, ...(dirt ? { dirt: true } : {}) });
const roadPath = (pts, w = 64, dirt = false) => {
  for (let i = 0; i < pts.length - 1; i++) road(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w, dirt);
};
const end = (b, k) => (k ? { x: b.x2, y: b.y2 } : { x: b.x1, y: b.y1 });

// ---------- Straßen ----------

const [FA, FB, FC, FD, FE, FF, FG] = FLAGS;
// Zufahrten von den Startpunkten zu ihren Flaggen
roadPath([{ x: C, y: W - 1000 }, { x: C, y: FG.y + 260 }]);
roadPath([{ x: C, y: 1000 }, { x: C, y: FA.y - 260 }]);
roadPath([{ x: 1000, y: C }, { x: FC.x - 260, y: C }]);
roadPath([{ x: W - 1000, y: C }, { x: FE.x + 260, y: C }]);
// Ring: Gehöft → Nordbrücke → Umspannwerk; Steinbruch → Südbrücke → Dorf (Brücke nach Lage der Ufer)
const nIn = dist(end(bridgeN, 0).x, end(bridgeN, 0).y, FA.x, FA.y) < dist(end(bridgeN, 1).x, end(bridgeN, 1).y, FA.x, FA.y) ? 0 : 1;
roadPath([{ x: FA.x + 240, y: FA.y + 40 }, { x: 6500, y: 3500 }, end(bridgeN, nIn)]);
roadPath([end(bridgeN, 1 - nIn), { x: 7900, y: 4500 }, { x: FE.x - 60, y: FE.y - 250 }]);
const sIn = dist(end(bridgeS, 0).x, end(bridgeS, 0).y, FG.x, FG.y) < dist(end(bridgeS, 1).x, end(bridgeS, 1).y, FG.x, FG.y) ? 0 : 1;
roadPath([{ x: FG.x - 240, y: FG.y - 40 }, { x: W - 6500, y: W - 3500 }, end(bridgeS, sIn)]);
roadPath([end(bridgeS, 1 - sIn), { x: W - 7900, y: W - 4500 }, { x: FC.x + 60, y: FC.y + 250 }]);
// Gehöft ↔ Bahnhof ↔ Dorf (über den Bahnübergang), gespiegelt Umspannwerk ↔ Fabrik ↔ Steinbruch
roadPath([{ x: FA.x - 240, y: FA.y }, { x: 4200, y: 3050 }, { x: FB.x + 260, y: FB.y - 60 }]);
roadPath([{ x: FB.x - 60, y: FB.y + 230 }, { x: 3050, y: 4300 }, { x: FC.x, y: FC.y - 260 }]);
roadPath([{ x: W - FA.x + 240, y: W - FA.y }, { x: W - 4200, y: W - 3050 }, { x: FF.x - 260, y: FF.y + 60 }]);
roadPath([{ x: FF.x + 60, y: FF.y - 230 }, { x: W - 3050, y: W - 4300 }, { x: W - FC.x, y: W - FC.y + 260 }]);
// Mitte: Dorf → Bahnbrücke (Flagge D), Umspannwerk → Ostufer der Eisenbahnbrücke
roadPath([{ x: FC.x + 260, y: C }, { x: FD.x - 200, y: C }]);
roadPath([{ x: FE.x - 260, y: C }, { x: 6200, y: C + 60 }]);
// Feldwege zu Höfen und Steinbruch
roadPath([{ x: FA.x, y: FA.y + 230 }, { x: FA.x + 600, y: 3900 }], 40, true);
roadPath([{ x: FG.x, y: FG.y - 230 }, { x: FG.x - 600, y: W - 3900 }], 40, true);
roadPath([{ x: FG.x + 200, y: FG.y + 80 }, { x: 6250, y: 8300 }], 40, true);
roadPath([{ x: FA.x - 200, y: FA.y - 80 }, { x: W - 6250, y: W - 8300 }], 40, true);

// ---------- Orte ----------

// B Bahnhof: Bahnhofsgebäude und Bahnsteig nördlich der Bahn, Güterzug auf dem Gleis
addBuilding({ x: 2760, y: 3700 - 117, w: 280, h: 110, kind: 'station' }, true);
buildings.push({ x: 2760, y: 3700 - 39, w: 300, h: 30, kind: 'platform' });
for (const [i, part] of ['loco', 'container', 'container', 'tank', 'tank', 'container'].entries()) buildings.push({ x: 1800 - i * 100, y: 3700, w: 96, h: 46, kind: 'train', part });
taken.push({ x0: 1200, y0: 3670, x1: 1860, y1: 3730 });
for (const [x, y] of [[3350, 3480], [2400, 3480], [3550, 3020], [2900, 2900]]) addBuilding({ x, y, w: ri(84, 96), h: ri(70, 84), kind: 'house' });
addBuilding({ x: 3600, y: 3420, w: 80, h: 80, kind: 'tower' }); // Stellwerk-Turm
// F Fabrik: große Fabrikhalle an der Bahn, dazu Fabrik, Hallen, Mauer
addBuilding({ x: 7980, y: W - 3700 + 230, w: 560, h: 240, kind: 'plant' }, true);
addBuilding({ x: 8520, y: 8100, w: 260, h: 170, kind: 'factory' });
addBuilding({ x: 7420, y: 7700, w: 290, h: 100, kind: 'hall' });
addBuilding({ x: 8500, y: 7760, w: 290, h: 100, kind: 'hall' });
addBuilding({ x: 7500, y: 8250, w: 290, h: 100, kind: 'hall' });
for (const [x, y, w, h] of [[7980, 8420, 900, 16], [7530, 7980, 16, 300], [8430, 8320, 16, 160]]) addBuilding({ x, y, w, h, kind: 'wall' });
for (const [i, part] of ['loco', 'tank', 'tank', 'container'].entries()) buildings.push({ x: 8750 + i * 100, y: W - 3700, w: 96, h: 46, kind: 'train', part });
// E Umspannwerk: umfriedeter Hof mit Schalthallen
const SX = FE.x + 40;
const SY = FE.y + 330;
for (const [x, y, w, h] of [[SX, SY - 190, 520, 16], [SX, SY + 190, 520, 16], [SX - 260, SY, 16, 380], [SX + 260, SY, 16, 380]]) addBuilding({ x, y, w, h, kind: 'wall' }, true);
addBuilding({ x: SX - 120, y: SY + 40, w: 150, h: 90, kind: 'hall' }, true);
addBuilding({ x: SX + 120, y: SY + 40, w: 150, h: 90, kind: 'hall' }, true);
addBuilding({ x: FE.x - 420, y: FE.y - 300, w: 90, h: 76, kind: 'house' });
addBuilding({ x: FE.x + 380, y: FE.y - 330, w: 90, h: 76, kind: 'house' });
// A Gehöft: Hof mit Wohnhaus, Scheune, Felder
const fields = [];
const field = (x, y, w, h, crop, kind = 'field') => {
  if (!rectFree(x, y, w, h, -40)) return;
  fields.push({ x, y, w, h, kind, ...(kind === 'field' ? { crop } : {}) });
};
for (const [x, y] of [[FA.x + 330, FA.y - 250], [FA.x - 330, FA.y - 300], [FA.x + 360, FA.y + 260]]) addBuilding({ x, y, w: ri(86, 98), h: ri(72, 86), kind: 'house' });
addBuilding({ x: FA.x - 380, y: FA.y + 300, w: 230, h: 100, kind: 'hall' });
const CROPS = ['wheat', 'rape', 'green', 'soil'];
for (const [dx, dy, k] of [[900, -500, 0], [1250, -500, 1], [900, -180, 2], [1250, 150, 3], [-1000, 500, 1], [-1000, 830, 0], [700, 600, 2]]) field(FA.x + dx, FA.y + dy, 300, 290, CROPS[k]);
field(FA.x + 1600, FA.y - 300, 300, 280, null, 'pasture');
// G Steinbruch: Felsen, Brecherhallen, Kies
for (const [dx, dy, r] of [[480, 300, 91], [700, 520, 121], [320, 640, 75], [880, 260, 65], [600, 850, 101]]) taken.push({ x: FG.x + dx, y: FG.y + dy, r });
addBuilding({ x: FG.x - 380, y: FG.y + 280, w: 230, h: 100, kind: 'hall' });
addBuilding({ x: FG.x + 360, y: FG.y - 300, w: 150, h: 120, kind: 'hall' });
addBuilding({ x: FG.x - 330, y: FG.y - 330, w: 90, h: 76, kind: 'house' });
for (const [dx, dy, k] of [[-900, -500, 1], [-1250, -150, 0], [900, -600, 3], [1250, -280, 2]]) field(FG.x + dx, FG.y + dy, 300, 290, CROPS[k]);
// C Dorf: Hauptstraße West–Ost, Querstraße, Häuser an beiden Seiten
road(FC.x, FC.y - 700, FC.x, FC.y + 700, 56);
road(FC.x - 700, FC.y - 340, FC.x + 500, FC.y - 340, 48);
const village = (cx, cy, n) => {
  for (let i = 0; i < n * 4; i++) {
    const x = cx + ri(-650, 650);
    const y = cy + ri(-650, 650);
    if (roadDist(x, y) > 130 || roadDist(x, y) < 60) continue;
    addBuilding({ x, y, w: ri(80, 96), h: ri(68, 86), kind: 'house' });
    if (buildings.filter((b) => b.kind === 'house' && dist(b.x, b.y, cx, cy) < 900).length >= n) break;
  }
};
village(FC.x, FC.y, 26);
// gespiegelt: Weiler beim Umspannwerk (Osten), damit Gelb so viele Häuser hat wie Grün
road(FE.x - 520, FE.y - 700, FE.x - 520, FE.y + 700, 48);
village(FE.x - 520, FE.y, 14);
// D Bahnbrücke: Bahnwärterhäuser
addBuilding({ x: FD.x - 300, y: FD.y + 300, w: 90, h: 76, kind: 'house' });
addBuilding({ x: FD.x - 320, y: FD.y - 330, w: 90, h: 76, kind: 'house' });
addBuilding({ x: W - FD.x + 230, y: W - FD.y - 260, w: 90, h: 76, kind: 'house' });
addBuilding({ x: W - FD.x + 260, y: W - FD.y + 330, w: 90, h: 76, kind: 'house' });

// ---------- Strommasten ----------

const SUB = { x: SX, y: SY };
const LINES = [
  [SUB, { x: 9400, y: 3200 }, { x: 10700, y: 420 }], // zur Nordost-Ecke
  [SUB, { x: 7000, y: 4700 }, { x: 5600, y: 4350 }, { x: 4300, y: 4200 }, { x: 3400, y: 2500 }, { x: 420, y: 420 }], // quer über die Karte zur Nordwest-Ecke
  [SUB, { x: 8650, y: 6900 }, { x: 8200, y: W - 3700 + 230 }], // zur Fabrik
  [{ x: 420, y: W - 420 }, { x: 1900, y: 8400 }, { x: 3400, y: 7400 }, { x: FD.x - 200, y: 6200 }], // Südwest-Ecke zur Bahnbrücke
];
const pylonOk = (x, y) => !isWet(x, y) && railDist(x, y) > 70 && roadDist(x, y) > 40 && rectFree(x, y, 44, 44, 20) && !spawns.some((s) => dist(x, y, s.x, s.y) < 1300);
LINES.forEach((pts, line) => {
  const STEP = 520;
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const L = dist(a.x, a.y, b.x, b.y);
    for (let s = carry; s <= L; s += STEP) {
      let placed = false;
      for (const ds of [0, 60, -60, 120, -120, 180]) {
        const t = Math.min(1, Math.max(0, (s + ds) / L));
        const x = Math.round(a.x + (b.x - a.x) * t);
        const y = Math.round(a.y + (b.y - a.y) * t);
        if (i === 0 && s === 0 && line !== 3) break; // am Umspannwerk selbst kein Mast (Hof)
        if (!pylonOk(x, y)) continue;
        addBuilding({ x, y, w: 44, h: 44, kind: 'pylon', line }, true);
        placed = true;
        break;
      }
      void placed;
    }
    carry = STEP - ((L - carry) % STEP);
  }
});

// ---------- Wälder, Bäume, Felsen ----------

const obstacles = [];
const forest = (x, y, r) => {
  r = 2 * Math.round(r / 2); // gerader Radius = Wald (terrain.js)
  const ok = !isWet(x, y) && railDist(x, y) > r + 30 && roadDist(x, y) > r + 20 && !FLAGS.some((f) => dist(x, y, f.x, f.y) < r + 200) && !spawns.some((s) => dist(x, y, s.x, s.y) < r + 1500) && !hitRect(x - r, y - r, x + r, y + r, 20);
  if (!ok) return false;
  obstacles.push({ x: Math.round(x), y: Math.round(y), r });
  taken.push({ x, y, r });
  return true;
};
const woods = (cx, cy, R, n, rMin = 110, rMax = 200) => {
  for (let i = 0, made = 0; i < n * 6 && made < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * R;
    if (forest(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd(rMin, rMax))) made++;
  }
};
const WOODS = [
  [5072, 2400, 700, 9], // Hügel am Gehöft
  [2600, 4550, 420, 4],
  [7300, 4300, 380, 4],
  [4300, 6900, 420, 5],
  [3700, 1700, 700, 7], // Norden, zwischen Rot und Grün
  [1700, 3400, 600, 6],
  [8200, 2000, 500, 5],
  [9300, 4000, 500, 4],
];
for (const [x, y, R, n] of WOODS) {
  woods(x, y, R, n);
  const m = mirror({ x, y });
  woods(m.x, m.y, R, n);
}
for (const o of taken.filter((t) => t.r !== undefined && t.r % 2 === 1)) obstacles.push({ x: o.x, y: o.y, r: o.r }); // Felsen am Steinbruch
// Felsen gespiegelt am Gehöft-Hügel (gleiche Deckung für Rot)
for (const [dx, dy, r] of [[480, 300, 91], [700, 520, 121]]) obstacles.push({ x: W - (FG.x + dx) - 260, y: W - (FG.y + dy) - 420, r });
// Ufergehölz und einzelne Bäume
const trees = [];
const treeOk = (x, y, r) => !isWet(x, y) && railDist(x, y) > 40 && roadDist(x, y) > 14 && !FLAGS.some((f) => dist(x, y, f.x, f.y) < 160) && !spawns.some((s) => dist(x, y, s.x, s.y) < 1350) && !hitRect(x - r, y - r, x + r, y + r, 4) && !obstacles.some((o) => dist(x, y, o.x, o.y) < o.r + r);
for (let i = 0; i < 2600 && trees.length < 520; i++) {
  const t = rnd(0.04, 0.96);
  const p = riverAt(t);
  const side = rng.next() < 0.5 ? -1 : 1;
  const n = riverNormal(t);
  const d = rnd(200, 420) * side;
  const x = Math.round(p.x + n.x * d);
  const y = Math.round(p.y + n.y * d);
  const r = ri(12, 20);
  if (dist(x, y, C, C) < 700) continue; // an der Eisenbahnbrücke frei (Sicht)
  if (treeOk(x, y, r)) trees.push({ x, y, r });
}
for (let i = 0; i < 3000 && trees.length < 900; i++) {
  const x = ri(300, W - 300);
  const y = ri(300, W - 300);
  const r = ri(12, 20);
  if (treeOk(x, y, r)) trees.push({ x, y, r });
}
// Baumreihen an den Zufahrten
for (const r of roads.filter((r) => !r.dirt && r.w >= 64)) {
  const L = dist(r.x1, r.y1, r.x2, r.y2);
  const nx = -(r.y2 - r.y1) / L;
  const ny = (r.x2 - r.x1) / L;
  for (let s = 120; s < L - 120; s += 150) {
    for (const side of [-1, 1]) {
      const x = Math.round(r.x1 + ((r.x2 - r.x1) * s) / L + nx * 62 * side);
      const y = Math.round(r.y1 + ((r.y2 - r.y1) * s) / L + ny * 62 * side);
      if (rng.next() < 0.55 && treeOk(x, y, 14)) trees.push({ x, y, r: 14 });
    }
  }
}

// Versorgungskisten (punktsymmetrisch)
const crates = [];
for (const p of [{ x: 4300, y: 4700 }, { x: 4500, y: 2900 }, { x: 2600, y: 6600 }, { x: 7700, y: 2600 }]) {
  for (const q of [p, mirror(p)]) if (!isWet(q.x, q.y) && railDist(q.x, q.y) > 60 && roadDist(q.x, q.y) > 30) crates.push(q);
}

// Parks und Autos im Dorf
const parks = [{ x: FC.x - 260, y: FC.y + 180, r: 110 }];
const cars = [];
for (const b of buildings.filter((b) => b.kind === 'house' && dist(b.x, b.y, FC.x, FC.y) < 800).slice(0, 10)) cars.push({ x: b.x + 60, y: b.y + 56, vertical: false, color: ['#2f4f7a', '#8a2f2f', '#d8d4c8', '#3f5f3f'][cars.length % 4] });

// ---------- Ausgabe ----------

const raw = {
  name: 'East Europe Railway',
  width: W,
  height: W,
  obstacles,
  town: { roads, buildings, parks, cars, trees: [], rails, fields },
  trees,
  spawns,
  zone: { x: C, y: C, r: 3300 },
  crates,
  fords,
  bridges,
  flags: FLAGS,
  layout: 'sides',
};
setRelief(raw, new Relief(coarse));
const map = normalizeMap(raw);
const problems = checkMap(map);
const counts = { häuser: buildings.filter((b) => b.kind === 'house').length, masten: buildings.filter((b) => b.kind === 'pylon').length, wälder: obstacles.filter((o) => o.r % 2 === 0).length, bäume: trees.length, felder: fields.length, kisten: crates.length };
console.log(counts);
if (problems.length) {
  console.error('Karte nicht spielbar:\n- ' + problems.join('\n- '));
  process.exitCode = 1;
}
const out = fileURLToPath(new URL('../../js/data/maps/east-europe-railway.js', import.meta.url));
const head = `// Feste Karte „East Europe Railway“ (Paket „Feste Karten“), erzeugt von tools/maps/east-europe-railway.mjs – nicht von Hand ändern,
// sondern das Skript anpassen und neu ausführen (oder im Editor öffnen und als feste Karte exportieren). Format: js/game/mapdata.js.
`;
writeFileSync(out, `${head}export default ${JSON.stringify(map)};\n`);
console.log(`geschrieben: ${out} (${Math.round(JSON.stringify(map).length / 1024)} KB)`);
