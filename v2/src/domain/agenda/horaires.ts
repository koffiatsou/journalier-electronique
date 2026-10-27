import { PERIODES_AGENDA } from './types.ts';
import type { Periode } from './types.ts';

/** Nombre de périodes de la journée (1e H à 9e H) : fixe, car les séances et l'agenda les repèrent par ce nom. */
export const NB_PERIODES = PERIODES_AGENDA.length;
/** Avant le lot 10, il y avait huit périodes : les anciens réglages en contiennent huit. */
const NB_PERIODES_ANCIEN = 8;
/** Une période d'au moins cinq minutes. */
const DUREE_MINI = 5;

export const enMinutes = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const heureValide = (h: unknown): h is string => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export interface ErreurHoraire { index: number; message: string }

/** Une période sans aucune heure : l'école ne l'utilise pas. */
const vide = (p: Periode): boolean => !p.debut && !p.fin;

/** Une période réellement utilisée (début et fin valides). */
export const periodeUtilisee = (p: Periode | undefined): boolean => Boolean(p) && heureValide(p!.debut) && heureValide(p!.fin);

/** Combien de périodes (à partir de la première) l'école utilise. */
export function nbPeriodesUtilisees(periodes: readonly Periode[]): number {
  let n = 0;
  while (n < periodes.length && periodeUtilisee(periodes[n])) n++;
  return n;
}

/** Les périodes utilisées (les dernières, laissées sans heures, sont retirées). */
export const periodesUtilisees = (periodes: readonly Periode[]): Periode[] => periodes.slice(0, nbPeriodesUtilisees(periodes));

/**
 * Vérifie les horaires saisis : chaque période commence avant de finir, et la suivante ne commence pas avant la fin de la précédente.
 * Un écart entre deux périodes est une pause (récréation ou midi) ; un écart nul est permis.
 * Les dernières périodes peuvent rester sans heures (l'école ne les utilise pas) ; la première, jamais ; pas de trou au milieu.
 */
export function verifierHoraires(periodes: readonly Periode[]): ErreurHoraire[] {
  const erreurs: ErreurHoraire[] = [];
  let derniere = -1;
  periodes.forEach((p, i) => { if (!vide(p)) derniere = i; });
  periodes.forEach((p, i) => {
    const nom = p.label;
    if (vide(p) && i > derniere) {
      if (i === 0) erreurs.push({ index: i, message: `${nom} : indiquez une heure de début et une heure de fin.` });
      return;
    }
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
 * Relit des horaires enregistrés, ou `null` s'ils sont inutilisables (pas une liste de huit ou neuf périodes, ou horaires incohérents).
 * Les noms (1e H…) ne viennent jamais du stockage. Un ancien réglage à huit périodes reçoit une neuvième période non utilisée.
 */
export function lireHoraires(brut: unknown): Periode[] | null {
  if (!Array.isArray(brut) || (brut.length !== NB_PERIODES && brut.length !== NB_PERIODES_ANCIEN)) return null;
  const lus = PERIODES_AGENDA.map((p, i): Periode => {
    const x = brut[i] as { debut?: unknown; fin?: unknown } | null | undefined;
    return { label: p.label, debut: heureValide(x?.debut) ? x.debut : '', fin: heureValide(x?.fin) ? x.fin : '' };
  });
  return verifierHoraires(lus).length ? null : lus;
}

/** Comme `lireHoraires`, mais une valeur illisible redonne les horaires habituels (on ne bloque jamais l'agenda). */
export const normaliserHoraires = (brut: unknown): Periode[] => lireHoraires(brut) ?? PERIODES_AGENDA.map((p) => ({ ...p }));

export const horairesParDefaut = (): Periode[] => PERIODES_AGENDA.map((p) => ({ ...p }));

export const horairesModifies = (periodes: readonly Periode[]): boolean =>
  periodes.some((p, i) => p.debut !== PERIODES_AGENDA[i]?.debut || p.fin !== PERIODES_AGENDA[i]?.fin);

/** Durée de la pause avant la période i (en minutes), 0 s'il n'y en a pas. */
export const pauseAvant = (periodes: readonly Periode[], i: number): number => {
  const prec = periodes[i - 1];
  const p = periodes[i];
  return prec && p && heureValide(prec.fin) && heureValide(p.debut) ? Math.max(0, enMinutes(p.debut) - enMinutes(prec.fin)) : 0;
};

/** « Récré » pour une courte pause, « Midi » au-delà de 30 minutes (même règle que l'affichage de la grille). */
export const libellePause = (minutes: number): string => (minutes > 30 ? 'Midi' : 'Récré');
