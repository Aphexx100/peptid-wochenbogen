/* Waehlt die verfuegbare Analysequelle und bietet eine gemeinsame Schnittstelle.

   Im Claude-Viewer ist das die Sampling-Faehigkeit des Artifacts, auf GitHub
   Pages die Anthropic-API mit eigenem Schluessel. Ist keine von beiden da,
   bleibt der Datenblock trotzdem einsehbar — er entsteht lokal.

   Eine weitere Quelle anzubinden heisst: ein Modul mit init() und ask()
   schreiben und es hier in die Liste eintragen. */

import { claudeAi } from './claude-sample.js';
import { anthropicAi } from './anthropic.js';

let aktiv = null;

export async function initAi() {
  for (const k of [claudeAi, anthropicAi]) {
    // eslint-disable-next-line no-await-in-loop
    if (await k.init()) {
      aktiv = k;
      return k;
    }
  }
  aktiv = null;
  return null;
}

export const aiAktiv = () => aktiv;

/** Kann die aktive Quelle waehrend der Antwort im Netz nachschlagen? */
export const aiRecherchiert = () => !!(aktiv && aktiv.kannRecherchieren);

export function ask(prompt, opts) {
  if (!aktiv) throw Object.assign(new Error('keine Analysequelle'), { code: 'not_declared' });
  return aktiv.ask(prompt, opts);
}

/** Fehlercodes in Saetze uebersetzen, die dem Anwender etwas sagen.
    `detail` ist die Meldung der Gegenstelle; sie sagt bei unbekannten
    Fehlern mehr als jeder Satz, den wir uns hier ausdenken koennten. */
export function errCopy(code, detail) {
  switch (code) {
    case 'no_credit':
      return 'Das API-Guthaben ist aufgebraucht. Zwei Wege: aufladen unter '
        + 'console.anthropic.com → Plans & Billing, oder in Claude Code auffrischen lassen — '
        + 'dort zahlt das Abo. API-Guthaben und claude.ai-Abo sind getrennte Konten, '
        + 'ein Abo schaltet keine API frei.';
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
      return 'Analyse für dieses Konto nicht freigegeben.';
    case 'rate_limited':
      return 'Zu viele Anfragen. Später noch einmal versuchen.';
    case 'session_expired':
      return 'Bitte neu bei Claude anmelden.';
    case 'prompt_too_large':
      return 'Zu viele Daten auf einmal. Weniger Wochen auswerten.';
    case 'cancelled':
      return '';
    case 'refused':
      return 'Die Anfrage wurde nicht beantwortet. Formuliere sie anders.';
    case 'empty_completion':
      return 'Keine Antwort erhalten. Anfrage kürzer fassen.';
    default:
      return detail
        ? `Unterbrochen: ${String(detail).slice(0, 300)}`
        : 'Unterbrochen. Du kannst es erneut versuchen.';
  }
}
