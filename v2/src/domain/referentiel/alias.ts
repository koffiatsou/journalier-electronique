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
    x: 'inconnue equation',
    'regle de trois': 'proportionnalite grandeurs proportionnelles',
    'regles de trois': 'proportionnalite grandeurs proportionnelles',
    thales: 'proportionnalite triangles semblables',
    pythagore: 'theoreme triangle rectangle',
    pgcd: 'diviseur commun',
    ppcm: 'multiple commun',
    relatifs: 'entier relatif positif negatif',
    discriminant: 'equation second degre',
    mediane: 'statistique',
    moyenne: 'statistique'
  },
  Français: {
    cod: 'complement objet direct fonction',
    coi: 'complement objet indirect fonction',
    cc: 'complement circonstanciel fonction',
    pp: 'participe passe accord',
    gn: 'groupe nominal',
    gv: 'groupe verbal',
    'accord sujet verbe': 'accord sujet verbe',
    dictee: 'orthographe',
    conjugaison: 'verbe temps conjugaison',
    'texte argumentatif': 'argumenter defendre opinion',
    'champ lexical': 'lexique vocabulaire'
  },
  Sciences: {
    mole: 'quantite de matiere',
    ohm: 'tension intensite resistance courant electrique',
    adn: 'gene chromosome heredite',
    ph: 'acide base',
    mitose: 'division cellulaire cellule',
    densite: 'masse volumique masse volume',
    newton: 'force',
    mru: 'mouvement vitesse'
  },
  'Langues modernes': {
    restaurant: 'commander situation vie quotidienne conversation',
    'se presenter': 'identite personne presenter',
    akkusativ: 'accusatif declinaison cas',
    nombres: 'nombre numeraux cardinaux',
    heure: 'temps horaire'
  },
  'Histoire-géographie': {
    frise: 'frise chronologique temps',
    carte: 'carte localiser plan croquis'
  },
  'Sciences économiques': {
    'offre et demande': 'marche prix',
    inflation: 'prix monnaie',
    chomage: 'emploi travail marche du travail',
    impots: 'impot taxe fiscalite finances publiques',
    tva: 'fiscalite indirecte impot',
    budget: 'budget menage consommation revenu',
    bourse: 'bourse marche financier'
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
