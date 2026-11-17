// Spiel-Tests: Platzierung, FOB, Baustellen, Mauer, FOB-Fahrzeug und Reparatur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../js/data/balance.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { trainer } from './util.js';
import { mk, run, cellOf, fobOf, unitsOf, findSpot, engineerBeside, silence } from './gamehelp.js';

test('Platzierung: Bauradius und Hindernisse', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);

  // außerhalb des Bauradius (450 px)
  assert.equal(g.canPlace(0, 'mortar', f.x + 1500, f.y).ok, false);

  // auf einem Hindernis (eigene FOB direkt auf den Felsen setzen, damit der Radius erfüllt ist)
  const ob = g.map.obstacles[0];
  g.spawnBuilding('fob', 0, cellOf(ob.x) - 1, cellOf(ob.y) - 1);
  const onRock = g.canPlace(0, 'mortar', ob.x, ob.y);
  assert.equal(onRock.ok, false);
  assert.match(onRock.reason, /Gelände/);

  // freie Stelle im Radius ist baubar
  assert.ok(findSpot(g, 0, 'mortar', f.x, f.y, 0, 400));
});

test('FOB: Bauradien eigener FOBs dürfen sich nicht überlappen, höchstens 10 FOBs', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  // 700 px neben der Hauptstadt (eine Richtung ohne Hang oder Hindernis wählen)
  const near = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((k) => g.canPlace(0, 'fob', f.x + Math.cos((k * Math.PI) / 4) * 700, f.y + Math.sin((k * Math.PI) / 4) * 700))
    .find((p) => !/Gelände|belegt/.test(p.reason ?? ''));
  assert.equal(near.ok, false);
  assert.match(near.reason, /Zu nah/);
  const R = BALANCE.fob.buildRadius;
  assert.equal(BALANCE.fob.minDistOwn, 2 * R, 'Bauradien berühren sich höchstens');
  assert.equal(BALANCE.fob.max, 10);
  // neun weitere FOBs im Abstand ≥ 900 px: die zehnte FOB insgesamt geht, die elfte nicht
  let n = 1;
  for (let r = 950; r < 6000 && n < 10; r += 50) {
    for (;;) {
      const s = findSpot(g, 0, 'fob', f.x, f.y, r, r);
      if (!s) break;
      const p = g.canPlace(0, 'fob', s.x, s.y);
      g.spawnBuilding('fob', 0, p.cx, p.cy, { built: true });
      if (++n >= 10) break;
    }
  }
  assert.equal(n, 10, 'zehn FOBs gestellt');
  const eleventh = findSpot(g, 0, 'fob', f.x, f.y, 950, 5000);
  assert.equal(eleventh, null, 'elfte FOB nicht erlaubt');
});

test('Bau: Gebäude-Baustelle kostet Geld und Lager sofort; Fortschritt nur mit Bauer', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const spot = findSpot(g, 0, 'mortar', f.x, f.y);
  const eng = unitsOf(g, 0, 'engineer')[0];
  const bm = f.store.bm;
  const r = g.issue(0, { type: 'build', ids: [eng.id], building: 'mortar', x: spot.x, y: spot.y });
  assert.equal(r.ok, true, r.reason);
  const b = g.getEntity(r.id);
  assert.equal(b.built, false);
  assert.equal(f.store.bm, bm - BUILDINGS.mortar.cost.bm, 'Lager der Hauptstadt zahlt sofort');
  assert.equal(b.payerId, f.id);

  run(g, 40);
  assert.equal(b.built, true, 'Baufahrzeug baut fertig');
  assert.equal(b.hp, b.maxHp);
  assert.ok(g.drainEvents().some((e) => e.text === 'Mörser fertig'));
});

test('Bau: Gebäude-Baustelle ohne Bauer kommt nicht voran; 2 Bauer doppelt so schnell', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const spot = findSpot(g, 0, 'mortar', f.x, f.y);
  const r = g.issue(0, { type: 'build', building: 'mortar', x: spot.x, y: spot.y });
  assert.equal(r.ok, true);
  const b = g.getEntity(r.id);
  // ohne Bauer (Start-Baufahrzeug ausgeschaltet) kein Fortschritt
  silence(g, 0);
  run(g, 10);
  assert.equal(b.progress, 0, 'ohne Bauer kein Fortschritt');

  // zwei Bauer direkt am Gebäude: 25 s Bauzeit / 2 = 12,5 s
  const g2 = mk({ seed: 7 });
  silence(g2, 0);
  const f2 = fobOf(g2, 0);
  const spot2 = findSpot(g2, 0, 'mortar', f2.x, f2.y);
  const site = g2.spawnBuilding('mortar', 0, cellOf(spot2.x) - 1, cellOf(spot2.y) - 1, { built: false });
  engineerBeside(g2, site);
  engineerBeside(g2, site);
  run(g2, 13);
  assert.equal(site.built, true, 'mit 2 Bauern nach ~12,5 s fertig');
  const g1 = mk({ seed: 7 });
  silence(g1, 0);
  const f1 = fobOf(g1, 0);
  const spot1 = findSpot(g1, 0, 'mortar', f1.x, f1.y);
  const one = g1.spawnBuilding('mortar', 0, cellOf(spot1.x) - 1, cellOf(spot1.y) - 1, { built: false });
  engineerBeside(g1, one);
  run(g1, 13);
  assert.equal(one.built, false, 'mit einem Bauer noch nicht fertig');
  run(g1, 13);
  assert.equal(one.built, true);
});

test('Bauer hilft automatisch: idle Baufahrzeug in 400 px baut Baustelle ohne ids', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const spot = findSpot(g, 0, 'mortar', f.x, f.y);
  const r = g.issue(0, { type: 'build', building: 'mortar', x: spot.x, y: spot.y });
  assert.equal(r.ok, true, r.reason);
  const b = g.getEntity(r.id);
  run(g, 28);
  assert.equal(b.built, true, 'Mörser (20 s) mit automatischem Bauer fertig');
});

test('Mauer blockiert Bewegung', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  // Mauerring 5×5 (Rand) um (c0, r0): ohne Vorkommen im Umkreis, alle Zellen frei, im Bauradius
  const ring = (c0, r0) => {
    const out = [];
    for (let k = -2; k <= 2; k++) {
      out.push([c0 + k, r0 - 2], [c0 + k, r0 + 2], [c0 - 2, r0 + k], [c0 + 2, r0 + k]);
    }
    return out;
  };
  let c0 = null;
  let r0 = null;
  search: for (let dc = 4; dc <= 10; dc++) {
    for (let dr = -10; dr <= 10; dr++) {
      const cc = cellOf(f.x) + dc;
      const rr = cellOf(f.y) + dr;
      const ok = ring(cc, rr).every(([c, r]) => g.grid.free(c, r));
      if (ok) {
        c0 = cc;
        r0 = rr;
        break search;
      }
    }
  }
  assert.notEqual(c0, null, 'freier Mauerplatz');
  const cx = g.grid.center(c0);
  const cy = g.grid.center(r0);
  const edges = [
    [c0 - 2, r0 - 2, c0 + 2, r0 - 2],
    [c0 + 2, r0 - 2, c0 + 2, r0 + 2],
    [c0 + 2, r0 + 2, c0 - 2, r0 + 2],
    [c0 - 2, r0 + 2, c0 - 2, r0 - 2],
  ];
  let placed = 0;
  for (const [a, b, c, d] of edges) {
    const r = g.issue(0, {
      type: 'buildWall',
      building: 'wall',
      x1: g.grid.center(a),
      y1: g.grid.center(b),
      x2: g.grid.center(c),
      y2: g.grid.center(d),
    });
    assert.equal(r.ok, true, r.reason);
    placed += r.count;
  }
  assert.equal(placed, 16);
  assert.equal(g.grid.passable(c0 + 2, r0, 0), false);

  const u = g.spawnUnit('rifleman', 0, cx, cy);
  const far = g.issue(0, { type: 'move', ids: [u.id], x: cx - 600, y: cy });
  assert.equal(far.ok, true);
  run(g, 10);
  assert.ok(u.alive);
  assert.ok(cellOf(u.x) >= c0 - 1 && cellOf(u.x) <= c0 + 1, `x-Zelle ${cellOf(u.x)}`);
  assert.ok(cellOf(u.y) >= r0 - 1 && cellOf(u.y) <= r0 + 1, `y-Zelle ${cellOf(u.y)}`);
});

test('Schütze baut Mauer, Schütze kann keine Halle bauen', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const rifle = unitsOf(g, 0, 'rifleman')[0];
  rifle.x = f.x + 80; // Startaufstellung steht weiter weg: der Schütze soll hier neben der FOB stehen
  rifle.y = f.y + 80;
  const spot = findSpot(g, 0, 'mortar', f.x, f.y);
  const bad = g.issue(0, { type: 'build', ids: [rifle.id], building: 'mortar', x: spot.x, y: spot.y });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'Nur Baufahrzeuge bauen das');

  const w = findSpot(g, 0, 'wall', f.x, f.y);
  const ok = g.issue(0, { type: 'build', ids: [rifle.id], building: 'wall', x: w.x, y: w.y });
  assert.equal(ok.ok, true, ok.reason);
  const wall = g.getEntity(ok.id);
  assert.equal(wall.payerId, null, 'Soldaten zahlen aus getragenem Baumaterial, kein Lager zahlt');
  assert.equal(rifle.cargo.bm, rifle.def.bmCap - BUILDINGS.wall.cost.bm, 'getragenes Baumaterial sinkt');
  run(g, 3);
  assert.equal(wall.built, true, 'Schütze baut die Mauer (2 s)');
});

test('Soldaten tragen wenig Baumaterial: reicht es nicht, baut nichts; in der FOB laden sie nach; nur im Bauradius', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const rifle = unitsOf(g, 0, 'rifleman')[0];
  assert.equal(rifle.cargo.bm, rifle.def.bmCap, 'starten voll');
  rifle.cargo.bm = 5; // weniger als eine Mauer (8)
  const w = findSpot(g, 0, 'wall', f.x, f.y);
  const no = g.issue(0, { type: 'build', ids: [rifle.id], building: 'wall', x: w.x, y: w.y });
  assert.equal(no.ok, false);
  assert.match(no.reason, /getragenes Baumaterial/);
  // im Bauradius einer FOB lädt der Soldat nach (bmRate 20/s)
  rifle.x = f.x + 120;
  rifle.y = f.y + 120;
  run(g, 3);
  assert.equal(rifle.cargo.bm, rifle.def.bmCap, 'in der FOB nachgeladen');
  assert.equal(g.issue(0, { type: 'build', ids: [rifle.id], building: 'wall', x: w.x, y: w.y }).ok, true);
  // außerhalb jedes Bauradius: kein Bau, auch nicht mit LKW-Ladung daneben
  const far = g.canPlace(0, 'wall', f.x + 1500, f.y, { carried: true });
  assert.equal(far.ok, false);
  assert.match(far.reason, /Bauradius/);
  // Baufahrzeuge zahlen weiter aus dem Lager der FOB
  const eng = unitsOf(g, 0, 'engineer')[0];
  const bm0 = f.store.bm;
  const w2 = findSpot(g, 0, 'wall', f.x - 100, f.y);
  const r = g.issue(0, { type: 'build', ids: [eng.id], building: 'wall', x: w2.x, y: w2.y });
  assert.equal(r.ok, true, r.reason);
  assert.equal(f.store.bm, bm0 - BUILDINGS.wall.cost.bm);
});

test('FOB-Fahrzeug: Fabrikhalle bildet es aus, Aufbauen macht sofort eine fertige FOB mit 20 % Lager', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  assert.ok(trainer(g, 'fobTruck'), 'Fabrikhalle bildet FOB-Fahrzeuge aus');
  const spot = findSpot(g, 0, 'fob', f.x, f.y, 950, 1300);
  assert.ok(spot, 'freie FOB-Stelle');
  const v = g.spawnUnit('fobTruck', 0, spot.x, spot.y);
  const fobs = () => g.buildings.filter((b) => b.alive && b.team === 0 && b.type === 'fob').length;
  const n0 = fobs();

  // zu nah an der Hauptstadt: geht nicht, das Fahrzeug bleibt
  const near = g.spawnUnit('fobTruck', 0, f.x + 200, f.y);
  const bad = g.issue(0, { type: 'deploy', ids: [near.id] });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'Zu nah an einer eigenen FOB');
  assert.equal(near.alive, true);

  const r = g.issue(0, { type: 'deploy', ids: [v.id] });
  assert.equal(r.ok, true, r.reason);
  const fob = g.getEntity(r.ids[0]);
  assert.equal(fob.built, true, 'sofort fertig, ohne Bauzeit');
  assert.equal(fob.hp, fob.maxHp);
  const share = Math.round(BALANCE.logistics.storeCap * BALANCE.fob.startStock);
  assert.equal(share, 600);
  assert.deepEqual(fob.store, { bm: share, mun: share, fuel: share });
  assert.equal(v.alive, false, 'das Fahrzeug ist jetzt die FOB');
  run(g, 1);
  assert.equal(fobs(), n0 + 1);
  assert.equal(g.getEntity(v.id), null);

  // blockierte Stelle (Mauer unter dem Fahrzeug): die FOB entsteht auf der nächsten freien Stelle daneben
  const spot2 = findSpot(g, 0, 'fob', f.x, f.y, 1900, 2600);
  assert.ok(spot2, 'zweite FOB-Stelle');
  const v2 = g.spawnUnit('fobTruck', 0, spot2.x, spot2.y);
  const wall = g.spawnBuilding('wall', 0, g.grid.toCell(v2.x), g.grid.toCell(v2.y), { built: true });
  const r2 = g.issue(0, { type: 'deploy', ids: [v2.id] });
  assert.equal(r2.ok, true, r2.reason);
  const fob2 = g.getEntity(r2.ids[0]);
  assert.ok(Math.hypot(fob2.x - v2.x, fob2.y - v2.y) <= BALANCE.fob.deploySnap + 48, 'nahe am Fahrzeug');
  assert.ok(!(wall.cx >= fob2.cx && wall.cx < fob2.cx + 3 && wall.cy >= fob2.cy && wall.cy < fob2.cy + 3), 'nicht auf der Mauer');
});

test('Baufahrzeug baut keine FOB mehr', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const eng = unitsOf(g, 0, 'engineer')[0];
  const spot = findSpot(g, 0, 'fob', f.x, f.y, 950, 1300);
  const r = g.issue(0, { type: 'buildFob', ids: [eng.id], x: spot.x, y: spot.y });
  assert.equal(r.ok, false);
  assert.equal(g.issue(0, { type: 'build', ids: [eng.id], building: 'fob', x: spot.x, y: spot.y }).ok, false);
  assert.equal(g.issue(0, { type: 'deploy', ids: [eng.id] }).ok, false, 'Baufahrzeug kann nicht aufbauen');
});

test('Reparatur: Baufahrzeug heilt, kostet Baumaterial aus dem Lager des Zahlers', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  f.hp = f.maxHp - 500;
  const eng = unitsOf(g, 0, 'engineer')[0];
  const bm0 = f.store.bm;
  const r = g.issue(0, { type: 'repair', ids: [eng.id], targetId: f.id });
  assert.equal(r.ok, true, r.reason);
  run(g, 5);
  const healed = f.hp - (f.maxHp - 500);
  assert.ok(healed > 0, 'Schaden geheilt');
  const spent = bm0 - f.store.bm;
  const expected = (BUILDINGS.fob.cost.bm * healed) / f.maxHp * BALANCE.construction.repairCostShare;
  assert.ok(Math.abs(spent - expected) < 0.05, `Kosten ${spent} statt ${expected}`);
  run(g, 60);
  assert.equal(f.hp, f.maxHp, 'vollständig geheilt');
  assert.equal(eng.order.type, 'idle', 'Baufahrzeug wird danach idle');
});

test('Reparatur ohne FOB-Lager in Reichweite findet nicht statt', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  const wall = g.spawnBuilding('wall', 0, cellOf(f.x) + 20, cellOf(f.y), { built: true });
  wall.hp = 100;
  const eng = unitsOf(g, 0, 'engineer')[0];
  eng.x = wall.x - 60; // neben die Mauer stellen (die Startaufstellung steht weiter weg)
  eng.y = wall.y;
  assert.equal(g.issue(0, { type: 'repair', ids: [eng.id], targetId: wall.id }).ok, true);
  run(g, 10);
  assert.equal(wall.hp, 100);
  assert.equal(eng.order.type, 'idle');
});
