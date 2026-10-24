import { useEffect, useRef, useState } from 'react';
import { IconeCoche } from './icons.tsx';

export type Teinte = 'faible' | 'moyen' | 'fort' | 'neutre';

/** Teintes de l'échelle d'observation et de celle de l'effet d'une aide. */
export const TEINTES_NIVEAU: readonly Teinte[] = ['faible', 'moyen', 'fort'];
export const TEINTES_EFFET: readonly Teinte[] = ['neutre', 'faible', 'fort'];

interface Props {
  /** Texte du point (observation, compétence, aide…). */
  nom: string;
  libelles: readonly string[];
  teintes: readonly Teinte[];
  /** `undefined` ou `null` : aucun niveau choisi. */
  valeur: number | null | undefined;
  onChoisir: (valeur: number) => void;
  /** Retire le point (« Pas observé », « Retirer »). */
  onRetirer?: () => void;
  libelleRetirer?: string;
}

/**
 * Carte d'un point à évaluer — même présentation partout dans la séance.
 * Aucun niveau n'est présélectionné ; une fois choisi, seul le niveau reste affiché
 * et un appui rouvre les trois choix.
 */
export function Point({ nom, libelles, teintes, valeur, onChoisir, onRetirer, libelleRetirer = 'Retirer' }: Props) {
  const choisi = typeof valeur === 'number';
  const [ouvert, setOuvert] = useState(false);
  const premier = useRef<HTMLButtonElement>(null);
  const pastille = useRef<HTMLButtonElement>(null);
  const focus = useRef<'choix' | 'pastille' | null>(null);

  useEffect(() => {
    if (focus.current === 'choix') premier.current?.focus();
    else if (focus.current === 'pastille') pastille.current?.focus();
    focus.current = null;
  }, [ouvert]);

  return (
    <li className="point" data-etat={ouvert ? 'ouvert' : choisi ? 'choisi' : 'vide'}>
      <span className="point-nom">{nom}</span>
      {ouvert ? (
        <div className="point-choix" role="radiogroup" aria-label={`Niveau : ${nom}`}>
          {libelles.map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={valeur === i} className="pastille" data-teinte={teintes[i]}
              ref={i === 0 ? premier : undefined}
              onClick={() => { focus.current = 'pastille'; onChoisir(i); setOuvert(false); }}>{l}</button>
          ))}
          {onRetirer && (choisi || valeur === null) ? (
            <button type="button" className="point-retirer" onClick={() => { onRetirer(); setOuvert(false); }}>{libelleRetirer}</button>
          ) : null}
        </div>
      ) : choisi ? (
        <button type="button" ref={pastille} className="pastille choisie" data-teinte={teintes[valeur]}
          aria-label={`${nom} : ${libelles[valeur]}. Modifier le niveau`}
          onClick={() => { focus.current = 'choix'; setOuvert(true); }}>
          <IconeCoche taille={14} />{libelles[valeur]}
        </button>
      ) : (
        <button type="button" ref={pastille} className="pastille aucune" aria-label={`${nom} : choisir un niveau`}
          onClick={() => { focus.current = 'choix'; setOuvert(true); }}>Choisir un niveau</button>
      )}
    </li>
  );
}
