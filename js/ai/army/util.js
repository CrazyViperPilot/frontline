// KI-Gegner: gemeinsame Konstanten und Hilfsfunktionen der Armee-Module (js/ai/army/). Kein DOM.

import { BALANCE } from '../../data/balance.js';
import { ZONE_FOB_SHARE } from '../../data/ai.js';

export const DEF_RANGE = BALANCE.fob.buildRadius; // Bauradius = Verteidigungsradius einer FOB
export const ZONE_FOB_R = BALANCE.zone.r * ZONE_FOB_SHARE; // Zonen-FOB: Mittelpunkt höchstens so weit von der Zonenmitte

export const TWO_PI = Math.PI * 2;

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function unitVec(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}
