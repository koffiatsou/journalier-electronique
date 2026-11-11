# AGENTS.md — Règles pour les IA de codage

## Projet
Journalier électronique : application web local-first pour les Pôles territoriaux WBE.
Données d'élèves mineurs : confidentialité stricte (RGPD).
Tout le code est dans `v2/`. **Lire `v2/AGENTS.md` en premier** (mémoire du projet, pièges connus, flux de travail), puis `v2/README.md`.

## Avant de modifier
1. Lancer `cd v2 && npm run check` (typecheck + tests + build). Noter le résultat.
2. Annoncer le plan en quelques lignes avant de modifier le code.

## Règles
- Ne change aucun comportement visible sans demande explicite.
- Aucune donnée réelle d'élève : exemples et tests avec données fictives uniquement.
- Aucun script ni gestionnaire d'événement en ligne (CSP : `script-src 'self'`).
- Aucune nouvelle dépendance sans accord.
- Ne tronque jamais un fichier et n'écris jamais « reste du code inchangé ».
- Un sujet par modification. Petits lots. Une nouvelle branche par travail précis, créée depuis `main`.
- Ne déclare jamais avoir testé ce que tu n'as pas exécuté.

## Style de code
- Une instruction par ligne.
- Fichiers courts (moins de 800 lignes) et à rôle unique.
- Fonctions courtes (idéalement moins de 50 lignes), nommées par un verbe clair.
- JSDoc sur chaque fonction publique. Commentaires sur le pourquoi.
- Constantes nommées, pas de nombres isolés.
- Aucune erreur avalée en silence.
- Pas de code mort, pas de code commenté, pas de TODO sans explication.

## Tests
- Tout bug corrigé reçoit un test qui échoue avant et réussit après.
- Préférer les tests qui exécutent le code aux tests qui cherchent du texte dans le code source.

## Avant de terminer
- Mettre à jour la documentation touchée (`v2/README.md`, `v2/AGENTS.md`, `v2/docs/`).
- `cd v2 && npm run check` doit réussir.
- La documentation ne cite aucun fichier ou comportement disparu.
- Résumer : fichiers modifiés, raison, vérifications faites, risques restants.
