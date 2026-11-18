// Kassenbuch je Team (Paket „Wirtschaft: Geld“, PRD docs/prd/stadt-wirtschaft.md „Wirtschaftsanzeige“): jede Geldbuchung der Simulation
// trägt einen Grund. team.book = { in: { Quelle: Summe }, out: { Zweck: Summe } } zählt seit Spielbeginn (gehört zum Spielstand; ältere
// Stände legen es leer an). Erstattungen mindern die Ausgaben ihres Zwecks. Die Anzeige (js/ui/flowpanel.js) misst daraus Raten je s.
// Liest und schreibt nur team.res.money und team.book. Kein DOM, kein Zufall.

/** Quellen der Einnahmen in Anzeigereihenfolge. */
export const IN_KEYS = ['zone', 'hot', 'flags', 'crates', 'tax', 'market', 'bounty', 'debug'];
/** Zwecke der Ausgaben in Anzeigereihenfolge. */
export const OUT_KEYS = ['train', 'build', 'city', 'research', 'import', 'market', 'upkeep'];

const bookOf = (t) => (t.book ??= { in: {}, out: {} });

/** Einnahme `amount` (≥ 0) aus Quelle `key` gutschreiben. */
export function earn(t, key, amount) {
  if (!(amount > 0)) return;
  t.res.money += amount;
  const b = bookOf(t).in;
  b[key] = (b[key] ?? 0) + amount;
}

/** Ausgabe `amount` für Zweck `key` abziehen; negativ = Erstattung (mindert die Ausgaben dieses Zwecks). */
export function spend(t, key, amount) {
  if (!amount) return;
  t.res.money -= amount;
  const b = bookOf(t).out;
  b[key] = (b[key] ?? 0) + amount;
}
