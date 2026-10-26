import type { Pia } from '../../domain/pia/index.ts';
import type { Eleve, Seance } from '../../domain/types.ts';

/** Ce que reçoit chaque onglet de l'écran PIA. */
export interface PropsOnglet {
  eleve: Eleve;
  pia: Pia;
  /** Séances de l'élève dans l'année scolaire du PIA : elles servent aux idées et aux propositions. */
  seances: readonly Seance[];
  /** Applique une modification au PIA le plus récent (jamais à une copie périmée) et l'enregistre. */
  changer: (modification: (p: Pia) => Pia) => void;
}

export const nomEleve = (e: Pick<Eleve, 'nom' | 'prenom'> | undefined): string => (e ? `${e.nom} ${e.prenom}`.trim() : '');
