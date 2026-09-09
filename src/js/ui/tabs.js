/* Tab-Umschaltung. Die Auswertung rechnet erst beim Oeffnen, damit das
   Eintragen auch mit vielen Wochen fluessig bleibt. */

import { $ } from '../util/dom.js';
import { renderAus } from '../analysis/report.js';

export function initTabs() {
  const tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((o) => {
        const on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        $(o.getAttribute('aria-controls')).hidden = !on;
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (t.id === 'tab-aus') renderAus();
    });
  });
}
