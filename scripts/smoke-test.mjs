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
  pruefe('Tagesraster: 7 Tage × 4 Substanzen', expoZellen === 28, `${expoZellen} Zellen`);
  const notizZellen = await seite.locator('#s-expo input[type="text"]').count();
  pruefe('Tagesraster: 7 Tage × 3 Notizspalten', notizZellen === 21, `${notizZellen} Zellen`);
  pruefe('Alte Wochenfelder für Notizen entfernt', (await seite.locator('#nSonstMed, #abw, #stellen').count()) === 0);
  const confZellen = await seite.locator('#s-confTage input').count();
  pruefe('Confounder-Tagesraster: 7 Tage × 4 Werte', confZellen === 28, `${confZellen} Zellen`);

  /* Freischaltung der Wochenfragen. Erst ein Erfassungstag, der nicht heute
     ist — dann muss alles Wöchentliche verborgen sein und die Ausnahme
     greifen. Danach der heutige Tag, damit der Rest des Tests ausfüllen kann. */
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
  pruefe('Wochenfragen außerhalb des Erfassungstags verborgen', await seite.locator('#s-kern').isHidden());
  const offeneKarten = await seite.locator('.card:visible h2').allInnerTexts();
  pruefe('Nur Tages- und Rahmenkarten offen', offeneKarten.length === 8, offeneKarten.join(' | '));
  pruefe('Tagesfelder bleiben sichtbar', await seite.locator('#s-expo').isVisible());
  pruefe('WHO-5 und IIEF-5 bleiben täglich offen',
    (await seite.locator('#s-who').isVisible()) && (await seite.locator('#s-iief').isVisible()));
  pruefe('Sperrhinweis nennt den Öffnungstag',
    /Wochenfragen noch geschlossen/.test(await seite.locator('#weeklyNote').innerText()));
  await seite.click('#gateOpen');
  pruefe('„Trotzdem ausfüllen" öffnet die Wochenfragen', await seite.locator('#s-kern').isVisible());

  await setzeTag(heuteWt);
  pruefe('Am Erfassungstag sind die Wochenfragen offen', await seite.locator('#s-kern').isVisible());
  pruefe('Abschlusshinweis erscheint',
    /Wochenabschluss/.test(await seite.locator('#weeklyNote').innerText()));

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

  /* Tägliche Confounder: Training und Alkohol summieren, Schlaf und Protein
     mitteln. Alkohol zählt in 0,5-l-Flaschen. */
  for (let i = 0; i < 7; i++) await seite.fill(`#tschlaf${i}`, '7');
  await seite.fill('#ttrain0', '1.5');
  await seite.fill('#ttrain3', '1.5');
  await seite.fill('#talk5', '2');
  await seite.fill('#tprotein0', '180');
  const cs = await seite.locator('#confSum').innerText();
  pruefe('Confounder-Raster summiert Training', /Training 3 h/.test(cs), cs.slice(0, 110));
  pruefe('Confounder-Raster mittelt den Schlaf', /Schlaf Ø 7 h/.test(cs), cs.slice(0, 110));
  pruefe('Alkohol zählt in 0,5-l-Flaschen', /Alkohol 2 Flaschen \(à 0,5 l\)/.test(cs), cs.slice(0, 110));

  /* Tagesraster: sieben GLOW-Tage eintragen, Zusammenfassung und
     Kupferhinweis rechnen mit; ein PT-141-Tag blendet die PT-Karte ein. */
  for (let i = 0; i < 7; i++) await seite.fill(`#xglow${i}`, '2.8');
  const sum = await seite.locator('#expoSum').innerText();
  pruefe('Tagesraster leitet die Wochensumme ab', /GLOW: 7 Injektionstage à 2,8 mg/.test(sum), sum.slice(0, 90));
  const cu = await seite.locator('#cuNote').innerText();
  pruefe('Kupferlast wird beziffert', /2,21 mg elementares Kupfer/.test(cu), cu.slice(0, 90));
  pruefe('PT-Karte ohne PT-141-Tag verborgen', await seite.locator('#ptCard').isHidden());
  await seite.fill('#xpt2', '1.75');
  pruefe('PT-Karte erscheint bei PT-141-Tag', await seite.locator('#ptCard').isVisible());

  /* Tagesnotizen: je Tag ein eigener Text, der mit Tagesangabe in die
     Wochenfelder und von dort in CSV und Datenblock wandert. */
  await seite.fill('#nsonstMed0', 'Kreatin 5 g');
  await seite.fill('#nsonstMed3', 'Kreatin 5 g, Vit. D');
  await seite.fill('#nabw4', 'GLOW ausgelassen');
  await seite.fill('#nstellen2', 'leichte Rötung links');
  const breite = await seite.evaluate(() => {
    const w = document.querySelector('.card.wide').getBoundingClientRect().width;
    const n = document.querySelector('#p-bogen > .card:not(.wide)').getBoundingClientRect().width;
    return { w, n };
  });
  pruefe('Expositionskarte darf breiter werden als der Rest', breite.w > breite.n + 50,
    `${Math.round(breite.w)} px gegen ${Math.round(breite.n)} px`);
  /* Die PT-Karte hat zwei Bedingungen — Anwendung UND Wochenabschluss.
     Das Tor darf ihre eigene nicht überstimmen und umgekehrt. Dafür ein
     dritter Wochentag: die Ausnahme oben gilt weiter für ihre eigene Woche,
     und die trägt bei gleichem Wochentag denselben Schlüssel. */
  await setzeTag((heuteWt + 5) % 7);
  pruefe('PT-Karte bleibt außerhalb des Erfassungstags zu', await seite.locator('#ptCard').isHidden());
  await seite.click('#gateOpen');
  pruefe('PT-Karte kommt mit den Wochenfragen zurück', await seite.locator('#ptCard').isVisible());
  await setzeTag(heuteWt);

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
  pruefe('Tagesnotiz überlebt das Neuladen', (await seite.inputValue('#nsonstMed3')) === 'Kreatin 5 g, Vit. D');
  pruefe('Notiz bleibt an ihrem Tag', (await seite.inputValue('#nabw4')) === 'GLOW ausgelassen'
    && (await seite.inputValue('#nabw3')) === '');

  /* Vials: Rechner-Preset als aktuelles GLOW-Vial übernehmen — die Spalte
     läuft danach in ml, der bestehende mg-Eintrag wird umgerechnet und die
     Wirkstoffmenge je Zelle ausgewiesen. */
  pruefe('Vial-Karte aufgebaut', (await seite.locator('#s-vials input').count()) === 8);
  await seite.click('#tab-setup');
  await seite.click('[data-preset="glow"]');
  await seite.click('[data-vialziel="glow"]');
  await seite.waitForTimeout(400);
  pruefe('Rechner meldet die Vial-Übernahme',
    /GLOW-Vial übernommen/.test(await seite.locator('#rcUebInfo').innerText()));
  await seite.click('#tab-bogen');
  pruefe('Vial-Karte zeigt die Konzentration', /23,33 mg\/ml/.test(await seite.locator('#vKonzglow').innerText()));
  pruefe('GLOW-Spalte läuft jetzt in ml', /\(ml\)/.test(await seite.locator('#xhglow').innerText()));
  pruefe('mg-Eintrag wurde in ml umgerechnet', (await seite.inputValue('#xglow0')) === '0.12');
  pruefe('Wirkstoffmenge wird je Zelle ausgewiesen', /= 2,8 mg/.test(await seite.locator('#cglow0').innerText()));
  const sumMl = await seite.locator('#expoSum').innerText();
  pruefe('Wochensumme bleibt in mg', /GLOW: 7 Injektionstage à 2,8 mg/.test(sumMl), sumMl.slice(0, 90));

  await seite.click('#saveBtn');
  await seite.waitForTimeout(500);
  await seite.reload({ waitUntil: 'networkidle' });
  await seite.waitForTimeout(500);
  pruefe('ml-Eintrag überlebt das Neuladen', (await seite.inputValue('#xglow0')) === '0.12');
  pruefe('Vial überlebt das Neuladen', (await seite.inputValue('#vMgglow')) === '70');

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
  pruefe('Datenblock trägt die Confounder-Tage', /CONFOUNDER-TAGE .*Schlaf 7h/.test(ctx));
  pruefe('Datenblock nennt die Zahl der Messtage', /IIEF-5 20 \(Ø aus 1 Tagen\)/.test(ctx));
  pruefe('Datenblock trägt Tagesnotizen mit Tagesangabe',
    /sonst: \w\w \d\d\.\d\d\.: Kreatin 5 g; \w\w \d\d\.\d\d\.: Kreatin 5 g, Vit\. D/.test(ctx)
    && /Einstichstellen: \w\w \d\d\.\d\d\.: leichte Rötung links/.test(ctx));
  pruefe('Analyse-Knöpfe ohne Quelle deaktiviert', await seite.locator('#askWeek').isDisabled());

  /* Setup: Ablagefelder */
  await seite.click('#tab-setup');
  await seite.waitForTimeout(100);
  pruefe('Ablage-Einstellungen vorhanden', (await seite.locator('#ghToken').count()) === 1);
  pruefe('Anthropic-Schlüsselfeld vorhanden', (await seite.locator('#anKey').count()) === 1);

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
    pruefe('CSV führt Notizen mit Tagesangabe', /GLOW ausgelassen/.test(zeilen[1]) && /\w\w \d\d\.\d\d\.: Kreatin/.test(zeilen[1]));
    pruefe('CSV führt die Confounder-Tage',
      zeilen[0].includes('Confounder-Tagesprotokoll') && /Schlaf 7h/.test(zeilen[1]));
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
      (await seite.inputValue('#nsonstMed6')) === 'Altbestand Magnesium'
      && (await seite.inputValue('#nstellen6')) === 'Altbestand Knoten');
    await seite.click('#saveBtn');
    await seite.waitForTimeout(500);
    const nachher = await seite.evaluate((k) =>
      JSON.parse(localStorage.getItem('pwb.weeks.v1'))[k].dose, key);
    pruefe('Alter Wochentext übersteht das erneute Speichern',
      /Altbestand Magnesium/.test(nachher.sonstMed) && /Altbestand Knoten/.test(nachher.stellen)
      && Array.isArray(nachher.notizen && nachher.notizen.sonstMed), JSON.stringify(nachher.notizen));
  }

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
