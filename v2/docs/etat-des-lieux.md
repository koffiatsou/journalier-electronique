# État des lieux de la V2

Mis à jour le 23 octobre 2026. Branche `v2/react-ts`, PR #37 (brouillon, jamais fusionnée sans validation).

## Fait
- Séance en 5 étapes, panneau « Feuille » avec rappel de la dernière séance et des aides fréquentes.
- Texte du Journalier produit automatiquement (zones pédagogique / orthopédagogique, aides classées par effet).
- Pistes de compétences issues des référentiels officiels (voir ci-dessous).
- Écran Élèves : fiche (classe lue — 3CB, 1DB, 4TQ, 5P —, niveau d'étude, matières, langue), historique, modification vérifiée (toutes les options, enregistrement, persistance après rechargement).

## Référentiel : NON FINALISÉ
À reprendre plus tard. Voir aussi `AGENTS.md` et `tools/referentiel/README.md`.

| Couvert | Précision |
|---|---|
| Mathématiques, français, sciences | tronc commun 2022 + secondaire supérieur 2014 |
| Néerlandais | tronc commun 2022 (grammaire fine) + secondaire supérieur 2017 |
| Anglais, allemand, espagnol, italien | secondaire supérieur 2017 uniquement |
| Sciences économiques | compétences terminales 2000 (secondaire supérieur) |

Points restants :
1. Histoire-géographie (2022, 1999, HPT 2014) : non extrait.
2. Technique (manuel, technologique, 2022) : non extrait.
3. Droit détaillé : seulement les « objets à croiser » des sciences économiques.
4. Anglais et allemand du tronc commun (P3–S3) : non extraits (seul le néerlandais l'est).
5. Langues du secondaire supérieur : classées par niveau du CECRL, sans année ; grammaire par langue lue des annexes de façon heuristique.
6. Sciences et sciences économiques du secondaire supérieur : compétences d'unité (larges), pas de savoir-faire fins.
7. Qualité d'extraction : quelques lignes tronquées ou sans thème (maths HGT, français 2014), phrases parfois coupées ; à relire par échantillon.
8. Vérifier les pistes sur de vrais objectifs de leçon (journaux réels) et enrichir la table d'alias du langage de terrain.
9. Regrouper les compétences proches (l'agent voit parfois plusieurs formulations voisines).

## À venir (hors référentiel)
- Export Word du Journalier.
- Agenda (créneaux, récurrence, planifié → réalisé).
- Réunion / PIA.
- Coffre chiffré et OneDrive.
- Suppression d'un élève.
- Schémas zod, `package-lock.json` (registre npm inaccessible depuis l'environnement de travail).
