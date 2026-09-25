/* Journalier V73 — moteur PIA annuel opérationnel
 * Local-first : aucune donnée n'est envoyée par ce module.
 * Les propositions restent des propositions : la validation est une action du professionnel.
 */
const V73 = {
  version: "73.1.0",
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
  return {
    schemaVersion:"73.0.0",type:"PIA_ANNUEL",id:existing?.id||uid("pia"),studentId:student.studentId,
    eleve:student.nom,classe:student.classe||"",ecole:student.ecole||"",
    schoolYear:`${new Date().getFullYear()}-${new Date().getFullYear()+1}`,
    generatedAt:new Date().toISOString(),until:until||"",lifecycle:existing?.lifecycle||"EN_CONSTRUCTION",
    sourceContinuity:continuityFromExisting(student,existing),
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

function piaForExport(pia,deidentified=false){
  const d=JSON.parse(JSON.stringify(pia));
  if(!deidentified)return d;
  delete d.id; delete d.eleve; delete d.studentId; delete d.ecole; delete d.classe; delete d.schoolYear; delete d.generatedAt; delete d.until;
  d.type="PIA_MODELE_DEIDENTIFIE";
  d.sourceContinuity={present:false,role:"SOURCE_DE_CONTINUITE",format:"",fileName:"",importedAt:"",extracted:{}};
  d.traceability={states:d.traceability?.states||[],rule:"Trace dé-identifiée : aucun identifiant de séance, date ou élève."};
  d.meeting1={...(d.meeting1||{}),validatedAt:"",notes:""};
  d.meeting2={...(d.meeting2||{}),evaluation:safeArray(d.meeting2?.evaluation).map(x=>({...x,evidence:[]}))};
  d.propositions=safeArray(d.propositions).map(p=>{const x={...p};delete x.evidence;delete x.dates;return x;});
  d.sections=safeArray(d.sections).map(sec=>({...sec}));
  return d;
}
function piaTextSections(pia,deidentified=false){
  const d=piaForExport(pia,deidentified), lines=[];
  lines.push(deidentified?"PIA — modèle dé-identifié":"PIA annuel — document professionnel");
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
    lines.push("");
  }
  lines.push("Objectifs visés pour la période et critères d’évaluation");
  const prev=safeArray(d.meeting1?.objectivesPrevious), val=safeArray(d.meeting1?.objectivesValidated), props=safeArray(d.propositions);
  if(prev.length) lines.push("Objectifs existants / à réévaluer :",...prev.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  if(val.length) lines.push("Objectifs validés :",...val.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  if(props.length) lines.push("Propositions V73 :",...props.map(x=>`• ${x.formulation||""} [PROPOSITION]`));
  if(!prev.length&&!val.length&&!props.length) lines.push("• À compléter.");
  lines.push("");
  lines.push("Ressources / moyens complémentaires et aménagements P/O/M");
  lines.push(...(safeArray(d.amenagements).length?safeArray(d.amenagements).map(a=>`• ${a.type||""} — ${a.texte||""} [PROPOSITION]`):["• À compléter sur base des éléments effectivement documentés."]));
  lines.push("");
  lines.push("Retours des acteurs / réunion");
  lines.push("• À compléter lors de la réunion : parents, école/direction/équipe, élève, PMS, agent d’intégration et autres intervenants.");
  lines.push("");
  lines.push("Réunion 1 — Décembre");
  lines.push(`• État : ${d.meeting1?.status||"A_REEVALUER"}`);
  lines.push("• Les objectifs existants peuvent être maintenus, reformulés, ajustés, remplacés ou complétés après discussion et validation professionnelle.");
  lines.push("");
  lines.push("Réunion 2 — Fin d’année");
  lines.push(`• État : ${d.meeting2?.status||"A_VENIR"}`);
  lines.push("• Évaluation à compléter sur base des éléments postérieurs à la réunion 1.");
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
  function labelled(block,label){const b=block||[],nl=b.map(norm),i=nl.findIndex(x=>x.includes(norm(label)));if(i<0)return [];const stops=["ressources","difficultes","difficultés","objectifs à poursuivre","objectifs vises","objectifs visés","objectifs","retours des acteurs","amenagements","aménagements"];let end=b.length;for(let j=i+1;j<b.length;j++){if(stops.some(stop=>nl[j].startsWith(norm(stop)))){end=j;break;}}return b.slice(i+1,end).map(x=>x.replace(/^[•●▪\-–—]+\s*/,"").trim()).filter(x=>x.length>1);}
  const sections=aspects.filter(a=>blocks[a]).map(aspect=>({aspect,ressources:labelled(blocks[aspect],"Ressources"),difficultes:[...new Set(labelled(blocks[aspect],"Difficultés"))],objectifs:labelled(blocks[aspect],"Objectifs à poursuivre")}));
  const objectiveLines=lines.filter(x=>/^(?:[-•●▪]\s*)?(objectif(?:s)?(?:\s+(?:visé|visés|à poursuivre|pour la période))?\s*[:：-])/i.test(x)).map(x=>x.replace(/^[^:：-]*[:：-]\s*/,"").trim()).filter(Boolean);
  const globalObjectives=[...new Set([...objectiveLines,...sections.flatMap(s=>s.objectifs)])];
  const adaptations=lines.filter(x=>/\bP\s*\/\s*O\s*\/\s*M\b|\bam[ée]nagements?\b|\badaptations?\b/i.test(x)).map(x=>x.replace(/^[•●▪\-–—]+\s*/,"").trim()).filter(x=>x.length>3);
  const resources=[...new Set(sections.flatMap(s=>s.ressources))];const difficulties=[...new Set(sections.flatMap(s=>s.difficultes))];
  return {format,fileName:"",importedAt:new Date().toISOString(),role:"SOURCE_DE_CONTINUITE",extracted:{objectives:globalObjectives.slice(0,30),resources:resources.slice(0,30),difficulties:difficulties.slice(0,30),adaptations:[...new Set(adaptations)].slice(0,30),sections}};
}
async function parsePIAFile(file){if(!file)throw new Error("Aucun fichier sélectionné.");const ext=(file.name.split(".").pop()||"").toLowerCase();if(!["pdf","docx"].includes(ext))throw new Error("Format non pris en charge. Utilisez un fichier Word (.docx) ou PDF (.pdf).");const text=ext==="docx"?await extractDocxText(file):await extractPdfText(file);const parsed=extractPIAStructure(text,file.name,ext);if(!parsed.extracted.objectives.length&&!parsed.extracted.sections.length&&!parsed.extracted.difficulties.length&&!parsed.extracted.adaptations.length)throw new Error("Le document a été lu, mais aucune structure PIA reconnaissable n'a été extraite. Le document original n'a pas été conservé.");return parsed;}
function importedSummaryHtml(imported){const e=imported?.extracted||{};return `<div class="v73-import-summary"><b>✓ PIA analysé localement</b><span>${esc(imported?.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;}
function pdfWinAnsiBytes(text){const map={"€":0x80,"‚":0x82,"ƒ":0x83,"„":0x84,"…":0x85,"†":0x86,"‡":0x87,"ˆ":0x88,"‰":0x89,"Š":0x8A,"‹":0x8B,"Œ":0x8C,"Ž":0x8E,"‘":0x91,"’":0x92,"“":0x93,"”":0x94,"•":0x95,"–":0x96,"—":0x97,"˜":0x98,"™":0x99,"š":0x9A,"›":0x9B,"œ":0x9C,"ž":0x9E,"Ÿ":0x9F};const out=[];for(const ch of String(text||"")){const cp=ch.codePointAt(0);if(cp<128)out.push(cp);else if(map[ch]!=null)out.push(map[ch]);else if(cp<=255)out.push(cp);else out.push(63);}return out;}
function pdfLiteral(text){return "("+String.fromCharCode(...pdfWinAnsiBytes(text).flatMap(b=>b===40||b===41||b===92?[92,b]:[b]))+")";}
function makePdf(lines){const pages=[];const perPage=48;for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));const objs=[];const add=x=>{objs.push(x);return objs.length;};const fontId=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");const pageIds=[];for(const pageLines of pages){const content=["BT","/F1 10 Tf","50 790 Td",...pageLines.map((line,i)=>`${pdfLiteral(String(line).slice(0,180))} Tj 0 -15 Td`),"ET"].join("\n");const contentId=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);pageIds.push({contentId});}const pagesId=add("");const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);const pageObjects=pageIds.map(x=>{const id=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${x.contentId} 0 R >>`);return id;});objs[pagesId-1]=`<< /Type /Pages /Kids [${pageObjects.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;let out="%PDF-1.4\n%\xFF\xFF\xFF\xFF\n",offsets=[0];for(let i=0;i<objs.length;i++){offsets[i+1]=out.length;out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)out+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";out+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Uint8Array.from([...out].map(c=>c.charCodeAt(0)&255));}
function downloadBytes(name,bytes,type){const blob=new Blob([bytes],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function htmlPIA(pia){return `<pre style="white-space:pre-wrap;font:14px Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.55">${esc(piaTextSections(pia,false).join("\\n"))}</pre>`;}
function render(pia){
  const box=document.getElementById("v73-pia-result"); if(!box)return;
  const imported=pia.sourceContinuity?.present?importedSummaryHtml(pia.sourceContinuity):"";
  box.innerHTML=`<div class="v73-summary"><b>PIA V73 prêt</b><span>${pia.sessionsAnalysed} séance(s) analysée(s)</span><span>${pia.propositions.length} proposition(s)</span><span>Cycle : ${esc(pia.meeting1.status)}</span></div>
  ${imported}<div class="v73-notice">Les objectifs existants sont conservés comme continuité. Les nouvelles formulations sont des <b>PROPOSITIONS</b> tant qu'elles ne sont pas validées.</div>
  ${pia.propositions.length?`<div class="v73-proposals">${pia.propositions.map((p,i)=>`<label class="v73-prop"><input type="checkbox" data-v73-prop="${i}"><span><b>${esc(p.theme)}</b><br>${esc(p.formulation)}<small>${p.recurrence} occurrence(s), ${p.dates.length} date(s)${p.counterEvidence?" · contre-évidence visible":""}</small></span></label>`).join("")}</div>`:"<p>Aucune convergence suffisante pour formuler une proposition PIA. Les observations restent disponibles dans les séances.</p>"}
  <div class="v73-export-row"><label>Format d’export <select id="v73-export-format"><option value="docx">Word (.docx)</option><option value="pdf">PDF (.pdf)</option></select></label><button id="v73-export-prof" class="btn-primary">Exporter le PIA professionnel</button><button id="v73-export-deid" class="btn-secondary">Exporter le modèle dé-identifié</button></div>
  <div class="v73-actions"><button id="v73-validate">Valider les propositions cochées</button><button id="v73-json">Export JSON professionnel</button><button id="v73-deid-json" class="btn-secondary">Export JSON dé-identifié</button></div>`;
  box.querySelector("#v73-validate").onclick=()=>{
    const chosen=[...box.querySelectorAll("[data-v73-prop]:checked")].map(x=>pia.propositions[Number(x.dataset.v73Prop)]?.formulation).filter(Boolean);
    pia.meeting1.objectivesValidated=[...(pia.meeting1.objectivesValidated||[]),...chosen.map(formulation=>{const p=pia.propositions.find(x=>x.formulation===formulation);return {id:p?.id||uid("obj"),themeId:p?.themeId||"",theme:p?.theme||"",formulation,status:"VALIDEE",validatedAt:new Date().toISOString()};})];
    pia.meeting1.validatedAt=new Date().toISOString(); pia.lifecycle="ACTIF"; pia.meeting1.status="VALIDÉ"; savePia(pia,true).then(()=>render(pia));
  };
  const exportPia=async deid=>{try{const fmt=box.querySelector("#v73-export-format")?.value||"docx";const target=piaForExport(pia,deid);const base=deid?"PIA_modele_deidentifie_V73":"PIA_professionnel_V73";if(fmt==="docx")downloadBytes(`${base}.docx`,makeDocx(piaTextSections(target,deid)),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");else downloadBytes(`${base}.pdf`,makePdf(piaTextSections(target,deid)),"application/pdf");window.showAppToast?.(`✓ Export ${fmt.toUpperCase()} généré localement.`,'success',3500);}catch(e){window.showAppToast?.("⚠️ Export impossible : "+(e?.message||e),'error',5000);}};
  box.querySelector("#v73-export-prof").onclick=()=>exportPia(false); box.querySelector("#v73-export-deid").onclick=()=>exportPia(true);
  box.querySelector("#v73-json").onclick=()=>download(`PIA_professionnel_V73.json`,JSON.stringify(pia,null,2));
  box.querySelector("#v73-deid-json").onclick=()=>download(`PIA_modele_deidentifie_V73.json`,JSON.stringify(piaForExport(pia,true),null,2));
}
async function savePia(pia,cloud=true){
  const ds=window.JournalierDataStore; const st=ds.getState(); st.meta??={}; st.meta.piaRecords??={}; st.meta.piaImports??={}; st.meta.piaRecords[pia.studentId]=pia;
  if(pia.sourceContinuity?.present) st.meta.piaImports[pia.studentId]=pia.sourceContinuity;
  await ds.persistState(st);
  if(cloud && window.JournalierCloud?.savePia) {
    try{await window.JournalierCloud.savePia(pia); window.showAppToast?.("✓ PIA enregistré localement et dans OneDrive.","success",4000);}
    catch(e){window.showAppToast?.("✓ PIA enregistré localement. OneDrive sera réessayé depuis la synchronisation.","info",4500);}
  }
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
function dashboardPiaData(){const d=getData(), records=Object.values(d.state.meta?.piaRecords||{});return {active:records.filter(p=>["ACTIF","EN_REEVALUATION"].includes(p.lifecycle)).length,toComplete:records.filter(p=>p.lifecycle==="EN_CONSTRUCTION").length,toReview:records.filter(p=>p.lifecycle==="EN_REEVALUATION").length};}
function renderDashboard(){
  const host=Array.from(document.querySelectorAll("#view-accueil > .card")).find(x=>norm(x.textContent||"").includes("acces rapide"));if(!host)return;
  try{
    const trends=dashboardTrendData(),pia=dashboardPiaData(),memos=safeArray(getData().state.meta?.dashboardMemos);
    host.innerHTML=`<div class="v73-dashboard-grid"><section><div class="page-kicker">Tendances observées · 30 derniers jours</div><h3 class="v73-dash-title">Ce qui ressort des séances</h3><p class="v73-dash-help">Synthèse descriptive des observations enregistrées. Elle ne constitue pas une évaluation ni un score de difficulté.</p>${trends.length?`<div class="v73-trends">${trends.map(t=>`<button class="v73-trend-row" data-v73-trend="${esc(t.theme)}"><span>${esc(t.theme)}</span><span class="v73-trend-bar"><i style="width:${Math.min(100,Math.max(12,t.count*18))}%"></i></span><strong>${t.count} séance${t.count>1?"s":""}</strong></button>`).join("")}</div>`:`<div class="v73-empty">Pas encore assez de séances pour dégager une tendance. Les synthèses apparaîtront au fur et à mesure des observations.</div>`}<button class="v73-link" data-v73-go-reports>Voir les rapports →</button></section>
    <section><div class="page-kicker">Suivi PIA</div><h3 class="v73-dash-title">PIA annuel</h3><div class="v73-pia-stats"><div><strong>${pia.active}</strong><span>actif(s)</span></div><div><strong>${pia.toComplete}</strong><span>à compléter</span></div><div><strong>${pia.toReview}</strong><span>à réévaluer</span></div></div><button class="v73-link" data-v73-go-reports>Ouvrir le suivi PIA →</button></section>
    <section><div class="page-kicker">Mes mémos</div><h3 class="v73-dash-title">À ne pas oublier</h3><div class="v73-memo-list">${memos.length?memos.map((m,i)=>`<label class="v73-memo"><input type="checkbox" data-v73-memo-done="${i}" ${m.done?'checked':''}><span>${esc(m.text)}</span><button type="button" data-v73-memo-delete="${i}" aria-label="Supprimer le mémo">×</button></label>`).join(""):"<div class=\"v73-empty\">Aucun mémo personnel.</div>"}</div><div class="v73-memo-add"><input id="v73-memo-input" type="text" maxlength="180" placeholder="Ajouter un mémo…"><button class="btn-secondary" id="v73-memo-add">Ajouter</button></div></section></div>`;
    host.querySelectorAll("[data-v73-go-reports]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelectorAll("[data-v73-trend]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelector("#v73-memo-add")?.addEventListener("click",async()=>{const input=host.querySelector("#v73-memo-input"),text=String(input?.value||"").trim();if(!text)return;const ds=window.JournalierDataStore,st=ds.getState();st.meta??={};st.meta.dashboardMemos??=[];st.meta.dashboardMemos.push({id:uid("memo"),text,done:false,createdAt:new Date().toISOString()});await ds.persistState(st);renderDashboard();});
    host.querySelectorAll("[data-v73-memo-done]").forEach(x=>x.addEventListener("change",async()=>{const i=Number(x.dataset.v73MemoDone),ds=window.JournalierDataStore,st=ds.getState();st.meta.dashboardMemos[i]&&(st.meta.dashboardMemos[i].done=x.checked);await ds.persistState(st);renderDashboard();}));
    host.querySelectorAll("[data-v73-memo-delete]").forEach(x=>x.addEventListener("click",async()=>{const i=Number(x.dataset.v73MemoDelete),ds=window.JournalierDataStore,st=ds.getState();st.meta.dashboardMemos.splice(i,1);await ds.persistState(st);renderDashboard();}));
  }catch(_){host.innerHTML='<div class="page-kicker">Tableau de bord</div><div class="v73-empty">Connectez-vous pour afficher les tendances, le suivi PIA et vos mémos.</div>';}
}
function openPIAFilePicker(){document.getElementById("student-pia-file")?.click();}
async function handlePIAFileForStudent(file,studentId){const parsed=await parsePIAFile(file);parsed.displayName=file.name;await persistImportedPIA(String(studentId),parsed);window.showAppToast?.("✓ PIA importé et structuré localement. Le document original n’est pas conservé par Journalier.","success",5000);return parsed;}
async function handleStudentPIAFileChange(input){const file=input?.files?.[0];if(!file)return;const studentId=document.getElementById("student-modal-id")?.value;const status=document.getElementById("pia-local-security-status"),target=document.getElementById("student-pia-file-name");try{if(status)status.textContent="⏳ Analyse locale du PIA…";const parsed=studentId?await handlePIAFileForStudent(file,studentId):await parsePIAFile(file);window.__journalierPendingPIAImport=studentId?null:{parsed,studentId:""};if(target)target.textContent=`✓ ${file.name} · ${parsed.format.toUpperCase()} · ${parsed.extracted.objectives.length} objectif(s), ${parsed.extracted.difficulties.length} difficulté(s), ${parsed.extracted.adaptations.length} adaptation(s)`;if(status)status.textContent="✓ Analyse locale terminée — le document original n’est pas conservé.";}catch(e){if(status)status.textContent="⚠️ Import impossible";window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);}}
function bindPIAImport(){const input=document.getElementById("student-pia-file");if(!input||input.dataset.v73Bound)return;input.dataset.v73Bound="1";input.accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";input.addEventListener("change",()=>handleStudentPIAFileChange(input));}
function attachPendingPIAImportWatcher(){const modal=document.getElementById("studentModal");if(!modal||modal.dataset.v73Watch)return;modal.dataset.v73Watch="1";const observer=new MutationObserver(async()=>{if(!modal.classList.contains("hidden")||!window.__journalierPendingPIAImport)return;const pending=window.__journalierPendingPIAImport,studentId=String(pending.studentId||"").trim();if(!studentId)return;try{const d=getData(),student=d.students.find(s=>String(s.studentId||s.id)===studentId);if(!student)return;await persistImportedPIA(studentId,pending.parsed);const ds=window.JournalierDataStore,st=ds.getState();const cleaned=st.students.map(s=>{const x={...s};delete x.piaFileName;return x;});ds.saveStudents(cleaned);await ds.persistState(st);window.__journalierPendingPIAImport=null;window.showAppToast?.("✓ PIA associé au dossier de l’élève. Le nom du fichier original n’est pas conservé.","success",4000);}catch(e){window.showAppToast?.("⚠️ Association du PIA impossible : "+(e?.message||e),"error",5000);}});observer.observe(modal,{attributes:true,attributeFilter:["class"]});}
async function scrubLegacyPIAFilenames(){try{const ds=window.JournalierDataStore;if(!ds?.isReady?.())return;const st=ds.getState();let changed=false;const students=st.students.map(s=>{if(!s?.piaFileName)return s;const x={...s};delete x.piaFileName;changed=true;return x;});if(changed){ds.saveStudents(students);await ds.persistState(st);}}catch(_){}}
function bindHomeDashboard(){renderDashboard();const list=document.getElementById("home-today-list");if(list&&!list.__v73Obs){const obs=new MutationObserver(()=>renderDashboard());obs.observe(list,{childList:true});list.__v73Obs=obs;}document.getElementById("tab-btn-accueil")?.addEventListener("click",()=>setTimeout(renderDashboard,0));}
function addUI(){
  const host=document.querySelector("#view-reports .card");
  if(!host || document.getElementById("v73-pia-card"))return;
  const card=document.createElement("div"); card.id="v73-pia-card"; card.className="card";
  card.innerHTML=`<div class="page-kicker">PIA annuel V73</div><h2 class="page-title" style="font-size:1.15rem">Construire / réévaluer le PIA</h2>
  <div class="report-intro">Le PIA est annuel. Les séances alimentent les éléments de preuve. La réunion 1 (décembre) réévalue les objectifs existants ou permet de co-construire un premier PIA ; la réunion 2 évalue la trajectoire en fin d’année.</div>
  <div class="grid-2"><div><label>Élève</label><select id="v73-pia-student"></select></div><div><label>Date de référence</label><input id="v73-pia-date" type="date"></div></div>
  <div id="v73-pia-continuity" class="v73-continuity"></div>
  <div class="v73-actions"><button id="v73-build" class="btn-primary">Générer le projet de PIA</button><button id="v73-meeting2" class="btn-secondary">Préparer la réévaluation fin d’année</button></div>
  <div id="v73-pia-result" class="v73-result"></div>`;
  host.parentElement.insertBefore(card,host.nextSibling);
  refreshStudents();
  document.getElementById("v73-build").onclick=()=>run(false); document.getElementById("v73-meeting2").onclick=()=>run(true);
  document.getElementById("v73-pia-student").addEventListener("change",refreshPIAContinuity);
  refreshPIAContinuity(); bindPIAImport(); attachPendingPIAImportWatcher(); bindHomeDashboard();
}
function refreshPIAContinuity(){const sid=document.getElementById("v73-pia-student")?.value,host=document.getElementById("v73-pia-continuity");if(!host)return;const imported=getImportedPIA(sid);if(imported?.present||imported?.extracted){const e=imported.extracted||{};host.innerHTML=`<div class="v73-import-summary"><b>✓ PIA précédent disponible</b><span>${esc(imported.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;}else host.innerHTML='<div class="v73-import-help">PIA précédent : utilisez <b>Élèves → dossier de l’élève → Importer le PIA</b>. Le fichier Word/PDF est traité localement ; seul le contenu structuré validé est conservé.</div>';}
function refreshStudents(){
  const sel=document.getElementById("v73-pia-student"); if(!sel)return;
  let d; try{d=getData()}catch(_){return;}
  const current=sel.value; sel.innerHTML=d.students.map(s=>`<option value="${esc(s.studentId)}">${esc(s.nom)}</option>`).join("");
  if(current && [...sel.options].some(o=>o.value===current))sel.value=current;
  const date=document.getElementById("v73-pia-date"); if(date&&!date.value)date.value=new Date().toISOString().slice(0,10); refreshPIAContinuity();
}
async function run(meeting2){
  try{
    const d=getData(); refreshStudents(); const sid=document.getElementById("v73-pia-student")?.value;
    const student=d.students.find(s=>String(s.studentId)===String(sid)); if(!student)throw new Error("Aucun élève sélectionné.");
    const until=document.getElementById("v73-pia-date")?.value||new Date().toISOString().slice(0,10);
    const existing=d.state.meta?.piaRecords?.[student.studentId]||null;
    const imported=d.state.meta?.piaImports?.[student.studentId]||null;
    const continuityExisting=existing||((imported)?{sourceContinuity:imported,meeting1:{objectivesPrevious:[]}}:null);
    const pia=buildPIA(student,d.sessions,until,continuityExisting);
    if(meeting2){
      pia.meeting2={status:"EN_REEVALUATION",evaluation:evaluateMeeting2(pia,existing),objectivesToContinue:pia.meeting1.objectivesValidated||[],perspectives:[]};
      pia.lifecycle="EN_REEVALUATION";
    }
    V73.state=pia; await savePia(pia,true); render(pia);
    window.showAppToast?.(`✓ ${meeting2?"Réévaluation":"Projet de PIA"} généré pour ${student.nom}.`,"success",4000);
  }catch(e){window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);}
}
window.JournalierV73={...V73,buildPIA,run,refreshStudents,loadRef,parsePIAFile,extractPIAStructure,renderDashboard};
const style=document.createElement("style");style.textContent=`
#v73-pia-card{margin-top:16px}.v73-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.v73-summary span,.v73-summary b{padding:6px 9px;border-radius:8px;background:#f1f5f9}.v73-notice{padding:11px;border-left:4px solid #2563eb;background:#eff6ff;border-radius:8px;margin:10px 0;font-size:.82rem}.v73-proposals{display:grid;gap:8px;margin:12px 0}.v73-prop{display:flex;gap:10px;padding:11px;border:1px solid #dbe3ef;border-radius:10px;background:#fff}.v73-prop small{display:block;color:#64748b;margin-top:5px}.v73-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v73-actions button{border:0;border-radius:9px;padding:9px 12px;cursor:pointer;background:#0a84ff;color:white}.v73-actions button.btn-secondary{background:#eef2f7;color:#172033}.v73-result{margin-top:14px}.v73-continuity{margin-top:12px}.v73-import-help{padding:11px 13px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;color:#475569;font-size:.78rem}.v73-import-summary{display:flex;gap:7px;flex-wrap:wrap;padding:10px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;color:#166534;font-size:.76rem}.v73-import-summary span,.v73-import-summary b{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.72)}.v73-export-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#fafafa}.v73-export-row label{font-size:.75rem;color:#475569;display:grid;gap:5px}.v73-export-row select{padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.v73-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.7fr) minmax(260px,.85fr);gap:14px}.v73-dashboard-grid>section{padding:16px;border:1px solid var(--border);border-radius:13px;background:#fff;min-width:0}.v73-dash-title{margin:0 0 5px;font-size:1rem}.v73-dash-help{margin:0 0 11px;color:#64748b;font-size:.72rem;line-height:1.45}.v73-trends{display:grid;gap:7px}.v73-trend-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(80px,1.2fr) auto;gap:8px;align-items:center;border:0;background:transparent;padding:5px 0;text-align:left;color:#172033;cursor:pointer}.v73-trend-bar{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.v73-trend-bar i{display:block;height:100%;border-radius:999px;background:#0a84ff}.v73-trend-row strong{font-size:.68rem;color:#64748b;white-space:nowrap}.v73-link{margin-top:10px;border:0;background:transparent;color:#0a84ff;font-weight:700;cursor:pointer;padding:4px 0}.v73-pia-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.v73-pia-stats div{padding:10px;border-radius:9px;background:#f8fafc;text-align:center}.v73-pia-stats strong{display:block;font-size:1.2rem}.v73-pia-stats span{font-size:.65rem;color:#64748b}.v73-memo-list{display:grid;gap:6px;max-height:150px;overflow:auto}.v73-memo{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:7px 8px;background:#f8fafc;border-radius:8px;font-size:.76rem}.v73-memo input:checked+span{text-decoration:line-through;color:#94a3b8}.v73-memo button{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:1rem}.v73-memo-add{display:flex;gap:6px;margin-top:8px}.v73-memo-add input{min-width:0;flex:1;margin:0;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px}.v73-empty{padding:10px 0;color:#64748b;font-size:.76rem}@media(max-width:1100px){.v73-dashboard-grid{grid-template-columns:1fr 1fr}.v73-dashboard-grid>section:first-child{grid-column:1/-1}}@media(max-width:720px){.v73-dashboard-grid{grid-template-columns:1fr}.v73-dashboard-grid>section:first-child{grid-column:auto}.v73-trend-row{grid-template-columns:1fr auto}.v73-trend-bar{grid-column:1/-1}.v73-export-row{align-items:stretch}.v73-export-row>*{width:100%}}
`;document.head.appendChild(style);
(async()=>{await loadRef(); const boot=async()=>{addUI();refreshStudents();bindPIAImport();attachPendingPIAImportWatcher();await scrubLegacyPIAFilenames();bindHomeDashboard()}; if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();})();
