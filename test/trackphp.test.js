// Besucherstatistik, Server (docs/prd/statistik.md): reine Funktionen aus api/lib/track.php und api/lib/traffic.php mit der
// PHP-Kommandozeile (wie test/matchphp.test.js). Fehlt php, werden die Tests übersprungen. Die Abläufe mit Datenbank (Speichern,
// Drossel, Aufräumen, Salzwechsel, Widerruf, Konto verknüpfen, Admin-Aktionen) sind gegen MariaDB und php -S von Hand geprüft.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const NO_PHP = spawnSync('php', ['-v']).error;

/** PHP-Ausdruck mit den Bibliotheken auswerten; ARG ist das übergebene JSON. Liefert das Ergebnis als JS-Wert. */
function php(expr, arg = null) {
  const code = `require ${JSON.stringify(join(ROOT, 'api/lib/http.php'))}; require ${JSON.stringify(join(ROOT, 'api/lib/track.php'))};
    require ${JSON.stringify(join(ROOT, 'api/lib/traffic.php'))}; date_default_timezone_set('Europe/Berlin');
    $ARG = json_decode(getenv('FL_ARG'), true); echo json_encode(${expr});`;
  const r = spawnSync('php', ['-r', code], { encoding: 'utf8', env: { ...process.env, FL_ARG: JSON.stringify(arg) } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return JSON.parse(r.stdout);
}

test('PHP-Syntax der neuen Dateien', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  for (const f of ['api/track.php', 'api/lib/track.php', 'api/lib/traffic.php', 'index.php', 'api/admin.php']) {
    const r = spawnSync('php', ['-l', join(ROOT, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stdout}${r.stderr}`);
  }
});

test('Bots, Gerät und Browser aus dem User-Agent', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const UA = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    tab: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    phone: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
    firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  };
  const res = php('array_map(fn($u) => [track_is_bot($u), track_device($u), track_browser($u)], $ARG)', UA);
  assert.deepEqual(res, {
    chrome: [false, 'desktop', 'chrome'], iphone: [false, 'mobile', 'safari'], tab: [false, 'tablet', 'chrome'],
    phone: [false, 'mobile', 'chrome'], edge: [false, 'desktop', 'edge'], firefox: [false, 'desktop', 'firefox'],
  });
  const bots = ['', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'Mozilla/5.0 HeadlessChrome/130', 'curl/8.0', 'python-requests/2.31', 'Chrome-Lighthouse'];
  assert.deepEqual(php('array_map("track_is_bot", $ARG)', bots), bots.map(() => true));
});

test('Tages-Hash: 16 Hex-Zeichen, hängt von Salz, IP und User-Agent ab', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const [a, b, c, d] = php("[track_visitor('1.2.3.4','UA','s1'), track_visitor('1.2.3.4','UA','s1'), track_visitor('1.2.3.4','UA','s2'), track_visitor('1.2.3.5','UA','s1')]");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b);
  assert.notEqual(a, c, 'anderes Salz (anderer Tag) gibt einen anderen Hash');
  assert.notEqual(a, d);
});

test('Ereignisse prüfen: nur bekannte Arten und Felder, Bereiche, höchstens 50 je Anfrage', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const pid = '0b6a8c1e-3c2d-4f5a-9b7c-1d2e3f4a5b6c';
  const body = {
    v: 'v5.248', s: '0011223344556677', p: pid, pg: 'game',
    e: [
      { k: 'start', a: 3, g: 'aaaaaaaaaaaaaaaa', d: { mode: 'conquest', opp: 2, diffs: ['normal', 'insane', 'hard'], map: 'east-europe-railway', weather: 'winter', research: true, river: 'ja', evil: 1 } },
      { k: 'end', a: 0, g: 'zz', d: { r: 'draw', dur: 99999, m: 12.4 } },
      { k: 'error', a: 0, d: { msg: 'Fehler\nmit Umbruch', file: '/js/main.js', line: 3 } },
      { k: 'error', a: 0, d: { msg: '' } },
      { k: 'hack', a: 0 },
      { k: 'menu', a: 999999999 },
      { k: 'beat', a: -1 },
    ],
  };
  const r = php('track_clean_batch($ARG)', body);
  assert.equal(r.version, 'v5.248');
  assert.equal(r.pid, pid);
  assert.deepEqual(r.events.map((e) => e.kind), ['start', 'end', 'error'], 'leerer Fehler, unbekannte Art, zu alt, negatives Alter fallen weg');
  assert.deepEqual(r.events[0].data, { mode: 'conquest', opp: 2, diffs: ['normal', 'hard'], map: 'east-europe-railway', weather: 'winter', research: true, river: null, build: null, rated: null, resumed: null });
  assert.equal(r.events[0].age, 3);
  assert.deepEqual(r.events[1], { kind: 'end', age: 0, gid: null, data: { r: null, dur: null, m: 12 } });
  assert.equal(r.events[2].data.msg, 'Fehler mit Umbruch', 'Steuerzeichen werden Leerzeichen');
  assert.equal(php('track_clean_batch($ARG)', { ...body, pg: 'evil' }), null, 'unbekannte Seite');
  assert.equal(php('track_clean_batch($ARG)', { pg: 'game' }), null, 'ohne Ereignisliste');
  const bad = php('track_clean_batch($ARG)', { pg: 'editor', v: 'x', s: 'nohex', p: 'keine-uuid', e: [] });
  assert.deepEqual([bad.version, bad.sid, bad.pid], [null, null, null]);
  const many = php('count(track_clean_batch($ARG)["events"])', { pg: 'game', e: Array.from({ length: 80 }, () => ({ k: 'menu', a: 0 })) });
  assert.equal(many, 50);
});

test('Rückmeldung prüfen: Text bis 1000 Zeichen, Daumen ±1, leer ohne Daumen ungültig', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const r = php('track_clean_feedback($ARG)', { text: `  ${'ä'.repeat(1200)} `, thumb: -1, v: 'v5.1', dur: 61.6, mode: 'classic', place: 'end', p: 'x' });
  assert.equal([...r.text].length, 1000);
  assert.deepEqual({ ...r, text: '' }, { text: '', thumb: -1, version: 'v5.1', duration: 62, mode: 'classic', place: 'end', pid: null });
  assert.equal(php('track_clean_feedback($ARG)', { text: '   ' }), null);
  assert.equal(php('track_clean_feedback($ARG)', { text: '', thumb: 1 }).thumb, 1, 'nur Daumen geht');
  assert.equal(php('track_clean_feedback($ARG)', { text: 'x', thumb: 5 }).thumb, null);
});

test('Fehlersignatur: Zahlen in der Meldung zählen nicht, Ort schon', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const [a, b, c] = php("[track_error_sig('id 12 fehlt','/a.js',3), track_error_sig('id 977 fehlt','/a.js',3), track_error_sig('id 12 fehlt','/a.js',4)]");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

/** Zeile wie aus traffic_rows. */
const row = (day, ts, kind, visitor, extra = {}) => ({ day, ts, kind, visitor, pid: null, sid: 's', gid: null, page: 'game', version: 'v5.1', device: 'desktop', browser: 'chrome', data: [], ...extra });

test('Auswertung: Partien, Ausgänge, Spielzeit, Trichter, Einwilligung', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const D = '2026-11-20';
  const T = 1795000000;
  const pid = '0b6a8c1e-3c2d-4f5a-9b7c-1d2e3f4a5b6c';
  const rows = [
    row(D, T, 'view', 'v1', { sid: null }),
    row(D, T + 1, 'menu', 'v1'),
    row(D, T + 2, 'start', 'v1', { gid: 'g1', data: { mode: 'conquest', diffs: ['hard'], research: true } }),
    ...Array.from({ length: 6 }, (_, i) => row(D, T + 60 * (i + 1), 'beat', 'v1', { gid: 'g1', data: { m: i + 1 } })),
    row(D, T + 400, 'end', 'v1', { gid: 'g1', data: { r: 'win', dur: 390, m: 7 } }),
    row(D, T + 10, 'view', 'v2', { sid: null, device: 'mobile' }),
    row(D, T + 11, 'menu', 'v2', { pid, sid: 's2' }),
    row(D, T + 12, 'start', 'v2', { pid, sid: 's2', gid: 'g2', data: { mode: 'classic', diffs: ['easy'], research: false } }),
    row(D, T + 72, 'beat', 'v2', { pid, sid: 's2', gid: 'g2', data: { m: 3 } }), // dann still: Tab geschlossen
    row(D, T + 20, 'start', 'v3', { sid: 's3', gid: 'g3', data: { mode: 'classic' } }),
    row(D, T + 50, 'end', 'v3', { sid: 's3', gid: 'g3', data: { r: 'quit', dur: 30, m: 0 } }),
    row(D, T + 30, 'beat', 'v3', { sid: 's3', gid: 'ohne-start' }), // ohne Start: zählt nicht als Partie
  ];
  const r = php("traffic_report($ARG['rows'], $ARG['pd'], '2026-11-19', '2026-11-20', $ARG['now'])", { rows, pd: [], now: T + 10000 });
  assert.equal(r.perDay.length, 2, 'auch Tage ohne Ereignis');
  assert.deepEqual(r.perDay[0], { day: '2026-11-19', views: 0, editorViews: 0, visitors: 0, starts: 0, finished: 0, wins: 0, losses: 0, quits: 0, closes: 0, playSec: 0, players: 0 });
  assert.deepEqual(r.totals, { views: 2, editorViews: 0, visitors: 3, starts: 3, finished: 1, wins: 1, losses: 0, quits: 1, closes: 1, abortRate: 0.667, playSec: 390 + 60 + 30, consentShare: 0.333, players: 1 });
  assert.deepEqual(r.funnel.map((x) => x.n), [2, 2, 3, 1, 1]);
  assert.equal(r.playtime.medianGame, 60);
  assert.deepEqual(r.playtime.games.map((b) => b.n), [2, 1, 0, 0]);
  assert.equal(r.playtime.medianPlayer, 60);
  assert.deepEqual(r.abortMinute.slice(0, 2), [{ k: '0–2', n: 1 }, { k: '2–5', n: 1 }]);
  assert.deepEqual(r.popular.modes, [{ k: 'classic', n: 2 }, { k: 'conquest', n: 1 }]);
  assert.deepEqual(r.popular.switches[0], { k: 'Forschung', on: 1, off: 1 });
  assert.deepEqual(r.devices, [{ k: 'desktop', n: 2 }, { k: 'mobile', n: 1 }]);
  // Laufende Partie: letzte Meldung vor weniger als 3 min
  const running = php("traffic_games($ARG['rows'], $ARG['now'])[0]['status']", { rows: rows.filter((x) => x.gid === 'g2'), now: T + 100 });
  assert.equal(running, 'running');
});

test('Wiederkehr D1/D7/D30: nur erreichbare Tage zählen, erster Tag im Zeitraum', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  const pd = [
    { pid: 'a', day: '2026-10-01' }, { pid: 'a', day: '2026-10-02' }, { pid: 'a', day: '2026-11-05' }, // D1, D7, D30
    { pid: 'b', day: '2026-11-10' }, // nie wieder
    { pid: 'c', day: '2026-11-21' }, { pid: 'c', day: '2026-11-22' }, // D1 ja, D7 noch nicht erreichbar
    { pid: 'd', day: '2026-08-01' }, { pid: 'd', day: '2026-10-05' }, // erster Tag vor dem Zeitraum
  ];
  const r = php("traffic_retention($ARG, '2026-09-01', '2026-11-22', '2026-11-22')", pd);
  assert.deepEqual(r, { cohort: 3, d1: { of: 3, back: 2 }, d7: { of: 2, back: 1 }, d30: { of: 1, back: 1 } });
});

test('Median und Klassen', (t) => {
  if (NO_PHP) return t.skip('php nicht installiert');
  assert.deepEqual(php('[traffic_median([]), traffic_median([5,1,3]), traffic_median([4,1,3,2])]'), [null, 3, 2.5]);
  assert.deepEqual(php('array_column(traffic_buckets([0,119,120,599,600,1800,1801]), "n")'), [2, 2, 2, 1]);
});

test('Schema und Datenschutz: keine IP-Spalte, Aufräumen nach 90 Tagen, Salz in meta, Spalte stat_id am Konto', () => {
  const lib = read('api/lib/track.php');
  assert.doesNotMatch(lib, /\bip\s+VARCHAR|remote_addr\s+VARCHAR/i, 'keine Spalte für die IP');
  assert.match(lib, /const FL_TRACK_KEEP_DAYS = 90;/);
  assert.match(lib, /'track_salt'/);
  assert.match(lib, /GET_LOCK\('fl_track_daily', 0\)/);
  assert.match(read('api/lib/konto.php'), /fl_add_user_column\(\$pdo, 'stat_id', 'CHAR\(36\) NULL'\)/);
  assert.match(read('api/admin.php'), /track_forget\(\$pdo, \$row\['stat_id'\]\)/, 'Löschen des Kontos löscht seine Statistik');
  const idx = read('index.php');
  assert.match(idx, /readfile\(__DIR__ \. '\/index\.html'\)/);
  assert.match(idx, /catch \(Throwable \$e\)/, 'Fehler der Zählung halten das Spiel nicht auf');
  assert.match(read('.htaccess'), /^DirectoryIndex index\.php index\.html$/m);
});
