/* Einstiegspunkt.

   Reihenfolge: Formular aufbauen, Ereignisse verdrahten, Ablage anmelden,
   Daten laden, Formular fuellen. Der Aufbau passiert synchron und ohne Netz —
   der Bogen ist also sofort benutzbar, auch wenn die Ablage nie antwortet.

   Neue Module haengen sich hier ein. Wer nur eine Frage ergaenzen will, muss
   diese Datei nicht anfassen — siehe docs/ERWEITERN.md. */

import { state } from './state.js';
import { $ } from './util/dom.js';
import { currentWeekKey } from './util/date.js';
import { buildForm, buildKraft, buildExpo, buildVials } from './form/build.js';
import { fillForm } from './form/model.js';
import {
  saveWeekAction, saveCfgZeit, saveCfgGlow, saveCfgUebungen, saveVials, fillSetup
} from './form/save.js';
import { renderStatus } from './ui/status.js';
import { initTabs } from './ui/tabs.js';
import { initAnalyse } from './ui/analyse.js';
import { initSetupUi, renderStoreState } from './ui/setup.js';
import { initRechner } from './tools/reconstitution.js';
import { buildCsv } from './export/csv.js';
import { renderAus } from './analysis/report.js';
import { initStorage, loadConfig, loadWeeks, subscribeWeeks, storageStatus } from './storage/index.js';
import { useCap } from './util/dom.js';

/* ---- CSV-Export ----
   Im Claude-Viewer ueber die Download-Faehigkeit, sonst ueber einen
   Blob-Link, den der Browser selbst speichert. */
async function exportCsv() {
  const info = $('expInfo');
  const daten = buildCsv();
  const name = 'peptid-wochenbogen.csv';
  try {
    const dl = await useCap('downloads');
    if (dl) {
      await dl.save({ filename: name, data: daten });
    } else {
      const url = URL.createObjectURL(new Blob([daten], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
    info.textContent = 'Datei gespeichert.';
    info.className = 'saveinfo ok';
  } catch (err) {
    const c = err && err.code;
    info.textContent = c === 'declined' ? 'Abgebrochen.' : `Export fehlgeschlagen${c ? ` (${c})` : ''}.`;
    info.className = 'saveinfo bad';
  }
}

function wireEvents() {
  $('saveBtn').addEventListener('click', saveWeekAction);
  $('vialSave').addEventListener('click', saveVials);
  $('cfgSave').addEventListener('click', saveCfgZeit);
  $('cfgSave2').addEventListener('click', saveCfgGlow);
  $('cfgSave3').addEventListener('click', saveCfgUebungen);
  $('expBtn').addEventListener('click', exportCsv);
}

/** Geladene Einstellungen in den Zustand uebernehmen, ohne Vorgaben zu verlieren. */
function uebernehmeCfg(c) {
  if (!c) return;
  state.cfg.start = c.start || '';
  state.cfg.day = c.day !== undefined ? c.day : 6;
  state.cfg.glowStart = c.glowStart || '';
  if (c.erwHaut) state.cfg.erwHaut = c.erwHaut;
  if (c.erwGelenk) state.cfg.erwGelenk = c.erwGelenk;
  if (c.erwWohl) state.cfg.erwWohl = c.erwWohl;
  if (c.ghk !== undefined) state.cfg.ghk = c.ghk;
  if (c.uebungen && c.uebungen.length === 4) state.cfg.uebungen = c.uebungen;
  if (c.vials) state.cfg.vials = c.vials;
}

async function start() {
  /* Der Wochenschluessel muss vor buildForm() stehen — das Tagesraster der
     Exposition traegt die Kalenderdaten der aktuellen Woche. */
  state.weekKey = currentWeekKey();
  buildForm();
  initTabs();
  initRechner();
  wireEvents();

  $('stamp').textContent = `Woche bis ${state.weekKey}`;
  $('cfgDay').value = String(state.cfg.day);
  renderStatus();

  initAnalyse();

  await initStorage();
  initSetupUi();
  $('offline').hidden = storageStatus().ok;

  uebernehmeCfg(await loadConfig());
  fillSetup();
  buildKraft();
  buildVials();
  state.weekKey = currentWeekKey();
  buildExpo();
  $('stamp').textContent = `Woche bis ${state.weekKey}`;

  state.weeks = await loadWeeks();
  if (state.weeks[state.weekKey]) fillForm(state.weeks[state.weekKey]);
  renderStatus();
  renderStoreState();

  /* Live-Aktualisierung, wenn die Ablage sie anbietet. */
  subscribeWeeks((w) => {
    state.weeks = w;
    if (state.weeks[state.weekKey]) fillForm(state.weeks[state.weekKey]);
    renderStatus();
    if (!$('p-aus').hidden) renderAus();
  });
}

start();
