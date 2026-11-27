// Militärgebäude 3D (Paket „Militärgebäude 3D“, js/render3d/mil3d.js): alle Arten, Mauermasken, Tore, Baustufen und Ausbauten besetzter
// Häuser als Geometrie des Baukastens: gültig, sparsam, im Umriss wie das gemalte Bild (milbuild.js), Teamfarbe nur von der Instanz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_MATS } from '../js/render3d/kit3d.js';
import { FAMILIES } from '../js/render3d/town3d.js';
import { MIL3D_TYPES, milGeometry, milGeometryOf, milKey, fortGeometry, worksMask } from '../js/render3d/mil3d.js';
import { MIL_DIM, setMilWalls, milVariant, milDamaged, isMilBuilding } from '../js/render/milbuild.js';
import { FORT_DIM } from '../js/render/stronghold.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { ISO_K } from '../js/render/camera.js';

/** Attribute vollständig und endlich, Normalen Länge 1, Umlaufsinn passt zur Normale. */
function check(name, g) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of ['position', 'normal', 'color', 'aUv', 'aInfo']) {
    const at = g.getAttribute(a);
    assert.equal(at.count, pos.count, `${name}: ${a} fehlt`);
    for (const v of at.array) assert.ok(Number.isFinite(v), `${name}: ${a} NaN`);
  }
  for (let i = 0; i < nor.count; i++) assert.ok(Math.abs(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) - 1) < 1e-3, `${name}: Normale`);
  const info = g.getAttribute('aInfo');
  for (let i = 0; i < info.count; i++) {
    assert.ok(info.getX(i) >= 0 && info.getX(i) <= KIT_MATS.length, `${name}: Material`);
    assert.ok([0, 1, 2, 3, 4].includes(info.getZ(i)), `${name}: Schnee ${info.getZ(i)}`);
  }
  for (let t = 0; t < pos.count; t += 3) {
    const p = [0, 1, 2].map((k) => [pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)]);
    const e1 = p[1].map((v, i) => v - p[0][i]);
    const e2 = p[2].map((v, i) => v - p[0][i]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...n) < 1e-6) continue;
    assert.ok(n[0] * nor.getX(t) + n[1] * nor.getY(t) + n[2] * nor.getZ(t) > 0, `${name}: Dreieck ${t / 3} falsch herum`);
  }
}

const tris = (g) => g.getAttribute('position').count / 3;
const teamVerts = (g) => {
  const info = g.getAttribute('aInfo');
  let n = 0;
  for (let i = 0; i < info.count; i++) if (info.getY(i) === 97) n++;
  return n;
};
/** Umriss im Iso-Bild (Maßstab 1, Drehung 0): x = (u − v)·K, y = (u + v)·K/2 − h wie isokit.G. */
function iso(g) {
  const pos = g.getAttribute('position');
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const [u, v, h] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const x = (u - v) * ISO_K;
    const y = (u + v) * ISO_K * 0.5 - h;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}
const bbox = (g) => g.boundingBox;
const MAX_TRIS = 3000; // je Variante (FOB mit Wällen, Fahrzeugen und Zelt: knapp 1 400)

const BASE = {
  fob: [''], mortar: [''], aa: [''], phalanx: [''], drill: [''],
  tower: ['-', 'mortar', 'flak', 'sam'],
  wall: Array.from({ length: 16 }, (_, i) => String(i)),
  gate: ['u', 'v', 'Lu+', 'Lu-', 'Lv+', 'Lv-'],
};

test('Militärgebäude 3D: jede Art und Variante ist gültige, sparsame Geometrie mit Teamfarbe und zwischengespeichert', () => {
  assert.deepEqual(MIL3D_TYPES.slice().sort(), Object.keys(BUILDINGS).sort());
  assert.equal(milGeometry('barracks', ''), null);
  for (const [type, vs] of Object.entries(BASE)) {
    for (const v of vs) {
      const name = `${type} ${v}`;
      const g = milGeometry(type, v, 0);
      check(name, g);
      assert.equal(milGeometry(type, v, 0), g, `${name}: nicht zwischengespeichert`);
      assert.ok(tris(g) <= MAX_TRIS, `${name}: ${tris(g)} Dreiecke`);
      assert.ok(teamVerts(g) > 0, `${name}: keine Teamfarbe`);
      assert.ok(bbox(g).min.z >= -0.3, `${name}: unter dem Boden`);
    }
  }
});

test('Militärgebäude 3D: Umriss wie das gemalte Bild (milbuild.js Bildmaße und Höhen)', () => {
  const { TALL } = MIL_DIM;
  for (const [type, vs] of Object.entries(BASE)) {
    const half = BUILDINGS[type].w * 16;
    for (const v of vs) {
      const name = `${type} ${v}`;
      const [x0, y0, x1, y1] = iso(milGeometry(type, v, 0));
      // innerhalb der gemalten Bildfläche (milbuild.drawMilIso: ±1,42 · halbe Breite + 6 seitlich, TALL + 4 nach oben, 0,71 · halbe Breite + 6 nach unten)
      assert.ok(x0 >= -half * 1.42 - 6 - 3 && x1 <= half * 1.42 + 6 + 3, `${name}: Breite ${x0.toFixed(1)} … ${x1.toFixed(1)}`);
      assert.ok(y1 <= half * 0.71 + 6 + 3, `${name}: unten ${y1.toFixed(1)}`);
      // höchster Punkt wie TALL (gemessen mit Reserve; Antenne des Turms ohne Aufbau ragt ein paar px mehr heraus, gemalt abgeschnitten)
      assert.ok(-y0 <= TALL[type] + 4 + 8, `${name}: Höhe ${(-y0).toFixed(1)} über TALL ${TALL[type]}`);
      assert.ok(-y0 >= TALL[type] * 0.55, `${name}: zu niedrig (${(-y0).toFixed(1)} von ${TALL[type]})`);
    }
  }
  // Gebäude mit Platz (Mörser, Flugabwehr, Phalanx, Turm, Bohrer): Quadrat ±30 wie der gemalte Platz, FOB ±46 (Bodenfläche reicht bis zur Ecke)
  for (const [t, v, e] of [['mortar', '', 30], ['aa', '', 30], ['phalanx', '', 30], ['tower', '-', 30], ['drill', '', 30], ['fob', '', 46]]) {
    const [x0, , x1] = iso(milGeometry(t, v));
    assert.ok(Math.abs(x0 + 2 * e * ISO_K) <= 3 && Math.abs(x1 - 2 * e * ISO_K) <= 3, `${t}: Platz ${x0.toFixed(1)} … ${x1.toFixed(1)}`);
  }
});

test('Militärgebäude 3D: Mauerstücke reichen zu den Nachbarn in Weltrichtung (Maske 1 = +x, 2 = +y, 4 = −x, 8 = −y)', () => {
  const ext = (m) => bbox(milGeometry('wall', String(m)));
  for (let m = 0; m < 16; m++) {
    const b = ext(m);
    assert.equal(b.max.x >= 15.9, !!(m & 1), `Maske ${m}: +x`);
    assert.equal(b.max.y >= 15.9, !!(m & 2), `Maske ${m}: +y`);
    assert.equal(b.min.x <= -15.9, !!(m & 4), `Maske ${m}: −x`);
    assert.equal(b.min.y <= -15.9, !!(m & 8), `Maske ${m}: −y`);
    assert.ok(b.max.z >= 22 && b.max.z <= 24, `Maske ${m}: Höhe ${b.max.z}`); // WALL_H, Pfeiler 23,6
  }
  // Maske aus den Nachbarn des Spiels (milVariant), unabhängig von der Drehung der Ansicht
  const at = (cx, cy, type = 'wall') => ({ alive: true, type, cx, cy, built: true, w: 1, h: 1, hp: 10, maxHp: 10 });
  const mid = at(10, 10);
  setMilWalls([mid, at(11, 10), at(10, 9), at(10, 11, 'gate')]);
  assert.equal(milVariant(mid), 1 | 2 | 8);
  assert.equal(milKey({ ...mid, type: 'wall' }), 'wall|11|0');
  setMilWalls([]);
  assert.equal(milVariant(mid), 0);
});

test('Militärgebäude 3D: Tore, Torhälften, beschädigt und Baustellen', () => {
  // Einzeltor und Torhälften: Pfeiler an den Enden, Flügel in der Mitte
  const gate = bbox(milGeometry('gate', 'u'));
  assert.ok(gate.min.x <= -16 && gate.max.x >= 16 && gate.max.z >= 24, 'Tor u');
  const gv = bbox(milGeometry('gate', 'v'));
  assert.ok(gv.min.y <= -16 && gv.max.y >= 16, 'Tor v');
  for (const [v, axis, sign] of [['Lu+', 'x', 1], ['Lu-', 'x', -1], ['Lv+', 'y', 1], ['Lv-', 'y', -1]]) {
    const b = bbox(milGeometry('gate', v));
    // Pfeiler liegt am abgewandten Ende (a = −16,6 für sgn +, gespiegelt für sgn −), der Flügel reicht bis zur Fuge bei ±16
    assert.ok(Math.abs((sign > 0 ? b.min[axis] : b.max[axis]) - -sign * 16.6) <= 0.2, `Torhälfte ${v}: ${b.min[axis]} … ${b.max[axis]}`);
    assert.ok(Math.abs((sign > 0 ? b.max[axis] : b.min[axis]) - sign * 16) <= 0.2, `Torhälfte ${v}: Fuge`);
    assert.ok(b.max.z >= MIL_DIM.PIL_H + 4, `Torhälfte ${v}: Höhe`);
  }
  // beschädigt: gleiche Form, dunklere Farben, Teamfarbe bleibt der Instanz
  const a = milGeometry('aa', '', 0);
  const d = milGeometry('aa', '', 1);
  assert.notEqual(a, d);
  assert.equal(milGeometry('aa', '', 1), d);
  check('aa beschädigt', d);
  assert.equal(tris(a), tris(d));
  const ca = a.getAttribute('color');
  const cd = d.getAttribute('color');
  let sa = 0, sd = 0;
  for (let i = 0; i < ca.count; i++) { sa += ca.getX(i) + ca.getY(i) + ca.getZ(i); sd += cd.getX(i) + cd.getY(i) + cd.getZ(i); }
  assert.ok(sd < sa * 0.8 && sd > sa * 0.6, `dunkler: ${(sd / sa).toFixed(2)}`);
  assert.equal(teamVerts(a), teamVerts(d));
  // Baustellen: neun Stufen je Art, Rohbau wächst mit der Stufe (Turm am meisten), alles gültig und sparsam
  for (const type of MIL3D_TYPES) {
    let last = -1;
    for (let s = 0; s <= 8; s++) {
      const g = milGeometry(type, `s${s}`, 0);
      check(`${type} Stufe ${s}`, g);
      assert.ok(tris(g) <= MAX_TRIS, `${type} Stufe ${s}: ${tris(g)} Dreiecke`);
      assert.ok(teamVerts(g) > 0 || BUILDINGS[type].w === 1, `${type} Stufe ${s}: keine Teamfarbe`); // Bauzaun-Planen nur ab 2 × 2
      const z = bbox(g).max.z;
      assert.ok(z >= last - 1e-6, `${type}: Stufe ${s} niedriger als die davor`);
      last = z;
    }
    assert.ok(milGeometry(type, 's8', 0) !== milGeometry(type, 's0', 0));
  }
  assert.ok(bbox(milGeometry('tower', 's8')).max.z > bbox(milGeometry('tower', 's0')).max.z + 30, 'Turmbaustelle wächst');
});

test('Gebäudefamilie „mil“: Militärgebäude und Ausbauten teilen sich Town3D, eine Geometrie für alle Teams', () => {
  const fams = FAMILIES.filter((f) => f.name === 'mil');
  assert.equal(fams.length, 2);
  const [mil, fort] = fams;
  const b = { type: 'tower', team: 0, cx: 5, cy: 5, w: 2, h: 2, x: 100, y: 100, built: true, hp: 50, maxHp: 100, roof: 'flak' };
  const red = { kind: 'mil', x: 100, y: 100, b, color: '#c8423a' };
  const blue = { kind: 'mil', x: 100, y: 100, b: { ...b, team: 1 }, color: '#3a6fb3' };
  assert.ok(mil.has(red) && !mil.has({ kind: 'town' }) && !fort.has(red));
  assert.ok(mil.team && !fort.team);
  assert.equal(mil.geometry(red), mil.geometry(blue));
  assert.equal(mil.key(red), mil.key(blue));
  assert.equal(mil.key(red), 'tower|flak|0'); // hp 50 von 100: noch nicht unter der Hälfte
  assert.equal(milGeometryOf(b), milGeometry('tower', 'flak', 0));
  assert.equal(milDamaged({ ...b, hp: 49 }), 1);
  assert.equal(mil.key({ kind: 'mil', b: { ...b, hp: 49 } }), 'tower|flak|1');
  assert.ok(isMilBuilding(b) && !isMilBuilding({ type: 'fob', main: true }) && isMilBuilding({ type: 'fob' }));
  assert.ok(fort.has({ kind: 'fort' }) && fort.key({ W: 64, D: 56, mask: 7 }) === 'fort|64|56|7');
  for (const f of FAMILIES) assert.ok(['town', 'works', 'big', 'mil'].includes(f.name));
});

test('Ausbauten besetzter Häuser 3D: Sandsäcke, MG-Nest und Draht je Maske, gültig und innerhalb des Umfelds', () => {
  assert.equal(worksMask({ works: { sandbags: true, mgnest: true, wire: true } }), 7);
  assert.equal(worksMask(null), 0);
  assert.equal(FORT_DIM.q8(61), 64);
  for (const [W, D] of [[48, 48], [64, 56], [96, 72]]) {
    for (let mask = 1; mask < 8; mask++) {
      const name = `Haus ${W}×${D} Maske ${mask}`;
      const g = fortGeometry(W, D, mask);
      check(name, g);
      assert.equal(fortGeometry(W, D, mask), g);
      assert.ok(tris(g) <= 6000, `${name}: ${tris(g)} Dreiecke`);
      assert.equal(teamVerts(g), 0, `${name}: Teamfarbe`);
      const b = bbox(g);
      const rx = W / 2 + FORT_DIM.OFF + 4 + (mask & 2 ? 8 : 0);
      const ry = D / 2 + FORT_DIM.OFF + 4 + (mask & 2 ? 8 : 0);
      assert.ok(b.min.x >= -rx && b.max.x <= rx && b.min.y >= -ry && b.max.y <= ry, `${name}: ragt aus dem Umfeld`);
      assert.ok(b.max.z <= 8, `${name}: Höhe ${b.max.z}`);
    }
  }
  // Sandsäcke: zwei Lagen (4,5), Nest ohne Lagen (2,6), Draht nur Pfähle und Windungen (5,4)
  assert.ok(Math.abs(bbox(fortGeometry(64, 64, 1)).max.z - 2 * FORT_DIM.BAG_H) < 0.01);
  assert.ok(Math.abs(bbox(fortGeometry(64, 64, 2)).max.z - 3.9) < 0.01);
  const wz = bbox(fortGeometry(64, 64, 4)).max.z;
  assert.ok(wz >= 5.3 && wz <= 7.8, `Draht: Höhe ${wz}`);
});
