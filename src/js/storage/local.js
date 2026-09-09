/* Ablage im Browser. Immer verfuegbar, immer sofort, nie synchronisiert.
   Dient zugleich als Zwischenspeicher fuer die entfernte Ablage: was hier
   liegt, ist auch ohne Netz sichtbar. */

const K_CFG = 'pwb.cfg.v1';
const K_WEEKS = 'pwb.weeks.v1';

const lese = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const schreibe = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

export const localStore = {
  id: 'local',
  label: 'nur dieses Gerät',

  async init() {
    try {
      localStorage.setItem('pwb.probe', '1');
      localStorage.removeItem('pwb.probe');
      return true;
    } catch {
      return false;
    }
  },

  async loadConfig() {
    return lese(K_CFG, null);
  },

  async saveConfig(cfg) {
    if (!schreibe(K_CFG, cfg)) throw new Error('localStorage nicht beschreibbar');
  },

  async loadWeeks() {
    return lese(K_WEEKS, {});
  },

  async saveWeek(key, entry) {
    const all = lese(K_WEEKS, {});
    all[key] = entry;
    if (!schreibe(K_WEEKS, all)) throw new Error('localStorage nicht beschreibbar');
  },

  /** Alles auf einmal ersetzen — fuer den Abgleich mit der entfernten Ablage. */
  async replaceWeeks(all) {
    schreibe(K_WEEKS, all);
  },

  async deleteWeek(key) {
    const all = lese(K_WEEKS, {});
    delete all[key];
    schreibe(K_WEEKS, all);
  }
};
