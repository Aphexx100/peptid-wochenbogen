/* Grafik der Tagesmengen oben im Bogen: je Wirkstoff eine Kurve in mg.

   Zeitraum waehlbar: eine Woche (mit Blaettern in fruehere Wochen), ein
   eigener Zeitraum von–bis, oder alles, was je erfasst wurde. Daten kommen
   aus allen gespeicherten Wochen (dose.tage); die laufende Woche direkt aus
   dem Raster, damit die Grafik jeder Eingabe sofort folgt.

   Alles in mg, auch Kisspeptin (im Raster in µg, hier durch 1000 geteilt) —
   eine gemeinsame Achse, keine zweite. Sein µg-Wert steht im Tooltip.

   Tageswerte: an einem erfassten Tag ohne Eintrag 0 mg (nichts gesetzt).
   Tage ohne erfasste Woche, kuenftige Tage und heute ohne Eintrag sind
   Luecken — die Kurve setzt dort aus, statt eine Null zu behaupten.

   Kurven sind monotone kubische Beziers (Fritsch-Carlson): sie laufen durch
   jeden Tageswert, schiessen aber nie darueber hinaus — ein Tag mit 0 mg
   bleibt auf der Nulllinie, ein Hoechstwert bleibt der Hoechstwert.

   Gezeigt werden nur Wirkstoffe mit mg-Bezug: ein Supplement oder
   Nahrungsmittel (Kreatin, Protein, Alkohol) gehoert nicht in dieselbe
   mg-Achse wie Kisspeptin, und Liter lassen sich gar nicht in mg umrechnen.
   Welche Spalte als was zaehlt, legt die Einstufung in substanzen.js fest.

   Farben aus tokens.css (--c-<wirkstoff>), fest je Wirkstoff, mit dem
   dataviz-Validator geprueft; selbst angelegte Stoffe bekommen der Reihe
   nach die Zusatzslots --c-s1 bis --c-s6. Zwei Farben liegen hell unter 3:1 Kontrast;
   deshalb tragen die Hoechstwerte sichtbare Beschriftung, und das Raster
   darunter ist die Tabellenansicht. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { graphStoffe, alleStoffe, mgFaktor } from '../substanzen.js';
import { iso, weekDays, currentWeekKey, daysBetween, plusTage } from '../util/date.js';

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const NS = 'http://www.w3.org/2000/svg';
const HOEHE = 210;
const RAND = { l: 38, r: 14, o: 18, u: 26 };
const MAX_TAGE = 1100;
const PUNKT_ABSTAND = 14;

let letzte = null;
let beobachter = null;
let verdrahtet = false;
const ansicht = { modus: 'woche', zurueck: 0, von: '', bis: '' };

const zuMg = (x, v) => v * mgFaktor(x.u);
const zahl = (v) => (+v.toFixed(v < 1 ? 3 : 2)).toLocaleString('de-DE');
const wtag = (d) => WTAG[new Date(`${d}T12:00:00`).getDay()];
const tagMonat = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

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

/** Datum -> Rohwerte je Wirkstoff (Einheit des Rasters), nur fuer erfasste Tage. */
function tageswerte() {
  const m = new Map();
  const eintragen = (start, quelle) => {
    for (let i = 0; i < 7; i++) {
      const o = {};
      alleStoffe().forEach((x) => { o[x.k] = Number(quelle[x.k] && quelle[x.k][i]) || 0; });
      m.set(plusTage(start, i), o);
    }
  };
  Object.values(state.weeks).forEach((e) => {
    const t = e && e.dose && e.dose.tage;
    if (t && t.start) eintragen(t.start, t);
  });
  if (letzte && letzte.tage && !letzte.legacy) eintragen(weekDays(state.weekKey)[0], letzte.tage);
  return m;
}

/** Die Kalendertage der gewaehlten Ansicht, aeltester zuerst. */
function zeitraum(daten) {
  const heute = iso(new Date());
  if (ansicht.modus === 'woche') {
    return weekDays(plusTage(currentWeekKey(), -7 * ansicht.zurueck));
  }
  let von;
  let bis;
  if (ansicht.modus === 'gesamt') {
    const alle = [...daten.keys()].sort();
    if (!alle.length) return [];
    von = alle[0];
    bis = alle[alle.length - 1] < heute ? alle[alle.length - 1] : heute;
  } else {
    von = ansicht.von;
    bis = ansicht.bis;
    if (!von || !bis) return [];
    if (von > bis) [von, bis] = [bis, von];
  }
  const out = [];
  for (let d = von; d <= bis && out.length < MAX_TAGE; d = plusTage(d, 1)) out.push(d);
  return out;
}

/** Monotone kubische Bezier-Kurve durch alle Punkte (Fritsch-Carlson). */
function kurve(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(1);
  if (n === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0
      ? 0
      : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i].x + h)},${f(pts[i].y + t[i] * h)} ` +
      `${f(pts[i + 1].x - h)},${f(pts[i + 1].y - t[i + 1] * h)} ${f(pts[i + 1].x)},${f(pts[i + 1].y)}`;
  }
  return d;
}

/* ---- Steuerung: Woche / Zeitraum / Gesamt ---- */

function verdrahte() {
  if (verdrahtet) return;
  verdrahtet = true;
  document.querySelectorAll('[data-wgmodus]').forEach((b) => {
    b.addEventListener('click', () => {
      ansicht.modus = b.dataset.wgmodus;
      if (ansicht.modus === 'zeitraum' && !ansicht.von) {
        ansicht.bis = iso(new Date());
        ansicht.von = plusTage(ansicht.bis, -27);
        $('wgVon').value = ansicht.von;
        $('wgBis').value = ansicht.bis;
      }
      zeichne();
    });
  });
  $('wgZurueck').addEventListener('click', () => { ansicht.zurueck += 1; zeichne(); });
  $('wgVor').addEventListener('click', () => { ansicht.zurueck = Math.max(0, ansicht.zurueck - 1); zeichne(); });
  ['wgVon', 'wgBis'].forEach((id) => $(id).addEventListener('change', () => {
    ansicht.von = $('wgVon').value;
    ansicht.bis = $('wgBis').value;
    zeichne();
  }));
}

function steuerung(daten, tage) {
  document.querySelectorAll('[data-wgmodus]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.wgmodus === ansicht.modus ? 'true' : 'false');
  });
  $('wgNav').hidden = ansicht.modus !== 'woche';
  $('wgRange').hidden = ansicht.modus !== 'zeitraum';
  const fruehestes = [...daten.keys()].sort()[0];
  const endeVorwoche = plusTage(currentWeekKey(), -7 * (ansicht.zurueck + 1));
  $('wgVor').disabled = ansicht.zurueck === 0;
  $('wgZurueck').disabled = !fruehestes || endeVorwoche < fruehestes;
  const bereich = $('wgBereich');
  if (!tage.length) { bereich.textContent = ''; return; }
  const text = `${tagMonat(tage[0])}–${tagMonat(tage[tage.length - 1])}${tage[tage.length - 1].slice(0, 4)}`;
  bereich.textContent = ansicht.modus === 'woche'
    ? `${text}${ansicht.zurueck === 0 ? ' · diese Woche' : ''}`
    : `${text} · ${tage.length} Tag${tage.length === 1 ? '' : 'e'}`;
}

/* ---- Zeichnen ---- */

/** Aufruf bei jeder Aenderung im Expositionsraster. `legacy`: Woche ohne Tageswerte. */
export function renderWochenGraph(tage, legacy) {
  letzte = { tage, legacy };
  const host = $('wochenGraph');
  if (!host) return;
  verdrahte();
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

/** Wochenansicht auf die Woche stellen, die der Bogen gerade bearbeitet. */
export function wochenGraphZeige(key) {
  if (ansicht.modus === 'woche') ansicht.zurueck = Math.max(0, Math.round(daysBetween(key, currentWeekKey()) / 7));
  if (letzte) zeichne();
}

/** Neu zeichnen, wenn sich die gespeicherten Wochen geaendert haben. */
export function wochenGraphNeu() {
  if (letzte) zeichne();
}

function zeichne() {
  const host = $('wochenGraph');
  const leer = $('wochenGraphLeer');
  const breite = Math.max(280, Math.round(host.clientWidth || 640));
  const heute = iso(new Date());
  const daten = tageswerte();
  const tage = zeitraum(daten);
  const N = tage.length;
  steuerung(daten, tage);

  /* Die Legende wird jedes Mal neu aufgebaut: die Reihen koennen sich
     aendern, sobald ein Stoff dazukommt oder eine Spalte verschwindet. */
  const reihen = graphStoffe();
  const legende = $('wochenGraphLegende');
  if (legende) {
    legende.textContent = '';
    reihen.forEach((x) => {
      const eintrag = document.createElement('span');
      const key = document.createElement('span');
      key.className = 'wg-key';
      key.style.background = x.farbe;
      eintrag.append(key, document.createTextNode(x.n));
      legende.appendChild(eintrag);
    });
  }

  const rs = reihen.map((x) => {
    const roh = tage.map((d) => (daten.has(d) ? daten.get(d)[x.k] : null));
    return {
      x,
      roh,
      werte: tage.map((d, i) => {
        if (d > heute || roh[i] === null) return null;
        if (d === heute && !(roh[i] > 0)) return null;
        return roh[i] > 0 ? zuMg(x, roh[i]) : 0;
      })
    };
  });
  const max = Math.max(0, ...rs.flatMap((r) => r.werte.filter((v) => v !== null)));

  host.textContent = '';
  if (!N || !(max > 0)) {
    leer.hidden = false;
    leer.textContent = ansicht.modus === 'woche' && ansicht.zurueck === 0
      ? (letzte && letzte.legacy
        ? 'Diese Woche wurde noch als Wochensumme erfasst — es gibt keine Tageswerte zum Zeichnen.'
        : 'Noch keine Injektion in dieser Woche eingetragen.')
      : 'Im gewählten Zeitraum ist keine Injektion erfasst.';
    return;
  }
  leer.hidden = true;

  const { s, top, n } = achse(max);
  const iw = breite - RAND.l - RAND.r;
  const ih = HOEHE - RAND.o - RAND.u;
  const spalte = iw / N;
  const px = (i) => RAND.l + spalte * (i + 0.5);
  const py = (v) => RAND.o + ih - (ih * v) / top;

  const svg = el('svg', {
    viewBox: `0 0 ${breite} ${HOEHE}`, width: breite, height: HOEHE, role: 'img',
    'aria-label': `Tagesmengen in mg je Wirkstoff, ${tagMonat(tage[0])} bis ${tagMonat(tage[N - 1])}. ` +
      'Mit den Pfeiltasten tageweise lesen; die Werte stehen auch im Raster darunter.'
  }, host);

  /* Raster und Achse: Haarlinien, zurueckhaltend. */
  for (let k = 0; k <= n; k++) {
    const y = py(k * s);
    el('line', { x1: RAND.l, x2: breite - RAND.r, y1: y, y2: y, class: k ? 'wg-grid' : 'wg-basis' }, svg);
    el('text', { x: RAND.l - 6, y: y + 3.5, class: 'wg-achse', 'text-anchor': 'end' }, svg)
      .textContent = zahl(k * s);
  }

  /* Tagesachse: in der Wochenansicht Wochentag und Datum, sonst nur so viele
     Daten, wie nebeneinander passen — gezaehlt vom letzten Tag her. */
  const woche = ansicht.modus === 'woche';
  const breiteLabel = woche ? (spalte < 50 ? 22 : 42) : 40;
  const jede = Math.max(1, Math.ceil(breiteLabel / spalte));
  tage.forEach((d, i) => {
    if ((N - 1 - i) % jede !== 0) return;
    el('text', {
      x: px(i), y: HOEHE - 8, 'text-anchor': 'middle',
      class: `wg-achse${d === heute ? ' wg-heute' : ''}${d > heute ? ' wg-zukunft' : ''}`
    }, svg).textContent = woche ? (spalte < 50 ? wtag(d) : `${wtag(d)} ${d.slice(8, 10)}.`) : tagMonat(d);
  });

  /* Fadenkreuz liegt unter den Kurven. */
  const kreuz = el('line', { y1: RAND.o, y2: RAND.o + ih, class: 'wg-kreuz', visibility: 'hidden' }, svg);

  /* Kurven: je zusammenhaengender Strecke erfasster Tage eine Bezier-Kurve. */
  rs.forEach((r) => {
    let pfad = '';
    let lauf = [];
    const schliesse = () => { if (lauf.length) pfad += kurve(lauf); lauf = []; };
    r.werte.forEach((v, i) => {
      if (v === null) { schliesse(); return; }
      lauf.push({ x: px(i), y: py(v) });
    });
    schliesse();
    if (pfad) el('path', { d: pfad, class: 'wg-linie', 'data-serie': r.x.k, style: `stroke:${r.x.farbe}` }, svg);
  });

  /* Punkte an Injektionstagen, mit Ring in Flaechenfarbe — nur solange die
     Tage weit genug auseinander liegen, dass sie sich nicht zudecken. */
  if (spalte >= PUNKT_ABSTAND) {
    rs.forEach((r) => r.werte.forEach((v, i) => {
      if (v > 0) el('circle', { cx: px(i), cy: py(v), r: 4, class: 'wg-punkt', style: `fill:${r.x.farbe}` }, svg);
    }));
  }

  /* Direktbeschriftung sparsam: je Wirkstoff nur der Hoechstwert im Zeitraum. */
  const belegt = [];
  rs.forEach((r) => {
    const m = Math.max(0, ...r.werte.filter((v) => v !== null));
    if (!(m > 0)) return;
    const i = r.werte.indexOf(m);
    /* Liegt eine andere Reihe am selben Tag knapp darueber, kommt die
       Beschriftung unter den Punkt statt auf deren Kurve. */
    const drueber = rs.some((o) => o !== r && o.werte[i] !== null && py(o.werte[i]) < py(m)
      && py(m) - py(o.werte[i]) < 22);
    let y = drueber ? py(m) + 17 : py(m) - 9;
    const schritt = drueber ? 12 : -12;
    while (belegt.some((b) => Math.abs(px(b.i) - px(i)) < 70 && Math.abs(b.y - y) < 12)) y += schritt;
    y = Math.min(Math.max(y, 10), RAND.o + ih - 4);
    belegt.push({ i, y });
    const anker = px(i) < RAND.l + 50 ? 'start' : px(i) > breite - RAND.r - 50 ? 'end' : 'middle';
    el('text', { x: px(i), y, class: 'wg-label', 'text-anchor': anker }, svg).textContent = `${r.x.n} ${zahl(m)}`;
  });

  /* Tooltip: die ganze Plotflaeche ist Trefferflaeche, der naechste Tag gewinnt.
     Per Tastatur blaettern die Pfeiltasten tageweise. */
  const tip = document.createElement('div');
  tip.className = 'wg-tip';
  tip.hidden = true;
  host.appendChild(tip);
  const flaeche = el('rect', {
    x: RAND.l, y: RAND.o, width: iw, height: ih, class: 'wg-hit', tabindex: 0,
    'aria-label': 'Tageswerte lesen: Pfeiltasten links und rechts'
  }, svg);
  let aktiv = -1;
  const zeige = (i) => {
    aktiv = Math.min(N - 1, Math.max(0, i));
    const d = tage[aktiv];
    kreuz.setAttribute('x1', px(aktiv));
    kreuz.setAttribute('x2', px(aktiv));
    kreuz.setAttribute('visibility', 'visible');
    tip.textContent = '';
    const kopf = document.createElement('div');
    kopf.className = 'wg-tip-kopf';
    kopf.textContent = `${wtag(d)} ${tagMonat(d)}${d.slice(0, 4)}`;
    tip.appendChild(kopf);
    if (!daten.has(d)) {
      const z = document.createElement('div');
      z.className = 'wg-tip-zeile';
      z.textContent = 'nicht erfasst';
      tip.appendChild(z);
    } else {
      rs.forEach((r) => {
        const v = r.werte[aktiv];
        const z = document.createElement('div');
        z.className = 'wg-tip-zeile';
        const key = document.createElement('span');
        key.className = 'wg-key';
        key.style.background = r.x.farbe;
        const wert = document.createElement('b');
        wert.textContent = v === null ? '—' : `${zahl(v)} mg`;
        const name = document.createElement('span');
        name.textContent = r.x.u === 'µg' && v > 0 ? `${r.x.n} (${zahl(r.roh[aktiv])} µg)` : r.x.n;
        z.append(key, wert, name);
        tip.appendChild(z);
      });
    }
    tip.hidden = false;
    const rechts = px(aktiv) / breite > 0.55;
    tip.style.left = rechts ? '' : `${px(aktiv) + 12}px`;
    tip.style.right = rechts ? `${breite - px(aktiv) + 12}px` : '';
    flaeche.setAttribute('aria-label', `${wtag(d)} ${tagMonat(d)}: ` + (daten.has(d)
      ? rs.map((r) => `${r.x.n} ${r.werte[aktiv] === null ? 'offen' : `${zahl(r.werte[aktiv])} mg`}`).join(', ')
      : 'nicht erfasst'));
  };
  const weg = () => { kreuz.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  const index = (ev) => {
    const box = svg.getBoundingClientRect();
    const x = (ev.clientX - box.left) * (breite / box.width);
    return Math.round((x - RAND.l) / spalte - 0.5);
  };
  flaeche.addEventListener('pointermove', (ev) => zeige(index(ev)));
  flaeche.addEventListener('pointerleave', weg);
  flaeche.addEventListener('focus', () => zeige(aktiv < 0 ? N - 1 : aktiv));
  flaeche.addEventListener('blur', weg);
  flaeche.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') { zeige(aktiv - 1); ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { zeige(aktiv + 1); ev.preventDefault(); }
  });
}
