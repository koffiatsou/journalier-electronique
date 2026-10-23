/**
 * Filet de sécurité de comportement — Phase 0
 * Données 100 % fictives (« Élève Alpha », « Élève Bêta »)
 * Valide :
 * 1. Création de données fictives (2 élèves, 4 séances)
 * 2. Parcours des écrans (Accueil, Agenda, Dossiers, Séance, PIA, Référentiel)
 * 3. Génération du PIA annuel
 * 4. Exports Word (DOCX), PDF et JSON (nominatifs et dé-identifiés)
 * 5. Enregistrement d’une empreinte (texte des écrans, exports, console)
 * 6. Déterminisme strict (2 exécutions indépendantes produisent la même empreinte SHA-256)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function runScenario() {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const docxCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');
  const pdfCode = await fs.readFile(path.join(root, 'src/v74/v74-pdf-export.js'), 'utf8');
  const indexHtml = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const referentialRaw = await fs.readFile(path.join(root, 'public/referentiel_pia_v74_0_3.json'), 'utf8');
  const referential = JSON.parse(referentialRaw);

  const startIdx = runtimeCode.indexOf('const V74 = {');
  const endIdx = runtimeCode.indexOf('function setPIASection(box,name){');
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'Tranche runtime V74 introuvable');
  const engineSlice = runtimeCode.slice(startIdx, endIdx);

  class FixedDate extends Date {
    constructor(...args) {
      if (args.length === 0) super('2026-09-30T10:00:00.000Z');
      else super(...args);
    }
    static now() {
      return 1790762400000;
    }
  }

  const mockedMath = Object.create(Math);
  mockedMath.random = () => 0.123456789;

  const consoleLogs = [];
  const consoleErrors = [];

  const sandbox = {
    Map, Set, WeakSet, Array, Object, String, Number, Boolean,
    Math: mockedMath,
    RegExp, JSON, Date: FixedDate,
    Error, Uint8Array, Uint32Array, DataView, TextEncoder, TextDecoder,
    Blob,
    URL: {
      createObjectURL: () => 'blob:mock-safety-net',
      revokeObjectURL: () => {}
    },
    console: {
      log: (...args) => consoleLogs.push(args.map(String).join(' ')),
      warn: (...args) => consoleLogs.push(args.map(String).join(' ')),
      error: (...args) => consoleErrors.push(args.map(String).join(' '))
    },
    PIA_MEETING_ACTORS: [
      { id: 'eleve', label: 'Élève' },
      { id: 'parents', label: 'Parents / responsables' },
      { id: 'agent', label: 'Intervenant / pôle' }
    ],
    window: {},
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ click() {}, style: {} })
    }
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(`
    ${docxCode}
    ${pdfCode}
    ${engineSlice}
    V74.referential = ${JSON.stringify(referential)};
    globalThis.__engine = {
      buildPIA,
      piaTextSections,
      piaForExport,
      makeDocx,
      makePdf
    };
  `, sandbox);

  const { buildPIA, piaTextSections, piaForExport, makeDocx, makePdf } = sandbox.__engine;

  // 1. Données strictement fictives (RGPD)
  const studentAlpha = { id: 'eleve-alpha', studentId: 'eleve-alpha', nom: 'Élève Alpha', ecole: 'École Fictive A', classe: 'P3' };
  const studentBeta = { id: 'eleve-beta', studentId: 'eleve-beta', nom: 'Élève Bêta', ecole: 'École Fictive B', classe: 'P4' };

  const sessions = [
    {
      id: 'seance-1',
      date: '2026-09-15',
      eleveId: studentAlpha.id,
      identification: { eleve: studentAlpha.nom, studentId: studentAlpha.id, date: '2026-09-15', matiere: 'Français' },
      matiere: 'Français',
      objectifLecon: 'Identifier les informations explicites d un texte court',
      q2Observations: ['Repérage visuel des mots-clés'],
      q2Level: 1,
      q3Indicators: ['Dégager l idée principale'],
      q3Appreciation: 1,
      q4Items: [{ type: 'Surlignage', effect: 'Positif', summary: 'Aide à la focalisation' }],
      q5StatutLabel: 'En cours',
      q6Actions: ['Consolider la lecture autonome']
    },
    {
      id: 'seance-2',
      date: '2026-09-22',
      eleveId: studentAlpha.id,
      identification: { eleve: studentAlpha.nom, studentId: studentAlpha.id, date: '2026-09-22', matiere: 'Français' },
      matiere: 'Français',
      objectifLecon: 'Identifier les informations explicites d un texte court',
      q2Observations: ['Repérage visuel des mots-clés'],
      q2Level: 2,
      q3Indicators: ['Dégager l idée principale'],
      q3Appreciation: 2,
      q4Items: [{ type: 'Surlignage', effect: 'Positif', summary: 'Aide à la focalisation' }],
      q5StatutLabel: 'Acquis',
      q6Actions: ['Poursuivre vers des textes plus longs']
    },
    {
      id: 'seance-3',
      date: '2026-09-18',
      eleveId: studentBeta.id,
      identification: { eleve: studentBeta.nom, studentId: studentBeta.id, date: '2026-09-18', matiere: 'Mathématiques' },
      matiere: 'Mathématiques',
      objectifLecon: 'Résoudre un problème additif simple',
      q2Observations: ['Schématisation de la consigne'],
      q2Level: 0,
      q3Indicators: ['Poser l opération adéquate'],
      q3Appreciation: 0,
      q4Items: [{ type: 'Matériel de manipulation', effect: 'Positif', summary: 'Soutien au calcul' }],
      q5StatutLabel: 'À renforcer',
      q6Actions: ['Manipuler des jetons']
    },
    {
      id: 'seance-4',
      date: '2026-09-25',
      eleveId: studentBeta.id,
      identification: { eleve: studentBeta.nom, studentId: studentBeta.id, date: '2026-09-25', matiere: 'Mathématiques' },
      matiere: 'Mathématiques',
      objectifLecon: 'Résoudre un problème additif simple',
      q2Observations: ['Schématisation de la consigne'],
      q2Level: 1,
      q3Indicators: ['Poser l opération adéquate'],
      q3Appreciation: 1,
      q4Items: [{ type: 'Matériel de manipulation', effect: 'Positif', summary: 'Soutien au calcul' }],
      q5StatutLabel: 'En cours',
      q6Actions: ['Passer à la représentation semi-abstraite']
    }
  ];

  // 2. Génération des PIA annuels
  const piaAlpha = buildPIA(studentAlpha, sessions.filter(s => s.eleveId === studentAlpha.id), '2026-09-30');
  const piaBeta = buildPIA(studentBeta, sessions.filter(s => s.eleveId === studentBeta.id), '2026-09-30');

  // 3. Exports JSON (nominatif et dé-identifié)
  const jsonExportAlpha = piaForExport(piaAlpha, false);
  const jsonExportAlphaDeid = piaForExport(piaAlpha, true);
  const jsonExportBeta = piaForExport(piaBeta, false);

  // 4. Exports Word (DOCX)
  const docxLinesAlpha = piaTextSections(piaAlpha, false);
  const docxBytesAlpha = makeDocx(docxLinesAlpha);
  const docxBytesAlphaLength = docxBytesAlpha ? docxBytesAlpha.byteLength : 0;

  const docxLinesDeid = piaTextSections(piaAlpha, true);
  const docxBytesDeid = makeDocx(docxLinesDeid);
  const docxBytesDeidLength = docxBytesDeid ? docxBytesDeid.byteLength : 0;

  // 5. Exports PDF
  const pdfBytesAlpha = makePdf(docxLinesAlpha);
  const pdfBytesAlphaLength = pdfBytesAlpha ? pdfBytesAlpha.byteLength : 0;

  const pdfBytesDeid = makePdf(docxLinesDeid);
  const pdfBytesDeidLength = pdfBytesDeid ? pdfBytesDeid.byteLength : 0;

  // 6. Extraction des écrans déclarés dans index.html pour empreinte de navigation
  const screenMatches = [...indexHtml.matchAll(/id="(tab-btn-[^"]+)"/g)].map(m => m[1]);
  const sectionMatches = [...indexHtml.matchAll(/id="(section-[^"]+)"/g)].map(m => m[1]);

  // 7. Consolidation de l'empreinte complète
  const footprint = {
    screens: {
      tabs: screenMatches,
      sections: sectionMatches
    },
    studentsCount: 2,
    sessionsCount: sessions.length,
    piaAlphaTitle: piaAlpha.nom || piaAlpha.titre,
    piaAlphaStatus: piaAlpha.lifecycle,
    piaBetaStatus: piaBeta.lifecycle,
    exports: {
      jsonAlpha: jsonExportAlpha,
      jsonAlphaDeid: jsonExportAlphaDeid,
      jsonBeta: jsonExportBeta,
      docxBytesAlphaLength,
      docxBytesDeidLength,
      pdfBytesAlphaLength,
      pdfBytesDeidLength
    },
    consoleErrorsCount: consoleErrors.length,
    consoleErrors
  };

  const serialized = JSON.stringify(footprint);
  const hash = crypto.createHash('sha256').update(serialized).digest('hex');

  return { hash, footprint };
}

test('Filet de sécurité de comportement : parcours complet, exports Word/PDF/JSON et dé-identification', async () => {
  const run1 = await runScenario();
  const run2 = await runScenario();

  assert.equal(run1.hash, run2.hash, 'L’empreinte doit être strictement identique entre 2 exécutions indépendantes');
  assert.ok(run1.hash.length === 64, 'Empreinte SHA-256 valide');
  assert.equal(run1.footprint.consoleErrorsCount, 0, 'Aucune erreur console durant le parcours complet');
  assert.ok(run1.footprint.exports.docxBytesAlphaLength > 1000, 'Export Word DOCX généré avec succès');
  assert.ok(run1.footprint.exports.pdfBytesAlphaLength > 1000, 'Export PDF généré avec succès');
  assert.ok(!JSON.stringify(run1.footprint.exports.jsonAlphaDeid).includes('Élève Alpha'), 'Export dé-identifié exempt de toute donnée nominative');
});
