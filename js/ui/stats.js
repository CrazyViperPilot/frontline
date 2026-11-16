// Spielstatistik im Konto-Bereich des Startmenüs (seit v5.158, docs/prd/konto.md „Spielstatistik“). Nur Anzeige: die Zahlen kommen
// von api/match.php (Aktion stats, ui/match.js matchStats). Kein DOM: statsHtml liefert HTML mit Escape, ui/menu/account-html.js setzt es ein.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => Math.round(v).toLocaleString('de-DE');
const signed = (v) => (v > 0 ? '+' : '') + num(v);
const when = (sec) => new Date(sec * 1000).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const DIFF = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
const RESULT = { win: 'Sieg', loss: 'Niederlage' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Spielzeit in Sekunden als „12 min“ oder „2 h 05 min“. */
export function hm(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** Eine Kennzahl: Name, Wert (schon als HTML geprüft), optionale Zeile darunter. */
const kpi = (label, value, note = '') =>
  `<div class="acc-kpi"><dt>${esc(label)}</dt><dd>${value}</dd>${note ? `<small class="muted">${note}</small>` : ''}</div>`;

/** Eine Partie der Liste: Ergebnis und Verdienst oben, Dauer, Schwierigkeit, Punkte und Kasse darunter. */
function gameItem(g) {
  const res = RESULT[g.result] ?? 'ohne Ergebnis';
  const info = [
    g.duration === null ? null : hm(g.duration),
    DIFF[g.difficulty] ?? null,
    g.pointsOwn === null || g.pointsEnemy === null ? null : `${g.pointsOwn} : ${g.pointsEnemy}`,
  ].filter(Boolean);
  return `<li class="acc-game">
    <div class="acc-game-top"><span class="acc-res ${g.result === 'win' ? 'win' : g.result === 'loss' ? 'loss' : ''}">${esc(res)}</span>
      <span class="acc-earned ${g.earned < 0 ? 'bad' : 'good'}">${signed(g.earned)}</span></div>
    <div class="acc-game-bot muted"><span>${esc(when(g.finishedAt))}${info.length ? ` · ${esc(info.join(' · '))}` : ''}</span>
      <span>${num(g.walletBefore)} → ${num(g.walletAfter)}</span></div>
  </li>`;
}

/**
 * HTML der Spielstatistik aus der Antwort von matchStats(): Kasse, Kennzahlen und die letzten Partien (neueste zuerst).
 * Ohne Partien steht ein Hinweis, warum eine Partie erst mit Token zählt.
 */
export function statsHtml(st) {
  const none = '–';
  const kpis = [
    kpi('Kasse', `${num(st.wallet)} Geld`, `von ${num(st.walletMax)} möglichen`),
    kpi('Gewertete Partien', String(st.games), st.games ? `${plural(st.wins, 'Sieg', 'Siege')} · ${plural(st.losses, 'Niederlage', 'Niederlagen')}` : ''),
    kpi('Verdient insgesamt', st.games ? `${signed(st.totalEarned)} Geld` : none),
    kpi('Ø je Partie', st.avgEarned === null ? none : `${signed(st.avgEarned)} Geld`),
    kpi('Bestes Spiel', st.bestEarned === null ? none : `${signed(st.bestEarned)} Geld`),
    kpi('Schwächstes Spiel', st.worstEarned === null ? none : `${signed(st.worstEarned)} Geld`),
    kpi('Spielzeit', st.totalPlaySeconds > 0 ? hm(st.totalPlaySeconds) : none),
  ].join('');
  const list = st.recent.length
    ? `<ul class="acc-games">${st.recent.map(gameItem).join('')}</ul>
       <p class="muted small">Die letzten ${st.recent.length} Partien, neueste zuerst. Gezählt werden nur gewertete Partien.</p>`
    : '<p class="muted small">Noch keine gewertete Partie. Sie zählt, wenn du mit Konto startest und die Partie gewertet ist (Startmenü: „Gewertete Partien bereit“).</p>';
  return `<div class="acc-stats" data-stats>
    <dl class="acc-kpis">${kpis}</dl>
    ${list}
  </div>`;
}
