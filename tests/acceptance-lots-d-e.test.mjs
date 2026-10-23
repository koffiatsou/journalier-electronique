import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const escapeHtmlSource = fs.readFileSync(path.join(rootDir, 'src', 'app', 'html-escape.js'), 'utf8');
const reportsCoreSource = fs.readFileSync(path.join(rootDir, 'src', 'app', 'reports-core.js'), 'utf8');
const v74RuntimeSource = fs.readFileSync(path.join(rootDir, 'src', 'v74', 'v74-runtime.js'), 'utf8');
const localAiSource = fs.readFileSync(path.join(rootDir, 'src', 'app', 'local-ai-assistant.js'), 'utf8');

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
    MutationObserver: class { observe() {} disconnect() {} },
    window: {},
    document: {
      head: { appendChild: () => {} },
      body: { appendChild: () => {}, insertAdjacentHTML: () => {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ click() {}, style: {}, addEventListener: () => {} }),
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

  vm.runInContext(escapeHtmlSource, sandbox);
  vm.runInContext(v74RuntimeSource, sandbox);
  vm.runInContext(localAiSource, sandbox);
  vm.runInContext(reportsCoreSource, sandbox);

  return sandbox;
}

test('Acceptation Lots D & E — 7 séances fictives (4 Maths, 2 Néerlandais, 1 du 25/09 sans observation)', () => {
  const env = setupReportsEnvironment();
  const buildVisualSynthesisAndPIABridgeHtml = env.buildVisualSynthesisAndPIABridgeHtml;

  // 1. Définition des 7 séances fictives pour l'élève Alpha
  const logs = [
    // 4 séances de Mathématiques (équations du premier degré)
    {
      id: 'log-math-1',
      date: '2026-09-10',
      identification: { date: '2026-09-10', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 0 }] },
      q4: { types: ['Calculatrice'], effets: { Calculatrice: 2 } }
    },
    {
      id: 'log-math-2',
      date: '2026-09-17',
      identification: { date: '2026-09-17', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 1 }] },
      q4: { types: ['Démarche guidée'], effets: { 'Démarche guidée': 2 } }
    },
    {
      id: 'log-math-3',
      date: '2026-10-01',
      identification: { date: '2026-10-01', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 1 }] },
      q4: { types: ['Calculatrice'], effets: { Calculatrice: 2 } }
    },
    {
      id: 'log-math-4',
      date: '2026-10-08',
      identification: { date: '2026-10-08', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: 'Équations du premier degré' },
      matiere: 'Mathématiques',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 2 }] },
      q4: { types: ['Démarche guidée'], effets: { 'Démarche guidée': 2 } }
    },

    // 2 séances de Néerlandais (mots interrogatifs) avec indicateur générique « Mettre en œuvre une procédure »
    {
      id: 'log-nl-1',
      date: '2026-09-15',
      identification: { date: '2026-09-15', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Néerlandais' },
      objectif: { objectifLecon: 'Mots interrogatifs' },
      matiere: 'Néerlandais',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure', appreciation: 1 }] },
      q4: { types: ['Lexique illustré'], effets: { 'Lexique illustré': 2 } }
    },
    {
      id: 'log-nl-2',
      date: '2026-10-06',
      identification: { date: '2026-10-06', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Néerlandais' },
      objectif: { objectifLecon: 'Mots interrogatifs' },
      matiere: 'Néerlandais',
      q3: { indicateurs: [{ texte: 'Mettre en œuvre une procédure', appreciation: 2 }] },
      q4: { types: ['Dictionnaire bilingue'], effets: { 'Dictionnaire bilingue': 1 } }
    },

    // 1 séance du 25/09 sans observation
    {
      id: 'log-empty-1',
      date: '2026-09-25',
      identification: { date: '2026-09-25', eleve: 'Élève Alpha' },
      contexte: { matiere: 'Mathématiques' },
      objectif: { objectifLecon: '' },
      matiere: 'Mathématiques'
    }
  ];

  // Construction de l'evidence correspondante
  const evidence = [
    {
      sessionId: 'log-math-1',
      date: '2026-09-10',
      dateKey: '2026-09-10',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[0],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 0 }],
      adaptations: ['Calculatrice'],
      effects: { Calculatrice: 2 }
    },
    {
      sessionId: 'log-math-2',
      date: '2026-09-17',
      dateKey: '2026-09-17',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[1],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 1 }],
      adaptations: ['Démarche guidée'],
      effects: { 'Démarche guidée': 2 }
    },
    {
      sessionId: 'log-math-3',
      date: '2026-10-01',
      dateKey: '2026-10-01',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[2],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 1 }],
      adaptations: ['Calculatrice'],
      effects: { Calculatrice: 2 }
    },
    {
      sessionId: 'log-math-4',
      date: '2026-10-08',
      dateKey: '2026-10-08',
      matiere: 'Mathématiques',
      objectif: 'Équations du premier degré',
      log: logs[3],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure pour résoudre une équation', appreciation: 2 }],
      adaptations: ['Démarche guidée'],
      effects: { 'Démarche guidée': 2 }
    },
    {
      sessionId: 'log-nl-1',
      date: '2026-09-15',
      dateKey: '2026-09-15',
      matiere: 'Néerlandais',
      objectif: 'Mots interrogatifs',
      log: logs[4],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure', appreciation: 1 }],
      adaptations: ['Lexique illustré'],
      effects: { 'Lexique illustré': 2 }
    },
    {
      sessionId: 'log-nl-2',
      date: '2026-10-06',
      dateKey: '2026-10-06',
      matiere: 'Néerlandais',
      objectif: 'Mots interrogatifs',
      log: logs[5],
      observations: [],
      indicators: [{ text: 'Mettre en œuvre une procédure', appreciation: 2 }],
      adaptations: ['Dictionnaire bilingue'],
      effects: { 'Dictionnaire bilingue': 1 }
    },
    {
      sessionId: 'log-empty-1',
      date: '2026-09-25',
      dateKey: '2026-09-25',
      matiere: 'Mathématiques',
      objectif: '',
      log: logs[6],
      observations: [],
      indicators: [],
      adaptations: [],
      effects: {}
    }
  ];

  const result = buildVisualSynthesisAndPIABridgeHtml(
    logs,
    evidence,
    [],
    [],
    'Élève Alpha',
    'synth',
    { start: '2026-09-01', end: '2026-10-31' }
  );

  const html = result.html;

  // Extraction des panneaux de matière pour inspection ciblée
  const nlPanelStart = html.indexOf('data-synth-subject-panel="Néerlandais"');
  assert.ok(nlPanelStart > 0, 'Panneau Néerlandais présent');
  const nextSubjectPanel = html.indexOf('data-synth-subject-panel=', nlPanelStart + 35);
  const endOfBloc1 = html.indexOf('</section>', nlPanelStart);
  const nlPanelEnd = nextSubjectPanel > 0 ? nextSubjectPanel : endOfBloc1;
  const nlPanelHtml = nlPanelEnd > 0 ? html.slice(nlPanelStart, nlPanelEnd) : html.slice(nlPanelStart);

  const mathPanelStart = html.indexOf('data-synth-subject-panel="Mathématiques"');
  assert.ok(mathPanelStart > 0, 'Panneau Mathématiques présent');
  const mathPanelEnd = html.indexOf('data-synth-subject-panel=', mathPanelStart + 35);
  const mathPanelHtml = mathPanelEnd > 0 ? html.slice(mathPanelStart, mathPanelEnd) : html.slice(mathPanelStart);

  // 1. Aucune ligne d'indicateur ne mélange deux matières
  assert.doesNotMatch(
    nlPanelHtml,
    /Mathématiques/i,
    'Vérification 1 : Le panneau Néerlandais ne doit pas mélanger les observations avec les Mathématiques'
  );
  assert.doesNotMatch(
    mathPanelHtml,
    /Mots interrogatifs/i,
    'Vérification 1 : Le panneau Mathématiques ne doit pas mentionner le chapitre de Néerlandais'
  );

  // 2. Le libellé du néerlandais est « Mettre en œuvre une procédure », sans « pour résoudre une équation »
  assert.match(
    nlPanelHtml,
    /Mettre en œuvre une procédure/i,
    'Vérification 2 : Le panneau Néerlandais contient le libellé générique'
  );
  assert.doesNotMatch(
    nlPanelHtml,
    /pour résoudre une équation/i,
    'Vérification 2 : Le panneau Néerlandais n’hérite pas du suffixe mathématique "pour résoudre une équation"'
  );
  assert.match(
    mathPanelHtml,
    /Mettre en œuvre une procédure pour résoudre une équation/i,
    'Vérification 2 : Le panneau Mathématiques conserve son libellé spécifique'
  );

  // 3. Les compteurs et pourcentages sont corrects par matière
  // En Mathématiques : 5 séances au total (4 avec indicateurs + 1 sans observation), 4 observations évaluées
  // 1 fragile (25%), 2 fonctionnelles (50%), 1 acquise (25%)
  assert.match(
    mathPanelHtml,
    /4 obs\. évaluée/i,
    'Vérification 3 : Mathématiques a 4 observations évaluées'
  );
  assert.match(
    mathPanelHtml,
    /5 séances/i,
    'Vérification 3 : Mathématiques compte 5 séances analysées (dont la séance sans observation)'
  );
  // En Néerlandais : 2 séances, 2 observations évaluées, 1 fonctionnelle (50%), 1 acquise (50%), 0 fragile (0%)
  assert.match(
    nlPanelHtml,
    /2 obs\. évaluée/i,
    'Vérification 3 : Néerlandais a 2 observations évaluées'
  );
  assert.match(
    nlPanelHtml,
    /2 séances/i,
    'Vérification 3 : Néerlandais compte 2 séances analysées'
  );

  // 4. Les adaptations sont listées sous la bonne matière dans le Portrait
  // Bloc 3 : Portrait des domaines
  const domainCognitifStart = html.indexOf('Cognitif (pédagogique)');
  assert.ok(domainCognitifStart > 0, 'Domaine cognitif présent dans le portrait');
  const domainCognitifEnd = html.indexOf('synth-domain-card', domainCognitifStart + 50);
  const domainCognitifHtml = domainCognitifEnd > 0 ? html.slice(domainCognitifStart, domainCognitifEnd) : html.slice(domainCognitifStart);

  // Adaptations en mathématiques : Calculatrice, Démarche guidée
  assert.match(
    domainCognitifHtml,
    /<strong>Mathématiques\s*:\s*<\/strong>[\s\S]*Calculatrice/i,
    'Vérification 4 : Calculatrice est sous Mathématiques'
  );
  assert.match(
    domainCognitifHtml,
    /<strong>Mathématiques\s*:\s*<\/strong>[\s\S]*Démarche guidée/i,
    'Vérification 4 : Démarche guidée est sous Mathématiques'
  );
  // Adaptations en néerlandais : Lexique illustré, Dictionnaire bilingue
  assert.match(
    domainCognitifHtml,
    /<strong>Néerlandais\s*:\s*<\/strong>[\s\S]*Lexique illustré/i,
    'Vérification 4 : Lexique illustré est sous Néerlandais'
  );
  // Aucune adaptation inventée sans source
  assert.doesNotMatch(
    domainCognitifHtml,
    /Sécuriser la mise en route et l’application autonome des procédures travaillées/i,
    'Vérification 4 : Aucun objectif par défaut inventé'
  );
  assert.doesNotMatch(
    domainCognitifHtml,
    /Adapter le guidage selon la complexité de la tâche/i,
    'Vérification 4 : Aucune adaptation de repli inventée'
  );
  assert.doesNotMatch(
    domainCognitifHtml,
    /Fiche-outil personnalisée · Référentiel procédural/i,
    'Vérification 4 : Aucun moyen par défaut inventé'
  );
  // Transversal n'apparaît pas puisqu'aucune adaptation transversale n'a été enregistrée
  assert.doesNotMatch(
    domainCognitifHtml,
    /<strong>Transversal \(toutes matières\)\s*:\s*<\/strong>/i,
    'Vérification 4 : Transversal n’apparaît que si le professionnel l’a enregistré comme tel'
  );

  // 5. La séance du 25/09 ne produit aucune carte ni aucune phrase générée
  assert.doesNotMatch(
    html,
    /l’accompagnement a ciblé la structuration des étapes et la compréhension des attendus/i,
    'Vérification 5 : La phrase par défaut inventée n’est plus jamais produite'
  );
  assert.doesNotMatch(
    html,
    /Chapitre : Thématique travaillée/i,
    'Vérification 5 : Aucune carte "Thématique travaillée" créée pour la séance sans observation'
  );
  assert.match(
    html,
    /1 séance sans observation renseignée\s*\(25\/09\/2026\)/i,
    'Vérification 5 : La séance du 25/09 apparaît dans une ligne discrète repliée'
  );
  assert.match(
    html,
    /7 séances/i,
    'Vérification 5 : Le total général de la synthèse compte bien les 7 séances'
  );

  // 6. Le bouton « Améliorer avec IA » n'existe plus dans la Synthèse et le PIA
  assert.doesNotMatch(
    html,
    /Améliorer avec IA/i,
    'Vérification 6 : Le bouton "Améliorer avec IA" n’existe plus dans la Synthèse'
  );

  // 7. « Ajuster le texte » ouvre bien la fenêtre dans l'onglet Réunion
  assert.match(
    html,
    /✎ Ajuster le texte/,
    'Vérification 7 : Les boutons portent le libellé clair "✎ Ajuster le texte"'
  );
  assert.equal(
    typeof env.window.LocalAIAssistant?.open,
    'function',
    'Vérification 7 : LocalAIAssistant.open doit être une fonction pour ouvrir la fenêtre'
  );

  // Vérification de la présentation en rangée de 4 tuiles égales avec tiroir sous la rangée (Lot E)
  assert.match(
    html,
    /synth-kpi-row-4/,
    'Lot E : Les 4 tuiles KPI sont organisées dans la rangée synth-kpi-row-4'
  );
  assert.match(
    html,
    /synth-kpi-drawers-container/,
    'Lot E : Les tiroirs d’indicateurs sont regroupés dans le conteneur pleine largeur sous la rangée'
  );
  assert.match(
    html,
    /aria-expanded="false"/,
    'Lot E : Les tuiles portent aria-expanded'
  );
  assert.match(
    html,
    /aria-controls="panel-/,
    'Lot E : Les tuiles portent aria-controls'
  );
});
