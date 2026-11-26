// 3D-Bäume (js/render3d/trees3d.js): Geometrie jeder Art und Form ist gültig (keine NaN, Normalen der Länge 1), so groß wie der
// gemalte Baum (nature.js ISO_BOUNDS) und sparsam (Dreiecke je Form). Läuft in Node ohne DOM (three-Kern genügt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { treeGeometry, TREE_SPECIES, TREE_SHAPES } from '../js/render3d/trees3d.js';
import { TREE_COLORS, treeLook3d } from '../js/render/nature.js';

// Höhe der Spitze je Art (Welt-px bei Größe 1): gemalt reicht das Bild bis 64 … 76 px über den Stammfuß
const HEIGHT = { broad: [38, 66], birch: [40, 70], spruce: [55, 80], pine: [45, 75] };
const MAX_TRIS = { fein: 500, grob: 200 }; // ~1500 Bäume im Bild (Seed 7, Zoom 0,35) bleiben so unter 300 000 Dreiecken

test('3D-Bäume: jede Art, Form, Stufe und Jahreszeit ist gültige, sparsame Geometrie in Baumgröße', () => {
  for (const sp of TREE_SPECIES) {
    for (let shape = 0; shape < TREE_SHAPES; shape++) {
      for (const lod of [false, true]) {
        for (const bare of sp === 'broad' || sp === 'birch' ? [false, true] : [false]) {
          const name = `${sp}/${shape}/${lod ? 'grob' : 'fein'}${bare ? '/kahl' : ''}`;
          const g = treeGeometry(sp, shape, bare, lod);
          const pos = g.getAttribute('position');
          const nor = g.getAttribute('normal');
          const tone = g.getAttribute('aTone');
          assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
          for (const a of [pos, nor, g.getAttribute('color'), tone]) for (const v of a.array) assert.ok(Number.isFinite(v), `${name}: NaN`);
          for (let i = 0; i < nor.count; i++) {
            const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
            assert.ok(Math.abs(l - 1) < 1e-3, `${name}: Normale Länge ${l}`);
          }
          for (const v of tone.array) assert.ok(v === -1 || (v >= 0 && v <= 1), `${name}: aTone ${v}`);
          const bb = g.boundingBox;
          const [lo, hi] = HEIGHT[sp];
          if (!bare) assert.ok(bb.max.z >= lo && bb.max.z <= hi, `${name}: Höhe ${bb.max.z.toFixed(1)} nicht in ${lo} … ${hi}`);
          assert.ok(bb.min.z >= -3, `${name}: zu tief im Boden`);
          assert.ok(Math.max(bb.max.x, -bb.min.x, bb.max.y, -bb.min.y) < 30, `${name}: zu breit`);
          const tris = pos.count / 3;
          assert.ok(tris <= MAX_TRIS[lod ? 'grob' : 'fein'], `${name}: ${tris} Dreiecke`);
          assert.equal(treeGeometry(sp, shape, bare, lod), g, `${name}: nicht zwischengespeichert`);
        }
      }
    }
  }
});

test('3D-Bäume: jede Laubpalette der gemalten Bäume hat eine Zeile in der Palettentextur', () => {
  for (const season of ['summer', 'autumn', 'winter']) {
    for (let i = 0; i < 400; i++) {
      const t = { x: 100 + i * 37, y: 200 + i * 53, r: 12 + (i % 9), sp: TREE_SPECIES[i % 4] };
      const L = treeLook3d(t, season);
      assert.ok(TREE_SPECIES.includes(L.sp), 'Art');
      assert.ok(L.size > 0.5 && L.size < 1.6, `Größe ${L.size}`);
      assert.ok(TREE_COLORS.palettes.includes(L.P), `${season}: Palette von ${L.sp} fehlt`);
    }
  }
});
