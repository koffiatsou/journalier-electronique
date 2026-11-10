import { REGLAGE_COULEURS_VIDE, normaliserReglageCouleurs } from '../domain/export/couleurs.ts';
import type { ReglageCouleurs } from '../domain/export/couleurs.ts';

/**
 * Réglage « Colorer par matière » du Journalier Word, propre à chaque appareil (comme le thème et le menu).
 * Rien n'est colorié tant que la case n'a pas été cochée.
 */
const CLE = 'journalier-export-couleurs';

export function couleursEnregistrees(): ReglageCouleurs {
  try {
    const brut = globalThis.localStorage?.getItem(CLE);
    return brut ? normaliserReglageCouleurs(JSON.parse(brut)) : { ...REGLAGE_COULEURS_VIDE, choix: {} };
  } catch {
    return { ...REGLAGE_COULEURS_VIDE, choix: {} };
  }
}

export function retenirCouleurs(reglage: ReglageCouleurs): void {
  try {
    globalThis.localStorage?.setItem(CLE, JSON.stringify(reglage));
  } catch { /* stockage indisponible : le réglage vaut pour cette visite seulement */ }
}
