// 3D-Props (js/render3d/props3d.js): jede Art der Karte (Zäune, Mauern, Militär, Industrie, Raffinerie, Zivil) in allen Formen (Verbindungen,
// Tor, Trümmer, Lagen, Farb- und Detailvariante, Sommer und Winter) sowie Auto, Bank, Ballen und Kiste sind gültige, sparsame Geometrie
// im Umriss wie das gemalte Bild; Fahnentuch trägt aTeam; gleiche Formen teilen eine Geometrie; Instanzen stehen, wo sie sollen.
// Läuft in Node ohne DOM (three-Kern genügt). Fotos gemalt/3D: node tools/smoke-3d.mjs --only props.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { PROPS } from '../js/data/props.js';
import { propSolids3d } from '../js/render/mapprops.js';
import { carLook3d, benchLook3d, baleLook3d, crateSolids3d } from '../js/render/props.js';
import { PAINT } from '../js/render/unitpaint.js';
import { ISO_K } from '../js/render/camera.js';
import { formsOf, Props3D } from '../js/render3d/props3d.js';

const MAX_TRIS = 5000; // je Form (größte: Destillationskolonne ~3 900)

function valid(name, g) {
  const pos = g.getAttribute('position');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of ['position', 'normal', 'color']) {
    const at = g.getAttribute(a);
    assert.equal(at.count, pos.count, `${name}: ${a} fehlt`);
    for (const v of at.array) assert.ok(Number.isFinite(v), `${name}: ${a} NaN`);
  }
  const nor = g.getAttribute('normal');
  for (let i = 0; i < nor.count; i++) assert.ok(Math.abs(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) - 1) < 1e-3, `${name}: Normale`);
  assert.ok(pos.count / 3 <= MAX_TRIS, `${name}: ${pos.count / 3} Dreiecke`);
}

/** Iso-Umriss [x0, y0, x1, y1] (Welt-px, wie painter.js boundsOf ohne den Rand von 1) aller Ecken der Geometrien bei Drehung 0. */
function isoBounds(list) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { geo } of list) {
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const X = (x - y) * ISO_K;
      const Y = (x + y) * ISO_K * 0.5 - z;
      b[0] = Math.min(b[0], X);
      b[1] = Math.min(b[1], Y);
      b[2] = Math.max(b[2], X);
      b[3] = Math.max(b[3], Y);
    }
  }
  return b;
}

/** Umriss wie gemalt: das Mesh liegt im gemalten Bildbereich und füllt ihn bis auf wenige px (Körper nur für 2D fehlen). */
function sameOutline(name, S, list, tol = 0.5) {
  const painted = PAINT.boundsOf({}, S.filter((so) => so.only !== 'top'), 0, true); // ohne Körper nur für 2D, mit Rand 1
  const b = isoBounds(list);
  for (let i = 0; i < 4; i++) {
    const d = i < 2 ? b[i] - (painted[i] + 1) : painted[i] - 1 - b[i]; // ≥ 0: innen
    assert.ok(Math.abs(d) < 0.01 + tol, `${name}: Umriss Seite ${i} weicht ${d.toFixed(2)} px ab (3D ${b.map((v) => v.toFixed(1))} gemalt ${painted.map((v) => v.toFixed(1))})`);
  }
}

/** Zustände einer Kachelart bzw. eines Einzelstücks, wie propLooksOf sie bildet. */
function variants(kind, K) {
  const out = [];
  for (const rubble of [false, true]) {
    for (const v of [0, 2]) {
      for (const d of [0, 3]) {
        if (K.line) {
          for (const mask of [0, 0b0101, 0b1010, 0b0011, 0b0111, 0b1111, 0b0001]) {
            for (const gate of K.gate && !rubble ? [0, 1, 2] : [0]) out.push({ kind, mask, along: 'x', gate, rubble, v, d, stack: 1, single: false, a: 0, flag: false });
          }
        } else {
          for (const stack of K.stack ? [1, K.stack] : [1]) out.push({ kind, mask: 0, along: 'x', gate: K.gate ? 1 : 0, rubble, v, d, stack, single: true, a: 0.8, flag: !!K.flag });
        }
      }
    }
  }
  return out;
}

test('3D-Props: jede Art der Karte in jeder Form ist gültige, sparsame Geometrie im Umriss wie gemalt', () => {
  let n = 0;
  for (const season of ['summer', 'winter']) {
    for (const [kind, K] of Object.entries(PROPS.kinds)) {
      for (const o of variants(kind, K)) {
        const m = propSolids3d(o, season);
        if (!m.S) {
          assert.ok([6, 7, 14, 13, 2].includes(m.t), `${kind}: Maler-Typ ${m.t}`);
          assert.ok(Number.isFinite(m.o.x ?? 0), `${kind}`);
          continue;
        }
        const list = formsOf(m.key, m.S);
        const name = `${season} ${kind} ${o.mask}/${o.gate}/${o.rubble ? 'R' : ''}${o.v}${o.d}x${o.stack}`;
        if (!m.S.filter((so) => so.only !== 'top').length) {
          assert.equal(list.length, 0, `${name}: leeres Modell hat Geometrie`);
          continue;
        }
        assert.ok(list.length >= 1 && list.length <= 3, `${name}: ${list.length} Teilformen`);
        for (const f of list) valid(name, f.geo);
        sameOutline(name, m.S, list);
        n++;
      }
    }
  }
  assert.ok(n > 2000, `nur ${n} Formen geprüft`);
});

test('3D-Props: Fahnentuch trägt aTeam, andere Arten nicht; Teamfarbe ersetzt das Tuch, nicht den Mast', () => {
  for (const [kind, K] of Object.entries(PROPS.kinds)) {
    if (K.line) continue;
    const o = { kind, mask: 0, along: 'x', gate: 0, rubble: false, v: 0, d: 0, stack: 1, single: true, a: 0, flag: !!K.flag };
    const m = propSolids3d(o, 'summer');
    if (!m.S) continue;
    const list = formsOf(m.key, m.S);
    const team = list.filter((f) => f.team);
    if (K.flag) {
      assert.equal(team.length, 1, `${kind}: Fahne ohne Teamform`);
      const t = team[0].geo.getAttribute('aTeam');
      const ones = t.array.filter((v) => v === 1).length;
      assert.ok(ones > 0 && ones < t.count, `${kind}: Tuch ${ones} von ${t.count} Ecken`);
      assert.ok(ones <= 36, `${kind}: Tuch zu groß (${ones} Ecken)`);
    } else assert.equal(team.length, 0, `${kind}: Teamform ohne Fahne`);
  }
});

test('3D-Props: gleiche Form teilt eine Geometrie, durchscheinende Körper eigene Form mit Deckkraft', () => {
  const K = PROPS.kinds.fence_wire;
  const o = { kind: 'fence_wire', mask: 0b0101, along: 'x', gate: 0, rubble: false, v: 0, d: 0, stack: 1, single: false, a: 0, flag: false };
  const m = propSolids3d(o, 'summer');
  const a = formsOf(m.key, m.S);
  const b = formsOf('anderer-schluessel', m.S);
  assert.notEqual(a, b);
  assert.deepEqual(a.map((f) => f.hash), b.map((f) => f.hash));
  assert.deepEqual(a.map((f) => f.geo === b[a.indexOf(f)].geo), a.map(() => true), 'gleicher Inhalt, andere Geometrie');
  assert.ok(K.line);
  assert.ok(a.some((f) => f.alpha < 1), 'Maschendraht ist durchscheinend');
  assert.ok(a.some((f) => f.alpha === 1), 'Pfosten sind undurchsichtig');
});

test('3D-Props: Auto, Bank, Ballen, Kiste im Umriss wie gemalt, Maßstab und Drehung wie das Bild', () => {
  const car = { x: 100, y: 100, angle: 0.5, color: '#b02020' };
  for (const season of ['summer', 'winter']) {
    for (const c of [car, { ...car, charred: true }, { x: 300, y: 40, vertical: true, color: '#206090' }]) {
      const L = carLook3d(c, season);
      assert.equal(L.k, 1.5);
      assert.equal(L.charred, !!c.charred);
      const list = formsOf(L.key, L.S, L.charred);
      for (const f of list) valid('Auto', f.geo);
      sameOutline('Auto', L.S, list);
    }
    const B = benchLook3d({ x: 1, y: 2, rx: 1, ry: 0 }, season);
    assert.ok(Math.abs(B.yaw - Math.atan2(-1, 0)) < 1e-9);
    const bl = formsOf(B.key, B.S);
    for (const f of bl) valid('Bank', f.geo);
    sameOutline('Bank', B.S, bl);
    for (const kind of ['hay', 'straw']) {
      const A = baleLook3d({ x: 1, y: 2, a: 0.3, kind }, season);
      assert.equal(A.yaw, 0.3);
      const al = formsOf(A.key, A.S);
      for (const f of al) valid('Ballen', f.geo);
      const bb = isoBounds(al);
      assert.ok(bb[3] - bb[1] > 14 && bb[3] - bb[1] < 24, `Ballen ${bb}`);
    }
  }
  const cs = crateSolids3d();
  const cl = formsOf('crate', cs);
  for (const f of cl) valid('Kiste', f.geo);
  const cb = isoBounds(cl);
  // gemalt: 16 px Kantenlänge, 11,5 px hoch, Plombe etwas darüber
  assert.ok(cb[3] - cb[1] > 11.5 + 16 * ISO_K && cb[3] - cb[1] < 11.5 + 16 * ISO_K + 3, `Kiste Höhe ${cb[3] - cb[1]}`);
  assert.ok(Math.abs(cb[2] - cb[0] - 32 * ISO_K) < 3, `Kiste Breite ${cb[2] - cb[0]}`);
});

test('3D-Props: Instanz steht am Weltpunkt, gedreht um die Hochachse, im Maßstab; Satz voll → false', () => {
  const P = new Props3D();
  P.begin([0.3, 0.2, 0.9]);
  const o = { kind: 'tent', mask: 0, along: 'x', gate: 0, rubble: false, v: 0, d: 0, stack: 1, single: true, a: Math.PI / 2, flag: true };
  const m = propSolids3d(o, 'summer');
  assert.ok(P.add(m, 500, 300, 12, '#3d8bfd'));
  const set = [...P.sets.values()].find((s) => s.team);
  assert.ok(set, 'Satz mit Teamfarbe');
  assert.equal(set.n, 1);
  const mat = new THREE.Matrix4().fromArray(set.mesh.instanceMatrix.array, 0);
  const p = new THREE.Vector3(10, 0, 5).applyMatrix4(mat); // Modellpunkt (10, 0, 5) → um 90° gedreht
  assert.ok(Math.abs(p.x - 500) < 1e-4 && Math.abs(p.y - 310) < 1e-4 && Math.abs(p.z - 17) < 1e-4, `${p.x} ${p.y} ${p.z}`);
  const col = set.mesh.instanceColor.array;
  assert.ok(col[2] > col[0], 'Teamfarbe Blau');
  // Auto im Maßstab 1,5
  const L = carLook3d({ x: 0, y: 0, angle: 0, color: '#aa3333' }, 'summer');
  assert.ok(P.add(L, 40, 50, 0, null, 'car'));
  const cs = [...P.sets.values()].find((s) => s.art === 'car');
  assert.equal(cs.mesh.instanceMatrix.array[0], 1.5);
  assert.equal(cs.mesh.instanceMatrix.array[10], 1.5);
  P.end();
  assert.equal(P.stats().car, 1);
  assert.equal(P.stats().total, 2);
  // voll: beim Maximum meldet add false
  P.begin([0, 0, 1]);
  let ok = 0;
  while (P.add(m, 1, 1, 0, null) && ok < 5000) ok++;
  assert.ok(ok > 100 && ok < 5000, `Satz fasst ${ok}`);
  P.dispose();
});
