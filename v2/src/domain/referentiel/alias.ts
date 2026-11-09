import { sansAccents } from './texte.ts';

/** Table d'une matière : expression de terrain → mots que le référentiel emploie. */
export type TableAlias = Readonly<Record<string, string>>;

/**
 * Langage de terrain → vocabulaire du référentiel, PAR MATIÈRE (clé = champ `m` des lignes du référentiel).
 * Chaque clé est une expression telle que les enseignants l'écrivent dans leurs objectifs de leçon ;
 * la valeur ajoute les mots que le référentiel emploie. Une expression n'agit que dans sa matière :
 * « x » ou « signes » ne doivent pas ajouter de mots de mathématiques à un objectif de français.
 * À compléter au fil de l'usage.
 */
export const ALIAS: Readonly<Record<string, TableAlias>> = {
  Mathématiques: {
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
  }
};

/**
 * Ajoute à l'objectif les mots du référentiel qui correspondent aux expressions de terrain de la matière.
 * Sans matière connue (ou matière sans table), l'objectif est rendu tel quel.
 */
export function developper(objectif: string, matiere?: string): string {
  const table = matiere ? ALIAS[matiere] : undefined;
  if (!table) return objectif;
  const n = sansAccents(objectif).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
  const ajouts = Object.entries(table).filter(([k]) => new RegExp(`\\b${k}\\b`).test(n)).map(([, v]) => v);
  return ajouts.length ? `${objectif} ${ajouts.join(' ')}` : objectif;
}
