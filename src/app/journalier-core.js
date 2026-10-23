/* =========================================================
   JOURNALIER V74 — CORE RUNTIME (ORCHESTRATION & BOOTSTRAP)
   Lots 3.1 à 3.7 : Modules extraits dans :
   - src/app/storage-vault.js   (Lot 3.1)
   - src/v74/v74-docx-export.js (Lot 3.2)
   - src/v74/v74-pdf-export.js  (Lot 3.3)
   - src/app/reports-core.js    (Lot 3.4)
   - src/app/students-core.js   (Lot 3.5)
   - src/app/agenda-core.js     (Lot 3.6)
   - src/app/sessions-core.js   (Lot 3.7)
   ========================================================= */

/* =========================================================
   JOURNALIER V74 — CORE RUNTIME (SESSIONS & ORCHESTRATION)
   Lot 3.6 : Agenda extrait dans src/app/agenda-core.js
   ========================================================= */

    /* =========================================================
       JOURNALIER V74 — SECURITY / IDENTITY / DATA STORE
       Module extrait dans : src/app/storage-vault.js (Lot 3.1)
       ========================================================= */
    /* AUTO-LOCK — verrouillage mémoire après inactivité.
       Les données restent dans IndexedDB sous forme chiffrée AES-GCM.
       Le verrouillage n'efface pas le compte Microsoft ni les données distantes.
    */
    const JOURNALIER_AUTOLOCK_MS=15*60*1000;
    const JOURNALIER_AUTOLOCK_WARNING_MS=60*1000;
    let journalierAutoLockTimer=null, journalierAutoLockWarningTimer=null, journalierLastActivity=Date.now(), journalierLockedByTimeout=false;

    function journalierClearAutoLockTimers(){
        if(journalierAutoLockTimer)clearTimeout(journalierAutoLockTimer);
        if(journalierAutoLockWarningTimer)clearTimeout(journalierAutoLockWarningTimer);
        journalierAutoLockTimer=null; journalierAutoLockWarningTimer=null;
    }
    function journalierScheduleAutoLock(){
        journalierClearAutoLockTimers();
        if(!JournalierSecurity.ready)return;
        journalierLastActivity=Date.now();
        journalierAutoLockWarningTimer=setTimeout(()=>{
            if(!JournalierSecurity.ready)return;
            try{showAppToast?.('🔒 Verrouillage automatique dans 1 minute en cas d’inactivité.','info',5000);}catch(_){/* toast optionnel d'avertissement */}
        },Math.max(0,JOURNALIER_AUTOLOCK_MS-JOURNALIER_AUTOLOCK_WARNING_MS));
        journalierAutoLockTimer=setTimeout(()=>journalierAutoLockNow(),JOURNALIER_AUTOLOCK_MS);
    }
    function journalierRegisterActivity(){
        if(!JournalierSecurity.ready)return;
        journalierLastActivity=Date.now();
        journalierScheduleAutoLock();
    }
    async function journalierAutoLockNow(){
        if(!JournalierSecurity.ready)return;
        const idle=Date.now()-journalierLastActivity;
        if(idle<JOURNALIER_AUTOLOCK_MS){journalierScheduleAutoLock();return;}
        try{
            await JournalierSecurity.persist(JournalierSecurity.state);
            JournalierSecurity.lock();
            journalierLockedByTimeout=true;
            try{msAccount=null;updateMicrosoftUI?.();updateStudentDropdowns?.();renderStudentsView?.();renderAgenda?.();updateStats?.();window.JournalierV74?.renderDashboard?.();}catch(_){/* repli interface utilisateur lors du verrouillage */}
            try{setCloudStatus?.('🔒 Journalier a été verrouillé après 15 minutes d’inactivité. Reconnectez-vous avec Microsoft pour reprendre la session.','info');showAppToast?.('🔒 Session Journalier verrouillée automatiquement.','success',6500);}catch(_){/* notification visuelle de verrouillage */}
        }catch(_){
            journalierScheduleAutoLock();
            try{showAppToast?.('⚠️ Le verrouillage automatique a été reporté : impossible de sécuriser la dernière sauvegarde locale.','error',6500);}catch(_){/* notification visuelle de report */}
        }
    }
    function journalierResetAutoLockAfterUnlock(){
        journalierLockedByTimeout=false;
        journalierScheduleAutoLock();
    }
    ['pointerdown','keydown','touchstart'].forEach(type=>{
        document.addEventListener(type,()=>journalierRegisterActivity(),{capture:true,passive:true});
    });
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden)return;
        if(JournalierSecurity.ready&&Date.now()-journalierLastActivity>=JOURNALIER_AUTOLOCK_MS)journalierAutoLockNow();
        else if(JournalierSecurity.ready)journalierScheduleAutoLock();
    });

    function isJournalSession(entry){return Boolean(entry&&entry.type==='SEANCE'&&String(entry.schemaVersion)===JOURNALIER_ARCHITECTURE_VERSION);}

    function getSessionPresenceStatus(entry){
        const raw=String(entry?.contexte?.presenceStatus||entry?.presenceStatus||entry?.metadata?.presenceStatus||'present').trim();
        if(['present','absent_eleve_coteach','absent_eleve','absent_prof','absent_agent'].includes(raw))return raw;
        return 'present';
    }
    function isObservationSession(entry){
        return isJournalSession(entry) && getSessionPresenceStatus(entry)==='present';
    }
    function getSessionClassNotes(entry){
        return String(entry?.contexte?.classNotes||entry?.classNotes||'').trim();
    }
    function getSessionPresenceMeta(entry){
        const st=getSessionPresenceStatus(entry);
        if(st==='absent_eleve_coteach')return {key:st,badge:'🟣 Co-enseignement / Notes (Élève absent)',shortBadge:'🟣 Co-ens. / Notes',css:'is-coteach',isObservation:false};
        if(st==='absent_eleve')return {key:st,badge:'🟠 Élève absent — Séance non tenue',shortBadge:'🟠 Élève absent',css:'is-absent-eleve',isObservation:false};
        if(st==='absent_prof')return {key:st,badge:'🔵 Professeur absent / Cours annulé',shortBadge:'🔵 Prof. absent',css:'is-absent-prof',isObservation:false};
        if(st==='absent_agent')return {key:st,badge:'🟤 Agent du pôle absent',shortBadge:'🟤 Agent absent',css:'is-absent-agent',isObservation:false};
        return {key:'present',badge:'🟢 Présence normale',shortBadge:'🟢 Présent',css:'is-present',isObservation:true};
    }
    function computeAttendanceStats(entries){
        const list=Array.isArray(entries)?entries:[];
        let present=0,coteach=0,absentEleve=0,absentProf=0,absentAgent=0;
        list.forEach(item=>{
            const st=getSessionPresenceStatus(item);
            if(st==='absent_eleve_coteach')coteach++;
            else if(st==='absent_eleve')absentEleve++;
            else if(st==='absent_prof')absentProf++;
            else if(st==='absent_agent')absentAgent++;
            else present++;
        });
        const totalStudentOpportunities=present+coteach+absentEleve;
        const attendanceRate=totalStudentOpportunities>0?Math.round((present/totalStudentOpportunities)*100):null;
        return {total:list.length,present,coteach,absentEleve,absentProf,absentAgent,totalStudentOpportunities,attendanceRate};
    }
    window.JournalierAttendance={getSessionPresenceStatus,isObservationSession,getSessionClassNotes,getSessionPresenceMeta,computeAttendanceStats};

    function safeParseJSON(raw,fallback){try{const value=JSON.parse(raw);return value??fallback;}catch(_){return fallback;}}

    function getDB() {
        return DataStore.getSessions();
    }
    function saveDB(db) {
        DataStore.saveSessions(Array.isArray(db) ? db : []);
    }
    function getStudents() {
        return DataStore.getStudents();
    }

    function updateStudentDropdowns() {
        if (typeof window !== 'undefined' && window.JournalierStudents?.updateStudentDropdowns) {
            return window.JournalierStudents.updateStudentDropdowns();
        }
    }

    function saveStudentsList(list) {
        DataStore.saveStudents(Array.isArray(list) ? list : []);
        window.JournalierV74?.refreshStudents?.();
        updateStudentDropdowns();
        renderStudentsView();
        updateStats();
    }


    /* =========================================================
       SLOT DETAILS & PIA WIDGET BRIDGES
       ========================================================= */
    function viewSlotDetails(id){const entry=getDB().find(e=>e.id==id);if(entry&&isJournalSession(entry)){const p=sessionParts(entry),q2=entry.q2||{},q4=entry.q4||{},q6=entry.q6||{};alert(`👤 ${p.eleve}\n📅 ${p.date} (${sessionPeriodLabel(entry)}) — ${p.matiere}\n\n• Interventions : ${(entry.contexte?.typeIntervention||[]).join(', ')||'N/A'}\n• Fonctionnement : ${(q2.observations||[]).map(x=>x.observation).join(', ')||'Aucune'}\n• Adaptations : ${(q4.types||[]).join(', ')||'Aucune'}\n• Suites : ${(q6.actions||[]).join(', ')||'Aucune'}`);}}

    function updatePIAPrompt() {
        const studentName = document.getElementById('f-eleve').value;
        const students = getStudents();
        const student = students.find(s => s.nom === studentName);
        const box = document.getElementById('pia-widget-box');
        const text = document.getElementById('pia-widget-text');

        if (student && student.pia) {
            text.innerText = student.pia;
            box.classList.remove('hidden');
        } else {
            box.classList.add('hidden');
        }
    }

    function quickFormForSlot(dateIso,period,eleve,matiere){clearObservationForm();document.getElementById('f-date').value=dateIso;document.getElementById('f-periode-start').value=period;document.getElementById('f-periode-end').value=period;syncSessionPeriodRange();if(eleve)document.getElementById('f-eleve').value=eleve;if(matiere){const input=document.getElementById('f-matiere');input.value=matiere;input.dataset.selectedSubject=matiere;const note=document.getElementById('session-subject-selected-note');if(note)note.textContent=`Matière sélectionnée : ${matiere}`;}updatePIAPrompt();showTab('form');}


    /* =========================================================
       SESSIONS & OBSERVATIONS RUNTIME
       ========================================================= */

    /* =========================================================
       SESSIONS & OBSERVATIONS RUNTIME
       Module extrait dans : src/app/sessions-core.js (Lot 3.7)
       ========================================================= */


    /* =========================================================
       JOURNALIER V74 — RAPPORT NATUREL & SYNTHÈSE PÉDAGOGIQUE
       Logique consolidée dans : src/app/reports-core.js (Lot 3.8)
       ========================================================= */
    function updateStats() {
        const db = getDB();
        const students = getStudents();
        const container = document.getElementById('stats-container');
        if (!container) return;

        let html = `
            <div class="stat-box">
                <div class="stat-val" style="color:var(--accent-green);">${db.length}</div>
                <div class="stat-lbl">Observations encodées</div>
            </div>
        `;

        students.slice(0, 4).forEach(s => {
            const count = db.filter(l => isJournalSession(l)&&sessionParts(l).eleve===s.nom).length;
            html += `
                <div class="stat-box">
                    <div class="stat-val">${count} P.</div>
                    <div class="stat-lbl">${escapeHtml(s.nom)} (${escapeHtml(s.classe||'')})</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }


    window.addEventListener('click', function(e) {
        if (e.target.id === 'eventActionModal') closeEventActionModal();
        if (e.target.id === 'slotModal') closeSlotModal();
        if (e.target.id === 'studentModal') closeStudentModal();
        if (e.target.id === 'studentProfileModal') closeStudentProfile();
    });

    // V37 : les vues inactives sont placées hors du conteneur de contenu.
    // Une seule vue existe physiquement dans .main-container à la fois.
    // Ainsi, aucun élément de la Séance (dont le bouton d'enregistrement)
    // ne peut apparaître sur Élèves ou Rapports & PIA.
    let pageStage = null;
    let pageViewPool = null;
    const pageViewCache = {};

    function initializePageStage() {
        const main = document.querySelector('.main-container');
        if (!main || pageStage) return;

        pageStage = document.createElement('div');
        pageStage.id = 'page-stage';
        main.appendChild(pageStage);

        // Le pool est hors de .main-container : les vues inactives ne participent
        // ni à la mise en page, ni au défilement, ni à l'affichage de la page active.
        pageViewPool = document.createElement('div');
        pageViewPool.id = 'page-view-pool';
        pageViewPool.setAttribute('aria-hidden', 'true');
        pageViewPool.style.display = 'none';
        document.body.appendChild(pageViewPool);

        ['accueil','agenda','form','eleves','reports'].forEach(name => {
            const el = document.getElementById('view-' + name);
            if (el) {
                pageViewCache[name] = el;
                pageViewPool.appendChild(el);
            }
        });

        showTab('accueil');
    }

    function showTab(tabName) {
        if (!pageStage) initializePageStage();
        if (!pageStage || !pageViewPool) return;

        const target = pageViewCache[tabName];
        if (!target) return;

        // L'ancienne vue quitte réellement la zone de contenu.
        while (pageStage.firstChild) pageViewPool.appendChild(pageStage.firstChild);
        target.classList.remove('hidden');
        target.style.display = '';
        target.removeAttribute('aria-hidden');
        pageStage.appendChild(target);

        document.querySelectorAll('.nav-tabs .nav-btn').forEach(btn => btn.classList.remove('active'));
        const button = document.getElementById('tab-btn-' + tabName);
        if (button) button.classList.add('active');

        const main = document.querySelector('.main-container');
        if (main) main.scrollTop = 0;

        if (typeof closeAllChoiceMenus === 'function') closeAllChoiceMenus();
        if (typeof closeEventActionModal === 'function') closeEventActionModal();

        if (tabName === 'agenda') renderAgenda();
        if (tabName === 'eleves') renderStudentsView();
        if (tabName === 'reports') {
            updateStudentDropdowns();
            const reportStudent=document.getElementById('r-eleve');
            if(reportStudent && !reportStudent.value){
                const last=getDB().find(item=>item.type==='SEANCE');
                if(last) reportStudent.value=last.identification?.eleve || '';
            }
            reportStudent?.dispatchEvent(new CustomEvent('journalier:student-context-change',{bubbles:true}));
            loadStudentHistory();
        }
        if (tabName === 'form') {
            updateStudentDropdowns();
            const d = document.getElementById('f-date');
            if (d && !d.value) d.value = selectedDateISO;
            if (typeof refreshSessionSubjectsForStudent === 'function') refreshSessionSubjectsForStudent();
            if (typeof renderSessionMainSubjectBubbles === 'function') renderSessionMainSubjectBubbles();
            if (typeof updateObservationSuggestions === 'function') updateObservationSuggestions();
        }
        if (tabName === 'accueil') renderHome();
    }


    function runIntegrityChecks(){
        const required=['observationForm','f-eleve','f-date','f-periode-start','f-periode-end','f-matiere','f-niveau','f-forme','f-objLecon','f-objAgent','f-q2-txt','f-q3-txt','f-q4-txt','f-q5-txt','f-q6-txt','q4-status-value','q5-transfer-value','q6-modality-value','q6-objective-value','r-eleve','r-periode','r-date-anchor','report-text'];
        const missing=required.filter(id=>!document.getElementById(id)),duplicates=[],seen=new Set();document.querySelectorAll('[id]').forEach(el=>{if(seen.has(el.id))duplicates.push(el.id);seen.add(el.id);});
        try{JSON.stringify(getDB());JSON.stringify(getStudents());JSON.stringify(getPrevisionnel());}catch(err){console.error('Journalier — stockage local invalide',err);}
        if(missing.length||duplicates.length)console.error('Journalier integrity check',{missing,duplicates});else console.info('Journalier integrity check OK — formulaire canonique vérifié.');
    }

    document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeEventActionModal(); closeSlotModal(); closeStudentModal(); closeStudentProfile(); } });

    // INITIALISATION — l'application démarre verrouillée jusqu'à l'établissement de l'identité Microsoft.
    const journalierBoot = DataStore.diagnostics();
    console.info('Journalier V74 — sécurité initialisée');
    updateStudentDropdowns();
    populatePeriodSelectors('1e H', '1e H');
    document.getElementById('f-date').value = selectedDateISO;
    const reportDate = document.getElementById('r-date-anchor');
    if (reportDate) reportDate.value = selectedDateISO;
    const reportStart=document.getElementById('r-date-start'),reportEnd=document.getElementById('r-date-end');
    if(reportStart&&!reportStart.value)reportStart.value=selectedDateISO;
    if(reportEnd&&!reportEnd.value)reportEnd.value=selectedDateISO;
    bindReportsUX();
    renderAgenda();
    renderHome();
    runIntegrityChecks();
    initializePageStage();


// V27 — synchronisation des bulles de choix avec les valeurs enregistrées
function setBubbleSelect(selectId, value, button){
    const select=document.getElementById(selectId);
    if(!select) return;
    select.value=value;
    const group=button && button.parentElement;
    if(group){ group.querySelectorAll('.ux-select-bubble').forEach(b=>b.classList.toggle('is-active', b===button)); }
    select.dispatchEvent(new Event('change',{bubbles:true}));
}
function syncBubbleSelects(){
    document.querySelectorAll('[data-select-bubbles]').forEach(group=>{
        const id=group.getAttribute('data-select-bubbles');
        const select=document.getElementById(id); if(!select) return;
        group.querySelectorAll('.ux-select-bubble').forEach(b=>b.classList.toggle('is-active', b.dataset.value===select.value));
    });
}
function syncBubbleCheckboxStates(){
    document.querySelectorAll('.ux-bubble input[type="checkbox"]').forEach(input=>{
        const bubble=input.closest('.ux-bubble');
        if(bubble) bubble.classList.toggle('is-active',input.checked);
        input.addEventListener('change',()=>bubble && bubble.classList.toggle('is-active',input.checked),{once:false});
    });
}
function initV27ChoiceBubbles(){ syncBubbleSelects(); syncBubbleCheckboxStates(); renderSessionMainSubjectBubbles(); }
document.addEventListener('DOMContentLoaded', initV27ChoiceBubbles);
document.addEventListener('DOMContentLoaded',()=>showTab('accueil'));

document.addEventListener('reset',()=>setTimeout(()=>{syncBubbleSelects();syncBubbleCheckboxStates();},0),true);


function renderSessionMainSubjectBubbles(){
    const selected=String(document.getElementById('f-eleve')?.value||'').trim();
    const box=document.getElementById('session-main-subject-bubbles'); if(!box) return;
    const student=getStudents().find(s=>String(s.studentId)===selected||String(s.id)===selected||String(s.nom)===selected);
    const subjects=student?normalizeSubjectList(student.matieres):[];
    box.innerHTML=subjects.map(sub=>`<button type="button" class="ux-main-subject js-session-subject" data-value="${escapeHtml(sub)}">${escapeHtml(sub)}</button>`).join('');
    const current=(document.getElementById('f-matiere')?.value||'').trim().toLowerCase();
    box.querySelectorAll('.ux-main-subject').forEach(b=>b.classList.toggle('is-active',b.textContent.trim().toLowerCase()===current));
}



/* =========================================================
   CSP — migration statique des handlers inline
   Injecté dans le même scope que le code applicatif.
   ========================================================= */
const JR_HANDLERS = Object.create(null);
if (typeof window !== "undefined") {
    window.JR_HANDLERS = JR_HANDLERS;
}
if (typeof globalThis !== "undefined") {
    globalThis.JR_HANDLERS = JR_HANDLERS;
}
JR_HANDLERS["h1"] = {attr:"onclick", fn:function(event){
openMicrosoftConnection()
}};
JR_HANDLERS["h2"] = {attr:"onclick", fn:function(event){
showTab('accueil')
}};
JR_HANDLERS["h3"] = {attr:"onclick", fn:function(event){
showTab('agenda');
switchAgendaView('week')
}};
JR_HANDLERS["h4"] = {attr:"onclick", fn:function(event){
showTab('form')
}};
JR_HANDLERS["h5"] = {attr:"onclick", fn:function(event){
showTab('eleves')
}};
JR_HANDLERS["h6"] = {attr:"onclick", fn:function(event){
showTab('reports')
}};
JR_HANDLERS["h7"] = {attr:"onclick", fn:function(event){
showTab('agenda');
switchAgendaView('month')
}};
JR_HANDLERS["h8"] = {attr:"onclick", fn:function(event){
showTab('agenda')
}};
JR_HANDLERS["h9"] = {attr:"onclick", fn:function(event){
showTab('eleves')
}};
JR_HANDLERS["h10"] = {attr:"onclick", fn:function(event){
showTab('reports')
}};
JR_HANDLERS["h11"] = {attr:"onclick", fn:function(event){
openSlotModal(selectedDateISO, periods[0], getDayIndexFromISO(selectedDateISO), null, true)
}};
JR_HANDLERS["h12"] = {attr:"onclick", fn:function(event){
switchAgendaView('day')
}};
JR_HANDLERS["h13"] = {attr:"onclick", fn:function(event){
switchAgendaView('week')
}};
JR_HANDLERS["h14"] = {attr:"onclick", fn:function(event){
switchAgendaView('month')
}};
JR_HANDLERS["h15"] = {attr:"onclick", fn:function(event){
navigateAgenda(-1)
}};
JR_HANDLERS["h16"] = {attr:"onclick", fn:function(event){
todayAgenda()
}};
JR_HANDLERS["h17"] = {attr:"onclick", fn:function(event){
navigateAgenda(1)
}};
JR_HANDLERS["h18"] = {attr:"onchange", fn:function(event){
pickerDateChanged(this.value)
}};
JR_HANDLERS["h19"] = {attr:"onclick", fn:function(event){
showTab('reports')
}};
JR_HANDLERS["h20"] = {attr:"onchange", fn:function(event){
const select=event.currentTarget,note=document.getElementById('session-student-edit-note'),selectedOption=select?.options?.[select.selectedIndex];
if(select?.dataset) { if(selectedOption?.dataset?.orphanSessionStudent==='true') select.dataset.orphanSessionStudent='true'; else select.removeAttribute('data-orphan-session-student'); }
if(note){if(selectedOption?.dataset?.orphanSessionStudent==='true'){note.textContent='Cette séance était rattachée à un élève qui n’existe plus dans le dossier. Choisissez l’élève actuel avant d’enregistrer.';note.classList.remove('hidden');}else{note.textContent='';note.classList.add('hidden');}}
updatePIAPrompt(); refreshSessionSubjectsForStudent(); renderSessionMainSubjectBubbles(); updateObservationSuggestions();
}};
JR_HANDLERS["h21"] = {attr:"onchange", fn:function(event){
updateObservationSuggestions()
}};
JR_HANDLERS["h22"] = {attr:"onchange", fn:function(event){
syncSessionPeriodRange(); updateObservationSuggestions()
}};
JR_HANDLERS["h23"] = {attr:"onchange", fn:function(event){
syncSessionPeriodRange(); updateObservationSuggestions()
}};
JR_HANDLERS["h24"] = {attr:"onfocus", fn:function(event){
openSessionSubjectMenu()
}};
JR_HANDLERS["h25"] = {attr:"oninput", fn:function(event){
filterSessionSubjects(); renderSessionMainSubjectBubbles()
}};
JR_HANDLERS["h26"] = {attr:"onclick", fn:function(event){
openSessionSubjectMenu()
}};
JR_HANDLERS["h27"] = {attr:"onchange", fn:function(event){
updateObservationSuggestions()
}};
JR_HANDLERS["h28"] = {attr:"onchange", fn:function(event){
updateObservationSuggestions()
}};
JR_HANDLERS["h29"] = {attr:"oninput", fn:function(event){
updateObservationSuggestions()
}};
JR_HANDLERS["h30"] = {attr:"onclick", fn:function(event){
toggleQ3LearningMore()
}};
JR_HANDLERS["h31"] = {attr:"onclick", fn:function(event){
addCustomQ3Indicator()
}};
JR_HANDLERS["h32"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q4-status-value','none',this)
}};
JR_HANDLERS["h33"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q4-status-value','existing_adaptation',this)
}};
JR_HANDLERS["h34"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q4-status-value','existing_mediation',this)
}};
JR_HANDLERS["h35"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q4-status-value','new',this)
}};
JR_HANDLERS["h36"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q4-status-value','later',this)
}};
JR_HANDLERS["h37"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q5-transfer-value','observed',this)
}};
JR_HANDLERS["h38"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q5-transfer-value','not_observed',this)
}};
JR_HANDLERS["h39"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q5-transfer-value','no_opportunity',this)
}};
JR_HANDLERS["h40"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q5-transfer-value','later',this)
}};
JR_HANDLERS["h41"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q5-transfer-value','not_relevant',this)
}};
JR_HANDLERS["h42"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-modality-value','',this)
}};
JR_HANDLERS["h43"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-modality-value','Maintenir l’individuel',this)
}};
JR_HANDLERS["h44"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-modality-value','Groupe',this)
}};
JR_HANDLERS["h45"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-modality-value','Cointervention',this)
}};
JR_HANDLERS["h46"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-modality-value','Coenseignement',this)
}};
JR_HANDLERS["h47"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-objective-value','',this)
}};
JR_HANDLERS["h48"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-objective-value','Maintenir les objectifs',this)
}};
JR_HANDLERS["h49"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-objective-value','Ajuster l’objectif de travail',this)
}};
JR_HANDLERS["h50"] = {attr:"onclick", fn:function(event){
setBubbleSelect('q6-objective-value','Évolution du PIA à discuter',this)
}};
JR_HANDLERS["h51"] = {attr:"onclick", fn:function(event){
openAddStudentModal()
}};
JR_HANDLERS["h52"] = {attr:"oninput", fn:function(event){
renderStudentsView()
}};
JR_HANDLERS["h53"] = {attr:"onchange", fn:function(event){
loadStudentHistory()
}};
JR_HANDLERS["h54"] = {attr:"onchange", fn:function(event){
selectedDateISO=this.value; renderAgenda();
}};
JR_HANDLERS["h55"] = {attr:"onclick", fn:function(event){
generateReport()
}};
JR_HANDLERS["h56"] = {attr:"onchange", fn:function(event){
updateRecurrenceNote()
}};
JR_HANDLERS["h57"] = {attr:"onchange", fn:function(event){
toggleModalSlotFields()
}};
JR_HANDLERS["h58"] = {attr:"onchange", fn:function(event){
toggleDuplicateFields()
}};
JR_HANDLERS["h59"] = {attr:"onclick", fn:function(event){
closeSlotModal()
}};
JR_HANDLERS["h60"] = {attr:"onclick", fn:function(event){
saveSlotModification()
}};
JR_HANDLERS["h61"] = {attr:"onclick", fn:function(event){
closeEventActionModal()
}};
JR_HANDLERS["h62"] = {attr:"onclick", fn:function(event){
closeEventDeleteModal()
}};
JR_HANDLERS["h63"] = {attr:"onclick", fn:function(event){
closeStudentProfile()
}};
JR_HANDLERS["h64"] = {attr:"onclick", fn:function(event){
toggleMultiSelect('student-subjects-select')
}};
JR_HANDLERS["h65"] = {attr:"oninput", fn:function(event){
filterStudentSubjects()
}};
JR_HANDLERS["h66"] = {attr:"onclick", fn:function(event){
document.getElementById('student-pia-file').click()
}};
JR_HANDLERS["h67"] = {attr:"onchange", fn:function(event){
showPIAImportName(this)
}};
JR_HANDLERS["h68"] = {attr:"onclick", fn:function(event){
closeStudentModal()
}};
JR_HANDLERS["h69"] = {attr:"onclick", fn:function(event){
saveStudent(event)
}};
JR_HANDLERS["h70"] = {attr:"onclick", fn:function(event){
closeMicrosoftConnection()
}};
JR_HANDLERS["h71"] = {attr:"onclick", fn:function(event){
closeMicrosoftConnection()
}};
JR_HANDLERS["h72"] = {attr:"onclick", fn:function(event){
startMicrosoftLogin()
}};
JR_HANDLERS["h73"] = {attr:"onclick", fn:function(event){
disconnectMicrosoft()
}};
JR_HANDLERS["h74"] = {attr:"onclick", fn:function(event){
prepareMicrosoft365Space()
}};
JR_HANDLERS["h75"] = {attr:"onclick", fn:function(event){
verifyMicrosoft365Space()
}};
JR_HANDLERS["h76"] = {attr:"onclick", fn:function(event){
testMicrosoftAppFolder()
}};
JR_HANDLERS["h77"] = {attr:"onclick", fn:function(event){
diagnoseSyncManagerV72()
}};
JR_HANDLERS["h78"] = {attr:"onclick", fn:function(event){
syncPendingLocalChangesV72()
}};
JR_HANDLERS["h79"] = {attr:"onclick", fn:function(event){
openConflictResolutionV72();
}};
JR_HANDLERS["h80"] = {attr:"onclick", fn:function(event){
downloadApplicationZipFile();
}};

function downloadApplicationZipFile() {
    window.showAppToast?.('Préparation du téléchargement du ZIP…', 'info', 3000);
    const candidateUrls = [
        './journalier-electronique-v74.zip',
        '/journalier-electronique/journalier-electronique-v74.zip',
        '/journalier-electronique-v74.zip'
    ];
    function tryFetch(urls) {
        if (!urls.length) {
            window.showAppToast?.('Impossible de récupérer l’archive ZIP.', 'error', 4000);
            return;
        }
        const url = urls[0];
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.blob();
            })
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = 'journalier-electronique-v74.zip';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
                window.showAppToast?.('Téléchargement du ZIP lancé avec succès !', 'success', 4000);
            })
            .catch(() => tryFetch(urls.slice(1)));
    }
    tryFetch(candidateUrls);
}

JR_HANDLERS["h84"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("DECEMBRE");
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("DECEMBRE");
    }
    return null;
}};

JR_HANDLERS["h85"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("FIN_ANNEE");
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("FIN_ANNEE");
    }
    return null;
}};

JR_HANDLERS["h86"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.copyDecemberAmenagementsToMeeting2 === "function") {
        return globalThis.copyDecemberAmenagementsToMeeting2();
    }
    if (typeof window.JournalierV74?.copyDecemberAmenagementsToMeeting2 === "function") {
        return window.JournalierV74.copyDecemberAmenagementsToMeeting2();
    }
    return null;
}};

JR_HANDLERS["h87"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("DECEMBRE", "pdf");
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("DECEMBRE", "pdf");
    }
    return null;
}};

JR_HANDLERS["h88"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("FIN_ANNEE", "pdf");
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("FIN_ANNEE", "pdf");
    }
    return null;
}};

JR_HANDLERS["h89"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("DECEMBRE", "docx", true);
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("DECEMBRE", "docx", true);
    }
    return null;
}};

JR_HANDLERS["h90"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("DECEMBRE", "pdf", true);
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("DECEMBRE", "pdf", true);
    }
    return null;
}};

JR_HANDLERS["h91"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("FIN_ANNEE", "docx", true);
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("FIN_ANNEE", "docx", true);
    }
    return null;
}};

JR_HANDLERS["h92"] = {attr:"onclick", fn:function(event){
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (typeof globalThis.exportOfficialPIADocument === "function") {
        return globalThis.exportOfficialPIADocument("FIN_ANNEE", "pdf", true);
    }
    if (typeof window.JournalierV74?.exportOfficialPIADocument === "function") {
        return window.JournalierV74.exportOfficialPIADocument("FIN_ANNEE", "pdf", true);
    }
    return null;
}};

const JR_HANDLER_INSTALLED = new WeakSet();

function jrAttachHandlers(el) {
    if (JR_HANDLER_INSTALLED.has(el)) return;
    const ids = (el.getAttribute('data-jr-handlers') || '').trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
        const entry = JR_HANDLERS[id];
        if (!entry) continue;
        el.addEventListener(entry.attr.slice(2), function(event) {
            entry.fn.call(el, event);
        }, false);
    }
    JR_HANDLER_INSTALLED.add(el);
}

function jrInstallHandlers(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches?.('[data-jr-handlers]')) jrAttachHandlers(root);
    root.querySelectorAll?.('[data-jr-handlers]').forEach(jrAttachHandlers);
}

function jrBootHandlers() {
    jrInstallHandlers(document);
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) jrInstallHandlers(node);
            }
        }
    });
    observer.observe(document.documentElement, {childList:true, subtree:true});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', jrBootHandlers, {once:true});
} else {
    jrBootHandlers();
}
