import { PERIODES_AGENDA } from '../../domain/agenda/index.ts';

/** Hauteur d'une période et d'une pause, en px (doit rester cohérent avec .grille dans agenda.css). */
export const PH = 60;
export const PAUSE = 20;

const minutes = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

export interface Pause { y: number; h: number; libelle: string }
export interface Geometrie { y: number[]; total: number; pauses: Pause[] }

/** Position verticale de chaque période ; une pause (récréation, midi) est un espace entre deux périodes. */
export function geometrie(ph = PH): Geometrie {
  const y: number[] = [];
  const pauses: Pause[] = [];
  let courant = 0;
  PERIODES_AGENDA.forEach((p, i) => {
    const prec = PERIODES_AGENDA[i - 1];
    if (prec && minutes(p.debut) > minutes(prec.fin)) {
      const long = minutes(p.debut) - minutes(prec.fin) > 30;
      pauses.push({ y: courant, h: PAUSE, libelle: long ? 'Midi' : 'Récré' });
      courant += PAUSE;
    }
    y.push(courant);
    courant += ph;
  });
  return { y, total: courant, pauses };
}
