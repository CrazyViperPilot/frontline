// Einheiten-Modelle, Familie Hubschrauber und Drohnen: littlebird, drone, fpv, gunship, transporter. Einstieg: ../unitpaint.js.
import { WHEEL, METAL, GUN, GLASS, OLIVE, WHITE, box, prX, prY, prZ, cyl, ball, on, fine } from './shapes.js';
import { mix } from '../color.js';

// ---------- Modelle: Luftfahrzeuge ----------

function littlebird(P) {
  const S = [];
  const body = mix(P.air, '#24272a', 0.55);
  for (const side of [-1, 1]) {
    S.push(cyl([-5.5, side * 3.6, 0.6], [7.5, side * 3.6, 0.6], 0.45, 0.45, 6, METAL)); // Kufe
    for (const x of [-2.5, 4]) S.push(cyl([x, side * 3.6, 0.6], [x, side * 2.2, 3.4], 0.3, 0.3, 4, METAL));
  }
  S.push(ball([1.5, 0, 6.2], 6.4, 3.9, 3.8, body));
  S.push(ball([4.6, 0, 6.8], 3.6, 3.3, 3.1, GLASS));
  S.push(cyl([-4, 0, 6.8], [-15.5, 0, 8.4], 1.2, 0.55, 6, body)); // Heckausleger
  S.push(box(-16.4, -14.6, -0.25, 0.25, 7.4, 12.6, body)); // Seitenleitwerk
  S.push(box(-15.2, -13.4, -3, 3, 8.1, 8.5, body));
  S.push(fine(on(S[S.length - 4], box(-11, -6, -1.3, 1.3, 7.6, 7.85, P.mark, { noLine: true, only: 'top' }))));
  S.push(cyl([1.5, 0, 9.6], [1.5, 0, 11.4], 0.75, 0.6, 6, METAL)); // Rotormast
  S.push(fine(box(-2, 2, -4.1, -3.85, 4.5, 6.5, P.mark, { noLine: true, only: 'iso' }))); // Kennung
  S.push(fine(box(-2, 2, 3.85, 4.1, 4.5, 6.5, P.mark, { noLine: true })));
  return { S, rotors: [{ x: 1.5, z: 11.6, r: 12.5, n: 5 }], tail: { x: -15.6, z: 9.6, r: 2.4 }, foot: [-16, 10, -4.5, 4.5] };
}

/**
 * Aufklärungsdrohne „drone“ (Paket „Aufklärungsdrohne“): kleine Starrflügel-Drohne im Mini-Format (Länge ≈ 4 m, Spannweite ≈ 6 m;
 * im Modell Spannweite ≈ 22, Länge ≈ 15 Bildpunkte). Schlanker Rumpf mit kurzer Nase, gerader langer Flügel mittig am Rumpf (Spitzen
 * in Teamfarbe), zwei Doppelausleger zum Heck mit zwei Seitenleitwerken (Spitzen in Teamfarbe) und horizontalem Leitwerk dazwischen.
 * Druckpropeller hinten als feste Scheibe mit Nabe: der Renderer dreht Rotoren nur waagrecht, ein Heckpropeller steht senkrecht.
 * Kamerakugel unter der Nase. Keine Zustände (kein `rotors`, kein `tail`).
 */
function drone(P) {
  const S = [];
  const body = mix(P.air, '#5d666b', 0.4);
  const dark = mix(body, '#000000', 0.25);
  // Rumpf: schlank, hinten etwas dicker, Nase spitz zulaufend
  S.push(cyl([-4.4, 0, 3], [5.6, 0, 3], 0.8, 0.8, 8, body));
  S.push(cyl([5.6, 0, 3], [7.2, 0, 2.9], 0.8, 0.3, 8, body));
  S.push(cyl([-4.4, 0, 3], [-5.4, 0, 3], 0.8, 0.6, 8, dark)); // Motorgondel am Heck
  // Druckpropeller: Scheibe in senkrechter Ebene hinter dem Motor, Nabe mit Spinner nach hinten
  S.push(cyl([-5.7, 0, 3], [-5.9, 0, 3], 1.5, 1.5, 12, METAL));
  S.push(cyl([-5.4, 0, 3], [-6.2, 0, 3], 0.45, 0.12, 6, METAL));
  // Kamerakugel unter der Nase
  S.push(ball([5.8, 0, 1.9], 0.9, 0.9, 0.9, GLASS));
  // Flügel: gerade und lang, mittig am Rumpf; Spitzen in Teamfarbe
  for (const side of [-1, 1]) {
    S.push(prZ([[1.6, 0], [1.2, side * 11], [-0.8, side * 11], [-1.2, 0]], 3.1, 3.35, body));
    S.push(fine(box(0.2, 1.2, side * 11 - 0.2, side * 11 + 0.2, 3.35, 3.4, P.mark, { noLine: true })));
    // Doppelausleger vom Flügelende zum Heck
    S.push(cyl([-1.5, side * 1.2, 3], [-7, side * 3.9, 3], 0.36, 0.3, 5, body));
    // Seitenleitwerk am Auslegerende, Spitze in Teamfarbe
    const fy = side * 3.9;
    const fin = prX([[-5.8, 3.2], [-7.6, 6], [-8.2, 6], [-7.4, 3.2]], fy - 0.2, fy + 0.2, body);
    S.push(fin);
    S.push(fine(on(fin, prX([[-7.2, 5.2], [-7.6, 6], [-8.2, 6], [-7.8, 5.2]], fy - 0.23, fy + 0.23, P.mark, { noLine: true }))));
  }
  // Horizontales Leitwerk zwischen den Auslegern
  S.push(prZ([[-5.6, -3.9], [-7.4, -3.9], [-7.4, 3.9], [-5.6, 3.9]], 3.15, 3.35, body));
  return { S, foot: [-8.2, 7.2, -11, 11] };
}

/**
 * Kamikazedrohne „fpv“ (Paket „Kamikazedrohne“): FPV-Quadrocopter im Mini-Format (Durchmesser ≈ 0,6 m, im Modell ≈ 13 Bildpunkte,
 * zur Lesbarkeit groß gezeichnet). Flacher X-Rahmen mit vier Armen, an jedem Armende ein Motor. Die Propeller drehen sich als
 * `rotors` mit x/y auf den Diagonalen (Scheibe und Blätter live gezeichnet, keine festen Scheiben im Körper). In der Mitte ein
 * Akkukasten mit Teamstreifen, darunter festgezurrt der Sprengkopf (dicker Zylinder, Spitze nach vorn), vorn die kleine Kamera.
 * Keine Zustände (kein `tail`).
 */
function fpv(P) {
  const S = [];
  const body = mix(P.air, '#3a3f43', 0.45);
  const dark = mix(body, '#000000', 0.3);
  const A = 3.5; // Motorabstand von der Mitte (je Achse)
  const Z = 3.2; // Höhe des Rahmens
  const rotors = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = sx * A;
      const py = sy * A;
      S.push(cyl([0, 0, Z], [px, py, Z], 0.45, 0.4, 4, body)); // Arm
      S.push(cyl([px, py, Z], [px, py, Z + 0.9], 0.85, 0.8, 6, dark)); // Motor
      rotors.push({ x: px, y: py, z: Z + 1.36, r: 1.8, n: 2 }); // Propeller (zwei Blätter) auf dem Motor
    }
  }
  S.push(box(-2, 2, -2, 2, Z - 0.15, Z + 0.15, dark)); // Rahmenplatte in der Mitte
  S.push(box(-1.6, 1.6, -1.3, 1.3, Z + 0.15, Z + 1.5, body)); // Akkukasten
  S.push(fine(box(-1.2, 1.2, -0.7, 0.7, Z + 1.5, Z + 1.62, P.mark, { noLine: true, only: 'top' }))); // Teamstreifen
  // Sprengkopf unter der Platte: dicker Zylinder, Spitze nach vorn
  S.push(cyl([-1.9, 0, 1.7], [1.6, 0, 1.7], 1.4, 1.4, 8, OLIVE));
  S.push(cyl([1.6, 0, 1.7], [2.9, 0, 1.7], 1.4, 0.3, 8, OLIVE));
  S.push(fine(box(-0.3, 0.3, -1.6, 1.6, 0.25, Z - 0.15, dark, { noLine: true }))); // Spanngurt
  // Kamera vorn auf der Platte
  S.push(box(1.8, 2.6, -0.6, 0.6, Z - 0.1, Z + 0.5, dark));
  S.push(fine(ball([2.75, 0, Z + 0.2], 0.45, 0.45, 0.45, GLASS)));
  return { S, rotors, foot: [-5.3, 5.3, -5.3, 5.3] };
}

function gunship(P) {
  const S = [];
  const body = mix(P.air, '#3c4136', 0.35);
  const fus = prX([[-7, 2.6], [-7, 9], [2, 10.4], [9.5, 8.4], [13.5, 5.2], [12, 2.6]], -2.4, 2.4, body);
  S.push(fus);
  S.push(on(fus, prX([[0.5, 9.2], [3, 10.9], [9, 8.9], [12.2, 6], [10, 5.6]], -1.9, 1.9, GLASS, { noLine: true })));
  for (const side of [-1, 1]) {
    S.push(cyl([-5, side * 3.4, 9.2], [2, side * 3.4, 9.2], 1.55, 1.4, 8, body)); // Triebwerk
    S.push(box(-2.5, 1.5, side < 0 ? -8.6 : 2.4, side < 0 ? -2.4 : 8.6, 6.2, 6.9, body)); // Stummelflügel
    S.push(cyl([-2.5, side * 7.2, 4.9], [2.8, side * 7.2, 4.9], 1.15, 1.15, 8, OLIVE)); // Raketenbehälter
    S.push(fine(cyl([-2, side * 4.6, 5.1], [2.6, side * 4.6, 5.1], 0.55, 0.55, 6, WHITE))); // Lenkflugkörper
    S.push(cyl([9, side * 2.2, 0.9], [9, side * 2.2, 2.8], 0.3, 0.3, 4, METAL));
    S.push(cyl([9, side * 2.2, 0.9], [9, side * 2.2 + side * 0.6, 0.9], 0.85, 0.85, 8, WHEEL));
  }
  S.push(cyl([-7, 0, 6.6], [-21, 0, 8.4], 1.7, 0.75, 6, body)); // Heckausleger
  S.push(box(-22.2, -19.8, -0.3, 0.3, 7, 13.6, body));
  S.push(box(-21, -18.6, -3.6, 3.6, 7.6, 8.1, body));
  S.push(cyl([12, 0, 2.6], [17, 0, 2.6], 0.4, 0.35, 6, GUN)); // Bordkanone
  S.push(box(11, 13.2, -1, 1, 1.8, 3.4, METAL));
  S.push(cyl([0, 0, 10.4], [0, 0, 12.4], 0.8, 0.7, 6, METAL));
  S.push(fine(on(fus, box(-6, -1, -2.55, -2.4, 4, 7, P.mark, { noLine: true, only: 'iso' }))));
  S.push(fine(on(fus, box(-6, -1, 2.4, 2.55, 4, 7, P.mark, { noLine: true }))));
  S.push(fine(on(S[S.length - 9], box(-17, -9, -0.9, 0.9, 7.9, 8.1, P.mark, { noLine: true, only: 'top' }))));
  return { S, rotors: [{ x: 0, z: 12.6, r: 14.5, n: 4 }], tail: { x: -21, z: 12, r: 2.8 }, foot: [-22, 17, -8.6, 8.6] };
}

function transporter(P) {
  const S = [];
  const body = mix(P.air, '#4a5040', 0.3);
  const fus = prY([[-4.6, 2.2], [4.6, 2.2], [5.2, 4], [5.2, 9.2], [4.2, 10.8], [-4.2, 10.8], [-5.2, 9.2], [-5.2, 4]], -18, 13, body);
  S.push(fus);
  const nose = prX([[13, 2.6], [13, 10.6], [16.5, 9.6], [19, 6.4], [18.5, 3.6]], -4.6, 4.6, body);
  S.push(nose);
  S.push(on(nose, prX([[15.6, 9.7], [17.6, 8.8], [18.9, 6.6], [16.6, 6.6]], -3.6, 3.6, GLASS, { noLine: true })));
  for (const side of [-1, 1]) {
    S.push(box(-11, 8, side < 0 ? -6.6 : 5.2, side < 0 ? -5.2 : 6.6, 2.2, 5.6, body)); // Seitentanks
    for (const x of [-12, 9]) S.push(cyl([x, side * 4, 1.1], [x, side * 4 + side * 0.8, 1.1], 1.1, 1.1, 8, WHEEL));
    for (let i = 0; i < 4; i++) S.push(fine(on(fus, box(-8 + i * 4, -5.5 + i * 4, side < 0 ? -5.35 : 5.2, side < 0 ? -5.2 : 5.35, 7.2, 8.8, GLASS, { noLine: true, only: 'iso' }))));
  }
  S.push(box(-18.5, -10.5, -2.6, 2.6, 10.8, 15.6, body)); // hinterer Turm
  S.push(box(8.5, 13, -2.2, 2.2, 10.8, 12.4, body)); // vorderer Turm
  for (const side of [-1, 1]) S.push(cyl([-9, side * 3.6, 11.2], [-1, side * 3.6, 11.2], 1.3, 1.3, 8, body)); // Triebwerke
  S.push(cyl([-14.5, 0, 15.6], [-14.5, 0, 16.8], 0.75, 0.6, 6, METAL));
  S.push(cyl([10.8, 0, 12.4], [10.8, 0, 13.6], 0.75, 0.6, 6, METAL));
  S.push(fine(on(fus, box(-12, 6, -1.2, 1.2, 10.8, 11, P.mark, { noLine: true }))));
  for (const side of [-1, 1]) S.push(fine(on(fus, box(-16, -12, side < 0 ? -5.35 : 5.2, side < 0 ? -5.2 : 5.35, 3, 6.6, P.mark, { noLine: true, only: 'iso' }))));
  return { S, rotors: [{ x: 10.8, z: 13.8, r: 13, n: 3 }, { x: -14.5, z: 17, r: 13, n: 3 }], foot: [-18.5, 19, -6.6, 6.6] };
}

export { littlebird, drone, fpv, gunship, transporter };
