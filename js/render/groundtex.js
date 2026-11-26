// Detailtextur des WebGL-Bodens (ground.js): kachelbar, fester Startwert, einmal beim Start erzeugt (wenige Millisekunden).
// Das Bodenbild hat nur 4 Weltpixel je Texel und wirkt aus der Nähe verwaschen; diese Textur legt darüber feines Gras.
// r = Halme (0,5 = neutral, heller bzw. dunkler), g = Höhe der Grasbüschel (für Licht und Schatten im Shader),
// b = Steinchen (Deckung, Licht von links oben eingebacken), a = Blüten (Deckung; die Farbe wählt der Shader je Fleck).

export const DETAIL_N = 512; // Texel je Kante (Zweierpotenz: Mipmaps und Kachelung auch in WebGL 1)
const TUFTS = 3200; // Grasbüschel je Kachel
const BLADES = 70000; // Halme je Kachel
const PEBBLES = 700; // Steinchen je Kachel
const FLOWER_SPOTS = 90; // Blütengruppen je Kachel

/** Kachelbare Detailtextur, DETAIL_N² RGBA (Uint8Array). Deterministisch. */
export function groundDetail() {
  const N = DETAIL_N;
  const M = N - 1;
  let seed = 0x51ed27;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const at = (x, y) => (y & M) * N + (x & M);
  const tuft = new Float32Array(N * N);
  const blade = new Float32Array(N * N);
  const peb = new Float32Array(N * N);
  const flo = new Float32Array(N * N);

  // Büschel: weiche Hügel (Höhe), teils überlappend
  for (let i = 0; i < TUFTS; i++) {
    const cx = rand() * N;
    const cy = rand() * N;
    const r = 2 + rand() * 4.5;
    const h = 0.5 + rand() * 0.5;
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d2 >= r2) continue;
        const f = 1 - d2 / r2;
        tuft[at(x, y)] += h * f * f;
      }
    }
  }
  let tMax = 0;
  for (const v of tuft) tMax = Math.max(tMax, v);

  // Halme: kurze Striche in alle Richtungen (von oben gesehen), Spitze hell, Fuß dunkel; auf Büscheln dichter
  for (let i = 0; i < BLADES; i++) {
    let x = rand() * N;
    let y = rand() * N;
    if (tuft[at(Math.floor(x), Math.floor(y))] / tMax < rand() * 0.5) continue;
    const a = rand() * Math.PI * 2;
    const len = 2.5 + rand() * 4.5;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const lum = rand() < 0.75 ? 0.5 + rand() * 0.5 : -(0.3 + rand() * 0.5); // einige welke, dunkle Halme
    for (let s = 0; s <= len; s++) {
      const t = s / len;
      blade[at(Math.floor(x), Math.floor(y))] += s === 0 ? -0.6 : lum * (0.4 + 0.6 * t);
      x += dx;
      y += dy;
    }
  }

  // Steinchen: kleine Kreise, links oben hell
  for (let i = 0; i < PEBBLES; i++) {
    const cx = rand() * N;
    const cy = rand() * N;
    const r = 0.8 + rand() * 1.6;
    const lum = 0.55 + rand() * 0.45;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const ox = x + 0.5 - cx;
        const oy = y + 0.5 - cy;
        const d = Math.hypot(ox, oy);
        if (d > r + 0.5) continue;
        const cover = Math.min(1, r + 0.5 - d);
        const lit = 0.6 + 0.4 * Math.max(-1, Math.min(1, -(ox + oy) / (r * 1.4)));
        const k = at(x, y);
        peb[k] = Math.max(peb[k], cover * lit * lum);
      }
    }
  }

  // Blüten: Gruppen kleiner Punkte
  for (let i = 0; i < FLOWER_SPOTS; i++) {
    const cx = rand() * N;
    const cy = rand() * N;
    const n = 5 + Math.floor(rand() * 18);
    const spread = 5 + rand() * 9;
    for (let j = 0; j < n; j++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * spread;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d;
      const r = 0.7 + rand() * 0.7;
      for (let y = Math.floor(py - r - 1); y <= py + r + 1; y++) {
        for (let x = Math.floor(px - r - 1); x <= px + r + 1; x++) {
          const cover = Math.min(1, r + 0.5 - Math.hypot(x + 0.5 - px, y + 0.5 - py));
          if (cover <= 0) continue;
          const k = at(x, y);
          flo[k] = Math.max(flo[k], cover);
        }
      }
    }
  }

  const out = new Uint8Array(N * N * 4);
  const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let k = 0; k < N * N; k++) {
    out[k * 4] = byte(0.5 + 0.3 * blade[k]);
    out[k * 4 + 1] = byte(tuft[k] / tMax);
    out[k * 4 + 2] = byte(peb[k]);
    out[k * 4 + 3] = byte(flo[k]);
  }
  return out;
}
