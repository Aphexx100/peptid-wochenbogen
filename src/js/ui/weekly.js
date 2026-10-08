/* Der ausfuehrliche Fragebogen und wann er sichtbar ist.

   Taeglich erfasst werden Exposition, Zufuhr, Confounder und WHO-5. Alles
   andere — Kernbereiche, GLOW-Ziele, Sexualfunktion, Koerpermasse,
   Pigmentierung, Negativkontrollen, Beobachtungsliste, PT-141 — beurteilt
   einen laengeren Zeitraum und steht deshalb nicht im taeglichen Weg.

   Frueher war dieser Teil an den Erfassungstag gebunden. Das setzt voraus,
   dass an genau diesem Tag Zeit ist; ist sie es nicht, faellt die Woche aus.
   Jetzt entscheidet der Knopf: "Ausführlichen Fragebogen für heute
   erstellen". Ein unregelmaessig, aber ehrlich ausgefuellter Bogen ist mehr
   wert als ein Pflichttermin, der ausfaellt.

   Karten tragen dafuer die Klasse `weekly`. Sichtbar sind sie, sobald der
   Knopf geklickt wurde oder die angezeigte Woche schon einen Fragebogen
   traegt (`bogenTag` im gespeicherten Eintrag). */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { iso } from '../util/date.js';

/* Von Hand geoeffnet — gilt nur fuer genau die Woche, fuer die geklickt
   wurde. Beim Wochenwechsel verfaellt die Oeffnung damit von selbst. */
let manuellFuer = null;

const manuell = () => manuellFuer !== null && manuellFuer === state.weekKey;

/** Datum des Fragebogens dieser Woche, falls einer gespeichert ist. */
export function bogenTag() {
  const e = state.weeks[state.weekKey];
  return (e && e.bogenTag) || '';
}

export const wochenfragenOffen = () => manuell() || !!bogenTag();

const kurz = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

export function renderWeeklyGate() {
  const offen = wochenfragenOffen();
  document.querySelectorAll('.weekly').forEach((el) => {
    /* Karten mit eigener Faelligkeit (PT-141 nur bei Anwendung, Monatskarte
       jede vierte Woche) tragen `data-faellig`. Der Fragebogen schaltet sie
       zusaetzlich frei, statt ihre Bedingung zu ueberstimmen — sonst
       gewinnt schlicht, wer zuletzt gerendert hat. */
    el.hidden = el.dataset.faellig === undefined
      ? !offen
      : !(offen && el.dataset.faellig === '1');
  });

  const bar = $('gateBar');
  bar.hidden = false;
  const tag = bogenTag();
  const hinweis = tag
    ? `Fragebogen vom ${kurz(tag)}`
    : 'ohne Fragebogen — nur Tageswerte';
  bar.innerHTML = `<span class="gatehint">${hinweis}</span>` +
    `<button class="btn ghost small" id="gateOpen" type="button">${
      offen ? 'Fragebogen ausblenden' : 'Ausführlichen Fragebogen für heute erstellen'
    }</button>`;
  $('gateOpen').addEventListener('click', () => {
    manuellFuer = offen ? null : state.weekKey;
    renderWeeklyGate();
  });
}

/** Beim Tageswechsel ueber Mitternacht stimmt das Datum sonst nicht mehr. */
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
