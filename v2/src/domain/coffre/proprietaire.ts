/*
 * « Propriétaire » des données d'un appareil : chaque compte Microsoft a SON espace (sa propre base chiffrée et sa
 * propre clé), le mode essai a le sien. Deux personnes qui se servent du même navigateur ne voient jamais les données
 * l'une de l'autre, et le mode essai n'affiche jamais les vraies données.
 *
 * On ne garde pas l'identifiant du compte tel quel dans le nom de la base : on en tire une empreinte.
 */

/** Espace du mode essai (données fictives, sans compte). */
export const PROPRIETAIRE_ESSAI = 'essai';

/** Nom de la base d'avant le chiffrement (lot 1 à 6 et 8) : lue une fois pour être chiffrée, puis supprimée. */
export const NOM_ANCIENNE_BASE = 'journalier-v2';

export async function proprietaireDeCompte(compteId: string): Promise<string> {
  const hache = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`journalier-v2|compte|${compteId}`));
  return `c${[...new Uint8Array(hache)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export const nomBaseDe = (proprietaire: string): string => `${NOM_ANCIENNE_BASE}-${proprietaire}`;

export const estProprietaireValide = (texte: string): boolean => texte === PROPRIETAIRE_ESSAI || /^c[0-9a-f]{16}$/.test(texte);
