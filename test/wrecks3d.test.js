// 3D-Einheiten (Instancing, Teamfarbe je Instanz, Lackfoto) und 3D-Fahrzeugwracks (verkohlt, Turm verdreht/abgesprengt, sinkend):
// prüft alle Wrack- und Einheitenmodelle auf gültige Geometrie (keine NaN, Einheitsnormalen), Instanzierung über alle Teams hinweg,
// Schattenebene CAST, Turmlage und Einsinken. Läuft in Node ohne DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { unitModelTypes, unitModel, SHOWROOM } from '../js/render/unitpaint.js';
import { clearModelCache } from '../js/render3d/solids3d.js';
import { Units3D, ISO_SCALE, teamSlotOf } from '../js/render3d/units3d.js';
import { Wrecks3D, wreckPose, wreckModelTypes } from '../js/render3d/wrecks3d.js';
import { CAST } from '../js/render3d/sun3d.js';

function checkGeo(name, g, extraAttrs = []) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('color');
  assert.ok(pos && pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const attr of [pos, nor, col, ...extraAttrs.map((a) => g.getAttribute(a))]) {
    assert.ok(attr && attr.count === pos.count, `${name}: Attribut fehlt oder falsche Länge`);
    for (const v of attr.array) assert.ok(Number.isFinite(v), `${name}: NaN/Inf`);
  }
  for (let i = 0; i < nor.count; i++) {
    const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    assert.ok(Math.abs(l - 1) < 1e-3, `${name}: Normale Länge ${l}`);
  }
}

test('Wracks 3D: alle Fahrzeugmodelle gültig, ohne NaN, mit Schatten auf Ebene CAST', () => {
  clearModelCache();
  const types = wreckModelTypes();
  assert.ok(types.length >= 20, `erwartet ≥ 20 Fahrzeugmodelle, bekam ${types.length}`);
  const wr = new Wrecks3D();
  wr.begin([0.5, -0.5, 0.7]);
  let id = 1;
  for (const type of types) {
    const ok = wr.show({ id: id++, type, x: id * 40, y: 100, angle: id * 0.37 }, 12, 1);
    assert.equal(ok, true, `${type}: show() muss true liefern`);
  }
  wr.end();
  assert.equal(wr.count, types.length);
  for (const [key, s] of wr.sets) {
    checkGeo(key, s.geo);
    assert.equal(s.mesh.castShadow, true, `${key}: wirft keinen Schatten`);
    assert.equal(s.mesh.layers.isEnabled(CAST), true, `${key}: nicht auf Ebene CAST`);
    assert.equal(s.mesh.visible, true);
  }
  // Infanterie und unbekannte Art: false (Rückfall auf bisherigen Maler)
  wr.begin([0.5, -0.5, 0.7]);
  assert.equal(wr.show({ id: 999, type: 'rifleman', x: 0, y: 0, angle: 0 }, 0, 1), false);
  assert.equal(wr.show({ id: 998, type: 'unbekannt', x: 0, y: 0, angle: 0 }, 0, 1), false);
  wr.end();
  wr.dispose();
});

test('Wracks 3D: Turmlage deterministisch, verdreht und teils abgesprengt; Instanzen und Einsinken stimmen', () => {
  assert.equal(wreckPose({ id: 1 }, false), null);
  const a = wreckPose({ id: 42 }, true);
  const b = wreckPose({ id: 42 }, true);
  assert.deepEqual(a, b);
  let blown = 0;
  for (let i = 1; i <= 200; i++) {
    const p = wreckPose({ id: i }, true);
    for (const v of [p.twist, p.dx, p.dy, p.tiltX, p.tiltY]) assert.ok(Number.isFinite(v));
    if (p.blown) blown++;
  }
  assert.ok(blown > 30 && blown < 90, `erwartet ~30 % abgesprengt, bekam ${blown}/200`);

  // 40 frische Panzerwracks (wächst über INIT_CAP 32 hinaus) teilen sich 2 Draw-Calls (Wanne + Turm)
  const wr = new Wrecks3D();
  wr.begin([0.5, -0.5, 0.7]);
  for (let i = 1; i <= 40; i++) {
    assert.equal(wr.show({ id: i, type: 'tank', x: i * 30, y: 50, angle: i * 0.2 }, 10, 1), true);
  }
  // 1 verblassendes Panzerwrack (fade 0.25) landet im durchscheinenden Satz mit aFade und sanftem Einsinken
  assert.equal(wr.show({ id: 50, type: 'tank', x: 0, y: 80, angle: 0.5 }, 10, 0.25), true);
  // fade <= 0: wird nicht gezählt
  assert.equal(wr.show({ id: 99, type: 'tank', x: 0, y: 0, angle: 0 }, 10, 0), true);
  wr.end();
  const st = wr.stats();
  assert.equal(st.total, 41);
  assert.equal(st.calls, 4, '40 frische + 1 verblassendes Panzerwrack müssen 4 Sätze sein (Wanne/Turm × fest/verblassend)');
  assert.equal(st.instances, 82);

  // Einsinken und Verblassen: frische Instanz hat volle Höhe ISO_SCALE, verblassende hat sinkMin + (1 - sinkMin) * 0.25 und aFade = 0.25
  const hullSet = wr.sets.get('wh|tank');
  const fadeSet = wr.sets.get('wh|tank|f');
  const m0 = new THREE.Matrix4();
  const m1 = new THREE.Matrix4();
  hullSet.mesh.getMatrixAt(0, m0);
  fadeSet.mesh.getMatrixAt(0, m1);
  const s0 = new THREE.Vector3();
  const s1 = new THREE.Vector3();
  m0.decompose(new THREE.Vector3(), new THREE.Quaternion(), s0);
  m1.decompose(new THREE.Vector3(), new THREE.Quaternion(), s1);
  assert.ok(Math.abs(s0.z - ISO_SCALE) < 1e-4);
  assert.ok(s1.z > ISO_SCALE * 0.35 && s1.z < ISO_SCALE * 0.7);
  assert.ok(Math.abs(fadeSet.fadeAttr.array[0] - 0.25) < 1e-4);
  assert.equal(fadeSet.mesh.castShadow, false);
  wr.dispose();
});

test('Einheiten 3D: alle 35 Arten mit Team-Geometrie und Lackfoto-Attributen gültig', () => {
  clearModelCache();
  const u3 = new Units3D();
  u3.begin([0.5, -0.5, 0.7]);
  const types = unitModelTypes();
  assert.ok(types.length >= 35);
  let id = 1;
  for (const type of types) {
    const res = u3.show({ id: id++, type, team: id % 4, x: id * 20, y: 40, angle: 0.5 }, 5, 0, 1.2, 0);
    const m = unitModel(type, 0, { frame: 0 });
    assert.equal(res, m.inf ? 'painted' : true, `${type}: falscher Rückgabewert`);
  }
  u3.end();
  for (const [key, s] of u3.sets) checkGeo(key, s.baseGeo, ['aPaint', 'aUv', 'aMat']);
  // Panzer trägt Lackfoto armor (1), Soldat keins (0)
  const tankMat = [...u3.sets.entries()].find(([k]) => k.startsWith('h|tank|'))[1].baseGeo.getAttribute('aMat').array;
  const infMat = [...u3.sets.entries()].find(([k]) => k.startsWith('h|rifleman|'))[1].baseGeo.getAttribute('aMat').array;
  assert.ok(tankMat.some((v) => v === 1), 'Panzer braucht aMat = 1 (armor)');
  assert.ok(infMat.every((v) => v === 0), 'Soldat darf kein Lackfoto tragen');
  u3.dispose();
});

test('Einheiten 3D: Instancing über alle Teams und 200 Einheiten mit wenigen Draw-Calls', () => {
  const u3 = new Units3D();
  u3.begin([0.5, -0.5, 0.7]);
  // 4 Teams eines Panzers teilen sich 1 Wannen- und 1 Turm-InstancedMesh
  const teams = [0, 1, 2, 3, -1, SHOWROOM];
  for (let i = 0; i < teams.length; i++) {
    u3.show({ id: i + 1, type: 'tank', team: teams[i], x: i * 40, y: 100, angle: 0.5 }, 10, 0, 1.8, 0);
  }
  u3.end();
  assert.equal(u3.stats().calls, 2, 'Alle Teams eines Panzers müssen 2 Sätze teilen');
  const hSet = u3.sets.get('h|tank|||0|');
  const tSet = u3.sets.get('t|tank|||0|');
  assert.equal(hSet.n, teams.length);
  assert.equal(tSet.n, teams.length);
  for (let i = 0; i < teams.length; i++) assert.equal(hSet.teamAttr.array[i], teamSlotOf(teams[i]));
  // Turmlage stimmt mit Wannenmitte + gedrehtem turret.x * ISO_SCALE überein
  const mTank = unitModel('tank', 0, {});
  const tMat = new THREE.Matrix4();
  tSet.mesh.getMatrixAt(0, tMat);
  const tPos = new THREE.Vector3();
  tMat.decompose(tPos, new THREE.Quaternion(), new THREE.Vector3());
  assert.ok(Math.abs(tPos.x - Math.cos(0.5) * mTank.turret.x * ISO_SCALE) < 1e-3);
  assert.ok(Math.abs(tPos.y - (100 + Math.sin(0.5) * mTank.turret.x * ISO_SCALE)) < 1e-3);
  assert.ok(Math.abs(tPos.z - 10) < 1e-3);

  // 200 Einheiten (Mischung wie spawnArmy) → höchstens 10 Draw-Calls, Wachstum über INIT_CAP 64 hinaus
  u3.begin([0.5, -0.5, 0.7]);
  const mix = ['tank', 'ifv', 'rifleman', 'rifleman', 'truck', 'tank', 'at', 'gunship'];
  for (let i = 0; i < 200; i++) {
    u3.show({ id: i + 10, type: mix[i % mix.length], team: i % 2, x: (i % 20) * 34, y: Math.floor(i / 20) * 34, angle: i * 0.1 }, 0, 0, i * 0.2, 0);
  }
  u3.end();
  const st = u3.stats();
  assert.equal(st.total, 200);
  assert.ok(st.calls <= 10, `erwartet ≤ 10 Draw-Calls für 200 Einheiten, bekam ${st.calls}`);
  // Soldaten werfen keinen Schatten, Fahrzeuge schon
  assert.equal(u3.sets.get('h|rifleman|0||0|').mesh.castShadow, false);
  assert.equal(u3.sets.get('h|rifleman|0||0|').mesh.layers.isEnabled(CAST), false);
  assert.equal(u3.sets.get('h|tank|||0|').mesh.castShadow, true);
  assert.equal(u3.sets.get('h|tank|||0|').mesh.layers.isEnabled(CAST), true);
  u3.dispose();
});
