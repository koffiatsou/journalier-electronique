# Journalier V73.1.3 — migration sécurisée et stabilisation PIA — 25 septembre 2026

## V73.1.3 — correction migration legacy

- Correction du problème de portée JavaScript entre `index.html` et `src/v73/v73-migration.js`.
- Ajout du pont `window.JournalierMigrationBridge`.
- Lecture dynamique de l'identité Microsoft connectée pour la migration.
- Aucune permission Graph supplémentaire.
- Migration non destructive : la copie `Journalier-legacy` reste conservée.
- Les conflits sont bloquants afin d'éviter un écrasement silencieux.

## État

Cette version intègre V73 directement dans le Journalier existant. Aucun module n’est laissé à « raccorder plus tard ».

## Fonctionnalités V73

- PIA annuel ;
- import local du PIA précédent en Word (`.docx`) ou PDF (`.pdf`) ;
- continuité avec un PIA précédent ;
- réunion 1 / décembre ;
- réunion 2 / fin d’année ;
- analyse des séances et des données Q2→Q6 ;
- prise en compte des textes libres renseignés dans les séances ;
- rapprochement longitudinal conservateur ;
- propositions d’objectifs ;
- propositions d’aménagements P/O/M ;
- validation professionnelle des propositions ;
- sauvegarde dans le DataStore existant ;
- sauvegarde OneDrive via le mécanisme existant ;
- export professionnel Word ou PDF, au choix ;
- export professionnel JSON technique ;
- export du modèle dé-identifié Word ou PDF, au choix ;
- export du modèle dé-identifié JSON technique ;
- tableau de bord d’accueil : tendances descriptives, suivi PIA et mémos personnels.

## Architecture

V73 ne remplace pas l’architecture V72.2 : GitHub Pages + Entra ID + Graph + OneDrive AppFolder + IndexedDB/DataStore.

## Documents de référence

- `README.md` : présentation fonctionnelle générale ;
- `ARCHITECTURE.md` : architecture technique et extension V73 ;
- `SECURITY.md` : contrôles de sécurité et règles V73 ;
- `CHANGELOG.md` : historique des modifications ;
- `public/referentiel_pia_v73_0_3.json` : règles PIA/convergence ;
- `AUDIT_V73_PRESENTATION.md` : état de préparation et limites connues.

## Important

Le moteur V73 fournit des propositions. Il ne valide pas automatiquement un objectif PIA et n’affirme pas de causalité entre une adaptation et une évolution observée.


### V73.1.0 — stabilisation finale de présentation (25/09/2026)
- Import PIA Word/PDF traité localement et conversion en structure PIA ; le document original et son nom de fichier ne sont pas conservés par Journalier.
- Exports PIA Word/PDF générés localement à partir de la structure interne.
- Export dé-identifié renforcé : suppression des identifiants élève/école/classe, dates, identifiants de séances, continuité nominative et métadonnées de génération.
- Remplacement des accès rapides redondants de l’accueil par un tableau de bord fonctionnel.
- Ajout de tendances descriptives sur les 30 derniers jours, d’un suivi PIA et de mémos personnels stockés dans le DataStore chiffré local.
- Renforcement des limites d’import local : taille de fichier, nombre d’entrées DOCX et volume après décompression.

### Correctifs V73.0.1 (25/09/2026)
- Les seuils de convergence sont lus depuis `public/referentiel_pia_v73_0_3.json`.
- Le PIA précédent est traité comme source de continuité ; les objectifs existants restent distincts des propositions.
- La validation de la réunion 1 est datée et réutilisée pour préparer la réunion 2.
- La réunion 2 évalue les objectifs validés à partir des séances postérieures, sans les déclarer atteints automatiquement.
- Le thème `raisonnement_procedure` est corrigé.
