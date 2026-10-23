/* Journalier V74 — moteur PIA annuel opérationnel
 * Local-first : aucune donnée n'est envoyée par ce module.
 * Les propositions restent des propositions : la validation est une action du professionnel.
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
  const ds = (typeof window !== "undefined" && window.JournalierDataStore) || (typeof DataStore !== "undefined" ? DataStore : null);
  if(!ds?.isReady?.()) throw new Error("Connectez-vous à Microsoft avant d'utiliser le PIA V74.");
  return {students:ds.getStudents?.()||[], sessions:ds.getSessions?.()||[], state:ds.getState?.()||{}};
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
  // Les règles de chapitres mathématiques ne s'appliquent jamais à une autre matière.
  const subjectNorm=norm(matiere);
  const isExplicitNonMath=Boolean(subjectNorm)&&!/(^|\b)(math|mathematique|mathematiques|maths)(\b|$)/.test(subjectNorm);
  if(!isExplicitNonMath){
    if(/\b(puissance|exposant|quotient de puissance|produit de puissance|proprietes des puissances)\b/.test(probe))return "Propriétés des puissances";
    if(/\b(priorites? operatoires?|pemdas|ordre des operations|operations? sur (?:les )?entiers|nombres? entiers|regles? des signes)\b/.test(probe))return "Priorités opératoires";
    if(/\b(equations? du premier degre|equations? a une inconnue|resoudre une equation|resolution d'equation|equations?)\b/.test(probe))return "Équations du premier degré";
    if(/\b(fonctions? du premier degre|fonctions? affines?|fonctions? lineaires?|fonctions?)\b/.test(probe))return "Fonctions du premier degré";
    if(/\b(fractions? equivalentes?|fractions?|numerateur|denominateur)\b/.test(probe))return cleaned&&/fraction/i.test(cleaned)?cleaned.charAt(0).toUpperCase()+cleaned.slice(1):"Fractions";
    if(/\b(calcul litteral|termes semblables|polynome|factorisation|developpement)\b/.test(probe))return "Calcul littéral";
    if(/\b(proportionnalite|echelle|pourcentage|regle de trois)\b/.test(probe))return "Proportionnalité";
    if(/\b(pythagore|triangle|angle|geometrie|quadrilatere|perimetre|aire|figure)\b/.test(probe))return "Géométrie et figures planes";
    if(/\b(probleme|problemes)\b/.test(probe)&&!/equation|puissance|priorite/.test(probe))return "Résolution de problèmes";
  }
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
    const subj=String(item.matiere||"Matière non précisée").trim()||"Matière non précisée";
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
  // Les critères doivent provenir des preuves de leur propre séance/matière/chapitre.
  // Les critères agrégés ne sont réutilisés qu'en repli lorsqu'un seul chapitre existe.
  safeArray(p?.evidence).forEach(item=>{
    const subj=String(item.matiere||"Matière non précisée").trim()||"Matière non précisée";
    const chap=item.chapter||canonicalizeWbeChapter(item.wbeRepere||"",item.objectif||"",subj)||item.objectif||"Séance observée";
    const sg=bySubj.get(norm(subj));
    const cg=sg?.chapters.get(norm(chap));
    if(!cg)return;
    safeArray(item.q3Indicators||item.criteresObservable).forEach(raw=>{
      const sk=toInfinitiveV74(String(raw||"").trim()).replace(/\.$/,"");
      if(!sk)return;
      const k=semanticSkillKeyV74(sk);
      if(!cg.skills.has(k))cg.skills.set(k,sk);
      else cg.skills.set(k,pickPreferredSkillLabelV74(cg.skills.get(k),sk));
    });
  });
  const chapterCount=[...bySubj.values()].reduce((total,sg)=>total+sg.chapters.size,0);
  if(chapterCount===1){
    const skillsList=safeArray(p?.criteresObservable).filter(c=>!String(c).startsWith("Chapitre : ")).map(c=>toInfinitiveV74(String(c||"").trim()).replace(/\.$/,"")).filter(Boolean);
    if(!skillsList.length&&p?.constatContextualise){
      const rawC=String(p.constatContextualise);
      const sk=rawC.includes(" : ")?rawC.split(" : ").slice(1).join(" : ").replace(/\s*\([^)]*\)\s*$/," ").trim():rawC.replace(/\s*\([^)]*\)\s*$/," ").trim();
      if(sk)skillsList.push(sk);
    }
    const onlySubject=[...bySubj.values()][0];
    const onlyChapter=[...onlySubject.chapters.values()][0];
    skillsList.forEach(sk=>{
      const k=semanticSkillKeyV74(sk);
      if(!onlyChapter.skills.has(k))onlyChapter.skills.set(k,sk);
      else onlyChapter.skills.set(k,pickPreferredSkillLabelV74(onlyChapter.skills.get(k),sk));
    });
  }
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
    const subj=String(occ.matiere||"Matière non précisée").trim()||"Matière non précisée";
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
      evidence:g.units.map(u=>({sessionId:u.sessionId,date:u.date,matiere:u.matiere,objectif:u.objectifLecon,wbeRepere:u.q3WbeRepere,q3Indicators:safeArray(u.q3Indicators),chapter:canonicalizeWbeChapter(u.q3WbeRepere||"",u.objectifLecon||"",u.matiere||"")||u.objectifLecon||""})),
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
  const amenagements=[...activeBuckets].map((code, idx)=>{
    const b=amenagementBuckets[code];
    const detailStr=[...b.details].slice(0,3).join(", ");
    const effectStr=[...b.effects].slice(0,2).join(" ; ")||"À observer lors des prochaines séances.";
    const suiteStr=[...b.suites].slice(0,2).join(" · ")||"À confirmer en équipe.";
    const descText=detailStr?`${b.base} (${detailStr})` : b.base;
    return {
      id: `amenagement_${idx + 1}`,
      n: idx + 1,
      labelN: `${idx + 1}\u00A0`,
      p: code === "P",
      o: code === "O",
      m: code === "M",
      description: descText,
      type:code,
      texte:descText,
      effetDocumente:effectStr,
      suitePrevue:suiteStr,
      state:"PROPOSITION",
      evidenceCount:logs.length
    };
  });
  const previousObjectives=parsePreviousObjectives(student,existing);
  const preservedAmenagements = Array.isArray(existing?.amenagements) && existing.amenagements.length
    ? existing.amenagements.map((item, i) => normalizeStructuredAmenagement(item, i))
    : amenagements;
  const adminInfo = student?.administrativeInfo || {
    nom: student?.nom || "",
    dateNaissance: student?.dateNaissance || "",
    classe: student?.classe || "",
    option: student?.option || "",
    ecole: student?.ecole || "",
    coordonneesEcole: student?.coordonneesEcole || "",
    titulaire: student?.titulaire || "",
    coordonneesCpms: student?.coordonneesCpms || "",
    representantPole: student?.representantPole || "Pôle Territorial WBE BXL",
    responsable: student?.responsable || "",
    coordonneesResponsable: student?.coordonneesResponsable || ""
  };
  return {
    schemaVersion:"73.0.0",type:"PIA_ANNUEL",id:existing?.id||uid("pia"),studentId:student.studentId,
    eleve:student.nom,classe:student.classe||"",ecole:student.ecole||"",
    administrativeInfo: adminInfo,
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
    meeting2:{
      ...piaMeetingRecord(existing?.meeting2,"REUNION_2_FIN_ANNEE","A_VENIR"),
      evaluation:safeArray(existing?.meeting2?.evaluation),
      objectivesToContinue:safeArray(existing?.meeting2?.objectivesToContinue),
      amenagementsRentree: Array.isArray(existing?.meeting2?.amenagementsRentree) && existing.meeting2.amenagementsRentree.length
        ? existing.meeting2.amenagementsRentree.map((item, i) => normalizeStructuredAmenagement(item, i))
        : safeArray(existing?.meeting2?.amenagementsRentree),
      perspectives:safeArray(existing?.meeting2?.perspectives)
    },
    amenagements: preservedAmenagements,propositions:proposals,
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

const PIA_DEIDENTIFIED_DROP_KEYS=new Set([
  "id","studentid","sessionid","sessionids","ownerid","eleve","ecole","classe","schoolyear",
  "generatedat","updatedat","createdat","importedat","validatedat","finalizedat","date","dates","until",
  "filename","displayname","sourcecontinuity","evidence","feedback","notes","context","information","decisions","objectivesmodified",
  "datenaissance","coordonneesecole","option","titulaire","coordonneescpms","representantpole","responsable","coordonneesresponsable",
  "personnespresentes","administrativeinfo","studentadministrativeinfo","t1identite"
]);
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
  let student = null;
  if (typeof getData === "function" && pia?.studentId) {
    try {
      const db = getData();
      student = db.students?.find(s => String(s.studentId) === String(pia.studentId) || String(s.id) === String(pia.studentId));
    } catch (_) {}
  }
  const adminInfo = pia?.administrativeInfo || pia?.studentAdministrativeInfo || student?.administrativeInfo || student || {};
  const identifiers=[
    pia?.eleve,pia?.ecole,pia?.classe,pia?.studentId,pia?.id,
    student?.nom,student?.ecole,student?.classe,
    adminInfo?.nom,adminInfo?.titulaire,adminInfo?.responsable,adminInfo?.representantPole,
    adminInfo?.ecole,adminInfo?.coordonneesEcole,adminInfo?.coordonneesCpms,adminInfo?.coordonneesResponsable,
    ...safeArray(pia?.traceability?.sessionIds)
  ].map(x=>String(x||"").trim()).filter(x=>x.length>=2).sort((a,b)=>b.length-a.length);
  d.type="PIA_MODELE_DEIDENTIFIE";
  delete d.administrativeInfo;
  delete d.studentAdministrativeInfo;
  return redactPIAValue(d,identifiers);
}
function appendMeetingText(lines,title,meeting,isMeeting2=false,deidentified=false,parentPia=null){
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
    if (key === "adaptations") {
      const list = isMeeting2
        ? safeArray(meeting?.amenagementsRentree || parentPia?.meeting2?.amenagementsRentree)
        : safeArray(meeting?.amenagements || parentPia?.amenagements);
      const valid = filterValidStructuredAmenagements(list);
      if (valid.length) {
        lines.push(`${label} :`);
        valid.forEach((item, idx) => {
          const codes = [item.p ? "P" : "", item.o ? "O" : "", item.m ? "M" : ""].filter(Boolean);
          const prefix = codes.length ? `[${codes.join("+")}] ` : "";
          lines.push(`  • ${idx + 1}. ${prefix}${item.description || item.texte || ""}`);
        });
      } else {
        const val = meeting?.[key];
        lines.push(`${label} : ${val || (deidentified ? "[retiré de l’export dé-identifié]" : "À compléter.")}`);
      }
    } else {
      const val=meeting?.[key];
      lines.push(`${label} : ${val||(deidentified&&["decisions","objectivesModified","information","notes"].includes(key)?"[retiré de l’export dé-identifié]":"À compléter.")}`);
    }
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
  appendMeetingText(lines,"Réunion de décembre",d.meeting1||{},false,deidentified,d);
  appendMeetingText(lines,"Réunion de fin d’année",d.meeting2||{},true,deidentified,d);
  return lines;
}
// eslint-disable-next-line no-control-regex -- Élimination des contrôles illégaux en XML 1.0 dans le repli xmlEsc
function xmlEsc(s){if(typeof globalThis!=='undefined'&&typeof globalThis.escapeXml==='function'&&globalThis.escapeXml!==xmlEsc){return globalThis.escapeXml(s);}return String(s??"").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function crc32(bytes){let table=crc32._table;if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}crc32._table=table;}let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function u16(v){return [v&255,(v>>>8)&255];}
function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function concatBytes(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function getJournalierDocx() {
  if (typeof globalThis !== "undefined" && globalThis.JournalierDocx) return globalThis.JournalierDocx;
  if (typeof JournalierDocx !== "undefined") return JournalierDocx;
  return null;
}

var MAX_PIA_FILE_BYTES=20*1024*1024, MAX_PIA_TEXT_BYTES=8*1024*1024, MAX_PIA_ZIP_ENTRIES=200;
function zipStore(files){
  const mod = getJournalierDocx();
  return mod ? mod.buildZipStoreArchive(files) : new Uint8Array();
}
var DOC_H1_SET=new Set([
  "Continuité avec le PIA précédent",
  "Physique et psychomoteur",
  "Lié à l’autonomie",
  "Comportemental et affectif",
  "Communication",
  "Cognitif (pédagogique)",
  "Objectifs visés pour la période et critères d’évaluation",
  "Ressources / moyens complémentaires et aménagements P/O/M",
  "Réunion de décembre",
  "Réunion de fin d’année",
  "Points récurrents",
  "Points variables",
  "Adaptations",
  "Transfert",
  "Suites Q6",
  "Points à discuter"
]);
var DOC_H2_SET=new Set([
  "Ressources",
  "Difficultés",
  "Objectifs à poursuivre",
  "Critères d’évaluation",
  "Moyens / adaptations",
  "Évolution documentée",
  "Objectifs existants / à réévaluer :",
  "Objectifs validés :",
  "Propositions d’objectifs encore à examiner (non validées) :",
  "Propositions écartées / non retenues lors de l’examen :",
  "Participants :",
  "Retours des participants :",
  "Bilan d’évaluation des objectifs :",
  "Objectifs maintenus / reconduits :",
  "Perspectives pour la suite :"
]);
function buildPIAIdentityObject(studentOrPia, deidentified = false) {
  if (deidentified) {
    return {
      nom: "",
      eleve: "[ÉLÈVE]",
      dateNaissance: "[DATE RETIRÉE]",
      coordonneesEcole: "[ÉCOLE RETIRÉE]",
      classeEtOption: "",
      classeOption: "[NIVEAU RETENU]",
      titulaire: "[TITULAIRE RETIRÉ]",
      coordonneesCpms: "[CPMS RETIRÉ]",
      representantPole: "Pôle Territorial WBE BXL",
      coordonneesResponsable: "[COORDONNÉES RETIRÉES]"
    };
  }
  let student = studentOrPia?.student || null;
  if (!student && typeof getData === "function" && studentOrPia?.studentId) {
    try {
      const d = getData();
      student = d.students?.find(s => String(s.studentId) === String(studentOrPia.studentId) || String(s.id) === String(studentOrPia.studentId));
    } catch (_) {}
  }
  const info = studentOrPia?.identity || studentOrPia?.administrativeInfo || studentOrPia?.studentAdministrativeInfo || student?.administrativeInfo || student || studentOrPia || {};
  const eleve = String(info.nom || studentOrPia?.identity?.nom || studentOrPia?.eleve || student?.nom || "").trim();
  const dateN = String(info.dateNaissance || studentOrPia?.identity?.dateNaissance || student?.dateNaissance || "").trim();
  const ecole = String(info.ecole || studentOrPia?.identity?.ecole || studentOrPia?.ecole || student?.ecole || "").trim();
  const coordsEcole = String(info.coordonneesEcole || studentOrPia?.identity?.coordonneesEcole || student?.coordonneesEcole || "").trim();
  const fullEcole = ecole && coordsEcole && ecole !== coordsEcole ? `${ecole} — ${coordsEcole}` : (ecole || coordsEcole);
  const classe = String(info.classe || studentOrPia?.identity?.classe || studentOrPia?.classe || student?.classe || "").trim();
  const opt = String(info.option || studentOrPia?.identity?.option || student?.option || "").trim();
  const classeOption = classe && opt && classe !== opt ? `${classe} — ${opt}` : (classe || info.classeEtOption || studentOrPia?.identity?.classeEtOption || "");
  const titulaire = String(info.titulaire || studentOrPia?.identity?.titulaire || student?.titulaire || "").trim();
  const cpms = String(info.coordonneesCpms || studentOrPia?.identity?.coordonneesCpms || student?.coordonneesCpms || info.cpms || student?.cpms || "").trim();
  const pole = String(info.representantPole || studentOrPia?.identity?.representantPole || student?.representantPole || "Pôle Territorial WBE BXL").trim();
  const resp = String(info.responsable || studentOrPia?.identity?.responsable || student?.responsable || "").trim();
  const coordsResp = String(info.coordonneesResponsable || studentOrPia?.identity?.coordonneesResponsable || student?.coordonneesResponsable || "").trim();
  const fullResp = resp && coordsResp && resp !== coordsResp ? `${resp} — ${coordsResp}` : (resp || coordsResp);

  return {
    nom: eleve,
    eleve,
    dateNaissance: dateN,
    coordonneesEcole: fullEcole,
    classeEtOption: classeOption,
    classeOption,
    titulaire,
    coordonneesCpms: cpms,
    representantPole: pole,
    coordonneesResponsable: fullResp
  };
}

function normalizeStructuredAmenagement(item, index = 0) {
  if (!item) {
    return {
      id: `amenagement_${index + 1}`,
      n: index + 1,
      labelN: `${index + 1}\u00A0`,
      p: false,
      o: false,
      m: false,
      description: "",
      texte: "",
      type: "",
      referentielId: null
    };
  }
  if (typeof item === "string") {
    const trimmed = item.trim();
    return {
      id: `amenagement_${index + 1}`,
      n: index + 1,
      labelN: `${index + 1}\u00A0`,
      p: false,
      o: false,
      m: false,
      description: trimmed,
      texte: trimmed,
      type: "",
      referentielId: null
    };
  }
  const typeCode = String(item.type || item.category || "").trim().toUpperCase();
  const typeParts = typeCode.split(/[^A-Z]+/).filter(Boolean);
  const p = Boolean(item.p || typeCode === "P" || typeParts.includes("P") || typeCode.includes("PEDAGOGIQUE"));
  const o = Boolean(item.o || typeCode === "O" || typeParts.includes("O") || typeCode.includes("ORGANISATIONNEL"));
  const m = Boolean(item.m || typeCode === "M" || typeParts.includes("M") || typeCode.includes("MATERIEL"));
  const desc = String(item.description || item.texte || "").trim();
  const activeTypes = [];
  if (p) activeTypes.push("P");
  if (o) activeTypes.push("O");
  if (m) activeTypes.push("M");
  return {
    id: item.id || `amenagement_${index + 1}`,
    n: index + 1,
    labelN: `${index + 1}\u00A0`,
    p,
    o,
    m,
    description: desc,
    texte: desc,
    type: activeTypes.join("+") || (p ? "P" : (o ? "O" : (m ? "M" : ""))),
    effetDocumente: item.effetDocumente || "",
    suitePrevue: item.suitePrevue || "",
    referentielId: item.referentielId || item.refId || null
  };
}

function filterValidStructuredAmenagements(list) {
  return safeArray(list).filter(item => {
    if (!item) return false;
    const desc = String(item.description || item.texte || "").trim();
    const hasType = Boolean(item.p || item.o || item.m);
    return Boolean(hasType || desc);
  });
}

function formatStructuredAmenagementsSummary(list) {
  const valid = filterValidStructuredAmenagements(list);
  if (!valid.length) return "";
  return valid.map((item, idx) => {
    const codes = [item.p ? "P" : "", item.o ? "O" : "", item.m ? "M" : ""].filter(Boolean);
    const prefix = codes.length ? `[${codes.join("+")}] ` : "";
    const desc = String(item.description || item.texte || "").trim();
    return `${idx + 1}. ${prefix}${desc}`;
  }).join("\n");
}

function normalizeAmenagementsList(list, minCount = 10) {
  const items = safeArray(list);
  const count = Math.max(minCount, items.length);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(normalizeStructuredAmenagement(items[i], i));
  }
  return out;
}

function formatPersonnePresente(person, deidentified = false) {
  if (!person) return "";
  if (typeof person === "string") {
    const trimmed = person.trim();
    if (deidentified) {
      const match = /\(([^)]+)\)/.exec(trimmed);
      return match ? match[1].trim() : "[PARTICIPANT]";
    }
    return trimmed;
  }
  const nom = String(person.nom || person.name || "").trim();
  const fonction = String(person.fonction || person.role || "").trim();
  if (deidentified) {
    return fonction || "[PARTICIPANT]";
  }
  if (nom && fonction) return `${nom} (${fonction})`;
  if (nom) return nom;
  return fonction;
}

function normalizePersonnesPresentes(list, minCount = 9, deidentified = false) {
  const arr = safeArray(list).map(p => formatPersonnePresente(p, deidentified)).filter(Boolean);
  const targetLen = Math.max(minCount, Math.ceil(Math.max(1, arr.length) / 3) * 3);
  const out = [];
  for (let i = 0; i < targetLen; i++) {
    out.push(arr[i] || "");
  }
  return out;
}

function fuseDirectionAndTeamFeedback(directionText, ecoleText) {
  const d = String(directionText || "").trim();
  const e = String(ecoleText || "").trim();
  if (d && e) {
    return `Direction : ${d}\n\nÉcole / équipe : ${e}`;
  }
  if (d) return `Direction : ${d}`;
  if (e) return `École / équipe : ${e}`;
  return "";
}

function countMissingPIAInfo(studentOrInfo) {
  let student = null;
  if (typeof getData === "function" && studentOrInfo?.studentId) {
    try {
      const d = getData();
      student = d.students?.find(s => String(s.studentId) === String(studentOrInfo.studentId) || String(s.id) === String(studentOrInfo.studentId));
    } catch (_) {}
  }
  const info = studentOrInfo?.administrativeInfo || studentOrInfo?.studentAdministrativeInfo || student?.administrativeInfo || student || studentOrInfo || {};
  const required = [
    { key: "nom", label: "Nom et prénom de l'élève", val: info.nom || studentOrInfo?.eleve || student?.nom },
    { key: "dateNaissance", label: "Date de naissance", val: info.dateNaissance || student?.dateNaissance },
    { key: "coordonneesEcole", label: "Coordonnées de l'école", val: info.coordonneesEcole || student?.coordonneesEcole || info.ecole || studentOrInfo?.ecole || student?.ecole },
    { key: "classe", label: "Classe et option", val: info.classe || studentOrInfo?.classe || student?.classe },
    { key: "titulaire", label: "Titulaire", val: info.titulaire || student?.titulaire },
    { key: "coordonneesCpms", label: "Coordonnées du CPMS", val: info.coordonneesCpms || student?.coordonneesCpms },
    { key: "representantPole", label: "Représentant du Pôle Territorial", val: info.representantPole || student?.representantPole },
    { key: "coordonneesResponsable", label: "Coordonnées du responsable", val: info.coordonneesResponsable || student?.coordonneesResponsable || info.responsable || student?.responsable }
  ];
  const missing = required.filter(f => !String(f.val || "").trim());
  const missingCount = missing.length;
  const isComplete = missingCount === 0;
  const summaryText = isComplete
    ? "Toutes les informations administratives du PIA sont renseignées"
    : `${missingCount} information${missingCount > 1 ? "s" : ""} manquante${missingCount > 1 ? "s" : ""} pour le PIA (non bloquant)`;
  return {
    totalMissing: missingCount,
    missingCount,
    missingFields: missing.map(m => m.label),
    isComplete,
    summaryText
  };
}

function suggestSchoolAdminData(ecole, allStudents) {
  const safeEco = norm(String(ecole || ""));
  if (!safeEco) return {};
  const students = safeArray(allStudents);
  const peer = students.find(s => {
    const sEco = norm(String(s.ecole || s.administrativeInfo?.ecole || ""));
    return sEco && sEco === safeEco && (
      s.coordonneesEcole || s.administrativeInfo?.coordonneesEcole ||
      s.titulaire || s.administrativeInfo?.titulaire ||
      s.coordonneesCpms || s.administrativeInfo?.coordonneesCpms
    );
  });
  if (!peer) return {};
  const peerInfo = peer.administrativeInfo || peer;
  return {
    coordonneesEcole: peerInfo.coordonneesEcole || "",
    coordonneesCpms: peerInfo.coordonneesCpms || "",
    titulaire: peerInfo.titulaire || ""
  };
}

function buildOfficialPIADocumentModel(pia, deidentified = false, options = {}) {
  const d = piaForExport(pia, deidentified);
  const moment = String(options?.moment || pia?.moment || (
    pia?.lifecycle === "EN_REEVALUATION" ||
    pia?.meeting2?.status === "REEVALUATION_VALIDEE" ||
    pia?.meeting2?.status === "FINALISE" ||
    Boolean(pia?.meeting2?.date)
      ? "FIN_ANNEE"
      : "DECEMBRE"
  )).toUpperCase();

  const isFinAnnee = moment === "FIN_ANNEE";
  const schoolYear = d.schoolYear || "2025-2026";
  const headerYear = schoolYear.includes("-") ? schoolYear : "2025-2026";
  const t1_identite = deidentified
    ? {
        nom: "",
        dateNaissance: "",
        coordonneesEcole: "",
        classeEtOption: "",
        titulaire: "",
        coordonneesCpms: "",
        representantPole: "Pôle Territorial WBE BXL",
        coordonneesResponsable: ""
      }
    : buildPIAIdentityObject(pia, false);

  const aspectsList = [
    "Physique et psychomoteur",
    "Lié à l’autonomie",
    "Comportemental et affectif",
    "Communication",
    "Cognitif (pédagogique)"
  ];
  const sections = safeArray(d.sections);
  const t2_aspects = aspectsList.map(aspectName => {
    const sec = sections.find(s => norm(s.aspect) === norm(aspectName)) || { aspect: aspectName, ressources: [], difficultes: [] };
    const validatedObjs = piaDomainObjectives(d, sec);
    const cleanItem = r => String(r || "").replace(/^Point fonctionnel\s*:\s*/i, "").trim();
    const res = safeArray(sec.ressources).filter(r => !r.includes("Point fonctionnel")).map(cleanItem).filter(Boolean);
    const diff = safeArray(sec.difficultes).map(cleanItem).filter(Boolean);
    const obj = validatedObjs.map(cleanItem).filter(Boolean);
    return {
      aspect: aspectName + "\u00A0:",
      ressources: res.join("\n"),
      difficultes: diff.join("\n"),
      objectifs: obj.join("\n")
    };
  });

  const m1 = d.meeting1 || {};
  const rawM1 = pia?.meeting1 || {};
  const m1Date = deidentified ? "" : (m1.date || "");
  const m1PresentRaw = safeArray(
    m1.personnesPresentes || rawM1.personnesPresentes || (
      m1.participants ? PIA_MEETING_ACTORS.filter(a => m1.participants[a.id]).map(a => a.label)
        : (rawM1.participants ? PIA_MEETING_ACTORS.filter(a => rawM1.participants[a.id]).map(a => a.label) : [])
    )
  );
  const m1Present = normalizePersonnesPresentes(m1PresentRaw, 9, deidentified);
  const m1Axe = String(m1.axeDifficulte || m1.context || "").trim();
  const m1Obj = safeArray(m1.objectivesValidated).map(o => typeof o === "string" ? o : o.formulation || "").filter(Boolean).join("\n") || String(m1.objectifsCriteres || m1.objectivesCriteres || m1.objectivesModified || "").trim();
  const m1Moyens = String(m1.ressourcesMoyens || m1.means || "").trim();
  const m1Feedback = m1.feedback || {};
  const m1Parents = String(m1Feedback.parents || "").trim();
  const m1DirTeam = String(m1Feedback.directionEtEquipe || fuseDirectionAndTeamFeedback(m1Feedback.direction, m1Feedback.ecole) || "").trim();
  const m1Eleve = String(m1Feedback.eleve || "").trim();
  const m1Pms = String(m1Feedback.pms || "").trim();
  const m1Integration = String(m1Feedback.integration || "").trim();
  const m1Autres = String(m1Feedback.autres || "").trim();

  const pv1 = {
    date: m1Date,
    personnesPresentes: m1Present,
    difficulteAxe: m1Axe,
    objectifsCriteres: m1Obj,
    ressourcesMoyens: m1Moyens,
    retours: deidentified
      ? {
          parents: "",
          directionEtEquipe: "",
          eleve: "",
          pms: "",
          integration: "",
          autres: ""
        }
      : {
          parents: m1Parents,
          directionEtEquipe: m1DirTeam,
          eleve: m1Eleve,
          pms: m1Pms,
          integration: m1Integration,
          autres: m1Autres
        }
  };

  const amRaw = safeArray(pia.amenagements || d.amenagements);
  const t5_amenagements = normalizeAmenagementsList(amRaw, 10);

  let pv2;
  let t8_amenagements;

  if (isFinAnnee) {
    const m2 = d.meeting2 || {};
    const rawM2 = pia?.meeting2 || {};
    const m2Date = deidentified ? "" : (m2.date || "");
    const m2PresentRaw = safeArray(
      m2.personnesPresentes || rawM2.personnesPresentes || (
        m2.participants ? PIA_MEETING_ACTORS.filter(a => m2.participants[a.id]).map(a => a.label)
          : (rawM2.participants ? PIA_MEETING_ACTORS.filter(a => rawM2.participants[a.id]).map(a => a.label) : [])
      )
    );
    const m2Present = normalizePersonnesPresentes(m2PresentRaw, 9, deidentified);
    const m2Eval = safeArray(m2.evaluation).map(item => {
      const stateInfo = item?.state ? ` [${item.state === "A_DISCUSSER" ? "À discuter" : item.state}]` : "";
      return `${item?.objectif || "Objectif"}${stateInfo}${item?.note ? ` : ${item.note}` : ""}`;
    }).filter(Boolean).join("\n") || String(m2.objectifsEvaluation || m2.context || "").trim();
    const m2Feedback = m2.feedback || {};
    const m2Parents = String(m2Feedback.parents || "").trim();
    const m2DirTeam = String(m2Feedback.directionEtEquipe || fuseDirectionAndTeamFeedback(m2Feedback.direction, m2Feedback.ecole) || "").trim();
    const m2Eleve = String(m2Feedback.eleve || "").trim();
    const m2Pms = String(m2Feedback.pms || "").trim();
    const m2Integration = String(m2Feedback.integration || "").trim();
    const m2Autres = String(m2Feedback.autres || "").trim();

    pv2 = {
      date: m2Date,
      personnesPresentes: m2Present,
      objectifsEvaluation: m2Eval,
      retours: deidentified
        ? {
            parents: "",
            directionEtEquipe: "",
            eleve: "",
            pms: "",
            integration: "",
            autres: ""
          }
        : {
            parents: m2Parents,
            directionEtEquipe: m2DirTeam,
            eleve: m2Eleve,
            pms: m2Pms,
            integration: m2Integration,
            autres: m2Autres
          }
    };

    const amRentreeRaw = safeArray(m2.amenagementsRentree || pia.amenagementsRentree || m2.objectivesToContinue);
    t8_amenagements = normalizeAmenagementsList(amRentreeRaw, 10);
  } else {
    pv2 = {
      date: "",
      personnesPresentes: Array(9).fill(""),
      objectifsEvaluation: "",
      retours: {
        parents: "",
        directionEtEquipe: "",
        eleve: "",
        pms: "",
        integration: "",
        autres: ""
      }
    };
    t8_amenagements = normalizeAmenagementsList([], 10);
  }

  return {
    isPIADocumentModel: true,
    moment,
    deidentified: Boolean(deidentified),
    schoolYear,
    headerYear,
    metaAuthor: "Pôle Territorial WBE BXL",
    t1_identite,
    t2_aspects,
    pv1,
    t5_amenagements,
    pv2,
    t8_amenagements
  };
}

function buildPIADocumentModel(pia,deidentified=false,options={}){
  const d=piaForExport(pia,deidentified);
  const official=buildOfficialPIADocumentModel(pia,deidentified,options);
  const statusLabel=piaStatusLabel(d);
  const statusTone=["EN_VIGUEUR","ACTIF","FINALISE"].includes(d.lifecycle)?"success":(d.lifecycle==="EN_REEVALUATION"?"info":"warning");
  const counts=getPIADecisionCounts(d);
  const validatedList=safeArray(d.meeting1?.objectivesValidated);
  const previousList=safeArray(d.meeting1?.objectivesPrevious);
  const proposals=safeArray(d.propositions);
  const pendingProps=proposals.filter(p=>(p.decisionStatus||"A_EXAMINER")==="A_EXAMINER");
  const refusedProps=proposals.filter(p=>p.decisionStatus==="REFUSEE");
  const validatedProps=proposals.filter(p=>p.decisionStatus==="VALIDEE");
  const sections=safeArray(d.sections);
  const amenagements=safeArray(d.amenagements);

  // Synthèse en un coup d'œil : formulations courtes et distinctes du tableau des 5 aspects
  const cleanExecItem=r=>String(r||"").replace(/^Point fonctionnel\s*:\s*/i,"").split(/\s+—\s+|\s+\[/)[0].trim();
  const topResources=sections.flatMap(s=>safeArray(s.ressources).filter(r=>!r.includes("Point fonctionnel")).map(r=>`${cleanExecItem(r)} (${s.aspect})`)).slice(0,3);
  const topFunctional=sections.flatMap(s=>safeArray(s.ressources).filter(r=>r.includes("Point fonctionnel")).map(r=>`${cleanExecItem(r)} — fonctionnel en situation courante (${s.aspect})`)).slice(0,2);
  const topNeeds=sections.flatMap(s=>safeArray(s.difficultes).map(df=>`${cleanExecItem(df)} (${s.aspect})`)).slice(0,3);
  const topObjectives=validatedList.map(o=>typeof o==="string"?o:o.formulation||"").filter(Boolean).slice(0,3);

  const blocks=[];

  // 1. Cartouche institutionnel
  blocks.push({
    type:"header_banner",
    kicker:"PLAN INDIVIDUEL D’APPRENTISSAGE (PIA) · ACCOMPAGNEMENT SPÉCIALISÉ",
    title:deidentified?"PIA — Modèle professionnel dé-identifié":"Plan Individuel d’Apprentissage (PIA) — Document professionnel",
    subtitle:deidentified
      ?"Synthèse structurée dé-identifiée (sans identité, école, classe ni dates nominatives)"
      :`Synthèse annuelle contextualisée · Année scolaire ${d.schoolYear||"en cours"}`,
    statusBadge:statusLabel,
    statusTone,
    metaRows:deidentified
      ? [
          ["Type de document","PIA — Modèle dé-identifié","Statut du dossier",statusLabel],
          ["Séances analysées",`${Number(d.sessionsAnalysed||0)} séance(s)`,"Objectifs validés",`${validatedList.length} objectif(s)`],
          ["Propositions",`${counts.total} (${counts.validated} validée(s), ${counts.pending} à examiner, ${counts.refused} refusée(s))`,"Cadre méthodologique","Synthèse descriptive non causale"]
        ]
      : [
          ["Élève",d.eleve||"Non renseigné","Classe / Niveau",d.classe||"Non renseignée"],
          ["Établissement",d.ecole||"Non renseigné","Année scolaire",d.schoolYear||"En cours"],
          ["Séances analysées",`${Number(d.sessionsAnalysed||0)} séance(s)`,"Période de référence",d.until?`Jusqu’au ${d.until}`:"Année en cours"],
          ["Réunion 1 (décembre)",`${formatMeetingStatusLabel(d.meeting1?.status)}${d.meeting1?.date?` (${d.meeting1.date})`:""}`,"Réunion 2 (fin d’année)",`${formatMeetingStatusLabel(d.meeting2?.status)}${d.meeting2?.date?` (${d.meeting2.date})`:""}`]
        ]
  });

  // 2. Encadré méthodologique & Synthèse « en un coup d’œil »
  blocks.push({
    type:"callout",
    tone:"info",
    title:"Cadre méthodologique et lecture rapide du PIA",
    lines:[
      "Note méthodologique : Les éléments ci-dessous synthétisent les observations réalisées en séance (niveaux de réalisation, processus d’apprentissage, adaptations mises en place, transfert et suites prévues). Ils sont descriptifs et non causaux.",
      "Distinction stricte des statuts : Seuls les objectifs explicitement validés en équipe engagent le PIA en vigueur. Les propositions « À examiner » ou « Refusées » sont tracées séparément."
    ]
  });

  blocks.push({
    type:"kpi_grid",
    items:[
      {label:"Séances analysées",value:String(Number(d.sessionsAnalysed||0)),sub:"Observations documentées",tone:"neutral"},
      {label:"Objectifs en vigueur",value:String(validatedList.length),sub:"Validés par l’équipe",tone:"success"},
      {label:"Propositions à examiner",value:String(counts.pending),sub:"Non engagées à ce stade",tone:"warning"},
      {label:"Aménagements P/O/M",value:String(amenagements.length),sub:"Pédagogique · Org. · Matériel",tone:"info"}
    ]
  });

  blocks.push({
    type:"table",
    title:"Synthèse exécutive « en un coup d’œil »",
    colWidths:[28,72],
    headers:["Axe de lecture","Synthèse transversale du profil et du projet"],
    rows:[
      [
        "Points d’appui & ressources mobilisées",
        topResources.length?topResources:[topFunctional.length?topFunctional[0]:"Aucun point d’appui saillant documenté à ce stade ; à enrichir au fil des séances."]
      ],
      [
        "Fonctionnement acquis en situation courante",
        topFunctional.length?topFunctional:["Fonctionnement régulier intégré dans la synthèse par domaine ci-dessous."]
      ],
      [
        "Besoins prioritaires & fragilités récurrentes",
        topNeeds.length?topNeeds:["Aucun besoin récurrent convergent identifié à ce stade."]
      ],
      [
        "Objectifs prioritaires retenus",
        topObjectives.length?topObjectives:(pendingProps.length?[`Aucun objectif validé à ce stade (${pendingProps.length} proposition(s) en attente d’examen).`]:["Aucun objectif validé à ce stade."])
      ]
    ]
  });

  // 3. Continuité avec le PIA précédent
  blocks.push({type:"section_title",number:"1",title:"Continuité avec le PIA précédent"});
  const sc=d.sourceContinuity?.extracted||{};
  if(!deidentified && d.sourceContinuity?.present){
    const contRows=[
      ["Source de continuité",[`Document ${String(d.sourceContinuity.format||"PIA").toUpperCase()} analysé localement (sans conservation du fichier brut)`]]
    ];
    if(safeArray(sc.objectives).length)contRows.push(["Objectifs précédents à réévaluer",safeArray(sc.objectives)]);
    if(safeArray(sc.resources).length)contRows.push(["Ressources précédemment documentées",safeArray(sc.resources)]);
    if(safeArray(sc.difficulties).length)contRows.push(["Besoins / difficultés précédemment documentés",safeArray(sc.difficulties)]);
    if(safeArray(sc.adaptations).length)contRows.push(["Adaptations précédemment documentées",safeArray(sc.adaptations)]);
    blocks.push({
      type:"table",
      colWidths:[30,70],
      headers:["Volet de continuité","Éléments extraits du PIA précédent"],
      rows:contRows
    });
  }else if(deidentified){
    blocks.push({
      type:"callout",
      tone:"neutral",
      title:"Continuité",
      lines:["Source précédente retirée de l’export dé-identifié afin de préserver l’anonymat du dossier."]
    });
  }else{
    blocks.push({
      type:"callout",
      tone:"neutral",
      title:"Continuité",
      lines:[previousList.length?`Objectifs antérieurs renseignés dans le dossier : ${previousList.map(x=>typeof x==="string"?x:x.formulation||"").filter(Boolean).join(" ; ")}`:"Aucun PIA précédent structuré disponible pour ce dossier."]
    });
  }

  // 4. Tableau officiel des 5 aspects du développement (sobre et fidèle au modèle PIA de référence)
  blocks.push({type:"section_title",number:"2",title:"Synthèse structurée des 5 aspects du développement"});
  blocks.push({
    type:"table",
    tableRole:"domain_summary",
    colWidths:[18,27,28,27],
    headers:["Aspect","Ressources","Difficultés","Objectifs à poursuivre"],
    rows:sections.map(sec=>{
      const domObjs=piaDomainObjectives(d,sec);
      return [
        sec.aspect||"Aspect",
        safeArray(sec.ressources).length?safeArray(sec.ressources).slice(0,3):["À compléter."],
        safeArray(sec.difficultes).length?safeArray(sec.difficultes).slice(0,3):["À compléter à partir des données disponibles."],
        domObjs.length?domObjs.slice(0,3):["Aucun objectif validé dans ce domaine à ce stade (voir les propositions à examiner ci-dessous)."]
      ];
    })
  });

  // Table complémentaire : Critères d’évaluation, Moyens / adaptations et Évolution par aspect
  const activeDetailSections=sections.filter(sec=>safeArray(sec.criteres).length||safeArray(sec.moyens).length||safeArray(sec.evolution).length);
  if(activeDetailSections.length){
    blocks.push({
      type:"table",
      title:"Critères d’évaluation, moyens d’appui et évolution documentée par aspect",
      colWidths:[18,27,28,27],
      headers:["Aspect","Critères d’évaluation","Moyens / adaptations","Évolution documentée"],
      rows:sections.map(sec=>[
        sec.aspect||"Aspect",
        safeArray(sec.criteres).length?safeArray(sec.criteres).slice(0,3):["À compléter."],
        safeArray(sec.moyens).length?safeArray(sec.moyens).slice(0,4):["À compléter."],
        safeArray(sec.evolution).length?safeArray(sec.evolution).slice(0,2):["À compléter."]
      ])
    });
  }

  // 5. Objectifs visés pour la période et trajectoire de validation des propositions
  blocks.push({type:"section_title",number:"3",title:"Objectifs visés pour la période et critères d’évaluation"});
  const objRows=[];
  if(previousList.length){
    previousList.forEach(item=>{
      const text=typeof item==="string"?item:item.formulation||"";
      if(text)objRows.push(["Continuité / à réévaluer","À réévaluer",text,"Issu du PIA précédent / dossier élève"]);
    });
  }
  if(validatedList.length){
    validatedList.forEach(item=>{
      const text=typeof item==="string"?item:item.formulation||"";
      const aspect=(typeof item==="object"&&item.aspect)||"Transversal";
      const linkedProp=proposals.find(p=>matchesProposalObjective(item,p));
      const trace=linkedProp?`Observé sur ${Number(linkedProp.sessionCount||0)} séance(s)`:"Validé en réunion d’équipe";
      if(text)objRows.push([aspect,"VALIDÉ (En vigueur)",text,trace]);
    });
  }else{
    objRows.push(["—","Aucun objectif validé","Aucun objectif validé à ce stade.","Validation requise en réunion d’équipe"]);
  }
  pendingProps.forEach(p=>{
    objRows.push([
      p.aspect||"Domaine",
      "PROPOSITION À EXAMINER (non validée)",
      `${p.formulation||""} [À examiner — non intégré aux objectifs validés]`,
      `Observé sur ${Number(p.sessionCount||0)} séance(s)${p.counterEvidence?" · Variabilité selon le contexte":""}`
    ]);
  });
  refusedProps.forEach(p=>{
    objRows.push([
      p.aspect||"Domaine",
      "REFUSÉE / NON RETENUE",
      `${p.formulation||""} [Refusée / non retenue]`,
      `Écartée lors de l’examen (${Number(p.sessionCount||0)} séance(s))`
    ]);
  });

  blocks.push({
    type:"table",
    colWidths:[18,20,42,20],
    headers:["Domaine","Statut décisionnel","Formulation de l’objectif / de la proposition","Traçabilité & repères"],
    rows:objRows
  });

  // 6. Ressources / moyens complémentaires et aménagements P/O/M (interopérable avec findAdaptationTables)
  blocks.push({type:"section_title",number:"4",title:"Ressources / moyens complémentaires et aménagements P/O/M"});
  blocks.push({
    type:"callout",
    tone:"neutral",
    title:"Légende des aménagements raisonnables",
    lines:["Légende P/O/M : P = Pédagogique (consignes, étayage, supports) · O = Organisationnel (temps, cadre, rituels, co-intervention) · M = Matériel (outils numériques, gabarits, matériel adapté)."]
  });
  const adaptationRows=amenagements.length
    ? amenagements.map(a=>{
        const code=String(a.type||"").trim().toUpperCase();
        const descParts=[
          `${formatAmenagementTypeLabel(code)} — ${a.texte||""}`,
          a.effetDocumente?`Effet observé : ${a.effetDocumente}`:"",
          a.suitePrevue?`Suite prévue : ${a.suitePrevue}`:""
        ].filter(Boolean);
        return [
          formatAmenagementTypeLabel(code),
          code==="P"?"X":"",
          code==="O"?"X":"",
          code==="M"?"X":"",
          descParts.join(" | ")
        ];
      })
    : [["À compléter","","","","À compléter sur base des éléments effectivement documentés en séance."]];

  blocks.push({
    type:"table",
    tableRole:"adaptations_pom",
    colWidths:[20,7,7,7,59],
    headers:["Volet","P","O","M","Description de l’aménagement, effet observé et suite prévue"],
    rows:adaptationRows
  });

  // 7. Réunions & gouvernance annuelle (Réunion 1 décembre & Réunion 2 fin d’année)
  const buildMeetingTableBlock=(num,title,meeting,isMeeting2)=>{
    blocks.push({type:"section_title",number:num,title});
    const typeLabel=meeting?.type==="REUNION_2_FIN_ANNEE"?"Réunion de fin d’année (réévaluation)":(meeting?.type==="REUNION_1_DECEMBRE"?"Réunion initiale / décembre":(meeting?.type||"À préciser"));
    const statusText=formatMeetingStatusLabel(meeting?.status);
    const participants=PIA_MEETING_ACTORS.filter(actor=>meeting?.participants?.[actor.id]).map(actor=>actor.label);
    const feedback=PIA_MEETING_ACTORS.filter(actor=>meeting?.feedback?.[actor.id]).map(actor=>`${actor.label} : ${meeting.feedback[actor.id]}`);
    const rows=[
      ["Type de rencontre",[typeLabel]],
      ["Statut de la rencontre",[statusText]]
    ];
    if(!deidentified){
      rows.push(["Date de la rencontre",[meeting?.date||"À préciser"]]);
      if(meeting?.validatedAt)rows.push(["Date de validation",[dateOnly(meeting.validatedAt)]]);
    }
    rows.push(["Contexte",[meeting?.context||(deidentified?"[retiré de l’export dé-identifié]":"À compléter")]]);
    rows.push(["Participants présents ou associés",participants.length?participants:["À préciser."]]);
    rows.push(["Retours des participants",feedback.length?feedback:[deidentified?"Retours nominatifs retirés de l’export dé-identifié.":"À compléter."]]);
    for(const [key,label] of [["decisions","Décisions"],["objectivesModified","Objectifs modifiés"],["means","Moyens"],["adaptations","Adaptations P/O/M"],["information","Informations complémentaires"],["notes","Notes"]]){
      if (key === "adaptations") {
        const list = isMeeting2
          ? safeArray(meeting?.amenagementsRentree || pia?.meeting2?.amenagementsRentree)
          : safeArray(pia?.amenagements || d?.amenagements);
        const valid = filterValidStructuredAmenagements(list);
        if (valid.length) {
          const formatted = valid.map((item, idx) => {
            const codes = [item.p ? "P" : "", item.o ? "O" : "", item.m ? "M" : ""].filter(Boolean);
            const prefix = codes.length ? `[${codes.join("+")}] ` : "";
            return `${idx + 1}. ${prefix}${item.description || item.texte || ""}`;
          });
          rows.push([label, formatted]);
        } else {
          const val = meeting?.[key];
          rows.push([label, [val || (deidentified ? "[retiré de l’export dé-identifié]" : "À compléter.")]]);
        }
      } else {
        const val=meeting?.[key];
        rows.push([label,[val||(deidentified&&["decisions","objectivesModified","information","notes"].includes(key)?"[retiré de l’export dé-identifié]":"À compléter.")]]);
      }
    }
    if(isMeeting2){
      const evalItems=safeArray(meeting?.evaluation);
      rows.push([
        "Bilan d’évaluation des objectifs",
        evalItems.length
          ? evalItems.map(item=>{
              const evCount=safeArray(item?.evidence).length;
              const evInfo=!deidentified&&evCount>0?` (${evCount} séance(s) post-réunion 1)`:"";
              const stateInfo=item?.state?` [${item.state==="A_DISCUSSER"?"À discuter en équipe":item.state}]`:"";
              return `${item?.objectif||"Objectif"}${evInfo}${stateInfo}${item?.note?` — ${item.note}`:""}`;
            })
          : ["Aucun élément de réévaluation enregistré à ce stade."]
      ]);
      const contItems=safeArray(meeting?.objectivesToContinue);
      rows.push([
        "Objectifs maintenus / reconduits",
        contItems.length?contItems.map(x=>typeof x==="string"?x:x.formulation||""):["Aucun objectif reconduit spécifié à ce stade."]
      ]);
      const perspItems=safeArray(meeting?.perspectives);
      rows.push([
        "Perspectives pour la suite",
        perspItems.length?perspItems.map(x=>typeof x==="string"?x:x.formulation||x.texte||""):["À compléter lors du bilan de fin d’année."]
      ]);
    }
    blocks.push({
      type:"table",
      colWidths:[28,72],
      headers:["Rubrique de concertation","Contenu documenté"],
      rows
    });
  };

  buildMeetingTableBlock("5","Réunion de décembre",d.meeting1||{},false);
  buildMeetingTableBlock("6","Réunion de fin d’année",d.meeting2||{},true);

  return {
    isPIADocumentModel:true,
    moment:official.moment,
    deidentified:Boolean(deidentified),
    title:deidentified?"PIA — modèle dé-identifié":"Plan Individuel d’Apprentissage",
    schoolYear:official.schoolYear,
    headerYear:official.headerYear,
    metaAuthor:official.metaAuthor,
    studentName:deidentified?"":(official.t1_identite?.eleve||d.eleve||""),
    statusLabel,
    officialDocument:official,
    t1_identite:official.t1_identite,
    t2_aspects:official.t2_aspects,
    pv1:official.pv1,
    t5_amenagements:official.t5_amenagements,
    pv2:official.pv2,
    t8_amenagements:official.t8_amenagements,
    blocks,
    lines:piaTextSections(pia,deidentified)
  };
}

function renderDocxParagraph(text,opts={}){
  const mod = getJournalierDocx();
  return mod ? mod.formatDocxParagraph(text,opts) : "";
}

function renderDocxTable(tableSpec){
  const mod = getJournalierDocx();
  return mod ? mod.formatDocxTable(tableSpec) : "";
}

function makeDocxFromModel(model){
  const mod = getJournalierDocx();
  return mod ? mod.buildDocxModelArchive(model) : new Uint8Array();
}

function makeDocx(linesOrModel){
  const mod = getJournalierDocx();
  return mod ? mod.generateDocxDocument(linesOrModel,buildPIADocumentModel) : new Uint8Array();
}

async function makeOfficialDocx(linesOrModel, templateBuffer) {
  const mod = getJournalierDocx();
  if (!mod || typeof mod.fillOfficialPIADocx !== "function") {
    throw new Error("Moteur Word officiel indisponible.");
  }
  const model = linesOrModel && linesOrModel.isPIADocumentModel
    ? linesOrModel
    : buildPIADocumentModel(linesOrModel, Boolean(linesOrModel?.type === "PIA_MODELE_DEIDENTIFIE" || linesOrModel?.deidentified));
  return mod.fillOfficialPIADocx(model, templateBuffer);
}
async function unzipEntries(buffer){
  if (!buffer) throw new Error("Archive DOCX invalide ou non lisible.");
  const arrayBuffer = (buffer && buffer.buffer)
    ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    : buffer;
  const bytes = new Uint8Array(arrayBuffer), view = new DataView(arrayBuffer), max = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= max; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive DOCX invalide ou non lisible.");
  const count = view.getUint16(eocd + 10, true), cdOffset = view.getUint32(eocd + 16, true), entries = {};
  if (count > MAX_PIA_ZIP_ENTRIES) throw new Error("Le document Word contient trop d’éléments.");
  let p = cdOffset, totalSize = 0;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Répertoire DOCX invalide.");
    const method = view.getUint16(p + 10, true), csize = view.getUint32(p + 20, true), usize = view.getUint32(p + 24, true), nlen = view.getUint16(p + 28, true), elen = view.getUint16(p + 30, true), clen = view.getUint16(p + 32, true), loff = view.getUint32(p + 42, true), name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nlen));
    const lName = view.getUint16(loff + 26, true), lExtra = view.getUint16(loff + 28, true), start = loff + 30 + lName + lExtra;
    const compressed = bytes.slice(start, start + csize);
    totalSize += usize;
    if (totalSize > MAX_PIA_TEXT_BYTES) throw new Error("Le document Word est trop volumineux après décompression.");
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) {
      if (typeof DecompressionStream !== "function") throw new Error("Ce navigateur ne permet pas de décompresser le document Word localement.");
      const ds = new DecompressionStream("deflate-raw");
      data = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(ds)).arrayBuffer());
      if (data.length > MAX_PIA_TEXT_BYTES) throw new Error("Le document Word est trop volumineux après décompression.");
    } else throw new Error("Méthode de compression DOCX non prise en charge.");
    entries[name] = data;
    p += 46 + nlen + elen + clen;
  }
  return entries;
}
async function extractDocxText(file){
  if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");
  const entries=await unzipEntries(await file.arrayBuffer()),xml=entries["word/document.xml"];
  if(!xml)throw new Error("Le document Word ne contient pas de document.xml exploitable.");
  const text=new TextDecoder("utf-8").decode(xml),doc=new DOMParser().parseFromString(text,"application/xml"),ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main",paras=[...doc.getElementsByTagNameNS(ns,"p")];
  const lines=paras.map(p=>[...p.getElementsByTagNameNS(ns,"t")].map(x=>x.textContent||"").join("").trim()).filter(Boolean);
  if(!lines.length)throw new Error("Aucun texte exploitable n'a été trouvé dans le document Word.");
  return lines.join("\n");
}
function docxCellText(tc,ns){
  const paras=[...tc.getElementsByTagNameNS(ns,"p")];
  return paras.map(p=>[...p.getElementsByTagNameNS(ns,"t")].map(t=>t.textContent||"").join("")).join("\n").replace(/\u00a0/g," ").trim();
}
async function extractDocxTables(file){
  if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");
  const entries=await unzipEntries(await file.arrayBuffer()),xml=entries["word/document.xml"];
  if(!xml)return [];
  const text=new TextDecoder("utf-8").decode(xml),doc=new DOMParser().parseFromString(text,"application/xml"),ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  return [...doc.getElementsByTagNameNS(ns,"tbl")].map(tbl=>[...tbl.getElementsByTagNameNS(ns,"tr")].map(tr=>[...tr.children].filter(c=>c.localName==="tc").map(tc=>docxCellText(tc,ns))));
}
function findDomainTable(tables){
  return tables.find(rows=>{
    const header=(rows[0]||[]).map(norm);
    return header.some(c=>c.includes(norm("Aspect")))&&header.some(c=>c.includes(norm("Objectifs")));
  });
}
function parseDomainTableRows(rows){
  if(!rows||rows.length<2)return [];
  const header=rows[0].map(norm),idx=label=>header.findIndex(h=>h.includes(norm(label)));
  const iAspect=idx("Aspect"),iRes=idx("Ressources"),iDiff=idx("Difficult"),iObj=idx("Objectifs");
  const splitCell=txt=>String(txt||"").split(/\n|;|•|●|▪/).map(x=>x.trim()).filter(x=>x.length>1&&!/^x$/i.test(x));
  return rows.slice(1).map(row=>({aspect:(row[iAspect]||"").replace(/[:：]\s*$/,"").trim(),ressources:iRes>=0?splitCell(row[iRes]):[],difficultes:iDiff>=0?splitCell(row[iDiff]):[],objectifs:iObj>=0?splitCell(row[iObj]):[],moyens:[]})).filter(s=>s.aspect);
}
function findAdaptationTables(tables){
  return tables.filter(rows=>{
    const header=rows.slice(0,2).flat().map(norm);
    return header.includes("p")&&header.includes("o")&&header.includes("m")&&header.some(h=>h.includes(norm("Description")));
  });
}
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
const WIN_ANSI_DECODE_MAP = Object.freeze({
  0x80:"\u20AC",0x82:"\u201A",0x83:"\u0192",0x84:"\u201E",0x85:"\u2026",0x86:"\u2020",0x87:"\u2021",0x88:"\u02C6",0x89:"\u2030",0x8A:"\u0160",0x8B:"\u2039",0x8C:"\u0152",0x8E:"\u017D",
  0x91:"\u2018",0x92:"\u2019",0x93:"\u201C",0x94:"\u201D",0x95:"\u2022",0x96:"\u2013",0x97:"\u2014",0x98:"\u02DC",0x99:"\u2122",0x9A:"\u0161",0x9B:"\u203A",0x9C:"\u0153",0x9E:"\u017E",0x9F:"\u0178"
});
function winAnsiDecode(bytes){
  let out="";
  for(const b of bytes)out+=WIN_ANSI_DECODE_MAP[b]||String.fromCharCode(b);
  return out;
}
function pdfDecodeString(raw,hex=false){if(hex){const h=raw.replace(/[^0-9A-Fa-f]/g,"");const bytes=[];for(let i=0;i<h.length;i+=2)bytes.push(parseInt(h.slice(i,i+2).padEnd(2,"0"),16));if(bytes[0]===0xFE&&bytes[1]===0xFF){let out="";for(let i=2;i+1<bytes.length;i+=2)out+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);return out;}return winAnsiDecode(bytes);}
  const out=[];for(let i=0;i<raw.length;i++){if(raw[i]!=="\\"){out.push(raw.charCodeAt(i)&255);continue;}i++;if(i>=raw.length)break;const c=raw[i];if("nrtbf".includes(c)){out.push({n:10,r:13,t:9,b:8,f:12}[c]);continue;}if(c==="("||c===")"||c==="\\"){out.push(c.charCodeAt(0));continue;}if(/[0-7]/.test(c)){let oct=c;for(let j=0;j<2&&i+1<raw.length&&/[0-7]/.test(raw[i+1]);j++)oct+=raw[++i];out.push(parseInt(oct,8));continue;}if(c==="\n")continue;out.push(c.charCodeAt(0)&255);}return winAnsiDecode(out);}
function extractPdfStrings(text){const lines=[];const btBlocks=text.match(/BT[\s\S]*?ET/g)||[];for(const block of btBlocks){let i=0,lastOperator="";while(i<block.length){if(block[i]==="("){let j=i+1,depth=1,raw="";for(;j<block.length&&depth;j++){if(block[j]==="\\"){raw+=block[j]+(block[j+1]||"");j++;continue;}if(block[j]==="(")depth++;else if(block[j]===")")depth--;if(depth)raw+=block[j];}const tail=block.slice(j).match(/^\s*(?:Tj|TJ|['"])/);if(tail)lines.push(pdfDecodeString(raw,false));i=j;continue;}if(block[i]==="<"&&block[i+1]!=="<"){const j=block.indexOf(">",i+1);if(j>0){const raw=block.slice(i+1,j),tail=block.slice(j+1).match(/^\s*(?:Tj|TJ|['"])/);if(tail)lines.push(pdfDecodeString(raw,true));i=j+1;continue;}}i++;} }return lines.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);}
function ascii85Decode(input){let s=String(input||"").replace(/\s+/g,"");if(s.startsWith("<~"))s=s.slice(2);if(s.endsWith("~>"))s=s.slice(0,-2);const out=[];let group="";for(let i=0;i<s.length;i++){const c=s[i];if(c==="z"&&group.length===0){out.push(0,0,0,0);continue;}group+=c;if(group.length===5){let acc=0;for(const ch of group)acc=acc*85+(ch.charCodeAt(0)-33);out.push((acc>>>24)&255,(acc>>>16)&255,(acc>>>8)&255,acc&255);group="";}}if(group.length){const orig=group.length;while(group.length<5)group+="u";let acc=0;for(const ch of group)acc=acc*85+(ch.charCodeAt(0)-33);const bytes=[(acc>>>24)&255,(acc>>>16)&255,(acc>>>8)&255,acc&255];out.push(...bytes.slice(0,orig-1));}return new Uint8Array(out);}
class PdfSizeExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfSizeExceededError";
  }
}
async function inflatePdf(bytes){
  if(typeof DecompressionStream!=="function")throw new Error("Ce navigateur ne permet pas de décompresser localement ce PDF.");
  for(const format of ["deflate","deflate-raw"]){
    try{
      const ds=new DecompressionStream(format);
      const reader=new Blob([bytes]).stream().pipeThrough(ds).getReader();
      const chunks=[];
      let totalLength=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        totalLength+=value.length;
        if(totalLength>MAX_PIA_TEXT_BYTES){
          try{await reader.cancel();}catch(_){/* annulation défensive du lecteur */}
          throw new PdfSizeExceededError("Le PDF est trop volumineux après décompression.");
        }
        chunks.push(value);
      }
      const out=new Uint8Array(totalLength);
      let offset=0;
      for(const chunk of chunks){
        out.set(chunk,offset);
        offset+=chunk.length;
      }
      return out;
    }catch(err){
      if(err instanceof PdfSizeExceededError||err?.name==="PdfSizeExceededError")throw err;
      /* format zlib/deflate incompatible, tentative avec le format suivant */
    }
  }
  throw new Error("Flux PDF compressé non exploitable localement.");
}
async function extractPdfText(file){if(file.size>MAX_PIA_FILE_BYTES)throw new Error("Le fichier PIA dépasse la taille maximale de 20 Mo.");const buffer=await file.arrayBuffer(),raw=Array.from(new Uint8Array(buffer),b=>String.fromCharCode(b)).join("");const streams=[];const re=/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/g;let m;while((m=re.exec(raw))){let bytes=Uint8Array.from([...m[2]].map(c=>c.charCodeAt(0)&255));const filters=m[1];try{if(/ASCII85Decode/.test(filters))bytes=ascii85Decode(Array.from(bytes,b=>String.fromCharCode(b)).join(""));if(/FlateDecode/.test(filters))bytes=await inflatePdf(bytes);streams.push(Array.from(bytes,b=>String.fromCharCode(b)).join(""));}catch(_){if(!/FlateDecode|ASCII85Decode/.test(filters))streams.push(m[2]);}}const lines=extractPdfStrings(streams.join("\n"));if(lines.length<2){const fallback=raw.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)||[];fallback.forEach(x=>{const a=x.indexOf("(")+1,b=x.lastIndexOf(")");if(b>a)lines.push(pdfDecodeString(x.slice(a,b),false));});}if(lines.length<2)throw new Error("Aucun texte exploitable n'a été trouvé dans le PDF. Un PDF scanné/image peut nécessiter un OCR, non inclus dans Journalier.");return lines.join("\n");}
function normalizeImportedLines(text){
  // eslint-disable-next-line no-control-regex -- Nettoyage des contrôles binaires dans l'importation de texte
  return String(text||"").replace(/\u00a0/g," ").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,"").replace(/\r/g,"").split("\n").map(x=>x.replace(/[ \t]+/g," ").trim()).filter(Boolean);
}
function extractPIAStructure(text,fileName,format){
  const lines=normalizeImportedLines(text),nlines=lines.map(norm),aspects=PIA_CANONICAL_ASPECTS,blocks={};
  const findAspectIdx=(targetNorm,fromIdx=0)=>{
    const exact=nlines.findIndex((x,j)=>j>=fromIdx&&x===targetNorm);
    return exact>=0?exact:nlines.findIndex((x,j)=>j>=fromIdx&&x.includes(targetNorm));
  };
  aspects.forEach((aspect,i)=>{
    const idx=findAspectIdx(norm(aspect),0);
    if(idx<0)return;
    const next=aspects.slice(i+1).map(norm).map(a=>findAspectIdx(a,idx+1)).find(x=>x>=0);
    blocks[aspect]=lines.slice(idx+1,next>=0?next:lines.length);
  });
  function labelled(block,label){const b=block||[],nl=b.map(norm),i=nl.findIndex(x=>x.includes(norm(label)));if(i<0)return [];const stops=["ressources","difficultes","difficultés","objectifs à poursuivre","objectifs vises","objectifs visés","objectifs","moyens","retours des acteurs","amenagements","aménagements"];let end=b.length;for(let j=i+1;j<b.length;j++){if(stops.some(stop=>nl[j].startsWith(norm(stop)))){end=j;break;}}return b.slice(i+1,end).map(x=>x.replace(/^[•●▪\-–—]+\s*/,"").trim()).filter(x=>x.length>1&&norm(x)!=="non renseigne");}
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
    try{
      const fromTables=await extractPIAFromDocxTables(file);
      if(fromTables)return fromTables;
    }catch(err){
      console.warn("Journalier V74 — lecture tabulaire Word non concluante, repli sur le texte brut :", err);
    }
  }
  const text=ext==="docx"?await extractDocxText(file):await extractPdfText(file);
  const parsed=extractPIAStructure(text,file.name,ext);
  if(!parsed.extracted.objectives.length&&!parsed.extracted.sections.length&&!parsed.extracted.difficulties.length&&!parsed.extracted.adaptations.length)throw new Error("Le document a été lu, mais aucune structure PIA reconnaissable n'a été extraite. Le document original n'a pas été conservé.");
  return parsed;
}
function importedSummaryHtml(imported){
  const e=imported?.extracted||{};
  return `<div class="v74-import-summary"><b>✓ PIA analysé localement</b><span>${esc(imported?.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;
}
function piaImportDossierHtml(studentId){
  const imported=getImportedPIA(studentId);
  if(!imported?.extracted)return '<div class="v74-import-help">Aucun PIA importé pour ce dossier. Utilisez « Importer le PIA » dans la fiche de l’élève.</div>';
  const e=imported.extracted||{},sections=safeArray(e.sections).filter(s=>safeArray(s.objectifs).length||safeArray(s.moyens).length||safeArray(s.difficultes).length||safeArray(s.ressources).length);
  const globalAdaptations=safeArray(e.adaptations);
  const domainCards=sections.map((section,index)=>{
    const rows=[["difficultes","Besoins / difficultés"],["objectifs","Objectifs visés"]]
      .map(([key,label])=>{const items=safeArray(section[key]);return `<div class="v74-domain-value-list-row"><span class="v74-domain-value-label">${label}</span>${items.length?`<div class="v74-domain-value-list">${items.map(item=>`<span class="v74-domain-value">${esc(item)}</span>`).join("")}</div>`:'<p class="v74-domain-empty">Non renseigné.</p>'}</div>`;}).join("");
    return `<details class="v74-domain-record" id="v74-dossier-domain-${index}">
      <summary class="v74-domain-record-head tone-${piaDomainTone(section.aspect)}"><div><div class="page-kicker">Domaine PIA — continuité</div><h3>${esc(section.aspect||"Domaine")}</h3></div><span>${safeArray(section.difficultes).length} besoin(s) · ${safeArray(section.objectifs).length} objectif(s)</span></summary>
      <div class="v74-domain-fields">${rows}</div>
    </details>`;
  }).join("");
  return `<details class="v74-pia-dossier">
    <summary class="v74-import-summary"><b>PIA précédent — repère de continuité</b><span>${esc(imported.format?.toUpperCase()||"DOCUMENT")}</span><span>Importé le ${esc(new Date(imported.importedAt||Date.now()).toLocaleDateString("fr"))}</span></summary>
    <p class="v74-import-help">Ces éléments proviennent du PIA importé. Ils servent de repère et d’aide-mémoire pour préparer les séances ; ils ne remplacent pas une réévaluation par le professionnel.</p>
    ${domainCards||'<p class="v74-domain-empty">Aucun domaine structuré n’a été reconnu dans le document importé.</p>'}
    ${globalAdaptations.length?`<div class="v74-domain-value-list-row"><span class="v74-domain-value-label">Adaptations validées</span><div class="v74-domain-value-list">${globalAdaptations.map(item=>`<span class="v74-domain-value">${esc(item)}</span>`).join("")}</div></div>`:""}
  </details>`;
}
// =========================================================
// MOTEUR D'EXPORTATION PDF (Lot 3.3)
// Logique déléguée au module autonome src/v74/v74-pdf-export.js
// =========================================================

function getJournalierPdf() {
  if (typeof globalThis !== "undefined" && globalThis.JournalierPdf) return globalThis.JournalierPdf;
  if (typeof JournalierPdf !== "undefined") return JournalierPdf;
  return null;
}

var WIN_ANSI_BYTE_MAP = Object.freeze(getJournalierPdf()?.WIN_ANSI_BYTE_MAP || {});

function pdfWinAnsiBytes(text) {
  const mod = getJournalierPdf();
  return mod ? mod.pdfWinAnsiBytes(text) : [];
}

function pdfLiteral(text) {
  const mod = getJournalierPdf();
  return mod ? mod.pdfLiteral(text) : `(${String(text || "")})`;
}

function wrapPdfTextLine(text, maxChars = 88, continuationIndent = "") {
  const mod = getJournalierPdf();
  return mod ? mod.wrapPdfTextLine(text, maxChars, continuationIndent) : [String(text || "")];
}

function buildPdfFileFromPageContents(pageStreams) {
  const mod = getJournalierPdf();
  return mod ? mod.buildPdfFileFromPageContents(pageStreams) : new Uint8Array();
}

function makePdfFromModel(model) {
  const mod = getJournalierPdf();
  return mod ? mod.makePdfFromModel(model) : new Uint8Array();
}

function makePdf(linesOrModel) {
  const mod = getJournalierPdf();
  return mod ? mod.makePdf(linesOrModel, buildPIADocumentModel) : new Uint8Array();
}

async function makeOfficialPdf(linesOrModel) {
  const mod = getJournalierPdf();
  if (!mod || typeof mod.makeOfficialPdf !== "function") {
    throw new Error("Moteur PDF officiel indisponible.");
  }
  const model = linesOrModel && linesOrModel.isPIADocumentModel
    ? linesOrModel
    : buildPIADocumentModel(linesOrModel, Boolean(linesOrModel?.type === "PIA_MODELE_DEIDENTIFIE" || linesOrModel?.deidentified));
  return mod.makeOfficialPdf(model);
}

function formatSessionExportDate(rawDate){
  const str=String(rawDate||"").trim();
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if(m)return `${m[3]}/${m[2]}/${m[1]}`;
  return str||"Date non renseignée";
}

function toSessionInfinitivePhrase(rawText){
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
    [/^Compare\b/i,"Comparer"],
    [/^Classe\b/i,"Classer"],
    [/^Ordonne\b/i,"Ordonner"],
    [/^Estime\b/i,"Estimer"],
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
    [/^Dégage\b/i,"Dégager"],
    [/^Infère\b/i,"Inférer"],
    [/^Participe\b/i,"Participer"],
    [/^Prépare\b/i,"Préparer"],
    [/^Demande\b/i,"Demander"],
    [/^Accepte\b/i,"Accepter"],
    [/^Gère\b/i,"Gérer"],
    [/^Respecte\b/i,"Respecter"],
    [/^Se\s+repère\b/i,"Se repérer"],
    [/^S['’]engage\b/i,"S’engager"],
    [/^S['’]organise\b/i,"S’organiser"],
    [/^Effectue\b/i,"Effectuer"],
    [/^Trace\b/i,"Tracer"],
    [/^Construis|Construit\b/i,"Construire"],
    [/^Mesure\b/i,"Mesurer"],
    [/^Convertit\b/i,"Convertir"],
    [/^Associe\b/i,"Associer"],
    [/^Relie\b/i,"Relier"],
    [/^Distingue\b/i,"Distinguer"],
    [/^Reconnaît|Reconnait\b/i,"Reconnaître"],
    [/^Détermine\b/i,"Déterminer"],
    [/^Complète\b/i,"Compléter"],
    [/^Reformule\b/i,"Reformuler"]
  ];
  for(const [re,rep] of rules){
    if(re.test(s))return s.replace(re,rep);
  }
  return s;
}

function insertSessionFluidAdverb(obsText,adverb){
  const s=String(obsText||"").trim().replace(/\.$/,"");
  const adv=String(adverb||"").trim().toLowerCase();
  if(!s||!adv)return s;
  if(/^Met\s+en\s+œuvre\b/i.test(s)){
    return s.replace(/^Met\s+en\s+œuvre\b/i,`Met ${adv} en œuvre`);
  }
  if(/^Se\s+(\S+)/i.test(s)){
    return s.replace(/^(Se\s+\S+)/i,`$1 ${adv}`);
  }
  if(/^S['’](\S+)/i.test(s)){
    return s.replace(/^(S['’]\S+)/i,`$1 ${adv}`);
  }
  if(/^Travail\s+en\s+autonomie\b/i.test(s)){
    return `Travaille ${adv} en autonomie`;
  }
  if(/^Participation\b/i.test(s)){
    return `Participe ${adv}`;
  }
  const m=/^(\S+)(\s+.*)$/.exec(s);
  if(m)return `${m[1]} ${adv}${m[2]}`;
  return `${s} ${adv}`;
}

function formatSessionLearningClause(rawText,appRaw,extra=""){
  const inf=toSessionInfinitivePhrase(rawText).replace(/\.$/,"").trim();
  if(!inf)return "";
  const app=formatPiaQ3Appreciation(appRaw).toLowerCase();
  let sentence=inf;
  if(app.includes("maîtris")||app.includes("maitris")||app.includes("mobilis")||app.includes("appui")){
    sentence=`${inf} est bien maîtrisé en séance`;
  }else if(app.includes("appropriation")||app.includes("consolider")){
    sentence=`${inf} n’est pas encore totalement maîtrisé`;
  }else if(app.includes("renforcer")||app.includes("fragilit")){
    sentence=`${inf} reste à renforcer`;
  }
  return extra?`${sentence} — ${extra}`:sentence;
}

function formatSessionHelpClause(items){
  const list=safeArray(items).filter(x=>x&&x.type);
  if(!list.length)return "";
  const formatNameWithArt=(name,idx)=>{
    const clean=String(name||"").trim();
    if(!clean)return "";
    const lower=clean.charAt(0).toLowerCase()+clean.slice(1);
    const hasDeterminer=/^(le|la|l['’]|les|un|une|des)\b/i.test(clean);
    if(hasDeterminer)return idx===0?clean.charAt(0).toUpperCase()+clean.slice(1):lower;
    const isVowel=/^[aeiouyéèêëàâîïôùûœ]/i.test(clean);
    const isFem=/^(reformulation|lecture|structuration|manipulation|médiation|consigne|fiche|check-list|routine|adaptation|aide|verbalisation|explicitation)\b/i.test(clean);
    const art=isVowel?"l’":(isFem?"la ":"le ");
    const full=`${art}${lower}`;
    return idx===0?full.charAt(0).toUpperCase()+full.slice(1):full;
  };
  const joinSubjects=names=>{
    const formatted=names.map((n,i)=>formatNameWithArt(n,i)).filter(Boolean);
    if(formatted.length===1)return {subj:formatted[0],plural:false};
    if(formatted.length===2)return {subj:`${formatted[0]} et ${formatted[1]}`,plural:true};
    return {subj:`${formatted.slice(0,-1).join(", ")} et ${formatted[formatted.length-1]}`,plural:true};
  };
  const pos=[],part=[],none=[],other=[];
  list.forEach(it=>{
    const eff=String(it.effect||"").toLowerCase();
    if(eff.includes("positif")||eff.includes("déterminant")||eff.includes("aidant"))pos.push(it.type);
    else if(eff.includes("partiel"))part.push(it.type);
    else if(eff.includes("aucun"))none.push(it.type);
    else other.push(it.type);
  });
  const clauses=[];
  if(pos.length){
    const {subj,plural}=joinSubjects(pos);
    clauses.push(`${subj} ${plural?"aident":"aide"} concrètement l’élève`);
  }
  if(part.length){
    const {subj,plural}=joinSubjects(part);
    clauses.push(`${subj} ${plural?"aident":"aide"} partiellement l’élève`);
  }
  if(none.length){
    const {subj,plural}=joinSubjects(none);
    clauses.push(`${subj} ${plural?"n’ont pas apporté":"n’a pas apporté"} d’effet notable`);
  }
  if(other.length){
    const {subj,plural}=joinSubjects(other);
    clauses.push(`${subj} ${plural?"ont été mobilisés":"a été mobilisé"} en séance`);
  }
  return clauses.join(" ; ");
}

function buildSessionObservationSynthesis(log){
  const q2=log?.q2||{};
  const q3=log?.q3||{};
  const q4=extractSessionQ4Items(log);
  const q5=log?.q5||{};
  const q6=log?.q6||{};
  const lines=[];

  // 1. Niveau de réalisation et observations de fonctionnement (formulation fluide sans parenthèses)
  const obsItems=[];
  safeArray(q2.observations).forEach(item=>{
    const txt=String(item?.observation||item?.text||item?.label||"").trim();
    const lvl=formatPiaQ2LevelLabel(item?.niveau??item?.level);
    if(txt)obsItems.push(lvl?insertSessionFluidAdverb(txt,lvl):txt);
  });
  if(!obsItems.length&&q2.niveau!==undefined&&q2.niveau!==null&&String(q2.niveau).trim()!==""){
    const lvl=formatPiaQ2LevelLabel(q2.niveau);
    if(lvl)obsItems.push(`Réalise ${lvl.toLowerCase()} l’objectif de la séance`);
  }
  const q2Prec=String(q2.precision||q2.commentaire||"").trim();
  if(obsItems.length||q2Prec){
    const obsBody=[obsItems.join(" ; "),q2Prec].filter(Boolean).join(" — ");
    lines.push(`Réalisation et fonctionnement observés : ${obsBody.replace(/\.$/,"")}.`);
  }

  // 2. Processus et apprentissages mobilisés (formulation fluide sans parenthèses ni doublons sémantiques)
  const indMap=new Map();
  safeArray(q3.indicateurs).forEach(x=>{
    let rawTxt="",appRaw=null,extra="";
    if(typeof x==="string"){
      const det=q3.details?.[x]||{};
      const procs=safeArray(det.processus).filter(Boolean).join(", ");
      const prec=String(det.precision||"").trim();
      extra=[procs,prec].filter(Boolean).join(" — ");
      rawTxt=x;
      appRaw=det.appreciation;
    }else if(x?.texte){
      rawTxt=x.texte;
      appRaw=x.appreciation;
    }
    if(!rawTxt)return;
    const sKey=`${semanticSkillKeyV74(rawTxt)}::${formatPiaQ3Appreciation(appRaw)}`;
    const clause=formatSessionLearningClause(rawTxt,appRaw,extra);
    if(!clause)return;
    if(!indMap.has(sKey))indMap.set(sKey,clause);
    else if(clause.length>indMap.get(sKey).length)indMap.set(sKey,clause);
  });
  const indItems=[...indMap.values()];
  const rawWbe=String(q3.repereWBE?.signature||q3.repereWBE?.hit||"").trim();
  const wbe=rawWbe?(canonicalizeWbeChapter(rawWbe,log?.objectif?.objectifLecon||log?.identification?.objectif||"",log?.contexte?.matiere||log?.identification?.matiere||"")||cleanWbeRawToken(rawWbe)):"";
  const q3Prec=String(q3.precision||q3.commentaire||"").trim();
  if(indItems.length||wbe||q3Prec){
    const parts=[
      indItems.filter(Boolean).join(" ; "),
      wbe?`chapitre WBE : ${wbe}`:"",
      q3Prec
    ].filter(Boolean);
    lines.push(`Apprentissages et processus : ${parts.join(" — ").replace(/\.$/,"")}.`);
  }

  // 3. Aides, adaptations et effets constatés (formulation fluide : "la verbalisation aide partiellement l'élève")
  const q4Prec=String(log?.q4?.precision||log?.q4?.commentaire||"").trim();
  if(q4.length||q4Prec){
    const q4Text=formatSessionHelpClause(q4);
    const combined=[q4Text,q4Prec].filter(Boolean).join(" — ");
    lines.push(`Aides et adaptations mises en place : ${combined.replace(/\.$/,"")}.`);
  }

  // 4. Transfert et réinvestissement (uniquement lorsque le transfert apporte une information pertinente)
  const rawQ5=String(q5.statut||q5.observe||"").trim().toLowerCase();
  const isNonInformativeQ5=rawQ5==="no_opportunity"||rawQ5==="not_relevant"||rawQ5==="later"||rawQ5.includes("pas d’occasion")||rawQ5.includes("pas d'occasion")||rawQ5.includes("non pertinent")||rawQ5.includes("plus tard");
  const q5Lbl=isNonInformativeQ5?"":formatPiaQ5Status(q5.statut||q5.observe);
  const q5Ctx=safeArray(q5.contextes).filter(Boolean).join(", ");
  const q5Prec=String(q5.precision||q5.commentaire||"").trim();
  if(q5Lbl||q5Prec){
    const parts=[
      q5Lbl?`${q5Lbl}${q5Ctx?` en ${q5Ctx.toLowerCase()}`:""}`:"",
      q5Prec
    ].filter(Boolean);
    lines.push(`Transfert en contexte : ${parts.join(" — ").replace(/\.$/,"")}.`);
  }

  // 5. Suites prévues et concertation (sans jargon Q6)
  const q6Actions=safeArray(q6.actions).filter(Boolean);
  const q6Mod=String(q6.modalite||"").trim();
  const q6Obj=String(q6.objectif||"").trim();
  const q6Col=safeArray(q6.collaborations).filter(Boolean);
  const q6Prec=String(q6.precision||"").trim();
  if(q6Actions.length||q6Mod||q6Obj||q6Col.length||q6Prec){
    const parts=[
      q6Actions.length?q6Actions.join(", "):"",
      q6Obj?`objectif : ${q6Obj}`:"",
      q6Mod?`modalité : ${q6Mod}`:"",
      q6Col.length?`concertation : ${q6Col.join(", ")}`:"",
      q6Prec
    ].filter(Boolean);
    lines.push(`Suites prévues : ${parts.join(" · ").replace(/\.$/,"")}.`);
  }

  if(!lines.length){
    lines.push("Séance réalisée — aucune observation complémentaire renseignée.");
  }
  return lines;
}

function buildSessionsDocumentModel(sessions,student={},range={}){
  const list=safeArray(sessions);
  const studentName=String(student?.nom||list[0]?.identification?.eleve||"Élève").trim();
  const studentClass=String(student?.classe||list[0]?.identification?.niveau||"").trim();
  const studentSchool=String(student?.ecole||"").trim();
  const periodStr=(range?.start&&range?.end)?`Du ${formatSessionExportDate(range.start)} au ${formatSessionExportDate(range.end)}`:"Période sélectionnée";

  const blocks=[];
  blocks.push({
    type:"header_banner",
    kicker:"JOURNALIER D’ACCOMPAGNEMENT SPÉCIALISÉ · CAHIER DE SÉANCES",
    title:`Journalier des séances — ${studentName}`,
    subtitle:`${[studentClass,studentSchool].filter(Boolean).join(" · ")||"Suivi individuel et en classe"} · ${periodStr}`,
    statusBadge:`${list.length} séance${list.length>1?"s":""}`,
    statusTone:"info",
    metaRows:[
      ["Élève",studentName,"Classe / Niveau",studentClass||"Non renseigné"],
      ["Établissement",studentSchool||"Non renseigné","Période exportée",periodStr]
    ]
  });

  const textLines=[
    `Journalier des séances — ${studentName}`,
    `Période : ${periodStr} (${list.length} séance(s))`,
    ""
  ];

  list.forEach((log,idx)=>{
    const ident=log?.identification||{};
    const dateFormatted=formatSessionExportDate(ident.date||log?.date);
    const startP=ident.periodeStart||ident.periode||"";
    const endP=ident.periodeEnd||startP;
    const periodLabel=startP?(endP&&endP!==startP?`${startP} → ${endP}`:startP):"";
    const matiere=String(ident.matiere||log?.matiere||"").trim();
    const forme=String(ident.forme||ident.contexte||"").trim();
    const objLecon=String(log?.objectif?.objectifLecon||ident.objectif||"").trim();
    const objAgent=String(log?.objectif?.objectifProfessionnel||"").trim();

    const dateAndSlot=[dateFormatted,periodLabel,matiere,forme].filter(Boolean).join(" · ");
    const lessonTitle=[
      objLecon||"Objectif de la leçon non précisé",
      objAgent?`Objectif d’accompagnement : ${objAgent}`:""
    ].filter(Boolean).join(" — ");

    const obsLines=buildSessionObservationSynthesis(log);

    blocks.push({
      type:"table",
      title:`Séance ${idx+1} — ${dateFormatted}${matiere?` · ${matiere}`:""}`,
      colWidths:[28,72],
      headers:["CADRE 1 — INFORMATIONS DE LA SÉANCE",dateAndSlot],
      rows:[
        ["Date & créneau",[dateAndSlot]],
        ["Titre de la leçon / objectif du cours",[lessonTitle]],
        ["CADRE 2 — OBSERVATIONS",obsLines]
      ]
    });

    textLines.push(`Séance ${idx+1} — ${dateAndSlot}`);
    textLines.push("CADRE 1 — INFORMATIONS DE LA SÉANCE");
    textLines.push(`Date : ${dateAndSlot}`);
    textLines.push(`Titre de la leçon / objectif du cours : ${lessonTitle}`);
    textLines.push("CADRE 2 — OBSERVATIONS");
    obsLines.forEach(l=>textLines.push(`• ${l}`));
    textLines.push("");
  });

  return {
    isPIADocumentModel:true,
    deidentified:false,
    title:`Journalier des séances — ${studentName}`,
    schoolYear:"",
    studentName,
    statusLabel:`${list.length} séance(s)`,
    blocks,
    lines:textLines
  };
}

function exportSessionsDocument(filename,sessions,student={},range={},format="docx"){
  if(!["docx","pdf"].includes(format))throw new Error("Format d’export non pris en charge.");
  const list=safeArray(sessions);
  if(!list.length)throw new Error("Aucune séance à exporter.");
  const model=buildSessionsDocumentModel(list,student,range);
  const mime=format==="docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/pdf";
  downloadBytes(`${filename}.${format}`,format==="docx"?makeDocx(model):makePdf(model),mime);
  return model;
}

function downloadBytes(name,bytes,type){
  const safeName=typeof globalThis.sanitizeFilename==='function'?globalThis.sanitizeFilename(name):String(name||'document');
  const blob=new Blob([bytes],{type});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=safeName;
  if (typeof document !== "undefined" && document.body) {
    document.body.appendChild(a);
  }
  a.click();
  if (typeof a.remove === "function") {
    a.remove();
  }
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function buildOfficialPIAFileName(studentName, moment, schoolYear, format = "docx") {
  const normMoment = String(moment || "DECEMBRE").toUpperCase() === "FIN_ANNEE" ? "FIN_ANNEE" : "DECEMBRE";

  let year;
  const syMatch = String(schoolYear || "").trim().match(/^(\d{4})(?:-(\d{4}))?$/);
  if (syMatch) {
    const startYear = parseInt(syMatch[1], 10);
    const endYear = syMatch[2] ? parseInt(syMatch[2], 10) : startYear + 1;
    year = normMoment === "DECEMBRE" ? String(startYear) : String(endYear);
  } else {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const endYear = startYear + 1;
    year = normMoment === "DECEMBRE" ? String(startYear) : String(endYear);
  }

  /* eslint-disable no-control-regex */
  const cleanNom = String(studentName || "")
    .replace(/[/\\:*?"<>|\x00-\x1F\x7F]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  /* eslint-enable no-control-regex */

  const momentLabel = normMoment === "DECEMBRE" ? "décembre" : "fin d'année";

  const parts = ["PIA"];
  if (cleanNom) {
    parts.push(cleanNom);
  }
  parts.push(`${momentLabel} ${year}`);

  const ext = String(format || "docx").toLowerCase() === "pdf" ? "pdf" : "docx";
  return `${parts.join(" - ")}.${ext}`;
}

let isExportingOfficialPIA = false;

async function exportOfficialPIADocument(moment, format = "docx", deidentified = false) {
  if (isExportingOfficialPIA) return null;
  isExportingOfficialPIA = true;

  const normMoment = String(moment || "DECEMBRE").toUpperCase() === "FIN_ANNEE" ? "FIN_ANNEE" : "DECEMBRE";
  const isPdf = String(format || "docx").toLowerCase() === "pdf";
  const isDeid = Boolean(deidentified);

  try {
    // Lecture du PIA via V74.state interne en priorité (pas window.JournalierV74.state)
    let pia = V74.state || null;
    let currentData = null;
    try {
      currentData = typeof getData === "function" ? getData() : null;
    } catch (_) {
      currentData = null;
    }

    const sid = String(
      pia?.studentId ||
      (typeof document !== "undefined"
        ? (document.getElementById("v74-pia-student")?.value || document.getElementById("r-eleve")?.value)
        : "") ||
      ""
    );

    if (!pia && sid && currentData) {
      const rec = currentData.state?.meta?.piaRecords?.[sid];
      if (rec && rec.type === "PIA_ANNUEL") {
        pia = rec;
      }
    }
    pia = pia || V74.state || {};

    // Lecture de l'élève via getData() interne (pas window.getData)
    const student = (currentData?.students?.find(e => String(e.id || e.studentId) === sid || (sid && String(e.nom) === sid)))
      || (currentData?.state?.eleves?.find?.(e => String(e.id || e.studentId) === sid))
      || null;

    // Le nom de fichier doit contenir « Nom Prénom » ou « Élève 1 » si dé-identifié
    let studentName = "";
    const rawNom = String(student?.nom || pia?.identity?.nom || pia?.identity?.eleve || pia?.studentName || "").trim();
    const rawPrenom = String(student?.prenom || pia?.identity?.prenom || "").trim();
    if (rawNom && rawPrenom && !rawNom.toLowerCase().includes(rawPrenom.toLowerCase())) {
      studentName = `${rawNom} ${rawPrenom}`.trim();
    } else if (rawNom) {
      studentName = rawNom;
    } else if (rawPrenom) {
      studentName = rawPrenom;
    } else {
      studentName = String(pia?.studentName || "").trim();
    }

    // Si l'année scolaire est illisible, la déduire de la date du jour au lieu de 2026/2027 en dur
    let schoolYear = String(pia?.schoolYear || "").trim();
    if ((!schoolYear || !/^\d{4}(?:-\d{4})?$/.test(schoolYear)) && typeof document !== "undefined") {
      const dateInput = document.getElementById("v74-pia-date")?.value;
      if (dateInput && typeof piaSchoolYear === "function") {
        schoolYear = piaSchoolYear(dateInput);
      }
    }
    if (!schoolYear || !/^\d{4}(?:-\d{4})?$/.test(schoolYear)) {
      const todayISO = new Date().toISOString().slice(0, 10);
      schoolYear = (typeof piaSchoolYear === "function" ? piaSchoolYear(todayISO) : "") || (function() {
        const now = new Date();
        const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
        return `${start}-${start + 1}`;
      })();
    }

    const filenameStudent = isDeid ? "Élève 1" : studentName;
    const filename = buildOfficialPIAFileName(filenameStudent, normMoment, schoolYear, isPdf ? "pdf" : "docx");

    const piaWithStudent = {
      ...pia,
      moment: normMoment,
      studentId: isDeid ? "" : (sid || pia?.studentId),
      student: isDeid ? null : (student || pia?.student),
      administrativeInfo: isDeid ? null : (student?.administrativeInfo || pia?.administrativeInfo || student)
    };
    const docModel = buildOfficialPIADocumentModel(piaWithStudent, isDeid, { moment: normMoment });
    const bytes = isPdf ? await makeOfficialPdf(docModel) : await makeOfficialDocx(docModel);
    downloadBytes(
      filename,
      bytes,
      isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    window.showAppToast?.(`✓ Document « ${filename} » généré avec succès.`, "success", 3500);
    return { filename, bytes };
  } catch (err) {
    console.error("Erreur export officiel PIA :", err);
    window.showAppToast?.("⚠️ Erreur lors de l’export officiel : " + (err?.message || err), "error", 5000);
    throw err;
  } finally {
    isExportingOfficialPIA = false;
  }
}
function exportTextDocument(filename,content,format="docx"){
  if(!["docx","pdf"].includes(format))throw new Error("Format d’export non pris en charge.");
  const lines=String(content||"").replace(/\r/g,"").split("\n");
  if(!lines.some(line=>line.trim()))throw new Error("Le document ne contient aucun contenu à exporter.");
  const mime=format==="docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/pdf";
  downloadBytes(`${filename}.${format}`,format==="docx"?makeDocx(lines):makePdf(lines),mime);
}
function htmlPIA(pia){return `<pre style="white-space:pre-wrap;font:14px Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.55">${esc(piaTextSections(pia,false).join("\\n"))}</pre>`;}

function clearPIAResult(){
  const box=document.getElementById("v74-pia-result");
  if(box) box.innerHTML="";
  V74.ui.piaDisplayStudentId="";
  V74.ui.piaDisplayMode="none";
  V74.ui.piaDraftStudentId="";
  V74.ui.piaDraftPersisted=false;
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
function renderAmenagementsEditor(pia, key) {
  const isMeeting1 = key === "meeting1";
  const rawList = isMeeting1
    ? safeArray(pia?.amenagements)
    : safeArray(pia?.meeting2?.amenagementsRentree);
  const items = rawList.map((it, idx) => normalizeStructuredAmenagement(it, idx));

  const rowsHtml = items.length
    ? items.map((item, index) => {
        const desc = item.description || item.texte || "";
        return `<div class="v74-amenagement-row" data-v74-amenagement-row="${index}" data-v74-meeting="${key}">
          <div class="v74-amenagement-row-top">
            <span class="v74-amenagement-badge" title="Aménagement n°${index + 1}">${index + 1}</span>
            <div class="v74-amenagement-col-actions">
              <button type="button" class="v74-btn-icon v74-btn-move-up" data-v74-amenagement-move="up" data-v74-index="${index}" data-v74-meeting="${key}" title="Monter cet aménagement" ${index === 0 ? "disabled" : ""}>▲</button>
              <button type="button" class="v74-btn-icon v74-btn-move-down" data-v74-amenagement-move="down" data-v74-index="${index}" data-v74-meeting="${key}" title="Descendre cet aménagement" ${index === items.length - 1 ? "disabled" : ""}>▼</button>
              <button type="button" class="v74-btn-icon v74-btn-icon-delete" data-v74-amenagement-delete="${index}" data-v74-meeting="${key}" title="Supprimer cet aménagement">✕</button>
            </div>
          </div>
          <div class="v74-amenagement-col-pom" role="group" aria-label="Types d’aménagement P / O / M">
            <label class="v74-pom-toggle v74-pom-toggle-p ${item.p ? "is-checked" : ""}" title="Pédagogique (P)">
              <input type="checkbox" class="v74-pom-cb" data-v74-amenagement-field="p" data-v74-index="${index}" data-v74-meeting="${key}" ${item.p ? "checked" : ""}>
              <span class="v74-pom-toggle-label">P</span>
            </label>
            <label class="v74-pom-toggle v74-pom-toggle-o ${item.o ? "is-checked" : ""}" title="Organisationnel (O)">
              <input type="checkbox" class="v74-pom-cb" data-v74-amenagement-field="o" data-v74-index="${index}" data-v74-meeting="${key}" ${item.o ? "checked" : ""}>
              <span class="v74-pom-toggle-label">O</span>
            </label>
            <label class="v74-pom-toggle v74-pom-toggle-m ${item.m ? "is-checked" : ""}" title="Matériel (M)">
              <input type="checkbox" class="v74-pom-cb" data-v74-amenagement-field="m" data-v74-index="${index}" data-v74-meeting="${key}" ${item.m ? "checked" : ""}>
              <span class="v74-pom-toggle-label">M</span>
            </label>
          </div>
          <div class="v74-amenagement-col-desc">
            <textarea rows="2" class="v74-amenagement-desc-input" data-v74-amenagement-field="description" data-v74-index="${index}" data-v74-meeting="${key}" placeholder="Description de l’aménagement raisonnable…" maxlength="2000">${esc(desc)}</textarea>
          </div>
        </div>`;
      }).join("")
    : `<div class="v74-amenagements-empty">Aucun aménagement renseigné à ce stade. Cliquez sur « + Ajouter un aménagement » ci-dessous.</div>`;

  return `<div class="v74-amenagements-container" data-v74-meeting-amenagements="${key}">
    <div class="v74-amenagements-header">
      <div class="v74-amenagements-title-block">
        <span class="v74-amenagements-main-title">Aménagements raisonnables ${isMeeting1 ? "(décembre — T5)" : "(rentrée suivante — T8)"}</span>
        <span class="v74-amenagements-hint">P = Pédagogique · O = Organisationnel · M = Matériel (cases à cocher, combinaisons multiples ou aucune)</span>
      </div>
      ${!isMeeting1 ? `
        <button type="button" class="v74-btn v74-btn-secondary v74-btn-copy-dec" id="v74-copy-dec-btn" data-jr-handlers="h86" data-v74-action="copy-december-amenagements" title="Reprendre la liste des aménagements validés en réunion 1 de décembre">
          📋 Reprendre les aménagements de décembre
        </button>
      ` : ""}
    </div>
    <div class="v74-amenagements-list" data-v74-amenagements-list="${key}">
      ${rowsHtml}
    </div>
    <div class="v74-amenagements-footer">
      <button type="button" class="v74-btn v74-btn-outline v74-btn-add-amenagement" data-v74-add-amenagement="${key}">
        + Ajouter un aménagement
      </button>
    </div>
  </div>`;
}

async function copyDecemberAmenagementsToMeeting2(piaObj) {
  let targetPia = piaObj;
  if (!targetPia && typeof window !== "undefined") {
    targetPia = window.__v74_active_pia || window.JournalierV74?.activePIA || null;
  }
  if (!targetPia && typeof window !== "undefined" && typeof window.getActivePIA === "function") {
    targetPia = window.getActivePIA();
  }
  if (!targetPia && typeof getData === "function") {
    const studentId = document.getElementById("student-modal-id")?.value;
    if (studentId) {
      const allPias = window.JournalierDataStore?.getState?.()?.meta?.piaRecords || {};
      targetPia = allPias[studentId] || null;
    }
  }
  if (!targetPia) return;

  const decList = safeArray(targetPia.amenagements).filter(a => Boolean(a.p || a.o || a.m || String(a.description || a.texte || "").trim()));
  if (!decList.length) {
    window.showAppToast?.("Aucun aménagement renseigné en réunion 1 (décembre) à reprendre.", "info", 3500);
    return;
  }

  targetPia.meeting2 ??= {};
  // Deep copy to ensure meeting 1 is NOT mutated
  targetPia.meeting2.amenagementsRentree = decList.map((item, idx) => ({
    id: `amenagement_rentree_${idx + 1}_${Date.now()}`,
    n: idx + 1,
    labelN: `${idx + 1}\u00A0`,
    p: Boolean(item.p),
    o: Boolean(item.o),
    m: Boolean(item.m),
    description: String(item.description || item.texte || ""),
    texte: String(item.description || item.texte || ""),
    type: item.type || [item.p ? "P" : "", item.o ? "O" : "", item.m ? "M" : ""].filter(Boolean).join("+"),
    effetDocumente: item.effetDocumente || "",
    suitePrevue: item.suitePrevue || "",
    referentielId: item.referentielId || null
  }));
  targetPia.meeting2.adaptations = formatStructuredAmenagementsSummary(targetPia.meeting2.amenagementsRentree);

  try {
    await persistPIAEdit(targetPia);
    render(targetPia);
    window.showAppToast?.(`✓ ${targetPia.meeting2.amenagementsRentree.length} aménagement(s) de décembre repris pour la rentrée.`, "success", 3500);
  } catch (e) {
    window.showAppToast?.("⚠️ Impossible d’enregistrer la reprise des aménagements : " + (e?.message || e), "error", 4500);
  }
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
      ${renderAmenagementsEditor(pia, key)}
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

function setPIASection(box,name){
  const tabs=[...box.querySelectorAll("[data-v74-pia-tab]")],panels=[...box.querySelectorAll("[data-v74-pia-panel]")];
  const active=tabs.find(tab=>tab.dataset.v74PiaTab===name);if(!active)return;
  tabs.forEach(tab=>{const selected=tab===active;tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;});
  panels.forEach(panel=>{panel.hidden=panel.dataset.v74PiaPanel!==name;});
}
function bindPIASectionTabs(box){
  const nav=box.querySelector(".v74-pia-nav");if(!nav)return;
  nav.addEventListener("click",event=>{const tab=event.target.closest("[data-v74-pia-tab]");if(tab)setPIASection(box,tab.dataset.v74PiaTab);});
  nav.addEventListener("keydown",event=>{
    const tabs=[...nav.querySelectorAll("[data-v74-pia-tab]")],index=tabs.indexOf(document.activeElement);if(index<0)return;
    let next;if(event.key==="ArrowRight")next=(index+1)%tabs.length;else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=tabs.length-1;else return;
    event.preventDefault();tabs[next].focus();setPIASection(box,tabs[next].dataset.v74PiaTab);
  });
}
function loadExistingPIAForSelectedStudent(){
  try{
    const sid=document.getElementById("v74-pia-student")?.value;
    if(!sid)return false;
    const d=getData();
    const stored=d.state.meta?.piaRecords?.[sid]||null;
    if(!stored||stored.type!=="PIA_ANNUEL")return false;
    const until=document.getElementById("v74-pia-date")?.value||new Date().toISOString().slice(0,10);
    const schoolYear=piaSchoolYear(until);
    if(stored.schoolYear&&schoolYear&&stored.schoolYear!==schoolYear)return false;
    V74.state=stored;
    V74.ui.piaDisplayStudentId=String(sid);
    V74.ui.piaDisplayMode=["EN_VIGUEUR","ACTIF","FINALISE"].includes(stored.lifecycle)?"active":(stored.lifecycle==="EN_REEVALUATION"?"review":"draft");
    V74.ui.piaDraftStudentId=stored.lifecycle==="EN_CONSTRUCTION"?String(sid):"";
    V74.ui.piaDraftPersisted=true;
    render(stored);
    return true;
  }catch(_){
    /* la cause de l'échec est volontairement ignorée pour retourner false */
    return false;
  }
}
function requestPIASection(name){
  if(!["domains","proposals","meetings","tracking","document"].includes(name))return false;
  V74.ui??={};V74.ui.pendingSection=name;
  const box=document.getElementById("v74-pia-result");
  if(!box?.querySelector("[data-v74-pia-tab]")){
    if(!loadExistingPIAForSelectedStudent()){
      const sid=document.getElementById("v74-pia-student")?.value;
      if(sid)run(false);
    }
  }
  if(box?.querySelector("[data-v74-pia-tab]")){
    setPIASection(box,name);
    V74.ui.pendingSection="";
    return true;
  }
  return false;
}
function render(pia){
  const box=document.getElementById("v74-pia-result");
  if(!box)return;
  if(typeof window!=="undefined"){
    window.__v74_active_pia = pia;
  }
  V74.activePIA = pia;
  const activeSection=V74.ui?.pendingSection||box.querySelector('[data-v74-pia-tab][aria-selected="true"]')?.dataset.v74PiaTab||"domains";
  if(V74.ui?.pendingSection)V74.ui.pendingSection="";

  const imported=pia.sourceContinuity?.present?importedSummaryHtml(pia.sourceContinuity):"";
  const limitedEvidence=Number(pia.sessionsAnalysed||0)<3;
  const statusLabel=piaStatusLabel(pia);
  const statusClass=["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)?"is-success":"is-warning";

  const evidenceNotice=limitedEvidence
    ? `<div class="v74-notice v74-notice-warning">
         ⚠️ Éléments encore limités : le projet repose sur un nombre réduit de séances.
         Il doit être considéré comme un projet à examiner et non comme une évaluation annuelle complète.
       </div>`
    : "";

  const proposals=safeArray(pia.propositions);
  const counts=getPIADecisionCounts(pia);
  const domains=safeArray(pia.sections);
  const storedDomainIndex=box.dataset.v74ActiveDomain;
  const activeDomainIndex=storedDomainIndex!==undefined&&storedDomainIndex!==""?Number(storedDomainIndex):-1;
  const activeDomain=Number.isInteger(activeDomainIndex)?domains[activeDomainIndex]:null;
  const domainOverview=domains.map((section,index)=>{
    const objectives=piaDomainObjectives(pia,section);
    const needs=safeArray(section.difficultes).length,means=safeArray(section.moyens).length;
    return `<button type="button" class="v74-domain-overview tone-${piaDomainTone(section.aspect)}" data-v74-domain-jump="${index}" aria-label="Afficher le domaine ${esc(section.aspect||"")} et son détail"><span class="v74-domain-icon">${piaDomainIcon(section.aspect,index)}</span><strong>${esc(section.aspect||"Domaine")}</strong><span class="v74-domain-metrics"><span><b>${needs}</b> besoins</span><span><b>${objectives.length}</b> objectifs</span><span><b>${means}</b> moyens</span></span><span class="v74-domain-action">Consulter le domaine <span aria-hidden="true">›</span></span></button>`;
  }).join("");
  const domainDetail=activeDomain?`<div class="v74-domain-detail-view" id="v74-domain-detail-view">
    <button type="button" class="v74-domain-back" data-v74-domain-back>‹ Tous les domaines</button>
    <div class="v74-domain-detail-layout">
      <nav class="v74-domain-menu" aria-label="Choisir un domaine">${domains.map((section,index)=>`<button type="button" data-v74-domain-select="${index}" aria-current="${index===activeDomainIndex?"true":"false"}">${esc(section.aspect||"Domaine")}</button>`).join("")}</nav>
      ${piaDomainCard(pia,activeDomain,activeDomainIndex)}
    </div>
  </div>`:"";

  box.innerHTML=`
    <div class="v74-summary">
      <div class="v74-summary-main">
        <span class="v74-status-badge ${statusClass}">${esc(statusLabel)}</span>
      </div>
      <span>${Number(pia.sessionsAnalysed||0)} séance(s) analysée(s)</span>
      <span>${counts.total} proposition(s) · ${counts.validated} validée(s) · ${counts.refused} refusée(s) · ${counts.pending} à examiner</span>
    </div>

    ${imported}
    ${evidenceNotice}

    <div class="v74-notice">
      Les objectifs existants sont conservés comme continuité.
      Les nouvelles formulations sont des <b>PROPOSITIONS</b> : valider une proposition la retient dans le projet, mais seule l’action globale <b>« Mettre en vigueur le PIA annuel »</b> engage officiellement le PIA.
    </div>

    <nav class="v74-pia-nav" role="tablist" aria-label="Sections du PIA annuel" aria-orientation="horizontal">
      <button type="button" role="tab" id="v74-tab-domains" aria-controls="v74-panel-domains" aria-selected="true" tabindex="0" data-v74-pia-tab="domains">Domaines</button>
      <button type="button" role="tab" id="v74-tab-proposals" aria-controls="v74-panel-proposals" aria-selected="false" tabindex="-1" data-v74-pia-tab="proposals">Propositions <span>${proposals.length}</span></button>
      <button type="button" role="tab" id="v74-tab-meetings" aria-controls="v74-panel-meetings" aria-selected="false" tabindex="-1" data-v74-pia-tab="meetings">Réunions</button>
      <button type="button" role="tab" id="v74-tab-tracking" aria-controls="v74-panel-tracking" aria-selected="false" tabindex="-1" data-v74-pia-tab="tracking">Suivi annuel</button>
      <button type="button" role="tab" id="v74-tab-document" aria-controls="v74-panel-document" aria-selected="false" tabindex="-1" data-v74-pia-tab="document">Aperçu du document</button>
    </nav>

    <section class="v74-pia-panel v74-domain-section" id="v74-panel-domains" role="tabpanel" aria-labelledby="v74-tab-domains" tabindex="0" data-v74-pia-panel="domains">
      <div class="v74-domain-overview-view" ${activeDomain?"hidden":""}>
        <h3>Les cinq domaines</h3>
        ${domains.length?`<div class="v74-domain-overview-grid">${domainOverview}</div>`:'<p class="v74-empty">Aucun domaine disponible pour ce PIA.</p>'}
      </div>
      ${domainDetail}
    </section>

    <section class="v74-pia-panel" id="v74-panel-proposals" role="tabpanel" aria-labelledby="v74-tab-proposals" tabindex="0" data-v74-pia-panel="proposals" hidden>
      ${
      proposals.length
      ? `<div class="v74-proposals-summary-bar" role="status" aria-live="polite">
          <span class="v74-prop-counter is-pending"><b>${counts.pending}</b> À examiner</span>
          <span class="v74-prop-counter is-validated"><b>${counts.validated}</b> Validée(s)</span>
          <span class="v74-prop-counter is-refused"><b>${counts.refused}</b> Refusée(s)</span>
        </div>
        <div class="v74-proposals">
          ${proposals.map((p,i)=>{
            const status=p.decisionStatus||"A_EXAMINER";
            const propStatusLabel={A_EXAMINER:"À examiner",VALIDEE:"Validée",REFUSEE:"Refusée"}[status]||"À examiner";
            const propStatusClass={A_EXAMINER:"is-pending",VALIDEE:"is-validated",REFUSEE:"is-refused"}[status]||"is-pending";
            const contributors=groupOccurrencesBySubjectAndChapterV74(safeArray(p.evidence));
            const contextTree=safeArray(p.contextTree).length?safeArray(p.contextTree):buildProposalContextTreeV74(p);
            const treeHtml=contextTree.length
              ? `<div class="v74-prop-tree">${contextTree.map(fg=>`<div><strong>${esc(fg.subject)} :</strong><ul>${safeArray(fg.chapters).map(ch=>`<li><span>- ${esc(ch.chapter)}${safeArray(ch.dates).length?` (${esc(ch.dates.join(", "))})`:""}</span>${safeArray(ch.skills).length?`<ul>${safeArray(ch.skills).map(sk=>`<li>* ${esc(sk)}</li>`).join("")}</ul>`:""}</li>`).join("")}</ul></div>`).join("")}</div>`
              : (p.constatContextualise?`<p><strong>Constat situé :</strong> ${esc(p.constatContextualise)}</p>`:"");
            const isEditable=status==="A_EXAMINER";
            let actionButtons;
            if(status==="A_EXAMINER"){
              actionButtons=`<div class="v74-prop-actions">
                <button type="button" class="v74-btn v74-btn-neutral" data-v74-proposal-save="${i}">Enregistrer la formulation</button>
                <button type="button" class="v74-btn v74-btn-success" data-v74-proposal-accept="${i}">✓ Valider la proposition</button>
                <button type="button" class="v74-btn v74-btn-danger" data-v74-proposal-reject="${i}">✕ Refuser</button>
              </div>`;
            }else if(status==="VALIDEE"){
              actionButtons=`<div class="v74-prop-actions">
                <button type="button" class="v74-btn v74-btn-neutral" data-v74-proposal-reopen="${i}">✎ Modifier / Remettre à examiner</button>
                <button type="button" class="v74-btn v74-btn-danger" data-v74-proposal-reject="${i}">✕ Refuser</button>
              </div>`;
            }else{
              actionButtons=`<div class="v74-prop-actions">
                <button type="button" class="v74-btn v74-btn-neutral" data-v74-proposal-reopen="${i}">↺ Remettre à examiner</button>
                <button type="button" class="v74-btn v74-btn-success" data-v74-proposal-accept="${i}">✓ Valider la proposition</button>
              </div>`;
            }
            return `<article class="v74-prop ${propStatusClass}">
              <div class="v74-prop-top">
                <label class="v74-prop-check" aria-label="Sélectionner la proposition ${i+1}">
                  <input type="checkbox" data-v74-prop="${i}" ${isEditable?"":"disabled"}>
                  <span class="v74-prop-heading">
                    <span class="v74-prop-title">${esc(p.theme||"Proposition PIA")}</span>
                    <span class="v74-prop-aspect">${esc(p.aspect||"")}</span>
                  </span>
                </label>
                <span class="v74-prop-state ${propStatusClass}">${propStatusLabel}</span>
              </div>
              <div class="v74-prop-body">
                <label class="v74-prop-edit"><span>Formulation de l’objectif proposé ${isEditable?"":"(verrouillée — remettre à examiner pour modifier)"}</span><textarea rows="3" data-prop-text data-v74-prop-formulation="${i}" ${isEditable?"":"readonly"}>${esc(p.formulation||"")}</textarea></label>
                <div class="v74-prop-meta">
                  
                  <span>${Number(p.sessionCount||0)} séance(s) contributrice(s)</span>
                  ${p.counterEvidence ? "<span class='v74-badge-warning'>Variabilité / contre-évidence</span>" : ""}
                </div>
                ${(contributors.length||treeHtml||safeArray(p.criteresObservable).length||safeArray(p.moyensAssocies).length)?`<details class="v74-prop-details"><summary>Plus de détails (${Number(p.sessionCount||contributors.length)} séance${Number(p.sessionCount||contributors.length)>1?"s":""})</summary><div class="v74-prop-details-body">${treeHtml}${safeArray(p.criteresObservable).length?`<p><strong>Critères / processus :</strong> ${esc(safeArray(p.criteresObservable).join(" ; "))}</p>`:""}${safeArray(p.moyensAssocies).length?`<p><strong>Moyens / suites :</strong> ${esc(safeArray(p.moyensAssocies).join(" · "))}</p>`:""}${contributors.length?`<div class="v74-prop-dates"><strong>Séances par chapitre :</strong> ${contributors.map(item=>`<span>${esc(item)}</span>`).join(" · ")}</div>`:""}</div></details>`:""}
                ${actionButtons}
              </div>
            </article>`;
          }).join("")}
        </div>`
      : `<p class="v74-empty">
           Aucune convergence suffisante pour formuler une proposition PIA.
           Les observations restent disponibles dans les séances.
         </p>`
      }

      ${
      !["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)
      ? `<div class="v74-action-group v74-action-validation">
           <div class="v74-action-title">Décision par lot & Mise en vigueur du PIA annuel</div>
           <p class="v74-validation-help">
             Valider une proposition la retient dans les objectifs du projet sans activer le PIA complet.
             Lorsque votre examen est terminé, cliquez sur <b>« Mettre en vigueur le PIA annuel »</b>.
           </p>
           <div class="v74-actions">
             ${counts.pending>0?`<button type="button" id="v74-batch-accept" class="v74-btn v74-btn-neutral">✓ Valider les propositions cochées (sans mettre en vigueur)</button>`:""}
             <button type="button" id="v74-validate" class="v74-btn v74-btn-success">
               ✓ Mettre en vigueur le PIA annuel
             </button>
           </div>
         </div>`
      : `<div class="v74-action-group v74-action-validation">
           <div class="v74-action-title">Statut du PIA annuel</div>
           <p class="v74-validation-help">Ce PIA annuel est actuellement <b>${esc(statusLabel.toLowerCase())}</b> (${counts.validated} proposition(s) validée(s)).</p>
         </div>`
      }
    </section>

    <section class="v74-pia-panel v74-meetings-section" id="v74-panel-meetings" role="tabpanel" aria-labelledby="v74-tab-meetings" tabindex="0" data-v74-pia-panel="meetings" hidden>
      <h3>Réunion de décembre</h3>
      ${piaMeetingEditor(pia,"meeting1","Réunion de décembre","REUNION_1_DECEMBRE")}
      <h3>Réunion de fin d’année</h3>
      ${piaMeetingEditor(pia,"meeting2","Réunion de fin d’année","REUNION_2_FIN_ANNEE")}
      ${pia.lifecycle==="EN_REEVALUATION"?`<div class="v74-actions"><button type="button" id="v74-review-confirm" class="v74-btn v74-btn-success">Confirmer la réévaluation et maintenir en vigueur</button></div>`:""}
      ${pia.lifecycle==="EN_VIGUEUR"&&pia.meeting2?.status==="REEVALUATION_VALIDEE"?`<div class="v74-actions"><button type="button" id="v74-finalize" class="v74-btn v74-btn-primary">Finaliser l’année</button></div>`:""}
    </section>

    <section class="v74-pia-panel" id="v74-panel-tracking" role="tabpanel" aria-labelledby="v74-tab-tracking" tabindex="0" data-v74-pia-panel="tracking" hidden>
      ${piaAnnualTracking(pia)}
    </section>

    <section class="v74-pia-panel" id="v74-panel-document" role="tabpanel" aria-labelledby="v74-tab-document" tabindex="0" data-v74-pia-panel="document" hidden>
      ${piaDocumentPreviewHtml(pia)}
    </section>

    <details class="v74-export-disclosure">
      <summary>Exporter le PIA</summary>
      <div class="v74-action-group v74-action-export">
        <div class="v74-action-title">Formats d’export</div>

      <div class="v74-export-row">
        <label>
          Format d’export
          <select id="v74-export-format">
            <option value="docx">Word (.docx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
        </label>

        <button id="v74-export-prof" class="v74-btn v74-btn-primary">
          Dossier de travail détaillé (usage interne)
        </button>

        <button id="v74-export-deid" class="v74-btn v74-btn-neutral">
          Exporter le modèle dé-identifié
        </button>
      </div>

      <div class="v74-actions">
        <button id="v74-json" class="v74-btn v74-btn-primary">
          Export JSON professionnel
        </button>

        <button id="v74-deid-json" class="v74-btn v74-btn-neutral">
          Export JSON dé-identifié
        </button>
      </div>
      </div>
    </details>

    <details class="v74-export-disclosure v74-management-disclosure">
      <summary>Actions sur le projet</summary>
      <div class="v74-action-group v74-action-management">
        <div class="v74-action-title">Projet</div>

      <div class="v74-actions">
        <button id="v74-close" class="v74-btn v74-btn-neutral">
          Fermer
        </button>

        ${
          ["ACTIF","EN_VIGUEUR","FINALISE"].includes(pia.lifecycle)
          ? `<button id="v74-delete" class="v74-btn v74-btn-danger">
               Supprimer le PIA annuel
             </button>`
          : `<button id="v74-cancel" class="v74-btn v74-btn-neutral">
               Annuler le projet
             </button>`
        }
      </div>
      </div>
    </details>
  `;

  bindPIASectionTabs(box);
  setPIASection(box,activeSection);

  box.querySelectorAll("[data-v74-domain-index]").forEach(field=>field.addEventListener("change",async()=>{
    const section=pia.sections[Number(field.dataset.v74DomainIndex)],key=field.dataset.v74DomainField;
    if(!section||!PIA_DOMAIN_FIELDS.some(([fieldKey])=>fieldKey===key))return;
    section[key]=field.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    try{await persistPIAEdit(pia);window.showAppToast?.("Modifications du domaine enregistrées.","success",2200);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v74-meeting-field]").forEach(field=>field.addEventListener("change",async()=>{
    const meeting=pia[field.dataset.v74Meeting],path=String(field.dataset.v74MeetingField||"").split("."),leaf=path.pop();
    if(!meeting||!leaf)return;
    let target=meeting;path.forEach(key=>{target[key]??={};target=target[key];});target[leaf]=field.value;meeting.source="REUNION";meeting.updatedAt=new Date().toISOString();
    try{await persistPIAEdit(pia);if(leaf==="date")render(pia);window.showAppToast?.("Éléments de réunion enregistrés.","success",2200);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v74-participant]").forEach(field=>field.addEventListener("change",async()=>{
    const meeting=pia[field.dataset.v74Meeting];if(!meeting)return;
    meeting.participants??={};meeting.participants[field.dataset.v74Participant]=field.checked;meeting.source="REUNION";meeting.updatedAt=new Date().toISOString();
    try{await persistPIAEdit(pia);render(pia);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));

  // Gestionnaires pour la liste éditable d'aménagements raisonnables (P/O/M)
  box.querySelectorAll("[data-v74-amenagement-field]").forEach(field => {
    if (field.type === "checkbox") {
      field.addEventListener("change", async () => {
        const meetingKey = field.dataset.v74Meeting;
        const index = Number(field.dataset.v74Index);
        const prop = field.dataset.v74AmenagementField;
        const list = meetingKey === "meeting1"
          ? (pia.amenagements ??= [])
          : ((pia.meeting2 ??= {}).amenagementsRentree ??= []);
        if (!list[index]) list[index] = normalizeStructuredAmenagement(null, index);
        list[index][prop] = field.checked;
        const activeCodes = [list[index].p ? "P" : "", list[index].o ? "O" : "", list[index].m ? "M" : ""].filter(Boolean);
        list[index].type = activeCodes.join("+") || (list[index].p ? "P" : (list[index].o ? "O" : (list[index].m ? "M" : "")));
        const labelEl = field.closest(".v74-pom-toggle");
        if (labelEl) labelEl.classList.toggle("is-checked", field.checked);

        const validItems = filterValidStructuredAmenagements(list);
        if (meetingKey === "meeting1") {
          pia.meeting1 ??= {};
          pia.meeting1.adaptations = formatStructuredAmenagementsSummary(validItems);
        } else {
          pia.meeting2 ??= {};
          pia.meeting2.adaptations = formatStructuredAmenagementsSummary(validItems);
        }

        try {
          await persistPIAEdit(pia);
        } catch (e) {
          window.showAppToast?.("⚠️ Enregistrement impossible : " + (e?.message || e), "error", 4500);
        }
      });
    } else {
      field.addEventListener("change", async () => {
        const meetingKey = field.dataset.v74Meeting;
        const index = Number(field.dataset.v74Index);
        const list = meetingKey === "meeting1"
          ? (pia.amenagements ??= [])
          : ((pia.meeting2 ??= {}).amenagementsRentree ??= []);
        if (!list[index]) list[index] = normalizeStructuredAmenagement(null, index);
        list[index].description = field.value.trim();
        list[index].texte = field.value.trim();

        const validItems = filterValidStructuredAmenagements(list);
        if (meetingKey === "meeting1") {
          pia.meeting1 ??= {};
          pia.meeting1.adaptations = formatStructuredAmenagementsSummary(validItems);
        } else {
          pia.meeting2 ??= {};
          pia.meeting2.adaptations = formatStructuredAmenagementsSummary(validItems);
        }

        try {
          await persistPIAEdit(pia);
          window.showAppToast?.("Aménagement enregistré.", "success", 1800);
        } catch (e) {
          window.showAppToast?.("⚠️ Enregistrement impossible : " + (e?.message || e), "error", 4500);
        }
      });
    }
  });

  box.querySelectorAll("[data-v74-add-amenagement]").forEach(button => {
    button.addEventListener("click", async () => {
      const meetingKey = button.dataset.v74AddAmenagement;
      const list = meetingKey === "meeting1"
        ? (pia.amenagements ??= [])
        : ((pia.meeting2 ??= {}).amenagementsRentree ??= []);
      const newIndex = list.length;
      list.push({
        id: `amenagement_${Date.now()}_${newIndex + 1}`,
        n: newIndex + 1,
        labelN: `${newIndex + 1}\u00A0`,
        p: false,
        o: false,
        m: false,
        description: "",
        texte: "",
        type: "",
        referentielId: null
      });
      try {
        await persistPIAEdit(pia);
        render(pia);
        const lastRow = box.querySelector(`[data-v74-amenagements-list="${meetingKey}"] [data-v74-amenagement-row="${newIndex}"] textarea`);
        lastRow?.focus();
        window.showAppToast?.("Nouvel aménagement ajouté.", "info", 1800);
      } catch (e) {
        window.showAppToast?.("⚠️ Erreur lors de l’ajout : " + (e?.message || e), "error", 4500);
      }
    });
  });

  box.querySelectorAll("[data-v74-amenagement-move]").forEach(button => {
    button.addEventListener("click", async () => {
      const meetingKey = button.dataset.v74Meeting;
      const dir = button.dataset.v74AmenagementMove;
      const index = Number(button.dataset.v74Index);
      const list = meetingKey === "meeting1"
        ? (pia.amenagements ??= [])
        : ((pia.meeting2 ??= {}).amenagementsRentree ??= []);
      const targetIndex = dir === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      list.forEach((it, idx) => {
        it.n = idx + 1;
        it.labelN = `${idx + 1}\u00A0`;
      });
      try {
        await persistPIAEdit(pia);
        render(pia);
      } catch (e) {
        window.showAppToast?.("⚠️ Erreur lors du déplacement : " + (e?.message || e), "error", 4500);
      }
    });
  });

  box.querySelectorAll("[data-v74-amenagement-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const meetingKey = button.dataset.v74Meeting;
      const index = Number(button.dataset.v74AmenagementDelete);
      const list = meetingKey === "meeting1"
        ? (pia.amenagements ??= [])
        : ((pia.meeting2 ??= {}).amenagementsRentree ??= []);
      if (!list[index]) return;
      list.splice(index, 1);
      list.forEach((it, idx) => {
        it.n = idx + 1;
        it.labelN = `${idx + 1}\u00A0`;
      });
      const validItems = filterValidStructuredAmenagements(list);
      if (meetingKey === "meeting1") {
        pia.meeting1 ??= {};
        pia.meeting1.adaptations = formatStructuredAmenagementsSummary(validItems);
      } else {
        pia.meeting2 ??= {};
        pia.meeting2.adaptations = formatStructuredAmenagementsSummary(validItems);
      }
      try {
        await persistPIAEdit(pia);
        render(pia);
        window.showAppToast?.("Aménagement retiré.", "info", 1800);
      } catch (e) {
        window.showAppToast?.("⚠️ Erreur lors de la suppression : " + (e?.message || e), "error", 4500);
      }
    });
  });

  box.querySelectorAll("[data-v74-action='copy-december-amenagements']").forEach(button => {
    button.addEventListener("click", async () => {
      await copyDecemberAmenagementsToMeeting2(pia);
    });
  });
  const showDomain=index=>{
    if(!Number.isInteger(index)||!domains[index])return;
    box.dataset.v74ActiveDomain=String(index);
    render(pia);
    box.querySelector(`[data-v74-domain-select="${index}"]`)?.focus();
  };
  box.querySelectorAll("[data-v74-domain-jump]").forEach(button=>button.addEventListener("click",()=>showDomain(Number(button.dataset.v74DomainJump))));
  box.querySelectorAll("[data-v74-domain-select]").forEach(button=>button.addEventListener("click",()=>showDomain(Number(button.dataset.v74DomainSelect))));
  box.querySelector("[data-v74-domain-back]")?.addEventListener("click",()=>{
    box.dataset.v74ActiveDomain="";
    render(pia);
    box.querySelector("[data-v74-domain-jump]")?.focus();
  });
  box.querySelectorAll("[data-v74-proposal-save]").forEach(button=>button.addEventListener("click",async()=>{
    const index=Number(button.dataset.v74ProposalSave),proposal=pia.propositions[index],field=box.querySelector(`[data-v74-prop-formulation="${index}"]`),formulation=String(field?.value||"").trim();
    if(!proposal||!formulation){window.showAppToast?.("La formulation ne peut pas être vide.","info",3000);return;}
    if((proposal.decisionStatus||"A_EXAMINER")!=="A_EXAMINER"){
      window.showAppToast?.("Remettez d’abord la proposition « À examiner » pour modifier sa formulation.","info",3500);
      return;
    }
    proposal.formulation=formulation;
    try{await persistPIAEdit(pia,true);render(pia);window.showAppToast?.("Formulation enregistrée.","success",2500);}catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v74-proposal-accept],[data-v74-proposal-reject]").forEach(button=>button.addEventListener("click",async()=>{
    const accepting=button.hasAttribute("data-v74-proposal-accept"),index=Number(button.dataset.v74ProposalAccept??button.dataset.v74ProposalReject);
    const proposal=pia.propositions?.[index];
    if(!proposal)return;
    if(!accepting&&proposal.decisionStatus==="VALIDEE"){
      const ok=window.confirm("Refuser cette proposition déjà validée ?\n\nElle sera retirée des objectifs validés du PIA.");
      if(!ok)return;
    }
    if(!decidePIAProposal(pia,index,accepting?"VALIDEE":"REFUSEE")){window.showAppToast?.("Vérifiez la formulation de la proposition.","info",3000);return;}
    try{
      await persistPIAEdit(pia,true);
      V74.ui.piaDraftPersisted=true;
      render(pia);
      window.showAppToast?.(accepting?"✓ Proposition retenue (le PIA reste à l’état de projet tant qu’il n’est pas mis en vigueur).":"Proposition marquée comme refusée.","info",3200);
    }catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v74-proposal-reopen]").forEach(button=>button.addEventListener("click",async()=>{
    const index=Number(button.dataset.v74ProposalReopen),proposal=pia.propositions?.[index];
    if(!proposal)return;
    if(proposal.decisionStatus==="VALIDEE"){
      const ok=window.confirm(
        "Remettre cette proposition « À examiner » pour pouvoir la modifier ?\n\n"+
        "Elle sera retirée des objectifs validés tant que vous ne l’aurez pas validée à nouveau après modification."
      );
      if(!ok)return;
    }
    if(!decidePIAProposal(pia,index,"A_EXAMINER"))return;
    try{
      await persistPIAEdit(pia,true);
      V74.ui.piaDraftPersisted=true;
      render(pia);
      box.querySelector(`[data-v74-prop-formulation="${index}"]`)?.focus();
      window.showAppToast?.("Proposition remise « À examiner ». Vous pouvez modifier sa formulation.","info",3200);
    }catch(e){window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);}
  }));
  box.querySelectorAll("[data-v74-domain-jump]").forEach(button=>button.setAttribute("aria-label",`Afficher ${domains[Number(button.dataset.v74DomainJump)]?.aspect||"le domaine"}`));

  box.querySelector("#v74-batch-accept")?.addEventListener("click",async()=>{
    const chosen=[...box.querySelectorAll("[data-v74-prop]:checked")].map(field=>Number(field.dataset.v74Prop));
    if(!chosen.length){
      window.showAppToast?.("Cochez au moins une proposition « À examiner » pour la valider par lot.","info",3200);
      return;
    }
    const accepted=chosen.map(index=>decidePIAProposal(pia,index,"VALIDEE"));
    if(!accepted.some(Boolean))return;
    try{
      await persistPIAEdit(pia,true);
      V74.ui.piaDraftPersisted=true;
      render(pia);
      window.showAppToast?.(`✓ ${accepted.filter(Boolean).length} proposition(s) marquée(s) comme validée(s). Le PIA reste en construction jusqu’à sa mise en vigueur.`,"success",3800);
    }catch(e){
      window.showAppToast?.("⚠️ Enregistrement impossible : "+(e?.message||e),"error",4500);
    }
  });

  const handlePIAActivationClick=async()=>{
    const wasReevaluation=pia.lifecycle==="EN_REEVALUATION"||pia.meeting2?.status==="EN_REEVALUATION";
    syncValidatedObjectivesFromProposals(pia);
    const currentCounts=getPIADecisionCounts(pia);
    const domainObjectivesCount=safeArray(pia.sections).reduce((acc,sec)=>acc+safeArray(sec?.objectifs).length,0);

    if(currentCounts.validated===0 && domainObjectivesCount===0){
      window.showAppToast?.(
        "Validez au moins une proposition (ou renseignez un objectif de domaine) avant de mettre le PIA annuel en vigueur.",
        "info",
        4000
      );
      return;
    }

    const confirmMsg=buildPIAActivationConfirmationMessage(pia);
    if(!window.confirm(confirmMsg))return;

    if(!activatePIA(pia))return;

    try{
      await savePia(pia,true);
      V74.ui.piaDisplayMode="active";
      V74.ui.piaDraftStudentId="";
      V74.ui.piaDraftPersisted=true;
      render(pia);
      window.showAppToast?.(
        wasReevaluation
          ? "✓ Réévaluation confirmée : le PIA annuel est maintenu en vigueur et enregistré."
          : "✓ PIA annuel mis en vigueur et enregistré.",
        "success",
        4000
      );
    }catch(e){
      window.showAppToast?.(
        "⚠️ Mise en vigueur impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  };

  box.querySelector("#v74-validate")?.addEventListener("click",handlePIAActivationClick);
  box.querySelector("#v74-review-confirm")?.addEventListener("click",handlePIAActivationClick);
  box.querySelector("#v74-finalize")?.addEventListener("click",async()=>{
    const ok=window.confirm("Finaliser ce PIA annuel ?\n\nLe dossier restera consultable et son export professionnel pourra être produit.");if(!ok)return;
    pia.lifecycle="FINALISE";pia.finalizedAt=new Date().toISOString();pia.meeting2.status="FINALISE";
    try{await savePia(pia,true);render(pia);}catch(e){window.showAppToast?.("⚠️ Finalisation impossible : "+(e?.message||e),"error",4500);}
  });

  const exportPia=async deid=>{
    try{
      const fmt=box.querySelector("#v74-export-format")?.value||"docx";
      const docModel=buildPIADocumentModel(pia,deid);
      const base=deid
        ?"PIA_modele_deidentifie_V74"
        :"PIA_professionnel_V74";

      if(fmt==="docx"){
        downloadBytes(
          `${base}.docx`,
          makeDocx(docModel),
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
      }else{
        downloadBytes(
          `${base}.pdf`,
          makePdf(docModel),
          "application/pdf"
        );
      }

      window.showAppToast?.(
        `✓ Export ${fmt.toUpperCase()} généré localement.`,
        "success",
        3500
      );
    }catch(e){
      window.showAppToast?.(
        "⚠️ Export impossible : "+(e?.message||e),
        "error",
        5000
      );
    }
  };

  box.querySelector("#v74-export-prof")?.addEventListener("click",()=>exportPia(false));
  box.querySelector("#v74-export-deid")?.addEventListener("click",()=>exportPia(true));

  box.querySelector("#v74-json")?.addEventListener("click",()=>{
    downloadBytes(
      "PIA_professionnel_V74.json",
      JSON.stringify(pia,null,2),
      "application/json"
    );
    window.showAppToast?.("✓ Export JSON professionnel généré localement.","success",3000);
  });

  box.querySelector("#v74-deid-json")?.addEventListener("click",()=>{
    downloadBytes(
      "PIA_modele_deidentifie_V74.json",
      JSON.stringify(piaForExport(pia,true),null,2),
      "application/json"
    );
    window.showAppToast?.("✓ Export JSON dé-identifié généré localement.","success",3000);
  });

  box.querySelector("#v74-close")?.addEventListener("click",()=>{
    closePIAProject();
  });

  box.querySelector("#v74-cancel")?.addEventListener("click",async()=>{
    const ok=window.confirm(
      "Annuler ce projet de PIA ?\n\n"+
      "Le projet non validé sera abandonné.\n"+
      "Les séances et le PIA importé de continuité resteront conservés."
    );

    if(!ok)return;

    try{
      if(pia.lifecycle==="EN_CONSTRUCTION" && pia.studentId && V74.ui.piaDraftPersisted){
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

  box.querySelector("#v74-delete")?.addEventListener("click",async()=>{
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
  if(Array.isArray(pia.amenagements)){
    pia.amenagements = filterValidStructuredAmenagements(pia.amenagements).map((it, idx) => normalizeStructuredAmenagement(it, idx));
  }
  if(pia.meeting2 && Array.isArray(pia.meeting2.amenagementsRentree)){
    pia.meeting2.amenagementsRentree = filterValidStructuredAmenagements(pia.meeting2.amenagementsRentree).map((it, idx) => normalizeStructuredAmenagement(it, idx));
  }
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
  try{
    const pathName = (typeof window !== 'undefined' && window.location?.pathname) || '';
    const basePath = pathName.startsWith('/journalier-electronique')
      ? '/journalier-electronique'
      : '';
    const candidateUrls = [
      basePath ? `${basePath}/referentiel_pia_v74_0_3.json` : null,
      "./referentiel_pia_v74_0_3.json",
      "/journalier-electronique/referentiel_pia_v74_0_3.json",
      "/referentiel_pia_v74_0_3.json"
    ].filter(Boolean);
    const uniqueUrls = [...new Set(candidateUrls)];
    for (const url of uniqueUrls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        let data = null;
        if (typeof r.text === 'function') {
          const text = await r.text();
          if (!text || text.trim().startsWith('<')) continue;
          data = JSON.parse(text);
        } else if (typeof r.json === 'function') {
          data = await r.json();
        } else {
          continue;
        }
        V74.referential = data;
        return;
      } catch (_err) {
        // Essai du chemin candidat suivant
      }
    }
    V74.referential = null;
  }catch(err){
    console.warn("Journalier V74 — impossible de charger le référentiel PIA :", err);
    V74.referential=null;
  }
}

function getImportedPIA(studentId){try{return getData().state.meta?.piaImports?.[studentId]||getData().state.meta?.piaRecords?.[studentId]?.sourceContinuity||null;}catch(_){console.warn("Journalier V74 — lecture du PIA importé impossible.");return null;}}
async function persistImportedPIA(studentId,imported){
  const ds=window.JournalierDataStore; if(!ds?.isReady?.())throw new Error("Connectez-vous à Microsoft avant d’enregistrer le PIA.");
  const st=ds.getState();st.meta??={};st.meta.piaImports??={};const safe=JSON.parse(JSON.stringify(imported||{}));delete safe.displayName;safe.fileName="";st.meta.piaImports[studentId]=safe;
  if(st.meta.piaRecords?.[studentId]){
    st.meta.piaRecords[studentId].sourceContinuity=safe;
  }
  const markPending=window.JournalierMigrationBridge?.v72MarkPiaPending||window.v72MarkPiaPending;
  markPending?.(st,studentId);
  await ds.persistState(st);
  const piaPayload=st.meta.piaRecords?.[studentId]||{schemaVersion:"73.0.0",type:"PIA_IMPORT_CONTINUITE",studentId:String(studentId),role:"SOURCE_DE_CONTINUITE",sourceContinuity:safe};
  if(window.JournalierCloud?.savePia){
    try{
      await window.JournalierCloud.savePia(piaPayload);
      const markSynced=window.JournalierMigrationBridge?.v72MarkPiaSynced||window.v72MarkPiaSynced;
      markSynced?.(st,studentId,piaPayload);
      await ds.persistState(st);
    }catch(err){
      console.warn("Journalier V74 — enregistrement immédiat dans OneDrive différé (hors-ligne ou réseau) :", err);
    }
  }
  window.journalierScheduleAutoSync?.();
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
    host.innerHTML=`<div class="v74-dashboard-state"><div class="page-kicker">Tableau de bord</div><div class="v74-empty">${connected?"Ouverture du coffre local sécurisé…":"Connectez-vous avec Microsoft pour afficher les tendances, le suivi PIA et vos mémos."}</div></div>`;
    return;
  }
  try{
    const trends=dashboardTrendData(),pia=dashboardPiaData(),memos=safeArray(getData().state.meta?.dashboardMemos);
    host.innerHTML=`<div class="v74-dashboard-grid"><section><div class="page-kicker">Tendances observées · 30 derniers jours</div><h3 class="v74-dash-title">Ce qui ressort des séances</h3><p class="v74-dash-help">Synthèse descriptive des observations enregistrées. Elle ne constitue pas une évaluation ni un score de difficulté.</p>${trends.length?`<div class="v74-trends">${trends.map(t=>`<button class="v74-trend-row" data-v74-trend="${esc(t.theme)}"><span>${esc(t.theme)}</span><span class="v74-trend-bar"><i style="width:${Math.min(100,Math.max(12,t.count*18))}%"></i></span><strong>${t.count} séance${t.count>1?"s":""}</strong></button>`).join("")}</div>`:`<div class="v74-empty">Pas encore assez de séances pour dégager une tendance. Les synthèses apparaîtront au fur et à mesure des observations.</div>`}<button class="v74-link" data-v74-go-reports>Voir les rapports →</button></section>
    <section><div class="page-kicker">Suivi PIA</div><h3 class="v74-dash-title">PIA annuel</h3><div class="v74-pia-stats"><div><strong>${pia.active}</strong><span>en vigueur</span></div><div><strong>${pia.toComplete}</strong><span>à compléter</span></div><div><strong>${pia.toReview}</strong><span>à réévaluer</span></div><div><strong>${pia.finalized}</strong><span>finalisé(s)</span></div></div><button class="v74-link" data-v74-go-reports>Ouvrir le suivi PIA →</button></section>
    <section><div class="page-kicker">Mes mémos</div><h3 class="v74-dash-title">À ne pas oublier</h3><div class="v74-memo-list">${memos.length?memos.map((m,i)=>`<label class="v74-memo"><input type="checkbox" data-v74-memo-done="${i}" ${m.done?'checked':''}><span>${esc(m.text)}</span><button type="button" data-v74-memo-delete="${i}" aria-label="Supprimer le mémo">×</button></label>`).join(""):"<div class=\"v74-empty\">Aucun mémo personnel.</div>"}</div><div class="v74-memo-add"><input id="v74-memo-input" type="text" maxlength="180" placeholder="Ajouter un mémo…"><button class="btn-secondary" id="v74-memo-add">Ajouter</button></div></section></div>`;
    host.querySelectorAll("[data-v74-go-reports]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelectorAll("[data-v74-trend]").forEach(b=>b.onclick=()=>document.getElementById("tab-btn-reports")?.click());
    host.querySelector("#v74-memo-add")?.addEventListener("click",()=>{const input=host.querySelector("#v74-memo-input"),text=String(input?.value||"").trim();if(!text)return;updateDashboardMemos(memos=>memos.push({id:uid("memo"),text,done:false,createdAt:new Date().toISOString()}));});
    host.querySelectorAll("[data-v74-memo-done]").forEach(x=>x.addEventListener("change",()=>updateDashboardMemos(memos=>{const memo=memos[Number(x.dataset.v74MemoDone)];if(memo)memo.done=x.checked;})));
    host.querySelectorAll("[data-v74-memo-delete]").forEach(x=>x.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();updateDashboardMemos(memos=>memos.splice(Number(x.dataset.v74MemoDelete),1));}));
  }catch(_){host.innerHTML='<div class="v74-dashboard-state"><div class="page-kicker">Tableau de bord</div><div class="v74-empty">Le tableau de bord est momentanément indisponible.</div><button type="button" class="v74-link" data-v74-dashboard-retry>Réessayer</button></div>';host.querySelector('[data-v74-dashboard-retry]')?.addEventListener("click",renderDashboard);}
}
function openPIAFilePicker(){document.getElementById("student-pia-file")?.click();}
async function handlePIAFileForStudent(file,studentId){const parsed=await parsePIAFile(file);parsed.displayName=file.name;await persistImportedPIA(String(studentId),parsed);window.showAppToast?.("✓ PIA importé et structuré localement. Le document original n’est pas conservé par Journalier.","success",5000);return parsed;}
async function handleStudentPIAFileChange(input){const file=input?.files?.[0];if(!file)return;const rawId=document.getElementById("student-modal-id")?.value;let studentId="";if(rawId){try{const student=getData().students.find(s=>String(s.id)===String(rawId));studentId=student?String(student.studentId||student.id):String(rawId);}catch(_){studentId=String(rawId);}}const status=document.getElementById("pia-local-security-status"),target=document.getElementById("student-pia-file-name");try{if(status)status.textContent="⏳ Analyse locale du PIA…";const parsed=studentId?await handlePIAFileForStudent(file,studentId):await parsePIAFile(file);window.__journalierPendingPIAImport=studentId?null:{parsed,studentId:""};if(target)target.textContent=`✓ ${file.name} · ${parsed.format.toUpperCase()} · ${parsed.extracted.objectives.length} objectif(s), ${parsed.extracted.difficulties.length} difficulté(s), ${parsed.extracted.adaptations.length} adaptation(s)`;if(status)status.textContent="✓ Analyse locale terminée — le document original n’est pas conservé.";}catch(e){if(status)status.textContent="⚠️ Import impossible";window.showAppToast?.("⚠️ "+(e?.message||e),"error",5500);}}
function bindPIAImport(){const input=document.getElementById("student-pia-file");if(!input||input.dataset.v74Bound)return;input.dataset.v74Bound="1";input.accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";input.addEventListener("change",()=>handleStudentPIAFileChange(input));}
function attachPendingPIAImportWatcher(){const modal=document.getElementById("studentModal");if(!modal||modal.dataset.v74Watch)return;modal.dataset.v74Watch="1";const observer=new MutationObserver(async()=>{if(!modal.classList.contains("hidden")||!window.__journalierPendingPIAImport)return;const pending=window.__journalierPendingPIAImport,studentId=String(pending.studentId||"").trim();if(!studentId)return;try{const d=getData(),student=d.students.find(s=>String(s.studentId||s.id)===studentId);if(!student)return;await persistImportedPIA(studentId,pending.parsed);const ds=window.JournalierDataStore,st=ds.getState();const cleaned=st.students.map(s=>{const x={...s};delete x.piaFileName;return x;});ds.saveStudents(cleaned);await ds.persistState(st);window.__journalierPendingPIAImport=null;window.showAppToast?.("✓ PIA associé au dossier de l’élève. Le nom du fichier original n’est pas conservé.","success",4000);}catch(e){window.showAppToast?.("⚠️ Association du PIA impossible : "+(e?.message||e),"error",5000);}});observer.observe(modal,{attributes:true,attributeFilter:["class"]});}
async function scrubLegacyPIAFilenames(){try{const ds=window.JournalierDataStore;if(!ds?.isReady?.())return;const st=ds.getState();let changed=false;const students=st.students.map(s=>{if(!s?.piaFileName)return s;const x={...s};delete x.piaFileName;changed=true;return x;});if(changed){ds.saveStudents(students);await ds.persistState(st);}}catch(_){/* nettoyage silencieux en tâche de fond */}}
function bindHomeDashboard(){renderDashboard();const list=document.getElementById("home-today-list");if(list&&!list.__v74Obs){const obs=new MutationObserver(()=>renderDashboard());obs.observe(list,{childList:true});list.__v74Obs=obs;}document.getElementById("tab-btn-accueil")?.addEventListener("click",()=>setTimeout(renderDashboard,0));}
function addUI(){
  const host=document.getElementById("reports-pia-mount");
  if(!host || document.getElementById("v74-pia-card"))return;
  const card=document.createElement("div"); card.id="v74-pia-card"; card.className="card";
  card.innerHTML=`<div class="page-kicker">PIA ANNUEL</div><h2 class="page-title" style="font-size:1.15rem">Construire / réévaluer le PIA</h2>
  <div class="report-intro">Le PIA est annuel. Les séances alimentent les éléments de preuve. La réunion 1 (décembre) réévalue les objectifs existants ou permet de co-construire un premier PIA ; la réunion 2 évalue la trajectoire en fin d’année.</div>
  <div class="grid-2"><div class="v74-pia-student-context"><span>PIA de l’élève sélectionné</span><strong id="v74-pia-selected-student">Choisissez un élève dans l’en-tête.</strong><select id="v74-pia-student" hidden aria-hidden="true" tabindex="-1"></select></div><div><label for="v74-pia-date">Date de référence</label><input id="v74-pia-date" type="date"></div></div>
  <div id="v74-pia-continuity" class="v74-continuity"></div>
  <div class="v74-actions"><button id="v74-build" class="btn-primary">Générer le projet de PIA</button><button id="v74-meeting2" class="btn-secondary">Préparer la réévaluation fin d’année</button></div>
  <div id="v74-pia-result" class="v74-result"></div>`;
  host.appendChild(card);
  refreshStudents();
  document.getElementById("v74-build").onclick=()=>run(false); document.getElementById("v74-meeting2").onclick=()=>run(true);
  document.getElementById("v74-pia-student").addEventListener("change",()=>{
    clearPIAResult();
    refreshPIAContinuity();
    loadExistingPIAForSelectedStudent();
  });
  const reportStudent=document.getElementById("r-eleve");
  reportStudent?.addEventListener("change",syncPIAStudentFromReports);
  reportStudent?.addEventListener("journalier:student-context-change",syncPIAStudentFromReports);
  syncPIAStudentFromReports();
  refreshPIAContinuity(); loadExistingPIAForSelectedStudent(); bindPIAImport(); attachPendingPIAImportWatcher(); bindHomeDashboard();
}
function refreshPIAContinuity(){
  const sid=document.getElementById("v74-pia-student")?.value,host=document.getElementById("v74-pia-continuity");
  if(!host)return;
  if(!sid){host.innerHTML='<div class="v74-import-help">Choisissez un élève pour afficher la continuité PIA disponible.</div>';return;}
  const imported=getImportedPIA(sid);
  if(imported?.present||imported?.extracted){
    const e=imported.extracted||{};
    host.innerHTML=`<div class="v74-import-summary"><b>✓ PIA précédent disponible</b><span>${esc(imported.format?.toUpperCase()||"DOCUMENT")}</span><span>${safeArray(e.objectives).length} objectif(s)</span><span>${safeArray(e.difficulties).length} difficulté(s)</span><span>${safeArray(e.adaptations).length} adaptation(s)</span></div>`;
  }else{
    host.innerHTML='<div class="v74-import-help">PIA précédent : utilisez <b>Élèves → dossier de l’élève → Importer le PIA</b>. Le fichier Word/PDF est traité localement ; seul le contenu structuré validé est conservé.</div>';
  }
}
function syncPIAStudentFromReports(){
  const select=document.getElementById("v74-pia-student"),label=document.getElementById("v74-pia-selected-student");
  if(!select)return;
  const previous=select.value,name=document.getElementById("r-eleve")?.value||"";
  let data;try{data=getData()}catch(_){/* magasin local ou données élèves non encore initialisés */return;}
  const student=data.students.find(item=>String(item.nom||"")===String(name));
  refreshStudents();
  if(label)label.textContent=student?.nom||"Choisissez un élève dans l’en-tête.";
  if(previous!==select.value)select.dispatchEvent(new Event("change",{bubbles:true}));
}
function refreshStudents(){
  const sel=document.getElementById("v74-pia-student"); if(!sel)return;
  let d; try{d=getData()}catch(_){/* magasin local ou données élèves non encore initialisés */return;}
  const reportName=document.getElementById("r-eleve")?.value||"";
  const student=d.students.find(item=>String(item.nom||"")===String(reportName));
  sel.innerHTML=`<option value="">Sélectionnez un élève</option>${d.students.map(s=>`<option value="${esc(s.studentId)}">${esc(s.nom)}</option>`).join("")}`;
  sel.value=student?String(student.studentId):"";
  const selectedLabel=document.getElementById("v74-pia-selected-student");
  if(selectedLabel)selectedLabel.textContent=student?.nom||"Choisissez un élève dans l’en-tête.";
  const date=document.getElementById("v74-pia-date"),bounds=currentPIASchoolYearBounds();
  if(date){date.min=bounds.start;date.max=bounds.end;if(!date.value){const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;date.value=today>=bounds.start&&today<=bounds.end?today:bounds.start;}}
  refreshPIAContinuity();
}
async function run(meeting2){
  try{
    const d=getData();
    refreshStudents();

    const sid=document.getElementById("v74-pia-student")?.value;
    const student=d.students.find(s=>String(s.studentId)===String(sid));
    if(!student)throw new Error("Aucun élève sélectionné.");

    const until=document.getElementById("v74-pia-date")?.value||new Date().toISOString().slice(0,10);
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

    V74.state=pia;
    V74.ui.piaDisplayStudentId=String(student.studentId);
    V74.ui.piaDisplayMode=meeting2?"review":"draft";
    V74.ui.piaDraftStudentId=meeting2?"":String(student.studentId);
    V74.ui.piaDraftPersisted=false;

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

function ensurePIAForSynthesis(studentObj,untilDate,periodSessions=null){
  try{
    const d=getData();
    const student=studentObj&&studentObj.studentId
      ? studentObj
      : d.students.find(s=>String(s.studentId)===String(studentObj?.studentId||studentObj)||String(s.nom)===String(studentObj?.nom||studentObj));
    if(!student)return null;
    const sid=String(student.studentId);
    const rawUntil=untilDate||document.getElementById("v74-pia-date")?.value||new Date().toISOString().slice(0,10);
    const bounds=currentPIASchoolYearBounds();
    const until=piaSchoolYear(rawUntil)?rawUntil:bounds.end;
    const schoolYear=piaSchoolYear(until)||bounds.schoolYear;
    const stored=d.state.meta?.piaRecords?.[sid]||(V74.state?.studentId===sid?V74.state:null);
    const existing=stored&&(!stored.schoolYear||stored.schoolYear===schoolYear)?stored:null;
    const imported=d.state.meta?.piaImports?.[sid]||null;
    const seed=existing||imported?{...(existing||{}),sourceContinuity:existing?.sourceContinuity||imported}:null;
    if(existing&&["EN_VIGUEUR","ACTIF","FINALISE"].includes(existing.lifecycle)){
      V74.state=existing;
      return existing;
    }
    const sourceSessions=Array.isArray(periodSessions)&&periodSessions.length?periodSessions:d.sessions;
    const pia=buildPIA(student,sourceSessions,until,seed);
    syncValidatedObjectivesFromProposals(pia);
    V74.state=pia;
    V74.ui.piaDisplayStudentId=sid;
    if(!V74.ui.piaDisplayMode||V74.ui.piaDisplayMode==="none")V74.ui.piaDisplayMode="draft";
    V74.ui.piaDraftStudentId=sid;
    return pia;
  }catch(err){
    console.warn("Journalier V74 — synthèse PIA en repli :", err);
    return null;
  }
}

async function saveSynthesisDomainField(pia,domainIndex,fieldKey,linesArray){
  if(!pia||!Array.isArray(pia.sections))return false;
  const sec=pia.sections[Number(domainIndex)];
  if(!sec||!PIA_DOMAIN_FIELDS.some(([k])=>k===fieldKey))return false;
  sec[fieldKey]=safeArray(linesArray).map(v=>String(v||"").trim()).filter(Boolean);
  V74.state=pia;
  V74.ui.piaDraftPersisted=true;
  await persistPIAEdit(pia,true);
  if(document.getElementById("v74-pia-result")?.querySelector("[data-v74-pia-tab]"))render(pia);
  return true;
}

async function decideSynthesisProposal(pia,index,decision,customFormulation=null){
  if(!pia||!Array.isArray(pia.propositions))return false;
  const prop=pia.propositions[Number(index)];
  if(!prop)return false;
  if(customFormulation!==null&&customFormulation!==undefined){
    const trimmed=String(customFormulation).trim();
    if(trimmed)prop.formulation=trimmed;
  }
  if(decision==="SAVE_ONLY"){
    V74.state=pia;
    V74.ui.piaDraftPersisted=true;
    await persistPIAEdit(pia,true);
    if(document.getElementById("v74-pia-result")?.querySelector("[data-v74-pia-tab]"))render(pia);
    return true;
  }
  if(decision==="VALIDEE"){
    prop.formulation=String(prop.formulation||"").trim();
    if(!prop.formulation)return false;
    prop.decisionStatus="VALIDEE";
    prop.decidedAt=new Date().toISOString();
    syncValidatedObjectivesFromProposals(pia);
  }else if(decision==="REFUSEE"){
    prop.decisionStatus="REFUSEE";
    prop.decidedAt=new Date().toISOString();
    syncValidatedObjectivesFromProposals(pia);
  }else if(decision==="A_EXAMINER"){
    prop.decisionStatus="A_EXAMINER";
    delete prop.decidedAt;
    syncValidatedObjectivesFromProposals(pia);
  }else{
    return false;
  }
  V74.state=pia;
  V74.ui.piaDraftPersisted=true;
  await persistPIAEdit(pia,true);
  if(document.getElementById("v74-pia-result")?.querySelector("[data-v74-pia-tab]"))render(pia);
  return true;
}

function openPIAWorkspaceFromSynthesis(pia,targetSection="domains"){
  if(!pia)return false;
  V74.state=pia;
  const sel=document.getElementById("v74-pia-student");
  if(sel&&pia.studentId)sel.value=String(pia.studentId);
  V74.ui.piaDisplayStudentId=String(pia.studentId||"");
  V74.ui.piaDisplayMode=["EN_VIGUEUR","ACTIF","FINALISE"].includes(pia.lifecycle)?"active":(pia.lifecycle==="EN_REEVALUATION"?"review":"draft");
  V74.ui.piaDraftStudentId=pia.lifecycle==="EN_CONSTRUCTION"?String(pia.studentId||""):"";
  V74.ui.pendingSection=targetSection||"domains";
  render(pia);
  return true;
}

async function resetSynthesisDecisions(studentId){
  const sid=String(studentId||"").trim();
  if(!sid)return false;
  const ds=window.JournalierDataStore;
  if(!ds?.isReady?.())return false;
  const st=ds.getState();
  const rec=st.meta?.piaRecords?.[sid];
  if(rec){
    rec.lifecycle="EN_CONSTRUCTION";
    delete rec.finalizedAt;
    if(rec.meeting1){
      rec.meeting1.status="A_PREPARE";
      rec.meeting1.objectivesValidated=[];
      rec.meeting1.validatedAt="";
      if(Array.isArray(rec.meeting1.proposals)){
        rec.meeting1.proposals.forEach(p=>{if(p){p.decisionStatus="A_EXAMINER";delete p.decidedAt;}});
      }
    }
    if(Array.isArray(rec.propositions)){
      rec.propositions.forEach(p=>{if(p){p.decisionStatus="A_EXAMINER";delete p.decidedAt;}});
    }
    if(Array.isArray(rec.sections)){
      rec.sections.forEach(sec=>{if(sec)sec.objectifs=[];});
    }
    if(rec.meeting2){
      rec.meeting2.status="A_VENIR";
      rec.meeting2.evaluation=[];
      rec.meeting2.objectivesToContinue=[];
    }
    await persistPIAEdit(rec, true);
  }
  if(V74.state&&String(V74.state.studentId||"")===sid){
    V74.state.lifecycle="EN_CONSTRUCTION";
    if(V74.state.meeting1){
      V74.state.meeting1.status="A_PREPARE";
      V74.state.meeting1.objectivesValidated=[];
      V74.state.meeting1.validatedAt="";
    }
    safeArray(V74.state.propositions).forEach(p=>{if(p){p.decisionStatus="A_EXAMINER";delete p.decidedAt;}});
    safeArray(V74.state.sections).forEach(sec=>{if(sec)sec.objectifs=[];});
    render(V74.state);
  }
  return true;
}

async function deleteStudentPIA(studentId){
  const sid=String(studentId||"").trim();
  if(!sid)return false;
  await deletePIARecord(sid);
  clearPIAResult();
  return true;
}

if(typeof window!=="undefined"){
  window.V74=V74;
}
window.JournalierV74={
  ...V74,
  get state(){return V74.state;},
  set state(val){V74.state=val;},
  buildPIA,buildPIADocumentModel,buildOfficialPIADocumentModel,buildPIAIdentityObject,buildOfficialPIAFileName,exportOfficialPIADocument,exportOfficialDocx:exportOfficialPIADocument,normalizeStructuredAmenagement,normalizeAmenagementsList,filterValidStructuredAmenagements,formatStructuredAmenagementsSummary,copyDecemberAmenagementsToMeeting2,renderAmenagementsEditor,formatPersonnePresente,normalizePersonnesPresentes,fuseDirectionAndTeamFeedback,countMissingPIAInfo,suggestSchoolAdminData,buildSessionsDocumentModel,buildSessionObservationSynthesis,exportSessionsDocument,piaDocumentPreviewHtml,extractUnits,compareUnits,proposalText,run,refreshStudents,loadRef,parsePIAFile,extractPIAStructure,renderDashboard,piaSchoolYear,piaSchoolYearBounds,exportTextDocument,requestPIASection,getImportedPIA,piaImportDossierHtml,decidePIAProposal,activatePIA,syncValidatedObjectivesFromProposals,getPIADecisionCounts,buildPIAActivationConfirmationMessage,loadExistingPIAForSelectedStudent,render,piaMeetingEditor,piaTextSections,piaForExport,makeDocx,makeOfficialDocx,fillOfficialPIADocx:makeOfficialDocx,makePdf,wrapPdfTextLine,evaluateMeeting2,normalizePIALifecycle,resolveSessionWBERepere,canonicalizeWbeChapter,summarizeWbeByCourse,isAdaptationRelevantToAspect,cleanStrengthItemLabel,semanticSkillKeyV74,getSemanticConceptKeyV74:semanticSkillKeyV74,pickPreferredSkillLabelV74,buildContextTreeFromUnitsV74,buildProposalContextTreeV74,groupOccurrencesBySubjectAndChapterV74,deduplicateDomainStrengthsV74,deduplicateDomainDifficultiesV74,formatConciseObjectiveForAspect,defaultMeansForAspect,ensurePIAForSynthesis,saveSynthesisDomainField,decideSynthesisProposal,openPIAWorkspaceFromSynthesis,resetSynthesisDecisions,deleteStudentPIA,piaDomainIcon,piaDomainTone,piaDomainObjectives
};
if(typeof globalThis!=="undefined"){
  globalThis.V74=V74;
  globalThis.buildOfficialPIADocumentModel=buildOfficialPIADocumentModel;
  globalThis.buildOfficialPIAFileName=buildOfficialPIAFileName;
  globalThis.exportOfficialPIADocument=exportOfficialPIADocument;
  globalThis.piaMeetingEditor=piaMeetingEditor;
  globalThis.buildPIAIdentityObject=buildPIAIdentityObject;
  globalThis.normalizeStructuredAmenagement=normalizeStructuredAmenagement;
  globalThis.normalizeAmenagementsList=normalizeAmenagementsList;
  globalThis.filterValidStructuredAmenagements=filterValidStructuredAmenagements;
  globalThis.formatStructuredAmenagementsSummary=formatStructuredAmenagementsSummary;
  globalThis.copyDecemberAmenagementsToMeeting2=copyDecemberAmenagementsToMeeting2;
  globalThis.renderAmenagementsEditor=renderAmenagementsEditor;
  globalThis.formatPersonnePresente=formatPersonnePresente;
  globalThis.normalizePersonnesPresentes=normalizePersonnesPresentes;
  globalThis.fuseDirectionAndTeamFeedback=fuseDirectionAndTeamFeedback;
  globalThis.countMissingPIAInfo=countMissingPIAInfo;
  globalThis.suggestSchoolAdminData=suggestSchoolAdminData;
  globalThis.makeOfficialDocx=makeOfficialDocx;
  globalThis.fillOfficialPIADocx=makeOfficialDocx;
}
const style=document.createElement("style");style.textContent=`
#v74-pia-card{margin-top:16px}.v74-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center}.v74-summary span:not(.v74-status-badge),.v74-summary b{padding:6px 9px;border-radius:8px;background:#f1f5f9}.v74-summary-main{display:flex;align-items:center;gap:8px}.v74-status-badge{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;font-weight:750;font-size:.82rem}.v74-status-badge.is-success{background:#dcfce7;color:#166534}.v74-status-badge.is-warning{background:#fef3c7;color:#92400e}.v74-notice{padding:11px;border-left:4px solid #2563eb;background:#eff6ff;border-radius:8px;margin:10px 0;font-size:.82rem;line-height:1.45}.v74-notice-warning{border-left-color:#f59e0b;background:#fffbeb}.v74-proposals{display:grid;gap:12px;margin:14px 0}.v74-prop{display:grid;grid-template-columns:42px minmax(0,1fr);gap:14px;align-items:center;padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#fff;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease}.v74-prop:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(15,23,42,.07);border-color:#bfdbfe}.v74-prop:has(input:checked){border-color:#60a5fa;background:#eff6ff;box-shadow:0 4px 14px rgba(37,99,235,.10)}.v74-prop-select{display:grid;place-items:center}.v74-prop-select input{position:absolute;opacity:0;pointer-events:none}.v74-checkmark{width:24px;height:24px;border:2px solid #cbd5e1;border-radius:7px;background:#fff;position:relative;transition:border-color .15s ease,background .15s ease}.v74-prop input:checked+.v74-checkmark{border-color:#2563eb;background:#2563eb}.v74-prop input:checked+.v74-checkmark::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px}.v74-prop-body{min-width:0}.v74-prop-title{display:block;font-weight:750;color:#172033;margin-bottom:5px}.v74-prop-formulation{display:block;color:#334155;line-height:1.45}.v74-prop-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;color:#64748b;font-size:.75rem}.v74-prop-meta>span{padding:4px 7px;border-radius:999px;background:#f1f5f9}.v74-badge-warning{background:#fff7ed!important;color:#9a3412!important}.v74-action-group{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}.v74-action-title{margin-bottom:9px;font-size:.76rem;font-weight:750;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.v74-btn{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:650;transition:filter .15s ease,transform .15s ease}.v74-btn:hover{filter:brightness(.97);transform:translateY(-1px)}.v74-btn:active{transform:translateY(0)}.v74-btn-primary{background:#0a84ff;color:#fff}.v74-btn-success{background:#16a34a;color:#fff}.v74-btn-warning{background:#f59e0b;color:#fff}.v74-btn-neutral{background:#eef2f7;color:#172033}.v74-btn-danger{background:#dc2626;color:#fff}.v74-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v74-result{margin-top:14px}.v74-continuity{margin-top:12px}.v74-import-help{padding:11px 13px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;color:#475569;font-size:.78rem}.v74-import-summary{display:flex;gap:7px;flex-wrap:wrap;padding:10px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;color:#166534;font-size:.76rem}.v74-import-summary span,.v74-import-summary b{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.72)}.v74-export-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#fafafa}.v74-export-row label{font-size:.75rem;color:#475569;display:grid;gap:5px}.v74-export-row select{padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.v74-empty{padding:10px 0;color:#64748b;font-size:.76rem}.v74-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.7fr) minmax(260px,.85fr);gap:14px}.v74-dashboard-grid>section{padding:16px;border:1px solid var(--border);border-radius:13px;background:#fff;min-width:0}.v74-dash-title{margin:0 0 5px;font-size:1rem}.v74-dash-help{margin:0 0 11px;color:#64748b;font-size:.72rem;line-height:1.45}.v74-trends{display:grid;gap:7px}.v74-trend-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(80px,1.2fr) auto;gap:8px;align-items:center;border:0;background:transparent;padding:5px 0;text-align:left;color:#172033;cursor:pointer}.v74-trend-bar{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.v74-trend-bar i{display:block;height:100%;border-radius:999px;background:#0a84ff}.v74-trend-row strong{font-size:.68rem;color:#64748b;white-space:nowrap}.v74-link{margin-top:10px;border:0;background:transparent;color:#0a84ff;font-weight:700;cursor:pointer;padding:4px 0}.v74-pia-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.v74-pia-stats div{padding:10px;border-radius:9px;background:#f8fafc;text-align:center}.v74-pia-stats strong{display:block;font-size:1.2rem}.v74-pia-stats span{font-size:.65rem;color:#64748b}.v74-memo-list{display:grid;gap:6px;max-height:150px;overflow:auto}.v74-memo{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:7px 8px;background:#f8fafc;border-radius:8px;font-size:.76rem}.v74-memo input:checked+span{text-decoration:line-through;color:#94a3b8}.v74-memo button{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:1rem}.v74-memo-add{display:flex;gap:6px;margin-top:8px}.v74-memo-add input{min-width:0;flex:1;margin:0;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px}.v74-empty{padding:10px 0;color:#64748b;font-size:.76rem}@media(max-width:1100px){.v74-dashboard-grid{grid-template-columns:1fr 1fr}.v74-dashboard-grid>section:first-child{grid-column:1/-1}}@media(max-width:720px){.v74-dashboard-grid{grid-template-columns:1fr}.v74-dashboard-grid>section:first-child{grid-column:auto}.v74-trend-row{grid-template-columns:1fr auto}.v74-trend-bar{grid-column:1/-1}.v74-export-row{align-items:stretch}.v74-export-row>*{width:100%}}
`;document.head.appendChild(style);
const piaLayoutStyle=document.createElement("style");piaLayoutStyle.textContent=`
.v74-domain-section,.v74-meetings-section{margin:20px 0}
.v74-pia-nav{display:flex;gap:3px;overflow-x:auto;margin:15px 0 18px;border-bottom:1px solid #dbe3ef;scrollbar-width:thin}
.v74-pia-nav [role="tab"]{position:relative;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;border:0;border-radius:6px 6px 0 0;background:transparent;padding:11px 13px;color:#64748b;font:inherit;font-size:.78rem;font-weight:650;white-space:nowrap;cursor:pointer}
.v74-pia-nav [role="tab"]:hover,.v74-pia-nav [role="tab"]:focus-visible{color:#1d4ed8;background:#eff6ff;outline:none}
.v74-pia-nav [role="tab"][aria-selected="true"]{color:#1d4ed8;background:#eff6ff}
.v74-pia-nav [role="tab"][aria-selected="true"]::after{content:"";position:absolute;right:10px;bottom:-1px;left:10px;height:2px;border-radius:2px;background:#2563eb}
.v74-pia-nav [role="tab"] span{font-size:.68rem;color:inherit;opacity:.76}
.v74-pia-panel[hidden]{display:none!important}
.v74-pia-panel{min-width:0;scroll-margin-top:16px}
.v74-summary{padding:2px 0 12px;border-bottom:1px solid #e7eaf0}
.v74-summary>span:not(.v74-status-badge){padding:0;border-radius:0;background:transparent;color:#64748b;font-size:.74rem}
.v74-proposals{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start}
.v74-prop{border-radius:8px;box-shadow:0 2px 9px rgba(15,23,42,.045)}
.v74-prop:hover{transform:none;box-shadow:0 4px 12px rgba(15,23,42,.07);border-color:#bfdbfe}
.v74-prop.is-pending{border-left:3px solid #bd7d1a;background:#fff}
.v74-prop.is-validated{border-left:3px solid #23865f;background:#fff}
.v74-prop.is-refused{border-left:3px solid #b34b52;background:#fff}
.v74-prop-state{display:inline-flex;align-items:center;width:max-content;padding:3px 7px;border-radius:999px;background:#f1f4f8;color:#5b687a;font-size:.66rem;font-weight:700}
.v74-prop-state.is-pending{background:#fff0d9;color:#8d5a12}
.v74-prop-state.is-validated{background:#e8f6ef;color:#176b4e}
.v74-prop-state.is-refused{background:#fdebed;color:#9c3b43}
.v74-export-disclosure{margin-top:14px;border-top:1px solid #dbe3ef}
.v74-export-disclosure>summary{width:max-content;max-width:100%;padding:12px 2px;color:#2563eb;font-size:.78rem;font-weight:650;cursor:pointer}
.v74-export-disclosure .v74-action-group{margin-top:0}
.v74-management-disclosure{margin-top:8px}
.v74-pia-student-context{display:grid;align-content:center;gap:5px;min-height:42px}
.v74-pia-student-context span{font-size:.72rem;font-weight:700;color:#64748b}
.v74-pia-student-context strong{font-size:.88rem;font-weight:650;color:#172033}
.v74-pia-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
.v74-domain-section h3,.v74-meetings-section h3{font-size:.95rem;margin:18px 0 9px;color:#26364a}
.v74-domain-overview-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:stretch}
.v74-domain-overview,.v74-domain-record-head{--domain-accent:#51657c;--domain-ink:#3f536b;--domain-wash:#f2f5f8}
.v74-domain-overview.tone-cognitive,.v74-domain-record-head.tone-cognitive{--domain-accent:#6654a6;--domain-ink:#5c4d91;--domain-wash:#f3f0fb}
.v74-domain-overview.tone-communication,.v74-domain-record-head.tone-communication{--domain-accent:#168b83;--domain-ink:#23685f;--domain-wash:#edf8f6}
.v74-domain-overview.tone-affective,.v74-domain-record-head.tone-affective{--domain-accent:#b45a62;--domain-ink:#8c4d55;--domain-wash:#fff2f2}
.v74-domain-overview.tone-autonomy,.v74-domain-record-head.tone-autonomy{--domain-accent:#bd7d1a;--domain-ink:#805c20;--domain-wash:#fff7e9}
.v74-domain-overview.tone-physical,.v74-domain-record-head.tone-physical{--domain-accent:#3977ce;--domain-ink:#2d548e;--domain-wash:#eff5ff}
.v74-domain-overview{display:grid;grid-template-rows:auto auto 1fr auto;align-content:start;gap:9px;min-width:0;min-height:232px;padding:16px;border:1px solid transparent;border-radius:12px;text-align:left;color:var(--domain-ink);background:var(--domain-wash);cursor:pointer;box-shadow:0 3px 12px rgba(25,39,62,.045);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.v74-domain-overview:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(25,39,62,.09)}
.v74-domain-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(255,255,255,.85);border-radius:14px;background:rgba(255,255,255,.82);color:inherit;box-shadow:0 2px 7px rgba(25,39,62,.055)}
.v74-domain-icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.v74-domain-overview:hover{border-color:var(--domain-accent);filter:brightness(.985)}
.v74-domain-overview:focus-visible{outline:3px solid color-mix(in srgb,var(--domain-accent) 28%,transparent);outline-offset:2px}
.v74-domain-overview strong{font-size:.88rem;line-height:1.3}
.v74-domain-overview .v74-domain-metrics{display:flex;flex-wrap:wrap;align-content:start;gap:5px}
.v74-domain-overview .v74-domain-metrics span{padding:4px 6px;border:1px solid rgba(68,91,125,.09);border-radius:5px;background:rgba(255,255,255,.72);color:#58677b;font-size:.64rem;line-height:1.25}
.v74-domain-overview .v74-domain-metrics b{color:inherit;font-size:.71rem}
.v74-domain-overview .v74-domain-action{display:flex;justify-content:space-between;align-items:center;align-self:end;margin-top:8px;padding-top:8px;border-top:1px solid rgba(68,91,125,.12);color:var(--domain-ink);font-size:.68rem;font-weight:700}
.v74-domain-overview-view[hidden]{display:none!important}
.v74-domain-detail-view{min-width:0}
.v74-domain-back{margin:0 0 12px;padding:7px 0;border:0;background:transparent;color:#2563eb;font:inherit;font-size:.74rem;font-weight:650;cursor:pointer}
.v74-domain-detail-layout{display:grid;grid-template-columns:minmax(180px,230px) minmax(0,1fr);gap:14px;align-items:start}
.v74-domain-menu{display:grid;gap:3px;padding:7px;border-radius:8px;background:#f2f4f7}
.v74-domain-menu button{width:100%;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:#59677c;text-align:left;font:inherit;font-size:.74rem;line-height:1.35;cursor:pointer}
.v74-domain-menu button:hover{background:#e9edf3}
.v74-domain-menu button[aria-current="true"]{background:#fff;color:#1d4ed8;font-weight:700;box-shadow:0 1px 3px rgba(25,39,62,.06)}
.v74-domain-record{min-width:0;padding:14px;border:1px solid #e7eaf0;border-radius:9px;background:#fff;box-shadow:0 3px 12px rgba(25,39,62,.035)}
.v74-domain-record-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:10px;padding:12px 13px;border-left:3px solid var(--domain-accent);border-radius:7px;background:var(--domain-wash)}
.v74-domain-record-head h3{margin:2px 0 0;font-size:1rem;color:var(--domain-ink)}
.v74-domain-record-head>span{padding:4px 7px;border-radius:5px;background:#f1f4f8;color:#64748b;font-size:.67rem;white-space:nowrap}
.v74-domain-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px}
.v74-domain-fieldset{--field-accent:#3977ce;--field-wash:#f3f7fc;min-width:0;align-self:start;border:1px solid rgba(68,91,125,.11);border-left:3px solid var(--field-accent);border-radius:7px;background:var(--field-wash);overflow:hidden}
.v74-domain-fieldset.is-ressources{--field-accent:#168b83;--field-wash:#eff8f6}
.v74-domain-fieldset.is-difficultes{--field-accent:#bd7d1a;--field-wash:#fff8ed}
.v74-domain-fieldset.is-objectifs{--field-accent:#3977ce;--field-wash:#eff5ff}
.v74-domain-fieldset.is-criteres{--field-accent:#2187a3;--field-wash:#eff8fa}
.v74-domain-fieldset.is-moyens{--field-accent:#745bc7;--field-wash:#f5f2fb}
.v74-domain-fieldset.is-evolution{--field-accent:#23865f;--field-wash:#eff8f3}
.v74-domain-fieldset>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 12px;color:#27364b;font-size:.76rem;font-weight:700;cursor:pointer;list-style:none}
.v74-domain-fieldset[open]>summary{color:var(--field-accent)}
.v74-domain-fieldset>summary::-webkit-details-marker{display:none}
.v74-domain-fieldset>summary::after{content:"⌄";color:#7b8797;font-size:.85rem}
.v74-domain-fieldset[open]>summary::after{content:"⌃"}
.v74-domain-fieldset>summary span{margin-left:auto;color:#778398;font-size:.68rem;font-weight:500}
.v74-domain-field-content{display:grid;gap:10px;padding:0 11px 12px}
.v74-domain-value-list{display:flex;flex-wrap:wrap;gap:6px}
.v74-domain-value{display:inline-flex;max-width:100%;padding:6px 9px;border:1px solid rgba(68,91,125,.10);border-left:2px solid var(--field-accent);border-radius:6px;background:rgba(255,255,255,.9);color:#39475c;font-size:.73rem;line-height:1.4;overflow-wrap:anywhere}
.v74-domain-empty{margin:0 0 10px;color:#7b8797;font-size:.74rem}
.v74-pia-dossier{display:grid;gap:10px;margin-top:10px}
.v74-domain-value-list-row{--field-accent:#745bc7;display:grid;gap:6px;padding:8px 0}
.v74-domain-value-list-row .v74-domain-value-label{font-size:.68rem;font-weight:750;text-transform:uppercase;color:#627087}
.v74-pia-dossier>summary,.v74-domain-record>summary{list-style:none;cursor:pointer}
.v74-pia-dossier>summary::-webkit-details-marker,.v74-domain-record>summary::-webkit-details-marker{display:none}
.v74-pia-dossier>summary::after{content:"Déplier ⌄";margin-left:auto;color:#166534;font-size:.68rem;font-weight:700;white-space:nowrap}
.v74-pia-dossier[open]>summary::after{content:"Replier ⌃"}
details.v74-domain-record>.v74-domain-record-head::after{content:"⌄";margin-left:8px;color:#7b8797;font-size:.85rem;align-self:center}
details.v74-domain-record[open]>.v74-domain-record-head::after{content:"⌃"}
details.v74-domain-record{padding:0;overflow:hidden}
details.v74-domain-record>.v74-domain-fields{padding:0 13px 13px}
.v74-domain-field{display:grid;gap:5px;font-size:.69rem;font-weight:650;color:#66748a}
.v74-domain,.v74-meeting{border-top:1px solid #dbe3ef}
.v74-domain:last-child,.v74-meeting:last-child{border-bottom:1px solid #dbe3ef}
.v74-domain>summary,.v74-meeting>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 4px;cursor:pointer;font-weight:700;color:#172033}
.v74-domain-fields,.v74-meeting-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:4px 0 14px}
.v74-domain-field,.v74-meeting-field{display:grid;gap:5px;min-width:0;font-size:.76rem;font-weight:650;color:#334155}
.v74-domain-field textarea,.v74-meeting-field textarea,.v74-meeting-field input,.v74-meeting-field select,.v74-prop-edit textarea{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font:inherit;font-weight:400;color:#172033;background:#fff;resize:vertical}
.v74-participants{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;border:1px solid #dbe3ef;border-radius:6px;padding:10px}
.v74-participants legend,.v74-meeting-subtitle{font-size:.78rem;font-weight:700;color:#334155}
.v74-participants label{display:flex;gap:7px;align-items:center;font-size:.78rem}
.v74-feedback-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.v74-meeting-subtitle{grid-column:1/-1}
.v74-meeting-status{font-size:.72rem;font-weight:600;color:#64748b}
.v74-annual-tracking{display:grid;gap:16px;padding:12px 0;border-block:1px solid #dbe3ef}
.v74-annual-tracking h3{margin-top:0}.v74-annual-tracking h4{font-size:.82rem;margin:0 0 8px;color:#1e293b}
.v74-annual-tracking p,.v74-annual-tracking li{font-size:.78rem;line-height:1.45;color:#475569}
.v74-tracking-timeline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.v74-timeline-step{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
.v74-timeline-step.is-done{border-color:#bbf7d0;background:#f0fdf4}
.v74-timeline-step.is-current{border-color:#bfdbfe;background:#eff6ff}
.v74-timeline-dot{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:#cbd5e1;color:#1e293b;font-size:.75rem;font-weight:750;flex:0 0 auto}
.v74-timeline-step.is-done .v74-timeline-dot{background:#16a34a;color:#fff}
.v74-timeline-step.is-current .v74-timeline-dot{background:#2563eb;color:#fff}
.v74-timeline-step strong{display:block;font-size:.78rem;color:#0f172a}
.v74-timeline-step span{display:block;font-size:.7rem;color:#64748b}
.v74-tracking-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.v74-tracking-card,.v74-tracking-block{padding:13px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
.v74-tracking-list{margin:0;padding-left:18px;display:grid;gap:5px}
.v74-pom-grid,.v74-eval-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}
.v74-pom-card,.v74-eval-card{padding:11px 12px;border:1px solid #e2e8f0;border-left:3px solid #2563eb;border-radius:8px;background:#f8fafc}
.v74-pom-card.is-type-o{border-left-color:#0d9488}
.v74-pom-card.is-type-m{border-left-color:#7c3aed}
.v74-pom-head,.v74-eval-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.v74-pom-badge{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;background:#dbeafe;color:#1e40af;font-size:.72rem;font-weight:800}
.v74-pom-text{margin:0 0 6px;font-size:.76rem;color:#1e293b}
.v74-pom-meta{font-size:.71rem;color:#475569;margin-top:3px}
.v74-doc-sheet{display:grid;gap:14px;padding:20px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.05)}
.v74-doc-banner{padding:16px;border:1px solid #bfdbfe;border-left:4px solid #1d4ed8;border-radius:10px;background:#f8fafc}
.v74-doc-banner-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.v74-doc-kicker{font-size:.68rem;font-weight:800;letter-spacing:.05em;color:#1d4ed8;text-transform:uppercase}
.v74-doc-title{margin:4px 0;font-size:1.05rem;color:#0f172a}
.v74-doc-subtitle{margin:0;font-size:.78rem;color:#475569}
.v74-doc-meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #dbe3ef}
.v74-doc-meta-pair{display:grid;gap:2px;font-size:.73rem}
.v74-doc-meta-pair span{color:#64748b;font-size:.67rem;text-transform:uppercase;font-weight:700}
.v74-doc-meta-pair strong{color:#0f172a}
.v74-doc-callout{padding:11px 13px;border:1px solid #cbd5e1;border-left:4px solid #2563eb;border-radius:8px;background:#eff6ff;font-size:.76rem;color:#1e293b}
.v74-doc-callout strong{display:block;margin-bottom:4px;color:#1e3a8a}
.v74-doc-callout p{margin:3px 0;line-height:1.45}
.v74-doc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.v74-doc-kpi{padding:10px 12px;border:1px solid #dbe3ef;border-radius:9px;background:#f8fafc}
.v74-doc-kpi span{display:block;font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase}
.v74-doc-kpi strong{display:block;font-size:1.15rem;color:#1e3a8a;margin:2px 0}
.v74-doc-kpi small{display:block;font-size:.68rem;color:#64748b}
.v74-doc-section-title{display:flex;align-items:center;gap:8px;margin:8px 0 2px;padding:8px 11px;border-left:4px solid #1e3a8a;border-radius:6px;background:#eff6ff;color:#1e3a8a;font-size:.86rem}
.v74-doc-sec-num{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:999px;background:#1e3a8a;color:#fff;font-size:.7rem;font-weight:700}
.v74-doc-table-wrap{overflow-x:auto}
.v74-doc-table-title{font-size:.78rem;font-weight:700;color:#1e3a8a;margin-bottom:6px}
.v74-doc-table{width:100%;border-collapse:collapse;font-size:.74rem;border:1px solid #cbd5e1}
.v74-doc-table th{background:#1e3a8a;color:#fff;text-align:left;padding:8px 10px;font-weight:700;border:1px solid #1e3a8a}
.v74-doc-table td{padding:8px 10px;border:1px solid #dbe3ef;vertical-align:top;color:#1f2937;line-height:1.4}
.v74-doc-table tr:nth-child(even) td{background:#f8fafc}
.v74-doc-table td.is-first-col{font-weight:700;color:#1e293b;background:#f1f5f9}
.v74-doc-cell-list{margin:0;padding-left:16px;display:grid;gap:3px}
.v74-proposals-summary-bar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.v74-prop-counter{padding:5px 10px;border-radius:999px;font-size:.74rem;background:#f1f5f9;color:#334155}
.v74-prop-counter.is-pending{background:#fff7ed;color:#9a3412}
.v74-prop-counter.is-validated{background:#ecfdf5;color:#065f46}
.v74-prop-counter.is-refused{background:#fef2f2;color:#991b1b}
.v74-prop{align-items:start}.v74-prop-select{padding-top:4px}.v74-prop-edit{display:grid;gap:5px;margin:9px 0;font-size:.74rem;font-weight:650;color:#475569}
.v74-prop-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.v74-prop-actions .v74-btn{font-size:.76rem;padding:8px 10px}
.v74-prop-evidence{margin:7px 0;padding-left:18px;color:#64748b;font-size:.73rem;line-height:1.5}
@media(max-width:1100px){.v74-domain-overview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v74-domain-detail-layout{grid-template-columns:minmax(155px,195px) minmax(0,1fr)}.v74-doc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.v74-domain-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v74-domain-overview{min-height:218px;padding:13px}.v74-domain-detail-layout{grid-template-columns:1fr}.v74-domain-menu{display:flex;overflow-x:auto;scrollbar-width:thin}.v74-domain-menu button{width:auto;flex:0 0 auto;white-space:nowrap}.v74-domain-record{padding:13px}.v74-domain-record-head{display:grid}.v74-domain-fields,.v74-meeting-fields,.v74-feedback-grid,.v74-tracking-timeline,.v74-tracking-columns,.v74-doc-kpis{grid-template-columns:1fr}.v74-domain-count{max-width:46%;text-align:right}}
@media(max-width:460px){.v74-domain-overview-grid{grid-template-columns:1fr}.v74-domain-overview{min-height:190px}}
.v74-amenagements-container{grid-column:1/-1;display:grid;gap:10px;margin:10px 0;padding:14px;background:#f8fafc;border:1px solid #dbe3ef;border-radius:10px}
.v74-amenagements-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.v74-amenagements-title-block{display:grid;gap:2px}
.v74-amenagements-main-title{font-size:.84rem;font-weight:700;color:#1e293b}
.v74-amenagements-hint{font-size:.71rem;color:#64748b}
.v74-amenagements-list{display:grid;gap:8px}
.v74-amenagement-row{display:grid;grid-template-columns:36px auto 1fr;gap:10px;align-items:center;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:8px}
.v74-amenagement-row-top{display:contents}
.v74-amenagement-badge{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:999px;background:#e2e8f0;color:#1e293b;font-size:.75rem;font-weight:750}
.v74-amenagement-col-pom{display:flex;align-items:center;gap:6px}
.v74-pom-toggle{display:inline-flex;align-items:center;justify-content:center;position:relative;min-width:38px;min-height:38px;border-radius:6px;border:1.5px solid #cbd5e1;background:#fff;cursor:pointer;user-select:none;transition:all .15s ease}
.v74-pom-toggle input[type="checkbox"]{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.v74-pom-toggle-label{font-size:.82rem;font-weight:750;color:#475569}
.v74-pom-toggle.is-checked.v74-pom-toggle-p,.v74-pom-toggle-p:has(input:checked){border-color:#2563eb;background:#eff6ff}
.v74-pom-toggle-p:has(input:checked) .v74-pom-toggle-label,.v74-pom-toggle.is-checked.v74-pom-toggle-p .v74-pom-toggle-label{color:#1d4ed8}
.v74-pom-toggle.is-checked.v74-pom-toggle-o,.v74-pom-toggle-o:has(input:checked){border-color:#0d9488;background:#f0fdfa}
.v74-pom-toggle-o:has(input:checked) .v74-pom-toggle-label,.v74-pom-toggle.is-checked.v74-pom-toggle-o .v74-pom-toggle-label{color:#0f766e}
.v74-pom-toggle.is-checked.v74-pom-toggle-m,.v74-pom-toggle-m:has(input:checked){border-color:#7c3aed;background:#f5f3ff}
.v74-pom-toggle-m:has(input:checked) .v74-pom-toggle-label,.v74-pom-toggle.is-checked.v74-pom-toggle-m .v74-pom-toggle-label{color:#6d28d9}
.v74-amenagement-col-desc{min-width:0;width:100%}
.v74-amenagement-desc-input{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;font:inherit;font-size:.78rem;color:#172033;background:#fff;resize:vertical}
.v74-amenagement-col-actions{display:flex;align-items:center;gap:4px}
.v74-btn-icon{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;cursor:pointer;font-size:.8rem}
.v74-btn-icon:hover:not(:disabled){background:#f1f5f9;color:#0f172a}
.v74-btn-icon:disabled{opacity:.35;cursor:not-allowed}
.v74-btn-icon-delete:hover:not(:disabled){background:#fef2f2;border-color:#fecaca;color:#b91c1c}
.v74-amenagements-empty{padding:16px;text-align:center;font-size:.76rem;color:#64748b;font-style:italic;background:#fff;border:1px dashed #cbd5e1;border-radius:8px}
.v74-amenagements-footer{display:flex;justify-content:flex-start;margin-top:4px}
.v74-btn-outline{border:1px dashed #0a84ff;background:#f0f7ff;color:#0a84ff}
.v74-btn-outline:hover{background:#e0efff}
.v74-btn-secondary{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1}
.v74-btn-secondary:hover{background:#e2e8f0;color:#0f172a}
@media(max-width:820px){.v74-amenagement-row{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:12px;border-radius:10px}.v74-amenagement-row-top{display:flex;justify-content:space-between;align-items:center;width:100%}.v74-amenagement-col-pom{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}.v74-pom-toggle{min-height:44px;min-width:44px;width:100%}.v74-pom-toggle-label{font-size:.95rem}.v74-amenagement-desc-input{width:100%;min-height:52px}.v74-amenagement-col-actions{display:flex;justify-content:flex-end;gap:8px;width:100%}.v74-btn-icon{min-width:44px;min-height:44px;font-size:1rem}}
`;
document.head.appendChild(piaLayoutStyle);
(async()=>{await loadRef(); const boot=async()=>{applySchoolYearDateLimits();addUI();refreshStudents();bindPIAImport();attachPendingPIAImportWatcher();await scrubLegacyPIAFilenames();bindHomeDashboard()}; if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();})();
