// Fliegerhorst: Start- und Landebahn, Rollen, Tower und Bagger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { BALANCE } from '../js/data/balance.js';
import { UNITS } from '../js/data/units.js';
import { roadAt, taxiable } from '../js/game/city/cells.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { standsOf, runwaysOf, standRoute, runwayBusy } from '../js/game/aircraft.js';
import { MAP_ROAD, BRIDGE_ROAD } from '../js/game/roads.js';
import { DT, run, rich, freeArea, airbase } from './airbasehelp.js';

test('Bahn: gültig nur als volles Rechteck 2 Zellen breit und mindestens CITY.air.runwayMin lang; alter Flughafen nicht mehr baubar', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, m } = rich(g);
  const a = freeArea(g, c, m, 12, 6);
  const { q, r } = a;
  assert.ok(g.issue(0, { type: 'city', kind: 'runway', c0: q, r0: r, c1: q + CITY.air.runwayMin - 2, r1: r + 1 }).ok);
  let [rw] = runwaysOf(g, 0);
  assert.equal(rw.valid, false, 'zu kurz');
  assert.match(rw.reason, /zu kurz/);
  assert.ok(g.issue(0, { type: 'city', kind: 'runway', c0: q + CITY.air.runwayMin - 1, r0: r, c1: q + CITY.air.runwayMin - 1, r1: r + 1 }).ok);
  [rw] = runwaysOf(g, 0);
  assert.ok(rw.valid, 'jetzt lang genug');
  assert.equal(rw.axis, 'x');
  assert.equal(rw.len, CITY.air.runwayMin);
  assert.equal(roadAt(c, rw.cells[0]), false, 'Bahn ist keine Straße (Paket „Fliegerhorst-Anschluss“)');
  assert.ok(taxiable(c, rw.cells[0]), 'Bahn ist Fahrweg der Jets');
  const r2 = g.issue(0, { type: 'city', kind: 'airport', c0: q, r0: r + 4, c1: q, r1: r + 4 });
  assert.equal(r2.ok, false, 'Flughafen 10 × 10 gibt es nicht mehr');
});

test('Zwei F-16 nie zugleich im Startlauf; der Tower verkürzt die Sperrzeit der Bahn', () => {
  const g = new Game({ seed: 3, city: true });
  const { stands, rw } = airbase(g);
  assert.ok(rw.atc, 'Tower in Reichweite');
  const jets = stands.map((s) => {
    const u = g.spawnUnit('f16', 0, s.x, s.y);
    u.parked = true;
    u.jet = { home: s.id, ready: true, phase: 'park', alt: 0 };
    return u;
  });
  assert.ok(g.issue(0, { type: 'move', ids: jets.map((u) => u.id), x: g.zone.x, y: g.zone.y }).ok);
  let both = false;
  let maxBusy = 0;
  for (let t = 0; t < 60 && !jets.every((u) => u.jet.phase === 'air'); t += DT) {
    g.update(DT);
    if (jets.every((u) => u.jet.phase === 'roll')) both = true;
    maxBusy = Math.max(maxBusy, runwayBusy(g, 0, rw));
  }
  assert.equal(both, false, 'nie zwei zugleich im Startlauf');
  assert.ok(jets.every((u) => u.jet.phase === 'air'), 'beide gestartet');
  assert.ok(maxBusy <= CITY.air.sepAtc + 1e-6, `Sperrzeit mit Tower (${maxBusy})`);
});

test('Bagger: räumt eine Zonenstraße (nicht die Brücke), reißt ein eigenes Gebäude ab; Gegner langsam per Schaufel', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, m } = rich(g);
  const R = g.roads;
  // Zonenstraße nächst der Hauptstadt
  let i = -1;
  let bd = Infinity;
  for (let k = 0; k < R.kind.length; k++) {
    if (R.kind[k] !== MAP_ROAD) continue;
    const d = Math.hypot(((k % R.cols) + 0.5) * R.cell - m.x, (Math.floor(k / R.cols) + 0.5) * R.cell - m.y);
    if (d < bd) {
      bd = d;
      i = k;
    }
  }
  assert.ok(i >= 0, 'Zonenstraße da');
  const x = ((i % R.cols) + 0.5) * R.cell;
  const y = (Math.floor(i / R.cols) + 0.5) * R.cell;
  const u = g.spawnUnit('excavator', 0, x + 40, y);
  assert.ok(u.def.digger);
  const q = i % R.cols;
  const r = Math.floor(i / R.cols);
  const ver = c.ver;
  assert.ok(g.issue(0, { type: 'dig', ids: [u.id], c0: q, r0: r, c1: q, r1: r }).ok);
  run(g, BALANCE.excavator.digTime - 1);
  assert.equal(R.kind[i], MAP_ROAD, 'arbeitet noch');
  run(g, 4);
  assert.equal(R.kind[i], 0, 'Zonenstraße weg');
  assert.equal(roadAt(c, i), false);
  assert.ok(c.ver > ver, 'Wege neu');
  assert.equal(u.order.type, 'idle', 'fertig');
  // Brücke: nichts zu baggern
  const b = R.kind.indexOf(BRIDGE_ROAD);
  if (b >= 0) assert.equal(g.issue(0, { type: 'dig', ids: [u.id], c0: b % R.cols, r0: Math.floor(b / R.cols), c1: b % R.cols, r1: Math.floor(b / R.cols) }).ok, false);
  // eigenes Gebäude: abreißen
  const a = freeArea(g, c, m, 3, 3);
  assert.ok(g.issue(0, { type: 'city', kind: 'res', c0: a.q + 1, r0: a.r + 1, c1: a.q + 1, r1: a.r + 1 }).ok);
  const j = (a.r + 1) * c.cols + a.q + 1;
  u.x = (a.q + 1.5) * c.cell + 30;
  u.y = (a.r + 1.5) * c.cell;
  assert.ok(g.issue(0, { type: 'dig', ids: [u.id], c0: a.q + 1, r0: a.r + 1, c1: a.q + 1, r1: a.r + 1 }).ok);
  run(g, BALANCE.excavator.digTime + 2);
  assert.equal(c.kind[j], 0, 'abgerissen');
  // Schaufel: nur Gebäude, wenig Schaden je Schlag
  assert.deepEqual(UNITS.excavator.weapons[0].targets, ['struct']);
  assert.ok(UNITS.excavator.weapons[0].damage.struct < 60);
});

test('Breite Bahnfläche: längster Streifen 2 breit ist die Bahn, der Rest Rollfeld; Stellplatz über Rollfeld-Kette angebunden', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, m } = rich(g);
  const a = freeArea(g, c, m, 12, 10);
  const { q, r } = a;
  // Bahnfläche 10 × 4 (wie von Hand gemalt): eine gültige Bahn, 20 Zellen Rollfeld
  assert.ok(g.issue(0, { type: 'city', kind: 'runway', c0: q, r0: r, c1: q + 9, r1: r + 3 }).ok);
  const [rw] = runwaysOf(g, 0);
  assert.ok(rw.valid, rw.reason);
  assert.equal(rw.cells.length, 2 * 10);
  assert.equal(rw.apron.length, 20);
  // Stellplatz zwei Felder unter der Fläche, dazwischen eine Reihe Rollfeld
  assert.ok(g.issue(0, { type: 'city', kind: 'taxi', c0: q, r0: r + 4, c1: q + 3, r1: r + 4 }).ok);
  assert.ok(g.issue(0, { type: 'city', kind: 'stand', c0: q, r0: r + 5, c1: q, r1: r + 5 }).ok);
  run(g, CITY.growTime + 1);
  const s = standsOf(g, 0)[0];
  assert.ok(s, 'Stellplatz wächst am Rollfeld');
  const route = standRoute(g, s);
  assert.ok(route && route.rw.key === rw.key, 'Weg über Rollfeld zur Bahn');
  assert.ok(route.cells.some((i) => c.kind[i] === KIND_ID.taxi), 'über das Rollfeld');
});

// Review-Paket P4 (Daniels Entscheidung 2, D-03): der Tower sieht als Radar CITY.air.atcSight weit statt CITY.sight.
test('Tower: weite Sicht (CITY.air.atcSight) statt der Sicht der übrigen Stadtgebäude', () => {
  const g = new Game({ seed: 3, city: true });
  const { atc } = airbase(g);
  assert.ok(atc, 'Tower steht');
  assert.ok(CITY.air.atcSight > CITY.sight);
  const seen = () => {
    g.fog[0].update(g, 0);
    return g.fog[0].visible.reduce((s, v) => s + v, 0);
  };
  const wide = seen();
  const old = CITY.air.atcSight;
  CITY.air.atcSight = CITY.sight;
  let narrow;
  try {
    narrow = seen();
  } finally {
    CITY.air.atcSight = old;
  }
  assert.ok(wide > narrow, `Tower lichtet mehr Nebel (${wide} > ${narrow} Felder)`);
});

test('Rechtsverkehr am Boden: nach der Landung rollt der Jet um keepRight rechts neben der Mitte, Stellplatz genau', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, stands, ktank, mdepot } = airbase(g);
  ktank.stock = CITY.air.tank.cap[c.level[ktank.cityCell]];
  mdepot.stock = CITY.air.depot.cap[c.level[mdepot.cityCell]];
  const [s] = stands;
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok);
  run(g, UNITS.f16.buildTime + 1);
  const [u] = g.units.filter((x) => x.def.jet);
  assert.ok(u, 'F-16 ausgebildet');
  const z = g.zone;
  assert.ok(g.issue(0, { type: 'attackMove', ids: [u.id], x: z.x, y: z.y }).ok);
  for (let t = 0; t < 40 && u.jet.phase !== 'air'; t += DT) g.update(DT);
  assert.equal(u.jet.phase, 'air');
  run(g, 3);
  assert.ok(g.issue(0, { type: 'land', ids: [u.id], airportId: s.id }).ok);
  const offs = [];
  for (let t = 0; t < 180 && !u.parked; t += DT) {
    const r = u.jet.route;
    const k = u.jet.idx;
    const ph = u.jet.phase;
    g.update(DT);
    if (ph !== 'taxiIn' || u.jet.phase !== 'taxiIn' || !r || u.jet.idx === k || !r[k].side) continue;
    offs.push(Math.hypot(u.x - r[k].x, u.y - r[k].y));
    // rechts der Fahrtrichtung (Bildschirm, y nach unten): Kreuzprodukt Richtung × Versatz > 0
    const q = r[k - 1];
    assert.ok((r[k].x - q.x) * (u.y - r[k].y) - (r[k].y - q.y) * (u.x - r[k].x) > 0, 'Versatz liegt rechts');
  }
  assert.ok(offs.length > 0, 'Rollweg hat Zellen mit Rechtsverkehr');
  for (const d of offs) assert.ok(Math.abs(d - BALANCE.jets.keepRight) < 1e-6, `Versatz ${d}`);
  assert.ok(u.parked, 'steht wieder auf dem Stellplatz');
});
