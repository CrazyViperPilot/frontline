# Betrieb: Tests in der CI und Veröffentlichung

Lesen, wenn es um Deploy, Secrets oder den Webspace geht.

## CI

- `.github/workflows/test.yml` läuft bei jedem Push und Pull Request (Tests und KI-Kennzahlen).

## Veröffentlichung

- `.github/workflows/deploy.yml` lädt das Spiel nach jedem Push auf `main` (nach grünen Tests) per FTP auf Daniels Webspace: <https://phpexpert.de/frontline/>.
- Secrets für den Upload: `FTP_SERVER`, `FTP_USER`, `FTP_PASSWORD`.
- Secrets für die Datenbank: `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (Pflicht für `api/save.php` und `api/auth.php`).
- Secrets für das Postfach der Konto-Mails: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
  Fehlen sie, gibt es nur eine Warnung; die API meldet dann beim Mailversand einen Fehler. Doku: `docs/prd/konto.md`.
- Secrets für das Admin-Panel: `ADMIN_USER`, `ADMIN_PASSWORD`.
  Nur Name und `password_hash` landen in `api/config.php`; fehlen sie, antwortet `api/admin.php` mit 503.
  Doku: `docs/prd/konto.md`, Abschnitt „Admin-Panel“.
- Optionale Variablen: `FTP_DIR` (Zielordner, Standard `./`), `FTP_PROTOCOL` (`ftps` oder `ftp`), `FTP_SECURITY` (`strict` oder `loose`).
- Hochgeladen werden nur die Dateien, die der Browser braucht, plus:
  - `api/`: Spielstand-Backend `api/save.php`, Konten `api/auth.php`, Admin-API `api/admin.php`, gemeinsamer Code `api/lib/` (PHP).
  - `admin/`: Admin-Panel, nicht im Offline-Cache.
  - `index.php`: Einstieg, zählt den Seitenaufruf (Besucherstatistik, `docs/prd/statistik.md`) und liefert `index.html` aus
    (`.htaccess`: `DirectoryIndex index.php index.html`). Statistik-Schnittstelle `api/track.php`.
- `api/data/` auf dem Server wird nie überschrieben oder gelöscht.
