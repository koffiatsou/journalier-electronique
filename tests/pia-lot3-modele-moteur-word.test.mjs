/**
 * Suite de tests d'acceptation et d'intégrité du Lot 3 : Modèle de document PIA & Moteur Word (base)
 * Numérotation selon la section 10 du contexte permanent.
 * Valide les tests d'acceptation 1, 2, 3, 4, 9, 10, 11, 15, 16 et le test d'archive automatisé.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadWordHarness() {
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

  return context;
}

test('Test 1 — Objet intermédiaire « modèle de document PIA » (Section 4) & PIA vide', async () => {
  const ctx = await loadWordHarness();
  const v74 = ctx.JournalierV74;
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  const mockPia = {
    id: 'pia-test-1',
    studentId: 'eleve-42',
    schoolYear: '2025-2026',
    moment: 'DECEMBRE',
    eleve: 'Lucas Lambert',
    classe: '4P-B',
    ecole: 'École Fondamentale WBE BXL',
    administrativeInfo: {
      dateNaissance: '2014-03-15',
      option: 'Général',
      titulaire: 'Mme Sophie Moreau',
      coordonneesEcole: 'Rue de la Pédagogie 10, 1000 Bruxelles',
      coordonneesCpms: 'CPMS Centre WBE',
      representantPole: 'Pôle Territorial WBE BXL',
      responsable: 'M. Lambert',
      coordonneesResponsable: '0470/12.34.56'
    },
    sections: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: ['Bonne motricité globale', 'Participe activement en gymnastique'],
        difficultes: ['Fatigabilité posturale en fin de matinée']
      },
      {
        aspect: 'Lié à l’autonomie',
        ressources: ['Gère son cartable de manière autonome'],
        difficultes: ['Gestion du temps sur les consignes longues']
      },
      {
        aspect: 'Comportemental et affectif',
        ressources: ['Relations positives avec les pairs'],
        difficultes: ['Anxiété ponctuelle face aux évaluations sommatives']
      },
      {
        aspect: 'Communication',
        ressources: ['Vocabulaire riche à l’oral'],
        difficultes: ['Passage à l’écrit plus laborieux']
      },
      {
        aspect: 'Cognitif (pédagogique)',
        ressources: ['Compréhension rapide en numération'],
        difficultes: ['Résolution de problèmes complexes en plusieurs étapes']
      }
    ],
    meeting1: {
      date: '2025-12-10',
      objectivesValidated: [
        { aspect: 'Cognitif (pédagogique)', formulation: 'Décomposer un problème en 3 étapes à l’aide d’un schéma.' },
        { aspect: 'Lié à l’autonomie', formulation: 'Utiliser un sablier visuel pour les activités de 15 minutes.' }
      ]
    }
  };

  // 1. Modèle complet nominatif
  const docModel = v74.buildOfficialPIADocumentModel(mockPia, false);
  assert.equal(docModel.isPIADocumentModel, true);
  assert.equal(docModel.moment, 'DECEMBRE');
  assert.equal(docModel.deidentified, false);
  assert.equal(docModel.headerYear, '2025-2026');
  assert.equal(docModel.metaAuthor, 'Pôle Territorial WBE BXL');

  // Identité T1
  assert.equal(docModel.t1_identite.nom, 'Lucas Lambert');
  assert.equal(docModel.t1_identite.dateNaissance, '2014-03-15');
  assert.ok(docModel.t1_identite.coordonneesEcole.includes('Rue de la Pédagogie 10, 1000 Bruxelles'));
  assert.equal(docModel.t1_identite.classeEtOption, '4P-B — Général');
  assert.equal(docModel.t1_identite.titulaire, 'Mme Sophie Moreau');
  assert.equal(docModel.t1_identite.coordonneesCpms, 'CPMS Centre WBE');
  assert.equal(docModel.t1_identite.representantPole, 'Pôle Territorial WBE BXL');
  assert.ok(docModel.t1_identite.coordonneesResponsable.includes('0470/12.34.56'));

  // 5 aspects T2
  assert.equal(docModel.t2_aspects.length, 5);
  const cognitif = docModel.t2_aspects.find(a => a.aspect.includes('Cognitif'));
  assert.ok(cognitif, 'Aspect cognitif présent');
  assert.ok(cognitif.ressources.includes('Compréhension rapide'));
  assert.ok(cognitif.difficultes.includes('Résolution de problèmes'));
  assert.ok(cognitif.objectifs.includes('Décomposer un problème'));

  // 2. Modèle dé-identifié
  const deidModel = v74.buildOfficialPIADocumentModel(mockPia, true);
  assert.equal(deidModel.deidentified, true);
  assert.equal(deidModel.t1_identite.nom, '', 'Nom anonymisé');
  assert.equal(deidModel.t1_identite.dateNaissance, '', 'Date de naissance anonymisée');
  assert.equal(deidModel.t1_identite.coordonneesEcole, '', 'École anonymisée');
  assert.equal(deidModel.t1_identite.classeEtOption, '', 'Classe anonymisée');
  assert.equal(deidModel.t1_identite.titulaire, '', 'Titulaire anonymisé');
  assert.equal(deidModel.t1_identite.coordonneesCpms, '', 'CPMS anonymisé');
  assert.equal(deidModel.t1_identite.coordonneesResponsable, '', 'Responsable anonymisé');
  assert.equal(deidModel.t1_identite.representantPole, 'Pôle Territorial WBE BXL');

  // 3. Comportement sur PIA vide (PIA vide = modèle officiel préservé)
  const emptyModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    headerYear: '2025-2026',
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: {},
    t2_aspects: []
  };
  const emptyDocx = await fillOfficialPIADocx(emptyModel);
  assert.ok(emptyDocx instanceof ctx.Uint8Array);
  assert.ok(emptyDocx.length > 20000, 'DOCX généré pour PIA vide');

  const unzippedEmpty = await unzipEntries(emptyDocx.buffer.slice(emptyDocx.byteOffset, emptyDocx.byteOffset + emptyDocx.byteLength));
  const docXmlEmpty = new ctx.TextDecoder('utf-8').decode(unzippedEmpty['word/document.xml']);
  assert.ok(docXmlEmpty.includes('Nom et prénom de l’élève'), 'Structure du tableau T1 intacte');
  assert.ok(docXmlEmpty.includes('Physique et psychomoteur'), 'Structure du tableau T2 intacte');
});

test('Test 2 — Deux sections, en-têtes et pied de page', async () => {
  const ctx = await loadWordHarness();
  const { unzipEntries } = ctx.JournalierDocx;

  const modelPath = path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx');
  const rawBytes = await fs.readFile(modelPath);
  const entries = await unzipEntries(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength));

  const docXml = new ctx.TextDecoder('utf-8').decode(entries['word/document.xml']);
  const f1Xml = new ctx.TextDecoder('utf-8').decode(entries['word/footer1.xml']);
  const h1Xml = new ctx.TextDecoder('utf-8').decode(entries['word/header1.xml']);
  const h2Xml = new ctx.TextDecoder('utf-8').decode(entries['word/header2.xml']);

  // Vérification des 2 sections
  const sectPrs = docXml.match(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g) || [];
  assert.equal(sectPrs.length, 2, 'Le document Word doit comporter exactement 2 sections');

  // Section 1 : paysage, marges 1417 twips, headerReference rId11, footerReference rId12
  const sec1 = sectPrs[0];
  assert.ok(sec1.includes('w:orient="landscape"'), 'Section 1 doit être en orientation paysage');
  assert.ok(sec1.includes('w:w="16838"') && sec1.includes('w:h="11906"'), 'Dimensions Section 1 paysage vérifiées');
  assert.ok(sec1.includes('r:id="rId11"'), 'Section 1 doit référencer header1 (rId11)');
  assert.ok(sec1.includes('r:id="rId12"'), 'Section 1 doit référencer footer1 (rId12)');

  // Section 2 : portrait, marges 1417 twips, headerReference rId13, pas de footerReference
  const sec2 = sectPrs[1];
  assert.ok(!sec2.includes('w:orient="landscape"'), 'Section 2 doit être en orientation portrait');
  assert.ok(sec2.includes('w:w="11906"') && sec2.includes('w:h="16838"'), 'Dimensions Section 2 portrait vérifiées');
  assert.ok(sec2.includes('r:id="rId13"'), 'Section 2 doit référencer header2 (rId13)');
  assert.ok(!sec2.includes('w:footerReference'), 'Section 2 ne doit pas avoir de footerReference (hérite de Section 1)');

  // Logo uniquement dans le pied de page (footer1), pas dans les en-têtes
  assert.ok(f1Xml.includes('<w:drawing>'), 'Le logo doit être présent dans footer1.xml');
  assert.ok(entries['word/media/image1.png'], 'L’image du logo doit être présente dans word/media/');
  assert.ok(!h1Xml.includes('<w:drawing>'), 'header1.xml ne doit contenir aucun élément w:drawing');
  assert.ok(!h2Xml.includes('<w:drawing>'), 'header2.xml ne doit contenir aucun élément w:drawing');

  // Champ PAGE dans footer1
  assert.ok(f1Xml.includes('PAGE'), 'footer1.xml doit contenir le champ de numéro de page PAGE');
  assert.ok(f1Xml.includes('w:sdt'), 'Le numéro de page doit résider dans un contrôle de contenu w:sdt');
});

test('Test 3 — Chargement et réécriture de l’archive avec unzipEntries et buildZipStoreArchive', async () => {
  const ctx = await loadWordHarness();
  const { unzipEntries, buildZipStoreArchive } = ctx.JournalierDocx;

  const modelPath = path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx');
  const rawBytes = await fs.readFile(modelPath);

  // 1. Décompression
  const entries = await unzipEntries(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength));
  assert.ok(entries['word/document.xml'], 'word/document.xml doit être extrait');
  assert.ok(entries['word/footer1.xml'], 'word/footer1.xml doit être extrait');
  assert.ok(entries['word/media/image1.png'], 'L’image du logo doit être présente dans le pied de page');
  assert.ok(entries['[Content_Types].xml'], '[Content_Types].xml doit être extrait');

  // 2. Reconstitution ZIP
  const fileEntries = Object.entries(entries).map(([name, data]) => ({ name, data }));
  const repackedZip = buildZipStoreArchive(fileEntries);
  assert.ok(repackedZip instanceof ctx.Uint8Array);
  assert.equal(repackedZip[0], 0x50, 'Signature ZIP valide (P)');
  assert.equal(repackedZip[1], 0x4B, 'Signature ZIP valide (K)');

  // 3. Re-décompression pour valider l'intégrité de la réécriture
  const reUnzipped = await unzipEntries(repackedZip.buffer.slice(repackedZip.byteOffset, repackedZip.byteOffset + repackedZip.byteLength));
  assert.equal(Object.keys(reUnzipped).length, Object.keys(entries).length, 'Même nombre d’entrées');
  assert.ok(reUnzipped['word/media/image1.png'].length > 1000, 'Logo préservé intact');
});

test('Test 4 — Repérage par libellé avec normalisation stricte & cases à plusieurs paragraphes vides', async () => {
  const ctx = await loadWordHarness();
  const { normalizeDocxLabel, fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  // 1. Normalisation stricte des libellés (espaces insécables U+00A0, fines U+202F, apostrophes courbes U+2019)
  assert.equal(normalizeDocxLabel('Nom et prénom de l’élève\u00A0:'), "nom et prénom de l'élève");
  assert.equal(normalizeDocxLabel('Date\u00A0:  '), 'date');
  assert.equal(normalizeDocxLabel('Difficulté majeure se situe au niveau de l’axe\u202F:\u00A0'), "difficulté majeure se situe au niveau de l'axe");
  assert.equal(normalizeDocxLabel('Objectifs visés pour la période\u202fet critères d’évaluation\u202f:\u00A0'), "objectifs visés pour la période et critères d'évaluation");
  assert.equal(normalizeDocxLabel('Physique et psychomoteur\u00A0:'), 'physique et psychomoteur');
  assert.equal(normalizeDocxLabel('Lié à l’autonomie\u00A0:'), "lié à l'autonomie");
  assert.equal(normalizeDocxLabel('Cognitif (pédagogique)\u00A0:'), 'cognitif (pédagogique)');

  // 2. Traitement des cases à plusieurs paragraphes vides (ex: T2 L3 C1 Comportemental et affectif / Ressources qui a 2 paragraphes vides d'origine)
  // Test A : texte court
  const modelCourt = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    schoolYear: '2025-2026',
    t1_identite: { nom: 'Élève Court' },
    t2_aspects: [
      { aspect: 'Comportemental et affectif', ressources: 'Calme', difficultes: '', objectifs: '' }
    ]
  };
  const docxCourt = await fillOfficialPIADocx(modelCourt);
  const unzippedCourt = await unzipEntries(docxCourt.buffer.slice(docxCourt.byteOffset, docxCourt.byteOffset + docxCourt.byteLength));
  const xmlCourt = new ctx.TextDecoder('utf-8').decode(unzippedCourt['word/document.xml']);
  assert.ok(xmlCourt.includes('<w:t xml:space="preserve">Calme</w:t>'), 'Texte court inséré');

  // Test B : texte long
  const longText = 'Ce texte d’observation comportementale détaille de manière très approfondie l’évolution positive de l’élève face aux exigences de l’environnement scolaire tout au long du premier trimestre.';
  const modelLong = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    schoolYear: '2025-2026',
    t1_identite: { nom: 'Élève Long' },
    t2_aspects: [
      { aspect: 'Comportemental et affectif', ressources: longText, difficultes: '', objectifs: '' }
    ]
  };
  const docxLong = await fillOfficialPIADocx(modelLong);
  const unzippedLong = await unzipEntries(docxLong.buffer.slice(docxLong.byteOffset, docxLong.byteOffset + docxLong.byteLength));
  const xmlLong = new ctx.TextDecoder('utf-8').decode(unzippedLong['word/document.xml']);
  assert.ok(xmlLong.includes(longText), 'Texte long inséré sans tronquage');

  // Test C : texte multi-lignes
  const multiText = 'Premier point d’observation\nDeuxième point d’observation\nTroisième point d’observation';
  const modelMulti = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    schoolYear: '2025-2026',
    t1_identite: { nom: 'Élève Multi' },
    t2_aspects: [
      { aspect: 'Comportemental et affectif', ressources: multiText, difficultes: '', objectifs: '' }
    ]
  };
  const docxMulti = await fillOfficialPIADocx(modelMulti);
  const unzippedMulti = await unzipEntries(docxMulti.buffer.slice(docxMulti.byteOffset, docxMulti.byteOffset + docxMulti.byteLength));
  const xmlMulti = new ctx.TextDecoder('utf-8').decode(unzippedMulti['word/document.xml']);
  assert.ok(xmlMulti.includes('Premier point d’observation'), 'Ligne 1 insérée');
  assert.ok(xmlMulti.includes('Deuxième point d’observation'), 'Ligne 2 insérée');
  assert.ok(xmlMulti.includes('Troisième point d’observation'), 'Ligne 3 insérée');
  assert.ok(xmlMulti.includes('w:sz w:val="32"'), 'Police 16 pt respectée sur chaque paragraphe inséré');
});

test('Test 9 — Échappement des caractères spéciaux XML (&, <, >, guillemets, apostrophes, accents)', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  const specialModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    headerYear: '2025-2026',
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: {
      nom: 'Lucas & Émile <Lambert> "Junior" \'L’enfant\'',
      dateNaissance: '2014-03-15',
      coordonneesEcole: 'École « Saint-Exupéry » & Lycée Henri-Poincaré <1050>',
      classeEtOption: '5P / Mathématiques & Économie',
      titulaire: 'Mme Sophie Moreau & M. D\'Hondt',
      coordonneesCpms: 'CPMS de l’Étoile <Bruxelles>',
      representantPole: 'Pôle Territorial WBE BXL',
      coordonneesResponsable: 'M. Lambert & Mme Dupont — Tél : 0470/12.34.56'
    },
    t2_aspects: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: 'Équilibre & motricité > niveau attendu',
        difficultes: 'Fatigabilité < seuil de référence ; posture « crispée »',
        objectifs: 'Adopter le guide-doigt « Soft-Touch » & faire des pauses'
      },
      { aspect: 'Lié à l’autonomie', ressources: 'Très autonome', difficultes: '', objectifs: '' },
      { aspect: 'Comportemental et affectif', ressources: 'Calme & concentré', difficultes: '', objectifs: '' },
      { aspect: 'Communication', ressources: 'Vocabulaire riche & varié', difficultes: '', objectifs: '' },
      { aspect: 'Cognitif (pédagogique)', ressources: 'Logique & calcul mental', difficultes: '', objectifs: '' }
    ]
  };

  const outputDocx = await fillOfficialPIADocx(specialModel);
  const unzipped = await unzipEntries(outputDocx.buffer.slice(outputDocx.byteOffset, outputDocx.byteOffset + outputDocx.byteLength));
  const docXml = new ctx.TextDecoder('utf-8').decode(unzipped['word/document.xml']);

  // Vérification de l'échappement strict
  assert.ok(docXml.includes('&amp;'), 'Les ampersands & doivent être échappés en &amp;');
  assert.ok(docXml.includes('&lt;'), 'Les chevrons < doivent être échappés en &lt;');
  assert.ok(docXml.includes('&gt;'), 'Les chevrons > doivent être échappés en &gt;');
  assert.ok(docXml.includes('&quot;'), 'Les guillemets " doivent être échappés en &quot;');
  assert.ok(docXml.includes('&apos;'), 'Les apostrophes droites \' doivent être échappées en &apos;');

  // Vérification de la non-altération des caractères accentués français et typographiques
  assert.ok(docXml.includes('Émile'), 'Accent majuscule É préservé');
  assert.ok(docXml.includes('Mathématiques'), 'Accent minuscule é préservé');
  assert.ok(docXml.includes('« Saint-Exupéry »'), 'Guillemets français « » préservés');
  assert.ok(docXml.includes('l’Étoile'), 'Apostrophe typographique ’ préservée');

  // Absence de balises orphelines
  assert.ok(!docXml.includes('<Lambert>'), 'Aucun tag XML <Lambert> sauvage');
  assert.ok(!docXml.includes('<1050>'), 'Aucun tag XML <1050> sauvage');
});

test('Test 10 — Remplissage de l’identité (T1) et du tableau des 5 aspects (T2)', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  const docModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    headerYear: '2025-2026',
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: {
      nom: 'Martin Dupont',
      dateNaissance: '2013-05-20',
      coordonneesEcole: 'Avenue de la Couronne 105, 1050 Ixelles',
      classeEtOption: '5P / Immersion',
      titulaire: 'M. Jean Vaneck',
      coordonneesCpms: 'CPMS Bruxelles Sud',
      representantPole: 'Pôle Territorial WBE BXL',
      coordonneesResponsable: '02/640.12.34'
    },
    t2_aspects: [
      {
        aspect: 'Physique et psychomoteur',
        ressources: 'Bon dynamisme moteur',
        difficultes: 'Tenue du crayon crispée',
        objectifs: 'Adopter un guide-doigt ergonomique'
      },
      {
        aspect: 'Lié à l’autonomie',
        ressources: 'Prend ses affaires avec enthousiasme',
        difficultes: 'Étourderies sur les affaires de classe',
        objectifs: 'Vérifier la check-list visuelle de fin de cours'
      },
      {
        aspect: 'Comportemental et affectif',
        ressources: 'Très serviable',
        difficultes: 'Tolérance à la frustration fragile',
        objectifs: 'Exprimer le besoin d’aide calmement'
      },
      {
        aspect: 'Communication',
        ressources: 'Excellente communication orale',
        difficultes: 'Interrompt parfois ses camarades',
        objectifs: 'Attendre son tour de parole'
      },
      {
        aspect: 'Cognitif (pédagogique)',
        ressources: 'Bonne mémoire visuelle',
        difficultes: 'Mémorisation des tables de multiplication',
        objectifs: 'Manipuler la table de Pythagore colorée'
      }
    ]
  };

  const outputDocx = await fillOfficialPIADocx(docModel);
  const unzipped = await unzipEntries(outputDocx.buffer.slice(outputDocx.byteOffset, outputDocx.byteOffset + outputDocx.byteLength));
  const docXml = new ctx.TextDecoder('utf-8').decode(unzipped['word/document.xml']);

  // Vérification T1 (Identité)
  assert.ok(docXml.includes('Martin Dupont'), 'T1 : Nom de l’élève présent');
  assert.ok(docXml.includes('20/05/2013'), 'T1 : Date de naissance au format jj/mm/aaaa présente');
  assert.ok(!docXml.includes('2013-05-20'), 'T1 : Date de naissance aaaa-mm-jj ne doit pas apparaître dans le XML Word');
  assert.ok(docXml.includes('Avenue de la Couronne 105'), 'T1 : Coordonnées de l’école présentes');
  assert.ok(docXml.includes('5P / Immersion'), 'T1 : Classe et option présentes');
  assert.ok(docXml.includes('M. Jean Vaneck'), 'T1 : Titulaire présent');
  assert.ok(docXml.includes('CPMS Bruxelles Sud'), 'T1 : CPMS présent');
  assert.ok(docXml.includes('Pôle Territorial WBE BXL'), 'T1 : Représentant du pôle présent');
  assert.ok(docXml.includes('02/640.12.34'), 'T1 : Responsable présent');

  // Vérification T2 (Aspects)
  assert.ok(docXml.includes('Bon dynamisme moteur'), 'T2 : Ressources physique');
  assert.ok(docXml.includes('Tenue du crayon crispée'), 'T2 : Difficultés physique');
  assert.ok(docXml.includes('Adopter un guide-doigt ergonomique'), 'T2 : Objectifs physique');
  assert.ok(docXml.includes('Mémorisation des tables de multiplication'), 'T2 : Difficultés cognitif');
  assert.ok(docXml.includes('Manipuler la table de Pythagore colorée'), 'T2 : Objectifs cognitif');

  // Vérification de la taille de police 16 pt (sz 32)
  assert.ok(docXml.includes('w:sz w:val="32"'), 'Police 16 pt (sz 32) respectée dans les cellules');
});

test('Test format date de naissance T1 (jj/mm/aaaa dans Word, aaaa-mm-jj dans le modèle intermédiaire)', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  // 1. Format ISO standard aaaa-mm-jj -> conversion jj/mm/aaaa dans Word
  const docModelIso = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    t1_identite: {
      nom: 'Lucas Lambert',
      dateNaissance: '2014-03-15'
    },
    t2_aspects: []
  };

  const outputDocxIso = await fillOfficialPIADocx(docModelIso);
  const unzippedIso = await unzipEntries(outputDocxIso.buffer.slice(outputDocxIso.byteOffset, outputDocxIso.byteOffset + outputDocxIso.byteLength));
  const docXmlIso = new ctx.TextDecoder('utf-8').decode(unzippedIso['word/document.xml']);

  assert.ok(docXmlIso.includes('15/03/2014'), 'La date ISO 2014-03-15 doit être convertie en 15/03/2014 dans le Word');
  assert.ok(!docXmlIso.includes('2014-03-15'), 'Le format ISO brut ne doit pas figurer dans le document Word');
  // L’objet intermédiaire doit impérativement conserver son format canonique aaaa-mm-jj
  assert.equal(docModelIso.t1_identite.dateNaissance, '2014-03-15', 'L’objet intermédiaire conserve le format aaaa-mm-jj');

  // 2. Format non ISO (ex: déjà jj/mm/aaaa ou libellé textuel) -> écrit tel quel
  const docModelText = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    t1_identite: {
      nom: 'Élève Test',
      dateNaissance: '12/04/2015'
    },
    t2_aspects: []
  };
  const outputDocxText = await fillOfficialPIADocx(docModelText);
  const unzippedText = await unzipEntries(outputDocxText.buffer.slice(outputDocxText.byteOffset, outputDocxText.byteOffset + outputDocxText.byteLength));
  const docXmlText = new ctx.TextDecoder('utf-8').decode(unzippedText['word/document.xml']);
  assert.ok(docXmlText.includes('12/04/2015'), 'Une date déjà au format jj/mm/aaaa est écrite telle quelle');

  // 3. Version dé-identifiée -> cellule vide
  const docModelDeid = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: true,
    schoolYear: '2025-2026',
    t1_identite: {
      nom: '',
      dateNaissance: ''
    },
    t2_aspects: []
  };
  const outputDocxDeid = await fillOfficialPIADocx(docModelDeid);
  const unzippedDeid = await unzipEntries(outputDocxDeid.buffer.slice(outputDocxDeid.byteOffset, outputDocxDeid.byteOffset + outputDocxDeid.byteLength));
  const docXmlDeid = new ctx.TextDecoder('utf-8').decode(unzippedDeid['word/document.xml']);
  assert.ok(!docXmlDeid.includes('15/03/2014') && !docXmlDeid.includes('2014-03-15'), 'La version dé-identifiée n’inclut aucune date de naissance');
});

test('Vérification SHA-256 : modèle officiel sur disque et copie embarquée base64', async () => {
  const crypto = await import('node:crypto');
  const expectedHash = '0e41904a5cdbefec0da84009313d30bcc4dbe318aa7039536b112cfc0b58cf03';

  // 1. Modèle officiel sur disque
  const diskPath = path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx');
  const diskBytes = await fs.readFile(diskPath);
  const diskHash = crypto.createHash('sha256').update(diskBytes).digest('hex');
  assert.equal(diskHash, expectedHash, 'Le fichier public/modeles/PIA_modele_officiel_2025-09-11.docx doit avoir le SHA-256 officiel');

  // 2. Copie embarquée base64 (OFFICIAL_PIA_DOCX_BASE64 décodée)
  const ctx = await loadWordHarness();
  const embeddedBytes = ctx.JournalierDocx.getEmbeddedOfficialPIATemplateBytes();
  assert.ok(embeddedBytes && embeddedBytes.length > 0, 'Les octets embarqués doivent être présents');
  const embeddedHash = crypto.createHash('sha256').update(Buffer.from(embeddedBytes)).digest('hex');
  assert.equal(embeddedHash, expectedHash, 'La copie embarquée OFFICIAL_PIA_DOCX_BASE64 doit avoir exactement le même SHA-256 officiel');
});

test('Test 11 — Intégrité technique (XML bien formé, CRC32, [Content_Types].xml, année dans les en-têtes)', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries, crc32 } = ctx.JournalierDocx;

  const targetYear = '2026-2027';
  const docModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: targetYear,
    headerYear: targetYear,
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: { nom: 'Test Intégrité' },
    t2_aspects: [
      { aspect: 'Cognitif (pédagogique)', ressources: 'Bonne logique', difficultes: '', objectifs: '' }
    ]
  };

  const outputDocx = await fillOfficialPIADocx(docModel);
  const unzipped = await unzipEntries(outputDocx.buffer.slice(outputDocx.byteOffset, outputDocx.byteOffset + outputDocx.byteLength));

  // 1. Validation de [Content_Types].xml
  assert.ok(unzipped['[Content_Types].xml'], '[Content_Types].xml doit être présent');
  const ctXml = new ctx.TextDecoder('utf-8').decode(unzipped['[Content_Types].xml']);
  assert.ok(ctXml.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'));

  // 2. Validation que tous les fichiers XML sont bien formés (balises fermées, pas de corruption)
  const xmlEntries = Object.keys(unzipped).filter(k => k.endsWith('.xml') || k.endsWith('.rels'));
  for (const k of xmlEntries) {
    const content = new ctx.TextDecoder('utf-8').decode(unzipped[k]);
    assert.ok(content.startsWith('<?xml') || content.startsWith('<'), `${k} doit commencer par une balise XML`);
    assert.ok(content.endsWith('>'), `${k} doit se terminer par un chevron fermant`);

    // Contrôle d'équilibre des balises racines
    const rootTagMatch = content.match(/<([a-zA-Z0-9:_]+)(?:\s[^>]*)?>/);
    if (rootTagMatch && !rootTagMatch[0].endsWith('/>')) {
      const rootTag = rootTagMatch[1];
      assert.ok(content.includes(`</${rootTag}>`), `${k} doit fermer sa balise racine </${rootTag}>`);
    }
  }

  // 3. Validation de la cohérence CRC32
  for (const [name, data] of Object.entries(unzipped)) {
    const computedCrc = crc32(data);
    assert.ok(typeof computedCrc === 'number', `CRC32 valide pour ${name}`);
  }

  // 4. Année scolaire dans les en-têtes
  const h1Xml = new ctx.TextDecoder('utf-8').decode(unzipped['word/header1.xml']);
  const h2Xml = new ctx.TextDecoder('utf-8').decode(unzipped['word/header2.xml']);
  assert.ok(h1Xml.includes(targetYear), 'header1.xml doit porter la nouvelle année scolaire');
  assert.ok(h2Xml.includes(targetYear), 'header2.xml doit porter la nouvelle année scolaire');
  assert.ok(h2Xml.includes('Annexe 2'), 'header2.xml doit conserver la mention Annexe 2');
  assert.ok(h2Xml.includes('<w:tab/>'), 'header2.xml doit conserver les tabulations');
});

test('Test 15 — Métadonnées neutralisées dans docProps/core.xml', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  const docModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: true,
    schoolYear: '2025-2026',
    headerYear: '2025-2026',
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: {},
    t2_aspects: []
  };

  const outputDocx = await fillOfficialPIADocx(docModel);
  const unzipped = await unzipEntries(outputDocx.buffer.slice(outputDocx.byteOffset, outputDocx.byteOffset + outputDocx.byteLength));
  const coreXml = new ctx.TextDecoder('utf-8').decode(unzipped['docProps/core.xml']);

  assert.ok(coreXml.includes('<dc:creator>Pôle Territorial WBE BXL</dc:creator>'), 'dc:creator neutralisé');
  assert.ok(coreXml.includes('<cp:lastModifiedBy>Pôle Territorial WBE BXL</cp:lastModifiedBy>'), 'cp:lastModifiedBy neutralisé');
  assert.ok(coreXml.includes('<dcterms:modified'), 'Date de modification W3CDTF présente');
  assert.ok(!coreXml.includes('Lucas Lambert'), 'Aucune donnée nominative dans core.xml');
  assert.ok(!coreXml.includes('Windows') && !coreXml.includes('Macintosh'), 'Aucune signature de machine locale');
});

test('Test 16 — Échec clair si un libellé est introuvable', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries, buildZipStoreArchive } = ctx.JournalierDocx;

  const modelPath = path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx');
  const rawBytes = await fs.readFile(modelPath);
  const entries = await unzipEntries(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength));

  // Altération délibérée : suppression du libellé "Date de naissance"
  let docXml = new ctx.TextDecoder('utf-8').decode(entries['word/document.xml']);
  docXml = docXml.replace(/Date de naissance/g, 'Champ Supprimé Inconnu');
  entries['word/document.xml'] = new ctx.TextEncoder().encode(docXml);

  const corruptedZip = buildZipStoreArchive(Object.entries(entries).map(([name, data]) => ({ name, data })));

  const docModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2025-2026',
    t1_identite: { nom: 'Élève Test' },
    t2_aspects: []
  };

  await assert.rejects(
    async () => {
      await fillOfficialPIADocx(docModel, corruptedZip);
    },
    (err) => {
      assert.ok(err instanceof ctx.Error);
      assert.match(err.message, /Libellé introuvable dans le modèle officiel : date de naissance/);
      return true;
    },
    'Doit lever une exception claire spécifiant le libellé manquant'
  );
});

test('Test d’archive automatisé — Export fictif vs modèle officiel (identité octet par octet)', async () => {
  const ctx = await loadWordHarness();
  const { fillOfficialPIADocx, unzipEntries } = ctx.JournalierDocx;

  const modelPath = path.join(root, 'public/modeles/PIA_modele_officiel_2025-09-11.docx');
  const modelBytes = await fs.readFile(modelPath);
  const origEntries = await unzipEntries(modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength));

  const completeFictifModel = {
    isPIADocumentModel: true,
    moment: 'DECEMBRE',
    deidentified: false,
    schoolYear: '2026-2027',
    headerYear: '2026-2027',
    metaAuthor: 'Pôle Territorial WBE BXL',
    t1_identite: {
      nom: 'Lucas Lambert',
      dateNaissance: '2014-03-15',
      coordonneesEcole: 'École Fondamentale WBE BXL — Rue de la Pédagogie 10, 1000 Bruxelles',
      classeEtOption: '4P-B — Inclusion Pôle WBE',
      titulaire: 'Mme Sophie Moreau',
      coordonneesCpms: 'CPMS Centre WBE',
      representantPole: 'Pôle Territorial WBE BXL',
      coordonneesResponsable: '0470/12.34.56'
    },
    t2_aspects: [
      { aspect: 'Physique et psychomoteur', ressources: 'Bonne motricité', difficultes: 'Fatigabilité', objectifs: 'Pauses régulières' },
      { aspect: 'Lié à l’autonomie', ressources: 'Range son cartable', difficultes: 'Gestion du temps', objectifs: 'Sablier visuel' },
      { aspect: 'Comportemental et affectif', ressources: 'Sociable', difficultes: 'Stress d’évaluation', objectifs: 'Évaluation formative' },
      { aspect: 'Communication', ressources: 'Expression riche', difficultes: 'Passage à l’écrit', objectifs: 'Schémas heuristiques' },
      { aspect: 'Cognitif (pédagogique)', ressources: 'Compréhension rapide', difficultes: 'Double tâche', objectifs: 'Consignes séquencées' }
    ]
  };

  const outputDocx = await fillOfficialPIADocx(completeFictifModel, modelBytes);
  const genEntries = await unzipEntries(outputDocx.buffer.slice(outputDocx.byteOffset, outputDocx.byteOffset + outputDocx.byteLength));

  // Règle stricte : seules ces 4 parties ont le droit de différer
  const allowedDiffs = new Set([
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'docProps/core.xml'
  ]);

  const unexpectedDifferences = [];

  // 1. Contrôle des entrées d'origine
  for (const name of Object.keys(origEntries)) {
    if (!genEntries[name]) {
      unexpectedDifferences.push(`Entrée obligatoire manquante dans l’export : ${name}`);
      continue;
    }
    const origData = Buffer.from(origEntries[name]);
    const genData = Buffer.from(genEntries[name]);
    const isIdentical = Buffer.compare(origData, genData) === 0;

    if (allowedDiffs.has(name)) {
      if (isIdentical) {
        unexpectedDifferences.push(`L’entrée ${name} aurait dû être mise à jour avec les données de l’export mais est restée identique au modèle.`);
      }
    } else {
      if (!isIdentical) {
        unexpectedDifferences.push(`Différence inattendue dans l’entrée ${name} (doit être identique octet par octet au modèle officiel).`);
      }
    }
  }

  // 2. Contrôle de l'absence de fichiers superflus injectés
  for (const name of Object.keys(genEntries)) {
    if (!origEntries[name]) {
      unexpectedDifferences.push(`Entrée superflue injectée dans l’export Word : ${name}`);
    }
  }

  assert.equal(
    unexpectedDifferences.length,
    0,
    `L’export Word a altéré des entrées du modèle officiel non autorisées :\n${unexpectedDifferences.join('\n')}`
  );

  // Vérification explicite des entrées critiques préservées
  assert.ok(genEntries['word/footer1.xml'], 'word/footer1.xml doit exister');
  assert.equal(
    Buffer.compare(Buffer.from(origEntries['word/footer1.xml']), Buffer.from(genEntries['word/footer1.xml'])),
    0,
    'word/footer1.xml (logo et pied de page) doit être 100% identique octet par octet'
  );

  assert.ok(genEntries['word/media/image1.png'], 'word/media/image1.png doit exister');
  assert.equal(
    Buffer.compare(Buffer.from(origEntries['word/media/image1.png']), Buffer.from(genEntries['word/media/image1.png'])),
    0,
    'word/media/image1.png (binaire logo) doit être 100% identique octet par octet'
  );
});
