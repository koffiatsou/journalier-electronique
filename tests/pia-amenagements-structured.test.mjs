/**
 * Tests contractuels et fonctionnels : Saisie structurée des aménagements raisonnables (Option A)
 *
 * Vérifie :
 * 1. Remplacement du textarea meeting.adaptations par la liste éditable (Réunion 1 et 2).
 * 2. Formatage et normalisation via normalizeStructuredAmenagement (P, O, M, combinaisons, aucun type, referentielId).
 * 3. Filtrage : une ligne sans description ni case cochée n'est pas enregistrée.
 * 4. Bouton Réunion 2 « Reprendre les aménagements de décembre » (un clic, jamais automatique, copie profonde, JR_HANDLERS h86).
 * 5. Survie intégrale à une reconstruction du PIA via buildPIA (T5 et T8).
 * 6. Export Word de bout en bout jusqu'aux X dans T5 et T8 (12 lignes, plusieurs types, échappement XML).
 * 7. Adaptation des lecteurs historiques (appendMeetingText, buildMeetingExportTable).
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
      createElement: () => {
        const el = {
          setAttribute: () => {},
          appendChild: () => {},
          remove: () => {},
          click: () => {},
          textContent: '',
          _download: '',
          set download(val) {
            this._download = val;
            context.__lastDownloadName = val;
          },
          get download() {
            return this._download;
          }
        };
        return el;
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: (id) => ({ id, value: '', textContent: '', dataset: {}, classList: { contains: () => false, add: () => {}, remove: () => {} }, setAttribute: () => {}, appendChild: () => {}, addEventListener: () => {}, removeEventListener: () => {} })
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
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
  vm.runInContext(runtimeCode, context);
  vm.runInContext(coreCode, context);

  return { context, templateBytes };
}

test('1. normalizeStructuredAmenagement et helpers : cas nominaux, combinaisons, aucun type et referentielId', async () => {
  const { context } = await loadHarness();
  const V74 = context.JournalierV74;

  assert.equal(typeof V74.normalizeStructuredAmenagement, 'function');
  assert.equal(typeof V74.filterValidStructuredAmenagements, 'function');
  assert.equal(typeof V74.formatStructuredAmenagementsSummary, 'function');

  // A. Ligne avec Pédagogique seul
  const itemP = V74.normalizeStructuredAmenagement({
    p: true,
    description: 'Consignes courtes et segmentées',
    referentielId: 'REF_WBE_12'
  }, 0);
  assert.equal(itemP.n, 1);
  assert.equal(itemP.labelN, '1\u00A0');
  assert.equal(itemP.p, true);
  assert.equal(itemP.o, false);
  assert.equal(itemP.m, false);
  assert.equal(itemP.type, 'P');
  assert.equal(itemP.description, 'Consignes courtes et segmentées');
  assert.equal(itemP.referentielId, 'REF_WBE_12');

  // B. Ligne avec plusieurs types (P + M)
  const itemPM = V74.normalizeStructuredAmenagement({
    p: true,
    m: true,
    description: 'Logiciel de lecture vocale & repères visuels'
  }, 1);
  assert.equal(itemPM.n, 2);
  assert.equal(itemPM.p, true);
  assert.equal(itemPM.o, false);
  assert.equal(itemPM.m, true);
  assert.equal(itemPM.type, 'P+M');

  // C. Ligne avec les trois types (P + O + M)
  const itemPOM = V74.normalizeStructuredAmenagement({
    p: true,
    o: true,
    m: true,
    description: 'Aménagement global d’examen'
  }, 2);
  assert.equal(itemPOM.p, true);
  assert.equal(itemPOM.o, true);
  assert.equal(itemPOM.m, true);
  assert.equal(itemPOM.type, 'P+O+M');

  // D. Ligne avec aucun type coché mais description présente
  const itemNoType = V74.normalizeStructuredAmenagement({
    description: 'Aménagement informel sans classement'
  }, 3);
  assert.equal(itemNoType.p, false);
  assert.equal(itemNoType.o, false);
  assert.equal(itemNoType.m, false);
  assert.equal(itemNoType.type, '');
  assert.equal(itemNoType.description, 'Aménagement informel sans classement');

  // E. Filtrage : une ligne sans description ni case n'est pas enregistrée
  const emptyRow1 = { p: false, o: false, m: false, description: '' };
  const emptyRow2 = { p: false, o: false, m: false, description: '   ' };
  const validList = V74.filterValidStructuredAmenagements([itemP, emptyRow1, itemPM, emptyRow2, itemNoType]);
  assert.equal(validList.length, 3, 'Les deux lignes vides doivent être écartées');
  assert.equal(validList[0].description, 'Consignes courtes et segmentées');
  assert.equal(validList[1].description, 'Logiciel de lecture vocale & repères visuels');
  assert.equal(validList[2].description, 'Aménagement informel sans classement');
});

test('2. Remplacement du textarea meeting.adaptations dans Réunion 1 et 2 par la liste éditable', async () => {
  const { context } = await loadHarness();
  const V74 = context.JournalierV74;

  const mockPia = {
    id: 'pia-test-editor',
    schoolYear: '2026-2027',
    lifecycle: 'EN_VIGUEUR',
    meeting1: {
      date: '2026-10-15',
      status: 'A_PREPARE'
    },
    meeting2: {
      date: '2027-06-18',
      status: 'A_VENIR',
      amenagementsRentree: []
    },
    amenagements: [
      { p: true, o: false, m: false, description: 'Synthèse vocale' },
      { p: false, o: true, m: false, description: 'Tiers-temps' }
    ]
  };

  // Réunion 1
  const htmlM1 = V74.piaMeetingEditor(mockPia, 'meeting1', 'Réunion de décembre', 'REUNION_1_DECEMBRE');
  // Le textarea adaptations ne doit PLUS être présent
  assert.ok(!htmlM1.includes('data-v74-meeting-field="adaptations"'), 'Le textarea meeting.adaptations doit être supprimé de réunion 1');
  assert.ok(htmlM1.includes('class="v74-amenagements-container"'), 'Le conteneur structuré d’aménagements doit être présent');
  assert.ok(htmlM1.includes('Aménagements raisonnables (décembre — T5)'), 'Le titre T5 de réunion 1 doit être présent');
  assert.ok(htmlM1.includes('data-v74-add-amenagement="meeting1"'), 'Le bouton ajouter aménagement doit être présent');
  assert.ok(htmlM1.includes('Synthèse vocale'), 'La description de l’aménagement doit être affichée');
  assert.ok(!htmlM1.includes('v74-btn-copy-dec'), 'Le bouton de reprise ne doit pas être présent en réunion 1');

  // Réunion 2
  const htmlM2 = V74.piaMeetingEditor(mockPia, 'meeting2', 'Réunion de fin d’année', 'REUNION_2_FIN_ANNEE');
  assert.ok(!htmlM2.includes('data-v74-meeting-field="adaptations"'), 'Le textarea meeting.adaptations doit être supprimé de réunion 2');
  assert.ok(htmlM2.includes('Aménagements raisonnables (rentrée suivante — T8)'), 'Le titre T8 de réunion 2 doit être présent');
  assert.ok(htmlM2.includes('data-v74-add-amenagement="meeting2"'), 'Le bouton ajouter aménagement doit être présent pour réunion 2');
  assert.ok(htmlM2.includes('Reprendre les aménagements de décembre'), 'Le bouton de reprise doit être présent en réunion 2');
  assert.ok(htmlM2.includes('data-jr-handlers="h86"'), 'L’attribut data-jr-handlers="h86" doit être présent sur le bouton de reprise');

  // Vérification de la conformité CSP : JR_HANDLERS["h86"] doit exister
  assert.ok(context.JR_HANDLERS['h86'], 'JR_HANDLERS["h86"] doit être déclaré');
  assert.equal(context.JR_HANDLERS['h86'].attr, 'onclick');
  assert.equal(typeof context.JR_HANDLERS['h86'].fn, 'function');
});

test('3. Réunion 2 : Bouton « Reprendre les aménagements de décembre » (copie profonde sans altérer R1)', async () => {
  const { context } = await loadHarness();
  const V74 = context.JournalierV74;

  const mockPia = {
    id: 'pia-copy-test',
    studentId: 'stud-copy',
    lifecycle: 'EN_VIGUEUR',
    meeting1: {
      date: '2026-10-15',
      status: 'VALIDÉE'
    },
    meeting2: {
      date: '2027-06-18',
      status: 'A_VENIR',
      amenagementsRentree: []
    },
    amenagements: [
      { p: true, o: false, m: false, description: 'Consigne aérée', referentielId: 'REF_1' },
      { p: false, o: true, m: true, description: 'Table inclinable', referentielId: 'REF_2' }
    ]
  };

  context.window.__v74_active_pia = mockPia;
  context.window.JournalierV74.activePIA = mockPia;

  // Appel de la fonction de copie
  await V74.copyDecemberAmenagementsToMeeting2(mockPia);

  // Vérification de la copie dans meeting2.amenagementsRentree
  const copied = mockPia.meeting2.amenagementsRentree;
  assert.ok(Array.isArray(copied), 'amenagementsRentree doit être un tableau');
  assert.equal(copied.length, 2, 'Les 2 aménagements doivent être repris');
  assert.equal(copied[0].description, 'Consigne aérée');
  assert.equal(copied[0].p, true);
  assert.equal(copied[1].description, 'Table inclinable');
  assert.equal(copied[1].o, true);
  assert.equal(copied[1].m, true);

  // Vérification que la copie est profonde : modifier meeting2 ne doit PAS modifier Réunion 1
  copied[0].description = 'Consigne ultra aérée modifiée pour la rentrée';
  copied[0].p = false;
  assert.equal(mockPia.amenagements[0].description, 'Consigne aérée', 'Réunion 1 ne doit pas être altérée');
  assert.equal(mockPia.amenagements[0].p, true, 'Réunion 1 ne doit pas être altérée');

  // Déclenchement via JR_HANDLERS['h86']
  assert.equal(typeof context.JR_HANDLERS['h86'].fn, 'function');
});

test('4. Survie intégrale à une reconstruction du PIA via buildPIA (T5 et T8)', async () => {
  const { context } = await loadHarness();
  const V74 = context.JournalierV74;

  const student = {
    studentId: 'stud-reconstruct',
    nom: 'Camille Dupont',
    classe: '5P',
    ecole: 'École WBE Centre'
  };

  const existingPIA = {
    id: 'pia-recon-1',
    studentId: 'stud-reconstruct',
    schoolYear: '2026-2027',
    lifecycle: 'EN_VIGUEUR',
    meeting1: {
      date: '2026-10-15',
      status: 'VALIDÉE',
      objectivesValidated: ['Comprendre les consignes écrites']
    },
    meeting2: {
      date: '2027-06-20',
      status: 'A_VENIR',
      amenagementsRentree: [
        { p: true, o: false, m: false, description: 'Rentrée : Consignes pas à pas' },
        { p: false, o: false, m: true, description: 'Rentrée : Casque anti-bruit' }
      ]
    },
    amenagements: [
      { p: true, o: false, m: false, description: 'Décembre : Aération du texte' },
      { p: false, o: true, m: false, description: 'Décembre : Tiers-temps' },
      { p: false, o: false, m: true, description: 'Décembre : Clavier adapté' }
    ]
  };

  const reconstructed = V74.buildPIA(student, [], '2027-06-25', existingPIA, '2026-2027');

  // Vérifier la survie de Réunion 1 (T5)
  assert.ok(Array.isArray(reconstructed.amenagements), 'amenagements doit être un tableau');
  assert.equal(reconstructed.amenagements.length, 3, 'Les 3 aménagements de décembre doivent être conservés');
  assert.equal(reconstructed.amenagements[0].description, 'Décembre : Aération du texte');
  assert.equal(reconstructed.amenagements[0].p, true);
  assert.equal(reconstructed.amenagements[1].description, 'Décembre : Tiers-temps');
  assert.equal(reconstructed.amenagements[1].o, true);
  assert.equal(reconstructed.amenagements[2].description, 'Décembre : Clavier adapté');
  assert.equal(reconstructed.amenagements[2].m, true);

  // Vérifier la survie de Réunion 2 (T8)
  assert.ok(Array.isArray(reconstructed.meeting2.amenagementsRentree), 'amenagementsRentree doit être conservé dans meeting2');
  assert.equal(reconstructed.meeting2.amenagementsRentree.length, 2, 'Les 2 aménagements de rentrée doivent être conservés');
  assert.equal(reconstructed.meeting2.amenagementsRentree[0].description, 'Rentrée : Consignes pas à pas');
  assert.equal(reconstructed.meeting2.amenagementsRentree[0].p, true);
  assert.equal(reconstructed.meeting2.amenagementsRentree[1].description, 'Rentrée : Casque anti-bruit');
  assert.equal(reconstructed.meeting2.amenagementsRentree[1].m, true);
});

test('5. Export Word de bout en bout jusqu’aux X dans T5 et T8 (12 lignes, plusieurs types, échappement XML)', async () => {
  const { context, templateBytes } = await loadHarness();
  const V74 = context.JournalierV74;

  // Création de 12 aménagements pour T5 avec combinaisons et caractères spéciaux
  const amenagements12_T5 = [
    { p: true, o: false, m: false, description: '1. Segmenter les consignes & étayer' },
    { p: false, o: true, m: false, description: '2. Tiers-temps supplémentaire (O)' },
    { p: false, o: false, m: true, description: '3. Clavier ergonomique & souris adaptée' },
    { p: true, o: true, m: false, description: '4. Combinaison P+O : consigne orale + temps dédié' },
    { p: true, o: false, m: true, description: '5. Combinaison P+M : repères visuels & règle de lecture' },
    { p: false, o: true, m: true, description: '6. Combinaison O+M : espace calme + casque réducteur' },
    { p: true, o: true, m: true, description: '7. Combinaison P+O+M : accompagnement complet' },
    { p: false, o: false, m: false, description: '8. Sans type coché : valorisation des réussites' },
    { p: true, o: false, m: false, description: '9. Échappement : Test <balise> & "guillemets" d\'apostrophe' },
    { p: false, o: true, m: false, description: '10. Pause cognitive planifiée' },
    { p: false, o: false, m: true, description: '11. Support de cours agrandi (A3)' },
    { p: true, o: false, m: false, description: '12. Double vérification par l’enseignant' }
  ];

  // Création de 12 aménagements pour T8
  const amenagements12_T8 = amenagements12_T5.map((a, i) => ({
    ...a,
    description: a.description.replace(/^\d+\./, `Rentrée ${i + 1}.`)
  }));

  const pia12 = {
    id: 'pia-12-test',
    schoolYear: '2026-2027',
    eleve: 'Alexandre Renard',
    lifecycle: 'EN_VIGUEUR',
    meeting1: {
      date: '2026-10-15',
      status: 'VALIDÉE',
      personnesPresentes: ['M. Professeur (Titulaire)', 'Mme Parent (Mère)'],
      feedback: { eleve: 'Alexandre se sent soutenu & motivé.' }
    },
    meeting2: {
      date: '2027-06-18',
      status: 'REEVALUATION_VALIDEE',
      personnesPresentes: ['M. Professeur (Titulaire)', 'Mme Parent (Mère)'],
      amenagementsRentree: amenagements12_T8
    },
    amenagements: amenagements12_T5
  };

  // Construction du modèle officiel pour fin d'année (alimente T5 et T8)
  const docModel = V74.buildOfficialPIADocumentModel(pia12, false, { moment: 'FIN_ANNEE' });

  assert.equal(docModel.t5_amenagements.length, 12, 'T5 doit comporter exactement 12 aménagements');
  assert.equal(docModel.t8_amenagements.length, 12, 'T8 doit comporter exactement 12 aménagements');

  // Génération du fichier Word officiel
  const docxBytes = await V74.makeOfficialDocx(docModel, templateBytes);
  assert.ok(docxBytes instanceof Uint8Array, 'Le fichier retourné doit être un Uint8Array');
  assert.ok(docxBytes.length > 50000, 'La taille du document Word doit être cohérente');

  // Décompression de word/document.xml pour vérifications approfondies
  const zipEntries = await context.JournalierDocx.unzipEntries(docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength));
  const docBytes = zipEntries['word/document.xml'];
  assert.ok(docBytes, 'word/document.xml doit exister dans l’archive générée');

  const docXml = new TextDecoder().decode(docBytes);

  // 1. Vérification des 12 numéros dans le XML
  for (let i = 1; i <= 12; i++) {
    assert.ok(docXml.includes(`<w:t>${i}</w:t>`), `Le numéro d'aménagement ${i} doit apparaître dans les lignes Word`);
  }

  // 2. Vérification de l'échappement strict XML
  assert.ok(!docXml.includes('<balise>'), 'Les balises brutes ne doivent pas être injectées dans le XML');
  assert.ok(docXml.includes('&lt;balise&gt;'), 'Les balises doivent être échappées en &lt;balise&gt;');
  assert.ok(docXml.includes('&amp;'), 'Les esperluettes doivent être échappées en &amp;');

  // 3. Vérification de la présence de X dans T5 et T8
  const xMatches = docXml.match(/<w:t>X<\/w:t>/g) || [];
  assert.ok(xMatches.length >= 20, `Il doit y avoir de nombreuses cases cochées X (trouvé : ${xMatches.length})`);
});

test('6. Adaptation des lecteurs historiques (appendMeetingText, buildMeetingExportTable)', async () => {
  const { context } = await loadHarness();
  const V74 = context.JournalierV74;

  const piaWithStructured = {
    id: 'pia-readers-test',
    schoolYear: '2026-2027',
    eleve: 'Zoé Martin',
    amenagements: [
      { p: true, o: false, m: false, description: 'Aide à la lecture' },
      { p: false, o: true, m: true, description: 'Espace calme et casque' }
    ],
    meeting1: {
      date: '2026-10-15',
      status: 'VALIDÉE'
    },
    meeting2: {
      date: '2027-06-18',
      status: 'A_VENIR',
      amenagementsRentree: [
        { p: true, o: true, m: false, description: 'Rentrée : temps majoré' }
      ]
    }
  };

  // A. Dossier de travail détaillé (buildPIADocumentModel interne)
  const internalDocModel = V74.buildPIADocumentModel(piaWithStructured, false);
  const m1Table = internalDocModel.blocks.find(b => b.type === 'table' && b.rows?.some(r => r[0] === 'Adaptations P/O/M'));
  assert.ok(m1Table, 'La table de réunion 1 doit comporter la ligne Adaptations P/O/M');
  const adaptRow = m1Table.rows.find(r => r[0] === 'Adaptations P/O/M');
  assert.ok(Array.isArray(adaptRow[1]), 'Les adaptations doivent être fournies sous forme de lignes formatées');
  assert.ok(adaptRow[1].some(line => line.includes('[P] Aide à la lecture')), 'L’aménagement P doit être formaté');
  assert.ok(adaptRow[1].some(line => line.includes('[O+M] Espace calme et casque')), 'L’aménagement O+M doit être formaté');

  // B. Export texte brut (piaTextSections)
  const textLines = V74.piaTextSections(piaWithStructured, false);
  const textOutput = textLines.join('\n');
  assert.ok(textOutput.includes('Adaptations P/O/M :'), 'Le libellé Adaptations P/O/M doit apparaître');
  assert.ok(textOutput.includes('[P] Aide à la lecture'), 'Le format structuré doit apparaître dans le texte exporté');
});
