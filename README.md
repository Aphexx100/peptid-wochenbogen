# Peptid-Wochenbogen

Wöchentliche Selbstdokumentation eines Peptid-Protokolls. Eine Seite ohne Framework
und ohne Backend: erfassen, auswerten, exportieren, und auf Wunsch von einem
Sprachmodell einordnen lassen.

Der Bogen läuft in zwei Takten. **Täglich** erfasst er die Exposition (GLOW-Stack,
Kisspeptin, PT-141, Tirzepatid aus dem Pen), die Zufuhr (Kreatin, Protein, Alkohol), je Tag
eine Notiz zu den Einstichstellen, Schlaf und Training vom Vortag sowie den WHO-5. Wer im Rekonstitutionsrechner sein aktuelles Vial hinterlegt,
trägt die Dosis als **aufgezogene Einheiten (I.E.)** ein und der Bogen rechnet die
Wirkstoffmenge selbst aus.
Oben im Bogen zeigt eine Grafik die Tagesmengen je Wirkstoff in mg — als Woche mit
Blättern in frühere Wochen, als eigener Zeitraum oder als gesamter Verlauf.
Zum Korrigieren lässt sich der ganze Bogen auf eine frühere Woche umstellen; beim
WHO-5 wählt eine Tagesleiste den Tag.

**Wann Zeit ist** kommt der ausführliche Fragebogen dazu: sechs Kernbereiche, die drei erwarteten
GLOW-Wirkungen, Sexualfunktion (IIEF-5) und Morgenerektionen, Körpermaße und Kraftwerte,
Pigmentierung, Negativkontrollen und die Beobachtungsliste. Bis dahin bleiben diese Fragen
verborgen. Der Knopf **Ausführlichen Fragebogen für heute erstellen** öffnet sie; der Bogen
merkt sich das Datum. Ein sporadisch, aber ehrlich ausgefüllter Fragebogen ist mehr wert
als ein Pflichttermin, der ausfällt. Die allgemeinen Erklärungen stehen im Reiter **Info**.
Aus allem entstehen Verlaufsgrafiken, eine Wochentabelle und ein CSV-Export.

## Aufbau in einem Absatz

`index.html` liefert nur die Struktur. Alles Inhaltliche steht in
`src/js/schema.js` — jede Frage des Bogens ist dort eine Zeile, und Formular, CSV-Spalten
und der Datenblock für die Analyse entstehen aus derselben Liste. Wer eine Frage ergänzen
will, ergänzt sie an einer Stelle. Details in [docs/ERWEITERN.md](docs/ERWEITERN.md),
die Architektur in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

## Loslegen

```
npm install          # esbuild und playwright, nur zum Bauen und Testen
npm start            # http://localhost:8080
npm test             # 231 Prüfungen in einem echten Browser
npm run build        # dist/peptid-wochenbogen.html — eine Datei für Claude
```

Die Seite selbst braucht keinen Build. `npm start` ist nur nötig, weil ES-Module nicht
über `file://` laden.

## Wo die Daten liegen

Immer zuerst im `localStorage` des Browsers — sofort, offline, ohne Konto. Zusätzlich
kann eine zweite Ablage aktiv sein:

**GitHub** schreibt jede Woche als eigene JSON-Datei in ein **privates** Repository.
Damit liegen die Daten versioniert, geräteübergreifend und in deiner Hand.
Einrichtung: [docs/SETUP.md](docs/SETUP.md).

**Claude-Datenbank**, wenn die Seite als Claude-Artifact läuft. Dann kommt die Ablage
vom Viewer, und es ist nichts einzurichten.

Fällt die zweite Ablage aus, wird trotzdem lokal gespeichert und die Meldung sagt es.
Es geht nichts verloren, nur weil das Netz weg ist.

> **Das Datenrepository muss privat sein.** Diese Seite darf öffentlich liegen — sie
> enthält Code, keine Daten. Die Wochen enthalten Gesundheitsdaten und gehören nicht in
> ein öffentliches Repository.

## Analyse

Der Bogen kann seine Daten mitsamt dem Protokollkontext an ein Sprachmodell geben. Die
Auswertungsregeln stehen in `src/js/ai/briefing.js` und sind der eigentliche Wert der
Funktion: Tirzepatid wird als dominanter Confounder benannt, der IIEF-5 ist der
Primärendpunkt, Erwartung wird gegen Ergebnis geprüft, Negativkontrollen gegen den
Endpunkt, und unter zehn Wochen gilt ein Trend als Rauschen.

Als Claude-Artifact läuft das über die Sampling-Fähigkeit des Viewers. Auf GitHub Pages
über die Anthropic-API mit eigenem Schlüssel — einzutragen unter Setup, gespeichert nur
im Browser.

Der Knopf **Datenblock anzeigen** zeigt genau das, was das Modell zu sehen bekommt. Er
funktioniert auch ohne jede Analysequelle, weil der Block lokal entsteht.

## Prognose

Der Reiter **Prognose** arbeitet in zwei Schritten. Zuerst schätzt das Modell den heutigen
Zustand — teils aus den erfassten Daten, teils aus der Forschungslage zu den Substanzen;
mit eigenem Anthropic-Schlüssel recherchiert es dafür im Netz. Das Ergebnis sind einzelne,
überprüfbare Aussagen, die du von "stimme voll zu" bis "stimme gar nicht zu" bewertest.
Erst daraus entsteht die Prognose.

Jede Prognose wird in der Ablage gespeichert (`daten/prognosen/`) und fließt in die
nächste ein. Jede Substanz zählt ab dem Tag ihres ersten Eintrags im Raster, nicht ab
Protokollstart.

## Zwei Betriebsarten, eine Quelle

Als Webseite lädt der Bogen seine Module einzeln. Ein Claude-Artifact erwartet dagegen
genau eine Datei ohne fremde Hosts. `npm run build` bündelt beides zu
`dist/peptid-wochenbogen.html`; der Rauchtest prüft die gebaute Datei mit, damit die
beiden Fassungen nicht auseinanderlaufen.

## Was das hier nicht ist

Keine medizinische Anwendung und kein Ersatz für Blutbild, Hautkrebsvorsorge oder das
Gespräch mit dem behandelnden Arzt. Der Bogen dokumentiert, er beurteilt nicht. Auch die
Analysefunktion gibt keine Dosierungsempfehlungen — das steht so in ihren Regeln.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
