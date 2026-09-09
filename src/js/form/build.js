/* Baut das Wochenformular aus den Definitionen in schema.js auf.
   Hier steht keine einzige Frage im Klartext — wer eine Frage ergaenzen will,
   traegt sie in schema.js ein und sie erscheint hier von selbst. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { fmt } from '../util/format.js';
import { CU_ANTEIL, CU_RDA_MG_TAG } from '../constants.js';
import {
  KERN, GLOWZIEL, WHO, WHO_LEG, IIEF, MORGEN, PT, PT_SIGNS, PIGMENT, NEG,
  WATCH, CONF_CHECKS, MONTH
} from '../schema.js';
import { slider, segment, checkList, segVal, setSegHandler } from '../ui/controls.js';
import { cuWeek } from '../analysis/metrics.js';
import { keys } from '../state.js';

/** Vier Kraft-Slots; die Namen kommen aus dem Setup und sind aenderbar. */
export function buildKraft() {
  const host = $('s-kraft');
  host.innerHTML = '';
  state.cfg.uebungen.forEach((name, i) => {
    const d = document.createElement('div');
    d.className = 'grid3';
    d.style.marginBottom = '.6rem';
    d.innerHTML =
      `<div class="field" style="grid-column:1/-1;margin:0 0 .3rem">` +
      `<label class="fl" style="margin:0">${name || `Übung ${i + 1}`}</label></div>` +
      `<div class="field"><label class="fl" for="kw${i}">kg</label>` +
      `<input type="number" id="kw${i}" min="0" step="0.5" inputmode="decimal"></div>` +
      `<div class="field"><label class="fl" for="kr${i}">Wiederholungen</label>` +
      `<input type="number" id="kr${i}" min="0" step="1" inputmode="numeric"></div>` +
      `<div class="field"><label class="fl" for="ke${i}">gefühlte Reserve</label>` +
      `<select id="ke${i}"><option value="">—</option><option value="0">bis zum Versagen</option>` +
      `<option value="1">1 Wdh. übrig</option><option value="2">2 Wdh. übrig</option>` +
      `<option value="3">3+ Wdh. übrig</option></select></div>`;
    host.appendChild(d);
  });
}

/** WHO-5 und IIEF-5 laufen live mit, sobald alle Items gesetzt sind. */
export function recalcScores() {
  let w = 0;
  let ok = true;
  for (let i = 0; i < 5; i++) {
    const v = segVal(`who${i}`);
    if (v === null) { ok = false; break; }
    w += v;
  }
  $('whoScore').textContent = ok ? String(w * 4) : '—';

  let s = 0;
  let ok2 = true;
  for (let j = 0; j < 5; j++) {
    const u = segVal(`iief${j}`);
    if (u === null) { ok2 = false; break; }
    s += u;
  }
  $('iiefScore').textContent = ok2 ? String(s) : '—';
}

/* ---- Kupferlast ----
   Subkutan entfaellt die Aufnahmebremse im Darm, deshalb ist die orale
   Zufuhrempfehlung nur eine grobe Einordnung, keine Grenze. */

function cuWoche() {
  const n = Number($('nGlow').value) || 0;
  return n * (Number(state.cfg.ghk) || 0) * CU_ANTEIL;
}

function cuGesamt() {
  return keys().reduce((t, k) => t + cuWeek(state.weeks[k], CU_ANTEIL, state.cfg.ghk), 0);
}

export function renderCu() {
  const el = $('cuNote');
  const n = Number($('nGlow').value) || 0;
  if (!(n > 0)) {
    el.innerHTML = '<b>Kupferlast:</b> keine GLOW-Injektion in dieser Woche eingetragen.';
    return;
  }
  const w = cuWoche();
  el.innerHTML =
    `<b>Kupferlast dieser Woche: ${fmt(w, 2)} mg elementares Kupfer</b> ` +
    `(${fmt((w * 1000) / n, 0)} µg je Injektion). Bisher protokolliert insgesamt ${fmt(cuGesamt(), 2)} mg. ` +
    `Zur Einordnung: die orale Zufuhrempfehlung liegt bei ${fmt(CU_RDA_MG_TAG, 1)} mg pro Tag, also rund ` +
    `${fmt(CU_RDA_MG_TAG * 7, 1)} mg pro Woche — subkutan entfällt allerdings die Aufnahmebremse im Darm, ` +
    `weshalb die orale Skala nicht direkt überträgt.`;
}

/** Einmalig beim Start: alle Regler, Segmente und Listen erzeugen. */
export function buildForm() {
  setSegHandler(recalcScores);

  slider($('s-erwartung'), 'erwartung',
    'Wie stark erwartest du, dass diese Woche einen Effekt zeigt?', 'gar nicht', 'sehr stark', 5);
  KERN.forEach((x) => slider($('s-kern'), x.k, x.n, x.lo, x.hi, 5));
  GLOWZIEL.forEach((x) => slider($('s-glowziel'), x.k, x.n, x.lo, x.hi, 5));

  buildKraft();

  const kn = $('s-kraftNamen');
  [0, 1, 2, 3].forEach((i) => {
    const d = document.createElement('div');
    d.className = 'field';
    d.innerHTML = `<label class="fl" for="un${i}">Übung ${i + 1}</label><input type="text" id="un${i}">`;
    kn.appendChild(d);
  });

  WHO.forEach((t, i) => segment($('s-who'), `who${i}`, `… ${t}`, 0, 5, WHO_LEG[0], WHO_LEG[1], null));
  IIEF.forEach((q, i) =>
    segment($('s-iief'), `iief${i}`, `${i + 1}. ${q.t}`, 1, 5, q.lo, q.hi, q.zero ? q.zeroLab : null));
  segment($('s-morgenCount'), 'mNaechte',
    'An wie vielen der letzten sieben Morgen war eine spontane Erektion vorhanden?',
    0, 7, 'kein Morgen', 'jeden Morgen', null);

  MORGEN.forEach((x) => slider($('s-morgen'), x.k, x.n, x.lo, x.hi, 5));
  PT.forEach((x) => slider($('s-pt'), x.k, x.n, x.lo, x.hi, 5));
  PIGMENT.forEach((x) => slider($('s-pigment'), x.k, x.n, x.lo, x.hi, 0));
  NEG.forEach((x) => slider($('s-neg'), x.k, x.n, x.lo, x.hi, 5));

  checkList($('s-ptSigns'), PT_SIGNS);
  checkList($('s-watch'), WATCH);
  checkList($('s-confChecks'), CONF_CHECKS);
  checkList($('s-month'), MONTH);
  slider($('s-conf'), 'cStress', 'Stressbelastung dieser Woche', 'sehr niedrig', 'sehr hoch', 5);

  /* Der PT-141-Block ist nur sichtbar, wenn in dieser Woche angewendet wurde. */
  $('nPt').addEventListener('input', () => {
    $('ptCard').hidden = !(Number($('nPt').value) > 0);
  });
  $('nGlow').addEventListener('input', renderCu);
  renderCu();
}
