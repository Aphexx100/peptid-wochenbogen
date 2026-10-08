/* Umstellungen am gespeicherten Wochenobjekt.

   Alte Eintraege werden beim Laden einmal angefasst, damit der Rest des
   Programms nur ein Format kennt. Jede Umstellung traegt eine Marke am
   Eintrag — ohne sie liesse sich nicht unterscheiden, ob ein Wert schon
   umgerechnet ist, und ein zweiter Lauf wuerde ihn ein zweites Mal teilen.

   Alkohol: bis 2026-10 in 0,5-l-Flaschen gezaehlt, seither in Litern. Jeder
   alte Wert ist also die Haelfte wert. Gezaehlt wird an drei Stellen —
   im Zufuhrraster (dose.zufuhr.alk), im Wochenwert (conf.alk) und in den
   alten Vortagsreihen aus der Zeit, als Alkohol in 02b stand
   (conf.tage.alk, conf.vortagAlt.alk). */

/** Marke am Eintrag: Alkohol steht in Litern. */
export const ALK_MARKE = 'alkL';

const halb = (v) => {
  if (v === '' || v === null || v === undefined) return v;
  const n = Number(v);
  if (!isFinite(n) || n === 0) return v;
  return String(+(n / 2).toFixed(3));
};

const halbReihe = (a) => (Array.isArray(a) ? a.map(halb) : a);

/** Einen Eintrag auf das aktuelle Format bringen. Gibt ihn selbst zurueck. */
export function migriereWoche(e) {
  if (!e || e[ALK_MARKE]) return e;
  if (e.dose && e.dose.zufuhr) e.dose.zufuhr.alk = halbReihe(e.dose.zufuhr.alk);
  if (e.conf) {
    e.conf.alk = halb(e.conf.alk);
    if (e.conf.tage) e.conf.tage.alk = halbReihe(e.conf.tage.alk);
    if (e.conf.vortagAlt) e.conf.vortagAlt.alk = halbReihe(e.conf.vortagAlt.alk);
  }
  e[ALK_MARKE] = 1;
  return e;
}

/** Alle geladenen Wochen umstellen. */
export function migriereWochen(w) {
  Object.keys(w || {}).forEach((k) => migriereWoche(w[k]));
  return w;
}
