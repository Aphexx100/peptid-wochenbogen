/* Alle Fragebogen-Definitionen an einem Ort.
   Ein neues Item entsteht durch eine neue Zeile in einer dieser Listen —
   Formular, CSV, Datenblock und Sparklines lesen alle aus denselben Arrays.
   Siehe docs/ERWEITERN.md. */
/* Eingebaute Substanzen des Tagesrasters in Abschnitt 02. `k` ist zugleich der
   Schluessel in dose.tage; `step` steuert die Schrittweite des Zahlenfeldes.
   `vial:false` heisst: kommt fertig dosiert (Pen, Kapsel), wird nicht
   rekonstituiert und deshalb immer direkt in der Wirkstoffeinheit erfasst,
   nie in I.E.
   Weitere Stoffe legt der Nutzer selbst im Bogen an; sie liegen in
   cfg.stoffe und kommen hier nicht vor — zusammengefuehrt werden beide
   Listen in substanzen.js, und nur die liest der Rest des Programms. */
export const EXPO = [
  {k:"glow", n:"GLOW",       u:"mg", step:0.1,  ph:"2,8"},
  {k:"kiss", n:"Kisspeptin", u:"µg", step:5,    ph:"100"},
  /* PT-141 laeuft anlassbezogen, hoechstens einmal pro Woche. `bedarf`
     stellt es im Tag hinter die Notiz, zugeklappt, statt es jeden Tag
     zwischen die Routine-Wirkstoffe zu setzen. Gespeichert wird es wie
     jeder andere Stoff in dose.tage. */
  {k:"pt",   n:"PT-141",     u:"mg", step:0.25, ph:"1,75", bedarf:true},
  {k:"tirz", n:"Tirzepatid", u:"mg", step:0.5,  ph:"2,5", vial:false},
  {k:"dhea", n:"DHEA",       u:"mg", step:5,    ph:"25", vial:false},
  /* Supplemente stehen in derselben Liste und derselben Tabelle wie die
     Wirkstoffe — erfasst wird beides gleich. `kat:"supp"` haelt sie nur aus
     der Tagesmengen-Grafik heraus. */
  {k:"kreatin", n:"Kreatin", u:"g", step:1, vial:false, kat:"supp"},
  {k:"protein", n:"Protein", u:"g", step:5, vial:false, kat:"supp"}
];
/* Alkohol — kein Stoff, den man sich setzt, sondern ein Confounder, und
   deshalb als eigene Spalte neben den Substanzen. Wie bei ihnen gilt die
   Zeile fuer den Tag selbst: der Alkohol von gestern gehoert in die Zeile
   von gestern. Gezaehlt wird seit 2026-10 in Litern (vorher in
   0,5-l-Flaschen; alte Eintraege werden beim Laden halbiert, siehe
   storage/migrate.js). Gespeichert unter dose.zufuhr.
   Kreatin und Protein standen bis 2026-10 ebenfalls hier und sind als
   Supplemente zu den Substanzen gewandert. */
export const ZUFUHR = [
  {k:"alk", n:"Alkohol", u:"l", step:0.5}
];
/* Freitextspalten des Tagesrasters in Abschnitt 02 — je Tag eine Notiz.
   Getrennt von EXPO, weil dort gerechnet wird und hier nur notiert. Das
   Wochenfeld dose.<k> entsteht daraus als Liste mit Tagesangabe
   ("Mo 07.09.: Rötung; Mi 09.09.: …"). Die Spalten sonstMed (sonstige
   Medikamente) und abw (Abweichungen) sind 2026-09 entfallen; ihre schon
   erfassten Werte traegt model.js beim Speichern unveraendert weiter. */
export const EXPO_TEXT = [
  {k:"stellen", n:"Einstichstellen — Auffälligkeiten", kurz:"Einstichstellen", ph:"Rötung, Knoten …"},
  {k:"tag",     n:"Kommentar zum Tag",                 kurz:"Kommentar",       ph:"was heute anders war …"}
];
/** Entfallene Notizspalten — nur noch gelesen und weitergetragen. */
export const EXPO_TEXT_ALT = ["sonstMed", "abw"];
/* Taegliche Confounder in Abschnitt 02b. Jeder Wert bezieht sich auf den
   VORTAG der Zeile: Schlaf der letzten Nacht, Training von gestern. Protein
   und Alkohol standen bis 2026-09 ebenfalls hier und sind in ZUFUHR
   gewandert; alte Wochen werden beim Laden um einen Tag verschoben. */
export const CONF_TAGE = [
  {k:"train",   n:"Training",  u:"h",   step:0.5},
  {k:"schlaf",  n:"Schlaf",    u:"h",   step:0.5}
];
export const KERN = [
  {k:"energie",  n:"Energie und Belastbarkeit",                 lo:"leer",           hi:"voll"},
  {k:"schlaf",   n:"Schlafqualität",                            lo:"schlecht",       hi:"sehr gut"},
  {k:"regen",    n:"Regeneration nach Belastung",               lo:"sehr langsam",   hi:"sehr schnell"},
  {k:"haare",    n:"Haare und Nägel",                           lo:"schlecht",       hi:"sehr gut"},
  {k:"wunde",    n:"Heilung kleiner Wunden und Kratzer",        lo:"sehr langsam",   hi:"sehr schnell"},
  {k:"magen",    n:"Verdauung und Magen",                       lo:"schlecht",       hi:"sehr gut"}
];
/* Bereiche des ausfuehrlichen Fragebogens. Jede Karte in index.html traegt
   ihren Bereich als `data-bereich`; die Haekchen unter dem Fragebogen-Knopf
   blenden ihn ein oder aus (ui/weekly.js). Abgewaehlt heisst nur unsichtbar
   — gespeicherte Antworten bleiben unberuehrt. Karten ohne `data-bereich`
   (Erwartung, Speichern) stehen immer. */
export const BEREICHE = [
  {k:"haut",    n:"Haut und Pigmentierung"},
  {k:"schmerz", n:"Schmerzbild und Gelenke"},
  {k:"energie", n:"Energie und Wohlbefinden"},
  {k:"koerper", n:"Körperzusammensetzung und Kraft"},
  {k:"sicher",  n:"Sicherheit und Kontrollen"},
  {k:"umfeld",  n:"Umfeld und Confounder"}
];
/* Die drei Wirkungen, die vom GLOW-Stack erwartet werden — als eigener Endpunktblock,
   damit sie nicht im allgemeinen Kontext untergehen. `b` sagt, in welcher
   Karte das Item steht: Haut, Gelenke oder Wohlbefinden. Die Schluessel
   bleiben dieselben, die Aufteilung ist reine Darstellung. */
export const GLOWZIEL = [
  {k:"gHautText", n:"Hautbild — Textur und Straffheit",     lo:"schlecht",     hi:"sehr gut",     b:"haut"},
  {k:"gHautRot",  n:"Hautbild — Rötung und Reizung",        lo:"stark",        hi:"keine",        b:"haut"},
  {k:"gGelenkRuhe",n:"Gelenkschmerz in Ruhe",               lo:"stark",        hi:"keiner",       b:"schmerz"},
  {k:"gSteif",    n:"Morgendliche Steifigkeit",             lo:"stark",        hi:"keine",        b:"schmerz"},
  {k:"gGelenkLast",n:"Gelenke unter Belastung",             lo:"schmerzhaft",  hi:"beschwerdefrei",b:"schmerz"},
  {k:"gWohl",     n:"Allgemeines Wohlbefinden",             lo:"schlecht",     hi:"sehr gut",     b:"wohl"}
];
/* Zwei Umfaenge genuegen. Die Schluessel bleiben, damit bereits erfasste
   Wochen ihre Werte behalten; nur die Beschriftung sagt jetzt, dass keine
   Seite mehr unterschieden wird. Die entfallenen Masse (mArmL, mBeinR,
   mBeinL) stehen weiter in alten Eintraegen und werden mitgeschleppt. */
export const MASSE = [
  {k:"mBrust",  n:"Brustumfang",   u:"cm"},
  {k:"mArmR",   n:"Oberarmumfang", u:"cm"}
];
/** Entfallene Koerpermasse — nur noch gelesen und weitergetragen. */
export const MASSE_ALT = ["mArmL", "mBeinR", "mBeinL"];
export const WHO = [
  "war ich froh und guter Laune",
  "habe ich mich ruhig und entspannt gefühlt",
  "habe ich mich energisch und aktiv gefühlt",
  "habe ich mich beim Aufwachen frisch und ausgeruht gefühlt",
  "war mein Alltag voller Dinge, die mich interessieren"
];
export const WHO_LEG = ["zu keinem Zeitpunkt","die ganze Zeit"];
/* 2026-11 entfallen: Sexualfunktion (IIEF-5), Morgenerektionen, die
   PT-141-Karte samt Begleitphaenomenen, Pigmentierung, Negativkontrollen,
   Beobachtungsliste und die Wochen-Confounder. Was davon weiter beobachtet
   wird, steht jetzt als Fliesstext im Wochenkommentar (conf.sonst) oder im
   Tageskommentar (dose.notizen.tag). Bereits erfasste Werte bleiben in den
   gespeicherten Wochen stehen; Auswertung und CSV lesen sie nicht mehr. */
export const MONTH = [
  {k:"foto", n:"Standardfotos (Gesicht, Scheitel) — gleiche Zeit, gleiches Licht, gleicher Abstand"},
  {k:"mole", n:"Muttermal-Übersichtsfotos (Rücken, Brust, Arme, Beine) — gleiche Bedingungen"},
  {k:"rr",   n:"Blutdruck über sieben Tage, zweimal täglich"},
  {k:"gew",  n:"Gewicht und Bauchumfang"},
  {k:"labor",n:"Labor: Serum-Kupfer, Coeruloplasmin, LH, FSH, Testosteron gesamt und frei, SHBG, Estradiol"}
];
