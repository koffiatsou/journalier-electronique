import test from 'node:test';
import assert from 'node:assert/strict';
import { menuEffectif } from '../src/ui/menu.ts';

test('sans choix, la Séance se replie dans la plage de largeurs et nulle part ailleurs', () => {
  assert.equal(menuEffectif(null, 'seance', true), 'reduit');
  assert.equal(menuEffectif(null, 'seance', false), null);
  assert.equal(menuEffectif(null, 'journalier', true), null);
});

test('le choix de l’utilisateur n’est jamais écrasé par le repli automatique', () => {
  assert.equal(menuEffectif('ouvert', 'seance', true), 'ouvert');
  assert.equal(menuEffectif('reduit', 'accueil', false), 'reduit');
});
