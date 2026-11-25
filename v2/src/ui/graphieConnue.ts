import { sansAccents } from '../domain/referentiel/texte.ts';

/** Écarte les espaces de début et de fin et réduit les espaces répétés à un seul. */
const nettoyer = (saisie: string): string => saisie.trim().replace(/\s+/g, ' ');

/**
 * Remet une saisie libre dans la graphie d'une proposition qui lui correspond
 * (casse et accents ignorés) : « français » devient « Français ».
 * Sans correspondance, la saisie est gardée telle quelle (espaces nettoyés) :
 * une matière jamais enregistrée reste valable.
 */
export function graphieConnue(saisie: string, propositions: readonly string[]): string {
  const propre = nettoyer(saisie);
  const cle = sansAccents(propre);
  const trouvee = propositions.find((p) => sansAccents(nettoyer(p)) === cle);
  return trouvee !== undefined ? nettoyer(trouvee) : propre;
}
