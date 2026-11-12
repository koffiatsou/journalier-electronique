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

/** Aspect proposé quand rien ne permet de deviner : la plupart des objectifs d'apprentissage sont cognitifs. */
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

/**
 * Mots (début de mot, sans accents) qui orientent un objectif vers un aspect du profil. Aide à deviner, jamais à décider : l'agent corrige.
 * « consigne » n'y est pas : on y reformule (communication) autant qu'on l'identifie (cognitif).
 */
const MOTS_PAR_ASPECT: Readonly<Record<Aspect, readonly string[]>> = {
  physique: ['ecriture', 'ecrire lisible', 'lisib', 'motric', 'graphis', 'clavier', 'dactylo', 'posture', 'alterner', 'geste', 'coordination', 'lateralit', 'tonus', 'equilibre', 'fatig', 'crayon'],
  autonomie: ['agenda', 'autonom', 'seul', 'materiel', 'ranger', 'rangement', 'etapes', 'planif', 'organis', 'devoir', 'cartable', 'anticip', 'bon moment', 'sans rappel'],
  comportement: ['persever', 'confiance', 'reussite', 'valoris', 'motivation', 'emotion', 'frustr', 'stress', 'anxi', 'coler', 'calme', 'attitude', 'comportement', 'engag', 'estime', 'respect', 'regle', 'relation', 'decourag', 'attention', 'concentr', 'demander une pause'],
  communication: ['question', 'reformul', 'vocabulaire', 'exprim', 'oral', 'parole', 'dialogue', 'echang', 'ecoute', 'communiq', 'verbalis', 'besoins', 'presenter', 'oser'],
  cognitif: ['identifi', 'repere', 'comprend', 'memor', 'raisonn', 'calcul', 'lire', 'lecture', 'resum', 'strategie', 'notion', 'problem', 'analys', 'compar', 'exercice', 'retenir', 'consolid', 'base', 'orthograph', 'methode', 'table']
};

/** Aspect que les mots de l'objectif désignent le plus ; null s'il n'y en a pas, ou si deux aspects sont à égalité. */
export function aspectDesMots(texte: string): Aspect | null {
  const norme = normeObjectif(texte);
  const mots = norme.split(' ');
  const notes = ASPECTS.map(({ id }) => ({
    id,
    note: MOTS_PAR_ASPECT[id].filter((m) => (m.includes(' ') ? ` ${norme} `.includes(` ${m}`) : mots.some((x) => x.startsWith(m)))).length
  }));
  const meilleure = Math.max(...notes.map((n) => n.note));
  const gagnantes = notes.filter((n) => n.note === meilleure);
  return meilleure > 0 && gagnantes.length === 1 ? (gagnantes[0]?.id ?? null) : null;
}

/**
 * Aspect proposé pour un objectif retenu au Préparer ; modifiable par l'agent. D'abord le rangement connu des observations
 * (vigilance, rubrique d'observation, compétence), sinon les mots de l'objectif, sinon cognitif.
 */
export function aspectPropose(r: ObjectifRetenu): Aspect {
  if (!r.libre) {
    const parties = r.id.split('|');
    const genre = parties[INDEX_GENRE];
    const source = normeObjectif(parties.slice(INDEX_SOURCE).join('|'));
    if (genre === 'competence') return ASPECT_PAR_DEFAUT;
    if (genre === 'vigilance' || VIGILANCES_SUGGEREES.some((v) => normeObjectif(v) === source)) return ASPECT_DES_VIGILANCES;
    const rubrique = OBSERVATIONS_SUGGEREES.find((g) => g.items.some((i) => normeObjectif(i) === source))?.rubrique;
    const connu = rubrique ? ASPECT_DE_RUBRIQUE[rubrique] : undefined;
    if (connu) return connu;
  }
  return aspectDesMots(r.texte) ?? ASPECT_PAR_DEFAUT;
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
