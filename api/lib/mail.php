<?php
// Mailversand für die Konten (KO1): eigener kleiner SMTP-Client ohne Bibliothek (stream_socket_client, AUTH LOGIN, UTF-8-Text).
// Zugang aus api/config.php, vom Deploy aus den Secrets SMTP_* geschrieben:
//   smtp_host, smtp_port, smtp_user, smtp_password, mail_from (Absender: „Name <adresse>“ oder nur die Adresse).
// Port 465: TLS von Anfang an. Anderer Port (587): STARTTLS, Pflicht, weil ein Login gesetzt ist.
// smtp_secure ('ssl', 'tls' oder 'none') gibt es optional, nur für lokale Tests ohne TLS.
// Fehler: FlMailError mit einem Satz für den Browser; Details ins Protokoll (fl_log).

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

class FlMailError extends RuntimeException {}

const FL_MAIL_NOT_SET = 'E-Mail-Versand ist auf dem Server nicht eingerichtet (SMTP-Zugang fehlt in api/config.php).';
const FL_MAIL_FAILED = 'Die E-Mail konnte nicht gesendet werden. Bitte später noch einmal versuchen.';
const FL_SMTP_TIMEOUT = 15; // Sekunden je Verbindung und je Antwort

// Prüft den SMTP-Zugang und bereitet ihn auf. Wirft FlMailError, solange etwas fehlt oder ungültig ist.
function fl_mail_config() {
    $cfg = fl_config();
    if ($cfg === null) throw new FlMailError(FL_MAIL_NOT_SET);
    foreach (['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'mail_from'] as $k) {
        if (!isset($cfg[$k]) || trim((string) $cfg[$k]) === '') throw new FlMailError(FL_MAIL_NOT_SET);
    }
    $port = (int) $cfg['smtp_port'];
    if ($port < 1 || $port > 65535) throw new FlMailError(FL_MAIL_NOT_SET);
    $secure = isset($cfg['smtp_secure']) ? (string) $cfg['smtp_secure'] : ($port === 465 ? 'ssl' : 'tls');
    if (!in_array($secure, ['ssl', 'tls', 'none'], true)) throw new FlMailError(FL_MAIL_NOT_SET);
    $from = fl_mail_from(trim((string) $cfg['mail_from']));
    if ($from === null) throw new FlMailError(FL_MAIL_NOT_SET);
    return [
        'host' => trim((string) $cfg['smtp_host']),
        'port' => $port,
        'user' => trim((string) $cfg['smtp_user']),
        'password' => (string) $cfg['smtp_password'],
        'secure' => $secure,
        'addr' => $from[0],   // Umschlag-Absender (MAIL FROM)
        'from' => $from[1],   // Kopfzeile From:
    ];
}

// „Name <adresse>“ oder „adresse“ → [adresse, Kopfzeile]; null bei ungültiger Adresse. Name in Nicht-ASCII als Base64 (UTF-8).
function fl_mail_from($value) {
    if (preg_match('/^(.*?)\s*<([^<>\s]+)>$/', $value, $m)) {
        $name = trim($m[1]);
        $addr = $m[2];
    } else {
        $name = '';
        $addr = $value;
    }
    if (!filter_var($addr, FILTER_VALIDATE_EMAIL)) return null;
    if ($name === '') return [$addr, $addr];
    $shown = preg_match('/^[\x20-\x7e]+$/', $name)
        ? '"' . str_replace(['"', '\\'], '', $name) . '"'
        : '=?UTF-8?B?' . base64_encode($name) . '?=';
    return [$addr, $shown . ' <' . $addr . '>'];
}

// Schickt eine Text-Mail (UTF-8) an $to. Wirft FlMailError.
function fl_mail_send($to, $subject, $text) {
    $smtp = fl_mail_config();
    fl_smtp_deliver($smtp, $to, fl_mail_build($smtp, $to, $subject, $text));
}

// Vollständige Nachricht: Kopfzeilen, Leerzeile, Text als Base64 (CRLF, 76 Zeichen je Zeile).
function fl_mail_build(array $smtp, $to, $subject, $text) {
    $domain = substr((string) strrchr($smtp['addr'], '@'), 1);
    $headers = [
        'From: ' . $smtp['from'],
        'To: ' . $to,
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    $body = str_replace(["\r\n", "\n"], "\r\n", $text);
    return implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
}

// Der SMTP-Dialog. Jeder Schritt prüft die Antwortcode; bei Fehler Protokoll-Eintrag und FlMailError für den Browser.
function fl_smtp_deliver(array $smtp, $to, $message) {
    $ctx = stream_context_create(['ssl' => [
        'peer_name' => $smtp['host'], 'SNI_enabled' => true, 'verify_peer' => true, 'verify_peer_name' => true,
    ]]);
    $scheme = $smtp['secure'] === 'ssl' ? 'ssl' : 'tcp';
    $fp = @stream_socket_client($scheme . '://' . $smtp['host'] . ':' . $smtp['port'], $errno, $errstr,
        FL_SMTP_TIMEOUT, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        fl_log("SMTP: Verbindung zu {$smtp['host']}:{$smtp['port']} fehlgeschlagen ($errno $errstr)");
        throw new FlMailError(FL_MAIL_FAILED);
    }
    stream_set_timeout($fp, FL_SMTP_TIMEOUT);
    try {
        fl_smtp_expect($fp, 220, 'Begrüßung');
        $caps = fl_smtp_ehlo($fp, $smtp);
        if ($smtp['secure'] === 'tls') {
            if (!isset($caps['STARTTLS'])) throw new RuntimeException('Server bietet kein STARTTLS an');
            fl_smtp_cmd($fp, 'STARTTLS', 220, 'STARTTLS');
            if (@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) !== true) {
                throw new RuntimeException('TLS-Handshake fehlgeschlagen (Zertifikat prüfen)');
            }
            fl_smtp_ehlo($fp, $smtp);
        }
        if ($smtp['user'] !== '') {
            fl_smtp_cmd($fp, 'AUTH LOGIN', 334, 'AUTH');
            fl_smtp_cmd($fp, base64_encode($smtp['user']), 334, 'Benutzer');
            fl_smtp_cmd($fp, base64_encode($smtp['password']), 235, 'Passwort');
        }
        fl_smtp_cmd($fp, 'MAIL FROM:<' . $smtp['addr'] . '>', 250, 'MAIL FROM');
        fl_smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251], 'RCPT TO');
        fl_smtp_cmd($fp, 'DATA', 354, 'DATA');
        // Zeilen mit Punkt am Anfang verdoppeln (SMTP-Endmarke ist "." allein in einer Zeile).
        $data = preg_replace('/^\./m', '..', $message);
        if (substr($data, -2) !== "\r\n") $data .= "\r\n";
        fl_smtp_write($fp, $data . ".\r\n");
        fl_smtp_expect($fp, 250, 'Nachricht');
        fl_smtp_write($fp, "QUIT\r\n");
    } catch (RuntimeException $e) {
        fclose($fp);
        fl_log('SMTP: ' . $e->getMessage());
        throw new FlMailError(FL_MAIL_FAILED);
    }
    fclose($fp);
}

// EHLO; liefert die angebotenen Erweiterungen als Menge (Schlüssel in Großbuchstaben, z. B. STARTTLS, AUTH).
function fl_smtp_ehlo($fp, array $smtp) {
    $domain = substr((string) strrchr($smtp['addr'], '@'), 1);
    $lines = fl_smtp_cmd($fp, 'EHLO ' . $domain, 250, 'EHLO');
    $caps = [];
    foreach ($lines as $line) {
        $word = strtoupper(explode(' ', $line, 2)[0]);
        $caps[$word] = true;
    }
    return $caps;
}

function fl_smtp_cmd($fp, $line, $expect, $stage) {
    fl_smtp_write($fp, $line . "\r\n");
    return fl_smtp_expect($fp, $expect, $stage);
}

// Liest die Antwort und prüft den Code (einer oder mehrere erlaubte). Gibt den Text der Zeilen zurück.
function fl_smtp_expect($fp, $expect, $stage) {
    list($code, $lines) = fl_smtp_read($fp);
    $ok = is_array($expect) ? in_array($code, $expect, true) : $code === $expect;
    if (!$ok) throw new RuntimeException("$stage: Antwort $code " . implode(' | ', $lines));
    return $lines;
}

// Mehrzeilige Antwort lesen (Zeilen „250-…“, letzte „250 …“). Ein Befehl wird nie ins Protokoll geschrieben.
function fl_smtp_read($fp) {
    $code = 0;
    $lines = [];
    while (true) {
        $raw = fgets($fp, 2048);
        if ($raw === false) {
            $timeout = stream_get_meta_data($fp)['timed_out'];
            throw new RuntimeException('keine Antwort des Servers' . ($timeout ? ' (Zeitüberschreitung)' : ''));
        }
        $line = rtrim($raw, "\r\n");
        if (!preg_match('/^(\d{3})([ -])(.*)$/', $line, $m)) throw new RuntimeException('unerwartete Antwort: ' . $line);
        $code = (int) $m[1];
        $lines[] = $m[3];
        if ($m[2] === ' ') break;
    }
    return [$code, $lines];
}

function fl_smtp_write($fp, $data) {
    if (fwrite($fp, $data) !== strlen($data)) throw new RuntimeException('Schreiben zum Server fehlgeschlagen');
}
