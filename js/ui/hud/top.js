// HUD, Kopfleiste: Ressourcen, Punkte oder Tickets, Konfliktzone, Hot Zone, Sendemast, Wetter, Uhr und Knopfbeschriftungen.
// Methoden der Klasse Hud (core.js), eingehängt über Object.assign (topMethods). updateTop ruft die Teile in fester Reihenfolge auf.
import { BALANCE } from '../../data/balance.js';
import { storedCrates } from '../../game/crates.js';
import { radios, radioLeft } from '../../game/radio.js';
import { SEASON_NAMES, WEATHER_NAMES, weatherEffect } from '../../game/weather.js';
import { hasMarket } from '../../game/city/query.js';
import { RES_KEYS, NEG_COLOR, WX_ICON, WX_COLOR, pct, fmtDe, fmtRate, fmtTime } from './common.js';

// Zahlen je Team in der Teamfarbe, getrennt durch „:“
const perTeam = (arr) => arr.map((v, i) => `<b style="color:${BALANCE.teamColors[i]}">${v}</b>`).join('<i>:</i>');

export const topMethods = {
  updateTop() {
    const g = this.game;
    const t = g.teams[this.team];
    this.updateResources(g, t);
    const cq = g.conquest;
    this.updatePoints(g, cq);
    this.updateZone(g, t, cq);
    this.updateHot(g);
    this.updateRadio(g);
    this.updateWeather();
    this.updateClock(g);
  },

  /** Ressourcenfelder (Wert, Rate, Tooltip), Markt- und Forschungsknopf. */
  updateResources(g, t) {
    for (const k of RES_KEYS) {
      const el = this.res[k];
      const v = t.income[k];
      const neg = v <= -0.05; // Netto-Verbrauch (Munition/Treibstoff)
      el.val.textContent = String(Math.floor(t.res[k]));
      el.rate.textContent = `${neg ? '−' : '+'}${fmtRate(Math.abs(v))}/s`;
      el.rate.style.color = neg ? NEG_COLOR : '';
      // Lagersorten: Summe aller fertigen FOB-Lager; Geld ist global
      const lines = [k === 'money' ? `Geld (global): je Einheit in der Konfliktzone ${fmtDe(BALANCE.zone.unitIncome)}/s, in der Hot Zone ${fmtDe(BALANCE.hot.unitIncome)}/s, je eingelagerte Versorgungskiste ${fmtDe(BALANCE.crates.income)}/s; bleibt von Runde zu Runde` : 'Front-Lager: Summe der FOB-Lager ohne Hauptstadt (die hat unendlich)'];
      if (t.used[k] !== undefined) lines.push(`verbraucht: ${Math.floor(t.used[k])}`);
      if (k === 'money' && g.city) {
        // Einfuhr der Rohwaren (Paket „Import“): Geld je s für die Werke, siehe Ressourcenanzeige
        const ic = g.city[this.team]?.stats?.importCost ?? 0;
        if (ic > 0.005) lines.push(`Einfuhr der Rohwaren: −${fmtDe(fmtRate(ic))} Geld/s (Werke, siehe Ressourcen)`);
        lines.push('Antippen: Marktmenü (mit fertigem Markt)');
      }
      const tip = lines.join('\n');
      if (el.box.title !== tip) el.box.title = tip;
    }
    // Geldanzeige als Knopf zum Marktmenü hervorheben, sobald ein Markt steht
    if (g.city) this.res.money.box.classList.toggle('mk-on', hasMarket(g, this.team));
    // Forschungsknopf leuchtet, solange eine Forschung läuft
    this.researchBtn?.classList.toggle('on', !!t.tech?.cur);
  },

  /** Punktebalken je Team; Eroberung: verbliebene Tickets und gehaltene Flaggen. */
  updatePoints(g, cq) {
    const tickets0 = cq ? (cq.startTickets ?? Math.round(g.winPoints * BALANCE.conquest.ticketMul)) : 0;
    for (let i = 0; i < g.teams.length; i++) {
      const tm = g.teams[i];
      const p = this.pts[i];
      if (cq) {
        // Eroberung: Balken = verbliebene Tickets, dahinter die Zahl der gehaltenen Flaggen
        p.fill.style.width = pct(Math.max(0, tm.tickets) / tickets0);
        p.num.textContent = tm.out ? 'raus' : `${Math.max(0, tm.tickets)} · ${cq.held[i]}⚑`;
      } else {
        p.fill.style.width = pct(tm.points / g.winPoints);
        p.num.textContent = `${tm.points} / ${g.winPoints}`;
      }
    }
  },

  /** Konfliktzone: Besitzer, Zahlen je Team, Flaggenleiste (Eroberung), Zonengeld und der Füllbalken. */
  updateZone(g, t, cq) {
    const z = g.zone;
    let label;
    let col;
    if (z.contested) {
      label = 'umkämpft';
      col = '#e8ece4';
    } else if (z.owner >= 0) {
      label = `Zone: ${BALANCE.teamNames[z.owner]}`;
      col = BALANCE.teamColors[z.owner];
    } else {
      label = 'neutral';
      col = '#9aa596';
    }
    if (cq) {
      label = `Flaggen ${cq.held[this.team]}/${cq.flags.length}`;
      col = BALANCE.teamColors[this.team];
    }
    const cols = BALANCE.teamColors;
    // Eroberung: Buchstaben aller Flaggen in der Farbe des Besitzers (grau = neutral)
    const strip = cq ? `<span class="flag-strip" title="Flaggen: Farbe des Besitzers, grau = neutral">${cq.flags.map((f) => `<b style="color:${f.owner >= 0 ? cols[f.owner] : '#9aa596'}">${f.letter}</b>`).join('')}</span>` : '';
    // Geld des eigenen Teams aus der Zone: je Einheit in der Zone, in der Hot Zone das Doppelte
    const me = this.team;
    const hzCount = g.hot ? g.hot.counts[me] : 0;
    const nCrates = storedCrates(g, me);
    const crateTxt = nCrates ? `, ${nCrates} Kiste${nCrates > 1 ? 'n' : ''}` : '';
    const inc =
      `<span class="zone-inc" title="Geld aus der Konfliktzone (je Einheit ${fmtDe(BALANCE.zone.unitIncome)}/s, in der Hot Zone ${fmtDe(BALANCE.hot.unitIncome)}/s${cq ? `, je Flagge ${fmtDe(BALANCE.conquest.flagIncome)}/s` : ''}) und aus Versorgungskisten (je ${fmtDe(BALANCE.crates.income)}/s)">` +
      `+${fmtRate(t.rate.money)} Geld/s (${z.counts[me]} Einheiten in der Zone, ${hzCount} in der Hot Zone${crateTxt})</span>`;
    this.zoneEl.innerHTML =
      `<span class="zone-state" style="color:${col}">${label}</span>` +
      `<span class="zone-cnt">${perTeam(z.counts)}</span>` +
      (cq ? strip : `<span class="zone-cnt" title="Wertung (Hot Zone doppelt)"><small>Wertung</small> ${perTeam(z.weight)}</span>`) +
      inc;
    const bar = z.bar;
    this.capFill.style.width = pct(bar.p);
    this.capFill.style.background = bar.team >= 0 ? BALANCE.teamColors[bar.team] : 'transparent';
  },

  /** Hot Zone: Besitzer und Zahlen je Team. */
  updateHot(g) {
    const hz = g.hot;
    const hc = hz.contested ? '#e8ece4' : hz.owner >= 0 ? BALANCE.teamColors[hz.owner] : '#9aa596';
    const hl = hz.contested ? 'HOT umkämpft' : hz.owner >= 0 ? `HOT ${BALANCE.teamNames[hz.owner]}` : 'HOT neutral';
    this.hotEl.innerHTML =
      `<span class="zone-state" style="color:${hc}">${hl}</span>` +
      `<span class="zone-cnt">${perTeam(hz.counts)}</span>`;
  },

  /** Sendemast: Restzeit je fertigem Mast (beide Seiten sehen sie). */
  updateRadio(g) {
    const masts = radios(g);
    this.radioEl.hidden = !masts.length;
    if (masts.length === 1) {
      const b = masts[0];
      this.radioEl.innerHTML = `<span class="zone-state" style="color:${BALANCE.teamColors[b.team]}">Sendemast ${BALANCE.teamNames[b.team]}</span><b class="zone-cnt">${fmtTime(radioLeft(b))}</b>`;
    } else if (masts.length) {
      // zwei Masten: je eine kompakte Zeile
      this.radioEl.innerHTML = masts
        .map((b) => `<span class="radio-row" style="color:${BALANCE.teamColors[b.team]}">Mast ${BALANCE.teamNames[b.team]} <b>${fmtTime(radioLeft(b))}</b></span>`)
        .join('');
    }
  },

  /** Uhr und Beschriftung der Knöpfe (Tempo, Pause, Ton, Ansicht). */
  updateClock(g) {
    this.timeEl.textContent = fmtTime(g.time);
    const st = this.app.status ? this.app.status() : { paused: false, speed: 1 };
    this.speedBtn.textContent = `${st.speed}×`;
    this.pauseBtn.textContent = st.paused ? 'Weiter' : 'Pause';
    this.soundBtn.textContent = st.sound === false ? '🔇' : '🔊';
    this.viewBtn.textContent = this.controller.camera.iso ? 'Iso' : '2D';
  },


  /** Wetter in Worten: „Winter, Nebel: Sicht −35 %, Fahrzeuge −10 %“. */
  weatherText() {
    const w = this.game.weather;
    const eff = weatherEffect(w.kind, w.season);
    return `${SEASON_NAMES[w.season]}, ${WEATHER_NAMES[w.kind]}${eff ? `: ${eff}` : ': keine Einschränkung'}`;
  },


  /** Wetteranzeige oben (Symbol und Name; nur neu, wenn sich etwas ändert). */
  updateWeather() {
    const w = this.game.weather;
    if (!this.wxEl || !w?.on) return;
    const key = `${w.season}/${w.kind}`;
    if (key === this.wxKey) return;
    this.wxKey = key;
    this.wxEl.style.color = WX_COLOR[w.kind];
    this.wxEl.title = `${this.weatherText()} (antippen für Details)`;
    this.wxEl.innerHTML =
      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">${WX_ICON[w.kind]}</svg>` +
      `<span class="wx-name"><small>${SEASON_NAMES[w.season]}</small> ${WEATHER_NAMES[w.kind]}</span>`;
  },
};
