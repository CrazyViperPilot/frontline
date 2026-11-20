// Props gezielt beschießen (Befehl `attackProp`): gewählte Einheiten fahren in Reichweite und schießen mit der Waffe, die dem Prop am
// meisten schadet (Schaden je Panzerklasse des Props, js/data/props.js), bis es zu Trümmern wird oder weg ist. Sonst greifen Einheiten
// Props nie von selbst an. Kein DOM, deterministisch.
import { PROPS } from '../data/props.js';
import { BALANCE } from '../data/balance.js';
import { propIndex, damageProp, stateOf, PROP_STATE } from './props.js';
import { driveTo, setIdle } from './movement.js';
import { rangeMul } from './research.js';

const TILE = BALANCE.map.tile;

/** Index des heilen, beschießbaren Props, dessen Zellen (x, y) enthalten (das zuletzt gesetzte zuerst); −1 = keins. */
export function propAt(game, x, y) {
  const props = game.map.props;
  if (!props?.length) return -1;
  const grid = game.grid;
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  const list = propIndex(props, grid.cols, grid.rows).cells.get(r * grid.cols + c) ?? [];
  for (let k = list.length - 1; k >= 0; k--) {
    const i = list[k];
    if (stateOf(game.propSt[i]) === PROP_STATE.ok && PROPS.kinds[props[i].kind]?.target !== false) return i;
  }
  return -1;
}

/** Waffe der Einheit u, die Prop-Panzerklasse `armor` am meisten schadet (mit Munition); null = keine. Flugzeuge nicht. */
export function propWeapon(u, armor) {
  if (u.def.jet || !u.weapons) return null;
  let best = null;
  for (const w of u.weapons) {
    const dmg = w.spec.damage?.[armor] ?? 0;
    if (!(dmg > 0) || w.rounds <= 0 || (best && dmg <= best.spec.damage[armor])) continue;
    best = w;
  }
  return best;
}

/**
 * Befehl `{ type: 'attackProp', ids, x, y }`: das Prop unter (x, y) beschießen (Zaun, Mauer, Container …). Nur eigene Einheiten mit
 * einer Waffe, die ihm schadet; Besatzer von Häusern und Kistenträger nicht.
 */
export function cmdAttackProp(game, team, cmd) {
  const i = propAt(game, cmd.x, cmd.y);
  if (i < 0) return { ok: false, reason: 'Dort ist nichts zum Beschießen' };
  const armor = PROPS.kinds[game.map.props[i].kind].armor;
  const units = game.ownUnits(team, cmd.ids).filter((u) => !u.house && !u.crate && propWeapon(u, armor));
  if (!units.length) return { ok: false, reason: 'Keine gewählte Einheit kann das beschädigen' };
  const p = game.map.props[i];
  for (const u of units) {
    u.order = { type: 'attackProp', prop: i, x: p.x, y: p.y, targetId: null };
    u.targetId = null;
    u.path = [];
    u.pathIndex = 0;
  }
  return { ok: true, count: units.length };
}

/** Ein Schritt: Einheiten mit Auftrag `attackProp` fahren heran und schießen (in game.update nach dem Straßenkrieg). */
export function updatePropFire(game, dt) {
  const props = game.map.props;
  if (!props?.length) return;
  for (const u of game.units) {
    if (!u.alive || u.order?.type !== 'attackProp') continue;
    const o = u.order;
    const p = props[o.prop];
    const K = p && PROPS.kinds[p.kind];
    const w = K ? propWeapon(u, K.armor) : null;
    if (!K || !w || stateOf(game.propSt[o.prop]) !== PROP_STATE.ok) {
      setIdle(u);
      continue;
    }
    const range = w.spec.range * rangeMul(game, u);
    if (driveTo(game, u, p.x, p.y, range, dt) !== 'arrived') continue;
    if (w.spec.minRange && Math.hypot(u.x - p.x, u.y - p.y) < w.spec.minRange) continue; // zu nah (Haubitze)
    if (w.cd > 0) continue; // Abklingzeit zählt combat.js herunter
    w.rounds -= 1;
    w.cd = w.spec.cooldown;
    game.teams[u.team].used.mun += w.spec.munCost;
    game.addEffect(w.spec.shell ? 'shell' : 'tracer', u.x, u.y, u.team, p.x, p.y, w.spec.id);
    damageProp(game, o.prop, w.spec.damage[K.armor]);
  }
}
