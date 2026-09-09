/* Freischaltung der Wochenfragen.

   Taeglich erfasst werden Exposition, Confounder, WHO-5 und IIEF-5. Alles
   andere — Kernbereiche, GLOW-Ziele, Koerpermasse, Pigmentierung,
   Negativkontrollen, Beobachtungsliste, PT-141 — beurteilt eine ganze Woche
   und bleibt deshalb bis zum Erfassungstag verborgen. Das ist kein
   Schoenheitsgriff: wer Wochenfragen mitten in der Woche beantwortet,
   bewertet einen Ausschnitt und nennt ihn Woche.

   Karten tragen dafuer die Klasse `weekly`. Der Erfassungstag steht im Setup
   unter Rahmen; er bestimmt zugleich den Wochenschluessel. Ein verpasster
   Erfassungstag darf die Woche nicht unausfuellbar machen, deshalb gibt es
   den Knopf "trotzdem ausfüllen" — bewusst als Ausnahme sichtbar, statt
   still im Hintergrund. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { istAbschlussTag, iso } from '../util/date.js';

const WTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/* Von Hand geoeffnet — gilt nur fuer genau die Woche, fuer die geklickt
   wurde. Beim Wochenwechsel und beim Aendern des Erfassungstags verfaellt
   die Ausnahme damit von selbst, statt sitzungsweit offen zu bleiben. */
let manuellFuer = null;

const manuell = () => manuellFuer !== null && manuellFuer === state.weekKey;

export const wochenfragenOffen = () => manuell() || istAbschlussTag();

/** Tage bis zum naechsten Erfassungstag; 0 heisst heute. */
function tageBis() {
  const heute = new Date();
  heute.setHours(12, 0, 0, 0);
  const ziel = new Date(`${state.weekKey}T12:00:00`);
  return Math.round((ziel - heute) / 86400000);
}

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

  const note = $('weeklyNote');
  note.hidden = false;
  const tage = tageBis();
  const wtag = WTAG_LANG[new Date(`${state.weekKey}T12:00:00`).getDay()];

  if (offen) {
    note.className = 'card gate open';
    note.innerHTML =
      `<h2><span class="step">✓</span> Wochenabschluss — ${wtag}, ${state.weekKey}</h2>` +
      '<p class="hint" style="margin-bottom:0">Die Wochenfragen sind freigeschaltet: Kernbereiche, GLOW-Ziele, ' +
      'Körpermaße, Pigmentierung, Negativkontrollen und die Beobachtungsliste. Beantworte sie für die ' +
      '<strong>ganze zurückliegende Woche</strong>, nicht für heute — und sieh vorher nicht in die Auswertung, ' +
      'sonst bewertest du die Differenz zur Vorwoche statt den Zustand.' +
      (manuell() && !istAbschlussTag()
        ? ' <em>Von Hand geöffnet — der eigentliche Erfassungstag ist ein anderer.</em>'
        : '') +
      '</p>';
    return;
  }

  note.className = 'card gate';
  note.innerHTML =
    '<h2><span class="step">·</span> Wochenfragen noch geschlossen</h2>' +
    `<p class="hint">Heute zählen nur die Tagesfelder: Exposition, Confounder, Wohlbefinden und Sexualfunktion. ` +
    `Die Wochenfragen öffnen am <strong>${wtag}, ${state.weekKey}</strong> — ` +
    `${tage === 1 ? 'also morgen' : `noch ${tage} Tage`}.</p>` +
    '<div class="btnrow"><button class="btn ghost" id="gateOpen">Trotzdem ausfüllen</button></div>' +
    '<p class="hint" style="margin:.6rem 0 0"><em>Nur für den Fall, dass du den Erfassungstag verpasst hast. ' +
    'Sonst gilt: ein fester Tag pro Woche ist der halbe Wert dieses Bogens.</em></p>';
  $('gateOpen').addEventListener('click', () => {
    manuellFuer = state.weekKey;
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
