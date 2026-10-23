/* ============================================================================
 * Journalier V74 — PIA Lifecycle Engine & Longitudinal Convergence
 * Lot 3.9 : Sous-module modulaire de convergence et cycle de vie PIA
 * ============================================================================
 */
const V74 = {
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
  {id:"attention", label:"Attention et concentration", aspect:"Cognitif (pédagogique)",
   re:/\b(attention|concentration|distract|focalisation)\b/i},
  {id:"comportement_affectif", label:"Comportement et dynamique affective", aspect:"Comportemental et affectif",
   re:/\b(refus|évitement|opposition|décourag|décour|frustr|anxiété|angoisse|colère|agitation|conflit|retrait)\b/i},
  {id:"attention_engagement", label:"Comportement et dynamique affective", aspect:"Comportemental et affectif",
   re:/\b(refus.*t[aâ]che|refus.*aide|opposition|agitation|d[eé]couragement|frustration)\b/i},
  {id:"autonomie", label:"Autonomie et rythme de travail", aspect:"Lié à l’autonomie",
   re:/\b(autonom|seul|seule|relance|aide|demande.*aide|vérif|verification|vérification|initiative|commence|termine|rythme|maintien.*rythme|persév|persévér)\b/i},
  {id:"transfert", label:"Transfert / réinvestissement", aspect:"Cognitif (pédagogique)",
   re:/\b(transfert|réinvest|réutil|nouvelle situation|situation différente|ailleurs)\b/i},
  {id:"geste_graphique", label:"Motricité et geste graphique", aspect:"Physique et psychomoteur",
   re:/\b(geste graphique|écriture|écrit|tracé|géométr|règle|compas|équerre|manipul.*outil|motric|coordination|tenue.*outil|posture|handicap|dysprax)\b/i},
  {id:"fatigue", label:"Rythme et endurance de travail", aspect:"Lié à l’autonomie",
   re:/\b(fatigue|fatigu|endurance|ralent|lent|pause|rythme)\b/i},
  {id:"mathematiques", label:"Apprentissages mathématiques", aspect:"Cognitif (pédagogique)",
   re:/\b(math|calcul|multiplication|division|fraction|nombre|équation|algèbre|géométr|angle|périmètre|proportion)\b/i}
];

/** Échappe les caractères HTML sensibles pour sécuriser les interpolations DOM (référence au module unifié escapeHtml). */
function esc(s){return typeof globalThis.escapeHtml==='function'?globalThis.escapeHtml(s):String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/** Génère un identifiant unique horodaté préfixé pour les objets runtime V74. */
function uid(prefix="v74"){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
/** Normalise une chaîne (minuscules, sans accents ni espaces multiples) pour les comparaisons. */
// eslint-disable-next-line no-control-regex -- Normalisation des apostrophes typographiques et contrôles hérités
function norm(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’‘`\u0018\u0019\u0091\u0092]/g,"'").toLowerCase().replace(/\s+/g," ").trim();}
/** Extrait le format de date YYYY-MM-DD (10 premiers caractères). */
function dateOnly(s){return String(s||"").slice(0,10);}
/** Garantit le retour d'un tableau sain (fallback vers tableau vide si non tableau). */
function safeArray(x){
  if(Array.isArray(x))return x;
  if(x&&typeof x==="object"&&typeof x.length==="number"){
    const out=[];
    for(let i=0;i<x.length;i++)out.push(x[i]);
    return out;
  }
  return [];
}
function getData(){
  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.()) throw new Error("Connectez-vous à Microsoft avant d'utiliser le PIA V74.");
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
const PIA_Q5_STATUS_LABELS=Object.freeze({
  observed:"Observé",
  autonome:"Autonome",
  reussi:"Réussi",
  partial:"Partiellement observé",
  partiel:"Partiellement observé",
  aide:"Avec aide",
  relance:"Avec relance",
  not_yet:"Pas encore observé",
  non:"Non observé",
  not_observed:"Non observé",
  no_opportunity:"Pas d’occasion",
  later:"À observer plus tard",
  not_relevant:"Non pertinent"
});
function formatPiaQ5Status(raw){
  const v=String(raw||"").trim();
  if(!v)return "";
  const low=v.toLowerCase();
  if(low==="not_relevant"||low==="no_opportunity"||low==="later"||low==="not_observed"||low==="non pertinent"||low==="pas d'occasion"||low==="pas d’occasion") {
    return "";
  }
  return PIA_Q5_STATUS_LABELS[low]||v;
}
const PIA_Q3_APPRECIATION_LABELS=Object.freeze({
  0:"À renforcer",
  1:"En cours d’appropriation",
  2:"Maîtrisé",
  mobilisé:"Maîtrisé",
  mobilise:"Maîtrisé",
  maîtrisé:"Maîtrisé",
  maitrise:"Maîtrisé",
  appui:"Point d’appui",
  consolider:"À consolider",
  fragilite:"Fragilité"
});
function formatPiaQ3Appreciation(raw){
  if(raw===0||raw==="0")return "À renforcer";
  if(raw===1||raw==="1")return "En cours d’appropriation";
  if(raw===2||raw==="2"||raw==="Mobilisé"||raw==="mobilisé"||raw==="Maîtrisé"||raw==="maîtrisé")return "Maîtrisé";
  const v=String(raw||"").trim();
  if(!v)return "";
  return PIA_Q3_APPRECIATION_LABELS[v.toLowerCase()]||v;
}
const PIA_Q4_EFFECT_LABELS=Object.freeze({
  0:"Aucun effet observé",
  1:"Effet partiel",
  2:"Effet positif",
  3:"Aide déterminante"
});
function formatPiaQ4Effect(raw){
  if(raw===undefined||raw===null||raw==="")return "";
  if(typeof raw==="number"||/^[0-3]$/.test(String(raw).trim()))return PIA_Q4_EFFECT_LABELS[Number(raw)]||String(raw);
  return String(raw).trim();
}
function extractSessionQ4Items(s){
  const q4=s?.q4||{};
  const types=safeArray(q4.types);
  const effetsObj=(q4.effets&&typeof q4.effets==="object"&&!Array.isArray(q4.effets))?q4.effets:{};
  const detailsObj=(q4.details&&typeof q4.details==="object"&&!Array.isArray(q4.details))?q4.details:{};
  const globalEffect=formatPiaQ4Effect(q4.effet);
  const items=[];
  types.forEach(t=>{
    const name=String(t||"").trim();
    if(!name)return;
    const effRaw=effetsObj[name]!==undefined?effetsObj[name]:(detailsObj[name]?.effet!==undefined?detailsObj[name].effet:q4.effet);
    const effLabel=formatPiaQ4Effect(effRaw);
    items.push({type:name,effect:effLabel,summary:effLabel?`${name} (effet déclaré en séance : ${effLabel.toLowerCase()})`:name});
  });
  Object.entries(effetsObj).forEach(([name,val])=>{
    if(types.includes(name))return;
    const effLabel=formatPiaQ4Effect(val);
    if(name)items.push({type:name,effect:effLabel,summary:effLabel?`${name} (effet déclaré en séance : ${effLabel.toLowerCase()})`:name});
  });
  if(!items.length&&globalEffect){
    items.push({type:"Médiation en séance",effect:globalEffect,summary:`Médiation en séance (effet déclaré : ${globalEffect.toLowerCase()})`});
  }
  return items;
}
function parsePiaQ2Level(raw){
  if(raw===0||raw==="0")return 0;
  if(raw===1||raw==="1")return 1;
  if(raw===2||raw==="2")return 2;
  const n=norm(raw);
  if(n.includes("partiel"))return 0;
  if(n.includes("suffis"))return 1;
  if(n.includes("total"))return 2;
  return null;
}
function formatPiaQ2LevelLabel(raw){
  const lvl=parsePiaQ2Level(raw);
  if(lvl===0)return "Partiellement";
  if(lvl===1)return "Suffisamment";
  if(lvl===2)return "Totalement";
  return "";
}
function sessionText(s){
  const q2=s.q2||{},q3=s.q3||{},q4=s.q4||{},q5=s.q5||{},q6=s.q6||{};
  const parts=[];
  safeArray(q2.observations).forEach(x=>{
    const lvl=formatPiaQ2LevelLabel(x?.niveau);
    parts.push(`${x.categorie||""} ${x.observation||""}${lvl?` (${lvl.toLowerCase()})`:""}`);
  });
  if(q2.niveau){
    const lvl=formatPiaQ2LevelLabel(q2.niveau);
    if(lvl)parts.push(lvl.toLowerCase());
  }
  if(q2.commentaire)parts.push(q2.commentaire);
  const objText=typeof s.objectif==="string"?s.objectif:`${s.objectif?.objectifLecon||""} ${s.objectif?.objectifProfessionnel||""} ${s.identification?.objectif||""}`;
  parts.push(objText,q2.precision,q3.precision,q4.precision,formatPiaQ5Status(q5.statut||q5.observe),q5.precision,q5.commentaire,q6.precision,q6.objectif,q6.modalite);
  safeArray(q3.indicateurs).forEach(x=>{
    if(typeof x==="string"){
      const det=q3.details?.[x]||{};
      const app=formatPiaQ3Appreciation(det.appreciation);
      const procs=safeArray(det.processus).join(" ");
      parts.push(`${x} ${procs} ${det.precision||""}${app?` (${app.toLowerCase()})`:""}`);
    }else{
      const app=formatPiaQ3Appreciation(x?.appreciation);
      parts.push(`${x?.texte||""}${app?` (${app.toLowerCase()})`:""}`);
    }
  });
  if(q3.repereWBE&&(q3.repereWBE.signature||q3.repereWBE.hit)){
    parts.push(`${q3.repereWBE.signature||""} ${q3.repereWBE.hit||""}`);
  }
  if(q3.referentiel&&((q3.attendu&&q3.attendu!=="Non précisé")||(q3.theme&&q3.theme!=="Non précisé"))){
    parts.push(`${q3.referentiel} ${q3.champ||""} ${q3.theme||""} ${q3.attendu||""}`);
  }
  extractSessionQ4Items(s).forEach(x=>parts.push(x.summary));
  safeArray(q6.actions).forEach(x=>parts.push(x));
  safeArray(q6.collaborations).forEach(x=>parts.push(x));
  return parts.filter(Boolean).join(" ");
}
function recurrenceMarker(text){return /\b(encore|toujours|de nouveau|à nouveau|reste nécessaire|continue|continue à|faut encore|doit encore|plusieurs fois)\b/i.test(text||"");}
function q5Positive(s){
  const rawStatut=String(s?.q5?.statut||"").trim().toLowerCase();
  if(rawStatut==="observed"||rawStatut==="autonome"||rawStatut==="reussi"||rawStatut==="réussi") return true;
  const t=norm(`${formatPiaQ5Status(s?.q5?.statut)} ${s?.q5?.precision||""}`);
  return /\b(autonome|seul|réussit|reussit|sans aide|transf|réinvest|spontan|acquis|mieux|moins d'erreurs|observe)\b/.test(t) && !/\b(pas encore|non observe|partiellement observe)\b/.test(t);
}
function q5Help(s){
  const rawStatut=String(s?.q5?.statut||"").trim().toLowerCase();
  if(rawStatut==="partial"||rawStatut==="partiel"||rawStatut==="aide"||rawStatut==="relance") return true;
  const t=norm(`${s?.q2?.precision||""} ${formatPiaQ5Status(s?.q5?.statut)} ${s?.q5?.precision||""} ${s?.q4?.precision||""}`);
  return /\b(relance|aide|guidage|support|avec l'aide|doit etre aide|necessite|partiellement observe)\b/.test(t);
}
function cleanWbeRawToken(raw){
  let s=String(raw||"").trim();
  if(!s)return "";
  if(s.includes("|")){
    const parts=s.split("|").map(x=>x.trim()).filter(Boolean);
    s=parts[parts.length-1]||s;
  }
  return s.replace(/^rep[eè]re\s+wbe\s*:\s*/i,"").trim();
}
function canonicalizeWbeChapter(raw,objectifLecon="",matiere=""){
  const cleaned=cleanWbeRawToken(raw);
  const objClean=String(objectifLecon||"").replace(/^(?:interro(?:gation)?|évaluation|eval|contrôle|exercice(?:s)?|leçon|séance|atelier|travail)\s*[-—:·]?\s*/i,"").trim();
  const probe=norm(`${cleaned} ${objClean}`);
  if(!probe)return "";
  if(/\b(puissance|exposant|quotient de puissance|produit de puissance|proprietes des puissances)\b/.test(probe))return "Propriétés des puissances";
  if(/\b(priorites? operatoires?|pemdas|ordre des operations|operations? sur (?:les )?entiers|nombres? entiers|regles? des signes)\b/.test(probe))return "Priorités opératoires";
  if(/\b(equations? du premier degre|equations? a une inconnue|resoudre une equation|resolution d'equation|equations?)\b/.test(probe))return "Équations du premier degré";
  if(/\b(fonctions? du premier degre|fonctions? affines?|fonctions? lineaires?|fonctions?)\b/.test(probe))return "Fonctions du premier degré";
  if(/\b(fractions? equivalentes?|fractions?|numerateur|denominateur)\b/.test(probe))return cleaned&&/fraction/i.test(cleaned)?cleaned.charAt(0).toUpperCase()+cleaned.slice(1):"Fractions";
  if(/\b(calcul litteral|termes semblables|polynome|factorisation|developpement)\b/.test(probe))return "Calcul littéral";
  if(/\b(proportionnalite|echelle|pourcentage|regle de trois)\b/.test(probe))return "Proportionnalité";
  if(/\b(pythagore|triangle|angle|geometrie|quadrilatere|perimetre|aire|figure)\b/.test(probe))return "Géométrie et figures planes";
  if(/\b(probleme|problemes)\b/.test(probe)&&!/equation|puissance|priorite/.test(probe))return "Résolution de problèmes";
  if(cleaned && !/^le monde des nombres$/i.test(cleaned)){
    const pretty=cleaned
      .replace(/\bmathematiques\b/gi,"")
      .replace(/\bpriorites operatoires\b/gi,"Priorités opératoires")
      .replace(/\bproprietes des puissances\b/gi,"Propriétés des puissances")
      .replace(/\bquotient de puissances\b/gi,"Propriétés des puissances")
      .replace(/\bles fonctions du premier degre\b/gi,"Fonctions du premier degré")
      .replace(/\bequations du premier degre\b/gi,"Équations du premier degré")
      .trim();
    if(pretty)return pretty.charAt(0).toUpperCase()+pretty.slice(1);
  }
  if(objClean)return objClean.charAt(0).toUpperCase()+objClean.slice(1);
  if(cleaned)return cleaned.charAt(0).toUpperCase()+cleaned.slice(1);
  return "";
}
function formatWbeCourseHeader(matiere){
  const m=String(matiere||"").trim();
  if(!m)return "Repères transversaux";
  const n=norm(m);
  if(n.startsWith("cours de ")||n.startsWith("cours d'"))return m.charAt(0).toUpperCase()+m.slice(1);
  const lower=m.charAt(0).toLowerCase()+m.slice(1);
  if(/^[aeiouyéèêëîïôùûü]/i.test(lower))return `Cours d’${lower}`;
  return `Cours de ${lower}`;
}
function summarizeWbeByCourse(sessions){
  const byCourse=new Map();
  safeArray(sessions).forEach(s=>{
    const matiere=String(s?.contexte?.matiere||s?.identification?.matiere||s?.matiere||"").trim()||"Matière non renseignée";
    const obj=String(typeof s?.objectif==="string"?s.objectif:(s?.objectif?.objectifLecon||s?.objectif?.objectifProfessionnel||s?.identification?.objectif||"")).trim();
    const rawWbe=resolveSessionWBERepere(s);
    const chap=canonicalizeWbeChapter(rawWbe,obj,matiere);
    if(!chap||/^séance d/i.test(chap))return;
    const courseLabel=formatWbeCourseHeader(matiere);
    if(!byCourse.has(courseLabel))byCourse.set(courseLabel,[]);
    const list=byCourse.get(courseLabel);
    if(!list.some(x=>norm(x)===norm(chap)))list.push(chap);
  });
  return [...byCourse.entries()].map(([course,chapters])=>({
    course,
    chapters,
    formatted:`${course} : ${chapters.join(" ; ")}.`
  }));
}
function resolveSessionWBERepere(s){
  const q3=s?.q3||{};
  const explicitSig=String(q3.repereWBE?.signature||"").trim();
  const explicitHit=String(typeof q3.repereWBE?.hit==="string"?q3.repereWBE.hit:"").trim();
  const matiere=s?.contexte?.matiere||s?.identification?.matiere||"";
  const obj=String(typeof s?.objectif==="string"?s.objectif:(s?.objectif?.objectifLecon||s?.objectif?.objectifProfessionnel||s?.identification?.objectif||"")).trim();
  if(explicitSig){
    if(explicitSig.includes("|")||/^le monde des nombres$/i.test(explicitSig)){
      return canonicalizeWbeChapter(explicitSig,obj,matiere)||cleanWbeRawToken(explicitSig);
    }
    return explicitSig;
  }
  if(explicitHit){
    if(explicitHit.includes("|")||/^le monde des nombres$/i.test(explicitHit)){
      return canonicalizeWbeChapter(explicitHit,obj,matiere)||cleanWbeRawToken(explicitHit);
    }
    return explicitHit;
  }
  const findById=typeof window!=="undefined"&&typeof window.findIndicatorById==="function"?window.findIndicatorById:null;
  if(findById){
    for(const ind of safeArray(q3.indicateurs)){
      const indId=typeof ind==="object"?ind?.id:null;
      if(!indId)continue;
      const libInd=findById(indId);
      const refWbe=libInd?.referentiel_wbe;
      if(refWbe){
        const seq=safeArray(refWbe.sequences)[0]||safeArray(refWbe.notions)[0]||safeArray(refWbe.modules_uaa_themes)[0];
        if(seq)return canonicalizeWbeChapter(String(seq).trim(),obj,matiere)||String(seq).trim();
      }
      if(libInd?.sous_domaine)return canonicalizeWbeChapter(String(libInd.sous_domaine).trim(),obj,matiere)||String(libInd.sous_domaine).trim();
      if(libInd?.domaine)return canonicalizeWbeChapter(String(libInd.domaine).trim(),obj,matiere)||String(libInd.domaine).trim();
    }
  }
  if(q3.referentiel&&((q3.attendu&&q3.attendu!=="Non précisé")||(q3.theme&&q3.theme!=="Non précisé"))){
    return [q3.champ,q3.theme,q3.attendu].filter(x=>x&&x!=="Non précisé").join(" · ");
  }
  return "";
}
function extractUnits(s){
  const presence=String(s?.contexte?.presenceStatus||s?.presenceStatus||"present").trim();
  if(presence && presence!=="present")return [];
  const text=sessionText(s), units=[];
  const matiere=s.contexte?.matiere||s.identification?.matiere||"";
  const niveau=s.contexte?.niveau||s.identification?.niveau||s.identification?.contexte||"";
  const objectifLecon=String(typeof s.objectif==="string"?s.objectif:(s.objectif?.objectifLecon||s.objectif?.objectifProfessionnel||s.identification?.objectif||"")).trim();
  const q4Items=extractSessionQ4Items(s);
  const wbeRepere=resolveSessionWBERepere(s);
  const directQ2Level=parsePiaQ2Level(s.q2?.niveau);
  THEMES.forEach(theme=>{
    const matches=text.match(theme.re);
    if(!matches)return;
    const matchedQ2=safeArray(s.q2?.observations).filter(x=>theme.re.test(`${x.categorie||""} ${x.observation||""}`));
    const explicitQ2=matchedQ2.length>0 || directQ2Level!==null;
    const matchedQ3=safeArray(s.q3?.indicateurs).filter(x=>{
      if(typeof x==="string"){
        const det=s.q3?.details?.[x]||{};
        return theme.re.test(`${x} ${safeArray(det.processus).join(" ")} ${det.precision||""}`);
      }
      return theme.re.test(x?.texte||"");
    });
    const explicitQ3=matchedQ3.length>0;
    const explicitQ5=theme.id==="autonomie" && (q5Help(s)||q5Positive(s));
    const structured=Boolean(explicitQ2||explicitQ5||explicitQ3);

    const q2Levels=[...matchedQ2.map(x=>parsePiaQ2Level(x?.niveau)),directQ2Level].filter(v=>v!==null);
    const hasQ2Difficulty=q2Levels.includes(0);
    const hasQ2Functional=q2Levels.includes(1);
    const hasQ2Mastered=q2Levels.includes(2);
    const q3Appreciations=matchedQ3.map(x=>{
      const rawApp=typeof x==="string"?s.q3?.details?.[x]?.appreciation:x?.appreciation;
      return formatPiaQ3Appreciation(rawApp).toLowerCase();
    }).filter(Boolean);
    const hasQ3Fragilite=q3Appreciations.some(a=>a.includes("fragilit")||a.includes("renforcer"));
    const hasQ3Consolider=q3Appreciations.some(a=>a.includes("consolider")||a.includes("appropriation"));
    const hasQ3Appui=q3Appreciations.some(a=>a.includes("appui")||a.includes("mobilis"));

    let unitPolarity="neutral";
    let q2DominantLevel=null;
    if(hasQ2Difficulty||hasQ3Fragilite){
      unitPolarity="difficulty";
      q2DominantLevel=hasQ2Difficulty?0:null;
    }else if(hasQ2Functional||hasQ3Consolider){
      unitPolarity="functional";
      q2DominantLevel=hasQ2Functional?1:null;
    }else if(hasQ2Mastered||hasQ3Appui){
      unitPolarity="positive";
      q2DominantLevel=hasQ2Mastered?2:null;
    }else if(q5Positive(s)&&!q5Help(s)){
      unitPolarity="positive";
    }else if(structured){
      unitPolarity="difficulty";
    }

    const q2LevelLabel=formatPiaQ2LevelLabel(q2DominantLevel);
    // Règle stricte Lot PIA-1 / PIA-4 :
    // - Ressource stabilisée : Totalement (2) ou Point d'appui / Mobilisé Q3, ou Q5 positif sans observation Q2 partielle/suffisante contradictoire
    // - Fonctionnement suffisamment fonctionnel : Suffisamment (1) ou En cours d'appropriation / À consolider Q3
    // - Fragilité / difficulté : Partiellement (0) ou Fragilité / À renforcer Q3
    const isFunctional=Boolean(unitPolarity==="functional");
    const isDifficulty=Boolean(unitPolarity==="difficulty");
    const isResource=Boolean(unitPolarity==="positive"||(hasQ2Mastered&&!hasQ2Difficulty&&!hasQ2Functional)||(hasQ3Appui&&!hasQ2Difficulty&&!hasQ2Functional));

    const relations={
      PORTE_SUR:theme.label, CONTEXTE:matiere,
      DIFFICULTE: isDifficulty ? text : "",
      FONCTIONNEL: isFunctional ? text : "",
      RESSOURCE: isResource ? text : "",
      AIDE:(q5Help(s)||Boolean(q4Items.length||s.q4?.precision)) ? text : "",
      EVOLUTION:(q5Positive(s)||Boolean(q4Items.some(x=>x.effect))||recurrenceMarker(text)) ? text : ""
    };
    const obsTexts=matchedQ2.length
      ? matchedQ2.map(x=>{
          const obs=String(x.observation||x.categorie||"").trim();
          const lvl=formatPiaQ2LevelLabel(x?.niveau);
          return obs?(lvl?`${obs} (${lvl.toLowerCase()})`:obs):"";
        }).filter(Boolean)
      : (directQ2Level!==null?[ `${objectifLecon||theme.label} (${formatPiaQ2LevelLabel(directQ2Level).toLowerCase()})` ]:[]);
    const q3Items=(matchedQ3.length?matchedQ3:safeArray(s.q3?.indicateurs)).map(x=>{
      if(typeof x==="string"){
        const det=s.q3?.details?.[x]||{};
        const app=formatPiaQ3Appreciation(det.appreciation);
        const procs=safeArray(det.processus).join(", ");
        const base=procs?`${x} — processus : ${procs}`:x;
        return base?(app?`${base} (${app.toLowerCase()})`:base):"";
      }
      const txt=String(x?.texte||"").trim();
      const app=formatPiaQ3Appreciation(x?.appreciation);
      return txt?(app?`${txt} (${app.toLowerCase()})`:txt):"";
    }).filter(Boolean);

    units.push({
      id:uid("unit"),themeId:theme.id,theme:theme.label,aspect:theme.aspect,
      date:dateOnly(s.identification?.date),sessionId:String(s.id),
      matiere, niveau, objectifLecon,
      structured, text, relations,
      polarity:unitPolarity,
      q2Level:q2DominantLevel,
      q2LevelLabel,
      q2Observations:obsTexts,
      q2Precision:String(s.q2?.precision||s.q2?.commentaire||"").trim(),
      q3Indicators:q3Items,
      q3Precision:String(s.q3?.precision||"").trim(),
      q3WbeRepere:wbeRepere,
      q4Items,
      q4Precision:String(s.q4?.precision||"").trim(),
      q4Effet:q4Items.map(x=>x.summary).join(" ; ")||String(s.q4?.effet||""),
      q5StatutLabel:formatPiaQ5Status(s.q5?.statut||s.q5?.observe),
      q5Precision:String(s.q5?.precision||s.q5?.commentaire||"").trim(),
      q6Actions:safeArray(s.q6?.actions).map(x=>String(x||"").trim()).filter(Boolean),
      q6Modalite:String(s.q6?.modalite||"").trim(),
      q6Objectif:String(s.q6?.objectif||"").trim(),
      q6Collaborations:safeArray(s.q6?.collaborations).map(x=>String(x||"").trim()).filter(Boolean),
      q6Precision:String(s.q6?.precision||"").trim(),
      source:{
        q2:Boolean(s.q2?.observations?.length||s.q2?.precision||s.q2?.niveau||s.q2?.commentaire),
        q3:Boolean(s.q3?.indicateurs?.length||s.q3?.precision||wbeRepere||(s.q3?.referentiel&&s.q3?.attendu&&s.q3?.attendu!=="Non précisé")),
        q4:Boolean(q4Items.length||s.q4?.precision||s.q4?.effet),
        q5:Boolean(s.q5?.statut||s.q5?.observe||s.q5?.precision||s.q5?.commentaire),
        q6:Boolean(s.q6?.actions?.length||s.q6?.precision||s.q6?.objectif||s.q6?.modalite||s.q6?.collaborations?.length)
      }
    });
  });
  return units;
}
const DEFAULT_CONVERGENCE_THRESHOLDS = Object.freeze({
  SIGNAL_MIN_SESSIONS: 2,
  TREND_MIN_SESSIONS: 3,
  PROPOSAL_MIN_SOURCES: 2
});

function getConvergenceConfig(){
  const c=V74.referential?.convergence||{};
  const thresholds=c.seuils||{};
  return {
    signalMinSessions:Number(thresholds.signal_min_sessions_distinctes)||DEFAULT_CONVERGENCE_THRESHOLDS.SIGNAL_MIN_SESSIONS,
    trendMinSessions:Number(thresholds.tendance_min_sessions_distinctes)||DEFAULT_CONVERGENCE_THRESHOLDS.TREND_MIN_SESSIONS,
    proposalMinSources:Number(thresholds.proposition_exception_intra_session?.minimum_sources_q_distinctes)||DEFAULT_CONVERGENCE_THRESHOLDS.PROPOSAL_MIN_SOURCES
  };
}
function summarizeGroupContext(arr){
  const displaySubjects=[...new Set(arr.map(x=>String(x.matiere||"").trim()).filter(Boolean))];
  const lessonObjectives=[...new Set(arr.map(x=>String(x.objectifLecon||"").trim()).filter(Boolean))];
  const q2Obs=[...new Set(arr.flatMap(x=>safeArray(x.q2Observations)))];
  const q2Precisions=[...new Set(arr.map(x=>x.q2Precision).filter(Boolean))];
  const q3Inds=[...new Set(arr.flatMap(x=>safeArray(x.q3Indicators)))];
  const q3Precisions=[...new Set(arr.map(x=>x.q3Precision).filter(Boolean))];
  const q3Wbe=[...new Set(arr.map(x=>x.q3WbeRepere).filter(Boolean))];
  const q4List=[...new Set(arr.flatMap(x=>safeArray(x.q4Items).map(i=>i.summary)))];
  const q4Types=[...new Set(arr.flatMap(x=>safeArray(x.q4Items).map(i=>i.type)))];
  const q4Effects=[...new Set(arr.flatMap(x=>safeArray(x.q4Items).map(i=>i.effect).filter(Boolean)))];
  const q4Precisions=[...new Set(arr.map(x=>x.q4Precision).filter(Boolean))];
  const q5Statuses=[...new Set(arr.map(x=>x.q5StatutLabel).filter(Boolean))];
  const q5Precisions=[...new Set(arr.map(x=>x.q5Precision).filter(Boolean))];
  const q6Actions=[...new Set(arr.flatMap(x=>safeArray(x.q6Actions)))];
  const q6Modalites=[...new Set(arr.map(x=>x.q6Modalite).filter(Boolean))];
  const q6Objectifs=[...new Set(arr.map(x=>x.q6Objectif).filter(Boolean))];
  const q6Collabs=[...new Set(arr.flatMap(x=>safeArray(x.q6Collaborations)))];

  // Regroupement par polarité pour détecter les variations entre situations
  const diffContexts=[...new Set(arr.filter(x=>x.polarity==="difficulty").map(x=>[x.matiere,x.objectifLecon].filter(Boolean).join(" · ")).filter(Boolean))];
  const funcContexts=[...new Set(arr.filter(x=>x.polarity==="functional").map(x=>[x.matiere,x.objectifLecon].filter(Boolean).join(" · ")).filter(Boolean))];
  const posContexts=[...new Set(arr.filter(x=>x.polarity==="positive").map(x=>[x.matiere,x.objectifLecon].filter(Boolean).join(" · ")).filter(Boolean))];

  return {
    displaySubjects,
    lessonObjectives,
    q2Obs,
    q2Precisions,
    q3Inds,
    q3Precisions,
    q3Wbe,
    q4List,
    q4Types,
    q4Effects,
    q4Precisions,
    q5Statuses,
    q5Precisions,
    q6Actions,
    q6Modalites,
    q6Objectifs,
    q6Collabs,
    diffContexts,
    funcContexts,
    posContexts
  };
}
function compareUnits(units){
  const groups={};
  units.forEach(u=>{
    const subjKey=norm(u.matiere||'generale');
    const groupKey=`${subjKey}::${u.themeId}`;
    (groups[groupKey]??=[]).push(u);
  });
  const cfg=getConvergenceConfig();
  return Object.values(groups).map(arr=>{
    const dates=[...new Set(arr.map(x=>x.date).filter(Boolean))].sort();
    const subjects=[...new Set(arr.map(x=>norm(x.matiere)).filter(Boolean))];
    const sessionIds=[...new Set(arr.map(x=>x.sessionId).filter(Boolean))];
    const sourceKeys=[...new Set(arr.flatMap(x=>Object.entries(x.source).filter(([,v])=>v).map(([k])=>k)))];
    const sourceCount=sourceKeys.length;
    const recurrence=arr.length;
    const marker=arr.filter(x=>recurrenceMarker(x.text)).length;
    const positive=arr.filter(x=>x.polarity==="positive"||Boolean(x.relations?.RESSOURCE)).length;
    const functionalCount=arr.filter(x=>x.polarity==="functional"||Boolean(x.relations?.FONCTIONNEL)).length;
    const difficultyCount=arr.filter(x=>x.polarity==="difficulty"||Boolean(x.relations?.DIFFICULTE)).length;
    const onlyPositive=positive>0 && difficultyCount===0 && functionalCount===0;
    const dominantPolarity=difficultyCount>0?"difficulty":(functionalCount>0?"functional":(positive>0?"positive":"neutral"));
    const comparable=subjects.length<=2 || (sessionIds.length>=3 && subjects.length<=3);
    const semanticStrong=arr.filter(x=>Object.values(x.relations).filter(Boolean).length>=3 && Boolean(x.matiere||x.niveau)).length;
    const localSignal=arr.length===1 && (marker>=1 || semanticStrong>=1);
    let state="OBSERVATION";
    if(!onlyPositive){
      if(sessionIds.length>=cfg.signalMinSessions || localSignal) state="SIGNAL";
      if(sessionIds.length>=cfg.trendMinSessions && dates.length>=2 && comparable) state="TENDANCE";
      if(state==="TENDANCE" && positive>0 && positive<sessionIds.length) state="TENDANCE_QUALIFIEE";
      const multiSourceProposal=sessionIds.length===1 && sourceCount>=cfg.proposalMinSources && semanticStrong>=1 && comparable;
      if(((sessionIds.length>=cfg.trendMinSessions && dates.length>=2 && sourceCount>=2 && comparable) || multiSourceProposal) && state!=="AUCUNE_CONCLUSION_PIA") state="PROPOSITION";
    }
    const counterEvidence=(positive>0 && positive<sessionIds.length) || (functionalCount>0 && difficultyCount>0);
    const contextSummary=summarizeGroupContext(arr);
    return {
      themeId:arr[0].themeId,theme:arr[0].theme,aspect:arr[0].aspect,units:arr,
      recurrence,sessionCount:sessionIds.length,dates,subjects,sourceCount,sourceKeys,
      comparable,positive,functionalCount,difficultyCount,dominantPolarity,
      state,counterEvidence,localSignal,contextSummary,
      justification:{recurrence:`${sessionIds.length} séance(s) distincte(s)`,comparability:comparable?"FORT":"FAIBLE",sources:sourceKeys,localSignal}
    };
  });
}

const PROPOSAL_TEMPLATES = Object.freeze({
  autonomie: theme => `Renforcer l’autonomie dans ${theme.toLowerCase()}, en ajustant progressivement les relances et les supports selon la situation.`,
  comprehension_consignes: _ => `Soutenir la compréhension et la reformulation des consignes, avec vérification de la compréhension lorsque nécessaire.`,
  organisation: _ => `Structurer les étapes de travail et les repères d’organisation afin de favoriser une réalisation plus autonome.`,
  raisonnement_procedure: _ => `Consolider les procédures et stratégies de résolution dans les situations où une aide reste nécessaire.`,
  vocabulaire_communication: _ => `Soutenir l’accès au vocabulaire et la reformulation des informations nécessaires à la tâche.`,
  attention_engagement: _ => `Favoriser le maintien de l’engagement et de l’attention dans les situations où une variabilité est observée.`,
  transfert: _ => `Favoriser le réinvestissement des stratégies dans des situations comparables puis progressivement différentes.`,
  geste_graphique: _ => `Adapter ou soutenir la réalisation graphique et la manipulation des outils lorsque la situation le nécessite.`,
  fatigue: _ => `Observer et aménager l’endurance dans la tâche lorsque la fatigue est documentée.`,
  mathematiques: _ => `Consolider les apprentissages mathématiques ciblés dans les situations documentées par les séances.`
});

const FUNCTIONAL_PROPOSAL_TEMPLATES = Object.freeze({
  autonomie: theme => `Consolider l’autonomie fonctionnelle observée dans ${theme.toLowerCase()} lors de situations plus complexes ou de transfert.`,
  comprehension_consignes: _ => `Consolider la compréhension fonctionnelle des consignes dans les tâches comportant plusieurs étapes ou implicites.`,
  organisation: _ => `Soutenir le transfert des repères d’organisation déjà fonctionnels vers des tâches plus longues ou moins guidées.`,
  raisonnement_procedure: _ => `Consolider le réinvestissement des procédures acquises dans des situations nouvelles ou plus complexes.`,
  vocabulaire_communication: _ => `Affiner la précision du vocabulaire et des reformulations dans les situations d’expression plus exigeantes.`,
  attention_engagement: _ => `Consolider la stabilité de l’attention et de l’engagement lors des activités prolongées ou complexes.`,
  transfert: _ => `Accompagner le transfert des acquis fonctionnels vers de nouveaux contextes d’apprentissage.`,
  geste_graphique: _ => `Consolider l’aisance et la régularité du geste graphique lors de productions plus longues.`,
  fatigue: _ => `Maintenir les repères d’autorégulation du rythme de travail lors des séquences plus denses.`,
  mathematiques: _ => `Consolider les acquis mathématiques fonctionnels dans des situations de résolution plus complexes.`
});

function formatContextualClause(g){
  const cs=g?.contextSummary;
  if(!cs)return "";
  const parts=[];
  const ctxList=[...new Set([...cs.lessonObjectives.slice(0,2),...cs.displaySubjects.slice(0,2)])].filter(Boolean);
  if(ctxList.length){
    parts.push(`Situations observées : ${ctxList.join(" · ")}`);
  }
  if(safeArray(cs.q3Wbe).length){
    parts.push(`Repère WBE : ${cs.q3Wbe.slice(0,2).join(", ")}`);
  }
  if(cs.q4Types.length){
    parts.push(`Appuis observés : ${cs.q4Types.slice(0,2).join(", ")}`);
  }
  if(cs.q6Objectifs.length){
    parts.push(`Critère de réussite : ${cs.q6Objectifs[0].replace(/\.$/,"")}`);
  }else if(cs.q6Actions.length){
    parts.push(`Piste de continuité : ${cs.q6Actions[0].replace(/\.$/,"")}`);
  }
  return parts.length?` (${parts.join(" ; ")})`:"";
}

function proposalText(g){
  if (g?.dominantPolarity === 'functional') {
    const funcTemplate = FUNCTIONAL_PROPOSAL_TEMPLATES[g?.themeId];
    return typeof funcTemplate === 'function'
      ? funcTemplate(g?.theme || '')
      : `Consolider les acquis fonctionnels autour de ${String(g?.theme || '').toLowerCase()} dans les situations complexes ou de transfert.`;
  }
  const template = PROPOSAL_TEMPLATES[g?.themeId];
  return typeof template === 'function'
    ? template(g?.theme || '')
    : `Poursuivre l’accompagnement autour de ${String(g?.theme || '').toLowerCase()} selon les besoins documentés.`;
}
function cleanObjectiveFormulationText(raw){
  return String(raw||"").replace(/\s*\(Situations observées\s*:[^)]*\)/gi,"").trim();
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
  if(typeof document==="undefined"||!document.querySelectorAll)return;
  const bounds=currentPIASchoolYearBounds();
  document.querySelectorAll('input[type="date"]').forEach(input=>{input.min=bounds.start;input.max=bounds.end;});
}
function normalizePIALifecycle(pia){
  if(pia?.lifecycle==="FINALISE")return "FINALISE";
  if(pia?.lifecycle==="EN_REEVALUATION")return "EN_REEVALUATION";
  if(pia?.lifecycle==="ACTIF"||pia?.lifecycle==="EN_VIGUEUR"||["VALIDÉ","VALIDÉE"].includes(pia?.meeting1?.status))return "EN_VIGUEUR";
  return pia?.lifecycle||"EN_CONSTRUCTION";
}
const PIA_CANONICAL_ASPECTS = Object.freeze([
  "Physique et psychomoteur",
  "Lié à l’autonomie",
  "Comportemental et affectif",
  "Communication",
  "Cognitif (pédagogique)"
]);

function cleanQ3IndText(str){
  return String(str||"").replace(/\s*\(appréciation\s*:[^)]*\)/gi,"").replace(/\s*\(processus\s*:\s*/gi," (").trim();
}
function isAdaptationRelevantToAspect(rawAdapt,aspect){
  const a=norm(aspect);
  const t=norm(rawAdapt);
  if(!t)return false;
  if(a.includes("phys")||a.includes("psychom")){
    return /\b(pause|fatig|endurance|rythme|duree|fractionn|geste|graph|ecrit|trace|regle|compas|equerre|manipul|materiel|ergonom|postur|banc|place|assise|moteur|sensori|outil)\b/.test(t)
      && !/\b(explicitation|verbalisation|modelisation|reformulation|guidage verbal)\b/.test(t);
  }
  if(a.includes("comport")||a.includes("affect")){
    return /\b(encourag|valoris|renforc|emotion|frustr|climat|cadre|securis|confiance|contrat|attention|concentration|recentr|banc|place|motivation|relation|accueil)\b/.test(t)
      && !/\b(modelisation|gabarit)\b/.test(t);
  }
  if(a.includes("autonom")){
    return /\b(check|routine|planif|autonomie|etape|fiche|repere|materiel|seul|auto|consigne|organisation| contrat)\b/.test(t);
  }
  if(a.includes("commun")){
    return /\b(reformul|vocabul|oral|verbalis|explici|langag|lexique|mot|expression|echang|question)\b/.test(t);
  }
  return true;
}
function cleanAdaptationLabelForDomain(raw){
  return String(raw||"")
    .replace(/\s*\(effet[^)]*\)/gi,"")
    .replace(/^Modalité\s*:\s*/i,"")
    .trim();
}
function cleanStrengthItemLabel(raw){
  let s=String(raw||"").trim();
  if(!s)return "";
  // Si c'est noté comme à consolider, à renforcer ou fragile : ce n'est PAS un point fort !
  if(/\b(à consolider|a consolider|à renforcer|a renforcer|fragilité|difficulté)\b/i.test(s)){
    return "";
  }
  s=s.replace(/^Point\s+fonctionnel\s*:\s*/i,"").trim();
  const dashIdx=s.indexOf(" — ");
  if(dashIdx>0)s=s.slice(0,dashIdx).trim();
  // Nettoyer toute fuite de token technique ou mention Q5
  s=s.replace(/transfert\s*q5\s*:\s*[^;,.)]*/gi,"").trim();
  s=s.replace(/\b(not_relevant|not_observed|no_opportunity|later)\b/gi,"").trim();
  // Strip parentheses and nested context / session strings
  s=s.replace(/\([^)]*(\)|$)/g,"").trim();
  s=s.replace(/[,;:]\s*$/,"").trim();
  const n=norm(s);
  if(!n)return "";
  if(/^(autonomie|mise au travail et autonomie|travail en autonomie|organisation et fonctions executives|organisation et mise au travail)$/i.test(n)&&n.includes("autonom"))return "Mise au travail et autonomie";
  if(/^organisation et fonctions executives$/i.test(n))return "Organisation et fonctions exécutives";
  if(/^(attention et engagement|concentration et engagement|concentration et implication|motivation et implication|participation et implication|attention et concentration)$/i.test(n))return "Concentration et implication";
  if(/^apprentissages mathematiques$/i.test(n))return "Mobilisation des acquis mathématiques";
  if(/^(comprehension des consignes|comprendre la consigne|identifier ce qui est demande dans la consigne)$/i.test(n))return "Compréhension des consignes";
  if(/^(communication et vocabulaire|vocabulaire et communication|communication)$/i.test(n))return "Communication et vocabulaire";
  if(/^(raisonnement et procedures|procedures et raisonnement|raisonnement)$/i.test(n))return "Raisonnement et procédures";
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function toInfinitiveV74(rawText){
  const s=String(rawText||"").trim();
  if(!s)return "";
  const rules=[
    [/^Choisit\b/i,"Choisir"],
    [/^Applique\b/i,"Appliquer"],
    [/^Transforme\s+ou\s+simplifie\b/i,"Transformer ou simplifier"],
    [/^Transforme\b/i,"Transformer"],
    [/^Simplifie\b/i,"Simplifier"],
    [/^Identifie\b/i,"Identifier"],
    [/^Repère\b/i,"Repérer"],
    [/^Mobilise\b/i,"Mobiliser"],
    [/^Entre\b/i,"Entrer"],
    [/^Suit\b/i,"Suivre"],
    [/^Met\s+en\s+œuvre\b/i,"Mettre en œuvre"],
    [/^Comprend\b/i,"Comprendre"],
    [/^Maintient\b/i,"Maintenir"],
    [/^Utilise\b/i,"Utiliser"],
    [/^Résout\b/i,"Résoudre"],
    [/^Calcule\b/i,"Calculer"],
    [/^Traduit\b/i,"Traduire"],
    [/^Vérifie\b/i,"Vérifier"],
    [/^Justifie\b/i,"Justifier"],
    [/^Explique\b/i,"Expliquer"],
    [/^Formule\b/i,"Formuler"],
    [/^Rédige\b/i,"Rédiger"],
    [/^Lit\b/i,"Lire"],
    [/^Écrit\b/i,"Écrire"],
    [/^Extrait\b/i,"Extraire"],
    [/^Sélectionne\b/i,"Sélectionner"],
    [/^Organise\b/i,"Organiser"],
    [/^Planifie\b/i,"Planifier"],
    [/^Structure\b/i,"Structurer"],
    [/^Participe\b/i,"Participer"],
    [/^Prépare\b/i,"Préparer"],
    [/^Demande\b/i,"Demander"],
    [/^Se\s+repère\b/i,"Se repérer"],
    [/^S['’]engage\b/i,"S’engager"],
    [/^S['’]organise\b/i,"S’organiser"],
    [/^Effectue\b/i,"Effectuer"],
    [/^Trace\b/i,"Tracer"],
    [/^Construis|Construit\b/i,"Construire"],
    [/^Mesure\b/i,"Mesurer"],
    [/^Convertit\b/i,"Convertir"],
    [/^Reconnaît|Reconnait\b/i,"Reconnaître"],
    [/^Détermine\b/i,"Déterminer"],
    [/^Complète\b/i,"Compléter"],
    [/^Reformule\b/i,"Reformuler"],
    [/^Réutilise\b/i,"Réutiliser"]
  ];
  for(const [re,rep] of rules){
    if(re.test(s))return s.replace(re,rep);
  }
  return s;
}
function semanticSkillKeyV74(rawSkill){
  const s=toInfinitiveV74(String(rawSkill||"").trim()).replace(/\.$/,"");
  const n=norm(s);
  if(!n)return "";
  if(/\b(autonomie|mise au travail|entrer dans la tache|demarrer la tache|travail en autonomie)\b/.test(n))return "skill::autonomie_mise_au_travail";
  if(/\b(attention|concentr|engagement|implication|participation)\b/.test(n))return "skill::concentration_implication";
  if(/\b(identifier ce qui est demande|comprendre la consigne|comprehension des consignes|decoder la consigne)\b/.test(n)&&!/\b(traduire|equation|fonction)\b/.test(n))return "skill::comprehension_consigne";
  if(/\b(mettre en oeuvre.*procedure|appliquer la procedure|procedure travaillee|procedure pour resoudre)\b/.test(n))return "skill::mise_en_oeuvre_procedure";
  if(/\b(selectionner les informations|extraire les donnees|reperer les donnees)\b/.test(n))return "skill::selection_infos";
  if(/\b(endurance|rythme de travail|fatig)\b/.test(n))return "skill::endurance_rythme";
  return `skill::${n}`;
}
function pickPreferredSkillLabelV74(existingLabel,candidateLabel){
  const a=String(existingLabel||"").trim();
  const b=String(candidateLabel||"").trim();
  if(!a)return b;
  if(!b)return a;
  const na=norm(a),nb=norm(b);
  if(na.includes("procedure")&&nb.includes("procedure")){
    if(nb.includes("resoudre")&&!na.includes("resoudre"))return b;
    if(na.includes("resoudre")&&!nb.includes("resoudre"))return a;
  }
  if((na==="autonomie"||nb==="autonomie")&&(na.includes("mise au travail")||nb.includes("mise au travail"))){
    return "Mise au travail et autonomie";
  }
  if(na.startsWith("concentration et")&&nb.startsWith("concentration et")){
    return "Concentration et implication";
  }
  return b.length>a.length&&!b.includes("(")?b:a;
}
function formatHumanDateShortV74(dateStr){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr||"").trim());
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(dateStr||"").trim();
}
function buildContextTreeFromUnitsV74(unitsList){
  const bySubj=new Map();
  safeArray(unitsList).forEach(u=>{
    const subj=String(u.matiere||"Matière non renseignée").trim()||"Matière non renseignée";
    const chap=canonicalizeWbeChapter(u.q3WbeRepere||"",u.objectifLecon||"",subj)||String(u.objectifLecon||"Séance observée").trim();
    const dStr=formatHumanDateShortV74(u.date);
    if(!bySubj.has(subj))bySubj.set(subj,new Map());
    const chapMap=bySubj.get(subj);
    if(!chapMap.has(chap))chapMap.set(chap,{chapter:chap,dates:[],skills:new Map()});
    const cEntry=chapMap.get(chap);
    if(dStr&&!cEntry.dates.includes(dStr))cEntry.dates.push(dStr);
    const rawSkills=[
      ...safeArray(u.q3Indicators).map(cleanQ3IndText).map(x=>x.split(" — ")[0].replace(/\s*\([^)]*\)/g,"").trim()),
      ...safeArray(u.q2Observations).map(x=>String(x||"").replace(/\s*\((?:partiellement|suffisamment|totalement)\)/gi,"").trim())
    ].filter(Boolean);
    rawSkills.forEach(sk=>{
      const inf=toInfinitiveV74(sk).replace(/\.$/,"").trim();
      if(!inf)return;
      const k=semanticSkillKeyV74(inf);
      if(!cEntry.skills.has(k)){
        cEntry.skills.set(k,inf);
      }else{
        cEntry.skills.set(k,pickPreferredSkillLabelV74(cEntry.skills.get(k),inf));
      }
    });
  });
  return [...bySubj.entries()].map(([subject,chapMap])=>({
    subject,
    chapters:[...chapMap.values()].map(c=>({
      chapter:c.chapter,
      dates:c.dates,
      skills:[...c.skills.values()].slice(0,4)
    }))
  }));
}
function formatConciseObjectiveForAspect(aspect,themeId){
  const a=norm(aspect);
  const t=norm(themeId);
  if(a.includes("phys")||a.includes("psychom"))return "Soutenir le geste graphique, la posture et la manipulation ergonomique des outils";
  if(t==="fatigue"||(a.includes("autonom")&&t.includes("fatig")))return "Aménager la gestion du temps et le rythme pour soutenir l’endurance de travail";
  if(t==="comprehension_consignes")return "Sécuriser la compréhension et le décodage des consignes";
  if(t==="organisation")return "Structurer l’entrée dans la tâche et le suivi des étapes";
  if(t==="raisonnement_procedure"||t==="mathematiques")return "Consolider l’application des procédures et des règles travaillées";
  if(t==="vocabulaire_communication"||a.includes("commun"))return "Soutenir la précision du vocabulaire et la verbalisation de la démarche";
  if(a.includes("comport")||a.includes("affect"))return "Prévenir les situations d’évitement ou de découragement et sécuriser le climat de travail";
  if(t==="attention"||a.includes("cogn"))return "Favoriser la mobilisation, la concentration et le maintien de l’attention";
  if(t==="autonomie"||a.includes("autonom"))return "Développer l’autonomie de mise au travail à l’aide de repères stables";
  return "Accompagner et consolider les besoins ciblés dans ce domaine";
}
function defaultMeansForAspect(aspect,adaptList=[]){
  const a=norm(aspect);
  const joined=norm(adaptList.join(" "));
  if(a.includes("phys")||a.includes("psychom")){
    return "Contrat d’objectifs · Aménagement du rythme et du poste de travail";
  }
  if(a.includes("comport")||a.includes("affect")){
    return "Contrat d’objectifs · Aménagement du cadre de classe";
  }
  if(a.includes("autonom")){
    return "Check-list méthodologique · Fiche de suivi d’autonomie";
  }
  if(a.includes("commun")){
    return "Référentiel lexical · Temps d’explicitation guidée";
  }
  if(/gabarit|fiche|referentiel/.test(joined)){
    return "Fiche-outil personnalisée · Référentiel procédural";
  }
  return "Fiche-outil méthodologique · Guidage structuré étape par étape";
}
function formatGroupResourceEntry(g){
  return cleanStrengthItemLabel(g?.theme||"");
}
function formatGroupFunctionalEntry(g){
  const label=cleanStrengthItemLabel(g?.theme||"");
  return label?`Point fonctionnel : ${label} (fonctionnement suffisant en situation courante)`:"";
}
function formatGroupDifficultyEntry(g){
  const tree=buildContextTreeFromUnitsV74(safeArray(g?.units).filter(u=>u.polarity==="difficulty"||u.polarity==="functional"));
  if(tree.length){
    const lines=[];
    tree.forEach(fg=>{
      safeArray(fg.chapters).forEach(ch=>{
        safeArray(ch.skills).forEach(sk=>{
          lines.push(`${fg.subject} — ${ch.chapter} : ${sk}`);
        });
      });
    });
    if(lines.length)return lines[0];
  }
  const cs=g.contextSummary||{};
  const subj=safeArray(cs.displaySubjects)[0]||"Matière non renseignée";
  const chap=canonicalizeWbeChapter(safeArray(cs.q3Wbe)[0]||"",safeArray(cs.lessonObjectives)[0]||"",subj)||safeArray(cs.lessonObjectives)[0]||"Séance observée";
  const rawObs=safeArray(cs.q2Obs).map(o=>toInfinitiveV74(String(o||"").replace(/\s*\((?:partiellement|suffisamment|totalement)\)/gi,"").trim()).replace(/\.$/,"")).filter(Boolean)[0];
  const q3Diff=safeArray(cs.q3Inds).filter(i=>/renforcer|fragil/i.test(i)).map(i=>toInfinitiveV74(cleanQ3IndText(i).split(" — ")[0].replace(/\s*\([^)]*\)/g,"").trim()).replace(/\.$/,"")).filter(Boolean)[0];
  const skill=q3Diff||rawObs||g.theme;
  return `${subj} — ${chap} : ${skill}`;
}
function deduplicateDomainStrengthsV74(items,preserveFunctionalTag=false){
  const map=new Map();
  safeArray(items).forEach(raw=>{
    const str=String(raw||"");
    if(/\b(à consolider|a consolider|à renforcer|a renforcer)\b/i.test(str)) return;
    const isFunc=/fonctionnement\s+suffisant\s+en\s+situation\s+courante|point\s+fonctionnel/i.test(str);
    const clean=cleanStrengthItemLabel(raw);
    if(!clean)return;
    const finalLabel=(preserveFunctionalTag&&isFunc)?`Point fonctionnel : ${clean} (fonctionnement suffisant en situation courante)`:clean;
    const k=semanticSkillKeyV74(clean);
    if(!map.has(k))map.set(k,finalLabel);
    else map.set(k,pickPreferredSkillLabelV74(map.get(k),finalLabel));
  });
  return [...map.values()];
}
function deduplicateDomainDifficultiesV74(unitsForAspect,fallbackStrings=[]){
  const diffUnits=safeArray(unitsForAspect).filter(u=>u.polarity==="difficulty");
  const tree=buildContextTreeFromUnitsV74(diffUnits);
  const out=[];
  tree.forEach(fg=>{
    safeArray(fg.chapters).forEach(ch=>{
      safeArray(ch.skills).forEach(sk=>{
        out.push(`${fg.subject} — ${ch.chapter} : ${sk}`);
      });
    });
  });
  if(out.length)return [...new Set(out)];
  const map=new Map();
  safeArray(fallbackStrings).forEach(raw=>{
    const str=String(raw||"").replace(/\s*\(rep[eè]re\s+wbe\s*:[^)]*\)/gi,"").trim();
    if(!str)return;
    const skillPart=str.includes(" : ")?str.split(" : ").slice(1).join(" : ").trim():str.split(" — ").pop().trim();
    const k=semanticSkillKeyV74(skillPart||str);
    if(!map.has(k))map.set(k,str);
    else map.set(k,pickPreferredSkillLabelV74(map.get(k),str));
  });
  return [...map.values()];
}
function buildProposalContextTreeV74(p){
  const bySubj=new Map();
  safeArray(p?.evidence).forEach(item=>{
    const subj=String(item.matiere||"Matière non renseignée").trim()||"Matière non renseignée";
    const chap=item.chapter||canonicalizeWbeChapter(item.wbeRepere||"",item.objectif||"",subj)||item.objectif||"Séance observée";
    const sKey=norm(subj);
    if(!bySubj.has(sKey))bySubj.set(sKey,{subject:subj,chapters:new Map()});
    const subjGroup=bySubj.get(sKey);
    const cKey=norm(chap);
    if(!subjGroup.chapters.has(cKey))subjGroup.chapters.set(cKey,{chapter:chap,dates:[],skills:new Map()});
    const chapGroup=subjGroup.chapters.get(cKey);
    const d=formatHumanDateShortV74(item.date||"");
    if(d&&!chapGroup.dates.includes(d))chapGroup.dates.push(d);
  });
  const skillsList=safeArray(p?.criteresObservable).filter(c=>!String(c).startsWith("Chapitre :")).map(c=>toInfinitiveV74(String(c||"").trim()).replace(/\.$/,"")).filter(Boolean);
  if(!skillsList.length&&p?.constatContextualise){
    const rawC=String(p.constatContextualise);
    const sk=rawC.includes(" : ")?rawC.split(" : ").slice(1).join(" : ").replace(/\s*\([^)]*\)\s*$/,"").trim():rawC.replace(/\s*\([^)]*\)\s*$/,"").trim();
    if(sk)skillsList.push(sk);
  }
  bySubj.forEach(sg=>{
    sg.chapters.forEach(cg=>{
      skillsList.forEach(sk=>{
        const k=semanticSkillKeyV74(sk);
        if(!cg.skills.has(k))cg.skills.set(k,sk);
        else cg.skills.set(k,pickPreferredSkillLabelV74(cg.skills.get(k),sk));
      });
    });
  });
  return [...bySubj.values()].map(sg=>({
    subject:sg.subject,
    chapters:[...sg.chapters.values()].map(cg=>({
      chapter:cg.chapter,
      dates:cg.dates,
      skills:[...cg.skills.values()]
    }))
  }));
}
function groupOccurrencesBySubjectAndChapterV74(occurrencesList){
  const byChap=new Map();
  safeArray(occurrencesList).forEach(occ=>{
    const subj=String(occ.matiere||"Matière non renseignée").trim()||"Matière non renseignée";
    const rawChap=occ.chapter||canonicalizeWbeChapter(occ.wbeRepere||"",occ.objectif||"",subj)||occ.objectif||"Séance observée";
    const chap=String(rawChap).trim();
    const label=[subj,chap&&chap!=="Thématique travaillée"?chap:""].filter(Boolean).join(" — ");
    const key=norm(label);
    if(!byChap.has(key))byChap.set(key,{label,dates:[]});
    const g=byChap.get(key);
    const d=formatHumanDateShortV74(occ.date||occ.dateStr||"");
    if(d&&!g.dates.includes(d))g.dates.push(d);
  });
  return [...byChap.values()].map(g=>g.dates.length?`${g.label} : ${g.dates.join(", ")}`:g.label);
}
function formatGroupEvolutionEntry(g){
  const cs=g.contextSummary||{};
  const ordered=safeArray(g.units).slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
  const polSeq=ordered.map(u=>u.polarity).filter(p=>p&&p!=="neutral");
  const distinctPol=[...new Set(polSeq)];
  const ctxHint=safeArray(cs.displaySubjects).length?` (${cs.displaySubjects.join(", ")})`:"";
  let narrative;
  if(distinctPol.length>1){
    const firstP=polSeq[0],lastP=polSeq[polSeq.length-1];
    if(firstP==="difficulty"&&lastP==="functional"){
      narrative=`évolution documentée d’une réalisation partielle vers un fonctionnement suffisant en situation courante, restant à consolider en tâche complexe`;
    }else if((firstP==="difficulty"||firstP==="functional")&&lastP==="positive"){
      narrative=`progression documentée vers une mobilisation maîtrisée dans les dernières situations observées, sans conclure à une généralisation hors contexte`;
    }else{
      narrative=`fonctionnement variable selon la complexité ou le contexte des tâches observées`;
    }
  }else if(g.dominantPolarity==="positive"){
    narrative=`point d’appui observé de manière stable dans les situations documentées`;
  }else if(g.dominantPolarity==="functional"){
    narrative=`fonctionnement suffisant observé en situation courante (consolidation des situations complexes ou transferts)`;
  }else{
    narrative=`besoin de renforcement situé sur les tâches observées`;
  }
  const validQ5Statuses = safeArray(cs.q5Statuses).filter(st => {
    const s = String(st || "").trim().toLowerCase();
    return s && !/not_relevant|not_observed|no_opportunity|later|non pertinent|pas d’occasion|pas d'occasion|non observé/i.test(s);
  });
  const q5Part = validQ5Statuses.length ? ` · Transfert : ${validQ5Statuses.join(", ").toLowerCase()}` : "";
  return `${g.theme}${ctxHint} : ${narrative}${q5Part}.`;
}

function proposalSemanticClusterKey(g){
  const subj=norm(safeArray(g?.units)[0]?.matiere||safeArray(g?.contextSummary?.displaySubjects)[0]||"generale");
  const t=norm(g?.themeId||g?.theme||"");
  const pol=g?.dominantPolarity||"difficulty";
  if(t==="raisonnement_procedure"||t==="mathematiques"||/\b(procedure|mathematique|equation|puissance|priorite)\b/.test(t)){
    return `${subj}::${g?.aspect||""}::${pol}::procedures_apprentissages`;
  }
  if(t==="autonomie"||/\b(autonomie|mise au travail)\b/.test(t)){
    return `${subj}::${g?.aspect||""}::${pol}::autonomie`;
  }
  if(t==="attention_engagement"||/\b(attention|concentration|engagement)\b/.test(t)){
    return `${subj}::${g?.aspect||""}::${pol}::attention`;
  }
  return `${subj}::${g?.aspect||""}::${pol}::${t}`;
}

function buildPIA(student,sessions,until,existing){
  const schoolYear=piaSchoolYear(until);
  if(!schoolYear)throw new Error("La date de référence doit appartenir à une année scolaire en cours.");
  const logs=studentSessions(student,sessions,until);
  const units=logs.flatMap(extractUnits);
  const groups=compareUnits(units);
  const aspects=PIA_CANONICAL_ASPECTS;
  const previousSections=new Map(safeArray(existing?.sections).map(section=>[section.aspect,section]));
  const sections=aspects.map(aspect=>{
    const gs=groups.filter(g=>g.aspect===aspect);
    const difficulties=gs.filter(g=>["SIGNAL","TENDANCE","TENDANCE_QUALIFIEE","PROPOSITION"].includes(g.state)&&g.dominantPolarity!=="functional").slice(0,3);
    const functionals=gs.filter(g=>g.functionalCount>0).slice(0,2);
    const resources=gs.filter(g=>g.positive>0).slice(0,2);
    const previous=previousSections.get(aspect)||{};
    const derivedCriteresMap=new Map();
    gs.forEach(g=>{
      const cs=g.contextSummary||{};
      safeArray(cs.q3Inds).forEach(ind=>{
        const cleanedFull=cleanQ3IndText(ind).replace(/\s*\((?:maîtrisé|maitrisé|mobilisé|point d['’]appui|appropriation en cours|à renforcer|fragilité observée|non évalué)[^)]*\)/gi,"").trim();
        const parts=cleanedFull.split(" — ");
        const head=toInfinitiveV74(parts[0].replace(/\s*\([^)]*\)/g,"").trim()).replace(/\.$/,"");
        if(!head)return;
        const tail=parts.slice(1).join(" — ").trim();
        const cl=tail?`${head} — ${tail}`:head;
        const k=semanticSkillKeyV74(head);
        if(!derivedCriteresMap.has(k))derivedCriteresMap.set(k,cl);
        else derivedCriteresMap.set(k,pickPreferredSkillLabelV74(derivedCriteresMap.get(k),cl));
      });
      safeArray(cs.q3Wbe).forEach(w=>{
        const cw=canonicalizeWbeChapter(w,"",cs.displaySubjects?.[0]||"")||cleanWbeRawToken(w);
        if(cw){
          const k=`wbe::${norm(cw)}`;
          if(!derivedCriteresMap.has(k))derivedCriteresMap.set(k,`Chapitre WBE : ${cw}`);
        }
      });
    });
    const derivedCriteres=[...derivedCriteresMap.values()].slice(0,5);
    const derivedMoyens=difficulties.length?[...new Set(difficulties.flatMap(g=>{
      const cs=g.contextSummary||{};
      const filteredTypes=safeArray(cs.q4Types).filter(t=>isAdaptationRelevantToAspect(t,aspect)).map(cleanAdaptationLabelForDomain).filter(Boolean);
      const filteredPrecs=safeArray(cs.q4Precisions).filter(p=>isAdaptationRelevantToAspect(p,aspect)).map(p=>String(p||"").trim()).filter(Boolean);
      const filteredActions=safeArray(cs.q6Actions).filter(a=>isAdaptationRelevantToAspect(a,aspect)).map(a=>String(a||"").trim()).filter(Boolean);
      return [
        ...filteredTypes,
        ...filteredPrecs,
        ...filteredActions
      ];
    }))].slice(0,5):[];
    const evolution=gs.filter(g=>g.dates.length).map(formatGroupEvolutionEntry).slice(0,3);
    const aspectUnits=gs.flatMap(g=>safeArray(g.units));
    const cleanRessources=deduplicateDomainStrengthsV74([
      ...safeArray(previous.ressources),
      ...resources.map(formatGroupResourceEntry),
      ...functionals.map(formatGroupFunctionalEntry)
    ],true).slice(0,5);
    const cleanDifficultes=deduplicateDomainDifficultiesV74(
      aspectUnits,
      [...safeArray(previous.difficultes),...difficulties.map(formatGroupDifficultyEntry)]
    ).slice(0,6);
    return {
      ...previous,aspect,
      ressources:cleanRessources,
      difficultes:cleanDifficultes,
      objectifs:safeArray(previous.objectifs),
      criteres:[...new Set([...safeArray(previous.criteres).map(c=>String(c||"").replace(/rep[eè]re\s+wbe\s*:\s*([a-z0-9_|-]+)/gi,(_,t)=>`Chapitre WBE : ${canonicalizeWbeChapter(t)||cleanWbeRawToken(t)}`)).filter(Boolean),...derivedCriteres])].slice(0,5),
      moyens:cleanDifficultes.length?[...new Set([...safeArray(previous.moyens).map(cleanAdaptationLabelForDomain).filter(Boolean),...derivedMoyens])].slice(0,5):[],
      evolution:[...new Set([...safeArray(previous.evolution),...evolution])].slice(0,3)
    };
  });
  const previousProposals=safeArray(existing?.propositions);
  const previouslyValidated=safeArray(existing?.meeting1?.objectivesValidated);

  // Fusion sémantique des groupes de propositions redondants (Point 4 & PIA annuel)
  const mergedProposalGroupsMap=new Map();
  groups.filter(g=>g.state==="PROPOSITION").forEach(g=>{
    const cKey=proposalSemanticClusterKey(g);
    if(!mergedProposalGroupsMap.has(cKey)){
      mergedProposalGroupsMap.set(cKey,{
        ...g,
        mergedThemeIds:[g.themeId],
        units:[...safeArray(g.units)]
      });
    }else{
      const existingGroup=mergedProposalGroupsMap.get(cKey);
      if(!existingGroup.mergedThemeIds.includes(g.themeId))existingGroup.mergedThemeIds.push(g.themeId);
      // Privilégier le thème le plus transversal ("Raisonnement et procédures" sur "Apprentissages mathématiques")
      if(g.themeId==="raisonnement_procedure"&&existingGroup.themeId==="mathematiques"){
        existingGroup.themeId=g.themeId;
        existingGroup.theme=g.theme;
      }
      const seenUnitIds=new Set(existingGroup.units.map(u=>u.id));
      safeArray(g.units).forEach(u=>{if(!seenUnitIds.has(u.id)){seenUnitIds.add(u.id);existingGroup.units.push(u);}});
      existingGroup.dates=[...new Set([...existingGroup.dates,...g.dates])].sort();
      const sIds=[...new Set(existingGroup.units.map(u=>u.sessionId).filter(Boolean))];
      existingGroup.sessionCount=sIds.length;
      existingGroup.recurrence=existingGroup.units.length;
      existingGroup.counterEvidence=Boolean(existingGroup.counterEvidence||g.counterEvidence);
      existingGroup.contextSummary=summarizeGroupContext(existingGroup.units);
      existingGroup.justification={
        recurrence:`${sIds.length} séance(s) distincte(s)`,
        comparability:existingGroup.comparable?"FORT":"FAIBLE",
        sources:[...new Set([...safeArray(existingGroup.justification?.sources),...safeArray(g.justification?.sources)])],
        localSignal:Boolean(existingGroup.localSignal&&g.localSignal)
      };
    }
  });

  const generatedProposals=[...mergedProposalGroupsMap.values()].map(g=>{
    const previous=previousProposals.find(item=>g.mergedThemeIds.includes(item.themeId)||item.themeId===g.themeId);
    const wasValidated=previouslyValidated.some(item=>typeof item==="object"&&(g.mergedThemeIds.includes(item.themeId)||item.themeId===g.themeId||item.formulation===previous?.formulation));
    const decisionStatus=previous?.decisionStatus||(wasValidated?"VALIDEE":"A_EXAMINER");
    const cs=g.contextSummary||{};
    const rawForm=previous?.formulation||proposalText(g);
    const cleanWbeList=[...new Set(safeArray(cs.q3Wbe).map(w=>canonicalizeWbeChapter(w,"",cs.displaySubjects?.[0]||"")||cleanWbeRawToken(w)).filter(Boolean))];
    const cleanMoyens=[...new Set([
      ...safeArray(cs.q4Types).map(cleanAdaptationLabelForDomain),
      ...safeArray(cs.q6Actions),
      ...safeArray(cs.q6Modalites).map(m=>`Modalité : ${m}`),
      ...safeArray(cs.q6Collabs).map(c=>`Collaboration : ${c}`)
    ].filter(Boolean))].slice(0,4);
    const dedupedCriteresMap=new Map();
    safeArray(cs.q3Inds).forEach(ind=>{
      const cl=toInfinitiveV74(cleanQ3IndText(ind).split(" — ")[0].replace(/\s*\([^)]*\)/g,"").trim()).replace(/\.$/,"");
      if(!cl)return;
      const k=semanticSkillKeyV74(cl);
      if(!dedupedCriteresMap.has(k))dedupedCriteresMap.set(k,cl);
      else dedupedCriteresMap.set(k,pickPreferredSkillLabelV74(dedupedCriteresMap.get(k),cl));
    });
    const prop={
      id:previous?.id||uid("prop"),theme:g.theme,themeId:g.themeId,aspect:g.aspect,state:"PROPOSITION",
      dominantPolarity:g.dominantPolarity,
      decisionStatus,formulation:cleanObjectiveFormulationText(rawForm),
      wbeReperes:cleanWbeList,
      criteresObservable:[...new Set([...dedupedCriteresMap.values(),...cleanWbeList.map(w=>`Chapitre : ${w}`)])].slice(0,4),
      moyensAssocies:cleanMoyens,
      constatContextualise:g.dominantPolarity==="functional"?formatGroupFunctionalEntry(g):formatGroupDifficultyEntry(g),
      provenance:{source:"SEANCE",sessionIds:[...new Set(g.units.map(u=>u.sessionId))],sourceKeys:g.justification.sources||[]},
      evidence:g.units.map(u=>({sessionId:u.sessionId,date:u.date,matiere:u.matiere,objectif:u.objectifLecon,wbeRepere:u.q3WbeRepere,chapter:canonicalizeWbeChapter(u.q3WbeRepere||"",u.objectifLecon||"",u.matiere||"")||u.objectifLecon||""})),
      counterEvidence:g.counterEvidence,recurrence:g.recurrence,sessionCount:g.sessionCount,dates:g.dates,
      convergence:g.justification
    };
    if(previous?.decidedAt&&decisionStatus!=="A_EXAMINER")prop.decidedAt=previous.decidedAt;
    return prop;
  });
  const generatedThemeIds=new Set(generatedProposals.map(p=>p.themeId));
  const preservedDecidedProposals=previousProposals.filter(p=>p&&!generatedThemeIds.has(p.themeId)&&["VALIDEE","REFUSEE"].includes(p.decisionStatus)).map(p=>({...p}));
  const proposals=[...generatedProposals,...preservedDecidedProposals];
  const amenagementBuckets={
    P:{type:"P",base:"Adapter / expliciter la consigne et les étapes lorsque cela est nécessaire.",details:new Set(),effects:new Set(),suites:new Set()},
    O:{type:"O",base:"Structurer l’organisation de la tâche et ajuster les modalités d’accompagnement selon la situation.",details:new Set(),effects:new Set(),suites:new Set()},
    M:{type:"M",base:"Utiliser le matériel ou l’outil explicitement renseigné dans les séances lorsque cela est pertinent.",details:new Set(),effects:new Set(),suites:new Set()}
  };
  const activeBuckets=new Set();
  logs.forEach(s=>{
    const q4Items=extractSessionQ4Items(s);
    const q6=s.q6||{};
    const raw=[...q4Items.map(x=>x.summary),s.q4?.precision,...safeArray(q6.actions),q6.modalite,q6.objectif,...safeArray(q6.collaborations),q6.precision].filter(Boolean).join(" ");
    const t=norm(raw); if(!t)return;
    const matchedTypes=[];
    if(/consigne|reformul|etape|procedure|support visuel|visuel|surlign|segment|cache|explici|schema|schéma|modelis|modélis/.test(t))matchedTypes.push("P");
    if(/temps|relance|organisation|routine|place|groupe|individuel|collectif|classe|co-intervention|collaboration|enseignant|parent|pms|logop|check|rituel|planif/.test(t))matchedTypes.push("O");
    if(/ipad|ordinateur|outil|calculatrice|regle|compas|equerre|materiel|tablette|clavier|logiciel|gabarit|jeton|abaque/.test(t))matchedTypes.push("M");
    if(!matchedTypes.length&&q4Items.length)matchedTypes.push("P");
    matchedTypes.forEach(code=>{
      activeBuckets.add(code);
      const b=amenagementBuckets[code];
      q4Items.forEach(item=>{
        if(item.type)b.details.add(item.type);
        if(item.effect)b.effects.add(`${item.type} : ${item.effect.toLowerCase()}`);
      });
      if(s.q4?.precision)b.details.add(String(s.q4.precision).trim());
      safeArray(q6.actions).forEach(act=>b.suites.add(String(act).trim()));
      if(q6.modalite)b.suites.add(`Modalité : ${q6.modalite}`);
      if(q6.objectif)b.suites.add(`Objectif : ${q6.objectif}`);
      safeArray(q6.collaborations).forEach(col=>b.suites.add(`Relais : ${col}`));
    });
  });
  const amenagements=[...activeBuckets].map(code=>{
    const b=amenagementBuckets[code];
    const detailStr=[...b.details].slice(0,3).join(", ");
    const effectStr=[...b.effects].slice(0,2).join(" ; ")||"À observer lors des prochaines séances.";
    const suiteStr=[...b.suites].slice(0,2).join(" · ")||"À confirmer en équipe.";
    return {
      type:code,
      texte:detailStr?`${b.base} (${detailStr})` : b.base,
      effetDocumente:effectStr,
      suitePrevue:suiteStr,
      state:"PROPOSITION",
      evidenceCount:logs.length
    };
  });
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
    traceability:{sessionIds:logs.map(s=>String(s.id)),states:groups.map(g=>({theme:g.theme,themeId:g.themeId,state:g.state,recurrence:g.recurrence,sessionCount:g.sessionCount,dates:g.dates,comparable:g.comparable,counterEvidence:g.counterEvidence,localSignal:g.localSignal,sourceKeys:g.sourceKeys,dominantPolarity:g.dominantPolarity})),
      rule:"Une proposition n'est jamais une validation. Les relations séance sont documentaires et non causales. Les objectifs du PIA précédent sont une source de continuité à réévaluer."}
  };
}
function evaluateMeeting2(pia,existing){
  const validated=safeArray(pia.meeting1?.objectivesValidated);
  const previousMeetingDate=existing?.meeting1?.validatedAt||pia.meeting1?.validatedAt||"";
  const start=previousMeetingDate?dateOnly(previousMeetingDate):"";
  const existingEval=safeArray(existing?.meeting2?.evaluation||pia.meeting2?.evaluation);
  return validated.map(obj=>{
    const formulation=typeof obj==='string'?obj:obj.formulation||"";
    const themeId=typeof obj==='object'?obj.themeId||"":"";
    const prior=existingEval.find(e=>(themeId&&e.themeId===themeId)||e.objectif===formulation);
    const related=safeArray(pia.propositions).filter(p=>(themeId&&p.themeId===themeId)||norm(p.formulation).includes(norm(formulation).slice(0,50)));
    return {
      objectif:formulation,
      themeId,
      evidence:related.flatMap(p=>p.evidence||[]).filter(e=>!start||dateOnly(e.date)>start),
      state:prior?.state||"A_DISCUSSER",
      source:"SEANCES_POST_REUNION_1",
      note:prior?.note||"Évaluation à confirmer en réunion 2 par le professionnel et l'équipe."
    };
  });
}

const PIA_AMENAGEMENT_TYPE_LABELS=Object.freeze({
  P:"Pédagogique (P)",
  O:"Organisationnel (O)",
  M:"Matériel (M)"
});
const PIA_MEETING_STATUS_LABELS=Object.freeze({
  A_REEVALUER:"À réévaluer",
  A_PREPARE:"À préparer",
  A_VENIR:"À venir",
  VALIDÉ:"Validée",
  VALIDÉE:"Validée",
  EN_REEVALUATION:"Réévaluation en cours",
  REEVALUATION_VALIDEE:"Réévaluation validée",
  FINALISE:"Finalisée"
});
function formatMeetingStatusLabel(status){
  const raw=String(status||"").trim();
  return PIA_MEETING_STATUS_LABELS[raw]||raw||"À préparer";
}
function formatAmenagementTypeLabel(type){
  const raw=String(type||"").trim().toUpperCase();
  return PIA_AMENAGEMENT_TYPE_LABELS[raw]||raw||"Aménagement";
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
function appendMeetingText(lines,title,meeting,isMeeting2=false,deidentified=false){
  lines.push(title);
  lines.push(`Type : ${meeting?.type==="REUNION_2_FIN_ANNEE"?"Réunion de fin d’année (réévaluation)":(meeting?.type==="REUNION_1_DECEMBRE"?"Réunion initiale / décembre":(meeting?.type||"À préciser"))}`);
  lines.push(`Statut de la rencontre : ${formatMeetingStatusLabel(meeting?.status)}`);
  if(!deidentified){
    lines.push(`Date de la rencontre : ${meeting?.date||"À préciser"}`);
    if(meeting?.validatedAt)lines.push(`Date de validation : ${dateOnly(meeting.validatedAt)}`);
  }
  lines.push(`Contexte : ${meeting?.context||(deidentified?"[retiré de l’export dé-identifié]":"À compléter")}`);
  const participants=PIA_MEETING_ACTORS.filter(actor=>meeting?.participants?.[actor.id]).map(actor=>actor.label);
  lines.push("Participants :",...(participants.length?participants.map(x=>`• ${x}`):["• À préciser."]));
  lines.push("Retours des participants :");
  const feedback=PIA_MEETING_ACTORS.filter(actor=>meeting?.feedback?.[actor.id]).map(actor=>`• ${actor.label} : ${meeting.feedback[actor.id]}`);
  lines.push(...(feedback.length?feedback:[deidentified?"• Retours nominatifs retirés de l’export dé-identifié.":"• À compléter."]));
  for(const [key,label] of [["decisions","Décisions"],["objectivesModified","Objectifs modifiés"],["means","Moyens"],["adaptations","Adaptations P/O/M"],["information","Informations complémentaires"],["notes","Notes"]]){
    const val=meeting?.[key];
    lines.push(`${label} : ${val||(deidentified&&["decisions","objectivesModified","information","notes"].includes(key)?"[retiré de l’export dé-identifié]":"À compléter.")}`);
  }
  if(isMeeting2){
    const evalItems=safeArray(meeting?.evaluation);
    lines.push("Bilan d’évaluation des objectifs :");
    if(evalItems.length){
      evalItems.forEach(item=>{
        const evCount=safeArray(item?.evidence).length;
        const evInfo=!deidentified&&evCount>0?` (${evCount} séance(s) post-réunion 1)`:"";
        const stateInfo=item?.state?` [${item.state==="A_DISCUSSER"?"À discuter en équipe":item.state}]`:"";
        lines.push(`• ${item?.objectif||"Objectif"}${evInfo}${stateInfo}${item?.note?` — ${item.note}`:""}`);
      });
    }else{
      lines.push("• Aucun élément de réévaluation enregistré à ce stade.");
    }
    const contItems=safeArray(meeting?.objectivesToContinue);
    lines.push("Objectifs maintenus / reconduits :");
    lines.push(...(contItems.length?contItems.map(x=>`• ${typeof x==="string"?x:x.formulation||""}`):["• Aucun objectif reconduit spécifié à ce stade."]));
    const perspItems=safeArray(meeting?.perspectives);
    lines.push("Perspectives pour la suite :");
    lines.push(...(perspItems.length?perspItems.map(x=>`• ${typeof x==="string"?x:x.formulation||x.texte||""}`):["• À compléter lors du bilan de fin d’année."]));
  }
  lines.push("");
}
function piaTextSections(pia,deidentified=false){
  const d=piaForExport(pia,deidentified), lines=[];
  lines.push(deidentified?"PIA — modèle dé-identifié":"PIA annuel — document professionnel");
  lines.push(`Statut : ${piaStatusLabel(d)}`);
  if(!deidentified){
    lines.push(`Élève : ${[d.eleve,d.classe,d.ecole].filter(Boolean).join(" · ")||"Non renseigné"}`);
    lines.push(`Année scolaire : ${d.schoolYear||""}`);
    if(d.finalizedAt)lines.push(`Date de clôture annuelle : ${dateOnly(d.finalizedAt)}`);
  }
  lines.push(`Séances analysées : ${Number(d.sessionsAnalysed||0)}`);
  lines.push("Note méthodologique : Les éléments issus des séances sont descriptifs et non causaux. Seuls les objectifs explicitement validés engagent le PIA en vigueur.");
  lines.push("");
  lines.push("Continuité avec le PIA précédent");
  const sc=d.sourceContinuity?.extracted||{};
  if(!deidentified && d.sourceContinuity?.present){
    lines.push(`Source importée : document ${String(d.sourceContinuity.format||"").toUpperCase()||"PIA"} traité localement.`);
    if(sc.objectives?.length) lines.push("Objectifs précédents :",...sc.objectives.map(x=>`• ${x}`));
    if(sc.difficulties?.length) lines.push("Besoins / difficultés précédemment documentés :",...sc.difficulties.map(x=>`• ${x}`));
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
    const domObjectives=piaDomainObjectives(d,sec);
    lines.push(...(domObjectives.length?domObjectives.map(x=>`• ${x}`):["• Aucun objectif validé dans ce domaine à ce stade (voir les propositions à examiner ci-dessous)."]));
    for(const [key,label] of [["criteres","Critères d’évaluation"],["moyens","Moyens / adaptations"],["evolution","Évolution documentée"]]){
      lines.push(label);
      lines.push(...(safeArray(sec[key]).length?safeArray(sec[key]).map(x=>`• ${x}`):["• À compléter."]));
    }
    lines.push("");
  }
  lines.push("Objectifs visés pour la période et critères d’évaluation");
  const prev=safeArray(d.meeting1?.objectivesPrevious);
  const val=safeArray(d.meeting1?.objectivesValidated);
  const props=safeArray(d.propositions);
  const pendingProps=props.filter(x=>(x.decisionStatus||"A_EXAMINER")==="A_EXAMINER");
  const refusedProps=props.filter(x=>x.decisionStatus==="REFUSEE");
  if(prev.length) lines.push("Objectifs existants / à réévaluer :",...prev.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  lines.push("Objectifs validés :");
  if(val.length){
    lines.push(...val.map(x=>`• ${typeof x==='string'?x:x.formulation||""}`));
  }else{
    lines.push("• Aucun objectif validé à ce stade.");
  }
  if(pendingProps.length){
    lines.push("Propositions d’objectifs encore à examiner (non validées) :",...pendingProps.map(x=>`• ${x.formulation||""} [À examiner — non intégré aux objectifs validés]`));
  }
  if(refusedProps.length){
    lines.push("Propositions écartées / non retenues lors de l’examen :",...refusedProps.map(x=>`• ${x.formulation||""} [Refusée / non retenue]`));
  }
  lines.push("");
  lines.push("Ressources / moyens complémentaires et aménagements P/O/M");
  lines.push("Légende P/O/M : P = Pédagogique · O = Organisationnel · M = Matériel");
  lines.push(...(safeArray(d.amenagements).length?safeArray(d.amenagements).map(a=>`• ${formatAmenagementTypeLabel(a.type)} — ${a.texte||""}`):["• À compléter sur base des éléments effectivement documentés."]));
  lines.push("");
  appendMeetingText(lines,"Réunion de décembre",d.meeting1||{},false,deidentified);
  appendMeetingText(lines,"Réunion de fin d’année",d.meeting2||{},true,deidentified);
  return lines;
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
/**
 * Détermine la catégorie visuelle standardisée d'un aspect de développement.
 * @param {string} aspect
 * @returns {'cognitive'|'communication'|'affective'|'autonomy'|'physical'|'neutral'}
 */
function resolvePiaAspectCategory(aspect){
  const name=String(aspect||"").toLocaleLowerCase("fr");
  if(name.includes("cogn"))return "cognitive";
  if(name.includes("commun"))return "communication";
  if(name.includes("comport")||name.includes("affect"))return "affective";
  if(name.includes("autonom"))return "autonomy";
  if(name.includes("phys")||name.includes("psychom"))return "physical";
  return "neutral";
}

function piaDomainIcon(aspect,index){
  const category=resolvePiaAspectCategory(aspect);
  if(category==="cognitive")return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 13.5c6-2.3 12-.8 18 3.3v23c-6-4.1-12-5.6-18-3.3zM42 13.5c-6-2.3-12-.8-18 3.3v23c6-4.1 12-5.6 18-3.3z"/><path d="M11 20c3-.8 6-.3 9 1.2M11 26c3-.7 6-.2 9 1.2M37 20c-3-.8-6-.3-9 1.2M37 26c-3-.7-6-.2-9 1.2"/></svg>`;
  if(category==="communication")return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M7 10.5h24a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H19l-8 6v-6h-4a5 5 0 0 1-5-5v-11a5 5 0 0 1 5-5z"/><path d="M15 19h13M15 24h9"/><path d="M31 17h5a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-1v5l-7-5"/></svg>`;
  if(category==="affective")return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 39s-16-9.5-16-21a9 9 0 0 1 16-5.8A9 9 0 0 1 40 18c0 11.5-16 21-16 21z"/><path d="M16 23h.1M32 23h.1M19 29c1.4 1.6 3.1 2.4 5 2.4s3.6-.8 5-2.4"/></svg>`;
  if(category==="autonomy")return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="17"/><path d="m31 17-4.5 10.5L17 32l4.5-10.5z"/><circle cx="24" cy="24" r="2"/></svg>`;
  if(category==="physical")return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="29" cy="9" r="4"/><path d="m24 17 7 4 6-2M27 20l-6 9 8 4 5 9M21 29l-8 3-4 8M14 15l7 2 4-4"/><path d="m31 17 4 4"/></svg>`;
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
  return resolvePiaAspectCategory(aspect);
}
function piaDomainCard(pia,section,index){
  const objectives=piaDomainObjectives(pia,section);
  const field=([key,label])=>{
    const items=key==="objectifs"?objectives:safeArray(section[key]);
    const content=items.length?`<div class="v74-domain-value-list">${items.map(item=>`<span class="v74-domain-value">${esc(item)}</span>`).join("")}</div>`:'<p class="v74-domain-empty">Aucun élément renseigné.</p>';
    return `<details class="v74-domain-fieldset is-${key}"><summary>${label}<span>${items.length||""}</span></summary><div class="v74-domain-field-content">${content}<label class="v74-domain-field"><span>Modifier cette rubrique</span><textarea rows="2" data-v74-domain-index="${index}" data-v74-domain-field="${key}" aria-label="${label} — ${esc(section.aspect)}" placeholder="À compléter">${esc(items.join("\n"))}</textarea></label></div></details>`;
  };
  return `<div class="v74-domain-record" id="v74-domain-${index}">
    <header class="v74-domain-record-head tone-${piaDomainTone(section.aspect)}"><div><div class="page-kicker">Domaine PIA</div><h3>${esc(section.aspect||"Domaine")}</h3></div><span>${safeArray(section.difficultes).length} besoin(s) · ${objectives.length} objectif(s) · ${safeArray(section.moyens).length} moyen(s)</span></header>
    <div class="v74-domain-fields">${PIA_DOMAIN_FIELDS.map(field).join("")}</div>
  </div>`;
}
function piaMeetingEditor(pia,key,title,type){
  const meeting=pia[key]||{},participants=meeting.participants||{},feedback=meeting.feedback||{};
  const schoolYearBounds=piaSchoolYearBounds(Number(String(pia.schoolYear||"").slice(0,4)));
  const checkedActors=PIA_MEETING_ACTORS.filter(actor=>Boolean(participants[actor.id]));
  const participantSummary=checkedActors.length?`${checkedActors.length} participant(s) : ${checkedActors.slice(0,3).map(a=>a.label).join(", ")}${checkedActors.length>3?"…":""}`:"Aucun participant coché";
  const dateSummary=meeting.date?`Date : ${meeting.date}`:"Date non renseignée";
  const isDefaultOpen=(key==="meeting1"&&pia.lifecycle!=="EN_REEVALUATION")||(key==="meeting2"&&pia.lifecycle==="EN_REEVALUATION");
  const input=(field,label,value,kind="textarea")=>kind==="input"
    ? `<label class="v74-meeting-field"><span>${label}</span><input data-v74-meeting="${key}" data-v74-meeting-field="${field}" value="${esc(value||"")}" maxlength="4000"></label>`
    : `<label class="v74-meeting-field"><span>${label}</span><textarea rows="2" data-v74-meeting="${key}" data-v74-meeting-field="${field}" maxlength="8000">${esc(value||"")}</textarea></label>`;
  return `<details class="v74-meeting" ${isDefaultOpen?"open":""}>
    <summary>
      <div class="v74-meeting-summary-main">
        <strong>${title}</strong>
        <span class="v74-meeting-summary-meta">${esc(dateSummary)} · ${esc(participantSummary)}</span>
      </div>
      <span class="v74-meeting-status">${esc(meeting.status||"À préparer")}</span>
    </summary>
    <div class="v74-meeting-fields">
      <label class="v74-meeting-field"><span>Type</span><select data-v74-meeting="${key}" data-v74-meeting-field="type"><option value="${type}" selected>${title}</option></select></label>
      <label class="v74-meeting-field"><span>Date</span><input type="date" min="${schoolYearBounds.start}" max="${schoolYearBounds.end}" data-v74-meeting="${key}" data-v74-meeting-field="date" value="${esc(meeting.date||"")}"></label>
      ${input("context","Contexte",meeting.context)}
      <fieldset class="v74-participants"><legend>Participants présents ou associés</legend>${PIA_MEETING_ACTORS.map(actor=>`<label><input type="checkbox" data-v74-meeting="${key}" data-v74-participant="${actor.id}" ${participants[actor.id]?"checked":""}><span>${actor.label}</span></label>`).join("")}</fieldset>
      <div class="v74-feedback-grid"><div class="v74-meeting-subtitle">Retours des participants</div>${PIA_MEETING_ACTORS.map(actor=>input(`feedback.${actor.id}`,actor.label,feedback[actor.id])).join("")}</div>
      ${input("decisions","Décisions",meeting.decisions)}
      ${input("objectivesModified","Objectifs modifiés",meeting.objectivesModified)}
      ${input("means","Moyens",meeting.means)}
      ${input("adaptations","Adaptations P/O/M",meeting.adaptations)}
      ${input("information","Informations complémentaires",meeting.information)}
      ${input("notes","Notes",meeting.notes)}
      ${key==="meeting1"
        ? `<div class="v74-actions v74-meeting-export-bar" style="margin-top:14px;padding-top:12px;border-top:1px solid #dbe3ef;display:flex;gap:10px;flex-wrap:wrap;">
             <button type="button" class="v74-btn v74-btn-primary" id="v74-export-official-decembre" data-jr-handlers="h84" data-v74-export-official="DECEMBRE" title="Exporter la version de décembre en Word (.docx)">
               📄 Exporter en Word (.docx)
             </button>
             <button type="button" class="v74-btn v74-btn-neutral" id="v74-export-official-decembre-pdf" data-jr-handlers="h87" data-v74-export-official="DECEMBRE" data-v74-export-format="pdf" title="Exporter la version de décembre en PDF (.pdf)">
               📑 Exporter en PDF (.pdf)
             </button>
             <button type="button" class="v74-btn v74-btn-outline" id="v74-export-official-decembre-deid" data-jr-handlers="h89" data-v74-export-official="DECEMBRE" data-v74-export-deid="true" title="Exporter la version officielle de décembre dé-identifiée en Word (RGPD)">
               🛡️ Word dé-identifié
             </button>
             <button type="button" class="v74-btn v74-btn-outline" id="v74-export-official-decembre-pdf-deid" data-jr-handlers="h90" data-v74-export-official="DECEMBRE" data-v74-export-format="pdf" data-v74-export-deid="true" title="Exporter la version officielle de décembre dé-identifiée en PDF (RGPD)">
               🛡️ PDF dé-identifié
             </button>
           </div>`
        : (key==="meeting2"
          ? `<div class="v74-actions v74-meeting-export-bar" style="margin-top:14px;padding-top:12px;border-top:1px solid #dbe3ef;display:flex;gap:10px;flex-wrap:wrap;">
               <button type="button" class="v74-btn v74-btn-primary" id="v74-export-official-fin-annee" data-jr-handlers="h85" data-v74-export-official="FIN_ANNEE" title="Exporter la version de fin d'année en Word (.docx)">
                 📄 Exporter en Word (.docx)
               </button>
               <button type="button" class="v74-btn v74-btn-neutral" id="v74-export-official-fin-annee-pdf" data-jr-handlers="h88" data-v74-export-official="FIN_ANNEE" data-v74-export-format="pdf" title="Exporter la version de fin d'année en PDF (.pdf)">
                 📑 Exporter en PDF (.pdf)
               </button>
               <button type="button" class="v74-btn v74-btn-outline" id="v74-export-official-fin-annee-deid" data-jr-handlers="h91" data-v74-export-official="FIN_ANNEE" data-v74-export-deid="true" title="Exporter la version officielle de fin d'année dé-identifiée en Word (RGPD)">
                 🛡️ Word dé-identifié
               </button>
               <button type="button" class="v74-btn v74-btn-outline" id="v74-export-official-fin-annee-pdf-deid" data-jr-handlers="h92" data-v74-export-official="FIN_ANNEE" data-v74-export-format="pdf" data-v74-export-deid="true" title="Exporter la version officielle de fin d'année dé-identifiée en PDF (RGPD)">
                 🛡️ PDF dé-identifié
               </button>
             </div>`
          : "")
      }
    </div>
  </details>`;
}
function piaAnnualTracking(pia){
  const validated=safeArray(pia.meeting1?.objectivesValidated);
  const evaluation=safeArray(pia.meeting2?.evaluation);
  const continued=safeArray(pia.meeting2?.objectivesToContinue);
  const amenagements=safeArray(pia.amenagements);
  const counts=getPIADecisionCounts(pia);
  const m1Status=formatMeetingStatusLabel(pia.meeting1?.status);
  const m2Status=formatMeetingStatusLabel(pia.meeting2?.status);

  const list=(items,empty)=>items.length
    ? `<ul class="v74-tracking-list">${items.map(item=>`<li>${esc(typeof item==="string"?item:item.formulation||item.objectif||"")}</li>`).join("")}</ul>`
    : `<p class="v74-domain-empty">${empty}</p>`;

  const evalCards=evaluation.length
    ? `<div class="v74-eval-grid">${evaluation.map(item=>{
        const evCount=safeArray(item.evidence).length;
        const badge=item.state==="A_DISCUSSER"?"À discuter en équipe":(item.state||"À évaluer");
        return `<article class="v74-eval-card">
          <div class="v74-eval-card-top">
            <strong>${esc(item.objectif||"Objectif")}</strong>
            <span class="v74-prop-state is-pending">${esc(badge)}</span>
          </div>
          <p>${esc(item.note||"Évaluation à confirmer en réunion 2.")}</p>
          <div class="v74-prop-meta">
            <span>${evCount} séance(s) post-réunion 1</span>
            ${item.themeId?`<span>Axe : ${esc(item.themeId)}</span>`:""}
          </div>
        </article>`;
      }).join("")}</div>`
    : `<p class="v74-domain-empty">La réévaluation de fin d’année n’a pas encore été préparée.</p>`;

  const pomCards=amenagements.length
    ? `<div class="v74-pom-grid">${amenagements.map(a=>`<article class="v74-pom-card is-type-${esc(String(a.type||"P").toLowerCase())}">
        <div class="v74-pom-head">
          <span class="v74-pom-badge">${esc(a.type||"P")}</span>
          <strong>${esc(formatAmenagementTypeLabel(a.type))}</strong>
        </div>
        <p class="v74-pom-text">${esc(a.texte||"")}</p>
        ${a.effetDocumente?`<div class="v74-pom-meta"><b>Effet observé (Q4) :</b> ${esc(a.effetDocumente)}</div>`:""}
        ${a.suitePrevue?`<div class="v74-pom-meta"><b>Suite prévue (Q6) :</b> ${esc(a.suitePrevue)}</div>`:""}
      </article>`).join("")}</div>`
    : `<p class="v74-domain-empty">Aucun aménagement P/O/M synthétisé à ce stade.</p>`;

  return `<section class="v74-annual-tracking">
    <div class="v74-tracking-timeline">
      <div class="v74-timeline-step is-done">
        <span class="v74-timeline-dot">1</span>
        <div>
          <strong>Collecte & analyse Q2–Q6</strong>
          <span>${Number(pia.sessionsAnalysed||0)} séance(s) · ${counts.total} proposition(s)</span>
        </div>
      </div>
      <div class="v74-timeline-step ${["EN_VIGUEUR","ACTIF","EN_REEVALUATION","FINALISE"].includes(pia.lifecycle)?"is-done":"is-current"}">
        <span class="v74-timeline-dot">2</span>
        <div>
          <strong>Réunion 1 (Décembre)</strong>
          <span>${esc(m1Status)}${pia.meeting1?.date?` · ${esc(pia.meeting1.date)}`:""}</span>
        </div>
      </div>
      <div class="v74-timeline-step ${["EN_REEVALUATION","FINALISE"].includes(pia.lifecycle)||pia.meeting2?.status==="REEVALUATION_VALIDEE"?"is-done":""}">
        <span class="v74-timeline-dot">3</span>
        <div>
          <strong>Réunion 2 (Fin d’année)</strong>
          <span>${esc(m2Status)}${pia.meeting2?.date?` · ${esc(pia.meeting2.date)}`:""}</span>
        </div>
      </div>
    </div>

    <div class="v74-tracking-columns">
      <div class="v74-tracking-card">
        <h4>Objectifs validés en vigueur (${validated.length})</h4>
        ${list(validated,"Aucun objectif validé à ce stade.")}
      </div>
      <div class="v74-tracking-card">
        <h4>Objectifs reconduits / maintenus (${continued.length})</h4>
        ${list(continued,"Aucun objectif reconduit spécifié à ce stade.")}
      </div>
    </div>

    <div class="v74-tracking-block">
      <h4>Aménagements raisonnables P/O/M documentés (${amenagements.length})</h4>
      ${pomCards}
    </div>

    <div class="v74-tracking-block">
      <h4>Bilan d’évaluation des objectifs (Réunion 2)</h4>
      ${evalCards}
    </div>
  </section>`;
}

function piaDocumentPreviewHtml(pia){
  const model=buildPIADocumentModel(pia,false);
  const renderBlock=block=>{
    if(block.type==="header_banner"){
      return `<header class="v74-doc-banner">
        <div class="v74-doc-banner-top">
          <div>
            <div class="v74-doc-kicker">${esc(block.kicker||"")}</div>
            <h3 class="v74-doc-title">${esc(block.title||"")}</h3>
            <p class="v74-doc-subtitle">${esc(block.subtitle||"")}</p>
          </div>
          <span class="v74-status-badge is-${esc(block.statusTone||"warning")}">${esc(block.statusBadge||"")}</span>
        </div>
        ${safeArray(block.metaRows).length?`<div class="v74-doc-meta-grid">${block.metaRows.map(r=>`<div class="v74-doc-meta-pair"><span>${esc(r[0]||"")}</span><strong>${esc(r[1]||"")}</strong></div><div class="v74-doc-meta-pair"><span>${esc(r[2]||"")}</span><strong>${esc(r[3]||"")}</strong></div>`).join("")}</div>`:""}
      </header>`;
    }
    if(block.type==="callout"){
      return `<div class="v74-doc-callout is-${esc(block.tone||"neutral")}">
        ${block.title?`<strong>${esc(block.title)}</strong>`:""}
        ${safeArray(block.lines).map(l=>`<p>${esc(l)}</p>`).join("")}
      </div>`;
    }
    if(block.type==="kpi_grid"){
      return `<div class="v74-doc-kpis">${safeArray(block.items).map(it=>`<div class="v74-doc-kpi"><span>${esc(it.label||"")}</span><strong>${esc(it.value||"0")}</strong><small>${esc(it.sub||"")}</small></div>`).join("")}</div>`;
    }
    if(block.type==="section_title"){
      return `<h4 class="v74-doc-section-title">${block.number?`<span class="v74-doc-sec-num">${esc(block.number)}</span>`:""}${esc(block.title||"")}</h4>`;
    }
    if(block.type==="table"){
      const headers=safeArray(block.headers);
      const rows=safeArray(block.rows);
      return `<div class="v74-doc-table-wrap">
        ${block.title?`<div class="v74-doc-table-title">${esc(block.title)}</div>`:""}
        <table class="v74-doc-table">
          ${headers.length?`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>`:""}
          <tbody>
            ${rows.map(row=>`<tr>${safeArray(row).map((cell,colIdx)=>{
              const isArrayCell=cell&&typeof cell==="object"&&typeof cell.length==="number";
              const items=isArrayCell?safeArray(cell).filter(Boolean):[String(cell??"")];
              const content=items.length>1
                ? `<ul class="v74-doc-cell-list">${items.map(it=>`<li>${esc(it)}</li>`).join("")}</ul>`
                : esc(items[0]||"");
              return `<td class="${colIdx===0?"is-first-col":""}">${content}</td>`;
            }).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    }
    return "";
  };
  return `<div class="v74-doc-sheet">${safeArray(model.blocks).map(renderBlock).join("")}</div>`;
}
async function persistPIAEdit(pia,persistDraft=false){
  if(pia.lifecycle==="EN_CONSTRUCTION"&&!persistDraft&&!V74.ui.piaDraftPersisted)return;
  if(pia.lifecycle==="EN_CONSTRUCTION")V74.ui.piaDraftPersisted=true;
  await savePia(pia,pia.lifecycle!=="EN_CONSTRUCTION",false);
}
function matchesProposalObjective(item,proposal){
  if(!item||!proposal)return false;
  if(typeof item==="string")return item===proposal.id||item===proposal.formulation;
  return (proposal.id&&item.id===proposal.id)||(proposal.themeId&&item.themeId===proposal.themeId);
}
function syncValidatedObjectivesFromProposals(pia){
  if(!pia||!pia.meeting1)return;
  const existing=safeArray(pia.meeting1.objectivesValidated);
  const proposals=safeArray(pia.propositions);
  // Conserver les objectifs qui ne proviennent pas d'une proposition refusée ou remise à examiner
  const filtered=existing.filter(item=>{
    const linked=proposals.find(p=>matchesProposalObjective(item,p));
    if(!linked)return true;
    return linked.decisionStatus==="VALIDEE";
  });
  // Ajouter ou mettre à jour chaque proposition VALIDEE sans doublon
  proposals.forEach(proposal=>{
    if(proposal.decisionStatus!=="VALIDEE")return;
    const formulation=String(proposal.formulation||"").trim();
    if(!formulation)return;
    const idx=filtered.findIndex(item=>matchesProposalObjective(item,proposal));
    const entry={
      id:proposal.id,
      themeId:proposal.themeId,
      theme:proposal.theme,
      aspect:proposal.aspect,
      formulation,
      status:"VALIDEE",
      source:"REUNION",
      validatedAt:(idx>=0&&typeof filtered[idx]==="object"&&filtered[idx].validatedAt)||proposal.decidedAt||new Date().toISOString()
    };
    if(idx>=0)filtered[idx]=entry;
    else filtered.push(entry);
  });
  pia.meeting1.objectivesValidated=filtered;
  if(pia.meeting2&&(pia.lifecycle==="EN_REEVALUATION"||["EN_REEVALUATION","REEVALUATION_VALIDEE"].includes(pia.meeting2.status))){
    pia.meeting2.objectivesToContinue=filtered;
    pia.meeting2.evaluation=evaluateMeeting2(pia,pia);
  }
}
function decidePIAProposal(pia,index,decision){
  const proposal=pia?.propositions?.[index];
  if(!proposal||!['A_EXAMINER','VALIDEE','REFUSEE'].includes(decision))return false;
  if(decision==="VALIDEE"){
    const field=typeof document!=="undefined"?document.querySelector(`[data-v74-prop-formulation="${index}"]`):null;
    const formulation=String(field?.value??proposal.formulation??"").trim();
    if(!formulation)return false;
    proposal.formulation=formulation;
    proposal.decisionStatus="VALIDEE";
    proposal.decidedAt=new Date().toISOString();
    syncValidatedObjectivesFromProposals(pia);
    return true;
  }
  if(decision==="REFUSEE"){
    proposal.decisionStatus="REFUSEE";
    proposal.decidedAt=new Date().toISOString();
    syncValidatedObjectivesFromProposals(pia);
    return true;
  }
  // Retour à A_EXAMINER
  proposal.decisionStatus="A_EXAMINER";
  delete proposal.decidedAt;
  syncValidatedObjectivesFromProposals(pia);
  return true;
}
function getPIADecisionCounts(pia){
  const proposals=safeArray(pia?.propositions);
  return {
    total:proposals.length,
    pending:proposals.filter(p=>(p.decisionStatus||"A_EXAMINER")==="A_EXAMINER").length,
    validated:proposals.filter(p=>p.decisionStatus==="VALIDEE").length,
    refused:proposals.filter(p=>p.decisionStatus==="REFUSEE").length
  };
}
function buildPIAActivationConfirmationMessage(pia){
  const counts=getPIADecisionCounts(pia);
  const isReevaluation=pia?.lifecycle==="EN_REEVALUATION"||pia?.meeting2?.status==="EN_REEVALUATION";
  const lines=[
    isReevaluation?"Confirmer la réévaluation et maintenir en vigueur ce PIA annuel ?":"Mettre en vigueur ce PIA annuel ?",
    "",
    "Récapitulatif des propositions :",
    `• ${counts.validated} proposition(s) validée(s) (VALIDÉE)`,
    `• ${counts.refused} proposition(s) refusée(s) (REFUSÉE)`,
    `• ${counts.pending} proposition(s) encore « À examiner » (A_EXAMINER)`
  ];
  if(counts.pending>0){
    lines.push(
      "",
      `Attention : ${counts.pending} proposition(s) ont encore le statut « À examiner ».`,
      "Elles ne seront PAS intégrées aux objectifs validés du PIA en vigueur tant qu’elles ne sont pas explicitement validées."
    );
  }
  lines.push(
    "",
    "Le statut du dossier passera à « PIA annuel en vigueur ».",
    isReevaluation?"Confirmez-vous la validation officielle de la réévaluation du PIA annuel ?":"Confirmez-vous la mise en vigueur officielle du PIA annuel ?"
  );
  return lines.join("\n");
}
function activatePIA(pia){
  if(!pia)return false;
  const wasReevaluation=pia.lifecycle==="EN_REEVALUATION"||pia.meeting2?.status==="EN_REEVALUATION";
  syncValidatedObjectivesFromProposals(pia);
  const validatedCount=safeArray(pia.meeting1?.objectivesValidated).length;
  const domainObjectivesCount=safeArray(pia.sections).reduce((acc,sec)=>acc+safeArray(sec?.objectifs).length,0);
  if(validatedCount===0&&domainObjectivesCount===0)return false;
  const now=new Date().toISOString();
  pia.lifecycle="EN_VIGUEUR";
  pia.meeting1??={};
  pia.meeting1.status="VALIDÉE";
  if(!pia.meeting1.validatedAt){
    pia.meeting1.validatedAt=now;
  }
  if(wasReevaluation){
    pia.meeting2??={};
    pia.meeting2.status="REEVALUATION_VALIDEE";
    pia.meeting2.validatedAt=now;
    pia.meeting2.objectivesToContinue=safeArray(pia.meeting1.objectivesValidated);
    pia.meeting2.evaluation=evaluateMeeting2(pia,pia);
  }
  return true;
}



// Global & Module Export Bridge
const _lifecycleEngineExport = {
  V74,
  THEMES,
  DEFAULT_CONVERGENCE_THRESHOLDS,
  PROPOSAL_TEMPLATES,
  PIA_CANONICAL_ASPECTS,
  PIA_AMENAGEMENT_TYPE_LABELS,
  PIA_MEETING_STATUS_LABELS,
  esc,
  uid,
  norm,
  dateOnly,
  safeArray,
  getData,
  studentSessions,
  cleanWbeRawToken,
  canonicalizeWbeChapter,
  formatWbeCourseHeader,
  summarizeWbeByCourse,
  resolveSessionWBERepere,
  extractSessionQ4Items,
  parsePiaQ2Level,
  q5Positive,
  q5Help,
  sessionText,
  recurrenceMarker,
  extractUnits,
  getConvergenceConfig,
  summarizeGroupContext,
  compareUnits,
  formatContextualClause,
  proposalText,
  cleanObjectiveFormulationText,
  parsePreviousObjectives,
  piaMeetingRecord,
  continuityFromExisting,
  piaSchoolYearBounds,
  piaSchoolYear,
  currentPIASchoolYearBounds,
  applySchoolYearDateLimits,
  normalizePIALifecycle,
  cleanQ3IndText,
  isAdaptationRelevantToAspect,
  cleanAdaptationLabelForDomain,
  cleanStrengthItemLabel,
  toInfinitiveV74,
  semanticSkillKeyV74,
  pickPreferredSkillLabelV74,
  formatHumanDateShortV74,
  buildContextTreeFromUnitsV74,
  formatConciseObjectiveForAspect,
  defaultMeansForAspect,
  formatGroupResourceEntry,
  formatGroupFunctionalEntry,
  formatGroupDifficultyEntry,
  deduplicateDomainStrengthsV74,
  deduplicateDomainDifficultiesV74,
  buildProposalContextTreeV74,
  groupOccurrencesBySubjectAndChapterV74,
  formatGroupEvolutionEntry,
  proposalSemanticClusterKey,
  buildPIA,
  evaluateMeeting2,
  formatMeetingStatusLabel,
  formatAmenagementTypeLabel,
  redactPIAValue,
  piaForExport,
  appendMeetingText,
  piaTextSections,
  piaStatusLabel,
  piaMeetingEditor,
  syncValidatedObjectivesFromProposals,
  matchesProposalObjective,
  decidePIAProposal,
  getPIADecisionCounts,
  buildPIAActivationConfirmationMessage,
  activatePIA,
  formatPiaQ3Appreciation,
  formatPiaQ5Status,
  formatPiaQ4Effect,
  formatPiaQ2LevelLabel
};

if (typeof window !== 'undefined') {
  window.JournalierPIALifecycleEngine = _lifecycleEngineExport;
}
if (typeof globalThis !== 'undefined') {
  globalThis.JournalierPIALifecycleEngine = _lifecycleEngineExport;
}

// Marker for tests compatibility
function setPIASection(box,name){
  if (typeof window !== 'undefined' && typeof window.setPIASection === 'function') {
    return window.setPIASection(box, name);
  }
}
