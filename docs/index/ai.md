# Symbol-Index ai

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/ai/`. Pfade relativ zu `js/ai/`.

## ai.js (11 KB)
- class AI
  - constructor(game, team, difficulty)
  - update(dt)
  - think()
  - snapshot()
  - once(key, secs) – Befehls-Drosselung: true, wenn der Schlüssel `secs` s lang nicht gesperrt war;…
  - restoreMemory() – Ergänzt nach dem Laden eines älteren Standes fehlende Felder: cityMem bekommt d…

## cityai.js (1.3 KB)
- cityAiMemory (aus common.js) – Stadt-KI (PRD §15, seit v5.60 aus js/game/city.js hierher, Review A-04): Ausbau…
- aiCity (aus build.js)
- aiAirport (aus airbase.js)
- aiRaid (aus raid.js)
- aiDefend (aus raid.js)

## cooldown.js (1.8 KB)
- block(table, key, secs, now) – Sperrt `key` für `secs` Sekunden ab `now` (überschreibt eine bestehende Sperre)
- ready(table, key, now) – true, wenn `key` zur Zeit `now` nicht gesperrt ist (nie gesperrt oder Sperre ab…
- take(table, key, secs, now) – Prüft `key` wie ready() und sperrt ihn bei Erfolg für `secs` s. Liefert true, w…
- prune(table, now) – Entfernt alle Sperren, die bis `now` abgelaufen sind (sie wirken ohnehin nicht…
