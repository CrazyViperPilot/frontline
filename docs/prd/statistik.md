# Besucherstatistik und Feedback (§17a)

Daniel sieht im Admin-Panel, wie das Spiel genutzt wird, auch von Gästen ohne Konto, und sammelt Rückmeldungen.
Datenschutz zuerst: ohne Einwilligung nichts auf dem Gerät, nie die IP, keine Dritten, keine fremden Skripte (Regel 5).
Konten und Admin-Panel: [konto.md](konto.md). Entwurf für die Datenschutzerklärung: [docs/datenschutz-statistik.md](../datenschutz-statistik.md).

## Zwei Stufen

| Stufe | Auf dem Gerät | Was möglich ist |
|---|---|---|
| Ohne Einwilligung (Standard) | nur die Antwort auf die Frage (`frontline-statistik` = `no`) | Aufrufe, Besucher je Tag, Partien, Spielzeit, Beliebtheit, Fehler, Feedback |
| Mit Einwilligung | Spieler-ID (`frontline-statistik-id`), Warteschlange (`frontline-statistik-warteschlange`) | dazu Spielzeit je Spieler, Partien je Spieler, Wiederkehr D1/D7/D30 |

- **Besucher je Tag:** Tages-Hash = HMAC-SHA256 aus IP und User-Agent mit einem Salz, das jeden Tag neu entsteht (Tabelle `meta`,
  Schlüssel `track_salt`). Das alte Salz wird ersetzt, die IP nie gespeichert. Ein Besucher ist so nur am selben Tag wiederzuerkennen.
- **Gerät und Browser** bestimmt nur der Server grob aus dem User-Agent (Handy, Tablet, Desktop; Chrome, Safari, Firefox, Edge,
  Opera, Samsung, sonst). Das Spiel liest keine Geräteeigenschaften (Bildschirm, Sprache) per JavaScript.
- **Spieler-ID:** `crypto.randomUUID()`, nur mit Einwilligung. Angemeldete Konten bekommen dieselbe ID auf allen Geräten
  (Spalte `users.stat_id`, Aktion `link`): die Statistik ist dann pseudonym, nicht anonym. Der Hinweis sagt das.
- **Widerruf:** Nein bzw. Aus schickt `optout` mit der ID; der Server löscht alle Ereignisse und Tage der ID, entfernt sie aus
  Rückmeldungen und vom Konto. Danach löscht das Gerät ID und Warteschlange. Löscht der Admin ein Konto, gilt dasselbe.

## Einwilligung (Startmenü)

- Unter dem Konto-Bereich steht einmal die Frage **„Anonyme Spielstatistik teilen?“** mit Ja und Nein, dazu aufklappbar
  „Was wird erfasst?“. Nach der Antwort bleibt dort die Zeile **„Spielstatistik teilen“ An/Aus**, jederzeit änderbar.
- Ohne Antwort zählt der Server wie ohne Einwilligung.
- Dateien: `js/ui/menu/consent.js`, Stil `.consent` in `css/style.css`.

## Erfasste Ereignisse

| Art | Wann | Daten |
|---|---|---|
| `view` | Seitenaufruf: Spiel (zählt `index.php` auf dem Server), Editor (Browser) | – |
| `menu` | Startmenü geöffnet | – |
| `start` | Partie gestartet oder fortgesetzt | Modus, Gegnerzahl, Schwierigkeit je Gegner, Karte (`random` oder ID), Wetter, Forschung, Fluss, Baugebiet, gewertet, fortgesetzt |
| `beat` | je 60 s gespielter Zeit (Tab sichtbar, nicht pausiert) | Spielminute |
| `end` | Partie endet | Ausgang `win`, `loss`, `quit` (zum Menü, neue Partie), `close` (Tab zu), Dauer (gespielte Sekunden), Spielminute |
| `help` | Hilfe (F1) geöffnet | Teil (`keys`); ein Tutorial gibt es nicht |
| `error` | `window.onerror`, `unhandledrejection` | Meldung (300 Zeichen), Datei als Pfad, Zeile; jede Meldung einmal, höchstens 5 je Seitenaufruf |

- Jede Anfrage trägt Version, Seitenaufruf-ID (`s`, Zufall nur im Speicher), Seite und, mit Einwilligung, die Spieler-ID.
  Ereignisse einer Partie tragen dieselbe Partie-ID (`g`, Zufall im Speicher).
- **Partie ohne Ende:** Kommt drei Minuten lang nichts mehr, zählt sie als „Tab geschlossen“ (`FL_TRAFFIC_GONE`).
- **Spielzeit einer Partie** = größere von Ende-Dauer und 60 s je Herzschlag. Ein schlafendes Gerät zählt höchstens 10 s.
- **Senden:** alle 15 s gebündelt per `fetch` mit `keepalive`, beim Verstecken oder Schließen per `navigator.sendBeacon`.
- **Offline:** Warteschlange höchstens 200 Ereignisse, darüber fallen die ältesten weg. Ohne Einwilligung nur im Speicher (beim Schließen
  weg), mit Einwilligung in localStorage. Ereignisse tragen ihr Alter; der Server ordnet sie dem richtigen Tag zu (höchstens 7 Tage alt).
- **Aus:** bei `?debug=1`, auf localhost, unter `file:` und in automatisierten Browsern (`navigator.webdriver`). `?statistik=1`
  schaltet die Erfassung zum Prüfen ein, `?statistik=0` aus.

## Feedback

- Knopf **„Feedback geben“** im Pausenmenü und auf dem Endbildschirm. Er klappt ein Formular auf: Text bis 1000 Zeichen, optional
  Daumen hoch oder runter, Hinweis „Angehängt: Version, Partiedauer, Modus“. Text oder Daumen genügt.
- Angehängt werden Version, Dauer und Modus der laufenden bzw. letzten Partie, Gerät und Browser (Server), mit Einwilligung die ID.
- Feedback geht sofort an den Server, ohne Warteschlange; ohne Netz steht die Meldung unter dem Formular.
- Dateien: `js/ui/menu/feedback.js`, Stil `.feedback` in `css/style.css`.

## Server (`api/track.php`, `api/lib/track.php`)

- POST mit JSON, auch als `text/plain`; Antwort 204 für Ereignisse (auch bei Bots und Drossel), `{ok}` für Feedback.
- **Grenzen:** 16 KB je Anfrage (413), 50 Ereignisse je Anfrage, 600 Ereignisse je Tages-Hash und Tag (darüber still verworfen),
  10 Rückmeldungen je Tages-Hash und Tag (429). Fremde Herkunft 403. Bots (User-Agent leer, „bot“, „headless“, curl …) zählen nicht.
- **Prüfung:** nur bekannte Arten und Felder, Typ und Bereich; Unbekanntes fällt weg (`track_clean_batch`, `track_event_data`).
- **Seitenaufruf des Spiels:** `index.php` zählt nur echte Aufrufe (`Sec-Fetch-Dest: document`, kein Vorabladen, nicht das
  Vorladen des Service Workers) und liefert dann `index.html`. Fehler der Zählung halten das Spiel nie auf.
  `.htaccess`: `DirectoryIndex index.php index.html`; das Manifest startet `./`. Lokal lädt `index.html` direkt.
- **Tabellen** (legen sich selbst an): `tr_events` (Rohereignisse), `tr_daily` (Tagessummen), `tr_player_days` (Tage je Spieler-ID),
  `tr_errors` (Fehler nach Signatur), `tr_feedback`, `tr_limits` (Drossel), `meta` (Salz, Tag des Aufräumens).
- **Aufräumen ohne Cron:** die erste Anfrage eines Tages (`track_daily`, mit `GET_LOCK`) wechselt das Salz, fasst Tage vor der
  Frist in `tr_daily` zusammen, löscht Rohereignisse älter als 90 Tage, Fehlergruppen ohne Auftreten seit 90 Tagen und alte Drosselzähler.
- **Aktion `link`** (mit Sitzung, sonst 401): hat das Konto eine ID, gilt sie; sonst wird die des Geräts gespeichert. Antwort `{pid}`.

## Admin-Panel, Reiter „Statistik“

Zeitraum 7, 30 oder 90 Tage (bis heute, Ortszeit des Servers). Aktionen in `api/admin.php`, Rechnen in `api/lib/traffic.php`.

- **Kacheln:** Aufrufe (Editor extra), Besucher je Tag (Summe), gestartete, beendete, abgebrochene Partien, Abbruchquote
  (Abbrüche ÷ beendete und abgebrochene), Spielzeit gesamt und Ø je Besucher und Tag, Anteil der Einwilligungen.
- **Linien** (SVG ohne Bibliothek): Aufrufe, Besucher, gestartet, beendet, Tab geschlossen je Tag; Spielzeit je Tag.
- **Trichter** je Besucher und Tag: Seite → Startmenü → Partie gestartet → 5 min gespielt → Partie beendet (Sieg oder Niederlage).
- **Spielzeit:** Median je Partie, je Besucher und Tag, je Spieler mit ID; Verteilung <2, 2–10, 10–30, >30 min.
- **Wiederkehr** D1, D7, D30 der Spieler mit ID, deren erster Tag im Zeitraum liegt: Dn = an Tag n oder später wieder aktiv;
  mitgezählt nur, wer Tag n schon erreicht haben kann. Dazu Ø Partien je Spieler mit ID.
- **Beliebtheit:** Modus, Gegnerzahl, Schwierigkeit, Karte, Wetter, Menü-Schalter; Spielminute der Abbrüche (Klassen bis 40+).
- **Geräte, Browser, Versionen** je Besucher und Tag. **Tage** als Tabelle.
- **Fehlerliste** (Aktion `errors`): gruppiert nach Meldung, Datei und Zeile (Zahlen in der Meldung zählen nicht), Anzahl, letzte Version.
- **Feedback-Eingang** (Aktion `feedback`): Filter offen/erledigt/alle, Daumen, Textsuche; Haken „erledigt“ (`feedbackdone`),
  Löschen (`feedbackdelete`). Die letzten 1000 Rückmeldungen.
- **CSV-Export** je Tabelle im Browser (Semikolon, UTF-8 mit BOM).
- Dateien: `admin/traffic.js` (ohne Modul, nutzt `window.flAdmin` aus `admin/admin.js`), `admin/index.html`, `admin/admin.css`.

## Tests

`test/telemetry.test.js` (Browser-Modul ohne DOM: Einwilligung, Warteschlange, Herzschlag, Ende, Drossel, Feedback, Widerruf, Konto-ID),
`test/trackphp.test.js` (PHP-Kommandozeile: Prüfung, Bots, Gerät, Hash, Auswertung, Wiederkehr), `test/admin.test.js` (Verdrahtung).
Von Hand gegen MariaDB und `php -S` geprüft: Speichern, Bot nicht gezählt, Vorladen nicht gezählt, fremde Herkunft 403, 413, Drossel
bei 600, Feedback und 400 bei leerem Text, `link` mit und ohne Sitzung, `optout`, Konto löschen, Aufräumen mit Salzwechsel und
Tagessumme, Admin-Aktionen. Im Browser (Chrome): Frage im Startmenü, Partie, Feedback im Pausenmenü, Fehler, Reiter auf Desktop und Handy.
