import { decoder, depuisBase64, encoder, versBase64 } from './octets.ts';

/*
 * Copie de secours protégée par un mot de passe.
 *
 * Le fichier de secours quitte l'application (téléchargements, clé USB, courriel…) : il ne profite donc plus de la
 * clé de l'appareil. On le chiffre avec un mot de passe choisi par l'utilisateur : PBKDF2-SHA-256 (nombreux tours,
 * pour ralentir quelqu'un qui essaierait des mots de passe) puis AES-GCM 256. Le mot de passe n'est jamais gardé :
 * s'il est oublié, la copie est définitivement illisible.
 */

export const SCHEMA_COPIE_CHIFFREE = 'journalier-v2-copie-chiffree/1';
export const ITERATIONS_PAR_DEFAUT = 600_000;
export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 8;
const ITERATIONS_MIN = 1_000;
const ITERATIONS_MAX = 5_000_000;

/** Message à montrer si le mot de passe est refusé, `null` s'il convient. */
export function verifierMotDePasse(motDePasse: string): string | null {
  if (motDePasse.trim().length < LONGUEUR_MINIMALE_MOT_DE_PASSE) return `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`;
  return null;
}

interface FichierChiffre { schema: string; kdf: 'PBKDF2-SHA256'; iterations: number; sel: string; iv: string; chiffre: string }

async function deriver(motDePasse: string, sel: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const matiere = await globalThis.crypto.subtle.importKey('raw', encoder.encode(motDePasse.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return globalThis.crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' }, matiere, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function chiffrerCopie(texte: string, motDePasse: string, options: { iterations?: number } = {}): Promise<string> {
  const probleme = verifierMotDePasse(motDePasse);
  if (probleme) throw new Error(probleme);
  const iterations = options.iterations ?? ITERATIONS_PAR_DEFAUT;
  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cle = await deriver(motDePasse, sel, iterations);
  const chiffre = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(SCHEMA_COPIE_CHIFFREE) }, cle, encoder.encode(texte)));
  const fichier: FichierChiffre = { schema: SCHEMA_COPIE_CHIFFREE, kdf: 'PBKDF2-SHA256', iterations, sel: versBase64(sel), iv: versBase64(iv), chiffre: versBase64(chiffre) };
  return JSON.stringify(fichier);
}

function lireEnveloppe(fichier: string): FichierChiffre | null {
  if (!fichier.slice(0, 400).includes('journalier-v2-copie-chiffree/')) return null;
  try {
    const o = JSON.parse(fichier) as Partial<FichierChiffre> | null;
    if (!o || typeof o !== 'object' || typeof o.schema !== 'string' || !o.schema.startsWith('journalier-v2-copie-chiffree/')) return null;
    return o as FichierChiffre;
  } catch { return null; }
}

/** Ce fichier est-il une copie chiffrée (et non une copie en clair) ? */
export const estCopieChiffree = (fichier: string): boolean => lireEnveloppe(fichier) !== null;

export type LectureChiffree = { ok: true; texte: string } | { ok: false; raison: 'format' | 'mot-de-passe'; erreur: string };

export async function dechiffrerCopie(fichier: string, motDePasse: string): Promise<LectureChiffree> {
  const e = lireEnveloppe(fichier);
  if (!e) return { ok: false, raison: 'format', erreur: 'Ce fichier n’est pas une copie chiffrée du Journalier.' };
  if (e.schema !== SCHEMA_COPIE_CHIFFREE) return { ok: false, raison: 'format', erreur: 'Cette copie vient d’une version plus récente de l’application : mettez-la à jour.' };
  const sel = typeof e.sel === 'string' ? depuisBase64(e.sel) : null;
  const iv = typeof e.iv === 'string' ? depuisBase64(e.iv) : null;
  const chiffre = typeof e.chiffre === 'string' ? depuisBase64(e.chiffre) : null;
  const tours = e.iterations;
  if (e.kdf !== 'PBKDF2-SHA256' || !sel || sel.length < 8 || !iv || iv.length !== 12 || !chiffre || chiffre.length < 16 || !Number.isInteger(tours) || tours < ITERATIONS_MIN || tours > ITERATIONS_MAX) {
    return { ok: false, raison: 'format', erreur: 'La copie chiffrée est abîmée ou incomplète.' };
  }
  try {
    const cle = await deriver(motDePasse, sel, tours);
    const clair = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(SCHEMA_COPIE_CHIFFREE) }, cle, chiffre);
    return { ok: true, texte: decoder.decode(clair) };
  } catch {
    // Un mauvais mot de passe et un fichier modifié donnent le même échec : on ne peut pas les distinguer.
    return { ok: false, raison: 'mot-de-passe', erreur: 'Mot de passe incorrect, ou fichier modifié. Rien n’a été restauré.' };
  }
}
