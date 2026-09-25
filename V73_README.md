# Journalier V73 — présentation du 25 septembre 2026

## État

Cette version intègre V73 directement dans le Journalier existant. Aucun module n’est laissé à « raccorder plus tard ».

## Fonctionnalités V73

- PIA annuel ;
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
- export professionnel JSON ;
- export imprimable HTML ;
- export de modèle dé-identifié JSON.

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


### Correctifs V73.0.1 (25/09/2026)
- Les seuils de convergence sont lus depuis `public/referentiel_pia_v73_0_3.json`.
- Le PIA précédent est traité comme source de continuité ; les objectifs existants restent distincts des propositions.
- La validation de la réunion 1 est datée et réutilisée pour préparer la réunion 2.
- La réunion 2 évalue les objectifs validés à partir des séances postérieures, sans les déclarer atteints automatiquement.
- Le thème `raisonnement_procedure` est corrigé.
