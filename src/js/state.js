/* Gemeinsamer Laufzeitzustand.
   Bewusst ein einzelnes Objekt statt exportierter Variablen: ES-Module
   exportieren Bindungen schreibgeschuetzt, ein Objekt laesst sich aus jedem
   Modul veraendern, ohne Setter durchzureichen. */

export const state = {
  /** Alle erfassten Wochen, Schluessel ist das Enddatum der Woche (YYYY-MM-DD). */
  weeks: {},
  /** Schluessel der Woche, die das Formular gerade zeigt. */
  weekKey: '',
  /** Einmalige Einstellungen; wird als ein Dokument gespeichert. */
  cfg: {
    start: '', day: 6, glowStart: '',
    erwHaut: 9, erwGelenk: 9, erwWohl: 9, ghk: 2,
    uebungen: ['Kniebeuge', 'Rudern', 'Bankdrücken', 'Schulterdrücken'],
    /* Aktuelle Vials je Substanz: { glow: {mg, ml}, … }. Aus Inhalt und
       Wasservolumen entsteht die Konzentration, mit der die ml-Eintraege des
       Tagesrasters in Wirkstoffmengen umgerechnet werden. Ohne Vial wird die
       Substanz weiter direkt in mg bzw. µg erfasst. */
    vials: {}
  }
};

/** Wochenschluessel aufsteigend sortiert. */
export function keys() {
  return Object.keys(state.weeks).sort();
}
