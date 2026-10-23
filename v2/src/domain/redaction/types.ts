import type { Effet, Niveau, Presence, Transfert } from '../types.ts';

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
  observations: { texte: string; niveau: Niveau | null }[];
  remarque: string;
  competences: { texte: string; niveau: Niveau | null }[];
  precisionCompetence: string;
  aides: { texte: string; effet: Effet | null }[];
  precisionAide: string;
  transfert: Transfert | null;
  precisionTransfert: string;
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
}

export interface Bloc {
  type: 'seance' | 'absence';
  presence: Presence;
  entete: { date: string; cours: string; titulaire: string };
  peda: Peda | null;
  ortho: LigneOrtho[];
}
