/** Kurzform fuer getElementById. */
export const $ = (id) => document.getElementById(id);

/**
 * Claude-Laufzeitfaehigkeit anfordern.
 * Ausserhalb eines Claude-Viewers existiert `claude` nicht; ein ungeschuetzter
 * Zugriff wuerde die Seite beim Laden abbrechen. Immer ueber diesen Weg gehen.
 * @returns {Promise<any|null>} null, wenn die Faehigkeit hier nicht verfuegbar ist
 */
export function useCap(name) {
  try {
    if (typeof claude === 'undefined' || !claude || typeof claude.use !== 'function') {
      return Promise.resolve(null);
    }
    return Promise.resolve(claude.use(name));
  } catch {
    return Promise.resolve(null);
  }
}

/** Laeuft die Seite in einem Claude-Viewer? */
export const inClaudeViewer = () =>
  typeof claude !== 'undefined' && !!claude && typeof claude.use === 'function';
