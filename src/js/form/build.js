/* Baut das Wochenformular aus den Definitionen in schema.js auf.
   Hier steht keine einzige Frage im Klartext — wer eine Frage ergaenzen will,
   traegt sie in schema.js ein und sie erscheint hier von selbst. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { fmt } from '../util/format.js';
import { CU_ANTEIL, CU_RDA_MG_TAG } from '../constants.js';
import {
  EXPO, KERN, GLOWZIEL, WHO, WHO_LEG, IIEF, MORGEN, PT, PT_SIGNS, PIGMENT, NEG,
  WATCH, CONF_CHECKS, MONTH
} from '../schema.js';
import { slider, segment, checkList, segVal, setSegHandler } from '../ui/controls.js';
import { cuWeek } from '../analysis/metrics.js';
import { keys } from '../state.js';
import { iso, weekDays } from '../util/date.js';

/* ---- Tagesraster der Exposition ----
   Sieben Zeilen (aeltester Tag zuerst, letzter ist der Erfassungstag), eine
   Spalte je Substanz aus EXPO. Die Wochensummen fuer CSV, Auswertung und
   Datenblock werden daraus abgeleitet — vor der Umstellung erfasste Wochen
   tragen nur die Summen; ihr dose-Objekt bleibt beim erneuten Speichern
   erhalten, solange das Raster leer ist. */

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const IDX = [0, 1, 2, 3, 4, 5, 6];
const zellId = (k, i) => `x${k}${i}`;

/* Wochensummen einer vor der Umstellung erfassten Woche — gesetzt von
   fillForm(), gelesen von Zusammenfassung, Kupferlast und readForm(). */
let legacyDose = null;
export function setLegacyDose(d) { legacyDose = d; }
export function getLegacyDose() { return legacyDose; }

/* ---- Aktuelle Vials ----
   Ist fuer eine Substanz ein Vial hinterlegt (Inhalt in mg, Wasser in ml),
   laeuft ihre Spalte im Tagesraster in ml: eingetragen wird das aufgezogene
   Volumen, die Wirkstoffmenge entsteht aus der Konzentration. Gespeichert
   wird trotzdem immer die Wirkstoffmenge in der Einheit der Substanz —
   Auswertung, CSV und Datenblock bleiben damit vial-unabhaengig. */

/** Konzentration in mg/ml aus den gespeicherten Vials; 0 = kein Vial. */
export function vialKonz(k) {
  const v = state.cfg.vials && state.cfg.vials[k];
  if (!v || !(Number(v.mg) > 0) || !(Number(v.ml) > 0)) return 0;
  return Number(v.mg) / Number(v.ml);
}

/* Welche Konzentration jede Rasterspalte gerade benutzt (0 = direkte
   Eingabe in mg/µg). Beim Umschalten werden eingetragene Werte umgerechnet. */
const modus = {};

const rund3 = (v) => Math.round(v * 1000) / 1000;

/** ml einer Zelle in die Substanz-Einheit umrechnen (µg-Substanzen ×1000). */
const mlZuMenge = (ml, x, konz) => rund3(ml * konz * (x.u === 'µg' ? 1000 : 1));
const mengeZuMl = (menge, x, konz) => rund3(menge / (x.u === 'µg' ? 1000 : 1) / konz);

/** Raster auslesen. `tage` traegt immer die Wirkstoffmenge in der Einheit der
    Substanz; `tageMl` die ml-Rohwerte der Spalten im ml-Modus. */
export function readExpo() {
  const start = weekDays(state.weekKey)[0];
  const tage = { start };
  const tageMl = { start };
  let leer = true;
  let hatMl = false;
  EXPO.forEach((x) => {
    const konz = modus[x.k] || 0;
    if (konz > 0) hatMl = true;
    tageMl[x.k] = [];
    tage[x.k] = IDX.map((i) => {
      const v = document.getElementById(zellId(x.k, i)).value.trim();
      if (Number(v) > 0) leer = false;
      if (!(konz > 0)) { tageMl[x.k].push(''); return v; }
      tageMl[x.k].push(v);
      return Number(v) > 0 ? String(mlZuMenge(Number(v), x, konz)) : '';
    });
  });
  return { tage, tageMl, hatMl, leer };
}

/** Wochensummen aus dem Raster: Injektionstage, haeufigste Tagesdosis,
    Tirzepatid als Wochensumme — dieselbe Form wie vor der Umstellung. */
export function ableiten(tage) {
  const out = {};
  EXPO.forEach((x) => {
    const werte = tage[x.k].map(Number).filter((v) => v > 0);
    if (x.k === 'tirz') {
      out.tirz = werte.length ? String(+werte.reduce((a, b) => a + b, 0).toFixed(2)) : '';
      return;
    }
    let best = '';
    let bestN = 0;
    const zaehl = {};
    werte.forEach((v) => {
      zaehl[v] = (zaehl[v] || 0) + 1;
      if (zaehl[v] >= bestN) { bestN = zaehl[v]; best = v; }
    });
    out[`n_${x.k}`] = werte.length;
    out[`d_${x.k}`] = werte.length ? String(best) : '';
  });
  return out;
}

function glowInjTage() {
  const { tage, leer } = readExpo();
  if (leer && legacyDose) return Number(legacyDose.glow) || 0;
  return tage.glow.filter((v) => Number(v) > 0).length;
}

const komma = (v) => String(v).replace('.', ',');

function renderExpoSummary() {
  const el = $('expoSum');
  const { tage, leer } = readExpo();
  if (leer && legacyDose) {
    el.innerHTML = '<b>Vor der Umstellung als Wochensumme erfasst:</b> ' +
      `GLOW ${legacyDose.glow || 0} Inj. à ${komma(legacyDose.dGlow) || '—'} mg, ` +
      `Kisspeptin ${legacyDose.kiss || 0} Inj. à ${komma(legacyDose.dKiss) || '—'} µg, ` +
      `PT-141 ${legacyDose.pt || 0} Anw. à ${komma(legacyDose.dPt) || '—'} mg, ` +
      `Tirzepatid ${komma(legacyDose.tirz) || '—'} mg. ` +
      'Sobald du einen Tag einträgst, ersetzt das Tagesraster diese Werte.';
    return;
  }
  const a = ableiten(tage);
  const teil = EXPO.map((x) => {
    if (x.k === 'tirz') return `Tirzepatid: ${a.tirz ? `${komma(a.tirz)} mg diese Woche` : '—'}`;
    const n = a[`n_${x.k}`];
    return `${x.n}: ${n ? `${n} Injektionstag${n > 1 ? 'e' : ''} à ${komma(a[`d_${x.k}`])} ${x.u}` : '—'}`;
  });
  el.innerHTML = `<b>Diese Woche:</b> ${teil.join(' · ')}`;
}

/** Menge huebsch anzeigen: bis zwei Nachkommastellen, ohne Nullenrest. */
const mengeText = (v, u) => `${komma(+Number(v).toFixed(u === 'µg' ? 1 : 2))} ${u}`;

/* Die berechnete Wirkstoffmenge unter jeder ml-Zelle nachfuehren. */
function renderMengen() {
  EXPO.forEach((x) => {
    const konz = modus[x.k] || 0;
    IDX.forEach((i) => {
      const span = document.getElementById(`c${x.k}${i}`);
      if (!span) return;
      const v = Number(document.getElementById(zellId(x.k, i)).value);
      span.textContent = konz > 0 && v > 0 ? `= ${mengeText(mlZuMenge(v, x, konz), x.u)}` : '';
    });
  });
}

function expoChanged() {
  renderMengen();
  renderExpoSummary();
  renderCu();
  const { tage, leer } = readExpo();
  const nPt = leer && legacyDose
    ? Number(legacyDose.pt) || 0
    : tage.pt.filter((v) => Number(v) > 0).length;
  $('ptCard').hidden = !(nPt > 0);
}

/** Raster fuer die aktuelle Woche aufbauen. Bereits eingetragene Werte
    ueberleben den Neuaufbau (etwa wenn sich der Erfassungstag aendert). */
export function buildExpo() {
  const host = $('s-expo');
  const alt = {};
  EXPO.forEach((x) => {
    alt[x.k] = IDX.map((i) => {
      const el = document.getElementById(zellId(x.k, i));
      return el ? el.value : '';
    });
  });
  EXPO.forEach((x) => { modus[x.k] = vialKonz(x.k); });
  const tage = weekDays(state.weekKey);
  const heute = iso(new Date());
  const einheit = (x) => (modus[x.k] > 0 ? 'ml' : x.u);
  /* Die Einheit darf nicht in die Grossschreibung der Kopfzeile geraten —
     aus "µg" wuerde sonst optisch "MG", und das ist der Faktor tausend. */
  let html = '<thead><tr><th>Tag</th>' + EXPO.map((x) =>
    `<th id="xh${x.k}">${x.n} <span style="text-transform:none;letter-spacing:0">(${einheit(x)})</span></th>`).join('') +
    '</tr></thead><tbody>';
  tage.forEach((d, i) => {
    const wd = WTAG[new Date(`${d}T12:00:00`).getDay()];
    html += `<tr${d === heute ? ' data-heute="1"' : ''}>` +
      `<td class="tag">${wd} ${d.slice(8, 10)}.${d.slice(5, 7)}.</td>` +
      EXPO.map((x) =>
        `<td><input type="number" id="${zellId(x.k, i)}" min="0" ` +
        `step="${modus[x.k] > 0 ? 0.01 : x.step}" inputmode="decimal" ` +
        `aria-label="${x.n} (${einheit(x)}) am ${wd} ${d}">` +
        `<span class="xcalc" id="c${x.k}${i}"></span></td>`).join('') +
      '</tr>';
  });
  host.innerHTML = `${html}</tbody>`;
  EXPO.forEach((x) => IDX.forEach((i) => {
    const el = document.getElementById(zellId(x.k, i));
    if (alt[x.k][i]) el.value = alt[x.k][i];
    el.addEventListener('input', expoChanged);
  }));
  expoChanged();
}

/** Nach dem Speichern oder Uebernehmen eines Vials: Spalten umstellen.
    Eingetragene Werte werden mitgenommen — beim Wechsel auf ml aus der
    Wirkstoffmenge zurueckgerechnet, beim Wegfall des Vials wieder in die
    Wirkstoffmenge; ein blosser Konzentrationswechsel laesst ml-Werte stehen,
    denn aufgezogen wurde, was aufgezogen wurde. */
export function refreshExpoUnits() {
  EXPO.forEach((x) => {
    const alt = modus[x.k] || 0;
    const neu = vialKonz(x.k);
    if ((alt > 0) !== (neu > 0)) {
      IDX.forEach((i) => {
        const el = document.getElementById(zellId(x.k, i));
        const v = Number(el.value);
        if (!(v > 0)) return;
        el.value = neu > 0 ? String(mengeZuMl(v, x, neu)) : String(mlZuMenge(v, x, alt));
      });
    }
    modus[x.k] = neu;
    const u = neu > 0 ? 'ml' : x.u;
    const th = document.getElementById(`xh${x.k}`);
    if (th) th.innerHTML = `${x.n} <span style="text-transform:none;letter-spacing:0">(${u})</span>`;
    IDX.forEach((i) => {
      document.getElementById(zellId(x.k, i)).step = neu > 0 ? 0.01 : x.step;
    });
  });
  expoChanged();
}

/* ---- Karte "Aktuelle Vials" ---- */

function vialKonzText(x) {
  const mg = Number($(`vMg${x.k}`).value);
  const ml = Number($(`vMl${x.k}`).value);
  if (!(mg > 0 && ml > 0)) return 'kein Vial hinterlegt — Eingabe direkt in ' + x.u;
  const konz = mg / ml;
  const inU = x.u === 'µg' ? `${fmt(konz * 1000, 0)} µg/ml` : `${fmt(konz, 2)} mg/ml`;
  return `${inU} — 0,1 ml (10 I.E.) entsprechen ${mengeText(mlZuMenge(0.1, x, konz), x.u)}`;
}

function renderVialKonz() {
  EXPO.forEach((x) => { $(`vKonz${x.k}`).textContent = vialKonzText(x); });
}

/** Felder der Vial-Karte in cfg.vials uebernehmen (ohne zu speichern). */
export function readVials() {
  const out = {};
  EXPO.forEach((x) => {
    const mg = Number($(`vMg${x.k}`).value);
    const ml = Number($(`vMl${x.k}`).value);
    if (mg > 0 && ml > 0) out[x.k] = { mg, ml };
  });
  return out;
}

/** Vial-Karte aufbauen und aus cfg.vials fuellen. */
export function buildVials() {
  const host = $('s-vials');
  host.innerHTML = '';
  EXPO.forEach((x) => {
    const v = (state.cfg.vials && state.cfg.vials[x.k]) || {};
    const d = document.createElement('div');
    d.className = 'grid3';
    d.style.marginBottom = '.7rem';
    d.innerHTML =
      `<div class="field" style="grid-column:1/-1;margin:0 0 .3rem">` +
      `<label class="fl" style="margin:0">${x.n}</label></div>` +
      `<div class="field"><label class="fl" for="vMg${x.k}">Vial-Inhalt (mg)</label>` +
      `<input type="number" id="vMg${x.k}" min="0" step="0.5" inputmode="decimal" value="${v.mg || ''}"></div>` +
      `<div class="field"><label class="fl" for="vMl${x.k}">Bac Water (ml)</label>` +
      `<input type="number" id="vMl${x.k}" min="0" step="0.1" inputmode="decimal" value="${v.ml || ''}"></div>` +
      `<div class="field" style="align-self:end"><span class="vkonz" id="vKonz${x.k}"></span></div>`;
    host.appendChild(d);
  });
  EXPO.forEach((x) => ['vMg', 'vMl'].forEach((p) => {
    $(`${p}${x.k}`).addEventListener('input', renderVialKonz);
  }));
  renderVialKonz();
}

/** Raster aus einem gespeicherten Eintrag fuellen; `dose` darf fehlen.
    Spalten im ml-Modus bekommen die ml-Rohwerte (oder rechnen die
    Wirkstoffmenge zurueck), die uebrigen die Wirkstoffmenge direkt.
    Zugeordnet wird ueber das Kalenderdatum, damit ein spaeter geaenderter
    Erfassungstag die Werte nicht in falsche Zeilen schiebt. */
export function fuelleExpo(dose) {
  const dates = weekDays(state.weekKey);
  const map = {};
  const tage = dose && dose.tage;
  const tageMl = dose && dose.tageMl;
  if (tage && tage.start) {
    EXPO.forEach((x) => {
      const konz = modus[x.k] || 0;
      (tage[x.k] || []).forEach((v, i) => {
        const d = new Date(`${tage.start}T12:00:00`);
        d.setDate(d.getDate() + i);
        let wert = v;
        if (konz > 0) {
          const ml = tageMl && tageMl[x.k] && tageMl[x.k][i];
          wert = ml || (Number(v) > 0 ? String(mengeZuMl(Number(v), x, konz)) : '');
        }
        map[`${x.k}|${iso(d)}`] = wert;
      });
    });
  }
  EXPO.forEach((x) => dates.forEach((d, i) => {
    document.getElementById(zellId(x.k, i)).value = map[`${x.k}|${d}`] || '';
  }));
  expoChanged();
}

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

function cuGesamt() {
  return keys().reduce((t, k) => t + cuWeek(state.weeks[k], CU_ANTEIL, state.cfg.ghk), 0);
}

export function renderCu() {
  const el = $('cuNote');
  const n = glowInjTage();
  if (!(n > 0)) {
    el.innerHTML = '<b>Kupferlast:</b> keine GLOW-Injektion in dieser Woche eingetragen.';
    return;
  }
  const w = n * (Number(state.cfg.ghk) || 0) * CU_ANTEIL;
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
  buildVials();
  buildExpo();

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

  renderCu();
}
