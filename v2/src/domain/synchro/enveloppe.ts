import type { TypeObjet } from './cles.ts';
import { schemaEnveloppe } from './schemas.ts';

/*
 * Fichier tel qu'il est écrit dans OneDrive : une enveloppe (qui, quoi, quand) autour de l'objet.
 * L'enveloppe porte une version : une application plus ancienne refuse de lire un fichier plus récent
 * au lieu de le déformer.
 */

export const SCHEMA_ENVELOPPE = 'journalier-v2/1';
const TAILLE_MAX = 5_000_000;

export interface Enveloppe { type: TypeObjet; id: string; enregistreLe: string; donnees: unknown }
export type LectureEnveloppe = { ok: true; enveloppe: Enveloppe } | { ok: false; erreur: string };

export function versTexte(type: TypeObjet, id: string, donnees: unknown, enregistreLe: string): string {
  return JSON.stringify({ schema: SCHEMA_ENVELOPPE, type, id, enregistreLe, donnees });
}

export function lireEnveloppe(texte: string): LectureEnveloppe {
  if (texte.length > TAILLE_MAX) return { ok: false, erreur: 'Fichier trop volumineux.' };
  let brut: unknown;
  try { brut = JSON.parse(texte); } catch { return { ok: false, erreur: 'Fichier illisible (ce n’est pas du JSON).' }; }
  const lu = schemaEnveloppe.safeParse(brut);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? 'Fichier inattendu.' };
  // Le schéma a vérifié le type : il fait partie de TYPES_OBJETS.
  return { ok: true, enveloppe: { type: lu.data.type as TypeObjet, id: lu.data.id, enregistreLe: lu.data.enregistreLe, donnees: lu.data.donnees } };
}
