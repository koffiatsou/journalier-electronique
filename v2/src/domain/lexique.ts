import { AIDES_SUGGEREES, INTERVENTIONS_SUGGEREES, NIVEAUX_LIBELLES, NIVEAUX_VIGILANCE } from './types.ts';

/**
 * Lexique de l'écran Séance : ce que veut dire chaque mot proposé. Textes validés par l'utilisateur le
 * 10/11/2026 ; une phrase ou deux, sans jargon, « l'élève » neutre. Un test refuse un mot proposé sans définition.
 */
export interface EntreeLexique {
  terme: string;
  definition: string;
  /** Une situation concrète, facultative. */
  exemple?: string;
}

export const LEXIQUE_AIDES: readonly EntreeLexique[] = [
  { terme: 'Reformulation', definition: 'Redire la consigne ou la question avec d’autres mots, plus simples ou plus courts, pour que l’élève la comprenne.', exemple: '« Tu dois trouver combien il en reste. »' },
  { terme: 'Explicitation / verbalisation', definition: 'Dire à voix haute la démarche, étape par étape : l’élève explique ce qu’il fait et pourquoi, ou vous le faites à sa place pour qu’il l’entende.' },
  { terme: 'Support visuel', definition: 'Schéma, dessin, tableau, code couleur, ligne du temps… qui rend visible une information ou une consigne.' },
  { terme: 'Gabarit / fiche outil', definition: 'Document prêt à l’emploi qui guide la tâche : trame à compléter, modèle de phrase, fiche de méthode, formulaire de formules.' },
  { terme: 'Décomposition', definition: 'Découper une tâche ou un problème en petites étapes à réaliser l’une après l’autre.', exemple: 'Un problème de maths en trois questions : que cherche-t-on ? quelles données ? quelle opération ?' },
  { terme: 'Modélisation', definition: 'Montrer comment faire en réalisant soi-même un exemple, en pensant à voix haute, avant de laisser l’élève essayer.' },
  { terme: 'Guidage verbal', definition: 'Poser des questions ou donner de courtes indications orales pendant la tâche pour orienter l’élève sans lui donner la réponse.' },
  { terme: 'Aide organisation', definition: 'Aider à planifier et à ordonner : agenda, ordre des étapes, rangement du matériel, gestion du temps.' },
  { terme: 'Outil numérique', definition: 'Ordinateur, tablette, logiciel, correcteur, synthèse vocale, calculatrice… utilisé comme aide.' },
  { terme: 'Matériel', definition: 'Objet concret ou matériel de manipulation : cubes, bandes de fractions, règle, surligneurs, guide-ligne…' },
  { terme: 'Environnement', definition: 'Changer le cadre de travail : place dans la classe, endroit plus calme, moins de distractions, casque anti-bruit.' },
  { terme: 'Autre', definition: 'Toute aide qui n’est pas dans la liste. Précisez-la dans la case « Précision » juste dessous.' }
];

export const LEXIQUE_ACCOMPAGNEMENTS: readonly EntreeLexique[] = [
  { terme: 'Accompagnement individuel', definition: 'Vous voyez l’élève seul, en dehors de la classe.' },
  { terme: 'Accompagnement collectif (en classe)', definition: 'Vous êtes dans la classe avec l’élève : vous restez à côté de lui ou vous circulez pour aider aussi d’autres élèves.' },
  { terme: 'Atelier groupe classe', definition: 'Vous travaillez spécifiquement avec un groupe d’élèves de la classe, par exemple après une répartition convenue avec l’enseignant, pour des exercices précis.' },
  { terme: 'Co-intervention', definition: 'Une intervention planifiée : l’enseignant et vous vous êtes concertés pour mettre en œuvre un programme ensemble.' },
  { terme: 'Co-enseignement', definition: 'Vous préparez la matière avec l’enseignant et la donnez toujours conjointement, avec autant d’heures que lui. C’est rarement possible dans la fonction : à n’utiliser que si c’est vraiment le cas.' }
];

/** Les niveaux d'une observation ou d'une compétence, puis la fréquence d'un point de vigilance. */
export const LEXIQUE_NIVEAUX: readonly EntreeLexique[] = [
  { terme: 'Pas du tout', definition: 'Ce comportement ou cette compétence n’apparaît pas, même avec de l’aide.' },
  { terme: 'Un peu', definition: 'Cela apparaît par moments, ou seulement avec beaucoup d’aide : encore fragile.' },
  { terme: 'Assez', definition: 'Cela apparaît le plus souvent, avec un rappel ou un petit coup de pouce : en voie d’acquisition.' },
  { terme: 'Tout à fait', definition: 'Cela apparaît de façon stable et sans aide : acquis.' },
  { terme: 'Ponctuellement', definition: 'Point de vigilance : la difficulté se voit de temps en temps seulement.' },
  { terme: 'Souvent', definition: 'Point de vigilance : la difficulté revient régulièrement pendant la séance.' },
  { terme: 'Tout au long', definition: 'Point de vigilance : la difficulté est présente presque toute la séance.' }
];

/** Termes proposés qui n'ont pas de définition (le test doit en trouver zéro). */
export function termesSansDefinition(): string[] {
  const definis = new Set([...LEXIQUE_AIDES, ...LEXIQUE_ACCOMPAGNEMENTS, ...LEXIQUE_NIVEAUX].map((e) => e.terme));
  return [...AIDES_SUGGEREES, ...INTERVENTIONS_SUGGEREES, ...NIVEAUX_LIBELLES, ...NIVEAUX_VIGILANCE].filter((t) => !definis.has(t));
}
