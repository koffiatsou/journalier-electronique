import { initiales } from '../domain/eleves/index.ts';
import type { Eleve } from '../domain/types.ts';

interface Props {
  eleve: Pick<Eleve, 'nom' | 'prenom'>;
  /** Couleur de l'élève (0–9), celle de l'agenda. */
  couleur: number;
  taille?: 'm' | 'l';
}

/**
 * Pastille de couleur avec les initiales de l'élève (pas de photo).
 * Décorative : le nom est toujours écrit à côté, donc masquée pour les lecteurs d'écran.
 */
export function Avatar({ eleve, couleur, taille = 'm' }: Props) {
  return <span className={`avatar avatar-${taille} c-${couleur}`} aria-hidden="true">{initiales(eleve)}</span>;
}
