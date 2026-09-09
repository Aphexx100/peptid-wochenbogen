# Einrichtung

Zwei Repositories, weil sie unterschiedliche Sichtbarkeit brauchen:

| Repository | Sichtbarkeit | Inhalt |
|---|---|---|
| `peptid-wochenbogen` | **öffentlich** | die Seite selbst — Code, keine Daten |
| `peptid-daten` | **privat** | die Wochen als JSON, sonst nichts |

Der Grund für den Schnitt: GitHub Pages aus einem privaten Repository setzt GitHub Pro
voraus, im kostenlosen Tarif werden nur öffentliche Repositories veröffentlicht. Die
Gesundheitsdaten dürfen aber unter keinen Umständen öffentlich liegen. Also liegt der
Code öffentlich und die Daten privat — die Seite holt sie sich zur Laufzeit mit einem
Zugriffsschlüssel, der nur im Browser steht.

---

## 1. Code-Repository anlegen und veröffentlichen

```bash
cd peptid-wochenbogen
git init
git add .
git commit -m "Peptid-Wochenbogen"
git branch -M main
git remote add origin git@github.com:DEIN-NAME/peptid-wochenbogen.git
git push -u origin main
```

Dann auf GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.

Nach ein bis zwei Minuten liegt die Seite unter
`https://DEIN-NAME.github.io/peptid-wochenbogen/`.

Die Seite trägt `<meta name="robots" content="noindex, nofollow">` — Suchmaschinen sollen
sie nicht listen. Das ist eine Bitte, keine Sperre: wer die Adresse kennt, kann sie
öffnen. Da dort nur Code steht und keine Daten, ist das in Ordnung.

## 2. Daten-Repository anlegen

Auf GitHub ein neues Repository `peptid-daten` anlegen, **Private**, mit einer beliebigen
Datei initialisieren (etwa einer README), damit es einen `main`-Branch gibt. Sonst nichts —
die Ordner legt der Bogen selbst an.

Danach entsteht dort:

```
daten/config.json              Protokollstart, Erwartungsfenster, Übungsnamen
daten/weeks/2026-09-05.json    eine Datei je Woche
daten/weeks/2026-09-12.json
```

## 3. Zugriffsschlüssel erzeugen

**Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**

- **Repository access:** *Only select repositories* → `peptid-daten`
- **Permissions → Repository permissions → Contents:** *Read and write*
- **Expiration:** ein Jahr ist ein brauchbarer Kompromiss. Läuft er ab, meldet der Bogen
  beim Speichern einen Fehler — dann neuen erzeugen und im Setup ersetzen.

Nur `Contents` vergeben, nichts weiter. Der Schlüssel wird genau einmal angezeigt.

## 4. Im Bogen eintragen

Seite öffnen → Reiter **Setup** → Karte **Datenablage**:

| Feld | Wert |
|---|---|
| Ablage | `GitHub-Repository` (oder `automatisch wählen`) |
| GitHub-Benutzer | dein Benutzername |
| Daten-Repository | `peptid-daten` |
| Branch | `main` |
| Unterordner | `daten` |
| Zugriffsschlüssel | der Token aus Schritt 3 |

**Verbindung prüfen** liest das Repository und meldet zurück, ob Schlüssel und
Schreibrecht stimmen — und warnt ausdrücklich, falls das Repository nicht privat ist.
Dann **Ablage speichern** und die Seite neu laden.

Sind vorher schon Wochen im Browser erfasst worden, schiebt **Alle lokalen Wochen
hochladen** sie einmalig in das Repository.

## 5. Analyse auf GitHub Pages

Als Webseite gibt es keine eingebaute Analysefunktion — die kommt sonst vom
Claude-Viewer. Mit einem eigenen Schlüssel spricht die Seite direkt mit der API:

1. Schlüssel unter <https://console.anthropic.com> erzeugen (kostet nach Verbrauch).
2. Setup → **Analyse ohne Claude-Viewer** → Schlüssel eintragen, speichern, Seite neu laden.

Der Schlüssel bleibt im Browser und geht ausschließlich an `api.anthropic.com`.

Ein Hinweis zur Ehrlichkeit: ein API-Schlüssel im Browser ist für eine öffentliche
Anwendung falsch, weil jeder Besucher ihn auslesen könnte. Hier liegt er im `localStorage`
deines eigenen Browsers, nicht im Repository — ein anderer Besucher der Seite bekommt ihn
nicht zu sehen. Wer auf einem fremden Rechner arbeitet, trägt ihn besser nicht ein.

## Zweites Gerät

Seite öffnen, Setup, GitHub-Felder und Schlüssel eintragen, neu laden. Die Wochen kommen
dann aus dem Repository. Zugangsdaten wandern absichtlich nicht mit — sie stehen nur im
jeweiligen Browser.

## Als Claude-Artifact

Dort ist nichts einzurichten: Ablage und Analyse kommen vom Viewer. Nötig ist nur die
gebaute Einzeldatei:

```bash
npm run build      # dist/peptid-wochenbogen.html
```

## Wenn etwas klemmt

**„Repository nicht gefunden"** — Benutzername oder Repository-Name falsch, oder der
Schlüssel hat `peptid-daten` nicht in seiner Repository-Auswahl.

**„kein Schreibrecht"** — dem Schlüssel fehlt `Contents: Read and write`.

**„Lokal gespeichert, GitHub-Repository nicht erreicht"** — die Woche ist im Browser
sicher. Ursache beheben (meist ein abgelaufener Schlüssel), dann speichert der nächste
Klick auf *Woche speichern* sie hoch.

**Zwei Geräte am selben Tag** — wer zuletzt speichert, gewinnt für diese eine Woche. Die
Vorversion bleibt in der Git-Historie des Datenrepositories lesbar.

**Nichts geht mehr** — der CSV-Export unter *Auswertung* funktioniert immer, er rechnet
rein lokal.
