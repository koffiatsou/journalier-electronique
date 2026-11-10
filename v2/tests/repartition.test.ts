import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hauteurEstimee, nombreDeColonnes, repartir } from '../src/ui/repartition.ts';

describe('répartition des cartes en colonnes', () => {
  it('compte les colonnes selon la largeur (au moins une)', () => {
    assert.equal(nombreDeColonnes(0), 1);
    assert.equal(nombreDeColonnes(219), 1);
    assert.equal(nombreDeColonnes(460), 2);
    assert.equal(nombreDeColonnes(700), 3);
  });
  it('une carte haute à gauche : plusieurs cartes courtes à droite', () => {
    assert.deepEqual(repartir([400, 100, 100, 100], 2), [[0], [1, 2, 3]]);
  });
  it('garde toutes les cartes, une seule fois, dans l’ordre d’origine par colonne', () => {
    const h = [120, 300, 90, 90, 250, 60, 60];
    const colonnes = repartir(h, 3);
    assert.deepEqual([...colonnes.flat()].sort((a, b) => a - b), h.map((_, i) => i));
    for (const c of colonnes) assert.deepEqual(c, [...c].sort((a, b) => a - b));
  });
  it('équilibre les hauteurs des colonnes', () => {
    const h = [500, 90, 90, 90, 90, 90];
    const somme = (c: number[]) => c.reduce((t, r) => t + (h[r] ?? 0), 0);
    const [a, b] = repartir(h, 2) as [number[], number[]];
    assert.ok(Math.abs(somme(a) - somme(b)) < 250);
  });
  it('une seule colonne : tout dans l’ordre ; aucune carte : colonnes vides', () => {
    assert.deepEqual(repartir([10, 20, 30], 1), [[0, 1, 2]]);
    assert.deepEqual(repartir([], 3), [[], [], []]);
  });
  it('estime une hauteur plus grande pour un texte plus long', () => {
    assert.ok(hauteurEstimee(300, 240) > hauteurEstimee(60, 240));
  });
});
