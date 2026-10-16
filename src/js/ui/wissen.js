/* Der Reiter "Wissen": je Stoff eine Karte, dazu der Auffrischknopf.

   Der Bestand wird beim Start einmal geladen und danach im Modul gehalten.
   Wer ihn braucht — der Ticker, spaeter die Analyse — holt ihn hier ab,
   statt ein zweites Mal zu laden.

   Gebaut wird mit createElement. Der Text kommt aus dem Netz und aus
   Nutzereingaben; innerHTML waere hier eine offene Tuer. */

import { $ } from '../util/dom.js';
import { stoffe } from '../substanzen.js';
import { loadWissen, loadNews } from '../storage/index.js';
import { aiAktiv, aiRecherchiert, errCopy } from '../ai/index.js';
import { ABSCHNITTE, leererEintrag, standText, faellig, hatInhalt } from '../wissen/modell.js';
import { faelligeStoffe, laufe } from '../wissen/update.js';
import { newsAusWissen } from '../wissen/news.js';
import { renderTicker } from './newsticker.js';

let wissen = {};
let news = [];
let laeuft = null;

/** Der geladene Bestand — fuer alle, die ihn lesen wollen. */
export const wissenBestand = () => wissen;
export const newsBestand = () => news;

function melde(text, ok) {
  const el = $('wissenInfo');
  if (!el) return;
  el.textContent = text;
  el.className = `saveinfo ${ok === undefined ? '' : (ok ? 'ok' : 'bad')}`;
}

/* ---- Eine Karte ---- */

function quellenBlock(e) {
  if (!(e.quellen || []).length) return null;
  const d = document.createElement('details');
  d.className = 'quellen';
  const s = document.createElement('summary');
  s.textContent = `${e.quellen.length} Quelle${e.quellen.length === 1 ? '' : 'n'}`;
  d.appendChild(s);
  const ul = document.createElement('ul');
  e.quellen.forEach((q) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = q.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = q.titel;
    li.appendChild(a);
    if (q.jahr || q.art) {
      const span = document.createElement('span');
      span.className = 'quellart';
      span.textContent = ` ${[q.art, q.jahr].filter(Boolean).join(' · ')}`;
      li.appendChild(span);
    }
    ul.appendChild(li);
  });
  d.appendChild(ul);
  return d;
}

function karte(stoff) {
  const e = wissen[stoff.k] || leererEintrag(stoff);
  const c = document.createElement('div');
  c.className = 'card';
  c.dataset.stoff = stoff.k;

  const h = document.createElement('h2');
  h.textContent = stoff.n;
  const stand = document.createElement('span');
  stand.className = 'gatehint';
  stand.style.marginLeft = '.6rem';
  stand.textContent = standText(e);
  if (faellig(e)) stand.classList.add('bad');
  h.appendChild(stand);
  c.appendChild(h);

  if (!hatInhalt(e)) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Noch nichts recherchiert.';
    c.appendChild(p);
    return c;
  }

  ABSCHNITTE.forEach((a) => {
    const text = (e.abschnitte || {})[a.k];
    if (!text) return;
    const lab = document.createElement('label');
    lab.className = 'fl';
    lab.style.marginTop = '1rem';
    lab.textContent = a.n;
    const p = document.createElement('p');
    p.className = 'wissentext';
    p.textContent = text;
    c.append(lab, p);
  });

  const q = quellenBlock(e);
  if (q) c.appendChild(q);
  return c;
}

/* ---- Der ganze Reiter ---- */

export function renderWissen() {
  const host = $('wissenListe');
  if (!host) return;
  host.textContent = '';
  const liste = stoffe();
  if (!liste.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Noch kein Stoff angelegt — das passiert im Bogen unter Abschnitt 02.';
    host.appendChild(p);
  } else {
    liste.forEach((x) => host.appendChild(karte(x)));
  }

  const offen = faelligeStoffe(wissen);
  const knopf = $('wissenUpdate');
  const hinweis = $('wissenFaellig');
  if (hinweis) {
    hinweis.hidden = !offen.length || !!laeuft;
    hinweis.textContent = offen.length
      ? `${offen.length} von ${liste.length} Einträgen ist älter als eine Woche: ${offen.map((x) => x.n).join(', ')}.`
      : '';
  }
  if (knopf) {
    knopf.disabled = !!laeuft || !aiAktiv() || !liste.length;
    knopf.textContent = offen.length ? `${offen.length} auffrischen` : 'Alles aktuell';
  }
  const ohne = $('wissenOhneKi');
  if (ohne) ohne.hidden = !!aiAktiv();
  const ohneSuche = $('wissenOhneSuche');
  if (ohneSuche) ohneSuche.hidden = !aiAktiv() || aiRecherchiert();
}

async function starteLauf() {
  if (laeuft) return;
  const abbruch = new AbortController();
  laeuft = abbruch;
  $('wissenStop').hidden = false;
  renderWissen();
  let suchen = 0;
  try {
    const r = await laufe(wissen, news, {
      signal: abbruch.signal,
      onStoff: (name, i, ges) => melde(`${name} … (${i + 1} von ${ges})`, undefined),
      onSuche: () => { suchen += 1; melde(`Sucht … (${suchen} Abfragen)`, undefined); }
    });
    news = r.news;
    const teile = [];
    if (r.fertig.length) teile.push(`${r.fertig.length} aufgefrischt: ${r.fertig.join(', ')}`);
    if (r.fehler.length) teile.push(`Fehlgeschlagen — ${r.fehler.join('; ')}`);
    melde(teile.join('. ') || 'Nichts zu tun.', !r.fehler.length);
  } catch (err) {
    melde(err.code ? errCopy(err.code) : String(err.message || err), false);
  } finally {
    laeuft = null;
    $('wissenStop').hidden = true;
    renderWissen();
    renderTicker(news);
  }
}

export async function initWissen() {
  $('wissenUpdate').addEventListener('click', starteLauf);
  $('wissenStop').addEventListener('click', () => {
    if (laeuft) laeuft.abort();
  });
  try {
    wissen = (await loadWissen()) || {};
    news = (await loadNews()) || [];
    /* Geht die Newsliste verloren, stehen die Meldungen noch in den
       Eintraegen — dann lieber neu aufbauen als leer bleiben. */
    if (!news.length) news = newsAusWissen(wissen);
  } catch {
    wissen = {};
    news = [];
  }
  renderWissen();
  renderTicker(news);
}
