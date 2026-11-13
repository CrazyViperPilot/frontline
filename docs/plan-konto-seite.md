# Frontline – Plan „Konto-Bereich“ (ein Paket)

**Stand: gebaut** (2026-11-13, Branch `konto-seite`, noch nicht gepusht). Umsetzung: docs/prd/konto.md („Konto-Bereich (seit KO4)“), docs/changes/konto-seite.md.

Daniel, 2026-11-13: Ein ausführlicher Konto-Bereich im Startmenü. Entscheidungen: **Nickname im Konto-Bereich änderbar** (keine
Pflicht bei der Registrierung); **Selbst-Deaktivierung** per E-Mail bestätigt, setzt das Konto nur auf **inaktiv**; **reaktivieren und
endgültig löschen kann nur der Admin**. Premium-Status, Premium-Historie und „bis wann Premium“ sichtbar.

## Stand heute
- `users`: id, email, pass_hash, verified_at, plan ('free'/'premium'), premium_until, created_at, last_login, blocked, wallet.
  (Eine zweite Sitzung hat Statistik/„Meine Spiele“ ergänzt: `api/admin.php` Aktion `stats`, `js/ui/stats.js`, Tabelle für Partien.)
- `api/auth.php`: `fl_user_out` → {email, plan, premiumUntil, createdAt, wallet}. Aktionen register/login/logout/me/forgot/reset/
  walletreset. `current_user` (konto.php) schließt gesperrte Konten aus. Verify-Link `?verify=<token>`.
- `api/admin.php`: users-Liste {…, blocked, saves, games, wallet}; Aktionen approve/block/unblock/plan/setwallet/delete/stats.
- `js/ui/menu.js`: Konto-Abschnitt über `accountHtml(st, {compact,hint,locked,stats})` und `wireAccount`. Startmenü hat Knopf „Meine
  Spiele“ (stats). `planLabel` zeigt „Premium (bis Datum)“. Admin-UI in `admin/`.

## Datenmodell (api/lib/konto.php, idempotent nachrüsten wie `blocked`/`wallet`)
- `users.nickname VARCHAR(32) NULL`.
- `users.active TINYINT NOT NULL DEFAULT 1` (0 = vom Nutzer deaktiviert; getrennt von `blocked` = Admin-Sperre).
- Neue Tabelle `premium_history (id BIGINT AUTO_INCREMENT PK, user_id BIGINT, plan VARCHAR(16), premium_until BIGINT NULL,
  note VARCHAR(80) NULL, changed_by VARCHAR(16), created_at BIGINT, INDEX(user_id))` – ein Eintrag je Premium-Änderung.
- `current_user` liefert auch für `active = 0` null (wie bei blocked). Login lehnt `active = 0` mit 403 „Konto ist deaktiviert, bitte
  wende dich an den Admin“ ab.

## api/auth.php
- `fl_user_out` um `nickname` (string|null) und `active` erweitern. (createdAt bereits da.)
- `setnickname {nickname}` (Sitzung): trimmt, 0–32 Zeichen, erlaubte Zeichen (Buchstaben/Ziffern/Leer/_-.), leer = kein Nickname;
  speichert; Antwort `{ok, user}`.
- `premiumHistory` (Sitzung): `{history:[{plan, premiumUntil, note, createdAt, changedBy}]}`, neueste zuerst.
- `deactivate` (Sitzung): schickt eine Mail mit Link `…/api/auth.php?deactivate=<token>` (kind `deactivate`, 48 h). Antwort wie forgot
  (neutral), damit nichts verraten wird; Bremse wie Mailversand.
- `GET auth.php?deactivate=<token>`: Token prüfen/verbrauchen, `active = 0`, alle Sitzungen des Kontos löschen, Weiterleitung auf
  `…/frontline/?deactivated=1` (bei Fehler `?deactivated=0`).
- Tokens-Tabelle kennt `kind` bereits (verify/reset) → `deactivate` ergänzen (ENUM erweitern oder Spalte ist VARCHAR; prüfen).

## api/admin.php
- users-Liste um `nickname` und `active` erweitern.
- `activate {id}` (set active=1). `deactivate {id}` optional (Admin kann auch deaktivieren) – mindestens `activate`.
- `plan`-Aktion: bei jeder Änderung einen `premium_history`-Eintrag schreiben (`changed_by='admin'`, note optional aus dem Body).
- `delete` bleibt endgültig (nur Admin), räumt auch `premium_history`.
- `premiumhistory {id}` optional für die Admin-Sicht.

## Oberfläche
- `js/ui/menu.js` Konto-Abschnitt: angemeldet einen Knopf **„Konto“** (neben „Meine Spiele“/„Abmelden“), der einen Detailbereich
  auf-/zuklappt (Muster wie der stats-Toggle). Inhalt:
  - E-Mail, **Nickname** (Eingabefeld + „Speichern“), **erstellt am** (createdAt), **Konto-Art**: Kostenlos oder „Premium bis <Datum>“.
  - **Premium-Historie:** kleine Liste (Datum · Art · bis · Notiz) aus `premiumHistory`; leer → Hinweis „noch keine“.
  - **Konto löschen:** Knopf „Konto löschen“ → Rückfrage, dann `deactivate`; Hinweis „Wir haben dir eine Bestätigungsmail geschickt. Nach
    dem Klick wird dein Konto deaktiviert; endgültig löschen kann nur der Admin.“
  - Nur Startmenü (nicht Pause). `wireAccount`/`accountHtml` entsprechend erweitern (neuer Zweig, kompakt bleibt ohne „Konto“-Knopf).
- URL `?deactivated=1` → Meldung „Dein Konto wurde deaktiviert.“ (und abgemeldet), `?deactivated=0` → „Link ungültig oder abgelaufen“.
  Parameter wie bei `?verified=` per history.replaceState entfernen (js/main.js / menu.js, vorhandene Auswertung nutzen).
- Admin-Panel (`admin/`): Spalte/Anzeige „aktiv“ bzw. „inaktiv“; Knopf „Reaktivieren“ für inaktive; Premium-Historie je Konto optional
  (klein); planLabel/Setzen wie gehabt, Notizfeld optional.

## Doku und Tests
- docs/prd/konto.md: Abschnitte „Konto-Bereich“, „Nickname“, „Deaktivieren (Selbst, inaktiv; Admin reaktiviert/löscht)“, „Premium-Historie“.
- docs/changes/konto-seite.md (mit **Titel**). ARCHITEKTUR-Zeile. Plan-Stand „gebaut“.
- Backend lokal gegen MariaDB + php -S (Scratchpad) prüfen: nickname setzen/leeren/zu lang, deactivate-Mail + Link (active=0, Sitzungen
  weg, Login 403), Admin activate, plan schreibt Historie, premiumHistory-Antwort, current_user null bei active=0, delete räumt Historie.
- Client test/… (Fake-fetch) für die neuen saves/auth-Hilfen. `npm run test:fast`, `npm run smoke` (desktop). Oberfläche per
  Playwright mit Fake-Backend, Foto nach scratchpad/konto-seite/ und ansehen.
