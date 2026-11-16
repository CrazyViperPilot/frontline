# Architektur: Spielstand

Ausgelagert aus `ARCHITEKTUR.md` (§8). Lesen, wenn es um Speichern, Laden oder das Format des Spielstands geht. Regeln und Pflege: PRD §16.

`core/snapshot.js` wandelt einen Objektgraphen (Maps, Sets, Typed Arrays, Zyklen, Klasseninstanzen, `makeRng`-Zustand) in JSON und zurück;
`game/savegame.js` meldet Klassen (`CLASSES`) und feste Spieldaten (`STATICS`: nur Verweise)
an und bietet `snapshotGame` / `restoreGame`.
Abgeleitetes steht nicht im Stand: `snapshotGame` ersetzt beim Kodieren das Gelände durch sein Grobraster (oder nichts) und das Raster durch den Unterschied zum Raster der Karte (`terrainGrid`),
`restoreGame` baut beide neu auf; Zwischenspeicher (Sichtfelder in `fog.js`, beste Zielklasse in `combat.js`, Straßentransport) liegen in `WeakMap`s.
Ein Verweis auf `Grid` oder `Relief` von anderswo im Zustand bricht das Speichern ab (beide fehlen in `CLASSES`).
`ui/saves.js` speichert in IndexedDB und auf dem Webspace (PHP `api/save.php` in diesem Repo),
`main.js` ruft es auf (`captureSave`, `resumeGame`). Regeln und Pflege: PRD §16. `SAVE_FORMAT` steht auf 6; Stände mit einem anderen Format laden nicht (`main.js`,
Liste im Startmenü: „andere Version, nicht ladbar“).
