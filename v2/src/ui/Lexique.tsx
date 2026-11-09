import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { EntreeLexique } from '../domain/lexique.ts';
import { Button } from './Button.tsx';
import { Dialog, REPERE_FOCUS_INITIAL } from './Dialog.tsx';

interface Props {
  /** Titre de la fenêtre, repris dans le nom du bouton (« Lexique des aides »). */
  titre: string;
  entrees: readonly EntreeLexique[];
}

/**
 * Bouton « Lexique » qui ouvre la liste des mots avec leur définition. Une fenêtre, pas une bulle au survol :
 * sur tablette il n'y a pas de survol, et la liste se lit en une fois. La fenêtre est posée dans `document.body` : un `<dialog>`
 * placé dans le formulaire de la séance l'empêchait de devenir inerte derrière le tiroir « Feuille » (voir `useTiroir`).
 */
export function BoutonLexique({ titre, entrees }: Props) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button variante="discret" className="lexique-bouton" aria-haspopup="dialog" onClick={() => setOuvert(true)}>Lexique</Button>
      {createPortal(
        <Dialog ouvert={ouvert} titre={titre} onFermer={() => setOuvert(false)}>
          <dl className="lexique">
            {entrees.map((e) => (
              <div key={e.terme} className="lexique-entree">
                <dt>{e.terme}</dt>
                <dd>{e.definition}{e.exemple ? <span className="lexique-exemple"> Exemple : {e.exemple}</span> : null}</dd>
              </div>
            ))}
          </dl>
          <div className="actions">
            <Button variante="primaire" {...{ [REPERE_FOCUS_INITIAL]: '' }} onClick={() => setOuvert(false)}>Fermer</Button>
          </div>
        </Dialog>,
        document.body
      )}
    </>
  );
}
