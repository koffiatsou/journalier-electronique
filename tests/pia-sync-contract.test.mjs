import fs from 'node:fs';

const core = fs.readFileSync(new URL('../src/app/journalier-core.js', import.meta.url), 'utf8');
const ms = fs.readFileSync(new URL('../src/app/microsoft-core.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/v74/v74-runtime.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. Persistance granulaire locale de piaImports & piaRecords
assert(core.includes("state.meta.piaRecords[row.id]"), 'Le chargement granulaire doit reconstruire state.meta.piaRecords.');
assert(core.includes("state.meta.piaImports[row.id]"), 'Le chargement granulaire doit reconstruire state.meta.piaImports.');
assert(core.includes("value:{record:value||null,imported:imported||null}"), 'La préparation de persistance doit sauvegarder simultanément record et imported.');
assert(core.includes("window.v72MarkPiaPending=v72MarkPiaPending;"), 'v72MarkPiaPending doit être disponible globalement.');
assert(core.includes("window.v72MarkPiaSynced=v72MarkPiaSynced;"), 'v72MarkPiaSynced doit être disponible globalement.');

// 2. Gestion du Dirty State et Enregistrement lors de l\'import
assert(runtime.includes("persistImportedPIA(studentId,imported)"), 'persistImportedPIA doit être défini.');
assert(runtime.includes("st.meta.piaImports[studentId]=safe;"), 'persistImportedPIA doit stocker le PIA importé dans state.meta.piaImports.');
assert(runtime.includes("markPending?.(st,studentId)"), 'persistImportedPIA doit marquer le PIA en attente de synchronisation.');
assert(runtime.includes("window.journalierScheduleAutoSync?.()"), 'persistImportedPIA doit planifier la synchronisation automatique.');

// 3. Synchronisation OneDrive pour PIA importé seul (sans PIA annuel natif)
assert(ms.includes("const pia=piaRecords[studentId]||(piaImports[studentId]?{schemaVersion:\"73.0.0\",type:\"PIA_IMPORT_CONTINUITE\",studentId:String(studentId),role:\"SOURCE_DE_CONTINUITE\",sourceContinuity:piaImports[studentId]}:null);"), 'syncPendingLocalChangesV72 doit synchroniser le PIA importé même si aucun PIA annuel natif n’existe.');
assert(!ms.includes("const pia=piaRecords[studentId];if(!pia){delete r.pia[studentId];continue;}"), 'syncPendingLocalChangesV72 ne doit plus supprimer r.pia[studentId] si seul piaImports existe.');
assert(ms.includes("const remote=await v74SavePIACloud(pia);"), 'v74SavePIACloud doit être appelé pour sauvegarder le PIA sur OneDrive.');

// 4. Récupération distante (Pull et Découverte) de PIA
assert(ms.includes("for(const [studentId,reg] of Object.entries(r.pia||{})){") && ms.includes("reg?.status!=='remote-changed'"), 'v72PullRemoteChanges doit récupérer les PIA distants modifiés.');
assert(ms.includes("GRAPH_ROOT_FOLDER}/pia/${encodeURIComponent(studentId)}/pia.json"), 'Le chemin OneDrive AppFolder /pia/<studentId>/pia.json doit être respecté.');

// 5. Validation stricte dédiée au PIA lors de l'écriture Graph
assert(ms.includes("else if(name==='pia.json')validateStrictPIA(payload,'Écriture PIA');"), 'graphWriteJsonWithETag doit valider les fichiers pia.json avec validateStrictPIA et non avec validateStrictSession.');
assert(ms.includes("function validateStrictPIA(pia,label='PIA')"), 'validateStrictPIA doit être défini.');
assert(ms.includes("validateStrictPIA,"), 'validateStrictPIA doit être exposé sur JournalierMigrationBridge.');

console.log('✓ Contrat d’import, persistance et synchronisation OneDrive du PIA validé.');
