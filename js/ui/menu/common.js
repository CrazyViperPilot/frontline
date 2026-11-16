// Gemeinsame Bausteine der Overlay-Menüs (Start, Pause, Hilfe, Ende): Auswahllisten und Beschriftungen, Vollbild-Schalter,
// Lautstärke-Regler, Text- und Zeitformate, show/hideOverlay. Reines DOM, keine Spiellogik.
// Exporte: DIFFS, POINTS, WEATHER_LABELS, MOOD_LABELS, setFullscreen, markFullscreen, volRow, esc, fmtTime, show, hideOverlay.
export const DIFFS = [
  ['easy', 'Leicht'],
  ['normal', 'Normal'],
  ['hard', 'Schwer'],
];
export const POINTS = [25, 50, 100];
export const WEATHER_LABELS = { off: 'Aus', random: 'Zufall', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' };
export const MOOD_LABELS = { off: 'Aus', random: 'Zufall', morning: 'Morgen', day: 'Tag', evening: 'Abend', night: 'Nacht' };

// Vollbild (wie Katzen-Queens): installiert startet die App per Manifest (`display: fullscreen`) ohne Status- und Navigationsleiste.
// Im Browser-Tab, oder solange Android das geänderte Manifest einer schon installierten App noch nicht übernommen hat,
// schaltet der Schalter im Start- und Pausenmenü die Fullscreen API. Läuft die App schon per Manifest im Vollbild, bleibt er verborgen.
const fsOn = () => !!document.fullscreenElement;
const fsToggleable = () =>
  !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false &&
  (fsOn() || !matchMedia('(display-mode: fullscreen)').matches);
export function setFullscreen(on) {
  if (on === fsOn()) return;
  const p = on ? document.documentElement.requestFullscreen({ navigationUI: 'hide' }) : document.exitFullscreen();
  p?.catch?.(() => {});
}
/** Schalter im offenen Menü an den Vollbild-Zustand anpassen (auch nach Zurück-Geste oder Esc). */
export function markFullscreen(root) {
  root.querySelectorAll('[data-fsbox]').forEach((el) => { el.hidden = !fsToggleable(); });
  root.querySelectorAll('[data-fs]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.fs === '1') === fsOn())));
}
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    const root = document.getElementById('overlay');
    if (root && !root.hidden) markFullscreen(root);
  });
}

/** Lautstärke-Regler 0–100 % mit Prozentzahl; kind 'sfx' (Geräusche) oder 'music' (Musik), value 0–1 (seit v5.68). */
export const volRow = (kind, value) => {
  const pct = Math.round(value * 100);
  const name = kind === 'music' ? 'Musik' : 'Geräusche';
  return `<div class="vol"><input type="range" min="0" max="100" step="5" value="${pct}" data-vol="${kind}" aria-label="Lautstärke ${name}"><output data-volout="${kind}">${pct} %</output></div>`;
};

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fmtTime(s) {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function show(root, kind, html) {
  root.innerHTML = html;
  root.dataset.kind = kind;
  root.hidden = false;
}

export function hideOverlay(root) {
  root.onclick = null;
  root.oninput = null;
  root.onkeydown = null;
  root.onsubmit = null;
  root.innerHTML = '';
  delete root.dataset.kind;
  root.hidden = true;
}
