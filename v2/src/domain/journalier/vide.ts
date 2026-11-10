import type { Seance } from '../types.ts';

/**
 * Vrai pour une séance où l'élève était présent mais où il n'y a rien à écrire : ni objectif de la leçon, ni observation,
 * ni compétence, ni aide. Sert à demander confirmation avant l'enregistrement.
 * Dès que l'objectif de la leçon est noté, la séance est complète pour le Journalier : le moteur de rédaction écrit alors
 * « Séance sans observation particulière. » (rien à signaler), donc on ne demande rien.
 * Une séance d'absence n'a rien à noter : elle n'est jamais « vide ».
 */
export function sansPointNote(s: Seance): boolean {
  return s.presence === 'present' && s.objectifLecon.trim() === '' && s.observations.length + s.competences.length + s.aides.length === 0;
}
