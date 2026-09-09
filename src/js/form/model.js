/* Uebersetzung zwischen Formular und gespeichertem Wochenobjekt.
   readForm() liest die Oberflaeche in ein einfaches Objekt, fillForm() spielt
   ein Objekt zurueck ins Formular. Die beiden muessen zueinander passen —
   wer ein Feld ergaenzt, fasst beide an. Das gespeicherte Objekt ist zugleich
   das Datenformat in der Datenbank und im JSON-Export. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { weekNumber } from '../util/date.js';
import {
  KERN, GLOWZIEL, MASSE, MORGEN, PT, PT_SIGNS, PIGMENT, NEG, WATCH, CONF_CHECKS, MONTH
} from '../schema.js';
import { sVal, setS, segVal, setSeg, checked } from '../ui/controls.js';
import {
  recalcScores, readExpo, ableiten, fuelleExpo, setLegacyDose, getLegacyDose
} from './build.js';

export function readForm(){
  var e={week:state.weekKey, nr:weekNumber(state.weekKey), saved:new Date().toISOString(),
    exp:{}, kern:{}, who:[], iief:[], pt:{}, neg:{}, watch:[], conf:{}, text:{}};
  e.exp.erwartung=sVal("erwartung");
  /* Wochensummen aus dem Tagesraster ableiten. Ist das Raster leer und die
     Woche wurde vor der Umstellung als Wochensumme erfasst, bleiben die alten
     Summen erhalten, statt sie mit Nullen zu ueberschreiben. */
  var g=readExpo(), legacy=getLegacyDose();
  if(g.leer&&legacy){
    e.dose={glow:legacy.glow||0, kiss:legacy.kiss||0, pt:legacy.pt||0,
            dGlow:legacy.dGlow||"", dKiss:legacy.dKiss||"", dPt:legacy.dPt||"", ghk:state.cfg.ghk,
            tirz:legacy.tirz||""};
  }else{
    var a=ableiten(g.tage);
    e.dose={glow:a.n_glow, kiss:a.n_kiss, pt:a.n_pt,
            dGlow:a.d_glow, dKiss:a.d_kiss, dPt:a.d_pt, ghk:state.cfg.ghk,
            tirz:a.tirz, tage:g.tage};
  }
  e.dose.sonstMed=$("nSonstMed").value.trim();
  e.dose.abw=$("abw").value.trim();
  e.dose.stellen=$("stellen").value.trim();
  KERN.forEach(function(x){ e.kern[x.k]=sVal(x.k); });
  e.glow={ort:$("gGelenkOrt").value.trim()};
  GLOWZIEL.forEach(function(x){ e.glow[x.k]=sVal(x.k); });
  e.masse={}; MASSE.forEach(function(x){ e.masse[x.k]=$(x.k).value; });
  e.kraft=[0,1,2,3].map(function(i){
    return {name:state.cfg.uebungen[i]||"", kg:$("kw"+i).value, reps:$("kr"+i).value, rir:$("ke"+i).value};
  });
  for(var i=0;i<5;i++) e.who.push(segVal("who"+i));
  for(var j=0;j<5;j++) e.iief.push(segVal("iief"+j));
  e.morgen={naechte:segVal("mNaechte")};
  MORGEN.forEach(function(x){ e.morgen[x.k]=sVal(x.k); });
  if(e.dose.pt>0){
    PT.forEach(function(x){ e.pt[x.k]=sVal(x.k); });
    e.pt.dosis=$("ptDosis").value.trim(); e.pt.eintritt=$("ptEintritt").value;
    e.pt.dauer=$("ptDauer").value; e.pt.blind=$("ptBlind").value;
    e.pt.ausloesung=$("ptAusloesung").value;
    e.pt.signs=[]; PT_SIGNS.forEach(function(s){ if(checked(s.k)) e.pt.signs.push(s.k); });
    e.pt.signsNote=$("ptSignsNote").value.trim();
    e.pt.vial=$("ptVial").value.trim(); e.pt.guess=$("ptGuess").value; e.pt.actual=$("ptActual").value;
  }
  e.pigment={uv:$("uvStd").value, quelle:$("uvQuelle").value, naevi:$("naevi").value.trim()};
  PIGMENT.forEach(function(x){ e.pigment[x.k]=sVal(x.k); });
  NEG.forEach(function(x){ e.neg[x.k]=sVal(x.k); });
  WATCH.forEach(function(w){ if(checked(w.k)) e.watch.push(w.k); });
  e.watchNote=$("watchNote").value.trim();
  e.conf={train:$("cTrain").value, schlaf:$("cSchlaf").value, alk:$("cAlk").value,
          gew:$("cGew").value, bauch:$("cBauch").value, protein:$("cProtein").value,
          stress:sVal("cStress"), sonst:$("cSonst").value.trim(), flags:[]};
  CONF_CHECKS.forEach(function(c){ if(checked(c.k)) e.conf.flags.push(c.k); });
  e.month=[]; MONTH.forEach(function(m){ if(checked(m.k)) e.month.push(m.k); });
  e.text={anders:$("fText1").value.trim(), ohnehin:$("fText2").value.trim()};
  return e;
}
export function fillForm(e){
  if(!e) return;
  setS("erwartung", e.exp&&e.exp.erwartung);
  /* Erst den Bestandsschutz setzen, dann das Raster fuellen — fuelleExpo()
     aktualisiert Zusammenfassung, Kupferlast und PT-Karte gleich mit. */
  setLegacyDose(e.dose&&!e.dose.tage?e.dose:null);
  fuelleExpo(e.dose&&e.dose.tage);
  if(e.dose){ $("nSonstMed").value=e.dose.sonstMed||"";
    $("abw").value=e.dose.abw||""; $("stellen").value=e.dose.stellen||""; }
  KERN.forEach(function(x){ setS(x.k, e.kern&&e.kern[x.k]); });
  GLOWZIEL.forEach(function(x){ setS(x.k, e.glow&&e.glow[x.k]); });
  $("gGelenkOrt").value=(e.glow&&e.glow.ort)||"";
  MASSE.forEach(function(x){ $(x.k).value=(e.masse&&e.masse[x.k])||""; });
  [0,1,2,3].forEach(function(i){
    var kf=(e.kraft&&e.kraft[i])||{};
    $("kw"+i).value=kf.kg||""; $("kr"+i).value=kf.reps||""; $("ke"+i).value=kf.rir||"";
  });
  (e.who||[]).forEach(function(v,i){ setSeg("who"+i,v); });
  (e.iief||[]).forEach(function(v,i){ setSeg("iief"+i,v); });
  setSeg("mNaechte", e.morgen?e.morgen.naechte:null);
  MORGEN.forEach(function(x){ setS(x.k, e.morgen&&e.morgen[x.k]); });
  PT.forEach(function(x){ setS(x.k, e.pt&&e.pt[x.k]); });
  if(e.pt){ $("ptDosis").value=e.pt.dosis||""; $("ptEintritt").value=e.pt.eintritt||"";
    $("ptDauer").value=e.pt.dauer||""; $("ptBlind").value=e.pt.blind||"";
    $("ptAusloesung").value=e.pt.ausloesung||""; $("ptSignsNote").value=e.pt.signsNote||"";
    $("ptVial").value=e.pt.vial||""; $("ptGuess").value=e.pt.guess||""; $("ptActual").value=e.pt.actual||""; }
  if(e.pigment){ $("uvStd").value=e.pigment.uv||""; $("uvQuelle").value=e.pigment.quelle||"";
    $("naevi").value=e.pigment.naevi||""; }
  PIGMENT.forEach(function(x){ setS(x.k, e.pigment&&e.pigment[x.k], 0); });
  NEG.forEach(function(x){ setS(x.k, e.neg&&e.neg[x.k]); });
  document.querySelectorAll("[data-c]").forEach(function(i){
    var on=(e.watch&&e.watch.indexOf(i.dataset.c)>=0)||
           (e.conf&&e.conf.flags&&e.conf.flags.indexOf(i.dataset.c)>=0)||
           (e.month&&e.month.indexOf(i.dataset.c)>=0)||
           (e.pt&&e.pt.signs&&e.pt.signs.indexOf(i.dataset.c)>=0);
    i.checked=!!on; i.parentElement.dataset.on=on?"1":"0";
  });
  $("watchNote").value=e.watchNote||"";
  if(e.conf){ $("cTrain").value=e.conf.train||""; $("cSchlaf").value=e.conf.schlaf||"";
    $("cAlk").value=e.conf.alk||""; $("cGew").value=e.conf.gew||""; $("cBauch").value=e.conf.bauch||"";
    $("cProtein").value=e.conf.protein||"";
    setS("cStress",e.conf.stress); $("cSonst").value=e.conf.sonst||""; }
  if(e.text){ $("fText1").value=e.text.anders||""; $("fText2").value=e.text.ohnehin||""; }
  recalcScores();
}
