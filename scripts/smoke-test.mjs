/* Rauchtest: startet einen lokalen Server, laedt die Seite in einem echten
   Browser und prueft, dass sie ohne Fehler aufbaut, sich ausfuellen laesst,
   speichert und wieder laedt.

   Der Test laeuft bewusst gegen einen richtigen Browser, weil die Anwendung
   ES-Module, localStorage und SVG benutzt — alles Dinge, die eine
   nachgebaute DOM-Umgebung nur ungefaehr abbildet.

   Geprueft wird beides: die modulare Fassung (index.html) und, falls
   vorhanden, die gebaute Einzeldatei (dist/). So faellt auf, wenn der Build
   auseinanderlaeuft, statt es erst im Artifact zu merken.

   Aufruf:  node scripts/smoke-test.mjs
   Beendet sich mit Code 1, wenn eine Pruefung fehlschlaegt. */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
  const datei = p.endsWith('/') ? path.join(p, 'index.html') : p;
  fs.readFile(datei, (err, buf) => {
    if (err) { res.writeHead(404); res.end('nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    res.end(buf);
  });
});

/* Schriften kommen von einem fremden Host; ob der erreichbar ist, sagt nichts
   ueber die Anwendung aus. Solche Meldungen zaehlen nicht als Fehler. */
const fremd = (t) => /fonts\.(googleapis|gstatic)|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|Failed to load resource/.test(t);

const pruefungen = [];

async function laufe(browser, url, label, mitModulTest) {
  console.log(`\n${label}`);
  const kontext = await browser.newContext();
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => { if (!fremd(String(e))) fehler.push(String(e)); });
  seite.on('console', (m) => { if (m.type() === 'error' && !fremd(m.text())) fehler.push(m.text()); });

  const pruefe = (name, ok, detail) => {
    pruefungen.push({ label, name, ok });
    console.log(`${ok ? '  ok  ' : ' FEHL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  };

  await seite.goto(url, { waitUntil: 'networkidle' });
  await seite.waitForTimeout(400);
  pruefe('Seite lädt ohne JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));

  /* Aufbau: Regler und Segmente kommen aus schema.js, nicht aus dem HTML. */
  const regler = await seite.locator('[data-s]').count();
  pruefe('Schieberegler aufgebaut', regler >= 20, `${regler} gefunden`);
  const segmente = await seite.locator('[data-seg]').count();
  pruefe('Segmentfragen aufgebaut', segmente >= 60, `${segmente} gefunden`);
  pruefe('Kraftfelder aufgebaut', (await seite.locator('#kw0').count()) === 1);
  const expoZellen = await seite.locator('#s-expo input[type="number"]').count();
  pruefe('Tagesraster: 7 Tage × 7 Substanzen + Alkohol', expoZellen === 56, `${expoZellen} Zellen`);
  pruefe('Kreatin und Protein stehen bei den Substanzen',
    (await seite.locator('#xkreatin0').count()) === 1 && (await seite.locator('#xprotein0').count()) === 1
    && (await seite.locator('#zkreatin0, #zprotein0').count()) === 0);
  pruefe('Wochengrafik leer mit Hinweis', (await seite.locator('#wochenGraph svg').count()) === 0
    && /Noch keine Injektion/.test(await seite.locator('#wochenGraphLeer').innerText()));
  const notizZellen = await seite.locator('#s-expo input[type="text"]').count();
  pruefe('Tagesraster: nur noch die Notizspalte Einstichstellen', notizZellen === 7
    && (await seite.locator('#nsonstMed0, #nabw0').count()) === 0, `${notizZellen} Zellen`);
  pruefe('Alte Wochenfelder für Notizen entfernt', (await seite.locator('#nSonstMed, #abw, #stellen').count()) === 0);
  const confZellen = await seite.locator('#s-confTage input').count();
  pruefe('Confounder-Tagesraster: nur noch Training und Schlaf', confZellen === 14, `${confZellen} Zellen`);
  pruefe('Fertig dosierte Stoffe nicht bei den Vials',
    (await seite.locator('#vMgtirz').count()) === 0 && (await seite.locator('#vMgdhea').count()) === 0
    && (await seite.locator('[data-vialziel="tirz"]').count()) === 0);

  /* Der ausführliche Fragebogen hängt an keinem Tag mehr: ohne Klick bleibt
     er verborgen, der Knopf öffnet und schließt ihn. */
  const heuteWt = new Date().getDay();
  const andererWt = (heuteWt + 3) % 7;
  const setzeTag = async (wt) => {
    await seite.click('#tab-setup');
    await seite.selectOption('#cfgDay', String(wt));
    await seite.click('#cfgSave');
    await seite.waitForTimeout(300);
    await seite.click('#tab-bogen');
  };

  await setzeTag(andererWt);
  pruefe('Fragebogen ohne Klick verborgen', await seite.locator('#s-kern').isHidden());
  const offeneKarten = await seite.locator('.card:visible h2').allInnerTexts();
  pruefe('Nur die Tageskarten offen (samt Wochengrafik)', offeneKarten.length === 6, offeneKarten.join(' | '));
  pruefe('Tagesfelder bleiben sichtbar', await seite.locator('#s-expo').isVisible());
  pruefe('WHO-5 täglich offen, IIEF-5 ist Wochenfrage',
    (await seite.locator('#s-who').isVisible()) && (await seite.locator('#s-iief').isHidden()));
  const bar = await seite.locator('#gateBar').innerText();
  pruefe('Knopf erstellt den Fragebogen',
    /Ausführlichen Fragebogen erstellen/.test(bar) && /ohne Fragebogen/.test(bar)
    && /Fragebogen offen/.test(await seite.locator('#statusrow').innerText()), bar);
  await seite.click('#gateOpen');
  pruefe('Knopf öffnet den Fragebogen', await seite.locator('#s-kern').isVisible());
  /* Der Fragebogen gilt für genau einen Tag — vorgewählt heute, nachtragbar
     über die Tagesleiste; künftige Tage bleiben gesperrt. */
  pruefe('Tagesleiste zeigt heute vorgewählt', await seite.locator('#gateTag').isVisible()
    && (await seite.locator('#gateTagwahl button[aria-pressed="true"]').innerText()) === 'Heute');
  pruefe('Hinweis nennt den Tag des Fragebogens',
    /Fragebogen für \d\d\.\d\d\.\d{4}/.test(await seite.locator('#gateBar').innerText()),
    await seite.locator('#gateBar').innerText());
  pruefe('Knopf bietet danach das Ausblenden an',
    /Fragebogen ausblenden/.test(await seite.locator('#gateBar').innerText()));
  await seite.click('#gateOpen');
  pruefe('„Fragebogen ausblenden" schließt ihn wieder', await seite.locator('#s-kern').isHidden());
  pruefe('Ohne Fragebogen keine Tagesleiste', await seite.locator('#gateTag').isHidden());

  await setzeTag(heuteWt);
  await seite.click('#gateOpen');
  pruefe('Fragebogen auch am Erfassungstag erst auf Klick', await seite.locator('#s-kern').isVisible());

  /* Info-Reiter: die allgemeinen Erklärungen stehen dort, nicht im Bogen. */
  await seite.click('#tab-info');
  const infoText = await seite.locator('#p-info').innerText();
  pruefe('Info-Reiter trägt die Beschreibungen',
    /Was dieser Bogen leisten kann/.test(infoText) && /Wie du den Bogen ausfüllst/.test(infoText));
  await seite.click('#tab-bogen');
  pruefe('Beschreibungskarte ist aus dem Bogen raus',
    !/Was dieser Bogen leisten kann/.test(await seite.locator('#p-bogen').innerText()));

  /* Rechner: GLOW 70 mg in 3 ml, Dosis 2,8 mg -> 12,0 I.E. */
  await seite.click('#tab-setup');
  await seite.click('[data-preset="glow"]');
  const rc = await seite.locator('#rcOut').innerText();
  pruefe('Rechner: GLOW ergibt 12,0 I.E.', rc.includes('12,0 I.E.'), rc.split('\n')[0]);
  pruefe('Rechner: Kupfer je Dosis ausgewiesen', /µg elementares Kupfer/.test(rc));

  /* Kisspeptin 10 mg in 2,5 ml, 500 µg -> 12,5 I.E., Vial verfällt vorher */
  await seite.click('[data-preset="kiss"]');
  const rc2 = await seite.locator('#rcOut').innerText();
  pruefe('Rechner: Kisspeptin ergibt 12,5 I.E.', rc2.includes('12,5 I.E.'), rc2.split('\n')[0]);
  pruefe('Rechner warnt vor Verfall des Vials', /verfällt/.test(rc2));

  /* Randfall: 30 I.E. auf einer 30-I.E.-Spritze ist randvoll, nicht "gut". */
  await seite.fill('#rcVial', '10');
  await seite.fill('#rcWasser', '1');
  await seite.fill('#rcDosis', '3');
  await seite.selectOption('#rcEinheit', '1');
  const rc3 = await seite.locator('#rcOut').innerText();
  pruefe('Rechner warnt bei randvoller Spritze', /Randvoll/.test(rc3), rc3.split('\n').pop());

  /* Live-Summen */
  await seite.click('#tab-bogen');
  for (let i = 0; i < 5; i++) await seite.click(`[data-seg="who${i}"][data-val="4"]`);
  pruefe('WHO-5 rechnet live', (await seite.locator('#whoScore').innerText()) === '80');
  for (let i = 0; i < 5; i++) await seite.click(`[data-seg="iief${i}"][data-val="4"]`);
  pruefe('IIEF-5 rechnet live', (await seite.locator('#iiefScore').innerText()) === '20');
  pruefe('WHO-5 zählt den Tag als Messtag',
    /Erfasst an 1 von 7 Tagen/.test(await seite.locator('#whoTage').innerText()));
  pruefe('WHO-5 weist den Wochenschnitt aus',
    /80 von 100/.test(await seite.locator('#whoWeek').innerText()));

  /* WHO-5-Tageswahl: gestern nachtragen, zurück zu heute, gestern wieder löschen. */
  pruefe('WHO-5-Tagesleiste mit heute vorgewählt',
    (await seite.locator('#whoTag6').getAttribute('aria-pressed')) === 'true'
    && (await seite.locator('#whoTag6').innerText()) === 'Heute');
  await seite.click('#whoTag5');
  pruefe('Anderer Tag zeigt leere Fragen', (await seite.locator('#whoScore').innerText()) === '—');
  for (let i = 0; i < 5; i++) await seite.click(`[data-seg="who${i}"][data-val="2"]`);
  pruefe('Gestern eingetragen', (await seite.locator('#whoScore').innerText()) === '40'
    && /Erfasst an 2 von 7 Tagen/.test(await seite.locator('#whoTage').innerText())
    && /60 von 100/.test(await seite.locator('#whoWeek').innerText()));
  await seite.click('#whoTag6');
  pruefe('Zurück bei heute stehen die heutigen Antworten', (await seite.locator('#whoScore').innerText()) === '80');
  await seite.click('#whoTag5');
  await seite.click('#whoLoeschen');
  pruefe('Tag lässt sich wieder löschen', /Erfasst an 1 von 7 Tagen/.test(await seite.locator('#whoTage').innerText()));
  await seite.click('#whoTag6');

  /* Tägliche Confounder (Vortag): Training summiert, Schlaf gemittelt. */
  for (let i = 0; i < 7; i++) await seite.fill(`#tschlaf${i}`, '7');
  await seite.fill('#ttrain0', '1.5');
  await seite.fill('#ttrain3', '1.5');
  const cs = await seite.locator('#confSum').innerText();
  pruefe('Confounder-Raster summiert Training', /Training 3 h/.test(cs), cs.slice(0, 110));
  pruefe('Confounder-Raster mittelt den Schlaf', /Schlaf Ø 7 h/.test(cs), cs.slice(0, 110));

  /* Tägliche Zufuhr in der Exposition: Kreatin summiert, Protein gemittelt,
     Alkohol summiert in Litern. */
  await seite.fill('#xkreatin0', '5');
  await seite.fill('#xkreatin1', '5');
  await seite.fill('#xprotein0', '180');
  await seite.fill('#xprotein1', '160');
  await seite.fill('#zalk5', '2');
  const zs = await seite.locator('#expoSum').innerText();
  pruefe('Kreatin als Wochensumme mit Tagen', /Kreatin 10 g an 2 Tagen/.test(zs), zs);
  pruefe('Protein als Tagesmittel', /Protein Ø 170 g\/Tag/.test(zs), zs);
  pruefe('Alkohol zählt in Litern', /Alkohol 2 l/.test(zs), zs);
  pruefe('Supplemente stehen nicht doppelt in der Zusammenfassung',
    !/Kreatin: 2 Tage/.test(zs) && !/Protein: 2 Tage/.test(zs), zs);
  pruefe('Supplemente bleiben aus der Grafik',
    (await seite.locator('#wochenGraph path[data-serie="kreatin"]').count()) === 0
    && (await seite.locator('#wochenGraph path[data-serie="protein"]').count()) === 0);

  /* Tagesraster: sieben GLOW-Tage eintragen, Zusammenfassung und
     Kupferhinweis rechnen mit; ein PT-141-Tag blendet die PT-Karte ein. */
  for (let i = 0; i < 7; i++) await seite.fill(`#xglow${i}`, '2.8');
  const sum = await seite.locator('#expoSum').innerText();
  pruefe('Tagesraster leitet die Wochensumme ab', /GLOW: 7 Injektionstage à 2,8 mg/.test(sum), sum.slice(0, 90));
  const cu = await seite.locator('#cuNote').innerText();
  pruefe('Kupferlast wird beziffert', /2,21 mg elementares Kupfer/.test(cu), cu.slice(0, 90));
  /* Wochengrafik: GLOW-Linie über die vergangenen Tage, Punkte an Injektionstagen. */
  const wgLinien = await seite.locator('#wochenGraph path.wg-linie').count();
  const wgGlow = await seite.locator('#wochenGraph path[data-serie="glow"]').count();
  const wgPunkte = await seite.locator('#wochenGraph circle.wg-punkt').count();
  pruefe('Wochengrafik zeichnet die GLOW-Linie mit sieben Punkten', wgGlow === 1 && wgPunkte === 7, `${wgLinien} Linien, ${wgPunkte} Punkte`);
  pruefe('Wochengrafik zeigt nur Wirkstoffe', (await seite.locator('#wochenGraphLegende > span').count()) === 5
    && /GLOW 2,8/.test(await seite.locator('#wochenGraph').innerText()));
  pruefe('Wochengrafik zeichnet Bezier-Kurven',
    /C/.test(await seite.locator('#wochenGraph path[data-serie="glow"]').getAttribute('d')));
  await seite.hover('#wochenGraph rect.wg-hit', { position: { x: 4, y: 40 } });
  pruefe('Wochengrafik zeigt Tooltip mit allen Wirkstoffen', (await seite.locator('.wg-tip .wg-tip-zeile').count()) === 5
    && /2,8 mg/.test(await seite.locator('.wg-tip').innerText()));
  pruefe('PT-Karte ohne PT-141-Tag verborgen', await seite.locator('#ptCard').isHidden());
  await seite.fill('#xpt2', '1.75');
  pruefe('PT-Karte erscheint bei PT-141-Tag', await seite.locator('#ptCard').isVisible());

  /* Tagesnotizen: je Tag ein eigener Text, der mit Tagesangabe in die
     Wochenfelder und von dort in CSV und Datenblock wandert. */
  await seite.fill('#nstellen2', 'leichte Rötung links');
  await seite.fill('#nstellen4', 'kleiner Knoten');
  const breite = await seite.evaluate(() => {
    const w = document.querySelector('.card.wide').getBoundingClientRect().width;
    const n = document.querySelector('#p-bogen > .card:not(.wide)').getBoundingClientRect().width;
    return { w, n };
  });
  pruefe('Expositionskarte darf breiter werden als der Rest', breite.w > breite.n + 50,
    `${Math.round(breite.w)} px gegen ${Math.round(breite.n)} px`);


  /* Speichern und nach dem Neuladen wiederfinden */
  await seite.fill('#cGew', '90.5');
  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  const info = await seite.locator('#saveInfo').innerText();
  pruefe('Speichern meldet Erfolg', /gespeichert/i.test(info), info);

  await seite.reload({ waitUntil: 'networkidle' });
  await seite.waitForTimeout(500);
  pruefe('Tageseintrag überlebt das Neuladen', (await seite.inputValue('#xglow0')) === '2.8');
  pruefe('IIEF-5 überlebt das Neuladen', (await seite.locator('#iiefScore').innerText()) === '20');
  pruefe('Schlaf-Tageswert überlebt das Neuladen', (await seite.inputValue('#tschlaf0')) === '7');
  /* Nachtragen: der Fragebogen gilt für einen früheren Tag der Woche. */
  const gestern = await seite.evaluate(() => {
    const t = new Date();
    t.setDate(t.getDate() - 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  await seite.click('#gateTagwahl button[aria-pressed="false"]:not([disabled])');
  pruefe('Anderer Tag lässt sich wählen',
    /Fragebogen für /.test(await seite.locator('#gateBar').innerText())
    && (await seite.locator('#gateTagwahl button[aria-pressed="true"]').innerText()) !== 'Heute',
    await seite.locator('#gateBar').innerText());
  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  const nachgetragen = await seite.evaluate(() => {
    const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
    return weeks[Object.keys(weeks).sort().pop()].bogenTag;
  });
  pruefe('Nachgetragener Tag wird gespeichert',
    !!nachgetragen && nachgetragen < new Date().toISOString().slice(0, 10), String(nachgetragen));
  const zurueck = await seite.locator('#gateTagwahl button').last();
  if (!(await zurueck.isDisabled())) await zurueck.click();
  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  pruefe('Zurück auf den letzten Tag der Woche',
    (await seite.locator('#gateTagwahl button[aria-pressed="true"]').count()) === 1, gestern);

  /* Eine Woche mit Fragebogen zeigt ihn nach dem Neuladen ohne Klick, samt
     Datum in der Statuszeile. */
  pruefe('Fragebogen bleibt nach dem Neuladen offen', await seite.locator('#s-kern').isVisible());
  const chips = (await seite.locator('#statusrow .chip').allInnerTexts()).join(' | ');
  pruefe('Statuszeile nennt das Datum des Fragebogens', /Fragebogen \d\d\.\d\d\./.test(chips), chips);
  pruefe('Tagesnotiz überlebt das Neuladen', (await seite.inputValue('#nstellen2')) === 'leichte Rötung links');
  pruefe('Notiz bleibt an ihrem Tag', (await seite.inputValue('#nstellen4')) === 'kleiner Knoten'
    && (await seite.inputValue('#nstellen3')) === '');

  /* Die PT-Karte hat zwei Bedingungen — Anwendung UND offener Fragebogen.
     Das Tor darf ihre eigene nicht überstimmen und umgekehrt. Geprüft in
     einer fremden Woche (anderer Erfassungstag), damit die gespeicherte
     Woche unberührt bleibt; beim Zurückwechseln lädt sie wieder. */
  await setzeTag((heuteWt + 5) % 7);
  pruefe('Anderer Erfassungstag lädt die andere Woche, statt Werte zu verschieben',
    (await seite.inputValue('#xglow0')) === '' && (await seite.inputValue('#nstellen4')) === '');
  await seite.fill('#xpt2', '1.75');
  pruefe('PT-Karte bleibt ohne Fragebogen zu', await seite.locator('#ptCard').isHidden());
  await seite.click('#gateOpen');
  pruefe('PT-Karte kommt mit dem Fragebogen zurück', await seite.locator('#ptCard').isVisible());
  await setzeTag(heuteWt);
  pruefe('Zurück beim Erfassungstag ist die gespeicherte Woche wieder da',
    (await seite.inputValue('#xglow0')) === '2.8' && (await seite.inputValue('#nstellen4')) === 'kleiner Knoten');

  /* Vials: Rechner-Preset als aktuelles GLOW-Vial übernehmen — die Spalte
     läuft danach in ml, der bestehende mg-Eintrag wird umgerechnet und die
     Wirkstoffmenge je Zelle ausgewiesen. */
  pruefe('Vial-Karte kompakt: je Wirkstoff eine Zeile',
    (await seite.locator('#s-vials tbody tr').count()) === 3 && (await seite.locator('#s-vials input').count()) === 6);
  await seite.click('#tab-setup');
  await seite.click('[data-preset="glow"]');
  await seite.click('[data-vialziel="glow"]');
  await seite.waitForTimeout(400);
  pruefe('Rechner meldet die Vial-Übernahme',
    /GLOW-Vial übernommen/.test(await seite.locator('#rcUebInfo').innerText()));
  await seite.click('#tab-bogen');
  pruefe('Vial-Karte zeigt die Konzentration', /23,33 mg\/ml/.test(await seite.locator('#vKonzglow').innerText()));
  pruefe('GLOW-Spalte läuft jetzt in I.E.', /\(I\.E\.\)/.test(await seite.locator('#xhglow').innerText()));
  pruefe('mg-Eintrag wurde in I.E. umgerechnet', (await seite.inputValue('#xglow0')) === '12');
  pruefe('Wirkstoffmenge wird je Zelle ausgewiesen', /= 2,8 mg/.test(await seite.locator('#cglow0').innerText()));
  const sumMl = await seite.locator('#expoSum').innerText();
  pruefe('Wochensumme bleibt in mg', /GLOW: 7 Injektionstage à 2,8 mg/.test(sumMl), sumMl.slice(0, 90));

  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  await seite.reload({ waitUntil: 'networkidle' });
  await seite.waitForTimeout(500);
  pruefe('I.E.-Eintrag überlebt das Neuladen', (await seite.inputValue('#xglow0')) === '12');
  pruefe('Vial überlebt das Neuladen', (await seite.inputValue('#vMgglow')) === '70');

  /* Eigene Stoffe: im Bogen anlegen — mit Vial und ohne —, in der Grafik
     nur die Wirkstoffe, und wieder entfernen, ohne Werte zu verlieren. */
  pruefe('Jede Spalte hat ein Kreuz zum Entfernen',
    (await seite.locator('#s-expo .spaltweg').count()) === 7);
  await seite.click('#stoffNeu');
  pruefe('Formular für neue Stoffe öffnet', await seite.locator('#stoffForm').isVisible());
  await seite.fill('#snName', 'Retatrutid');
  await seite.selectOption('#snArt', 'vial');
  await seite.fill('#snVial-mg', '20');
  await seite.fill('#snVial-ml', '2');
  await seite.fill('#snDosis', '2');
  const snOut = await seite.locator('#snOut').innerText();
  pruefe('Rechner im Formular rechnet mit', /20,0 I\.E\./.test(snOut) && /10,00 mg\/ml/.test(snOut), snOut.slice(0, 80));
  await seite.click('#snAdd');
  await seite.waitForTimeout(400);
  pruefe('Neuer Stoff steht als Spalte im Raster', (await seite.locator('#xeretatrutid0').count()) === 1
    && /\(I\.E\.\)/.test(await seite.locator('#xheretatrutid').innerText()));
  pruefe('Neuer Stoff steht bei den aktuellen Vials', (await seite.inputValue('#vMgeretatrutid')) === '20'
    && /10,00 mg\/ml/.test(await seite.locator('#vKonzeretatrutid').innerText()));
  await seite.fill('#xeretatrutid3', '20');
  pruefe('Eingabe in I.E. wird in mg umgerechnet',
    /= 2 mg/.test(await seite.locator('#ceretatrutid3').innerText()));
  pruefe('Neuer Wirkstoff kommt in die Grafik',
    (await seite.locator('#wochenGraphLegende > span').count()) === 6
    && (await seite.locator('#wochenGraph path[data-serie="eretatrutid"]').count()) === 1);

  await seite.click('#stoffNeu');
  await seite.fill('#snName', 'Magnesium');
  await seite.selectOption('#snArt', 'g');
  await seite.selectOption('#snKat', 'supp');
  pruefe('Ohne Vial bleibt der Rechner aus', await seite.locator('#snVial').isHidden());
  await seite.click('#snAdd');
  await seite.waitForTimeout(400);
  await seite.fill('#xemagnesium2', '400');
  pruefe('Supplement wird erfasst', /Magnesium: 1 Tag à 400 g/.test(await seite.locator('#expoSum').innerText()),
    await seite.locator('#expoSum').innerText());
  pruefe('Supplement bleibt aus der Grafik',
    (await seite.locator('#wochenGraphLegende > span').count()) === 6
    && (await seite.locator('#wochenGraph path[data-serie="emagnesium"]').count()) === 0);

  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  await seite.reload({ waitUntil: 'networkidle' });
  await seite.waitForTimeout(500);
  pruefe('Eigene Stoffe überleben das Neuladen',
    (await seite.inputValue('#xeretatrutid3')) === '20' && (await seite.inputValue('#xemagnesium2')) === '400');
  await seite.click('#tab-setup');
  pruefe('Rechner bietet den neuen Stoff als Vial-Ziel',
    (await seite.locator('[data-vialziel="eretatrutid"]').count()) === 1);
  await seite.click('#tab-bogen');
  await seite.click('[data-stoffweg="emagnesium"]');
  pruefe('Das Kreuz fragt erst nach', /entfernen\?/.test(await seite.locator('#xwemagnesium').innerText()));
  await seite.click('[data-stoffweg="emagnesium"]');
  await seite.waitForTimeout(400);
  pruefe('Zweiter Klick entfernt die Spalte', (await seite.locator('#xemagnesium2').count()) === 0
    && /Magnesium entfernt/.test(await seite.locator('#stoffInfo').innerText()),
    await seite.locator('#stoffInfo').innerText());
  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  const nachWeg = await seite.evaluate(() => {
    const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
    const e = weeks[Object.keys(weeks).sort().pop()];
    return { tage: e.dose.tage.emagnesium, extra: e.dose.extra };
  });
  pruefe('Werte eines entfernten Stoffs bleiben gespeichert',
    nachWeg.tage[2] === '400' && nachWeg.extra.emagnesium.n === 'Magnesium',
    JSON.stringify(nachWeg));

  /* Auswertung */
  await seite.click('#tab-aus');
  await seite.waitForTimeout(300);
  pruefe('Auswertung zeigt den Primärendpunkt', (await seite.locator('#tLib').innerText()).includes('20'));
  pruefe('Wochentabelle gefüllt', (await seite.locator('#weekTable tbody tr').count()) >= 1);

  /* Analyse: ohne Claude und ohne Schluessel bleibt der Datenblock einsehbar */
  await seite.click('#tab-claude');
  await seite.click('#showCtx');
  const ctx = await seite.locator('#ctxDump').innerText();
  pruefe('Datenblock auch ohne KI einsehbar', ctx.length > 500, `${ctx.length} Zeichen`);
  pruefe('Datenblock nennt Tirzepatid als Confounder', ctx.includes('Tirzepatid'));
  pruefe('Datenblock nennt das Erwartungsfenster', ctx.includes('ERWARTUNGSFENSTER'));
  pruefe('Datenblock trägt das Tagesprotokoll', /TAGE: .*GLOW 2,8mg/.test(ctx));
  pruefe('Datenblock trägt die Zufuhr', /TAGE: .*Kreatin 5g \+ Protein 180g/.test(ctx)
    && /Kreatin 10 g\/Woche an 2 Tagen/.test(ctx) && /Protein 170g/.test(ctx) && /Alkohol 2l,/.test(ctx));
  pruefe('Datenblock trägt die eigenen Stoffe', /WEITERE STOFFE: .*Retatrutid 1 Tage à 2 mg/.test(ctx)
    && /Magnesium 1 Tage à 400 g \[Supplement\/Nahrungsmittel\]/.test(ctx),
    (ctx.match(/WEITERE STOFFE:[^|]*/) || [''])[0]);
  pruefe('Datenblock trägt die Confounder-Tage', /CONFOUNDER-TAGE .*Schlaf 7h/.test(ctx));
  pruefe('Datenblock nennt die Messtage beim WHO-5', /WHO-5 80 \(Ø aus 1 Tagen\), IIEF-5 20(?! \()/.test(ctx));
  pruefe('Datenblock trägt Tagesnotizen mit Tagesangabe',
    /Einstichstellen: \w\w \d\d\.\d\d\.: leichte Rötung links; \w\w \d\d\.\d\d\.: kleiner Knoten/.test(ctx));
  pruefe('Analyse-Knöpfe ohne Quelle deaktiviert', await seite.locator('#askWeek').isDisabled());

  /* Prognose-Reiter: ohne Analysequelle gesperrt, Aussagentabelle bewertbar. */
  await seite.click('#tab-prognose');
  pruefe('Prognose-Reiter vorhanden', /Ist-Zustand schätzen/.test(await seite.locator('#p-prognose').innerText()));
  pruefe('Ohne Analysequelle gesperrt', (await seite.locator('#progIst').isDisabled())
    && (await seite.locator('#progErstellen').isDisabled())
    && (await seite.locator('#progOff').isVisible()));
  pruefe('Noch keine Prognose gespeichert', await seite.locator('#progFrueherLeer').isVisible());
  if (mitModulTest) {
    const ist = await seite.evaluate(async () => {
      const m = await import('./src/js/ai/prognose.js');
      const roh = '```json\n{"stand":"Testlage","aussagen":[' +
        '{"id":"a1","bereich":"Haut","aussage":"Hautbild stabil","grundlage":"daten","beleg":"W1-W3","zuversicht":"mittel"},' +
        '{"id":"a2","bereich":"Gelenke","aussage":"Keine Besserung vor Woche 9","grundlage":"forschung","beleg":"Studienlage","zuversicht":"hoch"}]}\n```';
      const p = m.parseIst(roh);
      const u = await import('./src/js/ui/prognose.js');
      u.zeigeIst(p, {});
      return { anzahl: p.aussagen.length, stand: p.stand };
    });
    pruefe('Antwort aus Schritt 1 wird gelesen', ist.anzahl === 2 && ist.stand === 'Testlage', JSON.stringify(ist));
    pruefe('Aussagen stehen als Tabelle', (await seite.locator('#progTabelle tbody tr').count()) === 2
      && /Keine Besserung vor Woche 9/.test(await seite.locator('#progTabelle').innerText()));
    pruefe('Schritt 2 erscheint mit offenen Bewertungen',
      (await seite.locator('#progSchritt2').isVisible())
      && /0 von 2 bewertet/.test(await seite.locator('#progBewertet').innerText()));
    await seite.click('#progTabelle tbody tr:nth-child(1) .prog-seg button:nth-child(1)');
    await seite.click('#progTabelle tbody tr:nth-child(2) .prog-seg button:nth-child(5)');
    pruefe('Bewertung je Aussage wird übernommen',
      /Alle 2 Aussagen bewertet/.test(await seite.locator('#progBewertet').innerText())
      && (await seite.locator('#progTabelle tbody tr:nth-child(1) .prog-seg button:nth-child(1)')
        .getAttribute('aria-pressed')) === 'true');
  }

  /* Setup: Ablagefelder */
  await seite.click('#tab-setup');
  await seite.waitForTimeout(100);
  pruefe('Ablage-Einstellungen vorhanden', (await seite.locator('#ghToken').count()) === 1);
  /* Ohne Zugangsdaten muss die Prüfung sagen, welches Feld leer ist —
     die grauen Platzhalter sehen sonst aus wie Werte. */
  await seite.click('#ghTest');
  await seite.waitForTimeout(200);
  const stInfo = await seite.locator('#stInfo').innerText();
  pruefe('Verbindungsprüfung benennt die leeren Felder',
    /Noch leer: GitHub-Benutzer, Daten-Repository, Zugriffsschlüssel/.test(stInfo)
    && /Platzhalter/.test(stInfo), stInfo);
  pruefe('Offline-Hinweis erklärt verlorene Zugangsdaten',
    /Zugangsdaten aus diesem Browser verschwunden/.test(await seite.locator('#offline').innerText()));
  pruefe('Anthropic-Schlüsselfeld vorhanden', (await seite.locator('#anKey').count()) === 1);
  /* Schlüsselfeld: leer heißt leer, und der eingefügte Wert wird nachgewiesen. */
  pruefe('Seitenstand sichtbar', /Seitenstand .*neu laden/.test(await seite.locator('#seitenstand').innerText()));
  pruefe('Leeres Schlüsselfeld sagt, dass es leer ist',
    /leer — der graue Text/.test(await seite.locator('#ghTokenInfo').innerText()));
  await seite.fill('#ghToken', 'github_pat_11ABCDEFG0123456789');
  pruefe('Gefülltes Schlüsselfeld weist Länge und Anfang nach',
    /30 Zeichen, beginnt mit „github_pat_…“/.test(await seite.locator('#ghTokenInfo').innerText()),
    await seite.locator('#ghTokenInfo').innerText());
  await seite.fill('#ghToken', 'ghp_altesFormat');
  pruefe('Falsches Schlüsselformat wird benannt',
    /erwartet wird ein Schlüssel, der mit „github_pat_“ beginnt/.test(await seite.locator('#ghTokenInfo').innerText()));
  pruefe('Schlüssel bleibt zunächst verdeckt', (await seite.locator('#ghToken').getAttribute('type')) === 'password');
  await seite.click('#ghTokenZeigen');
  pruefe('Anzeigen macht den Schlüssel lesbar',
    (await seite.locator('#ghToken').getAttribute('type')) === 'text'
    && (await seite.locator('#ghTokenZeigen').innerText()) === 'verbergen');
  await seite.click('#ghTokenZeigen');
  await seite.fill('#ghToken', '');

  /* CSV — in der Einzeldatei sind die Module nicht mehr einzeln erreichbar,
     deshalb dort ueber den Export-Knopf statt ueber einen Modulimport. */
  if (mitModulTest) {
    const csv = await seite.evaluate(async () => {
      const m = await import('./src/js/export/csv.js');
      return m.buildCsv();
    });
    const zeilen = csv.trim().split('\r\n');
    pruefe('CSV hat Kopfzeile und eine Datenzeile', zeilen.length === 2, `${zeilen.length} Zeilen`);
    pruefe('CSV benutzt Semikolon', zeilen[0].split(';').length > 80, `${zeilen[0].split(';').length} Spalten`);
    pruefe('CSV enthält den gespeicherten Wert', /90[.,]5/.test(zeilen[1]));
    pruefe('CSV führt das Tagesprotokoll', zeilen[0].includes('Tagesprotokoll') && /GLOW 2,8mg/.test(zeilen[1]));
    pruefe('CSV führt Notizen mit Tagesangabe', /\w\w \d\d\.\d\d\.: kleiner Knoten/.test(zeilen[1]));
    pruefe('CSV führt die Confounder-Tage',
      zeilen[0].includes('Confounder-Tagesprotokoll') && /Schlaf 7h/.test(zeilen[1]));
    pruefe('CSV bekommt Spalten für eigene Stoffe',
      /Retatrutid Tage;Retatrutid mg je Dosis/.test(zeilen[0]), zeilen[0].slice(-60));
  } else {
    await seite.click('#tab-aus');
    const dl = seite.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await seite.click('#expBtn');
    const datei = await dl;
    pruefe('CSV-Export liefert eine Datei', !!datei, 'kein Download ausgelöst');
  }

  /* Bestandsschutz: eine Woche aus der Zeit der Einzelfelder (ein Text je
     Feld für die ganze Woche, keine Tagesnotizen) darf beim Laden und
     erneuten Speichern ihren Text nicht verlieren. */
  if (mitModulTest) {
    const key = await seite.evaluate(() => {
      const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1') || '{}');
      const k = Object.keys(weeks).sort().pop();
      const e = weeks[k];
      delete e.dose.notizen;
      e.dose.sonstMed = 'Altbestand Magnesium';
      e.dose.abw = '';
      e.dose.stellen = 'Altbestand Knoten';
      localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
      return k;
    });
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    await seite.click('#tab-bogen');
    pruefe('Alter Wochentext landet in der Zeile des Erfassungstags',
      (await seite.inputValue('#nstellen6')) === 'Altbestand Knoten');
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    const nachher = await seite.evaluate((k) =>
      JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k].dose, key);
    pruefe('Alter Wochentext übersteht das erneute Speichern',
      /Altbestand Knoten/.test(nachher.stellen) && Array.isArray(nachher.notizen && nachher.notizen.stellen),
      JSON.stringify(nachher.notizen));
    pruefe('Text einer entfallenen Spalte bleibt gespeichert', nachher.sonstMed === 'Altbestand Magnesium');

    /* Entfallene Spalte mit Tagesreihe: bleibt beim Speichern samt Reihe stehen. */
    await seite.evaluate((k) => {
      const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
      const d = weeks[k].dose;
      d.notizen.abw = ['', 'GLOW ausgelassen', '', '', '', '', ''];
      d.abw = 'Mo: GLOW ausgelassen';
      localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
    }, key);
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    const abwNachher = await seite.evaluate((k) => JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k].dose, key);
    pruefe('Tagesreihe einer entfallenen Spalte bleibt gespeichert',
      abwNachher.abw === 'Mo: GLOW ausgelassen' && abwNachher.notizen.abw[1] === 'GLOW ausgelassen',
      JSON.stringify(abwNachher.notizen));

    /* Alkohol stand bis 2026-10 in 0,5-l-Flaschen und steht seither in
       Litern: ein alter Eintrag wird beim Laden einmal halbiert, die Marke
       verhindert ein zweites Mal. */
    await seite.evaluate((k) => {
      const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
      const e = weeks[k];
      delete e.alkL;
      e.dose.zufuhr.alk = ['', '', '', '', '', '4', ''];
      e.conf.alk = '4';
      localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
    }, key);
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    await seite.click('#tab-bogen');
    pruefe('Alte Flaschenangaben werden zu Litern', (await seite.inputValue('#zalk5')) === '2',
      await seite.inputValue('#zalk5'));
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    pruefe('Liter werden nicht zweimal halbiert', (await seite.inputValue('#zalk5')) === '2',
      await seite.inputValue('#zalk5'));

    /* Kreatin und Protein lagen bis 2026-10 unter dose.zufuhr und gehören
       seither ins Substanzraster. */
    await seite.evaluate((k) => {
      const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
      const e = weeks[k];
      e.dose.zufuhr.kreatin = ['', '', '3', '', '', '', ''];
      e.dose.zufuhr.protein = ['', '', '120', '', '', '', ''];
      delete e.dose.tage.kreatin;
      delete e.dose.tage.protein;
      localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
    }, key);
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    await seite.click('#tab-bogen');
    pruefe('Alte Zufuhrwerte stehen im Substanzraster',
      (await seite.inputValue('#xkreatin2')) === '3' && (await seite.inputValue('#xprotein2')) === '120');
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    const umgehaengt = await seite.evaluate((k) =>
      JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k].dose, key);
    pruefe('Umzug wird gespeichert, der alte Ort bleibt leer',
      umgehaengt.tage.kreatin[2] === '3' && umgehaengt.tage.protein[2] === '120'
      && !(umgehaengt.zufuhr && 'kreatin' in umgehaengt.zufuhr),
      JSON.stringify(umgehaengt.zufuhr));

    /* Protein und Alkohol aus der Zeit, als sie in 02b mit Vortagsbezug
       standen: Zeile i meinte Tag i-1, landet also eine Zeile höher. Der
       Wert der ersten Zeile gehört zur Vorwoche und bleibt als Altbestand. */
    await seite.evaluate((k) => {
      const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1'));
      const e = weeks[k];
      delete e.dose.zufuhr;
      delete e.dose.tage.protein;
      e.conf.tage.protein = ['140', '150', '', '', '', '', ''];
      e.conf.tage.alk = ['', '', '', '1', '', '', ''];
      localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
    }, key);
    await seite.reload({ waitUntil: 'networkidle' });
    await seite.waitForTimeout(500);
    pruefe('Alte Vortagswerte rücken auf ihren Tag',
      (await seite.inputValue('#xprotein0')) === '150' && (await seite.inputValue('#zalk2')) === '1'
      && (await seite.inputValue('#zalk3')) === '');
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    const umgezogen = await seite.evaluate((k) => JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k], key);
    pruefe('Umzug gespeichert, Vorwochenwert als Altbestand erhalten',
      umgezogen.dose.tage && umgezogen.dose.tage.protein[0] === '150'
      && umgezogen.conf.vortagAlt && umgezogen.conf.vortagAlt.protein[0] === '140'
      && !('protein' in umgezogen.conf.tage), JSON.stringify(umgezogen.conf));
  }

  /* Wochengrafik über mehrere Wochen: eine frühere Woche mit GLOW 1 mg
     täglich einschieben, dann blättern, eigenen Zeitraum und Gesamt prüfen. */
  const vorwoche = await seite.evaluate(() => {
    const plus = (d, n) => { const t = new Date(`${d}T12:00:00`); t.setDate(t.getDate() + n);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    const heute = plus(new Date().toISOString().slice(0, 10), 0);
    const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1') || '{}');
    const aktuell = Object.keys(weeks).filter((k) => k <= plus(heute, 6)).sort().pop();
    const k = plus(aktuell, -7);
    weeks[k] = { week: k, dose: { glow: 7, tage: { start: plus(k, -6), glow: Array(7).fill('1'), kiss: [], pt: [], tirz: [] } } };
    localStorage.setItem('pwb.weeks.v1', JSON.stringify(weeks));
    return k;
  });
  await seite.reload({ waitUntil: 'networkidle' });
  await seite.waitForTimeout(500);
  await seite.click('#tab-bogen');
  pruefe('Wochengrafik: Vorwärts gesperrt in der laufenden Woche', await seite.locator('#wgVor').isDisabled());
  await seite.click('#wgZurueck');
  pruefe('Wochengrafik blättert in die Vorwoche',
    (await seite.locator('#wgBereich').innerText()).includes(`${vorwoche.slice(8, 10)}.${vorwoche.slice(5, 7)}.`)
    && (await seite.locator('#wochenGraph path[data-serie="glow"]').count()) === 1
    && /GLOW 1/.test(await seite.locator('#wochenGraph').innerText()), await seite.locator('#wgBereich').innerText());
  pruefe('Wochengrafik: vor die erste erfasste Woche geht es nicht', await seite.locator('#wgZurueck').isDisabled());
  await seite.click('#wgVor');
  await seite.click('[data-wgmodus="gesamt"]');
  const gesamt = await seite.locator('#wgBereich').innerText();
  pruefe('Wochengrafik Gesamt spannt alle erfassten Tage',
    /1[34] Tage/.test(gesamt) && (await seite.locator('#wochenGraph circle.wg-punkt').count()) >= 13, gesamt);
  await seite.click('[data-wgmodus="zeitraum"]');
  pruefe('Wochengrafik Zeitraum zeigt Datumsfelder', await seite.locator('#wgVon').isVisible());
  await seite.fill('#wgVon', vorwoche);
  await seite.dispatchEvent('#wgVon', 'change');
  await seite.fill('#wgBis', vorwoche);
  await seite.dispatchEvent('#wgBis', 'change');
  pruefe('Wochengrafik Zeitraum auf einen Tag', /· 1 Tag$/.test(await seite.locator('#wgBereich').innerText())
    && (await seite.locator('#wochenGraph circle.wg-punkt').count()) === 1);
  await seite.click('[data-wgmodus="woche"]');

  /* Frühere Woche korrigieren: zurückblättern, Wert ändern, vorblättern —
     die Korrektur landet in der früheren Woche, ohne Speichern-Klick. */
  pruefe('Wochenwahl: laufende Woche, vor gesperrt',
    (await seite.locator('#wwVor').isDisabled()) && (await seite.locator('#wwHeute').isHidden()));
  await seite.click('#wwZurueck');
  await seite.waitForTimeout(300);
  pruefe('Bogen zeigt die frühere Woche',
    (await seite.locator('#wochenWahl').getAttribute('data-korrektur')) === '1'
    && /Korrektur einer früheren Woche/.test(await seite.locator('#statusrow').innerText())
    && (await seite.inputValue('#xtirz0')) === '');
  pruefe('Grafik springt mit in die frühere Woche',
    (await seite.locator('#wgBereich').innerText()).includes(`${vorwoche.slice(8, 10)}.${vorwoche.slice(5, 7)}.`));
  await seite.fill('#xtirz0', '5');
  await seite.click('#wwVor');
  await seite.waitForTimeout(500);
  const korrigiert = await seite.evaluate((k) => JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k].dose.tage.tirz[0], vorwoche);
  pruefe('Korrektur beim Wechsel gespeichert', korrigiert === '5', String(korrigiert));
  pruefe('Zurück in der laufenden Woche', (await seite.locator('#wochenWahl').getAttribute('data-korrektur')) === '0');

  /* Tägliches Speichern bei geschlossenen Wochenfragen: deren Regler stehen
     auf den Vorgaben — gespeichert sähe das aus wie eine Antwort. */
  const zuTag = (heuteWt + 2) % 7;
  await setzeTag(zuTag);
  await seite.fill('#tschlaf0', '8');
  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  const zuWoche = await seite.evaluate(() => {
    const weeks = JSON.parse(localStorage.getItem('pwb.weeks.v1') || '{}');
    const wk = Object.keys(weeks).find((k) => weeks[k].conf && weeks[k].conf.schlaf === '8');
    return wk ? weeks[wk] : null;
  });
  pruefe('Tägliches Speichern schreibt keine Wochenfragen mit',
    !!zuWoche && !('kern' in zuWoche) && !('exp' in zuWoche) && !('iief' in zuWoche)
    && !('gew' in zuWoche.conf), zuWoche ? Object.keys(zuWoche).join(',') : 'Woche fehlt');
  await setzeTag(heuteWt);

  pruefe('Keine Fehler bis zum Ende', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();

await laufe(browser, `http://127.0.0.1:${port}/index.html`, 'Modulare Fassung (index.html)', true);

if (fs.existsSync(path.join(WURZEL, 'dist/peptid-wochenbogen.html'))) {
  await laufe(browser, `http://127.0.0.1:${port}/dist/peptid-wochenbogen.html`, 'Einzeldatei (dist/)', false);
} else {
  console.log('\nEinzeldatei nicht gebaut — node scripts/build-single.mjs zum Mitprüfen.');
}

await browser.close();
server.close();

const schlecht = pruefungen.filter((p) => !p.ok);
console.log(`\n${pruefungen.length - schlecht.length} von ${pruefungen.length} bestanden.`);
if (schlecht.length) console.log(schlecht.map((p) => `  ${p.label}: ${p.name}`).join('\n'));
process.exit(schlecht.length ? 1 : 0);
