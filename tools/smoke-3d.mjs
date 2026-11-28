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
//    Dazu (Paket „Großbauten 3D“) ein Ausschnitt mit den meisten Großbauten samt Hauptstadt (Fotos grossbau-*), Messung gemalt / ohne
//    Großbauten 3D / alles 3D. Der Baukasten-Teil fotografiert auch alle Großbauten (--what grossbau).
// 10. Props (Paket „Props 3D“, --only props): Zäune, Mauern, Militär, Industrie, Zivil, Autos, Bänke, Ballen, Kisten gemalt neben 3D: echte
//    Karten (Seed 3, 7; Land und Stadt, 0 und 10 Spielminuten) und Schauraum mit jeder Art (4 Drehungen, Winter, Nacht); Zählung
//    „x/x Props in 3D“ (Fehler bei übrigen Billboards), Draw-Calls, Dreiecke und Zeit „Objekte“ gemalt gegen 3D. Fotos <out>/props/.
// 12. Fliegerhorst (Paket „Fliegerhorst 3D“): im Baukasten-Teil (--what fliegerhorst) je Art (Stellplatz, Tower, Kerosintank, Munitionslager) und Stufe gemalt + 4 Drehungen
//    je Stimmung und mit Teamfarben (<out>/baukasten/fliegerhorst-*); im Stadt-Teil ein Ausschnitt mit dem Fliegerhorst (seed3-fliegerhorst-*) und die Messung gemalt / 3D
//    (Draw-Calls, Dreiecke, Zeit „Objekte“, renderer.airbase3dOn).
// 11. Militärgebäude (Paket „Militärgebäude 3D“): im Baukasten-Teil (--what mil) alle Arten, Mauermasken, Tore, Baustellen in Stufen, beschädigt und
//    Teamfarben gemalt neben 3D (<out>/baukasten/mil-*); im Stadt-Teil ein Ausschnitt mit den meisten Militärgebäuden, ein ausgebautes Haus und
//    die Messung gemalt / 3D (Draw-Calls, Dreiecke, Zeit „Objekte“, renderer.mil3dOn).
// 13. Baustellen und Ruinen (Paket „Baustellen und Ruinen 3D“): im Baukasten-Teil (--what baustelle) je Größe n = 1 bis 3 ein Bogen mit allen 5 Bauabschnitten (gemalt + 4 Drehungen,
//    Sommer, Winter, Nacht: <out>/baukasten/baustelle-*), (--what schutt) Schutt je Art, ausgebrannt, Wand (schutt-*); Teil ruinen (--only ruinen [--sitemin 7] [--wreckmin 18]):
//    Spielszenen mit vielen Baustellen bzw. Gebäude-Wracks Iso | 3D, Messung gemalt / 3D (renderer.site3dOn, ruin3dOn) und einsinkendes Wrack (<out>/ruinen/).
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-3d.mjs [--out .smoke/3d] [--scale 2] [--minutes 5] [--frames 8]
//                                 [--only kamera|vergleich|speicher|messung|schatten|baeume|baukasten|stadt|natur|karte|props|ruinen|bruecke|freikamera|wege|wetter|mvp] [--citymin 10]
//                                 [--what schau|karte] (nur mit props: nur Schauraum oder nur echte Karten)
//                                 [--what werke|haeuser|grossbau|mil|fliegerhorst|baustelle|schutt|kartenstadt] (nur mit baukasten: nur Werke, Stadthäuser, Großbauten, Militärgebäude, Fliegerhorst, Baustellen, Schutt oder Kartenstadt)
// 11. Kartenstadt (Paket „Kartenstadt 3D“): im Teil baukasten (--what kartenstadt) jede Art der Kartenstadt gemalt | 3D (4 Drehungen, Stimmungen);
//    Teil karte (--only karte [--karte seed3,seed7,fest]): Ausschnitte echter Karten (Seed 3, 7, East Europe Railway) Iso | 3D (Iso erst, wenn alle gemalten
//    Bilder fertig sind), gleiche Menge Gebäude Iso und 3D, Messung gemalt gegen 3D (<out>/karte/).
// 12. Brücken (Paket „Brücken 3D“, --only bruecke [--karte seed3,seed7,fest]): Brücken und Furtstangen gemalt | 3D (4 Drehungen, Nacht, Zoom, beschädigt,
//    zerstört, Wiederaufbau, Furt, Eisenbahnbrücke der festen Karte), Einheiten auf der Fahrbahn, gleiche Menge, Messung gemalt gegen 3D (<out>/bruecke/).
// 13. Freie Kamera (Paket „Freie Kamera“, --only freikamera): 8 Drehwinkel × Neigung 30°/45°/60°: Prüfwürfel unter 1 px, Fotos der Spielszene,
//    Klick, Ziehrahmen und Fahrbefehl mit echter Maus, gehaltene Taste dreht, Umschalt + Mausrad neigt (<out>/freikamera/).
// 14. Straßen und Wege (Paket „Straßen und Wege 3D“, --only wege [--karte seed3,seed7,fest] [--teile hang,gleis,feld,stadt,bruecke,pflaster,aenderung,messung]):
//    Stadtstraßen, Feldwege, Gleise, Felder, Pflaster als Bodenschicht gemalt | 3D (4 Drehungen, Hang, Nacht, Winter, Zoom), Treffer der Schicht (eingefärbt),
//    Neumalen nur bei Änderung, Messung gemalt gegen 3D (<out>/wege/).
// 15. Wetter (Paket „Wetter 3D“, --only wetter): Regen, Schnee und Nebel gemalt | 3D (4 Drehungen, Nacht, Zoom, mit Kriegsnebel), Zähler der Teilchen und
//    Nebellagen, Tiefentest, Wirkung gegen das Bild ohne Wetter, Messung gemalt gegen 3D (Zeit „Wetter“, Draw-Calls) (<out>/wetter/).
// 16. Tag und Nacht (Paket „Tag und Nacht 3D“, --only tagnacht [--citymin 6]): Morgen, Mittag, Abend, Nacht Iso | 3D an Stadt, Kartenstadt, Laterne;
//    Sonnenhöhe, Lichter an gegen aus, Kriegsnebel ohne Licht, Messung „Lichter“ (<out>/tagnacht/).
// Ohne --only laufen die Teile 1 bis 6, 8 und 9 (mit Kartenstadt), natur, karte, props, bruecke, freikamera, wege, wetter und tagnacht; „mvp“ nur ausdrücklich.
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
        // Großbauten, Rathaus und Viertel (Paket „Großbauten 3D“) sind echte 3D-Körper und weichen vom gemalten Bild ab (Prüfteile baukasten, stadt):
        // hier gemalt, damit der Vergleich die Billboard-Brücke prüft
        await g.run(() => {
          const s = window.__frontline.session();
          s.loop.paused = true;
          s.renderer.big3dOn = false;
          s.renderer.mil3dOn = false; // ebenso Militärgebäude und Ausbauten (Paket „Militärgebäude 3D“)
          s.renderer.weather3dOn = false; // ebenso das Wetter (Paket „Wetter 3D“: Flocken sind Teilchen, nicht dieselben wie gemalt)
        });
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
      const { drawUniversityIso } = await import('/js/render/university.js');
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
      // Großbau gemalt und in 3D (Paket „Großbauten 3D“): Art 'barracks' | 'factory' | 'warehouse' | 'station' | 'uni' | 'hall' | 'quarter'.
      // Gemalt wie im Spiel (Körper einzeln nach Tiefe, Universität, Rathaus, Gruppen des Viertels), ohne Boden; bei lv < 4 Stufe,
      // beim Viertel lv = Team (Drehung der Anlage). Im 3D-Bild liegen die gemalten Bäume und Ausstellungsstücke obenauf (Billboards).
      const { ROT } = await import('/js/render/camera.js');
      const { bigPlan, partFoot } = await import('/js/render/bigbuild.js');
      const { drawTownBuilding } = await import('/js/render/isobuild.js');
      const { drawCityHallIso } = await import('/js/render/cityhall.js');
      const { quarterItems, drawQuarterIso } = await import('/js/render/govquarter.js');
      const big3 = await import('/js/render3d/bigbuild3d.js');
      const gov3 = await import('/js/render3d/gov3d.js');
      const ab3 = await import('/js/render3d/airbase3d.js'); // Fliegerhorst (Paket „Fliegerhorst 3D“)
      const site3 = await import('/js/render3d/site3d.js'); // Baustellen und Schutt (Paket „Baustellen und Ruinen 3D“)
      const rub3 = await import('/js/render3d/rubble3d.js');
      const { drawSiteIso, siteWall } = await import('/js/render/citysite.js');
      const { drawRubble } = await import('/js/render/isobuild.js');
      const { KIND_COLOR: CITY_COLORS } = await import('/js/data/citykinds.js');
      // Militärgebäude (Paket „Militärgebäude 3D“): kind 'mil' mit mil = { type, v, dmg } (v wie milVariant: Mauermaske, 'u'/'v'/'Lu+' …, Dachaufbau, 's0' … 's8');
      // gemalt über drawMilIso (Drehung 0), die Nachbarn der Mauer oder des Tors stellt setMilWalls aus der Variante nach.
      const mil3 = await import('/js/render3d/mil3d.js');
      const { drawMilIso, setMilWalls } = await import('/js/render/milbuild.js');
      const { BUILDINGS } = await import('/js/data/buildings.js');
      const milItem = ({ type, v, dmg }) => {
        const cx = X / 32 - BUILDINGS[type].w / 2;
        const cy = Y / 32 - BUILDINGS[type].w / 2;
        const site = /^s\d$/.test(v);
        const b = { type, team: 0, cx, cy, w: BUILDINGS[type].w, h: BUILDINGS[type].w, x: X, y: Y, alive: true, built: !site, progress: site ? (Number(v.slice(1)) + 0.5) / 8 : 1, hp: dmg ? 10 : 100, maxHp: 100, main: false };
        if (type === 'tower' && v !== '-' && !site) b.roof = v;
        const others = [];
        const nb = (dx, dy, o = {}) => others.push({ type: o.type ?? 'wall', alive: true, built: true, cx: cx + dx, cy: cy + dy, ...o });
        if (type === 'wall') for (const [bit, dx, dy] of [[1, 1, 0], [2, 0, 1], [4, -1, 0], [8, 0, -1]]) if (Number(v) & bit) nb(dx, dy);
        if (type === 'gate' && v === 'v') nb(0, 1);
        if (type === 'gate' && v[0] === 'L') {
          const lu = v[1] === 'u';
          const pos = v[2] === '+';
          Object.assign(b, { leaf: pos ? 0 : 1, axis: lu ? 'x' : 'y' });
          nb(lu ? (pos ? 1 : -1) : 0, lu ? 0 : (pos ? 1 : -1), { type: 'gate', leaf: pos ? 1 : 0, axis: lu ? 'x' : 'y' });
        }
        return { b, all: [b, ...others] };
      };
      window.__kitBig = ({ kind, lv, color, season, night, rots, mil, ab, site, rub, W: BW = 320, H: BH = 270 }) => {
        const bk = ['barracks', 'factory', 'warehouse', 'station'].includes(kind);
        const isAb = kind === 'ab'; // Fliegerhorst (Paket „Fliegerhorst 3D“): ab = { k: 'stand' | 'atc' | 'ktank' | 'mdepot' }, undurchsichtiger Satz und Glas
        const glassGeo = isAb ? ab3.airbaseGlass(ab.k, lv) : null;
        // Baustelle (Paket „Baustellen und Ruinen 3D“): site = { ck, n, step, variant } (Zonen- und Wandfarbe wie cityBuildings); Schutt: rub = { kind, w, h, burnt, v, hgt } (v = Variante 0 … 15)
        const siteB = kind === 'site' ? { kind: 'site', x: X, y: Y, ck: site.ck, n: site.n, step: site.step, variant: site.variant, zone: CITY_COLORS[site.ck] ?? '#8a8f86', wall: siteWall(site.ck, site.variant) } : null;
        const rubB = kind === 'rubble' ? { x: X, y: Y, w: rub.w, h: rub.h, kind: rub.kind, hgt: rub.hgt } : null;
        const geo = kind === 'site' ? site3.siteGeometry(siteB) : kind === 'rubble' ? rub3.rubbleGeometry(rubB, !!rub.burnt, rub.v) : isAb ? ab3.airbaseGeometry(ab.k, lv) : kind === 'mil' ? mil3.milGeometry(mil.type, mil.v, mil.dmg ? 1 : 0) : bk ? big3.bigGeometry(kind, lv) : kind === 'uni' ? big3.uniGeometry(lv) : kind === 'hall' ? gov3.hallGeometry() : gov3.quarterGeometry(lv, 0b111101111);
        // Zoom und Anker aus den Ecken der Geometrie in allen Drehungen (Bild: x = (u' − v')·K, y = (u' + v')·K/2 − h)
        const poss = [geo, glassGeo].filter(Boolean).map((q) => q.getAttribute('position'));
        const ext = (rot) => {
          const m = ROT[rot];
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (const pos of poss) {
            for (let i = 0; i < pos.count; i++) {
              const u = m[0] * pos.getX(i) + m[1] * pos.getY(i);
              const v = m[2] * pos.getX(i) + m[3] * pos.getY(i);
              const x = (u - v) * Math.SQRT1_2;
              const y = (u + v) * Math.SQRT1_2 * 0.5 - pos.getZ(i);
              x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            }
          }
          return [x0, x1, y0, y1];
        };
        const all = [0, 1, 2, 3].map(ext);
        const ZOOM = Math.min(2.2, (BW - 16) / Math.max(...all.map((e) => e[1] - e[0])), (BH - 16) / Math.max(...all.map((e) => e[3] - e[2])));
        const cam = new Camera(2000, 2000);
        cam.iso = true;
        cam.resize(BW, BH);
        const aim = (rot) => {
          const [x0, x1, y0, y1] = all[rot];
          cam.rot = rot;
          cam.zoom = ZOOM;
          cam.x = X;
          cam.y = Y;
          const p = cam.screenToWorldFlat(BW / 2 + ((x0 + x1) / 2) * ZOOM, BH / 2 + ((y0 + y1) / 2) * ZOOM); // Anker so, dass die Mitte der Ecken im Feld liegt
          cam.x = p.x;
          cam.y = p.y;
        };
        const mood = night ? 'night' : null;
        const capital = { x: X, y: Y, team: Math.max(0, Math.min(3, lv)), cx: X / 32 - 1.5, cy: Y / 32 - 1.5, w: 3, h: 3 };
        // gemalt: shape = nur Körper, die auch 3D werden (Umriss), full = mit Bäumen und Ausstellungsstücken
        const paint = (pc, shapeOnly) => {
          if (siteB) drawSiteIso(pc, cam, siteB, season);
          else if (rubB) drawRubble(pc, cam, rubB, !!rub.burnt, rub.v);
          else if (isAb) {
            // alle Körper der Anlage (airbaseBodies über bigPlan, 2 × 2 Zellen) nach Tiefe wie im Spiel; der Boden bleibt weg (gemalt im Durchlauf „Boden“)
            const items = bigPlan(ab.k, lv, X, Y, 128, 0).bodies.map((p) => ({ ...partFoot(p), kind: 'bigpart', part: p, color, damage: 0 }));
            items.sort((a, b) => cam.depth(a.x, a.y) - cam.depth(b.x, b.y));
            for (const it of items) drawTownBuilding(pc, cam, it, season);
          } else if (kind === 'mil') {
            const it = milItem(mil);
            setMilWalls(it.all);
            drawMilIso(pc, cam, it.b, color);
          } else if (bk) {
            const plan = bigPlan(kind, lv, X, Y, 400, 0);
            const items = plan.bodies.filter((p) => !shapeOnly || big3.isBig3dPart(p)).map((p) => ({ ...partFoot(p), kind: 'bigpart', part: p, color, damage: 0 }));
            items.sort((a, b) => cam.depth(a.x, a.y) - cam.depth(b.x, b.y));
            for (const it of items) drawTownBuilding(pc, cam, it, season);
          } else if (kind === 'uni') drawUniversityIso(pc, cam, { x: X, y: Y, kind: 'uni', level: lv, color, damage: 0 });
          else if (kind === 'hall') drawCityHallIso(pc, cam, { x: X, y: Y, hp: 1, maxHp: 1 }, color);
          else {
            const items = quarterItems(null, capital).sort((a, b) => cam.depth(a.x, a.y) - cam.depth(b.x, b.y));
            for (const it of items) drawQuarterIso(pc, cam, it, color, season);
          }
        };
        const paintFrame = (c, shapeOnly) => {
          const pc = c.getContext('2d');
          for (let i = 0; i < 16; i++) {
            spriteFrame(DPR);
            pc.setTransform(DPR, 0, 0, DPR, 0, 0);
            pc.fillStyle = BG;
            pc.fillRect(0, 0, BW, BH);
            setRoofSnow(season === 'winter');
            paint(pc, shapeOnly);
            setRoofSnow(false);
            if (!spriteMissed()) break;
          }
        };
        const painted = canvas(BW, BH);
        const shape = canvas(BW, BH);
        aim(0);
        paintFrame(painted, false);
        paintFrame(shape, true);
        gl.setSize(BW, BH, false);
        sun.setLevel('high');
        sun.setMood(mood);
        const mesh = kit.kitTeamMesh(geo, mat, color);
        mesh.position.set(X, Y, 0);
        root.add(mesh);
        const gmat = glassGeo ? kit.makeKitMaterial({ opacity: ab3.airbaseAlpha(ab.k, lv) }) : null;
        const gmesh = glassGeo ? kit.kitTeamMesh(glassGeo, gmat, color) : null;
        if (gmesh) {
          gmesh.castShadow = false; // wie Town3D: durchscheinende Teile werfen keinen Schatten
          gmesh.layers.set(0);
          gmesh.renderOrder = 5;
          gmesh.position.set(X, Y, 0);
          root.add(gmesh);
        }
        // Jet-Attrappe (ab.jets): zwei dunkle Rümpfe mit Tragflächen, Nase nach Norden, auf den Plätzen des Stellplatzes: zeigt, dass der Jet durch Dach und Röhre zu sehen bleibt
        let jets = null;
        if (isAb && ab.jets) {
          const jk = new kit.Kit3D();
          for (const x of [-25.6, 25.6]) {
            jk.box(x - 3, x + 3, -22, 18, 3, 9, '#59636d', '#6f7a85', { mat: null });
            jk.box(x - 14, x + 14, -2, 10, 4, 5.4, '#4b545d', '#5f6a74', { mat: null });
            jk.box(x - 6, x + 6, 12, 18, 3, 9, '#4b545d', '#5f6a74', { mat: null });
          }
          jets = kit.kitMesh(jk.geometry(), mat);
          jets.position.set(X, Y, 0);
          root.add(jets);
        }
        const frame = (o) => {
          kit.setKitFrame(mat, o);
          if (gmat) kit.setKitFrame(gmat, o);
        };
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
          frame({ light, snow: season === 'winter' ? 1 : 0, night: night ? 1 : 0, shade: BALANCE.shadows3d.opacity[mood ?? 'none'] });
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
          const c = canvas(BW, BH);
          c.getContext('2d').drawImage(cv, 0, 0);
          panels.push(c);
        }
        sun.setLevel('off');
        aim(0);
        syncIsoCamera(cam3, cam);
        frame({ light: light0(0), snow: season === 'winter' ? 1 : 0, night: 0, shade: 0.4 });
        gl.render(scene, cam3);
        const flat0 = canvas(BW, BH);
        flat0.getContext('2d').drawImage(cv, 0, 0);
        root.remove(mesh);
        if (gmesh) root.remove(gmesh);
        if (jets) root.remove(jets);
        const boxes = { painted: bbox(shape), three: bbox(flat0) };
        if (mood) {
          for (const c of [painted, ...panels]) {
            const x = c.getContext('2d');
            x.setTransform(DPR, 0, 0, DPR, 0, 0);
            drawMood(x, mood, BW, BH);
          }
        }
        return { painted, panels, W: BW, H: BH, DPR, tris: (geo.getAttribute('position').count + (glassGeo ? glassGeo.getAttribute('position').count : 0)) / 3, calls, boxes, tex: kit.kitTexturesReady() };
      };
      /** Bogen aus Zeilen von Feldern (Leinwände) mit Beschriftung je Feld, als PNG-Daten-URL. */
      window.__kitSheet = (rows, RH = 290, FW = W) => {
        const gap = 6;
        const cols = Math.max(...rows.map((r) => r.length));
        const sheet = document.createElement('canvas');
        sheet.width = (cols * FW + (cols - 1) * gap) * DPR;
        sheet.height = (rows.length * RH + (rows.length - 1) * gap) * DPR;
        const sc = sheet.getContext('2d');
        sc.fillStyle = '#111';
        sc.fillRect(0, 0, sheet.width, sheet.height);
        rows.forEach((row, j) => {
          row.forEach(([c, t], i) => {
            sc.setTransform(DPR, 0, 0, DPR, i * (FW + gap) * DPR, j * (RH + gap) * DPR);
            sc.drawImage(c, 0, 0, FW, RH);
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
    for (const ck of what && what !== 'haeuser' ? [] : KINDS) {
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
    for (const kind of what && what !== 'werke' ? [] : WK) {
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
    // Großbauten (Paket „Großbauten 3D“): je Art und Stimmung ein Bogen mit Stufe 1 bis 3 (gemalt + 4 Drehungen); Rathaus eine Zeile, das
    // Viertel eine Zeile je Team (Drehung der Anlage); je Art ein Bogen mit den Teamfarben (gemalt | 3D, Drehung 0)
    const BK = [['barracks', [1, 2, 3]], ['factory', [1, 2, 3]], ['warehouse', [1, 2, 3]], ['station', [1, 2, 3]], ['uni', [1, 2, 3]], ['hall', [1]], ['quarter', [0, 1, 2, 3]]];
    const btris = {};
    for (const [kind, levels] of what && what !== 'grossbau' ? [] : BK) {
      const lab = (lv) => (kind === 'quarter' ? `Team ${lv}` : kind === 'hall' ? '' : `${lv}`);
      for (const season of ['summer', 'winter']) {
        for (const night of [false, true]) {
          const name = `grossbau-${kind}-${season}-${night ? 'nacht' : 'tag'}`;
          const res = await g.run(({ kind, levels, season, night, color }) => {
            const rows = [];
            const stats = [];
            for (const lv of levels) {
              const r = window.__kitBig({ kind, lv, color, season, night, rots: [0, 1, 2, 3] });
              rows.push([[r.painted, `${kind}${lv || ''} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
              stats.push({ lv, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
            }
            return { url: window.__kitSheet(rows, 270, 320), stats };
          }, { kind, levels, season, night, color: TEAMS[0] });
          await save(name, res.url);
          for (const s of res.stats) {
            const [p, t] = [s.boxes.painted, s.boxes.three];
            const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
            btris[`${kind}${lab(s.lv)}`] = s.tris;
            const bad = !s.tex || t[2] < 0 || (!night && dev > BOX_TOL) || s.calls !== 1;
            if (bad) fail++;
            if (bad || (season === 'summer' && !night)) {
              console.log(`Großbau ${kind}${lab(s.lv)} ${season} ${night ? 'Nacht' : 'Tag'}: ${s.tris} Dreiecke, ${s.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
            }
          }
        }
      }
      if (kind === 'quarter') continue; // Teamfarbe zeigt der Bogen je Team schon
      const res = await g.run(({ kind, levels, teams }) => {
        const rows = [];
        for (const lv of levels) {
          const row = [];
          for (const color of teams) {
            const r = window.__kitBig({ kind, lv, color, season: 'summer', night: false, rots: [0], W: 240, H: 230 });
            row.push([r.painted, `${kind}${lv} gemalt`], [r.panels[0], `3D`]);
          }
          rows.push(row);
        }
        return window.__kitSheet(rows, 230, 240);
      }, { kind, levels, teams: TEAMS });
      await save(`grossbau-${kind}-teams`, res);
    }
    // Militärgebäude (Paket „Militärgebäude 3D“, --what mil): je Art ein Bogen mit allen Varianten (gemalt + 4 Drehungen) je Jahreszeit und
    // Tageszeit, Baustellen in 5 Stufen (Sommer Tag, Winter Nacht), beschädigt (Sommer Tag), dazu ein Bogen mit den vier Teamfarben
    const MK = [
      ['fob', ['']], ['mortar', ['']], ['aa', ['']], ['phalanx', ['']], ['drill', ['']], ['tower', ['-', 'mortar', 'flak', 'sam']],
      ['wall', ['0', '1', '3', '5', '7', '10', '13', '15']], ['gate', ['u', 'v', 'Lu+', 'Lu-', 'Lv+', 'Lv-']],
    ];
    const mtris = {};
    for (const [type, vs] of what && what !== 'mil' ? [] : MK) {
      const rowsOf = (vs2, season, night, extra = {}) => g.run(({ type, vs, season, night, color, extra }) => {
        const rows = [];
        const stats = [];
        for (const v of vs) {
          const r = window.__kitBig({ kind: 'mil', mil: { type, v, ...extra }, color, season, night, rots: [0, 1, 2, 3], W: 250, H: 300 });
          rows.push([[r.painted, `${type} ${v} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
          stats.push({ v, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
        }
        return { url: window.__kitSheet(rows, 300, 250), stats };
      }, { type, vs: vs2, season, night, color: TEAMS[0], extra });
      const sizeCheck = (res, label, season, night) => {
        for (const s of res.stats) {
          const [p, t] = [s.boxes.painted, s.boxes.three];
          // Baustelle: das gemalte Bild schneidet Zaun und Kran oben ab (Bildmaß SITE_TALL), 3D ist dort höher: nur die übrigen Ränder zählen
          const dev = Math.max(...p.map((v, i) => (i === 1 && label.startsWith('Baustelle') && t[1] <= p[1] ? 0 : Math.abs(v - t[i]))));
          mtris[`${type}${s.v ? ' ' + s.v : ''}`] = s.tris;
          const bad = !s.tex || t[2] < 0 || (!night && dev > BOX_TOL) || s.calls !== 1;
          if (bad) fail++;
          if (bad || (season === 'summer' && !night)) console.log(`Militär ${label}${s.v ? ' ' + s.v : ''} ${season} ${night ? 'Nacht' : 'Tag'}: ${s.tris} Dreiecke, ${s.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
        }
      };
      for (const season of ['summer', 'winter']) {
        for (const night of [false, true]) {
          const res = await rowsOf(vs, season, night);
          await save(`mil-${type}-${season}-${night ? 'nacht' : 'tag'}`, res.url);
          sizeCheck(res, type, season, night);
        }
      }
      for (const [season, night] of [['summer', false], ['winter', true]]) {
        const res = await rowsOf(['s0', 's2', 's4', 's6', 's8'], season, night);
        await save(`mil-bau-${type}-${season}-${night ? 'nacht' : 'tag'}`, res.url);
        sizeCheck(res, `Baustelle ${type}`, season, night);
      }
      const dm = await rowsOf([vs[0]], 'summer', false, { dmg: true });
      await save(`mil-${type}-beschaedigt`, dm.url);
      const res = await g.run(({ type, vs, teams }) => {
        const row = [];
        for (const color of teams) {
          const r = window.__kitBig({ kind: 'mil', mil: { type, v: vs[vs.length > 3 ? 3 : 0] }, color, season: 'summer', night: false, rots: [0], W: 240, H: 280 });
          row.push([r.painted, `${type} ${color} gemalt`], [r.panels[0], '3D']);
        }
        return window.__kitSheet([row], 280, 240);
      }, { type, vs, teams: TEAMS });
      await save(`mil-${type}-teams`, res);
    }
    // Fliegerhorst (Paket „Fliegerhorst 3D“, --what fliegerhorst): je Art und Stimmung ein Bogen mit Stufe 1 bis 3 (gemalt + 4 Drehungen), je Art ein Bogen
    // mit den Teamfarben; Draw-Calls: einer, mit Glas (Überdachung Stufe 2, Shelter Stufe 3) zwei. Gemalt zeichnet Schatten und Konturen mit, daher die weitere Toleranz.
    const AK = [['stand', [1, 2, 3]], ['atc', [1, 2, 3]], ['ktank', [1, 2, 3]], ['mdepot', [1, 2, 3]]];
    const atris = {};
    for (const [kind, levels] of what && what !== 'fliegerhorst' ? [] : AK) {
      for (const season of ['summer', 'winter']) {
        for (const night of [false, true]) {
          const res = await g.run(({ kind, levels, season, night, color }) => {
            const rows = [];
            const stats = [];
            for (const lv of levels) {
              const r = window.__kitBig({ kind: 'ab', ab: { k: kind }, lv, color, season, night, rots: [0, 1, 2, 3], W: 300, H: 300 });
              rows.push([[r.painted, `${kind}${lv} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
              stats.push({ lv, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
            }
            return { url: window.__kitSheet(rows, 300, 300), stats };
          }, { kind, levels, season, night, color: TEAMS[0] });
          await save(`fliegerhorst-${kind}-${season}-${night ? 'nacht' : 'tag'}`, res.url);
          for (const s of res.stats) {
            const [p, t] = [s.boxes.painted, s.boxes.three];
            const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
            const want = kind === 'stand' && s.lv >= 2 ? 2 : 1;
            atris[`${kind}${s.lv}`] = s.tris;
            const bad = !s.tex || t[2] < 0 || (!night && dev > BOX_TOL + 10) || s.calls !== want;
            if (bad) fail++;
            if (bad || (season === 'summer' && !night)) console.log(`Fliegerhorst ${kind}${s.lv} ${season} ${night ? 'Nacht' : 'Tag'}: ${s.tris} Dreiecke, ${s.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
          }
        }
      }
      if (kind === 'stand' && (!what || what === 'fliegerhorst')) {
        const jet = await g.run(({ color }) => {
          const rows = [];
          for (const lv of [2, 3]) {
            const r = window.__kitBig({ kind: 'ab', ab: { k: 'stand', jets: true }, lv, color, season: 'summer', night: false, rots: [0, 1, 2, 3], W: 300, H: 300 });
            rows.push([[r.painted, `stand${lv} gemalt`], ...r.panels.map((c, i) => [c, `3D mit Jets, Drehung ${i}`])]);
          }
          return window.__kitSheet(rows, 300, 300);
        }, { color: TEAMS[0] });
        await save('fliegerhorst-stand-jets', jet);
      }
      const res = await g.run(({ kind, levels, teams }) => {
        const rows = [];
        for (const lv of levels) {
          const row = [];
          for (const color of teams) {
            const r = window.__kitBig({ kind: 'ab', ab: { k: kind }, lv, color, season: 'summer', night: false, rots: [0], W: 240, H: 240 });
            row.push([r.painted, `${kind}${lv} gemalt`], [r.panels[0], '3D']);
          }
          rows.push(row);
        }
        return window.__kitSheet(rows, 240, 240);
      }, { kind, levels, teams: TEAMS });
      await save(`fliegerhorst-${kind}-teams`, res);
    }
    // Baustellen (Paket „Baustellen und Ruinen 3D“, --what baustelle): je Größe n ein Bogen mit allen 5 Bauabschnitten (gemalt + 4 Drehungen), Sommer Tag, Winter Tag, Sommer Nacht;
    // dazu je Größe eine zweite Zellenart bzw. Variante 2 (gespiegelte Lage der Geräte). Gemalt schneidet das Bild Zaun und Kran oben ab: 3D darf dort höher sein.
    const SITES = [[1, 'res', 0], [1, 'com', 2], [2, 'steel', 0], [2, 'kero', 2], [3, 'uni', 0]];
    const strisS = {};
    for (const [n, ck, variant] of what && what !== 'baustelle' ? [] : SITES) {
      for (const [season, night] of variant === 0 ? [['summer', false], ['winter', false], ['summer', true]] : [['summer', false]]) {
        const res = await g.run(({ n, ck, variant, season, night, color }) => {
          const rows = [];
          const stats = [];
          for (const step of [0, 1, 2, 3, 4]) {
            const r = window.__kitBig({ kind: 'site', site: { ck, n, step, variant }, lv: 1, color, season, night, rots: [0, 1, 2, 3], W: 260, H: 300 });
            rows.push([[r.painted, `${ck} n=${n} Abschnitt ${step} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
            stats.push({ step, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
          }
          return { url: window.__kitSheet(rows, 300, 260), stats };
        }, { n, ck, variant, season, night, color: TEAMS[0] });
        await save(`baustelle-n${n}-${ck}-${season}-${night ? 'nacht' : 'tag'}`, res.url);
        for (const s2 of res.stats) {
          const [p, t] = [s2.boxes.painted, s2.boxes.three];
          const dev = Math.max(...p.map((v, i) => (i === 1 && t[1] <= p[1] ? 0 : Math.abs(v - t[i]))));
          strisS[`n${n}-${ck}-${s2.step}`] = s2.tris;
          const bad = !s2.tex || t[2] < 0 || (!night && dev > BOX_TOL + 12) || s2.calls !== 1;
          if (bad) fail++;
          if (bad || (season === 'summer' && !night)) console.log(`Baustelle ${ck} n=${n} Abschnitt ${s2.step} ${season} ${night ? 'Nacht' : 'Tag'}: ${s2.tris} Dreiecke, ${s2.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s2.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
        }
      }
    }
    if (Object.keys(strisS).length) console.log(`Baukasten: Dreiecke je Baustelle ${Object.entries(strisS).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    // Schutt (--what schutt): je Art (Haus, Halle, Fabrik, Bahnhof, Wrack 64 und 96 ausgebrannt, Mauer) ein Bogen mit 4 Varianten (0, 5, 10, 15; gemalt + 4 Drehungen), Tag und Nacht,
    // dazu alle 16 Varianten des Wracks 96 (gemalt | 3D). Gemalt und 3D zeigen dieselbe Variante (rubblePlan).
    const RUBBLE = [['haus', 'house', 64, 64, false, undefined], ['halle', 'hall', 64, 64, false, undefined], ['fabrik', 'factory', 96, 96, false, undefined], ['bahnhof', 'station', 64, 64, false, undefined],
      ['wrack64', 'wreck', 64, 64, true, 36], ['wrack96', 'wreck', 96, 96, true, 36], ['mauer', 'wall', 32, 32, false, 18]];
    const rtris = {};
    for (const [name, kind, w, h, burnt, hgt] of what && what !== 'schutt' ? [] : RUBBLE) {
      for (const night of [false, true]) {
        const res = await g.run(({ kind, w, h, burnt, hgt, night, color, name }) => {
          const rows = [];
          const stats = [];
          for (const v of [0, 5, 10, 15]) {
            const r = window.__kitBig({ kind: 'rubble', rub: { kind, w, h, burnt, hgt, v }, lv: 1, color, season: 'summer', night, rots: [0, 1, 2, 3], W: 260, H: 260 });
            rows.push([[r.painted, `${name} Variante ${v} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]);
            stats.push({ v, tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex });
          }
          return { url: window.__kitSheet(rows, 260, 260), stats };
        }, { kind, w, h, burnt, hgt, night, color: TEAMS[0], name });
        await save(`schutt-${name}-${night ? 'nacht' : 'tag'}`, res.url);
        for (const s2 of res.stats) {
          const [p, t] = [s2.boxes.painted, s2.boxes.three];
          const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
          rtris[`${name}-${s2.v}`] = s2.tris;
          const bad = !s2.tex || t[2] < 0 || (!night && dev > BOX_TOL + 12) || s2.calls !== 1;
          if (bad) fail++;
          if (bad || (!night && s2.v === 0)) console.log(`Schutt ${name} Variante ${s2.v} ${night ? 'Nacht' : 'Tag'}: ${s2.tris} Dreiecke, ${s2.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px)${s2.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
        }
      }
    }
    if (!what || what === 'schutt') {
      const all = await g.run(({ color }) => {
        const rows = [];
        for (let r0 = 0; r0 < 4; r0++) {
          const row = [];
          for (let v = r0 * 4; v < r0 * 4 + 4; v++) {
            const r = window.__kitBig({ kind: 'rubble', rub: { kind: 'wreck', w: 96, h: 96, burnt: true, hgt: 36, v }, lv: 1, color, season: 'summer', night: false, rots: [0], W: 200, H: 200 });
            row.push([r.painted, `V${v} gemalt`], [r.panels[0], '3D']);
          }
          rows.push(row);
        }
        return window.__kitSheet(rows, 200, 200);
      }, { color: TEAMS[0] });
      await save('schutt-wrack96-varianten', all);
    }
    if (Object.keys(rtris).length) console.log(`Baukasten: Dreiecke je Schuttvariante ${Object.entries(rtris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (Object.keys(atris).length) console.log(`Baukasten: Dreiecke je Fliegerhorst-Variante ${Object.entries(atris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (Object.keys(mtris).length) console.log(`Baukasten: Dreiecke je Militärvariante ${Object.entries(mtris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`Baukasten: Dreiecke je Werk ${Object.entries(wtris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (Object.keys(btris).length) console.log(`Baukasten: Dreiecke je Großbau ${Object.entries(btris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`Baukasten: Dreiecke je Variante ${Object.entries(tris).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (!what || what === 'kartenstadt') await kartenstadt(g, dir, save, BOX_TOL); // Paket „Kartenstadt 3D“
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
      // Ort mit den meisten Großbauten und der Hauptstadt (Rathaus, Regierungsviertel) im Bild (Paket „Großbauten 3D“)
      const bspot = await g.run(async () => {
        const { cityBuildings } = await import('/js/render/citylayer.js');
        const s = window.__frontline.session();
        const all = cityBuildings(s.game, 0, () => true, () => true);
        const plans = new Map();
        for (const b of all) if (b.kind === 'bigpart' && ['barracks', 'factory', 'warehouse', 'station'].includes(b.plan.k)) plans.set(b.plan, b.plan);
        const bigs = [...plans.keys()].map((p) => ({ x: p.x, y: p.y, n: `${p.k}${p.lv}` }));
        for (const b of all) if (b.kind === 'uni') bigs.push({ x: b.x, y: b.y, n: `uni${b.level}` });
        const hq = s.game.buildings.find((b) => b.main && b.team === 0);
        if (hq) bigs.push({ x: hq.x, y: hq.y, n: 'hall', hq: true });
        const R = 480;
        let best = null;
        for (const c of bigs) {
          const near = bigs.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R);
          const score = near.length * 4 + near.filter((o) => o.hq).length * 6;
          if (!best || score > best.score) {
            const kinds = {};
            for (const o of near) kinds[o.n] = (kinds[o.n] ?? 0) + 1;
            best = { score, x: near.reduce((a, o) => a + o.x, 0) / near.length, y: near.reduce((a, o) => a + o.y, 0) / near.length, n: near.length, hq: near.some((o) => o.hq), kinds };
          }
        }
        return best ?? { x: s.camera.mapW / 2, y: s.camera.mapH / 2, n: 0, hq: false, kinds: {} };
      });
      console.log(`Stadt ${season}: Großbauten-Ausschnitt ${bspot.n} Großbauten${bspot.hq ? ' mit Hauptstadt und Regierungsviertel' : ''} ${JSON.stringify(bspot.kinds)}`);
      if (!bspot.n) fail++;
      for (let rot = 0; rot < 4; rot++) {
        await look(g, bspot.x, bspot.y, rot, 1);
        await mvpPair(g, dir, 'seed3', `grossbau-${season}-drehung${rot}`);
      }
      // Ort mit den meisten Militärgebäuden der eigenen Seite im Bild (Paket „Militärgebäude 3D“): Mittelpunkt, Zahl, Arten und Baustellen
      const mspot = await g.run(async () => {
        const { isMilBuilding } = await import('/js/render/milbuild.js');
        const s = window.__frontline.session();
        const mil = s.game.buildings.filter((b) => b.alive && b.team === 0 && isMilBuilding(b));
        const R = 420;
        let best = null;
        for (const c of mil) {
          const near = mil.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R);
          const score = near.length;
          if (!best || score > best.score) {
            const kinds = {};
            for (const o of near) kinds[`${o.type}${o.built ? '' : ' (Bau)'}`] = (kinds[`${o.type}${o.built ? '' : ' (Bau)'}`] ?? 0) + 1;
            best = { score, x: near.reduce((a, o) => a + o.x, 0) / near.length, y: near.reduce((a, o) => a + o.y, 0) / near.length, n: near.length, kinds, all: mil.length };
          }
        }
        return best ?? { x: s.camera.mapW / 2, y: s.camera.mapH / 2, n: 0, kinds: {}, all: 0 };
      });
      console.log(`Stadt ${season}: Militär-Ausschnitt ${mspot.n} Militärgebäude (eigene Seite insgesamt ${mspot.all}) ${JSON.stringify(mspot.kinds)}`);
      if (!mspot.n) fail++;
      for (let rot = 0; rot < 4; rot++) {
        await look(g, mspot.x, mspot.y, rot, 1);
        await mvpPair(g, dir, 'seed3', `militaer-${season}-drehung${rot}`);
      }
      // Ort mit den meisten Fliegerhorst-Bausteinen der eigenen Seite im Bild (Paket „Fliegerhorst 3D“): Mittelpunkt, Zahl und Arten mit Stufe; Jets in der Nähe
      const aspot = await g.run(async () => {
        const { cityBuildings } = await import('/js/render/citylayer.js');
        const s = window.__frontline.session();
        const plans = new Map();
        for (const b of cityBuildings(s.game, 0, () => true, () => true)) if (b.kind === 'bigpart' && b.part.t === 'ab') plans.set(b.plan, b.plan);
        const air = [...plans.keys()];
        const R = 380;
        let best = null;
        for (const c of air) {
          const near = air.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R);
          if (!best || near.length > best.n) {
            const kinds = {};
            for (const o of near) kinds[`${o.k}${o.lv}`] = (kinds[`${o.k}${o.lv}`] ?? 0) + 1;
            best = { n: near.length, x: near.reduce((a, o) => a + o.x, 0) / near.length, y: near.reduce((a, o) => a + o.y, 0) / near.length, kinds, all: air.length };
          }
        }
        const jets = best ? s.game.units.filter((u) => u.alive && u.team === 0 && u.def.air && Math.hypot(u.x - best.x, u.y - best.y) < R).length : 0;
        return best ? { ...best, jets } : { x: s.camera.mapW / 2, y: s.camera.mapH / 2, n: 0, kinds: {}, all: 0, jets: 0 };
      });
      console.log(`Stadt ${season}: Fliegerhorst-Ausschnitt ${aspot.n} Bausteine (eigene Seite insgesamt ${aspot.all}) ${JSON.stringify(aspot.kinds)}, ${aspot.jets} Luftfahrzeuge in der Nähe`);
      if (!aspot.n) fail++;
      for (let rot = 0; rot < 4; rot++) {
        await look(g, aspot.x, aspot.y, rot, 1);
        await mvpPair(g, dir, 'seed3', `fliegerhorst-${season}-drehung${rot}`);
      }
      // Ausbauten besetzter Häuser (stronghold.js): ein Haus der Kartenstadt bekommt Sandsäcke, MG-Nest und Draht, Foto Iso | 3D
      const fort = await g.run(async () => {
        const { houseYardIso } = await import('/js/render/maptown.js');
        const s = window.__frontline.session();
        // Altbauten mit Hof (houseYardIso) bleiben gemalt, also ein anderes Haus nahe der Kartenmitte
        const hs = [...(s.game.houseBySrc?.entries() ?? [])].filter(([src, h]) => !h.ruined && !houseYardIso(src, 0)).map(([, h]) => h);
        const h = hs.sort((a, b) => Math.hypot(a.x - s.camera.mapW / 2, a.y - s.camera.mapH / 2) - Math.hypot(b.x - s.camera.mapW / 2, b.y - s.camera.mapH / 2))[0];
        if (!h) return null;
        h.works = { sandbags: true, mgnest: true, wire: true };
        s.renderer.revealAll = true;
        return { x: h.x, y: h.y, n: hs.length };
      });
      if (fort) {
        for (let rot = 0; rot < 4; rot++) {
          await look(g, fort.x, fort.y, rot, 2);
          await mvpPair(g, dir, 'seed3', `ausbau-${season}-drehung${rot}`);
        }
        const n = await g.run(() => {
          const s = window.__frontline.session();
          s.camera.three = true;
          s.renderer.render(s.controller.view);
          return [...s.renderer.towns3d.sets.entries()].filter(([k, v]) => k.startsWith('mil|fort') && v.n > 0).length;
        });
        if (!n) fail++;
        console.log(`Stadt ${season}: Ausbauten 3D (Haus bei ${fort.x.toFixed(0)}, ${fort.y.toFixed(0)}; ${fort.n} Häuser der Karte ohne Hof): ${n} Variante(n) im Bild`);
        await g.run(() => { window.__frontline.session().renderer.revealAll = false; });
      } else console.log(`Stadt ${season}: keine Häuser der Karte für die Ausbauten`);
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
      // Großbauten (Paket „Großbauten 3D“): gemalt, ohne Großbauten 3D (Häuser und Werke 3D), alles 3D; Ausschnitt mit den meisten Großbauten
      await look(g, bspot.x, bspot.y, 0, 1);
      const rows2 = [];
      for (const level of ['off', 'high']) {
        for (const [towns, works, bigs] of [[false, false, false], [true, true, false], [true, true, true]]) {
          const st = await g.run(({ level, towns, works, bigs }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.towns3dOn = towns;
            r.works3dOn = works;
            r.big3dOn = bigs;
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
            return { ...obj, big: r.towns3d.stats('big') };
          }, { level, towns, works, bigs });
          const t = await timePasses(g, frames);
          if (bigs && !st.big.houses) fail++;
          const what = bigs ? 'alles 3D          ' : towns ? 'ohne Großbauten 3D' : 'gemalt            ';
          rows2.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${what}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke${bigs ? ` (Großbauten: ${st.big.houses}/${st.big.calls} Varianten/${st.big.tris} Dreiecke)` : ''}`);
        }
      }
      await g.run(() => {
        const r = window.__frontline.session().renderer;
        r.big3dOn = true;
      });
      // Militärgebäude (Paket „Militärgebäude 3D“): gemalt, 3D (Häuser, Werke, Großbauten bleiben 3D); Ausschnitt mit den meisten Militärgebäuden
      await look(g, mspot.x, mspot.y, 0, 1);
      const rows3 = [];
      for (const level of ['off', 'high']) {
        for (const mil of [false, true]) {
          const st = await g.run(({ level, mil }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.mil3dOn = mil;
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
            return { ...obj, mil: r.towns3d.stats('mil') };
          }, { level, mil });
          const t = await timePasses(g, frames);
          if (mil && !st.mil.houses) fail++;
          rows3.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${mil ? 'Militär 3D' : 'gemalt    '}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke${mil ? ` (Militär: ${st.mil.houses}/${st.mil.calls} Varianten/${st.mil.tris} Dreiecke)` : ''}`);
        }
      }
      await g.run(() => {
        window.__frontline.session().renderer.mil3dOn = true;
      });
      // Fliegerhorst (Paket „Fliegerhorst 3D“): gemalt, 3D (alles andere bleibt 3D); Ausschnitt mit den meisten Bausteinen
      await look(g, aspot.x, aspot.y, 0, 1);
      const rows4 = [];
      for (const level of ['off', 'high']) {
        for (const air of [false, true]) {
          const st = await g.run(({ level, air }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.airbase3dOn = air;
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
            return { ...obj, air: r.towns3d.stats('airbase') };
          }, { level, air });
          const t = await timePasses(g, frames);
          if (air && !st.air.houses) fail++;
          rows4.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${air ? 'Fliegerhorst 3D' : 'gemalt         '}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke${air ? ` (Fliegerhorst: ${st.air.houses}/${st.air.calls} Varianten/${st.air.tris} Dreiecke)` : ''}`);
        }
      }
      await g.run(() => {
        window.__frontline.session().renderer.airbase3dOn = true;
      });
      console.log(`Stadt Messung Fliegerhorst (Seed 3, Ausschnitt mit ${aspot.n} Bausteinen ${JSON.stringify(aspot.kinds)}, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
      for (const r of rows4) console.log(`  ${r}`);
      console.log(`Stadt Messung Militär (Seed 3, Ausschnitt mit ${mspot.n} Militärgebäuden ${JSON.stringify(mspot.kinds)}, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
      for (const r of rows3) console.log(`  ${r}`);
      console.log(`Stadt Messung Großbauten (Seed 3, Ausschnitt mit ${bspot.n} Großbauten ${JSON.stringify(bspot.kinds)}, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
      for (const r of rows2) console.log(`  ${r}`);

      console.log(`Stadt Messung (Seed 3, Ausschnitt mit ${wspot.works} Werken und ${wspot.houses} Stadthäusern in der Nähe, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
      for (const r of rows) console.log(`  ${r}`);
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/**
 * Teil „ruinen“ (--only ruinen, Paket „Baustellen und Ruinen 3D“, nicht in der Standardfolge): Seed 3 mit Eroberung, alle Teams mit KI, Simulation direkt.
 * 1. nach --sitemin Spielminuten (Standard 7) der Ausschnitt mit den meisten Baustellen der Stadt (Radius 500): 4 Drehungen Iso | 3D, Zählung je Größe und Abschnitt,
 *    Messung gemalt gegen 3D (site3dOn: Draw-Calls, Dreiecke, Zeit „Objekte“, Schatten Aus und Hoch);
 * 2. ab --wreckmin Spielminuten (Standard 18, bis mindestens 5 Wracks zugleich liegen) der Ausschnitt mit den meisten Gebäude-Wracks (g.wrecks, kind 'building'): ebenso (ruin3dOn), dazu ein Foto des ältesten Wracks,
 *    das in den letzten wreckFade Sekunden einsinkt statt zu verblassen (Zeit des Spiels nur für das Foto verschoben).
 * Fotos nach <out>/ruinen/.
 */
async function ruinen() {
  const dir = join(out, 'ruinen');
  await mkdir(dir, { recursive: true });
  const siteMin = Number(arg('sitemin', 7));
  const wreckMin = Number(arg('wreckmin', 18));
  const what = arg('what', null); // --what baustelle | schutt: nur eine der beiden Szenen
  const g = await openGame({ seed: 3, query: 'iso=1&three=1&shadows=high&weather=summer&wx=clear', scale: 1, out });
  try {
    const has3D = await g.run(() => !!window.__frontline.session().renderer.towns3d);
    if (!has3D) throw new Error('Ansicht 3D nicht aktiv (WebGL oder three.js fehlt)');
    const conquest = await g.run(async () => {
      const { AI } = await import('/js/ai/ai.js');
      const s = window.__frontline.session();
      s.loop.paused = true;
      s.renderer.revealAll = true;
      window.__ais = s.game.teams.map((_, t) => new AI(s.game, t, 'normal'));
      return { conquest: !!s.game.conquest, teams: s.game.teams.length };
    });
    console.log(`Ruinen: Seed 3, Eroberung ${conquest.conquest ? 'an' : 'AUS'}, ${conquest.teams} Teams`);
    if (!conquest.conquest) fail++;
    const advance = (to) =>
      g.run((to) => {
        const s = window.__frontline.session();
        while (s.game.time < to * 60) {
          for (const a of window.__ais) a.update(0.05);
          s.game.update(0.05);
        }
      }, to);
    const measure = async (label, flag, fam, spot) => {
      await look(g, spot.x, spot.y, 0, 1);
      const rows = [];
      for (const level of ['off', 'high']) {
        for (const on of [false, true]) {
          const st = await g.run(({ level, on, flag, fam }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r[flag] = on;
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
            return { ...obj, fam: r.towns3d.stats(fam) };
          }, { level, on, flag, fam });
          const t = await timePasses(g, frames);
          if (on && !st.fam.houses) fail++;
          rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? `${label} 3D` : 'gemalt'.padEnd(label.length + 3)}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke${on ? ` (${label}: ${st.fam.houses}/${st.fam.calls} Varianten/${st.fam.tris} Dreiecke)` : ''}`);
        }
      }
      await g.run((flag) => { window.__frontline.session().renderer[flag] = true; }, flag);
      return rows;
    };
    // 1. Baustellen (--what schutt überspringt sie)
    if (!what || what === 'baustelle') {
    await advance(siteMin);
    const sspot = await g.run(async () => {
      const { cityBuildings } = await import('/js/render/citylayer.js');
      const s = window.__frontline.session();
      const sites = [];
      for (const b of cityBuildings(s.game, 0, () => true, () => true)) if (b.kind === 'site') sites.push(b); // cityBuildings liefert die Stadt aller Seiten, die Seite ändert nichts
      const R = 500;
      let best = null;
      for (const c of sites) {
        const near = sites.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R);
        if (!best || near.length > best.n) {
          const kinds = {};
          for (const o of near) kinds[`n${o.n}s${o.step}`] = (kinds[`n${o.n}s${o.step}`] ?? 0) + 1;
          best = { n: near.length, x: near.reduce((a, o) => a + o.x, 0) / near.length, y: near.reduce((a, o) => a + o.y, 0) / near.length, kinds };
        }
      }
      return { all: sites.length, ...(best ?? { n: 0, x: s.camera.mapW / 2, y: s.camera.mapH / 2, kinds: {} }) };
    });
    console.log(`Ruinen: nach ${siteMin} Spielminuten ${sspot.all} Baustellen auf der Karte, im Ausschnitt ${sspot.n} ${JSON.stringify(sspot.kinds)}`);
    if (!sspot.n) fail++;
    for (let rot = 0; rot < 4; rot++) {
      await look(g, sspot.x, sspot.y, rot, 1);
      await mvpPair(g, dir, 'seed3', `baustellen-drehung${rot}`);
    }
    const srows = await measure('Baustellen', 'site3dOn', 'site', sspot);
    console.log(`Ruinen Messung Baustellen (Seed 3, ${siteMin} min, Ausschnitt mit ${sspot.n} Baustellen, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
    for (const r of srows) console.log(`  ${r}`);
    }
    // 2. Gebäude-Wracks (--what baustelle überspringt sie)
    if (!what || what === 'schutt') {
    // Wracks leben nur wreckLife s: Minute für Minute weiter, bis mindestens 5 Gebäude-Wracks zugleich liegen (höchstens bis Minute 40)
    for (let m = wreckMin; m <= 40; m++) {
      await advance(m);
      const n = await g.run(() => (window.__frontline.session().game.wrecks ?? []).filter((w) => w.kind === 'building').length);
      console.log(`Ruinen: Minute ${m}: ${n} Gebäude-Wracks`);
      if (n >= 5) break;
    }
    const wspot = await g.run(() => {
      const s = window.__frontline.session();
      const ws = (s.game.wrecks ?? []).filter((w) => w.kind === 'building');
      const R = 420;
      let best = null;
      for (const c of ws) {
        const near = ws.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R);
        if (!best || near.length > best.n) {
          const kinds = {};
          for (const o of near) kinds[`${o.small ? 'wall' : 'wreck'}${o.w}`] = (kinds[`${o.small ? 'wall' : 'wreck'}${o.w}`] ?? 0) + 1;
          best = { n: near.length, x: near.reduce((a, o) => a + o.x, 0) / near.length, y: near.reduce((a, o) => a + o.y, 0) / near.length, kinds };
        }
      }
      const oldest = ws.reduce((a, w) => (!a || w.t0 < a.t0 ? w : a), null);
      return { all: ws.length, old: oldest ? { x: oldest.x, y: oldest.y, t0: oldest.t0 } : null, ...(best ?? { n: 0, x: s.camera.mapW / 2, y: s.camera.mapH / 2, kinds: {} }) };
    });
    console.log(`Ruinen: ${wspot.all} Gebäude-Wracks, im Ausschnitt ${wspot.n} ${JSON.stringify(wspot.kinds)}`);
    if (!wspot.n) fail++;
    for (let rot = 0; rot < 4; rot++) {
      await look(g, wspot.x, wspot.y, rot, 1);
      await mvpPair(g, dir, 'seed3', `wracks-drehung${rot}`);
    }
    const wrows = await measure('Schutt', 'ruin3dOn', 'ruin', wspot);
    console.log(`Ruinen Messung Schutt (Seed 3, Ausschnitt mit ${wspot.n} Wracks, Zoom 1, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
    for (const r of wrows) console.log(`  ${r}`);
    // Einsinken: ältestes Wrack in den letzten wreckFade Sekunden (Alpha 0,5); gemalt blasst es aus, 3D sinkt es ein
    if (wspot.old) {
      const sunk = await g.run(({ x, y, t0 }) => {
        const s = window.__frontline.session();
        const SC = { life: 240, fade: 30 };
        const saved = s.game.time;
        s.game.time = t0 + SC.life - SC.fade / 2;
        s.camera.centerOn(x, y);
        s.camera.zoom = 2;
        for (const rot of [0]) s.camera.rot = rot;
        return { saved };
      }, wspot.old);
      await mvpPair(g, dir, 'seed3', 'wrack-einsinken');
      const n = await g.run(() => {
        const s = window.__frontline.session();
        s.camera.three = true;
        s.renderer.render(s.controller.view);
        const m = [...s.renderer.towns3d.sets.values()].filter((v) => v.fam.name === 'ruin' && v.n > 0).flatMap((v) => Array.from({ length: v.n }, (_, i) => v.mesh.instanceMatrix.array[i * 16 + 10]));
        return { low: m.filter((z) => z < 0.99).length, all: m.length, min: Math.min(...m) };
      });
      console.log(`Ruinen: einsinkende Wracks im Bild ${n.low} von ${n.all} (kleinste Streckung ${n.min.toFixed(2)})`);
      if (!n.low) fail++;
      await g.run((t) => { window.__frontline.session().game.time = t; }, sunk.saved);
    }
    }
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/**
 * Teil „natur“ (--only natur, läuft auch ohne --only), Paket „Büsche und Felsen 3D“: Seed 7, Wald (dicht mit Unterholz) und offenes Land (Felsen, Büsche, wenige Bäume), dazu ein
 * Tier aus der Nähe. Je Jahreszeit Fotos Iso | 3D nah (Zoom 1,6) und fern (0,5) nach <out>/natur/, im Sommer zusätzlich 4 Drehungen.
 * Prüft: in 3D wird jeder Busch, Fels und jedes Tier im Bild ein 3D-Körper (keine Natur-Billboards); höchstens BUSH_SHAPES Draw-Calls
 * je Buschart und 4 für Felsen. Misst Draw-Calls und Dreiecke von „Objekte“ samt Schattenkarte und Zeit „Objekte“ mit gemalter Natur
 * (nature3dOn = false) gegen 3D, Schatten Aus und Hoch.
 */
async function nature() {
  const dir = join(out, 'natur');
  await mkdir(dir, { recursive: true });
  for (const season of ['summer', 'autumn', 'winter']) {
    const wx = season === 'winter' ? 'snow' : 'clear';
    const g = await openGame({ seed: 7, query: `iso=1&three=1&shadows=high&weather=${season}&wx=${wx}`, scale: 1, out });
    try {
      // Stellen suchen: Wald = meiste Büsche, offen = viele Felsen und Büsche bei wenig Bäumen, Tier = erstes Tier
      const spots = await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
        s.camera.three = true;
        s.renderer.render(s.controller.view);
        const d = s.renderer.deco;
        const cell = new Map();
        const at = (x, y) => {
          const k = `${Math.floor(x / 700)},${Math.floor(y / 700)}`;
          let c = cell.get(k);
          if (!c) cell.set(k, (c = { k, b: 0, u: 0, r: 0, t: 0 }));
          return c;
        };
        for (const b of d.bushes) at(b.x, b.y)[b.under ? 'u' : 'b']++;
        for (const o of d.rocks) at(o.x, o.y).r++;
        for (const t of d.trees) at(t.x, t.y).t++;
        const mid = (c) => c.k.split(',').map((v) => (+v + 0.5) * 700);
        const cs = [...cell.values()];
        const wald = cs.sort((a, b) => b.b + b.u - (a.b + a.u))[0];
        const offen = cs.filter((c) => c.t < 25).sort((a, b) => b.r * 2 + b.b - (a.r * 2 + a.b))[0];
        const a = s.game.animals?.find((x) => x.kind === 'deer') ?? s.game.animals?.[0];
        return { wald: mid(wald), offen: mid(offen), tier: a ? [a.x, a.y] : mid(offen) };
      });
      // Fotos und Prüfung: je Stelle nah und fern
      const views = [['wald-nah', spots.wald, 1.6], ['wald-fern', spots.wald, 0.5], ['offen-nah', spots.offen, 1.6], ['offen-fern', spots.offen, 0.5], ['tier', spots.tier, 2.4]];
      for (const [name, [x, y], zoom] of views) {
        await look(g, x, y, 0, zoom);
        await mvpPair(g, dir, season, name);
        const st = await g.run(() => {
          const s = window.__frontline.session();
          const r = s.renderer;
          s.camera.three = true;
          let items = [];
          const orig = r.isoItems;
          r.isoItems = function (f) {
            const res = orig.call(this, f);
            items = res.items;
            return res;
          };
          try {
            r.render(s.controller.view);
          } finally {
            r.isoItems = orig;
          }
          const want = { bush: 0, rock: 0, animal: 0 };
          for (const it of items) if (it.t === 13) want.bush++; else if (it.t === 2) want.rock++; else if (it.t === 11) want.animal++;
          return { want, got: r.nature3d.stats() };
        });
        const { want, got } = st;
        const bb = want.bush !== got.bush || want.rock !== got.rock || want.animal !== got.animal;
        const many = Object.entries(got.byArt).some(([k, n]) => n > (k === 'rock' ? 4 : 2) && k !== 'animal');
        if (bb || many) fail++;
        console.log(`Natur ${season.padEnd(7)} ${name.padEnd(10)}: ${got.bush}/${want.bush} Büsche, ${got.rock}/${want.rock} Felsen, ${got.animal}/${want.animal} Tiere in 3D; ${got.calls} Draw-Calls ${JSON.stringify(got.byArt)}, ${got.tris} Dreiecke${bb ? '  BILLBOARDS ÜBRIG' : ''}${many ? '  ZU VIELE DRAW-CALLS' : ''}`);
      }
      if (season !== 'summer') continue;
      for (const [name, [x, y]] of [['wald', spots.wald], ['offen', spots.offen]]) {
        for (let rot = 0; rot < 4; rot++) {
          await look(g, x, y, rot, 1.2);
          await mvpPair(g, dir, season, `${name}-drehung${rot}`);
        }
      }
      // Messung: Draw-Calls, Dreiecke und Zeit „Objekte“, gemalt gegen 3D, Schatten Aus und Hoch (Wald und offen, Zoom 1)
      for (const [name, [x, y]] of [['wald', spots.wald], ['offen', spots.offen]]) {
        await look(g, x, y, 0, 1);
        const rows = [];
        for (const level of ['off', 'high']) {
          for (const on of [false, true]) {
            const st = await g.run(({ level, on }) => {
              const s = window.__frontline.session();
              const r = s.renderer;
              s.camera.three = true;
              r.setShadows(level);
              r.nature3dOn = on;
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
              return { ...obj, nat: r.nature3d.stats() };
            }, { level, on });
            const t = await timePasses(g, frames);
            rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (on ? ` (Natur: ${st.nat.bush} Büsche, ${st.nat.rock} Felsen, ${st.nat.animal} Tiere, ${st.nat.calls} Formen, ${st.nat.tris} Dreiecke)` : ''));
          }
        }
        await g.run(() => (window.__frontline.session().renderer.nature3dOn = true));
        console.log(`Natur Messung ${name} (Seed 7, Zoom 1, ${frames} Bilder, Software-WebGL; „Objekte“ samt Schattenkarte):`);
        for (const r of rows) console.log(`  ${r}`);
      }
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/** Zwei Bildschirmfotos (PNG-Puffer) nebeneinander als ein Bild speichern, links „alt (Iso)“, rechts „neu (3D)“. */
async function sideBySide(g, file, a, b, labels = ['alt (Iso)', 'neu (3D)']) {
  const url = await g.run(
    async ({ a, b, labels }) => {
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
      for (const [t, px] of [[labels[0], 10], [labels[1], ia.width + gap + 10]]) {
        x.fillStyle = 'rgba(0,0,0,.6)';
        x.fillRect(px - 4, c.height - c.height / 18 - 8, x.measureText(t).width + 8, c.height / 18 + 4);
        x.fillStyle = '#fff';
        x.fillText(t, px, c.height - 14);
      }
      return c.toDataURL('image/png');
    },
    { a: a.toString('base64'), b: b.toString('base64'), labels },
  );
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
}

/** Ansicht aus Iso und 3D fotografieren (Spiel angehalten, je 4 Bilder fertig gemalt) und nebeneinander speichern. */
async function mvpPair(g, dir, dev, name) {
  const shots = [];
  for (const three of [false, true]) {
    await g.run(async (three) => {
      const s = window.__frontline.session();
      const { spriteMissed } = await import('/js/render/spritecache.js');
      s.camera.three = three;
      // gemalte Bilder kommen mit Zeitbudget (6 ms je Bild, spritecache.js): so lange malen, bis keins mehr fehlt (sonst fehlen in Iso Gebäude)
      for (let i = 0; i < 4 || (spriteMissed() && i < 150); i++) s.renderer.render(s.controller.view);
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

/**
 * Wasser (Paket „Wasser 3D“, nur mit --only wasser oder ohne --only): See (Seed 3 ohne Fluss, Ausschnitt mit dem meisten Wasser) und
 * Fluss (Seed 4 mit Fluss, mittlere Brücke des eigenen Flusses), je Sommer und Winter. Über dem Wasser schweben zwei Kampfhubschrauber,
 * am Ufer stehen Panzer (Schatten aufs Wasser). Fotos Iso | 3D (Schatten Hoch) nach <out>/wasser/: Tag und Nacht je 4 Drehungen (Zoom 1),
 * dazu Zoom 0,5 und 1,6 bei Tag. Im Sommer Zeit „Gelände“ (Mittel über --frames Bilder) sowie Draw-Calls und Dreiecke des Bodenbilds
 * ohne 3D-Wasser (vorher, Wassernetz ausgeblendet) und mit. Fehler ohne Wasserdreiecke oder bei Browserfehlern.
 */
async function water() {
  const dir = join(out, 'wasser');
  await mkdir(dir, { recursive: true });
  const rows = [];
  for (const [name, seed, river] of [['see', 3, 0], ['fluss', 4, 1]]) {
    for (const season of ['summer', 'winter']) {
      const g = await openGame({ seed, query: `iso=1&three=1&shadows=high&river=${river}&weather=${season}&wx=clear`, scale: 1, out });
      try {
        const spot = await g.run(async (river) => {
          const { RELIEF } = await import('/js/game/relief.js');
          const s = window.__frontline.session();
          s.loop.paused = true;
          const rel = s.game.relief;
          const hq = s.game.buildings.find((b) => b.main && b.team === 0);
          let p = null;
          if (river) {
            // mittlere Brücke des Flusses vor der eigenen Startecke
            const bs = [...(s.game.bridges ?? [])].sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y)).slice(0, 3);
            bs.sort((a, b) => a.angle - b.angle);
            const b = bs[1] ?? bs[0];
            if (b) p = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
          } else {
            let best = -1;
            for (let cy = 700; cy < s.camera.mapH - 700; cy += 160) {
              for (let cx = 900; cx < s.camera.mapW - 900; cx += 160) {
                let c = 0;
                for (let y = cy - 500; y < cy + 500; y += 64) for (let x = cx - 800; x < cx + 800; x += 64) if (rel.heightAt(x, y) < RELIEF.water) c++;
                if (c > best) [best, p] = [c, { x: cx, y: cy }];
              }
            }
          }
          if (!p) return null;
          // Wasserpunkt nahe der Mitte (Hubschrauber darüber) und Uferpunkt (Panzer daneben)
          let wet = null;
          let dry = null;
          for (let r = 0; r < 900 && !(wet && dry); r += 32) {
            for (let a = 0; a < 6.28; a += 0.2) {
              const x = p.x + Math.cos(a) * r;
              const y = p.y + Math.sin(a) * r;
              const h = rel.heightAt(x, y);
              if (!wet && h < RELIEF.water - 15) wet = { x, y };
              if (!dry && h > RELIEF.water + 4 && h < RELIEF.water + 30 && rel.cellSlope?.(Math.floor(x / 32), Math.floor(y / 32)) < 0.2) dry = { x, y };
            }
          }
          if (wet) for (const d of [-60, 60]) s.game.spawnUnit('gunship', 0, wet.x + d, wet.y - d / 2);
          if (dry) for (const d of [-40, 40]) s.game.spawnUnit('tank', 0, dry.x + d, dry.y);
          return { ...p, wet, dry, tris: s.renderer.ground3d.waterStats().tris };
        }, river);
        if (!spot) throw new Error(`${name}: kein Wasser gefunden`);
        if (!spot.tris) fail++;
        console.log(`Wasser ${name} (Seed ${seed}, Fluss ${river ? 'an' : 'aus'}) ${season}: Blick auf ${Math.round(spot.x)}, ${Math.round(spot.y)}, ${spot.tris} Wasserdreiecke im Netz`);
        for (const mood of [null, 'night']) {
          await g.run((mood) => (window.__frontline.session().renderer.mood = mood), mood);
          for (let rot = 0; rot < 4; rot++) {
            await look(g, spot.x, spot.y, rot, 1);
            await mvpPair(g, dir, name, `${season}-${mood ?? 'tag'}-drehung${rot}`);
          }
        }
        await g.run(() => (window.__frontline.session().renderer.mood = null));
        for (const zoom of [0.5, 1.6]) {
          await look(g, spot.x, spot.y, 0, zoom);
          await mvpPair(g, dir, name, `${season}-tag-zoom${zoom}`);
        }
        if (season !== 'summer') continue;
        await look(g, spot.x, spot.y, 0, 1);
        for (const on of [false, true]) {
          const st = await g.run((on) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.ground3d.water.visible = on;
            for (let i = 0; i < 3; i++) r.render(s.controller.view);
            const info = r.gl.info;
            const orig = r.terrain3d;
            let st = null;
            info.autoReset = false;
            r.terrain3d = function (f) {
              info.reset();
              orig.call(this, f);
              st = { calls: info.render.calls, tris: info.render.triangles };
            };
            try {
              r.render(s.controller.view);
            } finally {
              r.terrain3d = orig;
              info.autoReset = true;
            }
            return st;
          }, on);
          const t = await timePasses(g, frames);
          rows.push(`${name.padEnd(5)} ${on ? 'mit 3D-Wasser ' : 'ohne (vorher) '}: Gelände ${t['Gelände'].toFixed(1)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke`);
        }
        await g.run(() => (window.__frontline.session().renderer.ground3d.water.visible = true));
      } finally {
        errors.push(...g.errors);
        await g.close();
      }
    }
  }
  console.log(`Wasser Messung (Zoom 1, Drehung 0, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke im Bodenbild):`);
  for (const r of rows) console.log(`  ${r}`);
}

/**
 * Teil „props“ (--only props, läuft auch ohne --only), Paket „Props 3D“: alle Props (mapprops.js, props.js) gemalt neben 3D.
 * 1. Echte Karten (Seed 3 und 7, Schatten Hoch): Ausschnitt „Land“ (die meisten Props der Karte im Bild) und „Stadt“ (die meisten Autos,
 *    Bänke und Ballen), 0 und 10 Spielminuten (KI gegen KI; die KI baut Feldstellungen), je 4 Drehungen und Winter (<out>/props/).
 * 2. Schauraum: jede Art in Reihen zu sechs (Kachelarten als Linie mit Ecke, Tor zu und offen, Trümmer; Einzelstücke in vier Stellungen,
 *    mit Fahnen in Teamfarbe, gestapelt, zerstört), auf einer flachen Stelle der Karte; je Reihe 4 Drehungen im Sommer, dazu Winter und Nacht (Drehung 0).
 * Prüft: jedes Prop, Auto, jede Bank, jeder Ballen und jede Kiste im Bild wird ein 3D-Körper (Zählung „x/x Props in 3D“, sonst
 * Prop-Billboard übrig); Draw-Calls je Bild. Misst Draw-Calls, Dreiecke und Zeit „Objekte“ mit gemalten und mit 3D-Props, Schatten Aus
 * und Hoch (props3dOn).
 */
async function propsPart() {
  const dir = join(out, 'props');
  await mkdir(dir, { recursive: true });
  // Zählung im Bild: Soll aus der Objektliste (isoItems), Ist aus Props3D bzw. (Busch, Fels der Karte) Nature3D
  const count = (g) =>
    g.run(async () => {
      const s = window.__frontline.session();
      const r = s.renderer;
      s.camera.three = true;
      let items = [];
      const orig = r.isoItems;
      r.isoItems = function (f) {
        const res = orig.call(this, f);
        items = res.items;
        return res;
      };
      try {
        r.render(s.controller.view);
      } finally {
        r.isoItems = orig;
      }
      const as = { civ_car: 'car', burnt_car: 'car', bench: 'bench', hay_bale: 'bale', bush: 'nat', rock: 'nat' }; // Props mit vorhandenem Maler
      const want = { prop: 0, car: 0, bench: 0, bale: 0, crate: 0, nat: 0 };
      for (const it of items) {
        if (it.t === 16) want[as[it.o.kind] ?? 'prop']++;
        else if (it.t === 13 || it.t === 2) want.nat++; // Busch, Fels (Natur 3D, zusammen mit denen der Karte)
        else if (it.t === 6) want.car++;
        else if (it.t === 7) want.bench++;
        else if (it.t === 14) want.bale++;
        else if (it.t === 8) want.crate++;
      }
      const p = r.props3d.stats();
      const n = r.nature3d.counts;
      return { want, got: { prop: p.prop ?? 0, car: p.car ?? 0, bench: p.bench ?? 0, bale: p.bale ?? 0, crate: p.crate ?? 0 }, calls: p.calls, tris: Math.round(p.tris), total: p.total, wantTotal: want.prop + want.car + want.bench + want.bale + want.crate, natGot: n.bush + n.rock };
    });
  const report = (label, c) => {
    const bad = c.total !== c.wantTotal || c.natGot !== c.want.nat;
    if (bad) fail++;
    const w = c.want;
    console.log(`Props ${label.padEnd(26)}: ${c.total}/${c.wantTotal} Props in 3D (Karte ${c.got.prop}/${w.prop}, Autos ${c.got.car}/${w.car}, Bänke ${c.got.bench}/${w.bench}, Ballen ${c.got.bale}/${w.bale}, Kisten ${c.got.crate}/${w.crate}; Büsche und Felsen ${c.natGot}/${w.nat}); ${c.calls} Draw-Calls, ${c.tris} Dreiecke${bad ? '  BILLBOARDS ÜBRIG' : ''}`);
  };
  // Messung: Draw-Calls, Dreiecke und Zeit „Objekte“, gemalt gegen 3D, Schatten Aus und Hoch
  const measureProps = async (g, label) => {
    const rows = [];
    for (const level of ['off', 'high']) {
      for (const on of [false, true]) {
        const st = await g.run(({ level, on }) => {
          const s = window.__frontline.session();
          const r = s.renderer;
          s.camera.three = true;
          r.setShadows(level);
          r.props3dOn = on;
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
          return { ...obj, props: r.props3d.stats() };
        }, { level, on });
        const t = await timePasses(g, frames);
        rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (on ? ` (Props: ${st.props.total} in ${st.props.calls} Formen, ${Math.round(st.props.tris)} Dreiecke)` : ''));
      }
    }
    await g.run(() => {
      const r = window.__frontline.session().renderer;
      r.props3dOn = true;
      r.setShadows('high');
    });
    console.log(`Props Messung ${label} (Zoom 1, ${frames} Bilder, Software-WebGL; „Objekte“ samt Schattenkarte):`);
    for (const r of rows) console.log(`  ${r}`);
  };
  // Stellen suchen: Land = die meisten Props der Karte, Stadt = die meisten Autos, Bänke und Ballen (Fenster 1400 × 1400 Welt-px)
  const findSpots = (g) =>
    g.run(async () => {
      const { propLooks } = await import('/js/render/mapprops.js');
      const { parkDeco } = await import('/js/render/terrain.js');
      const { fieldBales } = await import('/js/render/fields.js');
      const s = window.__frontline.session();
      const game = s.game;
      const town = game.map.town;
      const CELL = 175;
      const cells = new Map();
      const put = (x, y, k) => {
        const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
        let c = cells.get(key);
        if (!c) cells.set(key, (c = { prop: 0, small: 0 }));
        c[k]++;
      };
      for (const c of town?.cars ?? []) put(c.x, c.y, 'small');
      for (const p of town?.parks ?? []) for (const b of parkDeco(p).benches) put(b.x, b.y, 'small');
      for (const f of town?.fields ?? []) for (const b of fieldBales(f)) put(b.x, b.y, 'small');
      for (const o of propLooks(game, -1, true)) put(o.x, o.y, 'prop');
      let land = null;
      let stadt = null;
      for (const key of cells.keys()) {
        const [i, j] = key.split(',').map(Number);
        let prop = 0;
        let small = 0;
        for (let a = -4; a <= 3; a++) for (let b = -4; b <= 3; b++) {
          const c = cells.get(`${i + a},${j + b}`);
          if (c) {
            prop += c.prop;
            small += c.small;
          }
        }
        const x = (i + 0.5) * CELL;
        const y = (j + 0.5) * CELL;
        if (!land || prop * 100 + small > land.score) land = { x, y, prop, small, score: prop * 100 + small };
        if (!stadt || small > stadt.score) stadt = { x, y, prop, small, score: small };
      }
      return { land, stadt };
    });
  // Schauraum: flache Stelle suchen, jede Art aufbauen (Reihen zu sechs Arten)
  const stageShow = (g) =>
    g.run(async () => {
      const { PROPS } = await import('/js/data/props.js');
      const { BALANCE } = await import('/js/data/balance.js');
      const { addProp, setPropState, setGateOpen, PROP_STATE, GATE } = await import('/js/game/props.js');
      const s = window.__frontline.session();
      const game = s.game;
      const T = BALANCE.map.tile;
      const rel = s.camera.relief;
      const COLS = 6;
      const COLW = 7;
      const ROWH = 7;
      const rows = [];
      for (const group of Object.keys(PROPS.groups)) {
        const kinds = Object.keys(PROPS.kinds).filter((k) => PROPS.kinds[k].group === group);
        for (let i = 0; i < kinds.length; i += COLS) rows.push({ group, kinds: kinds.slice(i, i + COLS) });
      }
      // Abschnitte zu je 6 Reihen (1344 × 1344 Welt-px), je auf einer freien Stelle: flach, trocken, ohne Häuser, Straßen, Parks, Felder, Bäume
      const PER = 6;
      const W = COLS * COLW * T;
      const H = PER * ROWH * T;
      const town = game.map.town;
      const deco = s.renderer.deco;
      const clutter = (ox, oy) => {
        const inR = (x, y, m = 120) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
        let c = 0;
        for (const b of town.buildings) if (inR(b.x, b.y)) c += 20;
        for (const p of town.parks) if (inR(p.x, p.y, p.r)) c += 50;
        for (const f of town.fields) if (inR(f.x, f.y, Math.max(f.w, f.h) / 2)) c += 50;
        for (const r of [...town.roads, ...town.rails]) {
          const n = Math.ceil(Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 64);
          for (let i = 0; i <= n; i++) {
            if (inR(r.x1 + ((r.x2 - r.x1) * i) / n, r.y1 + ((r.y2 - r.y1) * i) / n, (r.w ?? 40) + 40)) {
              c += 30;
              break;
            }
          }
        }
        for (const b of game.buildings) if (inR(b.x, b.y, 300)) c += 200;
        for (const o of [...town.trees, ...deco.trees, ...deco.rocks, ...deco.bushes]) if (inR(o.x, o.y, 20)) c += 1;
        return c;
      };
      const spots = [];
      for (let k = 0; k * PER < rows.length; k++) {
        let best = null;
        for (let ox = 600; ox < game.map.width - W - 600; ox += 160) {
          for (let oy = 600; oy < game.map.height - H - 600; oy += 160) {
            if (spots.some((q) => Math.abs(q.ox - ox) < W + 200 && Math.abs(q.oy - oy) < H + 200)) continue;
            let lo = Infinity;
            let hi = -Infinity;
            for (let x = ox; x <= ox + W; x += 128) {
              for (let y = oy; y <= oy + H; y += 128) {
                const h = rel.heightAt(x, y);
                lo = Math.min(lo, h);
                hi = Math.max(hi, h);
              }
            }
            if (lo < -10) continue;
            const score = hi - lo + clutter(ox, oy);
            if (!best || score < best.score) best = { ox, oy, score, range: hi - lo, n: clutter(ox, oy) };
          }
        }
        spots.push(best);
        // Bäume, Felsen, Büsche des Abschnitts entfernen (nur Darstellung)
        for (const list of [town.trees, deco.trees, deco.rocks, deco.bushes]) {
          for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (o.x > best.ox - 80 && o.x < best.ox + W + 80 && o.y > best.oy - 80 && o.y < best.oy + H + 80) list.splice(i, 1);
          }
        }
      }
      const at = (ri, ci, cx, cy) => {
        const sp = spots[Math.floor(ri / PER)];
        return { x: sp.ox + (ci * COLW + cx + 0.5) * T, y: sp.oy + ((ri % PER) * ROWH + cy + 0.5) * T };
      };
      const add = (p, state, gate) => {
        const i = addProp(game, p);
        if (gate === 'open') setGateOpen(game, i, true);
        if (state) setPropState(game, i, state);
        return i;
      };
      rows.forEach((row, ri) => {
        row.kinds.forEach((kind, ci) => {
          const K = PROPS.kinds[kind];
          if (K.line) {
            const L = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3]];
            L.forEach(([cx, cy], i) => add({ kind, ...at(ri, ci, cx, cy), ...(K.gate && i === 2 ? { gate: GATE.closed } : {}) }, 0));
            [[1, 5], [2, 5], [3, 5], [4, 5]].forEach(([cx, cy], i) => add({ kind, ...at(ri, ci, cx, cy), ...(K.gate && i === 2 ? { gate: GATE.open } : {}) }, i === 3 ? PROP_STATE.rubble : 0, K.gate && i === 2 ? 'open' : null));
          } else {
            const set = [[2, 2, 0, 0, 1], [5, 2, 1, 1, 1], [2, 5, 2, 2, Math.min(2, K.stack ?? 1)], [5, 5, 0, 3, 1]];
            set.forEach(([cx, cy, rot, team, stack], i) => add({ kind, ...at(ri, ci, cx, cy), rot, team, ...(K.stack ? { stack } : {}), ...(K.gate && i === 1 ? { gate: GATE.open } : {}) }, i === 3 && (K.rubble || K.gate) ? PROP_STATE.rubble : 0, K.gate && i === 1 ? 'open' : null));
          }
        });
      });
      const mid = (ri) => at(ri, COLS / 2 - 0.5, 0, 3);
      const worst = spots.reduce((a, q) => Math.max(a, q.range), 0);
      return { rows: rows.map((r, ri) => ({ group: r.group, kinds: r.kinds, x: mid(ri).x, y: mid(ri).y })), range: worst, n: spots.reduce((a, q) => a + q.n, 0), props: game.map.props.length };
    });
  const what = arg('what', null); // schau: nur der Schauraum, karte: nur die echten Karten
  for (const [seed, season] of what === 'schau' ? [[3, 'summer'], [3, 'winter']] : [[3, 'summer'], [7, 'summer'], [3, 'winter']]) {
    const wx = season === 'winter' ? 'snow' : 'clear';
    const g = await openGame({ seed, query: `iso=1&three=1&shadows=high&weather=${season}&wx=${wx}`, scale: 1, out });
    try {
      const has3D = await g.run(() => !!window.__frontline.session().renderer.props3d);
      if (!has3D) throw new Error('Ansicht 3D nicht aktiv (WebGL oder three.js fehlt)');
      await g.run(async () => {
        const { AI } = await import('/js/ai/ai.js');
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
        s.camera.three = true;
        window.__ais = s.game.teams.map((_, t) => new AI(s.game, t, 'normal'));
      });
      const minutes = what === 'schau' ? [] : season === 'summer' ? [0, 10] : [0];
      for (const min of minutes) {
        if (min) {
          await g.run((min) => {
            const s = window.__frontline.session();
            while (s.game.time < min * 60) {
              for (const a of window.__ais) a.update(0.05);
              s.game.update(0.05);
            }
          }, min);
        }
        const spots = await findSpots(g);
        const tag = `seed${seed}-${season === 'winter' ? 'winter' : 'sommer'}-min${min}`;
        console.log(`Props ${tag}: Land ${spots.land.prop} Props der Karte + ${spots.land.small} Autos/Bänke/Ballen, Stadt ${spots.stadt.prop} + ${spots.stadt.small} im Fenster 1400²`);
        for (const [name, sp] of [['land', spots.land], ['stadt', spots.stadt]]) {
          for (let rot = 0; rot < 4; rot++) {
            if (min && rot) continue;
            await look(g, sp.x, sp.y, rot, 1);
            await mvpPair(g, dir, tag, `${name}-drehung${rot}`);
            report(`${tag} ${name} d${rot}`, await count(g));
          }
          if (season === 'summer' && seed === 3) {
            await look(g, sp.x, sp.y, 0, 1);
            await measureProps(g, `${name} (Seed ${seed}, ${min} min)`);
          }
        }
      }
      if (seed !== 3 || what === 'karte') continue;
      const show = await stageShow(g);
      const sTag = season === 'winter' ? 'schau-winter' : 'schau';
      console.log(`Props Schauraum ${season}: ${show.rows.length} Reihen, ${show.props} Props, Gelände ${show.range.toFixed(0)} px Höhenunterschied, Störpunkte im Abschnitt: ${show.n}`);
      for (let ri = 0; ri < show.rows.length; ri++) {
        const row = show.rows[ri];
        for (let rot = 0; rot < (season === 'winter' ? 1 : 4); rot++) {
          await look(g, row.x, row.y, rot, 1.1);
          await mvpPair(g, dir, sTag, `${String(ri).padStart(2, '0')}-${row.group}-drehung${rot}`);
          report(`${sTag} ${ri} ${row.group} d${rot}`, await count(g));
        }
      }
      if (season !== 'summer') continue;
      // Nacht an jeder Reihe (Drehung 0)
      await g.run(() => (window.__frontline.session().renderer.mood = 'night'));
      for (let ri = 0; ri < show.rows.length; ri++) {
        await look(g, show.rows[ri].x, show.rows[ri].y, 0, 1.1);
        await mvpPair(g, dir, 'schau-nacht', `${String(ri).padStart(2, '0')}-${show.rows[ri].group}`);
      }
      await g.run(() => (window.__frontline.session().renderer.mood = null));
      // Messung im Schauraum (Zoom 1, mittlere Reihe)
      await look(g, show.rows[2].x, show.rows[2].y, 0, 1);
      await measureProps(g, 'Schauraum');
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/**
 * Kartenstadt (Paket „Kartenstadt 3D“, im Teil baukasten mit --what kartenstadt oder ohne --what): je Art der Kartenstadt (Haus je Stil
 * und Farbe, Halle Sattel- und Tonnendach, Fabrik, Mauer, Zugteile, Wachturm, Bahnhof, Bahnsteig, Fabrikhalle, Strommast) ein echtes
 * Gebäude aus den Karten Seed 3 und East Europe Railway: Bogen gemalt (maptown.js drawMapIso) | 3D in den 4 Drehungen, je Stimmung
 * (Sommer/Winter × Tag/Nacht) nach <out>/baukasten/kartenstadt-<art>-<stimmung>.png, dazu je Hausstil ein Bogen mit allen Farben.
 * Prüft: Materialfotos geladen, 3D-Gebäude sichtbar, ein Draw-Call je Gebäude, Umriss in Drehung 0 wie gemalt (±BOX_TOL plus 8 % der Größe).
 */
async function kartenstadt(g, dir, save, BOX_TOL) {
  await g.run(async () => {
    const THREE = await import('/js/vendor/three/three.module.min.js');
    const { Camera, ISO_K } = await import('/js/render/camera.js');
    const { drawMapIso, setMapTown, mapInfo, pylonYaw } = await import('/js/render/maptown.js');
    const { setRoofSnow } = await import('/js/render/season.js');
    const { materialsReady } = await import('/js/render/materials.js');
    const { drawMood } = await import('/js/render/mood.js');
    const { LIGHT_ELEV } = await import('/js/render/ground.js');
    const { BALANCE } = await import('/js/data/balance.js');
    const { spriteFrame, spriteMissed } = await import('/js/render/spritecache.js');
    const { generateMap } = await import('/js/game/map.js');
    const { FIXED_MAPS } = await import('/js/data/maps/index.js');
    const kit = await import('/js/render3d/kit3d.js');
    const m3 = await import('/js/render3d/maptown3d.js');
    const { makeWorldRoot, makeIsoCamera, syncIsoCamera } = await import('/js/render3d/camera3d.js');
    const { Sun3D, CATCH, CAST } = await import('/js/render3d/sun3d.js');
    const mat = kit.makeKitMaterial();
    for (let i = 0; i < 100 && !(materialsReady() && kit.kitTexturesReady()); i++) await new Promise((ok) => setTimeout(ok, 50));
    // Vertreter je Art aus echten Karten
    const reps = new Map();
    for (const map of [generateMap(3), FIXED_MAPS[0].map]) {
      setMapTown(map);
      for (const b of map.town.buildings) {
        const info = mapInfo(b);
        let id = b.kind;
        if (b.kind === 'house') id = `${info.style}-${info.c}`;
        else if (b.kind === 'train') id = `train-${b.part}`;
        else if (b.kind === 'hall') id = `hall-${info.vault ? 'tonne' : 'sattel'}`;
        else if (b.kind === 'wall' && Math.max(b.w, b.h) > 150) continue;
        if (!reps.has(id)) reps.set(id, { b, map });
      }
    }
    window.__mapReps = [...reps.keys()];
    const DPR = 2;
    const BG = '#7a9e58';
    const bg = [0x7a, 0x9e, 0x58];
    const cv = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
    gl.setPixelRatio(DPR);
    const scene = new THREE.Scene();
    const root = makeWorldRoot();
    scene.add(root);
    const cam3 = makeIsoCamera();
    const ground = new THREE.BufferGeometry();
    const MW = BALANCE.map.width;
    const MH = BALANCE.map.height;
    ground.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, MW, 0, 0, MW, MH, 0, 0, 0, 0, MW, MH, 0, 0, MH, 0], 3));
    const sun = new Sun3D(gl, scene, root, ground);
    const canvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w * DPR;
      c.height = h * DPR;
      return c;
    };
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
    const light0 = (rot) => {
      const [, , rc, rd] = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][rot];
      const a = Math.atan2(-rd, -rc) + 0.35;
      const k = Math.sqrt(1 - LIGHT_ELEV * LIGHT_ELEV);
      return [Math.cos(a) * k, Math.sin(a) * k, LIGHT_ELEV];
    };
    window.__kitMap = ({ id, season, night, rots }) => {
      const { b, map } = reps.get(id);
      setMapTown(map);
      const geo = m3.mapTownGeometry(b);
      const sc = m3.mapTownScale(b) ?? [1, 1];
      const tall = geo.boundingBox.max.z + 10;
      const dia = (b.w + b.h) * ISO_K;
      const ZOOM = Math.min(2.2, 420 / (dia + 40));
      const py = (tall + dia * 0.25 + 6) * ZOOM;
      const W = Math.round((dia + 40) * ZOOM);
      const H = Math.round(py + (dia * 0.25 + 10) * ZOOM);
      const cam = new Camera(MW, MH);
      cam.iso = true;
      cam.resize(W, H);
      const aim = (rot) => {
        cam.rot = rot;
        cam.zoom = ZOOM;
        cam.x = b.x;
        cam.y = b.y;
        const p = cam.screenToWorldFlat(W / 2, H - py);
        cam.x = p.x;
        cam.y = p.y;
      };
      const mood = night ? 'night' : null;
      setRoofSnow(season === 'winter');
      const painted = canvas(W, H);
      const pc = painted.getContext('2d');
      aim(0);
      for (let i = 0; i < 16; i++) {
        spriteFrame(DPR);
        pc.setTransform(DPR, 0, 0, DPR, 0, 0);
        pc.fillStyle = BG;
        pc.fillRect(0, 0, W, H);
        drawMapIso(pc, cam, b);
        if (!spriteMissed()) break;
      }
      setRoofSnow(false);
      gl.setSize(W, H, false);
      sun.setLevel('high');
      sun.setMood(mood);
      const mesh = new THREE.InstancedMesh(geo, mat, 1);
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(b.x, b.y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), m3.mapTownYaw(b, b.kind === 'pylon' ? pylonYaw(b) : 0)), new THREE.Vector3(sc[0], sc[1], 1));
      mesh.setMatrixAt(0, m);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.layers.enable(CAST);
      root.add(mesh);
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
        c.getContext('2d').drawImage(cv, 0, 0);
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
      mesh.dispose();
      const boxes = { painted: bbox(painted), three: bbox(flat0) };
      if (mood) {
        for (const c of [painted, ...panels]) {
          const x = c.getContext('2d');
          x.setTransform(DPR, 0, 0, DPR, 0, 0);
          drawMood(x, mood, W, H);
        }
      }
      return { painted, panels, W, H, tris: (geo.getAttribute('position').count / 3) | 0, calls, boxes, tex: kit.kitTexturesReady(), size: Math.max(b.w, b.h) };
    };
    /** Bogen aus Zeilen von Feldern (Leinwand, Beschriftung), jede Zeile so hoch wie ihr höchstes Feld. */
    window.__mapSheet = (rows) => {
      const gap = 6;
      const rh = rows.map((r) => Math.max(...r.map(([c]) => c.height / DPR)));
      const rw = rows.map((r) => r.reduce((a, [c]) => a + c.width / DPR + gap, -gap));
      const sheet = document.createElement('canvas');
      sheet.width = Math.max(...rw) * DPR;
      sheet.height = (rh.reduce((a, v) => a + v + gap, -gap)) * DPR;
      const sc = sheet.getContext('2d');
      sc.fillStyle = '#111';
      sc.fillRect(0, 0, sheet.width, sheet.height);
      let y = 0;
      rows.forEach((row, j) => {
        let x = 0;
        for (const [c, t] of row) {
          sc.setTransform(DPR, 0, 0, DPR, x * DPR, y * DPR);
          sc.drawImage(c, 0, 0, c.width / DPR, c.height / DPR);
          sc.font = 'bold 13px sans-serif';
          sc.fillStyle = 'rgba(0,0,0,.6)';
          sc.fillRect(4, c.height / DPR - 22, sc.measureText(t).width + 8, 18);
          sc.fillStyle = '#fff';
          sc.fillText(t, 8, c.height / DPR - 8);
          x += c.width / DPR + gap;
        }
        y += rh[j] + gap;
      });
      return sheet.toDataURL('image/png');
    };
  });
  const ids = await g.run(() => window.__mapReps);
  const trisOf = {};
  const worst = [];
  const first = new Set(); // Häuser: Stimmungen nur für die erste Farbe je Stil (die Farben stehen im Bogen …-farben)
  for (const id of ids) {
    const style = id.match(/^(alt|klinker|fach|neu|farm)-/)?.[1];
    if (style && first.has(style)) continue;
    if (style) first.add(style);
    for (const season of ['summer', 'winter']) {
      for (const night of [false, true]) {
        const name = `kartenstadt-${id}-${season}-${night ? 'nacht' : 'tag'}`;
        const res = await g.run(({ id, season, night }) => {
          const r = window.__kitMap({ id, season, night, rots: [0, 1, 2, 3] });
          return { url: window.__mapSheet([[[r.painted, `${id} gemalt`], ...r.panels.map((c, i) => [c, `3D Drehung ${i}`])]]), tris: r.tris, calls: r.calls, boxes: r.boxes, tex: r.tex, size: r.size };
        }, { id, season, night });
        await save(name, res.url);
        const [p, t] = [res.boxes.painted, res.boxes.three];
        const dev = Math.max(...p.map((v, i) => Math.abs(v - t[i])));
        const tol = BOX_TOL + 0.08 * res.size;
        trisOf[id] = res.tris;
        const bad = !res.tex || t[2] < 0 || res.calls !== 1 || (!night && dev > tol);
        if (bad) fail++;
        if (!night) worst.push([dev, id, season]);
        if (bad || (season === 'summer' && !night)) {
          console.log(`Kartenstadt ${id} ${season} ${night ? 'Nacht' : 'Tag'}: ${res.tris} Dreiecke, ${res.calls} Draw-Call(s), Umriss gemalt ${p.join(',')} / 3D ${t.join(',')} (±${dev} px, Grenze ${tol.toFixed(0)})${res.tex ? '' : ', Fotos fehlen'}${bad ? '  FEHLER' : ''}`);
        }
      }
    }
  }
  // Farben der Hausstile: je Stil eine Zeile je Farbe (gemalt | 3D Drehung 0)
  for (const style of ['alt', 'klinker', 'fach', 'neu', 'farm']) {
    const res = await g.run(({ style, ids }) => {
      const rows = [];
      for (const id of ids.filter((i) => i.startsWith(`${style}-`))) {
        const r = window.__kitMap({ id, season: 'summer', night: false, rots: [0] });
        rows.push([[r.painted, `${id} gemalt`], [r.panels[0], `${id} 3D`]]);
      }
      return rows.length ? window.__mapSheet(rows) : null;
    }, { style, ids });
    if (res) await save(`kartenstadt-${style}-farben`, res);
  }
  console.log(`Kartenstadt: Dreiecke je Variante ${Object.entries(trisOf).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  worst.sort((a, b) => b[0] - a[0]);
  console.log(`Kartenstadt: größte Umrissabweichung ${worst.slice(0, 3).map(([d, id, s]) => `${id} ${s} ${d} px`).join(', ')}`);
}

/**
 * Teil „karte“ (Paket „Kartenstadt 3D“, --only karte, läuft auch ohne --only): Ausschnitte echter Karten, in denen die Kartenstadt zu
 * sehen ist (Seed 3 Stadtmitte Sommer und Winter, Seed 7, feste Karte East Europe Railway: Fabrikhalle, Bahnhof, Mastlinie), Fotos Iso | 3D
 * in 4 Drehungen nach <out>/karte/. Messung je Ausschnitt (Drehung 0, Zoom 1, Software-WebGL): Draw-Calls, Dreiecke und Zeit „Objekte“ mit
 * gemalter Kartenstadt (maptown3dOn = false) und in 3D, Schatten Aus und Hoch. Fehler, wenn in 3D kein Gebäude der Kartenstadt als Mesh
 * erscheint (an der Mastlinie: keine Leitung).
 */
async function karte() {
  const dir = join(out, 'karte');
  await mkdir(dir, { recursive: true });
  const runs = [
    ['seed3', 3, false, 'summer'],
    ['seed3', 3, false, 'winter'],
    ['seed7', 7, false, 'summer'],
    ['fest', 3, true, 'summer'],
    ['fest', 3, true, 'winter'],
  ];
  const want = arg('karte', null)?.split(','); // --karte seed7,fest: nur diese Karten (Standard alle)
  for (const [name, seed, fixed, season] of runs) {
    if (want && !want.includes(name)) continue;
    const wx = season === 'winter' ? 'snow' : 'clear';
    const g = await openGame({ seed, query: `iso=1&three=1&shadows=high&weather=${season}&wx=${wx}`, scale: 1, out, start: !fixed });
    try {
      if (fixed) {
        await g.page.evaluate(() => localStorage.setItem('frontline-kartenwahl', 'fest:east-europe-railway'));
        await g.page.reload();
        await g.page.waitForTimeout(1000);
        await g.press('button.primary');
        await g.page.waitForFunction(() => window.__frontline?.session()?.game);
        await g.page.waitForTimeout(1500);
      }
      const spots = await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
        s.camera.three = true;
        const bl = s.game.map.town.buildings;
        const R = 420;
        const near = (c, kinds) => bl.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < R && (!kinds || kinds.includes(o.kind)));
        const centroid = (list) => ({ x: list.reduce((a, o) => a + o.x, 0) / list.length, y: list.reduce((a, o) => a + o.y, 0) / list.length });
        let best = null;
        for (const b of bl) {
          if (b.kind !== 'house') continue;
          const n = near(b, ['house', 'hall', 'factory']).length;
          if (!best || n > best.n) best = { n, b };
        }
        const out = [];
        if (best) {
          const list = near(best.b, ['house', 'hall', 'factory']);
          out.push({ name: 'stadt', ...centroid(list), n: list.length, kinds: [...new Set(list.map((o) => o.kind))].join(',') });
        }
        for (const kind of ['plant', 'station', 'tower', 'wall']) {
          const b = bl.find((o) => o.kind === kind);
          if (b && (kind !== 'wall' || out.length < 3)) out.push({ name: kind, x: b.x, y: b.y, n: near(b).length, kinds: kind });
        }
        const py = bl.filter((o) => o.kind === 'pylon');
        if (py.length > 2) {
          const m = py[Math.floor(py.length / 2)];
          out.push({ name: 'masten', x: m.x, y: m.y, n: py.length, kinds: 'pylon' });
        }
        return out;
      });
      for (const spot of spots) {
        if (!fixed && spot.name !== 'stadt' && spot.name !== 'tower') continue; // zufällige Karten: Stadtmitte und Wachturm
        if (fixed && spot.name === 'wall') continue;
        console.log(`Karte ${name} ${season} ${spot.name}: ${spot.n} Gebäude in der Nähe (${spot.kinds})`);
        const tag = `${name}-${season}-${spot.name}`;
        for (let rot = 0; rot < 4; rot++) {
          await look(g, spot.x, spot.y, rot, spot.name === 'plant' ? 0.7 : 1);
          await mvpPair(g, dir, tag, `drehung${rot}`);
        }
        if (season !== 'summer') continue;
        await look(g, spot.x, spot.y, 0, spot.name === 'plant' ? 0.7 : 1);
        // gleiche Menge: jedes nicht zerstörte Gebäude der Kartenstadt im Bild wird in Iso gemalt (alle Bilder fertig) und in 3D ein Mesh
        const same = await g.run(async () => {
          const s = window.__frontline.session();
          const r = s.renderer;
          const { spriteMissed } = await import('/js/render/spritecache.js');
          const { hasMapTown3d } = await import('/js/render3d/maptown3d.js');
          const orig = r.drawTownItemIso;
          const count = (three) => {
            s.camera.three = three;
            r.maptown3dOn = true;
            let n = 0;
            r.drawTownItemIso = function (f, o) {
              const hs = f.g.houseBySrc?.get(o);
              if (hasMapTown3d(o) && !(hs && hs.ruined && f.known(hs.x, hs.y))) n++;
              return orig.call(this, f, o);
            };
            try {
              for (let i = 0; i < 3 || (spriteMissed() && i < 150); i++) {
                n = 0;
                r.render(s.controller.view);
              }
            } finally {
              r.drawTownItemIso = orig;
            }
            return { n, missed: spriteMissed() };
          };
          const iso = count(false);
          const d3 = count(true);
          return { iso, d3, meshes: r.towns3d.stats('maptown').houses };
        });
        const sameOk = same.iso.n === same.d3.n && same.d3.n === same.meshes && !same.iso.missed;
        if (!sameOk) fail++;
        console.log(`Karte ${tag}: gleiche Menge Iso ${same.iso.n} gemalt (fehlende Bilder: ${same.iso.missed}), 3D ${same.d3.n} Gebäude, ${same.meshes} Meshes${sameOk ? '' : '  FEHLER'}`);
        const rows = [];
        let any = 0;
        for (const level of ['off', 'high']) {
          for (const on of [false, true]) {
            const st = await g.run(({ level, on }) => {
              const s = window.__frontline.session();
              const r = s.renderer;
              s.camera.three = true;
              r.setShadows(level);
              r.maptown3dOn = on;
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
              return { ...obj, map: r.towns3d.stats('maptown'), wires: r.wires3d.mesh.visible ? r.wires3d.count : 0 };
            }, { level, on });
            const t = await timePasses(g, frames);
            if (on && !st.map.houses) fail++;
            if (on && spot.name === 'masten' && !st.wires) fail++;
            if (on) any += st.map.houses;
            rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (on ? ` (Kartenstadt: ${st.map.houses} Gebäude/${st.map.calls} Varianten/${st.map.tris} Dreiecke${st.wires ? `, ${st.wires} Leitungsfelder` : ''})` : ''));
          }
        }
        await g.run(() => {
          window.__frontline.session().renderer.maptown3dOn = true;
        });
        console.log(`Karte Messung ${tag} (Zoom ${spot.name === 'plant' ? 0.7 : 1}, ${frames} Bilder, Software-WebGL; Draw-Calls und Dreiecke in „Objekte“ samt Schattenkarte):`);
        for (const r of rows) console.log(`  ${r}`);
        if (!any) console.log('  FEHLER: keine Kartenstadt in 3D');
      }
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/**
 * Teil „bruecke“ (--only bruecke, läuft auch ohne --only), Paket „Brücken 3D“: Brücken und Furtstangen (render/bridge.js) gemalt neben 3D.
 * Karten mit Fluss: Seed 3 (Sommer, Winter), Seed 7, feste Karte East Europe Railway (Eisenbahnbrücke, Sommer, Winter); Spiel angehalten,
 * Schatten Hoch. Je Karte die Brücke nächst der Hauptstadt (feste Karte: die Eisenbahnbrücke) mit drei Panzern auf der Fahrbahn, Iso | 3D (<out>/bruecke/): 4 Drehungen, Seed 3
 * Sommer zusätzlich Nacht, Zoom 0,5 und 1,6, beschädigt, zerstört, im Wiederaufbau, die Furt mit den Furtstangen (4 Drehungen).
 * Prüft: (1) gleiche Menge: Brücken und Furtstangen, die Iso malt (alle gemalten Bilder fertig) = Zahl der Einträge der Objektliste in 3D
 * = Zahl der Instanzen von Bridge3D (sonst Fehler); (2) Einheiten auf der Brücke stehen auf der Fahrbahn: Mesh der Einheit auf b.deckH
 * (game.groundHeight), Unterkante nicht unter der Fahrbahn, Brücke selbst auf derselben Höhe; (3) Messung Draw-Calls, Dreiecke und Zeit
 * „Objekte“ gemalt gegen 3D, Schatten Aus und Hoch (bridge3dOn).
 */
async function bridgePart() {
  const dir = join(out, 'bruecke');
  await mkdir(dir, { recursive: true });
  const runs = [
    ['seed3', 3, false, 'summer'],
    ['seed3', 3, false, 'winter'],
    ['seed7', 7, false, 'summer'],
    ['fest', 3, true, 'summer'],
    ['fest', 3, true, 'winter'],
  ];
  const want = arg('karte', null)?.split(','); // --karte seed3,fest: nur diese Karten (Standard alle)
  for (const [name, seed, fixed, season] of runs) {
    if (want && !want.includes(name)) continue;
    const tag = `${name}-${season}`;
    const wx = season === 'winter' ? 'snow' : 'clear';
    const g = await openGame({ seed, query: `iso=1&three=1&shadows=high&river=1&weather=${season}&wx=${wx}`, scale: 1, out, start: !fixed });
    try {
      if (fixed) {
        await g.page.evaluate(() => localStorage.setItem('frontline-kartenwahl', 'fest:east-europe-railway'));
        await g.page.reload();
        await g.page.waitForTimeout(1000);
        await g.press('button.primary');
        await g.page.waitForFunction(() => window.__frontline?.session()?.game);
        await g.page.waitForTimeout(1500);
      }
      const spot = await g.run(async () => {
        const { fordPosts } = await import('/js/render/bridge.js');
        const { bridgeUnder } = await import('/js/game/river.js');
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
        s.camera.three = true;
        const game = s.game;
        const hq = game.buildings.find((b) => b.main && b.team === 0) ?? { x: game.map.width / 2, y: game.map.height / 2 };
        const bs = [...(game.bridges ?? [])].sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
        const b = bs.find((v) => v.src?.rail) ?? bs[0]; // feste Karte: die Eisenbahnbrücke
        if (!b) return null;
        // drei Panzer auf der Fahrbahn (30, 50 und 70 % der Wasserstrecke)
        const ids = [];
        for (const f of [0.3, 0.5, 0.7]) {
          const u = b.span[0] + (b.span[1] - b.span[0]) * f;
          const t = game.spawnUnit('tank', 0, b.x1 + Math.cos(b.angle) * u, b.y1 + Math.sin(b.angle) * u);
          if (t) ids.push(t.id);
        }
        // Furt mit den meisten Furtstangen
        const posts = fordPosts(game.map, game.relief);
        let ford = null;
        for (const f of game.map.fords ?? []) {
          const n = posts.filter((p) => Math.hypot(p.x - f.x, p.y - f.y) < f.r * 1.2).length;
          if (!ford || n > ford.n) ford = { x: f.x, y: f.y, n };
        }
        const on = ids.filter((id) => {
          const u = game.entities.get(id);
          return bridgeUnder(game, u.x, u.y);
        }).length;
        return { x: b.x, y: b.y, id: b.id, len: Math.round(b.len), rail: !!b.src?.rail, ids, onBridge: on, bridges: game.bridges.length, posts: posts.length, ford };
      });
      if (!spot) throw new Error(`${tag}: keine Brücke`);
      console.log(`Brücke ${tag}: ${spot.bridges} Brücken, nächste ${spot.len} px${spot.rail ? ' (Eisenbahn)' : ''}, ${spot.posts} Furtstangen, ${spot.onBridge}/${spot.ids.length} Panzer auf der Fahrbahn`);
      if (!spot.ids.length || spot.onBridge < spot.ids.length) fail++;
      // Einheiten aus- und einblenden (eine zerstörte Brücke trägt keine), Zustand der Brücke setzen
      const units = (alive) =>
        g.run(({ ids, alive }) => {
          const game = window.__frontline.session().game;
          for (const id of ids) {
            const u = game.entities.get(id);
            if (u) u.alive = alive;
          }
        }, { ids: spot.ids, alive });
      const setBridge = (o) =>
        g.run(({ id, o }) => {
          const b = window.__frontline.session().game.bridges.find((v) => v.id === id);
          if ('hpFrac' in o) b.hp = b.maxHp * o.hpFrac;
          Object.assign(b, { ...o, hpFrac: undefined });
          delete b.hpFrac;
        }, { id: spot.id, o });
      for (let rot = 0; rot < 4; rot++) {
        await look(g, spot.x, spot.y, rot, 1);
        await mvpPair(g, dir, tag, `intakt-drehung${rot}`);
      }
      if (name === 'seed3' && season === 'summer') {
        await g.run(() => (window.__frontline.session().renderer.mood = 'night'));
        await look(g, spot.x, spot.y, 0, 1);
        await mvpPair(g, dir, tag, 'intakt-nacht');
        await g.run(() => (window.__frontline.session().renderer.mood = null));
        for (const zoom of [0.5, 1.6]) {
          await look(g, spot.x, spot.y, 0, zoom);
          await mvpPair(g, dir, tag, `intakt-zoom${zoom}`);
        }
        await setBridge({ hpFrac: 0.4 });
        await look(g, spot.x, spot.y, 0, 1);
        await mvpPair(g, dir, tag, 'beschaedigt');
        await setBridge({ hpFrac: 1 });
        // zerstört und im Wiederaufbau (ohne Einheiten: sie stünden im Wasser)
        await units(false);
        await setBridge({ broken: true });
        for (const rot of [0, 2]) {
          await look(g, spot.x, spot.y, rot, 1);
          await mvpPair(g, dir, tag, `zerstoert-drehung${rot}`);
        }
        await setBridge({ rebuild: { team: 0, progress: 0.5 } });
        await look(g, spot.x, spot.y, 0, 1);
        await mvpPair(g, dir, tag, 'wiederaufbau');
        await setBridge({ broken: false, rebuild: null });
        await units(true);
      }
      if (spot.ford?.n) {
        await units(false);
        for (const rot of name === 'seed3' && season === 'summer' ? [0, 1, 2, 3] : [0]) {
          await look(g, spot.ford.x, spot.ford.y, rot, 1.6);
          await mvpPair(g, dir, tag, `furt-drehung${rot}`);
        }
        await units(true);
      }
      await look(g, spot.x, spot.y, 0, 1);
      // 1. gleiche Menge und 2. Einheiten auf der Fahrbahn
      const same = await g.run(async ({ ids, id }) => {
        const s = window.__frontline.session();
        const r = s.renderer;
        const { spriteMissed } = await import('/js/render/spritecache.js');
        const origGround = r.isoGround;
        const origItems = r.isoItems;
        const frame = (three) => {
          s.camera.three = three;
          r.bridge3dOn = true;
          let st = { bridges: 0, t17: 0, t12: 0 };
          r.isoGround = function (f) {
            st.bridges = (f.g.bridges ?? []).filter((b) => f.inRect(b.x, b.y, b.len / 2 + 260)).length;
            return origGround.call(this, f);
          };
          r.isoItems = function (f) {
            const res = origItems.call(this, f);
            st.t17 = res.items.filter((it) => it.t === 17).length;
            st.t12 = res.items.filter((it) => it.t === 12).length;
            return res;
          };
          try {
            for (let i = 0; i < 3 || (spriteMissed() && i < 150); i++) {
              st = { bridges: 0, t17: 0, t12: 0 };
              r.render(s.controller.view);
            }
          } finally {
            r.isoGround = origGround;
            r.isoItems = origItems;
          }
          return { ...st, missed: spriteMissed() };
        };
        const iso = frame(false);
        const d3 = frame(true);
        const stats = r.bridges3d.stats();
        // Einheiten: Mesh auf der Fahrbahn
        const game = s.game;
        const b = game.bridges.find((v) => v.id === id);
        const { unitLift } = await import('/js/render/iso.js');
        const units = ids.map((uid) => {
          const u = game.entities.get(uid);
          const e = r.units3d.pool.get(uid);
          const bb = e.hull.geometry.boundingBox;
          // wie überall in 3D und Iso: Einheit um unitLift über dem Boden (hier: der Fahrbahn)
          return { z: e.hull.position.z - unitLift(u), foot: e.hull.position.z + bb.min.z * e.hull.scale.z - unitLift(u), visible: e.hull.visible, ground: game.groundHeight(u) };
        });
        const water = (await import('/js/game/relief.js')).RELIEF.water;
        return { iso, d3, stats, units, deck: b.deckH, meshTop: r.bridges3d.entries.get(b).mesh.instanceMatrix.array[14] + 0, water };
      }, { ids: spot.ids, id: spot.id });
      const sameOk = same.iso.bridges === same.d3.t17 && same.d3.t17 === same.stats.bridges && same.iso.t12 === same.d3.t12 && same.d3.t12 === same.stats.posts && !same.iso.missed && same.stats.bridges > 0;
      if (!sameOk) fail++;
      console.log(`Brücke ${tag}: gleiche Menge Iso ${same.iso.bridges} Brücken und ${same.iso.t12} Furtstangen gemalt (fehlende Bilder: ${same.iso.missed}), 3D Liste ${same.d3.t17} und ${same.d3.t12}, Instanzen ${same.stats.bridges} und ${same.stats.posts}${sameOk ? '' : '  FEHLER'}`);
      const stands = same.units.every((u) => u.visible && Math.abs(u.z - same.deck) < 0.01 && Math.abs(u.ground - same.deck) < 0.01 && u.foot >= same.deck - 0.5) && Math.abs(same.meshTop - same.water) < 1e-6;
      if (!stands) fail++;
      console.log(`Brücke ${tag}: Einheiten auf der Fahrbahn: Mesh z (ohne unitLift) ${same.units.map((u) => u.z.toFixed(1)).join(', ')}, Unterkante ${same.units.map((u) => u.foot.toFixed(1)).join(', ')}, Fahrbahn b.deckH ${same.deck.toFixed(1)}${stands ? '' : '  FEHLER'}`);
      if (name !== 'seed3' || season !== 'summer') continue;
      // 3. Messung: Draw-Calls, Dreiecke, Zeit „Objekte“, gemalt gegen 3D, Schatten Aus und Hoch
      const rows = [];
      for (const level of ['off', 'high']) {
        for (const on of [false, true]) {
          const st = await g.run(({ level, on }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.bridge3dOn = on;
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
            return { ...obj, br: r.bridges3d.stats() };
          }, { level, on });
          const t = await timePasses(g, frames);
          rows.push(`${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Objekte ${t.Objekte.toFixed(0)} ms, ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (on ? ` (Brücken: ${st.br.bridges} und ${st.br.posts} Furtstangen in ${st.br.calls} Netzen, ${st.br.tris} Dreiecke)` : ''));
        }
      }
      await g.run(() => {
        const r = window.__frontline.session().renderer;
        r.bridge3dOn = true;
        r.setShadows('high');
      });
      console.log(`Brücke Messung ${tag} (Zoom 1, ${frames} Bilder, Software-WebGL; „Objekte“ samt Schattenkarte):`);
      for (const r of rows) console.log(`  ${r}`);
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

// Freie Kamera (Paket „Freie Kamera“, --only freikamera): 8 Drehwinkel × Neigung 30°/45°/60°; Prüfwürfel (three gegen camera.worldToScreen),
// Fotos einer Spielszene, Klick, Ziehrahmen und Fahrbefehl mit echter Maus (<out>/freikamera/).
const FREE_YAWS = [0, 45, 90, 135, 180, 225, 270, 315];
const FREE_TILTS = String(arg('neigung', '30,45,60')).split(',').map(Number); // --neigung 30 für einen kurzen Lauf
const freeView = (g, yaw, tilt, zoom = 1) =>
  g.run(
    ({ yaw, tilt, zoom }) => {
      const s = window.__frontline.session();
      const cam = s.camera;
      cam.rot = 0;
      cam.turn = 0;
      cam.turnBy((yaw * Math.PI) / 180);
      cam.setTilt((tilt * Math.PI) / 180);
      cam.zoom = zoom;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      cam.centerOn(hq?.x ?? cam.mapW / 2, hq?.y ?? cam.mapH / 2);
      for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    },
    { yaw, tilt, zoom },
  );

async function freeCamera() {
  const dir = 'freikamera';
  await mkdir(join(out, dir), { recursive: true });
  // 1. Prüfwürfel: three-Bild gegen camera.worldToScreen
  let g = await openGame({ seed: 3, query: 'three=1&cubes=1&iso=1', scale, out });
  try {
    console.log('Freie Kamera, Prüfwürfel: Neigung  Drehung  größte Abweichung (px)');
    for (const tilt of FREE_TILTS) {
      for (const yaw of FREE_YAWS) {
        for (const zoom of [0.5, 1.4]) {
          await freeView(g, yaw, tilt, zoom);
          const res = await g.run(() => window.__frontline.session().renderer.probe());
          const worst = res.reduce((a, b) => (b.d > a.d ? b : a));
          if (worst.d >= LIMIT || !Number.isFinite(worst.d)) fail++;
          if (zoom === 1.4) console.log(`  ${String(tilt).padStart(2)}°  ${String(yaw).padStart(3)}°  ${worst.d.toFixed(4)}${worst.d >= LIMIT ? '  FEHLER' : ''}`);
        }
      }
    }
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
  // 2. Spielszene: Fotos, Klick, Ziehrahmen, Fahrbefehl
  g = await openGame({ seed: 3, query: 'three=1&iso=1', scale, out });
  try {
    const { page } = g;
    const u = await g.run(() => {
      const s = window.__frontline.session();
      s.loop.paused = true;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const t = s.game.spawnUnit('tank', 0, hq.x + 260, hq.y + 200);
      return t ? { id: t.id, x: t.x, y: t.y } : null;
    });
    if (!u) throw new Error('Panzer für die Auswahl nicht gesetzt');
    const screenOf = (wx, wy) =>
      g.run(({ wx, wy }) => {
        const s = window.__frontline.session();
        const p = s.camera.worldToScreen(wx, wy);
        const r = s.renderer.canvas.getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
      }, { wx, wy });
    const unitNow = () => g.run((id) => {
      const t = window.__frontline.session().game.units.find((v) => v.id === id);
      return { x: t.x, y: t.y, sel: window.__frontline.session().controller.view.selection.has(id), order: t.order };
    }, u.id);
    const clear = () => g.run(() => {
      const s = window.__frontline.session();
      s.controller.view.selection.clear();
      s.controller.cancel?.();
    });
    console.log('Freie Kamera, Bedienung: Neigung  Drehung  Klick  Rahmen (gewählt)  Rechtsklick (Strahl: Abstand Bodenpunkt, Ziel: Abstand Fahrziel, Welt-px)');
    for (const tilt of FREE_TILTS) {
      for (const yaw of FREE_YAWS) {
        await freeView(g, yaw, tilt, 1.2);
        await g.run((id) => {
          const s = window.__frontline.session();
          const t = s.game.units.find((v) => v.id === id);
          s.camera.centerOn(t.x, t.y);
          for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
        }, u.id);
        await g.shot(`${dir}/neigung${tilt}-dreh${String(yaw).padStart(3, '0')}`);
        const now = await unitNow();
        // Klick auf den Panzer
        await clear();
        let p = await screenOf(now.x, now.y);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(120);
        const click = (await unitNow()).sel;
        // Ziehrahmen um den Panzer
        await clear();
        await page.mouse.move(p.x - 50, p.y - 50);
        await page.mouse.down();
        await page.mouse.move(p.x, p.y, { steps: 4 });
        await page.mouse.move(p.x + 50, p.y + 40, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(120);
        const box = (await unitNow()).sel;
        const boxN = await g.run(() => window.__frontline.session().controller.view.selection.size);
        // Fahrbefehl nur für den Panzer (fängt der Rahmen Soldaten mit, führe die Gruppe in Formation: Ziel des Panzers versetzt)
        await g.run((id) => {
          const sel = window.__frontline.session().controller.view.selection;
          sel.clear();
          sel.add(id);
        }, u.id);
        // Fahrbefehl: Rechtsklick auf einen Bodenpunkt 180 Welt-px daneben (gewählt)
        const tx = now.x + 180;
        const ty = now.y - 120;
        const q = await screenOf(tx, ty);
        // Sichtstrahl (Kamera) und was unter dem Zeiger liegt (dann richtet das Spiel den Befehl auf das Objekt aus)
        const aim = await g.run(({ x, y }) => {
          const s = window.__frontline.session();
          const r = s.renderer.canvas.getBoundingClientRect();
          const w = s.camera.screenToWorld(x - r.left, y - r.top);
          const c = s.controller;
          const hit = c.pick(w.x, w.y) ?? c.pickHouse?.(w.x, w.y) ?? c.pickCity?.(w.x, w.y) ?? c.pickBridge?.(w.x, w.y) ?? null;
          return { x: w.x, y: w.y, hit: hit ? hit.type ?? hit.kind ?? 'Objekt' : null };
        }, q);
        const ray = Math.hypot(aim.x - tx, aim.y - ty);
        await page.mouse.click(q.x, q.y, { button: 'right' });
        await page.waitForTimeout(120);
        const o = (await unitNow()).order;
        const d = o && Number.isFinite(o.x) ? Math.hypot(o.x - tx, o.y - ty) : Infinity;
        const ok = click && box && ray < 2 && (aim.hit || d < 16);
        if (!ok) fail++;
        const what = aim.hit ? ` (unter dem Zeiger: ${aim.hit}, Befehl ${o?.type ?? '–'})` : '';
        console.log(`  ${String(tilt).padStart(2)}°  ${String(yaw).padStart(3)}°  ${click ? 'ja  ' : 'NEIN'}   ${box ? `ja (${boxN})` : 'NEIN'}    Strahl ${ray.toFixed(2)}, Ziel ${Number.isFinite(d) ? d.toFixed(1) : 'kein Befehl'}${what}${ok ? '' : '  FEHLER'}`);
        await g.run(({ id, x, y }) => {
          const t = window.__frontline.session().game.units.find((v) => v.id === id);
          t.order = { type: 'idle' };
          t.path = [];
          t.x = x;
          t.y = y;
        }, { id: u.id, x: now.x, y: now.y });
      }
    }
    // stufenloses Drehen mit gehaltener Taste (Ansicht 3D) und Neigen mit Umschalt + Mausrad
    await freeView(g, 0, 30, 1);
    await g.run(() => (window.__frontline.session().loop.paused = false));
    await page.keyboard.down('.');
    await page.waitForTimeout(500);
    await page.keyboard.up('.');
    const box = await g.run(() => window.__frontline.session().canvas?.getBoundingClientRect?.() ?? document.querySelector('canvas').getBoundingClientRect());
    await page.mouse.move(box.left + box.width / 2, box.top + box.height / 2);
    await page.keyboard.down('Shift');
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);
    const st = await g.run(() => {
      const c = window.__frontline.session().camera;
      return { yaw: (c.yaw() * 180) / Math.PI, tilt: (c.tilt * 180) / Math.PI };
    });
    // Software-WebGL bei Pixeldichte 2: wenige Bilder je Sekunde (die Schleife begrenzt dt je Bild) und halbe Raddeltas; nur „sichtbar gedreht/geneigt“
    const turned = st.yaw > 3 && st.yaw < 90;
    const tilted = st.tilt > 33 && st.tilt <= 60;
    if (!turned || !tilted) fail++;
    console.log(`  Taste . 0,5 s: Drehung ${st.yaw.toFixed(1)}°${turned ? '' : '  FEHLER'}; Umschalt + 3 Rasten: Neigung ${st.tilt.toFixed(1)}°${tilted ? '' : '  FEHLER'}`);
    await g.shot(`${dir}/tasten`);
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/**
 * Teil „wege“ (--only wege [--karte seed3,seed7,fest], läuft auch ohne --only), Paket „Straßen und Wege 3D“: Stadtstraßen, Feldwege, Gleise, Felder und Pflaster
 * als Bodenschicht (render3d/ways3d.js) gemalt neben 3D. Karten: Seed 3 und 7 (Spiel nach --citymin Minuten KI gegen KI, mit Stadt), East Europe Railway (nach 3 Minuten);
 * Spiel angehalten, Schatten Hoch, Fluss. Je Karte Ausschnitte (<out>/wege/): steilster Hang an einem Feldweg bzw. Gleis (Zoom 1,6 und 1, 4 Drehungen), Stadt (4 Drehungen,
 * Sommer, Winter, Nacht), Gleis, Feld, Brückenanschluss, Pflaster (eingesetzt: Platz und Bürgersteig am Hang); Fotos Iso | 3D und gemalt | 3D (nur die Bodenschicht anders).
 * Prüft: (1) Treffer: mit eingefärbter Schicht (renderer.ways3d.tint) und ohne Objekte liegen die Mittelpunkte der Straßen, Wege, Gleise, Felder und des Pflasters
 * im Bild (an camera.worldToScreen) auf der Schicht, auch am Hang (mindestens COVER %); (2) 3D mit Schicht und 3D mit gemalter Schicht unterscheiden sich im Ausschnitt um höchstens
 * WEGE_DIFF % der Pixel (am steilen Feld bis 10 %: die Schicht trägt die Hangbeleuchtung des Bodens); (3) Neumalen nur bei Änderung (unverändert: 0 Kacheln in 5 Bildern); (4) Iso und 2D malen die Schicht wie bisher (ways3dShown aus); (5) Messung Draw-Calls,
 * Dreiecke und Zeit „Gelände“ + „Boden“ gemalt gegen 3D, Zoom 0,35 / 1 / 1,6, Schatten Aus und Hoch, Malzeit je Kachel und Texturspeicher.
 */
const COVER = 95; // % der Prüfpunkte, die auf der Schicht liegen müssen
const WEGE_DIFF = 12; // % abweichender Pixel zwischen gemalter und 3D-Schicht im Ausschnitt (Hangbeleuchtung der Schicht, Schienen und Zäune als Körper, Rand der Flächen)

/** Orte einer Karte: steilster Feldweg-/Gleispunkt (Hang), steilster Gleispunkt, Feld mit dem größten Höhenunterschied, Brücke nächst der Hauptstadt, Stadtmitte. */
const wegeSpots = (g) =>
  g.run(async () => {
    const { railList } = await import('/js/render/terrain.js');
    const { KIND_ID } = await import('/js/data/citykinds.js');
    const s = window.__frontline.session();
    const game = s.game;
    const rel = game.relief;
    const town = game.map.town ?? {};
    const W = s.camera.mapW;
    const hq = game.buildings.find((b) => b.main && b.team === 0) ?? { x: W / 2, y: W / 2 };
    const slope = (x, y) => {
      const k = rel.gradAt(x, y);
      return Math.hypot(k.x, k.y);
    };
    const inner = (x, y) => x > 500 && y > 500 && x < W - 500 && y < W - 500;
    const best = { hang: null, rail: null };
    const scan = (key, x1, y1, x2, y2) => {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t < L; t += 16) {
        const x = x1 + ((x2 - x1) * t) / L;
        const y = y1 + ((y2 - y1) * t) / L;
        const k = slope(x, y);
        if (inner(x, y) && (!best[key] || k > best[key].k)) best[key] = { x, y, k };
      }
    };
    for (const r of town.roads ?? []) if (r.dirt) scan('hang', r.x1, r.y1, r.x2, r.y2);
    for (const r of railList(town)) {
      scan('hang', r.x1, r.y1, r.x2, r.y2);
      scan('rail', r.x1, r.y1, r.x2, r.y2);
    }
    // Feld mit dem größten Höhenunterschied
    let field = null;
    for (const f of town.fields ?? []) {
      if (!inner(f.x, f.y)) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const h = rel.displayAt(f.x + (a * f.w) / 2, f.y + (b * f.h) / 2);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      if (!field || hi - lo > field.dh) field = { x: f.x, y: f.y, dh: hi - lo, kind: f.kind };
    }
    // Brücke nächst der Hauptstadt
    const bs = [...(game.bridges ?? [])].sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
    const bridge = bs[0] ? { x: bs[0].x, y: bs[0].y, x1: bs[0].x1, y1: bs[0].y1, angle: bs[0].angle, len: bs[0].len } : null;
    // Stadt: Mitte der Straßenzellen um die Hauptstadt
    const c = game.city[0];
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (const i of c.list) {
      if (c.kind[i] !== KIND_ID.road) continue;
      const col = i % c.cols;
      const x = (col + 0.5) * c.cell;
      const y = ((i - col) / c.cols + 0.5) * c.cell;
      if (Math.hypot(x - hq.x, y - hq.y) < 500) {
        n++;
        sx += x;
        sy += y;
      }
    }
    // Zahlen vor dem Plan: Straßenzellen (Stadt und Karte), Gleislänge, Fläche der Felder, Wege
    const rails = railList(town);
    const cells = new Set();
    for (const cc of game.city) for (const i of cc.list) if (cc.kind[i] === KIND_ID.road) cells.add(i);
    if (game.roads) for (let i = 0; i < game.roads.kind.length; i++) if (game.roads.kind[i] === 1 || game.roads.kind[i] === 3) cells.add(i);
    const dirt = (town.roads ?? []).filter((r) => r.dirt);
    return {
      hq: { x: hq.x, y: hq.y },
      hang: best.hang,
      rail: best.rail,
      field,
      bridge,
      city: n ? { x: sx / n, y: sy / n, n } : { x: hq.x, y: hq.y, n },
      counts: {
        roadCells: cells.size,
        dirtRoads: dirt.length,
        dirtLen: Math.round(dirt.reduce((a, r) => a + Math.hypot(r.x2 - r.x1, r.y2 - r.y1), 0)),
        rails: rails.length,
        railLen: Math.round(rails.reduce((a, r) => a + Math.hypot(r.x2 - r.x1, r.y2 - r.y1), 0)),
        fields: (town.fields ?? []).length,
        fieldArea: Math.round((town.fields ?? []).reduce((a, f) => a + f.w * f.h, 0)),
        plazas: (town.plazas ?? []).length,
        walks: (town.walks ?? []).length,
      },
    };
  });

/** Bild in 3D mit Bodenschicht (on) oder mit der gemalten (off), alle gemalten Bilder fertig; Kacheln alle gemalt (kein Zeitbudget). */
const wegeFrame = (g, on) =>
  g.run(async (on) => {
    const { spriteMissed } = await import('/js/render/spritecache.js');
    const s = window.__frontline.session();
    const r = s.renderer;
    s.camera.three = true;
    r.ways3dOn = on;
    r.ways3d.budgetMs = 1e9;
    for (let i = 0; i < 4 || (spriteMissed() && i < 150); i++) r.render(s.controller.view);
    return r.ways3d.stats();
  }, on);

/** Anteil (%) abweichender Pixel (ein Kanal > 40) zwischen 3D mit Schicht und 3D mit gemalter Schicht, ohne Kopf- und Fußleiste der Bedienung. */
const wegeDiff = (g) =>
  g.run(async () => {
    const { spriteMissed } = await import('/js/render/spritecache.js');
    const s = window.__frontline.session();
    const r = s.renderer;
    const c = r.canvas;
    const grab = (on) => {
      s.camera.three = true;
      r.ways3dOn = on;
      r.ways3d.budgetMs = 1e9;
      for (let i = 0; i < 4 || (spriteMissed() && i < 150); i++) r.render(s.controller.view);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const a = grab(false);
    const b = grab(true);
    r.ways3dOn = true;
    let n = 0;
    let all = 0;
    const y0 = Math.round(c.height * 0.1);
    const y1 = Math.round(c.height * 0.75);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        all++;
        if (Math.abs(a[i] - b[i]) > 40 || Math.abs(a[i + 1] - b[i + 1]) > 40 || Math.abs(a[i + 2] - b[i + 2]) > 40) n++;
      }
    }
    return (n / all) * 100;
  });

/**
 * Treffer: Schicht eingefärbt (Magenta), keine Objekte, Nebel und Wetter; Mittelpunkte der Straßen (kinds: 'dirt', 'rail', 'city', 'field', 'plaza') im Umkreis r um (x, y)
 * an camera.worldToScreen: Anteil der Punkte im Bild, deren Pixel die Farbe der Schicht trägt.
 */
const wegeCover = (g, x, y, rot, zoom, kinds, r = 420) =>
  g.run(async ({ x, y, rot, zoom, kinds, r }) => {
    const { railList } = await import('/js/render/terrain.js');
    const { KIND_ID } = await import('/js/data/citykinds.js');
    const s = window.__frontline.session();
    const ren = s.renderer;
    const cam = s.camera;
    const game = s.game;
    cam.three = true;
    cam.rot = rot;
    cam.zoom = zoom;
    cam.centerOn(x, y);
    ren.ways3dOn = true;
    ren.ways3d.budgetMs = 1e9;
    const save = new Map(ren.swaps);
    const level = ren.shadows;
    for (const n of ['Objekte', 'Schatten', 'Schilder', 'Effekte', 'Nebel', 'Wetter', 'Balken', 'Anzeigen']) ren.swaps.set(n, null); // Schilder über den Gebäuden und Balken liegen sonst über den Prüfpunkten
    ren.isoGround = ren.isoMarks = () => {}; // gemalte Bodenteile (Zone, Grundstücke, Gleisgrenze) liegen sonst über der Schicht
    ren.sun.setLevel('off');
    ren.ways3d.tint.value.set(1, 0, 1, 1);
    const town = game.map.town ?? {};
    const pts = [];
    const near = (px, py) => Math.hypot(px - x, py - y) < r;
    const line = (x1, y1, x2, y2, step) => {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t <= L; t += step) {
        const px = x1 + ((x2 - x1) * t) / L;
        const py = y1 + ((y2 - y1) * t) / L;
        if (near(px, py)) pts.push([px, py]);
      }
    };
    if (kinds.includes('dirt')) for (const q of town.roads ?? []) if (q.dirt) line(q.x1, q.y1, q.x2, q.y2, 10);
    if (kinds.includes('rail')) for (const q of railList(town)) line(q.x1, q.y1, q.x2, q.y2, 10);
    if (kinds.includes('city')) {
      for (const c of game.city) {
        for (const i of c.list) {
          if (c.kind[i] !== KIND_ID.road || game.roads?.kind[i] === 2) continue; // Brückenzellen malt bridge.js
          const col = i % c.cols;
          const px = (col + 0.5) * c.cell;
          const py = ((i - col) / c.cols + 0.5) * c.cell;
          if (near(px, py)) pts.push([px, py]);
        }
      }
    }
    if (kinds.includes('field')) {
      for (const f of town.fields ?? []) {
        if (!near(f.x, f.y)) continue;
        const c = Math.cos(f.angle || 0);
        const sn = Math.sin(f.angle || 0);
        for (let a = -0.4; a <= 0.4; a += 0.2) for (let b = -0.4; b <= 0.4; b += 0.2) pts.push([f.x + a * f.w * c - b * f.h * sn, f.y + a * f.w * sn + b * f.h * c]);
      }
    }
    if (kinds.includes('plaza')) for (const p of town.plazas ?? []) for (let a = -0.3; a <= 0.3; a += 0.3) for (let b = -0.3; b <= 0.3; b += 0.3) pts.push([p.x + a * p.w, p.y + b * p.h]);
    for (let i = 0; i < 4; i++) ren.render(s.controller.view);
    const c = ren.canvas;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let inView = 0;
    let hit = 0;
    let worst = null;
    for (const [px, py] of pts) {
      const p = cam.worldToScreen(px, py);
      const sx = Math.round(p.x * ren.dpr);
      const sy = Math.round(p.y * ren.dpr);
      if (sx < 8 || sy < 8 || sx >= c.width - 8 || sy >= c.height - 8) continue;
      inView++;
      let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy++) {
        for (let dx = -1; dx <= 1 && !ok; dx++) {
          const i = ((sy + dy) * c.width + sx + dx) * 4;
          ok = data[i] > 150 && data[i + 2] > 150 && data[i + 1] < 120; // Magenta (Boden und Zonen darunter tragen kein Rot und Blau ohne Grün)
        }
      }
      if (ok) hit++;
      else if (!worst) worst = [Math.round(px), Math.round(py)];
    }
    ren.ways3d.tint.value.set(0, 0, 0, 0);
    delete ren.isoGround;
    delete ren.isoMarks;
    ren.swaps = save;
    ren.sun.setLevel(level);
    return { points: pts.length, inView, hit, firstMiss: worst };
  }, { x, y, rot, zoom, kinds, r });

async function wegePart() {
  const dir = join(out, 'wege');
  await mkdir(dir, { recursive: true });
  const cityMin = Number(arg('citymin', 10));
  const runs = [
    ['seed3', 3, false, cityMin],
    ['seed7', 7, false, cityMin],
    ['fest', 3, true, 3],
  ];
  const want = arg('karte', null)?.split(',');
  const parts = arg('teile', null)?.split(','); // --teile hang,gleis,feld,stadt,bruecke,pflaster,aenderung,messung: nur diese
  const todo = (p) => !parts || parts.includes(p);
  for (const [name, seed, fixed, minutes] of runs) {
    if (want && !want.includes(name)) continue;
    const g = await openGame({ seed, query: 'iso=1&three=1&shadows=high&river=1&weather=summer&wx=clear', scale: 1, out, start: !fixed });
    try {
      if (fixed) {
        await g.page.evaluate(() => localStorage.setItem('frontline-kartenwahl', 'fest:east-europe-railway'));
        await g.page.reload();
        await g.page.waitForTimeout(1000);
        await g.press('button.primary');
        await g.page.waitForFunction(() => window.__frontline?.session()?.game);
        await g.page.waitForTimeout(1500);
      }
      const has = await g.run(() => !!window.__frontline.session().renderer.ways3d);
      if (!has) throw new Error('Ansicht 3D nicht aktiv (WebGL oder three.js fehlt)');
      // Partie vorspulen: alle Teams mit KI, Simulation direkt (ohne Zeichnen)
      await g.run(async () => {
        const { AI } = await import('/js/ai/ai.js');
        const s = window.__frontline.session();
        s.loop.paused = true;
        s.renderer.revealAll = true;
        window.__ais = s.game.teams.map((_, t) => new AI(s.game, t, 'normal'));
      });
      for (let m = 0; m < minutes; m++) {
        await g.run((m) => {
          const s = window.__frontline.session();
          while (s.game.time < (m + 1) * 60) {
            for (const a of window.__ais) a.update(0.05);
            s.game.update(0.05);
          }
        }, m);
      }
      const sp = await wegeSpots(g);
      const cn = sp.counts;
      console.log(`Wege ${name}: ${minutes} Spielminuten; ${cn.roadCells} Straßenzellen, ${cn.dirtRoads} Feldwege (${cn.dirtLen} px), ${cn.rails} Gleise (${cn.railLen} px), ${cn.fields} Felder (${cn.fieldArea} px²), Pflaster ${cn.plazas} Plätze und ${cn.walks} Bürgersteige; steilster Hang ${sp.hang ? sp.hang.k.toFixed(2) : '–'} bei ${sp.hang ? Math.round(sp.hang.x) + ',' + Math.round(sp.hang.y) : ''}`);
      const cover = async (tag, x, y, rot, zoom, kinds, r) => {
        const c = await wegeCover(g, x, y, rot, zoom, kinds, r);
        const pct = c.inView ? (c.hit / c.inView) * 100 : 100;
        const ok = c.inView > 0 && pct >= COVER;
        if (!ok) fail++;
        console.log(`Wege ${name}: Treffer ${tag}: ${c.hit}/${c.inView} Punkte (${kinds.join('+')}) auf der Schicht (${pct.toFixed(1)} %)${c.inView ? '' : '  KEINE PUNKTE IM BILD'}${ok ? '' : `  FEHLER (erster Fehlpunkt ${c.firstMiss})`}`);
      };
      const shotPair = async (tag, x, y, rot, zoom, opts = {}) => {
        await look(g, x, y, rot, zoom);
        if (opts.night) await g.run(() => (window.__frontline.session().renderer.mood = 'night'));
        await mvpPair(g, dir, name, tag); // Iso | 3D
        let st;
        if (/drehung0$|nacht|winter|nah$|^feld$|zoom1$/.test(tag)) {
          await wegeFrame(g, false);
          await g.page.waitForTimeout(200);
          const alt = await g.page.screenshot();
          st = await wegeFrame(g, true);
          await g.page.waitForTimeout(200);
          const neu = await g.page.screenshot();
          await sideBySide(g, join(dir, `${name}-${tag}-boden.png`), alt, neu, ['Boden gemalt (3D)', 'Boden 3D']); // gemalte Bodenschicht | 3D-Bodenschicht (beide in 3D)
        } else st = await wegeFrame(g, true);
        const d = await wegeDiff(g);
        if (opts.night) await g.run(() => (window.__frontline.session().renderer.mood = null));
        if (d > WEGE_DIFF) fail++;
        console.log(`Wege ${name}: ${tag}: ${st.visible} Kacheln im Bild (Stufe ${st.d}), gemalt gegen 3D ${d.toFixed(2)} % Pixel abweichend${d > WEGE_DIFF ? '  FEHLER' : ''}`);
        return st;
      };
      // --- Hang: Feldweg bzw. Gleis am steilsten Hang, Zoom 1,6 und 1, 4 Drehungen
      if (sp.hang && todo('hang')) {
        for (const rot of [0, 1, 2, 3]) {
          await shotPair(`hang-zoom1.6-drehung${rot}`, sp.hang.x, sp.hang.y, rot, 1.6);
          await cover(`Hang Drehung ${rot}`, sp.hang.x, sp.hang.y, rot, 1.6, ['dirt', 'rail'], 330);
        }
        await shotPair('hang-zoom1', sp.hang.x, sp.hang.y, 0, 1);
      }
      // --- Gleis (steilster Gleispunkt der Karte)
      if (sp.rail && todo('gleis')) {
        for (const rot of name === 'fest' ? [0, 1, 2, 3] : [0]) {
          await shotPair(`gleis-drehung${rot}`, sp.rail.x, sp.rail.y, rot, 1.6);
          await cover(`Gleis Drehung ${rot}`, sp.rail.x, sp.rail.y, rot, 1.6, ['rail'], 330);
        }
      }
      // --- Feld (größter Höhenunterschied)
      if (sp.field && todo('feld')) {
        await shotPair('feld', sp.field.x, sp.field.y, 0, 1);
        await cover('Feld', sp.field.x, sp.field.y, 0, 1, ['field'], 600);
        await shotPair('feld-nah', sp.field.x, sp.field.y, 1, 1.6);
      }
      // --- Stadt: 4 Drehungen, Nacht, weit weg, Winter
      if (sp.city.n && todo('stadt')) {
        for (const rot of [0, 1, 2, 3]) {
          await shotPair(`stadt-drehung${rot}`, sp.city.x, sp.city.y, rot, 1);
          await cover(`Stadt Drehung ${rot}`, sp.city.x, sp.city.y, rot, 1, ['city'], 450);
        }
        await shotPair('stadt-nacht', sp.city.x, sp.city.y, 0, 1, { night: true });
        await shotPair('stadt-zoom0.35', sp.city.x, sp.city.y, 0, 0.35);
        await g.run(() => {
          const s = window.__frontline.session();
          s.renderer.season = 'winter';
          s.renderer.terrainGL = null;
          s.renderer.terrainIso = null;
        });
        for (const rot of [0, 2]) await shotPair(`stadt-winter-drehung${rot}`, sp.city.x, sp.city.y, rot, 1);
        if (sp.hang) await shotPair('hang-winter', sp.hang.x, sp.hang.y, 0, 1.6);
        await g.run(() => {
          const s = window.__frontline.session();
          s.renderer.season = 'summer';
          s.renderer.terrainGL = null;
          s.renderer.terrainIso = null;
        });
      }
      // --- Brückenanschluss: Wege und Straßen an den Brückenköpfen, 4 Drehungen
      if (sp.bridge && todo('bruecke')) {
        const b = sp.bridge;
        for (const rot of [0, 1, 2, 3]) {
          await shotPair(`bruecke-drehung${rot}`, b.x, b.y, rot, 1);
          await cover(`Brückenanschluss Drehung ${rot}`, b.x, b.y, rot, 1, ['dirt', 'city'], b.len / 2 + 200);
        }
      }
      // --- Pflaster (nur Karten aus dem Editor haben es: Platz und Bürgersteig am Hang einsetzen)
      if (todo('pflaster')) {
        const at = sp.hang ?? sp.hq;
        await g.run(async ({ x, y }) => {
          const { invalidateWays } = await import('/js/render/ways.js');
          const town = window.__frontline.session().game.map.town;
          town.plazas = [...(town.plazas ?? []), { x: x + 60, y: y - 40, w: 96, h: 64, angle: 0.35 }];
          town.walks = [...(town.walks ?? []), { x1: x - 180, y1: y + 80, x2: x + 140, y2: y + 150, w: 24 }];
          invalidateWays();
        }, at);
        for (const rot of [0, 1]) {
          await shotPair(`pflaster-drehung${rot}`, at.x + 20, at.y + 30, rot, 1.6);
          await cover(`Pflaster Drehung ${rot}`, at.x + 20, at.y + 30, rot, 1.6, ['plaza'], 200);
        }
        await g.run(async () => {
          const { invalidateWays } = await import('/js/render/ways.js');
          const town = window.__frontline.session().game.map.town;
          town.plazas = [];
          town.walks = [];
          invalidateWays();
        });
      }
      // --- Neumalen nur bei Änderung; Iso und 2D wie bisher
      if (todo('aenderung')) {
      const idle = await g.run(() => {
        const s = window.__frontline.session();
        const r = s.renderer;
        s.camera.three = true;
        r.ways3dOn = true;
        r.ways3d.budgetMs = 1e9;
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        let painted = 0;
        for (let i = 0; i < 5; i++) {
          r.render(s.controller.view);
          painted += r.ways3d.stats().painted;
        }
        const shown3d = r.ways3dShown;
        s.camera.three = false;
        r.render(s.controller.view);
        const shownIso = r.ways3dShown;
        s.camera.iso = false;
        r.render(s.controller.view);
        const show2d = r.ways3dShown;
        s.camera.iso = true;
        s.camera.three = true;
        return { painted, shown3d, shownIso, show2d };
      });
      const idleOk = idle.painted === 0 && idle.shown3d && !idle.shownIso && !idle.show2d;
      if (!idleOk) fail++;
      console.log(`Wege ${name}: unverändert malt ${idle.painted} Kacheln in 5 Bildern; Schicht in 3D ${idle.shown3d}, Iso ${idle.shownIso}, 2D ${idle.show2d}${idleOk ? '' : '  FEHLER'}`);
      // Neue Straße: nur Kacheln in der Nähe malen neu
      const road = await g.run(async () => {
        const { KIND_ID } = await import('/js/data/citykinds.js');
        const s = window.__frontline.session();
        const game = s.game;
        const hq = game.buildings.find((b) => b.main && b.team === 0);
        const c = game.city[0];
        s.camera.centerOn(hq.x, hq.y);
        const r = s.renderer;
        r.ways3d.budgetMs = 1e9;
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        let i = Math.floor(hq.y / c.cell) * c.cols + Math.floor(hq.x / c.cell) + 9;
        while (c.kind[i] || c.blocked?.[i]) i++;
        c.kind[i] = KIND_ID.road;
        c.list.push(i);
        game.time += 1;
        r.render(s.controller.view);
        const st = r.ways3d.stats();
        r.render(s.controller.view);
        const again = r.ways3d.stats().painted;
        c.kind[i] = 0;
        c.list.pop();
        game.time += 1;
        r.render(s.controller.view);
        return { painted: st.painted, visible: st.visible, again, back: r.ways3d.stats().painted };
      });
      const roadOk = road.painted > 0 && road.painted <= 9 && road.painted < road.visible && road.again === 0;
      if (!roadOk) fail++;
      console.log(`Wege ${name}: eine neue Straßenzelle malt ${road.painted} von ${road.visible} Kacheln neu (danach ${road.again}), Rücknahme ${road.back}${roadOk ? '' : '  FEHLER'}`);
      }
      if (name !== 'seed3' || !todo('messung')) continue;
      // --- Messung: Draw-Calls, Dreiecke, Zeit „Gelände“ + „Boden“, gemalt gegen 3D, Zoom, Schatten Aus und Hoch; Stadtausschnitt
      const rows = [];
      for (const zoom of [0.35, 1, 1.6]) {
        await look(g, sp.city.x, sp.city.y, 0, zoom);
        for (const level of ['off', 'high']) {
          for (const on of [false, true]) {
            const st = await g.run(({ level, on }) => {
              const s = window.__frontline.session();
              const r = s.renderer;
              s.camera.three = true;
              s.camera.iso = true;
              r.setShadows(level);
              r.ways3dOn = on;
              r.ways3d.budgetMs = 1e9;
              for (let i = 0; i < 3; i++) r.render(s.controller.view);
              const info = r.gl.info;
              info.autoReset = false;
              let terrain = null;
              const origT = r.terrain3d;
              r.terrain3d = function (f) {
                info.reset();
                origT.call(this, f);
                terrain = { calls: info.render.calls, tris: info.render.triangles };
              };
              try {
                r.render(s.controller.view);
              } finally {
                r.terrain3d = origT;
                info.autoReset = true;
              }
              return { ...terrain, ways: r.ways3d.stats() };
            }, { level, on });
            // Rechner unter Last (andere Prüfungen, Software-WebGL): kleinster von drei Läufen
            let t = null;
            for (let k = 0; k < 3; k++) {
              const q = await timePasses(g, Math.max(3, Math.round(frames / 2)));
              if (!t || q['Gelände'] + q.Boden < t['Gelände'] + t.Boden) t = q;
            }
            rows.push(`Zoom ${zoom} ${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Gelände ${t['Gelände'].toFixed(0)} + Boden ${t.Boden.toFixed(0)} = ${(t['Gelände'] + t.Boden).toFixed(0)} ms, Gelände-Durchlauf ${st.calls} Draw-Calls, ${st.tris} Dreiecke` + (on ? ` (Schicht: ${st.ways.drawn} Kacheln + ${st.ways.rails} Schienennetze, Stufe ${st.ways.d}, ${(st.ways.vbytes / 1e6).toFixed(0)} MB Textur im Bild, ${(st.ways.bytes / 1e6).toFixed(0)} MB gesamt)` : ''));
          }
        }
      }
      // Malkosten: alle Kacheln im Bild neu (Spiel angehalten), Zoom 1
      await look(g, sp.city.x, sp.city.y, 0, 1);
      const paint = await g.run(() => {
        const s = window.__frontline.session();
        const r = s.renderer;
        s.camera.three = true;
        r.ways3dOn = true;
        r.setShadows('off');
        r.ways3d.budgetMs = 1e9;
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        const res = [];
        for (let i = 0; i < 3; i++) {
          r.ways3d.invalidate();
          const t0 = performance.now();
          r.render(s.controller.view);
          const st = r.ways3d.stats();
          res.push({ painted: st.painted, ms: st.ms, frame: performance.now() - t0 });
        }
        r.setShadows('high');
        return res;
      });
      const pm = paint.reduce((a, p) => a + p.ms, 0) / paint.length;
      const pn = paint.reduce((a, p) => a + p.painted, 0) / paint.length;
      console.log(`Wege Messung ${name} (Stadtausschnitt, ${frames} Bilder, Software-WebGL; „Gelände“ enthält die Kacheln, „Boden“ die gemalte Schicht):`);
      for (const r of rows) console.log(`  ${r}`);
      console.log(`  Malkosten: ${pn.toFixed(0)} Kacheln neu malen = ${pm.toFixed(0)} ms (${(pm / pn).toFixed(1)} ms je Kachel), Zeitbudget 12 ms je Bild`);
      await g.run(() => {
        const r = window.__frontline.session().renderer;
        r.ways3dOn = true;
        r.ways3d.budgetMs = 12;
      });
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
}

/**
 * Teil „wetter“ (--only wetter, läuft auch ohne --only), Paket „Wetter 3D“: Regen, Schnee und Nebel in 3D (render3d/weather3d.js) neben dem
 * gemalten Wetter. Seed 3 mit Einheiten vor der Hauptstadt, Schatten Hoch; je Wetter Iso | 3D in 4 Drehungen am Tag und in der Nacht, dazu
 * Zoom 0,5 und 1,6 und Regen mit Kriegsnebel (<out>/wetter/). Prüft: Teilchen und Nebellagen werden gezeichnet (Zähler > 0), alle Netze testen
 * die Tiefe und schreiben keine (Gebäude davor verdecken), das Bild weicht von dem ohne Wetter ab (mindestens 2 % der Pixel). Misst die Zeit
 * der Durchläufe „Wetter“ und „Objekte“, die Zeit je Bild, Draw-Calls und Dreiecke des Wetters mit gemaltem und mit 3D-Wetter,
 * Schatten Aus und Hoch (renderer.weather3dOn).
 */
async function weatherPart() {
  const dir = join(out, 'wetter');
  await mkdir(dir, { recursive: true });
  const rows = [];
  for (const [wx, season, tag, extra] of [['rain', 'autumn', 'regen', ''], ['snow', 'winter', 'schnee', ''], ['fog', 'autumn', 'nebel', ''], ['rain', 'autumn', 'kriegsnebel', '&fog=1']]) {
    const g = await openGame({ seed: 3, query: `iso=1&three=1&shadows=high&weather=${season}&wx=${wx}${extra}`, scale: 1, out });
    try {
      const spot = await g.run(() => {
        const s = window.__frontline.session();
        s.loop.paused = true;
        const hq = s.game.buildings.find((b) => b.main && b.team === 0);
        const types = ['tank', 'ifv', 'rifleman'];
        for (let i = 0; i < 12; i++) s.game.spawnUnit(types[i % 3], i % 2, hq.x + 140 + (i % 4) * 40, hq.y + 200 + Math.floor(i / 4) * 40);
        return { x: hq.x, y: hq.y };
      });
      // 1. Zähler, Tiefentest, Wirkung gegen das Bild ohne Wetter
      const chk = await g.run(() => {
        const s = window.__frontline.session();
        const r = s.renderer;
        const w = s.game.weather;
        s.camera.three = true;
        r.mood = null;
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        const stats = { ...r.weather3d.stats };
        const wet = r.wet;
        const meshes = r.weather3d.group.children.filter((m) => m.visible);
        const depthOk = meshes.length > 0 && meshes.every((m) => m.material.depthTest && !m.material.depthWrite);
        const c = r.canvas;
        const grab = () => {
          for (let i = 0; i < 3; i++) r.render(s.controller.view);
          return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        };
        const a = grab();
        w.on = false;
        const b = grab();
        w.on = true;
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 12 || Math.abs(a[i + 1] - b[i + 1]) > 12 || Math.abs(a[i + 2] - b[i + 2]) > 12) n++;
        return { stats, depthOk, wet, diff: (100 * n) / (a.length / 4), meshes: meshes.length };
      });
      const want = wx === 'rain' ? chk.stats.rain > 0 && chk.stats.splash > 0 && chk.wet > 0.9 : wx === 'snow' ? chk.stats.snow > 0 : chk.stats.fog === 4;
      const ok = want && chk.depthOk && chk.diff >= 2;
      if (!ok) fail++;
      console.log(`Wetter ${tag}: Teilchen ${JSON.stringify(chk.stats)}, ${chk.meshes} Netze mit Tiefentest ohne Tiefenschreiben ${chk.depthOk ? 'ja' : 'NEIN'}, Nässe ${chk.wet.toFixed(2)}, Bild weicht vom Bild ohne Wetter ab: ${chk.diff.toFixed(1)} %${ok ? '' : '  FEHLER'}`);
      // 2. Fotos
      const quick = tag === 'kriegsnebel';
      for (const mood of quick ? [null] : [null, 'night']) {
        await g.run((mood) => (window.__frontline.session().renderer.mood = mood), mood);
        for (let rot = 0; rot < (quick ? 1 : 4); rot++) {
          await look(g, spot.x + 120, spot.y + 120, rot, 1);
          await mvpPair(g, dir, tag, `${mood ?? 'tag'}-drehung${rot}`);
        }
      }
      await g.run(() => (window.__frontline.session().renderer.mood = null));
      if (!quick) {
        for (const zoom of [0.5, 1.6]) {
          await look(g, spot.x + 120, spot.y + 120, 0, zoom);
          await mvpPair(g, dir, tag, `tag-zoom${zoom}`);
        }
      }
      if (quick) continue;
      // 3. Messung (Zoom 1, Drehung 0): gemalt gegen 3D, Schatten Aus und Hoch
      await look(g, spot.x + 120, spot.y + 120, 0, 1);
      for (const level of ['off', 'high']) {
        for (const on of [false, true]) {
          const st = await g.run(({ level, on }) => {
            const s = window.__frontline.session();
            const r = s.renderer;
            s.camera.three = true;
            r.setShadows(level);
            r.weather3dOn = on;
            for (let i = 0; i < 3; i++) r.render(s.controller.view);
            const info = r.gl.info;
            const orig = r.weather3dPass;
            let st = null;
            info.autoReset = false;
            r.weather3dPass = function (f) {
              info.reset();
              orig.call(this, f);
              st = { calls: info.render.calls, tris: info.render.triangles };
            };
            try {
              r.render(s.controller.view);
            } finally {
              r.weather3dPass = orig;
              info.autoReset = true;
            }
            return { ...st, stats: { ...r.weather3d.stats } };
          }, { level, on });
          const t = await timePasses(g, frames);
          rows.push(`${tag.padEnd(7)} ${level === 'off' ? 'Aus ' : 'Hoch'} ${on ? '3D    ' : 'gemalt'}: Wetter ${t.Wetter.toFixed(1)} ms, Objekte ${t.Objekte.toFixed(0)} ms, Bild ${t.Bild.toFixed(0)} ms, Wetter-Bild ${st.calls} Draw-Calls, ${st.tris} Dreiecke${on ? ` (Teilchen: Regen ${st.stats.rain}, Ringe ${st.stats.splash}, Flocken ${st.stats.snow}, Nebellagen ${st.stats.fog})` : ''}`);
        }
      }
      await g.run(() => {
        const r = window.__frontline.session().renderer;
        r.weather3dOn = true;
        r.setShadows('high');
      });
    } finally {
      errors.push(...g.errors);
      await g.close();
    }
  }
  console.log(`Wetter Messung (Zoom 1, Drehung 0, ${frames} Bilder, Software-WebGL; „Wetter“ = Durchlauf, Draw-Calls und Dreiecke nur dort):`);
  for (const r of rows) console.log(`  ${r}`);
}

/**
 * Teil „tagnacht“ (--only tagnacht, läuft auch ohne --only), Paket „Tag und Nacht 3D“: Lichtstimmungen in 3D (render3d/lights3d.js). Seed 3,
 * 6 Spielminuten KI gegen KI (Stadt wächst), Schatten Hoch; Fotos Iso | 3D für Morgen, Mittag, Abend, Nacht an der Stadt der Hauptstadt
 * (Nacht in 4 Drehungen), an der Kartenstadt und an einer Laterne der Karte (<out>/tagnacht/). Prüft: Sonnenhöhe je Stimmung, Lichter
 * nur abends und nachts, nachts Lichtflecken im Bild und hellere Pixel (Lichter an gegen aus, keins dunkler), mit Kriegsnebel (fog=1)
 * kein Licht im Unerkundeten. Misst den Durchlauf „Lichter“ und das Bild nachts.
 */
async function dayNightPart() {
  const dir = join(out, 'tagnacht');
  await mkdir(dir, { recursive: true });
  const moods = ['morning', 'day', 'evening', 'night'];
  const name = { morning: 'morgen', day: 'mittag', evening: 'abend', night: 'nacht' };
  const minutes = Number(arg('citymin', 6));
  const g = await openGame({ seed: 3, query: 'iso=1&three=1&shadows=high&weather=summer&wx=clear', scale: 1, out });
  try {
    await g.run(async (minutes) => {
      const { AI } = await import('/js/ai/ai.js');
      const s = window.__frontline.session();
      s.loop.paused = true;
      const ais = s.game.teams.map((_, t) => new AI(s.game, t, 'normal'));
      while (s.game.time < minutes * 60) {
        for (const a of ais) a.update(0.05);
        s.game.update(0.05);
      }
    }, minutes);
    const spots = await g.run(async () => {
      const { cityBuildings } = await import('/js/render/citylayer.js');
      const s = window.__frontline.session();
      const g = s.game;
      const hq = g.buildings.find((b) => b.main && b.team === 0);
      const near = cityBuildings(g, 0, () => true, () => true).filter((b) => b.kind === 'town' && Math.hypot(b.x - hq.x, b.y - hq.y) < 700);
      const city = near.length ? { x: near.reduce((a, b) => a + b.x, 0) / near.length, y: near.reduce((a, b) => a + b.y, 0) / near.length, n: near.length } : { x: hq.x, y: hq.y, n: 0 };
      const houses = (g.map.town?.buildings ?? []).filter((b) => b.kind === 'house');
      const town = houses.length ? { x: houses.reduce((a, b) => a + b.x, 0) / houses.length, y: houses.reduce((a, b) => a + b.y, 0) / houses.length, n: houses.length } : null;
      let lamps = (g.map.props ?? []).filter((p) => p.kind === 'street_lamp');
      if (!lamps.length && town) {
        // Laternen gibt es nur an Hallenhöfen (mapgen.js lampAt): für das Foto drei an eine freie Stelle neben der Kartenstadt setzen
        g.map.props ??= [];
        for (let i = 0; i < 3; i++) g.map.props.push({ kind: 'street_lamp', x: Math.round(town.x + 260 + i * 90), y: Math.round(town.y + 300), rot: (i * 2) % 8 });
        g.propVersion = (g.propVersion ?? 0) + 1;
        lamps = g.map.props.filter((p) => p.kind === 'street_lamp');
      }
      const lamp = lamps[0] ? { x: lamps[0].x + 45, y: lamps[0].y, n: lamps.length } : null;
      return { city, town, lamp };
    });
    console.log(`Tag und Nacht: ${minutes} Spielminuten, ${spots.city.n} Stadthäuser an der Hauptstadt, Kartenstadt ${spots.town?.n ?? 0} Häuser, ${spots.lamp?.n ?? 0} Laternen`);
    // 1. Prüfungen je Stimmung an der Stadt: Sonnenhöhe, Lichter, Wirkung (Lichter an gegen aus)
    await look(g, spots.city.x, spots.city.y, 0, 1);
    for (const mood of moods) {
      const chk = await g.run((mood) => {
        const s = window.__frontline.session();
        const r = s.renderer;
        s.camera.three = true;
        r.mood = mood;
        const c = r.canvas;
        const grab = (on) => {
          r.lights3dOn = on;
          for (let i = 0; i < 3; i++) r.render(s.controller.view);
          return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        };
        const b = grab(false);
        const a = grab(true);
        let up = 0;
        let down = 0;
        for (let i = 0; i < a.length; i += 4) {
          const d = a[i] + a[i + 1] + a[i + 2] - b[i] - b[i + 1] - b[i + 2];
          if (d > 12) up++;
          else if (d < -12) down++;
        }
        return { elev: r.lightVec()[2], count: r.lights3d.count, up: (100 * up) / (a.length / 4), down: (100 * down) / (a.length / 4) };
      }, mood);
      const wantElev = { morning: 0.42, day: 0.62, evening: 0.38, night: 0.62 }[mood];
      const lit = mood === 'evening' || mood === 'night';
      const ok = Math.abs(chk.elev - wantElev) < 1e-6 && (lit ? chk.up > 0.2 && chk.down < 0.05 : chk.up === 0 && chk.down === 0) && (mood !== 'night' || chk.count > 0);
      if (!ok) fail++;
      console.log(`  ${name[mood].padEnd(6)}: Sonnenhöhe ${chk.elev.toFixed(2)}, Lichtflecken ${lit ? chk.count : '–'}, heller ${chk.up.toFixed(2)} %, dunkler ${chk.down.toFixed(2)} %${ok ? '' : '  FEHLER'}`);
    }
    // 2. Fotos: Stadt (Nacht in 4 Drehungen), Kartenstadt, Laterne
    for (const [tag, sp, zoom] of [['stadt', spots.city, 1], ['kartenstadt', spots.town, 1], ['laterne', spots.lamp, 1.6]]) {
      if (!sp) continue;
      for (const mood of moods) {
        await g.run((mood) => (window.__frontline.session().renderer.mood = mood), mood);
        const rots = tag === 'stadt' && mood === 'night' ? 4 : 1;
        for (let rot = 0; rot < rots; rot++) {
          await look(g, sp.x, sp.y, rot, zoom);
          await mvpPair(g, dir, tag, `${name[mood]}${rots > 1 ? `-drehung${rot}` : ''}`);
        }
      }
    }
    // 3. Messung nachts an der Stadt (Zoom 1, Drehung 0): Lichter an und aus
    await look(g, spots.city.x, spots.city.y, 0, 1);
    for (const on of [false, true]) {
      await g.run((on) => {
        const r = window.__frontline.session().renderer;
        window.__frontline.session().camera.three = true;
        r.mood = 'night';
        r.lights3dOn = on;
      }, on);
      const t = await timePasses(g, frames);
      console.log(`  Messung Nacht, Lichter ${on ? 'an ' : 'aus'}: Lichter ${(t.Lichter ?? 0).toFixed(1)} ms, Objekte ${t.Objekte.toFixed(0)} ms, Bild ${t.Bild.toFixed(0)} ms (${frames} Bilder, Software-WebGL)`);
    }
    await g.run(() => {
      const r = window.__frontline.session().renderer;
      r.lights3dOn = true;
      r.mood = null;
    });
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
  // 4. Kriegsnebel: an der unerkundeten Kartenstadt leuchtet nichts
  const h = await openGame({ seed: 3, query: 'iso=1&three=1&weather=summer&wx=clear&fog=1', scale: 1, out });
  try {
    const chk = await h.run(() => {
      const s = window.__frontline.session();
      const r = s.renderer;
      s.loop.paused = true;
      s.camera.three = true;
      r.mood = 'night';
      const hs = (s.game.map.town?.buildings ?? []).filter((b) => b.kind === 'house');
      if (!hs.length) return null;
      s.camera.centerOn(hs.reduce((a, b) => a + b.x, 0) / hs.length, hs.reduce((a, b) => a + b.y, 0) / hs.length);
      const c = r.canvas;
      const grab = (on) => {
        r.lights3dOn = on;
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      };
      const b = grab(false);
      const a = grab(true);
      let up = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] - b[i] - b[i + 1] - b[i + 2] > 12) up++;
      return { count: r.lights3d.count, up: (100 * up) / (a.length / 4) };
    });
    if (chk) {
      const ok = chk.up < 0.05;
      if (!ok) fail++;
      console.log(`  Kriegsnebel: Kartenstadt unerkundet, ${chk.count} Lichtflecken gesetzt, heller ${chk.up.toFixed(3)} % der Pixel${ok ? '' : '  FEHLER'}`);
    }
  } finally {
    errors.push(...h.errors);
    await h.close();
  }
}

/**
 * Paket „Einheiten 3D: Wracks und Instancing“ (--only wracks):
 * 1) Fahrzeugwracks (Wanne + Turm verdreht/abgesprengt, sinkend) und Einheiten mehrerer Teams in Iso | 3D, 4 Drehungen, Tag und Nacht.
 * 2) Schalter wrecks3dOn und Lackfotos (unitTexturesReady) prüfen.
 * 3) Messung mit 200 Einheiten (Seed 3): Draw-Calls und Zeit „Objekte“ (Schatten Aus und Hoch) sowie units3d.stats().
 */
async function wracksPart() {
  const dir = join(out, 'wracks');
  await mkdir(dir, { recursive: true });
  const g = await openGame({ seed: 3, query: 'iso=1&three=1&shadows=high&weather=summer&wx=clear', scale: 1, out });
  try {
    const spot = await g.run(async () => {
      const s = window.__frontline.session();
      const { BALANCE } = await import('/js/data/balance.js');
      const { unitTexturesReady } = await import('/js/render3d/units3d.js');
      s.loop.paused = true;
      s.renderer.revealAll = true;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const cx = hq.x + 260;
      const cy = hq.y + 320;
      const now = s.game.time;
      const SC = BALANCE.scars;
      const seen = (1 << s.game.teams.length) - 1;
      // 10 Fahrzeugwracks (verschiedene Arten, Winkel, teils abgesprengter Turm, 2 beim Einsinken)
      const list = [
        { id: 101, type: 'tank', dx: -110, dy: -60, angle: 0.35, fade: 1 },
        { id: 102, type: 'tank', dx: -30, dy: -70, angle: 2.1, fade: 1 },
        { id: 103, type: 'ifv', dx: 55, dy: -60, angle: 1.15, fade: 1 },
        { id: 104, type: 'pzh', dx: 130, dy: -45, angle: 3.8, fade: 1 },
        { id: 105, type: 'flak', dx: -100, dy: 25, angle: 0.9, fade: 1 },
        { id: 106, type: 'truck', dx: -15, dy: 30, angle: 2.6, fade: 1 },
        { id: 107, type: 'scout', dx: 65, dy: 25, angle: 4.5, fade: 1 },
        { id: 108, type: 'gunship', dx: 135, dy: 35, angle: 0.5, fade: 1 },
        { id: 109, type: 'tank', dx: -60, dy: 105, angle: 1.6, fade: 0.35 },
        { id: 110, type: 'ifv', dx: 40, dy: 105, angle: 5.1, fade: 0.2 },
      ];
      for (const item of list) {
        const t0 = item.fade >= 1 ? now : now - (SC.wreckLife - SC.wreckFade * item.fade);
        s.game.wrecks.push({
          id: item.id, kind: 'unit', type: item.type, team: 0,
          x: cx + item.dx, y: cy + item.dy, angle: item.angle, r: 16, air: item.type === 'gunship', t0, seen,
        });
      }
      // Daneben lebende Einheiten mehrerer Teams (Teamfarbe je Instanz, Lackfoto, Schatten)
      const live = [
        ['tank', 0, -140, -125, 0.4], ['tank', 1, -70, -125, 2.7], ['ifv', 0, 10, -125, 0.9], ['ifv', 1, 80, -125, 3.3],
        ['rifleman', 0, -30, -100, 0.5], ['rifleman', 1, 0, -100, 2.5], ['gunship', 0, 140, -110, 0.7],
      ];
      for (const [type, team, dx, dy, a] of live) {
        const u = s.game.spawnUnit(type, team, cx + dx, cy + dy);
        if (u) u.angle = a;
      }
      // kurz warten, bis die Lackfotos geladen sind
      for (let i = 0; i < 40 && !unitTexturesReady(); i++) await new Promise((r) => setTimeout(r, 50));
      return { cx, cy, texReady: unitTexturesReady() };
    });
    if (!spot.texReady) {
      fail++;
      console.log('Wracks 3D: Lackfotos (armor/paint) nicht geladen  FEHLER');
    }
    // 1. 4 Drehungen (Tag, Iso | 3D)
    for (let rot = 0; rot < 4; rot++) {
      await look(g, spot.cx, spot.cy, rot, 1.4);
      await mvpPair(g, dir, 'wracks', `drehung${rot}`);
    }
    // 2. Tag und Nacht (Drehung 0, Iso | 3D)
    await look(g, spot.cx, spot.cy, 0, 1.4);
    for (const [label, mood] of [['tag', 'day'], ['nacht', 'night']]) {
      await g.run((mood) => {
        const s = window.__frontline.session();
        s.renderer.mood = mood;
      }, mood);
      await mvpPair(g, dir, 'wracks', label);
    }
    // 3. Statistik & Schalter wrecks3dOn prüfen
    const chk = await g.run(() => {
      const s = window.__frontline.session();
      const r = s.renderer;
      s.camera.three = true;
      r.mood = 'day';
      r.wrecks3dOn = true;
      r.render(s.controller.view);
      const onStats = r.wrecks3d.stats();
      const uStats = r.units3d.stats();
      r.wrecks3dOn = false;
      r.render(s.controller.view);
      const offCount = r.wrecks3d.count;
      r.wrecks3dOn = true;
      return { onStats, uStats, offCount };
    });
    const okWreck = chk.onStats.total === 10 && chk.onStats.calls <= 18 && chk.offCount === 0;
    if (!okWreck) fail++;
    console.log(
      `Wracks 3D: ${chk.onStats.total} Wracks, ${chk.onStats.calls} Draw-Calls (${chk.onStats.instances} Instanzen, ${chk.onStats.tris} Dreiecke), `
        + `wrecks3dOn=false → ${chk.offCount}, Lackfotos ${spot.texReady ? 'geladen' : 'FEHLEN'}${okWreck ? '' : '  FEHLER'}`,
    );
    // 4. Messung mit 200 Einheiten (Seed 3): Draw-Calls und Zeit „Objekte“
    await g.run(() => {
      const s = window.__frontline.session();
      s.game.wrecks.length = 0;
      s.renderer.revealAll = false;
      s.renderer.mood = null;
    });
    await spawnArmy(g);
    await view(g, 0, 1, 0, 420);
    for (const level of ['off', 'high']) {
      const m = await g.run((level) => {
        const s = window.__frontline.session();
        const r = s.renderer;
        const gl = r.gl;
        s.camera.three = true;
        r.setShadows(level);
        for (let i = 0; i < 2; i++) r.render(s.controller.view);
        const orig = r.objects3d.bind(r);
        let tSum = 0;
        let cSum = 0;
        let triSum = 0;
        r.objects3d = function (f) {
          let c = 0;
          let tr = 0;
          const r2 = gl.render.bind(gl);
          gl.render = (sc, cam) => {
            r2(sc, cam);
            c += gl.info.render.calls;
            tr += gl.info.render.triangles;
          };
          const t0 = performance.now();
          try {
            return orig(f);
          } finally {
            tSum += performance.now() - t0;
            cSum += c;
            triSum += tr;
            gl.render = r2;
          }
        };
        const N = 6;
        for (let i = 0; i < N; i++) r.render(s.controller.view);
        r.objects3d = orig;
        return { level, objMs: +(tSum / N).toFixed(1), calls: Math.round(cSum / N), tris: Math.round(triSum / N), u: r.units3d.stats() };
      }, level);
      const okInst = m.u.total >= 200 && m.u.calls <= 20;
      if (!okInst) fail++;
      console.log(
        `Instancing 200 Einheiten (Schatten ${level}): Objekte ${m.objMs} ms, ${m.calls} Draw-Calls gesamt (${m.tris} Dreiecke); `
          + `units3d: ${m.u.total} Einheiten, ${m.u.calls} Draw-Calls (${m.u.instances} Instanzen)${okInst ? '' : '  FEHLER'}`,
      );
    }
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
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
  if (!only || only === 'wasser') await water();
  if (only === 'mvp') await mvp();
  if (only === 'ruinen') await ruinen();
  if (!only || only === 'natur') await nature();
  if (!only || only === 'karte') await karte();
  if (!only || only === 'props') await propsPart();
  if (!only || only === 'wetter') await weatherPart();
  if (!only || only === 'wege') await wegePart();
  if (!only || only === 'bruecke') await bridgePart();
  if (!only || only === 'freikamera') await freeCamera();
  if (!only || only === 'tagnacht') await dayNightPart();
  if (!only || only === 'wracks') await wracksPart();
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
