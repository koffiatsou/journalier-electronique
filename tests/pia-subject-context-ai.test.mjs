import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const runtimeSource = await fs.readFile(new URL('../src/v74/v74-runtime.js', import.meta.url), 'utf8');
const aiSource = await fs.readFile(new URL('../src/app/local-ai-assistant.js', import.meta.url), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function loadContextTree() {
  const context = {
    norm,
    safeArray: value => Array.isArray(value) ? value : [],
    cleanWbeRawToken: raw => String(raw || '').split('|').filter(Boolean).at(-1)?.trim() || '',
    toInfinitiveV74: value => String(value || '').trim(),
    semanticSkillKeyV74: value => norm(value),
    pickPreferredSkillLabelV74: (left, right) => left.length <= right.length ? left : right,
    formatHumanDateShortV74: value => value,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(runtimeSource, 'canonicalizeWbeChapter'), context);
  vm.runInContext(extractFunction(runtimeSource, 'buildProposalContextTreeV74'), context);
  return context;
}

test('PIA: un objectif de néerlandais ne devient pas un chapitre de mathématiques', () => {
  const context = loadContextTree();
  const result = context.canonicalizeWbeChapter('', 'Mots interrogatifs : hoelang et hoeveel', 'Néerlandais');
  assert.match(result, /Mots interrogatifs/i);
  assert.doesNotMatch(result, /Équations|Fractions|Fonctions/i);
});

test('PIA: les critères ne sont pas recopiés dans des chapitres sans preuve correspondante', () => {
  const context = loadContextTree();
  const tree = context.buildProposalContextTreeV74({
    criteresObservable: ['Mettre en œuvre une procédure pour résoudre une équation', 'Mobiliser le vocabulaire interrogatif'],
    evidence: [
      { sessionId: 'fake-math-1', date: '2026-10-06', matiere: 'Mathématiques', objectif: 'Équations du premier degré', chapter: 'Équations du premier degré', q3Indicators: ['Isoler X dans une équation'] },
      { sessionId: 'fake-nl-1', date: '2026-10-13', matiere: 'Néerlandais', objectif: 'Mots interrogatifs', chapter: 'Mots interrogatifs', q3Indicators: ['Mobiliser le vocabulaire interrogatif'] },
    ],
  });
  const math = tree.find(group => group.subject === 'Mathématiques').chapters[0];
  const dutch = tree.find(group => group.subject === 'Néerlandais').chapters[0];
  assert.deepEqual(Array.from(math.skills), ['Isoler X dans une équation']);
  assert.deepEqual(Array.from(dutch.skills), ['Mobiliser le vocabulaire interrogatif']);
});

test('IA locale: le flux de constats utilise une API de proposition dédiée, sans service distant', () => {
  assert.match(aiSource, /async function improveTextLocally\(text, action = 'reformulate'\)/);
  assert.match(aiSource, /improve: improveTextLocally/);
  assert.match(aiSource, /N'ajoute aucun fait, diagnostic, cause ou recommandation absent du texte/);
  assert.match(aiSource, /localGrammarCorrect/);
  assert.doesNotMatch(aiSource, /fetch\s*\(|XMLHttpRequest|https?:\/\//);
});
