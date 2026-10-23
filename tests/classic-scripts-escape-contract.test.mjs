import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

test('Lot 5B-bis — Ordre de chargement des scripts classiques, unicité d\'escapeHtml et absence de récursion', async () => {
  // Scripts classiques dans l'ordre exact déclaré dans index.html (l. 967 à 976)
  const classicScripts = [
    'src/app/html-escape.js',
    'src/app/indicators.js',
    'src/app/storage-vault.js',
    'src/v74/v74-docx-export.js',
    'src/v74/v74-pdf-export.js',
    'src/app/students-core.js',
    'src/app/agenda-core.js',
    'src/app/sessions-core.js',
    'src/app/reports-core.js',
    'src/app/journalier-core.js'
  ];

  // Environnement global simulant le navigateur
  const sandbox = {
    console,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    Math,
    RegExp,
    Set,
    Map,
    Uint8Array,
    JSON,
    URLSearchParams,
    location: { search: '' },
    fetch: async (url) => {
      if (typeof url === 'string' && url.includes('bibliotheque_indicateurs_v0_5_1.json')) {
        const raw = await fs.readFile(path.join(root, 'public/bibliotheque_indicateurs_v0_5_1.json'), 'utf8');
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(raw)
        };
      }
      return { ok: false, status: 404 };
    },
    MutationObserver: class { observe() {} disconnect() {} },
    document: (() => {
      const makeEl = () => ({
        style: { setProperty() {}, removeProperty() {} },
        dataset: {},
        options: [],
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        appendChild: () => {},
        replaceChildren: () => {},
        setAttribute: () => {},
        removeAttribute: () => {},
        getAttribute: () => null,
        closest: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => null
      });
      return {
        createElement: () => makeEl(),
        head: makeEl(),
        body: makeEl(),
        getElementById: () => makeEl(),
        querySelectorAll: () => [],
        querySelector: () => makeEl(),
        addEventListener: () => {},
        removeEventListener: () => {}
      };
    })(),
    addEventListener: () => {},
    removeEventListener: () => {},
    navigator: {}
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  // Exécution séquentielle de chaque script dans le contexte partagé
  for (const relPath of classicScripts) {
    const code = await fs.readFile(path.join(root, relPath), 'utf8');
    const script = new vm.Script(code, { filename: relPath });
    script.runInContext(context);
  }

  // 1. Vérification que globalThis.escapeHtml est fonctionnel et identique à la version canonique
  assert.strictEqual(typeof context.escapeHtml, 'function', 'escapeHtml doit être disponible sur le contexte global');
  assert.strictEqual(typeof context.window.escapeHtml, 'function', 'window.escapeHtml doit être défini');
  assert.strictEqual(context.escapeHtml, context.window.escapeHtml, 'escapeHtml global et window.escapeHtml doivent être identiques');

  // Test de comportement sans récursion
  const rawInput = '<script>alert("Élève & Co \'test\'")</script>';
  const escaped = context.escapeHtml(rawInput);
  assert.strictEqual(
    escaped,
    '&lt;script&gt;alert(&quot;Élève &amp; Co &#39;test&#39;&quot;)&lt;/script&gt;',
    'escapeHtml doit échapper les 5 entités HTML sans récursion'
  );

  // 2. Vérification de xmlEsc
  assert.strictEqual(typeof context.xmlEsc, 'function', 'xmlEsc doit être disponible globalement');
  assert.strictEqual(typeof context.escapeXml, 'function', 'escapeXml doit être disponible globalement');
  const rawXml = '<balise attr="test & value \x00">' + "'" + '</balise>';
  const escapedXml = context.xmlEsc(rawXml);
  assert.ok(
    escapedXml.includes('&lt;balise attr=&quot;test &amp; value ') && escapedXml.includes('&apos;&lt;/balise&gt;'),
    'xmlEsc doit échapper les entités XML et filtrer les caractères de contrôle XML 1.0'
  );
  assert.strictEqual(escapedXml.includes('\x00'), false, 'Les caractères de contrôle nuls doivent être éliminés');

  // 3. Vérification de esc (disponible dans v74-docx-export via window.JournalierDocx ou module)
  assert.strictEqual(typeof context.esc, 'function', 'esc doit être un alias vers escapeHtml');
  assert.strictEqual(context.esc(rawInput), escaped, 'esc doit produire le même résultat que escapeHtml');

  // 4. Preuve que la fonction active est strictement le code canonique de html-escape.js
  const expectedBody = "function escapeHtml(value) {\n    if (value === null || value === undefined) {\n        return '';\n    }\n    return String(value).replace(HTML_ESCAPE_PATTERN, function (ch) {\n        return HTML_ESCAPE_ENTITIES[ch] || ch;\n    });\n}";
  assert.strictEqual(
    context.escapeHtml.toString().replace(/\s+/g, ''),
    expectedBody.replace(/\s+/g, ''),
    'escapeHtml actif à la fin du chargement doit être exactement la fonction canonique de html-escape.js'
  );

  // 5. Vérification du chargement réussi et du fallback 404 de la bibliothèque d'indicateurs WBE
  await context.loadIndicatorLibrary();
  assert.strictEqual(context.JOURNALIER_DIAGNOSTICS?.indicatorLibrary?.status, 'loaded', 'La bibliothèque doit être dans l’état loaded après succès');
  assert.ok(typeof context.window?.findIndicatorById === 'function', 'findIndicatorById doit être disponible sur window');
  assert.strictEqual(context.JOURNALIER_DIAGNOSTICS?.indicatorLibrary?.count, 179, '179 indicateurs d’apprentissage doivent être chargés');

  // Test du scénario 404 contrôlé
  context.fetch = async () => ({ ok: false, status: 404 });
  await context.loadIndicatorLibrary();
  assert.strictEqual(context.JOURNALIER_DIAGNOSTICS?.indicatorLibrary?.status, 'error', 'Le statut doit passer en error lors d’un 404');
  assert.match(context.JOURNALIER_DIAGNOSTICS?.indicatorLibrary?.error, /HTTP 404/);
});

