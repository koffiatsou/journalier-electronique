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

- le rapprochement entre les événements prévisionnels et les séances réellement encodées ;
- la reconnaissance automatique d'un événement prévisionnel comme enregistré lorsqu'une séance correspondante existe pour le même élève, la même date et des périodes qui se recouvrent.

La fonction `getEncodedForEvent()` utilise volontairement le chevauchement de périodes comme critère de rapprochement. Un chevauchement n'est donc pas considéré comme une anomalie : une activité peut couvrir plusieurs périodes consécutives.


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

Le dépôt utilise également :

- Dependabot Alerts et Dependabot Security Updates ;
- Dependabot Version Updates pour les dépendances npm et les GitHub Actions ;
- CodeQL / Code scanning pour JavaScript/TypeScript et GitHub Actions.

La première analyse CodeQL effectuée après l'activation s'est terminée avec succès sans alerte de code scanning.


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

- l'état des alertes Dependabot ;
- les Pull Requests de mise à jour proposées par Dependabot ;
- les éventuelles alertes CodeQL.


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


# 29. Extension V73 — PIA annuel

## 29.1 Positionnement

V73 est une extension frontend de l’architecture actuelle. Elle ne crée ni backend, ni base centrale, ni nouveau canal de stockage. Elle s’appuie sur le DataStore et le mécanisme de synchronisation existants.

Chaîne :

```text
Séances SEANCE
   ↓
Q2 → Q6 + textes libres
   ↓
extraction / rapprochement conservateur
   ↓
convergence longitudinale
   ↓
propositions PIA
   ↓
validation professionnelle
   ↓
piaRecords / OneDrive AppFolder
```

## 29.2 Cycle annuel

```text
PIA précédent éventuel + séances
        ↓
RÉUNION 1 — DÉCEMBRE
        ↓
PIA annuel actualisé
        ↓
nouvelles séances
        ↓
comparaison avec les objectifs validés
        ↓
RÉUNION 2 — FIN D’ANNÉE
        ↓
PIA annuel final
```

Un PIA précédent est une `SOURCE_DE_CONTINUITE`, jamais une preuve de validité automatique. Les objectifs existants peuvent être conservés ou modifiés lors de la réunion 1.

## 29.3 Données de séance

Les « observations en classe » ne constituent pas une seconde source de données : elles proviennent des séances. V73 analyse les champs structurés et les précisions textuelles des séances.

`objectifLecon` reste un objectif de contexte de séance. `objectifProfessionnel`, lorsqu’il est renseigné, reste également contextuel et ne devient pas automatiquement un objectif PIA.

## 29.4 Convergence

Les états de synthèse sont explicables et conservés dans la traçabilité : `OBSERVATION`, `SIGNAL`, `TENDANCE`, `TENDANCE_QUALIFIEE`, `PROPOSITION`.

Le moteur ne crée pas de relation causale entre Q2, Q3, Q4, Q5 et Q6. Une aide renseignée dans la même séance qu’un effet observé constitue une association documentaire, pas une preuve de causalité.

## 29.5 PIA et export

Le modèle interne peut contenir la provenance, les séances, les états et les preuves. Les exports restent organisés autour du modèle PIA professionnel existant : aspects, ressources, difficultés, objectifs, critères, moyens et aménagements P/O/M.

Deux finalités de données sont distinguées :

1. export professionnel nominatif pour le suivi de l’élève ;
2. export dé-identifié pour constituer des modèles sans données directement identifiantes.

## 29.6 Règles de sécurité V73

- aucune permission Graph supplémentaire ;
- aucun accès direct V73 à IndexedDB ou Graph ;
- réutilisation de `JournalierDataStore` pour la persistance ;
- réutilisation du mécanisme OneDrive/AppFolder existant pour la sauvegarde distante ;
- aucune donnée pédagogique ne doit être ajoutée au dépôt GitHub ;
- toute nouvelle fonction V73 doit être ré-auditée selon les contrôles de `SECURITY.md`.

## 29.7 Référentiel V73

Le fichier `public/referentiel_pia_v73_0_3.json` formalise les règles de convergence, les relations sémantiques autorisées/interdites, les règles d’interprétation et les matrices de pertinence Q2→Q6. Il complète la bibliothèque WBE `bibliotheque_indicateurs_v0_5_1.json` ; il ne la remplace pas.

## 29.8 Limites documentées

Le moteur intégré est volontairement conservateur. Il fournit une synthèse exploitable pour le terrain mais ne constitue pas un système NLP exhaustif. Les propositions doivent rester contrôlables par le professionnel et les validations réelles doivent être effectuées avec les données de séances effectivement encodées.

### V73 — Référentiel et cycle de validation

Le runtime V73 lit les paramètres de convergence depuis `public/referentiel_pia_v73_0_3.json`. Les seuils et exceptions du référentiel sont donc la configuration active du moteur ; ils ne sont pas considérés comme une vérité pédagogique et restent calibrables.

Les objectifs issus du PIA précédent restent une `SOURCE_DE_CONTINUITE`. La réunion 1 conserve les objectifs validés avec leur date et leur thème. La réunion 2 compare les nouvelles séances avec ces objectifs validés ; son état reste `A_DISCUSSER` jusqu’à la validation professionnelle.

Le fichier PIA Word/PDF sélectionné est traité localement dans le navigateur. Journalier n’enregistre pas le document original ni son nom de fichier comme donnée de continuité. Seule une structure extraite et limitée aux éléments utiles au suivi PIA est conservée dans le DataStore chiffré. Les PDF scannés/image sans couche texte exploitable nécessitent un OCR, qui n’est pas intégré à cette version.


## 29.9 V73.1 — import/export documentaire et interface d’accueil

### Import PIA précédent

Le dossier élève accepte les formats :

- Word `.docx` ;
- PDF `.pdf`.

Le traitement est local. Le document est lu en mémoire, les éléments PIA utiles sont extraits, puis le fichier source est abandonné. Le nom du fichier n’est pas conservé.

La structure conservée distingue notamment les objectifs précédents, ressources, difficultés, adaptations P/O/M et sections PIA reconnues. Elle reste une `SOURCE_DE_CONTINUITE` à réévaluer, jamais une validation automatique.

### Export

Le PIA interne reste JSON structuré. L’interface permet de choisir le format de restitution :

- Word `.docx` ;
- PDF `.pdf`.

Les exports professionnels peuvent rester nominatifs. Les exports dé-identifiés suppriment les identifiants élève/école/classe, la continuité nominative, les identifiants de séances, les dates de preuve et les métadonnées de génération.

### Accueil

La zone `Accès rapide`, redondante avec la navigation principale, est remplacée par un tableau de bord fonctionnel :

- tendances descriptives des 30 derniers jours ;
- suivi du cycle PIA ;
- mémos personnels.

Les tendances sont des fréquences de séances documentées, pas des scores de difficulté.
