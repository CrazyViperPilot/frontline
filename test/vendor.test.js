// Fremde Bibliothek three.js als feste Kopie (Plan docs/plan-3d.md, Paket „three.js einbinden“): die verkleinerten Dateien unter
// js/vendor/three/ liegen vor und laden, die Version passt zum Werkzeug tools/vendor-three.mjs, und beide stehen offline in sw.js ASSETS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = 'js/vendor/three/';
const FILES = ['three.core.min.js', 'three.module.min.js'];

test('js/vendor/three: beide .min.js-Dateien und LICENSE liegen vor', () => {
  for (const f of [...FILES, 'LICENSE']) assert.ok(existsSync(join(ROOT, DIR, f)), `${DIR}${f} fehlt`);
});

test('three.js lädt: REVISION 187, Renderer, Geometrie, Kamera und InstancedMesh sind Funktionen', async () => {
  const m = await import('../js/vendor/three/three.module.min.js');
  assert.equal(m.REVISION, '187');
  for (const name of ['WebGLRenderer', 'BufferGeometry', 'OrthographicCamera', 'InstancedMesh']) {
    assert.equal(typeof m[name], 'function', `${name} fehlt`);
  }
});

test('Version in tools/vendor-three.mjs (THREE_VERSION) passt zu REVISION', async () => {
  const src = readFileSync(join(ROOT, 'tools/vendor-three.mjs'), 'utf8');
  const version = src.match(/const THREE_VERSION = '([\d.]+)'/)[1]; // z. B. 0.187.0
  const m = await import('../js/vendor/three/three.module.min.js');
  assert.equal(version.split('.')[1], m.REVISION, `THREE_VERSION ${version} passt nicht zu REVISION ${m.REVISION}`);
});

test('sw.js: beide Dateien stehen in ASSETS (offline verfügbar)', () => {
  const block = readFileSync(join(ROOT, 'sw.js'), 'utf8').match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  for (const f of FILES) assert.ok(block.includes(`'./${DIR}${f}'`), `sw.js ASSETS: './${DIR}${f}' fehlt`);
});
