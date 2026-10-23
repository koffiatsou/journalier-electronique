/* Petits outils de langue française, sans dépendance. */

/** Espace insécable : évite un retour à la ligne avant « : », « ; ». */
export const NBSP = ' ';

export const nettoyer = (v: unknown): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';

export const minusculePremiere = (s: string): string => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const majusculePremiere = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Ajoute un point final seulement s'il manque. */
export const finPhrase = (s: string): string => (!s ? s : /[.!?…]$/.test(s) ? s : `${s}.`);

/** 2026-10-23 → 23/10/2026 (format belge). */
export function dateFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : nettoyer(iso);
}

/** 2026-10-23 → 23/10 */
export function dateCourte(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : '';
}

/** Liste « a ; b ; c » avec espaces insécables avant le point-virgule. */
export const enumeration = (items: readonly string[]): string => items.join(`${NBSP}; `);
