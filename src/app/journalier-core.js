const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
    const DEFAULT_AGENDA_PERIODS = [
        {id:'p1',label:'1e H',start:'08:00',end:'08:50'},
        {id:'p2',label:'2e H',start:'08:50',end:'09:40'},
        {id:'p3',label:'3e H',start:'09:40',end:'10:30'},
        {id:'p4',label:'4e H',start:'10:45',end:'11:35'},
        {id:'p5',label:'5e H',start:'11:35',end:'12:25'},
        {id:'p6',label:'6e H',start:'13:15',end:'14:05'},
        {id:'p7',label:'7e H',start:'14:05',end:'14:55'},
        {id:'p8',label:'8e H',start:'14:55',end:'15:45'}
    ];
    let agendaPeriodConfig = DEFAULT_AGENDA_PERIODS.map(p=>({...p}));
    let periods = agendaPeriodConfig.map(p=>p.label);

    let agendaMode = 'day';
    let agendaModalState = { mode:'create', eventId:null, recurrence:null, occurrenceDate:null };
    let agendaDeleteState = { eventId:null, seriesId:null, occurrenceDate:null, recurrence:null };
    function getInitialDateISO() {
        const now = new Date();
        if (isNaN(now.getTime())) return '2026-08-24';
        const iso = formatISO(now);
        return (iso >= '2026-08-24' && iso <= '2027-07-02') ? iso : '2026-08-24';
    }
    let selectedDateISO = getInitialDateISO();

    function parseISODate(isoStr) {
        const fallback = new Date(2026, 7, 24);
        if (!isoStr || typeof isoStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return fallback;
        const [y,m,d] = isoStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return fallback;
        return dt;
    }

    function formatISO(d) {
        if (!(d instanceof Date) || isNaN(d.getTime())) return '2026-08-24';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getMonday(d) {
        let dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        let day = dt.getDay();
        let diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        let monday = new Date(dt.setDate(diff));
        return monday;
    }

    /* =========================================================
       JOURNALIER V74 — SECURITY / IDENTITY / DATA STORE
       ---------------------------------------------------------
       Architecture :
       - Microsoft Entra ID = source d'identité
       - compte local strictement isolé par identité Entra
       - données locales chiffrées AES-GCM dans IndexedDB
       - aucune donnée métier persistée dans localStorage
       - aucune identité propriétaire adoptée depuis OneDrive
       - validation systématique avant import cloud
       - SyncManager séparé du modèle pédagogique
       ========================================================= */
    const JOURNALIER_ARCHITECTURE_VERSION = '72.2-secure-appfolder-test';
    const JOURNALIER_DB_NAME = 'journalier-secure-v72';
    const JOURNALIER_DB_VERSION = 1;
    const JOURNALIER_STATE_STORE = 'states';
    const JOURNALIER_KEY_STORE = 'keys';

    function journalierUuid(prefix='id') {
        if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    }

    function journalierClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function journalierEmptyState(accountKey, account) {
        return {
            version: JOURNALIER_ARCHITECTURE_VERSION,
            ownerId: accountKey,
            identity: {
                accountKey,
                provider: 'microsoft365',
                displayName: account?.name || account?.username || 'Utilisateur Journalier',
                microsoftAccount: account?.username || null,
                createdAt: new Date().toISOString()
            },
            students: [],
            sessions: [],
            agenda: {},
            sync: { status:'local-only', lastSyncAt:null, pendingChanges:0 },
            syncRegistry: { version:'1', students:{}, sessions:{}, agenda:null, pia:{} },
            meta: { securityArchitecture:'account-scoped-encrypted-store', createdAt:new Date().toISOString(), piaRecords:{} }
        };
    }

    function journalierOpenDB() {
        return new Promise((resolve,reject)=>{
            if(!('indexedDB' in window)) return reject(new Error('IndexedDB est requis pour le stockage local sécurisé.'));
            const req=indexedDB.open(JOURNALIER_DB_NAME,JOURNALIER_DB_VERSION);
            req.onupgradeneeded=()=>{
                const db=req.result;
                if(!db.objectStoreNames.contains(JOURNALIER_STATE_STORE)) db.createObjectStore(JOURNALIER_STATE_STORE,{keyPath:'accountKey'});
                if(!db.objectStoreNames.contains(JOURNALIER_KEY_STORE)) db.createObjectStore(JOURNALIER_KEY_STORE,{keyPath:'accountKey'});
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir le stockage sécurisé local.'));
        });
    }

    function journalierIDBRequest(request){
        return new Promise((resolve,reject)=>{
            request.onsuccess=()=>resolve(request.result);
            request.onerror=()=>reject(request.error||new Error('Opération IndexedDB impossible.'));
        });
    }

    async function journalierGetStoreRecord(storeName,key){
        const db=await journalierOpenDB();
        try{
            const tx=db.transaction(storeName,'readonly');
            return await journalierIDBRequest(tx.objectStore(storeName).get(key));
        }finally{db.close();}
    }

    async function journalierPutStoreRecord(storeName,value){
        const db=await journalierOpenDB();
        try{
            const tx=db.transaction(storeName,'readwrite');
            tx.objectStore(storeName).put(value);
            await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Écriture IndexedDB impossible.'));tx.onabort=()=>reject(tx.error||new Error('Écriture IndexedDB interrompue.'));});
        }finally{db.close();}
    }

    async function journalierDeleteStoreRecord(storeName,key){
        const db=await journalierOpenDB();
        try{
            const tx=db.transaction(storeName,'readwrite');
            tx.objectStore(storeName).delete(key);
            await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Suppression IndexedDB impossible.'));tx.onabort=()=>reject(tx.error||new Error('Suppression IndexedDB interrompue.'));});
        }finally{db.close();}
    }

    async function journalierHashIdentity(account){
        const raw=String(account?.homeAccountId||account?.localAccountId||'').trim();
        if(!raw) throw new Error('Identité Microsoft stable indisponible : connexion refusée.');
        const bytes=new TextEncoder().encode(`journalier-v72:${raw}`);
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    async function journalierGetEncryptionKey(accountKey){
        let record=await journalierGetStoreRecord(JOURNALIER_KEY_STORE,accountKey);
        if(record?.key) return record.key;
        const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
        await journalierPutStoreRecord(JOURNALIER_KEY_STORE,{accountKey,key,createdAt:new Date().toISOString()});
        return key;
    }

    async function journalierEncryptState(state,key){
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const payload=new TextEncoder().encode(JSON.stringify(state));
        const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,payload);
        return {version:1,iv:Array.from(iv),ciphertext:Array.from(new Uint8Array(cipher)),updatedAt:new Date().toISOString()};
    }

    async function journalierDecryptState(record,key){
        if(!record?.ciphertext||!Array.isArray(record.iv)) throw new Error('Données locales sécurisées invalides.');
        const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,new Uint8Array(record.ciphertext));
        return JSON.parse(new TextDecoder().decode(plain));
    }

    const JournalierSecurity = {
        accountKey:null,
        account:null,
        key:null,
        state:null,
        ready:false,
        writeQueue:Promise.resolve(),
        async activate(account){
            const accountKey=await journalierHashIdentity(account);
            const key=await journalierGetEncryptionKey(accountKey);
            const record=await journalierGetStoreRecord(JOURNALIER_STATE_STORE,accountKey);
            let state=record ? await journalierDecryptState(record,key) : journalierEmptyState(accountKey,account);
            if(!state || state.ownerId!==accountKey || state.identity?.accountKey!==accountKey) throw new Error('Isolation de compte locale invalide : chargement refusé.');
            state.version=JOURNALIER_ARCHITECTURE_VERSION;
            state.ownerId=accountKey;
            state.identity={...(state.identity||{}),accountKey,provider:'microsoft365',displayName:account?.name||account?.username||state.identity?.displayName||'Utilisateur Journalier',microsoftAccount:account?.username||state.identity?.microsoftAccount||null};
            v72EnsureSyncRegistry(state); state.meta??={}; state.meta.piaRecords??={};
            this.accountKey=accountKey; this.account=account; this.key=key; this.state=state; this.ready=true;
            return state;
        },
        lock(){
            this.accountKey=null; this.account=null; this.key=null; this.state=null; this.ready=false;
        },
        persist(state){
            if(!this.ready||!this.accountKey||!this.key) return Promise.reject(new Error('Stockage local verrouillé : authentification Microsoft requise.'));
            const snapshot=journalierClone(state), accountKey=this.accountKey, key=this.key;
            this.writeQueue=this.writeQueue.catch(()=>{}).then(async()=>journalierPutStoreRecord(JOURNALIER_STATE_STORE,{accountKey,...await journalierEncryptState(snapshot,key)}));
            return this.writeQueue;
        }
    };

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
            try{showAppToast?.('🔒 Verrouillage automatique dans 1 minute en cas d’inactivité.','info',5000);}catch(_){}
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
            try{msAccount=null;updateMicrosoftUI?.();updateStudentDropdowns?.();renderStudentsView?.();renderAgenda?.();updateStats?.();window.JournalierV74?.renderDashboard?.();}catch(_){}
            try{setCloudStatus?.('🔒 Journalier a été verrouillé après 15 minutes d’inactivité. Reconnectez-vous avec Microsoft pour reprendre la session.','info');showAppToast?.('🔒 Session Journalier verrouillée automatiquement.','success',6500);}catch(_){}
        }catch(_){
            journalierScheduleAutoLock();
            try{showAppToast?.('⚠️ Le verrouillage automatique a été reporté : impossible de sécuriser la dernière sauvegarde locale.','error',6500);}catch(_){}
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

    function securePersistState(){
        return JournalierSecurity.persist(DataStore.state).then(result=>{ journalierScheduleAutoSync?.(); return result; }).catch(_=>{ console.error('Écriture sécurisée impossible.'); setCloudStatus?.('⚠️ Les données locales n’ont pas pu être sécurisées.','error'); return false; });
    }

    function secureNormalizeStudent(student) {
        const out={...(student||{})};
        if(!out.studentId) out.studentId=out.id!=null?`student_${String(out.id)}`:journalierUuid('student');
        if(out.id==null) out.id=Date.now()+Math.floor(Math.random()*1000);
        out.ownerId=JournalierSecurity.accountKey;
        out.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
        return out;
    }

    function secureNormalizeSession(entry,students=[]) {
        const out=journalierClone(entry||{});
        out.type=out.type||'SEANCE';
        out.schemaVersion=JOURNALIER_ARCHITECTURE_VERSION;
        out.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
        out.ownerId=JournalierSecurity.accountKey;
        out.id=out.id||journalierUuid('session');
        const name=out.identification?.eleve||'';
        const student=students.find(s=>String(s.studentId)===String(out.identification?.eleveId))||(typeof syncFindStudentByName==='function'?syncFindStudentByName(students,name):students.find(s=>s.nom===name));
        if(student) out.identification={...(out.identification||{}),eleveId:student.studentId};
        out.metadata={...(out.metadata||{}),createdAt:out.metadata?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),source:out.metadata?.source||'journalier-v72'};
        return out;
    }

    function secureNormalizeAgenda(prev) {
        const ownerId=JournalierSecurity.accountKey;
        return normalizeAgendaData(prev, ownerId);
    }

    function v72EnsureSyncRegistry(state){
        if(!state.syncRegistry||typeof state.syncRegistry!=='object')state.syncRegistry={version:'1',students:{},sessions:{},agenda:null,pia:{}};
        state.syncRegistry.students=state.syncRegistry.students||{}; state.syncRegistry.sessions=state.syncRegistry.sessions||{};
        if(!('agenda' in state.syncRegistry))state.syncRegistry.agenda=null; state.syncRegistry.pia=state.syncRegistry.pia||{}; state.syncRegistry.version='1';
        state.sync=state.sync||{status:'local-only',lastSyncAt:null,pendingChanges:0}; return state.syncRegistry;
    }
    function v72RecountPending(state){
        const r=v72EnsureSyncRegistry(state); let count=0,conflicts=0;
        for(const x of Object.values(r.students)){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict','deleted-pending'].includes(x?.status))count++;}
        for(const x of Object.values(r.sessions)){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict','deleted-pending'].includes(x?.status))count++;}
        for(const x of Object.values(r.pia||{})){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict'].includes(x?.status))count++;}
        if(r.agenda?.status==='conflict')conflicts++; if(['local-pending','local-changed','conflict'].includes(r.agenda?.status))count++;
        state.sync.pendingChanges=count; if(conflicts>0)state.sync.status='conflict'; else if(count===0)state.sync.status='synced'; else if(state.sync.status==='conflict'||state.sync.status==='synced')state.sync.status='pending';
    }
    function v72MarkStudentsPending(state,previous,next){
        const r=v72EnsureSyncRegistry(state);
        const before=new Map(
            (previous||[]).map(x=>[
                String(x.studentId),
                {
                    item:x,
                    fingerprint:syncFingerprint(syncWithoutVolatileMeta(x))
                }
            ])
        );
        const afterIds=new Set((next||[]).map(x=>String(x.studentId)));

        // Élèves encore présents : détecter les modifications locales.
        for(const item of next||[]){
            const id=String(item.studentId);
            const previousEntry=before.get(id);
            const old=previousEntry?.fingerprint||null;
            const fp=syncFingerprint(syncWithoutVolatileMeta(item));

            if(old!==fp){
                const existing=r.students[id]||{};
                r.students[id]={
                    ...existing,
                    status:existing.status==='conflict'
                        ?'conflict'
                        :'local-pending',
                    localDirtyAt:new Date().toISOString()
                };
            }
        }

        // Élèves supprimés localement : conserver une trace persistante.
        for(const [id,previousEntry] of before.entries()){
            if(afterIds.has(id))continue;

            const existing=r.students[id]||{};
            r.students[id]={
                ...existing,
                status:'deleted-pending',
                studentId:id,
                localDeletedAt:new Date().toISOString()
            };
        }
    }
    function v72MarkSessionsPending(state,previous,next){
        const r=v72EnsureSyncRegistry(state),before=new Map((previous||[]).map(x=>[x.id,x])),afterIds=new Set((next||[]).map(x=>String(x.id)));
        for(const item of next||[]){const fp=syncFingerprint(syncWithoutVolatileMeta(item)),oldItem=before.get(item.id),old=oldItem?syncFingerprint(syncWithoutVolatileMeta(oldItem)):null;if(old!==fp){const existing=r.sessions[item.id]||{};r.sessions[item.id]={...existing,status:existing.status==='conflict'?'conflict':'local-pending',studentId:item.identification?.eleveId||existing.studentId||null,localDirtyAt:new Date().toISOString()};}}
        for(const oldItem of previous||[]){const id=String(oldItem.id);if(!afterIds.has(id)&&r.sessions[id])r.sessions[id]={...r.sessions[id],status:'deleted-pending',studentId:oldItem.identification?.eleveId||r.sessions[id].studentId||null,localDeletedAt:new Date().toISOString()};}
    }
    function v72MarkAgendaPending(state,previous,next){const r=v72EnsureSyncRegistry(state),old=syncFingerprint(syncWithoutVolatileMeta(previous||{})),fp=syncFingerprint(syncWithoutVolatileMeta(next||{}));if(old!==fp)r.agenda={...(r.agenda||{}),status:r.agenda?.status==='conflict'?'conflict':'local-pending',localDirtyAt:new Date().toISOString()};}
    function v72MarkPiaPending(state,studentId){if(!studentId)return;const r=v72EnsureSyncRegistry(state),existing=r.pia[studentId]||{};r.pia[studentId]={...existing,status:existing.status==='conflict'?'conflict':'local-pending',localDirtyAt:new Date().toISOString()};v72RecountPending(state);}
    function v72MarkPiaSynced(state,studentId,pia){if(!studentId)return;const r=v72EnsureSyncRegistry(state),fp=syncFingerprint(syncWithoutVolatileMeta(pia||{}));r.pia[studentId]={...(r.pia[studentId]||{}),fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};v72RecountPending(state);}

    const DataStore={
        get state(){
            if(!JournalierSecurity.ready) return {version:JOURNALIER_ARCHITECTURE_VERSION,ownerId:null,identity:null,students:[],sessions:[],agenda:{},sync:{status:'locked',lastSyncAt:null,pendingChanges:0},syncRegistry:{version:'1',students:{},sessions:{},agenda:null,pia:{}},meta:{locked:true}};
            const s=JournalierSecurity.state;v72EnsureSyncRegistry(s);return s;
        },
        getIdentity(){return this.state.identity;},
        getState(){return this.state;},
        persistState(state){return securePersistState(state);},
        isReady(){return JournalierSecurity.ready;},
        getStudents(){return this.state.students.filter(s=>s.ownerId===this.state.ownerId);},
        saveStudents(list){
            if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');
            const previous=this.state.students.filter(s=>s.ownerId===this.state.ownerId).map(journalierClone),normalized=(Array.isArray(list)?list:[]).map(secureNormalizeStudent);
            this.state.students=normalized;v72MarkStudentsPending(this.state,previous,this.getStudents());v72RecountPending(this.state);securePersistState();
        },
        getSessions(){return this.state.sessions.filter(s=>s.ownerId===this.state.ownerId);},
        saveSessions(list){
            if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');
            const previous=this.state.sessions.filter(s=>s.ownerId===this.state.ownerId).map(journalierClone),students=this.getStudents();
            this.state.sessions=(Array.isArray(list)?list:[]).map(x=>secureNormalizeSession(x,students));v72MarkSessionsPending(this.state,previous,this.getSessions());v72RecountPending(this.state);securePersistState();
        },
        getAgenda(){return secureNormalizeAgenda(this.state.agenda);},
        saveAgenda(agenda){
            if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');
            const previous=secureNormalizeAgenda(this.state.agenda||{});this.state.agenda=secureNormalizeAgenda(agenda);v72MarkAgendaPending(this.state,previous,this.getAgenda());v72RecountPending(this.state);securePersistState();
        },
        diagnostics(){const s=this.state,agenda=this.getAgenda();return{architectureVersion:s.version,accountScoped:true,encryptedLocalStore:true,students:this.getStudents().length,sessions:this.getSessions().length,agendaEntries:Array.isArray(agenda?.__events)?agenda.__events.length:0,sync:s.sync,syncRegistry:s.syncRegistry};}
    };

    // Interface publique V74 vers le DataStore de Journalier.
    // Aucun nouveau stockage : V74 utilise le store existant.
    window.JournalierDataStore = DataStore;

    async function activateJournalierAccount(account){
        await JournalierSecurity.activate(account);
        window.JournalierV74?.refreshStudents?.();
        renderStudentsView?.(); renderAgenda?.(); updateStudentDropdowns?.(); updateStats?.(); window.JournalierV74?.renderDashboard?.(); window.updateMicrosoftUI?.();
        return JournalierSecurity.state;
    }

    function isJournalSession(entry){return Boolean(entry&&entry.type==='SEANCE'&&String(entry.schemaVersion)===JOURNALIER_ARCHITECTURE_VERSION);}

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

    function saveStudentsList(list) {
        DataStore.saveStudents(Array.isArray(list) ? list : []);
        window.JournalierV74?.refreshStudents?.();
        updateStudentDropdowns();
        renderStudentsView();
        updateStats();
    }

    function normalizeAgendaConfig(config){
        const source=Array.isArray(config?.periods)?config.periods:DEFAULT_AGENDA_PERIODS;
        const out=[];
        for(let i=0;i<8;i++){
            const fallback=DEFAULT_AGENDA_PERIODS[i];
            const raw=source[i]||{};
            const start=/^\d{2}:\d{2}$/.test(String(raw.start||''))?String(raw.start):fallback.start;
            const end=/^\d{2}:\d{2}$/.test(String(raw.end||''))?String(raw.end):fallback.end;
            const valid=start<end && (i===0 || start>=out[i-1].end);
            out.push({id:`p${i+1}`,label:fallback.label,start:valid?start:fallback.start,end:valid?end:fallback.end});
        }
        return out;
    }

    function applyAgendaPeriodConfig(config){
        agendaPeriodConfig=normalizeAgendaConfig(config);
        periods=agendaPeriodConfig.map(p=>p.label);
        return agendaPeriodConfig;
    }

    function agendaPeriodByLabel(label){
        return agendaPeriodConfig.find(p=>p.label===label)||null;
    }

    function agendaTimeToMinutes(value){
        const m=/^(\d{2}):(\d{2})$/.exec(String(value||''));
        return m?Number(m[1])*60+Number(m[2]):-1;
    }

    function agendaEventIndexes(event){
        const start=periodIndex(event?.startPeriod), end=periodIndex(event?.endPeriod||event?.startPeriod);
        return {start,end};
    }

    function normalizeAgendaEvent(item,ownerId,defaults={}){
        const ev={...(item||{})};
        ev.eventId=String(ev.eventId||journalierUuid('evt'));
        ev.ownerId=ownerId||ev.ownerId||null;
        ev.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
        ev.recurrence=ev.recurrence==='unique'?'unique':'weekly';
        ev.seriesId=ev.recurrence==='weekly'?(String(ev.seriesId||ev.eventId)):null;
        ev.type=['ELEVE','COLLAB','FORMATION','ADMIN','LIBRE'].includes(ev.type)?ev.type:'ADMIN';
        ev.eleve=ev.eleve!=null?String(ev.eleve):'';
        ev.eleveId=ev.eleveId!=null?String(ev.eleveId):'';
        ev.matiere=ev.matiere!=null?String(ev.matiere):'';
        ev.title=ev.title!=null?String(ev.title):'';
        ev.detail=ev.detail!=null?String(ev.detail):'';
        ev.local=ev.local!=null?String(ev.local):'';
        ev.dayIndex=Number.isInteger(Number(ev.dayIndex))?Number(ev.dayIndex):Number(defaults.dayIndex??0);
        if(ev.dayIndex<0||ev.dayIndex>4)ev.dayIndex=0;
        ev.date=ev.date?String(ev.date):(defaults.date||'');
        ev.startPeriod=periods.includes(ev.startPeriod)?ev.startPeriod:(defaults.startPeriod||periods[0]);
        ev.endPeriod=periods.includes(ev.endPeriod)?ev.endPeriod:ev.startPeriod;
        if(periodIndex(ev.endPeriod)<periodIndex(ev.startPeriod))ev.endPeriod=ev.startPeriod;
        const defaultStatus=defaults.status||'confirmed';
        ev.eventStatus=['proposed','confirmed','realized','cancelled'].includes(ev.eventStatus)?ev.eventStatus:defaultStatus;
        ev.realized=Boolean(ev.realized||ev.eventStatus==='realized');
        ev.realizedAt=ev.realizedAt?String(ev.realizedAt):null;
        if(ev.realized&&!ev.realizedAt)ev.realizedAt=new Date().toISOString();
        ev.createdAt=ev.createdAt?String(ev.createdAt):new Date().toISOString();
        ev.updatedAt=new Date().toISOString();
        ev.timezone=ev.timezone?String(ev.timezone):'Europe/Brussels';
        const o=ev.outlook&&typeof ev.outlook==='object'&&!Array.isArray(ev.outlook)?ev.outlook:{};
        ev.outlook={calendarId:o.calendarId?String(o.calendarId):null,eventId:o.eventId?String(o.eventId):null,iCalUId:o.iCalUId?String(o.iCalUId):null,changeKey:o.changeKey?String(o.changeKey):null,webLink:o.webLink?String(o.webLink):null};
        if(ev.recurrence==='weekly')ev.date='';
        else ev.seriesId=null;
        return ev;
    }

    function legacyAgendaEvents(source,ownerId){
        const events=[];
        const slots=[];
        Object.entries(source||{}).forEach(([key,value])=>{
            if(key==='__uniqueEvents'||key==='__exceptions'||key==='__config'||key==='__events')return;
            if(!/^\d+_.+$/.test(key)||!value||typeof value!=='object'||Array.isArray(value))return;
            const [dayRaw,...rest]=key.split('_');
            const dayIndex=Number(dayRaw),period=rest.join('_');
            if(dayIndex<0||dayIndex>4||!periods.includes(period))return;
            slots.push({key,dayIndex,period,value});
        });
        const grouped=new Map();
        for(const slot of slots){
            const explicitId=slot.value.eventId?String(slot.value.eventId):'';
            const contentKey=JSON.stringify([
                slot.value.type||'',slot.value.eleveId||'',slot.value.eleve||'',slot.value.matiere||'',
                slot.value.title||'',slot.value.detail||'',slot.value.local||''
            ]);
            const key=`${slot.dayIndex}|${explicitId?`id:${explicitId}`:`content:${contentKey}`}`;
            if(!grouped.has(key))grouped.set(key,[]);
            grouped.get(key).push(slot);
        }
        for(const group of grouped.values()){
            group.sort((a,b)=>periodIndex(a.period)-periodIndex(b.period));
            let run=[];let previous=-2;
            const flush=()=>{
                if(!run.length)return;
                const first=run[0],last=run[run.length-1];
                const base={...first.value,eventId:first.value.eventId||`legacy_${first.dayIndex}_${first.period}_${journalierUuid('x')}`,dayIndex:first.dayIndex,startPeriod:first.period,endPeriod:last.period,recurrence:'weekly',seriesId:first.value.seriesId||first.value.eventId||null};
                events.push(normalizeAgendaEvent(base,ownerId,{dayIndex:first.dayIndex,startPeriod:first.period,status:'confirmed'}));
                run=[];
            };
            for(const slot of group){
                const idx=periodIndex(slot.period);
                if(idx!==previous+1)flush();
                run.push(slot);previous=idx;
            }
            flush();
        }
        return events;
    }

    function normalizeAgendaData(prev,ownerId=JournalierSecurity.accountKey){
        const source=prev&&typeof prev==='object'?prev:{};
        const config=normalizeAgendaConfig(source.__config);
        applyAgendaPeriodConfig(config);
        const out={__events:[],__exceptions:{},__config:{version:2,periods:config.map(p=>({...p}))}};
        if(source.__exceptions&&typeof source.__exceptions==='object'&&!Array.isArray(source.__exceptions))out.__exceptions=JSON.parse(JSON.stringify(source.__exceptions));
        const seen=new Set();
        const push=(item,defaults)=>{
            const ev=normalizeAgendaEvent(item,ownerId,defaults);
            if(!seen.has(ev.eventId)){seen.add(ev.eventId);out.__events.push(ev);}
        };
        if(Array.isArray(source.__events))source.__events.forEach(ev=>push(ev,{status:'confirmed'}));
        if(Array.isArray(source.__uniqueEvents))source.__uniqueEvents.forEach(ev=>push({...ev,recurrence:'unique',date:ev.date||ev.occurrenceDate},{status:'confirmed'}));
        legacyAgendaEvents(source,ownerId).forEach(ev=>push(ev,{status:'confirmed'}));
        out.__events.sort((a,b)=>String(a.date||a.dayIndex).localeCompare(String(b.date||b.dayIndex))||periodIndex(a.startPeriod)-periodIndex(b.startPeriod)||a.eventId.localeCompare(b.eventId));
        return out;
    }

    function normalizePrevisionnel(prev){
        return normalizeAgendaData(prev,JournalierSecurity.accountKey);
    }

    function getPrevisionnel(){return normalizePrevisionnel(DataStore.getAgenda());}

    function savePrevisionnel(prev){
        const candidate=normalizePrevisionnel(prev||{});
        DataStore.saveAgenda(candidate);
        const persisted=normalizePrevisionnel(DataStore.getAgenda());
        renderAgenda();
        return persisted;
    }

    function updateStudentDropdowns(){
        const students=getStudents();
        ['f-eleve','r-eleve','modal-slot-eleve'].forEach(id=>{
            const el=document.getElementById(id);if(!el)return;
            const current=el.value;el.replaceChildren();
            const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='-- Choisir un élève --';el.appendChild(placeholder);
            students.forEach(s=>{const o=document.createElement('option');o.value=String(s.nom??'');o.textContent=`${s.nom??''} (${s.classe??''}${s.ecole?' - '+s.ecole:''})`;el.appendChild(o);});
            if(current)el.value=current;
        });
    }

    function getTodayInApp(){
        const now=new Date();let iso=formatISO(now);if(iso<'2026-08-24'||iso>'2027-07-02')iso=selectedDateISO;return iso;
    }

    function eventOccursOnDate(event,iso,prev=null){
        if(!event)return false;
        if(event.recurrence==='unique')return event.date===iso;
        if(getDayIndexFromISO(iso)!==Number(event.dayIndex))return false;
        const seriesKey=String(event.seriesId||event.eventId||'');
        const excluded=prev?.__exceptions?.[seriesKey];
        return !(Array.isArray(excluded)&&excluded.includes(iso));
    }

    function getEventsForDate(iso,prev=getPrevisionnel()){
        return (prev.__events||[]).filter(ev=>eventOccursOnDate(ev,iso,prev)).map(ev=>({...ev,occurrenceDate:iso,...agendaEventIndexes(ev)}));
    }

    function getEventsForDatePeriod(iso,period,prev=getPrevisionnel()){
        const pIdx=periodIndex(period);
        return getEventsForDate(iso,prev).filter(ev=>pIdx>=ev.startIndex&&pIdx<=ev.endIndex);
    }

    function findAgendaEventForOccurrence(iso,eventId,prev=getPrevisionnel()){
        return getEventsForDate(iso,prev).find(ev=>String(ev.eventId)===String(eventId))||null;
    }

    function getEventForDatePeriod(iso,period,prev=getPrevisionnel()){
        return getEventsForDatePeriod(iso,period,prev)[0]||null;
    }

    function getEventLabel(event){
        if(!event)return 'Activité';
        if(event.type==='ELEVE')return event.eleve||'Accompagnement élève';
        if(event.type==='FORMATION')return event.title||'Formation';
        if(event.type==='COLLAB')return event.title||'Collaboration';
        if(event.type==='ADMIN')return event.title||'Tâche administrative';
        return event.title||'Créneau libre';
    }

    function getEventMeta(event){
        if(!event)return '';
        if(event.type==='ELEVE')return [event.matiere,event.local].filter(Boolean).join(' · ');
        return event.detail||'';
    }

    function getEventState(event,dayIdx,iso,db){
        if(event?.eventStatus==='cancelled')return {key:'cancelled',label:'Annulé'};
        const encoded=event?.type==='ELEVE'?getEncodedForEvent(dayIdx,iso,event,db):null;
        if(encoded)return {key:'realized',label:'Séance enregistrée',encoded};
        if(event?.realized||event?.eventStatus==='realized')return {key:'realized',label:'Réalisé'};
        if(event?.eventStatus==='confirmed')return {key:'confirmed',label:'Confirmé'};
        return {key:'proposed',label:'Proposition'};
    }

    function getEventClass(event,state){
        if(state?.key==='realized')return 'event-encoded';
        if(state?.key==='cancelled')return 'event-cancelled';
        if(event?.type==='FORMATION')return 'event-formation';
        if(event?.type==='COLLAB')return 'event-collab';
        if(event?.type==='ADMIN')return 'event-admin';
        return 'event-eleve';
    }

    function getEncodedForEvent(dayIdx,isoDate,event,db){
        if(!event||event.type!=='ELEVE')return null;
        const {start,end}=agendaEventIndexes(event);
        return (db||[]).find(item=>{
            const sp=sessionParts(item);
            if(sp.date!==isoDate)return false;
            if(event.eleveId&&item.identification?.eleveId&&String(event.eleveId)!==String(item.identification.eleveId))return false;
            if(sp.eleve!==event.eleve)return false;
            if(event.matiere&&sp.matiere&&sp.matiere!==event.matiere)return false;
            const itemStart=periodIndex(sp.start),itemEnd=periodIndex(sp.end||sp.start);
            if(itemStart<0||itemEnd<0)return false;
            return itemStart<=end&&itemEnd>=start;
        })||null;
    }

    function renderHome(){
        const iso=getTodayInApp(),dt=parseISODate(iso),label=dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        const dateEl=document.getElementById('home-today-date');if(dateEl)dateEl.textContent=label.charAt(0).toUpperCase()+label.slice(1);
        const list=document.getElementById('home-today-list');if(!list)return;
        const db=getDB(),events=getEventsForDate(iso),pending=[];
        if(getDayIndexFromISO(iso)>4){list.innerHTML='<div class="home-empty">Aucune journée scolaire dans la période actuelle.</div>';}
        else{
            const seen=new Set();let html='';
            events.sort((a,b)=>a.startIndex-b.startIndex||a.endIndex-b.endIndex).forEach(ev=>{
                if(seen.has(ev.eventId))return;seen.add(ev.eventId);
                const state=getEventState(ev,getDayIndexFromISO(iso),iso,db);
                if(ev.type==='ELEVE'&&state.key!=='realized')pending.push(ev);
                const range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod} → ${ev.endPeriod}`;
                html+=`<div class="home-row js-home-event" data-iso="${escapeHtml(iso)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-day-index="${getDayIndexFromISO(iso)}" data-event-id="${escapeHtml(ev.eventId)}"><div class="home-period">${escapeHtml(range)}</div><div><div class="home-event-title">${escapeHtml(getEventLabel(ev))}</div><div class="home-event-meta">${escapeHtml(getEventMeta(ev)||'Mission Pôle Territorial')}</div></div><span class="status-badge agenda-status-${state.key}">${escapeHtml(state.label)}</span></div>`;
            });
            list.innerHTML=html||'<div class="home-empty">Aucun événement planifié aujourd’hui.</div>';
        }
        const countEl=document.getElementById('home-pending-count');if(countEl)countEl.textContent=pending.length;
        const task=document.getElementById('home-task-list');if(task)task.innerHTML=pending.slice(0,5).map(ev=>`<li><strong>${escapeHtml(ev.eleve)}</strong> · ${escapeHtml(ev.startPeriod)}${ev.endPeriod!==ev.startPeriod?' → '+escapeHtml(ev.endPeriod):''} · ${escapeHtml(ev.matiere||'')}</li>`).join('')||'<li>Rien à traiter pour le moment.</li>';
    }

    function switchAgendaView(mode){agendaMode=['day','week','month'].includes(mode)?mode:'day';['day','week','month'].forEach(m=>document.getElementById(`vbtn-${m}`)?.classList.toggle('active',m===agendaMode));renderAgenda();}
    function todayAgenda(){selectedDateISO=getTodayInApp();renderAgenda();}
    function navigateAgenda(delta){const d=parseISODate(selectedDateISO);if(agendaMode==='day')d.setDate(d.getDate()+delta);else if(agendaMode==='week')d.setDate(d.getDate()+delta*7);else d.setMonth(d.getMonth()+delta);selectedDateISO=formatISO(d);renderAgenda();}
    function pickerDateChanged(val){if(!val)return;selectedDateISO=val;renderAgenda();}

    function renderAgenda(){
        const picker=document.getElementById('agenda-picker-input');if(picker)picker.value=selectedDateISO;
        const reportDate=document.getElementById('r-date-anchor');if(reportDate)reportDate.value=selectedDateISO;
        ['day','week','month'].forEach(m=>document.getElementById(`agenda-view-${m}`)?.classList.toggle('hidden',m!==agendaMode));
        if(agendaMode==='day')renderDayView();else if(agendaMode==='week')renderWeekView();else renderMonthView();
    }

    function renderDayView(){
        const dt=parseISODate(selectedDateISO),label=dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        document.getElementById('agenda-date-label').innerText=label.charAt(0).toUpperCase()+label.slice(1);
        const dayView=document.getElementById('agenda-view-day'),db=getDB(),prev=getPrevisionnel(),dayIdx=getDayIndexFromISO(selectedDateISO);
        const events=getEventsForDate(selectedDateISO,prev).sort((a,b)=>a.startIndex-b.startIndex||a.endIndex-b.endIndex||a.eventId.localeCompare(b.eventId));
        const laneEnds=[];events.forEach(ev=>{let lane=laneEnds.findIndex(end=>end<ev.startIndex);if(lane<0)lane=laneEnds.length;ev.lane=lane;laneEnds[lane]=ev.endIndex;});
        const laneCount=Math.max(1,laneEnds.length);let html=dayIdx>4?'<div class="day-weekend-note" style="grid-column:1/-1;padding:4px 0 8px;color:#64748b;font-size:.78rem;">Week-end : seuls les événements uniques sont affichés.</div>':'';
        periods.forEach((period,index)=>{
            const time=agendaPeriodByLabel(period);const eventsHere=events.filter(ev=>ev.startIndex<=index&&ev.endIndex>=index);
            html+=`<div class="day-period-label" style="grid-column:1;grid-row:${index+1};"><strong>${escapeHtml(period)}</strong><small>${escapeHtml(`${time.start}–${time.end}`)}</small></div>`;
            if(!eventsHere.length)html+=`<div class="day-free-slot" style="grid-column:2;grid-row:${index+1};"><span>Créneau libre</span><button class="btn-secondary focus-ring js-open-slot" data-force-create="true" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(period)}" data-day-index="${dayIdx}" style="padding:7px 10px;font-size:.74rem;border-radius:8px;cursor:pointer;">Programmer</button></div>`;
            else html+=`<div class="day-overlap-add" style="grid-column:2;grid-row:${index+1};"><button type="button" class="btn-secondary focus-ring js-open-slot" data-force-create="true" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(period)}" data-day-index="${dayIdx}">＋ Ajouter sur ce créneau</button></div>`;
        });
        events.forEach(ev=>{
            const state=getEventState(ev,dayIdx,selectedDateISO,db),span=ev.endIndex-ev.startIndex+1,range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod} → ${ev.endPeriod}`,cls=getEventClass(ev,state),meta=getEventMeta(ev)||'Mission Pôle Territorial';
            html+=`<div class="day-event-layer" style="grid-column:2;grid-row:${ev.startIndex+1} / span ${span};--event-lane-left:${ev.lane*100/laneCount}%;--event-lane-width:${100/laneCount}%;"><button type="button" class="day-event-card ${cls} js-day-event" data-iso="${escapeHtml(selectedDateISO)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-day-index="${dayIdx}" data-event-id="${escapeHtml(ev.eventId)}" aria-label="${escapeHtml(`${getEventLabel(ev)} · ${range} · ${state.label}`)}"><span class="status-badge agenda-status-${state.key}">${escapeHtml(state.label)}</span><span class="slot-info-main"><span class="slot-title">${escapeHtml(getEventLabel(ev))}</span><span class="slot-meta">${escapeHtml(meta)}${ev.recurrence==='unique'?' · Unique':' · Hebdomadaire'}</span></span><span class="week-event-range">${escapeHtml(range)}</span></button>${ev.type==='ELEVE'&&state.key!=='realized'&&state.key!=='cancelled'?`<button type="button" class="day-event-encode btn-primary focus-ring js-quick-form" data-iso="${escapeHtml(selectedDateISO)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-eleve="${escapeHtml(ev.eleve)}" data-matiere="${escapeHtml(ev.matiere||'')}" style="padding:6px 9px;font-size:.7rem;border-radius:7px;cursor:pointer;">Encoder</button>`:''}</div>`;
        });
        dayView.innerHTML=html;dayView.classList.add('day-timeline-grid');
    }

    function periodIndex(period){return periods.indexOf(period);}
    function syncSessionPeriodRange(){const start=document.getElementById('f-periode-start'),end=document.getElementById('f-periode-end');if(!start||!end)return;const si=periodIndex(start.value),ei=periodIndex(end.value);if(si<0)return;if(ei<si)end.value=start.value;[...end.options].forEach((o,i)=>o.disabled=i<si);}
    function getSlotKey(dayIdx,period){return `${dayIdx}_${period}`;}
    function getDayIndexFromISO(iso){const d=parseISODate(iso),dow=d.getDay();return dow===0?6:dow-1;}

    function getEncodedEventId(event,iso,db){return getEncodedForEvent(getDayIndexFromISO(iso),iso,event,db);}

    function renderWeekView(){
        const monday=getMonday(parseISODate(selectedDateISO)),weekDates=[];for(let i=0;i<5;i++)weekDates.push(new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i));
        const startStr=weekDates[0].toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),endStr=weekDates[4].toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
        document.getElementById('agenda-date-label').innerText=`Semaine du ${startStr} au ${endStr}`;
        const weekView=document.getElementById('agenda-view-week'),db=getDB(),prev=getPrevisionnel();let html='<div class="agenda-header-week">Période</div>';
        weekDates.forEach((d,idx)=>{const iso=formatISO(d),dateStr=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});html+=`<div class="agenda-header-week ${iso===selectedDateISO?'today-column':''} js-week-day" style="grid-column:${idx+2};grid-row:1;" data-iso="${escapeHtml(iso)}">${days[idx]}<br><span style="font-weight:600;font-size:.78rem;color:var(--primary);">${dateStr}</span></div>`;});
        periods.forEach((p,i)=>{const t=agendaPeriodByLabel(p);html+=`<div class="period-col-week" style="grid-column:1;grid-row:${i+2};"><strong>${escapeHtml(p)}</strong><small>${escapeHtml(`${t.start}–${t.end}`)}</small></div>`;});
        weekDates.forEach((d,dayIdx)=>{
            const iso=formatISO(d),events=getEventsForDate(iso,prev),laneEnds=[],occupied=new Set();
            events.forEach(ev=>{let lane=laneEnds.findIndex(end=>end<ev.startIndex);if(lane<0)lane=laneEnds.length;ev.lane=lane;laneEnds[lane]=ev.endIndex;for(let i=ev.startIndex;i<=ev.endIndex;i++)occupied.add(i);});
            const laneCount=Math.max(1,laneEnds.length);
            events.forEach(ev=>{const state=getEventState(ev,dayIdx,iso,db),span=ev.endIndex-ev.startIndex+1,cls=getEventClass(ev,state),meta=getEventMeta(ev);html+=`<div class="slot-cell-week week-event-cell week-event-overlay" style="grid-column:${dayIdx+2};grid-row:${ev.startIndex+2} / span ${span};--event-lane-left:${ev.lane*100/laneCount}%;--event-lane-width:${100/laneCount}%;"><div class="week-event ${cls} js-week-event" data-iso="${escapeHtml(iso)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-day-index="${dayIdx}" data-event-id="${escapeHtml(ev.eventId)}"><div class="week-event-title">${escapeHtml(state.key==='realized'?'✓ ':'')}${escapeHtml(getEventLabel(ev))}</div>${meta?`<div class="week-event-meta">${escapeHtml(meta)}</div>`:''}<div class="week-event-range">${escapeHtml(ev.startPeriod)}${ev.endPeriod!==ev.startPeriod?' → '+escapeHtml(ev.endPeriod):''} · ${escapeHtml(state.label)}</div></div></div>`;});
            periods.forEach((p,i)=>{html+=`<div class="slot-cell-week week-event-cell js-week-slot ${occupied.has(i)?'week-slot-occupied':''}" data-force-create="true" style="grid-column:${dayIdx+2};grid-row:${i+2};" data-iso="${escapeHtml(iso)}" data-period="${escapeHtml(p)}" data-day-index="${dayIdx}"><div class="week-slot-free">＋ ${occupied.has(i)?'Ajouter':'Programmer'}</div></div>`;});
        });
        weekView.innerHTML=html;
    }

    function renderMonthView(){
        const dt=parseISODate(selectedDateISO),year=dt.getFullYear(),month=dt.getMonth();
        const monthName=dt.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});document.getElementById('agenda-date-label').innerText=monthName.charAt(0).toUpperCase()+monthName.slice(1);
        const monthView=document.getElementById('agenda-view-month'),db=getDB(),prev=getPrevisionnel(),first=new Date(year,month,1),last=new Date(year,month+1,0);let start=first.getDay();start=start===0?6:start-1;let html='';['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(w=>html+=`<div class="month-day-header">${w}</div>`);
        const prevLast=new Date(year,month,0).getDate();for(let i=start-1;i>=0;i--)html+=`<div class="month-date-cell other-month"><div class="month-day-number">${prevLast-i}</div></div>`;
        for(let day=1;day<=last.getDate();day++){
            const cell=new Date(year,month,day),iso=formatISO(cell),dayIdx=getDayIndexFromISO(iso),events=getEventsForDate(iso,prev),pills=[];const max=4;
            events.slice(0,max).forEach(ev=>{const state=getEventState(ev,dayIdx,iso,db),cls=ev.type==='FORMATION'?'event-formation':ev.type==='COLLAB'?'event-collab':ev.type==='ADMIN'?'event-admin':'';const label=ev.type==='ELEVE'?[getEventLabel(ev),getEventMeta(ev)].filter(Boolean).join(' · '):getEventLabel(ev);const range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod}–${ev.endPeriod}`;pills.push(`<div class="month-indicator-pill month-planned-pill ${cls} agenda-status-${state.key}" title="${escapeHtml(label)} — ${escapeHtml(range)}"><span class="month-planned-dot"></span><span class="month-planned-label">${escapeHtml(state.key==='realized'?'✓ ':'')}${escapeHtml(label)}</span><span class="month-period-range">${escapeHtml(range)}</span></div>`);});
            const more=Math.max(0,events.length-max);if(more)pills.push(`<div class="month-more-pill">+ ${more} autre${more>1?'s':''}</div>`);
            html+=`<div class="month-date-cell ${iso===selectedDateISO?'today':''} js-month-day" data-iso="${escapeHtml(iso)}"><div class="month-day-number">${day}</div><div class="month-indicators">${pills.join('')}</div></div>`;
        }
        monthView.innerHTML=html;
    }

    function jumpToDayView(isoDate){selectedDateISO=isoDate;switchAgendaView('day');}
    function viewSlotDetails(id){const entry=getDB().find(e=>e.id==id);if(entry&&isJournalSession(entry)){const p=sessionParts(entry),q2=entry.q2||{},q4=entry.q4||{},q6=entry.q6||{};alert(`👤 ${p.eleve}\n📅 ${p.date} (${sessionPeriodLabel(entry)}) — ${p.matiere}\n\n• Interventions : ${(entry.contexte?.typeIntervention||[]).join(', ')||'N/A'}\n• Fonctionnement : ${(q2.observations||[]).map(x=>x.observation).join(', ')||'Aucune'}\n• Adaptations : ${(q4.types||[]).join(', ')||'Aucune'}\n• Suites : ${(q6.actions||[]).join(', ')||'Aucune'}`);}}

    function quickFormForSlot(dateIso,period,eleve,matiere){clearObservationForm();document.getElementById('f-date').value=dateIso;document.getElementById('f-periode-start').value=period;document.getElementById('f-periode-end').value=period;syncSessionPeriodRange();if(eleve)document.getElementById('f-eleve').value=eleve;if(matiere){const input=document.getElementById('f-matiere');input.value=matiere;input.dataset.selectedSubject=matiere;const note=document.getElementById('session-subject-selected-note');if(note)note.textContent=`Matière sélectionnée : ${matiere}`;}updatePIAPrompt();showTab('form');}

    function populatePeriodSelectors(startValue,endValue){const start=document.getElementById('modal-slot-period-start'),end=document.getElementById('modal-slot-period-end');if(!start||!end)return;const options=periods.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');start.innerHTML=options;end.innerHTML=options;start.value=startValue||periods[0];end.value=endValue||startValue||periods[0];syncAgendaEndPeriod();start.onchange=syncAgendaStartPeriod;end.onchange=syncAgendaEndPeriod;}
    function syncAgendaEndPeriod(){const start=document.getElementById('modal-slot-period-start'),end=document.getElementById('modal-slot-period-end');if(!start||!end)return;const si=periodIndex(start.value),ei=periodIndex(end.value);if(ei<si)end.value=start.value;[...end.options].forEach((o,i)=>o.disabled=i<si);}
    function syncAgendaStartPeriod(){syncAgendaEndPeriod();}
    window.JournalierAgendaConfig={refreshSessionPeriodSelectors(){const start=document.getElementById('f-periode-start')?.value||periods[0];const end=document.getElementById('f-periode-end')?.value||start;populatePeriodSelectors(start,end);syncSessionPeriodRange();},getPeriods(){return agendaPeriodConfig.map(p=>({...p}));},getOccurrenceDateTime(event,iso){const start=agendaPeriodByLabel(event?.startPeriod),end=agendaPeriodByLabel(event?.endPeriod||event?.startPeriod);if(!start||!end||!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return null;return {timezone:event?.timezone||'Europe/Brussels',start:`${iso}T${start.start}:00`,end:`${iso}T${end.end}:00`};}};
    function toggleDuplicateFields(){const enabled=Boolean(document.getElementById('modal-duplicate-enabled')?.checked);document.getElementById('modal-duplicate-fields')?.classList.toggle('hidden',!enabled);}
    function updateRecurrenceNote(){const mode=document.getElementById('modal-slot-recurrence')?.value||'weekly';const note=document.getElementById('modal-slot-recurrence-note');if(note)note.textContent=mode==='unique'?'Cette activité aura lieu uniquement à la date choisie.':'Cette activité sera répétée chaque semaine le même jour.';}

    function buildAgendaActivityFromModal(type,startPeriod,endPeriod){
        const base={type,startPeriod,endPeriod,eventStatus:'proposed',realized:false};
        if(type==='ELEVE'){
            const name=document.getElementById('modal-slot-eleve').value;const student=getStudents().find(s=>String(s.nom)===String(name));
            return {...base,eleve:name,eleveId:student?.studentId||'',matiere:document.getElementById('modal-slot-matiere').value,local:document.getElementById('modal-slot-local').value};
        }
        if(type==='LIBRE')return {...base,title:'Créneau libre',detail:''};
        return {...base,title:document.getElementById('modal-slot-admin-title').value||'Activité Pôle',detail:document.getElementById('modal-slot-admin-detail').value||''};
    }

    function removeRecurringSeries(prev,seriesId){prev.__events=(prev.__events||[]).filter(ev=>ev.seriesId!==seriesId&&ev.eventId!==seriesId);if(prev.__exceptions)delete prev.__exceptions[seriesId];}
    function removeUniqueEvent(prev,eventId){prev.__events=(prev.__events||[]).filter(ev=>!(ev.eventId===eventId&&ev.recurrence==='unique'));}

    function openSlotModal(dateIso,period,dayIdx,eventId=null,forceCreate=false){
        const prev=getPrevisionnel(),event=!forceCreate&&(eventId?findAgendaEventForOccurrence(dateIso,eventId,prev):getEventForDatePeriod(dateIso,period,prev)),edit=Boolean(event);
        agendaModalState={mode:edit?'edit':'create',eventId:event?.eventId||null,recurrence:event?.recurrence||null,occurrenceDate:dateIso,sourceEvent:event||null};
        document.getElementById('modal-slot-date').value=dateIso;document.getElementById('modal-slot-date-visible').value=dateIso;document.getElementById('modal-slot-period').value=period;document.getElementById('modal-slot-event-id').value=event?.eventId||'';document.getElementById('modal-slot-edit-mode').value=edit?'edit':'create';document.getElementById('modal-slot-title').innerText=edit?'Modifier l’activité':`Programmer une activité${dayIdx>=0&&dayIdx<=4?' · '+days[dayIdx]:''}`;
        document.getElementById('modal-slot-admin-title').value='';document.getElementById('modal-slot-admin-detail').value='';document.getElementById('modal-slot-local').value='';document.getElementById('modal-duplicate-enabled').checked=false;document.getElementById('modal-duplicate-date').value='';toggleDuplicateFields();populatePeriodSelectors(event?.startPeriod||period,event?.endPeriod||period);
        document.getElementById('modal-slot-recurrence').value=event?.recurrence||'weekly';updateRecurrenceNote();
        document.getElementById('modal-slot-type').value=event?.type||'ELEVE';
        if(event?.type==='ELEVE'){document.getElementById('modal-slot-eleve').value=event.eleve||'';document.getElementById('modal-slot-matiere').value=event.matiere||'Mathématiques';document.getElementById('modal-slot-local').value=event.local||'';}
        else{document.getElementById('modal-slot-eleve').value='';document.getElementById('modal-slot-matiere').value='Mathématiques';document.getElementById('modal-slot-admin-title').value=event?.title||'';document.getElementById('modal-slot-admin-detail').value=event?.detail||'';}
        toggleModalSlotFields();document.getElementById('slotModal').classList.remove('hidden');
    }

    function openDuplicateEventModal(isoDate,period,dayIdx,eventId){const event=findAgendaEventForOccurrence(isoDate,eventId,getPrevisionnel());if(!event)return;openSlotModal(isoDate,period,dayIdx,eventId);agendaModalState={mode:'duplicate',eventId:event.eventId,recurrence:event.recurrence,occurrenceDate:isoDate,sourceEvent:event};document.getElementById('modal-slot-edit-mode').value='duplicate';document.getElementById('modal-slot-title').innerText='Dupliquer l’activité';document.getElementById('modal-slot-recurrence').value='unique';updateRecurrenceNote();document.getElementById('modal-duplicate-enabled').checked=true;toggleDuplicateFields();}
    function toggleModalSlotFields(){const type=document.getElementById('modal-slot-type').value;document.getElementById('modal-fields-eleve').classList.toggle('hidden',type!=='ELEVE');document.getElementById('modal-fields-autre').classList.toggle('hidden',type==='ELEVE'||type==='LIBRE');}
    function closeSlotModal(){closeAllChoiceMenus();document.getElementById('slotModal').classList.add('hidden');}

    function rangesOverlap(a,b){return a.startIndex<=b.endIndex&&b.startIndex<=a.endIndex;}
    function getOverlappingEvents(iso,dateStart,dateEnd,prev,excludeId=null){return getEventsForDate(iso,prev).filter(ev=>ev.eventId!==excludeId&&rangesOverlap({startIndex:dateStart,endIndex:dateEnd},ev));}

    function saveSlotModification(){
        const sourceDateIso=document.getElementById('modal-slot-date-visible').value||document.getElementById('modal-slot-date').value,type=document.getElementById('modal-slot-type').value,recurrence=document.getElementById('modal-slot-recurrence').value||'weekly',startPeriod=document.getElementById('modal-slot-period-start').value,endPeriod=document.getElementById('modal-slot-period-end').value,mode=agendaModalState.mode||document.getElementById('modal-slot-edit-mode').value||'create',duplicateTargetDate=document.getElementById('modal-duplicate-date').value,dateIso=mode==='duplicate'?duplicateTargetDate:sourceDateIso,dayIdx=getDayIndexFromISO(dateIso),startIdx=periodIndex(startPeriod),endIdx=periodIndex(endPeriod);
        if(!dateIso){alert('Choisissez une date.');return;}if(recurrence==='weekly'&&(dayIdx<0||dayIdx>4)){alert('Une planification récurrente hebdomadaire doit être placée du lundi au vendredi.');return;}if(startIdx<0||endIdx<startIdx){alert('La période de fin doit être identique ou postérieure à la période de début.');return;}if(type==='ELEVE'&&!document.getElementById('modal-slot-eleve').value){alert('Sélectionnez un élève.');return;}
        const prev=getPrevisionnel(),working=JSON.parse(JSON.stringify(prev)),editingEventId=mode==='edit'?agendaModalState.eventId:null,editingRecurrence=mode==='edit'?agendaModalState.recurrence:null;
        if(editingEventId){if(editingRecurrence==='unique')removeUniqueEvent(working,editingEventId);else removeRecurringSeries(working,editingEventId);}
        const draft=buildAgendaActivityFromModal(type,startPeriod,endPeriod);draft.eventId=editingEventId||journalierUuid('evt');draft.ownerId=JournalierSecurity.accountKey;draft.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;draft.recurrence=recurrence;draft.dayIndex=dayIdx;draft.date=recurrence==='unique'?dateIso:'';draft.seriesId=recurrence==='weekly'?draft.eventId:null;
        if(mode==='edit'&&agendaModalState.sourceEvent){draft.eventStatus=agendaModalState.sourceEvent.eventStatus;draft.realized=agendaModalState.sourceEvent.realized;draft.realizedAt=agendaModalState.sourceEvent.realizedAt;draft.outlook=agendaModalState.sourceEvent.outlook;draft.createdAt=agendaModalState.sourceEvent.createdAt;}
        working.__events=Array.isArray(working.__events)?working.__events:[];working.__events.push(normalizeAgendaEvent(draft,JournalierSecurity.accountKey));
        if(mode!=='duplicate'&&document.getElementById('modal-duplicate-enabled').checked&&duplicateTargetDate){const duplicate={...draft,eventId:journalierUuid('evt'),recurrence:'unique',seriesId:null,date:duplicateTargetDate,eventStatus:'proposed',realized:false,realizedAt:null,outlook:{calendarId:null,eventId:null,iCalUId:null,changeKey:null,webLink:null}};working.__events.push(normalizeAgendaEvent(duplicate,JournalierSecurity.accountKey));}
        try{savePrevisionnel(working);closeSlotModal();renderAgenda();renderHome();showAppToast(mode==='duplicate'?'Activité dupliquée.':'Activité enregistrée.','success');}catch(error){console.error('Agenda — erreur lors de l’enregistrement',error);showAppToast(`Échec de l’enregistrement : ${error?.message||error}`,'error',5000);}
    }

    function openEventActionModal(isoDate,period,dayIdx,eventId){
        closeAllChoiceMenus();const prev=getPrevisionnel(),event=findAgendaEventForOccurrence(isoDate,eventId,prev)||getEventForDatePeriod(isoDate,period,prev);if(!event){openSlotModal(isoDate,period,dayIdx);return;}
        agendaModalState={...agendaModalState,eventId:event.eventId,recurrence:event.recurrence,occurrenceDate:isoDate,sourceEvent:event};
        document.getElementById('event-action-title').innerText=getEventLabel(event);
        const state=getEventState(event,dayIdx,isoDate,getDB()),summary=document.getElementById('event-action-summary');
        if(summary){summary.innerHTML=`<strong>${escapeHtml(getEventLabel(event))}</strong><br>${escapeHtml(getEventMeta(event)||'Mission Pôle Territorial')}<br><span style="color:var(--text-sub);">${escapeHtml(event.occurrenceDate||isoDate)} · ${escapeHtml(event.startPeriod)}${event.endPeriod!==event.startPeriod?' → '+escapeHtml(event.endPeriod):''} · ${escapeHtml(state.label)}</span>`;}
        const observe=document.getElementById('event-action-observe');observe.textContent=event.type==='ELEVE'?(state.key==='realized'?'✏️ Modifier la séance':'📝 Encoder la séance'):'🗒️ Détail de la mission';observe.style.display='';observe.onclick=()=>{closeEventActionModal();if(event.type==='ELEVE'){const encoded=getEncodedForEvent(dayIdx,isoDate,event,getDB());if(encoded)editHistorySession(encoded.id);else quickFormForSlot(isoDate,event.startPeriod,event.eleve,event.matiere);}else openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        const confirm=document.getElementById('event-action-confirm');if(confirm){confirm.style.display=state.key==='realized'?'none':'';confirm.textContent=state.key==='confirmed'?'↩️ Remettre en proposition':(state.key==='cancelled'?'↩️ Réactiver':'✓ Confirmer l’événement');confirm.onclick=()=>toggleAgendaEventConfirmation(isoDate,event.eventId);}
        const realize=document.getElementById('event-action-realize');if(realize){realize.style.display=event.type==='ELEVE'||state.key==='cancelled'?'none':'';realize.textContent=state.key==='realized'?'↩️ Marquer non réalisé':'✓ Marquer comme réalisé';realize.onclick=()=>toggleAgendaEventRealized(isoDate,event.eventId);}
        const cancel=document.getElementById('event-action-cancel');if(cancel){cancel.style.display=state.key==='cancelled'?'none':'';cancel.onclick=()=>cancelAgendaEvent(event.eventId);}
        document.getElementById('event-action-edit').onclick=()=>{closeEventActionModal();openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-extend').onclick=()=>{closeEventActionModal();openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-duplicate').onclick=()=>{closeEventActionModal();openDuplicateEventModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-delete').onclick=()=>openEventDeleteModal(event);
        document.getElementById('eventActionModal').classList.remove('hidden');
    }

    function closeEventActionModal(){closeAllChoiceMenus();document.getElementById('eventActionModal').classList.add('hidden');}

    function toggleAgendaEventConfirmation(iso,eventId){const prev=getPrevisionnel(),events=getEventsForDate(iso,prev),event=events.find(e=>e.eventId===eventId);if(!event)return;const targetStatus=event.eventStatus==='confirmed'?'proposed':'confirmed';if(targetStatus==='confirmed'){events.filter(e=>e.eventId!==eventId&&e.eventStatus==='confirmed'&&rangesOverlap(e,event)).forEach(other=>{const stored=prev.__events.find(e=>e.eventId===other.eventId);if(stored)stored.eventStatus='proposed';});}const stored=prev.__events.find(e=>e.eventId===eventId);if(stored){stored.eventStatus=targetStatus;stored.updatedAt=new Date().toISOString();}savePrevisionnel(prev);closeEventActionModal();showAppToast(targetStatus==='confirmed'?'Événement confirmé.':'Événement remis en proposition.','success');}
    function toggleAgendaEventRealized(iso,eventId){const prev=getPrevisionnel(),stored=prev.__events.find(e=>e.eventId===eventId);if(!stored)return;stored.realized=!stored.realized;stored.eventStatus=stored.realized?'realized':'confirmed';stored.realizedAt=stored.realized?new Date().toISOString():null;stored.updatedAt=new Date().toISOString();savePrevisionnel(prev);closeEventActionModal();showAppToast(stored.realized?'Événement marqué comme réalisé.':'Événement remis en état non réalisé.','success');}
    function cancelAgendaEvent(eventId){const prev=getPrevisionnel(),stored=prev.__events.find(e=>e.eventId===eventId);if(!stored)return;stored.eventStatus='cancelled';stored.realized=false;stored.realizedAt=null;stored.updatedAt=new Date().toISOString();savePrevisionnel(prev);closeEventActionModal();showAppToast('Événement annulé.','success');}

    function openEventDeleteModal(event){agendaDeleteState={eventId:event.eventId,seriesId:event.seriesId||event.eventId,occurrenceDate:event.occurrenceDate,recurrence:event.recurrence};const summary=document.getElementById('event-delete-summary');if(summary)summary.innerHTML=`<strong>${escapeHtml(getEventLabel(event))}</strong><br>${escapeHtml(getEventMeta(event)||'Mission Pôle Territorial')}<br><span style="color:var(--text-sub);">${escapeHtml(event.occurrenceDate||selectedDateISO)} · ${escapeHtml(event.startPeriod)}${event.endPeriod!==event.startPeriod?' → '+escapeHtml(event.endPeriod):''}</span>`;const seriesActions=document.getElementById('event-delete-series-actions');if(seriesActions)seriesActions.style.display=event.recurrence==='weekly'?'flex':'none';const occurrence=document.getElementById('event-delete-occurrence');const series=document.getElementById('event-delete-series');if(occurrence)occurrence.textContent=event.recurrence==='weekly'?'🗑️ Supprimer cette occurrence uniquement':'🗑️ Supprimer l’événement';if(series)series.textContent='🗑️ Supprimer la série';closeEventActionModal();document.getElementById('eventDeleteModal').classList.remove('hidden');}
    function closeEventDeleteModal(){document.getElementById('eventDeleteModal').classList.add('hidden');agendaDeleteState={eventId:null,seriesId:null,occurrenceDate:null,recurrence:null};}
    document.getElementById('event-delete-occurrence')?.addEventListener('click',deleteAgendaOccurrence);
    document.getElementById('event-delete-series')?.addEventListener('click',deleteAgendaSeries);
    function deleteAgendaOccurrence(){const prev=getPrevisionnel();if(!agendaDeleteState.eventId)return;if(agendaDeleteState.recurrence==='weekly'){prev.__exceptions=prev.__exceptions||{};const dates=new Set(prev.__exceptions[agendaDeleteState.seriesId||agendaDeleteState.eventId]||[]);dates.add(agendaDeleteState.occurrenceDate);prev.__exceptions[agendaDeleteState.seriesId||agendaDeleteState.eventId]=[...dates];}else removeUniqueEvent(prev,agendaDeleteState.eventId);savePrevisionnel(prev);closeEventDeleteModal();showAppToast('Événement supprimé.','success');}
    function deleteAgendaSeries(){const prev=getPrevisionnel();if(!agendaDeleteState.eventId)return;removeRecurringSeries(prev,agendaDeleteState.seriesId||agendaDeleteState.eventId);if(agendaDeleteState.recurrence==='unique')removeUniqueEvent(prev,agendaDeleteState.eventId);savePrevisionnel(prev);closeEventDeleteModal();showAppToast('Événement supprimé.','success');}

    function openAgendaPeriodConfigModal(){
        const body=document.getElementById('agenda-period-config-body');if(!body)return;
        body.innerHTML=agendaPeriodConfig.map((p,i)=>`<div class="agenda-period-config-row"><div><strong>${escapeHtml(p.label)}</strong><span class="agenda-period-config-help">Période ${i+1} · les pauses sont les espaces entre deux périodes.</span></div><label>Début<input type="time" data-period-config-start="${i}" value="${escapeHtml(p.start)}"></label><label>Fin<input type="time" data-period-config-end="${i}" value="${escapeHtml(p.end)}"></label></div>`).join('');
        document.getElementById('agendaPeriodConfigModal').classList.remove('hidden');
    }
    function closeAgendaPeriodConfigModal(){document.getElementById('agendaPeriodConfigModal')?.classList.add('hidden');}
    function saveAgendaPeriodConfig(){
        const next=agendaPeriodConfig.map((p,i)=>({...p,start:document.querySelector(`[data-period-config-start="${i}"]`)?.value||p.start,end:document.querySelector(`[data-period-config-end="${i}"]`)?.value||p.end}));
        for(let i=0;i<next.length;i++){if(agendaTimeToMinutes(next[i].start)<0||agendaTimeToMinutes(next[i].end)<0||agendaTimeToMinutes(next[i].start)>=agendaTimeToMinutes(next[i].end)){alert(`Horaires invalides pour ${next[i].label}.`);return;}if(i>0&&agendaTimeToMinutes(next[i].start)<agendaTimeToMinutes(next[i-1].end)){alert(`La ${next[i].label} commence avant la fin de la période précédente. Une pause peut exister, mais les périodes ne peuvent pas se chevaucher.`);return;}}
        const prev=getPrevisionnel();prev.__config={version:2,periods:next};applyAgendaPeriodConfig(next);savePrevisionnel(prev);populatePeriodSelectors(document.getElementById('modal-slot-period-start')?.value,document.getElementById('modal-slot-period-end')?.value);syncSessionPeriodRange();closeAgendaPeriodConfigModal();renderAgenda();showAppToast('Horaires des 8 périodes enregistrés.','success');
    }

    document.getElementById('agenda-period-config-open')?.addEventListener('click',openAgendaPeriodConfigModal);
    document.getElementById('agenda-period-config-save')?.addEventListener('click',saveAgendaPeriodConfig);
    document.getElementById('agenda-period-config-cancel')?.addEventListener('click',closeAgendaPeriodConfigModal);
    document.getElementById('agenda-period-config-reset')?.addEventListener('click',()=>{applyAgendaPeriodConfig(DEFAULT_AGENDA_PERIODS);openAgendaPeriodConfigModal();});

    function sessionParts(entry){const i=entry?.identification||{},p=i.periode||{},c=entry?.contexte||{};return {eleve:i.eleve||'',date:i.date||'',start:p.start||'',end:p.end||'',matiere:c.matiere||''};}
    function sessionPeriodLabel(entry){const p=sessionParts(entry);return p.start&&p.end&&p.start!==p.end?`${p.start} → ${p.end}`:(p.start||p.end||'');}
    function sessionSortKey(entry){const p=sessionParts(entry);return `${p.date}${p.start}${p.end}`;}

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
        const student=students.find(s=>s.nom===p.eleve);
        if(!student)throw new Error('Élève introuvable dans le dossier courant.');
        const normalized=secureNormalizeSession({...entry, schemaVersion:JOURNALIER_ARCHITECTURE_VERSION, ownerId:DataStore.getIdentity().ownerId}, students);
        normalized.identification={...(normalized.identification||{}),eleveId:student.studentId};
        const db=getDB();
        const editingId=String(entry.id||'');
        if(editingId){
            const collision=db.find(item=>{
                if(!isJournalSession(item) || String(item.id)===editingId) return false;
                const x=sessionParts(item);
                const sameStudent=(item.identification?.eleveId&&item.identification.eleveId===student.studentId)||(x.eleve===p.eleve);
                return sameStudent&&x.date===p.date&&x.start===p.start&&x.end===p.end;
            });
            if(collision) throw new Error('Une autre séance existe déjà pour cet élève, cette date et cette période.');
        }
        const filtered=db.filter(item=>{
            if(!isJournalSession(item)) return true;
            // En mode édition, l'entrée d'origine est remplacée par son ID.
            if(editingId && String(item.id)===editingId) return false;
            const x=sessionParts(item);
            const sameStudent=(item.identification?.eleveId&&item.identification.eleveId===student.studentId)||(x.eleve===p.eleve);
            return !(sameStudent&&x.date===p.date&&x.start===p.start&&x.end===p.end);
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
        try{
            const current=sessionParts(currentEntry),previous=previousEntry?sessionParts(previousEntry):null;
            const agenda=getPrevisionnel();
            agenda.__events=Array.isArray(agenda.__events)?agenda.__events:[];
            const studentId=String(currentEntry.identification?.eleveId||'');
            const currentStart=periodIndex(current.start),currentEnd=periodIndex(current.end||current.start);
            const matches=(parts,entry)=>agenda.__events.filter(ev=>{
                if(ev.type!=='ELEVE'||ev.eventStatus==='cancelled'||ev.eleve!==parts.eleve)return false;
                if(entry?.identification?.eleveId&&ev.eleveId&&String(entry.identification.eleveId)!==String(ev.eleveId))return false;
                if(ev.matiere&&parts.matiere&&ev.matiere!==parts.matiere)return false;
                if(!eventOccursOnDate(ev,parts.date))return false;
                const r=agendaEventIndexes(ev),start=periodIndex(parts.start),end=periodIndex(parts.end||parts.start);
                return start>=0&&end>=0&&r.start<=end&&r.end>=start;
            });
            const changedLocation=Boolean(previous&&(
                previous.date!==current.date||previous.eleve!==current.eleve||previous.matiere!==current.matiere||previous.start!==current.start||previous.end!==current.end
            ));
            let changed=false;
            if(changedLocation){
                const oldMatches=matches(previous,previousEntry);
                if(oldMatches.length===1){
                    const ev=oldMatches[0];
                    if(ev.recurrence==='unique'){
                        ev.date=current.date;ev.dayIndex=getDayIndexFromISO(current.date);ev.startPeriod=current.start;ev.endPeriod=current.end;ev.eleve=current.eleve;ev.eleveId=studentId;ev.matiere=current.matiere;ev.eventStatus='realized';ev.realized=true;ev.realizedAt=ev.realizedAt||new Date().toISOString();ev.updatedAt=new Date().toISOString();changed=true;
                    }else{
                        const realized={...ev,eventId:journalierUuid('evt'),seriesId:null,recurrence:'unique',date:current.date,dayIndex:getDayIndexFromISO(current.date),startPeriod:current.start,endPeriod:current.end,eleve:current.eleve,eleveId:studentId,matiere:current.matiere,eventStatus:'realized',realized:true,realizedAt:new Date().toISOString(),outlook:{calendarId:null,eventId:null,iCalUId:null,changeKey:null,webLink:null},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};agenda.__events.push(normalizeAgendaEvent(realized,JournalierSecurity.accountKey));changed=true;
                    }
                }
            }
            if(!changed){
                const currentMatches=matches(current,currentEntry);
                if(currentMatches.length===1){
                    const ev=currentMatches[0];ev.eventStatus='realized';ev.realized=true;ev.realizedAt=ev.realizedAt||new Date().toISOString();ev.updatedAt=new Date().toISOString();changed=true;
                }
            }
            if(changed)savePrevisionnel(agenda);
        }catch(error){console.warn('Agenda — rapprochement après enregistrement de séance impossible.',error);}
    }

    function clearObservationForm() {
        editingSessionId = null;
        const saveButton = document.getElementById('save-session-btn');
        if(saveButton) saveButton.textContent='💾 Enregistrer la séance';
        const form = document.getElementById('observationForm');
        form.reset();
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
    function subjectOptionsForSelection(selected=[]){
        const current=SUBJECT_OPTIONS.slice();
        const legacy=normalizeSubjectList(selected).filter(x=>LEGACY_SUBJECT_OPTIONS.includes(x)&&!current.includes(x));
        return [...current,...legacy];
    }
    function renderStudentSubjectOptions(filter='', selectedOverride=null){
        const wrap=document.getElementById('student-subject-options');
        if(!wrap)return;
        const q=String(filter||'').trim().toLowerCase();
        const selected=new Set(selectedOverride||Array.from(document.querySelectorAll('#student-subject-options .student-subject-item.is-selected')).map(x=>x.dataset.value));
        const options=subjectOptionsForSelection([...selected]).filter(x=>!q||x.toLowerCase().includes(q));
        wrap.innerHTML=options.length?options.map(x=>{
            const isSelected=selected.has(x);
            const legacy=LEGACY_SUBJECT_OPTIONS.includes(x);
            return `<button type="button" class="student-subject-item ${isSelected?'is-selected':''} js-student-subject" data-value="${escapeHtml(x)}" aria-pressed="${isSelected?'true':'false'}">${escapeHtml(x)}${legacy?' · ancienne appellation à préciser':''}</button>`;
        }).join(''):'<div class="search-select-empty">Aucune matière trouvée.</div>';
    }
function toggleStudentSubject(value){const wrap=document.getElementById('student-subject-options');if(!wrap)return;const item=Array.from(wrap.querySelectorAll('.student-subject-item')).find(x=>x.dataset.value===String(value));if(!item)return;const selected=!item.classList.contains('is-selected');item.classList.toggle('is-selected',selected);item.setAttribute('aria-pressed',selected?'true':'false');updateStudentSubjectsSummary();}
function updateStudentSubjectsSummary(){const box=document.getElementById('student-subjects-select');if(!box)return;const checked=Array.from(box.querySelectorAll('.student-subject-item.is-selected')).map(x=>x.dataset.value);const summary=document.getElementById('student-subjects-summary');if(!summary)return;if(!checked.length){summary.className='placeholder';summary.textContent='Sélectionner une ou plusieurs matières…';}else if(checked.length<=2){summary.className='';summary.textContent=checked.join(' · ');}else{summary.className='count';summary.textContent=`${checked.length} matières sélectionnées`;}}
    function filterStudentSubjects(){renderStudentSubjectOptions(document.getElementById('student-subject-search')?.value||'');}
    function initStudentSubjects(selected=[]){
        renderStudentSubjectOptions('',normalizeSubjectList(selected));
        updateStudentSubjectsSummary();
        const search=document.getElementById('student-subject-search');
        if(search)search.value='';
    }
    function updateMultiSelectSummary(containerId,name){const box=document.getElementById(containerId);if(!box)return;const checked=Array.from(box.querySelectorAll(`input[name="${name}"]:checked`));const summary=box.querySelector('[id$="-summary"]');if(!summary)return;if(!checked.length){summary.className='placeholder';summary.textContent=containerId==='q4-types-select'?'Sélectionner un ou plusieurs éléments…':'Sélectionner une ou plusieurs matières…';}else if(checked.length<=2){summary.className='';summary.textContent=checked.map(x=>x.value).join(' · ');}else{summary.className='count';summary.textContent=`${checked.length} éléments sélectionnés`;}}
    function toggleMultiSelect(containerId){const box=document.getElementById(containerId);if(!box)return;const menu=box.querySelector('.multi-select-menu');if(!menu)return;const hidden=menu.classList.contains('hidden');closeAllChoiceMenus();if(hidden)menu.classList.remove('hidden');}
    function closeAllChoiceMenus(){document.querySelectorAll('.multi-select-menu,.search-select-menu').forEach(el=>el.classList.add('hidden'));}
    function renderSessionSubjectMenu(filter=''){const menu=document.getElementById('session-subject-menu');if(!menu)return;const student=getStudentByName(document.getElementById('f-eleve')?.value);const main=normalizeSubjectList(student?.matieres);const all=[...main,...SUBJECT_OPTIONS.filter(x=>!main.includes(x))];const q=String(filter||'').trim().toLowerCase();const options=all.filter(x=>!q||x.toLowerCase().includes(q));menu.innerHTML=options.length?options.map((x,i)=>`<button type="button" class="search-select-option ${i<main.length?'active':''} js-session-subject" data-value="${escapeHtml(x)}">${escapeHtml(x)}${main.includes(x)?' · matière principale':''}</button>`).join(''):'<div class="search-select-empty">Aucune matière dans la liste. Vous pouvez la saisir librement.</div>';}
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

    function indicatorTokens(value){
        const stop = new Set([
            'le','la','les','un','une','des','du','de','d','et','ou','en','dans','a','au','aux',
            'pour','par','avec','sur','se','sa','son','ses','ce','cette','ces','qui','que',
            'une','est','sont','à','il','elle','leur','leurs','comme','selon','vers','entre',
            'être','avoir','faire','réaliser','tache','situation','donnee','donnees','etudiee',
            'etudie','pertinent','adaptee','adapte','necessaire','utilise','utiliser'
        ]);
        return normalizeIndicatorText(value)
            .split(/[\s-]+/)
            .map(x=>x.replace(/^'+|'+$/g,''))
            .filter(x=>x.length>=3 && !stop.has(x))
            .map(x=>x.length>4 ? x.replace(/[sx]$/,'') : x);
    }

    function indicatorSubjectKey(value){
        const v=normalizeIndicatorText(value);
        const aliases={
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
            'philosophie citoyennete':'Philosophie et citoyenneté',
            'philosophie et citoyennete':'Philosophie et citoyenneté',
            'eca':'Éducation culturelle et artistique',
            'ep&s':'Éducation physique et à la santé',
            'eps':'Éducation physique et à la santé'
        };
        return aliases[v] || String(value || '').trim();
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
        try{ input.setSelectionRange(input.value.length,input.value.length); }catch(e){}
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
        return ['À renforcer','En cours d’appropriation','Mobilisé'][Number(value)] || 'En cours d’appropriation';
    }

    function rememberQ3AssessmentValues(){
        document.querySelectorAll('#q3-assessment-list input[type="range"][data-name="q3-learning"]').forEach(range=>{
            const id=range.dataset.indicatorId || '';
            if(id) q3AssessmentState[id]=Number(range.value);
        });
    }

    function renderQ3Assessments(options={}){
        const section=document.getElementById('q3-assessment-section');
        const list=document.getElementById('q3-assessment-list');
        if(!section || !list) return;

        rememberQ3AssessmentValues();
        const selected=Array.from(document.querySelectorAll('input[name="q3-learning"]:checked'));

        if(!selected.length){
            list.innerHTML='';
            section.classList.add('hidden');
            return;
        }

        list.innerHTML=selected.map(cb=>{
            const id=String(cb.dataset.indicatorId || cb.value);
            const text=String(cb.value||'');
            const indicator=INDICATOR_LIBRARY?.indicateurs_apprentissage?.find(x=>String(x.id||'')===id);
            const context=indicator?[indicator.domaine,indicator.sous_domaine].filter(Boolean).join(' · '):'';
            const current=Object.prototype.hasOwnProperty.call(q3AssessmentState,id)?Number(q3AssessmentState[id]):1;
            return `<div class="q3-assessment-item q3-assess-${current}" data-indicator-id="${escapeHtml(id)}">
                <div class="q3-assessment-label">${escapeHtml(text)}</div>
                ${context?`<div class="q3-assessment-context">${escapeHtml(context)}</div>`:''}
                <div class="q3-assessment-head"><strong>${q3AssessmentLabel(current)}</strong></div>
                <div class="q3-assessment-range"><span>À renforcer</span><input type="range" min="0" max="2" step="1" value="${current}" data-name="q3-learning" data-indicator-id="${escapeHtml(id)}" aria-label="Appréciation pour ${escapeHtml(text)}"><span>Mobilisé</span></div>
            </div>`;
        }).join('');

        list.querySelectorAll('input[type="range"]').forEach(range=>{
            const item=range.closest('.q3-assessment-item');
            const head=item?.querySelector('.q3-assessment-head strong');
            const update=()=>{
                const value=Number(range.value);
                const id=range.dataset.indicatorId || '';
                if(id) q3AssessmentState[id]=value;
                if(head) head.textContent=q3AssessmentLabel(value);
                item?.classList.remove('q3-assess-0','q3-assess-1','q3-assess-2');
                item?.classList.add(`q3-assess-${value}`);
            };
            range.addEventListener('input',update);
            range.addEventListener('change',update);
            range.addEventListener('click',e=>e.stopPropagation());
            range.addEventListener('pointerdown',e=>e.stopPropagation());
            update();
        });
        section.classList.remove('hidden');

        if(options.scrollIntoView){
            requestAnimationFrame(()=>{
                section.scrollIntoView({behavior:'smooth',block:'center'});
            });
        }
    }

    function updateQ3BubbleState(input){
        const bubble=input?.closest('.q3-library-bubble');
        if(bubble) bubble.classList.toggle('is-active',!!input.checked);
        const custom=input?.closest('.q3-custom-item');
        if(custom) custom.classList.toggle('is-active',!!input.checked);

        const id=input?.dataset?.indicatorId || input?.value || '';
        if(input && !input.checked && id) delete q3AssessmentState[id];

        // La sélection d'un indicateur suffit à ouvrir immédiatement sa zone d'appréciation.
        // Elle ne déploie jamais automatiquement les niveaux 2 ou 3 de la bibliothèque.
        renderQ3Assessments({scrollIntoView:!!input?.checked});
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
        renderQ3Assessments({scrollIntoView:true});
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
        box.querySelectorAll('input[type="range"]').forEach(r=>existing[r.dataset.type]=r.value);
        box.innerHTML='';
        const levels=['Aucun effet','Partiel','Positif'];
        selected.forEach(input=>{
            const type=input.value;
            const item=document.createElement('div');
            item.className='q4-effect-item q4-level-1';
            item.dataset.type=type;
            const value=existing[type]!==undefined?Number(existing[type]):1;
            item.classList.remove('q4-level-0','q4-level-1','q4-level-2');
            item.classList.add(`q4-level-${value}`);
            item.innerHTML=`<span class="q4-effect-label">${escapeHtml(type)}</span><span class="q4-effect-level"><span class="q4-effect-head">${levels[value]}</span><span class="q4-effect-range"><span>Aucun effet</span><input type="range" min="0" max="2" step="1" value="${value}" data-type="${escapeHtml(type).replace(/"/g,'&quot;')}" aria-label="Effet constaté pour ${escapeHtml(type)}"><span>Positif</span></span></span>`;
            const range=item.querySelector('input[type="range"]');
            const update=()=>{
                const v=Number(range.value);
                item.classList.remove('q4-level-0','q4-level-1','q4-level-2');
                item.classList.add(`q4-level-${v}`);
                item.querySelector('.q4-effect-head').textContent=levels[v];
            };
            range.addEventListener('input',update);
            range.addEventListener('click',e=>e.stopPropagation());
            range.addEventListener('pointerdown',e=>e.stopPropagation());
            box.appendChild(item);
            update();
        });
    }
    function getQ4EffectMap(){
        const out={};
        document.querySelectorAll('#q4-effect-sliders input[type="range"]').forEach(r=>{
            out[r.dataset.type]=Number(r.value);
        });
        return out;
    }
    function initQ4Effects(){
        document.querySelectorAll('input[name="q4-type"]').forEach(input=>input.addEventListener('change',renderQ4EffectSliders));
        renderQ4EffectSliders();
    }

    function initQ2Levels(){
        document.querySelectorAll('.q2-observation-item').forEach(item=>{
            const checkbox=item.querySelector('input[type="checkbox"]');
            const range=item.querySelector('input[type="range"]');
            const label=item.querySelector('.q2-level-head strong');
            if(!checkbox||!range||!label)return;
            const levels=['Partiellement','Suffisamment','Totalement'];
            const update=()=>{
                const level=Number(range.value);
                label.textContent=checkbox.checked ? levels[level] : 'À préciser';
                item.classList.toggle('is-observed',checkbox.checked);
                item.classList.toggle('q2-level-0',checkbox.checked && level===0);
                item.classList.toggle('q2-level-1',checkbox.checked && level===1);
                item.classList.toggle('q2-level-2',checkbox.checked && level===2);
                range.setAttribute('aria-hidden',checkbox.checked?'false':'true');
            };
            checkbox.addEventListener('change',update);
            range.addEventListener('input',update);
            range.addEventListener('click',ev=>ev.stopPropagation());
            range.addEventListener('pointerdown',ev=>ev.stopPropagation());
            update();
        });
    }
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
                  lib=INDICATOR_LIBRARY?.indicateurs_apprentissage?.find(x=>String(x.id||'')===id);
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

        const newEntry={
            ...(existing||{}),
            id:isEditing ? existing.id : Date.now()+Math.floor(Math.random()*1000),
            schemaVersion:JOURNALIER_ARCHITECTURE_VERSION,
            type:'SEANCE',
            identification:{eleve:student,date,periode:{start,end}},
            contexte:{matiere,niveau:document.getElementById('f-niveau')?.value||'',forme:document.getElementById('f-forme')?.value||'',typeIntervention:getCheckedValues('f-type-interv')},
            objectif:{objectifLecon:document.getElementById('f-objLecon')?.value.trim()||'',objectifProfessionnel:document.getElementById('f-objAgent')?.value.trim()||''},
            q2:{observations:q2,precision:document.getElementById('f-q2-txt')?.value.trim()||''},
            q3:{repereWBE:{signature:wbeValidatedState.signature||'',hit:wbeValidatedState.hit||'',kind:wbeValidatedState.kind||'',bridgeId:wbeValidatedState.bridgeId||'',indicatorIds:[...(wbeValidatedState.indicatorIds||[])],source:wbeValidatedState.sourceLabel||''},indicateurs:q3,precision:document.getElementById('f-q3-txt')?.value.trim()||''},
            q4:{situation:document.getElementById('q4-status-value')?.value||'none',types:getCheckedValues('q4-type'),effets:getQ4EffectMap(),precision:document.getElementById('f-q4-txt')?.value.trim()||''},
            q5:{statut:document.getElementById('q5-transfer-value')?.value||'',precision:document.getElementById('f-q5-txt')?.value.trim()||''},
            q6:{actions:getCheckedValues('q6-action'),modalite:document.getElementById('q6-modality-value')?.value||'',objectif:document.getElementById('q6-objective-value')?.value||'',collaborations:getCheckedValues('q6-collab'),precision:document.getElementById('f-q6-txt')?.value.trim()||''},
            metadata:{createdAt:existing?.metadata?.createdAt||now,updatedAt:now}
        };

        try{
            persistSessionEntry(newEntry);
            selectedDateISO=date;
            closeAllChoiceMenus();
            clearObservationForm();
            updateStudentDropdowns();
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

    function renderStudentsView() {
        const students = getStudents();
        const container = document.getElementById('students-list-container');
        const search = (document.getElementById('student-search')?.value || '').trim().toLowerCase();
        const db = getDB();
        const filtered = students.filter(s => `${s.nom} ${s.classe||''} ${s.ecole||''} ${s.pia||''}`.toLowerCase().includes(search));
        const count = document.getElementById('student-count');
        if(count) count.textContent = `${filtered.length} élève${filtered.length>1?'s':''}`;
        if (students.length === 0) { container.innerHTML = '<div class="card"><p style="color:var(--text-sub);margin:0;">Aucun élève enregistré.</p></div>'; return; }
        if (filtered.length === 0) { container.innerHTML = '<div class="card"><p style="color:var(--text-sub);margin:0;">Aucun résultat pour cette recherche.</p></div>'; return; }
        container.innerHTML = filtered.map(s => {
            const countObs=db.filter(l=>isJournalSession(l)&&sessionParts(l).eleve===s.nom).length;
            const subjects=normalizeSubjectList(s.matieres);
            const initials=String(s.nom||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toLocaleUpperCase('fr');
            return `<details class="student-item student-record">
                <summary class="student-record-head">
                    <span class="student-avatar" aria-hidden="true">${escapeHtml(initials||'•')}</span>
                    <div class="student-record-identity"><h3 class="student-name">${escapeHtml(s.nom)}</h3><p class="student-meta">${escapeHtml(s.classe||'Classe non précisée')}${s.ecole?` · ${escapeHtml(s.ecole)}`:''}</p></div>
                    <span class="student-session-count">${countObs} séance${countObs===1?'':'s'}</span>
                </summary>
                <div class="student-record-body">
                    <section class="student-record-section">
                        <h4>Matières principales</h4>
                        <div class="student-subject-pills">${subjects.length?subjects.map((subject,index)=>`<span class="student-subject-pill tone-${index%4}">${escapeHtml(subject)}</span>`).join(''):'<span class="student-record-empty">Aucune matière définie</span>'}</div>
                    </section>
                    <details class="student-collapsible">
                        <summary>Repère PIA du dossier</summary>
                        <section class="student-pia-panel">
                            <p>${escapeHtml(s.pia||'Aucun objectif saisi dans le dossier.')}</p>
                            <div class="v74-pia-dossier-mount" data-student-id="${escapeHtml(String(s.studentId||s.id))}"></div>
                        </section>
                    </details>
                    <div class="student-actions">
                        <button class="btn-secondary focus-ring" type="button" data-action="student-profile" data-student-id="${escapeHtml(String(s.id))}">Ouvrir le dossier</button>
                        <button class="btn-quiet focus-ring" type="button" data-action="student-edit" data-student-id="${escapeHtml(String(s.id))}">Modifier</button>
                        <button class="student-delete-action focus-ring" type="button" data-action="student-delete" data-student-id="${escapeHtml(String(s.id))}">Supprimer</button>
                    </div>
                </div>
            </details>`;
        }).join('');
        container.querySelectorAll('.v74-pia-dossier-mount').forEach(mount=>{mount.innerHTML=window.JournalierV74?.piaImportDossierHtml?.(mount.dataset.studentId)||'';});
    }

    function openStudentProfile(id){
        const st=getStudents().find(x=>x.id==id);if(!st)return;
        const logs=getDB().filter(l=>isJournalSession(l)&&sessionParts(l).eleve===st.nom).sort((a,b)=>sessionSortKey(b).localeCompare(sessionSortKey(a)));
        const observations=logs.flatMap(l=>(l.q2?.observations||[]).map(x=>x.observation)),adaptations=logs.flatMap(l=>l.q4?.types||[]),recent=logs.slice(0,5),subjects=normalizeSubjectList(st.matieres);
        const q2LevelLabels=['Partiellement','Suffisamment','Totalement'],q4EffectLabels=['Aucun effet','Effet partiel','Effet positif'];
        const recentCards=recent.map(log=>{
            const parts=sessionParts(log),q2=log.q2||{},q3=log.q3||{},q4=log.q4||{},q5=log.q5||{},q6=log.q6||{};
            const observationsQ2=(q2.observations||[]).map(item=>({text:item.observation,level:q2LevelLabels[Number(item.niveau)]||''})).filter(item=>item.text);
            const effects=Object.entries(q4.effets||{}).map(([name,value])=>({text:name,level:q4EffectLabels[Number(value)]||`Niveau encodé : ${value}`,tone:`is-effect-${['none','partial','positive'][Number(value)]||'none'}`}));
            const groups=[
                ['Observation · Q2',observationsQ2,'is-observation'],
                ['Apprentissage · Q3',(q3.indicateurs||[]).map(item=>({text:item.texte})).filter(item=>item.text),'is-learning'],
                ['Adaptation · Q4',(q4.types||[]).map(text=>({text})),'is-adaptation'],
                ['Effets · Q4',effects,'is-effect'],
                ['Transfert · Q5',q5.statut?[{text:q5.statut}]:[],'is-transfer'],
                ['Suite · Q6',(q6.actions||[]).map(text=>({text})),'is-followup']
            ].filter(([,items])=>items.length);
            return `<article class="profile-session-card">
                <header><div><strong>${escapeHtml(parts.date)} · ${escapeHtml(parts.matiere)}</strong><span>${escapeHtml(sessionPeriodLabel(log))}</span></div><button class="btn-quiet focus-ring" type="button" data-action="history-edit" data-session-id="${escapeHtml(String(log.id))}">Modifier</button></header>
                <h4>${escapeHtml(log.objectif?.objectifLecon||log.objectif?.objectifProfessionnel||'Séance enregistrée')}</h4>
                <div class="profile-session-groups">${groups.length?groups.map(([title,items,tone])=>`<section class="profile-session-group ${tone}"><h5>${escapeHtml(title)}</h5><div>${items.map(item=>`<span class="profile-session-pill">${escapeHtml(item.text)}${item.level?`<b class="${item.tone||''}">${escapeHtml(item.level)}</b>`:''}</span>`).join('')}</div></section>`).join(''):'<p class="student-record-empty">Aucun élément Q2–Q6 renseigné pour cette séance.</p>'}</div>
            </article>`;
        }).join('');
        const body=`<div class="profile-summary"><div class="profile-stat tone-blue"><strong>${logs.length}</strong><span>séances</span></div><div class="profile-stat tone-purple"><strong>${new Set(observations).size}</strong><span>observations distinctes</span></div><div class="profile-stat tone-green"><strong>${new Set(adaptations).size}</strong><span>adaptations renseignées</span></div></div>
            <section class="profile-block profile-subject-block"><h4>Matières principales</h4><div class="student-subject-pills">${subjects.length?subjects.map((subject,index)=>`<span class="student-subject-pill tone-${index%4}">${escapeHtml(subject)}</span>`).join(''):'<span class="student-record-empty">Aucune matière définie</span>'}</div></section>
            <section class="profile-block profile-pia-block"><h4>Repère PIA du dossier</h4><p>${escapeHtml(st.pia||'Aucun objectif saisi dans le dossier.')}</p>${window.JournalierV74?.piaImportDossierHtml?.(String(st.studentId||st.id))||''}</section>
            <section class="profile-recent-section"><header><div><div class="page-kicker">Données enregistrées</div><h4>Séances récentes</h4></div><span>${recent.length} / ${logs.length}</span></header>${recent.length?`<div class="profile-session-list">${recentCards}</div>`:'<p class="student-record-empty">Aucune séance enregistrée pour cet élève.</p>'}</section>`;
        document.getElementById('student-profile-title').textContent=st.nom;document.getElementById('student-profile-meta').textContent=`${st.classe||'Classe non précisée'}${st.ecole?' · '+st.ecole:''}`;document.getElementById('student-profile-body').innerHTML=body;document.getElementById('studentProfileModal').classList.remove('hidden');
    }
    function closeStudentProfile(){document.getElementById('studentProfileModal').classList.add('hidden');}

    function openAddStudentModal(){document.getElementById('student-modal-title').innerText='Ajouter un Élève';document.getElementById('student-modal-id').value='';document.getElementById('student-modal-nom').value='';document.getElementById('student-modal-classe').value='';document.getElementById('student-modal-ecole').value='';document.getElementById('student-modal-pia').value='';document.getElementById('student-pia-file').value='';document.getElementById('student-pia-file-name').textContent='Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';initStudentSubjects([]);closeAllChoiceMenus();const modal=document.getElementById('studentModal');modal.classList.remove('hidden');modal.removeAttribute('aria-hidden');modal.style.display='flex';}
    function openEditStudentModal(id){const students=getStudents();const s=students.find(item=>item.id==id);if(s){document.getElementById('student-modal-title').innerText='Modifier l’Élève';document.getElementById('student-modal-id').value=s.id;document.getElementById('student-modal-nom').value=s.nom;document.getElementById('student-modal-classe').value=s.classe||'';document.getElementById('student-modal-ecole').value=s.ecole||'';document.getElementById('student-modal-pia').value=s.pia||'';document.getElementById('student-pia-file').value='';document.getElementById('student-pia-file-name').textContent=s.piaFileName?`PIA structuré disponible : ${s.piaFileName ? "source déjà sélectionnée" : "source structurée"}.`:'Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';initStudentSubjects(s.matieres||[]);closeAllChoiceMenus();const modal=document.getElementById('studentModal');modal.classList.remove('hidden');modal.removeAttribute('aria-hidden');modal.style.display='flex';}}
    function closeStudentModal(){const modal=document.getElementById('studentModal');if(!modal)return;closeAllChoiceMenus();modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');modal.style.display='none';}
    function showPIAImportName(input){
        const file=input?.files?.[0]||null;
        const name=file?.name||'';
        const target=document.getElementById('student-pia-file-name');
        const status=document.getElementById('pia-local-security-status');
        if(target)target.textContent=name?`PIA sélectionné : ${name} · traitement local, sans conservation du fichier original.`:'Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';
        if(status)status.textContent=name?'✓ Fichier sélectionné localement — aucune transmission du document original pendant cette étape.':'✓ Traitement local activé';
        showAppToast(name?'PIA sélectionné — le document original reste sur votre appareil.':'Aucun PIA sélectionné.',name?'info':'error');
    }
    function saveStudent(e){
        if(e&&e.preventDefault)e.preventDefault();
        const modal=document.getElementById('studentModal');
        const id=document.getElementById('student-modal-id').value;
        const nom=document.getElementById('student-modal-nom').value.trim();
        const classe=document.getElementById('student-modal-classe').value.trim();
        const ecole=document.getElementById('student-modal-ecole').value.trim();
        const pia=document.getElementById('student-modal-pia').value.trim();
        const matieres=Array.from(document.querySelectorAll('#student-subjects-select .student-subject-item.is-selected')).map(x=>x.dataset.value);
        const piaFile=document.getElementById('student-pia-file')?.files?.[0];
        if(!nom){alert("Le nom de l'élève est requis.");return;}
        try{
            let students=getStudents();
            if(id){
                const previous=students.find(s=>s.id==id)||{};
                students=students.map(s=>s.id==id?{...s,id:parseInt(id,10),nom,classe,ecole,matieres,pia}:s);
            }else{
                const newId=Date.now();
                students.push({id:newId,studentId:String(newId),nom,classe,ecole,matieres,pia});
                const pending=window.__journalierPendingPIAImport;
                if(pending && !String(pending.studentId||'').trim()){
                    pending.studentId=String(newId);
                }
            }
            saveStudentsList(students);
        }finally{
            closeAllChoiceMenus();
            closeStudentModal();
            if(document.activeElement&&typeof document.activeElement.blur==='function')document.activeElement.blur();
        }
        // Rafraîchissement explicite des vues dépendantes du dossier.
        updateStudentDropdowns();
        renderStudentsView();
        updateStats();
        const currentStudent=document.getElementById('r-eleve')?.value;
        if(currentStudent===nom) loadStudentHistory();
        const profileModal=document.getElementById('studentProfileModal');
        const profileTitle=document.getElementById('student-profile-title');
        if(profileModal && !profileModal.classList.contains('hidden') && profileTitle && profileTitle.textContent===nom){
            const updated=getStudents().find(x=>x.nom===nom);
            if(updated) openStudentProfile(updated.id);
        }
        showAppToast(id?'✓ Modifications de l’élève enregistrées.':'✓ Élève ajouté au dossier.','success',4200);
    }

    function deleteStudent(id) {
        if (confirm("Voulez-vous vraiment supprimer cet élève ?")) {
            let students = getStudents().filter(s => s.id != id);
            saveStudentsList(students);
            showAppToast('✓ Élève supprimé du dossier.','success',3600);
        }
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function historyQ2LevelLabel(value){
        if(value===null||value===undefined||value==='')return '';
        const labels=['Partiellement','Suffisamment','Totalement'],level=Number(value);
        return Number.isInteger(level)&&level>=0&&level<labels.length?labels[level]:`Niveau encodé : ${String(value)}`;
    }

    function historyQ4EffectLabel(value){
        if(value===null||value===undefined||value==='')return '';
        const labels=['Aucun effet','Effet partiel','Effet positif'],level=Number(value);
        return Number.isInteger(level)&&level>=0&&level<labels.length?labels[level]:`Niveau encodé : ${String(value)}`;
    }

    function renderHistoryDetail(entry){
        const host=document.getElementById('student-history-detail');
        if(!host)return;
        if(!entry){host.innerHTML='<div class="history-detail-empty">Aucune séance à afficher pour ces filtres.</div>';return;}
        const parts=sessionParts(entry),q2=entry.q2||{},q3=entry.q3||{},q4=entry.q4||{},q5=entry.q5||{},q6=entry.q6||{},objective=entry.objectif||{};
        const q2Observations=[...(q2.observations||[]).map(item=>({text:item.observation,level:historyQ2LevelLabel(item.niveau)})),...(q2.precision?[q2.precision]:[])].filter(item=>typeof item==='string'||item.text);
        const q4Effects=Object.entries(q4.effets||{}).map(([name,value])=>({text:name,level:historyQ4EffectLabel(value),levelClass:`is-effect-${['none','partial','positive'][Number(value)]||'none'}`}));
        const sections=[
            ['Observation · Q2',q2Observations,'is-observation'],
            ['Apprentissage · Q3',[...(q3.indicateurs||[]).map(item=>item.texte),q3.precision].filter(Boolean),'is-learning'],
            ['Adaptation · Q4',[...(q4.types||[]),q4.precision].filter(Boolean),'is-adaptation'],
            ['Effets consignés · Q4',q4Effects,'is-effect'],
            ['Transfert · Q5',[q5.statut,q5.precision].filter(Boolean),'is-transfer'],
            ['Suite · Q6',[...(q6.actions||[]),q6.precision].filter(Boolean),'is-followup'],
            ['Repères WBE', [q3.repereWBE?.hit||q3.repereWBE?.signature].filter(Boolean),'is-reference']
        ].filter(([,values])=>values.length);
        const sid=escapeHtml(String(entry.id));
        host.innerHTML=`
            <header class="history-detail-head">
                <button type="button" class="btn-secondary history-detail-back" data-history-back>‹ Historique</button>
                <div class="history-detail-heading"><strong>${escapeHtml(parts.date)} · ${escapeHtml(parts.matiere)}</strong><span>${escapeHtml(sessionPeriodLabel(entry))}</span></div>
                <div class="history-detail-actions">
                    <button type="button" class="history-edit-btn" data-session-id="${sid}" data-action="history-edit">Modifier</button>
                    <details class="history-more-actions"><summary aria-label="Autres actions" title="Autres actions">⋯</summary><button type="button" data-session-id="${sid}" data-action="history-delete">Supprimer</button></details>
                </div>
            </header>
            <div class="history-detail-body">
                <p class="history-detail-subject">Séance observée</p>
                <h3 class="history-detail-title">${escapeHtml(objective.objectifLecon||objective.objectifProfessionnel||'Objectif non renseigné')}</h3>
                <span class="history-detail-period">${escapeHtml(sessionPeriodLabel(entry))}</span>
                ${sections.length?sections.map(([title,values,tone])=>`<section class="history-detail-section ${tone}"><h4>${escapeHtml(title)}</h4><div class="history-evidence-list">${values.map(value=>typeof value==='string'?`<span class="history-evidence-chip">${escapeHtml(value)}</span>`:`<span class="history-evidence-chip"><span>${escapeHtml(value.text)}</span>${value.level?`<span class="history-evidence-level ${value.levelClass||''}">${escapeHtml(value.level)}</span>`:''}</span>`).join('')}</div></section>`).join(''):'<p class="reports-section-description">Aucun élément Q2–Q6 n’a été renseigné pour cette séance.</p>'}
                <p class="history-detail-note">Les éléments sont présentés tels qu’encodés dans la séance. Leur association ne constitue pas une conclusion causale.</p>
            </div>`;
    }

    function loadStudentHistory(){
        const student=document.getElementById('r-eleve')?.value||'',container=document.getElementById('student-history-list');
        if(!container)return;
        const workspace=document.getElementById('history-workspace'),detail=document.getElementById('student-history-detail'),count=document.getElementById('history-visible-count');
        const allLogs=getDB().filter(log=>isJournalSession(log)&&sessionParts(log).eleve===student).sort((a,b)=>sessionSortKey(b).localeCompare(sessionSortKey(a)));
        if(container.dataset.student!==student){container.dataset.student=student;container.dataset.visibleLimit='15';container.dataset.selectedSession='';}
        if(!student){container.innerHTML='<p class="reports-empty-state">Sélectionnez un élève pour afficher son historique.</p>';if(count)count.textContent='';if(detail)detail.innerHTML='<div class="history-detail-empty">Le détail des séances apparaîtra ici après la sélection d’un élève.</div>';workspace?.classList.remove('is-detail-open');return;}
        const subjectSelect=document.getElementById('history-subject-filter'),currentSubject=subjectSelect?.value||'';
        const subjects=[...new Set(allLogs.map(log=>sessionParts(log).matiere).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
        if(subjectSelect){
            subjectSelect.innerHTML='<option value="">Toutes les matières</option>'+subjects.map(subject=>`<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('');
            subjectSelect.value=subjects.includes(currentSubject)?currentSubject:'';
        }
        const selectedSubject=subjectSelect?.value||'',query=(document.getElementById('history-search')?.value||'').trim().toLocaleLowerCase('fr');
        const filteredLogs=allLogs.filter(log=>{
            const parts=sessionParts(log),q2=log.q2||{},q3=log.q3||{},q4=log.q4||{},q5=log.q5||{},q6=log.q6||{};
            if(selectedSubject&&parts.matiere!==selectedSubject)return false;
            if(!query)return true;
            const searchable=[parts.date,parts.matiere,sessionPeriodLabel(log),log.objectif?.objectifLecon,log.objectif?.objectifProfessionnel,...(q2.observations||[]).map(item=>item.observation),q2.precision,...(q3.indicateurs||[]).map(item=>item.texte),q3.precision,...(q4.types||[]),q4.precision,q5.statut,q5.precision,...(q6.actions||[]),q6.precision].filter(Boolean).join(' ').toLocaleLowerCase('fr');
            return searchable.includes(query);
        });
        if(!allLogs.length){container.innerHTML='<p class="reports-empty-state">Aucune séance enregistrée pour cet élève.</p>';if(count)count.textContent='0 séance';renderHistoryDetail(null);return;}
        if(!filteredLogs.length){container.innerHTML='<p class="reports-empty-state">Aucune séance ne correspond à ces filtres.</p>';if(count)count.textContent='0 séance';renderHistoryDetail(null);return;}
        const visibleLimit=Math.max(15,Number(container.dataset.visibleLimit)||15),visibleLogs=filteredLogs.slice(0,visibleLimit);
        const selected=visibleLogs.find(log=>String(log.id)===container.dataset.selectedSession)||visibleLogs[0];
        container.dataset.selectedSession=String(selected.id);
        if(count)count.textContent=`${filteredLogs.length} séance${filteredLogs.length===1?'':'s'}`;
        container.innerHTML=visibleLogs.map(log=>{
            const parts=sessionParts(log),objective=log.objectif||{},q2=log.q2||{},q4=log.q4||{},q5=log.q5||{};
            const dateMatch=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(parts.date||''));
            const dateDay=dateMatch?dateMatch[3]:escapeHtml(parts.date||'');
            const dateMonth=dateMatch?new Date(Number(dateMatch[1]),Number(dateMatch[2])-1,1).toLocaleDateString('fr-FR',{month:'short'}).replace('.',''):'Séance';
            const signals=[
                ...(q2.observations||[]).map(item=>{
                    const level=historyQ2LevelLabel(item.niveau);
                    return {text:item.observation,level:level?.toLocaleLowerCase('fr')||'',tone:'is-observation',label:'Observation'};
                }),
                ...(q4.types||[]).map(item=>({text:item,tone:'is-adaptation',label:'Adaptation'})),
                ...(q5.statut?[{text:q5.statut,tone:'is-transfer',label:'Transfert'}]:[])
            ].filter(item=>item.text).slice(0,2);
            const title=objective.objectifLecon||objective.objectifProfessionnel||'Objectif non renseigné';
            const id=escapeHtml(String(log.id)),isSelected=String(log.id)===String(selected.id);
            return `<button type="button" class="history-master-row" data-history-select="${id}" aria-current="${isSelected?'true':'false'}" aria-label="${escapeHtml(`${dateDay} ${dateMonth}, ${parts.matiere}, ${title}`)}">
                <span class="history-date-rail"><strong>${dateDay}</strong><span>${escapeHtml(dateMonth)}</span></span>
                <span class="history-master-content"><span><span class="history-master-title">${escapeHtml(parts.matiere||'Matière non renseignée')}</span><span class="history-master-meta">${escapeHtml(sessionPeriodLabel(log))}</span></span><span class="history-master-objective">${escapeHtml(title)}</span>${signals.length?`<span class="history-master-signals">${signals.map(signal=>`<span class="history-signal ${signal.tone}"><span class="history-signal-label">${escapeHtml(signal.label)}</span><span class="history-signal-text">${escapeHtml(signal.text)}</span>${signal.level?`<span class="history-signal-level">${escapeHtml(signal.level)}</span>`:''}</span>`).join('')}</span>`:''}</span>
                <span class="history-master-chevron" aria-hidden="true">›</span>
            </button>`;
        }).join('')+(filteredLogs.length>visibleLogs.length?`<div class="history-load-more"><button type="button" class="btn-secondary" data-history-load-more>Afficher 15 séances de plus · ${filteredLogs.length-visibleLogs.length} restantes</button></div>`:'');
        renderHistoryDetail(selected);
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
            if(cb){
                const found=(q2.observations||[]).find(x=>String(x.observation||'')===String(cb.value||''));
                cb.checked=!!found;
                if(range && found)range.value=String(found.niveau??0);
            }
            if(cb&&range){
                const level=Number(range.value||0);
                const levels=['Partiellement','Suffisamment','Totalement'];
                const label=item.querySelector('.q2-level-head strong');
                if(label)label.textContent=cb.checked?levels[level]:'À préciser';
                item.classList.toggle('is-observed',cb.checked);
                item.classList.remove('q2-level-0','q2-level-1','q2-level-2');
                if(cb.checked)item.classList.add(`q2-level-${level}`);
                range.setAttribute('aria-hidden',cb.checked?'false':'true');
            }
        });

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
            if(range){range.value=String(value);range.dispatchEvent(new Event('input',{bubbles:true}));}
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
                    const lib=INDICATOR_LIBRARY?.indicateurs_apprentissage?.find(x=>String(x.id||'')===id);
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
        window.scrollTo({top:0,behavior:'smooth'});
        showAppToast('✏️ Séance chargée pour modification.','success',3000);
    }

    function syncAgendaAfterSessionDelete(entry){
        try{
            const p=sessionParts(entry),agenda=getPrevisionnel();
            const start=periodIndex(p.start),end=periodIndex(p.end||p.start);
            const matches=(agenda.__events||[]).filter(ev=>{
                if(ev.type!=='ELEVE'||ev.eventStatus==='cancelled'||!eventOccursOnDate(ev,p.date)||ev.eleve!==p.eleve)return false;
                if(entry.identification?.eleveId&&ev.eleveId&&String(entry.identification.eleveId)!==String(ev.eleveId))return false;
                if(ev.matiere&&p.matiere&&ev.matiere!==p.matiere)return false;
                const r=agendaEventIndexes(ev);return r.start<=end&&r.end>=start;
            });
            const realized=matches.filter(ev=>ev.eventStatus==='realized'||ev.realized);
            if(realized.length===1){const ev=realized[0];ev.realized=false;ev.realizedAt=null;ev.eventStatus='confirmed';ev.updatedAt=new Date().toISOString();savePrevisionnel(agenda);}
        }catch(error){console.warn('Agenda — rapprochement après suppression de séance impossible.',error);}
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
            showAppToast('✓ Encodage supprimé de l’historique.','success',4200);
        }catch(err){
            console.error('Suppression de la séance impossible',err);
            showAppToast('⚠️ La séance n’a pas pu être supprimée.','error',5000);
        }
    }

    function summarizeTags(studentLogs, field) {
        const counts = {};
        studentLogs.forEach(l => {
            const raw = l[field] || '';
            raw.split(',').map(x => x.trim()).filter(Boolean).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    }

    function getReportRange(type) {
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

    function renderMeetingPrep(evidence,relations){
        const host=document.getElementById('meeting-prep-output');if(!host)return;
        const observationCounts=new Map();
        evidence.forEach(item=>item.observations.forEach(observation=>{
            const text=String(observation.text||'').trim();if(text)observationCounts.set(text,(observationCounts.get(text)||0)+1);
        }));
        const recurring=[...(relations.recurrences||[]).map(item=>reportTheme(item.theme).label),...[...observationCounts].filter(([,count])=>count>1).map(([text,count])=>`${text} (${count} séances)`)];
        const variable=[...observationCounts].filter(([,count])=>count===1).map(([text])=>text);
        const adaptations=reportUnique(evidence.flatMap(item=>[...item.adaptations,item.adaptationPrecision]).filter(Boolean));
        const transfer=reportUnique(evidence.flatMap(item=>[item.transfer,item.transferPrecision]).filter(Boolean));
        const followUp=reportUnique(evidence.flatMap(item=>[...item.actions,item.actionObjective,item.actionPrecision]).filter(Boolean));
        const discussion=reportUnique([
            ...evidence.map(item=>item.actionObjective?`Objectif de suite renseigné : ${item.actionObjective}`:''),
            adaptations.length?'Relire les adaptations et effets Q4 consignés dans les séances, sans en inférer de causalité.':'',
            new Set(transfer).size>1?'Les statuts de transfert Q5 varient selon les séances : préciser les contextes concernés.':''
        ].filter(Boolean));
        const section=(title,items)=>`<section class="report-section"><h4>${title}</h4>${items.length?`<ul>${reportUnique(items).map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:'<p>Aucun élément renseigné dans les séances de cette période.</p>'}</section>`;
        host.innerHTML=`<div class="natural-report">${section('Points récurrents',recurring)}${section('Points variables',variable)}${section('Adaptations',adaptations)}${section('Transfert',transfer)}${section('Suites Q6',followUp)}${section('Points à discuter',discussion)}</div>`;
    }

    function reportElementText(element){
        if(!element)return '';
        const clone=element.cloneNode(true),lines=[],blockTags=new Set(['DIV','SECTION','P','H1','H2','H3','H4','UL','OL','LI']);
        clone.querySelectorAll('[hidden]').forEach(node=>node.removeAttribute('hidden'));
        const visit=node=>{
            if(node.nodeType===Node.TEXT_NODE){
                const value=String(node.nodeValue||'').replace(/\s+/g,' ').trim();
                if(value){if(lines.length&&lines.at(-1)!=='')lines[lines.length-1]+=' ';if(!lines.length)lines.push('');lines[lines.length-1]+=value;}
                return;
            }
            if(node.nodeType!==Node.ELEMENT_NODE)return;
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

    function setReportView(full){
        const sections=[...document.querySelectorAll('#report-text .natural-report .report-section')];
        sections.forEach((section,index)=>{section.hidden=!full&&index>=(sections.length>10?4:6);});
        document.getElementById('r-preview-btn')?.setAttribute('aria-pressed',String(!full));
        document.getElementById('r-full-btn')?.setAttribute('aria-pressed',String(full));
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
                let next=current;
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
            const customRange=period?.value==='LIBRE';
            custom?.classList.toggle('hidden',!customRange);
            anchor?.classList.toggle('hidden',customRange);
        };
        period?.addEventListener('change',updateRangeControls);
        updateRangeControls();
        const updateExportControls=()=>{if(exportFormatField)exportFormatField.hidden=String(exportKind?.value||'').includes('json');};
        exportKind?.addEventListener('change',updateExportControls);
        updateExportControls();
        setReportsTab('synthesis');
        document.getElementById('r-preview-btn')?.addEventListener('click',()=>setReportView(false));
        document.getElementById('r-full-btn')?.addEventListener('click',()=>setReportView(true));
        const historyContainer=document.getElementById('student-history-list');
        const refreshHistoryFilters=()=>{if(historyContainer)historyContainer.dataset.visibleLimit='15';loadStudentHistory();};
        document.getElementById('history-search')?.addEventListener('input',refreshHistoryFilters);
        document.getElementById('history-subject-filter')?.addEventListener('change',refreshHistoryFilters);
        historyContainer?.addEventListener('click',event=>{
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
            if(!event.target.closest('[data-history-back]'))return;
            document.getElementById('history-workspace')?.classList.remove('is-detail-open');
            historyContainer?.querySelector('[data-history-select][aria-current="true"]')?.focus();
        });
        document.getElementById('reports-export-btn')?.addEventListener('click',()=>{
            const kind=document.getElementById('reports-export-kind')?.value,format=document.getElementById('reports-export-format')?.value||'docx',student=document.getElementById('r-eleve')?.value||'';
            let filename='',content='';
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
                const lines=['Historique des séances',`Période : ${range.start} → ${range.end}`];
                logs.forEach(log=>{
                    const parts=sessionParts(log),q2=log.q2||{},q3=log.q3||{},q4=log.q4||{},q5=log.q5||{},q6=log.q6||{};
                    const add=(label,value)=>{if(value)lines.push(`${label} : ${value}`);};
                    lines.push('',`${parts.date} — ${parts.matiere} (${sessionPeriodLabel(log)})`);
                    add('Objectif',log.objectif?.objectifLecon||log.objectif?.objectifProfessionnel||'');
                    add('Fonctionnement Q2',[...(q2.observations||[]).map(item=>`${item.observation}${historyQ2LevelLabel(item.niveau)?` — niveau constaté : ${historyQ2LevelLabel(item.niveau).toLocaleLowerCase('fr')}`:''}`),q2.precision].filter(Boolean).join(' — '));
                    add('Apprentissages Q3',[...(q3.indicateurs||[]).map(item=>item.texte),q3.precision].filter(Boolean).join(' — '));
                    add('Adaptations Q4',[...(q4.types||[]),...Object.entries(q4.effets||{}).map(([name,value])=>`${name} : ${historyQ4EffectLabel(value)}`),q4.precision].filter(Boolean).join(' — '));
                    add('Transfert Q5',[q5.statut,q5.precision].filter(Boolean).join(' — '));
                    add('Suites Q6',[...(q6.actions||[]),q6.precision].filter(Boolean).join(' — '));
                });
                filename='seances';content=lines.join('\n');
            }
            const exporter=window.JournalierV74?.exportTextDocument;
            if(typeof exporter!=='function'){alert('Le module d’export Word/PDF n’est pas encore prêt. Réessayez dans quelques secondes.');return;}
            try{exporter(filename,content,format);}
            catch(error){alert(`Export impossible : ${error?.message||error}`);}
        });
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
        let m=s.match(/(\d{1,2})\s*[\/]\s*(\d{1,2})\s*[\/]\s*(\d{4})/);
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
        const n=reportNorm(o.text), objective=reportNorm(e.objectif);
        const signals=reportSignals(n);
        const add=(theme,extra={})=>units.push(reportThemeUnit(e,o.text,theme,{category:o.category,level:o.level,positiveSignal:signals.positive,difficultySignal:signals.difficulty,polarity:signals.positive&&signals.difficulty?'mixed':signals.positive?'positive':signals.difficulty?'difficulty':'neutral',...extra}));

        if(/classe bruyante|classe tres bruyante|perturbations|dynamique de classe|climat de classe|eleves perturbateurs|impossible de suivre le cours|difficile de se concentrer|ton monte|enseignante.*autorite|rapport avec l'enseignante|enseignante.*cadrante/.test(n)) add('classroom_context',{context:true});
        if(/preoccupee par.*interrogation|stagiaire|plus de mal.*stagiaire|enseignant.*donne envie|ambiance.*enseignante/.test(n)) add('teacher_context',{context:true});
        if(/travail en groupe|travailler en groupe|projets comme celui-ci|manque de creativite|participation.*groupe/.test(n)) add('group_work');
        if(/ipad|tablette|outil numerique|telephone|internet pour rechercher/.test(n)) add('digital');
        if(/autonome|autonomie|travail en autonomie|seule|sans aide/.test(n)) add('autonomy',{positive:/autonome|travail en autonomie/.test(n)});
        if(/demande.*verifie|verifier ses reponses|se rassurer/.test(n)) add('help_seeking');
        if(/attention|attentive|distrait|dissip|epuise|fatigue|decroch|focus|perturbe|motivation|envie de travailler|refuse de travailler|engagement/.test(n)) add(/distrait|perturbe|dissip/.test(n)?'distraction':'attention');
        if(/motivation|envie de travailler|refuse de travailler|plus motivee|bonne implication|bonne participation|participe activement/.test(n)) add('motivation');
        if(/etape|process|procedure|regle|methode|valider chaque etape|plus lent|pas solidement|inconstance|erreurs|minimiser les erreurs/.test(n)) add('procedural');
        if(/memor|retient|reapprendre|souvenir|oublie|d'une semaine a l'autre/.test(n)) add('memory');
        if(/vocabulaire|termes|notions de vocabulaire/.test(n)) add('vocabulary');
        if(/tables de multiplication|multiplication|additions|soustraction|signes|calculs|operations|valeur absolue|equation|puissances/.test(n)) add('arithmetic');
        if(/algebre|termes litteraux|termes semblables|exposants|factorisation|polynome|pemdas|parentheses/.test(n)) add('algebra');
        if(/fraction|division|numerateur|denominateur|parts visualisable/.test(n)) add('fractions');
        if(/angle|geometr|pythagore|triangle|quadrilat|hypotenuse|traces|equerre/.test(n)||/angle|geometr|pythagore|triangle|quadrilat|hypotenuse/.test(objective)) add('geometry');
        if(/mesur|equerre|regle|instruments/.test(n)) add('measurement');
        if(/geste moteur|tenue des instruments|traces.*manquent|superposition de l.?equerre|align(e|é)ment.*chiffres|alignement/.test(n)) add('graphomotor');
        if(/quantites|ordre de grandeur/.test(n)) add('quantities');
        if(/ordre de presentation|extraire.*information|informations non essentielles|mauvaises donnees|pertinente|pertinence|tenir compte des informations/.test(n)) add('information_selection');
        if(/bien compris|compris le principe|comprend les concepts|bonne comprehension|excellente comprehension|aucune difficulte|excelle|aisance|assimilation rapide|vite compris|methode bien assimilee|excellent travail|bonne evaluation|participe activement/.test(n) && /process|procedure|methode|regle|etape|calcul|operations|formule/.test(objective+' '+n)) add('procedural',{positive:true});
        if(/ipad|tablette/.test(n)) add('digital_transfer',{positive:/maitrise bien|bien maitrise|bonne maitrise/.test(n)});
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
          const positives=comparable.filter(u=>u.positiveSignal||u.positive), difficulties=comparable.filter(u=>u.difficultySignal&&!u.positive);
          out.recurrences.push({theme,units:comparable,dates,contexts,positives,difficulties});
          if(contexts.length>=2) out.crossContext.push({theme,units:comparable,contexts});
          const temporalPositives=temporal.filter(u=>u.positiveSignal||u.positive), temporalDifficulties=temporal.filter(u=>u.difficultySignal&&!u.positive);
          if(temporalPositives.length&&temporalDifficulties.length){
            const firstDiff=temporalDifficulties[0].dateKey, laterPositive=temporalPositives.some(u=>u.dateKey>firstDiff), firstPos=temporalPositives[0].dateKey, laterDiff=temporalDifficulties.some(u=>u.dateKey>firstPos);
            out.evolutions.push({theme,units:temporal,positives:temporalPositives,difficulties:temporalDifficulties,laterPositive,laterDiff});
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
        if(!indicators.length&&!adaptations.length&&!q6.length&&!q5&&!wbe) return;
        links.push({unit:u,evidence:e,indicators,indicatorAssociation:indicators.length?'same_session':'none',wbe,adaptations,transfer:q5,actions:q6,actionObjective:e.actionObjective,collaborations:e.collaborations,actionPrecision:q6Precision});
      });
      return links;
    }

    function reportLinkEvolution(link,allLinks){
      const same=allLinks.filter(x=>x!==link && x.unit.theme===link.unit.theme && x.unit.dateKey!==link.unit.dateKey).sort((a,b)=>a.unit.dateKey.localeCompare(b.unit.dateKey));
      if(!same.length) return {status:'none',text:''};
      const later=same.filter(x=>x.unit.dateKey>link.unit.dateKey);
      if(!later.length) return {status:'none',text:''};
      const laterWithPositive=link.unit.positiveSignal ? later.filter(x=>x.unit.positiveSignal).length : 0;
      const laterWithDifficulty=link.unit.difficultySignal ? later.filter(x=>x.unit.difficultySignal).length : 0;
      const sameIndicator=link.indicators.length && later.some(x=>x.indicators.some(i=>link.indicators.some(j=>i.id&&j.id&&i.id===j.id)));
      if(sameIndicator || laterWithPositive || laterWithDifficulty){
        return {status:'situated',text:`Le même domaine est documenté à nouveau dans ${later.length} séance${later.length>1?'s':''} ultérieure${later.length>1?'s':''}. Cette comparaison permet de décrire une évolution située, sans conclure à une généralisation.`};
      }
      return {status:'none',text:''};
    }

    function reportChainLabel(link){
      const obs=link.unit.short;
      const ind=link.indicators.slice(0,2).map(i=>i.text);
      const ad=link.adaptations.filter(a=>a.effectLabel);
      const parts=[`Observation : ${obs}`];
      if(ind.length) parts.push(`Indicateur associé dans la même séance : ${reportRarityPhrase(ind)}`);
      if(link.wbe) parts.push(`Repère WBE validé : ${link.wbe.signature||link.wbe.hit}`);
      if(ad.length) parts.push(`Aide/adaptation renseignée : ${reportRarityPhrase(ad.map(a=>a.type))}${ad.some(a=>a.effectLabel)?` (${reportRarityPhrase(ad.map(a=>a.effectLabel))})`:''}`);
      if(link.transfer) parts.push(`Transfert : ${link.transfer.status==='observed'?'observé':link.transfer.status==='not_observed'?'non observé':link.transfer.status==='no_opportunity'?'pas d’occasion':link.transfer.status==='later'?'à observer plus tard':link.transfer.status}`);
      if(link.actions.length) parts.push(`Suite : ${reportRarityPhrase(link.actions)}`);
      if(link.actionObjective) parts.push(`Orientation : ${link.actionObjective}`);
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
        if(firstInd&&lastInd&&firstInd.appreciation!==null&&lastInd.appreciation!==null&&firstInd.appreciation!==lastInd.appreciation){
          const labels=['À renforcer','En cours d’appropriation','Mobilisé'];
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
      const links=reportBuildSessionLinks(evidence,units), usable=links.filter(l=>l.indicators.length||l.wbe||l.adaptations.length||l.actions.length||l.transfer);
      if(!usable.length) return {paragraphs:[`Les champs Q3 à Q6 ne documentent pas suffisamment de relations dans cette période pour établir une chaîne observation → indicateur → aide → effet → évolution → suite.`],links:[],evidenceCount:0};
      const strong=usable.filter(l=>l.indicators.length||l.wbe).slice(0,5);
      const paragraphs=[];
      const withAdapt=usable.filter(l=>l.adaptations.length);
      const withEffects=withAdapt.filter(l=>l.adaptations.some(a=>a.effect!==undefined&&!Number.isNaN(a.effect)));
      const withActions=usable.filter(l=>l.actions.length||l.actionObjective);
      const withTransfer=usable.filter(l=>l.transfer);
      const comparisons=reportCompareLinkedChains(usable);
      paragraphs.push(`${usable.length} chaîne${usable.length>1?'s':''} documentaire${usable.length>1?'s':''} relie${usable.length>1?'nt':''} au moins une observation Q2 à des données Q3–Q6 dans la même séance. Ces rapprochements sont documentaires : ils n'établissent pas à eux seuls une relation causale entre une aide et un effet.`);
      if(strong.length){
        paragraphs.push(strong.slice(0,3).map(reportChainLabel).join(' '));
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
      score += Math.min(r.dates.length,5)*2.0; score += Math.min(r.units.length,8)*0.35; score += Math.min(r.difficulties.length,5)*3.2; score += Math.min(r.positives.length,5)*1.5;
      if(r.evolution) score += 2.5; if(r.mixed) score += 0.8; if(r.type==='strength') score += 5.5; if(r.type==='strength_with_variability') score += 4.0; if(r.type==='fragility') score += 3.5; if(r.type==='fragility_with_success') score += 2.5;
      if(learningThemes.includes(r.theme)) score += 0.8; if(functionalThemes.includes(r.theme)) score += 0.8; if(toolThemes.includes(r.theme)) score -= 0.8; if(contextThemes.includes(r.theme)) score -= 4;
      return score;
    }

    function reportBuildHierarchy(units,relations){
      const rec=(relations.recurrences||[]).filter(r=>!['classroom_context','teacher_context'].includes(r.theme));
      const evMap=new Map((relations.evolutions||[]).map(e=>[e.theme,e]));
      const learningThemes=['vocabulary','arithmetic','algebra','fractions','geometry','quantities'];
      const findings=rec.map(r=>{
        const evolution=evMap.get(r.theme)||null, mixed=!!(r.positives.length&&r.difficulties.length), pos=r.positives.length, diff=r.difficulties.length;
        let type='neutral'; if(pos&&diff){if(pos>=diff*2)type='strength_with_variability';else if(diff>=pos*2)type='fragility_with_success';else type='mixed';}else if(diff)type='fragility';else if(pos)type='strength';
        const x={...r,evolution,mixed,type,domain:learningThemes.includes(r.theme)?'learning':'functioning'}; x.score=reportThemeRank(x); return x;
      }).sort((a,b)=>b.score-a.score);
      return {findings,learning:findings.filter(f=>f.domain==='learning'),functioning:findings.filter(f=>f.domain==='functioning'),context:(relations.contextUnits||[])};
    }

    function reportFindingPhrase(f){
      const label=reportTheme(f.theme).short;
      if(f.type==='fragility') return `des fragilités récurrentes concernant ${label}`;
      if(f.type==='fragility_with_success') return `des fragilités récurrentes concernant ${label}, malgré quelques réussites`;
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
      if(lead){if(lead.type==='fragility'||lead.type==='fragility_with_success')p+=` Le principal point de vigilance documenté concerne ${reportTheme(lead.theme).short}.`;else if(lead.type==='strength'||lead.type==='strength_with_variability')p+=` Le principal point d’appui documenté concerne ${reportTheme(lead.theme).short}.`;else if(lead.type==='mixed')p+=` L’élément le plus saillant est contrasté : ${reportTheme(lead.theme).short} est observé favorablement dans certaines situations et plus difficilement dans d’autres.`;}
      if(h.context.length)p+=` Les facteurs de contexte sont présentés séparément afin de ne pas les confondre avec le fonctionnement de l’élève.`; return p;
    }

    function reportPriorityDetails(units,relations){
      const h=reportBuildHierarchy(units,relations), top=[...h.learning.slice(0,2),...h.functioning.slice(0,2)], p=[];
      top.forEach(f=>{const label=reportTheme(f.theme).label;let text='';
        if(f.type==='mixed')text=`${label} apparaît de façon contrastée dans ${f.dates.length} dates documentées : ${f.positives.length} observation${f.positives.length>1?'s':''} rapporte${f.positives.length>1?'nt':''} un élément favorable et ${f.difficulties.length} une difficulté. `;
        else if(f.type==='fragility'||f.type==='fragility_with_success'){text=`${label} constitue un point de vigilance récurrent, retrouvé sur ${f.dates.length} dates documentées. `;if(f.type==='fragility_with_success')text+=`Quelques réussites sont également rapportées dans ce domaine. `;}
        else if(f.type==='strength'||f.type==='strength_with_variability'){text=`${label} constitue un point d’appui récurrent, retrouvé sur ${f.dates.length} dates documentées. `;if(f.type==='strength_with_variability')text+=`Quelques variations ou difficultés apparaissent toutefois selon les situations. `;} else text=`${label} est documenté à plusieurs reprises. `;
        if(f.evolution){if(f.evolution.laterPositive&&!f.evolution.laterDiff)text+=`Les observations deviennent ensuite plus favorables dans certaines situations ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale. `;else if(f.evolution.laterDiff&&!f.evolution.laterPositive)text+=`Des observations plus difficiles apparaissent ensuite dans certaines situations ; cela suggère une variabilité selon les tâches ou contextes plutôt qu’une dégradation générale. `;else text+=`Les observations positives et les difficultés coexistent sur la période ; aucune trajectoire unique ne peut être retenue. `;}
        if(f.contexts.length>=2)text+=`Le phénomène est observé dans plusieurs objectifs de séance, mais cela ne suffit pas à établir un transfert ou une généralisation. `; p.push(text.trim()); }); return p;
    }

    function reportContextParagraph(evidence,student){
      const dates=evidence.map(e=>e.dateKey).filter(Boolean).sort(); let p=`La période analysée comprend ${evidence.length} séance${evidence.length>1?'s':''} documentée${evidence.length>1?'s':''}`; if(dates.length)p+=` du ${reportHumanDate(dates[0])} au ${reportHumanDate(dates[dates.length-1])}`; p+=`. Les éléments ci-dessous distinguent les apprentissages, le fonctionnement observé, les aides renseignées et les suites retenues afin de ne pas confondre ces niveaux.`; return p;
    }

    function reportLearningParagraph(evidence,relations){
      const h=reportBuildHierarchy([],relations), l=h.learning.slice(0,4); if(!l.length)return `Les données ne permettent pas de hiérarchiser suffisamment les apprentissages sur la période.`;
      return `Les apprentissages les plus documentés sont ${reportRarityPhrase(l.map(reportFindingPhrase))}. Cette hiérarchie repose sur la récurrence et la polarité des observations ; elle ne constitue pas un classement du niveau scolaire.`;
    }

    function reportObservationParagraph(units,relations){
      const h=reportBuildHierarchy(units,relations), f=h.functioning.slice(0,4), out=[]; if(!f.length)return [`Aucun phénomène de fonctionnement n'est suffisamment récurrent pour être hiérarchisé.`];
      f.forEach(x=>{let s=`${reportTheme(x.theme).label} est documenté comme ${x.type==='strength'?'un point d’appui':x.type==='strength_with_variability'?'un point d’appui avec des variations':x.type==='fragility'?'une fragilité récurrente':x.type==='fragility_with_success'?'une fragilité récurrente malgré quelques réussites':'un fonctionnement contrasté'}.`; if(x.evolution)s+=` Les observations montrent une évolution située dans le temps, sans permettre de conclure à une généralisation.`; out.push(s);}); return out;
    }

    function reportMechanismParagraph(units){
      const info=units.filter(u=>u.theme==='information_selection'&&u.difficultySignal), proc=units.filter(u=>u.theme==='procedural'&&u.difficultySignal), geom=units.filter(u=>u.theme==='geometry'&&(u.positiveSignal||u.difficultySignal));
      const p=[]; if(info.length&&proc.length)p.push(`Dans certaines situations, la difficulté semble intervenir avant l’application de la procédure : les informations pertinentes doivent d’abord être sélectionnées et organisées. Les observations ne permettent toutefois pas d’affirmer que ce mécanisme explique à lui seul les erreurs rapportées.`); if(geom.length)p.push(`En géométrie, certaines observations permettent de distinguer la compréhension d’une notion de sa mobilisation ou de sa réalisation dans la tâche.`); return p.join(' ');
    }

    function reportEvolutionParagraph(relations){
      const ev=(relations.evolutions||[]).filter(e=>!['classroom_context','teacher_context'].includes(e.theme)).slice(0,4); if(!ev.length)return `Aucune trajectoire suffisamment comparable n’est identifiée automatiquement sur la période.`;
      return ev.map(e=>{const label=reportTheme(e.theme).short;if(e.laterPositive&&!e.laterDiff)return `Pour ${label}, des observations ultérieures sont plus favorables dans certaines situations ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale.`;if(e.laterDiff&&!e.laterPositive)return `Pour ${label}, des observations plus difficiles apparaissent ultérieurement dans certaines situations ; cela documente une variabilité, sans suffire à conclure à une dégradation générale.`;return `Pour ${label}, les observations positives et les difficultés coexistent sur la période ; aucune trajectoire unique ne peut être retenue.`;}).join(' ');
    }

    function reportAdaptationParagraph(evidence){
      const adaptations=evidence.flatMap(e=>e.adaptations), effects=evidence.flatMap(e=>Object.entries(e.effects||{}).map(([type,v])=>({type,value:Number(v)}))).filter(x=>!Number.isNaN(x.value));
      const p=[]; if(adaptations.length)p.push(`Les adaptations ou médiations renseignées concernent ${reportRarityPhrase(reportUnique(adaptations))}.`); if(effects.length){const pos=effects.filter(x=>x.value===2).length, part=effects.filter(x=>x.value===1).length;p.push(`${effects.length} effet${effects.length>1?'s':''} est/sont renseigné${effects.length>1?'s':''} dans Q4 : ${pos} positif${pos>1?'s':''} constaté${pos>1?'s':''} et ${part} partiel${part>1?'s':''} ou limité${part>1?'s':''}. Ces effets sont rapportés pour les séances concernées et ne sont pas interprétés comme une preuve causale.`);} if(!p.length)return `Aucune adaptation ou effet n’est suffisamment renseigné dans Q4 pour être synthétisé.`; return p.join(' ');
    }

    function reportTransferParagraph(evidence,relations){
      const q5=evidence.filter(e=>e.transfer), observed=q5.filter(e=>e.transfer==='observed').length; if(!q5.length)return `Aucun statut de transfert Q5 n’est renseigné sur la période.`; return `Q5 renseigne ${q5.length} situation${q5.length>1?'s':''} de transfert, dont ${observed} avec le statut « observé ». ${q5.some(e=>e.transferPrecision)?'Les précisions associées sont conservées comme éléments de contexte de ces observations. ':''}Ce statut documente ce qui a été déclaré dans la séance ; il n’est pas assimilé à une généralisation de la compétence.`;
    }

    function reportNextStepsParagraph(evidence,relations){
      const explicit=reportUnique(evidence.flatMap(e=>[...e.actions,...(e.actionPrecision?[e.actionPrecision]:[])])).slice(0,8);
      if(explicit.length)return `Les suites explicitement renseignées dans Q6 portent sur ${reportRarityPhrase(explicit)}. Elles sont présentées comme des décisions ou pistes pour la suite, sans être confondues avec des effets déjà démontrés.`;
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
      return {positive:e.filter(u=>u.positiveSignal||u.positive).length,difficulty:e.filter(u=>u.difficultySignal&&!u.positive).length,total:e.length};
    }

    function reportIntegrationTrajectory(units,relations){
      const h=reportBuildHierarchy(units,relations), candidates=[...h.learning.slice(0,3),...h.functioning.slice(0,3)];
      const phases=reportIntegrationPhaseData(units), out=[];
      candidates.slice(0,5).forEach(f=>{
        const states=phases.map(ph=>reportPhaseThemeState(units,ph.dates,f.theme));
        const first=states[0], last=states[states.length-1];
        if(!first.total&&!last.total) return;
        const label=reportTheme(f.theme).short;
        let sentence='';
        if(!first.total&&last.total){
          sentence=`Le domaine « ${label} » apparaît surtout dans les observations les plus récentes ; les données ne permettent pas de déterminer son évolution sur toute la période.`;
        }else if(first.total&&!last.total){
          sentence=`Le domaine « ${label} » est documenté au début de la période mais pas dans les dernières séances disponibles ; cette absence ne permet pas de conclure à une disparition du phénomène.`;
        }else if(first.difficulty&&last.positive&&!last.difficulty){
          sentence=`Le domaine « ${label} » est décrit comme difficile dans les premières observations puis plus favorable dans les dernières ; cela documente une évolution située, sans suffire à conclure à une stabilisation générale.`;
        }else if(first.positive&&!first.difficulty&&last.difficulty&&!last.positive){
          sentence=`Le domaine « ${label} » est décrit favorablement dans les premières observations puis plus difficilement dans les dernières ; cela documente une variabilité située, sans suffire à conclure à une dégradation générale.`;
        }else if(first.positive&&last.positive&&first.difficulty===0&&last.difficulty===0){
          sentence=`Le domaine « ${label} » comporte des éléments favorables au début comme à la fin de la période ; ce point d’appui apparaît donc dans plusieurs phases du suivi.`;
        }else if((first.difficulty||last.difficulty)&&(first.positive||last.positive)){
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
        const w=e.wbeRepere||{}; const key=w.hit||w.signature||'';
        if(!key)return;
        if(!map.has(key))map.set(key,{label:w.signature||w.hit,count:0,dates:[]});
        const row=map.get(key); row.count++; if(e.dateKey)row.dates.push(e.dateKey);
      });
      return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,6).map(x=>`${x.label} est explicitement validé comme repère WBE dans ${x.count} séance${x.count>1?'s':''}.`);
    }

    function reportIndicatorLabel(app){
      return ({0:'À renforcer',1:'En cours d’appropriation',2:'Mobilisé'}[Number(app)]||'non renseigné');
    }

    function reportIntegrationIndicators(evidence){
      const map=new Map();
      evidence.forEach(e=>e.indicators.forEach(i=>{
        const key=i.id||i.text; if(!map.has(key))map.set(key,[]);
        map.get(key).push({date:e.dateKey,text:i.text,app:i.appreciation});
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
      const actions=reportUnique(evidence.flatMap(e=>e.actions)), objectives=reportUnique(evidence.map(e=>e.actionObjective).filter(Boolean)), collaborations=reportUnique(evidence.flatMap(e=>e.collaborations));
      const p=[];
      if(actions.length)p.push(`Les suites Q6 documentent les orientations suivantes : ${reportRarityPhrase(actions.slice(0,8))}.`);
      if(objectives.length)p.push(`Les objectifs d’évolution renseignés portent sur ${reportRarityPhrase(objectives.slice(0,5))}.`);
      if(collaborations.length)p.push(`Les collaborations renseignées concernent ${reportRarityPhrase(collaborations.slice(0,6))}.`);
      if(!p.length)p.push(`Aucune suite Q6 suffisamment renseignée ne permet d’établir une orientation récurrente.`);
      return p.join(' ');
    }

    function reportIntegrationPIA(student){
      const st=getStudents().find(x=>x.nom===student);
      const pia=String(st?.pia||'').trim();
      if(!pia)return `Aucun objectif PIA n’est actuellement renseigné dans le dossier élève. Le rapport ne peut donc pas établir de rapprochement avec un PIA.`;
      return `Objectif(s) PIA renseigné(s) dans le dossier : « ${pia} ». Ce contenu est repris comme repère du dossier ; son degré d’atteinte n’est pas déduit automatiquement des séances et doit être mis en regard des données observées par l’équipe.`;
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

    function generateReport(){
      const student=document.getElementById('r-eleve')?.value||'',type=document.getElementById('r-periode')?.value||'';
      if(!student){alert('Sélectionnez un élève.');return;}
      const range=getReportRange(type);
    if(!range.start||!range.end||range.start>range.end){alert('Vérifiez les dates de début et de fin de la période.');return;}
      const logs=getDB().filter(l=>isJournalSession(l)&&sessionParts(l).eleve===student&&sessionParts(l).date>=range.start&&sessionParts(l).date<=range.end).sort((a,b)=>sessionSortKey(a).localeCompare(sessionSortKey(b)));
      if(!logs.length){alert(`Aucune observation pour ${student} entre le ${range.start} et le ${range.end}.`);return;}
      const evidence=logs.map(reportSessionEvidence), units=reportExtractUnits(evidence), relations=reportRelations(units);
    renderMeetingPrep(evidence,relations);
      if(type==='PV1'||type==='PV2'){
        const integration=reportIntegrationReport(evidence,units,relations,student,type);
        document.getElementById('report-text').innerHTML=`<div class="report-output-head"><div><strong>${escapeHtml(reportIntegrationLabel(type))} — ${escapeHtml(student)}</strong><div style="font-size:.72rem;color:#64748b;margin-top:2px;">Corpus disponible jusqu’au ${escapeHtml(range.end)}</div></div><span class="v11-mini-tag">${logs.length} séance${logs.length>1?'s':''}</span></div>${integration}`;
        document.getElementById('report-output-box')?.classList.remove('hidden');
        return;
      }
      const objectives=reportUnique(evidence.map(e=>e.objectif).filter(Boolean));
      const indicators=reportUnique(evidence.flatMap(e=>e.indicators.map(i=>i.text)));
      const observations=reportUnique(evidence.flatMap(e=>e.observations.map(o=>o.text)));
      const adaptations=reportUnique(evidence.flatMap(e=>e.adaptations));
      const wbeHits=logs.filter(l=>l.q3?.repereWBE?.hit).length;
      const dataWarnings=reportDataQuality(evidence);
      const hierarchy=reportBuildHierarchy(units,relations);
      const priorityDetails=reportPriorityDetails(units,relations);
      const linked=reportLinkedSynthesis(evidence,units,relations);
      const natural=`<div class="natural-report">
        <div class="report-section"><h4>1. Vue d’ensemble hiérarchisée</h4><p>${escapeHtml(reportContextParagraph(evidence,student))}</p><p>${escapeHtml(reportHierarchyParagraph(units,relations))}</p>${priorityDetails.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div>
        <div class="report-section"><h4>2. Apprentissages : points d’appui et fragilités</h4><p>${escapeHtml(reportLearningParagraph(evidence,relations))}</p></div>
        <div class="report-section"><h4>3. Fonctionnement observé</h4>${reportObservationParagraph(units,relations).map(x=>`<p>${escapeHtml(x.replace(/\*\*/g,''))}</p>`).join('')}</div>
        ${reportMechanismParagraph(units)?`<div class="report-section"><h4>4. Liens entre fonctionnement et apprentissages</h4><p>${escapeHtml(reportMechanismParagraph(units))}</p></div>`:''}
        <div class="report-section"><h4>5. Évolution au cours de la période</h4><p>${escapeHtml(reportEvolutionParagraph(relations))}</p></div>
        <div class="report-section"><h4>6. Aides, adaptations et effets</h4><p>${escapeHtml(reportAdaptationParagraph(evidence))}</p></div>
        <div class="report-section"><h4>7. Chaînage des données enregistrées</h4>${linked.paragraphs.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}<p class="report-disclaimer">Le chaînage relie les informations présentes dans une même séance. En l’absence d’un identifiant relationnel explicite entre Q2, Q3, Q4, Q5 et Q6, il s’agit d’un rapprochement documentaire et non d’une attribution causale.</p></div>
        <div class="report-section"><h4>8. Réinvestissement / transfert</h4><p>${escapeHtml(reportTransferParagraph(evidence,relations))}</p></div>
        <div class="report-section"><h4>9. Suites de l’accompagnement</h4><p>${escapeHtml(reportNextStepsParagraph(evidence,relations))}</p></div>
        <div class="report-section report-evidence-note"><h4>10. Traçabilité et qualité des données</h4>${dataWarnings.length?`<p><strong>Points à vérifier :</strong> ${escapeHtml(dataWarnings.join(' '))}</p>`:''}<p>${logs.length} séance${logs.length>1?'s':''} analysée${logs.length>1?'s':''} · ${observations.length} observation${observations.length>1?'s':''} distincte${observations.length>1?'s':''} · ${indicators.length} indicateur${indicators.length>1?'s':''} · ${adaptations.length} adaptation${adaptations.length>1?'s':''} · ${wbeHits} repère${wbeHits>1?'s':''} WBE explicitement validé${wbeHits>1?'s':''}.</p><p class="report-disclaimer">La hiérarchie repose sur la récurrence, la nature des observations et leur comparaison lorsqu’elle est possible. Elle ne constitue pas un classement du niveau de l’élève. Une réussite ponctuelle n’est pas transformée en maîtrise générale et un changement de contenu n’est pas présenté comme une progression.</p></div>
      </div>`;
      const metrics=[objectives.length,indicators.length,observations.length,adaptations.length];
      document.getElementById('report-text').innerHTML=`<div class="report-output-head"><div><strong>Synthèse naturelle — ${escapeHtml(student)}</strong><div style="font-size:.72rem;color:#64748b;margin-top:2px;">${escapeHtml(type)} · ${range.start} → ${range.end}</div></div><span class="v11-mini-tag">${logs.length} séance${logs.length>1?'s':''}</span></div><div class="report-evidence-grid"><div class="report-evidence"><strong>${metrics[0]}</strong><span>objectifs distincts</span></div><div class="report-evidence"><strong>${metrics[1]}</strong><span>indicateurs</span></div><div class="report-evidence"><strong>${metrics[2]}</strong><span>observations distinctes</span></div><div class="report-evidence"><strong>${metrics[3]}</strong><span>adaptations</span></div></div>${natural}`;
      document.getElementById('report-output-box')?.classList.remove('hidden');
    setReportView(false);
    }

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
    const studentId=Number(document.getElementById('f-eleve')?.value||0);
    const box=document.getElementById('session-main-subject-bubbles'); if(!box) return;
    const student=getStudents().find(s=>Number(s.id)===studentId);
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
JR_HANDLERS["h1"] = {attr:"onclick", fn:function(event){
openMicrosoftConnection()
}};
JR_HANDLERS["h2"] = {attr:"onclick", fn:function(event){
showTab('accueil')
}};
JR_HANDLERS["h3"] = {attr:"onclick", fn:function(event){
showTab('agenda');
switchAgendaView('month')
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
switchAgendaView('week')
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
openConflictResolutionV72()
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
