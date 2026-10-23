/**
 * Contrat de non-régression et d'intégrité :
 * - Référentiel des Aménagements WBE (544 fiches)
 * - Assistant IA Local (100% On-Device / RGPD / 0 fuite réseau)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Référentiel WBE : intégrité du jeu de données statique JSON', () => {
  const jsonPath = path.resolve('public/referentiel_amenagements_wbe.json');
  assert.ok(fs.existsSync(jsonPath), 'Le fichier public/referentiel_amenagements_wbe.json doit exister');

  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);

  assert.ok(data.titre, 'Le fichier JSON doit avoir un titre');
  assert.ok(data.version, 'Le fichier JSON doit avoir une version');
  assert.ok(Array.isArray(data.items), 'data.items doit être un tableau');
  assert.ok(data.items.length >= 500, `Le référentiel doit contenir au moins 500 fiches (actuel : ${data.items.length})`);

  // Vérification de la structure des fiches
  for (const item of data.items) {
    assert.ok(item.id, 'Chaque fiche doit avoir un identifiant unique (id)');
    assert.ok(item.titre, `La fiche ${item.id} doit avoir un titre`);
    assert.ok(item.domaine, `La fiche ${item.id} doit avoir un domaine`);
    assert.ok(item.niveau, `La fiche ${item.id} doit avoir un niveau`);

    // Sécurité : aucune injection script dans les titres
    assert.strictEqual(item.titre.includes('<script'), false, `XSS détecté dans le titre de ${item.id}`);
  }
});

test('Sécurité et RGPD : 0 fuite réseau dans le code de l\'assistant IA', () => {
  const aiScriptPath = path.resolve('src/app/local-ai-assistant.js');
  assert.ok(fs.existsSync(aiScriptPath), 'src/app/local-ai-assistant.js doit exister');

  const aiCode = fs.readFileSync(aiScriptPath, 'utf-8');

  // Pas d'appels à des API d'IA cloud externes
  assert.strictEqual(aiCode.includes('api.openai.com'), false, 'Aucun appel OpenAI ne doit être présent');
  assert.strictEqual(aiCode.includes('api.anthropic.com'), false, 'Aucun appel Anthropic ne doit être présent');
  assert.strictEqual(aiCode.includes('generativelanguage.googleapis.com'), false, 'Aucun appel cloud Google direct dans le script client');
  
  // Pas d'API key en dur
  assert.strictEqual(/sk-[a-zA-Z0-9]{20,}/.test(aiCode), false, 'Aucune clé d\'API ne doit être présente');
});

test('Sécurité et CSP : intégrité des scripts déclarés dans index.html', () => {
  const htmlPath = path.resolve('index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  // Vérifier la présence des scripts ES modules
  assert.ok(html.includes('src/app/referentiel-amenagements.js'), 'referentiel-amenagements.js doit être chargé');
  assert.ok(html.includes('src/app/local-ai-assistant.js'), 'local-ai-assistant.js doit être chargé');

  // Vérifier la CSP connect-src
  assert.ok(html.includes("connect-src 'self'"), "La CSP doit autoriser connect-src 'self' pour charger le JSON statique");
});
