/**
 * Largeur du menu de gauche : « reduit » (icônes seules) ou « ouvert » (logo et mots), au choix de l'utilisateur.
 * Réglage propre à chaque appareil (comme le thème). Sans choix (`null`), la disposition suit la largeur de l'écran.
 */
export type ChoixMenu = 'reduit' | 'ouvert';
const CLE = 'journalier-menu';

export function menuEnregistre(): ChoixMenu | null {
  try {
    const v = globalThis.localStorage?.getItem(CLE);
    return v === 'reduit' || v === 'ouvert' ? v : null;
  } catch { return null; }
}

/** Largeurs d'écran (px) entre lesquelles l'écran Séance replie le menu tout seul : en dessous la Feuille devient un tiroir, au-dessus il reste assez de place. */
export const LARGEUR_REPLI_MIN = 1100;
export const LARGEUR_REPLI_MAX = 1499;
export const REQUETE_REPLI = `(min-width: ${LARGEUR_REPLI_MIN}px) and (max-width: ${LARGEUR_REPLI_MAX}px)`;

/**
 * Menu à afficher : le choix de l'utilisateur gagne toujours ; sans choix, l'écran Séance se replie dans la plage de largeurs
 * ci-dessus (le formulaire a alors 2 ou 3 colonnes de cartes au lieu d'une).
 */
export function menuEffectif(choix: ChoixMenu | null, page: string, largeurDeRepli: boolean): ChoixMenu | null {
  if (choix !== null) return choix;
  return page === 'seance' && largeurDeRepli ? 'reduit' : null;
}

/** Pose le choix sur la page (attribut `data-menu` de <html>, lu par `layout.css`) et le retient. */
export function appliquerMenu(choix: ChoixMenu | null, retenir = true): void {
  const racine = document.documentElement;
  if (choix === null) racine.removeAttribute('data-menu'); else racine.setAttribute('data-menu', choix);
  if (!retenir) return;
  try {
    if (choix === null) globalThis.localStorage?.removeItem(CLE); else globalThis.localStorage?.setItem(CLE, choix);
  } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}
