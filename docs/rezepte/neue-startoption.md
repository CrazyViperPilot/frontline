# Rezept: Neue Option im Startmenü

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

1. Standard in `BALANCE.menuDefaults`; `js/ui/menu/` → `showStartMenu` (`start.js`):
   Zustand (`readStartState`, `markStart`, `applySetting` in `start-state.js`),
   Schalter im HTML (`start-html.js`),
   Speicherung (`readFlag`/`writeFlag` mit eigenem Schlüssel `frontline-…` in `prefs.js`),
   Wert in `onStart({ … })` (`start.js`).
2. `js/main.js` → `startGame`: Wert an `new Game({ … })` weitergeben.
3. `js/game/game.js` → Konstruktor-Option mit Standard **aus**, an das Feature-Modul weitergeben
   (Regel 9 der `CLAUDE.md`: Startmenü-Schalter sind in `new Game()` ohne Angabe aus, im Menü standardmäßig an).
