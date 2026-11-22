// Einwilligung zur Besucherstatistik im Startmenü (Regeln: docs/prd/statistik.md): einmal die Frage „Anonyme Spielstatistik
// teilen?“ (Ja/Nein), danach eine Zeile mit An/Aus, jederzeit änderbar. Was erfasst wird, steht aufklappbar darunter.
// Reines DOM; Speicher und Versand in ../telemetry.js. Exporte: consentHtml, wireConsent.
import { getTelemetry } from '../telemetry.js';

const INFO = `<details class="consent-info">
      <summary>Was wird erfasst?</summary>
      <p>Ohne Einwilligung zählt der Server nur, ohne etwas auf deinem Gerät zu speichern: Aufrufe, gestartete und beendete Partien,
      Spielzeit, Spielmodus, Version, grob Gerät und Browser, Fehlermeldungen des Spiels. Besucher erkennt er nur am selben Tag
      (Prüfsumme aus IP-Adresse und Browser mit täglich neuem Schlüssel); die IP-Adresse wird nie gespeichert.</p>
      <p>Mit Einwilligung bekommt dieses Gerät zusätzlich eine zufällige Spieler-ID. Damit sieht man, ob jemand wiederkommt und wie
      lange er insgesamt spielt. Mit Konto gilt dieselbe ID auf allen Geräten (pseudonym). Nein löscht die ID und alle Daten dazu.</p>
      <p>Keine Werbung, keine Dritten, keine fremden Skripte. Rohdaten werden nach 90 Tagen gelöscht, danach bleiben nur Tagessummen.</p>
    </details>`;

/** HTML des Bereichs; c = Einwilligung ('yes' | 'no' | null = noch nicht gefragt). */
export function consentHtml(c) {
  if (c === null) {
    return `<p class="consent-q"><b>Anonyme Spielstatistik teilen?</b> Hilft, das Spiel zu verbessern. Mit Konto pseudonym.</p>
      <div class="seg"><button type="button" data-consent-set="yes">Ja</button><button type="button" data-consent-set="no">Nein</button></div>
      ${INFO}`;
  }
  return `<div class="field">
        <span class="flabel" title="Spieler-ID für Wiederkehr und Spielzeit je Spieler. Aus löscht die ID und die Daten dazu">Spielstatistik teilen</span>
        <div class="seg"><button type="button" data-consent-set="yes" aria-pressed="${c === 'yes'}">An</button><button type="button" data-consent-set="no" aria-pressed="${c === 'no'}">Aus</button></div>
      </div>
      ${INFO}`;
}

/** Bereich `box` füllen und verdrahten. tele: Statistik-Objekt (Standard: getTelemetry()). */
export function wireConsent(box, tele = getTelemetry()) {
  if (!box) return;
  const render = () => {
    const c = tele.consent();
    box.classList.toggle('consent-ask', c === null);
    box.innerHTML = consentHtml(c);
  };
  render();
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent-set]');
    if (!b) return;
    tele.setConsent(b.dataset.consentSet === 'yes');
    render();
  });
}
