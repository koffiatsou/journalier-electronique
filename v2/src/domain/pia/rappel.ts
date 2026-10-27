import { synthese } from '../redaction/index.ts';
import type { Seance } from '../types.ts';

/** Ce que les séances ont noté depuis le procès-verbal 1, pour aider à évaluer un objectif. */
export interface Rappel {
  /** Séances d'accompagnement concernées. */
  seances: number;
  appuis: string[];
  aTravailler: string[];
  competences: string[];
  /** Vrai si la date du PV 1 manque : on a alors pris toutes les séances de l'année. */
  sansDate: boolean;
}

/**
 * Séances de l'élève après la date du PV 1 (toutes celles de l'année si la date manque), dans la matière de l'objectif
 * (toutes les matières si l'objectif n'en a pas). Les séances d'absence ne comptent pas.
 */
export function rappelDepuisPv1(seances: readonly Seance[], datePv1: string, matiere: string): Rappel {
  const liste = seances.filter((s) => (!datePv1 || s.date > datePv1) && (!matiere || s.matiere === matiere));
  const sy = synthese(liste);
  const unique = (l: string[]): string[] => [...new Set(l)];
  return {
    seances: sy.seances,
    appuis: unique(sy.matieres.flatMap((m) => m.appuis)),
    aTravailler: unique(sy.matieres.flatMap((m) => m.aTravailler)),
    competences: unique(sy.matieres.flatMap((m) => m.competences)),
    sansDate: !datePv1
  };
}
