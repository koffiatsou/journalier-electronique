import type { Seance } from '../types.ts';

/** Nom du réglage local où est gardée la séance en cours de saisie. Jamais synchronisé : voir `REGLAGES_SYNCHRONISES`. */
export const REGLAGE_BROUILLON_SEANCE = 'brouillon-seance';

/** Version du format du brouillon : un brouillon d'une autre version est ignoré plutôt que mal lu. */
const VERSION_BROUILLON = 1;

/** Une séance commencée mais pas encore enregistrée, avec le moment de la dernière frappe. */
export interface BrouillonSeance {
  version: typeof VERSION_BROUILLON;
  /** Date ISO de la dernière modification (sert au message « retrouvée … »). */
  enregistreLe: string;
  seance: Seance;
}

export function creerBrouillonSeance(seance: Seance, maintenant: string = new Date().toISOString()): BrouillonSeance {
  return { version: VERSION_BROUILLON, enregistreLe: maintenant, seance };
}

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const sontDesTextes = (o: Record<string, unknown>, cles: readonly string[]): boolean => cles.every((c) => typeof o[c] === 'string');
const sontDesListes = (o: Record<string, unknown>, cles: readonly string[]): boolean => cles.every((c) => Array.isArray(o[c]));

/**
 * Relit un brouillon enregistré. Une donnée abîmée, d'une autre version ou qui n'a pas la forme d'une séance donne `null`
 * (on repart d'une séance vierge) : un brouillon ne doit jamais empêcher d'ouvrir l'écran Séance. On vérifie sans transformer.
 */
export function normaliserBrouillonSeance(brut: unknown): BrouillonSeance | null {
  if (!estObjet(brut) || brut.version !== VERSION_BROUILLON || typeof brut.enregistreLe !== 'string') return null;
  const s = brut.seance;
  if (!estObjet(s)) return null;
  if (!sontDesTextes(s, ['id', 'eleveId', 'date', 'matiere', 'presence', 'objectifLecon', 'monObjectif', 'remarque'])) return null;
  if (!sontDesListes(s, ['interventions', 'observations', 'competences', 'aides'])) return null;
  const suite = s.suite;
  if (!estObjet(suite) || !sontDesListes(suite, ['actions', 'collaborations'])) return null;
  return brut as unknown as BrouillonSeance;
}

/**
 * Vrai quand la personne a saisi quelque chose qui vaut la peine d'être gardé.
 * Choisir seulement l'élève ou la date ne compte pas : le formulaire garde l'élève après un enregistrement,
 * et le choix d'un élève préremplit tout seul la forme d'enseignement (`forme`) : un brouillon « vide » ne doit ni s'écrire ni être proposé.
 */
export function contenuSaisi(s: Seance): boolean {
  const textes = [s.matiere, s.objectifLecon, s.contenuClasse, s.monObjectif, s.remarque, s.precisionCompetence, s.precisionAide, s.suite.modalite, s.suite.objectif, s.suite.precision];
  const listes = [s.interventions, s.observations, s.competences, s.aides, s.suite.actions, s.suite.collaborations];
  return textes.some((t) => t.trim() !== '') || listes.some((l) => l.length > 0) || s.presence !== 'present' || s.situationAide !== 'none';
}
