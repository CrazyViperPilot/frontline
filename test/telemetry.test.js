// Besucherstatistik, Browser (js/ui/telemetry.js, docs/prd/statistik.md) ohne DOM: Einwilligung, Warteschlange, Senden,
// Herzschlag, Ende, Fehlerdrossel, Rückmeldung, Widerruf, Konto-ID. Alles Äußere (Speicher, Zeit, Netz) wird eingespeist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry, CONSENT_KEY, PID_KEY, QUEUE_KEY, QUEUE_MAX } from '../js/ui/telemetry.js';
import { consentHtml } from '../js/ui/menu/consent.js';
import { feedbackHtml, FEEDBACK_MAX } from '../js/ui/menu/feedback.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

/** Statistik mit Fakes: Uhr (clock.t in ms), Anfragen (sent), Antwort (reply), Sichtbarkeit. */
function setup({ storage = memStorage(), enabled = true, reply = { ok: true, status: 204 } } = {}) {
  const clock = { t: 1_000_000 };
  const sent = [];
  const beacons = [];
  const state = { visible: true, reply };
  let n = 0;
  const tele = createTelemetry({
    page: 'game',
    enabled,
    storage,
    now: () => clock.t,
    request: async (url, text) => {
      sent.push({ url, body: JSON.parse(text) });
      return typeof state.reply === 'function' ? state.reply(JSON.parse(text)) : state.reply;
    },
    beacon: (url, text) => {
      beacons.push(JSON.parse(text));
      return true;
    },
    visible: () => state.visible,
    randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (i + n++) % 256),
    uuid: () => '11111111-1111-4111-8111-111111111111',
    version: 'v9.9',
  });
  return { tele, clock, sent, beacons, state, storage };
}

test('Ohne Einwilligung: nichts auf dem Gerät außer der Antwort; Ereignisse nur im Speicher, ohne Spieler-ID', async () => {
  const { tele, storage, sent } = setup();
  assert.equal(tele.consent(), null);
  tele.track('menu');
  assert.equal(storage.map.size, 0, 'kein Schlüssel ohne Einwilligung');
  await tele.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.p, null);
  assert.equal(sent[0].body.pg, 'game');
  assert.equal(sent[0].body.v, 'v9.9');
  assert.match(sent[0].body.s, /^[0-9a-f]{16}$/);
  assert.deepEqual(sent[0].body.e, [{ k: 'menu', a: 0 }]);
  assert.equal(tele.queue.length, 0, 'angenommen: aus der Warteschlange');
  tele.setConsent(false);
  assert.deepEqual([...storage.map.keys()], [CONSENT_KEY], 'Nein speichert nur die Antwort');
});

test('Warteschlange: höchstens 200, die ältesten fallen weg; Fehlschlag behält, Alter in Sekunden', async () => {
  const { tele, clock, sent, state } = setup({ reply: { ok: false, status: 0 } });
  for (let i = 0; i < QUEUE_MAX + 30; i++) tele.track('beat', { m: i }, 'aaaaaaaaaaaaaaaa');
  assert.equal(tele.queue.length, QUEUE_MAX);
  assert.equal(tele.queue[0].d.m, 30);
  await tele.flush();
  assert.equal(sent.length, 1, 'offline: ein Versuch, dann später');
  assert.equal(tele.queue.length, QUEUE_MAX);
  state.reply = { ok: true, status: 204 };
  clock.t += 65_000;
  await tele.flush();
  assert.equal(sent[1].body.e.length, 50, 'höchstens 50 je Anfrage');
  assert.equal(sent[1].body.e[0].a, 65);
  assert.equal(tele.queue.length, 0, 'bis zu vier Bündel je Durchgang');
});

test('Mit Einwilligung: Spieler-ID und Warteschlange im Speicher, übersteht einen neuen Seitenaufruf', async () => {
  const storage = memStorage();
  const a = setup({ storage, reply: { ok: false, status: 503 } });
  a.tele.setConsent(true);
  assert.equal(storage.getItem(CONSENT_KEY), 'yes');
  assert.equal(storage.getItem(PID_KEY), '11111111-1111-4111-8111-111111111111');
  a.tele.track('menu');
  assert.equal(JSON.parse(storage.getItem(QUEUE_KEY)).length, 1);
  const b = setup({ storage });
  assert.equal(b.tele.queue.length, 1, 'Warteschlange vom letzten Mal');
  await b.tele.flush();
  assert.equal(b.sent.at(-1).body.p, '11111111-1111-4111-8111-111111111111');
  assert.equal(JSON.parse(storage.getItem(QUEUE_KEY)).length, 0);
});

test('Widerruf: optout an den Server, ID und Warteschlange gelöscht', () => {
  const storage = memStorage({ [CONSENT_KEY]: 'yes', [PID_KEY]: '22222222-2222-4222-8222-222222222222', [QUEUE_KEY]: '[]' });
  const { tele, sent } = setup({ storage });
  tele.setConsent(false);
  assert.deepEqual(sent.at(-1).body, { action: 'optout', p: '22222222-2222-4222-8222-222222222222' });
  assert.equal(storage.getItem(PID_KEY), null);
  assert.equal(storage.getItem(QUEUE_KEY), null);
  assert.equal(tele.pid(), null);
});

test('Partie: Herzschlag je 60 s sichtbarer, nicht pausierter Zeit; Ende einmal mit Dauer und Spielminute', () => {
  const { tele, clock, state } = setup();
  const game = { paused: false, sec: 0 }; // Spielzeit der Simulation läuft nur ohne Pause
  tele.gameStart({ mode: 'conquest' }, () => ({ paused: game.paused, minute: game.sec / 60 }));
  const step = (sec) => {
    for (let i = 0; i < sec / 5; i++) {
      clock.t += 5000;
      if (!game.paused) game.sec += 5;
      tele.tick();
    }
  };
  step(60);
  game.paused = true;
  step(120); // pausiert: zählt nicht
  game.paused = false;
  state.visible = false;
  step(60); // versteckt: zählt nicht
  state.visible = true;
  step(65);
  clock.t += 600_000; // Gerät schlief: höchstens 10 s
  tele.tick();
  const beats = tele.queue.filter((e) => e.k === 'beat');
  assert.equal(beats.length, 2);
  assert.equal(beats[1].d.m, 3, 'Spielminute der Partie (180 s)');
  tele.gameEnd('win');
  tele.gameEnd('quit');
  const ends = tele.queue.filter((e) => e.k === 'end');
  assert.equal(ends.length, 1, 'kein doppeltes Ende');
  assert.deepEqual(ends[0].d, { r: 'win', dur: 135, m: 3 }); // 60 + 65 s gespielt + 10 s nach dem Schlaf
  assert.equal(new Set(tele.queue.map((e) => e.g)).size, 1, 'alle Ereignisse der Partie mit derselben gid');
  assert.equal(tele.running, false);
});

test('Neue Partie ohne Ende der alten: die alte endet als quit', () => {
  const { tele } = setup();
  tele.gameStart({ mode: 'classic' }, () => ({ paused: false, minute: 1 }));
  tele.gameStart({ mode: 'classic' }, () => ({ paused: false, minute: 0 }));
  assert.deepEqual(tele.queue.map((e) => e.k), ['start', 'end', 'start']);
  assert.equal(tele.queue[1].d.r, 'quit');
  assert.notEqual(tele.queue[0].g, tele.queue[2].g);
});

test('Fehler: jede Meldung einmal, höchstens 5 je Seitenaufruf, Datei nur als Pfad', () => {
  const { tele } = setup();
  tele.reportError('A', 'https://phpexpert.de/frontline/js/main.js?x=1', 7);
  tele.reportError('A', '', 0);
  for (const m of ['B', 'C', 'D', 'E', 'F', 'G']) tele.reportError(m);
  const errs = tele.queue.filter((e) => e.k === 'error');
  assert.equal(errs.length, 5);
  assert.deepEqual(errs[0].d, { msg: 'A', file: '/frontline/js/main.js', line: 7 });
});

test('Beim Verlassen: sendBeacon, angenommene Ereignisse verlassen die Warteschlange', () => {
  const { tele, beacons } = setup();
  tele.track('menu');
  tele.flush(true);
  assert.equal(beacons.length, 1);
  assert.equal(tele.queue.length, 0);
});

test('Ausgeschaltet (lokal, Tests, ?debug=1): keine Ereignisse, kein Netz', async () => {
  const { tele, sent, beacons } = setup({ enabled: false });
  tele.track('menu');
  tele.gameStart({ mode: 'classic' }, () => ({}));
  tele.gameEnd('win');
  await tele.flush();
  tele.flush(true);
  assert.equal(tele.queue.length, 0);
  assert.equal(sent.length + beacons.length, 0);
});

test('Rückmeldung: Version, Dauer und Modus der laufenden bzw. letzten Partie; Fehler mit Meldung des Servers', async () => {
  const { tele, sent, state, clock } = setup();
  tele.gameStart({ mode: 'conquest' }, () => ({ paused: false, minute: 0 }));
  clock.t += 5000;
  tele.tick();
  await tele.feedback({ text: 'Gut', thumb: 1, place: 'pause' });
  assert.deepEqual(sent.at(-1).body, { action: 'feedback', text: 'Gut', thumb: 1, v: 'v9.9', dur: 5, mode: 'conquest', place: 'pause', p: null });
  tele.gameEnd('loss');
  await tele.feedback({ text: 'x', place: 'end' });
  assert.equal(sent.at(-1).body.dur, 5);
  assert.equal(sent.at(-1).body.mode, 'conquest');
  state.reply = { ok: false, status: 429, data: { error: 'Heute sind schon genug Rückmeldungen angekommen. Danke!' } };
  await assert.rejects(tele.feedback({ text: 'y' }), /genug Rückmeldungen/);
  state.reply = { ok: false, status: 0 };
  await assert.rejects(tele.feedback({ text: 'y' }), /Keine Verbindung/);
});

test('Konto: link übernimmt die Spieler-ID des Kontos (dieselbe auf allen Geräten), nur mit Einwilligung', async () => {
  const storage = memStorage({ [CONSENT_KEY]: 'yes', [PID_KEY]: '11111111-1111-4111-8111-111111111111' });
  const { tele, sent, state } = setup({ storage });
  state.reply = () => ({ ok: true, status: 200, data: { pid: '33333333-3333-4333-8333-333333333333' } });
  await tele.linkAccount();
  assert.deepEqual(sent.at(-1).body, { action: 'link', p: '11111111-1111-4111-8111-111111111111' });
  assert.equal(storage.getItem(PID_KEY), '33333333-3333-4333-8333-333333333333');
  const none = setup();
  await none.tele.linkAccount();
  assert.equal(none.sent.length, 0, 'ohne Einwilligung keine Verknüpfung');
});

test('Startmenü und Formular: Frage, Schalter und Hinweis „Was wird erfasst?“; Feedback mit Grenze 1000', () => {
  assert.match(consentHtml(null), /Anonyme Spielstatistik teilen\?/);
  assert.match(consentHtml(null), /data-consent-set="yes">Ja</);
  assert.match(consentHtml('yes'), /data-consent-set="yes" aria-pressed="true">An</);
  assert.match(consentHtml('no'), /data-consent-set="no" aria-pressed="true">Aus</);
  for (const c of [null, 'yes']) assert.match(consentHtml(c), /Was wird erfasst\?[\s\S]*IP-Adresse wird nie gespeichert/);
  assert.equal(FEEDBACK_MAX, 1000);
  assert.match(feedbackHtml(), /maxlength="1000"/);
  assert.match(feedbackHtml(), /Angehängt: Version, Partiedauer, Modus/);
});
