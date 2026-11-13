<?php
// Frontline Admin-API (ADM1, Regeln: docs/prd/konto.md „Admin-Panel“): Benutzerverwaltung für Daniel. Oberfläche: /frontline/admin/.
// Aktion im JSON-Feld action, Antwort immer JSON (Fehler: {"error": "…"} mit HTTP-Code):
//   POST admin.php {"action":"login","user":"…","password":"…"}   → {"ok":true,"user":"…"}; setzt Cookie fl_admin (8 h)
//   POST admin.php {"action":"logout"}                             → {"ok":true}; beendet die Admin-Sitzung
//   POST admin.php {"action":"me"}                                 → {"ok":true,"user":"…"}
//   POST admin.php {"action":"users"}                              → {"users":[{id,email,nickname,createdAt,verifiedAt,lastLogin,plan,premiumUntil,blocked,active,saves,games,wallet}],"walletMax":N}
//   POST admin.php {"action":"stats"}                              → Gesamtübersicht (seit v5.158): Konten, aktive, Partien, Geld, perDay (30 Tage), perUser (Spiele je Konto)
//   POST admin.php {"action":"approve","id":N}                     → {"ok":true}: E-Mail gilt als bestätigt, offene Bestätigungslinks entfallen
//   POST admin.php {"action":"block"|"unblock","id":N}             → {"ok":true}; Sperre: Anmelden 403, bestehende Sitzungen enden
//   POST admin.php {"action":"activate","id":N}                    → {"ok":true}: reaktiviert ein selbst deaktiviertes Konto (KO4)
//   POST admin.php {"action":"plan","id":N,"plan":"free"|"premium","premiumUntil":Sekunden|null,"note":"…"|null} → {"ok":true}; schreibt die Premium-Historie
//   POST admin.php {"action":"premiumhistory","id":N}              → {"history":[{plan,premiumUntil,note,createdAt,changedBy}]} (neueste zuerst)
//   POST admin.php {"action":"setwallet","id":N,"value":Zahl}      → {"ok":true}: Kasse des Kontos setzen (0 bis walletMax, KA1)
//   POST admin.php {"action":"delete","id":N}                      → {"ok":true,"saves":n}: Konto, Sitzungen, Links, Spielstände, Partien und Premium-Historie gelöscht
// Fehler: 400 Anfrage, 401 nicht angemeldet (oder Anmeldung falsch bei login → 401 mit eigener Meldung), 404 Konto fehlt, 405 Methode,
//         429 zu viele Fehlversuche (5 je IP in 15 min), 500 Server/Datenbank, 503 „Admin nicht eingerichtet“.
// Zugang: admin_user und admin_pass_hash in api/config.php (der Deploy schreibt sie aus den Secrets ADMIN_USER und ADMIN_PASSWORD;
// der Hash mit password_hash). Ohne sie antwortet jede Aktion mit 503. Passwort höchstens 72 Byte (wie bei den Konten).
// Sitzung: Tabelle admin_sessions, nur der SHA-256 des Cookie-Werts in der Datenbank. Die Cookie-Attribute stehen in admin_set_cookie().

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/konto.php';
require_once __DIR__ . '/lib/match.php';

const FL_PATH = '/frontline/';          // Pfad des Spiels auf dem Webspace (Cookie fl_admin)
const FL_ADMIN_HOURS = 8;               // Admin-Sitzung
const FL_ADMIN_MAX = 5;                 // Fehlversuche beim Anmelden je IP …
const FL_ADMIN_WINDOW = 900;            // … in Sekunden (15 min)
const FL_ADMIN_PASS_MAX = 72;           // Byte: bcrypt liest nur die ersten 72
const FL_ADMIN_SCHEMA = [
    'CREATE TABLE IF NOT EXISTS admin_sessions (
            hash CHAR(64) NOT NULL PRIMARY KEY,
            created_at BIGINT NOT NULL,
            expires_at BIGINT NOT NULL
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];

fl_cors('GET, POST, OPTIONS', true);
fl_exception_handler('Serverfehler im Admin-Bereich');
fl_check_origin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');
$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) fail(400, 'Ungültige Anfrage');

$cfg = admin_config();
$pdo = fl_db(array_merge(FL_SCHEMA, FL_ADMIN_SCHEMA, FL_MATCH_SCHEMA));
fl_konto_upgrade($pdo);
$action = $body['action'];

if ($action === 'login') admin_login($pdo, $cfg, $body); // antwortet selbst

// Alle übrigen Aktionen nur mit gültiger Admin-Sitzung.
if (!admin_session_ok($pdo)) fail(401, 'Nicht angemeldet');

switch ($action) {
    case 'logout': admin_logout($pdo); break;
    case 'me': out(['ok' => true, 'user' => $cfg['user']]);
    case 'users': admin_users($pdo); break;
    case 'stats': admin_stats($pdo); break;
    case 'approve': admin_approve($pdo, $body); break;
    case 'block': admin_block($pdo, $body, true); break;
    case 'unblock': admin_block($pdo, $body, false); break;
    case 'activate': admin_activate($pdo, $body); break;
    case 'plan': admin_plan($pdo, $body); break;
    case 'premiumhistory': admin_premium_history($pdo, $body); break;
    case 'setwallet': admin_setwallet($pdo, $body); break;
    case 'delete': admin_delete($pdo, $body); break;
    default: fail(400, 'Unbekannte Aktion');
}
out(['ok' => true]);

// ---- Zugang ---------------------------------------------------------------------------------------------

// Admin-Zugang aus api/config.php. Fehlt er, antwortet die Schnittstelle mit 503 (vor jeder Datenbankarbeit).
function admin_config() {
    $cfg = fl_config();
    $user = is_array($cfg) && isset($cfg['admin_user']) ? trim((string) $cfg['admin_user']) : '';
    $hash = is_array($cfg) && isset($cfg['admin_pass_hash']) ? (string) $cfg['admin_pass_hash'] : '';
    if ($user === '' || $hash === '') fail(503, 'Admin nicht eingerichtet');
    return ['user' => $user, 'hash' => $hash];
}

// Anmelden: Benutzername und Passwort prüfen, Fehlversuche je IP zählen (Tabelle attempts, Art admin).
function admin_login(PDO $pdo, array $cfg, array $body) {
    $who = admin_who();
    if (admin_fails($pdo, $who) >= FL_ADMIN_MAX) {
        fail(429, 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.');
    }
    $user = isset($body['user']) ? $body['user'] : null;
    $pass = isset($body['password']) ? $body['password'] : null;
    if (!is_string($user) || !is_string($pass) || $pass === '') fail(400, 'Benutzername oder Passwort fehlt');
    // Beide Prüfungen laufen immer durch (gleiche Zeit, ob der Name stimmt oder nicht).
    $okUser = hash_equals($cfg['user'], trim($user));
    $okPass = strlen($pass) <= FL_ADMIN_PASS_MAX && password_verify($pass, $cfg['hash']);
    if (!$okUser || !$okPass) {
        admin_fail_record($pdo, $who);
        fail(401, 'Benutzername oder Passwort falsch.');
    }
    $token = bin2hex(random_bytes(32));
    $now = time();
    $pdo->prepare('DELETE FROM admin_sessions WHERE expires_at < :now')->execute([':now' => $now]);
    $pdo->prepare('INSERT INTO admin_sessions (hash, created_at, expires_at) VALUES (:h, :c, :e)')->execute([
        ':h' => hash('sha256', $token), ':c' => $now, ':e' => $now + FL_ADMIN_HOURS * 3600,
    ]);
    admin_set_cookie($token, $now + FL_ADMIN_HOURS * 3600);
    out(['ok' => true, 'user' => $cfg['user']]);
}

function admin_logout(PDO $pdo) {
    $raw = admin_cookie();
    if ($raw !== '') {
        $pdo->prepare('DELETE FROM admin_sessions WHERE hash = :h')->execute([':h' => hash('sha256', $raw)]);
    }
    admin_set_cookie('', time() - 3600);
    out(['ok' => true]);
}

// Gültige Admin-Sitzung aus dem Cookie? Abgelaufene zählen nicht.
function admin_session_ok(PDO $pdo) {
    $raw = admin_cookie();
    if ($raw === '') return false;
    $st = $pdo->prepare('SELECT 1 FROM admin_sessions WHERE hash = :h AND expires_at > :now');
    $st->execute([':h' => hash('sha256', $raw), ':now' => time()]);
    return $st->fetchColumn() !== false;
}

function admin_cookie() {
    $raw = isset($_COOKIE['fl_admin']) ? (string) $_COOKIE['fl_admin'] : '';
    return fl_is_token($raw) ? $raw : '';
}

// Cookie fl_admin: HttpOnly, Secure, SameSite=Strict (kein Versand aus fremden Seiten), Pfad des Spiels, 8 h.
function admin_set_cookie($value, $expires) {
    setcookie('fl_admin', $value, [
        'expires' => $expires, 'path' => FL_PATH, 'secure' => true, 'httponly' => true, 'samesite' => 'Strict',
    ]);
}

// Bremse: Fehlversuche je IP. HMAC mit dem Datenbankpasswort als Schlüssel (wie fl_who in auth.php), Art „admin“.
function admin_who() {
    $cfg = fl_config();
    $key = is_array($cfg) && isset($cfg['password']) ? (string) $cfg['password'] : '';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    return hash_hmac('sha256', 'admin:' . $ip, $key);
}

function admin_fails(PDO $pdo, $who) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM attempts WHERE who_hash = :w AND kind = :k AND created_at > :since');
    $st->execute([':w' => $who, ':k' => 'admin', ':since' => time() - FL_ADMIN_WINDOW]);
    return (int) $st->fetchColumn();
}

function admin_fail_record(PDO $pdo, $who) {
    $now = time();
    $pdo->prepare('DELETE FROM attempts WHERE created_at < :old')->execute([':old' => $now - 86400]);
    $pdo->prepare('INSERT INTO attempts (who_hash, kind, created_at) VALUES (:w, :k, :t)')->execute([
        ':w' => $who, ':k' => 'admin', ':t' => $now,
    ]);
}

// ---- Konten ---------------------------------------------------------------------------------------------

// Liste aller Konten, neueste zuerst. Spielstände zählt die Tabelle saves (fehlt sie, gibt es noch keine), Partien die Tabelle
// matches (seit v5.158). Zählungen als Unterabfragen, damit sich die Zeilen nicht vervielfachen.
function admin_users(PDO $pdo) {
    $saves = admin_has_table($pdo, 'saves') ? '(SELECT COUNT(*) FROM saves s WHERE s.user_id = u.id)' : '0';
    $sql = "SELECT u.id, u.email, u.nickname, u.created_at, u.verified_at, u.last_login, u.plan, u.premium_until, u.blocked, u.active,
                u.wallet, $saves AS saves,
                (SELECT COUNT(*) FROM matches m WHERE m.user_id = u.id) AS games
            FROM users u ORDER BY u.created_at DESC, u.id DESC";
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $list = [];
    foreach ($rows as $r) {
        $list[] = [
            'id' => (int) $r['id'],
            'email' => $r['email'],
            'createdAt' => (int) $r['created_at'],
            'verifiedAt' => $r['verified_at'] === null ? null : (int) $r['verified_at'],
            'lastLogin' => $r['last_login'] === null ? null : (int) $r['last_login'],
            'plan' => $r['plan'],
            'premiumUntil' => $r['premium_until'] === null ? null : (int) $r['premium_until'],
            'nickname' => $r['nickname'] !== null && $r['nickname'] !== '' ? $r['nickname'] : null,
            'blocked' => (int) $r['blocked'] === 1,
            'active' => (int) $r['active'] === 1,
            'saves' => (int) $r['saves'],
            'games' => (int) $r['games'],
            'wallet' => (int) $r['wallet'],
        ];
    }
    out(['users' => $list, 'walletMax' => FL_WALLET_MAX]);
}

// Gesamtübersicht (seit v5.158, Regeln: docs/prd/konto.md „Admin-Übersicht“). Aktiv = angemeldet oder eine gewertete Partie
// im Zeitraum. playing = Konten mit mindestens einer gewerteten Partie; avgGamesPerPlayer = Partien / playing.
// perDay: die letzten 30 Tage (Ortszeit des Servers), älteste zuerst, auch Tage ohne Partie.
function admin_stats(PDO $pdo) {
    $now = time();
    $week = $now - 7 * 86400;
    $month = $now - 30 * 86400;
    $one = function ($sql, $params = []) use ($pdo) {
        $st = $pdo->prepare($sql);
        $st->execute($params);
        return $st->fetchColumn();
    };
    $players = (int) $one('SELECT COUNT(*) FROM users');
    $playing = (int) $one('SELECT COUNT(DISTINCT user_id) FROM matches');
    $games = (int) $one('SELECT COUNT(*) FROM matches');
    // Aktiv: angemeldet (last_login) oder eine gewertete Partie seit $since. Zwei getrennte Platzhalter, weil PDO mit
    // echten Prepared Statements keinen Namen zweimal erlaubt.
    $activeSince = fn($since) => (int) $one(
        'SELECT COUNT(*) FROM users u WHERE u.last_login >= :a OR EXISTS (SELECT 1 FROM matches m WHERE m.user_id = u.id AND m.finished_at >= :b)',
        [':a' => $since, ':b' => $since],
    );

    // Tage: 30 Kalendertage bis heute, Schlüssel Datum (Ortszeit)
    $start = mktime(0, 0, 0, (int) date('n', $now), (int) date('j', $now) - 29, (int) date('Y', $now));
    $days = [];
    for ($i = 0; $i < 30; $i++) $days[date('Y-m-d', $start + $i * 86400 + 43200)] = 0; // Mittag: DST-sicher
    $st = $pdo->prepare('SELECT finished_at FROM matches WHERE finished_at >= :s');
    $st->execute([':s' => $start]);
    while (($t = $st->fetchColumn()) !== false) {
        $key = date('Y-m-d', (int) $t);
        if (isset($days[$key])) $days[$key]++;
    }
    $perDay = [];
    foreach ($days as $day => $n) $perDay[] = ['day' => $day, 'games' => $n];

    $sum = $pdo->query('SELECT COALESCE(SUM(earned), 0) AS total, AVG(earned) AS avg_earned FROM matches')->fetch(PDO::FETCH_ASSOC);

    $st = $pdo->query('SELECT u.id, u.email, u.wallet, COALESCE(g.games, 0) AS games, COALESCE(g.wins, 0) AS wins,
            COALESCE(g.losses, 0) AS losses, COALESCE(g.total, 0) AS total, g.avg_earned, g.last_game
        FROM users u LEFT JOIN (
            SELECT user_id, COUNT(*) AS games, SUM(result = \'win\') AS wins, SUM(result = \'loss\') AS losses,
                SUM(earned) AS total, AVG(earned) AS avg_earned, MAX(finished_at) AS last_game
            FROM matches GROUP BY user_id
        ) g ON g.user_id = u.id
        ORDER BY games DESC, u.id');
    $perUser = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $perUser[] = [
            'id' => (int) $r['id'],
            'email' => $r['email'],
            'games' => (int) $r['games'],
            'wins' => (int) $r['wins'],
            'losses' => (int) $r['losses'],
            'totalEarned' => (int) $r['total'],
            'avgEarned' => $r['avg_earned'] === null ? null : round((float) $r['avg_earned'], 1),
            'lastGame' => $r['last_game'] === null ? null : (int) $r['last_game'],
            'wallet' => (int) $r['wallet'],
        ];
    }

    out([
        'users' => $players,
        'verified' => (int) $one('SELECT COUNT(*) FROM users WHERE verified_at IS NOT NULL'),
        'blocked' => (int) $one('SELECT COUNT(*) FROM users WHERE blocked = 1'),
        'activeLast7d' => $activeSince($week),
        'activeLast30d' => $activeSince($month),
        'playing' => $playing,
        'totalGames' => $games,
        'gamesLast7d' => (int) $one('SELECT COUNT(*) FROM matches WHERE finished_at >= :s', [':s' => $week]),
        'avgGamesPerPlayer' => $playing > 0 ? round($games / $playing, 1) : null,
        'totalEarned' => (int) $sum['total'],
        'avgEarned' => $sum['avg_earned'] === null ? null : round((float) $sum['avg_earned'], 1),
        'perDay' => $perDay,
        'perUser' => $perUser,
    ]);
}

// Freigeben: die E-Mail gilt als bestätigt; offene Bestätigungslinks werden ungültig.
function admin_approve(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $pdo->prepare('UPDATE users SET verified_at = :now WHERE id = :id AND verified_at IS NULL')->execute([
        ':now' => time(), ':id' => $id,
    ]);
    $pdo->prepare("DELETE FROM tokens WHERE user_id = :id AND kind = 'verify'")->execute([':id' => $id]);
}

// Sperren: Anmelden gibt 403, bestehende Sitzungen enden sofort. Entsperren: nur das Flag.
function admin_block(PDO $pdo, array $body, $on) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $pdo->prepare('UPDATE users SET blocked = :b WHERE id = :id')->execute([':b' => $on ? 1 : 0, ':id' => $id]);
    if ($on) $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute([':id' => $id]);
}

// Wieder aktivieren (KO4): ein selbst deaktiviertes Konto kann sich wieder anmelden. Nur das Flag; Sitzungen waren schon beendet.
function admin_activate(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $pdo->prepare('UPDATE users SET active = 1 WHERE id = :id')->execute([':id' => $id]);
}

// Konto-Art: free oder premium. premiumUntil (Sekunden seit 1970) nur bei premium; fehlt es, ist Premium unbefristet.
// Jede Änderung steht in der Premium-Historie (KO4, changed_by 'admin'); note ist ein optionaler Text bis 80 Zeichen.
function admin_plan(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $plan = isset($body['plan']) ? $body['plan'] : null;
    if ($plan !== 'free' && $plan !== 'premium') fail(400, 'plan muss free oder premium sein');
    $until = null;
    if ($plan === 'premium' && isset($body['premiumUntil']) && $body['premiumUntil'] !== null) {
        if (!is_numeric($body['premiumUntil']) || (int) $body['premiumUntil'] < 1) fail(400, 'premiumUntil ungültig');
        $until = (int) $body['premiumUntil'];
    }
    $note = isset($body['note']) && is_string($body['note']) ? trim($body['note']) : '';
    if (mb_strlen($note, 'UTF-8') > 80) fail(400, 'Die Notiz darf höchstens 80 Zeichen lang sein.');
    $pdo->prepare('UPDATE users SET plan = :p, premium_until = :u WHERE id = :id')->execute([
        ':p' => $plan, ':u' => $until, ':id' => $id,
    ]);
    fl_premium_record($pdo, $id, $plan, $until, $note !== '' ? $note : null, 'admin');
}

// Premium-Historie eines Kontos (KO4), neueste zuerst; Form wie in auth.php premiumHistory.
function admin_premium_history(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $st = $pdo->prepare('SELECT plan, premium_until, note, changed_by, created_at FROM premium_history
        WHERE user_id = :id ORDER BY created_at DESC, id DESC LIMIT 50');
    $st->execute([':id' => $id]);
    $list = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $list[] = [
            'plan' => $r['plan'],
            'premiumUntil' => $r['premium_until'] === null ? null : (int) $r['premium_until'],
            'note' => $r['note'],
            'createdAt' => (int) $r['created_at'],
            'changedBy' => $r['changed_by'],
        ];
    }
    out(['history' => $list]);
}

// Kasse setzen (KA1): ausdrücklich von Daniel, daher ohne die Bremse des Browser-Meldens; 0 bis FL_WALLET_MAX, ganze Zahl.
function admin_setwallet(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $value = isset($body['value']) ? $body['value'] : null;
    if (!is_numeric($value) || (float) $value < 0 || (float) $value > FL_WALLET_MAX) {
        fail(400, 'Kasse muss eine Zahl von 0 bis ' . FL_WALLET_MAX . ' sein');
    }
    $pdo->prepare('UPDATE users SET wallet = :w WHERE id = :id')->execute([':w' => (int) floor((float) $value), ':id' => $id]);
}

// Löschen in einer Transaktion: Spielstände, Sitzungen, Links, dann das Konto.
function admin_delete(PDO $pdo, array $body) {
    $id = admin_id($body);
    admin_user_row($pdo, $id);
    $saves = 0;
    $pdo->beginTransaction();
    try {
        if (admin_has_table($pdo, 'saves')) {
            $st = $pdo->prepare('DELETE FROM saves WHERE user_id = :id');
            $st->execute([':id' => $id]);
            $saves = $st->rowCount();
        }
        $pdo->prepare('DELETE FROM matches WHERE user_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM premium_history WHERE user_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM match_tokens WHERE user_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM tokens WHERE user_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $id]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    out(['ok' => true, 'saves' => $saves]);
}

// Die id aus dem Aufruf (ganze Zahl ab 1), sonst 400.
function admin_id(array $body) {
    $id = isset($body['id']) ? $body['id'] : null;
    if (is_string($id) && ctype_digit($id)) $id = (int) $id;
    if (!is_int($id) || $id < 1) fail(400, 'id ungültig');
    return $id;
}

// Eine Konto-Zeile zur id, sonst 404.
function admin_user_row(PDO $pdo, $id) {
    $st = $pdo->prepare('SELECT * FROM users WHERE id = :id');
    $st->execute([':id' => $id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row === false) fail(404, 'Konto nicht gefunden');
    return $row;
}

function admin_has_table(PDO $pdo, $name) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :n');
    $st->execute([':n' => $name]);
    return (int) $st->fetchColumn() > 0;
}
