# Rezept: Neue Stadtzellenart

Teil der Rezepte für Erweiterungen (Einstieg: `CLAUDE.md` im Wurzelordner, Abschnitt „Wegweiser“).

Überblick über Register, Kette und Tests: `docs/rezepte/neue-ware.md`, Abschnitt „Überblick“.

1. `js/data/citykinds.js`: Eintrag in `CITY_KINDS` an der Stelle seiner Baumenü-Gruppe (`group`).
   Mit der **nächsten freien `id`** (höchste + 1; IDs stehen in Spielständen, nie umnummerieren).
   Dazu `name`, `short`, `icon`, `color`, `tip`, `cost`, `power`, `target`,
   optional `bm`, `size` (Großbau), `jobs` (Arbeitsplätze, Pendler), `works` (Werk), `supply` (liefert über die Straße), `flat`.
   Damit stehen Werkzeug, Preis, Größe, Strom, Name, Schild, Tipp, KI-Zielwert und alle Rollenlisten (Straßentransport, Infofeld,
   Warnschilder) fest.
   In `test/registry.test.js` die Art hinten an die feste `KINDS`-Liste hängen.
2. Bild: Maler in `js/render/townhouses.js` (1 × 1, `TALL` und Maler), `js/render/works.js` (Werk 2 × 2, `WORKS_KINDS`)
   oder `js/render/bigbuild.js` (Großbau, `BIG_KINDS` und Teile).
3. Logik in `js/game/city/`, wenn die Art mehr tut als Arbeitsplätze und Strom: z. B. `totals` in `state.js` (Wohnen, Strom, Forschung).
   Werk: Eintrag in `CITY.chain` (`js/data/city.js`: `need` je Rohware, `to` je Ware; im Register `works: true`)
   und `WORK_ORDER` in `economy.js` (leitet sich aus dem Register ab).
   Die Einfuhr eines neuen Werks läuft über `tr.imports` ohne weiteren Eintrag.
   Ausbildung `CITY.produces`, Pflege `CITY.care.by`; Infozeilen in `js/ui/hud/cityinfo.js` (`cityInfo`).
   KI optional (`CITY.ai.mix`, `aiNeed` in `js/ai/city/need.js`).
4. Test, PRD §15 und Eintrag in `docs/changes/` (Regel 7 der `CLAUDE.md`: PRD und Änderungseintrag pflegen).
