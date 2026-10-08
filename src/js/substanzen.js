/* Welche Substanzspalten das Tagesraster zeigt.

   Die eingebauten Stoffe stehen in schema.js (EXPO). Alles, was der Nutzer
   selbst anlegt, liegt in cfg.stoffe und wird mit den Wochen gespeichert —
   eine neue Substanz braucht also keine Programmierung mehr, sondern nur das
   Formular in Abschnitt 02.

   Zwei Angaben entscheiden ueber alles Weitere:

   - `u` ist die Einheit, in der gerechnet und gespeichert wird. Mit
     `vial:true` wird eingegeben, was an der Spritze abgelesen wird (I.E.),
     und ueber die Konzentration des Vials in `u` umgerechnet.
   - `kat` stuft ein: `wirk` ist ein Wirkstoff, `supp` ein Supplement oder
     Nahrungsmittel. Nur Wirkstoffe erscheinen in der Tagesmengen-Grafik —
     eine Kurve, die Kreatin und Kisspeptin in derselben mg-Achse zeigt,
     sagt nichts ueber beides.

   Entfernt wird in zwei Varianten: ein selbst angelegter Stoff verschwindet
   aus cfg.stoffe, ein eingebauter wandert nach cfg.ausStoffe und ist damit
   nur ausgeblendet. Schon erfasste Werte bleiben in beiden Faellen im
   Eintrag stehen (siehe readExpo in form/build.js) — eine Spalte zu
   entfernen loescht keine Vergangenheit. */

import { state } from './state.js';
import { EXPO } from './schema.js';

/** Umrechnung in mg. Einheiten ohne Faktor sind nicht als Kurve darstellbar. */
const MG_FAKTOR = { mg: 1, 'µg': 0.001, g: 1000 };

/** Die Auswahl im Formular "Stoff hinzufuegen". `vial` heisst: Eingabe in I.E. */
export const ERFASSUNG = [
  { v: 'vial', n: 'Vial — wird rekonstituiert, Eingabe in I.E.', u: 'mg', vial: true, step: 0.5 },
  { v: 'mg', n: 'mg — fertig dosiert (Pen, Kapsel, Tablette)', u: 'mg', vial: false, step: 0.5 },
  { v: 'µg', n: 'µg — fertig dosiert', u: 'µg', vial: false, step: 5 },
  { v: 'g', n: 'g — Pulver, Nahrungsmittel', u: 'g', vial: false, step: 1 },
  { v: 'l', n: 'l — Flüssigkeit', u: 'l', vial: false, step: 0.25 }
];

export const KATEGORIEN = [
  { v: 'wirk', n: 'Wirkstoff' },
  { v: 'supp', n: 'Supplement oder Nahrungsmittel' }
];

/** Farbtokens fuer selbst angelegte Stoffe, der Reihe nach vergeben. */
const EIGEN_FARBEN = 6;

const eingebaut = (k) => EXPO.some((x) => x.k === k);

/** Einen Eintrag auf die Form bringen, die der Rest des Programms erwartet. */
function normiere(x, eigenIndex) {
  return {
    k: x.k,
    n: x.n,
    u: x.u,
    step: x.step || 0.5,
    vial: x.vial !== false,
    kat: x.kat === 'supp' ? 'supp' : 'wirk',
    eigen: eigenIndex >= 0,
    farbe: eigenIndex >= 0 ? `var(--c-s${(eigenIndex % EIGEN_FARBEN) + 1})` : `var(--c-${x.k})`
  };
}

/** Alle je definierten Spalten, auch ausgeblendete. Zum Lesen alter Daten. */
export function alleStoffe() {
  const eigen = (state.cfg.stoffe || []).map((x, i) => normiere(x, i));
  return EXPO.map((x) => normiere(x, -1)).concat(eigen);
}

/** Die Spalten, die das Raster zeigt. */
export function stoffe() {
  const weg = state.cfg.ausStoffe || [];
  return alleStoffe().filter((x) => weg.indexOf(x.k) < 0);
}

/** Stoffe, fuer die ein Vial hinterlegt werden kann. */
export const vialStoffe = () => stoffe().filter((x) => x.vial);

/** Stoffe, die als Kurve in mg sinnvoll sind: Wirkstoffe mit mg-Bezug. */
export const graphStoffe = () => stoffe().filter((x) => x.kat === 'wirk' && MG_FAKTOR[x.u]);

/** Faktor in mg; 0 fuer Einheiten ohne mg-Bezug (etwa Liter). */
export const mgFaktor = (u) => MG_FAKTOR[u] || 0;

/** Einen Stoff anhand seines Schluessels finden — auch einen ausgeblendeten. */
export const findeStoff = (k) => alleStoffe().find((x) => x.k === k) || null;

/** Schluessel aus dem Namen: klein, ohne Sonderzeichen, mit Praefix gegen
    Kollisionen mit eingebauten Spalten, und notfalls durchnummeriert. */
export function neuerKey(name) {
  const rein = String(name || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '').slice(0, 12) || 'stoff';
  const belegt = alleStoffe().map((x) => x.k);
  let k = `e${rein}`;
  let i = 2;
  while (belegt.indexOf(k) >= 0) { k = `e${rein}${i}`; i += 1; }
  return k;
}

/** Einen Stoff anlegen. Gibt den fertigen Eintrag zurueck. */
export function fuegeStoff({ name, erfassung, kat }) {
  const art = ERFASSUNG.find((x) => x.v === erfassung) || ERFASSUNG[1];
  const def = {
    k: neuerKey(name),
    n: String(name).trim(),
    u: art.u,
    step: art.step,
    vial: art.vial,
    kat: kat === 'supp' ? 'supp' : 'wirk'
  };
  state.cfg.stoffe = (state.cfg.stoffe || []).concat([def]);
  /* Ein ausgeblendeter Name darf nicht ewig blockieren. */
  state.cfg.ausStoffe = (state.cfg.ausStoffe || []).filter((k) => k !== def.k);
  return def;
}

/** Eine Spalte entfernen: eigene ganz, eingebaute nur aus der Ansicht. */
export function entferneStoff(k) {
  if (eingebaut(k)) {
    const weg = state.cfg.ausStoffe || [];
    if (weg.indexOf(k) < 0) state.cfg.ausStoffe = weg.concat([k]);
  } else {
    state.cfg.stoffe = (state.cfg.stoffe || []).filter((x) => x.k !== k);
  }
  if (state.cfg.vials && state.cfg.vials[k]) {
    const v = { ...state.cfg.vials };
    delete v[k];
    state.cfg.vials = v;
  }
}
