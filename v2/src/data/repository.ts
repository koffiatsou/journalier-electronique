import type { Activite } from '../domain/agenda/types.ts';
import type { Pia } from '../domain/pia/types.ts';
import type { RefObjet } from '../domain/synchro/cles.ts';
import type { Eleve, Seance } from '../domain/types.ts';

/** Un réglage de l'utilisateur (horaires des périodes…), rangé sous un nom. Le magasin d'état relit et vérifie la valeur. */
export interface Reglage { id: string; valeur: unknown }

/** Ce qui était identique ici et dans OneDrive à la dernière synchronisation, pour un objet (voir `domain/synchro`). */
export interface EntreeSynchro { cle: string; empreinte: string; etag: string }

/** Contrat de stockage : l'application ne connaît que cette interface (coffre chiffré sur IndexedDB, mémoire pour les tests). */
export interface Depot {
  chargerEleves(): Promise<Eleve[]>;
  chargerSeances(): Promise<Seance[]>;
  enregistrerEleve(eleve: Eleve): Promise<void>;
  /** Supprime l'élève, ses séances, ses activités d'agenda et ses PIA en une seule opération : rien ne reste sans élève. */
  supprimerEleve(id: string): Promise<void>;
  enregistrerSeance(seance: Seance): Promise<void>;
  supprimerSeance(id: string): Promise<void>;
  chargerActivites(): Promise<Activite[]>;
  enregistrerActivite(activite: Activite): Promise<void>;
  supprimerActivite(id: string): Promise<void>;
  /** Les PIA sont relus avec `normaliserPia` par le magasin d'état : le dépôt ne fait que les ranger. */
  chargerPias(): Promise<Pia[]>;
  enregistrerPia(pia: Pia): Promise<void>;
  supprimerPia(id: string): Promise<void>;
  chargerReglages(): Promise<Reglage[]>;
  enregistrerReglage(reglage: Reglage): Promise<void>;
  /** Registre de la synchronisation Microsoft (propre à cet appareil, jamais envoyé). */
  chargerSynchro(): Promise<EntreeSynchro[]>;
  enregistrerSynchro(entrees: EntreeSynchro[]): Promise<void>;
  supprimerSynchro(cles: string[]): Promise<void>;
  viderSynchro(): Promise<void>;
  /**
   * Contenu du faux OneDrive / faux Outlook de la démonstration. Il vit dans le coffre (et non plus en clair dans le
   * navigateur) parce qu'il peut recevoir de vraies données quand on essaie la synchronisation.
   */
  chargerNuageDemo(): Promise<string | null>;
  enregistrerNuageDemo(texte: string | null): Promise<void>;
  /**
   * Éléments enregistrés ici mais impossibles à lire (abîmés). Ils sont mis de côté au chargement, jamais supprimés
   * tout seuls : la synchronisation attend qu'on les écarte, pour ne pas croire qu'ils ont été supprimés.
   */
  illisibles(): readonly RefObjet[];
  /** Supprime d'ici les éléments illisibles ET leur trace dans le registre de synchro : OneDrive les renverra. Renvoie leur nombre. */
  ecarterIllisibles(): Promise<number>;
}
