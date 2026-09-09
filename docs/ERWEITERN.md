# Erweitern

Die häufigen Änderungen zuerst, mit abnehmender Häufigkeit nach unten.

---

## Eine Frage hinzufügen

Der häufigste Fall, und der einfachste: **eine Zeile in `src/js/schema.js`**. Formular,
CSV-Spalte und Datenblock für die Analyse entstehen daraus von selbst.

Ein neuer Schieberegler bei den Kernbereichen:

```js
export const KERN = [
  …
  { k: 'libido', n: 'Sexuelles Verlangen im Wochenschnitt', lo: 'sehr niedrig', hi: 'sehr hoch' }
];
```

`k` ist der Schlüssel im gespeicherten Objekt und muss über alle Listen hinweg eindeutig
sein. Er wird nie wieder geändert — sonst verlieren die alten Wochen ihren Wert. `n` ist
die Beschriftung, `lo` und `hi` die Enden der Skala.

Bei einer Beobachtungsliste (`WATCH`, `PT_SIGNS`, `CONF_CHECKS`, `MONTH`) reichen `k` und `n`:

```js
export const WATCH = [
  …
  { k: 'schlafstoerung', n: 'Ein- oder Durchschlafstörung' }
];
```

Die neue Frage erscheint sofort im Bogen und in der CSV. Ältere Wochen haben dort schlicht
keinen Wert — das ist richtig so und wird als Lücke geführt, nicht als Null.

**Eine Frage nie löschen, wenn sie schon Daten hat.** Auskommentieren entfernt sie aus
Formular und CSV, die alten Werte bleiben in den gespeicherten Objekten erhalten.

## Eine Substanz im Tagesraster ergänzen

Auch das ist eine Zeile in `src/js/schema.js`, in der Liste `EXPO`:

```js
export const EXPO = [
  …
  { k: 'neu', n: 'Anzeigename', u: 'mg', step: 0.5 }
];
```

Das Raster in Abschnitt 02 bekommt die neue Spalte von selbst, ebenso das
Tagesprotokoll im Datenblock und in der CSV. Die abgeleiteten Wochensummen
(`dose.n_…`/`dose.d_…`) entstehen nur für die drei ursprünglichen Substanzen —
wer für eine neue Substanz eigene Kennzahlen braucht, ergänzt sie in
`src/js/analysis/metrics.js` und liest die Tageswerte aus `dose.tage.neu`.

## Eine Verlaufsgrafik hinzufügen

Eine Zeile in `buildSeries()` in `src/js/analysis/report.js`:

```js
{ n: 'Sexuelles Verlangen', v: list.map((e) => (e.kern ? e.kern.libido : null)), max: 10 },
```

`max` ist die Skalenobergrenze oder `'auto'` für eine an die Daten angepasste Achse.
Reihen mit weniger als zwei Werten fallen automatisch weg — eine neue Grafik erscheint
also erst, wenn sie etwas zu zeigen hat.

## Eine Kennzahl hinzufügen

Rechnung nach `src/js/analysis/metrics.js` — dort ist alles rein, ohne DOM und ohne
Zustand, und deshalb einzeln prüfbar:

```js
export const meineKennzahl = (e) => ofKeys(e.kern, ['energie', 'regen']);
```

Anzeige dann in `report.js`, Ausgabe an die Analyse in `ai/context.js`.

## Die Auswertungsregeln ändern

`src/js/ai/briefing.js`. Dort steht, worauf die Analyse achten muss — dass Tirzepatid der
dominante Confounder ist, dass der IIEF-5 der Primärendpunkt ist, dass unter zehn Wochen
ein Trend als Rauschen gilt, dass keine Dosierungsempfehlungen gegeben werden.

Das ist der wertvollste Text im Projekt. Wer die Fragestellung verschiebt, ändert ihn —
nicht die Aufrufe.

## Eine Analyse-Frage hinzufügen

Ein Eintrag in `ANFRAGEN` in `src/js/ui/analyse.js`, plus die zugehörigen Elemente im
HTML (Knopf, Abbrechen-Knopf, Ausgabefeld, Meldungszeile):

```js
{
  btn: 'askGlow', stop: 'stopGlow', out: 'outGlow', info: 'infoGlow',
  wochen: 40, cache: true, minWochen: 4,
  leerText: 'Mindestens vier Wochen nötig.',
  aufgabe: 'Prüfe ausschließlich die GLOW-Ziele gegen das vorab festgelegte Erwartungsfenster. …'
}
```

Aufbau, Streaming, Abbruch und Fehlerbehandlung kommen dann von selbst.

## Eine weitere Ablage anbinden

Ein Modul in `src/js/storage/` mit diesen Methoden:

```js
export const meineAblage = {
  id: 'meine',
  label: 'Anzeigename',
  async init() { return true; },          // false, wenn hier nicht benutzbar
  async loadConfig() { return null; },
  async saveConfig(cfg) {},
  async loadWeeks() { return {}; },       // { wochenschlüssel: eintrag }
  async saveWeek(key, entry) {},
  subscribe(cb) { return () => {}; }      // optional, für Live-Aktualisierung
};
```

Dann in `storage/index.js` in `waehleRemote()` eintragen und als Option in die Auswahl
`#stBackend` in `index.html`. Fehler dürfen geworfen werden — die Fassade fängt sie und
meldet sie, die lokale Kopie ist zu dem Zeitpunkt längst geschrieben.

## Eine weitere Analysequelle anbinden

Ein Modul in `src/js/ai/` mit `init()` und `ask(prompt, { signal, onText })`, das
`{ text, truncated }` zurückgibt und im Fehlerfall einen Fehler mit `.code` wirft (die
Codes stehen in `errCopy()`). Dann in `ai/index.js` in die Liste eintragen.

## Farben ändern

Nur `src/css/tokens.css`, und dort in allen drei Blöcken: `:root` für hell,
`@media (prefers-color-scheme: dark)` für die Systemeinstellung, `:root[data-theme="dark"]`
für die ausdrückliche Wahl.

`app.css` enthält keinen einzigen Farbwert. Wer dort einen Hexwert schreibt, bricht das
Farbschema in einem der drei Fälle. Die Regel lässt sich prüfen:

```bash
grep -n '#[0-9a-fA-F]\{3,6\}' src/css/app.css   # muss leer bleiben
```

## Nach jeder Änderung

```bash
npm run check     # baut die Einzeldatei und fährt beide Fassungen durch 52 Prüfungen
```

Der Rauchtest startet einen echten Browser, füllt den Bogen aus, speichert, lädt neu und
prüft, dass alles noch da ist. Wer eine Funktion ergänzt, ergänzt am besten eine Prüfung
in `scripts/smoke-test.mjs` — das Muster dort ist eine Zeile.
