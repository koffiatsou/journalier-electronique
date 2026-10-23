import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadV74Lot3Harness() {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const docxCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');
  const pdfCode = await fs.readFile(path.join(root, 'src/v74/v74-pdf-export.js'), 'utf8');
  const msCode = await fs.readFile(path.join(root, 'src/app/microsoft-core.js'), 'utf8');

  const startIdx = runtimeCode.indexOf('const V74 = {');
  const endIdx = runtimeCode.indexOf('function setPIASection(box,name){');
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'Could not locate V74 runtime slice');

  const runtimeSlice = runtimeCode.slice(startIdx, endIdx);

  const msStart = msCode.indexOf('const JOURNALIER_JSON_LIMITS=');
  const msEnd = msCode.indexOf('function validateRemoteStudent(');
  const msSlice = msStart >= 0 && msEnd > msStart ? msCode.slice(msStart, msEnd) : '';

  const formFields = new Map();
  const context = {
    console,
    Date,
    Math,
    Set,
    Map,
    WeakSet,
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
    Blob,
    URL: {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {}
    },
    __formFields: formFields,
    document: {
      querySelector: (sel) => {
        const m = sel.match(/\[data-v74-prop-formulation="(\d+)"\]/);
        if (m && formFields.has(Number(m[1]))) {
          return { value: formFields.get(Number(m[1])) };
        }
        return null;
      },
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ click() {}, style: {} })
    },
    window: {}
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(
    `${docxCode}\n${pdfCode}\n${runtimeSlice}\n${msSlice}\n` +
      `globalThis.__lot3 = {\n` +
      `  V74, buildPIA, normalizePIALifecycle, evaluateMeeting2, decidePIAProposal,\n` +
      `  syncValidatedObjectivesFromProposals, activatePIA, getPIADecisionCounts,\n` +
      `  buildPIAActivationConfirmationMessage, piaStatusLabel, piaTextSections,\n` +
      `  piaForExport, makeDocx, makePdf, wrapPdfTextLine, unzipEntries,\n` +
      `  extractPdfStrings, validateStrictPIA\n` +
      `};`,
    context
  );

  return context;
}

function makeStudent() {
  return {
    id: 'stu-lot3',
    studentId: 'stu-lot3',
    nom: 'Camille Dupont',
    classe: '4P',
    ecole: 'École des Tilleuls',
    pia: 'Structurer la résolution de problèmes'
  };
}

function makeDecemberSessions() {
  return [
    {
      id: 'dec-1',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2025-10-08', matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Comprendre la consigne' },
      q2: {
        observations: [
          { observation: 'Identifie les informations utiles dans la consigne', niveau: 0 },
          { observation: 'Maintient son attention jusqu’au terme de la tâche', niveau: 1 }
        ],
        precision: 'Fragilité lors des consignes écrites longues.'
      },
      q3: {
        indicateurs: [{ id: 'ind-1', texte: 'Repérer les données numériques utiles', appreciation: 0 }],
        repereWBE: { hit: true, signature: 'Math 4P — Résolution de problèmes' }
      },
      q4: {
        types: ['Reformulation de la consigne', 'Support visuel séquentiel'],
        effets: { 'Reformulation de la consigne': 2, 'Support visuel séquentiel': 1 },
        precision: 'Segmentation en 3 étapes.'
      },
      q5: { statut: 'observed', precision: 'Observé sur un second exercice.' },
      q6: {
        actions: ['Poursuivre l’adaptation mise en place'],
        modalite: 'Individuel',
        objectif: 'Consolider le repérage des étapes',
        collaborations: ['Enseignant titulaire']
      }
    },
    {
      id: 'dec-2',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2025-10-16', matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Comprendre la consigne' },
      q2: {
        observations: [
          { observation: 'Identifie les informations utiles dans la consigne', niveau: 0 },
          { observation: 'Maintient son attention jusqu’au terme de la tâche', niveau: 2 }
        ]
      },
      q3: {
        indicateurs: [{ id: 'ind-1', texte: 'Repérer les données numériques utiles', appreciation: 1 }]
      },
      q4: {
        types: ['Reformulation de la consigne'],
        effets: { 'Reformulation de la consigne': 2 }
      },
      q5: { statut: 'observed' },
      q6: { actions: ['Maintenir le référentiel visuel'] }
    },
    {
      id: 'dec-3',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2025-11-05', matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Comprendre la consigne' },
      q2: {
        observations: [
          { observation: 'Identifie les informations utiles dans la consigne', niveau: 0 }
        ]
      },
      q3: {
        indicateurs: [{ id: 'ind-1', texte: 'Repérer les données numériques utiles', appreciation: 1 }]
      },
      q4: {
        types: ['Reformulation de la consigne'],
        effets: { 'Reformulation de la consigne': 2 }
      },
      q5: { statut: 'later' },
      q6: { actions: ['Vérifier en situation autonome'] }
    }
  ];
}

function makeSpringSessions() {
  return [
    ...makeDecemberSessions(),
    {
      id: 'spr-1',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2026-02-12', matiere: 'Français' },
      objectif: { objectifLecon: 'Organiser son matériel et son espace de travail' },
      q2: {
        observations: [
          { observation: 'Identifie les informations utiles dans la consigne', niveau: 1 },
          { observation: 'Organise son matériel et son espace de travail', niveau: 0 }
        ]
      },
      q3: {
        indicateurs: [{ id: 'ind-2', texte: 'Préparer les outils requis avant la tâche', appreciation: 0 }]
      },
      q4: {
        types: ['Routine de démarrage par pictogrammes'],
        effets: { 'Routine de démarrage par pictogrammes': 2 }
      },
      q5: { statut: 'observed' },
      q6: { actions: ['Observer la routine de démarrage'] }
    },
    {
      id: 'spr-2',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2026-03-19', matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Organiser son matériel et son espace de travail' },
      q2: {
        observations: [
          { observation: 'Organise son matériel et son espace de travail', niveau: 0 }
        ]
      },
      q3: {
        indicateurs: [{ id: 'ind-2', texte: 'Préparer les outils requis avant la tâche', appreciation: 0 }]
      },
      q4: {
        types: ['Routine de démarrage par pictogrammes'],
        effets: { 'Routine de démarrage par pictogrammes': 2 }
      },
      q5: { statut: 'observed' },
      q6: { actions: ['Maintenir la check-list de matériel'] }
    },
    {
      id: 'spr-3',
      type: 'SEANCE',
      identification: { eleve: 'Camille Dupont', studentId: 'stu-lot3', date: '2026-04-23', matiere: 'Sciences' },
      objectif: { objectifLecon: 'Organiser son matériel et son espace de travail' },
      q2: {
        observations: [
          { observation: 'Organise son matériel et son espace de travail', niveau: 0 }
        ]
      },
      q3: {
        indicateurs: [{ id: 'ind-2', texte: 'Préparer les outils requis avant la tâche', appreciation: 1 }]
      },
      q4: {
        types: ['Routine de démarrage par pictogrammes'],
        effets: { 'Routine de démarrage par pictogrammes': 2 }
      },
      q5: { statut: 'observed' },
      q6: { actions: ['Consolider l’autonomie matérielle'] }
    }
  ];
}

test('LOT PIA-3A — Cycle complet de réévaluation : EN_VIGUEUR -> EN_REEVALUATION -> décisions -> EN_VIGUEUR -> FINALISE sans perte historique', async () => {
  const ctx = await loadV74Lot3Harness();
  const {
    buildPIA,
    normalizePIALifecycle,
    evaluateMeeting2,
    decidePIAProposal,
    activatePIA,
    buildPIAActivationConfirmationMessage,
    piaStatusLabel,
    validateStrictPIA
  } = ctx.__lot3;

  const student = makeStudent();
  student.importedContinuity = {
    present: true,
    role: 'SOURCE_DE_CONTINUITE',
    format: 'docx',
    fileName: '',
    importedAt: '2025-09-10T08:00:00.000Z',
    extracted: {
      objectives: ['Objectif de continuité N-1 : utiliser le référentiel de lecture'],
      resources: ['Bonne participation orale'],
      difficulties: ['Fatigabilité en fin de matinée'],
      adaptations: ['Tiers-temps (O)']
    }
  };

  // 1. Construction initiale en décembre
  const decPia = buildPIA(student, makeDecemberSessions(), '2025-12-10', {
    sourceContinuity: student.importedContinuity,
    meeting1: {
      objectivesPrevious: [{ formulation: 'Objectif de continuité N-1 : utiliser le référentiel de lecture', status: 'EXISTANT_A_REEVALUER', source: 'PIA_PRECEDENT' }]
    }
  });
  assert.equal(decPia.lifecycle, 'EN_CONSTRUCTION');
  assert.ok(decPia.propositions.length >= 1, 'Au moins une proposition générée en décembre');

  // Valider la proposition de décembre et mettre en vigueur
  decidePIAProposal(decPia, 0, 'VALIDEE');
  decPia.meeting1.date = '2025-12-12';
  decPia.meeting1.participants = { eleve: true, parents: true, ecole: true, integration: true };
  decPia.meeting1.decisions = 'Mise en place du séquençage visuel des consignes.';
  decPia.meeting1.notes = 'Rencontre constructive avec les parents.';

  assert.equal(activatePIA(decPia), true);
  assert.equal(decPia.lifecycle, 'EN_VIGUEUR');
  assert.equal(decPia.meeting1.status, 'VALIDÉE');
  const decValidatedAt = '2025-12-12T14:30:00.000Z';
  decPia.meeting1.validatedAt = decValidatedAt;
  const decProposalDecidedAt = '2025-12-12T14:25:00.000Z';
  decPia.propositions[0].decidedAt = decProposalDecidedAt;

  // 2. Passage en EN_REEVALUATION au printemps avec nouvelles séances
  const reviewPia = buildPIA(student, makeSpringSessions(), '2026-05-15', decPia);
  reviewPia.meeting2 = {
    ...reviewPia.meeting2,
    status: 'EN_REEVALUATION',
    date: '2026-05-20',
    context: 'Bilan de fin d’année scolaire',
    participants: { eleve: true, parents: true, ecole: true, pms: true, integration: true },
    decisions: 'Maintien de l’appui sur la consigne et ajout d’une routine matérielle.',
    evaluation: evaluateMeeting2(reviewPia, decPia),
    objectivesToContinue: reviewPia.meeting1.objectivesValidated || [],
    perspectives: ['Poursuivre le référentiel en 5P']
  };
  reviewPia.lifecycle = 'EN_REEVALUATION';

  // Point 1 & 8 : normalizePIALifecycle ne doit JAMAIS écraser EN_REEVALUATION même si meeting1.status === 'VALIDÉE'
  assert.equal(normalizePIALifecycle(reviewPia), 'EN_REEVALUATION', 'normalizePIALifecycle doit conserver EN_REEVALUATION');
  assert.equal(piaStatusLabel(reviewPia), 'Réévaluation en cours');

  // Si buildPIA est rappelé sur un PIA déjà EN_REEVALUATION, son statut reste EN_REEVALUATION
  const rebuiltReview = buildPIA(student, makeSpringSessions(), '2026-05-18', reviewPia);
  assert.equal(rebuiltReview.lifecycle, 'EN_REEVALUATION', 'Un PIA en réévaluation reconstruit doit rester EN_REEVALUATION');

  // Vérification de la préservation intégrale des données historiques de meeting1 et sourceContinuity
  assert.equal(rebuiltReview.meeting1.validatedAt, decValidatedAt, 'meeting1.validatedAt de décembre doit être préservé');
  assert.equal(rebuiltReview.meeting1.decisions, 'Mise en place du séquençage visuel des consignes.');
  assert.equal(rebuiltReview.meeting1.notes, 'Rencontre constructive avec les parents.');
  assert.equal(rebuiltReview.sourceContinuity?.present, true, 'La continuité N-1 doit rester présente');
  assert.equal(rebuiltReview.meeting1.objectivesPrevious.length, 1, 'Les objectifs précédents N-1 doivent être conservés');

  // Vérification de evaluateMeeting2 : uniquement les séances postérieures à la validation de décembre
  assert.ok(rebuiltReview.meeting2.evaluation.length >= 1, 'Le bilan meeting2 évalue les objectifs validés en réunion 1');
  for (const evalItem of rebuiltReview.meeting2.evaluation) {
    for (const ev of evalItem.evidence || []) {
      assert.ok(ev.date > '2025-12-12', `La preuve post-réunion 1 (${ev.date}) doit être postérieure au 2025-12-12`);
    }
  }

  // Modification d'une note d'évaluation en réunion 2 : un second appel à evaluateMeeting2 la préserve
  rebuiltReview.meeting2.evaluation[0].state = 'ACQUIS_EN_CONTEXTE';
  rebuiltReview.meeting2.evaluation[0].note = 'Acquis avec support visuel en classe.';
  const reEvalAgain = evaluateMeeting2(rebuiltReview, rebuiltReview);
  assert.equal(reEvalAgain[0].state, 'ACQUIS_EN_CONTEXTE', 'L’état d’évaluation meeting2 saisi par le professionnel est préservé');
  assert.equal(reEvalAgain[0].note, 'Acquis avec support visuel en classe.', 'La note d’évaluation meeting2 saisie par le professionnel est préservée');

  // 3. Nouvelles décisions sur les propositions pendant EN_REEVALUATION
  assert.ok(rebuiltReview.propositions.length >= 2, 'Le PIA de printemps comporte l’ancienne proposition validée et au moins une nouvelle proposition');
  const firstProp = rebuiltReview.propositions.find(p => p.decisionStatus === 'VALIDEE');
  assert.ok(firstProp, 'La proposition validée en décembre est conservée');
  assert.equal(firstProp.decidedAt, decProposalDecidedAt, 'Son horodatage decidedAt de décembre est préservé');

  const pendingIndices = rebuiltReview.propositions
    .map((p, idx) => ((p.decisionStatus || 'A_EXAMINER') === 'A_EXAMINER' ? idx : -1))
    .filter(idx => idx >= 0);

  if (pendingIndices.length >= 1) {
    // Valider une nouvelle proposition en réévaluation
    decidePIAProposal(rebuiltReview, pendingIndices[0], 'VALIDEE');
    assert.equal(rebuiltReview.lifecycle, 'EN_REEVALUATION', 'Valider une proposition individuellement ne quitte pas EN_REEVALUATION');
  }

  // Message de confirmation explicite adapté à la réévaluation
  const confirmMsg = buildPIAActivationConfirmationMessage(rebuiltReview);
  assert.ok(confirmMsg.includes('Confirmer la réévaluation et maintenir en vigueur ce PIA annuel ?'));

  // 4. Mise en vigueur explicite depuis EN_REEVALUATION
  const activated = activatePIA(rebuiltReview);
  assert.equal(activated, true);
  assert.equal(rebuiltReview.lifecycle, 'EN_VIGUEUR');
  assert.equal(rebuiltReview.meeting1.status, 'VALIDÉE');
  assert.equal(rebuiltReview.meeting1.validatedAt, decValidatedAt, 'activatePIA ne doit PAS écraser meeting1.validatedAt de décembre');
  assert.equal(rebuiltReview.meeting2.status, 'REEVALUATION_VALIDEE', 'meeting2.status passe à REEVALUATION_VALIDEE');
  assert.ok(rebuiltReview.meeting2.validatedAt, 'meeting2.validatedAt est horodaté');
  assert.equal(
    rebuiltReview.meeting2.objectivesToContinue.length,
    rebuiltReview.meeting1.objectivesValidated.length,
    'objectivesToContinue est synchronisé avec les objectifs validés'
  );

  // 5. Clôture annuelle vers FINALISE
  rebuiltReview.lifecycle = 'FINALISE';
  rebuiltReview.finalizedAt = '2026-06-28T16:00:00.000Z';
  rebuiltReview.meeting2.status = 'FINALISE';
  assert.equal(normalizePIALifecycle(rebuiltReview), 'FINALISE');
  assert.equal(piaStatusLabel(rebuiltReview), 'PIA annuel finalisé');

  // 6. Conformité stricte avec validateStrictPIA (stockage local & OneDrive)
  assert.doesNotThrow(() => validateStrictPIA(rebuiltReview, 'stu-lot3'));
});

test('LOT PIA-3B & 3C — Modèle documentaire professionnel, non-troncature PDF multi-pages, structure DOCX et dé-identification', async () => {
  const ctx = await loadV74Lot3Harness();
  const {
    buildPIA,
    decidePIAProposal,
    activatePIA,
    piaTextSections,
    piaForExport,
    makeDocx,
    makePdf,
    unzipEntries,
    extractPdfStrings
  } = ctx.__lot3;

  const student = makeStudent();
  const pia = buildPIA(student, makeSpringSessions(), '2026-05-15', null);

  // Créer les 3 états sur les propositions pour tester la distinction documentaire
  if (pia.propositions.length >= 2) {
    decidePIAProposal(pia, 0, 'VALIDEE');
    decidePIAProposal(pia, 1, 'REFUSEE');
  } else if (pia.propositions.length === 1) {
    decidePIAProposal(pia, 0, 'VALIDEE');
    pia.propositions.push({
      id: 'prop-refused',
      theme: 'Organisation spatiale',
      themeId: 'organisation-spatiale',
      aspect: 'Lié à l’autonomie',
      state: 'PROPOSITION',
      decisionStatus: 'REFUSEE',
      formulation: 'Proposition écartée lors de la réunion.'
    });
  }
  pia.propositions.push({
    id: 'prop-pending',
    theme: 'Flexibilité mentale',
    themeId: 'flexibilite',
    aspect: 'Cognitif (pédagogique)',
    state: 'PROPOSITION',
    decisionStatus: 'A_EXAMINER',
    formulation: 'Proposition encore en attente d’examen par l’équipe.'
  });

  activatePIA(pia);
  pia.meeting1.date = '2025-12-15';
  pia.meeting1.participants = { eleve: true, parents: true, ecole: true };
  pia.meeting1.feedback = { parents: 'Retour favorable des parents sur le rituel visuel.' };
  pia.meeting2.status = 'REEVALUATION_VALIDEE';
  pia.meeting2.date = '2026-05-20';
  pia.meeting2.evaluation = [
    {
      objectif: pia.meeting1.objectivesValidated[0]?.formulation || 'Objectif 1',
      themeId: 'consigne',
      evidence: [{ sessionId: 'spr-1', date: '2026-02-12', matiere: 'Français' }],
      state: 'A_DISCUSSER',
      note: 'Consolidation observée en groupe restreint.'
    }
  ];
  pia.meeting2.perspectives = ['Maintenir le référentiel visuel en 5P.'];

  // 1. Vérification du modèle documentaire professionnel (piaTextSections)
  const profLines = piaTextSections(pia, false);
  const profText = profLines.join('\n');

  assert.ok(profText.includes('PIA annuel — document professionnel'));
  assert.ok(profText.includes('Camille Dupont · 4P · École des Tilleuls'));
  assert.ok(profText.includes('Objectifs validés :'));
  assert.ok(profText.includes('Propositions d’objectifs encore à examiner (non validées) :'));
  assert.ok(profText.includes('Propositions écartées / non retenues lors de l’examen :'));
  assert.ok(profText.includes('Légende P/O/M : P = Pédagogique · O = Organisationnel · M = Matériel'));
  assert.ok(profText.includes('Bilan d’évaluation des objectifs :'));
  assert.ok(profText.includes('Consolidation observée en groupe restreint.'));
  assert.ok(profText.includes('Perspectives pour la suite :'));
  assert.ok(profText.includes('Maintenir le référentiel visuel en 5P.'));

  // Aucun code interne brut dans le document exporté
  for (const rawCode of ['REUNION_1_DECEMBRE', 'REUNION_2_FIN_ANNEE', 'A_REEVALUER', 'A_VENIR', 'REEVALUATION_VALIDEE', 'A_DISCUSSER']) {
    assert.ok(!profText.includes(rawCode), `Le code technique brut "${rawCode}" ne doit jamais apparaître dans le document exporté`);
  }

  // 2. Vérification de l'export dé-identifié
  const deidLines = piaTextSections(pia, true);
  const deidText = deidLines.join('\n');
  assert.ok(deidText.includes('PIA — modèle dé-identifié'));
  assert.ok(!deidText.includes('Camille Dupont'), 'Le nom de l’élève doit être retiré de l’export dé-identifié');
  assert.ok(!deidText.includes('École des Tilleuls'), 'Le nom de l’école doit être retiré de l’export dé-identifié');
  assert.ok(!deidText.includes('stu-lot3'), 'L’identifiant élève doit être retiré de l’export dé-identifié');
  assert.ok(!deidText.includes('2025-12-15'), 'Les dates de réunion doivent être retirées de l’export dé-identifié');
  assert.ok(!deidText.includes('Retour favorable des parents'), 'Les retours nominatifs doivent être retirés de l’export dé-identifié');

  // 3. Vérification de l'export DOCX (hiérarchie Heading1, Heading2, ListParagraph, gras clé/valeur)
  const docxBytes = makeDocx(profLines);
  const entries = await unzipEntries(docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength));
  const docXml = new TextDecoder('utf-8').decode(entries['word/document.xml']);
  const stylesXml = new TextDecoder('utf-8').decode(entries['word/styles.xml']);

  assert.ok(docXml.includes('w:val="Title"'), 'Le DOCX doit contenir le style Title');
  assert.ok(docXml.includes('w:val="Heading1"'), 'Le DOCX doit contenir des titres Heading1');
  assert.ok(docXml.includes('w:val="Heading2"'), 'Le DOCX doit contenir des sous-titres Heading2');
  assert.ok(docXml.includes('w:val="ListParagraph"'), 'Le DOCX doit contenir des listes à puces ListParagraph');
  assert.ok(stylesXml.includes('w:styleId="Heading1"'), 'styles.xml doit définir Heading1');

  // 4. Vérification de l'export PDF (retour à la ligne automatique, zéro troncature à 110 caractères, pagination multi-pages)
  const longMarker = 'MARQUEUR FINAL LOT PIA 3 SANS TRONCATURE';
  const linesWithLongParagraph = [
    ...profLines,
    `Observation détaillée : Cette phrase dépasse largement la limite historique de cent-dix caractères afin de prouver que le générateur PDF découpe proprement les paragraphes longs sur plusieurs lignes sans jamais couper la fin comme ${longMarker}.`
  ];
  const pdfBytes = makePdf(linesWithLongParagraph);
  const pdfRaw = new TextDecoder('latin1').decode(pdfBytes);
  const extractedPdfLines = extractPdfStrings(pdfRaw);
  const fullPdfText = extractedPdfLines.join(' ');

  assert.ok(fullPdfText.includes(longMarker), 'Le marqueur situé au-delà du 110e caractère doit être intégralement présent dans le PDF');
  assert.ok(fullPdfText.includes('Page 1 /'), 'Le PDF doit comporter une numérotation de page');
  assert.ok(
    extractedPdfLines.some(line => line.includes('Réunion de fin')) || fullPdfText.includes('Perspectives pour la suite'),
    `La fin du document doit être présente sans troncature à 46 lignes (extrait final: ${extractedPdfLines.slice(-10).join(' | ')})`
  );
});

test('LOT PIA-3D — Export Synthèse & Préparation de réunion : classification H1/H2/puces en DOCX/PDF et rapprochement PIA dans PV1/PV2', async () => {
  const ctx = await loadV74Lot3Harness();
  const { makeDocx, makePdf, unzipEntries, extractPdfStrings } = ctx.__lot3;
  const coreCode = await fs.readFile(path.join(root, 'src/app/journalier-core.js'), 'utf8');
  const reportsCode = await fs.readFile(path.join(root, 'src/app/reports-core.js'), 'utf8');
  const allAppCode = coreCode + '\n' + reportsCode;

  // Vérification statique et fonctionnelle de reportElementText et reportIntegrationPIA
  assert.ok(allAppCode.includes("li.insertBefore(document.createTextNode('• '),li.firstChild)"), 'reportElementText doit préfixer les <li> d’une puce •');
  assert.ok(allAppCode.includes('PIA annuel enregistré ('), 'reportIntegrationPIA doit exploiter le PIA annuel enregistré dans meta.piaRecords');

  const meetingPrepExportLines = [
    'Préparation de réunion — Camille Dupont',
    'Points récurrents',
    '• Identifie les informations utiles dans la consigne — niveau constaté : partiellement (3 séances) [Mathématiques · Comprendre la consigne]',
    'Points variables',
    '• Repérer les données numériques utiles — appréciation : en cours d’appropriation [Mathématiques · Comprendre la consigne]',
    'Adaptations',
    '• Reformulation de la consigne — effet constaté : aide déterminante',
    'Transfert',
    '• Observé dans une autre tâche ou situation',
    'Suites Q6',
    '• Poursuivre l’adaptation mise en place',
    '• Modalité : Individuel',
    'Points à discuter',
    '• Objectif de suite renseigné : Consolider le repérage des étapes'
  ];

  const docxBytes = makeDocx(meetingPrepExportLines);
  const entries = await unzipEntries(docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength));
  const docXml = new TextDecoder('utf-8').decode(entries['word/document.xml']);
  assert.ok(docXml.includes('w:val="Heading1"'), 'Les sections de Préparation de réunion doivent être stylées en Heading1');
  assert.ok(docXml.includes('w:val="ListParagraph"'), 'Les éléments de Préparation de réunion doivent être stylés en ListParagraph');

  const pdfBytes = makePdf(meetingPrepExportLines);
  const pdfText = extractPdfStrings(new TextDecoder('latin1').decode(pdfBytes)).join(' ');
  assert.ok(pdfText.includes('Points récurrents'));
  assert.ok(pdfText.includes('Suites Q6'));
  assert.ok(pdfText.includes('Consolider le repérage des étapes'));
});

