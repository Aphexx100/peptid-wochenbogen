/* Kleine Verlaufsgrafik ohne Bibliothek.
   Erwartet Werte in Wochenreihenfolge; Luecken (null) werden uebersprungen,
   nicht interpoliert. `max` ist entweder eine feste Obergrenze oder "auto"
   fuer eine an die Daten angepasste Achse. Farben kommen ausschliesslich aus
   den Design-Tokens, damit die Grafik dem Farbschema folgt. */

import { fmt } from '../util/format.js';

export function sparkline(name, vals, labels, max) {
  const pts = [];
  vals.forEach((v, i) => {
    if (v !== null && v !== undefined) pts.push({ v, l: labels[i] });
  });
  if (pts.length < 2) return null;

  const W = 600;
  const H = 54;
  const P = 5;
  const n = pts.length;

  let lo = 0;
  let hi = max;
  let mid = max / 2;
  if (max === 'auto') {
    const vs = pts.map((p) => p.v);
    lo = Math.min(...vs);
    hi = Math.max(...vs);
    if (hi === lo) hi = lo + 1;
    const padv = (hi - lo) * 0.15;
    lo -= padv;
    hi += padv;
    mid = (lo + hi) / 2;
  }

  const x = (i) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const tail = pts[n - 1];

  const wrap = document.createElement('div');
  wrap.className = 'spark';
  wrap.innerHTML =
    `<div class="spark-head"><span class="spark-title">${name}</span>` +
    `<span class="spark-read">${fmt(tail.v, 1)} · ${tail.l}</span></div>` +
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${name} über die Wochen">` +
    `<line x1="${P}" y1="${y(mid).toFixed(1)}" x2="${W - P}" y2="${y(mid).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>` +
    `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${x(n - 1).toFixed(1)}" cy="${y(tail.v).toFixed(1)}" r="4" fill="var(--accent)"/>` +
    `<circle class="cur" cx="-99" cy="-99" r="4.5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>` +
    `</svg>`;

  const svg = wrap.querySelector('svg');
  const read = wrap.querySelector('.spark-read');
  const cur = wrap.querySelector('.cur');

  function move(ev) {
    const r = svg.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const i = Math.max(0, Math.min(n - 1, Math.round((cx / r.width) * (n - 1))));
    cur.setAttribute('cx', x(i).toFixed(1));
    cur.setAttribute('cy', y(pts[i].v).toFixed(1));
    read.textContent = `${fmt(pts[i].v, 1)} · ${pts[i].l}`;
  }
  function leave() {
    cur.setAttribute('cx', '-99');
    read.textContent = `${fmt(tail.v, 1)} · ${tail.l}`;
  }
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('touchend', leave);
  return wrap;
}
