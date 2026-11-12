# Frontline – Plan „Beliebig viele Spielstände“ (Pakete SP1–SP3)

Daniel, 2026-11-12: beliebig viele Spielstände, je mit **Name**, **Spielversion**, **erstellt am** und **zuletzt gespeichert**
(Datum und Uhrzeit). Speicherort auf dem Webspace: **MySQL 8** (Secrets `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
Heute: genau ein Stand, Datei-Backend `api/save.php`, lokal ein Eintrag in IndexedDB (`js/ui/saves.js`).

## Festlegungen
- Jeder Stand hat eine **id** (UUID, vom Client erzeugt, damit offline angelegte Stände später ohne Konflikt hochgehen).
- Felder: `id`, `name` (1–60 Zeichen), `version` (Spielversion, z. B. `v5.143`), `format` (`SAVE_FORMAT`), `createdAt`, `updatedAt`
  (ms seit 1970, vom Client), dazu wie bisher `gameTime`, `points` [blau, rot], `winPoints`, `difficulty`, `size`, und `data` (gzip).
- **Spielversion:** neue Datei `js/version.js` mit `export const GAME_VERSION = 'v5.143';`, die `npm run release` (tools/release.mjs)
  auf die oberste neue Version setzt; in `sw.js` ASSETS.
- **Neue Partie** → neuer Stand mit Name `Partie <TT.MM.JJJJ HH:MM>` beim ersten (automatischen) Speichern. Automatisches Speichern
  (alle 90 s, Pause, Hintergrund – wie bisher) schreibt immer in den **aktuellen** Stand. Eine beendete Partie wird **nicht** mehr
  gelöscht, sondern bleibt mit Vermerk `ended: true` (nicht fortsetzbar, aber in der Liste sichtbar/löschbar).
- **Lokal + Webspace:** IndexedDB hält alle Stände nach id (Store `saves`), Webspace ebenso. Liste = Vereinigung beider; je id gewinnt
  der neuere `updatedAt`. Neuere lokale Stände werden beim Start nachgeschickt (wie heute). Gelöscht wird auf beiden Seiten.
- Alte Einzel-Stände (bisheriger IndexedDB-Schlüssel) beim ersten Start als Stand „Alter Spielstand“ übernehmen.

## Pakete
| Paket | Inhalt | Stand |
|---|---|---|
| SP1 | Backend: `api/save.php` auf MySQL (PDO), Tabelle `saves` legt sich selbst an; Deploy schreibt `api/config.php` aus den `DB_*`-Secrets; `js/version.js` + release.mjs | gebaut |
| SP2 | Client-Speicher `js/ui/saves.js`: viele Stände (IndexedDB-Store `saves`, Remote-API, Abgleich, Übernahme des alten Stands), `main.js` speichert in den aktuellen Stand | gebaut |
| SP3 | Oberfläche: Startmenü-Liste „Spielstände“ (Name, Version, erstellt, zuletzt gespeichert, Spielzeit, Punkte; Laden, Umbenennen, Löschen), Pause: „Speichern unter …“ (neuer Name) | offen |

### SP1 – API (JSON, wie bisher CORS nur frontline.phpexpert.de und localhost)
- `GET save.php` → `{ saves: [meta …] }` (ohne data, neueste zuerst)
- `GET save.php?id=…` → `{ meta, data }` (data base64)
- `POST {action:'save', meta, data}` → legt an oder ersetzt (upsert nach id); `createdAt` bleibt beim ersten Wert
- `POST {action:'rename', id, name}`, `POST {action:'delete', id}`
- Tabelle: `id CHAR(36) PK, name VARCHAR(60), version VARCHAR(16), format INT, created_at BIGINT, updated_at BIGINT,
  game_time DOUBLE, points_blue INT, points_red INT, win_points INT, difficulty VARCHAR(16), ended TINYINT, size INT, data MEDIUMBLOB`.
- Prüfungen wie bisher (Größe ≤ 12 MB, gzip-Kopf, Pflichtfelder), dazu id-Format und Name.
- `api/config.php` (nicht im Repo, `.gitignore`) mit `['host','port','name','user','password']`; der Deploy-Schritt schreibt sie aus den Secrets.
- Lokaler Test: `php -l`; wenn verfügbar, ein kleiner Test gegen eine lokale MySQL/MariaDB, sonst nur Syntax plus Review.
