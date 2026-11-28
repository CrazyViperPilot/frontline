// Tag und Nacht 3D (render3d/lights3d.js): Lichtquellen aus der Objektliste, Werte je Lichtstimmung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightSources, glowOf, nightOf, elevOf, Lights3D } from '../js/render3d/lights3d.js';
import { BALANCE } from '../js/data/balance.js';

test('Lichtquellen: Laternen (nicht zerstört) und Häuser mit Fenstern, sonst nichts', () => {
  const items = [
    { t: 16, o: { kind: 'street_lamp', x: 100, y: 100, a: 0 } },
    { t: 16, o: { kind: 'street_lamp', x: 200, y: 100, a: 0, rubble: true } },
    { t: 16, o: { kind: 'fence', x: 300, y: 100 } },
    { t: 0, o: { kind: 'town', ck: 'home', x: 400, y: 400, w: 56, h: 56 } },
    { t: 0, o: { kind: 'house', x: 500, y: 500, w: 80, h: 60 } },
    { t: 0, o: { kind: 'hall', x: 600, y: 600, w: 200, h: 100 } },
    { t: 5, o: { x: 1, y: 1 } },
  ];
  const l = lightSources(items, 0, 0);
  assert.equal(l.length, 3);
  assert.ok(l[0].head && Math.abs(l[0].x - 107.25) < 1e-9, 'Lichtfleck unter dem Leuchtkopf');
  assert.ok(l[2].r > BALANCE.lights3d.house.r, 'Schein reicht über die Grundfläche');
  assert.equal(lightSources(items, 0, 0, (o) => o.kind !== 'house').length, 2, 'Haus ohne 3D-Körper: kein Schein');
});

test('Lichtquellen: höchstens max, die der Mitte nächsten', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ t: 0, o: { kind: 'town', x: i * 100, y: 0, w: 56, h: 56 } }));
  const l = lightSources(items, 4900, 0, () => true, 10);
  assert.equal(l.length, 10);
  assert.ok(l.every((p) => p.x >= 4000));
});

test('Werte je Stimmung: Lichter nur abends und nachts, Sonne morgens und abends flacher', () => {
  assert.equal(glowOf('day'), 0);
  assert.equal(glowOf(null), 0);
  assert.ok(glowOf('night') > glowOf('evening') && glowOf('evening') > 0);
  assert.equal(nightOf('night'), 1);
  assert.ok(nightOf('evening') >= 0.4, 'abends brennen Laternen (GLOW_NIGHT braucht uNight ≥ 0,4)');
  assert.equal(elevOf(null), null);
  assert.ok(elevOf('morning') < elevOf('day') && elevOf('evening') < elevOf('day'));
});

test('Lights3D: Scheiben je Quelle (Laterne mit Leuchtkopf), ohne NaN', async () => {
  const THREE = await import('../js/vendor/three/three.module.min.js');
  const fog = { uniforms: {}, material: { vertexShader: 'void main(){}', fragmentShader: 'void main(){}' }, mesh: { geometry: new THREE.BufferGeometry() } };
  const L = new Lights3D(fog);
  const n = L.update(lightSources([{ t: 16, o: { kind: 'street_lamp', x: 10, y: 10, a: 1 } }, { t: 0, o: { kind: 'town', x: 50, y: 50 } }], 0, 0), 1, () => 7, false);
  assert.equal(n, 3);
  assert.ok([...L.aLight.array.subarray(0, 12), ...L.aCol.array.subarray(0, 12)].every(Number.isFinite));
  assert.equal(L.mask.visible, false);
  L.dispose();
});
