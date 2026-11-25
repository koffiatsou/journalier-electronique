import type { ReactNode } from 'react';
import { couperAppreciation } from '../domain/redaction/appreciation.ts';
import type { Appreciation } from '../domain/redaction/appreciation.ts';
import type { TonLigne } from '../domain/redaction/types.ts';

const SEPARATEUR = ' : ';

/**
 * Texte d'une ligne du bloc. Pour une ligne d'évolution, le début (« Progression, Un peu → Assez »)
 * prend la couleur de son ton ; pour une ligne « éléments | appréciation », l'appréciation devient une pastille
 * de la teinte de la séance, après un trait ; le reste garde la couleur du texte.
 * Sans correspondance (ligne d'un autre genre), la ligne reste du texte simple.
 */
export function texteLigne(ligne: string, ton: TonLigne | null | undefined, appreciation?: Appreciation | null): ReactNode {
  const coupee = couperAppreciation(ligne, appreciation);
  if (coupee && appreciation) {
    return (
      <>
        {coupee.elements}{' '}
        <span className="appreciation-trait" aria-hidden="true" />
        <span className="appreciation" data-teinte={appreciation.teinte}>{coupee.appreciation}</span>
      </>
    );
  }
  const coupe = ligne.indexOf(SEPARATEUR);
  if (!ton || coupe < 0) return ligne;
  return (
    <>
      <span className={`evo-titre evo-${ton}`}>{ligne.slice(0, coupe)}</span>
      {ligne.slice(coupe)}
    </>
  );
}
