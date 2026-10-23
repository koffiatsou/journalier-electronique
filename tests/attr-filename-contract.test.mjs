/**
 * Contrat de sécurité et de non-régression :
 * Lot 5 — Unification de l'échappement d'attributs HTML et sanitisation des noms de fichiers exportés
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('Lot 5 — escapeAttr : Exposition globale et comportement des entités', () => {
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {}, module: { exports: {} } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { escapeAttr } = sandbox;
  assert.equal(typeof escapeAttr, 'function', 'escapeAttr doit être exposé globalement');
  assert.equal(typeof sandbox.module.exports.escapeAttr, 'function', 'escapeAttr doit être exporté par CommonJS');

  // 1. Valeurs nulles et indéfinies
  assert.strictEqual(escapeAttr(null), '', 'null doit retourner une chaîne vide');
  assert.strictEqual(escapeAttr(undefined), '', 'undefined doit retourner une chaîne vide');
  assert.strictEqual(escapeAttr(''), '', 'chaîne vide doit retourner une chaîne vide');

  // 2. Types non-chaînes
  assert.strictEqual(escapeAttr(0), '0', '0 doit retourner "0"');
  assert.strictEqual(escapeAttr(123), '123', '123 doit retourner "123"');

  // 3. Échappement des caractères sensibles aux attributs
  assert.strictEqual(escapeAttr('nom "test"'), 'nom &quot;test&quot;', 'les guillemets doivent être échappés');
  assert.strictEqual(escapeAttr("nom 'test'"), 'nom &#39;test&#39;', 'les apostrophes doivent être échappées');
  assert.strictEqual(escapeAttr('A & B < C > D'), 'A &amp; B &lt; C &gt; D', 'ampersand et chevrons doivent être échappés');
});

test('Lot 5 — sanitizeFilename : Traitement des traversées d\'arborescence et caractères interdits', () => {
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {}, module: { exports: {} } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { sanitizeFilename } = sandbox;
  assert.equal(typeof sanitizeFilename, 'function', 'sanitizeFilename doit être exposé globalement');

  // 1. Repli sur chaîne vide ou types non-chaînes
  assert.strictEqual(sanitizeFilename(''), 'document', 'chaîne vide doit utiliser le fallback');
  assert.strictEqual(sanitizeFilename(null), 'document', 'null doit utiliser le fallback');
  assert.strictEqual(sanitizeFilename(undefined, 'export_secours'), 'export_secours', 'fallback personnalisé doit être respecté');

  // 2. Neutralisation des traversées de répertoires (path traversal .. / \)
  const traversal = '../../../../etc/passwd.docx';
  const sanitizedTraversal = sanitizeFilename(traversal);
  assert.ok(!sanitizedTraversal.includes('/'), 'Aucun slash ne doit être présent');
  assert.ok(!sanitizedTraversal.includes('\\'), 'Aucun antislash ne doit être présent');
  assert.ok(!sanitizedTraversal.includes('..'), 'Aucun double point consécutif ne doit être présent');

  // 3. Suppression des caractères interdits sur les systèmes de fichiers (<>:"/\|?*)
  const badChars = 'Rapport: Élève *Alpha* <test>?|"export".pdf';
  const clean = sanitizeFilename(badChars);
  assert.ok(!/[<>:"/\\|?*]/.test(clean), 'Les caractères réservés doivent être neutralisés');

  // 4. Nettoyage des points et espaces en début/fin
  assert.strictEqual(sanitizeFilename('  ..rapport_eleve.docx.  '), 'rapport_eleve.docx');
});

test('Lot 5 — Délégation cohérente dans referentiel-amenagements.js, local-ai-assistant.js et v74-runtime.js', () => {
  const refCode = fs.readFileSync(path.resolve('src/app/referentiel-amenagements.js'), 'utf-8');
  const aiCode = fs.readFileSync(path.resolve('src/app/local-ai-assistant.js'), 'utf-8');
  const runtimeCode = fs.readFileSync(path.resolve('src/v74/v74-runtime.js'), 'utf-8');

  assert.ok(
    refCode.includes('globalThis.escapeAttr'),
    'referentiel-amenagements.js doit déléguer à globalThis.escapeAttr'
  );
  assert.ok(
    aiCode.includes('globalThis.escapeAttr'),
    'local-ai-assistant.js doit déléguer à globalThis.escapeAttr'
  );
  assert.ok(
    runtimeCode.includes('globalThis.sanitizeFilename'),
    'v74-runtime.js doit déléguer à globalThis.sanitizeFilename dans downloadBytes'
  );
});
