# Frontline – Plan „Benutzerkonten“ (Pakete KO1–KO3)

Daniel, 2026-11-12: Benutzersteuerung als Grundlage für späteres Vermarkten (Premium-Konten u. a.).
Entscheidungen: **E-Mail + Passwort** mit Bestätigungslink und „Passwort vergessen“; Mailversand per **SMTP** (Postfach auf dem
Webspace); **Gast + Konto**: Spielen geht ohne Konto (Stände nur auf dem Gerät), mit Konto liegen Stände auf dem Server und gehören
dem Konto. Umsetzung mit Haiku, ein Paket je Sitzung, auf eigenem Branch `konten`, Merge nach `main` erst nach KO3.

## Gemeinsame Regeln
1. Backend: PHP 8 ohne Composer/Fremdbibliotheken, PDO MySQL, Prepared Statements überall, `password_hash`/`password_verify`
   (PASSWORD_DEFAULT), Tokens mit `random_bytes(32)` und in der DB **nur als SHA-256-Hash** gespeichert. Gemeinsamer Code in
   `api/lib/` (DB-Verbindung aus `api/config.php`, JSON-Antworten, CORS wie `api/save.php`, Mail). `api/lib/` per `.htaccess` sperren.
2. Tabellen legen sich selbst an (`CREATE TABLE IF NOT EXISTS`, fehlende Spalten per `ALTER TABLE` nachrüsten, idempotent).
3. Sitzung: HttpOnly-Cookie `fl_session` (Secure, SameSite=Lax, Pfad `/`), 30 Tage gültig, Token-Hash in Tabelle `sessions`.
4. Keine Aussage, ob eine E-Mail registriert ist (Registrieren/Passwort vergessen antworten gleich). Einfache Bremse gegen Durchprobieren:
   Tabelle `attempts` (IP-Hash, Art, Zeit), z. B. höchstens 10 Anmeldeversuche je IP und 15 min, 5 Mails je E-Mail und Stunde.
5. Texte (Mails, Fehlermeldungen, Oberfläche) auf Deutsch. Doku: neue Themen-Datei `docs/prd/konto.md` (in der Übersicht von PRD.md
   eintragen, `test/docs.test.js`), Eintrag in `docs/changes/`, Plan-Stand pflegen. Kein Push.

## Pakete
| Paket | Inhalt | Stand |
|---|---|---|
| KO1 | Backend Konten: `api/auth.php` (register, verify, login, logout, me, forgot, reset), Tabellen `users`, `tokens`, `sessions`, `attempts`; SMTP-Versand `api/lib/mail.php`; Deploy schreibt SMTP-Werte in `config.php` | gebaut (Doku: [docs/prd/konto.md](prd/konto.md)) |
| KO2 | Spielstände ans Konto: `api/save.php` nur mit Sitzung, Spalte `user_id`, nur eigene Stände; Client `js/ui/saves.js` nutzt den Webspace nur angemeldet (`credentials: 'include'`) | offen |
| KO3 | Oberfläche: Konto-Bereich im Startmenü (Registrieren, Anmelden, Abmelden, Passwort vergessen, angemeldet als …, Konto-Art), Seiten-Rückkehr nach Bestätigungs- und Rücksetzlink (`/?verified=1`, `/?reset=<token>`) | offen |

### KO1 – Datenmodell und API
- `users`: `id BIGINT AUTO_INCREMENT`, `email VARCHAR(254) UNIQUE` (klein geschrieben), `pass_hash VARCHAR(255)`, `verified_at BIGINT NULL`,
  `plan VARCHAR(16) DEFAULT 'free'` (später `premium`), `premium_until BIGINT NULL`, `created_at BIGINT`, `last_login BIGINT NULL`.
- `tokens`: `hash CHAR(64) PK`, `user_id`, `kind ENUM('verify','reset')`, `expires_at` (Bestätigung 48 h, Rücksetzen 1 h), einmal gültig.
- `sessions`: `hash CHAR(64) PK`, `user_id`, `created_at`, `expires_at`.
- `POST api/auth.php` mit JSON `{action, …}`:
  `register {email, password}` (Passwort ≥ 8 Zeichen; legt unbestätigten Nutzer an oder schickt bei unbestätigtem erneut den Link) →
  Mail mit Link `https://frontline.phpexpert.de/api/auth.php?verify=<token>`;
  `login {email, password}` (nur bestätigte Konten; setzt Cookie) → `{user}`; `logout`; `me` → `{user}` oder `{user:null}`;
  `forgot {email}` → Mail mit Link `https://frontline.phpexpert.de/?reset=<token>`; `reset {token, password}` (setzt Passwort, löscht alle Sitzungen).
- `GET api/auth.php?verify=<token>` bestätigt und leitet auf `/?verified=1` weiter (bei Fehler `/?verified=0`).
- `user` nach außen: `{ email, plan, premiumUntil, createdAt }` – nie Hash oder id.
- Mail: kleiner eigener SMTP-Client (`fsockopen`, SSL auf 465 oder STARTTLS auf 587, AUTH LOGIN), Text-Mail UTF-8,
  Absender `MAIL_FROM`. Secrets (Daniel legt an): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- Lokale Prüfung: `php -l`; ein PHP-Testskript gegen SQLite ist nicht nötig. Den SMTP-Client mit einem kleinen lokalen
  Python-SMTP-Fake (`python3 -m smtpd` gibt es nicht mehr; `aiosmtpd` nur wenn installiert, sonst ein Mini-Socket-Server) prüfen, wenn machbar.
