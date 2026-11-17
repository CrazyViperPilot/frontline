// Fliegerhorst der Stadt-KI (seit v5.35, Paket „Fliegerhorst-Anschluss“): Bahn, Stellplätze, Tower, Kerosintank, Munitionslager
// (aiAirport) und die Gebietsprüfung der ersten Stellplätze (standsAllowed).
// Exporte: aiAirport. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KINDS, KIND_ID, WORKS } from '../../data/citykinds.js';
import { isPart, cellAt, cellFree, buildAllowed, buildWhy, canZone } from '../../game/city/cells.js';
import { connectCells } from '../../game/city/roadnet.js';
import { inDanger } from './common.js';

/**
 * Dürfen an dieser Stelle Stellplätze stehen (Gebiet, Erkundung, Feind, Konfliktzone, Regel wie für den Stellplatz selbst, also mit dem
 * erlaubten Überstand eines Großbaus)? Rechteck (q, r, w × h) = die Zellen der ersten beiden Stellplätze neben der Bahn.
 */
function standsAllowed(game, c, q, r, w, h) {
  for (let y = r; y < r + h; y++) {
    for (let x = q; x < q + w; x++) {
      const j = y * c.cols + x;
      if (!canZone(game, c, j) || buildWhy(game, c, j, 'stand') !== null) return false;
    }
  }
  return true;
}

/**
 * Fliegerhorst der KI (seit v5.35, ersetzt den Flughafen): ab CITY.ai.airportFrom Arbeitsstätten eine Bahn 2 × 10 nahe der Hauptstadt
 * (bis airportReach Zellen; waagrecht oder senkrecht, mit freiem Rand), daneben zwei Stellplätze und ein Tower (frei stehend). Kerosintank
 * und Munitionslager kommen daneben mit Straße zum Lager (Paket „Fliegerhorst-Anschluss“: die Bahn braucht keine Straße, Tank und Lager
 * schon). Danach je Takt ein weiterer Stellplatz an der Bahn, bis sie `want` hat.
 */
export function aiAirport(game, c, main, reserve, want = 2, difficulty = 'normal', mem = null) {
  const A = CITY.ai;
  if (!main) return false;
  const RW = CITY.air.runwayWidth; // Breite der Bahn (Zellen)
  const B = CITY.size.stand; // Kantenlänge der Bauten neben der Bahn (Stellplatz, Tower, Kerosintank, Munitionslager)
  // Anker der Bauten B × B, die an eine Bahnzelle (q, r) grenzen: oben, unten, links, rechts, dazu versetzt oben und unten
  const beside = (q, r) => [[q, r - B], [q, r + 1], [q - B, r], [q + 1, r], [q - 1, r - B], [q - 1, r + 1]];
  const square = (x, y) => Array.from({ length: B * B }, (_, k) => [x + (k % B), y + Math.floor(k / B)]);
  const money = game.teams[c.team].res.money;
  let work = 0;
  const stands = [];
  for (const i of c.list) {
    if (isPart(c, i)) continue;
    const k = KINDS[c.kind[i] - 1];
    if (k === 'stand') stands.push(i); // auch noch nicht fertige (sonst baut sie doppelt)
    if (c.level[i] && (k === 'com' || k === 'market' || WORKS.includes(k))) work++;
  }
  const hasRunway = c.list.some((i) => c.kind[i] === KIND_ID.runway);
  // Fläche prüfen wie für die Bahn (ohne Anschlusspflicht je Zelle; Stellplätze, Tower und Lager prüft der Baubefehl als Ganzes)
  const free = (j) => !c.kind[j] && !c.mapRoads?.[j] && buildAllowed(game, c, j, 'runway') && cellFree(game, c, j % c.cols, Math.floor(j / c.cols)) && !inDanger(c, j % c.cols, Math.floor(j / c.cols), game.time);
  const put = (kind, q, r) => game.issue(c.team, { type: 'city', kind, c0: q, r0: r, c1: q, r1: r }).ok;
  // Kerosintank oder Munitionslager 2 × 2 neben einer Bahnzelle: zuerst die Straße zum Lager (connectCells), dann der Bau, der den
  // Anschluss verlangt. true, wenn gebaut.
  const putDepot = (kind) => {
    for (const i of c.list) {
      if (c.kind[i] !== KIND_ID.runway) continue;
      const q = i % c.cols;
      const r = (i - q) / c.cols;
      for (const [x, y] of beside(q, r)) {
        const cells = square(x, y);
        if (cells.some(([u, v]) => u < 0 || v < 0 || u >= c.cols || v >= c.rows || !free(v * c.cols + u) || !buildAllowed(game, c, v * c.cols + u, kind))) continue;
        if (connectCells(game, c, cells.map(([u, v]) => v * c.cols + u), true) < 0) continue;
        if (put(kind, x, y)) return true;
      }
    }
    return false;
  };
  const runwayCells = hasRunway ? c.list.filter((i) => c.kind[i] === KIND_ID.runway).length : 0;
  // Notausgang: steht eine Bahn, an der nie ein Stellplatz entstehen kann (außerhalb des Gebiets, Straße nicht anschließbar), baut die KI
  // einen zweiten Fliegerhorst an anderer Stelle (höchstens CITY.ai.airportMax Bahnen), statt ewig zu warten
  const retry = () => !stands.length && runwayCells < A.airportMax * RW * A.runwayLen;
  if (hasRunway) {
    // Stellplätze ausbauen (seit v5.39 nur per Befehl): den ersten fertigen unter Stufe 3, wenn genug übrig bleibt
    const up = stands.length >= Math.ceil(want / CITY.air.standJets) ? stands.find((i) => c.level[i] && c.level[i] < CITY.maxLevel) : null; // erst genug Stellplätze
    const cost = up != null ? CITY.air.upgrade[c.level[up] + 1] : null;
    if (cost && money >= cost.money + Math.max(reserve, CITY.air.upgradeAiReserve) && main.store.bm >= cost.bm + A.upgradeBuffer.bm && c.metal >= (cost.steel ?? 0) + A.upgradeBuffer.steel) {
      const e = c.ents.get(up);
      if (e && game.issue(c.team, { type: 'cityUpgrade', buildingId: e.id }).ok) return true;
    }
    // Kerosintank und Munitionslager fehlen (nie gebaut oder zerstört): neben die Bahn, mit Straße zum Lager
    for (const kind of ['ktank', 'mdepot']) {
      if (c.list.some((i) => c.kind[i] === KIND_ID[kind])) continue;
      if (money >= CITY.cost[kind] + reserve && main.store.bm >= (CITY.costBm[kind] ?? 0) + A.standBuffer && putDepot(kind)) return true;
    }
    // weitere Stellplätze an der Bahn (beide Längsseiten); so viele, dass jeder Jet einen Platz hat (CITY.air.standJets je Stellplatz)
    // + ein ganzer Stellplatz für die U-2 zur Aufklärung, wenn sie fliegen darf (seit v5.83: sie belegt beide Plätze)
    const wantStands = Math.ceil(want / CITY.air.standJets) + (CITY.ai.reconFrom[difficulty] != null ? CITY.ai.reconMax : 0);
    if (stands.length >= wantStands || money < CITY.cost.stand + reserve || main.store.bm < CITY.costBm.stand + A.standBuffer) return false;
    const rw = c.list.filter((i) => c.kind[i] === KIND_ID.runway);
    for (const i of rw) {
      const q = i % c.cols;
      const r = (i - q) / c.cols;
      for (const [x, y] of beside(q, r)) {
        const cells = square(x, y);
        if (cells.some(([u, v]) => u < 0 || v < 0 || u >= c.cols || v >= c.rows || !free(v * c.cols + u))) continue;
        if (put('stand', x, y)) return true; // 2 × 2: Anker links oben der Mitte
      }
    }
    if (!retry()) return false;
  }
  if (work < A.airportFrom || stands.length) return false;
  // Sparen auf die Bahn (Paket „Luftwaffe der KI“): sonst baut der Stadtausbau die freien Flächen zu, bevor das Geld reicht
  if (mem && !hasRunway) mem.airHold = true;
  if (money < A.airportMoney + reserve || main.store.bm < A.airportBm) return false;
  const [fc, fr] = cellAt(c, main.x, main.y);
  const R = A.airportReach;
  const L = A.runwayLen; // Länge der Bahn
  const fits = (q, r, w, h) => {
    for (let y = r - 1; y <= r + h; y++) for (let x = q - 1; x <= q + w; x++) if (x < 0 || y < 0 || x >= c.cols || y >= c.rows || !free(y * c.cols + x)) return false;
    return true;
  };
  const cand = [];
  for (let r = Math.max(1, fr - R); r <= Math.min(c.rows - 2, fr + R); r++) {
    for (let q = Math.max(1, fc - R); q <= Math.min(c.cols - 2, fc + R); q++) cand.push({ q, r, d: Math.hypot(q - fc, r - fr) });
  }
  cand.sort((p, o) => p.d - o.d || p.r - o.r || p.q - o.q);
  for (const { q, r } of cand) {
    for (const vertical of [false, true]) {
      // Bahn L × RW (bzw. RW × L) mit einer Reihe B × B-Bauten daneben: Fläche L × (RW + B)
      if (!fits(q, r, vertical ? RW + B : L, vertical ? L : RW + B)) continue;
      // Die Reihe liegt unter bzw. rechts der Bahn oder (flip) darüber bzw. links davon: je nach Ecke der Hauptstadt liegt nur eine
      // Seite im eigenen Gebiet (vorher nur unten/rechts: die KI oben rechts fand nie einen Platz)
      for (const flip of [false, true]) {
        const rq = vertical && flip ? q + B : q; // Anker der Bahn
        const rr = !vertical && flip ? r + B : r;
        const sq = vertical ? (flip ? q : q + RW) : q; // Anker der Reihe
        const sr = vertical ? r : flip ? r : r + RW;
        // Die ersten beiden Stellplätze müssen im eigenen Gebiet erlaubt sein (die Bahn selbst darf hinaus; sonst entstand eine Bahn
        // außerhalb, an der nie ein Stellplatz gebaut werden konnte)
        if (!standsAllowed(game, c, sq, sr, vertical ? B : 2 * B, vertical ? 2 * B : B)) continue;
        // Bahn bauen; scheitert der Befehl hier, die nächste Stelle versuchen (vorher Abbruch: die KI blieb an derselben Stelle hängen)
        const rwCmd = vertical ? { type: 'city', kind: 'runway', c0: rq, r0: rr, c1: rq + RW - 1, r1: rr + L - 1 } : { type: 'city', kind: 'runway', c0: rq, r0: rr, c1: rq + L - 1, r1: rr + RW - 1 };
        if (!game.issue(c.team, rwCmd).ok) continue;
        // Stellplätze und Tower neben der Bahn (sie brauchen keine Straße), dann Kerosintank und Munitionslager mit Straße zum Lager
        A.airportRow.forEach((kind, k) => (vertical ? put(kind, sq, sr + k * B) : put(kind, sq + k * B, sr)));
        putDepot('ktank');
        putDepot('mdepot');
        return true;
      }
    }
  }
  return false;
}
