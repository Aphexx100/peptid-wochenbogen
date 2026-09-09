/* Speicheraktionen des Bogens und der Setup-Felder.
   Jede Aktion schreibt in den Zustand, aktualisiert die Oberflaeche und
   meldet danach, was die Ablage daraus gemacht hat. Die Reihenfolge ist
   Absicht: die Eingabe ist sofort uebernommen, auch wenn das Netz haengt. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { currentWeekKey, weekNumber } from '../util/date.js';
import { saveWeek as ablageWeek, saveConfig as ablageConfig } from '../storage/index.js';
import { readForm } from './model.js';
import { buildKraft, buildExpo, renderCu } from './build.js';
import { renderStatus } from '../ui/status.js';

function melde(id, r) {
  const info = $(id);
  info.textContent = r.text;
  info.className = `saveinfo ${r.ok ? 'ok' : 'bad'}`;
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

async function persistCfg(infoId) {
  melde(infoId, await ablageConfig(state.cfg));
}

/** Protokollstart und Erfassungstag. Aendert die aktuelle Woche mit. */
export async function saveCfgZeit() {
  state.cfg.start = $('cfgStart').value;
  state.cfg.day = Number($('cfgDay').value);
  state.weekKey = currentWeekKey();
  buildExpo();
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
