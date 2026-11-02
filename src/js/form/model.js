/* Uebersetzung zwischen Formular und gespeichertem Wochenobjekt.
   readForm() liest die Oberflaeche in ein einfaches Objekt, fillForm() spielt
   ein Objekt zurueck ins Formular. Die beiden muessen zueinander passen —
   wer ein Feld ergaenzt, fasst beide an. Das gespeicherte Objekt ist zugleich
   das Datenformat in der Datenbank und im JSON-Export. */

import { state } from '../state.js';
import { $ } from '../util/dom.js';
import { weekNumber } from '../util/date.js';
import {
  KERN, GLOWZIEL, MASSE, MASSE_ALT, MONTH, EXPO_TEXT_ALT
} from '../schema.js';
import { sVal, setS, checked } from '../ui/controls.js';
import { wochenfragenOffen, fragebogenTag } from '../ui/weekly.js';
import { ALK_MARKE } from '../storage/migrate.js';
import {
  recalcScores, readExpo, ableiten, fuelleExpo, setLegacyDose, getLegacyDose, KRAFT_UEBUNG,
  readConfTage, ableitenConf, fuelleConfTage, setLegacyConf, getLegacyConf,
  readZufuhr, ableitenZufuhr, ableitenSupp, fuelleZufuhr,
  mergeHeute, tagesMittel, setTagesSaetze, startWhoTag, readNotizen, ableitenNotizen, fuelleNotizen
} from './build.js';

export function readForm(){
  var e={week:state.weekKey, nr:weekNumber(state.weekKey), saved:new Date().toISOString(),
    exp:{}, kern:{}, who:[], conf:{}, text:{}};
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
    e.dose={glow:a.n_glow, kiss:a.n_kiss, pt:a.n_pt, dhea:a.n_dhea,
            dGlow:a.d_glow, dKiss:a.d_kiss, dPt:a.d_pt, dDhea:a.d_dhea, ghk:state.cfg.ghk,
            tirz:a.tirz, tage:g.tage};
    /* Selbst angelegte Stoffe gesammelt, mit Name und Einheit je Stoff. */
    if(Object.keys(a.extra).length) e.dose.extra=a.extra;
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
  e.dose.stellen=nw.stellen;
  if(!nz.leer) e.dose.notizen=nz.tage;
  /* Entfallene Notizspalten (sonstige Medikamente, Abweichungen): was schon
     erfasst ist, bleibt mit Tagesreihe und Wochentext stehen. */
  var altD=(state.weeks[state.weekKey]||{}).dose||{};
  EXPO_TEXT_ALT.forEach(function(k){
    if(altD[k]) e.dose[k]=altD[k];
    var reihe=altD.notizen&&altD.notizen[k];
    if(reihe&&reihe.some(function(v){return v;})){
      e.dose.notizen=e.dose.notizen||{start:altD.notizen.start};
      if(e.dose.notizen.start===altD.notizen.start) e.dose.notizen[k]=reihe.slice();
    }
  });
  /* Alkohol steht als eigene Spalte im Raster, Kreatin und Protein als
     Supplemente bei den Substanzen. Ihre Wochenwerte behalten die gewohnte
     Form: Kreatin als Summe am Dose-Objekt, Protein und Alkohol unter conf
     (siehe unten), wo sie immer schon standen. */
  var zf=readZufuhr(), zw=ableitenZufuhr(zf.tage);
  var sp=ableitenSupp(g.tage);
  if(!zf.leer) e.dose.zufuhr=zf.tage;
  e.dose.kreatin=sp.kreatin; e.dose.kreatinTage=sp.kreatinTage;
  KERN.forEach(function(x){ e.kern[x.k]=sVal(x.k); });
  e.glow={ort:$("gGelenkOrt").value.trim()};
  GLOWZIEL.forEach(function(x){ e.glow[x.k]=sVal(x.k); });
  /* Entfallene Masse bleiben am Eintrag stehen, statt beim naechsten
     Speichern still zu verschwinden. */
  e.masse={}; MASSE.forEach(function(x){ e.masse[x.k]=$(x.k).value; });
  var altM=(state.weeks[state.weekKey]||{}).masse||{};
  MASSE_ALT.forEach(function(k){ if(altM[k]) e.masse[k]=altM[k]; });
  /* Eine Uebung, zwei Zahlen. Die Liste bleibt eine Liste, damit
     kraftIndex() und die CSV unveraendert weiterrechnen. */
  e.kraft=[{name:KRAFT_UEBUNG, kg:$("kw0").value, reps:$("kr0").value}];
  /* WHO-5 wird taeglich erfasst: der Antwortsatz des gewaehlten Tags wird zu
     den bereits gespeicherten Tagen dieser Woche gelegt, e.who traegt das Mittel je
     Frage. Ein leerer Bogen loescht keinen Tag. Der IIEF-5 ist eine
     Wochenfrage mit einem Antwortsatz fuer die letzten sieben Tage. */
  e.whoTage=mergeHeute("who");
  e.who=tagesMittel(e.whoTage);
  /* Training, Schlaf, Protein und Alkohol kommen aus dem Tagesraster; Summe
     bei Training und Alkohol, Durchschnitt bei Schlaf und Protein. Alkohol
     zaehlt in Litern. Wie bei der Exposition bleiben die alten
     Wochenwerte stehen, solange kein Tag eingetragen ist. */
  var c=readConfTage(), legacyC=getLegacyConf();
  var cw=(c.leer&&legacyC)
    ? {train:legacyC.train||"", schlaf:legacyC.schlaf||""}
    : ableitenConf(c.tage);
  if(!sp.protein&&legacyC) sp.protein=legacyC.protein||"";
  if(zf.leer&&legacyC) zw.alk=legacyC.alk||"";
  e.conf={train:cw.train, schlaf:cw.schlaf, alk:zw.alk, protein:sp.protein,
          gew:$("cGew").value, bauch:$("cBauch").value,
          stress:sVal("cStress"), sonst:$("cSonst").value.trim(), flags:[]};
  if(!c.leer) e.conf.tage=c.tage;
  /* Protein und Alkohol mit Vortagsbezug aus der Zeit vor der Zufuhrspalte:
     der Wert der ersten Zeile gehoert zum letzten Tag der Vorwoche und passt
     in kein Feld dieser Woche. Die alten Reihen bleiben deshalb einmal
     unveraendert erhalten. */
  var altW=state.weeks[state.weekKey], altT=altW&&altW.conf&&altW.conf.tage;
  if(altW&&altW.conf&&altW.conf.vortagAlt) e.conf.vortagAlt=altW.conf.vortagAlt;
  else if(altT&&(altT.protein||altT.alk)&&!(altW.dose&&altW.dose.zufuhr))
    e.conf.vortagAlt={start:altT.start, protein:altT.protein||[], alk:altT.alk||[]};
  e.month=[]; MONTH.forEach(function(m){ if(checked(m.k)) e.month.push(m.k); });
  /* Die beiden Freitextfragen sind entfallen; bereits erfasste Antworten
     bleiben im gespeicherten Objekt und in CSV und Datenblock lesbar. */
  var alt=state.weeks[state.weekKey];
  if(alt&&alt.text&&(alt.text.anders||alt.text.ohnehin)) e.text=alt.text;
  /* Der ausfuehrliche Fragebogen haelt fest, fuer welchen Tag er gilt — er
     haengt nicht mehr am Erfassungstag, und nachgetragen wird er fuer den
     Tag, den die Tagesleiste zeigt, nicht fuer heute. */
  /* Alkohol steht in Litern — die Marke verhindert, dass der Eintrag beim
     naechsten Laden noch einmal halbiert wird (storage/migrate.js). */
  e[ALK_MARKE]=1;
  if(wochenfragenOffen()) e.bogenTag=fragebogenTag();
  else behalteWochenfragen(e, alt);
  return e;
}

/* Solange die Wochenfragen geschlossen sind, stehen ihre Regler auf den
   Vorgaben (meist 5) — gespeichert saehe das aus wie eine Antwort. Das
   taegliche Speichern uebernimmt deshalb fuer alles Woechentliche den
   zuletzt gespeicherten Stand dieser Woche, oder laesst es ganz weg. */
var WOCHEN_FELDER=["exp","kern","glow","masse","kraft","month","bogenTag"];
var WOCHEN_CONF=["gew","bauch","sonst"];
function behalteWochenfragen(e, alt){
  alt=alt||{};
  WOCHEN_FELDER.forEach(function(k){
    if(alt[k]===undefined) delete e[k]; else e[k]=JSON.parse(JSON.stringify(alt[k]));
  });
  WOCHEN_CONF.forEach(function(k){
    if(alt.conf&&alt.conf[k]!==undefined) e.conf[k]=JSON.parse(JSON.stringify(alt.conf[k]));
    else delete e.conf[k];
  });
}
/* Ein einzelner Antwortsatz aus der Zeit vor der Tagesumstellung wird dem
   Erfassungstag der Woche zugeschlagen — irgendein Tag muss er sein, und der
   Abschlusstag ist der ehrlichste Kandidat. */
function ganzerTagAls(woche,satz){ var m={}; m[woche]=satz.slice(); return m; }


export function fillForm(e){
  if(!e) return;
  setS("erwartung", e.exp&&e.exp.erwartung);
  /* Erst den Bestandsschutz setzen, dann das Raster fuellen — fuelleExpo()
     aktualisiert Zusammenfassung, Kupferlast und PT-Karte gleich mit. */
  setLegacyDose(e.dose&&!e.dose.tage?e.dose:null);
  fuelleExpo(e.dose||null, e.conf||null);
  fuelleNotizen(e.dose||null);
  fuelleZufuhr(e.dose||null, e.conf||null);
  KERN.forEach(function(x){ setS(x.k, e.kern&&e.kern[x.k]); });
  GLOWZIEL.forEach(function(x){ setS(x.k, e.glow&&e.glow[x.k]); });
  $("gGelenkOrt").value=(e.glow&&e.glow.ort)||"";
  MASSE.forEach(function(x){ $(x.k).value=(e.masse&&e.masse[x.k])||""; });
  var kf=(e.kraft&&e.kraft[0])||{};
  $("kw0").value=kf.kg||""; $("kr0").value=kf.reps||"";
  /* WHO-5: die Segmente zeigen den heutigen Tag — den gespeicherten Satz von
     heute, sonst leer. Wochen aus der Zeit vor der Tagesumstellung bringen
     ihren einen Satz als Stand des Erfassungstags mit. */
  var wt=e.whoTage||(Array.isArray(e.who)&&e.who.length===5&&e.who.every(function(v){return v!==null&&v!==undefined;})
    ?ganzerTagAls(e.week,e.who):{});
  setTagesSaetze(wt);
  startWhoTag();
  document.querySelectorAll("[data-c]").forEach(function(i){
    var on=e.month&&e.month.indexOf(i.dataset.c)>=0;
    i.checked=!!on; i.parentElement.dataset.on=on?"1":"0";
  });
  setLegacyConf(e.conf&&!e.conf.tage?e.conf:null);
  fuelleConfTage(e.conf||null);
  /* Fehlende Bloecke leeren die Felder, statt den Stand der zuvor
     angezeigten Woche stehen zu lassen. */
  var cf=e.conf||{};
  $("cGew").value=cf.gew||""; $("cBauch").value=cf.bauch||"";
  $("cSonst").value=cf.sonst||"";
  recalcScores();
}
