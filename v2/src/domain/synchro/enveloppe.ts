import { TYPES_OBJETS } from './cles.ts';
import type { TypeObjet } from './cles.ts';

/*
 * Fichier tel qu'il est écrit dans OneDrive : une enveloppe (qui, quoi, quand) autour de l'objet.
 * L'enveloppe porte une version : une application plus ancienne refuse de lire un fichier plus récent
 * au lieu de le déformer.
 */

export const SCHEMA_ENVELOPPE = 'journalier-v2/1';
const VERSION_MAX = 1;
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
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false, erreur: 'Fichier inattendu.' };
  const o = brut as Record<string, unknown>;
  const m = typeof o.schema === 'string' ? /^journalier-v2\/(\d+)$/.exec(o.schema) : null;
  if (!m) return { ok: false, erreur: 'Ce fichier n’a pas été écrit par le Journalier V2.' };
  if (Number(m[1]) > VERSION_MAX) return { ok: false, erreur: 'Ce fichier vient d’une version plus récente de l’application : mettez-la à jour.' };
  if (typeof o.type !== 'string' || !(TYPES_OBJETS as readonly string[]).includes(o.type)) return { ok: false, erreur: 'Type d’objet inconnu.' };
  if (typeof o.id !== 'string' || !o.id) return { ok: false, erreur: 'Identifiant manquant.' };
  if (!o.donnees || typeof o.donnees !== 'object') return { ok: false, erreur: 'Contenu manquant.' };
  return { ok: true, enveloppe: { type: o.type as TypeObjet, id: o.id, enregistreLe: typeof o.enregistreLe === 'string' ? o.enregistreLe : '', donnees: o.donnees } };
}
