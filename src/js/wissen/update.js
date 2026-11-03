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

/** Ausgabebudget einer Recherche. Sieben Abschnitte, bis zu zehn Quellen und
    drei Meldungen passten nicht in 4000 Token: die Antwort brach mitten im
    JSON ab, und bis das geflickt wurde, war ein Lauf reihenweise mit
    "Expected ',' or '}'" gescheitert. Das Modell hoert von selbst auf, wenn
    es fertig ist — ein hohes Budget kostet also nichts, solange der Prompt
    um Kuerze bittet. Es verhindert nur, dass die Grenze in die Mitte eines
    Satzes fallen kann. */
const MAX_TOKENS = 16000;

/** So oft wird ein Stoff versucht. Netzaussetzer und eine Antwort ohne
    JSON sind beides Zufall; beim zweiten Anlauf ist der Zufall meist
    vorbei. Mehr als zwei Versuche waeren bezahlte Hoffnung. */
const VERSUCHE = 2;

/** Fehler, bei denen ein zweiter Anlauf Sinn hat. Leeres Guthaben und ein
    fehlender Schluessel aendern sich durch Wiederholung nicht. */
const NOCHMAL = new Set(['error', 'rate_limited', 'overloaded', 'empty_completion', 'parse']);

const warte = (ms) => new Promise((f) => setTimeout(f, ms));

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
  let letzter = null;

  for (let v = 1; v <= VERSUCHE; v += 1) {
    if (opts.signal && opts.signal.aborted) throw Object.assign(new Error('abgebrochen'), { code: 'cancelled' });
    try {
      // eslint-disable-next-line no-await-in-loop
      const antwort = await ask(promptStoff(stoff, e), {
        recherche: true,
        maxTokens: MAX_TOKENS,
        signal: opts.signal,
        onSuche: opts.onSuche
      });
      let neu;
      try {
        neu = parseWissen(antwort.text);
      } catch (perr) {
        /* Eigener Code, damit der Wiederholungsfilter die kaputte Antwort
           vom leeren Guthaben unterscheiden kann. */
        throw Object.assign(perr, { code: 'parse' });
      }
      return {
        ...e,
        n: stoff.n,
        kat: stoff.kat,
        stand: new Date().toISOString(),
        abschnitte: neu.abschnitte,
        quellen: neu.quellen,
        news: neu.news,
        /* Steht hier true, war die Antwort abgeschnitten und der Eintrag
           endet mitten im Gedanken. Die Karte sagt das, statt die Luecke
           als Ergebnis auszugeben. */
        unvollstaendig: !!(neu.unvollstaendig || antwort.truncated)
      };
    } catch (err) {
      letzter = err;
      if (!NOCHMAL.has(err.code) || v === VERSUCHE) throw err;
      if (opts.onZweiterAnlauf) opts.onZweiterAnlauf(stoff.n, v);
      // eslint-disable-next-line no-await-in-loop
      await warte(1500 * v);
    }
  }
  throw letzter;
}

/**
 * Alle faelligen Stoffe der Reihe nach. Gibt zurueck, was gelungen ist und
 * was nicht — ein gescheiterter Stoff haelt die uebrigen nicht auf.
 *
 * @param {object} wissen   bisheriger Bestand, Schluessel ist der Stoff
 * @param {any[]} news      bisherige Newsliste
 * @param {object} opts     { signal, onStoff(name, i, ges), onSuche(),
 *                        onZweiterAnlauf(name, versuch) }
 */
export async function laufe(wissen, news, opts = {}) {
  if (!aiRecherchiert()) {
    throw new Error('Die aktive Analysequelle kann nicht im Netz nachschlagen.');
  }
  const offen = faelligeStoffe(wissen);
  const fertig = [];
  const fehler = [];
  const halb = [];
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
      if (e.unvollstaendig) halb.push(stoff.n);
    } catch (err) {
      /* Ein Abbruch ist kein Fehlschlag: er beendet den Lauf. */
      if (err.code === 'cancelled') break;
      fehler.push(`${stoff.n}: ${err.message || 'Fehler'}`);
    }
  }
  if (fertig.length) await saveNews(liste);
  return { fertig, fehler, halb, news: liste, offen: offen.length };
}
