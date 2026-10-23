/**
 * Test contractuel unitaire pour src/v74/v74-pdf-export.js (Lot 3.3)
 * Valide en isolation le moteur d'exportation PDF 1.4 multi-pages et les encodages WinAnsi.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadPdfExportHarness() {
  const docxCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');
  const pdfCode = await fs.readFile(path.join(root, 'src/v74/v74-pdf-export.js'), 'utf8');

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
    Uint8Array,
    Uint32Array,
    DataView,
    TextEncoder,
    TextDecoder,
    window: {}
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  // docxCode fournit classifyDocumentLine
  vm.runInContext(docxCode, context);
  vm.runInContext(pdfCode, context);

  return context;
}

test('Lot 3.3 — Contrat du moteur pdf-export : exposition et encodage WinAnsi', async () => {
  const ctx = await loadPdfExportHarness();
  const api = ctx.JournalierPdf;

  assert.ok(api, 'JournalierPdf doit être exporté sur l’espace global');
  assert.equal(typeof api.makePdf, 'function', 'makePdf doit être une fonction');
  assert.equal(typeof api.wrapPdfTextLine, 'function', 'wrapPdfTextLine doit être une fonction');

  // Encodage WinAnsi (caractères accentués & typographie française)
  const text = 'Élève en intégration : cœur d’apprentissage & €20';
  const bytes = api.pdfWinAnsiBytes(text);
  assert.ok(Array.isArray(bytes));
  assert.ok(bytes.length > 0);

  // Échappement des littéraux PDF (parenthèses)
  const escaped = api.pdfLiteral('Test (avec parenthèses) et \\ slash');
  assert.ok(escaped.startsWith('(') && escaped.endsWith(')'));
  assert.ok(escaped.includes('\\(') && escaped.includes('\\)'));
  assert.ok(escaped.includes('\\\\'));
});

test('Lot 3.3 — Contrat pdf-export : découpage de ligne sans rupture de mot (wrapPdfTextLine)', async () => {
  const ctx = await loadPdfExportHarness();
  const { wrapPdfTextLine } = ctx.JournalierPdf;

  const phrase = 'Le projet individualisé d’apprentissage doit être concerté entre l’école ordinaire, le pôle territorial et la famille.';
  const wrapped = wrapPdfTextLine(phrase, 40, '  ');

  assert.ok(wrapped.length > 1, 'La phrase longue doit être découpée en plusieurs lignes');
  assert.ok(wrapped.every(line => line.length <= 45), 'Chaque ligne respecte approximativement la limite');
  assert.ok(wrapped[1].startsWith('  '), 'La ligne suivante reçoit l’indentation de continuation');
});

test('Lot 3.3 — Contrat pdf-export : assemblage d’un document PDF 1.4 binaire', async () => {
  const ctx = await loadPdfExportHarness();
  const { buildPdfFileFromPageContents } = ctx.JournalierPdf;

  const pageStream = 'BT /F1 12 Tf 50 750 Td (Bonjour le Pôle) Tj ET';
  const pdfBytes = buildPdfFileFromPageContents([pageStream]);

  assert.ok(pdfBytes instanceof ctx.Uint8Array);
  const pdfString = new ctx.TextDecoder('latin1').decode(pdfBytes);

  assert.ok(pdfString.startsWith('%PDF-1.4'), 'Doit avoir l’en-tête standard PDF 1.4');
  assert.ok(pdfString.includes('/Catalog'), 'Doit définir le catalogue de pages');
  assert.ok(pdfString.includes('/Type /Page'), 'Doit définir un objet Page');
  assert.ok(pdfString.includes('xref'), 'Doit inclure une table des références croisées');
  assert.ok(pdfString.includes('trailer'), 'Doit inclure le bloc trailer');
  assert.ok(pdfString.endsWith('%%EOF'), 'Doit se terminer par la balise de fin de fichier %%EOF');
});

test('Lot 3.3 — Contrat pdf-export : génération complète via makePdf (lignes et modèle)', async () => {
  const ctx = await loadPdfExportHarness();
  const { makePdf } = ctx.JournalierPdf;

  // À partir de lignes de texte brut
  const lines = [
    'PLAN INDIVIDUEL D’APPRENTISSAGE',
    'Élève : Élève Alpha',
    'Classe : 4P',
    'Continuité avec le PIA précédent',
    '• Suivi hebdomadaire en classe d’intégration.'
  ];

  const pdfFromLines = makePdf(lines);
  assert.ok(pdfFromLines instanceof ctx.Uint8Array);
  assert.ok(pdfFromLines.length > 300);

  // À partir d’un modèle documentaire structuré
  const model = {
    isPIADocumentModel: true,
    title: 'PIA annuel — document de synthèse',
    statusLabel: 'EN VIGUEUR',
    blocks: [
      {
        type: 'header_banner',
        title: 'PIA de test',
        subtitle: 'Année 2026-2027',
        statusBadge: 'Validé',
        metaRows: [['Élève', 'Élève Alpha', 'Pôle', 'Pôle Territorial']]
      },
      {
        type: 'section_title',
        number: 1,
        title: 'Aménagements raisonnables'
      },
      {
        type: 'table',
        title: 'Mesures en classe',
        headers: ['Domaine', 'Mesure'],
        colWidths: [30, 70],
        rows: [['Organisationnel', 'Tiers-temps pour les évaluations']]
      }
    ]
  };

  const pdfFromModel = makePdf(model);
  assert.ok(pdfFromModel instanceof ctx.Uint8Array);
  assert.ok(pdfFromModel.length > 500);

  const modelString = new ctx.TextDecoder('latin1').decode(pdfFromModel);
  assert.ok(modelString.includes('Tiers-temps'), 'Le PDF doit contenir les données textuelles du modèle');
});
