/* Der Newsticker im Bogen.

   Eine Karte, die zeigt, was seit der letzten Auffrischung dazugekommen ist
   — kurz, mit Datum, Stoff und einem Link zur Quelle. Mehr als ein paar
   Zeilen waeren hier falsch: der Bogen ist zum Eintragen da, nicht zum
   Lesen. Wer mehr will, geht in den Reiter Wissen.

   Jede Meldung ist anklickbar und oeffnet ihre Quelle in einem neuen Tab.
   `rel="noopener noreferrer"` ist dabei keine Formsache: die Adressen
   stammen aus einer Recherche im Netz, nicht aus dieser Anwendung. */

import { $ } from '../util/dom.js';
import { newsDatum } from '../wissen/news.js';

/** So viele Meldungen zeigt der Ticker im Bogen. */
const SICHTBAR = 5;

let alle = [];
let offen = false;

function zeile(n) {
  const li = document.createElement('li');

  const kopf = document.createElement('div');
  kopf.className = 'news-kopf';
  const d = newsDatum(n);
  if (d) {
    const dat = document.createElement('span');
    dat.className = 'news-datum';
    dat.textContent = d;
    kopf.appendChild(dat);
  }
  if (n.stoffName) {
    const st = document.createElement('span');
    st.className = 'news-stoff';
    st.textContent = n.stoffName;
    kopf.appendChild(st);
  }
  li.appendChild(kopf);

  const a = document.createElement('a');
  a.href = n.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'news-titel';
  a.textContent = n.titel;
  li.appendChild(a);

  if (n.kurz) {
    const p = document.createElement('p');
    p.className = 'news-kurz';
    p.textContent = n.kurz;
    li.appendChild(p);
  }
  if (n.quelle) {
    const q = document.createElement('span');
    q.className = 'news-quelle';
    q.textContent = n.quelle;
    li.appendChild(q);
  }
  return li;
}

function zeichne() {
  const host = $('newsListe');
  if (!host) return;
  host.textContent = '';
  const zeigen = offen ? alle : alle.slice(0, SICHTBAR);
  zeigen.forEach((n) => host.appendChild(zeile(n)));

  const mehr = $('newsMehr');
  if (mehr) {
    mehr.hidden = alle.length <= SICHTBAR;
    mehr.textContent = offen ? 'weniger' : `alle ${alle.length} zeigen`;
  }
}

/** Den Ticker mit einer Newsliste fuellen. Leer heisst: Karte verschwindet. */
export function renderTicker(liste) {
  alle = liste || [];
  const karte = $('newsKarte');
  if (karte) karte.hidden = !alle.length;
  zeichne();
}

export function initTicker() {
  const mehr = $('newsMehr');
  if (!mehr) return;
  mehr.addEventListener('click', () => {
    offen = !offen;
    zeichne();
  });
}
