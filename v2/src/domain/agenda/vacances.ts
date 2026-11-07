import { infosJour } from './calendrier.ts';
import { libelle } from './planning.ts';
import type { Occurrence } from './types.ts';

export interface AvertissementVacances {
  /** Clé de l'occurrence concernée. */
  cles: [string];
  texte: string;
}

/**
 * Dates d'une SÉRIE hebdomadaire qui tombent un jour sans classe (vacances, congé, jour férié) et ne sont pas annulées.
 * Une activité unique n'est jamais signalée : la poser un jour de congé est un choix. Le calendrier ne devine rien :
 * hors des années connues, seuls les jours fériés sont signalés (voir `infosJour`).
 */
export function avertissementsVacances(occ: readonly Occurrence[], nomDe: (o: Occurrence) => string | undefined): AvertissementVacances[] {
  const sortie: AvertissementVacances[] = [];
  for (const o of occ) {
    if (o.activite.repetition !== 'hebdomadaire' || o.statut === 'annule') continue;
    const jour = infosJour(o.date);
    if (!jour.sansClasse || !jour.libelle) continue;
    sortie.push({ cles: [o.cle], texte: `« ${libelle(o.activite, nomDe(o))} » tombe pendant « ${jour.libelle} » (${o.date.split('-').reverse().join('/')}) : annulez cette date si vous n’y allez pas.` });
  }
  return sortie;
}
