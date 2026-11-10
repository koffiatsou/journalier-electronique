import { useCallback, useEffect, useRef, useState } from 'react';
import { IconeCoche } from '../../ui/icons.tsx';
import type { EtatEtape, Progression } from './brouillon.ts';
import { debordements, positionCentree } from './defilement.ts';

const reduireMouvement = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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
  const liste = useRef<HTMLOListElement>(null);
  /** Côtés de la bande où il reste des rubriques cachées : sert à l'estompage de bord (indice de défilement). */
  const [debord, setDebord] = useState('');
  const mesurer = useCallback(() => {
    const l = liste.current;
    if (l) setDebord(debordements(l.scrollLeft, l.clientWidth, l.scrollWidth));
  }, []);
  useEffect(() => {
    const l = liste.current;
    if (!l) return undefined;
    mesurer();
    l.addEventListener('scroll', mesurer, { passive: true });
    const suivi = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    suivi?.observe(l);
    return () => { l.removeEventListener('scroll', mesurer); suivi?.disconnect(); };
  }, [mesurer]);
  /* La rubrique active reste visible dans la bande. Calculé à la main : `scrollIntoView` ferait aussi défiler la page. */
  useEffect(() => {
    const l = liste.current;
    const actif = l?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!l || !actif) return;
    const gauche = actif.getBoundingClientRect().left - l.getBoundingClientRect().left + l.scrollLeft;
    l.scrollTo({ left: positionCentree(gauche, actif.offsetWidth, l.clientWidth, l.scrollWidth), behavior: reduireMouvement() ? 'auto' : 'smooth' });
  }, [ouvert]);
  return (
    <div className="barre-etapes">
      <nav aria-label="Rubriques de la séance">
        <ol className="barre-etapes-liste" ref={liste} data-debord={debord}>
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
