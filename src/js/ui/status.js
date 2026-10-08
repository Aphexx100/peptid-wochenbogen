/* Statusleiste unter der Kopfzeile und die Sichtbarkeit der Monatskarte. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { weekNumber, currentWeekKey, weekDays, plusTage } from '../util/date.js';
import { renderWeeklyGate, bogenTag } from './weekly.js';

const kurz = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Leiste zum Wochenwechsel: welche Woche der Bogen gerade bearbeitet. */
function renderWochenwahl() {
  const aktuell = currentWeekKey();
  const keys = Object.keys(state.weeks).sort();
  let frueh = keys[0] || aktuell;
  if (state.cfg.start && state.cfg.start < frueh) frueh = state.cfg.start;
  const tage = weekDays(state.weekKey);
  const laufend = state.weekKey === aktuell;
  $('wwText').textContent = `${kurz(tage[0])}–${kurz(tage[6])}${tage[6].slice(0, 4)}` +
    (laufend ? ' · laufende Woche' : ' · frühere Woche, Korrektur');
  $('wochenWahl').dataset.korrektur = laufend ? '0' : '1';
  $('wwVor').disabled = state.weekKey >= aktuell;
  $('wwZurueck').disabled = plusTage(state.weekKey, -7) < frueh;
  $('wwHeute').hidden = laufend;
}

export function renderStatus() {
  const row = $('statusrow');
  row.innerHTML = '';
  const chip = (t, c) => {
    const s = document.createElement('span');
    s.className = `chip ${c || ''}`;
    s.textContent = t;
    row.appendChild(s);
  };

  const nr = weekNumber(state.weekKey);
  if (nr) chip(`Woche ${nr}`, 'acc');
  chip(`${Object.keys(state.weeks).length} erfasst`);
  chip(state.weeks[state.weekKey] ? 'Woche gespeichert' : 'offen',
       state.weeks[state.weekKey] ? 'good' : 'warn');
  if (state.weekKey !== currentWeekKey()) chip('Korrektur einer früheren Woche', 'warn');
  chip(bogenTag() ? `Fragebogen ${kurz(bogenTag())}` : 'Fragebogen offen',
       bogenTag() ? 'good' : '');

  /* Die Monatsmessung faellt jede vierte Woche an; sichtbar wird sie aber
     erst mit den uebrigen Wochenfragen. */
  const mn = !!nr && nr % 4 === 0;
  $('monthCard').dataset.faellig = mn ? '1' : '0';
  if (mn) chip('Monatsmessung fällig', 'warn');
  renderWeeklyGate();
  renderWochenwahl();
}
