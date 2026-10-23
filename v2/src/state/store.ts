import { useSyncExternalStore } from 'react';
import type { Depot } from '../data/repository.ts';
import type { Activite } from '../domain/agenda/types.ts';
import type { Changement } from '../domain/agenda/planning.ts';
import type { Eleve, Seance } from '../domain/types.ts';

export interface Etat {
  pret: boolean;
  erreur: string | null;
  eleves: Eleve[];
  seances: Seance[];
  activites: Activite[];
  /** Séance à ouvrir préremplie (depuis l'agenda) ; consommée une fois. */
  preparation: Partial<Seance> | null;
}

const initial: Etat = { pret: false, erreur: null, eleves: [], seances: [], activites: [], preparation: null };

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
        const [eleves, seances, activites] = await Promise.all([depot.chargerEleves(), depot.chargerSeances(), depot.chargerActivites()]);
        maj({ pret: true, erreur: null, eleves, seances, activites });
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

    preparerSeance(p: Partial<Seance>) { maj({ preparation: p }); },
    /** À appeler après l'ouverture de la séance : la préparation n'est valable qu'une fois. */
    viderPreparation() { if (etat.preparation) etat = { ...etat, preparation: null }; },

    /** Applique un changement de l'agenda (enregistrements et suppressions) d'un seul coup pour l'affichage. */
    async changerAgenda(c: Changement) {
      for (const a of c.enregistrer) await depot.enregistrerActivite(a);
      for (const id of c.supprimer) await depot.supprimerActivite(id);
      const ids = new Set([...c.enregistrer.map((a) => a.id), ...c.supprimer]);
      maj({ activites: [...etat.activites.filter((a) => !ids.has(a.id)), ...c.enregistrer] });
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
