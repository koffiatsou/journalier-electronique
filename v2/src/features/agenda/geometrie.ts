import { libellePause, pauseAvant } from '../../domain/agenda/index.ts';
import type { Periode } from '../../domain/agenda/index.ts';

/** Hauteur d'une période et d'une pause, en px (doit rester cohérent avec .grille dans agenda.css). */
export const PH = 60;
export const PAUSE = 20;

export interface Pause { y: number; h: number; libelle: string }
export interface Geometrie { y: number[]; total: number; pauses: Pause[] }

/** Position verticale de chaque période ; une pause (récréation, midi) est un espace entre deux périodes. */
export function geometrie(periodes: readonly Periode[], ph = PH): Geometrie {
  const y: number[] = [];
  const pauses: Pause[] = [];
  let courant = 0;
  periodes.forEach((_, i) => {
    const minutes = pauseAvant(periodes, i);
    if (minutes > 0) {
      pauses.push({ y: courant, h: PAUSE, libelle: libellePause(minutes) });
      courant += PAUSE;
    }
    y.push(courant);
    courant += ph;
  });
  return { y, total: courant, pauses };
}
