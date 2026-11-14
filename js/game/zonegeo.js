// Geometrie der Konfliktzone an einer Stelle (Review „Eroberung“): Kreis (klassisch, zone.r) oder Quadrat (Eroberung, zone.half).
// Reine Rechnung ohne Importe; Simulation, KI, Darstellung und Kartenerzeugung fragen hier, ob ein Punkt in der Zone liegt. Kein DOM.

/** Liegt (x, y) in der Zone? `pad` vergrößert (positiv) oder verkleinert (negativ) die Zone um so viele px. */
export function inZone(zone, x, y, pad = 0) {
  if (zone.half) return Math.abs(x - zone.x) <= zone.half + pad && Math.abs(y - zone.y) <= zone.half + pad;
  return Math.hypot(x - zone.x, y - zone.y) <= zone.r + pad;
}

/** „Abstand zur Zonenmitte“ in der Form der Zone: im Kreis der Abstand, im Quadrat die größere Achsenentfernung. zoneDist <= zoneSize heißt: in der Zone. */
export function zoneDist(zone, x, y) {
  return zone.half ? Math.max(Math.abs(x - zone.x), Math.abs(y - zone.y)) : Math.hypot(x - zone.x, y - zone.y);
}

/** Größe der Zone in der Einheit von zoneDist: Radius bzw. halbe Kantenlänge. */
export function zoneSize(zone) {
  return zone.half || zone.r;
}
