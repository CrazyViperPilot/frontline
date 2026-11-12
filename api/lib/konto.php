<?php
// Konten, gemeinsam für api/auth.php und api/save.php (seit KO2): Tabellen, Sitzung aus dem Cookie fl_session.
// Regeln: docs/prd/konto.md. Nur per require_once aus api/*.php geladen; api/lib/ ist per .htaccess gesperrt.

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

// Sitzung zu einem Token → Konto (Zeile aus users, mit id) oder null. Abgelaufene Sitzungen zählen nicht.
function fl_session_user(PDO $pdo, $token) {
    $st = $pdo->prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = :h AND s.expires_at > :now');
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
