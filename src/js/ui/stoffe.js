/* Stoffe im Bogen anlegen und entfernen.

   Ein neuer Stoff war bisher eine Zeile in schema.js — also eine Aenderung
   am Programm. Jetzt steht das Formular direkt unter dem Tagesraster: Name,
   Erfassung, Einstufung, fertig. Gespeichert wird der Stoff in der
   Konfiguration (cfg.stoffe), damit ihn jedes Geraet bekommt, das dieselbe
   Ablage benutzt.

   Wird "Vial" gewaehlt, kommt der Rekonstitutionsrechner im unteren Teil des
   Formulars dazu: Vial-Inhalt und Wasservolumen werden mit dem Stoff
   zusammen gespeichert und landen in der Karte "Aktuelle Vials", die Spalte
   im Raster laeuft dann in I.E. Ohne Vial wird direkt in der gewaehlten
   Einheit eingetragen.

   Entfernen laeuft ueber das Kreuz im Spaltenkopf und fragt einmal nach —
   ein Dialogfenster waere hier ein Klick zu viel und im Test ein Hindernis.
   Was schon erfasst ist, bleibt im Eintrag stehen. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { ERFASSUNG, KATEGORIEN, fuegeStoff, entferneStoff, findeStoff, stoffe } from '../substanzen.js';
import { buildExpo, buildVials } from '../form/build.js';
import { rechne, renderVialZiele } from '../tools/reconstitution.js';
import { saveConfig } from '../storage/index.js';
import { wochenGraphNeu } from './wochengraph.js';

const melde = (id, ok, text) => {
  const el = $(id);
  el.textContent = text;
  el.className = `gatehint ${ok ? 'ok' : 'bad'}`;
};

const art = () => ERFASSUNG.find((x) => x.v === $('snArt').value) || ERFASSUNG[1];

function renderForm() {
  const a = art();
  $('snVial').hidden = !a.vial;
  $('snDosisEinheit').textContent = a.u;
  if (a.vial) {
    $('snOut').innerHTML = rechne({
      vial: Number($('snVial-mg').value) || 0,
      wasser: Number($('snVial-ml').value) || 0,
      dosisMg: Number($('snDosis').value) || 0,
      kap: Number($('snSpritze').value) || 30
    });
  }
}

/** Formular oeffnen oder schliessen. */
function zeige(offen) {
  $('stoffForm').hidden = !offen;
  $('stoffNeu').setAttribute('aria-expanded', offen ? 'true' : 'false');
  if (offen) {
    $('snName').focus();
    renderForm();
  }
}

async function anlegen() {
  const name = $('snName').value.trim();
  if (!name) { melde('snInfo', false, 'Der Stoff braucht einen Namen.'); return; }
  if (stoffe().some((x) => x.n.toLowerCase() === name.toLowerCase())) {
    melde('snInfo', false, `${name} gibt es schon als Spalte.`);
    return;
  }
  const a = art();
  const def = fuegeStoff({ name, erfassung: a.v, kat: $('snKat').value });
  /* Mit Vial gleich die Konzentration mitnehmen — dann laeuft die Spalte
     sofort in I.E. und muss nicht erst im Setup nachgetragen werden. */
  const mg = Number($('snVial-mg').value);
  const ml = Number($('snVial-ml').value);
  if (a.vial && mg > 0 && ml > 0) {
    state.cfg.vials = { ...(state.cfg.vials || {}), [def.k]: { mg, ml } };
  }
  buildVials();
  buildExpo();
  renderVialZiele();
  wochenGraphNeu();
  zeige(false);
  $('snName').value = '';
  const r = await saveConfig(state.cfg);
  const nachsatz = a.vial && mg > 0 && ml > 0 ? ' und läuft in I.E.' : '.';
  melde('stoffInfo', r.ok, r.ok ? `${def.n} angelegt — die Spalte steht im Raster${nachsatz}` : r.text);
}

/* Zwei Klicks: der erste bewaffnet das Kreuz, der zweite entfernt. Nach vier
   Sekunden ohne zweiten Klick geht es in den Ruhezustand zurueck. */
let scharf = '';
let uhr = null;

function entschaerfe() {
  if (uhr) clearTimeout(uhr);
  uhr = null;
  const b = scharf && document.querySelector(`[data-stoffweg="${scharf}"]`);
  if (b) { b.dataset.scharf = '0'; b.textContent = '×'; }
  scharf = '';
}

async function weg(k) {
  const x = findeStoff(k);
  entferneStoff(k);
  buildVials();
  buildExpo();
  renderVialZiele();
  wochenGraphNeu();
  const r = await saveConfig(state.cfg);
  melde('stoffInfo', r.ok, r.ok
    ? `${x ? x.n : 'Spalte'} entfernt. Bereits erfasste Werte bleiben in den Wochen gespeichert.`
    : r.text);
}

export function initStoffeUi() {
  $('stoffNeu').addEventListener('click', () => zeige($('stoffForm').hidden));
  $('snAbbruch').addEventListener('click', () => zeige(false));
  $('snAdd').addEventListener('click', anlegen);
  $('snArt').addEventListener('change', renderForm);
  ['snVial-mg', 'snVial-ml', 'snDosis', 'snSpritze'].forEach((id) => {
    $(id).addEventListener('input', renderForm);
    $(id).addEventListener('change', renderForm);
  });

  /* Ein Zuhoerer an der Tabelle statt einer je Spalte: das Raster wird bei
     jeder Aenderung neu aufgebaut, die Tabelle selbst bleibt stehen. */
  $('s-expo').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-stoffweg]');
    if (!b) return;
    const k = b.dataset.stoffweg;
    if (scharf === k) { entschaerfe(); weg(k); return; }
    entschaerfe();
    scharf = k;
    b.dataset.scharf = '1';
    b.textContent = 'entfernen?';
    uhr = setTimeout(entschaerfe, 4000);
  });
}
