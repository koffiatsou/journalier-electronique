import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const sessionsCode = fs.readFileSync(path.join(root, 'src/app/sessions-core.js'), 'utf8');

function createSessionsContext() {
  const context = {
    window: {},
    global: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {} } }),
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    console,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    JSON,
    JOURNALIER_DIAGNOSTICS: { q3: {} },
    updateIndicatorDiagnosticPanel: () => {},
    showAppToast: () => {},
    getDB: () => [],
    saveDB: () => {},
    getStudents: () => [],
    getPrevisionnel: () => ({ __events: [] }),
    DataStore: {
      getAgenda: () => ({ __events: [] }),
      saveAgenda: async () => {},
      getIdentity: () => ({ ownerId: 'test-owner' }),
      getSessions: () => [],
      saveSessions: () => {},
      getStudents: () => []
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(sessionsCode, context);
  return context;
}

test('Sessions Core : Contrat d’initialisation et export de JournalierSessions', () => {
  const ctx = createSessionsContext();
  assert.ok(ctx.JournalierSessions, 'JournalierSessions doit être exposé');
  assert.equal(typeof ctx.JournalierSessions.sessionParts, 'function');
  assert.equal(typeof ctx.JournalierSessions.sessionPeriodLabel, 'function');
  assert.equal(typeof ctx.JournalierSessions.sessionSortKey, 'function');
  assert.equal(typeof ctx.JournalierSessions.persistSessionEntry, 'function');
  assert.equal(typeof ctx.JournalierSessions.clearObservationForm, 'function');
  assert.equal(typeof ctx.JournalierSessions.normalizeIndicatorText, 'function');
  assert.equal(typeof ctx.JournalierSessions.q3AssessmentLabel, 'function');
  assert.equal(typeof ctx.JournalierSessions.historyQ2LevelLabel, 'function');
  assert.equal(typeof ctx.JournalierSessions.historyQ4EffectLabel, 'function');
  assert.equal(typeof ctx.JournalierSessions.historyQ5TransferLabel, 'function');
});

test('Sessions Core : Décomposition et libellé de séance (sessionParts & sessionPeriodLabel)', () => {
  const ctx = createSessionsContext();
  const { sessionParts, sessionPeriodLabel, sessionSortKey } = ctx.JournalierSessions;

  const mockSession = {
    identification: {
      eleve: 'Élève Test',
      date: '2026-09-15',
      periode: { start: '1e H', end: '2e H' }
    },
    contexte: {
      matiere: 'Français'
    }
  };

  const parts = sessionParts(mockSession);
  assert.equal(parts.eleve, 'Élève Test');
  assert.equal(parts.date, '2026-09-15');
  assert.equal(parts.start, '1e H');
  assert.equal(parts.end, '2e H');
  assert.equal(parts.matiere, 'Français');

  assert.equal(sessionPeriodLabel(mockSession), '1e H → 2e H');
  assert.equal(sessionSortKey(mockSession), '2026-09-151e H2e H');

  const singlePeriodSession = {
    identification: {
      periode: { start: '3e H', end: '3e H' }
    }
  };
  assert.equal(sessionPeriodLabel(singlePeriodSession), '3e H');
});

test('Sessions Core : Normalisation de texte d’indicateur (normalizeIndicatorText)', () => {
  const ctx = createSessionsContext();
  const { normalizeIndicatorText } = ctx.JournalierSessions;

  assert.equal(normalizeIndicatorText('Écouter Attentivement !'), 'ecouter attentivement');
  assert.equal(normalizeIndicatorText('  Lecture & Compréhension  '), 'lecture comprehension');
});

test('Sessions Core : Libellés Q2, Q3, Q4, Q5', () => {
  const ctx = createSessionsContext();
  const { q3AssessmentLabel, historyQ2LevelLabel, historyQ4EffectLabel, historyQ5TransferLabel } = ctx.JournalierSessions;

  assert.equal(q3AssessmentLabel(0), 'À renforcer');
  assert.equal(q3AssessmentLabel(1), 'En cours d’appropriation');
  assert.equal(q3AssessmentLabel(2), 'Maîtrisé');

  assert.equal(historyQ2LevelLabel(0), 'Partiellement');
  assert.equal(historyQ2LevelLabel(1), 'Suffisamment');
  assert.equal(historyQ2LevelLabel(2), 'Totalement');

  assert.equal(historyQ4EffectLabel(0), 'Aucun effet');
  assert.equal(historyQ4EffectLabel(1), 'Effet partiel');
  assert.equal(historyQ4EffectLabel(2), 'Effet positif');

  assert.equal(historyQ5TransferLabel('observed'), 'Observé');
  assert.equal(historyQ5TransferLabel('not_observed'), 'Non observé');
  assert.equal(historyQ5TransferLabel('later'), 'À observer plus tard');
});
