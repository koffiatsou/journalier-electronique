import type { ReactNode } from 'react';
import { Badge } from '../../ui/Badge.tsx';
import { IconeChevron } from '../../ui/icons.tsx';
import type { EtatEtape } from './brouillon.ts';

interface Props {
  numero: number;
  titre: string;
  zone: 'peda' | 'ortho';
  etat: EtatEtape;
  ouvert: boolean;
  onBascule: () => void;
  children: ReactNode;
}

const resume: Record<EtatEtape, { ton: 'neutre' | 'ok'; texte: string } | null> = {
  vide: null,
  remplie: { ton: 'ok', texte: 'Renseigné' },
  'sans-objet': { ton: 'neutre', texte: 'Sans objet' }
};

/** Étape repliable du formulaire : une seule ouverte à la fois, le contenu replié n'est plus atteignable au clavier. */
export function Etape({ numero, titre, zone, etat, ouvert, onBascule, children }: Props) {
  const r = resume[etat];
  return (
    <section className="etape" data-zone={zone} data-ouvert={ouvert} data-etat={etat} id={`etape-${numero}`}>
      <h2 className="etape-titre">
        <button type="button" className="etape-bouton" aria-expanded={ouvert} aria-controls={`etape-corps-${numero}`} onClick={onBascule}>
          <span className="etape-num num" aria-hidden="true">{numero}</span>
          <span className="etape-nom">{titre}</span>
          {r ? <Badge ton={r.ton}>{r.texte}</Badge> : null}
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
