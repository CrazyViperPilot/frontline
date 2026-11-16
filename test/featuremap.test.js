// Die Feature-Landkarte und die Dateiliste in ARCHITEKTUR.md müssen alle Dateien unter js/ nennen (Dateiname, mindestens einmal).
// Ausgenommen ist nur der Karteneditor (js/editor/, eigener Abschnitt in ARCHITEKTUR.md §9). Fehlt eine Datei, steht sie in der Meldung;
// dann in ARCHITEKTUR.md §7 (Dateien) oder §9 (Feature-Landkarte) nachtragen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, basename } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXEMPT = ['js/editor/'];

/** Alle .js-Dateien unter js/ (relativ zur Wurzel, Pfade mit /). */
function jsFiles(dir = join(ROOT, 'js'), out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) jsFiles(path, out);
    else if (name.endsWith('.js')) out.push(relative(ROOT, path).split('\\').join('/'));
  }
  return out.sort();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('ARCHITEKTUR.md nennt jede Datei unter js/ (Feature-Landkarte und Dateiliste)', () => {
  const doc = readFileSync(join(ROOT, 'ARCHITEKTUR.md'), 'utf8');
  const missing = jsFiles()
    .filter((f) => !EXEMPT.some((p) => f.startsWith(p)))
    .filter((f) => !new RegExp(`(?<![\\w-])${escapeRe(basename(f))}(?![\\w-])`).test(doc));
  assert.deepEqual(
    missing,
    [],
    `Dateien unter js/ fehlen in ARCHITEKTUR.md (§7 Dateien oder §9 Feature-Landkarte nachtragen):\n${missing.join('\n')}`,
  );
});
