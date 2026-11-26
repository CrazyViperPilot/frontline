// Körper-Wandler (js/render3d/solids3d.js): Körperlisten der Einheiten, Felsen und Tiere werden zu gültiger three-Geometrie.
// Läuft in Node ohne DOM (three-Kern genügt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { unitModelTypes, unitModel } from '../js/render/unitpaint.js';
import { PAINT } from '../js/render/unitpaint.js';
import { natureModels } from '../js/render/nature.js';
import { solidsToGeometry, boundsOf3, modelGeometry, clearModelCache, buildModelMesh } from '../js/render3d/solids3d.js';
import { ISO_K } from '../js/render/camera.js';

const EPS = 1e-6;

/** Prüft eine Körperliste; liefert die Zahl der Dreiecke. */
function check(name, solids) {
  const g = solidsToGeometry(solids);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('color');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of [pos, nor, col]) for (const v of a.array) assert.ok(Number.isFinite(v), `${name}: NaN`);
  for (let i = 0; i < nor.count; i++) {
    const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    assert.ok(Math.abs(l - 1) < 1e-3, `${name}: Normale Länge ${l}`);
  }
  const b = boundsOf3(solids);
  const bb = g.boundingBox;
  // Float32 rundet; Welt-Pixel bis in die Hunderte, daher Toleranz 1e-4 relativ zu Float32
  const f = Math.fround;
  assert.ok(Math.abs(bb.min.x - f(b.x0)) < EPS && Math.abs(bb.max.x - f(b.x1)) < EPS, `${name}: Umriss x`);
  assert.ok(Math.abs(bb.min.y - f(b.y0)) < EPS && Math.abs(bb.max.y - f(b.y1)) < EPS, `${name}: Umriss y`);
  assert.ok(Math.abs(bb.min.z - f(b.z0)) < EPS && Math.abs(bb.max.z - f(b.z1)) < EPS, `${name}: Umriss z`);
  return pos.count / 3;
}

test('Einheiten: Geometrie gültig, Umriss stimmt', () => {
  const types = unitModelTypes();
  assert.ok(types.length > 30);
  const tri = {};
  for (const t of types) {
    const m = unitModel(t, 0, { frame: 0 });
    assert.ok(m, `Modell ${t}`);
    const solids = m.turret ? [...m.S, ...m.turret.S] : m.S;
    tri[t] = check(t, solids);
  }
  assert.ok(tri.tank > 12 && tri.rifleman > 12);
  if (process.env.SOLIDS3D_LOG) console.log('Dreiecke tank', tri.tank, 'rifleman', tri.rifleman);
});

test('Umriss: boundsOf (painter.js) misst die Iso-Projektion, nicht die Modellachsen', () => {
  // boundsOf liefert Bildgrenzen [x0, y0, x1, y1] mit 1 Einheit Rand; für yaw 0, Iso: X = (x - y) · K, Y = (x + y) · K/2 - z
  const m = unitModel('tank', 0, {});
  const solids = [...m.S, ...(m.turret?.S ?? [])].filter((so) => so.only !== 'top');
  const b3 = boundsOf3(solids);
  const bi = PAINT.boundsOf({}, solids, 0, true);
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const so of solids) for (const f of so.faces) for (const p of f) {
    x0 = Math.min(x0, (p[0] - p[1]) * ISO_K);
    x1 = Math.max(x1, (p[0] - p[1]) * ISO_K);
  }
  assert.ok(Math.abs(bi[0] - (x0 - 1)) < EPS && Math.abs(bi[2] - (x1 + 1)) < EPS);
  assert.ok(b3.x1 > b3.x0 && b3.z1 > b3.z0);
});

test('Felsen und Tiere: Körperlisten gültig', () => {
  const all = natureModels();
  const kinds = new Set(all.map((e) => e.name.replace(/[0-9a-z]*$/, (s) => '').replace(/\d.*/, '')));
  const rocks = all.filter((e) => e.name.startsWith('rock'));
  const deer = all.filter((e) => e.name.startsWith('deer'));
  const boar = all.filter((e) => e.name.startsWith('boar'));
  assert.ok(rocks.length && deer.length && boar.length, [...kinds].join());
  for (const e of [rocks[0], rocks[rocks.length - 1], deer[0], deer[deer.length - 1], boar[0], boar[boar.length - 1]]) check(e.name, e.m.S);
});

test('Wrack: verbrannt gibt gleiche Form, dunklere Farbe', () => {
  const m = unitModel('tank', 0, {});
  const a = solidsToGeometry(m.S);
  const b = solidsToGeometry(m.S, { charred: true });
  assert.equal(a.getAttribute('position').count, b.getAttribute('position').count);
  const sum = (g) => g.getAttribute('color').array.reduce((s, v) => s + v, 0);
  assert.ok(sum(b) < sum(a));
});

test('Mesh: undurchsichtiges Netz, Umriss in userData', () => {
  const m = unitModel('tank', 0, {});
  const g = buildModelMesh(m.S);
  assert.ok(g.children.length >= 1);
  assert.ok(g.userData.bounds.x1 > g.userData.bounds.x0);
});

test('Zwischenspeicher: gleiche Variante nur einmal', () => {
  clearModelCache();
  const m = unitModel('tank', 0, {});
  const a = modelGeometry('tank|0', m.S);
  assert.equal(modelGeometry('tank|0', m.S), a);
  assert.notEqual(modelGeometry('tank|0', m.S, { charred: true }), a);
  clearModelCache();
  assert.notEqual(modelGeometry('tank|0', m.S), a);
});
