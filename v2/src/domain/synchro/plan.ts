import { TYPES_OBJETS, decouperCle } from './cles.ts';
import type { Cle } from './cles.ts';

/*
 * Plan de synchronisation (règles pures, sans réseau).
 *
 * On compare trois choses pour chaque objet : ce qu'il y a ici, ce qu'il y a dans OneDrive, et ce qu'on avait
 * constaté à la dernière synchronisation (le « registre »). Ainsi on sait QUI a changé depuis :
 * - seulement ici → on envoie ; seulement dans OneDrive → on reçoit ;
 * - des deux côtés → on compare les contenus ; s'ils diffèrent, c'est un conflit, jamais écrasé en silence ;
 * - supprimé d'un côté et modifié de l'autre → conflit aussi.
 */

export interface LocalVu {
  /** Empreinte du contenu actuel (voir `empreinte`). */
  empreinte: string;
  /** Élève auquel l'objet appartient (séance, activité, PIA) : sert à ne pas laisser d'objet sans élève. */
  eleveId?: string;
}
export interface DistantVu { etag: string }
/** Ce qui était identique ici et dans OneDrive à la dernière synchronisation réussie. */
export interface EntreeRegistre { empreinte: string; etag: string }

export type GenreConflit = 'supprimeDistant' | 'supprimeLocal';
export interface Conflit {
  cle: Cle;
  /** supprimeDistant : supprimé dans OneDrive (depuis un autre appareil), présent ici ; supprimeLocal : l'inverse. */
  genre: GenreConflit;
  /** Pour un élève supprimé dans OneDrive : ses séances, activités et PIA d'ici, décidés avec lui. */
  liees: Cle[];
}

export interface Plan {
  envoyer: Cle[];
  recevoir: Cle[];
  supprimerDistant: Cle[];
  supprimerLocal: Cle[];
  /** Modifié des deux côtés (ou jamais synchronisé des deux côtés) : on télécharge pour comparer. */
  aVerifier: Cle[];
  conflits: Conflit[];
  /** Plus nulle part : on retire l'entrée du registre. */
  oublier: Cle[];
}

export interface EntreesPlan {
  locaux: ReadonlyMap<Cle, LocalVu>;
  distants: ReadonlyMap<Cle, DistantVu>;
  registre: ReadonlyMap<Cle, EntreeRegistre>;
}

const rang = (c: Cle): number => {
  const ref = decouperCle(c);
  return ref ? TYPES_OBJETS.indexOf(ref.type) : TYPES_OBJETS.length;
};
/** Tri stable : élèves d'abord, puis par identifiant. */
export const trierCles = (cles: Iterable<Cle>): Cle[] => [...cles].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));

export function planifier({ locaux, distants, registre }: EntreesPlan): Plan {
  const plan: Plan = { envoyer: [], recevoir: [], supprimerDistant: [], supprimerLocal: [], aVerifier: [], conflits: [], oublier: [] };
  const toutes = trierCles(new Set([...locaux.keys(), ...distants.keys(), ...registre.keys()]));

  // Élèves supprimés dans OneDrive : on demande avant de supprimer quoi que ce soit, et on tient leurs dépendances à l'écart.
  const elevesSupprimes = new Set<string>();
  for (const c of toutes) {
    const ref = decouperCle(c);
    if (ref?.type === 'eleve' && locaux.has(c) && !distants.has(c) && registre.has(c)) elevesSupprimes.add(ref.id);
  }
  const liees = new Map<string, Cle[]>();
  for (const id of elevesSupprimes) liees.set(id, []);

  for (const c of toutes) {
    const ref = decouperCle(c);
    if (!ref) continue;
    const l = locaux.get(c);
    const d = distants.get(c);
    const g = registre.get(c);

    if (l?.eleveId && elevesSupprimes.has(l.eleveId) && ref.type !== 'eleve') { liees.get(l.eleveId)!.push(c); continue; }

    if (l && d && g) {
      const localChange = l.empreinte !== g.empreinte;
      const distantChange = d.etag !== g.etag;
      if (localChange && distantChange) plan.aVerifier.push(c);
      else if (localChange) plan.envoyer.push(c);
      else if (distantChange) plan.recevoir.push(c);
    } else if (l && d) {
      plan.aVerifier.push(c);
    } else if (l && g) {
      // Supprimé dans OneDrive.
      if (ref.type === 'eleve') plan.conflits.push({ cle: c, genre: 'supprimeDistant', liees: [] });
      else if (l.empreinte === g.empreinte) plan.supprimerLocal.push(c);
      else plan.conflits.push({ cle: c, genre: 'supprimeDistant', liees: [] });
    } else if (l) {
      plan.envoyer.push(c);
    } else if (d && g) {
      // Supprimé ici.
      if (d.etag === g.etag) plan.supprimerDistant.push(c);
      else plan.conflits.push({ cle: c, genre: 'supprimeLocal', liees: [] });
    } else if (d) {
      plan.recevoir.push(c);
    } else if (g) {
      plan.oublier.push(c);
    }
  }

  for (const conflit of plan.conflits) {
    const ref = decouperCle(conflit.cle);
    if (ref?.type === 'eleve') conflit.liees = trierCles(liees.get(ref.id) ?? []);
  }
  return plan;
}

/** Vrai quand il n'y a rien à faire (utile pour dire « tout est à jour »). */
export const planVide = (p: Plan): boolean =>
  !p.envoyer.length && !p.recevoir.length && !p.supprimerDistant.length && !p.supprimerLocal.length && !p.aVerifier.length && !p.conflits.length;
