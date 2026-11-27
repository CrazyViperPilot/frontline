// Wetter 3D (js/render3d/weather3d.js): Anteile aus dem Übergang, Bildachsen und Kachel decken den sichtbaren Ausschnitt, feste Zufallswerte
// ohne NaN in [0, 1), Teilchenzahl innerhalb der Puffer und nach Stärke, Netze unsichtbar ohne Wetter, Höhentextur im Bereich, nasser Boden
// erweitert den Boden-Shader. Läuft in Node ohne DOM und ohne WebGL. Fotos, Tiefe und Bildrate: node tools/smoke-3d.mjs --only wetter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { Weather3D, weatherShares, viewFrame, heightRange, tileFor, particleCount, seedData, wetGround, MAX_RAIN, MAX_SNOW, MAX_SPLASH } from '../js/render3d/weather3d.js';
import { FS_GROUND } from '../js/render/ground.js';
import { RELIEF, FINE_N } from '../js/game/relief.js';

const CAM = { x: 5000, y: 5000, zoom: 1, rot: 0, viewW: 1280, viewH: 800 };
const noise = new THREE.DataTexture(new Uint8Array(4), 1, 1);
const fakeRelief = (h = (x, y) => 40 + 0.02 * x + 0.01 * y) => {
  const fine = new Float32Array(FINE_N * FINE_N);
  for (let j = 0; j < FINE_N; j++) for (let i = 0; i < FINE_N; i++) fine[j * FINE_N + i] = h(i * RELIEF.step, j * RELIEF.step);
  return { fine, version: 1, displayAt: (x, y) => Math.max(RELIEF.water, h(x, y)) };
};
const wx = (kind, mix = 1, prev = 'clear') => ({ on: true, kind, prev, mix });

test('Anteile: Übergang blendet das alte aus und das neue ein, ohne Wetter nichts, Nässe bei Regen', () => {
  assert.deepEqual(weatherShares(null), { rain: 0, snow: 0, fog: 0, wet: 0 });
  assert.deepEqual(weatherShares({ on: false, kind: 'rain', prev: 'rain', mix: 1 }), { rain: 0, snow: 0, fog: 0, wet: 0 });
  const half = weatherShares(wx('rain', 0.4, 'snow'));
  assert.ok(Math.abs(half.rain - 0.4) < 1e-9 && Math.abs(half.snow - 0.6) < 1e-9);
  assert.equal(weatherShares(wx('rain')).wet, 1);
  assert.ok(weatherShares(wx('fog')).wet > 0 && weatherShares(wx('fog')).wet < 0.5);
  assert.equal(weatherShares(wx('snow')).wet, 0);
  assert.equal(weatherShares(wx('clear')).wet, 0);
});

test('Bildachsen: orthonormal in allen Drehungen, Mitte und Halbmaße stimmen', () => {
  for (let rot = 0; rot < 4; rot++) {
    const f = viewFrame({ ...CAM, rot, zoom: 2 });
    assert.ok(Math.abs(Math.hypot(...f.R) - 1) < 1e-9 && Math.abs(Math.hypot(...f.T) - 1) < 1e-9);
    assert.ok(Math.abs(f.R[0] * f.T[0] + f.R[1] * f.T[1]) < 1e-9, 'a senkrecht auf b');
    assert.equal(f.hw, 320);
    assert.equal(f.hh, 200);
    assert.ok(Math.abs(f.ca - (CAM.x * f.R[0] + CAM.y * f.R[1])) < 1e-9);
  }
});

test('Kachel deckt jeden sichtbaren Punkt zwischen den Höhen: Bildecken über Teilchen in Höhe z', () => {
  for (let rot = 0; rot < 4; rot++) {
    for (const zoom of [0.35, 1, 1.6]) {
      const cam = { ...CAM, rot, zoom };
      const f = viewFrame(cam);
      const [zLo, zHi] = [0, 300];
      const [a0, b0, La, Lb] = tileFor(f, zLo, zHi);
      assert.ok(La > 0 && Lb > 0);
      for (const z of [zLo, 150, zHi]) {
        // Bildpunkt (rechts sx, unten sy aus der Mitte) für einen Punkt der Höhe z: a = sx / zoom, b = 2 (sy / zoom + z)
        for (const [sx, sy] of [[-640, -400], [640, -400], [-640, 400], [640, 400], [0, 0]]) {
          const a = f.ca + sx / zoom;
          const b = f.cb + 2 * (sy / zoom + z);
          assert.ok(a >= a0 && a <= a0 + La, `a rot${rot} zoom${zoom} z${z}`);
          assert.ok(b >= b0 && b <= b0 + Lb, `b rot${rot} zoom${zoom} z${z}`);
        }
      }
    }
  }
});

test('Höhenbereich: endlich, geordnet, Gelände ohne Stichprobe ergibt 0', () => {
  const f = viewFrame(CAM);
  const r = heightRange(f, (x, y) => 40 + 0.02 * x + 0.01 * y);
  assert.ok(Number.isFinite(r.lo) && Number.isFinite(r.hi) && r.lo <= r.hi && r.lo > 0);
  assert.deepEqual(heightRange(f, () => NaN), { lo: 0, hi: 0 });
});

test('Zufallswerte: fest je Aufruf, in [0, 1), keine NaN', () => {
  const a = seedData(MAX_RAIN);
  const b = seedData(MAX_RAIN);
  assert.equal(a.length, MAX_RAIN * 4);
  assert.deepEqual(a, b);
  for (const v of a) assert.ok(v >= 0 && v < 1, `Wert ${v}`);
  assert.notDeepEqual(seedData(16, 1), seedData(16, 2));
});

test('Teilchenzahl: wächst mit der Stärke, 0 ohne, nie über dem Puffer', () => {
  const tile = [0, 0, 1500, 2400];
  assert.equal(particleCount(0, 1280, 800, 1300, tile, 400, MAX_RAIN), 0);
  const half = particleCount(0.5, 1280, 800, 1300, tile, 400, MAX_RAIN);
  const full = particleCount(1, 1280, 800, 1300, tile, 400, MAX_RAIN);
  assert.ok(half > 0 && full > half && full <= MAX_RAIN);
  assert.equal(particleCount(1, 20000, 20000, 1300, tile, 400, MAX_RAIN), MAX_RAIN);
  assert.ok(MAX_SNOW > 0 && MAX_SPLASH > 0);
});

test('Weather3D: Netze, Zähler und Uniformen je Wetter und Übergang, nirgends NaN', () => {
  const w = new Weather3D(noise);
  const relief = fakeRelief();
  for (const rot of [0, 1, 2, 3]) {
    for (const zoom of [0.35, 1, 1.6]) {
      const cam = { ...CAM, rot, zoom };
      for (const weather of [wx('rain'), wx('snow'), wx('fog'), wx('clear'), wx('rain', 0.3, 'fog'), { on: false }, null]) {
        const sh = w.update(cam, relief, weather, 123.4, 2);
        const on = sh.rain + sh.snow + sh.fog > 0.01;
        assert.equal(w.rain.visible, sh.rain > 0.01);
        assert.equal(w.splash.visible, sh.rain > 0.01);
        assert.equal(w.snow.visible, sh.snow > 0.01);
        assert.equal(w.fog.visible, sh.fog > 0.01);
        if (!on) continue;
        assert.ok(w.stats.rain <= MAX_RAIN && w.stats.snow <= MAX_SNOW && w.stats.splash <= MAX_SPLASH);
        assert.equal(w.rain.geometry.instanceCount, w.stats.rain);
        if (sh.rain > 0.01) assert.ok(w.stats.rain > 0 && w.stats.splash > 0);
        if (sh.snow > 0.01) assert.ok(w.stats.snow > 0);
        if (sh.fog > 0.01) assert.equal(w.stats.fog, 4);
        for (const U of [w.rainU, w.snowU, w.splashU, w.fogU]) {
          for (const [k, u] of Object.entries(U)) {
            const v = u.value;
            if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k}=${v}`);
            else if (v?.toArray) for (const c of v.toArray()) assert.ok(Number.isFinite(c), `${k}`);
          }
        }
      }
    }
  }
});

test('Höhentextur: Bytes zwischen 0 und 255, Seen als Wasserspiegel, Gelände ändert sie neu', () => {
  const w = new Weather3D(noise);
  const relief = fakeRelief((x) => (x < 3000 ? -50 : 200));
  w.update(CAM, relief, wx('fog'), 0, 1);
  const data = w.hm.image.data;
  assert.equal(data.length, FINE_N * FINE_N);
  assert.equal(data[0], 0, 'See = Wasserspiegel = tiefster Punkt');
  assert.equal(data[FINE_N - 1], 255, 'höchster Punkt');
  const v = w.u.uHmap.value;
  assert.ok(Math.abs(v.x - RELIEF.water) < 1e-6 && Math.abs(v.x + v.y - 200) < 1e-6);
  const ver = w.hm.version;
  w.update(CAM, relief, wx('fog'), 1, 1);
  assert.equal(w.hm.version, ver, 'gleiches Gelände: nicht neu laden');
  relief.version++;
  w.update(CAM, relief, wx('fog'), 2, 1);
  assert.ok(w.hm.version > ver, 'neue Version: neu laden');
});

test('Nasser Boden: erweitert FS_GROUND um Uniformen und Glanz, nur einmal, Rest unverändert', () => {
  const wet = wetGround(FS_GROUND);
  assert.ok(wet.includes('uniform float uWet;') && wet.includes('pud'));
  assert.equal(wet.split('uniform float uWet;').length, 2);
  assert.ok(wet.trimEnd().endsWith('}'));
  assert.ok(wet.startsWith(FS_GROUND.slice(0, 200)));
  assert.ok(wet.length > FS_GROUND.length);
  assert.ok(!wet.includes('undefined') && !wet.includes('NaN'));
});
