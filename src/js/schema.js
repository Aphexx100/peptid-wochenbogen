/* Alle Fragebogen-Definitionen an einem Ort.
   Ein neues Item entsteht durch eine neue Zeile in einer dieser Listen —
   Formular, CSV, Datenblock und Sparklines lesen alle aus denselben Arrays.
   Siehe docs/ERWEITERN.md. */
export const KERN = [
  {k:"energie",  n:"Energie und Belastbarkeit",                 lo:"leer",           hi:"voll"},
  {k:"schlaf",   n:"Schlafqualität",                            lo:"schlecht",       hi:"sehr gut"},
  {k:"regen",    n:"Regeneration nach Belastung",               lo:"sehr langsam",   hi:"sehr schnell"},
  {k:"haare",    n:"Haare und Nägel",                           lo:"schlecht",       hi:"sehr gut"},
  {k:"wunde",    n:"Heilung kleiner Wunden und Kratzer",        lo:"sehr langsam",   hi:"sehr schnell"},
  {k:"magen",    n:"Verdauung und Magen",                       lo:"schlecht",       hi:"sehr gut"}
];
/* Die drei Wirkungen, die vom GLOW-Stack erwartet werden — als eigener Endpunktblock,
   damit sie nicht im allgemeinen Kontext untergehen. */
export const GLOWZIEL = [
  {k:"gHautText", n:"Hautbild — Textur und Straffheit",     lo:"schlecht",     hi:"sehr gut"},
  {k:"gHautRot",  n:"Hautbild — Rötung und Reizung",        lo:"stark",        hi:"keine"},
  {k:"gGelenkRuhe",n:"Gelenkschmerz in Ruhe",               lo:"stark",        hi:"keiner"},
  {k:"gSteif",    n:"Morgendliche Steifigkeit",             lo:"stark",        hi:"keine"},
  {k:"gGelenkLast",n:"Gelenke unter Belastung",             lo:"schmerzhaft",  hi:"beschwerdefrei"},
  {k:"gWohl",     n:"Allgemeines Wohlbefinden",             lo:"schlecht",     hi:"sehr gut"}
];
export const MASSE = [
  {k:"mBrust",  n:"Brustumfang",              u:"cm"},
  {k:"mArmR",   n:"Oberarm rechts",           u:"cm"},
  {k:"mArmL",   n:"Oberarm links",            u:"cm"},
  {k:"mBeinR",  n:"Oberschenkel rechts",      u:"cm"},
  {k:"mBeinL",  n:"Oberschenkel links",       u:"cm"}
];
export const WHO = [
  "war ich froh und guter Laune",
  "habe ich mich ruhig und entspannt gefühlt",
  "habe ich mich energisch und aktiv gefühlt",
  "habe ich mich beim Aufwachen frisch und ausgeruht gefühlt",
  "war mein Alltag voller Dinge, die mich interessieren"
];
export const WHO_LEG = ["zu keinem Zeitpunkt","die ganze Zeit"];
export const IIEF = [
  {t:"Wie würden Sie Ihre Zuversicht einschätzen, eine Erektion zu bekommen und zu behalten?", lo:"sehr gering", hi:"sehr groß", zero:false},
  {t:"Wenn Sie bei sexueller Stimulation Erektionen hatten, wie oft waren Ihre Erektionen hart genug für die Penetration?", lo:"fast nie", hi:"fast immer", zero:true, zeroLab:"keine sexuelle Stimulation"},
  {t:"Wie oft waren Sie beim Geschlechtsverkehr in der Lage, Ihre Erektion nach der Penetration aufrechtzuerhalten?", lo:"fast nie", hi:"fast immer", zero:true, zeroLab:"kein Geschlechtsverkehr"},
  {t:"Wie schwierig war es, die Erektion bis zur Vollendung des Geschlechtsverkehrs aufrechtzuerhalten?", lo:"äußerst schwierig", hi:"nicht schwierig", zero:true, zeroLab:"kein Geschlechtsverkehr"},
  {t:"Wenn Sie versuchten, Geschlechtsverkehr zu haben, wie oft war er befriedigend für Sie?", lo:"fast nie", hi:"fast immer", zero:true, zeroLab:"kein Geschlechtsverkehr"}
];
export const MORGEN = [
  {k:"mDauer",   n:"Typische Dauer bis zum Abklingen", lo:"wenige Minuten", hi:"mehrere Stunden"},
  {k:"mStaerke", n:"Typische Stärke",                  lo:"schwach",        hi:"sehr stark"}
];
export const PT = [
  {k:"ptMit",  n:"Verlangen an PT-141-Tagen",           lo:"sehr niedrig", hi:"sehr hoch"},
  {k:"ptOhne", n:"Verlangen an Tagen ohne PT-141",      lo:"sehr niedrig", hi:"sehr hoch"},
  {k:"ptNw",   n:"Nebenwirkungen an Anwendungstagen",   lo:"keine",        hi:"stark"}
];
export const PT_SIGNS = [
  {k:"sStreck", n:"Drang, sich zu strecken oder zu dehnen"},
  {k:"sGaehn",  n:"Gähnen"},
  {k:"sSpann",  n:"Kurzes Anspannen der Muskulatur"},
  {k:"sEnergie",n:"Gefühl von überschüssiger Energie oder Unruhe"},
  {k:"sGaense", n:"Gänsehaut oder Kribbeln"},
  {k:"sFlush",  n:"Flush oder Wärmegefühl"},
  {k:"sUebel",  n:"Übelkeit"},
  {k:"sKopf",   n:"Kopfschmerz"}
];
export const PIGMENT = [
  {k:"pTempo", n:"Bräunungsgeschwindigkeit gegenüber früher", lo:"wie immer", hi:"deutlich schneller"},
  {k:"pTiefe", n:"Erreichte Bräunungstiefe",                  lo:"wie immer", hi:"deutlich dunkler"},
  {k:"pDauer", n:"Wie lange die Bräune anhält",               lo:"wie immer", hi:"deutlich länger"}
];
export const NEG = [
  {k:"nGeruch", n:"Geruchssinn",  lo:"schlecht", hi:"sehr gut"},
  {k:"nSeh",    n:"Sehschärfe",   lo:"schlecht", hi:"sehr gut"},
  {k:"nHoer",   n:"Hörvermögen",  lo:"schlecht", hi:"sehr gut"}
];
export const WATCH = [
  {k:"metall", n:"Metallischer Geschmack"},
  {k:"uebel",  n:"Übelkeit"},
  {k:"gi",     n:"Magen-Darm-Beschwerden"},
  {k:"kopf",   n:"Kopfschmerz"},
  {k:"flush",  n:"Flush oder Hitzewallung"},
  {k:"fatigue",n:"Ungewöhnliche Müdigkeit"},
  {k:"blut",   n:"Ungewöhnliche Blutergüsse"},
  {k:"mal",    n:"Muttermal neu oder verändert"},
  {k:"pigm",   n:"Hautverfärbung, Pigmentierung"},
  {k:"knoten", n:"Knoten oder Verhärtung an Einstichstelle"},
  {k:"rr",     n:"Blutdrucksymptome (Druck im Kopf, Schwindel)"},
  {k:"stim",   n:"Ungewöhnliche Stimmungsschwankung"}
];
export const CONF_CHECKS = [
  {k:"krank",  n:"Krankheit oder Infekt"},
  {k:"reise",  n:"Reise oder Zeitzonenwechsel"},
  {k:"wett",   n:"Wettkampf oder ungewohnte Belastung"},
  {k:"diet",   n:"Ernährung deutlich verändert"}
];
export const MONTH = [
  {k:"foto", n:"Standardfotos (Gesicht, Scheitel) — gleiche Zeit, gleiches Licht, gleicher Abstand"},
  {k:"mole", n:"Muttermal-Übersichtsfotos (Rücken, Brust, Arme, Beine) — gleiche Bedingungen"},
  {k:"rr",   n:"Blutdruck über sieben Tage, zweimal täglich"},
  {k:"gew",  n:"Gewicht und Bauchumfang"},
  {k:"labor",n:"Labor: Serum-Kupfer, Coeruloplasmin, LH, FSH, Testosteron gesamt und frei, SHBG, Estradiol"}
];
