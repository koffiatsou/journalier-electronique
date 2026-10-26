import type { Depot } from '../data/repository.ts';
import type { Cle, EntreeRegistre } from '../domain/synchro/index.ts';
import type { Magasin } from '../state/store.ts';
import type { PortLocal, PortRegistre } from './synchroniser.ts';

/** Les données de cet appareil, vues par l'orchestrateur. */
export function portLocal(magasin: Magasin): PortLocal {
  return {
    lire: () => magasin.lireObjets(),
    appliquer: (ecrire, supprimer) => magasin.appliquerSynchro(ecrire, supprimer)
  };
}

/** Clé spéciale du registre : l'identité du compte pour lequel il a été construit. */
const CLE_COMPTE = '#compte';

/** Le registre de la dernière synchronisation, rangé dans la base de cet appareil. */
export function portRegistre(depot: Depot): PortRegistre {
  return {
    async lire() {
      const sortie = new Map<Cle, EntreeRegistre>();
      for (const x of await depot.chargerSynchro()) if (x.cle !== CLE_COMPTE) sortie.set(x.cle, { empreinte: x.empreinte, etag: x.etag });
      return sortie;
    },
    enregistrer: (entrees) => depot.enregistrerSynchro([...entrees].map(([cle, e]) => ({ cle, ...e }))),
    retirer: (cles) => depot.supprimerSynchro(cles),
    async compte() { return (await depot.chargerSynchro()).find((x) => x.cle === CLE_COMPTE)?.etag ?? null; },
    definirCompte: (id) => depot.enregistrerSynchro([{ cle: CLE_COMPTE, empreinte: '', etag: id }]),
    vider: () => depot.viderSynchro()
  };
}
