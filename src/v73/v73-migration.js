/* Journalier V73 — migration legacy vers AppFolder
 *
 * La permission Files.ReadWrite.AppFolder ne permet volontairement pas à
 * Journalier de lire Mes fichiers/Journalier. L'ancien dossier doit donc
 * être copié une seule fois par l'utilisateur dans l'AppFolder, sous le nom
 * Journalier-legacy. Le module lit alors cette copie, valide/normalise les
 * données et les importe dans l'espace actif sans supprimer la source.
 */
(function(){
  'use strict';

  const {
    graphDownloadJsonByItemId,
    graphGetAppRoot,
    graphGetByPath,
    graphListChildren,
    graphRequest,
    secureNormalizeAgenda,
    secureNormalizeSession,
    secureNormalizeStudent,
    syncStableValue,
    syncWithoutVolatileMeta,
    v72SyncAgenda,
    v72SyncSession,
    v72SyncStudent,
    validateStrictAgenda,
    validateStrictSession,
    validateStrictStudent,
    DataStore,
    JournalierSecurity,
    JOURNALIER_ARCHITECTURE_VERSION
  } = window.JournalierMigrationBridge || {};

  const getMsAccount = () => window.JournalierMigrationBridge?.msAccount || null;

  const LEGACY_NAME = 'Journalier-legacy';
  const ACTIVE_ROOT = 'Journalier';
  const state = { analyzed:null, running:false };

  function msg(text,type='info'){
    const el=document.getElementById('v73-migration-status');
    if(el){el.className='ms-status-box '+type;el.textContent=text;}
  }
  function escText(v){return String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  function appPath(path){return String(path||'').replace(/^\/+|\/+$/g,'');}
  async function itemByAppPath(path){
    const root=await graphGetAppRoot();
    const rel=appPath(path);
    if(!rel)return root;
    return graphRequest(`/me/drive/items/${encodeURIComponent(root.id)}:/${rel.split('/').filter(Boolean).map(encodeURIComponent).join('/')}:`);
  }
  async function listByAppPath(path){return graphListChildren((await itemByAppPath(path)).id);}
  async function readJsonByAppPath(path){return graphDownloadJsonByItemId((await itemByAppPath(path)).id);}

  async function findLegacyRoot(){
    const root=await graphGetAppRoot();
    const children=await graphListChildren(root.id);
    return (children||[]).find(x=>x?.folder&&x.name===LEGACY_NAME)||null;
  }

  async function analyzeLegacy(){
    if(state.running)return;
    state.running=true;
    try{
      if(!getMsAccount())throw new Error('Connectez-vous à Microsoft avant d’analyser la migration.');
      msg('Analyse de la copie legacy dans l’AppFolder…');
      const legacy=await findLegacyRoot();
      if(!legacy){
        state.analyzed=null;
        msg(`Aucune copie « ${LEGACY_NAME} » détectée dans l’AppFolder.\n\nCopiez d’abord votre ancien dossier Journalier dans l’espace sécurisé et renommez sa copie « ${LEGACY_NAME} ».`,'info');
        return;
      }

      const studentsFolder=await itemByAppPath(`${LEGACY_NAME}/eleves`);
      const studentFolders=(await graphListChildren(studentsFolder.id)).filter(x=>x?.folder);
      const students=[];
      const sessions=[];
      const errors=[];
      let sessionCount=0;

      for(const folder of studentFolders){
        try{
          const profile=await graphDownloadJsonByItemId((await itemByAppPath(`${LEGACY_NAME}/eleves/${folder.name}/profil.json`)).id);
          validateStrictStudent(profile.json,'Profil legacy');
          const student=secureNormalizeStudent(profile.json);
          student.studentId=String(profile.json.studentId||folder.name);
          student.ownerId=JournalierSecurity.accountKey;
          student.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
          students.push(student);

          try{
            const sf=await itemByAppPath(`${LEGACY_NAME}/eleves/${folder.name}/seances`);
            const items=(await graphListChildren(sf.id)).filter(x=>x?.file&&/\.json$/i.test(x.name));
            for(const item of items){
              try{
                const raw=await graphDownloadJsonByItemId(item.id);
                validateStrictSession(raw.json,'Séance legacy');
                const session=secureNormalizeSession(raw.json,students);
                const sid=String(session.identification?.eleveId||'');
                if(sid!==String(student.studentId)){
                  session.identification={...(session.identification||{}),eleveId:student.studentId,eleve:session.identification?.eleve||student.nom};
                }
                session.ownerId=JournalierSecurity.accountKey;
                sessions.push(session); sessionCount++;
              }catch(e){errors.push(`${folder.name}/${item.name}: ${e?.message||String(e)}`);}
            }
          }catch(e){if(!String(e?.message||e).includes('Graph 404'))errors.push(`${folder.name}/seances: ${e?.message||String(e)}`);}
        }catch(e){errors.push(`${folder.name}/profil.json: ${e?.message||String(e)}`);}
      }

      let agenda=null;
      try{
        const raw=await readJsonByAppPath(`${LEGACY_NAME}/agenda/agenda.json`);
        validateStrictAgenda(raw.json,'Agenda legacy');
        agenda=secureNormalizeAgenda(raw.json||{});
      }catch(e){
        if(!String(e?.message||e).includes('Graph 404'))errors.push(`agenda/agenda.json: ${e?.message||String(e)}`);
      }

      const report={legacy,students,sessions,agenda,errors,studentCount:students.length,sessionCount,agendaPresent:Boolean(agenda)};
      state.analyzed=report;
      const lines=[
        'Analyse terminée.',
        `✓ ${students.length} élève(s)`,
        `✓ ${sessionCount} séance(s)`,
        agenda?'✓ agenda.json détecté':'⚠️ agenda.json absent',
        errors.length?`⚠️ ${errors.length} élément(s) à vérifier`:'✓ aucune erreur de validation',
        '',
        errors.length?errors.slice(0,5).join('\n'):'Les données peuvent être importées sans modifier la copie legacy.'
      ];
      msg(lines.join('\n'),errors.length?'error':'success');
      updateButtons();
    }catch(e){state.analyzed=null;msg('⚠️ Analyse impossible : '+(e?.message||String(e)),'error');}
    finally{state.running=false;updateButtons();}
  }

  function fingerprint(v){return JSON.stringify(syncStableValue(syncWithoutVolatileMeta(v||{})));}
  function nonEmptyAgenda(a){return Boolean(a&&((Array.isArray(a.__uniqueEvents)&&a.__uniqueEvents.length)||Object.keys(a.__exceptions||{}).length||Object.keys(a).some(k=>!['__uniqueEvents','__exceptions'].includes(k))));}

  async function importLegacy(){
    if(state.running)return;
    if(!state.analyzed) return analyzeLegacy();
    const r=state.analyzed;
    if(r.errors.length) throw new Error('L’importation est bloquée : corrigez d’abord les erreurs signalées dans l’analyse.');
    if(!r.students.length&&!r.sessions.length&&!r.agenda)throw new Error('Aucune donnée métier à importer.');

    state.running=true;
    try{
      msg('Vérification de l’espace Journalier actuel…');
      const current=DataStore.getState();
      const existingStudents=DataStore.getStudents();
      const existingSessions=DataStore.getSessions();
      const existingAgenda=DataStore.getAgenda();

      const studentMap=new Map(existingStudents.map(s=>[String(s.studentId),s]));
      const sessionMap=new Map(existingSessions.map(s=>[String(s.id),s]));
      const conflicts=[];
      let addedStudents=0,addedSessions=0;

      for(const s of r.students){
        const id=String(s.studentId);
        const old=studentMap.get(id);
        if(old){
          if(fingerprint(old)!==fingerprint(s))conflicts.push(`élève ${s.nom} (${id}) déjà présent mais différent`);
          continue;
        }
        studentMap.set(id,s); addedStudents++;
      }
      for(const s of r.sessions){
        const id=String(s.id);
        const old=sessionMap.get(id);
        if(old){
          if(fingerprint(old)!==fingerprint(s))conflicts.push(`séance ${id} déjà présente mais différente`);
          continue;
        }
        sessionMap.set(id,s); addedSessions++;
      }
      if(conflicts.length)throw new Error('Conflits détectés :\n'+conflicts.slice(0,10).join('\n'));

      let mergedAgenda=existingAgenda;
      if(r.agenda){
        if(nonEmptyAgenda(existingAgenda)&&fingerprint(existingAgenda)!==fingerprint(r.agenda)){
          throw new Error('L’agenda actuel contient déjà des données différentes. Import bloqué pour éviter tout écrasement.');
        }
        if(!nonEmptyAgenda(existingAgenda))mergedAgenda=r.agenda;
      }

      // Écriture locale normalisée.
      DataStore.saveStudents([...studentMap.values()]);
      DataStore.saveSessions([...sessionMap.values()]);
      if(r.agenda&&!nonEmptyAgenda(existingAgenda))DataStore.saveAgenda(mergedAgenda);
      const st=DataStore.getState();
      await DataStore.persistState(st);

      // Écriture distante contrôlée dans l’AppFolder actif.
      for(const s of r.students){
        const id=String(s.studentId), existing=await graphGetByPath(`${ACTIVE_ROOT}/eleves/${encodeURIComponent(id)}/profil.json`).catch(()=>null);
        if(!existing)await v72SyncStudent(s,null);
      }
      for(const s of r.sessions){
        const id=String(s.id), existing=await graphGetByPath(`${ACTIVE_ROOT}/eleves/${encodeURIComponent(s.identification?.eleveId||s.identification?.eleve)}/seances/${encodeURIComponent(id)}.json`).catch(()=>null);
        if(!existing)await v72SyncSession(s,null,[...studentMap.values()]);
      }
      if(r.agenda&&!nonEmptyAgenda(existingAgenda))await v72SyncAgenda(r.agenda,null);

      await diagnoseSyncManagerV72();
      window.JournalierV73?.refreshStudents?.();
      window.renderStudentsView?.(); window.renderAgenda?.(); window.updateStats?.(); window.updateStudentDropdowns?.();
      msg(`✓ Migration terminée.\n✓ ${addedStudents} nouvel(s) élève(s)\n✓ ${addedSessions} nouvelle(s) séance(s)\n${r.agenda&&!nonEmptyAgenda(existingAgenda)?'✓ agenda importé':'✓ agenda existant conservé'}\n\nLa copie legacy et l’ancien dossier original n’ont pas été supprimés.`,'success');
      state.analyzed=null;
      updateButtons();
    }catch(e){msg('⚠️ Migration non effectuée : '+(e?.message||String(e)),'error');throw e;}
    finally{state.running=false;updateButtons();}
  }

  function updateButtons(){
    const a=document.getElementById('v73-migration-analyze');
    const i=document.getElementById('v73-migration-import');
    const o=document.getElementById('v73-migration-open');
    if(a)a.disabled=!getMsAccount()||state.running;
    if(i)i.disabled=!getMsAccount()||state.running||!state.analyzed||Boolean(state.analyzed.errors.length);
    if(o)o.disabled=!getMsAccount()||state.running;
  }

  function mount(){
    const host=document.querySelector('#ms-cloud-status');
    if(!host||document.getElementById('v73-migration-box'))return;
    const box=document.createElement('div');
    box.id='v73-migration-box';
    box.style.cssText='margin-top:12px;padding:12px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc';
    box.innerHTML=`<div style="font-weight:700;margin-bottom:5px">Migration des anciennes données</div>
      <div style="font-size:.76rem;color:#475569;line-height:1.45">Votre ancien dossier <b>Mes fichiers/Journalier</b> ne peut pas être lu directement avec l’autorisation AppFolder. Copiez-le d’abord dans l’espace sécurisé sous le nom <b>${LEGACY_NAME}</b>. La migration analysera ensuite les profils, séances et agenda sans supprimer la source.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">
        <button id="v73-migration-open" class="btn-secondary" type="button">Ouvrir l’espace sécurisé</button>
        <button id="v73-migration-analyze" class="btn-secondary" type="button">Analyser la migration</button>
        <button id="v73-migration-import" class="btn-primary" type="button" disabled>Importer dans Journalier</button>
      </div>
      <div id="v73-migration-status" class="ms-status-box" style="margin-top:9px">Aucune migration lancée.</div>`;
    host.insertAdjacentElement('afterend',box);
    document.getElementById('v73-migration-open').onclick=async()=>{
      try{const root=await graphGetAppRoot(true);if(!root?.webUrl)throw new Error('URL de l’espace sécurisé indisponible.');window.open(root.webUrl,'_blank','noopener');}
      catch(e){msg('⚠️ '+(e?.message||String(e)),'error');}
    };
    document.getElementById('v73-migration-analyze').onclick=()=>analyzeLegacy();
    document.getElementById('v73-migration-import').onclick=async()=>{try{await importLegacy();}catch(_){} };
    updateButtons();
  }

  window.JournalierLegacyMigration={analyze:analyzeLegacy,import:importLegacy,mount,updateButtons};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  const originalUpdate=window.updateMicrosoftUI;
  if(typeof originalUpdate==='function'){
    window.updateMicrosoftUI=function(){originalUpdate();mount();updateButtons();};
  }
})();
