// Prüfskript „Toter Code“: listet Exporte unter js/, die keine andere Datei namentlich nennt.
// Gesucht wird in js/, test/, tools/ und den HTML-Dateien (Wurzel und admin/), als ganzes Wort.
// Ausgabe je Export:
//   tot     – auch die eigene Datei nennt den Namen nur in der Exportzeile (Export und Code entfernen)
//   intern  – nur die eigene Datei nutzt ihn (Schlüsselwort export entfernen)
// Aufruf: npm run deadcode            (Liste, Endcode 0)
//         npm run deadcode -- --json (maschinenlesbar)
// Die Prüfung ist bewusst einfach (Wortsuche, kein Parser): ein Name, der zufällig auch anderswo vorkommt,
// gilt als genutzt. Treffer sind deshalb sicher ungenutzt, die Liste ist aber nicht vollständig.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, exts, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (p === join(ROOT, 'js', 'vendor')) continue; // fremde Bibliotheken (js/vendor/) nicht prüfen
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
}

const jsFiles = walk(join(ROOT, 'js'), ['.js']);
const otherFiles = [
  ...walk(join(ROOT, 'test'), ['.js', '.mjs']),
  ...walk(join(ROOT, 'tools'), ['.js', '.mjs']).filter((p) => !p.endsWith('deadcode.mjs')),
  ...readdirSync(ROOT).filter((n) => n.endsWith('.html')).map((n) => join(ROOT, n)),
  ...walk(join(ROOT, 'admin'), ['.html', '.js']),
];
const text = new Map([...jsFiles, ...otherFiles].map((p) => [p, readFileSync(p, 'utf8')]));

/** Kommentare entfernen (grob: Block- und Zeilenkommentare außerhalb von Zeichenketten reichen hier). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Exporte einer Datei: [{ name, line, local }] (local = Name in der Datei, bei `export { a as b }` a). */
function exportsOf(src) {
  const out = [];
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    let m = l.match(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (m) { out.push({ name: m[1], local: m[1], line: i + 1 }); return; }
    if (/^export\s*\{/.test(l)) {
      let body = l, j = i;
      while (!body.includes('}') && j + 1 < lines.length) body += ' ' + lines[++j];
      const inner = body.slice(body.indexOf('{') + 1, body.indexOf('}'));
      for (const part of inner.split(',')) {
        const p = part.replace(/\/\/.*$/, '').trim();
        if (!p) continue;
        const [local, , alias] = p.split(/\s+/);
        out.push({ name: alias || local, local, line: i + 1, list: true });
      }
    }
  });
  return out;
}

const word = (name) => new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');

const results = [];
for (const file of jsFiles) {
  const src = text.get(file);
  for (const ex of exportsOf(src)) {
    const re = word(ex.name);
    let usedElsewhere = false;
    for (const [p, t] of text) {
      if (p === file) continue;
      re.lastIndex = 0;
      if (re.test(stripComments(t))) { usedElsewhere = true; break; }
    }
    if (usedElsewhere) continue;
    const own = (stripComments(src).match(word(ex.local)) || []).length;
    results.push({ file: relative(ROOT, file), line: ex.line, name: ex.name, kind: own <= 1 ? 'tot' : 'intern', list: !!ex.list });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) console.log(`${r.kind.padEnd(6)} ${r.file}:${r.line}  ${r.name}${r.list ? '  (export-Liste)' : ''}`);
  const tot = results.filter((r) => r.kind === 'tot').length;
  console.log(`\n${results.length} Exporte ohne Nutzer außerhalb ihrer Datei (${tot} ganz ungenutzt).`);
}
