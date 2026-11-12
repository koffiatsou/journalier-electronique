import type { TypeActivite } from '../agenda/types.ts';
import type { Eleve, Seance } from '../types.ts';

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
  const textes = [s.matiere, s.objectifLecon, s.contenuClasse, s.monObjectif, s.remarque, s.precisionCompetence, s.precisionAide, s.suite.modalite, s.suite.objectif, s.suite.precision, s.precisionClimat ?? ''];
  const listes = [s.interventions, s.observations, s.competences, s.aides, s.suite.actions, s.suite.collaborations];
  return textes.some((t) => t.trim() !== '') || listes.some((l) => l.length > 0) || s.presence !== 'present' || s.situationAide !== 'none' || s.climat !== undefined;
}

/* ───────── Brouillons des formulaires « nouvel élève » et « nouvelle activité » (lot 6.0, même principe que la séance) ───────── */

/** Réglages locaux (jamais dans `REGLAGES_SYNCHRONISES`) où sont gardés les formulaires en cours de saisie. */
export const REGLAGE_BROUILLON_ELEVE = 'brouillon-eleve';
export const REGLAGE_BROUILLON_ACTIVITE = 'brouillon-activite';

/** Un formulaire commencé mais pas encore enregistré, avec le moment de la dernière frappe. */
export interface BrouillonFormulaire<T> {
  version: typeof VERSION_BROUILLON;
  enregistreLe: string;
  donnees: T;
}

export function creerBrouillonFormulaire<T>(donnees: T, maintenant: string = new Date().toISOString()): BrouillonFormulaire<T> {
  return { version: VERSION_BROUILLON, enregistreLe: maintenant, donnees };
}

/** Ce que saisit la personne dans le panneau « Nouvelle activité » (le même jeu de champs que le panneau). */
export interface ChampsActivite {
  type: TypeActivite;
  eleveId: string;
  nomLibre: string;
  titre: string;
  matiere: string;
  lieu: string;
  note: string;
  date: string;
  debut: number;
  fin: number;
  repetition: 'aucune' | 'hebdomadaire';
  jusquau: string;
  /** `null` : couleur automatique. */
  couleur: number | null;
  ecoleId: string;
  libre: boolean;
  heureDebut: string;
  heureFin: string;
}

/** Le panneau tel qu'il s'ouvre : date et périodes viennent du clic sur la grille, tout le reste est vide. */
export function champsActiviteVides(date: string, debut: number, fin: number): ChampsActivite {
  return {
    type: 'eleve', eleveId: '', nomLibre: '', titre: '', matiere: '', lieu: '', note: '', date, debut, fin, repetition: 'aucune', jusquau: '',
    couleur: null, ecoleId: '', libre: false, heureDebut: '', heureFin: ''
  };
}

const CHAMPS_TEXTE_ACTIVITE = ['type', 'eleveId', 'nomLibre', 'titre', 'matiere', 'lieu', 'note', 'date', 'repetition', 'jusquau', 'ecoleId', 'heureDebut', 'heureFin'] as const;

function estChampsActivite(d: unknown): d is ChampsActivite {
  if (!estObjet(d) || !sontDesTextes(d, CHAMPS_TEXTE_ACTIVITE)) return false;
  return typeof d.debut === 'number' && typeof d.fin === 'number' && typeof d.libre === 'boolean' && (d.couleur === null || typeof d.couleur === 'number');
}

function estEleveEnSaisie(d: unknown): d is Eleve {
  return estObjet(d) && sontDesTextes(d, ['id', 'nom', 'prenom', 'classe', 'ecole', 'titulaire', 'dateNaissance']) && Array.isArray(d.matieres);
}

function normaliserFormulaire<T>(brut: unknown, valide: (d: unknown) => d is T): BrouillonFormulaire<T> | null {
  if (!estObjet(brut) || brut.version !== VERSION_BROUILLON || typeof brut.enregistreLe !== 'string' || !valide(brut.donnees)) return null;
  return brut as unknown as BrouillonFormulaire<T>;
}

/** Relit un brouillon d'élève enregistré ; une donnée abîmée donne `null` (on repart d'une fiche vierge). */
export const normaliserBrouillonEleve = (brut: unknown): BrouillonFormulaire<Eleve> | null => normaliserFormulaire(brut, estEleveEnSaisie);

/** Relit un brouillon d'activité enregistré ; une donnée abîmée donne `null`. */
export const normaliserBrouillonActivite = (brut: unknown): BrouillonFormulaire<ChampsActivite> | null => normaliserFormulaire(brut, estChampsActivite);

/** Vrai quand la fiche d'un nouvel élève contient quelque chose d'écrit ou de choisi. */
export function eleveSaisi(e: Eleve): boolean {
  const textes = [e.nom, e.prenom, e.classe, e.ecole, e.titulaire, e.dateNaissance];
  return textes.some((t) => t.trim() !== '') || e.matieres.length > 0 || (e.langues?.length ?? 0) > 0 || (e.enseignants?.length ?? 0) > 0;
}

/** Vrai quand le panneau « Nouvelle activité » contient autre chose que la date et les périodes du clic. */
export function activiteSaisie(c: ChampsActivite): boolean {
  const textes = [c.nomLibre, c.titre, c.matiere, c.lieu, c.note, c.eleveId, c.heureDebut, c.heureFin];
  return textes.some((t) => t.trim() !== '') || c.type !== 'eleve' || c.repetition !== 'aucune' || c.couleur !== null || c.ecoleId !== '';
}
