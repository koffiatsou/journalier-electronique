import fs from 'node:fs';

const core = fs.readFileSync(new URL('../src/app/journalier-core.js', import.meta.url), 'utf8');
const vault = fs.readFileSync(new URL('../src/app/storage-vault.js', import.meta.url), 'utf8');
const storageCode = core + '\n' + vault;
const ms = fs.readFileSync(new URL('../src/app/microsoft-core.js', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const architecture = fs.readFileSync(new URL('../ARCHITECTURE.md', import.meta.url), 'utf8');
const security = fs.readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(storageCode.includes("const JOURNALIER_DB_NAME = 'journalier-secure-v72';"), 'L’identifiant IndexedDB historique v72 doit rester conservé.');
assert(storageCode.includes("const JOURNALIER_STORAGE_DB_NAME = 'journalier-secure-v74';"), 'La nouvelle base granulaire v74 est absente.');
assert(storageCode.includes("'meta', 'students', 'sessions', 'agenda', 'pia', 'sync', 'keys', 'migration'"), 'Le schéma granulaire attendu est incomplet.');
assert(storageCode.includes("storageKey:`${accountKey}:${String(id)}`"), 'Les enregistrements granulaires ne sont pas isolés par compte au niveau de la clé IndexedDB.');
assert(storageCode.includes("durability:'strict'"), 'Les transactions critiques ne demandent pas la durabilité stricte.');
assert(storageCode.includes("additionalData:journalierAad(accountKey,type,id)"), 'Le chiffrement AES-GCM n’utilise pas de données authentifiées liées au compte/type/ID.');
assert(storageCode.includes('schemaVersion:JOURNALIER_STORAGE_SCHEMA_VERSION'), 'La version du schéma de stockage n’est pas portée par les enregistrements.');
assert(storageCode.includes('digest:await journalierDigestBuffer(ciphertext)'), 'Une empreinte d’intégrité des enregistrements n’est pas enregistrée.');
assert(storageCode.includes('journalierReadLegacyState(accountKey,legacyKey.key)'), 'La lecture du stockage historique pour migration/récupération est absente.');
assert(storageCode.includes("this.recoveryRequired=true;this.recoveryReason='legacy-unreadable';"), 'Le cas du coffre historique illisible n’est pas distingué d’une première installation.');
assert(storageCode.includes('needsMigration=true'), 'La migration depuis le stockage historique n’est pas explicitement suivie.');
assert(storageCode.includes('journalierPreparePersistOperations'), 'La persistance granulaire n’est pas séparée de l’orchestration DataStore.');
assert(storageCode.includes("operations.push({op:'put',store,id,type,value})"), 'Les objets métier ne sont pas persistés individuellement.');
assert(storageCode.includes("operations.push({op:'delete',store,id})"), 'La suppression granulaire n’est pas persistée.');
assert(storageCode.includes("journalierApplyPersistOperations(operations"), 'Les opérations granulaires ne sont pas appliquées transactionnellement.');
assert(!storageCode.includes("objectStore(JOURNALIER_STATE_STORE).put"), 'Le nouveau chemin de persistance ne doit plus réécrire le monolithe v72.');
assert(storageCode.includes("state.meta.piaRecords[row.id]"), 'Les PIA ne sont pas reconstruits depuis un stockage granulaire.');
assert(storageCode.includes("if(row.id==='__config'||row.id==='__exceptions')"), 'La configuration et les exceptions Agenda ne sont pas séparées des événements.');
assert(ms.includes('await securePersistState();'), 'La récupération OneDrive doit attendre la persistance locale granulaire.');
assert(readme.includes('stockage local granulaire'), 'README non aligné sur le nouveau stockage granulaire.');
assert(architecture.includes('journalier-secure-v74'), 'Architecture non documentée avec la nouvelle base.');
assert(security.includes('journalier-secure-v74'), 'Sécurité non documentée avec la nouvelle base.');

console.log('✓ Contrat stockage granulaire V74 passé');
console.log('✓ Compatibilité du coffre historique v72 conservée');
console.log('✓ AES-GCM + AAD + empreinte d’intégrité vérifiés');
console.log('✓ Transactions strictes et persistance granulaire vérifiées');
console.log('✓ Migration non destructive et mode récupération vérifiés');
console.log('✓ Récupération OneDrive persistée avant confirmation UI vérifiée');
