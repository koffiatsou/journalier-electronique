# Audit complet et nettoyage — Journalier V74

Date : 30 septembre 2026

## Base de départ

Cette archive a été reconstruite à partir du ZIP d'audit fourni par l'utilisateur le 30 septembre 2026.
La base a été relue dans son ensemble puis réalignée avec les décisions fonctionnelles V74 établies pendant le chantier Agenda.

## Règle métier Agenda retenue

L'Agenda utilise trois états actifs :

- `proposed` → **Planifié**
- `realized` → **Réalisé**
- `cancelled` → **Annulé**

`confirmed` n'est plus un état actif. Pour préserver les anciennes données, une valeur historique `confirmed` est convertie en `proposed` lors de la normalisation.

Les chevauchements sont autorisés : plusieurs événements planifiés peuvent coexister sur un même créneau.

Pour un événement `ELEVE`, **Réalisé** est déterminé par une séance effectivement enregistrée dans l'Historique. Une séance historique est projetée dans les vues jour, semaine et mois même lorsqu'aucun événement planifié correspondant n'existait. Cette projection virtuelle n'est pas enregistrée dans `agenda.__events`.

Les événements non pédagogiques (`COLLAB`, `FORMATION`, `ADMIN`, `LIBRE`) peuvent être marqués Réalisé directement depuis l'Agenda.

## Historique

Le cœur métier gère directement les actions Modifier et Supprimer de l'Historique. Le module Microsoft Graph ne contient plus de dépendance vers les fonctions internes de l'Historique.

Le bouton Modifier du détail est rebinding après chaque rendu dynamique du panneau et le gestionnaire de liste couvre également les boutons générés dans la liste.

## Agenda ↔ Historique

Le rapprochement utilise les périodes normalisées `startIndex` / `endIndex`.
Une séance enregistrée peut :

1. rendre Réalisé un événement planifié correspondant ;
2. ou produire une occurrence virtuelle Réalisé si aucun événement planifié ne correspond.

Lorsqu'une séance est supprimée, le rapprochement rétablit l'état Planifié de l'événement prévisionnel lorsqu'un rapprochement unique et fiable est établi.

## Microsoft Graph / OneDrive

Le validateur Agenda n'accepte comme états actifs que `proposed`, `realized` et `cancelled`.
Les propriétés Graph existantes de l'événement sont conservées et les métadonnées Outlook restent réservées à la future synchronisation.

L'architecture SPA + Entra ID + Microsoft Graph + OneDrive AppFolder reste inchangée.

## CSP / sécurité

La CSP de `index.html` reste fondée sur `script-src 'self'`. Aucun nouveau domaine, script inline ou mécanisme d'authentification n'a été ajouté.

Les actions d'interface utilisent les mécanismes existants et les attributs `data-*`; aucune action dynamique ne réintroduit de script inline.

## Tests exécutés

Les contrôles suivants ont été exécutés sur cette base :

- `node --check` sur tous les fichiers JavaScript sous `src/` : **PASS** ;
- `node tests/agenda-v74-contract.test.mjs` : **PASS** ;
- contrôle des 8 périodes : **PASS** ;
- contrôle du modèle `__events` et des trois états actifs : **PASS** ;
- contrôle des rapprochements Agenda/Historique : **PASS** ;
- contrôle CSP statique : **PASS** ;
- contrôle des IDs HTML : **PASS** ;
- contrôle Graph/migration : **PASS**.

## Build production

`npm run build` n'est pas déclaré comme exécuté dans l'environnement de préparation de cette archive. La validation de production doit être effectuée dans le Codespace avec les dépendances du projet :

```bash
npm ci
npm run build
```

Le résultat de ces commandes devra être traité comme la validation du build de la base importée.

## Nettoyage effectué

Les artefacts intermédiaires de correction du 30 septembre (`docs/AUDIT_CORRECTIONS_2026-09-30.md` et `.patch`) ne font pas partie de cette base propre. Le nouvel audit global est conservé dans ce fichier.

Les documents historiques et les mentions historiques de décisions antérieures restent distincts du modèle actif ; ils ne constituent pas des états fonctionnels du code actuel.
