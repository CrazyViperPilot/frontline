// Startet node --test mit einem Prozess je Kern (Paket „Schnellere Tests“). Node nimmt ohne Angabe einen Kern weniger; die Tests
// rechnen fast nur, der Hauptprozess wartet: auf 4 Kernen ist ein vierter Prozess etwa 11 % schneller (gemessen 5:42 statt 6:26 min).
// Name nicht test.mjs: node --test nähme die Datei sonst selbst als Test.
// Aufruf: npm test (alle), npm run test:fast (ohne „[langsam]“); weitere Angaben gehen an node --test, z. B. npm test -- test/scramble.test.js
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';

const args = process.argv.slice(2);
const own = args.some((a) => a.startsWith('--test-concurrency'));
const r = spawnSync(process.execPath, ['--test', ...(own ? [] : [`--test-concurrency=${availableParallelism()}`]), ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
