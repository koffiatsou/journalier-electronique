import { aPlat } from './objets.ts';
import type { ObjetsLocaux } from './objets.ts';
import type { Cle } from './cles.ts';

/*
 * Copie de secours : tout le Journalier dans un seul fichier, à enregistrer sur l'ordinateur.
 * C'est le « repli manuel » quand OneDrive n'est pas disponible. Ce fichier-ci est en clair ; l'écran propose de le
 * protéger par un mot de passe (`domain/coffre/motdepasse.ts`), ce qui l'enveloppe dans un second fichier chiffré.
 */

export const SCHEMA_COPIE = 'journalier-v2-copie/1';

export interface Copie extends ObjetsLocaux { schema: typeof SCHEMA_COPIE; creeLe: string }

export function construireCopie(objets: ObjetsLocaux, maintenant: string): Copie {
  return {
    schema: SCHEMA_COPIE, creeLe: maintenant,
    eleves: objets.eleves, seances: objets.seances, activites: objets.activites, pias: objets.pias,
    reglages: objets.reglages.filter((r) => aPlat({ eleves: [], seances: [], activites: [], pias: [], reglages: [r] }).size > 0)
  };
}

export type LectureCopie = { ok: true; copie: Copie } | { ok: false; erreur: string };

const liste = (v: unknown): v is Record<string, unknown>[] => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string');

export function lireCopie(texte: string): LectureCopie {
  let brut: unknown;
  try { brut = JSON.parse(texte); } catch { return { ok: false, erreur: 'Ce fichier n’est pas une copie du Journalier (lecture impossible).' }; }
  if (!brut || typeof brut !== 'object') return { ok: false, erreur: 'Ce fichier n’est pas une copie du Journalier.' };
  const o = brut as Record<string, unknown>;
  const m = typeof o.schema === 'string' ? /^journalier-v2-copie\/(\d+)$/.exec(o.schema) : null;
  if (!m) return { ok: false, erreur: 'Ce fichier n’est pas une copie du Journalier V2.' };
  if (Number(m[1]) > 1) return { ok: false, erreur: 'Cette copie vient d’une version plus récente de l’application : mettez-la à jour.' };
  if (![o.eleves, o.seances, o.activites, o.pias, o.reglages].every(liste)) return { ok: false, erreur: 'La copie est incomplète ou abîmée.' };
  return {
    ok: true,
    copie: {
      schema: SCHEMA_COPIE, creeLe: typeof o.creeLe === 'string' ? o.creeLe : '',
      eleves: o.eleves as unknown as ObjetsLocaux['eleves'], seances: o.seances as unknown as ObjetsLocaux['seances'],
      activites: o.activites as unknown as ObjetsLocaux['activites'], pias: o.pias as unknown as ObjetsLocaux['pias'],
      reglages: o.reglages as unknown as ObjetsLocaux['reglages']
    }
  };
}

export interface ComparaisonCopie {
  /** Présents dans la copie, absents ici. */
  manquants: Cle[];
  /** Présents des deux côtés avec un contenu différent. */
  differents: Cle[];
  identiques: number;
}

/** Compare la copie à ce qu'il y a ici (empreintes déjà calculées de part et d'autre). */
export function comparerCopie(dansCopie: ReadonlyMap<Cle, string>, ici: ReadonlyMap<Cle, string>): ComparaisonCopie {
  const r: ComparaisonCopie = { manquants: [], differents: [], identiques: 0 };
  for (const [c, e] of dansCopie) {
    const autre = ici.get(c);
    if (autre === undefined) r.manquants.push(c);
    else if (autre !== e) r.differents.push(c);
    else r.identiques += 1;
  }
  return r;
}
