/* =========================================================
   JOURNALIER V74 — STORAGE VAULT & ENCRYPTED PERSISTENCE
   Extrait modulaire de journalier-core.js (Lot 3.1)
   ========================================================= */

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

    // Identifiants historiques conservés volontairement pour la compatibilité.
    const JOURNALIER_DB_NAME = 'journalier-secure-v72';
    const JOURNALIER_DB_VERSION = 1;
    const JOURNALIER_STATE_STORE = 'states';
    const JOURNALIER_KEY_STORE = 'keys';

    // Nouveau coffre local granulaire. L'ancien coffre reste intact pendant la migration.
    const JOURNALIER_STORAGE_DB_NAME = 'journalier-secure-v74';
    const JOURNALIER_STORAGE_DB_VERSION = 1;
    const JOURNALIER_STORAGE_SCHEMA_VERSION = 2;
    const JOURNALIER_STORAGE_STORES = Object.freeze([
        'meta', 'students', 'sessions', 'agenda', 'pia', 'sync', 'keys', 'migration'
    ]);

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
            meta: { securityArchitecture:'account-scoped-granular-encrypted-store', storageSchemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION, createdAt:new Date().toISOString(), piaRecords:{}, piaImports:{}, chapterNarratives:{} }
        };
    }

    function journalierOpenLegacyDB() {
        return new Promise((resolve,reject)=>{
            if(!('indexedDB' in window)) return reject(new Error('IndexedDB est requis pour le stockage local sécurisé.'));
            const req=indexedDB.open(JOURNALIER_DB_NAME,JOURNALIER_DB_VERSION);
            req.onupgradeneeded=()=>{
                const db=req.result;
                if(!db.objectStoreNames.contains(JOURNALIER_STATE_STORE)) db.createObjectStore(JOURNALIER_STATE_STORE,{keyPath:'accountKey'});
                if(!db.objectStoreNames.contains(JOURNALIER_KEY_STORE)) db.createObjectStore(JOURNALIER_KEY_STORE,{keyPath:'accountKey'});
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir le stockage sécurisé local historique.'));
        });
    }

    function journalierOpenStorageDB() {
        return new Promise((resolve,reject)=>{
            if(!('indexedDB' in window)) return reject(new Error('IndexedDB est requis pour le stockage local sécurisé.'));
            const req=indexedDB.open(JOURNALIER_STORAGE_DB_NAME,JOURNALIER_STORAGE_DB_VERSION);
            req.onupgradeneeded=()=>{
                const db=req.result;
                if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('students'))db.createObjectStore('students',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('agenda'))db.createObjectStore('agenda',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('pia'))db.createObjectStore('pia',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('sync'))db.createObjectStore('sync',{keyPath:'storageKey'});
                if(!db.objectStoreNames.contains('keys'))db.createObjectStore('keys',{keyPath:'accountKey'});
                if(!db.objectStoreNames.contains('migration'))db.createObjectStore('migration',{keyPath:'storageKey'});
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir le stockage local sécurisé granulaire.'));
            req.onblocked=()=>reject(new Error('La migration du stockage local est bloquée par un autre onglet Journalier ouvert. Fermez les autres onglets puis réessayez.'));
        });
    }

    function journalierTx(db,stores,mode,callback){
        let tx;
        try{tx=db.transaction(stores,mode,{durability:'strict'});}catch(_){tx=db.transaction(stores,mode);}
        return new Promise((resolve,reject)=>{
            let result;
            try{result=callback(tx)}catch(e){try{tx.abort();}catch(_){/* transaction déjà inactive ou fermée */}reject(e);return;}
            tx.oncomplete=()=>resolve(result);
            tx.onerror=()=>reject(tx.error||new Error('Transaction IndexedDB impossible.'));
            tx.onabort=()=>reject(tx.error||new Error('Transaction IndexedDB interrompue.'));
        });
    }

    function journalierRequest(request){
        return new Promise((resolve,reject)=>{
            request.onsuccess=()=>resolve(request.result);
            request.onerror=()=>reject(request.error||new Error('Opération IndexedDB impossible.'));
        });
    }

    async function journalierGetLegacyRecord(storeName,key){
        const db=await journalierOpenLegacyDB();
        try{return await journalierRequest(db.transaction(storeName,'readonly').objectStore(storeName).get(key));}
        finally{db.close();}
    }

    async function journalierLegacyStatePresence(accountKey){
        const db=await journalierOpenLegacyDB();
        try{return Boolean(await journalierRequest(db.transaction(JOURNALIER_STATE_STORE,'readonly').objectStore(JOURNALIER_STATE_STORE).getKey(accountKey)));}
        finally{db.close();}
    }

    async function journalierGetStorageRecord(storeName,id,accountKey=null){
        const db=await journalierOpenStorageDB();
        const key=storeName==='keys'?id:`${accountKey||''}:${id}`;
        try{return await journalierRequest(db.transaction(storeName,'readonly').objectStore(storeName).get(key));}
        finally{db.close();}
    }

    async function journalierGetAllStorageRecords(storeName){
        const db=await journalierOpenStorageDB();
        try{return await journalierRequest(db.transaction(storeName,'readonly').objectStore(storeName).getAll());}
        finally{db.close();}
    }

    async function journalierPutKey(accountKey,key){
        const db=await journalierOpenStorageDB();
        try{
            await journalierTx(db,['keys'],'readwrite',tx=>tx.objectStore('keys').put({accountKey,key,createdAt:new Date().toISOString()}));
        }finally{db.close();}
    }

    async function journalierGetEncryptionKey(accountKey){
        const record=await journalierGetStorageRecord('keys',accountKey);
        if(record?.key)return record.key;
        const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
        await journalierPutKey(accountKey,key);
        return key;
    }

    function journalierAad(accountKey,type,id){
        return new TextEncoder().encode(`journalier-storage-v${JOURNALIER_STORAGE_SCHEMA_VERSION}|${accountKey}|${type}|${id}`);
    }

    function journalierCanonicalJson(value){
        if(Array.isArray(value))return `[${value.map(journalierCanonicalJson).join(',')}]`;
        if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${journalierCanonicalJson(value[k])}`).join(',')}}`;
        return JSON.stringify(value);
    }

    async function journalierDigestBuffer(buffer){
        const digest=await crypto.subtle.digest('SHA-256',buffer);
        return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    async function journalierEncryptRecord(accountKey,type,id,value,key){
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const payload=new TextEncoder().encode(journalierCanonicalJson(value));
        const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:journalierAad(accountKey,type,id)},key,payload);
        return {
            storageKey:`${accountKey}:${String(id)}`, id:String(id), ownerId:accountKey, type, schemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION,
            iv:iv.buffer, ciphertext, digest:await journalierDigestBuffer(ciphertext), updatedAt:new Date().toISOString()
        };
    }

    async function journalierDecryptRecord(record,key){
        if(!record?.ciphertext||!record?.iv||!record?.ownerId||!record?.type||record?.id==null)throw new Error('Enregistrement local sécurisé invalide.');
        if(record.schemaVersion!==JOURNALIER_STORAGE_SCHEMA_VERSION)throw new Error('Version de stockage local non prise en charge.');
        const actual=await journalierDigestBuffer(record.ciphertext);
        if(record.digest&&actual!==record.digest)throw new Error('Intégrité du stockage local compromise : empreinte invalide.');
        const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:journalierAad(record.ownerId,record.type,String(record.id))},key,record.ciphertext);
        return JSON.parse(new TextDecoder().decode(plain));
    }

    async function journalierReadLegacyState(accountKey,key){
        const present=await journalierLegacyStatePresence(accountKey);
        if(!present)return {found:false,state:null,error:null};
        try{
            const record=await journalierGetLegacyRecord(JOURNALIER_STATE_STORE,accountKey);
            if(!record)return {found:false,state:null,error:null};
            if(!record?.ciphertext||!Array.isArray(record.iv))throw new Error('Données locales historiques invalides.');
            const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,new Uint8Array(record.ciphertext));
            return {found:true,state:JSON.parse(new TextDecoder().decode(plain)),error:null};
        }catch(error){return {found:true,state:null,error};}
    }

    function journalierSplitMeta(state){
        const meta=journalierClone(state.meta||{});
        delete meta.piaRecords;
        delete meta.piaImports;
        return meta;
    }

    function journalierBuildSyncRegistryFromRecords(records){
        const registry={version:'1',students:{},sessions:{},agenda:null,pia:{}};
        for(const row of records){
            const id=String(row.id||'');
            if(row.type==='student')registry.students[id]=row.value;
            else if(row.type==='session')registry.sessions[id]=row.value;
            else if(row.type==='agenda')registry.agenda=row.value;
            else if(row.type==='pia')registry.pia[id]=row.value;
        }
        return registry;
    }

    async function journalierLoadGranularState(accountKey,key,account){
        const [metaRows,studentRows,sessionRows,agendaRows,piaRows,syncRows,migrationRows]=await Promise.all([
            journalierGetAllStorageRecords('meta'),journalierGetAllStorageRecords('students'),journalierGetAllStorageRecords('sessions'),
            journalierGetAllStorageRecords('agenda'),journalierGetAllStorageRecords('pia'),journalierGetAllStorageRecords('sync'),journalierGetAllStorageRecords('migration')
        ]);
        const metaRow=metaRows.find(r=>String(r.ownerId)===String(accountKey)&&String(r.id)===String(accountKey));
        if(!metaRow)return null;
        const meta=await journalierDecryptRecord(metaRow,key);
        if(meta.ownerId!==accountKey)throw new Error('Isolation de compte locale invalide : chargement refusé.');
        if(meta.migrationStatus!=='complete')return null;

        const decryptMany=async(rows)=>Promise.all(rows.filter(r=>r.ownerId===accountKey).map(async r=>({id:String(r.id),type:r.type,value:await journalierDecryptRecord(r,key)})));
        const [students, sessions, agenda, pia, sync]=await Promise.all([
            decryptMany(studentRows),decryptMany(sessionRows),decryptMany(agendaRows),decryptMany(piaRows),decryptMany(syncRows)
        ]);
        const state=journalierEmptyState(accountKey,account);
        state.identity=meta.identity||state.identity;
        state.sync=meta.sync||state.sync;
        state.meta={...(meta.meta||{}),storageSchemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION,piaRecords:{},piaImports:{}};
        for(const row of pia){
            const val=row.value;
            if(val?.record||val?.imported){
                if(val.record)state.meta.piaRecords[row.id]=val.record;
                else delete state.meta.piaRecords[row.id];
                if(val.imported)state.meta.piaImports[row.id]=val.imported;
            }else if(val?.type==='PIA_ANNUEL'){
                state.meta.piaRecords[row.id]=val;
                if(val.sourceContinuity)state.meta.piaImports[row.id]=val.sourceContinuity;
            }else if(val?.sourceContinuity){
                state.meta.piaImports[row.id]=val.sourceContinuity;
            }else if(val){
                state.meta.piaRecords[row.id]=val;
            }
        }
        state.students=students.map(r=>r.value);
        state.sessions=sessions.map(r=>r.value);
        const agendaEvents=[],agendaSpecial=[];
        for(const row of agenda){if(row.id==='__config'||row.id==='__exceptions')agendaSpecial.push(row);else agendaEvents.push(row);}
        state.agenda={__events:agendaEvents.map(r=>r.value),__exceptions:{},__config:{}};
        for(const row of agendaSpecial){if(row.id==='__config')state.agenda.__config=row.value||{};if(row.id==='__exceptions')state.agenda.__exceptions=row.value||{};}
        state.syncRegistry=journalierBuildSyncRegistryFromRecords(sync);
        state.version=JOURNALIER_ARCHITECTURE_VERSION;state.ownerId=accountKey;
        return {state,migrationRows};
    }

    async function journalierPreparePersistOperations(snapshot,previous,accountKey,key,force=false){
        const operations=[];
        const previousState=previous||{};
        const changed=(a,b)=>journalierCanonicalJson(a)!==journalierCanonicalJson(b);
        const maps=[
            ['students',snapshot.students||[],previousState.students||[],'student',x=>x.studentId],
            ['sessions',snapshot.sessions||[],previousState.sessions||[],'session',x=>x.id]
        ];
        for(const [store,current,old,type,idOf] of maps){
            const oldMap=new Map((old||[]).map(x=>[String(idOf(x)),x]));
            const curMap=new Map((current||[]).map(x=>[String(idOf(x)),x]));
            for(const [id,value] of curMap){if(force||!oldMap.has(id)||changed(value,oldMap.get(id)))operations.push({op:'put',store,id,type,value});}
            for(const id of oldMap.keys())if(!curMap.has(id))operations.push({op:'delete',store,id});
        }

        const currentAgenda=snapshot.agenda||{},oldAgenda=previousState.agenda||{};
        const curEvents=new Map((currentAgenda.__events||[]).map(x=>[String(x.eventId||x.id),x]));
        const oldEvents=new Map((oldAgenda.__events||[]).map(x=>[String(x.eventId||x.id),x]));
        for(const [id,value] of curEvents){if(force||!oldEvents.has(id)||changed(value,oldEvents.get(id)))operations.push({op:'put',store:'agenda',id,type:'agenda',value});}
        for(const id of oldEvents.keys())if(!curEvents.has(id))operations.push({op:'delete',store:'agenda',id});
        const agendaSpecial=[['__config',currentAgenda.__config||{},oldAgenda.__config||{}],['__exceptions',currentAgenda.__exceptions||{},oldAgenda.__exceptions||{}]];
        for(const [id,value,old] of agendaSpecial)if(force||changed(value,old))operations.push({op:'put',store:'agenda',id,type:'agenda',value});

        const currentPia=snapshot.meta?.piaRecords||{},oldPia=previousState.meta?.piaRecords||{};
        const currentImports=snapshot.meta?.piaImports||{},oldImports=previousState.meta?.piaImports||{};
        const piaIds=new Set([...Object.keys(currentPia),...Object.keys(oldPia),...Object.keys(currentImports),...Object.keys(oldImports)]);
        for(const id of piaIds){
            const value=currentPia[id];
            const imported=currentImports[id];
            if(value==null && imported==null){if(oldPia[id]!=null||oldImports[id]!=null)operations.push({op:'delete',store:'pia',id});continue;}
            if(force||changed(value,oldPia[id])||changed(imported,oldImports[id]))operations.push({op:'put',store:'pia',id,type:'pia',value:{record:value||null,imported:imported||null}});
        }

        const currentRegistry=snapshot.syncRegistry||{},oldRegistry=previousState.syncRegistry||{};
        const syncEntries=[];
        for(const [id,value] of Object.entries(currentRegistry.students||{}))syncEntries.push({id:`student:${id}`,type:'student',value});
        for(const [id,value] of Object.entries(currentRegistry.sessions||{}))syncEntries.push({id:`session:${id}`,type:'session',value});
        if(currentRegistry.agenda)syncEntries.push({id:'agenda:agenda',type:'agenda',value:currentRegistry.agenda});
        for(const [id,value] of Object.entries(currentRegistry.pia||{}))syncEntries.push({id:`pia:${id}`,type:'pia',value});
        const oldSyncEntries=[];
        for(const [id,value] of Object.entries(oldRegistry.students||{}))oldSyncEntries.push({id:`student:${id}`,value});
        for(const [id,value] of Object.entries(oldRegistry.sessions||{}))oldSyncEntries.push({id:`session:${id}`,value});
        if(oldRegistry.agenda)oldSyncEntries.push({id:'agenda:agenda',value:oldRegistry.agenda});
        for(const [id,value] of Object.entries(oldRegistry.pia||{}))oldSyncEntries.push({id:`pia:${id}`,value});
        const oldSyncMap=new Map(oldSyncEntries.map(x=>[x.id,x.value])),newSyncMap=new Map(syncEntries.map(x=>[x.id,x.value]));
        for(const item of syncEntries)if(force||!oldSyncMap.has(item.id)||changed(item.value,oldSyncMap.get(item.id)))operations.push({op:'put',store:'sync',id:item.id,type:item.type,value:item.value});
        for(const id of oldSyncMap.keys())if(!newSyncMap.has(id))operations.push({op:'delete',store:'sync',id});

        const metaValue={ownerId:accountKey,migrationStatus:'complete',identity:snapshot.identity||{},sync:snapshot.sync||{},meta:journalierSplitMeta(snapshot),updatedAt:new Date().toISOString()};
        const oldMetaValue={ownerId:accountKey,migrationStatus:'complete',identity:previousState.identity||{},sync:previousState.sync||{},meta:journalierSplitMeta(previousState)};
        if(force||changed(metaValue,oldMetaValue))operations.push({op:'put',store:'meta',id:accountKey,type:'meta',value:metaValue});
        operations.push({op:'put',store:'migration',id:accountKey,type:'migration',value:{status:'complete',schemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION,completedAt:new Date().toISOString()}});
        return operations;
    }

    async function journalierApplyPersistOperations(operations,accountKey,key){
        if(!operations.length)return;
        const prepared=[];
        for(const op of operations){
            if(op.op==='delete'){prepared.push(op);continue;}
            prepared.push({...op,record:await journalierEncryptRecord(accountKey,op.type,op.id,op.value,key)});
        }
        const db=await journalierOpenStorageDB();
        try{
            await journalierTx(db,JOURNALIER_STORAGE_STORES,'readwrite',tx=>{
                for(const op of prepared){const store=tx.objectStore(op.store);if(op.op==='delete')store.delete(`${accountKey}:${String(op.id)}`);else store.put(op.record);}
            });
        }finally{db.close();}
    }

    function securePersistState(){
        return JournalierSecurity.persist(DataStore.state).then(result=>{journalierScheduleAutoSync?.();return result;}).catch(_=>{console.error('Écriture sécurisée impossible.');setCloudStatus?.('⚠️ Les données locales n’ont pas pu être sécurisées.','error');return false;});
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
        state.syncRegistry.students=state.syncRegistry.students||{};state.syncRegistry.sessions=state.syncRegistry.sessions||{};
        if(!('agenda' in state.syncRegistry))state.syncRegistry.agenda=null;state.syncRegistry.pia=state.syncRegistry.pia||{};state.syncRegistry.version='1';
        state.sync=state.sync||{status:'local-only',lastSyncAt:null,pendingChanges:0};return state.syncRegistry;
    }
    function v72RecountPending(state){
        const r=v72EnsureSyncRegistry(state);let count=0,conflicts=0;
        for(const x of Object.values(r.students)){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict','deleted-pending'].includes(x?.status))count++;}
        for(const x of Object.values(r.sessions)){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict','deleted-pending'].includes(x?.status))count++;}
        for(const x of Object.values(r.pia||{})){if(x?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict'].includes(x?.status))count++;}
        if(r.agenda?.status==='conflict')conflicts++;if(['local-pending','local-changed','conflict'].includes(r.agenda?.status))count++;
        state.sync.pendingChanges=count;if(conflicts>0)state.sync.status='conflict';else if(count===0)state.sync.status='synced';else if(state.sync.status==='conflict'||state.sync.status==='synced')state.sync.status='pending';
    }
    function v72MarkStudentsPending(state,previous,next){
        const r=v72EnsureSyncRegistry(state),before=new Map((previous||[]).map(x=>[String(x.studentId),{item:x,fingerprint:syncFingerprint(syncWithoutVolatileMeta(x))}])),afterIds=new Set((next||[]).map(x=>String(x.studentId)));
        for(const item of next||[]){const id=String(item.studentId),previousEntry=before.get(id),old=previousEntry?.fingerprint||null,fp=syncFingerprint(syncWithoutVolatileMeta(item));if(old!==fp){const existing=r.students[id]||{};r.students[id]={...existing,status:existing.status==='conflict'?'conflict':'local-pending',localDirtyAt:new Date().toISOString()};}}
        for(const [id,previousEntry] of before.entries()){if(afterIds.has(id))continue;const existing=r.students[id]||{};r.students[id]={...existing,status:'deleted-pending',studentId:id,localDeletedAt:new Date().toISOString()};}
    }
    function v72MarkSessionsPending(state,previous,next){
        const r=v72EnsureSyncRegistry(state),before=new Map((previous||[]).map(x=>[x.id,x])),afterIds=new Set((next||[]).map(x=>String(x.id)));
        for(const item of next||[]){const fp=syncFingerprint(syncWithoutVolatileMeta(item)),oldItem=before.get(item.id),old=oldItem?syncFingerprint(syncWithoutVolatileMeta(oldItem)):null;if(old!==fp){const existing=r.sessions[item.id]||{},previousStudentId=String(existing.studentId||oldItem?.identification?.eleveId||'').trim(),nextStudentId=String(item.identification?.eleveId||'').trim(),studentChanged=Boolean(oldItem&&previousStudentId&&nextStudentId&&previousStudentId!==nextStudentId);r.sessions[item.id]={...existing,status:existing.status==='conflict'?'conflict':'local-pending',studentId:nextStudentId||previousStudentId||null,localDirtyAt:new Date().toISOString(),...(studentChanged&&existing.remoteId?{remoteMovePending:true,previousStudentId,previousRemoteId:existing.remoteId,previousETag:existing.eTag||null}:{}),};}}
        for(const oldItem of previous||[]){
            const id=String(oldItem.id);
            if(!afterIds.has(id)){
                const existing=r.sessions[id]||{};
                r.sessions[id]={...existing,status:'deleted-pending',studentId:oldItem.identification?.eleveId||existing.studentId||null,localDeletedAt:new Date().toISOString()};
            }
        }
    }
    function v72MarkAgendaPending(state,previous,next){const r=v72EnsureSyncRegistry(state),old=syncFingerprint(syncWithoutVolatileMeta(previous||{})),fp=syncFingerprint(syncWithoutVolatileMeta(next||{}));if(old!==fp)r.agenda={...(r.agenda||{}),status:r.agenda?.status==='conflict'?'conflict':'local-pending',localDirtyAt:new Date().toISOString()};}
    function v72MarkPiaPending(state,studentId){if(!studentId)return;const r=v72EnsureSyncRegistry(state),existing=r.pia[studentId]||{};r.pia[studentId]={...existing,status:existing.status==='conflict'?'conflict':'local-pending',localDirtyAt:new Date().toISOString()};v72RecountPending(state);}
    function v72MarkPiaSynced(state,studentId,pia){if(!studentId)return;const r=v72EnsureSyncRegistry(state),fp=syncFingerprint(syncWithoutVolatileMeta(pia||{}));r.pia[studentId]={...(r.pia[studentId]||{}),fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};v72RecountPending(state);}
    window.v72MarkPiaPending=v72MarkPiaPending;window.v72MarkPiaSynced=v72MarkPiaSynced;

    const JournalierSecurity={
        accountKey:null,account:null,key:null,state:null,ready:false,recoveryRequired:false,recoveryReason:null,
        writeQueue:Promise.resolve(),persistedSnapshot:null,
        async activate(account){
            const accountKey=await journalierHashIdentity(account);
            const key=await journalierGetEncryptionKey(accountKey);
            let loaded=await journalierLoadGranularState(accountKey,key,account);
            let needsMigration=false;
            this.recoveryRequired=false;this.recoveryReason=null;
            if(!loaded){
                const legacyKey=await journalierGetLegacyRecord(JOURNALIER_KEY_STORE,accountKey).catch(()=>null);
                if(legacyKey?.key){
                    const legacy=await journalierReadLegacyState(accountKey,legacyKey.key);
                    if(legacy.state){
                        loaded={state:legacy.state};
                        needsMigration=true;
                    }else if(legacy.error){
                        this.recoveryRequired=true;this.recoveryReason='legacy-unreadable';
                        loaded={state:journalierEmptyState(accountKey,account)};
                    }else{
                        loaded={state:journalierEmptyState(accountKey,account)};
                    }
                }else {loaded={state:journalierEmptyState(accountKey,account)};needsMigration=false;}
            }
            const state=journalierClone(loaded.state||journalierEmptyState(accountKey,account));
            if(!state||state.ownerId&&state.ownerId!==accountKey)throw new Error('Isolation de compte locale invalide : chargement refusé.');
            state.version=JOURNALIER_ARCHITECTURE_VERSION;state.ownerId=accountKey;
            state.identity={...(state.identity||{}),accountKey,provider:'microsoft365',displayName:account?.name||account?.username||state.identity?.displayName||'Utilisateur Journalier',microsoftAccount:account?.username||state.identity?.microsoftAccount||null};
            v72EnsureSyncRegistry(state);state.meta??={};state.meta.piaRecords??={};state.meta.piaImports??={};state.meta.chapterNarratives??={};state.meta.storageSchemaVersion=JOURNALIER_STORAGE_SCHEMA_VERSION;
            journalierMigrateLegacyLocalStorageNarratives(state);
            this.accountKey=accountKey;this.account=account;this.key=key;this.state=state;this.ready=true;this.persistedSnapshot=(loaded.state&&!needsMigration&&!this.recoveryRequired)?journalierClone(state):null;
            if(needsMigration||!this.persistedSnapshot||this.recoveryRequired)await this.persist(state,{force:true});
            try{await navigator.storage?.persist?.();}catch(_){/* persistance de stockage refusée ou non supportée */}
            return state;
        },
        lock(){this.accountKey=null;this.account=null;this.key=null;this.state=null;this.ready=false;this.recoveryRequired=false;this.recoveryReason=null;this.persistedSnapshot=null;this.writeQueue=Promise.resolve();},
        async clearAccountRecords(accountKey=this.accountKey){
            if(!accountKey)return;
            const db=await journalierOpenStorageDB();
            try{
                await journalierTx(db,JOURNALIER_STORAGE_STORES,'readwrite',tx=>{
                    for(const storeName of ['students','sessions','agenda','pia','sync']){
                        const store=tx.objectStore(storeName);
                        if(typeof store.openCursor==='function'){
                            const req=store.openCursor();
                            req.onsuccess=e=>{
                                const cursor=e.target.result;
                                if(cursor){
                                    if(String(cursor.key).startsWith(`${accountKey}:`))cursor.delete();
                                    cursor.continue();
                                }
                            };
                        }else if(typeof store.getAllKeys==='function'){
                            const req=store.getAllKeys();
                            req.onsuccess=()=>{
                                (req.result||[]).forEach(k=>{if(String(k).startsWith(`${accountKey}:`))store.delete(k);});
                            };
                        }
                    }
                });
            }finally{db.close();}
        },
        persist(state,{force=false,purgeBefore=false}={}){
            if(!this.ready||!this.accountKey||!this.key)return Promise.reject(new Error('Stockage local verrouillé : authentification Microsoft requise.'));
            this.writeQueue=this.writeQueue.catch(()=>{}).then(async()=>{
                if(purgeBefore)await this.clearAccountRecords(this.accountKey);
                const snapshot=journalierClone(this.state||state),previous=purgeBefore?null:this.persistedSnapshot;
                const operations=await journalierPreparePersistOperations(snapshot,previous,this.accountKey,this.key,force||purgeBefore||!previous);
                await journalierApplyPersistOperations(operations,this.accountKey,this.key);
                this.persistedSnapshot=journalierClone(snapshot);
                return {ok:true,operations:operations.length};
            });
            return this.writeQueue;
        },
        async diagnostics(){
            const db=await journalierOpenStorageDB();
            try{
                const counts={};
                for(const store of JOURNALIER_STORAGE_STORES){if(store==='keys')continue;counts[store]=await journalierRequest(db.transaction(store,'readonly').objectStore(store).count());}
                let persistent=null;try{persistent=await navigator.storage?.persisted?.();}catch(_){/* interrogation persistance non supportée */}
                return {database:JOURNALIER_STORAGE_DB_NAME,schemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION,stores:counts,persistentStorage:persistent,recoveryRequired:this.recoveryRequired};
            }finally{db.close();}
        }
    };

    function journalierMigrateLegacyLocalStorageNarratives(state) {
        if (typeof localStorage === 'undefined' || !state) return;
        try {
            state.meta = state.meta || {};
            state.meta.chapterNarratives = state.meta.chapterNarratives || {};
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('journalier_chapter_narrative_')) {
                    const clusterKey = k.replace('journalier_chapter_narrative_', '');
                    const val = localStorage.getItem(k);
                    if (val && clusterKey && !state.meta.chapterNarratives[clusterKey]) {
                        state.meta.chapterNarratives[clusterKey] = val;
                    }
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => {
                try { localStorage.removeItem(k); } catch (_) { /* suppression clé obsolète de secours */ }
            });
        } catch (_) {
            /* migration localStorage ignorée si stockage inaccessible */
        }
    }

    async function journalierHashIdentity(account){
        const raw=String(account?.homeAccountId||account?.localAccountId||'').trim();
        if(!raw)throw new Error('Identité Microsoft stable indisponible : connexion refusée.');
        const bytes=new TextEncoder().encode(`journalier-v72:${raw}`);
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    const DataStore={
        get state(){
            if(!JournalierSecurity.ready)return {version:JOURNALIER_ARCHITECTURE_VERSION,ownerId:null,identity:null,students:[],sessions:[],agenda:{},sync:{status:'locked',lastSyncAt:null,pendingChanges:0},syncRegistry:{version:'1',students:{},sessions:{},agenda:null,pia:{}},meta:{locked:true}};
            const s=JournalierSecurity.state;v72EnsureSyncRegistry(s);return s;
        },
        getIdentity(){return this.state.identity;},getState(){return this.state;},persistState(state){return securePersistState(state);},isReady(){return JournalierSecurity.ready;},
        getStudents(){return this.state.students.filter(s=>s.ownerId===this.state.ownerId);},
        saveStudents(list){if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');const previous=this.state.students.filter(s=>s.ownerId===this.state.ownerId).map(journalierClone),normalized=(Array.isArray(list)?list:[]).map(secureNormalizeStudent);this.state.students=normalized;v72MarkStudentsPending(this.state,previous,this.getStudents());v72RecountPending(this.state);return securePersistState();},
        getSessions(){return this.state.sessions.filter(s=>s.ownerId===this.state.ownerId);},
        saveSessions(list){if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');const previous=this.state.sessions.filter(s=>s.ownerId===this.state.ownerId).map(journalierClone),students=this.getStudents();this.state.sessions=(Array.isArray(list)?list:[]).map(x=>secureNormalizeSession(x,students));v72MarkSessionsPending(this.state,previous,this.getSessions());v72RecountPending(this.state);return securePersistState();},
        getAgenda(){return secureNormalizeAgenda(this.state.agenda);},
        saveAgenda(agenda){if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');const previous=secureNormalizeAgenda(this.state.agenda||{});this.state.agenda=secureNormalizeAgenda(agenda);v72MarkAgendaPending(this.state,previous,this.getAgenda());v72RecountPending(this.state);return securePersistState();},
        getChapterNarrative(clusterKey){if(!clusterKey)return '';const meta=this.state?.meta||{};return String((meta.chapterNarratives&&meta.chapterNarratives[clusterKey])||'');},
        saveChapterNarrative(clusterKey,text){if(!JournalierSecurity.ready)throw new Error('Connectez-vous avec votre compte Microsoft avant de modifier les données.');if(!clusterKey)return Promise.resolve(false);this.state.meta=this.state.meta||{};this.state.meta.chapterNarratives=this.state.meta.chapterNarratives||{};this.state.meta.chapterNarratives[clusterKey]=String(text||'');return securePersistState();},
        diagnostics(){const s=this.state,agenda=this.getAgenda();return{architectureVersion:s.version,accountScoped:true,encryptedLocalStore:true,storageDatabase:JOURNALIER_STORAGE_DB_NAME,storageSchemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION,recoveryRequired:JournalierSecurity.recoveryRequired,students:this.getStudents().length,sessions:this.getSessions().length,agendaEntries:Array.isArray(agenda?.__events)?agenda.__events.length:0,sync:s.sync,syncRegistry:s.syncRegistry};}
    };

    window.JournalierDataStore=DataStore;
    window.DataStore=DataStore;
    window.getDB = function() { return DataStore.getSessions(); };
    window.saveDB = function(db) { DataStore.saveSessions(Array.isArray(db) ? db : []); };
    window.getStudents = function() { return DataStore.getStudents(); };
    window.saveStudentsList = function(list) {
        DataStore.saveStudents(Array.isArray(list) ? list : []);
        window.JournalierV74?.refreshStudents?.();
        if (typeof updateStudentDropdowns === 'function') updateStudentDropdowns();
        if (typeof renderStudentsView === 'function') renderStudentsView();
        if (typeof updateStats === 'function') updateStats();
    };
    window.isJournalSession = function(entry) {
        return Boolean(entry && entry.type === 'SEANCE' && String(entry.schemaVersion) === JOURNALIER_ARCHITECTURE_VERSION);
    };
    async function activateJournalierAccount(account){
        await JournalierSecurity.activate(account);
        if(JournalierSecurity.recoveryRequired)setCloudStatus?.('⚠️ Le coffre local historique est illisible. Journalier tente une récupération depuis OneDrive sans supprimer les données distantes.','error');
        if(JournalierSecurity.state?.agenda?.__config?.periods){
            applyAgendaPeriodConfig(JournalierSecurity.state.agenda.__config.periods);
        }
        window.JournalierV74?.refreshStudents?.();
        renderStudentsView?.();
        renderAgenda?.();
        updateStudentDropdowns?.();
        updateStats?.();
        window.JournalierV74?.renderDashboard?.();
        window.updateMicrosoftUI?.();
        return JournalierSecurity.state;
    }

    