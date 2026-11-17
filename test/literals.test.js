// Regel 3: keine Spielwerte als Zahlenliterale in js/ai und js/game (Pakete „KI-Zahlen in die Daten“, „Spielzahlen in die Daten“).
// Erlaubt sind 0, 1, 2 und 0.5 (Indexrechnung, Hälften, Paare). Gewichte, Radien, Schwellen, Zeiten, Faktoren, Effekt- und Meldedauern
// gehören nach js/data (js/data/ai.js, CITY, BALANCE, MAPGEN, UNITS). Übrige Literale (Technik, Geometrie) stehen je Datei mit Grund in ALLOWED.
// Neues Literal: Spielwert → nach js/data; Technik → hier eintragen und begründen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = {
  'ai/army/util.js': ['1e-6'], // Rechengenauigkeit (Nullvektor)
  'ai/army/build.js': ['180'], // Grad in Bogenmaß
  'ai/army/produce.js': ['100000', '1e9'], // Sortierschlüssel (Warteschlange vor Abstand), „lange her“ als Startzeit
  'ai/city/park.js': ['3', '3'], // Geometrie: Werksplätze 2 × 2 rund um den Bahnhof 3 × 3 (parkSlots)
  'game/aircraft.js': ['1e-6', '1e-6', '1e-6', '1e-6', '1e-6', '1e-6', '1e-6', '1e-9', '1e-9'], // Rechengenauigkeit
  'game/animals.js': ['2246822519'], // Seed-Mischung
  'game/city/economy.js': ['1e-6', '1e-6'], // Rechengenauigkeit
  'game/city/query.js': ['1e-6', '4'], // Rechengenauigkeit, Abfrage-Heuristik (Raster statt Liste)
  'game/city/state.js': ['1e9'], // „lange her“
  'game/cmd/build.js': ['1e-9', '8', '4'], // Rechengenauigkeit, 8 Richtungen
  'game/combat.js': ['4', '3', '4', '1.001', '1e6', '1e6'], // Trefferseite (Viertelkreise), Rundung, Sortierschlüssel
  'game/conquest.js': ['9', '4'], // Code „gesperrt“, Teamzahl der Viertelregel
  'game/crates.js': ['100000'], // ID-Basis
  'game/entities.js': ['1e9', '1e-9', '1e-9', '1e-9', '1e9', '1e9'], // Rechengenauigkeit, „lange her“
  'game/flow.js': ['10', '0.005', '0.999', '60', '0.999'], // Zahlenformat, Rundung, „unter 1 min“
  'game/fog.js': ['1.000001'], // Rechengenauigkeit
  'game/formation.js': ['4', '3'], // Rangfolge der Einheitenarten
  'game/game.js': ['180', '1e9', '1e9'], // Grad in Bogenmaß, „lange her“
  'game/garrison.js': ['4', '1e9'], // Geometrie, „lange her“
  'game/grid.js': ['255', '255'], // Byte-Grenze
  'game/hotzone.js': ['1e-6'], // Rechengenauigkeit
  'game/landscape.js': ['3', '512', '256', '256', '255', '256', '256', '255', '255', '3', '3', '2654435761', '90', '3', '3', '5', '3', '5', '3', '118', '372', '1.001', '1.001', '2246822519', '180', '1e-9', '1e-9', '118', '8', '8', '8', '10'], // Rauschen (Permutation, Glättung), Seed-Mischung, Abtastschritte, Speicherbereich der Höhen, Spiegelphasen der Seen
  'game/logistics.js': ['1e-9'], // Rechengenauigkeit
  'game/map.js': ['8', '1.5', '1.5', '1.5', '40', '40', '2654435761', '30', '100', '100', '3', '3'], // Abtastschritte, Blockgeometrie, Seed-Mischung, Rundung, Viertelseiten
  'game/mapdata.js': ['24', '300', '24', '24', '96', '900', '200', '4000', '60', '400', '40', '20', '400', '64', '20', '200', '90', '24', '600', '70', '24', '600', '1e-3', '40', '400', '9', '6', '40', '300', '60', '900', '220', '60', '900', '1e-3', '6', '40'], // Ladegrenzen und Vorgaben für Editor-Karten (Prüfung, keine Spielwerte)
  'game/movement.js': ['128', '2.39996', '1e-6', '1e-6', '100003', '1e-9', '1e-9', '1e-6', '1e-9', '1e-6', '37', '91', '360', '180', '256'], // Hash, goldener Winkel, Rechengenauigkeit
  'game/pathfinding.js': ['1024', '20000', '4', '4', '16777619', '4', '16777619', '4', '8', '4', '4', '1e-9'], // Speichergrößen, FNV-Hash, 4/8 Nachbarn
  'game/relief.js': ['64', '128', '9', '9', '16', '3', '3', '3', '3', '1.000001', '1.000001', '16', '4', '255'], // Speicherformat, Interpolation, Rechengenauigkeit, Abtastschritt
  'game/river.js': ['8', '3', '3', '1e9', '10000', '0.02', '1.02', '0.25', '0.75'], // Abtastschritt, Drittel der Brücke, Toleranz, Effektstellen, ID-Basis
  'game/roads.js': ['255', '255'], // Byte-Grenze
  'game/savegame.js': ['6'], // Formatversion
  'game/transport.js': ['1e-4'], // Rechengenauigkeit
  'game/weather.js': ['2654435761', '20', '20', '100', '100'], // Seed-Mischung, Anzeige-Rundung
};

/** Zahlenliterale einer Quelldatei, ohne Kommentare und Zeichenketten (0, 1, 2, 0.5 ausgenommen). */
function numberLiterals(src) {
  let out = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      i++;
      out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return [...out.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?(?:e-?\d+)?)(?![\w.])/g)].map((m) => m[1]).filter((x) => !['0', '1', '2', '0.5'].includes(x));
}

for (const dir of ['ai', 'game']) {
  test(`js/${dir}: keine Spielwerte als Zahlenliterale (Regel 3)`, () => {
    const root = fileURLToPath(new URL(`../js/${dir}/`, import.meta.url));
    const files = readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const key = `${dir}/${f.split('\\').join('/')}`;
      const got = numberLiterals(readFileSync(join(root, f), 'utf8')).sort();
      const ok = [...(ALLOWED[key] ?? [])].sort();
      assert.deepEqual(got, ok, `js/${key}: Zahlenliterale ${got.join(', ')} – Spielwerte nach js/data (Regel 3), Technik in ALLOWED (test/literals.test.js) begründen`);
    }
  });
}
