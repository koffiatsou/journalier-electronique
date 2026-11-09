import type { ReactNode } from 'react';
import type { TonLigne } from '../domain/redaction/types.ts';

const SEPARATEUR = ' : ';

/**
 * Texte d'une ligne du bloc. Pour une ligne d'évolution, le début (« Progression, Un peu → Assez »)
 * prend la couleur de son ton ; le reste garde la couleur du texte.
 */
export function texteLigne(ligne: string, ton: TonLigne | null | undefined): ReactNode {
  const coupe = ligne.indexOf(SEPARATEUR);
  if (!ton || coupe < 0) return ligne;
  return (
    <>
      <span className={`evo-titre evo-${ton}`}>{ligne.slice(0, coupe)}</span>
      {ligne.slice(coupe)}
    </>
  );
}
