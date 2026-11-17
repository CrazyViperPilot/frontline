// Alarmrotte (Paket „Alarmrotte“, js/game/scramble.js): Jets in Bereitschaft starten von selbst gegen feindliche Luftfahrzeuge im
// Alarmradius des Fliegerhorsts, fangen sie ab und landen wieder. Hilfen (Stadt, Fliegerhorst) wie in test/airbasehelp.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { UNITS } from '../js/data/units.js';
import { canZone, roadAt } from '../js/game/city/cells.js';
import { KINDS } from '../js/data/citykinds.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { runwaysOf } from '../js/game/aircraft.js';
import { alertOn, alertable } from '../js/game/scramble.js';
import { snapshotGame, restoreGame } from '../js/game/savegame.js';
import { pack, unpack } from '../js/core/snapshot.js';
import { withValue } from './util.js';

const DT = 0.05;
const S = CITY.air.scramble;
const run = (g, s) => {
  for (let i = 0; i < s / DT; i++) g.update(DT);
};

/** Reiche Stadt für Team t. */
function rich(g, t = 0) {
  const c = g.city[t];
  const m = g.mainFob(t);
  g.teams[t].res.money = 1e6;
  Object.assign(m.store, { bm: 30000, mun: 30000, fuel: 30000 });
  c.metal = 3000;
  c.popF = 400;
  c.kero = 3000;
  return { c, m };
}

/** Freie Fläche W × H (mit Rand) nächst der Hauptstadt: linke obere Zelle { q, r }. */
function freeArea(g, c, m, W, H) {
  let best = null;
  const mc = Math.floor(m.x / c.cell);
  const mr = Math.floor(m.y / c.cell);
  for (let r = 1; r < c.rows - H - 1; r++) {
    for (let q = 1; q < c.cols - W - 1; q++) {
      const d = Math.abs(q - mc) + Math.abs(r - mr);
      if (best && d >= best.d) continue;
      let ok = true;
      for (let y = r - 1; ok && y <= r + H; y++) {
        for (let x = q - 1; ok && x <= q + W; x++) {
          const j = y * c.cols + x;
          ok = canZone(g, c, j) && !c.kind[j] && !roadAt(c, j);
        }
      }
      if (ok) best = { q, r, d };
    }
  }
  return best;
}

const kindAt = (c, i) => KINDS[c.kind[i] - 1];

/**
 * Fliegerhorst für Team t: Bahn 10 × 2, darunter Stellplatz, Stellplatz, Tower, Kerosintank, Munitionslager (je 2 × 2).
 * opts.atc / opts.ktank / opts.mdepot = false lassen den Baustein weg. Liefert Bahn, Stellplätze und Lager.
 */
function airbase(g, t = 0, opts = {}) {
  const { c, m } = rich(g, t);
  const a = freeArea(g, c, m, 12, 6);
  assert.ok(a, 'Platz für den Fliegerhorst');
  const { q, r } = a;
  const put = (kind, dq, dr, w = 0, h = 0) => assert.ok(g.issue(t, { type: 'city', kind, c0: q + dq, r0: r + dr, c1: q + dq + w, r1: r + dr + h }).ok, kind);
  put('runway', 0, 0, 9, 1);
  put('stand', 0, 2);
  put('stand', 2, 2);
  if (opts.atc !== false) put('atc', 4, 2);
  if (opts.ktank !== false) put('ktank', 6, 2);
  if (opts.mdepot !== false) put('mdepot', 8, 2);
  // Straßenweg zum Lager ab dem Ende der Bahn (Paket „Straßen“), kostenlos wie beim Startviertel. Tank und Lager brauchen eine eigene
  // Straße zum Lager (Paket „Fliegerhorst-Anschluss“), sonst wachsen sie nicht
  if (opts.link !== false) {
    withValue(CITY.transport, 'connectMax', 400, () => {
      assert.ok(connectRoad(g, c, r * c.cols + q + 9, false) >= 0, 'Weg zum Lager');
      if (opts.ktank !== false) connectRoad(g, c, (r + 2) * c.cols + q + 6, false);
      if (opts.mdepot !== false) connectRoad(g, c, (r + 2) * c.cols + q + 8, false);
    });
  }
  run(g, CITY.growTime + 1);
  const ents = [...c.ents.entries()].filter(([, e]) => e.alive);
  const of = (k) => ents.filter(([i]) => kindAt(c, i) === k).map(([, e]) => e);
  return { c, m, q, r, stands: of('stand'), atc: of('atc')[0], ktank: of('ktank')[0], mdepot: of('mdepot')[0], rw: runwaysOf(g, t).find((x) => x.valid) };
}

/** Fliegerhorst mit vollen Lagern und n startbereiten Jets der Art type (je Stellplatz bis zwei). */
function base(g, n = 1, type = 'f16', opts = {}) {
  const ab = airbase(g, 0, opts);
  const { c, ktank, mdepot, stands } = ab;
  if (ktank) ktank.stock = CITY.air.tank.cap[c.level[ktank.cityCell]];
  if (mdepot) mdepot.stock = CITY.air.depot.cap[c.level[mdepot.cityCell]];
  for (let k = 0; k < n; k++) assert.ok(g.issue(0, { type: 'train', buildingId: stands[Math.floor(k / 2)].id, unit: type }).ok, `${type} ${k + 1}`);
  for (let k = 0; k < 600 && !(g.units.filter((u) => u.def.jet).length === n && g.units.every((u) => !u.def.jet || u.jet?.ready)); k++) run(g, 1);
  const jets = g.units.filter((u) => u.def.jet).sort((a, b) => a.id - b.id);
  assert.equal(jets.length, n, `${n} Jets gebaut`);
  assert.ok(jets.every((u) => u.parked && u.jet.ready), 'startbereit');
  return { ...ab, jets };
}

/** Feindlicher Transporthubschrauber (unbewaffnet) in der Luft nahe am Tower: der Tower sieht ihn (Radar). */
function intruder(g, ab, dx = 250, dy = -250) {
  const h = g.spawnUnit('transporter', 1, ab.atc.x + dx, ab.atc.y + dy);
  h.order = { type: 'idle', x: h.x, y: h.y, targetId: null };
  return h;
}

const phases = (g, u, s) => {
  const seen = new Set();
  for (let t = 0; t < s; t += DT) {
    g.update(DT);
    seen.add(u.jet.phase);
  }
  return seen;
};

test('Bereitschaft: Standard an für Jets mit Luft-Luft-Waffe, A-10, C-130 und U-2 nicht wählbar', () => {
  for (const k of ['f16', 'f22', 'su27']) assert.ok(alertable({ def: UNITS[k] }), k);
  for (const k of ['a10', 'c130', 'u2']) assert.ok(!alertable({ def: UNITS[k] }), k);
  assert.ok(alertOn({ def: UNITS.f16, jet: {} }), 'ohne Feld: Standard an (alter Spielstand)');
  assert.ok(!alertOn({ def: UNITS.f16, jet: { alert: false } }));
});

test('Alarmstart: Hubschrauber im Radius, Jet startet ohne Befehl, rollt, startet, greift an, landet wieder', () => {
  const g = new Game({ seed: 3 });
  const ab = base(g, 1);
  const [u] = ab.jets;
  const h = intruder(g, ab);
  g.drainEvents();
  run(g, S.react - 0.5);
  assert.ok(u.parked, 'Reaktionszeit: noch am Stellplatz');
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.type === 'message' && e.team === 0 && /^Alarmstart/.test(e.text)), 'Meldung Alarmstart');
  assert.ok(g.teams[0].qraMark, 'Markierung für die Minimap');
  const seen = phases(g, u, 40);
  assert.ok(seen.has('taxiOut') && seen.has('roll') && seen.has('air'), `rollt und startet (${[...seen]})`);
  for (let t = 0; t < 60 && h.alive; t++) run(g, 1);
  assert.equal(h.alive, false, 'abgefangen');
  for (let t = 0; t < 240 && !u.parked; t++) run(g, 1);
  assert.ok(u.parked, 'wieder gelandet und abgestellt');
  run(g, 0.5);
  assert.equal(u.order.type, 'idle');
  assert.equal(u.jet.qra, null, 'Alarmflug beendet');
  assert.ok(alertOn(u), 'bleibt in Bereitschaft');
});

test('Bereitschaft aus: kein Start; Befehl scramble schaltet um', () => {
  const g = new Game({ seed: 3 });
  const ab = base(g, 1);
  const [u] = ab.jets;
  const r = g.issue(0, { type: 'scramble', ids: [u.id], on: false });
  assert.ok(r.ok && r.on === false);
  intruder(g, ab);
  run(g, S.react + 10);
  assert.ok(u.parked, 'bleibt stehen');
  assert.equal(u.order.type, 'idle');
  assert.ok(g.issue(0, { type: 'scramble', ids: [u.id] }).on, 'ohne on: umschalten');
  assert.equal(g.issue(1, { type: 'scramble', ids: [u.id], on: true }).ok, false, 'fremde Jets nicht');
});

test('Kein Start: Jet ohne Luft-Luft-Waffe (A-10), leer geschossen oder unbetankt', () => {
  const g = new Game({ seed: 3 });
  const ab = base(g, 1, 'a10');
  const [a] = ab.jets;
  assert.equal(g.issue(0, { type: 'scramble', ids: [a.id], on: true }).ok, false, 'A-10 nicht wählbar');
  const f = g.spawnUnit('f16', 0, ab.stands[1].x, ab.stands[1].y);
  f.parked = true;
  f.jet = { home: ab.stands[1].id, ready: false, phase: 'park', alt: 0, slot: 0 };
  ab.ktank.stock = 0; // kein Kerosin: bleibt unbetankt
  ab.mdepot.stock = 0;
  f.fuel = 5;
  for (const w of f.weapons) w.rounds = 0;
  f.ammo = 0;
  intruder(g, ab);
  run(g, S.react + 10);
  assert.ok(a.parked && f.parked, 'beide bleiben stehen');
  assert.ok(!f.jet.ready, 'nicht startbereit');
  assert.equal(f.jet.qra ?? null, null);
});

test('Zwei Ziele, drei Jets, maxJets 2: genau zwei starten; Sperrzeit verhindert einen zweiten Alarmstart', () => {
  withValue(S, 'maxJets', 2, () => {
    const g = new Game({ seed: 3 });
    const ab = base(g, 3);
    intruder(g, ab, 250, -250);
    intruder(g, ab, 350, -100);
    run(g, S.react + 1);
    const out = ab.jets.filter((u) => u.jet.qra);
    assert.equal(out.length, 2, 'zwei im Alarm');
    run(g, 20);
    assert.equal(ab.jets.filter((u) => !u.parked).length, 2, 'genau zwei unterwegs');
  });
  // Sperrzeit: derselbe Jet startet nach der Landung erst nach Ablauf wieder von selbst
  withValue(S, 'cooldown', 100000, () => {
    const g = new Game({ seed: 3 });
    const ab = base(g, 1);
    const [u] = ab.jets;
    const h = intruder(g, ab);
    run(g, S.react + 1);
    assert.ok(u.jet.qra, 'erster Alarm');
    for (let t = 0; t < 60 && h.alive; t++) run(g, 1);
    for (let t = 0; t < 300 && !(u.parked && u.jet.ready); t++) run(g, 1);
    assert.ok(u.parked && u.jet.ready, 'gelandet und wieder startbereit');
    intruder(g, ab);
    run(g, S.react + 5);
    assert.ok(u.parked, 'Sperrzeit: kein zweiter Alarmstart');
    assert.equal(u.jet.qra, null);
    u.jet.qraNext = g.time; // Sperrzeit vorbei
    run(g, S.react + 1);
    assert.ok(u.jet.qra, 'danach wieder');
  });
});

test('Befehl des Spielers während des Alarmflugs hat Vorrang', () => {
  const g = new Game({ seed: 3 });
  const ab = base(g, 1);
  const [u] = ab.jets;
  intruder(g, ab);
  run(g, S.react + 1);
  assert.ok(u.order.qra, 'Alarmbefehl');
  const z = g.zone;
  assert.ok(g.issue(0, { type: 'move', ids: [u.id], x: z.x, y: z.y }).ok);
  run(g, 1);
  assert.equal(u.jet.qra, null, 'Alarmflug beendet');
  assert.equal(u.order.type, 'move', 'Befehl gilt');
  run(g, 20);
  assert.ok(!u.order.qra && !u.jet.qra, 'kein neuer Alarmbefehl');
});

test('Eroberung mit vier Spielern: kein Alarm gegen ein Ziel im gesperrten Viertel, Alarmjet kehrt um', () => {
  withValue(S, 'radius', 20000, () => {
    const g = new Game({ seed: 3, conquest: true, players: 4 });
    const ab = base(g, 1);
    const [u] = ab.jets;
    const s1 = g.map.spawns[1];
    assert.ok(g.mode.locked(g, 0, s1.x, s1.y), 'Viertel von Team 1 gesperrt');
    const far = g.spawnUnit('transporter', 1, s1.x, s1.y);
    far.order = { type: 'idle', x: far.x, y: far.y, targetId: null };
    g.fog[0].revealAll();
    const sees = g.sees.bind(g);
    g.sees = (t, e) => e === far || sees(t, e); // sichtbar machen, damit nur die Sperre zählt
    run(g, S.react + 2);
    assert.ok(u.parked && !u.jet.qra, 'kein Alarm gegen Ziel im gesperrten Viertel');
    // Ziel in der Nähe: Alarm; zieht es ins gesperrte Viertel, landet der Jet
    const h = intruder(g, ab);
    run(g, S.react + 1);
    assert.ok(u.order.qra && u.order.targetId === h.id, 'Alarm gegen das nahe Ziel');
    run(g, 0.5);
    h.x = s1.x;
    h.y = s1.y;
    g.sees = (t, e) => e === far || e === h || sees(t, e);
    run(g, 0.5);
    assert.equal(u.order.type, 'land', 'kehrt zum Stellplatz zurück');
  });
});

test('Speichern und Laden erhält Bereitschaft und laufenden Alarm', async () => {
  const g = new Game({ seed: 3 });
  const ab = base(g, 2);
  const [a, b] = ab.jets;
  g.issue(0, { type: 'scramble', ids: [b.id], on: false });
  intruder(g, ab);
  run(g, 1);
  assert.equal(a.jet.qra?.phase, 'react');
  const { game: g2 } = restoreGame(await unpack(await pack(snapshotGame(g))));
  const a2 = g2.getEntity(a.id);
  const b2 = g2.getEntity(b.id);
  assert.ok(alertOn(a2) && !alertOn(b2), 'Bereitschaft erhalten');
  assert.equal(a2.jet.qra?.phase, 'react', 'Alarm erhalten');
  for (let t = 0; t < S.react + 2; t += DT) g2.update(DT);
  assert.ok(a2.order.qra, 'startet nach dem Laden');
  // alter Spielstand ohne Feld: Standard
  delete b2.jet.alert;
  assert.ok(alertOn(b2));
});
