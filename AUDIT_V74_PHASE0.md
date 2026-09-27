# Audit initial V74 — Journalier électronique

Date : 27 septembre 2026
Portée : audit initial mené avant l’implémentation V74. Aucun code applicatif n’a été modifié pendant cette phase d’audit.

## 1. État Git

- Branche : `main`, alignée sur `origin/main`.
- `HEAD` et `origin/main` : `806eb017a7c13cd83e780fc8993e8fc7839f6f21`.
- Modification locale préexistante à préserver dans `index.html` : une ligne dans `v72Classify()` qui retourne `synced` lorsque les fingerprints local et distant sont égaux.
- État initial : `M index.html`, `?? plan_audit_refonte_V74_Codespaces.txt`, `?? ux-extraction.txt`.
- Le diff local initial fait une insertion dans `index.html`; `git diff --check` passe.
- Le build crée `dist/`, ignoré par Git.

## 2. Arborescence observée

- Application : `index.html`, `msal-redirect.html`, `vite.config.js`, `package.json`, `package-lock.json`.
- Modules actifs : `src/msal-bridge.js`, `src/msal-redirect.js`, `src/v73/v73-runtime.js`, `src/v73/v73-migration.js`.
- Données : `public/bibliotheque_indicateurs_v0_5_1.json`, `public/referentiel_pia_v73_0_3.json`.
- Documentation : README, architecture, sécurité, changelog, audits V73, `V73_README.md`, extraction UX et plan V74.
- Automatisation : `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `.github/dependabot.yml`.
- `node_modules/` et `dist/` sont présents localement. Aucun fichier de test nommé selon les motifs test/spec et aucun dossier de tests ne sont présents.

## 3. SHA-256 avant modification

| Fichier | SHA-256 |
|---|---|
| `index.html` (inclut la modification locale connue) | `4b217ced4dabd3e97bc14bc9b9c28a61eef22375bf20d5acce0e697b12ea51a8` |
| `package.json` | `4fc6b701167e1c7927922e8a36673765b0d9d6bf462717b3ce1fed939f9103f1` |
| `package-lock.json` | `6a4d0448a281b649eb5b99237da0e09c91084d7eea20012d4fe93292b622ddb5` |
| `vite.config.js` | `5a7fce0abdf8161a055fea3a870fbfbc85a675e0966a71fcf7556bb71cd34842` |
| `src/v73/v73-runtime.js` | `e828b79363876ee901c45dcc28bc7ddb7973f16c5371d3cead77d2cedcbb297f` |
| `src/v73/v73-migration.js` | `328a2f7cda8bf8b8c53631e70482f95830a1b6f4727eaaa9b4d0a164b449c50d` |
| `src/msal-bridge.js` | `9618b38734efe47e09ed6d450d90574fbdf3466862eb70463b59e4529ae62f79` |
| `src/msal-redirect.js` | `dd55cd29b6a3e564bc83fd309b773a8cc8af78316776883cd37bb2c0e7d227e2` |
| `msal-redirect.html` | `046010b628641a2a5b721d9044405b4ca70124adbb08e34ed767076912370113` |
| `README.md` | `c99d9c47193a4c39af1d3d58974b4ebf10d1921010a3dc8602c7d99720e2c91b` |
| `ARCHITECTURE.md` | `e5f4aca4271b7fd4271fe47be4720ed103a885a3d4955761194b71b4839e61fe` |
| `SECURITY.md` | `66e0e2ef72a41bd6ed000cf421bfad48cfa22be580fded372c0ec62f434b3acc` |
| `CHANGELOG.md` | `11234757afcfcb73bf5ade6f4e49b8b06d8f9c529b4635b1c4688fde3a561c8f` |
| `public/bibliotheque_indicateurs_v0_5_1.json` | `f3708fe89d999b7204fb599836fade716d3e4cab36eab986be38686c315b0d3a` |
| `public/referentiel_pia_v73_0_3.json` | `53be1862eaefed683495f6260ee852a024f2a5de4ecff78ac5fb03ffe336d6f7` |
| `.github/workflows/ci.yml` | `78f955a0ea3f69cbe16ba63fc72166ecce68b84e0e5ba68264390ca13890d43e` |
| `.github/workflows/main.yml` | `9e5223d9755639e54e80a9f17c8062de78cf4979bc1f175c69ff82308e3de7b9` |

La référence `47334f195d32afa6c86f022c071d92a59ab017b4` existe comme objet Git de type commit; son sujet est « Merge pull request #10 … docs/security-baseline ». C’est un identifiant de commit Git, pas un SHA-256 de fichier/archive. L’archive V72.2 associée n’est pas présente dans le dépôt pour comparaison.

## 4. Architecture et flux réels

### Interface et séances

`index.html` contient l’essentiel du HTML, CSS, du code applicatif et des handlers. `showTab('reports')` actualise les sélecteurs puis appelle `loadStudentHistory()`. La liste s’appuie sur `getDB()`, filtre `isJournalSession()`, et affiche date, matière, période, objectifs et éléments Q2–Q6. `editHistorySession()` remplit le formulaire canonique; `deleteHistorySession()` passe par `saveDB()` et confirme l’action. Le stockage des séances n’a pas à être réécrit.

### Rapports

| DOM / handler | Lecteur/écrivain | Fonction et risque |
|---|---|---|
| `r-eleve`, `h53` | élève sélectionné → `student-history-list` | `loadStudentHistory()`; appels d’édition/suppression délégués aux fonctions existantes. |
| `r-date-anchor`, `h54` | écrit aussi `selectedDateISO` | `renderAgenda()`; couplage à l’agenda à séparer de la période de synthèse. |
| `r-periode`, `h55` | sélection et date globale | `generateReport()` → `getReportRange()` → moteur existant; période libre à introduire sans supprimer HEBDO/MENSUEL/PV avant analyse de leurs consommateurs. |
| `report-output-box`, `report-text` | rendu HTML échappé | `reportSessionEvidence()` → `reportExtractUnits()` → `reportRelations()` → hiérarchie, liens, comparaisons et rapport PV. |

Les fonctions `reportBuildHierarchy`, `reportLinkedSynthesis`, `reportCompareLinkedChains`, `reportIntegrationReport` et `reportIntegrationPIA` ont des consommateurs actifs dans `generateReport()`. Le moteur rappelle expressément que les relations Q2–Q6 sont documentaires et non causales.

### Stockage, Entra, Graph et OneDrive

`initMicrosoftAuth()` utilise MSAL Browser; les scopes sont `openid`, `profile`, `Files.ReadWrite.AppFolder`. `JournalierSecurity` associe le stockage à l’identité Entra, chiffre l’état avec AES-GCM dans IndexedDB et garde la clé CryptoKey non extractible dans IndexedDB. `DataStore` expose lectures/écritures locales et marque les changements pour le `SyncManager`.

Le flux cloud est MSAL → acquisition silencieuse/popup du token → `graphRequest()` → Microsoft Graph `/me/drive/special/approot` → `Journalier/` dans l’AppFolder. La synchronisation compare les fingerprints, utilise les ETags/If-Match et bloque l’écriture automatique en cas de conflit. Le contrôle de permissions observé est minimal (`Files.ReadWrite.AppFolder`); aucun secret client n’est embarqué.

### Migration

`src/v73/v73-migration.js` passe par `window.JournalierMigrationBridge` pour Graph, validateurs, normaliseurs, DataStore et fonctions de sync. La migration valide et normalise les données, bloque les conflits et ne supprime pas la copie legacy.

### PIA

`src/v73/v73-runtime.js` charge le référentiel, lit les séances via `window.JournalierDataStore`, calcule convergences/domaines/propositions, puis rend le projet. Les PIA locaux sont stockés dans `state.meta.piaRecords[studentId]`; la sauvegarde distante écrit `Journalier/pia/{studentId}/pia.json`.

Constats de cycle : `ACTIF` est affiché « PIA annuel validé »; la validation de décembre passe à `ACTIF`; la réévaluation passe à `EN_REEVALUATION`; aucun état de finalisation annuelle n’est implémenté. Les réunions sont aujourd’hui des objets partiels `meeting1`/`meeting2`, sans formulaire structuré participants/retours/décisions. Le PIA distant est sauvegardé mais n’est pas chargé par `hydrateMicrosoftDataIfLocalEmpty()`, qui hydrate profils, séances et agenda uniquement.

### JSON et référentiels

- `bibliotheque_indicateurs_v0_5_1.json` est chargé par `index.html` pour les indicateurs Q3.
- `referentiel_pia_v73_0_3.json` est chargé par `v73-runtime.js` pour les seuils et principes du moteur PIA.
- Aucun corpus de stress tests ou suite automatisée distincte n’a été trouvé. Le référentiel contient des mentions de tests conceptuels/corpus à calibrer, qui ne constituent pas une exécution de tests du moteur réel.

## 5. Sécurité, CI et documentation

- `script-src` interdit `unsafe-inline` et autorise trois hashes inline; les styles ont `unsafe-inline`.
- Sur `HEAD`, les trois scripts inline concordent avec la CSP. Dans l’état local, le troisième hash calculé est `P0E/pA2Id7ekxmXEsz56+wgw7uMe/NcNRwT/4pIceIE=`, tandis que la CSP attend `2VXoqkGo/SnASYZTjVZiVP4KwV4Lw7ZSmqgOUESRh/I=`. La modification locale de `v72Classify()` est dans ce script: CSP peut donc bloquer le script applicatif complet. À recalculer après chaque modification du script inline.
- Les lectures Graph emploient l’URL `@microsoft.graph.downloadUrl`, HTTPS et une liste de domaines permis; les JSON distants passent par des validateurs; la pagination contrôle `@odata.nextLink`.
- CI et déploiement utilisent Node 22, `npm ci`, build Vite; les Actions sont référencées par SHA complet. Dependabot couvre npm et GitHub Actions. Aucun workflow CodeQL n’est présent; l’activation éventuelle dans les paramètres GitHub n’est pas vérifiable depuis les fichiers du dépôt.
- `package.json` ne définit que `dev`, `build`, `preview`. Aucun script de tests n’est disponible.
- Écart documentaire : le début de `ARCHITECTURE.md` présente une arborescence partielle V72 sans le référentiel PIA ni les deux modules V73; des sections ultérieures décrivent V73. Les documents d’audit disent que la CSP est valide après intégration, ce qui est vrai pour `HEAD`, mais plus pour l’état local courant.

## 6. Contrôles de référence

- `npm run build` : PASS (Vite 8.3.0, 170 modules).
- `node --check` sur les quatre modules JS : PASS.
- `git diff --check` : PASS.
- Contrôle CSP inline : PASS sur `HEAD`, échec confirmé sur le script inline local modifié.
- Tests fonctionnels navigateur, Entra, Graph, OneDrive et migration : non exécutés; ils nécessitent un navigateur authentifié et des données de test adaptées.

## 7. Risques et plan V74

Fichiers à protéger : DataStore/IndexedDB, MSAL, Graph, SyncManager, migration, JSON et référentiels, moteur de convergence et moteur de synthèse. Fichiers de travail probablement nécessaires : `index.html` et `src/v73/v73-runtime.js`; la documentation sera mise à jour après le comportement final.

Risques prioritaires : CSP décalée par la modification locale; export PIA dé-identifié qui conserve les dates dans `traceability.states`; liaison agenda/date de rapport; compatibilité des enregistrements `ACTIF` existants lors du nouveau vocabulaire de cycle; PIA cloud non réhydraté; tests métier absents.

Plan technique autorisé :
1. Réaligner le hash CSP sans retirer la modification locale; vérifier immédiatement le hash, puis le build.
2. Structurer l’espace Rapports sans toucher au stockage : période libre indépendante de `selectedDateISO`, aperçu/complet, préparation de réunion dérivée des mêmes preuves, exports centralisés et Data List conservant les commandes historiques.
3. Compléter le rendu PIA en vue des cinq domaines, accordéons et cartes de propositions; toute édition/validation/refus reste explicite et traçable.
4. Ajouter les réunions structurées et le suivi à l’objet PIA annuel existant, préserver la compatibilité `ACTIF` et introduire un état finalisé sans créer deux PIA annuels.
5. Assainir l’export dé-identifié, puis mettre à jour la documentation utile.
6. Après chaque phase : build, `git diff --check`, syntaxe JS pertinente, statut/diff; en fin de tâche, recalculer tous les hashes et vérifier que seuls les fichiers prévus ont changé.

## 8. Décision

**GO conditionnel** pour les phases UX V74, avec séparation stricte du code métier existant. Le premier changement doit corriger le hash CSP rendu invalide par la ligne locale connue, en la conservant. Aucun changement de permission Graph, de modèle de stockage des séances ou de mécanisme de migration n’est justifié par l’audit.

## 9. Résultat de l’implémentation V74

### Modifications

- `index.html` : navigation interne des quatre espaces Rapports, synthèse à période libre avec dates début/fin et modes aperçu/complet, préparation dérivée des mêmes preuves, export centralisé avec choix Word/PDF pour séances, synthèses et réunions, historique Data List avec résumés Q2–Q6 toujours visibles. Les actions Modifier/Supprimer restent les fonctions historiques.
- `index.html` : événements hebdomadaires positionnés sur leur `grid-row` propre avec span inclusif; périodes occupées n’affichent plus `+ Ajouter`, et les chevauchements utilisent des voies de largeur locale.
- `src/v73/v73-runtime.js` : montage PIA dans sa section dédiée; vue des cinq domaines et accordéons éditables (ressources, besoins, objectifs, critères, moyens, évolution); cartes de propositions avec provenance/contributeurs et décisions professionnelles; réunions structurées; suivi annuel; cycle `EN_CONSTRUCTION` → `EN_VIGUEUR` → `EN_REEVALUATION` → `EN_VIGUEUR` → `FINALISE`; continuité du PIA précédent lors du changement d’année; exports professionnels enrichis et dé-identification récursive renforcée.
- `vite.config.js` : allowlist Vite limitée à `${CODESPACE_NAME}-8000.app.github.dev` dans Codespaces; aucun wildcard.
- `index.html` contient toujours la modification locale SyncManager initiale dans `v72Classify()`; elle n’a pas été supprimée.
- Fichier ajouté : `AUDIT_V74_PHASE0.md` (présent rapport). Aucun fichier supprimé pendant l’implémentation V74.
- Aucun changement apporté à DataStore, IndexedDB, Graph, migration, permissions, référentiels ou workflows.

### Calendrier scolaire

Règle implémentée : dernière semaine complète lundi–dimanche d’août; fermeture le vendredi de la semaine contenant le 1er juillet. Cela reproduit les bornes préexistantes pour 2026–2027 : `2026-08-24` à `2027-07-02`. Exemple suivant : `2027-08-23` à `2028-06-30`. Une date hors de ces bornes n’est associée à aucune année scolaire et ne peut pas générer un PIA.

### Validations après modification

- `npm run build` : PASS (170 modules).
- `node --check src/v73/v73-runtime.js` : PASS.
- Export Rapports séances/synthèse/réunion en DOCX et PDF : mêmes générateurs que l’export PIA; aucune sortie CSV/TXT dans le parcours.
- Agenda multi-périodes : spans 3e→3e = 1, 3e→4e = 2, 3e→5e = 3, 6e→7e = 2; placement grid-row et suppression des créneaux libres couverts : PASS.
- `git diff --check` : PASS.
- CSP : les trois scripts inline correspondent exactement aux trois hashes autorisés; `unsafe-inline` n’a pas été ajouté à `script-src`.
- Test ciblé des bornes/années scolaires : PASS, incluant les limites exactes et les dates hors cycle.
- Test ciblé de dé-identification sur identité, établissement, classe, dates ISO/localisées, IDs séance et notes : PASS.
- Requête locale avec le Host du Codespace : HTTP 200.
- Diagnostics VS Code sur `index.html` et `src/v73/v73-runtime.js` : aucune erreur.
- Test manuel de l’utilisateur : différents menus parcourus et signalés fonctionnels avant la dernière correction du span agenda. Le rendu agenda modifié n’a pas été vérifié visuellement dans le navigateur; seuls son build et le smoke test des spans sont validés.
- Parcours navigateur authentifié Entra/Graph/OneDrive ignoré à la demande. La connexion via Codespaces nécessite l’URI de callback exacte dans l’enregistrement Entra comme SPA. Aucun test avec données d’élèves réelles; migration réelle non testée. Le dépôt ne contient pas de suite automatisée.

### Hashes finaux SHA-256

| Fichier | SHA-256 après |
|---|---|
| `index.html` | `d665f2158ee4b4aca954d13ce517b2a0c3eb07a778d7cb67057c7e2af1fe39a4` |
| `package.json` | `4fc6b701167e1c7927922e8a36673765b0d9d6bf462717b3ce1fed939f9103f1` |
| `package-lock.json` | `6a4d0448a281b649eb5b99237da0e09c91084d7eea20012d4fe93292b622ddb5` |
| `vite.config.js` | `e1b0cea455829118b6403fcbe63a16a6ab5fe07a284888ca9fc22d2e13115f2d` |
| `src/v73/v73-runtime.js` | `da4146353f7f16e22f5c75eb0e6156eec6f9b65141f0a7537e2f7f93478d7865` |
| `src/v73/v73-migration.js` | `328a2f7cda8bf8b8c53631e70482f95830a1b6f4727eaaa9b4d0a164b449c50d` |
| `src/msal-bridge.js` | `9618b38734efe47e09ed6d450d90574fbdf3466862eb70463b59e4529ae62f79` |
| `src/msal-redirect.js` | `dd55cd29b6a3e564bc83fd309b773a8cc8af78316776883cd37bb2c0e7d227e2` |
| `msal-redirect.html` | `046010b628641a2a5b721d9044405b4ca70124adbb08e34ed767076912370113` |
| `README.md` | `c99d9c47193a4c39af1d3d58974b4ebf10d1921010a3dc8602c7d99720e2c91b` |
| `ARCHITECTURE.md` | `e5f4aca4271b7fd4271fe47be4720ed103a885a3d4955761194b71b4839e61fe` |
| `SECURITY.md` | `66e0e2ef72a41bd6ed000cf421bfad48cfa22be580fded372c0ec62f434b3acc` |
| `CHANGELOG.md` | `11234757afcfcb73bf5ade6f4e49b8b06d8f9c529b4635b1c4688fde3a561c8f` |
| `public/bibliotheque_indicateurs_v0_5_1.json` | `f3708fe89d999b7204fb599836fade716d3e4cab36eab986be38686c315b0d3a` |
| `public/referentiel_pia_v73_0_3.json` | `53be1862eaefed683495f6260ee852a024f2a5de4ecff78ac5fb03ffe336d6f7` |
| `.github/workflows/ci.yml` | `78f955a0ea3f69cbe16ba63fc72166ecce68b84e0e5ba68264390ca13890d43e` |
| `.github/workflows/main.yml` | `9e5223d9755639e54e80a9f17c8062de78cf4979bc1f175c69ff82308e3de7b9` |

Limite conservée de l’architecture existante : le PIA est sauvegardé sous `Journalier/pia/{studentId}/pia.json`, mais le processus actuel d’hydratation OneDrive ne recharge pas ces fichiers PIA. La présente refonte ne change pas cette chaîne Graph; la restauration PIA multi-appareil reste à traiter séparément. Pour tester l’authentification Codespaces, enregistrer dans Entra comme redirect URI de plateforme SPA : `https://crispy-space-goldfish-4qvg654gq79rf7jwx-8000.app.github.dev/journalier-electronique/msal-redirect.html`. Garder le port Codespaces privé et utiliser un compte/dossier de test dédié; supprimer cette URI après les essais si elle n’est plus requise.

## 10. Audit documentaire et nettoyage

- README, architecture, sécurité et changelog mis à jour pour décrire V74, l’arborescence active, les deux référentiels et les limites des validations.
- Suppression de `V73_README.md`, des trois audits V73 redondants, du plan V74 achevé et de l’extraction UX devenue inutile.
- `AUDIT_V74_PHASE0.md` conservé comme rapport technique détaillé.
- Aucun module applicatif, référentiel JSON, workflow ou fichier avec modification locale préexistante n’a été supprimé ou modifié par ce nettoyage.
- `npm run build` : PASS après les changements documentaires.
- `git diff --check` : PASS sur les changements suivis et le présent rapport.

## 11. Refonte visuelle Rapports & PIA

### Modifications
- `index.html` : shell Rapports avec quatre tabs accessibles (Synthèse, Historique, Réunion, PIA annuel), sélection d’élève et période des séances contextualisées dans l’en-tête, exports regroupés dans une action secondaire.
- `index.html` : période hebdomadaire, mensuelle, personnalisée et PV conservée; export brut des séances limité à la période choisie.
- `index.html` : historique en Data List avec aperçu Q2–Q6 compact, détail repliable, recherche, filtre matière, chargement par lots de 15 et suppression dans le menu secondaire.
- `index.html` : synthèse, historique et préparation de réunion isolés en vues exclusives; la préparation reste fondée sur la synthèse existante.
- `index.html` et `src/v73/v73-runtime.js` : sélecteur PIA synchronisé au contexte élève partagé; quatre sous-vues PIA accessibles (domaines, propositions, réunions, suivi annuel), état de vue conservé après sauvegarde et exports PIA accessibles depuis le menu commun.
- Aucun changement apporté au DataStore, au schéma des séances, à l’authentification, à Graph, à OneDrive ou aux permissions. Aucun fichier ajouté ou supprimé par cette phase; les changements locaux préexistants à `vite.config.js` ont été préservés.

### Hashes SHA-256

| Fichier | Avant | Après |
|---|---|---|
| `index.html` | `d665f2158ee4b4aca954d13ce517b2a0c3eb07a778d7cb67057c7e2af1fe39a4` | `7e5c2dd1ba9580a40a77b0363e6ec00512e75050e383b3648ad5e105c1f5d685` |
| `src/v73/v73-runtime.js` | `da4146353f7f16e22f5c75eb0e6156eec6f9b65141f0a7537e2f7f93478d7865` | `a95fa099931e75ebf23b53d4116e49294d4fa9316fd58137b8725804a514a13d` |

### Validation et limites
- `npm run build` : PASS (170 modules).
- `node --check src/v73/v73-runtime.js`, diagnostics VS Code et `git diff --check` : PASS.
- Trois hashes CSP : correspondance exacte; aucune directive élargie.
- Contrôle statique : quatre tabs, quatre panels, IDs statiques uniques.
- Serveur Vite local : HTTP 200 sur `http://localhost:8000/journalier-electronique/`.
- Aucun navigateur Chromium/Playwright disponible dans le Codespace; capture desktop/mobile et parcours interactifs authentifiés Entra/Graph non exécutés.

## 12. Intégration visuelle maître-détail et domaines PIA

### Modifications
- `index.html` : historique maître-détail; chaque ligne montre date, matière, objectif et jusqu’à deux signaux enregistrés. Le détail sélectionné affiche Q2–Q6, effets saisis et repère WBE si présents. Les actions historiques Modifier/Supprimer sont conservées.
- `index.html` : panneau détail transformé en vue secondaire mobile avec retour à la liste; recherche, matière et chargement par lots restent actifs.
- `index.html` : synthèse générée isolée de ses contrôles, vue d’ensemble mise en relief sans transformer toutes les sections en cartes.
- `index.html` : préparation de réunion dotée d’une action de génération et d’un accès à la saisie réelle dans le même PIA annuel.
- `src/v73/v73-runtime.js` : grille des domaines auto-adaptative; sélection d’un domaine ouvre un seul détail maître-détail avec accordéons éditables pour les rubriques déjà stockées. La sélection du domaine et de la sous-vue est conservée au rerendu.
- Le DataStore, le modèle de séance, les permissions et les mécanismes Graph/OneDrive n’ont pas été modifiés. Les modifications V74 locales préexistantes ont été conservées.

### Hashes SHA-256

| Fichier | Avant cette phase | Après cette phase |
|---|---|---|
| `index.html` | `7e5c2dd1ba9580a40a77b0363e6ec00512e75050e383b3648ad5e105c1f5d685` | `42712f9607c60346bbba91221359e4702f6fe961797010481929a7d09f6c0e2f` |
| `src/v73/v73-runtime.js` | `a95fa099931e75ebf23b53d4116e49294d4fa9316fd58137b8725804a514a13d` | `1a720f17fc783ae58e742a73c60c526edf54149d39d27e8ace41460e8b62dfab` |

### Validations et limites
- `npm run build` : PASS; `node --check src/v73/v73-runtime.js` : PASS; diagnostics VS Code : aucune erreur; `git diff --check` : PASS.
- Les trois hashes CSP correspondent exactement aux scripts inline; aucune directive élargie.
- Serveur Vite : HTTP 200 sur `http://localhost:8000/journalier-electronique/`.
- Le Codespace ne dispose pas de Chromium/Playwright : le rendu réel desktop/mobile et les parcours authentifiés restent à vérifier dans le navigateur.

## 13. Style Rapports & PIA et niveaux de séance

### Modifications
- `index.html` : panneaux internes légers et accents colorés distincts pour les familles de synthèse et de préparation de réunion.
- `src/v73/v73-runtime.js` : fonds différenciés par domaine PIA et badges/fonds sémantiques pour les propositions à examiner, validées et refusées.
- `index.html` : niveau Q2 explicité pour chaque observation dans le détail historique et associé directement aux signaux de la liste.
- `index.html` : effets Q4 traduits en « Aucun effet », « Effet partiel » ou « Effet positif » dans le détail et l’export des séances.
- Aucune donnée ou règle d’analyse n’a été modifiée; le rendu utilise les valeurs déjà enregistrées.

### Hashes SHA-256

| Fichier | Avant cette phase | Après cette phase |
|---|---|---|
| `index.html` | `42712f9607c60346bbba91221359e4702f6fe961797010481929a7d09f6c0e2f` | `f8deeadb28c062177eb280b1a64507d437efe6aff3c753da43e81f6ca692fe0f` |
| `src/v73/v73-runtime.js` | `1a720f17fc783ae58e742a73c60c526edf54149d39d27e8ace41460e8b62dfab` | `f0b6e47eb8bc6b479aee4a058535d1e3fb3f3f1daa46e0580f8807e4920e3bf9` |

### Validation et limites
- `npm run build`, `node --check src/v73/v73-runtime.js`, diagnostics VS Code et `git diff --check` : PASS.
- Trois hashes CSP : correspondance exacte, sans changement de directive.
- Serveur local : HTTP 200.
- Les captures desktop/mobile et parcours authentifiés restent à valider visuellement dans le navigateur.

## 14. Conteneurs visuels Rapports/PIA et niveaux historiques

### Modifications
- `index.html` : signaux de liste différenciant visuellement leur type (Observation, Adaptation, Transfert); détail organisé en conteneurs colorés par famille.
- `index.html` : chaque observation Q2 du détail et de la liste porte son niveau réellement encodé. Les effets Q4 utilisent « Aucun effet », « Effet partiel » et « Effet positif » dans le détail et l’export.
- `src/v73/v73-runtime.js` : cartes des domaines agrandies, grille passant de cinq à trois, deux puis une colonne selon la largeur, symbole SVG thématique pour chaque domaine.
- Les valeurs affichées proviennent des données et états existants; aucun stockage ni moteur de décision n’est modifié.

### Hashes SHA-256

| Fichier | Après cette phase |
|---|---|
| `index.html` | `06c4cc47135eba86cc5ae43b3224b052a5e10c7ccd887d53ca2d2cc5bd31543b` |
| `src/v73/v73-runtime.js` | `bdbfe99adc84c9dad25824a054470fd744b92e09a748f81c0046d0e5a4770e6b` |

### Validation et limites
- `npm run build` : PASS; diagnostics VS Code : aucune erreur; `git diff --check` : PASS.
- Les trois hashes CSP inline correspondent exactement; aucune directive de sécurité n’a été élargie.
- Serveur local : HTTP 200. Les captures desktop/mobile automatisées restent indisponibles faute de Chromium/Playwright.

## 15. Harmonisation des propositions et du menu Export

### Modifications
- `index.html` : quand Exporter est ouvert, l’en-tête crée un contexte d’empilement prioritaire; le panneau a une hauteur maximale et reste défilable. Le menu se ferme au clic extérieur ou avec Échap.
- `index.html` : niveau Q2 de chaque signal affiché dans une pastille distincte; l’étiquette et le texte sont mieux différenciés.
- `src/v73/v73-runtime.js` : les cartes Proposition conservent leur taille et leur état, mais utilisent une surface neutre, un liseré coloré et un badge, au lieu d’un grand fond coloré.
- Aucun changement de données ou de logique de décision.

### Hashes SHA-256

| Fichier | Avant cette phase | Après cette phase |
|---|---|---|
| `index.html` | `06c4cc47135eba86cc5ae43b3224b052a5e10c7ccd887d53ca2d2cc5bd31543b` | `eee71297e1d0111d9d1633f0fffdb31f0522f410d02bcc1a7c2b3dcd8580d261` |
| `src/v73/v73-runtime.js` | `bdbfe99adc84c9dad25824a054470fd744b92e09a748f81c0046d0e5a4770e6b` | `f776fb113dc7858c0c60c4cba26316205572c9259c6d60d2c39d73be893c54f1` |

### Validations et limites
- `npm run build`, diagnostics VS Code, `node --check src/v73/v73-runtime.js` et `git diff --check` : PASS.
- Hashes CSP des trois scripts inline : correspondance exacte.
- Aperçu Vite : HTTP 200. La capture navigateur automatisée n’est pas disponible dans cet environnement.
