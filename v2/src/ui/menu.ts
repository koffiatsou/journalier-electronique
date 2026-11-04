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

/** Pose le choix sur la page (attribut `data-menu` de <html>, lu par `layout.css`) et le retient. */
export function appliquerMenu(choix: ChoixMenu | null, retenir = true): void {
  const racine = document.documentElement;
  if (choix === null) racine.removeAttribute('data-menu'); else racine.setAttribute('data-menu', choix);
  if (!retenir) return;
  try {
    if (choix === null) globalThis.localStorage?.removeItem(CLE); else globalThis.localStorage?.setItem(CLE, choix);
  } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}
