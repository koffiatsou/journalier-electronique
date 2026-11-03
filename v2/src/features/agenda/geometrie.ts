import { enMinutes, libellePause, pauseAvant, periodeUtilisee } from '../../domain/agenda/index.ts';
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

/**
 * Position verticale (px) d'une heure : dans une période, au prorata de sa durée ; dans une pause, entre le bas de la période
 * précédente et le haut de la suivante ; après la dernière période, la grille se prolonge au même rythme. Avant la première : le haut.
 */
export function yDeMinutes(geo: Geometrie, periodes: readonly Periode[], minutes: number, ph = PH): number {
  let dernier = -1;
  for (let i = 0; i < periodes.length; i++) {
    const p = periodes[i]!;
    if (!periodeUtilisee(p)) continue;
    const debut = enMinutes(p.debut);
    const fin = enMinutes(p.fin);
    if (minutes < debut) {
      if (dernier < 0) return geo.y[i]!;
      const q = periodes[dernier]!;
      const bas = geo.y[dernier]! + ph;
      const prop = (minutes - enMinutes(q.fin)) / Math.max(1, debut - enMinutes(q.fin));
      return bas + prop * (geo.y[i]! - bas);
    }
    if (minutes <= fin) return geo.y[i]! + ((minutes - debut) / Math.max(1, fin - debut)) * ph;
    dernier = i;
  }
  if (dernier < 0) return 0;
  const q = periodes[dernier]!;
  return geo.y[dernier]! + ph + ((minutes - enMinutes(q.fin)) / Math.max(1, enMinutes(q.fin) - enMinutes(q.debut))) * ph;
}
