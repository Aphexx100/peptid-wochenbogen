/* Analyse direkt gegen die Anthropic-API, fuer den Betrieb auf GitHub Pages.

   Der Schluessel liegt im localStorage dieses Browsers und geht ausschliesslich
   an api.anthropic.com. Er landet nie im Repository. Der Kopfzeilen-Schalter
   anthropic-dangerous-direct-browser-access erlaubt den Aufruf ohne eigenen
   Server; das ist fuer eine private Seite mit einem einzigen Nutzer
   vertretbar, waere fuer eine oeffentliche Anwendung aber falsch, weil jeder
   Besucher den Schluessel auslesen koennte.

   Die Antwort wird gestreamt, damit der Text mitlaeuft statt am Stueck
   aufzuspringen. */

import { settings } from '../settings.js';

const URL_MESSAGES = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 2000;

const codeFor = (status) => {
  if (status === 401 || status === 403) return 'not_granted';
  if (status === 429) return 'rate_limited';
  if (status === 413) return 'prompt_too_large';
  return 'error';
};

export const anthropicAi = {
  id: 'anthropic',
  label: 'Anthropic-API',

  async init() {
    return !!settings().anthropic.key;
  },

  async ask(prompt, opts = {}) {
    const a = settings().anthropic;
    if (!a.key) throw Object.assign(new Error('kein Schlüssel'), { code: 'not_granted' });

    let res;
    try {
      res = await fetch(URL_MESSAGES, {
        method: 'POST',
        signal: opts.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': a.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: a.model || 'claude-sonnet-4-5',
          max_tokens: MAX_TOKENS,
          stream: true,
          messages: [{ role: 'user', content: prompt }]
        })
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw Object.assign(new Error('abgebrochen'), { code: 'cancelled' });
      throw Object.assign(new Error(err.message || 'Netzfehler'), { code: 'error' });
    }

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = (j.error && j.error.message) || '';
      } catch { /* Antwort ohne JSON-Koerper */ }
      throw Object.assign(new Error(detail || `HTTP ${res.status}`), { code: codeFor(res.status) });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let puffer = '';
    let text = '';
    let truncated = false;

    /* Server-Sent Events: Zeilen mit "data: " enthalten je ein JSON-Ereignis. */
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      puffer += decoder.decode(value, { stream: true });
      const zeilen = puffer.split('\n');
      puffer = zeilen.pop();
      for (const z of zeilen) {
        if (!z.startsWith('data:')) continue;
        const roh = z.slice(5).trim();
        if (!roh || roh === '[DONE]') continue;
        let ev;
        try {
          ev = JSON.parse(roh);
        } catch {
          continue;
        }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
          text += ev.delta.text;
          if (opts.onText) opts.onText({ text });
        } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason === 'max_tokens') {
          truncated = true;
        } else if (ev.type === 'error') {
          throw Object.assign(new Error((ev.error && ev.error.message) || 'Fehler'), { code: 'error', text });
        }
      }
    }

    if (!text) throw Object.assign(new Error('leere Antwort'), { code: 'empty_completion' });
    return { text, truncated };
  }
};
