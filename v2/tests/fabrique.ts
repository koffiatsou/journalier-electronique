import type { Seance } from '../src/domain/types.ts';

let compteur = 0;

/** Séance fictive complète ; chaque test ne surcharge que ce qui l'intéresse. */
export function seance(surcharge: Partial<Seance> = {}): Seance {
  compteur += 1;
  return {
    id: `s${compteur}`,
    eleveId: 'alpha',
    date: '2026-09-22',
    periodeDebut: '1e H',
    periodeFin: '1e H',
    matiere: 'Mathématiques',
    niveauScolaire: 'S1',
    forme: 'Général (G)',
    presence: 'present',
    interventions: ['Accompagnement individuel'],
    objectifLecon: 'Résoudre un problème additif',
    contenuClasse: '',
    monObjectif: 'Aider à identifier les données utiles',
    observations: [
      { texte: 'Entre dans la tâche', niveau: 2 },
      { texte: 'Maintient son attention', niveau: 2 },
      { texte: 'Repère les informations pertinentes', niveau: 1 },
      { texte: 'Contrôle sa production', niveau: 0 }
    ],
    remarque: 'Se fatigue en fin de période',
    competences: [{ texte: 'Résoudre un problème à une opération', niveau: 1 }],
    precisionCompetence: '',
    situationAide: 'none',
    aides: [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 1 }],
    precisionAide: '',
    transfert: 'observed',
    precisionTransfert: 'Réutilisé en classe lors de l’exercice suivant',
    suite: { actions: ['Maintenir l’accompagnement', 'Favoriser l’autonomie'], modalite: '', objectif: '', collaborations: [], precision: '' },
    creeLe: '2026-09-22T10:00:00.000Z',
    modifieLe: '2026-09-22T10:00:00.000Z',
    ...surcharge
  };
}

export const vide: Partial<Seance> = {
  observations: [], remarque: '', competences: [], aides: [], transfert: null, precisionTransfert: '',
  suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }
};
