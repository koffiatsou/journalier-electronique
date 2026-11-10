import type { Eleve } from '../types.ts';

type NomEleve = Pick<Eleve, 'nom' | 'prenom'>;

const joindre = (premier: string, second: string): string => `${premier} ${second}`.trim();

/**
 * Nom d'un élève tel qu'il s'écrit à l'écran : prénom puis nom (décision du 7/11/2026).
 * Un seul ordre sur tous les écrans, pour ne pas chercher « Alpha Élève » là où l'agenda écrit « Élève Alpha ».
 */
export function nomAffiche(e: NomEleve): string {
  return joindre(e.prenom, e.nom);
}

/**
 * Clé pour trier une liste d'élèves : nom puis prénom.
 * On ne trie JAMAIS sur `nomAffiche` : la liste serait rangée par prénom au lieu de l'être par nom de famille.
 */
export function cleDeTri(e: NomEleve): string {
  return joindre(e.nom, e.prenom);
}

/** Nom d'un élève dans un document (texte de réunion, impression, Word) : nom puis prénom, comme le modèle officiel. */
export function nomDeDocument(e: NomEleve): string {
  return joindre(e.nom, e.prenom);
}
