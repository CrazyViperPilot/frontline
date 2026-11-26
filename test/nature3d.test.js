// 3D-Natur (js/render3d/nature3d.js): Büsche jeder Art, Form und Jahreszeit sind gültige Geometrie (keine NaN, Normalen der Länge 1),
// so groß wie der gemalte Busch (nature.js BUSH_ISO) und sparsam (Ecken je Form); Felsen und Tiere über den Körper-Wandler ebenso.
// Läuft in Node ohne DOM (three-Kern genügt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bushGeometry, BUSH_KINDS3D, BUSH_SHAPES, PALETTES } from '../js/render3d/nature3d.js';
import { modelGeometry } from '../js/render3d/solids3d.js';
import { bushLook3d, rockLook3d, animalLook3d, natureModels } from '../js/render/nature.js';

// Höhe je Art (Welt-px bei Größe 1): gemalt reicht das Bild (BUSH_ISO) höchstens 26 px über den Fuß, ±21 px zur Seite
const HEIGHT = { shrub: [9, 16], berry: [9, 16], fern: [4, 10], sapling: [18, 27] };
const MAX_VERTS = 2400; // Ecken je Form (nicht indiziert, 3 je Dreieck): ~300 Büsche im Bild (Seed 7, Wald) bleiben unter 250 000

function valid(name, g) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of [pos, nor, g.getAttribute('color')]) for (const v of a.array) assert.ok(Number.isFinite(v), `${name}: NaN`);
  for (let i = 0; i < nor.count; i++) {
    const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    assert.ok(Math.abs(l - 1) < 1e-3, `${name}: Normale Länge ${l}`);
  }
  g.computeBoundingBox();
  return g.boundingBox;
}

test('3D-Büsche: jede Art, Form und Jahreszeit ist gültige, sparsame Geometrie in Buschgröße', () => {
  for (const kind of BUSH_KINDS3D) {
    for (let shape = 0; shape < BUSH_SHAPES; shape++) {
      for (const bare of [false, true]) {
        const name = `${kind}/${shape}${bare ? '/winter' : ''}`;
        const g = bushGeometry(kind, shape, bare);
        const bb = valid(name, g);
        for (const v of g.getAttribute('aTone').array) assert.ok(v === -1 || v === -2 || (v >= 0 && v <= 1), `${name}: aTone ${v}`);
        const [lo, hi] = HEIGHT[kind];
        assert.ok(bb.max.z >= lo && bb.max.z <= hi, `${name}: Höhe ${bb.max.z.toFixed(1)} nicht in ${lo} … ${hi}`);
        assert.ok(bb.min.z >= -4, `${name}: zu tief im Boden`);
        assert.ok(Math.max(bb.max.x, -bb.min.x, bb.max.y, -bb.min.y) < 15, `${name}: zu breit`);
        assert.ok(g.getAttribute('position').count <= MAX_VERTS, `${name}: ${g.getAttribute('position').count} Ecken`);
        assert.equal(bushGeometry(kind, shape, bare), g, `${name}: nicht zwischengespeichert`);
      }
    }
  }
});

test('3D-Büsche: jede gemalte Buschart und Palette hat Form und Zeile in der Palettentextur', () => {
  const seen = new Set();
  for (const season of ['summer', 'autumn', 'winter']) {
    for (let i = 0; i < 400; i++) {
      const b = { x: (i * 7919) % 6007, y: (i * 104729) % 5003, r: 6 + (i % 7), k: i % 5 === 0 ? 'sapling' : i % 7 === 0 ? 'fern' : undefined, under: i % 5 === 0 };
      const L = bushLook3d(b, season);
      seen.add(L.kind);
      assert.ok(BUSH_KINDS3D.includes(L.kind), `Art ${L.kind}`);
      assert.ok(L.size > 0.5 && L.size < 1.4, `Größe ${L.size}`);
      assert.ok(PALETTES.includes(L.P), `${season}: Palette von ${L.kind} fehlt`);
    }
  }
  assert.deepEqual([...seen].sort(), [...BUSH_KINDS3D].sort());
});

test('3D-Felsen und Tiere: Körper-Wandler liefert gültige Geometrie im Umriss des Modells', () => {
  for (const { name, m } of natureModels()) {
    const g = modelGeometry(`test|${name}`, m.S);
    const bb = valid(name, g);
    assert.ok(bb.min.z >= -0.5, `${name}: unter dem Boden (${bb.min.z})`);
    assert.ok(bb.max.z > 5 && bb.max.z < 25, `${name}: Höhe ${bb.max.z}`);
    assert.ok(Math.max(bb.max.x, -bb.min.x, bb.max.y, -bb.min.y) < 30, `${name}: zu breit`);
    assert.ok(g.getAttribute('position').count <= 1500, `${name}: ${g.getAttribute('position').count} Ecken`);
  }
  for (const season of ['summer', 'winter']) {
    const L = rockLook3d({ x: 512, y: 768, r: 14 }, season);
    assert.ok(L.v >= 0 && L.v < 4 && Number.isFinite(L.yaw) && L.S.length > 0, 'Fels');
  }
  const A = animalLook3d({ kind: 'deer', id: 3, speed: 70, step: 20, angle: 1 }, 0);
  assert.match(A.key, /^deer\|[1-4]r/, 'Hirsch im Galopp mit Gehbild');
  assert.ok(A.S.length > 0 && A.scale > 0, 'Tier');
});
