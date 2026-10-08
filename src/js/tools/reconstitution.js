/* Rekonstitutionsrechner.
   Rechnet Zieldosis in Insulineinheiten um und prueft drei Dinge, die in der
   Praxis schieflaufen: die Menge passt nicht in die Spritze, sie ist zu fein
   zum Ablesen, oder das Vial verfaellt, bevor es aufgebraucht ist.
   U-100-Spritze: 100 I.E. = 1 ml, also 1 I.E. = 0,01 ml. */

import { $ } from '../util/dom.js';
import { fmt } from '../util/format.js';
import { CU_ANTEIL, HALTBAR_TAGE, RC_PRESETS, GLOW_VIAL } from '../constants.js';
import { state } from '../state.js';
import { vialStoffe } from '../substanzen.js';
import { saveConfig } from '../storage/index.js';
import { buildVials, refreshExpoUnits } from '../form/build.js';

const FELDER = ['rcVial', 'rcWasser', 'rcDosis', 'rcEinheit', 'rcSpritze', 'rcFreq'];

const row = (k, v, cls) =>
  `<div class="rcrow${cls ? ` ${cls}` : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;

/* Die Rechnung selbst, ohne Oberflaeche: dieselben Zahlen braucht auch das
   Formular "Stoff hinzufuegen" im Bogen, und zwei Rechenwege fuer dieselbe
   Spritze waeren eine Fehlerquelle mehr. Gibt fertiges HTML zurueck. */
export function rechne({ vial, wasser, dosisMg, kap = 30, freq = 1 }) {
  if (!(vial > 0 && wasser > 0 && dosisMg > 0)) {
    return '<div class="rcsub">Vial-Inhalt, Wasservolumen und Zieldosis eingeben.</div>';
  }
  const konz = vial / wasser;      /* mg je ml */
  const ml = dosisMg / konz;
  const ie = ml * 100;             /* U-100 */
  const dosen = vial / dosisMg;
  const reichweite = dosen * freq; /* Tage */

  let h = '';
  h += row('Aufziehen', `<b>${fmt(ie, 1)} I.E.</b>`, 'hero');
  h += row('entspricht', `${fmt(ml, 3)} ml`);
  h += row('Konzentration', `${fmt(konz, 2)} mg/ml`);
  h += row('Dosen je Vial', fmt(dosen, 1));
  h += row('Reicht rechnerisch', `${fmt(reichweite, 0)} Tage`);

  /* Beim GLOW-Vial die drei Bestandteile und die Kupfermenge mit ausweisen. */
  if (Math.abs(vial - GLOW_VIAL.gesamt) < 0.01) {
    const anteil = dosisMg / GLOW_VIAL.gesamt;
    const ghk = GLOW_VIAL.ghk * anteil;
    h +=
      `<div class="rcsub">Je Dosis: ${fmt(ghk, 2)} mg GHK-Cu, ${fmt(GLOW_VIAL.bpc * anteil, 2)} mg BPC-157, ` +
      `${fmt(GLOW_VIAL.tb * anteil, 2)} mg TB-500 — davon ${fmt(ghk * CU_ANTEIL * 1000, 0)} µg elementares Kupfer.</div>`;
  }

  /* Ablesbarkeit auf der Spritze. */
  if (ie > kap) {
    h +=
      `<div class="rcflag bad">Passt nicht in die Spritze: ${fmt(ie, 1)} I.E. bei ${kap} I.E. Kapazität. ` +
      `Mehr Wasser nehmen oder zweimal aufziehen.</div>`;
  } else if (ie > kap * 0.9) {
    h +=
      `<div class="rcflag">Randvoll: ${fmt(ie, 1)} I.E. von ${kap}. Kaum Spielraum, um Luftblasen ` +
      `herauszudrücken, ohne Dosis zu verlieren — mehr Wasser oder die größere Spritze.</div>`;
  } else if (ie < 3) {
    h +=
      `<div class="rcflag bad">Zu fein zum Ablesen: ${fmt(ie, 1)} I.E. Ein einzelner Skalenstrich wäre hier ` +
      `ein Dosisfehler von über 30 Prozent. Mit mehr Wasser ansetzen.</div>`;
  } else if (ie < 6) {
    h += `<div class="rcflag">Grenzwertig fein: ${fmt(ie, 1)} I.E. Mit mehr Wasser wird das Ablesen deutlich sicherer.</div>`;
  } else {
    h += `<div class="rcflag ok">Gut ablesbar: ${fmt(ie, 1)} I.E. auf einer ${kap}-I.E.-Spritze.</div>`;
  }

  /* Haltbarkeit gegen Verbrauch. */
  if (reichweite > HALTBAR_TAGE) {
    const nutzbar = Math.floor(HALTBAR_TAGE / freq);
    const verbraucht = nutzbar * dosisMg;
    h +=
      `<div class="rcflag">Vial überlebt den Verbrauch nicht: rechnerisch ${fmt(reichweite, 0)} Tage, ` +
      `aber rekonstituiert nur rund ${HALTBAR_TAGE} Tage haltbar. In dieser Zeit nutzt du ${nutzbar} Dosen ` +
      `(${fmt(verbraucht, 1)} mg), der Rest von ${fmt(vial - verbraucht, 1)} mg verfällt. ` +
      `Kleineres Vial suchen oder häufiger dosieren.</div>`;
  } else if (reichweite > HALTBAR_TAGE - 4) {
    h +=
      `<div class="rcflag ok">Passt knapp: ${fmt(reichweite, 0)} Tage Verbrauch gegen rund ` +
      `${HALTBAR_TAGE} Tage Haltbarkeit.</div>`;
  }

  return h;
}

/** Der Rechner im Setup-Reiter. */
export function renderRc() {
  const faktor = Number($('rcEinheit').value) || 1;
  $('rcOut').innerHTML = rechne({
    vial: Number($('rcVial').value) || 0,
    wasser: Number($('rcWasser').value) || 0,
    dosisMg: (Number($('rcDosis').value) || 0) * faktor,
    kap: Number($('rcSpritze').value) || 30,
    freq: Math.max(1, Number($('rcFreq').value) || 1)
  });
}

export function initRechner() {
  FELDER.forEach((id) => {
    $(id).addEventListener('input', renderRc);
    $(id).addEventListener('change', renderRc);
  });
  document.querySelectorAll('[data-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = RC_PRESETS[b.dataset.preset];
      if (!p) return;
      $('rcVial').value = p.vial;
      $('rcWasser').value = p.wasser;
      $('rcDosis').value = p.dosis;
      $('rcEinheit').value = p.einheit;
      $('rcFreq').value = p.freq;
      renderRc();
    });
  });

  renderVialZiele();
  renderRc();
}

/* Vial-Inhalt und Wasservolumen als aktuelles Vial in den Bogen schreiben.
   Die Zieldosis spielt dafuer keine Rolle — massgeblich ist, was im Vial ist
   und womit es aufgezogen wurde. Ein Knopf je Stoff, der ueberhaupt ein Vial
   hat; die Liste aendert sich, sobald im Bogen ein Stoff dazukommt. */
export function renderVialZiele() {
  const host = $('rcVialZiele');
  if (!host) return;
  const ziele = vialStoffe();
  host.textContent = '';
  host.style.gridTemplateColumns = `repeat(${Math.min(3, Math.max(1, ziele.length))},1fr)`;
  $('rcVialLeer').hidden = ziele.length > 0;
  ziele.forEach((x) => {
    const b = document.createElement('button');
    b.className = 'btn ghost';
    b.type = 'button';
    b.dataset.vialziel = x.k;
    b.style.cssText = 'font-size:.82rem;padding:.5rem .3rem';
    b.textContent = x.n;
    host.appendChild(b);
    b.addEventListener('click', async () => {
      const info = $('rcUebInfo');
      const mg = Number($('rcVial').value);
      const ml = Number($('rcWasser').value);
      if (!(mg > 0 && ml > 0)) {
        info.textContent = 'Erst Vial-Inhalt und Wasservolumen oben eingeben.';
        info.className = 'saveinfo bad';
        return;
      }
      state.cfg.vials = { ...(state.cfg.vials || {}), [x.k]: { mg, ml } };
      buildVials();
      refreshExpoUnits();
      const r = await saveConfig(state.cfg);
      info.textContent = r.ok
        ? `${x.n}-Vial übernommen: ${fmt(mg / ml, 2)} mg/ml. Steht jetzt im Bogen unter „Aktuelle Vials".`
        : r.text;
      info.className = `saveinfo ${r.ok ? 'ok' : 'bad'}`;
    });
  });
}
