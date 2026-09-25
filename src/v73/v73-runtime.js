/* Journalier V73 — moteur PIA annuel opérationnel
 * Local-first : aucune donnée n'est envoyée par ce module.
 * Les propositions restent des propositions : la validation est une action du professionnel.
 */
const V73 = {
  version: "73.0.0",
  referential: null,
  state: null
};

const THEMES = [
  {id:"comprehension_consignes", label:"Compréhension des consignes", aspect:"Cognitif (pédagogique)",
   re:/\b(consigne|instruction|comprend|compréhension|reformul|étapes|étape)\b/i},
  {id:"organisation", label:"Organisation et fonctions exécutives", aspect:"Cognitif (pédagogique)",
   re:/\b(organisation|organis|planif|planifie|étapes|ordre|méthode|procédure|procédur|check.?list|matériel)\b/i},
  {id:"raisonnement_procedure", label:"Raisonnement et procédures", aspect:"Cognitif (pédagogique)",
   re:/\b(raisonnement|raisonne|procédure|méthode|stratég|résolution|problème|calcul|opération|équation|algèbre)\b/i},
  {id:"vocabulaire_communication", label:"Communication et vocabulaire", aspect:"Communication",
   re:/\b(vocabulaire|terme|mots|oral|expression|explique|expliquer|reformul|lexique|langage)\b/i},
  {id:"attention_engagement", label:"Attention et engagement", aspect:"Comportemental et affectif",
   re:/\b(attention|concentration|distract|motivation|engagement|persév|persévér|frustr|décour|refus|particip)\b/i},
  {id:"autonomie", label:"Autonomie", aspect:"Lié à l’autonomie",
   re:/\b(autonom|seul|seule|relance|aide|demande.*aide|vérif|verification|vérification|initiative|commence|termine)\b/i},
  {id:"transfert", label:"Transfert / réinvestissement", aspect:"Cognitif (pédagogique)",
   re:/\b(transfert|réinvest|réutil|nouvelle situation|situation différente|ailleurs)\b/i},
  {id:"geste_graphique", label:"Geste graphique et manipulation", aspect:"Physique et psychomoteur",
   re:/\b(geste graphique|écriture|écrit|tracé|géométr|règle|compas|équerre|manipul|outil)\b/i},
  {id:"fatigue", label:"Fatigue / endurance dans la tâche", aspect:"Physique et psychomoteur",
   re:/\b(fatigue|fatigu|endurance|ralent|lent|pause)\b/i},
  {id:"mathematiques", label:"Apprentissages mathématiques", aspect:"Cognitif (pédagogique)",
   re:/\b(math|calcul|multiplication|division|fraction|nombre|équation|algèbre|géométr|angle|périmètre|proportion)\b/i}
];

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function uid(prefix="v73"){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
function norm(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
function dateOnly(s){return String(s||"").slice(0,10);}
function safeArray(x){return Array.isArray(x)?x:[];}
function getData(){
  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.()) throw new Error("Connectez-vous à Microsoft avant d'utiliser le PIA V73.");
  return {students:ds.getStudents(), sessions:ds.getSessions(), state:ds.getState()};
}
function studentSessions(student, sessions, until){
  return sessions.filter(s=>s?.type==="SEANCE" && s?.identification?.eleve===student.nom && (!until || dateOnly(s.identification.date)<=until))
    .sort((a,b)=>dateOnly(a.identification?.date).localeCompare(dateOnly(b.identification?.date)));
}
function sessionText(s){
  const q2=s.q2||{},q3=s.q3||{},q4=s.q4||{},q5=s.q5||{},q6=s.q6||{};
  const parts=[];
  safeArray(q2.observations).forEach(x=>parts.push(`${x.categorie||""} ${x.observation||""}`));
  parts.push(q2.precision,q3.precision,q4.precision,q5.precision,q6.precision,q6.objectif);
  safeArray(q3.indicateurs).forEach(x=>parts.push(x.texte));
  safeArray(q4.types).forEach(x=>parts.push(x));
  safeArray(q6.actions).forEach(x=>parts.push(x));
  return parts.filter(Boolean).join(" ");
}
function recurrenceMarker(text){return /\b(encore|toujours|de nouveau|à nouveau|reste nécessaire|continue|continue à|faut encore|doit encore|plusieurs fois)\b/i.test(text||"");}
function q5Positive(s){
  const t=norm(`${s?.q5?.statut||""} ${s?.q5?.precision||""}`);
  return /\b(autonome|seul|réussit|reussit|sans aide|transf|réinvest|spontan|acquis|mieux|moins d'erreurs)\b/.test(t);
}
function q5Help(s){
  const t=norm(`${s?.q2?.precision||""} ${s?.q5?.precision||""} ${s?.q4?.precision||""}`);
  return /\b(relance|aide|guidage|support|avec l'aide|doit etre aide|necessite)\b/.test(t);
}
function extractUnits(s){
  const text=sessionText(s), units=[];
  THEMES.forEach(theme=>{
    const matches=text.match(theme.re);
    if(!matches)return;
    const explicitQ2=s.q2?.observations?.some(x=>theme.re.test(`${x.observation||""}`));
    const explicitQ5=theme.id==="autonomie" && (q5Help(s)||q5Positive(s));
    const structured=Boolean(explicitQ2||explicitQ5||safeArray(s.q3?.indicateurs).some(x=>theme.re.test(x.texte||"")));
    const relations={
      PORTE_SUR:theme.label, CONTEXTE:s.contexte?.matiere||"",
      DIFFICULTE: structured ? text : "", RESSOURCE:q5Positive(s) ? text : "",
      AIDE:q5Help(s) ? text : "", EVOLUTION:q5Positive(s)||recurrenceMarker(text) ? text : ""
    };
    units.push({
      id:uid("unit"),themeId:theme.id,theme:theme.label,aspect:theme.aspect,
      date:dateOnly(s.identification?.date),sessionId:String(s.id),
      matiere:s.contexte?.matiere||"", niveau:s.contexte?.niveau||"",
      structured, text, relations,
      source:{q2:Boolean(s.q2?.observations?.length||s.q2?.precision),q3:Boolean(s.q3?.indicateurs?.length||s.q3?.precision),q4:Boolean(s.q4?.types?.length||s.q4?.precision),q5:Boolean(s.q5?.statut||s.q5?.precision),q6:Boolean(s.q6?.actions?.length||s.q6?.precision)}
    });
  });
  return units;
}
function getConvergenceConfig(){
  const c=V73.referential?.convergence||{};
  const thresholds=c.seuils||{};
  return {
    signalMinSessions:Number(thresholds.signal_min_sessions_distinctes)||2,
    trendMinSessions:Number(thresholds.tendance_min_sessions_distinctes)||3,
    proposalMinSources:Number(thresholds.proposition_exception_intra_session?.minimum_sources_q_distinctes)||2
  };
}
function compareUnits(units){
  const groups={};
  units.forEach(u=>{(groups[u.themeId]??=[]).push(u);});
  const cfg=getConvergenceConfig();
  return Object.values(groups).map(arr=>{
    const dates=[...new Set(arr.map(x=>x.date).filter(Boolean))].sort();
    const subjects=[...new Set(arr.map(x=>norm(x.matiere)).filter(Boolean))];
    const sessionIds=[...new Set(arr.map(x=>x.sessionId).filter(Boolean))];
    const sourceKeys=[...new Set(arr.flatMap(x=>Object.entries(x.source).filter(([,v])=>v).map(([k])=>k)))];
    const sourceCount=sourceKeys.length;
    const recurrence=arr.length;
    const marker=arr.filter(x=>recurrenceMarker(x.text)).length;
    const positive=arr.filter(x=>q5Positive({q5:{precision:x.text}})).length;
    const comparable=subjects.length<=2;
    const semanticStrong=arr.filter(x=>Object.values(x.relations).filter(Boolean).length>=3 && Boolean(x.matiere||x.niveau)).length;
    const localSignal=arr.length===1 && (marker>=1 || semanticStrong>=1);
    let state="OBSERVATION";
    if(sessionIds.length>=cfg.signalMinSessions || localSignal) state="SIGNAL";
    if(sessionIds.length>=cfg.trendMinSessions && dates.length>=2 && comparable) state="TENDANCE";
    if(state==="TENDANCE" && positive>0 && positive<sessionIds.length) state="TENDANCE_QUALIFIEE";
    const multiSourceProposal=sessionIds.length===1 && sourceCount>=cfg.proposalMinSources && semanticStrong>=1 && comparable;
    if(((sessionIds.length>=cfg.trendMinSessions && dates.length>=2 && sourceCount>=2 && comparable) || multiSourceProposal) && state!=="AUCUNE_CONCLUSION_PIA") state="PROPOSITION";
    const counterEvidence=positive>0 && positive<sessionIds.length;
    return {
      themeId:arr[0].themeId,theme:arr[0].theme,aspect:arr[0].aspect,units:arr,
      recurrence,sessionCount:sessionIds.length,dates,subjects,sourceCount,sourceKeys,
      comparable,positive,state,counterEvidence,localSignal,
      justification:{recurrence:`${sessionIds.length} séance(s) distincte(s)`,comparability:comparable?"FORT":"FAIBLE",sources:sourceKeys,localSignal}
    };
  });
}

function proposalText(g){
  const map={
    autonomie:`Renforcer l’autonomie dans ${g.theme.toLowerCase()}, en ajustant progressivement les relances et les supports selon la situation.`,
    comprehension_consignes:`Soutenir la compréhension et la reformulation des consignes, avec vérification de la compréhension lorsque nécessaire.`,
    organisation:`Structurer les étapes de travail et les repères d’organisation afin de favoriser une réalisation plus autonome.`,
    raisonnement_procedure:`Consolider les procédures et stratégies de résolution dans les situations où une aide reste nécessaire.`,
    vocabulaire_communication:`Soutenir l’accès au vocabulaire et la reformulation des informations nécessaires à la tâche.`,
    attention_engagement:`Favoriser le maintien de l’engagement et de l’attention dans les situations où une variabilité est observée.`,
    transfert:`Favoriser le réinvestissement des stratégies dans des situations comparables puis progressivement différentes.`,
    geste_graphique:`Adapter ou soutenir la réalisation graphique et la manipulation des outils lorsque la situation le nécessite.`,
    fatigue:`Observer et aménager l’endurance dans la tâche lorsque la fatigue est documentée.`,
    mathematiques:`Consolider les apprentissages mathématiques ciblés dans les situations documentées par les séances.`
  };
  return map[g.themeId]||`Poursuivre l’accompagnement autour de ${g.theme.toLowerCase()} selon les besoins documentés.`;
}
function parsePreviousObjectives(student,existing){
  const validated=safeArray(existing?.meeting1?.objectivesValidated);
  if(validated.length) return validated.map(x=>typeof x==='string'?{formulation:x,status:"VALIDEE",source:"PIA_PRECEDENT"}:x);
  const raw=String(existing?.sourceContinuity?.content||student?.pia||"").trim();
  if(!raw)return [];
  return raw.split(/\n|;|•/).map(x=>x.trim()).filter(Boolean).map(x=>({formulation:x,status:"EXISTANT_A_REEVALUER",source:"PIA_PRECEDENT"}));
}
function buildPIA(student,sessions,until,existing){
  const logs=studentSessions(student,sessions,until);
  const units=logs.flatMap(extractUnits);
  const groups=compareUnits(units);
  const aspects=["Physique et psychomoteur","Lié à l’autonomie","Comportemental et affectif","Communication","Cognitif (pédagogique)"];
  const sections=aspects.map(aspect=>{
    const gs=groups.filter(g=>g.aspect===aspect);
    const difficulties=gs.filter(g=>["SIGNAL","TENDANCE","TENDANCE_QUALIFIEE","PROPOSITION"].includes(g.state)).slice(0,6);
    const resources=gs.filter(g=>g.positive>0).slice(0,6);
    return {aspect,ressources:resources.map(g=>g.theme),difficultes:difficulties.map(g=>`${g.theme} — ${g.sessionCount} séance(s) distincte(s) sur ${g.dates.length} date(s)`),objectifs:[]};
  });
  const proposals=groups.filter(g=>g.state==="PROPOSITION").map(g=>({
    id:uid("prop"),theme:g.theme,themeId:g.themeId,aspect:g.aspect,state:"PROPOSITION",
    formulation:proposalText(g),evidence:g.units.map(u=>({sessionId:u.sessionId,date:u.date,matiere:u.matiere})),
    counterEvidence:g.counterEvidence,recurrence:g.recurrence,sessionCount:g.sessionCount,dates:g.dates,
    convergence:g.justification
  }));
  const amenagementMap=new Map();
  logs.forEach(s=>{
    const raw=[...safeArray(s.q4?.types),s.q4?.precision,...safeArray(s.q6?.actions),s.q6?.precision].filter(Boolean).join(" ");
    const t=norm(raw); if(!t)return;
    const items=[];
    if(/consigne|reformul|etape|procedure|support visuel|visuel/.test(t))items.push({type:"P",texte:"Adapter / expliciter la consigne et les étapes lorsque cela est nécessaire."});
    if(/temps|relance|organisation|routine|place|groupe|individuel/.test(t))items.push({type:"O",texte:"Structurer l’organisation de la tâche et ajuster les modalités d’accompagnement selon la situation."});
    if(/ipad|ordinateur|outil|calculatrice|regle|compas|equerre|materiel/.test(t))items.push({type:"M",texte:"Utiliser le matériel ou l’outil explicitement renseigné dans les séances lorsque cela est pertinent."});
    items.forEach(x=>amenagementMap.set(x.type,x));
  });
  const amenagements=[...amenagementMap.values()].map(x=>({...x,state:"PROPOSITION",evidenceCount:logs.length}));
  const previousObjectives=parsePreviousObjectives(student,existing);
  const previousContent=String(existing?.sourceContinuity?.content||student?.pia||"").trim();
  return {
    schemaVersion:"73.0.0",type:"PIA_ANNUEL",id:existing?.id||uid("pia"),studentId:student.studentId,
    eleve:student.nom,classe:student.classe||"",ecole:student.ecole||"",
    schoolYear:`${new Date().getFullYear()}-${new Date().getFullYear()+1}`,
    generatedAt:new Date().toISOString(),until:until||"",lifecycle:existing?.lifecycle||"EN_CONSTRUCTION",
    sourceContinuity:previousContent?{present:true,content:previousContent,role:"SOURCE_DE_CONTINUITE",fileName:student.piaFileName||""}:{present:false,content:"",role:"SOURCE_DE_CONTINUITE",fileName:""},
    sessionsAnalysed:logs.length,sections,
    meeting1:{
      status:existing?.meeting1?.status||"A_REEVALUER",
      objectivesPrevious:existing?.meeting1?.objectivesPrevious||previousObjectives,
      proposals,objectivesValidated:existing?.meeting1?.objectivesValidated||[],
      validatedAt:existing?.meeting1?.validatedAt||"",notes:existing?.meeting1?.notes||""
    },
    meeting2:existing?.meeting2||{status:"A_VENIR",evaluation:[],objectivesToContinue:[],perspectives:[]},
    amenagements,propositions:proposals,
    traceability:{sessionIds:logs.map(s=>String(s.id)),states:groups.map(g=>({theme:g.theme,themeId:g.themeId,state:g.state,recurrence:g.recurrence,sessionCount:g.sessionCount,dates:g.dates,comparable:g.comparable,counterEvidence:g.counterEvidence,localSignal:g.localSignal,sourceKeys:g.sourceKeys})),
      rule:"Une proposition n'est jamais une validation. Les relations séance sont documentaires et non causales. Les objectifs du PIA précédent sont une source de continuité à réévaluer."}
  };
}
function evaluateMeeting2(pia,existing){
  const validated=safeArray(pia.meeting1?.objectivesValidated);
  const previousMeetingDate=existing?.meeting1?.validatedAt||pia.meeting1?.validatedAt||"";
  const start=previousMeetingDate?dateOnly(previousMeetingDate):"";
  const postSessionIds=new Set((pia.traceability?.sessionIds||[]));
  return validated.map(obj=>{
    const formulation=typeof obj==='string'?obj:obj.formulation||"";
    const themeId=typeof obj==='object'?obj.themeId||"":"";
    const related=pia.propositions.filter(p=>(themeId&&p.themeId===themeId)||norm(p.formulation).includes(norm(formulation).slice(0,50)));
    return {objectif:formulation,themeId,evidence:related.flatMap(p=>p.evidence||[]).filter(e=>!start||dateOnly(e.date)>start),state:"A_DISCUSSER",source:"SEANCES_POST_REUNION_1",note:"Évaluation à confirmer en réunion 2 par le professionnel et l'équipe."};
  });
}

function htmlPIA(pia){
  const sec=pia.sections.map(s=>`<section><h2>${esc(s.aspect)}</h2><h3>Ressources</h3><p>${s.ressources.length?s.ressources.map(esc).join(" · "):"À compléter."}</p><h3>Difficultés</h3><ul>${s.difficultes.length?s.difficultes.map(x=>`<li>${esc(x)}</li>`).join(""):"<li>À compléter à partir des données disponibles.</li>"}</ul><h3>Objectifs à poursuivre</h3><ul>${s.objectifs.length?s.objectifs.map(x=>`<li>${esc(x)}</li>`):"<li>Les propositions ci-dessous doivent être discutées et validées.</li>"}</ul></section>`).join("");
  const props=pia.propositions.map((p,i)=>`<div class="proposal"><b>${i+1}. ${esc(p.theme)}</b><p>${esc(p.formulation)}</p><small>${p.recurrence} occurrence(s) · ${p.dates.length} date(s) · état : PROPOSITION${p.counterEvidence?" · contre-évidence présente":""}</small></div>`).join("");
  const prev=pia.sourceContinuity.present?`<section><h2>Continuité avec le PIA précédent</h2><p>${esc(pia.sourceContinuity.content)}</p></section>`:"";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>PIA annuel — ${esc(pia.eleve)}</title><style>body{font:14px Arial,sans-serif;max-width:900px;margin:40px auto;color:#172033;line-height:1.55}h1{font-size:24px}h2{border-bottom:1px solid #ddd;padding-bottom:6px}h3{font-size:15px}.proposal{border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0;background:#fafafa}.meta{color:#5b6472}.notice{padding:12px;border-left:4px solid #2563eb;background:#eff6ff}</style></head><body><h1>Projet de PIA annuel — ${esc(pia.eleve)}</h1><p class="meta">${esc(pia.classe)} · ${esc(pia.ecole)} · ${esc(pia.schoolYear)}</p><div class="notice">Document de travail : les objectifs proposés restent à valider par le professionnel et l'équipe. Les rapprochements entre Q2–Q6 sont documentaires et ne constituent pas des liens de causalité.</div>${prev}${sec}<section><h2>Objectifs visés pour la période et critères d’évaluation</h2>${props||"<p>Aucune proposition suffisamment convergente à ce stade.</p>"}</section><section><h2>Ressources / moyens complémentaires et aménagements</h2><ul>${pia.amenagements?.length?pia.amenagements.map(a=>`<li><b>${esc(a.type)}</b> — ${esc(a.texte)} <small>(proposition à valider)</small></li>`).join(""):"<li>À compléter sur base des aménagements effectivement documentés.</li>"}</ul></section><section><h2>Retours des acteurs / réunion</h2><p>À compléter lors de la réunion : parents, école/direction/équipe, élève, PMS, agent d’intégration et autres intervenants.</p></section><section><h2>Réunion 1 — Décembre</h2><p>État : ${esc(pia.meeting1.status)}</p><p>Les objectifs existants peuvent être maintenus, reformulés, ajustés, remplacés ou complétés lors de la réunion.</p></section><section><h2>Réunion 2 — Fin d’année</h2><p>Évaluation à compléter sur base des séances postérieures à la réunion 1.</p></section></body></html>`;
}
function download(name,content,type="application/json"){
  const blob=new Blob([content],{type}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function render(pia){
  const box=document.getElementById("v73-pia-result"); if(!box)return;
  box.innerHTML=`<div class="v73-summary"><b>PIA V73 prêt</b><span>${pia.sessionsAnalysed} séance(s) analysée(s)</span><span>${pia.propositions.length} proposition(s)</span><span>Cycle : ${esc(pia.meeting1.status)}</span></div>
  <div class="v73-notice">Les objectifs existants sont conservés comme continuité. Les nouvelles formulations sont des <b>PROPOSITIONS</b> tant qu'elles ne sont pas validées.</div>
  ${pia.propositions.length?`<div class="v73-proposals">${pia.propositions.map((p,i)=>`<label class="v73-prop"><input type="checkbox" data-v73-prop="${i}"><span><b>${esc(p.theme)}</b><br>${esc(p.formulation)}<small>${p.recurrence} occurrence(s), ${p.dates.length} date(s)${p.counterEvidence?" · contre-évidence visible":""}</small></span></label>`).join("")}</div>`:"<p>Aucune convergence suffisante pour formuler une proposition PIA. Les observations restent disponibles dans les séances.</p>"}
  <div class="v73-actions"><button id="v73-validate">Valider les propositions cochées</button><button id="v73-json">Exporter le PIA professionnel (.json)</button><button id="v73-html">Exporter le PIA imprimable (.html)</button><button id="v73-deid">Exporter le modèle dé-identifié (.json)</button></div>`;
  box.querySelector("#v73-validate").onclick=()=>{
    const chosen=[...box.querySelectorAll("[data-v73-prop]:checked")].map(x=>pia.propositions[Number(x.dataset.v73Prop)]?.formulation).filter(Boolean);
    pia.meeting1.objectivesValidated=[...(pia.meeting1.objectivesValidated||[]),...chosen.map((formulation)=>{const p=pia.propositions.find(x=>x.formulation===formulation);return {id:p?.id||uid("obj"),themeId:p?.themeId||"",theme:p?.theme||"",formulation,status:"VALIDEE",validatedAt:new Date().toISOString()};})];
    pia.meeting1.validatedAt=new Date().toISOString();
    pia.lifecycle="ACTIF"; pia.meeting1.status="VALIDÉ";
    savePia(pia,true).then(()=>render(pia));
  };
  box.querySelector("#v73-json").onclick=()=>download(`PIA_${pia.eleve.replace(/[^a-z0-9_-]+/gi,"_")}_V73.json`,JSON.stringify(pia,null,2));
  box.querySelector("#v73-html").onclick=()=>download(`PIA_${pia.eleve.replace(/[^a-z0-9_-]+/gi,"_")}_V73.html`,htmlPIA(pia),"text/html;charset=utf-8");
  box.querySelector("#v73-deid").onclick=()=>{
    const d=JSON.parse(JSON.stringify(pia)); delete d.eleve; delete d.studentId; delete d.ecole; delete d.classe;
    d.type="PIA_MODELE_DEIDENTIFIE"; d.sourceContinuity={present:false,content:"",role:"SOURCE_DE_CONTINUITE"};
    d.traceability={states:d.traceability.states,rule:d.traceability.rule};
    download("PIA_modele_deidentifie_V73.json",JSON.stringify(d,null,2));
  };
}
async function savePia(pia,cloud=true){
  const ds=window.JournalierDataStore; const st=ds.getState(); st.meta??={}; st.meta.piaRecords??={}; st.meta.piaRecords[pia.studentId]=pia;
  await ds.persistState(st);
  if(cloud && window.JournalierCloud?.savePia) {
    try{await window.JournalierCloud.savePia(pia); window.showAppToast?.("✓ PIA enregistré localement et dans OneDrive.","success",4000);}
    catch(e){window.showAppToast?.("✓ PIA enregistré localement. OneDrive sera réessayé depuis la synchronisation.","info",4500);}
  }
}
async function loadRef(){
  try{V73.referential=await fetch("./referentiel_pia_v73_0_3.json",{cache:"no-store"}).then(r=>r.ok?r.json():null);}catch(_){V73.referential=null;}
}
function addUI(){
  const host=document.querySelector("#view-reports .card");
  if(!host || document.getElementById("v73-pia-card"))return;
  const card=document.createElement("div"); card.id="v73-pia-card"; card.className="card";
  card.innerHTML=`<div class="page-kicker">PIA annuel V73</div><h2 class="page-title" style="font-size:1.15rem">Construire / réévaluer le PIA</h2>
  <div class="report-intro">Le PIA est annuel. Les séances alimentent les éléments de preuve. La réunion 1 (décembre) réévalue les objectifs existants ou permet de co-construire un premier PIA ; la réunion 2 évalue la trajectoire en fin d’année.</div>
  <div class="grid-2"><div><label>Élève</label><select id="v73-pia-student"></select></div><div><label>Date de référence</label><input id="v73-pia-date" type="date"></div></div>
  <div class="v73-actions"><button id="v73-build" class="btn-primary">Générer le projet de PIA</button><button id="v73-meeting2" class="btn-secondary">Préparer la réévaluation fin d’année</button></div>
  <div id="v73-pia-result" class="v73-result"></div>`;
  host.parentElement.insertBefore(card,host.nextSibling);
  refreshStudents();
  document.getElementById("v73-build").onclick=()=>run(false);
  document.getElementById("v73-meeting2").onclick=()=>run(true);
}
function refreshStudents(){
  const sel=document.getElementById("v73-pia-student"); if(!sel)return;
  let d; try{d=getData()}catch(_){return;}
  const current=sel.value; sel.innerHTML=d.students.map(s=>`<option value="${esc(s.studentId)}">${esc(s.nom)}</option>`).join("");
  if(current && [...sel.options].some(o=>o.value===current))sel.value=current;
  const date=document.getElementById("v73-pia-date"); if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
}
async function run(meeting2){
  try{
    const d=getData(); refreshStudents(); const sid=document.getElementById("v73-pia-student")?.value;
    const student=d.students.find(s=>String(s.studentId)===String(sid)); if(!student)throw new Error("Aucun élève sélectionné.");
    const until=document.getElementById("v73-pia-date")?.value||new Date().toISOString().slice(0,10);
    const existing=d.state.meta?.piaRecords?.[student.studentId]||null;
    const pia=buildPIA(student,d.sessions,until,existing);
    if(meeting2){
      pia.meeting2={status:"EN_REEVALUATION",evaluation:evaluateMeeting2(pia,existing),objectivesToContinue:pia.meeting1.objectivesValidated||[],perspectives:[]};
      pia.lifecycle="EN_REEVALUATION";
    }
    V73.state=pia; await savePia(pia,true); render(pia);
    window.showAppToast?.(`✓ ${meeting2?"Réévaluation":"Projet de PIA"} généré pour ${student.nom}.`,"success",4000);
  }catch(e){window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);}
}
window.JournalierV73={...V73,buildPIA,run,refreshStudents,loadRef};
const style=document.createElement("style");style.textContent=`
#v73-pia-card{margin-top:16px}.v73-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.v73-summary span,.v73-summary b{padding:6px 9px;border-radius:8px;background:#f1f5f9}.v73-notice{padding:11px;border-left:4px solid #2563eb;background:#eff6ff;border-radius:8px;margin:10px 0;font-size:.82rem}.v73-proposals{display:grid;gap:8px;margin:12px 0}.v73-prop{display:flex;gap:10px;padding:11px;border:1px solid #dbe3ef;border-radius:10px;background:#fff}.v73-prop small{display:block;color:#64748b;margin-top:5px}.v73-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v73-actions button{border:0;border-radius:9px;padding:9px 12px;cursor:pointer;background:#0a84ff;color:white}.v73-actions button.btn-secondary{background:#eef2f7;color:#172033}.v73-result{margin-top:14px}
`;document.head.appendChild(style);
(async()=>{await loadRef(); const boot=()=>{addUI();refreshStudents()}; if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();})();
