/*
 * Reprise des données de la V75 : ce que le coffre de la V75 contient, une fois déchiffré, sans aucune interprétation.
 * Rien ici n'est supposé fiable : tout est relu et vérifié par `convertir*` avant d'entrer dans la V2.
 */

/** Une fiche de PIA de la V75 (annuel) et, s'il existe, le PIA d'une année précédente repris d'un document. */
export interface PiaBrutV75 { record: unknown; imported: unknown }

export interface EtatV75 {
  eleves: unknown[];
  seances: unknown[];
  /** Agenda de la V75 : `{ __events, __exceptions, __config }`. */
  agenda: unknown;
  /** PIA par identifiant d'élève de la V75. */
  pias: Record<string, PiaBrutV75>;
}

/** À qui appartient un coffre V75 trouvé sur l'appareil (pour que l'utilisateur reconnaisse le sien). */
export interface CompteV75 {
  /** Identifiant interne du coffre (hash de compte) : sert à le relire, jamais affiché. */
  id: string;
  nom: string;
  adresse: string;
  /** Nombre d'enregistrements d'élèves et de séances (indication, sans tout déchiffrer). */
  eleves: number;
  seances: number;
}

/** Ce qui n'a pas pu être repris, avec la raison en français simple. */
export interface Ecart { quoi: string; raison: string }
