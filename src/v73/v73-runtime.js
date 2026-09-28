/* Journalier V73 — moteur PIA annuel opérationnel
 * Local-first : aucune donnée n'est envoyée par ce module.
 * Les propositions restent des propositions : la validation est une action du professionnel.
 */
const V73 = {
  version: "73.1.0",
  referential: null,
  state: null,
  ui: {
    piaDisplayStudentId: "",
    piaDisplayMode: "none", // none | draft | active | review
    piaDraftStudentId: "",
    piaDraftPersisted: false
  }
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
  const sid=String(student?.studentId||"");
  return sessions.filter(s=>{
    if(s?.type!=="SEANCE") return false;
    const sessionSid=String(s?.identification?.eleveId||"");
    const sameId=sid && sessionSid && sid===sessionSid;
    const sameName=!sameId && s?.identification?.eleve===student?.nom;
    return (sameId||sameName) && (!until || dateOnly(s.identification?.date)<=until);
  }).sort((a,b)=>dateOnly(a.identification?.date).localeCompare(dateOnly(b.identification?.date)));
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
  const previous=safeArray(existing?.meeting1?.objectivesPrevious);
  if(previous.length) return previous.map(x=>typeof x==='string'?{formulation:x,status:"EXISTANT_A_REEVALUER",source:"PIA_PRECEDENT"}:x);
  const extracted=existing?.sourceContinuity?.extracted||{};
  const imported=safeArray(extracted.objectives);
  if(imported.length) return imported.map(x=>({formulation:String(x),status:"EXISTANT_A_REEVALUER",source:"PIA_PRECEDENT"}));
  const legacy=String(existing?.sourceContinuity?.content||student?.pia||"").trim();
  if(!legacy)return [];
  return legacy.split(/\n|;|•/).map(x=>x.trim()).filter(Boolean).map(x=>({formulation:x,status:"EXISTANT_A_REEVALUER",source:"PIA_PRECEDENT_LEGACY"}));
}
function piaMeetingRecord(previous,type,status){
  const current=previous||{},participants=current.participants||{},feedback=current.feedback||{};
  return {
    ...current,type:current.type||type,status:current.status||status,source:"REUNION",
    date:current.date||"",context:current.context||"",
    participants:Object.fromEntries(PIA_MEETING_ACTORS.map(actor=>[actor.id,Boolean(participants[actor.id])])),
    feedback:Object.fromEntries(PIA_MEETING_ACTORS.map(actor=>[actor.id,String(feedback[actor.id]||"")])),
    decisions:current.decisions||"",objectivesModified:current.objectivesModified||"",
    means:current.means||"",adaptations:current.adaptations||"",
    information:current.information||"",notes:current.notes||""
  };
}
function continuityFromExisting(student,existing){
  const current=existing?.sourceContinuity;
  if(current?.present){
    const extracted=current.extracted||{};
    if(Object.keys(extracted).length) return {present:true,role:"SOURCE_DE_CONTINUITE",format:current.format||"",fileName:"",importedAt:current.importedAt||"",extracted:JSON.parse(JSON.stringify(extracted))};
    const raw=String(current.content||"").trim();
    if(raw)return {present:true,role:"SOURCE_DE_CONTINUITE",format:"legacy",fileName:"",importedAt:"",extracted:{objectives:raw.split(/\n|;|•/).map(x=>x.trim()).filter(Boolean)}};
  }
  const legacy=String(student?.pia||"").trim();
  if(!legacy) return {present:false,role:"SOURCE_DE_CONTINUITE",format:"",fileName:"",importedAt:"",extracted:{}};
  return {present:true,role:"SOURCE_DE_CONTINUITE",format:"legacy",fileName:"",importedAt:"",extracted:{objectives:legacy.split(/\n|;|•/).map(x=>x.trim()).filter(Boolean)}};
}
function piaSchoolYearBounds(startYear){
  const lastAugustDay=new Date(startYear,7,31);
  const lastAugustSunday=new Date(startYear,7,31-lastAugustDay.getDay());
  const start=new Date(lastAugustSunday);start.setDate(start.getDate()-6);
  const julyFirst=new Date(startYear+1,6,1),firstWeekMonday=new Date(julyFirst);
  firstWeekMonday.setDate(firstWeekMonday.getDate()-((julyFirst.getDay()+6)%7));
  const end=new Date(firstWeekMonday);end.setDate(end.getDate()+4);
  const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  return {schoolYear:`${startYear}-${startYear+1}`,start:iso(start),end:iso(end)};
}
function piaSchoolYear(dateValue){
  const value=String(dateValue||""),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)return "";
  const date=new Date(`${value}T12:00:00`),year=Number(match[1]);
  if(date.getFullYear()!==year||date.getMonth()+1!==Number(match[2])||date.getDate()!==Number(match[3]))return "";
  for(const startYear of [year-1,year]){
    const bounds=piaSchoolYearBounds(startYear);
    if(value>=bounds.start&&value<=bounds.end)return bounds.schoolYear;
  }
  return "";
}
function currentPIASchoolYearBounds(){
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const active=piaSchoolYear(today);if(active)return piaSchoolYearBounds(Number(active.slice(0,4)));
  for(const year of [now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1]){
    const bounds=piaSchoolYearBounds(year);if(today<bounds.start)return bounds;
  }
  return piaSchoolYearBounds(now.getFullYear());
}
function applySchoolYearDateLimits(){
  const bounds=currentPIASchoolYearBounds();
  document.querySelectorAll('input[type="date"]').forEach(input=>{input.min=bounds.start;input.max=bounds.end;});
}
function normalizePIALifecycle(pia){
  if(pia?.lifecycle==="FINALISE")return "FINALISE";
  if(pia?.lifecycle==="ACTIF"||["VALIDÉ","VALIDÉE"].includes(pia?.meeting1?.status))return "EN_VIGUEUR";
  return pia?.lifecycle||"EN_CONSTRUCTION";
}
function buildPIA(student,sessions,until,existing){
  const schoolYear=piaSchoolYear(until);
  if(!schoolYear)throw new Error("La date de référence doit appartenir à une année scolaire en cours.");
  const logs=studentSessions(student,sessions,until);
  const units=logs.flatMap(extractUnits);
  const groups=compareUnits(units);
  const aspects=["Physique et psychomoteur","Lié à l’autonomie","Comportemental et affectif","Communication","Cognitif (pédagogique)"];
  const previousSections=new Map(safeArray(existing?.sections).map(section=>[section.aspect,section]));
  const sections=aspects.map(aspect=>{
    const gs=groups.filter(g=>g.aspect===aspect);
    const difficulties=gs.filter(g=>["SIGNAL","TENDANCE","TENDANCE_QUALIFIEE","PROPOSITION"].includes(g.state)).slice(0,6);
    const resources=gs.filter(g=>g.positive>0).slice(0,6);
    const previous=previousSections.get(aspect)||{};
    const evolution=gs.filter(g=>g.dates.length).map(g=>`${g.theme} : ${g.sessionCount} séance(s) distincte(s), ${g.dates.length} date(s) documentée(s).`);
    return {
      ...previous,aspect,
      ressources:[...new Set([...safeArray(previous.ressources),...resources.map(g=>g.theme)])],
      difficultes:[...new Set([...safeArray(previous.difficultes),...difficulties.map(g=>`${g.theme} — ${g.sessionCount} séance(s) distincte(s) sur ${g.dates.length} date(s)`)])],
      objectifs:safeArray(previous.objectifs),
      criteres:safeArray(previous.criteres),
      moyens:safeArray(previous.moyens),
      evolution:[...new Set([...safeArray(previous.evolution),...evolution])]
    };
  });
  const previousProposals=safeArray(existing?.propositions);
  const previouslyValidated=safeArray(existing?.meeting1?.objectivesValidated);
  const proposals=groups.filter(g=>g.state==="PROPOSITION").map(g=>{
    const previous=previousProposals.find(item=>item.themeId===g.themeId);
    const wasValidated=previouslyValidated.some(item=>typeof item==="object"&&(item.themeId===g.themeId||item.formulation===previous?.formulation));
    return {
      id:previous?.id||uid("prop"),theme:g.theme,themeId:g.themeId,aspect:g.aspect,state:"PROPOSITION",
      decisionStatus:previous?.decisionStatus||(wasValidated?"VALIDEE":"A_EXAMINER"),formulation:previous?.formulation||proposalText(g),
      provenance:{source:"SEANCE",sessionIds:[...new Set(g.units.map(u=>u.sessionId))],sourceKeys:g.justification.sources||[]},
      evidence:g.units.map(u=>({sessionId:u.sessionId,date:u.date,matiere:u.matiere})),
      counterEvidence:g.counterEvidence,recurrence:g.recurrence,sessionCount:g.sessionCount,dates:g.dates,
      convergence:g.justification
    };
  });
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
  return {
    schemaVersion:"73.0.0",type:"PIA_ANNUEL",id:existing?.id||uid("pia"),studentId:student.studentId,
    eleve:student.nom,classe:student.classe||"",ecole:student.ecole||"",
    schoolYear,
    generatedAt:new Date().toISOString(),until:until||"",lifecycle:normalizePIALifecycle(existing),
    sourceContinuity:continuityFromExisting(student,existing),
    sessionsAnalysed:logs.length,sections,
    meeting1:{
      ...piaMeetingRecord(existing?.meeting1,"REUNION_1_DECEMBRE","A_REEVALUER"),
      objectivesPrevious:existing?.meeting1?.objectivesPrevious||previousObjectives,
      proposals,objectivesValidated:existing?.meeting1?.objectivesValidated||[],
      validatedAt:existing?.meeting1?.validatedAt||""
    },
    meeting2:{...piaMeetingRecord(existing?.meeting2,"REUNION_2_FIN_ANNEE","A_VENIR"),evaluation:safeArray(existing?.meeting2?.evaluation),objectivesToContinue:safeArray(existing?.meeting2?.objectivesToContinue),perspectives:safeArray(existing?.meeting2?.perspectives)},
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

const PIA_DEIDENTIFIED_DROP_KEYS=new Set(["id","studentid","sessionid","sessionids","ownerid","eleve","ecole","classe","schoolyear","generatedat","updatedat","createdat","importedat","validatedat","finalizedat","date","dates","until","filename","displayname","sourcecontinuity","evidence","feedback","notes","context","information","decisions","objectivesmodified"]);
function redactPIAValue(value,identifiers){
  if(typeof value==="string"){
    let text=value.replace(/\b\d{4}-\d{2}-\d{2}(?:[Tt][0-9:.+-]+Z?)?\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}\b/gi,"[date retirée]");
    identifiers.forEach(identifier=>{text=text.replace(new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),"[identité retirée]");});
    return text;
  }
  if(Array.isArray(value))return value.map(item=>redactPIAValue(item,identifiers));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!PIA_DEIDENTIFIED_DROP_KEYS.has(norm(key).replace(/[\s_-]/g,""))).map(([key,item])=>[key,redactPIAValue(item,identifiers)]));
  return value;
}
function piaForExport(pia,deidentified=false){
  const d=JSON.parse(JSON.stringify(pia));
  if(!deidentified)return d;
  const identifiers=[pia?.eleve,pia?.ecole,pia?.classe,pia?.studentId,pia?.id,...safeArray(pia?.traceability?.sessionIds)].map(x=>String(x||"").trim()).filter(Boolean).sort((a,b)=>b.length-a.length);
  d.type="PIA_MODELE_DEIDENTIFIE";
  return redactPIAValue(d,identifiers);
}
function appendMeetingText(lines,title,meeting){
  lines.push(title,`Type : ${meeting?.type||"À préciser"}`,`Date : ${meeting?.date||"À préciser"}`,`Contexte : ${meeting?.context||"À compléter"}`);
  const participants=PIA_MEETING_ACTORS.filter(actor=>meeting?.participants?.[actor.id]).map(actor=>actor.label);
  lines.push("Participants :",...(participants.length?participants.map(x=>`• ${x}`):["• À préciser."]));
  lines.push("Retours des participants :");
  const feedback=PIA_MEETING_ACTORS.filter(actor=>meeting?.feedback?.[actor.id]).map(actor=>`• ${actor.label} : ${meeting.feedback[actor.id]}`);
  lines.push(...(feedback.length?feedback:["• À compléter."]));
  for(const [key,label] of [["decisions","Décisions"],["objectivesModified","Objectifs modifiés"],["means","Moyens"],["adaptations","Adaptations P/O/M"],["information","Informations complémentaires"],["notes","Notes"]])lines.push(`${label} : ${meeting?.[key]||"À compléter."}`);
  lines.push("");
}
function piaTextSections(pia,deidentified=false){
  const d=piaForExport(pia,deidentified), lines=[];
  lines.push(deidentified?"PIA — modèle dé-identifié":"PIA annuel — document professionnel");
  lines.push(`Statut : ${piaStatusLabel(d)}`);
  if(!deidentified){
    lines.push(`${d.eleve||""}${d.classe?` · ${d.classe}`:""}${d.ecole?` · ${d.ecole}`:""}`.trim());
    lines.push(`Année scolaire : ${d.schoolYear||""}`);
  }
  lines.push("");
  lines.push("Continuité avec le PIA précédent");
  const sc=d.sourceContinuity?.extracted||{};
  if(!deidentified && d.sourceContinuity?.present){
    lines.push(`Source importée : document ${String(d.sourceContinuity.format||"").toUpperCase()||"PIA"} traité localement.`);
    if(sc.objectives?.length) lines.push("Objectifs précédents :",...sc.objectives.map(x=>`• ${x}`));
    if(sc.adaptations?.length) lines.push("Adaptations précédemment documentées :",...sc.adaptations.map(x=>`• ${x}`));
  }else if(deidentified){
    lines.push("Source précédente retirée de l’export dé-identifié.");
  }else lines.push("Aucun PIA précédent structuré disponible.");
  lines.push("");
  for(const sec of safeArray(d.sections)){
    lines.push(sec.aspect||"Aspect");
    lines.push("Ressources");
    lines.push(...(safeArray(sec.ressources).length?safeArray(sec.ressources).map(x=>`• ${x}`):["• À compléter."]));
    lines.push("Difficultés");
    lines.push(...(safeArray(sec.difficultes).length?safeArray(sec.difficultes).map(x=>`• ${x}`):["• À compléter à partir des données disponibles."]));
    lines.push("Objectifs à poursuivre");
    lines.push(...(safeArray(sec.objectifs).length?safeArray(sec.objectifs).map(x=>`• ${x}`):["• Les propositions ci-dessous restent à discuter et valider."]));
    for(const [key,label] of [["criteres","Critères d’évaluation"],["moyens","Moyens / adaptations"],["evolution","Évolution documentée"]]){
      lines.push(label);
      lines.push(...(safeArray(sec[key]).length?safeArray(sec[key]).map(x=>`• ${x}`):["• À compléter."]));
    }
    lines.push("");
  }
  lines.push("Objectifs visés pour la période et critères d’évaluation");
  const prev=safeArray(d.meeting1?.objectivesPrevious), val=safeArray(d.meeting1?.objectivesValidated), props=safeArray(d.propositions);
  if(prev.length) lines.push("Objectifs existants / à réévaluer :",...prev.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  if(val.length) lines.push("Objectifs validés :",...val.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  if(props.length) lines.push("Propositions V74 :",...props.map(x=>`• ${x.formulation||""} [${({A_EXAMINER:"À EXAMINER",VALIDEE:"VALIDÉE",REFUSEE:"REFUSÉE"}[x.decisionStatus]||"À EXAMINER")}]`));
  if(!prev.length&&!val.length&&!props.length) lines.push("• À compléter.");
  lines.push("");
  lines.push("Ressources / moyens complémentaires et aménagements P/O/M");
  lines.push(...(safeArray(d.amenagements).length?safeArray(d.amenagements).map(a=>`• ${a.type||""} — ${a.texte||""} [PROPOSITION]`):["• À compléter sur base des éléments effectivement documentés."]));
  lines.push("");
  appendMeetingText(lines,"Réunion de décembre",d.meeting1||{});
  appendMeetingText(lines,"Réunion de fin d’année",d.meeting2||{});
  return lines;
}
function xmlEsc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function crc32(bytes){let table=crc32._table;if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}crc32._table=table;}let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function u16(v){return [v&255,(v>>>8)&255];}
function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function concatBytes(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
const MAX_PIA_FILE_BYTES=20*1024*1024, MAX_PIA_TEXT_BYTES=8*1024*1024, MAX_PIA_ZIP_ENTRIES=200;
function zipStore(files){
  const locals=[],centrals=[];let offset=0;const enc=new TextEncoder();
  for(const file of files){const name=enc.encode(file.name),data=file.data instanceof Uint8Array?file.data:enc.encode(file.data);const crc=crc32(data);const local=Uint8Array.from([...u32(0x04034b50),[20,0], [0,0],[0,0],u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),Array.from(name),Array.from(data)].flat());locals.push(local);const central=Uint8Array.from([...u32(0x02014b50),[20,0],[20,0],[0,0],[0,0],u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),Array.from(name)].flat());centrals.push(central);offset+=local.length;}
  const cd=concatBytes(centrals),body=concatBytes(locals);const end=Uint8Array.from([...u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)].flat());return concatBytes([body,cd,end]);
}
function makeDocx(lines){
  const paragraphs=lines.map(line=>`<w:p><w:r><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`).join("");
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  return zipStore([{name:"[Content_Types].xml",data:types},{name:"_rels/.rels",data:rels},{name:"word/document.xml",data:documentXml},{name:"word/styles.xml",data:styles}]);
}
async function unzipEntries(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(buffer),max=Math.max(0,bytes.length-65557);let eocd=-1;for(let i=bytes.length-22;i>=max;i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error("Archive DOCX invalide ou non lisible.");
  const count=view.getUint16(eocd+10,true),cdOffset=view.getUint32(eocd+16,true),entries={};if(count>MAX_PIA_ZIP_ENTRIES)throw new Error("Le document Word contient trop d’éléments.");let p=cdOffset,totalSize=0;for(let i=0;i<count;i++){if(view.getUint32(p,true)!==0x02014b50)throw new Error("Répertoire DOCX invalide.");const method=view.getUint16(p+10,true),csize=view.getUint32(p+20,true),usize=view.getUint32(p+24,true),nlen=view.getUint16(p+28,true),elen=view.getUint16(p+30,true),clen=view.getUint16(p+32,true),loff=view.getUint32(p+42,true),name=new TextDecoder().decode(bytes.slice(p+46,p+46+nlen));const lName=view.getUint16(loff+26,true),lExtra=view.getUint16(loff+28,true),start=loff+30+lName+lExtra;const compressed=bytes.slice(start,start+csize);totalSize+=usize;if(totalSize>MAX_PIA_TEXT_BYTES)throw new Error("Le document Word est trop volumineux après décompression.");let data;if(method===0)data=compressed;else if(method===8){if(typeof DecompressionStream!=="function")throw new Error("Ce navigateur ne permet pas de décompresser le document Word localement.");const ds=new DecompressionStream("deflate-raw");data=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(ds)).arrayBuffer());if(data.length>MAX_PIA_TEXT_BYTES)throw new Error("Le document Word est trop volumineux après décompression.");}else throw new Error("Méthode de compression DOCX non prise en charge.");entries[name]=data;p+=46+nlen+elen+clen;}return entries;
}
async function extractDocxText(file){if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");const entries=await unzipEntries(await file.arrayBuffer()),xml=entries["word/document.xml"];if(!xml)throw new Error("Le document Word ne contient pas de document.xml exploitable.");const text=new TextDecoder("utf-8").decode(xml),doc=new DOMParser().parseFromString(text,"application/xml"),ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main",paras=[...doc.getElementsByTagNameNS(ns,"p")];const lines=paras.map(p=>[...p.getElementsByTagNameNS(ns,"t")].map(x=>x.textContent||"").join("").trim()).filter(Boolean);if(!lines.length)throw new Error("Aucun texte exploitable n'a été trouvé dans le document Word.");return lines.join("\n");}
function docxCellText(tc,ns){const paras=[...tc.getElementsByTagNameNS(ns,"p")];return paras.map(p=>[...p.getElementsByTagNameNS(ns,"t")].map(t=>t.textContent||"").join("")).join("\n").replace(/\u00a0/g," ").trim();}
async function extractDocxTables(file){if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");const entries=await unzipEntries(await file.arrayBuffer()),xml=entries["word/document.xml"];if(!xml)return [];const text=new TextDecoder("utf-8").decode(xml),doc=new DOMParser().parseFromString(text,"application/xml"),ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  return [...doc.getElementsByTagNameNS(ns,"tbl")].map(tbl=>[...tbl.getElementsByTagNameNS(ns,"tr")].map(tr=>[...tr.children].filter(c=>c.localName==="tc").map(tc=>docxCellText(tc,ns))));
}
function findDomainTable(tables){return tables.find(rows=>{const header=(rows[0]||[]).map(norm);return header.some(c=>c.includes(norm("Aspect")))&&header.some(c=>c.includes(norm("Objectifs")));});}
function parseDomainTableRows(rows){
  if(!rows||rows.length<2)return [];
  const header=rows[0].map(norm),idx=label=>header.findIndex(h=>h.includes(norm(label)));
  const iAspect=idx("Aspect"),iRes=idx("Ressources"),iDiff=idx("Difficult"),iObj=idx("Objectifs");
  const splitCell=txt=>String(txt||"").split(/\n|;|•|●|▪/).map(x=>x.trim()).filter(x=>x.length>1&&!/^x$/i.test(x));
  return rows.slice(1).map(row=>({aspect:(row[iAspect]||"").replace(/[:：]\s*$/,"").trim(),ressources:iRes>=0?splitCell(row[iRes]):[],difficultes:iDiff>=0?splitCell(row[iDiff]):[],objectifs:iObj>=0?splitCell(row[iObj]):[],moyens:[]})).filter(s=>s.aspect);
}
function findAdaptationTables(tables){return tables.filter(rows=>{const header=rows.slice(0,2).flat().map(norm);return header.includes("p")&&header.includes("o")&&header.includes("m")&&header.some(h=>h.includes(norm("Description")));});}
function parseAdaptationRows(rows){
  if(!rows||rows.length<2)return [];
  const headerRowIndex=rows.findIndex(r=>{const n=r.map(norm);return n.includes("p")&&n.includes("o")&&n.includes("m");});
  if(headerRowIndex<0)return [];
  const headerRow=rows[headerRowIndex].map(norm),width=rows[headerRowIndex].length;
  const iP=headerRow.indexOf("p"),iO=headerRow.indexOf("o"),iM=headerRow.indexOf("m");
  const used=new Set([0,iP,iO,iM]);let iDesc=-1;for(let i=width-1;i>=0;i--){if(!used.has(i)){iDesc=i;break;}}if(iDesc<0)iDesc=width-1;
  const marked=cell=>/^[xX✓✔]$/.test(String(cell||"").trim());
  return rows.slice(headerRowIndex+1).map(row=>{
    const desc=(row[iDesc]||"").trim();if(!desc)return null;
    const tags=[marked(row[iP])&&"P",marked(row[iO])&&"O",marked(row[iM])&&"M"].filter(Boolean);
    return tags.length?`${desc} (${tags.join("/")})`:desc;
  }).filter(Boolean);
}
async function extractPIAFromDocxTables(file){
  const tables=await extractDocxTables(file);
  const domainRows=findDomainTable(tables),sections=domainRows?parseDomainTableRows(domainRows):[];
  const adaptationTables=findAdaptationTables(tables);
  const adaptations=adaptationTables.length?parseAdaptationRows(adaptationTables[adaptationTables.length-1]):[];
  if(!sections.length&&!adaptations.length)return null;
  const objectives=[...new Set(sections.flatMap(s=>s.objectifs))],difficulties=[...new Set(sections.flatMap(s=>s.difficultes))],resources=[...new Set(sections.flatMap(s=>s.ressources))];
  return {format:"docx",fileName:"",importedAt:new Date().toISOString(),role:"SOURCE_DE_CONTINUITE",extracted:{objectives:objectives.slice(0,30),resources:resources.slice(0,30),difficulties:difficulties.slice(0,30),means:[],adaptations:adaptations.slice(0,30),sections}};
}
function winAnsiDecode(bytes){const map={0x80:"€",0x82:"‚",0x83:"ƒ",0x84:"„",0x85:"…",0x86:"†",0x87:"‡",0x88:"ˆ",0x89:"‰",0x8A:"Š",0x8B:"‹",0x8C:"Œ",0x8E:"Ž",0x91:"‘",0x92:"’",0x93:"“",0x94:"”",0x95:"•",0x96:"–",0x97:"—",0x98:"˜",0x99:"™",0x9A:"š",0x9B:"›",0x9C:"œ",0x9E:"ž",0x9F:"Ÿ"};let out="";for(const b of bytes)out+=map[b]||String.fromCharCode(b);return out;}
function pdfDecodeString(raw,hex=false){if(hex){const h=raw.replace(/[^0-9A-Fa-f]/g,"");const bytes=[];for(let i=0;i<h.length;i+=2)bytes.push(parseInt(h.slice(i,i+2).padEnd(2,"0"),16));if(bytes[0]===0xFE&&bytes[1]===0xFF){let out="";for(let i=2;i+1<bytes.length;i+=2)out+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);return out;}return winAnsiDecode(bytes);}
  const out=[];for(let i=0;i<raw.length;i++){if(raw[i]!=="\\"){out.push(raw.charCodeAt(i)&255);continue;}i++;if(i>=raw.length)break;const c=raw[i];if("nrtbf".includes(c)){out.push({n:10,r:13,t:9,b:8,f:12}[c]);continue;}if(c==="("||c===")"||c==="\\"){out.push(c.charCodeAt(0));continue;}if(/[0-7]/.test(c)){let oct=c;for(let j=0;j<2&&i+1<raw.length&&/[0-7]/.test(raw[i+1]);j++)oct+=raw[++i];out.push(parseInt(oct,8));continue;}if(c==="\n")continue;out.push(c.charCodeAt(0)&255);}return winAnsiDecode(out);}
function extractPdfStrings(text){const lines=[];const btBlocks=text.match(/BT[\s\S]*?ET/g)||[];for(const block of btBlocks){let i=0,lastOperator="";while(i<block.length){if(block[i]==="("){let j=i+1,depth=1,raw="";for(;j<block.length&&depth;j++){if(block[j]==="\\"){raw+=block[j]+(block[j+1]||"");j++;continue;}if(block[j]==="(")depth++;else if(block[j]===")")depth--;if(depth)raw+=block[j];}const tail=block.slice(j).match(/^\s*(?:Tj|TJ|['"])/);if(tail)lines.push(pdfDecodeString(raw,false));i=j;continue;}if(block[i]==="<"&&block[i+1]!=="<"){const j=block.indexOf(">",i+1);if(j>0){const raw=block.slice(i+1,j),tail=block.slice(j+1).match(/^\s*(?:Tj|TJ|['"])/);if(tail)lines.push(pdfDecodeString(raw,true));i=j+1;continue;}}i++;} }return lines.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);}
function ascii85Decode(input){let s=String(input||"").replace(/\s+/g,"");if(s.startsWith("<~"))s=s.slice(2);if(s.endsWith("~>"))s=s.slice(0,-2);const out=[];let group="";for(let i=0;i<s.length;i++){const c=s[i];if(c==="z"&&group.length===0){out.push(0,0,0,0);continue;}group+=c;if(group.length===5){let acc=0;for(const ch of group)acc=acc*85+(ch.charCodeAt(0)-33);out.push((acc>>>24)&255,(acc>>>16)&255,(acc>>>8)&255,acc&255);group="";}}if(group.length){const orig=group.length;while(group.length<5)group+="u";let acc=0;for(const ch of group)acc=acc*85+(ch.charCodeAt(0)-33);const bytes=[(acc>>>24)&255,(acc>>>16)&255,(acc>>>8)&255,acc&255];out.push(...bytes.slice(0,orig-1));}return new Uint8Array(out);}
async function inflatePdf(bytes){if(typeof DecompressionStream!=="function")throw new Error("Ce navigateur ne permet pas de décompresser localement ce PDF.");for(const format of ["deflate","deflate-raw"]){try{const ds=new DecompressionStream(format);const out=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());if(out.length>MAX_PIA_TEXT_BYTES)throw new Error("Le PDF est trop volumineux après décompression.");return out;}catch(_){}}throw new Error("Flux PDF compressé non exploitable localement.");}
async function extractPdfText(file){if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");const buffer=await file.arrayBuffer(),raw=new TextDecoder("latin1").decode(new Uint8Array(buffer));const streams=[];const re=/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/g;let m;while((m=re.exec(raw))){let bytes=Uint8Array.from([...m[2]].map(c=>c.charCodeAt(0)&255));const filters=m[1];try{if(/ASCII85Decode/.test(filters))bytes=ascii85Decode(new TextDecoder("latin1").decode(bytes));if(/FlateDecode/.test(filters))bytes=await inflatePdf(bytes);streams.push(new TextDecoder("latin1").decode(bytes));}catch(_){if(!/FlateDecode|ASCII85Decode/.test(filters))streams.push(m[2]);}}const lines=extractPdfStrings(streams.join("\n"));if(lines.length<2){const fallback=raw.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)||[];fallback.forEach(x=>{const a=x.indexOf("(")+1,b=x.lastIndexOf(")");if(b>a)lines.push(pdfDecodeString(x.slice(a,b),false));});}if(lines.length<2)throw new Error("Aucun texte exploitable n'a été trouvé dans le PDF. Un PDF scanné/image peut nécessiter un OCR, non inclus dans Journalier.");return lines.join("\n");}
function normalizeImportedLines(text){return String(text||"").replace(/\u00a0/g," ").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,"").replace(/\r/g,"").split("\n").map(x=>x.replace(/[ \t]+/g," ").trim()).filter(Boolean);}
function extractPIAStructure(text,fileName,format){
  const lines=normalizeImportedLines(text),nlines=lines.map(norm),aspects=["Physique et psychomoteur","Lié à l’autonomie","Comportemental et affectif","Communication","Cognitif (pédagogique)"],blocks={};
  aspects.forEach((aspect,i)=>{const idx=nlines.findIndex(x=>x===norm(aspect)||x.includes(norm(aspect)));if(idx<0)return;const next=aspects.slice(i+1).map(norm).map(a=>nlines.findIndex((x,j)=>j>idx&&(x===a||x.includes(a)))).find(x=>x>=0);blocks[aspect]=lines.slice(idx+1,next>=0?next:lines.length);});
  function labelled(block,label){const b=block||[],nl=b.map(norm),i=nl.findIndex(x=>x.includes(norm(label)));if(i<0)return [];const stops=["ressources","difficultes","difficultés","objectifs à poursuivre","objectifs vises","objectifs visés","objectifs","moyens","retours des acteurs","amenagements","aménagements"];let end=b.length;for(let j=i+1;j<b.length;j++){if(stops.some(stop=>nl[j].startsWith(norm(stop)))){end=j;break;}}return b.slice(i+1,end).map(x=>x.replace(/^[•●▪\-–—]+\s*/,"").trim()).filter(x=>x.length>1);}
  const sections=aspects.filter(a=>blocks[a]).map(aspect=>({aspect,ressources:labelled(blocks[aspect],"Ressources"),difficultes:[...new Set(labelled(blocks[aspect],"Difficultés"))],objectifs:labelled(blocks[aspect],"Objectifs à poursuivre"),moyens:labelled(blocks[aspect],"Moyens")}));
  const objectiveLines=lines.filter(x=>/^(?:[-•●▪]\s*)?(objectif(?:s)?(?:\s+(?:visé|visés|à poursuivre|pour la période))?\s*[:：-])/i.test(x)).map(x=>x.replace(/^[^:：-]*[:：-]\s*/,"").trim()).filter(Boolean);
  const globalObjectives=[...new Set([...objectiveLines,...sections.flatMap(s=>s.objectifs)])];
  const adaptations=lines.filter(x=>/\bP\s*\/\s*O\s*\/\s*M\b|\bam[ée]nagements?\b|\badaptations?\b/i.test(x)).map(x=>x.replace(/^[•●▪\-–—]+\s*/,"").trim()).filter(x=>x.length>3);
  const resources=[...new Set(sections.flatMap(s=>s.ressources))];const difficulties=[...new Set(sections.flatMap(s=>s.difficultes))];const means=[...new Set(sections.flatMap(s=>s.moyens))];
  return {format,fileName:"",importedAt:new Date().toISOString(),role:"SOURCE_DE_CONTINUITE",extracted:{objectives:globalObjectives.slice(0,30),resources:resources.slice(0,30),difficulties:difficulties.slice(0,30),means:means.slice(0,30),adaptations:[...new Set(adaptations)].slice(0,30),sections}};
}
async function parsePIAFile(file){
  if(!file)throw new Error("Aucun fichier sélectionné.");
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(!["pdf","docx"].includes(ext))throw new Error("Format non pris en charge. Utilisez un fichier Word (.docx) ou PDF (.pdf).");
  if(ext==="docx"){
    const fromTables=await extractPIAFromDocxTables(file);
    if(fromTables)return fromTables;
  }
  const text=ext==="docx"?await extractDocxText(file):await extractPdfText(file);
  const parsed=extractPIAStructure(text,file.name,ext);
  if(!parsed.extracted.objectives.length&&!parsed.extracted.sections.length&&!parsed.extracted.difficulties.length&&!parsed.extracted.adaptations.length)throw new Error("Le document a été lu, mais aucune structure PIA reconnaissable n'a été extraite. Le document original n'a pas été conservé.");
  return parsed;
}
function importedSummaryHtml(imported){const e=imported?.extracted||{};return `<div class="v73-import-summary"><b>✓ PIA analysé localement</b><span>${esc(imported?.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;}
function piaImportDossierHtml(studentId){
  const imported=getImportedPIA(studentId);
  if(!imported?.extracted)return '<div class="v73-import-help">Aucun PIA importé pour ce dossier. Utilisez « Importer le PIA » dans la fiche de l’élève.</div>';
  const e=imported.extracted||{},sections=safeArray(e.sections).filter(s=>safeArray(s.objectifs).length||safeArray(s.moyens).length||safeArray(s.difficultes).length||safeArray(s.ressources).length);
  const globalAdaptations=safeArray(e.adaptations);
  const domainCards=sections.map((section,index)=>{
    const rows=[["difficultes","Besoins / difficultés"],["objectifs","Objectifs visés"]]
      .map(([key,label])=>{const items=safeArray(section[key]);return `<div class="v73-domain-value-list-row"><span class="v73-domain-value-label">${label}</span>${items.length?`<div class="v73-domain-value-list">${items.map(item=>`<span class="v73-domain-value">${esc(item)}</span>`).join("")}</div>`:'<p class="v73-domain-empty">Non renseigné.</p>'}</div>`;}).join("");
    return `<details class="v73-domain-record" id="v73-dossier-domain-${index}">
      <summary class="v73-domain-record-head tone-${piaDomainTone(section.aspect)}"><div><div class="page-kicker">Domaine PIA — continuité</div><h3>${esc(section.aspect||"Domaine")}</h3></div><span>${safeArray(section.difficultes).length} besoin(s) · ${safeArray(section.objectifs).length} objectif(s)</span></summary>
      <div class="v73-domain-fields">${rows}</div>
    </details>`;
  }).join("");
  return `<details class="v73-pia-dossier">
    <summary class="v73-import-summary"><b>PIA précédent — repère de continuité</b><span>${esc(imported.format?.toUpperCase()||"DOCUMENT")}</span><span>Importé le ${esc(new Date(imported.importedAt||Date.now()).toLocaleDateString("fr"))}</span></summary>
    <p class="v73-import-help">Ces éléments proviennent du PIA importé. Ils servent de repère et d’aide-mémoire pour préparer les séances ; ils ne remplacent pas une réévaluation par le professionnel.</p>
    ${domainCards||'<p class="v73-domain-empty">Aucun domaine structuré n’a été reconnu dans le document importé.</p>'}
    ${globalAdaptations.length?`<div class="v73-domain-value-list-row"><span class="v73-domain-value-label">Adaptations validées</span><div class="v73-domain-value-list">${globalAdaptations.map(item=>`<span class="v73-domain-value">${esc(item)}</span>`).join("")}</div></div>`:""}
  </details>`;
}
function pdfWinAnsiBytes(text){const map={"€":0x80,"‚":0x82,"ƒ":0x83,"„":0x84,"…":0x85,"†":0x86,"‡":0x87,"ˆ":0x88,"‰":0x89,"Š":0x8A,"‹":0x8B,"Œ":0x8C,"Ž":0x8E,"‘":0x91,"’":0x92,"“":0x93,"”":0x94,"•":0x95,"–":0x96,"—":0x97,"˜":0x98,"™":0x99,"š":0x9A,"›":0x9B,"œ":0x9C,"ž":0x9E,"Ÿ":0x9F};const out=[];for(const ch of String(text||"")){const cp=ch.codePointAt(0);if(cp<128)out.push(cp);else if(map[ch]!=null)out.push(map[ch]);else if(cp<=255)out.push(cp);else out.push(63);}return out;}
function pdfLiteral(text){return "("+String.fromCharCode(...pdfWinAnsiBytes(text).flatMap(b=>b===40||b===41||b===92?[92,b]:[b]))+")";}
function makePdf(lines){const pages=[];const perPage=48;for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));const objs=[];const add=x=>{objs.push(x);return objs.length;};const fontId=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");const pageIds=[];for(const pageLines of pages){const content=["BT","/F1 10 Tf","50 790 Td",...pageLines.map((line,i)=>`${pdfLiteral(String(line).slice(0,180))} Tj 0 -15 Td`),"ET"].join("\n");const contentId=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);pageIds.push({contentId});}const pagesId=add("");const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);const pageObjects=pageIds.map(x=>{const id=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${x.contentId} 0 R >>`);return id;});objs[pagesId-1]=`<< /Type /Pages /Kids [${pageObjects.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;let out="%PDF-1.4\n%\xFF\xFF\xFF\xFF\n",offsets=[0];for(let i=0;i<objs.length;i++){offsets[i+1]=out.length;out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)out+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";out+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Uint8Array.from([...out].map(c=>c.charCodeAt(0)&255));}
function downloadBytes(name,bytes,type){const blob=new Blob([bytes],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportTextDocument(filename,content,format="docx"){
  if(!["docx","pdf"].includes(format))throw new Error("Format d’export non pris en charge.");
  const lines=String(content||"").replace(/\r/g,"").split("\n");
  if(!lines.some(line=>line.trim()))throw new Error("Le document ne contient aucun contenu à exporter.");
  const mime=format==="docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/pdf";
  downloadBytes(`${filename}.${format}`,format==="docx"?makeDocx(lines):makePdf(lines),mime);
}
function htmlPIA(pia){return `<pre style="white-space:pre-wrap;font:14px Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.55">${esc(piaTextSections(pia,false).join("\\n"))}</pre>`;}

function clearPIAResult(){
  const box=document.getElementById("v73-pia-result");
  if(box) box.innerHTML="";
  V73.ui.piaDisplayStudentId="";
  V73.ui.piaDisplayMode="none";
  V73.ui.piaDraftStudentId="";
  V73.ui.piaDraftPersisted=false;
}

function closePIAProject(){
  clearPIAResult();
}

async function deletePIARecord(studentId){
  const sid=String(studentId||"").trim();
  if(!sid) return false;

  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.()) {
    throw new Error("Connectez-vous à Microsoft avant de supprimer le PIA.");
  }

  const st=ds.getState();
  st.meta??={};
  st.meta.piaRecords??={};

  if(!Object.prototype.hasOwnProperty.call(st.meta.piaRecords,sid)) {
    return false;
  }

  delete st.meta.piaRecords[sid];

  /*
   * Ne jamais supprimer piaImports :
   * le PIA importé constitue la continuité du suivi.
   *
   * Il n'existe actuellement aucun JournalierCloud.deletePia
   * dans l'application. La suppression distante n'est donc
   * volontairement pas simulée ici.
   */
  await ds.persistState(st);

  return true;
}

function piaStatusLabel(pia){
  if(pia?.lifecycle==="FINALISE") return "PIA annuel finalisé";
  if(pia?.lifecycle==="EN_VIGUEUR"||pia?.lifecycle==="ACTIF") return "PIA annuel en vigueur";
  if(pia?.lifecycle==="EN_REEVALUATION") return "Réévaluation en cours";
  if(pia?.meeting1?.status==="VALIDÉ"||pia?.meeting1?.status==="VALIDÉE") return "PIA annuel en vigueur";
  if(pia?.lifecycle==="EN_CONSTRUCTION") return "Projet de PIA à examiner";
  return "Projet de PIA à examiner";
}

const PIA_MEETING_ACTORS=[
  {id:"eleve",label:"Élève"},{id:"parents",label:"Parents"},
  {id:"ecole",label:"École / équipe"},{id:"direction",label:"Direction"},
  {id:"pms",label:"CPMS / PMS"},{id:"integration",label:"Agent d’intégration"},
  {id:"autres",label:"Autres intervenants"}
];
const PIA_DOMAIN_FIELDS=[
  ["ressources","Ressources"],["difficultes","Besoins / difficultés"],
  ["objectifs","Objectifs"],["criteres","Critères d’évaluation"],
  ["moyens","Moyens / adaptations"],["evolution","Évolution documentée"]
];
function piaDomainIcon(aspect,index){
  const name=String(aspect||"").toLocaleLowerCase("fr");
  if(name.includes("cogn"))return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 13.5c6-2.3 12-.8 18 3.3v23c-6-4.1-12-5.6-18-3.3zM42 13.5c-6-2.3-12-.8-18 3.3v23c6-4.1 12-5.6 18-3.3z"/><path d="M11 20c3-.8 6-.3 9 1.2M11 26c3-.7 6-.2 9 1.2M37 20c-3-.8-6-.3-9 1.2M37 26c-3-.7-6-.2-9 1.2"/></svg>`;
  if(name.includes("commun"))return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M7 10.5h24a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H19l-8 6v-6h-4a5 5 0 0 1-5-5v-11a5 5 0 0 1 5-5z"/><path d="M15 19h13M15 24h9"/><path d="M31 17h5a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-1v5l-7-5"/></svg>`;
  if(name.includes("comport")||name.includes("affect"))return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 39s-16-9.5-16-21a9 9 0 0 1 16-5.8A9 9 0 0 1 40 18c0 11.5-16 21-16 21z"/><path d="M16 23h.1M32 23h.1M19 29c1.4 1.6 3.1 2.4 5 2.4s3.6-.8 5-2.4"/></svg>`;
  if(name.includes("autonom"))return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="17"/><path d="m31 17-4.5 10.5L17 32l4.5-10.5z"/><circle cx="24" cy="24" r="2"/></svg>`;
  if(name.includes("phys")||name.includes("psychom"))return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="29" cy="9" r="4"/><path d="m24 17 7 4 6-2M27 20l-6 9 8 4 5 9M21 29l-8 3-4 8M14 15l7 2 4-4"/><path d="m31 17 4 4"/></svg>`;
  const fallback=index%2?`<circle cx="24" cy="24" r="15"/><path d="M24 16v16M16 24h16"/>`:`<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${fallback}</svg>`;
}
function piaDomainObjectives(pia,section){
  const validated=safeArray(pia.meeting1?.objectivesValidated)
    .filter(item=>item&&typeof item==="object"&&(item.aspect===section.aspect||(item.theme&&safeArray(pia.propositions).some(proposal=>proposal.aspect===section.aspect&&proposal.theme===item.theme))))
    .map(item=>item.formulation||"").filter(Boolean);
  return [...new Set([...safeArray(section.objectifs),...validated])];
}
function piaDomainTone(aspect){
  const name=String(aspect||"").toLocaleLowerCase("fr");
  if(name.includes("cogn"))return "cognitive";
  if(name.includes("commun"))return "communication";
  if(name.includes("comport")||name.includes("affect"))return "affective";
  if(name.includes("autonom"))return "autonomy";
  if(name.includes("phys")||name.includes("psychom"))return "physical";
  return "neutral";
}
function piaDomainCard(pia,section,index){
  const objectives=piaDomainObjectives(pia,section);
  const field=([key,label])=>{
    const items=key==="objectifs"?objectives:safeArray(section[key]);
    const content=items.length?`<div class="v73-domain-value-list">${items.map(item=>`<span class="v73-domain-value">${esc(item)}</span>`).join("")}</div>`:'<p class="v73-domain-empty">Aucun élément renseigné.</p>';
    return `<details class="v73-domain-fieldset is-${key}"><summary>${label}<span>${items.length||""}</span></summary><div class="v73-domain-field-content">${content}<label class="v73-domain-field"><span>Modifier cette rubrique</span><textarea rows="2" data-v73-domain-index="${index}" data-v73-domain-field="${key}" aria-label="${label} — ${esc(section.aspect)}" placeholder="À compléter">${esc(items.join("\n"))}</textarea></label></div></details>`;
  };
  return `<div class="v73-domain-record" id="v73-domain-${index}">
    <header class="v73-domain-record-head tone-${piaDomainTone(section.aspect)}"><div><div class="page-kicker">Domaine PIA</div><h3>${esc(section.aspect||"Domaine")}</h3></div><span>${safeArray(section.difficultes).length} besoin(s) · ${objectives.length} objectif(s) · ${safeArray(section.moyens).length} moyen(s)</span></header>
    <div class="v73-domain-fields">${PIA_DOMAIN_FIELDS.map(field).join("")}</div>
  </div>`;
}
function piaMeetingEditor(pia,key,title,type){
  const meeting=pia[key]||{},participants=meeting.participants||{},feedback=meeting.feedback||{};
  const schoolYearBounds=piaSchoolYearBounds(Number(String(pia.schoolYear||"").slice(0,4)));
  const input=(field,label,value,kind="textarea")=>kind==="input"
    ? `<label class="v73-meeting-field"><span>${label}</span><input data-v73-meeting="${key}" data-v73-meeting-field="${field}" value="${esc(value||"")}" maxlength="4000"></label>`
    : `<label class="v73-meeting-field"><span>${label}</span><textarea rows="2" data-v73-meeting="${key}" data-v73-meeting-field="${field}" maxlength="8000">${esc(value||"")}</textarea></label>`;
  return `<details class="v73-meeting">
    <summary><span>${title}</span><span class="v73-meeting-status">${esc(meeting.status||"À préparer")}</span></summary>
    <div class="v73-meeting-fields">
      <label class="v73-meeting-field"><span>Type</span><select data-v73-meeting="${key}" data-v73-meeting-field="type"><option value="${type}" selected>${title}</option></select></label>
      <label class="v73-meeting-field"><span>Date</span><input type="date" min="${schoolYearBounds.start}" max="${schoolYearBounds.end}" data-v73-meeting="${key}" data-v73-meeting-field="date" value="${esc(meeting.date||"")}"></label>
      ${input("context","Contexte",meeting.context)}
      <fieldset class="v73-participants"><legend>Participants</legend>${PIA_MEETING_ACTORS.map(actor=>`<label><input type="checkbox" data-v73-meeting="${key}" data-v73-participant="${actor.id}" ${participants[actor.id]?"checked":""}><span>${actor.label}</span></label>`).join("")}</fieldset>
      <div class="v73-feedback-grid"><div class="v73-meeting-subtitle">Retours des participants</div>${PIA_MEETING_ACTORS.map(actor=>input(`feedback.${actor.id}`,actor.label,feedback[actor.id])).join("")}</div>
      ${input("decisions","Décisions",meeting.decisions)}
      ${input("objectivesModified","Objectifs modifiés",meeting.objectivesModified)}
      ${input("means","Moyens",meeting.means)}
      ${input("adaptations","Adaptations P/O/M",meeting.adaptations)}
      ${input("information","Informations complémentaires",meeting.information)}
      ${input("notes","Notes",meeting.notes)}
    </div>
  </details>`;
}
function piaAnnualTracking(pia){
  const validated=safeArray(pia.meeting1?.objectivesValidated),evaluation=safeArray(pia.meeting2?.evaluation);
  const list=(items,empty)=>items.length?`<ul>${items.map(item=>`<li>${esc(typeof item==="string"?item:item.formulation||item.objectif||"")}</li>`).join("")}</ul>`:`<p>${empty}</p>`;
  return `<section class="v73-annual-tracking"><h3>Suivi annuel</h3><p>${esc(piaStatusLabel(pia))} · ${Number(pia.sessionsAnalysed||0)} séance(s) analysée(s)</p><h4>Objectifs validés</h4>${list(validated,"Aucun objectif validé à ce stade.")}<h4>Éléments de réévaluation</h4>${list(evaluation,"La réévaluation de fin d’année n’a pas encore été préparée.")}</section>`;
}
async function persistPIAEdit(pia,persistDraft=false){
  if(pia.lifecycle==="EN_CONSTRUCTION"&&!persistDraft&&!V73.ui.piaDraftPersisted)return;
  if(pia.lifecycle==="EN_CONSTRUCTION")V73.ui.piaDraftPersisted=true;
  await savePia(pia,pia.lifecycle!=="EN_CONSTRUCTION",false);
}
function decidePIAProposal(pia,index,decision){
  const proposal=pia.propositions?.[index];if(!proposal||!['VALIDEE','REFUSEE'].includes(decision))return false;
  if(decision==="VALIDEE"){
    const inReview=pia.lifecycle==="EN_REEVALUATION";
    const field=document.querySelector(`[data-v73-prop-formulation="${index}"]`),formulation=String(field?.value??proposal.formulation??"").trim();
    if(!formulation)return false;
    proposal.formulation=formulation;
    const objectives=safeArray(pia.meeting1.objectivesValidated);
    if(!objectives.some(item=>(typeof item==="string"?item:item.id)===proposal.id||item?.themeId===proposal.themeId))objectives.push({id:proposal.id,themeId:proposal.themeId,theme:proposal.theme,aspect:proposal.aspect,formulation,status:"VALIDEE",source:"REUNION",validatedAt:new Date().toISOString()});
    pia.meeting1.objectivesValidated=objectives;
    if(inReview)pia.meeting2.objectivesToContinue=objectives;
    else{
      pia.meeting1.validatedAt=new Date().toISOString();
      pia.meeting1.status="VALIDÉE";
      pia.lifecycle="EN_VIGUEUR";
    }
  }
  proposal.decisionStatus=decision;
  proposal.decidedAt=new Date().toISOString();
  return true;
}

function setPIASection(box,name){
  const tabs=[...box.querySelectorAll("[data-v73-pia-tab]")],panels=[...box.querySelectorAll("[data-v73-pia-panel]")];
  const active=tabs.find(tab=>tab.dataset.v73PiaTab===name);if(!active)return;
  tabs.forEach(tab=>{const selected=tab===active;tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;});
  panels.forEach(panel=>{panel.hidden=panel.dataset.v73PiaPanel!==name;});
}
function bindPIASectionTabs(box){
  const nav=box.querySelector(".v73-pia-nav");if(!nav)return;
  nav.addEventListener("click",event=>{const tab=event.target.closest("[data-v73-pia-tab]");if(tab)setPIASection(box,tab.dataset.v73PiaTab);});
  nav.addEventListener("keydown",event=>{
    const tabs=[...nav.querySelectorAll("[data-v73-pia-tab]")],index=tabs.indexOf(document.activeElement);if(index<0)return;
    let next=index;if(event.key==="ArrowRight")next=(index+1)%tabs.length;else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=tabs.length-1;else return;
    event.preventDefault();tabs[next].focus();setPIASection(box,tabs[next].dataset.v73PiaTab);
  });
}
function requestPIASection(name){
  if(!["domains","proposals","meetings","tracking"].includes(name))return false;
  V73.ui??={};V73.ui.pendingSection=name;
  const box=document.getElementById("v73-pia-result");
  if(box?.querySelector("[data-v73-pia-tab]")){
    setPIASection(box,name);
    V73.ui.pendingSection="";
    return true;
  }
  return false;
}
function render(pia){
  const box=document.getElementById("v73-pia-result");
  if(!box)return;
  const activeSection=V73.ui?.pendingSection||box.querySelector('[data-v73-pia-tab][aria-selected="true"]')?.dataset.v73PiaTab||"domains";
  if(V73.ui?.pendingSection)V73.ui.pendingSection="";

  const imported=pia.sourceContinuity?.present?importedSummaryHtml(pia.sourceContinuity):"";
  const limitedEvidence=Number(pia.sessionsAnalysed||0)<3;
  const statusLabel=piaStatusLabel(pia);
  const statusClass=["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)?"is-success":"is-warning";

  const evidenceNotice=limitedEvidence
    ? `<div class="v73-notice v73-notice-warning">
         ⚠️ Éléments encore limités : le projet repose sur un nombre réduit de séances.
         Il doit être considéré comme un projet à examiner et non comme une évaluation annuelle complète.
       </div>`
    : "";

  const proposals=safeArray(pia.propositions);
  const domains=safeArray(pia.sections);
  const storedDomainIndex=box.dataset.v73ActiveDomain;
  const activeDomainIndex=storedDomainIndex!==undefined&&storedDomainIndex!==""?Number(storedDomainIndex):-1;
  const activeDomain=Number.isInteger(activeDomainIndex)?domains[activeDomainIndex]:null;
  const domainOverview=domains.map((section,index)=>{
    const objectives=piaDomainObjectives(pia,section);
    const needs=safeArray(section.difficultes).length,means=safeArray(section.moyens).length;
    return `<button type="button" class="v73-domain-overview tone-${piaDomainTone(section.aspect)}" data-v73-domain-jump="${index}" aria-label="Afficher le domaine ${esc(section.aspect||"")} et son détail"><span class="v73-domain-icon">${piaDomainIcon(section.aspect,index)}</span><strong>${esc(section.aspect||"Domaine")}</strong><span class="v73-domain-metrics"><span><b>${needs}</b> besoins</span><span><b>${objectives.length}</b> objectifs</span><span><b>${means}</b> moyens</span></span><span class="v73-domain-action">Consulter le domaine <span aria-hidden="true">›</span></span></button>`;
  }).join("");
  const domainDetail=activeDomain?`<div class="v73-domain-detail-view" id="v73-domain-detail-view">
    <button type="button" class="v73-domain-back" data-v73-domain-back>‹ Tous les domaines</button>
    <div class="v73-domain-detail-layout">
      <nav class="v73-domain-menu" aria-label="Choisir un domaine">${domains.map((section,index)=>`<button type="button" data-v73-domain-select="${index}" aria-current="${index===activeDomainIndex?"true":"false"}">${esc(section.aspect||"Domaine")}</button>`).join("")}</nav>
      ${piaDomainCard(pia,activeDomain,activeDomainIndex)}
    </div>
  </div>`:"";

  box.innerHTML=`
    <div class="v73-summary">
      <div class="v73-summary-main">
        <span class="v73-status-badge ${statusClass}">${esc(statusLabel)}</span>
      </div>
      <span>${Number(pia.sessionsAnalysed||0)} séance(s) analysée(s)</span>
      <span>${proposals.length} proposition(s)</span>
    </div>

    ${imported}
    ${evidenceNotice}

    <div class="v73-notice">
      Les objectifs existants sont conservés comme continuité.
      Les nouvelles formulations sont des <b>PROPOSITIONS</b> tant qu'elles ne sont pas validées.
    </div>

    <nav class="v73-pia-nav" role="tablist" aria-label="Sections du PIA annuel" aria-orientation="horizontal">
      <button type="button" role="tab" id="v73-tab-domains" aria-controls="v73-panel-domains" aria-selected="true" tabindex="0" data-v73-pia-tab="domains">Domaines</button>
      <button type="button" role="tab" id="v73-tab-proposals" aria-controls="v73-panel-proposals" aria-selected="false" tabindex="-1" data-v73-pia-tab="proposals">Propositions <span>${proposals.length}</span></button>
      <button type="button" role="tab" id="v73-tab-meetings" aria-controls="v73-panel-meetings" aria-selected="false" tabindex="-1" data-v73-pia-tab="meetings">Réunions</button>
      <button type="button" role="tab" id="v73-tab-tracking" aria-controls="v73-panel-tracking" aria-selected="false" tabindex="-1" data-v73-pia-tab="tracking">Suivi annuel</button>
    </nav>

    <section class="v73-pia-panel v73-domain-section" id="v73-panel-domains" role="tabpanel" aria-labelledby="v73-tab-domains" tabindex="0" data-v73-pia-panel="domains">
      <div class="v73-domain-overview-view" ${activeDomain?"hidden":""}>
        <h3>Les cinq domaines</h3>
        ${domains.length?`<div class="v73-domain-overview-grid">${domainOverview}</div>`:'<p class="v73-empty">Aucun domaine disponible pour ce PIA.</p>'}
      </div>
      ${domainDetail}
    </section>

    <section class="v73-pia-panel" id="v73-panel-proposals" role="tabpanel" aria-labelledby="v73-tab-proposals" tabindex="0" data-v73-pia-panel="proposals" hidden>
      ${
      proposals.length
      ? `<div class="v73-proposals">
          ${proposals.map((p,i)=>{
            const status=p.decisionStatus||"A_EXAMINER";
            const statusLabel={A_EXAMINER:"À examiner",VALIDEE:"Validée",REFUSEE:"Refusée"}[status]||"À examiner";
            const statusClass={A_EXAMINER:"is-pending",VALIDEE:"is-validated",REFUSEE:"is-refused"}[status]||"is-pending";
            const contributors=[...new Set(safeArray(p.evidence).map(item=>[item.date,item.matiere].filter(Boolean).join(" · ")))];
            return `<article class="v73-prop ${statusClass}">
              <label class="v73-prop-select" aria-label="Sélectionner la proposition ${i+1}">
                <input type="checkbox" data-v73-prop="${i}" ${status!=="A_EXAMINER"?"disabled":""}>
                <span class="v73-checkmark" aria-hidden="true"></span>
              </label>
              <div class="v73-prop-body">
                <span class="v73-prop-title">${esc(p.theme||"Proposition PIA")}</span>
                <span class="v73-prop-meta"><span>${esc(p.aspect||"")}</span><span class="v73-prop-state ${statusClass}">${statusLabel}</span></span>
                <label class="v73-prop-edit">Formulation<textarea rows="2" data-v73-prop-formulation="${i}" ${status!=="A_EXAMINER"?"readonly":""}>${esc(p.formulation||"")}</textarea></label>
                <span class="v73-prop-meta">
                  <span>${Number(p.recurrence||0)} occurrence(s)</span>
                  <span>${Number(p.sessionCount||0)} séance(s) contributrice(s)</span>
                  ${p.counterEvidence ? "<span class='v73-badge-warning'>Contre-évidence</span>" : ""}
                </span>
                <span class="v73-prop-meta"><span>Provenance : séances Q2–Q6 (${safeArray(p.provenance?.sourceKeys).join(", ")||"données documentées"})</span></span>
                ${contributors.length?`<ul class="v73-prop-evidence">${contributors.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:""}
                ${status==="A_EXAMINER"?`<div class="v73-prop-actions"><button type="button" class="v73-btn v73-btn-neutral" data-v73-proposal-save="${i}">Enregistrer la formulation</button><button type="button" class="v73-btn v73-btn-success" data-v73-proposal-accept="${i}">Valider</button><button type="button" class="v73-btn v73-btn-danger" data-v73-proposal-reject="${i}">Refuser</button></div>`:""}
              </div>
            </article>`;
          }).join("")}
        </div>`
      : `<p class="v73-empty">
           Aucune convergence suffisante pour formuler une proposition PIA.
           Les observations restent disponibles dans les séances.
         </p>`
      }

      ${
      !["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)
      ? `<div class="v73-action-group v73-action-validation">
           <div class="v73-action-title">Validation</div>
           <button id="v73-validate" class="v73-btn v73-btn-success">
             ✓ Valider les propositions sélectionnées
           </button>
         </div>`
      : ""
      }
    </section>

    <section class="v73-pia-panel v73-meetings-section" id="v73-panel-meetings" role="tabpanel" aria-labelledby="v73-tab-meetings" tabindex="0" data-v73-pia-panel="meetings" hidden>
      <h3>Réunion de décembre</h3>
      ${piaMeetingEditor(pia,"meeting1","Réunion de décembre","REUNION_1_DECEMBRE")}
      <h3>Réunion de fin d’année</h3>
      ${piaMeetingEditor(pia,"meeting2","Réunion de fin d’année","REUNION_2_FIN_ANNEE")}
      ${pia.lifecycle==="EN_REEVALUATION"?`<div class="v73-actions"><button type="button" id="v73-review-confirm" class="v73-btn v73-btn-success">Confirmer la réévaluation et maintenir en vigueur</button></div>`:""}
      ${pia.lifecycle==="EN_VIGUEUR"&&pia.meeting2?.status==="REEVALUATION_VALIDEE"?`<div class="v73-actions"><button type="button" id="v73-finalize" class="v73-btn v73-btn-primary">Finaliser l’année</button></div>`:""}
    </section>

    <section class="v73-pia-panel" id="v73-panel-tracking" role="tabpanel" aria-labelledby="v73-tab-tracking" tabindex="0" data-v73-pia-panel="tracking" hidden>
      ${piaAnnualTracking(pia)}
    </section>

    <details class="v73-export-disclosure">
      <summary>Exporter le PIA</summary>
      <div class="v73-action-group v73-action-export">
        <div class="v73-action-title">Formats d’export</div>

      <div class="v73-export-row">
        <label>
          Format d’export
          <select id="v73-export-format">
            <option value="docx">Word (.docx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
        </label>

        <button id="v73-export-prof" class="v73-btn v73-btn-primary">
          Exporter le PIA professionnel
        </button>

        <button id="v73-export-deid" class="v73-btn v73-btn-neutral">
          Exporter le modèle dé-identifié
        </button>
      </div>

      <div class="v73-actions">
        <button id="v73-json" class="v73-btn v73-btn-primary">
          Export JSON professionnel
        </button>

        <button id="v73-deid-json" class="v73-btn v73-btn-neutral">
          Export JSON dé-identifié
        </button>
      </div>
      </div>
    </details>

    <details class="v73-export-disclosure v73-management-disclosure">
      <summary>Actions sur le projet</summary>
      <div class="v73-action-group v73-action-management">
        <div class="v73-action-title">Projet</div>

      <div class="v73-actions">
        <button id="v73-close" class="v73-btn v73-btn-neutral">
          Fermer
        </button>

        ${
          ["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)
          ? `<button id="v73-delete" class="v73-btn v73-btn-danger">
               Supprimer le PIA annuel
             </button>`
          : `<button id="v73-cancel" class="v73-btn v73-btn-neutral">
               Annuler le projet
             </button>`
        }
      </div>
      </div>
    </details>
  `;

  bindPIASectionTabs(box);
  setPIASection(box,activeSection);

  box.querySelectorAll("[data-v73-domain-index]").forEach(field=>field.addEventListener("change",async()=>{
    const section=pia.sections[Number(field.dataset.v73DomainIndex)],key=field.dataset.v73DomainField;
    if(!section||!PIA_DOMAIN_FIELDS.some(([fieldKey])=>fieldKey===key))return;
    section[key]=field.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    try{await persistPIAEdit(pia);window.showAppToast?.("Modifications du domaine enregistrées.","success",2200);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v73-meeting-field]").forEach(field=>field.addEventListener("change",async()=>{
    const meeting=pia[field.dataset.v73Meeting],path=String(field.dataset.v73MeetingField||"").split("."),leaf=path.pop();
    if(!meeting||!leaf)return;
    let target=meeting;path.forEach(key=>{target[key]??={};target=target[key];});target[leaf]=field.value;meeting.source="REUNION";meeting.updatedAt=new Date().toISOString();
    try{await persistPIAEdit(pia);window.showAppToast?.("Éléments de réunion enregistrés.","success",2200);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v73-participant]").forEach(field=>field.addEventListener("change",async()=>{
    const meeting=pia[field.dataset.v73Meeting];if(!meeting)return;
    meeting.participants??={};meeting.participants[field.dataset.v73Participant]=field.checked;meeting.source="REUNION";meeting.updatedAt=new Date().toISOString();
    try{await persistPIAEdit(pia);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  const showDomain=index=>{
    if(!Number.isInteger(index)||!domains[index])return;
    box.dataset.v73ActiveDomain=String(index);
    render(pia);
    box.querySelector(`[data-v73-domain-select="${index}"]`)?.focus();
  };
  box.querySelectorAll("[data-v73-domain-jump]").forEach(button=>button.addEventListener("click",()=>showDomain(Number(button.dataset.v73DomainJump))));
  box.querySelectorAll("[data-v73-domain-select]").forEach(button=>button.addEventListener("click",()=>showDomain(Number(button.dataset.v73DomainSelect))));
  box.querySelector("[data-v73-domain-back]")?.addEventListener("click",()=>{
    box.dataset.v73ActiveDomain="";
    render(pia);
    box.querySelector("[data-v73-domain-jump]")?.focus();
  });
  box.querySelectorAll("[data-v73-proposal-save]").forEach(button=>button.addEventListener("click",async()=>{
    const index=Number(button.dataset.v73ProposalSave),proposal=pia.propositions[index],field=box.querySelector(`[data-v73-prop-formulation="${index}"]`),formulation=String(field?.value||"").trim();
    if(!proposal||!formulation){window.showAppToast?.("La formulation ne peut pas être vide.","info",3000);return;}
    proposal.formulation=formulation;
    try{await persistPIAEdit(pia,true);render(pia);window.showAppToast?.("Formulation enregistrée.","success",2500);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v73-proposal-accept],[data-v73-proposal-reject]").forEach(button=>button.addEventListener("click",async()=>{
    const accepting=button.hasAttribute("data-v73-proposal-accept"),index=Number(button.dataset.v73ProposalAccept??button.dataset.v73ProposalReject);
    if(!decidePIAProposal(pia,index,accepting?"VALIDEE":"REFUSEE")){window.showAppToast?.("Vérifiez la formulation de la proposition.","info",3000);return;}
    try{await persistPIAEdit(pia,true);V73.ui.piaDraftPersisted=true;render(pia);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v73-domain-jump]").forEach(button=>button.setAttribute("aria-label",`Afficher ${domains[Number(button.dataset.v73DomainJump)]?.aspect||"le domaine"}`));

  box.querySelector("#v73-validate")?.addEventListener("click",async()=>{
    const chosen=[...box.querySelectorAll("[data-v73-prop]:checked")].map(field=>Number(field.dataset.v73Prop));

    if(!chosen.length){
      window.showAppToast?.(
        "Sélectionnez au moins une proposition à valider.",
        "info",
        3500
      );
      return;
    }

    pia.meeting1.objectivesValidated=[
      ...(pia.meeting1.objectivesValidated||[]),
    ];
    const accepted=chosen.map(index=>decidePIAProposal(pia,index,"VALIDEE"));
    if(!accepted.some(Boolean))return;

    try{
      await savePia(pia,true);
      V73.ui.piaDisplayMode="active";
      V73.ui.piaDraftStudentId="";
      V73.ui.piaDraftPersisted=true;
      render(pia);
    }catch(e){
      window.showAppToast?.(
        "⚠️ Validation impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  });

  box.querySelector("#v73-review-confirm")?.addEventListener("click",async()=>{
    pia.lifecycle="EN_VIGUEUR";pia.meeting2.status="REEVALUATION_VALIDEE";pia.meeting2.validatedAt=new Date().toISOString();
    try{await savePia(pia,true);render(pia);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  });
  box.querySelector("#v73-finalize")?.addEventListener("click",async()=>{
    const ok=window.confirm("Finaliser ce PIA annuel ?\n\nLe dossier restera consultable et son export professionnel pourra être produit.");if(!ok)return;
    pia.lifecycle="FINALISE";pia.finalizedAt=new Date().toISOString();pia.meeting2.status="FINALISE";
    try{await savePia(pia,true);render(pia);}catch(e){window.showAppToast?.("⚠️ Finalisation impossible : "+(e?.message||e),"error",4500);}
  });

  const exportPia=async deid=>{
    try{
      const fmt=box.querySelector("#v73-export-format")?.value||"docx";
      const target=piaForExport(pia,deid);
      const base=deid
        ?"PIA_modele_deidentifie_V73"
        :"PIA_professionnel_V73";

      if(fmt==="docx"){
        downloadBytes(
          `${base}.docx`,
          makeDocx(piaTextSections(target,deid)),
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
      }else{
        downloadBytes(
          `${base}.pdf`,
          makePdf(piaTextSections(target,deid)),
          "application/pdf"
        );
      }

      window.showAppToast?.(
        `✓ Export ${fmt.toUpperCase()} généré localement.`,
        "success",
        3500
      );

      closePIAProject();
    }catch(e){
      window.showAppToast?.(
        "⚠️ Export impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  };

  box.querySelector("#v73-export-prof")?.addEventListener("click",()=>exportPia(false));
  box.querySelector("#v73-export-deid")?.addEventListener("click",()=>exportPia(true));

  box.querySelector("#v73-json")?.addEventListener("click",()=>{
    download(
      "PIA_professionnel_V73.json",
      JSON.stringify(pia,null,2)
    );
    closePIAProject();
  });

  box.querySelector("#v73-deid-json")?.addEventListener("click",()=>{
    download(
      "PIA_modele_deidentifie_V73.json",
      JSON.stringify(piaForExport(pia,true),null,2)
    );
    closePIAProject();
  });

  box.querySelector("#v73-close")?.addEventListener("click",()=>{
    closePIAProject();
  });

  box.querySelector("#v73-cancel")?.addEventListener("click",async()=>{
    const ok=window.confirm(
      "Annuler ce projet de PIA ?\n\n"+
      "Le projet non validé sera abandonné.\n"+
      "Les séances et le PIA importé de continuité resteront conservés."
    );

    if(!ok)return;

    try{
      if(pia.lifecycle==="EN_CONSTRUCTION" && pia.studentId && V73.ui.piaDraftPersisted){
        await deletePIARecord(pia.studentId);
      }

      clearPIAResult();
      window.showAppToast?.(
        "Projet de PIA annulé. Les séances sont conservées.",
        "info",
        3500
      );
    }catch(e){
      window.showAppToast?.(
        "⚠️ Annulation impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  });

  box.querySelector("#v73-delete")?.addEventListener("click",async()=>{
    const ok=window.confirm(
      "Supprimer le PIA annuel de cet élève ?\n\n"+
      "Le PIA enregistré sera supprimé de Journalier.\n"+
      "Les séances et observations resteront conservées.\n\n"+
      "Cette action ne doit être utilisée que pour corriger une création ou validation erronée."
    );

    if(!ok)return;

    try{
      await deletePIARecord(pia.studentId);
      clearPIAResult();
      refreshPIAContinuity();

      window.showAppToast?.(
        "PIA annuel supprimé. Les séances sont conservées.",
        "success",
        4000
      );
    }catch(e){
      window.showAppToast?.(
        "⚠️ Suppression impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  });
}

async function savePia(pia,cloud=true,notify=true){
  const ds=window.JournalierDataStore; const st=ds.getState(); st.meta??={}; st.meta.piaRecords??={}; st.meta.piaImports??={}; st.meta.piaRecords[pia.studentId]=pia;
  if(pia.sourceContinuity?.present) st.meta.piaImports[pia.studentId]=pia.sourceContinuity;
  window.JournalierMigrationBridge?.v72MarkPiaPending?.(st,pia.studentId);
  await ds.persistState(st);
  if(cloud && window.JournalierCloud?.savePia) {
    try{
      await window.JournalierCloud.savePia(pia);
      window.JournalierMigrationBridge?.v72MarkPiaSynced?.(st,pia.studentId,pia);
      await ds.persistState(st);
      if(notify)window.showAppToast?.("✓ PIA enregistré localement et dans OneDrive.","success",4000);
    }
    catch(e){if(notify)window.showAppToast?.("✓ PIA enregistré localement. Renvoi automatique vers OneDrive dès que possible.","info",4500);}
  }
  window.journalierScheduleAutoSync?.();
}
async function loadRef(){
  try{V73.referential=await fetch("./referentiel_pia_v73_0_3.json",{cache:"no-store"}).then(r=>r.ok?r.json():null);}catch(_){V73.referential=null;}
}

function getImportedPIA(studentId){try{return getData().state.meta?.piaImports?.[studentId]||getData().state.meta?.piaRecords?.[studentId]?.sourceContinuity||null;}catch(_){return null;}}
async function persistImportedPIA(studentId,imported){
  const ds=window.JournalierDataStore; if(!ds?.isReady?.())throw new Error("Connectez-vous à Microsoft avant d’enregistrer le PIA.");
  const st=ds.getState();st.meta??={};st.meta.piaImports??={};const safe=JSON.parse(JSON.stringify(imported||{}));delete safe.displayName;safe.fileName="";st.meta.piaImports[studentId]=safe;await ds.persistState(st);
}
function dashboardTrendData(){
  const d=getData(), since=new Date(); since.setDate(since.getDate()-30); const recent=d.sessions.filter(s=>s?.type==="SEANCE"&&dateOnly(s.identification?.date)>=since.toISOString().slice(0,10));
  const map={}; for(const s of recent){for(const u of extractUnits(s)){if(u.themeId==="mathematiques")continue;const k=u.themeId;map[k]??={theme:u.theme,sessionIds:new Set()};map[k].sessionIds.add(String(u.sessionId));}}
  return Object.values(map).map(x=>({...x,count:x.sessionIds.size})).sort((a,b)=>b.count-a.count).slice(0,5);
}
function dashboardPiaData(){const d=getData(), records=Object.values(d.state.meta?.piaRecords||{});return {active:records.filter(p=>["ACTIF","EN_VIGUEUR"].includes(p.lifecycle)).length,toComplete:records.filter(p=>p.lifecycle==="EN_CONSTRUCTION").length,toReview:records.filter(p=>p.lifecycle==="EN_REEVALUATION").length,finalized:records.filter(p=>p.lifecycle==="FINALISE").length};}
async function updateDashboardMemos(update){
  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.()){
    window.showAppToast?.("Déverrouillez votre session Microsoft pour modifier les mémos.","info",3500);
    renderDashboard();
    return;
  }
  try{
    const state=ds.getState();state.meta??={};state.meta.dashboardMemos=safeArray(state.meta.dashboardMemos);
    update(state.meta.dashboardMemos);
    await ds.persistState(state);
    renderDashboard();
  }catch(_){window.showAppToast?.("⚠️ Le mémo n’a pas pu être enregistré. Réessayez après avoir vérifié la session.","error",4500);}
}
function renderDashboard(){
  const host=Array.from(document.querySelectorAll("#view-accueil > .card")).find(x=>norm(x.textContent||"").includes("acces rapide"));if(!host)return;
  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.()){
    const connected=document.getElementById("ms-dot")?.classList.contains("connected");
    host.innerHTML=`<div class="v73-dashboard-state"><div class="page-kicker">Tableau de bord</div><div class="v73-empty">${connected?"Ouverture du coffre local sécurisé…":"Connectez-vous avec Microsoft pour afficher les tendances, le suivi PIA et vos mémos."}</div></div>`;
    return;
  }
  try{
    const trends=dashboardTrendData(),pia=dashboardPiaData(),memos=safeArray(getData().state.meta?.dashboardMemos);
    host.innerHTML=`<div class="v73-dashboard-grid"><section><div class="page-kicker">Tendances observées · 30 derniers jours</div><h3 class="v73-dash-title">Ce qui ressort des séances</h3><p class="v73-dash-help">Synthèse descriptive des observations enregistrées. Elle ne constitue pas une évaluation ni un score de difficulté.</p>${trends.length?`<div class="v73-trends">${trends.map(t=>`<button class="v73-trend-row" data-v73-trend="${esc(t.theme)}"><span>${esc(t.theme)}</span><span class="v73-trend-bar"><i style="width:${Math.min(100,Math.max(12,t.count*18))}%"></i></span><strong>${t.count} séance${t.count>1?"s":""}</strong></button>`).join("")}</div>`:`<div class="v73-empty">Pas encore assez de séances pour dégager une tendance. Les synthèses apparaîtront au fur et à mesure des observations.</div>`}<button class="v73-link" data-v73-go-reports>Voir les rapports →</button></section>
    <section><div class="page-kicker">Suivi PIA</div><h3 class="v73-dash-title">PIA annuel</h3><div class="v73-pia-stats"><div><strong>${pia.active}</strong><span>en vigueur</span></div><div><strong>${pia.toComplete}</strong><span>à compléter</span></div><div><strong>${pia.toReview}</strong><span>à réévaluer</span></div><div><strong>${pia.finalized}</strong><span>finalisé(s)</span></div></div><button class="v73-link" data-v73-go-reports>Ouvrir le suivi PIA →</button></section>
    <section><div class="page-kicker">Mes mémos</div><h3 class="v73-dash-title">À ne pas oublier</h3><div class="v73-memo-list">${memos.length?memos.map((m,i)=>`<label class="v73-memo"><input type="checkbox" data-v73-memo-done="${i}" ${m.done?'checked':''}><span>${esc(m.text)}</span><button type="button" data-v73-memo-delete="${i}" aria-label="Supprimer le mémo">×</button></label>`).join(""):"<div class=\"v73-empty\">Aucun mémo personnel.</div>"}</div><div class="v73-memo-add"><input id="v73-memo-input" type="text" maxlength="180" placeholder="Ajouter un mémo…"><button class="btn-secondary" id="v73-memo-add">Ajouter</button></div></section></div>`;
    host.querySelectorAll("[data-v73-go-reports]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelectorAll("[data-v73-trend]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelector("#v73-memo-add")?.addEventListener("click",()=>{const input=host.querySelector("#v73-memo-input"),text=String(input?.value||"").trim();if(!text)return;updateDashboardMemos(memos=>memos.push({id:uid("memo"),text,done:false,createdAt:new Date().toISOString()}));});
    host.querySelectorAll("[data-v73-memo-done]").forEach(x=>x.addEventListener("change",()=>updateDashboardMemos(memos=>{const memo=memos[Number(x.dataset.v73MemoDone)];if(memo)memo.done=x.checked;})));
    host.querySelectorAll("[data-v73-memo-delete]").forEach(x=>x.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();updateDashboardMemos(memos=>memos.splice(Number(x.dataset.v73MemoDelete),1));}));
  }catch(_){host.innerHTML='<div class="v73-dashboard-state"><div class="page-kicker">Tableau de bord</div><div class="v73-empty">Le tableau de bord est momentanément indisponible.</div><button type="button" class="v73-link" data-v73-dashboard-retry>Réessayer</button></div>';host.querySelector('[data-v73-dashboard-retry]')?.addEventListener("click",renderDashboard);}
}
function openPIAFilePicker(){document.getElementById("student-pia-file")?.click();}
async function handlePIAFileForStudent(file,studentId){const parsed=await parsePIAFile(file);parsed.displayName=file.name;await persistImportedPIA(String(studentId),parsed);window.showAppToast?.("✓ PIA importé et structuré localement. Le document original n’est pas conservé par Journalier.","success",5000);return parsed;}
async function handleStudentPIAFileChange(input){const file=input?.files?.[0];if(!file)return;const rawId=document.getElementById("student-modal-id")?.value;let studentId="";if(rawId){try{const student=getData().students.find(s=>String(s.id)===String(rawId));studentId=student?String(student.studentId||student.id):String(rawId);}catch(_){studentId=String(rawId);}}const status=document.getElementById("pia-local-security-status"),target=document.getElementById("student-pia-file-name");try{if(status)status.textContent="⏳ Analyse locale du PIA…";const parsed=studentId?await handlePIAFileForStudent(file,studentId):await parsePIAFile(file);window.__journalierPendingPIAImport=studentId?null:{parsed,studentId:""};if(target)target.textContent=`✓ ${file.name} · ${parsed.format.toUpperCase()} · ${parsed.extracted.objectives.length} objectif(s), ${parsed.extracted.difficulties.length} difficulté(s), ${parsed.extracted.adaptations.length} adaptation(s)`;if(status)status.textContent="✓ Analyse locale terminée — le document original n’est pas conservé.";}catch(e){if(status)status.textContent="⚠️ Import impossible";window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);}}
function bindPIAImport(){const input=document.getElementById("student-pia-file");if(!input||input.dataset.v73Bound)return;input.dataset.v73Bound="1";input.accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";input.addEventListener("change",()=>handleStudentPIAFileChange(input));}
function attachPendingPIAImportWatcher(){const modal=document.getElementById("studentModal");if(!modal||modal.dataset.v73Watch)return;modal.dataset.v73Watch="1";const observer=new MutationObserver(async()=>{if(!modal.classList.contains("hidden")||!window.__journalierPendingPIAImport)return;const pending=window.__journalierPendingPIAImport,studentId=String(pending.studentId||"").trim();if(!studentId)return;try{const d=getData(),student=d.students.find(s=>String(s.studentId||s.id)===studentId);if(!student)return;await persistImportedPIA(studentId,pending.parsed);const ds=window.JournalierDataStore,st=ds.getState();const cleaned=st.students.map(s=>{const x={...s};delete x.piaFileName;return x;});ds.saveStudents(cleaned);await ds.persistState(st);window.__journalierPendingPIAImport=null;window.showAppToast?.("✓ PIA associé au dossier de l’élève. Le nom du fichier original n’est pas conservé.","success",4000);}catch(e){window.showAppToast?.("⚠️ Association du PIA impossible : "+(e?.message||e),"error",5000);}});observer.observe(modal,{attributes:true,attributeFilter:["class"]});}
async function scrubLegacyPIAFilenames(){try{const ds=window.JournalierDataStore;if(!ds?.isReady?.())return;const st=ds.getState();let changed=false;const students=st.students.map(s=>{if(!s?.piaFileName)return s;const x={...s};delete x.piaFileName;changed=true;return x;});if(changed){ds.saveStudents(students);await ds.persistState(st);}}catch(_){}}
function bindHomeDashboard(){renderDashboard();const list=document.getElementById("home-today-list");if(list&&!list.__v73Obs){const obs=new MutationObserver(()=>renderDashboard());obs.observe(list,{childList:true});list.__v73Obs=obs;}document.getElementById("tab-btn-accueil")?.addEventListener("click",()=>setTimeout(renderDashboard,0));}
function addUI(){
  const host=document.getElementById("reports-pia-mount");
  if(!host || document.getElementById("v73-pia-card"))return;
  const card=document.createElement("div"); card.id="v73-pia-card"; card.className="card";
  card.innerHTML=`<div class="page-kicker">PIA ANNUEL</div><h2 class="page-title" style="font-size:1.15rem">Construire / réévaluer le PIA</h2>
  <div class="report-intro">Le PIA est annuel. Les séances alimentent les éléments de preuve. La réunion 1 (décembre) réévalue les objectifs existants ou permet de co-construire un premier PIA ; la réunion 2 évalue la trajectoire en fin d’année.</div>
  <div class="grid-2"><div class="v73-pia-student-context"><span>PIA de l’élève sélectionné</span><strong id="v73-pia-selected-student">Choisissez un élève dans l’en-tête.</strong><select id="v73-pia-student" hidden aria-hidden="true" tabindex="-1"></select></div><div><label for="v73-pia-date">Date de référence</label><input id="v73-pia-date" type="date"></div></div>
  <div id="v73-pia-continuity" class="v73-continuity"></div>
  <div class="v73-actions"><button id="v73-build" class="btn-primary">Générer le projet de PIA</button><button id="v73-meeting2" class="btn-secondary">Préparer la réévaluation fin d’année</button></div>
  <div id="v73-pia-result" class="v73-result"></div>`;
  host.appendChild(card);
  refreshStudents();
  document.getElementById("v73-build").onclick=()=>run(false); document.getElementById("v73-meeting2").onclick=()=>run(true);
  document.getElementById("v73-pia-student").addEventListener("change",()=>{
    clearPIAResult();
    refreshPIAContinuity();
  });
  const reportStudent=document.getElementById("r-eleve");
  reportStudent?.addEventListener("change",syncPIAStudentFromReports);
  reportStudent?.addEventListener("journalier:student-context-change",syncPIAStudentFromReports);
  syncPIAStudentFromReports();
  refreshPIAContinuity(); bindPIAImport(); attachPendingPIAImportWatcher(); bindHomeDashboard();
}
function refreshPIAContinuity(){
  const sid=document.getElementById("v73-pia-student")?.value,host=document.getElementById("v73-pia-continuity");
  if(!host)return;
  if(!sid){host.innerHTML='<div class="v73-import-help">Choisissez un élève pour afficher la continuité PIA disponible.</div>';return;}
  const imported=getImportedPIA(sid);
  if(imported?.present||imported?.extracted){
    const e=imported.extracted||{};
    host.innerHTML=`<div class="v73-import-summary"><b>✓ PIA précédent disponible</b><span>${esc(imported.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;
  }else{
    host.innerHTML='<div class="v73-import-help">PIA précédent : utilisez <b>Élèves → dossier de l’élève → Importer le PIA</b>. Le fichier Word/PDF est traité localement ; seul le contenu structuré validé est conservé.</div>';
  }
}
function syncPIAStudentFromReports(){
  const select=document.getElementById("v73-pia-student"),label=document.getElementById("v73-pia-selected-student");
  if(!select)return;
  const previous=select.value,name=document.getElementById("r-eleve")?.value||"";
  let data;try{data=getData()}catch(_){return;}
  const student=data.students.find(item=>String(item.nom||"")===String(name));
  refreshStudents();
  if(label)label.textContent=student?.nom||"Choisissez un élève dans l’en-tête.";
  if(previous!==select.value)select.dispatchEvent(new Event("change",{bubbles:true}));
}
function refreshStudents(){
  const sel=document.getElementById("v73-pia-student"); if(!sel)return;
  let d; try{d=getData()}catch(_){return;}
  const reportName=document.getElementById("r-eleve")?.value||"";
  const student=d.students.find(item=>String(item.nom||"")===String(reportName));
  sel.innerHTML=`<option value="">Sélectionnez un élève</option>${d.students.map(s=>`<option value="${esc(s.studentId)}">${esc(s.nom)}</option>`).join("")}`;
  sel.value=student?String(student.studentId):"";
  const selectedLabel=document.getElementById("v73-pia-selected-student");
  if(selectedLabel)selectedLabel.textContent=student?.nom||"Choisissez un élève dans l’en-tête.";
  const date=document.getElementById("v73-pia-date"),bounds=currentPIASchoolYearBounds();
  if(date){date.min=bounds.start;date.max=bounds.end;if(!date.value){const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;date.value=today>=bounds.start&&today<=bounds.end?today:bounds.start;}}
  refreshPIAContinuity();
}
async function run(meeting2){
  try{
    const d=getData();
    refreshStudents();

    const sid=document.getElementById("v73-pia-student")?.value;
    const student=d.students.find(s=>String(s.studentId)===String(sid));
    if(!student)throw new Error("Aucun élève sélectionné.");

    const until=document.getElementById("v73-pia-date")?.value||new Date().toISOString().slice(0,10);
    const schoolYear=piaSchoolYear(until);
    if(!schoolYear){const bounds=currentPIASchoolYearBounds();throw new Error(`Choisissez une date comprise entre le ${bounds.start} et le ${bounds.end}.`);}
    const stored=d.state.meta?.piaRecords?.[student.studentId]||null;
    const existing=stored&&(!stored.schoolYear||stored.schoolYear===schoolYear)?stored:null;
    const previousYear=stored&&stored.schoolYear&&stored.schoolYear!==schoolYear?stored:null;
    const imported=d.state.meta?.piaImports?.[student.studentId]||null;
    const previousAnnualContinuity=previousYear?(()=>{
      const objectives=parsePreviousObjectives(student,previousYear).map(item=>typeof item==="string"?item:item.formulation||"").filter(Boolean);
      const sections=safeArray(previousYear.sections);
      return {
        lifecycle:"EN_CONSTRUCTION",
        sourceContinuity:{present:true,role:"SOURCE_DE_CONTINUITE",format:"PIA_JOURNALIER",fileName:"",importedAt:previousYear.finalizedAt||previousYear.generatedAt||"",extracted:{
          objectives,resources:[...new Set(sections.flatMap(section=>safeArray(section.ressources)))],
          difficulties:[...new Set(sections.flatMap(section=>safeArray(section.difficultes)))],
          adaptations:safeArray(previousYear.amenagements).map(item=>`${item.type||""} — ${item.texte||""}`.trim())
        }},
        meeting1:{objectivesPrevious:objectives.map(formulation=>({formulation,status:"EXISTANT_A_REEVALUER",source:"PIA_PRECEDENT"}))}
      };
    })():null;
    const continuityExisting=existing||previousAnnualContinuity||(imported?{sourceContinuity:imported,meeting1:{objectivesPrevious:[]}}:null);

    if(meeting2&&!existing)throw new Error("La réévaluation de fin d’année nécessite le PIA en vigueur de la même année scolaire.");
    if(meeting2&&!['EN_VIGUEUR','EN_REEVALUATION'].includes(normalizePIALifecycle(existing)))throw new Error("Validez d’abord le PIA de décembre avant de préparer la réévaluation de fin d’année.");

    const pia=buildPIA(student,d.sessions,until,continuityExisting);

    if(meeting2){
      pia.meeting2={
        ...pia.meeting2,
        status:"EN_REEVALUATION",
        evaluation:evaluateMeeting2(pia,existing),
        objectivesToContinue:pia.meeting1.objectivesValidated||[],
        perspectives:pia.meeting2?.perspectives||[]
      };
      pia.lifecycle="EN_REEVALUATION";
    }else if(!["EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)){
      pia.lifecycle="EN_CONSTRUCTION";
    }

    V73.state=pia;
    V73.ui.piaDisplayStudentId=String(student.studentId);
    V73.ui.piaDisplayMode=meeting2?"review":"draft";
    V73.ui.piaDraftStudentId=meeting2?"":String(student.studentId);
    V73.ui.piaDraftPersisted=false;

    /*
     * Un projet simple n'est pas persisté avant validation.
     * La réévaluation conserve le mécanisme de sauvegarde existant.
     */
    if(meeting2){
      await savePia(pia,true);
    }

    render(pia);

    window.showAppToast?.(
      `✓ ${meeting2?"Réévaluation":"Projet de PIA"} généré pour ${student.nom}.`,
      "success",
      4000
    );
  }catch(e){
    window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);
  }
}

window.JournalierV73={...V73,buildPIA,run,refreshStudents,loadRef,parsePIAFile,extractPIAStructure,renderDashboard,piaSchoolYear,piaSchoolYearBounds,exportTextDocument,requestPIASection,getImportedPIA,piaImportDossierHtml};
const style=document.createElement("style");style.textContent=`
#v73-pia-card{margin-top:16px}.v73-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center}.v73-summary span:not(.v73-status-badge),.v73-summary b{padding:6px 9px;border-radius:8px;background:#f1f5f9}.v73-summary-main{display:flex;align-items:center;gap:8px}.v73-status-badge{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;font-weight:750;font-size:.82rem}.v73-status-badge.is-success{background:#dcfce7;color:#166534}.v73-status-badge.is-warning{background:#fef3c7;color:#92400e}.v73-notice{padding:11px;border-left:4px solid #2563eb;background:#eff6ff;border-radius:8px;margin:10px 0;font-size:.82rem;line-height:1.45}.v73-notice-warning{border-left-color:#f59e0b;background:#fffbeb}.v73-proposals{display:grid;gap:12px;margin:14px 0}.v73-prop{display:grid;grid-template-columns:42px minmax(0,1fr);gap:14px;align-items:center;padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#fff;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease}.v73-prop:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(15,23,42,.07);border-color:#bfdbfe}.v73-prop:has(input:checked){border-color:#60a5fa;background:#eff6ff;box-shadow:0 4px 14px rgba(37,99,235,.10)}.v73-prop-select{display:grid;place-items:center}.v73-prop-select input{position:absolute;opacity:0;pointer-events:none}.v73-checkmark{width:24px;height:24px;border:2px solid #cbd5e1;border-radius:7px;background:#fff;position:relative;transition:border-color .15s ease,background .15s ease}.v73-prop input:checked+.v73-checkmark{border-color:#2563eb;background:#2563eb}.v73-prop input:checked+.v73-checkmark::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px}.v73-prop-body{min-width:0}.v73-prop-title{display:block;font-weight:750;color:#172033;margin-bottom:5px}.v73-prop-formulation{display:block;color:#334155;line-height:1.45}.v73-prop-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;color:#64748b;font-size:.75rem}.v73-prop-meta>span{padding:4px 7px;border-radius:999px;background:#f1f5f9}.v73-badge-warning{background:#fff7ed!important;color:#9a3412!important}.v73-action-group{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}.v73-action-title{margin-bottom:9px;font-size:.76rem;font-weight:750;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.v73-btn{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:650;transition:filter .15s ease,transform .15s ease}.v73-btn:hover{filter:brightness(.97);transform:translateY(-1px)}.v73-btn:active{transform:translateY(0)}.v73-btn-primary{background:#0a84ff;color:#fff}.v73-btn-success{background:#16a34a;color:#fff}.v73-btn-warning{background:#f59e0b;color:#fff}.v73-btn-neutral{background:#eef2f7;color:#172033}.v73-btn-danger{background:#dc2626;color:#fff}.v73-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v73-result{margin-top:14px}.v73-continuity{margin-top:12px}.v73-import-help{padding:11px 13px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;color:#475569;font-size:.78rem}.v73-import-summary{display:flex;gap:7px;flex-wrap:wrap;padding:10px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;color:#166534;font-size:.76rem}.v73-import-summary span,.v73-import-summary b{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.72)}.v73-export-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#fafafa}.v73-export-row label{font-size:.75rem;color:#475569;display:grid;gap:5px}.v73-export-row select{padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.v73-empty{padding:10px 0;color:#64748b;font-size:.76rem}.v73-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.7fr) minmax(260px,.85fr);gap:14px}.v73-dashboard-grid>section{padding:16px;border:1px solid var(--border);border-radius:13px;background:#fff;min-width:0}.v73-dash-title{margin:0 0 5px;font-size:1rem}.v73-dash-help{margin:0 0 11px;color:#64748b;font-size:.72rem;line-height:1.45}.v73-trends{display:grid;gap:7px}.v73-trend-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(80px,1.2fr) auto;gap:8px;align-items:center;border:0;background:transparent;padding:5px 0;text-align:left;color:#172033;cursor:pointer}.v73-trend-bar{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.v73-trend-bar i{display:block;height:100%;border-radius:999px;background:#0a84ff}.v73-trend-row strong{font-size:.68rem;color:#64748b;white-space:nowrap}.v73-link{margin-top:10px;border:0;background:transparent;color:#0a84ff;font-weight:700;cursor:pointer;padding:4px 0}.v73-pia-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.v73-pia-stats div{padding:10px;border-radius:9px;background:#f8fafc;text-align:center}.v73-pia-stats strong{display:block;font-size:1.2rem}.v73-pia-stats span{font-size:.65rem;color:#64748b}.v73-memo-list{display:grid;gap:6px;max-height:150px;overflow:auto}.v73-memo{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:7px 8px;background:#f8fafc;border-radius:8px;font-size:.76rem}.v73-memo input:checked+span{text-decoration:line-through;color:#94a3b8}.v73-memo button{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:1rem}.v73-memo-add{display:flex;gap:6px;margin-top:8px}.v73-memo-add input{min-width:0;flex:1;margin:0;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px}.v73-empty{padding:10px 0;color:#64748b;font-size:.76rem}@media(max-width:1100px){.v73-dashboard-grid{grid-template-columns:1fr 1fr}.v73-dashboard-grid>section:first-child{grid-column:1/-1}}@media(max-width:720px){.v73-dashboard-grid{grid-template-columns:1fr}.v73-dashboard-grid>section:first-child{grid-column:auto}.v73-trend-row{grid-template-columns:1fr auto}.v73-trend-bar{grid-column:1/-1}.v73-export-row{align-items:stretch}.v73-export-row>*{width:100%}}
`;document.head.appendChild(style);
const piaLayoutStyle=document.createElement("style");piaLayoutStyle.textContent=`
.v73-domain-section,.v73-meetings-section{margin:20px 0}
.v73-pia-nav{display:flex;gap:3px;overflow-x:auto;margin:15px 0 18px;border-bottom:1px solid #dbe3ef;scrollbar-width:thin}
.v73-pia-nav [role="tab"]{position:relative;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;border:0;border-radius:6px 6px 0 0;background:transparent;padding:11px 13px;color:#64748b;font:inherit;font-size:.78rem;font-weight:650;white-space:nowrap;cursor:pointer}
.v73-pia-nav [role="tab"]:hover,.v73-pia-nav [role="tab"]:focus-visible{color:#1d4ed8;background:#eff6ff;outline:none}
.v73-pia-nav [role="tab"][aria-selected="true"]{color:#1d4ed8;background:#eff6ff}
.v73-pia-nav [role="tab"][aria-selected="true"]::after{content:"";position:absolute;right:10px;bottom:-1px;left:10px;height:2px;border-radius:2px;background:#2563eb}
.v73-pia-nav [role="tab"] span{font-size:.68rem;color:inherit;opacity:.76}
.v73-pia-panel[hidden]{display:none!important}
.v73-pia-panel{min-width:0;scroll-margin-top:16px}
.v73-summary{padding:2px 0 12px;border-bottom:1px solid #e7eaf0}
.v73-summary>span:not(.v73-status-badge){padding:0;border-radius:0;background:transparent;color:#64748b;font-size:.74rem}
.v73-proposals{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start}
.v73-prop{border-radius:8px;box-shadow:0 2px 9px rgba(15,23,42,.045)}
.v73-prop:hover{transform:none;box-shadow:0 4px 12px rgba(15,23,42,.07);border-color:#bfdbfe}
.v73-prop.is-pending{border-left:3px solid #bd7d1a;background:#fff}
.v73-prop.is-validated{border-left:3px solid #23865f;background:#fff}
.v73-prop.is-refused{border-left:3px solid #b34b52;background:#fff}
.v73-prop-state{display:inline-flex;align-items:center;width:max-content;padding:3px 7px;border-radius:999px;background:#f1f4f8;color:#5b687a;font-size:.66rem;font-weight:700}
.v73-prop-state.is-pending{background:#fff0d9;color:#8d5a12}
.v73-prop-state.is-validated{background:#e8f6ef;color:#176b4e}
.v73-prop-state.is-refused{background:#fdebed;color:#9c3b43}
.v73-export-disclosure{margin-top:14px;border-top:1px solid #dbe3ef}
.v73-export-disclosure>summary{width:max-content;max-width:100%;padding:12px 2px;color:#2563eb;font-size:.78rem;font-weight:650;cursor:pointer}
.v73-export-disclosure .v73-action-group{margin-top:0}
.v73-management-disclosure{margin-top:8px}
.v73-pia-student-context{display:grid;align-content:center;gap:5px;min-height:42px}
.v73-pia-student-context span{font-size:.72rem;font-weight:700;color:#64748b}
.v73-pia-student-context strong{font-size:.88rem;font-weight:650;color:#172033}
.v73-pia-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
.v73-domain-section h3,.v73-meetings-section h3{font-size:.95rem;margin:18px 0 9px;color:#26364a}
.v73-domain-overview-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:stretch}
.v73-domain-overview,.v73-domain-record-head{--domain-accent:#51657c;--domain-ink:#3f536b;--domain-wash:#f2f5f8}
.v73-domain-overview.tone-cognitive,.v73-domain-record-head.tone-cognitive{--domain-accent:#6654a6;--domain-ink:#5c4d91;--domain-wash:#f3f0fb}
.v73-domain-overview.tone-communication,.v73-domain-record-head.tone-communication{--domain-accent:#168b83;--domain-ink:#23685f;--domain-wash:#edf8f6}
.v73-domain-overview.tone-affective,.v73-domain-record-head.tone-affective{--domain-accent:#b45a62;--domain-ink:#8c4d55;--domain-wash:#fff2f2}
.v73-domain-overview.tone-autonomy,.v73-domain-record-head.tone-autonomy{--domain-accent:#bd7d1a;--domain-ink:#805c20;--domain-wash:#fff7e9}
.v73-domain-overview.tone-physical,.v73-domain-record-head.tone-physical{--domain-accent:#3977ce;--domain-ink:#2d548e;--domain-wash:#eff5ff}
.v73-domain-overview{display:grid;grid-template-rows:auto auto 1fr auto;align-content:start;gap:9px;min-width:0;min-height:232px;padding:16px;border:1px solid transparent;border-radius:12px;text-align:left;color:var(--domain-ink);background:var(--domain-wash);cursor:pointer;box-shadow:0 3px 12px rgba(25,39,62,.045);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.v73-domain-overview:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(25,39,62,.09)}
.v73-domain-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(255,255,255,.85);border-radius:14px;background:rgba(255,255,255,.82);color:inherit;box-shadow:0 2px 7px rgba(25,39,62,.055)}
.v73-domain-icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.v73-domain-overview:hover{border-color:var(--domain-accent);filter:brightness(.985)}
.v73-domain-overview:focus-visible{outline:3px solid color-mix(in srgb,var(--domain-accent) 28%,transparent);outline-offset:2px}
.v73-domain-overview strong{font-size:.88rem;line-height:1.3}
.v73-domain-overview .v73-domain-metrics{display:flex;flex-wrap:wrap;align-content:start;gap:5px}
.v73-domain-overview .v73-domain-metrics span{padding:4px 6px;border:1px solid rgba(68,91,125,.09);border-radius:5px;background:rgba(255,255,255,.72);color:#58677b;font-size:.64rem;line-height:1.25}
.v73-domain-overview .v73-domain-metrics b{color:inherit;font-size:.71rem}
.v73-domain-overview .v73-domain-action{display:flex;justify-content:space-between;align-items:center;align-self:end;margin-top:8px;padding-top:8px;border-top:1px solid rgba(68,91,125,.12);color:var(--domain-ink);font-size:.68rem;font-weight:700}
.v73-domain-overview-view[hidden]{display:none!important}
.v73-domain-detail-view{min-width:0}
.v73-domain-back{margin:0 0 12px;padding:7px 0;border:0;background:transparent;color:#2563eb;font:inherit;font-size:.74rem;font-weight:650;cursor:pointer}
.v73-domain-detail-layout{display:grid;grid-template-columns:minmax(180px,230px) minmax(0,1fr);gap:14px;align-items:start}
.v73-domain-menu{display:grid;gap:3px;padding:7px;border-radius:8px;background:#f2f4f7}
.v73-domain-menu button{width:100%;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:#59677c;text-align:left;font:inherit;font-size:.74rem;line-height:1.35;cursor:pointer}
.v73-domain-menu button:hover{background:#e9edf3}
.v73-domain-menu button[aria-current="true"]{background:#fff;color:#1d4ed8;font-weight:700;box-shadow:0 1px 3px rgba(25,39,62,.06)}
.v73-domain-record{min-width:0;padding:14px;border:1px solid #e7eaf0;border-radius:9px;background:#fff;box-shadow:0 3px 12px rgba(25,39,62,.035)}
.v73-domain-record-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:10px;padding:12px 13px;border-left:3px solid var(--domain-accent);border-radius:7px;background:var(--domain-wash)}
.v73-domain-record-head h3{margin:2px 0 0;font-size:1rem;color:var(--domain-ink)}
.v73-domain-record-head>span{padding:4px 7px;border-radius:5px;background:#f1f4f8;color:#64748b;font-size:.67rem;white-space:nowrap}
.v73-domain-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px}
.v73-domain-fieldset{--field-accent:#3977ce;--field-wash:#f3f7fc;min-width:0;align-self:start;border:1px solid rgba(68,91,125,.11);border-left:3px solid var(--field-accent);border-radius:7px;background:var(--field-wash);overflow:hidden}
.v73-domain-fieldset.is-ressources{--field-accent:#168b83;--field-wash:#eff8f6}
.v73-domain-fieldset.is-difficultes{--field-accent:#bd7d1a;--field-wash:#fff8ed}
.v73-domain-fieldset.is-objectifs{--field-accent:#3977ce;--field-wash:#eff5ff}
.v73-domain-fieldset.is-criteres{--field-accent:#2187a3;--field-wash:#eff8fa}
.v73-domain-fieldset.is-moyens{--field-accent:#745bc7;--field-wash:#f5f2fb}
.v73-domain-fieldset.is-evolution{--field-accent:#23865f;--field-wash:#eff8f3}
.v73-domain-fieldset>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 12px;color:#27364b;font-size:.76rem;font-weight:700;cursor:pointer;list-style:none}
.v73-domain-fieldset[open]>summary{color:var(--field-accent)}
.v73-domain-fieldset>summary::-webkit-details-marker{display:none}
.v73-domain-fieldset>summary::after{content:"⌄";color:#7b8797;font-size:.85rem}
.v73-domain-fieldset[open]>summary::after{content:"⌃"}
.v73-domain-fieldset>summary span{margin-left:auto;color:#778398;font-size:.68rem;font-weight:500}
.v73-domain-field-content{display:grid;gap:10px;padding:0 11px 12px}
.v73-domain-value-list{display:flex;flex-wrap:wrap;gap:6px}
.v73-domain-value{display:inline-flex;max-width:100%;padding:6px 9px;border:1px solid rgba(68,91,125,.10);border-left:2px solid var(--field-accent);border-radius:6px;background:rgba(255,255,255,.9);color:#39475c;font-size:.73rem;line-height:1.4;overflow-wrap:anywhere}
.v73-domain-empty{margin:0 0 10px;color:#7b8797;font-size:.74rem}
.v73-pia-dossier{display:grid;gap:10px;margin-top:10px}
.v73-domain-value-list-row{--field-accent:#745bc7;display:grid;gap:6px;padding:8px 0}
.v73-domain-value-list-row .v73-domain-value-label{font-size:.68rem;font-weight:750;text-transform:uppercase;color:#627087}
.v73-pia-dossier>summary,.v73-domain-record>summary{list-style:none;cursor:pointer}
.v73-pia-dossier>summary::-webkit-details-marker,.v73-domain-record>summary::-webkit-details-marker{display:none}
.v73-pia-dossier>summary::after{content:"Déplier ⌄";margin-left:auto;color:#166534;font-size:.68rem;font-weight:700;white-space:nowrap}
.v73-pia-dossier[open]>summary::after{content:"Replier ⌃"}
details.v73-domain-record>.v73-domain-record-head::after{content:"⌄";margin-left:8px;color:#7b8797;font-size:.85rem;align-self:center}
details.v73-domain-record[open]>.v73-domain-record-head::after{content:"⌃"}
details.v73-domain-record{padding:0;overflow:hidden}
details.v73-domain-record>.v73-domain-fields{padding:0 13px 13px}
.v73-domain-field{display:grid;gap:5px;font-size:.69rem;font-weight:650;color:#66748a}
.v73-domain,.v73-meeting{border-top:1px solid #dbe3ef}
.v73-domain:last-child,.v73-meeting:last-child{border-bottom:1px solid #dbe3ef}
.v73-domain>summary,.v73-meeting>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 4px;cursor:pointer;font-weight:700;color:#172033}
.v73-domain-fields,.v73-meeting-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:4px 0 14px}
.v73-domain-field,.v73-meeting-field{display:grid;gap:5px;min-width:0;font-size:.76rem;font-weight:650;color:#334155}
.v73-domain-field textarea,.v73-meeting-field textarea,.v73-meeting-field input,.v73-meeting-field select,.v73-prop-edit textarea{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font:inherit;font-weight:400;color:#172033;background:#fff;resize:vertical}
.v73-participants{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;border:1px solid #dbe3ef;border-radius:6px;padding:10px}
.v73-participants legend,.v73-meeting-subtitle{font-size:.78rem;font-weight:700;color:#334155}
.v73-participants label{display:flex;gap:7px;align-items:center;font-size:.78rem}
.v73-feedback-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.v73-meeting-subtitle{grid-column:1/-1}
.v73-meeting-status{font-size:.72rem;font-weight:600;color:#64748b}
.v73-annual-tracking{padding:12px 0;border-block:1px solid #dbe3ef}
.v73-annual-tracking h3{margin-top:0}.v73-annual-tracking h4{font-size:.8rem;margin:12px 0 5px}.v73-annual-tracking p,.v73-annual-tracking li{font-size:.78rem;line-height:1.45;color:#475569}
.v73-prop{align-items:start}.v73-prop-select{padding-top:4px}.v73-prop-edit{display:grid;gap:5px;margin:9px 0;font-size:.74rem;font-weight:650;color:#475569}
.v73-prop-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v73-prop-actions .v73-btn{font-size:.76rem;padding:8px 10px}
.v73-prop-evidence{margin:7px 0;padding-left:18px;color:#64748b;font-size:.73rem;line-height:1.5}
@media(max-width:1100px){.v73-domain-overview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v73-domain-detail-layout{grid-template-columns:minmax(155px,195px) minmax(0,1fr)}}
@media(max-width:720px){.v73-domain-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v73-domain-overview{min-height:218px;padding:13px}.v73-domain-detail-layout{grid-template-columns:1fr}.v73-domain-menu{display:flex;overflow-x:auto;scrollbar-width:thin}.v73-domain-menu button{width:auto;flex:0 0 auto;white-space:nowrap}.v73-domain-record{padding:13px}.v73-domain-record-head{display:grid}.v73-domain-fields,.v73-meeting-fields,.v73-feedback-grid{grid-template-columns:1fr}.v73-domain-count{max-width:46%;text-align:right}}
@media(max-width:460px){.v73-domain-overview-grid{grid-template-columns:1fr}.v73-domain-overview{min-height:190px}}
`;
document.head.appendChild(piaLayoutStyle);
(async()=>{await loadRef(); const boot=async()=>{applySchoolYearDateLimits();addUI();refreshStudents();bindPIAImport();attachPendingPIAImportWatcher();await scrubLegacyPIAFilenames();bindHomeDashboard()}; if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();})();
