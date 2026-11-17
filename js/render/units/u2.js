// Einheiten-Modell U-2 (Höhenaufklärer), dazu oval, arch und U2_GLOW, die auch planes.js nutzt. Einstieg: ../unitpaint.js.
import { TAU, WHEEL, METAL, GLASS, box, prX, loft, cyl, ball, on, fine } from './shapes.js';
import { hull, slab, inset } from './airparts.js';
import { mix } from '../color.js';

// ---------- U-2: Höhenaufklärer ----------

/** Ovaler Rumpfquerschnitt bei x: Halbbreite w, Halbhöhe h, Mitte in Höhe zc, n Ecken (für hull). */
const oval = (x, w, h, zc, n = 10) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) / n) * TAU;
    return [x, Math.cos(a) * w, zc + Math.sin(a) * h];
  });
/** Obere Hälfte eines Ovals bei x (Kanzel, Rahmen): von links unten über den Scheitel nach rechts unten, Unterkante in Höhe z0. */
const arch = (x, w, h, z0, n = 7) =>
  Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * i) / (n - 1);
    return [x, -Math.cos(a) * w, z0 + Math.sin(a) * h];
  });

// Rumpf der U-2 als Ringe [x, Halbbreite, Halbhöhe, Mitte z]: spitze Nase, Kanzel weit vorn, langer gleichmäßiger Rumpf,
// schlanker Heckkonus bis zur runden Düse. Länge mit Düse 40,8, halbe Spannweite 32,5 (Spannweite ≈ 1,6 × Länge wie beim Vorbild).
const U2_BODY = [
  [19.6, 0.7, 0.62, 3.0],
  [17.6, 1.3, 1.2, 3.08],
  [14.6, 1.72, 1.62, 3.14],
  [10.5, 1.92, 1.84, 3.16],
  [4.5, 1.98, 1.9, 3.16],
  [-3, 1.86, 1.8, 3.14],
  [-9, 1.55, 1.55, 3.12],
  [-14, 1.22, 1.28, 3.12],
  [-18.7, 0.98, 1.02, 3.15],
];
// Flügel als Profile quer [y, Vorderkante x, Hinterkante x, Dicke]: sehr lang und schmal, Vorderkante leicht gepfeilt, Hinterkante
// fast gerade, abgerundete Spitze. Unterseite in Höhe 2,95 (Mitteldecker).
const U2_WING = [
  [1.5, 4.1, -4.1, 0.5],
  [6, 3.55, -3.8, 0.46],
  [11, 2.98, -3.46, 0.42],
  [16, 2.42, -3.12, 0.38],
  [21, 1.85, -2.78, 0.33],
  [25.5, 1.33, -2.48, 0.28],
  [29, 0.93, -2.24, 0.23],
  [31.6, 0.62, -2.04, 0.19],
  [32.5, 0.12, -1.62, 0.11],
];
const U2_POGO = 17; // Stützräder („Pogos“) unter den Flügeln, Abstand zur Mitte
const U2_POD = 10; // Sensorbehälter („Superpods“) an den Flügeln, Abstand zur Mitte
/** Durchhang der Flügel am Boden (volle Tanks, Spitzen hängen außerhalb der Stützräder nach unten; im Flug gerade). */
const u2Droop = (y) => -0.0025 * Math.max(0, y - 10) ** 2;
// Abgasschein der U-2: kein Nachbrenner, nur ein schwacher, kurzer Schein (statt FLAME, Länge × len)
const U2_GLOW = [
  [1.25, 1, 'rgba(255,150,80,0.2)'],
  [0.7, 0.6, 'rgba(255,214,160,0.38)'],
];

/**
 * U-2 „Dragon Lady“ (seit dem Paket „U-2“): Höhenaufklärer ohne Waffen. Fast schwarzer, matter Anstrich, sehr lange gerade Flügel
 * mit großer Streckung und zwei Sensorbehältern, schlanker Rumpf mit gerahmter Kanzel weit vorn, seitliche Einläufe, Rückenbuckel,
 * hohes Seitenleitwerk (Spitze in Teamfarbe, dünne helle Kennung), kleine gerade Höhenleitwerke (Spitzen in Teamfarbe), runde Düse.
 * Am Boden (o.gear): Tandemfahrwerk unter dem Rumpf, Stützräder unter den Flügeln, Flügelspitzen hängen leicht nach unten.
 */
function u2(P, o) {
  const S = [];
  const body = mix(P.air, '#24282d', 0.8); // fast schwarz, Team nur als Hauch
  const dark = mix(body, '#000000', 0.35);
  const hump = mix(body, '#5a6068', 0.16); // Rückenbuckel (Antennenverkleidung), etwas heller
  const NOZ = '#4a4e52';
  const BLACK = '#121315';
  const ID = '#c3c6c0'; // dünne helle Kennung
  const gear = !!o.gear;
  const droop = gear ? u2Droop : () => 0;

  // Rumpf: Nasenspitze, dann die Ringe
  S.push(...hull([[[20.8, 0, 2.95]], ...U2_BODY.map(([x, w, h, z]) => oval(x, w, h, z))], body, { smooth: true }));
  // Düse (rund) mit dunkler Öffnung
  const noz = cyl([-18.6, 0, 3.15], [-19.9, 0, 3.15], 0.96, 0.84, 10, NOZ);
  S.push(noz);
  S.push(on(noz, slab(oval(-19.9, 0.62, 0.62, 3.15, 8), [-19, 0, 3.15], BLACK)));

  // Seitliche Lufteinläufe neben und hinter der Kanzel: halbrunde Hutzen mit schwarzer Öffnung
  for (const side of [-1, 1]) {
    const lip = [9.4, side * 1.95, 3.42];
    const intake = cyl(lip, [3.2, side * 1.55, 3.22], 0.86, 0.42, 8, body);
    S.push(intake);
    S.push(on(intake, slab(oval(9.4, 0.62, 0.62, 0, 8).map(([x, y, z]) => [x, lip[1] + y, lip[2] + z]), [8, lip[1], lip[2]], BLACK)));
  }

  // Kanzel weit vorn: getönte Haube mit Rahmen (Frontscheibe, Bügel, Heck), Lichtreflex
  const CAN = [
    [14.5, 0.55, 0.3],
    [13.4, 1.12, 0.95],
    [11.6, 1.22, 1.12],
    [9.9, 1.02, 0.82],
    [9.1, 0.6, 0.32],
  ];
  const z0 = 4.4;
  const can = hull(CAN.map(([x, w, h]) => arch(x, w, h, z0)), GLASS, { smooth: true });
  S.push(...can);
  const canAt = (x) => {
    for (let j = 0; j + 1 < CAN.length; j++) {
      const [xa, wa, ha] = CAN[j];
      const [xb, wb, hb] = CAN[j + 1];
      if (x <= xa && x >= xb) {
        const t = (xa - x) / (xa - xb);
        return [wa + (wb - wa) * t, ha + (hb - ha) * t];
      }
    }
    return [0.5, 0.3];
  };
  const frame = (x0, x1, seg) => {
    const [w0, h0] = canAt(x0);
    const [w1, h1] = canAt(x1);
    for (const so of hull([arch(x0, w0 + 0.07, h0 + 0.07, z0), arch(x1, w1 + 0.07, h1 + 0.07, z0)], dark)) S.push(on(can[seg], so));
  };
  frame(13.55, 13.2, 1); // Rahmen der Frontscheibe
  frame(11.75, 11.45, 1); // Bügel der Haube
  frame(9.95, 9.65, 3); // hinterer Rahmen
  for (const side of [-1, 1]) S.push(fine(on(can[1], box(9.4, 13.6, side * 1.12 - 0.07, side * 1.12 + 0.07, z0 + 0.05, z0 + 0.28, dark, { noLine: true })))); // Sims
  S.push(fine(on(can[2], ball([12.4, 0.35, 5.36], 1.1, 0.3, 0.16, '#9fb4c4', { n: 8, m: 3, half: true, noLine: true })))); // Lichtreflex
  // Rücken hinter der Kanzel und Antennenbuckel über dem Flügel
  S.push(...hull([arch(9.6, 0.8, 0.45, 4.5), arch(5.5, 0.75, 0.32, 4.6), arch(2.5, 0.5, 0.12, 4.7)], body, { smooth: true }));
  S.push(ball([-1.2, 0, 4.82], 4.4, 1.12, 0.82, hump, { n: 12, m: 4, half: true }));

  // Flügel: Profile quer, am Boden mit Durchhang; Sensorbehälter, am Boden Gleitkufen an den Spitzen
  const sec = (y, xl, xt, t, side) => {
    const c = xl - xt;
    const z = 2.95 + droop(y);
    const Y = side * y;
    return [[xl, Y, z + 0.38 * t], [xl - 0.18 * c, Y, z + t], [xt + 0.35 * c, Y, z + 0.78 * t], [xt, Y, z + 0.4 * t], [xt + 0.35 * c, Y, z + 0.1 * t], [xl - 0.18 * c, Y, z]];
  };
  for (const side of [-1, 1]) {
    S.push(...hull(U2_WING.map(([y, xl, xt, t]) => sec(y, xl, xt, t, side)), body, { smooth: true }));
    const yp = side * U2_POD;
    const pz = 2.9;
    S.push(cyl([4.6, yp, pz], [7.3, yp, pz + 0.06], 0.68, 0.1, 10, body)); // Spitze des Sensorbehälters
    S.push(cyl([-3.6, yp, pz], [4.6, yp, pz], 0.68, 0.68, 10, body));
    S.push(cyl([-3.6, yp, pz], [-6, yp, pz + 0.05], 0.68, 0.24, 10, body));
    const wb = 2.95 + droop(31.5);
    if (gear) S.push(box(-1.5, 0.1, side * 31.5 - 0.1, side * 31.5 + 0.1, wb - 0.4, wb + 0.05, dark, { only: 'iso' })); // Gleitkufe unter der Spitze
  }

  // Höhenleitwerke: klein und gerade, Spitzen in Teamfarbe
  const STAB = [[-14.6, 0.8], [-15.95, 6.6], [-18.6, 6.6], [-19.0, 0.8]];
  const TIP = [[-15.95, 6.6], [-16.35, 8.3], [-18.5, 8.3], [-18.6, 6.6]];
  for (const side of [-1, 1]) {
    const mir = (pl) => pl.map(([x, y]) => [x, y * side]);
    S.push(loft(mir(STAB), mir(inset(STAB, 0.22)), 3.12, 3.4, body));
    S.push(loft(mir(TIP), mir(inset(TIP, 0.18)), 3.13, 3.39, P.mark));
  }
  // Hohes Seitenleitwerk mit Spitze in Teamfarbe und dünner heller Kennung an beiden Seiten
  const fin = prX([[-10.6, 4.3], [-15.5, 11.4], [-18.15, 11.4], [-19.3, 4.0]], -0.3, 0.3, body);
  S.push(fin);
  S.push(fine(on(fin, prX([[-14.95, 10.6], [-15.5, 11.4], [-18.15, 11.4], [-18.05, 10.6]], -0.36, 0.36, P.mark, { noLine: true }))));
  // Kennung und Ruderspalt als dünne Platten je Seite, nicht aufgesetzt (on): mit der Mitte des Leitwerks plus Seitenversatz als
  // Tiefe liegt die ferne Platte hinter dem Leitwerk, die nahe davor (aufgesetzt schiene die ferne durch)
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? -0.36 : 0.3;
    for (const [x0, x1, za, zb, col] of [[-17.3, -14.3, 7.55, 7.85, ID], [-18.1, -17.85, 4.6, 10.45, dark]]) {
      const b = fine(box(x0, x1, y0, y0 + 0.06, za, zb, col, { noLine: true, only: 'iso' }));
      b.c = [fin.c[0], side * 0.33, fin.c[2]];
      S.push(b);
    }
  }

  if (gear) {
    // Tandemfahrwerk: Hauptfahrwerk hinter der Kanzel (Zwillingsräder), Spornräder unter dem Heck
    const twin = (x, y, r, w, n) => {
      for (const k of [-1, 1]) S.push(cyl([x, y + k * 0.08, r], [x, y + k * (0.08 + w), r], r, r, n, WHEEL));
    };
    S.push(cyl([7.2, 0, 1.5], [7.2, 0, 0.85], 0.22, 0.22, 4, METAL));
    twin(7.2, 0, 0.85, 0.7, 10);
    S.push(cyl([-14.3, 0, 2.0], [-14.3, 0, 0.5], 0.17, 0.17, 4, METAL));
    twin(-14.3, 0, 0.5, 0.38, 8);
    // Stützräder unter den Flügeln: Strebe mit kleinem Zwillingsrad
    for (const side of [-1, 1]) {
      const y = side * U2_POGO;
      S.push(cyl([-0.6, y, 2.95 + u2Droop(U2_POGO)], [-0.6, y, 0.5], 0.16, 0.16, 4, METAL));
      twin(-0.6, y, 0.48, 0.32, 8);
    }
  }
  return { S, nozzle: { x: -19.9, z: 3.15, sy: 0.6, sz: 0.6, len: 0.55, flame: U2_GLOW }, foot: [-19.9, 20.8, -32.5, 32.5] };
}

export { oval, arch, U2_GLOW, u2 };
