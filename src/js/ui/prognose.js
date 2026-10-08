/* Der Prognose-Reiter: zwei Schritte, dazwischen deine Bewertung.

   Schritt 1 laeuft bewusst lange. Die Quelle darf dabei im Netz
   nachschlagen (Anthropic-API); im Claude-Viewer geht das nicht, dann
   stuetzt sich die Schaetzung allein auf das Modellwissen — die Oberflaeche
   sagt das, statt es zu verschweigen.

   Jede fertige Prognose wird gespeichert und fliesst in die naechste ein.
   So entsteht eine Kette: was beim letzten Mal vermutet wurde, was du davon
   bestaetigt hast, und was daraus geworden ist. */

import { $ } from '../util/dom.js';
import { initAi, ask, errCopy, aiRecherchiert } from '../ai/index.js';
import { promptIst, promptPrognose, parseIst } from '../ai/prognose.js';
import { loadPrognosen, savePrognose } from '../storage/index.js';
import { keys } from '../state.js';

const SKALA = [
  [5, 'stimme voll zu'],
  [4, 'stimme eher zu'],
  [3, 'unentschieden'],
  [2, 'stimme eher nicht zu'],
  [1, 'stimme gar nicht zu']
];

/* Laufender Stand des Reiters. `ist` haelt die Aussagen aus Schritt 1,
   `bewertungen` die Zustimmung je Aussage. */
const lauf = { ist: null, bewertungen: {}, prognosen: {}, ctl: null };

const melde = (id, ok, text) => {
  const el = $(id);
  el.textContent = text;
  el.className = `saveinfo ${ok ? 'ok' : 'bad'}`;
};

function setBusy(btn, stop, busy) {
  $(btn).disabled = busy;
  $(stop).hidden = !busy;
}

/* ---- Schritt 1: Ist-Zustand ---- */

function renderAussagen() {
  const host = $('progTabelle');
  host.textContent = '';
  if (!lauf.ist) { $('progSchritt2').hidden = true; return; }

  $('progStand').textContent = lauf.ist.stand;
  $('progStand').hidden = !lauf.ist.stand;

  const tab = document.createElement('table');
  tab.innerHTML = '<thead><tr><th>Bereich</th><th>Aussage</th><th>Grundlage</th><th>Bewertung <span style="text-transform:none;letter-spacing:0">(5 = stimme voll zu … 1 = gar nicht)</span></th></tr></thead>';
  const body = document.createElement('tbody');
  lauf.ist.aussagen.forEach((a) => {
    const tr = document.createElement('tr');

    const bereich = document.createElement('td');
    bereich.textContent = a.bereich;

    const text = document.createElement('td');
    text.className = 'prog-aussage';
    const stark = document.createElement('b');
    stark.textContent = a.aussage;
    const beleg = document.createElement('span');
    beleg.className = 'prog-beleg';
    beleg.textContent = a.beleg;
    text.append(stark, beleg);

    const grund = document.createElement('td');
    grund.className = 'prog-grund';
    grund.textContent = `${a.grundlage} · ${a.zuversicht}`;

    const wahl = document.createElement('td');
    const seg = document.createElement('div');
    seg.className = 'seg prog-seg';
    SKALA.forEach(([wert, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(wert);
      b.title = name;
      b.setAttribute('aria-label', `${a.aussage}: ${name}`);
      b.setAttribute('aria-pressed', lauf.bewertungen[a.id] === wert ? 'true' : 'false');
      b.addEventListener('click', () => {
        lauf.bewertungen[a.id] = wert;
        renderAussagen();
      });
      seg.appendChild(b);
    });
    wahl.appendChild(seg);

    tr.append(bereich, text, grund, wahl);
    body.appendChild(tr);
  });
  tab.appendChild(body);
  host.appendChild(tab);

  const offen = lauf.ist.aussagen.filter((a) => !lauf.bewertungen[a.id]).length;
  $('progSchritt2').hidden = false;
  $('progBewertet').textContent = offen
    ? `${lauf.ist.aussagen.length - offen} von ${lauf.ist.aussagen.length} bewertet — ${offen} offen.`
    : `Alle ${lauf.ist.aussagen.length} Aussagen bewertet.`;
}

function laufText(roh, suchen) {
  return suchen ? `${suchen} Suchanfragen …\n\n${roh}` : roh;
}

async function schritt1() {
  const out = $('progIstRoh');
  setBusy('progIst', 'progIstStop', true);
  melde('progIstInfo', true, aiRecherchiert()
    ? 'Recherchiert im Netz und in Studien. Das dauert — ein bis drei Minuten sind normal.'
    : 'Schätzt ohne Netzrecherche: diese Quelle kann nicht nachschlagen.');
  out.hidden = false;
  out.classList.add('thinking');
  out.textContent = 'Denkt nach …';

  lauf.ctl = new AbortController();
  let suchen = 0;
  try {
    const r = await ask(promptIst(lauf.prognosen), {
      signal: lauf.ctl.signal,
      recherche: aiRecherchiert(),
      maxTokens: 8000,
      onSuche: () => { suchen += 1; out.textContent = laufText(out.textContent, suchen); },
      onText: (u) => { out.classList.remove('thinking'); out.textContent = laufText(u.text, suchen); }
    });
    lauf.ist = parseIst(r.text);
    lauf.bewertungen = {};
    out.hidden = true;
    renderAussagen();
    melde('progIstInfo', true, `Ist-Zustand steht: ${lauf.ist.aussagen.length} Aussagen${suchen ? `, ${suchen} Suchanfragen` : ''}. Jetzt bewerten.`);
  } catch (e) {
    out.classList.remove('thinking');
    if (e && e.code === 'cancelled') {
      out.hidden = true;
      melde('progIstInfo', false, 'Abgebrochen.');
    } else {
      melde('progIstInfo', false, errCopy(e && e.code) || String(e.message || e));
    }
  } finally {
    setBusy('progIst', 'progIstStop', false);
  }
}

/* ---- Schritt 2: Prognose ---- */

async function schritt2() {
  const out = $('progAus');
  setBusy('progErstellen', 'progStop', true);
  melde('progInfo', true, 'Erstellt die Prognose …');
  out.hidden = false;
  out.classList.add('thinking');
  out.textContent = 'Denkt nach …';

  lauf.ctl = new AbortController();
  try {
    const r = await ask(promptPrognose(lauf.prognosen, lauf.ist, lauf.bewertungen), {
      signal: lauf.ctl.signal,
      maxTokens: 4000,
      onText: (u) => { out.classList.remove('thinking'); out.textContent = u.text; }
    });
    out.textContent = r.text;
    const p = {
      id: new Date().toISOString().replace(/[:.]/g, '-'),
      erstellt: new Date().toISOString(),
      wochen: keys().length,
      stand: lauf.ist.stand,
      aussagen: lauf.ist.aussagen,
      bewertungen: lauf.bewertungen,
      prognose: r.text
    };
    const s = await savePrognose(p);
    lauf.prognosen[p.id] = p;
    renderFruehere();
    melde('progInfo', s.ok, s.ok ? `Prognose gespeichert · ${s.text}` : s.text);
  } catch (e) {
    out.classList.remove('thinking');
    if (e && e.code === 'cancelled') {
      out.hidden = true;
      melde('progInfo', false, 'Abgebrochen.');
    } else {
      melde('progInfo', false, errCopy(e && e.code) || String(e.message || e));
    }
  } finally {
    setBusy('progErstellen', 'progStop', false);
  }
}

/** Aussagen anzeigen — aus Schritt 1 oder aus einer gespeicherten Prognose. */
export function zeigeIst(ist, bewertungen) {
  lauf.ist = ist;
  lauf.bewertungen = bewertungen || {};
  renderAussagen();
}

/* ---- Frühere Prognosen ---- */

function renderFruehere() {
  const host = $('progFrueher');
  const alle = Object.values(lauf.prognosen).sort((a, b) => (a.id < b.id ? 1 : -1));
  host.textContent = '';
  $('progFrueherLeer').hidden = !!alle.length;
  alle.forEach((p) => {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    const zu = (p.aussagen || []).filter((a) => (p.bewertungen || {})[a.id] >= 4).length;
    s.textContent = `${p.erstellt.slice(0, 10)} · ${(p.aussagen || []).length} Aussagen, ${zu} bestätigt, ${p.wochen || 0} Wochen Daten`;
    const pre = document.createElement('pre');
    pre.className = 'answer';
    pre.textContent = p.prognose || '';
    d.append(s, pre);
    host.appendChild(d);
  });
}

export async function initPrognose() {
  const quelle = await initAi();
  if (!quelle) {
    $('progOff').hidden = false;
    $('progIst').disabled = true;
    $('progErstellen').disabled = true;
  } else {
    $('progOff').hidden = true;
    $('progQuelle').textContent = aiRecherchiert()
      ? `${quelle.label} — kann im Netz nachschlagen`
      : `${quelle.label} — ohne Netzrecherche, Schätzung allein aus Modellwissen`;
  }

  $('progIst').addEventListener('click', schritt1);
  $('progErstellen').addEventListener('click', schritt2);
  [['progIstStop', 'progIst'], ['progStop', 'progErstellen']].forEach(([stop]) => {
    $(stop).addEventListener('click', () => { if (lauf.ctl) lauf.ctl.abort(); });
  });

  try {
    lauf.prognosen = await loadPrognosen();
  } catch {
    lauf.prognosen = {};
  }
  renderFruehere();
}
