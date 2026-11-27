// Baustellen und Ruinen 3D (Paket „Baustellen und Ruinen 3D“, js/render3d/site3d.js und rubble3d.js): alle Bauabschnitte und Größen der
// Baustelle sowie der Schutt (rubblePlan, 16 Varianten) als gültige, sparsame, zwischengespeicherte Geometrie im Umriss des gemalten Bilds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_MATS } from '../js/render3d/kit3d.js';
import { FAMILIES, Town3D } from '../js/render3d/town3d.js';
import { siteKey, siteGeometry } from '../js/render3d/site3d.js';
import { rubbleKey, rubbleGeometry, ruinSrc } from '../js/render3d/rubble3d.js';
import { SITE_DIM, siteWall } from '../js/render/citysite.js';
import { rubblePlan, rubbleVariant, RUBBLE_VARIANTS, drawRubble } from '../js/render/isobuild.js';
import { KIND_COLOR as CITY_COLORS } from '../js/data/citykinds.js';
import { ISO_K } from '../js/render/camera.js';

const MAX_SITE_TRIS = 6000; // je Variante (gemessen: höchstens etwa 4 300)
const MAX_RUBBLE_TRIS = 1500; // je Variante (gemessen: höchstens etwa 800)
const CKS = ['res', 'com', 'hospital', 'power', 'steel', 'mun', 'kero', 'uni'];

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

const site = (n, step, variant, ck = 'res') => ({ kind: 'site', ck, n, step, variant, zone: CITY_COLORS[ck] ?? '#8a8f86', wall: siteWall(ck, variant) });

// ---------- Baustelle ----------

test('Baustelle 3D: jeder Bauabschnitt, jede Größe, Variante und Zellenart ist gültige, sparsame, zwischengespeicherte Geometrie', () => {
  let most = 0;
  for (const n of [1, 2, 3, 4, 5]) {
    for (let step = 0; step < 5; step++) {
      for (let variant = 0; variant < 3; variant++) {
        for (const ck of CKS) {
          const b = site(n, step, variant, ck);
          const name = `${ck} n=${n} s=${step} v=${variant}`;
          const g = siteGeometry(b);
          check(name, g);
          assert.equal(siteGeometry(b), g, `${name}: nicht zwischengespeichert`);
          assert.ok(tris(g) <= MAX_SITE_TRIS, `${name}: ${tris(g)} Dreiecke`);
          assert.equal(teamVerts(g), 0, `${name}: keine Teamfarbe`);
          assert.ok(g.boundingBox.min.z >= -0.3, `${name}: unter dem Boden`);
          most = Math.max(most, tris(g));
        }
      }
    }
  }
  assert.ok(most > 3000, `größte Baustelle ${most} Dreiecke (Gerüst, Kran, Container fehlen?)`);
});

test('Baustelle 3D: Schlüssel nur aus dem, wovon das gemalte Bild abhängt (Größe, Abschnitt, Variante, Zonenfarbe, Wandfarbe)', () => {
  // Zellenart steckt nur über Zonenfarbe und Wandfarbe im Bild: gleiche Farben, gleiche Geometrie
  const a = site(2, 3, 0, 'steel');
  const b = { ...a, ck: 'mun', zone: a.zone, wall: a.wall };
  assert.equal(siteKey(a), siteKey(b));
  assert.equal(siteGeometry(a), siteGeometry(b));
  assert.notEqual(siteKey(a), siteKey({ ...a, zone: '#123456' }));
  assert.notEqual(siteKey(a), siteKey({ ...a, step: 2 }));
  assert.notEqual(siteKey(a), siteKey({ ...a, n: 3 }));
  assert.notEqual(siteKey(a), siteKey({ ...a, variant: 2 }));
  assert.equal(siteKey(a), siteKey({ ...a, variant: 3 }), 'variant zählt modulo 3 wie gemalt');
  assert.equal(siteKey({ ...a, step: 9 }), siteKey({ ...a, step: 4 }));
});

test('Baustelle 3D: Umriss innerhalb des gemalten Bildmaßes (boundsIso), Höhe wächst mit dem Bauabschnitt', () => {
  const tol = 3;
  for (const n of [1, 2, 3, 4]) {
    const [bx0, by0, bx1, by1] = SITE_DIM.boundsIso(n);
    let prev = 0;
    for (let step = 0; step < 5; step++) {
      for (let variant = 0; variant < 3; variant++) {
        const g = siteGeometry(site(n, step, variant));
        const [x0, y0, x1, y1] = iso(g);
        const name = `n=${n} s=${step} v=${variant}`;
        assert.ok(x0 >= bx0 - tol && x1 <= bx1 + tol, `${name}: Breite ${x0.toFixed(1)} … ${x1.toFixed(1)} gegen ${bx0.toFixed(1)} … ${bx1.toFixed(1)}`);
        // gemalt schneidet das Bild Zaun und Kran oben ab (Bildmaß), 3D zeigt sie ganz: oben nur ein Rand, unten genau
        assert.ok(y1 <= by1 + tol, `${name}: unten ${y1.toFixed(1)} gegen ${by1.toFixed(1)}`);
        assert.ok(y0 >= by0 - 12, `${name}: oben ${y0.toFixed(1)} gegen ${by0.toFixed(1)}`);
        // die Geometrie füllt einen guten Teil der Breite des gemalten Bilds
        assert.ok(x1 - x0 >= (bx1 - bx0) * 0.55, `${name}: zu schmal ${(x1 - x0).toFixed(0)} von ${(bx1 - bx0).toFixed(0)}`);
      }
      const h = siteGeometry(site(n, step, 0)).boundingBox.max.z;
      if (step >= 2 && n === 1) assert.ok(h >= prev - 0.01, `n=${n}: Höhe nimmt nicht ab (${prev} → ${h})`);
      if (n === 1) prev = h;
    }
  }
});

test('Baustelle 3D: Bauabschnitte sind verschieden, Kran nur bei Großbauten, Gerüst und Planen an allen vier Wänden', () => {
  for (const n of [1, 2, 3]) {
    const keys = new Set();
    for (let step = 0; step < 5; step++) keys.add(siteGeometry(site(n, step, 0)));
    assert.equal(keys.size, 5, `n=${n}: fünf verschiedene Geometrien`);
  }
  // Kran: Großbauten ab Abschnitt 1, die Höhe des Krans (crane) ragt über den Rohbau
  const d2 = SITE_DIM.dims(2);
  assert.ok(siteGeometry(site(2, 1, 0)).boundingBox.max.z >= d2.crane, 'Kran bei n=2');
  assert.ok(siteGeometry(site(1, 4, 0)).boundingBox.max.z < 40, 'kein Kran bei n=1');
  // Rückseiten: Gerüst und Zaun rundum, also in jedem Quadranten Geometrie (nicht nur vorn bei +u/+v)
  for (const [n, step] of [[1, 3], [2, 3], [3, 2]]) {
    const g = siteGeometry(site(n, step, 0));
    const pos = g.getAttribute('position');
    const q = [0, 0, 0, 0];
    for (let i = 0; i < pos.count; i++) q[(pos.getX(i) > 0 ? 1 : 0) + (pos.getY(i) > 0 ? 2 : 0)]++;
    for (let i = 0; i < 4; i++) assert.ok(q[i] > pos.count * 0.1, `n=${n} s=${step}: Quadrant ${i} fast leer`);
  }
  // Planen in der Zonenfarbe: die Zonenfarbe kommt in der Geometrie vor (Zaun bzw. Gerüst)
  const zone = '#12ab34';
  const g = siteGeometry({ ...site(2, 3, 0), zone });
  const col = g.getAttribute('color');
  const z = [0x12, 0xab, 0x34].map((x) => x / 255);
  let hit = 0;
  for (let i = 0; i < col.count; i++) if ([0, 1, 2].every((k) => Math.abs(col.array[i * 3 + k] - z[k]) < 0.01)) hit++;
  assert.ok(hit >= 24, `Zonenfarbe ${hit} Ecken`);
});

// ---------- Schutt ----------

const KINDS = [['house', 64, 64], ['hall', 64, 64], ['factory', 96, 96], ['station', 64, 64], ['wreck', 64, 64], ['wreck', 96, 96], ['wall', 32, 32]];
/** Ein Ort (x, y) je Variante 0 … 15. */
function spots() {
  const out = new Map();
  for (let x = 0; out.size < RUBBLE_VARIANTS && x < 4000; x++) {
    const v = rubbleVariant({ x, y: 311 });
    if (!out.has(v)) out.set(v, { x, y: 311 });
  }
  return out;
}

test('rubblePlan: rein, deterministisch, nur 16 Varianten, Plan hängt nur an Art, Maß und Variante', () => {
  const sp = spots();
  assert.equal(sp.size, 16, 'alle 16 Varianten kommen vor');
  assert.equal(RUBBLE_VARIANTS, 16);
  for (let x = 0; x < 3000; x += 7) assert.ok([...Array(16).keys()].includes(rubbleVariant({ x, y: x * 3 + 1 })));
  const seen = new Set();
  for (const [kind, w, h] of KINDS) {
    for (const burnt of [false, true]) {
      for (const [v, at] of sp) {
        const b = { ...at, w, h, kind, hgt: 36 };
        const p = rubblePlan(b, burnt);
        assert.equal(p.v, v);
        assert.deepEqual(rubblePlan(b, burnt), p, `${kind} ${burnt} v=${v}: nicht deterministisch`);
        assert.deepEqual(rubblePlan({ x: 0, y: 0, w, h, kind, hgt: 36 }, burnt, v), p, `${kind}: hängt an x, y statt an der Variante`);
        for (const [x, y] of p.rim) assert.ok(Math.abs(x) <= w / 2 + 1e-6 && Math.abs(y) <= h / 2 + 1e-6, 'Rand innerhalb des Maßes');
        for (const q of p.pieces) {
          const nums = q.t === 'box' ? [q.x0, q.y0, q.x1, q.y1, q.h] : q.t === 'mound' ? [q.x, q.y, q.r, q.h, q.seed] : [q.x, q.y, q.len, q.wid, q.a, q.h];
          for (const x of nums) assert.ok(Number.isFinite(x), `${kind}: Zahl ${x}`);
        }
        if (kind === 'wreck' && w === 96 && !burnt) seen.add(JSON.stringify(p.pieces));
      }
    }
  }
  assert.ok(seen.size >= 12, `16 Varianten sehen verschieden aus (${seen.size})`);
  // ausgebrannt: verrußte Wandfarbe und Stahlträger, nicht bei der Mauer
  const burnt = rubblePlan({ x: 0, y: 0, w: 96, h: 96, kind: 'wreck', hgt: 36 }, true, 3);
  assert.ok(burnt.pieces.some((p) => p.post) && burnt.wall === '#69635a');
  assert.ok(!rubblePlan({ x: 0, y: 0, w: 32, h: 32, kind: 'wall', hgt: 18 }, false, 3).pieces.some((p) => p.t === 'box'), 'Mauer ohne Mauerecke');
});

test('drawRubble malt aus dem Plan: ein Bild je Variante, Zahl der Teile wie im Plan', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => calls.push([k, ...a])), set: (t, k, v) => ((t[k] = v), true) });
  const cam = { rot: 0, zoom: 1, depth: (x, y) => x + y, worldToScreen: (x, y) => ({ x: (x - y) * 0.7, y: (x + y) * 0.35 }) };
  const b = { x: 500, y: 700, w: 96, h: 96, kind: 'wreck', hgt: 36 };
  drawRubble(ctx, cam, b, true);
  const n1 = calls.length;
  assert.ok(n1 > 50, 'es wurde gemalt');
  calls.length = 0;
  drawRubble(ctx, cam, { ...b }, true);
  assert.equal(calls.length, n1, 'gleiche Eingabe, gleiches Bild');
});

test('Schutt 3D: Haus, Halle, Fabrik, Bahnhof, Wrack und Mauer, mit und ohne Ruß, alle 16 Varianten gültig, sparsam, innerhalb des Maßes', () => {
  const sp = spots();
  for (const [kind, w, h] of KINDS) {
    for (const burnt of [false, true]) {
      for (const [v, at] of sp) {
        const b = { ...at, w, h, kind, hgt: kind === 'wall' ? 18 : 36 };
        const name = `${kind} ${w}×${h} ${burnt ? 'verrußt' : 'hell'} v=${v}`;
        const g = rubbleGeometry(b, burnt);
        check(name, g);
        assert.equal(rubbleGeometry(b, burnt), g, `${name}: nicht zwischengespeichert`);
        assert.ok(tris(g) <= MAX_RUBBLE_TRIS, `${name}: ${tris(g)} Dreiecke`);
        assert.equal(teamVerts(g), 0);
        const bb = g.boundingBox;
        assert.ok(bb.min.z >= -0.01 && bb.max.z <= b.hgt, `${name}: Höhe ${bb.min.z} … ${bb.max.z}`);
        assert.ok(bb.min.x >= -w / 2 - 10 && bb.max.x <= w / 2 + 10 && bb.min.y >= -h / 2 - 10 && bb.max.y <= h / 2 + 10, `${name}: ragt aus dem Maß`); // Platten und Balken (bis 30 lang, Mitte ab 6 vom Rand) ragen wie gemalt etwas über den Rand);
        // der Schuttboden liegt flach knapp über dem Gelände
        assert.ok(bb.min.z >= 0 && bb.min.z < 0.5, `${name}: Boden`);
        assert.equal(rubbleKey(b, burnt), rubbleKey({ ...b }, burnt));
      }
    }
  }
  const at = [...sp.values()][0];
  const b = { ...at, w: 64, h: 64, kind: 'house', hgt: 34 };
  assert.notEqual(rubbleKey(b, true), rubbleKey(b, false));
  assert.notEqual(rubbleGeometry(b, true), rubbleGeometry(b, false));
  assert.notEqual(rubbleKey(b), rubbleKey({ ...b, kind: 'hall' }));
});

test('Schutt 3D: Zwischenspeicher mit Obergrenze, älteste Geometrie fliegt raus und wird neu gebaut', () => {
  const b0 = { x: 12345, y: 6789, w: 40, h: 40, kind: 'wall', hgt: 18 };
  const first = rubbleGeometry(b0, false);
  for (let w = 41; w < 41 + 300; w++) rubbleGeometry({ x: 1, y: 2, w, h: 40, kind: 'wall', hgt: 18 }, false);
  const again = rubbleGeometry(b0, false);
  assert.notEqual(again, first, 'nach der Obergrenze neu gebaut');
  check('neu gebaut', again);
  assert.equal(rubbleGeometry(b0, false), again);
});

// ---------- Familien ----------

test('Gebäudefamilien „site“ und „ruin“: Baustelle, zerstörte Stadtzelle, Schutt der Kartenstadt und Wrack teilen sich Town3D', () => {
  const fs = FAMILIES.find((f) => f.name === 'site');
  const fr = FAMILIES.find((f) => f.name === 'ruin');
  assert.ok(fs && fr && !fs.team && !fr.team);
  const a = { ...site(2, 3, 1), x: 100, y: 200 };
  assert.ok(fs.has(a) && !fs.has({ kind: 'town' }) && !fr.has(a));
  assert.equal(fs.geometry(a), siteGeometry(a));
  assert.equal(fs.key(a), siteKey(a));
  const city = { kind: 'cityruin', x: 300, y: 300, w: 56, h: 56, as: 'house', hgt: 34, wall: '#d8cfbd', n: 1 };
  const wreck = { kind: 'ruin3d', x: 400, y: 410, w: 96, h: 96, as: 'wreck', burnt: true, hgt: 36, sink: 0.4 };
  assert.ok(fr.has(city) && fr.has(wreck) && !fr.has({ kind: 'town' }) && !fs.has(wreck));
  assert.equal(fr.geometry(city), rubbleGeometry(ruinSrc(city), false));
  assert.equal(fr.geometry(wreck), rubbleGeometry(ruinSrc(wreck), true));
  assert.equal(fr.key(wreck), rubbleKey(ruinSrc(wreck), true));
  assert.equal(fr.scaleZ(wreck), 0.4);
  assert.equal(fr.scaleZ(city), 1, 'ohne sink: volle Höhe');
  // Town3D: gleiche Baustellen teilen einen Satz, Schutt sinkt über die Streckung der Höhe
  const t = new Town3D();
  t.begin({ light: [0.3, 0.2, 0.9], snow: 0, night: 0, shade: 0.4 });
  for (let i = 0; i < 5; i++) assert.equal(t.add({ ...a, x: 100 + i * 60 }, 0), true);
  assert.equal(t.add({ ...a, step: 0, x: 700 }, 3), true);
  assert.equal(t.add(city, 0), true);
  assert.equal(t.add(wreck, 2), true);
  t.end();
  assert.equal(t.stats('site').houses, 6);
  assert.equal(t.stats('site').calls, 2, 'zwei Varianten, zwei Draw-Calls');
  assert.equal(t.stats('ruin').houses, 2);
  const ws = [...t.sets.entries()].find(([id]) => id.startsWith('ruin|wreck'))[1];
  const m = ws.mesh.instanceMatrix.array;
  assert.ok(Math.abs(m[10] - 0.4) < 1e-6, 'Streckung der Höhe in der Instanz');
  assert.equal(m[14], 2);
  assert.equal(m[0], 1);
  const cs = [...t.sets.entries()].find(([id]) => id.startsWith('ruin|house'))[1];
  assert.equal(cs.mesh.instanceMatrix.array[10], 1);
  t.dispose();
});
