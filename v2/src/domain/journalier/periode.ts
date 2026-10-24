/**
 * Écran Journalier : choix de la période et des séances à afficher ou exporter.
 * Fonctions pures (dates au format AAAA-MM-JJ, comparées comme du texte).
 */
import { anneeScolaire } from '../export/journalier.ts';
import type { Seance } from '../types.ts';

/** Année scolaire complète, état à ce jour (début de l'année en cours → aujourd'hui), ou dates libres. */
export type Periode =
  | { genre: 'annee'; annee: string }
  | { genre: 'a-ce-jour' }
  | { genre: 'dates'; du: string; au: string };

export interface Bornes { du: string; au: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** « 2026-2027 » → du 1er août 2026 au 31 juillet 2027 (même découpage que les noms de fichiers). */
export function bornesAnnee(annee: string): Bornes | null {
  const m = /^(\d{4})-(\d{4})$/.exec(annee);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return null;
  return { du: `${m[1]}-08-01`, au: `${m[2]}-07-31` };
}

export type ResultatBornes = { ok: true; bornes: Bornes } | { ok: false; raison: string };

export function bornes(p: Periode, aujourdhui: string): ResultatBornes {
  if (p.genre === 'annee') {
    const b = bornesAnnee(p.annee);
    return b ? { ok: true, bornes: b } : { ok: false, raison: 'Choisissez une année scolaire.' };
  }
  if (p.genre === 'a-ce-jour') {
    const b = bornesAnnee(anneeScolaire(aujourdhui));
    return b ? { ok: true, bornes: { du: b.du, au: aujourdhui } } : { ok: false, raison: 'Date du jour illisible.' };
  }
  if (!DATE.test(p.du) || !DATE.test(p.au)) return { ok: false, raison: 'Indiquez la date de début et la date de fin.' };
  if (p.du > p.au) return { ok: false, raison: 'La date de début est après la date de fin.' };
  return { ok: true, bornes: { du: p.du, au: p.au } };
}

export const dansBornes = (date: string, b: Bornes): boolean => date >= b.du && date <= b.au;

/** Plus récente d'abord ; à date égale, la dernière période de la journée d'abord. */
export const plusRecentesDAbord = (a: Seance, b: Seance): number =>
  b.date.localeCompare(a.date) || b.periodeDebut.localeCompare(a.periodeDebut, 'fr', { numeric: true });

/** Séances d'un élève (ou de tous si `eleveId` est vide) dans la période, plus récentes d'abord. */
export function seancesDuJournalier(seances: readonly Seance[], eleveId: string, b: Bornes): Seance[] {
  return seances
    .filter((s) => (!eleveId || s.eleveId === eleveId) && dansBornes(s.date, b))
    .sort(plusRecentesDAbord);
}

/** Années scolaires proposées : celles des séances, plus l'année en cours ; la plus récente en premier. */
export function anneesDisponibles(seances: readonly Seance[], aujourdhui: string): string[] {
  const set = new Set([anneeScolaire(aujourdhui), ...seances.map((s) => anneeScolaire(s.date))].filter(Boolean));
  return [...set].sort().reverse();
}

const jma = (iso: string, sep: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : iso;
};

/**
 * Libellé de la période. `pourFichier` remplace les « / » (interdits dans un nom de fichier) par des « - ».
 * Ex. : « 2026-2027 », « 2026-2027 au 24/10/2026 », « du 01/09/2026 au 31/10/2026 ».
 */
export function libellePeriode(p: Periode, aujourdhui: string, pourFichier = false): string {
  const sep = pourFichier ? '-' : '/';
  if (p.genre === 'annee') return p.annee;
  if (p.genre === 'a-ce-jour') return `${anneeScolaire(aujourdhui)} au ${jma(aujourdhui, sep)}`;
  return `du ${jma(p.du, sep)} au ${jma(p.au, sep)}`;
}
