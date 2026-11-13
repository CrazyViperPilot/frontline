// Admin-Panel (ADM1, docs/prd/konto.md „Admin-Panel“): Verdrahtung ohne PHP-Server. Die Abläufe gegen MariaDB wurden von Hand
// geprüft; hier steht, was sich ohne Datenbank sichern lässt: Secrets im Deploy, Upload, Offline-Liste, Datei-Eigenschaften.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('Deploy: Secrets ADMIN_USER und ADMIN_PASSWORD, nur Name und Hash in config.php, admin/ wird hochgeladen', () => {
  const wf = read('.github/workflows/deploy.yml');
  assert.match(wf, /ADMIN_USER: \$\{\{ secrets\.ADMIN_USER \}\}/);
  assert.match(wf, /ADMIN_PASSWORD: \$\{\{ secrets\.ADMIN_PASSWORD \}\}/);
  assert.match(wf, /"admin_pass_hash" => \$adminPass !== "" \? password_hash\(\$adminPass, PASSWORD_DEFAULT\) : ""/);
  assert.match(wf, /cp -r index\.html editor\.html manifest\.json sw\.js css js icons api admin site\//);
  assert.doesNotMatch(wf, /"admin_password"/, 'das Passwort selbst darf nicht in config.php');
});

test('Oberfläche: noindex, nicht im Offline-Cache, kein innerHTML mit Daten vom Server', () => {
  const html = read('admin/index.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(read('sw.js'), /admin\//, 'admin/ steht nicht in sw.js ASSETS');
  assert.doesNotMatch(read('admin/admin.js'), /\.innerHTML/);
  assert.match(read('admin/admin.js'), /new URL\('\.\.\/api\/admin\.php', location\.href\)/);
});

test('Schnittstelle: Datei vorhanden, PHP-Syntax (wenn PHP da ist), Cookie fl_admin mit Strict', (t) => {
  const src = read('api/admin.php');
  assert.match(src, /setcookie\('fl_admin'/);
  assert.match(src, /'samesite' => 'Strict'/);
  assert.match(src, /'httponly' => true/);
  assert.match(src, /hash_equals\(/);
  assert.match(src, /fail\(503, 'Admin nicht eingerichtet'\)/);
  const php = spawnSync('php', ['-l', join(ROOT, 'api/admin.php')], { encoding: 'utf8' });
  if (php.error) return t.skip('php nicht installiert');
  assert.equal(php.status, 0, php.stdout + php.stderr);
});

test('Doku: Abschnitt „Admin-Panel“ in konto.md mit der Adresse /frontline/admin/', () => {
  const doc = read('docs/prd/konto.md');
  assert.match(doc, /## Admin-Panel/);
  assert.match(doc, /\/frontline\/admin\//);
});
