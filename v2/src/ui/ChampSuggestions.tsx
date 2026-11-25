import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, FocusEvent, KeyboardEvent } from 'react';
import { Input } from './Field.tsx';
import { graphieConnue } from './graphieConnue.ts';
import { IconeCoche } from './icons.tsx';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'list'> {
  value: string;
  onChange: (valeur: string) => void;
  /** Choix proposés d'un toucher sous le champ ; la saisie libre reste possible. */
  suggestions: readonly string[];
  /**
   * Quand la personne appuie sur Entrée, le texte devient une pastille cochée (même pour une valeur
   * qui n'est pas dans les propositions) : elle voit que sa saisie est prise en compte.
   * La valeur reste enregistrée en direct ; la pastille ne fait que le montrer. Toucher la pastille
   * d'une valeur libre rouvre le champ pour la corriger.
   */
  pastille?: boolean;
}

/**
 * Champ de texte avec des propositions sous forme de pastilles.
 * Remplace `<datalist>` : sur tablette, la liste native s'affiche en bulle flottante au milieu de la page
 * et dans la barre du clavier, sans qu'on puisse la placer.
 */
export function ChampSuggestions({ value, onChange, suggestions, pastille = false, ...reste }: Props) {
  const choix = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))];
  const [confirmee, setConfirmee] = useState(false);
  const champ = useRef<HTMLInputElement | null>(null);
  const pastilleLibre = useRef<HTMLButtonElement | null>(null);
  const valeur = value.trim();
  const libre = pastille && confirmee && valeur !== '' && !choix.includes(valeur);

  // Une valeur effacée ou changée ailleurs (brouillon repris, autre élève) rouvre le champ.
  useEffect(() => { if (valeur === '') setConfirmee(false); }, [valeur]);
  // Après Entrée le champ disparaît : le focus passe à la pastille pour ne pas être perdu.
  useEffect(() => { if (libre) pastilleLibre.current?.focus(); }, [libre]);

  const confirmer = () => {
    const propre = graphieConnue(value, choix);
    if (propre !== value) onChange(propre);
    if (propre !== '') setConfirmee(true);
  };
  const auClavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Entrée ne doit rien envoyer d'autre dans le formulaire.
    if (pastille) confirmer();
  };
  const reouvrir = () => {
    setConfirmee(false);
    requestAnimationFrame(() => champ.current?.focus());
  };
  const basculer = (c: string) => onChange(valeur === c ? '' : c);
  const poserRef = (el: HTMLInputElement | null) => {
    champ.current = el;
    const externe = reste.ref;
    if (typeof externe === 'function') externe(el);
    else if (externe) externe.current = el;
  };
  const normaliser = (e: FocusEvent<HTMLInputElement>) => {
    if (pastille) {
      const propre = graphieConnue(value, choix);
      if (propre !== value) onChange(propre);
    }
    reste.onBlur?.(e);
  };

  return (
    <>
      {libre ? null : (
        <Input
          {...reste}
          ref={poserRef}
          value={value}
          autoComplete="off"
          onKeyDown={auClavier}
          onBlur={normaliser}
          onChange={(e) => { setConfirmee(false); onChange(e.target.value); }}
        />
      )}
      {choix.length || libre ? (
        <div className="chips suggestions" role="group" aria-label="Propositions">
          {libre ? (
            <button ref={pastilleLibre} type="button" className="chip" aria-pressed="true" aria-label={`Modifier : ${valeur}`} onClick={reouvrir}>
              <IconeCoche taille={14} className="tick" />
              {valeur}
            </button>
          ) : null}
          {choix.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={valeur === c} onClick={() => basculer(c)}>
              {pastille ? <IconeCoche taille={14} className="tick" /> : null}
              {c}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
