import type { Seance } from '../types.ts';

/**
 * Vrai pour une séance où l'élève était présent mais où aucun point n'est noté (ni observation, ni compétence, ni aide).
 * Une séance d'absence n'a rien à noter : elle n'est jamais « vide ». Sert à demander confirmation avant l'enregistrement.
 */
export function sansPointNote(s: Seance): boolean {
  return s.presence === 'present' && s.observations.length + s.competences.length + s.aides.length === 0;
}
