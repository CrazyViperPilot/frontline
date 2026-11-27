// 3D-Brücken und Furtstangen (js/render3d/bridge3d.js): jede Brücke der Flussseeds in allen Zuständen (intakt, Schaden, zerstört, Wiederaufbau
// in Stufen, Eisenbahnbrücke, Sommer, Herbst, Winter) ist gültige, sparsame Geometrie im Maß des gemalten Bildes (Länge, Breite der Fahrbahn,
// Höhe über dem Wasser); die Fahrbahn liegt auf b.deckH (dort stehen die Einheiten); die Furtstange ist eine Form; Brücken und Furtstangen
// haben keine Gebäudefamilie und keinen Rückfall in Town3D/Props3D. Läuft in Node ohne DOM. Fotos gemalt/3D: node tools/smoke-3d.mjs --only bruecke.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { Game } from '../js/game/game.js';
import { RELIEF } from '../js/game/relief.js';
import { fordPosts, BRIDGE } from '../js/render/bridge.js';
import { solidsToGeometry } from '../js/render3d/solids3d.js';
import { bridgeSolids, bridgeState, postSolids, Bridge3D } from '../js/render3d/bridge3d.js';
import { FAMILIES } from '../js/render3d/town3d.js';

const MAX_TRIS = 3500; // je Brücke (größte: 3 Pfeiler, 576 px, Wiederaufbau mit Gerüst ~2 350)
const MAX_POST_TRIS = 400;
const { DECK, LANE, LAMP_H, RAIL_H } = BRIDGE;
const SEASONS = ['summer', 'autumn', 'winter'];

function valid(name, g, maxTris) {
  const pos = g.getAttribute('position');
  assert.ok(pos.count > 0 && pos.count % 3 === 0, `${name}: keine Dreiecke`);
  for (const a of ['position', 'normal', 'color']) {
    const at = g.getAttribute(a);
    assert.equal(at.count, pos.count, `${name}: ${a} fehlt`);
    for (const v of at.array) assert.ok(Number.isFinite(v), `${name}: ${a} NaN`);
  }
  const nor = g.getAttribute('normal');
  for (let i = 0; i < nor.count; i++) assert.ok(Math.abs(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) - 1) < 1e-3, `${name}: Normale`);
  assert.ok(pos.count / 3 <= maxTris, `${name}: ${pos.count / 3} Dreiecke (Grenze ${maxTris})`);
}

/** Zustände einer Brücke: [Name, Brücke (Kopie mit Zustand)]. */
function variants(b) {
  const copy = (o) => Object.assign(Object.create(Object.getPrototypeOf(b)), b, o);
  return [
    ['intakt', copy({})],
    ['Schaden', copy({ hp: b.maxHp * 0.4 })],
    ['zerstört', copy({ broken: true })],
    ['Wiederaufbau', copy({ broken: true, rebuild: { team: 0, progress: 0.5 } })],
    ['Bahn', copy({ src: { ...b.src, rail: true } })],
    ['Bahn zerstört', copy({ src: { ...b.src, rail: true }, broken: true })],
  ];
}

const bounds = (g) => (g.computeBoundingBox(), g.boundingBox);

for (const seed of [3, 4, 7]) {
  test(`Brücken 3D: Seed ${seed}, alle Zustände und Jahreszeiten`, () => {
    const game = new Game({ seed, river: true });
    assert.ok(game.bridges.length > 0, 'Seed ohne Brücke');
    const rel = game.relief;
    for (const b of game.bridges) {
      for (const [vn, v] of variants(b)) {
        for (const season of SEASONS) {
          const name = `Seed ${seed} Brücke ${b.id} ${vn} ${season}`;
          const st = bridgeState(v, season, rel);
          const g = solidsToGeometry(bridgeSolids(v, season, st.o));
          valid(name, g, MAX_TRIS);
          const bb = bounds(g);
          // Umriss wie gemalt: entlang der Achse von 0 bis zur Länge, quer höchstens Querträger (Fahrbahn + 6), Trümmer ausgenommen, nach oben bis zur Laterne
          assert.ok(bb.min.x >= -0.01 && bb.max.x <= v.len + 0.01, `${name}: Länge ${bb.min.x.toFixed(1)} bis ${bb.max.x.toFixed(1)}, Brücke ${v.len}`);
          const wide = v.broken ? DECK * 0.65 + 14 : (DECK + 6) / 2; // zerstört: Trümmer streuen bis 1,3 Fahrbahnbreiten (debris in bridge.js)
          assert.ok(bb.min.y >= -wide - 0.01 && bb.max.y <= wide + 0.01, `${name}: Breite ${bb.min.y.toFixed(1)} bis ${bb.max.y.toFixed(1)}`);
          assert.ok(bb.min.z >= -5 - 0.01, `${name}: unter dem Gelände (${bb.min.z.toFixed(1)})`);
          assert.ok(bb.max.z <= st.o.lift + Math.max(LAMP_H, RAIL_H) + 1, `${name}: zu hoch (${bb.max.z.toFixed(1)}, Fahrbahn ${st.o.lift.toFixed(1)})`);
          if (vn === 'intakt') {
            assert.ok(bb.max.x - bb.min.x > v.len - 1, `${name}: Fahrbahn nicht durchgehend`);
            assert.ok(bb.max.z >= st.o.lift + RAIL_H - 0.01, `${name}: Geländer fehlt`);
          }
          // Fahrbahn: nichts über der Fahrbahnhöhe in der Mittelspur (dort stehen die Einheiten), Oberseite genau auf b.deckH
          if (vn === 'intakt' || vn === 'Schaden' || vn === 'Bahn') {
            const p = g.getAttribute('position');
            let top = -Infinity;
            for (let i = 0; i < p.count; i++) {
              const y = p.getY(i);
              if (Math.abs(y) < LANE - 12 && p.getX(i) > 12 && p.getX(i) < v.len - 12) {
                if (vn === 'Bahn' && Math.abs(Math.abs(y) - 7.2) < 1.2) continue; // Schienen
                top = Math.max(top, p.getZ(i));
              }
            }
            assert.ok(top <= st.o.lift + 0.31, `${name}: Aufbauten in der Mittelspur (${top.toFixed(2)} über Fahrbahn ${st.o.lift.toFixed(2)})`);
            assert.ok(top >= st.o.lift - 0.01, `${name}: Fahrbahn zu tief (${top.toFixed(2)} gegen ${st.o.lift.toFixed(2)})`);
          }
        }
      }
    }
  });
}

test('Brücken 3D: Fahrbahnhöhe über dem Wasser entspricht deckH, Zustandsschlüssel ändert sich mit dem Zustand', () => {
  const game = new Game({ seed: 3, river: true });
  const b = game.bridges[0];
  const rel = game.relief;
  const a = bridgeState(b, 'summer', rel);
  assert.ok(Math.abs(a.o.lift - (b.deckH - RELIEF.water)) < 1e-9);
  assert.equal(a.water, RELIEF.water);
  const keys = new Set([a.key]);
  for (const [, v] of variants(b).slice(1)) keys.add(bridgeState(v, 'summer', rel).key);
  keys.add(bridgeState(b, 'winter', rel).key);
  assert.equal(keys.size, 1 + 5 + 1, 'jeder Zustand braucht ein eigenes Netz');
  // Wiederaufbau in Stufen: mehr Gerüst bei mehr Fortschritt
  const tri = (p) => {
    const v = Object.assign(Object.create(Object.getPrototypeOf(b)), b, { broken: true, rebuild: { team: 0, progress: p } });
    return solidsToGeometry(bridgeSolids(v, 'summer', bridgeState(v, 'summer', rel).o)).getAttribute('position').count;
  };
  assert.ok(tri(0.9) > tri(0.1) && tri(0.1) > tri(0), 'Gerüst wächst mit dem Fortschritt');
});

test('Brücken 3D: Furtstange ist eine Form im gemalten Maß, Karte hat Furtstangen', () => {
  const g = solidsToGeometry(postSolids());
  valid('Furtstange', g, MAX_POST_TRIS);
  const bb = bounds(g);
  assert.ok(Math.abs(bb.min.z) < 1e-6 && Math.abs(bb.max.z - 16) < 1e-6, `Höhe ${bb.min.z} bis ${bb.max.z} (gemalt 16)`);
  assert.ok(bb.max.x - bb.min.x < 4.5 && bb.max.x - bb.min.x > 2.5, 'Breite wie gemalt (3,2 px)');
  const game = new Game({ seed: 3, river: true });
  assert.ok(fordPosts(game.map, game.relief).length > 0, 'keine Furtstangen');
});

test('Brücken 3D: Bridge3D zeigt Brücken und Furtstangen als Instanzen, ein Netz je Brücke, Furtstangen ein Netz', () => {
  const game = new Game({ seed: 3, river: true });
  const rel = game.relief;
  const br = new Bridge3D();
  br.begin([0.3, 0.4, 0.8]);
  for (const b of game.bridges) assert.ok(br.bridge(b, 'summer', rel));
  const posts = fordPosts(game.map, rel);
  for (const p of posts) assert.ok(br.ford(p));
  br.end();
  const s = br.stats();
  assert.equal(s.bridges, game.bridges.length);
  assert.equal(s.posts, posts.length);
  assert.equal(s.calls, game.bridges.length + 1);
  assert.ok(s.tris > 0 && s.tris < 60000, `Dreiecke ${s.tris}`);
  const meshes = br.group.children.filter((m) => m.visible);
  assert.equal(meshes.length, game.bridges.length + 1);
  // Instanz: Brücke steht an ihrem Anfang auf Wasserhöhe, gedreht um die Achse
  const b = game.bridges[0];
  const e = br.entries.get(b);
  const m = new THREE.Matrix4();
  e.mesh.getMatrixAt(0, m);
  const el = m.elements;
  assert.ok(Math.abs(el[12] - b.x1) < 1e-6 && Math.abs(el[13] - b.y1) < 1e-6 && Math.abs(el[14] - RELIEF.water) < 1e-6);
  assert.ok(Math.abs(el[0] - Math.cos(b.angle)) < 1e-6 && Math.abs(el[1] - Math.sin(b.angle)) < 1e-6);
  // zerstören: das Netz wird neu gebaut, die Instanz bleibt eine
  const before = e.mesh;
  b.broken = true;
  br.begin([0.3, 0.4, 0.8]);
  br.bridge(b, 'summer', rel);
  br.end();
  b.broken = false;
  assert.notEqual(e.mesh, before);
  assert.equal(br.stats().bridges, 1);
  assert.equal(br.stats().posts, 0);
  assert.equal(br.group.children.filter((c) => c.visible).length, 1, 'nicht gezeigte Brücken sind versteckt');
  br.dispose();
});

test('Brücken 3D: eindeutige Art, keine Gebäudefamilie fängt Brücken oder Furtstangen ab', () => {
  for (const kind of ['bridge3', 'ford', 'bridge']) {
    for (const f of FAMILIES) {
      let has = false;
      try {
        has = !!f.has({ kind, x: 0, y: 0 });
      } catch {
        has = false;
      }
      assert.ok(!has, `Familie „${f.name}“ nimmt kind „${kind}“`);
    }
  }
});
