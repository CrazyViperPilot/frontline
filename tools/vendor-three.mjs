// three.js als feste, verkleinerte Kopie nach js/vendor/three/ holen (Plan docs/plan-3d.md, Paket „three.js einbinden“).
// Nur beim Einbinden oder Versionswechsel ausführen, kein Build-Schritt fürs Spiel. Aufruf: node tools/vendor-three.mjs
// Ergebnis: three.core.min.js und three.module.min.js (je mit Kopfzeile) und LICENSE. Die Dateien sind eingecheckt, nie von Hand ändern.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THREE_VERSION = '0.187.0'; // three.js-Version aus dem npm-Registry
const ESBUILD_VERSION = '0.24.2'; // Verkleinerer; wird nur zum Ausführen dieses Skripts geholt, nicht ins Repo installiert
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js', 'vendor', 'three');
const HEADER = `/* three.js ${THREE_VERSION} (MIT, siehe LICENSE), verkleinert mit tools/vendor-three.mjs */\n`;
const CORE_IMPORT = './three.core.js'; // Import im Modul, der auf die verkleinerte Kern-Datei zeigen muss
const CORE_IMPORT_MIN = './three.core.min.js';

const tmp = mkdtempSync(join(os.tmpdir(), 'vendor-three-'));
try {
  // Paket holen und entpacken (npm pack legt das .tgz im Arbeitsordner ab)
  execFileSync('npm', ['pack', `three@${THREE_VERSION}`, '--silent'], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
  const tgz = readdirSync(tmp).find((n) => n.endsWith('.tgz'));
  if (!tgz) throw new Error('npm pack hat kein .tgz erzeugt');
  execFileSync('tar', ['xzf', tgz], { cwd: tmp });
  const pkg = join(tmp, 'package');
  const version = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
  if (version !== THREE_VERSION) throw new Error(`Paket hat Version ${version}, erwartet ${THREE_VERSION}`);

  // Beide Module mit esbuild verkleinern (ohne Bündelung: die Importe bleiben als Dateien erhalten)
  mkdirSync(OUT, { recursive: true });
  const minify = (name) => {
    const out = join(OUT, name.replace(/\.js$/, '.min.js'));
    execFileSync('npx', ['--yes', `esbuild@${ESBUILD_VERSION}`, join(pkg, 'build', name), '--minify', '--format=esm',
      '--legal-comments=none', `--outfile=${out}`], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
    return out;
  };
  const core = minify('three.core.js');
  const mod = minify('three.module.js');

  // Import der Kern-Datei auf die verkleinerte Fassung umbiegen; ohne Treffer ist die Ausgabe falsch
  const modSrc = readFileSync(mod, 'utf8');
  const hits = modSrc.split(CORE_IMPORT).length - 1;
  if (hits < 1) throw new Error(`three.module.min.js enthält keinen Import von '${CORE_IMPORT}'`);
  writeFileSync(mod, HEADER + modSrc.split(CORE_IMPORT).join(CORE_IMPORT_MIN));
  writeFileSync(core, HEADER + readFileSync(core, 'utf8'));
  console.log(`Import umgebogen: ${hits}× ${CORE_IMPORT} → ${CORE_IMPORT_MIN}`);

  copyFileSync(join(pkg, 'LICENSE'), join(OUT, 'LICENSE'));

  for (const f of [core, mod]) console.log(`${f.slice(ROOT.length + 1)}: ${statSync(f).size} Bytes`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
