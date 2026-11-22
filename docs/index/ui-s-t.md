# Symbol-Index ui (Teil 2 von 2, status.js bis telemetry.js)

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/ui/`. Pfade relativ zu `js/ui/`.

## status.js (3.1 KB)
- alertText(u) – Zustand der Alarmrotte eines Jets (Paket „Alarmrotte“): Alarmstart, Alarmflug,…
- fobLabel(game, b) – Name einer eigenen FOB nach Reihenfolge der Gründung: „FOB 2“ bzw. „FOB 2 (Baus…
- orderText(game, u) – Kurztext des Auftrags einer eigenen Einheit (Auftragstyp aus Engine)

## telemetry.js (13 KB)
- CONSENT_KEY – 'yes' | 'no'; fehlt = noch nicht gefragt
- PID_KEY – Spieler-ID, nur mit Einwilligung
- QUEUE_KEY – Warteschlange, nur mit Einwilligung
- QUEUE_MAX – Ereignisse in der Warteschlange; darüber fallen die ältesten weg
- createTelemetry(opts) – Statistik-Objekt
- getTelemetry() – Das Statistik-Objekt der Seite
- installTelemetry(page) – Im Browser einrichten (js/main.js für 'game', js/editor/editor.js für 'editor')…
