<?php
// Besucherstatistik (Regeln: docs/prd/statistik.md): Tabellen, Grenzwerte, Tagessalz, Aufräumen und die reinen Prüf-Funktionen
// für api/track.php, index.php und die Auswertung im Admin-Panel (api/lib/traffic.php). Nur per require_once geladen.
//
// Datenschutz: Die IP wird nie gespeichert. Besucher je Tag = HMAC-SHA256(IP + User-Agent) mit einem Salz, das jeden Tag neu
// entsteht und das alte ersetzt (Tabelle meta, Schlüssel track_salt). Eine Spieler-ID (pid) gibt es nur mit Einwilligung.

const FL_TRACK_SCHEMA = [
    'CREATE TABLE IF NOT EXISTS meta (
            k VARCHAR(32) NOT NULL PRIMARY KEY,
            v TEXT NOT NULL
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    // Rohereignisse (FL_TRACK_KEEP_DAYS Tage). visitor: Tages-Hash; pid nur mit Einwilligung; sid/gid: Zufall im Speicher des Browsers
    // (Seitenaufruf bzw. Partie), nie auf dem Gerät gespeichert.
    'CREATE TABLE IF NOT EXISTS tr_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            day DATE NOT NULL,
            ts BIGINT NOT NULL,
            kind VARCHAR(8) NOT NULL,
            visitor CHAR(16) NOT NULL,
            pid CHAR(36) NULL,
            sid CHAR(16) NULL,
            gid CHAR(16) NULL,
            page VARCHAR(8) NOT NULL,
            version VARCHAR(16) NULL,
            device VARCHAR(8) NOT NULL,
            browser VARCHAR(10) NOT NULL,
            data VARCHAR(700) NULL,
            INDEX idx_tr_day (day),
            INDEX idx_tr_pid (pid)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    // Tagessummen, bleiben nach dem Aufräumen der Rohereignisse (JSON je Tag).
    'CREATE TABLE IF NOT EXISTS tr_daily (
            day DATE NOT NULL PRIMARY KEY,
            data TEXT NOT NULL
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    // Tage, an denen ein Spieler mit Einwilligung aktiv war (Wiederkehr D1/D7/D30). Bleibt bis zum Widerruf.
    'CREATE TABLE IF NOT EXISTS tr_player_days (
            pid CHAR(36) NOT NULL,
            day DATE NOT NULL,
            PRIMARY KEY (pid, day)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    // JavaScript-Fehler, gruppiert nach Signatur (Meldung, Datei, Zeile).
    'CREATE TABLE IF NOT EXISTS tr_errors (
            sig CHAR(16) NOT NULL PRIMARY KEY,
            message VARCHAR(300) NOT NULL,
            file VARCHAR(200) NOT NULL,
            line INT NOT NULL,
            n INT NOT NULL,
            first_at BIGINT NOT NULL,
            last_at BIGINT NOT NULL,
            last_version VARCHAR(16) NULL,
            page VARCHAR(8) NOT NULL
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS tr_feedback (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            created_at BIGINT NOT NULL,
            text TEXT NOT NULL,
            thumb TINYINT NULL,
            version VARCHAR(16) NULL,
            duration INT NULL,
            mode VARCHAR(12) NULL,
            place VARCHAR(8) NULL,
            pid CHAR(36) NULL,
            device VARCHAR(8) NOT NULL,
            browser VARCHAR(10) NOT NULL,
            done TINYINT NOT NULL DEFAULT 0,
            INDEX idx_fb_created (created_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    // Drossel: Ereignisse je Tages-Hash und Tag (ein Tag Aufbewahrung).
    'CREATE TABLE IF NOT EXISTS tr_limits (
            visitor CHAR(16) NOT NULL,
            day DATE NOT NULL,
            n INT NOT NULL,
            PRIMARY KEY (visitor, day)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];

const FL_TRACK_KEEP_DAYS = 90;        // Rohereignisse und Fehlergruppen (nach dem letzten Auftreten) so lange
const FL_TRACK_BODY_MAX = 16384;      // Byte je Anfrage
const FL_TRACK_BATCH_MAX = 50;        // Ereignisse je Anfrage
const FL_TRACK_DAY_MAX = 600;         // Ereignisse je Tages-Hash und Tag, darüber wird verworfen
const FL_TRACK_FEEDBACK_DAY = 10;     // Rückmeldungen je Tages-Hash und Tag
const FL_TRACK_FEEDBACK_MAX = 1000;   // Zeichen je Rückmeldung
const FL_TRACK_AGE_MAX = 604800;      // Ereignisse aus der Offline-Warteschlange höchstens so alt (s, 7 Tage)
const FL_TRACK_KINDS = ['view', 'menu', 'start', 'beat', 'end', 'help', 'error'];
const FL_TRACK_PAGES = ['game', 'editor'];

// ---- Reine Funktionen (ohne Datenbank, test/trackphp.test.js) -----------------------------------------------

// Bots und Werkzeuge am User-Agent erkennen; ein leerer User-Agent zählt als Bot.
function track_is_bot($ua) {
    $ua = (string) $ua;
    if (trim($ua) === '') return true;
    return preg_match('/bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|httpclient|phantom|selenium|puppeteer|playwright|scrapy|facebookexternalhit|monitor|uptime/i', $ua) === 1;
}

// Geräteklasse grob aus dem User-Agent: mobile, tablet oder desktop (iPads mit Desktop-UA zählen als desktop).
function track_device($ua) {
    $ua = (string) $ua;
    if (preg_match('/iPad|Tablet|PlayBook|Silk|Kindle/i', $ua) || (stripos($ua, 'Android') !== false && stripos($ua, 'Mobile') === false)) return 'tablet';
    if (preg_match('/Mobi|iPhone|iPod|Android|Windows Phone/i', $ua)) return 'mobile';
    return 'desktop';
}

// Browser-Familie aus dem User-Agent (Reihenfolge wichtig: Edge und Opera tragen auch „Chrome“).
function track_browser($ua) {
    $ua = (string) $ua;
    if (strpos($ua, 'Edg') !== false) return 'edge';
    if (strpos($ua, 'OPR/') !== false || strpos($ua, 'Opera') !== false) return 'opera';
    if (strpos($ua, 'SamsungBrowser') !== false) return 'samsung';
    if (strpos($ua, 'Firefox') !== false || strpos($ua, 'FxiOS') !== false) return 'firefox';
    if (strpos($ua, 'Chrome') !== false || strpos($ua, 'CriOS') !== false || strpos($ua, 'Chromium') !== false) return 'chrome';
    if (strpos($ua, 'Safari') !== false) return 'safari';
    return 'other';
}

// Tages-Hash eines Besuchers (16 Hex-Zeichen). Die IP geht nur hier ein und wird nirgends gespeichert.
function track_visitor($ip, $ua, $salt) {
    return substr(hash_hmac('sha256', (string) $ip . '|' . (string) $ua, (string) $salt), 0, 16);
}

// Kurzer Text: Steuerzeichen raus, auf $max Zeichen gekürzt.
function track_text($v, $max) {
    if (!is_string($v)) return null;
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v);
    if ($v === null) return null;
    $v = trim($v);
    return mb_substr($v, 0, $max, 'UTF-8');
}

function track_int($v, $min, $max) {
    if (is_float($v) && is_finite($v)) $v = (int) round($v);
    return is_int($v) && $v >= $min && $v <= $max ? $v : null;
}

function track_hex($v, $len) {
    return is_string($v) && preg_match('/^[0-9a-f]{' . (int) $len . '}$/', $v) === 1 ? $v : null;
}

// Spieler-ID (crypto.randomUUID, klein geschrieben) oder null.
function track_pid($v) {
    return is_string($v) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $v) === 1 ? $v : null;
}

function track_version($v) {
    return is_string($v) && preg_match('/^v\d{1,3}\.\d{1,4}$/', $v) === 1 ? $v : null;
}

// Daten eines Ereignisses nach Art prüfen: nur bekannte Felder, Typ und Bereich. Liefert das bereinigte Array (kann leer sein)
// oder null, wenn das Ereignis als Ganzes ungültig ist (unbekannte Art, Fehler ohne Meldung).
function track_event_data($kind, $d) {
    $d = is_array($d) ? $d : [];
    $bool = fn($k) => isset($d[$k]) && is_bool($d[$k]) ? $d[$k] : null;
    $enum = fn($k, $list) => isset($d[$k]) && in_array($d[$k], $list, true) ? $d[$k] : null;
    switch ($kind) {
        case 'view':
        case 'menu':
            return [];
        case 'help':
            return ['part' => isset($d['part']) && is_string($d['part']) && preg_match('/^[a-z]{1,12}$/', $d['part']) ? $d['part'] : null];
        case 'start':
            $diffs = [];
            if (isset($d['diffs']) && is_array($d['diffs'])) {
                foreach (array_slice($d['diffs'], 0, 3) as $x) if (in_array($x, ['easy', 'normal', 'hard'], true)) $diffs[] = $x;
            }
            $map = isset($d['map']) && is_string($d['map']) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $d['map']) ? $d['map'] : null;
            return [
                'mode' => $enum('mode', ['conquest', 'classic']),
                'opp' => track_int($d['opp'] ?? null, 1, 3),
                'diffs' => $diffs,
                'map' => $map,
                'weather' => isset($d['weather']) && is_string($d['weather']) && preg_match('/^[a-z]{1,12}$/', $d['weather']) ? $d['weather'] : null,
                'research' => $bool('research'),
                'river' => $bool('river'),
                'build' => $bool('build'),
                'rated' => $bool('rated'),
                'resumed' => $bool('resumed'),
            ];
        case 'beat':
            return ['m' => track_int($d['m'] ?? null, 0, 100000)];
        case 'end':
            return [
                'r' => $enum('r', ['win', 'loss', 'quit', 'close']),
                'dur' => track_int($d['dur'] ?? null, 0, 86400),
                'm' => track_int($d['m'] ?? null, 0, 100000),
            ];
        case 'error':
            $msg = track_text($d['msg'] ?? null, 300);
            if ($msg === null || $msg === '') return null;
            $file = track_text($d['file'] ?? '', 200);
            return ['msg' => $msg, 'file' => $file === null ? '' : $file, 'line' => track_int($d['line'] ?? 0, 0, 10000000) ?? 0];
    }
    return null;
}

// Eine Anfrage mit Ereignissen prüfen. $body: dekodiertes JSON {v, s, p, pg, e: [{k, a, g?, d?}]}.
// Liefert ['version', 'sid', 'pid', 'page', 'events' => [['kind', 'age', 'gid', 'data']]] oder null bei ungültiger Anfrage.
// Ungültige einzelne Ereignisse fallen weg; mehr als FL_TRACK_BATCH_MAX werden abgeschnitten.
function track_clean_batch($body) {
    if (!is_array($body) || !isset($body['e']) || !is_array($body['e'])) return null;
    $page = isset($body['pg']) && in_array($body['pg'], FL_TRACK_PAGES, true) ? $body['pg'] : null;
    if ($page === null) return null;
    $events = [];
    foreach (array_slice($body['e'], 0, FL_TRACK_BATCH_MAX) as $e) {
        if (!is_array($e) || !isset($e['k']) || !in_array($e['k'], FL_TRACK_KINDS, true)) continue;
        $age = track_int($e['a'] ?? 0, 0, FL_TRACK_AGE_MAX);
        if ($age === null) continue;
        $data = track_event_data($e['k'], $e['d'] ?? []);
        if ($data === null) continue;
        $events[] = ['kind' => $e['k'], 'age' => $age, 'gid' => track_hex($e['g'] ?? null, 16), 'data' => $data];
    }
    return [
        'version' => track_version($body['v'] ?? null),
        'sid' => track_hex($body['s'] ?? null, 16),
        'pid' => track_pid($body['p'] ?? null),
        'page' => $page,
        'events' => $events,
    ];
}

// Rückmeldung prüfen: {text, thumb (1, -1 oder null), v, dur, mode, place ('pause' | 'end'), p}. null, wenn der Text leer ist und
// kein Daumen gesetzt (eine reine Bewertung ohne Text ist erlaubt).
function track_clean_feedback($body) {
    if (!is_array($body)) return null;
    $text = track_text($body['text'] ?? '', FL_TRACK_FEEDBACK_MAX) ?? '';
    $thumb = isset($body['thumb']) && in_array($body['thumb'], [1, -1], true) ? $body['thumb'] : null;
    if ($text === '' && $thumb === null) return null;
    return [
        'text' => $text,
        'thumb' => $thumb,
        'version' => track_version($body['v'] ?? null),
        'duration' => track_int($body['dur'] ?? null, 0, 86400),
        'mode' => isset($body['mode']) && in_array($body['mode'], ['conquest', 'classic'], true) ? $body['mode'] : null,
        'place' => isset($body['place']) && in_array($body['place'], ['pause', 'end', 'menu'], true) ? $body['place'] : null,
        'pid' => track_pid($body['p'] ?? null),
    ];
}

// Signatur einer Fehlermeldung: Zahlen in der Meldung zählen nicht (gleicher Fehler mit anderer id ist eine Gruppe).
function track_error_sig($msg, $file, $line) {
    $norm = preg_replace('/\d+/', '#', (string) $msg);
    return substr(hash('sha256', $norm . '|' . $file . '|' . (int) $line), 0, 16);
}

// Tag (Y-m-d, Ortszeit des Servers) eines Zeitpunkts.
function track_day($ts) {
    return date('Y-m-d', (int) $ts);
}

// ---- Datenbank --------------------------------------------------------------------------------------------

// Verbindung mit den Tabellen der Statistik; $soft wie bei fl_db (null statt Fehlerantwort). Räumt einmal am Tag auf.
function track_db($soft = false) {
    $pdo = fl_db(FL_TRACK_SCHEMA, $soft);
    if ($pdo !== null) track_daily($pdo);
    return $pdo;
}

// Salz des heutigen Tages. Ist das gespeicherte von gestern, wird es ersetzt (Vergleich und Tausch in einem UPDATE, damit
// gleichzeitige Anfragen dasselbe Salz bekommen). Das alte Salz ist danach weg: alte Tages-Hashes lassen sich nicht mehr bilden.
function track_salt(PDO $pdo, $today = null) {
    static $cache = [];
    $today = $today ?? track_day(time());
    if (isset($cache[$today])) return $cache[$today];
    $read = function () use ($pdo) {
        $st = $pdo->prepare("SELECT v FROM meta WHERE k = 'track_salt'");
        $st->execute();
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    };
    $raw = $read();
    $cur = $raw === null ? null : json_decode($raw, true);
    if (!is_array($cur) || ($cur['day'] ?? '') !== $today || !is_string($cur['salt'] ?? null)) {
        $new = json_encode(['day' => $today, 'salt' => bin2hex(random_bytes(32))]);
        if ($raw === null) {
            $pdo->prepare("INSERT IGNORE INTO meta (k, v) VALUES ('track_salt', :v)")->execute([':v' => $new]);
        } else {
            $pdo->prepare("UPDATE meta SET v = :n WHERE k = 'track_salt' AND v = :o")->execute([':n' => $new, ':o' => $raw]);
        }
        $cur = json_decode((string) $read(), true);
    }
    if (!is_array($cur) || ($cur['day'] ?? '') !== $today) throw new RuntimeException('Tagessalz nicht lesbar'); // kein fail(): index.php muss weiterlaufen
    $cache[$today] = $cur['salt'];
    return $cur['salt'];
}

// Herkunft der Anfrage als Besucher: Tages-Hash, Gerät, Browser. null bei Bots.
function track_who(PDO $pdo) {
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
    if (track_is_bot($ua)) return null;
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    return [
        'visitor' => track_visitor($ip, $ua, track_salt($pdo)),
        'device' => track_device($ua),
        'browser' => track_browser($ua),
    ];
}

// Drossel: $n Ereignisse für den Besucher heute anmelden. false, wenn er damit über $max käme (dann zählt nichts).
function track_allow(PDO $pdo, $visitor, $n, $max = FL_TRACK_DAY_MAX) {
    $day = track_day(time());
    $st = $pdo->prepare('SELECT n FROM tr_limits WHERE visitor = :v AND day = :d');
    $st->execute([':v' => $visitor, ':d' => $day]);
    $have = (int) $st->fetchColumn();
    if ($have + $n > $max) return false;
    $pdo->prepare('INSERT INTO tr_limits (visitor, day, n) VALUES (:v, :d, :n) ON DUPLICATE KEY UPDATE n = n + VALUES(n)')
        ->execute([':v' => $visitor, ':d' => $day, ':n' => $n]);
    return true;
}

// Ereignisse speichern (bereinigte Anfrage aus track_clean_batch). Fehler gehen in tr_errors, nicht in tr_events.
// Spieler mit Einwilligung: ihr Tag kommt nach tr_player_days.
function track_store(PDO $pdo, array $who, array $batch, $now = null) {
    $now = $now ?? time();
    $ins = $pdo->prepare('INSERT INTO tr_events (day, ts, kind, visitor, pid, sid, gid, page, version, device, browser, data)
        VALUES (:day, :ts, :kind, :visitor, :pid, :sid, :gid, :page, :version, :device, :browser, :data)');
    $err = $pdo->prepare('INSERT INTO tr_errors (sig, message, file, line, n, first_at, last_at, last_version, page)
        VALUES (:sig, :m, :f, :l, 1, :t, :t2, :v, :p)
        ON DUPLICATE KEY UPDATE n = n + 1, last_at = GREATEST(last_at, VALUES(last_at)), last_version = COALESCE(VALUES(last_version), last_version)');
    $days = [];
    foreach ($batch['events'] as $e) {
        $ts = $now - $e['age'];
        $day = track_day($ts);
        if ($e['kind'] === 'error') {
            $d = $e['data'];
            $err->execute([
                ':sig' => track_error_sig($d['msg'], $d['file'], $d['line']), ':m' => $d['msg'], ':f' => $d['file'], ':l' => $d['line'],
                ':t' => $ts, ':t2' => $ts, ':v' => $batch['version'], ':p' => $batch['page'],
            ]);
            continue;
        }
        $data = $e['data'] ? json_encode($e['data'], JSON_UNESCAPED_SLASHES) : null;
        $ins->execute([
            ':day' => $day, ':ts' => $ts, ':kind' => $e['kind'], ':visitor' => $who['visitor'], ':pid' => $batch['pid'],
            ':sid' => $batch['sid'], ':gid' => $e['gid'], ':page' => $batch['page'], ':version' => $batch['version'],
            ':device' => $who['device'], ':browser' => $who['browser'], ':data' => $data,
        ]);
        $days[$day] = true;
    }
    if ($batch['pid'] !== null) {
        $pd = $pdo->prepare('INSERT IGNORE INTO tr_player_days (pid, day) VALUES (:p, :d)');
        foreach (array_keys($days) as $day) $pd->execute([':p' => $batch['pid'], ':d' => $day]);
    }
}

// Widerruf oder gelöschtes Konto: alles zur Spieler-ID löschen (Ereignisse, Tage, Bezug in Rückmeldungen, Konto-Spalte).
function track_forget(PDO $pdo, $pid) {
    if (track_pid($pid) === null) return;
    $pdo->prepare('DELETE FROM tr_events WHERE pid = :p')->execute([':p' => $pid]);
    $pdo->prepare('DELETE FROM tr_player_days WHERE pid = :p')->execute([':p' => $pid]);
    $pdo->prepare('UPDATE tr_feedback SET pid = NULL WHERE pid = :p')->execute([':p' => $pid]);
    if (track_has_column($pdo, 'users', 'stat_id')) {
        $pdo->prepare('UPDATE users SET stat_id = NULL WHERE stat_id = :p')->execute([':p' => $pid]);
    }
}

function track_has_column(PDO $pdo, $table, $col) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c');
    $st->execute([':t' => $table, ':c' => $col]);
    return (int) $st->fetchColumn() > 0;
}

// Aufräumen ohne Cron: bei der ersten Anfrage eines Tages (meta track_day). Nur eine Anfrage räumt (GET_LOCK ohne Warten).
// 1. Tage vor der Frist in tr_daily zusammenfassen (traffic_summary), 2. Rohereignisse vor der Frist löschen,
// 3. Fehlergruppen, die seit der Frist nicht mehr auftraten, löschen, 4. Drosselzähler von gestern und älter löschen.
function track_daily(PDO $pdo, $now = null) {
    $now = $now ?? time();
    $today = track_day($now);
    $st = $pdo->prepare("SELECT v FROM meta WHERE k = 'track_day'");
    $st->execute();
    if ($st->fetchColumn() === $today) return false;
    $lock = $pdo->query("SELECT GET_LOCK('fl_track_daily', 0)")->fetchColumn();
    if ((int) $lock !== 1) return false;
    try {
        $st->execute();
        if ($st->fetchColumn() === $today) return false;
        track_salt($pdo, $today); // neues Salz, das alte ist weg
        $cut = date('Y-m-d', strtotime($today . ' -' . FL_TRACK_KEEP_DAYS . ' days'));
        require_once __DIR__ . '/traffic.php';
        $old = $pdo->prepare('SELECT DISTINCT day FROM tr_events WHERE day < :c ORDER BY day');
        $old->execute([':c' => $cut]);
        foreach ($old->fetchAll(PDO::FETCH_COLUMN) as $day) {
            $rows = traffic_rows($pdo, $day, $day);
            $sum = traffic_summary($rows, $day);
            $pdo->prepare('INSERT INTO tr_daily (day, data) VALUES (:d, :j) ON DUPLICATE KEY UPDATE data = VALUES(data)')
                ->execute([':d' => $day, ':j' => json_encode($sum)]);
        }
        $pdo->prepare('DELETE FROM tr_events WHERE day < :c')->execute([':c' => $cut]);
        $pdo->prepare('DELETE FROM tr_errors WHERE last_at < :t')->execute([':t' => $now - FL_TRACK_KEEP_DAYS * 86400]);
        $pdo->prepare('DELETE FROM tr_limits WHERE day < :d')->execute([':d' => $today]);
        $pdo->prepare("INSERT INTO meta (k, v) VALUES ('track_day', :d) ON DUPLICATE KEY UPDATE v = VALUES(v)")->execute([':d' => $today]);
        return true;
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('fl_track_daily')");
    }
}
