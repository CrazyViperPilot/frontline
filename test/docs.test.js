// Doku-Abgleich: ARCHITEKTUR §6 nennt jeden Befehl aus dem Befehlsregister (game.issue), der Änderungsverlauf ist absteigend sortiert,
// und es gibt nur eine Fassung der Dokumente (PLAN.md liegt historisch in docs/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { COMMANDS } from '../js/game/commands.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('jeder Befehl des Befehlsregisters (js/game/commands.js) steht in ARCHITEKTUR §6 (Befehle)', () => {
  const cmds = Object.keys(COMMANDS);
  assert.ok(cmds.length > 30, 'zu wenige Befehle gefunden: Muster prüfen');
  const arch = read('../ARCHITEKTUR.md');
  const from = arch.indexOf('## 6. Befehle');
  const to = arch.indexOf('## 7. Dateien');
  assert.ok(from >= 0 && to > from, 'Abschnitt 6 in ARCHITEKTUR.md nicht gefunden');
  const section = arch.slice(from, to);
  const missing = cmds.filter((c) => !section.includes('`' + c + '`'));
  assert.deepEqual(missing, [], 'Befehle fehlen in ARCHITEKTUR §6: ' + missing.join(', '));
});

test('Änderungsverlauf (docs/changelog.md, seit v5.79): Versionen absteigend und ohne Dubletten', () => {
  const log = read('../docs/changelog.md');
  const keys = [...log.matchAll(/^- v(\d+)(?:\.(\d+))?/gm)].map((m) => [+m[1], m[2] === undefined ? 0 : +m[2]]);
  assert.ok(keys.length > 100, 'zu wenige Einträge gefunden');
  for (let i = 1; i < keys.length; i++) {
    const [a, b] = [keys[i - 1], keys[i]];
    const descending = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
    assert.ok(descending, `Reihenfolge vertauscht: v${a.join('.')} vor v${b.join('.')}`);
  }
});

test('Dokumente liegen einmal vor: alte Pläne und verlauf.md nur unter docs/archiv/', () => {
  assert.equal(existsSync(new URL('../PLAN.md', import.meta.url)), false, 'PLAN.md gehört nach docs/archiv/');
  assert.equal(existsSync(new URL('../verlauf.md', import.meta.url)), false, 'verlauf.md gibt es nur unter docs/archiv/');
  assert.equal(existsSync(new URL('../docs/verlauf.md', import.meta.url)), false, 'verlauf.md gibt es nur unter docs/archiv/');
  assert.ok(existsSync(new URL('../docs/archiv/verlauf.md', import.meta.url)), 'docs/archiv/verlauf.md fehlt');
  assert.ok(existsSync(new URL('../docs/archiv/README.md', import.meta.url)), 'docs/archiv/README.md fehlt');
});

// Paket „Archiv“: Erledigte Pläne liegen unter docs/archiv/ (ein noch offener Plan darf in docs/ bleiben, steht dann hier),
// und .ignore nimmt Archiv und Changelog aus der Suche (ripgrep), damit sie Suchen nicht aufblähen.
const OPEN_PLANS = ['plan-stadt-kern.md'];

test('Archiv: unter docs/ liegt keine erledigte plan-*.md auf oberster Ebene', () => {
  const plans = readdirSync(rel('docs/')).filter((f) => /^plan-.*\.md$/.test(f) && !OPEN_PLANS.includes(f));
  assert.deepEqual(plans, [], 'erledigte Pläne nach docs/archiv/');
});

test('Archiv: .ignore nimmt docs/archiv/ und docs/changelog.md von der Suche aus', () => {
  const lines = read('../.ignore').split('\n').map((l) => l.trim());
  assert.ok(lines.includes('docs/archiv/'), '.ignore nennt docs/archiv/ nicht');
  assert.ok(lines.includes('docs/changelog.md'), '.ignore nennt docs/changelog.md nicht');
});

test('PRD aufgeteilt (seit v5.79): der Einstieg PRD.md verlinkt jede Themen-Datei unter docs/prd/, und jede verlinkte Datei gibt es', () => {
  const prd = read('../PRD.md');
  const linked = [...prd.matchAll(/\]\(docs\/prd\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
  const files = readdirSync(new URL('../docs/prd/', import.meta.url)).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 10, 'zu wenige Themen-Dateien');
  assert.deepEqual(files.filter((f) => !linked.includes(f)), [], 'Themen-Datei ohne Eintrag in der Übersicht von PRD.md');
  assert.deepEqual(linked.filter((f) => !files.includes(f)), [], 'PRD.md verlinkt eine fehlende Datei');
  assert.ok(prd.length < 20000, `PRD.md soll Einstieg bleiben (${prd.length} Zeichen): Regeln gehören in docs/prd/`);
});

// Schlanker Einstieg: Die CLAUDE.md im Wurzelordner wird in jeder Sitzung ganz geladen. Sie hält nur Regeln, Befehle und den
// Wegweiser; Rezepte, Wertetabelle, Test- und Betriebswissen liegen in eigenen Dateien unter docs/.
const ROOT_URL = new URL('../', import.meta.url);
const rel = (p) => new URL(p, ROOT_URL);

/** Alle Dateien `name` unter dem Ordner `dir` (relativ zur Wurzel), rekursiv. */
function findFiles(dir, test, out = []) {
  if (!existsSync(rel(dir))) return out;
  for (const entry of readdirSync(rel(dir), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) findFiles(`${path}/`, test, out);
    else if (test(entry.name)) out.push(path);
  }
  return out;
}

test('CLAUDE.md bleibt schlank: höchstens 7 000 Zeichen, keine Zeile über 200 Zeichen', () => {
  const text = read('../CLAUDE.md');
  assert.ok(text.length <= 7000, `CLAUDE.md: ${text.length} Zeichen (höchstens 7 000); Einzelheiten nach docs/ auslagern und im Wegweiser verlinken`);
  const long = text.split('\n').map((line, i) => [i + 1, line.length]).filter(([, n]) => n > 200);
  assert.deepEqual(long, [], 'CLAUDE.md: Zeilen über 200 Zeichen ([Zeile, Länge])');
});

test('CLAUDE.md: jede im Wegweiser genannte Datei existiert, jedes Rezept unter docs/rezepte/ steht im Wegweiser', () => {
  const text = read('../CLAUDE.md');
  const from = text.indexOf('## Wegweiser');
  assert.ok(from >= 0, 'Abschnitt „## Wegweiser“ in CLAUDE.md nicht gefunden');
  const guide = text.slice(from);
  const paths = [...guide.matchAll(/`([\w./-]+\.md)`/g)].map((m) => m[1]);
  assert.ok(paths.length >= 15, `zu wenige Dateien im Wegweiser gefunden (${paths.length}): Muster prüfen`);
  assert.deepEqual(paths.filter((p) => !existsSync(rel(p))), [], 'Wegweiser nennt Dateien, die es nicht gibt');
  const recipes = findFiles('docs/rezepte/', (n) => n.endsWith('.md'));
  assert.ok(recipes.length >= 10, 'zu wenige Rezepte unter docs/rezepte/');
  assert.deepEqual(recipes.filter((p) => !paths.includes(p)), [], 'Rezept ohne Zeile im Wegweiser der CLAUDE.md');
});

test('Einstiegs- und Strukturdoku ohne Versionsvermerke „seit v…“', () => {
  const files = [
    'CLAUDE.md', 'test/CLAUDE.md', 'ARCHITEKTUR.md', 'docs/wo-aendern.md', 'docs/testen.md', 'docs/betrieb.md',
    ...findFiles('js/', (n) => n === 'CLAUDE.md'),
    ...findFiles('docs/rezepte/', (n) => n.endsWith('.md')),
    ...findFiles('docs/architektur/', (n) => n.endsWith('.md')),
  ];
  const hits = [];
  for (const file of files) {
    readFileSync(rel(file), 'utf8').split('\n').forEach((line, i) => {
      if (/seit v\d/.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], 'Versionsvermerke gehören in docs/changelog.md; „seit v…“ hier streichen');
});

// Paket „Kurze Zeilen“: Eine Suche liefert ganze Zeilen; damit ein Treffer nicht einen ganzen Absatz kostet, steht im PRD
// ein Satz je Zeile. Grenze 200 Zeichen, Tabellenzeilen 300 (die erzeugten Bereiche von `npm run docs` gelten mit).
test('Kurze Zeilen: PRD.md und docs/prd/*.md ohne Zeile über 200 Zeichen (Tabellenzeilen 300)', () => {
  const files = ['PRD.md', ...readdirSync(new URL('../docs/prd/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => 'docs/prd/' + f)];
  const problems = [];
  for (const f of files) {
    read('../' + f).split('\n').forEach((line, i) => {
      const len = [...line].length;
      const max = line.trimStart().startsWith('|') ? 300 : 200;
      if (len > max) problems.push(`${f}:${i + 1} hat ${len} Zeichen (höchstens ${max})`);
    });
  }
  assert.deepEqual(problems, [], 'zu lange Zeilen, ein Satz je Zeile (lange Sätze am Komma umbrechen):\n' + problems.join('\n'));
});

// Paket „Schlanke Tests“: test/CLAUDE.md ist die Vorlage für neue Tests. Klein halten, die genannten Dateien gibt es,
// und der Codeblock ist zeichengleich mit test/vorlage.test.js (läuft also so, wie er dasteht).
test('test/CLAUDE.md: höchstens 3 KB, Zeilen bis 200 Zeichen, Vorlage = vorlage.test.js, genannte Dateien vorhanden', () => {
  const text = read('CLAUDE.md');
  assert.ok(Buffer.byteLength(text, 'utf8') <= 3072, `test/CLAUDE.md: ${Buffer.byteLength(text, 'utf8')} Bytes (höchstens 3 072)`);
  const long = text.split('\n').map((l, i) => [i + 1, [...l].length]).filter(([, n]) => n > 200);
  assert.deepEqual(long, [], 'test/CLAUDE.md: Zeilen über 200 Zeichen ([Zeile, Länge])');
  const block = text.match(/```js\n([\s\S]*?)```/)[1];
  assert.ok(read('vorlage.test.js').endsWith(block), 'Vorlage in test/CLAUDE.md und test/vorlage.test.js weichen ab');
  const named = [...text.matchAll(/`([\w-]+\.(?:test\.)?js)`/g)].map((m) => m[1]);
  assert.deepEqual(named.filter((n) => !existsSync(new URL(n, import.meta.url))), [], 'test/CLAUDE.md nennt fehlende Dateien unter test/');
});
