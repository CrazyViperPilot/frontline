// Kartenstadt 3D (js/render3d/maptown3d.js): jedes Gebäude der Karte (Seeds 3 und 7, feste Karte mit Bahnhof, Fabrikhalle, Masten) wird
// gültige Geometrie (keine NaN, Normalen der Länge 1, Umlaufsinn passt), sparsam (Dreiecke je Variante begrenzt), im Umriss wie das
// gemalte Bild (Grundriss im Maß des Gebäudes, höchster Punkt gegen die Bildhöhe in maptown.js/landmarks.js ±3 px), und die Hochspannungs-
// leitung (Wires3D) folgt den Masten mit Durchhang. Läuft in Node ohne DOM (three-Kern genügt). Fotos gemalt/3D: node tools/smoke-3d.mjs --only baukasten --what kartenstadt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../js/game/map.js';
import { FIXED_MAPS } from '../js/data/maps/index.js';
import { setMapTown, mapPylons, q8 } from '../js/render/maptown.js';
import { PYLON_TALL, PLANT_TALL } from '../js/render/landmarks.js';
import { hasMapTown3d, mapTownGeometry, mapTownKey, mapTownScale, mapTownYaw, Wires3D, MAP_KINDS } from '../js/render3d/maptown3d.js';
import { KIT_MATS } from '../js/render3d/kit3d.js';

// Bildhöhen der gemalten Bilder (maptown.js HOUSE_TALL, TALL; Wachturm 115 · k, Zug 36)
const TALL = { alt: 52, klinker: 53, fach: 46, neu: 46, farm: 48, hall: 44, factory: 122, wall: 22, station: 60, platform: 34, plant: PLANT_TALL, tower: 115, train: 36, pylon: PYLON_TALL };
const MAX_TRIS = { house: 3200, hall: 2000, factory: 2600, wall: 1200, train: 700, station: 3200, platform: 600, plant: 3600, tower: 1800, pylon: 1800 };

const maps = [
  ['Seed 3', generateMap(3)],
  ['Seed 7', generateMap(7)],
  ['feste Karte', FIXED_MAPS[0].map],
];

/** Prüft Attribute; Normalen Länge 1, Umlaufsinn gegen die Ecknormale. */
function check(name, g) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of ['position', 'normal', 'color', 'aUv', 'aInfo']) {
    const at = g.getAttribute(a);
    assert.equal(at.count, pos.count, `${name}: ${a} fehlt`);
    for (const v of at.array) assert.ok(Number.isFinite(v), `${name}: ${a} NaN`);
  }
  for (let i = 0; i < nor.count; i++) {
    const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    assert.ok(Math.abs(l - 1) < 1e-3, `${name}: Normale Länge ${l}`);
  }
  const info = g.getAttribute('aInfo');
  for (let i = 0; i < info.count; i++) {
    assert.ok(info.getX(i) >= 0 && info.getX(i) <= KIT_MATS.length, `${name}: Material ${info.getX(i)}`);
    assert.ok([0, 1, 2, 3, 4].includes(info.getZ(i)), `${name}: Schnee ${info.getZ(i)}`);
  }
  let flipped = 0;
  for (let t = 0; t < pos.count; t += 3) {
    const p = [0, 1, 2].map((k) => [pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)]);
    const e1 = p[1].map((v, i) => v - p[0][i]);
    const e2 = p[2].map((v, i) => v - p[0][i]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...n) < 1e-6) continue;
    if (n[0] * nor.getX(t) + n[1] * nor.getY(t) + n[2] * nor.getZ(t) <= 0) flipped++;
  }
  assert.equal(flipped, 0, `${name}: ${flipped} Dreiecke falsch herum`);
}

/** Gebäude je Schlüssel (eines je Variante) aus allen Karten. */
function variants() {
  const out = new Map();
  for (const [mapName, map] of maps) {
    setMapTown(map);
    for (const b of map.town.buildings) {
      const key = mapTownKey(b);
      if (!out.has(key)) out.set(key, { b, map, mapName });
    }
  }
  return out;
}

test('Kartenstadt 3D: alle Arten der Karten haben eine Geometrie (nichts bleibt gemalt)', () => {
  const kinds = new Set();
  for (const [, map] of maps) for (const b of map.town.buildings) {
    kinds.add(b.kind);
    assert.ok(hasMapTown3d(b), `${b.kind} ohne 3D`);
  }
  for (const k of ['house', 'hall', 'factory', 'wall', 'train', 'tower', 'station', 'platform', 'plant', 'pylon']) assert.ok(kinds.has(k), `${k} fehlt in den Prüfkarten`);
  for (const k of kinds) assert.ok(MAP_KINDS.has(k), `${k} nicht in MAP_KINDS`);
});

test('Kartenstadt 3D: jede Variante ist gültige Geometrie, begrenzt in Dreiecken, Umriss wie gemalt', () => {
  const all = variants();
  assert.ok(all.size > 40, `nur ${all.size} Varianten`);
  for (const [key, { b, map }] of all) {
    setMapTown(map);
    const g = mapTownGeometry(b);
    check(key, g);
    const tris = g.getAttribute('position').count / 3;
    const kind = b.kind;
    assert.ok(tris <= MAX_TRIS[kind], `${key}: ${tris} Dreiecke (Grenze ${MAX_TRIS[kind]})`);
    // Maße nach Streckung der Instanz (Häuser) im Maß des gemalten Bilds
    const sc = mapTownScale(b) ?? [1, 1];
    const bb = g.boundingBox;
    const ext = [Math.max(-bb.min.x, bb.max.x) * sc[0], Math.max(-bb.min.y, bb.max.y) * sc[1]];
    const z = bb.max.z;
    let style = kind;
    if (kind === 'house') style = key.split('|')[1];
    const tall = TALL[style];
    assert.ok(z <= tall + 3, `${key}: höchster Punkt ${z.toFixed(1)} über Bildhöhe ${tall}`);
    assert.ok(z >= tall * 0.55, `${key}: höchster Punkt ${z.toFixed(1)} weit unter Bildhöhe ${tall}`);
    if (kind === 'house') {
      const A = Math.max(q8(b.w), q8(b.h));
      const B = Math.min(q8(b.w), q8(b.h));
      assert.ok(ext[0] <= A / 2 + 3 && ext[1] <= B / 2 + 5, `${key}: Grundriss ${ext.map((v) => v.toFixed(1))} gegen ${A} × ${B}`);
      assert.ok(ext[0] >= A / 2 - 8 && ext[1] >= B / 2 - 10, `${key}: Grundriss zu klein ${ext.map((v) => v.toFixed(1))} gegen ${A} × ${B}`);
    } else if (['hall', 'factory', 'wall', 'station', 'platform', 'plant'].includes(kind)) {
      const A = Math.max(b.w, b.h);
      const B = Math.min(b.w, b.h);
      assert.ok(ext[0] <= A / 2 + 3 && ext[1] <= B / 2 + (kind === 'station' ? 8 : 3), `${key}: Grundriss ${ext.map((v) => v.toFixed(1))} gegen ${A} × ${B}`);
      assert.ok(ext[0] >= A / 2 - 6, `${key}: Grundriss zu kurz ${ext[0].toFixed(1)} gegen ${A}`);
    }
  }
});

test('Kartenstadt 3D: Häuser teilen eine Geometrie je Stil und Farbe, Instanz streckt sie auf das Maß', () => {
  const [, map] = maps[0];
  setMapTown(map);
  const houses = map.town.buildings.filter((b) => b.kind === 'house');
  const keys = new Set(houses.map(mapTownKey));
  assert.ok(keys.size <= 30, `${keys.size} Hausgeometrien`);
  assert.ok(houses.length > keys.size * 4, 'zu wenig geteilt');
  for (const b of houses) {
    const [sx, sy] = mapTownScale(b);
    assert.ok(sx > 0.7 && sx < 1.2 && sy > 0.7 && sy < 1.2, `Streckung ${sx} ${sy}`);
    assert.equal(mapTownYaw(b), b.w >= b.h ? 0 : -Math.PI / 2);
  }
});

test('Kartenstadt 3D: Leitung (Wires3D) folgt den Masten, ohne NaN, mit Durchhang', () => {
  const map = FIXED_MAPS[0].map;
  setMapTown(map);
  const net = mapPylons(map);
  assert.ok(net.size >= 10, 'keine Masten');
  const w = new Wires3D();
  const fields = w.update(net, (x, y) => 5 + x * 0.01, () => true);
  assert.ok(fields >= 9, `${fields} Felder`);
  const n = w.mesh.geometry.drawRange.count;
  assert.ok(n > 0 && n % 2 === 0);
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let i = 0; i < n * 3; i++) assert.ok(Number.isFinite(w.pos[i]), 'NaN in der Leitung');
  for (let i = 2; i < n * 3; i += 3) {
    zmin = Math.min(zmin, w.pos[i]);
    zmax = Math.max(zmax, w.pos[i]);
  }
  assert.ok(zmax - zmin > 100, 'Seile hängen nicht am Mast');
  assert.equal(w.update(net, () => 0, () => false), 0);
  assert.equal(w.mesh.visible, false);
});
