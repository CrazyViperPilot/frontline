// Browser-Prüfung der Alarmrotte (Paket „Alarmrotte“, js/game/scramble.js) nach dem Muster von tools/smoke.mjs: öffnet eine Partie mit
// ?debug=1, legt neben der Hauptstadt einen Fliegerhorst an (Bahn, zwei Stellplätze, Tower, Kerosintank, Munitionslager, Straße zum
// Lager), stellt eine startbereite F-16 ab und lässt einen feindlichen Transporthubschrauber neben dem Tower auftauchen. Dann muss die
// F-16 ohne Befehl losrollen; zwei Fotos: Jet rollt (scramble-rollt.png), Jet in der Luft (scramble-luft.png). Exit-Code 1 bei
// Browserfehlern oder wenn der Alarmstart ausbleibt.
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-scramble.mjs                → Fotos in .smoke/scramble/
//                                  node tools/smoke-scramble.mjs --seed 7 --out /tmp/x --scale 2
import { openGame } from './smoke.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const seed = Number(arg('seed', 3));
const out = arg('out', '.smoke/scramble');
const scale = Number(arg('scale', 1));

const g = await openGame({ seed, out, scale, query: 'weather=summer&wx=clear' });
let failed = false;
try {
  // Fliegerhorst und F-16 im Browser anlegen (wie test/scramble.test.js), Simulation dafür im Schnelllauf
  const setup = await g.run(async () => {
    const s = window.__frontline.session();
    const game = s.game;
    const { canZone, roadAt } = await import('/js/game/city/cells.js');
    const { connectRoad } = await import('/js/game/city/roadnet.js');
    const { CITY } = await import('/js/data/city.js');
    const { KINDS } = await import('/js/data/citykinds.js');
    const c = game.city[0];
    const m = game.mainFob(0);
    game.teams[0].res.money = 1e6;
    Object.assign(m.store, { bm: 30000, mun: 30000, fuel: 30000 });
    c.metal = 3000;
    c.kero = 3000;
    const W = 12;
    const H = 6;
    let best = null;
    const mc = Math.floor(m.x / c.cell);
    const mr = Math.floor(m.y / c.cell);
    for (let r = 1; r < c.rows - H - 1; r++) {
      for (let q = 1; q < c.cols - W - 1; q++) {
        const d = Math.abs(q - mc) + Math.abs(r - mr);
        if (best && d >= best.d) continue;
        let ok = true;
        for (let y = r - 1; ok && y <= r + H; y++) for (let x = q - 1; ok && x <= q + W; x++) ok = canZone(game, c, y * c.cols + x) && !c.kind[y * c.cols + x] && !roadAt(c, y * c.cols + x);
        if (ok) best = { q, r, d };
      }
    }
    if (!best) return { error: 'kein Platz für den Fliegerhorst' };
    const { q, r } = best;
    const rules = game.buildRules;
    game.buildRules = false; // Baugebiet (Startmenü) nur für den Aufbau aus: Tank und Lager brauchen sonst erst die Straße
    let why = '';
    const put = (kind, dq, dr, w = 0, h = 0) => {
      const res = game.issue(0, { type: 'city', kind, c0: q + dq, r0: r + dr, c1: q + dq + w, r1: r + dr + h });
      if (!res.ok) why = `${kind}: ${res.reason}`;
      return res.ok;
    };
    if (!(put('runway', 0, 0, 9, 1) && put('stand', 0, 2) && put('stand', 2, 2) && put('atc', 4, 2) && put('ktank', 6, 2) && put('mdepot', 8, 2))) return { error: `Baustein abgelehnt (${why})` };
    const cm = CITY.transport.connectMax;
    CITY.transport.connectMax = 400;
    connectRoad(game, c, r * c.cols + q + 9, false);
    connectRoad(game, c, (r + 2) * c.cols + q + 6, false);
    connectRoad(game, c, (r + 2) * c.cols + q + 8, false);
    CITY.transport.connectMax = cm;
    game.buildRules = rules;
    for (let k = 0; k < (CITY.growTime + 1) / 0.05; k++) game.update(0.05);
    const ents = [...c.ents.entries()].filter(([, e]) => e.alive);
    const of = (k) => ents.filter(([i]) => KINDS[c.kind[i] - 1] === k).map(([, e]) => e);
    const [stand] = of('stand');
    const [atc] = of('atc');
    if (!stand || !atc) return { error: 'Fliegerhorst nicht gewachsen' };
    for (const e of [...of('ktank'), ...of('mdepot')]) e.stock = 1000;
    if (!game.issue(0, { type: 'train', buildingId: stand.id, unit: 'f16' }).ok) return { error: 'F-16 abgelehnt' };
    let jet = null;
    for (let k = 0; k < 120 / 0.05 && !(jet?.parked && jet.jet?.ready); k++) {
      game.update(0.05);
      jet = game.units.find((u) => u.alive && u.team === 0 && u.type === 'f16');
    }
    if (!jet?.jet?.ready) return { error: 'F-16 nicht startbereit' };
    const h = game.spawnUnit('transporter', 1, atc.x + 250, atc.y - 250);
    h.order = { type: 'idle', x: h.x, y: h.y, targetId: null };
    s.camera.centerOn(jet.x, jet.y);
    window.__qra = { jet: jet.id, heli: h.id };
    return { jet: jet.id, x: Math.round(jet.x), y: Math.round(jet.y) };
  });
  if (setup.error) throw new Error(setup.error);
  console.log(`Fliegerhorst und F-16 bereit (Jet ${setup.jet} bei ${setup.x}, ${setup.y})`);
  /** Im Browser warten, bis die F-16 die Phase erreicht (Kamera folgt ihr); liefert die Phase oder null nach ms. */
  const waitPhase = (phases, ms) =>
    g.run(
      ([phases, ms]) =>
        new Promise((done) => {
          const t0 = performance.now();
          const tick = () => {
            const s = window.__frontline.session();
            const u = s.game.getEntity(window.__qra.jet);
            if (u) s.camera.centerOn(u.x, u.y);
            if (u && phases.includes(u.jet?.phase) && !u.parked) return done(u.jet.phase);
            if (performance.now() - t0 > ms) return done(null);
            requestAnimationFrame(tick);
          };
          tick();
        }),
      [phases, ms],
    );
  const rolling = await waitPhase(['taxiOut', 'roll'], 30000);
  if (!rolling) throw new Error('kein Alarmstart: die F-16 rollt nicht los');
  await g.shot('scramble-rollt');
  const air = await waitPhase(['air'], 60000);
  if (!air) throw new Error('die F-16 hebt nicht ab');
  await g.page.waitForTimeout(1200);
  await g.shot('scramble-luft');
  const msg = await g.run(() => window.__frontline.session().game.teams[0].qraMark);
  console.log(`Alarmstart ausgelöst (Markierung bei ${Math.round(msg?.x)}, ${Math.round(msg?.y)}); Fotos in ${out}/`);
} catch (e) {
  failed = true;
  console.log(`FEHLER: ${e.message}`);
}
if (g.errors.length) {
  failed = true;
  console.log(g.errors.join('\n'));
}
await g.close();
process.exit(failed ? 1 : 0);
