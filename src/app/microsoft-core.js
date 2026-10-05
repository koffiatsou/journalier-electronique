/* =========================================================
   JOURNALIER V74 — DataStore réel + Microsoft365Store / SyncManager
   ---------------------------------------------------------
   V74 conserve le modèle pédagogique actuel et isole sa couche de sécurité.
   - LocalStore reste la source locale/offline.
   - Chaque sauvegarde locale marque uniquement les objets modifiés.
   - Graph/OneDrive est utilisé par le SyncManager, jamais directement
     par le formulaire Q2-Q6.
   - Les conflits bloquent toute écriture automatique.
   ========================================================= */
const MSAL_REDIRECT_URI = new URL('msal-redirect.html', document.baseURI).href;
const MS_CONFIG={clientId:"65c3db78-9bad-4a08-8eac-404b83e368cb",tenantId:"96c46ef2-21cc-480d-92df-0bf9fd599a97",redirectUri:MSAL_REDIRECT_URI,postLogoutRedirectUri:MSAL_REDIRECT_URI,scopes:["openid","profile","Files.ReadWrite.AppFolder"]};
const GRAPH_SCOPES=["Files.ReadWrite.AppFolder"], GRAPH_BASE="https://graph.microsoft.com/v1.0", GRAPH_ROOT_FOLDER="Journalier", GRAPH_APP_ROOT_PATH="/me/drive/special/approot";
let msalInstance=null, msAccount=null, msalReadyPromise=null;

// La synchronisation automatique attend 30 s et reste suspendue dans la fenêtre Microsoft.
let journalierAutoSyncTimer=null, journalierAutoSyncRunning=false;
function journalierMicrosoftModalOpen(){
    const modal=document.getElementById('ms-connection-modal');
    return Boolean(modal&&modal.style.display!=='none');
}
function journalierScheduleAutoSync(delay=30000){
  if(!msAccount||!JournalierSecurity.ready||!navigator.onLine)return;
  if(journalierAutoSyncTimer)clearTimeout(journalierAutoSyncTimer);
  journalierAutoSyncTimer=setTimeout(()=>{journalierAutoSyncTimer=null;journalierRunAutoSync();},delay);
}
async function journalierRunAutoSync(){
    if(journalierAutoSyncRunning||!msAccount||!JournalierSecurity.ready||!navigator.onLine||journalierMicrosoftModalOpen())return;
  journalierAutoSyncRunning=true;
  try{await syncPendingLocalChangesV72({silent:true});}
  catch(e){console.warn('Journalier — synchronisation automatique impossible.',e);}
  finally{journalierAutoSyncRunning=false;}
}
window.addEventListener('online',()=>journalierScheduleAutoSync(30000));
window.journalierScheduleAutoSync=journalierScheduleAutoSync;
function msConfigReady(){return Boolean(MS_CONFIG.clientId&&MS_CONFIG.tenantId&&MS_CONFIG.redirectUri);}
function setCloudStatus(message,type='info'){const el=document.getElementById('ms-cloud-status');if(el){el.className='ms-status-box '+type;el.textContent=message;}}
function v72ConflictEntries(){
  const state=DataStore.state, r=state.syncRegistry||{}, entries=[];
  const students=DataStore.getStudents(), sessions=DataStore.getSessions();
  for(const [studentId,reg] of Object.entries(r.students||{})){
    if(reg?.status!=='conflict')continue;
    const student=students.find(x=>String(x.studentId)===String(studentId))||null;
    entries.push({type:'student',key:String(studentId),reg,local:student,label:student?.nom||reg.studentId||studentId});
  }
  for(const [sessionId,reg] of Object.entries(r.sessions||{})){
    if(reg?.status!=='conflict')continue;
    const session=sessions.find(x=>String(x.id)===String(sessionId))||null;
    entries.push({type:'session',key:String(sessionId),reg,local:session,label:session?.identification?.eleve||reg.studentId||sessionId});
  }
  if(r.agenda?.status==='conflict')entries.push({type:'agenda',key:'agenda',reg:r.agenda,local:DataStore.getAgenda(),label:'Agenda'});
  return entries;
}
function updateMicrosoftUI(){
  const status=document.getElementById('ms-config-status'),login=document.getElementById('ms-login-action'),logout=document.getElementById('ms-logout-action'),dot=document.getElementById('ms-dot'),label=document.getElementById('ms-account-label'),button=document.getElementById('ms-connect-btn');
  const prepare=document.getElementById('ms-prepare-cloud-action'),verify=document.getElementById('ms-verify-cloud-action'),appTest=document.getElementById('ms-appfolder-test-action'),diagnose=document.getElementById('ms-sync-diagnose-action'),sync=document.getElementById('ms-sync-action'),resolve=document.getElementById('ms-resolve-conflict-action'),reset=document.getElementById('ms-reset-onedrive-action');
  if(msAccount){if(dot)dot.classList.add('connected');if(label)label.textContent=msAccount.name||msAccount.username||'Microsoft connecté';if(button)button.querySelector('span:last-child').textContent='Compte Microsoft';if(status){status.className='ms-status-box success';status.textContent='Connecté : '+(msAccount.username||msAccount.name||'compte Microsoft');}if(login){login.textContent='Reconnecter';login.disabled=false;}if(logout)logout.disabled=false;if(prepare)prepare.disabled=false;if(verify)verify.disabled=false;if(appTest)appTest.disabled=false;if(diagnose)diagnose.disabled=false;if(sync)sync.disabled=false;if(resolve)resolve.disabled=!v72ConflictEntries().length;if(reset)reset.disabled=false;return;}
  if(dot)dot.classList.remove('connected');if(label)label.textContent='Microsoft non connecté';if(button)button.querySelector('span:last-child').textContent='Connexion Microsoft';if(status){status.className='ms-status-box';status.textContent=msConfigReady()?'La configuration est prête. Vous pouvez lancer la connexion Microsoft.':'Configuration Microsoft incomplète.';}if(login)login.disabled=!msConfigReady();if(logout)logout.disabled=true;if(prepare)prepare.disabled=true;if(verify)verify.disabled=true;if(appTest)appTest.disabled=true;if(diagnose)diagnose.disabled=true;if(sync)sync.disabled=true;if(resolve)resolve.disabled=true;if(reset)reset.disabled=true;
}
function openMicrosoftConnection(){animateClick(document.getElementById('ms-connect-btn'),'validating');const modal=document.getElementById('ms-connection-modal');if(modal)modal.style.display='flex';updateMicrosoftUI();}
function closeMicrosoftConnection(){const modal=document.getElementById('ms-connection-modal');if(modal)modal.style.display='none';}
async function initMicrosoftAuth(){
  if(msalReadyPromise)return msalReadyPromise;
  msalReadyPromise=(async()=>{
    try{
      const mod=window.JournalierMSAL;if(!mod)throw new Error('MSAL n’est pas chargé.');
      const authority='https://login.microsoftonline.com/'+MS_CONFIG.tenantId;
      msalInstance=await mod.createStandardPublicClientApplication({auth:{clientId:MS_CONFIG.clientId,authority,redirectUri:MS_CONFIG.redirectUri,postLogoutRedirectUri:MS_CONFIG.postLogoutRedirectUri},cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false}});
      const accounts=msalInstance.getAllAccounts();msAccount=accounts.length?accounts[0]:null;
    if(msAccount&&!journalierLockedByTimeout){try{await activateJournalierAccount(msAccount);}catch(err){JournalierSecurity.lock();msAccount=null;setCloudStatus('⚠️ Espace local sécurisé indisponible : '+(err?.message||String(err)),'error');}}
      updateMicrosoftUI();return true;
    }catch(err){console.error('Initialisation Microsoft impossible.');setCloudStatus('Impossible d’initialiser Microsoft.','error');return false;}
  })();return msalReadyPromise;
}
async function startMicrosoftLogin(){
  const btn=document.getElementById('ms-login-action');if(btn)btn.disabled=true;const status=document.getElementById('ms-config-status');
  try{
    if(status){status.className='ms-status-box';status.textContent='Préparation de la connexion Microsoft…';}
    if(!await initMicrosoftAuth())throw new Error('MSAL n’est pas initialisé.');
    const response=await msalInstance.loginPopup({scopes:MS_CONFIG.scopes,redirectUri:MS_CONFIG.redirectUri,prompt:'select_account'});
    JournalierSecurity.lock();msAccount=response.account;await activateJournalierAccount(msAccount);journalierResetAutoLockAfterUnlock?.();updateMicrosoftUI();
    try{const imported=await hydrateMicrosoftDataIfLocalEmpty();window.JournalierV74?.refreshStudents?.();window.JournalierV74?.renderDashboard?.();if(imported?.imported)showAppToast(`Connexion réussie : ${imported.students||0} élève(s), ${imported.sessions||0} séance(s) et l’agenda ont été récupérés.`,'success');else showAppToast('Connexion Microsoft réussie.','success');}
    catch(_){setCloudStatus('✓ Compte Microsoft connecté.\n⚠️ Les données OneDrive n’ont pas pu être récupérées automatiquement.','error');showAppToast('Connexion réussie, mais récupération des données OneDrive impossible.','error',5000);}
    }catch(err){journalierClearAutoLockTimers?.();JournalierSecurity.lock();msAccount=null;window.JournalierV74?.renderDashboard?.();const msg=err?.errorMessage||err?.message||'Erreur Microsoft inconnue';const code=err?.errorCode||err?.code||'';const detail=code?`[${code}] ${msg}`:msg;if(status){status.className='ms-status-box error';status.textContent='Connexion non effectuée : '+detail;}setCloudStatus('Détail Microsoft : '+detail,'error');showAppToast('La connexion Microsoft n’a pas abouti.','error',6500);}
  finally{if(btn)btn.disabled=false;updateMicrosoftUI();}
}
async function disconnectMicrosoft(){
  const btn=document.getElementById('ms-logout-action');if(btn)btn.disabled=true;
    try{if(!msalInstance)await initMicrosoftAuth();const account=msAccount||msalInstance?.getAllAccounts?.()[0]||null;if(msalInstance&&account)await msalInstance.logoutPopup({account,postLogoutRedirectUri:MS_CONFIG.postLogoutRedirectUri});journalierClearAutoLockTimers?.();JournalierSecurity.lock();msAccount=null;journalierLockedByTimeout=false;if(journalierAutoSyncTimer){clearTimeout(journalierAutoSyncTimer);journalierAutoSyncTimer=null;}updateStudentDropdowns?.();renderStudentsView?.();renderAgenda?.();updateStats?.();window.JournalierV74?.renderDashboard?.();updateMicrosoftUI();setCloudStatus('Microsoft déconnecté. Les données locales restent chiffrées et sont inaccessibles sans réauthentification.','success');showAppToast('Déconnexion Microsoft effectuée.','success');}
  catch(err){const msg=err?.errorMessage||err?.message||'Erreur lors de la déconnexion Microsoft.';if(btn)btn.disabled=false;setCloudStatus('Déconnexion Microsoft non confirmée : '+msg,'error');showAppToast('La déconnexion Microsoft n’a pas abouti.','error',4500);}
  finally{updateMicrosoftUI();}
}
async function getMicrosoftGraphToken(){if(!await initMicrosoftAuth())throw new Error('MSAL non initialisé.');const account=msAccount||msalInstance.getAllAccounts()[0];if(!account)throw new Error('Aucun compte Microsoft connecté.');msAccount=account;try{return (await msalInstance.acquireTokenSilent({account,scopes:GRAPH_SCOPES})).accessToken;}catch(_){return (await msalInstance.acquireTokenPopup({account,scopes:GRAPH_SCOPES})).accessToken;}}
async function graphRequest(path,options={}){
  const token=await getMicrosoftGraphToken();
  const headers=new Headers(options.headers||{});
  headers.set('Authorization','Bearer '+token);
  if(options.body&&!headers.has('Content-Type')&&options.method&&options.method.toUpperCase()!=='GET')headers.set('Content-Type','application/json');
  const requestUrl=String(path||'').startsWith(GRAPH_BASE+'/')?String(path):GRAPH_BASE+path;
  const response=await fetch(requestUrl,{...options,headers});
  if(!response.ok){
    let data=null,message='';
    try{data=await response.json();message=data?.error?.message||JSON.stringify(data);}catch(_){message=await response.text();}
    const code=data?.error?.code||'unknown';
    const requestId=response.headers.get('request-id')||response.headers.get('client-request-id')||'';
    throw new Error(`Graph ${response.status} [${code}]${requestId?` request-id=${requestId}`:''} : ${message}`);
  }
  const text=await response.text();
  if(!text)return null;
  try{return JSON.parse(text);}catch(_){return text;}
}
function graphEncodePath(path){return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');}
let graphAppRootCache=null;
async function graphGetAppRoot(force=false){if(!force&&graphAppRootCache?.id)return graphAppRootCache;graphAppRootCache=await graphRequest(GRAPH_APP_ROOT_PATH);if(!graphAppRootCache?.id)throw new Error('Microsoft Graph n’a pas retourné l’AppFolder root.');return graphAppRootCache;}
function graphRelativeAppPath(path){const normalized=String(path||'').replace(/^\/+|\/+$/g,'');const rootName=GRAPH_ROOT_FOLDER.replace(/^\/+|\/+$/g,'');if(normalized===rootName)return '';if(normalized.startsWith(rootName+'/'))return normalized.slice(rootName.length+1);return normalized;}
async function graphGetByPath(path){const relative=graphRelativeAppPath(path);const root=await graphGetAppRoot();if(!relative)return root;return graphRequest(`/me/drive/items/${encodeURIComponent(root.id)}:/${graphEncodePath(relative)}:`);}
async function graphCreateChildFolder(parentId,name){return graphRequest(`/me/drive/items/${encodeURIComponent(parentId)}/children`,{method:'POST',body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});}
async function graphGetOrCreateFolder(parentId,name,parentPath){try{return await graphGetByPath(parentPath?`${parentPath}/${name}`:name);}catch(err){if(!String(err.message||err).includes('Graph 404'))throw err;try{return await graphCreateChildFolder(parentId,name);}catch(e){if(String(e.message||e).includes('Graph 409'))return await graphGetByPath(parentPath?`${parentPath}/${name}`:name);throw e;}}}
async function graphEnsureJournalierStructure(){const root=await graphGetAppRoot();const profil=await graphGetOrCreateFolder(root.id,'profil',GRAPH_ROOT_FOLDER),eleves=await graphGetOrCreateFolder(root.id,'eleves',GRAPH_ROOT_FOLDER),agenda=await graphGetOrCreateFolder(root.id,'agenda',GRAPH_ROOT_FOLDER),pia=await graphGetOrCreateFolder(root.id,'pia',GRAPH_ROOT_FOLDER),system=await graphGetOrCreateFolder(root.id,'system',GRAPH_ROOT_FOLDER);return{root,profil,eleves,agenda,pia,system};}
async function graphGetItemMetaById(itemId){
  return graphRequest(`/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,eTag,parentReference,file,folder,lastModifiedDateTime`);
}
async function graphDeleteProbeItem(itemId){
  if(!itemId)return;
  try{
    const meta=await graphGetItemMetaById(itemId);
    await graphDeleteItemWithETag(itemId,meta.eTag||null);
  }catch(err){
    if(!String(err?.message||err).includes('404'))throw err;
  }
}
async function testMicrosoftAppFolder(){
  const b=document.getElementById('ms-appfolder-test-action');
  if(b)b.disabled=true;
  setCloudStatus('Test AppFolder : obtention de /drive/special/approot…','');
  let probeFolderId=null;
  let probeItemId=null;
  let cleanupError=null;
  try{
    const root=await graphGetAppRoot(true);
    if(!root.id)throw new Error('AppFolder introuvable : aucun identifiant de dossier retourné.');

    const probeFolderName=`__journalier_appfolder_probe_${Date.now()}`;
    const probeFolder=await graphCreateChildFolder(root.id,probeFolderName);
    probeFolderId=probeFolder.id;

    const probePayload={
      schema:'JOURNALIER-APPFOLDER-PROBE-1',
      createdAt:new Date().toISOString(),
      appFolderId:root.id
    };

    const probeItem=await graphWriteJson(probeFolder.id,'probe.json',probePayload);
    probeItemId=probeItem.id;

    const readBack=await graphReadItemByIdWithJson(probeItem.id);
    if(JSON.stringify(readBack.json)!==JSON.stringify(probePayload)){
      throw new Error('Le fichier de test a été créé mais son contenu relu ne correspond pas.');
    }

    // Le fichier de test peut avoir changé d’eTag après sa création/lecture.
    // On relit donc toujours son eTag courant avant suppression.
    await graphDeleteProbeItem(probeItem.id);
    probeItemId=null;

    // La création/suppression du fichier enfant a modifié l’eTag du dossier parent.
    // On récupère impérativement l’eTag courant avant de supprimer le dossier de test.
    const freshFolder=await graphGetItemMetaById(probeFolder.id);
    await graphDeleteItemWithETag(probeFolder.id,freshFolder.eTag||null);
    probeFolderId=null;

    setCloudStatus(`✓ AppFolder fonctionnel.
✓ approot : ${root.name||'AppFolder'}
✓ création / lecture / suppression testées.
✓ Aucune donnée métier Journalier n’a été modifiée.`,'success');
    showAppToast('Test AppFolder réussi.','success');
    return{ok:true,root};
  }catch(err){
    const msg=err?.message||String(err);

    // Nettoyage limité aux seuls objets créés par CE test.
    try{
      if(probeItemId){
        await graphDeleteProbeItem(probeItemId);
        probeItemId=null;
      }
    }catch(cleanErr){
      cleanupError=cleanErr?.message||String(cleanErr);
    }

    try{
      if(probeFolderId){
        const freshFolder=await graphGetItemMetaById(probeFolderId);
        await graphDeleteItemWithETag(probeFolderId,freshFolder.eTag||null);
        probeFolderId=null;
      }
    }catch(cleanErr){
      cleanupError=(cleanupError?cleanupError+' | ':'')+(cleanErr?.message||String(cleanErr));
    }

    const suffix=cleanupError
      ? `\n\n⚠️ Nettoyage du dossier de test incomplet : ${cleanupError}`
      : '';
    setCloudStatus('⚠️ Test AppFolder échoué.\n'+msg+'\n\nAucune donnée métier Journalier n’a été modifiée.'+suffix,'error');
    showAppToast('Le test AppFolder a échoué.','error',6000);
    return{ok:false,error:msg,cleanupError};
  }finally{
    if(b)b.disabled=!msAccount;
  }
}
async function graphWriteJsonWithETag(parentId,filename,payload,eTag){
  const name=String(filename||'');
  if(name==='profil.json')validateStrictStudent(payload,'Écriture profil élève');
  else if(name==='agenda.json')validateStrictAgenda(payload,'Écriture agenda');
  else if(name==='sync.json')validateStrictSyncRecord(payload,'Écriture synchronisation');
  else if(name==='deletions.json')validateStrictDeletionRecord(payload,'Écriture registre des suppressions');
  else if(name==='probe.json')validateStrictJsonPayload(payload,'Écriture probe AppFolder',16*1024);
  else if(name==='pia.json')validateStrictPIA(payload,'Écriture PIA');
  else if(/\.json$/i.test(name)&&/^[^/]+\.json$/i.test(name))validateStrictSession(payload,'Écriture séance');
  else validateStrictJsonPayload(payload,`Écriture ${name||'JSON'}`);
  const headers={'Content-Type':'text/plain'};
  if(eTag)headers['If-Match']=eTag;
  return graphRequest(`/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(filename)}:/content`,{method:'PUT',headers,body:JSON.stringify(payload,null,2)});
}
function graphWriteJson(parentId,filename,payload){return graphWriteJsonWithETag(parentId,filename,payload,null);}
async function graphDownloadJsonByItemId(itemId){
  const meta=await graphRequest(`/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,eTag,parentReference,file,folder,lastModifiedDateTime`);
  // @microsoft.graph.downloadUrl est une instance annotation. Microsoft recommande
  // une requête dédiée avec `select=...` pour la récupérer dans une application JavaScript.
  const downloadMeta=await graphRequest(`/me/drive/items/${encodeURIComponent(itemId)}?select=id,@microsoft.graph.downloadUrl`);
  const downloadUrl=downloadMeta?.['@microsoft.graph.downloadUrl'];
  if(!downloadUrl)throw new Error('Microsoft Graph n’a pas fourni d’URL de téléchargement pré-authentifiée pour ce fichier.');
  let parsedUrl;
  try{parsedUrl=new URL(downloadUrl);}catch(_){throw new Error('URL de téléchargement Microsoft Graph invalide.');}
  const host=parsedUrl.hostname.toLowerCase();
  const allowed=host==='files.1drv.com'||host.endsWith('.files.1drv.com')||host==='1drv.com'||host.endsWith('.1drv.com')||host.endsWith('.sharepoint.com');
  if(parsedUrl.protocol!=='https:'||!allowed)throw new Error('URL de téléchargement Microsoft Graph refusée : domaine inattendu.');
  const response=await fetch(parsedUrl.toString(),{method:'GET',redirect:'follow',cache:'no-store'});
  if(!response.ok)throw new Error(`Téléchargement Graph ${response.status} : ${response.statusText||'échec du téléchargement'}.`);
  const text=await response.text();
  try{return{item:meta,json:JSON.parse(text)};}catch(_){throw new Error('Le contenu distant n’est pas un JSON valide.');}
}
async function graphReadItemWithJson(path){const item=await graphGetByPath(path);return graphDownloadJsonByItemId(item.id);}
async function graphReadItemByIdWithJson(itemId){return graphDownloadJsonByItemId(itemId);}
async function graphDeleteItemWithETag(itemId,eTag){const headers={};if(eTag)headers['If-Match']=eTag;return graphRequest(`/me/drive/items/${encodeURIComponent(itemId)}`,{method:'DELETE',headers});}
async function graphWriteExistingItemWithETag(item,payload){const parentId=item?.parentReference?.id,filename=item?.name;if(!parentId||!filename)throw new Error('Impossible de déterminer le dossier parent du fichier distant.');return graphWriteJsonWithETag(parentId,filename,payload,item.eTag||null);}
function cloudSafeIdentity(){const identity=DataStore.getIdentity();return{ownerId:identity.ownerId,displayName:msAccount?.name||msAccount?.username||identity.displayName||'Utilisateur Journalier',microsoftAccount:msAccount?.username||null,provider:'microsoft365',architectureVersion:JOURNALIER_ARCHITECTURE_VERSION,updatedAt:new Date().toISOString()};}
async function prepareMicrosoft365Space(){const b=document.getElementById('ms-prepare-cloud-action');if(b)b.disabled=true;setCloudStatus('Préparation de l’espace Journalier…','');try{const s=await graphEnsureJournalierStructure();await graphWriteJson(s.system.id,'sync.json',{schemaVersion:'JOURNALIER-SYNC-1',architectureVersion:JOURNALIER_ARCHITECTURE_VERSION,ownerId:JournalierSecurity.accountKey,provider:'microsoft365',preparedAt:new Date().toISOString(),status:'prepared'});setCloudStatus('✓ Espace Journalier prêt dans OneDrive. Aucune donnée métier n’a été envoyée.','success');}catch(e){setCloudStatus('⚠️ '+(e.message||e),'error');}finally{if(b)b.disabled=!msAccount;}}
async function graphListChildren(id){
  const items=[];
  let nextUrl=`${GRAPH_BASE}/me/drive/items/${encodeURIComponent(id)}/children?$select=id,name,folder,file,size,lastModifiedDateTime,eTag`;
  let page=0;
  const maxPages=100;
  while(nextUrl){
    if(++page>maxPages)throw new Error(`Graph : pagination interrompue après ${maxPages} pages pour éviter une boucle inattendue.`);
    const data=await graphRequest(nextUrl);
    if(!data||!Array.isArray(data.value))throw new Error('Graph : réponse de pagination des enfants invalide.');
    items.push(...data.value);
    const candidate=data['@odata.nextLink'];
    if(candidate){
      if(!String(candidate).startsWith(GRAPH_BASE+'/'))throw new Error('Graph : nextLink inattendu ou hors de Microsoft Graph.');
      nextUrl=String(candidate);
    }else{
      nextUrl=null;
    }
  }
  return{value:items};
}

const JOURNALIER_JSON_LIMITS={maxBytes:1048576,maxDepth:8,maxKeys:120,maxArray:500,maxString:20000};
function validateJsonValue(value,label='JSON',depth=0,seen=new WeakSet()){
  if(depth>JOURNALIER_JSON_LIMITS.maxDepth)throw new Error(`${label} trop profond : import/refusé.`);
  if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean') {
    if(typeof value==='string'&&value.length>JOURNALIER_JSON_LIMITS.maxString)throw new Error(`${label} contient une chaîne trop longue.`);
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error(`${label} contient un nombre invalide.`);
    return true;
  }
  if(typeof value!=='object')throw new Error(`${label} contient un type JSON interdit.`);
  if(seen.has(value))throw new Error(`${label} contient une référence circulaire.`);
  seen.add(value);
  if(Array.isArray(value)){
    if(value.length>JOURNALIER_JSON_LIMITS.maxArray)throw new Error(`${label} contient trop d’éléments.`);
    value.forEach((v,i)=>validateJsonValue(v,`${label}[${i}]`,depth+1,seen));
  }else{
    const keys=Object.keys(value);
    if(keys.length>JOURNALIER_JSON_LIMITS.maxKeys)throw new Error(`${label} contient trop de propriétés.`);
    for(const key of keys){
      if(key.length>120)throw new Error(`${label} contient une clé trop longue.`);
      validateJsonValue(value[key],`${label}.${key}`,depth+1,seen);
    }
  }
  seen.delete(value);
  return true;
}
function validateStrictJsonPayload(value,label='JSON',maxBytes=JOURNALIER_JSON_LIMITS.maxBytes){
  validateJsonValue(value,label);
  let serialized;
  try{serialized=JSON.stringify(value);}catch(_){throw new Error(`${label} non sérialisable.`);}
  if(serialized.length>maxBytes)throw new Error(`${label} trop volumineux : import/écriture refusé.`);
  return true;
}
function assertAllowedKeys(obj,allowed,label){
  const unknown=Object.keys(obj||{}).filter(k=>!allowed.has(k));
  if(unknown.length)throw new Error(`${label} contient des propriétés inattendues : ${unknown.slice(0,8).join(', ')}${unknown.length>8?'…':''}.`);
}
function validateStrictStudent(student,label='Profil élève'){
  validateStrictJsonPayload(student,label);
  if(!student||typeof student!=='object'||Array.isArray(student))throw new Error(`${label} invalide.`);
  assertAllowedKeys(student,new Set(['id','studentId','nom','classe','ecole','pia','matieres','piaFileName','ownerId','dataVersion']),label);
  if(typeof student.studentId!=='string'||student.studentId.length<1||student.studentId.length>120)throw new Error(`${label} : studentId invalide.`);
  if(typeof student.nom!=='string'||student.nom.length<1||student.nom.length>200)throw new Error(`${label} : nom invalide.`);
  for(const k of ['classe','ecole','pia','piaFileName'])if(student[k]!=null&&typeof student[k]!=='string')throw new Error(`${label} : ${k} invalide.`);
  if(student.matieres!=null&&(!Array.isArray(student.matieres)||student.matieres.some(x=>typeof x!=='string'||x.length>200)))throw new Error(`${label} : matières invalides.`);
  if(student.id!=null&&!['number','string'].includes(typeof student.id))throw new Error(`${label} : id invalide.`);
  return true;
}
function validateStrictSession(session,label='Séance'){
  validateStrictJsonPayload(session,label);
  if(!session||typeof session!=='object'||Array.isArray(session))throw new Error(`${label} invalide.`);
  assertAllowedKeys(session,new Set(['id','schemaVersion','dataVersion','ownerId','type','identification','contexte','objectif','q2','q3','q4','q5','q6','metadata']),label);
  if(session.type!=='SEANCE')throw new Error(`${label} : type invalide.`);
  if(typeof session.id!=='string'&&typeof session.id!=='number')throw new Error(`${label} : id invalide.`);
  if(!session.identification||typeof session.identification!=='object'||Array.isArray(session.identification))throw new Error(`${label} : identification invalide.`);
  assertAllowedKeys(session.identification,new Set(['eleve','eleveId','date','periode']),`${label}.identification`);
  if(typeof session.identification.eleve!=='string'||session.identification.eleve.length>200)throw new Error(`${label} : élève invalide.`);
  if(session.identification.eleveId!=null&&typeof session.identification.eleveId!=='string')throw new Error(`${label} : eleveId invalide.`);
  if(typeof session.identification.date!=='string'||session.identification.date.length>40)throw new Error(`${label} : date invalide.`);
  if(session.identification.periode!=null){
    if(typeof session.identification.periode!=='object'||Array.isArray(session.identification.periode))throw new Error(`${label} : période invalide.`);
    assertAllowedKeys(session.identification.periode,new Set(['start','end']),`${label}.identification.periode`);
  }
  const nested={
    contexte:new Set(['matiere','niveau','forme','typeIntervention']),
    objectif:new Set(['objectifLecon','objectifProfessionnel']),
    q2:new Set(['observations','precision']),
    q3:new Set(['repereWBE','indicateurs','precision']),
    q4:new Set(['situation','types','effets','precision']),
    q5:new Set(['statut','precision']),
    q6:new Set(['actions','modalite','objectif','collaborations','precision']),
    metadata:new Set(['createdAt','updatedAt','source'])
  };
  for(const [key,allowed] of Object.entries(nested)){
    if(session[key]!=null){
      if(typeof session[key]!=='object'||Array.isArray(session[key]))throw new Error(`${label}.${key} invalide.`);
      assertAllowedKeys(session[key],allowed,`${label}.${key}`);
    }
  }
  if(session.contexte?.typeIntervention!=null&&!Array.isArray(session.contexte.typeIntervention))throw new Error(`${label}.contexte.typeIntervention invalide.`);
  if(session.q2?.observations!=null){
    if(!Array.isArray(session.q2.observations))throw new Error(`${label}.q2.observations invalide.`);
    session.q2.observations.forEach((x,i)=>{
      if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(`${label}.q2.observations[${i}] invalide.`);
      assertAllowedKeys(x,new Set(['categorie','observation','niveau']),`${label}.q2.observations[${i}]`);
      if(typeof x.observation!=='string'||x.observation.length>5000)throw new Error(`${label}.q2.observations[${i}].observation invalide.`);
      if(x.categorie!=null&&typeof x.categorie!=='string')throw new Error(`${label}.q2.observations[${i}].categorie invalide.`);
      if(x.niveau!=null&&(!Number.isFinite(Number(x.niveau))||Number(x.niveau)<0||Number(x.niveau)>10))throw new Error(`${label}.q2.observations[${i}].niveau invalide.`);
    });
  }
  if(session.q3?.repereWBE!=null){
    const r=session.q3.repereWBE;
    if(typeof r!=='object'||Array.isArray(r))throw new Error(`${label}.q3.repereWBE invalide.`);
    assertAllowedKeys(r,new Set(['signature','hit','kind','bridgeId','indicatorIds','source']),`${label}.q3.repereWBE`);
    if(r.indicatorIds!=null&&(!Array.isArray(r.indicatorIds)||r.indicatorIds.some(x=>typeof x!=='string')))throw new Error(`${label}.q3.repereWBE.indicatorIds invalide.`);
  }
  if(session.q3?.indicateurs!=null){
    if(!Array.isArray(session.q3.indicateurs))throw new Error(`${label}.q3.indicateurs invalide.`);
    session.q3.indicateurs.forEach((x,i)=>{
      if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(`${label}.q3.indicateurs[${i}] invalide.`);
      assertAllowedKeys(x,new Set(['id','texte','source','appreciation']),`${label}.q3.indicateurs[${i}]`);
      if(typeof x.id!=='string'||typeof x.texte!=='string')throw new Error(`${label}.q3.indicateurs[${i}] invalide.`);
      if(x.appreciation!=null&&(!Number.isFinite(Number(x.appreciation))||Number(x.appreciation)<0||Number(x.appreciation)>2))throw new Error(`${label}.q3.indicateurs[${i}].appreciation invalide.`);
    });
  }
  if(session.q4?.types!=null&&!Array.isArray(session.q4.types))throw new Error(`${label}.q4.types invalide.`);
  if(session.q4?.effets!=null){
    if(typeof session.q4.effets!=='object'||Array.isArray(session.q4.effets))throw new Error(`${label}.q4.effets invalide.`);
    for(const [k,v] of Object.entries(session.q4.effets)){
      if(k.length>200||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>2)throw new Error(`${label}.q4.effets contient une valeur invalide.`);
    }
  }
  for(const key of ['actions','collaborations']){
    if(session.q6?.[key]!=null&&(!Array.isArray(session.q6[key])||session.q6[key].some(x=>typeof x!=='string')))throw new Error(`${label}.q6.${key} invalide.`);
  }
  return true;
}
function validateStrictAgenda(agenda,label='Agenda'){
  validateStrictJsonPayload(agenda,label);
  if(!agenda||typeof agenda!=='object'||Array.isArray(agenda))throw new Error(`${label} invalide.`);
  const agendaUnknown=Object.keys(agenda).filter(k=>!new Set(['__events','__exceptions','__config','__uniqueEvents']).has(k)&&!/^\d+_.+$/.test(k));
  if(agendaUnknown.length)throw new Error(`${label} contient des propriétés inattendues : ${agendaUnknown.slice(0,8).join(', ')}${agendaUnknown.length>8?'…':''}.`);
  if(agenda.__config!=null){
    if(typeof agenda.__config!=='object'||Array.isArray(agenda.__config))throw new Error(`${label}.__config invalide.`);
    assertAllowedKeys(agenda.__config,new Set(['version','periods']),`${label}.__config`);
    if(agenda.__config.version!=null&&!Number.isFinite(Number(agenda.__config.version)))throw new Error(`${label}.__config.version invalide.`);
    if(agenda.__config.periods!=null){
      if(!Array.isArray(agenda.__config.periods)||agenda.__config.periods.length!==8)throw new Error(`${label}.__config.periods doit contenir exactement 8 périodes.`);
      let previousEnd=-1;
      agenda.__config.periods.forEach((p,i)=>{
        if(!p||typeof p!=='object'||Array.isArray(p))throw new Error(`${label}.__config.periods[${i}] invalide.`);
        assertAllowedKeys(p,new Set(['id','label','start','end']),`${label}.__config.periods[${i}]`);
        if(typeof p.id!=='string'||typeof p.label!=='string'||!/^\d{2}:\d{2}$/.test(String(p.start||''))||!/^\d{2}:\d{2}$/.test(String(p.end||'')))throw new Error(`${label}.__config.periods[${i}] invalide.`);
        const start=Number(String(p.start).slice(0,2))*60+Number(String(p.start).slice(3));
        const end=Number(String(p.end).slice(0,2))*60+Number(String(p.end).slice(3));
        if(start>=end||start<previousEnd)throw new Error(`${label}.__config.periods[${i}] : horaires incohérents ou chevauchants.`);
        previousEnd=end;
      });
    }
  }
  if(agenda.__exceptions!=null&&(!agenda.__exceptions||typeof agenda.__exceptions!=='object'||Array.isArray(agenda.__exceptions)))throw new Error(`${label}.__exceptions invalide.`);
  if(agenda.__events!=null){
    if(!Array.isArray(agenda.__events)||agenda.__events.length>JOURNALIER_JSON_LIMITS.maxArray)throw new Error(`${label}.__events invalide.`);
    agenda.__events.forEach((ev,i)=>{
      if(!ev||typeof ev!=='object'||Array.isArray(ev))throw new Error(`${label}.__events[${i}] invalide.`);
      assertAllowedKeys(ev,new Set(['eventId','seriesId','recurrence','type','eleve','eleveId','matiere','title','detail','local','dayIndex','date','startPeriod','endPeriod','startDateTime','endDateTime','eventStatus','realized','realizedAt','ownerId','dataVersion','createdAt','updatedAt','timezone','recurrencePattern','recurrenceRange','pattern','range','interval','daysOfWeek','outlook']),`${label}.__events[${i}]`);
      if(typeof ev.eventId!=='string'||!ev.eventId||ev.eventId.length>160)throw new Error(`${label}.__events[${i}].eventId invalide.`);
      if(ev.seriesId!=null&&typeof ev.seriesId!=='string')throw new Error(`${label}.__events[${i}].seriesId invalide.`);
      if(!['weekly','unique','daily','monthly','yearly'].includes(ev.recurrence))throw new Error(`${label}.__events[${i}].recurrence invalide.`);
      if(!['ELEVE','COLLAB','FORMATION','ADMIN','LIBRE'].includes(ev.type))throw new Error(`${label}.__events[${i}].type invalide.`);
      if(!['proposed','realized','cancelled'].includes(ev.eventStatus))throw new Error(`${label}.__events[${i}].eventStatus invalide.`);
      if(typeof ev.realized!=='boolean')throw new Error(`${label}.__events[${i}].realized invalide.`);
      if(ev.dayIndex!=null&&(!Number.isInteger(Number(ev.dayIndex))||Number(ev.dayIndex)<0||Number(ev.dayIndex)>6))throw new Error(`${label}.__events[${i}].dayIndex invalide.`);
      for(const k of ['eleve','eleveId','matiere','title','detail','local','date','startPeriod','endPeriod','startDateTime','endDateTime','ownerId','dataVersion','createdAt','updatedAt','timezone'])if(ev[k]!=null&&typeof ev[k]!=='string')throw new Error(`${label}.__events[${i}].${k} invalide.`);
      if(ev.recurrencePattern!=null&&typeof ev.recurrencePattern!=='object')throw new Error(`${label}.__events[${i}].recurrencePattern invalide.`);
      if(ev.recurrenceRange!=null&&typeof ev.recurrenceRange!=='object')throw new Error(`${label}.__events[${i}].recurrenceRange invalide.`);
      if(ev.outlook!=null){
        if(typeof ev.outlook!=='object'||Array.isArray(ev.outlook))throw new Error(`${label}.__events[${i}].outlook invalide.`);
        assertAllowedKeys(ev.outlook,new Set(['calendarId','eventId','iCalUId','changeKey','webLink']),`${label}.__events[${i}].outlook`);
        for(const k of ['calendarId','eventId','iCalUId','changeKey','webLink'])if(ev.outlook[k]!=null&&typeof ev.outlook[k]!=='string')throw new Error(`${label}.__events[${i}].outlook.${k} invalide.`);
      }
    });
  }
  if(agenda.__uniqueEvents!=null&&!Array.isArray(agenda.__uniqueEvents))throw new Error(`${label}.__uniqueEvents invalide.`);
  return true;
}
function validateStrictSyncRecord(record,label='Synchronisation'){
  validateStrictJsonPayload(record,label);
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`${label} invalide.`);
  assertAllowedKeys(record,new Set(['schemaVersion','architectureVersion','ownerId','status','students','sessions','agendaEntries','syncedAt','provider','preparedAt']),label);
  if(record.schemaVersion!==undefined&&typeof record.schemaVersion!=='string')throw new Error(`${label} : schemaVersion invalide.`);
  if(record.ownerId!==undefined&&typeof record.ownerId!=='string')throw new Error(`${label} : ownerId invalide.`);
  return true;
}
function validateStrictDeletionRecord(record,label='Registre des suppressions'){
  validateStrictJsonPayload(record,label);
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`${label} invalide.`);
  assertAllowedKeys(record,new Set(['schemaVersion','students']),label);
  if(record.schemaVersion!=='JOURNALIER-DELETIONS-1')throw new Error(`${label} : schemaVersion invalide.`);
  if(!record.students||typeof record.students!=='object'||Array.isArray(record.students))throw new Error(`${label} : students invalide.`);
  for(const [studentId,entry] of Object.entries(record.students)){
    if(!studentId||studentId.length>120)throw new Error(`${label} : identifiant élève invalide.`);
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error(`${label} : entrée de suppression invalide.`);
    assertAllowedKeys(entry,new Set(['status','deletedAt','updatedAt']),`${label}.${studentId}`);
    if(!['pending','deleted'].includes(entry.status))throw new Error(`${label}.${studentId} : statut invalide.`);
    if(typeof entry.deletedAt!=='string'||entry.deletedAt.length>40)throw new Error(`${label}.${studentId} : deletedAt invalide.`);
    if(entry.updatedAt!==undefined&&(typeof entry.updatedAt!=='string'||entry.updatedAt.length>40))throw new Error(`${label}.${studentId} : updatedAt invalide.`);
  }
  return true;
}
async function v72ReadDeletionRegistry(){
  try{
    const remote=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/system/deletions.json`);
    validateStrictDeletionRecord(remote.json,'Registre distant des suppressions');
    return remote;
  }catch(e){
    if(String(e.message||e).includes('Graph 404'))return{item:null,json:{schemaVersion:'JOURNALIER-DELETIONS-1',students:{}}};
    throw e;
  }
}
async function v72WriteDeletionRegistry(registry,eTag=null){
  validateStrictDeletionRecord(registry,'Registre des suppressions');
  const structure=await graphEnsureJournalierStructure();
  return graphWriteJsonWithETag(structure.system.id,'deletions.json',registry,eTag);
}

function validateRemoteJsonObject(value,label,maxBytes=1048576){return validateStrictJsonPayload(value,label,maxBytes);}
function validateStrictPIA(pia,label='PIA'){
  validateStrictJsonPayload(pia,label,10*1024*1024);
  if(!pia||typeof pia!=='object'||Array.isArray(pia))throw new Error(`${label} invalide.`);
  const sid=String(pia.studentId||'').trim();
  if(!sid)throw new Error(`${label} : identifiant élève (studentId) manquant.`);
  if(pia.type==='PIA_IMPORT_CONTINUITE'){
    assertAllowedKeys(pia,new Set(['schemaVersion','type','studentId','role','sourceContinuity','metadata']),label);
    if(!pia.sourceContinuity||typeof pia.sourceContinuity!=='object'){
      throw new Error(`${label} : sourceContinuity manquante.`);
    }
  }else if(pia.type==='PIA_ANNUEL'){
    if(typeof pia.id!=='string'&&typeof pia.id!=='number')throw new Error(`${label} : id invalide.`);
  }else if(!pia.sourceContinuity&&!pia.extracted&&!pia.sections&&!pia.amenagements&&!pia.propositions){
    throw new Error(`${label} : format de PIA non reconnu.`);
  }
  return true;
}
function validateRemotePIA(pia){return validateStrictPIA(pia,'PIA');}
function validateRemoteStudent(student){return validateStrictStudent(student,'Profil élève');}
function validateRemoteSession(session){return validateStrictSession(session,'Séance');}
function validateRemoteAgenda(agenda){return validateStrictAgenda(agenda,'Agenda');}
function countUncommittedSyncChanges(state){
  const reg=state?.syncRegistry||{};
  return Object.values(reg.students||{}).filter(x=>x?.status&&x.status!=='synced').length
    +Object.values(reg.sessions||{}).filter(x=>x?.status&&x.status!=='synced').length
    +Object.values(reg.pia||{}).filter(x=>x?.status&&x.status!=='synced').length
    +(reg.agenda?.status&&reg.agenda.status!=='synced'?1:0);
}
function applyRemotePiaPayload(piaData,studentId,piaRecordsTarget,piaImportsTarget){
  if(!piaData||!studentId)return;
  if(piaData.type==='PIA_ANNUEL'){
    if(piaRecordsTarget)piaRecordsTarget[studentId]=piaData;
    if(piaData.sourceContinuity&&piaImportsTarget)piaImportsTarget[studentId]=piaData.sourceContinuity;
  }else if(piaData.sourceContinuity&&piaImportsTarget){
    piaImportsTarget[studentId]=piaData.sourceContinuity;
  }
}
async function readRemoteStudentFolderInto(folderName,ownerId,importedStudents,importedSessions,registry){
  try{
    const profile=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/eleves/${encodeURIComponent(folderName)}/profil.json`);
    validateRemoteStudent(profile.json);
    const student=secureNormalizeStudent(profile.json);
    student.ownerId=ownerId;
    if(!student.studentId)student.studentId=folderName;
    importedStudents.push(student);
    const fp=syncFingerprint(syncWithoutVolatileMeta(student));
    registry.students[student.studentId]={remoteId:profile.item.id,eTag:profile.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
  }catch(e){
    if(!String(e.message||e).includes('Graph 404'))throw e;
  }
  try{
    const sessionsFolder=await graphGetByPath(`${GRAPH_ROOT_FOLDER}/eleves/${encodeURIComponent(folderName)}/seances`);
    const sessionItems=await graphListChildren(sessionsFolder.id);
    for(const item of (sessionItems?.value||[])){
      if(!item?.file||!String(item.name||'').toLowerCase().endsWith('.json'))continue;
      try{
        const raw=await graphReadItemByIdWithJson(item.id);
        validateRemoteSession(raw.json);
        const session=secureNormalizeSession(raw.json,importedStudents);
        session.ownerId=ownerId;
        importedSessions.push(session);
        const fp=syncFingerprint(syncWithoutVolatileMeta(session));
        registry.sessions[session.id]={remoteId:item.id,eTag:item.item?.eTag||item.eTag||null,fingerprint:fp,remoteFingerprint:fp,studentId:session.identification?.eleveId||null,lastCheckedAt:new Date().toISOString(),status:'synced'};
      }catch(e){
        console.warn('Journalier — séance distante ignorée',item.name,e);
      }
    }
  }catch(e){
    if(!String(e.message||e).includes('Graph 404'))throw e;
  }
}
async function hydrateMicrosoftDataIfLocalEmpty(){
  const state=DataStore.state;
  const localStudents=DataStore.getStudents();
  const localSessions=DataStore.getSessions();
  const localAgenda=DataStore.getAgenda();
  const agendaHasData=(Array.isArray(localAgenda?.__events)&&localAgenda.__events.length>0) || (Array.isArray(localAgenda?.__uniqueEvents)&&localAgenda.__uniqueEvents.length>0) || Object.keys(localAgenda?.__exceptions||{}).length>0;
  if(localStudents.length||localSessions.length||agendaHasData) return {imported:false,reason:'local-data-present'};

  const structure=await graphEnsureJournalierStructure();
  const importedStudents=[];
  const importedSessions=[];
  const registry={version:'1',students:{},sessions:{},agenda:null,pia:{}};

  // sync.json n'est jamais une source d'identité. L'identité active provient exclusivement d'Entra.
  try{
    const remoteSync=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/system/sync.json`); validateStrictSyncRecord(remoteSync?.json,'Synchronisation distante');
    if(remoteSync?.json?.ownerId && String(remoteSync.json.ownerId)!==String(state.ownerId)) throw new Error('L’espace OneDrive Journalier est associé à une autre identité locale. Import refusé.');
  }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}

  let children=await graphListChildren(structure.eleves.id);
  for(const folder of (children?.value||[])){
    if(!folder?.folder) continue;
    await readRemoteStudentFolderInto(folder.name,state.ownerId,importedStudents,importedSessions,registry);
  }

  let importedAgenda={};
  try{
    const remoteAgenda=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`);
    validateRemoteAgenda(remoteAgenda.json||{}); importedAgenda=secureNormalizeAgenda(remoteAgenda.json||{});
    const fp=syncFingerprint(syncWithoutVolatileMeta(importedAgenda));
    registry.agenda={remoteId:remoteAgenda.item.id,eTag:remoteAgenda.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
  }catch(e){
    if(!String(e.message||e).includes('Graph 404')) throw e;
  }

  state.students=importedStudents;
  state.sessions=importedSessions;
  state.agenda=importedAgenda;window.JournalierAgendaConfig?.refreshSessionPeriodSelectors?.();
  state.syncRegistry=registry;
  state.sync={status:'synced',lastSyncAt:new Date().toISOString(),pendingChanges:0};
  state.meta={...(state.meta||{}),cloudHydratedAt:new Date().toISOString(),cloudHydratedAccount:msAccount?.username||null};
  await securePersistState();
  renderStudentsView();
  renderAgenda();
  updateMicrosoftUI();
  return {imported:true,students:importedStudents.length,sessions:importedSessions.length,agenda:Boolean(Array.isArray(importedAgenda?.__events)&&importedAgenda.__events.length)};
}

async function v74RepartirDeOneDrive(options={}){
  if(!msAccount)throw new Error('Connectez-vous à votre compte Microsoft avant de repartir de OneDrive.');
  const state=DataStore.state;
  const pendingChanges=countUncommittedSyncChanges(state);
  if(!options.confirmed){
    return {status:'confirmation_required',uncommittedChanges:pendingChanges,message:pendingChanges>0?'Des modifications locales non synchronisées ont été détectées.':'Cette opération va remplacer les données actuellement enregistrées sur cet appareil par les données présentes dans OneDrive.'};
  }
  setCloudStatus('Lecture et validation des données OneDrive…','loading');
  const structure=await graphEnsureJournalierStructure();
  const importedStudents=[];
  const importedSessions=[];
  const importedPiaRecords={};
  const importedPiaImports={};
  const registry={version:'1',students:{},sessions:{},agenda:null,pia:{}};

  // 1. Lire et valider les élèves
  const children=await graphListChildren(structure.eleves.id);
  for(const folder of (children?.value||[])){
    if(!folder?.folder)continue;
    await readRemoteStudentFolderInto(folder.name,state.ownerId,importedStudents,importedSessions,registry);
  }

  // 2. Lire et valider l'Agenda
  let importedAgenda={__events:[],__exceptions:{},__config:{}};
  try{
    const remoteAgenda=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`);
    validateRemoteAgenda(remoteAgenda.json||{});
    importedAgenda=secureNormalizeAgenda(remoteAgenda.json||{});
    const fp=syncFingerprint(syncWithoutVolatileMeta(importedAgenda));
    registry.agenda={remoteId:remoteAgenda.item.id,eTag:remoteAgenda.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
  }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}

  // 3. Lire et valider les PIA
  try{
    const piaChildren=await graphListChildren(structure.pia.id);
    for(const folder of (piaChildren?.value||[])){
      if(!folder?.folder)continue;
      const sid=folder.name;
      try{
        const remotePia=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(sid)}/pia.json`);
        validateRemotePIA(remotePia.json);
        const piaData=remotePia.json;
        applyRemotePiaPayload(piaData,sid,importedPiaRecords,importedPiaImports);
        const fp=syncFingerprint(syncWithoutVolatileMeta(piaData));
        registry.pia[sid]={remoteId:remotePia.item.id,eTag:remotePia.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
      }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}
    }
  }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}

  // 4. Remplacement atomique de l'espace local
  state.students=importedStudents;
  state.sessions=importedSessions;
  state.agenda=importedAgenda;
  state.meta={...(state.meta||{}),piaRecords:importedPiaRecords,piaImports:importedPiaImports,cloudHydratedAt:new Date().toISOString(),cloudHydratedAccount:msAccount?.username||null};
  state.syncRegistry=registry;
  state.sync={status:'synced',lastSyncAt:new Date().toISOString(),pendingChanges:0};

  if(importedAgenda?.__config&&window.JournalierAgendaConfig?.applyConfig){
    window.JournalierAgendaConfig.applyConfig(importedAgenda.__config);
  }

  await JournalierSecurity.persist(state,{force:true,purgeBefore:true});

  window.JournalierAgendaConfig?.refreshSessionPeriodSelectors?.();
  window.JournalierV74?.refreshStudents?.();
  if(typeof renderStudentsView==='function')renderStudentsView();
  if(typeof renderAgenda==='function')renderAgenda();
  if(typeof updateStudentDropdowns==='function')updateStudentDropdowns();
  if(typeof updateStats==='function')updateStats();
  updateMicrosoftUI();

  setCloudStatus(`✓ Reparti de OneDrive avec succès.\n✓ ${importedStudents.length} élève(s) restauré(s)\n✓ ${importedSessions.length} séance(s) restaurée(s)\n✓ Agenda et ${Object.keys(importedPiaImports).length+Object.keys(importedPiaRecords).length} PIA synchronisés.`,'success');
  showAppToast('Espace local reconstruit avec succès depuis OneDrive.','success');
  return {ok:true,students:importedStudents.length,sessions:importedSessions.length,agenda:true};
}
async function verifyMicrosoft365Space(){const b=document.getElementById('ms-verify-cloud-action');if(b)b.disabled=true;try{const root=await graphGetByPath(GRAPH_ROOT_FOLDER),children=await graphListChildren(root.id),names=new Set((children.value||[]).map(x=>x.name)),expected=['profil','eleves','agenda','system'],missing=expected.filter(x=>!names.has(x));if(missing.length)throw new Error('Structure incomplète : '+missing.join(', '));const sync=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/system/sync.json`).catch(()=>null);setCloudStatus('✓ Structure OneDrive vérifiée.\n✓ Journalier/\n✓ profil/\n✓ eleves/\n✓ agenda/\n✓ system/'+(sync?`\n✓ sync.json : ${sync.json.status||'—'}`:''),'success');}catch(e){setCloudStatus('⚠️ '+(e.message||e),'error');}finally{if(b)b.disabled=!msAccount;}}
function syncStableValue(value){if(Array.isArray(value))return value.map(syncStableValue);if(value&&typeof value==='object')return Object.keys(value).sort().reduce((o,k)=>(o[k]=syncStableValue(value[k]),o),{});return value;}
function syncFingerprint(value){return JSON.stringify(syncStableValue(value));}
function syncWithoutVolatileMeta(value){const c=JSON.parse(JSON.stringify(value||{}));if(c.metadata&&typeof c.metadata==='object'){delete c.metadata.updatedAt;delete c.metadata.createdAt;}return c;}
function v72PathForStudent(student){return `${GRAPH_ROOT_FOLDER}/eleves/${student.studentId}/profil.json`;}
function syncNormalizeName(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function syncFindStudentByName(students,name){const target=syncNormalizeName(name);if(!target)return null;return (students||[]).find(s=>syncNormalizeName(s.nom)===target)||null;}
function v72PathForSession(session,students){const studentId=session.identification?.eleveId||syncFindStudentByName(students,session.identification?.eleve)?.studentId;return studentId?`${GRAPH_ROOT_FOLDER}/eleves/${studentId}/seances/${session.id}.json`:null;}
function v72StatusCount(registry){
  let c={synced:0,local:0,remote:0,conflict:0,missing:0};
  for(const x of Object.values(registry.students||{})){
    if(x.status==='synced')c.synced++;
    else if(x.status==='local-changed'||x.status==='local-pending')c.local++;
    else if(x.status==='remote-changed')c.remote++;
    else if(x.status==='conflict')c.conflict++;
  }
  for(const x of Object.values(registry.sessions||{})){
    if(x.status==='synced')c.synced++;
    else if(x.status==='local-changed'||x.status==='local-pending')c.local++;
    else if(x.status==='remote-changed')c.remote++;
    else if(x.status==='conflict')c.conflict++;
  }
  if(registry.agenda){
    if(registry.agenda.status==='synced')c.synced++;
    else if(registry.agenda.status==='local-changed'||registry.agenda.status==='local-pending')c.local++;
    else if(registry.agenda.status==='remote-changed')c.remote++;
    else if(registry.agenda.status==='conflict')c.conflict++;
  }
  return c;
}
function v72Classify(previous,localFp,remoteFp,remoteMissing=false){
  if(remoteMissing)return 'local-changed';
  if(localFp===remoteFp)return 'synced';
  // Un conflit doit rester explicitement bloqué jusqu'à une résolution utilisateur.
  if(previous?.status==='conflict')return 'conflict';
  if(!previous)return localFp===remoteFp?'synced':'conflict';
  const lc=previous.fingerprint!==localFp,rc=previous.remoteFingerprint!==remoteFp;
  if(lc&&rc)return'conflict';
  if(lc)return'local-changed';
  if(rc)return'remote-changed';
  return'synced';
}
async function v72ProcessPendingDeletions(state,r,details=[]){
  let sent=0;
  for(const [sessionId,reg] of Object.entries(r.sessions||{})){
    if(reg?.status!=='deleted-pending')continue;
    if(!reg.remoteId){delete r.sessions[sessionId];continue;}
    try{
      await graphDeleteItemWithETag(reg.remoteId,reg.eTag||null);
      delete r.sessions[sessionId];
      sent++;
      details.push(`• séance ${sessionId} : supprimée de OneDrive`);
    }catch(e){
      if(String(e.message||e).includes('Graph 404')){delete r.sessions[sessionId];continue;}
      if(String(e.message||e).includes('Graph 412')){r.sessions[sessionId]={...reg,status:'conflict',lastCheckedAt:new Date().toISOString()};throw new Error(`Conflit détecté lors de la suppression de la séance ${sessionId}.`);}
      throw e;
    }
  }
  const deletionRemote=await v72ReadDeletionRegistry();
  const deletions=deletionRemote.json;
  let deletionETag=deletionRemote.item?.eTag||null;
  for(const [studentId,reg] of Object.entries(r.students||{})){
    if(reg?.status!=='deleted-pending')continue;
    const now=new Date().toISOString();
    const existingTombstone=deletions.students[String(studentId)];
    deletions.students[String(studentId)]={status:'pending',deletedAt:existingTombstone?.deletedAt||reg.localDeletedAt||now,updatedAt:now};
    const pendingItem=await v72WriteDeletionRegistry(deletions,deletionETag);
    deletionETag=pendingItem?.eTag||null;
    if(!reg.remoteId){
      deletions.students[String(studentId)]={...deletions.students[String(studentId)],status:'deleted',updatedAt:new Date().toISOString()};
      const deletedItem=await v72WriteDeletionRegistry(deletions,deletionETag);
      deletionETag=deletedItem?.eTag||null;
      r.students[studentId]={...reg,status:'deleted',deletedAt:deletions.students[String(studentId)].deletedAt,updatedAt:deletions.students[String(studentId)].updatedAt};
      continue;
    }
    try{
      await graphDeleteItemWithETag(reg.remoteId,reg.eTag||null);
      deletions.students[String(studentId)]={...deletions.students[String(studentId)],status:'deleted',updatedAt:new Date().toISOString()};
      const deletedItem=await v72WriteDeletionRegistry(deletions,deletionETag);
      deletionETag=deletedItem?.eTag||null;
      r.students[studentId]={...reg,status:'deleted',deletedAt:deletions.students[String(studentId)].deletedAt,lastCheckedAt:new Date().toISOString()};
      sent++;
      details.push(`• élève ${studentId} : supprimé de OneDrive`);
    }catch(e){
      if(String(e.message||e).includes('Graph 404')){
        deletions.students[String(studentId)]={...deletions.students[String(studentId)],status:'deleted',updatedAt:new Date().toISOString()};
        const deletedItem=await v72WriteDeletionRegistry(deletions,deletionETag);
        deletionETag=deletedItem?.eTag||null;
        r.students[studentId]={...reg,status:'deleted',deletedAt:deletions.students[String(studentId)].deletedAt,lastCheckedAt:new Date().toISOString()};
        continue;
      }
      if(String(e.message||e).includes('Graph 412')){
        r.students[studentId]={...reg,status:'conflict',lastCheckedAt:new Date().toISOString()};
        throw new Error(`Conflit détecté lors de la suppression de l’élève ${studentId}.`);
      }
      throw e;
    }
  }
  return sent;
}

async function v72DiscoverRemoteEntities(){
  // Un appareil ayant déjà des données locales ne relance jamais l'hydratation complète :
  // sans ce balayage des dossiers distants, les élèves/séances ajoutés ailleurs restent invisibles ici.
  const state=DataStore.state,r=v72EnsureSyncRegistry(state);
  let discoveredStudents=0,discoveredSessions=0;
  const structure=await graphEnsureJournalierStructure();
  const children=await graphListChildren(structure.eleves.id);
  for(const folder of (children?.value||[])){
    if(!folder?.folder)continue;
    const folderName=folder.name;
    const localStudentIds=new Set(DataStore.getStudents().map(s=>String(s.studentId)));
    const studentRegistryEntry=r.students[folderName];
    const locallyDeleted=studentRegistryEntry?.status==='deleted-pending'
        || studentRegistryEntry?.status==='deleted';

    if(!localStudentIds.has(folderName) && !locallyDeleted){
      try{
        const profile=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/eleves/${encodeURIComponent(folderName)}/profil.json`);
        validateRemoteStudent(profile.json);
        const student=secureNormalizeStudent(profile.json);
        student.ownerId=state.ownerId;
        if(!student.studentId)student.studentId=folderName;
        state.students.push(student);
        const fp=syncFingerprint(syncWithoutVolatileMeta(student));
        r.students[student.studentId]={remoteId:profile.item.id,eTag:profile.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
        discoveredStudents++;
      }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e; continue;}
    }
    try{
      const sessionsFolder=await graphGetByPath(`${GRAPH_ROOT_FOLDER}/eleves/${encodeURIComponent(folderName)}/seances`);
      const sessionItems=await graphListChildren(sessionsFolder.id);
      const localSessionIds=new Set(DataStore.getSessions().map(s=>String(s.id)));
      for(const item of (sessionItems?.value||[])){
        if(!item?.file||!String(item.name||'').toLowerCase().endsWith('.json'))continue;
        const sessionId=item.name.replace(/\.json$/i,'');
        if(localSessionIds.has(sessionId))continue;
        const sessionRegistryEntry=r.sessions[sessionId];
        const locallyDeletedSession=sessionRegistryEntry?.status==='deleted-pending'
            || sessionRegistryEntry?.status==='deleted';
        if(locallyDeletedSession)continue;
        try{
          const raw=await graphReadItemByIdWithJson(item.id);
          validateRemoteSession(raw.json);
          const session=secureNormalizeSession(raw.json,DataStore.getStudents());
          session.ownerId=state.ownerId;
          state.sessions.push(session);
          const fp=syncFingerprint(syncWithoutVolatileMeta(session));
          r.sessions[session.id]={remoteId:item.id,eTag:item.eTag||null,fingerprint:fp,remoteFingerprint:fp,studentId:session.identification?.eleveId||folderName,lastCheckedAt:new Date().toISOString(),status:'synced'};
          discoveredSessions++;
        }catch(e){console.warn('Journalier — séance distante ignorée (découverte)',item.name,e);}
      }
    }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}
  }
  let discoveredPIA=0;
  try{
    const piaFolder=await graphGetByPath(`${GRAPH_ROOT_FOLDER}/pia`);
    const piaChildren=await graphListChildren(piaFolder.id);
    for(const folder of (piaChildren?.value||[])){
      if(!folder?.folder)continue;
      const studentId=folder.name;
      if(state.meta?.piaRecords?.[studentId]||state.meta?.piaImports?.[studentId])continue;
      try{
        const raw=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(studentId)}/pia.json`);
        if(raw?.json){
          state.meta??={};state.meta.piaRecords??={};state.meta.piaImports??={};
          applyRemotePiaPayload(raw.json,studentId,state.meta.piaRecords,state.meta.piaImports);
          const fp=syncFingerprint(syncWithoutVolatileMeta(raw.json));
          r.pia[studentId]={remoteId:raw.item.id,eTag:raw.item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};
          discoveredPIA++;
        }
      }catch(e){if(!String(e.message||e).includes('Graph 404'))console.warn('Journalier — découverte PIA ignorée',studentId,e);}
    }
  }catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;}
  if(discoveredStudents||discoveredSessions||discoveredPIA){state.syncRegistry=r;v72RecountPending(state);securePersistState();}
  return {discoveredStudents,discoveredSessions,discoveredPIA};
}
function refreshUIAfterCloudSync(){
  renderStudentsView?.();
  renderAgenda?.();
  updateStats?.();
  updateStudentDropdowns?.();
  window.JournalierV74?.refreshStudents?.();
  window.JournalierV74?.renderDashboard?.();
}
async function diagnoseSyncManagerV72(opts={}){if(!msAccount)throw new Error('Connectez d’abord votre compte Microsoft.');const b=document.getElementById('ms-sync-diagnose-action');if(b)b.disabled=true;if(!opts.silent)setCloudStatus('Analyse de la synchronisation en cours…','');try{
  const state=DataStore.state,r=v72EnsureSyncRegistry(state);
  const deletionDetails=[];
  const deletedCount=await v72ProcessPendingDeletions(state,r,deletionDetails);
  if(deletedCount>0){state.syncRegistry=r;v72RecountPending(state);securePersistState();}
  const discovery=await v72DiscoverRemoteEntities();
  const deletionRemote=await v72ReadDeletionRegistry();
  const deletions=deletionRemote.json;
  const students=DataStore.getStudents(),sessions=DataStore.getSessions(),agenda=DataStore.getAgenda(),details=[...deletionDetails];let missing=0;
  for(const student of students){const path=v72PathForStudent(student),lf=syncFingerprint(syncWithoutVolatileMeta(student));try{const {item,json}=await graphReadItemWithJson(path),rf=syncFingerprint(syncWithoutVolatileMeta(json)),status=v72Classify(r.students[student.studentId],lf,rf,false);r.students[student.studentId]={...r.students[student.studentId],remoteId:item.id,eTag:item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status};if(status!=='synced')details.push(`• élève ${student.nom||student.studentId} : ${status}`);}catch(e){if(String(e.message||e).includes('Graph 404')){missing++;const tombstone=deletions.students[String(student.studentId)];const deletedRemotely=tombstone?.status==='pending'||tombstone?.status==='deleted';const status=deletedRemotely?'deleted':'local-changed';r.students[student.studentId]={...r.students[student.studentId],remoteId:null,eTag:null,fingerprint:lf,remoteFingerprint:null,lastCheckedAt:new Date().toISOString(),status};details.push(`• élève ${student.nom||student.studentId} : ${deletedRemotely?'deleted (suppression distante publiée)':'local-changed (distant absent)'}`);}else throw e;}}
  for(const session of sessions){const path=v72PathForSession(session,students);if(!path)continue;const lf=syncFingerprint(syncWithoutVolatileMeta(session));try{const {item,json}=await graphReadItemWithJson(path),rf=syncFingerprint(syncWithoutVolatileMeta(json)),previousReg=r.sessions[session.id]||{},studentId=session.identification?.eleveId||syncFindStudentByName(students,session.identification?.eleve)?.studentId;let status=v72Classify(previousReg,lf,rf,false);if(previousReg.remoteMovePending)status=status==='conflict'?'conflict':'local-pending';r.sessions[session.id]={...previousReg,remoteId:item.id,eTag:item.eTag||null,fingerprint:lf,remoteFingerprint:rf,studentId,lastCheckedAt:new Date().toISOString(),status};if(status!=='synced')details.push(`• séance ${session.id} / ${session.identification?.eleve||studentId} : ${status}`);}catch(e){if(String(e.message||e).includes('Graph 404')){missing++;const previousReg=r.sessions[session.id]||{},studentId=session.identification?.eleveId||syncFindStudentByName(students,session.identification?.eleve)?.studentId;if(previousReg.remoteId){const idx=state.sessions.findIndex(s=>String(s.id)===String(session.id)&&s.ownerId===state.ownerId);if(idx>=0)state.sessions.splice(idx,1);delete r.sessions[session.id];details.push(`• séance ${session.id} / ${session.identification?.eleve||studentId} : supprimée de OneDrive`);}else{r.sessions[session.id]={...previousReg,remoteId:null,eTag:null,fingerprint:lf,remoteFingerprint:null,studentId,lastCheckedAt:new Date().toISOString(),status:'local-changed'};details.push(`• séance ${session.id} / ${session.identification?.eleve||studentId} : local-changed (distant absent)`);}}else throw e;}}
  try{const {item,json}=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`),lf=syncFingerprint(syncWithoutVolatileMeta(agenda)),rf=syncFingerprint(syncWithoutVolatileMeta(json)),status=v72Classify(r.agenda,lf,rf,false);r.agenda={...r.agenda,remoteId:item.id,eTag:item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status};if(status!=='synced')details.push(`• agenda : ${status}`);}catch(e){if(String(e.message||e).includes('Graph 404')){missing++;const lf=syncFingerprint(syncWithoutVolatileMeta(agenda));r.agenda={...r.agenda,remoteId:null,eTag:null,fingerprint:lf,remoteFingerprint:null,lastCheckedAt:new Date().toISOString(),status:'local-changed'};details.push('• agenda : local-changed (distant absent)');}else throw e;}
  const piaRecords=state.meta?.piaRecords||{}, piaImports=state.meta?.piaImports||{};
  const piaStudentIds=new Set([...students.map(s=>String(s.studentId)),...Object.keys(piaRecords),...Object.keys(piaImports)]);
  for(const sid of piaStudentIds){
    const student=students.find(s=>String(s.studentId)===sid);
    const piaPayload=piaRecords[sid]||(piaImports[sid]?{schemaVersion:"73.0.0",type:"PIA_IMPORT_CONTINUITE",studentId:sid,role:"SOURCE_DE_CONTINUITE",sourceContinuity:piaImports[sid]}:null);
    if(!piaPayload)continue;
    const path=`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(sid)}/pia.json`;
    const lf=syncFingerprint(syncWithoutVolatileMeta(piaPayload));
    try{
      const {item,json}=await graphReadItemWithJson(path),rf=syncFingerprint(syncWithoutVolatileMeta(json)),previousReg=r.pia[sid]||{};
      const status=v72Classify(previousReg,lf,rf,false);
      r.pia[sid]={...previousReg,remoteId:item.id,eTag:item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status};
      if(status!=='synced')details.push(`• PIA ${student?.nom||sid} : ${status}`);
    }catch(e){
      if(String(e.message||e).includes('Graph 404')){
        missing++;
        const previousReg=r.pia[sid]||{};
        r.pia[sid]={...previousReg,remoteId:null,eTag:null,fingerprint:lf,remoteFingerprint:null,lastCheckedAt:new Date().toISOString(),status:'local-changed'};
        details.push(`• PIA ${student?.nom||sid} : local-changed (distant absent)`);
      }else throw e;
    }
  }
  state.syncRegistry=r;const counts=v72StatusCount(r);state.sync.status=counts.conflict?'conflict':(counts.local?'pending':'synced');v72RecountPending(state);securePersistState();const lines=['✓ Analyse terminée.',`• Élève(s) découvert(s) sur OneDrive : ${discovery.discoveredStudents}`,`• Séance(s) découverte(s) sur OneDrive : ${discovery.discoveredSessions}`,`• PIA découvert(s) sur OneDrive : ${discovery.discoveredPIA||0}`,`• Éléments synchronisés : ${counts.synced}`,`• Modifications locales : ${counts.local}`,`• Modifications distantes : ${counts.remote}`,`• Conflits : ${counts.conflict}`,`• Distants absents : ${missing}`,'','Aucune écriture distante effectuée.'];if(details.length)lines.push('','Détails :',...details.slice(0,15));if(!opts.silent)setCloudStatus(lines.join('\n'),counts.conflict?'error':'success');if(discovery.discoveredStudents||discovery.discoveredSessions||discovery.discoveredPIA||deletedCount>0){refreshUIAfterCloudSync();}updateMicrosoftUI();}catch(e){if(!opts.silent)setCloudStatus('⚠️ '+(e.message||e),'error');else throw e;}finally{if(b)b.disabled=!msAccount;}}
async function v72SyncStudent(student,reg){const structure=await graphEnsureJournalierStructure();let folder;const path=`${GRAPH_ROOT_FOLDER}/eleves/${student.studentId}`;try{folder=await graphGetByPath(path);}catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;folder=await graphCreateChildFolder(structure.eleves.id,String(student.studentId));}const item=await graphGetByPath(`${path}/profil.json`).catch(()=>null);const written=await graphWriteJsonWithETag(folder.id,'profil.json',student,item?.eTag||reg?.eTag||null);return await graphReadItemWithJson(`${path}/profil.json`);}
async function v72SyncSession(session,reg,students){
  const studentId=reg?.studentId||session.identification?.eleveId||syncFindStudentByName(students,session.identification?.eleve)?.studentId;
  if(!studentId)throw new Error(`Élève introuvable pour la séance ${session.id}.`);
  const moving=Boolean(reg?.remoteMovePending&&reg?.previousRemoteId&&reg?.previousStudentId&&String(reg.previousStudentId)!==String(studentId));
  const structure=await graphEnsureJournalierStructure();
  const studentPath=`${GRAPH_ROOT_FOLDER}/eleves/${studentId}`;
  let studentFolder;
  try{studentFolder=await graphGetByPath(studentPath);}catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;studentFolder=await graphCreateChildFolder(structure.eleves.id,String(studentId));}
  let sessionsFolder;
  try{sessionsFolder=await graphGetByPath(`${studentPath}/seances`);}catch(e){if(!String(e.message||e).includes('Graph 404'))throw e;sessionsFolder=await graphCreateChildFolder(studentFolder.id,'seances');}
  const path=`${studentPath}/seances/${session.id}.json`;
  const existing=await graphGetByPath(path).catch(()=>null);
  // Lors d'un changement d'élève, l'ETag de l'ancien fichier ne protège pas
  // le nouveau chemin. On utilise donc uniquement l'ETag du fichier éventuellement
  // déjà présent au nouvel emplacement ; sinon l'écriture crée la nouvelle copie.
  const eTagForWrite=moving?(existing?.eTag||null):(existing?.eTag||reg?.eTag||null);
  await graphWriteJsonWithETag(sessionsFolder.id,`${session.id}.json`,session,eTagForWrite);

  if(moving){
    try{
      await graphDeleteItemWithETag(reg.previousRemoteId,reg.previousETag||null);
    }catch(e){
      if(!String(e.message||e).includes('Graph 404')){
        if(String(e.message||e).includes('Graph 412'))throw new Error(`Conflit détecté lors du déplacement de la séance ${session.id} : l’ancienne copie distante a changé.`);
        throw e;
      }
    }
  }
  return await graphReadItemWithJson(path);
}
async function v72SyncAgenda(agenda,reg){const structure=await graphEnsureJournalierStructure();const existing=await graphGetByPath(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`).catch(()=>null);await graphWriteJsonWithETag(structure.agenda.id,'agenda.json',agenda,existing?.eTag||reg?.eTag||null);return await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`);}
async function v72PullRemoteChanges(){
  const state=DataStore.state,r=v72EnsureSyncRegistry(state);let pulled=0;
  for(const [studentId,reg] of Object.entries(r.students||{})){
    if(reg?.status!=='remote-changed')continue;
    try{
      const {item,json}=await graphReadItemWithJson(v72PathForStudent({studentId}));
      validateRemoteStudent(json);const student=secureNormalizeStudent(json);student.ownerId=state.ownerId;student.studentId=studentId;
      const idx=state.students.findIndex(s=>s.studentId===studentId&&s.ownerId===state.ownerId);
      if(idx>=0)state.students[idx]=student;else state.students.push(student);
      const fp=syncFingerprint(syncWithoutVolatileMeta(student));
      r.students[studentId]={...reg,remoteId:item.id,eTag:item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};pulled++;
    }catch(e){console.warn('Journalier — pull élève impossible',studentId,e);}
  }
  for(const [sessionId,reg] of Object.entries(r.sessions||{})){
    if(reg?.status!=='remote-changed')continue;
    const path=reg.studentId?`${GRAPH_ROOT_FOLDER}/eleves/${reg.studentId}/seances/${sessionId}.json`:null;
    if(!path)continue;
    try{
      const {item,json}=await graphReadItemWithJson(path);
      validateRemoteSession(json);const session=secureNormalizeSession(json,DataStore.getStudents());session.ownerId=state.ownerId;
      const idx=state.sessions.findIndex(s=>String(s.id)===String(sessionId)&&s.ownerId===state.ownerId);
      if(idx>=0)state.sessions[idx]=session;else state.sessions.push(session);
      const fp=syncFingerprint(syncWithoutVolatileMeta(session));
      r.sessions[sessionId]={...reg,remoteId:item.id,eTag:item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};pulled++;
    }catch(e){console.warn('Journalier — pull séance impossible',sessionId,e);}
  }
  if(r.agenda?.status==='remote-changed'){
    try{
      const {item,json}=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/agenda/agenda.json`);
      validateRemoteAgenda(json||{});state.agenda=secureNormalizeAgenda(json||{});window.JournalierAgendaConfig?.refreshSessionPeriodSelectors?.();
      const fp=syncFingerprint(syncWithoutVolatileMeta(state.agenda));
      r.agenda={...r.agenda,remoteId:item.id,eTag:item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};pulled++;
    }catch(e){console.warn('Journalier — pull agenda impossible',e);}
  }
  for(const [studentId,reg] of Object.entries(r.pia||{})){
    if(reg?.status!=='remote-changed')continue;
    try{
      const {item,json}=await graphReadItemWithJson(`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(studentId)}/pia.json`);
      state.meta??={};state.meta.piaRecords??={};state.meta.piaImports??={};
      applyRemotePiaPayload(json,studentId,state.meta.piaRecords,state.meta.piaImports);
      const fp=syncFingerprint(syncWithoutVolatileMeta(json));
      r.pia[studentId]={...reg,remoteId:item.id,eTag:item.eTag||null,fingerprint:fp,remoteFingerprint:fp,lastCheckedAt:new Date().toISOString(),status:'synced'};pulled++;
    }catch(e){console.warn('Journalier — pull PIA impossible',studentId,e);}
  }
  if(pulled>0){
    state.syncRegistry=r;v72RecountPending(state);
    refreshUIAfterCloudSync();
  }
  return pulled;
}
async function syncPendingLocalChangesV72(opts={}){if(!msAccount)throw new Error('Connectez d’abord votre compte Microsoft.');const b=document.getElementById('ms-sync-action');if(b)b.disabled=true;try{
  const state=DataStore.state,r=v72EnsureSyncRegistry(state);let sent=0;const details=[];
  // Étape 1 : Exécuter en priorité absolue les suppressions en attente
  sent += await v72ProcessPendingDeletions(state,r,details);

  // Étape 2 : Analyser l'état de synchronisation (découverte comprise)
  await diagnoseSyncManagerV72({silent:true});

  const students=DataStore.getStudents(),sessions=DataStore.getSessions(),agenda=DataStore.getAgenda();
  if(v72ConflictEntries().length){if(!opts.silent)throw new Error('Conflit détecté : aucune écriture automatique n’a été effectuée. Résolvez d’abord les conflits.');return;}

  // Étape 3 : Récupérer les modifications distantes
  const pulled=await v72PullRemoteChanges();

  for(const student of students){const reg=r.students[student.studentId];if(!reg||!['local-changed','local-pending'].includes(reg.status))continue;const remote=await v72SyncStudent(student,reg);const fp=syncFingerprint(syncWithoutVolatileMeta(student)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));r.students[student.studentId]={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:fp,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:fp===rf?'synced':'local-changed'};sent++;details.push(`• élève ${student.nom||student.studentId} : ${r.students[student.studentId].status}`);}
  for(const session of sessions){const reg=r.sessions[session.id];if(!reg||!['local-changed','local-pending'].includes(reg.status))continue;const remote=await v72SyncSession(session,reg,students);const fp=syncFingerprint(syncWithoutVolatileMeta(session)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));const nextReg={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:fp,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:fp===rf?'synced':'local-changed'};if(nextReg.status==='synced'){delete nextReg.remoteMovePending;delete nextReg.previousStudentId;delete nextReg.previousRemoteId;delete nextReg.previousETag;}r.sessions[session.id]=nextReg;sent++;details.push(`• séance ${session.id} / ${session.identification?.eleve||reg.studentId} : ${r.sessions[session.id].status}`);}
  if(r.agenda&&['local-changed','local-pending'].includes(r.agenda.status)){const remote=await v72SyncAgenda(agenda,r.agenda),fp=syncFingerprint(syncWithoutVolatileMeta(agenda)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));r.agenda={...r.agenda,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:fp,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:fp===rf?'synced':'local-changed'};sent++;details.push(`• agenda : ${r.agenda.status}`);}
  const piaRecords=state.meta?.piaRecords||{}, piaImports=state.meta?.piaImports||{};
  for(const [studentId,reg] of Object.entries(r.pia||{})){
    if(!reg||!['local-changed','local-pending'].includes(reg.status))continue;
    const pia=piaRecords[studentId]||(piaImports[studentId]?{schemaVersion:"73.0.0",type:"PIA_IMPORT_CONTINUITE",studentId:String(studentId),role:"SOURCE_DE_CONTINUITE",sourceContinuity:piaImports[studentId]}:null);
    if(!pia){delete r.pia[studentId];continue;}
    try{
      const remote=await v74SavePIACloud(pia);
      const fp=syncFingerprint(syncWithoutVolatileMeta(pia)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));
      r.pia[studentId]={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:fp,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:fp===rf?'synced':'local-changed'};sent++;
      details.push(`• PIA ${studentId} : ${r.pia[studentId].status}`);
    }catch(e){details.push(`• PIA ${studentId} : échec (${e?.message||e})`);}
  }
  state.syncRegistry=r;v72RecountPending(state);state.sync.lastSyncAt=new Date().toISOString();state.sync.status=state.sync.pendingChanges?'pending':'synced';securePersistState();const syncRecord={schemaVersion:'JOURNALIER-SYNC-1',architectureVersion:JOURNALIER_ARCHITECTURE_VERSION,ownerId:state.ownerId,status:state.sync.status,students:students.length,sessions:sessions.length,agendaEntries:Array.isArray(agenda?.__events)?agenda.__events.length:Object.keys(agenda||{}).length,syncedAt:state.sync.lastSyncAt};const structure=await graphEnsureJournalierStructure();await graphWriteJson(structure.system.id,'sync.json',syncRecord);const summary=`✓ Synchronisation terminée.\n• Éléments envoyés : ${sent}\n• Éléments récupérés : ${pulled}\n• Éléments en attente : ${state.sync.pendingChanges}\n• Conflits : 0`+(details.length?`\n\n${details.join('\n')}`:'');if(!opts.silent)setCloudStatus(summary,'success');else if(sent>0||pulled>0)showAppToast?.(`↕ Synchronisation automatique : ${sent} envoyé(s), ${pulled} récupéré(s).`,'success',3000);updateMicrosoftUI();}catch(e){if(!opts.silent)setCloudStatus('⚠️ '+(e.message||e),'error');else console.warn('Journalier — synchronisation automatique en erreur.',e);}finally{if(b)b.disabled=!msAccount;}}
function v72ConflictSession(){
  const entry=v72ConflictEntries().find(x=>x.type==='session');
  return entry?.local||null;
}
function v72ConflictTypeLabel(type){
  return type==='student'?'Élève':type==='session'?'Séance':'Agenda';
}
function v72ConflictDescription(entry){
  if(entry.type==='student')return `Élève : ${entry.label}`;
  if(entry.type==='session')return `Séance : ${entry.label}${entry.local?.identification?.date?` · ${entry.local.identification.date}`:''}`;
  return 'Planning de l’agenda';
}
function v72RenderConflictResolution(){
  const panel=document.getElementById('ms-conflict-resolution-panel');
  const summary=document.getElementById('ms-conflict-resolution-summary');
  const list=document.getElementById('ms-conflict-resolution-list');
  const entries=v72ConflictEntries();
  if(!panel||!summary||!list)return;
  if(!entries.length){
    summary.innerHTML='<div class="v11-success">✓ Tous les conflits ont été résolus.</div>';
    list.innerHTML='';
    panel.style.display='block';
    return;
  }
  summary.innerHTML=`<div><strong>${entries.length}</strong> conflit${entries.length>1?'s':''} nécessite${entries.length>1?'nt':' '} un choix explicite.</div><div style="margin-top:4px;color:#64748b;font-size:.78rem">Aucune écriture distante ne sera effectuée tant que vous n’avez pas choisi, pour chaque élément, la version à conserver.</div>`;
  list.innerHTML=entries.map(entry=>{
    const type=v72ConflictTypeLabel(entry.type);
    const remoteAvailable=Boolean(entry.reg?.remoteId);
    return `<div class="event-summary-box" data-conflict-card="${escapeHtml(entry.type)}:${escapeHtml(entry.key)}" style="margin-top:0">\
      <div style="font-weight:800">${escapeHtml(type)} — ${escapeHtml(entry.label)}</div>\
      <div style="font-size:.76rem;color:#64748b;margin-top:4px">${escapeHtml(v72ConflictDescription(entry))}</div>\
      <div style="font-size:.76rem;margin-top:7px">Version locale : <strong>${entry.local?'modifiée / disponible':'absente'}</strong> · Version OneDrive : <strong>${remoteAvailable?'modifiée / disponible':'non référencée'}</strong></div>\
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">\
        <button class="btn-primary v72-conflict-choice" type="button" data-conflict-type="${escapeHtml(entry.type)}" data-conflict-key="${escapeHtml(entry.key)}" data-conflict-choice="local">Conserver la version locale</button>\
        <button class="btn-secondary v72-conflict-choice" type="button" data-conflict-type="${escapeHtml(entry.type)}" data-conflict-key="${escapeHtml(entry.key)}" data-conflict-choice="remote" ${remoteAvailable?'':'disabled'}>Conserver la version OneDrive</button>\
      </div>\
    </div>`;
  }).join('');
  panel.style.display='block';
}
async function openConflictResolutionV72(){
  if(!msAccount)throw new Error('Connectez d’abord votre compte Microsoft.');
  v72RenderConflictResolution();
}
async function v72ResolveConflictEntry(entry,choice){
  if(!entry)throw new Error('Conflit introuvable.');
  const state=DataStore.state,r=state.syncRegistry;
  const reg=entry.reg;
  if(!reg?.remoteId && choice==='remote')throw new Error('La version OneDrive n’est plus disponible pour cet élément.');
  if(entry.type==='student'){
    if(choice==='local'){
      const remote=await graphReadItemByIdWithJson(reg.remoteId);
      const local=DataStore.getStudents().find(x=>String(x.studentId)===entry.key);
      if(!local)throw new Error('Élève local introuvable.');
      await graphWriteExistingItemWithETag(remote.item,local);
      const after=await graphReadItemByIdWithJson(remote.item.id);
      const lf=syncFingerprint(syncWithoutVolatileMeta(local)),rf=syncFingerprint(syncWithoutVolatileMeta(after.json));
      if(lf!==rf)throw new Error('Vérification distante incohérente après résolution de l’élève.');
      r.students[entry.key]={...reg,remoteId:after.item.id,eTag:after.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
    }else{
      const remote=await graphReadItemByIdWithJson(reg.remoteId);
      const clean=secureNormalizeStudent(remote.json);
      const idx=state.students.findIndex(x=>String(x.studentId)===entry.key);
      if(idx<0)state.students.push(clean);else state.students[idx]=clean;
      const lf=syncFingerprint(syncWithoutVolatileMeta(clean)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));
      r.students[entry.key]={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
    }
  }else if(entry.type==='session'){
    if(choice==='local'){
      if(!entry.local){
        await graphDeleteItemWithETag(reg.remoteId,reg.eTag||null);
        delete r.sessions[entry.key];
      }else{
        const remote=await graphReadItemByIdWithJson(reg.remoteId);
        await graphWriteExistingItemWithETag(remote.item,entry.local);
        const after=await graphReadItemByIdWithJson(remote.item.id);
        const lf=syncFingerprint(syncWithoutVolatileMeta(entry.local)),rf=syncFingerprint(syncWithoutVolatileMeta(after.json));
        if(lf!==rf)throw new Error('Vérification distante incohérente après résolution de la séance.');
        r.sessions[entry.key]={...reg,remoteId:after.item.id,eTag:after.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
      }
    }else{
      const remote=await graphReadItemByIdWithJson(reg.remoteId);
      const clean=secureNormalizeSession(remote.json,DataStore.getStudents());
      const idx=state.sessions.findIndex(x=>String(x.id)===entry.key);
      if(idx<0)state.sessions.push(clean);else state.sessions[idx]=clean;
      const local=clean,lf=syncFingerprint(syncWithoutVolatileMeta(local)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));
      r.sessions[entry.key]={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
    }
  }else if(entry.type==='agenda'){
    const remote=await graphReadItemByIdWithJson(reg.remoteId);
    if(choice==='local'){
      const local=DataStore.getAgenda();
      await graphWriteExistingItemWithETag(remote.item,local);
      const after=await graphReadItemByIdWithJson(remote.item.id);
      const lf=syncFingerprint(syncWithoutVolatileMeta(local)),rf=syncFingerprint(syncWithoutVolatileMeta(after.json));
      if(lf!==rf)throw new Error('Vérification distante incohérente après résolution de l’agenda.');
      r.agenda={...reg,remoteId:after.item.id,eTag:after.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
    }else{
      state.agenda=secureNormalizeAgenda(remote.json);
      const local=state.agenda,lf=syncFingerprint(syncWithoutVolatileMeta(local)),rf=syncFingerprint(syncWithoutVolatileMeta(remote.json));
      r.agenda={...reg,remoteId:remote.item.id,eTag:remote.item.eTag||null,fingerprint:lf,remoteFingerprint:rf,lastCheckedAt:new Date().toISOString(),status:'synced'};
    }
  }else throw new Error('Type de conflit inconnu.');
  state.syncRegistry=r;
  v72RecountPending(state);
  securePersistState();
  renderAgenda();
  updateMicrosoftUI();
}
function v72ResolveLocal(){
  const entry=v72ConflictEntries()[0];
  return entry?v72ResolveConflictEntry(entry,'local'):Promise.reject(new Error('Aucun conflit actif.'));
}
function v72ResolveRemote(){
  const entry=v72ConflictEntries()[0];
  return entry?v72ResolveConflictEntry(entry,'remote'):Promise.reject(new Error('Aucun conflit actif.'));
}
function closeConflictResolutionV72(){const p=document.getElementById('ms-conflict-resolution-panel');if(p)p.style.display='none';}
function showAppToast(message,type='info',duration=2600){
  const toast=document.getElementById('app-toast'); if(!toast) return;
  toast.textContent=message; toast.className='show '+type;
  clearTimeout(window.__appToastTimer); window.__appToastTimer=setTimeout(()=>{toast.className='';},duration);
}
function animateClick(el,state='validating'){
  if(!el) return; el.classList.remove('click-validating','click-success','click-error'); void el.offsetWidth; el.classList.add('click-'+state); setTimeout(()=>el.classList.remove('click-'+state),500);
}
/* =========================================================
   JOURNALIER — XSS HARDENING / DYNAMIC UI EVENTS
   ---------------------------------------------------------
   Les contenus générés dynamiquement n'utilisent plus de
   handlers inline contenant des données applicatives.
   Les actions passent par délégation d'événements et data-*.
   ========================================================= */
document.addEventListener('click',function(e){
  if(window._jrSuppressNextClick && Date.now()-window._jrSuppressNextClick<350){
    window._jrSuppressNextClick=0;
    return;
  }
  if(e.target.closest?.('.event-resize-handle')) return;
  const target=e.target.closest(
    '.js-home-event,.js-day-event,.js-quick-form,.js-open-slot,'+
    '.js-week-day,.js-week-event,.js-week-slot,.js-month-day,'+
    '.js-student-subject,.js-session-subject,'+
    '[data-action="student-profile"],[data-action="student-edit"],[data-action="student-delete"]'
  );
  if(!target) return;

  if(target.classList.contains('js-home-event') || target.classList.contains('js-day-event') || target.classList.contains('js-week-event')){
    const dayIndex=Number(target.dataset.dayIndex);
    if(!Number.isInteger(dayIndex)) return;
    e.stopPropagation();
    openEventActionModal(target.dataset.iso||'',target.dataset.startPeriod||'',dayIndex,target.dataset.eventId||'');
    return;
  }

  if(target.classList.contains('js-quick-form')){
    e.stopPropagation();
    quickFormForSlot(target.dataset.iso||'',target.dataset.startPeriod||'',target.dataset.eleve||'',target.dataset.matiere||'');
    return;
  }

  if(target.classList.contains('js-open-slot') || target.classList.contains('js-week-slot')){
    const dayIndex=Number(target.dataset.dayIndex);
    if(!Number.isInteger(dayIndex)) return;
    openSlotModal(target.dataset.iso||'',target.dataset.period||'',dayIndex,null,target.dataset.forceCreate==='true');
    return;
  }

  if(target.classList.contains('js-week-day') || target.classList.contains('js-month-day')){
    jumpToDayView(target.dataset.iso||'');
    return;
  }

  if(target.classList.contains('js-student-subject')){
    toggleStudentSubject(target.dataset.value||'');
    return;
  }

  if(target.classList.contains('js-session-subject')){
    chooseSessionSubject(target.dataset.value||'');
    return;
  }

  const action=target.dataset.action;
  const id=target.dataset.studentId;
  if(action==='student-profile') return openStudentProfile(id);
  if(action==='student-edit') return openEditStudentModal(id);
  if(action==='student-delete') return deleteStudent(id);

});

document.addEventListener('change',function(e){
  const input=e.target.closest('input[name="q3-learning"]');
  if(input) updateQ3BubbleState(input);
});

document.addEventListener('click',function(e){
  const el=e.target.closest('button,[role=button],.week-event-cell,.home-row,.month-date-cell');
  if(!el || el.disabled || el.getAttribute('aria-disabled')==='true') return;
  animateClick(el,'validating');
},true);



async function v74SavePIACloud(pia){
  if(!msAccount) throw new Error('Compte Microsoft non connecté.');
  const structure=await graphEnsureJournalierStructure();
  const sid=String(pia.studentId||'').trim(); if(!sid) throw new Error('Identifiant élève absent du PIA.');
  let folder;
  try{folder=await graphGetByPath(`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(sid)}`);}
  catch(e){if(!String(e?.message||e).includes('Graph 404'))throw e; folder=await graphCreateChildFolder(structure.pia.id,sid);}
  const path=`${GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(sid)}/pia.json`;
  const existing=await graphGetByPath(path).catch(()=>null);
  await graphWriteJsonWithETag(folder.id,'pia.json',pia,existing?.eTag||null);
  return await graphReadItemWithJson(path);
}
window.JournalierCloud={savePia:v74SavePIACloud};

window.updateMicrosoftUI = updateMicrosoftUI;
Object.assign(window,{openMicrosoftConnection,closeMicrosoftConnection,startMicrosoftLogin,disconnectMicrosoft,prepareMicrosoft365Space,verifyMicrosoft365Space,testMicrosoftAppFolder,diagnoseSyncManagerV72,syncPendingLocalChangesV72,openConflictResolutionV72,showAppToast,syncFingerprint,syncWithoutVolatileMeta});
window.JournalierMigrationBridge = Object.freeze({
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
  v72MarkPiaPending,
  v72MarkPiaSynced,
  v74RepartirDeOneDrive,
  v74SavePIACloud,
  validateStrictAgenda,
  validateStrictPIA,
  validateStrictSession,
  validateStrictStudent,
  DataStore,
  JournalierSecurity,
  get msAccount(){ return msAccount; },
  JOURNALIER_ARCHITECTURE_VERSION
});
document.getElementById('ms-conflict-resolution-list')?.addEventListener('click',async e=>{
  const button=e.target.closest('.v72-conflict-choice');
  if(!button||button.disabled)return;
  const type=button.dataset.conflictType,key=button.dataset.conflictKey,choice=button.dataset.conflictChoice;
  const entry=v72ConflictEntries().find(x=>x.type===type&&x.key===key);
  if(!entry)return;
  button.disabled=true;
  const sibling=button.parentElement?.querySelectorAll('button');
  sibling?.forEach(b=>b.disabled=true);
  try{
    await v72ResolveConflictEntry(entry,choice);
    setCloudStatus(`✓ ${v72ConflictTypeLabel(type)} « ${entry.label} » résolu : version ${choice==='local'?'locale':'OneDrive'} conservée.`,'success');
    v72RenderConflictResolution();
  }catch(err){
    sibling?.forEach(b=>b.disabled=false);
    setCloudStatus('⚠️ '+(err?.message||err),'error');
  }
});
document.getElementById('ms-cancel-conflict-resolution')?.addEventListener('click',closeConflictResolutionV72);
document.getElementById('ms-reset-onedrive-action')?.addEventListener('click',()=>{
  if(!msAccount){showAppToast('Connectez-vous d’abord avec votre compte Microsoft.','error');return;}
  const state=DataStore.state,pending=countUncommittedSyncChanges(state);
  const warn=document.getElementById('ms-reset-uncommitted-warning');
  if(warn)warn.style.display=pending>0?'block':'none';
  const modal=document.getElementById('ms-reset-onedrive-modal');
  if(modal)modal.style.display='flex';
});
document.getElementById('ms-reset-onedrive-cancel')?.addEventListener('click',()=>{
  const modal=document.getElementById('ms-reset-onedrive-modal');if(modal)modal.style.display='none';
});
document.getElementById('ms-reset-onedrive-confirm')?.addEventListener('click',async()=>{
  const modal=document.getElementById('ms-reset-onedrive-modal');if(modal)modal.style.display='none';
  try{
    await v74RepartirDeOneDrive({confirmed:true});
  }catch(e){
    setCloudStatus('⚠️ Échec de la récupération OneDrive : '+(e?.message||e),'error');
    showAppToast('Échec de la récupération : '+(e?.message||e),'error',5000);
  }
});
document.addEventListener('DOMContentLoaded',async()=>{updateMicrosoftUI();await initMicrosoftAuth();});
