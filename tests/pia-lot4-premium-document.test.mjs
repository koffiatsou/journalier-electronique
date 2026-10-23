import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

async function loadV74Lot4Harness() {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');
  const docxCode = await fs.readFile(path.join(root, 'src/v74/v74-docx-export.js'), 'utf8');
  const pdfCode = await fs.readFile(path.join(root, 'src/v74/v74-pdf-export.js'), 'utf8');
  const msCoreCode = await fs.readFile(path.join(root, 'src/app/microsoft-core.js'), 'utf8');
  const referentialRaw = await fs.readFile(path.join(root, 'public/referentiel_pia_v74_0_3.json'), 'utf8');
  const referential = JSON.parse(referentialRaw);

  const strictStart = msCoreCode.indexOf('const JOURNALIER_JSON_LIMITS=');
  const strictEnd = msCoreCode.indexOf('function countUncommittedSyncChanges(');
  const strictPiaSnippet = `${msCoreCode.slice(strictStart, strictEnd)}\nglobalThis.validateStrictPIA = validateStrictPIA;`;

  // Minimal DOMParser for DOCX XML parsing in Node
  class SimpleElement {
    constructor(localName, innerXml) {
      this.localName = localName;
      this.innerXml = innerXml;
    }
    get textContent() {
      return this.innerXml
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
    }
    get children() {
      return parseChildElements(this.innerXml);
    }
    getElementsByTagNameNS(_ns, tag) {
      return findElementsByLocalName(this.innerXml, tag);
    }
  }

  function findElementsByLocalName(xml, tag) {
    const out = [];
    const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'g');
    let m;
    while ((m = re.exec(xml))) {
      out.push(new SimpleElement(tag, m[1]));
    }
    return out;
  }

  function parseChildElements(xml) {
    const out = [];
    const re = /<(?:\w+:)?(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?\1>/g;
    let m;
    while ((m = re.exec(xml))) {
      out.push(new SimpleElement(m[1], m[2]));
    }
    return out;
  }

  class MockDOMParser {
    parseFromString(xml) {
      return new SimpleElement('document', String(xml || ''));
    }
  }

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
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
    DecompressionStream: globalThis.DecompressionStream,
    DOMParser: MockDOMParser,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: true, json: async () => referential }),
    window: null,
    document: {
      readyState: 'complete',
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {}, contains: () => false }, appendChild: () => {}, setAttribute: () => {}, click: () => {} }),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  sandbox.window = sandbox;
  sandbox.window.confirm = () => true;
  sandbox.window.showAppToast = () => {};

  vm.createContext(sandbox);
  vm.runInContext(docxCode, sandbox);
  vm.runInContext(pdfCode, sandbox);
  vm.runInContext(strictPiaSnippet, sandbox);
  vm.runInContext(runtimeCode, sandbox);
  await sandbox.window.JournalierV74.loadRef();

  return {
    v74: sandbox.window.JournalierV74,
    validateStrictPIA: sandbox.validateStrictPIA
  };
}

function makeRichSession({ id, date, matiere, contexte, objectif, niveau, indicateurs, details, relations, q4, q5, q6 }) {
  return {
    id,
    type: 'SEANCE',
    studentId: 'stu-lot4',
    identification: {
      eleve: 'Lucas Lambert',
      date,
      matiere,
      contexte,
      objectif
    },
    q2: {
      niveau,
      commentaire: ''
    },
    q3: {
      indicateurs: indicateurs || [],
      details: details || {},
      relations: relations || {}
    },
    q4: q4 || { misEnPlace: 'oui', types: [], details: {}, precision: '' },
    q5: q5 || { observe: 'Non observé', contextes: [], commentaire: '' },
    q6: q6 || { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }
  };
}

test('LOT PIA-4 — Synthèse contextualisée, distinction Ressources/Fonctionnel/Difficultés, propositions actionnables et modèle documentaire complet', async () => {
  const { v74, validateStrictPIA } = await loadV74Lot4Harness();

  const student = {
    id: 'stu-lot4',
    studentId: 'stu-lot4',
    nom: 'Lucas Lambert',
    classe: '4P-B',
    ecole: 'École Saint-Michel',
    pia: 'Soutenir la structuration des étapes en résolution de problèmes'
  };

  const sessions = [
    // 1. Ressource réelle (Q2 Totalement + Q3 positifs en communication orale)
    makeRichSession({
      id: 'sess-lot4-1',
      date: '2025-10-08',
      matiere: 'Français',
      contexte: 'Individuel',
      objectif: 'Expliquer oralement sa démarche de lecture',
      niveau: 'Totalement',
      indicateurs: ['Expression orale'],
      details: {
        'Expression orale': {
          processus: ['Verbalisation claire des étapes'],
          appreciation: 2,
          precision: 'Vocabulaire précis et structuré'
        }
      },
      q4: {
        misEnPlace: 'oui',
        types: ['Support visuel'],
        details: { 'Support visuel': { effet: 'Très aidant' } },
        precision: 'Carte mentale des mots-clés'
      },
      q5: {
        observe: 'Observé',
        contextes: ['En classe'],
        commentaire: 'Réutilise spontanément les connecteurs temporels en classe'
      },
      q6: {
        actions: ['Maintenir le support visuel'],
        modalite: 'Relais enseignant',
        objectif: 'Consolider la prise de parole autonome',
        collaborations: ['Enseignant titulaire']
      }
    }),
    makeRichSession({
      id: 'sess-lot4-2',
      date: '2025-10-15',
      matiere: 'Éveil',
      contexte: 'Petit groupe',
      objectif: 'Présenter une observation scientifique',
      niveau: 'Totalement',
      indicateurs: ['Expression orale'],
      details: {
        'Expression orale': {
          processus: ['Verbalisation claire des étapes'],
          appreciation: 'appui',
          precision: 'Explications fluides devant ses pairs'
        }
      },
      q4: {
        misEnPlace: 'oui',
        types: ['Support visuel'],
        details: { 'Support visuel': { effet: 'Aidant' } },
        precision: 'Schéma séquentiel'
      },
      q5: {
        observe: 'Observé',
        contextes: ['En petit groupe'],
        commentaire: 'Transfert confirmé en atelier'
      },
      q6: {
        actions: ['Poursuivre en collectif'],
        modalite: 'Co-intervention',
        objectif: 'Généraliser en grand groupe',
        collaborations: ['Enseignant titulaire']
      }
    }),
    // 2. Point fonctionnel (Q2 Suffisamment sans difficulté majeure)
    makeRichSession({
      id: 'sess-lot4-3',
      date: '2025-10-22',
      matiere: 'Autonomie',
      contexte: 'En classe',
      objectif: 'Préparer son matériel de travail',
      niveau: 'Suffisamment',
      indicateurs: ['Gestion du matériel'],
      details: {
        'Gestion du matériel': {
          processus: ['Préparation autonome du pupitre'],
          appreciation: 1,
          precision: 'Routine installée'
        }
      },
      q4: {
        misEnPlace: 'oui',
        types: ['Check-list'],
        details: { 'Check-list': { effet: 'Aidant' } },
        precision: 'Pictogrammes sur le banc'
      },
      q5: {
        observe: 'Partiellement observé',
        contextes: ['En classe'],
        commentaire: 'Autonome le matin, rappel parfois nécessaire après la récréation'
      },
      q6: {
        actions: ['Maintenir la routine visuelle'],
        modalite: 'Classe',
        objectif: 'Stabiliser après les transitions',
        collaborations: ['Enseignant titulaire']
      }
    }),
    // 3. Difficulté récurrente (Q2 Partiellement + Q3 obstacles en compréhension de consignes / mathématiques)
    makeRichSession({
      id: 'sess-lot4-4',
      date: '2025-11-05',
      matiere: 'Mathématiques',
      contexte: 'En classe',
      objectif: 'Résoudre un problème à deux étapes',
      niveau: 'Partiellement',
      indicateurs: ['Compréhension de la consigne'],
      details: {
        'Compréhension de la consigne': {
          processus: ['Identification des données utiles', 'Décodage des consignes doubles'],
          appreciation: 0,
          precision: 'Perte du fil lors de la seconde étape'
        }
      },
      q4: {
        misEnPlace: 'oui',
        types: ['Reformulation / segmentation de consigne', 'Outil numérique / iPad'],
        details: {
          'Reformulation / segmentation de consigne': { effet: 'Aidant' },
          'Outil numérique / iPad': { effet: 'Très aidant' }
        },
        precision: 'Surlignage des verbes d’action et cache-texte'
      },
      q5: {
        observe: 'Partiellement observé',
        contextes: ['En individuel'],
        commentaire: 'Transfert acquis en duel mais fragile en classe entière'
      },
      q6: {
        actions: ['Segmenter systématiquement les consignes écrites'],
        modalite: 'Individuel puis classe',
        objectif: 'Pointer chaque étape avant de calculer',
        collaborations: ['Enseignant titulaire', 'Parents']
      }
    }),
    makeRichSession({
      id: 'sess-lot4-5',
      date: '2025-11-12',
      matiere: 'Français',
      contexte: 'Collectif',
      objectif: 'Appliquer une consigne grammaticale complexe',
      niveau: 'Partiellement',
      indicateurs: ['Compréhension de la consigne'],
      details: {
        'Compréhension de la consigne': {
          processus: ['Décodage des consignes doubles'],
          appreciation: 'fragilite',
          precision: 'Oubli de la seconde consigne en travail autonome'
        }
      },
      q4: {
        misEnPlace: 'oui',
        types: ['Reformulation / segmentation de consigne'],
        details: {
          'Reformulation / segmentation de consigne': { effet: 'Aidant' }
        },
        precision: 'Numérotation visuelle des étapes (1 → 2)'
      },
      q5: {
        observe: 'Non observé',
        contextes: ['En collectif'],
        commentaire: 'Nécessite encore la médiation de l’adulte en grand groupe'
      },
      q6: {
        actions: ['Utiliser la fiche-étapes numérotée'],
        modalite: 'Co-intervention',
        objectif: 'Vérifier les 2 étapes avec la fiche-repère',
        collaborations: ['Enseignant titulaire']
      }
    })
  ];

  const pia = v74.buildPIA(student, sessions, '2025-12-10', null);

  // 1. Vérification de la synthèse contextualisée par domaine
  const commSec = pia.sections.find(s => s.aspect === 'Communication');
  assert.ok(commSec, 'Le domaine Communication doit exister');
  const allSectionsText = JSON.stringify(pia.sections);
  assert.ok(
    allSectionsText.includes('Français') || allSectionsText.includes('Mathématiques'),
    'Les synthèses de domaine doivent contextualiser les observations avec les matières/contextes réels'
  );
  assert.ok(
    allSectionsText.includes('processus') || allSectionsText.includes('Décodage des consignes doubles') || allSectionsText.includes('Verbalisation claire des étapes'),
    'Les synthèses de domaine doivent intégrer les processus Q3 détaillés'
  );
  assert.ok(
    allSectionsText.includes('Point fonctionnel'),
    'Les observations Q2 Suffisamment doivent être explicitement distinguées comme Point fonctionnel'
  );

  // 2. Vérification de la qualité des propositions d'objectifs (non génériques, contextualisées)
  assert.ok(pia.propositions.length >= 2, 'Au moins 2 propositions doivent être générées');
  const diffProp = pia.propositions.find(p => p.dominantPolarity === 'difficulty' || p.formulation.includes('Soutenir et structurer'));
  assert.ok(diffProp, 'Une proposition sur la difficulté récurrente doit exister');
  assert.ok(
    !diffProp.formulation.startsWith('Dans le domaine'),
    'La formulation ne doit plus être le texte générique passe-partout "Dans le domaine..."'
  );
  assert.ok(
    (Array.isArray(diffProp.moyensAssocies) && diffProp.moyensAssocies.length > 0) ||
    (Array.isArray(diffProp.criteresObservable) && diffProp.criteresObservable.length > 0),
    'La proposition doit exposer séparément les appuis Q4, les critères Q3/Q5 et la piste Q6 sans alourdir la phrase d’objectif'
  );
  assert.doesNotMatch(diffProp.formulation, /\(Situations observées\s*:/i, 'La formulation de l’objectif PIA doit rester pure sans parenthèses de métadonnées');

  // Validation d'une proposition et refus d'une autre pour tester la distinction stricte
  v74.decidePIAProposal(pia, 0, 'VALIDEE');
  if (pia.propositions.length > 1) {
    v74.decidePIAProposal(pia, 1, 'A_EXAMINER');
  }
  v74.activatePIA(pia);
  assert.equal(pia.lifecycle, 'EN_VIGUEUR');

  // 3. Vérification du modèle documentaire intermédiaire (buildPIADocumentModel)
  const docModel = v74.buildPIADocumentModel(pia, false);
  assert.equal(docModel.isPIADocumentModel, true);
  const blockTypes = docModel.blocks.map(b => b.type);
  assert.ok(blockTypes.includes('header_banner'), 'Le modèle doit contenir le cartouche institutionnel header_banner');
  assert.ok(blockTypes.includes('kpi_grid'), 'Le modèle doit contenir la grille KPI de synthèse');
  assert.ok(blockTypes.includes('table'), 'Le modèle doit contenir des tableaux structurés');

  const domainTable = docModel.blocks.find(b => b.type === 'table' && b.tableRole === 'domain_summary');
  assert.ok(domainTable, 'Le tableau officiel des 5 aspects du développement doit être présent');
  assert.deepEqual(Array.from(domainTable.headers), ['Aspect', 'Ressources', 'Difficultés', 'Objectifs à poursuivre']);
  assert.equal(domainTable.rows.length, 5, 'Les 5 aspects canoniques doivent figurer dans le tableau');

  const pomTable = docModel.blocks.find(b => b.type === 'table' && b.tableRole === 'adaptations_pom');
  assert.ok(pomTable, 'Le tableau des aménagements P/O/M doit être présent');
  assert.ok(pomTable.headers.includes('P') && pomTable.headers.includes('O') && pomTable.headers.includes('M'));

  // 4. Interopérabilité totale DOCX : makeDocx(docModel) -> parsePIAFile(.docx) via extractPIAFromDocxTables
  const docxBytes = v74.makeDocx(docModel);
  assert.ok(docxBytes instanceof Uint8Array && docxBytes.length > 2000, 'Le DOCX généré doit être un binaire ZIP valide');
  const mockDocxFile = {
    name: 'PIA_professionnel_V74.docx',
    size: docxBytes.byteLength,
    arrayBuffer: async () => docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength)
  };
  const parsedFromDocx = await v74.parsePIAFile(mockDocxFile);
  assert.equal(parsedFromDocx.format, 'docx');
  assert.ok(parsedFromDocx.extracted.sections.length === 5, 'L’import DOCX par tables doit reconnaître les 5 domaines du PIA exporté');
  assert.ok(parsedFromDocx.extracted.adaptations.length >= 1, 'L’import DOCX par tables doit reconnaître la table P/O/M du PIA exporté');

  // 5. Interopérabilité PDF : makePdf(docModel) -> parsePIAFile(.pdf)
  const pdfBytes = v74.makePdf(docModel);
  assert.ok(pdfBytes instanceof Uint8Array && pdfBytes.length > 2000, 'Le PDF généré doit être un binaire PDF valide');
  const rawPdfLatin1 = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(rawPdfLatin1.includes('re B') || rawPdfLatin1.includes('re f'), 'Le PDF doit contenir des primitives graphiques vectorielles (rectangles/tableaux)');
  const mockPdfFile = {
    name: 'PIA_professionnel_V74.pdf',
    size: pdfBytes.byteLength,
    arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
  };
  const parsedFromPdf = await v74.parsePIAFile(mockPdfFile);
  assert.equal(parsedFromPdf.format, 'pdf');
  assert.ok(parsedFromPdf.extracted.sections.length >= 5, 'Le PDF exporté doit rester réimportable par parsePIAFile');

  // 6. Vérification stricte de la dé-identification (modèle, DOCX, PDF)
  pia.meeting1.date = '2025-12-10';
  pia.meeting1.context = 'Rencontre avec Lucas Lambert à l’École Saint-Michel en classe 4P-B le 2025-12-10';
  const deidModel = v74.buildPIADocumentModel(pia, true);
  const deidSerialized = JSON.stringify(deidModel);
  assert.ok(!deidSerialized.includes('Lucas Lambert'), 'Le nom de l’élève ne doit jamais fuiter dans le modèle dé-identifié');
  assert.ok(!deidSerialized.includes('École Saint-Michel'), 'L’école ne doit jamais fuiter dans le modèle dé-identifié');
  assert.ok(!deidSerialized.includes('4P-B'), 'La classe ne doit jamais fuiter dans le modèle dé-identifié');
  assert.ok(!deidSerialized.includes('2025-12-10'), 'Les dates nominatives ne doivent jamais fuiter dans le modèle dé-identifié');
  assert.ok(!deidSerialized.includes('stu-lot4'), 'Le studentId ne doit jamais fuiter dans le modèle dé-identifié');

  // 7. Aperçu HTML du document & contrat strict de stockage
  const previewHtml = v74.piaDocumentPreviewHtml(pia);
  assert.ok(previewHtml.includes('v74-doc-sheet') && previewHtml.includes('v74-doc-table'), 'L’aperçu HTML du document doit rendre les tables et le cartouche');
  assert.doesNotThrow(() => validateStrictPIA(pia, 'stu-lot4'));

  // 8. Sobriété du tableau PIA (pas de jargon interne Q2/Q3/Q4/Q5/Q6 dans les cellules des 5 aspects)
  for (const row of domainTable.rows) {
    const combinedCellText = row.map((cell) => (Array.isArray(cell) ? cell.join(' ') : String(cell || ''))).join(' ');
    assert.doesNotMatch(combinedCellText, /\bQ[2-6]\b/, 'Aucun code interne Q2-Q6 ne doit apparaître dans le tableau des 5 aspects du PIA');
  }

  // 9. Chantier 4 : Modèle documentaire d’export des séances conforme à « Journalier VIERGE.pdf »
  const sessionsDoc = v74.buildSessionsDocumentModel(sessions, student, { start: '2025-10-01', end: '2025-12-31' });
  assert.ok(sessionsDoc && Array.isArray(sessionsDoc.blocks), 'buildSessionsDocumentModel doit retourner un modèle documentaire valide');
  const sessionTables = sessionsDoc.blocks.filter(b => b.type === 'table');
  assert.equal(sessionTables.length, sessions.length, 'Chaque séance doit générer un cadre structuré à 2 parties (infos + observations)');
  const firstSessionTable = sessionTables[0];
  assert.equal(firstSessionTable.headers[0], 'CADRE 1 — INFORMATIONS DE LA SÉANCE');
  assert.equal(firstSessionTable.rows.length, 3, 'Chaque tableau de séance comporte Date & créneau, Titre de la leçon / objectif du cours, et CADRE 2 — OBSERVATIONS');
  assert.equal(firstSessionTable.rows[2][0], 'CADRE 2 — OBSERVATIONS');
  const obsNarrative = Array.isArray(firstSessionTable.rows[2][1]) ? firstSessionTable.rows[2][1].join(' ') : String(firstSessionTable.rows[2][1] || '');
  assert.ok(obsNarrative.length > 20, 'Le cadre OBSERVATIONS contient une synthèse narrative exploitable');
  assert.doesNotMatch(obsNarrative, /\bQ[2-6]\b/, 'La synthèse des observations de séance ne contient aucun code interne Q2-Q6');
  assert.doesNotMatch(obsNarrative, /\((?:partiellement|suffisamment|totalement|en cours d’appropriation|mobilisé|à renforcer|effet partiel|effet positif)\)/i, 'La synthèse des observations de séance ne contient pas de degrés bruts entre parenthèses');
  assert.match(obsNarrative, /aide concrètement l’élève|aident concrètement l’élève|aide partiellement l’élève|aident partiellement l’élève/, 'La formulation des aides est fluide et centrée sur l’élève');
  const sessionsDocxBytes = v74.makeDocx(sessionsDoc);
  assert.ok(sessionsDocxBytes instanceof Uint8Array && sessionsDocxBytes.length > 1500, 'Le DOCX d’export des séances est généré avec de vraies tables OpenXML');

  // 10. Chantier 5 : Nouvelle Synthèse visuelle en 4 blocs & Pont direct vers le PIA annuel (sans pavé Chaînage Q2->Q6)
  const coreSource = (await fs.readFile(path.join(root, 'src/app/journalier-core.js'), 'utf8')) + '\n' + (await fs.readFile(path.join(root, 'src/app/reports-core.js'), 'utf8'));
  const indexHtmlSource = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(indexHtmlSource, /data-reports-tab="history"[\s\S]*data-reports-tab="meeting"[\s\S]*data-reports-tab="synthesis"[\s\S]*data-reports-tab="pia"/, 'L’ordre des onglets Rapports & PIA doit être 1: Historique, 2: Réunion(s), 3: Synthèse, 4: PIA');
  assert.match(coreSource, /function buildVisualSynthesisAndPIABridgeHtml/, 'La fonction buildVisualSynthesisAndPIABridgeHtml doit être définie');
  assert.match(coreSource, /1\. Vue d’ensemble sur la période/, 'Le Bloc 1 Bandeau visuel doit être présent');
  assert.match(coreSource, /data-synth-kpi-details=/, 'Les cartes KPI Points d’appui / Fonctionnels / Fragilités doivent être des accordéons natifs exclusifs');
  assert.match(coreSource, /data-synth-kpi-close=/, 'Le bouton Fermer de l’accordéon KPI doit être présent');
  assert.match(coreSource, /data-synth-jump-meeting=/, 'Le bouton de renvoi vers l’onglet Réunion(s) doit être présent');
  assert.match(coreSource, /synth-tree-chapters/, 'L’arborescence Matière -> Chapitre -> Compétence doit être présente pour les Points 3 et 4');
  assert.match(coreSource, /function joinAidsWithArticles/, 'Le moteur grammatical de déterminants français naturels doit être présent');
  assert.match(coreSource, /2\. Synthèse par chapitre &amp; évolution/, 'Le Bloc 2 Synthèse longitudinale par chapitre avec accordéon doit être présent');
  assert.match(coreSource, /3\. Portrait par les 5 domaines du PIA/, 'Le Bloc 3 Portrait par les 5 domaines du PIA doit être présent');
  assert.match(coreSource, /synth-domain-accordion/, 'Chaque domaine du Point 3 doit être un accordéon intelligent');
  assert.match(coreSource, /4\. Validation des objectifs &amp; stratégies pour le PIA annuel/, 'Le Bloc 4 Validation des objectifs & stratégies pour le PIA doit être présent');
  assert.match(coreSource, /Aides partiellement efficaces :/, 'Les aides partiellement efficaces sont séparées des leviers efficaces');
  assert.doesNotMatch(diffProp.formulation, /\(Situations observées\s*:/i, 'La formulation de l’objectif PIA doit rester pure sans parenthèses de métadonnées');
  assert.equal(typeof v74.ensurePIAForSynthesis, 'function', 'ensurePIAForSynthesis doit être exposé sur JournalierV74');
  assert.equal(typeof v74.saveSynthesisDomainField, 'function', 'saveSynthesisDomainField doit être exposé sur JournalierV74');
  assert.equal(typeof v74.decideSynthesisProposal, 'function', 'decideSynthesisProposal doit être exposé sur JournalierV74');
  assert.equal(typeof v74.openPIAWorkspaceFromSynthesis, 'function', 'openPIAWorkspaceFromSynthesis doit être exposé sur JournalierV74');
  assert.equal(typeof v74.resolveSessionWBERepere, 'function', 'resolveSessionWBERepere doit être exposé sur JournalierV74');
  assert.equal(typeof v74.canonicalizeWbeChapter, 'function', 'canonicalizeWbeChapter doit être exposé sur JournalierV74');
  assert.equal(v74.canonicalizeWbeChapter('mathematiques|quotient de puissances', 'Quotient de puissances', 'Mathématiques'), 'Propriétés des puissances', 'quotient de puissances et proprietes des puissances fusionnent sous Propriétés des puissances');
  assert.equal(v74.canonicalizeWbeChapter('Le monde des nombres', 'Interro - opérations sur entiers', 'Mathématiques'), 'Priorités opératoires', 'Le monde des nombres avec opérations sur entiers est rattaché à Priorités opératoires');
  assert.equal(v74.isAdaptationRelevantToAspect('Explicitation / verbalisation', 'Physique et psychomoteur'), false, 'Explicitation / verbalisation ne doit pas contaminer le domaine Physique et psychomoteur');
  assert.equal(v74.isAdaptationRelevantToAspect('Modélisation', 'Physique et psychomoteur'), false, 'Modélisation ne doit pas contaminer le domaine Physique et psychomoteur');
  assert.ok(Array.isArray(diffProp.wbeReperes), 'Les propositions PIA doivent exposer le tableau wbeReperes');
});
