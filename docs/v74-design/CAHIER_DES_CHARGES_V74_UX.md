# Cahier des charges UX/UI — Rapports & PIA V74

**Version:** 1.0 · **Date:** 27 septembre 2026\
**Statut:** référence d’intégration active. La passe visuelle V74 et la couche UX responsive du 29 septembre 2026 sont intégrées. Les simulations desktop/mobile hors authentification sont réalisées; les parcours authentifiés et les essais sur appareils physiques restent à effectuer.

La maquette interactive [maquette-v74-10.html](maquette-v74-10.html) illustre cette direction. Elle utilise des données de démonstration non persistées; elle ne représente pas le contenu d’un dossier réel.

## 1. Objectif

Permettre au professionnel de comprendre rapidement ce qui a été observé, ce qui ressort des séances, ce qui mérite une discussion, l’état du PIA annuel et les décisions qui restent à prendre.

La refonte porte sur la présentation et la navigation. Elle ne crée ni moteur d’analyse ni stockage parallèle.

## 2. Invariants métier

- Réutiliser les fonctions existantes d’analyse, de séance, de persistance et d’export après vérification de leurs consommateurs.
- Ne pas modifier DataStore, IndexedDB, Graph, OneDrive AppFolder, SyncManager, MSAL, permissions, migration ou schémas de séance pour obtenir un changement visuel.
- Conserver les interactions existantes de modification et suppression des séances.
- N’afficher que les faits présents dans les données. Les absences ne deviennent ni zéro, ni progrès, ni état « stable ».
- Ne pas inférer de causalité entre une adaptation et un effet observé.
- Toute proposition PIA demeure distincte d’un objectif validé; validation et refus sont des actes professionnels.
- Les données réellement recueillies pendant une rencontre sont enregistrées dans la réunion correspondante du même PIA annuel.

## 3. Modèle de navigation

### Espace Rapports

Les quatre vues principales sont **Synthèse**, **Historique**, **Réunion** et **PIA annuel**. L’export est une action transversale secondaire, accessible depuis le contexte d’en-tête, et non une destination principale.

Les tabs ont un état sélectionné explicite, des panels associés, un ordre de tabulation unique et une navigation clavier par flèches, Home et End.

### Contexte partagé

- L’élève sélectionné s’applique aux séances, à la synthèse, à la préparation de réunion et au PIA affiché.
- Le nom de l’élève peut être traduit vers son `studentId` pour le runtime PIA; ne pas fusionner les deux identifiants dans le stockage.
- Le contexte de rapport expose la période des séances: hebdomadaire, mensuelle, dates personnalisées et formats PV existants.
- Les dates personnalisées ont deux bornes et une validation `début ≤ fin`.
- Les périodes de rapport n’écrivent et ne lisent pas `selectedDateISO` de l’agenda.
- Dans la vue PIA, le contrôle de période est remplacé par l’année scolaire du PIA. La période des séances n’est pas l’année du PIA.

## 4. Exigences par vue

### 4.1 Synthèse

- L’action principale est **Générer la synthèse**; Aperçu et Synthèse complète sont secondaires.
- Présenter le contenu pédagogique avant les décomptes: vue d’ensemble, apprentissages, fonctionnement, adaptations, transfert/évolution et points à discuter.
- Les décomptes de séances/indicateurs restent une métadonnée discrète, jamais une note ou un score.
- Conserver les avertissements de qualité, les provenances et les limites d’interprétation du moteur.
- Les modes hebdomadaire, mensuel, période libre et PV continuent d’appeler les fonctions existantes.

### 4.2 Historique — liste et détail

Sur grand écran, adopter une disposition maître-détail: liste sélectionnable à gauche et détail de la séance sélectionnée à droite. La cible est un partage proche de 45/55, ajustable à la largeur disponible.

Chaque ligne de liste expose immédiatement:
- date dans un rail visuel étroit;
- matière et périodes;
- objectif enregistré, s’il existe;
- au plus deux ou trois signaux courts issus de données disponibles;
- chevron et état de sélection clairement visibles.

Le panneau de détail présente les données structurées utiles (observation, apprentissage, adaptation, effet renseigné, transfert, suite et références disponibles), chacune avec sa provenance. Il conserve le chemin de modification existant. La suppression est une action secondaire, toujours protégée par la confirmation actuelle.

La barre de commandes offre période, matière et recherche. Pour les grands corpus, employer le chargement progressif ou pagination existante/locale sans reconstruire une architecture de stockage. Afficher un état vide explicite pour aucun résultat et aucun dossier.

Sur petit écran, empiler la liste et le détail, ou ouvrir le détail comme vue de niveau suivant avec un retour explicite. Aucun défilement horizontal de page.

### 4.3 Préparation de réunion

- Vue en lecture seule produite à partir du moteur de synthèse et de la période active.
- Sections possibles: éléments récurrents, évolutions, ressources/progrès, points d’attention, adaptations rapportées et questions à discuter.
- Les sections vides disent qu’aucun élément n’est renseigné; elles ne créent ni proposition ni tendance.
- Un rappel clair distingue cette préparation du compte rendu.
- Un accès secondaire ouvre les rencontres dans le PIA; la saisie réelle reste dans le modèle de réunion PIA.

### 4.4 PIA — vue des domaines

- En-tête: année scolaire, statut réel du cycle et élève courant.
- Grille des cinq domaines: cognitif/pédagogique, communication, comportemental et affectif, autonomie, physique et psychomoteur.
- Une tuile peut compter besoins, objectifs et moyens uniquement si le schéma et la valeur sont disponibles. En absence de contenu, afficher « Aucun élément consigné » ou « Non renseigné », sans compteur fabriqué.
- Les statuts affichés doivent provenir du modèle; ne pas classifier automatiquement un domaine comme stable, en progrès ou problématique.

### 4.5 PIA — détail de domaine

- Sur écran large, navigation de domaine compacte à gauche et contenu à droite; sur petit écran, navigation empilée.
- Sections repliables: ressources, besoins/difficultés, objectifs, critères, moyens/adaptations, évolution.
- Sections fermées compactes; ouverture au clavier et au pointeur; conserver les changements et feedbacks existants.
- Continuité importée explicitement présentée comme issue du PIA précédent et à réévaluer, non comme vérité actuelle.

### 4.6 PIA — propositions

Chaque proposition est un objet de décision distinct, montrant formulation, statut textuel, domaine, séances/dates contributrices, provenance et contre-évidence disponible. Les preuves détaillées peuvent être ouvertes à la demande.

Les actions Modifier, Valider et Refuser n’apparaissent que selon le statut et les règles métier existantes. Couleur et libellé indiquent ensemble l’état; aucun état ne dépend uniquement de la couleur.

### 4.7 PIA — réunions et suivi

- Le même PIA annuel conserve deux rencontres: première généralement en décembre, seconde généralement en juin/fin d’année.
- Enregistrer date, participants, contexte, retours attribués, décisions, objectifs modifiés, moyens/adaptations P/O/M et compléments avec provenance `REUNION`.
- La seconde réunion inclut l’évaluation finale, les objectifs à poursuivre et les perspectives si ces champs existent dans le modèle.
- Le suivi annuel lit le même objet PIA et expose le cycle existant sans créer de second PIA.
- Les valeurs de date sont des dates réelles saisies ou stockées; ne jamais préremplir une date de rencontre fictive en production.

### 4.8 Export transversal

Le menu offre uniquement les exports déjà implémentés: séances, synthèse, préparation, PIA professionnel, modèle dé-identifié et variantes JSON existantes. Word/PDF sont masqués ou désactivés pour JSON. La sélection de séances respecte la période de rapport lorsque ce comportement est confirmé et testé avec le moteur de plage.

## 5. Direction visuelle et profondeur

- Interface opérationnelle claire, calme et éditorialement hiérarchisée; contenu avant décoration.
- Profondeur par niveaux fonctionnels: toile de fond douce, panneaux de travail blancs, liste sélectionnée en surface légèrement élevée, détail principal focal, preuves en sous-sections. Ombres courtes et bordures fines; pas d’empilement systématique de cartes.
- Palette fonctionnelle: bleu pour navigation/action, violet réservé à l’identité PIA, vert pour les états réalisés, ambre pour examen, rouge pour refus/erreur, gris pour métadonnées.
- Une ligne visuelle n’emploie pas plusieurs accents concurrents. Toujours accompagner un état d’un libellé.
- Titres compacts mais distincts; métadonnées secondaires; corps de lecture confortable. Ne pas résoudre la densité en diminuant le texte.
- Cibles tactiles d’au moins 40 × 40 px; focus visible; transitions courtes et neutralisées par `prefers-reduced-motion`.
- Les couleurs d’un domaine peuvent varier dans une faible gamme cohérente, mais ne doivent pas coder de diagnostic.

## 6. Responsive

- **≥ 1100 px:** maître-détail historique en deux colonnes; grille des cinq domaines si chaque tuile conserve une largeur lisible; synthèse à trois colonnes.
- **760–1099 px:** réduire le maître-détail sans écraser les lignes; passer la grille PIA à deux ou trois colonnes selon largeur utile.
- **< 760 px:** historique en liste puis détail; grilles en une/deux colonnes; navigation à défilement horizontal uniquement pour les tabs, sans couper le focus.
- Tester au minimum 1440 × 900, 1024 × 768, 768 × 1024 et 390 × 844.

## 7. Critères d’acceptation

1. L’utilisateur peut identifier l’élève, la période ou l’année PIA active sans confondre ces contextes.
2. Les quatre vues Rapports sont exclusives; le PIA présente ses sous-vues sans rendre le document interminable.
3. Dans l’historique desktop, sélectionner une ligne met à jour le détail adjacent sans perdre les filtres; Modifier ouvre la séance canonique.
4. La liste reste utile avec zéro, une, deux et plusieurs dizaines de séances; recherche et matière n’affichent que les correspondances.
5. La période choisie produit le même corpus pour synthèse et export de séances; les bornes inversées sont refusées avec une aide compréhensible.
6. La préparation ne persiste pas comme compte rendu; les entrées de réunion sont enregistrées dans le même PIA avec source `REUNION`.
7. Les états vides ne montrent ni nombres inventés, ni badges de statut déduits.
8. Aucune proposition n’est promue automatiquement en objectif validé.
9. Tabulation, lecteur d’écran, focus, contraste et affichage mobile restent utilisables.
10. Aucun débordement horizontal de page, texte coupé ou action inaccessible aux largeurs cibles.
11. Les fonctions existantes de séance, PIA, export, stockage, synchronisation et agenda passent leurs tests de régression.
12. Build, `git diff --check`, syntaxe pertinente et recalcul des hashes CSP passent après chaque modification d’inline script.

## 8. Parcours de validation

- **Synthèse:** choisir un élève → choisir semaine/mois/période/PV → générer aperçu → ouvrir complet → exporter.
- **Historique:** choisir matière ou chercher → sélectionner une séance → lire le détail/provenance → revenir à la liste → modifier → vérifier que le bon élève et la bonne séance sont conservés.
- **Réunion:** ouvrir la préparation issue des séances → naviguer vers PIA/Réunions → enregistrer des retours attribués et des décisions → vérifier leur persistance dans le même PIA.
- **PIA:** vérifier année et statut → ouvrir un domaine → parcourir les accords → consulter une proposition et ses preuves → modifier/valider/refuser selon les droits métier → recharger et vérifier la persistance.
- **Mobile et clavier:** effectuer les parcours principaux sans souris à 390 px et au clavier sur desktop.

## 9. Barème qualité cible

Dix axes valent chacun un point: hiérarchie et profondeur, navigation, lisibilité des données, maître-détail, cohérence PIA/réunions, fidélité aux données, actions prévisibles, accessibilité, responsive, régression métier. Un axe n’est validé que par observation ou test documenté; une compilation seule ne vaut pas preuve UX.
