// Haupt-Schleife (docs/archiv/verlauf.md §5 core/loop.js): feste Schrittweite für update(), render() pro Frame. DOM: requestAnimationFrame.
// Messanzeige (ui/perfmeter.js): setzt jemand loop.onFrame, misst die Schleife Simulations- und Bildzeit je Frame und ruft den Haken
// am Bildende auf. Ohne Haken (null) läuft alles wie vorher, ohne Zeitmessung.

const MAX_STEPS = 10; // max. Simulationsschritte pro Frame

/**
 * @param {{ update(dt: number): void, render(): void, tickRate?: number, onFrame?: Function | null }} opts
 * @returns {{ start(): void, stop(): void, speed: number, paused: boolean, running: boolean, onFrame: Function | null }}
 */
export function createLoop({ update, render, tickRate = 20, onFrame = null } = {}) {
  const step = 1 / tickRate;
  let acc = 0;
  let last = null;
  let raf = 0;

  const loop = {
    speed: 1,
    paused: false,
    running: false,
    onFrame, // ({ now, simMs, steps, renderMs }) je Bild, nur mit Messanzeige; null = keine Messung

    start() {
      if (loop.running) return;
      loop.running = true;
      last = null;
      raf = requestAnimationFrame(frame);
    },

    stop() {
      loop.running = false;
      cancelAnimationFrame(raf);
    },
  };

  // Fehler in update/render: einmal je Meldung in die Konsole, das Spiel läuft weiter (vorher hielt eine Ausnahme die Schleife für
  // immer an, weil der nächste Frame erst nach render() angefordert wurde)
  const reported = new Set();
  const guard = (fn, arg) => {
    try {
      fn(arg);
    } catch (err) {
      const key = String(err?.stack ?? err);
      if (!reported.has(key)) {
        reported.add(key);
        console.error(err);
      }
    }
  };

  function frame(now) {
    if (!loop.running) return;
    raf = requestAnimationFrame(frame); // vor update/render: ein Fehler darin hält die Schleife nicht an
    // Nach Tab-Wechsel nicht den ganzen Abstand nachholen
    const elapsed = last === null ? 0 : Math.min((now - last) / 1000, 0.25);
    last = now;

    const hook = loop.onFrame; // nur mit Messanzeige werden Zeiten gemessen
    let n = 0;
    let simMs = 0;
    if (!loop.paused) {
      acc += elapsed * loop.speed;
      while (acc >= step && n < MAX_STEPS) {
        if (hook) {
          const t0 = performance.now();
          guard(update, step);
          simMs += performance.now() - t0;
        } else guard(update, step);
        acc -= step;
        n++;
      }
      // Überschuss verwerfen, damit die Schleife nicht hinterherläuft
      if (acc > step) acc = step;
    }

    if (hook) {
      const t0 = performance.now();
      guard(render);
      guard(hook, { now, simMs, steps: n, renderMs: performance.now() - t0 });
    } else guard(render);
  }

  return loop;
}
