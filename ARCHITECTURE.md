# Architecture du Journalier électronique — V75

> Document de référence technique — état du dépôt à jour (octobre 2026)
>
> Ce document décrit l'architecture actuellement présente dans le dépôt.
> Les évolutions envisagées sont explicitement séparées de l'architecture actuelle.

---

## 0. Cartographie rapide du projet (Lecture directe pour IA & Développeurs)

Pour comprendre immédiatement l'arborescence et le rôle de chaque composant :

```text
Journalier Électronique (V75)
│
├── index.html                           # Point d'entrée SPA, gabarit HTML, styles et balises CSP
│
├── src/
│   ├── app/
│   │   ├── storage-vault.js             # Coffre chiffré AES-GCM (IndexedDB), clés & identité
│   │   ├── students-core.js             # Dossiers élèves, matières, Journalier (liste et détail)
│   │   ├── agenda-core.js               # Moteur d'agenda Outlook-level, 8 périodes, récurrences & timeline
│   │   ├── sessions-core.js             # Formulaire de séance en deux zones, enregistrement, modification
│   │   ├── session-levels.js            # V75 : choix de niveau (aucun d'office, repli après choix)
│   │   ├── redaction-engine.js          # V75 : moteur de rédaction déterministe (texte, évolution, synthèse)
│   │   ├── journalier-seances-docx.js   # V75 : export Word du Journalier dans le modèle papier
│   │   ├── reunion-view.js              # V75 : vue Réunion et export PIA visible
│   │   ├── reports-core.js              # Rapports pédagogiques multi-profils & synthèses Apple HIG
│   │   ├── journalier-core.js           # Orchestration UI, navigation des onglets & gestionnaires d'événements
│   │   ├── microsoft-core.js            # Auth Entra ID (MSAL), synchronisation OneDrive AppFolder
│   │   ├── apple-ux-enhancements.js     # Accordéons, navigation tactile, gestes et ergonomie Apple HIG
│   │   ├── indicators.js                # Normalisation de la bibliothèque d'indicateurs WBE
│   │   ├── referentiel-amenagements.js  # Rapprochement contextuel & recherche 544 fiches WBE
│   │   └── local-ai-assistant.js        # Assistant de rédaction local (règles et dictionnaire WBE, hors-ligne)
│   │
│   ├── v74/
│   │   ├── v74-docx-export.js           # Moteur Word officiel base OpenXML (archive, T1 identité, T2 5 aspects)
│   │   ├── v74-docx-pia-pv.js           # Moteur Word officiel PV1/PV2 & Tableaux d'aménagements T5/T8
│   │   ├── v74-pdf-export.js            # Générateur autonome PDF 1.4 multi-pages
│   │   └── v74-runtime.js               # Moteur PIA, cycle de vie, convergence longitudinale & exports officiels
│   │
│   └── styles/
│       ├── journalier.css               # Feuilles de style de base
│       ├── journalier-ux-responsive.css # Optimisation responsive mobile/tablette/iPad
│       └── apple-premium.css            # Finitions Apple/Safari premium, cartes Bento et accordéons
│
├── public/
│   ├── modeles/
│   │   ├── Journalier_modele_papier.docx        # V75 : modèle du Journalier papier
│   │   └── PIA_modele_officiel_2025-09-11.docx # Modèle Word officiel WBE de référence
│   ├── referentiel_amenagements_wbe.json # 544 fiches d'aménagements WBE (Fondamental & Secondaire)
│   ├── bibliotheque_indicateurs_v0_5_1.json # Bibliothèque d'indicateurs WBE (33 domaines)
│   ├── referentiel_pia_v74_0_3.json     # Schémas et structures du référentiel PIA V74
│   └── logo-poles-territoriaux.svg      # Logo vectoriel institutionnel des Pôles territoriaux
│
├── tests/                               # Suites de tests contractuels, fonctionnels et comportementaux (npm test)
│
└── docs/                                # Documentation technique détaillée par sous-système
```

---


## V74 — pont et helpers de compatibilité (JournalierMigrationBridge)

Les migrations initiales des dossiers legacy ayant été menées à bien, le module de migration transitoire a été retiré afin d'épurer l'application. L'objet `window.JournalierMigrationBridge` est maintenu pour exposer les fonctions de synchronisation et de validation transversales (`v72MarkPiaPending`, `v72MarkPiaSynced`, `validateStrictPIA`, `DataStore`, `JournalierSecurity`) sans multiplier les variables globales non encapsulées.

```text
index.html / microsoft-core.js
   │
   └── window.JournalierMigrationBridge
          │
          ├── fonctions Graph nécessaires
          ├── validate/normalize (dont validateStrictPIA)
          ├── DataStore
          ├── JournalierSecurity
          └── fonctions de synchronisation et suivi PIA (v72MarkPiaPending/Synced)
```

Le pont est strictement isolé. Il ne constitue pas une nouvelle couche de stockage et n'ajoute aucune permission Microsoft Graph.

### Historique des données migrées

Les données déjà migrées sont stockées de façon pérenne dans le coffre chiffré IndexedDB et synchronisées dans le répertoire OneDrive officiel `Journalier/`. La suppression du module d'import legacy n'altère en rien l'intégrité de ces données.

```text
Ancien Mes fichiers/Journalier
          │
          │ copie manuelle de l'utilisateur
          ▼
AppFolder/Journalier-legacy
          │
          ├── validation
          ├── normalisation
          ├── détection des conflits
          ▼
AppFolder/Journalier
```

`Journalier-legacy` est conservé comme copie source. La migration n'effectue aucune suppression distante.

Le `studentId` historique est conservé. Le propriétaire technique est remplacé par l'identité Entra actuellement connectée lors de la normalisation. Les anciennes données ne sont pas transformées automatiquement en PIA annuel validé.


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

### Couche UX/UI responsive — 29 septembre 2026

La couche `src/styles/journalier-ux-responsive.css` est une couche de présentation chargée après `src/styles/journalier.css`. Elle ne contient aucune logique de persistance, de synchronisation, d'identité ou de modèle métier.

Elle traite :

- `100dvh`, zones sûres et défilement principal ;
- navigation PC/tablette/téléphone ;
- cibles tactiles et focus ;
- agenda, formulaire de séance, dossiers élèves et rapports ;
- Journalier maître-détail (anciennement historique) ;
- rendu responsive des vues PIA générées par `src/v74/v74-runtime.js` ;
- modales et panneau d'export sur téléphone ;
- réduction des mouvements.

Aucun identifiant `v72*`, schéma JSON, DataStore, IndexedDB, Graph, OneDrive, MSAL ou SyncManager n'est modifié par cette couche. Les contrôles et simulations sont documentés dans [`docs/UX_V74_RESPONSIVE.md`](docs/UX_V74_RESPONSIVE.md).

### Principe général

```text
                         ┌──────────────────────┐
                         │   Microsoft Entra ID │
                         │   Authentification   │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│          Journalier — architecture V75 et couche de compatibilité historique          │
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
├── index.html, msal-redirect.html
├── vite.config.js, eslint.config.js, package.json, package-lock.json
├── README.md, ARCHITECTURE.md, SECURITY.md, CHANGELOG.md, AGENTS.md
├── docs/
│   ├── README.md                       # Index des guides
│   ├── PARCOURS_V75.md, MOTEUR_REDACTION_ET_EXPORT_V75.md
│   ├── AGENDA_V74.md, STOCKAGE_LOCAL_V74.md, UX_V74_RESPONSIVE.md
│   ├── PIA_MODELE_STRUCTURE.md, REFERENTIEL_ET_IA_LOCALE_V74.md
│   ├── LOCAL_AI_QUALITATIVE_ANALYSIS_CONTRACT.md
│   ├── v74-design/                     # Cahier des charges UX et maquettes V74 (historique)
│   ├── exemples/                       # PIA fictifs
│   └── archive/                        # Rapports de chantiers terminés
│
├── src/
│   ├── msal-bridge.js, msal-redirect.js
│   ├── app/
│   │   ├── html-escape.js, indicators.js, storage-vault.js
│   │   ├── students-core.js, agenda-core.js, sessions-core.js, reports-core.js, journalier-core.js
│   │   ├── redaction-engine.js, journalier-seances-docx.js     # V75
│   │   ├── session-levels.js, reunion-view.js                  # V75
│   │   └── microsoft-core.js, apple-ux-enhancements.js,
│   │       referentiel-amenagements.js, local-ai-assistant.js
│   ├── styles/
│   │   └── journalier.css, journalier-ux-responsive.css, apple-premium.css
│   └── v74/
│       └── v74-docx-export.js, v74-docx-pia-pv.js, v74-pdf-export.js,
│           v74-runtime.js, pia-lifecycle-engine.js
│
├── tests/                              # Suites lancées par `npm test` (contrats, comportement, moteur V75)
│
├── public/
│   ├── modeles/
│   │   ├── Journalier_modele_papier.docx        # V75
│   │   └── PIA_modele_officiel_2025-09-11.docx
│   ├── bibliotheque_indicateurs_v0_5_1.json, referentiel_amenagements_wbe.json,
│   │   referentiel_pia_v74_0_3.json
│   └── logo-poles-territoriaux.svg
│
├── scripts/build-zip.py
└── .github/                            # dependabot.yml, workflows/ci.yml, workflows/main.yml (dépôt GitHub)
```

### Particularité importante et Découpage Modulaire

Le code initialement inline dans `index.html` a été extrait dans des modules dédiés sans modifier les contrats globaux :
- `src/app/html-escape.js` : module unifié d'échappement HTML anti-XSS (`escapeHtml` / `esc`), d'échappement XML OpenXML (`escapeXml` / `xmlEsc`) et de sanitisation des noms de fichiers (`sanitizeFilename`) ;
- `src/app/storage-vault.js` : coffre chiffré local granulaire (`journalier-secure-v74`), cryptographie AES-GCM 256 bits, dérivation PBKDF2/SHA-256, transactions IndexedDB strictes et persistance granulaire par enregistrement ;
- `src/app/reports-core.js` : moteur d'analyse pédagogique des rapports naturels (V0.1 à V0.8), extraction des unités probantes, relations, synthèses visuelles Apple HIG et préparation de réunion ;
- `src/app/students-core.js` : gestion des dossiers élèves, fiches administratives T1 (Nom, Prénom, Date de naissance, École, Classe, Option, Titulaire, CPMS coopérant, Responsable légal) ;
- `src/app/journalier-core.js` : orchestration (registre de gestionnaires `JR_HANDLERS`, navigation des onglets), accès au `DataStore` (`getDB`, `getStudents`), statistiques de présence (`window.JournalierAttendance`) ;
- `src/app/agenda-core.js` : agenda (événements concurrents, récurrences, statuts, absences) ;
- `src/app/sessions-core.js` : formulaire de séance, enregistrement, modification, historique des séances ;
- `src/app/redaction-engine.js`, `src/app/journalier-seances-docx.js`, `src/app/session-levels.js`, `src/app/reunion-view.js` : modules V75 (voir chapitre 32) ;
- `src/app/microsoft-core.js` : couche Microsoft Graph, OneDrive AppFolder, `SyncManager`, récupération distante et fonctionnalité « Repartir de OneDrive » (`v74RepartirDeOneDrive`) ;
- `src/app/indicators.js` : bibliothèque et diagnostic des indicateurs WBE ;
- `src/v74/v74-docx-export.js` : moteur d'exportation Word officiel (OpenXML / ZIP local) assurant l'injection dans l'archive officielle `public/modeles/PIA_modele_officiel_2025-09-11.docx`, la normalisation des libellés et le remplissage de T1 (Identité) et T2 (5 aspects) ;
- `src/v74/v74-docx-pia-pv.js` : moteur d'exportation Word officiel pour les Procès-Verbaux 1 & 2 (Date, tableau des personnes présentes T3/T6 avec clonage dynamique au-delà de 9, cases pleine largeur et retours avec fusion Direction + Équipe pédagogique) et les Tableaux d'aménagements T5 (décembre) et T8 (fin d'année) avec marquage « X » centré et renumérotation dynamique ;
- `src/v74/v74-pdf-export.js` : moteur d'exportation documentaire PDF (PDF 1.4 multi-pages) avec encodage WinAnsi, découpage de texte sans coupure, pagination, bannières et grilles de données, ainsi que le générateur autonome du Document Officiel PIA WBE (Page 1 Paysage, Pages 2+ Portrait, tracé vectoriel natif du logo institutionnel et prise en charge intégrale de la dé-identification RGPD) ;
- `src/v74/v74-runtime.js` : runtime PIA annuel, import local DOCX/PDF, construction du modèle de document officiel (`buildOfficialPIADocumentModel`), nommage officiel canonique (`buildOfficialPIAFileName`) et coordination des exports de décembre et fin d'année (nominatifs et dé-identifiés).

---

## 2.1 Nomenclature et Chronologie Unifiée des Chantiers

Pour éviter toute ambiguïté, la numérotation par **« Lot [1 à 6] »** est désormais réservée au chantier en cours : **Chantier 4 — Modèle Officiel PIA WBE (2025-2026)**. Les phases précédentes disposent d'identifiants chronologiques distincts :

| Identifiant | Période | Intitulé du Chantier | Description synthétique |
| :--- | :--- | :--- | :--- |
| **Chantier 0** | Septembre 2026 | **Socle V74 Initial** | Cycle annuel PIA, 5 domaines, persistance chiffrée, responsive mobile, réattribution des séances |
| **Chantier 1 (M1–M8)** | 10–12 oct. 2026 | **Modularisation de l'Architecture** | Découpage de `journalier-core.js` en 8 modules autonomes (`storage-vault`, `docx`, `pdf`, `reports`, `students`, `agenda`, `sessions`, `journalier-core` < 650 l.) |
| **Chantier 2 (SEC-1–SEC-5)** | 12–13 oct. 2026 | **Audit Sécurité, Robustesse & Intégrité** | Éradication de localStorage (SEC-1), hygiène du dépôt (SEC-2), échappement HTML unifié (SEC-3), échappement XML 1.0 (SEC-4), échappement attributs & sanitisation fichiers (SEC-5) |
| **Chantier 3 (ERG-A–ERG-C)** | 15 oct. 2026 | **Ergonomie & Rédaction Locale** | Retrait du prototype IA générative (ERG-A), bouton « Ajuster le texte » (ERG-B), filtrage par matière en synthèse (ERG-C) |
| **Chantier 4 (Lots 1–6)** | 17–21 oct. 2026 | **Modèle Officiel PIA WBE (2025-2026)** | **Achevé** : Intégration du document officiel officiel WBE (Word et PDF) et de son cycle complet d'exportation |

### Détail des Lots du Chantier 4 (Modèle Officiel PIA) :
- **Lot 1** *(Achevé)* : Chaîne de données PIA (séances, repères WBE, préparation des réunions).
- **Lot 2** *(Achevé)* : Profil élève & champs administratifs T1 (fiche élève, titulaire, CPMS coopérant, école, classe/option).
- **Lot 3** *(Achevé)* : Modèle de document PIA officiel & Moteur Word de base (archive ZIP `PIA_modele_officiel_2025-09-11.docx`, T1 identité, T2 5 aspects, headers avec année scolaire).
- **Lot 4A** *(Achevé)* : Moteur Word officiel pour Procès-verbaux 1 & 2 (PV1/PV2) et Tableaux d'aménagements (T5 & T8).
- **Lot 4B** *(Achevé)* : Interface d'export du Word officiel (boutons « Exporter la version de décembre » et « Exporter la version de fin d'année » dans les écrans des réunions 1 et 2, nommage officiel canonique).
- **Lot 5** *(Achevé)* : Export PDF officiel conforme à la maquette WBE (orientation hybride Paysage page 1 / Portrait pages suivantes, tracé vectoriel natif du logo Pôles territoriaux).
- **Lot 6** *(Achevé)* : Dé-identification du modèle officiel Word et PDF (anonymisation complète T1, PV1/PV2 rôles seuls sans patronymes, neutralisation des retours et dates de réunions, métadonnées neutres, boutons dédiés « 🛡️ Word dé-identifié » et « 🛡️ PDF dé-identifié »).

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

Le coffre historique est conservé sous son identifiant technique `journalier-secure-v72` afin de préserver la compatibilité et de permettre une migration non destructive. La nouvelle persistance utilise `journalier-secure-v74`.

## 5.1 Coffre granulaire

Le nouveau coffre contient les stores :

```text
meta
students
sessions
agenda
pia
sync
keys
migration
```

Chaque élève, séance, événement Agenda, PIA et entrée de synchronisation est stocké séparément. La configuration et les exceptions Agenda sont également séparées des événements. Le `DataStore` conserve cependant son modèle en mémoire actuel afin de ne pas casser les dépendances métier existantes.

La persistance compare l'état courant avec le dernier état persisté et prépare uniquement les `put`/`delete` nécessaires. Une modification locale d'une séance n'entraîne donc plus la réécriture de tout l'état applicatif dans une seule valeur IndexedDB.

## 5.2 Chiffrement et intégrité

Chaque enregistrement métier est chiffré avec AES-GCM 256 bits. La clé est une `CryptoKey` non extractible conservée dans `keys`. Chaque enregistrement reçoit un IV aléatoire et une AAD construite à partir de la version du stockage, de l'identité du compte, du type et de l'identifiant de l'objet.

Une empreinte SHA-256 du ciphertext est conservée pour permettre un contrôle d'intégrité diagnostique.

## 5.3 Migration et récupération

La migration v72 → stockage granulaire est non destructive. Le coffre historique n'est jamais supprimé automatiquement. Le marqueur de migration n'est écrit comme `complete` qu'après l'écriture transactionnelle des données granulaires.

Si l'ancien enregistrement `states` est illisible, ce cas est distingué d'une première installation. Journalier conserve la source historique, initialise le coffre granulaire et peut récupérer les données disponibles dans OneDrive AppFolder. L'application ne prétend pas avoir récupéré les données locales tant que cette récupération n'est pas vérifiée.

## 5.4 Durabilité

Les écritures critiques demandent `durability: 'strict'` lorsque le navigateur le supporte. L'application demande également le stockage persistant du navigateur lorsque l'API est disponible ; cette demande ne constitue pas une garantie contre une suppression volontaire ou une politique du navigateur/OS.

Le détail du schéma est documenté dans [`docs/STOCKAGE_LOCAL_V74.md`](docs/STOCKAGE_LOCAL_V74.md).

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
    ├── matière, niveau, forme, typeIntervention
    ├── presenceStatus   (present, absent_eleve, absent_eleve_coteach, absent_prof, absent_agent)
    └── classNotes       (contenu vu en classe)

objectif
    ├── objectifLecon           (objectif de la leçon)
    └── objectifProfessionnel   (mon objectif)

q2 … q6                  (rubriques orthopédagogiques, voir chapitre 10)
```

La fonction `sessionParts()` sert de point de normalisation pour extraire ces éléments.

## 7.3 Agenda

L'agenda possède son propre état et son propre registre de synchronisation.

Il prend notamment en charge :

- les vues jour/semaine/mois ;
- huit périodes configurables, sans transformer les pauses en périodes ;
- plusieurs événements concurrents sur un même créneau ;
- les événements planifiés, réalisés et annulés ;
- les événements récurrents ;
- les duplications ;
- la réalisation indépendante des réunions, GT, formations et autres missions ;
- le rapprochement entre les événements prévisionnels et les séances réellement encodées ;
- la correction d'un événement élève lorsqu'une séance est déplacée ;
- les métadonnées réservées à la future synchronisation Outlook.

Le stockage canonique utilise `agenda.__events`, `agenda.__exceptions` et `agenda.__config`. `secureNormalizeAgenda()` assure la compatibilité avec les anciennes structures `__uniqueEvents` et `jour_période` utilisées par les versions précédentes.

La fonction `getEncodedForEvent()` utilise volontairement le chevauchement de périodes comme critère de rapprochement. Un chevauchement n'est donc pas considéré comme une anomalie : plusieurs propositions peuvent occuper le même créneau et une activité peut couvrir plusieurs périodes consécutives.


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

### Statut en V75

Le rapprochement avec cette bibliothèque est **masqué dans la séance** (les panneaux d'indicateurs et d'ajout d'indicateur sont cachés, la rubrique « Compétence travaillée » est un texte libre) : il n'était pas assez fiable hors mathématiques. Les fonctions et les données restent dans le code et dans les anciennes séances (`q3.indicateurs`, `q3.repereWBE`), en attendant une reconstruction à partir des référentiels fournis par les utilisateurs.

### Important

Les suggestions produites par le moteur ne doivent pas être considérées comme des décisions professionnelles automatiques.

L'interface rappelle que les données restent descriptives et que les choix de suivi et les évolutions éventuelles du PIA doivent être confirmés par le professionnel.

---

# 10. Modèle pédagogique de la séance (V75)

Depuis V75, la séance suit la feuille papier : une **partie pédagogique** et une **partie orthopédagogique**. Les clés de stockage historiques `q2` à `q6` sont conservées (compatibilité des données et de la synchronisation) ; seuls les intitulés à l'écran ont changé.

| Clé | Écran | Contenu |
| :--- | :--- | :--- |
| `contexte`, `objectif` | Créneau et partie pédagogique | matière, niveau, forme, intervention, statut de présence, contenu vu en classe, objectif de la leçon, mon objectif |
| `q2` | Fonctionnement observé | observations et niveau 0–2 (partiellement, suffisamment, totalement), remarque |
| `q3` | Compétence travaillée | texte libre (`precision`) ; `indicateurs` et `repereWBE` conservés pour les anciennes séances |
| `q4` | Ce qui a aidé | aides et effet 0–2 (aucun effet, partiel, positif), précision |
| `q5` | Transfert | statut et précision (facultatif) |
| `q6` | Suite | actions, modalité, objectif, collaborations (facultatif) |

Règles :

- Aucun niveau n'est enregistré par défaut : une observation cochée sans niveau bloque l'enregistrement (`session-levels.js`).
- `presenceStatus` : `present`, `absent_eleve`, `absent_eleve_coteach`, `absent_prof`, `absent_agent`. Seules les séances `present` entrent dans le taux de présence de l'élève et dans les observations.
- Le texte du Journalier et de la synthèse de réunion est produit par le moteur de rédaction (`redaction-engine.js`), voir `docs/MOTEUR_REDACTION_ET_EXPORT_V75.md`.
- Le chaînage entre rubriques reste **documentaire** : en l'absence d'identifiant relationnel explicite, le moteur n'affirme aucune causalité.
- Le rapprochement avec le référentiel WBE est masqué dans la séance (non fiable hors mathématiques) ; il sera reconstruit avec les référentiels des utilisateurs.

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
├── pia/
│   └── <studentId>/pia.json
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

Une éventuelle évolution vers SharePoint ou une autre architecture de données partagées constitue une évolution future et n'est pas considérée comme faisant partie de l'architecture V74 actuelle.

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
pia
```

Chaque entrée peut conserver notamment :

- identifiant distant ;
- ETag ;
- fingerprint local ;
- fingerprint distant ;
- date du dernier contrôle ;
- état de synchronisation.

Le déclenchement de la synchronisation n'est plus strictement manuel. Une synchronisation est planifiée automatiquement (avec un court délai) après chaque sauvegarde locale, au retour de l'application au premier plan, à la reconnexion réseau, à la connexion Microsoft et selon un cycle périodique en arrière-plan tant qu'un compte est connecté. Ce déclenchement automatique réutilise le même parcours que la synchronisation manuelle et reste soumis aux mêmes règles de conflit : aucune écriture distante n'est effectuée si un conflit est détecté.

La synchronisation n'est plus unidirectionnelle. Les entrées distantes modifiées depuis le dernier contrôle (`remote-changed`) sont téléchargées et fusionnées dans l'état local lorsqu'aucun conflit n'est détecté, avant l'envoi des modifications locales en attente. La réimportation complète reste disponible mais n'est plus l'unique moyen de récupérer des données créées sur un autre appareil.

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

Cette architecture n'est pas celle actuellement utilisée par la V75.

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
- cohérence des rubriques de séance (`q2` à `q6`) ;
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

Le Journalier V75 suit actuellement le principe :

> **local-first, identité Entra, stockage local chiffré, synchronisation contrôlée vers l'AppFolder OneDrive.**

Le modèle pédagogique doit rester séparé de la couche de synchronisation.

Les données doivent être comparées et synchronisées de manière explicite, avec détection des conflits plutôt qu'une écriture aveugle.

Les fonctions d'aide et de suggestion doivent rester des outils d'appui au professionnel et ne doivent pas transformer automatiquement une suggestion algorithmique en décision pédagogique.


# 29. Extension V74 — PIA annuel

## 29.1 Positionnement

V74 est une extension frontend de l’architecture actuelle. Elle ne crée ni backend, ni base centrale, ni nouveau canal de stockage. Elle s’appuie sur le DataStore et le mécanisme de synchronisation existants.

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

Les « observations en classe » ne constituent pas une seconde source de données : elles proviennent des séances. V74 analyse les champs structurés et les précisions textuelles des séances.

### Modification et rattachement d’une séance

Une séance conserve son `id` lors d’une modification. Le champ `identification.eleve` représente le nom actuellement affiché et `identification.eleveId` l’identité stable du dossier élève sélectionné.

La résolution d’une séance en mode édition privilégie `eleveId` lorsqu’il correspond encore à un élève du dossier, puis le nom pour assurer la compatibilité avec les anciennes données. Si aucun élève correspondant n’existe plus, l’ancien nom est conservé uniquement comme repère dans le formulaire ; l’enregistrement doit alors sélectionner un élève actuel.

Lorsqu’une séance déjà synchronisée change de `studentId`, le SyncManager conserve temporairement la référence de l’ancien fichier distant, écrit la séance dans le dossier du nouvel élève sans réutiliser l’ETag de l’ancien emplacement, puis supprime l’ancienne copie avec son ETag. Un `412 Precondition Failed` sur cette suppression est traité comme un conflit et ne provoque pas d’écrasement silencieux.

`objectifLecon` reste un objectif de contexte de séance. `objectifProfessionnel`, lorsqu’il est renseigné, reste également contextuel et ne devient pas automatiquement un objectif PIA.

## 29.4 Convergence

Les états de synthèse sont explicables et conservés dans la traçabilité : `OBSERVATION`, `SIGNAL`, `TENDANCE`, `TENDANCE_QUALIFIEE`, `PROPOSITION`.

Le moteur ne crée pas de relation causale entre Q2, Q3, Q4, Q5 et Q6. Une aide renseignée dans la même séance qu’un effet observé constitue une association documentaire, pas une preuve de causalité.

## 29.5 PIA et export

Le modèle interne peut contenir la provenance, les séances, les états et les preuves. Les exports restent organisés autour du modèle PIA professionnel existant : aspects, ressources, difficultés, objectifs, critères, moyens et aménagements P/O/M.

Deux finalités de données sont distinguées :

1. export professionnel nominatif pour le suivi de l’élève ;
2. export dé-identifié pour constituer des modèles sans données directement identifiantes.

## 29.6 Règles de sécurité V74

- aucune permission Graph supplémentaire ;
- le module V74 runtime n’accède pas directement à IndexedDB ou Graph ;
- le stockage granulaire est centralisé dans `JournalierSecurity` / `JournalierDataStore` ;
- réutilisation du mécanisme OneDrive/AppFolder existant pour la sauvegarde distante ;
- aucune donnée pédagogique ne doit être ajoutée au dépôt GitHub ;
- toute nouvelle fonction V74 doit être ré-auditée selon les contrôles de `SECURITY.md`.

## 29.7 Référentiel V74

Le fichier `public/referentiel_pia_v74_0_3.json` formalise les règles de convergence, les relations sémantiques autorisées/interdites, les règles d’interprétation et les matrices de pertinence Q2→Q6. Il complète la bibliothèque WBE `bibliotheque_indicateurs_v0_5_1.json` ; il ne la remplace pas.

## 29.8 Limites documentées

Le moteur intégré est volontairement conservateur. Il fournit une synthèse exploitable pour le terrain mais ne constitue pas un système NLP exhaustif. Les propositions doivent rester contrôlables par le professionnel et les validations réelles doivent être effectuées avec les données de séances effectivement encodées.

### V74 — Référentiel et cycle de validation

Le runtime V74 lit les paramètres de convergence depuis `public/referentiel_pia_v74_0_3.json`. Les seuils et exceptions du référentiel sont donc la configuration active du moteur ; ils ne sont pas considérés comme une vérité pédagogique et restent calibrables.

Les objectifs issus du PIA précédent restent une `SOURCE_DE_CONTINUITE`. La réunion 1 conserve les objectifs validés avec leur date et leur thème. La réunion 2 compare les nouvelles séances avec ces objectifs validés ; son état reste `A_DISCUSSER` jusqu’à la validation professionnelle.

Le fichier PIA Word/PDF sélectionné est traité localement dans le navigateur. Journalier n’enregistre pas le document original ni son nom de fichier comme donnée de continuité. Seule une structure extraite et limitée aux éléments utiles au suivi PIA est conservée dans le DataStore chiffré. Les PDF scannés/image sans couche texte exploitable nécessitent un OCR, qui n’est pas intégré à cette version.


## 29.9 V74.1 — import/export documentaire et interface d’accueil

### Import PIA précédent

Le dossier élève accepte les formats :

- Word `.docx` ;
- PDF `.pdf`.

Le traitement est local. Le document est lu en mémoire, les éléments PIA utiles sont extraits, puis le fichier source est abandonné. Le nom du fichier n’est pas conservé.

La structure conservée distingue notamment les objectifs précédents, ressources, difficultés, adaptations P/O/M et sections PIA reconnues. Elle reste une `SOURCE_DE_CONTINUITE` à réévaluer, jamais une validation automatique.

### Export

Le PIA interne reste JSON structuré. L’interface propose deux niveaux d'exportation :
1. **Dossier de travail détaillé (usage interne)** : export documentaire libre en Word (.docx) ou PDF (.pdf) généré par `v74-docx-export.js` / `v74-pdf-export.js` ;
2. **Document Officiel PIA WBE (Annexe 2)** : export Word (.docx) et PDF (.pdf) strictement conformes au modèle officiel vierge fourni par WBE (`public/modeles/PIA_modele_officiel_2025-09-11.docx`), déclenchés directement depuis les écrans de réunion 1 (décembre) et réunion 2 (fin d'année), avec variantes nominatives et dé-identifiées.

### 29.10 Moteur d'exportation officiel Word PIA WBE (Chantier 4)

Le moteur officiel PIA (`src/v74/v74-docx-export.js` et `src/v74/v74-docx-pia-pv.js`) repose sur les règles techniques suivantes :
- **Archive modèle officielle** : injection directe sans recomposition destructrice de l'archive ZIP (`buildZipStoreArchive`). Seuls `word/document.xml`, `word/header1.xml`, `word/header2.xml` et `docProps/core.xml` sont modifiés ; les éléments binaires et logos restent intacts.
- **Priorité de chargement** : recherche du modèle selon l'ordre validé `/modeles/PIA_modele_officiel_2025-09-11.docx` puis `./modeles/PIA_modele_officiel_2025-09-11.docx`, avec repli en mémoire tampon (`getEmbeddedOfficialPIATemplateBytes`).
- **Tableau d'identité T1** : injection ciblée des champs administratifs de la fiche élève :
  - Nom et prénom de l'élève ;
  - Date de naissance convertie au format `jj/mm/aaaa` (ex. `15/03/2014` pour `2014-03-15`) ;
  - École et coordonnées complètes ;
  - Classe et option ;
  - Titulaire de classe (issu de `student.titulaire` / `administrativeInfo.titulaire`) ;
  - Coordonnées du CPMS coopérant (issues de `student.coordonneesCpms` / `administrativeInfo.coordonneesCpms`) ;
  - Représentant du Pôle territorial (`Pôle Territorial WBE BXL`) ;
  - Parents ou responsable légal et coordonnées.
- **Tableau des 5 aspects T2** : injection dans les lignes L1 à L5 avec préservation de la taille 16 pt (`w:sz w:val="32"`).
- **Procès-Verbaux 1 et 2 (PV1 & PV2)** :
  - Paragraphe « Date : » hors tableau, avec insertion de la date en `jj/mm/aaaa` sans gras avec conservation des attributs de police originaux ;
  - Tableau des personnes présentes (T3 pour PV1, T6 pour PV2) : grille de base 3×3 (9 personnes), clonage automatique de lignes de 3 cellules au même format si le nombre de présents dépasse 9 ;
  - Lignes réponses pleine largeur : difficulté majeure (axe), objectifs et critères, ressources complémentaires (PV1) et évaluation des objectifs (PV2) insérées dans la ligne qui suit chaque libellé officiel ;
  - Retours des partenaires : 6 cases appariées (Parents, Direction & équipe, Élève, CPMS, Agent d'intégration, Autres), avec fusion exhaustive « Direction : … » + « École / équipe : … ».
- **Tableaux d'aménagements (T5 & T8)** :
  - 10 lignes initiales ordonnées N° | P | O | M | Description ;
  - Marquage « X » centré pour chaque catégorie cochée (Pédagogique, Organisationnel, Matériel) avec balise `<w:jc w:val="center"/>` positionnée avant `<w:rPr>` (conformité stricte au schéma WordprocessingML) ;
  - Clonage et renumérotation automatique (`n` + espace insécable) au-delà de 10 aménagements.
- **Nommage canonique des fichiers** (`buildOfficialPIAFileName`) : `PIA - Nom Prénom - décembre [année].docx` ou `PIA - Nom Prénom - fin d'année [année].docx` avec assainissement des caractères réservés.

### 29.11 Moteur d'exportation officiel PDF et Dé-identification RGPD (Lots 5 & 6)

- **Générateur PDF officiel natif (`src/v74/v74-pdf-export.js`)** :
  - Génération autonome en PDF 1.4 pur sans dépendance externe ;
  - Architecture hybride calquée sur la mise en page OpenXML : Page 1 en format Paysage A4 (842 × 595 pt) pour héberger fidèlement le cartouche d'identité T1 et le tableau T2 des 5 aspects ; Pages 2+ en format Portrait A4 (595 × 842 pt) pour les PV1, PV2 et tableaux d'aménagements T5 et T8 ;
  - Tracé vectoriel natif du logo institutionnel des Pôles territoriaux dans le cartouche d'en-tête ;
  - Pagination dynamique et respect des césures typographiques (`splitPdfTextLine`).
- **Chaîne d'anonymisation et de dé-identification (Lot 6)** :
  - **Source unique de vérité** : `buildOfficialPIADocumentModel(pia, deidentified, options)` garantit la parité absolue entre Word et PDF ;
  - **Cartouche d'identité T1** : toutes les cellules nominatives sont vidées (`nom`, `dateNaissance`, `coordonneesEcole`, `classeEtOption`, `titulaire`, `coordonneesCpms`, `coordonneesResponsable`), seul l'ancrage institutionnel `representantPole` subsiste ;
  - **Personnes présentes (PV1 & PV2)** : conversion systématique de chaque participant en son rôle ou sa qualité (`Directeur`, `Parent`, `Titulaire`, `CPMS`, etc.) via `formatPersonnePresente` sans patronyme direct ni indirect ;
  - **Neutralisation des contextes sensibles** : les dates de réunions et les retours libres des partenaires sont neutralisés (cellules vides) pour éviter toute divulgation de notes individuelles ou d'éléments identifiants ;
  - **Métadonnées et nommage** : `docProps/core.xml` et dictionnaire PDF `/Info` expurgés de tout nom d'élève, nom de fichier normalisé `PIA - Élève 1 - décembre [année].docx` / `.pdf` ;
  - **Boutons d'action dans l'interface** : barres d'exportation de réunion 1 et réunion 2 équipées de boutons dédiés « 🛡️ Word dé-identifié » et « 🛡️ PDF dé-identifié » interfacés par le registre `JR_HANDLERS` (`h89`, `h90`, `h91`, `h92`) conformément à la CSP `script-src 'self'`.

### Accueil

La zone `Accès rapide`, redondante avec la navigation principale, est remplacée par un tableau de bord fonctionnel :

- tendances descriptives des 30 derniers jours ;
- suivi du cycle PIA ;
- mémos personnels.

Les tendances sont des fréquences de séances documentées, pas des scores de difficulté.

## 30. V74 — Rapports et cycle PIA

L'espace Rapports & PIA contient quatre onglets : **Journalier** (séances de la période affichées comme sur le papier, avec export Word), **Réunion** (synthèse en langage simple produite par le moteur de rédaction), **Propositions** (propositions d'objectifs à valider, mécanique V74) et **PIA annuel**. La période choisie en haut de page (année scolaire par défaut) s'applique aux quatre onglets. Voir le chapitre 32.

Le runtime PIA présente les cinq domaines, les propositions et leurs décisions, ainsi que les réunions structurées et le suivi annuel. Le cycle géré par le runtime est `EN_CONSTRUCTION` → `EN_VIGUEUR` → `EN_REEVALUATION` → `EN_VIGUEUR` → `FINALISE`; l'ancien état `ACTIF` reste reconnu pour compatibilité.

Les exports de séance, de synthèse, de réunion et de PIA utilisent les formats de restitution prévus par l'application. La dé-identification est appliquée aux exports de modèle; elle ne transforme pas les données nominatives du PIA professionnel. Le build Vite valide la compilation, mais ne remplace pas les essais authentifiés Entra/Graph ni les tests avec des données de migration.

## 31. Référentiel des Aménagements WBE et Assistant IA Local

### 31.1 Référentiel des Aménagements Raisonnables (`src/app/referentiel-amenagements.js`)

Le module gère une base de connaissances locale de **544 fiches d'aménagements** compilées depuis :
1. Le *Guide des aménagements raisonnables du Pôle Territorial WBE Wapi A* (498 fiches, Enseignement fondamental) ;
2. Le *Kit outils secondaire du Pôle Territorial WBE* (49 fiches, Enseignement secondaire).

Le jeu de données est stocké sous forme de ressource statique dans `public/referentiel_amenagements_wbe.json` et chargé à la demande via `fetch` asynchrone pour ne pas ralentir le démarrage initial de l'application.

```text
public/referentiel_amenagements_wbe.json (544 fiches)
               │
               ▼ (fetch asynchrone différé)
src/app/referentiel-amenagements.js
   ├── searchItems(query, filters)
   ├── findBestMatches(contextText, maxResults)
   └── attachContextualSuggestions() ───► Injections discrètes DOM :
                                            ├─ .v74-prop (PIA annuel)
                                            ├─ .synth-prop-card (Synthèse)
                                            └─ Modale de recherche et sélection
```

**Composant de rapprochement automatique (`findBestMatches`) :**
- Analyse sémantique basée sur les mots-clés du domaine, de l'aspect et du constat de la séance.
### 31.2 Assistant de rédaction local (`src/app/local-ai-assistant.js`)

L'assistant est conçu selon un principe de traitement strictement local :
- **Traitement local dans le navigateur :** Aucun appel API sortant (pas de modèle cloud, pas de télémétrie).
- **Moteur déterministe & rapide :** Règles grammaticales, dictionnaire de correspondances sémantiques et patrons de structuration en 3 axes exécutés en pur JavaScript côté client (< 5 ms de temps de réponse).
- **Validation humaine préservée :** Aucune modification de champ n'est effectuée de manière autonome. Une modale interactive (`#local-ai-modal`) affiche le texte d'origine, le texte proposé et les boutons de décision (`✓ Remplacer le texte`, `+ Ajouter à la suite`, `Annuler`).

---

# 32. V75 — Refonte séance → Journalier → réunion → PIA

## 32.1 Composants

| Composant | Rôle |
| :--- | :--- |
| `redaction-engine.js` | Faits → constats → texte (déterministe, voix neutre, sans comptage), évolution, absences, synthèse par matière, dé-identification |
| `journalier-seances-docx.js` | Remplit le modèle Word papier : tableau d'identité, un tableau cloné par séance, XML échappé, métadonnées neutralisées |
| `session-levels.js` | Contrôle de niveau de la séance, détection des niveaux manquants |
| `reunion-view.js` | Vue Réunion (synthèse simple) et bouton d'export PIA officiel |
| `students-core.js` | Journalier : liste filtrée par période, détail « comme le papier » (`renderJournalierPaperHtml`) |
| `reports-core.js` | Périodes `ANNEE` (défaut), `ADATE`, `LIBRE`, `HEBDO`, `MENSUEL`, `PV1`, `PV2` ; bouton « Exporter le Journalier » |

## 32.2 Flux

```text
Agenda (créneau) ─ encodage ─▶ séance (contexte, objectif, q2–q6)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
  Journalier (écran)        Journalier Word            Réunion (synthèse)
  moteur → bloc papier      moteur + modèle papier     moteur.synthese()
                                                              │
                                                              ▼
                                              Propositions → PIA annuel → Word/PDF officiel
```

## 32.3 Agenda et séance

- `agenda.__events` : un événement `ELEVE` passe à Réalisé lorsqu'une séance correspondante est encodée (`getEventState`, `getEncodedForEvent`).
- Annulation avec motif : `absent_eleve`, `absent_prof`, `absent_agent` créent une séance d'absence et annulent le créneau ; `absent_eleve_coteach` garde le créneau **réalisé** et ouvre la séance en mode co-enseignement.
- Les matières proposées viennent du dossier élève (`refreshSlotSubjects`, `currentStudentSubjects`).

## 32.4 Points de vigilance

- Les scripts classiques ajoutés en V75 sont déclarés dans `index.html` et dans `vite.config.js` (`copyClassicAppScripts`).
- La vue « Propositions » conserve la mécanique de synthèse V74 (états `OBSERVATION` à `PROPOSITION`) ; seuls ses libellés ont été simplifiés.
- La date de naissance et le titulaire du Word proviennent du dossier élève ; ils restent vides s'ils ne sont pas renseignés.
- Le choix de période s'applique au Journalier, à ses statistiques, à l'export et à la Réunion.
- Le modèle Word est lu par `fetch` (`./modeles/Journalier_modele_papier.docx`) : il doit rester dans `public/modeles/`.

