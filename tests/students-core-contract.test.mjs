/**
 * Test contractuel unitaire pour src/app/students-core.js (Lot 3.5)
 * Valide en isolation la gestion des dossiers élèves, les Bento Cards,
 * les groupements (École, Classe), les modales et le suivi historique.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadStudentsCoreHarness() {
  const studentsCode = await fs.readFile(path.join(root, 'src/app/students-core.js'), 'utf8');

  const context = {
    console,
    Date,
    Math,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Error,
    window: {},
    sessionParts: (log) => ({
      date: log?.identification?.date || log?.date || '2026-10-01',
      matiere: log?.identification?.matiere || log?.contexte?.matiere || log?.matiere || 'Mathématiques',
      eleve: log?.identification?.eleve || log?.eleve || 'Élève Test',
      start: '08:30',
      end: '09:20'
    }),
    sessionSortKey: (log) => `${log?.date || '2026-10-01'}08:3009:20`,
    isJournalSession: (log) => Boolean(log && log.type === 'SEANCE'),
    sessionPeriodLabel: () => '08:30 → 09:20',
    reportHumanDate: (d) => String(d || ''),
    DataStore: {
      getStudents: () => [
        { id: 1, studentId: '1', nom: 'Camille Dupont', classe: '3A', ecole: 'École A', matieres: ['Mathématiques', 'Français'], pia: 'Objectif PIA 1' },
        { id: 2, studentId: '2', nom: 'Alexandre Martin', classe: '4B', ecole: 'École B', matieres: ['Anglais'], pia: '' }
      ],
      saveStudents: () => {},
      getSessions: () => [
        {
          id: 101,
          type: 'SEANCE',
          schemaVersion: '74.0.0',
          identification: { eleve: 'Camille Dupont', date: '2026-10-01', matiere: 'Mathématiques' },
          q2: { observations: [{ observation: 'Comprendre la consigne', niveau: 1 }] },
          q3: { indicateurs: [{ texte: 'Identifie les données utiles' }] },
          q4: { types: ['Aide visuelle'], effets: { 'Aide visuelle': 2 } },
          q5: { statut: 'observed' },
          q6: { actions: ['Consolider'] }
        }
      ],
      getState: () => ({ meta: { piaRecords: {} } })
    }
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(studentsCode, context);

  return context;
}

test('Lot 3.5 — Contrat students-core : exposition et options des matières', async () => {
  const ctx = await loadStudentsCoreHarness();
  const api = ctx.JournalierStudents;

  assert.ok(api, 'JournalierStudents doit être exposé sur l’espace global');
  assert.equal(typeof api.normalizeSubjectList, 'function');
  assert.equal(typeof api.subjectOptionsForSelection, 'function');
  assert.equal(typeof api.renderStudentBentoCard, 'function');
  assert.equal(typeof api.historyQ2LevelLabel, 'function');
  assert.equal(typeof api.historyQ4EffectLabel, 'function');
  assert.equal(typeof api.historyQ5TransferLabel, 'function');

  // Matières standard
  assert.ok(api.SUBJECT_OPTIONS.includes('Mathématiques'));
  assert.ok(api.SUBJECT_OPTIONS.includes('Français'));
  assert.equal(api.SUBJECT_OPTIONS.length, 16);

  // Normalisation
  assert.deepEqual([...api.normalizeSubjectList('Mathématiques, Français')], ['Mathématiques', 'Français']);
  assert.deepEqual([...api.normalizeSubjectList(['Biologie', null, 'Chimie'])], ['Biologie', 'Chimie']);

  // Matières héritées
  const opts = api.subjectOptionsForSelection(['FHGES']);
  assert.ok(opts.includes('FHGES'), 'FHGES doit être inclus en mode hérité si sélectionné');
});

test('Lot 3.5 — Libellés d’évaluation historique et transferts sécurisés', async () => {
  const ctx = await loadStudentsCoreHarness();
  const api = ctx.JournalierStudents;

  assert.equal(api.historyQ2LevelLabel(0), 'Partiellement');
  assert.equal(api.historyQ2LevelLabel(1), 'Suffisamment');
  assert.equal(api.historyQ2LevelLabel(2), 'Totalement');
  assert.equal(api.historyQ2LevelLabel(''), '');

  assert.equal(api.historyQ4EffectLabel(0), 'Aucun effet');
  assert.equal(api.historyQ4EffectLabel(1), 'Effet partiel');
  assert.equal(api.historyQ4EffectLabel(2), 'Effet positif');

  assert.equal(api.historyQ5TransferLabel('observed'), 'Observé');
  assert.equal(api.historyQ5TransferLabel('not_observed'), 'Non observé');
  assert.equal(api.historyQ5TransferLabel('custom_val'), 'custom_val');
});

test('Lot 3.5 — Rendu autonome de la carte Bento élève', async () => {
  const ctx = await loadStudentsCoreHarness();
  const api = ctx.JournalierStudents;

  const student = {
    id: 123,
    studentId: '123',
    nom: 'Camille Dupont',
    classe: '3A',
    ecole: 'Athénée Royal',
    matieres: ['Mathématiques', 'Français'],
    pia: 'Objectif de lecture'
  };

  const sessions = [
    {
      id: 99,
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', date: '2026-10-02', matiere: 'Mathématiques' }
    }
  ];

  const html = api.renderStudentBentoCard(student, sessions, {});

  assert.ok(html.includes('student-bento-card'), 'Doit avoir la classe student-bento-card');
  assert.ok(html.includes('Camille Dupont'), 'Doit afficher le nom de l’élève');
  assert.ok(html.includes('Athénée Royal'), 'Doit afficher l’école');
  assert.ok(html.includes('3A'), 'Doit afficher la classe');
  assert.ok(html.includes('data-action="student-new-session"'), 'Bouton +Séance présent');
  assert.ok(html.includes('data-action="student-open-pia"'), 'Bouton PIA présent');
  assert.ok(html.includes('data-action="student-profile"'), 'Bouton Dossier présent');
  assert.ok(html.includes('data-action="student-edit"'), 'Bouton Modifier présent');
  assert.ok(html.includes('data-action="student-delete"'), 'Bouton Supprimer présent');
});

test('Lot 3.5 — Résolution et compatibilité de l’élève en édition de séance', async () => {
  const ctx = await loadStudentsCoreHarness();
  const api = ctx.JournalierStudents;

  // Recherche d'élève par nom
  const found = api.getStudentByName('Camille Dupont');
  assert.ok(found);
  assert.equal(found.classe, '3A');

  // Élève inexistant
  const missing = api.getStudentByName('Inconnu');
  assert.equal(missing, null);
});
