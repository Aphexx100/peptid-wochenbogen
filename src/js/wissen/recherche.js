/* Die Recherche: was das Modell gefragt wird und was es zurueckgeben muss.

   Der Prompt steht hier und nirgends sonst — wie das Briefing der Analyse
   ist er der eigentliche Wert dieses Moduls, nicht der Code drumherum.

   Drei Dinge entscheiden ueber die Qualitaet des Ergebnisses:

   1. **Trennung nach Herkunft.** Erhoffte Wirkung, Studienlage und uebliche
      Anwendung sind drei Fragen, nicht eine. Wer sie zusammenwirft, bekommt
      Forenwissen im Tonfall eines Fachtextes.
   2. **Quellen mit URL.** Ohne pruefbare Adresse ist eine Aussage hier
      wertlos — der Newsticker haengt daran, und eine Behauptung ohne Beleg
      waere genau das, was diese Datenbank ersetzen soll.
   3. **Duenne Lage benennen.** Bei Graumarkt-Peptiden ist die Datenlage
      meist duenn. Das soll dastehen, statt in gefaelliger Sprache zu
      verschwinden.

   Die Sprache ist gehobenes Laienniveau: ein Abiturient soll es verstehen,
   ohne dass Fachbegriffe wegfallen — sie werden erklaert, wenn sie fallen.

   Ausgegeben wird JSON, damit der Eintrag maschinell lesbar bleibt. */

import { ABSCHNITTE } from './modell.js';
import { jsonAusText } from '../util/json.js';

const liste = (xs) => xs.map((x) => `- ${x}`).join('\n');

/** Was schon bekannt ist, knapp — damit die Recherche daran anschliesst und
    nicht jedes Mal bei null beginnt. */
function bisher(e) {
  if (!e || !e.stand) return '(noch nichts recherchiert)';
  const quellen = (e.quellen || []).slice(0, 12).map((q) => `${q.titel} — ${q.url}`);
  return `Letzter Stand: ${e.stand.slice(0, 10)}.
Bereits erfasste Quellen (nicht erneut als "neu" melden):
${quellen.length ? liste(quellen) : '- keine'}`;
}

/** Der Auftrag fuer einen Stoff. `stoff` kommt aus substanzen.js. */
export function promptStoff(stoff, e) {
  const art = stoff.kat === 'supp'
    ? 'ein Supplement oder Nahrungsmittel'
    : 'ein Wirkstoff';
  return `Du recherchierst für eine private Selbstdokumentation den Stoff
**${stoff.n}** (${art}, erfasst in ${stoff.u}).

${bisher(e)}

AUFGABE

Suche im Netz nach dem aktuellen Stand. Nimm dir dafür mehrere Suchen:
Fachliteratur und Studienregister zuerst (PubMed, ClinicalTrials.gov,
bioRxiv/medRxiv, Fachgesellschaften), danach die Anwenderseite (Foren,
Erfahrungsberichte, Anbieterangaben). Achte besonders auf alles aus den
letzten zwölf Monaten — neue Studien, laufende Zulassungsverfahren,
Warnungen von Behörden.

Schreibe für einen interessierten Laien mit Abiturwissen: Fachbegriffe darfst
du benutzen, aber erkläre sie beim ersten Auftreten. Keine Werbesprache, kein
Imperativ, keine Empfehlung an den Leser. Du beschreibst, was dokumentiert
ist — du rätst nicht.

Wo die Datenlage dünn ist, schreibe das hin. "Dazu gibt es keine Studien am
Menschen" ist eine vollwertige Antwort und die häufigste richtige.

ANTWORTFORMAT

Wenn du mit dem Suchen fertig bist, beginnt deine Antwort unmittelbar mit der
öffnenden Klammer. Kein Vorwort, kein Rückblick auf die Suche, kein Code-Zaun,
kein Text hinter der schließenden Klammer. Halte dich kurz: jeder Abschnitt
**ein bis zwei knappe Absätze**, zusammen höchstens 400 Wörter. Eine Antwort,
die nicht in dein Ausgabebudget passt, bricht mitten im Satz ab und ist dann
nur noch halb verwertbar.

{"abschnitte":{
${ABSCHNITTE.map((a) => `  "${a.k}": "${a.n} — knapp."`).join(',\n')}
 },
 "quellen":[{"titel":"…","url":"https://…","jahr":"2026","art":"studie|register|behoerde|review|community"}],
 "news":[{"datum":"2026-10-14","titel":"Kurz und konkret","kurz":"Ein bis zwei Sätze, was neu ist und warum es zählt.","url":"https://…","quelle":"PubMed"}]
}

Schreibe die Abschnitte in der gezeigten Reihenfolge und erst danach Quellen
und News — bricht die Antwort doch ab, ist dann wenigstens der Text vollständig.

Zu den Feldern:

- **abschnitte.erhofft** ist die Anwenderseite: was sich Leute von dem Stoff
  versprechen, in deren eigenen Worten zusammengefasst. Ausdrücklich ohne
  Bewertung — die kommt im Abschnitt zur Evidenz.
- **abschnitte.evidenz** stellt dem gegenüber, was belastbar ist: Art der
  Studien (Zellkultur, Tier, Mensch), Teilnehmerzahl, Endpunkte, Qualität.
  Nenne Jahreszahlen.
- **abschnitte.protokolle** beschreibt die *dokumentierte* Anwendung:
  Mengenbereiche aus Studien und übliche Schemata aus Anwenderberichten,
  jeweils mit Herkunft. Beschreibung, keine Empfehlung — formuliere
  "in Studie X wurden … verwendet", nicht "nimm …".
- **quellen**: höchstens 10, die tragfähigsten zuerst, jede mit erreichbarer
  URL. Keine erfundenen Adressen; lieber eine Quelle weniger.
- **news**: nur Meldungen aus den letzten zwölf Monaten, höchstens 3, jede
  mit URL und Datum im Format JJJJ-MM-TT. Ist nichts Neues zu finden, gib
  eine leere Liste zurück — erfinde nichts.`;
}

/** JSON aus der Antwort holen — mit Code-Zaun drumherum, mit Vorrede davor
    und auch dann, wenn die Antwort mitten im Satz abgebrochen ist: dann
    zaehlt, was bis dahin fertig war. */
export function parseWissen(text) {
  const { wert: o, unvollstaendig } = jsonAusText(text);

  const abschnitte = {};
  ABSCHNITTE.forEach((x) => {
    const v = o.abschnitte && o.abschnitte[x.k];
    if (typeof v === 'string' && v.trim()) abschnitte[x.k] = v.trim();
  });
  if (!Object.keys(abschnitte).length) throw new Error('Die Antwort enthielt keinen Text.');

  /* Nur Adressen, die wirklich welche sind: eine Quelle ohne erreichbares
     Ziel ist hier schlimmer als gar keine, weil sie Belegtheit vortaeuscht. */
  const url = (v) => (/^https?:\/\/\S+$/i.test(String(v || '')) ? String(v) : '');
  const quellen = (o.quellen || [])
    .filter((q) => q && url(q.url))
    .slice(0, 15)
    .map((q) => ({
      titel: String(q.titel || q.url).slice(0, 200),
      url: url(q.url),
      jahr: String(q.jahr || '').slice(0, 4),
      art: String(q.art || 'quelle').slice(0, 20)
    }));

  const news = (o.news || [])
    .filter((n) => n && n.titel && url(n.url))
    .slice(0, 5)
    .map((n) => ({
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(n.datum || '')) ? n.datum : '',
      titel: String(n.titel).slice(0, 200),
      kurz: String(n.kurz || '').slice(0, 600),
      url: url(n.url),
      quelle: String(n.quelle || '').slice(0, 80)
    }));

  return { abschnitte, quellen, news, unvollstaendig };
}
