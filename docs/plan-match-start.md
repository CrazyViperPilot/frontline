# Frontline – Plan „Signierter Match-Start“ (ein Paket)

Daniel, 2026-11-13: Eine gewertete Partie (die die Kasse verändert) muss vom Server **begonnen** worden sein. Beim Melden des
Partieendes prüft der Server die Echtheit. So wird kein Kassen-Gewinn ohne echten Start gutgeschrieben, keine Partie doppelt gewertet,
und ein veraltetes Gerät überschreibt keinen neueren Stand. Offline soll weiter möglich sein: dafür gibt der Server **Tokens auf Vorrat**
(bis 3), mit denen man auch im Flugmodus eine gewertete Partie starten kann.

**Ehrlich dokumentieren:** Das Spiel rechnet im Browser; der Server rechnet die Partie nicht nach. Der Match-Start verhindert Melden
ohne Start, Doppeln und unmögliche Sprünge, ist aber kein vollständiger Betrugsschutz. Steht so in docs/prd/konto.md.

## Entwurf

### Signatur und Speicher (Backend, api/lib/)
- **Server-Geheimnis:** Tabelle `meta (k VARCHAR(32) PRIMARY KEY, v TEXT)`; beim ersten Bedarf einen Schlüssel `match_secret` mit
  `bin2hex(random_bytes(32))` anlegen und wiederverwenden. **Nicht** in config.php, kein neues GitHub-Secret: liegt dauerhaft in der DB,
  übersteht Deploys. Hilfsfunktionen `fl_secret(pdo)`, `fl_sign(payload, secret)` = base64url(JSON) + '.' + hash_hmac('sha256', …), und
  `fl_verify(token, secret)` → payload oder null (hash_equals).
- **Token-Tabelle:** `match_tokens (jti CHAR(32) PK, user_id BIGINT, w0 INT, issued_at BIGINT, used_at BIGINT NULL, INDEX(user_id))`.
  Payload im Token: `{uid, jti, iat, w0}` (w0 = Kassenstand des Kontos zum Ausgabezeitpunkt). Einträge älter als 7 Tage aufräumen.

### API `api/match.php` (POST JSON, CORS/Fehler wie die anderen, nur mit Sitzung)
- `tokens`: gibt die ungenutzten, nicht abgelaufenen Tokens des Kontos zurück; füllt vorher bis **3** auf (je neues: jti, iat=jetzt,
  w0=aktuelle Kasse, Zeile anlegen, signieren). Antwort `{ tokens: [{token, w0, iat}], wallet }`. (Max 3 ungenutzte je Konto; mehr werden
  nicht ausgegeben.)
- `finish {token, wallet}`: ersetzt für gewertete Partien das bisherige `wallet` aus KA1. Prüft: Signatur gültig; uid = angemeldetes
  Konto; Token in der DB und **ungenutzt** (atomar `UPDATE … SET used_at=jetzt WHERE jti=? AND used_at IS NULL`, 0 Zeilen → 409 „schon
  gewertet“); `w0` **gleich der aktuellen Konto-Kasse** (sonst 409 „Kasse hat sich geändert“ – veraltetes Gerät, Token verfällt); neuer
  Wert `clamp(0, walletMax)`, zusätzlich Zuwachs je Partie ≤ `FL_MATCH_MAX_GAIN` (Konstante, z. B. 3000; größere Sprünge auf w0+Gain
  begrenzen). Setzt die Kasse, Antwort `{ ok, wallet }`.
- Alte Aktion `wallet` in api/auth.php: entfernen (gewertete Meldung läuft nur noch über `finish`). `walletreset` (Knopf) und Admin
  `setwallet` bleiben.

### Client
- `js/ui/saves.js` bzw. kleine neue Datei `js/ui/match.js` (in sw.js ASSETS): 
  - Token-Vorrat lokal in IndexedDB/localStorage halten. `ensureTokens()` (online: `match.php tokens`, speichert; offline: nutzt Vorrat).
  - `startMatch()` → liefert `{ token, w0 }` oder null (kein Konto / kein Token / Gast). Nimmt lokal ein Token aus dem Vorrat und
    markiert es als „in Benutzung für laufende Partie“ (damit ein zweiter Start es nicht wiederverwendet).
  - `finishMatch(token, wallet)` → POST `finish`; bei 409/401 Token verwerfen, Kasse unverändert, keine Fehlerflut; offline vormerken
    (wie die Kasse heute) und bei Gelegenheit senden. Nach Erfolg Vorrat ggf. nachfüllen.
- `js/main.js`:
  - **Beim Partiestart** (`startGame`): `const m = await startMatch()`. Ist `m` gesetzt, ist dies eine **gewertete** Partie; Startgeld =
    `m.w0`; `m.token` zur laufenden Sitzung merken. Sonst ungewertet; Startgeld = Startbetrag (Gast) bzw. Konto-Kasse ohne Wertung –
    einfachste Regel: ohne Token startet die Partie mit dem Startbetrag und wird nicht gewertet. (Das vorhandene `loadWallet()` entfällt
    für gewertete Partien.)
  - **Beim Partieende** (heute `saves.saveWallet`): nur wenn die Partie gewertet war, `finishMatch(token, g.teams[0].res.money)`.
  - Menü/HUD: kleiner Hinweis, wenn gerade ungewertet gespielt wird (kein Konto oder kein Token). Startmenü kann zeigen „Tokens: k“ für
    Angemeldete (optional, klein).
- Reihenfolge/Netz: `ensureTokens()` beim Anmelden und beim Öffnen des Startmenüs, wenn online.

### Doku und Tests
- docs/prd/konto.md: Abschnitt „Signierter Match-Start“ (Zweck, Tokens auf Vorrat, finish, w0-Prüfung, Grenzen, ehrliche Grenzen des
  Schutzes). docs/changes/match-start.md (mit **Titel**). ARCHITEKTUR-Zeile.
- Backend lokal gegen MariaDB (Scratchpad): Token ausgeben (max 3), finish gültig, finish zweimal (409), finish mit verändertem w0
  (409), finish mit gefälschter/der falschen Signatur (401/400), Zuwachsgrenze, ohne Sitzung 401. Client-Logik in test/match.test.js
  (Fake-fetch): Gast/ohne Token ungewertet, gewertet meldet finish, offline vormerken, 409 verwirft. `npm run test:fast`, `npm run smoke`.
