import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEXIQUE_ACCOMPAGNEMENTS, LEXIQUE_AIDES, LEXIQUE_NIVEAUX, termesSansDefinition } from '../src/domain/lexique.ts';

describe('lexique de la séance', () => {
  it('chaque aide, type d’accompagnement et niveau proposé a sa définition', () => {
    assert.deepEqual(termesSansDefinition(), []);
  });
  it('aucune définition vide ni double', () => {
    const toutes = [...LEXIQUE_AIDES, ...LEXIQUE_ACCOMPAGNEMENTS, ...LEXIQUE_NIVEAUX];
    assert.ok(toutes.every((e) => e.definition.trim().length > 20));
    assert.equal(new Set(toutes.map((e) => e.terme)).size, toutes.length);
  });
});
