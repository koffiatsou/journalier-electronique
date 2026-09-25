
## V73.0.1 — corrections d’intégration avant présentation — 25 septembre 2026

- **Référentiel V73 réellement utilisé** pour les seuils de convergence (signal, tendance, proposition), au lieu de laisser les seuils uniquement codés dans le runtime.
- **Correction du thème `raisonnement_procedure`** dans les formulations de propositions.
- **Continuité PIA renforcée** : les objectifs existants/repères du dossier élève sont conservés comme `SOURCE_DE_CONTINUITE` et distingués des propositions V73. Le nom du document PIA sélectionné était conservé comme trace. Cette logique a ensuite été supprimée dans V73.1.0 afin de ne pas conserver de métadonnée nominative ou de référence au document source., sans prétendre analyser automatiquement son contenu binaire.
- **Réunion 2 alignée sur les objectifs validés en Réunion 1** : les objectifs validés sont conservés avec leur thème et leur date de validation ; la réévaluation exploite les éléments postérieurs à cette validation et reste à discuter.
- **Validation professionnelle conservée comme seule transition vers `VALIDEE`**.
- **Aucune relation causale Q2–Q6 introduite**.

## V73.1.0 — stabilisation finale de présentation — 25 septembre 2026

### Fonctionnel
- Import local des PIA précédents en Word `.docx` ou PDF `.pdf`.
- Extraction structurée des objectifs, ressources, difficultés, adaptations P/O/M et sections reconnues.
- Export du PIA professionnel en Word ou PDF avec choix du format.
- Export du modèle dé-identifié en Word ou PDF avec choix du format.
- Remplacement des accès rapides de l’accueil par tendances descriptives, suivi PIA et mémos personnels.
- Mémos personnels persistés dans le DataStore local chiffré.

### Sécurité
- Le document PIA original et son nom de fichier ne sont pas conservés après import.
- Limites de taille et de décompression pour les documents importés.
- Dé-identification renforcée des exports : identifiants, dates de preuve, identifiants de séances et métadonnées de génération retirés.
- Aucune nouvelle permission Graph ni aucun nouveau backend.
- La CSP existante reste inchangée car V73.1 est livré dans le module externe déjà couvert par `script-src 'self'`.

### Validation
- Vérification syntaxique du runtime V73.1.
- Vérification des hashes CSP contre `index.html` : correspondance exacte.
- Tests locaux des générateurs Word/PDF et de la lecture PDF textuelle, y compris flux PDF compressé.
- Build Vite à exécuter dans le Codespace avant le prochain PR ; l’environnement d’audit hors Codespace ne dispose pas des dépendances installées.

# Changelog

## V73.1.3 — correction migration legacy — 25 septembre 2026

### Correction
- Correction de l'erreur `graphGetAppRoot is not defined` rencontrée lors de l'ouverture de l'espace sécurisé de migration.
- Ajout d'un `JournalierMigrationBridge` explicite entre le script principal et `src/v73/v73-migration.js`.
- Les dépendances de migration sont désormais limitées aux fonctions Graph, validateurs, normaliseurs, DataStore, sécurité et synchronisation V72 effectivement nécessaires.
- `msAccount` est lu dynamiquement via un getter afin de refléter l'identité connectée après authentification.

### Migration
- Conservation du `studentId` historique.
- Remplacement du propriétaire technique par l'identité du compte connecté.
- Détection des conflits avant import.
- Conservation de `Journalier-legacy` et absence de suppression distante.
- Aucune nouvelle permission Graph.

### Sécurité / validation
- Mise à jour du hash CSP correspondant au script inline modifié.
- Contrôle de cohérence du nombre de scripts inline et des hashes CSP à refaire après chaque modification future de `index.html`.



Historique synthétique des évolutions importantes du Journalier électronique.

Ce document privilégie les changements fonctionnels, architecturaux et de sécurité qui permettent de comprendre l'évolution du projet. Il ne cherche pas à reproduire chaque commit Git.

---

## [V73 — 24 septembre 2026] — Préparation présentation

### Fonctionnel

- Ajout du cycle annuel de PIA : construction/réévaluation en réunion 1 (décembre) puis réévaluation en fin d’année.
- Conservation du PIA précédent comme `SOURCE_DE_CONTINUITE` lorsqu’il existe.
- Prise en compte des séances `SEANCE` comme source des observations ; les champs structurés Q2→Q6 et les précisions textuelles sont exploités.
- Génération de propositions de difficultés, ressources, objectifs et aménagements P/O/M à partir des éléments documentés.
- Les propositions restent explicitement à valider par le professionnel ; une proposition n’est jamais considérée comme une validation automatique.
- Ajout de la traçabilité des séances et des états de convergence dans le PIA généré.
- Ajout des exports PIA professionnel JSON, PIA imprimable HTML et modèle PIA dé-identifié JSON.
- Enregistrement du PIA dans le DataStore existant et tentative de sauvegarde distante via le mécanisme OneDrive existant.

### Pédagogie / règles d’interprétation

- Le moteur conserve la distinction entre objectif de leçon, objectif professionnel de séance et objectif PIA annuel.
- Les rapprochements entre Q2–Q6 sont documentaires : aucune causalité n’est affirmée automatiquement.
- La continuité avec un PIA précédent ne constitue pas une validation de son contenu.
- Les états de convergence utilisés par V73 restent explicables (`OBSERVATION`, `SIGNAL`, `TENDANCE`, `TENDANCE_QUALIFIEE`, `PROPOSITION`).
- Les contre-évidences et le contexte des séances sont conservés dans la trace de génération.

### Sécurité / architecture

- V73 reste une extension frontend de l’architecture V72 : SPA statique, Entra ID, Microsoft Graph, IndexedDB/DataStore et OneDrive AppFolder.
- Aucun backend, serveur de données central ou nouvelle permission Graph n’est introduit par V73.
- Le moteur V73 ne lit ni n’écrit directement IndexedDB ou Graph : il passe par les mécanismes existants du Journalier.
- La documentation d’architecture et de sécurité est mise à jour pour intégrer V73 et rappeler les contrôles à reprendre à chaque évolution.

### Validation / limites

- Le moteur V73 est intégré au projet pour la présentation et l’usage terrain.
- Les contrôles conceptuels du corpus V73 servent de garde-fous de conception ; ils ne remplacent pas une validation NLP exhaustive sur des données réelles.
- La validation terrain avec de vraies séances reste prévue dans le cycle réel, notamment avant la réunion de décembre.

---

## [Non publié]

Travaux documentaires et de sécurité intégrés dans la présente mise à jour.

### Documentation

- Création de `ARCHITECTURE.md` comme référence technique détaillée.
- Création de `SECURITY.md` pour documenter les mécanismes de sécurité, les contrôles effectués et les limites connues.
- Refonte du `README.md` afin de refléter l'architecture actuelle plutôt que les anciennes versions de test.
- Mise en place d'une documentation distinguant explicitement l'état actuel, les éléments à maintenir et les évolutions futures.

### Sécurité

- Configuration de Dependabot Alerts et Dependabot Security Updates.
- Configuration de Dependabot Version Updates pour npm et les GitHub Actions, avec une fréquence hebdomadaire.
- Activation de CodeQL / Code scanning pour JavaScript/TypeScript et GitHub Actions.
- Première analyse CodeQL terminée sans alerte.
- Vérification du mécanisme de rapprochement entre prévisionnel et séance réelle via `getEncodedForEvent()`.

---

## 2026-09 — Sécurisation du dépôt et documentation

### Architecture et synchronisation

- Stabilisation de l'architecture local-first avec Microsoft Entra ID, IndexedDB et synchronisation contrôlée vers l'AppFolder OneDrive.
- Validation du fonctionnement de l'AppFolder avec un test temporaire d'écriture, lecture et suppression.
- Correction de la lecture des fichiers Graph dans le navigateur en utilisant `@microsoft.graph.downloadUrl` plutôt qu'un appel direct à `/content` avec le jeton d'autorisation.
- Ajout d'une validation des URL de téléchargement Graph afin de limiter les domaines acceptés.
- Ajout de la gestion de la pagination Microsoft Graph via `@odata.nextLink`.
- Renforcement de la validation des données de synchronisation et de la gestion des ETags/conflits.

### Vite et build

- Mise à niveau de Vite vers `8.3.0`.
- Vérification de `npm ci`.
- Vérification du build de production après la mise à niveau.
- Ajout d'un workflow CI exécutant le build lors des Pull Requests vers `main`.

### GitHub et chaîne de déploiement

- Mise en place d'un Ruleset de protection de `main`.
- Obligation d'un Pull Request avant fusion.
- Obligation du contrôle CI `build` avant fusion.
- Blocage des force pushes et restriction des suppressions sur `main`.
- Référencement des GitHub Actions utilisées par leur SHA complet.
- Vérification du fonctionnement du déploiement GitHub Pages après le SHA pinning.
- Vérification de GitHub Secret Scanning.
- Audit de l'historique Git à la recherche de secrets ou d'anciennes configurations sensibles.
- Aucun secret exploitable n'a été identifié lors des contrôles effectués.

- Activation de Dependabot Alerts et Dependabot Security Updates.
- Configuration des mises à jour hebdomadaires Dependabot pour npm et les GitHub Actions.
- Activation de CodeQL / Code scanning.
- Première analyse CodeQL terminée sans alerte.
- Validation du rapprochement prévisionnel → séance réelle via `getEncodedForEvent()`.

---

## 2026-07 à 2026-09 — Évolution du Journalier V72

### Microsoft Entra ID et Microsoft Graph

- Poursuite de l'intégration Microsoft Entra ID déjà utilisée par l'application.
- Utilisation de Microsoft Graph avec la permission `Files.ReadWrite.AppFolder`.
- Mise en place de l'organisation des données dans l'AppFolder :
  - `profil/`
  - `eleves/`
  - `agenda/`
  - `system/`
- Séparation de la couche de synchronisation du modèle pédagogique.
- Mise en place d'un registre de synchronisation et de mécanismes de comparaison entre données locales et distantes.
- Gestion des modifications locales, des modifications distantes et des conflits.
- Mise en place d'un diagnostic de synchronisation permettant de comparer l'état local et distant sans effectuer d'écriture distante.

### Données locales et sécurité

- Utilisation d'IndexedDB pour le stockage local.
- Chiffrement local des données avec AES-GCM.
- Isolation du stockage local par identité Entra.
- Mise en place de validations de structure et de propriété des données avant synchronisation.
- Renforcement de la Content Security Policy.
- Mise en place de protections contre certaines injections HTML/XSS.

### PIA

- Intégration d'un traitement du PIA réalisé localement dans le navigateur.
- Ajout d'une information utilisateur précisant que le document original n'est pas transmis automatiquement pendant l'analyse locale.

---

## 2026 — V72 et évolution fonctionnelle

Le projet a évolué vers une version V72 intégrant progressivement :

- agenda et organisation des séances ;
- gestion des élèves ;
- observations et séances ;
- bibliothèque d'indicateurs et de repères ;
- rapprochement entre observations, matières, objectifs et indicateurs ;
- génération de rapports et de synthèses ;
- mécanismes de suggestions destinés à soutenir le professionnel.

Les fonctions de suggestion sont conçues comme des outils d'appui et ne remplacent pas la décision pédagogique du professionnel.

---

## Versions antérieures

Le dépôt contient également des traces de versions et d'étapes antérieures du projet, notamment V14 et V64.

Ces versions ont servi à construire progressivement :

- l'interface du Journalier ;
- les mécanismes d'observation ;
- l'intégration Microsoft ;
- les premiers essais Microsoft Graph / OneDrive ;
- les modèles de données et de synchronisation.

Les détails de l'historique complet restent disponibles dans Git.

---

## Convention pour les futures entrées

Les évolutions importantes devraient être ajoutées sous une forme courte et factuelle, en distinguant si nécessaire :

- **Ajout** — nouvelle fonctionnalité ;
- **Modification** — évolution d'une fonctionnalité existante ;
- **Correction** — résolution d'un problème ;
- **Sécurité** — amélioration ou contrôle de sécurité ;
- **Documentation** — évolution documentaire ;
- **Infrastructure** — évolution du build, CI/CD ou déploiement.

Les entrées doivent décrire ce qui a réellement été implémenté ou vérifié et éviter de présenter une évolution future comme une fonctionnalité disponible.
