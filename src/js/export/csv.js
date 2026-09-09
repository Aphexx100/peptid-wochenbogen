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
  KERN, GLOWZIEL, MASSE, MORGEN, PT_SIGNS, PIGMENT, NEG, WATCH, CONF_CHECKS
} from '../schema.js';
import {
  whoScore, iiefScore, hautMean, gelenkMean, kraftIndex, taillenQuotient, cuWeek, tageKompakt
} from '../analysis/metrics.js';

function cell(v){ var s=(v===null||v===undefined)?"":String(v);
  if(/[";\n]/.test(s)) s='"'+s.replace(/"/g,'""')+'"'; return s; }
export function buildCsv(){
  var cols=["Woche","Datum",
    "GLOW Injektionen","GLOW mg je Dosis","Kisspeptin Injektionen","Kisspeptin µg je Dosis",
    "PT-141 Anwendungen","PT-141 mg je Dosis","Kupfer mg/Woche",
    "Tirzepatid mg/Woche","Tagesprotokoll","Sonstige Medikamente","Gewicht kg","Taille cm","Protein g","Erwartung"]
    .concat(KERN.map(function(x){return x.n;}))
    .concat(["WHO-5","IIEF-5"])
    .concat(["Morgen mit Erektion (0-7)"]).concat(MORGEN.map(function(x){return "Morgen: "+x.n;}))
    .concat(["PT Verlangen mit","PT Verlangen ohne","PT Nebenwirkung","PT Dosis","PT Eintritt min","PT Dauer h","PT erkennbar","PT Auslösung"])
    .concat(PT_SIGNS.map(function(x){return "PT: "+x.n;})).concat(["PT Ablauf Begleitphänomene"])
    .concat(GLOWZIEL.map(function(x){return x.n;})).concat(["Haut-Ø","Gelenke-Ø","Betroffene Gelenke"])
    .concat(MASSE.map(function(x){return x.n+" cm";})).concat(["Taille/Glieder"])
    .concat([1,2,3,4].map(function(i){return "Kraft "+i+" (kg x Wdh)";})).concat(["Kraftindex"])
    .concat(PIGMENT.map(function(x){return x.n;})).concat(["UV-Stunden","UV-Quelle","Muttermale"])
    .concat(NEG.map(function(x){return x.n;}))
    .concat(WATCH.map(function(x){return x.n;}))
    .concat(["Beobachtung Detail","Training h","Schlaf h","Alkohol","Stress"])
    .concat(CONF_CHECKS.map(function(x){return x.n;}))
    .concat(["Sonstiges","Was war anders","Was ohnehin erwartet","Abweichungen","Einstichstellen"]);
  var rows=[cols.join(";")];
  keys().forEach(function(k){
    var e=state.weeks[k];
    var cuW=cuWeek(e, CU_ANTEIL, state.cfg.ghk);
    var r=[weekNumber(k)||"",k,
           e.dose?e.dose.glow:"", e.dose?e.dose.dGlow:"",
           e.dose?e.dose.kiss:"", e.dose?e.dose.dKiss:"",
           e.dose?e.dose.pt:"", e.dose?e.dose.dPt:"",
           cuW>0?cuW.toFixed(2).replace(".",","):"",
           e.dose?e.dose.tirz:"", tageKompakt(e), e.dose?e.dose.sonstMed:"",
           e.conf?e.conf.gew:"", e.conf?e.conf.bauch:"", e.conf?e.conf.protein:"",
           e.exp?e.exp.erwartung:""]
      .concat(KERN.map(function(x){return e.kern?e.kern[x.k]:"";}))
      .concat([whoScore(e)===null?"":whoScore(e), iiefScore(e)===null?"":iiefScore(e)])
      .concat([e.morgen&&e.morgen.naechte!==null&&e.morgen.naechte!==undefined?e.morgen.naechte:""])
      .concat(MORGEN.map(function(x){return e.morgen?e.morgen[x.k]:"";}))
      .concat([e.pt?e.pt.ptMit:"",e.pt?e.pt.ptOhne:"",e.pt?e.pt.ptNw:"",e.pt?e.pt.dosis:"",
               e.pt?e.pt.eintritt:"",e.pt?e.pt.dauer:"",e.pt?e.pt.blind:"",e.pt?e.pt.ausloesung:""])
      .concat(PT_SIGNS.map(function(x){return (e.pt&&e.pt.signs&&e.pt.signs.indexOf(x.k)>=0)?"ja":"";}))
      .concat([e.pt?e.pt.signsNote:""])
      .concat(GLOWZIEL.map(function(x){return e.glow?e.glow[x.k]:"";}))
      .concat([hautMean(e)===null?"":fmt(hautMean(e),1),
               gelenkMean(e)===null?"":fmt(gelenkMean(e),1),
               e.glow?e.glow.ort:""])
      .concat(MASSE.map(function(x){return e.masse?e.masse[x.k]:"";}))
      .concat([taillenQuotient(e)===null?"":taillenQuotient(e).toFixed(2).replace(".",",")])
      .concat([0,1,2,3].map(function(i){ var k=e.kraft&&e.kraft[i];
               return (k&&k.kg&&k.reps)?(k.kg+" x "+k.reps):""; }))
      .concat([kraftIndex(e)===null?"":kraftIndex(e)])
      .concat(PIGMENT.map(function(x){return e.pigment?e.pigment[x.k]:"";}))
      .concat([e.pigment?e.pigment.uv:"", e.pigment?e.pigment.quelle:"", e.pigment?e.pigment.naevi:""])
      .concat(NEG.map(function(x){return e.neg?e.neg[x.k]:"";}))
      .concat(WATCH.map(function(x){return (e.watch&&e.watch.indexOf(x.k)>=0)?"ja":"";}))
      .concat([e.watchNote||"",e.conf?e.conf.train:"",e.conf?e.conf.schlaf:"",e.conf?e.conf.alk:"",e.conf?e.conf.stress:""])
      .concat(CONF_CHECKS.map(function(x){return (e.conf&&e.conf.flags&&e.conf.flags.indexOf(x.k)>=0)?"ja":"";}))
      .concat([e.conf?e.conf.sonst:"", e.text?e.text.anders:"", e.text?e.text.ohnehin:"",
               e.dose?e.dose.abw:"", e.dose?e.dose.stellen:""]);
    rows.push(r.map(cell).join(";"));
  });
  return "﻿"+rows.join("\r\n");
}
