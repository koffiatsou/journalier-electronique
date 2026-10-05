import fs from 'node:fs';

const core = fs.readFileSync(new URL('../src/app/journalier-core.js', import.meta.url), 'utf8');
const ms = fs.readFileSync(new URL('../src/app/microsoft-core.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. Enregistrement systématique des suppressions locales
assert(core.includes("r.sessions[id]={...existing,status:'deleted-pending'"), 'Les séances supprimées doivent toujours être marquées deleted-pending dans le registre.');
assert(core.includes('renderAgenda?.();'), 'La suppression d’une séance doit rafraîchir l’Agenda immédiatement.');

// 2. Traitement prioritaire des suppressions avant découverte
assert(ms.includes('async function v72ProcessPendingDeletions'), 'La fonction v72ProcessPendingDeletions doit être définie.');
assert(ms.includes('v72ProcessPendingDeletions(state,r,deletionDetails);') || ms.includes('v72ProcessPendingDeletions(state, r, deletionDetails);'), 'diagnoseSyncManagerV72 doit traiter les suppressions en attente avant toute découverte.');
assert(ms.includes('sent += await v72ProcessPendingDeletions'), 'syncPendingLocalChangesV72 doit traiter les suppressions en attente en priorité absolue.');

// 3. Découverte distante protégée contre la résurrection de séances supprimées
assert(ms.includes('const locallyDeletedSession=sessionRegistryEntry?.status===\'deleted-pending\'') || ms.includes('locallyDeletedSession'), 'v72DiscoverRemoteEntities doit ignorer les séances supprimées localement.');
assert(ms.includes('if(locallyDeletedSession)continue;'), 'v72DiscoverRemoteEntities ne doit pas réimporter une séance supprimée.');

// 4. Suppression distante directe (Graph 404 pour un fichier existant)
assert(ms.includes('if(previousReg.remoteId){'), 'Un 404 sur une séance déjà synchronisée sur OneDrive doit être traité comme une suppression distante.');
assert(ms.includes('delete r.sessions[session.id];'), 'Le registre doit être nettoyé lors de la détection d’une suppression sur OneDrive.');

console.log('✓ Contrat de synchronisation des suppressions (séances et OneDrive) validé.');
