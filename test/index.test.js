// Symbol-Index (docs/index/, erzeugt mit `npm run index`, tools/index.mjs) muss zu den Exporten unter js/ passen.
// Der Test baut den Index im Speicher und vergleicht ihn Datei für Datei; dazu Größengrenzen (12 KB, 160 Zeichen je Zeile).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { buildIndex, INDEX_DIR } from '../tools/index.mjs';

const ROOT = new URL('../', import.meta.url);
const STALE = 'Symbol-Index veraltet: `npm run index` ausführen';

test('Symbol-Index docs/index/ ist aktuell (sonst: npm run index)', () => {
  const { files } = buildIndex();
  const onDisk = readdirSync(new URL(INDEX_DIR + '/', ROOT)).filter((n) => n.endsWith('.md') && n !== 'README.md').sort();
  assert.deepEqual(onDisk, Object.keys(files).map((p) => p.slice(INDEX_DIR.length + 1)).sort(), STALE);
  for (const [path, text] of Object.entries(files)) {
    assert.ok(readFileSync(new URL(path, ROOT), 'utf8') === text, `${path}: ${STALE}`);
  }
});

test('Symbol-Index: je Datei höchstens 12 KB, keine Zeile über 160 Zeichen, README vorhanden', () => {
  const { files } = buildIndex();
  for (const [path, text] of Object.entries(files)) {
    assert.ok(Buffer.byteLength(text, 'utf8') <= 12 * 1024, `${path}: ${Buffer.byteLength(text, 'utf8')} Bytes`);
    text.split('\n').forEach((l, i) => assert.ok([...l].length <= 160, `${path}:${i + 1}: ${[...l].length} Zeichen`));
  }
  assert.ok(existsSync(new URL(INDEX_DIR + '/README.md', ROOT)), `${INDEX_DIR}/README.md fehlt`);
});
