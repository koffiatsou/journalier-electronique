import type { ComponentProps } from 'react';
import { Input } from './Field.tsx';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'list'> {
  value: string;
  onChange: (valeur: string) => void;
  /** Choix proposés d'un toucher sous le champ ; la saisie libre reste possible. */
  suggestions: readonly string[];
}

/**
 * Champ de texte avec des propositions sous forme de pastilles.
 * Remplace `<datalist>` : sur tablette, la liste native s'affiche en bulle flottante au milieu de la page
 * et dans la barre du clavier, sans qu'on puisse la placer.
 */
export function ChampSuggestions({ value, onChange, suggestions, ...reste }: Props) {
  const choix = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))];
  return (
    <>
      <Input {...reste} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      {choix.length ? (
        <div className="chips suggestions" role="group" aria-label="Propositions">
          {choix.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={value.trim() === c} onClick={() => onChange(value.trim() === c ? '' : c)}>{c}</button>
          ))}
        </div>
      ) : null}
    </>
  );
}
