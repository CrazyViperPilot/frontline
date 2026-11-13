# Konten (§17)

Benutzersteuerung als Grundlage für späteres Vermarkten (Premium-Konten u. a.). Plan mit allen Paketen: [docs/plan-konten.md](../plan-konten.md).
**Stand:** KO1 (Backend), KO2 (Spielstände ans Konto), KO3 (Oberfläche im Startmenü, Rücksprung von den Mail-Links) und das
Admin-Panel (Benutzerverwaltung, Abschnitt unten) gebaut.

## Ziel und Regeln

- **Gast:** Spielen geht ohne Konto. Stände liegen dann nur auf dem Gerät (wie bisher, §16).
- **Konto:** E-Mail-Adresse und Passwort. Bestätigt wird per Link aus der Mail. Mit Konto liegen Stände auf dem Server
  und gehören dem Konto (KO2, Abschnitt unten).
- Die Felder `plan` und `premium_until` sind schon da, damit Premium später ohne Datenumbau kommt. Heute hat jedes Konto `free`.

## Datenmodell (MySQL, legen sich selbst an)

| Tabelle | Spalten | Hinweis |
|---|---|---|
| `users` | `id`, `email` (klein, eindeutig), `pass_hash`, `verified_at`, `plan` (Standard `free`), `premium_until`, `created_at`, `last_login` | Zeiten in Sekunden seit 1970; `verified_at` leer = unbestätigt |
| `tokens` | `hash` (SHA-256 des Links, Schlüssel), `user_id`, `kind` (`verify` oder `reset`), `expires_at` | Link nur einmal gültig; ein neuer Link derselben Art macht den alten ungültig |
| `sessions` | `hash` (SHA-256 des Cookies), `user_id`, `created_at`, `expires_at` | 30 Tage |
| `attempts` | `who_hash` (HMAC einer IP oder Adresse), `kind` (`login`, `mailip`, `mail`, `admin`), `created_at` | Zähler für die Bremsen; Einträge älter als 24 h werden gelöscht |
| `admin_sessions` | `hash` (SHA-256 des Cookies `fl_admin`), `created_at`, `expires_at` | Admin-Panel, 8 Stunden (Abschnitt „Admin-Panel“) |

Die Spalte `users.blocked` (`TINYINT`, Standard 0) kommt seit dem Admin-Panel dazu; `api/lib/konto.php` legt sie bei Bedarf selbst an.

Passwörter nur als `password_hash` (PASSWORD_DEFAULT), Tokens mit `random_bytes(32)`, in der Datenbank nur als Hash. Die HMAC-Schlüssel
kommen aus dem Datenbankpasswort (`api/config.php`), IPs und Adressen lassen sich so nicht zurückrechnen.

## Schnittstelle `api/auth.php`

| Aufruf | Antwort | Wirkung |
|---|---|---|
| `POST {"action":"register","email","password"}` | `{ok, message}` | legt ein Konto an oder schickt bei unbestätigtem Konto einen neuen Link; Mail mit `…/api/auth.php?verify=<token>` (48 h) |
| `GET auth.php?verify=<token>` | 302 auf `/frontline/?verified=1` bzw. `…=0` | bestätigt das Konto, Link wird verbraucht |
| `POST {"action":"login","email","password"}` | `{ok, user}` + Cookie | nur bestätigte Konten; setzt `fl_session` |
| `POST {"action":"logout"}` | `{ok}` | beendet die Sitzung, löscht das Cookie |
| `POST {"action":"me"}` | `{user}` oder `{user:null}` | ohne Cookie ohne Datenbankzugriff |
| `POST {"action":"forgot","email"}` | `{ok, message}` | nur für bestätigte Konten: Mail mit `/frontline/?reset=<token>` (1 h) |
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
- **Sperre:** Ein gesperrtes Konto (Admin-Panel) bekommt beim Anmelden nach richtigem Passwort 403 `Konto gesperrt`. Seine
  Sitzungen gelten nicht mehr (`me` liefert `null`, `save.php` 401). Das Entsperren macht die Sitzungen nicht zurück.

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

## Spielstände am Konto (KO2, `api/save.php`)

- **Nur mit Sitzung:** jede Aktion von `api/save.php` (Liste, Laden, Speichern, Umbenennen, Löschen) braucht das Cookie `fl_session`.
  Ohne gültige Sitzung: HTTP 401 `{"error":"Nicht angemeldet"}`.
- **Eigene Stände:** Spalte `saves.user_id` (Index `idx_saves_user`) legt sich beim ersten Aufruf nach (`fl_saves_upgrade`, idempotent).
  Alle Abfragen filtern nach dem Konto. Ein Speichern mit der id eines anderen Kontos (oder eines Standes ohne Konto) antwortet 403
  und überschreibt nichts; Umbenennen und Löschen fremder ids treffen nichts (404 bzw. `deleted: 0`).
- **Stände ohne Konto** (vor KO2, Gaststände) bleiben unsichtbar; sie werden nicht übernommen.
- **Client** (`js/ui/saves.js`): Anfragen mit `credentials: 'include'`. Antwortet der Webspace mit 401, arbeitet das Spiel nur auf
  dem Gerät, ohne Fehlermeldungen; `listSaves` markiert dann alles als lokal. `setRemoteEnabled(true)` (nach dem Anmelden, KO3)
  schaltet den Webspace ein und schickt die lokalen Stände per `syncUp()` ins Konto; `accountUser()` fragt `me` ab.

## Dateien und Zugriffsschutz

- `api/auth.php`: die Konten-Schnittstelle (oben). Konstanten (Fristen, Bremsen, Passwortlänge) stehen oben in der Datei.
- `api/save.php`: die Spielstand-Schnittstelle (oben, KO2).
- `api/lib/konto.php`: Tabellen der Konten (`FL_SCHEMA`), Sitzung aus dem Cookie (`current_user`), gemeinsam mit `api/save.php`.
- `api/lib/http.php`: CORS, JSON-Antworten, Fehler, Protokoll (gemeinsam mit `api/save.php`).
- `api/lib/db.php`: Zugang aus `api/config.php`, Verbindung und Tabellen (gemeinsam mit `api/save.php`).
- `api/lib/mail.php`: SMTP-Versand.
- `api/lib/.htaccess` und `api/.htaccess` sperren den Code und `config.php` gegen direkten Zugriff. `api/config.php` steht nicht im Repo.

## Oberfläche (KO3, Startmenü)

- **Ort:** Bereich „Konto“ direkt unter dem Titel im Startmenü (`js/ui/menu.js`, Stil in `css/style.css`, Klasse `.account`).
  Die Anfragen laufen über `accountRequest`, `accountUser`, `setRemoteEnabled` aus `js/ui/saves.js`.
- **Abgemeldet:** Hinweis „Spielstände nur auf diesem Gerät“, drei Knöpfe: Anmelden, Registrieren, Passwort vergessen. Der Knopf
  öffnet das Formular darunter, ein zweiter Druck schließt es. Registrieren verlangt die Wiederholung des Passworts; Passwörter unter
  8 Zeichen weist schon das Formular ab. Nach dem Registrieren steht die Antwort der API darunter (Hinweis auf die Bestätigungsmail).
- **Fehler:** Die Meldung kommt wörtlich aus der API (`error`), z. B. „E-Mail oder Passwort falsch.“ oder „Zu viele Anmeldeversuche.“
  Ohne Antwort des Servers steht dort „Keine Verbindung zum Server. Bitte später erneut versuchen.“
- **Angemeldet:** „Angemeldet als <E-Mail> · Konto: Kostenlos“ bzw. „Premium (bis TT.MM.JJJJ)“ und Abmelden. Nach dem Anmelden
  schaltet das Spiel den Webspace ein (`setRemoteEnabled(true)`, lokale Stände gehen ins Konto) und lädt die Spielstand-Liste neu;
  nach dem Abmelden schaltet es ihn aus und lädt neu. Abmelden bei Netzfehler bleibt angemeldet und zeigt den Fehler.
- **Beim Start:** `accountUser()` fragt `me` ab. Antwortet der Server nicht, zeigt der Bereich „abgemeldet“; der Gerätebetrieb bleibt.
- **Rücksprung von den Mail-Links:** `?verified=1` zeigt „E-Mail bestätigt, du kannst dich jetzt anmelden.“, `?verified=0` zeigt
  „Link ungültig oder abgelaufen.“ (beides mit Anmelde-Formular). `?reset=<token>` öffnet „Neues Passwort“ (zweimal); Erfolg führt
  zurück zum Anmelden. Ein Token, der nicht wie ein Link aussieht (64 Hex-Zeichen), gilt als ungültig. Die Parameter nimmt das
  Startmenü beim ersten Anzeigen aus der Adresszeile (`history.replaceState`).
- **Keine Aussagen über Adressen:** Die Oberfläche zeigt nur die Antworten der API; ob eine Adresse existiert, erfährt sie nicht.

## Tests

Kein automatischer Test im Paket (`npm test` läuft ohne PHP). Geprüft wurde von Hand: `php -l` je Datei; Antworten des PHP-Servers
ohne `config.php`; Ablauf mit MariaDB und einem SMTP-Fake (Registrieren, Bestätigen, Anmelden, Abmelden, Passwort vergessen und
Zurücksetzen, Bremsen, Cookie-Attribute, Fehlerpfade); Versand über STARTTLS und implizites TLS. KO2: `test/saves.test.js`
(Client ohne Anmeldung: 401 führt zu reinem Gerätebetrieb, Anmelden stößt den Abgleich an) und von Hand gegen MariaDB mit zwei
Konten: ohne Cookie 401, jeder sieht nur seine Stände, fremde id beim Speichern 403, Migration der Tabelle `saves`, abgelaufene Sitzung 401.

## Admin-Panel (ADM1)

Benutzerverwaltung für Daniel unter **`/frontline/admin/`** (Adresse des Webspace), Schnittstelle `api/admin.php`.
Nicht im Offline-Cache (`admin/` steht nicht in `sw.js`), aber im Deploy hochgeladen. Die Seite trägt `noindex`.

- **Zugang:** Benutzername und Passwort kommen aus den Secrets `ADMIN_USER` und `ADMIN_PASSWORD` (nicht im Repo). Der Deploy schreibt
  in `api/config.php` nur `admin_user` und `admin_pass_hash` (`password_hash`), nie das Passwort. Fehlen sie: Warnung im Deploy,
  und jede Admin-Aktion antwortet 503 `Admin nicht eingerichtet`. Passwort höchstens 72 Byte.
- **Anmelden:** `login` vergleicht Name (`hash_equals`) und Passwort (`password_verify`). Bremse: 5 Fehlversuche je IP in 15 min,
  danach 429 (auch mit richtigem Passwort). Erfolg setzt das Cookie `fl_admin` (HttpOnly, Secure, SameSite=Strict, Pfad `/frontline/`),
  Sitzung 8 Stunden, in der Datenbank nur als SHA-256.
- **Aktionen** (JSON `{action, …}`, außer `login` nur mit gültiger Admin-Sitzung, sonst 401; Fehler wie in der Tabelle oben):

| Aktion | Wirkung |
|---|---|
| `users` | alle Konten, neueste zuerst: id, E-Mail, Registrierung, Bestätigung, letzte Anmeldung, Konto-Art, Sperre, Zahl der Spielstände |
| `approve {id}` | Freigeben: E-Mail gilt als bestätigt, offene Bestätigungslinks entfallen |
| `block {id}` / `unblock {id}` | Sperren: Anmelden 403, bestehende Sitzungen enden sofort; Entsperren hebt nur die Sperre auf |
| `plan {id, plan, premiumUntil?}` | Konto-Art `free` oder `premium`; `premiumUntil` in Sekunden seit 1970, fehlt es, ist Premium unbefristet |
| `delete {id}` | Konto, Sitzungen, Links und Spielstände in einer Transaktion löschen (endgültig) |
| `logout`, `me` | Abmelden, Name der angemeldeten Admin-Sitzung |

- **Oberfläche:** Anmeldeformular, danach Tabelle mit Suche nach E-Mail, Knöpfen je Zeile (Freigeben nur bei unbestätigtem Konto,
  Sperren/Entsperren, Auf Premium/Auf Kostenlos, Löschen). Löschen fragt mit einer Meldung, die die E-Mail und die Zahl der Spielstände
  nennt. Auf dem Handy wird jede Zeile zu einer Karte (Spaltenüberschrift als Beschriftung).
- **Dateien:** `api/admin.php` (Schnittstelle und Sitzung), `admin/index.html`, `admin/admin.js` (ohne Modul), `admin/admin.css`;
  `api/lib/konto.php` (Spalte `blocked`, Sperre in der Sitzungsabfrage), `api/auth.php` (403 bei gesperrten Konten).

**Tests:** `test/admin.test.js` prüft ohne PHP die Verdrahtung (Secrets, Upload, Datei-Eigenschaften); `php -l` läuft mit, wenn PHP da ist.
Von Hand gegen MariaDB und `php -S` geprüft: falsches Passwort, Bremse, 401 ohne Sitzung, Liste, Freigeben, Sperren (Anmelden 403),
Konto-Art, Löschen samt Spielständen, abgelaufene Sitzung, 503 ohne Zugang, Liste ohne Tabelle `saves`; Oberfläche per Browser auf Desktop und Handy.

