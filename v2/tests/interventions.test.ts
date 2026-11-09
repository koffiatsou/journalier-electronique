import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INTERVENTIONS_SUGGEREES, interventionsAffichees } from '../src/domain/types.ts';

describe('types d’accompagnement (« Mon intervention »)', () => {
  it('propose les cinq façons d’intervenir, avec les mots précisés', () => {
    assert.deepEqual([...INTERVENTIONS_SUGGEREES], [
      'Accompagnement individuel', 'Accompagnement collectif (en classe)', 'Atelier groupe classe', 'Co-intervention', 'Co-enseignement'
    ]);
  });
  it('une séance sans ancien mot n’ajoute rien', () => {
    assert.deepEqual(interventionsAffichees(['Atelier groupe classe']), [...INTERVENTIONS_SUGGEREES]);
  });
  it('un ancien mot déjà enregistré reste affiché, pour pouvoir le décocher', () => {
    const choix = interventionsAffichees(['Accompagnement groupe classe', 'Coenseignement', 'Accompagnement individuel']);
    assert.deepEqual(choix.slice(5), ['Accompagnement groupe classe', 'Coenseignement']);
    assert.equal(choix.filter((c) => c === 'Accompagnement individuel').length, 1);
  });
});
