// Messwerkzeug Wirtschaft (Paket „Messwerkzeug Wirtschaft“): KI gegen KI mit Fluss und Forschung, je Seed ein Worker; alle 5 Spielminuten
// je Team eine Zeile mit Kennzahlen der Stadt-Wirtschaft (Geld, Einfuhr, Werke, Bahnhöfe, Straßenlast, Lager, Ausbildung, Abschüsse,
// Einwohner). Ersetzt die Messskripte, die für KI- und Wirtschaftspakete immer wieder im Scratchpad entstanden. Kurze Ausgabe.
//
// Aufruf (im Repo-Wurzelordner):
//   npm run econ -- [--seeds 3,7,11] [--min 25] [--conquest] [--players 4] [--diff normal] [--build 0|1] [--json datei.json]
//                   [--set CITY.transport.cap=18] [--set …]
//   npm run econ -- compare alt.json neu.json     Mittel je Minute zweier Läufe (angekommen, Anteil, Werke, abgeschnitten, Ausb, Absch)
// --set ändert einen Wert in einem Datenobjekt aus js/data (CITY, BALANCE, UNITS, BUILDINGS, RESEARCH, MAPGEN) vor dem Lauf,
// zum Durchmessen von Werten ohne Codeänderung; Wert als JSON (Zahl, true, [1,2]), sonst Text. QUICK wirkt nicht (BALANCE liest es beim Laden).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';

const DT = 0.05;
const PERIOD = 300; // Messperiode in Spielsekunden (5 min)
export const DEFAULTS = { seeds: [3, 7, 11], min: 25, conquest: false, players: 4, diff: 'normal', build: true, json: null, set: [] };

/** Kommandozeile → Optionen (siehe Kopf). */
export function parseArgs(argv) {
  const o = { ...DEFAULTS, set: [] };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    const next = () => argv[++k];
    if (a === '--seeds') o.seeds = next().split(',').map(Number);
    else if (a === '--min') o.min = Number(next());
    else if (a === '--conquest') o.conquest = true;
    else if (a === '--players') o.players = Number(next());
    else if (a === '--diff') o.diff = next();
    else if (a === '--build') o.build = next() !== '0';
    else if (a === '--json') o.json = next();
    else if (a === '--set') o.set.push(next());
    else throw new Error(`Unbekannte Option ${a}`);
  }
  return o;
}

/** --set-Einträge anwenden: „OBJEKT.pfad.zum.wert=Wert“ auf die Datenobjekte aus js/data. */
export async function applySets(sets) {
  if (!sets?.length) return;
  const mods = await Promise.all(['balance', 'city', 'units', 'buildings', 'research', 'mapgen'].map((f) => import(`../js/data/${f}.js`)));
  const roots = Object.assign({}, ...mods);
  for (const s of sets) {
    const eq = s.indexOf('=');
    if (eq < 0) throw new Error(`--set ohne „=“: ${s}`);
    const path = s.slice(0, eq).split('.');
    const raw = s.slice(eq + 1);
    let val;
    try {
      val = JSON.parse(raw);
    } catch {
      val = raw;
    }
    let obj = roots[path[0]];
    if (!obj || typeof obj !== 'object' || path.length < 2) throw new Error(`--set: unbekanntes Datenobjekt ${path[0]}`);
    for (const p of path.slice(1, -1)) {
      obj = obj[p];
      if (!obj || typeof obj !== 'object') throw new Error(`--set: Pfad ${s.slice(0, eq)} gibt es nicht`);
    }
    const last = path[path.length - 1];
    if (!(last in obj)) throw new Error(`--set: Schlüssel ${s.slice(0, eq)} gibt es nicht`);
    obj[last] = val;
  }
}

const sum = (o) => Object.values(o ?? {}).reduce((a, v) => a + (v || 0), 0);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Ein Lauf (im Worker oder direkt, z. B. im Test). Liefert { seed, opts, periods: [{ min, teams: [Kennzahlen je Team] }] }.
 * Mittelwerte (Einfuhrkosten, importScale, Anteil, angekommen) über alle Schritte der Periode, Zustände am Periodenende,
 * Straßenlast als Höchstwert der Periode (gemessen alle 5 s).
 */
export async function runSeed(seed, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  await applySets(o.set);
  const { Game } = await import('../js/game/game.js');
  const { AI } = await import('../js/ai/ai.js');
  const { transportOf } = await import('../js/game/transport.js');
  const { isPart, atEdge } = await import('../js/game/city/cells.js');
  const { KINDS, KIND_ID, WORKS } = await import('../js/data/citykinds.js');
  const { STORED_GOODS, GOODS } = await import('../js/data/goods.js');
  const g = new Game({ seed, river: true, research: true, buildRules: o.build, conquest: o.conquest, players: o.players });
  const T = g.teams.length;
  const ais = g.teams.map((_, t) => new AI(g, t, o.diff));
  const steps = Math.round((o.min * 60) / DT);
  const per = Math.round(PERIOD / DT);
  const fresh = () => g.teams.map(() => ({ n: 0, cost: 0, scale: 0, share: 0, shareN: 0, arrived: 0, loadMax: 0, over: 0 }));
  let acc = fresh();
  const periods = [];
  const ROAD = KIND_ID.road;
  const ST = KIND_ID.station;
  const WORK_IDS = new Set(WORKS.map((k) => KIND_ID[k]));

  const roadLoad = (a, c) => {
    const tr = transportOf(g, c);
    let best = 0;
    let over = 0;
    for (let k = 0; k < tr.list.length; k++) {
      const i = tr.list[k];
      const q = tr.cap[i] > 0 ? tr.load[i] / tr.cap[i] : 0;
      if (q > best) best = q;
      if (q > 1) over++;
    }
    a.loadMax = Math.max(a.loadMax, best);
    a.over = Math.max(a.over, over);
  };

  const snapshot = (t, a) => {
    const team = g.teams[t];
    const c = g.city?.[t];
    const main = g.mainFob(t);
    const v = {
      alive: !!main || (c?.list.length ?? 0) > 0,
      money: Math.round(team.res.money),
      importCost: r2(a.n ? a.cost / a.n : 0),
      importScale: r2(a.n ? a.scale / a.n : 0),
      share: r2(a.shareN ? a.share / a.shareN : 0),
      arrived: r2(a.n ? a.arrived / a.n : 0),
      works: Object.fromEntries(WORKS.map((k) => [k, 0])),
      cutOff: 0,
      edgePoints: 0,
      stations: 0,
      stationsLinked: 0,
      atStation: 0,
      roadLoad: r2(a.loadMax),
      roadOver: a.over,
      stock: {},
      trained: team.stats.trained,
      kills: team.stats.kills,
      pop: Math.floor(c?.popF ?? 0),
    };
    for (const gd of STORED_GOODS) v.stock[gd] = Math.round(GOODS[gd].store === 'city' ? (c?.[gd] ?? 0) : (main?.store?.[gd] ?? 0));
    if (!c) return v;
    const tr = transportOf(g, c);
    v.stationsLinked = tr.stations.length;
    for (const i of c.list) {
      const kid = c.kind[i];
      if (kid === ROAD && atEdge(c, i)) v.edgePoints++;
      if (isPart(c, i) || !c.level[i]) continue;
      if (kid === ST) v.stations++;
      if (!WORK_IDS.has(kid)) continue;
      v.works[KINDS[kid - 1]]++;
      const im = tr.imports.get(i);
      if (tr.routes.get(i)?.to !== 'main' || !im) v.cutOff++;
      if (im && im.dist === 0 && typeof im.from === 'number') v.atStation++;
    }
    return v;
  };

  for (let k = 1; k <= steps; k++) {
    g.update(DT);
    for (const ai of ais) ai.update(DT);
    for (let t = 0; t < T; t++) {
      const s = g.city?.[t]?.stats;
      if (!s) continue;
      const a = acc[t];
      a.n++;
      a.cost += s.importCost ?? 0;
      a.scale += s.importScale ?? 0;
      a.arrived += sum(s.raw);
      const cap = sum(s.cap);
      if (cap > 0) {
        a.share += sum(s.inp) / cap;
        a.shareN++;
      }
      if (k % 100 === 0) roadLoad(a, g.city[t]);
    }
    if (k % per === 0 || k === steps) {
      periods.push({ min: r1((k * DT) / 60), teams: g.teams.map((_, t) => snapshot(t, acc[t])) });
      acc = fresh();
    }
  }
  return { seed, opts: { min: o.min, conquest: o.conquest, players: T, diff: o.diff, build: o.build, set: o.set }, periods };
}

const TEAM = ['Blau', 'Rot', 'Grün', 'Gelb'];
const worksText = (w) => Object.entries(w).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' ') || '–';
const stockText = (s) => Object.entries(s).map(([k, n]) => `${k} ${n}`).join(' ');

/** Kurze Textzeilen eines Laufs. */
export function format(run) {
  const out = [`Seed ${run.seed}:`];
  for (const p of run.periods) {
    out.push(` ${p.min} min`);
    p.teams.forEach((v, t) => {
      out.push(
        `  ${TEAM[t]}: Geld ${v.money} · Einfuhr ${v.importCost}/s ×${v.importScale} · Anteil ${v.share} · an ${v.arrived}/s · Werke ${worksText(v.works)}` +
          ` · abgeschn ${v.cutOff} · Rand ${v.edgePoints} · Bhf ${v.stationsLinked}/${v.stations} · amBhf ${v.atStation}` +
          ` · Straße ${v.roadLoad} (${v.roadOver} über) · Lager ${stockText(v.stock)} · Ausb ${v.trained} · Absch ${v.kills} · Einw ${v.pop}`,
      );
    });
  }
  return out;
}

/** Mittel je Minute eines Laufpakets (Liste von runSeed-Ergebnissen): über Seeds und Teams. */
export function summary(runs) {
  const rows = new Map();
  for (const run of runs) {
    for (const p of run.periods) {
      const r = rows.get(p.min) ?? { n: 0, arrived: 0, share: 0, works: 0, cutOff: 0, trained: 0, kills: 0 };
      for (const v of p.teams) {
        r.n++;
        r.arrived += v.arrived;
        r.share += v.share;
        r.works += sum(v.works);
        r.cutOff += v.cutOff;
        r.trained += v.trained;
        r.kills += v.kills;
      }
      rows.set(p.min, r);
    }
  }
  return [...rows].sort((a, b) => a[0] - b[0]).map(([min, r]) => ({
    min,
    arrived: r2(r.arrived / r.n),
    share: r2(r.share / r.n),
    works: r1(r.works / r.n),
    cutOff: r1(r.cutOff / r.n),
    trained: r1(r.trained / r.n),
    kills: r1(r.kills / r.n),
  }));
}

const COLS = { arrived: 'an/s', share: 'Anteil', works: 'Werke', cutOff: 'abgeschn', trained: 'Ausb', kills: 'Absch' };

/** Vergleich zweier JSON-Dateien von --json: je Minute „alt → neu“. */
export function compareRuns(a, b) {
  const sa = summary(a.runs);
  const sb = new Map(summary(b.runs).map((r) => [r.min, r]));
  const out = [`Mittel je Team und Seed (alt → neu); alt: ${a.label}; neu: ${b.label}`];
  for (const ra of sa) {
    const rb = sb.get(ra.min);
    if (!rb) continue;
    out.push(` ${ra.min} min: ` + Object.keys(COLS).map((k) => `${COLS[k]} ${ra[k]} → ${rb[k]}`).join(' · '));
  }
  return out;
}

const label = (o) => `Seeds ${o.seeds.join(',')}, ${o.min} min, ${o.conquest ? `Eroberung ${o.players}` : 'klassisch'}, ${o.diff}, Baugebiet ${o.build ? 'an' : 'aus'}${o.set.length ? ', ' + o.set.join(' ') : ''}`;

if (!isMainThread) {
  runSeed(workerData.seed, workerData.opts).then((v) => parentPort.postMessage(v));
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv[0] === 'compare') {
    const [fa, fb] = argv.slice(1);
    if (!fa || !fb) throw new Error('Aufruf: npm run econ -- compare alt.json neu.json');
    const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
    for (const l of compareRuns(load(fa), load(fb))) console.log(l);
    process.exit(0);
  }
  const o = parseArgs(argv);
  const t0 = Date.now();
  const n = Math.max(1, Math.min(o.seeds.length, cpus().length));
  const results = new Map();
  const queue = [...o.seeds];
  const { json, ...opts } = o;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) {
        const seed = queue.shift();
        results.set(
          seed,
          await new Promise((resolve, reject) => {
            const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seed, opts } });
            w.once('message', resolve);
            w.once('error', reject);
          }),
        );
      }
    }),
  );
  const runs = o.seeds.map((s) => results.get(s));
  console.log(`Wirtschaft: ${label(o)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const run of runs) for (const l of format(run)) console.log(l);
  if (json) {
    writeFileSync(json, JSON.stringify({ label: label(o), runs }) + '\n');
    console.log(`JSON: ${json}`);
  }
}
