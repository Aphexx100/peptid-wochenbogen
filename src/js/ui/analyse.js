/* Der Analyse-Reiter: drei Knoepfe, drei Ausgabefelder, ein Datenblock.

   Die Fragestellungen stehen hier, die Auswertungsregeln in ai/briefing.js.
   Eine neue Frage ist ein weiterer Eintrag in ANFRAGEN — Aufbau, Abbruch,
   Fehlerbehandlung kommen dann von selbst. */

import { keys } from '../state.js';
import { $ } from '../util/dom.js';
import { BRIEFING } from '../ai/briefing.js';
import { dataBlock } from '../ai/context.js';
import { initAi, ask, errCopy } from '../ai/index.js';

const ANFRAGEN = [
  {
    btn: 'askWeek', stop: 'stopWeek', out: 'outWeek', info: 'infoWeek',
    wochen: 12, cache: true,
    minWochen: 1, leerText: 'Noch keine Woche gespeichert.',
    aufgabe:
      'Ordne die zuletzt erfasste Woche ein, vor dem Hintergrund der vorherigen. ' +
      'Höchstens 200 Wörter, Fließtext ohne Aufzählungen. Nenne: was auffällig ist, was vermutlich Rauschen ist, ' +
      'und welcher konkurrierende Erklärungskandidat für das Auffällige in Frage kommt.'
  },
  {
    btn: 'askAll', stop: 'stopAll', out: 'outAll', info: 'infoAll',
    wochen: 40, cache: true,
    minWochen: 2, leerText: 'Mindestens zwei Wochen nötig.',
    aufgabe:
      'Werte die gesamte Serie aus. Gliedere in Absätzen, ohne Aufzählungszeichen, höchstens 600 Wörter, ' +
      'in dieser Reihenfolge: (1) Primaerendpunkt IIEF-5 und Morgenerektionen — Verlauf und ob er belastbar ist. ' +
      '(2) Erwartung gegen Ergebnis. (3) Negativkontrollen. (4) PT-141: Wochen mit gegen ohne, und falls ' +
      'entblindete Durchgänge vorliegen, Wirkstoff gegen Placebo samt Trefferquote der Vermutung. ' +
      '(5) Confounder, insbesondere Gewichtsverlauf und Tirzepatid. (6) Was als Nächstes zu messen wäre, ' +
      'um die offenste Frage zu klären. Schließe mit einem Satz dazu, was die Daten NICHT hergeben.'
  }
];

function setBusy(btnId, stopId, busy) {
  $(btnId).disabled = busy;
  $(stopId).hidden = !busy;
}

/** Eine Anfrage stellen und die Antwort laufend ins Ausgabefeld schreiben. */
function run(prompt, a, ctlRef) {
  const out = $(a.out);
  const info = $(a.info);
  out.hidden = false;
  out.classList.add('thinking');
  out.textContent = 'Denkt nach …';
  info.textContent = '';
  info.className = 'saveinfo';
  setBusy(a.btn, a.stop, true);

  ctlRef.c = new AbortController();
  const opts = {
    signal: ctlRef.c.signal,
    onText: (u) => {
      out.classList.remove('thinking');
      out.textContent = u.text;
    }
  };
  if (a.cache === false) opts.cache = false;

  Promise.resolve()
    .then(() => ask(prompt, opts))
    .then((r) => {
      out.classList.remove('thinking');
      out.textContent = r.text;
      if (r.truncated) {
        info.textContent = 'Antwort wurde gekürzt — enger fragen.';
        info.className = 'saveinfo bad';
      }
    })
    .catch((e) => {
      out.classList.remove('thinking');
      if (e && e.text) out.textContent = e.text;
      else if (e && e.code === 'cancelled') { out.hidden = true; out.textContent = ''; }
      const msg = errCopy(e && e.code);
      if (msg) { info.textContent = msg; info.className = 'saveinfo bad'; }
    })
    .then(() => setBusy(a.btn, a.stop, false));
}

export async function initAnalyse() {
  /* Der Datenblock braucht keine KI — dieser Knopf bleibt immer aktiv. */
  $('showCtx').addEventListener('click', () => {
    const d = $('ctxDump');
    if (d.hidden) {
      d.textContent = `${BRIEFING}\n${dataBlock(40)}`;
      d.hidden = false;
      $('showCtx').textContent = 'Datenblock ausblenden';
    } else {
      d.hidden = true;
      $('showCtx').textContent = 'Datenblock anzeigen';
    }
  });

  const quelle = await initAi();
  if (!quelle) {
    $('sampleOff').hidden = false;
    $('sampleIntro').hidden = true;
    ['askWeek', 'askAll', 'askFree'].forEach((i) => { $(i).disabled = true; });
    return;
  }
  $('sampleOff').hidden = true;
  $('sampleIntro').hidden = false;
  const q = $('aiQuelle');
  if (q) q.textContent = quelle.label;

  ANFRAGEN.forEach((a) => {
    const ctl = { c: null };
    $(a.btn).addEventListener('click', () => {
      if (keys().length < a.minWochen) {
        $(a.info).textContent = a.leerText;
        $(a.info).className = 'saveinfo bad';
        return;
      }
      run(`${BRIEFING}\nAUFGABE\n${a.aufgabe}\n\n${dataBlock(a.wochen)}`, a, ctl);
    });
    $(a.stop).addEventListener('click', () => { if (ctl.c) ctl.c.abort(); });
  });

  /* Freie Frage — nie aus dem Zwischenspeicher, die Frage aendert sich ja. */
  const ctlFree = { c: null };
  const frei = {
    btn: 'askFree', stop: 'stopFree', out: 'outFree', info: 'infoFree', cache: false
  };
  $('askFree').addEventListener('click', () => {
    const frage = $('askBox').value.trim();
    if (!frage) {
      $('infoFree').textContent = 'Bitte eine Frage eingeben.';
      $('infoFree').className = 'saveinfo bad';
      return;
    }
    run(
      `${BRIEFING}\nAUFGABE\nBeantworte die folgende Frage des Anwenders zu seinen eigenen Daten. ` +
      `Fließtext, höchstens 350 Wörter. Wenn die Daten die Frage nicht hergeben, sage das und nenne, ` +
      `welche Messung sie beantworten würde.\n\nFRAGE: ${frage.slice(0, 1500)}\n\n${dataBlock(40)}`,
      frei, ctlFree
    );
  });
  $('stopFree').addEventListener('click', () => { if (ctlFree.c) ctlFree.c.abort(); });
}
