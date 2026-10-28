import { IconeCoche } from '../../ui/icons.tsx';
import type { EtatEtape, Progression } from './brouillon.ts';

interface Props {
  etapes: readonly { court: string; zone: 'peda' | 'ortho' }[];
  etats: readonly EtatEtape[];
  ouvert: number;
  progression: Progression;
  onAller: (i: number) => void;
}

/** Barre collée en haut : où l'on en est dans la séance, et un clic pour sauter d'une rubrique à l'autre. */
export function BarreEtapes({ etapes, etats, ouvert, progression, onAller }: Props) {
  const { faites, total } = progression;
  return (
    <div className="barre-etapes">
      <nav aria-label="Rubriques de la séance">
        <ol className="barre-etapes-liste">
          {etapes.map((e, i) => (
            <li key={e.court}>
              <button type="button" className="barre-etape" data-zone={e.zone} data-ouvert={ouvert === i} data-etat={etats[i] ?? 'vide'}
                aria-current={ouvert === i ? 'step' : undefined} onClick={() => onAller(i)}>
                <span className="barre-etape-num num" aria-hidden="true">{etats[i] === 'remplie' ? <IconeCoche taille={14} /> : i + 1}</span>
                <span>{e.court}</span>
                {etats[i] === 'remplie' ? <span className="sr-only"> (renseigné)</span> : null}
                {etats[i] === 'sans-objet' ? <span className="sr-only"> (sans objet)</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="jauge">
        <div className="progres" role="progressbar" aria-label="Rubriques renseignées" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}
          aria-valuetext={`${faites} sur ${total}`}><span style={{ width: `${total ? (faites / total) * 100 : 0}%` }} /></div>
        <p className="num jauge-texte">{faites}/{total} rubriques renseignées</p>
      </div>
    </div>
  );
}
