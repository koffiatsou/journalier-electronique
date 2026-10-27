import { chiffrerCopie, dechiffrerCopie, estCopieChiffree } from '../domain/coffre/index.ts';
import { aPlat, comparerCopie, construireCopie, empreinte, lireCopie, normaliserObjet } from '../domain/synchro/index.ts';
import type { Cle, ComparaisonCopie, Copie, ObjetSynchro, ObjetsLocaux } from '../domain/synchro/index.ts';
import type { Magasin } from '../state/store.ts';

/*
 * Copie de secours (repli manuel) : un fichier avec tout le Journalier, à enregistrer sur l'ordinateur, et son contraire.
 * Restaurer ne supprime jamais rien : on ajoute ce qui manque, et on remplace ce qui est différent seulement si l'utilisateur le demande.
 */

export const NOM_COPIE = (jour: string, chiffree = false): string => `journalier-copie${chiffree ? '-chiffree' : ''}-${jour}.json`;

/** Le fichier de copie. Avec un mot de passe, il est chiffré : sans le mot de passe, il est définitivement illisible. */
export async function preparerCopie(magasin: Magasin, maintenant: string, motDePasse?: string): Promise<string> {
  const texte = JSON.stringify(construireCopie(await magasin.lireObjets(), maintenant));
  return motDePasse ? chiffrerCopie(texte, motDePasse) : texte;
}

async function empreintes(objets: ObjetsLocaux): Promise<{ parCle: Map<Cle, string>; objets: Map<Cle, ObjetSynchro> }> {
  const parCle = new Map<Cle, string>();
  const valides = new Map<Cle, ObjetSynchro>();
  for (const [c, o] of aPlat(objets)) {
    const donnees = normaliserObjet(o.type, o.donnees);
    if (donnees === null) continue;
    parCle.set(c, await empreinte(donnees));
    valides.set(c, { ...o, donnees });
  }
  return { parCle, objets: valides };
}

export interface RestaurationPrevue {
  copie: Copie;
  comparaison: ComparaisonCopie;
  /** Éléments de la copie qui ne sont pas utilisables (abîmés) et seront ignorés. */
  ignores: number;
  /** Objets de la copie, prêts à être écrits. */
  objets: Map<Cle, ObjetSynchro>;
}

/** `motDePasseRequis` : le fichier est chiffré, il faut (re)demander le mot de passe. */
export type LectureRestauration = { ok: true; prevue: RestaurationPrevue } | { ok: false; erreur: string; motDePasseRequis?: boolean };

export async function preparerRestauration(magasin: Magasin, fichier: string, motDePasse?: string): Promise<LectureRestauration> {
  let texte = fichier;
  if (estCopieChiffree(fichier)) {
    if (!motDePasse) return { ok: false, erreur: 'Cette copie est protégée par un mot de passe.', motDePasseRequis: true };
    const ouvert = await dechiffrerCopie(fichier, motDePasse);
    if (!ouvert.ok) return { ok: false, erreur: ouvert.erreur, motDePasseRequis: ouvert.raison === 'mot-de-passe' };
    texte = ouvert.texte;
  }
  const lu = lireCopie(texte);
  if (!lu.ok) return lu;
  const dansCopie = await empreintes(lu.copie);
  const total = aPlat(lu.copie).size;
  const ici = await empreintes(await magasin.lireObjets());
  return { ok: true, prevue: { copie: lu.copie, comparaison: comparerCopie(dansCopie.parCle, ici.parCle), ignores: total - dansCopie.objets.size, objets: dansCopie.objets } };
}

/** Écrit dans l'application ce qui manque (et, si demandé, ce qui est différent). Renvoie le nombre d'éléments écrits. */
export async function appliquerRestauration(magasin: Magasin, prevue: RestaurationPrevue, remplacerDifferents: boolean): Promise<number> {
  const voulus = [...prevue.comparaison.manquants, ...(remplacerDifferents ? prevue.comparaison.differents : [])];
  const presents = new Set((await magasin.lireObjets()).eleves.map((e) => e.id));
  for (const c of voulus) { const o = prevue.objets.get(c); if (o?.type === 'eleve') presents.add(o.id); }
  const aEcrire: ObjetSynchro[] = [];
  for (const c of voulus) {
    const o = prevue.objets.get(c);
    if (!o) continue;
    // Jamais de séance, activité ou PIA sans son élève.
    if (o.eleveId && !presents.has(o.eleveId)) continue;
    aEcrire.push(o);
  }
  await magasin.appliquerSynchro(aEcrire, []);
  return aEcrire.length;
}
