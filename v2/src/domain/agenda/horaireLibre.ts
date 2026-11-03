import { enMinutes, heureValide, periodeUtilisee } from './horaires.ts';
import type { Activite, Periode } from './types.ts';

/** Heures exactes d'une activité qui ne suit pas les périodes (travail de groupe de 13h30 à 16h, par exemple). */
export interface HeuresLibres { debut: string; fin: string }

/** Heures libres d'une activité, ou `null` si elle suit les périodes (ou si les heures enregistrées sont inutilisables). */
export function heuresLibresDe(a: Pick<Activite, 'heureDebut' | 'heureFin'>): HeuresLibres | null {
  const { heureDebut: debut, heureFin: fin } = a;
  return heureValide(debut) && heureValide(fin) && enMinutes(fin) > enMinutes(debut) ? { debut, fin } : null;
}

/** Message d'erreur pour des heures libres saisies, ou `null` si elles sont correctes. */
export function verifierHeuresLibres(debut: string, fin: string): string | null {
  if (!heureValide(debut) || !heureValide(fin)) return 'Indiquez l’heure de début et l’heure de fin.';
  return enMinutes(fin) > enMinutes(debut) ? null : 'L’heure de fin doit venir après l’heure de début.';
}

/**
 * Périodes touchées par des heures libres : de la première période qui finit après le début à la dernière qui commence avant la fin.
 * Elles servent à placer l'activité parmi les autres (colonnes, mois) ; hors des horaires de l'école, on prend la période la plus proche.
 */
export function periodesCouvertes(periodes: readonly Periode[], h: HeuresLibres): { debut: number; fin: number } {
  const utilisees = periodes.map((p, i) => ({ p, i })).filter(({ p }) => periodeUtilisee(p));
  if (!utilisees.length) return { debut: 0, fin: 0 };
  const du = enMinutes(h.debut);
  const au = enMinutes(h.fin);
  const premiere = utilisees.find(({ p }) => enMinutes(p.fin) > du) ?? utilisees[utilisees.length - 1]!;
  const derniere = [...utilisees].reverse().find(({ p }) => enMinutes(p.debut) < au) ?? utilisees[0]!;
  return { debut: premiere.i, fin: Math.max(premiere.i, derniere.i) };
}
