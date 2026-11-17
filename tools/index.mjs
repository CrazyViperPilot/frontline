// Symbol-Index: je Ordner unter js/ eine erzeugte Liste „Datei → Exporte“ nach docs/index/<ordner>.md.
// Wozu: Ein Modell findet die Datei einer Funktion mit einem Blick in den Index statt mehrerer Suchen.
// Erfasst export function/const/let/class/default und export { … } (auch mehrzeilig und mit from), dazu die Methoden
// von exportierten Klassen und Objekten (Mixins wie js/ai/army/*.js) als eingerückte Zeilen. Kein Parser:
// Zeilenmuster, die sich auf die Schreibweise des Repos stützen (Einrückung zwei Leerzeichen, schließende Klammer in Spalte 0).
// Ausgabe stabil (alphabetisch nach Pfad, Exporte in Dateireihenfolge, ohne Datum und Zeilennummern).
// Aufruf: npm run index (schreibt die Dateien; eine Zeile auf die Konsole). test/index.test.js vergleicht mit buildIndex().
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX_DIR = 'docs/index';
const MAX_BYTES = 12 * 1024; // Obergrenze je Indexdatei
const MAX_LINE = 160; // längste Zeile einer Indexdatei
const NOTE_MAX = 80; // erster Kommentarsatz, so weit gekürzt

// Kleine Ordner teilen sich eine Indexdatei (Ordner → Name der Datei ohne .md); alle übrigen bekommen eine eigene.
const MERGED = { 'js': 'core', 'js/core': 'core', 'js/audio': 'core', 'js/editor': 'core' };

/** Alle .js-Dateien unter js/ (Pfade relativ zur Wurzel, mit /), sortiert. */
function walk(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir)).sort()) {
    const p = `${dir}/${n}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Indexname eines Ordners: js/game/city → game-city. */
const groupOf = (dir) => MERGED[dir] ?? dir.replace(/^js\//, '').replace(/\//g, '-');

/** Text ab Position `start` (auf „(“) bis zur passenden „)“, über Zeilen hinweg; null, wenn nicht gefunden. */
function balanced(text, start) {
  let depth = 0;
  for (let i = start; i < text.length && i < start + 2000; i++) {
    const c = text[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0) return text.slice(start + 1, i); }
  }
  return null;
}

/** Parameterliste kürzen: Leerraum zusammenziehen, Vorgabewerte (= …) auf oberster Ebene weglassen. */
function cleanParams(raw) {
  const s = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  let out = '';
  let depth = 0;
  let skip = false;
  for (const c of s) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (depth === 0 && c === '=' && !skip) { skip = true; out = out.trimEnd(); continue; }
    if (depth === 0 && c === ',') skip = false;
    if (!skip) out += c;
  }
  return out.replace(/,(?=\S)/g, ', ');
}

// Abkürzungen, deren Punkt keinen Satz beendet.
const ABBR = /(?:\b(?:z\. B|d\. h|u\. a|z|d|u|bzw|vgl|ca|usw|ggf|evtl|inkl|s|o|Nr|bspw|etc|max|min|bzgl|ua|sog)|\d)$/;

/** Erster Satz eines Kommentars, auf NOTE_MAX Zeichen gekürzt. */
function firstSentence(text) {
  // Versionsvermerke („seit v5.67“) gehören in den Änderungsverlauf, nicht in den Index.
  const t = text.replace(/\s*\(seit v[\d.]+\)/g, '').replace(/,\s*seit v[\d.]+(?=\))/g, '').replace(/\(seit v[\d.]+,\s*/g, '(')
    .replace(/\s+seit v[\d.]+(?=[),])/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  let end = t.length;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '.' || (i + 1 < t.length && t[i + 1] !== ' ')) continue;
    if (ABBR.test(t.slice(0, i))) continue;
    end = i;
    break;
  }
  let s = t.slice(0, end).trim();
  if ([...s].length > NOTE_MAX) s = [...s].slice(0, NOTE_MAX - 1).join('').trimEnd() + '…';
  return s;
}

/** Kommentar direkt über Zeile `i` (Block /** … *\/ oder zusammenhängende //-Zeilen), sonst ''. */
function commentAbove(lines, i) {
  let j = i - 1;
  if (j < 0) return '';
  const prev = lines[j].trim();
  if (prev.endsWith('*/')) {
    const block = [];
    for (; j >= 0; j--) {
      block.unshift(lines[j]);
      if (/^\s*\/\*/.test(lines[j])) break;
    }
    return block.join(' ').replace(/^\s*\/\*+/, '').replace(/\*+\/\s*$/, '')
      .split(/\s\*\s|\s\*(?=\s|$)/).join(' ').replace(/@\w+[\s\S]*$/, '');
  }
  if (prev.startsWith('//')) {
    const block = [];
    for (; j >= 0 && lines[j].trim().startsWith('//'); j--) block.unshift(lines[j].trim().replace(/^\/\/+\s?/, ''));
    return block.join(' ');
  }
  return '';
}

/** Kommentar am Zeilenende (// …) als Ersatz, wenn darüber keiner steht. */
function trailingComment(line) {
  const m = line.match(/[;,{)\]]\s*\/\/\s?(.*)$/);
  return m ? m[1] : '';
}

const note = (lines, i) => firstSentence(commentAbove(lines, i) || trailingComment(lines[i]));

// Methodenzeile in Klasse oder Objekt (Einrückung genau zwei Leerzeichen); Schlüsselwörter sind keine Methoden.
const METHOD = /^ {2}(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?([A-Za-z_$][\w$]*)\s*\(/;
const ARROW_PROP = /^ {2}([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?(?:function\s*\*?\s*\w*\s*\(|\(|[A-Za-z_$][\w$]*\s*=>)/;
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'function', 'with']);

/** Methoden eines Klassen- oder Objektrumpfs ab Zeile `i` bis zur „}“ in Spalte 0. */
function membersOf(lines, text, offsets, i) {
  const out = [];
  for (let j = i + 1; j < lines.length && !/^\}/.test(lines[j]); j++) {
    const l = lines[j];
    let m = l.match(METHOD);
    let name;
    let open;
    if (m && !KEYWORDS.has(m[1])) { name = m[1]; open = offsets[j] + l.indexOf('(', l.indexOf(m[1])); }
    else if ((m = l.match(ARROW_PROP))) {
      name = m[1];
      const k = l.indexOf('(', l.indexOf(':'));
      open = k >= 0 ? offsets[j] + k : -1;
      if (k < 0) { out.push({ sig: `${name}(${l.match(/:\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/)?.[1] ?? ''})`, note: note(lines, j) }); continue; }
    } else continue;
    const params = balanced(text, open);
    out.push({ sig: `${name}(${params === null ? '…' : cleanParams(params)})`, note: note(lines, j) });
  }
  return out;
}

/** Exporte einer Quelldatei: [{ sig, note, members }] in Dateireihenfolge. */
export function exportsOf(src) {
  const lines = src.split('\n');
  const offsets = [];
  let pos = 0;
  for (const l of lines) { offsets.push(pos); pos += l.length + 1; }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('export')) continue;
    let m;
    if ((m = l.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/))) {
      const name = m[1] ?? 'default';
      const params = balanced(src, offsets[i] + l.indexOf('(', m[0].length - 1));
      out.push({ sig: `${name}(${params === null ? '…' : cleanParams(params)})`, note: note(lines, i) });
    } else if ((m = l.match(/^export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)?/))) {
      out.push({ sig: `class ${m[1] ?? 'default'}`, note: note(lines, i), members: membersOf(lines, src, offsets, i) });
    } else if ((m = l.match(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/))) {
      const [, name, rest] = m;
      const arrow = rest.match(/^(?:async\s+)?(?:\(|([A-Za-z_$][\w$]*)\s*=>)/);
      const fn = rest.match(/^(?:async\s+)?function\s*\*?\s*\w*\s*\(/);
      if (arrow || fn) {
        const k = l.indexOf('(', l.indexOf('='));
        const params = arrow?.[1] ?? (k >= 0 ? balanced(src, offsets[i] + k) : null);
        out.push({ sig: `${name}(${params === null ? '…' : arrow?.[1] ? params : cleanParams(params)})`, note: note(lines, i) });
      } else {
        const members = /^\{\s*(\/\/.*)?$/.test(rest) ? membersOf(lines, src, offsets, i) : [];
        out.push({ sig: name, note: note(lines, i), members });
      }
    } else if ((m = l.match(/^export\s+(?:const|let|var)\s+\{/))) {
      // export const { a, b } = …: jeder Name einzeln
      const inner = balanced(src, offsets[i] + l.indexOf('{'));
      for (const p of (inner ?? '').split(',')) {
        const n = p.split(':').pop().split('=')[0].trim();
        if (n) out.push({ sig: n, note: note(lines, i) });
      }
    } else if (/^export\s+default\b/.test(l)) {
      const rest = l.replace(/^export\s+default\s+/, '').replace(/[;{].*$/, '').trim();
      out.push({ sig: `default${rest ? ' ' + rest : ''}`, note: note(lines, i), members: /\{\s*$/.test(l) ? membersOf(lines, src, offsets, i) : [] });
    } else if (/^export\s*(?:\*|\{)/.test(l)) {
      // export { a, b as c } [from './x.js']; auch über mehrere Zeilen
      let body = l;
      for (let j = i; !/\}|\*/.test(body.replace(/^export\s*/, '')) && j + 1 < lines.length;) body += '\n' + lines[++j];
      const from = (src.slice(offsets[i], offsets[i] + body.length + 200).match(/\}\s*from\s*['"]([^'"]+)['"]/) || [])[1];
      const star = body.match(/^export\s*\*\s*(?:as\s+(\w+)\s*)?from\s*['"]([^'"]+)['"]/);
      if (star) { out.push({ sig: `${star[1] ?? '*'} (aus ${basename(star[2])})`, note: note(lines, i) }); continue; }
      const inner = body.slice(body.indexOf('{') + 1, body.indexOf('}'));
      const n = note(lines, i);
      for (const part of inner.replace(/\/\/[^\n]*/g, '').split(',')) {
        const p = part.trim();
        if (!p) continue;
        const [local, , alias] = p.split(/\s+/);
        const label = alias ? `${alias} (= ${local})` : local;
        out.push({ sig: from ? `${label} (aus ${basename(from)})` : label, note: n });
      }
    }
  }
  return out;
}

/** Eine Zeile höchstens MAX_LINE Zeichen: zu lange Signaturen am Ende kürzen. */
function line(prefix, { sig, note: n }) {
  let s = `${prefix}${sig}${n ? ' – ' + n : ''}`;
  if ([...s].length > MAX_LINE) {
    const keep = MAX_LINE - (n ? n.length + 3 : 0) - prefix.length - 1;
    s = `${prefix}${[...sig].slice(0, Math.max(keep, 20)).join('')}…${n ? ' – ' + n : ''}`;
    if ([...s].length > MAX_LINE) s = [...s].slice(0, MAX_LINE - 1).join('') + '…';
  }
  return s;
}

/** Abschnitt einer Quelldatei: Überschrift mit Pfad und Größe, darunter je Export ein Block (Export samt Methoden). */
function section(path, base, src) {
  const kb = Buffer.byteLength(src, 'utf8') / 1024;
  const head = `## ${relative(base, path).split('\\').join('/')} (${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB)`;
  const exps = exportsOf(src);
  const blocks = exps.map((e) => [line('- ', e), ...(e.members ?? []).map((m) => line('  - ', m))].join('\n') + '\n');
  if (!blocks.length) blocks.push('- (keine Exporte)\n');
  return { head, blocks, exports: exps.length, members: exps.reduce((n, e) => n + (e.members?.length ?? 0), 0) };
}

const HEAD = (title, dirs) => `# Symbol-Index ${title}\n\nErzeugt von \`npm run index\` (tools/index.mjs), nicht von Hand ändern. ` +
  `Ordner: ${dirs.map((d) => '`' + d + '/`').join(', ')}. Pfade relativ zu \`${commonBase(dirs)}/\`.\n`;

/** Gemeinsamer Elternordner mehrerer Ordner. */
function commonBase(dirs) {
  let base = dirs[0];
  while (!dirs.every((d) => d === base || d.startsWith(base + '/'))) base = dirname(base);
  return base;
}

/** Index im Speicher: { 'docs/index/game.md': Text, … } und Zählung. */
export function buildIndex() {
  const files = walk('js');
  const groups = new Map();
  for (const f of files) {
    const g = groupOf(dirname(f));
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  const result = {};
  let nExports = 0;
  let nMembers = 0;
  for (const g of [...groups.keys()].sort()) {
    const list = groups.get(g).sort();
    const dirs = [...new Set(list.map((f) => dirname(f)))].sort();
    const base = commonBase(dirs);
    const sections = list.map((f) => {
      const sec = section(f, base, readFileSync(join(ROOT, f), 'utf8'));
      nExports += sec.exports;
      nMembers += sec.members;
      return { file: f, ...sec };
    });
    // Zu groß: der Reihe nach in Teile schneiden, zwischen Dateien oder (bei einer sehr großen Datei) zwischen Exporten.
    // Ein Teil heißt nach dem Anfangsbuchstaben seiner ersten und letzten Datei (game-a-f.md).
    const budget = MAX_BYTES - Buffer.byteLength(HEAD(`${g} (Teil 10 von 10, ${'x'.repeat(60)})`, dirs), 'utf8');
    const chunks = [];
    let cur = { files: [], text: '' };
    const add = (t) => { cur.text += t; };
    for (const sec of sections) {
      let opened = false;
      for (const blk of sec.blocks) {
        const headText = `\n${opened ? sec.head.replace(/ \(.*\)$/, ' (Fortsetzung)') : sec.head}\n`;
        const need = Buffer.byteLength((opened ? '' : headText) + blk, 'utf8');
        if (cur.text && Buffer.byteLength(cur.text, 'utf8') + need > budget) {
          chunks.push(cur);
          cur = { files: [], text: '' };
          if (opened) add(`\n${sec.head.replace(/ \(.*\)$/, ' (Fortsetzung)')}\n`);
        }
        if (!opened) { add(`\n${sec.head}\n`); opened = true; }
        if (!cur.files.includes(sec.file)) cur.files.push(sec.file);
        add(blk);
      }
    }
    chunks.push(cur);
    const rel = (f) => relative(base, f).split('\\').join('/');
    const letter = (f) => rel(f)[0].toLowerCase();
    const names = chunks.map((c) => {
      if (chunks.length === 1) return g;
      const [a, z] = [letter(c.files[0]), letter(c.files.at(-1))];
      return `${g}-${a}${a === z ? '' : '-' + z}`;
    });
    names.forEach((n, k) => { if (names.indexOf(n) !== k) names[k] = `${n}-${k + 1}`; });
    chunks.forEach((c, k) => {
      const span = c.files.length === 1 ? rel(c.files[0]) : `${rel(c.files[0])} bis ${rel(c.files.at(-1))}`;
      const title = chunks.length === 1 ? g : `${g} (Teil ${k + 1} von ${chunks.length}, ${span})`;
      result[`${INDEX_DIR}/${names[k]}.md`] = HEAD(title, dirs) + c.text;
    });
  }
  return { files: result, count: { files: files.length, exports: nExports, members: nMembers } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, count } = buildIndex();
  if (!existsSync(join(ROOT, INDEX_DIR))) mkdirSync(join(ROOT, INDEX_DIR), { recursive: true });
  // Veraltete Teil-Dateien entfernen (README.md bleibt).
  for (const n of readdirSync(join(ROOT, INDEX_DIR))) {
    if (n.endsWith('.md') && n !== 'README.md' && !files[`${INDEX_DIR}/${n}`]) unlinkSync(join(ROOT, INDEX_DIR, n));
  }
  for (const [p, t] of Object.entries(files)) writeFileSync(join(ROOT, p), t);
  console.log(`Symbol-Index: ${count.files} Dateien, ${count.exports} Exporte, ${count.members} Methoden → ${Object.keys(files).length} Dateien in ${INDEX_DIR}/`);
}

