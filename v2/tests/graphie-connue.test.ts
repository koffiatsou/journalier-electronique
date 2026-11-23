import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { graphieConnue } from '../src/ui/graphieConnue.ts';

const PROPOSITIONS = ['Mathématiques', 'Français', 'Sciences économiques'];

describe('graphie d’une matière saisie à la main', () => {
  it('reprend la graphie de la proposition (casse et accents ignorés)', () => {
    assert.equal(graphieConnue('français', PROPOSITIONS), 'Français');
    assert.equal(graphieConnue('FRANCAIS', PROPOSITIONS), 'Français');
    assert.equal(graphieConnue('mathematiques', PROPOSITIONS), 'Mathématiques');
  });
  it('garde une matière inconnue telle quelle : elle reste valable', () => {
    assert.equal(graphieConnue('Éducation physique', PROPOSITIONS), 'Éducation physique');
  });
  it('nettoie les espaces en trop', () => {
    assert.equal(graphieConnue('  sciences   économiques ', PROPOSITIONS), 'Sciences économiques');
    assert.equal(graphieConnue('  Néerlandais ', PROPOSITIONS), 'Néerlandais');
  });
  it('une saisie vide reste vide', () => {
    assert.equal(graphieConnue('   ', PROPOSITIONS), '');
  });
});
