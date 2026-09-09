/* Baut den Datenblock, den die KI zu sehen bekommt.

   Eine Zeile je Woche, dichte Schluessel-Wert-Notation statt JSON: das ist
   deutlich sparsamer im Verbrauch und fuer ein Sprachmodell genauso lesbar.
   Alles, was hier nicht steht, kann die Analyse nicht beruecksichtigen —
   wer ein Feld ergaenzt, ergaenzt es auch in weekLine().

   Der Block ist absichtlich einsehbar (Knopf "Datenblock anzeigen"), damit
   nachvollziehbar bleibt, worauf sich eine Antwort stuetzt. */

import { state, keys } from '../state.js';
import { s } from '../util/format.js';
import { weekNumber } from '../util/date.js';
import { CU_ANTEIL } from '../constants.js';
import { KERN, GLOWZIEL } from '../schema.js';
import {
  whoScore, iiefScore, kernMean, negMean, hautMean, gelenkMean, wohlVal,
  kraftIndex, taillenQuotient, tageKompakt
} from '../analysis/metrics.js';

function weekLine(k){
  var e=state.weeks[k], nr=weekNumber(k), p=[];
  p.push((nr?("W"+nr):"W?")+" "+k);
  if(e.dose){
    var cuW=(Number(e.dose.glow)||0)*(Number(e.dose.ghk)||Number(state.cfg.ghk)||0)*CU_ANTEIL;
    p.push("EXPOSITION: GLOW "+s(e.dose.glow)+" Inj. à "+s(e.dose.dGlow)+" mg"+
           ", Kisspeptin "+s(e.dose.kiss)+" Inj. à "+s(e.dose.dKiss)+" µg"+
           ", PT-141 "+s(e.dose.pt)+" Anw. à "+s(e.dose.dPt)+" mg"+
           ", Tirzepatid "+s(e.dose.tirz)+" mg/Woche"+
           (cuW>0?(", elementares Kupfer "+cuW.toFixed(2)+" mg/Woche"):"")+
           (e.dose.sonstMed?(", sonst: "+e.dose.sonstMed):"")+
           (e.dose.abw?(" ["+e.dose.abw+"]"):""));
    var tk=tageKompakt(e);
    if(tk) p.push("TAGE: "+tk);
  }
  p.push("Erwartung "+s(e.exp&&e.exp.erwartung));
  p.push("WHO-5 "+(whoScore(e)===null?"-":whoScore(e))+", IIEF-5 "+(iiefScore(e)===null?"-":iiefScore(e)));
  p.push("Morgenerektionen "+s(e.morgen&&e.morgen.naechte)+"/7");
  var km=kernMean(e), ng=negMean(e);
  p.push("Kern-Ø "+(km===null?"-":km.toFixed(1))+", NEGATIVKONTROLLEN-Ø "+(ng===null?"-":ng.toFixed(1)));
  if(e.kern) p.push("Kern-Items: "+KERN.map(function(x){return x.k+" "+s(e.kern[x.k]);}).join(", "));
  var hm=hautMean(e), gm=gelenkMean(e);
  p.push("GLOW-ZIELE: Haut-Ø "+(hm===null?"-":hm.toFixed(1))+
         ", Gelenke-Ø "+(gm===null?"-":gm.toFixed(1))+
         ", Wohlbefinden "+s(wohlVal(e))+
         (e.glow&&e.glow.ort?(" [Gelenke: "+e.glow.ort+"]"):""));
  if(e.glow) p.push("GLOW-Items: "+GLOWZIEL.map(function(x){return x.k.replace("g","")+" "+s(e.glow[x.k]);}).join(", "));
  if(e.masse) p.push("Umfänge: Brust "+s(e.masse.mBrust)+", ArmR "+s(e.masse.mArmR)+", ArmL "+s(e.masse.mArmL)+
                     ", BeinR "+s(e.masse.mBeinR)+", BeinL "+s(e.masse.mBeinL)+
                     (taillenQuotient(e)!==null?(", Taille/Glieder "+taillenQuotient(e).toFixed(2)):""));
  if(e.kraft){
    var kt=e.kraft.filter(function(k){return k&&k.kg&&k.reps;})
      .map(function(k){return (k.name||"?")+" "+k.kg+"kg x"+k.reps+(k.rir!==""&&k.rir!==undefined?(" RIR"+k.rir):"");});
    if(kt.length) p.push("KRAFT: "+kt.join("; ")+" | Kraftindex "+s(kraftIndex(e)));
  }
  if(e.pigment) p.push("Pigment: Tempo "+s(e.pigment.pTempo)+", Tiefe "+s(e.pigment.pTiefe)+
                       ", Dauer "+s(e.pigment.pDauer)+", UV "+s(e.pigment.uv)+"h"+
                       (e.pigment.naevi?(", Male: "+e.pigment.naevi):""));
  if(e.dose&&Number(e.dose.pt)>0&&e.pt){
    p.push("PT141: mit "+s(e.pt.ptMit)+" / ohne "+s(e.pt.ptOhne)+", NW "+s(e.pt.ptNw)+
           ", Dosis "+s(e.pt.dosis)+", Eintritt "+s(e.pt.eintritt)+"min, Dauer "+s(e.pt.dauer)+"h"+
           ", erkennbar "+s(e.pt.blind)+", Auslösung "+s(e.pt.ausloesung)+
           (e.pt.signs&&e.pt.signs.length?(", Begleitphänomene: "+e.pt.signs.join(",")):"")+
           (e.pt.vial?(", Spritze "+e.pt.vial+", Vermutung "+s(e.pt.guess)+", tatsächlich "+s(e.pt.actual)):""));
  }
  if(e.conf) p.push("Confounder: Gewicht "+s(e.conf.gew)+"kg, Bauch "+s(e.conf.bauch)+"cm, Protein "+s(e.conf.protein)+
                    "g, Training "+s(e.conf.train)+"h, Schlaf "+s(e.conf.schlaf)+"h, Alkohol "+s(e.conf.alk)+
                    ", Stress "+s(e.conf.stress)+
                    (e.conf.flags&&e.conf.flags.length?(", Flags: "+e.conf.flags.join(",")):"")+
                    (e.conf.sonst?(", sonst: "+e.conf.sonst):""));
  if(e.watch&&e.watch.length) p.push("Beobachtungsliste: "+e.watch.join(", ")+(e.watchNote?(" ["+e.watchNote+"]"):""));
  if(e.text&&e.text.anders) p.push("Was war anders: "+e.text.anders.slice(0,400));
  if(e.text&&e.text.ohnehin) p.push("Was ohnehin erwartet: "+e.text.ohnehin.slice(0,400));
  return p.join(" | ");
}

export function dataBlock(limitWeeks){
  var ks=keys();
  if(limitWeeks && ks.length>limitWeeks) ks=ks.slice(-limitWeeks);
  if(!ks.length) return "(noch keine Wochen erfasst)";
  var erw="ERWARTUNGSFENSTER (vorab festgelegt): Haut ab Woche "+state.cfg.erwHaut+
          ", Gelenke ab Woche "+state.cfg.erwGelenk+", Wohlbefinden ab Woche "+state.cfg.erwWohl+
          (state.cfg.glowStart?(". GLOW-Start am "+state.cfg.glowStart):"")+".\n";
  var head="ERFASSTE WOCHEN ("+ks.length+"), älteste zuerst. Skalen 0-10 sofern nicht anders angegeben.\n"+
           "WHO-5 geht bis 100, IIEF-5 bis 25, Morgenerektionen und Tage mit Verlangen bis 7.\n"+
           "Bei den Gelenk-Items bedeutet ein HÖHERER Wert weniger Beschwerden.\n"+erw+"\n";
  var body=ks.map(weekLine).join("\n\n");
  if(body.length>42000) body=body.slice(body.length-42000);
  return head+body;
}
