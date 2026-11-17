// Einheiten-Modelle, Familie Kampfjets: f16, su27 (F-22 in f22.js). Einstieg: ../unitpaint.js.
import { WHEEL, METAL, GLASS, WHITE, box, prX, prZ, cyl, ball, on, fine } from './shapes.js';
import { hull, ring } from './airparts.js';
import { mix } from '../color.js';

function f16(P, o) {
  const S = [];
  const ms = o.missiles ?? 22;
  const aim = ms % 10; // Luft-Luft-Lenkraketen an den Flügelspitzen
  const agm = Math.floor(ms / 10); // Luft-Boden-Raketen unter den Flügeln (seit v5.41)
  const body = mix(P.air, '#9aa3a8', 0.5);
  const dark = mix(body, '#000000', 0.25);
  S.push(cyl([-15, 0, 4.2], [9, 0, 4.2], 2.2, 2.3, 10, body)); // Rumpf
  S.push(cyl([9, 0, 4.2], [17.5, 0, 4.4], 2.3, 0.25, 10, body)); // Nase
  S.push(fine(cyl([16.3, 0, 4.36], [17.6, 0, 4.4], 0.6, 0.2, 6, '#3d4246'))); // Radom
  S.push(ball([7.2, 0, 5.9], 3.8, 1.35, 1.6, GLASS, { n: 10, m: 5, half: true })); // Kanzel
  S.push(box(0, 8.5, -1.7, 1.7, 1.6, 3.2, dark)); // Lufteinlauf
  S.push(fine(box(8.5, 8.7, -1.4, 1.4, 1.9, 2.9, '#16181a', { noLine: true })));
  for (const side of [-1, 1]) {
    S.push(prZ([[5, 0], [-6, side * 13], [-9, side * 13], [-9.5, 0]].map(([x, y]) => [x, y + side * 1.6]), 3.6, 4.1, body)); // Flügel
    S.push(prZ([[-10.5, side * 1.6], [-15, side * 7.2], [-17.2, side * 7.2], [-17, side * 1.6]], 3.5, 3.9, body)); // Höhenleitwerk
    if (agm >= (side < 0 ? 1 : 2)) {
      S.push(cyl([-3.8, side * 8.2, 3.45], [-3.8, side * 8.2, 2.5], 0.35, 0.35, 4, METAL)); // Pylon
      S.push(cyl([-6.5, side * 8.2, 2.1], [2.2, side * 8.2, 2.1], 0.85, 0.85, 8, '#8d917c')); // Luft-Boden-Rakete
      S.push(cyl([2.2, side * 8.2, 2.1], [3.4, side * 8.2, 2.1], 0.85, 0.15, 8, '#3a3e40')); // Suchkopf
      S.push(fine(box(-6.4, -5, side * 8.2 - 1.6, side * 8.2 + 1.6, 2.05, 2.15, '#6f735f', { noLine: true }))); // Leitwerk
    }
    if (aim >= (side < 0 ? 1 : 2)) {
      S.push(cyl([-9.5, side * 14.9, 3.85], [-1.5, side * 14.9, 3.85], 0.5, 0.5, 6, WHITE)); // Lenkrakete an der Flügelspitze
      S.push(cyl([-1.5, side * 14.9, 3.85], [0, side * 14.9, 3.85], 0.5, 0.05, 6, '#7d8288'));
      S.push(fine(box(-9.5, -8, side * 14.9 - 1.3, side * 14.9 + 1.3, 3.8, 3.9, '#9aa0a6', { noLine: true })));
    }
    S.push(fine(box(-9, -6, side * 14.6 - 0.2, side * 14.6 + 0.2, 3.6, 4.1, P.mark, { noLine: true }))); // Flügelspitze in Teamfarbe
  }
  const fin = prX([[-9.5, 6.2], [-15.5, 12.8], [-17.5, 12.8], [-16.8, 6.2]], -0.3, 0.3, body);
  S.push(fin);
  S.push(fine(on(fin, prX([[-15, 11.4], [-15.6, 12.8], [-17.5, 12.8], [-17.2, 11.4]], -0.36, 0.36, P.mark, { noLine: true }))));
  S.push(cyl([-15, 0, 4.2], [-17.6, 0, 4.2], 1.85, 1.6, 10, '#4a4e52')); // Düse
  S.push(fine(on(S[0], box(-6, 2, -0.5, 0.5, 6.35, 6.45, dark, { noLine: true, only: 'top' }))));
  if (o.gear) {
    for (const [x, y] of [[11, 0], [-4.5, -2.6], [-4.5, 2.6]]) {
      S.push(cyl([x, y, 2.4], [x, y, 0.9], 0.25, 0.25, 4, METAL));
      S.push(cyl([x, y - 0.35, 0.8], [x, y + 0.35, 0.8], 0.8, 0.8, 8, WHEEL));
    }
  }
  return { S, nozzle: { x: -17.6, z: 4.2 }, foot: [-17.6, 17.6, -15.5, 15.5] };
}

// ---------- Su-27: Überlegenheitsjet mit langem Bug und zwei getrennten Triebwerken ----------

/**
 * Su-27 (Paket „Su-27“): langer schlanker Rumpf mit spitzem Radom und weit vorn liegender Kanzel (der Bug hängt leicht nach unten),
 * breiter flacher Mittelrumpf, der in die großen gepfeilten Flügel übergeht (Vorderkantenerweiterung an der Wurzel), zwei Triebwerke
 * weit außen mit runden Düsen, dazwischen ein Heckstachel über die Düsen hinaus, zwei senkrechte Seitenleitwerke auf den Gondeln und
 * große trapezförmige Höhenleitwerke. Bewaffnung wie die F-16 (o.missiles wie dort: Luft-Luft an den Flügelspitzen, % 10, plus 10 ×
 * Luft-Boden unter den Flügeln); o.gear = Fahrwerk am Boden. Teamfarbe nur an Flügelspitzen und Leitwerksspitzen.
 */
function su27(P, o) {
  const S = [];
  const ms = o.missiles ?? 22;
  const aim = ms % 10; // Luft-Luft-Lenkraketen an den Flügelspitzen
  const agm = Math.floor(ms / 10); // Luft-Boden-Raketen unter den Flügeln
  const body = mix(P.air, '#c3ccd3', 0.55); // heller blaugrauer Tarnanstrich
  const NOZ = '#4a4e52';

  // Rumpf: Spitze des Radoms, dann die Ringe von vorn nach hinten (Bug fällt leicht ab, Mitte breit und flach)
  S.push(
    ...hull(
      [
        [[23.6, 0, 3.9]],
        ring(21.5, 0.3, 3.55, 0.5, 4.0, 0.3, 4.45),
        ring(18.5, 0.6, 3.25, 0.95, 4.1, 0.6, 4.9),
        ring(15, 0.9, 3.0, 1.45, 4.25, 0.9, 5.4),
        ring(11.5, 1.45, 2.8, 2.0, 4.45, 1.3, 5.7),
        ring(6, 2.1, 2.55, 2.85, 4.3, 2.0, 5.65),
        ring(0, 2.5, 2.45, 3.3, 4.2, 2.3, 5.5),
        ring(-6, 2.5, 2.6, 3.3, 4.2, 2.1, 5.3),
        ring(-11, 2.0, 2.8, 2.7, 4.2, 1.6, 5.1),
        ring(-15, 1.3, 3.1, 1.9, 4.0, 1.0, 4.9),
        ring(-18.5, 0.7, 3.4, 1.2, 3.9, 0.6, 4.5),
      ],
      body,
      { smooth: true },
    ),
  );
  // Kanzel weit vorn, Tropfenform auf dem Rumpf
  S.push(ball([9.8, 0, 5.4], 3.5, 1.3, 1.8, GLASS, { n: 10, m: 5, half: true }));
  // Lufteinlauf unter der Vorderkante der Flügel (dunkel)
  S.push(box(1.5, 8.0, -1.8, 1.8, 1.9, 2.6, mix(body, '#000000', 0.35)));
  // Heckstachel zwischen den Düsen, ragt über sie hinaus
  S.push(cyl([-8, 0, 4.2], [-24.2, 0, 4.5], 1.05, 0.22, 8, body));

  for (const side of [-1, 1]) {
    // Flügel: große Wurzel mit Vorderkantenerweiterung, gepfeilte Vorderkante, gerade Spitze
    const wing = prZ([[12.5, 2.4], [9, 3.4], [-4.5, 14.6], [-9.2, 14.6], [-11.8, 2.4]].map(([x, y]) => [x, side * y]), 3.5, 3.9, body);
    S.push(wing);
    // dunkler Tarnfleck auf der Oberseite (die echte Su-27 trägt Tarnanstrich)
    S.push(fine(on(wing, prZ([[3.5, 4.5], [-1.5, 7.5], [-5.5, 8.2], [-3, 4.5]].map(([x, y]) => [x, side * y]), 3.9, 3.94, mix(body, '#5f6d76', 0.4), { noLine: true, only: 'top' }))));
    // Teamfarbe nur auf der Flügelspitze
    S.push(fine(box(-8.6, -4.6, side * 14.6 - 0.2, side * 14.6 + 0.2, 3.88, 3.96, P.mark, { noLine: true })));
    if (aim >= (side < 0 ? 1 : 2)) {
      // Lenkrakete an der Flügelspitze (wie die F-16), nach vorn über die Flügelkante
      S.push(cyl([-9, side * 14.9, 3.9], [-0.5, side * 14.9, 3.9], 0.5, 0.5, 6, WHITE));
      S.push(cyl([-0.5, side * 14.9, 3.9], [0.5, side * 14.9, 3.9], 0.5, 0.05, 6, '#7d8288'));
      S.push(fine(box(-9, -7.6, side * 14.9 - 1.3, side * 14.9 + 1.3, 3.9, 4.0, '#9aa0a6', { noLine: true })));
    }
    if (agm >= (side < 0 ? 1 : 2)) {
      // Luft-Boden-Rakete unter dem Flügel an einem Pylon
      S.push(cyl([-3.8, side * 8.6, 3.45], [-3.8, side * 8.6, 2.5], 0.35, 0.35, 4, METAL));
      S.push(cyl([-6.5, side * 8.6, 2.1], [2.2, side * 8.6, 2.1], 0.85, 0.85, 8, '#8d917c'));
      S.push(cyl([2.2, side * 8.6, 2.1], [3.4, side * 8.6, 2.1], 0.85, 0.15, 8, '#3a3e40'));
      S.push(fine(box(-6.4, -5, side * 8.6 - 1.6, side * 8.6 + 1.6, 2.05, 2.15, '#6f735f', { noLine: true })));
    }
    // Höhenleitwerk: großes Trapez am Rumpfheck
    S.push(prZ([[-11.5, 2.4], [-16.8, 9.4], [-21, 9.4], [-19.6, 2.4]].map(([x, y]) => [x, side * y]), 3.55, 3.9, body));
    // Triebwerksgondel mit runder Düse, weit außen
    S.push(cyl([-1.5, side * 3.6, 3.3], [-19.8, side * 3.6, 3.3], 1.95, 1.7, 10, body));
    S.push(cyl([-19.8, side * 3.6, 3.3], [-21, side * 3.6, 3.3], 1.7, 1.55, 10, NOZ));
    S.push(cyl([-20.9, side * 3.6, 3.3], [-21.1, side * 3.6, 3.3], 1.25, 1.25, 10, '#16181a'));
    // Seitenleitwerk: senkrecht auf der Gondel, Spitze in Teamfarbe
    const fin = prX([[-4.5, 4.9], [-12.6, 12.4], [-16.8, 12.4], [-18.6, 4.9]], side * 3.6 - 0.3, side * 3.6 + 0.3, body);
    S.push(fin);
    S.push(fine(on(fin, prX([[-12.2, 11.1], [-12.6, 12.4], [-16.8, 12.4], [-17.1, 11.1]], side * 3.6 - 0.34, side * 3.6 + 0.34, P.mark, { noLine: true }))));
  }
  if (o.gear) {
    for (const [x, y] of [[12, 0], [-1, -4.9], [-1, 4.9]]) {
      S.push(cyl([x, y, 2.4], [x, y, 0.9], 0.25, 0.25, 4, METAL));
      S.push(cyl([x, y - 0.35, 0.8], [x, y + 0.35, 0.8], 0.8, 0.8, 8, WHEEL));
    }
  }
  return { S, nozzle: { x: -21, z: 3.3, ys: [-3.6, 3.6], sy: 0.9, sz: 0.9 }, foot: [-22.5, 23.6, -15.5, 15.5] };
}

export { f16, su27 };
