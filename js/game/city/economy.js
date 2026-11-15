// Stadt (PRD §15), Wirtschaftsschritt updateCity: Gebiet, Ruinen, Einwohner, Wachstum, Gewerbe, Zufriedenheit, Einfuhr der Rohwaren
// und Werke (seit Paket „Import“), Lager, Fliegerhorst, Steuern und Pflege. Lieferwege aus transport.js. Kein DOM, deterministisch.
import { BALANCE } from '../../data/balance.js';
import { CITY } from '../../data/city.js';
import { KIND, KINDS, KIND_ID, WORKS } from '../../data/citykinds.js';
import { STORED_GOODS, GOODS } from '../../data/goods.js';
import { transportOf, pathEff, addLoad, beginLoads, settleLoads, minFactor, supplyOf } from '../transport.js';
import { updateCare } from './care.js';
import { isFlat, isPart, cellsOf, cellFree, releaseCell, hasRoad } from './cells.js';
import { draftedCount, freePop, trainersOf } from './query.js';
import { UNITS } from '../../data/units.js';
import { zeroGoods, zeroStats, updateClaim, occupyCell, totals, syncEntity, dropEntity } from './state.js';

/** Arbeitsspeicher je Stadt (einmal angelegt, kein Allokieren im Schritt): Eingang und Wirkung je Gebäude, Liste der fertigen Gebäude. */
const SCRATCH = new WeakMap();

function scratchOf(c) {
  let w = SCRATCH.get(c);
  if (!w) {
    const n = c.cols * c.rows;
    w = { eff: new Float64Array(n), anchors: new Int32Array(n) };
    SCRATCH.set(c, w);
  }
  return w;
}

/** Werke in fester Reihenfolge (Register: alle Arten mit `works`); seit Paket „Import“ alle gleich: Rohwaren ein, Produkt ins Lager. */
const WORK_ORDER = WORKS;
/** Rohwaren je Einheit Produkt und ihr Preis je Einheit Produkt, je Werk (aus CITY.chain und CITY.import.price, einmal gerechnet). */
const NEED = Object.fromEntries(WORKS.map((k) => [k, Object.entries(CITY.chain[k].need)]));
const NEED_SUM = Object.fromEntries(WORKS.map((k) => [k, NEED[k].reduce((a, [, n]) => a + n, 0)]));
const NEED_PRICE = Object.fromEntries(WORKS.map((k) => [k, NEED[k].reduce((a, [g, n]) => a + n * CITY.import.price[g], 0)]));

/** Werke mit Ausgangslager (CITY.pickup, seit v5.69): Art-Schlüssel. */
const PICKUP = new Set(CITY.pickup.kinds);

/**
 * Ausgangslager eines Werks (seit v5.69): share des Ausstoßes dieses Schritts geht ohne Straßenweg ins Lager des Werks, höchstens bis
 * cap, nur solange dem Werk ein eigener LKW zugeteilt ist (pickClaim). Liefert die Menge je s, die dort landet (0 ohne Ausstoß oder bei vollem Lager). Zählt als Erzeugung der Ware.
 */
function stockAtWork(c, i, prod, out, dt) {
  if (!c.pickClaim[i] || !(dt > 0) || !(out > 0)) return 0; // ohne zugeteilten LKW zweigt das Werk nichts ab (seit v5.69)
  const put = Math.min(out * CITY.pickup.share * dt, Math.max(0, CITY.pickup.cap - c.out[i]));
  if (!(put > 0)) return 0;
  c.out[i] += put;
  const made = (c.made ??= zeroGoods(STORED_GOODS));
  made[prod] += put;
  return put / dt;
}

/** Arbeitsplätze eines fertigen Gebäudes (wie totals). */
function jobsOf(c, i, k, lv) {
  const table = KIND[k]?.jobs; // Register: Tabelle der Arbeitsplätze je Stufe
  return table ? CITY[table][lv] : 0;
}

/** Markt-Aufschläge je Ware klingen ab (CITY.market.calm je s; unter 0,001 fällt der Rest weg). Paket „Knappes Geld“. */
function calmMarket(c, dt) {
  const heat = c.marketHeat;
  if (!heat) return;
  for (const g of Object.keys(heat)) {
    heat[g] -= heat[g] * CITY.market.calm * dt;
    if (heat[g] < 0.001) heat[g] = 0;
  }
}

/**
 * Ein Simulationsschritt der Stadt beider Teams. Nach updateEconomy aufrufen. Die Phasen laufen in fester Reihenfolge (seit v5.60
 * zerlegt, Review Q-06; Rechenreihenfolge unverändert): Gebiet und Rückkehr, Ruinen, Treffer, Einwohner, Wachstum, Wirtschaft
 * (Gewerbe, Zufriedenheit, Einfuhr und Werke, Lager, Fliegerhorst, Stau, Steuern), Pflege.
 */
export function updateCity(game, dt) {
  if (!game.city) return;
  game.teams.forEach((team, id) => {
    const c = game.city[id];
    if (team.out) return; // ausgeschieden (Eroberung): die Stadt steht still
    calmMarket(c, dt);
    refreshClaim(game, c, dt);
    clearRuins(game, c, id);
    logHits(game, c, dt);
    const P = population(game, c, id, dt);
    growCells(game, c, P, dt);
    const s = produce(game, c, id, P, dt);
    c.stats = s;

    team.res.money += s.money * dt;
    team.rate.money += s.money - s.importCost; // Einfuhr (Paket „Import“) ist in produce schon bezahlt, zählt aber in der Rate mit
    updateCare(game, c, dt);
  });
}

/** Gebiet regelmäßig neu (FOBs gebaut oder zerstört, neue Stadtgebäude); geflohene Bewohner kehren nach ihrer Ruhezeit zurück. */
function refreshClaim(game, c, dt) {
  c.claimTimer += dt;
  if (c.claimTimer >= CITY.territory.interval) {
    c.claimTimer = 0;
    updateClaim(game, c);
  }
  for (const i of c.list) {
    if (!(c.flee[i] > 0)) continue;
    c.flee[i] = Math.max(0, c.flee[i] - dt);
    if (c.flee[i] === 0) c.ver++; // Bewohner zurück: wieder Pendlerziel (seit v5.20)
  }
}

/** Zerstörte Gebäude werden Ruinen: Zelle frei, nach CITY.ruinTime wächst sie neu (Wiederaufbau). */
function clearRuins(game, c, id) {
  for (const [i, e] of c.ents) {
    if (e.alive && e.hp > 0) continue;
    dropEntity(game, c, i);
    for (const j of cellsOf(c, i)) {
      const col = j % c.cols;
      releaseCell(game, c, col, (j - col) / c.cols);
      c.level[j] = 0;
      c.timer[j] = 0;
    }
    c.timer[i] = -CITY.ruinTime; // Großbau: die Mitte zählt die Zeit für alle Zellen
    c.ver++;
    game.addEffect('explosion', e.x, e.y, id, e.x, e.y, 'building'); // Team des Besitzers (wie game.cleanup): Gegner sehen sie nur mit Sicht
    game.message(id, `${e.def.name} in der Stadt zerstört`, e.x, e.y);
  }
}

/** Treffer merken (KI meidet die Gegend beim Bauen und schickt Verteidiger). */
function logHits(game, c, dt) {
  for (const e of c.ents.values()) {
    if (e.lastHitTime > game.time - dt * 1.5) {
      c.hitLog = (c.hitLog ?? []).filter((h) => h.t > game.time - CITY.ai.dangerTime).slice(1 - CITY.ai.hitLog);
      c.hitLog.push({ x: e.x, y: e.y, t: game.time });
    }
  }
}

/**
 * Einwohner: gefallene Soldaten fehlen der Stadt (müssen neu zuziehen); Zuzug oder Abzug, bis die Wohnplätze gefüllt sind (ohne
 * Arbeit nur ein kleiner Anfang). Ergebnis: Kennzahlen (totals), Arbeitsplätze, Truppen, Einwohner, Arbeitsfähige.
 */
function population(game, c, id, dt) {
  const drafted = draftedCount(game, id);
  if (drafted < c.drafted) c.popF = Math.max(0, c.popF - (c.drafted - drafted));
  c.drafted = drafted;

  const t = totals(c);
  const jobs = t.jobsCom + WORKS.reduce((n, w) => n + t[w], 0) + t.jobsOther; // ganze Zahlen: Reihenfolge egal

  const target = jobs > 0 ? t.housing : Math.min(t.housing, CITY.startPop);
  if (c.popF < target) c.popF = Math.min(target, c.popF + CITY.immigration * (0.5 + (c.stats.happy ?? 1)) * dt); // zufriedene Städte ziehen schneller an
  else if (c.popF > target) c.popF = Math.max(target, c.popF - CITY.immigration * dt);
  const pop = c.popF;
  const pool = Math.max(0, pop - drafted); // Einwohner, die arbeiten können
  return { t, jobs, drafted, pop, pool };
}

/** Wachstum der Zellen: Gebäude entstehen nur mit Straßenanschluss, Ausbau nur bei Bedarf. */
function growCells(game, c, P, dt) {
  const { t, jobs, pool } = P;
  let built = false;
  for (const i of c.list) {
    if (isPart(c, i)) continue; // Großbau wächst über seine Mitte
    const kind = KINDS[c.kind[i] - 1];
    const col = i % c.cols;
    const row = (i - col) / c.cols;
    if (isFlat(c.kind[i]) || !hasRoad(c, col, row)) continue; // ohne Straße wächst nichts
    const lv = c.level[i];
    if (lv >= CITY.maxLevel) continue;
    if (lv >= 1 && kind === 'stand') continue; // Stellplatz: Ausbau nur über den Befehl cityUpgrade (seit v5.39)
    const need = lv === 0 ? CITY.growTime : CITY.upgradeTime;
    // Gewerbe (seit v5.20, AP3b): eine neue Stufe nur, solange seine Arbeitsplätze höchstens so viele sind wie Arbeitsfähige × CITY.shop.per
    const wanted = lv === 0 || (kind === 'res' ? jobs >= pool * CITY.demand : kind === 'com' ? t.jobsCom <= pool * CITY.shop.per : pool >= jobs * CITY.demand);
    if (c.timer[i] < need) c.timer[i] += dt;
    if (c.timer[i] >= need && wanted) {
      const all = cellsOf(c, i);
      if (lv === 0) {
        if (!all.every((j) => cellFree(game, c, j % c.cols, Math.floor(j / c.cols)))) continue; // ein Gebäude oder Hindernis steht im Weg: warten
        for (const j of all) occupyCell(game, c, j % c.cols, Math.floor(j / c.cols));
        built = true;
      }
      for (const j of all) c.level[j] = lv + 1;
      c.timer[i] = 0;
      c.ver++;
      syncEntity(game, c, i);
    }
  }
  if (built) updateClaim(game, c);
}

/**
 * Arbeit, Einfuhr, Verarbeitung, Lager, Steuern (seit v5.20, AP3, PLAN 1.4): Rechnung je Gebäude über seinen Lieferweg.
 * Pendler und Lieferwege kommen aus js/game/transport.js; Last und Stau laufen je Schritt (beginLoads … settleLoads).
 * Ergebnis: die Stadtzahlen des Schritts (c.stats).
 */
function produce(game, c, id, P, dt) {
  const { t, jobs, drafted, pop, pool } = P;
  const fill = jobs > 0 ? Math.min(1, pool / jobs) : 0;
  const s = zeroStats();
  s.pop = pop;
  s.housing = t.housing;
  s.fled = t.fled;
  s.drafted = drafted;
  s.free = freePop(game, id);
  s.jobs = jobs;
  s.jobsCom = t.jobsCom;
  s.workers = jobs * fill;
  s.market = t.market;
  s.fill = fill;
  s.n = t.n; // fertige Gebäude je Art (Flussanzeige)
  // Strom (Stufe 3): Angebot aus Notstrom und Kraftwerken; Mangel bremst Werke und Güterbahnhof
  s.powerSupply = CITY.power.base + t.power * fill;
  s.powerUse = t.use;
  s.powerRatio = t.use > 0 ? Math.min(1, s.powerSupply / t.use) : 1;
  const tr = transportOf(game, c);
  const W = scratchOf(c);
  // Arbeitsstand des Schritts für die Phasen unten: eff je Gebäude, anchors = fertige Gebäude (Anker, ohne Straßen und Teile von
  // Großbauten), einmal gesammelt; team = Kasse für die Einfuhr
  const x = { c, s, tr, dt, fill, eff: W.eff, anchors: W.anchors, nA: 0, main: null, credit: false, team: game.teams[id] };
  for (const i of c.list) {
    if (!c.level[i] || isPart(c, i) || isFlat(c.kind[i])) continue;
    x.anchors[x.nA++] = i;
  }
  beginLoads(tr);
  x.main = game.mainFob(id);
  x.credit = !!x.main?.built; // Lager der Hauptstadt steht (sonst gehen Waren zum Lager verloren)
  const shopW = supplyShops(x);
  // Zufriedenheit (Stufe 3): Läden (Versorgung zählt, geteilt durch arbeitsfähige Einwohner), Sicherheit, Strom
  const H = CITY.happy;
  const shop = pool > 0 ? Math.min(1, shopW / (pool * H.shopPer)) : 0;
  s.shop = shop;
  const hits = (c.hitLog ?? []).filter((h) => h.t > game.time - CITY.happy.hitWindow).length;
  const safe = 1 - Math.min(1, hits / H.hitsBad);
  s.happy = pop > 0 ? Math.min(1, H.base + H.shops * shop + H.safety * safe + H.power * s.powerRatio) : 1;
  const mood = H.lo + H.span * s.happy;
  s.mood = mood;
  s.uni = t.uni;
  s.dc = t.dc;
  workEffect(x, fill * s.powerRatio * mood);
  runWorks(x);
  storeGoods(x);
  fillAirbase(x);
  supplyTrainers(game, x);
  // Stau: kleinster Stau-Faktor auf den in diesem Schritt benutzten Straßen (1 ohne Stau), dann Glättung für den nächsten Schritt
  s.jam = minFactor(tr);
  settleLoads(tr, dt);
  s.taxRaw = (pool * CITY.taxPop + shopW * CITY.taxCom) * mood; // Steuer vor der Bremse (Anzeige „roh“)
  s.money = brakeTax(s.taxRaw); // Gewerbe-Steuer nur nach Versorgung (shopW), dann Steuerbremse
  return s;
}

/**
 * Steuerbremse (seit Paket Balance-Steuern): Steuer bis CITY.taxBrake.from Geld/s voll, jeder Teil darüber nur zu CITY.taxBrake.rest.
 * Rein (ohne Zustand), damit Tests und die Anzeige sie direkt nutzen können.
 */
export function brakeTax(raw) {
  const { from, rest } = CITY.taxBrake;
  return raw <= from ? raw : from + (raw - from) * rest;
}

/**
 * Gewerbe und Markt (seit v5.20, AP3b): Baumaterial aus dem Lager der Hauptstadt, über ihren Weg zum Lager (Last = Bedarf).
 * Versorgung v je Gebäude: 0 ohne Weg oder Lager, anteilig, wenn das Lager nicht reicht, × Stau. Steuer und Anteil an der
 * Zufriedenheit wirken mit base + (1 − base) × v. Läuft vor der Zufriedenheit und liest den Lagerstand am Anfang des Schritts.
 * Ergebnis: Arbeiter × Gewichtung (base + (1 − base) × v) für Steuer und Zufriedenheit.
 */
function supplyShops(x) {
  const { c, s, tr, dt, fill, anchors, nA, main, credit } = x;
  const SP = CITY.shop;
  let shopW = 0; // Arbeiter × Gewichtung (base + (1 − base) × v): Steuer und Zufriedenheit
  let shopJ = 0; // Arbeiter in Gewerbe und Markt
  let shopV = 0; // Arbeiter × v (Versorgung)
  let shopTake = 0; // Baumaterial, das in diesem Schritt aus dem Lager geht
  for (let m = 0; m < nA; m++) {
    const i = anchors[m];
    const lv = c.level[i];
    const k = KINDS[c.kind[i] - 1];
    if (k !== 'com' && k !== 'market') continue;
    const workers = jobsOf(c, i, k, lv) * fill;
    const want = SP.need * workers * dt; // Bedarf dieses Schritts (Baumaterial)
    const p = tr.shop.get(i) ?? null;
    let v = 0;
    if (p && want > 0) {
      addLoad(tr, p, SP.need * workers);
      if (credit) {
        const take = Math.min(want, Math.max(0, main.store.bm));
        main.store.bm -= take;
        shopTake += take;
        v = (take / want) * pathEff(tr, p);
      }
    }
    shopW += workers * (SP.base + (1 - SP.base) * v);
    shopJ += workers;
    shopV += workers * v;
  }
  s.shopBm = dt > 0 ? shopTake / dt : 0; // Baumaterial je s, das Gewerbe verbraucht
  s.shopSupply = shopJ > 0 ? shopV / shopJ : 1; // gewichtete Versorgung 0 … 1 (ohne Gewerbe 1)
  return shopW;
}

/** eff_b = Besetzung × Strom × Zufriedenheit (base) × Pendlerwirkung des Gebäudes (kein Pendlerweg: 0). */
function workEffect(x, base) {
  const { c, tr, fill, eff, anchors, nA } = x;
  for (let m = 0; m < nA; m++) {
    const i = anchors[m];
    const lv = c.level[i];
    const k = KINDS[c.kind[i] - 1];
    let commuteEff = 1;
    if (tr.commute.has(i)) {
      // Arbeitsstätte: Pendler laufen über den Pendlerweg zur nächsten Wohnung (Last), die Arbeit wirkt mit dessen Stau
      const p = tr.commute.get(i);
      commuteEff = pathEff(tr, p);
      const jobsB = jobsOf(c, i, k, lv);
      if (p && jobsB > 0) addLoad(tr, p, jobsB * fill * CITY.transport.commute);
    }
    eff[i] = base * commuteEff;
  }
}

/** Ist das Lager für das Produkt `prod` voll (Hauptstadt bzw. Stadtlager, Stand am Anfang des Schritts)? Ohne fertiges Lager: ja. */
function storeFull(x, prod) {
  const { c, main, credit } = x;
  if (GOODS[prod].store === 'city') return c[prod] >= BALANCE.logistics.storeCap;
  return !credit || main.store[prod] >= BALANCE.logistics.capitalCap;
}

/**
 * Einfuhr und Werke (Paket „Import“, PRD §15): Jedes Werk fordert für seine Leistung (Arbeiter × Wirkung × Ertrag) die Rohwaren an
 * (CITY.chain[Werk].need je Einheit Produkt), beim nächsten Einfuhrpunkt über die Straße (transport.js imports); ohne Einfuhrpunkt
 * oder mit vollem Lager fordert es nichts. Ein Güterbahnhof liefert höchstens CITY.import.station[Stufe] × seine Wirkung je s; fordern
 * seine Werke mehr, bekommt jedes anteilig weniger. Bezahlt wird je angekommener Einheit (CITY.import.price); reicht das Geld nicht, sinkt
 * die ganze Einfuhr des Schritts im selben Verhältnis (die Kasse fällt dadurch nie unter 0). Die Rohwaren fahren als Last über den Weg
 * (Stau: es kommt gesendet × Wirkung des Wegs an). Ausstoß = was die angekommenen Rohwaren hergeben (alle Sorten im Verhältnis need),
 * höchstens die Leistung; er fährt wie bisher zum Lager der Hauptstadt (Ausgangslager des Werks zuerst, CITY.pickup).
 */
function runWorks(x) {
  const { c, s, tr, dt, eff, anchors, nA, credit, team } = x;
  const Y = CITY.yield;
  // 1. Bedarf je Werk (Produkt je s) und Summe je Güterbahnhof (Rohwaren je s)
  const list = [];
  const atStation = new Map(); // Anker des Güterbahnhofs → angeforderte Rohwaren je s
  for (const k of WORK_ORDER) {
    const kid = KIND_ID[k];
    const prod = CITY.chain[k].to;
    for (let m = 0; m < nA; m++) {
      const i = anchors[m];
      if (c.kind[i] !== kid) continue;
      const cap = CITY.jobs[c.level[i]] * eff[i] * Y[prod]; // Leistung je s
      s.cap[prod] += cap;
      c.workOut[i] = 0; // Ausstoß je s am Anker (seit v5.70, Pendlerquelle der KI); unten gesetzt
      const im = tr.imports.get(i) ?? null;
      if (!im && cap > 0) s.importNone++;
      // ohne Weg zum Lager oder bei vollem Lager fordert es nichts an (niemand bezahlt Rohwaren für Ware, die verloren ginge)
      const r0 = tr.routes.get(i);
      const want = im && cap > 0 && r0?.to === 'main' && !storeFull(x, prod) ? cap : 0;
      list.push({ i, k, prod, cap, im, want, eff: im ? pathEff(tr, im.path) : 0 });
      if (want > 0 && typeof im.from === 'number') atStation.set(im.from, (atStation.get(im.from) ?? 0) + want * NEED_SUM[k]);
    }
  }
  // 2. Durchsatz der Güterbahnhöfe: zu viel Anforderung wird anteilig gekürzt
  const scaleOf = new Map();
  for (const [st, raw] of atStation) {
    const most = (CITY.import.station[c.level[st]] ?? 0) * eff[st];
    scaleOf.set(st, raw > most ? most / raw : 1);
  }
  // 3. Kosten (je s, nach Ankunft) und Deckel durch die Kasse
  let cost = 0;
  for (const w of list) {
    if (!(w.want > 0)) continue;
    if (typeof w.im.from === 'number') w.want *= scaleOf.get(w.im.from);
    cost += w.want * w.eff * NEED_PRICE[w.k];
  }
  const money = Math.max(0, team.res.money);
  const pay = cost * dt;
  const afford = pay > money ? money / pay : 1;
  s.importScale = afford;
  // 4. Einfuhr ausführen, Werke rechnen, Produkt zum Lager
  let paid = 0;
  for (const w of list) {
    const { i, k, prod, cap, im } = w;
    let inp = 0; // Produkt je s, das die angekommenen Rohwaren hergeben
    if (w.want > 0) {
      const sent = w.want * afford; // Produkt-Gegenwert der gesendeten Rohwaren
      addLoad(tr, im.path, sent * NEED_SUM[k]);
      inp = sent * w.eff;
      for (const [g, n] of NEED[k]) {
        const got = inp * n; // angekommene Rohware je s
        s.raw[g] += got;
        s.importCostBy[g] += got * CITY.import.price[g];
      }
      paid += inp * NEED_PRICE[k];
    }
    const out = Math.min(cap, inp);
    c.workOut[i] = out;
    s.inp[prod] += inp;
    s.gross[prod] += out;
    // Ausgangslager (seit v5.69): ein Anteil geht ohne Straßenweg dorthin, der Rest läuft zum Lager der Hauptstadt
    const kept = PICKUP.has(k) ? stockAtWork(c, i, prod, out, dt) : 0;
    const rest = out - kept;
    const r = tr.routes.get(i);
    const p = r && r.to === 'main' && credit ? r.path : null;
    addLoad(tr, p, rest);
    if (!p) s.lost += rest;
    else s[prod] += rest * pathEff(tr, p); // Ankunft im Lager (bm, mun, fuel, kero, metal = Stahl)
  }
  s.importCost = paid;
  team.res.money = Math.max(0, team.res.money - paid * dt);
}

/** Lager gutschreiben: Baumaterial, Munition, Treibstoff ins Lager der Hauptstadt, Stahl und Kerosin ins Stadtlager. */
function storeGoods(x) {
  const { c, s, dt, main, credit } = x;
  const made = (c.made ??= zeroGoods(STORED_GOODS)); // Summe, die wirklich ins Lager kam (Flussanzeige misst damit den Verbrauch)
  for (const g of STORED_GOODS) {
    if (GOODS[g].store === 'city') {
      const v0 = c[g];
      c[g] = Math.max(0, Math.min(BALANCE.logistics.storeCap, v0 + s[g] * dt));
      made[g] += Math.max(0, c[g] - v0);
    } else if (credit) {
      const v0 = main.store[g];
      main.store[g] = Math.min(BALANCE.logistics.capitalCap, v0 + s[g] * dt);
      made[g] += Math.max(0, main.store[g] - v0);
    }
  }
}

/**
 * Versorgung der Ausbildung (Paket „Straßen“, Teil 2): jeder laufende Ausbildungsplatz eines Stadtgebäudes legt Stahl je s
 * (CITY.metalCost ÷ Ausbildungszeit × Tempo) als Last auf den Weg zum Lager. Das Tempo selbst rechnet economy.js (trainRate).
 */
function supplyTrainers(game, x) {
  const { c, tr } = x;
  for (const e of trainersOf(c)) {
    if (!e.alive || !e.queue?.length) continue;
    const sup = supplyOf(game, c, e.cityCell);
    if (!sup.path) continue;
    const slots = Math.min(e.trainSlots ?? BALANCE.trainSlots, e.queue.length);
    let load = 0;
    for (let k = 0; k < slots; k++) {
      const u = e.queue[k].unit;
      load += ((CITY.metalCost[u] ?? 0) / UNITS[u].buildTime) * sup.rate;
    }
    if (load > 0) addLoad(tr, sup.path, load);
  }
}

/**
 * Fliegerhorst (seit v5.35): Kerosintanks aus dem Kerosin des Stadtlagers, Munitionslager aus dem Lager der Hauptstadt befüllen,
 * über ihren Weg zum Lager (Last = Menge), höchstens fill je s und bis zur Lagergröße.
 */
function fillAirbase(x) {
  const { c, tr, dt, anchors, nA, main, credit } = x;
  const KT = KIND_ID.ktank;
  const MD = KIND_ID.mdepot;
  for (let m = 0; m < nA; m++) {
    const i = anchors[m];
    const k = c.kind[i];
    if (k !== KT && k !== MD) continue;
    const e = c.ents.get(i);
    const p = tr.depot.get(i) ?? null;
    if (!e || !p || !credit) continue;
    const A = k === KT ? CITY.air.tank : CITY.air.depot;
    const lv = c.level[i];
    e.stock ??= 0;
    const room = Math.max(0, A.cap[lv] - e.stock) / Math.max(dt, 1e-6);
    const src = k === KT ? c.kero : main.store.mun;
    const want = Math.min(A.fill[lv], room, src / Math.max(dt, 1e-6));
    if (!(want > 0)) continue;
    addLoad(tr, p, want);
    const got = want * pathEff(tr, p);
    if (k === KT) c.kero = Math.max(0, c.kero - want * dt);
    else main.store.mun = Math.max(0, main.store.mun - want * dt);
    e.stock = Math.min(A.cap[lv], e.stock + got * dt);
  }
}
