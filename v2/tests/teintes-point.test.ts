import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NIVEAUX_LIBELLES, NIVEAUX_VIGILANCE } from '../src/domain/types.ts';
import { TEINTES_EFFET, TEINTES_NIVEAU, TEINTES_VIGILANCE } from '../src/ui/Point.tsx';

describe('teintes des pastilles de la séance', () => {
  it('une teinte par échelon, pour chaque échelle', () => {
    assert.equal(TEINTES_NIVEAU.length, NIVEAUX_LIBELLES.length);
    assert.equal(TEINTES_VIGILANCE.length, NIVEAUX_VIGILANCE.length);
  });
  it('« Pas du tout » est une teinte d\'attention, pas le gris de « rien à signaler »', () => {
    assert.equal(TEINTES_NIVEAU[0], 'attention-fort');
    assert.notEqual(TEINTES_NIVEAU[0], 'neutre');
  });
  it('le point de vigilance n\'emprunte aucune teinte des niveaux d\'acquisition ni des effets', () => {
    const autres = new Set([...TEINTES_NIVEAU, ...TEINTES_EFFET]);
    for (const t of TEINTES_VIGILANCE) assert.equal(autres.has(t), false, `${t} est déjà pris`);
  });
  it('les trois fréquences ont trois teintes différentes', () => {
    assert.equal(new Set(TEINTES_VIGILANCE).size, TEINTES_VIGILANCE.length);
  });
});
