import { IconeCoche } from './icons.tsx';

interface ChipProps {
  libelle: string;
  actif: boolean;
  onBascule: () => void;
}

/** Pastille à cocher accessible (bouton à état). */
export function Chip({ libelle, actif, onBascule }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={actif} onClick={onBascule}>
      <IconeCoche taille={14} className="tick" />
      {libelle}
    </button>
  );
}

interface ChipsProps {
  options: readonly string[];
  valeurs: readonly string[];
  onChange: (valeurs: string[]) => void;
  /** Un seul choix possible (comme un bouton radio). */
  unique?: boolean;
}

export function Chips({ options, valeurs, onChange, unique = false }: ChipsProps) {
  const bascule = (o: string) => {
    if (valeurs.includes(o)) onChange(valeurs.filter((v) => v !== o));
    else onChange(unique ? [o] : [...valeurs, o]);
  };
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <Chip key={o} libelle={o} actif={valeurs.includes(o)} onBascule={() => bascule(o)} />
      ))}
    </div>
  );
}
