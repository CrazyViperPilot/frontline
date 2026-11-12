<?php
// Frontline Konten-API (KO1, Regeln: docs/prd/konto.md). Aktion im JSON-Feld action, Antwort immer JSON:
//   POST auth.php {"action":"register","email":"…","password":"…"}  → {"ok":true,"message":"…"}; Mail mit Bestätigungslink
//   GET  auth.php?verify=<token>                                    → 302 auf /frontline/?verified=1 oder …=0 (Link aus der Mail)
//   POST auth.php {"action":"login","email":"…","password":"…"}     → {"ok":true,"user":{…}}; setzt Cookie fl_session
//   POST auth.php {"action":"logout"}                               → {"ok":true}; löscht die Sitzung
//   POST auth.php {"action":"me"}                                   → {"user":{…}} oder {"user":null}
//   POST auth.php {"action":"forgot","email":"…"}                   → {"ok":true,"message":"…"}; Mail mit Link /frontline/?reset=<token>
//   POST auth.php {"action":"reset","token":"…","password":"…"}     → {"ok":true}; setzt das Passwort, meldet alle Sitzungen ab
// user nach außen: {email, plan, premiumUntil, createdAt}, nie Hash oder id.
// Fehler: {"error": "…"} mit HTTP-Code: 400 Anfrage, 401 Anmeldung falsch, 403 nicht bestätigt, 405 Methode,
//         429 zu viele Versuche, 500 Server/Datenbank, 503 Mailversand nicht eingerichtet oder fehlgeschlagen.
// Keine Aussage, ob eine E-Mail-Adresse registriert ist: register und forgot antworten gleich (bei Bremse, Bestätigung
// und Nichtexistenz). Tokens liegen nur als SHA-256 in der Datenbank, Passwörter als password_hash.

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/mail.php';
require_once __DIR__ . '/lib/konto.php';

const FL_SITE = 'https://phpexpert.de/frontline';  // Adresse des Spiels: Ziel der Links in den Mails
const FL_PATH = '/frontline/';                      // Pfad des Spiels auf dem Webspace (Weiterleitung, Cookie)
const FL_SESSION_DAYS = 30;     // Sitzung (Cookie fl_session, Pfad /)
const FL_VERIFY_HOURS = 48;     // Bestätigungslink, einmal gültig
const FL_RESET_HOURS = 1;       // Link „Passwort zurücksetzen“, einmal gültig
const FL_LOGIN_MAX = 10;        // Anmeldeversuche je IP …
const FL_LOGIN_WINDOW = 900;    // … in Sekunden (15 min)
const FL_MAIL_MAX_EMAIL = 5;    // Mails je E-Mail-Adresse …
const FL_MAIL_MAX_IP = 20;      // Mails je IP (gegen Massenversand an fremde Adressen) …
const FL_MAIL_WINDOW = 3600;    // … in Sekunden (1 h)
const FL_PASS_MIN = 8;          // Zeichen
const FL_PASS_MAX = 72;         // Byte: bcrypt liest nur die ersten 72, darüber würde still gekürzt

const FL_MSG_REGISTER = 'Wenn die Adresse noch nicht bestätigt ist, haben wir eine Mail mit einem Bestätigungslink geschickt. '
    . 'Der Link ist 48 Stunden gültig. Bitte auch den Spam-Ordner prüfen.';
const FL_MSG_FORGOT = 'Wenn zu dieser Adresse ein bestätigtes Konto gehört, haben wir eine Mail mit einem Link zum Zurücksetzen '
    . 'geschickt. Der Link ist 1 Stunde gültig.';
const FL_MSG_LINK = 'Der Link ist ungültig oder abgelaufen. Bitte die Aktion noch einmal anfordern.';
const FL_MSG_BUSY = 'Zu viele Anfragen. Bitte später erneut versuchen.';

fl_cors('GET, POST, OPTIONS', true);
fl_exception_handler('Serverfehler bei der Anmeldung');
fl_check_origin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['verify'])) fail(405, 'Methode nicht erlaubt');
    fl_verify_link($_GET['verify']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) fail(400, 'Ungültige Anfrage');

switch ($body['action']) {
    case 'register': fl_register($body); break;
    case 'login': fl_login($body); break;
    case 'logout': fl_logout(); break;
    case 'me': fl_me(); break;
    case 'forgot': fl_forgot($body); break;
    case 'reset': fl_reset($body); break;
    default: fail(400, 'Unbekannte Aktion');
}

// ---- Aktionen --------------------------------------------------------------------------------------------

// Konto anlegen (oder bei unbestätigtem Konto den Link erneut schicken). Bestätigtes Konto: nichts passiert, gleiche Antwort.
function fl_register(array $body) {
    $email = fl_check_email(fl_field($body, 'email'));
    $pass = fl_check_password(fl_field($body, 'password'));
    fl_mail_ready();
    $pdo = fl_db(FL_SCHEMA);
    if (fl_attempt($pdo, 'mailip', fl_who_ip(), FL_MAIL_WINDOW) > FL_MAIL_MAX_IP) fail(429, FL_MSG_BUSY);
    if (fl_attempt($pdo, 'mail', fl_who('mail:' . $email), FL_MAIL_WINDOW) > FL_MAIL_MAX_EMAIL) {
        out(['ok' => true, 'message' => FL_MSG_REGISTER]); // stille Bremse: gleiche Antwort, keine Mail
    }
    $user = fl_user_by_email($pdo, $email);
    if ($user === null) $user = fl_create_user($pdo, $email, $pass);
    if ($user !== null && $user['verified_at'] === null) {
        // Das bestehende Passwort bleibt: wer die Adresse kennt, kann es nicht über dieses Formular ändern.
        $token = fl_issue_token($pdo, (int) $user['id'], 'verify', FL_VERIFY_HOURS * 3600);
        $link = FL_SITE . '/api/auth.php?verify=' . $token;
        fl_send_mail($email, 'Frontline: Konto bestätigen',
            "Hallo,\n\nbitte bestätige dein Frontline-Konto mit diesem Link. Er ist " . FL_VERIFY_HOURS . " Stunden gültig:\n\n"
            . $link . "\n\nFalls du dich nicht bei Frontline registriert hast, ignoriere diese Mail einfach.\n\n"
            . "Frontline\n" . FL_SITE . "\n");
    }
    out(['ok' => true, 'message' => FL_MSG_REGISTER]);
}

// Anmelden: nur bestätigte Konten; Sitzung als Cookie. Ohne Konto wird trotzdem ein Passwort geprüft (gleiche Zeit).
function fl_login(array $body) {
    $email = fl_check_email(fl_field($body, 'email'));
    $password = fl_field($body, 'password');
    if (!is_string($password) || $password === '') fail(400, 'Passwort fehlt');
    $pdo = fl_db(FL_SCHEMA);
    if (fl_attempt($pdo, 'login', fl_who_ip(), FL_LOGIN_WINDOW) > FL_LOGIN_MAX) {
        fail(429, 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.');
    }
    $user = fl_user_by_email($pdo, $email);
    $hash = $user !== null ? $user['pass_hash'] : password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $ok = strlen($password) <= FL_PASS_MAX && password_verify($password, $hash);
    if ($user === null || !$ok) fail(401, 'E-Mail oder Passwort falsch.');
    if ($user['verified_at'] === null) {
        fail(403, 'Das Konto ist noch nicht bestätigt. Den Link aus der Bestätigungsmail öffnen (48 Stunden gültig) '
            . 'oder mit derselben Adresse erneut registrieren.');
    }
    $token = bin2hex(random_bytes(32));
    $now = time();
    $pdo->prepare('DELETE FROM sessions WHERE expires_at < :now')->execute([':now' => $now]);
    $pdo->prepare('INSERT INTO sessions (hash, user_id, created_at, expires_at) VALUES (:h, :u, :c, :e)')->execute([
        ':h' => hash('sha256', $token), ':u' => (int) $user['id'], ':c' => $now, ':e' => $now + FL_SESSION_DAYS * 86400,
    ]);
    $pdo->prepare('UPDATE users SET last_login = :now WHERE id = :id')->execute([':now' => $now, ':id' => (int) $user['id']]);
    fl_set_cookie($token, $now + FL_SESSION_DAYS * 86400);
    out(['ok' => true, 'user' => fl_user_out($user)]);
}

function fl_logout() {
    $token = fl_session_token();
    if ($token !== '') {
        $pdo = fl_db(FL_SCHEMA);
        $pdo->prepare('DELETE FROM sessions WHERE hash = :h')->execute([':h' => hash('sha256', $token)]);
    }
    fl_set_cookie('', time() - 3600);
    out(['ok' => true]);
}

// Wer ist angemeldet? Ohne Cookie ohne Datenbankzugriff.
function fl_me() {
    $token = fl_session_token();
    if ($token === '') out(['user' => null]);
    $pdo = fl_db(FL_SCHEMA);
    $user = fl_session_user($pdo, $token);
    out(['user' => $user !== null ? fl_user_out($user) : null]);
}

// Passwort vergessen: nur für bestätigte Konten eine Mail. Gleiche Antwort für jede Adresse.
function fl_forgot(array $body) {
    $email = fl_check_email(fl_field($body, 'email'));
    fl_mail_ready();
    $pdo = fl_db(FL_SCHEMA);
    if (fl_attempt($pdo, 'mailip', fl_who_ip(), FL_MAIL_WINDOW) > FL_MAIL_MAX_IP) fail(429, FL_MSG_BUSY);
    $count = fl_attempt($pdo, 'mail', fl_who('mail:' . $email), FL_MAIL_WINDOW);
    if ($count <= FL_MAIL_MAX_EMAIL) {
        $user = fl_user_by_email($pdo, $email);
        if ($user !== null && $user['verified_at'] !== null) {
            $token = fl_issue_token($pdo, (int) $user['id'], 'reset', FL_RESET_HOURS * 3600);
            $link = FL_SITE . '/?reset=' . $token;
            fl_send_mail($email, 'Frontline: Passwort zurücksetzen',
                "Hallo,\n\nüber diesen Link kannst du ein neues Passwort für dein Frontline-Konto setzen. Der Link ist "
                . FL_RESET_HOURS . " Stunde gültig und funktioniert nur einmal:\n\n" . $link
                . "\n\nFalls du das nicht angefordert hast, ignoriere diese Mail. Dein Passwort bleibt dann unverändert.\n\n"
                . "Frontline\n" . FL_SITE . "\n");
        }
    }
    out(['ok' => true, 'message' => FL_MSG_FORGOT]);
}

// Neues Passwort mit dem Link aus der Mail. Alle Sitzungen des Kontos enden.
function fl_reset(array $body) {
    $token = fl_field($body, 'token');
    if (!fl_is_token($token)) fail(400, FL_MSG_LINK);
    $pass = fl_check_password(fl_field($body, 'password'));
    $pdo = fl_db(FL_SCHEMA);
    $uid = fl_token_user($pdo, $token, 'reset');
    if ($uid === null) fail(400, FL_MSG_LINK);
    $pdo->prepare('UPDATE users SET pass_hash = :h WHERE id = :id')->execute([
        ':h' => password_hash($pass, PASSWORD_DEFAULT), ':id' => $uid,
    ]);
    $pdo->prepare('DELETE FROM tokens WHERE user_id = :id AND kind = :k')->execute([':id' => $uid, ':k' => 'reset']);
    $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute([':id' => $uid]);
    out(['ok' => true]);
}

// Link aus der Bestätigungsmail: Konto bestätigen, dann Weiterleitung auf die Spielseite. Fehler (auch Datenbank) → verified=0.
function fl_verify_link($raw) {
    $ok = false;
    if (fl_is_token($raw)) {
        $pdo = fl_db(FL_SCHEMA, true);
        if ($pdo !== null) {
            try {
                $uid = fl_token_user($pdo, $raw, 'verify');
                if ($uid !== null) {
                    $pdo->prepare('UPDATE users SET verified_at = :now WHERE id = :id AND verified_at IS NULL')
                        ->execute([':now' => time(), ':id' => $uid]);
                    $pdo->prepare('DELETE FROM tokens WHERE hash = :h')->execute([':h' => hash('sha256', $raw)]);
                    $ok = true;
                }
            } catch (PDOException $e) {
                fl_log($e->getMessage());
            }
        }
    }
    header_remove('Content-Type');
    header('Location: ' . FL_PATH . '?verified=' . ($ok ? '1' : '0'), true, 302);
    exit;
}

// ---- Prüfungen ------------------------------------------------------------------------------------------

function fl_field(array $body, $key) {
    return array_key_exists($key, $body) ? $body[$key] : null;
}

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

// Mailversand eingerichtet? Vor jeder Suche nach dem Konto prüfen: die Antwort ist dann für jede Adresse gleich.
function fl_mail_ready() {
    try {
        fl_mail_config();
    } catch (FlMailError $e) {
        fail(503, $e->getMessage());
    }
}

function fl_send_mail($to, $subject, $text) {
    try {
        fl_mail_send($to, $subject, $text);
    } catch (FlMailError $e) {
        fail(503, $e->getMessage());
    }
}

// ---- Datenbank -----------------------------------------------------------------------------------------

function fl_user_by_email(PDO $pdo, $email) {
    $st = $pdo->prepare('SELECT * FROM users WHERE email = :e');
    $st->execute([':e' => $email]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row !== false ? $row : null;
}

// Neues, unbestätigtes Konto. Gab es es schon (gleichzeitige Anfrage), wird das bestehende Konto geliefert.
function fl_create_user(PDO $pdo, $email, $pass) {
    try {
        $pdo->prepare('INSERT INTO users (email, pass_hash, created_at, plan) VALUES (:e, :h, :t, :p)')->execute([
            ':e' => $email, ':h' => password_hash($pass, PASSWORD_DEFAULT), ':t' => time(), ':p' => 'free',
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() !== '23000') throw $e; // 23000 = doppelter Schlüssel
    }
    return fl_user_by_email($pdo, $email);
}

// Neuer Link je Art: ein älterer Link derselben Art wird ungültig. Gibt den Klartext-Token zurück (nur in der Mail).
function fl_issue_token(PDO $pdo, $uid, $kind, $seconds) {
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('DELETE FROM tokens WHERE user_id = :u AND kind = :k')->execute([':u' => $uid, ':k' => $kind]);
    $pdo->prepare('INSERT INTO tokens (hash, user_id, kind, expires_at) VALUES (:h, :u, :k, :e)')->execute([
        ':h' => hash('sha256', $token), ':u' => $uid, ':k' => $kind, ':e' => time() + $seconds,
    ]);
    return $token;
}

// Konto zu einem gültigen, noch nicht verbrauchten Token der Art (null sonst).
function fl_token_user(PDO $pdo, $token, $kind) {
    $st = $pdo->prepare('SELECT user_id FROM tokens WHERE hash = :h AND kind = :k AND expires_at > :now');
    $st->execute([':h' => hash('sha256', $token), ':k' => $kind, ':now' => time()]);
    $uid = $st->fetchColumn();
    return $uid === false ? null : (int) $uid;
}

// Zählt einen Versuch und liefert die Zahl der Versuche im Fenster, diesen eingerechnet.
// $kind: login (IP), mailip (IP), mail (E-Mail-Adresse); $who: Hash aus fl_who().
function fl_attempt(PDO $pdo, $kind, $who, $window) {
    $now = time();
    $pdo->prepare('DELETE FROM attempts WHERE created_at < :old')->execute([':old' => $now - 86400]);
    $pdo->prepare('INSERT INTO attempts (who_hash, kind, created_at) VALUES (:w, :k, :t)')->execute([
        ':w' => $who, ':k' => $kind, ':t' => $now,
    ]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM attempts WHERE who_hash = :w AND kind = :k AND created_at > :since');
    $st->execute([':w' => $who, ':k' => $kind, ':since' => $now - $window]);
    return (int) $st->fetchColumn();
}

// Nach außen: nur diese Felder, nie Hash oder id.
function fl_user_out(array $u) {
    return [
        'email' => $u['email'],
        'plan' => $u['plan'],
        'premiumUntil' => $u['premium_until'] === null ? null : (int) $u['premium_until'],
        'createdAt' => (int) $u['created_at'],
    ];
}

// ---- Cookie und Schlüssel für die Bremse ----------------------------------------------------------------

function fl_set_cookie($value, $expires) {
    setcookie('fl_session', $value, [
        'expires' => $expires, 'path' => FL_PATH, 'secure' => true, 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

// IP für die Bremse: nur REMOTE_ADDR (X-Forwarded-For ließe sich fälschen).
function fl_who_ip() {
    return fl_who('ip:' . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''));
}

// Hash für die Tabelle attempts: HMAC mit dem Datenbankpasswort als Schlüssel (IPs und Adressen lassen sich so nicht zurückrechnen).
function fl_who($value) {
    $cfg = fl_config();
    return hash_hmac('sha256', $value, $cfg !== null ? (string) $cfg['password'] : '');
}
