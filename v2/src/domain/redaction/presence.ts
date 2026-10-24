import type { Presence, Seance } from '../types.ts';

export type StatsPresence = Record<Presence, number> & { total: number; tauxPresence: number | null };

/** Compte les séances par statut de présence. Le taux ne compte que « présent » sur le total. */
export function statsPresence(seances: readonly Seance[]): StatsPresence {
  const s: StatsPresence = {
    total: 0, present: 0, absent_eleve: 0, absent_prof: 0, absent_eleve_coteach: 0, absent_agent: 0, tauxPresence: null
  };
  for (const x of seances) { s.total++; s[x.presence]++; }
  s.tauxPresence = s.total ? Math.round((s.present / s.total) * 100) : null;
  return s;
}
