// Browser-Prüfung der 3D-Ansicht (Plan docs/plan-3d.md), drei Teile; Fotos nach .smoke/3d/, Exit-Code 1 bei Fehlern:
// 1. Kamera (Paket „3D-Gerüst“): ?three=1&cubes=1&iso=1 zeigt Prüfwürfel (render3d/testscene.js) auf dem 3D-Gelände; ihre Bildlage
//    aus three (Vector3.project) muss in allen 4 Drehungen und bei Zoom 0,35, 1 und 1,6 unter 1 px von camera.worldToScreen liegen.
// 2. Iso gegen 3D (Pakete „3D-Boden“, „Billboard-Brücke“): je Seed (3, 7), Jahreszeit (Sommer, Winter), Drehung und Zoom dasselbe Bild
//    einmal klassisch (Iso) und einmal mit three (3D), Fotos …-iso.png / …-3d.png und Anteil abweichender Pixel (Kanal > 40).
//    Fehler, wenn mehr als MAX_DIFF % der Pixel abweichen.
// 3. Speicher (Billboard-Brücke): --minutes lang (Standard 1) zoomen und schieben in 3D; Atlasseiten, Leerungen, Sprite-Pixel und
//    JS-Speicher am Anfang und Ende. Fehler, wenn mehr als 4 Atlasseiten entstehen.
// 4. Messung (Paket „Licht und Schatten“): Seed 3, Spiel angehalten, 200 Einheiten um die Hauptstadt; Zeit je Iso-Durchlauf (ms, Mittel
//    über --frames Bilder) für Iso und 3D mit jeder Schattenstufe. Software-WebGL im Container: nur zum Vergleich, nicht absolut.
// 5. Schatten (Paket „Licht und Schatten“): Fotos je Stufe (Aus, Mittel, Hoch) und Drehung neben Iso, Panzer am Hang, Nacht;
//    Prüfungen: Schattenkarte beim Verschieben gleich groß und auf dem Texel-Raster, Stufenwechsel ohne Neustart (keine Fehler),
//    im Bild mit Schattenkarte keine gemalten Einheitenschatten, unter dem Panzer am Hang dunkler als daneben.
// 6. Bäume (Paket „3D-Bäume“): Seed 7, Wald; je Jahreszeit Fotos nah (Zoom 1,6) und fern (0,5), Iso und 3D, dazu 4 Drehungen;
//    Fehler, wenn bei mindestens 400 Bäumen im Bild eine Art mehr als TREE_SHAPES Draw-Calls braucht (Werfer der Schattenkarte
//    nicht mitgezählt); Zeit des Durchlaufs „Objekte“ mit gemalten und mit 3D-Bäumen, Schatten Aus und Hoch.
// 7. MVP (Paket „MVP-Messung“, nur mit --only mvp, einige Minuten je Gerät): Rundgang je Gerät (desktop, tablet, phone) mit Seed 7:
//    Start, Ansicht über V bzw. Knopf (3D → 2D → Iso → 3D), 4 Drehungen, Zoom 0,35/1/1,6, Wald, Panzer am Hang, Winter; jedes Bild
//    alt (Iso) und neu (3D) nebeneinander als ein Foto nach <out>/mvp/<gerät>-<name>.png. Auswahl einer Einheit per Klick bzw.
//    Tippen auf ihr Bild in 3D, Befehl per Rechtsklick bzw. Tippen auf den Boden: Fehler, wenn nicht gewählt oder sie nicht fährt.
//    Danach Zeitraffer (beide Seiten KI, 10×) bis --gametime Spielminuten (Standard 5), dann Bildrate (measureFps, --fpsms ms)
//    und langsamstes Bild in Iso und 3D mit Schatten Aus/Mittel/Hoch an Basis und Wald, im Winter am Start; Zeit je Durchlauf
//    (timePasses) für Iso und 3D Mittel. Ergebnis zusätzlich als JSON nach <out>/mvp/messung.json. --devices desktop,phone wählt Geräte.
// 8. Baukasten (Pakete „Baukasten 3D“, „Stadthäuser 3D“, „Werke 3D“): alle Stadthäuser aus town3d.js und alle Werke aus works3d.js
//    neben den gemalten; je Art und Stimmung (Sommer/Winter × Tag/Nacht) ein Bogen mit Stufe 1 bis 3 (gemalt + 4 Drehungen), je Art
//    ein Bogen mit allen Farbvarianten bzw. Teamfarben (werk-<art>-teams); Fotos nach <out>/baukasten/; Fehler ohne Materialfotos, bei
//    mehr als einem Draw-Call je Haus bzw. Werk oder abweichendem Umriss.
// 9. Stadt (Paket „Stadthäuser 3D“): Seed 3, KI gegen KI bis --citymin Spielminuten (Standard 10), Stadt an der Hauptstadt Iso | 3D
//    in 4 Drehungen, Sommer und Winter (<out>/stadt/); Draw-Calls, Dreiecke und Zeit „Objekte“ mit gemalten und mit 3D-Stadthäusern.
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-3d.mjs [--out .smoke/3d] [--scale 2] [--minutes 5] [--frames 8]
//                                 [--only kamera|vergleich|speicher|messung|schatten|baeume|baukasten|stadt|mvp] [--citymin 10]
//                                 [--what werke|haeuser] (nur mit baukasten: nur Werke oder nur Stadthäuser fotografieren)
// Ohne --only laufen die Teile 1 bis 6, 8 und 9; „mvp“ nur ausdrücklich.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openGame, measureFps, DEVICES } from './smoke.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const out = arg('out', '.smoke/3d');
const scale = Number(arg('scale', 2));
const minutes = Number(arg('minutes', 1));
const only = arg('only', null);
const frames = Number(arg('frames', 8));
const ZOOMS = [0.35, 1, 1.6];
const LIMIT = 1; // px
const MAX_DIFF = 3; // % abweichender Pixel zwischen Iso und 3D (Kantenfilterung, bewegte Fahnen, HUD-Uhr)
let fail = 0;
const errors = [];

/** Ansicht setzen: Drehung, Zoom, Mitte auf der eigenen Hauptstadt (sonst Kartenmitte) mit Versatz. */
const view = (g, rot, zoom, dx = 0, dy = 0) =>
  g.run(
    ({ rot, zoom, dx, dy }) => {
      const s = window.__frontline.session();
      const cam = s.camera;
      cam.rot = rot;
      cam.zoom = zoom;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      cam.centerOn((hq?.x ?? cam.mapW / 2) + dx, (hq?.y ?? cam.mapH / 2) + dy);
    },
    { rot, zoom, dx, dy },
  );

async function camera() {
  const g = await openGame({ seed: 3, query: 'three=1&cubes=1&iso=1', scale, out });
  try {
    const has3D = await g.run(() => typeof window.__frontline.session().renderer.probe === 'function');
    if (!has3D) throw new Error('kein Renderer3D (WebGL fehlt oder three.js nicht geladen)');
    console.log('Kamera: Drehung  Zoom   größte Abweichung (px)  Würfel');
    for (let rot = 0; rot < 4; rot++) {
      for (const zoom of ZOOMS) {
        await view(g, rot, zoom);
        await g.page.waitForTimeout(400);
        const res = await g.run(() => window.__frontline.session().renderer.probe());
        if (!res.length) throw new Error('keine Prüfwürfel');
        const worst = res.reduce((a, b) => (b.d > a.d ? b : a));
        if (worst.d >= LIMIT || !Number.isFinite(worst.d)) fail++;
        console.log(`        ${rot}        ${zoom.toFixed(2).padEnd(5)}  ${worst.d.toFixed(4).padEnd(22)}  ${res.length} (größte: ${worst.name})`);
        await g.shot(`kamera-rot${rot}-zoom${zoom}`);
      }
    }
    await g.run(() => {
      const s = window.__frontline.session();
      s.camera.rot = 0;
      s.camera.zoom = 1.6;
      s.camera.centerOn(s.camera.mapW - 80, s.camera.mapH - 80);
    });
    await g.page.waitForTimeout(400);
    await g.shot('kamera-ecke'); // Würfel am Hang, Kreuz = camera.worldToScreen am Fuß
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** Ein Bild klassisch und eines mit three (derselbe Renderer, nur camera.three), Fotos und Anteil abweichender Pixel. */
async function pair(g, name) {
  const shot = async (three) => {
    await g.run((three) => {
      const s = window.__frontline.session();
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view); // Sprites fertig malen (Zeitbudget je Bild)
    }, three);
    await g.page.waitForTimeout(250);
    await g.shot(`${name}-${three ? '3d' : 'iso'}`);
  };
  await shot(false);
  await shot(true);
  // Vergleich ohne Fotos: beide Bilder direkt hintereinander in dieselbe Leinwand
  return g.run(() => {
    const s = window.__frontline.session();
    const c = s.renderer.canvas;
    const grab = (three) => {
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const a = grab(false);
    const b = grab(true);
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 40 || Math.abs(a[i + 1] - b[i + 1]) > 40 || Math.abs(a[i + 2] - b[i + 2]) > 40) n++;
    }
    return (100 * n) / (a.length / 4);
  });
}

async function compare() {
  console.log('Vergleich Iso/3D: Seed  Jahreszeit  Drehung  Zoom  abweichende Pixel');
  for (const seed of [3, 7]) {
    for (const season of ['summer', 'winter']) {
      const wx = season === 'winter' ? 'snow' : 'clear';
      const g = await openGame({ seed, query: `iso=1&three=1&weather=${season}&wx=${wx}`, scale: 1, out });
      try {
        await g.run(() => (window.__frontline.session().loop.paused = true));
        for (const [rot, zoom] of [[0, 1], [1, 0.6], [2, 1.6], [3, 0.35]]) {
          await view(g, rot, zoom, 150, 100);
          const d = await pair(g, `s${seed}-${season}-rot${rot}-zoom${zoom}`);
          if (d > MAX_DIFF) fail++;
          console.log(`                  ${seed}     ${season.padEnd(10)}  ${rot}        ${String(zoom).padEnd(4)}  ${d.toFixed(2)} %${d > MAX_DIFF ? '  ZU VIEL' : ''}`);
        }
      } finally {
        errors.push(...g.errors);
        await g.close();
      }
    }
  }
}

async function memory() {
  const g = await openGame({ seed: 3, query: 'iso=1&three=1', scale: 1, out });
  try {
    const stat = () =>
      g.run(() => {
        const s = window.__frontline.session();
        return { ...s.renderer.billboards.stats(), heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6) };
      });
    const a = await stat();
    const t0 = Date.now();
    let k = 0;
    while (Date.now() - t0 < minutes * 60000) {
      const zoom = 0.35 + ((Math.sin(k * 0.7) + 1) / 2) * 1.25;
      await view(g, k % 4, zoom, Math.sin(k * 0.3) * 1500, Math.cos(k * 0.2) * 1500);
      await g.page.waitForTimeout(300);
      k++;
    }
    const b = await stat();
    console.log(`Speicher (${minutes} min, ${k} Ansichten): Atlasseiten ${a.pages} → ${b.pages}, Leerungen ${b.resets}, JS ${a.heap} → ${b.heap} MB`);
    if (b.pages > 4) fail++;
    await g.shot('speicher-ende');
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** 200 Einheiten (Panzer, Schützenpanzer, Soldaten, Hubschrauber) in einem Feld um (x, y), Team 0 und 1 gemischt. */
const spawnArmy = (g, dx = 0, dy = 0) =>
  g.run(
    ({ dx, dy }) => {
      const s = window.__frontline.session();
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const types = ['tank', 'ifv', 'rifleman', 'rifleman', 'truck', 'tank', 'at', 'gunship'];
      for (let i = 0; i < 200; i++) {
        const t = types[i % types.length];
        if (!s.game.spawnUnit(t, i % 2, hq.x + dx + ((i % 20) - 10) * 34, hq.y + dy + 260 + Math.floor(i / 20) * 34)) continue;
      }
    },
    { dx, dy },
  );

/** Zeit je Durchlauf (ms) über n Bilder: renderer.perf summiert lap je Name. */
const timePasses = (g, n) =>
  g.run((n) => {
    const s = window.__frontline.session();
    const r = s.renderer;
    const sum = {};
    const old = r.perf;
    r.perf = {
      lap(name, t) {
        const now = performance.now();
        sum[name] = (sum[name] ?? 0) + now - t;
        return now;
      },
      addRender() {},
    };
    for (let i = 0; i < 2; i++) r.render(s.controller.view); // warm (Shader, Sprites)
    for (const k of Object.keys(sum)) delete sum[k];
    const t0 = performance.now();
    for (let i = 0; i < n; i++) r.render(s.controller.view);
    const total = (performance.now() - t0) / n;
    r.perf = old;
    const out = { Bild: total };
    for (const [k, v] of Object.entries(sum)) out[k] = v / n;
    return out;
  }, n);

async function measure() {
  const g = await openGame({ seed: 3, query: 'iso=1&three=1', scale: 1, out });
  try {
    await g.run(() => (window.__frontline.session().loop.paused = true));
    await spawnArmy(g);
    await view(g, 0, 1, 0, 420);
    const modes = [['Iso', false, null], ['3D Aus', true, 'off'], ['3D Mittel', true, 'mid'], ['3D Hoch', true, 'high']];
    const rows = [];
    for (const [label, three, level] of modes) {
      await g.run(({ three, level }) => {
        const s = window.__frontline.session();
        s.camera.three = three;
        if (level) s.renderer.setShadows?.(level);
      }, { three, level });
      rows.push([label, await timePasses(g, frames)]);
      await g.shot(`messung-${label.replace(' ', '-').toLowerCase()}`);
    }
    const names = ['Bild', 'Gelände', 'Boden', 'Schatten', 'Objekte', 'Flieger', 'Nebel', 'Wetter', 'Balken'];
    console.log(`Messung (Seed 3, 200 Einheiten, ${frames} Bilder, ms je Bild; Software-WebGL):`);
    console.log(`  ${'Durchlauf'.padEnd(10)}${rows.map(([l]) => l.padStart(11)).join('')}`);
    for (const n of names) console.log(`  ${n.padEnd(10)}${rows.map(([, r]) => (r[n] === undefined ? '–' : r[n].toFixed(1)).padStart(11)).join('')}`);
    return rows;
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** Steilste befahrbare Stelle (Feinraster) im Umkreis r um (x, y): für den Panzer am Hang. */
const slopeSpot = (g, r) =>
  g.run((r) => {
    const s = window.__frontline.session();
    const rel = s.game.relief;
    const hq = s.game.buildings.find((b) => b.main && b.team === 0);
    let best = null;
    for (let y = hq.y - r; y <= hq.y + r; y += 32) {
      for (let x = hq.x - r; x <= hq.x + r; x += 32) {
        if (x < 200 || y < 200 || x > s.camera.mapW - 200 || y > s.camera.mapH - 200) continue;
        const h = rel.heightAt(x, y);
        if (h <= 10) continue;
        const k = Math.hypot(rel.heightAt(x + 32, y) - rel.heightAt(x - 32, y), rel.heightAt(x, y + 32) - rel.heightAt(x, y - 32)) / 64;
        if (k < 0.3 && (!best || k > best.k)) best = { x, y, k }; // steil, aber befahrbar (Fels ab RELIEF.rock)
      }
    }
    return best;
  }, r);

async function shadows() {
  const g = await openGame({ seed: 7, query: 'iso=1&three=1&shadows=high', scale: 1, out });
  try {
    const spot = await g.run(() => {
      const s = window.__frontline.session();
      s.loop.paused = true;
      s.renderer.revealAll = true;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const x = hq.x + 380;
      const y = hq.y + 380;
      const add = (t, team, dx, dy, a) => {
        const u = s.game.spawnUnit(t, team, x + dx, y + dy);
        if (u) u.angle = a;
        return u;
      };
      add('tank', 0, 0, 0, 0.4);
      add('ifv', 1, -90, 40, 2.2);
      add('truck', 0, 60, -80, 1.2);
      for (let i = 0; i < 6; i++) add('rifleman', i % 2, 70 + (i % 3) * 16, 40 + Math.floor(i / 3) * 18, 3);
      add('gunship', 0, -40, -70, 0.8);
      return { x, y };
    });
    // 1. Fotos je Drehung: Iso und 3D in jeder Stufe
    for (let rot = 0; rot < 4; rot++) {
      for (const [label, three, level] of [['iso', false, 'off'], ['aus', true, 'off'], ['mittel', true, 'mid'], ['hoch', true, 'high']]) {
        await g.run(({ rot, three, level, spot }) => {
          const s = window.__frontline.session();
          s.camera.three = three;
          s.renderer.setShadows(level);
          s.camera.rot = rot;
          s.camera.zoom = 2;
          s.camera.centerOn(spot.x, spot.y);
          for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
        }, { rot, three, level, spot });
        await g.shot(`schatten-rot${rot}-${label}`);
      }
    }
    // 2. Panzer am Hang, mit und ohne Schatten; Helligkeit im Schatten gegen daneben
    const hill = await slopeSpot(g, 2400);
    if (!hill) throw new Error('kein Hang in der Nähe der Hauptstadt');
    const dark = await g.run((hill) => {
      const s = window.__frontline.session();
      const u = s.game.spawnUnit('tank', 0, hill.x, hill.y);
      if (!u) return null;
      u.angle = 0.9;
      s.camera.rot = 0;
      s.camera.zoom = 2.4;
      s.camera.three = true;
      s.camera.centerOn(u.x, u.y); // spawnUnit kann auf einen freien Platz ausweichen
      const r = s.renderer;
      const c = r.canvas;
      const grab = (level) => {
        r.setShadows(level);
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      };
      // Schattenrichtung im Bild: Fußpunkt gegen Punkt eine Panzerhöhe weiter von der Sonne weg
      const L = r.lightVec();
      const len = 14 / Math.tan(Math.asin(L[2]));
      const p0 = s.camera.worldToScreen(u.x, u.y);
      const p1 = s.camera.worldToScreen(u.x - L[0] / Math.hypot(L[0], L[1]) * len, u.y - L[1] / Math.hypot(L[0], L[1]) * len);
      const lum = (d, x, y) => {
        let sum = 0;
        let n = 0;
        for (let j = -3; j <= 3; j++) {
          for (let i = -3; i <= 3; i++) {
            const k = (Math.round(y * r.dpr + j) * c.width + Math.round(x * r.dpr + i)) * 4;
            sum += d[k] + d[k + 1] + d[k + 2];
            n++;
          }
        }
        return sum / n / 3;
      };
      const off = grab('off');
      const on = grab('high');
      const q = { x: p1.x + (p1.x - p0.x) * 0.4, y: p1.y + (p1.y - p0.y) * 0.4 }; // hinter dem Panzer im Schatten
      const k = Math.hypot(s.game.relief.heightAt(u.x + 32, u.y) - s.game.relief.heightAt(u.x - 32, u.y), s.game.relief.heightAt(u.x, u.y + 32) - s.game.relief.heightAt(u.x, u.y - 32)) / 64;
      return { off: lum(off, q.x, q.y), on: lum(on, q.x, q.y), slope: k };
    }, hill);
    if (!dark) throw new Error('Panzer am Hang nicht gesetzt');
    await g.shot('schatten-hang-hoch');
    await g.run(() => {
      const s = window.__frontline.session();
      s.renderer.setShadows('off');
      for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    });
    await g.shot('schatten-hang-aus');
    const ok = dark.on < dark.off * 0.9;
    if (!ok) fail++;
    console.log(`Schatten am Hang (Neigung ${dark.slope.toFixed(2)}): Helligkeit hinter dem Panzer Aus ${dark.off.toFixed(0)}, Hoch ${dark.on.toFixed(0)}${ok ? '' : '  ZU HELL'}`);
    // 3. Verschieben: Größe der Schattenkarte gleich, Mitte auf dem Texel-Raster
    const pan = await g.run((spot) => {
      const s = window.__frontline.session();
      const r = s.renderer;
      r.setShadows('mid');
      s.camera.rot = 1;
      s.camera.zoom = 1;
      const seen = [];
      for (let i = 0; i < 12; i++) {
        s.camera.centerOn(spot.x + i * 13.7, spot.y - i * 7.3);
        r.render(s.controller.view);
        const f = r.sun.info;
        seen.push({ w: f.w, h: f.h, gr: Math.abs(f.cr / (f.w / 1024) - Math.round(f.cr / (f.w / 1024))), gu: Math.abs(f.cu / (f.h / 1024) - Math.round(f.cu / (f.h / 1024))) });
      }
      return seen;
    }, spot);
    const same = pan.every((p) => p.w === pan[0].w && p.h === pan[0].h);
    const grid = pan.every((p) => p.gr < 1e-3 && p.gu < 1e-3);
    if (!same || !grid) fail++;
    console.log(`Verschieben (12 Schritte): Karte ${pan[0].w}×${pan[0].h} Welt-px ${same ? 'gleich' : 'ÄNDERT SICH'}, Texel-Raster ${grid ? 'eingehalten' : 'VERLETZT'}`);
    // 4. Nacht: Dunkelheit bleibt drawMood, Schatten schwächer
    await g.run((spot) => {
      const s = window.__frontline.session();
      s.renderer.mood = 'night';
      s.renderer.setShadows('high');
      s.camera.rot = 0;
      s.camera.zoom = 2;
      s.camera.centerOn(spot.x, spot.y);
      for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    }, spot);
    await g.shot('schatten-nacht-hoch');
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

async function trees() {
  const FOREST = { x: 7600, y: 9000 }; // Seed 7: Misch- und Nadelwald neben einem Acker (bis ~1500 Bäume bei Zoom 0,5)
  for (const season of ['summer', 'autumn', 'winter']) {
    const wx = season === 'winter' ? 'snow' : 'clear';
    const g = await openGame({ seed: 7, query: `iso=1&three=1&shadows=high&weather=${season}&wx=${wx}`, scale: 1, out });
    try {
      await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
      });
      for (const [name, zoom] of [['nah', 1.6], ['fern', 0.5]]) {
        for (const three of [false, true]) {
          const st = await g.run(({ zoom, three, FOREST }) => {
            const s = window.__frontline.session();
            s.camera.three = three;
            s.camera.zoom = zoom;
            s.camera.rot = 0;
            s.camera.centerOn(FOREST.x, FOREST.y);
            for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
            return three ? s.renderer.trees3d.stats() : null;
          }, { zoom, three, FOREST });
          await g.shot(`baeume-${season}-${name}-${three ? '3d' : 'iso'}`);
          if (!st) continue;
          const worst = Math.max(...Object.values(st.bySpecies));
          const bad = st.trees >= 400 && worst > 2;
          if (bad) fail++;
          console.log(`Bäume ${season.padEnd(7)} ${name}: ${st.trees} Bäume, ${st.calls} Draw-Calls (je Art ${JSON.stringify(st.bySpecies)})${bad ? '  ZU VIELE' : ''}`);
        }
      }
      if (season !== 'summer') continue;
      for (let rot = 1; rot < 4; rot++) {
        await g.run(({ rot, FOREST }) => {
          const s = window.__frontline.session();
          s.camera.rot = rot;
          s.camera.zoom = 1.2;
          s.camera.centerOn(FOREST.x, FOREST.y);
          for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
        }, { rot, FOREST });
        await g.shot(`baeume-summer-rot${rot}-3d`);
      }
      // Zeit des Durchlaufs „Objekte“: gemalte Bäume (Billboards) gegen 3D-Bäume, Schatten Aus und Hoch
      for (const zoom of [1, 0.5]) {
        await g.run(({ zoom, FOREST }) => {
          const s = window.__frontline.session();
          s.camera.rot = 0;
          s.camera.zoom = zoom;
          s.camera.centerOn(FOREST.x, FOREST.y);
        }, { zoom, FOREST });
        const row = [];
        for (const on of [false, true]) {
          for (const level of ['off', 'high']) {
            await g.run(({ on, level }) => {
              const r = window.__frontline.session().renderer;
              r.trees3dOn = on;
              r.setShadows(level);
            }, { on, level });
            row.push(`${on ? '3D' : 'gemalt'}/${level === 'off' ? 'Aus' : 'Hoch'} ${(await timePasses(g, frames)).Objekte.toFixed(0)}`);
          }
        }
        const n = await g.run(() => window.__frontline.session().renderer.trees3d.count);
        console.log(`Objekte (ms, Zoom ${zoom}, ${n} Bäume): ${row.join(', ')}`);
      }
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/**
 * Baukasten (Pakete „Baukasten 3D“, „Stadthäuser 3D“): alle Stadthäuser aus town3d.js (kit3d.js) neben dem gemalten Bild aus
 * townhouses.js, ohne Partie (Startmenü, eigene Leinwände). Je Art und Stimmung (Sommer/Winter × Tag/Nacht) ein Bogen mit den drei
 * Stufen als Zeilen (gemalt, dann 3D in den 4 Drehungen; Schatten Hoch über die Sonne aus sun3d.js, Nacht mit drawMood wie im
 * Spiel), dazu je Art ein Bogen mit allen Farbvarianten (gemalt | 3D, Drehung 0). Prüft je Haus: Fotos der Materialien geladen,
 * 3D-Haus sichtbar, Umriss (Bildbereich ohne Hintergrund) in Drehung 0 wie gemalt (±BOX_TOL px, am Tag), ein Draw-Call je Haus.
 */
async function baukasten() {
  const BOX_TOL = 14; // CSS-px Abweichung der Umrissränder (gemalte Konturlinien, Baumkronen als Kugeln, gemalter Schatten)
  const dir = join(out, 'baukasten');
  await mkdir(dir, { recursive: true });
  const g = await openGame({ seed: 3, start: false, scale: 1, out });
  try {
    // Werkzeug in der Seite: ein Haus gemalt und in 3D (Drehungen rots) als Leinwände, dazu Umriss, Dreiecke, Draw-Calls
    await g.run(async () => {
      const THREE = await import('/js/vendor/three/three.module.min.js');
      const { Camera } = await import('/js/render/camera.js');
      const { drawTownIso, beginTownFrame, TALL } = await import('/js/render/townhouses.js');
      const { setRoofSnow } = await import('/js/render/season.js');
      const { materialsReady } = await import('/js/render/materials.js');
      const { drawMood } = await import('/js/render/mood.js');
      const { LIGHT_ELEV } = await import('/js/render/ground.js');
      const { BALANCE } = await import('/js/data/balance.js');
      const kit = await import('/js/render3d/kit3d.js');
      const { townGeometry } = await import('/js/render3d/town3d.js');
      const { makeWorldRoot, makeIsoCamera, syncIsoCamera } = await import('/js/render3d/camera3d.js');
      const { Sun3D, CATCH } = await import('/js/render3d/sun3d.js');
      const mat = kit.makeKitMaterial();
      for (let i = 0; i < 100 && !(materialsReady() && kit.kitTexturesReady()); i++) await new Promise((ok) => setTimeout(ok, 50));
      const W = 260;
      const DPR = 2;
      const BG = '#7a9e58';
      const X = 1000;
      const Y = 1000;
      const cv = document.createElement('canvas');
      const gl = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
      gl.setPixelRatio(DPR);
      const scene = new THREE.Scene();
      const root = makeWorldRoot();
      scene.add(root);
      const cam3 = makeIsoCamera();
      const ground = new THREE.BufferGeometry();
      const R = 400;
      ground.setAttribute('position', new THREE.Float32BufferAttribute([X - R, Y - R, 0, X + R, Y - R, 0, X + R, Y + R, 0, X - R, Y - R, 0, X + R, Y + R, 0, X - R, Y + R, 0], 3));
      const sun = new Sun3D(gl, scene, root, ground);
      const canvas = (w, h) => {
        const c = document.createElement('canvas');
        c.width = w * DPR;
        c.height = h * DPR;
        return c;
      };
      const bg = [0x7a, 0x9e, 0x58];
      const bbox = (c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 60) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        return [x0, y0, x1, y1].map((v) => Math.round(v / DPR));
      };
      window.__kitHouse = ({ ck, lv, variant, season, night, rots }) => {
        const tall = TALL[ck][lv];
        const ZOOM = tall > 70 ? 1.7 : 2.6; // Hochhäuser kleiner, damit sie ins Feld passen
        const H = 290;
        const cam = new Camera(2000, 2000);
        cam.iso = true;
        cam.resize(W, H);
        const aim = (rot) => {
          cam.rot = rot;
          cam.zoom = ZOOM;
          cam.x = X;
          cam.y = Y;
          const p = cam.screenToWorldFlat(W / 2, H / 2 - H * (tall > 70 ? 0.2 : 0.14)); // Anker unter der Mitte (Haus ragt nach oben)
          cam.x = p.x;
          cam.y = p.y;
        };
        const mood = night ? 'night' : null;
        // gemalt
        setRoofSnow(season === 'winter');
        const b = { x: X, y: Y, ck, level: lv, variant, color: '#3a6fb3' };
        const painted = canvas(W, H);
        const pc = painted.getContext('2d');
        aim(0);
        for (let i = 0; i < 6; i++) {
          beginTownFrame(DPR);
          pc.setTransform(DPR, 0, 0, DPR, 0, 0);
          pc.fillStyle = BG;
          pc.fillRect(0, 0, W, H);
          drawTownIso(pc, cam, b, season);
        }
        setRoofSnow(false);
        // 3D
        gl.setSize(W, H, false);
        sun.setLevel('high');
        sun.setMood(mood);
        const geo = townGeometry(ck, lv, variant, '#3a6fb3');
        const mesh = kit.kitMesh(geo, mat);
        mesh.position.set(X, Y, 0);
        root.add(mesh);
        const panels = [];
        let calls = 0;
        const light0 = (rot) => {
          const [, , rc, rd] = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][rot]; // wie Renderer.lightVec
          const a = Math.atan2(-rd, -rc) + 0.35;
          const k = Math.sqrt(1 - LIGHT_ELEV * LIGHT_ELEV);
          return [Math.cos(a) * k, Math.sin(a) * k, LIGHT_ELEV];
        };
        for (const rot of rots) {
          aim(rot);
          syncIsoCamera(cam3, cam);
          const light = light0(rot);
          kit.setKitFrame(mat, { light, snow: season === 'winter' ? 1 : 0, night: night ? 1 : 0, shade: BALANCE.shadows3d.opacity[mood ?? 'none'] });
          gl.setClearColor(BG, 1);
          sun.update(cam3, light, null);
          gl.shadowMap.needsUpdate = true;
          cam3.layers.set(CATCH);
          gl.render(scene, cam3);
          cam3.layers.set(0);
          gl.autoClear = false;
          gl.clearDepth();
          gl.render(scene, cam3);
          gl.autoClear = true;
          calls = gl.info.render.calls;
          const c = canvas(W, H);
          c.getContext('2d').drawImage(cv, 0, 0);
          panels.push(c);
        }
        // Umriss ohne Schattenkarte (geworfene Schatten zählen nicht): Drehung 0 noch einmal mit Schatten Aus
        sun.setLevel('off');
        aim(0);
        syncIsoCamera(cam3, cam);
        kit.setKitFrame(mat, { light: light0(0), snow: season === 'winter' ? 1 : 0, night: 0, shade: 0.4 });
        gl.render(scene, cam3);
        const flat0 = canvas(W, H);
        flat0.getContext('2d').drawImage(cv, 0, 0);
        root.remove(mesh);
        const boxes = { painted: bbox(painted), three: bbox(flat0) };
        // Stimmung wie im Spiel über jedes Feld
        if (mood) {
          for (const c of [painted, ...panels]) {
            const x = c.getContext('2d');
            x.setTransform(DPR, 0, 0, DPR, 0, 0);
            drawMood(x, mood, W, H);
          }
        }
        return { painted, panels, W, H, DPR, tris: geo.getAttribute('position').count / 3, calls, boxes, tex: kit.kitTexturesReady() };
      };
      // Werk gemalt und in 3D (Paket „Werke 3D“): Bildmaß wie works.js (168 × 200 bei Maßstab 1), Dampf der Kühltürme gemalt über dem Mesh
      const { drawWorksIso, drawWorksSteam, worksTall } = await import('/js/render/works.js');
      const { worksGeometry } = await import('/js/render3d/works3d.js');
      const { spriteFrame, spriteMissed } = await import('/js/render/spritecache.js');
      window.__kitWork = ({ kind, lv, color, season, night, rots }) => {
        const tall = worksTall(kind, lv);
        const H = 300;
        const ZOOM = Math.min(1.5, 270 / (tall + 49));
        const py = (tall + 2) * ZOOM + (H - (tall + 49) * ZOOM) / 2; // Ankerpunkt: Bild mittig
        const cam = new Camera(2000, 2000);
        cam.iso = true;
        cam.resize(W, H);
        const aim = (rot) => {
          cam.rot = rot;
          cam.zoom = ZOOM;
          cam.x = X;
          cam.y = Y;
          const p = cam.screenToWorldFlat(W / 2, H - py);
          cam.x = p.x;
          cam.y = p.y;
        };
        const mood = night ? 'night' : null;
        const b = { x: X, y: Y, kind, level: lv, color, damage: 0 };
        const painted = canvas(W, H);
        const pc = painted.getContext('2d');
        aim(0);
        for (let i = 0; i < 16; i++) {
          spriteFrame(DPR);
          pc.setTransform(DPR, 0, 0, DPR, 0, 0);
          pc.fillStyle = BG;
          pc.fillRect(0, 0, W, H);
          drawWorksIso(pc, cam, b, season);
          if (!spriteMissed()) break;
        }
        gl.setSize(W, H, false);
        sun.setLevel('high');
        sun.setMood(mood);
        const geo = worksGeometry(kind, lv);
        const mesh = kit.kitTeamMesh(geo, mat, color);
        mesh.position.set(X, Y, 0);
        root.add(mesh);
        const light0 = (rot) => {
          const [, , rc, rd] = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][rot];
          const a = Math.atan2(-rd, -rc) + 0.35;
          const k = Math.sqrt(1 - LIGHT_ELEV * LIGHT_ELEV);
          return [Math.cos(a) * k, Math.sin(a) * k, LIGHT_ELEV];
        };
        const panels = [];
        let calls = 0;
        for (const rot of rots) {
          aim(rot);
          syncIsoCamera(cam3, cam);
          const light = light0(rot);
          kit.setKitFrame(mat, { light, snow: season === 'winter' ? 1 : 0, night: night ? 1 : 0, shade: BALANCE.shadows3d.opacity[mood ?? 'none'] });
          gl.setClearColor(BG, 1);
          sun.update(cam3, light, null);
          gl.shadowMap.needsUpdate = true;
          cam3.layers.set(CATCH);
          gl.render(scene, cam3);
          cam3.layers.set(0);
          gl.autoClear = false;
          gl.clearDepth();
          gl.render(scene, cam3);
          gl.autoClear = true;
          calls = gl.info.render.calls;
          const c = canvas(W, H);
          const x = c.getContext('2d');
          x.drawImage(cv, 0, 0);
          x.setTransform(DPR, 0, 0, DPR, 0, 0);
          for (let i = 0; i < 16; i++) {
            spriteFrame(DPR);
            drawWorksSteam(x, cam, b);
            if (!spriteMissed()) break;
          }
          panels.push(c);
        }
        sun.setLevel('off');
        aim(0);
        syncIsoCamera(cam3, cam);
        kit.setKitFrame(mat, { light: light0(0), snow: season === 'winter' ? 1 : 0, night: 0, shade: 0.4 });
        gl.render(scene, cam3);
        const flat0 = canvas(W, H);
        flat0.getContext('2d').drawImage(cv, 0, 0);
        root.remove(mesh);
        const boxes = { painted: bbox(painted), three: bbox(flat0) };
        if (mood) {
          for (const c of [painted, ...panels]) {
            const x = c.getContext('2d');
            x.setTransform(DPR, 0, 0, DPR, 0, 0);
            drawMood(x, mood, W, H);
          }
        }
        return { painted, panels, W, H, DPR, tris: geo.getAttribute('position').count / 3, calls, boxes, tex: kit.kitTexturesReady() };
      };
      /** Bogen aus Zeilen von Feldern (Leinwände) mit Beschriftung je Feld, als PNG-Daten-URL. */
      window.__kitSheet = (rows, RH = 290) => {
        const gap = 6;
        const cols = Math.max(...rows.map((r) => r.length));
        const sheet = document.createElement('canvas');
        sheet.width = (cols * W + (cols - 1) * gap) * DPR;
        sheet.height = (rows.length * RH + (rows.length - 1) * gap) * DPR;
        const sc = sheet.getContext('2d');
        sc.fillStyle = '#111';
        sc.fillRect(0, 0, sheet.width, sheet.height);
        rows.forEach((row, j) => {
          row.forEach(([c, t], i) => {
            sc.setTransform(DPR, 0, 0, DPR, i * (W + gap) * DPR, j * (RH + gap) * DPR);
            sc.drawImage(c, 0, 0, W, RH);
            sc.font = 'bold 13px sans-serif';
            sc.fillStyle = 'rgba(0,0,0,.6)';
            sc.fillRect(4, RH - 22, sc.measureText(t).width + 8, 18);
            sc.fillStyle = '#fff';
            sc.fillText(t, 8, RH - 8);
          });
        });
        return sheet.toDataURL('image/png');
      };
    });
    const KINDS = ['res', 'com', 'market', 'dc', 'hospital', 'heliport'];
    const save = (name, url) => writeFile(join(dir, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
    const tris = {};
    const what = arg('what', null); // --what werke | haeuser: nur eines von beidem fotografieren
    for (const ck of what === 'werke' ? [] : KINDS) {
      for (const season of ['summer', 'winter']) {
        for (const night of [false, true]) {
          const name = `${ck}-${season}-${night ? 'nacht' : 'tag'}`;
          const res = await g.run(({ ck, season, night }) => {
            const rows = [];
            const stats = [];
            for (const lv of [1, 2, 3]) {
              const r = window.__kitHouse({ ck, lv, variant: (lv - 1) % 3, season, night, rots: [0, 1, 2, 3] });
              rows.push([[r.painted, `${ck}${lv} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
              stats.push({ lv, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
            }
            return { url: window.__kitSheet(rows), stats };
          }, { ck, season, night });
          await save(name, res.url);
          for (const s of res.stats) {
            const [p, t] = [s.boxes.painted, s.boxes.three];
            const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
            const bad = !s.tex || t[2] < 0 || (!night && dev > BOX_TOL) || s.calls !== 1;
            if (bad) fail++;
            if (bad || (season === 'summer' && !night)) {
              console.log(`Baukasten ${ck}${s.lv} ${season} ${night ? 'Nacht' : 'Tag'}: ${s.tris} Dreiecke, ${s.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
            }
          }
        }
      }
      // alle Farbvarianten: je Stufe eine Zeile gemalt | 3D (Drehung 0) für Variante 0, 1, 2 (Sommer, Tag)
      const res = await g.run((ck) => {
        const rows = [];
        const stats = [];
        for (const lv of [1, 2, 3]) {
          const row = [];
          for (const variant of [0, 1, 2]) {
            const r = window.__kitHouse({ ck, lv, variant, season: 'summer', night: false, rots: [0] });
            row.push([r.painted, `${ck}${lv}/${variant} gemalt`], [r.panels[0], `${ck}${lv}/${variant} 3D`]);
            stats.push({ lv, variant, tris: r.tris, calls: r.calls, boxes: r.boxes });
          }
          rows.push(row);
        }
        return { url: window.__kitSheet(rows), stats };
      }, ck);
      await save(`${ck}-varianten`, res.url);
      for (const s of res.stats) {
        const [p, t] = [s.boxes.painted, s.boxes.three];
        const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
        tris[`${ck}${s.lv}/${s.variant}`] = s.tris;
        if (dev > BOX_TOL || s.calls !== 1 || t[2] < 0) {
          fail++;
          console.log(`Baukasten ${ck}${s.lv}/${s.variant}: Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px), ${s.calls} Draw-Call(s)  FEHLER`);
        }
      }
    }
    // Werke (Paket „Werke 3D“): je Art und Stimmung ein Bogen mit Stufe 1 bis 3 (gemalt + 4 Drehungen), je Art ein Bogen mit den Teamfarben
    const WK = ['power', 'bm', 'mun', 'fuel', 'steel', 'kero'];
    const TEAMS = ['#3d8bfd', '#e5484d', '#3fb950', '#e3b341'];
    const wtris = {};
    for (const kind of what === 'haeuser' ? [] : WK) {
      for (const season of ['summer', 'winter']) {
        for (const night of [false, true]) {
          const name = `werk-${kind}-${season}-${night ? 'nacht' : 'tag'}`;
          const res = await g.run(({ kind, season, night, color }) => {
            const rows = [];
            const stats = [];
            for (const lv of [1, 2, 3]) {
              const r = window.__kitWork({ kind, lv, color, season, night, rots: [0, 1, 2, 3] });
              rows.push([[r.painted, `${kind}${lv} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
              stats.push({ lv, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
            }
            return { url: window.__kitSheet(rows, 300), stats };
          }, { kind, season, night, color: TEAMS[0] });
          await save(name, res.url);
          for (const s of res.stats) {
            const [p, t] = [s.boxes.painted, s.boxes.three];
            const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
            wtris[`${kind}${s.lv}`] = s.tris;
            const bad = !s.tex || t[2] < 0 || (!night && dev > BOX_TOL) || s.calls !== 1;
            if (bad) fail++;
            if (bad || (season === 'summer' && !night)) {
              console.log(`Werk ${kind}${s.lv} ${season} ${night ? 'Nacht' : 'Tag'}: ${s.tris} Dreiecke, ${s.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
            }
          }
        }
      }
      // Teamfarben: je Stufe eine Zeile gemalt | 3D (Drehung 0) für alle vier Teams (Sommer, Tag)
      const res = await g.run(({ kind, teams }) => {
        const rows = [];
        for (const lv of [1, 2, 3]) {
          const row = [];
          for (const color of teams) {
            const r = window.__kitWork({ kind, lv, color, season: 'summer', night: false, rots: [0] });
            row.push([r.painted, `${kind}${lv} ${color} gemalt`], [r.panels[0], `3D`]);
          }
          rows.push(row);
        }
        return window.__kitSheet(rows, 300);
      }, { kind, teams: TEAMS });
      await save(`werk-${kind}-teams`, res);
    }
    console.log(`Baukasten: Dreiecke je Werk ${Object.entries(wtris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`Baukasten: Dreiecke je Variante ${Object.entries(tris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/**
 * Stadt (Paket „Stadthäuser 3D“): echte Partie mit Seed 3, beide Seiten KI bis --citymin Spielminuten (Standard 10, Simulation direkt
 * in der Seite), Ansicht auf die Stadt an der eigenen Hauptstadt. Fotos Iso | 3D (Schatten Hoch) in den 4 Drehungen, Sommer und
 * Winter, nach <out>/stadt/. Messung an der Hauptstadt (Drehung 0, Zoom 1): Draw-Calls und Dreiecke im Durchlauf „Objekte“ und Zeit
 * des Durchlaufs (Software-WebGL), jeweils mit gemalten Stadthäusern (vorher, towns3dOn = false) und 3D (nachher), Schatten Aus/Hoch.
 * Fehler bei Browserfehlern (gesammelt) oder wenn in 3D kein Stadthaus als Mesh erscheint.
 */
async function city() {
  const dir = join(out, 'stadt');
  await mkdir(dir, { recursive: true });
  const cityMin = Number(arg('citymin', 10));
  for (const season of ['summer', 'winter']) {
    const g = await openGame({ seed: 3, query: `iso=1&three=1&shadows=high&weather=${season}&wx=clear`, scale: 1, out });
    try {
      const has3D = await g.run(() => !!window.__frontline.session().renderer.towns3d);
      if (!has3D) throw new Error('Ansicht 3D nicht aktiv (WebGL oder three.js fehlt)');
      // Partie vorspulen: alle Teams mit KI, Simulation direkt (ohne Zeichnen), in Schritten zu einer Spielminute
      await g.run(async () => {
        const { AI } = await import('/js/ai/ai.js');
        const s = window.__frontline.session();
        s.loop.paused = true;
        window.__ais = s.game.teams.map((_, t) => new AI(s.game, t, 'normal'));
      });
      for (let m = 0; m < cityMin; m++) {
        await g.run((m) => {
          const s = window.__frontline.session();
          while (s.game.time < (m + 1) * 60) {
            for (const a of window.__ais) a.update(0.05);
            s.game.update(0.05);
          }
        }, m);
      }
      const spot = await g.run(async () => {
        const { cityBuildings } = await import('/js/render/citylayer.js');
        const s = window.__frontline.session();
        const hq = s.game.buildings.find((b) => b.main && b.team === 0);
        const near = cityBuildings(s.game, 0, () => true, () => true).filter((b) => b.kind === 'town' && Math.hypot(b.x - hq.x, b.y - hq.y) < 700);
        const kinds = {};
        for (const b of near) kinds[`${b.ck}${b.level}`] = (kinds[`${b.ck}${b.level}`] ?? 0) + 1;
        if (!near.length) return { x: hq.x, y: hq.y, n: 0, kinds };
        return { x: near.reduce((a, b) => a + b.x, 0) / near.length, y: near.reduce((a, b) => a + b.y, 0) / near.length, n: near.length, kinds };
      });
      console.log(`Stadt ${season}: ${cityMin} Spielminuten, ${spot.n} Stadthäuser an der Hauptstadt ${JSON.stringify(spot.kinds)}`);
      for (let rot = 0; rot < 4; rot++) {
        await look(g, spot.x, spot.y, rot, 1);
        await mvpPair(g, dir, 'seed3', `${season}-drehung${rot}`);
      }
      // Ort mit den meisten Werken (und Stadthäusern) im Bild: Mittelpunkt, Zahl und Arten
      const wspot = await g.run(async () => {
        const { cityBuildings } = await import('/js/render/citylayer.js');
        const s = window.__frontline.session();
        const all = cityBuildings(s.game, 0, () => true, () => true);
        const works = all.filter((b) => b.kind !== 'town' && b.level > 0 && ['bm', 'mun', 'fuel', 'steel', 'power', 'kero'].includes(b.kind));
        const houses = all.filter((b) => b.kind === 'town');
        const R = 420;
        let best = null;
        for (const w of works) {
          const nw = works.filter((o) => Math.hypot(o.x - w.x, o.y - w.y) < R);
          const nh = houses.filter((o) => Math.hypot(o.x - w.x, o.y - w.y) < R).length;
          const score = nw.length * 6 + nh;
          if (!best || score > best.score) {
            const x = nw.reduce((a, o) => a + o.x, 0) / nw.length;
            const y = nw.reduce((a, o) => a + o.y, 0) / nw.length;
            const kinds = {};
            for (const o of nw) kinds[`${o.kind}${o.level}`] = (kinds[`${o.kind}${o.level}`] ?? 0) + 1;
            best = { score, x, y, works: nw.length, houses: nh, kinds };
          }
        }
        return best ?? { x: s.camera.mapW / 2, y: s.camera.mapH / 2, works: 0, houses: 0, kinds: {} };
      });
      console.log(`Stadt ${season}: Werke-Ausschnitt ${wspot.works} Werke, ${wspot.houses} Stadthäuser in der Nähe ${JSON.stringify(wspot.kinds)}`);
      for (let rot = 0; rot < 4; rot++) {
        await look(g, wspot.x, wspot.y, rot, 1);
        await mvpPair(g, dir, 'seed3', `werke-${season}-drehung${rot}`);
      }
      if (season !== 'summer') continue;
      await look(g, wspot.x, wspot.y, 0, 1);
      const rows = [];
      // gemalt (alles), nur Stadthäuser 3D (Stand vor „Werke 3D“), Stadthäuser und Werke 3D
      for (const level of ['off', 'high']) {
        for (const [towns, works] of [[false, false], [true, false], [true, true]]) {
          const st = await g.run(({ level, towns, works }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.towns3dOn = towns;
            r.works3dOn = works;
            for (let i = 0; i < 3; i++) r.render(s.controller.view);
            const info = r.gl.info;
            const orig = r.objects3d;
            let obj = null;
            info.autoReset = false;
            r.objects3d = function (f) {
              info.reset();
              orig.call(this, f);
              obj = { calls: info.render.calls, tris: info.render.triangles };
            };
            try {
              r.render(s.controller.view);
            } finally {
              r.objects3d = orig;
              info.autoReset = true;
            }
            return { ...obj, houses: r.towns3d.stats('town'), works: r.towns3d.stats('works') };
          }, { level, towns, works });
          const t = await timePasses(g, frames);
          if (works && !st.works.houses) fail++;
          const what = `${towns ? 'Häuser 3D' : 'gemalt   '}${works ? ' + Werke 3D' : '           '}`;
          rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${what}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (towns ? ` (Häuser: ${st.houses.houses}/${st.houses.calls} Varianten/${st.houses.tris} Dreiecke` : ' (') + (works ? `${towns ? '; ' : ''}Werke: ${st.works.houses}/${st.works.calls} Varianten/${st.works.tris} Dreiecke` : '') + ')');
        }
      }
      await g.run(() => {
        const r = window.__frontline.session().renderer;
        r.towns3dOn = true;
        r.works3dOn = true;
      });
      console.log(`Stadt Messung (Seed 3, Ausschnitt mit ${wspot.works} Werken und ${wspot.houses} Stadthäusern in der Nähe, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
      for (const r of rows) console.log(`  ${r}`);
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/** Zwei Bildschirmfotos (PNG-Puffer) nebeneinander als ein Bild speichern, links „alt (Iso)“, rechts „neu (3D)“. */
async function sideBySide(g, file, a, b) {
  const url = await g.run(
    async ({ a, b }) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${s}`; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas');
      const gap = 8;
      c.width = ia.width + gap + ib.width;
      c.height = Math.max(ia.height, ib.height);
      const x = c.getContext('2d');
      x.fillStyle = '#111';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(ia, 0, 0);
      x.drawImage(ib, ia.width + gap, 0);
      x.font = `bold ${Math.round(c.height / 28)}px sans-serif`;
      for (const [t, px] of [['alt (Iso)', 10], ['neu (3D)', ia.width + gap + 10]]) {
        x.fillStyle = 'rgba(0,0,0,.6)';
        x.fillRect(px - 4, c.height - c.height / 18 - 8, x.measureText(t).width + 8, c.height / 18 + 4);
        x.fillStyle = '#fff';
        x.fillText(t, px, c.height - 14);
      }
      return c.toDataURL('image/png');
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  );
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
}

/** Ansicht aus Iso und 3D fotografieren (Spiel angehalten, je 4 Bilder fertig gemalt) und nebeneinander speichern. */
async function mvpPair(g, dir, dev, name) {
  const shots = [];
  for (const three of [false, true]) {
    await g.run((three) => {
      const s = window.__frontline.session();
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
    }, three);
    await g.page.waitForTimeout(250);
    shots.push(await g.page.screenshot());
  }
  await sideBySide(g, join(dir, `${dev}-${name}.png`), shots[0], shots[1]);
}

/** Bildrate an der aktuellen Ansicht: Iso und 3D mit Schatten Aus/Mittel/Hoch, Spiel läuft (1×). */
async function mvpFps(g, ms) {
  const row = {};
  for (const [label, three, level] of [['Iso', false, 'off'], ['3D Aus', true, 'off'], ['3D Mittel', true, 'mid'], ['3D Hoch', true, 'high']]) {
    await g.run(({ three, level }) => {
      const s = window.__frontline.session();
      s.loop.paused = false;
      s.loop.speed = 1;
      s.camera.three = three;
      s.renderer.setShadows(level);
    }, { three, level });
    await g.page.waitForTimeout(600);
    const r = await measureFps(g, ms);
    row[label] = { fps: r.fps, worst: r.worst };
  }
  return row;
}

/** Kamera auf (x, y) mit Drehung und Zoom. */
const look = (g, x, y, rot = 0, zoom = 1) =>
  g.run(({ x, y, rot, zoom }) => {
    const c = window.__frontline.session().camera;
    c.rot = rot;
    c.zoom = zoom;
    c.centerOn(x, y);
  }, { x, y, rot, zoom });

/** Auswahl per Klick/Tippen auf das Bild einer Einheit in 3D und Befehl per Rechtsklick/Tippen auf den Boden. */
async function mvpOrder(g, dir, dev) {
  const { page } = g;
  const u = await g.run(() => {
    const s = window.__frontline.session();
    s.loop.paused = true;
    s.camera.three = true;
    s.camera.rot = 0;
    s.camera.zoom = 1.2;
    s.controller.view.selection.clear();
    const hq = s.game.buildings.find((b) => b.main && b.team === 0);
    // freier Platz neben der Hauptstadt (Ausweichen übernimmt spawnUnit)
    const t = s.game.spawnUnit('tank', 0, hq.x + 320, hq.y + 320);
    if (!t) return null;
    s.camera.centerOn(t.x, t.y);
    for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    return { id: t.id, x: t.x, y: t.y };
  });
  if (!u) throw new Error('Panzer für die Auswahl nicht gesetzt');
  const at = (wx, wy) =>
    g.run(({ wx, wy }) => {
      const s = window.__frontline.session();
      const p = s.camera.worldToScreen(wx, wy);
      const r = s.renderer.canvas.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    }, { wx, wy });
  const p = await at(u.x, u.y);
  if (g.touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
  const selected = await g.run((id) => window.__frontline.session().controller.view.selection.has(id), u.id);
  await g.shot(`mvp/${dev}-auswahl-3d`);
  if (!selected) return { selected, moved: 0 };
  // Ziel: 260 Welt-px weiter (Bild nach rechts unten), auf dem Boden
  const q = await at(u.x + 260, u.y + 60);
  if (g.touch) await page.touchscreen.tap(q.x, q.y);
  else await page.mouse.click(q.x, q.y, { button: 'right' });
  await g.run(() => (window.__frontline.session().loop.paused = false));
  await page.waitForTimeout(3000);
  const moved = await g.run(({ id, x, y }) => {
    const t = window.__frontline.session().game.units.find((v) => v.id === id);
    return t ? Math.hypot(t.x - x, t.y - y) : 0;
  }, u);
  await g.run(() => (window.__frontline.session().loop.paused = true));
  await g.shot(`mvp/${dev}-befehl-3d`);
  return { selected, moved };
}

async function mvp() {
  const devs = arg('devices', 'desktop,tablet,phone').split(',');
  const gameMin = Number(arg('gametime', 5));
  const fpsMs = Number(arg('fpsms', 5000));
  const dir = join(out, 'mvp');
  await mkdir(dir, { recursive: true });
  const FOREST = { x: 7600, y: 9000 };
  const report = {};
  for (const dev of devs) {
    if (!(dev in DEVICES)) throw new Error(`unbekanntes Gerät ${dev}`);
    const res = (report[dev] = { fps: {}, passes: {}, order: null, gameMin: 0, notes: [] });
    // --- Sommer: Rundgang, Auswahl, Befehl, Zeitraffer, Bildrate ---
    let g = await openGame({ seed: 7, query: 'iso=1&three=1&shadows=mid&weather=summer&wx=clear', device: dev, out });
    try {
      const { page } = g;
      const has3D = await g.run(() => !!window.__frontline.session().renderer.three && window.__frontline.session().camera.three);
      if (!has3D) throw new Error(`${dev}: Ansicht 3D nicht aktiv (WebGL oder three.js fehlt)`);
      // Ansicht über V bzw. Knopf „Ansicht“: 3D → 2D → Iso → 3D
      const seen = [];
      for (let i = 0; i < 3; i++) {
        if (g.touch && (await g.reachable('[data-act=view]'))) await g.press('[data-act=view]');
        else await page.keyboard.press('v');
        await page.waitForTimeout(900);
        seen.push(await g.run(() => { const c = window.__frontline.session().camera; return c.three ? '3D' : c.iso ? 'Iso' : '2D'; }));
      }
      if (seen.join() !== '2D,Iso,3D') {
        fail++;
        res.notes.push(`Ansicht umschalten: ${seen.join(' → ')} statt 2D → Iso → 3D`);
      }
      const hq = await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        const b = s.game.buildings.find((b) => b.main && b.team === 0);
        return { x: b.x, y: b.y };
      });
      await look(g, hq.x + 150, hq.y + 100);
      await mvpPair(g, dir, dev, 'start');
      for (let rot = 1; rot < 4; rot++) {
        await look(g, hq.x + 150, hq.y + 100, rot, 1);
        await mvpPair(g, dir, dev, `drehung${rot}`);
      }
      for (const zoom of [0.35, 1.6]) {
        await look(g, hq.x + 150, hq.y + 100, 0, zoom);
        await mvpPair(g, dir, dev, `zoom${zoom}`);
      }
      await look(g, FOREST.x, FOREST.y, 0, 1);
      await mvpPair(g, dir, dev, 'wald');
      const hill = await slopeSpot(g, 2400);
      if (hill) {
        const u = await g.run((hill) => {
          const s = window.__frontline.session();
          const t = s.game.spawnUnit('tank', 0, hill.x, hill.y);
          if (t) t.angle = 0.9;
          return t ? { x: t.x, y: t.y } : null;
        }, hill);
        if (u) {
          await look(g, u.x, u.y, 0, 2);
          await mvpPair(g, dir, dev, 'hang');
        } else res.notes.push('Panzer am Hang nicht gesetzt');
      } else res.notes.push('kein Hang bei der Hauptstadt');
      // Auswahl und Befehl in 3D
      res.order = await mvpOrder(g, dir, dev);
      if (!res.order.selected || res.order.moved < 20) fail++;
      // Zeitraffer: Blau mit KI, 10×, in 2D (spart Zeichnen), bis gameMin Spielminuten oder 4 min echte Zeit
      await g.run(async () => {
        const { AI } = await import('/js/ai/ai.js');
        const s = window.__frontline.session();
        const blue = new AI(s.game, 0, 'normal');
        const step = s.game.update.bind(s.game);
        s.game.update = (dt) => {
          blue.update(dt);
          step(dt);
        };
        s.camera.three = false;
        s.camera.iso = false;
        s.loop.paused = false;
        s.loop.speed = 10;
      });
      const t0 = Date.now();
      while (Date.now() - t0 < 240000) {
        if ((await g.run(() => window.__frontline.session().game.time)) >= gameMin * 60) break;
        await page.waitForTimeout(2000);
      }
      res.gameMin = (await g.run(() => window.__frontline.session().game.time)) / 60;
      res.units = await g.run(() => window.__frontline.session().game.units.filter((u) => u.alive).length);
      await g.run(() => {
        const s = window.__frontline.session();
        s.camera.iso = true;
        s.loop.speed = 1;
      });
      // Bildrate: Basis (eigene Truppen) und Wald
      const base = await g.run(() => {
        const s = window.__frontline.session();
        const own = s.game.units.filter((u) => u.alive && u.team === 0 && !u.def.air);
        const b = s.game.buildings.find((b) => b.main && b.team === 0);
        if (!own.length) return { x: b.x, y: b.y };
        return { x: own.reduce((a, u) => a + u.x, 0) / own.length, y: own.reduce((a, u) => a + u.y, 0) / own.length };
      });
      await look(g, base.x, base.y, 0, 1);
      res.fps.Basis = await mvpFps(g, fpsMs);
      await g.run(() => (window.__frontline.session().loop.paused = true));
      await mvpPair(g, dir, dev, `basis-${Math.round(res.gameMin)}min`);
      for (const [label, three, level] of [['Iso', false, 'off'], ['3D Mittel', true, 'mid']]) {
        await g.run(({ three, level }) => {
          const s = window.__frontline.session();
          s.camera.three = three;
          s.renderer.setShadows(level);
        }, { three, level });
        res.passes[label] = await timePasses(g, frames);
      }
      await look(g, FOREST.x, FOREST.y, 0, 1);
      res.fps.Wald = await mvpFps(g, fpsMs);
    } finally {
      errors.push(...g.errors.map((e) => `${dev}: ${e}`));
      await g.close();
    }
    // --- Winter: Fotos und Bildrate am Start ---
    g = await openGame({ seed: 7, query: 'iso=1&three=1&shadows=mid&weather=winter&wx=snow', device: dev, out });
    try {
      const hq = await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        const b = s.game.buildings.find((b) => b.main && b.team === 0);
        return { x: b.x, y: b.y };
      });
      await look(g, hq.x + 150, hq.y + 100);
      await mvpPair(g, dir, dev, 'winter');
      await look(g, FOREST.x, FOREST.y, 0, 1);
      await mvpPair(g, dir, dev, 'winter-wald');
      await look(g, hq.x + 150, hq.y + 100);
      res.fps.Winter = await mvpFps(g, fpsMs);
    } finally {
      errors.push(...g.errors.map((e) => `${dev}: ${e}`));
      await g.close();
    }
    // Ausgabe je Gerät
    const o = res.order;
    console.log(`MVP ${dev}: Auswahl ${o.selected ? 'ok' : 'FEHLT'}, Befehl ${o.moved >= 20 ? `ok (${o.moved.toFixed(0)} px gefahren)` : 'FEHLT'}; Partie ${res.gameMin.toFixed(1)} Spielminuten, ${res.units} Einheiten`);
    for (const n of res.notes) console.log(`  Hinweis: ${n}`);
    console.log(`  ${'Bilder/s (langsamstes ms)'.padEnd(26)}${['Iso', '3D Aus', '3D Mittel', '3D Hoch'].map((l) => l.padStart(14)).join('')}`);
    for (const [scene, row] of Object.entries(res.fps)) {
      console.log(`  ${scene.padEnd(26)}${Object.values(row).map((r) => `${r.fps.toFixed(1)} (${r.worst.toFixed(0)})`.padStart(14)).join('')}`);
    }
    for (const [label, p] of Object.entries(res.passes)) {
      console.log(`  ms je Durchlauf ${label}: ${Object.entries(p).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
    }
  }
  await writeFile(join(dir, 'messung.json'), JSON.stringify(report, null, 1));
  return report;
}

try {
  if (!only || only === 'kamera') await camera();
  if (!only || only === 'vergleich') await compare();
  if (!only || only === 'speicher') await memory();
  if (!only || only === 'messung') await measure();
  if (!only || only === 'schatten') await shadows();
  if (!only || only === 'baeume') await trees();
  if (!only || only === 'baukasten') await baukasten();
  if (!only || only === 'stadt') await city();
  if (only === 'mvp') await mvp();
} catch (e) {
  console.error(`Abbruch: ${e.message}`);
  fail++;
}
if (errors.length) console.error(`Browserfehler:\n${errors.join('\n')}`);
if (fail || errors.length) {
  console.error(`smoke-3d: ${fail} Prüfungen fehlgeschlagen, ${errors.length} Browserfehler`);
  process.exit(1);
}
console.log(`smoke-3d: alles in Ordnung, keine Browserfehler; Fotos in ${out}/`);
