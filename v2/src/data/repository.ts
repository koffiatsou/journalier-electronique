import type { Activite } from '../domain/agenda/types.ts';
import type { Eleve, Seance } from '../domain/types.ts';

/** Contrat de stockage : l'application ne connaît que cette interface (IndexedDB, mémoire pour les tests, plus tard coffre chiffré). */
export interface Depot {
  chargerEleves(): Promise<Eleve[]>;
  chargerSeances(): Promise<Seance[]>;
  enregistrerEleve(eleve: Eleve): Promise<void>;
  /** Supprime l'élève, ses séances et ses activités d'agenda en une seule opération : aucune séance ne reste sans élève. */
  supprimerEleve(id: string): Promise<void>;
  enregistrerSeance(seance: Seance): Promise<void>;
  supprimerSeance(id: string): Promise<void>;
  chargerActivites(): Promise<Activite[]>;
  enregistrerActivite(activite: Activite): Promise<void>;
  supprimerActivite(id: string): Promise<void>;
}
