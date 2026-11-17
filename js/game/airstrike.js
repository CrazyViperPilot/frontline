// Luftschlag (Paket „Luftschlag“, PRD docs/prd/stadt-luft.md): ein Befehl schickt die startbereiten eigenen Jets mit Bodenwaffen
// (F-16, Su-27, A-10) auf ein Ziel oder einen Punkt, ohne dass der Spieler sie vorher am Fliegerhorst wählen muss. Es starten nur
// Jets, die am Stellplatz stehen, betankt und bewaffnet sind (u.jet.ready), untätig sind und nicht im Alarm fliegen; höchstens
// CITY.air.strike.maxJets, die nächsten zuerst. Ein feindliches Ziel greifen sie an (cmdAttack), sonst fliegen sie im Angriffsmarsch
// zum Punkt (cmdMove) und greifen an, was sie dort sehen. Ist das Ziel vernichtet bzw. finden sie am Punkt linger s lang nichts,
// landen sie auf ihrem Stellplatz (cmdLand); Heimflug wegen Treibstoff oder Raketen wie bisher (aircraft.js). Rollen, Bahnsperre und
// Tower gelten unverändert. Ein neuer Befehl ersetzt u.order (ohne Marke strike) und beendet den Luftschlag.
// Zustand je Jet: u.order.strike (Marke am Befehl), u.jet.striking (am Punkt angekommen), u.jet.strikeIdle (Spielzeit, seit der er
// dort nichts findet).
// Kein DOM, kein Zufall. Läuft vor updateAircraft (wie die Alarmrotte).
import { CITY } from '../data/city.js';
import { cmdLand } from './aircraft.js';
import { cmdAttack, cmdMove } from './cmd/units.js';
import { canAttack } from './entities.js';
import { setIdle } from './movement.js';

const S = CITY.air.strike;
const fail = (reason) => ({ ok: false, reason });

/** Jet mit Waffe gegen Bodenziele (F-16, Su-27, A-10; nicht F-22, U-2, C-130). */
export const groundJet = (u) => !!u.def?.jet && !u.def.highAlt && !!u.def.weapons?.some((w) => (w.targets ?? []).some((k) => k !== 'air'));

/** Startbereite Jets des Teams für einen Luftschlag: abgestellt, voll, untätig, nicht im Alarm. */
export function strikeJets(game, team) {
  return game.units.filter((u) => u.alive && u.team === team && groundJet(u) && u.parked && u.jet?.ready && u.order.type === 'idle' && !u.jet.qra);
}

/**
 * Befehl `{ type: 'airstrike', x, y, targetId? }`: die nächsten startbereiten Jets mit Bodenwaffen (höchstens CITY.air.strike.maxJets)
 * greifen das feindliche Ziel targetId an oder fliegen im Angriffsmarsch zum Punkt (x, y). Antwort mit der Zahl der Jets.
 */
export function cmdAirstrike(game, team, cmd) {
  if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Kein Ziel auf der Karte');
  const ready = strikeJets(game, team);
  if (!ready.length) return fail('Kein startbereiter Jet mit Bodenwaffen am Fliegerhorst (F-16, Su-27, A-10)');
  const d2 = (u) => (u.x - cmd.x) ** 2 + (u.y - cmd.y) ** 2;
  const jets = ready.sort((a, b) => d2(a) - d2(b) || a.id - b.id).slice(0, S.maxJets);
  const ids = jets.map((u) => u.id);
  const t = cmd.targetId != null ? game.getEntity(cmd.targetId) : null;
  const r = t && canAttack(team, t) ? cmdAttack(game, team, { ids, targetId: t.id }) : cmdMove(game, team, { type: 'attackMove', ids, x: cmd.x, y: cmd.y });
  if (!r.ok) return r;
  for (const u of jets) {
    u.order.strike = true; // Marke: der Befehl stammt vom Luftschlag
    u.jet.strikeIdle = null;
  }
  game.message(team, `Luftschlag: ${jets.length} ${jets.length === 1 ? 'Jet startet' : 'Jets starten'}`, cmd.x, cmd.y);
  return { ok: true, count: jets.length, ids };
}

/** Jet im Luftschlag heimschicken (Landung auf seinem Stellplatz). */
function sendHome(game, u) {
  if (!cmdLand(game, u.team, { ids: [u.id], airportId: u.jet.home }).ok) setIdle(u);
}

/** Ein Simulationsschritt: Jets im Luftschlag landen, sobald ihr Einsatz vorbei ist (vor updateAircraft). */
export function updateAirstrike(game) {
  for (const u of game.units) {
    if (!u.alive || !u.def.jet || !u.jet) continue;
    const o = u.order;
    if (o.type === 'attack' && o.strike && !canAttack(u.team, game.getEntity(o.targetId))) {
      if (u.parked) setIdle(u); // Ziel vor dem Start vernichtet: bleibt stehen
      else sendHome(game, u); // Ziel vernichtet oder weg: zurück zum Stellplatz
      continue;
    }
    if (u.parked) {
      u.jet.striking = false; // gelandet (auch wegen Treibstoff oder Raketen): Luftschlag vorbei
      continue;
    }
    if (o.type === 'attack' && o.strike) continue;
    // Angriffsmarsch angekommen: aircraft.js setzt den Jet untätig (kreist um den Punkt) und übernimmt die Marke nicht
    if (o.type === 'attackMove' && o.strike) {
      u.jet.strikeIdle = null;
      u.jet.striking = true;
      continue;
    }
    if (!u.jet.striking) continue;
    if (o.type !== 'idle') {
      u.jet.striking = false; // neuer Befehl: Luftschlag vorbei
      continue;
    }
    if (u.targetId !== null) {
      u.jet.strikeIdle = null; // greift am Punkt etwas an
      continue;
    }
    u.jet.strikeIdle ??= game.time;
    if (game.time - u.jet.strikeIdle < S.linger) continue;
    u.jet.striking = false;
    u.jet.strikeIdle = null;
    sendHome(game, u);
  }
}
