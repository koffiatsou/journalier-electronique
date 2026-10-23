import type { Eleve, Seance } from '../domain/types.ts';

/** Contrat de stockage : l'application ne connaît que cette interface (IndexedDB, mémoire pour les tests, plus tard coffre chiffré). */
export interface Depot {
  chargerEleves(): Promise<Eleve[]>;
  chargerSeances(): Promise<Seance[]>;
  enregistrerEleve(eleve: Eleve): Promise<void>;
  enregistrerSeance(seance: Seance): Promise<void>;
  supprimerSeance(id: string): Promise<void>;
}
