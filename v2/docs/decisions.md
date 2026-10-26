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
| 2026-10-26 | Lot 2b (avatars) fait dans la même conversation que le lot 2, à la demande de l'utilisateur | « On est toujours dans le lot 2 » |
| 2026-10-26 | Avatar = réglages (style, teint, cheveux, coiffure, visage, accessoire) enregistrés dans le dossier ; le dessin est recalculé à l'affichage, aucune image stockée | Pas de photo (donnée sensible) ; stockage minuscule ; dessins améliorables sans toucher aux données |
| 2026-10-26 | Cinq styles : manga, bande dessinée, dessin animé, pixel, minimaliste ; dessins originaux et génériques | Décision du 24/10 : aucun personnage ni marque existants |
| 2026-10-26 | Le vêtement et le fond de l'avatar reprennent la couleur de l'agenda de l'élève (pas de réglage de couleur en plus) | Un seul réglage de couleur, cohérent avec l'agenda et le thème sombre |
| 2026-10-26 | Teint le plus foncé : traits du visage clairs ; deux teints foncés légèrement éclaircis | Lisibilité des yeux et de la bouche sur tous les teints |
| 2026-10-26 | Repasser aux initiales retire l'avatar du dossier ; revenir au dessin dans la même fiche retrouve le dernier choix | Pas de réglage fantôme dans les données ; pas de perte par fausse manip |
| 2026-10-26 | Avatar visible sur cartes, dossier et passage d'année seulement (pas encore Journalier, agenda, séance) | Reste dans le périmètre du lot ; idée en attente |
| 2026-10-26 | « Rapports » devient « Réunion » dans le menu (la page PIA aura son propre lien au lot 4) | La page « Rapports » n'était qu'un message « à venir » |
| 2026-10-26 | Réunion = un élève à la fois, période au choix (mêmes choix que le Journalier) | Une réunion parle d'un élève ; comportement connu |
| 2026-10-26 | Propositions d'objectifs : règles simples sur le dernier niveau noté, jamais de décision automatique ; l'agent coche, reformule ou ajoute | L'agent reste maître des objectifs ; pas d'invention |
| 2026-10-26 | Au plus 3 observations, 2 compétences, 2 aides à garder et 1 à revoir par matière | Une liste courte se valide ; une longue se survole |
| 2026-10-26 | Objectifs retenus gardés seulement le temps de la visite (pas en base) | Évite de changer la base avant le lot 4 (procès-verbaux) ; signalé à l'écran |
| 2026-10-26 | Texte de réunion en texte brut à copier, option « Sans nom » ; pas d'export Word au lot 3 | Word officiel = lot 4 |
| 2026-10-26 | Lot 4 coupé en 4a (écran PIA, profil, PV 1, aménagements, export du PIA entier) et 4b (PV 2, exports par partie, PDF) | Trop gros pour une conversation ; le PIA entier doit pourtant être disponible dès la fin de la réunion |
| 2026-10-26 | La page Réunion devient l'onglet « Préparer » de l'écran PIA | Une réunion = préparation + procès-verbal ; éviter la double saisie des objectifs |
| 2026-10-26 | Le tableau de la page 2 du PIA est le « profil » de l'élève : une fois par PIA, avant le PV 1, modifiable en cours d'année | Modèle officiel ; demande de l'utilisateur |
| 2026-10-26 | Aménagements : une ligne = un aménagement, types P / O / M à cocher | Réponse de l'utilisateur |
| 2026-10-26 | Profil du PIA : jamais rempli automatiquement ; indices cliquables (phrases génériques + rapprochements tirés des séances pour cognitif, autonomie, comportement) | L'agent connaît son élève ; les indices aident à savoir quoi écrire |
| 2026-10-26 | Deux niveaux d'objectifs : généraux (profil) et de la période (PV 1, avec critères d'évaluation) | Le modèle officiel les distingue |
| 2026-10-26 | Support visuel = aménagement pédagogique (sauf problème de vue) | Réponse de l'utilisateur |
| 2026-10-26 | Un PIA = un enregistrement par élève et par année scolaire (identifiant « élève, année ») ; base IndexedDB version 3, magasin `pia` | Un seul PIA par année, retrouvé sans doublon ; supprimé avec l'élève |
| 2026-10-26 | Enregistrement automatique du brouillon de PIA 0,4 s après la dernière frappe, et à la fermeture de la page | Rien ne se perd, sans écriture à chaque lettre |
| 2026-10-26 | Les objectifs retenus à la réunion sont enregistrés dans le PIA (fin du « gardé le temps de la visite ») | Objectifs retrouvés au PV 1 sans ressaisie |
| 2026-10-26 | PV 1 : « Reprendre les objectifs retenus » une seule fois par objectif, sans critères (l'agent les écrit) | Évite les doublons ; les critères relèvent de l'agent |
| 2026-10-26 | Rapprochements du profil : au moins 2 séances, 3 par case au plus ; le dernier niveau noté décide (Acquis / Pas encore acquis / Faire progresser / Consolider) | Court et vérifiable ; textes à relire avec l'utilisateur |
| 2026-10-26 | Aménagements proposés : aides à effet positif dont le dernier effet n'est pas « aucun » (6 au plus) ; type P / O / M proposé, à corriger ; aide inconnue = à classer | L'agent reste maître |
| 2026-10-26 | Export Word du PIA : on remplit le modèle officiel sans le reconstruire ; lignes ajoutées au-delà de 9 présents / 10 aménagements ; PV 2 laissé vide | Fidélité au document officiel ; PV 2 = lot 4b |
| 2026-10-26 | Informations de santé : uniquement sur l'appareil, aucun envoi | Données sensibles d'élèves |
| 2026-10-26 | Procès-verbal 2 : l'agent choisit le résultat de chaque objectif du PV 1 (Atteint / Atteint en partie / Pas atteint), rien n'est présélectionné ; le rappel des séances depuis le PV 1 aide mais ne décide pas | Même principe que le profil : l'agent reste maître |
| 2026-10-26 | Aménagements de la rentrée : copie de ceux de l'année (une seule fois), puis modifiables sans toucher à l'année | Le PV 2 met à jour, il ne réécrit pas le PV 1 |
| 2026-10-26 | Export par partie : on retire du fichier Word les parties non choisies (profil, PV 1, PV 2) ; l'identité reste toujours | Un fichier propre à envoyer, sans pages vides |
| 2026-10-26 | Version dé-identifiée du PIA : nom remplacé par « l'élève » dans les textes, dossier et coordonnées non écrits, seule la fonction des présents gardée | Partage hors de l'équipe, comme pour le Journalier |
| 2026-10-26 | PDF : « Imprimer / PDF » du navigateur sur une mise en page simple (pas de PDF fidèle au modèle officiel, qui demanderait un convertisseur) ; PDF officiel = Word puis « Enregistrer en PDF » | Reste hors ligne, sans service externe |
| 2026-10-26 | Exemple fictif (élèves Alpha et Bêta, séances, PIA) chargeable depuis l'écran PIA | Essayer le PIA sans données réelles (demande de l'utilisateur) |
| 2026-10-26 | Lot 7 (coffre chiffré) mis en pause : l'accès se fera par la connexion au compte professionnel Outlook (lot 8) | Décision de l'utilisateur ; les données locales restent non chiffrées sur l'appareil |
| 2026-10-26 | Le coffre chiffré (lot 7) est maintenu, après le lot 8 ; l'agenda (lots 5 et 6) est finalisé avant la connexion Outlook | La V75 chiffrait déjà les données (clé liée au compte) ; la V2 doit offrir au moins la même protection avant sa mise en service |
| 2026-10-26 | Lot 5 : l'agenda a trois vues, Semaine / Jour / Mois ; sur téléphone, Jour et Mois seulement (la semaine est trop large) | Le mois sert à voir l'année d'un coup d'œil ; le détail reste dans la vue Jour |
| 2026-10-26 | Vue Mois : lundi à vendredi seulement (comme la semaine), jours des mois voisins grisés, trois activités par case puis « + N autres » ; toucher un jour ouvre ce jour, toucher une activité ouvre son panneau ; sur téléphone, pastilles de couleur | Cohérence avec la semaine scolaire ; lisible sur petit écran |
| 2026-10-26 | Jours fériés belges et congés fixes de la Fédération (27 septembre, 2 novembre) CALCULÉS pour toute année (Pâques par calcul) ; vacances scolaires dans un TABLEAU (`ANNEES_SCOLAIRES_FWB`), année par année | Les fériés ne changent pas de règle ; les vacances sont fixées par le Gouvernement et ne se déduisent pas |
| 2026-10-26 | Dates des vacances recoupées entre plusieurs sources (La Libre, Infor Jeunes, RTBF, La CSC enseignement) ; congé de détente 2026 = 16 au 27 février (l'article RTBF disait 23 février, erreur) ; 2027-2028 et 2028-2029 = une seule source, à revérifier | Aucune date écrite de mémoire ; une source seule est signalée |
| 2026-10-26 | Hors du tableau (avant août 2025 ou après août 2029) : seuls les fériés sont montrés et une note le dit ; on n'invente jamais de vacances | Mieux vaut aucune information qu'une fausse |
| 2026-10-26 | Férié ou congé affiché avant les vacances quand les deux se superposent (Noël, Ascension 2027) ; fériés = fond uni, vacances = hachures, sans les couleurs réservées au sens (bleu, sarcelle, ambre, rouge) | Information la plus précise d'abord ; les couleurs du produit gardent leur sens |
| 2026-10-26 | Une activité reste possible sur un jour férié ou de vacances (rien n'est bloqué) | Un agent peut travailler pendant un congé scolaire (formation, réunion) |
| 2026-10-26 | Horaires des périodes réglables (début et fin des huit périodes) ; les NOMS (1e H…8e H) ne changent pas ; l'écart entre deux périodes = pause (« Midi » si plus de 30 minutes) ; refus des horaires incohérents (fin avant début, chevauchement) | Les séances et l'agenda repèrent les périodes par leur nom : changer les heures ne touche à aucune donnée |
| 2026-10-26 | Horaires enregistrés dans un nouveau magasin `reglages` (base IndexedDB version 4, un enregistrement par réglage) ; un réglage abîmé redonne les horaires habituels | Réutilisable pour d'autres réglages (lots 6 et 8) sans nouvelle migration |
| 2026-10-26 | Le 2 novembre (Commémoration des défunts) est bien un jour de congé pour WBE : confirmé par l'utilisateur | Seules deux sources sur quatre le citaient ; la question est réglée |
| 2026-10-26 | Grandes vacances hors du tableau : règle de l'utilisateur (fin des cours = premier vendredi de juillet, rentrée = dernier lundi d'août) ; le tableau prime (2026 : rentrée le 24 août, pas le 31) | Règle vérifiée sur toutes les années du tableau ; les autres congés restent inconnus hors tableau |
