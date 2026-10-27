import { decoder, depuisBase64, encoder, versBase64 } from './octets.ts';

/*
 * Chiffrement d'un enregistrement (AES-GCM 256 bits), comme dans le coffre de la V75.
 *
 * - Chaque enregistrement a son propre IV aléatoire (12 octets) : deux chiffrements du même texte diffèrent.
 * - Des « données authentifiées » (AAD) lient le texte chiffré à son propriétaire, à sa table et à son identifiant :
 *   un enregistrement recopié sous un autre identifiant (ou chez un autre propriétaire) ne se déchiffre plus.
 * - La clé est créée « non extractable » : l'application peut s'en servir, mais personne ne peut la lire ni l'exporter.
 *
 * Forme enregistrée : `j2c1.<iv>.<texte chiffré>` (base64). Le préfixe permet de changer de format plus tard.
 */

export const PREFIXE_SCELLE = 'j2c1';
const LONGUEUR_IV = 12;

/** Où vit un enregistrement : sert à construire les données authentifiées. */
export interface Contexte { proprietaire: string; table: string; id: string }

export type CodeErreurCoffre = 'format' | 'illisible';

/** Un enregistrement ne peut pas être ouvert : mauvais format, mauvaise clé, texte modifié ou déplacé. */
export class ErreurCoffre extends Error {
  readonly code: CodeErreurCoffre;
  constructor(code: CodeErreurCoffre, message: string) { super(message); this.name = 'ErreurCoffre'; this.code = code; }
}

const donneesAuthentifiees = (c: Contexte): Uint8Array<ArrayBuffer> => encoder.encode(`journalier-v2|${c.proprietaire}|${c.table}|${c.id}`);

/** Nouvelle clé de coffre : AES-GCM 256, impossible à exporter. */
export function nouvelleCle(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const estScelle = (texte: unknown): texte is string => typeof texte === 'string' && texte.startsWith(`${PREFIXE_SCELLE}.`);

export async function sceller(cle: CryptoKey, contexte: Contexte, valeur: unknown): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(LONGUEUR_IV));
  const clair = encoder.encode(JSON.stringify(valeur));
  const chiffre = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: donneesAuthentifiees(contexte) }, cle, clair));
  return `${PREFIXE_SCELLE}.${versBase64(iv)}.${versBase64(chiffre)}`;
}

export async function ouvrir(cle: CryptoKey, contexte: Contexte, texte: string): Promise<unknown> {
  const morceaux = texte.split('.');
  const iv = morceaux.length === 3 && morceaux[0] === PREFIXE_SCELLE ? depuisBase64(morceaux[1] ?? '') : null;
  const chiffre = iv ? depuisBase64(morceaux[2] ?? '') : null;
  if (!iv || iv.length !== LONGUEUR_IV || !chiffre || chiffre.length < 16) throw new ErreurCoffre('format', 'Enregistrement chiffré de forme inconnue.');
  let clair: ArrayBuffer;
  try {
    clair = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: donneesAuthentifiees(contexte) }, cle, chiffre);
  } catch { throw new ErreurCoffre('illisible', 'Enregistrement impossible à déchiffrer (clé différente, texte modifié ou déplacé).'); }
  try { return JSON.parse(decoder.decode(clair)) as unknown; } catch { throw new ErreurCoffre('illisible', 'Enregistrement déchiffré mais abîmé.'); }
}
