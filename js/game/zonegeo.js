// Geometrie der Konfliktzone an einer Stelle (Review „Eroberung“): Kreis (klassisch, zone.r) oder Quadrat (Eroberung, zone.half).
// Reine Rechnung ohne Importe; Simulation, KI, Darstellung und Kartenerzeugung fragen hier, ob ein Punkt in der Zone liegt. Kein DOM.

/** Liegt (x, y) in der Zone? `pad` vergrößert (positiv) oder verkleinert (negativ) die Zone um so viele px. */
export function inZone(zone, x, y, pad = 0) {
  if (zone.half) return Math.abs(x - zone.x) <= zone.half + pad && Math.abs(y - zone.y) <= zone.half + pad;
  return Math.hypot(x - zone.x, y - zone.y) <= zone.r + pad;
}

/** „Abstand zur Zonenmitte“ in der Form der Zone: im Kreis der Abstand, im Quadrat die größere Achsenentfernung. Liegt der Punkt in der Zone, ist zoneDist <= zone.r bzw. <= zone.half. */
export function zoneDist(zone, x, y) {
  return zone.half ? Math.max(Math.abs(x - zone.x), Math.abs(y - zone.y)) : Math.hypot(x - zone.x, y - zone.y);
}

/** Kartenseite eines Punkts um die Zonenmitte (Teilung entlang der Diagonalen): 0 oben, 1 rechts, 2 unten, 3 links. */
export function sideOf(zone, x, y) {
  const dx = x - zone.x;
  const dy = y - zone.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}
