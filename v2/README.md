# Journalier V2 — React + TypeScript

Réécriture du Journalier électronique, construite **à côté** de la V75 (qui reste en ligne tant que la V2 ne fait pas tout aussi bien).

## Pourquoi une réécriture
La V75 est née par ajouts successifs (≈ 33 000 lignes de JavaScript sans structure imposée). La V2 repart d'une architecture claire, vérifiée par le compilateur et par des tests, avec un design soigné et fluide.

## Principes
- **Domaine pur** (`src/domain`) : types du Journalier et règles de rédaction. Aucune dépendance au navigateur, entièrement testé.
- **Données locales** (`src/data`) : une interface `Depot` ; IndexedDB chiffré (AES-GCM, lot 7), mémoire pour les tests.
- **Interface** (`src/ui`, `src/features`) : composants React accessibles, un seul style (jetons CSS), mouvement réduit respecté.
- **Sécurité** : aucun HTML construit à la main (React échappe le texte), politique CSP stricte (`script-src 'self'`), aucun script intégré.
- **Garde-fous** : TypeScript strict, tests automatiques, `npm run check` obligatoire avant fusion (typecheck + tests + build).

## Commandes
```bash
cd v2
npm install
npm run dev        # compile puis sert http://localhost:5173
npm run check      # typecheck + tests + build (utilisé par la CI)
LANG=C.UTF-8 node tools/navigateur/journalier.mjs   # parcours dans un vrai navigateur (Playwright, serveur sur le port 5199)
LANG=C.UTF-8 node tools/navigateur/eleves.mjs       # idem pour l'écran Élèves (cartes, archivage, passage d'année, suppression)
LANG=C.UTF-8 node tools/navigateur/avatars.mjs      # idem pour les avatars dessinés
LANG=C.UTF-8 node tools/navigateur/pia.mjs          # idem pour l'écran PIA (onglets, enregistrement, export Word)
LANG=C.UTF-8 node tools/navigateur/pia-4b.mjs       # idem pour le PV 2, l'export par partie, dé-identifié, impression
LANG=C.UTF-8 node tools/navigateur/agenda-5.mjs     # idem pour l'agenda : mois, jours fériés, vacances scolaires, horaires réglables
LANG=C.UTF-8 node tools/navigateur/agenda-6.mjs     # idem : glisser pour créer, semaine type, impression
LANG=C.UTF-8 node tools/navigateur/theme.mjs     # bouton de thème Automatique / Clair / Sombre
LANG=C.UTF-8 node tools/navigateur/coffre.mjs    # coffre chiffré : verrou, mode essai, rien en clair, clé perdue, migration, copie avec mot de passe
# Depuis le lot 7, ces parcours passent par le mode essai (aide commune : tools/navigateur/_coffre.mjs).
LANG=C.UTF-8 node --import tsx tools/navigateur/synchro.mjs   # synchronisation : démonstration, conflits, Outlook, copie de secours, connexion Microsoft (faux Microsoft)
```

**Sans accès au registre npm** (environnement de travail de Claude) : les paquets aux bonnes versions (esbuild, zod, React, TypeScript, tsx) sont souvent déjà installés sur la machine ; on les relie dans `v2/node_modules` (liens symboliques, dossier ignoré par Git) et on ajoute `@types/react`, `@types/react-dom` (DefinitelyTyped) et `csstype` récupérés depuis GitHub.

## Organisation du travail
Un lot de travail par conversation : voir `docs/plan-de-travail.md` (liste des lots, fin de lot) et `docs/etat-des-lieux.md`.

## État d'avancement
| Domaine | État |
| --- | --- |
| Moteur de rédaction (blocs, synthèse, absences, dé-identification) | porté et testé |
| Écran Séance (5 étapes, feuille vivante) | disponible |
| Référentiel de compétences (pistes) | partiel (lots R1–R3) |
| Élèves (cartes, recherche, fiche, archivage, suppression, passage d'année, plusieurs langues) | disponible (lots 2 et 2b, avatars dessinés compris) |
| Écran Journalier (période, modifier/supprimer, export Word élève ou tous) | disponible (lot 1) |
| Agenda (semaine / jour / mois, couleurs, glisser‑déplacer, jours fériés et vacances scolaires FWB, horaires des périodes réglables) | disponible (lots 5 et 6 : + semaine type, création en glissant sur plusieurs périodes, impression) |
| Réunion (résumé par matière, objectifs à valider, texte à copier) | disponible (lot 3), maintenant onglet « Préparer » du PIA |
| PIA (profil, procès-verbaux 1 et 2, aménagements, export Word entier ou par partie ; onglet Préparer = ex-Réunion) | disponible (lots 4a et 4b : PV 2, export par partie, version dé-identifiée, impression / PDF) |
| OneDrive / Outlook (synchronisation sûre, conflits, copie de secours, mode démonstration) | disponible (lot 8) ; **première vraie connexion à essayer par l'utilisateur** |
| Données de démonstration (bouton sur l'accueil, effaçables) | disponible (lot 8) |
| Coffre chiffré (écran verrouillé, mode essai, migration de l'ancienne base, copie de secours avec mot de passe) | disponible (lot 7) |
| Reprise V75 | lot 9 (conseillé ensuite) |

## Outils de build
`esbuild` compile le TypeScript et React (script `scripts/build.mjs`). Pas de Vite : l'environnement de développement initial n'avait pas accès au registre npm, et `esbuild` suffit à ce stade.
