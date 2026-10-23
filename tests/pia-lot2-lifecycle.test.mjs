import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadV74Lot2Harness() {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const msCode = await fs.readFile(path.join(root, 'src/app/microsoft-core.js'), 'utf8');

  const startIdx = runtimeCode.indexOf('const V74 = {');
  const endIdx = runtimeCode.indexOf('function setPIASection(box,name){');
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'Could not locate PIA engine & lifecycle slice in src/v74/v74-runtime.js');

  const slice = runtimeCode.slice(startIdx, endIdx);

  const msStart = msCode.indexOf('const JOURNALIER_JSON_LIMITS=');
  const msEnd = msCode.indexOf('function validateRemoteStudent(');
  const msSlice = msStart >= 0 && msEnd > msStart ? msCode.slice(msStart, msEnd) : '';

  const formFields = new Map();

  const sandbox = {
    Map,
    Set,
    WeakSet,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    JSON,
    Date,
    Error,
    Uint8Array,
    Uint32Array,
    DataView,
    TextEncoder,
    TextDecoder,
    Blob,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    V74: { ui: {} },
    formFields,
    norm: s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    esc: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    safeArray: x => Array.isArray(x) ? x : [],
    dateOnly: v => String(v || '').slice(0, 10),
    uid: p => `${p}_test_${Math.random().toString(36).slice(2, 8)}`,
    themeDef: text => {
      const t = String(text || '').toLowerCase();
      if (t.includes('consigne')) return { id: 'comprehension_consignes', label: 'Compréhension des consignes', aspect: 'Cognitif (pédagogique)' };
      if (t.includes('planif') || t.includes('organisation')) return { id: 'planification_organisation', label: 'Planification / organisation de la tâche', aspect: 'Lié à l’autonomie' };
      return { id: 'attention_concentration', label: 'Attention / concentration', aspect: 'Cognitif (pédagogique)' };
    },
    aspectForCategory: () => 'Cognitif (pédagogique)',
    piaMeetingRecord: (existing = {}, type = 'REUNION_1_DECEMBRE', status = 'A_PREPARE') => ({
      type,
      status: existing?.status || status,
      date: existing?.date || '',
      context: existing?.context || '',
      participants: existing?.participants || {},
      feedback: existing?.feedback || {},
      decisions: existing?.decisions || '',
      objectivesModified: existing?.objectivesModified || '',
      means: existing?.means || '',
      adaptations: existing?.adaptations || '',
      information: existing?.information || '',
      notes: existing?.notes || '',
      validatedAt: existing?.validatedAt || ''
    }),
    studentSessions: (student, sessions) => sessions.filter(s => s.identification?.eleveId === student.studentId),
    parsePreviousObjectives: () => [],
    continuityFromExisting: () => ({ present: false, role: 'SOURCE_DE_CONTINUITE', format: '', fileName: '', importedAt: '', extracted: {} }),
    window: {},
    document: {
      querySelector: selector => {
        const match = /\[data-v74-prop-formulation="(\d+)"\]/.exec(selector);
        if (match && formFields.has(Number(match[1]))) {
          return { value: formFields.get(Number(match[1])) };
        }
        return null;
      },
      querySelectorAll: () => [],
      createElement: () => ({ click: () => {} })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    function assertAllowedKeys(obj, allowed, label) {
      for (const k of Object.keys(obj)) {
        if (!allowed.has(k)) throw new Error(label + ' : clé non autorisée ' + k);
      }
    }
    ${msSlice}
    ${slice}
    globalThis.__lot2 = {
      buildPIA,
      decidePIAProposal,
      activatePIA,
      syncValidatedObjectivesFromProposals,
      getPIADecisionCounts,
      buildPIAActivationConfirmationMessage,
      piaStatusLabel,
      piaMeetingEditor,
      validateStrictPIA,
      formFields
    };
  `, sandbox);

  return { ...sandbox.__lot2, runtimeCode };
}

function createSampleSessions(studentId = 'stu-1') {
  return [
    {
      id: 'sec-1',
      type: 'SEANCE',
      identification: { eleveId: studentId, eleve: 'Lucas Martin', date: '2026-09-14', matiere: 'Français' },
      contexte: { niveau: 'S1', forme: 'Enseignement ordinaire' },
      objectif: { objectifLecon: 'Comprendre une consigne complexe' },
      q2: { observations: [{ categorie: 'Cognitif', observation: 'Compréhension des consignes complexes', niveau: 0 }], precision: '' },
      q3: { indicateurs: [{ id: 'i1', texte: 'Reformuler la consigne', appreciation: 0 }], precision: '' },
      q4: { situation: 'needed', types: ['Reformulation de la consigne'], effets: { 'Reformulation de la consigne': 2 }, precision: '' },
      q5: { statut: 'aide', precision: '' },
      q6: { actions: ['Maintenir le séquençage des consignes'], modalite: 'Individuel', objectif: 'Stabiliser la compréhension des consignes', collaborations: ['Enseignant'], precision: '' }
    },
    {
      id: 'sec-2',
      type: 'SEANCE',
      identification: { eleveId: studentId, eleve: 'Lucas Martin', date: '2026-09-21', matiere: 'Histoire' },
      contexte: { niveau: 'S1', forme: 'Enseignement ordinaire' },
      objectif: { objectifLecon: 'Analyser les consignes d’un document' },
      q2: { observations: [{ categorie: 'Cognitif', observation: 'Compréhension des consignes complexes', niveau: 0 }, { categorie: 'Autonomie', observation: 'Planification et organisation de la tâche', niveau: 0 }], precision: '' },
      q3: { indicateurs: [{ id: 'i1', texte: 'Reformuler la consigne', appreciation: 0 }, { id: 'i2', texte: 'Planification des étapes', appreciation: 0 }], precision: '' },
      q4: { situation: 'needed', types: ['Reformulation de la consigne', 'Check-list organisation'], effets: { 'Reformulation de la consigne': 2 }, precision: '' },
      q5: { statut: 'aide', precision: '' },
      q6: { actions: ['Maintenir le séquençage des consignes', 'Structurer la planification'], modalite: 'Individuel', objectif: 'Stabiliser la compréhension des consignes', collaborations: ['Enseignant'], precision: '' }
    },
    {
      id: 'sec-3',
      type: 'SEANCE',
      identification: { eleveId: studentId, eleve: 'Lucas Martin', date: '2026-09-28', matiere: 'Sciences' },
      contexte: { niveau: 'S1', forme: 'Enseignement ordinaire' },
      objectif: { objectifLecon: 'Suivre un protocole expérimental' },
      q2: { observations: [{ categorie: 'Cognitif', observation: 'Compréhension des consignes complexes', niveau: 0 }, { categorie: 'Autonomie', observation: 'Planification et organisation de la tâche', niveau: 0 }], precision: '' },
      q3: { indicateurs: [{ id: 'i2', texte: 'Planification des étapes', appreciation: 0 }], precision: '' },
      q4: { situation: 'needed', types: ['Check-list organisation'], effets: { 'Check-list organisation': 2 }, precision: '' },
      q5: { statut: 'partial', precision: '' },
      q6: { actions: ['Structurer la planification'], modalite: 'Petit groupe', objectif: 'Autonomie de planification', collaborations: ['Enseignant'], precision: '' }
    },
    {
      id: 'sec-4',
      type: 'SEANCE',
      identification: { eleveId: studentId, eleve: 'Lucas Martin', date: '2026-10-02', matiere: 'Géographie' },
      contexte: { niveau: 'S1', forme: 'Enseignement ordinaire' },
      objectif: { objectifLecon: 'Organiser une recherche documentaire' },
      q2: { observations: [{ categorie: 'Autonomie', observation: 'Planification et organisation de la tâche', niveau: 0 }], precision: '' },
      q3: { indicateurs: [{ id: 'i2', texte: 'Planification des étapes', appreciation: 0 }], precision: '' },
      q4: { situation: 'needed', types: ['Check-list organisation'], effets: { 'Check-list organisation': 2 }, precision: '' },
      q5: { statut: 'aide', precision: '' },
      q6: { actions: ['Structurer la planification'], modalite: 'Individuel', objectif: 'Autonomie de planification', collaborations: ['Enseignant'], precision: '' }
    }
  ];
}

test('LOT PIA-2 — Cas 1 : Génération de propositions → toutes initialement A_EXAMINER et PIA EN_CONSTRUCTION', async () => {
  const { buildPIA, getPIADecisionCounts, piaStatusLabel } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  assert.equal(pia.lifecycle, 'EN_CONSTRUCTION');
  assert.equal(piaStatusLabel(pia), 'Projet de PIA à examiner');
  assert.ok(pia.propositions.length >= 2, 'Au moins 2 propositions doivent être générées');
  for (const prop of pia.propositions) {
    assert.equal(prop.decisionStatus, 'A_EXAMINER');
  }
  const counts = getPIADecisionCounts(pia);
  assert.equal(counts.pending, pia.propositions.length);
  assert.equal(counts.validated, 0);
  assert.equal(counts.refused, 0);
  assert.equal(pia.meeting1.objectivesValidated.length, 0);
});

test('LOT PIA-2 — Cas 2 : Validation individuelle → VALIDEE, mais pia.lifecycle reste strictement EN_CONSTRUCTION', async () => {
  const { buildPIA, decidePIAProposal, piaStatusLabel } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  const ok = decidePIAProposal(pia, 0, 'VALIDEE');
  assert.equal(ok, true);
  assert.equal(pia.propositions[0].decisionStatus, 'VALIDEE');
  assert.equal(pia.lifecycle, 'EN_CONSTRUCTION', 'Valider une proposition ne doit jamais mettre en vigueur le PIA');
  assert.notEqual(pia.meeting1.status, 'VALIDÉE', 'meeting1.status ne doit pas passer à VALIDÉE sur validation unitaire');
  assert.equal(piaStatusLabel(pia), 'Projet de PIA à examiner');
  assert.equal(pia.meeting1.objectivesValidated.length, 1);
  assert.equal(pia.meeting1.objectivesValidated[0].formulation, pia.propositions[0].formulation);
});

test('LOT PIA-2 — Cas 3 : Refus d’une proposition → REFUSEE, jamais dans objectivesValidated', async () => {
  const { buildPIA, decidePIAProposal } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  const ok = decidePIAProposal(pia, 0, 'REFUSEE');
  assert.equal(ok, true);
  assert.equal(pia.propositions[0].decisionStatus, 'REFUSEE');
  assert.equal(pia.meeting1.objectivesValidated.length, 0);
});

test('LOT PIA-2 — Cas 4, 5 & 6 : Réversibilité complète (VALIDEE -> REFUSEE, REFUSEE -> A_EXAMINER, VALIDEE -> A_EXAMINER)', async () => {
  const { buildPIA, decidePIAProposal, formFields } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  // 1. Valider la proposition 0
  decidePIAProposal(pia, 0, 'VALIDEE');
  assert.equal(pia.meeting1.objectivesValidated.length, 1);

  // 2. Cas 4 : VALIDEE -> REFUSEE retire l'objectif de objectivesValidated
  decidePIAProposal(pia, 0, 'REFUSEE');
  assert.equal(pia.propositions[0].decisionStatus, 'REFUSEE');
  assert.equal(pia.meeting1.objectivesValidated.length, 0, 'Le passage à REFUSEE doit retirer la proposition de objectivesValidated');

  // 3. Cas 5 : REFUSEE -> A_EXAMINER remet la proposition à examiner
  decidePIAProposal(pia, 0, 'A_EXAMINER');
  assert.equal(pia.propositions[0].decisionStatus, 'A_EXAMINER');
  assert.equal(pia.propositions[0].decidedAt, undefined);
  assert.equal(pia.meeting1.objectivesValidated.length, 0);

  // 4. Re-valider puis Cas 6 : VALIDEE -> A_EXAMINER (pour modifier la formulation)
  decidePIAProposal(pia, 0, 'VALIDEE');
  assert.equal(pia.meeting1.objectivesValidated.length, 1);

  decidePIAProposal(pia, 0, 'A_EXAMINER');
  assert.equal(pia.propositions[0].decisionStatus, 'A_EXAMINER');
  assert.equal(pia.meeting1.objectivesValidated.length, 0, 'Remettre à examiner une proposition VALIDEE doit la retirer de objectivesValidated');

  // Modifier la formulation puis re-valider
  formFields.set(0, 'Objectif reformulé explicitement après réouverture.');
  decidePIAProposal(pia, 0, 'VALIDEE');
  assert.equal(pia.propositions[0].decisionStatus, 'VALIDEE');
  assert.equal(pia.propositions[0].formulation, 'Objectif reformulé explicitement après réouverture.');
  assert.equal(pia.meeting1.objectivesValidated.length, 1);
  assert.equal(pia.meeting1.objectivesValidated[0].formulation, 'Objectif reformulé explicitement après réouverture.');
  formFields.clear();
});

test('LOT PIA-2 — Cas 7 & 8 : Mise en vigueur explicite du PIA annuel, blocage si 0 objectif, et exclusion des A_EXAMINER', async () => {
  const { buildPIA, decidePIAProposal, activatePIA, buildPIAActivationConfirmationMessage, piaStatusLabel } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  // Cas 8 : Aucun objectif validé -> activatePIA retourne false et laisse EN_CONSTRUCTION
  assert.equal(activatePIA(pia), false);
  assert.equal(pia.lifecycle, 'EN_CONSTRUCTION');

  // Valider uniquement la proposition 0, laisser la proposition 1 en A_EXAMINER
  decidePIAProposal(pia, 0, 'VALIDEE');
  assert.equal(pia.propositions[1].decisionStatus, 'A_EXAMINER');

  // Cas 7 : Message de confirmation signale explicitement les propositions encore A_EXAMINER
  const msg = buildPIAActivationConfirmationMessage(pia);
  assert.ok(msg.includes('1 proposition(s) validée(s)'), 'Le récapitulatif doit indiquer le nombre de propositions validées');
  assert.ok(msg.includes('encore « À examiner »'), 'Le message doit signaler les propositions encore À examiner');
  assert.ok(msg.includes('Elles ne seront PAS intégrées aux objectifs validés'), 'Le message doit avertir que les propositions À examiner ne seront pas intégrées');

  // Activation globale explicite
  const activated = activatePIA(pia);
  assert.equal(activated, true);
  assert.equal(pia.lifecycle, 'EN_VIGUEUR');
  assert.equal(pia.meeting1.status, 'VALIDÉE');
  assert.ok(pia.meeting1.validatedAt.length >= 10);
  assert.equal(piaStatusLabel(pia), 'PIA annuel en vigueur');

  // La proposition 1 restée A_EXAMINER ne doit PAS être dans objectivesValidated
  assert.equal(pia.meeting1.objectivesValidated.length, 1);
  assert.equal(pia.meeting1.objectivesValidated[0].id, pia.propositions[0].id);
  assert.equal(pia.propositions[1].decisionStatus, 'A_EXAMINER');
});

test('LOT PIA-2 — Cas 9 & 10 : Absence de doublons dans objectivesValidated et conformité stricte validateStrictPIA', async () => {
  const { buildPIA, decidePIAProposal, activatePIA, validateStrictPIA, formFields } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  // Valider plusieurs fois de suite la même proposition (avec changement de texte entre-temps)
  decidePIAProposal(pia, 0, 'VALIDEE');
  decidePIAProposal(pia, 0, 'VALIDEE');
  formFields.set(0, 'Formulation ajustée sans créer de doublon.');
  decidePIAProposal(pia, 0, 'VALIDEE');
  formFields.clear();

  assert.equal(pia.meeting1.objectivesValidated.length, 1, 'Aucun doublon ne doit être créé dans objectivesValidated');
  assert.equal(pia.meeting1.objectivesValidated[0].formulation, 'Formulation ajustée sans créer de doublon.');

  activatePIA(pia);
  assert.equal(validateStrictPIA(pia, 'PIA après LOT PIA-2'), true);
});

test('LOT PIA-2 — Cas 11 : Export PIA ne ferme plus le PIA et piaMeetingEditor affiche le résumé (date + participants)', async () => {
  const { buildPIA, piaMeetingEditor, runtimeCode } = await loadV74Lot2Harness();
  const student = { studentId: 'stu-1', nom: 'Lucas Martin', classe: '1C', ecole: 'Athénée Royal' };
  const pia = buildPIA(student, createSampleSessions('stu-1'), '2026-10-04', null);

  pia.meeting1.date = '2026-12-10';
  pia.meeting1.participants = { eleve: true, parents: true, integration: true };
  const html = piaMeetingEditor(pia, 'meeting1', 'Réunion de décembre', 'REUNION_1_DECEMBRE');

  assert.ok(html.includes('Date : 2026-12-10'), 'Le summary de la réunion doit afficher la date renseignée');
  assert.ok(html.includes('3 participant(s) : Élève, Parents, Agent d’intégration'), 'Le summary de la réunion doit afficher les participants cochés');
  assert.ok(html.includes('open'), 'La réunion 1 doit être ouverte par défaut lorsque le PIA n’est pas en réévaluation');

  // Vérifier que exportPia dans v74-runtime.js n'appelle plus closePIAProject()
  const exportSliceStart = runtimeCode.indexOf('const exportPia=async deid=>{');
  const exportSliceEnd = runtimeCode.indexOf('box.querySelector("#v74-export-prof")');
  const exportSlice = runtimeCode.slice(exportSliceStart, exportSliceEnd);
  assert.ok(!exportSlice.includes('closePIAProject()'), 'L’export DOCX/PDF ne doit plus fermer automatiquement le PIA ouvert');
});
