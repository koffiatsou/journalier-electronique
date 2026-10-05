# Correctif Technique : Persistance locale et Synchronisation OneDrive des PIA importés

Projet : **Journalier** (Pôle WBE) · Version : **V74** (Base Lot 1 + Lot 2)

---

## 1. Contexte et Problème résolu

Lors de l’importation d’un document PIA (.pdf ou .docx) dans le dossier d’un élève :
* Les données importées étaient visibles dans l’application et structurées localement ;
* Cependant, les données ne parvenaient pas au OneDrive professionnel tant qu’un PIA annuel natif n’était pas construit par l’utilisateur ;
* Pire, lors d’une synchronisation ultérieure (`syncPendingLocalChangesV72`), l’entrée `r.pia[studentId]` était purgée du registre car `state.meta.piaRecords[studentId]` était indéfini, empêchant toute synchronisation ultérieure du document importé.

---

## 2. Analyse des causes et Corrections apportées

### A. Moteur de synchronisation OneDrive (`src/app/microsoft-core.js`)

1. **Suppression prématurée empêchée dans `syncPendingLocalChangesV72` :**
   * *Cause* : Le code lisait uniquement `state.meta.piaRecords[studentId]`. Si seul le PIA importé était présent, `delete r.pia[studentId]; continue;` était déclenché.
   * *Correctif* : Construction du payload de continuité `PIA_IMPORT_CONTINUITE` lorsque seul `piaImports[studentId]` est présent :
     ```javascript
     const pia = piaRecords[studentId] || (piaImports[studentId] ? {
       schemaVersion: "73.0.0",
       type: "PIA_IMPORT_CONTINUITE",
       studentId: String(studentId),
       role: "SOURCE_DE_CONTINUITE",
       sourceContinuity: piaImports[studentId]
     } : null);
     ```
   * Envoi vers l'AppFolder OneDrive (`/pia/<studentId>/pia.json`) via `v74SavePIACloud(pia)`.
   * Enregistrement du `remoteId` et de l’`eTag` dans le registre `r.pia[studentId]`.

2. **Récupération distante (Pull) pour les PIA dans `v72PullRemoteChanges` :**
   * *Cause* : `v72PullRemoteChanges` ne traitait que les élèves, séances et agenda, omettant les PIA distants modifiés (`remote-changed`).
   * *Correctif* : Ajout de la boucle de récupération distante pour `r.pia`, discriminant `PIA_ANNUEL` et `sourceContinuity` (`PIA_IMPORT_CONTINUITE`).

3. **Exhaustivité du diagnostic dans `diagnoseSyncManagerV72` :**
   * Balayage de l'ensemble des identifiants d'élèves (`students`, `piaRecords`, `piaImports`) pour ne laisser aucun PIA orphelin hors diagnostic.

4. **Résolution du faux conflit de validation (`graphWriteJsonWithETag`) :**
   * *Symptôme observé* : `• PIA student_legacy_X : échec (Écriture séance contient des propriétés inattendues : studentId, role, sourceContinuity.)`.
   * *Cause* : Dans `graphWriteJsonWithETag`, la règle par défaut pour tous les fichiers `*.json` non explicitement filtrés appelait `validateStrictSession(payload, 'Écriture séance')`. Comme `pia.json` n'était pas intercepté, le validateur de séances rejetait les clés légitimes du PIA (`studentId`, `role`, `sourceContinuity`).
   * *Correctif* : Ajout de la branche `else if(name==='pia.json') validateStrictPIA(payload,'Écriture PIA');` et de la fonction dédiée `validateStrictPIA`.
   * *Prise en charge de la migration legacy (`src/v74/v74-migration.js`)* : Détection et téléversement des éventuels dossiers `pia/` présents dans `Journalier-legacy`.

---

### B. Cycle de vie local et Dirty State (`src/v74/v74-runtime.js`)

1. **Envoi immédiat et planification d’auto-synchronisation :**
   * Dans `persistImportedPIA(studentId, imported)` :
     * Marquage en `local-pending` via `v72MarkPiaPending`.
     * Persistance locale immédiate dans la base granulaire IndexedDB.
     * Si la session Microsoft est active, tentative immédiate de téléversement via `JournalierCloud.savePia(piaPayload)` et bascule en `synced` (`v72MarkPiaSynced`).
     * En cas d'absence de connexion ou d'échec réseau, `journalierScheduleAutoSync()` prend le relais en arrière-plan sans blocage.

---

### C. Persistance granulaire IndexedDB (`src/app/journalier-core.js`)

1. **Reconstruction granulaire robuste (`journalierLoadGranularState`) :**
   * Sécurisation du décodage des lignes du store `pia` pour reconstituer fidèlement `state.meta.piaRecords` et `state.meta.piaImports` sans perte de continuité pédagogique.
2. **Exposition globale de `v72MarkPiaPending` et `v72MarkPiaSynced` :**
   * Garantit l'accessibilité des fonctions de marquage de synchronisation entre scripts indépendamment de l'ordre d'évaluation.

---

## 3. Préservation intégrale des correctifs antérieurs

Toutes les corrections du Lot 1, du Lot 2 et des correctifs précédents restent rigoureusement actives et testées :
1. **Agenda (8 périodes, 3 statuts, modèle `__events`, absence de conflits bloquants, récurrences, synchro après suppression).**
2. **Historique des séances (édition, réattribution d'élève, conservation de l'identifiant et renommage distant).**
3. **Suppression des séances et protection OneDrive (exécution prioritaire des suppressions `deleted-pending`, protection contre la résurrection des séances, gestion des 404).**
4. **Stockage granulaire chiffré (AES-GCM, AAD, base IndexedDB `journalier-secure-v74`).**

---

## 4. Validation

* **`npm test`** :
  * `storage-v74-contract.test.mjs` : **PASS**
  * `agenda-v74-contract.test.mjs` : **PASS**
  * `session-edit-contract.test.mjs` : **PASS**
  * `sync-deletion-contract.test.mjs` : **PASS**
  * `pia-sync-contract.test.mjs` : **PASS**
* **`npm run build`** : **PASS** (compilation Vite sans avertissement bloquant).
