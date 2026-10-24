# Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-10 | Réécriture en React + TypeScript dans `v2/`, V75 conservée | Personne n'utilise encore l'app ; design et fluidité pour l'adhésion de l'équipe |
| 2026-10 | esbuild sans Vite | Peu de dépendances, build simple |
| 2026-10 | Une échelle d'observation, une échelle d'effet des aides | Vocabulaire simple, texte final cohérent |
| 2026-10 | Étape Fonctionnement : option A + panneau Déjà renseigné / À renseigner | Choix de l'utilisateur après maquettes A–D |
| 2026-10 | Carte `Point` unique pour observations, compétences et aides | Cohérence : même geste partout (option A) |
| 2026-10 | Nature des aides déduite automatiquement ; distinction conservée dans les documents seulement | L'agent n'a pas à y réfléchir ; les documents gardent le vocabulaire professionnel |
| 2026-10 | Transfert ramené à une question facultative dans « Ce qui a aidé » ; séance en 5 étapes | Champ souvent vide, mais indicateur d'autonomie utile au PIA |
| 2026-10-24 | Export Word uniquement depuis l'écran Journalier (Élèves → « Voir le Journalier ») | Un seul bouton d'export ; la période se choisit au même endroit |
| 2026-10-24 | Période : état à ce jour (défaut), année scolaire (1er août → 31 juillet), dates libres ; période dans le nom du fichier | Le modèle papier n'a pas de case période ; découpage identique aux noms de fichiers existants |
| 2026-10-24 | Export « tous les élèves » = un .docx par élève dans un .zip | Le modèle Journalier a une seule identité par fichier |
| 2026-10-24 | Modifier une séance = rouvrir l'écran Séance (5 étapes) puis revenir au Journalier | Pas de second formulaire à maintenir |
| 2026-10-24 | Fiche élève : plusieurs langues modernes et matières libres (à faire au lot 2) | Retour utilisateur : un élève en option langues peut suivre anglais, néerlandais et espagnol |
| 2026-10-24 | Lot F « Finition visuelle » ajouté en dernier | Demande de l'utilisateur : l'habillage se règle une fois les fonctions terminées |
| 2026-10-24 | Page Élèves en cartes « carte d'étudiant » (lot 2) | Demande de l'utilisateur : plus visuel qu'une liste |
| 2026-10-24 | Pas de photo d'élève ; avatars dessinés personnalisables en styles génériques et originaux | Donnée sensible ; personnalisation voulue ; pas de personnage ni marque existants |
| 2026-10-24 | Un lot de travail par conversation ; plan dans `docs/plan-de-travail.md`, fin de lot obligatoire (docs à jour) | Économiser les tokens, pouvoir reprendre à froid dans une nouvelle conversation |
| 2026-10-24 | Lot 2 coupé : élèves complets (cartes, recherche, archivage, suppression, passage d'année, langues) fait ; avatars dessinés = lot 2b | Les avatars demandent un travail de dessin à relire avec l'utilisateur ; le reste était prêt et testable |
| 2026-10-24 | Deux gestes distincts : **Archiver** (dossier rangé, séances gardées au Journalier, élève retiré des choix de séance et d'agenda) et **Supprimer** (définitif) | Fin d'année ou départ du suivi ≠ erreur de saisie ; l'historique reste exportable |
| 2026-10-24 | Supprimer un élève supprime aussi ses séances et ses activités d'agenda, dans une seule opération de base (tout ou rien) ; confirmation avec décompte, case à cocher et Journalier Word proposé avant | Aucune séance orpheline ; geste irréversible bien expliqué |
| 2026-10-24 | Archivage : les activités d'agenda de l'élève ne sont pas touchées | Évite de perdre un planning ; à revoir si l'équipe veut les masquer (idée en attente) |
| 2026-10-24 | Passage d'année : proposition à relire ligne par ligne, rien n'est appliqué avant « Appliquer » ; un dossier déjà à jour ou d'année inconnue n'est jamais changé sans choix explicite | Éviter un double passage et la perte de données ; la V1 n'avait pas d'année dans les dossiers |
| 2026-10-24 | Passage d'année : le titulaire est effacé par défaut (case décochable) ; la classe suivante est calculée (3CB → 4CB, 6e → archivage, 7e pour le professionnel) mais modifiable (redoublement, 1D → 2C) ; les séances gardent la classe de leur époque | Un ancien titulaire sur un nouveau Journalier serait faux |
| 2026-10-24 | Dossier : `anneeDossier` (année scolaire à jour) et `archiveLe` (date) ajoutés ; badge « À mettre à jour » sur la carte quand le dossier date d'une année passée | Rappel du passage d'année sans l'imposer |
| 2026-10-24 | Plusieurs langues modernes par élève (`langues`) ; l'ancien champ `langue` est converti au chargement ; une langue est proposée comme matière dans la séance ; « Langues modernes » avec plusieurs langues → on demande de choisir la langue précise | Chaque langue reste reliée au référentiel sans deviner laquelle |
| 2026-10-24 | Matière libre dans la fiche (champ « Autre matière », sans doublon à l'accent près) ; les langues ont leur propre rubrique, plus dans la liste des matières | Retour utilisateur ; pas de doublon visuel « Anglais » |
| 2026-10-24 | Recherche d'élèves (nom, classe, matière, langue, titulaire, niveau d'étude) et recherche de séances au Journalier : accents et majuscules ignorés, tous les mots doivent correspondre | Retrouver vite ; la recherche des séances ne limite jamais l'export (toute la période) |
| 2026-10-24 | Page Élèves en cartes avec pastille d'initiales sur la couleur de l'agenda (en attendant les avatars dessinés) ; dossier ouvert au toucher d'une carte | Demande utilisateur (carte d'étudiant) ; le composant `Avatar` accueillera les dessins au lot 2b |
