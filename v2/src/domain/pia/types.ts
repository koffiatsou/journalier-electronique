import type { ObjectifRetenu } from '../reunion/objectifs.ts';

/*
 * Plan Individuel d'Apprentissage (PIA) : un PIA par élève et par année scolaire.
 * Les parties suivent le modèle officiel : identité, profil (tableau Aspect / Ressources /
 * Difficultés / Objectifs), procès-verbal 1, aménagements. Le procès-verbal 2 (fin d'année)
 * viendra au lot 4b : le modèle Word l'a déjà, il reste simplement vide à l'export.
 */

/** Les cinq aspects du tableau de profil, dans l'ordre du modèle officiel. */
export type Aspect = 'physique' | 'autonomie' | 'comportement' | 'communication' | 'cognitif';

export const ASPECTS: ReadonlyArray<{ id: Aspect; libelle: string }> = [
  { id: 'physique', libelle: 'Physique et psychomoteur' },
  { id: 'autonomie', libelle: 'Lié à l’autonomie' },
  { id: 'comportement', libelle: 'Comportemental et affectif' },
  { id: 'communication', libelle: 'Communication' },
  { id: 'cognitif', libelle: 'Cognitif (pédagogique)' }
];

export type Colonne = 'ressources' | 'difficultes' | 'objectifs';

export const COLONNES: ReadonlyArray<{ id: Colonne; libelle: string }> = [
  { id: 'ressources', libelle: 'Ressources' },
  { id: 'difficultes', libelle: 'Difficultés' },
  { id: 'objectifs', libelle: 'Objectifs à poursuivre' }
];

export type Profil = Record<Aspect, Record<Colonne, string>>;

/** Ce que le modèle demande en plus de l'identité de l'élève (qui vient de son dossier). */
export interface IdentitePia {
  /** Option, ajoutée à la classe (« 3CB » + « Sciences »). */
  option: string;
  cpms: string;
  representantPole: string;
  responsable: string;
}

/** Un objectif visé pour la période, avec ses critères d'évaluation. Le PV 2 les évaluera (lot 4b). */
export interface ObjectifPeriode {
  id: string;
  /** Vide si l'objectif ne concerne pas une matière en particulier. */
  matiere: string;
  texte: string;
  criteres: string;
  /** Identifiant de l'objectif retenu à la réunion dont il vient (évite de le reprendre deux fois). */
  source?: string;
}

export interface Retours {
  parents: string;
  direction: string;
  eleve: string;
  pms: string;
  agent: string;
  autres: string;
}

export type CleRetour = keyof Retours;

export interface ProcesVerbal1 {
  /** AAAA-MM-JJ, ou vide. */
  date: string;
  /** Une personne par ligne (nom et fonction). */
  presents: string[];
  axe: string;
  objectifs: ObjectifPeriode[];
  ressources: string;
  retours: Retours;
}

/** P pédagogique, O organisationnel, M matériel. */
export type TypeAmenagement = 'P' | 'O' | 'M';
export const TYPES_AMENAGEMENT: ReadonlyArray<{ id: TypeAmenagement; libelle: string }> = [
  { id: 'P', libelle: 'Pédagogique' },
  { id: 'O', libelle: 'Organisationnel' },
  { id: 'M', libelle: 'Matériel' }
];

export interface Amenagement {
  id: string;
  types: TypeAmenagement[];
  description: string;
  /** Identifiant de l'aide proposée dont il vient (évite de la proposer deux fois). */
  source?: string;
}

/** Résultat d'un objectif du PV 1, constaté au PV 2. */
export type Resultat = 'atteint' | 'partiel' | 'non';
export const RESULTATS: ReadonlyArray<{ id: Resultat; libelle: string }> = [
  { id: 'atteint', libelle: 'Atteint' },
  { id: 'partiel', libelle: 'Atteint en partie' },
  { id: 'non', libelle: 'Pas atteint' }
];

/** Évaluation d'un objectif du PV 1 (lié par son identifiant). */
export interface Evaluation {
  objectifId: string;
  /** Vide tant que l'agent n'a pas choisi : rien n'est présélectionné. */
  resultat: Resultat | '';
  commentaire: string;
}

/** Procès-verbal 2 (fin d'année) : évaluation des objectifs du PV 1, retours, aménagements pour la rentrée. */
export interface ProcesVerbal2 {
  date: string;
  presents: string[];
  evaluations: Evaluation[];
  retours: Retours;
  /** Aménagements proposés pour la rentrée scolaire suivante. */
  amenagements: Amenagement[];
  /** Vrai une fois les aménagements de l'année repris comme point de départ (évite de les reprendre deux fois). */
  amenagementsRepris: boolean;
}

export interface Pia {
  /** « identifiant de l'élève|année scolaire » : un seul PIA par élève et par année. */
  id: string;
  eleveId: string;
  /** Année scolaire, par exemple « 2026-2027 ». */
  annee: string;
  identite: IdentitePia;
  profil: Profil;
  /** Objectifs retenus à la réunion (onglet « Préparer »). */
  retenus: ObjectifRetenu[];
  pv1: ProcesVerbal1;
  amenagements: Amenagement[];
  pv2: ProcesVerbal2;
  creeLe: string;
  modifieLe: string;
}
