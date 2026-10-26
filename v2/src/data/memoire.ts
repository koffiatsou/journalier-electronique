import type { Activite } from '../domain/agenda/types.ts';
import type { Pia } from '../domain/pia/types.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { Depot, Reglage } from './repository.ts';

/** Dépôt en mémoire : tests et démonstration, rien n'est conservé. */
export function creerDepotMemoire(eleves: Eleve[] = [], seances: Seance[] = [], activites: Activite[] = [], pias: Pia[] = [], reglages: Reglage[] = []): Depot {
  const e = new Map(eleves.map((x) => [x.id, x]));
  const s = new Map(seances.map((x) => [x.id, x]));
  const a = new Map(activites.map((x) => [x.id, x]));
  const p = new Map(pias.map((x) => [x.id, x]));
  const r = new Map(reglages.map((x) => [x.id, x]));
  return {
    chargerEleves: async () => [...e.values()],
    chargerSeances: async () => [...s.values()],
    enregistrerEleve: async (x) => { e.set(x.id, x); },
    supprimerEleve: async (id) => {
      e.delete(id);
      for (const [k, v] of [...s]) if (v.eleveId === id) s.delete(k);
      for (const [k, v] of [...a]) if (v.eleveId === id) a.delete(k);
      for (const [k, v] of [...p]) if (v.eleveId === id) p.delete(k);
    },
    enregistrerSeance: async (x) => { s.set(x.id, x); },
    supprimerSeance: async (id) => { s.delete(id); },
    chargerActivites: async () => [...a.values()],
    enregistrerActivite: async (x) => { a.set(x.id, x); },
    supprimerActivite: async (id) => { a.delete(id); },
    chargerPias: async () => [...p.values()],
    enregistrerPia: async (x) => { p.set(x.id, x); },
    chargerReglages: async () => [...r.values()],
    enregistrerReglage: async (x) => { r.set(x.id, x); }
  };
}
