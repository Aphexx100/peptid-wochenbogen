/* Wann recherchiert wird und wie ein Lauf ablaeuft.

   Faellig ist ein Stoff, dessen Eintrag aelter als eine Woche ist oder der
   noch nie recherchiert wurde. Geprueft wird beim Start, gelaufen wird auf
   Knopfdruck: ein Lauf kostet Geld und dauert Minuten, und beides gehoert
   nicht in einen Seitenaufruf, von dem der Nutzer nichts weiss.

   Ein Lauf arbeitet die faelligen Stoffe **nacheinander** ab. Parallel waere
   schneller und liefe in die Ratenbegrenzung; ausserdem laesst sich so nach
   jedem Stoff speichern, und ein Abbruch in der Mitte verliert nur den
   laufenden statt aller.

   Dieses Modul kennt kein DOM. Es meldet seinen Fortschritt ueber Rueckrufe,
   damit die Oberflaeche entscheidet, wie sie ihn zeigt. */

import { ask, aiRecherchiert } from '../ai/index.js';
import { stoffe } from '../substanzen.js';
import { saveWissen, saveNews } from '../storage/index.js';
import { leererEintrag, faellig } from './modell.js';
import { promptStoff, parseWissen } from './recherche.js';
import { fuegeNews } from './news.js';

/** Wie viele Zeichen eine Antwort hoechstens haben darf. Recherche braucht
    mehr Luft als eine Analyse — aber nicht unbegrenzt. */
const MAX_TOKENS = 4000;

/** Welche Stoffe eine Auffrischung brauchen. */
export function faelligeStoffe(wissen) {
  return stoffe().filter((x) => faellig(wissen[x.k]));
}

/**
 * Einen Stoff recherchieren und den Eintrag zurueckgeben. Speichert nicht —
 * das entscheidet der Aufrufer, damit ein Fehlschlag nichts ueberschreibt.
 */
export async function recherchiereStoff(stoff, bisher, opts = {}) {
  const e = bisher || leererEintrag(stoff);
  const antwort = await ask(promptStoff(stoff, e), {
    recherche: true,
    maxTokens: MAX_TOKENS,
    signal: opts.signal,
    onSuche: opts.onSuche
  });
  const neu = parseWissen(antwort.text);
  return {
    ...e,
    n: stoff.n,
    kat: stoff.kat,
    stand: new Date().toISOString(),
    abschnitte: neu.abschnitte,
    quellen: neu.quellen,
    news: neu.news
  };
}

/**
 * Alle faelligen Stoffe der Reihe nach. Gibt zurueck, was gelungen ist und
 * was nicht — ein gescheiterter Stoff haelt die uebrigen nicht auf.
 *
 * @param {object} wissen   bisheriger Bestand, Schluessel ist der Stoff
 * @param {any[]} news      bisherige Newsliste
 * @param {object} opts     { signal, onStoff(name, i, ges), onSuche() }
 */
export async function laufe(wissen, news, opts = {}) {
  if (!aiRecherchiert()) {
    throw new Error('Die aktive Analysequelle kann nicht im Netz nachschlagen.');
  }
  const offen = faelligeStoffe(wissen);
  const fertig = [];
  const fehler = [];
  let liste = news;

  for (let i = 0; i < offen.length; i += 1) {
    const stoff = offen[i];
    if (opts.signal && opts.signal.aborted) break;
    if (opts.onStoff) opts.onStoff(stoff.n, i, offen.length);
    try {
      // eslint-disable-next-line no-await-in-loop
      const e = await recherchiereStoff(stoff, wissen[stoff.k], opts);
      wissen[stoff.k] = e;
      liste = fuegeNews(liste, e);
      // eslint-disable-next-line no-await-in-loop
      await saveWissen(e);
      fertig.push(stoff.n);
    } catch (err) {
      fehler.push(`${stoff.n}: ${err.message || 'Fehler'}`);
    }
  }
  if (fertig.length) await saveNews(liste);
  return { fertig, fehler, news: liste, offen: offen.length };
}
