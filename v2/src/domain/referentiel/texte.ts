/** Normalisation du texte français : minuscules, sans accents, sans ponctuation, racine à 6 lettres. */
export const sansAccents = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

const nettoyer = (s: string): string => sansAccents(s).replace(/[^a-z0-9²+\-/ ]/g, ' ');

const MOTS_VIDES = new Set(
  'le la les l un une des du de d et en au aux a à pour par sur dans avec sans ce ces se sa son ses leur leurs qui que qu quoi dont ou où est sont etre afin cf ex ainsi plus moins selon entre vers chez comme comment tres'.split(' ')
);

/** Mots qui décrivent l'organisation de la séance, pas son contenu : seuls, ils ne donnent aucune piste. */
export const MOTS_ADMINISTRATIFS = new Set(
  'interro interrogation interros revision revisions remediation exercice exercices session examen exam dossier film films absent evaluation test bilan preparation correction travail rappel suite chapitre introduction objectif prof video sequence sequences post pre page p autonomie application applications approfondissement consolidation'.split(' ')
);

export function racine(mot: string): string {
  let t = mot;
  if (t.length > 4) {
    if (t.endsWith('aux')) t = `${t.slice(0, -3)}al`;
    else if (t.endsWith('s') || t.endsWith('x')) t = t.slice(0, -1);
  }
  return t.slice(0, 6);
}

export function racines(texte: string): string[] {
  return nettoyer(texte).split(/\s+/).filter((t) => t.length > 1 && !MOTS_VIDES.has(t) && !/^\d+$/.test(t)).map(racine);
}

export const racinesAdministratives = new Set([...MOTS_ADMINISTRATIFS].map(racine));
