/* JSON aus einer Modellantwort holen — auch aus einer abgeschnittenen.

   Ein Sprachmodell hoert mitten im Satz auf, wenn sein Ausgabebudget
   erschoepft ist. Das Ergebnis ist syntaktisch kaputtes JSON, obwohl die
   ersten neunzig Prozent fehlerfrei sind. `JSON.parse` wirft dann weg, was
   schon da war, und der Anwender sieht

       Expected ',' or '}' after property value in JSON at position 11560

   also eine Meldung, die nichts erklaert und nichts retten laesst.

   Dieses Modul schneidet stattdessen am letzten vollstaendigen Wert ab und
   schliesst die offenen Klammern. Es geht dabei rueckwaerts von Kandidat zu
   Kandidat: der erste, der sich parsen laesst, gewinnt. Dadurch bleibt alles
   erhalten, was vor dem Abbruch fertig war — bei sieben Abschnitten sind das
   in der Regel sechs ganze.

   Verloren geht immer nur das angefangene Element. Das ist der Preis, und er
   ist niedriger als der Totalverlust.

   Kein DOM, kein Netz: reine Textverarbeitung. */

/** So viele Rueckfallpunkte werden hoechstens probiert. Jeder Versuch ist
    ein JSON.parse ueber bis zu ein paar Dutzend Kilobyte — nach dieser
    Zahl ist nicht mehr mit einem Treffer zu rechnen, sondern mit einer
    Antwort, die von Anfang an kein JSON war. */
const MAX_VERSUCHE = 80;

/** Zaun und Vorrede abstreifen. Modelle kuendigen ihr JSON gern an. */
function ohneZaun(s) {
  return String(s || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * Durch den Text laufen und dabei zwei Dinge mitschreiben: wo ein Wert
 * sauber endet (ein Rueckfallpunkt) und welche Klammern dort offen sind.
 *
 * Zeichenketten werden uebersprungen, damit eine Klammer im Fliesstext —
 * "(siehe Studie)" — die Zaehlung nicht verschiebt.
 */
function kandidaten(roh) {
  const aus = [];
  const stapel = [];
  let imText = false;
  let esc = false;
  let ende = -1;

  for (let i = 0; i < roh.length; i += 1) {
    const c = roh[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (imText) {
      if (c === '\\') esc = true;
      else if (c === '"') {
        imText = false;
        aus.push({ i: i + 1, stapel: stapel.slice() });
      }
      continue;
    }
    if (c === '"') {
      imText = true;
    } else if (c === '{' || c === '[') {
      stapel.push(c === '{' ? '}' : ']');
    } else if (c === '}' || c === ']') {
      stapel.pop();
      aus.push({ i: i + 1, stapel: stapel.slice() });
      /* Schliesst die aeusserste Klammer, ist das Dokument zu Ende —
         was danach kommt, ist Nachrede und gehoert nicht dazu. */
      if (!stapel.length && ende < 0) ende = i + 1;
    } else if (c === ',') {
      /* Vor dem Komma schneiden: dahinter beginnt ein Element, das
         vielleicht nicht mehr fertig geworden ist. */
      aus.push({ i, stapel: stapel.slice() });
    } else if (c >= '0' && c <= '9') {
      aus.push({ i: i + 1, stapel: stapel.slice() });
    }
  }
  return { aus, ende, offen: stapel.length > 0 };
}

/**
 * Das erste JSON-Objekt im Text. Wirft, wenn gar keines zu finden ist.
 *
 * @returns {{wert:any, unvollstaendig:boolean}} `unvollstaendig` sagt, dass
 *          geflickt werden musste — der Aufrufer soll das sichtbar machen,
 *          statt eine Luecke als Ergebnis zu verkaufen.
 */
export function jsonAusText(text) {
  const s = ohneZaun(text);
  const a = s.indexOf('{');
  if (a < 0) throw new Error('Keine verwertbare Antwort erhalten.');
  const roh = s.slice(a);

  const { aus, ende, offen } = kandidaten(roh);

  /* Der glatte Fall: die Klammern gehen auf und wieder zu. */
  if (!offen && ende > 0) {
    try {
      return { wert: JSON.parse(roh.slice(0, ende)), unvollstaendig: false };
    } catch { /* trotz geschlossener Klammern kaputt — weiter unten flicken */ }
  }

  /* Rueckwaerts durch die Rueckfallpunkte: hinten steht der Abbruch. */
  const bis = Math.max(0, aus.length - MAX_VERSUCHE);
  for (let n = aus.length - 1; n >= bis; n -= 1) {
    const k = aus[n];
    let stueck = roh.slice(0, k.i).replace(/,\s*$/, '');
    for (let j = k.stapel.length - 1; j >= 0; j -= 1) stueck += k.stapel[j];
    try {
      const wert = JSON.parse(stueck);
      if (wert && typeof wert === 'object') return { wert, unvollstaendig: true };
    } catch { /* dieser Punkt trug nicht, der naechstfruehere vielleicht */ }
  }

  throw new Error('Die Antwort war kein lesbares JSON.');
}
