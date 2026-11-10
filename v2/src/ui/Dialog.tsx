import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

/** Repère posé sur le bouton qui doit recevoir le focus à l'ouverture (jamais sur un bouton qui détruit des données). */
export const REPERE_FOCUS_INITIAL = 'data-focus-initial';

/** Ce dont `focaliserInitial` a besoin d'une fenêtre : de quoi chercher un élément et lui donner le focus. */
interface Fenetre { querySelector(selecteur: string): { focus(): void } | null }

/**
 * Donne le focus à l'élément repéré par `data-focus-initial`, s'il existe. Sans repère, on laisse le navigateur
 * choisir (le premier élément focalisable). Pourquoi : dans une confirmation de suppression, le premier bouton est
 * souvent « Supprimer » ; une touche Entrée trop rapide supprimerait sans que la personne ait lu la question.
 */
export function focaliserInitial(fenetre: Fenetre): boolean {
  const cible = fenetre.querySelector(`[${REPERE_FOCUS_INITIAL}]`);
  if (!cible) return false;
  cible.focus();
  return true;
}

/** Fenêtre de dialogue basée sur l'élément natif <dialog> : focus piégé et Échap gérés par le navigateur. */
export function Dialog({ ouvert, titre, onFermer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) {
      d.showModal();
      focaliserInitial(d);
    }
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  return (
    <dialog ref={ref} className="dialog" aria-label={titre} onClose={onFermer} onCancel={onFermer}>
      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <h2>{titre}</h2>
        {children}
      </div>
    </dialog>
  );
}
