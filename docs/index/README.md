# Symbol-Index

Je Ordner unter `js/` eine Liste „Datei → Exporte“: Funktionen mit Parametern, Konstanten, Klassen und Mixin-Objekte
mit ihren Methoden (eingerückt), dazu der erste Satz des Kommentars darüber.
Wozu: die Datei einer Funktion finden, ohne ganze Dateien zu lesen; den Index gezielt lesen oder durchsuchen.
Keine Zeilennummern: die Zeile im Code findet eine Suche nach dem Namen.

- Erzeugt von `npm run index` (`tools/index.mjs`); **nicht von Hand ändern**.
- Nach Änderungen an Exporten unter `js/` neu erzeugen; `test/index.test.js` (in `npm run test:quick`) meldet einen veralteten Index.
- Name der Datei: Ordner mit `-` statt `/` (`game-city.md`); kleine Ordner (`js/`, `core/`, `audio/`, `editor/`) stehen in `core.md`.
  Große Ordner sind nach Anfangsbuchstaben geteilt (`game-a-g.md`), höchstens 12 KB je Datei.
- Wird nicht ausgeliefert (nicht in `sw.js`, nicht im Upload).
