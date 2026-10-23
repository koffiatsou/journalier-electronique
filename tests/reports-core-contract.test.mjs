/**
 * Test contractuel unitaire pour src/app/reports-core.js (Lot 3.4)
 * Valide en isolation le moteur de rapport naturel, d'analyse des régularités
 * et de génération des synthèses pédagogiques.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadReportsCoreHarness() {
  const reportsCode = await fs.readFile(path.join(root, 'src/app/reports-core.js'), 'utf8');

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
      eleve: log?.identification?.eleve || log?.eleve || 'Élève Test'
    }),
    toInfinitivePhrase: (t) => String(t || '').trim(),
    historyQ2LevelLabel: (n) => (n === 2 ? 'Totalement' : (n === 1 ? 'Suffisamment' : 'Partiellement')),
    historyQ4EffectLabel: (n) => (n === 2 ? 'effet positif' : 'effet partiel'),
    historyQ5TransferLabel: (s) => (s === 'observed' ? 'Observé' : 'Non observé')
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(reportsCode, context);

  return context;
}

test('Lot 3.4 — Contrat reports-core : exposition et fonctions pures de déduplication', async () => {
  const ctx = await loadReportsCoreHarness();
  const api = ctx.JournalierReports;

  assert.ok(api, 'JournalierReports doit être exposé sur l’espace global');
  assert.equal(typeof api.reportUnique, 'function');
  assert.equal(typeof api.reportRarityPhrase, 'function');
  assert.equal(typeof api.reportTheme, 'function');

  // Déduplication
  const unique = api.reportUnique(['A', 'B', 'A', null, '', 'C']);
  assert.deepEqual(Array.from(unique), ['A', 'B', 'C']);

  // Phrase de rareté
  assert.equal(api.reportRarityPhrase(['Calcul mental']), 'Calcul mental');
  assert.equal(api.reportRarityPhrase(['Calcul mental', 'Géométrie']), 'Calcul mental et Géométrie');
  assert.equal(api.reportRarityPhrase(['A', 'B', 'C']), 'A, B et C');
});

test('Lot 3.4 — Contrat reports-core : classification des thèmes et vocabulaire pédagogique', async () => {
  const ctx = await loadReportsCoreHarness();
  const { reportTheme } = ctx.JournalierReports;

  const th1 = reportTheme('procedural');
  assert.equal(th1.kind, 'fonctionnement');
  assert.ok(th1.label.includes('procédures'));

  const th2 = reportTheme('geometry');
  assert.equal(th2.kind, 'apprentissage');
  assert.ok(th2.label.includes('géométriques'));

  const thUnknown = reportTheme('inconnu');
  assert.equal(thUnknown.kind, 'fonctionnement');
});

test('Lot 3.4 — Contrat reports-core : extraction des preuves de séance et des relations', async () => {
  const ctx = await loadReportsCoreHarness();
  const { reportSessionEvidence, reportExtractUnits, reportRelations } = ctx.JournalierReports;

  const log1 = {
    identification: { date: '2026-10-05', eleve: 'Élève Test', matiere: 'Français' },
    q2: { observations: [{ observation: 'Suit les étapes de la consigne avec guidage', niveau: 1 }] },
    q3: { indicateurs: [{ texte: 'Comprendre une consigne complexe', appreciation: 1 }] },
    q4: { types: ['Reformulation orale'], effets: { 'Reformulation orale': 2 } },
    q5: { statut: 'observed' },
    q6: { actions: ['Maintenir le guidage'] }
  };

  const evidence = [reportSessionEvidence(log1)];
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].date, '2026-10-05');
  assert.equal(evidence[0].matiere, 'Français');

  const units = reportExtractUnits(evidence);
  assert.ok(Array.isArray(units));
  assert.ok(units.length > 0, 'Les unités d’observation doivent être extraites');

  const relations = reportRelations(units);
  assert.ok(relations, 'L’objet relations doit être généré');
  assert.ok(Array.isArray(relations.recurrences));
});
