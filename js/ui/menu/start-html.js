// Startmenü: das HTML (reine Textfunktionen, keine Ereignisse). startHtml() liefert den ganzen Dialog mit allen Schaltergruppen,
// howtoHtml() die Spielhinweise darin. Die Knöpfe (data-…) verdrahtet start.js; ihr Zustand kommt aus start-state.js.
// Exporte: startHtml.
import { BALANCE } from '../../data/balance.js';
import { GAME_VERSION } from '../../version.js';
import { WEATHER_SETTINGS } from '../../game/weather.js';
import { MOOD_SETTINGS } from '../../render/mood.js';
import { loadLevel } from '../../audio/sound.js';
import { DIFFS, MOOD_LABELS, POINTS, WEATHER_LABELS, volRow } from './common.js';

/** Die Spielhinweise (nummerierte Liste) am Ende des Startmenüs. */
function howtoHtml() {
  return `<ol class="howto">
        <li>Du startest mit 2 Kampfpanzern, 3 Schützenpanzern, 29 Soldaten (22 Schützen, 7 Panzerabwehrsoldaten), 3 LKW, Baufahrzeug und deinem Kommandeur (goldener Stern: ` +
        `in seiner Nähe schießen deine Einheiten schneller und Verwundete heilen; fällt er, bekommt der Gegner 5 Punkte; in der Eroberung verliert dein Team 5 Tickets). ` +
        `Das Einheitenlimit beträgt klassisch ${BALANCE.slotCap} Plätze, in der Eroberung ${BALANCE.conquest.slotCap[2]} je Team: Soldat 1, Schützenpanzer 3, Kampfpanzer 5, ` +
        `Flakpanzer und SAM-Startrampe 2. Die Hauptstadt bildet keine Einheiten aus: Das machen Kaserne, Fabrikhalle und Heliport der Stadt (Geld, Fahrzeuge auch Stahl, je Einheit Einwohner). Sie heilen bzw. ` +
        `reparieren auch Einheiten in ihrer Nähe; ein Krankenhaus heilt Soldaten im Umkreis von 3 Feldern. Alle Einheiten sind von Anfang an frei. Ist oben Forschung an, ` +
        `verbessert der Forschungsbaum (U) sie in 10 Stufen: mehr Reichweite, Panzerung, Tempo, Treibstoff-Reichweite und mehr.</li>
        <li>LKW (E) bringen Nachschub aus der Hauptstadt zu den vorderen FOBs und versorgen Einheiten in ihrer Nähe.</li>
        <li>FOB-Fahrzeug (B): fahr es an die Front und drück Aufbauen (D), dann steht sofort eine neue FOB mit 20 % Lager (bis zu 10 FOBs, ohne überlappende Bauradien).</li>
        <li>Baufahrzeug (R): Mörser, Flak, Phalanx (Nahbereichsschutz gegen Hubschrauber und Mörsergranaten, Reichweite halber FOB-Radius, 2 min Bauzeit, ` +
        `frisst Munition und Geld) und Bohrer. ` +
        `Soldaten bauen aus wenig getragenem Baumaterial Mauern und Tore (ein Tor ist 2 Felder breit) und überall Sandsack-Stellungen (Deckung, Baumenü G).</li>
        <li>Ist oben Fluss an, liegt vor den Startecken von Blau und Rot ein Fluss: über drei Brücken oder langsam durch zwei Furten. Brücken lassen sich sprengen (A, ` +
        `dann Brücke anklicken) und von Baufahrzeugen wieder aufbauen.</li>
        <li>Einfuhr: Rohmaterial, Eisen, Öl und Sprengstoff kommen von außerhalb der Karte und kosten Geld je angekommener Einheit; sie werden nicht gelagert. ` +
        `Einfuhrpunkte sind eine eigene Straße am Kartenrand oder ein Güterbahnhof, der über eine Gleiskette bis an den Rand angeschlossen ist. ` +
        `Jedes Werk holt sich seine Rohwaren beim nächsten Einfuhrpunkt über Straßen; ohne Einfuhrpunkt erzeugt es nichts. Der Markt hilft nur bei fertigen Waren.</li>
        <li>Werke, Wohnen und Gewerbe liegen an Straßen. Rohwaren fahren zu den Werken, Produkte zum Lager der Hauptstadt; ohne Straße keine Lieferung. ` +
        `Straßen können voll werden (Stau: gelb, rot), dann kommen Waren und Pendler langsamer. Fahrzeuge, Reparaturen und Munition brauchen Stahl; ` +
        `Gewerbe braucht Baumaterial vom Lager. F-16 tanken Kerosin am Kerosintank des Fliegerhorsts, Hubschrauber gelandet auf ihrem Heliport (ein Hubschrauber je Heliport, ` +
        `Kerosintank und Munitionslager in der Nähe). Jets mit Luft-Luft-Waffe stehen in Alarmbereitschaft (Taste Q): Sie starten von selbst gegen feindliche Flugzeuge am Fliegerhorst.</li>
        <li>Spielstände: Die Liste oben zeigt alle Partien (Spielzeit, Punkte, Schwierigkeit, Version); je Zeile laden, umbenennen oder löschen. ` +
        `Beendete Partien bleiben zum Ansehen in der Liste.</li>
        <li>Konto (oben, optional): Ohne Konto bleiben Spielstände auf diesem Gerät, und jede Partie startet mit dem Startbetrag und zählt nicht für eine Kasse. ` +
        `Anmelden und Abmelden geht auch im Pausenmenü (P): Die laufende Partie bleibt, wie sie begonnen hat; ` +
        `eine gewertete Partie lässt sich dort erst nach dem Endstand wechseln. Mit Konto (E-Mail und Passwort, ` +
        `Bestätigung per Mail) liegen Spielstände und die Kasse (Geld von Runde zu Runde) auf dem Server und sind nach dem Anmelden auf jedem Gerät da. ` +
        `Eine Partie zählt für die Kasse, wenn der Server sie begonnen hat: Er gibt bis zu 3 Tokens auf Vorrat aus, auch für Partien ohne Netz. ` +
        `Ohne Token läuft die Partie ungewertet. Ein Token wird erst mit dem Endstand verbraucht: Eine abgebrochene Partie kostet keins. ` +
        `Ein gespeicherter Stand bleibt auf diesem Gerät gewertet, solange sein Token im Vorrat ist.</li>
        <li>Eroberung: 16 Flaggen (A bis P) in der Konfliktzone (feste Karten wie East Europe Railway: eigene Flaggen, Baugebiete an den Kartenseiten). Wer im Gebiet einer Flagge die meisten Einheiten hat, nimmt sie ein. Wer weniger Flaggen hält als der Führende, ` +
        `verliert Tickets; ohne Tickets scheidet man aus. Fremde Viertel sind gesperrt. Hält ein Team ${Math.round(BALANCE.conquest.lockGrace / 60)} min lang keine Flagge, ` +
        `während ein anderes eine hält, ist sein Viertel für den Rest der Partie offen. Kein kostenloser Nachschub: Truppen kosten Geld. Kaserne und Fabrikhalle: ` +
        `im Infofeld wählen, ob neue Einheiten am Gebäude oder an einer eigenen Flagge erscheinen.</li>
        <li>Klassisch: Konfliktzone halten: jede deiner Einheiten dort bringt Geld (0,4/s, in der Hot Zone 0,8/s), alle ${BALANCE.pointInterval} s ein Punkt. ` +
        `Fällt deine Hauptstadt, ist die Runde verloren.</li>
      </ol>`;
}

/** Das ganze Startmenü (Abschnitt „menu start“). */
export function startHtml() {
  const TIX = BALANCE.conquest.ticketChoices;
  return `<section class="menu start">
      <h1 class="logo">FRONTLINE</h1>
      <section class="account" data-account aria-label="Konto"></section>
      <div class="resume" data-resume hidden></div>
      <section class="saves" data-saves hidden>
        <h3>Spielstände</h3>
        <ul class="save-list" data-savelist></ul>
      </section>
      <p class="tag">Echtzeit-Strategie · Einheiten an die Front bringen, versorgen und die Konfliktzone halten</p>
      <div class="field">
        <span class="flabel" title="Eroberung: 16 Flaggen in der Konfliktzone, Tickets, bis zu 4 Spieler, jeder gegen jeden. Klassisch: Punktebalken, ein Gegner">Modus</span>
        <div class="seg"><button type="button" data-cq="1">Eroberung</button><button type="button" data-cq="0">Klassisch</button></div>
      </div>
      <div class="field" data-oppfield>
        <span class="flabel">Computergegner</span>
        <div class="seg">${[1, 2, 3].map((n) => `<button type="button" data-opp="${n}">${n}</button>`).join('')}</div>
      </div>
      ${[1, 2, 3]
        .map(
          (i) => `<div class="field" data-opprow="${i}">
        <span class="flabel" style="color:${BALANCE.teamColors[i]}">${BALANCE.teamNames[i]}</span>
        <div class="seg">${DIFFS.map(([k, l]) => `<button type="button" data-od="${i}:${k}">${l}</button>`).join('')}</div>
      </div>`,
        )
        .join('')}
      <div class="field" data-tixfield>
        <span class="flabel" title="Eroberung: wer weniger Flaggen hält als der Führende, verliert Tickets; ${TIX[TIX.length - 1]} für lange Partien">Tickets</span>
        <div class="seg">${TIX.map((n) => `<button type="button" data-tix="${n}">${n}</button>`).join('')}</div>
      </div>
      <div class="field" data-ptsfield>
        <span class="flabel">Siegpunkte</span>
        <div class="seg">${POINTS.map((p) => `<button type="button" data-pts="${p}">${p}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Jahreszeit und wechselndes Wetter: Regen, Nebel und Schnee senken die Sicht, Schnee bremst Fahrzeuge">Wetter</span>
        <div class="seg">${WEATHER_SETTINGS.map((k) => `<button type="button" data-weather="${k}">${WEATHER_LABELS[k]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Lichtstimmung über der Karte: Morgen, Tag, Abend oder Nacht (nur Optik, ändert nichts am Spiel). Zufall wählt passend zur Jahreszeit">Licht</span>
        <div class="seg">${MOOD_SETTINGS.map((k) => `<button type="button" data-mood="${k}">${MOOD_LABELS[k]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Forschungsbaum in der Hauptstadt: 10 Stufen mit Verbesserungen je Einheit (Reichweite, Panzerung, Tempo, Treibstoff …); ` +
        `alle Einheiten sind auch ohne Forschung frei">Forschung</span>
        <div class="seg"><button type="button" data-research="1">An</button><button type="button" data-research="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Baugebiet der Stadt: Stadtgebäude nur im eigenen Gebiet (um die Hauptstadt, FOBs und Gebäude), nur auf erkundetem Gelände, ` +
        `nicht nahe sichtbaren Feinden und nicht in der Konfliktzone; Straßen dürfen auch außerhalb liegen. ` +
        `Aus: überall bauen wie bisher (Eroberung: immer nur im eigenen Viertel)">Baugebiet</span>
        <div class="seg"><button type="button" data-build="1">An</button><button type="button" data-build="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Zufallskarten: je ein Fluss vor den Startecken von Blau und Rot (mit 3 oder 4 Spielern in der Eroberung nur diese beiden) mit drei zerstörbaren ` +
        `Brücken und zwei Furten">Fluss</span>
        <div class="seg"><button type="button" data-river="1">An</button><button type="button" data-river="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Scharf: Bild mit der vollen Pixeldichte des Geräts (höchstens 2×). Leistung: 1× Pixel, schont schwache Geräte; Schärfe nimmt ab. Im Spiel: ` +
        `Pausenmenü">Bildauflösung</span>
        <div class="seg"><button type="button" data-lowres="0">Scharf</button><button type="button" data-lowres="1">Leistung</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Schüsse, Explosionen, Fahrzeuge, Wetter und Meldungen; selbst erzeugt, ohne Dateien. Im Spiel: Taste F2 oder der Lautsprecher-Knopf oben">Ton</span>
        <div class="seg"><button type="button" data-sound="1">An</button><button type="button" data-sound="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Lautstärke der Schüsse, Explosionen, Fahrzeuge und Meldungen; wirkt sofort">Geräusche</span>
        ${volRow('sfx', loadLevel('sfx'))}
      </div>
      <div class="field">
        <span class="flabel" title="Hintergrundmusik, selbst erzeugt: ruhig im Frieden, Trommeln und Bass im Gefecht; wirkt sofort">Musik</span>
        ${volRow('music', loadLevel('music'))}
      </div>
      <div class="field" data-fsbox hidden>
        <span class="flabel" title="Ohne Status- und Navigationsleiste spielen. Installiert startet Frontline von selbst im Vollbild">Vollbild</span>
        <div class="seg"><button type="button" data-fs="1">An</button><button type="button" data-fs="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel">Karte</span>
        <div class="seg">
          <button type="button" data-mapmode="random">Zufall</button>
          <button type="button" data-mapmode="fixed">Feste Karten</button>
          <button type="button" data-mapmode="saved">Gespeichert</button>
          <button type="button" data-mapmode="new">Neue Karte</button>
        </div>
        <div class="mapbox" data-mapbox></div>
      </div>
      ${howtoHtml()}
      <p class="muted small center" data-wallet></p>
      <button type="button" class="primary" data-act="start">Start</button>
      <p class="muted small center">Alle Tasten zeigt F1 im Spiel.</p>
      <p class="muted small center menu-version" title="Ausgelieferte Version (steigt mit jedem Release; so sieht man, ob ein Deploy durch ist)">Version ${GAME_VERSION}</p>
    </section>`;
}
