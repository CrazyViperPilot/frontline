// Overlay-Menüs (docs/archiv/verlauf.md §5 ui/menu.js): Start, Pause, Hilfe, Ende. Reines DOM, keine Spiellogik.
// Jedes Menü setzt root.dataset.kind ('start' | 'pause' | 'help' | 'end'), damit die Tastatur weiß, was offen ist.
// Diese Datei ist nur noch der Einstieg: sie führt die Module unter js/ui/menu/ zusammen, alle Namen wie früher.
//
// Thema                                              Modul (js/ui/menu/)
//   Startmenü (showStartMenu, Aufbau und Ereignisse)   start.js
//     HTML, Spielhinweise                              start-html.js
//     Zustand der Schalter (lesen, anzeigen, setzen)   start-state.js
//     Kasse, Spielstände (Fortsetzen, Liste)           start-saves.js
//     Konto im Startmenü (Rücksprung-Link, Kasse)      start-account.js
//     Kartenwahl (Zufall, gespeichert, Import)         start-maps.js
//   Pausenmenü (showPause, Speichern unter, Konto)     pause.js
//   Hilfe (showHelp), Endbildschirm (showEnd)          help.js, end.js
//   Konto (wireAccount, takeAccountLink)               account.js (HTML account-html.js, Abläufe account-flow.js)
//   Gemerkte Einstellungen (readFlag, readLowRes …)    prefs.js
//   Gemeinsames (show/hideOverlay, esc, Vollbild …)    common.js
export { hideOverlay } from './menu/common.js';
export { readLowRes, readShadows } from './menu/prefs.js';
export { takeAccountLink, wireAccount } from './menu/account.js';
export { showStartMenu } from './menu/start.js';
export { showPause } from './menu/pause.js';
export { showHelp } from './menu/help.js';
export { showEnd } from './menu/end.js';
