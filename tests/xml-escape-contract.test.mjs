/**
 * Contrat de sécurité et de non-régression :
 * Lot 4 — Unification et assainissement de l'échappement XML OpenXML / Word (src/app/html-escape.js)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('Lot 4 — Échappement XML : Exposition globale et par module', () => {
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {}, module: { exports: {} } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { escapeXml, xmlEsc } = sandbox;
  assert.equal(typeof escapeXml, 'function', 'escapeXml doit être exposé globalement');
  assert.equal(typeof xmlEsc, 'function', 'xmlEsc doit être exposé globalement comme alias');
  assert.strictEqual(escapeXml, xmlEsc, 'xmlEsc doit être un alias exact de escapeXml');

  const modExports = sandbox.module.exports;
  assert.equal(typeof modExports.escapeXml, 'function', 'escapeXml doit être exporté par CommonJS');
  assert.equal(typeof modExports.xmlEsc, 'function', 'xmlEsc doit être exporté par CommonJS');
});

test('Lot 4 — Échappement XML : Comportement des entités et valeurs nulles/primitives', () => {
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { escapeXml } = sandbox;

  // Valeurs nulles et indéfinies
  assert.strictEqual(escapeXml(null), '', 'null doit retourner une chaîne vide');
  assert.strictEqual(escapeXml(undefined), '', 'undefined doit retourner une chaîne vide');
  assert.strictEqual(escapeXml(''), '', 'chaîne vide doit retourner une chaîne vide');

  // Primitives
  assert.strictEqual(escapeXml(0), '0', '0 numérique doit retourner "0"');
  assert.strictEqual(escapeXml(42), '42', '42 numérique doit retourner "42"');
  assert.strictEqual(escapeXml(true), 'true', 'true booléen doit retourner "true"');

  // 5 entités canoniques XML
  assert.strictEqual(escapeXml('&'), '&amp;', '& doit être converti en &amp;');
  assert.strictEqual(escapeXml('<'), '&lt;', '< doit être converti en &lt;');
  assert.strictEqual(escapeXml('>'), '&gt;', '> doit être converti en &gt;');
  assert.strictEqual(escapeXml('"'), '&quot;', '" doit être converti en &quot;');
  assert.strictEqual(escapeXml("'"), '&apos;', "' doit être converti en &apos;");

  // Chaîne complexe combinée
  const complex = `<élève nom="Dupont & Frères" note='10 > 5' />`;
  const expected = `&lt;élève nom=&quot;Dupont &amp; Frères&quot; note=&apos;10 &gt; 5&apos; /&gt;`;
  assert.strictEqual(escapeXml(complex), expected);
});

test('Lot 4 — Échappement XML : Élimination stricte des caractères de contrôle illégaux XML 1.0', () => {
  const scriptContent = fs.readFileSync(path.resolve('src/app/html-escape.js'), 'utf-8');
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const { escapeXml } = sandbox;

  // Caractères de contrôle illégaux en XML 1.0 (corrompent les fichiers Word docx) :
  // 0x00 à 0x08, 0x0B, 0x0C, 0x0E à 0x1F
  const corruptInput = "Élève\x00Test\x01avec\x08caractères\x0Bde\x0Ccontrôle\x1F.";
  const sanitized = escapeXml(corruptInput);
  assert.strictEqual(sanitized, "ÉlèveTestaveccaractèresdecontrôle.");

  // Vérifier la préservation des espaces blancs valides : \t (0x09), \n (0x0A), \r (0x0D)
  const validWhitespace = "Ligne 1\n\tLigne 2\r\nFin";
  assert.strictEqual(escapeXml(validWhitespace), "Ligne 1\n\tLigne 2\r\nFin");
});

test('Lot 4 — Délégation cohérente dans v74-docx-export.js et v74-runtime.js', () => {
  const docxExportCode = fs.readFileSync(path.resolve('src/v74/v74-docx-export.js'), 'utf-8');
  const runtimeCode = fs.readFileSync(path.resolve('src/v74/v74-runtime.js'), 'utf-8');

  assert.ok(
    docxExportCode.includes('globalThis.escapeXml'),
    'v74-docx-export.js doit déléguer à globalThis.escapeXml'
  );
  assert.ok(
    runtimeCode.includes('globalThis.escapeXml'),
    'v74-runtime.js doit déléguer à globalThis.escapeXml'
  );
});
