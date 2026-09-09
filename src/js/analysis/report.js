/* Die Auswertungsseite.
   Aufgeteilt in fuenf Bloecke, die unabhaengig voneinander rendern: Kacheln,
   verblindeter Durchgang, PT-141-Tabelle, Verlaufsgrafiken, Wochentabelle.
   Wer eine Kennzahl ergaenzen will, fasst nur den zugehoerigen Block an —
   eine neue Verlaufsgrafik ist eine Zeile in buildSeries(). */

import { state, keys } from '../state.js';
import { $ } from '../util/dom.js';
import { fmt, num, mean } from '../util/format.js';
import { weekNumber } from '../util/date.js';
import { KERN } from '../schema.js';
import { sparkline } from './sparkline.js';
import {
  whoScore, iiefScore, kernMean, negMean, primary, hautMean, gelenkMean, wohlVal,
  kraftIndex, taillenQuotient, pearson, drift, last
} from './metrics.js';

/* ---- Kacheln ---- */

function renderKacheln(list, libs, libV) {
  $('tWeeks').textContent = keys().length;

  const exps = list.map((e) => (e.exp ? e.exp.erwartung : null));
  const mExp = mean(exps.filter((v) => v !== null && v !== undefined));
  $('tExp').textContent = mExp === null ? '—' : fmt(mExp, 1);

  const mMorgen = mean(list.map((e) => (e.morgen ? e.morgen.naechte : null)));
  $('tMorgen').textContent = mMorgen === null ? '—' : fmt(mMorgen, 1);

  const lastLib = last(libs);
  $('tLib').innerHTML = (lastLib === null ? '—' : String(lastLib)) + '<span class="unit">/ 25</span>';
  $('tLibSub').textContent = libV.length
    ? `Letzte erfasste Woche. Mittel über alle Wochen: ${fmt(mean(libV), 1)} von 25.`
    : 'Letzte erfasste Woche.';

  const ld = drift(libV);
  if (ld !== null) {
    $('tLibDelta').textContent = (ld >= 0 ? '+' : '') + fmt(ld, 2);
    $('tLibDeltaSub').textContent =
      Math.abs(ld) < 0.5
        ? 'Kein nennenswerter Trend. Bei einem Wochenmaß ist das unter zehn Wochen normal.'
        : ld > 0
          ? 'Aufwärtstrend. Gegen Negativkontrollen und Gewichtsverlauf gegenprüfen.'
          : 'Abwärtstrend. Kontext- und Confounder-Spalten lesen.';
  } else {
    $('tLibDelta').textContent = '—';
  }

  $('tLibTage').textContent = $('tMorgen').textContent;
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

  const negs = list.map(negMean).filter((v) => v !== null);
  const d = drift(negs);
  if (d === null) {
    $('tNeg').textContent = '—';
    $('tNegSub').textContent = 'Ab vier Wochen berechenbar.';
    return;
  }
  const ldrift = drift(libV);
  $('tNeg').textContent = (d >= 0 ? '+' : '') + fmt(d, 2);
  $('tNegSub').textContent =
    Math.abs(d) < 0.4
      ? 'Kontrollen bleiben flach' +
        (ldrift !== null && ldrift > 0.6
          ? ' — während IIEF-5 steigt. Das ist der Befund, der zählt.'
          : '. Erwartungsgetriebene Drift ist bisher nicht erkennbar.')
      : 'Kontrollen bewegen sich mit. Ein Anstieg im Primärendpunkt ist dann vermutlich global, nicht substanzspezifisch.';
}

/* ---- Verblindeter PT-141-Durchgang ---- */

function renderBlind(list) {
  const bl = list.filter(
    (e) => e.pt && e.pt.actual && (e.pt.actual === 'wirkstoff' || e.pt.actual === 'placebo')
  );
  const bt = $('blindTable');
  if (!bl.length) {
    bt.innerHTML = '';
    $('blindEmpty').hidden = false;
    return;
  }
  $('blindEmpty').hidden = true;

  const verlangen = (arr) =>
    mean(arr.map((x) => (x.pt && x.pt.ptMit !== undefined && x.pt.ptMit !== null ? x.pt.ptMit : null)));
  const drug = bl.filter((e) => e.pt.actual === 'wirkstoff');
  const plac = bl.filter((e) => e.pt.actual === 'placebo');
  const md = verlangen(drug);
  const mp = verlangen(plac);
  const guessed = bl.filter((e) => e.pt.guess === 'wirkstoff' || e.pt.guess === 'placebo');
  const right = guessed.filter((e) => e.pt.guess === e.pt.actual).length;
  const rate = guessed.length ? right / guessed.length : null;
  const verdict =
    rate === null
      ? '—'
      : rate >= 0.85
        ? 'Verblindung durchlässig — Differenz mit Erwartung kontaminiert'
        : rate >= 0.65
          ? 'Teilweise durchlässig — Differenz vorsichtig lesen'
          : 'Verblindung weitgehend gehalten — Differenz ist belastbar';

  bt.innerHTML =
    '<tbody>' +
    `<tr><td>Entblindete Durchgänge</td><td class="n">${bl.length} (${drug.length} Wirkstoff / ${plac.length} Placebo)</td></tr>` +
    `<tr><td>Verlangen Wirkstoff-Wochen</td><td class="n">${md === null ? '—' : fmt(md, 2)}</td></tr>` +
    `<tr><td>Verlangen Placebo-Wochen</td><td class="n">${mp === null ? '—' : fmt(mp, 2)}</td></tr>` +
    `<tr><td><b>Differenz</b></td><td class="n"><b>${
      md === null || mp === null ? '—' : (md - mp >= 0 ? '+' : '') + fmt(md - mp, 2)
    }</b></td></tr>` +
    `<tr><td>Trefferquote der Vermutung</td><td class="n">${
      rate === null ? '—' : `${right} von ${guessed.length} · ${Math.round(rate * 100)} %`
    }</td></tr>` +
    `<tr><td>Bewertung</td><td>${verdict}</td></tr>` +
    '</tbody>';
}

/* ---- PT-141 gesamt ---- */

function renderPt(list) {
  const ptw = list.filter(
    (e) => e.dose && e.dose.pt > 0 && e.pt && e.pt.ptMit !== undefined && e.pt.ptMit !== null
  );
  const t = $('ptTable');
  if (!ptw.length) {
    t.innerHTML = '';
    $('ptEmpty').hidden = false;
    return;
  }
  $('ptEmpty').hidden = true;

  const mm = mean(ptw.map((e) => e.pt.ptMit));
  const mo = mean(ptw.map((e) => e.pt.ptOhne));
  const mnw = mean(ptw.map((e) => e.pt.ptNw));
  const blind = ptw.map((e) => e.pt.blind).filter(Boolean);
  const erk = blind.filter((b) => b === 'ja' || b === 'wahrscheinlich').length;
  const aus = ptw.map((e) => e.pt.ausloesung).filter(Boolean);
  const reiz = aus.filter((a) => a === 'reiz').length;
  const streck = ptw.filter(
    (e) => e.pt.signs && (e.pt.signs.indexOf('sStreck') >= 0 || e.pt.signs.indexOf('sGaehn') >= 0)
  ).length;

  t.innerHTML =
    '<tbody>' +
    `<tr><td>Wochen mit Anwendung</td><td class="n">${ptw.length}</td></tr>` +
    `<tr><td>Verlangen an Anwendungstagen</td><td class="n">${fmt(mm, 1)} / 10</td></tr>` +
    `<tr><td>Verlangen an Tagen ohne</td><td class="n">${fmt(mo, 1)} / 10</td></tr>` +
    `<tr><td><b>Differenz</b></td><td class="n"><b>${mm - mo >= 0 ? '+' : ''}${fmt(mm - mo, 1)}</b></td></tr>` +
    `<tr><td>Nebenwirkungen Ø</td><td class="n">${mnw === null ? '—' : `${fmt(mnw, 1)} / 10`}</td></tr>` +
    `<tr><td>Anwendungstag erkennbar</td><td class="n">${erk} von ${blind.length}</td></tr>` +
    `<tr><td>Nur bei sexuellem Reiz ausgelöst</td><td class="n">${reiz} von ${aus.length}</td></tr>` +
    `<tr><td>Wochen mit Strecken oder Gähnen</td><td class="n">${streck} von ${ptw.length}</td></tr>` +
    '</tbody>';
}

/* ---- Verlaufsgrafiken ----
   Eine Zeile hier ergibt eine Grafik. `max` ist die Skalenobergrenze oder
   "auto" fuer freie Achse. Reihen mit weniger als zwei Werten fallen
   automatisch weg. */

export function buildSeries(list, exps) {
  const series = [
    { n: 'IIEF-5 (Primärendpunkt)', v: list.map(primary), max: 25 },
    { n: 'Gewicht (kg)', v: list.map((e) => (e.conf ? num(e.conf.gew) : null)), max: 'auto' },
    { n: 'Bauchumfang (cm)', v: list.map((e) => (e.conf ? num(e.conf.bauch) : null)), max: 'auto' },
    { n: 'Morgen mit spontaner Erektion (von 7)', v: list.map((e) => (e.morgen ? e.morgen.naechte : null)), max: 7 },
    { n: 'Erwartung', v: exps, max: 10 },
    { n: 'Kernbereiche Ø', v: list.map(kernMean), max: 10 },
    { n: 'WHO-5', v: list.map(whoScore), max: 100 },
    { n: 'Negativkontrollen Ø', v: list.map(negMean), max: 10 },
    { n: 'Bräunungsgeschwindigkeit', v: list.map((e) => (e.pigment ? e.pigment.pTempo : null)), max: 10 },
    { n: 'UV-Stunden', v: list.map((e) => (e.pigment && e.pigment.uv !== '' ? Number(e.pigment.uv) : null)), max: 20 },
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
        `<td class="n">${primary(e) === null ? '—' : primary(e)}</td>` +
        `<td class="n">${fmt(kernMean(e), 1)}</td>` +
        `<td class="n">${whoScore(e) === null ? '—' : whoScore(e)}</td>` +
        `<td class="n">${(e.watch && e.watch.length) || '—'}</td></tr>`
      );
    })
    .join('');
  wt.innerHTML =
    '<thead><tr><th>Wo.</th><th>Datum</th><th>G/K/P</th><th>Erw.</th><th>IIEF-5</th>' +
    `<th>Kern</th><th>WHO-5</th><th>Flags</th></tr></thead><tbody>${rows}</tbody>`;
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
  renderBlind(list);
  renderPt(list);
  renderSparks(list, exps, labels);
  renderWeekTable(ks);
}
