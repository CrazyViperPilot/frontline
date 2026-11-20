// Platzprüfung des Karteneditors (js/editor/space.js): Grundflächen, Überschneidung, Stapeln.
import test from 'node:test';
import assert from 'node:assert/strict';
import { footprint, overlaps, blockerOf, hasRoom, stackTarget } from '../js/editor/space.js';
import { createEmptyMap, normalizeMap } from '../js/game/mapdata.js';
import { PROPS } from '../js/data/props.js';

const house = (x, y, extra = {}) => ({ x, y, w: 90, h: 70, kind: 'house', ...extra });

test('Rechtecke: Überdeckung ja, Berühren nein, gedreht per Trennachse', () => {
  const a = footprint('building', house(1000, 1000));
  assert.ok(overlaps(a, footprint('building', house(1080, 1000))));
  assert.ok(!overlaps(a, footprint('building', house(1090, 1000))), 'Kante an Kante');
  // um 45° gedreht: die Ecke reicht weiter als das ungedrehte Rechteck
  assert.ok(!overlaps(a, footprint('building', { x: 1080, y: 1000, w: 60, h: 60, kind: 'tower' })));
  assert.ok(overlaps(a, footprint('building', { x: 1080, y: 1000, w: 60, h: 60, kind: 'tower', angle: Math.PI / 4 })));
  const far = footprint('building', { x: 1090, y: 1080, w: 40, h: 40, kind: 'tower', angle: Math.PI / 4 });
  assert.ok(!overlaps(a, far));
});

test('Kreis gegen Rechteck und Kreis', () => {
  const r = footprint('building', house(1000, 1000));
  assert.ok(overlaps(r, footprint('obstacle', { x: 1000, y: 1100, r: 91 })));
  assert.ok(!overlaps(r, footprint('obstacle', { x: 1000, y: 1140, r: 91 })));
  assert.ok(overlaps(footprint('tree', { x: 0, y: 0, r: 20 }), footprint('tree', { x: 20, y: 0, r: 20 })));
  assert.ok(!overlaps(footprint('tree', { x: 0, y: 0, r: 20 }), footprint('tree', { x: 30, y: 0, r: 20 })), 'Kronen dürfen sich berühren');
});

test('Boden und Spielmarken belegen keinen Platz, Tarnnetz und Krater dürfen über allem liegen', () => {
  for (const k of ['road', 'rail', 'plaza', 'field', 'park', 'spawn', 'zone', 'flag']) assert.equal(footprint(k, { x: 0, y: 0, w: 10, h: 10, r: 10 }), null, k);
  assert.equal(footprint('prop', { kind: 'camo_net', x: 0, y: 0 }), null);
  assert.equal(footprint('prop', { kind: 'crater', x: 0, y: 0 }), null);
  const m = createEmptyMap();
  m.town.buildings.push(house(2000, 2000));
  m.town.fields.push({ x: 2000, y: 2000, w: 300, h: 220, kind: 'field', crop: 'wheat' });
  assert.ok(hasRoom(m, 'prop', { kind: 'camo_net', x: 2000, y: 2000 }));
  assert.ok(!hasRoom(m, 'prop', { kind: 'tent', x: 2000, y: 2000 }));
  assert.ok(hasRoom(m, 'car', { x: 2000, y: 2300 }), 'Auto auf dem Feld daneben');
});

test('blockerOf meldet das Hindernis, das verschobene Objekt selbst zählt nicht', () => {
  const m = createEmptyMap();
  const h = house(2000, 2000);
  m.town.buildings.push(h);
  m.trees.push({ x: 2200, y: 2000, r: 16 });
  assert.equal(blockerOf(m, 'building', h), null);
  assert.equal(blockerOf(m, 'building', house(2160, 2000)).k, 'tree');
  assert.equal(blockerOf(m, 'tree', { x: 2010, y: 2010, r: 16 }).o, h);
});

test('Zaunkacheln: Nachbarzellen stören sich nicht, ein Haus darüber schon', () => {
  const m = createEmptyMap();
  m.props = [{ kind: 'fence_wood', x: 16, y: 16 }];
  assert.ok(hasRoom(m, 'prop', { kind: 'fence_wood', x: 48, y: 16 }));
  assert.ok(hasRoom(m, 'prop', { kind: 'wall_stone', x: 16, y: 16 }), 'gleiche Zelle: Art wird ersetzt');
  m.town.buildings.push(house(100, 60));
  assert.ok(!hasRoom(m, 'prop', { kind: 'fence_wood', x: 80, y: 48 }));
});

test('Stapeln: nur Arten mit stack, nur auf dasselbe Stück; Karte behält die Lagen', () => {
  const m = createEmptyMap();
  m.props = [{ kind: 'pallets', x: 500, y: 500 }, { kind: 'tent', x: 700, y: 500 }];
  for (const k of ['container', 'pallets', 'crate_stack', 'tyres', 'log_pile']) assert.ok(PROPS.kinds[k].stack >= 2, k);
  assert.equal(stackTarget(m, 'pallets', 503, 502), m.props[0]);
  assert.equal(stackTarget(m, 'pallets', 700, 500), null);
  assert.equal(stackTarget(m, 'tent', 700, 500), null, 'Zelte stapeln sich nicht');
  const n = normalizeMap({ ...createEmptyMap(), props: [{ kind: 'pallets', x: 500, y: 500, stack: 3 }, { kind: 'tyres', x: 600, y: 500, stack: 9 }, { kind: 'tent', x: 700, y: 500, stack: 2 }] });
  assert.deepEqual(n.props.map((p) => p.stack), [3, PROPS.kinds.tyres.stack, undefined]);
});
