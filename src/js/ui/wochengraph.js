/* Wochengrafik oben im Bogen: Tagesmenge je Wirkstoff in mg, Punkt fuer
   Punkt mit dem Vortag verbunden.

   Alles in mg, auch Kisspeptin (im Raster in µg, hier durch 1000 geteilt) —
   eine gemeinsame Achse, keine zweite. Kisspeptin liegt dadurch nahe der
   Nulllinie; sein Wert steht deshalb im Tooltip auch in µg.

   Vergangene Tage ohne Eintrag zaehlen als 0 mg: an dem Tag wurde nichts
   gesetzt. Heute ohne Eintrag ist dagegen noch offen und endet die Linie am
   Vortag; kuenftige Tage bleiben leer. Punkte nur an Tagen mit Injektion.

   Farben kommen aus tokens.css (--c-<wirkstoff>), fest je Wirkstoff. Die
   Palette ist mit dem dataviz-Validator geprueft; weil zwei Farben hell
   unter 3:1 Kontrast liegen, tragen die Hoechstwerte sichtbare Beschriftung
   und das Raster darunter ist die Tabellenansicht. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { EXPO } from '../schema.js';
import { iso, weekDays } from '../util/date.js';

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const NS = 'http://www.w3.org/2000/svg';
const HOEHE = 210;
const RAND = { l: 38, r: 14, o: 18, u: 26 };

let letzte = null;
let beobachter = null;

const zuMg = (x, v) => (x.u === 'µg' ? v / 1000 : v);
const zahl = (v) => (+v.toFixed(v < 1 ? 3 : 2)).toLocaleString('de-DE');
const tagKurz = (d) => `${WTAG[new Date(`${d}T12:00:00`).getDay()]} ${d.slice(8, 10)}.`;

function el(name, attrs, eltern) {
  const e = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (eltern) eltern.appendChild(e);
  return e;
}

/** Runde Achsenschritte: hoechstens vier Intervalle bis zum Maximum. */
function achse(max) {
  const schritte = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const s = schritte.find((x) => max / x <= 4) || 100;
  const n = Math.max(1, Math.ceil(max / s - 1e-9));
  return { s, top: n * s, n };
}

/** Je Wirkstoff sieben Tageswerte in mg; null heisst offen oder kuenftig. */
function reihen(tage) {
  const datum = weekDays(state.weekKey);
  const heute = iso(new Date());
  return EXPO.map((x) => {
    const roh = datum.map((d, i) => (tage && tage[x.k] ? Number(tage[x.k][i]) || 0 : 0));
    return {
      x,
      roh,
      werte: datum.map((d, i) => {
        if (d > heute) return null;
        if (d === heute && !(roh[i] > 0)) return null;
        return roh[i] > 0 ? zuMg(x, roh[i]) : 0;
      })
    };
  });
}

/** Aufruf bei jeder Aenderung im Expositionsraster. `legacy`: Woche ohne Tageswerte. */
export function renderWochenGraph(tage, legacy) {
  letzte = { tage, legacy };
  const host = $('wochenGraph');
  if (!host) return;
  if (!beobachter && 'ResizeObserver' in window) {
    let breite = 0;
    beobachter = new ResizeObserver(() => {
      const b = Math.round(host.clientWidth);
      if (letzte && b && b !== breite) { breite = b; zeichne(); }
    });
    beobachter.observe(host);
  }
  zeichne();
}

function zeichne() {
  const { tage, legacy } = letzte;
  const host = $('wochenGraph');
  const leer = $('wochenGraphLeer');
  const breite = Math.max(280, Math.round(host.clientWidth || 640));
  const datum = weekDays(state.weekKey);
  const heute = iso(new Date());
  const rs = reihen(tage);
  const max = Math.max(0, ...rs.flatMap((r) => r.werte.filter((v) => v !== null)));

  const legende = $('wochenGraphLegende');
  if (legende && !legende.childElementCount) {
    EXPO.forEach((x) => {
      const eintrag = document.createElement('span');
      const key = document.createElement('span');
      key.className = 'wg-key';
      key.style.background = `var(--c-${x.k})`;
      eintrag.append(key, document.createTextNode(x.n));
      legende.appendChild(eintrag);
    });
  }

  host.textContent = '';
  if (legacy || !(max > 0)) {
    leer.hidden = false;
    leer.textContent = legacy
      ? 'Diese Woche wurde noch als Wochensumme erfasst — es gibt keine Tageswerte zum Zeichnen.'
      : 'Noch keine Injektion in dieser Woche eingetragen.';
    return;
  }
  leer.hidden = true;

  const { s, top, n } = achse(max);
  const iw = breite - RAND.l - RAND.r;
  const ih = HOEHE - RAND.o - RAND.u;
  const px = (i) => RAND.l + (iw * (i + 0.5)) / 7;
  const py = (v) => RAND.o + ih - (ih * v) / top;

  const svg = el('svg', {
    viewBox: `0 0 ${breite} ${HOEHE}`, width: breite, height: HOEHE, role: 'img',
    'aria-label': 'Tagesmengen dieser Woche in mg je Wirkstoff. Alle Werte stehen auch im Raster darunter.'
  }, host);

  /* Raster und Achse: Haarlinien, zurueckhaltend. */
  for (let k = 0; k <= n; k++) {
    const y = py(k * s);
    el('line', { x1: RAND.l, x2: breite - RAND.r, y1: y, y2: y, class: k ? 'wg-grid' : 'wg-basis' }, svg);
    el('text', { x: RAND.l - 6, y: y + 3.5, class: 'wg-achse', 'text-anchor': 'end' }, svg)
      .textContent = zahl(k * s);
  }
  /* Schmale Spalten (Telefon): nur der Wochentag, sonst laufen die Daten ineinander. */
  const knapp = iw / 7 < 50;
  datum.forEach((d, i) => {
    el('text', {
      x: px(i), y: HOEHE - 8, 'text-anchor': 'middle',
      class: `wg-achse${d === heute ? ' wg-heute' : ''}${d > heute ? ' wg-zukunft' : ''}`
    }, svg).textContent = knapp ? WTAG[new Date(`${d}T12:00:00`).getDay()] : tagKurz(d);
  });

  /* Fadenkreuz liegt unter den Linien. */
  const kreuz = el('line', { y1: RAND.o, y2: RAND.o + ih, class: 'wg-kreuz', visibility: 'hidden' }, svg);

  /* Linien: jeder Tag mit dem Vortag verbunden; offene Tage unterbrechen. */
  rs.forEach((r) => {
    let pfad = '';
    let offen = false;
    r.werte.forEach((v, i) => {
      if (v === null) { offen = false; return; }
      pfad += `${offen ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`;
      offen = true;
    });
    if (pfad) el('path', { d: pfad, class: 'wg-linie', 'data-serie': r.x.k, style: `stroke:var(--c-${r.x.k})` }, svg);
  });

  /* Punkte nur an Injektionstagen, mit Ring in Flaechenfarbe. */
  rs.forEach((r) => r.werte.forEach((v, i) => {
    if (v > 0) el('circle', { cx: px(i), cy: py(v), r: 4, class: 'wg-punkt', style: `fill:var(--c-${r.x.k})` }, svg);
  }));

  /* Direktbeschriftung sparsam: je Wirkstoff nur der Hoechstwert; bei
     Ueberlappung zweier Beschriftungen weicht die spaetere aus. */
  const belegt = [];
  rs.forEach((r) => {
    const m = Math.max(0, ...r.werte.filter((v) => v !== null));
    if (!(m > 0)) return;
    const i = r.werte.indexOf(m);
    /* Liegt eine andere Reihe am selben Tag knapp darueber, kommt die
       Beschriftung unter den Punkt statt auf deren Linie. */
    const drueber = rs.some((o) => o !== r && o.werte[i] !== null && py(o.werte[i]) < py(m)
      && py(m) - py(o.werte[i]) < 22);
    let y = drueber ? py(m) + 17 : py(m) - 9;
    const schritt = drueber ? 12 : -12;
    while (belegt.some((b) => Math.abs(b.i - i) < 2 && Math.abs(b.y - y) < 12)) y += schritt;
    y = Math.min(Math.max(y, 10), RAND.o + ih - 4);
    belegt.push({ i, y });
    el('text', {
      x: px(i), y, class: 'wg-label',
      'text-anchor': i === 0 ? 'start' : i === 6 ? 'end' : 'middle'
    }, svg).textContent = `${r.x.n} ${zahl(m)}`;
  });

  /* Tooltip: eine Spalte je Tag ist die Trefferflaeche, alle Wirkstoffe im Tooltip. */
  const tip = document.createElement('div');
  tip.className = 'wg-tip';
  tip.hidden = true;
  host.appendChild(tip);
  datum.forEach((d, i) => {
    const hit = el('rect', {
      x: RAND.l + (iw * i) / 7, y: RAND.o, width: iw / 7, height: ih, class: 'wg-hit', tabindex: 0,
      'aria-label': `${tagKurz(d)}: ${rs.map((r) => `${r.x.n} ${r.werte[i] === null ? 'offen' : `${zahl(r.werte[i])} mg`}`).join(', ')}`
    }, svg);
    const zeige = () => {
      kreuz.setAttribute('x1', px(i));
      kreuz.setAttribute('x2', px(i));
      kreuz.setAttribute('visibility', 'visible');
      tip.textContent = '';
      const kopf = document.createElement('div');
      kopf.className = 'wg-tip-kopf';
      kopf.textContent = `${tagKurz(d)}${d.slice(5, 7)}.`;
      tip.appendChild(kopf);
      rs.forEach((r) => {
        const v = r.werte[i];
        const z = document.createElement('div');
        z.className = 'wg-tip-zeile';
        const key = document.createElement('span');
        key.className = 'wg-key';
        key.style.background = `var(--c-${r.x.k})`;
        const wert = document.createElement('b');
        wert.textContent = v === null ? '—' : `${zahl(v)} mg`;
        const name = document.createElement('span');
        name.textContent = r.x.u === 'µg' && v > 0 ? `${r.x.n} (${zahl(r.roh[i])} µg)` : r.x.n;
        z.append(key, wert, name);
        tip.appendChild(z);
      });
      tip.hidden = false;
      const rechts = px(i) / breite > 0.55;
      tip.style.left = rechts ? '' : `${px(i) + 12}px`;
      tip.style.right = rechts ? `${breite - px(i) + 12}px` : '';
    };
    const weg = () => { kreuz.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('pointerenter', zeige);
    hit.addEventListener('focus', zeige);
    hit.addEventListener('pointerleave', weg);
    hit.addEventListener('blur', weg);
  });
}
