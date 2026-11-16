# Rezept: Neue Rohware (Einfuhr, Paket „Import“)

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

Überblick über Register, Kette und Tests: `docs/rezepte/neue-ware.md`, Abschnitt „Überblick“.

Für eine Rohware, die von außerhalb der Karte kommt: nicht gelagert, nicht gehandelt, nur von Werken verarbeitet.

1. `js/data/goods.js`: Eintrag in `IMPORTS` mit `name`, `short`, `color` und `price` (Geld je angekommener Einheit).
2. Preisregel prüfen (`test/config.test.js`, `test/import.test.js`):
   Je Werk, das sie braucht, müssen die Rohwaren einer Einheit Produkt mindestens den Marktverkauf je Einheit kosten und höchstens die Hälfte des Kaufpreises.
   Preis oder Bedarf anpassen, bis es stimmt.
3. Bedarf: im Werk `CITY.chain.<Werk>.need` um `{ neu: Menge }` je Einheit Produkt ergänzen.
   Ein Werk, das sie braucht, kommt nur an, wenn es einen Einfuhrpunkt erreicht (automatisch über `tr.imports`).
4. Namen und Farbe in Ressourcenanzeige und Infofeld kommen aus `IMPORTS` (`js/game/flow.js`, `js/ui/citypanel.js`).
5. `test/registry.test.js` und `test/flow.test.js` laufen lassen.
   PRD §15 „Import“ (Tabelle in `docs/prd/stadt-wirtschaft.md`) und Eintrag in `docs/changes/`
   (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
