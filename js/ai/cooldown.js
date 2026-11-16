// Sperrzeiten der KI (Stadt-KI und Armee-KI): gemeinsamer Helfer für „nicht vor Zeitpunkt X erneut“. Eine Sperrzeit-Tabelle ist ein
// einfaches Objekt Schlüssel → Spielzeit (s), bis zu der gesperrt ist. Kein DOM, keine Imports.

/**
 * Sperrt `key` für `secs` Sekunden ab `now` (überschreibt eine bestehende Sperre).
 * @param {Object<string, number>} table Sperrzeit-Tabelle
 * @param {string|number} key Schlüssel (Zelle, Befehlsname, Anker …)
 * @param {number} secs Dauer der Sperre in Spielsekunden
 * @param {number} now aktuelle Spielzeit (s)
 */
export function block(table, key, secs, now) { table[key] = now + secs; }

/**
 * true, wenn `key` zur Zeit `now` nicht gesperrt ist (nie gesperrt oder Sperre abgelaufen, genau an der Grenze schon frei).
 * @param {Object<string, number>} table Sperrzeit-Tabelle
 * @param {string|number} key Schlüssel
 * @param {number} now aktuelle Spielzeit (s)
 */
export function ready(table, key, now) { const t = table[key]; return t === undefined || now >= t; }

/**
 * Prüft `key` wie ready() und sperrt ihn bei Erfolg für `secs` s. Liefert true, wenn die Aktion erlaubt ist.
 * @param {Object<string, number>} table Sperrzeit-Tabelle
 * @param {string|number} key Schlüssel
 * @param {number} secs Dauer der Sperre, falls erlaubt
 * @param {number} now aktuelle Spielzeit (s)
 */
export function take(table, key, secs, now) { if (!ready(table, key, now)) return false; block(table, key, secs, now); return true; }

/**
 * Entfernt alle Sperren, die bis `now` abgelaufen sind (sie wirken ohnehin nicht mehr; hält die Tabelle klein).
 * @param {Object<string, number>} table Sperrzeit-Tabelle
 * @param {number} now aktuelle Spielzeit (s)
 */
export function prune(table, now) { for (const k in table) if (table[k] <= now) delete table[k]; }
