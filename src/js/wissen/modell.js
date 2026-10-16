/* Form eines Wissenseintrags.

   Ein Eintrag gehoert zu genau einem Stoff und haelt fest, was ueber ihn
   bekannt ist — getrennt nach Herkunft. Diese Trennung ist der ganze Zweck
   der Datenbank: was sich die Community erhofft, was Studien zeigen und was
   ueblicherweise angewendet wird, sind drei verschiedene Dinge, und sie
   gehen in jedem Forenbeitrag durcheinander.

   Die Abschnitte stehen als Text, nicht als Struktur. Das ist Absicht: die
   Sprache soll erklaeren duerfen, und ein Schema aus Zahlen wuerde eine
   Genauigkeit vortaeuschen, die die Quellenlage nicht hergibt. Maschinell
   ausgewertet werden stattdessen `quellen`, `news` und `stand`.

   Alles hier ist reine Datenform: kein DOM, kein Netz, keine KI. Damit
   koennen spaetere Module (Auswertung, Prognose, Export) den Bestand lesen,
   ohne die Recherche anzufassen. */

/** Fassung des Eintragsformats. Steigt, wenn sich Felder aendern. */
export const WISSEN_VERSION = 1;

/** Reihenfolge und Beschriftung der Abschnitte — auch die Anzeige liest sie. */
export const ABSCHNITTE = [
  { k: 'ueberblick', n: 'Worum es geht' },
  { k: 'erhofft', n: 'Was sich die Anwender erhoffen' },
  { k: 'wirkweise', n: 'Wie es wirken soll' },
  { k: 'evidenz', n: 'Was die Studienlage hergibt' },
  { k: 'protokolle', n: 'Übliche Protokolle und Mengen' },
  { k: 'sicherheit', n: 'Risiken und Wechselwirkungen' },
  { k: 'offen', n: 'Was offen ist' }
];

/** Nach so vielen Tagen gilt ein Eintrag als veraltet. */
export const FRIST_TAGE = 7;

const TAG_MS = 86400000;

/** Leerer Eintrag fuer einen Stoff, der noch nie recherchiert wurde. */
export function leererEintrag(stoff) {
  return {
    v: WISSEN_VERSION,
    k: stoff.k,
    n: stoff.n,
    kat: stoff.kat || 'wirk',
    stand: '',
    modell: '',
    abschnitte: {},
    quellen: [],
    news: []
  };
}

/** Tage seit der letzten Recherche; null, wenn noch nie recherchiert. */
export function alter(e) {
  if (!e || !e.stand) return null;
  const t = Date.parse(e.stand);
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / TAG_MS);
}

/** Ist der Eintrag faellig? Nie recherchiert zaehlt als faellig. */
export function faellig(e) {
  const a = alter(e);
  return a === null || a >= FRIST_TAGE;
}

/** "vor 3 Tagen", "heute", "noch nie" — fuer die Anzeige. */
export function standText(e) {
  const a = alter(e);
  if (a === null) return 'noch nie recherchiert';
  if (a === 0) return 'heute aktualisiert';
  if (a === 1) return 'gestern aktualisiert';
  return `vor ${a} Tagen aktualisiert`;
}

/** Hat der Eintrag ueberhaupt Inhalt? */
export const hatInhalt = (e) =>
  !!(e && e.abschnitte && ABSCHNITTE.some((a) => (e.abschnitte[a.k] || '').trim()));
