import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ECART_CARTES, hauteurEstimee, nombreDeColonnes, repartir } from './repartition.ts';

export interface ElementColonnes {
  cle: string;
  /** Nombre de caractères du texte de la carte : sert à estimer sa hauteur. */
  longueur: number;
  noeud: ReactNode;
}

/**
 * Cartes réparties en colonnes équilibrées : une carte haute dans une colonne laisse plusieurs cartes courtes s'empiler dans l'autre.
 * Le nombre de colonnes suit la largeur disponible. La répartition ne dépend que du texte (pas de l'état ouvert d'une carte) :
 * rien ne saute quand on ouvre ou ferme une carte. Les éléments doivent être des `<li>`.
 */
export function ListeColonnes({ elements }: { elements: readonly ElementColonnes[] }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return undefined;
    setLargeur(el.clientWidth);
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const colonnes = nombreDeColonnes(largeur);
  const largeurColonne = (largeur - ECART_CARTES * (colonnes - 1)) / colonnes;
  const rangs = repartir(elements.map((e) => hauteurEstimee(e.longueur, largeurColonne)), colonnes);

  return (
    <div className="points-colonnes" ref={conteneur}>
      {rangs.map((colonne, i) => (
        <ul className="points-colonne" key={i}>
          {colonne.map((r) => <Fragment key={elements[r]!.cle}>{elements[r]!.noeud}</Fragment>)}
        </ul>
      ))}
    </div>
  );
}
