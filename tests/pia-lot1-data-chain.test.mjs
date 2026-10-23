import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadJournalierReportHarness() {
  const source = await fs.readFile(path.join(root, 'src/app/journalier-core.js'), 'utf8');
  const sessionsSource = await fs.readFile(path.join(root, 'src/app/sessions-core.js'), 'utf8');
  const reportsSource = await fs.readFile(path.join(root, 'src/app/reports-core.js'), 'utf8');
  const labelStart = sessionsSource.indexOf('function escapeHtml(value)');
  const labelEnd = sessionsSource.indexOf('function renderHistoryDetail(entry)');
  const prepStart = reportsSource.indexOf('function toInfinitivePhrase(rawText)');
  const prepEnd = reportsSource.indexOf('function reportElementText(element)');
  const reportStart = reportsSource.indexOf('function reportUnique(values)');
  const reportEnd = reportsSource.indexOf('// Exposition globale et namespace JournalierReports');

  assert.ok(labelStart > 0 && labelEnd > labelStart, 'Could not locate label helpers in sessions-core.js');
  assert.ok(prepStart > 0 && prepEnd > prepStart, 'Could not locate renderMeetingPrep in reports-core.js');
  assert.ok(reportStart > 0 && reportEnd > reportStart, 'Could not locate report engine in reports-core.js');

  const combinedSlice = [
    sessionsSource.slice(labelStart, labelEnd),
    reportsSource.slice(prepStart, prepEnd),
    reportsSource.slice(reportStart, reportEnd)
  ].join('\n');

  const meetingPrepHost = { innerHTML: '' };
  const sandbox = {
    Map,
    Set,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    JSON,
    Date,
    sessionParts: (log) => ({
      date: log?.identification?.date || log?.date || '2026-10-01',
      matiere: log?.contexte?.matiere || log?.matiere || 'Français',
      eleve: log?.identification?.eleve || log?.eleve || 'Élève Test'
    }),
    getStudents: () => [{ nom: 'Élève Test', pia: 'Objectif PIA existant' }],
    document: {
      getElementById: (id) => (id === 'meeting-prep-output' ? meetingPrepHost : null)
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${combinedSlice}
    globalThis.__reportApi = {
      historyQ2LevelLabel,
      historyQ4EffectLabel,
      historyQ5TransferLabel,
      reportIndicatorLabel,
      reportSessionEvidence,
      reportExtractUnits,
      reportRelations,
      reportBuildSessionLinks,
      reportChainLabel,
      reportCompareLinkedChains,
      reportLinkedSynthesis,
      reportBuildHierarchy,
      reportFindingPhrase,
      reportHierarchyParagraph,
      reportPriorityDetails,
      reportLearningParagraph,
      reportObservationParagraph,
      reportMechanismParagraph,
      reportEvolutionParagraph,
      reportAdaptationParagraph,
      reportTransferParagraph,
      reportNextStepsParagraph,
      reportIntegrationReport,
      renderMeetingPrep,
      getMeetingPrepHtml: () => document.getElementById('meeting-prep-output').innerHTML
    };
  `, sandbox);
  return sandbox.__reportApi;
}

async function loadV74RuntimeHarness() {
  const source = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const referentialRaw = await fs.readFile(path.join(root, 'public/referentiel_pia_v74_0_3.json'), 'utf8');
  const referential = JSON.parse(referentialRaw);

  const startIdx = source.indexOf('const V74 = {');
  const endIdx = source.indexOf('function evaluateMeeting2(');
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'Could not locate PIA engine slice in v74-runtime.js');
  const slice = source.slice(startIdx, endIdx);

  const sandbox = {
    Map,
    Set,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    JSON,
    Date,
    PIA_MEETING_ACTORS: [
      { id: 'eleve', label: 'Élève' },
      { id: 'parents', label: 'Parents / responsables' },
      { id: 'ecoleOrdinaire', label: 'École ordinaire' },
      { id: 'directionOrdinaire', label: 'Direction ordinaire' },
      { id: 'pmsOrdinaire', label: 'CPMS ordinaire' },
      { id: 'agent', label: 'Intervenant / pôle' },
      { id: 'directionSpeciale', label: 'Direction spécialisée' },
      { id: 'pmsSpecial', label: 'CPMS spécialisé' },
      { id: 'autres', label: 'Autres' }
    ],
    window: {},
    document: { querySelectorAll: () => [] }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${slice}
    V74.referential = ${JSON.stringify(referential)};
    globalThis.__piaApi = {
      formatPiaQ5Status,
      formatPiaQ3Appreciation,
      parsePiaQ2Level,
      formatPiaQ2LevelLabel,
      sessionText,
      q5Positive,
      q5Help,
      extractUnits,
      compareUnits,
      proposalText,
      buildPIA
    };
  `, sandbox);
  return sandbox.__piaApi;
}

test('LOT PIA-1 — CAS 1, 2, 3 : Q2 Partiellement (0), Suffisamment (1), Totalement (2)', async () => {
  const reportApi = await loadJournalierReportHarness();
  const piaApi = await loadV74RuntimeHarness();

  // CAS 1 : Partiellement (0) -> fragilité / besoin de renforcement situé
  const sessionPartiel = {
    id: 's-partiel-1',
    type: 'SEANCE',
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date: '2026-09-10' },
    contexte: { matiere: 'Français', niveau: 'P3' },
    objectif: { objectifLecon: 'Comprendre une consigne écrite' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Comprend une consigne simple', niveau: 0 }], precision: '' },
    q3: { indicateurs: [{ id: 'ind-1', texte: 'Identifier les informations clés', appreciation: 0 }], precision: '' },
    q4: { types: ['Reformulation'], effets: { Reformulation: 1 }, precision: '' },
    q5: { statut: 'not_observed', precision: '' },
    q6: { actions: ['Poursuivre le décodage des consignes'], modalite: 'Individuel', objectif: 'Clarifier les étapes', collaborations: ['Enseignant titulaire'], precision: '' }
  };

  const evPartiel = [reportApi.reportSessionEvidence(sessionPartiel)];
  const unitsPartiel = reportApi.reportExtractUnits(evPartiel);
  assert.ok(unitsPartiel.length > 0, 'Units extracted for Partiellement');
  assert.equal(unitsPartiel[0].q2Level, 0);
  assert.equal(unitsPartiel[0].q2LevelLabel, 'Partiellement');
  assert.equal(unitsPartiel[0].difficultySignal, true);
  assert.equal(unitsPartiel[0].functionalSignal, false);
  assert.equal(unitsPartiel[0].positiveSignal, false);
  assert.equal(unitsPartiel[0].polarity, 'difficulty');

  const obsParaPartiel = reportApi.reportObservationParagraph(unitsPartiel, reportApi.reportRelations(unitsPartiel)).join(' ');
  assert.match(obsParaPartiel, /niveau constaté : partiellement/i);

  // CAS 2 : Suffisamment (1) -> compétence fonctionnelle en situation courante, jamais difficulté franche ni score numérique
  const sessionSuffisant1 = {
    id: 's-suffisant-1',
    type: 'SEANCE',
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date: '2026-09-12' },
    contexte: { matiere: 'Français', niveau: 'P3' },
    objectif: { objectifLecon: 'Lire et appliquer une consigne' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Comprend les consignes courantes', niveau: 1 }], precision: '' },
    q3: { indicateurs: [{ id: 'ind-2', texte: 'Dégager la consigne principale', appreciation: 1 }], precision: '' },
    q4: { types: ['Surlignage des mots-clés'], effets: { 'Surlignage des mots-clés': 2 }, precision: '' },
    q5: { statut: 'observed', precision: '' },
    q6: { actions: ['Transférer sur des consignes doubles'], modalite: 'En classe', objectif: 'Consolider les consignes complexes', collaborations: [], precision: '' }
  };
  const sessionSuffisant2 = {
    ...sessionSuffisant1,
    id: 's-suffisant-2',
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date: '2026-09-19' }
  };

  const evSuffisant = [sessionSuffisant1, sessionSuffisant2].map((s) => reportApi.reportSessionEvidence(s));
  const unitsSuffisant = reportApi.reportExtractUnits(evSuffisant);
  assert.ok(unitsSuffisant.length > 0, 'Units extracted for Suffisamment');
  assert.equal(unitsSuffisant[0].q2Level, 1);
  assert.equal(unitsSuffisant[0].q2LevelLabel, 'Suffisamment');
  assert.equal(unitsSuffisant[0].functionalSignal, true);
  assert.equal(unitsSuffisant[0].difficultySignal, false);
  assert.equal(unitsSuffisant[0].positiveSignal, false);
  assert.equal(unitsSuffisant[0].polarity, 'functional');

  const relSuffisant = reportApi.reportRelations(unitsSuffisant);
  assert.equal(relSuffisant.recurrences[0].functionals.length, 2);
  assert.equal(relSuffisant.recurrences[0].difficulties.length, 0);

  const hierarchyParaSuffisant = reportApi.reportHierarchyParagraph(unitsSuffisant, relSuffisant);
  const priorityParaSuffisant = reportApi.reportPriorityDetails(unitsSuffisant, relSuffisant).join(' ');
  assert.match(hierarchyParaSuffisant, /compétence fonctionnelle dans les situations courantes|fonctionnel dans les situations courantes/i);
  assert.match(priorityParaSuffisant, /suffisamment/i);
  assert.doesNotMatch(priorityParaSuffisant, /point de vigilance récurrent/i);

  // Vérification PIA pour Suffisamment (sur 3 séances distinctes)
  const suffisantSessions = ['2026-09-12', '2026-09-19', '2026-09-26'].map((date, idx) => ({
    ...sessionSuffisant1,
    id: `s-suff-${idx + 1}`,
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date }
  }));
  const piaSuffisant = piaApi.buildPIA({ studentId: 'st-1', nom: 'Élève Test' }, suffisantSessions, '2026-10-01', null);
  const allDiffSuffisant = piaSuffisant.sections.flatMap((sec) => sec.difficultes);
  const allResSuffisant = piaSuffisant.sections.flatMap((sec) => sec.ressources);
  assert.equal(allDiffSuffisant.length, 0, 'Suffisamment must NOT be classified in PIA difficultes');
  assert.ok(allResSuffisant.some((r) => r.includes('fonctionnement suffisant en situation courante')), 'Suffisamment is recorded as functional in PIA ressources');
  if (piaSuffisant.propositions.length > 0) {
    assert.match(piaSuffisant.propositions[0].formulation, /Consolider|transfert|situations complexes/i);
  }

  // CAS 3 : Totalement (2) -> point d'appui / maîtrise observée en contexte, JAMAIS dans les difficultés ni en proposition corrective
  const sessionTotal = {
    id: 's-total-1',
    type: 'SEANCE',
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date: '2026-09-15' },
    contexte: { matiere: 'Mathématiques', niveau: 'P3' },
    objectif: { objectifLecon: 'Résoudre un exercice en autonomie' },
    q2: { observations: [{ categorie: 'Organisation du travail', observation: 'Travail en autonomie et méthode appliquée', niveau: 2 }], precision: '' },
    q3: { indicateurs: [{ id: 'ind-3', texte: 'Préparer son matériel sans rappel', appreciation: 2 }], precision: '' },
    q4: { types: [], effets: {}, precision: '' },
    q5: { statut: 'observed', precision: '' },
    q6: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }
  };

  const evTotal = [reportApi.reportSessionEvidence(sessionTotal)];
  const unitsTotal = reportApi.reportExtractUnits(evTotal);
  assert.ok(unitsTotal.length > 0, 'Units extracted for Totalement');
  assert.equal(unitsTotal[0].q2Level, 2);
  assert.equal(unitsTotal[0].q2LevelLabel, 'Totalement');
  assert.equal(unitsTotal[0].positiveSignal, true);
  assert.equal(unitsTotal[0].difficultySignal, false);
  assert.equal(unitsTotal[0].functionalSignal, false);
  assert.equal(unitsTotal[0].polarity, 'positive');

  const totalSessions = ['2026-09-15', '2026-09-22', '2026-09-29'].map((date, idx) => ({
    ...sessionTotal,
    id: `s-tot-${idx + 1}`,
    identification: { eleveId: 'st-1', eleve: 'Élève Test', date }
  }));
  const piaTotal = piaApi.buildPIA({ studentId: 'st-1', nom: 'Élève Test' }, totalSessions, '2026-10-01', null);
  const allDiffTotal = piaTotal.sections.flatMap((sec) => sec.difficultes);
  const allResTotal = piaTotal.sections.flatMap((sec) => sec.ressources);
  assert.equal(allDiffTotal.length, 0, 'Totalement must NEVER appear in PIA difficultes');
  assert.ok(allResTotal.length > 0, 'Totalement must appear in PIA ressources');
  assert.equal(piaTotal.propositions.length, 0, 'Totalement must NEVER generate a corrective PIA proposal');
});

test('LOT PIA-1 — CAS 4 & 5 : Évolution (Partiellement -> Suffisamment -> Totalement) et Variabilité contextuelle', async () => {
  const reportApi = await loadJournalierReportHarness();

  // CAS 4 : Évolution progressive sur un même thème (Partiellement -> Suffisamment -> Totalement)
  const s1 = {
    id: 's-evo-1',
    identification: { date: '2026-09-05' },
    contexte: { matiere: 'Français' },
    objectif: { objectifLecon: 'Lecture de consignes' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Se repère dans la consigne écrite', niveau: 0 }] },
    q3: { indicateurs: [{ id: 'ind-c', texte: 'Identifier les mots-clés de la consigne', appreciation: 0 }] },
    q4: {}, q5: { statut: 'not_observed' }, q6: {}
  };
  const s2 = {
    id: 's-evo-2',
    identification: { date: '2026-09-15' },
    contexte: { matiere: 'Français' },
    objectif: { objectifLecon: 'Lecture de consignes' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Se repère dans la consigne écrite', niveau: 1 }] },
    q3: { indicateurs: [{ id: 'ind-c', texte: 'Identifier les mots-clés de la consigne', appreciation: 1 }] },
    q4: {}, q5: { statut: 'observed' }, q6: {}
  };
  const s3 = {
    id: 's-evo-3',
    identification: { date: '2026-09-25' },
    contexte: { matiere: 'Français' },
    objectif: { objectifLecon: 'Lecture de consignes' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Se repère dans la consigne écrite', niveau: 2 }] },
    q3: { indicateurs: [{ id: 'ind-c', texte: 'Identifier les mots-clés de la consigne', appreciation: 2 }] },
    q4: {}, q5: { statut: 'observed' }, q6: {}
  };

  const evEvo = [s1, s2, s3].map((s) => reportApi.reportSessionEvidence(s));
  const unitsEvo = reportApi.reportExtractUnits(evEvo);
  const relEvo = reportApi.reportRelations(unitsEvo);
  const linksEvo = reportApi.reportBuildSessionLinks(evEvo, unitsEvo);
  const chainsEvo = reportApi.reportCompareLinkedChains(linksEvo);
  assert.ok(chainsEvo.length > 0, 'Linked chains should detect trajectory across sessions');
  assert.match(chainsEvo[0], /Partiellement → Suffisamment → Totalement/);

  // Test progression Partiellement -> Suffisamment seule
  const evPartToSuff = [s1, s2].map((s) => reportApi.reportSessionEvidence(s));
  const relPartToSuff = reportApi.reportRelations(reportApi.reportExtractUnits(evPartToSuff));
  const evoParaPartToSuff = reportApi.reportEvolutionParagraph(relPartToSuff);
  assert.match(evoParaPartToSuff, /évolue de « partiellement » vers « suffisamment »/i);

  // CAS 5 : Variabilité selon le contexte (Français Partiellement vs Mathématiques Totalement)
  const sVarFr = {
    id: 's-var-1',
    identification: { date: '2026-09-10' },
    contexte: { matiere: 'Français' },
    objectif: { objectifLecon: 'Consigne de rédaction' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Comprend la consigne', niveau: 0 }] },
    q3: {}, q4: {}, q5: { statut: 'not_observed' }, q6: {}
  };
  const sVarMath = {
    id: 's-var-2',
    identification: { date: '2026-09-11' },
    contexte: { matiere: 'Mathématiques' },
    objectif: { objectifLecon: 'Consigne de calcul' },
    q2: { observations: [{ categorie: 'Compréhension des consignes', observation: 'Comprend la consigne', niveau: 2 }] },
    q3: {}, q4: {}, q5: { statut: 'observed' }, q6: {}
  };
  const evVar = [sVarFr, sVarMath].map((s) => reportApi.reportSessionEvidence(s));
  const unitsVar = reportApi.reportExtractUnits(evVar);
  const relVar = reportApi.reportRelations(unitsVar);
  reportApi.renderMeetingPrep(evVar, relVar);
  const prepHtml = reportApi.getMeetingPrepHtml();
  assert.match(prepHtml, /partiellement/i);
  assert.match(prepHtml, /totalement/i);
  assert.match(prepHtml, /Français/i);
  assert.match(prepHtml, /Mathématiques/i);
});

test('LOT PIA-1 — CAS 6, 7, 8, 9, 10, 11 : Q3 appréciation/WBE, Q4 effet descriptif non causal, Q5 français, Q6 complet', async () => {
  const reportApi = await loadJournalierReportHarness();
  const piaApi = await loadV74RuntimeHarness();

  const sessionComplete = {
    id: 's-full-1',
    type: 'SEANCE',
    identification: { eleveId: 'st-2', eleve: 'Élève Test', date: '2026-09-18' },
    contexte: { matiere: 'Français', niveau: 'P4' },
    objectif: { objectifLecon: 'Compréhension de texte court' },
    q2: {
      observations: [
        { categorie: 'Attention et concentration', observation: 'Maintient son attention sur une tâche écrite', niveau: 0 },
        { categorie: 'Autonomie', observation: 'Travail en autonomie avec ses outils', niveau: 1 },
        { categorie: 'Travail en groupe', observation: 'Participation active au travail en groupe', niveau: 2 }
      ],
      precision: 'Fatigue plus marquée en fin de matinée.'
    },
    q3: {
      repereWBE: {
        hit: 'Repérer les informations explicites dans un texte court',
        signature: 'Socle WBE · Français P4 · Lecture explicite'
      },
      indicateurs: [
        { id: 'i-1', texte: 'Identifier les personnages et leurs actions', appreciation: 1 },
        { id: 'i-2', texte: 'Participer à l’échange oral autour du texte', appreciation: 2 },
        { id: 'i-3', texte: 'Inférer une information implicite', appreciation: 0 }
      ],
      precision: 'Bonne implication à l’oral.'
    },
    q4: {
      types: ['Segmentation du texte en paragraphes', 'Cache-ligne visuel'],
      effets: {
        'Segmentation du texte en paragraphes': 2,
        'Cache-ligne visuel': 1
      },
      precision: 'Dispositif accepté volontiers par l’élève.'
    },
    q5: {
      statut: 'observed',
      precision: 'Se réfère spontanément au surlignage.'
    },
    q6: {
      actions: ['Maintenir le cache-ligne sur les lectures longues'],
      modalite: 'Co-intervention en classe',
      objectif: 'Stabiliser le repérage explicite sur un texte de 10 lignes',
      collaborations: ['Enseignant titulaire', 'Logopède'],
      precision: 'Point prévu avec la titulaire vendredi.'
    }
  };

  // Vérification formatage Q5 (CAS 10) : aucun code anglais brut
  assert.equal(reportApi.historyQ5TransferLabel('observed'), 'Observé');
  assert.equal(reportApi.historyQ5TransferLabel('not_observed'), 'Non observé');
  assert.equal(reportApi.historyQ5TransferLabel('no_opportunity'), 'Pas d’occasion');
  assert.equal(piaApi.formatPiaQ5Status('observed'), 'Observé');
  assert.equal(piaApi.q5Positive(sessionComplete), true, 'q5Positive recognizes statut: "observed"');

  // Vérification Préparation de réunion (CAS 6, 7, 8, 9, 10, 11)
  const evFull = [reportApi.reportSessionEvidence(sessionComplete)];
  const unitsFull = reportApi.reportExtractUnits(evFull);
  const relFull = reportApi.reportRelations(unitsFull);
  reportApi.renderMeetingPrep(evFull, relFull);
  const prepHtml = reportApi.getMeetingPrepHtml();

  // Q2 niveaux affichés (groupes de degré ou formulations fluides)
  assert.match(prepHtml, /fragilité nécessitant un appui|partiellement/i);
  assert.match(prepHtml, /fonctionnel en situation courante|suffisamment/i);
  assert.match(prepHtml, /point d’appui acquis|totalement/i);

  // Q3 appréciations traduites (CAS 6, 7, 8)
  assert.match(prepHtml, /en cours d’appropriation|pas encore totalement maîtrisé/i);
  assert.match(prepHtml, /maîtrisé|mobilisé/i);
  assert.match(prepHtml, /à renforcer/i);

  // Q4 effet affiché de manière descriptive et fluide sans causalité abusive (CAS 9)
  assert.match(prepHtml, /Segmentation du texte en paragraphes/i);
  assert.match(prepHtml, /Aide concrètement l’élève en séance/i);
  assert.match(prepHtml, /Cache-ligne visuel/i);
  assert.match(prepHtml, /Aide partiellement l’élève en séance/i);

  // Q5 supprimé de la vue Préparation de réunion (conservé dans la Synthèse)
  assert.doesNotMatch(prepHtml, /\bobserved\b/);

  // Q6 complet (CAS 11)
  assert.match(prepHtml, /Maintenir le cache-ligne sur les lectures longues/);
  assert.match(prepHtml, /Modalité : Co-intervention en classe/);
  assert.match(prepHtml, /Objectif : Stabiliser le repérage explicite sur un texte de 10 lignes/);
  assert.match(prepHtml, /Collaboration : Enseignant titulaire/);
  assert.match(prepHtml, /Collaboration : Logopède/);

  // Vérification Synthèse (chaînage et paragraphes)
  const linked = reportApi.reportLinkedSynthesis(evFull, unitsFull, relFull);
  const linkedText = linked.paragraphs.join(' ');
  assert.match(linkedText, /niveau constaté : (partiellement|suffisamment|totalement)/i);
  assert.match(linkedText, /Repère WBE validé : Socle WBE · Français P4 · Lecture explicite/);
  assert.match(linkedText, /Modalité : Co-intervention en classe/);
  assert.match(linkedText, /Orientation : Stabiliser le repérage explicite/);
  assert.match(linkedText, /Collaboration : Enseignant titulaire et Logopède/);
  assert.doesNotMatch(linkedText, /\bobserved\b/);

  const nextStepsPara = reportApi.reportNextStepsParagraph(evFull, relFull);
  assert.match(nextStepsPara, /Modalité\(s\) retenue\(s\) : Co-intervention en classe/);
  assert.match(nextStepsPara, /Orientation\(s\) d’objectif : Stabiliser le repérage explicite/);
  assert.match(nextStepsPara, /Collaboration\(s\) prévue\(s\) : Enseignant titulaire et Logopède/);
});
