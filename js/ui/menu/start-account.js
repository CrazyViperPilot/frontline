// Startmenü: Konto-Bereich (KO3). Liest den Rücksprung-Link aus den Mails (einmal), verdrahtet den Bereich mit wireAccount
// und hält Kasse und Spielstand-Liste nach An-/Abmelden aktuell. Exporte: wireStartAccount.
import { matchSync } from '../match.js';
import { initFromLink, takeAccountLink, wireAccount } from './account.js';

/** Konto im Startmenü: `wallet` und `saves` sind createWallet/createSaves aus start-saves.js. */
export function wireStartAccount(root, wallet, saves) {
  // Konto (KO3): Anzeige und Formulare in wireAccount; alle Anfragen gehen an api/auth.php (ui/saves.js), der Webspace wird danach eingestellt
  const link = takeAccountLink(); // Rücksprung von den Mails, einmal gelesen
  const init = initFromLink(link);
  const accBox = root.querySelector('[data-account]');
  const account = wireAccount(accBox, {
    stats: true, // Knopf „Meine Spiele“ (seit v5.158; im Pausenmenü nicht)
    details: true, // Knopf „Konto“ mit Nickname, Premium-Historie und Löschen (seit KO4; im Pausenmenü nicht)
    init,
    /** Nach An- oder Abmelden: Kasse-Anzeige und Spielstand-Liste neu. */
    onChanged: () => {
      wallet.show();
      saves.changed();
    },
    /** Nach dem Anmelden (Webspace ist abgeglichen): Vorrat für gewertete Partien holen, Liste nachladen. */
    onSynced: () => {
      matchSync().then(() => wallet.show());
      saves.changed();
    },
  });
  account.ready.then((u) => {
    if (!accBox?.isConnected) return;
    wallet.setKnown();
    wallet.show();
    if (u) {
      matchSync().then(() => wallet.show()); // Vorrat und wartende Endstände
      saves.changed(); // angemeldet: Stände vom Konto nachladen
    }
  });
}
