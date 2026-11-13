# Konten (§17)

Benutzersteuerung als Grundlage für späteres Vermarkten (Premium-Konten u. a.). Plan mit allen Paketen: [docs/plan-konten.md](../plan-konten.md).
**Stand:** KO1 (Backend), KO2 (Spielstände ans Konto), KO3 (Oberfläche im Startmenü, Rücksprung von den Mail-Links), das
Admin-Panel (Benutzerverwaltung, Abschnitt unten), die Kasse am Konto (KA1, Abschnitt unten) und der signierte Match-Start
(MS1, Abschnitt unten) gebaut.

## Ziel und Regeln

- **Gast:** Spielen geht ohne Konto. Stände liegen dann nur auf dem Gerät (wie bisher, §16). Gäste starten jede Partie mit dem
  Startbetrag; eine Kasse gibt es nur am Konto (KA1, Abschnitt unten).
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
| `meta` | `k` (Schlüssel, Primärschlüssel), `v` (Text) | Match-Start (MS1): hält das Geheimnis unter `match_secret` |
| `match_tokens` | `jti` (32 Hex, Primärschlüssel), `user_id`, `w0` (Kasse bei der Ausgabe), `issued_at`, `used_at` (leer = noch nicht gewertet) | Match-Start (MS1), Zeilen älter als 7 Tage werden gelöscht |

Die Spalte `users.blocked` (`TINYINT`, Standard 0) kommt seit dem Admin-Panel dazu, die Spalte `users.wallet` (`BIGINT`, Standard
800) seit KA1 (Kasse am Konto; Bestandskonten bekommen 800). `api/lib/konto.php` legt beide bei Bedarf selbst an.

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
| `POST {"action":"walletreset"}` | `{ok, wallet}` | nur mit Sitzung: Kasse auf den Startbetrag (KA1) |

Die Aktion `wallet` gibt es seit MS1 nicht mehr: den Endstand einer gewerteten Partie meldet `api/match.php` (Abschnitt unten).

`user` nach außen: `{email, plan, premiumUntil, createdAt, wallet}`, nie Hash oder id.

**Cookie:** `fl_session`, HttpOnly, Secure, SameSite=Lax, Pfad `/`, 30 Tage. Abmelden löscht es.

**Fehler:** `{"error": "…"}` mit HTTP-Code. 400 Anfrage (z. B. Passwort zu kurz, Adresse ungültig, Link ungültig oder abgelaufen),
401 Anmeldung falsch, 403 Konto noch nicht bestätigt (nur nach richtigem Passwort), 405 Methode, 429 zu viele Versuche,
500 Datenbank oder Server, 503 Mailversand nicht eingerichtet oder fehlgeschlagen. Fremde Herkunft (`Origin`) bekommt 403.
Die Schnittstelle `api/match.php` (Match-Start) nutzt dieselben Regeln, siehe unten.

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

## Kasse am Konto (KA1)

Die **Kasse** ist das Geld, das von Runde zu Runde bleibt (§3 „Ressourcen & Logistik“ in [ressourcen-bau.md](ressourcen-bau.md), `BALANCE.walletMax` als Obergrenze). Sie gibt es nur für
angemeldete Spieler und liegt dann im Konto, also auf jedem Gerät gleich.

- **Gast:** Jede Partie startet mit dem Startbetrag (`BALANCE.startRes.money`, 800). Es gibt kein Sparschwein im Browser
  (`localStorage`). Gäste spielen ungewertet: Das Partieende meldet nichts. Das Startmenü sagt „Ohne Konto startest du jede Partie
  mit 800 Geld, und sie zählt nicht für die Kasse. Mit Konto bleibt dein Geld von Runde zu Runde erhalten.“
- **Angemeldet:** Die Kasse kommt aus `me` oder der Anmeldung und steht im Startmenü: „Kasse: <Betrag> Geld … · zurücksetzen“.
  Eine Partie startet mit der Kasse nur, wenn sie **gewertet** ist: dann mit dem Startgeld aus einem Token des Servers
  (siehe „Signierter Match-Start“ unten). Das Startmenü zeigt, wie viele gewertete Partien bereit sind.
  Ein Stand einer gewerteten Partie merkt sich das Token (lokal, siehe unten), damit er gewertet fortgesetzt werden kann.
- **Endstand:** Gespeichert wird der **tatsächliche** Geldstand am Partieende (Ausgeben senkt die Kasse, gut spielen hebt sie). Die
  Meldung läuft über `api/match.php` (Aktion `finish`), nicht mehr über eine eigene Kassen-Aktion.
- **Zurücksetzen:** Der Knopf „zurücksetzen“ im Startmenü ruft `walletreset` auf (ohne Prüfung) und setzt auf 800. Tokens mit der
  alten Kasse sind danach veraltet.
- **Abmelden:** Die Kasse verschwindet aus der Anzeige; das Spiel startet dann mit dem Startbetrag, ungewertet.
- **Admin-Panel:** Spalte „Kasse“ und der Knopf „Kasse setzen“ (`setwallet {id, value}`, 0 bis 5000, ganze Zahl; ohne Bremse).
- **Ehrlichkeit:** Die Kasse wird im Browser berechnet. Der Server rechnet die Partie nicht nach (siehe unten „Grenzen des Schutzes“).
- **Zahlen:** Startbetrag und Obergrenze stehen in `js/data/balance.js` (`QUICK.startMoney`, `QUICK.walletMax`) und als Spiegel in
  `api/lib/konto.php` (`FL_WALLET_START`, `FL_WALLET_MAX`). Bei einer Änderung beide Stellen anpassen.
- **Dateien:** `api/auth.php` (`walletreset`, Antwort `user`), `api/lib/konto.php` (Spalte, Spiegel), `api/admin.php` (Liste,
  `setwallet`), `js/ui/saves.js` (`setAccount`, `accountWallet`, `noteWallet`, `resetWallet`), `js/ui/match.js` (Endstand, Vorrat),
  `js/main.js` (Startgeld, Partieende), `js/ui/menu.js` (Zeile im Startmenü), `admin/admin.js` und `admin/index.html`.
- **Tests:** `test/kasse.test.js` (Client: Gast, Anmelden, Grenzen von `noteWallet`, Zurücksetzen, 401, keine Aktion `wallet` mehr)
  und `test/match.test.js` (Client des Match-Starts, siehe unten). Von Hand gegen MariaDB und `php -S` geprüft (Migration der
  Spalte, `walletreset`, `setwallet`, 401 ohne Sitzung und bei gesperrtem Konto).

## Signierter Match-Start (MS1)

Eine **gewertete** Partie, also eine, die die Kasse verändert, muss der Server begonnen haben. Beim Melden des Partieendes prüft er
die Echtheit. So kommt kein Kassen-Gewinn ohne echten Start zustande, keine Partie wird doppelt gewertet, und ein veraltetes Gerät
überschreibt keinen neueren Stand. Offline bleibt es möglich: Der Server gibt **Tokens auf Vorrat** aus (bis 3 je Konto).

**Ehrlich:** Das Spiel rechnet im Browser; der Server rechnet die Partie nicht nach. Der Match-Start verhindert Melden ohne Start,
Doppeln und unmögliche Sprünge, ist aber **kein vollständiger Betrugsschutz**. Wer den Browser verändert, kann eine gewertete Partie
mit beliebigem Ergebnis melden, solange die Start-Kasse stimmt und die Grenze je Partie nicht überschritten wird.

- **Geheimnis:** Tabelle `meta`, Schlüssel `match_secret` (64 Hex, `random_bytes`). Beim ersten Bedarf angelegt und wiederverwendet.
  Es steht nicht in `api/config.php` und nicht in einem GitHub-Secret; es übersteht Deploys, weil es in der Datenbank liegt.
- **Token:** `<base64url(JSON)>.<HMAC-SHA256 hex>` über den ersten Teil (`hash_hmac`, Prüfung mit `hash_equals`). Nutzlast:
  `{uid, jti, iat, w0}`: `w0` ist die Kasse des Kontos bei der Ausgabe. Tabelle `match_tokens`: je `jti` der Startzeitpunkt und
  `used_at` (leer, solange nicht gewertet).
- **Vorrat:** `tokens` gibt die Tokens zurück, die noch gelten (unverbraucht, mit der **aktuellen** Kasse, nicht älter als 7 Tage),
  und füllt auf 3 auf. Tokens mit alter Kasse fallen weg.
- **Wertung:** `finish {token, wallet}` prüft in dieser Reihenfolge: Sitzung (sonst 401), Format und Signatur (sonst 400), Konto
  (fremdes Konto 403), Token in der Datenbank (unbekannt oder abgelaufen 400), noch nicht gewertet (sonst 409 „schon gewertet“),
  Start-Kasse `w0` gleich der aktuellen Kasse (sonst 409 „Kasse hat sich geändert“, veraltetes Gerät). Die Prüfung und das Setzen
  laufen in einer Transaktion mit Sperre der Kontozeile: Ausgabe und Wertung desselben Kontos laufen nacheinander.
- **Grenzen der Wertung:** Neue Kasse = Endstand, auf 0 bis 5000 begrenzt und höchstens `w0 + FL_MATCH_MAX_GAIN` (3000). Größere
  Sprünge werden auf diese Grenze gekappt.
- **Antworten:** `tokens` → `{tokens: [{token, w0, iat}], wallet}`; `finish` → `{ok, wallet}`. Fehler `{"error": "…"}` wie bei
  `auth.php`: 400, 401, 403, 405, 409, 500.
- **Client** (`js/ui/match.js`): Der Vorrat liegt in `localStorage` (`frontline-match-vorrat`, je Konto). `matchStart()` liefert ein
  Token mit der Kasse, die das Konto gerade zeigt; braucht kein Netz. Ohne Konto, ohne passendes Token: `null`, die Partie ist
  ungewertet und startet mit dem Startbetrag. `finishMatch(token, wallet)` meldet den Endstand; ohne Netz steht er in
  `frontline-match-ausstehend` und geht beim nächsten Abgleich der Reihe nach hinaus. Nach einer Wertung ist der Vorrat mit der alten
  Kasse veraltet und wird gestrichen; offline gibt es dann keine gewertete Partie mehr, bis der Server die neue Kasse kennt.
- **Token erst am Ende verbraucht (MS2):** Der Start nimmt das Token nicht aus dem Vorrat. **Verbraucht** ist es mit dem Endstand
  (`finishMatch`): es fällt sofort aus dem Vorrat, auch ohne Netz (die Meldung steht dann vorgemerkt in `frontline-match-ausstehend`),
  und die Antwort des Servers ändert daran nichts mehr. Eine **abgebrochene** Partie (kein Endstand) verbraucht kein Token: der
  Vorrat bleibt unverändert, der nächste Start nimmt denselben Token. Das Startmenü zählt ein laufendes Spiel mit seinem Token noch mit.
- **Token im Spielstand (MS2):** Beim Speichern einer gewerteten Partie trägt die Meta des Standes `match: { token, w0 }`. Das Feld
  ist **nur lokal** (IndexedDB): `remoteMeta` in `js/ui/saves.js` lässt es beim Hochschicken zu `api/save.php` weg, das Token liegt also
  nie auf dem Server. Eine beendete Partie (`ended`) trägt es nicht mehr. Beim **Fortsetzen** (`matchResume`) bleibt die Partie gewertet,
  wenn das Token auf diesem Gerät noch im Vorrat steht (gleiche Kasse, nicht abgelaufen); sonst läuft sie ungewertet weiter, ohne Fehler.
  Folge: Ein Stand, der auf einem **anderen Gerät** fortgesetzt wird, läuft dort ungewertet (das Token kennt das andere Gerät nicht);
  und ein Stand, dessen Token inzwischen durch eine andere Wertung verbraucht ist, ebenso.
- **Antwort-Behandlung:** 409, 400 und 403 verwerfen den vorgemerkten Eintrag (nicht wiederholen); 401 behält ihn bis zur nächsten
  Anmeldung; Netzfehler und 5xx bleiben vorgemerkt. Ein Eintrag eines anderen Kontos fällt weg.
- **Wann der Vorrat geholt wird:** beim Anmelden, beim Öffnen des Startmenüs und nach „zurücksetzen“ (`matchSync`), nach jeder
  erfolgreichen Wertung. Ist noch eine Meldung vorgemerkt, wird der Vorrat nicht geholt: der Server kennt die Kasse dann noch nicht.
- **Ungewertet:** Gäste, Konten ohne Token (kein Netz und leerer Vorrat) und fortgesetzte Stände ohne verfügbares Token (siehe
  „Token im Spielstand“) laufen ungewertet. Das Spiel sagt es im Verlauf. Abgebrochene Partien verbrauchen ihren Token nicht.
- **Lebensdauer:** Ein Token gilt 7 Tage ab Ausgabe (`BALANCE.match.tokenDays`, Spiegel `FL_MATCH_TOKEN_DAYS`); danach löscht der
  Server die Zeile.
- **Zahlen:** `FL_MATCH_TOKENS` = 3, `FL_MATCH_TOKEN_DAYS` = 7 (`api/lib/match.php`), `FL_MATCH_MAX_GAIN` = 3000 (`api/lib/konto.php`).
- **Dateien:** `api/match.php` (Aktionen), `api/lib/match.php` (Tabellen, Geheimnis, Signatur), `js/ui/match.js` (Client),
  `js/main.js` (`matchStart` beim Start, `matchResume` beim Fortsetzen, `finishMatch` am Partieende, `meta.match` beim Speichern),
  `js/ui/saves.js` (`remoteMeta`: kein `match` zum Webspace), `js/ui/menu.js` (Zeile „Gewertete Partien bereit“).
- **Tests:** `test/match.test.js` (Client mit gefälschtem fetch: Gast, Vorrat, Abbruch verbraucht nichts, Wertung verbraucht den Token,
  Fortsetzen mit und ohne Token, Vorrat mit alter Kasse, Vormerkung ohne Netz, Reihenfolge, 409/400/403/401, fremdes Konto, Frist),
  `test/saves.test.js` (Token nur lokal: Speichern und Abgleich mit Attrappe der IndexedDB, nie im Upload). Server gegen MariaDB und `php -S` von Hand geprüft: Vorrat
  (höchstens 3, stabil), Wertung, doppelte Wertung (409), veraltete Kasse (409), Zuwachsgrenze (3000) und Obergrenze (5000), falsche
  und veränderte Signatur (400), fremdes Geheimnis (400), unbekannte `jti` (400), Konto fremd (403), ohne Sitzung (401), abgelaufener
  Token (400), gleichzeitige Wertung desselben Tokens (genau eine), Geheimnis genau einmal in `meta`.

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
- `api/match.php`: der Match-Start (oben, MS1). `api/lib/match.php`: Tabellen, Geheimnis und Signatur des Match-Starts.
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

## Konto im Pausenmenü (seit v5.157)

- **Ort:** Im Pausenmenü (P, Esc) steht unter den Reglern ein kompakter Bereich „Konto“ (`js/ui/menu.js`, `showPause(…, account)`,
  Klasse `.account`). Er nutzt denselben Konto-Code wie das Startmenü (`wireAccount`), zeigt aber nur das Nötigste.
- **Abgemeldet:** Anmelden und Registrieren (ohne „Passwort vergessen“), dieselben Formulare. **Angemeldet:** „Angemeldet als <E-Mail>“
  und Abmelden. Der Anmeldestand kommt ohne Abfrage aus dem Startmenü (`accountEmail()`); beim Anmelden holt das Spiel den Vorrat
  für gewertete Partien (`matchSync`), der Webspace schaltet sich wie im Startmenü ein oder aus.
- **Laufende Partie bleibt, wie sie begonnen hat:** An- und Abmelden wirken nur auf künftige Partien. Eine ungewertete Partie wird
  nicht nachträglich gewertet, ein gewerteter Stand (Token) bleibt unverändert.
- **Gewertete Partie:** Der Bereich zeigt nur „Angemeldet als …“ und den Hinweis „An- und Abmelden erst nach dem Endstand.“, ohne
  Knöpfe. Grund: Wer sich mitten in einer gewerteten Partie abmeldet, ließe den Endstand unverbucht, und das Token bliebe im Vorrat.
- Ohne den Parameter `account` (Tests, alte Aufrufe) zeigt das Pausenmenü keinen Konto-Bereich.

## Tests

Kein automatischer Test im Paket (`npm test` läuft ohne PHP). Pausenmenü: `test/pausekonto.test.js` (Anzeige je Stand, Anmelden, Abmelden, gewertete Sperre ohne Browser). Geprüft wurde von Hand: `php -l` je Datei; Antworten des PHP-Servers
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

