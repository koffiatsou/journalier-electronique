# Changelog

Historique synthétique des évolutions importantes du Journalier électronique.

Ce document privilégie les changements fonctionnels, architecturaux et de sécurité qui permettent de comprendre l'évolution du projet. Il ne cherche pas à reproduire chaque commit Git.

---

## [Non publié]

Travaux documentaires et de sécurité en cours.

### Documentation

- Création de `ARCHITECTURE.md` comme référence technique détaillée.
- Création de `SECURITY.md` pour documenter les mécanismes de sécurité, les contrôles effectués et les limites connues.
- Refonte du `README.md` afin de refléter l'architecture actuelle plutôt que les anciennes versions de test.
- Mise en place d'une documentation distinguant explicitement l'état actuel, les éléments à maintenir et les évolutions futures.

### Sécurité

- Préparation de l'audit et de la configuration des mécanismes de sécurité des dépendances et du dépôt.

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
