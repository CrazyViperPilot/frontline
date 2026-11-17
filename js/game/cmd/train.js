// Befehle der Ausbildung (aus game.js ausgelagert): Einheit in die Warteschlange stellen und den letzten Auftrag zurücknehmen
// (Geld, Lager und Stahl zurück). Handler: cmdX(game, team, cmd). Kein DOM.
import { BALANCE } from '../../data/balance.js';
import { UNITS } from '../../data/units.js';
import { KIND_NAME } from '../../data/citykinds.js';
import { payMetal } from '../city/state.js';
import { freePop, crewOf, trainerKind } from '../city/query.js';
import { hasCommander } from '../commander.js';
import { trainCheck } from '../aircraft.js';
import { heliTrainCheck } from '../helipad.js';

const ONE_COMMANDER = 'Nur ein Kommandeur je Team';
const fail = (reason) => ({ ok: false, reason });

/** { type: 'train', buildingId, unit }: Hauptstadt, mit Stadt Kaserne/Fabrikhalle/Heliport; Einheiten kosten Geld (mit Forschung erst ab ihrer Stufe). */
export function cmdTrain(game, team, cmd) {
  const b = game.getEntity(cmd.buildingId);
  if (!b || b.kind !== 'building' || b.team !== team) return fail('Kein eigenes Gebäude gewählt');
  if (!b.built) return fail('Gebäude ist noch im Bau');
  if (!UNITS[cmd.unit] || !b.produces?.includes(cmd.unit)) { // Stadtgebäude ohne Ausbildung haben kein produces
    const k = game.city && trainerKind(cmd.unit);
    return fail(k ? `${UNITS[cmd.unit]?.name ?? 'Einheit'}: nur in der ${KIND_NAME[k]} der Stadt` : 'Nur die Hauptstadt bildet Einheiten aus');
  }
  const jetNo = trainCheck(game, b, cmd.unit) ?? (UNITS[cmd.unit].air && !UNITS[cmd.unit].jet ? heliTrainCheck(game, b) : null); // Stellplatz bzw. Heliport: ein Luftfahrzeug je Platz
  if (jetNo) return fail(jetNo);
  if (b.queue.length >= BALANCE.queueMax) return fail('Warteschlange ist voll');
  if (game.slotsUsed(team) + (UNITS[cmd.unit].slots ?? 1) > game.slotCap) return fail('Einheitenlimit erreicht');
  if (UNITS[cmd.unit].hero && hasCommander(game, team)) return fail(ONE_COMMANDER);
  if (game.city && freePop(game, team) < crewOf(cmd.unit)) return fail('Zu wenig freie Einwohner (Stadt: Wohnen ausbauen)');
  const cost = UNITS[cmd.unit].cost;
  if (!game.canAfford(team, cost)) return fail(game.missingMoney());
  if (!payMetal(game, team, cmd.unit)) return fail('Zu wenig Stahl (Stadt: Stahlwerk mit Eiseneinfuhr oder Markt)');
  game.pay(team, cost);
  b.queue.push({ unit: cmd.unit, payerId: b.id });
  b.queueTimes.push(0);
  return { ok: true };
}

export function cmdCancelTrain(game, team, cmd) {
  const b = game.getEntity(cmd.buildingId);
  if (!b || b.kind !== 'building' || b.team !== team) return fail('Kein eigenes Gebäude gewählt');
  if (b.queue.length === 0) return fail('Nichts in der Warteschlange');
  const entry = b.queue.pop();
  b.queueTimes.pop();
  const cost = UNITS[entry.unit].cost;
  game.refund(team, cost);
  game.refundStock(team, entry.payerId, cost, 1, b.x, b.y);
  payMetal(game, team, entry.unit, -1); // Stahl zurück ins Stadtlager
  return { ok: true };
}
