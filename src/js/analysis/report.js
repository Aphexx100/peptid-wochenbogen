/* Die Auswertungsseite.
   Aufgeteilt in vier Bloecke, die unabhaengig voneinander rendern: Kacheln,
   Verlaufsgrafiken, Wochentabelle.
   Wer eine Kennzahl ergaenzen will, fasst nur den zugehoerigen Block an —
   eine neue Verlaufsgrafik ist eine Zeile in buildSeries(). */

import { state, keys } from '../state.js';
import { $ } from '../util/dom.js';
import { fmt, num, mean } from '../util/format.js';
import { weekNumber } from '../util/date.js';
import { KERN } from '../schema.js';
import { sparkline } from './sparkline.js';
import {
  whoScore, primary, hautMean, gelenkMean, wohlVal,
  kraftIndex, taillenQuotient, pearson, drift, last
} from './metrics.js';

/* ---- Kacheln ---- */

function renderKacheln(list, libs, libV) {
  $('tWeeks').textContent = keys().length;

  const exps = list.map((e) => (e.exp ? e.exp.erwartung : null));
  const mExp = mean(exps.filter((v) => v !== null && v !== undefined));
  $('tExp').textContent = mExp === null ? '—' : fmt(mExp, 1);

  const lastLib = last(libs);
  $('tLib').innerHTML = (lastLib === null ? '—' : fmt(lastLib, 1)) + '<span class="unit">/ 10</span>';
  $('tLibSub').textContent = libV.length
    ? `Letzte erfasste Woche. Mittel über alle Wochen: ${fmt(mean(libV), 1)} von 10.`
    : 'Letzte erfasste Woche.';

  const ld = drift(libV);
  if (ld !== null) {
    $('tLibDelta').textContent = (ld >= 0 ? '+' : '') + fmt(ld, 2);
    $('tLibDeltaSub').textContent =
      Math.abs(ld) < 0.3
        ? 'Kein nennenswerter Trend. Bei einem Wochenmaß ist das unter zehn Wochen normal.'
        : ld > 0
          ? 'Aufwärtstrend. Gegen Erwartung, Schlaf und Gewichtsverlauf gegenprüfen.'
          : 'Abwärtstrend. Confounder-Spalten und Wochenkommentar lesen.';
  } else {
    $('tLibDelta').textContent = '—';
  }
  return exps;
}

/* ---- Muskelerhalt: faellt das Gewicht, ohne dass Kraft und Umfang mitgehen? ---- */

function renderMuskel(list) {
  const gw = list.map((e) => (e.conf ? num(e.conf.gew) : null)).filter((v) => v !== null);
  const kx = list.map(kraftIndex).filter((v) => v !== null);
  const arm = list.map((e) => (e.masse ? num(e.masse.mArmR) : null)).filter((v) => v !== null);
  const dGw = drift(gw);
  const dKx = drift(kx);
  const dArm = drift(arm);

  $('tGew').textContent = gw.length ? `${fmt(gw[gw.length - 1], 1)} kg` : '—';
  $('tGewSub').textContent =
    dGw === null ? 'Ab vier Wochen berechenbar.' : `${dGw >= 0 ? '+' : ''}${fmt(dGw, 1)} kg über die Serie`;

  if (dGw !== null && dGw < -0.5) {
    const teile = [];
    if (dKx !== null) teile.push(`Kraftindex ${dKx >= 0 ? '+' : ''}${fmt(dKx, 0)}`);
    if (dArm !== null) teile.push(`Oberarm ${dArm >= 0 ? '+' : ''}${fmt(dArm, 1)} cm`);
    const erhalten = (dKx !== null && dKx >= 0) || (dArm !== null && dArm >= -0.3);
    $('tMuskel').textContent = erhalten ? 'gehalten' : 'prüfen';
    $('tMuskelSub').textContent =
      (teile.length ? `${teile.join(', ')}. ` : '') +
      (erhalten
        ? 'Gewicht fällt, Kraft und Umfang halten — das ist das gewünschte Muster.'
        : 'Gewicht fällt und Kraft oder Umfang geben mit nach. Protein und Trainingslasten prüfen.');
  } else {
    $('tMuskel').textContent = '—';
    $('tMuskelSub').textContent = 'Braucht vier Wochen und einen erkennbaren Gewichtsverlust.';
  }
}

/* ---- Erwartung gegen Ergebnis, und die Negativkontrollen daneben ---- */

function renderKontrollen(list, libV) {
  const pa = [];
  const pb = [];
  list.forEach((e) => {
    const a = e.exp ? e.exp.erwartung : null;
    const b = primary(e);
    if (a !== null && a !== undefined && b !== null) {
      pa.push(a);
      pb.push(b);
    }
  });
  const r = pearson(pa, pb);
  $('tCorr').textContent = r === null ? '—' : `r = ${fmt(r, 2)}`;
  $('tCorrSub').textContent =
    r === null
      ? 'Ab etwa sechs Wochen aussagekräftig.'
      : Math.abs(r) >= 0.6
        ? 'Ergebnis und Erwartung laufen eng zusammen. Das spricht eher für Erwartung als für Wirkstoff.'
        : Math.abs(r) >= 0.3
          ? 'Teilweiser Gleichlauf. Beobachten, ob er sich mit mehr Wochen verstärkt.'
          : 'Ergebnis verläuft weitgehend unabhängig von der Erwartung. Das ist das Muster, das du sehen willst.';

  /* Die Negativkontrollen sind 2026-11 aus dem Bogen gefallen. Damit fehlt
     die eingebaute Gegenprobe gegen "alles steigt, weil die Woche gut war".
     Was bleibt, ist der naechstliegende Ersatz: laeuft der Endpunkt mit dem
     Schlaf, ist Schlaf die sparsamere Erklaerung. */
  const sa = [];
  const sb = [];
  list.forEach((e) => {
    const schlaf = e.conf ? num(e.conf.schlaf) : null;
    const p = primary(e);
    if (schlaf !== null && p !== null) {
      sa.push(schlaf);
      sb.push(p);
    }
  });
  const rs = pearson(sa, sb);
  $('tNeg').textContent = rs === null ? '—' : `r = ${fmt(rs, 2)}`;
  $('tNegSub').textContent = rs === null
    ? 'Ab sechs Wochen mit Schlafwerten berechenbar.'
    : Math.abs(rs) >= 0.6
      ? 'Endpunkt läuft eng mit dem Schlaf. Schlaf ist dann die sparsamere Erklärung.'
      : Math.abs(rs) >= 0.3
        ? 'Teilweiser Gleichlauf mit dem Schlaf. Im Blick behalten.'
        : 'Endpunkt verläuft weitgehend unabhängig vom Schlaf.';
}

/* ---- Verlaufsgrafiken ----
   Eine Zeile hier ergibt eine Grafik. `max` ist die Skalenobergrenze oder
   "auto" fuer freie Achse. Reihen mit weniger als zwei Werten fallen
   automatisch weg. */

export function buildSeries(list, exps) {
  const series = [
    { n: 'Kernbereiche Ø (Primärendpunkt)', v: list.map(primary), max: 10 },
    { n: 'Gewicht (kg)', v: list.map((e) => (e.conf ? num(e.conf.gew) : null)), max: 'auto' },
    { n: 'Bauchumfang (cm)', v: list.map((e) => (e.conf ? num(e.conf.bauch) : null)), max: 'auto' },
    { n: 'Erwartung', v: exps, max: 10 },
    { n: 'WHO-5', v: list.map(whoScore), max: 100 },
    { n: 'Schlaf Ø (h/Nacht)', v: list.map((e) => (e.conf ? num(e.conf.schlaf) : null)), max: 'auto' },
    { n: 'Training (h/Woche)', v: list.map((e) => (e.conf ? num(e.conf.train) : null)), max: 'auto' },
    { n: 'Protein Ø (g/Tag)', v: list.map((e) => (e.conf ? num(e.conf.protein) : null)), max: 'auto' },
    { n: 'Kreatin (g/Woche)', v: list.map((e) => (e.dose ? num(e.dose.kreatin) : null)), max: 'auto' },
    { n: 'Alkohol (Liter/Woche)', v: list.map((e) => (e.conf ? num(e.conf.alk) : null)), max: 'auto' },
    { n: 'GLOW-Ziel: Hautbild Ø', v: list.map(hautMean), max: 10 },
    { n: 'GLOW-Ziel: Gelenke Ø', v: list.map(gelenkMean), max: 10 },
    { n: 'GLOW-Ziel: Wohlbefinden', v: list.map(wohlVal), max: 10 },
    { n: 'Kraftindex (kg × Wdh, Summe)', v: list.map(kraftIndex), max: 'auto' },
    { n: 'Oberarm rechts (cm)', v: list.map((e) => (e.masse ? num(e.masse.mArmR) : null)), max: 'auto' },
    { n: 'Oberschenkel rechts (cm)', v: list.map((e) => (e.masse ? num(e.masse.mBeinR) : null)), max: 'auto' },
    { n: 'Brustumfang (cm)', v: list.map((e) => (e.masse ? num(e.masse.mBrust) : null)), max: 'auto' },
    { n: 'Taille zu Gliedmaßen', v: list.map(taillenQuotient), max: 'auto' }
  ];
  KERN.forEach((x) => {
    series.push({ n: x.n, v: list.map((e) => (e.kern ? e.kern[x.k] : null)), max: 10 });
  });
  return series;
}

function renderSparks(list, exps, labels) {
  const host = $('sparks');
  host.innerHTML = '';
  let any = false;
  buildSeries(list, exps).forEach((s) => {
    const el = sparkline(s.n, s.v, labels, s.max);
    if (el) {
      host.appendChild(el);
      any = true;
    }
  });
  $('sparkEmpty').hidden = any;
}

/* ---- Wochentabelle ---- */

function renderWeekTable(ks) {
  const wt = $('weekTable');
  if (!ks.length) {
    wt.innerHTML = '';
    $('weekEmpty').hidden = false;
    return;
  }
  $('weekEmpty').hidden = true;
  const rows = ks
    .slice()
    .reverse()
    .map((k) => {
      const e = state.weeks[k];
      const nr = weekNumber(k);
      return (
        `<tr><td class="n">${nr ? `W${nr}` : '—'}</td><td class="n">${k}</td>` +
        `<td class="n">${e.dose ? e.dose.glow : '—'}/${e.dose ? e.dose.kiss : '—'}/${e.dose ? e.dose.pt : '—'}</td>` +
        `<td class="n">${fmt(e.exp ? e.exp.erwartung : null, 0)}</td>` +
        `<td class="n">${fmt(primary(e), 1)}</td>` +
        `<td class="n">${whoScore(e) === null ? '—' : whoScore(e)}</td>` +
        `<td class="n">${kraftIndex(e) === null ? '—' : kraftIndex(e)}</td></tr>`
      );
    })
    .join('');
  wt.innerHTML =
    '<thead><tr><th>Wo.</th><th>Datum</th><th>G/K/P</th><th>Erw.</th><th>Kern-Ø</th>' +
    `<th>WHO-5</th><th>Kraft</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ---- Einstieg ---- */

export function renderAus() {
  const ks = keys();
  const list = ks.map((k) => state.weeks[k]);
  const labels = ks.map((k) => {
    const nr = weekNumber(k);
    return nr ? `W${nr}` : `${k.slice(8, 10)}.${k.slice(5, 7)}.`;
  });
  const libs = list.map(primary);
  const libV = libs.filter((v) => v !== null);

  const exps = renderKacheln(list, libs, libV);
  renderMuskel(list);
  renderKontrollen(list, libV);
  renderSparks(list, exps, labels);
  renderWeekTable(ks);
}
