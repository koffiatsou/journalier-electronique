import type { Annee, EntreeReferentiel } from './types.ts';

/**
 * Première rentrée où une année du secondaire suit le tronc commun (source : enseignement.be, « Contenus d'apprentissage
 * en secondaire ») : S1 en 2026, S2 en 2027, S3 en 2028. Avant cette rentrée, l'année suit encore les Socles de compétences
 * (jusqu'en S2) ou les compétences terminales (S3), jamais les lignes du référentiel du tronc commun.
 * Le primaire est déjà au tronc commun ; S4 à S6 n'en relèvent pas.
 */
export const RENTREE_TRONC_COMMUN: Readonly<Partial<Record<Annee, number>>> = { S1: 2026, S2: 2027, S3: 2028 };

/** Première rentrée (année de début de l'année scolaire) où cette ligne s'applique ; 0 = déjà en vigueur. */
export function rentreeDeLigne(entree: Pick<EntreeReferentiel, 'f' | 'n'>): number {
  if (entree.f !== 'TC' || !entree.n) return 0;
  return RENTREE_TRONC_COMMUN[entree.n] ?? 0;
}

/** Rentrée de l'année scolaire d'une date (AAAA-MM-JJ) : 1er août → 31 juillet. undefined si la date est illisible. */
export function rentreeDeDate(iso: string): number | undefined {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return undefined;
  return Number(m[2]) >= 8 ? Number(m[1]) : Number(m[1]) - 1;
}
