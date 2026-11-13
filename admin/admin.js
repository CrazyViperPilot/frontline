// Admin-Panel (ADM1, Regeln: docs/prd/konto.md „Admin-Panel“): Anmeldung und Benutzerliste über api/admin.php, seit v5.158
// die Übersicht (Aktion stats) als zweiter Reiter.
// Kein Modul, kein Framework. Alle Texte aus dem Server laufen über textContent, nie über innerHTML.

(() => {
  'use strict';

  const API = new URL('../api/admin.php', location.href).href; // Adresse relativ zu /frontline/admin/
  const $ = (id) => document.getElementById(id);
  let users = [];
  let walletMax = null; // Obergrenze der Kasse aus der Schnittstelle (FL_WALLET_MAX in api/lib/konto.php)

  /** Anfrage an die Admin-API (Cookie fl_admin wird mitgeschickt). Fehler tragen den HTTP-Code in .status (0 = kein Server). */
  async function call(action, data = {}) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
    } catch {
      throw failure(0, 'Keine Verbindung zum Server. Bitte später erneut versuchen.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw failure(res.status, json.error || `Fehler ${res.status}.`);
    return json;
  }

  function failure(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
  }

  // ---- Anzeige ----------------------------------------------------------------------------------------

  function show(section) {
    $('login').hidden = section !== 'login';
    $('panel').hidden = section !== 'panel';
  }

  function showLogin(message) {
    users = [];
    $('rows').textContent = '';
    $('count').textContent = '';
    show('login');
    $('login-msg').textContent = message || '';
    $('pass').value = '';
    $('user').focus();
  }

  function setMsg(text, bad = false) {
    const el = $('msg');
    el.textContent = text || '';
    el.classList.toggle('bad', bad);
  }

  /** Fehler aus einer Aktion: abgelaufene Sitzung führt zur Anmeldung, alles andere steht in der Meldung. */
  function handle(err) {
    if (err.status === 401) showLogin('Die Admin-Sitzung ist abgelaufen. Bitte erneut anmelden.');
    else setMsg(err.message, true);
  }

  const day = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('de-DE') : '–');
  const int = (v) => Number(v).toLocaleString('de-DE');
  const dec = (v) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const signedInt = (v) => (v > 0 ? '+' : '') + int(Math.round(v));
  const stamp = (ts) => (ts
    ? new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'nie');

  function planLabel(u) {
    if (u.plan !== 'premium') return 'Kostenlos';
    return u.premiumUntil ? `Premium (bis ${day(u.premiumUntil)})` : 'Premium (unbefristet)';
  }

  function cell(label, text, className = '') {
    const td = document.createElement('td');
    td.dataset.label = label;
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function button(text, onClick, className = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (className) b.className = className;
    b.addEventListener('click', onClick);
    return b;
  }

  function row(u) {
    const tr = document.createElement('tr');
    tr.append(
      cell('E-Mail', u.email, 'mail'),
      cell('Registriert', stamp(u.createdAt)),
      cell('Bestätigt', u.verifiedAt ? 'ja' : 'nein', u.verifiedAt ? 'yes' : 'no'),
      cell('Letzte Anmeldung', stamp(u.lastLogin)),
      cell('Konto', planLabel(u)),
      cell('Kasse', `${u.wallet} Geld`),
      cell('Gesperrt', u.blocked ? 'ja' : 'nein', u.blocked ? 'no' : ''),
      cell('Spielstände', String(u.saves)),
      cell('Spiele', String(u.games)),
    );
    const acts = document.createElement('div');
    acts.className = 'acts';
    if (!u.verifiedAt) acts.append(button('Freigeben', () => act(u, 'approve'), 'ok'));
    acts.append(u.blocked
      ? button('Entsperren', () => act(u, 'unblock'))
      : button('Sperren', () => act(u, 'block')));
    acts.append(u.plan === 'premium'
      ? button('Auf Kostenlos', () => act(u, 'plan', { plan: 'free' }))
      : button('Auf Premium', () => act(u, 'plan', { plan: 'premium' })));
    acts.append(button('Kasse setzen', () => setWallet(u)));
    acts.append(button('Löschen', () => remove(u), 'danger'));
    const td = document.createElement('td');
    td.dataset.label = 'Aktionen';
    td.className = 'acts-cell';
    td.append(acts);
    tr.append(td);
    return tr;
  }

  function renderRows() {
    const q = $('search').value.trim().toLowerCase();
    const shown = users.filter((u) => u.email.includes(q));
    $('count').textContent = shown.length === users.length
      ? `${users.length} Konten`
      : `${shown.length} von ${users.length} Konten`;
    const tbody = $('rows');
    tbody.textContent = '';
    if (!shown.length) {
      const tr = document.createElement('tr');
      tr.className = 'empty';
      const td = document.createElement('td');
      td.colSpan = 10;
      td.textContent = users.length ? 'Keine Adresse passt zur Suche.' : 'Noch keine Konten.';
      tr.append(td);
      tbody.append(tr);
      return;
    }
    for (const u of shown) tbody.append(row(u));
  }

  // ---- Übersicht (seit v5.158) ------------------------------------------------------------------------

  let view = 'users'; // Reiter: 'users' (Konten) oder 'overview' (Übersicht)

  function setView(name) {
    view = name;
    $('view-users').hidden = name !== 'users';
    $('view-overview').hidden = name !== 'overview';
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    if (name === 'overview') loadOverview();
  }

  function tile(label, value, note = '') {
    const box = document.createElement('div');
    box.className = 'tile';
    const l = document.createElement('span');
    l.className = 'tile-label';
    l.textContent = label;
    const v = document.createElement('b');
    v.className = 'tile-value';
    v.textContent = value;
    box.append(l, v);
    if (note) {
      const n = document.createElement('span');
      n.className = 'small';
      n.textContent = note;
      box.append(n);
    }
    return box;
  }

  /** Tag als Kurzdatum (TT.MM.) für die Achse unter den Balken. */
  const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  function renderOverview(s) {
    $('tiles').textContent = '';
    $('tiles').append(
      tile('Konten', int(s.users), `${int(s.verified)} bestätigt · ${int(s.blocked)} gesperrt`),
      tile('Aktiv in 7 Tagen', int(s.activeLast7d), `in 30 Tagen: ${int(s.activeLast30d)}`),
      tile('Spieler mit Partie', int(s.playing), `von ${int(s.users)} Konten`),
      tile('Partien gesamt', int(s.totalGames), `in 7 Tagen: ${int(s.gamesLast7d)}`),
      tile('Ø Partien je Spieler', s.avgGamesPerPlayer === null ? '–' : dec(s.avgGamesPerPlayer), 'nur Spieler mit mindestens einer Partie'),
      tile('Geld verdient', signedInt(s.totalEarned), s.avgEarned === null ? 'noch keine Partie' : `Ø je Partie ${signedInt(s.avgEarned)}`),
    );

    const max = Math.max(1, ...s.perDay.map((d) => d.games));
    $('days').textContent = '';
    for (const d of s.perDay) {
      const col = document.createElement('div');
      col.className = 'day';
      col.title = `${shortDay(d.day)}: ${d.games} ${d.games === 1 ? 'Partie' : 'Partien'}`;
      const fill = document.createElement('div');
      fill.className = 'day-fill';
      fill.style.height = d.games ? `${Math.max(4, (d.games / max) * 100)}%` : '0';
      col.append(fill);
      $('days').append(col);
    }
    $('day-first').textContent = s.perDay.length ? shortDay(s.perDay[0].day) : '';
    $('day-last').textContent = s.perDay.length ? shortDay(s.perDay[s.perDay.length - 1].day) : '';

    const tbody = $('player-rows');
    tbody.textContent = '';
    if (!s.perUser.length) {
      const tr = document.createElement('tr');
      tr.className = 'empty';
      const td = document.createElement('td');
      td.colSpan = 8;
      td.textContent = 'Noch keine Konten.';
      tr.append(td);
      tbody.append(tr);
      return;
    }
    for (const p of s.perUser) {
      const tr = document.createElement('tr');
      const earned = p.games ? signedInt(p.totalEarned) : '–';
      tr.append(
        cell('E-Mail', p.email, 'mail'),
        cell('Spiele', int(p.games)),
        cell('Siege', int(p.wins)),
        cell('Niederlagen', int(p.losses)),
        cell('Verdient', earned, p.games ? (p.totalEarned < 0 ? 'no' : 'yes') : ''),
        cell('Ø je Partie', p.avgEarned === null ? '–' : signedInt(p.avgEarned)),
        cell('Letzte Partie', p.lastGame ? stamp(p.lastGame) : '–'),
        cell('Kasse', `${int(p.wallet)} Geld`),
      );
      tbody.append(tr);
    }
  }

  async function loadOverview() {
    $('overview-msg').textContent = '';
    try {
      renderOverview(await call('stats'));
    } catch (err) {
      if (err.status === 401) handle(err);
      else $('overview-msg').textContent = err.message;
    }
  }

  // ---- Aktionen ---------------------------------------------------------------------------------------

  async function loadUsers() {
    try {
      const r = await call('users');
      users = r.users || [];
      walletMax = r.walletMax ?? walletMax;
      renderRows();
    } catch (err) {
      handle(err);
    }
  }

  /** Aktion an einem Konto; danach Liste neu laden und die Meldung zeigen. */
  async function act(u, action, extra = {}, done = `${u.email}: erledigt.`) {
    setMsg('');
    try {
      await call(action, { id: u.id, ...extra });
      setMsg(done);
      await loadUsers();
    } catch (err) {
      handle(err);
    }
  }

  /** Kasse des Kontos setzen (0 bis walletMax); die Prüfung macht der Server, seine Meldung steht dann oben. */
  function setWallet(u) {
    const text = window.prompt(`Neue Kasse für ${u.email} in Geld (0 bis ${walletMax ?? 'Obergrenze'}):`, String(u.wallet));
    if (text === null) return;
    act(u, 'setwallet', { value: text.trim() }, `${u.email}: Kasse auf ${text.trim()} gesetzt.`);
  }

  async function remove(u) {
    const n = u.saves;
    const text = `Konto ${u.email} endgültig löschen? Dazu gehören ${n} ${n === 1 ? 'Spielstand' : 'Spielstände'}. Das lässt sich nicht rückgängig machen.`;
    if (!window.confirm(text)) return;
    setMsg('');
    try {
      const r = await call('delete', { id: u.id });
      setMsg(`${u.email} gelöscht (${r.saves} Spielstände entfernt).`);
      await loadUsers();
    } catch (err) {
      handle(err);
    }
  }

  // ---- Start und Anmeldung ----------------------------------------------------------------------------

  async function start() {
    try {
      const me = await call('me');
      $('who').textContent = `angemeldet als ${me.user}`;
      show('panel');
      await loadUsers();
    } catch (err) {
      showLogin(err.status === 401 ? '' : err.message);
    }
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('login-btn');
    btn.disabled = true;
    $('login-msg').textContent = '';
    try {
      const r = await call('login', { user: $('user').value.trim(), password: $('pass').value });
      $('who').textContent = `angemeldet als ${r.user}`;
      $('pass').value = '';
      show('panel');
      setMsg('');
      await loadUsers();
    } catch (err) {
      $('login-msg').textContent = err.message;
      $('pass').value = '';
    } finally {
      btn.disabled = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    try {
      await call('logout');
      showLogin('Abgemeldet.');
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  $('reload').addEventListener('click', loadUsers);
  $('reload-overview').addEventListener('click', loadOverview);
  $('search').addEventListener('input', renderRows);
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  start();
})();
