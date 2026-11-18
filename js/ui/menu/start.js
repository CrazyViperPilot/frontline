// Startmenü (docs/archiv/verlauf.md §5): showStartMenu setzt den Dialog zusammen und verdrahtet die Ereignisse. Aufteilung:
// start-html.js (HTML), start-state.js (Zustand der Schalter), start-saves.js (Kasse, Spielstände), start-account.js (Konto),
// start-maps.js (Kartenwahl). Reines DOM, keine Spiellogik. Export: showStartMenu.
import { saveLevel } from '../../audio/sound.js';
import { show, hideOverlay } from './common.js';
import { startHtml } from './start-html.js';
import { readStartState, markStart, applySetting } from './start-state.js';
import { createWallet, createSaves } from './start-saves.js';
import { wireStartAccount } from './start-account.js';
import { renderMapBox, mapChange, mapClick } from './start-maps.js';

/**
 * Startmenü: onStart({conquest, difficulty, difficulties (je Computergegner), winPoints, mapId, weather, mood, research, river, buildRules, lowres}) (city immer true) beim Klick auf Start (mapId 'random' oder Karten-ID, lowres = Bildauflösung „Leistung“,
 * weather = 'off' | 'random' | Jahreszeit, research = Forschungsbaum, river = Flüsse auf Zufallskarten).
 * Die Kasse (Geld von Runde zu Runde) kommt aus dem Konto (ui/saves.js, accountWallet); Gäste sehen den Startbetrag und den Hinweis.
 * Gewertete Partien (Tokens, ui/match.js) zeigt die Kasszeile: wie viele bereit sind und ob ein Endstand noch auf Netz wartet.
 */
export function showStartMenu(root, onStart, { resume = null } = {}) {
  // resume: { find(): Promise<{ text, source } | null>, onResume(), onDiscard() } – gespeicherte Partie (Gerät oder Webspace), siehe ui/saves.js
  const s = readStartState(); // Zustand der Schalter (menu/start-state.js); die Handler lesen ihn erst beim Aufruf
  show(root, 'start', startHtml());
  const wallet = createWallet(root);
  wallet.show();
  // Schnellknopf „Fortsetzen“ (neuester nicht beendeter Stand) und die Liste der Spielstände (SP3)
  const saves = createSaves(root, resume);
  saves.loadQuick();
  saves.loadSaves();
  wireStartAccount(root, wallet, saves);
  const mark = () => markStart(root, s);
  mark();
  renderMapBox(root, s);
  root.onchange = mapChange(root, s);
  root.oninput = (e) => {
    const r = e.target.closest?.('[data-vol]');
    if (!r) return;
    const v = Number(r.value) / 100;
    saveLevel(r.dataset.vol, v);
    root.querySelector(`[data-volout="${r.dataset.vol}"]`).textContent = `${r.value} %`;
  };
  root.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.matches?.('[data-rename-input]')) {
      e.preventDefault();
      saves.listBox.querySelector('[data-sact="renamesave"]')?.click();
    }
  };
  root.onclick = (e) => {
    if (e.target.closest('[data-account]')) return; // Konto-Bereich: wireAccount behandelt seine Knöpfe selbst
    const sb = e.target.closest('[data-sact]');
    if (sb) return saves.saveAct(sb);
    const b = e.target.closest('button');
    if (!b) return;
    if (mapClick(root, s, b)) return;
    if (!applySetting(s, b)) {
      if (b.dataset.act === 'resume') {
        hideOverlay(root);
        resume.onResume();
        return;
      } else if (b.dataset.act === 'discardSave') {
        if (!confirm('Gespeicherte Partie wirklich löschen?')) return;
        const box = root.querySelector('[data-resume]');
        box.hidden = true;
        resume.onDiscard();
      } else if (b.dataset.act === 'resetWallet') {
        wallet.reset();
      } else if (b.dataset.act === 'start') {
        hideOverlay(root);
        // difficulties: Schwierigkeit je Computergegner (Team 1, 2, 3); difficulty: die des ersten (Spielstand-Liste, Statistik)
        onStart({ conquest: s.conquest, tickets: s.tickets, difficulty: s.diffs[0], difficulties: s.diffs.slice(0, s.conquest ? s.opponents : 1), winPoints: s.winPoints, mapId: s.mapSel, weather: s.weather, mood: s.mood, research: s.research, river: s.river, buildRules: s.buildRules, lowres: s.lowres });
        return;
      }
    }
    mark();
  };
}
