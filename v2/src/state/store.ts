import { useSyncExternalStore } from 'react';
import type { Depot } from '../data/repository.ts';
import type { Eleve, Seance } from '../domain/types.ts';

export interface Etat {
  pret: boolean;
  erreur: string | null;
  eleves: Eleve[];
  seances: Seance[];
}

const initial: Etat = { pret: false, erreur: null, eleves: [], seances: [] };

/** Petit magasin d'état : une source de vérité en mémoire, écrite dans le dépôt à chaque action. */
export function creerMagasin(depot: Depot) {
  let etat: Etat = initial;
  const abonnes = new Set<() => void>();
  const maj = (suite: Partial<Etat>) => { etat = { ...etat, ...suite }; abonnes.forEach((a) => a()); };

  return {
    lire: () => etat,
    abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },

    async charger() {
      try {
        const [eleves, seances] = await Promise.all([depot.chargerEleves(), depot.chargerSeances()]);
        maj({ pret: true, erreur: null, eleves, seances });
      } catch (e) {
        maj({ pret: true, erreur: e instanceof Error ? e.message : 'Chargement impossible' });
      }
    },

    async ajouterEleves(liste: Eleve[]) {
      for (const e of liste) await depot.enregistrerEleve(e);
      maj({ eleves: [...etat.eleves.filter((x) => !liste.some((n) => n.id === x.id)), ...liste] });
    },

    async enregistrerSeance(s: Seance) {
      await depot.enregistrerSeance(s);
      maj({ seances: [...etat.seances.filter((x) => x.id !== s.id), s] });
    },

    async supprimerSeance(id: string) {
      await depot.supprimerSeance(id);
      maj({ seances: etat.seances.filter((x) => x.id !== id) });
    }
  };
}

export type Magasin = ReturnType<typeof creerMagasin>;

export const useMagasin = <T,>(magasin: Magasin, selecteur: (e: Etat) => T): T =>
  useSyncExternalStore(magasin.abonner, () => selecteur(magasin.lire()));
