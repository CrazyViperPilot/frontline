# Frontline – Plan „Match-Token: Speichern und erst am Ende verbrauchen“ (ein Paket)

**Stand:** gebaut (MS2, Branch `match-token-save`, noch nicht auf `main`). Regeln: [docs/prd/konto.md](prd/konto.md), Abschnitt „Signierter Match-Start (MS1)“, Absätze „Token erst am Ende verbraucht (MS2)“ und „Token im Spielstand (MS2)“.

Daniel, 2026-11-13: zwei Verbesserungen am signierten Match-Start (MS1):
1. **Gespeicherte/fortgesetzte Partien bleiben gewertet.** Das Match-Token wird im Spielstand mitgespeichert; beim Fortsetzen meldet das
   Partieende damit `finish`.
2. **Abgebrochene Partien verbrauchen kein Token.** Das Token wird **erst bei erfolgreichem `finish` verbraucht**, nicht beim Start.

## Heutiger Stand (MS1)
- `js/ui/match.js`: `matchStart()` nimmt ein Token aus dem Vorrat und **entfernt es sofort** (`splice`, dann gespeichert). `finishMatch(token, wallet)`
  meldet und füllt danach den Vorrat neu. Vorrat in localStorage (`VORRAT_KEY`), ausstehende Endstände (`loadAusstehend`).
- `js/main.js`: `startGame` ruft `matchStart()`; bei Treffer Startgeld = `w0`, Token in der laufenden Sitzung gemerkt; Partieende ruft `finishMatch`.
- `js/ui/saves.js`: Rec `{ meta, bytes }`, `meta` Felder (id, name, version, format, createdAt, updatedAt, gameTime, points, winPoints,
  difficulty, ended, size). Server `api/save.php` speichert bekannte meta-Felder.

## Umsetzung

### Token erst am Ende verbrauchen (js/ui/match.js)
- `matchStart()`: Token **nicht mehr splicen**. Stattdessen ein verwendbares Token auswählen und als `{ token, w0 }` zurückgeben, es bleibt
  im Vorrat. (Es ist weiter „bereit“, bis es durch `finish` verbraucht wird.) `matchReady()`-Anzeige entsprechend: zählt verwendbare Tokens;
  ein laufendes, noch nicht beendetes Spiel darf dieselbe Zahl zeigen (das Token ist erst nach `finish` weg).
- `finishMatch(token, wallet)` bzw. der Erfolgsfall: **jetzt** das Token aus dem Vorrat entfernen (nach erfolgreicher Server-Antwort; bei
  409/401 ebenfalls entfernen, es ist verbraucht oder ungültig). Doppelstart derselben Partie ist kein Thema (eine Partie zur Zeit); sollte
  dasselbe Token zweimal zu `finish` führen, gewinnt der erste, der zweite bekommt 409 (ungewertet) – akzeptabel.
- Rand: Bricht man ab (kein `finish`), bleibt das Token im Vorrat und ist beim nächsten Start wieder da. Gewollt.

### Token im Spielstand (js/main.js, js/ui/saves.js)
- Die laufende Partie trägt schon Token und w0 (MS1). Beim **Speichern** eines gewerteten Spiels: `meta.match = { token, w0 }` mitgeben
  (null/fehlt = ungewertet). `js/ui/saves.js`: `meta.match` durchreichen; **lokal** (IndexedDB) speichern.
- **Nicht zum Server hochladen:** In `remotePush` (bzw. wo `meta` an `api/save.php` geht) das Feld `match` entfernen, damit das Token (ein
  Einlöse-Berechtigungsschein) nicht in der Server-Tabelle liegt. Folge: Fortsetzen einer gewerteten Partie bleibt **auf demselben Gerät**
  gewertet; über ein anderes Gerät fortgesetzt läuft sie ungewertet (seltener Fall, in der Doku nennen). `api/save.php` muss `match` also
  nicht kennen; falls es unbekannte Felder abweist, dort nichts ändern, weil `match` gar nicht erst hochgeht.
- **Fortsetzen** (`resumeGame`): ist `meta.match` vorhanden, die Partie als gewertet fortsetzen (Token und w0 in die Sitzung), sonst
  ungewertet. Am Ende `finishMatch`. Das Token muss noch im Vorrat sein (es wurde beim Start nicht verbraucht) – prüfen und, falls es
  nicht mehr im Vorrat ist (z. B. anderes Gerät), ungewertet behandeln, nicht abstürzen.
- Beendete Partie (`ended: true`): wie bisher, `meta.match` entfernen.

### Doku und Tests
- `docs/prd/konto.md` (Abschnitt Match-Start: „Token erst am Ende verbraucht; im Spielstand gespeichert, lokal; Fortsetzen auf demselben
  Gerät bleibt gewertet“). `docs/changes/match-token-speichern.md` (mit **Titel**). Plan-Stand „gebaut“.
- `test/match.test.js` erweitern: Abbrechen (kein finish) lässt den Vorrat unverändert; finish verbraucht das Token; eine Rec mit
  `meta.match` wird lokal gespeichert, aber ohne `match` hochgeladen (remotePush-Payload prüfen); Fortsetzen mit vorhandenem/fehlendem Token.
- `npm run test:fast`, `npm run smoke` (desktop). Backend unverändert (keine PHP-Änderung nötig); falls doch, lokal wie gehabt prüfen.
