/* Die eine Ablage, die der Rest der Anwendung kennt.

   Aufbau: der localStorage ist immer dabei und haelt eine vollstaendige
   Kopie. Zusaetzlich kann eine entfernte Ablage aktiv sein — die
   Claude-Datenbank im Artifact oder ein GitHub-Repository auf GitHub Pages.

   Geschrieben wird immer zuerst lokal (sofort, kann nicht fehlschlagen) und
   danach entfernt (kann fehlschlagen, wird gemeldet). So geht nie etwas
   verloren, nur weil das Netz gerade weg ist.

   Eine weitere Ablage anzubinden heisst: ein Modul mit denselben fuenf
   Methoden schreiben und es hier in waehleRemote() eintragen. */

import { localStore } from './local.js';
import { claudeStore } from './claude-db.js';
import { githubStore } from './github.js';
import { settings } from '../settings.js';
import { inClaudeViewer } from '../util/dom.js';

let remote = null;
let status = { remote: null, text: 'nur dieses Gerät', ok: false };

async function waehleRemote() {
  const wunsch = settings().backend;
  const kandidaten =
    wunsch === 'claude' ? [claudeStore]
      : wunsch === 'github' ? [githubStore]
        : wunsch === 'local' ? []
          /* auto: im Claude-Viewer die Datenbank, sonst GitHub, wenn eingerichtet. */
          : inClaudeViewer() ? [claudeStore, githubStore] : [githubStore, claudeStore];

  for (const k of kandidaten) {
    // eslint-disable-next-line no-await-in-loop
    if (await k.init()) return k;
  }
  return null;
}

export async function initStorage() {
  await localStore.init();
  remote = await waehleRemote();
  status = remote
    ? { remote: remote.id, text: remote.label, ok: true }
    : { remote: null, text: settings().backend === 'local' ? 'nur dieses Gerät' : 'keine Synchronisierung', ok: false };
  return status;
}

export const storageStatus = () => status;

/** Einstellungen laden: entfernte Ablage schlaegt die lokale Kopie. */
export async function loadConfig() {
  if (remote) {
    try {
      const c = await remote.loadConfig();
      if (c) {
        await localStore.saveConfig(c);
        return c;
      }
    } catch { /* faellt auf die lokale Kopie zurueck */ }
  }
  return localStore.loadConfig();
}

/** Alle Wochen laden. Entfernte Daten ersetzen die lokale Kopie. */
export async function loadWeeks() {
  if (remote) {
    try {
      const w = await remote.loadWeeks();
      if (w && Object.keys(w).length) {
        await localStore.replaceWeeks(w);
        return w;
      }
      /* Leere entfernte Ablage: die lokalen Daten sind dann der einzige
         Bestand — sie werden beim naechsten Speichern hochgeschoben. */
    } catch { /* faellt auf die lokale Kopie zurueck */ }
  }
  return localStore.loadWeeks();
}

/** Ergebnis eines Schreibvorgangs, wie die Oberflaeche es anzeigt. */
const ergebnis = (ok, text) => ({ ok, text });

export async function saveConfig(cfg) {
  await localStore.saveConfig(cfg);
  if (!remote) return ergebnis(true, 'Auf diesem Gerät gespeichert.');
  try {
    await remote.saveConfig(cfg);
    return ergebnis(true, `Gespeichert · ${remote.label}`);
  } catch (err) {
    return ergebnis(false, `Lokal gespeichert, ${remote.label} nicht erreicht (${err.message || 'Fehler'}).`);
  }
}

export async function saveWeek(key, entry) {
  await localStore.saveWeek(key, entry);
  if (!remote) return ergebnis(true, 'Auf diesem Gerät gespeichert.');
  try {
    await remote.saveWeek(key, entry);
    return ergebnis(true, `Gespeichert · ${remote.label}`);
  } catch (err) {
    return ergebnis(false, `Lokal gespeichert, ${remote.label} nicht erreicht (${err.message || 'Fehler'}).`);
  }
}

/** Live-Aktualisierung, sofern die entfernte Ablage sie kann. */
export function subscribeWeeks(cb) {
  if (remote && typeof remote.subscribe === 'function') {
    return remote.subscribe((w) => {
      localStore.replaceWeeks(w);
      cb(w);
    });
  }
  return () => {};
}

/** Alle lokalen Wochen in die entfernte Ablage schieben. Fuer die
    Erstbefuellung eines frisch eingerichteten Repositories. */
export async function pushAlles(onFortschritt) {
  if (!remote) throw new Error('Keine entfernte Ablage aktiv.');
  const alle = await localStore.loadWeeks();
  const ks = Object.keys(alle).sort();
  let n = 0;
  for (const k of ks) {
    // eslint-disable-next-line no-await-in-loop
    await remote.saveWeek(k, alle[k]);
    n += 1;
    if (onFortschritt) onFortschritt(n, ks.length);
  }
  const cfg = await localStore.loadConfig();
  if (cfg) await remote.saveConfig(cfg);
  return n;
}
