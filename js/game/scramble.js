// Alarmrotte (Paket „Alarmrotte“, PRD docs/prd/stadt-luft.md): Jets mit Luft-Luft-Waffe (F-16, F-22, Su-27) in Alarmbereitschaft
// (u.jet.alert, Standard an; fehlt das Feld, gilt der Standard) starten von selbst, sobald ein für das Team sichtbares feindliches
// Luftfahrzeug im Alarmradius liegt: CITY.air.scramble.radius um jeden fertigen Tower, radiusNoAtc um jeden fertigen Stellplatz.
// Es starten nur Jets, die am Stellplatz stehen, betankt und bewaffnet sind (u.jet.ready), untätig sind und deren Sperrzeit vorbei ist;
// je erfasstes Ziel einer, insgesamt höchstens maxJets. Nach react s gibt das Modul den Angriffsbefehl über denselben Handler wie
// der Spieler (cmdAttack): Rollen, Bahnsperre und Tower-Regeln gelten unverändert (aircraft.js). Ist das Ziel vernichtet, außer Sicht
// oder in einem gesperrten Viertel (Eroberung), landet der Jet auf seinem Stellplatz (cmdLand); Heimflug wegen Treibstoff oder
// Raketen wie bisher. Ein neuer Befehl ersetzt u.order (ohne Marke qra) und beendet den Alarmflug.
// Zustand je Jet: u.jet.alert (false = aus), u.jet.qra = { phase: 'react' | 'fly', target, at }, u.jet.qraNext (Ende der Sperrzeit);
// je Team team.qraMsgAt (nächste Meldung frühestens) und team.qraMark = { x, y, at } (Minimap). Alles gehört zum Spielstand.
// Kein DOM, kein Zufall. Läuft vor updateAircraft, damit ein vernichtetes Ziel den Jet heimschickt, bevor er kreist.
import { CITY } from '../data/city.js';
import { KIND_ID } from '../data/citykinds.js';
import { jetGrounded, canHitAltitude, cmdLand } from './aircraft.js';
import { heliGrounded } from './helipad.js';
import { hostile } from './teams.js';
import { cmdAttack } from './cmd/units.js';
import { setIdle } from './movement.js';

const S = CITY.air.scramble;
const fail = (reason) => ({ ok: false, reason });

/** Kann der Jet in Bereitschaft gehen (Luft-Luft-Waffe)? A-10, C-130 und U-2 nicht. */
export const alertable = (u) => !!u.def?.jet && !!u.def.weapons?.some((w) => (w.targets ?? []).includes('air'));

/** Ist der Jet in Bereitschaft? Standard an (u.jet.alert fehlt), aus nur mit u.jet.alert === false. */
export const alertOn = (u) => alertable(u) && u.jet?.alert !== false;

/** Luftfahrzeug in der Luft (nicht abgestellt, nicht am Boden rollend, Hubschrauber nicht gelandet). */
const airborne = (e) => e.def?.armor === 'air' && !e.parked && !(e.def.jet && jetGrounded(e)) && !heliGrounded(e);

/** Gültiges Ziel eines Alarmjets u: lebt, feindlich, in der Luft, sichtbar, in seiner Höhe treffbar, nicht in einem gesperrten Viertel. */
function validTarget(game, u, e) {
  return !!e && e.alive && e.kind === 'unit' && hostile(u.team, e.team) && airborne(e) && game.sees(u.team, e) && canHitAltitude(u, e) && !game.mode.locked(game, u.team, e.x, e.y);
}

/** Alarmkreise eines Teams: fertige Tower (radius) und Stellplätze (radiusNoAtc). */
function zonesOf(game, team) {
  const c = game.city?.[team];
  const out = [];
  if (!c) return out;
  for (const [i, e] of c.ents) {
    if (!e.alive || !c.level[i]) continue;
    if (c.kind[i] === KIND_ID.atc) out.push({ x: e.x, y: e.y, r: S.radius });
    else if (c.kind[i] === KIND_ID.stand) out.push({ x: e.x, y: e.y, r: S.radiusNoAtc });
  }
  return out;
}

/** Heimflug: Landebefehl auf den eigenen Stellplatz; geht das nicht, untätig (Rückkehr regelt dann aircraft.js). */
function sendHome(game, u) {
  const r = cmdLand(game, u.team, { ids: [u.id], airportId: u.jet.home });
  if (r.ok) u.order.qra = true;
  else {
    setIdle(u);
    u.jet.qra = null;
  }
}

/** Ein Jet mit laufendem Alarm: warten, starten, verfolgen, heimkehren. */
function follow(game, u) {
  const q = u.jet.qra;
  const e = game.getEntity(q.target);
  if (q.phase === 'react') {
    // ein Befehl, abgeschaltete Bereitschaft oder ein verschwundenes Ziel brechen den Alarm vor dem Start ab
    if (u.order.type !== 'idle' || !u.parked || !alertOn(u) || !validTarget(game, u, e)) {
      u.jet.qra = null;
      return;
    }
    if (game.time < q.at) return;
    if (!u.jet.ready || !cmdAttack(game, u.team, { ids: [u.id], targetId: e.id }).ok) {
      u.jet.qra = null;
      return;
    }
    u.order.qra = true; // Marke: der Befehl stammt vom Alarm
    q.phase = 'fly';
    u.jet.qraNext = game.time + S.cooldown;
    return;
  }
  if (!u.order.qra) {
    u.jet.qra = null; // neuer Befehl hat Vorrang
    return;
  }
  if (u.parked) {
    setIdle(u); // gelandet: Alarmflug vorbei, wieder in Bereitschaft
    u.jet.qra = null;
    return;
  }
  if (u.order.type === 'attack' && !validTarget(game, u, e)) sendHome(game, u);
}

/** Ein Simulationsschritt der Alarmrotte (vor updateAircraft). */
export function updateScramble(game) {
  if (!game.city) return;
  for (const team of game.teams) {
    if (team.out) continue;
    const t = team.id;
    let jets = null;
    for (const u of game.units) if (u.alive && u.team === t && u.def.jet && u.jet && (u.jet.qra || alertOn(u))) (jets ??= []).push(u);
    if (!jets) continue;
    let busy = 0;
    const engaged = new Set();
    for (const u of jets) {
      if (!u.jet.qra) continue;
      follow(game, u);
      if (!u.jet.qra) continue;
      busy++;
      engaged.add(u.jet.qra.target);
    }
    if (busy >= S.maxJets) continue;
    const ready = jets.filter((u) => !u.jet.qra && alertOn(u) && u.parked && u.jet.ready && u.order.type === 'idle' && game.time >= (u.jet.qraNext ?? 0));
    if (!ready.length) continue;
    const zones = zonesOf(game, t);
    if (!zones.length) continue;
    const threats = [];
    for (const e of game.units) {
      if (!e.alive || !hostile(t, e.team) || engaged.has(e.id) || !airborne(e)) continue;
      if (!zones.some((z) => (z.x - e.x) ** 2 + (z.y - e.y) ** 2 <= z.r * z.r)) continue;
      if (!game.sees(t, e) || game.mode.locked(game, t, e.x, e.y)) continue;
      threats.push(e);
    }
    let first = null;
    let n = 0;
    for (const e of threats) {
      if (busy >= S.maxJets) break;
      let best = null;
      let bd = Infinity;
      for (const u of ready) {
        if (u.jet.qra || !canHitAltitude(u, e)) continue;
        const d = (u.x - e.x) ** 2 + (u.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      if (!best) continue;
      best.jet.qra = { phase: 'react', target: e.id, at: game.time + S.react };
      first ??= e;
      busy++;
      n++;
    }
    if (!first || game.time < (team.qraMsgAt ?? -Infinity)) continue;
    team.qraMsgAt = game.time + S.cooldown;
    team.qraMark = { x: first.x, y: first.y, at: game.time };
    game.message(t, `Alarmstart: ${n} ${n === 1 ? 'Jet startet' : 'Jets starten'} gegen ${first.def.name}`, first.x, first.y);
  }
}

/**
 * Befehl `{ type: 'scramble', ids, on }`: Alarmbereitschaft der gewählten Jets mit Luft-Luft-Waffe an (on = true) oder aus. Ohne
 * gültiges on schaltet er um (nach dem ersten Jet). Abschalten bricht einen Alarm vor dem Start ab, ein laufender Alarmflug bleibt.
 */
export function cmdScramble(game, team, cmd) {
  const jets = game.ownUnits(team, cmd.ids).filter(alertable);
  if (!jets.length) return fail('Kein Jet mit Luft-Luft-Waffe gewählt (F-16, F-22, Su-27)');
  const on = typeof cmd.on === 'boolean' ? cmd.on : !alertOn(jets[0]);
  for (const u of jets) {
    u.jet ??= { home: 0, ready: true, warned: false };
    u.jet.alert = on;
    if (!on && u.jet.qra?.phase === 'react') u.jet.qra = null;
  }
  return { ok: true, count: jets.length, on };
}
