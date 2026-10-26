import { PERIODES_AGENDA } from './types.ts';
import type { Periode } from './types.ts';

/** Nombre de périodes de la journée (1e H à 8e H) : fixe, car les séances et l'agenda les repèrent par ce nom. */
export const NB_PERIODES = PERIODES_AGENDA.length;
/** Une période d'au moins cinq minutes. */
const DUREE_MINI = 5;

export const enMinutes = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const heureValide = (h: unknown): h is string => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export interface ErreurHoraire { index: number; message: string }

/**
 * Vérifie les horaires saisis : chaque période commence avant de finir, et la suivante ne commence pas avant la fin de la précédente.
 * Un écart entre deux périodes est une pause (récréation ou midi) ; un écart nul est permis.
 */
export function verifierHoraires(periodes: readonly Periode[]): ErreurHoraire[] {
  const erreurs: ErreurHoraire[] = [];
  periodes.forEach((p, i) => {
    const nom = p.label;
    if (!heureValide(p.debut) || !heureValide(p.fin)) { erreurs.push({ index: i, message: `${nom} : indiquez une heure de début et une heure de fin.` }); return; }
    if (enMinutes(p.fin) - enMinutes(p.debut) < DUREE_MINI) { erreurs.push({ index: i, message: `${nom} : la fin doit venir après le début.` }); return; }
    const prec = periodes[i - 1];
    if (prec && heureValide(prec.fin) && enMinutes(p.debut) < enMinutes(prec.fin)) {
      erreurs.push({ index: i, message: `${nom} : commence avant la fin de ${prec.label} (${prec.fin}).` });
    }
  });
  return erreurs;
}

/**
 * Relit des horaires enregistrés. Les noms (1e H…) ne changent jamais ; une valeur illisible
 * ou un ensemble incohérent redonne les horaires habituels (on ne bloque jamais l'agenda).
 */
export function normaliserHoraires(brut: unknown): Periode[] {
  const defaut = PERIODES_AGENDA.map((p) => ({ ...p }));
  if (!Array.isArray(brut) || brut.length !== NB_PERIODES) return defaut;
  const lus = PERIODES_AGENDA.map((p, i): Periode => {
    const x = brut[i] as { debut?: unknown; fin?: unknown } | null;
    return { label: p.label, debut: heureValide(x?.debut) ? x.debut : '', fin: heureValide(x?.fin) ? x.fin : '' };
  });
  return verifierHoraires(lus).length ? defaut : lus;
}

export const horairesParDefaut = (): Periode[] => PERIODES_AGENDA.map((p) => ({ ...p }));

export const horairesModifies = (periodes: readonly Periode[]): boolean =>
  periodes.some((p, i) => p.debut !== PERIODES_AGENDA[i]!.debut || p.fin !== PERIODES_AGENDA[i]!.fin);

/** Durée de la pause avant la période i (en minutes), 0 s'il n'y en a pas. */
export const pauseAvant = (periodes: readonly Periode[], i: number): number => {
  const prec = periodes[i - 1];
  const p = periodes[i];
  return prec && p ? Math.max(0, enMinutes(p.debut) - enMinutes(prec.fin)) : 0;
};

/** « Récré » pour une courte pause, « Midi » au-delà de 30 minutes (même règle que l'affichage de la grille). */
export const libellePause = (minutes: number): string => (minutes > 30 ? 'Midi' : 'Récré');
