import js from '@eslint/js';
import globals from 'globals';

/**
 * Symboles globaux du projet « Journalier électronique ».
 * Provenance : fonctions, objets et variables exposés par les scripts classiques
 * (chargés séquentiellement dans index.html sans encapsulation de module)
 * ainsi que les ponts inter-modules (window.* et hooks d'interface).
 * Trié par ordre alphabétique pour faciliter la maintenance.
 */
const projectGlobals = {
  DataStore: 'writable',
  INDICATOR_LIBRARY: 'writable',
  INDICATOR_LIBRARY_STATUS: 'writable',
  JOURNALIER_ARCHITECTURE_VERSION: 'writable',
  JOURNALIER_DIAGNOSTICS: 'writable',
  JournalierDocx: 'writable',
  JournalierPdf: 'writable',
  JournalierSecurity: 'writable',
  activateJournalierAccount: 'writable',
  addCustomQ3Indicator: 'writable',
  applyAgendaPeriodConfig: 'writable',
  bindReportsUX: 'writable',
  buildPIADocumentModel: 'writable',
  chooseSessionSubject: 'writable',
  classifyDocumentLine: 'writable',
  clearObservationForm: 'writable',
  closeAllChoiceMenus: 'writable',
  closeEventActionModal: 'writable',
  closeEventDeleteModal: 'writable',
  closeMicrosoftConnection: 'writable',
  closeSlotModal: 'writable',
  closeStudentModal: 'writable',
  closeStudentProfile: 'writable',
  computeAttendanceStats: 'writable',
  deleteHistorySession: 'writable',
  deleteStudent: 'writable',
  diagnoseSyncManagerV72: 'writable',
  disconnectMicrosoft: 'writable',
  editHistorySession: 'writable',
  editingSessionId: 'writable',
  escapeHtml: 'writable',
  filterSessionSubjects: 'writable',
  filterStudentSubjects: 'writable',
  findIndicatorById: 'writable',
  formatISO: 'writable',
  generateReport: 'writable',
  getDB: 'writable',
  getDayIndexFromISO: 'writable',
  getInitialDateISO: 'writable',
  getMonday: 'writable',
  getPrevisionnel: 'writable',
  getSessionClassNotes: 'writable',
  getSessionPresenceMeta: 'writable',
  getSessionPresenceStatus: 'writable',
  getStudents: 'writable',
  historyQ2LevelLabel: 'writable',
  historyQ4EffectLabel: 'writable',
  historyQ5TransferLabel: 'writable',
  isJournalSession: 'writable',
  isObservationSession: 'writable',
  journalierClearAutoLockTimers: 'writable',
  journalierLockedByTimeout: 'writable',
  journalierResetAutoLockAfterUnlock: 'writable',
  journalierScheduleAutoSync: 'writable',
  journalierUuid: 'writable',
  jumpToDayView: 'writable',
  loadStudentHistory: 'writable',
  module: 'readonly',
  msAccount: 'writable',
  navigateAgenda: 'writable',
  normalizeAgendaData: 'writable',
  normalizeSubjectList: 'writable',
  openAddStudentModal: 'writable',
  openConflictResolutionV72: 'writable',
  openEditStudentModal: 'writable',
  openEventActionModal: 'writable',
  openMicrosoftConnection: 'writable',
  openSessionSubjectMenu: 'writable',
  openSlotModal: 'writable',
  openStudentProfile: 'writable',
  parseISODate: 'writable',
  periods: 'writable',
  persistSessionEntry: 'writable',
  pickerDateChanged: 'writable',
  populatePeriodSelectors: 'writable',
  prepareEditingStudentSelection: 'writable',
  prepareMicrosoft365Space: 'writable',
  q3AssessmentState: 'writable',
  quickFormForSlot: 'writable',
  refreshSessionSubjectsForStudent: 'writable',
  renderAgenda: 'writable',
  renderHome: 'writable',
  renderSessionMainSubjectBubbles: 'writable',
  renderStudentsView: 'writable',
  reportHumanDate: 'writable',
  savePia: 'writable',
  saveSlotModification: 'writable',
  saveStudent: 'writable',
  secureNormalizeAgenda: 'writable',
  secureNormalizeSession: 'writable',
  secureNormalizeStudent: 'writable',
  securePersistState: 'writable',
  selectedDateISO: 'writable',
  sessionParts: 'writable',
  sessionPeriodLabel: 'writable',
  sessionSortKey: 'writable',
  setCloudStatus: 'writable',
  setReportsTab: 'writable',
  showAppToast: 'writable',
  showPIAImportName: 'writable',
  showTab: 'writable',
  startMicrosoftLogin: 'writable',
  switchAgendaView: 'writable',
  syncBubbleCheckboxStates: 'writable',
  syncBubbleSelects: 'writable',
  syncFindStudentByName: 'writable',
  syncFingerprint: 'writable',
  syncPendingLocalChangesV72: 'writable',
  syncSessionPeriodRange: 'writable',
  syncWithoutVolatileMeta: 'writable',
  testMicrosoftAppFolder: 'writable',
  todayAgenda: 'writable',
  toggleDuplicateFields: 'writable',
  toggleModalSlotFields: 'writable',
  toggleMultiSelect: 'writable',
  toggleQ3LearningMore: 'writable',
  toggleStudentSubject: 'writable',
  updateIndicatorDiagnosticPanel: 'writable',
  updateMicrosoftUI: 'writable',
  updateObservationSuggestions: 'writable',
  updatePIAPrompt: 'writable',
  updateQ3BubbleState: 'writable',
  updateRecurrenceNote: 'writable',
  updateStats: 'writable',
  updateStudentDropdowns: 'writable',
  v72EnsureSyncRegistry: 'writable',
  v72MarkPiaPending: 'writable',
  v72MarkPiaSynced: 'writable',
  v72RecountPending: 'writable',
  verifyMicrosoft365Space: 'writable'
};

export default [
  // Fichiers et dossiers ignorés
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'docs/**',
      '*.zip',
      'coverage/**',
      'src/**/*.tsx',
      'src/**/*.ts'
    ]
  },

  // 1. Règles recommandées et règles de sécurité strictes du projet
  {
    files: ['**/*.js', '**/*.mjs', '**/*.jsx', '**/*.tsx'],
    rules: {
      ...js.configs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-debugger': 'error',
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],

      // Règles du point 5 d\'étape 5B passées en avertissement (à traiter dans les étapes ultérieures)
      'no-empty': 'warn', // À traiter (étape ultérieure)
      'no-var': 'warn', // À traiter (étape ultérieure)
      'no-useless-assignment': 'warn', // À traiter (étape ultérieure)
      'no-useless-escape': 'warn', // À traiter (étape ultérieure)
      'preserve-caught-error': 'warn', // À traiter (étape ultérieure)
      'no-regex-spaces': 'warn' // À traiter (étape ultérieure)
    }
  },

  // 2. Scripts classiques du navigateur (chargés séquentiellement sans type="module")
  {
    files: [
      'src/app/html-escape.js',
      'src/app/indicators.js',
      'src/app/storage-vault.js',
      'src/v74/v74-docx-pia-pv.js',
      'src/v74/v74-docx-export.js',
      'src/v74/v74-pdf-export.js',
      'src/app/students-core.js',
      'src/app/agenda-core.js',
      'src/app/sessions-core.js',
      'src/app/reports-core.js',
      'src/app/journalier-core.js',
      'src/v74/pia-lifecycle-engine.js'
    ],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...projectGlobals
      }
    }
  },

  // 3. Modules ES du navigateur (chargés avec type="module" ou importés)
  {
    files: [
      'src/msal-bridge.js',
      'src/msal-redirect.js',
      'src/app/microsoft-core.js',
      'src/v74/v74-runtime.js',
      'src/app/apple-ux-enhancements.js',
      'src/app/referentiel-amenagements.js',
      'src/app/local-ai-assistant.js'
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...projectGlobals
      }
    }
  },

  // 4. Environnement Node.js (suites de tests, scripts d\'outillage et configuration)
  {
    files: [
      'tests/**/*.mjs',
      'tests/**/*.js',
      'scripts/**/*.js',
      'vite.config.js',
      'eslint.config.js'
    ],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node
      }
    }
  }
];
