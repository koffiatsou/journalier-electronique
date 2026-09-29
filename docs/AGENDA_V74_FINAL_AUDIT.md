# Audit final — Agenda V74

Date : 29 septembre 2026

## Périmètre contrôlé

- modèle Agenda canonique `__events` / `__exceptions` / `__config` ;
- compatibilité avec les anciens créneaux et `__uniqueEvents` ;
- événements concurrents et calcul des voies d'affichage ;
- proposition / confirmation / réalisation / annulation ;
- réalisation indépendante des événements non liés à une séance ;
- rapprochement Agenda ↔ Historique lors de création, correction et suppression d'une séance ;
- huit périodes configurables et validation des pauses ;
- métadonnées Outlook et fuseau `Europe/Brussels` ;
- validation Graph / OneDrive ;
- migration V74 ;
- suppression d’une occurrence d’une série sans réapparition à la date supprimée ;
- regroupement des anciens créneaux contigus sans identifiant historique explicite ;
- responsive UX existante ;
- CSP ;
- IDs HTML et déclarations de fonctions.

## Contrôles automatisés exécutés

- `node tests/agenda-v74-contract.test.mjs` : réussi ;
- contrôle explicite des exceptions de récurrence et de la migration des créneaux legacy contigus : réussi ;
- test de migration legacy / chevauchement / configuration des périodes : réussi ;
- `node --check` sur tous les fichiers JavaScript `src/` : réussi ;
- contrôle des IDs HTML : aucun doublon ;
- contrôle CSP : `script-src 'self'`, domaines Graph/Entra conservés, aucun `unsafe-inline` dans `script-src` ;
- comparaison de la CSP avant/après : identique ;
- contrôle de l'absence de l'ancien modal de conflit bloquant : réussi.

## Build production

Le dépôt contient Vite `8.3.0` dans `package.json` et `package-lock.json`. L'environnement d'analyse utilisé pour préparer cette archive ne disposait pas des paquets npm installés et ne permettait pas de récupérer les paquets manquants ; aucun résultat de build Vite n'est donc présenté comme vérifié ici.

Le dépôt reste prêt à être construit par le workflow CI existant après le push. Aucun changement Agenda ne demande de nouvelle dépendance npm.

## CSP

La CSP de `index.html` n'a pas été modifiée par la refonte Agenda. Aucun nouveau domaine, script inline ou mécanisme d'authentification n'a été introduit. Microsoft Graph et Entra étaient déjà autorisés par la politique V74 existante.
