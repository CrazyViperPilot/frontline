// Endbildschirm (Sieg oder Niederlage mit Spielzeit, Punkten bzw. Tickets und Statistik je Team, Feedback). Reines DOM. Export: showEnd.
import { BALANCE } from '../../data/balance.js';
import { esc, fmtTime, show, hideOverlay } from './common.js';
import { feedbackHtml, wireFeedback } from './feedback.js';

/**
 * Endbildschirm. info = { winner, team (eigenes Team), reason ('points' | 'eliminated' | 'tickets'),
 * stats: { time, points: [a, b], winPoints, teams? } }. `teams` (seit v5.65): je Team die Zähler aus game.js (newStats),
 * earned und used; fehlt es, bleiben nur Spielzeit und Siegpunkte.
 */
export function showEnd(root, { winner, team, reason, stats }, onRestart) {
  const won = winner === team;
  const who = BALANCE.teamNames[winner];
  let why;
  if (reason === 'tickets') why = won ? 'Alle Gegner sind ausgeschieden.' : `Du bist ausgeschieden. ${who} liegt nach Tickets vorn.`;
  else if (reason === 'points') why = `${who} hat ${stats.winPoints} Siegpunkte erreicht.`;
  else if (won) why = 'Die Hauptstadt des Gegners ist zerstört.';
  else why = 'Deine Hauptstadt ist zerstört.';
  const rows = [
    ['Einheiten ausgebildet', 'trained'],
    ['Einheiten verloren', 'lost'],
    ['Abschüsse', 'kills'],
    ['Gebäude zerstört', 'buildingsKilled'],
    ['Gebäude verloren', 'buildingsLost'],
    ['Höchste Armeegröße', 'peakUnits'],
    ['Geld aus Prämien', 'earned'],
    ['Munition verbraucht', 'mun'],
    ['Treibstoff verbraucht', 'fuel'],
  ];
  const num = (v) => Math.round(v || 0).toLocaleString('de-DE');
  const val = (t, key) => (key === 'mun' || key === 'fuel' ? num(t.used?.[key]) : num(t[key]));
  const names = BALANCE.teamNames.slice(0, stats.points.length);
  const ptsLabel = stats.tickets ? 'Tickets' : 'Siegpunkte';
  const table = stats.teams
    ? `<table class="keys end-stats">
        <tr class="head"><th></th>${names.map((n, i) => `<td class="${i === team ? 'mine' : ''}">${esc(n)}${i === team ? ' (du)' : ''}</td>`).join('')}</tr>
        <tr><th>Spielzeit</th><td colspan="${names.length}" class="center">${fmtTime(stats.time)}</td></tr>
        <tr><th>${ptsLabel}</th>${names.map((n, i) => `<td class="${i === team ? 'mine' : ''}">${num(stats.points[i])}</td>`).join('')}</tr>
        ${rows
          .map(([label, key]) => `<tr><th>${label}</th>${stats.teams.map((t, i) => `<td class="${i === team ? 'mine' : ''}">${val(t, key)}</td>`).join('')}</tr>`)
          .join('')}
      </table>`
    : `<table class="keys">
        <tr><th>Spielzeit</th><td>${fmtTime(stats.time)}</td></tr>
        <tr><th>${ptsLabel}</th><td>${names.map((n, i) => `${n} ${stats.points[i]}`).join(' : ')}</td></tr>
      </table>`;
  show(
    root,
    'end',
    `<section class="menu end">
      <h2 class="end-title ${won ? 'win' : 'lose'}">${won ? 'Sieg' : 'Niederlage'}</h2>
      <p class="center">${esc(why)}</p>
      ${table}
      <div class="stack"><button type="button" class="primary" data-act="again">Nochmal</button></div>
      ${feedbackHtml()}
    </section>`,
  );
  wireFeedback(root, 'end'); // Rückmeldung (menu/feedback.js), eigene Klicks
  root.onclick = (e) => {
    if (!e.target.closest('[data-act=again]')) return;
    hideOverlay(root);
    onRestart();
  };
}
