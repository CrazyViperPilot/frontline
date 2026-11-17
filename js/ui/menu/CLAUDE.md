# js/ui/menu/ – Overlay-Menüs (DOM)

Start, Pause, Hilfe, Ende und Konto; Einstieg mit Re-Exporten ist `../menu.js`. Texte deutsch; Spielhinweise stehen in der HTML-Datei des Startmenüs (bei Regeländerungen mitpflegen).

- `start.js` – setzt das Startmenü zusammen und verdrahtet es. `showStartMenu`
- `start-html.js` – HTML des Startmenüs samt Spielhinweisen. `startHtml`
- `start-state.js` – Zustand der Schalter. `readStartState`, `markStart`, `applySetting`
- `start-saves.js` – Kasse, Spielstände-Liste, Schnellknopf „Fortsetzen“. `createWallet`, `createSaves`
- `start-account.js` – Konto im Startmenü, Rücksprung-Link. `wireStartAccount`
- `start-maps.js` – Kartenwahl. `renderMapBox`, `mapChange`, `mapClick`
- `pause.js` – Pausenmenü. `showPause`
- `help.js` – Hilfefenster, Inhalt aus `../helptext.js`. `showHelp`
- `end.js` – Endbildschirm. `showEnd`
- `account.js` – Konto-Fenster verdrahten, Link aus der Mail. `wireAccount`, `takeAccountLink`
- `account-html.js` – HTML des Kontos. `accountHtml`
- `account-flow.js` – Formulare, Knöpfe, Statistik des Kontos. `makeSubmit`, `makeClick`, `makeRun`
- `prefs.js` – gemerkte Einstellungen (localStorage, Schlüssel `frontline-…`). `readFlag`, `writeFlag`, `readChoice`, `readLowRes`
- `common.js` – Overlay zeigen und schließen, Vollbild, Auswahllisten. `show`, `hideOverlay`, `esc`, `volRow`

## Besonderheiten
- Neue Option im Startmenü: Standard in `BALANCE.menuDefaults`, dann Zustand, HTML, Einstellungen (eigener Schlüssel) und `showStartMenu`.
- Der Zugriff auf Spielstände und Konto läuft über `../saves.js`, nicht direkt über `fetch`.

Exporte dieses Ordners: `docs/index/ui-menu.md` (erzeugt; nach Änderungen an Exporten `npm run index`).
