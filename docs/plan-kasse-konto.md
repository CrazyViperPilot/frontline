# Frontline – Plan „Kasse am Konto“ (ein Paket)

Daniel, 2026-11-13: Die Kasse (Geld, das von Runde zu Runde bleibt) soll **nur für registrierte, angemeldete Spieler** kumulieren und
dann im Benutzerkonto liegen (gerätübergreifend). **Nicht angemeldete Spieler starten jede Partie mit dem Startbetrag**, keine
Kumulierung, kein `localStorage`-Sparschwein mehr.

## Stand heute
- `js/main.js`: `loadWallet`/`saveWallet`/`resetWallet` über `localStorage` (`WALLET_KEY = 'frontline-kasse'`), Grenze `BALANCE.walletMax`,
  Startbetrag `BALANCE.startRes.money`. Partieende ruft `saveWallet(g.teams[0].res.money)` (js/main.js ~Zeile 474). Startmenü zeigt die
  Kasse (`js/ui/menu.js`, `[data-wallet]`) mit „zurücksetzen“.
- Konto-Client in `js/ui/saves.js`: `accountRequest(body)`, `accountUser()` (setzt `remoteOn`), `setRemoteEnabled(on)`, `remoteEnabled()`.
  Sitzung über Cookie `fl_session`; Backend `api/auth.php`, gemeinsamer Code `api/lib/`.

## Umsetzung

### Backend
- Tabelle `users`: Spalte `wallet BIGINT NOT NULL DEFAULT <Startbetrag>` idempotent nachrüsten (information_schema, wie `blocked` in
  `api/lib/konto.php`). Startwert = `BALANCE.startRes.money`; den Zahlenwert als PHP-Konstante in `api/lib/konto.php` (Kommentar: muss zu
  js/data/balance.js passen), nicht raten – aus balance.js ablesen.
- `api/auth.php`: Antwort-`user` um `wallet` erweitern (also `{email, plan, premiumUntil, createdAt, wallet}`). Neue Aktion
  `POST {action:'wallet', value}` (nur mit Sitzung): setzt die Kasse auf `max(0, min(walletMax, floor(value)))`, `walletMax` als Konstante
  neben dem Startwert. Gibt die gespeicherte Kasse zurück. **Kein Hochzählen serverseitig** (das Spiel meldet den neuen Stand).
  Die Aktion **nur akzeptieren, wenn der neue Wert ≥ dem alten ist oder der alte über walletMax lag** (eine einfache Bremse gegen
  versehentliches Zurücksetzen durch veraltete Clients; echte Betrugssicherheit ist hier nicht das Ziel, siehe Doku).
- Admin: `api/admin.php` `users`-Liste um `wallet` erweitern; neue Aktion `setwallet {id, value}`; die bestehende `plan`-Zeile als Vorbild.

### Client
- `js/ui/saves.js`: Funktionen `accountWallet()` (liest `wallet` aus `me`, oder null wenn nicht angemeldet) und `saveWallet(value)`
  (POST `wallet`, nur wenn angemeldet; offline gemerkt und bei `syncUp` nachgeschickt wie die Stände – einfache Variante: in
  `localStorage` einen „ausstehenden Kassenwert“ halten, beim nächsten `setRemoteEnabled(true)`/`syncUp` senden). Exportieren.
- `js/main.js`: `loadWallet`/`saveWallet` so ändern:
  - **Nicht angemeldet** (`remoteEnabled()` false): `loadWallet()` gibt **immer** `BALANCE.startRes.money`; `saveWallet` tut nichts;
    das Startmenü blendet die Kassenanzeige aus oder zeigt „Mit Konto bleibt dein Geld erhalten“. `WALLET_KEY`/localStorage-Sparschwein entfernen.
  - **Angemeldet:** `loadWallet()` kommt aus `accountWallet()` (beim Öffnen des Startmenüs einmal geladen, zwischengespeichert);
    Partieende ruft `saves.saveWallet(money)`. „zurücksetzen“ setzt auf den Startbetrag (über die Konto-Aktion).
  - Reihenfolge: `accountUser()` beim Start liefert schon `wallet`; nutze das, keinen zweiten Aufruf.
- `js/ui/menu.js`: Kassenzeile nur für Angemeldete; für Gäste ein kurzer Hinweis. Admin-Panel (`admin/admin.js`): Spalte „Kasse“ und ein
  kleines Feld/Knopf „Kasse setzen“ (mit `setwallet`).

### Doku und Tests
- `docs/prd/konto.md` (Kasse am Konto), `docs/prd/ton-speichern.md` falls dort die Kasse erwähnt ist, `docs/changes/kasse-konto.md`
  (mit **Titel**). Hinweis in der Doku: Die Kasse wird im Browser berechnet und ist nicht fälschungssicher; serverseitige
  Plausibilitätsprüfung ist bewusst nicht Teil dieses Pakets (Daniels Entscheidung).
- Tests: `test/saves.test.js` bzw. ein kleiner neuer Test für die Client-Logik (angemeldet → Konto, Gast → Startbetrag). Backend wie in
  KO1/KO2 lokal gegen MariaDB prüfen (Scratchpad), sonst `php -l` + Gegenlesen. `npm run test:fast`, `npm run smoke` (desktop).
- `npm run docs` nur falls Datenwerte geändert (hier nein).

**Stand: gebaut** (KA1, 2026-11-13): Backend (`wallet`, `walletreset`, `setwallet`, Spalte `users.wallet`), Client (`js/ui/saves.js`, `js/main.js`, `js/ui/menu.js`), Admin-Panel, Doku (`docs/prd/konto.md`, `docs/prd/ressourcen-bau.md`), `docs/changes/kasse-konto.md`, `test/kasse.test.js`.
