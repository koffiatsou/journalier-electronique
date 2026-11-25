import { NIVEAU_MIN } from '../types.ts';
import { NBSP } from './langue.ts';

/**
 * Teinte d'une appréciation (« tout à fait », « souvent »…). Les noms sont ceux des pastilles de la séance :
 * l'écran en tire sa couleur (`data-teinte`), le Word ses fonds (`export/appreciations.ts`).
 */
export type TeinteAppreciation = 'neutre' | 'faible' | 'moyen' | 'fort' | 'attention-fort' | 'vigilance-1' | 'vigilance-2' | 'vigilance-3';

/** Teintes de chaque échelle, dans l'ordre des échelons (de « Pas du tout » à « Tout à fait », etc.). */
export const TEINTES_NIVEAU: readonly TeinteAppreciation[] = ['attention-fort', 'faible', 'moyen', 'fort'];
export const TEINTES_EFFET: readonly TeinteAppreciation[] = ['neutre', 'faible', 'fort'];
/** Un point de vigilance a sa propre teinte, plus soutenue quand il est plus fréquent : jamais celles des niveaux d'acquisition. */
export const TEINTES_VIGILANCE: readonly TeinteAppreciation[] = ['vigilance-1', 'vigilance-2', 'vigilance-3'];

/** Appréciation écrite en fin de ligne : son mot (tel qu'il figure dans le texte) et sa teinte. */
export interface Appreciation { libelle: string; teinte: TeinteAppreciation }

/** Teinte d'un niveau d'observation ou de compétence (`neutre` quand le niveau est inconnu). */
export const teinteDeNiveau = (niveau: number): TeinteAppreciation => TEINTES_NIVEAU[niveau - NIVEAU_MIN] ?? 'neutre';
/** Teinte d'une fréquence de point de vigilance. */
export const teinteDeVigilance = (niveau: number): TeinteAppreciation => TEINTES_VIGILANCE[niveau] ?? 'neutre';
/** Teinte de l'effet d'une aide. */
export const teinteDEffet = (effet: number): TeinteAppreciation => TEINTES_EFFET[effet] ?? 'neutre';

/** Séparateur entre les éléments évalués et leur appréciation (espace insécable avant, pour ne jamais commencer une ligne). */
export const SEPARATEUR_APPRECIATION = `${NBSP}| `;

/**
 * Coupe une ligne « éléments | appréciation » : renvoie les éléments, le séparateur et l'appréciation.
 * Sans correspondance (ligne d'un autre genre, ou appréciation changée par un traitement du texte),
 * renvoie `null` : l'appelant garde alors la ligne telle quelle.
 */
export function couperAppreciation(ligne: string, appreciation: Appreciation | null | undefined): { elements: string; appreciation: string } | null {
  if (!appreciation) return null;
  const fin = `${SEPARATEUR_APPRECIATION}${appreciation.libelle}`;
  if (!ligne.endsWith(fin)) return null;
  return { elements: ligne.slice(0, ligne.length - fin.length), appreciation: appreciation.libelle };
}

