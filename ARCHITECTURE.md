# Architecture du Journalier électronique

> Document de référence technique — V72
>
> Ce document décrit l'architecture actuellement présente dans le dépôt.
> Les évolutions envisagées sont explicitement séparées de l'architecture actuelle.

---

## 1. Vue d'ensemble

Le Journalier électronique est une application web SPA (Single Page Application) destinée à l'encodage, à la consultation et à la synthèse d'observations et de séances d'accompagnement.

L'application est actuellement :

- une application frontend statique ;
- construite avec Vite ;
- déployée sur GitHub Pages ;
- authentifiée avec Microsoft Entra ID ;
- connectée à Microsoft Graph ;
- utilisant le OneDrive AppFolder de l'utilisateur connecté pour la synchronisation distante ;
- utilisant IndexedDB pour le stockage local ;
- organisée autour d'un DataStore local et d'un SyncManager séparé du modèle pédagogique.

### Principe général

```text
                         ┌──────────────────────┐
                         │   Microsoft Entra ID │
                         │   Authentification   │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 Journalier — SPA / V72                      │
│                                                             │
│  Interface                                                  │
│     │                                                       │
│     ├── Élèves / PIA                                        │
│     ├── Séances / observations                              │
│     ├── Agenda                                              │
│     ├── Synthèses / rapports                                │
│     └── Repères / indicateurs WBE                           │
│                                                             │
│  DataStore                                                  │
│     │                                                       │
│     ├── IndexedDB chiffré                                   │
│     └── état local                                          │
│                                                             │
│  SyncManager                                                │
│     │                                                       │
│     ├── comparaison local / distant                         │
│     ├── fingerprints                                        │
│     ├── ETag                                                │
│     ├── conflits                                            │
│     └── synchronisation                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Microsoft Graph
                        ▼
              ┌──────────────────────┐
              │ OneDrive AppFolder   │
              │ /approot             │
              └──────────────────────┘
```

---

# 2. Structure du dépôt

La structure actuelle du dépôt est volontairement compacte.

```text
journalier-electronique/
│
├── index.html
├── msal-redirect.html
├── vite.config.js
├── package.json
├── package-lock.json
├── README.md
│
├── src/
│   ├── msal-bridge.js
│   └── msal-redirect.js
│
├── public/
│   └── bibliotheque_indicateurs_v0_5_1.json
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── main.yml
```

### Particularité importante

L'essentiel de la logique applicative actuelle est encore regroupé dans `index.html`.

Les fichiers `src/` contiennent principalement les éléments liés à l'intégration MSAL/redirection.

Cette organisation doit être prise en compte lors des audits futurs : il ne faut pas supposer que la logique métier est déjà répartie dans une architecture modulaire classique.

---

# 3. Frontend et build

## 3.1 Technologie

Le projet utilise :

- Vite `8.3.0`
- `@azure/msal-browser` `5.22.0`
- JavaScript côté navigateur
- HTML/CSS/JavaScript

Le projet est configuré en module ES :

```json
"type": "module"
```

## 3.2 Entrées Vite

Le build possède deux entrées :

```text
index.html
msal-redirect.html
```

`index.html` constitue l'application principale.

`msal-redirect.html` est utilisé pour le flux de redirection MSAL.

## 3.3 Développement local

Le serveur Vite est configuré sur :

```text
http://localhost:8000
```

avec :

```text
strictPort: true
```

## 3.4 Déploiement

L'application est conçue pour être servie depuis :

```text
/journalier-electronique/
```

Le déploiement de production est réalisé via GitHub Pages et GitHub Actions.

---

# 4. Authentification Microsoft Entra ID

Microsoft Entra ID constitue la source d'identité de l'application.

Le compte Microsoft connecté détermine le contexte utilisateur dans lequel les données locales et distantes sont utilisées.

L'application utilise MSAL Browser pour :

- initialiser l'authentification ;
- récupérer le compte Microsoft ;
- obtenir les jetons nécessaires à Microsoft Graph ;
- utiliser d'abord l'acquisition silencieuse du jeton ;
- utiliser une acquisition interactive si nécessaire.

Les permissions Graph actuellement utilisées par le code sont :

```text
Files.ReadWrite.AppFolder
```

Le code définit également les scopes OpenID et Profile pour l'authentification.

### Principe d'isolation

L'identité Entra est utilisée pour établir une clé de compte.

Le modèle de sécurité local prévoit :

- une identité Entra comme source d'identité ;
- un compte local strictement isolé par identité ;
- aucune identité propriétaire adoptée depuis OneDrive.

---

# 5. Stockage local

Le stockage local est assuré par IndexedDB.

Les données applicatives ne sont pas simplement conservées sous forme JSON en clair dans IndexedDB.

Le système utilise :

```text
IndexedDB
    ↓
clé dérivée du contexte du compte
    ↓
chiffrement AES-GCM
    ↓
état applicatif chiffré
```

Les fonctions principales comprennent notamment :

- ouverture de la base IndexedDB ;
- lecture ;
- écriture ;
- suppression ;
- génération d'une identité de compte ;
- obtention de la clé de chiffrement ;
- chiffrement ;
- déchiffrement.

Le système prévoit également un mécanisme d'auto-verrouillage après inactivité.

---

# 6. DataStore

Le DataStore constitue la couche locale principale de l'application.

Il regroupe notamment :

```text
profil / identité
élèves
séances
agenda
état de synchronisation
registre de synchronisation
métadonnées
```

Le DataStore conserve une séparation entre :

- les données métier ;
- l'état de synchronisation ;
- les métadonnées nécessaires au fonctionnement technique.

Lorsque la sécurité locale n'est pas prête, le DataStore peut retourner un état verrouillé plutôt que d'exposer les données.

---

# 7. Modèle de données

## 7.1 Élèves

Les élèves possèdent notamment un identifiant `studentId`.

Les données relatives à un élève peuvent inclure :

- informations scolaires ;
- matières ;
- informations liées au PIA ;
- autres informations nécessaires au suivi.

## 7.2 Séances

Les séances sont identifiées comme des entrées de type :

```text
SEANCE
```

avec une version d'architecture.

Les informations d'identification sont structurées notamment autour de :

```text
identification
    ├── élève
    ├── élèveId
    ├── date
    └── période

contexte
    └── matière
```

La fonction `sessionParts()` sert de point de normalisation pour extraire ces éléments.

## 7.3 Agenda

L'agenda possède son propre état et son propre registre de synchronisation.

Il prend notamment en charge :

- les vues jour/semaine/mois ;
- les périodes ;
- les événements ;
- les événements récurrents ;
- les duplications ;
- les conflits d'agenda.

---

# 8. PIA

Le Journalier permet d'importer un document PIA.

Le document sélectionné est traité directement sur l'appareil.

Le document original n'est pas supposé être envoyé automatiquement vers Microsoft Graph pendant cette opération.

L'application conserve également des repères ou objectifs liés au PIA dans les données du Journalier.

### Principe

```text
Document PIA
     │
     ▼
Traitement local dans le navigateur
     │
     ├── extraction / analyse
     └── repères utiles au Journalier
```

Le PIA original et les données structurées extraites doivent être considérés comme deux éléments distincts.

---

# 9. Bibliothèque d'indicateurs et repères WBE

Le dépôt contient actuellement :

```text
public/bibliotheque_indicateurs_v0_5_1.json
```

Cette bibliothèque est utilisée par le moteur de suggestions et de rapprochement.

Le système comporte notamment des fonctions permettant :

- de normaliser le texte ;
- d'extraire des tokens ;
- de détecter des concepts ;
- de détecter des actions ;
- de comparer les objectifs aux indicateurs ;
- de rechercher des correspondances WBE ;
- de calculer des scores ;
- de proposer des indicateurs ou repères ;
- de sélectionner et valider les repères proposés.

Le moteur distingue notamment les correspondances liées :

- aux séquences WBE ;
- aux notions WBE ;
- aux alias ;
- aux concepts ;
- aux actions.

### Important

Les suggestions produites par le moteur ne doivent pas être considérées comme des décisions professionnelles automatiques.

L'interface rappelle que les données restent descriptives et que les choix de suivi et les évolutions éventuelles du PIA doivent être confirmés par le professionnel.

---

# 10. Modèle pédagogique Q2 → Q6

Le Journalier organise les informations d'une séance autour de plusieurs niveaux, notamment Q2 à Q6.

Le système peut produire des rapprochements entre :

```text
Q2
 ↓
Q3
 ↓
Q4
 ↓
Q5
 ↓
Q6
```

Ces rapprochements sont documentaires.

Ils ne constituent pas automatiquement une preuve causale qu'une adaptation a produit un effet.

Le rapport généré rappelle explicitement cette limite.

En particulier, en l'absence d'un identifiant relationnel explicite entre certaines données Q2–Q6, le chaînage repose sur les informations présentes dans la même séance.

---

# 11. Microsoft Graph

Microsoft Graph constitue l'interface entre le Journalier et le stockage OneDrive.

La base Graph utilisée est :

```text
https://graph.microsoft.com/v1.0
```

L'application utilise :

```text
/me/drive/special/approot
```

comme racine de l'AppFolder.

Le code utilise une abstraction Graph interne afin que les composants métier ne communiquent pas directement avec Graph.

Le principe est :

```text
Interface / DataStore
        ↓
SyncManager
        ↓
Microsoft365Store / fonctions Graph
        ↓
Microsoft Graph
        ↓
OneDrive AppFolder
```

Le code documente explicitement que Graph/OneDrive est utilisé par le SyncManager et non directement par le modèle pédagogique.

---

# 12. Structure OneDrive

La structure distante actuellement préparée est :

```text
Journalier/
│
├── profil/
│
├── eleves/
│   └── <studentId>/
│       ├── profil.json
│       └── seances/
│           ├── <sessionId>.json
│           └── ...
│
├── agenda/
│   └── agenda.json
│
└── system/
    └── sync.json
```

Cette structure est créée dans l'AppFolder du compte connecté.

Elle n'est donc pas un espace SharePoint partagé.

### Conséquence architecturale

L'architecture actuelle est une architecture :

```text
utilisateur
    ↓
son identité Entra
    ↓
son AppFolder OneDrive
```

et non :

```text
équipe
    ↓
base institutionnelle partagée
```

Une éventuelle évolution vers SharePoint ou une autre architecture de données partagées constitue une évolution future et n'est pas considérée comme faisant partie de l'architecture V72 actuelle.

---

# 13. SyncManager

Le SyncManager constitue une couche séparée du modèle pédagogique.

Son rôle est de gérer la relation :

```text
état local
    ↕
état distant
```

Il utilise notamment un registre :

```text
syncRegistry
```

avec des entrées pour :

```text
students
sessions
agenda
```

Chaque entrée peut conserver notamment :

- identifiant distant ;
- ETag ;
- fingerprint local ;
- fingerprint distant ;
- date du dernier contrôle ;
- état de synchronisation.

---

# 14. États de synchronisation

Le système distingue notamment les états :

```text
synced
local-changed
local-pending
remote-changed
conflict
```

ainsi que le cas où une donnée distante est absente.

L'état global de synchronisation peut notamment être :

```text
local-only
pending
synced
conflict
locked
```

Les modifications locales sont marquées comme en attente lorsqu'une donnée métier change.

---

# 15. Fingerprints

La comparaison entre données locales et distantes utilise des fingerprints.

Le système :

1. normalise récursivement les valeurs ;
2. trie les clés des objets ;
3. supprime certaines métadonnées volatiles ;
4. sérialise le résultat ;
5. compare les fingerprints.

Les champs volatils tels que certaines métadonnées de création ou de modification ne doivent donc pas provoquer artificiellement une différence métier.

---

# 16. ETag et concurrence

Les fichiers distants utilisent les ETags Microsoft Graph.

Lorsqu'une écriture conditionnelle est nécessaire :

```text
If-Match: <ETag>
```

est utilisé.

Cela permet notamment de détecter qu'une ressource distante a changé depuis la dernière lecture.

Un échec de type HTTP `412` est traité comme un conflit.

### Principe

```text
lecture distante
     ↓
ETag mémorisé
     ↓
modification locale
     ↓
écriture avec If-Match
     │
     ├── succès → synchronisé
     │
     └── 412 → conflit
```

---

# 17. Analyse de synchronisation

Le Journalier possède une fonction de diagnostic permettant de comparer l'état local et distant.

Cette analyse :

- lit les données distantes ;
- compare les fingerprints ;
- met à jour le registre local ;
- identifie les éléments absents ;
- identifie les conflits.

Point important :

> L'analyse de synchronisation n'effectue pas d'écriture distante.

L'écriture intervient dans une étape distincte de synchronisation.

Cela permet de distinguer :

```text
diagnostic
```

de :

```text
synchronisation effective
```

---

# 18. Écriture et synchronisation

Lorsqu'une synchronisation effective est demandée :

1. l'état local est diagnostiqué ;
2. les conflits sont vérifiés ;
3. les éléments pouvant être synchronisés sont envoyés ;
4. les ETags sont actualisés ;
5. les fingerprints sont recalculés ;
6. l'état local de synchronisation est mis à jour ;
7. `system/sync.json` est actualisé.

Les trois principales catégories synchronisées sont :

```text
élèves
séances
agenda
```

---

# 19. Lecture des fichiers JSON distants

La lecture des fichiers JSON distants utilise l'URL de téléchargement fournie par Microsoft Graph :

```text
@microsoft.graph.downloadUrl
```

Le code vérifie notamment :

- que l'URL est valide ;
- qu'elle utilise HTTPS ;
- que son domaine appartient aux domaines autorisés ;
- que la réponse est valide ;
- que le contenu téléchargé est un JSON valide.

Cette approche évite d'utiliser directement une requête navigateur vers `/content` avec le jeton Authorization lorsque Microsoft Graph fournit une URL de téléchargement pré-authentifiée.

---

# 20. Pagination Microsoft Graph

La récupération des enfants d'un dossier utilise la pagination Graph.

Le système :

- lit `@odata.nextLink` ;
- continue jusqu'à épuisement des résultats ;
- limite le nombre maximal de pages ;
- vérifie que le `nextLink` appartient bien à Microsoft Graph.

Cette protection vise notamment à éviter une boucle inattendue ou l'utilisation d'une URL de pagination provenant d'une destination inattendue.

---

# 21. Test AppFolder

Le Journalier dispose d'un test technique de l'AppFolder.

Ce test :

1. récupère l'AppFolder ;
2. crée un dossier temporaire ;
3. crée `probe.json` ;
4. écrit des données de test ;
5. relit les données ;
6. supprime le fichier ;
7. supprime le dossier temporaire.

Ce test est destiné au diagnostic de l'intégration Microsoft Graph / OneDrive.

Il ne doit pas être considéré comme une fonctionnalité métier.

---

# 22. Sécurité applicative

Les principaux mécanismes actuellement présents comprennent notamment :

- authentification Microsoft Entra ID ;
- isolation des données par compte ;
- stockage local chiffré AES-GCM ;
- auto-verrouillage ;
- validation des structures JSON ;
- contrôle des clés autorisées ;
- `ownerId` ;
- gestion des ETags ;
- détection des conflits ;
- protection contre certaines injections HTML via échappement ;
- Content Security Policy ;
- validation des URL de téléchargement Graph ;
- limitation de la pagination Graph.

La sécurité GitHub fait l'objet de contrôles complémentaires décrits dans `SECURITY.md`.

---

# 23. Build et déploiement

Le dépôt utilise GitHub Actions.

Le pipeline principal :

```text
push sur main
      ↓
checkout
      ↓
Node.js
      ↓
npm ci
      ↓
npm run build
      ↓
GitHub Pages
```

Un workflow CI distinct vérifie le build lors des pull requests.

Les actions GitHub utilisées dans les workflows sont épinglées sur des SHA complets afin de réduire le risque lié au déplacement d'un tag d'action.

La branche `main` est protégée par les règles du dépôt.

---

# 24. Dépendances principales

Les dépendances applicatives principales sont actuellement :

```text
@azure/msal-browser 5.22.0
vite 8.3.0
```

Le projet utilise un `package-lock.json` afin de verrouiller les versions installées.

Les audits futurs doivent vérifier séparément :

- les dépendances directes ;
- les dépendances transitives ;
- les vulnérabilités connues ;
- les mises à jour Vite/MSAL ;
- les changements de comportement liés aux versions.

---

# 25. Architecture actuelle vs architecture future

## Architecture actuelle

```text
GitHub Pages
     │
     ▼
SPA Journalier
     │
     ├── Entra ID
     │
     ├── IndexedDB chiffré
     │
     └── SyncManager
             │
             ▼
       Graph / OneDrive
             │
             ▼
       AppFolder utilisateur
```

## Évolutions possibles

Une architecture institutionnelle future pourrait nécessiter :

```text
utilisateurs
     │
     ▼
Entra ID
     │
     ▼
application
     │
     ▼
service de données partagé
     │
     ▼
SharePoint / autre stockage institutionnel
```

Cette architecture n'est pas celle actuellement utilisée par V72.

Toute migration vers un stockage partagé devra être traitée comme une évolution architecturale majeure, notamment en raison :

- des droits d'accès ;
- de la séparation des utilisateurs ;
- de la gouvernance des données ;
- du RGPD ;
- de la gestion des rôles ;
- de la concurrence ;
- de la conservation et suppression des données.

---

# 26. Points de vigilance pour les futurs audits

Lors d'un audit futur, vérifier notamment :

### Authentification
- configuration MSAL ;
- redirect URI ;
- scopes réellement utilisés ;
- acquisition et stockage des tokens ;
- comportement logout/login.

### Stockage local
- isolation entre comptes ;
- chiffrement ;
- gestion des clés ;
- auto-lock ;
- récupération après verrouillage.

### Microsoft Graph
- permissions minimales ;
- AppFolder ;
- validation des URLs ;
- pagination ;
- gestion des erreurs ;
- ETags.

### Synchronisation
- comparaison local/distant ;
- conflits ;
- données absentes ;
- suppression ;
- récupération après reconnexion ;
- cohérence des fingerprints.

### Données pédagogiques
- structure des séances ;
- cohérence Q2–Q6 ;
- PIA ;
- bibliothèque WBE ;
- suggestions ;
- distinction entre données descriptives et interprétation professionnelle.

### Déploiement
- GitHub Actions ;
- SHA pinning ;
- protection de `main` ;
- dépendances ;
- secret scanning ;
- CI ;
- GitHub Pages.

---

# 27. Règle documentaire pour les futurs développements

Lorsqu'une nouvelle fonctionnalité importante est ajoutée, vérifier si elle nécessite une mise à jour de :

- `ARCHITECTURE.md` pour les changements d'architecture ;
- `SECURITY.md` pour les changements de sécurité ;
- `CHANGELOG.md` pour les changements fonctionnels ;
- `README.md` pour les changements affectant l'installation ou l'utilisation.

Ne pas présenter comme « implémenté » un élément qui n'est encore qu'une proposition ou une architecture envisagée.

---

# 28. Principe directeur

Le Journalier V72 suit actuellement le principe :

> **local-first, identité Entra, stockage local chiffré, synchronisation contrôlée vers l'AppFolder OneDrive.**

Le modèle pédagogique doit rester séparé de la couche de synchronisation.

Les données doivent être comparées et synchronisées de manière explicite, avec détection des conflits plutôt qu'une écriture aveugle.

Les fonctions d'aide et de suggestion doivent rester des outils d'appui au professionnel et ne doivent pas transformer automatiquement une suggestion algorithmique en décision pédagogique.
