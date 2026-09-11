/* Uebersetzung zwischen Formular und gespeichertem Wochenobjekt.
   readForm() liest die Oberflaeche in ein einfaches Objekt, fillForm() spielt
   ein Objekt zurueck ins Formular. Die beiden muessen zueinander passen —
   wer ein Feld ergaenzt, fasst beide an. Das gespeicherte Objekt ist zugleich
   das Datenformat in der Datenbank und im JSON-Export. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { weekNumber, iso } from '../util/date.js';
import {
  KERN, GLOWZIEL, MASSE, MORGEN, PT, PT_SIGNS, PIGMENT, NEG, WATCH, CONF_CHECKS, MONTH
} from '../schema.js';
import { sVal, setS, segVal, setSeg, checked } from '../ui/controls.js';
import {
  recalcScores, readExpo, ableiten, fuelleExpo, setLegacyDose, getLegacyDose,
  readConfTage, ableitenConf, fuelleConfTage, setLegacyConf, getLegacyConf,
  mergeHeute, tagesMittel, setTagesSaetze, readNotizen, ableitenNotizen, fuelleNotizen
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
    /* ml-Rohwerte und Vial-Stand mitschreiben, wenn in ml erfasst wurde —
       so bleibt nachvollziehbar, was aufgezogen wurde und womit. */
    if(g.hatMl){
      e.dose.tageMl=g.tageMl;
      e.dose.vials=JSON.parse(JSON.stringify(state.cfg.vials||{}));
    }
  }
  /* Medikamente, Abweichungen und Einstichstellen stehen je Tag im Raster.
     Die Wochenfelder bleiben als abgeleiteter Text mit Tagesangabe
     erhalten, damit CSV und Datenblock sie unveraendert lesen. */
  var nz=readNotizen(), nw=ableitenNotizen(nz.tage);
  e.dose.sonstMed=nw.sonstMed; e.dose.abw=nw.abw; e.dose.stellen=nw.stellen;
  if(!nz.leer) e.dose.notizen=nz.tage;
  KERN.forEach(function(x){ e.kern[x.k]=sVal(x.k); });
  e.glow={ort:$("gGelenkOrt").value.trim()};
  GLOWZIEL.forEach(function(x){ e.glow[x.k]=sVal(x.k); });
  e.masse={}; MASSE.forEach(function(x){ e.masse[x.k]=$(x.k).value; });
  e.kraft=[0,1,2,3].map(function(i){
    return {name:state.cfg.uebungen[i]||"", kg:$("kw"+i).value, reps:$("kr"+i).value, rir:$("ke"+i).value};
  });
  /* WHO-5 und IIEF-5 werden taeglich erfasst: der heutige Antwortsatz wird
     zu den bereits gespeicherten Tagen dieser Woche gelegt, e.who/e.iief
     tragen das Mittel je Frage. Ein leerer Bogen loescht keinen Tag. */
  e.whoTage=mergeHeute("who"); e.iiefTage=mergeHeute("iief");
  e.who=tagesMittel(e.whoTage); e.iief=tagesMittel(e.iiefTage);
  e.morgen={naechte:segVal("mNaechte")};
  MORGEN.forEach(function(x){ e.morgen[x.k]=sVal(x.k); });
  if(e.dose.pt>0){
    PT.forEach(function(x){ e.pt[x.k]=sVal(x.k); });
    e.pt.dosis=$("ptDosis").value.trim(); e.pt.eintritt=$("ptEintritt").value;
    e.pt.dauer=$("ptDauer").value; e.pt.blind=$("ptBlind").value;
    e.pt.ausloesung=$("ptAusloesung").value;
    e.pt.signs=[]; PT_SIGNS.forEach(function(s){ if(checked(s.k)) e.pt.signs.push(s.k); });
    e.pt.signsNote=$("ptSignsNote").value.trim();
  }
  e.pigment={uv:$("uvStd").value, quelle:$("uvQuelle").value, naevi:$("naevi").value.trim()};
  PIGMENT.forEach(function(x){ e.pigment[x.k]=sVal(x.k); });
  NEG.forEach(function(x){ e.neg[x.k]=sVal(x.k); });
  WATCH.forEach(function(w){ if(checked(w.k)) e.watch.push(w.k); });
  e.watchNote=$("watchNote").value.trim();
  /* Training, Schlaf, Protein und Alkohol kommen aus dem Tagesraster; Summe
     bei Training und Alkohol, Durchschnitt bei Schlaf und Protein. Alkohol
     zaehlt in 0,5-l-Flaschen. Wie bei der Exposition bleiben die alten
     Wochenwerte stehen, solange kein Tag eingetragen ist. */
  var c=readConfTage(), legacyC=getLegacyConf();
  var cw=(c.leer&&legacyC)
    ? {train:legacyC.train||"", schlaf:legacyC.schlaf||"", protein:legacyC.protein||"", alk:legacyC.alk||""}
    : ableitenConf(c.tage);
  e.conf={train:cw.train, schlaf:cw.schlaf, alk:cw.alk, protein:cw.protein,
          gew:$("cGew").value, bauch:$("cBauch").value,
          stress:sVal("cStress"), sonst:$("cSonst").value.trim(), flags:[]};
  if(!c.leer) e.conf.tage=c.tage;
  CONF_CHECKS.forEach(function(c2){ if(checked(c2.k)) e.conf.flags.push(c2.k); });
  e.month=[]; MONTH.forEach(function(m){ if(checked(m.k)) e.month.push(m.k); });
  /* Die beiden Freitextfragen sind entfallen; bereits erfasste Antworten
     bleiben im gespeicherten Objekt und in CSV und Datenblock lesbar. */
  var alt=state.weeks[state.weekKey];
  if(alt&&alt.text&&(alt.text.anders||alt.text.ohnehin)) e.text=alt.text;
  return e;
}
/* Ein einzelner Antwortsatz aus der Zeit vor der Tagesumstellung wird dem
   Erfassungstag der Woche zugeschlagen — irgendein Tag muss er sein, und der
   Abschlusstag ist der ehrlichste Kandidat. */
function ganzerTagAls(woche,satz){ var m={}; m[woche]=satz.slice(); return m; }

/* Antwortsatz von heute in die Segmente schreiben, sonst alle leeren. */
function zeigeHeute(praefix,map){
  var heute=iso(new Date()), satz=map[heute];
  for(var i=0;i<5;i++) setSeg(praefix+i, satz?satz[i]:null);
}

export function fillForm(e){
  if(!e) return;
  setS("erwartung", e.exp&&e.exp.erwartung);
  /* Erst den Bestandsschutz setzen, dann das Raster fuellen — fuelleExpo()
     aktualisiert Zusammenfassung, Kupferlast und PT-Karte gleich mit. */
  setLegacyDose(e.dose&&!e.dose.tage?e.dose:null);
  fuelleExpo(e.dose||null);
  fuelleNotizen(e.dose||null);
  KERN.forEach(function(x){ setS(x.k, e.kern&&e.kern[x.k]); });
  GLOWZIEL.forEach(function(x){ setS(x.k, e.glow&&e.glow[x.k]); });
  $("gGelenkOrt").value=(e.glow&&e.glow.ort)||"";
  MASSE.forEach(function(x){ $(x.k).value=(e.masse&&e.masse[x.k])||""; });
  [0,1,2,3].forEach(function(i){
    var kf=(e.kraft&&e.kraft[i])||{};
    $("kw"+i).value=kf.kg||""; $("kr"+i).value=kf.reps||""; $("ke"+i).value=kf.rir||"";
  });
  /* Die Segmente zeigen den heutigen Tag: den gespeicherten Satz von heute,
     sonst leer — jeder Tag wird frisch beantwortet. Wochen aus der Zeit vor
     der Tagesumstellung bringen ihren einen Satz als heutigen Stand mit. */
  var wt=e.whoTage||(Array.isArray(e.who)&&e.who.length===5&&e.who.every(function(v){return v!==null&&v!==undefined;})
    ?ganzerTagAls(e.week,e.who):{});
  var it=e.iiefTage||(Array.isArray(e.iief)&&e.iief.length===5&&e.iief.every(function(v){return v!==null&&v!==undefined;})
    ?ganzerTagAls(e.week,e.iief):{});
  setTagesSaetze(wt,it);
  zeigeHeute("who",wt); zeigeHeute("iief",it);
  setSeg("mNaechte", e.morgen?e.morgen.naechte:null);
  MORGEN.forEach(function(x){ setS(x.k, e.morgen&&e.morgen[x.k]); });
  PT.forEach(function(x){ setS(x.k, e.pt&&e.pt[x.k]); });
  if(e.pt){ $("ptDosis").value=e.pt.dosis||""; $("ptEintritt").value=e.pt.eintritt||"";
    $("ptDauer").value=e.pt.dauer||""; $("ptBlind").value=e.pt.blind||"";
    $("ptAusloesung").value=e.pt.ausloesung||""; $("ptSignsNote").value=e.pt.signsNote||""; }
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
  setLegacyConf(e.conf&&!e.conf.tage?e.conf:null);
  fuelleConfTage(e.conf||null);
  if(e.conf){ $("cGew").value=e.conf.gew||""; $("cBauch").value=e.conf.bauch||"";
    setS("cStress",e.conf.stress); $("cSonst").value=e.conf.sonst||""; }
  recalcScores();
}
