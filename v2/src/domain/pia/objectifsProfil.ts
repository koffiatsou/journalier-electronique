import { OBSERVATIONS_SUGGEREES, VIGILANCES_SUGGEREES } from '../types.ts';
import type { Seance } from '../types.ts';
import type { ObjectifRetenu } from '../reunion/objectifs.ts';
import { ASPECT_DE_RUBRIQUE } from './indices.ts';
import { ajouterLigne, ajouterObjectifPeriode, contientLigne, modifierCase } from './pia.ts';
import { ASPECTS } from './types.ts';
import type { Aspect, Pia } from './types.ts';

/*
 * Parcours des objectifs : Préparer (propositions tirées des séances, par matière) → Profil (colonne « Objectifs à poursuivre »,
 * l'agent décide) → procès-verbal 1 (objectifs de la période, avec critères) → procès-verbal 2 (évaluation).
 * Le Profil est la seule source du procès-verbal 1. La matière d'un objectif retenu au Préparer est gardée entre parenthèses
 * à la fin de la ligne du Profil (« Maintenir son attention (Mathématiques) ») et retrouvée à la reprise.
 */

/** Texte comparable : sans accents, majuscules, ponctuation ni espaces en trop. */
export const normeObjectif = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Aspect proposé quand l'agent ne sait pas : la plupart des objectifs d'apprentissage sont cognitifs. */
const ASPECT_PAR_DEFAUT: Aspect = 'cognitif';
/** Une difficulté de vigilance (« Se désengage ») relève du comportement et de l'affectif. */
const ASPECT_DES_VIGILANCES: Aspect = 'comportement';
/** Position du genre et de la source dans l'identifiant d'un objectif retenu : « matière|genre|source ». */
const INDEX_GENRE = 1;
const INDEX_SOURCE = 2;

/** Ligne de profil → texte et matière, quand la parenthèse finale est une matière connue du PIA. */
export function separerMatiere(ligne: string, matieresConnues: readonly string[]): { texte: string; matiere: string } {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(ligne.trim());
  const matiere = m?.[2]?.trim() ?? '';
  const connue = matieresConnues.find((x) => normeObjectif(x) === normeObjectif(matiere));
  return m && connue ? { texte: (m[1] ?? '').trim(), matiere: connue } : { texte: ligne.trim(), matiere: '' };
}

/** Ligne à écrire au Profil pour un objectif retenu : le texte, suivi de la matière entre parenthèses. */
export const ligneDeProfil = (r: Pick<ObjectifRetenu, 'texte' | 'matiere'>): string => {
  const texte = r.texte.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  return r.matiere.trim() ? `${texte} (${r.matiere.trim()})` : texte;
};

/** Matières que le PIA connaît (dossier de l'élève, séances, objectifs retenus) : elles servent à reconnaître « (Mathématiques) ». */
export function matieresDuPia(matieresEleve: readonly string[], seances: readonly Seance[], p: Pia): string[] {
  const toutes = [...matieresEleve, ...seances.map((s) => s.matiere), ...p.retenus.map((r) => r.matiere)].map((m) => m.trim()).filter(Boolean);
  return [...new Map(toutes.map((m) => [normeObjectif(m), m])).values()];
}

export interface ObjectifDuProfil {
  /** Stable tant que la ligne n'est pas réécrite : sert à ne pas reprendre deux fois le même objectif. */
  id: string;
  aspect: Aspect;
  matiere: string;
  texte: string;
}

/** Une ligne de la colonne « Objectifs à poursuivre » de chaque aspect, dans l'ordre du tableau. */
export function objectifsDuProfil(p: Pia, matieresConnues: readonly string[]): ObjectifDuProfil[] {
  return ASPECTS.flatMap(({ id: aspect }) =>
    p.profil[aspect].objectifs.split('\n').map((l) => l.trim()).filter(Boolean).map((ligne) => {
      const { texte, matiere } = separerMatiere(ligne, matieresConnues);
      return { id: `profil|${aspect}|${normeObjectif(ligne)}`, aspect, matiere, texte };
    }));
}

const cleDeComparaison = (matiere: string, texte: string): string => `${normeObjectif(matiere)}|${normeObjectif(texte)}`;

/** Objectifs du Profil qui ne sont pas encore dans le procès-verbal 1 (reconnus par leur identifiant, ou par leur texte s'ils ont été réécrits). */
export function objectifsDuProfilAReprendre(p: Pia, matieresConnues: readonly string[]): ObjectifDuProfil[] {
  const sources = new Set(p.pv1.objectifs.map((o) => o.source).filter(Boolean));
  const textes = new Set(p.pv1.objectifs.map((o) => cleDeComparaison(o.matiere, o.texte)));
  return objectifsDuProfil(p, matieresConnues).filter((o) => !sources.has(o.id) && !textes.has(cleDeComparaison(o.matiere, o.texte)));
}

/** Reprend les objectifs du Profil au procès-verbal 1 (une seule fois chacun), sans critères : l'agent les écrit. */
export function reprendreObjectifsDuProfil(p: Pia, matieresConnues: readonly string[]): Pia {
  let suite = p;
  for (const o of objectifsDuProfilAReprendre(p, matieresConnues)) {
    suite = ajouterObjectifPeriode(suite, { matiere: o.matiere, texte: o.texte, source: o.id });
  }
  return suite;
}

/** Aspect proposé pour un objectif retenu au Préparer, d'après l'observation dont il vient ; modifiable par l'agent. */
export function aspectPropose(r: ObjectifRetenu): Aspect {
  if (r.libre) return ASPECT_PAR_DEFAUT;
  const parties = r.id.split('|');
  const genre = parties[INDEX_GENRE];
  const source = normeObjectif(parties.slice(INDEX_SOURCE).join('|'));
  if (genre === 'vigilance' || VIGILANCES_SUGGEREES.some((v) => normeObjectif(v) === source)) return ASPECT_DES_VIGILANCES;
  const rubrique = OBSERVATIONS_SUGGEREES.find((g) => g.items.some((i) => normeObjectif(i) === source))?.rubrique;
  return (rubrique ? ASPECT_DE_RUBRIQUE[rubrique] : undefined) ?? ASPECT_PAR_DEFAUT;
}

/** Objectifs retenus au Préparer qui ne sont pas encore dans la colonne « Objectifs à poursuivre » du Profil. */
export function retenusHorsProfil(p: Pia): ObjectifRetenu[] {
  const dejaAuProfil = (r: ObjectifRetenu): boolean => ASPECTS.some(({ id }) => contientLigne(p.profil[id].objectifs, ligneDeProfil(r)));
  return p.retenus.filter((r) => r.texte.trim() && !dejaAuProfil(r));
}

/** Ajoute un objectif retenu au Profil, dans l'aspect choisi, avec sa matière entre parenthèses. */
export function ajouterRetenuAuProfil(p: Pia, retenu: ObjectifRetenu, aspect: Aspect): Pia {
  return modifierCase(p, aspect, 'objectifs', ajouterLigne(p.profil[aspect].objectifs, ligneDeProfil(retenu)));
}
