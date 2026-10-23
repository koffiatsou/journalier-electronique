import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadAssistant(referentiel = {}) {
  const script = fs.readFileSync(path.resolve('src/app/local-ai-assistant.js'), 'utf8');
  const document = {
    readyState: 'loading',
    addEventListener() {},
    createElement() { return { textContent: '' }; },
    head: { appendChild() {} }
  };
  const window = { ReferentielAmenagements: referentiel };
  const context = { window, document, console, setTimeout, Event: class Event {} };
  vm.runInNewContext(script, context, { filename: 'local-ai-assistant.js' });
  return window.LocalAIAssistant;
}

test('Assistant local : le dictionnaire reconnaît les accents français', () => {
  const assistant = loadAssistant();
  assert.equal(assistant.normalizeDictionaryText('ÉCRITURE, élève et géométrie'), 'ecriture eleve et geometrie');
});

test('Assistant local : les suggestions attendent le référentiel WBE et combinent dictionnaire et fiches', async () => {
  let loaded = false;
  const fiche = { id: 'FICTIF-01', titre: 'Support de lecture adapté', domaine: 'Lecture', niveau: 'Universel' };
  const assistant = loadAssistant({
    async load() { loaded = true; },
    findBestMatches(text, count) {
      assert.equal(loaded, true, 'le référentiel doit être chargé avant la recherche');
      assert.equal(text, 'La lecture est lente et l’élève saute des lignes.');
      assert.equal(count, 4);
      return [fiche];
    }
  });

  const result = await assistant.suggest('La lecture est lente et l’élève saute des lignes.');
  assert.equal(loaded, true);
  assert.ok(result.themes.some((theme) => theme.category === 'Lecture & Décodage'));
  assert.equal(result.fichesReferentiel[0].id, 'FICTIF-01');
});

test('Assistant local : la reformulation ne rajoute plus une recommandation non présente dans la source', () => {
  const assistant = loadAssistant();
  const result = assistant.reformulate('copie lente');
  assert.match(result, /Copie lente/i);
  assert.doesNotMatch(result, /aménagement adapté est préconisé/i);
  assert.doesNotMatch(result, /soutenir son autonomie/i);
  assert.doesNotMatch(result, /Objectif pédagogique/i);
  assert.doesNotMatch(result, /Lors des activités observées/i);
});
