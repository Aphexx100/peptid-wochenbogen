import { state } from '../state.js';

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Woche = Datum des juengsten vergangenen (oder heutigen) Erfassungstags. */
export function currentWeekKey() {
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  const back = (t.getDay() - Number(state.cfg.day) + 7) % 7;
  t.setDate(t.getDate() - back);
  return iso(t);
}

/** Fortlaufende Wochennummer seit Protokollbeginn, null ohne Startdatum. */
export function weekNumber(key) {
  if (!state.cfg.start) return null;
  const d = Math.floor((Date.parse(key) - Date.parse(state.cfg.start)) / 86400000);
  return Math.floor(d / 7) + 1;
}

export const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
