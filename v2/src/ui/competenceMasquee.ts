/**
 * Réglage « Masquer la rubrique Compétence » de l'écran Séance, propre à chaque appareil (comme le thème et le menu).
 * Par défaut la rubrique est affichée : la masquer est un choix de la personne que cette partie ne concerne pas.
 */
const CLE = 'journalier-competence-masquee';

export function competenceMasqueeEnregistree(): boolean {
  try {
    return globalThis.localStorage?.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

export function retenirCompetenceMasquee(masquee: boolean): void {
  try {
    if (masquee) globalThis.localStorage?.setItem(CLE, '1'); else globalThis.localStorage?.removeItem(CLE);
  } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}
