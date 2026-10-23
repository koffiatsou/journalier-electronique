import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

test('Lot 5B-bis — Correction bug persistPIA dans resetSynthesisDecisions', async () => {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');

  // Vérification statique : l'appel erroné persistPIA n'existe plus
  assert.strictEqual(
    runtimeCode.includes('await persistPIA(rec);'),
    false,
    "L'appel à la fonction inexistante persistPIA doit être éliminé"
  );
  assert.ok(
    runtimeCode.includes('await persistPIAEdit(rec, true);'),
    "resetSynthesisDecisions doit déléguer à persistPIAEdit(rec, true)"
  );

  // Test dynamique exécutable de resetSynthesisDecisions
  let persistedPIA = null;
  const mockState = {
    students: [{ studentId: 'stu-alpha', nom: 'Élève Alpha' }],
    meta: {
      piaRecords: {
        'stu-alpha': {
          studentId: 'stu-alpha',
          lifecycle: 'EN_VIGUEUR',
          finalizedAt: '2026-10-01T10:00:00.000Z',
          meeting1: {
            status: 'FINALISE',
            validatedAt: '2026-10-01T10:00:00.000Z',
            objectivesValidated: ['obj-1'],
            proposals: [
              { id: 'prop-1', decisionStatus: 'VALIDEE', decidedAt: '2026-10-01T09:30:00.000Z' }
            ]
          },
          meeting2: {
            status: 'FINALISE',
            evaluation: [{ objectiveId: 'obj-1', rating: 'ATTEINT' }],
            objectivesToContinue: []
          },
          propositions: [
            { id: 'prop-1', decisionStatus: 'VALIDEE', decidedAt: '2026-10-01T09:30:00.000Z' }
          ],
          sections: [
            { id: 'sec-1', objectifs: ['obj-1'] }
          ]
        }
      }
    }
  };

  const mockDataStore = {
    isReady: () => true,
    getState: () => mockState,
    saveStudents: () => {},
    persistState: async (st) => {
      persistedPIA = st.meta.piaRecords['stu-alpha'];
    }
  };

  // Harnais d'exécution minimal pour tester la fonction resetSynthesisDecisions isolée
  const sandbox = {
    Array,
    Object,
    String,
    window: {
      JournalierDataStore: mockDataStore,
      showAppToast: () => {}
    },
    V74: {
      ui: { piaDraftPersisted: false },
      state: null
    },
    safeArray: (arr) => (Array.isArray(arr) ? arr : []),
    render: () => {},
    persistPIAEdit: async (pia, persistDraft = false) => {
      pia.lifecycle = 'EN_CONSTRUCTION';
      mockState.meta.piaRecords[pia.studentId] = pia;
      await mockDataStore.persistState(mockState);
    }
  };

  const fnMatch = runtimeCode.match(/async function resetSynthesisDecisions\(studentId\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'resetSynthesisDecisions doit être défini dans v74-runtime.js');

  const script = new vm.Script(`(${fnMatch[0]})`);
  const resetFn = script.runInNewContext(sandbox);

  // Exécution : ne doit PAS lever d'erreur persistPIA is not defined
  const success = await resetFn('stu-alpha');
  assert.strictEqual(success, true, 'resetSynthesisDecisions doit retourner true');

  // Vérification des effets de bord sur les données
  const rec = mockState.meta.piaRecords['stu-alpha'];
  assert.strictEqual(rec.lifecycle, 'EN_CONSTRUCTION', 'Le cycle de vie doit repasser en EN_CONSTRUCTION');
  assert.strictEqual(rec.finalizedAt, undefined, 'finalizedAt doit être supprimé');
  assert.strictEqual(rec.meeting1.status, 'A_PREPARE', 'meeting1.status doit repasser en A_PREPARE');
  assert.strictEqual(rec.meeting1.objectivesValidated.length, 0, 'objectivesValidated doit être vidé');
  assert.strictEqual(rec.meeting1.proposals[0].decisionStatus, 'A_EXAMINER', 'Les propositions de réunion 1 doivent être remises A_EXAMINER');
  assert.strictEqual(rec.meeting1.proposals[0].decidedAt, undefined, 'decidedAt doit être supprimé');
  assert.strictEqual(rec.propositions[0].decisionStatus, 'A_EXAMINER', 'Les propositions générales doivent être remises A_EXAMINER');
  assert.strictEqual(rec.sections[0].objectifs.length, 0, 'Les objectifs des sections doivent être vidés');
  assert.strictEqual(rec.meeting2.status, 'A_VENIR', 'meeting2.status doit repasser en A_VENIR');
  assert.strictEqual(rec.meeting2.evaluation.length, 0, 'evaluation de meeting2 doit être vidée');
  assert.ok(persistedPIA, 'Le PIA doit être sauvegardé dans le DataStore');
});
