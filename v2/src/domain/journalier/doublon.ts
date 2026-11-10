import type { Seance } from '../types.ts';

/**
 * Séance déjà enregistrée pour le même élève, le même jour et la même période de début (une autre que `nouvelle` elle-même).
 * Sans période renseignée on ne peut rien affirmer : aucun doublon n'est signalé.
 * Sert à PRÉVENIR l'agent avant l'enregistrement, jamais à le bloquer : deux séances le même jour peuvent être voulues.
 */
export function seanceEnDoublon(existantes: readonly Seance[], nouvelle: Seance): Seance | undefined {
  if (!nouvelle.periodeDebut) return undefined;
  return existantes.find((s) => s.id !== nouvelle.id && s.eleveId === nouvelle.eleveId && s.date === nouvelle.date && s.periodeDebut === nouvelle.periodeDebut);
}
