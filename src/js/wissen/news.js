/* Die Newsliste: eine Reihe von Meldungen mit Quelle.

   Gespeichert wird sie als Ganzes und nicht je Stoff, weil ihre Reihenfolge
   zu den Daten gehoert — ein Ticker ist eine Chronologie, keine Sammlung.
   Jede Meldung weiss aber, zu welchem Stoff sie gehoert, damit sich beides
   wieder zusammenfuehren laesst.

   Die URL ist der Schluessel. Zwei Recherchen finden dieselbe Studie und
   formulieren sie verschieden; ohne Abgleich stuende sie zweimal im Ticker.
   Eine Meldung ohne Adresse kommt gar nicht erst herein — eine Nachricht,
   die man nicht nachlesen kann, ist in dieser Datenbank wertlos. */

/** So viele Meldungen behaelt der Ticker. Aeltere fallen hinten heraus. */
export const MAX_NEWS = 60;

/** Adresse auf das Wesentliche kuerzen, damit dieselbe Quelle sich nicht
    durch angehaengte Parameter in zwei Meldungen verwandelt. */
function kennung(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

/** Neuere zuerst; Meldungen ohne Datum hinten, aber nicht verloren. */
const sortiere = (liste) => liste.slice().sort((a, b) => {
  if (!a.datum && !b.datum) return 0;
  if (!a.datum) return 1;
  if (!b.datum) return -1;
  return a.datum < b.datum ? 1 : -1;
});

/**
 * Die News eines Wissenseintrags in die Liste einarbeiten.
 * Vorhandene Meldungen werden nicht verdoppelt, aber aufgefrischt: die
 * spaetere Fassung gewinnt, denn sie kann eine Korrektur sein.
 */
export function fuegeNews(liste, eintrag) {
  const out = new Map();
  (liste || []).forEach((n) => { if (n && n.url) out.set(kennung(n.url), n); });
  (eintrag.news || []).forEach((n) => {
    if (!n || !n.url) return;
    out.set(kennung(n.url), {
      ...n,
      stoff: eintrag.k,
      stoffName: eintrag.n,
      gefunden: eintrag.stand
    });
  });
  return sortiere([...out.values()]).slice(0, MAX_NEWS);
}

/** Alle Meldungen aus einem Bestand neu aufbauen — fuer den Fall, dass die
    Liste verloren geht, die Eintraege aber noch da sind. */
export function newsAusWissen(wissen) {
  let liste = [];
  Object.values(wissen || {}).forEach((e) => { liste = fuegeNews(liste, e); });
  return liste;
}

/** "14.10.2026" — oder leer, wenn die Meldung kein Datum hatte. */
export const newsDatum = (n) =>
  (/^\d{4}-\d{2}-\d{2}$/.test(n.datum || '')
    ? `${n.datum.slice(8, 10)}.${n.datum.slice(5, 7)}.${n.datum.slice(0, 4)}`
    : '');
