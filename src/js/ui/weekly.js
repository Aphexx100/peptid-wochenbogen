/* Freischaltung der Wochenfragen.

   Taeglich erfasst werden Exposition, Confounder und WHO-5. Alles andere —
   Kernbereiche, GLOW-Ziele, Sexualfunktion, Koerpermasse, Pigmentierung,
   Negativkontrollen, Beobachtungsliste, PT-141 — beurteilt eine ganze Woche
   und bleibt deshalb bis zum Erfassungstag verborgen. Das ist kein
   Schoenheitsgriff: wer Wochenfragen mitten in der Woche beantwortet,
   bewertet einen Ausschnitt und nennt ihn Woche.

   Karten tragen dafuer die Klasse `weekly`. Der Erfassungstag steht im Setup
   unter Rahmen; er bestimmt zugleich den Wochenschluessel. Ein verpasster
   Erfassungstag darf die Woche nicht unausfuellbar machen, deshalb gibt es
   den Knopf "Wochenfragen nachtragen" — klein, aber sichtbar, und fuer
   genau eine Woche gueltig. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { istAbschlussTag, iso } from '../util/date.js';

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/* Von Hand geoeffnet — gilt nur fuer genau die Woche, fuer die geklickt
   wurde. Beim Wochenwechsel und beim Aendern des Erfassungstags verfaellt
   die Ausnahme damit von selbst, statt sitzungsweit offen zu bleiben. */
let manuellFuer = null;

const manuell = () => manuellFuer !== null && manuellFuer === state.weekKey;

export const wochenfragenOffen = () => manuell() || istAbschlussTag();

export function renderWeeklyGate() {
  const offen = wochenfragenOffen();
  document.querySelectorAll('.weekly').forEach((el) => {
    /* Karten mit eigener Faelligkeit (PT-141 nur bei Anwendung, Monatskarte
       jede vierte Woche) tragen `data-faellig`. Die Woche schaltet sie
       zusaetzlich frei, statt ihre Bedingung zu ueberstimmen — sonst
       gewinnt schlicht, wer zuletzt gerendert hat. */
    el.hidden = el.dataset.faellig === undefined
      ? !offen
      : !(offen && el.dataset.faellig === '1');
  });

  /* Am Erfassungstag braucht es keinen Knopf — die Fragen sind ohnehin
     offen, und die Statuszeile sagt "Wochenabschluss heute". */
  const bar = $('gateBar');
  if (istAbschlussTag()) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  bar.hidden = false;
  const d = new Date(`${state.weekKey}T12:00:00`);
  const regulaer = `${WTAG[d.getDay()]} ${state.weekKey.slice(8, 10)}.${state.weekKey.slice(5, 7)}.`;
  bar.innerHTML = manuell()
    ? '<span class="gatehint">Wochenfragen von Hand geöffnet</span>' +
      '<button class="btn ghost small" id="gateOpen" type="button">Wochenfragen ausblenden</button>'
    : `<span class="gatehint">regulär am ${regulaer}</span>` +
      '<button class="btn ghost small" id="gateOpen" type="button">Wochenfragen nachtragen</button>';
  $('gateOpen').addEventListener('click', () => {
    manuellFuer = manuell() ? null : state.weekKey;
    renderWeeklyGate();
  });
}

/** Beim Tageswechsel ueber Mitternacht greift die Freischaltung sonst nicht. */
export function initWeeklyGate() {
  let tag = iso(new Date());
  setInterval(() => {
    const jetzt = iso(new Date());
    if (jetzt !== tag) {
      tag = jetzt;
      manuellFuer = null;
      renderWeeklyGate();
    }
  }, 60000);
}
