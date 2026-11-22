// Rückmeldung (Feedback) im Pausenmenü und auf dem Endbildschirm (Regeln: docs/prd/statistik.md): Knopf „Feedback geben“
// klappt ein Formular auf (Text bis 1000 Zeichen, optional Daumen hoch/runter). Angehängt werden Version, Partiedauer und
// Modus (../telemetry.js). Reines DOM. Exporte: feedbackHtml, wireFeedback, FEEDBACK_MAX.
import { getTelemetry } from '../telemetry.js';

export const FEEDBACK_MAX = 1000;

/** HTML des Bereichs (zugeklappt). */
export function feedbackHtml() {
  return `<div class="feedback" data-feedback>
      <button type="button" data-fb="open">Feedback geben</button>
      <div class="fb-form" data-fbform hidden>
        <textarea maxlength="${FEEDBACK_MAX}" rows="4" data-fbtext aria-label="Deine Rückmeldung" placeholder="Was gefällt dir, was stört, was fehlt?"></textarea>
        <div class="seg fb-thumbs"><button type="button" data-fbthumb="1" aria-pressed="false" title="Gefällt mir">👍</button><button type="button" data-fbthumb="-1" aria-pressed="false" title="Gefällt mir nicht">👎</button></div>
        <p class="muted small">Angehängt: Version, Partiedauer, Modus. <span data-fbcount>0</span>/${FEEDBACK_MAX}</p>
        <div class="row2"><button type="button" class="primary" data-fb="send">Senden</button><button type="button" data-fb="close">Abbrechen</button></div>
        <p class="small" data-fbmsg></p>
      </div>
    </div>`;
}

/** Bereich in `root` verdrahten (sucht [data-feedback]). place: 'pause' | 'end'. tele: Statistik-Objekt. */
export function wireFeedback(root, place, tele = getTelemetry()) {
  const box = root?.querySelector('[data-feedback]');
  if (!box) return;
  const form = box.querySelector('[data-fbform]');
  const text = box.querySelector('[data-fbtext]');
  const msg = box.querySelector('[data-fbmsg]');
  let thumb = null;
  const markThumb = () => box.querySelectorAll('[data-fbthumb]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.fbthumb) === thumb)));
  text.addEventListener('input', () => {
    box.querySelector('[data-fbcount]').textContent = String(text.value.length);
  });
  box.addEventListener('click', async (e) => {
    e.stopPropagation(); // nicht an die Klicks des Menüs (Pause schließt sonst bei data-act)
    const t = e.target.closest('[data-fbthumb]');
    if (t) {
      const v = Number(t.dataset.fbthumb);
      thumb = thumb === v ? null : v;
      return markThumb();
    }
    const b = e.target.closest('[data-fb]');
    if (!b) return;
    if (b.dataset.fb === 'open') {
      form.hidden = !form.hidden;
      if (!form.hidden) text.focus();
    } else if (b.dataset.fb === 'close') {
      form.hidden = true;
    } else if (b.dataset.fb === 'send' && !b.disabled) {
      const value = text.value.trim();
      if (!value && thumb === null) {
        msg.textContent = 'Bitte einen Text schreiben oder einen Daumen wählen.';
        msg.className = 'small bad';
        return;
      }
      b.disabled = true;
      msg.className = 'small muted';
      msg.textContent = 'Sende …';
      try {
        await tele.feedback({ text: value, thumb, place });
        form.hidden = true;
        box.querySelector('[data-fb="open"]').hidden = true;
        const done = document.createElement('p');
        done.className = 'small good';
        done.textContent = 'Danke für deine Rückmeldung!';
        box.append(done);
      } catch (err) {
        msg.className = 'small bad';
        msg.textContent = err.message;
      } finally {
        b.disabled = false;
      }
    }
  });
}
