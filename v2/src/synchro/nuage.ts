import type { EvenementExistant, EvenementSouhaite } from '../domain/synchro/outlook.ts';

/*
 * Ce que l'application attend d'un « nuage » : un dossier de petits fichiers (OneDrive) et un calendrier (Outlook).
 * Deux réalisations : Microsoft (`graph.ts`) et une simulation locale pour essayer sans compte (`simule.ts`).
 */

export interface FichierDistant {
  /** Chemin relatif au dossier de l'application : « seances/abc.json ». */
  chemin: string;
  /** Identifiant propre au nuage (sert à lire et à supprimer). */
  id: string;
  /** Version du fichier : change à chaque écriture. */
  etag: string;
}

/** Le fichier a été modifié (ou créé) par quelqu'un d'autre entre-temps : rien n'a été écrit. */
export class ErreurVersion extends Error {
  constructor(message = 'Le fichier a changé entre-temps.') { super(message); this.name = 'ErreurVersion'; }
}

export type CodeAcces = 'non-connecte' | 'consentement' | 'refuse' | 'reseau' | 'inconnue';
/** Problème d'accès : pas connecté, droit refusé, réseau coupé… Le message est destiné à l'utilisateur. */
export class ErreurAcces extends Error {
  readonly code: CodeAcces;
  constructor(code: CodeAcces, message: string) { super(message); this.name = 'ErreurAcces'; this.code = code; }
}

export interface Nuage {
  readonly nom: 'demonstration' | 'microsoft';
  /** Fichiers d'un dossier (« seances »). Un dossier qui n'existe pas encore est vide. */
  lister(dossier: string): Promise<FichierDistant[]>;
  lire(fichier: FichierDistant): Promise<string>;
  /** `etagAttendu` = version qu'on croit remplacer ; `null` = création (ne doit jamais écraser un fichier existant). */
  ecrire(chemin: string, contenu: string, etagAttendu: string | null): Promise<FichierDistant>;
  /** Supprime si le fichier est toujours à la version connue (sinon `ErreurVersion`). Déjà absent = réussi. */
  supprimer(fichier: FichierDistant): Promise<void>;
}

export interface CalendrierNuage {
  /** Identifiant du calendrier du Journalier, créé s'il n'existe pas. */
  trouverOuCreer(nom: string): Promise<string>;
  /** Événements d'un calendrier entre deux dates (AAAA-MM-JJ, bornes comprises). */
  evenements(calendrier: string, du: string, au: string): Promise<EvenementExistant[]>;
  creer(calendrier: string, e: EvenementSouhaite): Promise<void>;
  modifier(calendrier: string, id: string, e: EvenementSouhaite): Promise<void>;
  supprimerEvenement(calendrier: string, id: string): Promise<void>;
  supprimerCalendrier(calendrier: string): Promise<void>;
}

/**
 * Passage obligé entre le texte clair et ce qui part dans le nuage. Rien n'est transformé, volontairement : au lot 7,
 * il a été décidé (« comme la V75 ») que OneDrive est protégé par Microsoft seul. Si un mot de passe OneDrive est demandé
 * plus tard, c'est ici qu'il se branchera, sans toucher au reste.
 */
export interface Scelleur {
  sceller(texte: string): Promise<string>;
  ouvrir(texte: string): Promise<string>;
}
export const SCELLEUR_NEUTRE: Scelleur = { sceller: async (t) => t, ouvrir: async (t) => t };
