/* Geraetegebundene Einstellungen: welche Datenablage benutzt wird, die
   GitHub-Zugangsdaten und der Anthropic-Schluessel.

   Diese Werte liegen bewusst NUR im localStorage des jeweiligen Browsers und
   niemals im Repository. Sie sind Zugangsdaten, keine Protokolldaten — wer
   den Bogen auf einem zweiten Geraet oeffnet, traegt sie dort einmal neu ein.
   Die eigentlichen Wochendaten stehen davon getrennt in der Datenablage. */

const KEY = 'pwb.settings.v1';

const LEER = {
  backend: 'auto',       /* auto | local | github | claude */
  gh: { owner: '', repo: '', branch: 'main', pfad: 'daten', token: '' },
  anthropic: { key: '', model: 'claude-sonnet-4-5' }
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(LEER);
    const v = JSON.parse(raw);
    return {
      backend: v.backend || LEER.backend,
      gh: { ...LEER.gh, ...(v.gh || {}) },
      anthropic: { ...LEER.anthropic, ...(v.anthropic || {}) }
    };
  } catch {
    return structuredClone(LEER);
  }
}

let cache = null;

/** Aktuelle Einstellungen; wird beim ersten Zugriff gelesen. */
export function settings() {
  if (!cache) cache = read();
  return cache;
}

/** Teilaenderung speichern. Gibt den neuen Stand zurueck. */
export function saveSettings(patch) {
  const s = settings();
  cache = {
    backend: patch.backend !== undefined ? patch.backend : s.backend,
    gh: { ...s.gh, ...(patch.gh || {}) },
    anthropic: { ...s.anthropic, ...(patch.anthropic || {}) }
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Privater Modus oder voller Speicher — die Sitzung laeuft trotzdem. */
  }
  return cache;
}

/** Reicht die GitHub-Konfiguration zum Lesen und Schreiben? */
export const ghKomplett = (g = settings().gh) => !!(g.owner && g.repo && g.token);
