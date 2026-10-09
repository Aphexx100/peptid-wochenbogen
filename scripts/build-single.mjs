/* Baut aus dem Projekt eine einzelne HTML-Datei.

   Wozu: als Webseite laedt der Bogen seine Module einzeln — gut zum Arbeiten,
   schlecht fuer ein Claude-Artifact, das genau eine Datei ohne fremde Hosts
   erwartet. Dieses Skript buendelt Skripte und Stile in dieselbe Datei, damit
   beide Betriebsarten aus derselben Quelle kommen und nicht auseinanderlaufen.

   Aufruf:  node scripts/build-single.mjs
   Ergebnis: dist/peptid-wochenbogen.html

   Die gebaute Datei ist Wegwerfware — geaendert wird immer src/. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'dist', 'peptid-wochenbogen.html');

const lies = (p) => fs.readFile(path.join(WURZEL, p), 'utf8');

/* Die Schriften liegen als eigene Dateien neben dem CSS. Eine Einzeldatei
   darf aber nichts nachladen, auch nicht vom eigenen Host — deshalb wandern
   sie hier als data:-URI in das Stylesheet. Rund 80 kB Schrift werden dabei
   zu rund 107 kB Base64; das ist der Preis dafuer, dass das Artifact ohne
   Nebendateien auskommt. */
async function schriftenEinbetten(css) {
  const treffer = [...css.matchAll(/url\(\.\.\/fonts\/([\w.-]+)\)/g)];
  let out = css;
  for (const [ganz, datei] of treffer) {
    // eslint-disable-next-line no-await-in-loop
    const roh = await fs.readFile(path.join(WURZEL, 'src/fonts', datei));
    out = out.replace(ganz, `url(data:font/woff2;base64,${roh.toString('base64')})`);
  }
  return out;
}

const bundle = await esbuild.build({
  entryPoints: [path.join(WURZEL, 'src/js/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none'
});
const js = bundle.outputFiles[0].text;

const css = `${await schriftenEinbetten(await lies('src/css/fonts.css'))}\n`
  + `${await lies('src/css/tokens.css')}\n${await lies('src/css/app.css')}`;
let html = await lies('index.html');

/* Verweise durch den eingebetteten Inhalt ersetzen. */
html = html.replace(
  /<link rel="stylesheet" href="src\/css\/fonts\.css">\s*<link rel="stylesheet" href="src\/css\/tokens\.css">\s*<link rel="stylesheet" href="src\/css\/app\.css">/,
  `<style>\n${css}\n</style>`
);
html = html.replace(
  /<script type="module" src="src\/js\/main\.js"><\/script>/,
  `<script>\n${js}\n</script>`
);

/* Nur die Verweise pruefen, nicht den Inhalt: esbuild schreibt die Modulpfade
   als Kommentare in den Bundle, und die sollen dort auch bleiben. */
if (/<link[^>]+src\/css\//.test(html) || /<script[^>]+src="src\/js\//.test(html)) {
  console.error('Es sind noch Verweise auf src/ übrig — die Ersetzung hat nicht gegriffen.');
  process.exit(1);
}

await fs.mkdir(path.dirname(ZIEL), { recursive: true });
await fs.writeFile(ZIEL, html);
console.log(`${path.relative(WURZEL, ZIEL)} — ${(html.length / 1024).toFixed(0)} kB`);
