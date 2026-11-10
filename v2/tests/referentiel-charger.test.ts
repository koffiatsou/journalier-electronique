import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { indexDe } from '../src/domain/referentiel/charger.ts';
import { cibleDeMatiere } from '../src/domain/referentiel/index.ts';
import type { Jeu } from '../src/domain/referentiel/index.ts';

/** Chaque matière que l'écran Séance sait reconnaître doit aussi se charger : un jeu déclaré mais absent du chargeur casserait l'étape « Compétence ». */
const MATIERES: Record<Jeu, string> = {
  mathematiques: 'Mathématiques',
  francais: 'Français',
  langues: 'Néerlandais',
  sciences: 'Sciences',
  economie: 'Sciences économiques',
  'histoire-geographie': 'Histoire',
  technique: 'Technologie',
  'education-physique': 'Éducation physique',
  arts: 'Éducation artistique',
  philosophie: 'Philosophie et citoyenneté',
  'langues-anciennes': 'Latin'
};

describe('chargement des jeux du référentiel', () => {
  for (const [jeu, matiere] of Object.entries(MATIERES) as [Jeu, string][]) {
    it(`${matiere} → ${jeu} : reconnu, chargé, non vide`, async () => {
      assert.equal(cibleDeMatiere(matiere)?.jeu, jeu);
      const index = await indexDe(jeu);
      assert.ok(index.taille > 100, `${jeu} : ${index.taille} lignes`);
    });
  }
});
