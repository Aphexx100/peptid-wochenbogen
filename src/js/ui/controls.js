/* Wiederverwendbare Eingabe-Bausteine.
   Jeder Baustein haengt sein Element an `host` und meldet seinen Wert ueber
   ein data-Attribut zurueck (data-s = Schieberegler, data-seg = Segmentwahl,
   data-c = Ankreuzfeld). Die Lesefunktionen weiter unten fragen genau diese
   Attribute ab — kein Modul muss sich Element-IDs merken. */

import { $ } from '../util/dom.js';

/* Wird nach jeder Segmentwahl aufgerufen; setzt das Formular, damit die
   Summenwerte (WHO-5, IIEF-5) sofort mitlaufen. Ohne Registrierung passiert
   nichts — so bleibt dieses Modul frei von Abhaengigkeiten nach oben. */
let onSegChange = () => {};
export function setSegHandler(fn) {
  onSegChange = typeof fn === 'function' ? fn : () => {};
}

/** Schieberegler 0–10 mit beschrifteten Enden. */
export function slider(host, key, name, lo, hi, def) {
  const d = document.createElement('div');
  d.className = 'scale';
  d.innerHTML =
    `<div class="scale-top"><span class="scale-name">${name}</span>` +
    `<span class="scale-val" id="v-${key}">${def}</span></div>` +
    `<input type="range" min="0" max="10" step="1" value="${def}" data-s="${key}" aria-label="${name}">` +
    `<div class="scale-ends"><span>${lo}</span><span>${hi}</span></div>`;
  host.appendChild(d);
  d.querySelector('input').addEventListener('input', (e) => {
    $(`v-${key}`).textContent = e.target.value;
  });
}

/** Reihe sich gegenseitig ausschliessender Knoepfe, optional mit Null-Option. */
export function segment(host, key, text, min, max, loLab, hiLab, zeroLab) {
  const d = document.createElement('div');
  d.className = 'q';
  let btns = '';
  if (zeroLab) {
    btns +=
      `<button type="button" data-seg="${key}" data-val="0" aria-pressed="false"` +
      ` style="flex:2 1 6rem;font-size:.68rem;font-family:Archivo,sans-serif">${zeroLab}</button>`;
  }
  for (let i = min; i <= max; i++) {
    btns += `<button type="button" data-seg="${key}" data-val="${i}" aria-pressed="false">${i}</button>`;
  }
  d.innerHTML =
    `<p class="q-text">${text}</p><div class="seg">${btns}</div>` +
    `<div class="seg-legend"><span>${loLab}</span><span>${hiLab}</span></div>`;
  host.appendChild(d);
  d.querySelectorAll('[data-seg]').forEach((b) => {
    b.addEventListener('click', () => {
      d.querySelectorAll('[data-seg]').forEach((o) => o.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onSegChange();
    });
  });
}

/** Liste von Ankreuzfeldern aus [{k, n}]. */
export function checkList(host, items) {
  items.forEach((w) => {
    const l = document.createElement('label');
    l.dataset.on = '0';
    l.innerHTML = `<input type="checkbox" data-c="${w.k}"><span>${w.n}</span>`;
    l.querySelector('input').addEventListener('change', (e) => {
      l.dataset.on = e.target.checked ? '1' : '0';
    });
    host.appendChild(l);
  });
}

/* ---- Lesen und Setzen ---- */

export function segVal(key) {
  const b = document.querySelector(`[data-seg="${key}"][aria-pressed="true"]`);
  return b ? Number(b.dataset.val) : null;
}

export function setSeg(key, val) {
  document.querySelectorAll(`[data-seg="${key}"]`).forEach((b) => {
    const on = val !== null && val !== undefined && Number(b.dataset.val) === Number(val);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

export function sVal(key) {
  const i = document.querySelector(`[data-s="${key}"]`);
  return i ? Number(i.value) : null;
}

export function setS(key, val, def) {
  const i = document.querySelector(`[data-s="${key}"]`);
  if (!i) return;
  i.value = val === undefined || val === null ? (def === undefined ? 5 : def) : val;
  $(`v-${key}`).textContent = i.value;
}

/** Ist das Ankreuzfeld mit diesem Schluessel gesetzt? */
export function checked(key) {
  const el = document.querySelector(`[data-c="${key}"]`);
  return !!(el && el.checked);
}
