/* Analyse ueber die Sampling-Faehigkeit des Claude-Artifacts.
   Kostet den Anwender nichts und braucht keinen Schluessel, existiert aber
   nur, solange die Seite in einem Claude-Viewer laeuft. */

import { useCap } from '../util/dom.js';

let sampleFn = null;

export const claudeAi = {
  id: 'claude',
  label: 'Claude-Artifact',

  async init() {
    sampleFn = await useCap('sample');
    return !!sampleFn;
  },

  /**
   * @param {string} prompt
   * @param {{signal?:AbortSignal, onText?:(u:{text:string})=>void, cache?:boolean}} opts
   * @returns {Promise<{text:string, truncated?:boolean}>}
   */
  async ask(prompt, opts = {}) {
    if (!sampleFn) throw Object.assign(new Error('nicht verfügbar'), { code: 'not_declared' });
    const o = { signal: opts.signal, onText: opts.onText };
    if (opts.cache === false) o.cache = false;
    return sampleFn(prompt, o);
  }
};
