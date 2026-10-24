# Journalier V2 — React + TypeScript

Réécriture du Journalier électronique, construite **à côté** de la V75 (qui reste en ligne tant que la V2 ne fait pas tout aussi bien).

## Pourquoi une réécriture
La V75 est née par ajouts successifs (≈ 33 000 lignes de JavaScript sans structure imposée). La V2 repart d'une architecture claire, vérifiée par le compilateur et par des tests, avec un design soigné et fluide.

## Principes
- **Domaine pur** (`src/domain`) : types du Journalier et règles de rédaction. Aucune dépendance au navigateur, entièrement testé.
- **Données locales** (`src/data`) : une interface `Depot` ; IndexedDB aujourd'hui, coffre chiffré (AES-GCM) ensuite, mémoire pour les tests.
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
| Élèves (cartes, recherche, fiche, archivage, suppression, passage d'année, plusieurs langues) | disponible (lot 2) ; avatars dessinés : lot 2b |
| Écran Journalier (période, modifier/supprimer, export Word élève ou tous) | disponible (lot 1) |
| Agenda (semaine/jour, couleurs, glisser‑déplacer) | disponible (lots 5–6 : mois, vacances, semaine type) |
| Réunion, PIA | lots 3–4 |
| Coffre chiffré, OneDrive/Outlook, reprise V75 | lots 7–9 |

## Outils de build
`esbuild` compile le TypeScript et React (script `scripts/build.mjs`). Pas de Vite : l'environnement de développement initial n'avait pas accès au registre npm, et `esbuild` suffit à ce stade.
