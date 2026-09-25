# Audit V73.1.3 — PIA, migration et sécurité — 25 septembre 2026

## État

Cette version reprend la base V73.1.2 fournie et ajoute la correction de l'intégration du module de migration legacy.

### Architecture conservée

- SPA statique GitHub Pages.
- Microsoft Entra ID / MSAL Browser.
- Microsoft Graph.
- OneDrive AppFolder par agent.
- IndexedDB / DataStore local.
- Aucun backend ni dépôt central de données métier.

## Correction de migration

Le bug observé après connexion était :

```text
graphGetAppRoot is not defined
```

Cause : `src/v73/v73-migration.js` est un module ES et ne peut pas accéder directement aux fonctions privées du script principal `index.html`.

Correction :

- ajout de `window.JournalierMigrationBridge` dans `index.html` ;
- exposition limitée des fonctions Graph, validation, normalisation, DataStore, sécurité et synchronisation nécessaires ;
- lecture dynamique de `msAccount` ;
- aucune modification des permissions Graph.

## Migration legacy

La migration attend :

```text
AppFolder/
└── Journalier-legacy/
```

Elle importe vers :

```text
AppFolder/
└── Journalier/
```

Principes :

- copie manuelle préalable par l'utilisateur ;
- validation avant import ;
- conservation du `studentId` historique ;
- remplacement du propriétaire technique par l'identité Entra courante ;
- détection des conflits ;
- aucun écrasement silencieux ;
- aucune suppression de `Journalier-legacy` ;
- aucune suppression de l'ancien dossier original ;
- aucune conversion automatique d'une ancienne valeur PIA en PIA annuel validé.

## CSP

Après modification de `index.html`, les trois hashes SHA-256 correspondent exactement aux trois scripts inline présents :

```text
sha256-r71q19ylX2SSs9dktu0dGYcJSzEwLh9Cq16Mm94MHL0=
sha256-cYvJqioownLeZ+GTZaWtubXH4lcoDBJ0hPqAe7Ct2pc=
sha256-2VXoqkGo/SnASYZTjVZiVP4KwV4Lw7ZSmqgOUESRh/I=
```

`unsafe-inline` reste absent de `script-src`.

## Contrôles réalisés sur le package de correction

- Syntaxe `src/v73/v73-migration.js` : PASS.
- Correspondance exacte CSP : PASS.
- Aucun nouveau scope Graph introduit : PASS.
- Aucun appel de suppression distante introduit par la migration : PASS.
- `git diff --check` : à rejouer dans le dépôt Git du Codespace après insertion des fichiers.
- `npm run build` : à rejouer dans le Codespace ; le package de correction hors dépôt ne dispose pas actuellement de l'installation Vite nécessaire.

## Test terrain restant

Le test de migration doit être effectué avec une copie réelle ou de test :

```text
Journalier-legacy/
├── eleves/
├── agenda/
└── ...
```

Cette copie doit être placée dans l'AppFolder avant l'analyse. Aucun test de migration ne doit supprimer la source.

## Limites

Cet audit décrit les contrôles effectués sur cette correction. Il ne constitue pas une certification de sécurité ni une garantie d'absence de vulnérabilité.
