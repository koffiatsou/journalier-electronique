# État des lieux de la V2

Mis à jour le 24 octobre 2026 (lot 2 terminé). Le travail est organisé en lots : voir `docs/plan-de-travail.md`. Branche `v2/react-ts`, PR #37 (brouillon, jamais fusionnée sans validation).

## Fait
- Séance en 5 étapes, panneau « Feuille » avec rappel de la dernière séance et des aides fréquentes.
- Texte du Journalier produit automatiquement (zones pédagogique / orthopédagogique, aides classées par effet).
- Pistes de compétences issues des référentiels officiels (voir ci-dessous).
- Agenda (semainier) : semaine et jour (jour seul sur téléphone), périodes en lignes avec récré/midi, couleur par élève (palette de 10, modifiable dans la fiche) et couleur par type, glisser-déplacer, étirer, Alt+glisser pour dupliquer, appui long sur tablette, panneau d'édition (champs libres : titre, lieu, note, nom libre), répétition hebdomadaire (cette date / toute la série), annuler, réalisé automatique via la séance, bouton « Encoder la séance » (séance préremplie), filtre par élève. Pas d'année scolaire figée.
- Écran **Journalier** (lot 1) : séances d'un élève ou de tous, période au choix (état à ce jour = début de l'année scolaire jusqu'à aujourd'hui, année scolaire du 1er août au 31 juillet, dates libres), aperçu du texte de chaque séance, modification (rouvre l'écran Séance puis revient au Journalier), suppression avec confirmation.
- Export Word du Journalier, **depuis l'écran Journalier uniquement** : remplit le modèle papier officiel, un tableau par séance, seulement les séances de la période choisie (période dans le nom du fichier), option « sans nom ni titulaire ». Tous les élèves : un fichier Word par élève dans un .zip. Testé (tests + parcours dans un navigateur, `tools/navigateur/journalier.mjs`).
- Écran **Élèves** (lot 2) : page en **cartes** (pastille d'initiales sur la couleur de l'agenda, classe, niveau d'étude, matières, langues, nombre de séances, dernière séance, badge « À mettre à jour ») ; **recherche** (nom, classe, matière, langue, titulaire… sans accents) ; dossier ouvert au toucher d'une carte (séances récentes, « Voir le Journalier », modifier).
- Fiche élève : classe lue (3CB, 1DB, 4TQ, 5P), niveau d'étude, **matière libre** (« Autre matière »), **plusieurs langues modernes** (Néerlandais, Anglais, Allemand, Espagnol, Italien), couleur d'agenda. Les langues sont proposées comme matières dans la séance et pilotent les pistes de compétences (si « Langues modernes » + plusieurs langues : on demande de préciser la langue).
- **Archiver / suivre à nouveau** : l'élève archivé quitte la liste principale (section repliable « Élèves archivés »), n'est plus proposé pour une séance ou une activité d'agenda ; ses séances restent au Journalier et exportables.
- **Supprimer** (définitif) : confirmation avec décompte (séances, activités d'agenda), case à cocher, Journalier Word proposé avant ; tout est supprimé en une seule opération de base. Vérifié dans la base du navigateur : aucune séance ni activité orpheline.
- **Passage d'année scolaire** : proposition ligne par ligne (classe suivante modifiable, ne pas changer, archiver), titulaires effacés (case décochable), jamais appliqué sans validation ; un dossier déjà à jour ou d'année inconnue reste « Ne pas changer » par défaut ; les séances ne bougent pas.
- Journalier : **recherche d'une séance** (élève, matière, objectif, observations, aides, suite, date…) ; l'export Word garde toute la période choisie.

Reste côté Élèves : avatars dessinés personnalisables (lot 2b) ; l'agenda d'un élève archivé n'est pas modifié ; pas d'import/export des dossiers (lots 7 et 9).

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
