// HUD, gemeinsame Konstanten und Helfer: Wettersymbole, Ressourcenschlüssel, Farben, Zahlen- und Zeitformate, Balken, Anzeigezeilen.
// Exporte: WX_ICON, WX_COLOR, RES_KEYS, SHORT_RES, MSG_LIFE, MSG_MAX, DOM_EVERY, NEG_COLOR, COLOR, presetName, STORE_CAP,
// CAPITAL_CAP, esc, pct, hpColor, fmtDe, bar, fmtRate, fmtTime, gauge, storeRow. Kein Zustand, nur Daten und Funktionen.
import { BALANCE } from '../../data/balance.js';
import { GOOD_COLOR } from '../../data/goods.js';
import { presetKinds } from '../../game/logistics.js';

// Wettersymbole (16 × 16, Strichfarbe = currentColor)
export const WX_ICON = {
  clear: '<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  rain: '<path d="M4.5 9.5h7a2.4 2.4 0 0 0 .2-4.8A3.4 3.4 0 0 0 5.2 4.6 2.5 2.5 0 0 0 4.5 9.5z" fill="currentColor" stroke="none"/><path d="M5.5 11.5l-1 2.5M8.5 11.5l-1 2.5M11.5 11.5l-1 2.5"/>',
  fog: '<path d="M2 4.5h12M3.5 8h10M2 11.5h12"/>',
  snow: '<path d="M8 1.8v12.4M2.6 4.9l10.8 6.2M2.6 11.1l10.8-6.2M6.6 2.6L8 4l1.4-1.4M6.6 13.4L8 12l1.4 1.4"/>',
};
export const WX_COLOR = { clear: '#f2c94c', rain: '#8fb3d9', fog: '#c8ccc4', snow: '#e8f1fb' };
export const RES_KEYS = ['money']; // Kopfleiste: nur Geld (Paket „Kopfleiste“; die Front-Lager stehen in der Wirtschaftsanzeige)
export const SHORT_RES = { bm: 'BM', mun: 'MUN', fuel: 'TS' }; // Kürzel der Lagersorten (Wirtschaftsanzeige: Front-Lager)
export const MSG_LIFE = 6000; // ms
export const MSG_MAX = 5;
export const DOM_EVERY = 200; // ms
export const NEG_COLOR = '#e5484d'; // Verbrauch (negative Netto-Rate)
// Balken der Lager- und LKW-Sorten in der Farbe ihrer Ware (Register js/data/goods.js, seit v5.64); Munition der Waffen grau-blau
// wie der Munitionsbalken über den Einheiten (render/layers/top.js), Ladung und Passagiere im Akzentgelb
export const COLOR = { bm: GOOD_COLOR.bm, mun: GOOD_COLOR.mun, fuel: GOOD_COLOR.fuel, ammo: '#7f93ad', cargo: '#c9a227' };
const PRESET_NAME = { mix: 'Gemischt', bm: 'Baumaterial', mun: 'Munition', fuel: 'Treibstoff' };
/** Anzeige der Ladungsart: 'Gemischt', eine Sorte oder zwei Sorten mit ' + ' (z. B. „Munition + Treibstoff“). */
export const presetName = (p) => PRESET_NAME[p] || presetKinds(p).map((k) => PRESET_NAME[k]).join(' + ') || p;
export const STORE_CAP = BALANCE.logistics.storeCap;
export const CAPITAL_CAP = BALANCE.logistics.capitalCap;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pct = (f) => `${Math.max(0, Math.min(1, f)) * 100}%`;
export const hpColor = (f) => (f > 0.5 ? '#7dd38b' : f > 0.25 ? '#e0b44a' : '#e5484d');
export const fmtDe = (v) => String(v).replace('.', ',');
export const bar = (f, cls = '', color = '') => `<div class="bar ${cls}"><i style="width:${pct(f)}${color ? `;background:${color}` : ''}"></i></div>`;

export function fmtRate(v) {
  if (Math.abs(v) < 0.05) return '0';
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}

export function fmtTime(s) {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Zeile „Name · Balken · Zahl / Obergrenze“ (Einheiten: Munition, Treibstoff, Ladung). */
export function gauge(label, val, max, color) {
  const v = Math.max(0, Math.floor(val));
  return `<div class="gauge"><div class="gl"><span>${label}</span><b>${v} / ${max}</b></div>${bar(val / max, '', color)}</div>`;
}

/** Lagerzeile einer FOB: Sorte, Balken, Zahl / Obergrenze. */
export function storeRow(label, val, cap, color) {
  return `<div class="srow"><span>${label}</span>${bar(val / cap, 'store', color)}<b>${Math.floor(val)} / ${cap}</b></div>`;
}
