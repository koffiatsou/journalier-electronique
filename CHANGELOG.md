# Changelog

Historique synthétique des évolutions importantes. Les détails d'architecture et les contrôles de sécurité sont décrits dans [ARCHITECTURE.md](ARCHITECTURE.md) et [SECURITY.md](SECURITY.md). L'historique complet est disponible dans Git.

## V74 — en cours, non publiée — 27 septembre 2026

### Fonctionnel
- Organisation de l'espace Rapports autour de l'historique, des synthèses à période libre, de la préparation de réunion et des exports.
- Résumé Q2–Q6 conservé dans l'historique avec les commandes existantes de modification et de suppression.
- PIA annuel étendu aux cinq domaines, réunions structurées, décisions professionnelles et suivi jusqu'à la finalisation.
- Exports des séances, synthèses et réunions en Word ou PDF; maintien des exports PIA professionnels et dé-identifiés.
- Refonte visuelle de l’historique en disposition maître-détail, avec filtres et commandes existants préservés.
- Domaines PIA présentés dans une grille adaptative puis un détail éditable par accordéons; préparation de réunion reliée à la saisie des réunions dans le même PIA annuel.
- Accents de couleur sémantiques ajoutés aux sections de synthèse/réunion, aux domaines PIA et aux états de proposition.
- Pastilles typées ajoutées à l’historique et au détail pour Observation Q2, Adaptation Q4 et Effet observé, avec les niveaux et libellés enregistrés.
- Cartes des cinq domaines PIA agrandies avec symboles thématiques et grille responsive; couleurs liées aux domaines plutôt qu’à leur position.
- Rubriques du détail PIA présentées dans des conteneurs teintés et éléments enregistrés en pastilles, dans le même langage visuel que la vue Séance.
- Tableau de bord rafraîchi après activation, hydratation et verrouillage du coffre; cartes Élèves et dossiers enrichis de pastilles et groupes de séances récents.
- Fin de période de séance réalignée automatiquement sur le début lorsqu’elle devient antérieure; périodes impossibles désactivées.
- Niveaux Q2 rendus explicites par observation dans l’historique et l’export; effets Q4 affichés avec leurs libellés plutôt qu’en valeurs numériques.
- Panneau Export affiché au-dessus des vues voisines; cartes Proposition harmonisées sur une surface neutre avec accent/badge d’état.
- Pastille du niveau Q2 séparée du texte de l’observation dans la liste afin d’améliorer le balayage visuel.
- Ajustements de l'agenda et du serveur local Codespaces.

### Documentation
- Références UX regroupées dans `docs/v74-design/` avec un cahier d’intégration actif, une maquette interactive et six captures de référence.
- README et architecture alignés sur l’inventaire réel; prompts de travail redondants et maquette remplacée retirés.

### Architecture et sécurité
- Réutilisation du DataStore, de Graph/OneDrive et des permissions existantes; aucun backend ajouté.
- Compatibilité conservée avec l'ancien état PIA `ACTIF`.
- Hashes CSP recalculés après modification des scripts inline.

### Validation et limites
- `npm run build` passe.
- Hashes CSP des trois scripts inline vérifiés après la refonte.
- Tests visuels automatisés et parcours authentifiés Entra/Graph restent à exécuter; aucun navigateur automatisable n’est disponible dans le Codespace.
- Les parcours Entra/Graph/OneDrive et la migration avec données réelles restent à tester dans un environnement authentifié.
- Le rendu navigateur des derniers changements agenda n'est pas confirmé par l'audit V74.

## V73.1.3 — migration legacy — 25 septembre 2026

- Ajout du pont `JournalierMigrationBridge` entre `index.html` et `src/v73/v73-migration.js`.
- Migration contrôlée vers l'AppFolder, avec validation, normalisation et détection bloquante des conflits.
- Conservation de la source `Journalier-legacy`, du `studentId` historique et absence de nouvelle permission Graph.

## V73.1.0 — stabilisation PIA — 25 septembre 2026

- Import local de PIA Word/PDF; le document original et son nom ne sont pas conservés.
- Exports PIA professionnels et dé-identifiés en Word/PDF; retrait des identifiants, dates de preuve et identifiants de séance dans les modèles dé-identifiés.
- Tableau de bord descriptif et mémos personnels stockés via le DataStore local chiffré.
- Limites de taille et de décompression appliquées aux documents importés.

## V73.0.1 — continuité et validation — 25 septembre 2026

- Utilisation du référentiel PIA JSON pour les seuils de convergence.
- PIA précédent traité comme source de continuité, distincte des propositions.
- Validation professionnelle requise; aucune causalité Q2–Q6 affirmée automatiquement.

## V73 — cycle annuel PIA — septembre 2026

- Synthèse des séances et des données structurées Q2–Q6 pour soutenir le cycle annuel PIA.
- Traçabilité des observations, propositions, preuves et contre-évidences.
- Distinction maintenue entre objectifs de séance et objectifs PIA.
- Aucune proposition n'est validée automatiquement.

## 2026-09 — architecture, sécurité et chaîne de livraison

- Stabilisation de l'architecture local-first: Entra ID, IndexedDB chiffré, Microsoft Graph et OneDrive AppFolder.
- Validation des données, contrôle des ETags, détection de conflits et vérification des URL de téléchargement Graph.
- Mise à niveau de Vite et ajout du build CI et du déploiement GitHub Pages.
- Configuration versionnée de Dependabot et référencement des Actions par SHA complet.
- Les règles de protection GitHub, alertes et paramètres Entra sont des réglages externes; voir les limites dans [SECURITY.md](SECURITY.md).

## V72 et versions antérieures

Évolutions progressives de l'agenda, des élèves, des séances, des indicateurs, des rapports, de l'authentification Microsoft et de la synchronisation. Les détails des versions antérieures à V73 restent dans l'historique Git.
