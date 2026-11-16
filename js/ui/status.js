// Lesende Hilfen für die UI: Auftragstext, FOB-Namen (kein DOM, keine Änderung am Spiel). Der Bauzustand von Baustellen
// (builderState) liegt seit v5.64 in js/game/construction.js, damit der Renderer nichts aus js/ui/ braucht (Review-Paket P11).
import { alertable, alertOn } from '../game/scramble.js';

/** Zustand der Alarmrotte eines Jets (Paket „Alarmrotte“): Alarmstart, Alarmflug, in Bereitschaft, Bereitschaft aus; sonst leer. */
export function alertText(u) {
  if (!alertable(u)) return '';
  if (u.jet?.qra?.phase === 'react') return 'Alarmstart';
  if (u.jet?.qra) return 'Alarmflug';
  return alertOn(u) ? 'in Bereitschaft' : 'Bereitschaft aus';
}

/** Name einer eigenen FOB nach Reihenfolge der Gründung: „FOB 2“ bzw. „FOB 2 (Baustelle)“. */
export function fobLabel(game, b) {
  if (!b) return 'FOB';
  if (b.main) return 'Hauptstadt';
  const own = game.buildings.filter((x) => x.alive && x.team === b.team && x.type === 'fob' && !x.main);
  const i = own.indexOf(b);
  const n = i >= 0 ? i + 1 : '';
  return `FOB ${n}${b.built ? '' : ' (Baustelle)'}`.trim();
}

/** Kurztext des Auftrags einer eigenen Einheit (Auftragstyp aus Engine). */
export function orderText(game, u) {
  const o = u.order;
  if (u.jet?.qra) return alertText(u); // Alarmstart bzw. Alarmflug (Paket „Alarmrotte“)
  switch (o.type) {
    case 'idle':
      if (u.house) return 'Im Gebäude';
      if (u.crate) return 'Trägt eine Versorgungskiste';
      if (alertable(u)) return `Bereit · ${alertText(u)}`; // Jet mit Luft-Luft-Waffe: Alarmbereitschaft
      return u.def.builder ? 'Bereit (hilft bei Baustellen)' : 'Bereit';
    case 'move':
      return 'Bewegung';
    case 'attackMove':
      return 'Angriffsbewegung';
    case 'attack':
      return u.house ? 'Angriff aus dem Gebäude' : 'Angriff';
    case 'garrison': {
      const h = game.getEntity(o.targetId);
      return h ? `Unterwegs ins Gebäude (${h.def.name})` : 'Bereit';
    }
    case 'storm': {
      const h = game.getEntity(o.targetId);
      return h ? `${u.storming ? 'Stürmt' : 'Läuft zum Sturm auf'}: ${h.def.name}` : 'Bereit';
    }
    case 'pickup':
      return 'Holt eine Versorgungskiste';
    case 'deliver':
      return `Bringt die Kiste zu ${fobLabel(game, game.getEntity(o.targetId))}`;
    case 'build': {
      const s = game.getEntity(o.targetId);
      return s ? `Baut ${s.type === 'fob' ? fobLabel(game, s) : s.def.name}` : 'Baustelle fertig';
    }
    case 'repair': {
      const b = game.getEntity(o.targetId);
      return b ? `Repariert ${b.def.name}` : 'Reparatur beendet';
    }
    case 'load': {
      if (o.work != null) return 'Lädt am Werk';
      const f = game.getEntity(o.targetId);
      return `Lädt an ${fobLabel(game, f)}`;
    }
    case 'unload': {
      const f = game.getEntity(o.targetId);
      return `Entlädt an ${fobLabel(game, f)}`;
    }
    case 'route': {
      const from = o.work != null ? 'Werk' : fobLabel(game, game.getEntity(o.fromId));
      const to = fobLabel(game, game.getEntity(o.toId));
      return o.phase === 'load' ? `Pendelt ${from} → ${to} (lädt)` : `Pendelt ${from} → ${to} (liefert)`;
    }
    default:
      return 'Bereit';
  }
}
