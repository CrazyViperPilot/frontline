// Bedarf der Stadt-KI (PRD §15): welche Zone braucht die Stadt als Nächstes (aiNeed), Pendlerlage (homeless).
// Exporte: aiNeed. Kein DOM, deterministisch.
import { CITY } from '../../data/city.js';
import { KINDS } from '../../data/citykinds.js';
import { transportOf } from '../../game/transport.js';
import { isPart } from '../../game/city/cells.js';
import { totals } from '../../game/city/state.js';

/**
 * Welche Zone braucht die Stadt als Nächstes? (freie Planung seit v4.85) Wohnen, wenn Wohnraum oder freie Einwohner fehlen,
 * sonst die Arbeitsstätte mit dem größten Rückstand zum Mix; knappe Sorten (Lager, Metall, Geld) zählen CITY.ai.boost-fach.
 */
export function aiNeed(game, c, add, skip = null) {
  const t = totals(c);
  const A = CITY.ai;
  const count = { res: 0, com: 0, bm: 0, mun: 0, fuel: 0, steel: 0, kero: 0, market: 0, power: 0, uni: 0, dc: 0, barracks: 0, factory: 0, heliport: 0, hospital: 0 };
  for (const k in add) count[k] += add[k];
  for (const i of c.list) {
    if (isPart(c, i)) continue; // Großbau zählt einmal
    const k = KINDS[c.kind[i] - 1];
    if (k in count) count[k]++;
  }
  const work = count.com + count.bm + count.mun + count.fuel + count.steel + count.kero + count.market;
  const free = c.stats.free ?? 0;
  // Strom, Universität, Rechenzentrum (seit v4.88) nach Bedarf
  const st = c.stats;
  // Seit v5.20: Angebot bei voller Besetzung (fehlen nur Arbeiter, hilft ein weiteres Kraftwerk nicht, es braucht selbst welche)
  const supplyFull = CITY.power.base + t.power;
  if (supplyFull + (add.power ?? 0) * CITY.power.supply[1] < st.powerUse * A.powerMargin + A.powerSpare && (add.power ?? 0) < 1 && !skip?.has('power')) return 'power';
  // Wohnen zuerst (seit v5.20), wenn Arbeitsstätten keine Wohnung über die Straße erreichen (Pendler) oder Arbeiter fehlen
  if (!skip?.has('res') && count.res <= work * A.resMax && ((st.fill ?? 1) < A.lowFill || homeless(game, c))) return 'res';
  // Ausbildungsgebäude (seit v4.96): ohne sie keine Truppen; Heliport erst mit einer Arbeitsstätte
  const more = work >= A.moreFrom ? 1 : 0;
  for (const [k, n] of Object.entries(A.producers)) {
    if (k === 'heliport' && !work) continue;
    if (skip?.has(k)) continue; // Großbau ohne Platz in diesem Takt (seit v5.03 auch Kaserne und Fabrikhalle)
    if (count[k] < n + (k === 'heliport' ? 0 : more)) return k;
  }
  // Grundketten zuerst (seit v5.20), vor Krankenhaus und Universität (sonst spart die KI minutenlang für diese und kauft solange teuer
  // am Markt): ein BM-Werk; ein Stahlwerk, wenn Stahl knapp ist (seit Paket „Import“ kommen die Rohwaren von außerhalb der Karte)
  if (count.bm === 0 && !skip?.has('bm')) return 'bm';
  if (c.metal < A.lowMetal && count.steel === 0 && !skip?.has('steel')) return 'steel';
  // … und ein Munitionswerk, sobald Stahl entsteht
  if (count.steel > 0 && count.mun === 0 && !skip?.has('mun')) return 'mun';
  if (!count.hospital && work >= A.hospitalFrom && !skip?.has('hospital')) return 'hospital';
  if (!count.uni && work >= A.uniFrom && !skip?.has('uni')) return 'uni';
  if (!count.dc && count.uni && work >= A.dcFrom && !skip?.has('dc')) return 'dc';
  if (count.res < work * A.resPerWork || (t.housing + t.fled < c.drafted + A.draftSpare && count.res <= work * A.resMax) || (free < A.lowFree && count.res <= work * A.resMax)) return 'res';
  const main = game.mainFob(c.team);
  const low = {
    bm: main && main.store.bm < A.lowStock, // seit Paket „Import“: knapp heißt knapp (Rohwaren gibt es immer, gegen Geld)
    mun: main && main.store.mun < A.lowStock,
    fuel: main && main.store.fuel < A.lowStock,
    kero: c.kero < A.lowKero, // Kerosin knapp (seit v5.20)
    steel: c.metal < A.lowMetal,
    com: game.teams[c.team].res.money < A.lowMoney,
  };
  // Überschuss (Paket „Straßennetz der KI“): liegt eine Ware über highStock im Lager, kommt kein weiteres Werk dafür (es kostete nur
  // Einfuhrgeld und Straßenkapazität)
  const high = {
    bm: main && main.store.bm > A.highStock,
    mun: main && main.store.mun > A.highStock,
    fuel: main && main.store.fuel > A.highStock,
    kero: c.kero > A.highStock,
    steel: c.metal > A.highStock,
  };
  let best = null;
  let lo = Infinity;
  for (const [k, w] of Object.entries(A.mix)) {
    if (k === 'market' && count.market >= 1) continue; // ein Markt reicht
    if (high[k]) continue;
    if (skip?.has(k)) continue; // Großbau ohne Platz in diesem Takt (seit v5.08 auch die 2 × 2-Werke)
    // Kerosin-Raffinerie nur, wenn Kerosin knapp wird (seit v5.20)
    if (k === 'kero' && !low.kero) continue;
    const r = count[k] / (w * (low[k] ? A.boost : 1));
    if (r < lo) {
      lo = r;
      best = k;
    }
  }
  return best ?? 'res';
}

/** Hat eine fertige Arbeitsstätte keinen Pendlerweg zu einer Wohnung (transport.js)? */
function homeless(game, c) {
  for (const p of transportOf(game, c).commute.values()) if (p === null) return true;
  return false;
}
