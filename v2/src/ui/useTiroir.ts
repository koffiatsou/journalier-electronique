import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Ce qui reste utilisable pendant qu'un tiroir recouvre la page : les notifications (geste « Annuler »), la barre d'action et les fenêtres de dialogue. */
const GARDER_ACTIF = '.toasts, .barre-action, dialog';

interface Options {
  /** Le tiroir est ouvert (un panneau qui n'existe que lorsqu'il est ouvert passe toujours `true`). */
  actif: boolean;
  /** Fermer le tiroir (touche Échap). */
  onFermer: () => void;
}

/**
 * Un tiroir qui recouvre la page (position fixe, petit écran) se comporte comme un dialogue : le fond devient inerte,
 * le focus entre dans le tiroir, Échap le ferme et le focus retourne là où il était. À côté de la page (grand écran) il
 * reste une colonne ordinaire : le fond n'est pas touché. On lit le style calculé plutôt qu'une largeur d'écran :
 * un seul endroit (le CSS) décide à partir de quand le tiroir recouvre la page.
 * @returns `true` quand le tiroir recouvre la page (à reporter sur `role="dialog"` et `aria-modal`).
 */
export function useTiroir(ref: RefObject<HTMLElement | null>, { actif, onFermer }: Options): boolean {
  const [recouvre, setRecouvre] = useState(false);
  // Toujours la dernière fonction, sans relancer l'effet (il redonnerait le focus au tiroir à chaque rendu du parent).
  const fermer = useRef(onFermer);
  useEffect(() => { fermer.current = onFermer; });

  useEffect(() => {
    const mesurer = () => setRecouvre(ref.current !== null && getComputedStyle(ref.current).position === 'fixed');
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [ref]);

  useEffect(() => {
    const tiroir = ref.current;
    if (!actif || !tiroir) return undefined;
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    tiroir.setAttribute('tabindex', '-1');
    tiroir.focus({ preventScroll: true });
    const rendus = recouvre ? rendreInerte(tiroir) : [];
    const surTouche = (e: KeyboardEvent) => {
      // Une fenêtre de dialogue ouverte depuis le tiroir ferme seulement la fenêtre.
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target instanceof Element && e.target.closest('dialog'))) return;
      e.preventDefault();
      fermer.current();
    };
    // Modal : Échap compte où que soit le focus (après un Tab il peut être sorti de la page). Sinon : seulement depuis le tiroir.
    const ecoute: EventTarget = recouvre ? document : tiroir;
    ecoute.addEventListener('keydown', surTouche as EventListener);
    return () => {
      ecoute.removeEventListener('keydown', surTouche as EventListener);
      for (const e of rendus) e.inert = false;
      rendreLeFocus(origine);
    };
  }, [actif, recouvre, ref]);

  return recouvre;
}

/** Rend inertes les frères du tiroir et de ses ancêtres, sauf ce qui doit rester utilisable. Renvoie ce qui a été touché. */
function rendreInerte(tiroir: HTMLElement): HTMLElement[] {
  const rendus: HTMLElement[] = [];
  for (let noeud: HTMLElement | null = tiroir; noeud && noeud !== document.body; noeud = noeud.parentElement) {
    for (const frere of Array.from(noeud.parentElement?.children ?? [])) {
      if (!(frere instanceof HTMLElement) || frere === noeud || frere.inert || frere.matches(GARDER_ACTIF) || frere.querySelector(GARDER_ACTIF)) continue;
      frere.inert = true;
      rendus.push(frere);
    }
  }
  return rendus;
}

/** Redonne le focus à l'élément d'origine ; s'il a disparu (activité supprimée…), à la zone de contenu. */
function rendreLeFocus(origine: HTMLElement | null): void {
  // Certains navigateurs (Safari) ne donnent pas le focus à un bouton touché : l'origine est alors le corps de la page.
  const cible = origine?.isConnected && origine !== document.body ? origine : document.getElementById('contenu');
  cible?.focus({ preventScroll: true });
}
