// Fliegerhorst: Stellplatz, Ausbildung, Kerosin, Einsatz, F-16-Waffen und KI-Fliegerhorst.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { UNITS } from '../js/data/units.js';
import { buildWhy } from '../js/game/city/cells.js';
import { KINDS } from '../js/data/citykinds.js';
import { connectRoad } from '../js/game/city/roadnet.js';
import { isFoe } from '../js/game/entities.js';
import { standsOf, freeSpace, runwaysOf, standRoute, jetGrounded, parkedArmor } from '../js/game/aircraft.js';
import { withValue } from './util.js';
import { supplyOf } from '../js/game/transport.js';
import { DT, run, rich, kindAt, airbase } from './airbasehelp.js';

test('Stellplatz bildet zwei F-16 aus (zwei je Stellplatz), Schutz je Stufe, Kerosintank und Munitionslager füllen sich über die Straße', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, stands, ktank, mdepot, rw } = airbase(g);
  assert.ok(rw, 'gültige Bahn');
  assert.equal(stands.length, 2);
  assert.deepEqual(standsOf(g, 0).map((e) => e.id).sort(), stands.map((e) => e.id).sort());
  const [s] = stands;
  assert.ok(standRoute(g, s), 'Weg vom Stellplatz zur Bahn');
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok, 'erste F-16');
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok, 'zweite F-16');
  const r = g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' });
  assert.equal(r.ok, false, 'dritte F-16 abgelehnt');
  assert.match(r.reason, /Stellplatz belegt/);
  const sup = supplyOf(g, c, s.cityCell); // Paket „Straßen“: Tempo nach dem Weg zum Lager (über die Bahn)
  assert.ok(sup.rate > 0, 'Stellplatz über Bahn und Straße versorgt');
  // Tempo = Versorgung × Stau des Wegs; Tank und Lager füllen sich über dieselbe Straße, daher bis höchstens 600 s warten
  for (let k = 0; k < 600 && g.units.filter((x) => x.def.jet).length < 2; k++) run(g, 1);
  const jets = g.units.filter((x) => x.def.jet);
  assert.equal(jets.length, 2, 'zwei F-16 gebaut');
  const [u] = jets.sort((a, b) => a.jet.slot - b.jet.slot);
  assert.ok(jets.every((x) => x.parked && x.jet.home === s.id), 'beide stehen auf ihrem Stellplatz');
  assert.deepEqual([u.x, u.y], [s.x - CITY.air.standSlot * c.cell, s.y], 'linker Platz');
  assert.equal(freeSpace(g, s), 0);
  assert.equal(isFoe(1, u), true, 'abgestellte Jets sind angreifbar');
  for (const lv of [1, 2, 3]) {
    c.level[s.cityCell] = lv;
    assert.equal(parkedArmor(g, u), CITY.air.shelter[lv], `Stufe ${lv}`);
  }
  // Tank und Lager an die Hauptstadt anschließen und füllen lassen
  for (const e of [ktank, mdepot]) connectRoad(g, c, e.cityCell, false);
  const kero0 = c.kero;
  run(g, 20);
  assert.ok(ktank.stock > 0, `Kerosintank gefüllt (${ktank.stock})`);
  assert.ok(mdepot.stock > 0, `Munitionslager gefüllt (${mdepot.stock})`);
  assert.ok(c.kero < kero0, 'Kerosin aus dem Stadtlager');
  assert.ok(ktank.stock <= CITY.air.tank.cap[c.level[ktank.cityCell]]);
  // Tanken auf dem Stellplatz aus dem Kerosintank
  u.fuel = 5;
  const st = ktank.stock;
  run(g, 2);
  assert.ok(u.fuel > 5, 'getankt');
  assert.ok(ktank.stock < st + CITY.air.tank.fill[c.level[ktank.cityCell]] * 2, 'aus dem Tank');
});

test('Ohne Kerosintank: kein Tanken, Mangelmeldung; Stellplatz zerstört → Jet verloren', () => {
  const g = new Game({ seed: 3, city: true });
  const { stands } = airbase(g, 0, { ktank: false });
  const [s] = stands;
  const u = g.spawnUnit('f16', 0, s.x, s.y);
  u.parked = true;
  u.jet = { home: s.id, ready: false, phase: 'park', alt: 0 };
  u.fuel = 5;
  g.drainEvents();
  g.teams[0].warnAt = {};
  run(g, 3);
  assert.equal(u.fuel, 5, 'ohne Tank kein Tanken');
  assert.ok(g.drainEvents().some((e) => e.type === 'message' && e.team === 0 && /Kerosin/.test(e.text)), 'Mangelmeldung Kerosin');
  s.hp = 0;
  s.alive = false;
  run(g, 1);
  assert.equal(u.alive, false, 'mit dem Stellplatz verloren');
});

test('Einsatz: rollt zur Bahn, Startlauf auf der Bahn, Raketen, Rückkehr, Landung, Rollen zum Stellplatz, nachtanken', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, stands, ktank, mdepot, rw } = airbase(g);
  ktank.stock = CITY.air.tank.cap[c.level[ktank.cityCell]];
  mdepot.stock = CITY.air.depot.cap[c.level[mdepot.cityCell]];
  const [s] = stands;
  assert.ok(g.issue(0, { type: 'train', buildingId: s.id, unit: 'f16' }).ok);
  run(g, UNITS.f16.buildTime + 1);
  const [u] = g.units.filter((x) => x.def.jet);
  const z = g.zone;
  const heli = g.spawnUnit('gunship', 1, z.x, z.y);
  g.fog[0].revealAll?.();
  assert.ok(g.issue(0, { type: 'attackMove', ids: [u.id], x: z.x, y: z.y }).ok);
  const seen = new Set();
  let rollOn = true;
  for (let t = 0; t < 40 && u.jet.phase !== 'air'; t += DT) {
    g.update(DT);
    seen.add(u.jet.phase);
    if (u.jet.phase !== 'air') assert.ok(jetGrounded(u), 'bis zum Abheben am Boden');
    if (u.jet.phase === 'roll') rollOn &&= Math.abs(u.y - rw.cy) < 2;
  }
  assert.ok(seen.has('taxiOut') && seen.has('roll'), `rollt und startet (${[...seen]})`);
  assert.ok(rollOn, 'Startlauf auf der Mittellinie der Bahn');
  assert.equal(u.jet.phase, 'air');
  for (let t = 0; t < 120 && heli.alive; t++) {
    run(g, 1);
    g.fog[0].revealAll?.();
  }
  assert.equal(heli.alive, false, 'Hubschrauber abgeschossen');
  // zurück: Landebefehl auf den Stellplatz
  assert.ok(g.issue(0, { type: 'land', ids: [u.id], airportId: s.id }).ok);
  const phases = [];
  let touch = null;
  for (let t = 0; t < 180 && !u.parked; t += DT) {
    g.update(DT);
    if (phases.at(-1) !== u.jet.phase) phases.push(u.jet.phase);
    if (u.jet.phase === 'rollout' && !touch) touch = { x: u.x, y: u.y };
  }
  assert.ok(u.parked, `gelandet (${phases})`);
  assert.deepEqual(phases.slice(-3), ['rollout', 'taxiIn', 'park'], 'ausrollen, zum Stellplatz rollen');
  assert.ok(Math.abs(touch.y - rw.cy) < 30, 'setzt auf der Bahn auf');
  assert.deepEqual([u.x, u.y], [s.x - CITY.air.standSlot * c.cell, s.y], 'wieder auf seinem Platz');
  for (let t = 0; t < 120 && !u.jet.ready; t++) run(g, 1);
  assert.ok(u.jet.ready && u.weapons[0].rounds === 2, 'wieder startbereit');
});

test('KI baut einen Fliegerhorst mit gültiger Bahn, Stellplätzen, Tower, Kerosintank und Munitionslager', async () => {
  const { aiAirport } = await import('../js/ai/cityai.js');
  const g = new Game({ seed: 3, city: true });
  const { c, m } = rich(g, 1);
  const from = CITY.ai.airportFrom;
  CITY.ai.airportFrom = 0; // sonst erst ab genug Arbeitsstätten
  try {
    for (let k = 0; k < 4; k++) {
      aiAirport(g, c, m, 0, 3);
      run(g, CITY.growTime + 1);
    }
  } finally {
    CITY.ai.airportFrom = from;
  }
  const rws = runwaysOf(g, 1).filter((x) => x.valid);
  assert.ok(rws.length >= 1, 'gültige Bahn');
  const kinds = new Set(c.list.map((i) => kindAt(c, i)));
  for (const k of ['stand', 'atc', 'ktank', 'mdepot']) assert.ok(kinds.has(k), `KI baut ${k}`);
  assert.ok(standsOf(g, 1).some((s) => standRoute(g, s)), 'Stellplatz mit Weg zur Bahn');
});

test('KI mit Baugebiet: Bahn außerhalb des Gebiets (kein Stellplatz möglich) → zweiter Fliegerhorst mit Stellplätzen im Gebiet', async () => {
  const { aiAirport } = await import('../js/ai/cityai.js');
  const g = new Game({ seed: 3, city: true, buildRules: true });
  const { c, m } = rich(g, 1);
  g.fog[1].revealAll?.();
  // Bahn weit draußen (Bahnen dürfen außerhalb des Gebiets liegen, Stellplätze nicht): so sah es in Daniels Partie aus
  let placed = false;
  for (let r = 2; r < c.rows - 6 && !placed; r += 3) {
    for (let q = 2; q < c.cols - 14 && !placed; q += 3) {
      let out = true;
      for (let y = r - 3; y <= r + 4 && out; y++) for (let x = q - 3; x <= q + 12 && out; x++) if (c.claim[y * c.cols + x]) out = false;
      if (out) placed = g.issue(1, { type: 'city', kind: 'runway', c0: q, r0: r, c1: q + CITY.ai.runwayLen - 1, r1: r + 1 }).ok;
    }
  }
  assert.ok(placed, 'Bahn außerhalb des Gebiets gesetzt');
  withValue(CITY.ai, 'airportFrom', 0, () => {
    for (let k = 0; k < 6; k++) {
      g.teams[1].res.money = 50000;
      m.store.bm = 3000;
      aiAirport(g, c, m, 0, 2);
      run(g, CITY.growTime + 1);
    }
  });
  assert.ok(standsOf(g, 1).length >= 1, 'KI hat Stellplätze gebaut');
  assert.ok(standsOf(g, 1).every((s) => buildWhy(g, c, s.cityCell, 'stand') === null), 'Stellplätze liegen im Gebiet');
});

test('Stellplatz: Ausbau nur per Befehl, Stufe 2 Geld + BM, Stufe 3 auch Stahl; wächst nicht von selbst', () => {
  const g = new Game({ seed: 3, city: true });
  const { c, m, stands } = airbase(g);
  const [s] = stands;
  const i = s.cityCell;
  run(g, CITY.upgradeTime * 2 + 5);
  assert.equal(c.level[i], 1, 'bleibt offen ohne Ausbau');
  const U = CITY.air.upgrade;
  g.teams[0].res.money = U[2].money - 1;
  assert.equal(g.issue(0, { type: 'cityUpgrade', buildingId: s.id }).ok, false, 'zu wenig Geld');
  g.teams[0].res.money = 1e5;
  const bm = m.store.bm;
  assert.ok(g.issue(0, { type: 'cityUpgrade', buildingId: s.id }).ok);
  assert.equal(c.level[i], 2);
  assert.equal(g.teams[0].res.money, 1e5 - U[2].money);
  assert.ok(m.store.bm <= bm - U[2].bm + 1e-6, 'Baumaterial aus dem Lager');
  c.metal = U[3].steel - 1;
  const r = g.issue(0, { type: 'cityUpgrade', buildingId: s.id });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Stahl/);
  c.metal = 1000;
  assert.ok(g.issue(0, { type: 'cityUpgrade', buildingId: s.id }).ok);
  assert.equal(c.level[i], 3);
  assert.equal(c.metal, 1000 - U[3].steel);
  assert.equal(g.issue(0, { type: 'cityUpgrade', buildingId: s.id }).ok, false, 'höchste Stufe');
  // andere Stadtgebäude lassen sich so nicht ausbauen
  const other = [...c.ents.values()].find((e) => e.alive && KINDS[c.kind[e.cityCell] - 1] === 'atc');
  assert.equal(g.issue(0, { type: 'cityUpgrade', buildingId: other.id }).ok, false);
});

test('F-16: zwei Luft-Luft-Raketen nur gegen Luftziele, zwei Luft-Boden-Raketen gegen Panzer, beide zugleich', () => {
  const g = new Game({ seed: 3, city: true });
  const [aim, agm] = UNITS.f16.weapons;
  assert.deepEqual([aim.id, aim.rounds, agm.id, agm.rounds], ['aim', 2, 'agm', 2]);
  assert.ok(!aim.damage.heavy && !aim.damage.light && aim.damage.air > 0, 'Luft-Luft nur gegen Luftziele');
  assert.ok(agm.damage.heavy > 0 && !agm.damage.air, 'Luft-Boden nur gegen Bodenziele');
  const z = g.zone;
  const u = g.spawnUnit('f16', 0, z.x - 300, z.y);
  u.jet = { home: 0, ready: true, phase: 'air', alt: 1 };
  const heli = g.spawnUnit('gunship', 1, z.x, z.y);
  const tank = g.spawnUnit('tank', 1, z.x + 120, z.y);
  heli.hp = tank.hp = 1e6;
  g.fog[0].revealAll?.();
  assert.ok(g.issue(0, { type: 'attackMove', ids: [u.id], x: z.x, y: z.y }).ok);
  for (let t = 0; t < 30 && (u.weapons[0].rounds > 0 || u.weapons[1].rounds > 0); t++) {
    run(g, 1);
    g.fog[0].revealAll?.();
  }
  assert.equal(u.weapons[0].rounds, 0, 'Luft-Luft verschossen');
  assert.equal(u.weapons[1].rounds, 0, 'Luft-Boden verschossen');
  assert.ok(heli.hp < 1e6 && tank.hp < 1e6, 'Hubschrauber und Panzer getroffen');
});
