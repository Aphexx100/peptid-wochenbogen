import { state } from '../state.js';

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Woche = Datum des NAECHSTEN Erfassungstags (heute, wenn er heute ist).
    Die laufende Woche sammelt ihre Tage bis zum Abschlusstag; erst an dem
    Tag werden die Wochenfragen freigeschaltet. */
export function currentWeekKey() {
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  const vor = (Number(state.cfg.day) - t.getDay() + 7) % 7;
  t.setDate(t.getDate() + vor);
  return iso(t);
}

/** Heute ist der Erfassungstag der laufenden Woche — Wochenfragen offen. */
export function istAbschlussTag() {
  return iso(new Date()) === state.weekKey;
}

/** Fortlaufende Wochennummer seit Protokollbeginn, null ohne Startdatum. */
export function weekNumber(key) {
  if (!state.cfg.start) return null;
  const d = Math.floor((Date.parse(key) - Date.parse(state.cfg.start)) / 86400000);
  return Math.floor(d / 7) + 1;
}

export const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);

/** Die sieben Kalendertage einer Woche, aeltester zuerst — der letzte ist der
    Erfassungstag, also der Wochenschluessel selbst. */
export function weekDays(key) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() - i);
    out.push(iso(d));
  }
  return out;
}
