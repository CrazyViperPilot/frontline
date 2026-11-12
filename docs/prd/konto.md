# Konten (§17)

Benutzersteuerung als Grundlage für späteres Vermarkten (Premium-Konten u. a.). Plan mit allen Paketen: [docs/plan-konten.md](../plan-konten.md).
**Stand:** KO1 (Backend) gebaut. KO2 (Spielstände ans Konto, `api/save.php` nur mit Sitzung) und KO3 (Oberfläche im Startmenü, Rücksprung
von den Mail-Links) stehen aus.

## Ziel und Regeln

- **Gast:** Spielen geht ohne Konto. Stände liegen dann nur auf dem Gerät (wie bisher, §16).
- **Konto:** E-Mail-Adresse und Passwort. Bestätigt wird per Link aus der Mail. Mit Konto liegen Stände auf dem Server
  und gehören dem Konto (KO2).
- Die Felder `plan` und `premium_until` sind schon da, damit Premium später ohne Datenumbau kommt. Heute hat jedes Konto `free`.

## Datenmodell (MySQL, legen sich selbst an)

| Tabelle | Spalten | Hinweis |
|---|---|---|
| `users` | `id`, `email` (klein, eindeutig), `pass_hash`, `verified_at`, `plan` (Standard `free`), `premium_until`, `created_at`, `last_login` | Zeiten in Sekunden seit 1970; `verified_at` leer = unbestätigt |
| `tokens` | `hash` (SHA-256 des Links, Schlüssel), `user_id`, `kind` (`verify` oder `reset`), `expires_at` | Link nur einmal gültig; ein neuer Link derselben Art macht den alten ungültig |
| `sessions` | `hash` (SHA-256 des Cookies), `user_id`, `created_at`, `expires_at` | 30 Tage |
| `attempts` | `who_hash` (HMAC einer IP oder Adresse), `kind` (`login`, `mailip`, `mail`), `created_at` | Zähler für die Bremsen; Einträge älter als 24 h werden gelöscht |

Passwörter nur als `password_hash` (PASSWORD_DEFAULT), Tokens mit `random_bytes(32)`, in der Datenbank nur als Hash. Die HMAC-Schlüssel
kommen aus dem Datenbankpasswort (`api/config.php`), IPs und Adressen lassen sich so nicht zurückrechnen.

## Schnittstelle `api/auth.php`

| Aufruf | Antwort | Wirkung |
|---|---|---|
| `POST {"action":"register","email","password"}` | `{ok, message}` | legt ein Konto an oder schickt bei unbestätigtem Konto einen neuen Link; Mail mit `…/api/auth.php?verify=<token>` (48 h) |
| `GET auth.php?verify=<token>` | 302 auf `/?verified=1` bzw. `/?verified=0` | bestätigt das Konto, Link wird verbraucht |
| `POST {"action":"login","email","password"}` | `{ok, user}` + Cookie | nur bestätigte Konten; setzt `fl_session` |
| `POST {"action":"logout"}` | `{ok}` | beendet die Sitzung, löscht das Cookie |
| `POST {"action":"me"}` | `{user}` oder `{user:null}` | ohne Cookie ohne Datenbankzugriff |
| `POST {"action":"forgot","email"}` | `{ok, message}` | nur für bestätigte Konten: Mail mit `/?reset=<token>` (1 h) |
| `POST {"action":"reset","token","password"}` | `{ok}` | setzt das Passwort, beendet alle Sitzungen des Kontos |

`user` nach außen: `{email, plan, premiumUntil, createdAt}`, nie Hash oder id.

**Cookie:** `fl_session`, HttpOnly, Secure, SameSite=Lax, Pfad `/`, 30 Tage. Abmelden löscht es.

**Fehler:** `{"error": "…"}` mit HTTP-Code. 400 Anfrage (z. B. Passwort zu kurz, Adresse ungültig, Link ungültig oder abgelaufen),
401 Anmeldung falsch, 403 Konto noch nicht bestätigt (nur nach richtigem Passwort), 405 Methode, 429 zu viele Versuche,
500 Datenbank oder Server, 503 Mailversand nicht eingerichtet oder fehlgeschlagen. Fremde Herkunft (`Origin`) bekommt 403.

## Regeln im Einzelnen

- **Keine Aussage über Adressen:** `register` und `forgot` antworten für jede Adresse gleich (Text und Code). Ist der Mailversand
  nicht eingerichtet, kommt die Fehlermeldung 503 für jede Adresse, weil sie vor der Suche nach dem Konto geprüft wird.
- **Bestehendes Konto:** Bei unbestätigtem Konto bleibt das alte Passwort; nur der Link wird neu geschickt. Bei bestätigtem
  Konto passiert bei `register` nichts (keine Mail, gleiche Antwort).
- **Passwort:** mindestens 8 Zeichen, höchstens 72 Byte (bcrypt liest nur 72 Byte; längere Eingaben würden still gekürzt).
- **Anmeldebremse:** höchstens 10 Anmeldeversuche je IP in 15 Minuten, danach 429. Gezählt werden alle Versuche.
- **Mailbremse:** je Adresse höchstens 5 Mails je Stunde; die Sechste bekommt die gleiche Antwort ohne Mail (stille Bremse).
  Je IP höchstens 20 Mail-Anfragen je Stunde, danach 429 (verhindert Massenversand an fremde Adressen).
- **IP:** nur `REMOTE_ADDR` zählt (ein `X-Forwarded-For` ließe sich fälschen). Hinter einem Proxy, der alle Anfragen mit
  einer Adresse weiterreicht, würden alle Nutzer dieselbe Bremse teilen: beim Webspace prüfen.
- **Sitzungen:** Passwort-Zurücksetzen beendet alle Sitzungen des Kontos. Abgelaufene Sitzungen werden beim nächsten Anmelden entfernt.

## Mailversand (`api/lib/mail.php`)

Eigener kleiner SMTP-Client (`stream_socket_client`, AUTH LOGIN, Text-Mail in UTF-8 als Base64). Zugang aus `api/config.php`,
vom Deploy aus den Secrets geschrieben (`.github/workflows/deploy.yml`):

| Secret | `config.php` | Bedeutung |
|---|---|---|
| `SMTP_HOST` | `smtp_host` | Server des Postfachs |
| `SMTP_PORT` | `smtp_port` | Port 465 = TLS von Anfang an, sonst STARTTLS (z. B. 587, Pflicht) |
| `SMTP_USER` | `smtp_user` | Login (AUTH LOGIN) |
| `SMTP_PASSWORD` | `smtp_password` | Passwort des Postfachs |
| `MAIL_FROM` | `mail_from` | Absender, „Name <adresse>“ oder nur die Adresse |

Fehlen Secrets, warnt der Deploy nur (kein Abbruch). Die API antwortet dann mit 503 und dem Satz „E-Mail-Versand ist auf dem
Server nicht eingerichtet (SMTP-Zugang fehlt in api/config.php).“. Schlägt ein Versand fehl (Verbindung, Login, Zertifikat,
abgelehnte Adresse), steht im Protokoll der Grund, im Browser nur „Die E-Mail konnte nicht gesendet werden.“ Optional gibt es
`smtp_secure` (`ssl`, `tls`, `none`); `none` nur für lokale Tests ohne TLS.

## Dateien und Zugriffsschutz

- `api/auth.php`: die Konten-Schnittstelle (oben). Konstanten (Fristen, Bremsen, Passwortlänge) stehen oben in der Datei.
- `api/lib/http.php`: CORS, JSON-Antworten, Fehler, Protokoll (gemeinsam mit `api/save.php`).
- `api/lib/db.php`: Zugang aus `api/config.php`, Verbindung und Tabellen (gemeinsam mit `api/save.php`).
- `api/lib/mail.php`: SMTP-Versand.
- `api/lib/.htaccess` und `api/.htaccess` sperren den Code und `config.php` gegen direkten Zugriff. `api/config.php` steht nicht im Repo.

## Tests

Kein automatischer Test im Paket (`npm test` läuft ohne PHP). Geprüft wurde von Hand: `php -l` je Datei; Antworten des PHP-Servers
ohne `config.php`; Ablauf mit MariaDB und einem SMTP-Fake (Registrieren, Bestätigen, Anmelden, Abmelden, Passwort vergessen und
Zurücksetzen, Bremsen, Cookie-Attribute, Fehlerpfade); Versand über STARTTLS und implizites TLS. `save.php` antwortet nach dem
Umbau identisch zur Vorfassung.
