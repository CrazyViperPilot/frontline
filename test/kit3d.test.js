// Baukasten 3D (js/render3d/kit3d.js, town3d.js): jedes Bauteil ist gültige Geometrie (keine NaN, Normalen der Länge 1, nach außen),
// Stadthäuser sparsam und im Umriss wie das gemalte Bild (Iso-Projektion von isokit.G mit Maßstab 1 gegen die Bildmaße in
// townhouses.js). Läuft in Node ohne DOM (three-Kern genügt). Fotos gemalt/3D: node tools/smoke-3d.mjs --only baukasten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Kit3D, KIT_MATS } from '../js/render3d/kit3d.js';
import { townGeometry, hasTown3d } from '../js/render3d/town3d.js';
import { MATS } from '../js/render/materials.js';
import { ISO_K } from '../js/render/camera.js';

/** Prüft Attribute; center: Punkt im Inneren eines geschlossenen Körpers (Normalen zeigen davon weg). */
function check(name, g, center = null) {
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
    assert.ok([0, 1, 2].includes(info.getZ(i)), `${name}: Schnee ${info.getZ(i)}`);
  }
  for (let t = 0; t < pos.count; t += 3) {
    const p = [0, 1, 2].map((k) => [pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)]);
    const e1 = p[1].map((v, i) => v - p[0][i]);
    const e2 = p[2].map((v, i) => v - p[0][i]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...n) < 1e-6) continue;
    // Umlaufsinn passt zur Ecknormale (gegen den Uhrzeiger um die Außennormale)
    assert.ok(n[0] * nor.getX(t) + n[1] * nor.getY(t) + n[2] * nor.getZ(t) > 0, `${name}: Dreieck ${t / 3} falsch herum`);
    if (center) {
      const m = [0, 1, 2].map((i) => (p[0][i] + p[1][i] + p[2][i]) / 3 - center[i]);
      assert.ok(m[0] * n[0] + m[1] * n[1] + m[2] * n[2] > 0, `${name}: Dreieck ${t / 3} zeigt nach innen`);
    }
  }
}

test('Baukasten 3D: jedes Bauteil ist gültige, geschlossene Geometrie mit Außennormalen', () => {
  const parts = {
    box: [(k) => k.box(-10, 10, -6, 6, 0, 12, '#f1e7d3', '#f1e7d3', { bottom: true }), [0, 0, 6]],
    gable_u: [(k) => k.gable('u', -16, 8, -12, 6, 15, 11, '#b4513a', '#f1e7d3'), null],
    gable_v: [(k) => k.gable('v', -8, 8, -16, 10, 15, 9, '#56606a', '#e8cfa8'), null],
    hip_lang: [(k) => k.hip(-20, 16, -14, 9, 22, 10, '#8e5a3e'), null],
    hip_quadrat: [(k) => k.hip(-10, 10, -10, 10, 22, 10, '#8e5a3e'), null],
    cyl: [(k) => k.cyl(0, 0, 5, 0, 20, '#dedbd2'), [0, 0, 10]],
    coneRoof: [(k) => k.coneRoof(0, 0, 5, 20, 3, '#9a9a9a'), [0, 0, 20.5]],
    cap: [(k) => k.cap(0, 0, 4, 10, '#cfcfcf', 1.4), [0, 0, 11]],
    ball: [(k) => k.ball(0, 0, 10, 6, '#6aa35a'), [0, 0, 10]],
    plinth: [(k) => k.plinth(-10, 10, -6, 6, '#f1e7d3'), [0, 0, 0.8]],
    ledge: [(k) => k.ledge(-10, 10, -6, 6, 11, '#d8d0c0'), [0, 0, 11]],
    wallBand: [(k) => k.wallBand(-10, 10, -6, 6, 0, 4, '#c8c0b0'), [0, 0, 2]],
    winsAt: [(k) => ['s', 'n', 'e', 'w'].forEach((f) => k.winsAt(f, f === 's' || f === 'e' ? 6 : -6, [-3, 3], [[3, 8]], 3, { cross: true, shutter: '#4f86b8' })), [0, 0, 5]],
    door: [(k) => k.door('e', 10, 0, 3.2, 9), null],
    parapet: [(k) => k.parapet(-10, 10, -8, 8, 20, '#d8dfe1'), null],
    balcony: [(k) => k.balcony('s', 9, -18, -9, 12, 3, '#4f86b8'), null],
    flat: [(k) => k.flat(-25, 25, -25, 25, '#86b35c'), null],
    tree: [(k) => k.tree(0, 0, 1, 1), null],
    car: [(k) => k.car(0, 0, 'v', '#c0392b'), null],
  };
  for (const [name, [build, center]] of Object.entries(parts)) {
    const k = new Kit3D();
    build(k);
    check(name, k.geometry(), center);
  }
});

test('Baukasten 3D: Materialfotos der Gebäude stammen aus materials.js', () => {
  for (const m of KIT_MATS) assert.ok(MATS[m]?.tile > 0 && MATS[m].alpha > 0, `${m} fehlt in MATS`);
});

// Gemaltes Bild (townhouses.js drawTownIso): Bildmaße [-41, -(TALL+1), 39, 21] bei Maßstab 1, TALL Wohnen [_, 39, 41]
const PAINTED = { 1: { top: -39, rect: [-41, -40, 39, 21] }, 2: { top: -41, rect: [-41, -42, 39, 21] } };

test('Stadthäuser 3D: sparsam, gültig und im Iso-Umriss wie das gemalte Haus', () => {
  assert.ok(hasTown3d('res', 1) && hasTown3d('res', 2) && !hasTown3d('com', 1));
  assert.equal(townGeometry('com', 1, 0), null);
  for (const lv of [1, 2]) {
    for (const v of [0, 1, 2]) {
      const name = `res${lv}/${v}`;
      const g = townGeometry('res', lv, v);
      check(name, g);
      assert.equal(townGeometry('res', lv, v + 3), g, `${name}: nicht zwischengespeichert`);
      const tris = g.getAttribute('position').count / 3;
      assert.ok(tris <= 1200, `${name}: ${tris} Dreiecke`);
      // Iso-Projektion wie isokit.G (Maßstab 1, Drehung 0): x = (u − v)·K, y = (u + v)·K/2 − h
      const pos = g.getAttribute('position');
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const [u, w, h] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const x = (u - w) * ISO_K;
        const y = (u + w) * ISO_K * 0.5 - h;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const P = PAINTED[lv];
      const [r0, q0, r1, q1] = P.rect;
      assert.ok(x0 >= r0 - 1 && x1 <= r1 + 1 && y0 >= q0 - 1 && y1 <= q1 + 1, `${name}: Umriss ${[x0, y0, x1, y1].map((n) => n.toFixed(1))} außerhalb des gemalten Bilds`);
      assert.ok(Math.abs(y0 - P.top) <= 4, `${name}: höchster Punkt ${y0.toFixed(1)} statt ${P.top}`);
      assert.ok(x1 - x0 >= 0.9 * (r1 - r0 - 4), `${name}: zu schmal (${(x1 - x0).toFixed(1)})`);
    }
  }
});
