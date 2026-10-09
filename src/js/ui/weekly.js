/* Der ausfuehrliche Fragebogen und wann er sichtbar ist.

   Taeglich erfasst werden Exposition, Zufuhr, Confounder und WHO-5. Alles
   andere — Kernbereiche, GLOW-Ziele, Sexualfunktion, Koerpermasse,
   Pigmentierung, Negativkontrollen, Beobachtungsliste, PT-141 — beurteilt
   einen laengeren Zeitraum und steht deshalb nicht im taeglichen Weg.

   Frueher war dieser Teil an den Erfassungstag gebunden. Das setzt voraus,
   dass an genau diesem Tag Zeit ist; ist sie es nicht, faellt die Woche aus.
   Jetzt entscheidet der Knopf. Ein unregelmaessig, aber ehrlich
   ausgefuellter Bogen ist mehr wert als ein Pflichttermin, der ausfaellt.

   Der Fragebogen gilt immer fuer genau einen Tag, und welcher das ist,
   waehlt die Tagesleiste unter dem Knopf. Vorgewaehlt ist heute; jeder
   vergangene Tag der angezeigten Woche laesst sich nachtragen, kuenftige
   sind gesperrt. Fuer eine fruehere Woche wird oben die Woche gewechselt.
   Der gewaehlte Tag landet als `bogenTag` im Eintrag — er sagt, worauf sich
   die Antworten beziehen, und ist deshalb nicht dasselbe wie der Tag, an
   dem gespeichert wurde.

   Karten tragen dafuer die Klasse `weekly`. Sichtbar sind sie, sobald der
   Knopf geklickt wurde oder die angezeigte Woche schon einen Fragebogen
   traegt (`bogenTag` im gespeicherten Eintrag) — und solange er nicht von
   Hand wieder ausgeblendet wurde. Das Ausblenden braucht einen eigenen
   Zustand: eine Woche mit gespeichertem Fragebogen gilt sonst fuer immer
   als offen, und der Knopf haette keine Wirkung mehr.

   Innerhalb des Fragebogens waehlen Haekchen, welche Bereiche zu sehen
   sind (`BEREICHE` in schema.js, `data-bereich` an der Karte). Abgewaehlt
   heisst unsichtbar, nicht geloescht: die Felder bleiben im Formular, und
   das Speichern schreibt ihre zuletzt geladenen Werte unveraendert mit. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { iso, weekDays } from '../util/date.js';
import { BEREICHE } from '../schema.js';
import { saveConfig } from '../storage/index.js';

/* Von Hand geoeffnet — gilt nur fuer genau die Woche, fuer die geklickt
   wurde. Beim Wochenwechsel verfaellt die Oeffnung damit von selbst. */
let manuellFuer = null;

/* Von Hand gewaehlter Tag, ebenfalls nur fuer die Woche, fuer die er
   gewaehlt wurde — sonst traegt ein Klick von heute den Fragebogen der
   Vorwoche auf ein Datum, das gar nicht in ihr liegt. */
let wahlFuer = null;
let wahlTag = '';

/* Von Hand ausgeblendet — ebenfalls nur fuer diese eine Woche. */
let zuFuer = null;

const manuell = () => manuellFuer !== null && manuellFuer === state.weekKey;
const zugeklappt = () => zuFuer !== null && zuFuer === state.weekKey;

/** Datum des Fragebogens dieser Woche, falls einer gespeichert ist. */
export function bogenTag() {
  const e = state.weeks[state.weekKey];
  return (e && e.bogenTag) || '';
}

export const wochenfragenOffen = () => !zugeklappt() && (manuell() || !!bogenTag());

/* ---- Bereiche ---- */

const bereicheAus = () => state.cfg.bereicheAus || [];

/** Ist der Bereich eingeschaltet? Karten ohne Bereich stehen immer. */
const bereichAn = (k) => !k || bereicheAus().indexOf(k) < 0;

/* Die Auswahl gehoert zur Konfiguration, wird also mitgespeichert. Ein
   Haekchen soll aber nicht jedes Mal sofort ins Netz schreiben — wer drei
   Bereiche abwaehlt, meint eine Aenderung, nicht drei. */
let uhr = null;
function speichereSpaeter() {
  if (uhr) clearTimeout(uhr);
  uhr = setTimeout(async () => {
    uhr = null;
    const r = await saveConfig(state.cfg);
    const el = $('bereichInfo');
    if (el) {
      el.textContent = r.ok ? 'Auswahl gespeichert.' : r.text;
      el.className = `gatehint ${r.ok ? 'ok' : 'bad'}`;
    }
  }, 1200);
}

/* Die Leiste wird einmal gebaut und danach nur noch nachgefuehrt — ein
   Neuaufbau bei jedem Tastendruck im Raster wuerde dem Haekchen unter der
   Hand den Fokus nehmen. */
function renderBereichwahl(offen) {
  const host = $('bereichWahl');
  if (!host) return;
  if (!host.childElementCount) {
    BEREICHE.forEach((b) => {
      const lab = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = `bw-${b.k}`;
      box.addEventListener('change', () => {
        const aus = bereicheAus().filter((k) => k !== b.k);
        state.cfg.bereicheAus = box.checked ? aus : aus.concat([b.k]);
        renderWeeklyGate();
        speichereSpaeter();
      });
      lab.append(box, document.createTextNode(b.n));
      host.appendChild(lab);
    });
  }
  BEREICHE.forEach((b) => {
    const box = $(`bw-${b.k}`);
    box.checked = bereichAn(b.k);
    box.parentElement.dataset.an = box.checked ? '1' : '0';
  });
  $('bereichBlock').hidden = !offen;
}

const kurz = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const WTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const tagName = (d) => `${WTAG[new Date(`${d}T12:00:00`).getDay()]} ${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Letzter nicht kuenftiger Tag der angezeigten Woche — heute, wenn er in
    ihr liegt, sonst ihr Abschlusstag. */
function standardTag() {
  const heute = iso(new Date());
  const tage = weekDays(state.weekKey).filter((d) => d <= heute);
  return tage[tage.length - 1] || weekDays(state.weekKey)[6];
}

/** Auf welchen Tag sich der Fragebogen bezieht: die Wahl des Nutzers, sonst
    der gespeicherte Tag, sonst die Vorgabe. Liest auch model.js beim
    Speichern. */
export function fragebogenTag() {
  if (wahlFuer === state.weekKey && wahlTag) return wahlTag;
  return bogenTag() || standardTag();
}

/* Tagesleiste wie beim WHO-5: sieben Tage, kuenftige gesperrt, der
   gewaehlte gedrueckt. */
function renderTagwahl(offen) {
  const host = $('gateTagwahl');
  const block = $('gateTag');
  block.hidden = !offen;
  if (!offen) return;
  const heute = iso(new Date());
  const gewaehlt = fragebogenTag();
  host.textContent = '';
  weekDays(state.weekKey).forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `gateTag${i}`;
    b.textContent = d === heute ? 'Heute' : tagName(d).slice(0, 6);
    b.disabled = d > heute;
    b.setAttribute('aria-pressed', d === gewaehlt ? 'true' : 'false');
    b.addEventListener('click', () => {
      wahlFuer = state.weekKey;
      wahlTag = d;
      renderWeeklyGate();
    });
    host.appendChild(b);
  });
}

export function renderWeeklyGate() {
  const offen = wochenfragenOffen();
  document.querySelectorAll('.weekly').forEach((el) => {
    /* Karten mit eigener Faelligkeit (PT-141 nur bei Anwendung, Monatskarte
       jede vierte Woche) tragen `data-faellig`. Der Fragebogen schaltet sie
       zusaetzlich frei, statt ihre Bedingung zu ueberstimmen — sonst
       gewinnt schlicht, wer zuletzt gerendert hat. */
    const an = offen && bereichAn(el.dataset.bereich);
    el.hidden = el.dataset.faellig === undefined
      ? !an
      : !(an && el.dataset.faellig === '1');
  });

  const bar = $('gateBar');
  bar.hidden = false;
  const tag = bogenTag();
  const hinweis = offen
    ? `Fragebogen für ${kurz(fragebogenTag())}`
    : (tag ? `Fragebogen vom ${kurz(tag)}` : 'ohne Fragebogen — nur Tageswerte');
  bar.innerHTML = `<span class="gatehint">${hinweis}</span>` +
    `<button class="btn ghost small" id="gateOpen" type="button">${
      offen ? 'Fragebogen ausblenden' : 'Ausführlichen Fragebogen erstellen'
    }</button>`;
  $('gateOpen').addEventListener('click', () => {
    manuellFuer = offen ? null : state.weekKey;
    zuFuer = offen ? state.weekKey : null;
    renderWeeklyGate();
  });
  renderTagwahl(offen);
  renderBereichwahl(offen);
}

/** Beim Tageswechsel ueber Mitternacht stimmt das Datum sonst nicht mehr. */
export function initWeeklyGate() {
  let tag = iso(new Date());
  setInterval(() => {
    const jetzt = iso(new Date());
    if (jetzt !== tag) {
      tag = jetzt;
      manuellFuer = null;
      zuFuer = null;
      renderWeeklyGate();
    }
  }, 60000);
}
