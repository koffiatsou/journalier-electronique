# Rapport d'Intégration UX/UI & Identité Visuelle — LOT 6

Projet : **Journalier électronique** · Identité : **Pôle territorial WBE BXL** · Version : **V74 — Lot 6**  
Base technique et fonctionnelle : **Lot 5 consolidé** (intact à 100 %)  
Référence visuelle et ergonomique : **Design System Apple HIG & Identité Pôles territoriaux**

---

## 1. FAITS VÉRIFIÉS (Phase 0 — Audit préalable sur la base Lot 5)

Avant toute modification, la base du **Lot 5** et le contenu de l'archive UX alternative ont été inspectés :
- **Moteur métier du Lot 5** :
  - `src/app/journalier-core.js` (5 293 lignes), `src/app/microsoft-core.js` (1 289 lignes), `src/v74/v74-runtime.js` (1 521 lignes) et `src/v74/v74-migration.js` assurent l'intégralité du stockage chiffré granulaire IndexedDB (`journalier-secure-v74`), la synchronisation bidirectionnelle Microsoft Graph / OneDrive AppFolder, l'Agenda niveau Outlook (timeline continue, Drag & Drop, Resize, récurrences avancées, exceptions, configuration des 8 périodes), le reset sécurisé « Repartir de OneDrive » et le cycle PIA annuel.
  - Les horaires des 8 périodes sont exposés par `window.JournalierAgendaConfig.getPeriods()` dans `src/app/journalier-core.js` (lignes 1775–1784).
  - La navigation par onglets déplace physiquement la vue active dans `#page-stage` via `showTab(tabName)` (`src/app/journalier-core.js`, lignes 4890–4935) et utilise la classe `.nav-btn` sur les 5 boutons `#tab-btn-*`.
  - En Q2 (`Fonctionnement observé`), `handleSessionSave` et `editHistorySession` lisent et écrivent `.q2-observation-item input[type="checkbox"]` et `.q2-observation-item input[type="range"]`.
  - En Q4 (`Adaptation / médiation`), `handleSessionSave` et `editHistorySession` lisent et écrivent `input[name="q4-type"]` et `#q4-effect-sliders input[type="range"][data-type="..."]`.
- **Classification de l'audit préalable** :
  - **Groupe 1 (Identité `Pôle territorial WBE BXL` + Logo `public/logo-poles-territoriaux.svg`)** : **SAFE**
  - **Groupe 2 (`src/styles/apple-premium.css`)** : **SAFE AVEC ADAPTATION** (4 correctifs CSS intégrés)
  - **Groupe 3 (`src/app/apple-ux-enhancements.js`)** : **SAFE AVEC ADAPTATION** (4 correctifs JS intégrés pour connecter le module aux vraies structures du Lot 5 sans aucun effet de bord)
  - **Groupe 4 (`tests/agenda-v74-contract.test.mjs`)** : **SAFE**

---

## 2. CAUSES CONFIRMÉES DES 5 ANOMALIES DU PROTOTYPE UX ALTERNATIF

L'analyse du code de la version alternative a permis d'établir la cause exacte des 5 défauts visibles sur les captures d'écran :
1. **Troncature « `Rien à traiter pou` » avec badge « `À compléter` » dans la case `P1` de l'Accueil** :
   - *Cause confirmée* : `syncDayRibbonWithTodayEvents()` lisait `#home-task-list li` sans filtrer l'état vide `<li>Rien à traiter pour le moment.</li>`, tronquait son texte à 18 caractères (`"Rien à traiter pou"`) et l'affectait à `P1`. De plus, les horaires des 8 périodes étaient codés en dur au lieu d'interroger `window.JournalierAgendaConfig?.getPeriods?.()`.
2. **Bouton « `✍️ Compléter une séance` » superposé au texte « `Rien à traiter pour le moment.` »** :
   - *Cause confirmée* : `initQuickSessionBridge()` testait `!card.textContent.includes('Réalisée')`, condition vraie même sur le `<li>` d'état vide.
3. **Menus déroulants (Popovers) Q2 / Q4 masquant ou passant sous les cartes voisines** :
   - *Cause confirmée* : Toutes les tuiles `.q2-observation-item.is-observed` et `#q4-types-select .ux-bubble.is-observed` partageaient `z-index: 5 !important`. Lors de l'ouverture d'un `.apple-liquid-dropdown`, la tuile parente ne passait pas devant les tuiles suivantes dans l'ordre du DOM.
4. **Sélecteur de période `1e H` → `1e H` empilé sur 2 lignes en Q1** :
   - *Cause confirmée* : Les `<select>` avaient `width: 100%` sans grille explicite `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)` sur `#view-form .v15-period-range` en affichage desktop.
5. **Bloc titre `SUIVI PÉDAGOGIQUE / Rapports & PIA` décalé dans l'en-tête Rapports & PIA + Barre sticky visible hors de l'onglet Séance** :
   - *Cause confirmée* : `.reports-workspace-copy` manquait d'un alignement explicite `align-items: flex-start; text-align: left; width: 100%`. Par ailleurs, `updateStickyVisibility()` écoutait `.tab-btn` au lieu de `.nav-btn` et ne vérifiait pas la présence de `#view-form` dans `#page-stage`.

---

## 3. MODIFICATIONS EFFECTUÉES

### Fichiers créés
1. `public/logo-poles-territoriaux.svg` : Logo vectoriel des Pôles territoriaux (3 silhouettes rouge `#C82027`, jaune d'or `#F5A800`, bleu marine `#001E62`, arc dynamique rouge et mention « Pôles territoriaux »).
2. `src/styles/apple-premium.css` : Feuille de style Design System Apple HIG couvrant l'application de A à Z :
   - **Vues principales** : typographie SF Pro, fond `#f5f5f7`, en-tête Frosted Glass, Segmented Controls, bulles unifiées `#edf5ff` avec `scale(1.025)`, jauges liquides Q2/Q4, élévation `.has-open-dropdown { z-index: 220 !important; }`, grille `.v15-period-range` sur 1 ligne, alignement gauche de `.reports-workspace-copy`, `scroll-margin-top: 90px` sur les cartes de séance ;
   - **Sous-menus, paramètres et vues connectées** : fenêtre `Connexion Microsoft 365 & Gestion Cloud OneDrive` (`#ms-connection-modal`, grille 2 colonnes des actions cloud, états `.ms-status-box.success/.error`, panneau de résolution de conflits `#ms-conflict-resolution-panel`, modale sécurisée `#ms-reset-onedrive-modal`), modale `⚙️ Horaires des 8 périodes` (`#agenda-period-config-modal-card`, lignes `.agenda-period-config-row`), modales d'Agenda (`#slotModal`, `#eventActionModal`, `#eventDeleteModal`, `#eventSeriesChoiceModal`), dossiers et modales Élèves (`#studentModal`, `#studentProfileModal`, `.student-record`, `.multi-select-menu`), sous-onglets `Historique` / `Réunion` et espace `PIA annuel V74` (sous-navigation `.v74-pia-nav` en Segmented Control Apple, cartes des 5 domaines `.v74-domain-overview`, propositions `.v74-prop`, réunions et tableau de bord connecté `.v74-dashboard-grid`).
3. `src/app/apple-ux-enhancements.js` : Module UX additif fournissant :
   - les jauges liquides et menus popovers 1-tap en Q2 et Q4 synchronisés avec les `<input type="range">` natifs ;
   - la désélection universelle en 1 clic sur les bulles de choix exclusifs (Q4 Situation, Q5 Transfert, Q6 Modalité et Objectif PIA) ;
   - le Stepper tactile `1. Contexte` → `6. Suite` et la barre sticky de progression `X/6 rubriques renseignées` liée à `#page-stage` ;
   - le ruban synoptique des 8 périodes sur l'Accueil connecté dynamiquement à `window.JournalierAgendaConfig?.getPeriods?.()` et aux événements réels `#home-today-list .home-row.js-home-event` ;
   - le bouton `✍️ Compléter une séance` injecté uniquement sur les vraies séances planifiées non encodées ;
   - la dictée vocale locale (`SpeechRecognition` / `webkitSpeechRecognition` en `fr-BE`) sur les champs de texte libre.

### Fichiers modifiés
1. `index.html` :
   - `<title>` mis à jour en `Pôle territorial WBE BXL – Agenda & Suivi · V74`.
   - En-tête mis à jour avec `<img src="./logo-poles-territoriaux.svg" ...>` et `<h1 class="brand-title">Pôle territorial WBE BXL</h1>`.
   - Suppression de toute occurrence de « Orthopédagogie / orthopédagogique » dans l'interface.
   - Chargement de `./src/styles/apple-premium.css` et `./src/app/apple-ux-enhancements.js`.
2. `metadata.json` :
   - Description mise à jour vers `Pôle territorial WBE BXL – Suivi Individuel & Collectif • Année Scolaire 2026-2027`.
3. `tests/agenda-v74-contract.test.mjs` :
   - Ajout de `src/app/apple-ux-enhancements.js` à la vérification syntaxique `nodeCheck`.
   - Ajout des assertions contractuelles du Lot 6 (identité `Pôle territorial WBE BXL`, absence de mention `orthopédagogie` dans `index.html`, présence du logo SVG, de `apple-premium.css`, de `apple-ux-enhancements.js`, de `.has-open-dropdown`, de la liaison `window.JournalierAgendaConfig?.getPeriods?.()` et de la garde `rawText.startsWith('Rien à traiter')`).

### Fichiers métier non modifiés (0 ligne modifiée par rapport au Lot 5)
- `src/app/journalier-core.js` : **strictement inchangé**
- `src/app/microsoft-core.js` : **strictement inchangé**
- `src/app/indicators.js` : **strictement inchangé**
- `src/v74/v74-runtime.js` : **strictement inchangé**
- `src/v74/v74-migration.js` : **strictement inchangé**
- `src/msal-bridge.js` & `src/msal-redirect.js` : **strictement inchangés**

---

## 4. TESTS RÉALISÉS & RÉGRESSIONS TESTÉES

1. **Validation syntaxique (`node --check`)** :
   - `src/app/journalier-core.js` : **PASS**
   - `src/app/microsoft-core.js` : **PASS**
   - `src/app/apple-ux-enhancements.js` : **PASS**
   - `src/v74/v74-migration.js` : **PASS**
   - `src/v74/v74-runtime.js` : **PASS**
   - `src/msal-bridge.js` & `src/msal-redirect.js` : **PASS**
2. **Suites de tests contractuels (`npm test`) — 5/5 PASS** :
   - `tests/storage-v74-contract.test.mjs` : **PASS** (Coffre granulaire AES-GCM + AAD + SHA-256 + récupération OneDrive)
   - `tests/agenda-v74-contract.test.mjs` : **PASS** (Modèle `__events`, timeline Jour/Semaine, Drag & Drop, Resize, récurrences, 8 périodes, « Repartir de OneDrive », contrats Lots 4, 5 et 6, CSP statique)
   - `tests/session-edit-contract.test.mjs` : **PASS** (Création, modification, réattribution d'élève, déplacement OneDrive avec ETag, conservation de l'ID de séance)
   - `tests/sync-deletion-contract.test.mjs` : **PASS** (Suppressions d'élèves et de séances, tombstones et non-résurrection)
   - `tests/pia-sync-contract.test.mjs` : **PASS** (Import local DOCX/PDF, persistance et synchronisation OneDrive du PIA)
3. **Build de production (`npm run build`)** :
   - Compilation Vite `8.3.0` (`dist/index.html`, `dist/assets/main-*.css`, `dist/assets/main-*.js`) : **PASS**

---

## 5. LIMITES & ÉLÉMENTS NON TESTÉS EN ENVIRONNEMENT RÉEL

- **Authentification Microsoft Entra ID & Microsoft Graph en direct** : Les flux réseau réels vers un tenant Microsoft Entra ID et OneDrive AppFolder nécessitent une session navigateur interactive authentifiée par l'utilisateur.
- **API Web Speech (`SpeechRecognition` / `webkitSpeechRecognition`)** : La dictée vocale locale (`fr-BE`) repose sur l'API native du navigateur (Chrome, Edge, Safari) et l'autorisation microphone de l'appareil ; lorsque l'API n'est pas disponible, le bouton affiche une notification informative sans perturber la saisie clavier.
