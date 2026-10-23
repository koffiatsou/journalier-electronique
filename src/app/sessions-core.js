/* =========================================================
   JOURNALIER V74 — SESSIONS & OBSERVATIONS RUNTIME
   Extrait modulaire de journalier-core.js (Lot 3.7)
   - Formulaire d'encodage des séances (questions Q1 à Q6)
   - Moteur de reconnaissance et prédiction d'indicateurs WBE (Q3)
   - Précisions et curseurs d'effets (Q4), statuts de transfert (Q5)
   - Historique pédagogique de l'élève, modification, persistance & suppression
   ========================================================= */

(function (global) {
    function getDB() {
        if (typeof global.getDB === 'function') return global.getDB();
        if (typeof window !== 'undefined' && typeof window.getDB === 'function') return window.getDB();
        if (typeof window !== 'undefined' && window.DataStore) return window.DataStore.getSessions();
        return [];
    }
    function saveDB(db) {
        if (typeof global.saveDB === 'function') return global.saveDB(db);
        if (typeof window !== 'undefined' && typeof window.saveDB === 'function') return window.saveDB(db);
        if (typeof window !== 'undefined' && window.DataStore) return window.DataStore.saveSessions(db);
    }
    function getStudents() {
        if (typeof global.getStudents === 'function') return global.getStudents();
        if (typeof window !== 'undefined' && typeof window.getStudents === 'function') return window.getStudents();
        if (typeof window !== 'undefined' && window.DataStore) return window.DataStore.getStudents();
        return [];
    }
    function updateStudentDropdowns() {
        if (typeof global.updateStudentDropdowns === 'function') return global.updateStudentDropdowns();
        if (typeof window !== 'undefined' && typeof window.updateStudentDropdowns === 'function') return window.updateStudentDropdowns();
    }
    function isJournalSession(entry) {
        if (typeof global.isJournalSession === 'function') return global.isJournalSession(entry);
        if (typeof window !== 'undefined' && typeof window.isJournalSession === 'function') return window.isJournalSession(entry);
        return Boolean(entry && entry.type === 'SEANCE');
    }
    
    function sessionParts(entry){
        const i=entry?.identification||{},p=i.periode||{},c=entry?.contexte||{};
        return {eleve:i.eleve||'',date:i.date||'',start:p.start||'',end:p.end||'',matiere:c.matiere||''};
    }
    function sessionPeriodLabel(entry){
        const p=sessionParts(entry);
        return p.start&&p.end&&p.start!==p.end?`${p.start} → ${p.end}`:(p.start||p.end||'');
    }
    function sessionSortKey(entry){
        const p=sessionParts(entry);
        return `${p.date}${p.start}${p.end}`;
    }

    function isSameStudentSessionSlot(item,studentId,targetParts){
        const x=sessionParts(item);
        const sameStudent=(item.identification?.eleveId&&item.identification.eleveId===studentId)||(x.eleve===targetParts.eleve);
        return Boolean(sameStudent&&x.date===targetParts.date&&x.start===targetParts.start&&x.end===targetParts.end);
    }

    function getCheckedValues(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(c => c.value);
    }

    function showSessionSaveConfirmation(entry){
        const box=document.getElementById('session-save-confirmation');
        const text=document.getElementById('session-save-confirmation-text');
        if(!box || !text) return;
        const p=sessionParts(entry); const parts=[p.eleve,p.matiere,p.date,sessionPeriodLabel(entry)].filter(Boolean);
        text.textContent=parts.join(' · ') + ' — disponible dans Rapports & PIA.';
        box.classList.remove('hidden');
        box.style.display='flex';
    }

    function persistSessionEntry(entry){
        if(!entry||entry.type!=='SEANCE')throw new Error('Modèle de séance invalide.');
        const p=sessionParts(entry);
        if(!p.eleve||!p.date||!p.start||!p.end)throw new Error('Identification de la séance incomplète.');
        const students=getStudents();
        const student=students.find(s=>String(s.nom)===String(p.eleve));
        if(!student){
            throw new Error('L’élève actuellement sélectionné n’existe plus dans le dossier. Choisissez un élève actuel avant d’enregistrer la séance.');
        }
        const normalized=secureNormalizeSession({...entry, schemaVersion:JOURNALIER_ARCHITECTURE_VERSION, ownerId:DataStore.getIdentity().ownerId}, students);
        normalized.identification={...(normalized.identification||{}),eleveId:student.studentId};
        const db=getDB();
        const editingId=String(entry.id||'');
        if(editingId){
            const collision=db.find(item=>{
                if(!isJournalSession(item) || String(item.id)===editingId) return false;
                return isSameStudentSessionSlot(item,student.studentId,p);
            });
            if(collision) throw new Error('Une autre séance existe déjà pour cet élève, cette date et cette période.');
        }
        const filtered=db.filter(item=>{
            if(!isJournalSession(item)) return true;
            // En mode édition, l'entrée d'origine est remplacée par son ID.
            if(editingId && String(item.id)===editingId) return false;
            return !isSameStudentSessionSlot(item,student.studentId,p);
        });
        const previousEntry=editingId?db.find(x=>String(x.id)===editingId):null;
        filtered.unshift(normalized);
        saveDB(filtered);
        const after=getDB();
        if(!after.find(x=>String(x.id)===String(normalized.id)))throw new Error('La séance n’a pas pu être vérifiée après enregistrement.');
        syncAgendaAfterSessionSave(previousEntry,normalized);
        return after;
    }


    function syncAgendaAfterSessionSave(previousEntry,currentEntry){
        // L'Historique est la source de vérité pour la réalisation d'une séance.
        // L'Agenda projette cette information à l'affichage via getEventsForDate().
        // Ne pas modifier ici les propositions persistées : plusieurs propositions
        // peuvent coexister et aucune ne doit être choisie arbitrairement.
        const agenda=getPrevisionnel();
        agenda.__events=Array.isArray(agenda.__events)?agenda.__events:[];
        return;
    }

    function clearObservationForm() {
        editingSessionId = null;
        const saveButton = document.getElementById('save-session-btn');
        if(saveButton) saveButton.textContent='💾 Enregistrer la séance';
        const form = document.getElementById('observationForm');
        form.reset();
        const studentEditNote=document.getElementById('session-student-edit-note');
        if(studentEditNote){studentEditNote.textContent='';studentEditNote.classList.add('hidden');}
        document.getElementById('f-eleve')?.removeAttribute('data-orphan-session-student');
        const confirmation=document.getElementById('session-save-confirmation');
        if(confirmation){ confirmation.classList.add('hidden'); confirmation.style.display='none'; }
        document.getElementById('f-date').value = selectedDateISO || getInitialDateISO();
        document.getElementById('f-periode-start').value = '1e H';
        document.getElementById('f-periode-end').value = '1e H';
        syncSessionPeriodRange();
        document.getElementById('f-matiere').value = '';
        document.getElementById('f-matiere').dataset.selectedSubject = '';
        const subjectNote=document.getElementById('session-subject-selected-note');
        if(subjectNote) subjectNote.textContent='Les matières principales du dossier sont proposées en priorité. Vous pouvez aussi saisir librement une autre matière.';
        document.getElementById('q4-status-value').value = 'none';
        document.getElementById('q5-transfer-value').value = '';
        document.getElementById('q6-modality-value').value = '';
        document.getElementById('q6-objective-value').value = '';
        document.querySelectorAll('#q4-types-select input[name="q4-type"], #q6-actions-select input[name="q6-action"], #q6-collab-select input[name="q6-collab"]').forEach(x=>x.checked=false);
        updateMultiSelectSummary('q4-types-select','q4-type');

        syncBubbleSelects(); syncBubbleCheckboxStates();
        updateMultiSelectSummary('q6-collab-select','q6-collab');
        const classNotesEl=document.getElementById('f-classNotes');
        if(classNotesEl)classNotesEl.value='';
        window.setSessionPresenceMode?.('present');
        closeAllChoiceMenus();
        updatePIAPrompt();
    }

    // V56 — les matières sont distinguées à un niveau exploitable par le
    // rapprochement WBE. Les anciennes familles restent reconnues par le moteur
    // pour assurer la compatibilité avec les dossiers déjà encodés.
    const SUBJECT_OPTIONS=[
        "Mathématiques",
        "Français",
        "Anglais",
        "Néerlandais",
        "Latin",
        "Grec ancien",
        "Biologie",
        "Chimie",
        "Physique",
        "Sciences économiques",
        "Histoire",
        "Géographie",
        "FMTTN",
        "Philosophie / citoyenneté",
        "ECA",
        "EP&S"
    ];
    function normalizeSubjectList(value){
        if(Array.isArray(value))return value.filter(Boolean).map(String);
        if(typeof value==='string')return value.split(',').map(x=>x.trim()).filter(Boolean);
        return [];
    }
    function getStudentByName(name){return getStudents().find(s=>s.nom===name)||null;}
    const LEGACY_SUBJECT_OPTIONS=["Langues modernes","Sciences","FHGES"];
    function subjectOptionsForSelection(selected=[]){ return window.JournalierStudents.subjectOptionsForSelection(selected); }
    function renderStudentSubjectOptions(filter='', selectedOverride=null){ return window.JournalierStudents.renderStudentSubjectOptions(filter, selectedOverride); }
    function toggleStudentSubject(value){ return window.JournalierStudents.toggleStudentSubject(value); }

    function updateStudentSubjectsSummary(){ return window.JournalierStudents.updateStudentSubjectsSummary(); }

    function filterStudentSubjects(){ return window.JournalierStudents.filterStudentSubjects(); }

    function initStudentSubjects(selected=[]){ return window.JournalierStudents.initStudentSubjects(selected); }

    function updateMultiSelectSummary(containerId,name){
        const box=document.getElementById(containerId);
        if(!box)return;
        const checked=Array.from(box.querySelectorAll(`input[name="${name}"]:checked`));
        const summary=box.querySelector('[id$="-summary"]');
        if(!summary)return;
        if(!checked.length){
            summary.className='placeholder';
            summary.textContent=containerId==='q4-types-select'?'Sélectionner un ou plusieurs éléments…':'Sélectionner une ou plusieurs matières…';
        } else if(checked.length<=2){
            summary.className='';
            summary.textContent=checked.map(x=>x.value).join(' · ');
        } else {
            summary.className='count';
            summary.textContent=`${checked.length} éléments sélectionnés`;
        }
    }

    function toggleMultiSelect(containerId){
        const box=document.getElementById(containerId);
        if(!box)return;
        const menu=box.querySelector('.multi-select-menu');
        if(!menu)return;
        const hidden=menu.classList.contains('hidden');
        closeAllChoiceMenus();
        if(hidden)menu.classList.remove('hidden');
    }

    function closeAllChoiceMenus(){
        document.querySelectorAll('.multi-select-menu,.search-select-menu').forEach(el=>el.classList.add('hidden'));
    }

    function renderSessionSubjectMenu(filter=''){
        const menu=document.getElementById('session-subject-menu');
        if(!menu)return;
        const student=getStudentByName(document.getElementById('f-eleve')?.value);
        const main=normalizeSubjectList(student?.matieres);
        const all=[...main,...SUBJECT_OPTIONS.filter(x=>!main.includes(x))];
        const q=String(filter||'').trim().toLowerCase();
        const options=all.filter(x=>!q||x.toLowerCase().includes(q));
        menu.innerHTML=options.length
            ? options.map((x,i)=>`<button type="button" class="search-select-option ${i<main.length?'active':''} js-session-subject" data-value="${escapeHtml(x)}">${escapeHtml(x)}${main.includes(x)?' · matière principale':''}</button>`).join('')
            : '<div class="search-select-empty">Aucune matière dans la liste. Vous pouvez la saisir librement.</div>';
    }
    function openSessionSubjectMenu(){
        // L'ouverture doit toujours permettre de voir les autres matières,
        // même lorsqu'une matière est déjà sélectionnée.
        renderSessionSubjectMenu('');
        document.getElementById('session-subject-menu')?.classList.remove('hidden');
    }
    function filterSessionSubjects(){
        const input=document.getElementById('f-matiere');
        if(input) input.dataset.selectedSubject = String(input.value || '').trim();
        renderSessionSubjectMenu(input?.value||'');
        document.getElementById('session-subject-menu')?.classList.remove('hidden');
        updateObservationSuggestions();
    }
    function chooseSessionSubject(value){
        const input=document.getElementById('f-matiere');
        if(!input) return;
        const selected=String(value || '').trim();
        input.value=selected;
        input.dataset.selectedSubject=selected;
        const note=document.getElementById('session-subject-selected-note');
        if(note) note.textContent=selected ? `Matière sélectionnée : ${selected}` : 'Les matières principales du dossier sont proposées en priorité. Vous pouvez aussi saisir librement une autre matière.';
        const menu=document.getElementById('session-subject-menu');
        if(menu) menu.classList.add('hidden');
        input.blur();
        updateObservationSuggestions();
    }
    function refreshSessionSubjectsForStudent(){
        const input=document.getElementById('f-matiere');
        if(input) {
            input.dataset.selectedSubject = '';
            const note=document.getElementById('session-subject-selected-note');
            if(note) note.textContent='Les matières principales du dossier sont proposées en priorité. Vous pouvez aussi saisir librement une autre matière.';
        }
        renderSessionSubjectMenu(input?.value||'');
    }
    document.addEventListener('click',function(e){if(!e.target.closest('.multi-select')&&!e.target.closest('.search-select'))closeAllChoiceMenus();});
    function normalizeIndicatorText(value){
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .toLowerCase()
            .replace(/[’'`]/g,"'")
            .replace(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ' -]/gi,' ')
            .replace(/\s+/g,' ')
            .trim();
    }

    const INDICATOR_STOP_WORDS = new Set(Object.freeze([
        'le','la','les','un','une','des','du','de','d','et','ou','en','dans','a','au','aux',
        'pour','par','avec','sur','se','sa','son','ses','ce','cette','ces','qui','que',
        'une','est','sont','à','il','elle','leur','leurs','comme','selon','vers','entre',
        'être','avoir','faire','réaliser','tache','situation','donnee','donnees','etudiee',
        'etudie','pertinent','adaptee','adapte','necessaire','utilise','utiliser'
    ]));

    function indicatorTokens(value){
        return normalizeIndicatorText(value)
            .split(/[\s-]+/)
            .map(x=>x.replace(/^'+|'+$/g,''))
            .filter(x=>x.length>=3 && !INDICATOR_STOP_WORDS.has(x))
            .map(x=>x.length>4 ? x.replace(/[sx]$/,'') : x);
    }

    const INDICATOR_SUBJECT_ALIASES = Object.freeze({
        'francais':'Français / Langues anciennes',
        'francais langues anciennes':'Français / Langues anciennes',
        'philosophie citoyennete':'Philosophie et citoyenneté',
        'philosophie et citoyennete':'Philosophie et citoyenneté',
        'eca':'Éducation culturelle et artistique',
        'education culturelle et artistique':'Éducation culturelle et artistique',
        'ep&s':'Éducation physique et à la santé',
        'ep s':'Éducation physique et à la santé',
        'education physique et a la sante':'Éducation physique et à la santé',
        'mathématiques':'Mathématiques',
        'mathematiques':'Mathématiques',
        'maths':'Mathématiques',
        'maths soutien':'Mathématiques',
        'maths - soutien':'Mathématiques',
        'math':'Mathématiques',
        'science':'Sciences',
        'sciences':'Sciences',
        'biologie':'Sciences',
        'chimie':'Sciences',
        'physique':'Sciences',
        'anglais':'Langues modernes',
        'english':'Langues modernes',
        'neerlandais':'Langues modernes',
        'néerlandais':'Langues modernes',
        'dutch':'Langues modernes',
        'latin':'Français / Langues anciennes',
        'grec':'Français / Langues anciennes',
        'grec ancien':'Français / Langues anciennes',
        'histoire':'FHGES',
        'géographie':'FHGES',
        'geographie':'FHGES',
        'sciences economiques':'FHGES',
        'sciences économiques':'FHGES',
        'sciences eco':'FHGES',
        'sc. eco':'FHGES',
        'fghes':'FHGES',
        'fmt':'FMTTN',
        'fmttn':'FMTTN',
        'philosophie / citoyenneté':'Philosophie et citoyenneté',
        'eps':'Éducation physique et à la santé'
    });

    function indicatorSubjectKey(value){
        const v=normalizeIndicatorText(value);
        return INDICATOR_SUBJECT_ALIASES[v] || String(value || '').trim();
    }

    function q3CurrentSelections(name){
        return new Set(Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
            .map(x=>x.dataset.indicatorId || x.value)
            .filter(Boolean));
    }

    // V53 — moteur expérimental WBE v0.5.
    // La bibliothèque garde les indicateurs V0.4, mais chaque indicateur peut
    // désormais porter un chemin WBE : programme -> module/UAA/thème ->
    // séquence/section -> notion -> formulations terrain.

    function indicatorPhraseList(value){
        if(Array.isArray(value)) return value.map(v=>String(v||'').trim()).filter(Boolean);
        const text=String(value||'').trim(); return text?[text]:[];
    }
    function indicatorTokenSet(value){ return new Set(indicatorTokens(value)); }
    function indicatorMorphToken(token){
        let t=String(token||'');
        if(t.length<6) return t;
        if(t.endsWith('er')||t.endsWith('ir')||t.endsWith('re')) t=t.slice(0,-2);
        else if(t.endsWith('ant')||t.endsWith('ent')) t=t.slice(0,-3);
        else if(t.endsWith('e')) t=t.slice(0,-1);
        return t;
    }
    function indicatorMorphTokenSet(value){ return new Set(indicatorTokens(value).map(indicatorMorphToken)); }

    // Les termes d'organisation pédagogique peuvent être présents dans un objectif
    // sans constituer le contenu disciplinaire : ils sont ignorés pour le rapprochement.
    const INDICATOR_GENERIC_TOKENS=new Set([
        'analyse','analyser','apprendre','apprentissage','calcul','calculer','concept','concepts','contenu','cours','dossier','exercice','exercices',
        'evaluation','évaluation','evaluer','faire','matiere','notion','notions','objectif','objectifs','preparation','preparer','préparation','projet',
        'revision','reviser','révision','réviser','interro','interrogation','interrogations','interrogée','interrogé','test','tests','controle','contrôle',
        'travail','travailler','vocabulaire','session','seance','séance','lecon','lecons','tableau','tableaux',
        'procedure','procedures','information','informations','situation','situations','texte','textes','element','elements','partie','parties','activite','activites',
        'probleme','problemes','reunion','grandeur','grandeurs','integration','interro','absent','absente','prof','professeur','cebd','ceb','examen','examens'
    ]);
    const INDICATOR_ADMIN_PATTERNS=[
        /\b(reunion|réunion)\b/,/\b(eleve|élève)\s+(absent|absente)\b/,/\b(prof|professeur|enseignant|enseignante)\s+(absent|absente)\b/,/\b(absent|absente)\b/,
        /\bsession\s+d['’]?examen\b/,/\b(examen|examens)\b/,/\bpost[- ]?test\b/,/\bbilan\b/,/\bconseil\s+de\s+classe\b/,/\bjournee\s+pedagogique\b/
    ];
    function indicatorMeaningfulTokens(value){ return [...indicatorTokenSet(value)].filter(t=>!INDICATOR_GENERIC_TOKENS.has(t)); }
    function indicatorIsAdministrativeObjective(objective){
        const n=normalizeIndicatorText(objective); if(!n) return true;
        return INDICATOR_ADMIN_PATTERNS.some(re=>re.test(n));
    }
    function indicatorPhraseMatches(objective,phrases){
        const obj=normalizeIndicatorText(objective); if(!obj) return [];
        const objTokens=indicatorMeaningfulTokens(obj);
        return phrases.map(raw=>{
            const normalized=normalizeIndicatorText(raw), phraseTokens=indicatorMeaningfulTokens(normalized);
            const overlap=phraseTokens.filter(t=>objTokens.includes(t));
            const phraseCovered=phraseTokens.length>0&&phraseTokens.every(t=>objTokens.includes(t));
            const singleHead=objTokens.length===1&&objTokens[0].length>=6&&phraseTokens.includes(objTokens[0]);
            return {raw,normalized,overlap,phraseTokens,phraseCovered,singleHead};
        }).filter(x=>x.normalized&&(obj===x.normalized||obj.includes(x.normalized)||x.normalized.includes(obj)||((x.phraseTokens.length>=2||objTokens.length===1)&&x.phraseCovered)||x.singleHead||(x.overlap.length>=2&&x.overlap.length/Math.max(1,x.phraseTokens.length)>=.5)))
        .sort((a,b)=>Number(b.singleHead)-Number(a.singleHead)||b.overlap.length-a.overlap.length||b.normalized.length-a.normalized.length);
    }
    function indicatorConceptMatches(objectiveTokens,objective,concepts){
        const obj=normalizeIndicatorText(objective), objMeaningful=indicatorMeaningfulTokens(obj), out=[];
        indicatorPhraseList(concepts).forEach(raw=>{
            const phrase=normalizeIndicatorText(raw), tokens=indicatorMeaningfulTokens(phrase); if(!tokens.length)return;
            const exact=obj===phrase||obj.includes(phrase)||phrase.includes(obj);
            const overlap=tokens.filter(t=>objectiveTokens.has(t));
            const objectiveCovered=objMeaningful.length>0&&objMeaningful.every(t=>tokens.includes(t));
            const singleHead=objMeaningful.length===1&&objMeaningful[0].length>=6&&objectiveCovered;
            if(exact||singleHead||overlap.length>=2) out.push({raw,phrase,exactPhrase:exact,overlap:overlap.length,singleHead});
        });
        return out.sort((a,b)=>Number(b.exactPhrase)-Number(a.exactPhrase)||Number(b.singleHead)-Number(a.singleHead)||b.overlap-a.overlap||b.phrase.length-a.phrase.length);
    }
    /**
     * Résout un indicateur de la bibliothèque par son ID via le cache indexé ou recherche linéaire.
     * @param {string|number} id
     * @returns {object|null}
     */
    function resolveLibraryIndicator(id) {
        if (!id) return null;
        if (typeof findIndicatorById === 'function') {
            return findIndicatorById(id);
        }
        return INDICATOR_LIBRARY?.indicateurs_apprentissage?.find(x => String(x.id || '') === String(id)) || null;
    }

    function indicatorActionMatches(objective,actions){
        const obj=normalizeIndicatorText(objective), motor=INDICATOR_LIBRARY?.moteur_rapprochement?.actions||{}, detected=[];
        Object.entries(motor).forEach(([action,variants])=>{ if([action,...indicatorPhraseList(variants)].some(v=>{const n=normalizeIndicatorText(v);return n&&(obj===n||obj.includes(n));})) detected.push(action); });
        const allowed=new Set(indicatorPhraseList(actions).map(x=>normalizeIndicatorText(x)));
        return detected.filter(a=>allowed.has(normalizeIndicatorText(a)));
    }
    function indicatorBridgeMatches(objective){
        const bridges=INDICATOR_LIBRARY?.moteur_rapprochement?.ponts_terrain; if(!Array.isArray(bridges))return [];
        const obj=normalizeIndicatorText(objective), om=indicatorMeaningfulTokens(obj), out=[];
        bridges.forEach(bridge=>{
            const scored=[bridge.expression,...indicatorPhraseList(bridge.variantes)].filter(Boolean).map(raw=>{
                const n=normalizeIndicatorText(raw), t=indicatorMeaningfulTokens(n), ov=t.filter(x=>om.includes(x));
                return {raw,normalized:n,overlap:ov,exact:obj===n||obj.includes(n),covered:om.length>0&&om.every(x=>t.includes(x)),phraseCovered:t.length>0&&t.every(x=>om.includes(x)),singleHead:om.length===1&&om[0].length>=6&&t.includes(om[0])};
            }).filter(x=>x.normalized&&(x.exact||x.phraseCovered||x.singleHead||x.overlap.length>=2));
            scored.sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.singleHead)-Number(a.singleHead)||b.overlap.length-a.overlap.length);
            if(scored[0])out.push({bridge,hit:scored[0]});
        });
        return out;
    }

    // V55 — état du repère WBE courant.
    // Le repère est un filtre d'optimisation, jamais une condition obligatoire pour
    // afficher les indicateurs Q3. L'utilisateur peut conserver sa propre formulation.
    let wbeValidatedState = { signature:'', hit:'', kind:'', bridgeId:'', indicatorIds:[], sourceLabel:'', appliedToObjective:false };

    // Ponts sémantiques expérimentaux : ils relient une formulation de terrain à un
    // contenu WBE plausible et aux indicateurs Q3 existants. Ils ne créent aucun indicateur.
    const WBE_SEMANTIC_BRIDGES = [
        {
            id:'MATH-TRIGONOMETRIE', subject:'Mathématiques',
            labels:['Trigonométrie','Triangle rectangle','Rapports trigonométriques'],
            triggers:[['trigonometrie'],['tangente'],['sinus'],['cosinus'],['triangle','rectangle','tangente'],['triangle','rectangle','sinus'],['triangle','rectangle','cosinus']],
            indicatorIds:['MATH-16','MATH-18'],
            sourceLabel:'Pont sémantique WBE → géométrie / triangle rectangle'
        },
        {
            id:'MATH-PUISSANCES', subject:'Mathématiques',
            labels:['Les puissances','Propriétés des puissances','Puissances et radicaux'],
            triggers:[['puissance'],['puissances'],['proprietes','puissances'],['puissance','puissance'],['puissances','radicaux']],
            indicatorIds:['MATH-09'],
            sourceLabel:'Référentiel WBE — contenu algébrique / puissances'
        },
        {
            id:'MATH-RACINES', subject:'Mathématiques',
            labels:['Racines carrées','Puissances et radicaux'],
            triggers:[['racines','carrees'],['racine','carree'],['radicaux']],
            indicatorIds:['MATH-09'],
            sourceLabel:'Référentiel WBE — contenu algébrique / racines et radicaux'
        },
        {
            id:'MATH-EQUATIONS', subject:'Mathématiques',
            labels:['Équations, inéquations et systèmes','Équations du second degré','Équations du premier degré'],
            triggers:[['equation'],['equations'],['equation','second','degre'],['equations','second','degre'],['equation','premier','degre'],['equations','premier','degre'],['resoudre','equation'],['resolution','equation']],
            indicatorIds:['MATH-10'],
            sourceLabel:'Référentiel WBE — équations / inéquations / systèmes'
        },
        {
            id:'MATH-PRIORITES', subject:'Mathématiques',
            labels:['Priorités opératoires','Ordre des opérations','Chaînes d’opérations'],
            triggers:[['priorite'],['priorites'],['priorite','operations'],['priorites','operations'],['ordre','operations'],['chaines','operations']],
            indicatorIds:['MATH-04'],
            sourceLabel:'Référentiel WBE — priorités opératoires'
        },
        {
            id:'MATH-PYTHAGORE', subject:'Mathématiques',
            labels:['Théorème de Pythagore','Triangle rectangle'],
            triggers:[['pythagore'],['theoreme','pythagore'],['triangle','rectangle']],
            indicatorIds:['MATH-16','MATH-18'],
            sourceLabel:'Référentiel WBE — géométrie / triangle rectangle'
        },
        {
            id:'MATH-PROPORTIONNALITE', subject:'Mathématiques',
            labels:['Proportionnalité','Règle de trois'],
            triggers:[['proportionnalite'],['proportionnalite','regle'],['regle','trois']],
            indicatorIds:['MATH-07'],
            sourceLabel:'Référentiel WBE — proportionnalité'
        }
    ];
    function wbeBridgeMatches(objective,subject){
        const objTokens=new Set(indicatorMeaningfulTokens(normalizeIndicatorText(objective)));
        if(!objTokens.size) return [];
        const subjectKey=indicatorSubjectKey(subject);
        return WBE_SEMANTIC_BRIDGES.map(b=>{
            if(subjectKey && subjectKey!==indicatorSubjectKey(b.subject)) return null;
            let best=0,matched=[];
            b.triggers.forEach(trigger=>{
                const t=trigger.map(x=>indicatorMeaningfulTokens(normalizeIndicatorText(x))).map(a=>a[0]||'').filter(Boolean);
                const hit=t.filter(x=>objTokens.has(x));
                if(hit.length===t.length && hit.length>best){best=hit.length;matched=trigger;}
            });
            if(!best) return null;
            const label=b.labels.find(l=>{
                const lt=new Set(indicatorMeaningfulTokens(normalizeIndicatorText(l)));
                return matched.some(m=>indicatorMeaningfulTokens(normalizeIndicatorText(m)).some(mt=>lt.has(mt)));
            })||b.labels[0];
            return {bridge:b,score:best===1?84:94,kind:'bridge',hit:label,matched};
        }).filter(Boolean).sort((a,b)=>b.score-a.score);
    }

    function wbeIndicatorFields(indicator){
        const r=indicator?.referentiel_wbe||{};
        return {
            sequences:indicatorPhraseList(r.sequences), notions:indicatorPhraseList(r.notions), modules:indicatorPhraseList(r.modules_uaa_themes),
            aliases:indicatorPhraseList(r.aliases_terrain_wbe), paths:Array.isArray(r.chemins)?r.chemins:[]
        };
    }
    function wbePhraseScore(objective,phrases,kind){
        const obj=normalizeIndicatorText(objective), ot=indicatorMeaningfulTokens(obj); if(!obj||!ot.length)return {score:0,hit:null};
        const omorph=new Set(ot.map(indicatorMorphToken));
        let best={score:0,hit:null};
        for(const raw of phrases){
            const p=normalizeIndicatorText(raw), pt=indicatorMeaningfulTokens(p); if(!p||!pt.length)continue;
            const pmorph=new Set(pt.map(indicatorMorphToken));
            const overlap=pt.filter(t=>ot.includes(t));
            const morphOverlap=[...pmorph].filter(t=>omorph.has(t)&&t.length>=5);
            const exact=obj===p;
            const contains=obj.includes(p)||p.includes(obj);
            const fullObjective=ot.every(t=>pt.includes(t));
            const fullPhrase=pt.every(t=>ot.includes(t));
            const specific=pt.filter(t=>t.length>=5&&!INDICATOR_GENERIC_TOKENS.has(t));
            let score=0;
            if(exact) score=kind==='notion'?88:kind==='sequence'?100:kind==='alias'?78:24;
            else if(fullPhrase && specific.length>=1) score=kind==='notion'?76:kind==='sequence'?86:kind==='alias'?68:22;
            else if(fullObjective && ot.length===1 && ot[0].length>=6) score=kind==='notion'?72:kind==='sequence'?76:kind==='alias'?64:20;
            else if(overlap.length>=2 && overlap.length/Math.max(1,pt.length)>=.5 && specific.length>=1) score=kind==='notion'?58:kind==='sequence'?68:kind==='alias'?56:16;
            else if(morphOverlap.length>=1 && specific.length>=1){
                score=kind==='notion'?60:kind==='sequence'?70:kind==='alias'?58:18;
                if(morphOverlap.length>=2) score+=8;
            }
            else if(contains && overlap.length>=1 && specific.length>=1) score=kind==='notion'?46:kind==='sequence'?54:kind==='alias'?44:12;
            if(score>best.score)best={score,hit:{raw,overlap,morphOverlap,kind,exact,fullObjective,fullPhrase}};
        }
        return best;
    }
    function scoreWBE(indicator,objective){
        const f=wbeIndicatorFields(indicator);
        const seq=wbePhraseScore(objective,f.sequences,'sequence'), notion=wbePhraseScore(objective,f.notions,'notion'), alias=wbePhraseScore(objective,f.aliases,'alias'), mod=wbePhraseScore(objective,f.modules,'module');
        const best=Math.max(seq.score,notion.score,alias.score,mod.score);
        return {score:best,sequence:seq,notion,alias,module:mod};
    }

    function wbePredictionSignature(objective,subject){
        return normalizeIndicatorText(subject)+'|'+normalizeIndicatorText(objective);
    }
    function wbePredictionCandidates(objective,subject){
        const obj=normalizeIndicatorText(objective);
        if(!obj||indicatorIsAdministrativeObjective(obj)) return [];
        const bridgeRows=wbeBridgeMatches(obj,subject).map(r=>({
            type:'bridge',score:r.score,hit:r.hit,kind:r.kind,bridgeId:r.bridge.id,indicatorIds:r.bridge.indicatorIds,sourceLabel:r.bridge.sourceLabel,matched:r.matched
        }));
        const subjectKey=indicatorSubjectKey(subject);
        const families=Object.keys(INDICATOR_LIBRARY?.familles_matieres||{});
        const subjectKnown=Boolean(subjectKey)&&families.some(x=>indicatorSubjectKey(x)===subjectKey);
        const rows=[];
        (INDICATOR_LIBRARY?.indicateurs_apprentissage||[]).forEach((indicator,index)=>{
            const indSubject=indicatorSubjectKey(indicator.matiere);
            if(subjectKnown && indSubject!==subjectKey) return;
            const f=wbeIndicatorFields(indicator);
            [['notion',f.notions],['sequence',f.sequences],['module',f.modules],['alias',f.aliases]].forEach(([kind,list])=>{
                const r=wbePhraseScore(obj,list,kind);
                if(r.score>0 && r.hit) rows.push({type:'library',score:r.score,hit:r.hit.raw,kind,index,indicatorIds:[indicator.id],sourceLabel:kind==='notion'?'Référentiel WBE — notion':kind==='sequence'?'Référentiel WBE — séquence':kind==='module'?'Référentiel WBE — module / thème':'Rapprochement WBE — formulation terrain'});
            });
        });
        rows.push(...bridgeRows);
        rows.sort((a,b)=>b.score-a.score||a.index-b.index);
        const out=[],seen=new Set();
        for(const row of rows){
            const key=normalizeIndicatorText(row.hit);
            if(!key||seen.has(key)) continue;
            seen.add(key); out.push(row);
            if(out.length>=4) break;
        }
        return out;
    }

    function wbeStateMatchesCurrent(objective,subject){
        return Boolean(wbeValidatedState.hit && wbeValidatedState.signature===wbePredictionSignature(objective,subject));
    }

    // Sélectionne un repère : il devient immédiatement le filtre d'optimisation Q3.
    // Le clic sur une alternative remplace donc bien le repère précédent.
    function selectWBERepere(row){
        const objective=document.getElementById('f-objLecon')?.value||'';
        const subject=document.getElementById('f-matiere')?.value||'';
        wbeValidatedState={
            signature:wbePredictionSignature(objective,subject),
            hit:row.hit||'', kind:row.kind||'', bridgeId:row.bridgeId||'',
            indicatorIds:Array.isArray(row.indicatorIds)?row.indicatorIds:[],
            sourceLabel:row.sourceLabel||'', appliedToObjective:false
        };
        renderWBEObjectivePrediction(objective,subject);
        renderQ3Library({student:document.getElementById('f-eleve')?.value||'',subject,level:document.getElementById('f-niveau')?.value||'',form:document.getElementById('f-forme')?.value||'',objective});
        renderQ3ValidatedWBE();
    }

    // Validation : complète l'objectif sans retirer la formulation de l'utilisateur.
    // Une seconde action permet le remplacement si l'utilisateur le souhaite.
    function applyWBEToObjective(mode){
        const input=document.getElementById('f-objLecon');
        const repere=String(wbeValidatedState.hit||'').trim();
        if(!input||!repere)return;
        const original=String(input.value||'').trim();
        let value=repere;
        if(mode==='append' && original){
            const nOriginal=normalizeIndicatorText(original), nRepere=normalizeIndicatorText(repere);
            value=nOriginal===nRepere || nOriginal.includes(nRepere) ? original : `${original} — ${repere}`;
        }
        input.value=value;
        const preserved={hit:wbeValidatedState.hit,kind:wbeValidatedState.kind,bridgeId:wbeValidatedState.bridgeId,indicatorIds:[...(wbeValidatedState.indicatorIds||[])],sourceLabel:wbeValidatedState.sourceLabel||''};
        updateObservationSuggestions();
        if(preserved.hit){
            const subject=document.getElementById('f-matiere')?.value||'';
            wbeValidatedState={signature:wbePredictionSignature(input.value,subject),...preserved,appliedToObjective:true};
            renderWBEObjectivePrediction(input.value,subject);
            renderQ3ValidatedWBE();
            renderQ3Library({student:document.getElementById('f-eleve')?.value||'',subject,level:document.getElementById('f-niveau')?.value||'',form:document.getElementById('f-forme')?.value||'',objective:input.value});
        }
        input.focus();
        try{ input.setSelectionRange(input.value.length,input.value.length); }catch(e){/* champ d'entrée sans prise en charge de la sélection */}
    }

    function renderWBEObjectivePrediction(objective,subject){
        const host=document.getElementById('wbe-objective-prediction');
        if(!host)return;
        const signature=wbePredictionSignature(objective,subject);
        if(wbeValidatedState.signature!==signature) wbeValidatedState={signature:'',hit:'',kind:'',bridgeId:'',indicatorIds:[],sourceLabel:'',appliedToObjective:false};
        const rows=wbePredictionCandidates(objective,subject);
        if(!rows.length){
            host.innerHTML=objective.trim()?'<div class="wbe-prediction-card"><div class="wbe-prediction-title">Repère WBE</div><div class="wbe-prediction-help">Aucune notion suffisamment précise détectée pour le moment. Les indicateurs Q3 restent disponibles à partir de ton objectif libre.</div></div>':'';
            host.classList.toggle('hidden',!objective.trim());
            renderQ3ValidatedWBE();
            return;
        }
        const selected=wbeStateMatchesCurrent(objective,subject)?wbeValidatedState.hit:'';
        const active=selected ? (rows.find(r=>r.hit===selected)||rows[0]) : rows[0];
        const confidence=active.score>=90?'forte':active.score>=68?'bonne':'à confirmer';
        let html='<div class="wbe-prediction-card">';
        html+='<div class="wbe-prediction-head"><div class="wbe-prediction-title">Repère WBE proposé</div><span class="wbe-prediction-confidence">Confiance '+escapeHtml(confidence)+'</span></div>';
        html+='<div class="wbe-prediction-main"><strong>'+escapeHtml(active.hit)+'</strong></div>';
        html+='<div class="wbe-prediction-source">'+escapeHtml(active.sourceLabel||'Rapprochement sémantique')+'</div>';
        if(selected){
            html+='<div class="wbe-prediction-active-note"><strong>Repère sélectionné :</strong> '+escapeHtml(active.hit)+' — les indicateurs Q3 sont optimisés avec ce repère, tout en conservant ton objectif libre.</div>';
            html+='<div class="wbe-prediction-actions"><button type="button" class="wbe-prediction-validate" data-wbe-append>Compléter l’objectif avec ce repère</button><button type="button" class="wbe-prediction-secondary" data-wbe-replace>Remplacer l’objectif par ce repère</button></div>';
        }else{
            html+='<div class="wbe-prediction-help">Le repère est une aide facultative : tu peux le sélectionner pour optimiser les indicateurs Q3, ou conserver uniquement ta formulation.</div>';
            html+='<div class="wbe-prediction-actions"><button type="button" class="wbe-prediction-validate" data-wbe-select>Utiliser ce repère</button></div>';
        }
        if(rows.length>1){
            html+='<div class="wbe-prediction-alt"><span style="font-size:.68rem;color:#64748b;align-self:center;">Autres repères :</span>'+rows.slice(0,4).map((r,i)=>'<button type="button" class="wbe-prediction-chip'+(selected===r.hit?' is-active':'')+'" data-wbe-row="'+i+'">'+escapeHtml(r.hit)+'</button>').join('')+'</div>';
        }
        html+='</div>';
        host.innerHTML=html;
        host.querySelector('[data-wbe-select]')?.addEventListener('click',()=>selectWBERepere(active));
        host.querySelector('[data-wbe-append]')?.addEventListener('click',()=>applyWBEToObjective('append'));
        host.querySelector('[data-wbe-replace]')?.addEventListener('click',()=>applyWBEToObjective('replace'));
        host.querySelectorAll('[data-wbe-row]').forEach(btn=>btn.addEventListener('click',()=>{
            const row=rows[Number(btn.dataset.wbeRow)];
            if(row) selectWBERepere(row);
        }));
        host.classList.remove('hidden');
        renderQ3ValidatedWBE();
    }
    function renderQ3ValidatedWBE(){
        const host=document.getElementById('q3-wbe-validated-note');
        if(!host)return;
        if(!wbeValidatedState.hit){host.innerHTML='';host.classList.add('hidden');return;}
        host.innerHTML='<strong>Repère WBE sélectionné :</strong> '+escapeHtml(wbeValidatedState.hit)+' <span style="color:#64748b;">→ les suggestions Q3 sont optimisées avec ce repère. Ta formulation reste libre.</span>';
        host.classList.remove('hidden');
    }

    function scoreLearningIndicator(indicator,context){
        const level=String(context.level||'').trim(), form=String(context.form||'').trim(), subject=indicatorSubjectKey(context.subject), indSubject=indicatorSubjectKey(indicator.matiere), objective=normalizeIndicatorText(context.objective), objectiveTokens=indicatorTokenSet(objective);
        const fields={terrain:indicatorPhraseList(indicator.exemples_formulation_terrain),concepts:indicatorPhraseList(indicator.concepts_rapprochement),keywords:indicatorPhraseList(indicator.mots_cles_rapprochement),actions:indicatorPhraseList(indicator.actions_associees),text:indicatorPhraseList(indicator.texte),domain:indicatorPhraseList(indicator.domaine),subdomain:indicatorPhraseList(indicator.sous_domaine)};
        const details={wbe:0,wbeSequence:0,wbeNotion:0,wbeAlias:0,wbeModule:0,bridgeWBE:0,exactTerrain:0,bridgeConcept:0,concept:0,keyword:0,domain:0,subdomain:0,text:0,action:0,subject:0,level:0,form:0,transverse:0,vaguePenalty:0,genericPenalty:0};
        const currentObjective=document.getElementById('f-objLecon')?.value||'';
        const currentSubject=document.getElementById('f-matiere')?.value||'';
        const validatedActive=wbeStateMatchesCurrent(currentObjective,currentSubject);
        const validatedIds=new Set(wbeValidatedState.indicatorIds||[]);
        // Le repère est un filtre d'optimisation, pas un verrou : les indicateurs
        // cohérents avec l'objectif restent proposés même hors du repère sélectionné.
        const validatedBoost=validatedActive && validatedIds.has(String(indicator.id)) ? 42 : 0;
        if(indSubject===subject)details.subject=24; else if(indicator.matiere==='Domaines transversaux')details.transverse=10; else details.subject=-35;
        if(Array.isArray(indicator.niveaux)&&indicator.niveaux.includes(level))details.level=8;
        if(Array.isArray(indicator.niveaux_preferentiels)&&indicator.niveaux_preferentiels.includes(level))details.level+=4;
        if(Array.isArray(indicator.formes)&&indicator.formes.includes(form))details.form=4;
        if(!objective||indicatorIsAdministrativeObjective(objective)){details.vaguePenalty=objective?100:60;return {score:-details.vaguePenalty,semantic:0,context:details.subject+details.level+details.form+details.transverse,details,confidence:0,strongTier:0,recognized:false};}
        const objectiveMeaningful=indicatorMeaningfulTokens(objective);
        const wb=scoreWBE(indicator,objective);
        details.wbe=wb.score; details.wbeSequence=wb.sequence.score; details.wbeNotion=wb.notion.score; details.wbeAlias=wb.alias.score; details.wbeModule=wb.module.score;
        // Un pont WBE détecté dans l'objectif constitue déjà un signal exploitable,
        // même si l'utilisateur n'a pas encore validé le repère à l'écran.
        const predictedWBEBridges=wbeBridgeMatches(objective,context.subject);
        const matchingBridge=predictedWBEBridges.find(r=>Array.isArray(r.bridge?.indicatorIds)&&r.bridge.indicatorIds.map(String).includes(String(indicator.id)));
        if(matchingBridge) details.bridgeWBE=matchingBridge.score>=90?100:82;
        if(wb.score>=50){ if(wb.sequence.score===wb.score) details.wbeSequence=wb.score; }
        const exactTerrain=indicatorPhraseMatches(objective,fields.terrain); if(exactTerrain.length){const h=exactTerrain[0];details.exactTerrain=h.singleHead?76:100+Math.min(20,h.normalized.length);}
        const bridgeHits=indicatorBridgeMatches(objective); bridgeHits.forEach(({bridge,hit})=>{const bc=indicatorMeaningfulTokens((bridge.concepts||[]).join(' ')),ic=indicatorMeaningfulTokens(fields.concepts.join(' ')),ik=indicatorMeaningfulTokens(fields.keywords.join(' ')),ov=bc.filter(t=>ic.includes(t)||ik.includes(t));if(ov.length)details.bridgeConcept=Math.max(details.bridgeConcept,hit.exact?74:hit.phraseCovered?68:hit.singleHead?62:54+Math.min(16,ov.length*6));});
        const cm=indicatorConceptMatches(objectiveTokens,objective,fields.concepts); cm.slice(0,3).forEach(m=>details.concept+=m.exactPhrase?58:m.singleHead?50:m.overlap>=2?46:0);
        const km=indicatorConceptMatches(objectiveTokens,objective,fields.keywords); km.slice(0,5).forEach(m=>details.keyword+=m.exactPhrase?42:m.singleHead?38:m.overlap>=2?26:0);
        fields.domain.forEach(raw=>{const p=normalizeIndicatorText(raw);if(p&&(objective===p||objective.includes(p)))details.domain+=18;});
        fields.subdomain.forEach(raw=>{const p=normalizeIndicatorText(raw);if(p&&(objective===p||objective.includes(p)))details.subdomain+=20;});
        const textTokens=indicatorTokenSet(fields.text.join(' ')), om=indicatorMorphTokenSet(objective), tm=indicatorMorphTokenSet(fields.text.join(' '));
        const overlap=[...objectiveTokens].filter(t=>textTokens.has(t)).length, morphOverlap=[...om].filter(t=>tm.has(t)).length;
        if((objective.length>=12&&normalizeIndicatorText(fields.text.join(' ')).includes(objective))||(objectiveTokens.size>=3&&(overlap>=Math.ceil(objectiveTokens.size*.75)||morphOverlap>=Math.ceil(om.size*.75))))details.text=52;else details.text=Math.min(12,overlap*3);
        const actionHits=indicatorActionMatches(objective,fields.actions); if(actionHits.length)details.action=Math.min(8,actionHits.length*4);
        if(objectiveMeaningful.length===0)details.vaguePenalty=65; else {const genericCount=[...objectiveTokens].filter(t=>INDICATOR_GENERIC_TOKENS.has(t)).length;if(genericCount>0&&objectiveMeaningful.length<=1)details.genericPenalty=18;if(objectiveMeaningful.length===1&&objectiveMeaningful[0].length<6)details.genericPenalty+=12;}
        const baseSemantic=details.exactTerrain+details.bridgeWBE+details.bridgeConcept+details.concept+details.keyword+details.domain+details.subdomain+details.text+details.action;
        // WBE signal is intentionally dominant only when it is precise (sequence/notion/alias).
        const preciseWBE=Math.max(details.wbeSequence,details.wbeNotion,details.wbeAlias);
        const semantic=baseSemantic+preciseWBE+validatedBoost;
        const contextScore=details.subject+details.level+details.form+details.transverse;
        const score=semantic+contextScore-details.vaguePenalty-details.genericPenalty;
        const aliasStrongWithoutSubject=details.wbeAlias>=68 && (objectiveMeaningful.length>=2 || (objectiveMeaningful.length===1 && objectiveMeaningful[0].length>=8));
        const strongWBE=(details.wbeSequence>=68||details.wbeNotion>=68||(details.wbeAlias>=68&&objectiveMeaningful.length>=2));
        const strongSemantic=strongWBE||details.bridgeWBE>=58||details.exactTerrain>=76||details.bridgeConcept>=62||details.concept>=46||details.keyword>=38||details.text>=52;
        const subjectKnown=Boolean(subject&&Object.keys(INDICATOR_LIBRARY.familles_matieres||{}).some(x=>indicatorSubjectKey(x)===subject));
        const multiSignal=[preciseWBE>=50,details.bridgeWBE>0,details.bridgeConcept>0,details.concept>0,details.keyword>0,details.text>=52].filter(Boolean).length;
        const confidence=strongWBE?4:(strongSemantic?3:(multiSignal>=2?2:0));
        const recognized=Boolean(objective&&!indicatorIsAdministrativeObjective(objective)&&details.vaguePenalty<55&&semantic>=42&&(validatedBoost>0 || (subjectKnown?(confidence>=2):(strongWBE||details.exactTerrain>=100&&details.exactTerrain>=110))));
        let strongTier=0;
        if(details.wbeSequence>=86) strongTier=5;
        else if(details.wbeNotion>=76) strongTier=4;
        else if(details.wbeAlias>=68) strongTier=3;
        else if(details.bridgeWBE>=70 || details.exactTerrain>=100 || details.bridgeConcept>=62) strongTier=3;
        else if(details.concept>=46) strongTier=2;
        details.validatedWBE=validatedBoost;
        return {score,semantic,context:contextScore,details,confidence,strongTier,recognized};
    }
    function getLearningSuggestions(context){
        if(!INDICATOR_LIBRARY||!Array.isArray(INDICATOR_LIBRARY.indicateurs_apprentissage))return [];
        const subject=indicatorSubjectKey(context.subject), families=Object.keys(INDICATOR_LIBRARY.familles_matieres||{}), recognizedSubject=Boolean(subject)&&families.some(x=>indicatorSubjectKey(x)===subject);
        let pool=INDICATOR_LIBRARY.indicateurs_apprentissage.slice();
        if(recognizedSubject)pool=pool.filter(x=>String(x.matiere||'').trim()===subject||String(x.matiere||'').trim()==='Domaines transversaux');
        const ranked=[];
        pool.forEach((x,index)=>{const r=scoreLearningIndicator(x,context);if(r.recognized&&r.semantic>=42&&r.details.vaguePenalty<55)ranked.push({x,score:r.score,semantic:r.semantic,context:r.context,details:r.details,confidence:r.confidence,strongTier:r.strongTier,index});});
        ranked.sort((a,b)=>b.confidence-a.confidence||b.strongTier-a.strongTier||b.score-a.score||b.semantic-a.semantic||b.context-a.context||a.index-b.index);
        const currentObjective=document.getElementById('f-objLecon')?.value||'';
        const currentSubject=document.getElementById('f-matiere')?.value||'';
        const validatedActive=wbeStateMatchesCurrent(currentObjective,currentSubject);
        if(validatedActive && wbeValidatedState.indicatorIds.length){
            const guided=ranked.filter(o=>wbeValidatedState.indicatorIds.includes(String(o.x.id)));
            const others=ranked.filter(o=>!wbeValidatedState.indicatorIds.includes(String(o.x.id)));
            // Les indicateurs liés au repère passent devant, mais les autres
            // correspondances pertinentes à l'objectif restent accessibles.
            return guided.concat(others).map(o=>o.x);
        }
        return ranked.map(o=>o.x);
    }

    function q3IndicatorBubble(indicator, name, hidden=false){
        const id=String(indicator.id||'');
        const text=String(indicator.texte||'');
        const wbe=indicator.referentiel_wbe||{};
        const wbeContext=Array.isArray(wbe.sequences)&&wbe.sequences.length?wbe.sequences.slice(0,2).join(' · '):'';
        const context=[indicator.domaine,indicator.sous_domaine,wbeContext].filter(Boolean).join(' · ');
        return `<label class="ux-bubble q3-library-bubble${hidden?' is-q3-hidden':''}">
            <input type="checkbox" name="${name}" value="${escapeHtml(text)}" data-indicator-id="${escapeHtml(id)}">
            <span class="q3-indicator-text">${escapeHtml(text)}</span>
            ${context?`<span class="q3-indicator-context">${escapeHtml(context)}</span>`:''}
        </label>`;
    }

    function q3AssessmentLabel(value){
        return ['À renforcer','En cours d’appropriation','Maîtrisé'][Number(value)] || 'En cours d’appropriation';
    }

    function rememberQ3AssessmentValues(){
        // Sous le modèle liquide direct (Option B), l'état est maintenu directement dans q3AssessmentState.
        if(window.q3AssessmentState && typeof q3AssessmentState !== 'undefined'){
            Object.assign(q3AssessmentState, window.q3AssessmentState);
        }
    }

    function renderQ3Assessments(options={}){
        const section=document.getElementById('q3-assessment-section');
        if(section){
            section.classList.add('hidden');
            section.style.setProperty('display','none','important');
        }
        if(typeof window.refreshQ3LiquidItems==='function'){
            window.refreshQ3LiquidItems();
        }
    }

    function updateQ3BubbleState(input){
        const bubble=input?.closest('.q3-library-bubble');
        if(bubble) bubble.classList.toggle('is-active',!!input.checked);
        const custom=input?.closest('.q3-custom-item');
        if(custom) custom.classList.toggle('is-active',!!input.checked);

        const id=input?.dataset?.indicatorId || input?.value || '';
        if(input && !input.checked && id){
            delete q3AssessmentState[id];
            if(window.q3AssessmentState) delete window.q3AssessmentState[id];
        }else if(input && input.checked && id){
            if(!Object.prototype.hasOwnProperty.call(q3AssessmentState, id)){
                q3AssessmentState[id] = 1;
            }
            if(!window.q3AssessmentState) window.q3AssessmentState = {};
            window.q3AssessmentState[id] = q3AssessmentState[id];
        }

        renderQ3Assessments({scrollIntoView:false});
    }

    function toggleQ3LearningMore(){
        const btn=document.getElementById('q3-learning-more');
        if(!btn) return;
        const current=Number(btn.dataset.displayLevel||'1');
        btn.dataset.displayLevel=String(current>=3 ? 1 : current+1);
        renderQ3Library({
            level:document.getElementById('f-niveau')?.value||'',
            form:document.getElementById('f-forme')?.value||'',
            subject:document.getElementById('f-matiere')?.value||'',
            objective:document.getElementById('f-objLecon')?.value||''
        });
    }

    function addCustomQ3Indicator(){
        const input=document.getElementById('q3-add-input');
        const value=String(input?.value||'').trim();
        if(!value) return;

        const list=document.getElementById('q3-custom-list');
        if(!list) return;

        const exists=Array.from(document.querySelectorAll('input[name="q3-learning"]')).some(x=>x.value===value);
        if(exists){ input.value=''; return; }

        const safeId=`custom-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const item=document.createElement('label');
        item.className='q3-custom-item is-active';
        item.innerHTML=`<input type="checkbox" name="q3-learning" value="${escapeHtml(value)}" data-indicator-id="${safeId}" checked><span>${escapeHtml(value)}</span>`;
        list.appendChild(item);
        input.value='';
        q3AssessmentState[safeId] = 1;
        if(!window.q3AssessmentState) window.q3AssessmentState = {};
        window.q3AssessmentState[safeId] = 1;
        renderQ3Assessments({scrollIntoView:false});
    }

    function renderQ3CustomList(){
        // Les indicateurs ajoutés manuellement ne sont pas reconstruits par le rendu de la bibliothèque.
    }

    function renderQ3Library(context={}){
        const learningBox=document.getElementById('q3-learning-suggestions');
        const more=document.getElementById('q3-learning-more');
        if(!learningBox) return;

        const signature=JSON.stringify({level:context.level||'',form:context.form||'',subject:context.subject||'',objective:context.objective||''});
        if(more && more.dataset.q3ContextSignature!==signature){
            more.dataset.q3ContextSignature=signature;
            more.dataset.displayLevel='1';
        }

        if(INDICATOR_LIBRARY_STATUS!=='loaded'){
            learningBox.innerHTML='';
            if(more) more.classList.add('hidden');
            return;
        }

        const selectedLearning=q3CurrentSelections('q3-learning');
        const ranked=getLearningSuggestions(context);
        JOURNALIER_DIAGNOSTICS.q3.suggestions=ranked.length;
        updateIndicatorDiagnosticPanel();

        // Q3 utilise une divulgation progressive : 4, puis 8, puis le reste.
        // La sélection ne modifie jamais automatiquement le niveau d'affichage.
        const initialCount=4;
        const secondCount=8;
        let displayLevel=Number(more?.dataset.displayLevel||'1');
        if(![1,2,3].includes(displayLevel)) displayLevel=1;
        const visibleCount=displayLevel===1 ? Math.min(initialCount,ranked.length)
            : displayLevel===2 ? Math.min(secondCount,ranked.length)
            : ranked.length;

        learningBox.innerHTML=ranked.map((ind,i)=>q3IndicatorBubble(ind,'q3-learning',i>=visibleCount)).join('');

        learningBox.querySelectorAll('input[name="q3-learning"]').forEach(cb=>{
            const id=cb.dataset.indicatorId || cb.value;
            const isSelected=selectedLearning.has(id) || selectedLearning.has(cb.value);
            cb.checked=isSelected;
            const bubble=cb.closest('.q3-library-bubble');
            if(bubble) bubble.classList.toggle('is-active',isSelected);
        });

        if(more){
            more.classList.toggle('hidden', ranked.length<=initialCount);
            more.dataset.displayLevel=String(displayLevel);
            if(ranked.length<=initialCount){
                more.textContent='';
            }else if(displayLevel===1){
                more.textContent='Afficher 4 suggestions supplémentaires';
            }else if(displayLevel===2){
                const remaining=Math.max(0,ranked.length-secondCount);
                more.textContent=remaining>0 ? `Afficher le reste des suggestions (${remaining})` : 'Réduire';
            }else{
                more.textContent='Réduire';
            }
        }

        renderQ3CustomList();
        renderQ3Assessments();
    }

    function updateObservationSuggestions() {
        const student = document.getElementById('f-eleve')?.value;
        const subject = document.getElementById('f-matiere')?.value || '';
        const level = document.getElementById('f-niveau')?.value || '';
        const form = document.getElementById('f-forme')?.value || '';
        const objective = document.getElementById('f-objLecon')?.value || '';

        JOURNALIER_DIAGNOSTICS.q3={
            ...JOURNALIER_DIAGNOSTICS.q3,
            objective, subject, level, form
        };
        updateIndicatorDiagnosticPanel();

        // Repère contextuel existant.
        const boxId = 'v11-last-context-note';
        let box = document.getElementById(boxId);
        if (!box) {
            box = document.createElement('div');
            box.id = boxId;
            box.className = 'v11-mini-tag';
            box.style.marginTop = '10px';
            const target = document.getElementById('pia-widget-box');
            target?.parentNode?.insertBefore(box, target.nextSibling);
        }
        const logs = getDB().filter(l => isJournalSession(l) && sessionParts(l).eleve === student).sort((a,b) => sessionSortKey(b).localeCompare(sessionSortKey(a)));
        const last = logs[0];
        if (last && (last.objectif?.objectifProfessionnel || last.objectif?.objectifLecon)) {
            box.textContent = `Dernier axe encodé : ${last.objectif?.objectifProfessionnel || last.objectif?.objectifLecon || '—'}`;
            box.classList.remove('hidden');
        } else {
            box.classList.add('hidden');
        }

        renderWBEObjectivePrediction(objective,subject);
        renderQ3Library({student,subject,level,form,objective});
    }

    function renderQ4EffectSliders(){
        const box=document.getElementById('q4-effect-sliders');
        if(!box) return;
        const selected=[...document.querySelectorAll('input[name="q4-type"]:checked')];
        const existing={};
        box.querySelectorAll('input[type="range"]').forEach(r=>{ if(!window.JournalierLevels.isUnset(r)) existing[r.dataset.type]=r.value; });
        box.innerHTML='';
        selected.forEach(input=>{
            const type=input.value;
            const item=document.createElement('div');
            item.className='q4-effect-item';
            item.dataset.type=type;
            const name=document.createElement('span');
            name.className='q4-effect-label';
            name.textContent=type;
            const range=document.createElement('input');
            range.type='range';range.min='0';range.max='2';range.step='1';range.hidden=true;
            range.dataset.type=type;
            item.appendChild(name);
            item.appendChild(range);
            item.appendChild(window.JournalierLevels.buildEffect(range,type,existing[type]));
            box.appendChild(item);
        });
    }
    function getQ4EffectMap(){
        const out={};
        document.querySelectorAll('#q4-effect-sliders input[type="range"]').forEach(r=>{
            if(!window.JournalierLevels.isUnset(r)) out[r.dataset.type]=Number(r.value);
        });
        return out;
    }
    function initQ4Effects(){
        document.querySelectorAll('input[name="q4-type"]').forEach(input=>input.addEventListener('change',renderQ4EffectSliders));
        renderQ4EffectSliders();
    }

    function initQ2Levels(){ if(window.JournalierLevels) window.JournalierLevels.initQ2(); }
    const sessionForm = document.getElementById('observationForm');
    // Un seul point d'entrée pour l'enregistrement : le submit du formulaire.
    // Le bouton est type="submit", donc un clic déclenche naturellement cet événement.
    // Éviter un second listener "click" empêche une double exécution et un second
    // passage sur un formulaire déjà réinitialisé.
    if (sessionForm) sessionForm.addEventListener('submit', handleSessionSave);

    initQ2Levels();
    initQ4Effects();
    updateObservationSuggestions();

    // V60 — enregistrement explicite et vérifiable.
    // Le bouton est également relié directement afin que la sauvegarde ne dépende
    // pas uniquement du comportement submit natif du navigateur.
    function handleSessionSave(e){
        if(e)e.preventDefault();
        const form=document.getElementById('observationForm');
        if(!form)return;
        if(!form.checkValidity()){form.reportValidity();return;}

        const student=document.getElementById('f-eleve')?.value||'',
              date=document.getElementById('f-date')?.value||'',
              start=document.getElementById('f-periode-start')?.value||'',
              end=document.getElementById('f-periode-end')?.value||'',
              subjectInput=document.getElementById('f-matiere'),
              matiere=String(subjectInput?.value||'').trim();
        if(!student||!date||!start||!end||!matiere){
            alert(!matiere?'Merci de sélectionner ou de saisir une matière.':'Merci de compléter au minimum l’élève, la date et la période.');
            if(!matiere)subjectInput?.focus();
            return;
        }

        const presenceNow=document.getElementById('f-presence-status')?.value||'present';
        if(presenceNow==='present'){
            const manque=window.JournalierLevels.missing();
            if(manque.length){
                manque[0].el.closest('.apple-session-step-card')?.classList.remove('is-step-collapsed');
                manque[0].el.scrollIntoView({block:'center',behavior:'smooth'});
                const noms=manque.slice(0,3).map(m=>'« '+m.label+' »').join(', ');
                showAppToast('Choisir un niveau pour : '+noms+(manque.length>3?' …':'')+'.','error',6000);
                return;
            }
        }

        const cats={'q2-comprehension':'Compréhension / traitement','q2-organisation':'Organisation / fonctions exécutives','q2-realisation':'Réalisation','q2-aide':'Rapport à l’aide / engagement'};
        const q2=Array.from(document.querySelectorAll('.q2-observation-item'))
            .filter(x=>x.querySelector('input[type="checkbox"]')?.checked)
            .map(x=>{
                const c=x.querySelector('input[type="checkbox"]'),r=x.querySelector('input[type="range"]');
                return {categorie:cats[c?.name]||c?.name||'',observation:c?.value||'',niveau:Number(r?.value??0)};
            });

        rememberQ3AssessmentValues();
        const q3=Array.from(document.querySelectorAll('input[name="q3-learning"]:checked')).map(c=>{
            const id=String(c.dataset.indicatorId||c.value||''),
                  lib=resolveLibraryIndicator(id);
            return {
                id:lib?.id?String(lib.id):(id.startsWith('MANUEL-')?id:`MANUEL-${id}`),
                texte:String(c.value||''),
                source:lib?'bibliotheque':'manuel',
                appreciation:Number(q3AssessmentState[id]??1)
            };
        });

        const now=new Date().toISOString();
        const isEditing=!!editingSessionId;
        const existing=isEditing ? getDB().find(x=>String(x.id)===String(editingSessionId)) : null;
        if(isEditing && (!existing || !isJournalSession(existing))){
            editingSessionId=null;
            const saveButton=document.getElementById('save-session-btn');
            if(saveButton)saveButton.textContent='💾 Enregistrer la séance';
            showAppToast('⚠️ La séance à modifier est introuvable.','error',5000);
            return;
        }

        const presenceStatus=document.getElementById('f-presence-status')?.value||'present';
        const classNotes=document.getElementById('f-classNotes')?.value.trim()||'';
        const isStudentPresent=presenceStatus==='present';
        const isCoteach=presenceStatus==='absent_eleve_coteach';
        const rawObjLecon=document.getElementById('f-objLecon')?.value.trim()||'';
        const fallbackObjLecon=presenceStatus==='absent_eleve'?'Élève absent — Séance non tenue':presenceStatus==='absent_prof'?'Professeur absent / Cours annulé':presenceStatus==='absent_agent'?'Agent du pôle absent':isCoteach?'Co-enseignement en classe':'';

        const newEntry={
            ...(existing||{}),
            id:isEditing ? existing.id : Date.now()+Math.floor(Math.random()*1000),
            schemaVersion:JOURNALIER_ARCHITECTURE_VERSION,
            type:'SEANCE',
            identification:{eleve:student,date,periode:{start,end}},
            contexte:{
                matiere,
                niveau:document.getElementById('f-niveau')?.value||'',
                forme:document.getElementById('f-forme')?.value||'',
                typeIntervention:getCheckedValues('f-type-interv'),
                presenceStatus,
                classNotes
            },
            objectif:{
                objectifLecon:rawObjLecon||fallbackObjLecon,
                objectifProfessionnel:document.getElementById('f-objAgent')?.value.trim()||''
            },
            q2:isStudentPresent?{observations:q2,precision:document.getElementById('f-q2-txt')?.value.trim()||''}:{observations:[],precision:''},
            q3:(isStudentPresent||isCoteach)?{repereWBE:{signature:wbeValidatedState.signature||'',hit:wbeValidatedState.hit||'',kind:wbeValidatedState.kind||'',bridgeId:wbeValidatedState.bridgeId||'',indicatorIds:[...(wbeValidatedState.indicatorIds||[])],source:wbeValidatedState.sourceLabel||''},indicateurs:isStudentPresent?q3:[],precision:document.getElementById('f-q3-txt')?.value.trim()||''}:{repereWBE:{signature:'',hit:'',kind:'',bridgeId:'',indicatorIds:[],source:''},indicateurs:[],precision:''},
            q4:isStudentPresent?{situation:document.getElementById('q4-status-value')?.value||'none',types:getCheckedValues('q4-type'),effets:getQ4EffectMap(),precision:document.getElementById('f-q4-txt')?.value.trim()||''}:{situation:'none',types:[],effets:{},precision:''},
            q5:isStudentPresent?{statut:document.getElementById('q5-transfer-value')?.value||'',precision:document.getElementById('f-q5-txt')?.value.trim()||''}:{statut:'',precision:''},
            q6:{actions:getCheckedValues('q6-action'),modalite:document.getElementById('q6-modality-value')?.value||'',objectif:document.getElementById('q6-objective-value')?.value||'',collaborations:getCheckedValues('q6-collab'),precision:document.getElementById('f-q6-txt')?.value.trim()||''},
            metadata:{createdAt:existing?.metadata?.createdAt||now,updatedAt:now}
        };

        try{
            persistSessionEntry(newEntry);
            selectedDateISO=date;
            closeAllChoiceMenus();
            clearObservationForm();
            updateStudentDropdowns();
            renderStudentsView();
            const profileModal=document.getElementById('studentProfileModal');
            if(profileModal&&!profileModal.classList.contains('hidden')){
                const updatedStudent=getStudents().find(s=>String(s.nom)===String(student));
                if(updatedStudent)openStudentProfile(updatedStudent.id);
                else closeStudentProfile();
            }
            const rs=document.getElementById('r-eleve');
            if(rs&&rs.value!==student){rs.value=student;rs.dispatchEvent(new CustomEvent('journalier:student-context-change',{bubbles:true}));}
            loadStudentHistory();
            showTab('form');
            showSessionSaveConfirmation(newEntry);
            showAppToast(isEditing ? `✓ Séance modifiée pour ${student}.` : `✓ Séance enregistrée pour ${student}. Vous pouvez encoder la suivante.`, 'success', 4200);
        }catch(err){
            console.error(isEditing?'Modification de la séance impossible':'Enregistrement de la séance impossible',err);
            showAppToast(isEditing?'⚠️ La séance n’a pas pu être modifiée. Aucun changement n’a été validé.':'⚠️ La séance n’a pas pu être enregistrée. Aucun changement n’a été validé.','error',5000);
            alert(isEditing?'La séance n’a pas pu être modifiée. Aucun changement n’a été validé.':'La séance n’a pas pu être enregistrée. Aucun changement n’a été validé.');
        }
    }

    let studentGroupMode = 'all';

    function renderStudentBentoCard(s, db, piaRecords) {
        return window.JournalierStudents?.renderStudentBentoCard?.(s, db, piaRecords);
    }

    function renderStudentsView() {
        return window.JournalierStudents?.renderStudentsView?.();
    }

    function openStudentProfile(id) {
        return window.JournalierStudents?.openStudentProfile?.(id);
    }

    function closeStudentProfile() {
        return window.JournalierStudents?.closeStudentProfile?.();
    }

    function openAddStudentModal() {
        return window.JournalierStudents?.openAddStudentModal?.();
    }

    function openEditStudentModal(id) {
        return window.JournalierStudents?.openEditStudentModal?.(id);
    }

    function closeStudentModal() {
        return window.JournalierStudents?.closeStudentModal?.();
    }

    function showPIAImportName(input) {
        return window.JournalierStudents?.showPIAImportName?.(input);
    }

    function saveStudent(e) {
        return window.JournalierStudents?.saveStudent?.(e);
    }

    function deleteStudent(id) {
        return window.JournalierStudents?.deleteStudent?.(id);
    }

    function escapeHtml(value) {
        if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function' && window.escapeHtml !== escapeHtml) {
            return window.escapeHtml(value);
        }
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    const HISTORY_Q2_LEVEL_LABELS = Object.freeze(['Partiellement', 'Suffisamment', 'Totalement']);
    const HISTORY_Q4_EFFECT_LABELS = Object.freeze(['Aucun effet', 'Effet partiel', 'Effet positif']);

    function resolveIndexedLabel(value, labels, fallbackPrefix = 'Niveau encodé : ') {
        if(value===null||value===undefined||value==='')return '';
        const level=Number(value);
        return Number.isInteger(level)&&level>=0&&level<labels.length
            ? labels[level]
            : `${fallbackPrefix}${String(value)}`;
    }

    function historyQ2LevelLabel(value){
        return resolveIndexedLabel(value, HISTORY_Q2_LEVEL_LABELS);
    }

    function historyQ4EffectLabel(value){
        return resolveIndexedLabel(value, HISTORY_Q4_EFFECT_LABELS);
    }

    const HISTORY_Q5_TRANSFER_LABELS = Object.freeze({
        observed: 'Observé',
        not_observed: 'Non observé',
        no_opportunity: 'Pas d’occasion',
        later: 'À observer plus tard',
        not_relevant: 'Non pertinent'
    });

    function historyQ5TransferLabel(value){
        const raw = String(value ?? '').trim();
        if(!raw) return '';
        return HISTORY_Q5_TRANSFER_LABELS[raw] || raw;
    }

    function renderHistoryDetail(entry){
        return window.JournalierStudents?.renderHistoryDetail?.(entry);
    }

    function loadStudentHistory(){
        return window.JournalierStudents?.loadStudentHistory?.();
    }

    function editHistorySession(sessionId){
        const id=String(sessionId||'');
        const entry=getDB().find(x=>String(x.id)===id);
        if(!entry || !isJournalSession(entry)){
            showAppToast('⚠️ La séance à modifier est introuvable.','error',5000);
            return;
        }

        const p=sessionParts(entry);
        editingSessionId=String(entry.id);
        clearObservationForm();
        editingSessionId=String(entry.id);

        const saveButton=document.getElementById('save-session-btn');
        if(saveButton)saveButton.textContent='💾 Enregistrer les modifications';

        const setValue=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value??'';};
        setValue('f-date',p.date);
        setValue('f-periode-start',p.start);
        setValue('f-periode-end',p.end);
        syncSessionPeriodRange();
        setValue('f-eleve',p.eleve);
        setValue('f-matiere',p.matiere);
        const subjectInput=document.getElementById('f-matiere');
        if(subjectInput)subjectInput.dataset.selectedSubject=p.matiere||'';
        const subjectNote=document.getElementById('session-subject-selected-note');
        if(subjectNote)subjectNote.textContent=p.matiere?`Matière sélectionnée : ${p.matiere}`:'Les matières principales du dossier sont proposées en priorité. Vous pouvez aussi saisir librement une autre matière.';

        const ctx=entry.contexte||{},obj=entry.objectif||{},q2=entry.q2||{},q3=entry.q3||{},q4=entry.q4||{},q5=entry.q5||{},q6=entry.q6||{};
        setValue('f-niveau',ctx.niveau||'');
        setValue('f-forme',ctx.forme||'');
        setValue('f-objLecon',obj.objectifLecon||'');
        setValue('f-objAgent',obj.objectifProfessionnel||'');
        setValue('f-classNotes',getSessionClassNotes(entry));
        window.setSessionPresenceMode?.(getSessionPresenceStatus(entry));
        setValue('f-q2-txt',q2.precision||'');
        setValue('f-q3-txt',q3.precision||'');
        setValue('f-q4-txt',q4.precision||'');
        setValue('f-q5-txt',q5.precision||'');
        setValue('f-q6-txt',q6.precision||'');
        setValue('q4-status-value',q4.situation||'none');
        setValue('q5-transfer-value',q5.statut||'');
        setValue('q6-modality-value',q6.modalite||'');
        setValue('q6-objective-value',q6.objectif||'');

        // Q2 : restaurer les observations et leur niveau.
        document.querySelectorAll('.q2-observation-item').forEach(item=>{
            const cb=item.querySelector('input[type="checkbox"]');
            const range=item.querySelector('input[type="range"]');
            if(!cb||!range)return;
            const found=(q2.observations||[]).find(x=>String(x.observation||'')===String(cb.value||''));
            cb.checked=!!found;
            if(found){range.value=String(found.niveau??1);delete range.dataset.unset;}
            else{range.value='1';range.dataset.unset='1';}
            item.classList.toggle('is-observed',cb.checked);
        });
        window.JournalierLevels.syncQ2();

        // Q4 / Q6 : restaurer les choix à bulles et leurs résumés.
        const checkedMap={
            'q4-type':new Set(q4.types||[]),
            'q6-action':new Set(q6.actions||[]),
            'q6-collab':new Set(q6.collaborations||[]),
            'f-type-interv':new Set(ctx.typeIntervention||[])
        };
        Object.entries(checkedMap).forEach(([name,set])=>{
            document.querySelectorAll(`input[name="${name}"]`).forEach(cb=>{cb.checked=set.has(cb.value);});
        });
        updateMultiSelectSummary('q4-types-select','q4-type');
        updateMultiSelectSummary('q6-collab-select','q6-collab');
        syncBubbleSelects();
        syncBubbleCheckboxStates();
        renderQ4EffectSliders();
        Object.entries(q4.effets||{}).forEach(([type,value])=>{
            const range=document.querySelector(`#q4-effect-sliders input[data-type="${CSS.escape(String(type))}"]`);
            if(range){range.value=String(value);delete range.dataset.unset;range.__lvl&&range.__lvl.sync();}
        });

        // Repère WBE associé à la séance.
        const rw=q3.repereWBE||{};
        wbeValidatedState={signature:rw.signature||'',hit:rw.hit||'',kind:rw.kind||'',bridgeId:rw.bridgeId||'',indicatorIds:[...(rw.indicatorIds||[])],sourceLabel:rw.source||'',appliedToObjective:!!rw.signature};
        renderQ3ValidatedWBE();

        // Q3 : reconstruire les sélections de la bibliothèque et les indicateurs manuels.
        q3AssessmentState={};
        (q3.indicateurs||[]).forEach(ind=>{
            const id=String(ind.id||'');
            q3AssessmentState[id]=Number(ind.appreciation??1);
        });
        const customList=document.getElementById('q3-custom-list');
        if(customList)customList.innerHTML='';
        const libraryIds=new Set((INDICATOR_LIBRARY?.indicateurs_apprentissage||[]).map(x=>String(x.id||'')));
        (q3.indicateurs||[]).filter(ind=>!libraryIds.has(String(ind.id||''))).forEach(ind=>{
            const id=String(ind.id||`custom-${Date.now()}-${Math.floor(Math.random()*1000)}`);
            const item=document.createElement('label');
            item.className='q3-custom-item is-active';
            item.innerHTML=`<input type="checkbox" name="q3-learning" value="${escapeHtml(String(ind.texte||''))}" data-indicator-id="${escapeHtml(id)}" checked><span>${escapeHtml(String(ind.texte||''))}</span>`;
            customList?.appendChild(item);
        });

        const renderEditedQ3=()=>{
            renderQ3Library({
                level:document.getElementById('f-niveau')?.value||'',
                form:document.getElementById('f-forme')?.value||'',
                subject:document.getElementById('f-matiere')?.value||'',
                objective:document.getElementById('f-objLecon')?.value||''
            });
            const selected=(q3.indicateurs||[]).filter(ind=>libraryIds.has(String(ind.id||'')));
            selected.forEach(ind=>{
                const id=String(ind.id||'');
                let cb=document.querySelector(`input[name="q3-learning"][data-indicator-id="${CSS.escape(id)}"]`);
                if(!cb){
                    const lib=resolveLibraryIndicator(id);
                    if(lib){
                        const box=document.getElementById('q3-learning-suggestions');
                        if(box){
                            const temp=document.createElement('div');
                            temp.innerHTML=q3IndicatorBubble(lib,'q3-learning',false);
                            const created=temp.firstElementChild;
                            if(created){box.appendChild(created);cb=created.querySelector('input[name="q3-learning"]');}
                        }
                    }
                }
                if(cb){
                    cb.checked=true;
                    const bubble=cb.closest('.q3-library-bubble');
                    if(bubble)bubble.classList.add('is-active');
                }
            });
            renderQ3Assessments();
        };
        if(INDICATOR_LIBRARY_STATUS==='loaded') renderEditedQ3();
        else setTimeout(()=>{if(INDICATOR_LIBRARY_STATUS==='loaded')renderEditedQ3();},250);

        updateObservationSuggestions();
        updatePIAPrompt();
        renderSessionMainSubjectBubbles();
        closeAllChoiceMenus();
        showTab('form');
        // showTab('form') reconstruit les listes d'élèves. Réappliquer ensuite
        // la référence historique, y compris si l'ancien élève n'existe plus.
        prepareEditingStudentSelection(entry);
        refreshSessionSubjectsForStudent();
        renderSessionMainSubjectBubbles();
        updatePIAPrompt();
        window.scrollTo({top:0,behavior:'smooth'});
        showAppToast('✏️ Séance chargée pour modification.','success',3000);
    }

    function syncAgendaAfterSessionDelete(entry){
        // Une séance supprimée de l'Historique ne doit plus être projetée comme
        // Réalisée. Les événements planifiés persistants restent inchangés.
        return;
    }

    function deleteHistorySession(sessionId){
        const id=String(sessionId||'');
        const entry=getDB().find(x=>String(x.id)===id);
        if(!entry)return;
        const p=sessionParts(entry);
        const label=[p.eleve,p.matiere,p.date,sessionPeriodLabel(entry)].filter(Boolean).join(' · ');
        if(!confirm(`Supprimer définitivement cet encodage de l’historique ?\n\n${label}`))return;
        try{
            saveDB(getDB().filter(x=>String(x.id)!==id));
            syncAgendaAfterSessionDelete(entry);
            updateStudentDropdowns();
            loadStudentHistory();
            updateStats();
            renderAgenda?.();
            showAppToast('✓ Encodage supprimé de l’historique.','success',4200);
        }catch(err){
            console.error('Suppression de la séance impossible',err);
            showAppToast('⚠️ La séance n’a pas pu être supprimée.','error',5000);
        }
    }

    // --- Exports du module JournalierSessions ---
    const JournalierSessions = {
        sessionParts,
        sessionPeriodLabel,
        sessionSortKey,
        isSameStudentSessionSlot,
        getCheckedValues,
        showSessionSaveConfirmation,
        persistSessionEntry,
        syncAgendaAfterSessionSave,
        clearObservationForm,
        normalizeSubjectList,
        getStudentByName,
        subjectOptionsForSelection,
        renderStudentSubjectOptions,
        toggleStudentSubject,
        updateStudentSubjectsSummary,
        filterStudentSubjects,
        initStudentSubjects,
        updateMultiSelectSummary,
        toggleMultiSelect,
        closeAllChoiceMenus,
        renderSessionSubjectMenu,
        openSessionSubjectMenu,
        filterSessionSubjects,
        chooseSessionSubject,
        refreshSessionSubjectsForStudent,
        normalizeIndicatorText,
        indicatorTokens,
        indicatorSubjectKey,
        q3CurrentSelections,
        indicatorPhraseList,
        indicatorTokenSet,
        indicatorMorphToken,
        indicatorMorphTokenSet,
        indicatorMeaningfulTokens,
        indicatorIsAdministrativeObjective,
        indicatorPhraseMatches,
        indicatorConceptMatches,
        resolveLibraryIndicator,
        indicatorActionMatches,
        indicatorBridgeMatches,
        wbeBridgeMatches,
        wbeIndicatorFields,
        wbePhraseScore,
        scoreWBE,
        wbePredictionSignature,
        wbePredictionCandidates,
        wbeStateMatchesCurrent,
        selectWBERepere,
        applyWBEToObjective,
        renderWBEObjectivePrediction,
        renderQ3ValidatedWBE,
        scoreLearningIndicator,
        getLearningSuggestions,
        q3IndicatorBubble,
        q3AssessmentLabel,
        rememberQ3AssessmentValues,
        renderQ3Assessments,
        updateQ3BubbleState,
        toggleQ3LearningMore,
        addCustomQ3Indicator,
        renderQ3CustomList,
        renderQ3Library,
        updateObservationSuggestions,
        renderQ4EffectSliders,
        getQ4EffectMap,
        initQ4Effects,
        initQ2Levels,
        handleSessionSave,
        resolveIndexedLabel,
        historyQ2LevelLabel,
        historyQ4EffectLabel,
        historyQ5TransferLabel,
        renderHistoryDetail,
        editHistorySession,
        syncAgendaAfterSessionDelete,
        deleteHistorySession
    };

    if (typeof window !== 'undefined') {
        window.JournalierSessions = JournalierSessions;
        window.sessionParts = sessionParts;
        window.sessionPeriodLabel = sessionPeriodLabel;
        window.sessionSortKey = sessionSortKey;
        window.isSameStudentSessionSlot = isSameStudentSessionSlot;
        window.getCheckedValues = getCheckedValues;
        window.showSessionSaveConfirmation = showSessionSaveConfirmation;
        window.persistSessionEntry = persistSessionEntry;
        window.syncAgendaAfterSessionSave = syncAgendaAfterSessionSave;
        window.clearObservationForm = clearObservationForm;
        window.normalizeSubjectList = normalizeSubjectList;
        window.getStudentByName = getStudentByName;
        window.subjectOptionsForSelection = subjectOptionsForSelection;
        window.renderStudentSubjectOptions = renderStudentSubjectOptions;
        window.toggleStudentSubject = toggleStudentSubject;
        window.updateStudentSubjectsSummary = updateStudentSubjectsSummary;
        window.filterStudentSubjects = filterStudentSubjects;
        window.initStudentSubjects = initStudentSubjects;
        window.updateMultiSelectSummary = updateMultiSelectSummary;
        window.toggleMultiSelect = toggleMultiSelect;
        window.closeAllChoiceMenus = closeAllChoiceMenus;
        window.renderSessionSubjectMenu = renderSessionSubjectMenu;
        window.openSessionSubjectMenu = openSessionSubjectMenu;
        window.filterSessionSubjects = filterSessionSubjects;
        window.chooseSessionSubject = chooseSessionSubject;
        window.refreshSessionSubjectsForStudent = refreshSessionSubjectsForStudent;
        window.normalizeIndicatorText = normalizeIndicatorText;
        window.indicatorTokens = indicatorTokens;
        window.indicatorSubjectKey = indicatorSubjectKey;
        window.q3CurrentSelections = q3CurrentSelections;
        window.indicatorPhraseList = indicatorPhraseList;
        window.indicatorTokenSet = indicatorTokenSet;
        window.indicatorMorphToken = indicatorMorphToken;
        window.indicatorMorphTokenSet = indicatorMorphTokenSet;
        window.indicatorMeaningfulTokens = indicatorMeaningfulTokens;
        window.indicatorIsAdministrativeObjective = indicatorIsAdministrativeObjective;
        window.indicatorPhraseMatches = indicatorPhraseMatches;
        window.indicatorConceptMatches = indicatorConceptMatches;
        window.resolveLibraryIndicator = resolveLibraryIndicator;
        window.indicatorActionMatches = indicatorActionMatches;
        window.indicatorBridgeMatches = indicatorBridgeMatches;
        window.wbeBridgeMatches = wbeBridgeMatches;
        window.wbeIndicatorFields = wbeIndicatorFields;
        window.wbePhraseScore = wbePhraseScore;
        window.scoreWBE = scoreWBE;
        window.wbePredictionSignature = wbePredictionSignature;
        window.wbePredictionCandidates = wbePredictionCandidates;
        window.wbeStateMatchesCurrent = wbeStateMatchesCurrent;
        window.selectWBERepere = selectWBERepere;
        window.applyWBEToObjective = applyWBEToObjective;
        window.renderWBEObjectivePrediction = renderWBEObjectivePrediction;
        window.renderQ3ValidatedWBE = renderQ3ValidatedWBE;
        window.scoreLearningIndicator = scoreLearningIndicator;
        window.getLearningSuggestions = getLearningSuggestions;
        window.q3IndicatorBubble = q3IndicatorBubble;
        window.q3AssessmentLabel = q3AssessmentLabel;
        window.rememberQ3AssessmentValues = rememberQ3AssessmentValues;
        window.renderQ3Assessments = renderQ3Assessments;
        window.updateQ3BubbleState = updateQ3BubbleState;
        window.toggleQ3LearningMore = toggleQ3LearningMore;
        window.addCustomQ3Indicator = addCustomQ3Indicator;
        window.renderQ3CustomList = renderQ3CustomList;
        window.renderQ3Library = renderQ3Library;
        window.updateObservationSuggestions = updateObservationSuggestions;
        window.renderQ4EffectSliders = renderQ4EffectSliders;
        window.getQ4EffectMap = getQ4EffectMap;
        window.initQ4Effects = initQ4Effects;
        window.initQ2Levels = initQ2Levels;
        window.handleSessionSave = handleSessionSave;
        window.resolveIndexedLabel = resolveIndexedLabel;
        window.historyQ2LevelLabel = historyQ2LevelLabel;
        window.historyQ4EffectLabel = historyQ4EffectLabel;
        window.historyQ5TransferLabel = historyQ5TransferLabel;
        window.renderHistoryDetail = renderHistoryDetail;
        window.editHistorySession = editHistorySession;
        window.syncAgendaAfterSessionDelete = syncAgendaAfterSessionDelete;
        window.deleteHistorySession = deleteHistorySession;
    }

    if (typeof global !== 'undefined') {
        global.JournalierSessions = JournalierSessions;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.JournalierSessions = JournalierSessions;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
