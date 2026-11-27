// Fliegerhorst 3D (Paket „Fliegerhorst 3D“, js/render3d/airbase3d.js): alle Arten und Stufen als gültige, sparsame Geometrie im Umriss
// des gemalten Bilds (airbase.js), halb durchsichtig nur Dach der Überdachung und Röhre des Shelters, Teamfarbe nur von der Instanz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_MATS } from '../js/render3d/kit3d.js';
import { FAMILIES, Town3D } from '../js/render3d/town3d.js';
import { airbaseKey, airbaseGeometry, airbaseGlass, airbaseAlpha } from '../js/render3d/airbase3d.js';
import { AB_DIM, airbaseBodies } from '../js/render/airbase.js';
import { ISO_K } from '../js/render/camera.js';

const KINDS = ['stand', 'atc', 'ktank', 'mdepot'];
const MAX_TRIS = 6000; // je Variante (gemessen: höchstens etwa 2 100)

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

const tris = (g) => (g ? g.getAttribute('position').count / 3 : 0);
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
const union = (...gs) => {
  const b = gs.filter(Boolean).map(iso);
  return [Math.min(...b.map((q) => q[0])), Math.min(...b.map((q) => q[1])), Math.max(...b.map((q) => q[2])), Math.max(...b.map((q) => q[3]))];
};

test('Fliegerhorst 3D: jede Art und Stufe ist gültige, sparsame, zwischengespeicherte Geometrie', () => {
  for (const kind of KINDS) {
    for (let lv = 1; lv <= 3; lv++) {
      const name = `${kind} ${lv}`;
      const g = airbaseGeometry(kind, lv);
      const gl = airbaseGlass(kind, lv);
      check(name, g);
      if (gl) check(`${name} Glas`, gl);
      assert.equal(airbaseGeometry(kind, lv), g, `${name}: nicht zwischengespeichert`);
      assert.equal(airbaseGlass(kind, lv), gl);
      assert.ok(tris(g) + tris(gl) <= MAX_TRIS, `${name}: ${tris(g) + tris(gl)} Dreiecke`);
      assert.equal(airbaseKey(kind, lv), `${kind}|${lv}`);
      assert.ok(g.boundingBox.min.z >= -0.3, `${name}: unter dem Boden`);
      // Teamfarbe: Tower (Band, Fahne), Tanks, Munitionslager (Torschild) und Shelter (Torflügel) tragen sie, der offene und der überdachte Stellplatz nicht
      const hasTeam = kind !== 'stand' || lv === 3;
      assert.equal(teamVerts(g) > 0, hasTeam, `${name}: Teamfarbe`);
      if (gl) assert.equal(teamVerts(gl), 0, `${name}: Glas ohne Teamfarbe`);
    }
  }
  assert.equal(airbaseKey('stand', 7), 'stand|3');
});

test('Fliegerhorst 3D: halb durchsichtig nur Überdachung (Stufe 2) und Shelter (Stufe 3), Deckkraft wie gemalt', () => {
  for (const kind of KINDS) {
    for (let lv = 1; lv <= 3; lv++) assert.equal(!!airbaseGlass(kind, lv), kind === 'stand' && lv >= 2, `${kind} ${lv}: Glas`);
  }
  assert.equal(airbaseAlpha('stand', 2), AB_DIM.SEE2);
  assert.equal(airbaseAlpha('stand', 3), AB_DIM.SEE3);
  // Dach: zwei Schrägen über den Stützen, Röhre mit Tarnflecken über dem Shelter (Scheitel 32)
  const roof = airbaseGlass('stand', 2).boundingBox;
  assert.ok(roof.min.z >= AB_DIM.CAN.CE - 0.01 && roof.max.z <= AB_DIM.CAN.CR + 0.01, `Dach ${roof.min.z} … ${roof.max.z}`);
  assert.ok(roof.min.x <= -AB_DIM.CAN.RW + 0.01 && roof.max.x >= AB_DIM.CAN.RW - 0.01);
  const tube = airbaseGlass('stand', 3).boundingBox;
  assert.ok(tube.max.z >= AB_DIM.HS.H - 0.5 && tube.max.z <= AB_DIM.HS.H + 0.8, `Röhre Scheitel ${tube.max.z}`);
  assert.ok(tube.min.y >= AB_DIM.HS.N - 0.5 && tube.max.y <= AB_DIM.HS.S + 0.5, 'Röhre von Tor bis Rückwand');
});

test('Fliegerhorst 3D: Umriss wie das gemalte Bild (Ausdehnung je Teil, Bildgrenzen von airbase.js)', () => {
  const pad = 4;
  for (const kind of KINDS) {
    for (let lv = 1; lv <= 3; lv++) {
      const name = `${kind} ${lv}`;
      const [x0, y0, x1, y1] = union(airbaseGeometry(kind, lv), airbaseGlass(kind, lv));
      // gemalt: je Teil isoBounds(u0, u1, v0, v1, h) um den Anker, Schatten nach +v (11) und Rand 4; hier die Vereinigung aller Teile
      let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
      let wx0 = Infinity, wx1 = -Infinity, wy0 = Infinity, wy1 = -Infinity, H = 0;
      for (const p of airbaseBodies(kind, lv)) {
        const [u0, u1, v0, v1, h] = AB_DIM.EXT[p.id];
        const ox = (p.x - p.y) * ISO_K;
        const oy = (p.x + p.y) * ISO_K * 0.5;
        X0 = Math.min(X0, ox + (u0 - v1 - 11) * ISO_K - pad);
        Y0 = Math.min(Y0, oy + (u0 + v0) * ISO_K * 0.5 - h - pad);
        X1 = Math.max(X1, ox + (u1 - v0) * ISO_K + pad);
        Y1 = Math.max(Y1, oy + (u1 + v1 + 11) * ISO_K * 0.5 + pad);
        wx0 = Math.min(wx0, p.x + u0); wx1 = Math.max(wx1, p.x + u1);
        wy0 = Math.min(wy0, p.y + v0); wy1 = Math.max(wy1, p.y + v1);
        H = Math.max(H, h);
      }
      const tol = 3;
      assert.ok(x0 >= X0 - tol && x1 <= X1 + tol, `${name}: Breite ${x0.toFixed(1)} … ${x1.toFixed(1)} gegen ${X0.toFixed(1)} … ${X1.toFixed(1)}`);
      assert.ok(y0 >= Y0 - tol && y1 <= Y1 + tol, `${name}: Höhe ${y0.toFixed(1)} … ${y1.toFixed(1)} gegen ${Y0.toFixed(1)} … ${Y1.toFixed(1)}`);
      // nichts fehlt: die Geometrie füllt einen guten Teil der gemalten Bildfläche (Schatten und Rand sind gemalt breiter)
      assert.ok(x1 - x0 >= (X1 - X0) * 0.6, `${name}: zu schmal (${(x1 - x0).toFixed(0)} von ${(X1 - X0).toFixed(0)})`);
      const b = airbaseGeometry(kind, lv).boundingBox;
      const bg = airbaseGlass(kind, lv)?.boundingBox;
      const mx = (a) => Math.max(b.max[a], bg ? bg.max[a] : -Infinity);
      const mn = (a) => Math.min(b.min[a], bg ? bg.min[a] : Infinity);
      assert.ok(mn('x') >= wx0 - 1 && mx('x') <= wx1 + 1 && mn('y') >= wy0 - 1 && mx('y') <= wy1 + 1, `${name}: ragt aus der Ausdehnung der Teile`);
      assert.ok(mx('z') <= H + 1.5 && mx('z') >= H * 0.7, `${name}: Höhe ${mx('z').toFixed(1)} von ${H}`);
    }
  }
});

test('Fliegerhorst 3D: Shelter mit Tor nach Norden, Rückwand im Süden, Überdachung über ganzem Stellplatz', () => {
  const { HS, CAN } = AB_DIM;
  const has = airbaseGeometry('stand', 3).boundingBox;
  // Stirnwand mit Torflügeln ragt nach Norden über die Röhre, die Rückwand mit Haube nach Süden
  assert.ok(has.min.y <= HS.N - HS.D - 4 && has.max.y >= HS.S + HS.D + 3);
  assert.ok(has.min.x <= -HS.F + 0.5 && has.max.x >= HS.F - 0.5, 'Erdanschüttung bis zur Böschung');
  const can = airbaseGeometry('stand', 2).boundingBox;
  assert.ok(can.min.x <= -CAN.CX && can.max.x >= CAN.CX && can.min.y <= CAN.RN && can.max.y >= CAN.RS - 4);
});

test('Gebäudefamilie „airbase“: Körper der Anlage teilen eine Instanz, Glas als eigener halb durchsichtiger Satz ohne Schatten', () => {
  const fam = FAMILIES.find((f) => f.name === 'airbase');
  assert.ok(fam && fam.team && fam.at && fam.glass && fam.alpha);
  const plan = (k, lv, color) => ({ k, lv, x: 200, y: 300, size: 128, color });
  const bodies = (pl) => airbaseBodies(pl.k, pl.lv).map((p) => ({ kind: 'bigpart', part: p, plan: pl, color: pl.color, x: pl.x + p.x, y: pl.y + p.y }));
  const red = plan('stand', 3, '#c8423a');
  const blue = plan('stand', 3, '#3a6fb3');
  const [first] = bodies(red);
  assert.ok(fam.has(first) && !fam.has({ ...first, part: { t: 'box' } }) && !fam.has({ kind: 'town' }) && !fam.has({ ...first, plan: null }));
  assert.equal(fam.geometry(first), fam.geometry(bodies(blue)[0]), 'eine Geometrie für alle Teams');
  assert.equal(fam.key(first), 'stand|3');
  assert.equal(fam.glass(first), airbaseGlass('stand', 3));
  assert.equal(fam.alpha(first), AB_DIM.SEE3);
  // Town3D: drei Körper (Shelter, Bodenstromgerät, Feuerlöscher) = eine Instanz je Satz, zwei Sätze (undurchsichtig und Glas)
  const t = new Town3D();
  t.begin({ light: [0.3, 0.2, 0.9], snow: 0, night: 0, shade: 0.4 });
  for (const b of bodies(red)) assert.equal(t.add(b, 0), true);
  for (const b of bodies(blue)) assert.equal(t.add(b, 0), true);
  t.end();
  const s = t.stats('airbase');
  assert.equal(s.houses, 2, 'zwei Anlagen');
  assert.equal(s.calls, 2, 'ein Draw-Call undurchsichtig, einer für das Glas');
  assert.equal(s.tris, 2 * (tris(airbaseGeometry('stand', 3)) + tris(airbaseGlass('stand', 3))));
  const glass = [...t.sets.values()].find((x) => x.glass);
  assert.ok(glass && glass.n === 2 && glass.mesh.material.transparent && !glass.mesh.material.depthWrite && !glass.mesh.castShadow);
  assert.equal(glass.mesh.material.uniforms.uOpacity.value, AB_DIM.SEE3);
  const solid = [...t.sets.values()].find((x) => !x.glass && x.fam === fam);
  assert.ok(solid.n === 2 && solid.mesh.castShadow && !solid.mesh.material.transparent && solid.mesh.material.uniforms.uOpacity.value === 1);
  // Stufe 1 ohne Glas: ein Satz
  t.begin({ light: [0.3, 0.2, 0.9], snow: 0, night: 0, shade: 0.4 });
  for (const b of bodies(plan('ktank', 2, '#c8423a'))) assert.equal(t.add(b, 0), true);
  t.end();
  assert.equal(t.stats('airbase').calls, 1);
  t.dispose();
});
