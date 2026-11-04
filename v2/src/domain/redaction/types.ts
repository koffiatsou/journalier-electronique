import type { Effet, NatureAide, Niveau, Presence } from '../types.ts';

/** Séance nettoyée (textes rognés, valeurs vides retirées) : la seule entrée des règles de rédaction. */
export interface Faits {
  id: string;
  eleveId: string;
  date: string;
  matiere: string;
  titulaire: string;
  presence: Presence;
  interventions: string[];
  objectifLecon: string;
  contenuClasse: string;
  monObjectif: string;
  /** `vigilance` : difficulté observée, dont le niveau est une fréquence (voir `estVigilance`). */
  observations: { texte: string; niveau: Niveau | null; vigilance: boolean }[];
  remarque: string;
  competences: { texte: string; niveau: Niveau | null }[];
  precisionCompetence: string;
  aides: { texte: string; effet: Effet | null; nature: NatureAide | null }[];
  precisionAide: string;
  actions: string[];
  modalite: string;
  objectifSuite: string;
  collaborations: string[];
  precisionSuite: string;
}

export interface Peda {
  objectifLecon: string;
  contenuClasse: string;
  monObjectif: string;
  monIntervention: string;
  interventions: string[];
}

/** Une rubrique de la partie orthopédagogique : soit un texte, soit une liste de puces. */
export interface LigneOrtho {
  label: string | null;
  texte?: string;
  lignes?: string[];
  /** Ton de chaque ligne (même ordre que `lignes`), pour colorer l'écran ; Word reste sans couleur. */
  tons?: (TonLigne | null)[];
}

/** Sens d'un changement de niveau dans l'évolution : progression ou point à consolider. */
export type TonLigne = 'progres' | 'consolider';

export interface Bloc {
  type: 'seance' | 'absence';
  presence: Presence;
  entete: { date: string; cours: string; titulaire: string };
  peda: Peda | null;
  ortho: LigneOrtho[];
}
