/* Reine Rechenfunktionen ueber Wocheneintraege.
   Kein DOM, kein Zustand — deshalb einzeln testbar und von CSV, Datenblock
   und Auswertung gemeinsam benutzt. Jede nimmt einen Eintrag und gibt eine
   Zahl oder null zurueck, wenn die Daten dafuer nicht reichen. */

import { EXPO, CONF_TAGE, KERN, NEG } from '../schema.js';
import { mean } from '../util/format.js';

const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Kompaktes Tagesprotokoll der Exposition, etwa
    "Mo GLOW 2,8mg + PT-141 1,75mg; Mi GLOW 2,8mg".
    Leerer String, wenn die Woche keine Tagesdaten traegt. */
export function tageKompakt(e) {
  const t = e.dose && e.dose.tage;
  if (!t || !t.start) return '';
  const teile = [];
  for (let i = 0; i < 7; i++) {
    const subs = EXPO
      .filter((x) => t[x.k] && Number(t[x.k][i]) > 0)
      .map((x) => `${x.n} ${String(t[x.k][i]).replace('.', ',')}${x.u}`);
    if (subs.length) {
      const d = new Date(`${t.start}T12:00:00`);
      d.setDate(d.getDate() + i);
      teile.push(`${WTAG[d.getDay()]} ${subs.join(' + ')}`);
    }
  }
  return teile.join('; ');
}

/** Kompaktes Tagesprotokoll der Confounder, etwa
    "Mo Schlaf 7h, Training 1,5h; Di Schlaf 6h, Alkohol 2Fl".
    Jeder Wert bezieht sich auf den Vortag der genannten Zeile. */
export function confTageKompakt(e) {
  const t = e.conf && e.conf.tage;
  if (!t || !t.start) return '';
  const teile = [];
  for (let i = 0; i < 7; i++) {
    const felder = CONF_TAGE
      .filter((x) => t[x.k] && t[x.k][i] !== '' && t[x.k][i] !== undefined)
      .map((x) => `${x.n} ${String(t[x.k][i]).replace('.', ',')}${x.u}`);
    if (felder.length) {
      const d = new Date(`${t.start}T12:00:00`);
      d.setDate(d.getDate() + i);
      teile.push(`${WTAG[d.getDay()]} ${felder.join(', ')}`);
    }
  }
  return teile.join('; ');
}

/* WHO-5 und IIEF-5 werden taeglich erfasst; e.who/e.iief tragen das Mittel
   je Frage ueber die erfassten Tage und sind deshalb keine ganzen Zahlen
   mehr. Gerundet wird erst der Summenwert — so bleibt die Skala dieselbe
   wie bei woechentlicher Erfassung und alte Wochen rechnen unveraendert. */
const summe = (arr, faktor) => {
  if (!arr || arr.length !== 5 || arr.some((v) => v === null || v === undefined)) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) * faktor);
};

/** WHO-5, Rohsumme mal vier — Skala 0–100. Null, wenn ein Item fehlt. */
export const whoScore = (e) => summe(e.who, 4);

/** IIEF-5-Summenwert, Skala 5–25. Null, wenn ein Item fehlt. */
export const iiefScore = (e) => summe(e.iief, 1);

/** An wie vielen Tagen der Woche ein Instrument erfasst wurde. */
export const tageErfasst = (map) => (map ? Object.keys(map).length : 0);

/** Primaerendpunkt der Auswertung. */
export const primary = (e) => iiefScore(e);

export const kernMean = (e) => mean(KERN.map((x) => (e.kern ? e.kern[x.k] : null)));
export const negMean = (e) => mean(NEG.map((x) => (e.neg ? e.neg[x.k] : null)));

const ofKeys = (obj, ks) => (obj ? mean(ks.map((k) => obj[k])) : null);

export const hautMean = (e) => ofKeys(e.glow, ['gHautText', 'gHautRot']);
export const gelenkMean = (e) => ofKeys(e.glow, ['gGelenkRuhe', 'gSteif', 'gGelenkLast']);
export const wohlVal = (e) =>
  e.glow && e.glow.gWohl !== undefined && e.glow.gWohl !== null ? e.glow.gWohl : null;

/** Tonnage des schwersten Arbeitssatzes ueber alle Uebungen. Grob, aber stabil. */
export function kraftIndex(e) {
  if (!e.kraft) return null;
  let t = 0;
  let any = false;
  e.kraft.forEach((k) => {
    const kg = Number(k && k.kg);
    const r = Number(k && k.reps);
    if (kg > 0 && r > 0) {
      t += kg * r;
      any = true;
    }
  });
  return any ? t : null;
}

/** Taille geteilt durch mittleren Gliedmassenumfang.
    Faellt der Wert, geht Umfang eher aus der Mitte als von den Extremitaeten. */
export function taillenQuotient(e) {
  if (!e.conf || !e.masse) return null;
  const taille = Number(e.conf.bauch);
  const glieder = [e.masse.mArmR, e.masse.mArmL, e.masse.mBeinR, e.masse.mBeinL]
    .map(Number)
    .filter((x) => x > 0);
  if (!(taille > 0) || !glieder.length) return null;
  return taille / (glieder.reduce((a, b) => a + b, 0) / glieder.length);
}

/** Kupferlast eines Eintrags in mg elementaren Kupfers. */
export function cuWeek(e, cuAnteil, fallbackGhk) {
  if (!e.dose) return 0;
  const ghk = Number(e.dose.ghk) || Number(fallbackGhk) || 0;
  return (Number(e.dose.glow) || 0) * ghk * cuAnteil;
}

/** Pearson-Korrelation zweier gleich langer Reihen; null unter drei Paaren. */
export function pearson(a, b) {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let numr = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    numr += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return null;
  return numr / Math.sqrt(da * db);
}

/** Differenz letztes Drittel minus erstes Drittel. Null unter vier Werten,
    weil darunter jeder "Trend" nur Rauschen abbildet. */
export function drift(arr) {
  if (arr.length < 4) return null;
  const t = Math.max(1, Math.floor(arr.length / 3));
  const a = arr.slice(-t).reduce((x, y) => x + y, 0) / t;
  const b = arr.slice(0, t).reduce((x, y) => x + y, 0) / t;
  return a - b;
}

/** Letzter nicht-leerer Wert einer Reihe. */
export function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}
