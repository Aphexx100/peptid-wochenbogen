/* Die Prognose: was der heutige Zustand vermutlich ist, und wohin er laeuft.

   Zwei Schritte, weil der erste raten muss und der zweite davon profitiert,
   dass geraten wurde:

   1. Ist-Zustand. Das Modell recherchiert die Substanzen (Wirkeintritt,
      erwartbare Effektgroessen, Zeitverlaeufe) und stellt daneben, was die
      eigenen Daten hergeben. Heraus kommen einzelne, pruefbare Aussagen.
   2. Prognose. Der Nutzer bewertet jede Aussage von "stimme voll zu" bis
      "stimme gar nicht zu". Erst diese Korrektur macht die Prognose zu
      seiner: ohne sie waere es ein Lehrbuchverlauf mit seinen Daten als
      Dekoration.

   Jede Substanz zaehlt ab dem Tag, an dem sie zum ersten Mal im Raster
   steht — auch eine selbst angelegte, die es gestern noch nicht gab.
   Supplemente und Nahrungsmittel werden als solche benannt, damit das Modell
   sie nicht als Wirkstoff behandelt. Deshalb bekommt das Modell die Startdaten mitgeliefert und nicht
   nur die Wochenwerte — ein Stoff, der seit drei Tagen laeuft, erklaert
   keinen Verlauf ueber drei Monate.

   Die Regeln aus briefing.js gelten weiter: Tirzepatid ist der dominante
   Confounder, der IIEF-5 der Primaerendpunkt, unter zehn Wochen ist ein
   Trend Rauschen, und es gibt keine Dosierungsempfehlungen. */

import { state, keys } from '../state.js';
import { alleStoffe } from '../substanzen.js';
import { BRIEFING } from './briefing.js';
import { dataBlock } from './context.js';

/** Erster und letzter Tag je Substanz, dazu die uebliche Tagesmenge. */
export function substanzStarts() {
  const treffer = {};
  keys().forEach((k) => {
    const t = state.weeks[k] && state.weeks[k].dose && state.weeks[k].dose.tage;
    if (!t || !t.start) return;
    alleStoffe().forEach((x) => {
      (t[x.k] || []).forEach((v, i) => {
        if (!(Number(v) > 0)) return;
        const d = new Date(`${t.start}T12:00:00`);
        d.setDate(d.getDate() + i);
        const tag = d.toISOString().slice(0, 10);
        const e = treffer[x.k] || (treffer[x.k] = { von: tag, bis: tag, tage: 0, mengen: [] });
        if (tag < e.von) e.von = tag;
        if (tag > e.bis) e.bis = tag;
        e.tage += 1;
        e.mengen.push(Number(v));
      });
    });
  });
  return alleStoffe().map((x) => {
    const art = x.kat === 'supp' ? ' [Supplement/Nahrungsmittel]' : '';
    const e = treffer[x.k];
    if (!e) return `${x.n}${art}: nie erfasst`;
    const schnitt = +(e.mengen.reduce((a, b) => a + b, 0) / e.mengen.length).toFixed(2);
    const dauer = Math.round((Date.parse(e.bis) - Date.parse(e.von)) / 86400000) + 1;
    return `${x.n}${art}: seit ${e.von} (${dauer} Tage), zuletzt ${e.bis}, ` +
      `${e.tage} Anwendungstage, Ø ${schnitt} ${x.u} je Tag`;
  }).join('\n');
}

/** Kurzfassung frueherer Prognosen, damit die neue daran anschliesst. */
export function fruehereKurz(prognosen) {
  const alle = Object.values(prognosen || {}).sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 4);
  if (!alle.length) return '(noch keine frühere Prognose)';
  return alle.map((p) => {
    const zu = (p.aussagen || []).filter((a) => (p.bewertungen || {})[a.id] >= 4).length;
    const ab = (p.aussagen || []).filter((a) => (p.bewertungen || {})[a.id] <= 2).length;
    return `Prognose vom ${p.id.slice(0, 10)}: ${(p.aussagen || []).length} Aussagen, ` +
      `${zu} bestätigt, ${ab} verworfen.\n${(p.prognose || '').slice(0, 1200)}`;
  }).join('\n\n');
}

const kopf = (prognosen) => `${BRIEFING}

SUBSTANZEN UND IHRE LAUFZEIT (jede zählt erst ab ihrem ersten Eintrag):
${substanzStarts()}

FRÜHERE PROGNOSEN:
${fruehereKurz(prognosen)}

${dataBlock(60)}`;

/** Schritt 1: Ist-Zustand schaetzen, als pruefbare Einzelaussagen. */
export function promptIst(prognosen) {
  return `${kopf(prognosen)}

AUFGABE — SCHRITT 1 VON 2: Schätze den heutigen Ist-Zustand.

Recherchiere dafür zuerst gründlich im Netz: aktuelle Studienlage zu den oben
genannten Substanzen in genau dieser Kombination und Dosierung, erwartbarer
Wirkeintritt in Wochen, typische Effektgrößen, bekannte Wechselwirkungen und
Confounder. Suche mehrfach und nenne, worauf du dich stützt. Wo die Datenlage
dünn ist (Graumarkt-Peptide, Selbstversuche), sage das statt zu glätten.

Verbinde dann zwei Quellen: was die eigenen Daten oben hergeben, und was nach
Forschungslage zum jetzigen Zeitpunkt zu erwarten wäre. Wo beide auseinander
laufen, ist das der interessante Punkt — benenne ihn.

Antworte AUSSCHLIESSLICH mit JSON in genau dieser Form, ohne Text davor oder
danach, ohne Code-Zaun:

{"stand":"Zwei bis vier Sätze zum Gesamtbild heute.",
 "aussagen":[
   {"id":"a1",
    "bereich":"z. B. Hautbild, Gelenke, Sexualfunktion, Körperzusammensetzung, Sicherheit",
    "aussage":"Eine einzelne, überprüfbare Aussage über den heutigen Zustand.",
    "grundlage":"daten | forschung | beides",
    "beleg":"Woraus folgt das? Bei Forschung die Quelle nennen, bei Daten die Zahlen.",
    "zuversicht":"niedrig | mittel | hoch"}
 ]}

Zehn bis sechzehn Aussagen. Jede so formuliert, dass der Nutzer ihr zustimmen
oder widersprechen kann — keine Rückfragen, keine Empfehlungen, keine Dosis.`;
}

const SKALA = { 5: 'stimme voll zu', 4: 'stimme eher zu', 3: 'unentschieden', 2: 'stimme eher nicht zu', 1: 'stimme gar nicht zu' };

/** Schritt 2: Prognose, die die Bewertungen des Nutzers ernst nimmt. */
export function promptPrognose(prognosen, ist, bewertungen) {
  const zeilen = (ist.aussagen || []).map((a) => {
    const b = bewertungen[a.id];
    return `- [${a.bereich}] ${a.aussage}\n  Grundlage: ${a.grundlage}. Bewertung des Nutzers: ${b ? SKALA[b] : 'nicht bewertet'}.`;
  }).join('\n');

  return `${kopf(prognosen)}

GESCHÄTZTER IST-ZUSTAND AUS SCHRITT 1:
${ist.stand || ''}

AUSSAGEN UND WIE DER NUTZER SIE BEWERTET HAT:
${zeilen}

AUFGABE — SCHRITT 2 VON 2: Erstelle die Prognose.

Die Bewertungen sind Primärdaten, keine Meinung am Rande: wo der Nutzer
widerspricht, gilt seine Beobachtung, und du korrigierst die Annahme — sage
dann auch, was das für die Erwartung bedeutet. Wo er zustimmt, wird die
Annahme belastbarer.

Antworte in Markdown, höchstens 700 Wörter, in dieser Reihenfolge:

1. **Korrigierter Ist-Zustand** — ein Absatz, der die Bewertungen einarbeitet.
2. **Erwartete Entwicklung** — eine Tabelle mit den Spalten Zeitfenster |
   Erwartung | Woran du es merkst | Wie sicher. Zeitfenster in Wochen ab heute,
   bezogen auf die Laufzeit jeder Substanz, nicht auf den Protokollstart.
3. **Was die Prognose kippen würde** — welche Beobachtung sie widerlegt.
4. **Was als Nächstes zu messen wäre** — höchstens drei Punkte, jeweils mit
   dem Grund, warum gerade das die offenste Frage klärt.

Keine Dosierungsempfehlungen. Keine Heilsversprechen. Nenne Unsicherheit als
Unsicherheit.`;
}

/** JSON aus der Antwort holen, auch wenn ein Code-Zaun drumherum steht. */
export function parseIst(text) {
  const roh = String(text || '').trim();
  const ohneZaun = roh.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = ohneZaun.indexOf('{');
  const b = ohneZaun.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Keine verwertbare Antwort erhalten.');
  const o = JSON.parse(ohneZaun.slice(a, b + 1));
  const aussagen = (o.aussagen || []).filter((x) => x && x.aussage)
    .map((x, i) => ({
      id: String(x.id || `a${i + 1}`),
      bereich: String(x.bereich || '—'),
      aussage: String(x.aussage),
      grundlage: String(x.grundlage || '—'),
      beleg: String(x.beleg || ''),
      zuversicht: String(x.zuversicht || '—')
    }));
  if (!aussagen.length) throw new Error('Die Antwort enthielt keine Aussagen.');
  return { stand: String(o.stand || ''), aussagen };
}
