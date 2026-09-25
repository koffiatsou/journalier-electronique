# Audit V73.1 — stabilisation interface, PIA et sécurité

Date : 25 septembre 2026

## Contrôles effectués sur le package de présentation

- Présence du cœur V72.2 : `index.html`, MSAL, workflows GitHub, bibliothèque WBE et documentation de sécurité.
- Intégration de `src/v73/v73-runtime.js` dans `index.html`.
- Présence de `public/referentiel_pia_v73_0_3.json`.
- Utilisation de `JournalierDataStore` pour la lecture et la persistance.
- Réutilisation de `JournalierCloud.savePia()` pour la sauvegarde distante.
- Import PIA local Word/PDF.
- Exports PIA Word/PDF avec choix du format, plus JSON technique.
- Tableau de bord d’accueil : tendances descriptives, suivi PIA et mémos.
- Validation professionnelle explicite avant passage du projet à l’état `VALIDÉ`.
- Conservation de la trace des séances, états et contre-évidences.
- Mise à jour de `README.md`, `ARCHITECTURE.md`, `SECURITY.md` et `CHANGELOG.md` pour documenter V73.

## Contrôle de cohérence documentaire

Le projet fourni ne contient pas de fichier nommé `INFO` ou `INFORMATIONS`. Les documents de référence présents sont `README.md`, `ARCHITECTURE.md`, `SECURITY.md` et `CHANGELOG.md`. Ils ont été complétés avec l’évolution V73.

## Limites connues

- Le moteur V73 intégré est une couche de synthèse conservatrice côté navigateur ; il ne constitue pas un moteur NLP exhaustif.
- Les tests conceptuels précédemment réalisés ne remplacent pas une validation terrain sur des séances réellement encodées.
- Le build npm complet doit être rejoué dans le Codespace après intégration du runtime V73.1. L’environnement d’audit hors Codespace ne dispose pas des dépendances installées.
- Les générateurs Word/PDF ont été testés indépendamment : archive DOCX valide, PDF valide et extraction PDF textuelle testée sur flux non compressé et compressé.

## Contrôles sécurité V73.1

- CSP `script-src` : 3 hashes calculés sur les scripts inline de `index.html`, correspondance exacte avec les hashes déclarés.
- `unsafe-inline` absent de `script-src`.
- Le runtime V73.1 n’introduit aucun endpoint réseau externe.
- Le runtime passe par `JournalierDataStore` et `JournalierCloud` existants.
- Les documents importés restent locaux ; aucune transmission Graph pendant l’analyse.
- Les noms de fichiers PIA importés ne sont pas conservés dans la structure de continuité.
- Les exports dé-identifiés retirent les identifiants, dates de preuve, identifiants de séances et métadonnées de génération.
- Des limites de taille et de décompression sont appliquées aux imports.

## Règle de présentation

Pour la démonstration : connexion → Élèves → dossier élève → import PIA Word/PDF → Rapports & PV → PIA annuel V73 → sélection de l’élève → génération → validation éventuelle → choix Word/PDF → export.
