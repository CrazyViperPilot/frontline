# Architektur der Eroberung: Datenmodell

Ausgelagert aus `ARCHITEKTUR.md` (§5 Datenmodelle). Lesen, wenn es um die Felder von `game.conquest`, Flaggen oder die Viertel-Sperre geht.
Regeln: `docs/prd/eroberung.md`. Logik: `js/game/conquest.js`, Geometrie `js/game/zonegeo.js`, Modus-Register `js/game/modes.js`.

## Datenmodell Eroberung (`game.conquest`)
**Eroberung** (nur mit `conquest`, sonst `null`): `game.conquest = { startTickets, half, x0, y0, size, flags[16], quad[4], open[], held[], noFlag[], timer }`.
Je Flagge `{ id, letter, x, y, owner (−1 = neutral), capTeam, p (Balken 0 bis 1), counts[] (Einheiten je Team im Gebiet), contested }`.
`quad` nennt das Team je Viertel (9 = kein Spieler), `open` die gefallenen Sperren; `zone` bekommt `half` (die Zone ist dann ein Quadrat).
Im Wegraster: `grid.lock` je Zelle das Viertel (Team, 9 = ohne Spieler, −1 = Zone) und `grid.lockOpen` (dasselbe Array wie `conquest.open`),
gebunden von `bindLock` in `conquest.js`, auch nach dem Laden. `game.mode` (Getter) liefert den Modus-Eintrag aus `js/game/modes.js`.
