// Prüfung der Partie-Infos des Match-Starts (api/lib/match.php, match_game_info; seit v5.158) mit der PHP-Kommandozeile: die
// Funktion ist rein (kein Datenbankzugriff). Fehlt php, wird der Test übersprungen. Die übrigen Abläufe (Wertung, Statistik,
// Admin-Übersicht, Löschen) sind gegen MariaDB und php -S von Hand geprüft (docs/prd/konto.md, „Tests“).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIB = join(ROOT, 'api/lib/match.php');

/** Partie-Infos durch match_game_info schicken; liefert das Ergebnis als Objekt. */
function gameInfo(body) {
  const code = `require ${JSON.stringify(LIB)}; echo json_encode(match_game_info(json_decode(getenv('FL_BODY'), true)));`;
  const r = spawnSync('php', ['-r', code], { encoding: 'utf8', env: { ...process.env, FL_BODY: JSON.stringify(body) } });
  return JSON.parse(r.stdout);
}

const NONE = { result: null, duration: null, difficulty: null, seed: null, points_own: null, points_enemy: null, kills: null };

test('match_game_info: gültige Werte bleiben, Dezimalzahlen werden gerundet', (t) => {
  if (spawnSync('php', ['-v']).error) return t.skip('php nicht installiert');
  assert.deepEqual(gameInfo({ game: { result: 'win', duration: 912.4, difficulty: 'hard', seed: 4711, points: [100, 40], kills: 1.5 } }), {
    result: 'win', duration: 912, difficulty: 'hard', seed: 4711, points_own: 100, points_enemy: 40, kills: 2,
  });
  assert.equal(gameInfo({ game: { result: 'loss' } }).result, 'loss');
});

test('match_game_info: ungültige, fehlende und unbekannte Felder werden null; unbekannte Schlüssel fallen weg', (t) => {
  if (spawnSync('php', ['-v']).error) return t.skip('php nicht installiert');
  assert.deepEqual(gameInfo({}), NONE, 'ohne game');
  assert.deepEqual(gameInfo({ game: 'x' }), NONE, 'game ist kein Objekt');
  assert.deepEqual(gameInfo({ game: { result: 'draw', difficulty: 'insane', duration: -5, seed: '12', points: [1], kills: 'viele', evil: 'x' } }), NONE);
  assert.deepEqual(gameInfo({ game: { duration: 86401, points: [100001, -1], kills: -1 } }), NONE, 'Bereichsgrenzen');
  assert.deepEqual(gameInfo({ game: { duration: 86400, points: [0, 100000], kills: 0, seed: 0 } }), { ...NONE, duration: 86400, seed: 0, points_own: 0, points_enemy: 100000, kills: 0 });
});

test('Schema: Tabelle matches mit eindeutiger jti (eine Partie zählt nur einmal)', () => {
  const src = readFileSync(LIB, 'utf8');
  assert.match(src, /CREATE TABLE IF NOT EXISTS matches/);
  assert.match(src, /UNIQUE KEY uq_matches_jti \(jti\)/);
});
