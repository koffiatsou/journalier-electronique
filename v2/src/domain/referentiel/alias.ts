import { sansAccents } from './texte.ts';

/**
 * Langage de terrain → vocabulaire du référentiel.
 * Chaque clé est une expression telle que les enseignants l'écrivent dans leurs objectifs de leçon ;
 * la valeur ajoute les mots que le référentiel emploie. À compléter au fil de l'usage.
 */
export const ALIAS: Readonly<Record<string, string>> = {
  'regle des signes': 'positif negatif entier operation',
  'regles des signes': 'positif negatif entier operation',
  'regle signes': 'positif negatif entier operation',
  signes: 'positif negatif',
  sohcahtoa: 'rapport trigonometrique sinus cosinus tangente triangle rectangle',
  'ensembles de nombres': 'naturel entier rationnel reel nombre',
  'termes semblables': 'expression algebrique reduction termes semblables',
  'algebre litterale': 'expression algebrique',
  racine: 'racine carree',
  racines: 'racine carree',
  'angles complementaires': 'angle complementaire supplementaire',
  'tableau d horner': 'polynome division',
  horner: 'polynome division',
  'valeur absolue': 'valeur absolue nombre',
  'ordonnees abscisses': 'repere orthonorme coordonnees',
  ordonnees: 'repere coordonnees',
  abscisses: 'repere coordonnees',
  x: 'inconnue equation'
};

export function developper(objectif: string): string {
  const n = sansAccents(objectif).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
  const ajouts = Object.entries(ALIAS).filter(([k]) => new RegExp(`\\b${k}\\b`).test(n)).map(([, v]) => v);
  return ajouts.length ? `${objectif} ${ajouts.join(' ')}` : objectif;
}
