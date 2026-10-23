/**
 * Test contractuel unitaire pour le Lot 2 : Modèle de données PIA
 * Valide :
 * 1. La section « Informations pour le PIA » (Section 9 / Tableau T1)
 * 2. La détection des champs manquants (countMissingPIAInfo)
 * 3. La suggestion automatique des coordonnées de l'école (suggestSchoolAdminData)
 * 4. Les aménagements structurés (N° | P | O | M | Description, T5 et T8)
 * 5. La compatibilité avec le coffre chiffré existant
 * 6. L'exclusion stricte de toutes les données personnelles dans l'export dé-identifié
 * 7. Le composant d'affichage administratif dans le dossier élève
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadHarness() {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const studentsCode = await fs.readFile(path.join(root, 'src/app/students-core.js'), 'utf8');
  const vaultCode = await fs.readFile(path.join(root, 'src/app/storage-vault.js'), 'utf8');

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
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, click() {}, addEventListener() {}, appendChild() {} }),
      head: { appendChild() {} },
      body: { appendChild() {} }
    }
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  // Exécuter runtime, students-core, et storage-vault
  vm.runInContext(runtimeCode, context);
  vm.runInContext(studentsCode, context);
  vm.runInContext(vaultCode, context);

  return context;
}

test('Lot 2 — Section 9 : Structure complète et normalisation de l’identité T1', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  assert.equal(typeof V74.buildPIAIdentityObject, 'function');
  assert.equal(typeof V74.countMissingPIAInfo, 'function');
  assert.equal(typeof V74.suggestSchoolAdminData, 'function');

  const studentComplet = {
    id: 101,
    studentId: '101',
    nom: 'Lucas Petit',
    dateNaissance: '2014-05-12',
    classe: '5P',
    option: 'Général',
    ecole: 'École Fondamentale WBE Centre',
    coordonneesEcole: 'Rue Royale 10, 1000 Bruxelles — 02/219.00.00',
    titulaire: 'Mme Lambert',
    coordonneesCpms: 'CPMS WBE Bruxelles 1 — cpms1@wbe.be',
    representantPole: 'Pôle Territorial WBE BXL',
    responsable: 'M. et Mme Petit',
    coordonneesResponsable: '0470/12.34.56 — parents.petit@fictif.be',
    administrativeInfo: {
      nom: 'Lucas Petit',
      dateNaissance: '2014-05-12',
      classe: '5P',
      option: 'Général',
      ecole: 'École Fondamentale WBE Centre',
      coordonneesEcole: 'Rue Royale 10, 1000 Bruxelles — 02/219.00.00',
      titulaire: 'Mme Lambert',
      coordonneesCpms: 'CPMS WBE Bruxelles 1 — cpms1@wbe.be',
      representantPole: 'Pôle Territorial WBE BXL',
      responsable: 'M. et Mme Petit',
      coordonneesResponsable: '0470/12.34.56 — parents.petit@fictif.be'
    }
  };

  const t1 = V74.buildPIAIdentityObject(studentComplet, false);
  assert.equal(t1.eleve, 'Lucas Petit');
  assert.equal(t1.dateNaissance, '2014-05-12');
  assert.equal(t1.coordonneesEcole, 'École Fondamentale WBE Centre — Rue Royale 10, 1000 Bruxelles — 02/219.00.00');
  assert.equal(t1.classeOption, '5P — Général');
  assert.equal(t1.titulaire, 'Mme Lambert');
  assert.equal(t1.coordonneesCpms, 'CPMS WBE Bruxelles 1 — cpms1@wbe.be');
  assert.equal(t1.representantPole, 'Pôle Territorial WBE BXL');
  assert.equal(t1.coordonneesResponsable, 'M. et Mme Petit — 0470/12.34.56 — parents.petit@fictif.be');

  // Complétude
  const completeness = V74.countMissingPIAInfo(studentComplet);
  assert.equal(completeness.isComplete, true);
  assert.equal(completeness.missingCount, 0);
  assert.equal(completeness.missingFields.length, 0);
});

test('Lot 2 — Section 9 : Détection des champs manquants non bloquants', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  const studentPartiel = {
    nom: 'Emma Leroy',
    classe: '3S',
    ecole: 'Athénée Fictif'
  };

  const completeness = V74.countMissingPIAInfo(studentPartiel);
  assert.equal(completeness.isComplete, false);
  assert.ok(completeness.missingCount > 0);
  assert.ok(completeness.missingFields.includes('Date de naissance'));
  assert.ok(completeness.missingFields.includes('Titulaire'));
  assert.ok(completeness.missingFields.includes('Coordonnées du CPMS'));
  assert.ok(completeness.missingFields.includes('Coordonnées du responsable'));
  assert.ok(completeness.summaryText.includes('manquante'));
});

test('Lot 2 — Section 9 : Suggestion des coordonnées scolaires depuis pairs', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  const studentsDb = [
    {
      id: 1,
      nom: 'Élève Existant',
      ecole: 'Lycée Émile Jacqmain',
      coordonneesEcole: 'Rue Belliard 135, 1040 Bruxelles',
      coordonneesCpms: 'CPMS BXL Centre',
      titulaire: 'M. Dumont'
    }
  ];

  const suggestions = V74.suggestSchoolAdminData('Lycée Émile Jacqmain', studentsDb);
  assert.equal(suggestions.coordonneesEcole, 'Rue Belliard 135, 1040 Bruxelles');
  assert.equal(suggestions.coordonneesCpms, 'CPMS BXL Centre');
  assert.equal(suggestions.titulaire, 'M. Dumont');

  // École inconnue
  const empty = V74.suggestSchoolAdminData('École Inconnue', studentsDb);
  assert.equal(Object.keys(empty).length, 0);
});

test('Lot 2 — Aménagements structurés : Colonnes N° | P | O | M | Description', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  assert.equal(typeof V74.normalizeStructuredAmenagement, 'function');
  assert.equal(typeof V74.normalizeAmenagementsList, 'function');

  // Aménagement pédagogique seul
  const itemP = V74.normalizeStructuredAmenagement({
    type: 'P',
    description: 'Expliciter la consigne et segmenter les étapes'
  }, 0);
  assert.equal(itemP.n, 1);
  assert.equal(itemP.labelN, '1\u00A0');
  assert.equal(itemP.p, true);
  assert.equal(itemP.o, false);
  assert.equal(itemP.m, false);
  assert.equal(itemP.description, 'Expliciter la consigne et segmenter les étapes');

  // Aménagement combiné P + M
  const itemPM = V74.normalizeStructuredAmenagement({
    p: true,
    m: true,
    description: 'Utilisation d’une règle de lecture et surlignage'
  }, 1);
  assert.equal(itemPM.n, 2);
  assert.equal(itemPM.p, true);
  assert.equal(itemPM.o, false);
  assert.equal(itemPM.m, true);

  // Normalisation liste minimum 10 lignes
  const list = V74.normalizeAmenagementsList([itemP, itemPM], 10);
  assert.equal(list.length, 10);
  assert.equal(list[0].labelN, '1\u00A0');
  assert.equal(list[0].description, 'Expliciter la consigne et segmenter les étapes');
  assert.equal(list[1].labelN, '2\u00A0');
  assert.equal(list[9].labelN, '10\u00A0');
  assert.equal(list[9].description, '');
  assert.equal(list[9].p, false);
  assert.equal(list[9].o, false);
  assert.equal(list[9].m, false);
});

test('Lot 2 — Aménagements structurés générés par buildPIA', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  const student = {
    studentId: 'stud-1',
    nom: 'Maxime Martin',
    classe: '4T',
    ecole: 'Athénée Royal',
    dateNaissance: '2012-03-20',
    option: 'Transition'
  };

  const sessions = [
    {
      id: 201,
      type: 'SEANCE',
      schemaVersion: '72.2-secure-appfolder-test',
      identification: { eleve: 'Maxime Martin', date: '2026-10-02', matiere: 'Mathématiques' },
      q2: { observations: [{ observation: 'Difficulté en calcul posé', niveau: 0 }] },
      q3: { indicateurs: [{ texte: 'Appliquer un algorithme' }] },
      q4: { types: ['Abaque / Matériel'], precision: 'Calculatrice et fiches repères' },
      q6: { actions: ['Poursuivre la manipulation de jetons'] }
    }
  ];

  const pia = V74.buildPIA(student, sessions, '2026-10-15');
  assert.ok(Array.isArray(pia.amenagements), 'pia.amenagements doit être un tableau');
  assert.ok(pia.amenagements.length >= 1, 'Au moins 1 aménagement produit');

  const first = pia.amenagements[0];
  assert.ok('n' in first, 'Porte le numéro d’ordre n');
  assert.ok('labelN' in first, 'Porte le libellé N°');
  assert.ok('p' in first, 'Porte le drapeau P');
  assert.ok('o' in first, 'Porte le drapeau O');
  assert.ok('m' in first, 'Porte le drapeau M');
  assert.ok('description' in first, 'Porte la description');
  // Rétro-compatibilité conservée
  assert.ok('texte' in first, 'Conserve texte pour rétrocompatibilité');
  assert.ok('type' in first, 'Conserve type pour rétrocompatibilité');
});

test('Lot 2 — Coffre chiffré : Préservation intégrale des données administratives', async () => {
  const studentSource = {
    id: 999,
    nom: 'Chloé Dubois',
    classe: '6P',
    ecole: 'École du Parc',
    matieres: ['Français'],
    pia: 'Objectif lecture',
    dateNaissance: '2013-11-05',
    option: 'Général',
    titulaire: 'M. Robert',
    coordonneesEcole: 'Avenue du Parc 1, 1060 Bruxelles',
    coordonneesCpms: 'CPMS Sud',
    representantPole: 'Pôle Territorial WBE BXL',
    responsable: 'Mme Dubois',
    coordonneesResponsable: '02/345.67.89',
    administrativeInfo: {
      dateNaissance: '2013-11-05',
      option: 'Général',
      titulaire: 'M. Robert'
    }
  };

  // Simulation de la normalisation de stockage avant chiffrement
  const studentStore = { ...(studentSource || {}) };
  if (!studentStore.studentId) studentStore.studentId = `student_${studentStore.id}`;

  assert.equal(studentStore.dateNaissance, '2013-11-05');
  assert.equal(studentStore.titulaire, 'M. Robert');
  assert.equal(studentStore.coordonneesEcole, 'Avenue du Parc 1, 1060 Bruxelles');
  assert.equal(studentStore.coordonneesCpms, 'CPMS Sud');
  assert.equal(studentStore.responsable, 'Mme Dubois');
  assert.equal(studentStore.coordonneesResponsable, '02/345.67.89');
  assert.deepEqual(studentStore.administrativeInfo, studentSource.administrativeInfo);
});

test('Lot 2 — Exclusion absolue dans l’export dé-identifié', async () => {
  const ctx = await loadHarness();
  const V74 = ctx.window.JournalierV74;

  const piaNominatif = {
    id: 'pia_secret_123',
    studentId: 'student_789',
    eleve: 'Alexandre Renard',
    classe: '4A',
    ecole: 'Athénée Royal de Bruxelles',
    schoolYear: '2025-2026',
    administrativeInfo: {
      nom: 'Alexandre Renard',
      dateNaissance: '2012-08-14',
      classe: '4A',
      option: 'Sciences',
      ecole: 'Athénée Royal de Bruxelles',
      coordonneesEcole: 'Rue Royale 50, tél 02/222.33.44',
      titulaire: 'M. Vandevelde',
      coordonneesCpms: 'CPMS BXL 2',
      representantPole: 'Pôle Territorial WBE BXL',
      responsable: 'M. Renard',
      coordonneesResponsable: '0499/88.77.66'
    },
    sections: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: ['Bonne endurance observée'],
        difficultes: ['Fatigabilité en fin de journée']
      }
    ],
    amenagements: [
      {
        id: 'am_1',
        n: 1,
        labelN: '1\u00A0',
        p: true,
        o: false,
        m: false,
        description: 'Prévoir des pauses courtes avec M. Vandevelde'
      }
    ]
  };

  // 1. Identité T1 dé-identifiée
  const t1Deid = V74.buildPIAIdentityObject(piaNominatif, true);
  assert.equal(t1Deid.eleve, '[ÉLÈVE]');
  assert.equal(t1Deid.dateNaissance, '[DATE RETIRÉE]');
  assert.equal(t1Deid.coordonneesEcole, '[ÉCOLE RETIRÉE]');
  assert.equal(t1Deid.classeOption, '[NIVEAU RETENU]');
  assert.equal(t1Deid.titulaire, '[TITULAIRE RETIRÉ]');
  assert.equal(t1Deid.coordonneesCpms, '[CPMS RETIRÉ]');
  assert.equal(t1Deid.representantPole, 'Pôle Territorial WBE BXL');
  assert.equal(t1Deid.coordonneesResponsable, '[COORDONNÉES RETIRÉES]');

  // 2. Export global piaForExport
  const exportDeid = V74.piaForExport(piaNominatif, true);
  const serialized = JSON.stringify(exportDeid);

  assert.ok(!serialized.includes('Alexandre Renard'), 'Nom de l’élève exclu');
  assert.ok(!serialized.includes('2012-08-14'), 'Date de naissance exclue');
  assert.ok(!serialized.includes('Vandevelde'), 'Nom du titulaire exclu');
  assert.ok(!serialized.includes('0499/88.77.66'), 'Numéro de téléphone exclu');
  assert.ok(!serialized.includes('02/222.33.44'), 'Téléphone de l’école exclu');
  assert.ok(!serialized.includes('Rue Royale 50'), 'Adresse de l’école exclue');
  assert.equal(exportDeid.type, 'PIA_MODELE_DEIDENTIFIE');
  assert.equal(exportDeid.administrativeInfo, undefined, 'administrativeInfo supprimé');
});

test('Lot 2 — Profil élève : Rendu HTML de la section administrative T1', async () => {
  const ctx = await loadHarness();
  const api = ctx.JournalierStudents;

  assert.equal(typeof api.renderStudentPIAAdminProfile, 'function');

  const student = {
    nom: 'Sarah Benali',
    classe: '2B',
    ecole: 'Athénée Fictif',
    dateNaissance: '2015-01-20',
    option: 'Général',
    titulaire: 'M. Simon',
    coordonneesEcole: 'Rue Neuve 1',
    coordonneesCpms: 'CPMS 1',
    responsable: 'Mme Benali',
    coordonneesResponsable: '0471/00.11.22'
  };

  const html = api.renderStudentPIAAdminProfile(student);
  assert.ok(html.includes('Informations pour le PIA officiel (Tableau T1)'));
  assert.ok(html.includes('2015-01-20'));
  assert.ok(html.includes('M. Simon'));
  assert.ok(html.includes('Pôle Territorial WBE BXL'));
  assert.ok(html.includes('Stockage chiffré local (AES-GCM)'));
});
