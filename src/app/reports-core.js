/* =========================================================
   JOURNALIER V74 — PEDAGOGICAL REPORTS & SYNTHESIS ENGINE
   Module extrait de journalier-core.js (Lot 3.4)
   Architecture local-first / 100% navigateur (RGPD)
   Moteur de rapport naturel multi-profils (V0.1 à V0.8),
   synthèses visuelles Apple HIG, préparation de réunion,
   PV1/PV2 d'intégration et passerelle PIA.
   ========================================================= */

// Utilitaires de secours en cas d'exécution isolée
function escapeHtmlFallback(value) {
  return typeof globalThis.escapeHtml === 'function'
    ? globalThis.escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
if (typeof globalThis.escapeHtml !== 'function') {
  globalThis.escapeHtml = escapeHtmlFallback;
}

    /* =========================================================
       RAPPORT NATUREL V0.1
       ---------------------------------------------------------
       Principe : ne pas compter les cases pour les transformer
       artificiellement en conclusions. Le moteur rapproche les
       éléments réellement encodés et distingue :
       - faits observés
       - évolution / récurrence
       - aides et effets constatés
       - pistes de suite
       Toute formulation interprétative reste prudente.
       ========================================================= */

    /* =========================================================
       RAPPORT NATUREL V0.8 — TEST MULTI-PROFILS
       ---------------------------------------------------------
       Objectif : ne pas calibrer le rapport sur un seul profil.
       Les preuves sont séparées en :
       - apprentissages / fonctionnement de l'élève
       - contexte d'apprentissage
       - aides / actions
       - éléments positifs
       - éléments de difficulté
       - éléments neutres / absence / séance non informative

       Règles :
       1. Une difficulté n'est jamais créée parce qu'une séance comporte
          une aide ou un objectif de remédiation.
       2. Une réussite n'est jamais transformée en maîtrise générale.
       3. Un changement de contenu n'est pas une évolution.
       4. Le contexte de classe est séparé des caractéristiques de l'élève.
       5. Une relation entre deux séances n'est retenue que si le phénomène
          est suffisamment comparable.
       6. Les suites sont soit explicitement documentées, soit formulées
          comme pistes prudentes à partir d'un phénomène récurrent.
       ========================================================= */

    function reportUnique(values){ return [...new Set((values||[]).filter(v=>v!==undefined&&v!==null&&String(v).trim()!==''))]; }
    function reportRarityPhrase(values){
        const unique=reportUnique(values);
        if(!unique.length) return '';
        if(unique.length===1) return unique[0];
        if(unique.length===2) return `${unique[0]} et ${unique[1]}`;
        return `${unique.slice(0,-1).join(', ')} et ${unique[unique.length-1]}`;
    }
    function reportNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'").replace(/[^a-z0-9\s/+-]/g,' ').replace(/\s+/g,' ').trim(); }
    function reportDateKey(d){
        const s=String(d||'').trim();
        let m=s.match(/(\d{1,2})\s*[/]\s*(\d{1,2})\s*[/]\s*(\d{4})/);
        if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        m=s.match(/(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/i);
        if(m){ const months={janvier:1,fevrier:2,'février':2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,'août':8,septembre:9,octobre:10,novembre:11,decembre:12,'décembre':12}; return `${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
        return s;
    }
    function reportHumanDate(d){ const k=reportDateKey(d); if(!/^\d{4}-\d{2}-\d{2}$/.test(k)) return d||''; const [y,m,day]=k.split('-'); return `${day}/${m}/${y}`; }
    function reportTokens(s){ return reportNorm(s).split(' ').filter(w=>w.length>3); }

    function reportTheme(theme){
      const themes={
        procedural:{label:'l’organisation et la mise en œuvre des procédures',short:'organisation des procédures',kind:'fonctionnement'},
        memory:{label:'la mémorisation et la disponibilité des notions',short:'mémorisation',kind:'fonctionnement'},
        attention:{label:'l’attention et l’engagement dans la tâche',short:'attention et engagement',kind:'fonctionnement'},
        autonomy:{label:'l’autonomie dans la réalisation des tâches',short:'autonomie',kind:'fonctionnement'},
        help_seeking:{label:'le recours à la vérification ou à l’aide',short:'recours à l’aide',kind:'fonctionnement'},
        information_selection:{label:'la sélection et l’utilisation des informations pertinentes',short:'sélection des informations',kind:'fonctionnement'},
        vocabulary:{label:'la maîtrise du vocabulaire spécifique',short:'vocabulaire',kind:'apprentissage'},
        arithmetic:{label:'la disponibilité des faits et procédures arithmétiques',short:'faits/procédures arithmétiques',kind:'apprentissage'},
        algebra:{label:'la manipulation des expressions et procédures algébriques',short:'algèbre',kind:'apprentissage'},
        fractions:{label:'la compréhension et la mise en œuvre des fractions et divisions',short:'fractions/division',kind:'apprentissage'},
        geometry:{label:'la compréhension et la mise en œuvre des notions géométriques',short:'géométrie',kind:'apprentissage'},
        measurement:{label:'l’utilisation des outils et la précision des mesures',short:'mesure',kind:'fonctionnement'},
        graphomotor:{label:'le geste graphique et la réalisation des tracés',short:'geste graphique',kind:'fonctionnement'},
        quantities:{label:'la représentation des quantités',short:'représentation des quantités',kind:'apprentissage'},
        digital:{label:'l’utilisation des outils numériques',short:'outil numérique',kind:'outil'},
        group_work:{label:'la participation dans les situations de travail en groupe',short:'travail en groupe',kind:'fonctionnement'},
        classroom_context:{label:'les conditions de l’environnement de classe',short:'contexte de classe',kind:'contexte'},
        teacher_context:{label:'l’influence rapportée du contexte relationnel ou pédagogique',short:'contexte pédagogique',kind:'contexte'},
        motivation:{label:'la motivation et l’engagement',short:'motivation',kind:'fonctionnement'},
        distraction:{label:'les épisodes de distraction',short:'distraction',kind:'fonctionnement'},
        digital_transfer:{label:'le réinvestissement d’un outil numérique',short:'réinvestissement numérique',kind:'outil'}
      };
      return themes[theme]||{label:theme,short:theme,kind:'fonctionnement'};
    }

    function reportEffectLabel(v){
      const n=Number(v);
      if(n===2) return 'effet positif constaté';
      if(n===1) return 'effet partiel ou limité constaté';
      if(n===0) return 'aucun effet constaté';
      return '';
    }

    function reportIndicatorMatchScore(unit,indicator){
      const a=new Set(reportTokens(`${unit.text} ${unit.objective||''}`));
      const b=new Set(reportTokens(indicator.text||''));
      if(!a.size||!b.size) return 0;
      let overlap=0; b.forEach(t=>{if(a.has(t)) overlap++;});
      return overlap / Math.max(1,Math.min(a.size,b.size));
    }

    function reportSessionEvidence(log){
      const x=sessionParts(log), q4=log.q4||{}, q5=log.q5||{}, q6=log.q6||{}, q3=log.q3||{};
      const q2=(log.q2?.observations||[]).filter(o=>o?.observation).map(o=>({
        type:'observation',source:'q2',category:o.categorie||'',text:String(o.observation).trim(),level:o.niveau,
        date:x.date,matiere:x.matiere||log.contexte?.matiere||'',objectif:log.objectif?.objectifLecon||'',
        objectifPro:log.objectif?.objectifProfessionnel||''
      }));
      const precisions=[['q2',log.q2?.precision],['q3',log.q3?.precision],['q4',log.q4?.precision],['q5',log.q5?.precision],['q6',log.q6?.precision]]
        .filter(([,v])=>v).map(([source,v])=>({type:'precision',source,text:String(v).trim(),date:x.date,matiere:x.matiere||log.contexte?.matiere||'',objectif:log.objectif?.objectifLecon||'',objectifPro:log.objectif?.objectifProfessionnel||''}));
      const indicators=(q3.indicateurs||[]).filter(i=>i?.texte).map(i=>({type:'indicator',source:i.source||'bibliotheque',id:i.id||'',text:String(i.texte).trim(),appreciation:Number.isFinite(Number(i.appreciation))?Number(i.appreciation):null,date:x.date,objectif:log.objectif?.objectifLecon||''}));
      const effects=Object.fromEntries(Object.entries(q4.effets||{}).map(([k,v])=>[k,Number(v)]));
      return {
        log,date:x.date,dateKey:reportDateKey(x.date),matiere:x.matiere||log.contexte?.matiere||'',
        objectif:log.objectif?.objectifLecon||'',objectifPro:log.objectif?.objectifProfessionnel||'',
        observations:q2,precisions,indicators,
        wbeRepere:q3.repereWBE||{},
        adaptationSituation:q4.situation||'none',
        adaptations:reportUnique(q4.types||[]),effects,
        adaptationPrecision:String(q4.precision||'').trim(),
        transfer:q5.statut||'',transferPrecision:String(q5.precision||'').trim(),
        actions:reportUnique(q6.actions||[]),modality:q6.modalite||'',actionObjective:q6.objectif||'',
        collaborations:reportUnique(q6.collaborations||[]),actionPrecision:String(q6.precision||'').trim()
      };
    }

    function reportThemeUnit(e,text,theme,extra={}){
      const T=reportTheme(theme);
      return {id:`${e.dateKey}-${theme}-${Math.random().toString(36).slice(2,7)}`,date:e.date,dateKey:e.dateKey,matiere:e.matiere,objectif:e.objectif,objectivePro:e.objectifPro,text,theme,themeLabel:T.label,short:T.short,kind:T.kind,...extra};
    }

    function reportSignals(n){
      const positive=/\b(bonne comprehension|tres bonne comprehension|excellente comprehension|bonne evaluation|excellente evaluation|excellent travail|grande aisance|bien assimilee|assimilation rapide|vite compris|comprend le principe|comprend les concepts|s'en sort bien|se debrouille bien|autonome|travail en autonomie|participe activement|bonne participation|bonne implication|a bien retenu|maitrise bien|aucune difficulte|excelle|plus en confiance|bien maitrise|a avance rapidement|fait moins d'erreur|commence.*a rentrer|a bien compris|selectionne les informations utiles|applique la procedure|applique la methode)\b/.test(n);
      const explicitDifficulty=/\b(difficulte|difficultes|a du mal|plus de mal|ne maitrise pas|n'arrive pas|n.?est pas autonome|trop difficile|difficile pour|pose.*probleme|probleme.*pour|problematique|bloqu|confond|oublie|fatigue|distrait|dissip|decroch|manque de|hesite|erreurs|pas encore|pas solidement|inconstance|ne comprend pas|pas bien integre|mauvaises donnees|ordre de presentation|geste moteur|tenue des instruments|superposition|manquent de soin|alignement.*difficile|epuise|refuse de travailler)\b/.test(n);
      const genericProblem=/\b(probleme|mal)\b/.test(n);
      const difficulty=explicitDifficulty || (genericProblem && /\b(pose|posent|cause|causent|entraine|entraine des|source de)\b/.test(n));
      if(/\b(absente|absent|absence|eleve absente|prof absent|session de films)\b/.test(n)) return {positive:false,difficulty:false,neutral:true};
      return {positive,difficulty,neutral:!positive&&!difficulty};
    }

    function reportExtractUnits(evidence){
      const units=[];
      evidence.forEach(e=>e.observations.forEach(o=>{
        const n=reportNorm(o.text), objective=reportNorm(e.objectif), catNorm=reportNorm(o.category);
        const signals=reportSignals(n);
        const rawLevel=(o.level!==null&&o.level!==undefined&&o.level!=='')?Number(o.level):null;
        const hasQ2Level=rawLevel===0||rawLevel===1||rawLevel===2;
        const q2Level=hasQ2Level?rawLevel:undefined;
        const q2LevelLabel=hasQ2Level?historyQ2LevelLabel(rawLevel):'';
        let addedForObs=false;
        const add=(theme,extra={})=>{
          addedForObs=true;
          const isCtx=Boolean(extra.context);
          const posSig=(!isCtx&&hasQ2Level)?(rawLevel===2):Boolean(extra.positive??signals.positive);
          const funcSig=(!isCtx&&hasQ2Level)?(rawLevel===1):false;
          const diffSig=(!isCtx&&hasQ2Level)?(rawLevel===0):Boolean(signals.difficulty&&!extra.positive);
          const pol=isCtx?'neutral':hasQ2Level?(rawLevel===2?'positive':rawLevel===1?'functional':'difficulty'):(posSig&&diffSig?'mixed':posSig?'positive':diffSig?'difficulty':'neutral');
          const safeExtra={...extra};
          if(!isCtx&&hasQ2Level) safeExtra.positive=(rawLevel===2);
          units.push(reportThemeUnit(e,o.text,theme,{
            category:o.category,level:o.level,q2Level,q2LevelLabel,
            positiveSignal:posSig,functionalSignal:funcSig,difficultySignal:diffSig,polarity:pol,
            ...safeExtra
          }));
        };

        if(/classe bruyante|classe tres bruyante|perturbations|dynamique de classe|climat de classe|eleves perturbateurs|impossible de suivre le cours|difficile de se concentrer|ton monte|enseignante.*autorite|rapport avec l'enseignante|enseignante.*cadrante/.test(n)) add('classroom_context',{context:true});
        if(/preoccupee par.*interrogation|stagiaire|plus de mal.*stagiaire|enseignant.*donne envie|ambiance.*enseignante/.test(n)) add('teacher_context',{context:true});
        if(/travail en groupe|travailler en groupe|projets comme celui-ci|manque de creativite|participation.*groupe/.test(n)) add('group_work');
        if(/ipad|tablette|outil numerique|telephone|internet pour rechercher/.test(n)) add('digital');
        if(/autonome|autonomie|travail en autonomie|seule|sans aide/.test(n)) add('autonomy',{positive:/autonome|travail en autonomie/.test(n)});
        if(/demande.*verifie|verifier ses reponses|se rassurer|demande de l'aide|solicite|sollicite/.test(n)) add('help_seeking');
        if(/attention|attentive|distrait|dissip|epuise|fatigue|decroch|focus|perturbe|motivation|envie de travailler|refuse de travailler|engagement/.test(n)) add(/distrait|perturbe|dissip/.test(n)?'distraction':'attention');
        if(/motivation|envie de travailler|refuse de travailler|plus motivee|bonne implication|bonne participation|participe activement/.test(n)) add('motivation');
        if(/etape|process|procedure|regle|methode|valider chaque etape|plus lent|pas solidement|inconstance|erreurs|minimiser les erreurs|planif/.test(n)) add('procedural');
        if(/memor|retient|reapprendre|souvenir|oublie|d'une semaine a l'autre/.test(n)) add('memory');
        if(/vocabulaire|termes|notions de vocabulaire|consigne|reformul/.test(n)) add(/vocabulaire|termes/.test(n)?'vocabulary':'information_selection');
        if(/tables de multiplication|multiplication|additions|soustraction|signes|calculs|operations|valeur absolue|equation|puissances/.test(n)) add('arithmetic');
        if(/algebre|termes litteraux|termes semblables|exposants|factorisation|polynome|pemdas|parentheses/.test(n)) add('algebra');
        if(/fraction|division|numerateur|denominateur|parts visualisable/.test(n)) add('fractions');
        if(/angle|geometr|pythagore|triangle|quadrilat|hypotenuse|traces|equerre/.test(n)||/angle|geometr|pythagore|triangle|quadrilat|hypotenuse/.test(objective)) add('geometry');
        if(/mesur|equerre|regle|instruments/.test(n)) add('measurement');
        if(/geste moteur|tenue des instruments|traces.*manquent|superposition de l.?equerre|align(e|é)ment.*chiffres|alignement/.test(n)) add('graphomotor');
        if(/quantites|ordre de grandeur/.test(n)) add('quantities');
        if(/ordre de presentation|extraire.*information|informations non essentielles|mauvaises donnees|pertinente|pertinence|tenir compte des informations|identifie les informations/.test(n)) add('information_selection');
        if(/bien compris|compris le principe|comprend les concepts|bonne comprehension|excellente comprehension|aucune difficulte|excelle|aisance|assimilation rapide|vite compris|methode bien assimilee|excellent travail|bonne evaluation|participe activement/.test(n) && /process|procedure|methode|regle|etape|calcul|operations|formule/.test(objective+' '+n)) add('procedural',{positive:true});
        if(/ipad|tablette/.test(n)) add('digital_transfer',{positive:/maitrise bien|bien maitrise|bonne maitrise/.test(n)});
        if(!addedForObs){
          const fallbackTheme=/comprehension|traitement/.test(catNorm)?'information_selection':/organisation|executiv/.test(catNorm)?'procedural':/aide|engagement/.test(catNorm)?'autonomy':'procedural';
          add(fallbackTheme);
        }
      }));
      const seen=new Set();
      return units.filter(u=>{const k=[u.dateKey,u.theme,reportNorm(u.text)].join('|');if(seen.has(k))return false;seen.add(k);return true;});
    }

    function reportGroupByTheme(units){ const m={}; units.forEach(u=>(m[u.theme]??=[]).push(u)); Object.values(m).forEach(a=>a.sort((x,y)=>x.dateKey.localeCompare(y.dateKey))); return m; }

    function reportIsLikelyOutlierDate(dateKey, allDates){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)||!allDates.length) return false;
      const first=allDates[0], startYear=Number(first.slice(0,4)), expectedEnd=`${startYear+1}-08-31`;
      return dateKey>expectedEnd;
    }

    function reportRelations(units){
      const groups=reportGroupByTheme(units), out={recurrences:[],crossContext:[],evolutions:[],cautions:[],contextUnits:[]};
      out.contextUnits=units.filter(u=>u.context);
      const allDates=reportUnique(units.map(u=>u.dateKey).filter(Boolean)).sort();
      Object.entries(groups).forEach(([theme,arr])=>{
        const comparable=arr.filter(u=>!u.context), dates=reportUnique(comparable.map(u=>u.dateKey));
        const temporal=comparable.filter(u=>!reportIsLikelyOutlierDate(u.dateKey,allDates));
        if(dates.length>=2){
          const contexts=reportUnique(comparable.map(u=>u.objectif).filter(Boolean));
          const positives=comparable.filter(u=>u.positiveSignal||u.positive);
          const functionals=comparable.filter(u=>u.functionalSignal&&!u.positiveSignal&&!u.positive);
          const difficulties=comparable.filter(u=>u.difficultySignal&&!u.positive&&!u.functionalSignal);
          out.recurrences.push({theme,units:comparable,dates,contexts,positives,functionals,difficulties});
          if(contexts.length>=2) out.crossContext.push({theme,units:comparable,contexts});
          const temporalPositives=temporal.filter(u=>u.positiveSignal||u.positive);
          const temporalFunctionals=temporal.filter(u=>u.functionalSignal&&!u.positiveSignal&&!u.positive);
          const temporalDifficulties=temporal.filter(u=>u.difficultySignal&&!u.positive&&!u.functionalSignal);
          const bucketCount=[temporalPositives.length>0,temporalFunctionals.length>0,temporalDifficulties.length>0].filter(Boolean).length;
          if(bucketCount>=2){
            const firstDiff=temporalDifficulties[0]?.dateKey||'';
            const firstFunc=temporalFunctionals[0]?.dateKey||'';
            const firstPos=temporalPositives[0]?.dateKey||'';
            const laterPositive=(firstDiff&&temporalPositives.some(u=>u.dateKey>firstDiff))||(firstFunc&&temporalPositives.some(u=>u.dateKey>firstFunc))||false;
            const laterFunctional=firstDiff?temporalFunctionals.some(u=>u.dateKey>firstDiff):false;
            const laterDiff=(firstPos&&temporalDifficulties.some(u=>u.dateKey>firstPos))||(firstFunc&&temporalDifficulties.some(u=>u.dateKey>firstFunc))||false;
            const progressionToFunctional=Boolean(firstDiff&&laterFunctional&&!laterDiff&&!temporalPositives.length);
            const progressionFromFunctionalToPositive=Boolean(!firstDiff&&firstFunc&&laterPositive&&!laterDiff);
            out.evolutions.push({
              theme,units:temporal,
              positives:temporalPositives,functionals:temporalFunctionals,difficulties:temporalDifficulties,
              laterPositive:Boolean(laterPositive),laterFunctional:Boolean(laterFunctional),laterDiff:Boolean(laterDiff),
              progressionToFunctional,progressionFromFunctionalToPositive
            });
          }
        }
      });
      return out;
    }

    /*
      Chaînage des données : chaque lien est une association documentaire au niveau de la séance.
      Le modèle actuel ne contient pas encore d'ID relationnel entre Q2, Q3, Q4, Q5 et Q6.
      On ne prétend donc pas qu'une adaptation a causé un effet : on indique qu'elle est
      renseignée dans la même séance que l'observation et l'indicateur, puis on cherche
      une répétition comparable dans le temps.
    */
    function reportBuildSessionLinks(evidence,units){
      const byDate=new Map(evidence.map(e=>[e.dateKey,e]));
      const links=[];
      units.forEach(u=>{
        const e=byDate.get(u.dateKey); if(!e) return;
        const rankedIndicators=e.indicators.map(i=>({i,score:reportIndicatorMatchScore(u,i)})).sort((a,b)=>b.score-a.score);
        let indicators=[];
        if(rankedIndicators.length){
          const top=rankedIndicators.filter(x=>x.score>0).slice(0,2).map(x=>x.i);
          indicators=top.length?top:(rankedIndicators.length<=2?rankedIndicators.map(x=>x.i):[]);
        }
        const adaptations=e.adaptations.map(type=>({type,effect:e.effects[type],effectLabel:reportEffectLabel(e.effects[type])}));
        const q6=[...e.actions];
        const q6Precision=e.actionPrecision;
        const q5=e.transfer?{status:e.transfer,precision:e.transferPrecision}:null;
        const wbe=e.wbeRepere?.hit?{hit:e.wbeRepere.hit,signature:e.wbeRepere.signature||'',kind:e.wbeRepere.kind||'',bridgeId:e.wbeRepere.bridgeId||'',source:e.wbeRepere.source||'',indicatorIds:e.wbeRepere.indicatorIds||[]}:null;
        if(!indicators.length&&!adaptations.length&&!q6.length&&!q5&&!wbe&&!e.modality&&!e.actionObjective&&!(e.collaborations||[]).length) return;
        links.push({unit:u,evidence:e,indicators,indicatorAssociation:indicators.length?'same_session':'none',wbe,adaptations,transfer:q5,actions:q6,modality:e.modality||'',actionObjective:e.actionObjective,collaborations:e.collaborations,actionPrecision:q6Precision});
      });
      return links;
    }

    function reportLinkEvolution(link,allLinks){
      const same=allLinks.filter(x=>x!==link && x.unit.theme===link.unit.theme && x.unit.dateKey!==link.unit.dateKey).sort((a,b)=>a.unit.dateKey.localeCompare(b.unit.dateKey));
      if(!same.length) return {status:'none',text:''};
      const later=same.filter(x=>x.unit.dateKey>link.unit.dateKey);
      if(!later.length) return {status:'none',text:''};
      const laterWithPositive=link.unit.positiveSignal ? later.filter(x=>x.unit.positiveSignal).length : 0;
      const laterWithFunctional=link.unit.functionalSignal ? later.filter(x=>x.unit.functionalSignal||x.unit.positiveSignal||x.unit.difficultySignal).length : 0;
      const laterWithDifficulty=link.unit.difficultySignal ? later.filter(x=>x.unit.difficultySignal).length : 0;
      const sameIndicator=link.indicators.length && later.some(x=>x.indicators.some(i=>link.indicators.some(j=>i.id&&j.id&&i.id===j.id)));
      if(sameIndicator || laterWithPositive || laterWithFunctional || laterWithDifficulty){
        return {status:'situated',text:`Le même domaine est documenté à nouveau dans ${later.length} séance${later.length>1?'s':''} ultérieure${later.length>1?'s':''}. Cette comparaison permet de décrire une évolution située, sans conclure à une généralisation.`};
      }
      return {status:'none',text:''};
    }

    function reportChainLabel(link){
      const obs=link.unit.short;
      const q2Lvl=link.unit.q2LevelLabel?` (niveau constaté : ${link.unit.q2LevelLabel.toLocaleLowerCase('fr')})`:'';
      const ctx=[link.unit.matiere,link.unit.objectif].filter(Boolean).join(' — ');
      const ind=link.indicators.slice(0,2).map(i=>`${i.text}${i.appreciation!==null&&i.appreciation!==undefined?` (${reportIndicatorLabel(i.appreciation).toLocaleLowerCase('fr')})`:''}`);
      const ad=link.adaptations;
      const parts=[`Observation : ${obs}${q2Lvl}${ctx?` [${ctx}]`:''}`];
      if(ind.length) parts.push(`Indicateur associé dans la même séance : ${reportRarityPhrase(ind)}`);
      if(link.wbe) parts.push(`Repère WBE validé : ${link.wbe.signature||link.wbe.hit}`);
      if(ad.length) parts.push(`Aide/adaptation renseignée : ${reportRarityPhrase(ad.map(a=>a.type))}${ad.some(a=>a.effectLabel)?` (${reportRarityPhrase(ad.map(a=>a.effectLabel).filter(Boolean))})`:''}`);
      if(link.transfer) parts.push(`Transfert : ${historyQ5TransferLabel(link.transfer.status).toLocaleLowerCase('fr')}${link.transfer.precision?` (${link.transfer.precision})`:''}`);
      if(link.actions.length) parts.push(`Suite : ${reportRarityPhrase(link.actions)}`);
      if(link.modality) parts.push(`Modalité : ${link.modality}`);
      if(link.actionObjective) parts.push(`Orientation : ${link.actionObjective}`);
      if((link.collaborations||[]).length) parts.push(`Collaboration : ${reportRarityPhrase(link.collaborations)}`);
      return parts.join(' · ')+'.';
    }

    function reportCompareLinkedChains(links){
      const groups=new Map();
      links.forEach(l=>{
        const ids=l.indicators.map(i=>i.id).filter(Boolean);
        const key=ids.length?`indicator:${ids.join('|')}`:`theme:${l.unit.theme}`;
        if(!groups.has(key)) groups.set(key,[]);
        groups.get(key).push(l);
      });
      const out=[];
      for(const arr of groups.values()){
        arr.sort((a,b)=>a.unit.dateKey.localeCompare(b.unit.dateKey));
        if(arr.length<2) continue;
        const first=arr[0], last=arr[arr.length-1];
        const firstInd=first.indicators[0], lastInd=last.indicators.find(i=>!firstInd?.id||i.id===firstInd.id)||last.indicators[0];
        const changes=[];
        const q2Stages=reportUnique(arr.map(x=>x.unit.q2LevelLabel).filter(Boolean));
        if(first.unit.q2Level!==undefined&&last.unit.q2Level!==undefined&&(first.unit.q2Level!==last.unit.q2Level||q2Stages.length>=2)){
          const trajectoryStr=arr.map(x=>x.unit.q2LevelLabel).filter(Boolean).filter((v,idx,a)=>idx===0||v!==a[idx-1]).join(' → ');
          if(trajectoryStr.includes('→')) changes.push(`le niveau qualitatif Q2 évolue selon la séquence « ${trajectoryStr} »`);
        }
        if(firstInd&&lastInd&&firstInd.appreciation!==null&&lastInd.appreciation!==null&&firstInd.appreciation!==lastInd.appreciation){
          const labels=['À renforcer','En cours d’appropriation','Maîtrisé'];
          changes.push(`l’appréciation passe de « ${labels[firstInd.appreciation]||firstInd.appreciation} » à « ${labels[lastInd.appreciation]||lastInd.appreciation} »`);
        }
        const firstAdapt=first.adaptations.map(a=>a.type), lastAdapt=last.adaptations.map(a=>a.type);
        if(firstAdapt.length||lastAdapt.length){
          const common=lastAdapt.filter(x=>firstAdapt.includes(x));
          if(common.length){
            const fe=first.adaptations.filter(a=>common.includes(a.type)).map(a=>a.effect).filter(v=>v!==undefined);
            const le=last.adaptations.filter(a=>common.includes(a.type)).map(a=>a.effect).filter(v=>v!==undefined);
            if(fe.length&&le.length&&fe[0]!==le[0]) changes.push(`${common[0]} est renseigné avec ${reportEffectLabel(fe[0]).replace(' constaté','')} puis ${reportEffectLabel(le[0]).replace(' constaté','')}`);
          } else if(firstAdapt.join('|')!==lastAdapt.join('|')) changes.push(`les aides renseignées évoluent de « ${reportRarityPhrase(firstAdapt)||'aucune'} » vers « ${reportRarityPhrase(lastAdapt)||'aucune'} »`);
        }
        if(first.actions.join('|')!==last.actions.join('|') && (first.actions.length||last.actions.length)) changes.push(`les suites Q6 évoluent de « ${reportRarityPhrase(first.actions)||'aucune'} » vers « ${reportRarityPhrase(last.actions)||'aucune'} »`);
        if((first.transfer?.status||'')!==(last.transfer?.status||'') && (first.transfer||last.transfer)){ const transferLabel=v=>({observed:'observé',not_observed:'non observé',no_opportunity:'pas d’occasion',later:'à observer plus tard',not_relevant:'non pertinent','':'non renseigné'}[v]||(v?'valeur non standard':'non renseigné')); changes.push(`le statut de transfert passe de « ${transferLabel(first.transfer?.status)} » à « ${transferLabel(last.transfer?.status)} »`); }
        if(changes.length){
          const label=lastInd?.text||reportTheme(last.unit.theme).short;
          out.push(`Entre le ${reportHumanDate(first.unit.date)} et le ${reportHumanDate(last.unit.date)}, pour ${label}, les données enregistrées documentent que ${changes.join('; ')}. Cela décrit une évolution des données renseignées et ne permet pas, à lui seul, d’attribuer cette évolution à l’adaptation utilisée.`);
        }
      }
      return out.slice(0,4);
    }

    function reportLinkedSynthesis(evidence,units,relations){
      const links=reportBuildSessionLinks(evidence,units), usable=links.filter(l=>l.indicators.length||l.wbe||l.adaptations.length||l.actions.length||l.transfer||l.modality||l.actionObjective||(l.collaborations||[]).length);
      if(!usable.length) return {paragraphs:[`Les champs Q3 à Q6 ne documentent pas suffisamment de relations dans cette période pour établir une chaîne observation → indicateur → aide → effet → évolution → suite.`],links:[],evidenceCount:0};
      const strong=usable.filter(l=>l.indicators.length||l.wbe).slice(0,5);
      const paragraphs=[];
      const withAdapt=usable.filter(l=>l.adaptations.length);
      const withEffects=withAdapt.filter(l=>l.adaptations.some(a=>a.effect!==undefined&&!Number.isNaN(a.effect)));
      const withActions=usable.filter(l=>l.actions.length||l.actionObjective||l.modality||(l.collaborations||[]).length);
      const withTransfer=usable.filter(l=>l.transfer);
      const comparisons=reportCompareLinkedChains(usable);
      paragraphs.push(`${usable.length} chaîne${usable.length>1?'s':''} documentaire${usable.length>1?'s':''} relie${usable.length>1?'nt':''} au moins une observation Q2 à des données Q3–Q6 dans la même séance. Ces rapprochements sont documentaires : ils n'établissent pas à eux seuls une relation causale entre une aide et un effet.`);
      if(strong.length){
        paragraphs.push(strong.slice(0,3).map(reportChainLabel).join(' '));
      }else{
        paragraphs.push(usable.slice(0,3).map(reportChainLabel).join(' '));
      }
      if(withEffects.length){
        const positive=withEffects.filter(l=>l.adaptations.some(a=>a.effect===2)).length;
        const partial=withEffects.filter(l=>l.adaptations.some(a=>a.effect===1)).length;
        paragraphs.push(`Les effets d'adaptation sont renseignés pour ${withEffects.length} chaîne${withEffects.length>1?'s':''} ; ${positive} comportent au moins un effet positif constaté et ${partial} au moins un effet partiel ou limité. L'interprétation reste liée à la séance concernée.`);
      }
      if(withTransfer.length){
        const observed=withTransfer.filter(l=>l.transfer.status==='observed').length;
        paragraphs.push(`Le transfert est explicitement renseigné dans ${withTransfer.length} chaîne${withTransfer.length>1?'s':''}, dont ${observed} avec le statut « observé ». Le statut Q5 est conservé comme donnée déclarée et n'est pas transformé en preuve de généralisation.`);
      }
      if(withActions.length){
        paragraphs.push(`Les suites Q6 sont maintenant intégrées à la synthèse : elles sont présentées comme des décisions ou pistes retenues pour la suite, et non comme des effets déjà démontrés.`);
      }
      if(comparisons.length){
        paragraphs.push(`Évolution des chaînes documentaires : ${comparisons.join(' ')}`);
      }
      return {paragraphs,links,evidenceCount:usable.length};
    }

    function reportThemeRank(r){
      const contextThemes=['classroom_context','teacher_context'], toolThemes=['digital','digital_transfer'];
      const learningThemes=['vocabulary','arithmetic','algebra','fractions','geometry','quantities'];
      const functionalThemes=['procedural','memory','attention','autonomy','help_seeking','information_selection','measurement','graphomotor','group_work','motivation','distraction'];
      let score=0;
      score += Math.min(r.dates.length,5)*2.0; score += Math.min(r.units.length,8)*0.35; score += Math.min(r.difficulties.length,5)*3.2; score += Math.min((r.functionals||[]).length,5)*2.2; score += Math.min(r.positives.length,5)*1.5;
      if(r.evolution) score += 2.5; if(r.mixed) score += 0.8; if(r.type==='strength') score += 5.5; if(r.type==='strength_with_variability') score += 4.0; if(r.type==='fragility') score += 3.5; if(r.type==='fragility_with_success') score += 2.5; if(r.type==='functional') score += 3.2; if(r.type==='functional_with_fragility'||r.type==='functional_with_strength') score += 3.0;
      if(learningThemes.includes(r.theme)) score += 0.8; if(functionalThemes.includes(r.theme)) score += 0.8; if(toolThemes.includes(r.theme)) score -= 0.8; if(contextThemes.includes(r.theme)) score -= 4;
      return score;
    }

    function reportBuildHierarchy(units,relations){
      const rec=(relations.recurrences||[]).filter(r=>!['classroom_context','teacher_context'].includes(r.theme));
      const evMap=new Map((relations.evolutions||[]).map(e=>[e.theme,e]));
      const learningThemes=['vocabulary','arithmetic','algebra','fractions','geometry','quantities'];
      const findings=rec.map(r=>{
        const evolution=evMap.get(r.theme)||null;
        const pos=r.positives.length, func=(r.functionals||[]).length, diff=r.difficulties.length;
        const mixed=Boolean((pos&&diff)||(func&&(pos||diff)));
        let type='neutral';
        if(pos&&diff){
          if(pos>=diff*2)type='strength_with_variability';
          else if(diff>=pos*2)type='fragility_with_success';
          else type='mixed';
        }else if(func&&!pos&&!diff){
          type='functional';
        }else if(func&&diff&&!pos){
          type='functional_with_fragility';
        }else if(func&&pos&&!diff){
          type='functional_with_strength';
        }else if(diff){
          type='fragility';
        }else if(pos){
          type='strength';
        }
        const x={...r,evolution,mixed,type,domain:learningThemes.includes(r.theme)?'learning':'functioning'}; x.score=reportThemeRank(x); return x;
      }).sort((a,b)=>b.score-a.score);
      return {findings,learning:findings.filter(f=>f.domain==='learning'),functioning:findings.filter(f=>f.domain==='functioning'),context:(relations.contextUnits||[])};
    }

    function reportFindingPhrase(f){
      const label=reportTheme(f.theme).short;
      if(f.type==='fragility') return `des fragilités récurrentes concernant ${label}`;
      if(f.type==='fragility_with_success') return `des fragilités récurrentes concernant ${label}, malgré quelques réussites`;
      if(f.type==='functional') return `une compétence fonctionnelle dans les situations courantes concernant ${label} (dont certaines subtilités ou situations complexes restent à consolider)`;
      if(f.type==='functional_with_fragility') return `un fonctionnement suffisant dans certaines situations courantes concernant ${label}, mais encore partiel ou fragile dans d’autres`;
      if(f.type==='functional_with_strength') return `une mobilisation suffisante à totale selon les situations concernant ${label}`;
      if(f.type==='strength') return `des points d’appui concernant ${label}`;
      if(f.type==='strength_with_variability') return `un point d’appui concernant ${label}, avec quelques variations selon les situations`;
      if(f.type==='mixed') return `des observations contrastées dans le domaine ${label}`;
      return `des observations récurrentes concernant ${label}`;
    }

    function reportHierarchyParagraph(units,relations){
      const h=reportBuildHierarchy(units,relations), learning=h.learning.slice(0,2), functioning=h.functioning.slice(0,2);
      if(!learning.length&&!functioning.length) return `Les observations restent trop ponctuelles pour établir une hiérarchie fiable entre les différents phénomènes documentés.`;
      const parts=[]; if(learning.length)parts.push(`Sur le plan des apprentissages, ressortent ${reportRarityPhrase(learning.map(reportFindingPhrase))}`); if(functioning.length)parts.push(`Sur le plan du fonctionnement, ressortent ${reportRarityPhrase(functioning.map(reportFindingPhrase))}`);
      let p=parts.join('. ')+'.'; const lead=[...learning,...functioning][0];
      if(lead){
        if(lead.type==='fragility'||lead.type==='fragility_with_success')p+=` Le principal point de vigilance documenté concerne ${reportTheme(lead.theme).short}.`;
        else if(lead.type==='functional'||lead.type==='functional_with_fragility'||lead.type==='functional_with_strength')p+=` Le principal constat documenté concerne ${reportTheme(lead.theme).short}, fonctionnel dans les situations courantes observées mais dont certaines subtilités, situations complexes ou transferts restent à consolider.`;
        else if(lead.type==='strength'||lead.type==='strength_with_variability')p+=` Le principal point d’appui documenté concerne ${reportTheme(lead.theme).short}.`;
        else if(lead.type==='mixed')p+=` L’élément le plus saillant est contrasté : ${reportTheme(lead.theme).short} est observé favorablement dans certaines situations et plus difficilement dans d’autres.`;
      }
      if(h.context.length)p+=` Les facteurs de contexte sont présentés séparément afin de ne pas les confondre avec le fonctionnement de l’élève.`; return p;
    }

    function reportPriorityDetails(units,relations){
      const h=reportBuildHierarchy(units,relations), top=[...h.learning.slice(0,2),...h.functioning.slice(0,2)], p=[];
      top.forEach(f=>{const label=reportTheme(f.theme).label;let text;
        const funcCount=(f.functionals||[]).length;
        if(f.type==='mixed')text=`${label} apparaît de façon contrastée dans ${f.dates.length} dates documentées : ${f.positives.length} observation${f.positives.length>1?'s':''} rapporte${f.positives.length>1?'nt':''} un élément maîtrisé/favorable${funcCount?`, ${funcCount} un niveau fonctionnel (« suffisamment »)`:''} et ${f.difficulties.length} une fragilité (« partiellement »). `;
        else if(f.type==='functional'){text=`${label} est observé avec le niveau « suffisamment » sur ${f.dates.length} dates documentées : la compétence est fonctionnelle dans les situations courantes observées, mais certaines subtilités, situations complexes ou transferts restent à renforcer. `;}
        else if(f.type==='functional_with_fragility'){text=`${label} est documenté sur ${f.dates.length} dates entre les niveaux « partiellement » (${f.difficulties.length}) et « suffisamment » (${funcCount}) : la compétence devient fonctionnelle dans certaines situations courantes, tout en nécessitant encore un accompagnement ou une consolidation. `;}
        else if(f.type==='functional_with_strength'){text=`${label} est documenté sur ${f.dates.length} dates entre les niveaux « suffisamment » (${funcCount}) et « totalement » (${f.positives.length}) dans les situations observées. `;}
        else if(f.type==='fragility'||f.type==='fragility_with_success'){text=`${label} constitue un point de vigilance récurrent, retrouvé sur ${f.dates.length} dates documentées. `;if(f.type==='fragility_with_success')text+=`Quelques réussites sont également rapportées dans ce domaine. `;}
        else if(f.type==='strength'||f.type==='strength_with_variability'){text=`${label} constitue un point d’appui récurrent, retrouvé sur ${f.dates.length} dates documentées. `;if(f.type==='strength_with_variability')text+=`Quelques variations ou difficultés apparaissent toutefois selon les situations. `;} else text=`${label} est documenté à plusieurs reprises. `;
        if(f.evolution){
          if(f.evolution.progressionToFunctional)text+=`Les observations évoluent de « partiellement » vers « suffisamment » dans les situations étudiées ; la compétence devient fonctionnelle dans les tâches courantes, sans conclure à une maîtrise complète des subtilités. `;
          else if(f.evolution.progressionFromFunctionalToPositive)text+=`Les observations évoluent de « suffisamment » vers « totalement » dans les situations étudiées ; cela documente une évolution située en contexte, sans conclure à une généralisation automatique. `;
          else if(f.evolution.laterPositive&&!f.evolution.laterDiff)text+=`Les observations deviennent ensuite plus favorables dans certaines situations ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale. `;
          else if(f.evolution.laterDiff&&!f.evolution.laterPositive)text+=`Des observations plus difficiles apparaissent ensuite dans certaines situations ; cela suggère une variabilité selon les tâches ou contextes plutôt qu’une dégradation générale. `;
          else text+=`Les observations positives et les difficultés coexistent sur la période ; aucune trajectoire unique ne peut être retenue. `;
        }
        if(f.contexts.length>=2)text+=`Le phénomène est observé dans plusieurs objectifs de séance, mais cela ne suffit pas à établir un transfert ou une généralisation. `; p.push(text.trim()); }); return p;
    }

    function reportContextParagraph(evidence,student){
      const dates=evidence.map(e=>e.dateKey).filter(Boolean).sort(); let p=`La période analysée comprend ${evidence.length} séance${evidence.length>1?'s':''} documentée${evidence.length>1?'s':''}`; if(dates.length)p+=` du ${reportHumanDate(dates[0])} au ${reportHumanDate(dates[dates.length-1])}`; p+=`. Les éléments ci-dessous distinguent les apprentissages, le fonctionnement observé, les aides renseignées et les suites retenues afin de ne pas confondre ces niveaux.`; return p;
    }

    function reportLearningStructuredBlocks(evidence){
      const byApp=new Map([
        [2,{label:'les éléments suivants constituent des points d’appui (maîtrisés)',subjects:new Map()}],
        [1,{label:'les éléments suivants sont en cours d’appropriation',subjects:new Map()}],
        [0,{label:'les éléments suivants restent à renforcer',subjects:new Map()}]
      ]);
      evidence.forEach(e=>{
        const subj=String(e.matiere||'Matière non renseignée').trim()||'Matière non renseignée';
        const chap=resolveSynthesisCanonicalChapter(e.log||{contexte:{matiere:e.matiere},objectif:{objectifLecon:e.objectif},q3:{repereWBE:e.wbeRepere}})||formatChapterName(e.objectif)||'Séance observée';
        (e.indicators||[]).forEach(i=>{
          const txt=toInfinitivePhrase(i.text).replace(/\.$/,'').trim();
          if(!txt)return;
          const appKey=(i.appreciation===0||i.appreciation===1||i.appreciation===2)?Number(i.appreciation):1;
          const bucket=byApp.get(appKey);
          if(!bucket.subjects.has(subj))bucket.subjects.set(subj,new Map());
          const chapMap=bucket.subjects.get(subj);
          if(!chapMap.has(chap))chapMap.set(chap,new Map());
          const skillMap=chapMap.get(chap);
          const sKey=semanticSkillDedupeKey(txt);
          if(!skillMap.has(sKey))skillMap.set(sKey,txt);
          else skillMap.set(sKey,pickPreferredSkillLabel(skillMap.get(sKey),txt));
        });
      });
      return [...byApp.entries()].filter(([,b])=>b.subjects.size>0).map(([key,b])=>({
        key,
        intro:`Les éléments suivants ${key===2?'sont bien maîtrisés en séance':key===1?'sont en cours d’appropriation':'restent à renforcer'} :`,
        subjects:[...b.subjects.entries()].map(([subject,chapMap])=>({
          subject,
          chapters:[...chapMap.entries()].map(([chapter,skillMap])=>({chapter,items:[...skillMap.values()]}))
        }))
      }));
    }

    function reportLearningSectionHtml(evidence,relations){
      const blocks=reportLearningStructuredBlocks(evidence);
      const h=reportBuildHierarchy([],relations), l=h.learning.slice(0,4);
      const parts=[];
      if(l.length){
        parts.push(`<p>${escapeHtml(`Les apprentissages les plus documentés concernent ${reportRarityPhrase(l.map(reportFindingPhrase))}.`)}</p>`);
      }
      if(blocks.length){
        blocks.forEach(b=>{
          parts.push(`<p><strong>${escapeHtml(b.intro)}</strong></p>`);
          const itemsHtml=b.subjects.map(sg=>`<div class="synth-clean-group synth-tree-group" style="margin:6px 0 10px 4px;">
            <strong>${escapeHtml(sg.subject)} :</strong>
            <ul class="synth-tree-chapters">
              ${sg.chapters.map(c=>`<li>
                <span class="synth-tree-chapter-title">${escapeHtml(c.chapter)}</span>
                <ul class="synth-tree-skills">
                  ${c.items.map(it=>`<li>${escapeHtml(it)}</li>`).join('')}
                </ul>
              </li>`).join('')}
            </ul>
          </div>`).join('');
          parts.push(itemsHtml);
        });
        return parts.join('');
      }
      return `<p>${escapeHtml(reportLearningParagraph(evidence,relations))}</p>`;
    }

    function reportLearningParagraph(evidence,relations){
      const h=reportBuildHierarchy([],relations), l=h.learning.slice(0,4);
      const blocks=reportLearningStructuredBlocks(evidence);
      const formattedBlocks=blocks.map(b=>{
        const subjParts=b.subjects.map(sg=>`${sg.subject} : ${sg.chapters.map(c=>`- ${c.chapter} (${c.items.map(it=>`* ${it}`).join(' ; ')})`).join(' · ')}`);
        return `${b.intro} ${subjParts.join(' | ')}`;
      });
      if(!l.length){
        if(formattedBlocks.length) return formattedBlocks.join(' ');
        return `Les données ne permettent pas de hiérarchiser suffisamment les apprentissages sur la période.`;
      }
      const base=`Les apprentissages les plus documentés sont ${reportRarityPhrase(l.map(reportFindingPhrase))}. Cette hiérarchie repose sur la récurrence et la polarité des observations ; elle ne constitue pas un classement du niveau scolaire.`;
      return formattedBlocks.length?`${base} ${formattedBlocks.join(' ')}`:base;
    }

    function reportObservationParagraph(units,relations){
      const h=reportBuildHierarchy(units,relations), f=h.functioning.slice(0,4), out=[];
      if(!f.length){
        const situated=units.filter(u=>!u.context&&u.q2LevelLabel);
        if(situated.length){
          return situated.slice(0,5).map(u=>{
            const ctx=[u.matiere,u.objectif].filter(Boolean).join(' · ');
            if(u.q2Level===0) return `Observation située (${reportHumanDate(u.date)}${ctx?`, ${ctx}`:''}) : « ${u.text} » — niveau constaté : partiellement (compétence présente de manière incomplète ou fragile dans la situation observée, nécessitant accompagnement ou renforcement).`;
            if(u.q2Level===1) return `Observation située (${reportHumanDate(u.date)}${ctx?`, ${ctx}`:''}) : « ${u.text} » — niveau constaté : suffisamment (compétence fonctionnelle dans la situation courante observée, dont certaines subtilités, situations complexes ou transferts restent à consolider).`;
            return `Observation située (${reportHumanDate(u.date)}${ctx?`, ${ctx}`:''}) : « ${u.text} » — niveau constaté : totalement (point d’appui / compétence maîtrisée dans la situation observée, sans déduire automatiquement une généralisation hors contexte).`;
          });
        }
        return [`Aucun phénomène de fonctionnement n'est suffisamment récurrent pour être hiérarchisé.`];
      }
      f.forEach(x=>{
        const desc=x.type==='strength'?'un point d’appui dans les situations observées'
          :x.type==='strength_with_variability'?'un point d’appui avec des variations selon les situations'
          :x.type==='functional'?'une compétence fonctionnelle dans les situations courantes observées (niveau « suffisamment »), dont certaines subtilités ou situations complexes restent à consolider'
          :x.type==='functional_with_fragility'?'une compétence fonctionnelle dans certaines situations courantes (« suffisamment »), mais encore fragile ou partielle dans d’autres'
          :x.type==='functional_with_strength'?'une compétence mobilisée de manière suffisante à totale selon les situations observées'
          :x.type==='fragility'?'une fragilité récurrente nécessitant un accompagnement ou un renforcement'
          :x.type==='fragility_with_success'?'une fragilité récurrente malgré quelques réussites'
          :'un fonctionnement contrasté';
        let s=`${reportTheme(x.theme).label} est documenté comme ${desc}.`;
        if(x.evolution)s+=` Les observations montrent une évolution située dans le temps, sans permettre de conclure à une généralisation.`;
        out.push(s);
      });
      return out;
    }

    function reportMechanismParagraph(units){
      const info=units.filter(u=>u.theme==='information_selection'&&u.difficultySignal), proc=units.filter(u=>u.theme==='procedural'&&u.difficultySignal), geom=units.filter(u=>u.theme==='geometry'&&(u.positiveSignal||u.functionalSignal||u.difficultySignal));
      const p=[]; if(info.length&&proc.length)p.push(`Dans certaines situations, la difficulté semble intervenir avant l’application de la procédure : les informations pertinentes doivent d’abord être sélectionnées et organisées. Les observations ne permettent toutefois pas d’affirmer que ce mécanisme explique à lui seul les erreurs rapportées.`); if(geom.length)p.push(`En géométrie, certaines observations permettent de distinguer la compréhension d’une notion de sa mobilisation ou de sa réalisation dans la tâche.`); return p.join(' ');
    }

    function reportEvolutionParagraph(relations){
      const ev=(relations.evolutions||[]).filter(e=>!['classroom_context','teacher_context'].includes(e.theme)).slice(0,4); if(!ev.length)return `Aucune trajectoire suffisamment comparable n’est identifiée automatiquement sur la période.`;
      return ev.map(e=>{
        const label=reportTheme(e.theme).short;
        if(e.progressionToFunctional)return `Pour ${label}, le niveau observé évolue de « partiellement » vers « suffisamment » : la compétence devient fonctionnelle dans les situations courantes observées, tout en nécessitant encore de consolider certaines subtilités ou situations complexes.`;
        if(e.progressionFromFunctionalToPositive)return `Pour ${label}, le niveau observé évolue de « suffisamment » vers « totalement » dans les situations étudiées ; cela documente une évolution située favorable, sans suffire à conclure à une généralisation hors contexte.`;
        if(e.laterPositive&&!e.laterDiff)return `Pour ${label}, des observations ultérieures sont plus favorables dans certaines situations ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale.`;
        if(e.laterDiff&&!e.laterPositive)return `Pour ${label}, des observations plus difficiles apparaissent ultérieurement dans certaines situations ; cela documente une variabilité, sans suffire à conclure à une dégradation générale.`;
        return `Pour ${label}, les observations positives et les difficultés coexistent sur la période ; aucune trajectoire unique ne peut être retenue.`;
      }).join(' ');
    }

    function reportAdaptationParagraph(evidence){
      const adaptations=evidence.flatMap(e=>e.adaptations), effects=evidence.flatMap(e=>Object.entries(e.effects||{}).map(([type,v])=>({type,value:Number(v)}))).filter(x=>!Number.isNaN(x.value));
      const p=[]; if(adaptations.length)p.push(`Les adaptations ou médiations renseignées concernent ${reportRarityPhrase(reportUnique(adaptations))}.`); if(effects.length){const pos=effects.filter(x=>x.value===2).length, part=effects.filter(x=>x.value===1).length, none=effects.filter(x=>x.value===0).length;p.push(`${effects.length} effet${effects.length>1?'s':''} est/sont renseigné${effects.length>1?'s':''} dans Q4 : ${pos} positif${pos>1?'s':''} constaté${pos>1?'s':''}, ${part} partiel${part>1?'s':''} ou limité${part>1?'s':''}${none?` et ${none} sans effet constaté`:''}. Ces effets sont rapportés de manière descriptive pour les séances concernées et ne sont pas interprétés comme une preuve causale.`);} if(!p.length)return `Aucune adaptation ou effet n’est suffisamment renseigné dans Q4 pour être synthétisé.`; return p.join(' ');
    }

    function reportTransferParagraph(evidence,relations){
      const q5=evidence.filter(e=>e.transfer), observed=q5.filter(e=>e.transfer==='observed').length; if(!q5.length)return `Aucun statut de transfert Q5 n’est renseigné sur la période.`;
      const statuses=reportUnique(q5.map(e=>historyQ5TransferLabel(e.transfer).toLocaleLowerCase('fr')).filter(Boolean));
      return `Q5 renseigne ${q5.length} situation${q5.length>1?'s':''} de transfert (${reportRarityPhrase(statuses)}), dont ${observed} avec le statut « observé ». ${q5.some(e=>e.transferPrecision)?'Les précisions associées sont conservées comme éléments de contexte de ces observations. ':''}Ce statut documente ce qui a été déclaré dans la séance ; il n’est pas assimilé à une généralisation de la compétence.`;
    }

    function reportNextStepsParagraph(evidence,relations){
      const actions=reportUnique(evidence.flatMap(e=>[...e.actions,...(e.actionPrecision?[e.actionPrecision]:[])])).slice(0,8);
      const modalities=reportUnique(evidence.map(e=>e.modality).filter(Boolean));
      const objectives=reportUnique(evidence.map(e=>e.actionObjective).filter(Boolean));
      const collaborations=reportUnique(evidence.flatMap(e=>e.collaborations||[]).filter(Boolean));
      if(actions.length||modalities.length||objectives.length||collaborations.length){
        const parts=[];
        if(actions.length)parts.push(`Les suites explicitement renseignées dans Q6 portent sur ${reportRarityPhrase(actions)}.`);
        if(modalities.length)parts.push(`Modalité(s) retenue(s) : ${reportRarityPhrase(modalities)}.`);
        if(objectives.length)parts.push(`Orientation(s) d’objectif : ${reportRarityPhrase(objectives)}.`);
        if(collaborations.length)parts.push(`Collaboration(s) prévue(s) : ${reportRarityPhrase(collaborations)}.`);
        parts.push(`Elles sont présentées comme des décisions ou pistes pour la suite, sans être confondues avec des effets déjà démontrés.`);
        return parts.join(' ');
      }
      const difficultThemes=reportUnique((relations.recurrences||[]).filter(r=>r.difficulties.length).map(r=>r.theme)), suggestions=[]; const add=s=>{if(!suggestions.includes(s))suggestions.push(s);};
      if(difficultThemes.includes('procedural'))add('poursuivre l’entraînement des procédures concernées en vérifiant progressivement leur automatisation'); if(difficultThemes.includes('memory'))add('prévoir des rappels réguliers lorsque la mémorisation apparaît instable'); if(difficultThemes.includes('vocabulary'))add('reprendre le vocabulaire spécifique dans des situations variées'); if(difficultThemes.includes('fractions'))add('consolider les prérequis liés aux fractions et à la division'); if(difficultThemes.includes('arithmetic'))add('maintenir un entraînement explicite des faits et procédures arithmétiques'); if(difficultThemes.includes('algebra'))add('poursuivre le travail sur les procédures algébriques en distinguant les étapes déjà comprises de celles qui restent difficiles à combiner'); if(difficultThemes.includes('geometry'))add('poursuivre les situations géométriques en distinguant la compréhension du concept de sa mobilisation'); if(difficultThemes.includes('measurement')||difficultThemes.includes('graphomotor'))add('maintenir un travail explicite sur les gestes, les outils et la précision'); if(difficultThemes.includes('information_selection'))add('continuer à expliciter la sélection des informations pertinentes avant l’application d’une procédure');
      if(!suggestions.length)return `Aucune suite spécifique n’est suffisamment documentée pour être proposée automatiquement.`; return `En l’absence de suite Q6 explicitement renseignée, les pistes suivantes peuvent être envisagées à partir des difficultés récurrentes : ${suggestions.join('; ')}.`;
    }


    /* =========================================================
       RAPPORT NIVEAU 3 — INTÉGRATION / PV
       ---------------------------------------------------------
       Le niveau 3 ne reformule pas simplement le rapport mensuel.
       Il travaille sur une trajectoire longue et relie :
       - récurrence et évolution des phénomènes observés ;
       - apprentissages et fonctionnement ;
       - indicateurs WBE ;
       - aides / adaptations et effets renseignés ;
       - transfert Q5 ;
       - décisions / suites Q6 ;
       - repères du dossier élève / PIA lorsqu'ils existent.

       Principe de prudence : une co-occurrence dans une séance ou
       une évolution parallèle ne constitue pas une preuve causale.
       ========================================================= */

    function reportIntegrationLabel(type){
      return type==='PV1' ? 'Procès-verbal d’intégration / point d’étape' : 'Procès-verbal de bilan / fin de suivi';
    }

    function reportIntegrationPhaseData(units){
      const dates=reportUnique(units.map(u=>u.dateKey).filter(Boolean)).sort();
      if(dates.length<3) return [{label:'Période documentée',dates}];
      const n=dates.length, c1=Math.ceil(n/3), c2=Math.ceil(2*n/3);
      return [
        {label:'Début de la période documentée',dates:dates.slice(0,c1)},
        {label:'Milieu de la période documentée',dates:dates.slice(c1,c2)},
        {label:'Fin de la période documentée',dates:dates.slice(c2)}
      ];
    }

    function reportPhaseThemeState(units,dates,theme){
      const set=new Set(dates);
      const e=units.filter(u=>set.has(u.dateKey)&&u.theme===theme);
      return {
        positive:e.filter(u=>u.positiveSignal||u.positive).length,
        functional:e.filter(u=>u.functionalSignal&&!u.positiveSignal&&!u.positive).length,
        difficulty:e.filter(u=>u.difficultySignal&&!u.positive&&!u.functionalSignal).length,
        total:e.length
      };
    }

    function reportIntegrationTrajectory(units,relations){
      const h=reportBuildHierarchy(units,relations), candidates=[...h.learning.slice(0,3),...h.functioning.slice(0,3)];
      const phases=reportIntegrationPhaseData(units), out=[];
      candidates.slice(0,5).forEach(f=>{
        const states=phases.map(ph=>reportPhaseThemeState(units,ph.dates,f.theme));
        const first=states[0], last=states[states.length-1];
        if(!first.total&&!last.total) return;
        const label=reportTheme(f.theme).short;
        let sentence;
        if(!first.total&&last.total){
          sentence=`Le domaine « ${label} » apparaît surtout dans les observations les plus récentes ; les données ne permettent pas de déterminer son évolution sur toute la période.`;
        }else if(first.total&&!last.total){
          sentence=`Le domaine « ${label} » est documenté au début de la période mais pas dans les dernières séances disponibles ; cette absence ne permet pas de conclure à une disparition du phénomène.`;
        }else if(first.difficulty&&last.positive&&!last.difficulty){
          sentence=`Le domaine « ${label} » est décrit comme difficile dans les premières observations puis plus favorable dans les dernières ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale.`;
        }else if(first.difficulty&&last.functional&&!last.difficulty&&!last.positive){
          sentence=`Le domaine « ${label} » évolue d’un niveau partiel/fragile vers un niveau fonctionnel (« suffisamment ») dans les situations courantes observées ; certaines subtilités ou situations complexes restent toutefois à consolider.`;
        }else if(first.functional&&!first.difficulty&&last.positive&&!last.difficulty){
          sentence=`Le domaine « ${label} » passe d’une mobilisation suffisante en situation courante à une réalisation maîtrisée (« totalement ») dans les dernières situations observées, sans conclure à une généralisation hors contexte.`;
        }else if(first.functional&&last.functional&&!first.difficulty&&!last.difficulty&&!first.positive&&!last.positive){
          sentence=`Le domaine « ${label} » demeure fonctionnel dans les situations courantes observées (« suffisamment ») sur la période, avec un besoin de consolidation sur les subtilités ou le transfert.`;
        }else if(first.positive&&!first.difficulty&&last.difficulty&&!last.positive){
          sentence=`Le domaine « ${label} » est décrit favorablement dans les premières observations puis plus difficilement dans les dernières ; cela documente une variabilité située, sans suffire à conclure à une dégradation générale.`;
        }else if(first.positive&&last.positive&&first.difficulty===0&&last.difficulty===0){
          sentence=`Le domaine « ${label} » comporte des éléments favorables au début comme à la fin de la période ; ce point d’appui apparaît donc dans plusieurs phases du suivi.`;
        }else if((first.difficulty||last.difficulty)&&(first.positive||last.positive||first.functional||last.functional)){
          sentence=`Le domaine « ${label} » présente des observations contrastées selon les phases ou les situations ; les données ne permettent pas de retenir une trajectoire unique.`;
        }else{
          sentence=`Le domaine « ${label} » est documenté à plusieurs moments de la période, sans évolution suffisamment nette pour être qualifiée automatiquement.`;
        }
        out.push(sentence);
      });
      return reportUnique(out).slice(0,5);
    }

    function reportIntegrationWBERepere(evidence){
      const map=new Map();
      evidence.forEach(e=>{
        const w=e.wbeRepere||{}; const raw=w.hit||w.signature||'';
        if(!raw)return;
        const clean=resolveSynthesisCanonicalChapter(e.log||{contexte:{matiere:e.matiere},objectif:{objectifLecon:e.objectif},q3:{repereWBE:w}})||cleanSynthWbeToken(raw);
        if(!clean||clean==='Thématique travaillée')return;
        const key=reportNorm(clean);
        if(!map.has(key))map.set(key,{label:clean,count:0,dates:[]});
        const row=map.get(key); row.count++; if(e.dateKey)row.dates.push(e.dateKey);
      });
      return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,6).map(x=>`Le chapitre « ${x.label} » est explicitement validé comme repère WBE dans ${x.count} séance${x.count>1?'s':''}.`);
    }

    function reportIndicatorLabel(app){
      return ({0:'À renforcer',1:'En cours d’appropriation',2:'Maîtrisé'}[Number(app)]||'non renseigné');
    }

    function reportIntegrationIndicators(evidence){
      const map=new Map();
      evidence.forEach(e=>e.indicators.forEach(i=>{
        const cleanTxt=toInfinitivePhrase(String(i.text||'').trim()).replace(/\.$/,'');
        if(!cleanTxt)return;
        const key=semanticSkillDedupeKey(cleanTxt);
        if(!map.has(key))map.set(key,[]);
        const arr=map.get(key);
        arr.push({date:e.dateKey,text:arr.length?pickPreferredSkillLabel(arr[0].text,cleanTxt):cleanTxt,app:i.appreciation});
        if(arr.length>1)arr[0].text=arr[arr.length-1].text;
      }));
      const rows=[];
      for(const arr of map.values()){
        arr.sort((a,b)=>a.date.localeCompare(b.date));
        if(!arr.length)continue;
        const first=arr[0],last=arr[arr.length-1], changed=first.app!==null&&last.app!==null&&first.app!==last.app;
        let t=`${first.text} est documenté sur ${arr.length} séance${arr.length>1?'s':''}`;
        if(changed)t+=`, avec une appréciation qui passe de « ${reportIndicatorLabel(first.app)} » à « ${reportIndicatorLabel(last.app)} »`;
        else if(last.app!==null)t+=` ; la dernière appréciation renseignée est « ${reportIndicatorLabel(last.app)} »`;
        t+='.';
        rows.push({date:last.date,text:t,count:arr.length,changed});
      }
      return rows.sort((a,b)=>(b.changed-a.changed)||(b.count-a.count)).slice(0,6).map(x=>x.text);
    }

    function reportIntegrationAdaptations(evidence){
      const map=new Map();
      evidence.forEach(e=>e.adaptations.forEach(type=>{
        if(!map.has(type))map.set(type,[]);
        map.get(type).push({date:e.dateKey,effect:e.effects[type]});
      }));
      const out=[];
      for(const [type,arr] of map){
        const vals=arr.map(x=>x.effect).filter(v=>v!==undefined&&!Number.isNaN(Number(v))).map(Number);
        if(!vals.length){out.push(`${type} est renseigné à plusieurs reprises, sans effet suffisamment documenté pour permettre une comparaison.`);continue;}
        const first=vals[0],last=vals[vals.length-1];
        if(first!==last) out.push(`${type} est renseigné à plusieurs reprises, avec un effet passant de « ${reportEffectLabel(first)} » à « ${reportEffectLabel(last)} » dans les séances concernées.`);
        else out.push(`${type} est renseigné à plusieurs reprises ; l’effet le plus récent documenté est « ${reportEffectLabel(last)} ».`);
      }
      return out.slice(0,6);
    }

    function reportIntegrationTransfer(evidence){
      const labels={observed:'observé',not_observed:'non observé',no_opportunity:'pas d’occasion',later:'à observer plus tard',not_relevant:'non pertinent','':'non renseigné'};
      const arr=evidence.filter(e=>e.transfer).map(e=>({date:e.dateKey,status:e.transfer}));
      if(!arr.length)return `Aucun statut de transfert Q5 n’est renseigné sur la période.`;
      arr.sort((a,b)=>a.date.localeCompare(b.date));
      const first=arr[0],last=arr[arr.length-1];
      let t=`Le transfert est documenté dans ${arr.length} séance${arr.length>1?'s':''}.`;
      if(first.status!==last.status)t+=` Le statut évolue de « ${labels[first.status]||first.status} » à « ${labels[last.status]||last.status} » entre les premières et dernières observations renseignées.`;
      else t+=` Le dernier statut renseigné est « ${labels[last.status]||last.status} ».`;
      t+=' Ce changement décrit les situations documentées et ne permet pas, à lui seul, de conclure à une généralisation.';
      return t;
    }

    function reportIntegrationQ6(evidence){
      const actions=reportUnique(evidence.flatMap(e=>e.actions)), modalities=reportUnique(evidence.map(e=>e.modality).filter(Boolean)), objectives=reportUnique(evidence.map(e=>e.actionObjective).filter(Boolean)), collaborations=reportUnique(evidence.flatMap(e=>e.collaborations)), precisions=reportUnique(evidence.map(e=>e.actionPrecision).filter(Boolean));
      const p=[];
      if(actions.length)p.push(`Les suites Q6 documentent les orientations suivantes : ${reportRarityPhrase(actions.slice(0,8))}.`);
      if(modalities.length)p.push(`Les modalités d’intervention retenues concernent ${reportRarityPhrase(modalities.slice(0,5))}.`);
      if(objectives.length)p.push(`Les objectifs d’évolution renseignés portent sur ${reportRarityPhrase(objectives.slice(0,5))}.`);
      if(collaborations.length)p.push(`Les collaborations renseignées concernent ${reportRarityPhrase(collaborations.slice(0,6))}.`);
      if(precisions.length)p.push(`Précisions complémentaires : ${reportRarityPhrase(precisions.slice(0,4))}.`);
      if(!p.length)p.push(`Aucune suite Q6 suffisamment renseignée ne permet d’établir une orientation récurrente.`);
      return p.join(' ');
    }

    function reportIntegrationPIA(student){
      const st=getStudents().find(x=>x.nom===student);
      const piaNote=String(st?.pia||'').trim();
      const sid=st?String(st.studentId||st.id||''):'';
      let piaRecord=null,imported=null;
      try{
        const state=window.JournalierDataStore?.getState?.();
        if(sid&&state?.meta){
          piaRecord=state.meta.piaRecords?.[sid]||null;
          imported=state.meta.piaImports?.[sid]||piaRecord?.sourceContinuity||null;
        }
      }catch(err){
        console.warn('Journalier — lecture des données PIA pour rapport impossible :', err);
      }
      const parts=[];
      if(piaRecord&&piaRecord.type==='PIA_ANNUEL'){
        const validated=(piaRecord.meeting1?.objectivesValidated||[]).map(x=>typeof x==='string'?x:x?.formulation||'').filter(Boolean);
        const pending=(piaRecord.propositions||[]).filter(p=>(p.decisionStatus||'A_EXAMINER')==='A_EXAMINER').length;
        const statusMap={FINALISE:'PIA annuel finalisé',EN_VIGUEUR:'PIA annuel en vigueur',ACTIF:'PIA annuel en vigueur',EN_REEVALUATION:'Réévaluation en cours',EN_CONSTRUCTION:'Projet de PIA à examiner'};
        const statusLbl=statusMap[piaRecord.lifecycle]||'Projet de PIA';
        parts.push(`PIA annuel enregistré (${statusLbl}${piaRecord.schoolYear?`, année ${piaRecord.schoolYear}`:''}) : ${validated.length} objectif(s) validé(s)${pending?` et ${pending} proposition(s) encore à examiner`:''}.`);
        if(validated.length){
          parts.push(`Objectif(s) validé(s) : ${reportRarityPhrase(validated.slice(0,4))}.`);
        }
      }
      if(imported?.extracted?.objectives?.length&&!parts.length){
        parts.push(`Continuité PIA importée : ${imported.extracted.objectives.length} objectif(s) de référence (${reportRarityPhrase(imported.extracted.objectives.slice(0,3))}).`);
      }
      if(piaNote){
        parts.push(`Repère(s) PIA renseigné(s) dans le dossier : « ${piaNote} ».`);
      }
      if(!parts.length)return `Aucun objectif PIA n’est actuellement renseigné dans le dossier élève ni dans le module PIA annuel. Le rapport ne peut donc pas établir de rapprochement avec un PIA.`;
      parts.push(`Ce contenu est repris comme repère du dossier ; son degré d’atteinte n’est pas déduit automatiquement des séances et doit être mis en regard des données observées par l’équipe.`);
      return parts.join(' ');
    }

    function reportIntegrationNextSteps(evidence,relations){
      const explicit=reportUnique(evidence.flatMap(e=>[...e.actions,...(e.actionPrecision?[e.actionPrecision]:[])])).slice(0,8);
      const comparisons=reportCompareLinkedChains(reportBuildSessionLinks(evidence,reportExtractUnits(evidence)));
      const p=[];
      if(explicit.length)p.push(`Les suites déjà renseignées dans Q6 sont : ${reportRarityPhrase(explicit)}.`);
      if(comparisons.length)p.push(`Les évolutions de chaînes documentaires suggèrent de vérifier la stabilisation des changements observés avant de réduire ou modifier les aides.`);
      p.push(`Pour la réunion, les points à discuter peuvent être formulés à partir des données : ce qui est suffisamment récurrent pour être maintenu, ce qui reste variable selon les situations, les adaptations dont l’effet est documenté, et les éléments de transfert encore à observer.`);
      return p.join(' ');
    }

    function reportIntegrationMeetingFocus(type,evidence){
      if(type==='PV1'){
        return `Ce point d’étape vise principalement à mettre en commun les observations déjà suffisamment documentées, à identifier les éléments encore variables et à préciser ce qui doit être observé dans la suite de l’accompagnement.`;
      }
      return `Ce bilan vise principalement à distinguer les éléments suffisamment documentés des éléments encore dépendants du contexte, à faire le point sur les aides et le transfert observés et à formaliser les suites à discuter pour la poursuite ou la fin du suivi.`;
    }

    function reportIntegrationReport(evidence,units,relations,student,type){
      const school=reportValidSchoolDates(evidence);
      const validEvidence=evidence.filter(e=>!school.outliers.has(e.dateKey));
      const validUnits=units.filter(u=>!school.outliers.has(u.dateKey));
      const validRelations=reportRelations(validUnits);
      const dates=validEvidence.map(e=>e.dateKey).filter(Boolean).sort();
      const first=dates[0]||'',last=dates[dates.length-1]||'';
      const h=reportBuildHierarchy(validUnits,validRelations), links=reportBuildSessionLinks(validEvidence,validUnits), comparisons=reportCompareLinkedChains(links);
      const trajectory=reportIntegrationTrajectory(validUnits,validRelations), indicators=reportIntegrationIndicators(validEvidence), wbeRepere=reportIntegrationWBERepere(validEvidence), adaptations=reportIntegrationAdaptations(validEvidence);
      const period=`${first?reportHumanDate(first):'date non renseignée'}${last&&last!==first?' au '+reportHumanDate(last):''}`;
      const title=reportIntegrationLabel(type);
      const learning=h.learning.slice(0,4).map(reportFindingPhrase), functioning=h.functioning.slice(0,4).map(reportFindingPhrase);
      const priority=h.findings.slice(0,5).map(f=>{
        const label=reportTheme(f.theme).label;
        if(f.type==='fragility')return `${label} reste une fragilité récurrente sur la période documentée.`;
        if(f.type==='fragility_with_success')return `${label} reste fragile dans plusieurs situations, avec quelques réussites documentées.`;
        if(f.type==='functional')return `${label} est fonctionnel dans les situations courantes observées (« suffisamment »), mais certaines subtilités, situations complexes ou transferts restent à consolider.`;
        if(f.type==='functional_with_fragility')return `${label} est fonctionnel dans certaines situations courantes (« suffisamment »), tout en restant partiel ou fragile dans d’autres.`;
        if(f.type==='functional_with_strength')return `${label} est mobilisé de manière suffisante à totale selon les situations observées.`;
        if(f.type==='strength')return `${label} constitue un point d’appui récurrent.`;
        if(f.type==='strength_with_variability')return `${label} constitue un point d’appui, avec des variations selon les situations.`;
        return `${label} présente des observations contrastées selon les situations.`;
      });
      const q2q6=reportLinkedSynthesis(validEvidence,validUnits,validRelations);
      const warnings=reportDataQuality(evidence);
      return `<div class="natural-report">
        <div class="report-section"><h4>1. Objet et périmètre du procès-verbal</h4><p>${escapeHtml(title)} pour ${escapeHtml(student)}. Le corpus couvre ${evidence.length} séance${evidence.length>1?'s':''} documentée${evidence.length>1?'s':''}, du ${escapeHtml(period)}. Le rapport de niveau 3 reprend les données disponibles sur l’ensemble de cette période afin de dégager une trajectoire et des points de discussion pour l’équipe. Les dates identifiées comme hors fenêtre scolaire sont conservées dans la traçabilité mais ne sont pas utilisées pour établir la chronologie principale. ${escapeHtml(reportIntegrationMeetingFocus(type,evidence))}</p></div>
        <div class="report-section"><h4>2. Synthèse de la trajectoire</h4>${trajectory.map(x=>`<p>${escapeHtml(x)}</p>`).join('')||'<p>Les données sont trop ponctuelles pour dégager une trajectoire suffisamment comparable.</p>'}<p>${escapeHtml(reportHierarchyParagraph(units,relations))}</p></div>
        <div class="report-section"><h4>3. Apprentissages : points d’appui, fragilités et variabilité</h4><p>${learning.length?escapeHtml(`Les apprentissages récurrents documentés sont ${reportRarityPhrase(learning)}.`):'Les apprentissages ne sont pas suffisamment récurrents pour être hiérarchisés.'}</p>${priority.filter(x=>/apprentissage|arithm|géom|vocab|algè|fraction|quantit|périm|mesur/i.test(x)).map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div>
        <div class="report-section"><h4>4. Fonctionnement et conditions de réalisation</h4><p>${functioning.length?escapeHtml(`Les phénomènes de fonctionnement les plus documentés sont ${reportRarityPhrase(functioning)}.`):'Les phénomènes de fonctionnement restent trop ponctuels pour être hiérarchisés.'}</p>${priority.filter(x=>!/apprentissage|arithm|géom|vocab|algè|fraction|quantit|périm|mesur/i.test(x)).map(x=>`<p>${escapeHtml(x)}</p>`).join('')}<p>${escapeHtml(reportMechanismParagraph(units)||'Les données ne permettent pas de documenter un mécanisme fonctionnel suffisamment stable pour être formulé davantage.')}</p></div>
        <div class="report-section"><h4>5. Indicateurs WBE et évolution documentée</h4>${wbeRepere.length?wbeRepere.map(x=>`<p>${escapeHtml(x)}</p>`).join(''):''}${indicators.length?indicators.map(x=>`<p>${escapeHtml(x)}</p>`).join(''):'<p>Aucun indicateur Q3 suffisamment renseigné ne permet une comparaison longitudinale.</p>'}</div>
        <div class="report-section"><h4>6. Aides, adaptations, effets et transfert</h4>${adaptations.length?adaptations.map(x=>`<p>${escapeHtml(x)}</p>`).join(''):'<p>Aucune adaptation suffisamment documentée pour une comparaison longitudinale.</p>'}<p>${escapeHtml(reportIntegrationTransfer(evidence))}</p></div>
        <div class="report-section"><h4>7. Chaînage Q2 → Q3 → Q4 → Q5 → Q6</h4>${q2q6.paragraphs.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}<p class="report-disclaimer">Le rapprochement est documentaire. Sans identifiant relationnel explicite dans le modèle actuel, il ne permet pas d'attribuer causalement un effet à une adaptation.</p>${comparisons.length?comparisons.map(x=>`<p>${escapeHtml(x)}</p>`).join(''):''}</div>
        <div class="report-section"><h4>8. Décisions, suites et collaboration</h4><p>${escapeHtml(reportIntegrationQ6(evidence))}</p><p>${escapeHtml(reportIntegrationNextSteps(evidence,relations))}</p></div>
        <div class="report-section"><h4>9. Mise en regard avec le dossier / PIA</h4><p>${escapeHtml(reportIntegrationPIA(student))}</p></div>
        <div class="report-section"><h4>10. Points à discuter lors de la réunion</h4><ul>${[
          'Quelles observations sont suffisamment récurrentes pour justifier le maintien d’un appui ?',
          'Dans quelles situations une réussite est-elle retrouvée, et dans quelles situations la difficulté réapparaît-elle ?',
          'Quelles adaptations ont un effet explicitement renseigné et lesquelles nécessitent encore une observation ?',
          'Le transfert est-il observé dans des contextes différents ou reste-t-il limité aux situations documentées ?',
          'Quelles suites Q6 doivent être maintenues, ajustées ou discutées avec l’équipe ?'
        ].map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
        <div class="report-section report-evidence-note"><h4>11. Traçabilité et limites</h4>${warnings.length?`<p><strong>Points à vérifier :</strong> ${escapeHtml(warnings.join(' '))}</p>`:''}<p>${validEvidence.length} séance${validEvidence.length>1?'s':''} analysée${validEvidence.length>1?'s':''} dans la trajectoire · ${evidence.length-validEvidence.length} date${evidence.length-validEvidence.length>1?'s':''} hors fenêtre · ${links.length} rapprochement${links.length>1?'s':''} Q2–Q6 · ${validEvidence.filter(e=>e.indicators.length).length} séance${validEvidence.filter(e=>e.indicators.length).length>1?'s':''} avec Q3 renseigné · ${validEvidence.filter(e=>e.adaptations.length).length} avec adaptation Q4 · ${validEvidence.filter(e=>e.transfer).length} avec statut Q5.</p><p class="report-disclaimer">Ce document distingue les données observées, les évolutions descriptives et les points de discussion. Il ne transforme ni une réussite ponctuelle en maîtrise générale, ni une co-occurrence en causalité, ni une hiérarchie documentaire en classement du niveau de l’élève.</p></div>
      </div>`;
    }

    function reportValidSchoolDates(evidence){
      const dates=evidence.map(e=>e.dateKey).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      if(!dates.length)return {valid:new Set(),outliers:new Set(),first:'',last:''};
      const first=dates[0], startYear=Number(first.slice(0,4)), expectedEnd=`${startYear+1}-08-31`;
      const outliers=new Set(dates.filter(d=>d>expectedEnd));
      const valid=new Set(dates.filter(d=>d<=expectedEnd));
      return {valid,outliers,first,last:[...valid].sort().pop()||''};
    }

    function reportDataQuality(evidence){
      const warnings=[];
      const school=reportValidSchoolDates(evidence);
      if(school.outliers.size){
        const out=[...school.outliers].sort();
        warnings.push(`Certaines dates sortent de la fenêtre scolaire déduite du corpus (${reportHumanDate(out[0])}${out.length>1?' et suivantes':''}). Elles sont conservées telles qu’encodées, mais sont exclues de l’analyse chronologique principale jusqu’à vérification.`);
      }
      const emptyObs=evidence.filter(e=>!e.observations.length);
      if(emptyObs.length) warnings.push(`${emptyObs.length} séance${emptyObs.length>1?'s':''} ne contient aucune observation Q2 exploitable.`);
      return warnings;
    }

    function cleanSynthWbeToken(raw){
      let s=String(raw||'').trim();
      if(!s)return '';
      if(s.includes('|')){
        const parts=s.split('|').map(x=>x.trim()).filter(Boolean);
        s=parts[parts.length-1]||s;
      }
      return s.replace(/^rep[eè]re\s+wbe\s*:\s*/i,'').trim();
    }

    function resolveSynthesisCanonicalChapter(log){
      const v74Canon=typeof window!=='undefined'?window.JournalierV74?.canonicalizeWbeChapter:null;
      const sp=sessionParts(log);
      const matiere=sp.matiere||log?.contexte?.matiere||log?.identification?.matiere||'';
      const obj=String(log?.objectif?.objectifLecon||log?.objectif?.objectifProfessionnel||log?.identification?.objectif||'').trim();
      const rawWbe=String(log?.q3?.repereWBE?.signature||log?.q3?.repereWBE?.hit||'').trim();
      if(typeof v74Canon==='function'){
        const res=v74Canon(rawWbe,obj,matiere);
        if(res)return res;
      }
      const cleaned=cleanSynthWbeToken(rawWbe);
      const objClean=formatChapterName(obj);
      const probe=reportNorm(`${cleaned} ${objClean}`);
      if(/\b(puissance|exposant|quotient de puissance|produit de puissance|proprietes des puissances)\b/.test(probe))return 'Propriétés des puissances';
      if(/\b(priorites? operatoires?|pemdas|ordre des operations|operations? sur (?:les )?entiers|nombres? entiers|regles? des signes)\b/.test(probe))return 'Priorités opératoires';
      if(/\b(equations? du premier degre|equations? a une inconnue|resoudre une equation|equations?)\b/.test(probe))return 'Équations du premier degré';
      if(/\b(fonctions? du premier degre|fonctions? affines?|fonctions?)\b/.test(probe))return 'Fonctions du premier degré';
      if(/\b(fractions? equivalentes?|fractions?)\b/.test(probe))return 'Fractions';
      if(objClean)return objClean.charAt(0).toUpperCase()+objClean.slice(1);
      if(cleaned&&!/^le monde des nombres$/i.test(cleaned))return cleaned.charAt(0).toUpperCase()+cleaned.slice(1);
      return 'Chapitre non précisé';
    }

    function resolveSynthesisSessionWbe(log){
      const chap=resolveSynthesisCanonicalChapter(log);
      if(chap&&chap!=='Thématique travaillée'&&chap!=='Chapitre non précisé')return chap;
      const v74Res=window.JournalierV74?.resolveSessionWBERepere;
      if(typeof v74Res==='function')return v74Res(log);
      return '';
    }

    function formatSynthesisCourseHeader(matiere){
      const m=String(matiere||'').trim()||'Matière non renseignée';
      if(m==='Matière non renseignée')return m;
      const n=reportNorm(m);
      if(n.startsWith('cours de ')||n.startsWith('cours d '))return m.charAt(0).toUpperCase()+m.slice(1);
      const lower=m.charAt(0).toLocaleLowerCase('fr')+m.slice(1);
      if(/^[aeiouyéèêëîïôùûü]/i.test(lower))return `Cours d’${lower}`;
      return `Cours de ${lower}`;
    }

    function summarizeSynthesisWbeByCourse(logs){
      const byCourse=new Map();
      (logs||[]).forEach(log=>{
        const sp=sessionParts(log);
        const matiere=sp.matiere||log?.contexte?.matiere||log?.identification?.matiere||'';
        const chap=resolveSynthesisCanonicalChapter(log);
        if(!chap||chap==='Thématique travaillée'||chap==='Chapitre non précisé')return;
        const course=formatSynthesisCourseHeader(matiere);
        if(!byCourse.has(course))byCourse.set(course,[]);
        const list=byCourse.get(course);
        if(!list.some(x=>reportNorm(x)===reportNorm(chap)))list.push(chap);
      });
      return [...byCourse.entries()].map(([course,chapters])=>`${course} : ${chapters.join(' ; ')}.`);
    }

    function renderSynthesisSessionSummary(log){
      const v74Synth=window.JournalierV74?.buildSessionObservationSynthesis;
      if(typeof v74Synth==='function'){
        return v74Synth(log).map(line=>String(line||'')
          .replace(/rep[eè]re\s+WBE\s*:\s*([a-z0-9_|-]+)/gi,(_,tok)=> {
            const clean=cleanSynthWbeToken(tok);
            return clean?`repère WBE : ${clean}`:'';
          })
        );
      }
      const q2=(log?.q2?.observations||[]).map(o=>{
        const lvl=historyQ2LevelLabel(o.niveau);
        return lvl?insertFluidAdverbInObservation(o.observation,lvl):o.observation;
      }).filter(Boolean);
      const q3=(log?.q3?.indicateurs||[]).map(i=>toInfinitivePhrase(i.texte)).filter(Boolean);
      const q4=(log?.q4?.types||[]).map(t=>{
        const eff=log?.q4?.effets?.[t];
        const effLbl=eff!==undefined?historyQ4EffectLabel(eff).toLocaleLowerCase('fr'):'';
        if(effLbl.includes('positif'))return `${t} aide concrètement l’élève`;
        if(effLbl.includes('partiel'))return `${t} aide partiellement l’élève`;
        if(effLbl.includes('aucun'))return `${t} n’a pas apporté d’effet notable`;
        return t;
      }).filter(Boolean);
      const out=[];
      if(q2.length)out.push(`Réalisation et fonctionnement observés : ${q2.join(' ; ')}.`);
      if(q3.length)out.push(`Apprentissages et processus : ${q3.join(' ; ')}.`);
      if(q4.length)out.push(`Aides et adaptations mises en place : ${q4.join(' ; ')}.`);
      return out.length?out:['Séance réalisée — aucune observation complémentaire renseignée.'];
    }

    function computeSynthesisSessionDominantTone(log){
      const obs=log?.q2?.observations||[];
      const levels=obs.map(o=>Number(o?.niveau)).filter(n=>n===0||n===1||n===2);
      const inds=log?.q3?.indicateurs||[];
      const apps=inds.map(i=>Number(i?.appreciation)).filter(n=>n===0||n===1||n===2);
      const all=[...levels,...apps];
      if(!all.length)return {tone:'neutral',label:'Observation libre'};
      const c0=all.filter(x=>x===0).length;
      const c1=all.filter(x=>x===1).length;
      const c2=all.filter(x=>x===2).length;
      if(c2>=c1&&c2>=c0&&c2>0)return {tone:'positive',label:'Réussite / point d’appui'};
      if(c1>=c0&&c1>0)return {tone:'functional',label:'Fonctionnel en situation courante'};
      return {tone:'fragile',label:'Fragilité / besoin d’appui'};
    }

    function formatMonthYearFR(dateIso){
      const d=String(dateIso||'').slice(0,10);
      const m=/^(\d{4})-(\d{2})/.exec(d);
      if(!m)return '';
      const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      const idx=Number(m[2])-1;
      return months[idx]?`${months[idx]} ${m[1]}`:'';
    }

    function formatAidWithDeterminer(rawAid,capitalizeFirst=false){
      const clean=String(rawAid||'').trim();
      if(!clean)return '';
      const lower=clean.charAt(0).toLocaleLowerCase('fr')+clean.slice(1);
      if(/^(le|la|l['’]|les|un|une|des)\b/i.test(clean)){
        return capitalizeFirst?clean.charAt(0).toUpperCase()+clean.slice(1):lower;
      }
      const isPlural=/^(pauses|repères|outils|supports|consignes|étapes|fiches|rappels|aménagements|adaptations)\b/i.test(clean);
      const isVowel=/^[aeiouyéèêëàâîïôùûœ]/i.test(clean);
      const isFem=/^(reformulation|lecture|structuration|manipulation|médiation|consigne|fiche|check-list|routine|adaptation|aide|verbalisation|explicitation|modélisation|décomposition|segmentation|valorisation|pause|relance|organisation|planification|clarification|simplification|vérification)\b/i.test(clean);
      const art=isPlural?'les ':(isVowel?'l’':(isFem?'la ':'le '));
      const res=`${art}${lower}`;
      return capitalizeFirst?res.charAt(0).toUpperCase()+res.slice(1):res;
    }

    function joinAidsWithArticles(aids,capitalizeFirst=false){
      const list=reportUnique(aids).map((a,idx)=>formatAidWithDeterminer(a,capitalizeFirst&&idx===0)).filter(Boolean);
      if(!list.length)return {subject:'',plural:false};
      if(list.length===1){
        const isPlural=/^les\s+/i.test(list[0]);
        return {subject:list[0],plural:isPlural};
      }
      if(list.length===2)return {subject:`${list[0]} et ${list[1]}`,plural:true};
      return {subject:`${list.slice(0,-1).join(', ')} et ${list[list.length-1]}`,plural:true};
    }

    function toNominalOrInfinitiveComplement(rawSkill,prep='pour'){
      const s=toInfinitivePhrase(String(rawSkill||'').trim()).replace(/\.$/,'');
      if(!s)return '';
      const low=s.charAt(0).toLocaleLowerCase('fr')+s.slice(1);
      if(prep==='nominale'){
        const nomRules=[
          [/^identifier\s+ce\s+qui\s+est\s+demand[eé]\s+dans\s+la\s+consigne$/i,'l’identification des attendus de la consigne'],
          [/^identifier\s+(.*)$/i,'l’identification de $1'],
          [/^traduire\s+(.*)$/i,'la traduction de $1'],
          [/^entrer\s+dans\s+la\s+t[aâ]che$/i,'l’entrée dans la tâche'],
          [/^r[eé]utiliser\s+(.*)$/i,'la réutilisation de $1'],
          [/^mettre\s+en\s+œuvre\s+(.*)$/i,'la mise en œuvre de $1'],
          [/^appliquer\s+(.*)$/i,'l’application de $1'],
          [/^choisir\s+(.*)$/i,'le choix de $1'],
          [/^transformer\s+ou\s+simplifier\s+(.*)$/i,'la transformation ou la simplification de $1'],
          [/^comprendre\s+(.*)$/i,'la compréhension de $1'],
          [/^suivre\s+(.*)$/i,'le suivi de $1'],
          [/^maintenir\s+(.*)$/i,'le maintien de $1'],
          [/^v[eé]rifier\s+(.*)$/i,'la vérification de $1'],
          [/^organiser\s+(.*)$/i,'l’organisation de $1']
        ];
        for(const [re,rep] of nomRules){
          if(re.test(low)){
            return low.replace(re,rep)
              .replace(/\bde\s+le\b/gi,'du')
              .replace(/\bde\s+les\b/gi,'des')
              .replace(/\bde\s+la\b/gi,'de la')
              .replace(/\bde\s+une\b/gi,'d’une')
              .replace(/\bde\s+un\b/gi,'d’un');
          }
        }
      }
      return low;
    }

    function isSessionExploitable(log){
      if(!log)return false;
      const q2Obs=(log?.q2?.observations||[]).filter(o=>Boolean(String(o?.observation||o?.text||'').trim()));
      const q2Notes=String(log?.q2?.precision||log?.q2?.commentaire||'').trim();
      const q3Inds=(log?.q3?.indicateurs||[]).filter(i=>{
        const txt=typeof i==='string'?i:i?.texte;
        return Boolean(String(txt||'').trim());
      });
      const q3Wbe=String(log?.q3?.repereWBE?.signature||log?.q3?.repereWBE?.hit||'').trim();
      const q3Notes=String(log?.q3?.precision||'').trim();
      const q4Types=(log?.q4?.types||[]).filter(t=>Boolean(String(t||'').trim()));
      const q4Notes=String(log?.q4?.precision||'').trim();
      const q6Actions=(log?.q6?.actions||[]).filter(a=>Boolean(String(a||'').trim()));
      const q6Notes=String(log?.q6?.precision||'').trim();

      return Boolean(
        q2Obs.length || q2Notes ||
        q3Inds.length || q3Wbe || q3Notes ||
        q4Types.length || q4Notes ||
        q6Actions.length || q6Notes
      );
    }

    function buildChapterLongitudinalClusters(logs){
      const map=new Map();
      (logs||[]).forEach(log=>{
        const sp=sessionParts(log);
        const matiere=sp.matiere||log?.contexte?.matiere||log?.identification?.matiere||'';
        const chapter=resolveSynthesisCanonicalChapter(log);
        const key=`${reportNorm(matiere)}::${reportNorm(chapter)}`;
        if(!map.has(key)){
          map.set(key,{
            key,
            matiere,
            chapter,
            sessions:[],
            dates:[],
            months:[],
            q2Strong:[],
            q2Func:[],
            q2Frag:[],
            q2Notes:[],
            q3Strong:[],
            q3Func:[],
            q3Frag:[],
            q3Notes:[],
            q4Pos:[],
            q4Part:[],
            q4Notes:[],
            q6Actions:[],
            q6Collabs:[]
          });
        }
        const g=map.get(key);
        g.sessions.push(log);
        if(sp.date)g.dates.push(sp.date);
        const mLabel=formatMonthYearFR(sp.date);
        if(mLabel&&!g.months.includes(mLabel))g.months.push(mLabel);

        (log?.q2?.observations||[]).forEach(o=>{
          const txt=String(o?.observation||'').trim().replace(/\.$/,'');
          if(!txt)return;
          const lvl=Number(o?.niveau);
          if(lvl===2&&!g.q2Strong.includes(txt))g.q2Strong.push(txt);
          else if(lvl===1&&!g.q2Func.includes(txt))g.q2Func.push(txt);
          else if(lvl===0&&!g.q2Frag.includes(txt))g.q2Frag.push(txt);
        });
        const q2P=String(log?.q2?.precision||log?.q2?.commentaire||'').trim();
        if(q2P&&!g.q2Notes.includes(q2P))g.q2Notes.push(q2P);

        (log?.q3?.indicateurs||[]).forEach(i=>{
          const raw=typeof i==='string'?i:i?.texte;
          const txt=toInfinitivePhrase(String(raw||'').trim()).replace(/\.$/,'');
          if(!txt)return;
          const app=typeof i==='string'?log?.q3?.details?.[i]?.appreciation:i?.appreciation;
          const n=Number(app);
          if((n===2||String(app).toLowerCase().includes('appui'))&&!g.q3Strong.includes(txt))g.q3Strong.push(txt);
          else if((n===1||String(app).toLowerCase().includes('appropriation'))&&!g.q3Func.includes(txt))g.q3Func.push(txt);
          else if((n===0||String(app).toLowerCase().includes('fragil')||String(app).toLowerCase().includes('renforcer'))&&!g.q3Frag.includes(txt))g.q3Frag.push(txt);
        });
        const q3P=String(log?.q3?.precision||'').trim();
        if(q3P&&!g.q3Notes.includes(q3P))g.q3Notes.push(q3P);

        const q4Types=log?.q4?.types||[];
        q4Types.forEach(t=>{
          const name=String(t||'').trim();
          if(!name)return;
          const eff=Number(log?.q4?.effets?.[name]);
          if(eff>=2&&!g.q4Pos.includes(name))g.q4Pos.push(name);
          else if(eff===1&&!g.q4Part.includes(name))g.q4Part.push(name);
        });
        const q4P=String(log?.q4?.precision||'').trim();
        if(q4P&&!g.q4Notes.includes(q4P))g.q4Notes.push(q4P);

        (log?.q6?.actions||[]).forEach(a=>{
          const act=String(a||'').trim();
          if(act&&!g.q6Actions.includes(act))g.q6Actions.push(act);
        });
        (log?.q6?.collaborations||[]).forEach(c=>{
          const col=String(c||'').trim();
          if(col&&!g.q6Collabs.includes(col))g.q6Collabs.push(col);
        });
      });

      return [...map.values()].map(g=>{
        const count=g.sessions.length;
        const periodHint=g.months.length?` (${g.months.join(' – ')})`:'';
        const sentences=[];

        // Phrase 1 : Dynamique générale et acquis / fonctionnement sur le chapitre (syntaxe fluide avec préposition ou groupe nominal)
        const posInf=[...g.q2Strong.map(x=>toNominalOrInfinitiveComplement(x,'pour')),...g.q3Strong.map(x=>toNominalOrInfinitiveComplement(x,'pour'))].filter(Boolean).slice(0,2);
        const funcNom=[...g.q2Func.map(x=>toNominalOrInfinitiveComplement(x,'nominale')),...g.q3Func.map(x=>toNominalOrInfinitiveComplement(x,'nominale'))].filter(Boolean).slice(0,2);
        const funcInf=[...g.q2Func.map(x=>toNominalOrInfinitiveComplement(x,'pour')),...g.q3Func.map(x=>toNominalOrInfinitiveComplement(x,'pour'))].filter(Boolean).slice(0,2);

        const intro=`Sur ${count>1?`les ${count} séances consacrées`:'la séance consacrée'} au chapitre « ${g.chapter} »${periodHint}`;
        if(posInf.length&&funcNom.length){
          sentences.push(`${intro}, l’élève parvient aisément à ${reportRarityPhrase(posInf)} et maintient un fonctionnement régulier concernant ${reportRarityPhrase(funcNom)}.`);
        }else if(posInf.length){
          sentences.push(`${intro}, l’élève parvient aisément à ${reportRarityPhrase(posInf)}.`);
        }else if(funcInf.length){
          sentences.push(`${intro}, le fonctionnement reste globalement régulier en situation courante, notamment pour ${reportRarityPhrase(funcInf)}.`);
        }

        // Phrase 2 : Fragilités / obstacles situés et notes de terrain
        const fragInf=[...g.q3Frag.map(x=>toNominalOrInfinitiveComplement(x,'pour')),...g.q2Frag.map(x=>toNominalOrInfinitiveComplement(x,'pour'))].filter(Boolean).slice(0,2);
        const fieldNotes=[...g.q3Notes,...g.q2Notes].slice(0,2).map(n=>n.replace(/\.$/,''));
        if(fragInf.length&&fieldNotes.length){
          sentences.push(`Un accompagnement reste toutefois nécessaire pour ${reportRarityPhrase(fragInf)} (${fieldNotes.join(' ; ')}).`);
        }else if(fragInf.length){
          sentences.push(`Des fragilités subsistent lorsqu’il s’agit de ${reportRarityPhrase(fragInf)}, en particulier lors des tâches plus complexes ou évaluées.`);
        }else if(fieldNotes.length){
          sentences.push(`Les observations de terrain soulignent : ${fieldNotes.join(' ; ')}.`);
        }

        // Phrase 3 : Leviers d'aide et continuité (avec déterminants français naturels)
        const cleanPosAids=g.q4Pos.slice(0,2);
        const cleanPartAids=g.q4Part.filter(x=>!cleanPosAids.includes(x)).slice(0,2);
        const aidClauses=[];
        if(cleanPosAids.length){
          const {subject,plural}=joinAidsWithArticles(cleanPosAids,false);
          aidClauses.push(`${subject} ${plural?'constituent des appuis efficaces':'constitue un appui efficace'}`);
        }
        if(cleanPartAids.length){
          const {subject,plural}=joinAidsWithArticles(cleanPartAids,false);
          aidClauses.push(`${subject} ${plural?'apportent un soutien partiel':'apporte un soutien partiel'}`);
        }
        if(aidClauses.length){
          const q4NoteHint=g.q4Notes.length?` (${g.q4Notes[0].replace(/\.$/,'')})`:'';
          sentences.push(`Sur le plan des aménagements, ${aidClauses.join(', tandis que ')}${q4NoteHint}.`);
        }else if(g.q4Notes.length){
          sentences.push(`Aménagement observé en classe : ${g.q4Notes[0].replace(/\.$/,'')}.`);
        }

        let dominantTone='functional';
        let toneLabel='En cours de consolidation';
        if(g.q2Frag.length+g.q3Frag.length > g.q2Strong.length+g.q3Strong.length+g.q2Func.length){
          dominantTone='fragile';
          toneLabel='Chapitre à renforcer';
        }else if(g.q2Strong.length+g.q3Strong.length > 0 && g.q2Frag.length+g.q3Frag.length===0){
          dominantTone='positive';
          toneLabel='Acquis / Point d’appui';
        }

        return {
          ...g,
          count,
          periodHint:g.months.join(' – ')||'',
          dominantTone,
          toneLabel,
          narrative:sentences.join(' ')
        };
      });
    }

    function semanticSkillDedupeKey(rawSkill){
      const v74Key=typeof window!=='undefined'?window.JournalierV74?.semanticSkillKeyV74:null;
      if(typeof v74Key==='function')return v74Key(rawSkill);
      const inf=toInfinitivePhrase(String(rawSkill||'').trim()).replace(/\.$/,'');
      const n=reportNorm(inf);
      if(/\b(autonomie|mise au travail|entrer dans la tache|demarrer la tache|travail autonome|autonome)\b/.test(n))return 'skill::autonomie_mise_au_travail';
      if(/\b(concentration|attention|engagement|implication|mobilisation|participation)\b/.test(n))return 'skill::concentration_engagement';
      if(/\b(identifier ce qui est demande|comprendre la consigne|decoder la consigne|comprehension des consignes|consigne)\b/.test(n)&&!/\b(traduire|equation|fonction)\b/.test(n))return 'skill::consigne';
      if(/\b(selectionner les informations|extraire les donnees|reperer les donnees)\b/.test(n))return 'skill::selection_infos';
      if(/\b(mettre en oeuvre.*procedure|appliquer.*procedure|suivre.*procedure|mobiliser.*procedure)\b/.test(n))return 'skill::mise_en_oeuvre_procedure';
      if(/\b(maintenir.*endurance|rythme de travail|fatig)\b/.test(n))return 'skill::endurance_rythme';
      return `skill::${n}`;
    }

    function pickPreferredSkillLabel(existingLabel,candidateLabel){
      const v74Pick=typeof window!=='undefined'?window.JournalierV74?.pickPreferredSkillLabelV74:null;
      if(typeof v74Pick==='function')return v74Pick(existingLabel,candidateLabel);
      const a=String(existingLabel||'').trim();
      const b=String(candidateLabel||'').trim();
      if(!a)return b;
      if(!b)return a;
      return b.length>a.length?b:a;
    }

    function canonicalizeStrengthDisplayLabel(rawLabel){
      let clean=String(rawLabel||'').trim().replace(/\.$/,'');
      if(!clean)return '';
      // Si c'est noté comme à consolider ou fragile : ce n'est PAS un point fort !
      if(/\b(à consolider|a consolider|à renforcer|a renforcer|fragilité|difficulté)\b/i.test(clean)){
        return '';
      }
      // Supprimer toute fuite technique Q5 ou debug
      clean = clean.replace(/transfert\s*q5\s*:\s*[^;,.)]*/gi, '');
      clean = clean.replace(/\b(not_relevant|not_observed|no_opportunity|later)\b/gi, '');
      // Supprimer parenthèses et détails de contexte imbriqués
      clean = clean.replace(/\([^)]*(\)|$)/g, '').trim();
      clean = clean.replace(/[,;:]\s*$/, '').trim();
      const n=reportNorm(clean);
      if(!n) return '';
      if(n==='autonomie'||n==='mise au travail'||n==='mise au travail et autonomie'||n==='autonomie et mise au travail')return 'Mise au travail et autonomie';
      if(n==='concentration'||n==='engagement'||n==='implication'||n==='concentration et engagement'||n==='concentration et implication'||n==='attention et concentration')return 'Concentration et implication';
      if(n==='comprehension de consignes'||n==='comprehension des consignes'||n==='comprendre la consigne')return 'Compréhension des consignes';
      if(n==='organisation'||n==='organisation et fonctions executives'||n==='fonctions executives')return 'Organisation et fonctions exécutives';
      if(n==='raisonnement'||n==='raisonnement et procedures')return 'Raisonnement et procédures';
      if(n==='communication et vocabulaire'||n==='vocabulaire et communication'||n==='communication')return 'Communication et vocabulaire';
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    function buildStructuredDomainSummaryForSynthesis(sec,pia,logs,allChaptersCount){
      const v74=window.JournalierV74;
      const aspect=sec?.aspect||'Domaine';
      const aNorm=reportNorm(aspect);
      const isCognitive=aNorm.includes('cogn')||aNorm.includes('pedagog');
      const isPhysical=aNorm.includes('phys')||aNorm.includes('psychom');
      const isAffective=aNorm.includes('comport')||aNorm.includes('affect');
      const isAutonomy=aNorm.includes('autonom');
      const isComm=aNorm.includes('commun');

      // 1. POINTS FORTS (acquis avérés, sans parenthèses ni fuites techniques)
      const rawRes=Array.isArray(sec?.ressources)?sec.ressources:[];
      const strengthMap=new Map();
      const addStrength=label=>{
        const clean=canonicalizeStrengthDisplayLabel(label);
        if(!clean)return;
        const sKey=semanticSkillDedupeKey(clean);
        if(!strengthMap.has(sKey)){
          strengthMap.set(sKey,clean);
        }else{
          strengthMap.set(sKey,pickPreferredSkillLabel(strengthMap.get(sKey),clean));
        }
      };
      rawRes.forEach(r=>{
        const str = String(r||'');
        if(/\b(à consolider|a consolider|à renforcer|a renforcer)\b/i.test(str)) return;
        const cl=v74?.cleanStrengthItemLabel?v74.cleanStrengthItemLabel(r):String(r||'').split(' — ')[0].replace(/^Point fonctionnel\s*:\s*/i,'').trim();
        if(cl)addStrength(cl);
      });
      // Compléter avec les observations Q2 (niveau 2 avéré ou fonctionnement régulier) ou Q3 (niveau 2 maîtrisé)
      (logs||[]).forEach(log=>{
        (log?.q2?.observations||[]).forEach(o=>{
          const lvl=Number(o?.niveau);
          if(lvl<1)return;
          const txt=String(o?.observation||'').trim();
          const cat=String(o?.categorie||'').trim();
          const probe=reportNorm(`${cat} ${txt}`);
          if(isCognitive&&/\b(consigne|comprend|notion|etape|procedure|attention|concentr)\b/.test(probe)){
            if(/consigne/i.test(probe))addStrength('Compréhension des consignes');
            else if(/notion/i.test(probe))addStrength('Compréhension des notions travaillées');
            else if(/attention|concentr/i.test(probe))addStrength('Concentration et attention soutenue');
          }else if(isAutonomy&&/\b(autonom|seul|entre dans la tache|materiel|rythme)\b/.test(probe)&&lvl===2){
            addStrength('Mise au travail et autonomie');
          }else if(isAffective&&/\b(motiv|implic|particip|engag)\b/.test(probe)){
            addStrength('Motivation et participation');
          }else if(isComm&&/\b(oral|verbal|expliq|question|vocab)\b/.test(probe)){
            addStrength('Expression et verbalisation');
          }
        });
        if(isCognitive){
          (log?.q3?.indicateurs||[]).forEach(i=>{
            if(Number(i?.appreciation)===2){
              const inf=toInfinitivePhrase(String(i?.texte||'').trim()).replace(/\.$/,'');
              if(inf)addStrength(inf);
            }
          });
        }
      });
      const strengthSet=[...strengthMap.values()];

      // 2. FRAGILITÉS & BESOINS SITUÉS (Arborescence Matière -> Chapitre -> Compétence dédoublonnée à l'infinitif)
      const rawDiff=Array.isArray(sec?.difficultes)?sec.difficultes:[];
      const fragTreeMap=new Map(); // subject -> Map(chapter -> Map(semanticSkillKey -> skillLabel))
      const addFragility=(subject,skillInf,chapter)=>{
        const subj=String(subject||'').trim()||'Matière non renseignée';
        const chap=String(chapter||'').trim()||'Observation transversale';
        const skill=toInfinitivePhrase(String(skillInf||'').trim()).replace(/\.$/,'');
        if(!skill)return;
        if(!fragTreeMap.has(subj))fragTreeMap.set(subj,new Map());
        const chapMap=fragTreeMap.get(subj);
        if(!chapMap.has(chap))chapMap.set(chap,new Map());
        const skillMap=chapMap.get(chap);
        const sKey=semanticSkillDedupeKey(skill);
        if(!skillMap.has(sKey)){
          skillMap.set(sKey,skill);
        }else{
          skillMap.set(sKey,pickPreferredSkillLabel(skillMap.get(sKey),skill));
        }
      };

      (logs||[]).forEach(log=>{
        const sp=sessionParts(log);
        const subj=sp.matiere||log?.contexte?.matiere||'Matière non renseignée';
        const chap=resolveSynthesisCanonicalChapter(log);
        // Q2 niveau 0
        (log?.q2?.observations||[]).forEach(o=>{
          if(Number(o?.niveau)!==0)return;
          const txt=String(o?.observation||'').trim();
          const probe=reportNorm(`${o?.categorie||''} ${txt}`);
          // PHYSIQUE ET PSYCHOMOTEUR : uniquement atteinte motrice, gestuelle ou instrumentale avérée !
          if(isPhysical&&/\b(geste|graph|motric|tenue.*outil|tenue.*stylo|trace|regle|compas|equerre|manipul.*outil|coordination|posture|handicap|dysprax)\b/.test(probe)){
            addFragility(subj,txt,chap);
          // AUTONOMIE : gestion du rythme, vitesse, maintien de l'effort, persévérance, relances, travail seul
          }else if(isAutonomy&&/\b(autonom|seul|relance|demande.*aide|verif|initiative|rythme|endurance|lent|ralent|fatig|temps|pause|persever)\b/.test(probe)){
            addFragility(subj,txt,chap);
          // COMPORTEMENTAL : conduites observables, évitement, refus de travailler, refus de l'aide, opposition, frustration
          }else if(isAffective&&/\b(refus|evit|opposit|colere|frustr|decour|anxiet|agitat|retrait|conflit)\b/.test(probe)){
            addFragility(subj,txt,chap);
          }else if(isComm&&/\b(vocab|terme|oral|expliq|reformul|langag)\b/.test(probe)){
            addFragility(subj,txt,chap);
          // COGNITIF : attention, concentration, consignes, raisonnement, notions
          }else if(isCognitive&&!/\b(geste|graph|motric)\b/.test(probe)){
            addFragility(subj,txt,chap);
          }
        });
        // Q3 niveau 0 ou 1 (avec note d'obstacle) pour Cognitif
        if(isCognitive){
          (log?.q3?.indicateurs||[]).forEach(i=>{
            const app=Number(i?.appreciation);
            if(app===0||(app===1&&String(log?.q3?.precision||'').trim())){
              addFragility(subj,i?.texte,chap);
            }
          });
        }
        // En autonomie : détection rythme de travail / endurance dans la tâche (et NON en physique !)
        if(isAutonomy){
          const allNotes=`${log?.q2?.precision||''} ${log?.q3?.precision||''} ${log?.q4?.precision||''}`;
          if(/\b(fatig|endurance|lent|ralent|retard|rythme)\b/i.test(allNotes)){
            addFragility(subj,'Maintenir le rythme de travail et l’endurance dans la tâche',chap);
          }
        }
      });

      const structuredFragGroups=[];
      const cleanDiffLines=[];
      for(const [subj,chapMap] of fragTreeMap.entries()){
        const chaptersList=[];
        for(const [chap,skillMap] of chapMap.entries()){
          const skills=[...skillMap.values()];
          if(skills.length){
            chaptersList.push({chapter:chap,skills});
            skills.forEach(sk=>cleanDiffLines.push(`${subj} — ${chap} : ${sk}`));
          }
        }
        if(chaptersList.length){
          structuredFragGroups.push({
            subject:subj,
            chapters:chaptersList,
            items:chaptersList.flatMap(c=>c.skills.map(sk=>`${c.chapter} : ${sk}`))
          });
        }
      }

      // Fallback si des difficultés manuelles ou issues du PIA existent déjà
      if(!structuredFragGroups.length && rawDiff.length){
        const fallbackSkillsMap=new Map();
        rawDiff.forEach(d=>{
          const str=String(d||'').trim();
          let candidate=str;
          if(str.includes(' — en contexte ')||str.includes(' — observé en contexte ')){
            const parts=str.split(' — ').map(x=>x.trim());
            candidate=parts[2]||parts[0];
          }
          candidate.split(/[;,]/).forEach(part=>{
            const cleanPart=toInfinitivePhrase(part.replace(/^[^:]+:\s*/,'').trim()).replace(/\.$/,'');
            if(!cleanPart)return;
            const sKey=semanticSkillDedupeKey(cleanPart);
            if(!fallbackSkillsMap.has(sKey))fallbackSkillsMap.set(sKey,cleanPart);
            else fallbackSkillsMap.set(sKey,pickPreferredSkillLabel(fallbackSkillsMap.get(sKey),cleanPart));
          });
        });
        const fallbackItems=[...fallbackSkillsMap.values()];
        if(fallbackItems.length){
          structuredFragGroups.push({
            subject:'Besoins identifiés',
            chapters:[{chapter:'Observations de période',skills:fallbackItems}],
            items:fallbackItems
          });
          fallbackItems.forEach(it=>cleanDiffLines.push(it));
        }
      }

      const hasFragilities=structuredFragGroups.length>0;

      // 3. OBJECTIFS, ADAPTATIONS & MOYENS (scindés par matière comme les fragilités !)
      const meansBySubject=[];
      const flatMeansLines=[];
      let totalAdaptationsCount=0;

      if(hasFragilities){
        const rawMoy=Array.isArray(sec?.moyens)?sec.moyens:[];
        const cleanAdapt=a=>{
          return String(a||'')
            .replace(/\s*\(effet[^)]*\)/gi,'')
            .replace(/^Objectif retenu\s*:.*$/i,'')
            .trim()
            .replace(/\.$/,'');
        };

        // Sujets identifiés dans ce domaine (présents dans structuredFragGroups)
        const domainSubjects=reportUnique([
          ...structuredFragGroups.map(fg=>fg.subject),
          ...(logs||[]).map(l=>sessionParts(l).matiere||l?.contexte?.matiere||'Matière non renseignée')
        ].filter(Boolean));

        // Détection des entrées enregistrées par le professionnel dans sec.moyens
        const manualBySubj=new Map();
        const globalManual={objectifs:[],adaptations:[],moyens:[]};

        rawMoy.forEach(raw=>{
          const l=String(raw||'').trim();
          if(!l)return;
          const matchSubj=/^([^—:\n[\]]+)\s*—\s*(Objectifs?|Adaptations?|Moyens?)\s*:\s*(.*)$/i.exec(l)
            || /^\[([^\]]+)\]\s*(Objectifs?|Adaptations?|Moyens?)\s*:\s*(.*)$/i.exec(l);
          if(matchSubj){
            const rawS=matchSubj[1].trim();
            const kind=matchSubj[2].toLowerCase();
            const val=matchSubj[3].trim();
            const isTransversal=/transversal/i.test(rawS);
            const targetSubj=isTransversal?'Transversal (toutes matières)':rawS;
            if(!manualBySubj.has(targetSubj))manualBySubj.set(targetSubj,{objectifs:[],adaptations:[],moyens:[]});
            const entry=manualBySubj.get(targetSubj);
            const items=val.split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean);
            if(kind.startsWith('objectif'))entry.objectifs.push(...items);
            else if(kind.startsWith('adaptation'))entry.adaptations.push(...items);
            else entry.moyens.push(...items);
          }else if(/^Objectifs?\s*:/i.test(l)){
            globalManual.objectifs.push(...l.replace(/^Objectifs?\s*:\s*/i,'').split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean));
          }else if(/^Adaptations?\s*:/i.test(l)){
            globalManual.adaptations.push(...l.replace(/^Adaptations?\s*:\s*/i,'').split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean));
          }else if(/^Moyens?\s*:/i.test(l)){
            globalManual.moyens.push(...l.replace(/^Moyens?\s*:\s*/i,'').split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean));
          }
        });

        // Pour chaque matière concernée : regrouper uniquement ses adaptations et moyens réels issus de ses séances
        domainSubjects.forEach(subj=>{
          if(subj==='Transversal (toutes matières)'||subj==='Transversal')return;
          const subjLogs=(logs||[]).filter(l=>{
            const m=sessionParts(l).matiere||l?.contexte?.matiere||'Matière non renseignée';
            return reportNorm(m)===reportNorm(subj);
          });

          const subjAdapts=[];
          const subjMoyens=[];
          const subjObjectifs=[];

          // 1. Adaptations réelles des séances de cette matière
          subjLogs.forEach(l=>{
            (l?.q4?.types||[]).forEach(t=>{
              const clean=cleanAdapt(t);
              if(!clean)return;
              if(v74?.isAdaptationRelevantToAspect && !v74.isAdaptationRelevantToAspect(clean,aspect))return;
              if(!subjAdapts.some(x=>reportNorm(x)===reportNorm(clean))){
                subjAdapts.push(clean);
              }
            });
            (l?.q6?.actions||[]).forEach(a=>{
              const clean=String(a||'').trim().replace(/\.$/,'');
              if(clean&&!subjMoyens.some(x=>reportNorm(x)===reportNorm(clean))){
                subjMoyens.push(clean);
              }
            });
          });

          // 2. Si le professionnel a saisi des adaptations manuelles pour cette matière
          const manualEntry=manualBySubj.get(subj)||manualBySubj.get(reportNorm(subj));
          if(manualEntry){
            manualEntry.objectifs.forEach(o=>{if(!subjObjectifs.includes(o))subjObjectifs.push(o);});
            manualEntry.adaptations.forEach(a=>{if(!subjAdapts.includes(a))subjAdapts.push(a);});
            manualEntry.moyens.forEach(m=>{if(!subjMoyens.includes(m))subjMoyens.push(m);});
          }else if(domainSubjects.length===1){
            globalManual.objectifs.forEach(o=>{if(!subjObjectifs.includes(o))subjObjectifs.push(o);});
            globalManual.adaptations.forEach(a=>{if(!subjAdapts.includes(a))subjAdapts.push(a);});
            globalManual.moyens.forEach(m=>{if(!subjMoyens.includes(m))subjMoyens.push(m);});
          }

          const hasSubjectFragility=structuredFragGroups.some(fg=>reportNorm(fg.subject)===reportNorm(subj));
          if(hasSubjectFragility||subjAdapts.length||subjMoyens.length||subjObjectifs.length){
            meansBySubject.push({
              subject:subj,
              objectifs:subjObjectifs,
              adaptations:subjAdapts,
              moyens:subjMoyens
            });
            totalAdaptationsCount+=subjAdapts.length;
            if(subjObjectifs.length)flatMeansLines.push(`${subj} — Objectifs : ${subjObjectifs.join(' ; ')}`);
            if(subjAdapts.length)flatMeansLines.push(`${subj} — Adaptations : ${subjAdapts.join(' ; ')}`);
            if(subjMoyens.length)flatMeansLines.push(`${subj} — Moyens : ${subjMoyens.join(' ; ')}`);
          }
        });

        // 3. Section Transversale : UNIQUEMENT si explicitement enregistrée comme telle par le professionnel
        const manualTransversal=manualBySubj.get('Transversal (toutes matières)')||manualBySubj.get('Transversal');
        const transversalAdapts=manualTransversal?.adaptations||[];
        const transversalMoyens=manualTransversal?.moyens||[];
        const transversalObjectifs=manualTransversal?.objectifs||[];
        if(transversalAdapts.length||transversalMoyens.length||transversalObjectifs.length){
          meansBySubject.push({
            subject:'Transversal (toutes matières)',
            objectifs:transversalObjectifs,
            adaptations:transversalAdapts,
            moyens:transversalMoyens,
            isTransversal:true
          });
          totalAdaptationsCount+=transversalAdapts.length;
          if(transversalObjectifs.length)flatMeansLines.push(`Transversal (toutes matières) — Objectifs : ${transversalObjectifs.join(' ; ')}`);
          if(transversalAdapts.length)flatMeansLines.push(`Transversal (toutes matières) — Adaptations : ${transversalAdapts.join(' ; ')}`);
          if(transversalMoyens.length)flatMeansLines.push(`Transversal (toutes matières) — Moyens : ${transversalMoyens.join(' ; ')}`);
        }
      }

      const structuredMeans={
        objectifs:meansBySubject.flatMap(m=>m.objectifs),
        adaptations:meansBySubject.flatMap(m=>m.adaptations),
        moyens:meansBySubject.flatMap(m=>m.moyens),
        flatLines:flatMeansLines
      };

      return {
        strengths:strengthSet.slice(0,5),
        fragilityGroups:structuredFragGroups,
        flatFragilities:cleanDiffLines,
        hasFragilities,
        meansBySubject,
        totalAdaptationsCount,
        flatMeansLines,
        structuredMeans
      };
    }

    function buildVisualSynthesisAndPIABridgeHtml(logs,evidence,units,relations,studentName,type,range){
      const studentObj=getStudents().find(s=>String(s.nom||'')===String(studentName))||{nom:studentName,studentId:`stu-${reportNorm(studentName)}`};
      const v74=window.JournalierV74;
      const pia=v74?.ensurePIAForSynthesis?.(studentObj,range.end,logs)||(typeof v74?.buildPIA==='function'?(()=>{try{return v74.buildPIA(studentObj,logs,range.end,null);}catch(_){/* repli si la génération directe du PIA échoue */return null;}})():null);

      // Lot C : Agrégation cloisonnée strictement par matière (clé: matière, indicateur)
      const subjects = reportUnique([
        ...evidence.map(e => e.matiere),
        ...logs.map(l => l.contexte?.matiere || l.identification?.matiere || l.matiere)
      ].filter(Boolean));
      if (!subjects.length) subjects.push('Général');
      const allCanonicalChapters = reportUnique(logs.map(resolveSynthesisCanonicalChapter).filter(c => c && c !== 'Thématique travaillée'));

      function resolveItemSubject(itemMatiere) {
        if (!itemMatiere) return subjects[0] || 'Général';
        const found = subjects.find(s => reportNorm(s) === reportNorm(itemMatiere));
        return found || itemMatiere;
      }

      // Initialisation des structures de données par matière
      const subjectMetricsMap = new Map();
      subjects.forEach(subj => {
        const subjLogs = logs.filter(l => {
          const m = l.contexte?.matiere || l.identification?.matiere || l.matiere;
          return m ? reportNorm(m) === reportNorm(subj) : false;
        });
        const subjEvidence = evidence.filter(e => e.matiere ? reportNorm(e.matiere) === reportNorm(subj) : false);
        const subjPositiveAids = reportUnique(subjEvidence.flatMap(e => (e.adaptations || []).filter(t => Number(e.effects?.[t]) >= 2)));
        const subjPartialAids = reportUnique(subjEvidence.flatMap(e => (e.adaptations || []).filter(t => Number(e.effects?.[t]) === 1 && !subjPositiveAids.includes(t))));
        const subjWbeLines = summarizeSynthesisWbeByCourse(subjLogs.length ? subjLogs : logs.filter(l => (l.contexte?.matiere || l.identification?.matiere || l.matiere) === subj));

        subjectMetricsMap.set(subj, {
          matiere: subj,
          logsCount: subjLogs.length,
          totalCount: 0,
          posCount: 0,
          funcCount: 0,
          fragCount: 0,
          posPct: 0,
          funcPct: 0,
          fragPct: 0,
          kpiGroups: {
            positive: new Map(),
            functional: new Map(),
            fragile: new Map()
          },
          positiveAids: subjPositiveAids,
          partialAids: subjPartialAids,
          wbeLines: subjWbeLines
        });
      });

      const recordKpiOccurrence = (subj, bucket, label, dateStr, chap) => {
        const cleanLabel = toInfinitivePhrase(String(label || '').trim()).replace(/\.$/, '');
        if (!cleanLabel) return;
        const effSubj = resolveItemSubject(subj);
        let sData = subjectMetricsMap.get(effSubj);
        if (!sData) {
          sData = {
            matiere: effSubj,
            logsCount: 0,
            totalCount: 0,
            posCount: 0,
            funcCount: 0,
            fragCount: 0,
            posPct: 0,
            funcPct: 0,
            fragPct: 0,
            kpiGroups: { positive: new Map(), functional: new Map(), fragile: new Map() },
            positiveAids: [],
            partialAids: [],
            wbeLines: []
          };
          subjectMetricsMap.set(effSubj, sData);
          if (!subjects.includes(effSubj)) subjects.push(effSubj);
        }

        const map = sData.kpiGroups[bucket];
        const sKey = semanticSkillDedupeKey(cleanLabel);
        if (!map.has(sKey)) {
          map.set(sKey, { label: cleanLabel, occurrences: 0, rawContexts: [] });
        } else {
          const cur = map.get(sKey);
          cur.label = pickPreferredSkillLabel(cur.label, cleanLabel);
        }
        const entry = map.get(sKey);
        entry.occurrences += 1;
        entry.rawContexts.push({
          date: dateStr || '',
          matiere: effSubj,
          chapter: (chap && chap !== 'Thématique travaillée') ? chap : 'Séance d’accompagnement'
        });
      };

      evidence.forEach(e => {
        const chap = resolveSynthesisCanonicalChapter(e.log || { contexte: { matiere: e.matiere }, objectif: { objectifLecon: e.objectif }, q3: { repereWBE: e.wbeRepere } });
        const effSubj = resolveItemSubject(e.matiere);
        const sData = subjectMetricsMap.get(effSubj);

        (e.observations || []).forEach(o => {
          const n = Number(o.level);
          if (n === 2) {
            if (sData) { sData.posCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'positive', o.text, e.date, chap);
          } else if (n === 1) {
            if (sData) { sData.funcCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'functional', o.text, e.date, chap);
          } else if (n === 0) {
            if (sData) { sData.fragCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'fragile', o.text, e.date, chap);
          }
        });

        (e.indicators || []).forEach(i => {
          const n = Number(i.appreciation);
          if (n === 2) {
            if (sData) { sData.posCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'positive', i.text, e.date, chap);
          } else if (n === 1) {
            if (sData) { sData.funcCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'functional', i.text, e.date, chap);
          } else if (n === 0) {
            if (sData) { sData.fragCount++; sData.totalCount++; }
            recordKpiOccurrence(effSubj, 'fragile', i.text, e.date, chap);
          }
        });
      });

      // Calcul des pourcentages par matière
      subjectMetricsMap.forEach(sData => {
        const safeSubjTotal = Math.max(1, sData.totalCount);
        sData.posPct = sData.totalCount ? Math.round((sData.posCount / safeSubjTotal) * 100) : 0;
        sData.funcPct = sData.totalCount ? Math.round((sData.funcCount / safeSubjTotal) * 100) : 0;
        sData.fragPct = sData.totalCount ? Math.max(0, 100 - sData.posPct - sData.funcPct) : 0;
      });

      const firstDate = evidence[0]?.dateKey ? reportHumanDate(evidence[0].dateKey) : reportHumanDate(range.start);
      const lastDate = evidence.at(-1)?.dateKey ? reportHumanDate(evidence.at(-1).dateKey) : reportHumanDate(range.end);

      const renderKpiTileHtml = (sData, bucketKey, title, subtitle, count, pct, toneClass) => {
        const detailKey = `${reportNorm(sData.matiere)}_${bucketKey}`;
        return `<button type="button" class="synth-kpi-box is-${toneClass} is-interactive" data-synth-kpi-toggle="${escapeHtml(detailKey)}" aria-expanded="false" aria-controls="panel-${escapeHtml(detailKey)}">
          <div class="synth-kpi-box-top">
            <span class="synth-kpi-label">${escapeHtml(title)}</span>
            <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
          </div>
          <strong class="synth-kpi-val">${count} <small>(${pct}%)</small></strong>
          <small class="synth-kpi-sub">${escapeHtml(subtitle)}</small>
        </button>`;
      };

      const renderKpiDrawerHtml = (sData, bucketKey, title, count, pct, toneClass) => {
        const items = [...sData.kpiGroups[bucketKey].values()].sort((a, b) => b.occurrences - a.occurrences);
        const detailKey = `${reportNorm(sData.matiere)}_${bucketKey}`;
        return `<div class="synth-kpi-drawer is-${toneClass} hidden" id="panel-${escapeHtml(detailKey)}" data-synth-kpi-details="${escapeHtml(detailKey)}" data-synth-kpi-panel="${escapeHtml(detailKey)}" data-export-ignore="true" role="region" aria-label="Détail des observations ${escapeHtml(sData.matiere)}">
          <div class="synth-kpi-drawer-head">
            <div>
              <strong>Détail des observations · ${escapeHtml(sData.matiere)}</strong>
              <p>Observations de cette matière classées dans cette catégorie.</p>
            </div>
            <div class="synth-kpi-drawer-actions">
              <button type="button" class="btn-secondary synth-jump-meeting-btn" data-synth-jump-meeting="${bucketKey}">Voir dans l’onglet Réunion(s) →</button>
              <button type="button" class="btn-secondary synth-close-kpi-btn" data-synth-kpi-close="${escapeHtml(detailKey)}">Fermer</button>
            </div>
          </div>
          ${items.length ? `<ul class="synth-kpi-drawer-list">
            ${items.map(it => {
              const groupedDatesList = groupDatesBySubjectAndChapter(it.rawContexts);
              return `<li>
                <div class="synth-kpi-item-main">
                  <strong>${escapeHtml(it.label)}</strong>
                  <span class="synth-kpi-item-badge">vu ${it.occurrences} fois</span>
                </div>
                ${groupedDatesList.length ? `<div class="synth-kpi-item-meta">${escapeHtml(groupedDatesList.join(' · '))}</div>` : ''}
              </li>`;
            }).join('')}
          </ul>` : `<p class="synth-domain-empty">Aucun élément dans cette catégorie pour cette matière.</p>`}
        </div>`;
      };

      const renderSubjectPanelHtml = (sData, isMulti) => {
        const { matiere, logsCount, totalCount: sTotal, posCount: sPos, funcCount: sFunc, fragCount: sFrag, posPct: sPosPct, funcPct: sFuncPct, fragPct: sFragPct, wbeLines, positiveAids, partialAids } = sData;
        return `<div class="synth-subject-panel" data-synth-subject-panel="${escapeHtml(matiere)}">
          ${isMulti ? `<div class="synth-subject-panel-header">
            <div class="synth-subject-panel-title">
              <span class="synth-subject-tag">${escapeHtml(matiere)}</span>
              <span class="synth-subject-meta">${logsCount} séance${logsCount > 1 ? 's' : ''} · ${sTotal} observation${sTotal > 1 ? 's' : ''} évaluée${sTotal > 1 ? 's' : ''}</span>
            </div>
          </div>` : ''}
          <div class="synth-kpi-strip synth-kpi-row-4">
            <div class="synth-kpi-box is-static">
              <span class="synth-kpi-label">Séances analysées</span>
              <strong class="synth-kpi-val">${logsCount}</strong>
              <small>${escapeHtml(matiere)} · ${sTotal} obs. évaluée${sTotal > 1 ? 's' : ''}</small>
            </div>
            ${renderKpiTileHtml(sData, 'positive', 'Points d’appui / acquis', 'Acquis / Maîtrisé', sPos, sPosPct, 'positive')}
            ${renderKpiTileHtml(sData, 'functional', 'Fonctionnel / en cours', 'En cours d’appropriation', sFunc, sFuncPct, 'functional')}
            ${renderKpiTileHtml(sData, 'fragile', 'Points à travailler', 'À renforcer', sFrag, sFragPct, 'fragile')}
          </div>
          <div class="synth-kpi-drawers-container" data-export-ignore="true">
            ${renderKpiDrawerHtml(sData, 'positive', 'Points d’appui / acquis', sPos, sPosPct, 'positive')}
            ${renderKpiDrawerHtml(sData, 'functional', 'Fonctionnel / en cours', sFunc, sFuncPct, 'functional')}
            ${renderKpiDrawerHtml(sData, 'fragile', 'Fragilités / à renforcer', sFrag, sFragPct, 'fragile')}
          </div>
          ${sTotal > 0 ? `<div class="synth-progress-wrap" data-export-ignore="true">
            <div class="synth-progress-bar" role="img" aria-label="Répartition ${escapeHtml(matiere)} : ${sPosPct}% acquis, ${sFuncPct}% en cours, ${sFragPct}% fragile">
              ${sPosPct > 0 ? `<span class="synth-bar-seg is-positive" style="width:${sPosPct}%"></span>` : ''}
              ${sFuncPct > 0 ? `<span class="synth-bar-seg is-functional" style="width:${sFuncPct}%"></span>` : ''}
              ${sFragPct > 0 ? `<span class="synth-bar-seg is-fragile" style="width:${sFragPct}%"></span>` : ''}
            </div>
            <div class="synth-progress-legend">
              <span class="is-positive">● Acquis / maîtrisé (${sPosPct}%)</span>
              <span class="is-functional">● Fonctionnel / en appropriation (${sFuncPct}%)</span>
              <span class="is-fragile">● Fragile / à renforcer (${sFragPct}%)</span>
            </div>
          </div>` : ''}
          <p class="synth-export-only-line">${escapeHtml(matiere)} : ${sPos} point(s) d’appui (${sPosPct}%) · ${sFunc} élément(s) fonctionnel(s) en cours de consolidation (${sFuncPct}%) · ${sFrag} fragilité(s) à renforcer (${sFragPct}%).</p>
          ${(wbeLines.length || positiveAids.length || partialAids.length) ? `<div class="synth-meta-pills">
            ${wbeLines.length ? `<div class="synth-meta-row"><span>Repères WBE mobilisés :</span> <strong>${escapeHtml(wbeLines.join(' '))}</strong></div>` : ''}
            ${positiveAids.length ? `<div class="synth-meta-row"><span>Leviers &amp; aides efficaces :</span> <strong>${escapeHtml(positiveAids.join(' ; '))}.</strong></div>` : ''}
            ${partialAids.length ? `<div class="synth-meta-row"><span>Aides partiellement efficaces :</span> <strong>${escapeHtml(partialAids.join(' ; '))}.</strong></div>` : ''}
          </div>` : ''}
        </div>`;
      };

      const isMultiSubjects = subjects.length > 1;
      const subjectSelectorHtml = `<div class="synth-subject-selector-bar" data-export-ignore="true">
        <span class="synth-subject-selector-title">Filtrer par matière :</span>
        <div class="synth-subject-chips" role="tablist" aria-label="Matières évaluées">
          <button type="button" class="synth-subject-chip is-active" data-synth-subject-filter="all" role="tab" aria-selected="true">
            Toutes les matières <span class="synth-chip-badge">${subjects.length}</span>
          </button>
          ${subjects.map(s => {
            const sData = subjectMetricsMap.get(s);
            const countLabel = `${sData?.logsCount || 0} s.`;
            return `<button type="button" class="synth-subject-chip" data-synth-subject-filter="${escapeHtml(s)}" role="tab" aria-selected="false">
              ${escapeHtml(s)} <span class="synth-chip-badge">${countLabel}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;

      const subjectPanelsHtml = subjects.map(s => renderSubjectPanelHtml(subjectMetricsMap.get(s), isMultiSubjects)).join('');

      // BLOC 1 : BANDEAU VISUEL DE PROFIL & RÉPARTITION (Dépliage indépendant de chaque catégorie ou simultané)
      const bloc1Html=`<section class="report-section synth-visual-card">
        <details class="synth-section-accordion" open>
          <summary class="synth-section-head is-clickable">
            <div>
              <span class="synth-kicker" data-export-ignore="true">Vue d’ensemble par matière</span>
              <h4>1. Vue d’ensemble sur la période</h4>
            </div>
            <div class="synth-head-right-tools" data-export-ignore="true">
              <button type="button" class="btn-secondary synth-kpi-expand-all" data-synth-kpi-expand="true"><span class="synth-btn-icon">⇅</span> Tout afficher / masquer</button>
              <span class="synth-period-pill">${escapeHtml(`${logs.length} séance${logs.length>1?'s':''} · du ${firstDate} au ${lastDate}`)}</span>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-section-accordion-body">
            ${subjectSelectorHtml}
            <div class="synth-subject-panels">
              ${subjectPanelsHtml}
            </div>
          </div>
        </details>
      </section>`;

      // BLOC 2 : TRAJECTOIRE LONGITUDINALE PAR CHAPITRE (Uniquement pour les séances avec observations exploitables)
      const exploitableLogs = (logs || []).filter(isSessionExploitable);
      const unexploitedLogs = (logs || []).filter(l => !isSessionExploitable(l));
      const chapterClusters = buildChapterLongitudinalClusters(exploitableLogs);
      const chaptersHtml=chapterClusters.map((cluster,cIdx)=>{
        const savedCustomNarrative = (typeof window !== 'undefined' && window.DataStore?.getChapterNarrative) ? window.DataStore.getChapterNarrative(cluster.key) : null;
        const displayNarrative = savedCustomNarrative || cluster.narrative;
        const sessionItemsHtml=cluster.sessions.map(log=>{
          const sp=sessionParts(log);
          const hDate=reportHumanDate(sp.date);
          const obj=log.objectif?.objectifLecon||log.objectif?.objectifProfessionnel||'Séance d’accompagnement';
          const summaryLines=renderSynthesisSessionSummary(log);
          return `<div class="synth-chapter-session-item">
            <div class="synth-chapter-session-head"><strong>${escapeHtml(`${hDate} — ${obj}`)}</strong></div>
            <ul class="synth-timeline-list">${summaryLines.map(l=>`<li>${escapeHtml(l)}</li>`).join('')}</ul>
          </div>`;
        }).join('');

        return `<details class="synth-chapter-accordion is-${cluster.dominantTone}" ${cIdx<3?'open':''} data-synth-chapter-card="${cIdx}">
          <summary class="synth-chapter-summary is-clickable">
            <div class="synth-chapter-title-wrap">
              <span class="synth-timeline-dot" data-export-ignore="true">${cIdx+1}</span>
              <div>
                <strong>${escapeHtml(`${cluster.matiere} — Chapitre : ${cluster.chapter}`)}</strong>
                <span class="synth-chapter-meta">${escapeHtml(`${cluster.count} séance${cluster.count>1?'s':''}${cluster.periodHint?` · ${cluster.periodHint}`:''}`)}</span>
              </div>
            </div>
            <div class="synth-chapter-head-tools" data-export-ignore="true">
              <span class="synth-tone-badge is-${cluster.dominantTone}">${escapeHtml(cluster.toneLabel)}</span>
              <button type="button" class="btn-secondary synth-chapter-edit-toggle" data-synth-chapter-toggle="${cIdx}">✎ Ajuster</button>
              <button type="button" class="btn-secondary synth-chapter-ai-btn" data-synth-chapter-ai="${cIdx}">✎ Ajuster le texte</button>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-chapter-body">
            <p class="synth-chapter-narrative" data-synth-chapter-narrative="${cIdx}">${escapeHtml(displayNarrative)}</p>
            <div class="synth-chapter-editor hidden" data-export-ignore="true" data-synth-chapter-editor="${cIdx}">
              <label>
                <span>Ajuster le récit synthétique du chapitre :</span>
                <textarea rows="3" class="synth-chapter-narrative-input" data-synth-chapter-input="${cIdx}">${escapeHtml(displayNarrative)}</textarea>
              </label>
              <div class="synth-chapter-editor-actions">
                <button type="button" class="btn-primary" data-synth-chapter-save="${cIdx}" data-cluster-key="${escapeHtml(cluster.key)}">✓ Enregistrer la synthèse</button>
                <button type="button" class="btn-secondary synth-chapter-ai-btn" data-synth-chapter-ai="${cIdx}">✎ Ajuster le texte</button>
                <button type="button" class="btn-secondary synth-chapter-cancel-btn" data-synth-chapter-cancel="${cIdx}">Fermer</button>
              </div>
            </div>
            <details class="synth-chapter-sessions-disclosure" data-export-ignore="true">
              <summary>Voir le détail des ${cluster.count} séance${cluster.count>1?'s':''} associée${cluster.count>1?'s':''}</summary>
              <div class="synth-chapter-sessions-list">${sessionItemsHtml}</div>
            </details>
          </div>
        </details>`;
      }).join('');

      const unexploitedLineHtml = unexploitedLogs.length ? (() => {
        const dateTokens = reportUnique(unexploitedLogs.map(l => {
          const d = sessionParts(l).date || l.date;
          return d ? reportHumanDate(d) : '';
        }).filter(Boolean));
        const datesStr = dateTokens.join(', ') || 'dates non renseignées';
        const label = `${unexploitedLogs.length} séance${unexploitedLogs.length > 1 ? 's' : ''} sans observation renseignée (${datesStr})`;
        return `<details class="synth-unexploited-sessions-disclosure" data-export-ignore="true">
          <summary class="synth-unexploited-summary">${escapeHtml(label)}</summary>
          <div class="synth-unexploited-body">
            <p>Ces séances sont comptabilisées dans l’agenda et le volume d’accompagnement global (${logs.length} séance${logs.length > 1 ? 's' : ''} au total sur la période), mais ne contiennent pas d'observations cliniques ou d'adaptations exploitables pour la synthèse.</p>
          </div>
        </details>`;
      })() : '';

      const bloc2Html=`<section class="report-section synth-timeline-card">
        <details class="synth-section-accordion" open>
          <summary class="synth-section-head is-clickable">
            <div>
              <span class="synth-kicker" data-export-ignore="true">Évolution par chapitre</span>
              <h4>2. Synthèse par chapitre &amp; évolution (${chapterClusters.length} thématique${chapterClusters.length>1?'s':''} · ${logs.length} séance${logs.length>1?'s':''})</h4>
            </div>
            <div class="synth-head-right-tools" data-export-ignore="true">
              <button type="button" class="btn-secondary synth-chapters-expand-all" data-synth-chapters-expand="true"><span class="synth-btn-icon">⇅</span> Tout afficher / masquer</button>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-section-accordion-body">
            <div class="synth-timeline-stack">
              ${chaptersHtml}
              ${unexploitedLineHtml}
            </div>
          </div>
        </details>
      </section>`;

      // BLOC 3 : PORTRAIT PAR LES 5 DOMAINES DU PIA (Accordéons intelligents + Arborescence Matière -> Chapitre -> Compétence)
      const sections=Array.isArray(pia?.sections)?pia.sections:[];
      const domainsGridHtml=sections.map((sec,dIdx)=>{
        const tone=v74?.piaDomainTone?.(sec.aspect)||'neutral';
        const icon=v74?.piaDomainIcon?.(sec.aspect,dIdx)||'';
        const summary=buildStructuredDomainSummaryForSynthesis(sec,pia,logs,allCanonicalChapters.length);
        const hasContent=summary.strengths.length>0||summary.hasFragilities;

        const strengthsHtml=summary.strengths.length
          ? `<div class="synth-clean-group"><strong>Points forts :</strong><ul>${summary.strengths.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
          : `<p class="synth-domain-empty">Aucun point fort spécifique documenté sur cette période.</p>`;

        const fragilitiesHtml=summary.hasFragilities
          ? summary.fragilityGroups.map(fg=>`<div class="synth-clean-group synth-tree-group">
              <strong>${escapeHtml(fg.subject)} :</strong>
              <ul class="synth-tree-chapters">
                ${(fg.chapters||[]).map(ch=>`<li>
                  <span class="synth-tree-chapter-title">${escapeHtml(ch.chapter)}</span>
                  <ul class="synth-tree-skills">
                    ${(ch.skills||[]).map(sk=>`<li>${escapeHtml(sk)}</li>`).join('')}
                  </ul>
                </li>`).join('')}
              </ul>
            </div>`).join('')
          : `<p class="synth-domain-empty">Aucune fragilité signalée dans ce domaine.</p>`;

        const meansHtml=summary.hasFragilities && summary.meansBySubject.length
          ? summary.meansBySubject.map(ms=>`<div class="synth-clean-group synth-tree-group">
              <strong>${escapeHtml(ms.subject)} :</strong>
              <div class="synth-subject-means-content">
                ${ms.objectifs.length?`<div class="synth-means-row"><strong>Objectifs retenus :</strong> <span>${escapeHtml(ms.objectifs.join(' ; '))}</span></div>`:''}
                ${ms.adaptations.length?`<div class="synth-means-row"><strong>Adaptations mobilisées :</strong> <span>${escapeHtml(ms.adaptations.join(' ; '))}</span></div>`:''}
                ${ms.moyens.length?`<div class="synth-means-row"><strong>Moyens &amp; actions :</strong> <span>${escapeHtml(ms.moyens.join(' ; '))}</span></div>`:''}
                ${!ms.objectifs.length&&!ms.adaptations.length&&!ms.moyens.length?`<p class="synth-domain-empty">Aucune adaptation spécifique renseignée en séance pour cette matière.</p>`:''}
              </div>
            </div>`).join('')
          : `<p class="synth-domain-empty">Aucun besoin d’adaptation (aucune fragilité renseignée dans ce domaine).</p>`;

        const statusBadgeText=summary.hasFragilities
          ? `${summary.strengths.length} point(s) fort(s) · ${summary.flatFragilities.length} fragilité(s) · ${summary.totalAdaptationsCount} adaptation(s)`
          : (summary.strengths.length?`${summary.strengths.length} point(s) fort(s) · Aucune fragilité`:'R.A.S. sur la période');

        return `<details class="synth-domain-card synth-domain-accordion tone-${escapeHtml(tone)} ${hasContent?'is-populated':'is-empty'}" data-synth-domain-card="${dIdx}" ${hasContent?'open':''}>
          <summary class="synth-domain-head is-clickable">
            <div class="synth-domain-title-wrap">
              <span class="synth-domain-icon" data-export-ignore="true">${icon}</span>
              <div>
                <h5>${escapeHtml(sec.aspect||'Domaine')}</h5>
                <span class="synth-domain-sub" data-export-ignore="true">${escapeHtml(statusBadgeText)}</span>
              </div>
            </div>
            <div class="synth-domain-head-actions" data-export-ignore="true">
              <button type="button" class="btn-secondary synth-domain-edit-toggle" data-synth-domain-toggle="${dIdx}">✎ Ajuster</button>
              <button type="button" class="btn-secondary synth-domain-ai-btn" data-synth-domain-ai="${dIdx}">✎ Ajuster le texte</button>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-domain-body">
            <div class="synth-domain-cols">
              <div class="synth-domain-col is-res">
                <h6>Ressources &amp; points forts</h6>
                ${strengthsHtml}
              </div>
              <div class="synth-domain-col is-diff">
                <h6>Fragilités &amp; besoins situés</h6>
                ${fragilitiesHtml}
              </div>
              <div class="synth-domain-col is-moy">
                <h6>Moyens, adaptations &amp; objectifs retenus</h6>
                ${meansHtml}
              </div>
            </div>
            <div class="synth-domain-editor hidden" data-export-ignore="true" data-synth-domain-editor="${dIdx}">
              <div class="synth-domain-editor-grid">
                <label>
                  <span>Points forts (1 par ligne)</span>
                  <textarea rows="3" data-synth-domain-input="${dIdx}" data-synth-field="ressources">${escapeHtml(summary.strengths.join('\n'))}</textarea>
                </label>
                <label>
                  <span>Fragilités / besoins (1 par ligne)</span>
                  <textarea rows="3" data-synth-domain-input="${dIdx}" data-synth-field="difficultes">${escapeHtml(summary.flatFragilities.join('\n'))}</textarea>
                </label>
                <label>
                  <span>Objectifs, adaptations &amp; moyens (1 par ligne)</span>
                  <textarea rows="3" data-synth-domain-input="${dIdx}" data-synth-field="moyens">${escapeHtml(summary.structuredMeans.flatLines.join('\n'))}</textarea>
                </label>
              </div>
              <div class="synth-domain-editor-actions">
                <button type="button" class="btn-primary" data-synth-domain-save="${dIdx}">✓ Enregistrer dans le PIA</button>
                <button type="button" class="btn-secondary synth-domain-ai-field-btn" data-synth-domain-ai="${dIdx}">✎ Ajuster le texte</button>
              </div>
            </div>
          </div>
        </details>`;
      }).join('');

      const populatedCount=sections.filter(sec=>{
        const s=buildStructuredDomainSummaryForSynthesis(sec,pia,logs,allCanonicalChapters.length);
        return s.strengths.length>0||s.hasFragilities;
      }).length;

      const bloc3Html=`<section class="report-section synth-domains-section">
        <details class="synth-section-accordion" open>
          <summary class="synth-section-head is-clickable">
            <div>
              <span class="synth-kicker" data-export-ignore="true">Ce qui alimente le PIA</span>
              <h4>3. Portrait par les 5 domaines du PIA (${populatedCount}/5 domaine${populatedCount>1?'s':''} actif${populatedCount>1?'s':''} sur la période)</h4>
              <p class="synth-section-sub" data-export-ignore="true">Les domaines actifs sont mis en avant automatiquement ; les autres domaines restent condensés.</p>
            </div>
            <div class="synth-head-right-tools" data-export-ignore="true">
              <button type="button" class="btn-secondary synth-domains-expand-all" data-synth-domains-expand="true"><span class="synth-btn-icon">⇅</span> Tout afficher / masquer</button>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-section-accordion-body">
            <div class="synth-domains-stack">
              ${domainsGridHtml||'<p>Aucun domaine PIA disponible.</p>'}
            </div>
          </div>
        </details>
      </section>`;

      // BLOC 4 : VALIDATION DES STRATÉGIES & OBJECTIFS POUR LE PIA (Fusionné par Domaine + Arborescence Matière -> Chapitre -> Compétence + Séances groupées par chapitre)
      const proposals=Array.isArray(pia?.propositions)?pia.propositions:[];
      const counts=v74?.getPIADecisionCounts?.(pia)||{total:proposals.length,validated:0,pending:proposals.length,refused:0};
      const proposalsHtml=proposals.length
        ? proposals.map((p,pIdx)=>{
            const status=p.decisionStatus||'A_EXAMINER';
            const statusLabel={A_EXAMINER:'À examiner',VALIDEE:'Validée pour le PIA',REFUSEE:'Écartée'}[status]||'À examiner';
            const statusTone={A_EXAMINER:'pending',VALIDEE:'validated',REFUSEE:'refused'}[status]||'pending';
            const isEditable=status==='A_EXAMINER';
            const rawWbeList=Array.isArray(p.wbeReperes)&&p.wbeReperes.length?p.wbeReperes:allCanonicalChapters.slice(0,2);
            const wbeList=reportUnique(rawWbeList.map(w=>v74?.canonicalizeWbeChapter?v74.canonicalizeWbeChapter(w,'',''):cleanSynthWbeToken(w)).filter(Boolean));
            const cleanMoyens=reportUnique((p.moyensAssocies||[]).map(m=>String(m||'').replace(/\s*\(effet[^)]*\)/gi,'').trim()).filter(Boolean));

            // Regroupement des dates contributrices par Matière · Chapitre
            const evOccurrences=(p.evidence||[]).map(item=>{
              const chap=item.chapter||(v74?.canonicalizeWbeChapter?v74.canonicalizeWbeChapter(item.wbeRepere||'',item.objectif||'',item.matiere||''):(cleanSynthWbeToken(item.wbeRepere)||formatChapterName(item.objectif)||'Séance'));
              return {date:item.date||'',matiere:item.matiere||'Matière non renseignée',chapter:chap};
            });
            const groupedContributorsList=groupDatesBySubjectAndChapter(evOccurrences);

            // Arborescence Matière -> Chapitre -> Compétence ciblée
            const contextTree=Array.isArray(p.contextTree)&&p.contextTree.length
              ? p.contextTree
              : (v74?.buildProposalContextTreeV74 ? v74.buildProposalContextTreeV74(p) : (v74?.buildContextTreeFromUnitsV74 ? v74.buildContextTreeFromUnitsV74(p.evidence||[]) : []));
            const treeHtml=contextTree.length
              ? `<div class="synth-clean-group synth-prop-tree">
                  <span class="synth-prop-tree-label">Contextes &amp; compétences ciblées :</span>
                  ${contextTree.map(fg=>`<div class="synth-tree-group">
                    <strong>${escapeHtml(fg.subject)} :</strong>
                    <ul class="synth-tree-chapters">
                      ${(fg.chapters||[]).map(ch=>`<li>
                        <span class="synth-tree-chapter-title">${escapeHtml(ch.chapter)}${Array.isArray(ch.dates)&&ch.dates.length?` (${escapeHtml(ch.dates.join(', '))})`:''}</span>
                        ${(ch.skills||[]).length?`<ul class="synth-tree-skills">
                          ${(ch.skills||[]).map(sk=>`<li>${escapeHtml(sk)}</li>`).join('')}
                        </ul>`:''}
                      </li>`).join('')}
                    </ul>
                  </div>`).join('')}
                </div>`
              : '';

            const cleanFormulation=String(p.formulation||'').replace(/\s*\(Situations observées\s*:[^)]*\)/gi,'').trim();
            return `<details class="synth-prop-card synth-prop-accordion is-${statusTone}" data-synth-prop-card="${pIdx}" open>
              <summary class="synth-prop-top is-clickable">
                <div class="synth-prop-summary-left">
                  <div class="synth-prop-badges">
                    <span class="synth-prop-domain">${escapeHtml(p.aspect||'Domaine PIA')}</span>
                    ${wbeList.length?`<span class="synth-wbe-badge">Chapitre(s) : ${escapeHtml(wbeList.join(' · '))}</span>`:''}
                    <span class="synth-prop-trace">Observé sur ${Number(p.sessionCount||0)} séance(s)</span>
                  </div>
                  <strong class="synth-prop-summary-title">${escapeHtml(p.theme||'Proposition d’objectif')}</strong>
                </div>
                <div class="synth-prop-summary-right">
                  <span class="synth-prop-status is-${statusTone}">${escapeHtml(statusLabel)}</span>
                  <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
                </div>
              </summary>
              <div class="synth-prop-body">
                ${treeHtml}
                <div class="synth-prop-formulation-wrap" data-export-ignore="true">
                  <div class="synth-prop-label-row">
                    <span>Formulation de l’objectif :</span>
                    <button type="button" class="btn-secondary synth-prop-ai-btn" data-synth-prop-ai="${pIdx}" title="Ajuster le texte ou suggérer des aménagements">✎ Ajuster le texte</button>
                  </div>
                  <textarea rows="2" class="synth-prop-textarea" data-synth-prop-text="${pIdx}" ${isEditable?'':'readonly'}>${escapeHtml(cleanFormulation)}</textarea>
                </div>
                <p class="synth-export-only-line">Objectif (${escapeHtml(statusLabel)}) : ${escapeHtml(cleanFormulation)}</p>
                ${cleanMoyens.length?`
                  <div class="synth-suggested-aids-block" data-export-ignore="true">
                    <span class="synth-suggested-aids-label">Pistes &amp; adaptations suggérées (cliquez pour ajouter en sous-point) :</span>
                    <div class="synth-suggested-aids-pills">
                      ${cleanMoyens.map(m=>`
                        <button type="button" class="synth-aid-add-btn" data-synth-add-aid="${pIdx}" data-aid-text="${escapeHtml(m)}" title="Ajouter en sous-point à cet objectif">
                          <span class="synth-aid-add-icon">＋</span>
                          <span class="synth-aid-add-text">${escapeHtml(m)}</span>
                        </button>
                      `).join('')}
                    </div>
                  </div>
                `:''}
                ${groupedContributorsList.length?`<details class="synth-prop-details" data-export-ignore="true"><summary>Séances contributrices par chapitre</summary><div class="synth-prop-dates">${escapeHtml(groupedContributorsList.join(' · '))}</div></details>`:''}
              </div>
              <div class="synth-prop-actions" data-export-ignore="true">
                ${status==='A_EXAMINER'?`
                  <button type="button" class="v74-btn v74-btn-neutral" data-synth-prop-save="${pIdx}">Enregistrer le texte</button>
                  <button type="button" class="v74-btn v74-btn-success" data-synth-prop-accept="${pIdx}">✓ Valider pour le PIA</button>
                  <button type="button" class="v74-btn v74-btn-danger" data-synth-prop-reject="${pIdx}">✕ Écarter</button>
                `:status==='VALIDEE'?`
                  <button type="button" class="v74-btn v74-btn-neutral" data-synth-prop-reopen="${pIdx}">✎ Modifier / Remettre à examiner</button>
                  <button type="button" class="v74-btn v74-btn-danger" data-synth-prop-reject="${pIdx}">✕ Écarter</button>
                `:`
                  <button type="button" class="v74-btn v74-btn-neutral" data-synth-prop-reopen="${pIdx}">↺ Remettre à examiner</button>
                  <button type="button" class="v74-btn v74-btn-success" data-synth-prop-accept="${pIdx}">✓ Valider pour le PIA</button>
                `}
              </div>
            </details>`;
          }).join('')
        : `<p class="synth-domain-empty">Aucune proposition convergente détectée automatiquement sur cette période. Vous pouvez compléter librement les domaines ci-dessus ou basculer vers le PIA annuel.</p>`;

      const bloc4Html=`<section class="report-section synth-validation-section">
        <details class="synth-section-accordion" open>
          <summary class="synth-section-head is-clickable">
            <div>
              <span class="synth-kicker" data-export-ignore="true">Décision &amp; continuité vers le PIA</span>
              <h4>4. Validation des objectifs &amp; stratégies pour le PIA annuel</h4>
              <p class="synth-section-sub" data-export-ignore="true">Validez ou ajustez ici les propositions issues de vos séances. Elles seront immédiatement prêtes dans l’onglet PIA annuel sans ressaisie.</p>
            </div>
            <div class="synth-head-right-tools" data-export-ignore="true">
              <button type="button" class="btn-secondary synth-proposals-expand-all" data-synth-proposals-expand="true"><span class="synth-btn-icon">⇅</span> Tout afficher / masquer</button>
              <div class="synth-prop-counters">
                <span class="v74-prop-counter is-validated">✓ ${counts.validated} validée(s)</span>
                <span class="v74-prop-counter is-pending">⏳ ${counts.pending} à examiner</span>
                <span class="v74-prop-counter is-refused">✕ ${counts.refused} écartée(s)</span>
              </div>
              <span class="synth-apple-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </div>
          </summary>
          <div class="synth-section-accordion-body">
            <div class="synth-proposals-stack">
              ${proposalsHtml}
            </div>
            <div class="synth-pia-cta-bar" data-export-ignore="true">
              <div>
                <strong>Continuité directe vers le PIA annuel</strong>
                <p>Toutes vos validations et modifications ci-dessus sont déjà intégrées au dossier PIA de ${escapeHtml(studentName)}.</p>
              </div>
              <button type="button" class="btn-primary synth-open-pia-btn" data-synth-open-pia="true">Ouvrir le PIA annuel pré-rempli →</button>
            </div>
          </div>
        </details>
      </section>`;

      if (typeof window !== 'undefined') {
        window._lastSynthesisPIA = pia;
      }

      return {
        pia,
        html:`<div class="natural-report synth-workspace-grid">${bloc1Html}${bloc2Html}${bloc3Html}${bloc4Html}</div>`
      };
    }

    function bindSynthesisPIABridgeEvents(container,pia,rerenderCallback){
      // Assistant local pour les constats qualitatifs : traitement local sur l'appareil.
      container.querySelectorAll('[data-qualitative-ai-open]').forEach(btn=>{
        btn.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          const item=btn.closest('[data-qualitative-constats]');
          const editor=item?.querySelector('[data-qualitative-ai-editor]');
          editor?.classList.remove('hidden');
          const input=item?.querySelector('[data-qualitative-ai-input]');
          if(input&&window.LocalAIAssistant?.open){
            window.LocalAIAssistant.open(input);
          } else if(input) {
            input.focus();
          }
        });
      });
      container.querySelectorAll('[data-qualitative-ai-run]').forEach(btn=>{
        btn.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          const item=btn.closest('[data-qualitative-constats]');
          const input=item?.querySelector('[data-qualitative-ai-input]');
          if(!input || !String(input.value||'').trim()){
            window.showAppToast?.('Ajoute un constat avant de demander un ajustement.','info',2500);
            return;
          }
          if(window.LocalAIAssistant?.open){
            window.LocalAIAssistant.open(input);
          } else if(window.LocalAIAssistant?.improve){
            const original=String(input.value||'');
            btn.disabled=true;
            btn.textContent='Ajustement en cours…';
            window.LocalAIAssistant.improve(original,'grammar').then(proposal=>{
              if(!String(proposal||'').trim())throw new Error('La proposition est vide.');
              input.value=String(proposal).trim();
              input.dispatchEvent(new Event('input',{bubbles:true}));
              input.dispatchEvent(new Event('change',{bubbles:true}));
              window.showAppToast?.('Proposition locale prête : vérifie-la puis valide-la dans le rapport.','success',3000);
            }).catch(error=>{
              console.error('Échec d’ajustement local du constat',error);
              window.showAppToast?.('L’ajustement local a échoué. Le texte initial est conservé.','error',3500);
            }).finally(()=>{
              btn.disabled=false;
              btn.textContent='✎ Ajuster le texte';
            });
          }else{
            window.showAppToast?.('La fonction d’ajustement local n’est pas disponible.','error',3000);
          }
        });
      });
      container.querySelectorAll('[data-qualitative-ai-apply]').forEach(btn=>{
        btn.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          const item=btn.closest('[data-qualitative-constats]');
          const input=item?.querySelector('[data-qualitative-ai-input]');
          const result=item?.querySelector('[data-qualitative-ai-result]');
          const text=String(input?.value||'').trim();
          if(!text){
            window.showAppToast?.('La proposition ne peut pas être vide.','info',2500);
            return;
          }
          if(result){
            result.hidden=false;
            result.innerHTML=`<div style="border:1px solid var(--border,#cbd5e1);border-radius:8px;padding:12px;margin-top:10px;background:var(--surface,#fff);"><strong>Constat reformulé (validé pour ce rapport)</strong><p style="white-space:pre-wrap;margin:8px 0 0;">${escapeHtml(text)}</p></div>`;
          }
          const original=item?.querySelector('[data-qualitative-original]');
          if(original) original.innerHTML=text.split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>`<li>${escapeHtml(line)}</li>`).join('');
          item?.querySelector('[data-qualitative-ai-editor]')?.classList.add('hidden');
          window.showAppToast?.('Proposition appliquée à l’affichage du rapport. Les observations sources restent inchangées.','success',3000);
        });
      });
      container.querySelectorAll('[data-qualitative-ai-cancel]').forEach(btn=>{
        btn.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          btn.closest('[data-qualitative-constats]')?.querySelector('[data-qualitative-ai-editor]')?.classList.add('hidden');
        });
      });
      if(!container)return;
      const v74=window.JournalierV74;

      // Point 1 : Sélecteur de matière (Piste 1) & tiroirs d'indicateurs
      const subjectChips = container.querySelectorAll('.synth-visual-card [data-synth-subject-filter]');
      const subjectPanels = container.querySelectorAll('.synth-visual-card [data-synth-subject-panel]');
      subjectChips.forEach(chip => {
        chip.addEventListener('click', e => {
          e.preventDefault();
          const targetSubj = chip.dataset.synthSubjectFilter;
          subjectChips.forEach(c => {
            const isActive = (c === chip);
            c.classList.toggle('is-active', isActive);
            c.setAttribute('aria-selected', isActive ? 'true' : 'false');
          });
          subjectPanels.forEach(panel => {
            if (targetSubj === 'all' || panel.dataset.synthSubjectPanel === targetSubj) {
              panel.classList.remove('hidden');
            } else {
              panel.classList.add('hidden');
            }
          });
        });
      });

      container.querySelectorAll('[data-synth-kpi-toggle]').forEach(tileBtn => {
        tileBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const key = tileBtn.dataset.synthKpiToggle;
          const parentPanel = tileBtn.closest('.synth-subject-panel') || container;
          const targetDrawer = parentPanel.querySelector(`[data-synth-kpi-panel="${key}"]`);
          const allDrawers = parentPanel.querySelectorAll('[data-synth-kpi-panel]');
          const allTiles = parentPanel.querySelectorAll('[data-synth-kpi-toggle]');
          const isOpen = targetDrawer && !targetDrawer.classList.contains('hidden');

          allDrawers.forEach(d => d.classList.add('hidden'));
          allTiles.forEach(t => {
            t.setAttribute('aria-expanded', 'false');
            t.classList.remove('is-active');
          });

          if (!isOpen && targetDrawer) {
            targetDrawer.classList.remove('hidden');
            tileBtn.setAttribute('aria-expanded', 'true');
            tileBtn.classList.add('is-active');
          }
        });
      });

      container.querySelectorAll('[data-synth-kpi-close]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const key = btn.dataset.synthKpiClose;
          const parentPanel = btn.closest('.synth-subject-panel') || container;
          const targetDrawer = parentPanel.querySelector(`[data-synth-kpi-panel="${key}"]`);
          const targetTile = parentPanel.querySelector(`[data-synth-kpi-toggle="${key}"]`);
          if (targetDrawer) targetDrawer.classList.add('hidden');
          if (targetTile) {
            targetTile.setAttribute('aria-expanded', 'false');
            targetTile.classList.remove('is-active');
            targetTile.focus?.();
          }
        });
      });

      container.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const openDrawer = container.querySelector('[data-synth-kpi-panel]:not(.hidden)');
          if (openDrawer) {
            const key = openDrawer.dataset.synthKpiPanel;
            openDrawer.classList.add('hidden');
            const tile = container.querySelector(`[data-synth-kpi-toggle="${key}"]`);
            if (tile) {
              tile.setAttribute('aria-expanded', 'false');
              tile.classList.remove('is-active');
              tile.focus?.();
            }
          }
        }
      });

      container.querySelector('[data-synth-kpi-expand]')?.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const masterCard = container.querySelector('.synth-visual-card details.synth-section-accordion');
        if (masterCard) masterCard.open = true;
        const visiblePanels = [...container.querySelectorAll('.synth-subject-panel:not(.hidden)')];
        visiblePanels.forEach(p => {
          const allDrawers = p.querySelectorAll('[data-synth-kpi-panel]');
          const allTiles = p.querySelectorAll('[data-synth-kpi-toggle]');
          const anyOpen = [...allDrawers].some(d => !d.classList.contains('hidden'));
          if (anyOpen) {
            allDrawers.forEach(d => d.classList.add('hidden'));
            allTiles.forEach(t => {
              t.setAttribute('aria-expanded', 'false');
              t.classList.remove('is-active');
            });
          } else if (allDrawers[0]) {
            allDrawers[0].classList.remove('hidden');
            if (allTiles[0]) {
              allTiles[0].setAttribute('aria-expanded', 'true');
              allTiles[0].classList.add('is-active');
            }
          }
        });
      });
      container.querySelectorAll('[data-synth-jump-meeting]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const key=btn.dataset.synthJumpMeeting;
          setReportsTab('meeting');
          const meetingOut=document.getElementById('meeting-prep-output');
          const targetGroup=meetingOut?.querySelector(`.meeting-prep-degree-group.is-${key}`)||meetingOut;
          targetGroup?.scrollIntoView?.({behavior:'smooth',block:'start'});
          if(targetGroup&&targetGroup.classList){
            targetGroup.classList.add('synth-highlight-pulse');
            setTimeout(()=>targetGroup.classList.remove('synth-highlight-pulse'),2200);
          }
        });
      });

      // Point 2 : Trajectoire longitudinale — Déplier/replier, Ajuster et IA
      container.querySelector('[data-synth-chapters-expand]')?.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        const masterCard=container.querySelector('.synth-timeline-card details.synth-section-accordion');
        if(masterCard) masterCard.open = true;
        const chapters=[...container.querySelectorAll('details.synth-chapter-accordion')];
        const allOpen=chapters.every(c=>c.open);
        chapters.forEach(c=>{c.open=!allOpen;});
      });
      container.querySelectorAll('[data-synth-chapter-toggle]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const idx=btn.dataset.synthChapterToggle;
          const card=container.querySelector(`[data-synth-chapter-card="${idx}"]`);
          if(card)card.open=true;
          const editor=container.querySelector(`[data-synth-chapter-editor="${idx}"]`);
          editor?.classList.toggle('hidden');
        });
      });
      container.querySelectorAll('[data-synth-chapter-ai]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const idx=btn.dataset.synthChapterAi;
          const card=container.querySelector(`[data-synth-chapter-card="${idx}"]`);
          if(card)card.open=true;
          const editor=container.querySelector(`[data-synth-chapter-editor="${idx}"]`);
          editor?.classList.remove('hidden');
          const input=container.querySelector(`[data-synth-chapter-input="${idx}"]`);
          if(input&&window.LocalAIAssistant?.open){
            window.LocalAIAssistant.open(input);
          }
        });
      });
      container.querySelectorAll('[data-synth-chapter-save]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          const idx=btn.dataset.synthChapterSave;
          const clusterKey=btn.dataset.clusterKey;
          const input=container.querySelector(`[data-synth-chapter-input="${idx}"]`);
          const text=String(input?.value||'').trim();
          if(!text){
            window.showAppToast?.('Le texte de la synthèse ne peut être vide.','info',2000);
            return;
          }
          if(clusterKey && window.DataStore?.saveChapterNarrative){
            window.DataStore.saveChapterNarrative(clusterKey,text);
          }
          const pNarr=container.querySelector(`[data-synth-chapter-narrative="${idx}"]`);
          if(pNarr)pNarr.textContent=text;
          const editor=container.querySelector(`[data-synth-chapter-editor="${idx}"]`);
          editor?.classList.add('hidden');
          window.showAppToast?.('✓ Synthèse du chapitre enregistrée.','success',2200);
        });
      });
      container.querySelectorAll('[data-synth-chapter-cancel]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          const idx=btn.dataset.synthChapterCancel;
          container.querySelector(`[data-synth-chapter-editor="${idx}"]`)?.classList.add('hidden');
        });
      });

      // Point 3 : Tout afficher / masquer pour les 5 domaines et IA
      container.querySelector('[data-synth-domains-expand]')?.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        const masterCard=container.querySelector('.synth-domains-section details.synth-section-accordion');
        if(masterCard) masterCard.open = true;
        const cards=[...container.querySelectorAll('details.synth-domain-accordion')];
        const allOpen=cards.every(c=>c.open);
        cards.forEach(c=>{c.open=!allOpen;});
      });
      container.querySelectorAll('[data-synth-domain-toggle]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const idx=btn.dataset.synthDomainToggle;
          const card=container.querySelector(`[data-synth-domain-card="${idx}"]`);
          if(card)card.open=true;
          const editor=container.querySelector(`[data-synth-domain-editor="${idx}"]`);
          editor?.classList.toggle('hidden');
        });
      });
      container.querySelectorAll('[data-synth-domain-ai]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const idx=btn.dataset.synthDomainAi;
          const card=container.querySelector(`[data-synth-domain-card="${idx}"]`);
          if(card)card.open=true;
          const editor=container.querySelector(`[data-synth-domain-editor="${idx}"]`);
          editor?.classList.remove('hidden');
          const targetInput=editor?.querySelector('textarea[data-synth-field="moyens"]')||editor?.querySelector('textarea');
          if(targetInput&&window.LocalAIAssistant?.open){
            window.LocalAIAssistant.open(targetInput);
          }
        });
      });

      // Point 4 : Tout afficher / masquer pour les objectifs & pistes suggérées
      container.querySelector('.synth-prop-counters')?.addEventListener('click',e=>{
        e.stopPropagation();
      });
      container.querySelector('[data-synth-proposals-expand]')?.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        const masterCard=container.querySelector('.synth-validation-section details.synth-section-accordion');
        if(masterCard) masterCard.open = true;
        const propCards=[...container.querySelectorAll('details.synth-prop-card')];
        const allOpen=propCards.every(c=>c.open);
        propCards.forEach(c=>{c.open=!allOpen;});
      });
      container.querySelectorAll('[data-synth-add-aid]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const pIdx=btn.dataset.synthAddAid;
          const aidText=btn.dataset.aidText;
          const textarea=container.querySelector(`[data-synth-prop-text="${pIdx}"]`);
          if(!textarea||!aidText)return;
          let val=textarea.value.trim();
          const bullet=`  - ${aidText}`;
          if(val.includes(aidText)){
            window.showAppToast?.('Cet aménagement est déjà présent dans l’objectif.','info',2000);
            return;
          }
          val=val?`${val}\n${bullet}`:bullet;
          textarea.value=val;
          textarea.dispatchEvent(new Event('input',{bubbles:true}));
          textarea.dispatchEvent(new Event('change',{bubbles:true}));
          btn.classList.add('is-added');
          btn.innerHTML=`<span class="synth-aid-add-icon">✓</span> <span class="synth-aid-add-text">${escapeHtml(aidText)}</span>`;
          if(pia){
            v74?.decideSynthesisProposal?.(pia,Number(pIdx),'SAVE_ONLY',val);
          }
          window.showAppToast?.(`✓ « ${aidText} » ajouté en sous-point à l’objectif.`,'success',2200);
        });
      });
      container.querySelectorAll('[data-synth-prop-ai]').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          const pIdx=btn.dataset.synthPropAi;
          const textarea=container.querySelector(`[data-synth-prop-text="${pIdx}"]`);
          if(textarea&&window.LocalAIAssistant?.open){
            window.LocalAIAssistant.open(textarea);
          }
        });
      });

      if(!pia)return;
      container.querySelectorAll('[data-synth-domain-save]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          const idx=Number(btn.dataset.synthDomainSave);
          const inputs=[...container.querySelectorAll(`[data-synth-domain-input="${idx}"]`)];
          for(const inp of inputs){
            const field=inp.dataset.synthField;
            const lines=String(inp.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
            await v74?.saveSynthesisDomainField?.(pia,idx,field,lines);
          }
          window.showAppToast?.('✓ Domaine PIA mis à jour depuis la synthèse.','success',2400);
          rerenderCallback();
        });
      });
      container.querySelectorAll('[data-synth-prop-save]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          const idx=Number(btn.dataset.synthPropSave);
          const txt=container.querySelector(`[data-synth-prop-text="${idx}"]`)?.value||'';
          if(!String(txt).trim()){window.showAppToast?.('La formulation ne peut pas être vide.','info',2500);return;}
          await v74?.decideSynthesisProposal?.(pia,idx,'SAVE_ONLY',txt);
          window.showAppToast?.('✓ Formulation enregistrée pour le PIA.','success',2200);
          rerenderCallback();
        });
      });
      container.querySelectorAll('[data-synth-prop-accept]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          const idx=Number(btn.dataset.synthPropAccept);
          const txt=container.querySelector(`[data-synth-prop-text="${idx}"]`)?.value;
          await v74?.decideSynthesisProposal?.(pia,idx,'VALIDEE',txt);
          window.showAppToast?.('✓ Objectif validé et pré-rempli dans le PIA annuel.','success',2600);
          rerenderCallback();
        });
      });
      container.querySelectorAll('[data-synth-prop-reject]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          const idx=Number(btn.dataset.synthPropReject);
          await v74?.decideSynthesisProposal?.(pia,idx,'REFUSEE');
          window.showAppToast?.('Proposition écartée du PIA.','info',2200);
          rerenderCallback();
        });
      });
      container.querySelectorAll('[data-synth-prop-reopen]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          const idx=Number(btn.dataset.synthPropReopen);
          await v74?.decideSynthesisProposal?.(pia,idx,'A_EXAMINER');
          window.showAppToast?.('Proposition remise « À examiner ». Vous pouvez modifier son texte.','info',2400);
          rerenderCallback();
        });
      });
      container.querySelector('[data-synth-open-pia]')?.addEventListener('click',()=>{
        v74?.openPIAWorkspaceFromSynthesis?.(pia,'domains');
        setReportsTab('pia');
      });
    }



    /* =========================================================
       PRÉPARATION DE RÉUNION, SYNTHÈSES VISUELLES & EXPORTS
       Intégration finale de journalier-core.js (Lot 3.8)
       ========================================================= */

    function summarizeTags(studentLogs, field) {
        const counts = {};
        studentLogs.forEach(l => {
            const raw = l[field] || '';
            raw.split(',').map(x => x.trim()).filter(Boolean).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    }

    function schoolYearBounds() {
        const s=document.getElementById('r-date-start'),e=document.getElementById('r-date-end');
        const min=s?.getAttribute('min')||'',max=e?.getAttribute('max')||'';
        if(/^\d{4}-\d{2}-\d{2}$/.test(min)&&/^\d{4}-\d{2}-\d{2}$/.test(max)) return {start:min,end:max};
        const now=new Date(),y=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;
        return {start:`${y}-08-24`,end:`${y+1}-07-02`};
    }

    function getReportRange(type) {
        if(type==='ANNEE') return schoolYearBounds();
        if(type==='ADATE'){
            const b=schoolYearBounds(),today=formatISO(new Date());
            return {start:b.start,end:today<b.end?today:b.end};
        }
        if(type==='LIBRE') return {start:document.getElementById('r-date-start')?.value||'',end:document.getElementById('r-date-end')?.value||''};
        const anchor = parseISODate(selectedDateISO);
        let start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        let end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
        if (type === 'HEBDO') {
            start = getMonday(anchor);
            end = new Date(start); end.setDate(start.getDate() + 4);
        } else if (type === 'PV1' || type === 'PV2') {
            // Niveau 3 : on analyse tout le corpus disponible avant la date d'ancrage.
            // Le type de PV modifie la finalité rédactionnelle, pas les données disponibles.
            const dbDates=getDB().map(l=>sessionParts(l).date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d));
            if(dbDates.length){ start = new Date(dbDates.sort()[0]+'T00:00:00'); }
            end = anchor;
        }
        return { start: formatISO(start), end: formatISO(end) };
    }

    function toInfinitivePhrase(rawText){
        const s=String(rawText||'').trim();
        if(!s)return '';
        const rules=[
            [/^Choisit\b/i,'Choisir'],
            [/^Applique\b/i,'Appliquer'],
            [/^Transforme\s+ou\s+simplifie\b/i,'Transformer ou simplifier'],
            [/^Transforme\b/i,'Transformer'],
            [/^Simplifie\b/i,'Simplifier'],
            [/^Identifie\b/i,'Identifier'],
            [/^Repère\b/i,'Repérer'],
            [/^Mobilise\b/i,'Mobiliser'],
            [/^Entre\b/i,'Entrer'],
            [/^Suit\b/i,'Suivre'],
            [/^Met\s+en\s+œuvre\b/i,'Mettre en œuvre'],
            [/^Comprend\b/i,'Comprendre'],
            [/^Maintient\b/i,'Maintenir'],
            [/^Utilise\b/i,'Utiliser'],
            [/^Résout\b/i,'Résoudre'],
            [/^Calcule\b/i,'Calculer'],
            [/^Traduit\b/i,'Traduire'],
            [/^Compare\b/i,'Comparer'],
            [/^Classe\b/i,'Classer'],
            [/^Ordonne\b/i,'Ordonner'],
            [/^Estime\b/i,'Estimer'],
            [/^Vérifie\b/i,'Vérifier'],
            [/^Justifie\b/i,'Justifier'],
            [/^Explique\b/i,'Expliquer'],
            [/^Formule\b/i,'Formuler'],
            [/^Rédige\b/i,'Rédiger'],
            [/^Lit\b/i,'Lire'],
            [/^Écrit\b/i,'Écrire'],
            [/^Extrait\b/i,'Extraire'],
            [/^Sélectionne\b/i,'Sélectionner'],
            [/^Organise\b/i,'Organiser'],
            [/^Planifie\b/i,'Planifier'],
            [/^Structure\b/i,'Structurer'],
            [/^Dégage\b/i,'Dégager'],
            [/^Infère\b/i,'Inférer'],
            [/^Participe\b/i,'Participer'],
            [/^Prépare\b/i,'Préparer'],
            [/^Demande\b/i,'Demander'],
            [/^Accepte\b/i,'Accepter'],
            [/^Gère\b/i,'Gérer'],
            [/^Respecte\b/i,'Respecter'],
            [/^Se\s+repère\b/i,'Se repérer'],
            [/^S['’]engage\b/i,'S’engager'],
            [/^S['’]organise\b/i,'S’organiser'],
            [/^Effectue\b/i,'Effectuer'],
            [/^Trace\b/i,'Tracer'],
            [/^Construis|Construit\b/i,'Construire'],
            [/^Mesure\b/i,'Mesurer'],
            [/^Convertit\b/i,'Convertir'],
            [/^Associe\b/i,'Associer'],
            [/^Relie\b/i,'Relier'],
            [/^Distingue\b/i,'Distinguer'],
            [/^Reconnaît|Reconnait\b/i,'Reconnaître'],
            [/^Détermine\b/i,'Déterminer'],
            [/^Complète\b/i,'Compléter'],
            [/^Reformule\b/i,'Reformuler']
        ];
        for(const [re,rep] of rules){
            if(re.test(s))return s.replace(re,rep);
        }
        return s;
    }

    function insertFluidAdverbInObservation(obsText,adverb){
        const s=String(obsText||'').trim().replace(/\.$/,'');
        const adv=String(adverb||'').trim().toLocaleLowerCase('fr');
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
        if(/^(Travail|Participation)\b/i.test(s)){
            return `${s} (${adv})`;
        }
        const m=/^(\S+)(\s+.*)$/.exec(s);
        if(m)return `${m[1]} ${adv}${m[2]}`;
        return `${s} ${adv}`;
    }

    function formatChapterName(rawObj){
        const s=String(rawObj||'').trim();
        if(!s)return '';
        return s.replace(/^(?:interro(?:gation)?|évaluation|eval|contrôle|exercice(?:s)?|leçon|séance|atelier|travail)\s*[-—:·]\s*/i,'').trim()||s;
    }

    function groupDatesBySubjectAndChapter(occurrencesList){
        const byChap=new Map();
        (occurrencesList||[]).forEach(occ=>{
            const subj=String(occ.matiere||'Matière non renseignée').trim();
            const chap=String(occ.chapter||occ.objectif||'Séance observée').trim();
            const label=[subj,chap&&chap!=='Thématique travaillée'?chap:''].filter(Boolean).join(' — ');
            const key=reportNorm(label);
            if(!byChap.has(key))byChap.set(key,{label,dates:[],notes:[]});
            const g=byChap.get(key);
            const d=occ.dateStr||reportHumanDate(occ.date);
            if(d&&!g.dates.includes(d))g.dates.push(d);
            if(occ.note){
                const noteEntry=d?`${d} (${occ.note})`:occ.note;
                if(!g.notes.includes(noteEntry))g.notes.push(noteEntry);
            }
        });
        return [...byChap.values()].map(g=>{
            if(g.notes.length)return `${g.label} : ${g.notes.join(', ')}`;
            return g.dates.length?`${g.label} : ${g.dates.join(', ')}`:g.label;
        });
    }

    function renderMeetingPrep(evidence,relations,allPeriodLogs=[]){
        const host=document.getElementById('meeting-prep-output');if(!host)return;
        const obsMap=new Map();
        evidence.forEach(item=>{
            const chap=resolveSynthesisCanonicalChapter(item.log||{contexte:{matiere:item.matiere},objectif:{objectifLecon:item.objectif},q3:{repereWBE:item.wbeRepere}});
            const dStr=item.date?reportHumanDate(item.date):'';
            (item.observations||[]).forEach(obs=>{
                const rawText=String(obs.text||'').trim();
                if(!rawText)return;
                const sKey=semanticSkillDedupeKey(rawText);
                if(!obsMap.has(sKey))obsMap.set(sKey,{text:rawText,count:0,levels:[],levelNums:[],rawOccurrences:[],noteOccurrences:[],precisions:[]});
                const entry=obsMap.get(sKey);
                entry.text=pickPreferredSkillLabel(entry.text,rawText);
                entry.count+=1;
                const lvl=historyQ2LevelLabel(obs.level);
                const num=obs.level!==null&&obs.level!==undefined&&obs.level!==''?Number(obs.level):null;
                if(Number.isFinite(num))entry.levelNums.push(num);
                if(lvl)entry.levels.push(lvl.toLocaleLowerCase('fr'));
                entry.rawOccurrences.push({dateStr:dStr,matiere:item.matiere,chapter:chap});
                entry.noteOccurrences.push({dateStr:dStr,matiere:item.matiere,chapter:chap,note:lvl?lvl.toLocaleLowerCase('fr'):''});
            });
        });

        // Analyse globale des séances avec seuil de représentativité à 6 séances pour qualifier une tendance
        const degreeOfEntry=entry=>{
            const u=reportUnique(entry.levels);
            if(!u.length)return {key:'documented',label:'Observé en séance',tone:'neutral',isSingleTone:true};
            if(u.length===1){
                const v=u[0];
                if(v.includes('total'))return {key:'total',label:'Stable : point d’appui acquis',tone:'positive',isSingleTone:true};
                if(v.includes('suffis'))return {key:'sufficient',label:'Stable : fonctionnel en situation courante',tone:'functional',isSingleTone:true};
                return {key:'partial',label:'Stable : fragilité nécessitant un appui',tone:'fragile',isSingleTone:true};
            }
            const nums=entry.levelNums||[];
            if(nums.length>=6){
                const mid=Math.floor(nums.length/2);
                const firstAvg=nums.slice(0,mid).reduce((a,b)=>a+b,0)/mid;
                const secondAvg=nums.slice(mid).reduce((a,b)=>a+b,0)/(nums.length-mid);
                if(secondAvg-firstAvg>=0.45){
                    return {key:'trend_up',label:`Tendance sur ${nums.length} séances : en progression`,tone:'positive',isSingleTone:false};
                }
                if(firstAvg-secondAvg>=0.45){
                    return {key:'trend_down',label:`Tendance sur ${nums.length} séances : en fragilisation`,tone:'fragile',isSingleTone:false};
                }
                return {key:'trend_var',label:`Tendance sur ${nums.length} séances : variable selon la tâche`,tone:'variable',isSingleTone:false};
            }
            return {key:'variable',label:'Variable selon la tâche et le contexte',tone:'variable',isSingleTone:false};
        };

        const renderExpandableItem=(title,badge,detailsList)=>{
            const uniqueDetails=reportUnique(detailsList);
            if(!uniqueDetails.length){
                return `<div class="meeting-prep-item is-static"><div class="meeting-prep-item-summary"><strong>${escapeHtml(title)}</strong>${badge?`<span class="meeting-prep-badge">${escapeHtml(badge)}</span>`:''}</div></div>`;
            }
            return `<details class="meeting-prep-item">
                <summary class="meeting-prep-item-summary">
                    <strong>${escapeHtml(title)}</strong>
                    <span class="meeting-prep-item-right">
                        ${badge?`<span class="meeting-prep-badge">${escapeHtml(badge)}</span>`:''}
                        <span class="meeting-prep-more">Plus de détails</span>
                    </span>
                </summary>
                <div class="meeting-prep-item-details" data-export-detail="true">
                    <ul>${uniqueDetails.map(d=>`<li>${escapeHtml(d)}</li>`).join('')}</ul>
                </div>
            </details>`;
        };

        const renderDegreeGroups=entries=>{
            const groups=new Map();
            entries.forEach(entry=>{
                const deg=degreeOfEntry(entry);
                if(!groups.has(deg.key))groups.set(deg.key,{...deg,items:[]});
                groups.get(deg.key).items.push(entry);
            });
            const order=['partial','trend_down','variable','trend_var','sufficient','trend_up','total','documented'];
            const sorted=[...groups.values()].sort((a,b)=>{
                const ia=order.findIndex(k=>a.key.startsWith(k)),ib=order.findIndex(k=>b.key.startsWith(k));
                return (ia<0?99:ia)-(ib<0?99:ib);
            });
            return sorted.map(g=>{
                return `<div class="meeting-prep-degree-group is-${g.tone}">
                    <div class="meeting-prep-degree-head">
                        <span class="meeting-prep-degree-pill is-${g.tone}">${escapeHtml(g.label)}</span>
                        <span class="meeting-prep-degree-count">${g.items.length} élément${g.items.length>1?'s':''}</span>
                    </div>
                    <div class="meeting-prep-items-stack">
                        ${g.items.map(item=>renderExpandableItem(
                            item.text,
                            `${item.count} séance${item.count>1?'s':''}`,
                            groupDatesBySubjectAndChapter(g.isSingleTone?item.rawOccurrences:item.noteOccurrences)
                        )).join('')}
                    </div>
                </div>`;
            }).join('');
        };

        const recurringEntries=[...obsMap.values()].filter(x=>x.count>1);
        const singleObsEntries=[...obsMap.values()].filter(x=>x.count===1);

        const q3TreeGroups=new Map();
        evidence.forEach(item=>{
            const subj=String(item.matiere||'Matière non renseignée').trim()||'Matière non renseignée';
            const chap=resolveSynthesisCanonicalChapter(item.log||{contexte:{matiere:item.matiere},objectif:{objectifLecon:item.objectif},q3:{repereWBE:item.wbeRepere}})||'Séance observée';
            const dStr=item.date?reportHumanDate(item.date):'';
            (item.indicators||[]).forEach(ind=>{
                const rawText=toInfinitivePhrase(String(ind.text||'').trim()).replace(/\.$/,'');
                if(!rawText)return;
                const appLabel=ind.appreciation!==null&&ind.appreciation!==undefined?reportIndicatorLabel(ind.appreciation).toLocaleLowerCase('fr'):'non renseigné';
                let groupLabel='Compétence travaillée en séance';
                let tone='functional';
                if(appLabel.includes('mobilis') || appLabel.includes('maîtris') || appLabel.includes('maitris')){
                    groupLabel='Compétence bien maîtrisée en séance';
                    tone='positive';
                }else if(appLabel.includes('appropriation')){
                    groupLabel='Compétence en cours d’appropriation — pas encore totalement maîtrisée';
                    tone='functional';
                }else if(appLabel.includes('renforcer')){
                    groupLabel='Compétence restant à renforcer';
                    tone='fragile';
                }
                if(!q3TreeGroups.has(groupLabel)){
                    q3TreeGroups.set(groupLabel,{label:groupLabel,tone,subjects:new Map(),skillCount:0});
                }
                const g=q3TreeGroups.get(groupLabel);
                if(!g.subjects.has(subj))g.subjects.set(subj,new Map());
                const chapMap=g.subjects.get(subj);
                if(!chapMap.has(chap))chapMap.set(chap,{chapter:chap,dates:[],skills:new Map()});
                const cEntry=chapMap.get(chap);
                if(dStr&&!cEntry.dates.includes(dStr))cEntry.dates.push(dStr);
                const sKey=semanticSkillDedupeKey(rawText);
                if(!cEntry.skills.has(sKey)){
                    cEntry.skills.set(sKey,rawText);
                    g.skillCount+=1;
                }else{
                    cEntry.skills.set(sKey,pickPreferredSkillLabel(cEntry.skills.get(sKey),rawText));
                }
            });
        });

        const recurringThemes=reportUnique((relations.recurrences||[]).map(item=>reportTheme(item.theme).label));
        const recurringHtml=[
            recurringThemes.length?`<div class="meeting-prep-theme-banner"><strong>Axes récurrents dégagés :</strong> ${recurringThemes.map(t=>`<span class="meeting-prep-theme-chip">${escapeHtml(t)}</span>`).join('')}</div>`:'',
            recurringEntries.length?renderDegreeGroups(recurringEntries):''
        ].filter(Boolean).join('');

        const q2Q3Notes=reportUnique(evidence.flatMap(item=>{
            const chap=resolveSynthesisCanonicalChapter(item.log||{contexte:{matiere:item.matiere},objectif:{objectifLecon:item.objectif},q3:{repereWBE:item.wbeRepere}});
            const ctx=[item.date?reportHumanDate(item.date):'',item.matiere,chap&&chap!=='Thématique travaillée'?chap:formatChapterName(item.objectif)].filter(Boolean).join(' · ');
            return (item.precisions||[]).filter(p=>p.source==='q2'||p.source==='q3').map(p=>ctx?`${p.text} — ${ctx}`:p.text);
        }));

        const variableHtml=[
            singleObsEntries.length?renderDegreeGroups(singleObsEntries):'',
            [...q3TreeGroups.values()].map(g=>`<div class="meeting-prep-degree-group is-${g.tone}">
                <div class="meeting-prep-degree-head">
                    <span class="meeting-prep-degree-pill is-${g.tone}">${escapeHtml(g.label)}</span>
                    <span class="meeting-prep-degree-count">${g.skillCount} compétence${g.skillCount>1?'s':''}</span>
                </div>
                <div class="meeting-prep-items-stack">
                    ${[...g.subjects.entries()].map(([subj,chapMap])=>`<div class="synth-clean-group synth-tree-group" style="padding:10px 14px;background:#fff;border:1px solid var(--border);border-radius:10px;">
                        <strong>${escapeHtml(subj)} :</strong>
                        <ul class="synth-tree-chapters">
                            ${[...chapMap.values()].map(ch=>`<li>
                                <span class="synth-tree-chapter-title">${escapeHtml(ch.chapter)}${ch.dates.length?` (${escapeHtml(ch.dates.join(', '))})`:''}</span>
                                <ul class="synth-tree-skills">
                                    ${[...ch.skills.values()].map(sk=>`<li>${escapeHtml(sk)}</li>`).join('')}
                                </ul>
                            </li>`).join('')}
                        </ul>
                    </div>`).join('')}
                </div>
            </div>`).join(''),
            q2Q3Notes.length?`<details class="meeting-prep-item meeting-prep-qualitative-item" data-qualitative-constats open>
                <summary class="meeting-prep-item-summary">
                    <strong>Constats qualitatifs de terrain (fonctionnement &amp; apprentissages)</strong>
                    <span class="meeting-prep-item-right">
                        <span class="meeting-prep-badge">${q2Q3Notes.length} note${q2Q3Notes.length>1?'s':''}</span>
                        <span class="meeting-prep-more">Plus de détails</span>
                    </span>
                </summary>
                <div class="meeting-prep-item-details" data-export-detail="true">
                    <ul data-qualitative-original>${q2Q3Notes.map(d=>`<li>${escapeHtml(d)}</li>`).join('')}</ul>
                    <div class="qualitative-ai-actions" data-export-ignore="true" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                        <button type="button" class="btn-secondary" data-qualitative-ai-open>✎ Ajuster le texte</button>
                    </div>
                    <div class="qualitative-ai-editor hidden" data-qualitative-ai-editor data-export-ignore="true" style="margin-top:10px;">
                        <label style="display:block;font-weight:600;margin-bottom:5px;" for="qualitative-ai-input">Texte à ajuster ou synthétiser</label>
                        <textarea id="qualitative-ai-input" data-qualitative-ai-input rows="5" style="width:100%;box-sizing:border-box;">${escapeHtml(q2Q3Notes.join('\n'))}</textarea>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                            <button type="button" class="btn-secondary" data-qualitative-ai-run>✎ Ajuster le texte</button>
                            <button type="button" class="btn-primary" data-qualitative-ai-apply>✓ Utiliser la proposition dans ce rapport</button>
                            <button type="button" class="btn-secondary" data-qualitative-ai-cancel>Annuler</button>
                        </div>
                        <p style="font-size:.8rem;color:var(--text-muted,#64748b);margin-top:6px;">Le texte source des observations reste inchangé. La proposition n'est affichée dans ce rapport qu'après validation.</p>
                    </div>
                    <div data-qualitative-ai-result hidden></div>
                </div>
            </details>`:''
        ].filter(Boolean).join('');

        const adaptMap=new Map();
        const adaptNotes=[];
        evidence.forEach(item=>{
            const chap=resolveSynthesisCanonicalChapter(item.log||{contexte:{matiere:item.matiere},objectif:{objectifLecon:item.objectif},q3:{repereWBE:item.wbeRepere}});
            const dStr=item.date?reportHumanDate(item.date):'';
            const ctx=[dStr,item.matiere,chap&&chap!=='Thématique travaillée'?chap:item.objectif].filter(Boolean).join(' · ');
            (item.adaptations||[]).forEach(type=>{
                const eff=item.effects?.[type];
                const effLabel=eff!==undefined&&!Number.isNaN(Number(eff))?historyQ4EffectLabel(eff).toLocaleLowerCase('fr'):'effet non précisé';
                if(!adaptMap.has(type))adaptMap.set(type,{text:type,count:0,effects:[],rawOccurrences:[],noteOccurrences:[]});
                const entry=adaptMap.get(type);
                entry.count+=1;
                entry.effects.push(effLabel);
                entry.rawOccurrences.push({dateStr:dStr,matiere:item.matiere,chapter:chap});
                entry.noteOccurrences.push({dateStr:dStr,matiere:item.matiere,chapter:chap,note:effLabel});
            });
            if(item.adaptationPrecision)adaptNotes.push(ctx?`${item.adaptationPrecision} — ${ctx}`:item.adaptationPrecision);
        });
        const adaptByEffect=new Map();
        [...adaptMap.values()].forEach(entry=>{
            const u=reportUnique(entry.effects);
            let label;
            const isSingleEff=u.length===1;
            if(isSingleEff){
                if(u[0].includes('positif'))label='Aide concrètement l’élève en séance';
                else if(u[0].includes('partiel'))label='Aide partiellement l’élève en séance';
                else if(u[0].includes('aucun'))label='N’a pas encore produit l’effet attendu';
                else label=`Effet constaté : ${u[0]}`;
            }else{
                label='Effet variable selon la séance';
            }
            const tone=u.some(x=>x.includes('positif')||x.includes('déterminant'))?'positive':(u.some(x=>x.includes('partiel'))?'functional':'neutral');
            if(!adaptByEffect.has(label))adaptByEffect.set(label,{label,tone,isSingleEff,items:[]});
            adaptByEffect.get(label).items.push(entry);
        });
        const adaptationsHtml=[
            ...[...adaptByEffect.values()].map(g=>`<div class="meeting-prep-degree-group is-${g.tone}">
                <div class="meeting-prep-degree-head">
                    <span class="meeting-prep-degree-pill is-${g.tone}">${escapeHtml(g.label)}</span>
                    <span class="meeting-prep-degree-count">${g.items.length} adaptation${g.items.length>1?'s':''}</span>
                </div>
                <div class="meeting-prep-items-stack">
                    ${g.items.map(item=>renderExpandableItem(
                        item.text,
                        `${item.count} séance${item.count>1?'s':''}`,
                        groupDatesBySubjectAndChapter(g.isSingleEff?item.rawOccurrences:item.noteOccurrences)
                    )).join('')}
                </div>
            </div>`),
            reportUnique(adaptNotes).length?renderExpandableItem('Observations complémentaires sur les aides',`${reportUnique(adaptNotes).length} note${reportUnique(adaptNotes).length>1?'s':''}`,reportUnique(adaptNotes)):''
        ].filter(Boolean).join('');

        const followActions=reportUnique(evidence.flatMap(item=>item.actions||[]));
        const followModalities=reportUnique(evidence.map(item=>item.modality).filter(Boolean));
        const followObjectives=reportUnique(evidence.map(item=>item.actionObjective).filter(Boolean));
        const followCollabs=reportUnique(evidence.flatMap(item=>item.collaborations||[]));
        const followNotes=reportUnique(evidence.map(item=>item.actionPrecision).filter(Boolean));
        const discussion=reportUnique([
            ...evidence.map(item=>item.actionObjective?`Objectif de suite : ${item.actionObjective}`:''),
            adaptMap.size?'Faire le point avec l’enseignant sur les aides qui débloquent l’élève en séance et leurs limites lors des évaluations.':''
        ].filter(Boolean));

        const attStats=typeof computeAttendanceStats==='function'?computeAttendanceStats(allPeriodLogs):{total:0,present:0,coteach:0,absentEleve:0,absentProf:0,attendanceRate:null};
        const coteachEntries=(allPeriodLogs||[]).filter(l=>(typeof getSessionPresenceStatus==='function'?getSessionPresenceStatus(l):'present')==='absent_eleve_coteach').map(l=>{
            const sp=sessionParts(l);
            const cn=(typeof getSessionClassNotes==='function'?getSessionClassNotes(l):'')||l.objectif?.objectifLecon||'Co-enseignement assuré';
            return `${reportHumanDate(sp.date)} (${sp.matiere||'Cours'}) : ${cn}`;
        });
        const attendanceSummaryLine=attStats.total>0?`${attStats.present} séance${attStats.present>1?'s':''} avec élève présent${attStats.attendanceRate!==null?` (taux de présence : ${attStats.attendanceRate}%)`:''}${attStats.coteach?` · ${attStats.coteach} maintien${attStats.coteach>1?'s':''} en co-enseignement/notes`:''}${attStats.absentEleve?` · ${attStats.absentEleve} absence${attStats.absentEleve>1?'s':''} élève sans séance`:''}${attStats.absentProf?` · ${attStats.absentProf} cours annulé${attStats.absentProf>1?'s':''} (prof. absent)`:''}`:'';

        const followUpAndDecisions=[
            attendanceSummaryLine?`<div class="meeting-prep-kv-row"><span>Bilan de présence</span><strong>${escapeHtml(attendanceSummaryLine)}</strong></div>`:'',
            coteachEntries.length?renderExpandableItem('Continuité pédagogique en l’absence de l’élève (co-enseignement & notes transmises)',`${coteachEntries.length} créneau${coteachEntries.length>1?'x':''}`,coteachEntries):'',
            followActions.length?`<div class="meeting-prep-kv-row"><span>Actions poursuivies</span><strong>${escapeHtml(followActions.join(' · '))}</strong></div>`:'',
            followModalities.length?`<div class="meeting-prep-kv-row"><span>Modalité(s)</span><strong>${escapeHtml(followModalities.map(m=>`Modalité : ${m}`).join(' · '))}</strong></div>`:'',
            followObjectives.length?`<div class="meeting-prep-kv-row"><span>Objectif(s) de suite</span><strong>${escapeHtml(followObjectives.map(o=>`Objectif : ${o}`).join(' · '))}</strong></div>`:'',
            followCollabs.length?`<div class="meeting-prep-kv-row"><span>Concertation prévue</span><strong>${escapeHtml(followCollabs.map(c=>`Collaboration : ${c}`).join(' · '))}</strong></div>`:'',
            followNotes.length?renderExpandableItem('Précisions sur les suites',`${followNotes.length} note${followNotes.length>1?'s':''}`,followNotes):'',
            discussion.length?`<div class="meeting-prep-items-stack">${discussion.map(d=>`<div class="meeting-prep-item is-static"><div class="meeting-prep-item-summary"><strong>${escapeHtml(d)}</strong></div></div>`).join('')}</div>`:''
        ].filter(Boolean).join('');

        const sectionCard=(title,subtitle,tone,badgeCount,bodyHtml,defaultOpen=true)=>
            `<details class="report-section meeting-prep-card meeting-prep-accordion tone-${tone}" ${defaultOpen?'open':''}>
                <summary class="meeting-prep-card-head meeting-prep-accordion-summary">
                    <div class="meeting-prep-summary-left">
                        <h4>${title}</h4>
                        <p class="meeting-prep-card-sub">${subtitle}</p>
                    </div>
                    <div class="meeting-prep-summary-right">
                        ${badgeCount?`<span class="v11-mini-tag">${escapeHtml(badgeCount)}</span>`:''}
                        <span class="meeting-prep-chevron" aria-hidden="true">⌄</span>
                    </div>
                </summary>
                <div class="meeting-prep-accordion-body">
                    ${bodyHtml||'<p class="meeting-prep-empty">Aucun élément renseigné dans les séances de cette période.</p>'}
                </div>
            </details>`;

        const totalSkills=[...q3TreeGroups.values()].reduce((acc,g)=>acc+g.skillCount,0);
        host.innerHTML=`<div class="meeting-prep-toolbar" data-export-ignore="true" style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;">
            <button type="button" class="btn-secondary" data-meeting-expand-all="true" style="padding:5px 10px;font-size:.74rem;">Tout déplier</button>
            <button type="button" class="btn-secondary" data-meeting-collapse-all="true" style="padding:5px 10px;font-size:.74rem;">Tout replier</button>
        </div>
        <div class="natural-report meeting-prep-grid">
            ${sectionCard('1. Fonctionnement & tendances sur la période',`Synthèse globale des observations récurrentes — ${evidence.length} séance${evidence.length>1?'s':''} analysée${evidence.length>1?'s':''}`,'blue',`${recurringEntries.length} axe${recurringEntries.length>1?'s':''}`,recurringHtml,true)}
            ${sectionCard('2. Apprentissages ciblés & constats de terrain','Compétences travaillées par chapitre et observations ponctuelles','purple',`${totalSkills} compétence${totalSkills>1?'s':''}`,variableHtml,true)}
            ${sectionCard('3. Efficacité réelle des aides testées','Aides regroupées selon leur apport concret pour l’élève','amber',`${adaptMap.size} aide${adaptMap.size>1?'s':''}`,adaptationsHtml,true)}
            ${sectionCard('4. Ordre du jour, suites & concertation','Actions poursuivies, modalités et points à convenir avec l’équipe','indigo',`${followActions.length+followObjectives.length} piste${(followActions.length+followObjectives.length)>1?'s':''}`,followUpAndDecisions,true)}
        </div>`;
        host.querySelector?.('[data-meeting-expand-all]')?.addEventListener('click',()=>{
            host.querySelectorAll?.('details.meeting-prep-accordion, details.meeting-prep-item').forEach(d=>{d.open=true;});
        });
        host.querySelector?.('[data-meeting-collapse-all]')?.addEventListener('click',()=>{
            host.querySelectorAll?.('details.meeting-prep-accordion').forEach(d=>{d.open=false;});
        });
    }

    function reportElementText(element){
        if(!element)return '';
        const clone=element.cloneNode(true),lines=[],blockTags=new Set(['DIV','SECTION','ARTICLE','P','H1','H2','H3','H4','UL','OL','LI','DETAILS','SUMMARY','HEADER']);
        clone.querySelectorAll('[hidden],[data-export-detail="true"],[data-export-ignore="true"],.meeting-prep-more').forEach(node=>node.remove());
        clone.querySelectorAll('li').forEach(li=>{
            const txt=String(li.textContent||'').trim();
            if(txt&&!/^[•●▪-]/.test(txt)){
                li.insertBefore(document.createTextNode('• '),li.firstChild);
            }
        });
        const visit=node=>{
            if(node.nodeType===Node.TEXT_NODE){
                const value=String(node.nodeValue||'').replace(/\s+/g,' ').trim();
                if(value){if(lines.length&&lines.at(-1)!=='')lines[lines.length-1]+=' ';if(!lines.length)lines.push('');lines[lines.length-1]+=value;}
                return;
            }
            if(node.nodeType!==Node.ELEMENT_NODE)return;
            if(node.tagName==='TEXTAREA'||node.tagName==='INPUT'){
                if(node.type==='checkbox'||node.type==='radio')return;
                const val=String(node.value||node.textContent||'').trim();
                if(val){
                    val.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(ln=>{
                        if(lines.length&&lines.at(-1)!=='')lines.push('');
                        lines.push(ln);
                    });
                    lines.push('');
                }
                return;
            }
            if(node.tagName==='BR'){if(!lines.length||lines.at(-1)!=='')lines.push('');return;}
            const isBlock=blockTags.has(node.tagName);
            if(isBlock&&lines.length&&lines.at(-1)!=='')lines.push('');
            node.childNodes.forEach(visit);
            if(isBlock&&lines.length&&lines.at(-1)!=='')lines.push('');
        };
        visit(clone);
        return lines.map(line=>line.trim()).filter((line,index,array)=>line||array[index-1]).join('\n').trim();
    }

    function setReportsTab(name){
        const tabs=[...document.querySelectorAll('#reports-navigation [role="tab"]')];
        const panels=[...document.querySelectorAll('#view-reports [data-reports-panel]')];
        const active=tabs.find(tab=>tab.dataset.reportsTab===name);
        if(!active)return;
        tabs.forEach(tab=>{
            const selected=tab===active;
            tab.setAttribute('aria-selected',String(selected));
            tab.tabIndex=selected?0:-1;
        });
        panels.forEach(panel=>{panel.hidden=panel.dataset.reportsPanel!==name;});
        document.getElementById('reports-exports')?.removeAttribute('open');
    }

    let currentReportFullMode=false;

    function setReportView(full){
        currentReportFullMode=Boolean(full);
        const reportBox=document.getElementById('report-text');
        const outputBox=document.getElementById('report-output-box');
        if(outputBox&&outputBox.classList.contains('hidden')&&document.getElementById('r-eleve')?.value){
            generateReport();
        }
        const sections=[...document.querySelectorAll('#report-text .natural-report .report-section')];
        sections.forEach((section,index)=>{section.hidden=!full&&index>=(sections.length>10?4:6);});
        if(reportBox){
            reportBox.classList.toggle('is-full-synthesis',Boolean(full));
            reportBox.classList.toggle('is-preview-synthesis',!full);
            reportBox.querySelectorAll('[data-synth-drawer-panel]').forEach(panel=>{
                panel.classList.toggle('hidden',!full);
            });
            reportBox.querySelectorAll('[data-synth-drawer-toggle]').forEach(btn=>{
                const target=btn.getAttribute('data-synth-drawer-toggle');
                const isFirst=target==='strengths';
                const active=full?true:isFirst;
                btn.classList.toggle('is-active',active);
                btn.setAttribute('aria-expanded',String(full));
            });
            reportBox.querySelectorAll('.synth-prop-evidence, details.v74-domain-fieldset, details.synth-accordion-block').forEach(det=>{
                det.open=Boolean(full);
            });
        }
        const prevBtn=document.getElementById('r-preview-btn');
        const fullBtn=document.getElementById('r-full-btn');
        if(prevBtn){
            prevBtn.classList.toggle('is-active',!full);
            prevBtn.setAttribute('aria-pressed',String(!full));
        }
        if(fullBtn){
            fullBtn.classList.toggle('is-active',Boolean(full));
            fullBtn.setAttribute('aria-pressed',String(Boolean(full)));
        }
    }

    async function resetOrReopenSynthesis(){
        const studentName=document.getElementById('r-eleve')?.value||'';
        const student=getStudents().find(s=>String(s.nom||'')===String(studentName));
        if(!student){
            window.showAppToast?.('Sélectionnez d’abord un élève.','info',2400);
            return;
        }
        const v74=window.JournalierV74;
        await v74?.resetSynthesisDecisions?.(student.studentId);
        const reportBox=document.getElementById('report-text');
        const outputBox=document.getElementById('report-output-box');
        if(outputBox&&!outputBox.classList.contains('hidden')){
            generateReport();
            window.showAppToast?.('✓ Synthèse et propositions PIA remises « À examiner » (modifiables).','success',3200);
        }else{
            if(reportBox)reportBox.innerHTML='';
            outputBox?.classList.add('hidden');
            window.showAppToast?.('✓ Décisions PIA réinitialisées pour cet élève.','success',2600);
        }
    }

    function resetMeetingPrepView(){
        const host=document.getElementById('meeting-prep-output')||document.getElementById('meeting-prep-box');
        if(host){
            host.innerHTML='<p class="reports-empty-state">Préparation réinitialisée. Cliquez sur <strong>Générer la préparation</strong> pour recalculer la trame à partir des séances.</p>';
        }
        window.showAppToast?.('✓ Préparation de réunion réinitialisée.','info',2400);
    }

    function bindReportsUX(){
        const period=document.getElementById('r-periode'),custom=document.getElementById('r-custom-range');
        const anchor=document.getElementById('r-anchor-range');
        const exportKind=document.getElementById('reports-export-kind'),exportFormatField=document.getElementById('reports-export-format-field');
        const exportMenu=document.getElementById('reports-exports'),workspaceHeader=exportMenu?.closest('.reports-workspace-header');
        const syncExportLayer=()=>workspaceHeader?.classList.toggle('is-export-open',!!exportMenu?.open);
        exportMenu?.addEventListener('toggle',syncExportLayer);
        document.addEventListener('pointerdown',event=>{
            if(!exportMenu?.open||exportMenu.contains(event.target))return;
            exportMenu.removeAttribute('open');
            syncExportLayer();
        });
        document.addEventListener('keydown',event=>{
            if(event.key!=='Escape'||!exportMenu?.open)return;
            exportMenu.removeAttribute('open');
            syncExportLayer();
            exportMenu.querySelector('summary')?.focus();
        });
        const nav=document.getElementById('reports-navigation');
        if(nav&&!nav.dataset.bound){
            nav.dataset.bound='true';
            nav.addEventListener('click',event=>{
                const tab=event.target.closest('[data-reports-tab]');
                if(tab)setReportsTab(tab.dataset.reportsTab);
            });
            nav.addEventListener('keydown',event=>{
                const tabs=[...nav.querySelectorAll('[role="tab"]')];
                const current=tabs.indexOf(document.activeElement);
                if(current<0)return;
                let next;
                if(event.key==='ArrowRight')next=(current+1)%tabs.length;
                else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
                else if(event.key==='Home')next=0;
                else if(event.key==='End')next=tabs.length-1;
                else return;
                event.preventDefault();
                tabs[next].focus();
                setReportsTab(tabs[next].dataset.reportsTab);
            });
        }
        document.getElementById('meeting-open-pia')?.addEventListener('click',()=>{
            setReportsTab('pia');
            window.JournalierV74?.requestPIASection?.('meetings');
        });
        const updateRangeControls=()=>{
            const kind=period?.value||'';
            const customRange=kind==='LIBRE',wholeYear=kind==='ANNEE'||kind==='ADATE';
            custom?.classList.toggle('hidden',!customRange);
            anchor?.classList.toggle('hidden',customRange||wholeYear);
        };
        const refreshHistoryForPeriod=()=>{if(typeof loadStudentHistory==='function')loadStudentHistory();};
        period?.addEventListener('change',()=>{updateRangeControls();refreshHistoryForPeriod();});
        ['r-date-start','r-date-end','r-date-anchor'].forEach(id=>document.getElementById(id)?.addEventListener('change',refreshHistoryForPeriod));
        updateRangeControls();
        const updateExportControls=()=>{if(exportFormatField)exportFormatField.hidden=String(exportKind?.value||'').includes('json');};
        exportKind?.addEventListener('change',updateExportControls);
        updateExportControls();
        setReportsTab('history');
        document.getElementById('r-preview-btn')?.addEventListener('click',()=>setReportView(false));
        document.getElementById('r-full-btn')?.addEventListener('click',()=>setReportView(true));
        document.getElementById('r-reset-synthesis-btn')?.addEventListener('click',resetOrReopenSynthesis);
        document.getElementById('r-reset-meetings-btn')?.addEventListener('click',resetMeetingPrepView);
        document.getElementById('r-generate-meetings-btn')?.addEventListener('click',()=>generateReport());
        const exportJournalier=()=>{
            const student=document.getElementById('r-eleve')?.value||'';
            if(!student){alert('Sélectionnez un élève.');return;}
            const range=getReportRange(document.getElementById('r-periode')?.value||'ANNEE');
            const logs=getDB().filter(log=>isJournalSession(log)&&sessionParts(log).eleve===student&&(!range.start||sessionParts(log).date>=range.start)&&(!range.end||sessionParts(log).date<=range.end)).sort((a,b)=>sessionSortKey(a).localeCompare(sessionSortKey(b)));
            if(!logs.length){alert('Aucune séance à exporter pour cet élève et cette période.');return;}
            const studentObj=getStudents().find(s=>String(s.nom||'')===String(student))||{nom:student};
            const anon=!!document.getElementById('journalier-export-anon')?.checked;
            window.JournalierSeancesDocx.exporter({seances:logs,eleve:studentObj,deidentifie:anon})
                .catch(error=>alert(`Export impossible : ${error?.message||error}`));
        };
        document.getElementById('journalier-export-btn')?.addEventListener('click',exportJournalier);
        const historyContainer=document.getElementById('student-history-list');
        const refreshHistoryFilters=()=>{if(historyContainer)historyContainer.dataset.visibleLimit='15';loadStudentHistory();};
        document.getElementById('history-search')?.addEventListener('input',refreshHistoryFilters);
        document.getElementById('history-subject-filter')?.addEventListener('change',refreshHistoryFilters);
        document.getElementById('history-presence-filter')?.addEventListener('change',refreshHistoryFilters);
        historyContainer?.addEventListener('click',event=>{
            const editButton=event.target.closest('[data-action="history-edit"]');
            if(editButton){
                event.stopPropagation();
                const sessionId=editButton.dataset.sessionId||'';
                if(sessionId)editHistorySession(sessionId);
                return;
            }
            const deleteButton=event.target.closest('[data-action="history-delete"]');
            if(deleteButton){
                event.stopPropagation();
                const sessionId=deleteButton.dataset.sessionId||'';
                if(sessionId)deleteHistorySession(sessionId);
                return;
            }
            const row=event.target.closest('[data-history-select]');
            if(row){
                historyContainer.dataset.selectedSession=row.dataset.historySelect||'';
                if(window.matchMedia('(max-width: 720px)').matches)document.getElementById('history-workspace')?.classList.add('is-detail-open');
                loadStudentHistory();
                return;
            }
            if(event.target.closest('[data-history-load-more]')){
                historyContainer.dataset.visibleLimit=String((Number(historyContainer.dataset.visibleLimit)||15)+15);
                loadStudentHistory();
            }
        });
        document.getElementById('student-history-detail')?.addEventListener('click',event=>{
            const editButton=event.target.closest('[data-action="history-edit"]');
            if(editButton){
                const sessionId=editButton.dataset.sessionId||'';
                if(sessionId)editHistorySession(sessionId);
                return;
            }
            const deleteButton=event.target.closest('[data-action="history-delete"]');
            if(deleteButton){
                const sessionId=deleteButton.dataset.sessionId||'';
                if(sessionId)deleteHistorySession(sessionId);
                return;
            }
            if(!event.target.closest('[data-history-back]'))return;
            document.getElementById('history-workspace')?.classList.remove('is-detail-open');
            historyContainer?.querySelector('[data-history-select][aria-current="true"]')?.focus();
        });
        document.getElementById('reports-export-btn')?.addEventListener('click',()=>{
            const kind=document.getElementById('reports-export-kind')?.value,format=document.getElementById('reports-export-format')?.value||'docx',student=document.getElementById('r-eleve')?.value||'';
            let filename,content;
            const piaExports={'pia-professional':'v74-export-prof','pia-deidentified':'v74-export-deid','pia-json':'v74-json','pia-deidentified-json':'v74-deid-json'};
            if(piaExports[kind]){
                const button=document.getElementById(piaExports[kind]);
                if(!button){alert('Générez le PIA annuel avant de demander son export.');return;}
                const piaFormat=document.getElementById('v74-export-format');
                if(piaFormat)piaFormat.value=format;
                button.click();
                document.getElementById('reports-exports')?.removeAttribute('open');
                return;
            }
            if(kind==='synthesis'){
                const report=document.getElementById('report-text');
                content=reportElementText(report);
                if(!content){alert('Générez d’abord une synthèse.');return;}
                filename='synthese-pedagogique';
            }else if(kind==='meeting'){
                const meeting=document.querySelector('#meeting-prep-output .natural-report');
                content=reportElementText(meeting);
                if(!content){alert('Générez d’abord la préparation à partir d’une synthèse.');return;}
                filename='preparation-reunion';
            }else{
                if(!student){alert('Sélectionnez un élève.');return;}
                const range=getReportRange(document.getElementById('r-periode')?.value||'');
                if(!range.start||!range.end||range.start>range.end){alert('Choisissez une période valide pour les séances à exporter.');return;}
                const logs=getDB().filter(log=>isJournalSession(log)&&sessionParts(log).eleve===student&&sessionParts(log).date>=range.start&&sessionParts(log).date<=range.end).sort((a,b)=>sessionSortKey(a).localeCompare(sessionSortKey(b)));
                if(!logs.length){alert('Aucune séance à exporter pour cet élève et cette période.');return;}
                const studentObj=getStudents().find(s=>String(s.nom||'')===String(student))||{nom:student};
                if(format==='docx'&&window.JournalierSeancesDocx){
                    window.JournalierSeancesDocx.exporter({seances:logs,eleve:studentObj,deidentifie:false})
                        .then(()=>document.getElementById('reports-exports')?.removeAttribute('open'))
                        .catch(error=>alert(`Export impossible : ${error?.message||error}`));
                    return;
                }
                const sessionExporter=window.JournalierV74?.exportSessionsDocument;
                if(typeof sessionExporter==='function'){
                    try{
                        sessionExporter('seances',logs,studentObj,range,format);
                        document.getElementById('reports-exports')?.removeAttribute('open');
                    }catch(error){
                        alert(`Export impossible : ${error?.message||error}`);
                    }
                    return;
                }
                const lines=['Historique des séances',`Période : ${range.start} → ${range.end}`];
                logs.forEach(log=>{
                    const parts=sessionParts(log),q2=log.q2||{},q3=log.q3||{},q4=log.q4||{},q5=log.q5||{},q6=log.q6||{};
                    const add=(label,value)=>{if(value)lines.push(`${label} : ${value}`);};
                    lines.push('',`${parts.date} — ${parts.matiere} (${sessionPeriodLabel(log)})`);
                    add('Objectif',log.objectif?.objectifLecon||log.objectif?.objectifProfessionnel||'');
                    add('Fonctionnement Q2',[...(q2.observations||[]).map(item=>`${item.observation}${historyQ2LevelLabel(item.niveau)?` — niveau constaté : ${historyQ2LevelLabel(item.niveau).toLocaleLowerCase('fr')}`:''}`),q2.precision].filter(Boolean).join(' — '));
                    add('Apprentissages Q3',[...(q3.indicateurs||[]).map(item=>`${item.texte}${item.appreciation!==undefined&&item.appreciation!==null?` — appréciation : ${reportIndicatorLabel(item.appreciation).toLocaleLowerCase('fr')}`:''}`),q3.repereWBE?.signature||q3.repereWBE?.hit,q3.precision].filter(Boolean).join(' — '));
                    add('Adaptations Q4',[...(q4.types||[]),...Object.entries(q4.effets||{}).map(([name,value])=>`${name} : ${historyQ4EffectLabel(value)}`),q4.precision].filter(Boolean).join(' — '));
                    add('Transfert Q5',[historyQ5TransferLabel(q5.statut),q5.precision].filter(Boolean).join(' — '));
                    add('Suites Q6',[...(q6.actions||[]),q6.modalite?`Modalité : ${q6.modalite}`:'',q6.objectif?`Objectif : ${q6.objectif}`:'',...(q6.collaborations||[]).map(c=>`Collaboration : ${c}`),q6.precision].filter(Boolean).join(' — '));
                });
                filename='seances';content=lines.join('\n');
            }
            if(!filename||!content){alert('Aucun contenu à exporter.');return;}
            const exporter=window.JournalierV74?.exportTextDocument;
            if(typeof exporter!=='function'){alert('Le module d’export Word/PDF n’est pas encore prêt. Réessayez dans quelques secondes.');return;}
            try{exporter(filename,content,format);}
            catch(error){alert(`Export impossible : ${error?.message||error}`);}
        });
    }

    /* =========================================================
       JOURNALIER V74 — RAPPORT NATUREL & SYNTHÈSE PÉDAGOGIQUE (Lot 3.4)
       Logique extraite dans : src/app/reports-core.js
       Moteur multi-profils (V0.1 à V0.8), analyse des régularités,
       synthèses visuelles, préparation de réunion et passerelle PIA.
       ========================================================= */

    function generateReport(){
      const student=document.getElementById('r-eleve')?.value||'',type=document.getElementById('r-periode')?.value||'';
      if(!student){alert('Sélectionnez un élève.');return;}
      const range=getReportRange(type);
      if(!range.start||!range.end||range.start>range.end){alert('Vérifiez les dates de début et de fin de la période.');return;}
      const allPeriodLogs=getDB().filter(l=>isJournalSession(l)&&sessionParts(l).eleve===student&&sessionParts(l).date>=range.start&&sessionParts(l).date<=range.end).sort((a,b)=>sessionSortKey(a).localeCompare(sessionSortKey(b)));
      if(!allPeriodLogs.length){alert(`Aucune séance ou trace d’absence pour ${student} entre le ${range.start} et le ${range.end}.`);return;}
      const logs=allPeriodLogs.filter(isObservationSession);
      const nonPresentLogs=allPeriodLogs.filter(l=>!isObservationSession(l));
      const attStats=computeAttendanceStats(allPeriodLogs);
      const evidence=logs.map(reportSessionEvidence), units=reportExtractUnits(evidence), relations=reportRelations(units);
      renderMeetingPrep(evidence,relations,allPeriodLogs);

      const renderCurrentSynthesis=()=>{
        const built=buildVisualSynthesisAndPIABridgeHtml(logs,evidence,units,relations,student,type,range);
        const headTitle=(type==='PV1'||type==='PV2')?`${reportIntegrationLabel(type)} — ${student}`:`Propositions pour le PIA — ${student}`;
        const reportBox=document.getElementById('report-text');
        if(!reportBox)return;
        const coteachNotes=nonPresentLogs.filter(l=>getSessionPresenceStatus(l)==='absent_eleve_coteach').map(l=>{
          const sp=sessionParts(l);
          const cn=getSessionClassNotes(l)||l.objectif?.objectifLecon||'Co-enseignement assuré';
          return `<li><strong>${escapeHtml(reportHumanDate(sp.date))} (${escapeHtml(sp.matiere||'Cours')})</strong> : ${escapeHtml(cn)}</li>`;
        }).join('');
        const attendanceBannerHtml=nonPresentLogs.length>0?`
          <div class="history-attendance-kpi-bar" style="margin-bottom:16px;">
            <div class="history-attendance-kpi-item">
              <strong>${attStats.attendanceRate!==null?`${attStats.attendanceRate}%`:'—'}</strong>
              <span>Taux de présence élève (${attStats.present}/${attStats.totalStudentOpportunities} cours maintenus)</span>
            </div>
            <div class="history-attendance-kpi-item">
              <strong style="color:#15803d;">${attStats.present}</strong>
              <span>🟢 Séance${attStats.present>1?'s':''} analysée${attStats.present>1?'s':''} (élève présent)</span>
            </div>
            <div class="history-attendance-kpi-item">
              <strong style="color:#6b21a8;">${attStats.coteach}</strong>
              <span>🟣 Co-ens. / Notes (élève absent)</span>
            </div>
            <div class="history-attendance-kpi-item">
              <strong style="color:#c2410c;">${attStats.absentEleve}</strong>
              <span>🟠 Absence${attStats.absentEleve>1?'s':''} élève (sans séance)</span>
            </div>
            <div class="history-attendance-kpi-item">
              <strong style="color:#0369a1;">${attStats.absentProf}</strong>
              <span>🔵 Prof. absent / Cours annulé</span>
            </div>
          </div>
          ${coteachNotes?`<div class="card" style="margin-bottom:16px;padding:12px 16px;background:#faf5ff;border:1px solid #e9d5ff;"><strong style="color:#581c87;font-size:.82rem;">🟣 Continuité pédagogique assurée en l’absence de l’élève (exclus des statistiques d’observation directe) :</strong><ul style="margin:6px 0 0 18px;font-size:.8rem;color:#3b0764;">${coteachNotes}</ul></div>`:''}
        `:'';
        reportBox.innerHTML=`<div class="report-output-head"><div><strong>${escapeHtml(headTitle)}</strong><div style="font-size:.72rem;color:#64748b;margin-top:2px;">Période : ${escapeHtml(({ANNEE:'année scolaire',ADATE:'état à ce jour',LIBRE:'dates choisies',HEBDO:'semaine',MENSUEL:'mois',PV1:'depuis le début du suivi',PV2:'depuis le début du suivi'})[type]||'période choisie')} (du ${range.start.split('-').reverse().join('/')} au ${range.end.split('-').reverse().join('/')}) · ${logs.length} séance${logs.length>1?'s':''} avec l’élève${nonPresentLogs.length?` · ${nonPresentLogs.length} absence${nonPresentLogs.length>1?'s':''} ou intervention${nonPresentLogs.length>1?'s':''} sans l’élève`:''}</div></div><span class="v11-mini-tag" data-export-ignore="true">${logs.length} séance${logs.length>1?'s':''} observée${logs.length>1?'s':''}</span></div>${attendanceBannerHtml}${built.html}`;
        document.getElementById('report-output-box')?.classList.remove('hidden');
        bindSynthesisPIABridgeEvents(reportBox,built.pia,renderCurrentSynthesis);
        setReportView(currentReportFullMode);
      };
      renderCurrentSynthesis();
    }



// Exposition globale et namespace JournalierReports
var JournalierReports = {
  reportUnique,
  reportRarityPhrase,
  reportNorm,
  reportDateKey,
  reportHumanDate,
  reportTokens,
  reportTheme,
  reportEffectLabel,
  reportIndicatorMatchScore,
  reportSessionEvidence,
  reportExtractUnits,
  reportRelations,
  reportIntegrationLabel,
  reportIntegrationPhaseData,
  reportPhaseThemeState,
  buildVisualSynthesisAndPIABridgeHtml,
  bindSynthesisPIABridgeEvents
};

if (typeof window !== 'undefined') {
  window.JournalierReports = JournalierReports;
}
if (typeof globalThis !== 'undefined') {
  globalThis.JournalierReports = JournalierReports;
  globalThis.reportUnique = reportUnique;
  globalThis.reportRarityPhrase = reportRarityPhrase;
  globalThis.reportNorm = reportNorm;
  globalThis.reportDateKey = reportDateKey;
  globalThis.reportHumanDate = reportHumanDate;
  globalThis.reportTokens = reportTokens;
  globalThis.reportTheme = reportTheme;
  globalThis.reportEffectLabel = reportEffectLabel;
  globalThis.reportIndicatorMatchScore = reportIndicatorMatchScore;
  globalThis.reportSessionEvidence = reportSessionEvidence;
  globalThis.reportExtractUnits = reportExtractUnits;
  globalThis.reportRelations = reportRelations;
  globalThis.reportIntegrationLabel = reportIntegrationLabel;
  globalThis.reportIntegrationPhaseData = reportIntegrationPhaseData;
  globalThis.reportPhaseThemeState = reportPhaseThemeState;
  globalThis.buildVisualSynthesisAndPIABridgeHtml = buildVisualSynthesisAndPIABridgeHtml;
  globalThis.bindSynthesisPIABridgeEvents = bindSynthesisPIABridgeEvents;
}
