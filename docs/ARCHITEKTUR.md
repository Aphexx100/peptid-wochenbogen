# Architektur

## Die Leitidee

Der Bogen soll an drei Stellen wachsen können, ohne dass man ihn dafür versteht: neue
Fragen, neue Ablage, neue Analysequelle. Alles andere ist Beiwerk.

Neue Fragen sind Daten, keine Programmierung — sie stehen in `schema.js`, und Formular,
CSV und Datenblock lesen dieselbe Liste. Ablage und Analysequelle sind Adapter mit
jeweils einer Handvoll Methoden; eine weitere anzubinden heißt, ein Modul zu schreiben
und es in eine Liste einzutragen.

## Ordner

```
index.html              nur Struktur — keine Fragen, keine Logik
src/css/tokens.css      alle Farben, in drei Blöcken für hell, dunkel, umgeschaltet
src/css/app.css         Komponenten, ausschließlich über Tokens gefärbt
src/js/
  main.js               Einstieg: aufbauen, verdrahten, laden
  schema.js             ALLE Fragen und Listen des Bogens
  constants.js          feste Kennzahlen (Kupferanteil, Haltbarkeit, Vial-Presets)
  state.js              der gemeinsame Laufzeitzustand
  settings.js           gerätegebundene Zugangsdaten, nur localStorage
  util/                 dom, format, date — klein und ohne Abhängigkeiten
  ui/                   controls, tabs, status, setup, analyse, weekly
  form/                 build (Aufbau), model (lesen/füllen), save (Aktionen)
  analysis/             metrics (reine Rechnung), sparkline, report
  storage/              index (Fassade), local, github, claude-db
  ai/                   index (Fassade), briefing, context, claude-sample, anthropic
  tools/                reconstitution — der Rekonstitutionsrechner
  export/               csv
scripts/                serve, build-single, smoke-test
docs/                   diese Dateien
```

## Datenfluss

```
schema.js ──► form/build.js ──► DOM
                                 │
                    form/model.js│readForm()
                                 ▼
                            Wochenobjekt ──► storage/index.js ──► local + (github | claude)
                                 │
                                 ├──► analysis/metrics.js ──► report.js  (Kacheln, Grafiken)
                                 ├──► export/csv.js                       (Tabelle)
                                 └──► ai/context.js ──► ai/index.js       (Analyse)
```

Das Wochenobjekt aus `readForm()` ist das einzige Datenformat: es steht so in der
Datenbank, so in der JSON-Datei auf GitHub und so im Datenblock für die Analyse. Es gibt
keine zweite Repräsentation, die mitgepflegt werden müsste.

## Zustand

`state.js` exportiert ein einziges veränderliches Objekt. Das ist Absicht: ES-Module
exportieren Bindungen schreibgeschützt, ein `export let weeks` ließe sich aus keinem
anderen Modul setzen. Ein Objekt löst das ohne Setter-Kaskaden.

```js
state.weeks    // { "2026-09-12": {…}, … }  Schlüssel ist der Erfassungstag der Woche
state.weekKey  // welche Woche das Formular zeigt
state.cfg      // Protokollstart, Erfassungstag, Erwartungsfenster, Übungsnamen, Vials
```

## Zwei Takte

Der Wochenschlüssel ist der **nächste** Erfassungstag: die laufende Woche sammelt ihre
Tage bis dorthin. Täglich erfasst werden Exposition, Confounder und WHO-5; alles Übrige
beurteilt eine ganze Woche und bleibt bis zum Erfassungstag verborgen (`ui/weekly.js`,
Klasse `weekly` in `index.html`). Solange die Wochenfragen geschlossen sind, übernimmt
das tägliche Speichern für sie den zuletzt gespeicherten Stand der Woche
(`behalteWochenfragen()` in `form/model.js`) — ihre Regler stehen dann auf Vorgabewerten,
die sonst wie Antworten aussähen.

Der Schnitt hat einen Grund: Was nur der Tag weiß — eine Injektion, drei Stunden Schlaf,
zwei Bier — ist am Samstag nicht mehr rekonstruierbar, sondern geraten. Was die Woche
beurteilt — Hautbild, Gelenke, Kernbereiche — wird schlechter, wenn man es am Mittwoch
beantwortet und Woche dazu sagt. Die Tagesraster speichern deshalb ihre Rohwerte
(`dose.tage`, `dose.notizen`, `conf.tage`, `whoTage`) **und** die daraus abgeleiteten
Wochenwerte in der gewohnten Form — so rechnen Auswertung, CSV und Datenblock
unverändert weiter, ohne dass die Tagesauflösung verloren geht.

## Die Ablage

`storage/index.js` ist die einzige Ablage, die der Rest der Anwendung kennt. Dahinter:

- **`local.js`** — immer aktiv, hält eine vollständige Kopie im `localStorage`.
- **`github.js`** — Contents-API, eine JSON-Datei je Woche unter `<pfad>/weeks/`.
  Eine Datei je Woche statt einer großen, damit jede Woche als eigener Commit lesbar
  bleibt, zwei Geräte sich seltener in die Quere kommen und ein fehlgeschlagener
  Schreibvorgang höchstens eine Woche beschädigt.
- **`claude-db.js`** — die Artifact-Datenbank; als einzige mit Live-Aktualisierung.

Geschrieben wird **immer zuerst lokal** und danach entfernt. Der lokale Schritt kann
nicht fehlschlagen, der entfernte schon — und wenn, sagt die Meldung es, statt die
Eingabe zu verlieren. Gelesen wird umgekehrt: die entfernte Ablage schlägt die lokale
Kopie und ersetzt sie.

Die Auswahl trifft `waehleRemote()` nach der Einstellung unter Setup. Auf `auto` gewinnt
im Claude-Viewer die Datenbank, sonst GitHub, sofern eingerichtet.

## Die Analysequelle

`ai/index.js` wählt zwischen `claude-sample.js` (Fähigkeit des Viewers) und
`anthropic.js` (API direkt aus dem Browser, gestreamt). Beide bieten dasselbe:

```js
await quelle.init()                              // → true, wenn benutzbar
await quelle.ask(prompt, { signal, onText })     // → { text, truncated }
```

`briefing.js` hält die Auswertungsregeln, `context.js` baut den Datenblock. Der Block ist
absichtlich einsehbar, damit nachvollziehbar bleibt, worauf eine Antwort sich stützt.

## Zwei Betriebsarten

`scripts/build-single.mjs` bündelt mit esbuild alles in `dist/peptid-wochenbogen.html` —
eine Datei ohne fremde Hosts, wie ein Claude-Artifact sie erwartet. Der Rauchtest fährt
beide Fassungen durch dieselben Prüfungen, damit sie nicht auseinanderlaufen.

Geändert wird immer `src/`. `dist/` ist Wegwerfware und steht in `.gitignore`.

## Farben

`tokens.css` enthält jede Farbe genau einmal, in drei Blöcken: `:root` für hell,
`@media (prefers-color-scheme: dark)` mit `:root:not([data-theme="light"])` für die
Systemeinstellung, und `:root[data-theme="dark"]` für die ausdrückliche Wahl. `app.css`
enthält keinen einzigen Farbwert — nur `var(--…)`. Diese Trennung ist die Regel, an der
man merkt, ob eine Änderung sauber ist.

## Was bewusst fehlt

Kein Framework, kein Build für den Normalbetrieb, keine Abhängigkeit zur Laufzeit. Der
Bogen soll in fünf Jahren noch starten, wenn niemand mehr `npm install` ausführt. esbuild
und Playwright braucht nur, wer baut oder testet.
