import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const escapeHtmlSource = fs.readFileSync(path.join(rootDir, 'src', 'app', 'html-escape.js'), 'utf8');
const reportsCoreSource = fs.readFileSync(path.join(rootDir, 'src', 'app', 'reports-core.js'), 'utf8');
const v74RuntimeSource = fs.readFileSync(path.join(rootDir, 'src', 'v74', 'v74-runtime.js'), 'utf8');

function setupReportsEnvironment() {
  const sandbox = {
    console,
    Map,
    Set,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Math,
    Date,
    window: {},
    document: {
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ click() {}, style: {} }),
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    getStudents: () => [{ studentId: 'stu-alpha', nom: 'Élève Alpha' }],
    DataStore: {
      getChapterNarrative: () => null,
      saveChapterNarrative: () => {},
      diagnostics: () => ({})
    },
    sessionParts: (entry) => {
      const i = entry?.identification || {}, p = i.periode || {}, c = entry?.contexte || {};
      return {
        eleve: i.eleve || '',
        date: i.date || entry?.date || '',
        start: p.start || '',
        end: p.end || '',
        matiere: c.matiere || entry?.matiere || ''
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  // Exécuter html-escape.js pour l'échappement sécurisé
  vm.runInContext(escapeHtmlSource, sandbox);
  // Exécuter runtime V74 d'abord pour avoir les fonctions d'évaluation et helpers
  vm.runInContext(v74RuntimeSource, sandbox);
  // Puis exécuter reports-core.js
  vm.runInContext(reportsCoreSource, sandbox);

  return sandbox;
}

test('Lot C — Agrégation cloisonnée par matière et sélecteur de matière', () => {
  const env = setupReportsEnvironment();
  const buildVisualSynthesisAndPIABridgeHtml = env.buildVisualSynthesisAndPIABridgeHtml;

  assert.equal(
    typeof buildVisualSynthesisAndPIABridgeHtml,
    'function',
    'buildVisualSynthesisAndPIABridgeHtml doit être disponible'
  );

  // Jeux de séances fictives conformes au constat : Mathématiques et Néerlandais
  const logs = [
    {
      id: 'log-math-1',
      date: '2026-10-06',
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques'
    },
    {
      id: 'log-math-2',
      date: '2026-10-08',
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques'
    },
    {
      id: 'log-nl-1',
      date: '2026-10-13',
      contexte: { matiere: 'Néerlandais' },
      objectif: { objectifLecon: 'Mots interrogatifs' },
      matiere: 'Néerlandais'
    }
  ];

  const evidence = [
    {
      sessionId: 'log-math-1',
      date: '2026-10-06',
      dateKey: '2026-10-06',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[0],
      observations: [
        { text: 'Mettre en œuvre une procédure pour résoudre une équation', level: 0 },
        { text: 'Identifier les termes en x', level: 1 }
      ],
      indicators: [],
      adaptations: ['Fiche-méthode'],
      effects: { 'Fiche-méthode': 2 }
    },
    {
      sessionId: 'log-math-2',
      date: '2026-10-08',
      dateKey: '2026-10-08',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[1],
      observations: [
        { text: 'Mettre en œuvre une procédure pour résoudre une équation', level: 1 }
      ],
      indicators: [],
      adaptations: ['Fiche-méthode'],
      effects: { 'Fiche-méthode': 2 }
    },
    {
      sessionId: 'log-nl-1',
      date: '2026-10-13',
      dateKey: '2026-10-13',
      matiere: 'Néerlandais',
      objectif: 'Mots interrogatifs',
      log: logs[2],
      observations: [
        { text: 'Mettre en œuvre une procédure', level: 2 }
      ],
      indicators: [],
      adaptations: ['Lexique illustré'],
      effects: { 'Lexique illustré': 1 }
    }
  ];

  const result = buildVisualSynthesisAndPIABridgeHtml(
    logs,
    evidence,
    [],
    [],
    'Élève Alpha',
    'synth',
    { start: '2026-10-01', end: '2026-10-31' }
  );

  const html = result.html;

  // 1. Présence du sélecteur de matière en tête de la section 1
  assert.ok(
    html.includes('data-synth-subject-filter="all"'),
    'Le sélecteur doit comporter le filtre "Toutes les matières"'
  );
  assert.ok(
    html.includes('data-synth-subject-filter="Mathématiques"') &&
    html.includes('data-synth-subject-filter="Néerlandais"'),
    'Le sélecteur doit comporter une puce par matière évaluée'
  );

  // 2. Présence de blocs/panneaux distincts par matière
  assert.ok(
    html.includes('data-synth-subject-panel="Mathématiques"'),
    'Un panneau distinct doit exister pour les Mathématiques'
  );
  assert.ok(
    html.includes('data-synth-subject-panel="Néerlandais"'),
    'Un panneau distinct doit exister pour le Néerlandais'
  );

  // 3. Découpage strict du libellé de compétence : le néerlandais ne doit JAMAIS hériter du libellé mathématique
  // On extrait le panneau du néerlandais
  const nlPanelStart = html.indexOf('data-synth-subject-panel="Néerlandais"');
  assert.ok(nlPanelStart > 0, 'Panneau Néerlandais trouvé');
  const nlPanelEnd = html.indexOf('data-synth-subject-panel=', nlPanelStart + 35);
  const nlPanelHtml = nlPanelEnd > 0 ? html.slice(nlPanelStart, nlPanelEnd) : html.slice(nlPanelStart);

  assert.doesNotMatch(
    nlPanelHtml,
    /résoudre une équation/i,
    'Le panneau de Néerlandais ne doit jamais mentionner "résoudre une équation"'
  );
  assert.match(
    nlPanelHtml,
    /Mettre en œuvre une procédure/i,
    'Le panneau de Néerlandais doit conserver son propre libellé "Mettre en œuvre une procédure"'
  );

  // 4. Les compteurs du Néerlandais doivent être calculés pour le Néerlandais seul
  // (1 séance de néerlandais, 1 observation acquise (level 2) = 100% acquis)
  assert.match(
    nlPanelHtml,
    /100%/,
    'Le taux d’acquis en Néerlandais doit être de 100% (1 acquis sur 1 observation)'
  );

  // 5. Vérification sur le panneau de Mathématiques
  const mathPanelStart = html.indexOf('data-synth-subject-panel="Mathématiques"');
  assert.ok(mathPanelStart > 0, 'Panneau Mathématiques trouvé');
  const mathPanelEnd = html.indexOf('data-synth-subject-panel=', mathPanelStart + 35);
  const mathPanelHtml = mathPanelEnd > 0 ? html.slice(mathPanelStart, mathPanelEnd) : html.slice(mathPanelStart);

  assert.match(
    mathPanelHtml,
    /Mettre en œuvre une procédure pour résoudre une équation/,
    'Le panneau de Mathématiques doit afficher sa compétence spécialisée'
  );
  assert.doesNotMatch(
    mathPanelHtml,
    /\d+ occurrences?/,
    'V75 : plus de compteur d’occurrences affiché dans le panneau de Mathématiques'
  );
  assert.doesNotMatch(
    mathPanelHtml,
    /2026-10-13/,
    'Le panneau de Mathématiques ne doit pas contenir la date du cours de néerlandais (13/10/2026)'
  );
});
