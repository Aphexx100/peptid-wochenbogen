/* Statusleiste unter der Kopfzeile und die Sichtbarkeit der Monatskarte. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { weekNumber } from '../util/date.js';

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
  chip(state.weeks[state.weekKey] ? 'diese Woche gespeichert' : 'offen',
       state.weeks[state.weekKey] ? 'good' : 'warn');

  /* Die Monatsmessung faellt jede vierte Woche an. */
  const mn = !!nr && nr % 4 === 0;
  $('monthCard').hidden = !mn;
  if (mn) chip('Monatsmessung fällig', 'warn');
}
