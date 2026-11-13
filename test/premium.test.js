// Konten (Paket Konto-Premium, docs/prd/konto.md „Nickname und Premium-Zeiträume“): die reinen Regeln in api/lib/konto.php (Premium jetzt,
// Nickname-Regel) mit der PHP-Kommandozeile, dazu die Verdrahtung in der Schnittstelle und der Oberfläche. Fehlt php, werden
// die PHP-Prüfungen übersprungen. Die Abläufe gegen MariaDB (Übernahme, Zeiträume, Bearbeiten, Löschen) sind von Hand geprüft.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const KONTO = join(ROOT, 'api/lib/konto.php');
const hasPhp = !spawnSync('php', ['-v']).error;

/** Einen Ausdruck mit den Funktionen aus api/lib/konto.php auswerten; Argumente kommen als JSON über die Umgebung (FL_ARG). */
function phpCall(expr, arg = null) {
  const code = `require ${JSON.stringify(KONTO)}; $ARG = json_decode(getenv('FL_ARG'), true); echo json_encode(${expr});`;
  const r = spawnSync('php', ['-r', code], { encoding: 'utf8', env: { ...process.env, FL_ARG: JSON.stringify(arg) } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('fl_premium_of: ohne Zeitraum kein Premium, Beginn zählt, Ende zählt nicht mehr', (t) => {
  if (!hasPhp) return t.skip('php nicht installiert');
  assert.deepEqual(phpCall('fl_premium_of([], 1000)'), { premium: false, until: null, nextStart: null });
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>1000,"ends_at"=>2000]], 1000)'), { premium: true, until: 2000, nextStart: null }, 'Beginn genau jetzt: aktiv');
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>500,"ends_at"=>1000]], 1000)'), { premium: false, until: null, nextStart: null }, 'Ende genau jetzt: vorbei');
});

test('fl_premium_of: unbefristet gewinnt über befristet, sonst das späteste Ende; Zukunft als nächster Beginn', (t) => {
  if (!hasPhp) return t.skip('php nicht installiert');
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>0,"ends_at"=>null]], 1000)'), { premium: true, until: null, nextStart: null });
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>0,"ends_at"=>5000],["starts_at"=>0,"ends_at"=>null]], 1000)'), { premium: true, until: null, nextStart: null });
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>0,"ends_at"=>5000],["starts_at"=>0,"ends_at"=>3000]], 1000)'), { premium: true, until: 5000, nextStart: null });
  assert.deepEqual(phpCall('fl_premium_of([["starts_at"=>3000,"ends_at"=>4000],["starts_at"=>2000,"ends_at"=>2500]], 1000)'), { premium: false, until: null, nextStart: 2000 });
});

test('fl_nickname_normalize: 3 bis 20 Zeichen, Buchstaben, Ziffern, Leerzeichen, _ und -; Leerzeichen am Rand und Folgen werden normalisiert', (t) => {
  if (!hasPhp) return t.skip('php nicht installiert');
  const run = (v) => phpCall('fl_nickname_normalize($ARG)', v);
  assert.equal(run('Anna'), 'Anna');
  assert.equal(run('  Anna   Lisa  '), 'Anna Lisa');
  assert.equal(run('Anna\u00a0\u00a0Lisa'), 'Anna Lisa', 'geschütztes Leerzeichen zählt als Leerzeichen');
  assert.equal(run('Jörg_99-x'), 'Jörg_99-x');
  assert.equal(run('abc'), 'abc', 'genau 3 Zeichen');
  assert.equal(run('a'.repeat(20)), 'a'.repeat(20), 'genau 20 Zeichen');
  assert.equal(run('ab'), null, 'zu kurz');
  assert.equal(run('a'.repeat(21)), null, 'zu lang');
  assert.equal(run('Anna!'), null, 'Satzzeichen');
  assert.equal(run('An.na'), null, 'Punkt');
  assert.equal(run('   '), null, 'nur Leerzeichen');
  assert.equal(run(42), null, 'keine Zeichenkette');
});

test('Verdrahtung: Nickname bei der Registrierung, Premium aus den Zeiträumen, Schema und Übernahme', () => {
  const konto = read('api/lib/konto.php');
  const auth = read('api/auth.php');
  assert.match(konto, /CREATE TABLE IF NOT EXISTS premium_periods/);
  assert.match(konto, /ADD UNIQUE KEY \$name \(\$column\)/, 'eindeutiger Schlüssel auf users.nickname');
  assert.match(konto, /fl_add_user_index\(\$pdo, 'uq_users_nickname', 'nickname'\)/);
  assert.match(konto, /WHERE u\.plan = 'premium' AND \(u\.premium_until IS NULL OR u\.premium_until > u\.created_at\)/, 'Übernahme des alten Standes');
  assert.match(auth, /\$nick = fl_check_nickname\(fl_field\(\$body, 'nickname'\)\);/);
  assert.match(auth, /if \(fl_nickname_taken\(\$pdo, \$nick\)\) fail\(409, FL_MSG_NICK_TAKEN\);/);
  assert.match(auth, /'plan' => \$premium\['premium'\] \? 'premium' : 'free'/, 'plan kommt aus den Zeiträumen');
  assert.doesNotMatch(auth, /\$u\['plan'\]|\$u\['premium_until'\]/, 'die alten Spalten werden nicht mehr gelesen');
});

test('Schnittstelle admin.php: Aktionen für Zugangsdaten und Zeiträume, Löschen mit den Zeiträumen', () => {
  const src = read('api/admin.php');
  for (const a of ['edit', 'periods', 'periodAdd', 'periodEdit', 'periodDelete']) {
    assert.match(src, new RegExp(`case '${a}': admin_\\w+\\(\\$pdo, \\$body\\); break;`), `Aktion ${a}`);
  }
  assert.match(src, /DELETE FROM premium_periods WHERE user_id = :id/);
  assert.match(src, /fail\(409, 'Der Zeitraum überschneidet sich/);
  assert.match(src, /'nickname' => \$r\['nickname'\] \?\? null/);
});

test('Oberfläche: Nickname im Registrierungsformular und in der Anzeige; Admin-Dialoge ohne innerHTML', () => {
  const menu = read('js/ui/menu.js');
  assert.match(menu, /register: nick \+ email \+ newPass \+ again/);
  assert.match(menu, /accountRequest\(\{ action: 'register', email, nickname: nick, password: pw \}\)/);
  assert.match(menu, /const accountWho = \(u\) => \(u\.nickname \? /);
  const admin = read('admin/admin.js');
  assert.doesNotMatch(admin, /\.innerHTML/);
  for (const a of ['edit', 'periods', 'periodAdd', 'periodEdit', 'periodDelete']) {
    assert.match(admin, new RegExp(`'${a}'`), `admin.js ruft ${a} auf`);
  }
  const html = read('admin/index.html');
  assert.match(html, /<dialog id="edit-dialog"/);
  assert.match(html, /<dialog id="premium-dialog"/);
});
