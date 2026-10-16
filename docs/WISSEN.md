# Die Wissensdatenbank

Zu jedem Stoff im Bogen ein Eintrag: was darüber bekannt ist, getrennt nach
Herkunft, mit Quellen. Daneben eine Liste der Meldungen, die der Newsticker im
Bogen zeigt.

## Wo es liegt

Im Datenrepository, neben den Wochen:

```
daten/wissen/<stoffschlüssel>.json    ein Eintrag je Stoff
daten/news.json                       die Meldungen als eine Liste
```

Der Stoffschlüssel ist derselbe wie im Bogen: `glow`, `kiss`, `pt`, `tirz`,
`dhea`, `kreatin`, `protein` — und für selbst angelegte Stoffe das, was
`neuerKey()` in `src/js/substanzen.js` daraus macht (`e` plus Name, klein, ohne
Sonderzeichen).

Gelesen wird über dieselbe Fassade wie alles andere (`storage/index.js`), lokal
gespiegelt im `localStorage`. Die entfernte Fassung gewinnt beim Laden.

## Form eines Eintrags

```json
{
  "v": 1,
  "k": "glow",
  "n": "GLOW",
  "kat": "wirk",
  "stand": "2026-10-16T22:14:00.000Z",
  "modell": "recherche-claude-code",
  "abschnitte": {
    "ueberblick": "…",
    "erhofft": "…",
    "wirkweise": "…",
    "evidenz": "…",
    "protokolle": "…",
    "sicherheit": "…",
    "offen": "…"
  },
  "quellen": [
    { "titel": "…", "url": "https://…", "jahr": "2026", "art": "studie" }
  ],
  "news": [
    { "datum": "2026-10-14", "titel": "…", "kurz": "…", "url": "https://…", "quelle": "PubMed" }
  ]
}
```

`stand` ist eine ISO-Zeit und entscheidet über die Fälligkeit: nach sieben Tagen
gilt ein Eintrag als veraltet (`FRIST_TAGE` in `src/js/wissen/modell.js`).
`art` ist frei, üblich sind `studie`, `register`, `behoerde`, `review`,
`community`.

Die Abschnitte sind Fließtext, keine Struktur. Das ist Absicht: die Quellenlage
gibt keine Zahlenform her, und ein Schema würde eine Genauigkeit vortäuschen,
die nicht da ist. Maschinell ausgewertet werden `quellen`, `news` und `stand`.

## Form der Newsliste

`daten/news.json` ist ein Array, neueste zuerst, höchstens 60 Einträge:

```json
[
  { "datum": "2026-10-14", "titel": "…", "kurz": "…", "url": "https://…",
    "quelle": "ClinicalTrials.gov", "stoff": "glow", "stoffName": "GLOW",
    "gefunden": "2026-10-16T22:14:00.000Z" }
]
```

Zusammengeführt wird über die **Adresse**, nicht über den Titel: zwei
Recherchen formulieren dieselbe Studie verschieden. Vergleichen auf Hostname
plus Pfad, ohne `www.` und ohne abschließenden Schrägstrich — siehe
`kennung()` in `src/js/wissen/news.js`.

## Auffrischen mit API-Schlüssel

Der übliche Weg: Reiter **Wissen** → *Auffrischen*. Die App recherchiert mit
dem Websuch-Werkzeug der Anthropic-API, schreibt je Stoff eine Datei und führt
die News zusammen. Kostet Guthaben auf dem API-Konto.

## Auffrischen ohne API-Guthaben

API-Guthaben und claude.ai-Abo sind getrennte Konten. Ist das Guthaben leer,
lässt sich dieselbe Arbeit in **Claude Code** erledigen — dort zahlt das Abo:

1. Recherchieren (Websuche), je Stoff die Abschnitte oben schreiben.
2. `daten/wissen/<k>.json` im Datenrepository anlegen oder ersetzen.
3. `daten/news.json` ergänzen: neue Meldungen vorn, über die Adresse
   abgleichen, auf 60 kürzen.
4. Im Bogen die Seite neu laden — Reiter und Ticker lesen den neuen Stand.

Dabei gelten dieselben Regeln wie für den Prompt in
`src/js/wissen/recherche.js`, und sie sind der eigentliche Inhalt dieser Datei:

- **Nach Herkunft trennen.** Was sich Anwender erhoffen, was Studien zeigen und
  was üblicherweise angewendet wird, sind drei Fragen. Wer sie zusammenwirft,
  schreibt Forenwissen im Tonfall eines Fachtextes.
- **Jede Quelle mit erreichbarer URL.** Keine erfundenen Adressen; lieber eine
  Quelle weniger. Ohne Adresse fällt der Eintrag beim Einlesen ohnehin raus.
- **Dünne Lage benennen.** "Dazu gibt es keine Studien am Menschen" ist eine
  vollwertige Antwort und bei Graumarkt-Peptiden die häufigste richtige.
- **Beschreiben, nicht raten.** "In Studie X wurden … verwendet", nicht
  "nimm …". Der Abschnitt zu Protokollen ist eine Beobachtung über die
  Literatur und die Anwenderpraxis, keine Anweisung an den Leser.
- **Gehobenes Laienniveau.** Fachbegriffe dürfen vorkommen, aber beim ersten
  Auftreten erklärt.
