# Journalier électronique

> Application web destinée à soutenir le travail d'accompagnement et d'observation pédagogique du Pôle territorial WBE.

Le Journalier électronique permet d'organiser les observations, séances, élèves et agendas, d'exploiter une bibliothèque d'indicateurs et de repères, et de produire des éléments utiles au suivi pédagogique.

L'application est conçue selon une approche **local-first** : les données de travail sont d'abord gérées localement dans le navigateur, puis synchronisées explicitement vers l'espace OneDrive de l'utilisateur via Microsoft Graph.

---

## 1. Objectifs

Le projet vise notamment à permettre :

- l'encodage structuré des observations et séances ;
- la gestion des élèves et de leurs informations de suivi ;
- la gestion d'un agenda de travail ;
- l'exploitation de repères et indicateurs WBE ;
- l'import local de PIA précédents au format Word (`.docx`) ou PDF (`.pdf`) sans transmettre ni conserver le document original ;
- la génération de rapports et de synthèses ;
- un tableau de bord d’accueil avec tendances descriptives, suivi PIA et mémos personnels ;
- la conservation locale chiffrée des données ;
- la synchronisation contrôlée des données vers OneDrive ;
- la détection des conflits lors des synchronisations.

L'application doit rester un **outil d'appui au professionnel**. Les suggestions produites par le système ne constituent pas automatiquement des décisions pédagogiques.

---

## V73.1.3 — migration sécurisée des anciennes données

La V73.1.3 corrige l'intégration du module de migration legacy avec le code Graph/DataStore existant.

### Migration des données historiques

La migration est volontairement **contrôlée et non destructive** :

1. l'ancien dossier `Mes fichiers/Journalier` n'est pas lu directement par l'application ;
2. l'utilisateur copie manuellement ce dossier dans l'AppFolder ;
3. la copie est renommée `Journalier-legacy` ;
4. Journalier analyse cette copie ;
5. les profils, séances et l'agenda sont validés et normalisés ;
6. les conflits avec les données déjà présentes sont bloquants ;
7. les données validées sont importées dans `Journalier/` ;
8. la copie `Journalier-legacy` et le dossier original ne sont pas supprimés.

La migration ne demande **aucune permission Graph supplémentaire**. Elle reste limitée à `Files.ReadWrite.AppFolder`.

Le module de migration utilise un pont explicite (`JournalierMigrationBridge`) pour accéder uniquement aux fonctions V72 nécessaires. Ce pont évite de dépendre directement du scope privé du script principal.

## V73 — PIA annuel et synthèse des séances

La V73 ajoute une couche de synthèse PIA directement dans l’application sans modifier l’architecture de stockage et de synchronisation existante.

### Cycle PIA

- **Réunion 1 — décembre** : réévaluation du PIA précédent lorsqu’il existe, ou construction d’un premier projet lorsqu’il n’existe pas.
- Les objectifs déjà présents peuvent être maintenus, reformulés, ajustés, remplacés ou complétés ; V73 ne choisit pas à la place du professionnel.
- **Pendant l’année** : les séances alimentent les éléments de preuve et les évolutions observées.
- **Réunion 2 — fin d’année** : réévaluation des objectifs à partir des nouvelles séances et définition des suites.

### Sources exploitées

Les observations de classe proviennent des **séances**. V73 exploite les données structurées Q2→Q6 ainsi que les champs `precision` et les autres textes renseignés. Les objectifs de leçon restent du contexte de séance et ne deviennent pas automatiquement des objectifs PIA.

### États de synthèse

V73 utilise des états explicables : `OBSERVATION`, `SIGNAL`, `TENDANCE`, `TENDANCE_QUALIFIEE` et `PROPOSITION`. Une `PROPOSITION` doit être validée par le professionnel pour devenir un élément du PIA annuel.

Les rapprochements entre Q2, Q3, Q4, Q5 et Q6 sont documentaires et ne permettent pas au moteur d’affirmer une causalité.

### Exports

- PIA professionnel nominatif au format Word (`.docx`) ou PDF (`.pdf`), au choix ;
- export JSON professionnel technique ;
- modèle PIA dé-identifié au format Word (`.docx`) ou PDF (`.pdf`), au choix ;
- export JSON dé-identifié technique pour alimenter une bibliothèque de modèles sans données directement identifiantes.

Le PIA nominatif reste lié au suivi de l’élève. Le modèle dé-identifié ne doit pas contenir les identifiants de l’élève, de l’école ou du dossier.


## 2. Architecture générale

L'application est une SPA (Single Page Application) construite avec :

- **Vite** pour le développement et le build ;
- **JavaScript côté navigateur** ;
- **Microsoft Entra ID** pour l'identité et l'authentification ;
- **Microsoft Graph** pour l'accès au stockage OneDrive AppFolder ;
- **IndexedDB** pour le stockage local ;
- **AES-GCM** pour le chiffrement des données locales ;
- **GitHub Pages** pour l'hébergement de l'application.

L'architecture détaillée est décrite dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 3. Authentification

L'application utilise Microsoft Entra ID avec MSAL Browser.

L'identité Entra sert notamment à :

- authentifier l'utilisateur ;
- isoler les données locales par identité ;
- autoriser l'accès à l'AppFolder OneDrive de l'utilisateur.

Les permissions Graph utilisées par l'application sont limitées au besoin actuel :

- `openid`
- `profile`
- `Files.ReadWrite.AppFolder`

Aucun secret client n'est embarqué dans l'application web.

---

## 4. Stockage local

Le fonctionnement est **local-first**.

Les données de travail sont conservées dans IndexedDB et protégées par un mécanisme de chiffrement AES-GCM.

Le modèle local comprend notamment :

- les élèves ;
- les séances / observations ;
- l'agenda ;
- les informations de synchronisation ;
- les éléments nécessaires au fonctionnement de l'application.

Le stockage local est strictement associé à l'identité de l'utilisateur. L'application ne doit pas adopter automatiquement une identité propriétaire provenant d'un fichier OneDrive.

---

## 5. Synchronisation OneDrive

La synchronisation utilise Microsoft Graph et l'**AppFolder OneDrive** de l'utilisateur.

L'application crée et utilise une structure dédiée :

```text
AppFolder
└── Journalier/
    ├── profil/
    ├── eleves/
    ├── agenda/
    └── system/
```

Les données métier ne sont pas écrites arbitrairement à la racine du OneDrive.

La synchronisation est gérée séparément du modèle pédagogique par le `SyncManager`.

Elle comprend notamment :

- la comparaison entre données locales et distantes ;
- le suivi des modifications ;
- l'utilisation des ETags ;
- la détection des conflits HTTP 412 ;
- la validation des données JSON ;
- la gestion des éléments distants absents ;
- des diagnostics de synchronisation sans écriture distante.

---

## 6. PIA

Le traitement d'un PIA est conçu pour être effectué localement dans le navigateur.

Le document original n'est pas supposé être automatiquement transmis à Microsoft Graph pendant cette opération.

Les informations utiles peuvent ensuite être intégrées aux données de travail du Journalier selon les mécanismes prévus par l'application.

Il faut distinguer :

- **anonymisation**, qui supprime le caractère permettant d'identifier une personne ;
- **pseudonymisation**, qui conserve une possibilité de rattachement indirect.

Le détail du traitement PIA est documenté dans `ARCHITECTURE.md`.

---

## 7. Bibliothèque d'indicateurs et repères

Le dépôt contient une bibliothèque JSON utilisée par l'application :

```text
public/
└── bibliotheque_indicateurs_v0_5_1.json
```

Cette bibliothèque participe au mécanisme de recherche et de rapprochement entre les observations, objectifs, matières et indicateurs.

Le fonctionnement pédagogique détaillé est décrit dans `ARCHITECTURE.md`.

---

## 8. Rapports et traitement pédagogique

Le Journalier contient des mécanismes de traitement des observations et de génération de rapports.

Le traitement pédagogique est volontairement séparé de la couche de synchronisation.

Les fonctions de suggestion doivent rester des outils d'aide à l'analyse et à la préparation du travail professionnel.

---

## 9. Sécurité

Les principes de sécurité actuellement mis en œuvre comprennent notamment :

- authentification via Microsoft Entra ID ;
- permissions Graph limitées à l'AppFolder ;
- absence de secret client dans le frontend ;
- stockage local chiffré ;
- isolation des données par identité ;
- validation des données JSON ;
- protection contre certaines injections HTML/XSS ;
- contrôle des ETags lors des écritures distantes ;
- détection des conflits ;
- Content Security Policy ;
- validation des URL de téléchargement Graph ;
- pagination contrôlée des réponses Graph.

Le dépôt fait également l'objet de contrôles GitHub concernant les secrets et les workflows.

Les éléments de sécurité détaillés sont regroupés dans `SECURITY.md`.

---

## 10. Développement local

### Prérequis

Le projet utilise Node.js et npm.

Installation des dépendances :

```bash
npm ci
```

Lancer le serveur de développement :

```bash
npm run dev
```

Le serveur Vite est configuré pour utiliser le port `8000`.

Build de production :

```bash
npm run build
```

Prévisualisation du build :

```bash
npm run preview
```

---

## 11. Build et déploiement

Le projet est hébergé sur GitHub Pages.

Le déploiement est automatisé par GitHub Actions.

Le workflow de production :

1. récupère le dépôt ;
2. installe les dépendances ;
3. construit l'application avec Vite ;
4. prépare l'artefact GitHub Pages ;
5. déploie l'artefact sur GitHub Pages.

Le dépôt utilise également un workflow CI qui vérifie le build lors des Pull Requests.

Les Actions utilisées dans les workflows sont actuellement référencées par **SHA complet** afin de limiter le risque lié au déplacement ultérieur d'un tag d'action.

Le dépôt utilise également les mécanismes GitHub suivants pour la surveillance du code et des dépendances :

- Dependabot Alerts ;
- Dependabot Security Updates ;
- Dependabot Version Updates, avec une vérification hebdomadaire des dépendances npm et des GitHub Actions ;
- CodeQL / Code scanning pour JavaScript/TypeScript et GitHub Actions.

La première analyse CodeQL réalisée après son activation n'a signalé aucune alerte.


---

## 12. Structure du dépôt

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── main.yml
├── public/
│   └── bibliotheque_indicateurs_v0_5_1.json
├── src/
│   ├── msal-bridge.js
│   └── msal-redirect.js
├── ARCHITECTURE.md
├── CHANGELOG.md
├── README.md
├── SECURITY.md
├── index.html
├── msal-redirect.html
├── package.json
├── package-lock.json
└── vite.config.js
```

Le code applicatif principal se trouve actuellement principalement dans `index.html`.

Cette organisation reflète l'état actuel du dépôt ; elle ne constitue pas nécessairement l'organisation cible d'une future refactorisation.

---

## 13. Documentation du projet

Les documents de référence sont organisés ainsi :

### `README.md`

Point d'entrée général du projet.

Il présente le rôle de l'application, son architecture générale, son fonctionnement et les principales commandes de développement.

### `ARCHITECTURE.md`

Référence technique détaillée.

Il décrit notamment :

- le modèle local-first ;
- l'authentification ;
- IndexedDB ;
- le modèle de données ;
- le traitement PIA ;
- la bibliothèque d'indicateurs ;
- Microsoft Graph ;
- l'AppFolder ;
- le SyncManager ;
- les ETags et conflits ;
- les mécanismes de sécurité ;
- le build et le déploiement.

### `SECURITY.md`

Document consacré aux principes et contrôles de sécurité du dépôt et de l'application.

### `CHANGELOG.md`

Historique lisible des évolutions importantes du projet.

---

## 14. État actuel

Le projet dispose actuellement d'une chaîne fonctionnelle :

```text
Navigateur
   ↓
Journalier SPA
   ↓
Microsoft Entra ID / MSAL
   ↓
Microsoft Graph
   ↓
OneDrive AppFolder
```

La synchronisation AppFolder a été testée avec un mécanisme de diagnostic qui crée temporairement un dossier et un fichier JSON, vérifie leur écriture et leur lecture, puis les supprime.

Ce test est distinct du fonctionnement métier normal de l'application.

Le parcours de rapprochement entre un événement prévisionnel et une séance réelle a également été vérifié : lorsqu'une séance réelle correspondante est encodée, l'événement prévisionnel peut être reconnu comme enregistré via `getEncodedForEvent()`.


---

## 15. Architecture actuelle et évolutions futures

L'architecture actuelle est adaptée à un fonctionnement où chaque utilisateur dispose de son propre espace de données dans OneDrive.

Une architecture institutionnelle partagée, par exemple fondée sur un espace SharePoint commun, pourrait être étudiée ultérieurement si les besoins évoluent vers :

- des données partagées entre plusieurs professionnels ;
- une gestion centralisée ;
- des droits d'accès institutionnels ;
- une gouvernance documentaire commune.

Cette possibilité ne doit pas être confondue avec l'architecture actuelle.

---

## 16. Principe de documentation

Toute modification importante de l'architecture, de la sécurité, du modèle de données ou de la synchronisation doit être accompagnée d'une mise à jour de la documentation correspondante.

La documentation doit distinguer explicitement :

- ce qui est **actuellement implémenté** ;
- ce qui est **testé mais expérimental** ;
- ce qui est **prévu** ;
- ce qui est **hypothétique ou à étudier**.

L'objectif est de permettre à un futur développeur, auditeur ou assistant technique de comprendre rapidement l'état réel du projet sans devoir reconstruire toute son histoire à partir des commits.

---

## 17. Référence technique

Pour une description détaillée du fonctionnement interne, consulter :

**[`ARCHITECTURE.md`](ARCHITECTURE.md)**

Pour les règles et contrôles de sécurité :

**[`SECURITY.md`](SECURITY.md)**

Pour l'historique des évolutions :

**[`CHANGELOG.md`](CHANGELOG.md)**
