/* Der Setup-Reiter, soweit er die Ablage und die Analysequelle betrifft.
   Die Protokollfelder selbst liegen in form/save.js — hier geht es nur um
   Zugangsdaten und darum, wohin gespeichert wird. */

import { $ } from '../util/dom.js';
import { settings, saveSettings } from '../settings.js';
import { storageStatus, pushAlles } from '../storage/index.js';
import { testeGithub } from '../storage/github.js';

function melde(id, ok, text) {
  const el = $(id);
  el.textContent = text;
  el.className = `saveinfo ${ok ? 'ok' : 'bad'}`;
}

export function renderStoreState() {
  const st = storageStatus();
  const el = $('storeState');
  if (!el) return;
  el.textContent = st.ok
    ? `Aktiv: ${st.text}. Zusätzlich immer eine Kopie in diesem Browser.`
    : `Aktiv: ${st.text}. Die Daten liegen nur in diesem Browser — regelmäßig als CSV exportieren.`;
  el.className = `saveinfo ${st.ok ? 'ok' : ''}`;
}

export function initSetupUi() {
  const s = settings();

  $('stBackend').value = s.backend;
  $('ghOwner').value = s.gh.owner;
  $('ghRepo').value = s.gh.repo;
  $('ghBranch').value = s.gh.branch;
  $('ghPfad').value = s.gh.pfad;
  $('ghToken').value = s.gh.token;
  $('anKey').value = s.anthropic.key;
  $('anModel').value = s.anthropic.model;
  renderStoreState();

  const lesenGh = () => ({
    owner: $('ghOwner').value.trim(),
    repo: $('ghRepo').value.trim(),
    branch: $('ghBranch').value.trim() || 'main',
    pfad: $('ghPfad').value.trim() || 'daten',
    token: $('ghToken').value.trim()
  });

  $('stSave').addEventListener('click', () => {
    saveSettings({ backend: $('stBackend').value, gh: lesenGh() });
    melde('stInfo', true, 'Gespeichert. Seite neu laden, damit die Ablage umschaltet.');
  });

  $('ghTest').addEventListener('click', async () => {
    saveSettings({ gh: lesenGh() });
    melde('stInfo', true, 'Prüft …');
    const r = await testeGithub();
    melde('stInfo', r.ok, r.text);
  });

  $('ghPush').addEventListener('click', async () => {
    melde('stInfo', true, 'Lädt hoch …');
    try {
      const n = await pushAlles((i, ges) => melde('stInfo', true, `Lädt hoch … ${i} von ${ges}`));
      melde('stInfo', true, `${n} Wochen hochgeladen.`);
    } catch (err) {
      melde('stInfo', false, String(err.message || err));
    }
  });

  $('anSave').addEventListener('click', () => {
    saveSettings({
      anthropic: { key: $('anKey').value.trim(), model: $('anModel').value.trim() || 'claude-sonnet-4-5' }
    });
    melde('anInfo', true, 'Gespeichert. Seite neu laden, damit die Analyse den Schlüssel benutzt.');
  });
}
