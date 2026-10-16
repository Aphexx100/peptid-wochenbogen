/* Eine Leiste mit den sieben Tagen der angezeigten Woche.

   Dasselbe Muster steht inzwischen an drei Stellen: beim WHO-5, beim
   ausfuehrlichen Fragebogen und im Expositionsraster. Dreimal dieselbe
   Schleife mit leicht anderen Details ist dreimal die Gelegenheit, eine
   davon zu vergessen — deshalb hier einmal.

   Die Leiste rendert nur; was ein Klick bedeutet, entscheidet der Aufrufer.
   Vier Zustaende kann ein Tag haben, und sie schliessen sich nicht aus:

     aktiv      der gewaehlte Tag (aria-pressed)
     erfasst    es liegen Daten vor (Punkt oben rechts)
     gesperrt   kuenftiger Tag, nicht waehlbar (disabled)
     heute      heisst "Heute" statt des Datums

   Gebaut wird mit createElement statt innerHTML: die Namen kommen teils aus
   Nutzereingaben, und eine Leiste ist kein Ort fuer Zeichenkettenbasteln. */

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** "Mo 05.10." — kurz genug fuer ein Telefon, eindeutig genug fuer ein Jahr. */
export const tagName = (d) =>
  `${WTAG[new Date(`${d}T12:00:00`).getDay()]} ${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Nur der Wochentag, fuer sehr schmale Leisten. */
export const wochentag = (d) => WTAG[new Date(`${d}T12:00:00`).getDay()];

/**
 * @param {HTMLElement} host      Behaelter, wird geleert
 * @param {object} o
 * @param {string[]} o.tage       Kalendertage, aeltester zuerst
 * @param {string} o.aktiv        gewaehlter Tag
 * @param {string} o.heute        heutiges Datum
 * @param {(d:string)=>boolean} [o.erfasst]
 * @param {(d:string)=>boolean} [o.gesperrt]
 * @param {(d:string)=>string} [o.id]   Knopf-Id, fuer Tests und Fokus
 * @param {(d:string, i:number)=>void} o.onWahl
 */
export function tagleiste(host, o) {
  if (!host) return;
  host.textContent = '';
  o.tage.forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (o.id) b.id = o.id(d, i);
    b.textContent = d === o.heute ? 'Heute' : tagName(d);
    b.disabled = o.gesperrt ? !!o.gesperrt(d) : false;
    b.setAttribute('aria-pressed', d === o.aktiv ? 'true' : 'false');
    if (o.erfasst && o.erfasst(d)) b.dataset.erfasst = '1';
    b.addEventListener('click', () => o.onWahl(d, i));
    host.appendChild(b);
  });
}
