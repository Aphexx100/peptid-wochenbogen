/* Speicheraktionen des Bogens und der Setup-Felder.
   Jede Aktion schreibt in den Zustand, aktualisiert die Oberflaeche und
   meldet danach, was die Ablage daraus gemacht hat. Die Reihenfolge ist
   Absicht: die Eingabe ist sofort uebernommen, auch wenn das Netz haengt. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { currentWeekKey, weekNumber } from '../util/date.js';
import { saveWeek as ablageWeek, saveConfig as ablageConfig } from '../storage/index.js';
import { readForm, fillForm } from './model.js';
import {
  buildKraft, buildExpo, buildConfTage, renderCu, readVials, refreshExpoUnits,
  readExpo, readZufuhr, readNotizen, readConfTage, mergeHeute
} from './build.js';
import { renderStatus } from '../ui/status.js';
import { wochenGraphZeige } from '../ui/wochengraph.js';

function melde(id, r) {
  const info = $(id);
  info.textContent = r.text;
  info.classList.remove('ok', 'bad');
  info.classList.add(r.ok ? 'ok' : 'bad');
}

export async function saveWeekAction() {
  const e = readForm();
  state.weeks[state.weekKey] = e;
  renderStatus();
  $('saveInfo').textContent = 'Speichert …';
  $('saveInfo').className = 'saveinfo';
  const r = await ablageWeek(state.weekKey, e);
  melde('saveInfo', {
    ok: r.ok,
    text: r.ok ? `${r.text} · Woche ${weekNumber(state.weekKey) || state.weekKey}` : r.text
  });
}

/* ---- Wochenwechsel zum Korrigieren ----
   Der Bogen zeigt sonst immer die laufende Woche. Zum Korrigieren laesst er
   sich auf fruehere Wochen umstellen; Speichern schreibt dann in genau diese
   Woche. Vor dem Wechsel wird gespeichert, falls sich etwas geaendert hat —
   sonst gingen Korrekturen beim Blaettern verloren. */

const vergleich = (e) => JSON.stringify({ ...e, saved: null });

function hatEingaben() {
  return !readExpo().leer || !readZufuhr().leer || !readNotizen().leer || !readConfTage().leer
    || Object.keys(mergeHeute('who')).length > 0;
}

export async function wechsleWoche(ziel) {
  if (!ziel || ziel === state.weekKey) return;
  const alt = state.weeks[state.weekKey];
  if (alt ? vergleich(readForm()) !== vergleich(alt) : hatEingaben()) await saveWeekAction();
  state.weekKey = ziel;
  buildExpo();
  buildConfTage();
  fillForm(state.weeks[ziel] || {});
  $('stamp').textContent = `Woche bis ${state.weekKey}`;
  renderStatus();
  wochenGraphZeige(state.weekKey);
}

async function persistCfg(infoId) {
  melde(infoId, await ablageConfig(state.cfg));
}

/** Protokollstart und Erfassungstag. Aendert die aktuelle Woche mit. */
export async function saveCfgZeit() {
  state.cfg.start = $('cfgStart').value;
  state.cfg.day = Number($('cfgDay').value);
  const vorher = state.weekKey;
  state.weekKey = currentWeekKey();
  buildExpo();
  buildConfTage();
  /* Anderer Erfassungstag heisst andere Woche mit anderen Kalendertagen.
     Die Tabellen zeigen dann deren gespeicherten Stand — sonst rutschten die
     eingetragenen Werte zeilenweise auf fremde Daten. */
  if (state.weekKey !== vorher) {
    fillForm(state.weeks[state.weekKey] || {});
    wochenGraphZeige(state.weekKey);
  }
  $('stamp').textContent = `Woche bis ${state.weekKey}`;
  renderStatus();
  await persistCfg('cfgInfo');
}

/** GLOW-Start, Erwartungsfenster und mg GHK-Cu je Injektion. */
export async function saveCfgGlow() {
  state.cfg.glowStart = $('cfgGlowStart').value;
  state.cfg.erwHaut = Number($('cfgErwHaut').value) || 9;
  state.cfg.erwGelenk = Number($('cfgErwGelenk').value) || 9;
  state.cfg.erwWohl = Number($('cfgErwWohl').value) || 9;
  state.cfg.ghk = Number($('cfgGhk').value) || 0;
  renderStatus();
  renderCu();
  await persistCfg('cfgInfo2');
}

/** Aktuelle Vials aus der Karte im Bogen. Stellt die Rasterspalten um. */
export async function saveVials() {
  state.cfg.vials = readVials();
  refreshExpoUnits();
  await persistCfg('vialInfo');
}

/** Die vier Uebungsnamen der Kraftwerte. */
export async function saveCfgUebungen() {
  state.cfg.uebungen = [0, 1, 2, 3].map((i) => $(`un${i}`).value.trim());
  buildKraft();
  await persistCfg('cfgInfo3');
}

/** Setup-Felder aus dem geladenen Zustand fuellen. */
export function fillSetup() {
  $('cfgStart').value = state.cfg.start;
  $('cfgDay').value = String(state.cfg.day);
  $('cfgGlowStart').value = state.cfg.glowStart;
  $('cfgGhk').value = state.cfg.ghk;
  $('cfgErwHaut').value = state.cfg.erwHaut;
  $('cfgErwGelenk').value = state.cfg.erwGelenk;
  $('cfgErwWohl').value = state.cfg.erwWohl;
  [0, 1, 2, 3].forEach((i) => { $(`un${i}`).value = state.cfg.uebungen[i] || ''; });
}
