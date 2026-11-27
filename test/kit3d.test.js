// Baukasten 3D (js/render3d/kit3d.js, town3d.js, works3d.js): jedes Bauteil ist gültige Geometrie (keine NaN, Normalen der Länge 1,
// nach außen), Stadthäuser und Werke sparsam und im Umriss wie das gemalte Bild (Iso-Projektion von isokit.G mit Maßstab 1 gegen die
// Bildmaße in townhouses.js bzw. works.js). Läuft in Node ohne DOM (three-Kern genügt). Fotos gemalt/3D: node tools/smoke-3d.mjs --only baukasten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Kit3D, KIT_MATS } from '../js/render3d/kit3d.js';
import { townGeometry, hasTown3d, townKey, FAMILIES } from '../js/render3d/town3d.js';
import { worksGeometry, worksKey, hasWorks3d } from '../js/render3d/works3d.js';
import { WORKS_KINDS, worksBox, worksTall } from '../js/render/works.js';
import { TALL, TEAM_SHOWN } from '../js/render/townhouses.js';
import { BIG3D_KINDS, bigGeometry, uniGeometry, bigKey, uniKey, hasBig3d, isBig3dPart } from '../js/render3d/bigbuild3d.js';
import { hallGeometry, quarterGeometry, quarterKey } from '../js/render3d/gov3d.js';
import { bigPlan, bigTop } from '../js/render/bigbuild.js';
import { M as HALL_M } from '../js/render/cityhall.js';
import { _quarter, INNER, QUARTER_PAL } from '../js/render/govquarter.js';
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
    assert.ok([0, 1, 2, 3, 4].includes(info.getZ(i)), `${name}: Schnee ${info.getZ(i)}`);
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
    rod: [(k) => k.rod([0, 0, 0], [3, -2, 10], 0.8, '#55595d'), null],
    tube: [(k) => k.tube([0, 0, 9], [6, 0, 8.5], 1.3, 0.6, '#f07a2a'), null],
    disc: [(k) => k.disc('e', 4, 0, 10, 2.7, '#f4f1e6', 0.2), null],
    ring: [(k) => k.ring(0, 0, 5, 1.8, '#6fa8d2'), null],
    storefront: [(k) => ['s', 'e', 'n', 'w'].forEach((f) => k.storefront(f, 4, -10, 10, 1.2, 9.8, 3.4, f === 's' ? -3 : null, 5)), null],
    awning: [(k) => ['s', 'e', 'n', 'w'].forEach((f) => k.awning(f, 4, -10, 10, 10.6, 5, 2.3, ['#c8423a', '#f3eee4'], 6)), null],
    archWins: [(k) => k.archWins('n', -6, [-3, 3], 2.8, 7, 3.2, { seed: 3 }), null],
    fanWin: [(k) => k.fanWin('w', -10, 0, 11, 5), null],
    vault_u: [(k) => k.vault('u', -21, 11, -20, 4, 11, 8, '#6e9d8e', '#b8664c'), null],
    vault_v: [(k) => k.vault('v', 6, 24, -24, -8, 8, 6.5, '#8d9aa4', '#c9cbc6'), null],
    pyramid: [(k) => k.pyramid(0, 0, 5.4, 34, 11, '#6e9d8e'), [0, 0, 36]],
    fan: [(k) => k.fan(0, 0, 12.4, 2.2), null],
    dish: [(k) => k.dish(0, 0, 16, 3.6), null],
    mast: [(k) => k.mast(0, 0, 34, 70, 2.2, 0.5), null],
    fence: [(k) => k.fence(-24, 24, -24, 24), null],
    ribs: [(k) => k.ribs(-19, 9, -17, 5, 0.8, 8.6, 1.8, '#5a636b'), null],
    acUnit: [(k) => k.acUnit(0, 0, 12.8, 2.5), null],
    lamp: [(k) => k.lamp(0, 0), null],
    flagpole: [(k) => k.flagpole(0, 0, 0, 15, '#3a6fb3'), null],
    van: [(k) => (k.van(0, 0, 'u', '#f4f3ef', '#d8313b', true), k.van(12, 0, 'v', '#f4f3ef', '#d8313b', true)), null],
    crate: [(k) => k.crate(0, 0), [0, 0, 1]],
    cobble: [(k) => k.cobble(), null],
    solar: [(k) => k.solar(-3, 14, -15, 4.6, 60.7, 62.7), null],
    helipad: [(k) => k.helipad(0, 0, 14.5), null],
    fountain: [(k) => k.fountain(0, 0, 5), null],
    clockFace: [(k) => k.clockFace('s', 5, 0, 28, 2.7), null],
    // Bauteile der Werke
    facePoly: [(k) => k.facePoly('s', 5, [[-1.5, 0], [1.5, 0], [1.5, 3], [0, 4.5], [-1.5, 3]], '#2d2420', 0.1, { emit: true }), null],
    lathe: [(k) => k.lathe(0, 0, [[10, 0], [7, 20], [9, 40]], '#d6d2c9'), null],
    frustum_inside: [(k) => k.frustum(0, 0, 6, 6, 0, 8, '#aaa', { inside: true }), null],
    band: [(k) => (k.cyl(0, 0, 5, 0, 10, '#ddd', { top: false }), k.band(0, 0, 5, 3, 5, '#c0392b')), null],
    seam: [(k) => k.seam(0, 0, 5, 4), null],
    stack: [(k) => k.stack(0, 0, 5.8, 4.2, 100, { bands: 3, light: true }), null],
    sphere: [(k) => k.sphere(0, 0, 8, 3), null],
    hcyl_u: [(k) => k.hcyl('u', -6, 6, 0, 5, 2.8, '#6e5a4d'), [0, 0, 5]],
    hcyl_v: [(k) => k.hcyl('v', -6, 6, 0, 5, 2.8, '#6e5a4d'), [0, 0, 5]],
    pipe: [(k) => k.pipe([[0, 0, 2], [10, 0, 2], [10, 10, 7]], 1.2), null],
    rack: [(k) => k.rack('u', -20, 20, 0, 7), null],
    wire: [(k) => k.wire([0, 0, 8], [20, 10, 20], 2), null],
    gallery: [(k) => k.gallery([0, 0, 3], [-12, 30, 33]), null],
    conveyor: [(k) => k.conveyor(0, 0, 1.5, -20, 4, 6.5, 1.6), null],
    heap: [(k) => k.heap(0, 0, 12, 9, '#a5653f'), null],
    rails: [(k) => k.rails(-20, 20, 0), null],
    logPile: [(k) => k.logPile(0, 24, 0, 10, 2), null],
    mound: [(k) => (k.mound(0, 20, 0, 50, 8, '#2c2a27'), k.mound(40, 90, 0, 20, 8, '#2c2a27')), null],
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

// Gemaltes Bild (townhouses.js drawTownIso): Bildmaße [-41, -(TALL + 1), 39, 21] bei Maßstab 1, höchster Punkt −TALL
const KINDS = Object.keys(TALL);

test('Stadthäuser 3D: alle Arten und Stufen, sparsam, gültig und im Iso-Umriss wie das gemalte Haus', () => {
  assert.deepEqual(KINDS, ['res', 'com', 'market', 'dc', 'hospital', 'heliport']);
  assert.equal(townGeometry('fabrik', 1, 0), null);
  assert.ok(!hasTown3d('fabrik', 1));
  for (const ck of KINDS) {
    for (const lv of [1, 2, 3]) {
      assert.ok(hasTown3d(ck, lv), `${ck}${lv}: kein 3D-Haus`);
      for (const v of [0, 1, 2]) {
        const name = `${ck}${lv}/${v}`;
        const g = townGeometry(ck, lv, v, '#3a6fb3');
        check(name, g);
        assert.equal(townGeometry(ck, lv, v + 3, '#3a6fb3'), g, `${name}: nicht zwischengespeichert`);
        // Teamfarbe nur, wo das gemalte Bild sie zeigt (TEAM_SHOWN): sonst dieselbe Geometrie für alle Teams
        const team = TEAM_SHOWN.has(ck + lv);
        assert.equal(townGeometry(ck, lv, v, '#c8423a') === g, !team, `${name}: Teamfarbe`);
        assert.equal(townKey(ck, lv, v, '#c8423a') === townKey(ck, lv, v, '#3a6fb3'), !team);
        const tris = g.getAttribute('position').count / 3;
        assert.ok(tris <= 2000, `${name}: ${tris} Dreiecke`);
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
        const tall = TALL[ck][lv];
        const [r0, q0, r1, q1] = [-41, -(tall + 1), 39, 21];
        assert.ok(x0 >= r0 - 1 && x1 <= r1 + 1 && y0 >= q0 - 1 && y1 <= q1 + 1, `${name}: Umriss ${[x0, y0, x1, y1].map((n) => n.toFixed(1))} außerhalb des gemalten Bilds`);
        assert.ok(Math.abs(y0 + tall) <= 4, `${name}: höchster Punkt ${y0.toFixed(1)} statt ${-tall}`);
        assert.ok(x1 - x0 >= 0.9 * (r1 - r0 - 4), `${name}: zu schmal (${(x1 - x0).toFixed(1)})`);
      }
    }
  }
});

// ---------- Werke ----------

const TALL_W = (kind, lv) => worksTall(kind, lv);

test('Werke 3D: alle Arten und Stufen, sparsam, gültig und im Iso-Umriss wie das gemalte Werk', () => {
  assert.deepEqual(WORKS_KINDS.slice().sort(), ['bm', 'fuel', 'kero', 'mun', 'power', 'steel']);
  assert.equal(worksGeometry('uni', 1), null);
  assert.ok(!hasWorks3d('uni'));
  for (const kind of WORKS_KINDS) {
    for (const lv of [1, 2, 3]) {
      const name = `${kind}${lv}`;
      assert.ok(hasWorks3d(kind), `${kind}: kein 3D-Werk`);
      const g = worksGeometry(kind, lv);
      check(name, g);
      assert.equal(worksGeometry(kind, lv + 3 - 3), g, `${name}: nicht zwischengespeichert`);
      assert.equal(worksKey(kind, lv), `${kind}|${lv}`);
      const tris = g.getAttribute('position').count / 3;
      assert.ok(tris <= 6000, `${name}: ${tris} Dreiecke`);
      // Teamfarbe nur auf Flächen mit TEAM_WIN (aInfo.y = 97), sonst nichts: es gibt mindestens eine Fläche in Teamfarbe
      const info = g.getAttribute('aInfo');
      let team = 0;
      for (let i = 0; i < info.count; i++) if (info.getY(i) === 97) team++;
      assert.ok(team > 0, `${name}: keine Teamfarbe`);
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
      const tall = TALL_W(kind, lv);
      const [r0, q0, r1, q1] = worksBox(kind, lv);
      assert.deepEqual([r0, q0, r1, q1], [-84, -(tall + 2), 84, 47]);
      assert.ok(x0 >= r0 - 1 && x1 <= r1 + 1 && y0 >= q0 - 1 && y1 <= q1 + 1, `${name}: Umriss ${[x0, y0, x1, y1].map((n) => n.toFixed(1))} außerhalb des gemalten Bilds`);
      assert.ok(Math.abs(y0 + tall) <= 4, `${name}: höchster Punkt ${y0.toFixed(1)} statt ${-tall}`);
      assert.ok(x1 - x0 >= 0.9 * (r1 - r0 - 4), `${name}: zu schmal (${(x1 - x0).toFixed(1)})`);
    }
  }
});

test('Gebäudefamilien: Stadthäuser, Werke und Großbauten (und Kartenstadt) teilen sich Town3D, Werke und Großbauten tönt die Instanz', () => {
  assert.deepEqual(FAMILIES.map((f) => f.name), ['town', 'works', 'big', 'big', 'big', 'big', 'mil', 'mil', 'maptown']); // Kartenstadt: test/maptown3d.test.js
  const [town, works, big, uni, hall, quarter] = FAMILIES;
  assert.ok(town.has({ kind: 'town' }) && !town.has({ kind: 'power' }));
  assert.ok(works.has({ kind: 'power' }) && !works.has({ kind: 'town' }) && !works.has({ kind: 'uni' }));
  assert.ok(works.team && !town.team);
  // eine Geometrie für alle Teams
  assert.equal(works.geometry({ kind: 'steel', level: 2, color: '#c8423a' }), works.geometry({ kind: 'steel', level: 2, color: '#3a6fb3' }));
  assert.equal(works.key({ kind: 'steel', level: 2, color: '#c8423a' }), works.key({ kind: 'steel', level: 2, color: '#3a6fb3' }));
  // Großbauten: nur Körper der 3D-Arten (Bäume, Ausstellungsstücke, Fliegerhorst bleiben gemalt), alle Körper einer Anlage teilen ein Gegenstück
  const plan = { k: 'barracks', lv: 3, x: 500, y: 600, size: 256, color: '#c8423a' };
  const body = { kind: 'bigpart', part: { t: 'box' }, plan };
  assert.ok(big.has(body) && !big.has({ ...body, part: { t: 'tree' } }) && !big.has({ ...body, part: { t: 'unit' } }));
  assert.ok(!big.has({ ...body, plan: { ...plan, k: 'stand' } }) && !big.has({ kind: 'bigpart', part: { t: 'box' } }));
  assert.equal(big.at(body), plan);
  assert.equal(big.key(body), bigKey('barracks', 3));
  assert.equal(big.geometry(body), bigGeometry('barracks', 3));
  assert.ok(uni.has({ kind: 'uni' }) && !uni.at && uni.key({ kind: 'uni', level: 2 }) === uniKey(2));
  assert.ok(hall.has({ kind: 'hall' }) && quarter.has({ kind: 'quarter' }) && quarter.at({ src: plan }) === plan);
  assert.equal(quarter.key({ turn: 1, mask: 5 }), quarterKey(1, 5));
  assert.ok([big, uni, hall, quarter].every((f) => f.team));
  for (const f of FAMILIES.slice(0, 6)) assert.ok([town, works, big, uni, hall, quarter].includes(f)); // „mil“: test/mil3d.test.js
  assert.ok(!hasBig3d('stand') && !hasBig3d('atc') && !hasBig3d('ktank') && !hasBig3d('mdepot') && !hasBig3d('uni'));
});

// ---------- Großbauten ----------

/** Iso-Rechteck (Maßstab 1, Drehung 0) aus Punkten [u, v, h] wie isokit.G. */
function isoBox(points) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [u, w, h] of points) {
    const x = (u - w) * ISO_K;
    const y = (u + w) * ISO_K * 0.5 - h;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, x1, y0, y1];
}
const isoOf = (g) => {
  const pos = g.getAttribute('position');
  return isoBox(Array.from({ length: pos.count }, (_, i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]));
};
const teamVerts = (g) => {
  const info = g.getAttribute('aInfo');
  let n = 0;
  for (let i = 0; i < info.count; i++) if (info.getY(i) === 97) n++;
  return n;
};
const near = (name, got, want, tol) => got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= tol, `${name}: Umriss ${got.map((n) => n.toFixed(1))} statt ${want.map((n) => n.toFixed(1))} (±${tol})`));

test('Großbauten 3D: Kaserne, Fabrikhalle, Lagerhalle, Güterbahnhof in allen Stufen, sparsam, gültig und im Umriss wie die gemalten Körper', () => {
  assert.deepEqual(BIG3D_KINDS, ['barracks', 'factory', 'warehouse', 'station']);
  assert.equal(bigGeometry('stand', 1), null);
  for (const kind of BIG3D_KINDS) {
    for (const lv of [1, 2, 3]) {
      const name = `${kind}${lv}`;
      const g = bigGeometry(kind, lv);
      check(name, g);
      assert.equal(bigGeometry(kind, lv), g, `${name}: nicht zwischengespeichert`);
      assert.equal(bigKey(kind, lv), `${kind}|${lv}`);
      const tris = g.getAttribute('position').count / 3;
      assert.ok(tris <= 3000, `${name}: ${tris} Dreiecke`);
      if (kind !== 'warehouse') assert.ok(teamVerts(g) > 0, `${name}: keine Teamfarbe`); // gemalt zeigt die Lagerhalle keine
      // die gemalten Körper (bigbuild.js bigPlan): Quader mit Dach, Zylinder, Fahnen; Bäume und Ausstellungsstücke bleiben Billboards
      const pts = [];
      for (const p of bigPlan(kind, lv, 0, 0, 1, 0).bodies) {
        if (!isBig3dPart(p)) continue;
        if (p.t === 'box') {
          const [base, top] = [p.base ?? 0, (p.base ?? 0) + p.h];
          const [xm, ym] = [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2];
          for (const [u, v] of [[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]]) pts.push([u, v, base], [u, v, top + (p.saw && u === p.x1 ? p.saw.rh : 0)]); // Sheddach: Glasseite nach +x
          if (p.gable) for (const [u, v] of p.x1 - p.x0 >= p.y1 - p.y0 ? [[p.x0, ym], [p.x1, ym]] : [[xm, p.y0], [xm, p.y1]]) pts.push([u, v, top + p.gable]); // First
        } else if (p.t === 'cyl') {
          for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([p.x + du * p.r, p.y + dv * p.r, p.base ?? 0], [p.x + du * p.r1, p.y + dv * p.r1, (p.base ?? 0) + p.h]);
        } else {
          const d = 16 * Math.SQRT1_2;
          pts.push([p.x, p.y, 0], [p.x, p.y, p.h], [p.x + d, p.y - d, p.h], [p.x + d, p.y - d, p.h - 10]);
        }
      }
      near(name, isoOf(g), isoBox(pts), 3);
      // höchster Punkt wie bigTop (Schild darüber): Körper ohne Bäume und Ausstellungsstücke
      const top = g.boundingBox.max.z;
      assert.ok(top <= Math.max(bigTop(kind, lv), 31) + 0.5 && top >= 25, `${name}: Höhe ${top}`);
    }
  }
});

test('Großbauten 3D: Universität in allen Stufen im Umriss wie das gemalte Bild', () => {
  const TOP = [0, 80, 102, 110]; // Fahne über Kuppel (und Laterne ab Stufe 2): wie university.core
  for (const lv of [1, 2, 3]) {
    const g = uniGeometry(lv);
    check(`uni${lv}`, g);
    assert.equal(uniGeometry(lv), g);
    assert.ok(g.getAttribute('position').count / 3 <= 4000, `uni${lv}: zu viele Dreiecke`);
    assert.ok(teamVerts(g) > 0);
    const bb = g.boundingBox;
    assert.ok(Math.abs(bb.max.z - TOP[lv]) <= 1, `uni${lv}: Höhe ${bb.max.z}`);
    for (const v of [bb.min.x, bb.min.y, bb.max.x, bb.max.y]) assert.ok(Math.abs(v) <= 96, `uni${lv}: außerhalb des 3 × 3-Quadrats`); // ±96
    // Iso: vierfach symmetrisch (u ↔ v), also steht die Mitte im Bild mittig
    const [x0, x1] = isoOf(g);
    assert.ok(Math.abs(x0 + x1) <= 4, `uni${lv}: nicht mittig (${x0.toFixed(1)}, ${x1.toFixed(1)})`);
  }
});

test('Großbauten 3D: Regierungsgebäude im Umriss wie das gemalte Bild (cityhall.js, Bildmaße [−72, −126, 76, 42])', () => {
  const g = hallGeometry();
  check('hall', g);
  assert.equal(hallGeometry(), g);
  assert.ok(g.getAttribute('position').count / 3 <= 4000);
  assert.ok(teamVerts(g) > 0);
  const [x0, x1, y0, y1] = isoOf(g);
  const [r0, q0, r1, q1] = [-72, -(HALL_M.mastH + 4), 76, 42];
  assert.ok(x0 >= r0 && x1 <= r1 && y0 >= q0 && y1 <= q1, `Umriss ${[x0, y0, x1, y1].map((n) => n.toFixed(1))} außerhalb des gemalten Bilds`);
  assert.ok(Math.abs(g.boundingBox.max.z - HALL_M.mastH) <= 2, `Mast: ${g.boundingBox.max.z}`);
  assert.ok(x1 - x0 >= 100 && Math.abs(x0 + x1) <= 4);
});

test('Großbauten 3D: Regierungsviertel je Teamdrehung und Gruppenmaske, innerhalb des inneren Quadrats und so hoch wie die gemalten Gruppen', () => {
  const { GROUPS } = _quarter;
  assert.equal(quarterGeometry(0, 0), null);
  const full = [0, 1, 2, 3, 5, 6, 7, 8].reduce((m, gi) => m | (1 << gi), 0);
  for (let t = 0; t < 4; t++) {
    const g = quarterGeometry(t, full);
    check(`viertel${t}`, g);
    assert.equal(quarterGeometry(t, full), g);
    assert.ok(g.getAttribute('position').count / 3 <= 7000, `Viertel ${t}: ${g.getAttribute('position').count / 3} Dreiecke`);
    assert.ok(teamVerts(g) > 0);
    const bb = g.boundingBox;
    for (const v of [bb.min.x, bb.min.y, bb.max.x, bb.max.y]) assert.ok(Math.abs(v) <= INNER, `Viertel ${t}: ${v} außerhalb ±${INNER}`);
    assert.ok(bb.max.z <= QUARTER_PAL.TALL && bb.max.z >= 38, `Viertel ${t}: Höhe ${bb.max.z}`);
    // jede Gruppe allein: nur ihre Teile, weniger Dreiecke als das ganze Viertel; Summe der Gruppen = Ganzes
    let sum = 0;
    for (const gi of [0, 1, 2, 3, 5, 6, 7, 8]) {
      const q = quarterGeometry(t, 1 << gi);
      if (!GROUPS[t][gi].length) { assert.equal(q.getAttribute('position').count, 0); continue; }
      const n = q.getAttribute('position').count / 3;
      assert.ok(n > 0 && n < g.getAttribute('position').count / 3);
      sum += n;
    }
    assert.equal(sum, g.getAttribute('position').count / 3);
  }
});
