// LKW-Ladungsarten (Paket „LKW-Ladungsarten“): zwei Sorten zugleich wie „mun+fuel“, die Umschalter W/E/R auf der Befehlskarte
// und das Laden nur der gewählten Sorten. Die Logik liegt in js/game/logistics.js (presetKinds, presetOf, loadStep), die Umschalter
// in js/ui/controller/cards.js; hier läuft die Befehlskarte über den echten Controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { classic } from './classic.js';
import { Controller } from '../js/ui/controller.js';
import { Camera } from '../js/render/camera.js';
import { BALANCE } from '../js/data/balance.js';
import { PRESETS, presetKinds, presetOf } from '../js/game/logistics.js';

const DT = 0.05;
const L = BALANCE.logistics;
const mk = (opts) => classic(new Game({ ...opts }));

function run(game, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) game.update(DT);
}

function fobOf(game, t) {
  return game.buildings.find((b) => b.alive && b.team === t && b.type === 'fob' && b.built);
}

/** Fertige vordere FOB 30 Felder vor der Hauptstadt (Richtung Kartenmitte), deren Lager nur der Test füllt. */
function frontFob(game, team = 0) {
  const m = fobOf(game, team);
  const f = game.spawnBuilding('fob', team, m.cx + 30 * Math.sign(game.zone.x - m.x), m.cy + 30 * Math.sign(game.zone.y - m.y), { built: true });
  f.store.bm = f.store.mun = f.store.fuel = 0;
  return f;
}

/** Start-LKW und Baufahrzeug entfernen, übrige Start-Einheiten voll versorgt (kein Nachschub nötig). */
function silence(game, team) {
  for (const u of game.units) {
    if (u.team !== team) continue;
    if (u.type === 'engineer' || u.type === 'truck') u.alive = false;
    else {
      u.ammo = u.def.ammoMax ?? 0;
      u.fuel = u.def.fuelMax ?? 0;
    }
  }
}

function controllerOf(game) {
  return new Controller(game, 0, new Camera(BALANCE.map.width * BALANCE.map.tile, BALANCE.map.height * BALANCE.map.tile));
}

/** Befehlskarte mit den gewählten LKW; liefert den Eintrag mit dieser Bezeichnung. */
function pick(c, trucks, label) {
  c.view.selection.clear();
  for (const t of trucks) c.view.selection.add(t.id);
  const e = c.commandCard().find((x) => x.label === label);
  assert.ok(e, `Eintrag „${label}“ fehlt auf der Befehlskarte`);
  return e;
}

test('presetKinds: Sorten je Ladungsart in fester Reihenfolge', () => {
  assert.deepEqual(presetKinds('mix'), ['bm', 'mun', 'fuel']);
  assert.deepEqual(presetKinds('bm'), ['bm']);
  assert.deepEqual(presetKinds('mun'), ['mun']);
  assert.deepEqual(presetKinds('fuel'), ['fuel']);
  assert.deepEqual(presetKinds('bm+mun'), ['bm', 'mun']);
  assert.deepEqual(presetKinds('bm+fuel'), ['bm', 'fuel']);
  assert.deepEqual(presetKinds('mun+fuel'), ['mun', 'fuel']);
  assert.deepEqual(presetKinds('foo'), [], 'unbekannte Art: keine Sorte');
  assert.deepEqual(presetKinds(undefined), [], 'fehlende Art: keine Sorte');
});

test('presetOf: kanonische Schreibweise, alle drei = mix, keine Sorte = null', () => {
  assert.equal(presetOf(['bm', 'mun', 'fuel']), 'mix');
  assert.equal(presetOf(['fuel', 'bm', 'mun']), 'mix', 'Reihenfolge egal');
  assert.equal(presetOf(['fuel', 'mun']), 'mun+fuel', 'feste Reihenfolge bm, mun, fuel');
  assert.equal(presetOf(['fuel', 'bm']), 'bm+fuel');
  assert.equal(presetOf(['mun', 'bm']), 'bm+mun');
  assert.equal(presetOf(['mun']), 'mun');
  assert.equal(presetOf([]), null);
  assert.equal(presetOf(['mun', 'mun']), 'mun', 'doppelte Sorten zählen einmal');
});

test('presetOf und presetKinds widersprechen sich nicht: jede Art kommt zurück', () => {
  for (const p of PRESETS) assert.equal(presetOf(presetKinds(p)), p, p);
  assert.equal(PRESETS.length, 7, 'mix, bm, mun, fuel und die drei Paare');
  assert.equal(new Set(PRESETS).size, PRESETS.length, 'keine doppelten Arten');
});

test('setPreset: Paare in fester Reihenfolge werden angenommen, andere Schreibweisen abgelehnt', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  const truck = g.spawnUnit('truck', 0, f.x + 60, f.y);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'mun+fuel' }).ok, true);
  assert.equal(truck.preset, 'mun+fuel');
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'bm+mun' }).ok, true);
  assert.equal(truck.preset, 'bm+mun');
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'fuel+mun' }).ok, false, 'falsche Reihenfolge');
  assert.equal(truck.preset, 'bm+mun', 'abgelehnt: Art bleibt');
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'foo' }).ok, false);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'bm+mun+fuel' }).ok, false, 'drei Sorten nur als mix');
  assert.equal(g.issue(0, { type: 'load', ids: [truck.id], fobId: f.id, preset: 'fuel+mun' }).ok, false, 'load lehnt sie auch ab');
});

test('LKW mit „mun+fuel“ an einer FOB mit allen drei Sorten lädt nur Munition und Treibstoff, etwa gleich viel', () => {
  const g = mk({ seed: 7 });
  const f = frontFob(g); // vordere FOB: das Lager der Hauptstadt füllen und leeren die Werke der Stadt
  silence(g, 0);
  f.store.bm = 1000;
  f.store.mun = 1000;
  f.store.fuel = 1000;
  const truck = g.spawnUnit('truck', 0, f.x + 60, f.y);
  const r = g.issue(0, { type: 'load', ids: [truck.id], fobId: f.id, preset: 'mun+fuel' });
  assert.equal(r.ok, true, r.reason);
  run(g, 10);
  assert.equal(truck.cargo.bm, 0, 'kein Baumaterial');
  assert.equal(truck.cargo.mun + truck.cargo.fuel, L.truckCapacity, 'voll mit Munition und Treibstoff');
  assert.ok(Math.abs(truck.cargo.mun - truck.cargo.fuel) <= 2 * L.transferRate * DT, `etwa gleich viel: ${truck.cargo.mun} / ${truck.cargo.fuel}`);
  assert.equal(f.store.bm, 1000, 'Baumaterial im Lager unberührt');
  assert.equal(f.store.mun, 1000 - truck.cargo.mun, 'Munition aus dem Lager');
  assert.equal(f.store.fuel, 1000 - truck.cargo.fuel, 'Treibstoff aus dem Lager');
});

test('LKW mit „bm+fuel“ lädt nur, was die Sorte im Lager hergibt: Munition im Lager bleibt liegen', () => {
  const g = mk({ seed: 7 });
  const f = frontFob(g); // vordere FOB: das Lager der Hauptstadt füllen und leeren die Werke der Stadt
  silence(g, 0);
  f.store.bm = 0;
  f.store.mun = 1000;
  f.store.fuel = 0;
  const truck = g.spawnUnit('truck', 0, f.x + 60, f.y);
  assert.equal(g.issue(0, { type: 'load', ids: [truck.id], fobId: f.id, preset: 'bm+fuel' }).ok, true);
  run(g, 3);
  assert.equal(truck.cargo.bm + truck.cargo.mun + truck.cargo.fuel, 0, 'nichts geladen: passende Sorten leer');
  assert.equal(truck.order.type, 'idle', 'fährt leer ab wie bei einer leeren Sorte');
  assert.equal(f.store.mun, 1000, 'Munition nicht angerührt');
});

test('Umschalter W/E/R auf der Befehlskarte: eine Sorte dazu, eine weg, Gemischt setzt alle drei', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  const truck = g.spawnUnit('truck', 0, f.x + 60, f.y);
  const c = controllerOf(g);
  const expectActive = (labels) => {
    c.view.selection.clear();
    c.view.selection.add(truck.id);
    const card = c.commandCard();
    for (const label of ['Gemischt', 'Baumat.', 'Munition', 'Treibstoff']) {
      const e = card.find((x) => x.label === label);
      assert.equal(e.active, labels.includes(label), `${label} aktiv? (Art ${truck.preset})`);
    }
  };

  assert.equal(truck.preset, 'mix');
  expectActive(['Gemischt']);
  pick(c, [truck], 'Munition').action(); // aus „alle drei“ wird „Baumaterial + Treibstoff“
  assert.equal(truck.preset, 'bm+fuel');
  pick(c, [truck], 'Treibstoff').action();
  assert.equal(truck.preset, 'bm');
  pick(c, [truck], 'Munition').action();
  assert.equal(truck.preset, 'bm+mun');
  expectActive(['Baumat.', 'Munition']);
  pick(c, [truck], 'Baumat.').action(); // Baumaterial weg, Munition bleibt
  assert.equal(truck.preset, 'mun');
  pick(c, [truck], 'Baumat.').action(); // wieder dazu
  assert.equal(truck.preset, 'bm+mun');
  pick(c, [truck], 'Gemischt').action();
  assert.equal(truck.preset, 'mix');
  expectActive(['Gemischt']);
});

test('Umschalter: die letzte Sorte lässt sich nicht abschalten, die Art bleibt', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  const truck = g.spawnUnit('truck', 0, f.x + 60, f.y);
  const c = controllerOf(g);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [truck.id], preset: 'fuel' }).ok, true);
  pick(c, [truck], 'Treibstoff').action();
  assert.equal(truck.preset, 'fuel', 'Treibstoff bleibt gewählt');
  pick(c, [truck], 'Treibstoff').action();
  assert.equal(truck.preset, 'fuel', 'auch beim zweiten Klick');
});

test('Umschalter bei mehreren LKW: Ausgangsbasis ist der erste gewählte, alle bekommen dieselbe Art', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  const a = g.spawnUnit('truck', 0, f.x + 60, f.y);
  const b = g.spawnUnit('truck', 0, f.x + 80, f.y);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [a.id], preset: 'bm' }).ok, true);
  assert.equal(b.preset, 'mix');
  const c = controllerOf(g);
  const e = pick(c, [a, b], 'Munition');
  assert.match(e.tip, /an\/aus \(E\)/);
  assert.match(e.tip, /mehrere Sorten zugleich möglich, z\. B\. Munition und Treibstoff/);
  e.action();
  assert.equal(a.preset, 'bm+mun');
  assert.equal(b.preset, 'bm+mun');
  assert.equal(pick(c, [a, b], 'Munition').active, true);
  assert.equal(pick(c, [a, b], 'Treibstoff').active, false);
});

test('Aktiv-Anzeige: bei gemischten LKW leuchtet eine Sorte nur, wenn alle sie haben', () => {
  const g = mk({ seed: 7 });
  const f = fobOf(g, 0);
  silence(g, 0);
  const a = g.spawnUnit('truck', 0, f.x + 60, f.y);
  const b = g.spawnUnit('truck', 0, f.x + 80, f.y);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [a.id], preset: 'mun+fuel' }).ok, true);
  assert.equal(g.issue(0, { type: 'setPreset', ids: [b.id], preset: 'fuel' }).ok, true);
  const c = controllerOf(g);
  assert.equal(pick(c, [a, b], 'Treibstoff').active, true, 'beide haben Treibstoff');
  assert.equal(pick(c, [a, b], 'Munition').active, false, 'nur einer hat Munition');
  assert.equal(pick(c, [a, b], 'Gemischt').active, false);
});
