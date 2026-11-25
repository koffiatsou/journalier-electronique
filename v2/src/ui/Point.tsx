import { useEffect, useRef, useState } from 'react';
import { TEINTES_EFFET, TEINTES_NIVEAU, TEINTES_VIGILANCE } from '../domain/redaction/appreciation.ts';
import type { TeinteAppreciation } from '../domain/redaction/appreciation.ts';
import { IconeCoche } from './icons.tsx';

export type Teinte = TeinteAppreciation;

/** Teintes de l'échelle d'observation, de celle de l'effet d'une aide et du point de vigilance (définies avec la rédaction du Journalier, qui les reprend). */
export { TEINTES_EFFET, TEINTES_NIVEAU, TEINTES_VIGILANCE };

interface Props {
  /** Texte du point (observation, compétence, aide…). */
  nom: string;
  libelles: readonly string[];
  /** Valeur de la première pastille (0 par défaut ; -1 pour l'échelle « Pas du tout » → « Tout à fait »). */
  valeurMin?: number;
  teintes: readonly Teinte[];
  /** `undefined` ou `null` : aucun niveau choisi. */
  valeur: number | null | undefined;
  onChoisir: (valeur: number) => void;
  /** Retire le point (« Pas observé », « Retirer »). */
  onRetirer?: () => void;
  libelleRetirer?: string;
  /** Garde le point sans choisir de niveau (compétences : un niveau est difficile à juger en une séance). */
  onGarder?: () => void;
  /** Le niveau peut rester vide : la pastille propose « Ajouter un niveau » au lieu de « Choisir un niveau ». */
  niveauFacultatif?: boolean;
}

/**
 * Carte d'un point à évaluer — même présentation partout dans la séance.
 * Aucun niveau n'est présélectionné ; une fois choisi, seul le niveau reste affiché
 * et un appui rouvre les trois choix.
 */
export function Point({ nom, libelles, valeurMin = 0, teintes, valeur, onChoisir, onRetirer, libelleRetirer = 'Retirer', onGarder, niveauFacultatif = false }: Props) {
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
            <button key={l} type="button" role="radio" aria-checked={valeur === i + valeurMin} className="pastille" data-teinte={teintes[i]}
              ref={i === 0 ? premier : undefined}
              onClick={() => { focus.current = 'pastille'; onChoisir(i + valeurMin); setOuvert(false); }}>{l}</button>
          ))}
          {onRetirer && (choisi || valeur === null) ? (
            <button type="button" className="point-retirer" onClick={() => { onRetirer(); setOuvert(false); }}>{libelleRetirer}</button>
          ) : null}
        </div>
      ) : choisi ? (
        <button type="button" ref={pastille} className="pastille choisie" data-teinte={teintes[valeur - valeurMin]}
          aria-label={`${nom} : ${libelles[valeur - valeurMin]}. Modifier le niveau`}
          onClick={() => { focus.current = 'choix'; setOuvert(true); }}>
          <IconeCoche taille={14} />{libelles[valeur - valeurMin]}
        </button>
      ) : (
        <div className="point-actions">
          {onGarder ? <button type="button" className="pastille aucune" aria-label={`Garder : ${nom}`} onClick={onGarder}>Garder</button> : null}
          <button type="button" ref={pastille} className="pastille aucune" aria-label={`${nom} : ${niveauFacultatif ? 'ajouter un niveau' : 'choisir un niveau'}`}
            onClick={() => { focus.current = 'choix'; setOuvert(true); }}>{niveauFacultatif ? 'Ajouter un niveau' : 'Choisir un niveau'}</button>
        </div>
      )}
    </li>
  );
}
