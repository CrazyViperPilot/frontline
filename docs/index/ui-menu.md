# Symbol-Index ui-menu

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/ui/menu/`. Pfade relativ zu `js/ui/menu/`.

## account-flow.js (5.9 KB)
- accMsg(err) – Meldung zu einem Fehler: err.status gesetzt → Satz aus api/auth.php, sonst Netz…
- makeToggles(acc, draw) – Statistik und Detailbereich ein-/ausklappen: { toggleDetail, toggleStats }
- makeRun(acc, draw) – Liefert run(job)
- makeSubmit(acc, draw, run, accountChanged, onSynced) – Formulare abschicken: liefert submit(kind, form)
- makeClick(acc, draw, run, { toggleDetail, toggleStats }, accountChanged) – Knöpfe im Konto-Bereich: liefert click(act)

## account-html.js (8.4 KB)
- accountHtml(st, { compact = false, hint = '', locked = null, stats = false, details = false }) – Konto-Bereich (KO3)

## account.js (5.4 KB)
- takeAccountLink() – Link-Parameter aus der Adresse (Rücksprung von den Mails): ?verified=1|0, ?rese…
- initFromLink(link) – Anfangszustand für wireAccount aus dem Rücksprung-Link (takeAccountLink): Hinwe…
- wireAccount(box, { compact = false, hint = '', locked = null, stats = fals… – Konto-Bereich in `box` (das Element mit [data-account]) für Start- und Pausenme…

## common.js (3.1 KB)
- DIFFS – Gemeinsame Bausteine der Overlay-Menüs (Start, Pause, Hilfe, Ende): Auswahllist…
- POINTS
- WEATHER_LABELS
- MOOD_LABELS
- setFullscreen(on)
- markFullscreen(root) – Schalter im offenen Menü an den Vollbild-Zustand anpassen (auch nach Zurück-Ges…
- volRow(kind, value) – Lautstärke-Regler 0–100 % mit Prozentzahl; kind 'sfx' (Geräusche) oder 'music'…
- esc(s)
- fmtTime(s)
- show(root, kind, html)
- hideOverlay(root)

## end.js (3.0 KB)
- showEnd(root, { winner, team, reason, stats }, onRestart) – Endbildschirm

## help.js (0.7 KB)
- showHelp(root) – Hilfe mit allen Tasten

## pause.js (7.4 KB)
- showPause(root, onResume, onQuit, onSave, audio, saveAs, account, display) – Pausenmenü: onResume() bei „Weiter“, onQuit() bei „Zum Startmenü“

## prefs.js (2.8 KB)
- MOOD_KEY – Startmenü: Lichtstimmung (nur Optik)
- WEATHER_KEY – Startmenü: Wetter aus, Zufall oder feste Jahreszeit
- RESEARCH_KEY – Startmenü: Forschung an/aus
- RIVER_KEY – Startmenü: Flüsse auf Zufallskarten an/aus
- CONQUEST_KEY – Startmenü: Modus Eroberung an/aus
- TICKETS_KEY – Startmenü: Start-Tickets der Eroberung
- OPP_KEY – Startmenü: Zahl der Computergegner (1 bis 3, nur Eroberung)
- OPP_DIFF_KEY – + Nummer des Gegners: seine Schwierigkeit
- BUILD_KEY – Startmenü: Baugebiet der Stadt an/aus
- LOWRES_KEY – Start- und Pausenmenü: Bildauflösung „Leistung“ (1× statt bis 2×, nur Darstellu…
- readLowRes() – Bildauflösung „Leistung“ an? URL ?lowres=1 bzw. ?lowres=0 hat Vorrang (zum Prüf…
- writeLowRes(on) – Bildauflösung merken (Startmenü und Pausenmenü)
- readMapSel()
- readFlag(key, dflt) – Ein/Aus-Einstellung des Startmenüs (gemerkt)
- writeFlag(key, on)
- readChoice(key, allowed, dflt) – Gemerkte Auswahl des Startmenüs (eine von `allowed`, sonst dflt)
- writeChoice(key, v)
- writeMapSel(v)

## start-account.js (1.7 KB)
- wireStartAccount(root, wallet, saves) – Konto im Startmenü: `wallet` und `saves` sind createWallet/createSaves aus star…

## start-html.js (12 KB)
- startHtml() – Das ganze Startmenü (Abschnitt „menu start“)

## start-maps.js (6.0 KB)
- renderMapBox(root, s) – Bereich unter „Karte“ neu zeichnen (Zufall: Hinweis, gespeichert: Auswahl, Bear…
- mapChange(root, s) – change-Handler des Startmenüs: Kartenauswahl und Import einer Karten-Datei
- mapClick(root, s, b) – Knöpfe der Kartenwahl (Zufall, Gespeichert, Neue Karte, Editor, Bearbeiten, Lös…

## start-saves.js (6.8 KB)
- createWallet(root) – Kasse (KA1): nur am Konto
- createSaves(root, resume) – Schnellknopf „Fortsetzen“ (neuester nicht beendeter Stand) und die Liste der Sp…

## start-state.js (5.8 KB)
- readStartState() – Gemerkte Wahlen des Startmenüs als Zustandsobjekt (Standards: BALANCE.menuDefau…
- markStart(root, s) – Knöpfe und Felder des Startmenüs an den Zustand `s` anpassen
- applySetting(s, b) – Eine Schalter-Wahl nach einem Klick übernehmen und merken

## start.js (3.9 KB)
- showStartMenu(root, onStart, { resume = null }) – Startmenü: onStart({conquest, difficulty, difficulties (je Computergegner), win…
