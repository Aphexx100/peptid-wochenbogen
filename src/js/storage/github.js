/* Ablage in einem GitHub-Repository ueber die Contents-API.

   Aufbau im Datenrepository:
     <pfad>/config.json              die einmaligen Einstellungen
     <pfad>/weeks/YYYY-MM-DD.json    eine Datei je Woche

   Eine Datei je Woche statt einer grossen: so bleibt jede Woche als eigener
   Commit lesbar, zwei Geraete kommen sich seltener in die Quere, und ein
   fehlerhafter Schreibvorgang beschaedigt hoechstens eine Woche.

   Das Datenrepository muss privat sein. Die Seite selbst darf oeffentlich
   liegen — sie enthaelt keine Daten, nur Code. Der Zugriffsschluessel steht
   im localStorage des Browsers, nie im Repository. */

import { settings, ghKomplett } from '../settings.js';

const API = 'https://api.github.com';

/* Base64 mit korrekter UTF-8-Behandlung — btoa allein verschluckt Umlaute. */
const enc = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

const dec = (b64) => {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/* Bekannte Datei-SHAs. GitHub verlangt beim Ueberschreiben den SHA der
   Vorgaengerversion; ohne ihn lehnt die API den Schreibvorgang ab. */
const shas = new Map();

function cfgOrThrow() {
  const g = settings().gh;
  if (!ghKomplett(g)) throw new Error('GitHub ist nicht eingerichtet');
  return g;
}

async function api(pfad, opts = {}) {
  const g = cfgOrThrow();
  const res = await fetch(`${API}${pfad}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${g.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {})
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).message || '';
    } catch { /* Antwort ohne JSON-Koerper */ }
    throw new Error(`GitHub ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.status === 204 ? null : res.json();
}

const basis = () => {
  const g = cfgOrThrow();
  return `/repos/${g.owner}/${g.repo}/contents/${g.pfad || 'daten'}`;
};

const refQuery = () => {
  const g = settings().gh;
  return g.branch ? `?ref=${encodeURIComponent(g.branch)}` : '';
};

async function leseJson(pfad) {
  const r = await api(`${pfad}${refQuery()}`);
  if (!r || !r.content) return null;
  shas.set(pfad, r.sha);
  try {
    return JSON.parse(dec(r.content));
  } catch {
    return null;
  }
}

async function schreibeJson(pfad, obj, nachricht) {
  const g = cfgOrThrow();
  /* SHA notfalls nachladen — beim ersten Schreiben auf einem Geraet fehlt er. */
  if (!shas.has(pfad)) {
    const vorhanden = await api(`${pfad}${refQuery()}`);
    if (vorhanden && vorhanden.sha) shas.set(pfad, vorhanden.sha);
  }
  const body = {
    message: nachricht,
    content: enc(`${JSON.stringify(obj, null, 2)}\n`),
    ...(g.branch ? { branch: g.branch } : {}),
    ...(shas.has(pfad) ? { sha: shas.get(pfad) } : {})
  };
  let r;
  try {
    r = await api(pfad, { method: 'PUT', body: JSON.stringify(body) });
  } catch (err) {
    /* 409: jemand anders hat die Datei inzwischen geaendert. Einmal mit
       frischem SHA wiederholen, statt den Schreibvorgang zu verlieren. */
    if (String(err.message).includes('409')) {
      shas.delete(pfad);
      const vorhanden = await api(`${pfad}${refQuery()}`);
      if (vorhanden && vorhanden.sha) body.sha = vorhanden.sha;
      r = await api(pfad, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      throw err;
    }
  }
  if (r && r.content && r.content.sha) shas.set(pfad, r.content.sha);
}

export const githubStore = {
  id: 'github',
  label: 'GitHub-Repository',

  async init() {
    if (!ghKomplett()) return false;
    try {
      /* Ein Lesezugriff auf das Repository prueft Schluessel und Rechte auf
         einmal — schlaegt er fehl, ist die Ablage nicht benutzbar. */
      const g = settings().gh;
      const r = await api(`/repos/${g.owner}/${g.repo}`);
      return !!r;
    } catch {
      return false;
    }
  },

  async loadConfig() {
    return leseJson(`${basis()}/config.json`);
  },

  async saveConfig(cfg) {
    await schreibeJson(`${basis()}/config.json`, cfg, 'Einstellungen aktualisiert');
  },

  async loadWeeks() {
    const liste = await api(`${basis()}/weeks${refQuery()}`);
    if (!Array.isArray(liste)) return {};
    const dateien = liste.filter((f) => f.type === 'file' && f.name.endsWith('.json'));
    const out = {};
    /* In Schueben laden, damit die API bei vielen Wochen nicht bremst. */
    for (let i = 0; i < dateien.length; i += 8) {
      const teil = dateien.slice(i, i + 8);
      // eslint-disable-next-line no-await-in-loop
      const ergebnisse = await Promise.all(
        teil.map(async (f) => {
          shas.set(`${basis()}/weeks/${f.name}`, f.sha);
          const daten = await leseJson(`${basis()}/weeks/${f.name}`);
          return [f.name.replace(/\.json$/, ''), daten];
        })
      );
      ergebnisse.forEach(([k, v]) => {
        if (v) out[v.week || k] = v;
      });
    }
    return out;
  },

  async saveWeek(key, entry) {
    await schreibeJson(`${basis()}/weeks/${key}.json`, entry, `Woche ${key}`);
  }
};

/** Zugangsdaten pruefen, ohne etwas zu schreiben. Gibt eine Meldung zurueck. */
export async function testeGithub() {
  const g = settings().gh;
  if (!ghKomplett(g)) return { ok: false, text: 'Benutzer, Repository und Zugriffsschlüssel ausfüllen.' };
  try {
    const r = await api(`/repos/${g.owner}/${g.repo}`);
    if (!r) return { ok: false, text: 'Repository nicht gefunden. Name oder Rechte prüfen.' };
    if (!r.permissions || !r.permissions.push) {
      return { ok: false, text: 'Gefunden, aber kein Schreibrecht. Der Schlüssel braucht Contents: Read and write.' };
    }
    return { ok: true, text: `Verbunden mit ${r.full_name}${r.private ? ' (privat)' : ' — Achtung: öffentlich!'}` };
  } catch (err) {
    return { ok: false, text: String(err.message || err) };
  }
}
