import type { TeinteAppreciation } from '../redaction/appreciation.ts';

/** Fond et encre (hexadécimal, sans « # ») d'une appréciation dans le Word : mêmes teintes que l'écran, en clair. */
export interface CouleurAppreciation { fond: string; encre: string }

/**
 * Les couleurs du Word sont des constantes du document, pas des jetons de l'écran (comme `COULEURS_WORD`).
 * Fonds clairs et encre foncée : le texte reste lisible, y compris sur une impression en noir et blanc.
 */
export const COULEURS_APPRECIATION: Readonly<Record<TeinteAppreciation, CouleurAppreciation>> = {
  neutre: { fond: 'ECEAE4', encre: '4B5670' },
  faible: { fond: 'FBE9C8', encre: '7A4A05' },
  'attention-fort': { fond: 'F6D58C', encre: '5E3204' },
  moyen: { fond: 'E6ECF8', encre: '1F3F8A' },
  fort: { fond: 'D9F2EE', encre: '0B5A50' },
  'vigilance-1': { fond: 'F1EBFA', encre: '5B3A96' },
  'vigilance-2': { fond: 'E2D6F6', encre: '4A2A86' },
  'vigilance-3': { fond: 'CFBAF0', encre: '3A1D73' }
};

/** Réglage « Colorer les appréciations » du Journalier Word, propre à chaque appareil. Désactivé tant qu'il n'a pas été coché. */
export interface ReglageAppreciations { actif: boolean }

export const REGLAGE_APPRECIATIONS_VIDE: ReglageAppreciations = { actif: false };

/** Relit un réglage enregistré : tout ce qui n'est pas clairement « actif » reste désactivé. */
export function normaliserReglageAppreciations(brut: unknown): ReglageAppreciations {
  const actif = typeof brut === 'object' && brut !== null && (brut as { actif?: unknown }).actif === true;
  return { actif };
}
