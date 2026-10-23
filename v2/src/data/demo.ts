import type { Eleve } from '../domain/types.ts';

/** Élèves fictifs, uniquement pour essayer l'application sans données réelles. */
export const ELEVES_DEMO: Eleve[] = [
  { id: 'demo-alpha', nom: 'Alpha', prenom: 'Élève', classe: '1re S1', ecole: 'École fictive', titulaire: 'M. Test', dateNaissance: '', matieres: ['Mathématiques', 'Français', 'Néerlandais'] },
  { id: 'demo-beta', nom: 'Bêta', prenom: 'Élève', classe: '2e S2', ecole: 'École fictive', titulaire: 'Mme Exemple', dateNaissance: '', matieres: ['Français', 'Sciences'] }
];
