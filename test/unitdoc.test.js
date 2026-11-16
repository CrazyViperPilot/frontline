// Die Rollenbeschreibungen der Einheiten in docs/prd/einheiten.md (§6, Tabelle vor „### Werte“) dürfen keine Zahlen zu Geld, Stahl,
// Einwohnern, Plätzen oder Tasten nennen, die von den Daten abweichen. Zahlen dieser Art stehen in den erzeugten Tabellen oder in
// js/data/ (CITY.metalCost, CITY.crew). Nur diese Werte werden geprüft: HP, Heilraten und Mechanik-Zahlen bleiben im Text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../js/data/units.js';
import { CITY } from '../js/data/city.js';

const DOC = fileURLToPath(new URL('../docs/prd/einheiten.md', import.meta.url));

/** Zeilen der Rollentabelle (zwischen „## 6.“ und „### Werte“), nur Datenzeilen. */
function roleRows() {
  const text = readFileSync(DOC, 'utf8');
  const start = text.indexOf('## 6. Einheiten');
  const end = text.indexOf('### Werte');
  assert.ok(start >= 0 && end > start, 'Abschnitt „## 6. Einheiten“ mit „### Werte“ fehlt in docs/prd/einheiten.md');
  const lines = text.slice(start, end).split('\n');
  const rows = lines.filter((line) => line.startsWith('| ') && !line.startsWith('| Einheit |'));
  // Paket „Kurze Zeilen“: lange Rollen stehen als Aufzählung unter der Tabelle („- **Einheit:** …“, Fortsetzung eingerückt);
  // jeder Punkt wird wie eine Tabellenzeile „| Einheit | Text |“ geprüft.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \*\*(.+?):\*\* (.*)$/);
    if (!m) continue;
    let body = m[2];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) body += ' ' + lines[++i].trim();
    rows.push(`| ${m[1]} | ${body} |`);
  }
  return rows;
}

/** Einheit, die eine Zeile nennt: der längste Name (Groß-/Kleinschreibung beachtet), der in der ersten Zelle steht. */
function unitOf(row) {
  const first = row.split('|')[1] ?? '';
  let best = null;
  for (const [key, u] of Object.entries(UNITS)) {
    if (first.includes(u.name) && (!best || u.name.length > UNITS[best].name.length)) best = key;
  }
  return best;
}

const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));

test('Rollentext nennt keine Geld-, Stahl-, Einwohner-, Platz- oder Tastenzahl, die von den Daten abweicht', () => {
  const problems = [];
  let checked = 0;
  for (const row of roleRows()) {
    const key = unitOf(row);
    if (!key) continue;
    checked++;
    const u = UNITS[key];
    const where = `${u.name}: „${row.split('|')[1].trim()}“`;
    const checks = [
      [/(\d[\d.,]*) Geld/g, (v) => v === (u.cost?.money ?? 0), `Geld, Daten ${u.cost?.money ?? 0}`],
      [/(\d[\d.,]*) Stahl/g, (v) => v === (CITY.metalCost[key] ?? 0), `Stahl, Daten ${CITY.metalCost[key] ?? 0}`],
      [/(\d[\d.,]*) Einwohner/g, (v) => v === (CITY.crew[key] ?? CITY.crew.default), `Einwohner, Daten ${CITY.crew[key] ?? CITY.crew.default}`],
      [/(\d[\d.,]*) Plätze/g, (v) => v === (u.slots ?? 1), `Plätze, Daten ${u.slots ?? 1}`],
    ];
    for (const [re, ok, label] of checks) {
      for (const m of row.matchAll(re)) {
        if (!ok(num(m[1]))) problems.push(`${where}: „${m[0]}“ (${label})`);
      }
    }
    for (const m of row.matchAll(/Taste \*\*([A-ZÄÖÜ])\*\*|Geld, Taste ([A-ZÄÖÜ])\b/g)) {
      const letter = m[1] ?? m[2];
      if (letter !== u.hotkey) problems.push(`${where}: „${m[0]}“ (Taste, Daten ${u.hotkey})`);
    }
  }
  assert.ok(checked >= 30, `zu wenige Einheiten in der Rollentabelle erkannt (${checked})`);
  assert.deepEqual(problems, [], `Rollentext weicht von den Daten ab (Zahlen in den Tabellen „Werte“ und „Waffen und Schaden“ lassen):\n${problems.join('\n')}`);
});
