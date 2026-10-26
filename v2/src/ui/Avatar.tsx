import { initiales } from '../domain/eleves/index.ts';
import type { Eleve } from '../domain/types.ts';
import { AvatarDessin } from './AvatarDessin.tsx';

interface Props {
  eleve: Pick<Eleve, 'nom' | 'prenom' | 'avatar'>;
  /** Couleur de l'élève (0–9), celle de l'agenda. */
  couleur: number;
  taille?: 'm' | 'l';
}

/**
 * Pastille ronde de l'élève : son avatar dessiné, sinon ses initiales sur sa couleur (jamais de photo).
 * Décorative : le nom est toujours écrit à côté, donc masquée pour les lecteurs d'écran.
 */
export function Avatar({ eleve, couleur, taille = 'm' }: Props) {
  return (
    <span className={`avatar avatar-${taille} c-${couleur}${eleve.avatar ? ' avatar-dessin' : ''}`} aria-hidden="true">
      {eleve.avatar ? <AvatarDessin avatar={eleve.avatar} /> : initiales(eleve)}
    </span>
  );
}
