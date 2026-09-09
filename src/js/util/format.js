/** Zahl deutsch formatieren; null/NaN werden zum Gedankenstrich. */
export function fmt(n, d) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const k = d === undefined ? 1 : d;
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: k, maximumFractionDigits: k });
}

/** Leerwerte zu "-", sonst String. Fuer den Datenblock an die KI. */
export const s = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

/** Zahl oder null — fuer Felder, die leer bleiben duerfen. */
export const num = (v) =>
  v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v);

/** Mittelwert der vorhandenen Werte, null wenn keiner da ist. */
export function mean(arr) {
  const v = arr.filter((x) => x !== null && x !== undefined && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
