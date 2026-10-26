/** Choix du thème : « auto » suit l'appareil ; « clair » et « sombre » le forcent. Réglage propre à chaque appareil. */
export type Theme = 'auto' | 'clair' | 'sombre';
const CLE = 'journalier-theme';
const ORDRE: readonly Theme[] = ['auto', 'clair', 'sombre'];

export function themeEnregistre(): Theme {
  try {
    const v = globalThis.localStorage?.getItem(CLE);
    return v === 'clair' || v === 'sombre' ? v : 'auto';
  } catch { return 'auto'; }
}

/** Applique le thème à la page (attribut `data-theme` ; absent = automatique) et le retient. */
export function appliquerTheme(theme: Theme, retenir = true): void {
  const racine = document.documentElement;
  if (theme === 'auto') racine.removeAttribute('data-theme'); else racine.setAttribute('data-theme', theme);
  if (!retenir) return;
  try {
    if (theme === 'auto') globalThis.localStorage?.removeItem(CLE); else globalThis.localStorage?.setItem(CLE, theme);
  } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}

export const themeSuivant = (t: Theme): Theme => ORDRE[(ORDRE.indexOf(t) + 1) % ORDRE.length]!;
