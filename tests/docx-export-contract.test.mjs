/**
 * Test contractuel unitaire pour src/v74/v74-docx-export.js (Lot 3.2)
 * Valide en isolation le moteur d'exportation DOCX / OpenXML et le compresseur ZIP.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadDocxExportHarness() {
  const docxCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');

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
  vm.runInContext(docxCode, context);

  return context;
}

test('Lot 3.2 — Contrat du moteur docx-export : exposition et primitives binaires', async () => {
  const ctx = await loadDocxExportHarness();
  const api = ctx.JournalierDocx;

  assert.ok(api, 'JournalierDocx doit être exporté sur l’espace global');
  assert.equal(typeof api.makeDocx, 'function', 'makeDocx doit être une fonction');
  assert.equal(typeof api.buildZipStoreArchive, 'function', 'buildZipStoreArchive doit être une fonction');

  // Test CRC32 & entiers binaires
  const encoder = new ctx.TextEncoder();
  const testBytes = encoder.encode('Journalier V74');
  const crc = api.crc32(testBytes);
  assert.equal(typeof crc, 'number');
  assert.ok(crc > 0, 'CRC32 doit être positif');

  const u16Val = api.u16(514);
  assert.deepEqual(Array.from(u16Val), [2, 2], 'u16(514) doit valoir [2, 2]');

  const u32Val = api.u32(0x04034b50);
  assert.deepEqual(Array.from(u32Val), [0x50, 0x4b, 0x03, 0x04], 'u32 doit être en little-endian');
});

test('Lot 3.2 — Contrat docx-export : classification typographique des lignes', async () => {
  const ctx = await loadDocxExportHarness();
  const { classifyDocumentLine } = ctx.JournalierDocx;

  assert.equal(classifyDocumentLine('  ', 0), 'empty');
  assert.equal(classifyDocumentLine('PLAN INDIVIDUEL D’APPRENTISSAGE', 0), 'title');
  assert.equal(classifyDocumentLine('Continuité avec le PIA précédent', 5), 'h1');
  assert.equal(classifyDocumentLine('1. Analyse globale', 3), 'h1');
  assert.equal(classifyDocumentLine('Objectifs validés :', 8), 'h2');
  assert.equal(classifyDocumentLine('2026-10-10 — Bilan de séance', 2), 'h2');
  assert.equal(classifyDocumentLine('• Aménagement ergonomique', 9), 'bullet');
  assert.equal(classifyDocumentLine('Nom de l’élève : Élève Alpha', 10), 'kv');
  assert.equal(classifyDocumentLine('Texte explicatif général d’observation.', 11), 'body');
});

test('Lot 3.2 — Contrat docx-export : génération de paragraphe et de tableau XML', async () => {
  const ctx = await loadDocxExportHarness();
  const { formatDocxParagraph, formatDocxTable } = ctx.JournalierDocx;

  // Paragraphe simple
  const pXml = formatDocxParagraph('Élève Alpha : suivi actif', { kvSplit: true, bold: true });
  assert.ok(pXml.includes('<w:p>'), 'Doit générer une balise w:p');
  assert.ok(pXml.includes('Élève Alpha : '), 'Doit contenir le libellé');
  assert.ok(pXml.includes('suivi actif'), 'Doit contenir la valeur');

  // Tableau
  const tableXml = formatDocxTable({
    title: 'Tableau des aménagements',
    headers: ['Domaine', 'Type', 'Description'],
    colWidths: [30, 20, 50],
    rows: [
      ['Organisationnel', 'Temps', 'Tiers-temps accordé pour les évaluations écrites']
    ]
  });

  assert.ok(tableXml.includes('<w:tbl>'), 'Doit générer une balise w:tbl');
  assert.ok(tableXml.includes('Tableau des aménagements'), 'Doit afficher le titre du tableau');
  assert.ok(tableXml.includes('Tiers-temps accordé'), 'Doit contenir les cellules de données');
});

test('Lot 3.2 — Contrat docx-export : archive ZIP complète et structure OpenXML', async () => {
  const ctx = await loadDocxExportHarness();
  const { makeDocx } = ctx.JournalierDocx;

  // Génération à partir d’une liste de lignes textuelles
  const lines = [
    'PLAN INDIVIDUEL D’APPRENTISSAGE',
    'Élève : Élève Alpha',
    'Classe : 4P',
    'Continuité avec le PIA précédent',
    '• Observation initiale satisfaisante.'
  ];

  const zipBytes = makeDocx(lines);
  assert.ok(zipBytes instanceof ctx.Uint8Array, 'Le résultat doit être un Uint8Array');
  assert.ok(zipBytes.length > 500, 'L’archive doit contenir plusieurs fichiers XML compressés');

  // Vérification de la signature ZIP (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4B);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);
});
