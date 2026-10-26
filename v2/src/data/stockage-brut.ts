import type { TypeObjet } from '../domain/synchro/cles.ts';
import type { EntreeSynchro } from './repository.ts';

/*
 * Stockage « brut » : des rangées déjà chiffrées, rangées sous un identifiant. C'est tout ce que la base voit.
 * Réalisations : IndexedDB (`indexeddb.ts`) et mémoire (tests). Le chiffrement est fait au-dessus, dans `depot-chiffre.ts`.
 */

export type Table = 'eleves' | 'seances' | 'activites' | 'pia' | 'reglages' | 'meta';

/** Ce que la base garde pour un objet : son identifiant, son lien avec un élève (en clair, voir ci-dessous) et le texte chiffré. */
export interface Rangee {
  id: string;
  /**
   * Identifiant de l'élève concerné (séances, activités, PIA). Gardé EN CLAIR parce que la suppression d'un élève doit
   * retirer tout ce qui le concerne en une seule opération de base, et qu'une opération de base ne peut pas attendre un
   * déchiffrement. C'est un identifiant au hasard, sans nom ni donnée sur l'élève.
   */
  lien?: string;
  /** Texte chiffré (`j2c1.…`). */
  c: string;
}

/** Table de la base → type d'objet de la synchronisation (pour retrouver la clé du registre). */
export const TYPE_DE_TABLE: Readonly<Record<Exclude<Table, 'meta'>, TypeObjet>> = {
  eleves: 'eleve', seances: 'seance', activites: 'activite', pia: 'pia', reglages: 'reglage'
};

export interface StockageBrut {
  lire(table: Table): Promise<Rangee[]>;
  /** Écrit toutes les rangées dans UNE transaction : tout, ou rien. */
  ecrire(table: Table, rangees: readonly Rangee[]): Promise<void>;
  supprimer(table: Table, ids: readonly string[]): Promise<void>;
  /** Supprime l'élève et toutes les rangées dont le lien est cet élève (séances, activités, PIA), en UNE transaction. */
  supprimerEleve(id: string): Promise<void>;
  lireSynchro(): Promise<EntreeSynchro[]>;
  ecrireSynchro(entrees: readonly EntreeSynchro[]): Promise<void>;
  supprimerSynchro(cles: readonly string[]): Promise<void>;
  viderSynchro(): Promise<void>;
  /** La clé de chiffrement de cet espace, ou `null` s'il n'y en a pas (encore, ou plus). */
  lireCle(): Promise<CryptoKey | null>;
  ecrireCle(cle: CryptoKey): Promise<void>;
}

/** Stockage brut en mémoire : tests, et repli quand IndexedDB est indisponible. */
export function creerStockageBrutMemoire(): StockageBrut & { rangees(table: Table): Rangee[]; remplacer(table: Table, rangee: Rangee): void } {
  const tables = new Map<Table, Map<string, Rangee>>((['eleves', 'seances', 'activites', 'pia', 'reglages', 'meta'] as const).map((t) => [t, new Map()]));
  const synchro = new Map<string, EntreeSynchro>();
  let cle: CryptoKey | null = null;
  const t = (n: Table): Map<string, Rangee> => tables.get(n)!;
  return {
    lire: async (table) => [...t(table).values()].map((r) => ({ ...r })),
    ecrire: async (table, rangees) => { for (const r of rangees) t(table).set(r.id, { ...r }); },
    supprimer: async (table, ids) => { for (const id of ids) t(table).delete(id); },
    supprimerEleve: async (id) => {
      t('eleves').delete(id);
      for (const nom of ['seances', 'activites', 'pia'] as const) for (const [k, r] of [...t(nom)]) if (r.lien === id) t(nom).delete(k);
    },
    lireSynchro: async () => [...synchro.values()].map((x) => ({ ...x })),
    ecrireSynchro: async (entrees) => { for (const x of entrees) synchro.set(x.cle, { ...x }); },
    supprimerSynchro: async (cles) => { for (const c of cles) synchro.delete(c); },
    viderSynchro: async () => { synchro.clear(); },
    lireCle: async () => cle,
    ecrireCle: async (c) => { cle = c; },
    // Pour les tests : voir ce qui est vraiment rangé, ou abîmer une rangée.
    rangees: (table) => [...t(table).values()],
    remplacer: (table, rangee) => { t(table).set(rangee.id, rangee); }
  };
}
