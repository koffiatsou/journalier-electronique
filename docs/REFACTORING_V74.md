# Refactorisation V74 — Synthèse Globale (Lots 1 à 5)

Ce document récapitule l'ensemble du chantier de refactorisation structurelle et d'évolution maîtrisée réalisé sur **Journalier V74** (Pôle territorial WBE), du découpage initial jusqu'à la clôture du **Lot 5**.

---

## 1. Architecture des Fichiers Applicatifs

- `index.html` : structure DOM, modales (Agenda, séries récurrentes, configuration des 8 périodes, confirmation « Repartir de OneDrive ») et chargements de scripts externes conformes à la CSP.
- `src/styles/journalier.css` & `src/styles/journalier-ux-responsive.css` : feuilles de styles principales et couche UX/UI responsive (PC, tablette, téléphone, timeline horaire Agenda).
- `src/app/indicators.js` : bibliothèque et diagnostic des indicateurs WBE.
- `src/app/journalier-core.js` : cœur applicatif local-first (`JournalierSecurity`, coffre chiffré granulaire IndexedDB `journalier-secure-v74`, gestion des élèves, séances, historique, et Agenda niveau Outlook).
- `src/app/microsoft-core.js` : authentification Entra ID, client Microsoft Graph (`AppFolder`), `SyncManager` bidirectionnel avec ETags/fingerprints, récupération automatique sur coffre vide et fonctionnalité « Repartir de OneDrive ».
- `src/v74/v74-runtime.js` : moteur PIA annuel, analyse de convergence multi-séances, import local DOCX/PDF sans conservation du fichier original, tableau de bord d'accueil et exports DOCX/PDF/JSON (nominatifs et dé-identifiés).
- `src/v74/v74-migration.js` : migration contrôlée et non destructive depuis `AppFolder/Journalier-legacy`.

---

## 2. Récapitulatif Chronologique des 5 Lots

### Lot 1 — Hygiène structurelle, utilitaires purs et dé-duplication initiale (`REFACTORING_LOT1.md`)
- Unification des utilitaires d'échappement HTML/XML (`escapeHtml`, `xmlEsc`) et de décodage d'entités (`decodeEntities`).
- Factorisation de la résolution de catégorie visuelle des 5 domaines PIA via `resolvePiaAspectCategory(aspect)`.
- Extraction de `v72ProcessPendingDeletions(state, r, details)` dans `src/app/microsoft-core.js` pour isoler le traitement prioritaire des suppressions distantes OneDrive (`deletedStudents`, `deletedSessions`).
- Découpage des sous-fonctions de rendu dans `src/app/journalier-core.js` (`renderSessionStudentsSummary`, `renderSessionObjectivesSummary`, `renderSessionObservationsSummary`).

### Lot 2 — Constantes métier immuables et tables de référence (`REFACTORING_LOT2.md`)
- Extraction de `DEFAULT_CONVERGENCE_THRESHOLDS` (`Object.freeze`) pour les seuils de convergence PIA (`SIGNAL_MIN_SESSIONS`, `TREND_MIN_SESSIONS`, `PROPOSAL_MIN_SOURCES`).
- Remplacement de la chaîne conditionnelle de `proposalText(g)` par le dictionnaire immuable `PROPOSAL_TEMPLATES`.
- Extraction de la table d'encodage Windows-1252 `WIN_ANSI_BYTE_MAP` hors de `pdfWinAnsiBytes(text)`.
- Extraction de `AGENDA_TIME_BOUNDS` (`MIN_START: 450`, `MAX_END: 1050`, `STEP_MINUTES: 5`, `MIN_DURATION: 15`) dans `src/app/journalier-core.js`.

### Lot 3 — Agenda niveau Outlook & « Repartir de OneDrive » (`REFACTORING_LOT3.md`)
- **Axe 1 — Agenda niveau Outlook** (`src/app/journalier-core.js`) :
  - Rendu en timeline horaire continue (`getTimelineRange`) pour les vues Jour et Semaine, avec gestion dynamique des chevauchements en colonnes parallèles.
  - Horaires précis (`HH:MM`) combinés aux 8 périodes scolaires configurables (`DEFAULT_AGENDA_PERIODS` : `08:25` à `16:35`) via déduction automatique (`agendaPeriodsFromTimes`).
  - Glisser-déposer (Drag & Drop) d'événements (`initDragAndDropHandlers`, `handleEventMove`), redimensionnement à la souris/tactile par la poignée inférieure (`initResizeInteraction`) et création rapide par clic ou sélection glissée (`initTimelineSelection`) avec garde anti-collision (`_jrSuppressNextClick`).
  - Moteur de récurrence avancée (`eventOccursOnDate` : quotidienne, hebdomadaire multi-jours, mensuelle fixe ou relative, annuelle, avec intervalle, date de fin ou nombre d'occurrences) et gestion complète des séries/exceptions (`showSeriesOrOccurrenceModal`, `createEventException`, `splitRecurringSeries`).
- **Axe 2 — « Repartir de OneDrive »** (`src/app/microsoft-core.js`) :
  - Implémentation de `v74RepartirDeOneDrive()` permettant de reconstruire l'état local chiffré à partir de la copie saine présente dans OneDrive `AppFolder/Journalier`.
  - Validation stricte de tous les fichiers distants en mémoire tampon avant remplacement atomique (`securePersistGranularWrite(..., { purgeBefore: true })`). En cas d'erreur réseau ou de fichier invalide, le coffre local existant reste intact.

### Lot 4 — Factorisation interne Agenda, Séries et Hydratation OneDrive (`REFACTORING_LOT4.md`)
- **Agenda & Séries récurrentes (`src/app/journalier-core.js`)** :
  - `addSeriesExceptionDate(prev, seriesId, isoDate)` : ajout idempotent d'une date d'exclusion dans `prev.__exceptions[seriesId]` (6 parcours unifiés).
  - `closeRecurringMasterBeforeDate(prev, seriesId, splitIsoDate)` : clôture d'une série maîtresse à `J-1` lors d'une scission « Cet événement et les suivants » (5 parcours unifiés).
  - `getEventStartEndMinutes(ev)` et `computeEventTimelineLanes(events)` : factorisation du calcul des bornes horaires en minutes et de l'attribution des colonnes parallèles (`_lane`, `_totalLanes`) entre `renderDayView`, `renderWeekView` et `initResizeInteraction`.
- **Synchronisation & Hydratation OneDrive (`src/app/microsoft-core.js`)** :
  - `countUncommittedSyncChanges(state)` : comptage unifié des modifications locales non synchronisées (`students`, `sessions`, `pia`, `agenda`, `deletedStudents`, `deletedSessions`).
  - `applyRemotePiaPayload(json, studentId, piaRecordsTarget, piaImportsTarget)` : application unifiée d'un payload PIA distant (`PIA_ANNUEL` + `sourceContinuity` vs `PIA_IMPORT_CONTINUITE`) dans les 4 parcours distants.
  - `readRemoteStudentFolderInto(folder, ownerId, studentsTarget, sessionsTarget, options)` : lecture, validation et normalisation mutualisées d'un dossier élève distant (`profil.json` + `seances/*.json`).

### Lot 5 — Constantes d'analyse immuables, Prédicat de séance & Rafraîchissement UI (`REFACTORING_LOT5.md`)
- **Constantes immuables (`Object.freeze`)** :
  - `INDICATOR_SUBJECT_ALIASES` et `INDICATOR_STOP_WORDS` dans `src/app/journalier-core.js`.
  - `WIN_ANSI_DECODE_MAP` et `PIA_CANONICAL_ASPECTS` dans `src/v74/v74-runtime.js`.
- **Factorisations ciblées** :
  - `isSameStudentSessionSlot(s, entry, targetStudentId)` dans `persistSessionEntry` (`src/app/journalier-core.js`).
  - `refreshUIAfterCloudSync()` dans `src/app/microsoft-core.js` (appliqué à `diagnoseSyncManagerV72` et `v72PullRemoteChanges`).
- **Lisibilité** : décompression syntaxique multi-lignes des fonctions compactées dans `src/app/journalier-core.js`, `src/app/microsoft-core.js` et `src/v74/v74-runtime.js`.

---

## 3. Suites de Tests Contractuels (`npm test`)

L'intégrité fonctionnelle, structurelle et de sécurité est vérifiée par 5 suites exécutées via `npm test` :
1. `tests/storage-v74-contract.test.mjs` : chiffrement AES-GCM + AAD, intégrité SHA-256, persistance granulaire IndexedDB (`journalier-secure-v74`), rétrocompatibilité `v72` et récupération OneDrive.
2. `tests/agenda-v74-contract.test.mjs` : syntaxe JS de tous les modules, directives CSP, modèle `__events`, timeline horaire, Drag & Drop, Resize, récurrences avancées, 8 périodes, « Repartir de OneDrive » et présence des helpers des Lots 4 et 5.
3. `tests/session-edit-contract.test.mjs` : modification de séance, réattribution d'élève (y compris après suppression de l'ancien élève), déplacement OneDrive atomique avec ETag et conservation de l'identifiant de séance.
4. `tests/sync-deletion-contract.test.mjs` : persistance des tombstones `deletedStudents` / `deletedSessions`, exécution prioritaire des suppressions distantes OneDrive et protection contre la ré-importation d'entités supprimées.
5. `tests/pia-sync-contract.test.mjs` : import local DOCX/PDF, continuité PIA (`piaImports` / `piaRecords`) et synchronisation bidirectionnelle OneDrive (`AppFolder/Journalier/pia/{studentId}/pia.json`).
