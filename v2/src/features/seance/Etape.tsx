import type { ReactNode } from 'react';
import { Badge } from '../../ui/Badge.tsx';
import { IconeChevron, IconeCoche } from '../../ui/icons.tsx';
import type { EtatEtape } from './brouillon.ts';

interface Props {
  numero: number;
  titre: string;
  zone: 'peda' | 'ortho';
  etat: EtatEtape;
  /** Une ligne sur ce qui est noté, montrée sous le titre quand la rubrique est fermée. */
  resume: string | null;
  ouvert: boolean;
  onBascule: () => void;
  children: ReactNode;
}

/** Étape repliable du formulaire : une seule ouverte à la fois, le contenu replié n'est plus atteignable au clavier. */
export function Etape({ numero, titre, zone, etat, resume, ouvert, onBascule, children }: Props) {
  return (
    <section className="etape" data-zone={zone} data-ouvert={ouvert} data-etat={etat} id={`etape-${numero}`}>
      <h2 className="etape-titre">
        <button type="button" className="etape-bouton" aria-expanded={ouvert} aria-controls={`etape-corps-${numero}`} onClick={onBascule}>
          <span className="etape-num num" aria-hidden="true">{numero}</span>
          <span className="etape-texte">
            <span className="etape-nom">{titre}</span>
            {resume && !ouvert ? <span className="etape-resume">{resume}</span> : null}
          </span>
          {etat === 'remplie' ? <><IconeCoche className="etape-fait" /><span className="sr-only">Renseigné</span></> : null}
          {etat === 'sans-objet' ? <Badge>Sans objet</Badge> : null}
          <IconeChevron className="etape-chevron" />
        </button>
      </h2>
      <div className="etape-corps" id={`etape-corps-${numero}`} role="region" aria-label={titre} inert={!ouvert}>
        <div className="etape-interieur">
          <div className="etape-contenu">{children}</div>
        </div>
      </div>
    </section>
  );
}
