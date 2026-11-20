// Vorschau der Props der Karte (Zäune, Mauern …; js/render/mapprops.js): malt je Art eine kleine Anlage mit Gerade, Ecke, T-Stück,
// Kreuz, Ende, Tor zu und offen und Trümmern, daneben Kampfpanzer und Soldat als Größenvergleich, je in Sommer und Winter bei
// Zoom 3 und Spielzoom 1,6 (Iso), dazu 2D von oben. Gemalt mit den Funktionen des Spiels (echte Kamera, Schatten, Reihenfolge).
//
//   node tools/propspreview.mjs                       → .preview/props.png (alle Arten)
//   node tools/propspreview.mjs fence_wood wall_stone → nur diese Arten
//   node tools/propspreview.mjs --group fence --out /tmp/x.png
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { serve } from './smoke.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const out = resolve(opt('out', '.preview/props.png'));
const group = opt('group', null);
const plan = opt('plan', null); // eigene Anlage: Zeilen mit | getrennt (# g o r)
const zoomArg = opt('zoom', null); // nur dieser Zoom (Iso, Sommer)
const kinds = [...args];

let pw;
try {
  pw = await import('playwright');
} catch {
  pw = createRequire(import.meta.url)('playwright');
}
const { srv, port } = await serve();
const browser = await pw.chromium.launch();
try {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  await page.goto(`http://127.0.0.1:${port}/manifest.json`); // gleiche Herkunft für die Modul-Importe
  const res = await page.evaluate(
    async ({ kinds, group, plan, zoomArg }) => {
      const { PROPS } = await import('/js/data/props.js');
      const { BALANCE } = await import('/js/data/balance.js');
      const { UNITS } = await import('/js/data/units.js');
      const { Camera } = await import('/js/render/camera.js');
      const MP = await import('/js/render/mapprops.js');
      const U = await import('/js/render/unitpaint.js');
      const SC = await import('/js/render/spritecache.js');
      const all = Object.keys(PROPS.kinds).filter((k) => !group || PROPS.kinds[k].group === group);
      const list = kinds.length ? kinds : all;
      const bad = list.filter((k) => !PROPS.kinds[k]);
      if (bad.length) return { error: `unbekannt: ${bad.join(', ')} (Arten: ${all.join(', ')})` };
      const T = BALANCE.map.tile;
      // Anlage je Kachelart: # Kachel, g Tor zu, o Tor offen, r Trümmer (Arten ohne Trümmer: weg)
      const PLAN = plan ? plan.split('|') : [
        '##g##  #     ',
        '#   #  #     ',
        '#  ######r   ',
        '#   #  #     ',
        '##o##  r#    ',
      ];
      const X0 = 40; // Lage auf der Karte (Zellen), weit weg vom Rand
      const Y0 = 40;
      const scene = (kind) => {
        const props = [];
        const st = [];
        const K = PROPS.kinds[kind];
        if (!K.line) {
          // Einzelstück: gerade, 90°, 45°, mit Fahne in Teamfarben, zerstört; Schranke zu und offen
          const at = [[2, 1.5], [6, 1.5], [10, 1.5], [2, 3.8], [6, 3.8]];
          const set = [
            { rot: 0, team: 0 }, { rot: 2, team: 1 }, { rot: 1, team: -1 },
            K.gate ? { rot: 0, gate: 2 } : { rot: 6, team: 2 }, { rot: 0, rubble: true },
          ];
          set.forEach((o, k) => {
            if (o.rubble && !K.rubble && !K.gate) return;
            props.push({ kind, x: (X0 + at[k][0]) * T, y: (Y0 + at[k][1]) * T, rot: o.rot, ...(o.team >= 0 ? { team: o.team } : {}), ...(o.gate ? { gate: o.gate } : {}) });
            st.push(o.rubble && K.rubble ? 1 : 0);
          });
        } else PLAN.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === ' ') return;
          props.push({ kind, x: (X0 + c + 0.5) * T, y: (Y0 + r + 0.5) * T, ...(K.gate && ch === 'g' ? { gate: 1 } : K.gate && ch === 'o' ? { gate: 2 } : {}) });
          st.push(ch === 'r' ? 1 : 0);
        }));
        const units = [
          { type: 'rifleman', team: 0, angle: 0.6, x: (X0 + (PROPS.kinds[kind].line ? 2 : 1.6)) * T, y: (Y0 + 2.6) * T },
          { type: 'rifleman', team: 1, angle: 2.2, x: (X0 + 5.6) * T, y: (Y0 + 1.1) * T },
          { type: 'tank', team: 0, angle: 0.3, x: (X0 + 11) * T, y: (Y0 + (PROPS.kinds[kind].line ? 1.5 : 4)) * T },
        ].map((u) => ({ ...u, def: UNITS[u.type], alive: true, id: 1 }));
        return { props, st: Uint8Array.from(st), units };
      };
      const cx = (X0 + 6.5) * T;
      const cy = (Y0 + 2.5) * T;
      const lift = (z, iso) => (iso ? -10 * z : 0); // Bildmitte etwas tiefer: Zäune und Panzer ragen nach oben
      const panels = zoomArg ? [[`Iso Zoom ${zoomArg}`, Number(zoomArg), 'summer', true]] : [
        ['Iso Zoom 3, Sommer', 3, 'summer', true],
        ['Iso Zoom 3, Winter', 3, 'winter', true],
        ['Iso Zoom 1,6, Sommer', 1.6, 'summer', true],
        ['Iso Zoom 1,6, Winter', 1.6, 'winter', true],
        ['2D Zoom 1,6, Sommer', 1.6, 'summer', false],
      ];
      const NC = 13; // Breite der Anlage samt Panzer (Zellen)
      const NR = 5;
      const K = 0.7071;
      // Iso: Rauten-Ausdehnung der Anlage (x − y bzw. (x + y) / 2) plus Höhe nach oben; 2D: Rechteck mit Rand
      const size = (z, iso) => (iso ? [Math.ceil((NC + NR + 1) * T * K * z), Math.ceil(((NC + NR) * T * K * 0.5 + 24) * z)] : [Math.ceil((NC + 1) * T * z), Math.ceil((NR + 1) * T * z)]);
      const LABEL = 18;
      const widths = panels.map(([, z, , iso]) => size(z, iso)[0]);
      const rowH = Math.max(...panels.map(([, z, , iso]) => size(z, iso)[1])) + LABEL;
      const cv = document.createElement('canvas');
      cv.width = widths.reduce((a, b) => a + b, 0) + 120;
      cv.height = list.length * rowH + 22;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#2a2d27';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#e8eadf';
      ctx.font = '12px sans-serif';
      ctx.fillText('Props: Gerade, Ecke, T-Stück, Kreuz, Ende, Tor zu (oben), Tor offen (unten), Trümmer (r) · Panzer und Soldaten zum Größenvergleich', 8, 15);
      list.forEach((kind, ri) => {
        const { props, st, units } = scene(kind);
        const looks = MP.propLooksOf(props, st, ri + 1);
        let x0 = 120;
        const y0 = 22 + ri * rowH;
        ctx.fillStyle = '#e8eadf';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(PROPS.kinds[kind].name, 8, y0 + rowH / 2);
        ctx.font = '11px sans-serif';
        ctx.fillText(kind, 8, y0 + rowH / 2 + 15);
        panels.forEach(([label, z, season, iso], pi) => {
          const [w, h] = size(z, iso);
          const pc = document.createElement('canvas');
          pc.width = w;
          pc.height = h;
          const p = pc.getContext('2d');
          p.fillStyle = season === 'winter' ? '#dfe5e8' : '#7d8a6a'; // Boden wie im Spiel: Gras, im Winter Schnee
          p.fillRect(0, 0, w, h);
          const cam = new Camera(BALANCE.map.width, BALANCE.map.height);
          cam.iso = iso;
          cam.zoom = z;
          cam.resize?.(w, h);
          cam.viewW = w;
          cam.viewH = h + 2 * lift(z, iso);
          cam.x = cx;
          cam.y = cy;
          SC.spriteFrame();
          if (iso) {
            // Schatten am Boden zuerst (wie isoShadows), dann alles nach Tiefe (wie isoObjects)
            for (const o of looks) {
              SC.spriteFrame(); // Zeitbudget je Bild des Spiels gilt hier nicht
              MP.drawPropShadowIso(p, cam, o, season);
            }
            for (const u of units) {
              SC.spriteFrame();
              U.drawUnitShadowIso(p, cam, u, cam.worldToScreen(u.x, u.y), 1);
            }
            const items = [...looks.map((o) => ({ k: o.x + o.y, o })), ...units.map((u) => ({ k: u.x + u.y, u }))].sort((a, b) => a.k - b.k);
            for (const it of items) {
              SC.spriteFrame();
              p.setTransform(1, 0, 0, 1, 0, 0);
              if (it.o) MP.drawPropIso(p, cam, it.o, season, MP.propFlagColor(null, it.o));
              else U.drawUnitIso(p, cam, it.u, cam.worldToScreen(it.u.x, it.u.y));
            }
          } else {
            p.setTransform(z, 0, 0, z, w / 2 - cx * z, h / 2 - cy * z);
            for (const o of looks) {
              SC.spriteFrame();
              MP.drawPropsTop(p, [o], () => true, z, season, (q) => MP.propFlagColor(null, q));
            }
            for (const u of units) {
              SC.spriteFrame();
              U.drawUnitTop(p, u, z);
            }
            p.setTransform(1, 0, 0, 1, 0, 0);
          }
          ctx.drawImage(pc, x0, y0 + LABEL);
          ctx.fillStyle = '#e8eadf';
          ctx.font = '11px sans-serif';
          if (ri === 0 || pi >= 0) ctx.fillText(label, x0 + 4, y0 + 13);
          x0 += w;
        });
      });
      return { png: cv.toDataURL('image/png'), w: cv.width, h: cv.height, list };
    },
    { kinds, group, plan, zoomArg },
  );
  if (res.error) {
    console.error(res.error);
    process.exitCode = 1;
  } else {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(res.png.split(',')[1], 'base64'));
    console.log(`${out} (${res.w} × ${res.h}): ${res.list.join(', ')}`);
  }
} finally {
  await browser.close();
  srv.close();
}
