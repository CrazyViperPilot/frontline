<?php
// Konten, gemeinsam für api/auth.php, api/save.php, api/match.php und api/admin.php (seit KO2): Tabellen, Sitzung aus dem Cookie fl_session,
// Sperre (users.blocked, seit ADM1), Kasse am Konto (users.wallet, seit KA1), Grenze je gewerteter Partie (FL_MATCH_MAX_GAIN, seit MS1),
// Nickname (users.nickname) und Premium-Zeiträume (Tabelle premium_periods, beides seit Paket Konto-Premium).
// Regeln: docs/prd/konto.md. Nur per require_once aus api/*.php geladen; api/lib/ ist per .htaccess gesperrt.

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

// Kasse am Konto (KA1): Startbetrag und Obergrenze. Muss zu js/data/balance.js passen (QUICK.startMoney = 800,
// QUICK.walletMax = 5000); bei einer Änderung dort hier nachziehen. Ein neues Konto und „zurücksetzen“ bekommen FL_WALLET_START.
const FL_WALLET_START = 800;
const FL_WALLET_MAX = 5000;
// Höchster Zuwachs der Kasse je gewerteter Partie (Match-Start, api/match.php): größere Sprünge werden auf Start + diesen Wert gekappt.
const FL_MATCH_MAX_GAIN = 3000;
const FL_PASS_MIN = 8;          // Passwort: Zeichen (Registrierung, Zurücksetzen, Admin-Panel)
const FL_PASS_MAX = 72;         // Byte: bcrypt liest nur die ersten 72, darüber würde still gekürzt
const FL_NICK_MIN = 3;          // Nickname: Zeichen (Paket Konto-Premium, Regel in fl_nickname_normalize)
const FL_NICK_MAX = 20;
const FL_MSG_NICK_TAKEN = 'Nickname ist schon vergeben';

// Tabellen der Konten (legen sich selbst an, idempotent). Zeiten in Sekunden seit 1970.
const FL_SCHEMA = [
    'CREATE TABLE IF NOT EXISTS users (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(254) NOT NULL,
            pass_hash VARCHAR(255) NOT NULL,
            verified_at BIGINT NULL,
            plan VARCHAR(16) NOT NULL DEFAULT \'free\',
            premium_until BIGINT NULL,
            created_at BIGINT NOT NULL,
            last_login BIGINT NULL,
            UNIQUE KEY uq_users_email (email)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS tokens (
            hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            kind ENUM(\'verify\',\'reset\') NOT NULL,
            expires_at BIGINT NOT NULL,
            INDEX idx_tokens_user (user_id, kind)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS sessions (
            hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            created_at BIGINT NOT NULL,
            expires_at BIGINT NOT NULL,
            INDEX idx_sessions_user (user_id)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS attempts (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            who_hash CHAR(64) NOT NULL,
            kind VARCHAR(16) NOT NULL,
            created_at BIGINT NOT NULL,
            INDEX idx_attempts (who_hash, kind, created_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];

// Premium-Zeiträume (Paket Konto-Premium): ein Konto kann mehrere haben, auch unbefristete (ends_at leer). Premium gilt jetzt, wenn ein Zeitraum läuft
// (starts_at <= jetzt und ends_at leer oder später, fl_premium_of). Angelegt von fl_premium_upgrade, nicht über FL_SCHEMA, weil die
// Übernahme des alten Standes nur beim ersten Anlegen geschieht.
const FL_PREMIUM_TABLE = 'CREATE TABLE IF NOT EXISTS premium_periods (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            starts_at BIGINT NOT NULL,
            ends_at BIGINT NULL,
            created_at BIGINT NOT NULL,
            INDEX idx_premium_user (user_id, starts_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

// Sitzungs-Token aus dem Cookie ('' wenn keiner oder kein gültiges Format).
function fl_session_token() {
    $raw = isset($_COOKIE['fl_session']) ? (string) $_COOKIE['fl_session'] : '';
    return fl_is_token($raw) ? $raw : '';
}

function fl_is_token($token) {
    return is_string($token) && preg_match('/^[0-9a-f]{64}$/', $token) === 1;
}

// Nachrüsten (idempotent, einmal je Anfrage): Spalten users.blocked (Sperre im Admin-Panel, docs/prd/konto.md), users.wallet (Kasse am
// Konto, KA1; Bestandskonten bekommen den Startbetrag), users.nickname (Paket Konto-Premium; Bestandskonten bleiben ohne Nickname, NULL) mit dem
// eindeutigen Schlüssel uq_users_nickname, und die Tabelle premium_periods (fl_premium_upgrade). Die Abfrage läuft über
// information_schema, wie fl_saves_upgrade in api/save.php.
function fl_konto_upgrade(PDO $pdo) {
    static $done = false;
    if ($done) return;
    fl_add_user_column($pdo, 'blocked', 'TINYINT NOT NULL DEFAULT 0');
    fl_add_user_column($pdo, 'wallet', 'BIGINT NOT NULL DEFAULT ' . FL_WALLET_START);
    fl_add_user_column($pdo, 'nickname', 'VARCHAR(20) NULL');
    fl_add_user_index($pdo, 'uq_users_nickname', 'nickname');
    fl_premium_upgrade($pdo);
    $done = true;
}

// Spalte users.$name anlegen, wenn sie fehlt. $ddl ist eine feste Angabe aus dem Code, nie Eingabe.
function fl_add_user_column(PDO $pdo, $name, $ddl) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = :c");
    $st->execute([':c' => $name]);
    if ((int) $st->fetchColumn() === 0) {
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN $name $ddl");
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1060) throw $e; // 1060 Spalte gibt es schon (gleichzeitige Anfrage)
        }
    }
}

// Eindeutiger Schlüssel $name auf users.$column, wenn er fehlt. Namen und Spalte sind feste Angaben aus dem Code.
function fl_add_user_index(PDO $pdo, $name, $column) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = :n");
    $st->execute([':n' => $name]);
    if ((int) $st->fetchColumn() === 0) {
        try {
            $pdo->exec("ALTER TABLE users ADD UNIQUE KEY $name ($column)");
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1061) throw $e; // 1061 Schlüssel gibt es schon (gleichzeitige Anfrage)
        }
    }
}

function fl_has_table(PDO $pdo, $name) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :n');
    $st->execute([':n' => $name]);
    return (int) $st->fetchColumn() > 0;
}

// Premium-Zeiträume anlegen, beim ersten Anlegen den alten Stand übernehmen (einmalig, weil es nur dann geschieht): Konten mit
// plan = premium bekommen einen Zeitraum ab jetzt bis premium_until (leer = unbefristet). Ein altes Premium, das schon vor dem
// Anlegen des Kontos endete, wird nicht übernommen; ein früher abgelaufenes beginnt mit dem Konto. Die alten Spalten bleiben stehen.
function fl_premium_upgrade(PDO $pdo) {
    if (fl_has_table($pdo, 'premium_periods')) return;
    $pdo->exec(FL_PREMIUM_TABLE);
    $now = time();
    $st = $pdo->prepare("INSERT INTO premium_periods (user_id, starts_at, ends_at, created_at)
        SELECT u.id,
            CASE WHEN u.premium_until IS NULL OR u.premium_until > :now1 THEN :now2 ELSE u.created_at END,
            u.premium_until,
            :now3
        FROM users u
        WHERE u.plan = 'premium' AND (u.premium_until IS NULL OR u.premium_until > u.created_at)");
    $st->execute([':now1' => $now, ':now2' => $now, ':now3' => $now]);
}

// Premium-Stand eines Konto-Zeitraums JETZT (die eine Stelle für alle Anfragen, seit Paket Konto-Premium). Premium ist, wenn ein Zeitraum läuft.
// Liefert ['premium' => bool, 'until' => int|null (Ende des laufenden Zeitraums; null bei unbefristet oder ohne Premium),
// 'nextStart' => int|null (Beginn des nächsten Zeitraums, der noch nicht begonnen hat)].
function fl_premium_state(PDO $pdo, $uid, $now = null) {
    $st = $pdo->prepare('SELECT starts_at, ends_at FROM premium_periods WHERE user_id = :u');
    $st->execute([':u' => (int) $uid]);
    return fl_premium_of($st->fetchAll(PDO::FETCH_ASSOC), $now ?? time());
}

// Reine Rechnung aus den Zeiträumen ([starts_at, ends_at] je Zeile, ends_at null = unbefristet), ohne Datenbank. Ein Zeitraum läuft,
// wenn starts_at <= $now und ends_at leer oder > $now ist. Mehrere laufende: unbefristet gewinnt, sonst das späteste Ende.
function fl_premium_of(array $periods, $now) {
    $current = false;
    $unlimited = false;
    $until = null;
    $nextStart = null;
    foreach ($periods as $p) {
        $start = (int) $p['starts_at'];
        $end = $p['ends_at'] === null ? null : (int) $p['ends_at'];
        if ($start <= $now && ($end === null || $end > $now)) {
            $current = true;
            if ($end === null) $unlimited = true;
            elseif ($until === null || $end > $until) $until = $end;
        } elseif ($start > $now && ($nextStart === null || $start < $nextStart)) {
            $nextStart = $start;
        }
    }
    return ['premium' => $current, 'until' => $unlimited ? null : $until, 'nextStart' => $nextStart];
}

// Sitzung zu einem Token → Konto (Zeile aus users, mit id) oder null. Abgelaufene Sitzungen zählen nicht,
// gesperrte Konten (blocked = 1) ebenso.
function fl_session_user(PDO $pdo, $token) {
    fl_konto_upgrade($pdo);
    $st = $pdo->prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = :h AND s.expires_at > :now AND u.blocked = 0');
    $st->execute([':h' => hash('sha256', $token), ':now' => time()]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row !== false ? $row : null;
}

// Konto der laufenden Anfrage: Cookie → Sitzung → Konto. null ohne Cookie, bei unbekannter oder abgelaufener Sitzung.
function current_user(PDO $pdo) {
    $token = fl_session_token();
    if ($token === '') return null;
    return fl_session_user($pdo, $token);
}

// ---- Prüfungen (seit Paket Konto-Premium gemeinsam für Anmeldung und Admin-Panel) --------------------------------------------------

function fl_check_email($email) {
    if (!is_string($email)) fail(400, 'E-Mail-Adresse fehlt');
    $email = strtolower(trim($email));
    if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'E-Mail-Adresse ungültig');
    return $email;
}

function fl_check_password($pass) {
    if (!is_string($pass)) fail(400, 'Passwort fehlt');
    if (mb_strlen($pass, 'UTF-8') < FL_PASS_MIN) fail(400, 'Das Passwort muss mindestens 8 Zeichen haben.');
    if (strlen($pass) > FL_PASS_MAX) fail(400, 'Das Passwort darf höchstens 72 Byte lang sein.');
    return $pass;
}

// Nickname (Paket Konto-Premium): 3 bis 20 Zeichen aus Buchstaben, Ziffern, Leerzeichen, _ und -. Am Rand fallen Leerzeichen weg, Folgen werden zu
// einem. Eindeutig ohne Groß- und Kleinschreibung (und ohne Akzente): das besorgt der Vergleich der Tabelle (utf8mb4_unicode_ci) und
// der eindeutige Schlüssel uq_users_nickname. Liefert den Nickname oder null bei ungültiger Eingabe.
function fl_nickname_normalize($value) {
    if (!is_string($value)) return null;
    $nick = preg_replace('/[\p{Z}\s]+/u', ' ', $value); // auch geschütztes Leerzeichen (U+00A0) zählt als Leerzeichen, wie in js/ui/menu.js
    if (!is_string($nick)) return null;
    $nick = trim($nick);
    $len = mb_strlen($nick, 'UTF-8');
    if ($len < FL_NICK_MIN || $len > FL_NICK_MAX) return null;
    return preg_match('/^[\p{L}\p{N}_ -]+$/u', $nick) === 1 ? $nick : null;
}

function fl_check_nickname($value) {
    $nick = fl_nickname_normalize($value);
    if ($nick === null) {
        fail(400, 'Der Nickname muss 3 bis 20 Zeichen lang sein und darf nur Buchstaben, Ziffern, Leerzeichen, _ und - enthalten.');
    }
    return $nick;
}

// Ist der Nickname schon vergeben? $exceptId: das Konto selbst (beim Ändern) zählt nicht.
function fl_nickname_taken(PDO $pdo, $nick, $exceptId = 0) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE nickname = :n AND id <> :id');
    $st->execute([':n' => $nick, ':id' => (int) $exceptId]);
    return (int) $st->fetchColumn() > 0;
}

// Ist die E-Mail-Adresse schon bei einem anderen Konto? (Klein geschrieben, wie fl_check_email sie liefert.)
function fl_email_taken(PDO $pdo, $email, $exceptId = 0) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = :e AND id <> :id');
    $st->execute([':e' => $email, ':id' => (int) $exceptId]);
    return (int) $st->fetchColumn() > 0;
}

// ---- Schlüssel für die Bremse (Tabelle attempts) ----------------------------------------------------------------

// IP für die Bremse: nur REMOTE_ADDR (X-Forwarded-For ließe sich fälschen).
function fl_who_ip() {
    return fl_who('ip:' . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''));
}

// Hash für die Tabelle attempts: HMAC mit dem Datenbankpasswort als Schlüssel (IPs und Adressen lassen sich so nicht zurückrechnen).
function fl_who($value) {
    $cfg = fl_config();
    return hash_hmac('sha256', $value, $cfg !== null ? (string) $cfg['password'] : '');
}
