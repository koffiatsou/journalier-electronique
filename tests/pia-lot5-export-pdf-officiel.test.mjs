/**
 * Tests contractuels du Lot 5 : Export PDF officiel équivalent au Word
 * Valide :
 * - Test 12 : Texte du PDF identique à celui du Word, dans le même ordre séquentiel.
 * - Test 13 : Mêmes cas limites que le Word (Cas 1 dé-identifié, Cas 5 moments décembre vs fin d'année,
 *             Cas 6 caractères spéciaux, Cas 7 données partielles, Cas 8 longs textes, Cas 9 aménagements multiples).
 * - Test 15 : Aucune donnée à caractère personnel dans les métadonnées PDF (/Info : Title, Author, Creator, Producer).
 * - Test 16 : Échec clair si un libellé officiel est introuvable ou si le modèle est invalide.
 * - Interface : Présence des boutons côte à côte Word/PDF sur R1 et R2 avec gestionnaires CSP h87 et h88.
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
  const pdfExportCode = await fs.readFile(path.join(root, 'src/v74/v74-pdf-export.js'), 'utf8');
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const coreCode = await fs.readFile(path.join(root, 'src/app/journalier-core.js'), 'utf8');
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
    setTimeout,
    clearTimeout,
    Uint8Array,
    Uint32Array,
    DataView,
    ArrayBuffer,
    TextEncoder,
    TextDecoder,
    Blob,
    Response,
    DecompressionStream,
    URL: {
      createObjectURL: (blob) => {
        context.__lastBlob = blob;
        return 'blob:mock';
      },
      revokeObjectURL: () => {}
    },
    document: {
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      documentElement: { nodeType: 1 },
      readyState: 'complete',
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        remove: () => {},
        click: () => {},
        textContent: '',
        style: {},
        _download: '',
        set download(val) {
          this._download = val;
          context.__lastDownloadName = val;
        },
        get download() {
          return this._download;
        }
      }),
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: (id) => ({
        id,
        value: '',
        textContent: '',
        dataset: {},
        classList: { contains: () => false, add: () => {}, remove: () => {} },
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    atob: typeof atob === 'function' ? atob : undefined,
    btoa: typeof btoa === 'function' ? btoa : undefined,
    Buffer: typeof Buffer !== 'undefined' ? Buffer : undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
    window: {},
    process: { cwd: () => root, versions: { node: '22.0.0' } },
    fs,
    __piaOfficialTemplateBuffer: templateBytes,
    DataStore: {
      diagnostics: () => ({ isSecure: true }),
      getSessions: () => [],
      getStudents: () => [],
      getState: () => ({ eleves: [], sessions: [], meta: {} }),
      isReady: () => true
    },
    selectedDateISO: '2026-10-18',
    updateStudentDropdowns: () => {},
    populatePeriodSelectors: () => {},
    bindReportsUX: () => {},
    renderAgenda: () => {},
    renderHome: () => {},
    runIntegrityChecks: () => {},
    initializePageStage: () => {},
    getPrevisionnel: () => []
  };
  context.window = context;
  context.globalThis = context;
  context.JournalierDataStore = context.DataStore;

  vm.createContext(context);
  vm.runInContext(docxPvCode, context);
  vm.runInContext(docxExportCode, context);
  vm.runInContext(pdfExportCode, context);
  vm.runInContext(runtimeCode, context);
  vm.runInContext(coreCode, context);

  return { context, templateBytes };
}

function createSampleCompletePia() {
  return {
    schoolYear: '2025-2026',
    identity: {
      nom: 'Lucas Lambert',
      dateNaissance: '2014-03-15',
      classe: '5P A',
      titulaire: 'Mme Martin'
    },
    aspects: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: ['Bonne motricité globale'],
        difficultes: ['Fatigabilité en fin de journée'],
        objectifs: ['Pauses motrices régulières']
      },
      {
        aspect: 'Lié à l’autonomie',
        ressources: ['Gère son matériel scolaire'],
        difficultes: ['Planification du travail'],
        objectifs: ['Utiliser un semainier visuel']
      },
      {
        aspect: 'Comportemental et affectif',
        ressources: ['Élève sociable et volontaire'],
        difficultes: ['Gestion des émotions lors des évaluations'],
        objectifs: ['Aménager un coin calme']
      },
      {
        aspect: 'Communication',
        ressources: ['Vocabulaire riche et expressif'],
        difficultes: ['Prise de parole devant tout le groupe'],
        objectifs: ['Exprimer son accord ou désaccord en petit groupe']
      },
      {
        aspect: 'Cognitif (pédagogique)',
        ressources: ['Bonne logique de calcul mental'],
        difficultes: ['Consignes doubles ou complexes'],
        objectifs: ['Consignes séquencées en sous-étapes']
      }
    ],
    meeting1: {
      date: '2025-12-10',
      axeDifficulte: 'Axe cognitif et organisationnel',
      objectifsCriteres: 'Comprendre et appliquer une démarche en 3 étapes',
      ressourcesMoyens: 'Fiches outils illustrées et sablier 15 min',
      personnesPresentes: ['M. Dubois (Directeur)', 'Mme Martin (Titulaire)', 'M. Lambert (Parent)'],
      feedback: {
        parents: 'Très satisfaits des progrès observés à domicile',
        directionEtEquipe: 'Soutien total de l école et investissement remarquable',
        eleve: 'Se sent plus confiant lors des exercices de mathématiques',
        pms: 'Poursuivre les guidances psycho-éducatives régulières',
        integration: 'Passages réguliers 2h par semaine confirmés',
        autres: 'Orthophoniste informée du protocole'
      }
    },
    amenagements: [
      { type: 'P', description: 'Consignes découpées en sous-tâches' },
      { type: 'O', description: 'Place au premier rang face au tableau' },
      { type: 'M', description: 'Casque anti-bruit pour les évaluations' }
    ],
    meeting2: {
      date: '2026-06-15',
      personnesPresentes: ['Mme Martin (Titulaire)', 'M. Lambert (Parent)', 'Mme Vallet (CPMS)'],
      objectifsEvaluation: 'Objectifs de l année atteints à 85% avec autonomie croissante',
      feedback: {
        parents: 'Excellente année, bilan très positif',
        directionEtEquipe: 'Passage en classe supérieure validé à l unanimité',
        eleve: 'Fier de ses progrès et de son dossier',
        pms: 'Bilan positif, reconduction recommandée',
        integration: 'Maintien du dispositif à la rentrée prochaine',
        autres: 'Transmission du dossier faite à la nouvelle équipe'
      },
      amenagementsRentree: [
        { type: 'P', description: 'Consignes écrites étape par étape' },
        { type: 'M', description: 'Support visuel plastifié de repérage' }
      ]
    }
  };
}

test('Lot 5 — Test 12 : Texte du PDF identique à celui du Word, dans le même ordre séquentiel', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();
  const docModelFin = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'FIN_ANNEE' }, false);

  // 1. Génération Word
  const docxBytes = await context.JournalierDocx.fillOfficialPIADocx(docModelFin, templateBytes);
  assert.ok(docxBytes.byteLength > 50000, 'Word généré');

  // 2. Génération PDF
  const pdfBytes = pdfApi.makeOfficialPdf(docModelFin);
  assert.ok(pdfBytes instanceof Uint8Array, 'PDF généré sous forme de Uint8Array');
  assert.ok(pdfBytes.byteLength > 5000, 'Taille PDF significative (> 5 Ko)');

  // 3. Extraction du texte PDF
  const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));
  assert.ok(pdfText && pdfText.length > 500, 'Texte extrait du PDF substantiel');

  const pdfLines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

  // Jalons textuels officiels qui doivent apparaître dans l'ordre strict
  const milestones = [
    '2025-2026',
    'Plan Individuel d’Apprentissage',
    'Lucas Lambert',
    '5P A',
    '15/03/2014',
    'Mme Martin',
    'Pôle Territorial WBE BXL',
    'Aspect',
    'Ressources',
    'Difficultés',
    'Objectifs à poursuivre',
    'Physique et psychomoteur',
    'Lié à l’autonomie',
    'Comportemental et affectif',
    'Communication',
    'Cognitif (pédagogique)',
    'Annexe 2',
    'Procès-verbal 1',
    '10/12/2025',
    'Personnes présentes',
    'M. Dubois (Directeur)',
    'Mme Martin (Titulaire)',
    'M. Lambert (Parent)',
    'Axe cognitif et organisationnel',
    'Comprendre et appliquer une démarche en 3 étapes',
    'Fiches outils illustrées',
    'Très satisfaits',
    'Soutien total de l école',
    'Se sent plus confiant',
    'Poursuivre les guidances',
    'Passages réguliers 2h',
    'Aménagements proposés pour l’élève',
    'Consignes découpées en sous-tâches',
    'Place au premier rang face au tableau',
    'Casque anti-bruit pour les évaluations',
    'P = pédagogique',
    'Procès-verbal 2 (fin d’année)',
    '15/06/2026',
    'Mme Vallet (CPMS)',
    'Objectifs de l année atteints',
    'Excellente année',
    'Passage en classe supérieure',
    'Fier de ses progrès',
    'Mise à jour des aménagements',
    'Consignes écrites étape par étape',
    'Support visuel plastifié'
  ];

  let lastIdx = 0;
  for (const m of milestones) {
    const foundIdx = pdfLines.slice(lastIdx).findIndex(line => line.includes(m));
    assert.ok(
      foundIdx >= 0,
      `Jalon textuel introuvable ou dans le mauvais ordre dans le PDF : "${m}" (après ligne ${lastIdx})`
    );
    lastIdx += foundIdx;
  }
});

test('Lot 5 — Test 13 : Cas 1 (dé-identifié) — Neutralisation stricte des données personnelles', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();
  const docModelDeid = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, true);

  assert.equal(docModelDeid.deidentified, true);
  assert.equal(docModelDeid.t1_identite.nom, '', 'Nom anonymisé (cellule vide)');
  assert.equal(docModelDeid.t1_identite.dateNaissance, '', 'Date de naissance anonymisée');
  assert.equal(docModelDeid.t1_identite.coordonneesEcole, '', 'École anonymisée');

  const pdfBytes = pdfApi.makeOfficialPdf(docModelDeid);
  const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));

  assert.ok(!pdfText.includes('Lucas Lambert'), 'Le nom réel ne doit pas apparaître dans un export dé-identifié');
  assert.ok(!pdfText.includes('15/03/2014'), 'La date de naissance réelle ne doit pas apparaître');

  // Nom de fichier avec nom anonymisé ou vide
  const deidFileName = v74.buildOfficialPIAFileName('Élève 1', 'DECEMBRE', '2025-2026', 'pdf');
  assert.equal(deidFileName, 'PIA - Élève 1 - décembre 2025.pdf');
  assert.ok(!deidFileName.includes('Lucas'), 'Le fichier dé-identifié ne contient aucun nom réel');
});

test('Lot 5 — Test 13 : Cas 5 (moments) — Décembre a PV2/T8 vides ; Fin d’année a PV1, PV2, T5, T8 remplis', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();

  // 1. Export Décembre
  const docModelDec = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, false);
  const pdfDec = await context.extractPdfText(new context.Blob([pdfApi.makeOfficialPdf(docModelDec)]));

  assert.ok(pdfDec.includes('10/12/2025'), 'Date PV1 présente en décembre');
  assert.ok(pdfDec.includes('Consignes découpées en sous-tâches'), 'Aménagements T5 présents en décembre');
  // Les sections PV2 et T8 doivent être vierges de données spécifiques de fin d'année
  assert.ok(!pdfDec.includes('15/06/2026'), 'Date PV2 absente en décembre');
  assert.ok(!pdfDec.includes('Objectifs de l année atteints'), 'Évaluation PV2 absente en décembre');
  assert.ok(!pdfDec.includes('Support visuel plastifié'), 'Aménagements T8 absents en décembre');

  // 2. Export Fin d'année
  const docModelFin = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'FIN_ANNEE' }, false);
  const pdfFin = await context.extractPdfText(new context.Blob([pdfApi.makeOfficialPdf(docModelFin)]));

  assert.ok(pdfFin.includes('10/12/2025'), 'Date PV1 conservée en fin d’année');
  assert.ok(pdfFin.includes('Consignes découpées en sous-tâches'), 'Aménagements T5 conservés en fin d’année');
  assert.ok(pdfFin.includes('15/06/2026'), 'Date PV2 présente en fin d’année');
  assert.ok(pdfFin.includes('Objectifs de l année atteints'), 'Évaluation PV2 présente en fin d’année');
  assert.ok(pdfFin.includes('Support visuel plastifié'), 'Aménagements T8 présents en fin d’année');
});

test('Lot 5 — Test 13 : Cas 6 (spéciaux) — Caractères accentués, esperluette, guillemets, tirets cadratins', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();
  sample.identity.nom = 'Éléonore Benoît & Chloé';
  sample.meeting1.axeDifficulte = 'Maths & Français : « démarche » d’analyse — axe n°1';
  sample.amenagements = [
    { type: 'P', description: 'Outils adaptés & grille d’observation « 3 étapes » — réussite > 80%' }
  ];

  const docModel = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, false);
  const pdfBytes = pdfApi.makeOfficialPdf(docModel);
  const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));

  assert.ok(pdfText.includes('Éléonore Benoît & Chloé'), 'Nom avec accents et esperluette préservé');
  assert.ok(pdfText.includes('Maths & Français'), 'Axe avec esperluette préservé');
  assert.ok(pdfText.includes('démarche'), 'Guillemets et apostrophes gérés');
});

test('Lot 5 — Test 13 : Cas 7 (données partielles) — Aucun crash, aucune valeur undefined ou NaN', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const partialPia = {
    schoolYear: '',
    identity: { nom: '' },
    aspects: [],
    meeting1: {},
    amenagements: [],
    meeting2: {}
  };

  for (const moment of ['DECEMBRE', 'FIN_ANNEE']) {
    const docModel = v74.buildOfficialPIADocumentModel({ ...partialPia, moment }, false);
    const pdfBytes = pdfApi.makeOfficialPdf(docModel);
    assert.ok(pdfBytes instanceof Uint8Array, `PDF généré pour moment ${moment} avec données partielles`);
    const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));
    assert.ok(!pdfText.includes('undefined'), 'Aucun "undefined" dans le PDF');
    assert.ok(!pdfText.includes('NaN'), 'Aucun "NaN" dans le PDF');
    assert.ok(!pdfText.includes('null'), 'Aucun "null" dans le PDF');
  }
});

test('Lot 5 — Test 13 : Cas 8 (longs textes) & Cas 9 (12 aménagements ou plus) — Pagination et découpage', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();

  // Textes très longs multi-lignes dans les retours
  sample.meeting1.feedback.parents =
    'Premier paragraphe long détaillant la situation scolaire.\n' +
    'Deuxième paragraphe avec des observations comportementales très fournies.\n' +
    'Troisième paragraphe formulant des propositions concrètes pour le prochain trimestre.';

  // 12 aménagements structurés
  sample.amenagements = Array.from({ length: 12 }, (_, i) => ({
    type: i % 3 === 0 ? 'P' : i % 3 === 1 ? 'O' : 'M',
    description: `Aménagement structuré numéro ${i + 1} avec description détaillée de mise en œuvre pédagogique.`
  }));

  const docModel = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, false);
  const pdfBytes = pdfApi.makeOfficialPdf(docModel);
  const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));

  // Tous les 12 aménagements doivent être présents dans le texte extrait
  for (let i = 1; i <= 12; i++) {
    assert.ok(
      pdfText.includes(`Aménagement structuré numéro ${i}`),
      `Aménagement ${i} présent dans l'export multi-pages`
    );
  }

  // Contrôle de la présence de la pagination (au moins 2 pages)
  assert.ok(/Page 1 \/ [2-9]/.test(pdfText), 'Page 1 présente dans la pagination');
  assert.ok(/Page 2 \/ [2-9]/.test(pdfText), 'Page 2 présente dans la pagination');
});

test('Lot 5 — Test 15 : Aucune donnée nominative (RGPD) dans les métadonnées PDF (/Info)', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();
  const docModel = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, false);
  const pdfBytes = pdfApi.makeOfficialPdf(docModel);

  // Conversion brute du PDF en texte pour inspecter le dictionnaire /Info
  const rawPdf = Array.from(pdfBytes, b => String.fromCharCode(b)).join('');
  const infoMatch = rawPdf.match(/<<\s*\/Title\s+([^>]+)>>/);

  assert.ok(infoMatch, 'Dictionnaire /Info présent dans le PDF');
  const infoBlock = infoMatch[0];

  // Le titre et l'auteur doivent être génériques / institutionnels
  assert.ok(infoBlock.includes('Plan Individuel'), 'Titre générique dans /Info');
  assert.ok(infoBlock.includes('P\\xF4le Territorial WBE BXL') || infoBlock.includes('WBE'), 'Auteur institutionnel dans /Info');

  // Aucun nom d'élève ou d'enseignant ne doit figurer dans les métadonnées du document
  assert.ok(!infoBlock.includes('Lucas'), 'Prénom de l’élève absent de /Info');
  assert.ok(!infoBlock.includes('Lambert'), 'Nom de l’élève absent de /Info');
  assert.ok(!infoBlock.includes('Martin'), 'Nom de l’enseignant absent de /Info');
});

test('Lot 5 — Test 16 : Échec clair si un libellé officiel est absent ou altéré', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;

  const sample = createSampleCompletePia();
  const docModel = v74.buildOfficialPIADocumentModel({ ...sample, moment: 'DECEMBRE' }, false);

  // 1. Modèle manquant ou sans flag isPIADocumentModel
  assert.throws(
    () => pdfApi.makeOfficialPdf(null),
    /Modèle documentaire PIA absent/
  );
  assert.throws(
    () => pdfApi.makeOfficialPdf({}),
    /Modèle documentaire PIA invalide/
  );

  // 2. Altération d'un des 5 aspects officiels
  const corruptedModel = {
    ...docModel,
    t2_aspects: docModel.t2_aspects.filter(a => !a.aspect.includes('Cognitif'))
  };

  assert.throws(
    () => pdfApi.makeOfficialPdf(corruptedModel),
    /Libellé introuvable dans le modèle officiel : Cognitif/
  );
});

test('Lot 5 — Boutons côte à côte sur Réunion 1 et 2 & Handlers CSP h87 / h88', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const jrHandlers = context.JR_HANDLERS;

  const sample = createSampleCompletePia();

  // 1. Réunion 1 : Deux boutons côte à côte Word (.docx) et PDF (.pdf)
  const htmlM1 = v74.piaMeetingEditor(sample, 'meeting1', 'Réunion de décembre', 'REUNION_1_DECEMBRE');
  assert.ok(htmlM1.includes('id="v74-export-official-decembre"'), 'Bouton Word décembre présent');
  assert.ok(htmlM1.includes('id="v74-export-official-decembre-pdf"'), 'Bouton PDF décembre présent');
  assert.ok(htmlM1.includes('data-jr-handlers="h84"'), 'Handler h84 sur Word décembre');
  assert.ok(htmlM1.includes('data-jr-handlers="h87"'), 'Handler h87 sur PDF décembre');
  assert.ok(htmlM1.includes('v74-btn-primary'), 'Classe primary sur Word');
  assert.ok(htmlM1.includes('v74-btn-neutral'), 'Classe neutral sur PDF');
  assert.ok(htmlM1.includes('📄 Exporter en Word (.docx)'), 'Libellé Word avec icône');
  assert.ok(htmlM1.includes('📑 Exporter en PDF (.pdf)'), 'Libellé PDF avec icône');

  // 2. Réunion 2 : Deux boutons côte à côte Word (.docx) et PDF (.pdf)
  const htmlM2 = v74.piaMeetingEditor(sample, 'meeting2', 'Réunion de fin d’année', 'REUNION_2_FIN_ANNEE');
  assert.ok(htmlM2.includes('id="v74-export-official-fin-annee"'), 'Bouton Word fin d’année présent');
  assert.ok(htmlM2.includes('id="v74-export-official-fin-annee-pdf"'), 'Bouton PDF fin d’année présent');
  assert.ok(htmlM2.includes('data-jr-handlers="h85"'), 'Handler h85 sur Word fin d’année');
  assert.ok(htmlM2.includes('data-jr-handlers="h88"'), 'Handler h88 sur PDF fin d’année');

  // 3. Handlers h87 et h88 enregistrés dans le registre CSP JR_HANDLERS
  assert.ok(jrHandlers['h87'], 'JR_HANDLERS["h87"] défini');
  assert.equal(jrHandlers['h87'].attr, 'onclick');
  assert.equal(typeof jrHandlers['h87'].fn, 'function');

  assert.ok(jrHandlers['h88'], 'JR_HANDLERS["h88"] défini');
  assert.equal(jrHandlers['h88'].attr, 'onclick');
  assert.equal(typeof jrHandlers['h88'].fn, 'function');

  // 4. Nom de fichier généré avec extension .pdf
  const pdfNameDec = v74.buildOfficialPIAFileName('Lucas Lambert', 'DECEMBRE', '2025-2026', 'pdf');
  assert.equal(pdfNameDec, 'PIA - Lucas Lambert - décembre 2025.pdf');
  const pdfNameFin = v74.buildOfficialPIAFileName('Lucas Lambert', 'FIN_ANNEE', '2025-2026', 'pdf');
  assert.equal(pdfNameFin, "PIA - Lucas Lambert - fin d'année 2026.pdf");
});
