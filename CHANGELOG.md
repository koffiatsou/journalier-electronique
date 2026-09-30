# Changelog

## 2026-09-30 — Coffre local granulaire et récupération du stockage

- Remplacement de la persistance monolithique `journalier-secure-v72/states` par le coffre granulaire `journalier-secure-v74`.
- Séparation des élèves, séances, événements Agenda, PIA, registre de synchronisation, métadonnées et migration en enregistrements indépendants.
- Conservation volontaire des identifiants techniques `v72` pour la compatibilité historique.
- Chiffrement AES-GCM 256 bits par enregistrement avec IV unique et AAD liée au compte/type/identifiant.
- Ajout d'une empreinte SHA-256 du ciphertext pour les diagnostics d'intégrité.
- Transactions IndexedDB demandant `durability: 'strict'` lorsque disponible.
- Migration V72 → coffre granulaire non destructive et idempotente ; aucune suppression automatique du coffre historique.
- Détection explicite du cas `Failed to read large IndexedDB value` et préparation d'une récupération depuis OneDrive lorsque le coffre historique est illisible.
- La récupération distante est persistée localement avant que l'interface ne considère l'opération terminée.
- Documentation ajoutée dans `docs/STOCKAGE_LOCAL_V74.md`.
- Ajout du contrat `tests/storage-v74-contract.test.mjs`.

## 2026-09-30 — Modification des séances et réattribution d’élève

- Le formulaire de modification d’une séance permet de réattribuer la séance à un autre élève existant.
- Lorsqu’une séance référence un élève supprimé, l’ancien nom reste visible uniquement comme repère historique et l’interface demande explicitement de choisir un élève actuel avant l’enregistrement.
- La sauvegarde conserve l’identifiant de la séance et réécrit le `studentId` selon l’élève actuellement sélectionné.
- Lorsqu’un changement d’élève concerne une séance déjà synchronisée, le SyncManager prépare le déplacement du fichier JSON vers le dossier du nouvel élève et supprime l’ancienne copie après écriture validée.
- Aucun nouveau backend, canal de stockage ou permission Microsoft Graph n’est ajouté.
- Ajout d’un contrat de test dédié aux scénarios de modification et de réattribution.

## 2026-09-30 — Nettoyage et cohérence du modèle Agenda V74

- Modèle d’état unifié : Planifié / Réalisé / Annulé.
- Suppression de la confirmation comme état actif de l’Agenda. Les anciennes valeurs `confirmed` sont converties en `proposed` à la lecture.
- Une séance enregistrée dans l’Historique est projetée comme Réalisé dans les vues Agenda, y compris sans événement planifié correspondant.
- Les actions Modifier/Supprimer de l’Historique restent gérées par le cœur métier, sans dépendance au module Microsoft.
- Contrat de test, validateur Graph, styles et documentation alignés sur ce modèle.

## 2026-09-29 — Agenda V74

- Modèle canonique `agenda.__events` pour permettre plusieurs événements qui se chevauchent.
- États Proposition / Confirmé / Réalisé / Annulé.
- Réalisation indépendante des réunions, GT, formations et missions non liées à une séance.
- Configuration des horaires des 8 périodes, avec pauses entre périodes.
- Rapprochement Agenda ↔ Historique renforcé lors des corrections de séance.
- Préparation des métadonnées nécessaires à une future synchronisation Outlook via Microsoft Graph.
- Validateur OneDrive/Graph et migration V74 adaptés au nouveau modèle.

Historique synthétique des évolutions importantes. Les détails d'architecture et les contrôles de sécurité sont décrits dans [ARCHITECTURE.md](ARCHITECTURE.md) et [SECURITY.md](SECURITY.md). L'historique complet est disponible dans Git.

## V74 — passe UX/UI responsive — 29 septembre 2026

### UX/UI
- Ajout d'une couche responsive dédiée `src/styles/journalier-ux-responsive.css` sans modification du contenu métier.
- Passage du socle de hauteur à `100dvh`, amélioration du scroll principal et prise en compte des zones sûres mobiles.
- Navigation téléphone transformée en barre basse tactile avec les cinq destinations et icônes existantes.
- Adaptation distincte PC/tablette/téléphone de l'Accueil, de l'Agenda, de la Séance, des dossiers Élèves et de Rapports & PIA.
- Correction du formulaire de séance sur petit écran, notamment du couple de périodes début → fin.
- Correction de l'en-tête Rapports & PIA et de l'action Exporter pour éviter les coupures sur téléphone/tablette.
- Modales adaptées au tactile avec comportement de feuille sur petit écran.
- Cibles tactiles, focus visible, réduction des mouvements et taille de saisie mobile harmonisés.
- Adaptation responsive des vues PIA générées dynamiquement, sans modification du modèle PIA.

### Documentation et validation
- Ajout de `docs/UX_V74_RESPONSIVE.md` avec audit, règles responsive, invariants métier et résultats des simulations.
- Simulation automatique à 390×844, 375×667, 768×1024, 1024×768 et 1440×900 sur les cinq vues principales.
- Vérification de l'absence de débordement horizontal de page et de l'atteignabilité de la fin du formulaire de séance.
- La CSP reste fonctionnellement inchangée : aucune nouvelle origine, aucun script inline et aucun hash de script n'a été ajouté ; seul le chargement d'une feuille CSS locale et le viewport mobile ont été modifiés.

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
- Synchronisation OneDrive automatique et bidirectionnelle : déclenchement après chaque sauvegarde locale, au retour au premier plan, à la reconnexion réseau, à la connexion Microsoft et par cycle périodique; les modifications distantes non conflictuelles sont désormais rapatriées automatiquement en plus de l'envoi des modifications locales.
- Suivi des PIA intégré au registre de synchronisation (`syncRegistry.pia`) : un envoi échoué vers OneDrive est désormais réessayé automatiquement au lieu de rester bloqué en local.

### Documentation
- Références UX regroupées dans `docs/v74-design/` avec un cahier d’intégration actif, une maquette interactive et six captures de référence.
- README et architecture alignés sur l’inventaire réel; prompts de travail redondants et maquette remplacée retirés.

### Architecture et sécurité
- Réutilisation du DataStore, de Graph/OneDrive et des permissions existantes; aucun backend ajouté.
- Compatibilité conservée avec l'ancien état PIA `ACTIF`.
- Hashes CSP recalculés après modification des scripts inline.
- Hashes CSP recalculés une seconde fois après l'ajout de la synchronisation automatique (scripts inline #2 et #3 modifiés).

### Validation et limites
- `npm run build` passe.
- Hashes CSP des trois scripts inline vérifiés après la refonte.
- Tests visuels automatisés et parcours authentifiés Entra/Graph restent à exécuter; aucun navigateur automatisable n’est disponible dans le Codespace.
- Les parcours Entra/Graph/OneDrive et la migration avec données réelles restent à tester dans un environnement authentifié.
- Le rendu navigateur des derniers changements agenda n'est pas confirmé par l'audit V74.

## V74 — migration legacy — 25 septembre 2026

- Ajout du pont `JournalierMigrationBridge` entre `index.html` et `src/v74/v74-migration.js`.
- Migration contrôlée vers l'AppFolder, avec validation, normalisation et détection bloquante des conflits.
- Conservation de la source `Journalier-legacy`, du `studentId` historique et absence de nouvelle permission Graph.

## V74.1.0 — stabilisation PIA — 25 septembre 2026

- Import local de PIA Word/PDF; le document original et son nom ne sont pas conservés.
- Exports PIA professionnels et dé-identifiés en Word/PDF; retrait des identifiants, dates de preuve et identifiants de séance dans les modèles dé-identifiés.
- Tableau de bord descriptif et mémos personnels stockés via le DataStore local chiffré.
- Limites de taille et de décompression appliquées aux documents importés.

## V74.0.1 — continuité et validation — 25 septembre 2026

- Utilisation du référentiel PIA JSON pour les seuils de convergence.
- PIA précédent traité comme source de continuité, distincte des propositions.
- Validation professionnelle requise; aucune causalité Q2–Q6 affirmée automatiquement.

## V74 — cycle annuel PIA — septembre 2026

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

Évolutions progressives de l'agenda, des élèves, des séances, des indicateurs, des rapports, de l'authentification Microsoft et de la synchronisation. Les détails des versions antérieures à V74 restent dans l'historique Git.


## Refactoring V74
Structure du frontend nettoyée sans changement fonctionnel volontaire : CSS et JavaScript extraits de `index.html`, runtime/migration sous `src/v74/` et historique archivé.
