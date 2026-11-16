# Rezept: Neue Ware

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

## Überblick: Ressourcen der Stadt (Regel 11 der `CLAUDE.md`)

Wer Ressourcen der Stadt (Rohwaren, Werke, Waren, Bedarf und Verarbeitungsformeln) ändert, beachtet:

- Zellenarten stehen im Register `js/data/citykinds.js`, Waren im Register `js/data/goods.js`.
  Das Register enthält Namen, Farben, Lager, Markt und Rollen.
  Alle Listen in Simulation, UI und Darstellung leiten sich daraus ab.
- Rohwaren (Einfuhr, Paket „Import“) stehen in `IMPORTS` im selben Register.
- Dazu die Kette `CITY.chain` in `js/data/city.js` (Bedarf je Einheit Produkt, **Ressourcenanzeige**, PRD §15)
  und die Logik in `updateCity` (`js/game/city/economy.js`, Einfuhr in `runWorks`).
- Die Wege zu den Einfuhrpunkten rechnet `js/game/transport.js` (`tr.imports`).
- `test/flow.test.js`, `test/import.test.js`, `test/config.test.js` (Preisregel) und `test/registry.test.js` prüfen das.
- Rezepte dazu: `docs/rezepte/neue-stadtzellenart.md` und `docs/rezepte/neue-ware.md` (dieses Rezept).

## Schritte

Für Waren, die ein Werk der Stadt erzeugt und die im Lager der Hauptstadt, im Stadtlager oder als Zwischenprodukt (ohne Lager) laufen.
Neue Sorten der FOB-Lager und LKW (wie Baumaterial, Munition, Treibstoff) brauchen mehr (Lager, LKW, HUD) und sind nicht Teil dieses Rezepts.

1. `js/data/goods.js`: Eintrag in `GOODS` mit `name`, `short`, `color`, `store` (`'main'` oder `'city'`; ohne Lager kommt die Ware nicht an), `yield`,
   für den Markt `sell` und `buy`, bei `store: 'city'` den Hinweis `full`.
   Markt, Marktmenü, Ressourcenanzeige (Knoten, Farbe, Lager), Infofeld des Werks, Stadtzahlen (`cap`/`inp`/`gross`)
   und Straßentransport ins Lager folgen daraus.
2. Werk: Zeile in `CITY.chain` (`js/data/city.js`) mit `need` (Rohwaren je Einheit Produkt, siehe `docs/rezepte/neue-rohware.md`) und `to` (die Ware).
   Meist mit neuer Zellenart (Rezept `docs/rezepte/neue-stadtzellenart.md`).
3. Logik in `updateCity` (`js/game/city/economy.js`): Gutschrift ins Lager (`main.store` bzw. Feld `c.<Ware>` mit Startwert in `createCity`) und Verbrauch.
   KI-Regeln (`aiNeed`, Markt) optional.
4. `test/registry.test.js` und `test/flow.test.js` laufen lassen (sie prüfen Register, Kette und Stadtzahlen).
   PRD §15 und Eintrag in `docs/changes/` (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
