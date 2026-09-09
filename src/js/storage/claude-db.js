/* Ablage in der Datenbank des Claude-Artifacts.
   Nur verfuegbar, wenn die Seite in einem Claude-Viewer laeuft und das
   Artifact die Faehigkeit "db" deklariert hat. Bietet als einzige Ablage
   Live-Aktualisierung ueber onSnapshot. */

import { useCap } from '../util/dom.js';

let db = null;

export const claudeStore = {
  id: 'claude',
  label: 'Claude-Datenbank',

  async init() {
    db = await useCap('db');
    return !!db;
  },

  async loadConfig() {
    if (!db) return null;
    const snap = await db.doc('config/setup').get();
    return snap.exists && snap.data() ? snap.data() : null;
  },

  async saveConfig(cfg) {
    if (!db) throw new Error('keine Datenbank');
    await db.doc('config/setup').set(cfg);
  },

  async loadWeeks() {
    if (!db) return {};
    const snap = await db.collection('weeks').orderBy('week', 'asc').limit(500).get();
    const out = {};
    snap.docs.forEach((d) => {
      const v = d.data() || {};
      out[v.week || d.id] = v;
    });
    return out;
  },

  async saveWeek(key, entry) {
    if (!db) throw new Error('keine Datenbank');
    await db.doc(`weeks/${key}`).set(entry);
  },

  /** Live-Aktualisierung; gibt eine Funktion zum Abbestellen zurueck. */
  subscribe(cb) {
    if (!db) return () => {};
    return db.collection('weeks').orderBy('week', 'asc').limit(500).onSnapshot(
      (snap) => {
        const out = {};
        snap.docs.forEach((d) => {
          const v = d.data() || {};
          out[v.week || d.id] = v;
        });
        cb(out);
      },
      () => {}
    );
  }
};
