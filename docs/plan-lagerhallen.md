# Frontline – Plan „Lagerhallen“

Daniel, 2026-11-18: Entwurf angenommen, Variante 1 (großer Versorgungsumkreis statt Bau in der Zone), Empfehlungen übernommen.

## Gemessen vorher (20 min KI gegen KI, alle Menü-Schalter, Seeds 3, 7, 11)
- Ausbildungsgebäude der KI 1 bis 21 Zellen vom Lager (96 bis 100 % Versorgung); nur Stellplätze 44 bis 72 Zellen (66 bis 83 %).
- Vordere FOBs 3000 bis 5100 px von der Hauptstadt, ihre Lager fast leer (Treibstoff 52 bis 175, Munition 0 bis 300 von 3000);
  meist nur 3 bis 12 LKW-Befehle in 20 min. Zonenrand rund 3550 px von der Hauptstadt (Zone r 3300).
- Stadtzellen, auch Straßen, sind mit Baugebiet in der Zone verboten (`CITY.build.noZone`); FOBs dürfen dort stehen.

## Entscheidungen
- Lagerhalle: Zellenart der Stadt, 2 × 2, im eigenen Baugebiet, braucht eine Straße zum Lager; höchstens eine je vordere FOB.
- Füllt sich über die Straße aus dem Lager der Hauptstadt (Baumaterial, Munition, Treibstoff; Last und Tempo wie Werke); die
  Hauptstadt behält einen Mindestbestand.
- FOBs im Umkreis von etwa 1800 px auffüllen (Variante 1, reicht vom Zonenrand in die Zone), Tempo sinkt mit der Entfernung.
- Ausbildung bis zur Lagerhalle messen: geparkt (bringt laut Messung wenig).

| Paket | Inhalt | Stand |
|---|---|---|
| Lagerhalle 1 | Zellenart, Bau, Füllen über die Straße, Infofeld, LKW laden dort, Einheiten im Umkreis nachfüllen | gebaut |
| Lagerhalle 2 | FOBs im Umkreis (etwa 1800 px) automatisch auffüllen, Ressourcenanzeige | gebaut |
| Lagerhalle 3 | KI baut und nutzt sie; Messung mit `npm run metrics` und `npm run econ` | gebaut (5 von 6 KI-Städten, siehe PRD §10) |
| Zulauf nach Straße | Zulauf so schnell, wie die Straße frei hat (mindestens wie vorher), Abgabe an FOBs mindestens wie Zulauf | gebaut |
| Lagerhalle 4 | Ausbildung misst bis zur nächsten Lagerhalle | geparkt |

## Gemessen nach „Zulauf nach Straße“ (KI, 20 min, Seeds 3, 7, 11)
- Nur mit freier Straßenkapazität kam weniger an als mit festem Zulauf (FOB-Lager z. B. 1041 → 916): die Straßen der KI am Lager sind
  meist voll. Mit Mindestzulauf gleich oder leicht besser als vorher. Die Straße ist der Engpass: Grund für die geparkte Gleis-Anbindung
  (`docs/prd/ideen.md`).
