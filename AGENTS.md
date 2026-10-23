# AGENTS.md — Règles pour les IA de codage

## Projet
Journalier électronique : application web local-first pour les Pôles territoriaux WBE.
Données d'élèves mineurs : confidentialité stricte (RGPD).

## Avant de modifier
1. Lire README.md et ARCHITECTURE.md.
2. Lancer `npm run lint` et `npm test`. Noter le résultat.
3. Annoncer le plan en quelques lignes avant de modifier le code.

## Règles
- Ne change aucun comportement visible sans demande explicite.
- Aucune donnée réelle d'élève : exemples et tests avec données fictives uniquement.
- Aucun script ni gestionnaire d'événement en ligne dans index.html (CSP : script-src 'self').
- Aucune nouvelle dépendance sans accord.
- Ne tronque jamais un fichier et n'écris jamais « reste du code inchangé ».
- Un sujet par modification. Petits lots.
- Ne déclare jamais avoir testé ce que tu n'as pas exécuté.

## Style de code
- Une instruction par ligne. Mise en forme automatique (Prettier).
- Fichiers courts (moins de 800 lignes) et à rôle unique.
- Fonctions courtes (idéalement moins de 50 lignes), nommées par un verbe clair.
- JSDoc sur chaque fonction publique. Commentaires sur le pourquoi.
- Constantes nommées, pas de nombres isolés.
- Aucune erreur avalée en silence.
- Pas de code mort, pas de code commenté, pas de TODO sans explication.

## Tests
- Tout bug corrigé reçoit un test qui échoue avant et réussit après.
- Préférer les tests qui exécutent le code aux tests qui cherchent du texte dans le code source.
- Les tests actuels s'appuient en partie sur des repères textuels du code source : ne pas déplacer ou renommer ces repères sans adapter les tests en même temps.

## Pièges connus
- journalier-core.js et indicators.js sont des scripts classiques : leurs fonctions sont globales.
- Tout script classique (dont redaction-engine.js, journalier-seances-docx.js, session-levels.js, reunion-view.js) doit être déclaré dans index.html ET dans copyClassicAppScripts() de vite.config.js, sinon il manque au build.
- Les clés de séance q2 à q6 et la base journalier-secure-v74 gardent leur nom : ce sont des données déjà stockées.
- Le texte du Journalier vient du moteur de rédaction : ne pas écrire de phrases en dur ailleurs ; ajouter un test dans tests/redaction-engine.test.cjs.
- Les scripts UMD sont testés sous Node via tests/charger-moteur.cjs et tests/charger-docx.cjs (package.json en type module).
- Les clics passent par le registre JR_HANDLERS (attribut data-jr-handlers).
- Une fonction peut n'être appelée que dans un chemin de repli : vérifier avant de la supprimer.
- Une analyse statique produit des faux positifs : confirmer en exécutant l'application.

## Avant de terminer
- Mettre à jour la documentation touchée : README.md, ARCHITECTURE.md, docs/, CHANGELOG.md.
- `npm run lint`, `npm test`, `npm run build` doivent réussir.
- La documentation ne cite aucun fichier ou comportement disparu.
- Résumer : fichiers modifiés, raison, vérifications faites, risques restants.