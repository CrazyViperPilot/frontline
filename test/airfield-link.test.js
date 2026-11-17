// Fliegerhorst-Anschluss (Paket „Fliegerhorst-Anschluss“, Regeln des Spieldesigners): Bahn und Rollfeld sind keine Straße (kein Warenweg,
// kein Anschluss, kein Wachstum). Der Stellplatz hängt an der Bahn (ohne Straße), Kerosintank und Munitionslager brauchen eine Straße zum
// Lager. Der Tower steht frei und lotst die Bahnen in seinem Umkreis. Der Heliport liegt an einer Straße oder an einem Rollfeld mit Bahn;
// Stellplatz und Heliport werden über einen Tank mit Straßenweg im Umkreis versorgt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { CITY } from '../js/data/city.js';
import { canZone, roadAt, taxiable, buildWhy, BUILD_BLOCK, roadLinked, airLinked, hasRoad, accessCells } from '../js/game/city/cells.js';
import { connectRoad, mainRoadReach } from '../js/game/city/roadnet.js';
import { transportOf, supplyOf } from '../js/game/transport.js';
import { runwaysOf } from '../js/game/aircraft.js';
import { withValue } from './util.js';

const DT = 0.05;
const run = (g, s) => {
  for (let i = 0; i < s / DT; i++) g.update(DT);
};

/** Stadt mit Geld, Baumaterial, Kerosin und erkundetem Gelände; mit Baugebiet (rules). */
function game(rules) {
  const g = new Game({ seed: 3, buildRules: rules });
  g.fog[0].explored.fill(1);
  g.update(DT); // Gebiet (c.claim) rechnet die Simulation im ersten Schritt aus
  g.teams[0].res.money = 1e6;
  g.mainFob(0).store.bm = 30000;
  g.mainFob(0).store.mun = 30000;
  g.city[0].kero = 3000;
  return g;
}

/** Freies W × H-Rechteck nahe der Hauptstadt (linke obere Zelle { q, r }); mit Baugebiet liegt es im Gebiet des Teams. */
function area(g, W, H) {
  const c = g.city[0];
  const m = g.mainFob(0);
  const mc = Math.floor(m.x / c.cell);
  const mr = Math.floor(m.y / c.cell);
  let best = null;
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
  assert.ok(best, 'freie Fläche für den Test');
  if (g.buildRules) {
    for (let y = best.r; y < best.r + H; y++) for (let x = best.q; x < best.q + W; x++) c.claim[y * c.cols + x] = 1;
  }
  return best;
}

/** Freies W × H-Rechteck, dessen Zellen alle mehr als `far` Zellen von (cq, cr) liegen (für eine Bahn außer Reichweite des Towers). */
function farArea(g, W, H, cq, cr, far) {
  const c = g.city[0];
  for (let r = 1; r < c.rows - H - 1; r++) {
    for (let q = 1; q < c.cols - W - 1; q++) {
      let ok = true;
      for (let y = r; ok && y < r + H; y++) {
        for (let x = q; ok && x < q + W; x++) {
          const j = y * c.cols + x;
          ok = Math.hypot(x - cq, y - cr) > far && canZone(g, c, j) && !c.kind[j] && !roadAt(c, j) && buildWhy(g, c, j, 'runway') === null;
        }
      }
      if (ok) return { q, r };
    }
  }
  return null;
}

const cell = (c, q, r) => r * c.cols + q;
const put = (g, kind, q, r, w = 0, h = 0) => g.issue(0, { type: 'city', kind, c0: q, r0: r, c1: q + w, r1: r + h });

test('Bahn und Rollfeld sind keine Straße: kein Warenweg, kein Anschluss, kein Wachstum', () => {
  const g = game(true);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  assert.ok(put(g, 'taxi', q + 10, r, 1, 1).ok, 'Rollfeld');
  const rw = cell(c, q, r);
  const tx = cell(c, q + 10, r);
  assert.equal(roadAt(c, rw), false, 'Bahn ist keine Straße');
  assert.equal(roadAt(c, tx), false, 'Rollfeld ist keine Straße');
  assert.equal(taxiable(c, rw), true, 'Flugzeuge rollen über die Bahn');
  assert.equal(taxiable(c, tx), true, 'Flugzeuge rollen über das Rollfeld');
  assert.equal(mainRoadReach(g, c)[rw], 0, 'kein Weg zum Lager über die Bahn');
  assert.equal(transportOf(g, c).cap[rw], 0, 'Bahn trägt keine Ware');
  assert.equal(transportOf(g, c).cap[tx], 0, 'Rollfeld trägt keine Ware');
  // Ein Wohnhaus an der Bahn hat keinen Anschluss und wächst nicht
  const h = cell(c, q + 4, r + 2);
  assert.equal(roadLinked(g, c)[h], 0, 'Vorbedingung: keine Straße zum Lager daneben');
  assert.equal(buildWhy(g, c, h, 'res'), 'road', 'Wohnen an der Bahn braucht eine Straße zum Lager');
  assert.equal(hasRoad(c, q + 4, r + 2), false, 'kein Wachstum an der Bahn');
});

test('Stellplatz: mit Verbindung zur Bahn ohne Straße baubar, sonst nicht', () => {
  const g = game(true);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  const near = put(g, 'stand', q + 2, r + 2, 1, 1);
  assert.equal(near.ok, true, `Stellplatz an der Bahn ohne Straße: ${near.reason ?? ''}`);
  assert.equal(accessCells(c, cell(c, q + 2, r + 2)).length, 0, 'keine Straße am Stellplatz');
  const far = put(g, 'stand', q + 2, r + 5, 1, 1);
  assert.equal(far.ok, false, 'ohne Bahn kein Stellplatz');
  assert.equal(far.reason, BUILD_BLOCK.air);
});

test('Kerosintank ohne Straße zum Lager wächst nicht und versorgt nichts, mit Straße schon', () => {
  const g = game(false);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  assert.ok(put(g, 'ktank', q + 6, r + 2, 1, 1).ok, 'Kerosintank');
  run(g, CITY.growTime + 1);
  const a = cell(c, q + 6, r + 2);
  assert.equal(c.level[a], 0, 'ohne Straße wächst der Tank nicht');
  assert.equal(transportOf(g, c).depot.get(a) ?? null, null, 'an der Bahn allein kein Weg zum Lager');
  withValue(CITY.transport, 'connectMax', 400, () => assert.ok(connectRoad(g, c, a, false) > 0, 'Straße zum Lager'));
  run(g, CITY.growTime + 1);
  assert.ok(c.level[a] > 0, 'mit Straße gebaut');
  assert.ok(transportOf(g, c).depot.get(a), 'mit Straße ein Weg');
  run(g, 20);
  assert.ok(c.ents.get(a).stock > 0, 'mit Straße wird der Tank befüllt');
});

test('Kerosintank braucht mit Baugebiet eine Straße zum Lager', () => {
  const g = game(true);
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  const res = put(g, 'ktank', q + 6, r + 2, 1, 1);
  assert.equal(res.ok, false, 'Tank an der Bahn ohne Straße abgelehnt');
  assert.equal(res.reason, BUILD_BLOCK.road);
});

test('Stellplatz ohne Straße wächst an der Bahn und wird über einen Kerosintank mit Straßenweg im Umkreis versorgt', () => {
  const g = game(false);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  assert.ok(put(g, 'stand', q + 2, r + 2, 1, 1).ok, 'Stellplatz');
  assert.ok(put(g, 'ktank', q + 7, r + 5, 1, 1).ok, 'Kerosintank');
  run(g, CITY.growTime + 1);
  const sa = cell(c, q + 2, r + 2);
  const ta = cell(c, q + 7, r + 5);
  assert.ok(c.level[sa] > 0, 'Stellplatz wächst ohne Straße an der Bahn');
  assert.equal(transportOf(g, c).supply.get(sa) ?? null, null, 'ohne Tank mit Straße keine Versorgung');
  withValue(CITY.transport, 'connectMax', 400, () => assert.ok(connectRoad(g, c, ta, false) > 0, 'Straße des Tanks zum Lager'));
  run(g, CITY.growTime + 1);
  assert.equal(accessCells(c, sa).length, 0, 'der Stellplatz selbst hat keine Straße');
  assert.equal(transportOf(g, c).supply.get(sa)?.length, 0, 'versorgt über den Tank im Umkreis (Weg 0)');
  assert.equal(supplyOf(g, c, sa).v, 1, 'Versorgungsgrad 100 %');
});

test('Tower braucht keinen Anschluss und lotst nur Bahnen in seinem Umkreis', () => {
  const g = game(true);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'atc', q + 2, r + 2, 1, 1).ok, 'Tower ohne Straße');
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn nahe dem Tower');
  const far = farArea(g, 10, 2, q + 3, r + 3, CITY.air.atcRadius + 2);
  assert.ok(far, 'Platz für eine Bahn außer Reichweite des Towers');
  assert.ok(put(g, 'runway', far.q, far.r, 9, 1).ok, 'Bahn weit weg');
  run(g, CITY.growTime + 1);
  assert.ok(c.level[cell(c, q + 2, r + 2)] > 0, 'Tower wächst ohne Straße');
  const near = runwaysOf(g, 0).find((x) => x.valid && x.cells.includes(cell(c, q, r)));
  const away = runwaysOf(g, 0).find((x) => x.valid && x.cells.includes(cell(c, far.q, far.r)));
  assert.ok(near && away, 'beide Bahnen gültig');
  assert.equal(near.atc, true, 'Bahn im Umkreis wird gelotst');
  assert.equal(away.atc, false, 'Bahn außerhalb des Umkreises nicht');
});

test('Heliport: an einer Straße zum Lager oder an einem Rollfeld mit Bahn, sonst nicht (mit Baugebiet)', () => {
  const g = game(true);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  assert.ok(put(g, 'taxi', q + 10, r, 1, 1).ok, 'Rollfeld an der Bahn');
  const ok = cell(c, q + 10, r + 2);
  assert.equal(roadLinked(g, c)[ok], 0, 'Vorbedingung: keine Straße zum Lager');
  assert.equal(buildWhy(g, c, ok, 'heliport'), null, 'Heliport am Rollfeld mit Bahn');
  assert.ok(put(g, 'heliport', q + 10, r + 2).ok, 'Heliport gebaut');
  // Rollfeld ohne Verbindung zur Bahn
  assert.ok(put(g, 'taxi', q, r + 5, 3, 0).ok, 'loses Rollfeld');
  const lone = cell(c, q + 1, r + 5);
  assert.equal(airLinked(c)[lone], 0, 'Vorbedingung: nicht an der Bahn');
  const bad = put(g, 'heliport', q + 1, r + 6);
  assert.equal(bad.ok, false, 'Heliport am losen Rollfeld abgelehnt');
  assert.equal(bad.reason, BUILD_BLOCK.heli);
});

test('Heliport wird über einen Kerosintank mit Straßenweg im Umkreis ausgebildet, ohne eigenen Straßenweg', () => {
  const g = game(false);
  const c = g.city[0];
  const { q, r } = area(g, 14, 8);
  assert.ok(put(g, 'runway', q, r, 9, 1).ok, 'Bahn');
  assert.ok(put(g, 'taxi', q + 10, r, 1, 1).ok, 'Rollfeld');
  assert.ok(put(g, 'heliport', q + 10, r + 2).ok, 'Heliport');
  assert.ok(put(g, 'ktank', q + 4, r + 4, 1, 1).ok, 'Kerosintank');
  run(g, CITY.growTime + 1);
  const ha = cell(c, q + 10, r + 2);
  const ta = cell(c, q + 4, r + 4);
  assert.ok(c.level[ha] > 0, 'Heliport wächst am Rollfeld mit Bahn');
  assert.equal(transportOf(g, c).supply.get(ha) ?? null, null, 'ohne Tank mit Straße keine Ausbildung');
  withValue(CITY.transport, 'connectMax', 400, () => assert.ok(connectRoad(g, c, ta, false) > 0, 'Straße des Tanks zum Lager'));
  run(g, CITY.growTime + 1);
  assert.equal(accessCells(c, ha).length, 0, 'der Heliport hat keine Straße');
  assert.equal(transportOf(g, c).supply.get(ha)?.length, 0, 'ausgebildet über den Tank im Umkreis');
  assert.equal(supplyOf(g, c, ha).v, 1, 'Versorgungsgrad 100 %');
});
