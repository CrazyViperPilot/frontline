// Admin-Panel, Reiter „Statistik“ (Regeln: docs/prd/statistik.md): Besucherstatistik aus api/admin.php (Aktionen traffic,
// errors, feedback, feedbackdone, feedbackdelete). Verlauf als SVG-Linien ohne Bibliothek, CSV-Export je Tabelle im Browser.
// Kein Modul; nutzt call und handle aus admin.js (window.flAdmin). Alle Texte vom Server über textContent, nie innerHTML.

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  let days = 30;
  let feedback = [];

  const int = (v) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('de-DE'));
  const pct = (v) => (v === null || v === undefined ? '–' : `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`);
  const ratio = (n, of) => (of ? pct(n / of) : '–');
  const mins = (s) => (s === null || s === undefined ? '–' : `${(s / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} min`);
  const hours = (s) => `${(s / 3600).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`;
  const stamp = (ts) => new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const LABELS = {
    conquest: 'Eroberung', classic: 'Klassisch', easy: 'Leicht', normal: 'Normal', hard: 'Schwer', random: 'Zufall',
    mobile: 'Handy', tablet: 'Tablet', desktop: 'Desktop', off: 'aus',
  };
  const label = (k) => LABELS[k] ?? k;

  function el(tag, text = '', className = '') {
    const e = document.createElement(tag);
    if (text !== '') e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  function tile(title, value, note = '') {
    const box = el('div', '', 'tile');
    box.append(el('span', title, 'tile-label'), el('b', value, 'tile-value'));
    if (note) box.append(el('span', note, 'small'));
    return box;
  }

  // ---- CSV -------------------------------------------------------------------------------------------

  /** CSV mit Semikolon und BOM (Excel öffnet es so richtig); Werte mit ; " oder Zeilenumbruch in Anführungszeichen. */
  function csv(cols, rows) {
    const q = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return `﻿${[cols.map((c) => q(c.label)), ...rows.map((r) => cols.map((c) => q(c.csv ? c.csv(r) : r[c.key])))].map((l) => l.join(';')).join('\r\n')}\r\n`;
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Tabelle mit Überschrift und CSV-Knopf. cols: [{ key, label, show?(row) → Text, csv?(row) → Wert, cls?(row) }].
   * Liefert das Element (section).
   */
  function table(title, file, cols, rows, empty = 'Noch keine Daten.') {
    const sec = el('section', '', 'tr-table');
    const head = el('div', '', 'tr-head');
    head.append(el('h2', title, 'sub'));
    const b = el('button', 'CSV');
    b.type = 'button';
    b.title = `${title} als CSV herunterladen`;
    b.addEventListener('click', () => download(`frontline-${file}-${days}d.csv`, csv(cols, rows)));
    head.append(b);
    sec.append(head);
    const wrap = el('div', '', 'table-wrap');
    const t = el('table');
    const tr = el('tr');
    for (const c of cols) tr.append(el('th', c.label));
    const thead = el('thead');
    thead.append(tr);
    const tbody = el('tbody');
    if (!rows.length) {
      const r = el('tr', '', 'empty');
      const td = el('td', empty);
      td.colSpan = cols.length;
      r.append(td);
      tbody.append(r);
    }
    for (const row of rows) {
      const r = el('tr');
      for (const c of cols) {
        const td = el('td', c.show ? c.show(row) : String(row[c.key] ?? '–'), c.cls ? c.cls(row) : '');
        td.dataset.label = c.label;
        r.append(td);
      }
      tbody.append(r);
    }
    t.append(thead, tbody);
    wrap.append(t);
    sec.append(wrap);
    return sec;
  }

  /** Zählung [{k, n}] als Tabelle mit Anteil. */
  const countTable = (title, file, list, keyLabel) => {
    const total = list.reduce((s, x) => s + x.n, 0);
    return table(title, file, [
      { key: 'k', label: keyLabel, show: (r) => label(r.k) },
      { key: 'n', label: 'Anzahl', show: (r) => int(r.n) },
      { key: 'share', label: 'Anteil', show: (r) => ratio(r.n, total), csv: (r) => (total ? (r.n / total).toFixed(3) : '') },
    ], list);
  };

  // ---- Linien ----------------------------------------------------------------------------------------

  /** Liniendiagramm: perDay [{day, …}], series [{key, label, color}]. Nur SVG, skaliert mit der Breite. */
  function chart(perDay, series, title) {
    const W = 720;
    const H = 200;
    const P = { l: 48, r: 8, t: 12, b: 32 }; // Ränder für die Beschriftung (auf dem Handy größer gesetzt, admin.css)
    const box = el('figure', '', 'chart');
    box.append(el('figcaption', title, 'sub'));
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', title);
    const max = Math.max(1, ...perDay.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
    const n = perDay.length;
    const x = (i) => P.l + (n > 1 ? (i / (n - 1)) * (W - P.l - P.r) : (W - P.l - P.r) / 2);
    const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
    const line = (x1, y1, x2, y2, cls) => {
      const l = document.createElementNS(SVG, 'line');
      Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
      l.setAttribute('class', cls);
      svg.append(l);
    };
    const text = (tx, ty, s, anchor = 'start') => {
      const t = document.createElementNS(SVG, 'text');
      t.setAttribute('x', tx);
      t.setAttribute('y', ty);
      t.setAttribute('text-anchor', anchor);
      t.textContent = s;
      svg.append(t);
    };
    for (const f of [0, 0.5, 1]) {
      line(P.l, y(max * f), W - P.r, y(max * f), 'grid');
      text(P.l - 6, y(max * f) + 4, (max * f).toLocaleString('de-DE', { maximumFractionDigits: max < 10 ? 1 : 0 }), 'end');
    }
    if (n) {
      text(x(0), H - 4, shortDay(perDay[0].day), 'start');
      text(x(n - 1), H - 4, shortDay(perDay[n - 1].day), 'end');
    }
    for (const s of series) {
      const pl = document.createElementNS(SVG, 'polyline');
      pl.setAttribute('points', perDay.map((d, i) => `${x(i).toFixed(1)},${y(d[s.key] ?? 0).toFixed(1)}`).join(' '));
      pl.setAttribute('stroke', s.color);
      pl.setAttribute('class', 'series');
      svg.append(pl);
      perDay.forEach((d, i) => {
        const c = document.createElementNS(SVG, 'circle');
        c.setAttribute('cx', x(i).toFixed(1));
        c.setAttribute('cy', y(d[s.key] ?? 0).toFixed(1));
        c.setAttribute('r', n > 40 ? 1.5 : 2.5);
        c.setAttribute('fill', s.color);
        const t = document.createElementNS(SVG, 'title');
        t.textContent = `${shortDay(d.day)} · ${s.label}: ${int(d[s.key] ?? 0)}`;
        c.append(t);
        svg.append(c);
      });
    }
    box.append(svg);
    const legend = el('div', '', 'legend');
    for (const s of series) {
      const item = el('span', s.label);
      item.style.setProperty('--c', s.color);
      legend.append(item);
    }
    box.append(legend);
    return box;
  }

  // ---- Bericht ---------------------------------------------------------------------------------------

  function render(r) {
    const t = r.totals;
    const tiles = $('tr-tiles');
    tiles.textContent = '';
    const ended = t.finished + t.quits + t.closes;
    tiles.append(
      tile('Aufrufe', int(t.views), `Editor: ${int(t.editorViews)}`),
      tile('Besucher je Tag (Summe)', int(t.visitors), `Ø ${int(Math.round(t.visitors / Math.max(1, r.perDay.length)))} je Tag`),
      tile('Partien gestartet', int(t.starts), `beendet ${int(t.finished)} · Siege ${int(t.wins)}`),
      tile('Abgebrochen', int(t.quits + t.closes), `zum Menü ${int(t.quits)} · Tab zu ${int(t.closes)}`),
      tile('Abbruchquote', pct(t.abortRate), `von ${int(ended)} beendeten oder abgebrochenen`),
      tile('Spielzeit gesamt', hours(t.playSec), `Ø je Besucher und Tag ${mins(r.playtime.avgVisitorDay)}`),
      tile('Einwilligungen', pct(t.consentShare), `${int(t.players)} Spieler mit ID`),
    );

    const charts = $('tr-charts');
    charts.textContent = '';
    charts.append(
      chart(r.perDay, [
        { key: 'views', label: 'Aufrufe', color: '#c9a227' },
        { key: 'visitors', label: 'Besucher', color: '#7fb8e6' },
        { key: 'starts', label: 'Partien gestartet', color: '#a8d8a0' },
        { key: 'finished', label: 'beendet', color: '#e0a0e0' },
        { key: 'closes', label: 'Tab geschlossen', color: '#ff8a8a' },
      ], 'Verlauf je Tag'),
      chart(r.perDay.map((d) => ({ ...d, playMin: Math.round(d.playSec / 6) / 10 })), [
        { key: 'playMin', label: 'Spielzeit (min)', color: '#c9a227' },
      ], 'Spielzeit je Tag'),
    );

    const s = $('tr-sections');
    s.textContent = '';
    const first = r.funnel[0]?.n || 0;
    s.append(table('Trichter (Besucher je Tag)', 'trichter', [
      { key: 'k', label: 'Stufe' },
      { key: 'n', label: 'Besucher', show: (x) => int(x.n) },
      { key: 'share', label: 'vom Aufruf', show: (x) => ratio(x.n, first), csv: (x) => (first ? (x.n / first).toFixed(3) : '') },
    ], r.funnel));

    const pt = r.playtime;
    const buckets = pt.games.map((b, i) => ({ k: b.k, games: b.n, visitorDays: pt.visitorDays[i].n, players: pt.players[i].n }));
    s.append(table('Spielzeit-Verteilung', 'spielzeit', [
      { key: 'k', label: 'Spielzeit' },
      { key: 'games', label: 'Partien', show: (x) => int(x.games) },
      { key: 'visitorDays', label: 'Besucher je Tag', show: (x) => int(x.visitorDays) },
      { key: 'players', label: 'Spieler mit ID (Zeitraum)', show: (x) => int(x.players) },
    ], buckets));
    s.append(table('Spielzeit (Median)', 'spielzeit-median', [
      { key: 'k', label: 'Bezug' },
      { key: 'v', label: 'Median', show: (x) => mins(x.v), csv: (x) => x.v },
    ], [
      { k: 'je Partie', v: pt.medianGame },
      { k: 'je Besucher und Tag', v: pt.medianVisitorDay },
      { k: 'je Spieler mit ID (Zeitraum)', v: pt.medianPlayer },
    ]));

    const ret = r.retention;
    s.append(table(`Wiederkehr (Spieler mit Einwilligung, erster Tag im Zeitraum: ${int(ret.cohort)})`, 'wiederkehr', [
      { key: 'k', label: 'Tag' },
      { key: 'back', label: 'wieder da', show: (x) => int(x.back) },
      { key: 'of', label: 'davon erreichbar', show: (x) => int(x.of) },
      { key: 'rate', label: 'Quote', show: (x) => ratio(x.back, x.of), csv: (x) => (x.of ? (x.back / x.of).toFixed(3) : '') },
    ], [1, 7, 30].map((n) => ({ k: `D${n}`, ...ret[`d${n}`] }))));
    s.append(el('p', `Ø Partien je Spieler mit ID: ${pt.avgGamesPerPlayer === null ? '–' : pt.avgGamesPerPlayer.toLocaleString('de-DE')}. Dn = an Tag n oder später nach dem ersten Tag wieder aktiv.`, 'small'));

    const p = r.popular;
    const grid = el('div', '', 'tr-grid');
    grid.append(
      countTable('Modus', 'modus', p.modes, 'Modus'),
      countTable('Computergegner', 'gegner', p.opponents, 'Gegner'),
      countTable('Schwierigkeit (je Gegner)', 'schwierigkeit', p.difficulty, 'Stufe'),
      countTable('Karte', 'karten', p.maps, 'Karte'),
      countTable('Wetter', 'wetter', p.weather, 'Wetter'),
      table('Menü-Schalter', 'schalter', [
        { key: 'k', label: 'Schalter' },
        { key: 'on', label: 'an', show: (x) => int(x.on) },
        { key: 'off', label: 'aus', show: (x) => int(x.off) },
        { key: 'share', label: 'Anteil an', show: (x) => ratio(x.on, x.on + x.off), csv: (x) => (x.on + x.off ? (x.on / (x.on + x.off)).toFixed(3) : '') },
      ], p.switches),
      countTable('Abbruch in Spielminute', 'abbruchminute', r.abortMinute, 'Minute'),
      countTable('Geräte (Besucher je Tag)', 'geraete', r.devices, 'Gerät'),
      countTable('Browser (Besucher je Tag)', 'browser', r.browsers, 'Browser'),
      countTable('Versionen (Besucher je Tag)', 'versionen', r.versions, 'Version'),
    );
    s.append(grid);

    s.append(table('Tage', 'tage', [
      { key: 'day', label: 'Tag' },
      { key: 'views', label: 'Aufrufe' },
      { key: 'editorViews', label: 'Editor' },
      { key: 'visitors', label: 'Besucher' },
      { key: 'starts', label: 'gestartet' },
      { key: 'finished', label: 'beendet' },
      { key: 'quits', label: 'zum Menü' },
      { key: 'closes', label: 'Tab zu' },
      { key: 'playSec', label: 'Spielzeit', show: (x) => mins(x.playSec), csv: (x) => x.playSec },
    ], [...r.perDay].reverse()));
  }

  function renderErrors(list) {
    const box = $('tr-errors');
    box.textContent = '';
    box.append(table('Fehler (gruppiert nach Meldung)', 'fehler', [
      { key: 'message', label: 'Meldung', cls: () => 'mail' },
      { key: 'where', label: 'Ort', show: (x) => `${x.file || '–'}:${x.line}`, csv: (x) => `${x.file}:${x.line}` },
      { key: 'n', label: 'Anzahl', show: (x) => int(x.n) },
      { key: 'lastVersion', label: 'letzte Version' },
      { key: 'page', label: 'Seite', show: (x) => (x.page === 'editor' ? 'Editor' : 'Spiel') },
      { key: 'lastAt', label: 'zuletzt', show: (x) => stamp(x.lastAt), csv: (x) => new Date(x.lastAt * 1000).toISOString() },
      { key: 'firstAt', label: 'zuerst', show: (x) => stamp(x.firstAt), csv: (x) => new Date(x.firstAt * 1000).toISOString() },
    ], list, 'Keine Fehler gemeldet.'));
  }

  // ---- Feedback --------------------------------------------------------------------------------------

  function shownFeedback() {
    const st = $('fb-status').value;
    const th = $('fb-thumb').value;
    const q = $('fb-search').value.trim().toLowerCase();
    return feedback.filter((f) => (st === 'all' || (st === 'done') === f.done)
      && (th === 'all' || (th === 'up' && f.thumb === 1) || (th === 'down' && f.thumb === -1) || (th === 'none' && f.thumb === null))
      && (!q || f.text.toLowerCase().includes(q)));
  }

  function renderFeedback() {
    const list = shownFeedback();
    $('fb-count').textContent = `${list.length} von ${feedback.length}`;
    const box = $('tr-feedback');
    box.textContent = '';
    const sec = table('Feedback-Eingang', 'feedback', [
      { key: 'createdAt', label: 'Eingang', show: (x) => stamp(x.createdAt), csv: (x) => new Date(x.createdAt * 1000).toISOString() },
      { key: 'thumb', label: 'Daumen', show: (x) => (x.thumb === 1 ? '👍' : x.thumb === -1 ? '👎' : '–'), csv: (x) => x.thumb ?? '' },
      { key: 'text', label: 'Text', cls: () => 'fb-text' },
      { key: 'version', label: 'Version' },
      { key: 'mode', label: 'Modus', show: (x) => (x.mode ? label(x.mode) : '–') },
      { key: 'duration', label: 'Partiedauer', show: (x) => (x.duration === null ? '–' : mins(x.duration)), csv: (x) => x.duration ?? '' },
      { key: 'place', label: 'Ort', show: (x) => ({ pause: 'Pause', end: 'Ende' }[x.place] ?? '–') },
      { key: 'device', label: 'Gerät', show: (x) => `${label(x.device)} · ${x.browser}`, csv: (x) => `${x.device} ${x.browser}` },
      { key: 'done', label: 'Erledigt', show: () => '', csv: (x) => (x.done ? 'ja' : 'nein') },
    ], list, 'Kein Feedback im Filter.');
    // Haken und Löschen je Zeile (letzte Spalte); die Zeilen stehen in derselben Reihenfolge wie list
    sec.querySelectorAll('tbody tr:not(.empty)').forEach((tr, i) => {
      const f = list[i];
      const td = tr.lastElementChild;
      td.className = 'acts-cell';
      const acts = el('div', '', 'acts');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = f.done;
      cb.className = 'check';
      cb.setAttribute('aria-label', 'erledigt');
      cb.addEventListener('change', () => setDone(f, cb.checked, cb));
      const del = el('button', 'Löschen', 'danger');
      del.type = 'button';
      del.addEventListener('click', () => removeFeedback(f));
      acts.append(cb, del);
      td.append(acts);
      if (f.done) tr.classList.add('done');
    });
    box.append(sec);
  }

  async function setDone(f, done, cb) {
    try {
      await window.flAdmin.call('feedbackdone', { id: f.id, done });
      f.done = done;
      renderFeedback();
    } catch (err) {
      cb.checked = !done;
      fail(err);
    }
  }

  async function removeFeedback(f) {
    if (!window.confirm('Diese Rückmeldung endgültig löschen?')) return;
    try {
      await window.flAdmin.call('feedbackdelete', { id: f.id });
      feedback = feedback.filter((x) => x !== f);
      renderFeedback();
    } catch (err) {
      fail(err);
    }
  }

  function fail(err) {
    if (err.status === 401) window.flAdmin.handle(err);
    else $('traffic-msg').textContent = err.message;
  }

  // ---- Laden -----------------------------------------------------------------------------------------

  async function load() {
    $('traffic-msg').textContent = 'Lade …';
    document.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.days) === days)));
    try {
      const [r, e, f] = await Promise.all([
        window.flAdmin.call('traffic', { days }),
        window.flAdmin.call('errors'),
        window.flAdmin.call('feedback'),
      ]);
      render(r);
      renderErrors(e.errors);
      feedback = f.feedback;
      renderFeedback();
      $('traffic-msg').textContent = `Zeitraum ${shortDay(r.from)} bis ${shortDay(r.to)} (Ortszeit des Servers).`;
    } catch (err) {
      fail(err);
    }
  }

  document.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    load();
  }));
  $('reload-traffic').addEventListener('click', load);
  ['fb-status', 'fb-thumb'].forEach((id) => $(id).addEventListener('change', renderFeedback));
  $('fb-search').addEventListener('input', renderFeedback);

  window.flTraffic = { load, csv };
})();
