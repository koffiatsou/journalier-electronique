import { useEffect, useRef, useState } from 'react';
import { IconeChevron } from './icons.tsx';

interface Props {
  /** Intitulé lu par les lecteurs d'écran, par ex. le nom de l'observation. */
  nom: string;
  libelles: readonly string[];
  valeur: number | null;
  onChange: (valeur: number) => void;
}

/**
 * Choix d'un niveau parmi trois. Rien n'est présélectionné ; une fois le niveau choisi,
 * seul celui-ci reste affiché, et un appui rouvre les trois choix pour le modifier.
 */
export function LevelPicker({ nom, libelles, valeur, onChange }: Props) {
  const [ouvert, setOuvert] = useState(valeur === null);
  const premier = useRef<HTMLButtonElement>(null);
  const dernierChoixOuvert = useRef(false);

  useEffect(() => { if (valeur === null) setOuvert(true); }, [valeur]);
  useEffect(() => {
    if (ouvert && dernierChoixOuvert.current) premier.current?.focus();
    dernierChoixOuvert.current = false;
  }, [ouvert]);

  if (valeur !== null && !ouvert) {
    return (
      <button
        type="button" className="level-chosen" aria-label={`${nom} : ${libelles[valeur]}. Modifier le niveau`}
        onClick={() => { dernierChoixOuvert.current = true; setOuvert(true); }}
      >
        {libelles[valeur]}
        <IconeChevron taille={14} />
      </button>
    );
  }

  return (
    <div className="level" role="radiogroup" aria-label={`Niveau : ${nom}`}>
      {libelles.map((l, i) => (
        <button
          key={l} type="button" role="radio" aria-checked={valeur === i} className="level-opt"
          ref={i === 0 ? premier : undefined}
          onClick={() => { onChange(i); setOuvert(false); }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
