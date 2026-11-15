// Messanzeige (Paket „Messanzeige“): Bildrate, Bildzeit, Simulations- und Zeichenzeit je Ebene und Eingabeverzögerung.
// An mit F3 oder ?perf=1. Aus = keine Messung: Renderer und Schleife prüfen nur, ob ein Messobjekt gesetzt ist.
// PerfMeter rechnet ohne DOM (testbar in Node, test/perfmeter.test.js); PerfPanel schreibt nur das Textfeld, watchInput
// hängt die Eingabe-Zeitstempel an das Fenster.

export const WINDOW_MS = 2000; // Fenster der Mittelwerte (ms)
export const INPUT_KEEP = 10; // Zahl der letzten Eingaben für Mittel und Höchstwert
const PENDING_MAX = 50; // wartende Eingaben ohne Bild (z. B. Menü offen ohne Partie): mehr werden verworfen
const PANEL_MS = 250; // Textfeld höchstens 4× je s aktualisieren
const OVERHEAD = 'Minimap, HUD'; // Rest der Bildschleife außerhalb des Renderers

function blank() {
  return { sim: 0, steps: 0, render: 0, layers: new Map() };
}

/** Zahl für die Anzeige mit deutschem Komma. */
export function fmtMs(v) {
  return Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '–';
}

export class PerfMeter {
  constructor() {
    this.reset();
  }

  /** Alle Messwerte verwerfen (beim Einschalten). */
  reset() {
    this.frames = []; // je Bild im Fenster: { t, gap, sim, steps, render, layers }
    this.cur = blank(); // Messwerte des laufenden Bildes
    this.pending = []; // Zeitstempel der Eingaben, die auf ihr Bild warten
    this.inputs = []; // Verzögerungen der letzten Eingaben (ms)
    this.last = null; // Zeitstempel des letzten Bildes
  }

  /** Simulationszeit des laufenden Bildes (Summe aller update-Schritte) und Schrittzahl. */
  addSim(ms, steps) {
    this.cur.sim += ms;
    this.cur.steps += steps;
  }

  /** Zeichenzeit des Renderers für das laufende Bild (gesamt). */
  addRender(ms) {
    this.cur.render += ms;
  }

  /** Zeit einer Ebene zum laufenden Bild addieren (mehrfach aufrufbar). */
  add(layer, ms) {
    const m = this.cur.layers;
    m.set(layer, (m.get(layer) ?? 0) + ms);
  }

  /** Ebene messen: t = Zeit am Anfang der Ebene; liefert die Zeit am Ende (Anfang der nächsten). */
  lap(layer, t) {
    const now = performance.now();
    this.add(layer, now - t);
    return now;
  }

  /** Eingabe (pointerdown, keydown) mit ihrem event.timeStamp; wartet auf das nächste Bild. */
  input(ts) {
    if (this.pending.length < PENDING_MAX) this.pending.push(ts);
  }

  /**
   * Ende eines Bildes (aus der Schleife): now = rAF-Zeitstempel am Bildbeginn, simMs/steps = Simulation, renderMs = die ganze
   * Bild-Rückruffunktion. Der Rest (renderMs ohne Renderer) zählt als „Minimap, HUD“. Wartende Eingaben bekommen die Zeit bis
   * zum Bildbeginn. Alte Bilder außerhalb des Fensters fallen weg.
   */
  endFrame({ now, simMs = 0, steps = 0, renderMs = 0 }) {
    const c = this.cur;
    this.addSim(simMs, steps);
    const rest = renderMs - c.render;
    if (rest > 0) this.add(OVERHEAD, rest);
    this.frames.push({ t: now, gap: this.last === null ? null : now - this.last, sim: c.sim, steps: c.steps, render: c.render, layers: c.layers });
    this.last = now;
    for (const ts of this.pending) this.inputs.push(Math.max(0, now - ts));
    if (this.inputs.length > INPUT_KEEP) this.inputs.splice(0, this.inputs.length - INPUT_KEEP);
    this.pending = [];
    this.cur = blank();
    while (this.frames.length && this.frames[0].t <= now - WINDOW_MS) this.frames.shift();
  }

  /**
   * Auswertung der Bilder der letzten 2 s bis now (Standard: letztes Bild). Ebenen nach Mittel sortiert; Eingaben: letzte 10.
   * fps aus dem mittleren Bildabstand; Zeiten je Bild, Ebenen als Mittel über alle Bilder des Fensters.
   */
  summary(now = this.last ?? 0) {
    const fr = this.frames.filter((f) => f.t > now - WINDOW_MS && f.t <= now);
    const n = fr.length;
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const max = (xs) => (xs.length ? Math.max(...xs) : 0);
    const gaps = fr.filter((f) => f.gap !== null).map((f) => f.gap);
    const sims = fr.map((f) => f.sim);
    const renders = fr.map((f) => f.render);
    const layerSum = new Map();
    for (const f of fr) for (const [k, v] of f.layers) layerSum.set(k, (layerSum.get(k) ?? 0) + v);
    const layers = [...layerSum].map(([name, s]) => ({ name, mean: n ? s / n : 0 })).sort((a, b) => b.mean - a.mean);
    const gapMean = mean(gaps);
    return {
      frames: n,
      fps: gapMean > 0 ? 1000 / gapMean : 0,
      gap: { mean: gapMean, max: max(gaps) },
      sim: { mean: mean(sims), max: max(sims) },
      steps: { mean: mean(fr.map((f) => f.steps)) },
      render: { mean: mean(renders), max: max(renders) },
      layers,
      input: { n: this.inputs.length, mean: mean(this.inputs), max: max(this.inputs) },
    };
  }
}

/** Textzeilen des Messfelds aus einer Auswertung (summary) und den Angaben zur Partie (info oder null). */
export function formatPanel(s, info = null) {
  const lines = [];
  lines.push(`Bilder ${Math.round(s.fps)} /s, je Bild ${fmtMs(s.gap.mean)} ms`);
  lines.push(`  langsamstes ${fmtMs(s.gap.max)} ms`);
  lines.push(`Simulation ${fmtMs(s.sim.mean)} ms (max ${fmtMs(s.sim.max)})`);
  lines.push(`  Schritte je Bild ${s.steps.mean.toFixed(1).replace('.', ',')}`);
  lines.push(`Zeichnen ${fmtMs(s.render.mean)} ms (max ${fmtMs(s.render.max)})`);
  for (const l of s.layers) lines.push(`  ${l.name.padEnd(14)}${fmtMs(l.mean).padStart(6)}`);
  lines.push(s.input.n ? `Eingabe ${fmtMs(s.input.mean)} ms (max ${fmtMs(s.input.max)})` : 'Eingabe noch keine');
  if (s.input.n) lines.push(`  letzte ${s.input.n} ${s.input.n === 1 ? 'Eingabe' : 'Eingaben'}`);
  if (info) {
    lines.push(`${info.view}: ${info.units} Einheiten, ${info.buildings} Gebäude`);
    lines.push(`dpr ${info.dpr}, Canvas ${info.canvas}`);
  }
  lines.push('F3 schaltet die Anzeige aus');
  return lines.join('\n');
}

/** Textfeld oben links unter der Kopfleiste (nur Anzeige, keine Klicks). Schreibt höchstens 4× je s. */
export class PerfPanel {
  constructor(parent, meter, info = () => null) {
    this.meter = meter;
    this.info = info;
    this.shown = null; // Zeitstempel der letzten Aktualisierung
    this.el = document.createElement('pre');
    this.el.className = 'perf';
    this.el.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.el);
  }

  update(now) {
    if (this.shown !== null && now - this.shown < PANEL_MS) return;
    this.shown = now;
    this.el.textContent = formatPanel(this.meter.summary(now), this.info());
  }

  destroy() {
    this.el.remove();
  }
}

/** Eingaben auf dem Fenster melden (pointerdown, keydown ohne Wiederholung). Liefert die Funktion zum Abmelden. */
export function watchInput(meter, target = window) {
  const on = (e) => {
    if (e.type === 'keydown' && e.repeat) return;
    meter.input(e.timeStamp);
  };
  const opts = { capture: true, passive: true };
  target.addEventListener('pointerdown', on, opts);
  target.addEventListener('keydown', on, opts);
  return () => {
    target.removeEventListener('pointerdown', on, opts);
    target.removeEventListener('keydown', on, opts);
  };
}
