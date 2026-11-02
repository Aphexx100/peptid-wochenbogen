/* CSV-Export fuer Tabellenkalkulation.
   Semikolon als Trennzeichen und Komma als Dezimalzeichen, damit Excel und
   LibreOffice in deutscher Einstellung die Datei ohne Importdialog oeffnen.
   Das BOM am Anfang sorgt dafuer, dass Umlaute richtig ankommen.
   Die Spalten entstehen aus denselben Definitionen wie das Formular — eine
   neue Frage in schema.js erscheint hier automatisch als neue Spalte. */

import { state, keys } from '../state.js';
import { fmt } from '../util/format.js';
import { weekNumber } from '../util/date.js';
import { CU_ANTEIL } from '../constants.js';
import {
  KERN, GLOWZIEL, MASSE
} from '../schema.js';
import { alleStoffe } from '../substanzen.js';
import {
  whoScore, hautMean, gelenkMean, kraftIndex, taillenQuotient, cuWeek,
  tageKompakt, confTageKompakt, tageErfasst
} from '../analysis/metrics.js';

/* Selbst angelegte Stoffe bekommen je zwei Spalten am Ende der Tabelle —
   am Ende, damit die Spaltenfolge der eingebauten Fragen gleich bleibt und
   eine aeltere Auswertung die Datei weiter liest. */
const eigene = () => alleStoffe().filter(function(x){return x.eigen;});

function cell(v){ var s=(v===null||v===undefined)?"":String(v);
  if(/[";\n]/.test(s)) s='"'+s.replace(/"/g,'""')+'"'; return s; }
export function buildCsv(){
  var cols=["Woche","Datum",
    "GLOW Injektionen","GLOW mg je Dosis","Kisspeptin Injektionen","Kisspeptin µg je Dosis",
    "PT-141 Anwendungen","PT-141 mg je Dosis","Kupfer mg/Woche",
    "Tirzepatid mg/Woche","DHEA Tage","DHEA mg je Dosis","Kreatin g/Woche","Tagesprotokoll","Sonstige Medikamente","Gewicht kg","Taille cm","Protein Ø g/Tag","Erwartung"]
    .concat(KERN.map(function(x){return x.n;}))
    .concat(["WHO-5","WHO-5 Messtage"])
    .concat(GLOWZIEL.map(function(x){return x.n;})).concat(["Haut-Ø","Gelenke-Ø","Betroffene Gelenke"])
    .concat(MASSE.map(function(x){return x.n+" cm";})).concat(["Taille/Glieder"])
    .concat(["Bankdrücken kg","Bankdrücken max. Wdh.","Kraftindex"])
    .concat(["Training h/Woche","Schlaf Ø h","Alkohol l/Woche","Confounder-Tagesprotokoll"])
    .concat(["Wochenkommentar","Was war anders","Was ohnehin erwartet","Abweichungen",
             "Einstichstellen","Tageskommentare"])
    .concat(eigene().reduce(function(sp,x){
      return sp.concat([x.n+" Tage", x.n+" "+x.u+" je Dosis"]);
    },[]));
  var rows=[cols.join(";")];
  keys().forEach(function(k){
    var e=state.weeks[k];
    var cuW=cuWeek(e, CU_ANTEIL, state.cfg.ghk);
    var r=[weekNumber(k)||"",k,
           e.dose?e.dose.glow:"", e.dose?e.dose.dGlow:"",
           e.dose?e.dose.kiss:"", e.dose?e.dose.dKiss:"",
           e.dose?e.dose.pt:"", e.dose?e.dose.dPt:"",
           cuW>0?cuW.toFixed(2).replace(".",","):"",
           e.dose?e.dose.tirz:"", e.dose?e.dose.dhea:"", e.dose?e.dose.dDhea:"",
           e.dose&&e.dose.kreatin?e.dose.kreatin:"", tageKompakt(e), e.dose?e.dose.sonstMed:"",
           e.conf?e.conf.gew:"", e.conf?e.conf.bauch:"", e.conf?e.conf.protein:"",
           e.exp?e.exp.erwartung:""]
      .concat(KERN.map(function(x){return e.kern?e.kern[x.k]:"";}))
      .concat([whoScore(e)===null?"":whoScore(e), tageErfasst(e.whoTage)||""])
      .concat(GLOWZIEL.map(function(x){return e.glow?e.glow[x.k]:"";}))
      .concat([hautMean(e)===null?"":fmt(hautMean(e),1),
               gelenkMean(e)===null?"":fmt(gelenkMean(e),1),
               e.glow?e.glow.ort:""])
      .concat(MASSE.map(function(x){return e.masse?e.masse[x.k]:"";}))
      .concat([taillenQuotient(e)===null?"":taillenQuotient(e).toFixed(2).replace(".",",")])
      .concat([(e.kraft&&e.kraft[0]&&e.kraft[0].kg)||"", (e.kraft&&e.kraft[0]&&e.kraft[0].reps)||"",
               kraftIndex(e)===null?"":kraftIndex(e)])
      .concat([e.conf?e.conf.train:"",e.conf?e.conf.schlaf:"",e.conf?e.conf.alk:"",
               confTageKompakt(e)])
      .concat([e.conf?e.conf.sonst:"", e.text?e.text.anders:"", e.text?e.text.ohnehin:"",
               e.dose?e.dose.abw:"", e.dose?e.dose.stellen:"", e.dose?e.dose.tag:""])
      .concat(eigene().reduce(function(sp,x){
        var o=(e.dose&&e.dose.extra&&e.dose.extra[x.k])||{};
        return sp.concat([o.tage||"", o.dosis||""]);
      },[]));
    rows.push(r.map(cell).join(";"));
  });
  return "﻿"+rows.join("\r\n");
}
