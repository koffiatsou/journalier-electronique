# État des lieux de la V2

Mis à jour le 24 octobre 2026. Le travail est organisé en lots : voir `docs/plan-de-travail.md`. Branche `v2/react-ts`, PR #37 (brouillon, jamais fusionnée sans validation).

## Fait
- Séance en 5 étapes, panneau « Feuille » avec rappel de la dernière séance et des aides fréquentes.
- Texte du Journalier produit automatiquement (zones pédagogique / orthopédagogique, aides classées par effet).
- Pistes de compétences issues des référentiels officiels (voir ci-dessous).
- Agenda (semainier) : semaine et jour (jour seul sur téléphone), périodes en lignes avec récré/midi, couleur par élève (palette de 10, modifiable dans la fiche) et couleur par type, glisser-déplacer, étirer, Alt+glisser pour dupliquer, appui long sur tablette, panneau d'édition (champs libres : titre, lieu, note, nom libre), répétition hebdomadaire (cette date / toute la série), annuler, réalisé automatique via la séance, bouton « Encoder la séance » (séance préremplie), filtre par élève. Pas d'année scolaire figée.
- Export Word du Journalier (écran Élèves) : remplit le modèle papier officiel, un tableau par séance, option « sans nom » ; testé (conversion en PDF relue).
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

## À venir
Tout est réparti en lots dans `docs/plan-de-travail.md` (Journalier, Élèves, Réunion, PIA, Agenda 5–6, coffre, OneDrive/Outlook, reprise V75, référentiel R1–R3, finitions). Le référentiel ci‑dessus correspond aux lots R1–R3.
