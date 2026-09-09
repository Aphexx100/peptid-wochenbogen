/* Feste Kennzahlen des Protokolls. Zentral, damit eine Korrektur an einer
   Stelle passiert und nicht an fuenf. */

/** Massenanteil elementaren Kupfers im GHK-Cu-Komplex (63,5 / 402 g/mol). */
export const CU_ANTEIL = 0.1581;

/** Haltbarkeit eines rekonstituierten Vials im Kuehlschrank, in Tagen. */
export const HALTBAR_TAGE = 28;

/** Orale Zufuhrempfehlung Kupfer fuer Erwachsene, mg pro Tag. */
export const CU_RDA_MG_TAG = 0.9;

/** Voreinstellungen des Rekonstitutionsrechners. */
export const RC_PRESETS = {
  glow: { vial: 70, wasser: 3,   dosis: 2.8, einheit: '1',     freq: 1, name: 'GLOW' },
  kiss: { vial: 10, wasser: 2.5, dosis: 500, einheit: '0.001', freq: 3, name: 'Kisspeptin' },
  pt:   { vial: 10, wasser: 1,   dosis: 2.5, einheit: '1',     freq: 7, name: 'PT-141' }
};

/** Zusammensetzung des 70-mg-GLOW-Vials in mg. */
export const GLOW_VIAL = { gesamt: 70, ghk: 50, bpc: 10, tb: 10 };
