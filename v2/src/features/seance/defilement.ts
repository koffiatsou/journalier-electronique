/** Durée de secours : un peu plus que le repli d'une rubrique (`--t-panel`, 280 ms), au cas où la transition ne se déclenche pas. */
export const DELAI_SECOURS_REPLI_MS = 400;

/** Propriété animée par le repli d'une rubrique (`.etape-corps`, seance.css). */
const PROPRIETE_REPLI = 'grid-template-rows';

/** Ce dont on a besoin d'un élément : écouter la fin d'une transition. */
interface ElementTransition {
  addEventListener(type: 'transitionend', ecouteur: (e: { target: unknown; propertyName?: string }) => void): void;
  removeEventListener(type: 'transitionend', ecouteur: (e: { target: unknown; propertyName?: string }) => void): void;
}

/**
 * Attend que la rubrique qui se referme ait fini de se replier (ou le délai de secours), puis rend la main.
 * Pourquoi : un défilement lancé tout de suite vise une position calculée AVANT le repli ; quand la rubrique
 * précédente (parfois plus de 1000 px de haut) se referme, la cible remonte et on atterrit trop bas ou trop haut.
 * Sans élément (aucune rubrique à attendre), rend la main tout de suite.
 */
export function attendreFinRepli(
  element: ElementTransition | null,
  delai: number = DELAI_SECOURS_REPLI_MS,
  minuterie: { set: (f: () => void, ms: number) => unknown; clear: (id: unknown) => void } = { set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) }
): Promise<void> {
  if (!element) return Promise.resolve();
  return new Promise((resolve) => {
    let id: unknown;
    const fini = () => {
      element.removeEventListener('transitionend', surFin);
      minuterie.clear(id);
      resolve();
    };
    const surFin = (e: { target: unknown; propertyName?: string }) => {
      // Les transitions des éléments à l'intérieur (opacité, couleur…) font aussi remonter l'événement : on n'attend que la nôtre.
      if (e.target === element && e.propertyName === PROPRIETE_REPLI) fini();
    };
    element.addEventListener('transitionend', surFin);
    id = minuterie.set(fini, delai);
  });
}

/**
 * Position de défilement qui centre un bouton dans une bande horizontale, sans jamais sortir de la bande.
 * Calculée à la main (au lieu de `scrollIntoView`) pour ne JAMAIS faire défiler la page elle-même.
 */
export function positionCentree(gaucheBouton: number, largeurBouton: number, largeurBande: number, largeurContenu: number): number {
  const centree = gaucheBouton - (largeurBande - largeurBouton) / 2;
  const maximum = Math.max(0, largeurContenu - largeurBande);
  return Math.min(Math.max(centree, 0), maximum);
}

/** Côtés de la bande où il reste des rubriques cachées : `''`, `'gauche'`, `'droite'` ou `'gauche droite'`. */
export function debordements(defile: number, largeurBande: number, largeurContenu: number, tolerance = 1): string {
  const cotes: string[] = [];
  if (defile > tolerance) cotes.push('gauche');
  if (defile + largeurBande < largeurContenu - tolerance) cotes.push('droite');
  return cotes.join(' ');
}
