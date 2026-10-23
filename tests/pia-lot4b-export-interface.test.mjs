/**
 * Tests contractuels du Lot 4B : Interface d'export du Word officiel
 * Valide :
 * 1. La fonction de nommage de fichier (cas normal, accents, caractères interdits, nom vide).
 * 2. La présence des boutons d'export sur les écrans de réunion 1 et réunion 2.
 * 3. La production de documents .docx valides pour décembre et fin d'année (y compris avec parties vides).
 * 4. L'enregistrement des clics dans le registre JR_HANDLERS (conformité CSP).
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
  vm.runInContext(runtimeCode, context);
  vm.runInContext(coreCode, context);

  return { context, templateBytes, runtimeCode };
}

test('Lot 4B — 1. Nommage de fichier officiel (cas normal, accents, caractères interdits, nom vide)', async () => {
  const { context } = await loadHarness();
  const buildName = context.buildOfficialPIAFileName;
  assert.equal(typeof buildName, 'function', 'buildOfficialPIAFileName doit être exposé');

  // A. Cas normal : décembre et fin d'année
  const nameDec = buildName('Lucas Bernard', 'DECEMBRE', '2026-2027');
  assert.equal(nameDec, 'PIA - Lucas Bernard - décembre 2026.docx');

  const nameFin = buildName('Lucas Bernard', 'FIN_ANNEE', '2026-2027');
  assert.equal(nameFin, "PIA - Lucas Bernard - fin d'année 2027.docx");

  // B. Accents préservés
  const nameAccents = buildName('Éléonore Benoît-Château', 'DECEMBRE', '2026-2027');
  assert.equal(nameAccents, 'PIA - Éléonore Benoît-Château - décembre 2026.docx');

  // C. Retrait des caractères interdits (/ \ : * ? " < > |)
  const nameForbidden = buildName('Dupont / Jean : 4P *Test?* <B|A>', 'DECEMBRE', '2026-2027');
  assert.ok(!/[/\\:*?"<>|]/.test(nameForbidden), 'Aucun caractère interdit ne doit subsister');
  assert.equal(nameForbidden, 'PIA - Dupont Jean 4P Test BA - décembre 2026.docx');

  // D. Nom vide
  const nameEmptyDec = buildName('', 'DECEMBRE', '2026-2027');
  assert.equal(nameEmptyDec, 'PIA - décembre 2026.docx');

  const nameWhitespaceFin = buildName('   ', 'FIN_ANNEE', '2026-2027');
  assert.equal(nameWhitespaceFin, "PIA - fin d'année 2027.docx");
});

test('Lot 4B — 2. Présence des boutons d’export dans l’écran de réunion 1 et réunion 2', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const mockPia = {
    id: 'pia-test-buttons',
    schoolYear: '2026-2027',
    lifecycle: 'EN_VIGUEUR',
    meeting1: { date: '2026-10-15' },
    meeting2: { date: '2027-06-18' }
  };

  // Réunion 1 (décembre)
  const htmlM1 = v74.piaMeetingEditor(mockPia, 'meeting1', 'Réunion de décembre', 'REUNION_1_DECEMBRE');
  assert.ok(htmlM1.includes('Exporter la version de décembre'), 'Bouton réunion 1 présent');
  assert.ok(htmlM1.includes('id="v74-export-official-decembre"'), 'Id réunion 1 présent');
  assert.ok(htmlM1.includes('data-jr-handlers="h84"'), 'Attribut data-jr-handlers="h84" présent sur bouton réunion 1');

  // Réunion 2 (fin d'année)
  const htmlM2 = v74.piaMeetingEditor(mockPia, 'meeting2', 'Réunion de fin d’année', 'REUNION_2_FIN_ANNEE');
  assert.ok(htmlM2.includes("Exporter la version de fin d'année"), 'Bouton réunion 2 présent');
  assert.ok(htmlM2.includes('id="v74-export-official-fin-annee"'), 'Id réunion 2 présent');
  assert.ok(htmlM2.includes('data-jr-handlers="h85"'), 'Attribut data-jr-handlers="h85" présent sur bouton réunion 2');

  // Renommage de l'export détaillé actuel
  const indexHtml = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('Dossier de travail détaillé (usage interne)'), 'Option renommée dans index.html');
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  assert.ok(runtimeCode.includes('Dossier de travail détaillé (usage interne)'), 'Bouton renommé dans v74-runtime.js');
});

test('Lot 4B — 3. Les exports décembre et fin d’année produisent un .docx valide (y compris avec partie vide)', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = context.JournalierDocx;

  // A. Export complet de décembre
  const completePia = {
    schoolYear: '2026-2027',
    identity: { nom: 'Lucas Bernard' },
    meeting1: {
      date: '2026-10-15',
      axeDifficulte: 'Axe Test',
      personnesPresentes: ['P1', 'P2']
    },
    amenagements: [{ type: 'P', description: 'Aménagement Test' }],
    meeting2: {
      date: '2027-06-20',
      objectifsEvaluation: 'Évaluation Fin Année',
      amenagementsRentree: [{ type: 'M', description: 'Aménagement Rentrée' }]
    }
  };

  const docModelDec = v74.buildOfficialPIADocumentModel({ ...completePia, moment: 'DECEMBRE' }, false);
  const outDec = await fillOfficialPIADocx(docModelDec, templateBytes);
  assert.ok(outDec.byteLength > 50000, 'Le fichier décembre doit comporter un volume DOCX normal');
  const entriesDec = await unzipEntries(outDec.buffer.slice(outDec.byteOffset, outDec.byteOffset + outDec.byteLength));
  assert.ok(entriesDec['word/document.xml'], 'document.xml doit exister');

  // B. Export complet de fin d'année (avec PV1 ET PV2, T5 ET T8)
  const docModelFin = v74.buildOfficialPIADocumentModel({ ...completePia, moment: 'FIN_ANNEE' }, false);
  const outFin = await fillOfficialPIADocx(docModelFin, templateBytes);
  const entriesFin = await unzipEntries(outFin.buffer.slice(outFin.byteOffset, outFin.byteOffset + outFin.byteLength));
  const docXmlFin = new TextDecoder().decode(entriesFin['word/document.xml']);
  assert.ok(docXmlFin.includes('15/10/2026'), 'Date PV1 présente dans l’export de fin d’année');
  assert.ok(docXmlFin.includes('20/06/2027'), 'Date PV2 présente dans l’export de fin d’année');
  assert.ok(docXmlFin.includes('Axe Test'), 'Axe PV1 présent dans l’export de fin d’année');
  assert.ok(docXmlFin.includes('Évaluation Fin Année'), 'Évaluation PV2 présente dans l’export de fin d’année');

  // C. Export robuste avec un PIA vide (aucune erreur, aucun message bloquant)
  const emptyPia = {};
  for (const moment of ['DECEMBRE', 'FIN_ANNEE']) {
    const emptyModel = v74.buildOfficialPIADocumentModel(emptyPia, false, { moment });
    const emptyOut = await fillOfficialPIADocx(emptyModel, templateBytes);
    assert.ok(emptyOut.byteLength > 50000, `L’export vide pour ${moment} produit un DOCX complet`);
  }
});

test('Lot 4B — 4. Les clics passent par le registre JR_HANDLERS (conformité CSP)', async () => {
  const { context } = await loadHarness();
  const jrHandlers = context.JR_HANDLERS;
  assert.ok(jrHandlers, 'JR_HANDLERS doit être défini');
  assert.ok(jrHandlers['h84'], 'JR_HANDLERS["h84"] doit être enregistré pour décembre');
  assert.equal(jrHandlers['h84'].attr, 'onclick', 'h84 doit être un gestionnaire onclick');
  assert.equal(typeof jrHandlers['h84'].fn, 'function', 'h84.fn doit être une fonction');

  assert.ok(jrHandlers['h85'], 'JR_HANDLERS["h85"] doit être enregistré pour fin d’année');
  assert.equal(jrHandlers['h85'].attr, 'onclick', 'h85 doit être un gestionnaire onclick');
  assert.equal(typeof jrHandlers['h85'].fn, 'function', 'h85.fn doit être une fonction');
});

test('Lot 4B — 5. Contrôle sur un PIA créé par l’écran : nom de l’élève dans le nom de fichier et dans le .docx', async () => {
  const { context } = await loadHarness();
  const { unzipEntries } = context.JournalierDocx;

  // A. Déduction automatique de l'année scolaire depuis la date du jour si non renseignée / illisible
  const now = new Date();
  const expectedStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const expectedEnd = expectedStart + 1;
  const autoDec = context.buildOfficialPIAFileName('Claire Dubois', 'DECEMBRE', '');
  assert.equal(autoDec, `PIA - Claire Dubois - décembre ${expectedStart}.docx`, 'Année de décembre déduite de la date du jour');
  const autoFin = context.buildOfficialPIAFileName('Claire Dubois', 'FIN_ANNEE', 'annee-invalide');
  assert.equal(autoFin, `PIA - Claire Dubois - fin d'année ${expectedEnd}.docx`, 'Année de fin d’année déduite de la date du jour');

  // B. Simulation d'un élève sélectionné et d'un PIA actif issu de l'écran
  const student = { id: 'el-42', studentId: 'el-42', nom: 'Claire Dubois' };
  const screenPia = {
    id: 'pia-screen-test',
    type: 'PIA_ANNUEL',
    studentId: 'el-42',
    schoolYear: '2026-2027',
    lifecycle: 'EN_VIGUEUR',
    identity: {
      nom: 'Claire Dubois',
      classe: '4e Primaire',
      ecole: 'École de l’Arbre Ballon'
    },
    meeting1: {
      date: '2026-10-15',
      axeDifficulte: 'Compréhension des consignes',
      personnesPresentes: ['Claire Dubois', 'Mme Martin (Titulaire)', 'M. Leroux (Pôle)']
    },
    amenagements: [
      { type: 'P', description: 'Reformulation de la consigne et temps supplémentaire' }
    ]
  };

  // Injection dans le runtime : V74.state et DataStore
  context.V74.state = screenPia;
  context.DataStore.getStudents = () => [student];
  context.DataStore.getState = () => ({
    eleves: [student],
    meta: { piaRecords: { 'el-42': screenPia } }
  });
  context.DataStore.isReady = () => true;

  // Déclenchement via JR_HANDLERS h84 (décembre)
  await context.JR_HANDLERS['h84'].fn();
  assert.equal(context.__lastDownloadName, 'PIA - Claire Dubois - décembre 2026.docx', 'Le nom du fichier téléchargé doit contenir « Nom Prénom »');
  assert.ok(context.__lastBlob, 'Un Blob doit avoir été créé pour le téléchargement');
  const blobBufDec = await context.__lastBlob.arrayBuffer();
  const bytesDec = new Uint8Array(blobBufDec);
  assert.ok(bytesDec.length > 50000, 'Le flux binaire doit être un DOCX généré');

  // Vérification de la présence de l'élève dans le XML officiel du .docx produit
  const entriesDec = await unzipEntries(bytesDec.buffer.slice(bytesDec.byteOffset, bytesDec.byteOffset + bytesDec.byteLength));
  const docXmlDec = new TextDecoder('utf-8').decode(entriesDec['word/document.xml']);
  assert.ok(docXmlDec.includes('Claire Dubois'), 'Le nom de l’élève Claire Dubois doit être présent dans le document.xml officiel');

  // Déclenchement via JR_HANDLERS h85 (fin d'année)
  await context.JR_HANDLERS['h85'].fn();
  assert.equal(context.__lastDownloadName, "PIA - Claire Dubois - fin d'année 2027.docx", 'Le nom du fichier de fin d’année doit contenir « Nom Prénom »');
  const blobBufFin = await context.__lastBlob.arrayBuffer();
  const bytesFin = new Uint8Array(blobBufFin);
  assert.ok(bytesFin.length > 50000, 'Le flux binaire de fin d’année doit être un DOCX généré');
  const entriesFin = await unzipEntries(bytesFin.buffer.slice(bytesFin.byteOffset, bytesFin.byteOffset + bytesFin.byteLength));
  const docXmlFin = new TextDecoder('utf-8').decode(entriesFin['word/document.xml']);
  assert.ok(docXmlFin.includes('Claire Dubois'), 'Le nom de l’élève doit être présent dans le document.xml officiel de fin d’année');
});
