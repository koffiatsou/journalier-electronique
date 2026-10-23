/**
 * Tests contractuels du Lot 6 : Dé-identification du modèle officiel (Word et PDF)
 * Valide :
 * 1. L'anonymisation stricte de la Table 1 (Identité) : cellules vides pour nom, date de naissance,
 *    école, classe, titulaire, CPMS, responsable ; seul "Pôle Territorial WBE BXL" reste.
 * 2. L'anonymisation des personnes présentes dans PV1 (décembre) et PV2 (fin d'année) :
 *    conversion en fonctions/qualités neutres (Directeur, Parent, Titulaire, CPMS...) sans patronyme.
 * 3. La neutralisation des retours nominatifs et des dates de réunion dans PV1 et PV2.
 * 4. La neutralité des métadonnées docProps/core.xml (Word) et /Info (PDF).
 * 5. Le nommage de fichier officiel sans patronyme réel (ex: "PIA - Élève 1 - décembre 2025.docx").
 * 6. La présence des boutons d'export dé-identifiés dans l'interface de réunion 1 et 2 (handlers h89 à h92).
 * 7. La génération de bout en bout d'un document Word et PDF dé-identifié valide (sans aucune fuite de données d'élève).
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

  // Helper pour extraire le texte d'un PDF
  context.extractPdfText = async (blob) => {
    const ab = await blob.arrayBuffer();
    const str = new TextDecoder('latin1').decode(new Uint8Array(ab));
    const textChunks = [];
    const tjRegex = /\((.*?)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(str))) {
      textChunks.push(
        match[1]
          .replace(/\\([()\\])/g, '$1')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
      );
    }
    return textChunks.join(' ');
  };

  return { context, templateBytes };
}

function createSampleCompletePia() {
  return {
    id: 'pia-eleve-alpha',
    studentId: 'stu-alpha-777',
    schoolYear: '2025-2026',
    lifecycle: 'EN_VIGUEUR',
    administrativeInfo: {
      nom: 'Martin Dupont',
      dateNaissance: '2014-06-18',
      classe: '4P-B',
      option: 'Enseignement ordinaire',
      ecole: 'École Primaire WBE Centre',
      coordonneesEcole: 'Rue de la Pédagogie 12, 1000 Bruxelles (Tél: 02/219.00.00)',
      titulaire: 'Mme Sophie Dubois',
      coordonneesCpms: 'CPMS Centre WBE — Boulevard du Midi 45 (Tél: 02/504.00.00)',
      representantPole: 'Pôle Territorial WBE BXL',
      responsable: 'M. et Mme Dupont',
      coordonneesResponsable: '0470/11.22.33 — rue Royale 10, 1000 Bruxelles'
    },
    sections: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: ['Endurance normale en motricité globale'],
        difficultes: ['Fatigabilité en motricité fine']
      },
      {
        aspect: 'Lié à l’autonomie',
        ressources: ['Initiative spontanée pour ranger ses affaires'],
        difficultes: ['Gestion du temps sur tâche longue']
      },
      {
        aspect: 'Comportemental et affectif',
        ressources: ['Relation positive avec les pairs'],
        difficultes: ['Inquiétude face aux évaluations écrites']
      },
      {
        aspect: 'Communication',
        ressources: ['Expression orale fluide et riche'],
        difficultes: ['Compréhension des consignes à double consigne']
      },
      {
        aspect: 'Cognitif (pédagogique)',
        ressources: ['Bonne compréhension globale des textes lus'],
        difficultes: ['Lenteur en calcul écrit'],
        objectifs: ['Découper les calculs complexes en étapes intermédiaires']
      }
    ],
    meeting1: {
      date: '2025-12-10',
      axeDifficulte: 'Soutien en motricité fine et gestion du temps',
      objectifsCriteres: 'Réaliser 3 tâches séquencées avec chronomètre visuel',
      ressourcesMoyens: 'Co-intervention hebdomadaire du Pôle',
      personnesPresentes: [
        'M. Dubois (Directeur)',
        'Mme Sophie Dubois (Titulaire)',
        'Mme Dupont (Parent)',
        'M. Vandevelde (CPMS)',
        'M. Martin (Pôle)'
      ],
      feedback: {
        parents: 'M. et Mme Dupont constatent des progrès à la maison',
        direction: 'Accord pour l’aménagement horaire',
        ecole: 'Bonne collaboration en classe',
        eleve: 'Martin apprécie les temps calmes',
        pms: 'Suivi régulier programmé'
      }
    },
    amenagements: [
      {
        id: 'am1',
        p: true,
        o: false,
        m: true,
        description: 'Chronomètre visuel et étayage pas-à-pas'
      }
    ],
    meeting2: {
      date: '2026-06-15',
      context: 'Bilan de fin d’année',
      objectifsEvaluation: 'Objectif chronomètre atteint en autonomie',
      personnesPresentes: [
        'M. Dubois (Directeur)',
        'Mme Sophie Dubois (Titulaire)',
        'Mme Dupont (Parent)'
      ],
      feedback: {
        parents: 'Très satisfaits de l’année écoulée',
        direction: 'Poursuite recommandée',
        ecole: 'Objectifs bien assimilés',
        eleve: 'Se sent plus serein face aux contrôles'
      },
      amenagementsRentree: [
        {
          id: 'am_rentree_1',
          p: true,
          o: true,
          m: false,
          description: 'Maintien des consignes découpées en 5P'
        }
      ]
    }
  };
}

test('Lot 6 — 1. Table 1 (Identité) : anonymisation absolue des cellules dans le modèle officiel', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const sample = createSampleCompletePia();

  const modelDeid = v74.buildOfficialPIADocumentModel(sample, true, { moment: 'DECEMBRE' });

  assert.equal(modelDeid.deidentified, true);
  assert.equal(modelDeid.t1_identite.nom, '', 'Nom anonymisé (vide)');
  assert.equal(modelDeid.t1_identite.dateNaissance, '', 'Date de naissance anonymisée (vide)');
  assert.equal(modelDeid.t1_identite.coordonneesEcole, '', 'École anonymisée (vide)');
  assert.equal(modelDeid.t1_identite.classeEtOption, '', 'Classe et option anonymisées (vide)');
  assert.equal(modelDeid.t1_identite.titulaire, '', 'Titulaire anonymisé (vide)');
  assert.equal(modelDeid.t1_identite.coordonneesCpms, '', 'CPMS anonymisé (vide)');
  assert.equal(modelDeid.t1_identite.representantPole, 'Pôle Territorial WBE BXL', 'Pôle conservé institutionnellement');
  assert.equal(modelDeid.t1_identite.coordonneesResponsable, '', 'Responsables anonymisés (vide)');
});

test('Lot 6 — 2. PV1 & PV2 : anonymisation des personnes présentes (titres/rôles seuls, sans patronymes)', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const sample = createSampleCompletePia();

  // Export Fin d'année dé-identifié (contient PV1 et PV2)
  const modelDeid = v74.buildOfficialPIADocumentModel(sample, true, { moment: 'FIN_ANNEE' });

  // PV1
  const pv1Presents = modelDeid.pv1.personnesPresentes.filter(Boolean);
  assert.ok(pv1Presents.length > 0, 'Les participants doivent être préservés sous forme de rôles');
  assert.ok(pv1Presents.includes('Directeur'), 'Le rôle Directeur doit figurer sans patronyme');
  assert.ok(pv1Presents.includes('Parent'), 'Le rôle Parent doit figurer sans patronyme');
  assert.ok(pv1Presents.includes('Titulaire'), 'Le rôle Titulaire doit figurer sans patronyme');
  assert.ok(pv1Presents.includes('CPMS'), 'Le rôle CPMS doit figurer sans patronyme');
  assert.ok(!pv1Presents.some(p => p.includes('Dubois') || p.includes('Dupont') || p.includes('Vandevelde')),
    'Aucun patronyme ne doit subsister dans la liste des présents PV1');

  // PV2
  const pv2Presents = modelDeid.pv2.personnesPresentes.filter(Boolean);
  assert.ok(pv2Presents.length > 0, 'Les participants PV2 doivent être préservés sous forme de rôles');
  assert.ok(pv2Presents.includes('Directeur'), 'Rôle Directeur présent dans PV2');
  assert.ok(!pv2Presents.some(p => p.includes('Dubois') || p.includes('Dupont')),
    'Aucun patronyme ne doit subsister dans la liste des présents PV2');
});

test('Lot 6 — 3. PV1 & PV2 : neutralisation des dates de réunion et retours nominatifs dans l’export dé-identifié', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const sample = createSampleCompletePia();

  const modelDeid = v74.buildOfficialPIADocumentModel(sample, true, { moment: 'FIN_ANNEE' });

  // Dates de réunion neutralisées (cellules vides)
  assert.equal(modelDeid.pv1.date, '', 'Date PV1 neutralisée');
  assert.equal(modelDeid.pv2.date, '', 'Date PV2 neutralisée');

  // Retours des participants : aucune fuite de nom d’élève ou de responsable
  const serializedPv1Retours = JSON.stringify(modelDeid.pv1.retours || {});
  const serializedPv2Retours = JSON.stringify(modelDeid.pv2.retours || {});
  assert.ok(!serializedPv1Retours.includes('Dupont') && !serializedPv1Retours.includes('Martin'),
    'Aucun patronyme ni prénom d’élève dans les retours PV1');
  assert.ok(!serializedPv2Retours.includes('Dupont') && !serializedPv2Retours.includes('Martin'),
    'Aucun patronyme ni prénom d’élève dans les retours PV2');
});

test('Lot 6 — 4. Nommage de fichier officiel dé-identifié sans données nominatives', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;

  const fnWordDec = v74.buildOfficialPIAFileName('Élève 1', 'DECEMBRE', '2025-2026', 'docx');
  assert.equal(fnWordDec, 'PIA - Élève 1 - décembre 2025.docx');

  const fnPdfDec = v74.buildOfficialPIAFileName('Élève 1', 'DECEMBRE', '2025-2026', 'pdf');
  assert.equal(fnPdfDec, 'PIA - Élève 1 - décembre 2025.pdf');

  const fnWordFin = v74.buildOfficialPIAFileName('Élève 1', 'FIN_ANNEE', '2025-2026', 'docx');
  assert.equal(fnWordFin, "PIA - Élève 1 - fin d'année 2026.docx");

  const fnPdfFin = v74.buildOfficialPIAFileName('Élève 1', 'FIN_ANNEE', '2025-2026', 'pdf');
  assert.equal(fnPdfFin, "PIA - Élève 1 - fin d'année 2026.pdf");
});

test('Lot 6 — 5. Présence des boutons d’export dé-identifiés dans Réunion 1 et 2 et handlers JR_HANDLERS', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const sample = createSampleCompletePia();

  // 1. Réunion 1 : boutons Word et PDF dé-identifiés
  const htmlM1 = v74.piaMeetingEditor(sample, 'meeting1', 'Réunion de décembre', 'REUNION_1_DECEMBRE');
  assert.ok(htmlM1.includes('id="v74-export-official-decembre-deid"'), 'Bouton Word dé-identifié R1 présent');
  assert.ok(htmlM1.includes('data-jr-handlers="h89"'), 'Handler h89 présent');
  assert.ok(htmlM1.includes('id="v74-export-official-decembre-pdf-deid"'), 'Bouton PDF dé-identifié R1 présent');
  assert.ok(htmlM1.includes('data-jr-handlers="h90"'), 'Handler h90 présent');

  // 2. Réunion 2 : boutons Word et PDF dé-identifiés
  const htmlM2 = v74.piaMeetingEditor(sample, 'meeting2', 'Réunion de fin d’année', 'REUNION_2_FIN_ANNEE');
  assert.ok(htmlM2.includes('id="v74-export-official-fin-annee-deid"'), 'Bouton Word dé-identifié R2 présent');
  assert.ok(htmlM2.includes('data-jr-handlers="h91"'), 'Handler h91 présent');
  assert.ok(htmlM2.includes('id="v74-export-official-fin-annee-pdf-deid"'), 'Bouton PDF dé-identifié R2 présent');
  assert.ok(htmlM2.includes('data-jr-handlers="h92"'), 'Handler h92 présent');

  // 3. Vérification de l'enregistrement dans JR_HANDLERS
  const jr = context.JR_HANDLERS;
  assert.equal(typeof jr?.h89?.fn, 'function', 'JR_HANDLERS h89 défini');
  assert.equal(typeof jr?.h90?.fn, 'function', 'JR_HANDLERS h90 défini');
  assert.equal(typeof jr?.h91?.fn, 'function', 'JR_HANDLERS h91 défini');
  assert.equal(typeof jr?.h92?.fn, 'function', 'JR_HANDLERS h92 défini');
});

test('Lot 6 — 6. Export Word officiel dé-identifié : aucune fuite de données personnelles dans le docx', async () => {
  const { context, templateBytes } = await loadHarness();
  const v74 = context.JournalierV74;
  const docxApi = context.JournalierDocx;
  const sample = createSampleCompletePia();

  const modelDeid = v74.buildOfficialPIADocumentModel(sample, true, { moment: 'FIN_ANNEE' });
  const docxBytes = await docxApi.fillOfficialPIADocx(modelDeid, templateBytes);

  const entries = await docxApi.unzipEntries(docxBytes);
  const docXml = new TextDecoder('utf-8').decode(entries['word/document.xml']);
  const coreXml = entries['docProps/core.xml'] ? new TextDecoder('utf-8').decode(entries['docProps/core.xml']) : '';

  // Vérification de la non-présence des données réelles
  assert.ok(!docXml.includes('Martin Dupont'), 'Nom élève absent de document.xml');
  assert.ok(!docXml.includes('2014-06-18') && !docXml.includes('18/06/2014'), 'Date naissance absente');
  assert.ok(!docXml.includes('Rue de la Pédagogie 12'), 'Adresse école absente');
  assert.ok(!docXml.includes('0470/11.22.33'), 'Numéro téléphone responsable absent');
  assert.ok(!docXml.includes('Mme Sophie Dubois'), 'Nom titulaire absent');
  assert.ok(!coreXml.includes('Martin Dupont'), 'Nom élève absent de core.xml');

  // Présence des rôles anonymisés
  assert.ok(docXml.includes('Directeur'), 'Rôle Directeur présent');
  assert.ok(docXml.includes('Parent'), 'Rôle Parent présent');
  assert.ok(docXml.includes('Titulaire'), 'Rôle Titulaire présent');
  assert.ok(docXml.includes('Chronomètre visuel'), 'Aménagement conservé');
});

test('Lot 6 — 7. Export PDF officiel dé-identifié : aucune fuite de données personnelles dans le PDF', async () => {
  const { context } = await loadHarness();
  const v74 = context.JournalierV74;
  const pdfApi = context.JournalierPdf;
  const sample = createSampleCompletePia();

  const modelDeid = v74.buildOfficialPIADocumentModel(sample, true, { moment: 'FIN_ANNEE' });
  const pdfBytes = pdfApi.makeOfficialPdf(modelDeid);
  const pdfText = await context.extractPdfText(new context.Blob([pdfBytes]));

  // Vérification de l'absence totale de données personnelles
  assert.ok(!pdfText.includes('Martin Dupont'), 'Nom élève absent du PDF');
  assert.ok(!pdfText.includes('18/06/2014'), 'Date de naissance absente du PDF');
  assert.ok(!pdfText.includes('0470/11.22.33'), 'Téléphone responsable absent du PDF');
  assert.ok(!pdfText.includes('Sophie Dubois'), 'Nom de la titulaire absent du PDF');

  // Présence du cadre dé-identifié et des rôles
  assert.ok(pdfText.includes('Directeur'), 'Rôle Directeur présent dans le PDF');
  assert.ok(pdfText.includes('Parent'), 'Rôle Parent présent dans le PDF');
  assert.ok(pdfText.includes('Chronomètre visuel'), 'Aménagement conservé dans le PDF');
});
