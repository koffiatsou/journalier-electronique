# Agenda V74 — modèle fonctionnel

## Objectif

L'Agenda est le planificateur de travail du Journalier. Il distingue la planification d'une activité de sa réalisation effective.

## Événement

Le stockage canonique utilise `agenda.__events`. Un événement contient notamment :

- `eventId` : identifiant stable de l'événement ;
- `seriesId` : identifiant de série pour une récurrence hebdomadaire ;
- `recurrence` : `weekly` ou `unique` ;
- `dayIndex` / `date` ;
- `startPeriod` / `endPeriod` ;
- `type` : élève, collaboration, formation, administratif ou libre ;
- `eventStatus` : `proposed`, `realized`, `cancelled` ;
- `realized` / `realizedAt` ;
- `timezone` : fuseau de référence de l'événement (`Europe/Brussels` par défaut) ;
- `outlook` : emplacements réservés pour la future liaison Microsoft Graph.

Plusieurs événements peuvent avoir des périodes qui se recouvrent. Le chevauchement est une situation normale de planification et ne déclenche plus de modal de conflit bloquant.

## Séance et réalisation

Pour un événement `ELEVE`, la réalisation est déterminée par la présence d'une séance correspondant au même élève, à la même date et à des périodes qui se recouvrent. Le rapprochement utilise l'identifiant élève lorsqu'il est disponible et conserve le nom comme filet de compatibilité.

Lorsqu'une séance est déplacée ou corrigée, le rapprochement tente de déplacer l'événement unique associé. Pour une occurrence issue d'une série hebdomadaire, une occurrence unique réalisée est créée afin de ne pas modifier toute la série.

La suppression d'une séance retire également l'état réalisé d'un événement élève lorsqu'un rapprochement unique est établi.

Les événements non pédagogiques (`COLLAB`, `FORMATION`, `ADMIN`, `LIBRE`) possèdent leur propre état de réalisation et peuvent être marqués réalisés ou remis à l'état non réalisé depuis la fiche d'action.

## États et chevauchements

Une nouvelle activité est créée comme `proposed` (**Planifié**). Plusieurs propositions peuvent coexister sur un même créneau : elles sont affichées côte à côte et ne sont pas supprimées lorsqu'une autre activité est choisie.

Pour une séance `ELEVE`, le passage à **Réalisé** provient de l'encodage de la séance dans l'Historique. Une séance historique est projetée dans les vues Agenda, même lorsqu'aucun événement planifié correspondant n'existait.

Les événements non pédagogiques (`COLLAB`, `FORMATION`, `ADMIN`, `LIBRE`) peuvent être marqués **Réalisé** directement depuis leur fiche d'action. Toute activité peut être **Annulée** sans être supprimée.

Les anciennes données portant `eventStatus: "confirmed"` sont converties en `proposed` lors de la normalisation ; `confirmed` n'est plus un état actif du modèle V74.

## Périodes

Les huit libellés `1e H` à `8e H` sont fixes. Leurs horaires sont configurables dans `agenda.__config.periods`.

Les pauses ne sont pas des périodes : elles sont représentées par l'espace entre l'heure de fin d'une période et l'heure de début de la suivante. Les périodes ne peuvent pas se chevaucher.

## Compatibilité

`secureNormalizeAgenda()` accepte les anciens créneaux V72/V74 (`jour_période`, `__uniqueEvents`, `__exceptions`) et les convertit vers `__events` sans supprimer les données source lors de la lecture. Le registre de synchronisation et les identifiants techniques historiques restent inchangés.

## OneDrive et Microsoft Graph

`agenda/agenda.json` reste le fichier partagé dans l'AppFolder. Le validateur distant accepte le nouveau modèle et continue d'accepter les anciennes structures nécessaires à la migration.

La synchronisation Outlook n'est pas activée dans cette version. Les propriétés `outlook` sont réservées au futur mapping vers Microsoft Graph : calendrier, identifiant d'événement, `iCalUId`, `changeKey` et lien web.

## CSP

La refonte n'ajoute aucune origine réseau, aucun script inline et aucun domaine externe. La CSP existante est conservée : `script-src 'self'`, les connexions Microsoft Graph/Entra déjà autorisées et les feuilles CSS locales restent inchangées.
