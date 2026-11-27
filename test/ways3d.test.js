// 3D-Bodenschicht (js/render3d/ways3d.js, Paket „Straßen und Wege 3D“): die Kachelnetze teilen die Dreiecke des Bodennetzes (kein Versatz am Hang),
// Texelzuordnung und Stufen ohne NaN, Kacheln mit Inhalt für Wege, Gleise, Felder, Pflaster; Schienen folgen relief.displayAt;
// gemalt wird nur bei Änderung (Stand je Kachel). Läuft in Node ohne DOM und WebGL (Malen ersetzt ein Stummel). Fotos: node tools/smoke-3d.mjs --only wege.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { Game } from '../js/game/game.js';
import { RELIEF, FINE_N } from '../js/game/relief.js';
import { BALANCE } from '../js/data/balance.js';
import { loadMap } from '../js/game/mapdata.js';
import { Camera } from '../js/render/camera.js';
import { railList } from '../js/render/terrain.js';
import { RAIL, invalidateWays } from '../js/render/ways.js';
import { makeWorldRoot, makeIsoCamera, syncIsoCamera } from '../js/render3d/camera3d.js';
import { TILE, PAD, LODS, Ways3D, tileIndex, tileKey, tileTexel, tileSize, tileBytes, lodFor, mapContentTiles, railGeometry, fenceGeometry } from '../js/render3d/ways3d.js';
import { fieldFences } from '../js/render/fields.js';
import { KIND_ID } from '../js/data/citykinds.js';

const W = BALANCE.map.width;
const NT = Math.ceil(W / TILE);

test('Bodenschicht: die Kachelnetze zusammen sind genau das Bodennetz (jedes Dreieck einmal, Rand ohne Überhang)', () => {
  let total = 0;
  const seen = new Set();
  for (let ty = 0; ty < NT; ty++) {
    for (let tx = 0; tx < NT; tx++) {
      const { index } = tileIndex(tx, ty);
      assert.equal(index.length % 6, 0);
      for (let i = 0; i < index.length; i += 3) {
        const key = `${index[i]},${index[i + 1]},${index[i + 2]}`;
        assert.ok(!seen.has(key), `Dreieck doppelt in Kachel ${tx},${ty}`);
        seen.add(key);
        for (let k = 0; k < 3; k++) assert.ok(index[i + k] >= 0 && index[i + k] < FINE_N * FINE_N, 'Index im Bodennetz');
      }
      total += index.length / 3;
    }
  }
  assert.equal(total, (FINE_N - 1) * (FINE_N - 1) * 2, 'alle Dreiecke des Bodennetzes');
});

test('Bodenschicht: Kachelnetz liegt im Quadrat der Kachel (Weltlage der Ecken), gleiche Teilung wie ground3d.js buildGrid', () => {
  for (const [tx, ty] of [[0, 0], [3, 5], [NT - 1, NT - 1], [NT - 1, 0]]) {
    const { index } = tileIndex(tx, ty);
    assert.ok(index.length > 0);
    for (const v of index) {
      const x = (v % FINE_N) * RELIEF.step;
      const y = Math.floor(v / FINE_N) * RELIEF.step;
      assert.ok(x >= tx * TILE && x <= (tx + 1) * TILE && y >= ty * TILE && y <= (ty + 1) * TILE, `Ecke ${x},${y} außerhalb Kachel ${tx},${ty}`);
    }
    // erste Zelle: (a, a+1, a+n), (a+1, a+n+1, a+n) wie buildGrid
    const a = ty * (TILE / RELIEF.step) * FINE_N + tx * (TILE / RELIEF.step);
    assert.deepEqual([...index.slice(0, 6)], [a, a + 1, a + FINE_N, a + 1, a + FINE_N + 1, a + FINE_N]);
  }
});

test('Bodenschicht: Texelzuordnung der Kachelecken (Rand PAD) und Stufen sind endlich', () => {
  for (const d of LODS) {
    const n = tileSize(d);
    assert.equal(n, Math.round(TILE * d) + 2 * PAD);
    const [u0, v0] = tileTexel(2, 3, d, 2 * TILE, 3 * TILE);
    const [u1, v1] = tileTexel(2, 3, d, 3 * TILE, 4 * TILE);
    assert.equal(u0, PAD);
    assert.equal(v0, PAD);
    assert.ok(Math.abs(u1 - (PAD + TILE * d)) < 1e-9 && Math.abs(v1 - (PAD + TILE * d)) < 1e-9);
    assert.ok(u1 <= n && v1 <= n, 'Kachel im Bild');
    for (const v of [u0, v0, u1, v1]) assert.ok(Number.isFinite(v));
  }
});

test('Bodenschicht: Stufe d folgt der Bildschirmdichte mit Hysterese', () => {
  assert.equal(lodFor(0.28), 0.5, 'Zoom 0,35, Pixeldichte 1');
  assert.equal(lodFor(0.79), 1, 'Zoom 1');
  assert.equal(lodFor(1.26), 1, 'Zoom 1,6: 0,75 · 1,26 < 1: eine Stufe knapper spart Speicher');
  assert.equal(lodFor(1.58), 2, 'Zoom 1, Pixeldichte 2');
  assert.equal(lodFor(3), 2);
  assert.equal(lodFor(1.3, 1), 1, 'kurz über der Stufe: bleibt');
  assert.equal(lodFor(1.6, 1), 2);
  assert.equal(lodFor(0.7, 1), 1, 'leicht unter der Hälfte: bleibt');
  assert.equal(lodFor(0.2, 1), 0.5);
});

test('Bodenschicht: Kacheln mit Inhalt decken Wege, Gleise, Felder und Pflaster (Seed 3, 7, East Europe Railway)', () => {
  const maps = [new Game({ seed: 3 }).map, new Game({ seed: 7 }).map, loadMap('fest:east-europe-railway')];
  for (const map of maps) {
    const set = mapContentTiles(map);
    assert.ok(set.size > 0 && set.size < NT * NT, 'weder leer noch die ganze Karte');
    const has = (x, y) => set.has(tileKey(Math.floor(x / TILE), Math.floor(y / TILE)));
    for (const r of map.town.roads) if (r.dirt) assert.ok(has(r.x1, r.y1) && has(r.x2, r.y2) && has((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2), 'Feldweg');
    for (const r of railList(map.town)) assert.ok(has(r.x1, r.y1) && has(r.x2 - 1, r.y2) && has((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2), 'Gleis');
    for (const f of map.town.fields ?? []) assert.ok(has(f.x, f.y), 'Feld');
    for (const k of set) assert.ok(k >= 0 && k < NT * NT);
  }
  // Pflaster (nur Karten aus dem Editor): Platz und Bürgersteig kommen in die Menge
  const map = new Game({ seed: 3 }).map;
  const before = mapContentTiles(map);
  map.town.plazas = [{ x: 400, y: 300, w: 80, h: 60, angle: 0.4 }];
  map.town.walks = [{ x1: 5000, y1: 5100, x2: 5400, y2: 5100, w: 16 }];
  const after = mapContentTiles(map);
  assert.ok(after.has(tileKey(0, 0)) && after.has(tileKey(9, 9)) && after.has(tileKey(10, 9)), 'Platz und Bürgersteig');
  assert.ok(after.size >= before.size);
});

test('Schienen als Körper: folgen relief.displayAt (Kopf 2 px darüber), Spurweite, gültige Dreiecke, sparsam', () => {
  for (const seed of [3, 7]) {
    const g = new Game({ seed });
    const rails = railList(g.map.town);
    assert.ok(rails.length > 0);
    const geo = railGeometry(rails, g.relief, { rail: '#3e4043', top: '#d6d9db' });
    const p = geo.getAttribute('position');
    for (const a of ['position', 'normal', 'color']) {
      const at = geo.getAttribute(a);
      assert.equal(at.count, p.count);
      for (const v of at.array) assert.ok(Number.isFinite(v), `${a} NaN`);
    }
    const idx = geo.index.array;
    for (const i of idx) assert.ok(i >= 0 && i < p.count);
    assert.ok(idx.length / 3 < 16000, `${idx.length / 3} Dreiecke`);
    // Oberseite je Abtastpunkt: Ecken 0 und 1 des Sechserblocks; Höhe = Gelände unter der Mitte + Kopfhöhe (RAIL_H 2)
    let checked = 0;
    let worst = 0;
    for (let i = 0; i + 5 < p.count; i += 6) {
      const mx = (p.getX(i) + p.getX(i + 1)) / 2;
      const my = (p.getY(i) + p.getY(i + 1)) / 2;
      const dz = p.getZ(i) - g.relief.displayAt(mx, my);
      worst = Math.max(worst, Math.abs(dz - 2.0));
      checked++;
      assert.ok(Math.abs(Math.hypot(p.getX(i) - p.getX(i + 1), p.getY(i) - p.getY(i + 1)) - 2 * RAIL.half) < 2e-3, 'Breite des Kopfes');
    }
    assert.ok(checked > 1000);
    assert.ok(worst < 0.05, `Höhe weicht ab (${worst.toFixed(3)})`);
    // zwei Schienen im Abstand 2 · Spurweite: Querschnitt am Anfang der ersten Strecke
    const r = rails[0];
    const L = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
    const ny = (r.x2 - r.x1) / L;
    const nx = -(r.y2 - r.y1) / L;
    const c1 = [(p.getX(0) + p.getX(1)) / 2, (p.getY(0) + p.getY(1)) / 2];
    const n = Math.ceil(L / 10) + 1; // Abtastpunkte der ersten Schiene
    const c2 = [(p.getX(n * 6) + p.getX(n * 6 + 1)) / 2, (p.getY(n * 6) + p.getY(n * 6 + 1)) / 2];
    assert.ok(Math.abs(Math.hypot(c1[0] - c2[0], c1[1] - c2[1]) - 2 * RAIL.gauge) < 5e-3, 'Spurweite');
    assert.ok(Math.abs((c2[0] - c1[0]) * nx + (c2[1] - c1[1]) * ny - 2 * RAIL.gauge) < 5e-3, 'quer zum Gleis');
  }
  assert.equal(railGeometry([], new Game({ seed: 3 }).relief, { rail: '#000', top: '#fff' }), null, 'ohne Gleise keine Geometrie');
});

test('Zäune der Weiden als Körper: Pfosten stehen auf dem Boden, Latten verbinden sie, Kappen nur im Winter, sparsam', () => {
  for (const seed of [3, 7]) {
    const g = new Game({ seed });
    const items = fieldFences(g.map);
    const posts = items.filter((i) => i.k === 'post' && i.layer === 'post');
    const rails = items.filter((i) => i.k === 'rail' && i.layer === 'rail');
    assert.ok(posts.length > 100 && rails.length > 100, `Seed ${seed}: ${posts.length} Pfosten, ${rails.length} Latten`);
    assert.equal(rails.length % 2, 0, 'je Feld zwei Latten übereinander');
    const sum = g.map.town.fields.filter((f) => f.kind === 'pasture').length;
    assert.ok(sum > 0);
    const summer = fenceGeometry(items, g.relief, 'summer');
    const winter = fenceGeometry(items, g.relief, 'winter');
    for (const geo of [summer, winter]) {
      const p = geo.getAttribute('position');
      for (const a of ['position', 'normal', 'color']) for (const v of geo.getAttribute(a).array) assert.ok(Number.isFinite(v), `${a} NaN`);
      for (const i of geo.index.array) assert.ok(i < p.count);
      assert.ok(geo.index.array.length / 3 < 40000, `${geo.index.array.length / 3} Dreiecke`);
    }
    assert.ok(winter.index.array.length > summer.index.array.length, 'Kappen im Winter');
    // Fuß der Pfosten: tiefster Punkt eines Pfostens liegt auf displayAt
    const p = summer.getAttribute('position');
    const post = posts[0];
    let lo = Infinity;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - post.x) <= post.hw + 1e-3 && Math.abs(p.getY(i) - post.y) <= post.hw + 1e-3) lo = Math.min(lo, p.getZ(i));
    assert.ok(Math.abs(lo - g.relief.displayAt(post.x, post.y)) < 0.01, 'Pfosten auf dem Boden');
  }
  assert.equal(fenceGeometry([], new Game({ seed: 3 }).relief, 'summer'), null);
});

/** Stummel für gl und Boden, Renderer-Rumpf: Kamera, Wurzelgruppe, Spiel; Malen zählt nur. */
function rig(game) {
  const gl = { capabilities: { getMaxAnisotropy: () => 4 }, initTexture() {} };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FINE_N * FINE_N * 3), 3));
  geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(FINE_N * FINE_N * 3), 3));
  const ground = { mesh: { geometry: geo }, uniforms: { uLight: { value: new THREE.Vector3(0, 0, 1) } } };
  const w = new Ways3D(gl, ground);
  const painted = [];
  w.paint = (t, ren, f, d, stamp) => {
    painted.push(`${t.tx},${t.ty}`);
    t.tex = t.tex ?? { dispose() {} };
    t.d = d;
    t.stamp = stamp;
    t.bytes = 1;
  };
  const camera = new Camera(W, W);
  camera.iso = true;
  camera.three = true;
  camera.relief = game.relief;
  camera.resize(1280, 800);
  const ren = { game, camera, cam3: makeIsoCamera(), groundRoot: makeWorldRoot(), season: 'summer', cssW: 1280, cssH: 800, dpr: 1 };
  const hq = game.buildings.find((b) => b.main && b.team === 0);
  camera.centerOn(hq.x, hq.y);
  const frame = () => {
    syncIsoCamera(ren.cam3, camera);
    ren.groundRoot.updateMatrixWorld();
    painted.length = 0;
    return w.update(ren, { relief: game.relief, team: 0, known: () => true, reveal: false });
  };
  return { w, ren, painted, frame, camera };
}

test('Bodenschicht: gemalt wird nur bei Änderung (Stand je Kachel), nahe Straßen ändern nur nahe Kacheln, Jahreszeit alle', () => {
  const g = new Game({ seed: 3 });
  g.update(0.05);
  const { w, ren, painted, frame } = rig(g);
  w.budgetMs = 1e9;
  const a = frame();
  assert.ok(a.visible > 0 && a.painted === a.visible, `erstes Bild malt alle ${a.visible} Kacheln im Bild (${a.painted})`);
  assert.ok(a.d === 1, `Stufe bei Zoom 1: ${a.d}`);
  for (let i = 0; i < 3; i++) assert.equal(frame().painted, 0, 'unverändert: nichts malen');
  // neue Straßenzelle der Stadt nahe der Hauptstadt
  const hq = g.buildings.find((b) => b.main && b.team === 0);
  const c = g.city[0];
  const i = Math.floor(hq.y / c.cell) * c.cols + Math.floor(hq.x / c.cell) + 7;
  assert.ok(!c.kind[i]);
  c.kind[i] = KIND_ID.road;
  c.list.push(i);
  g.time += 1; // Straßenzellen werden alle 0,25 s Spielzeit abgefragt
  const b = frame();
  assert.ok(b.painted > 0 && b.painted <= 9, `Straßenzelle: ${b.painted} Kacheln (höchstens 9)`);
  assert.equal(frame().painted, 0);
  // Jahreszeit: alle sichtbaren Kacheln
  ren.season = 'winter';
  assert.equal(frame().painted, b.visible, 'Jahreszeit malt alle Kacheln im Bild');
  // Editor / Fotos der Muster: invalidateWays
  invalidateWays();
  assert.equal(frame().painted, b.visible);
  assert.equal(frame().painted, 0);
});

test('Bodenschicht: Zeitbudget je Bild (mindestens eine Kachel), Rest bleibt in der Warteschlange und kommt in den nächsten Bildern', () => {
  const g = new Game({ seed: 3 });
  const { w, painted, frame } = rig(g);
  w.budgetMs = 0;
  const first = frame();
  assert.equal(first.painted, 1, 'mindestens eine Kachel');
  assert.equal(first.pending, first.visible - 1);
  let n = 1;
  for (let i = 0; i < 80 && frame().pending > 0; i++) n += painted.length;
  assert.equal(frame().pending, 0);
  assert.ok(n >= first.visible - 1);
});

test('Bodenschicht: Zoom wechselt die Stufe, Kacheln im Bild folgen dem Ausschnitt (Frustum), ferne bleiben aus', () => {
  const g = new Game({ seed: 3 });
  const { w, ren, camera, frame } = rig(g);
  w.budgetMs = 1e9;
  const near = frame();
  camera.zoom = 1.6;
  const closer = frame();
  assert.equal(closer.d, 1, 'Zoom 1,6 bei Pixeldichte 1: Stufe 1');
  ren.dpr = 2;
  const dense = frame();
  assert.equal(dense.d, 2, 'Pixeldichte 2: Stufe 2');
  assert.equal(dense.painted, dense.visible, 'neue Stufe: alles neu malen');
  assert.ok(dense.visible * tileBytes(2) <= w.maxBytes, 'Texturspeicher der Kacheln im Bild unter der Grenze');
  w.maxBytes = 5e6;
  assert.ok(frame().d < 2, 'bei knappem Speicher eine Stufe feiner abwärts');
  w.maxBytes = 64e6;
  ren.dpr = 1;
  frame();
  camera.zoom = 0.35;
  const far = frame();
  assert.equal(far.d, 0.5);
  assert.ok(far.visible >= near.visible, `weit weg mehr Kacheln (${far.visible} gegen ${near.visible})`);
  assert.ok(far.visible < NT * NT, 'nicht die ganze Karte');
  camera.zoom = 1;
  camera.centerOn(W / 2, W / 2);
  const mid = frame();
  assert.ok(mid.visible > 0);
});
