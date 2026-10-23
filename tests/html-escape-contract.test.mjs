/**
 * Contrat de sécurité et de non-régression :
 * Lot 3 — Unification du moteur d'échappement HTML anti-XSS (src/app/html-escape.js)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('Lot 3 — Échappement HTML : Présence et déclaration dans index.html et vite.config.js', () => {
  const htmlEscapePath = path.resolve('src/app/html-escape.js');
  assert.ok(fs.existsSync(htmlEscapePath), 'src/app/html-escape.js doit exister');

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  assert.ok(
    indexHtml.includes('<script src="./src/app/html-escape.js"></script>'),
    'index.html doit inclure html-escape.js en tête des scripts classiques'
  );

  const viteConfig = fs.readFileSync(path.resolve('vite.config.js'), 'utf-8');
  assert.ok(
    viteConfig.includes("'src/app/html-escape.js'"),
    'vite.config.js doit inclure src/app/html-escape.js dans copyClassicAppScripts'
  );
});

test('Lot 3 — Échappement HTML : Comportement exécutable du module autonome', async () => {
  // Test en environnement sandboxé simulant un contexte navigateur
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { escapeHtml, esc } = sandbox;
  assert.equal(typeof escapeHtml, 'function', 'escapeHtml doit être exposé comme fonction');
  assert.equal(typeof esc, 'function', 'esc doit être exposé comme fonction');
  assert.strictEqual(escapeHtml, esc, 'esc doit être un alias exact de escapeHtml');

  // 1. Valeurs nulles et indéfinies -> chaîne vide
  assert.strictEqual(escapeHtml(null), '', 'null doit retourner une chaîne vide');
  assert.strictEqual(escapeHtml(undefined), '', 'undefined doit retourner une chaîne vide');
  assert.strictEqual(escapeHtml(''), '', 'chaîne vide doit retourner une chaîne vide');

  // 2. Types non-chaînes (nombres, booléens)
  assert.strictEqual(escapeHtml(0), '0', 'le nombre 0 doit être converti en "0"');
  assert.strictEqual(escapeHtml(42), '42', 'le nombre 42 doit être converti en "42"');
  assert.strictEqual(escapeHtml(-3.14), '-3.14', 'les nombres négatifs doivent être convertis en chaîne');
  assert.strictEqual(escapeHtml(true), 'true', 'true doit être converti en "true"');
  assert.strictEqual(escapeHtml(false), 'false', 'false doit être converti en "false"');

  // 3. Échappement strict des 5 caractères sensibles (& < > " ')
  assert.strictEqual(escapeHtml('&'), '&amp;', '& doit être converti en &amp;');
  assert.strictEqual(escapeHtml('<'), '&lt;', '< doit être converti en &lt;');
  assert.strictEqual(escapeHtml('>'), '&gt;', '> doit être converti en &gt;');
  assert.strictEqual(escapeHtml('"'), '&quot;', '" doit être converti en &quot;');
  assert.strictEqual(escapeHtml("'"), '&#39;', "' doit être converti en &#39;");

  // 4. Chaîne combinant tous les caractères sensibles
  const mixed = 'Tom & Jerry <"Amis" & \'Complices\'>';
  assert.strictEqual(
    escapeHtml(mixed),
    'Tom &amp; Jerry &lt;&quot;Amis&quot; &amp; &#39;Complices&#39;&gt;',
    'Tous les caractères sensibles doivent être échappés'
  );

  // 5. Neutralisation des vecteurs d’injection XSS (OWASP Top 10)
  const imgPayload = '<img src=x onerror=alert(1)>';
  assert.strictEqual(
    escapeHtml(imgPayload),
    '&lt;img src=x onerror=alert(1)&gt;',
    'La charge utile <img> doit être complètement neutralisée'
  );

  const scriptPayload = '<script>alert("xss")</script>';
  assert.strictEqual(
    escapeHtml(scriptPayload),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    'La balise <script> doit être complètement neutralisée'
  );

  const attrBreakoutPayload = '" onfocus="alert(\'xss\')"';
  assert.strictEqual(
    escapeHtml(attrBreakoutPayload),
    '&quot; onfocus=&quot;alert(&#39;xss&#39;)&quot;',
    'La sortie d’attribut avec guillemets et apostrophes doit être neutralisée'
  );
});

test('Lot 3 — Échappement HTML : Comparaison et conformité avec l’ancien comportement', () => {
  // L’ancien comportement de local-ai-assistant oubliait l’apostrophe simple (')
  // Le nouveau comportement unifié garantit la neutralisation de l’apostrophe
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const safeEscape = sandbox.escapeHtml;

  // Ancien escapeHtml incomplet (local-ai-assistant historique)
  function legacyIncompleteEscape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const payloadWithApos = "<button onclick='malicious()'>Test</button>";
  assert.notStrictEqual(
    legacyIncompleteEscape(payloadWithApos),
    safeEscape(payloadWithApos),
    'Le nouveau escapeHtml doit être plus strict que l’ancien'
  );
  assert.ok(
    safeEscape(payloadWithApos).includes('&#39;'),
    'Le nouveau escapeHtml neutralise les apostrophes simples avec &#39;'
  );
  assert.strictEqual(
    safeEscape(payloadWithApos).includes("'"),
    false,
    'Aucune apostrophe non-échappée ne doit subsister'
  );
});
