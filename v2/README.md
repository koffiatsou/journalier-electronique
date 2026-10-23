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
```

## État d'avancement
| Domaine | État |
| --- | --- |
| Moteur de rédaction (blocs, synthèse, absences, dé-identification) | porté et testé |
| Écran Séance (6 étapes, aperçu vivant de la feuille) | disponible |
| Export Word du Journalier | à porter |
| Agenda, Élèves, Historique, Réunion, PIA | à construire |
| Coffre chiffré, Microsoft/OneDrive | à porter |

## Outils de build
`esbuild` compile le TypeScript et React (script `scripts/build.mjs`). Pas de Vite : l'environnement de développement initial n'avait pas accès au registre npm, et `esbuild` suffit à ce stade.
