// Dateilisten der Doku: Jede Datei unter js/ steht in der CLAUDE.md ihres Ordners oder eines Elternordners unter js/
// (Zeile mit Zweck und Exporten) oder in ARCHITEKTUR.md (§7 nennt die kleinen Ordner direkt). Ausgenommen ist nur der
// Karteneditor (js/editor/, Zeile in ARCHITEKTUR.md §9). Fehlt eine Datei, steht sie in der Meldung; dann in der CLAUDE.md
// ihres Ordners nachtragen. Dazu Größengrenzen, damit die Doku billig zu lesen bleibt: Ordnerdateien höchstens 4 KB und
// 200 Zeichen je Zeile, ARCHITEKTUR.md unter 30 000 Bytes und 250 Zeichen je Zeile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, basename, dirname } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXEMPT = ['js/editor/'];
const FOLDER_MAX_BYTES = 4096;
const FOLDER_MAX_LINE = 200;
const ARCH_MAX_BYTES = 30000;
const ARCH_MAX_LINE = 250;

/** Alle Dateien unter js/ mit der Endung `ext` (relativ zur Wurzel, Pfade mit /). */
function filesUnderJs(ext, dir = join(ROOT, 'js'), out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesUnderJs(ext, path, out);
    else if (name.endsWith(ext)) out.push(relative(ROOT, path).split('\\').join('/'));
  }
  return out.sort();
}

const jsFiles = () => filesUnderJs('.js');
const folderDocs = () => filesUnderJs('CLAUDE.md');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = (text, file) => new RegExp(`(?<![\\w-])${escapeRe(basename(file))}(?![\\w-])`).test(text);

/** CLAUDE.md-Texte des Ordners von `file` und aller Elternordner bis js/. */
function docsAbove(file) {
  const out = [];
  for (let dir = dirname(file); dir === 'js' || dir.startsWith('js/'); dir = dirname(dir)) {
    const doc = `${dir}/CLAUDE.md`;
    if (existsSync(join(ROOT, doc))) out.push(read(doc));
  }
  return out;
}

test('Jede Datei unter js/ steht in der CLAUDE.md ihres Ordners (oder darüber) oder in ARCHITEKTUR.md', () => {
  const arch = read('ARCHITEKTUR.md');
  const missing = jsFiles()
    .filter((f) => !EXEMPT.some((p) => f.startsWith(p)))
    .filter((f) => !names(arch, f) && !docsAbove(f).some((doc) => names(doc, f)));
  assert.deepEqual(missing, [], `Dateien unter js/ ohne Eintrag (in der CLAUDE.md ihres Ordners nachtragen):\n${missing.join('\n')}`);
});

test('Ordnerdateien js/**/CLAUDE.md: höchstens 4 KB, keine Zeile über 200 Zeichen, nur vorhandene Dateien', () => {
  const docs = folderDocs();
  assert.ok(docs.length >= 5, `zu wenige Ordnerdateien gefunden: ${docs.join(', ')}`);
  const known = new Set(jsFiles().map((f) => basename(f)));
  for (const doc of docs) {
    const text = read(doc);
    const bytes = Buffer.byteLength(text, 'utf8');
    assert.ok(bytes <= FOLDER_MAX_BYTES, `${doc}: ${bytes} Bytes (höchstens ${FOLDER_MAX_BYTES})`);
    text.split('\n').forEach((line, i) => {
      assert.ok(line.length <= FOLDER_MAX_LINE, `${doc}:${i + 1}: ${line.length} Zeichen (höchstens ${FOLDER_MAX_LINE})`);
    });
    const stale = [...text.matchAll(/`(?:[\w-]+\/)*([\w-]+\.js)`/g)].map((m) => m[1]).filter((n) => !known.has(n));
    assert.deepEqual(stale, [], `${doc} nennt Dateien, die es unter js/ nicht gibt`);
  }
});

test('ARCHITEKTUR.md bleibt schlank: unter 30 000 Bytes, keine Zeile über 250 Zeichen', () => {
  const text = read('ARCHITEKTUR.md');
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.ok(bytes < ARCH_MAX_BYTES, `ARCHITEKTUR.md: ${bytes} Bytes (unter ${ARCH_MAX_BYTES}); Dateilisten gehören in die CLAUDE.md der Ordner`);
  const long = text.split('\n').map((line, i) => [i + 1, line.length]).filter(([, n]) => n > ARCH_MAX_LINE);
  assert.deepEqual(long, [], 'ARCHITEKTUR.md: Zeilen über 250 Zeichen ([Zeile, Länge]) an Satzgrenzen umbrechen');
});
