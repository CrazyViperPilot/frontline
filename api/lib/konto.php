<?php
// Konten, gemeinsam für api/auth.php, api/save.php und api/admin.php (seit KO2): Tabellen, Sitzung aus dem Cookie fl_session,
// Sperre (users.blocked, seit ADM1), Kasse am Konto (users.wallet, seit KA1), Grenze je gewerteter Partie (FL_MATCH_MAX_GAIN, seit MS1).
// Regeln: docs/prd/konto.md. Nur per require_once aus api/*.php geladen; api/lib/ ist per .htaccess gesperrt.

// Kasse am Konto (KA1): Startbetrag und Obergrenze. Muss zu js/data/balance.js passen (QUICK.startMoney = 800,
// QUICK.walletMax = 5000); bei einer Änderung dort hier nachziehen. Ein neues Konto und „zurücksetzen“ bekommen FL_WALLET_START.
const FL_WALLET_START = 800;
const FL_WALLET_MAX = 5000;
// Höchster Zuwachs der Kasse je gewerteter Partie (Match-Start, api/match.php): größere Sprünge werden auf Start + diesen Wert gekappt.
const FL_MATCH_MAX_GAIN = 3000;

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

// Sitzungs-Token aus dem Cookie ('' wenn keiner oder kein gültiges Format).
function fl_session_token() {
    $raw = isset($_COOKIE['fl_session']) ? (string) $_COOKIE['fl_session'] : '';
    return fl_is_token($raw) ? $raw : '';
}

function fl_is_token($token) {
    return is_string($token) && preg_match('/^[0-9a-f]{64}$/', $token) === 1;
}

// Nachrüsten (idempotent, einmal je Anfrage): Spalten users.blocked (Sperre im Admin-Panel, docs/prd/konto.md) und
// users.wallet (Kasse am Konto, KA1; Bestandskonten bekommen den Startbetrag). Die Abfrage läuft über information_schema,
// wie fl_saves_upgrade in api/save.php.
function fl_konto_upgrade(PDO $pdo) {
    static $done = false;
    if ($done) return;
    fl_add_user_column($pdo, 'blocked', 'TINYINT NOT NULL DEFAULT 0');
    fl_add_user_column($pdo, 'wallet', 'BIGINT NOT NULL DEFAULT ' . FL_WALLET_START);
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
