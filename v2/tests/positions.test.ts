import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerMemoirePositions } from '../src/app/positions.ts';
import type { Historique } from '../src/app/positions.ts';

/** Faux historique : une entrée à la fois, `aller` simule un changement d'entrée (nouvelle ou déjà visitée). */
function fauxHistorique(etatInitial: unknown = null) {
  const h = {
    state: etatInitial as unknown,
    replaceState(etat: unknown) { h.state = etat; }
  };
  return h satisfies Historique;
}

let n = 0;
const cle = () => `entree-${++n}`;

describe('position de défilement par entrée de l’historique', () => {
  it('une entrée neuve reçoit une clé, une seule fois, sans perdre son état', () => {
    const h = fauxHistorique({ autre: 1 });
    const m = creerMemoirePositions(h, cle);
    m.marquer();
    const premiere = (h.state as { cleDefilement: string }).cleDefilement;
    m.marquer();
    assert.equal((h.state as { cleDefilement: string }).cleDefilement, premiere);
    assert.equal((h.state as { autre: number }).autre, 1);
  });

  it('une entrée neuve n’a pas de position à reprendre : on arrive en haut', () => {
    const h = fauxHistorique();
    const m = creerMemoirePositions(h, cle);
    m.marquer();
    assert.equal(m.aReprendre(), undefined);
  });

  it('retrouve la position quittée en revenant sur l’entrée (« Précédent »), sans la mélanger avec les autres', () => {
    const h = fauxHistorique();
    const m = creerMemoirePositions(h, cle);
    m.marquer();
    m.noter(800);
    const journalier = h.state;

    h.state = null; // lien du menu : entrée neuve
    m.marquer();
    m.noter(120);
    const eleves = h.state;
    assert.equal(m.aReprendre(), 120);

    h.state = journalier; // « Précédent »
    assert.equal(m.aReprendre(), 800);
    h.state = eleves; // « Suivant »
    assert.equal(m.aReprendre(), 120);
  });

  it('ignore les défilements pendant un changement d’écran (le navigateur y repose la page tout seul)', () => {
    const h = fauxHistorique();
    const m = creerMemoirePositions(h, cle);
    m.marquer();
    m.noter(800);
    m.geler();
    m.noter(0); // le navigateur restitue une position sur une page encore vide
    assert.equal(m.aReprendre(), 800);
    m.degeler();
    m.noter(300);
    assert.equal(m.aReprendre(), 300);
  });

  it('sans clé, rien n’est retenu', () => {
    const h = fauxHistorique();
    const m = creerMemoirePositions(h, cle);
    m.noter(500);
    m.marquer();
    assert.equal(m.aReprendre(), undefined);
  });
});
