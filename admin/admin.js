// Admin-Panel (ADM1, Regeln: docs/prd/konto.md „Admin-Panel“): Anmeldung und Benutzerliste über api/admin.php.
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
      td.colSpan = 9;
      td.textContent = users.length ? 'Keine Adresse passt zur Suche.' : 'Noch keine Konten.';
      tr.append(td);
      tbody.append(tr);
      return;
    }
    for (const u of shown) tbody.append(row(u));
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
  $('search').addEventListener('input', renderRows);

  start();
})();
