import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mesurer } from './mesure-referentiel.ts';
import type { Lot } from './mesure-referentiel.ts';

/**
 * Planchers mesurés sur le corpus gelé (tests/corpus-referentiel.ts), à relever quand le moteur progresse.
 * Mesure de départ (9/11/2026, avant tout réglage) : réglage 49/56, contrôle 48/56, objectifs vagues 4/4 des deux côtés.
 * Après l'ajout de l'histoire-géographie (10 cas) : réglage 54/61, contrôle 53/61.
 * Après les alias de terrain par matière : réglage 60/61, contrôle 59/61. Après la technique et l'histoire-géographie S4–S6 (11 cas écrits sans regarder les résultats) : réglage 65/67, contrôle 64/66.
 * Après l'éducation physique, les arts, la philosophie et les langues anciennes (15 cas écrits sans regarder les résultats) : réglage 72/74, contrôle 72/74.
 * Après la relecture des tableaux d'unités avec PyMuPDF (sciences S3–S6 fines, géographie, histoire-géographie, philosophie) : réglage 73/74, contrôle 72/74.
 * Attention : les échecs des deux lots avaient été
 * affichés avant d'écrire ces alias, donc le lot de contrôle n'est plus indépendant ; la mesure honnête est celle de départ.
 */
const PLANCHER: Record<Lot, number> = { reglage: 74, controle: 72 };

describe('moteur de pistes : corpus d’objectifs de terrain', () => {
  for (const lot of ['reglage', 'controle'] as const) {
    it(`lot ${lot} : le nombre de pistes trouvées ne baisse pas`, () => {
      const m = mesurer(lot);
      assert.ok(m.trouves >= PLANCHER[lot], `${m.trouves}/${m.repondables} (plancher ${PLANCHER[lot]}) ; échecs : ${m.echecs.join(' ; ')}`);
    });
    it(`lot ${lot} : un objectif vague ne donne jamais de piste`, () => {
      const m = mesurer(lot);
      assert.equal(m.vagues_sans_piste, m.vagues);
    });
  }
});
