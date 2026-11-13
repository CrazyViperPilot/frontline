// Spielstatistik im Konto-Bereich (seit v5.158, js/ui/stats.js, docs/prd/konto.md „Spielstatistik“): reine HTML-Erzeugung
// aus der Antwort von api/match.php (action stats), ohne Browser. Geprüft werden Kennzahlen, Liste, Leerzustand und Vorzeichen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statsHtml, hm } from '../js/ui/stats.js';

const recent = [
  { finishedAt: 1700000000, result: 'win', duration: 912, difficulty: 'hard', walletBefore: 800, walletAfter: 1250, earned: 450, pointsOwn: 100, pointsEnemy: 40, kills: 77 },
  { finishedAt: 1700003600, result: 'loss', duration: null, difficulty: null, walletBefore: 1250, walletAfter: 900, earned: -350, pointsOwn: null, pointsEnemy: null, kills: null },
];
const full = {
  wallet: 900, walletMax: 5000, games: 2, wins: 1, losses: 1, totalEarned: 100, avgEarned: 50, bestEarned: 450, worstEarned: -350,
  totalPlaySeconds: 3725, recent,
};
const empty = { wallet: 800, walletMax: 5000, games: 0, wins: 0, losses: 0, totalEarned: 0, avgEarned: null, bestEarned: null, worstEarned: null, totalPlaySeconds: 0, recent: [] };

test('hm: Spielzeit als Minuten oder Stunden', () => {
  assert.equal(hm(912), '15 min');
  assert.equal(hm(3725), '1 h 02 min');
  assert.equal(hm(0), '0 min');
});

test('Kennzahlen: Kasse, Partien mit Siegen und Niederlagen, Summe, Ø, Bestes und Schwächstes, Spielzeit', () => {
  const html = statsHtml(full);
  assert.match(html, /Kasse<\/dt><dd>900 Geld<\/dd>/);
  assert.match(html, /von 5\.000 möglichen/);
  assert.match(html, /Gewertete Partien<\/dt><dd>2<\/dd><small class="muted">1 Sieg · 1 Niederlage<\/small>/);
  assert.match(statsHtml({ ...full, wins: 2, losses: 0 }), /2 Siege · 0 Niederlagen/);
  assert.match(html, /Verdient insgesamt<\/dt><dd>\+100 Geld/);
  assert.match(html, /Bestes Spiel<\/dt><dd>\+450 Geld/);
  assert.match(html, /Schwächstes Spiel<\/dt><dd>-350 Geld/);
  assert.match(html, /Spielzeit<\/dt><dd>1 h 02 min/);
});

test('Partien: neueste zuerst, Ergebnis, Verdienst mit Farbe, Dauer, Schwierigkeit, Punkte und Kasse vorher/nachher', () => {
  const html = statsHtml(full);
  assert.equal((html.match(/<li class="acc-game">/g) ?? []).length, 2);
  assert.match(html, /<span class="acc-res win">Sieg<\/span>\s*<span class="acc-earned good">\+450<\/span>/);
  assert.match(html, /<span class="acc-res loss">Niederlage<\/span>\s*<span class="acc-earned bad">-350<\/span>/);
  assert.match(html, /15 min · Schwer · 100 : 40/);
  assert.match(html, /800 → 1\.250/);
});

test('Partie ohne bekanntes Ergebnis: neutrale Anzeige, keine Zahl „undefined“ oder „NaN“', () => {
  const html = statsHtml({ ...full, recent: [{ ...recent[1], result: null }] });
  assert.match(html, /ohne Ergebnis/);
  assert.doesNotMatch(html, /undefined|NaN|null/);
});

test('Leerzustand: keine Partie, Striche statt Zahlen, Hinweis auf den Token', () => {
  const html = statsHtml(empty);
  assert.match(html, /Noch keine gewertete Partie/);
  assert.match(html, /Ø je Partie<\/dt><dd>–<\/dd>/);
  assert.match(html, /Bestes Spiel<\/dt><dd>–<\/dd>/);
  assert.doesNotMatch(html, /<li class="acc-game">/);
});
