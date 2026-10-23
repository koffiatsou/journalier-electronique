/**
 * Tests d'acceptation et d'intégrité du Lot 4A : Remplissage des PV1, PV2 et Tableaux d'aménagements (T5/T8)
 * Exécute le vrai moteur sur le vrai modèle officiel PIA.
 * Données de test manifestement fictives.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadHarness() {
  const docxPvCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-pia-pv.js'), 'utf8');
  const docxExportCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const templateBytes = await fs.readFile(path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx'));

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
    Promise,
    Uint8Array,
    Uint32Array,
    DataView,
    ArrayBuffer,
    TextEncoder,
    TextDecoder,
    Blob,
    Response,
    DecompressionStream,
    document: {
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, textContent: '' }),
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null
    },
    atob: typeof atob === 'function' ? atob : undefined,
    btoa: typeof btoa === 'function' ? btoa : undefined,
    Buffer: typeof Buffer !== 'undefined' ? Buffer : undefined,
    window: {},
    process: { cwd: () => root, versions: { node: '22.0.0' } },
    fs,
    __piaOfficialTemplateBuffer: templateBytes
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(docxPvCode, context);
  vm.runInContext(docxExportCode, context);
  vm.runInContext(runtimeCode, context);

  return { context, templateBytes };
}

function extractDocXml(entries) {
  return new TextDecoder('utf-8').decode(entries['word/document.xml']);
}

function parseTables(docXml) {
  const tblRegex = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g;
  const tables = [];
  let m;
  while ((m = tblRegex.exec(docXml))) {
    tables.push(m[0]);
  }
  return tables;
}

function parseRows(tblXml) {
  const trRegex = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
  const rows = [];
  let m;
  while ((m = trRegex.exec(tblXml))) {
    rows.push(m[0]);
  }
  return rows;
}

function parseCells(trXml) {
  const tcRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  const cells = [];
  let m;
  while ((m = tcRegex.exec(trXml))) {
    cells.push(m[0]);
  }
  return cells;
}

function cellText(cellXml) {
  const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const parts = [];
  let m;
  while ((m = tRegex.exec(cellXml))) {
    parts.push(m[1]);
  }
  return parts.join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

test('P1 — PV1 : date en jj/mm/aaaa dans « Date : », axe, objectifs, ressources sur la ligne qui suit chaque libellé', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const mockPia = {
    id: 'pia-p1',
    schoolYear: '2025-2026',
    moment: 'DECEMBRE',
    eleve: 'Lucas Fictif',
    meeting1: {
      date: '2025-10-14',
      axeDifficulte: 'Axe spécifique mathématiques & logique',
      objectivesValidated: ['Objectif calcul posé', 'Objectif repérage géométrique'],
      ressourcesMoyens: 'Fiches plastifiées et repères couleur'
    }
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const docXml = extractDocXml(entries);

  // Date au format jj/mm/aaaa
  assert.ok(docXml.includes('14/10/2025'), 'La date de PV1 doit être au format jj/mm/aaaa');
  assert.ok(!docXml.includes('2025-10-14'), 'La date aaaa-mm-jj ne doit pas apparaître dans Word');

  const tables = parseTables(docXml);
  const t4 = tables[3];
  const rows = parseRows(t4);

  // L1 : Axe
  assert.ok(cellText(rows[1]).includes('Axe spécifique mathématiques & logique'), 'L1 de T4 contient l’axe de difficulté');
  // L3 : Objectifs
  assert.ok(cellText(rows[3]).includes('Objectif calcul posé'), 'L3 de T4 contient les objectifs');
  // L5 : Ressources
  assert.ok(cellText(rows[5]).includes('Fiches plastifiées et repères couleur'), 'L5 de T4 contient les ressources et moyens');

  // Chaque valeur insérée une seule fois
  const countOccurrences = (str, sub) => (str.match(new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  assert.equal(countOccurrences(docXml, 'Axe spécifique mathématiques &amp; logique'), 1);
  assert.equal(countOccurrences(docXml, 'Fiches plastifiées et repères couleur'), 1);
});

test('P2 — Présents : 9 personnes = 9 cases ; 11 personnes = 1 ligne de 3 cellules ajoutée, aucun perdu', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  // Cas A : 9 personnes
  const mockPia9 = {
    id: 'pia-p2-9',
    moment: 'DECEMBRE',
    meeting1: {
      personnesPresentes: [
        'Prof Alpha', 'Prof Beta', 'Prof Gamma',
        'Prof Delta', 'Prof Epsilon', 'Prof Zeta',
        'Prof Eta', 'Prof Theta', 'Prof Iota'
      ]
    }
  };
  const docModel9 = v74.buildOfficialPIADocumentModel(mockPia9, false);
  const out9 = await fillOfficialPIADocx(docModel9, templateBytes);
  const entries9 = await unzipEntries(out9.buffer.slice(out9.byteOffset, out9.byteOffset + out9.byteLength));
  const t3_9 = parseTables(extractDocXml(entries9))[2];
  const rows9 = parseRows(t3_9);
  assert.equal(rows9.length, 3, 'T3 avec 9 personnes a exactement 3 lignes');

  // Cas B : 11 personnes
  const mockPia11 = {
    id: 'pia-p2-11',
    moment: 'DECEMBRE',
    meeting1: {
      personnesPresentes: [
        'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'
      ]
    }
  };
  const docModel11 = v74.buildOfficialPIADocumentModel(mockPia11, false);
  const out11 = await fillOfficialPIADocx(docModel11, templateBytes);
  const entries11 = await unzipEntries(out11.buffer.slice(out11.byteOffset, out11.byteOffset + out11.byteLength));
  const t3_11 = parseTables(extractDocXml(entries11))[2];
  const rows11 = parseRows(t3_11);
  assert.equal(rows11.length, 4, 'T3 avec 11 personnes a 4 lignes (1 ligne ajoutée)');

  // Vérifier qu'aucun nom n'est perdu
  const fullT3Text = cellText(t3_11);
  for (let i = 1; i <= 11; i++) {
    assert.ok(fullT3Text.includes(`P${i}`), `La personne P${i} doit être présente dans T3`);
  }
});

test('P3 — Retours : six cases, valeur sous le bon libellé, fusion Direction + École / équipe', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const mockPia = {
    id: 'pia-p3',
    moment: 'DECEMBRE',
    meeting1: {
      feedback: {
        parents: 'Avis favorable des parents',
        direction: 'Accord de principe direction',
        ecole: 'Soutien renforcé en classe',
        eleve: 'Élève motivé',
        pms: 'Bilan psycho-moteur transmis',
        integration: 'Passage 2h/semaine',
        autres: 'Orthophoniste externe OK'
      }
    }
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const t4 = parseTables(extractDocXml(entries))[3];
  const rows = parseRows(t4);

  // L7 : Parents (C0) & Direction+Equipe (C1)
  const l7Cells = parseCells(rows[7]);
  assert.ok(cellText(l7Cells[0]).includes('Avis favorable des parents'), 'Parents en C0');
  assert.ok(cellText(l7Cells[1]).includes('Direction : Accord de principe direction'), 'Direction en C1');
  assert.ok(cellText(l7Cells[1]).includes('École / équipe : Soutien renforcé en classe'), 'École fusionnée en C1');

  // L9 : Élève (C0) & PMS (C1)
  const l9Cells = parseCells(rows[9]);
  assert.ok(cellText(l9Cells[0]).includes('Élève motivé'), 'Élève en C0');
  assert.ok(cellText(l9Cells[1]).includes('Bilan psycho-moteur transmis'), 'PMS en C1');

  // L11 : Intégration (C0) & Autres (C1)
  const l11Cells = parseCells(rows[11]);
  assert.ok(cellText(l11Cells[0]).includes('Passage 2h/semaine'), 'Intégration en C0');
  assert.ok(cellText(l11Cells[1]).includes('Orthophoniste externe OK'), 'Autres intervenants en C1');
});

test('P4 — Aménagements : P seul, O+M, M seul avec X centré dans cellules 1, 2, 3 et description en cellule 4', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const mockPia = {
    id: 'pia-p4',
    moment: 'DECEMBRE',
    amenagements: [
      { type: 'P', description: 'Agrandissement A3' },
      { p: false, o: true, m: true, description: 'Temps majoré et casque anti-bruit' },
      { type: 'M', description: 'Pupitre incliné' }
    ]
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const t5 = parseTables(extractDocXml(entries))[4];
  const rows = parseRows(t5);

  // Aménagement 1 (Row 2) : P seul
  const cR2 = parseCells(rows[2]);
  assert.ok(cR2[1].includes('<w:jc w:val="center"/>'), 'P doit avoir w:jc center');
  assert.ok(cellText(cR2[1]).includes('X'), 'P doit avoir X');
  assert.ok(!cellText(cR2[2]).includes('X'), 'O ne doit pas avoir X');
  assert.ok(!cellText(cR2[3]).includes('X'), 'M ne doit pas avoir X');
  assert.ok(cellText(cR2[4]).includes('Agrandissement A3'), 'Description en cellule 4');

  // Aménagement 2 (Row 3) : O + M
  const cR3 = parseCells(rows[3]);
  assert.ok(!cellText(cR3[1]).includes('X'), 'P ne doit pas avoir X');
  assert.ok(cellText(cR3[2]).includes('X'), 'O doit avoir X');
  assert.ok(cellText(cR3[3]).includes('X'), 'M doit avoir X');
  assert.ok(cR3[2].includes('<w:jc w:val="center"/>'), 'O doit être centré');
  assert.ok(cR3[3].includes('<w:jc w:val="center"/>'), 'M doit être centré');
  assert.ok(cellText(cR3[4]).includes('Temps majoré et casque anti-bruit'));

  // Aménagement 3 (Row 4) : M seul
  const cR4 = parseCells(rows[4]);
  assert.ok(!cellText(cR4[1]).includes('X'), 'P ne doit pas avoir X');
  assert.ok(!cellText(cR4[2]).includes('X'), 'O ne doit pas avoir X');
  assert.ok(cellText(cR4[3]).includes('X'), 'M doit avoir X');
  assert.ok(cellText(cR4[4]).includes('Pupitre incliné'));
});

test('P5 — 12 aménagements (T5 et T8) : 12 lignes numérotées, même format, en-têtes intactes', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const am12 = [];
  for (let i = 1; i <= 12; i++) {
    am12.push({
      p: i % 2 === 1,
      o: i % 3 === 0,
      m: i % 4 === 0,
      description: `Aménagement test numéro ${i}`
    });
  }

  const mockPia = {
    id: 'pia-p5',
    moment: 'FIN_ANNEE',
    amenagements: am12,
    meeting2: {
      date: '2026-06-20',
      amenagementsRentree: am12
    }
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const tables = parseTables(extractDocXml(entries));

  const t5 = tables[4];
  const t8 = tables[7];

  const rows5 = parseRows(t5);
  const rows8 = parseRows(t8);

  assert.equal(rows5.length, 14, 'T5 doit avoir 2 en-têtes + 12 lignes de données = 14 lignes');
  assert.equal(rows8.length, 14, 'T8 doit avoir 2 en-têtes + 12 lignes de données = 14 lignes');

  // En-têtes intactes
  assert.ok(cellText(rows5[0]).includes('Description/modalité'), 'En-tête 0 T5 intacte');
  assert.ok(cellText(rows5[1]).includes('P'), 'En-tête 1 T5 intacte');
  assert.ok(cellText(rows8[0]).includes('Description/modalité'), 'En-tête 0 T8 intacte');

  // Lignes 11 et 12 (index 12 et 13)
  assert.ok(cellText(parseCells(rows5[12])[0]).includes('11'), 'Ligne 11 numérotée dans T5');
  assert.ok(cellText(parseCells(rows5[13])[0]).includes('12'), 'Ligne 12 numérotée dans T5');
  assert.ok(cellText(parseCells(rows8[12])[0]).includes('11'), 'Ligne 11 numérotée dans T8');
  assert.ok(cellText(parseCells(rows8[13])[0]).includes('12'), 'Ligne 12 numérotée dans T8');
});

test('P6 — Moments : décembre = PV2 et T8 identiques au modèle ; fin d’année = T5 identique à décembre, T8 et PV2 remplis', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const basePia = {
    id: 'pia-p6',
    schoolYear: '2025-2026',
    meeting1: {
      date: '2025-10-10',
      axeDifficulte: 'Axe Décembre',
      objectivesCriteres: 'Objectifs Décembre',
      ressourcesMoyens: 'Ressources Décembre',
      personnesPresentes: ['P1 Décembre', 'P2 Décembre']
    },
    amenagements: [{ type: 'P', description: 'Aménagement Décembre' }],
    meeting2: {
      date: '2026-06-15',
      objectifsEvaluation: 'Évaluation Fin Année',
      amenagementsRentree: [{ type: 'M', description: 'Aménagement Rentrée Suivante' }]
    }
  };

  // 1. Export DECEMBRE
  const docModelDec = v74.buildOfficialPIADocumentModel({ ...basePia, moment: 'DECEMBRE' }, false);
  const outDec = await fillOfficialPIADocx(docModelDec, templateBytes);
  const entriesDec = await unzipEntries(outDec.buffer.slice(outDec.byteOffset, outDec.byteOffset + outDec.byteLength));
  const docXmlDec = extractDocXml(entriesDec);
  const tablesDec = parseTables(docXmlDec);

  // PV2 et T8 ne contiennent pas les données de fin d'année en décembre
  assert.ok(!cellText(tablesDec[6]).includes('Évaluation Fin Année'), 'PV2 non rempli en décembre');
  assert.ok(!cellText(tablesDec[7]).includes('Aménagement Rentrée Suivante'), 'T8 non rempli en décembre');
  assert.ok(!docXmlDec.includes('15/06/2026'), 'Date PV2 non insérée en décembre');

  // 2. Export FIN_ANNEE
  const docModelFin = v74.buildOfficialPIADocumentModel({ ...basePia, moment: 'FIN_ANNEE' }, false);
  const outFin = await fillOfficialPIADocx(docModelFin, templateBytes);
  const entriesFin = await unzipEntries(outFin.buffer.slice(outFin.byteOffset, outFin.byteOffset + outFin.byteLength));
  const docXmlFin = extractDocXml(entriesFin);
  const tablesFin = parseTables(docXmlFin);

  // La version de fin d'année contient AUSSI le PV1 (date, axe, objectifs, ressources, présents) et le T5, identiques à décembre
  assert.equal(cellText(tablesFin[2]), cellText(tablesDec[2]), 'T3 (présents PV1) identique en décembre et fin d’année');
  assert.equal(cellText(tablesFin[3]), cellText(tablesDec[3]), 'T4 (PV1 : axe, objectifs, ressources) identique en décembre et fin d’année');
  assert.equal(cellText(tablesFin[4]), cellText(tablesDec[4]), 'T5 identique en décembre et fin d’année');
  assert.ok(docXmlFin.includes('10/10/2025'), 'Date PV1 présente en fin d’année');
  assert.ok(cellText(tablesFin[2]).includes('P1 Décembre'), 'Présents PV1 présents dans T3 en fin d’année');
  assert.ok(cellText(tablesFin[3]).includes('Axe Décembre'), 'Axe PV1 présent dans T4 en fin d’année');
  assert.ok(cellText(tablesFin[3]).includes('Objectifs Décembre'), 'Objectifs PV1 présents dans T4 en fin d’année');
  assert.ok(cellText(tablesFin[3]).includes('Ressources Décembre'), 'Ressources PV1 présents dans T4 en fin d’année');

  // PV2 et T8 remplis en fin d'année
  assert.ok(cellText(tablesFin[6]).includes('Évaluation Fin Année'), 'PV2 rempli en fin d’année');
  assert.ok(cellText(tablesFin[7]).includes('Aménagement Rentrée Suivante'), 'T8 rempli en fin d’année');
  assert.ok(docXmlFin.includes('15/06/2026'), 'Date PV2 présente en fin d’année');
});

test('P7 — Polices et structure : taille conservée (28 dans PV, 32 dans T5/T8), paragraphes vides restants conservés, multi-lignes', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const mockPia = {
    id: 'pia-p7',
    moment: 'DECEMBRE',
    meeting1: {
      axeDifficulte: 'Ligne 1\nLigne 2\nLigne 3'
    },
    amenagements: [
      { type: 'P', description: 'Aménagement multi-lignes\nDeuxième ligne description' }
    ]
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const docXml = extractDocXml(entries);

  // Vérifier taille de police 28 dans PV1 (Row 3, Objectifs)
  const t4 = parseTables(docXml)[3];
  const l1Cell = parseCells(parseRows(t4)[1])[0];
  assert.ok(l1Cell.includes('Ligne 1') && l1Cell.includes('Ligne 2') && l1Cell.includes('Ligne 3'), 'Chaque ligne multi-ligne est présente');

  const l3Cell = parseCells(parseRows(t4)[3])[0];
  assert.ok(l3Cell.includes('<w:sz w:val="28"/>'), 'Taille sz 28 conservée dans T4 (L3)');

  // Vérifier taille de police 32 dans T5
  const t5 = parseTables(docXml)[4];
  const descCell = parseCells(parseRows(t5)[2])[4];
  assert.ok(descCell.includes('<w:sz w:val="32"/>'), 'Taille sz 32 conservée dans T5');
});

test('P8 — Caractères spéciaux (&, <, >, guillemets, apostrophes, accents) dans tous les nouveaux champs', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const specialText = 'Élève & Pôle > "Priorité" < \'Spécial\' & Co';

  const mockPia = {
    id: 'pia-p8',
    moment: 'FIN_ANNEE',
    meeting1: {
      date: '2025-11-20',
      axeDifficulte: specialText,
      objectifsValidated: [specialText],
      ressourcesMoyens: specialText,
      feedback: {
        parents: specialText,
        direction: specialText,
        ecole: specialText,
        eleve: specialText,
        pms: specialText,
        integration: specialText,
        autres: specialText
      }
    },
    amenagements: [{ type: 'P', description: specialText }],
    meeting2: {
      date: '2026-06-25',
      objectifsEvaluation: specialText,
      amenagementsRentree: [{ type: 'M', description: specialText }]
    }
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
  const docXml = extractDocXml(entries);

  // Vérifier échappement strict : aucun < non balisé, aucun & non échappé
  assert.ok(docXml.includes('&amp;'), 'Les & doivent être échappés en &amp;');
  assert.ok(docXml.includes('&lt;'), 'Les < doivent être échappés en &lt;');
  assert.ok(docXml.includes('&gt;'), 'Les > doivent être échappés en &gt;');
  assert.ok(docXml.includes('&quot;'), 'Les guillemets doivent être échappés');
  assert.ok(docXml.includes('&apos;'), 'Les apostrophes doivent être échappées');
  assert.ok(docXml.includes('Élève'), 'Les accents doivent être intacts');
});

test('P9 — Archive : seules 4 parties diffèrent du modèle, XML bien formé, nombre de tableaux préservé', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const origEntries = await unzipEntries(templateBytes);
  const mockPia = {
    id: 'pia-p9',
    moment: 'FIN_ANNEE',
    meeting1: { date: '2025-10-01' },
    amenagements: [{ type: 'P', description: 'Test P9' }]
  };

  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
  const genEntries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));

  const allowedDiffs = new Set([
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'docProps/core.xml'
  ]);

  for (const name of Object.keys(origEntries)) {
    assert.ok(genEntries[name], `Entrée ${name} doit exister dans l’archive`);
    const isIdentical = Buffer.compare(Buffer.from(origEntries[name]), Buffer.from(genEntries[name])) === 0;
    if (!allowedDiffs.has(name)) {
      assert.ok(isIdentical, `L’entrée ${name} doit être identique au modèle`);
    }
  }

  // Nombre de tableaux = 8
  const docXml = extractDocXml(genEntries);
  const tables = parseTables(docXml);
  assert.equal(tables.length, 8, 'Le document généré doit comporter exactement 8 tableaux');
});

test('P10 — Ordre du schéma Word pPr : aucun w:jc ne doit apparaître après un w:rPr (décembre et fin d’année)', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  const mockPia = {
    id: 'pia-p10-order',
    schoolYear: '2025-2026',
    meeting1: {
      date: '2025-10-15',
      axeDifficulte: 'Axe Test',
      personnesPresentes: ['P1', 'P2']
    },
    amenagements: [
      { type: 'P', description: 'Aménagement P' },
      { p: false, o: true, m: true, description: 'Aménagement O+M' },
      { type: 'M', description: 'Aménagement M' }
    ],
    meeting2: {
      date: '2026-06-20',
      objectifsEvaluation: 'Évaluation Fin',
      amenagementsRentree: [
        { type: 'P', description: 'Rentree P' },
        { type: 'O', description: 'Rentree O' }
      ]
    }
  };

  for (const moment of ['DECEMBRE', 'FIN_ANNEE']) {
    const docModel = v74.buildOfficialPIADocumentModel({ ...mockPia, moment }, false);
    const outDocx = await fillOfficialPIADocx(docModel, templateBytes);
    const entries = await unzipEntries(outDocx.buffer.slice(outDocx.byteOffset, outDocx.byteOffset + outDocx.byteLength));
    const docXml = extractDocXml(entries);

    const pPrRegex = /<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/g;
    let m;
    let violationCount = 0;
    const violations = [];
    while ((m = pPrRegex.exec(docXml))) {
      const pPr = m[0];
      if (/<w:rPr[\s\S]*?<w:jc/.test(pPr)) {
        violationCount++;
        violations.push(pPr);
      }
    }

    assert.equal(
      violationCount,
      0,
      `[${moment}] ${violationCount} balise(s) w:pPr contiennent w:jc APRÈS w:rPr (invalide selon le schéma Word) : ${violations[0] || ''}`
    );
  }
});

