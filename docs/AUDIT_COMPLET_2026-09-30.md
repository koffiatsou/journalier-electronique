# Audit complet et nettoyage — Journalier V74

Date : 30 septembre 2026

## Base de départ

Cette archive a été reconstruite à partir du ZIP d'audit fourni par l'utilisateur le 30 septembre 2026.
La base a été relue dans son ensemble puis réalignée avec les décisions fonctionnelles V74 établies pendant le chantier Agenda.

## Règle métier Agenda retenue

L'Agenda utilise trois états actifs :

- `proposed` → **Planifié**
- `realized` → **Réalisé**
- `cancelled` → **Annulé**

`confirmed` n'est plus un état actif. Pour préserver les anciennes données, une valeur historique `confirmed` est convertie en `proposed` lors de la normalisation.

Les chevauchements sont autorisés : plusieurs événements planifiés peuvent coexister sur un même créneau.

Pour un événement `ELEVE`, **Réalisé** est déterminé par une séance effectivement enregistrée dans l'Historique. Une séance historique est projetée dans les vues jour, semaine et mois même lorsqu'aucun événement planifié correspondant n'existait. Cette projection virtuelle n'est pas enregistrée dans `agenda.__events`.

Les événements non pédagogiques (`COLLAB`, `FORMATION`, `ADMIN`, `LIBRE`) peuvent être marqués Réalisé directement depuis l'Agenda.

## Historique

Le cœur métier gère directement les actions Modifier et Supprimer de l'Historique. Le module Microsoft Graph ne contient plus de dépendance vers les fonctions internes de l'Historique.

Le bouton Modifier du détail est rebinding après chaque rendu dynamique du panneau et le gestionnaire de liste couvre également les boutons générés dans la liste.

## Agenda ↔ Historique

Le rapprochement utilise les périodes normalisées `startIndex` / `endIndex`.
Une séance enregistrée peut :

1. rendre Réalisé un événement planifié correspondant ;
2. ou produire une occurrence virtuelle Réalisé si aucun événement planifié ne correspond.

Lorsqu'une séance est supprimée, le rapprochement rétablit l'état Planifié de l'événement prévisionnel lorsqu'un rapprochement unique et fiable est établi.

## Microsoft Graph / OneDrive

Le validateur Agenda n'accepte comme états actifs que `proposed`, `realized` et `cancelled`.
Les propriétés Graph existantes de l'événement sont conservées et les métadonnées Outlook restent réservées à la future synchronisation.

L'architecture SPA + Entra ID + Microsoft Graph + OneDrive AppFolder reste inchangée ; la persistance locale a toutefois été refondue en coffre IndexedDB granulaire.

## CSP / sécurité

La CSP de `index.html` reste fondée sur `script-src 'self'`. Aucun nouveau domaine, script inline ou mécanisme d'authentification n'a été ajouté.

Les actions d'interface utilisent les mécanismes existants et les attributs `data-*`; aucune action dynamique ne réintroduit de script inline.

## Tests exécutés

Les contrôles suivants ont été exécutés sur cette base :

- `node --check` sur tous les fichiers JavaScript sous `src/` : **PASS** ;
- `node tests/agenda-v74-contract.test.mjs` : **PASS** ;
- contrôle des 8 périodes : **PASS** ;
- contrôle du modèle `__events` et des trois états actifs : **PASS** ;
- contrôle des rapprochements Agenda/Historique : **PASS** ;
- contrôle CSP statique : **PASS** ;
- contrôle des IDs HTML : **PASS** ;
- contrôle Graph/migration : **PASS**.

## Build production

`npm run build` n'est pas déclaré comme exécuté dans l'environnement de préparation de cette archive. La validation de production doit être effectuée dans le Codespace avec les dépendances du projet :

```bash
npm ci
npm run build
```

Le résultat de ces commandes devra être traité comme la validation du build de la base importée.

## Nettoyage effectué

Les artefacts intermédiaires de correction du 30 septembre (`docs/AUDIT_CORRECTIONS_2026-09-30.md` et `.patch`) ne font pas partie de cette base propre. Le nouvel audit global est conservé dans ce fichier.

Les documents historiques et les mentions historiques de décisions antérieures restent distincts du modèle actif ; ils ne constituent pas des états fonctionnels du code actuel.

## 2026-09-30 — Chantier modification des séances

### Diagnostic confirmé

Le formulaire de séance stocke le nom de l’élève dans `f-eleve`. En mode édition, `showTab('form')` reconstruit les listes d’élèves avec les élèves actuellement présents. Une séance dont l’ancien élève a été supprimé perdait donc sa valeur sélectionnée lors de ce rafraîchissement et ne pouvait pas être enregistrée sous un nouvel élève.

### Correction

- résolution prioritaire par `identification.eleveId`, puis compatibilité par nom ;
- repère explicite pour un ancien élève supprimé ;
- obligation pratique de sélectionner un élève actuel avant sauvegarde ;
- conservation de l’`id` de séance et réattribution du `studentId` ;
- gestion du déplacement OneDrive d’une séance déjà synchronisée ;
- contrat de test dédié ajouté dans `tests/session-edit-contract.test.mjs`.

### Vérifications réalisées

- syntaxe `journalier-core.js` et `microsoft-core.js` ;
- contrat de modification de séance ;
- simulation ancien élève supprimé → nouvel élève ;
- simulation de conservation de l’identifiant de séance ;
- vérification statique du déplacement distant et du traitement `412`.

Le build Vite final doit être rejoué dans l’environnement Codespaces après installation complète des dépendances.


## 2026-09-30 — Refonte du stockage local granulaire

### Symptôme

Dans le navigateur, la base historique `journalier-secure-v72` et ses stores restaient accessibles, mais la lecture du seul enregistrement `states` échouait avec `UnknownError: Failed to read large IndexedDB value`.

### Cause confirmée

La concentration de l'ensemble de l'état métier dans une seule valeur chiffrée est confirmée comme faiblesse architecturale et point de concentration du risque. Le mécanisme interne exact du navigateur ayant conduit à l'erreur n'est pas considéré comme déterminé.

### Correction implémentée

- ajout du coffre `journalier-secure-v74` ;
- stores séparés `meta`, `students`, `sessions`, `agenda`, `pia`, `sync`, `keys`, `migration` ;
- persistance par objet au lieu d'une réécriture monolithique ;
- AES-GCM 256 bits par enregistrement avec IV unique ;
- AAD liée à l'identité, au type et à l'identifiant ;
- empreinte SHA-256 du ciphertext pour diagnostic d'intégrité ;
- transaction IndexedDB demandant `durability: 'strict'` ;
- conservation du coffre v72 et migration non destructive ;
- distinction entre première installation, migration et coffre historique illisible ;
- récupération distante compatible avec l'hydratation OneDrive existante ;
- persistance de la récupération distante attendue avant confirmation à l'utilisateur.

### Compatibilité

Les identifiants techniques historiques `v72`, le modèle `DataStore`, le registre de synchronisation et les chemins OneDrive sont conservés. Aucun backend ni nouvelle permission Graph n'est ajouté.

### Tests exécutés

- `node --check` sur tous les fichiers JavaScript sous `src/` : **PASS** ;
- `node tests/storage-v74-contract.test.mjs` : **PASS** ;
- `node tests/agenda-v74-contract.test.mjs` : **PASS** ;
- `node tests/session-edit-contract.test.mjs` : **PASS** ;
- contrôle statique de l'isolation par clé de stockage compte/type/identifiant : **PASS** ;
- contrôle statique du chiffrement AES-GCM/AAD/empreinte : **PASS** ;
- contrôle statique de la transaction stricte : **PASS**.

### Limitation de validation

Le build Vite n'a pas pu être exécuté dans cet environnement : l'installation des dépendances via `npm ci` n'a pas abouti complètement et `node_modules/.bin/vite` reste absent. Le build de production et le parcours navigateur authentifié Entra/Graph/OneDrive restent donc à exécuter dans le Codespace disposant des dépendances complètes.
